/**
 * MISMO.js extended validation harness (network).
 *
 * Pulls additional MISMO XML samples from public GitHub repositories and runs
 * the same data-integrity checks as test/mismo.test.mjs:
 *   1. parse() succeeds and yields a root MESSAGE
 *   2. Zero data loss: every leaf value and attribute survives
 *      parse -> compose with exact (entity-decoded) fidelity
 *   3. compose() emits exactly ONE well-formed XML declaration
 *   4. parse -> compose -> parse is structurally stable
 *   5. XLink relationships are indexed when present
 *
 * The source files are GPL/AGPL-licensed, so they are fetched at test time and
 * are NOT vendored into this repository. If the network is unavailable the
 * affected files are skipped (and reported) rather than failing the run.
 *
 * Run with: npm run test:extra   (or)   node test/mismo-extra.test.mjs
 */
import { XMLValidator } from 'fast-xml-parser';
import { MismoEngine } from '../src/index.js';

// [repo, path-in-repo, display label]
const FILES = [
  ['matmill5/MISMO', 'tests/samples/mismo-3.4-sample.xml', 'MISMO 3.4 sample'],
  ['247apps/UADMismoXML', 'src/Appraisal/Two-Four-units_v1.1.xml', 'UAD 2-4 units v1.1'],
  ['247apps/UADMismoXML', 'src/Appraisal/Two-Four-units_v1.xml', 'UAD 2-4 units v1'],
  ['247apps/UADMismoXML', 'src/Appraisal/xml_v3.4_2019.xml', 'UAD XML 3.4 (2019)'],
  ['MarlonRabara/mortgage-model', 'MISMO XML/Scenario 1 - Fannie Mae Conventional Fixed-Rate Purchase – Whole Loan.xml', 'Fannie Scenario 1 (Fixed Purchase)'],
  ['MarlonRabara/mortgage-model', 'MISMO XML/Scenario 2 - Fannie Mae Conventional ARM Refinance – Whole Loan.xml', 'Fannie Scenario 2 (ARM Refi)'],
  ['MarlonRabara/mortgage-model', 'MISMO XML/Scenario 3 - Fannie Mae Conventional Fixed-Rate Condo Purchase - Whole Loan Delivery.xml', 'Fannie Scenario 3 (Condo Delivery)'],
  ['MarlonRabara/mortgage-model', 'MISMO XML/Scenario 4 - Fannie Mae Purchase 30 Year Conventional Mortgage Transaction Updated for UAD 3.6 Narrative - Whole Loan.xml', 'Fannie Scenario 4 (UAD 3.6)'],
  ['MarlonRabara/mortgage-model', 'MISMO XML/sample-loan-application.xml', 'Sample loan application'],
];

let pass = 0;
let fail = 0;
let skipped = 0;

function ok(cond, message) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${message}`);
  }
}

async function fetchRaw(repo, path) {
  const enc = encodeURIComponent(path);
  for (const branch of ['main', 'master']) {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${enc}`);
    if (res.status === 200) return res.text();
  }
  return null;
}

// Decode the five predefined XML entities.
const dec = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// Multiset of tag -> [decoded leaf values...] for attribute-less leaf elements.
function leafMultiset(xml) {
  const map = new Map();
  const re = /<([A-Za-z_][A-Za-z0-9_.:]*)([^>]*)>([^<>]*)<\/\1>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[3].trim() === '' || m[2].trim() !== '') continue; // skip empty + attributed
    const tag = m[1];
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag).push(dec(m[3].trim()));
  }
  return map;
}

// Multiset of "name=value" attribute strings (xmlns declarations excluded).
function attrMultiset(xml) {
  const map = new Map();
  const re = /\s([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1].startsWith('xmlns')) continue;
    const key = `${m[1]}="${dec(m[2])}"`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

for (const [repo, path, label] of FILES) {
  let xml;
  try {
    xml = await fetchRaw(repo, path);
  } catch {
    xml = null;
  }
  if (!xml) {
    skipped++;
    console.log(`SKIP ${label}: could not fetch from ${repo} (offline?)`);
    continue;
  }
  console.log(`\n===== ${label} (${xml.length} bytes) =====`);
  const engine = new MismoEngine();

  let parsed;
  try {
    parsed = engine.parse(xml);
  } catch (e) {
    ok(false, `${label}: parse threw: ${e.message}`);
    continue;
  }
  ok(parsed.MESSAGE, `${label}: root MESSAGE present`);

  let xml2;
  try {
    xml2 = engine.compose(parsed);
  } catch (e) {
    ok(false, `${label}: compose threw: ${e.message}`);
    continue;
  }

  // --- Leaf value fidelity (entity-decoded) ------------------------------
  const srcLeaves = leafMultiset(xml);
  const outLeaves = leafMultiset(xml2);
  let leafTotal = 0;
  let leafChanged = [];
  for (const [tag, values] of srcLeaves) {
    const out = outLeaves.get(tag) || [];
    values.forEach((v, i) => {
      leafTotal++;
      if (out[i] !== v) {
        if (leafChanged.length < 4) leafChanged.push(`${tag}="${v}" -> "${out[i]}"`);
      }
    });
    if (out.length !== values.length && leafChanged.length < 4) {
      leafChanged.push(`${tag}: occurrence count ${values.length} vs ${out.length}`);
    }
  }
  ok(
    leafChanged.length === 0,
    `${label}: ${leafTotal} leaf values preserved exactly` +
      (leafChanged.length ? ` — CHANGED: ${leafChanged.join(' | ')}` : '')
  );

  // --- Attribute fidelity ------------------------------------------------
  const srcAttrs = attrMultiset(xml);
  const outAttrs = attrMultiset(xml2);
  let attrTotal = 0;
  const attrChanged = [];
  for (const [key, count] of srcAttrs) {
    attrTotal += count;
    if ((outAttrs.get(key) || 0) !== count) attrChanged.push(key);
  }
  ok(
    attrChanged.length === 0,
    `${label}: ${attrTotal} attributes preserved exactly` +
      (attrChanged.length ? ` — CHANGED: ${attrChanged.slice(0, 4).join(' | ')}` : '')
  );

  // --- Single well-formed XML declaration --------------------------------
  const declCount = (xml2.match(/<\?xml/g) || []).length;
  ok(declCount === 1, `${label}: exactly one XML declaration (got ${declCount})`);
  ok(XMLValidator.validate(xml2) === true, `${label}: composed output is well-formed XML`);

  // --- parse -> compose -> parse stability -------------------------------
  try {
    const reparse = engine.parse(xml2);
    ok(
      JSON.stringify(parsed.MESSAGE) === JSON.stringify(reparse.MESSAGE),
      `${label}: parse -> compose -> parse structurally stable`
    );
  } catch (e) {
    ok(false, `${label}: reparse threw: ${e.message}`);
  }

  // --- XLink indexing when the payload uses relationships ----------------
  if (/<RELATIONSHIP[^>]*xlink:from=/.test(xml)) {
    ok(engine.registry.length > 0, `${label}: indexed ${engine.registry.length} xlink relationships`);
  }
}

console.log('');
console.log(
  `pass=${pass} fail=${fail}` + (skipped ? ` skipped=${skipped} (offline files)` : '')
);
process.exit(fail === 0 ? 0 : 1);
