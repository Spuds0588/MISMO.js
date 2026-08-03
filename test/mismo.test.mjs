/**
 * MISMO.js engine tests.
 *
 * Runs the engine against the official UCD v2.0 sample files in /test-files
 * and verifies:
 *   1. parse() succeeds and produces the expected MISMO structure
 *   2. No data corruption on parse (money amounts, rates, long identifiers)
 *   3. Predictable array coercion for known MISMO collection containers
 *   4. compose() round-trips losslessly (parse -> compose -> parse is stable)
 *   5. compose() does not mutate the caller's object
 *   6. XLink relationship indexing + getLinkedEntities()
 *
 * Run with: npm test   (or)   node test/mismo.test.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import { MismoEngine } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(HERE, '..', 'test-files');

const FILES = [
  'Purchase ARM UCD v2.0.xml',
  'Purchase Fixed UCD v2.0.xml',
  'Refi ARM Model UCD v2.0.xml',
  'Refinance Fixed UCD v2.0.xml',
];

let pass = 0;
let fail = 0;

function ok(cond, message) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${message}`);
  }
}

// Locate a single instance of a tag under the DEAL (first match wins).
function firstLeaf(xml, tag) {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1] : null;
}

// Deep navigation to the first DEAL of a parsed payload.
function firstDeal(parsed) {
  return parsed.MESSAGE.DOCUMENT_SETS.DOCUMENT_SET[0]
    .DOCUMENTS.DOCUMENT[0]
    .DEAL_SETS.DEAL_SET[0]
    .DEALS.DEAL[0];
}

for (const file of FILES) {
  const xml = readFileSync(join(TEST_DIR, file), 'utf8');
  const engine = new MismoEngine();
  const parsed = engine.parse(xml);

  // --- 1. Root structure ------------------------------------------------
  ok(parsed.MESSAGE, `${file}: root MESSAGE present`);
  const deal0 = firstDeal(parsed);
  ok(deal0, `${file}: DEAL reachable via MESSAGE.DOCUMENT_SETS...DEAL`);

  // --- 2. Value fidelity (no number coercion corruption) ---------------
  // Every attribute-less leaf must survive parse with its exact text,
  // except whitespace trimming (fast-xml-parser trims values by default).
  const leafRe = /<([A-Za-z_][A-Za-z0-9_.:]*)([^>]*)>([^<>]*)<\/\1>/g;
  let leaves = 0;
  let corrupted = [];
  let m;
  while ((m = leafRe.exec(xml)) !== null) {
    const value = m[3];
    if (value.trim() === '' || m[2].trim() !== '') continue; // skip empty + attributed
    leaves++;
    // Find the same leaf in the parsed tree and compare trimmed values.
    const found = findInTree(parsed, m[1], value);
    if (!found) {
      if (corrupted.length < 5) corrupted.push(`${m[1]}="${value}"`);
    }
  }
  ok(
    corrupted.length === 0,
    `${file}: ${leaves} plain leaf values preserved (corrupted: ${corrupted.join(', ') || 'none'})`
  );

  // Long numeric identifiers must never be mangled.
  const mersRaw = firstLeaf(xml, 'LoanIdentifierType');
  const longIdRaw = xml.match(/<LoanIdentifier>([0-9]{16,})<\/LoanIdentifier>/);
  if (longIdRaw) {
    const mers = findInTree(parsed, 'LoanIdentifier', longIdRaw[1]);
    ok(mers === longIdRaw[1], `${file}: 18-digit LoanIdentifier '${longIdRaw[1]}' preserved (got ${JSON.stringify(mers)})`);
  }

  // --- 3. Array coercion -------------------------------------------------
  ok(Array.isArray(parsed.MESSAGE.DOCUMENT_SETS.DOCUMENT_SET), `${file}: DOCUMENT_SET is array`);
  ok(
    Array.isArray(parsed.MESSAGE.DOCUMENT_SETS.DOCUMENT_SET[0].DOCUMENTS.DOCUMENT),
    `${file}: DOCUMENT is array`
  );
  ok(
    Array.isArray(
      parsed.MESSAGE.DOCUMENT_SETS.DOCUMENT_SET[0].DOCUMENTS.DOCUMENT[0].DEAL_SETS.DEAL_SET
    ),
    `${file}: DEAL_SET is array`
  );
  ok(Array.isArray(deal0.LOANS.LOAN), `${file}: LOAN is array`);
  ok(Array.isArray(deal0.PARTIES.PARTY), `${file}: PARTY is array`);
  ok(Array.isArray(deal0.LOANS.LOAN[0].LOAN_IDENTIFIERS.LOAN_IDENTIFIER), `${file}: LOAN_IDENTIFIER is array`);

  // --- 4. compose() round-trip ------------------------------------------
  const xml2 = engine.compose(parsed);
  ok(xml2.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), `${file}: compose emits XML declaration`);
  const reparse = engine.parse(xml2);
  ok(
    JSON.stringify(parsed.MESSAGE) === JSON.stringify(reparse.MESSAGE),
    `${file}: parse -> compose -> parse is structurally identical`
  );
  // Exactly one XML declaration (the builder also emits parsed '?xml' nodes,
  // so compose() must not prepend a second one) and the output must be
  // well-formed.
  const declCount = (xml2.match(/<\?xml/g) || []).length;
  ok(declCount === 1, `${file}: compose emits exactly one XML declaration (got ${declCount})`);
  const validation = XMLValidator.validate(xml2);
  ok(validation === true, `${file}: composed output is well-formed XML`);

  // --- 5. compose() must not mutate the input ---------------------------
  const userObj = { MESSAGE: { DOCUMENT_SETS: {} } };
  const before = JSON.stringify(userObj);
  engine.compose(userObj);
  ok(before === JSON.stringify(userObj), `${file}: compose does not mutate caller input`);
}

// --- 6. XLink indexing ---------------------------------------------------
const xlinkXml = `<?xml version="1.0"?>
<MESSAGE xmlns="http://www.mismo.org/residential/2009/schemas" xmlns:xlink="http://www.w3.org/1999/xlink">
  <DEAL_SETS><DEAL_SET><DEALS><DEAL>
    <PARTIES><PARTY><ROLE><ROLE_DETAIL><PartyRoleType>Borrower</PartyRoleType></ROLE_DETAIL></ROLE></PARTY></PARTIES>
    <RELATIONSHIPS>
      <RELATIONSHIP xlink:from="Role_1" xlink:to="Loan_1" xlink:arcrole="urn:fdc:mismo.org:2009:residential/role-loan"/>
    </RELATIONSHIPS>
  </DEAL></DEALS></DEAL_SET></DEAL_SETS>
</MESSAGE>`;
const xlinkEngine = new MismoEngine();
const xlinkParsed = xlinkEngine.parse(xlinkXml);
ok(xlinkEngine.registry.length === 1, 'XLink: relationship indexed');
ok(xlinkEngine.getLinkedEntities('Role_1')[0] === 'Loan_1', 'XLink: getLinkedEntities(Role_1) -> [Loan_1]');
const xlinkRoundTrip = xlinkEngine.parse(xlinkEngine.compose(xlinkParsed));
ok(Boolean(xlinkRoundTrip.MESSAGE), 'XLink: compose -> parse round-trip stable');

// --- Summary -------------------------------------------------------------
console.log('');
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail === 0 ? 0 : 1);

// Recursively search the parsed tree for a key with a given (trimmed) value.
function findInTree(node, key, value) {
  if (node === null || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = findInTree(item, key, value);
      if (r !== undefined) return r;
    }
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(node, key)) {
    const v = node[key];
    // fast-xml-parser trims tag values by default; compare on trimmed text so
    // whitespace normalization doesn't count as corruption, while real value
    // changes (e.g. "240000.00" -> "240000") still fail.
    if (typeof v === 'string' && v.trim() === value.trim()) return v;
  }
  for (const child of Object.values(node)) {
    const r = findInTree(child, key, value);
    if (r !== undefined) return r;
  }
  return undefined;
}
