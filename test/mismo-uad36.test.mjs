/**
 * MISMO.js UAD 3.6 (MISMO Reference Model 3.6) fidelity tests.
 *
 * Covers the official Fannie Mae / Freddie Mac Uniform Appraisal Dataset
 * (UAD) 3.6 sample XML files vendored in /test-files/uad36, which exercise
 * a newer MISMO reference model (3.6.0366) than the UCD v2.0 samples:
 *   - URAR single-family, condo, manufactured-home, and 2-4 unit appraisals
 *   - Appraisal Update Report and Completion Report
 *   - Windows CRLF line endings with multi-line text values
 *   - Heavy xlink:label usage (relationship indexing)
 *
 * Checks:
 *   1. parse() succeeds and yields a root MESSAGE
 *   2. Zero data loss: every leaf value and attribute survives
 *      parse -> compose with exact fidelity. Line endings are compared per
 *      the XML spec (CRLF/CR normalize to LF), which is what any conformant
 *      XML consumer sees.
 *   3. compose() emits exactly ONE well-formed XML declaration
 *   4. parse -> compose -> parse is structurally stable
 *   5. XLink relationships are indexed when present
 *
 * The ULAD (Uniform Loan Application Dataset) sample is a third-party gist
 * (unlicensed), so it is fetched at test time and NOT vendored; it is
 * skipped gracefully when the network is unavailable.
 *
 * Run with: npm test   (or)   node test/mismo-uad36.test.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { XMLValidator } from 'fast-xml-parser';
import { MismoEngine } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const UAD36_DIR = join(HERE, '..', 'test-files', 'uad36');

// Third-party ULAD application sample (unlicensed -> network fetch only).
const ULAD_GIST_URL =
  'https://gist.githubusercontent.com/baharalidurrani/6ae5951337488ae8659c04da144a67ad/raw/mismo-sample.xml';

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

// Decode the five predefined XML entities.
const dec = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// XML-spec line-ending normalization: CRLF and CR become LF in parsed text.
const norm = (s) => dec(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// Multiset of tag -> [decoded leaf values...] for attribute-less leaf elements.
function leafMultiset(xml) {
  const map = new Map();
  const re = /<([A-Za-z_][A-Za-z0-9_.:]*)([^>]*)>([^<>]*)<\/\1>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[3].trim() === '' || m[2].trim() !== '') continue; // skip empty + attributed
    const tag = m[1];
    if (!map.has(tag)) map.set(tag, []);
    map.get(tag).push(norm(m[3].trim()));
  }
  return map;
}

// Multiset of "name=value" attribute strings (xmlns declarations excluded).
function attrMultiset(xml) {
  const map = new Map();
  const re = /\s([A-Za-z_:][\w:.-]*)=\"([^\"]*)\"/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1].startsWith('xmlns')) continue;
    const key = `${m[1]}="${norm(m[2])}"`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function runFidelitySuite(xml, label, expectXlinks = 0) {
  const engine = new MismoEngine();
  let parsed;
  try {
    parsed = engine.parse(xml);
  } catch (e) {
    ok(false, `${label}: parse threw: ${e.message}`);
    return;
  }
  ok(parsed.MESSAGE, `${label}: root MESSAGE present`);
  if (expectXlinks > 0) {
    ok(engine.registry.length >= expectXlinks, `${label}: XLink relationships indexed (>= ${expectXlinks}, got ${engine.registry.length})`);
  }

  let xml2;
  try {
    xml2 = engine.compose(parsed);
  } catch (e) {
    ok(false, `${label}: compose threw: ${e.message}`);
    return;
  }

  // --- Leaf value fidelity (entity-decoded, CR-normalized) ---------------
  const srcLeaves = leafMultiset(xml);
  const outLeaves = leafMultiset(xml2);
  let leafTotal = 0;
  let leafChanged = [];
  for (const [tag, values] of srcLeaves) {
    const out = outLeaves.get(tag) || [];
    values.forEach((v, i) => {
      leafTotal++;
      if (out[i] !== v && leafChanged.length < 4) leafChanged.push(`${tag}="${v.slice(0, 60)}..."`);
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

  // --- Attribute fidelity --------------------------------------------------
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

  // --- Single well-formed XML declaration ---------------------------------
  const declCount = (xml2.match(/<\?xml/g) || []).length;
  ok(declCount === 1, `${label}: exactly one XML declaration (got ${declCount})`);
  ok(XMLValidator.validate(xml2) === true, `${label}: composed output is well-formed XML`);

  // --- parse -> compose -> parse stability ---------------------------------
  try {
    const reparse = engine.parse(xml2);
    ok(
      JSON.stringify(parsed.MESSAGE) === JSON.stringify(reparse.MESSAGE),
      `${label}: parse -> compose -> parse is structurally identical`
    );
  } catch (e) {
    ok(false, `${label}: reparse threw: ${e.message}`);
  }
}

// --- Vendored UAD 3.6 samples (offline) -------------------------------------
const FILES = [
  ['SF1_Appraisal_v1.2.xml', 'URAR single-family', 20],
  ['Condo1_Appraisal_v1.2.xml', 'URAR condo', 27],
  ['MH1_Appraisal_v1.2.xml', 'URAR manufactured home (CRLF text)', 24],
  ['2- to 4-unit_Appraisal_v1.2.xml', 'URAR 2-4 unit', 52],
  ['AU1_AppraisalUpdate_v1.3.xml', 'Appraisal Update Report', 2],
  ['CR1_CompletionReport_v1.2.xml', 'Completion Report', 2],
];

for (const [file, label, xlinks] of FILES) {
  console.log(`\n===== UAD 3.6: ${label} (${file}) =====`);
  const xml = readFileSync(join(UAD36_DIR, file), 'utf8');
  ok(/MISMOReferenceModelIdentifier="3\.6\./.test(xml), `${label}: MISMO 3.6 reference model`);
  runFidelitySuite(xml, label, xlinks);
}

// --- ULAD application sample (network, not vendored) ------------------------
console.log('\n===== ULAD (Uniform Loan Application Dataset) =====');
let ulad;
try {
  const res = await fetch(ULAD_GIST_URL);
  ulad = res.status === 200 ? await res.text() : null;
} catch {
  ulad = null;
}
if (!ulad) {
  skipped++;
  console.log('SKIP ULAD sample: could not fetch gist (offline?)');
} else {
  ok(/xmlns:ULAD=/.test(ulad), 'ULAD: carries the ULAD namespace');
  runFidelitySuite(ulad, 'ULAD application', 9);
}

// --- Summary -----------------------------------------------------------------
console.log('');
console.log(`pass=${pass} fail=${fail}${skipped ? ` skipped=${skipped}` : ''}`);
process.exit(fail === 0 ? 0 : 1);
