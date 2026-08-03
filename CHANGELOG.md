# Changelog

All notable changes to this project are documented in this file.
Releases are tagged on GitHub (e.g., `v0.2.0`).

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
