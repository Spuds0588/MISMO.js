# Changelog

All notable changes to this project are documented in this file.
Releases are tagged on GitHub (e.g., `v0.3.0`).

## [0.3.0] - 2026-08-31

### Added
- **UAD 3.6 fidelity suite** (`test/mismo-uad36.test.mjs`, runs as part of
  `npm test`): 56 assertions across the official Fannie Mae / Freddie Mac
  Uniform Appraisal Dataset sample files now vendored in `/test-files/uad36`.
  Covers the **MISMO 3.6 reference model** (`3.6.0366`) — a distinct line from
  the existing 3.4 UCD samples — including URAR single-family, condo,
  manufactured-home, and 2-4 unit appraisals, plus Appraisal Update and
  Completion Report scenarios.
- **ULAD application sample** (Uniform Loan Application Dataset / 1003 data),
  fetched at test time from a public gist and validated when the network is
  available (not vendored — third-party licensing).
- Expanded offline test corpus: the bundled real-world MISMO files grew from
  4 (UCD v2.0) to **10 vendored files** (4 UCD + 6 UAD 3.6), plus the ULAD
  gist and 9 more public samples in `test:extra`.

### What the new samples exercise
- **Windows CRLF line endings** with multi-line text values (UAD 3.6 ships
  CRLF-normalized text, verifying line-ending-aware fidelity handling).
- **Heavy `xlink:{from,to,label,arcrole}` relationship indexing** — up to 52
  indexed relationships in one appraisal file, doubling the prior worst case.
- Deeper MISMO 3.6 container nesting (properties, inspections, defects,
  valuation analyses, signatories) on top of the existing 3.4 structure.

### Verified
- 20 real MISMO files (~1.7 MB) across all suites: 100% leaf-value and
  attribute fidelity on `parse → compose` round-trip, well-formed single
  declaration output, and correct XLink relationship indexing (up to 52
  relationships), across 10 vendored files plus the network samples.

### Known gap
- Official **ULDD** (Uniform Loan Delivery Dataset) samples live behind the
  GSE sites' login/bot-protection and cannot be reliably vendored or fetched
  by the test runner. The MISMO 3.0.x line they represent is therefore not
  directly covered; the vendored corpus covers MISMO 3.4 (UCD) and 3.6 (UAD)
  instead. If you have a sanitized ULDD sample to contribute, open an issue.

## [0.2.0] - 2026-08-03

### Fixed
- **CRITICAL — data corruption on parse:** values are now preserved as exact
  strings instead of being coerced to JS numbers. Money amounts (`240000.00`),
  rates (`9.0000`), and padded identifiers (`000123`) previously lost precision
  on every `parse()` (117/609 leaves corrupted in one sample file).
- **Duplicate XML declaration:** `compose()` no longer emits a second `<?xml`
  declaration when the payload was parsed from a file that already contained
  one — output is always well-formed with exactly one declaration.
- **Input mutation:** `compose()` no longer mutates the caller's object when
  injecting the default namespace.
- **Expanded array coercion:** the list of MISMO collection containers forced
  into arrays grew from 12 to 39 (`DOCUMENT_SET`, `DEAL_SET`, `FEE`, `LICENSE`,
  `CASH_TO_CLOSE_ITEM`, `LOAN_IDENTIFIER`, …), eliminating the classic
  XML-to-JSON "single element parses as object" defect.

### Added
- `test/mismo.test.mjs` (`npm test`): offline suite — 63 assertions across the
  bundled UCD v2.0 samples covering structure, value fidelity, array coercion,
  round-trip stability, non-mutation, and XLink indexing.
- `test/mismo-extra.test.mjs` (`npm run test:extra`): network suite — 57
  assertions across 9 public MISMO samples (MISMO 3.4, UAD 2-4 units, Fannie
  Mae delivery scenarios). Fetched at test time; not vendored (licensing).
- GitHub issue template for parsing bug reports (example data required).
- Committed `dist/` build artifacts so the repo is directly consumable.

### Verified
- 13 real MISMO files (~956 KB): 100% leaf-value and attribute fidelity on
  `parse → compose` round-trip; well-formed output; XLink indexing exercised
  against real files (up to 52 relationships).
