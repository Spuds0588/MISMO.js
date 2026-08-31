# MISMO.js

> **Live demo:** <https://spuds0588.github.io/MISMO.js/> — try the parse → export loop in your browser
> **Author:** [Corey Burns (Spuds0588)](https://github.com/Spuds0588) · [LinkedIn](https://www.linkedin.com/in/coreytburns) · [Linktree](https://linktr.ee/CoreyBurns) — open to consulting on MISMO / UCD / ULAD integrations

A lightweight, client-optimized library to read, manipulate, and generate MISMO 3.4 compliant XML files directly in the browser or Node.js.

Designed for modern mortgage tech (Point-of-Sale portals, digital closing dashboards, etc.), `mismo.js` translates dense MISMO XML payloads into predictable, developer-friendly JavaScript objects in milliseconds.

## Features

- **Bi-directional Processing:** Translate MISMO 3.4 XML to JSON and serialize it back to XML seamlessly.
- **Exact Data Fidelity:** Values are preserved as exact strings — money amounts (`"240000.00"`), rates (`"9.0000"`), and padded identifiers (`"000123"`) are never silently coerced to JS numbers.
- **Predictable Schema Arrays:** Automatically enforces known MISMO collection blocks (e.g., `LOAN`, `PARTY`, `PROPERTY`, `DOCUMENT_SET`, `DEAL_SET`) into arrays, eliminating the classic XML-to-JSON defect where single elements parse as objects instead of lists.
- **Automated XLink Resolution:** Indexes `<RELATIONSHIPS>` arrays via `xlink:from` and `xlink:to` attributes automatically during parsing.
- **Browser-First Architecture:** Bundles a lightning-fast XML parser directly into the distribution payload, requiring zero external dependencies for the end consumer.

## Installation & Setup

Ensure you have Node.js installed, then clone the repository and install the development dependencies:

```bash
npm install
```

### Running the Diagnostic Dashboard (Dev)
To test the parser directly in your browser with a local MISMO XML file:

```bash
npm run dev
```

Open the provided `localhost` URL in your browser and upload a `.xml` file to see the parsed JSON and XLink relationships in real-time.

### Building for Production
To generate the final, minified distribution files — `dist/mismo.js` (ES modules), `dist/mismo.umd.cjs` (UMD — Node/legacy bundlers), and `dist/mismo.iife.js` (IIFE — plain `<script>` tags, exposes `window.MismoJS`):

```bash
npm run build
```

### Testing
Two automated test suites verify the engine against real MISMO sample files:

```bash
npm test            # Offline suite: the bundled UCD v2.0 samples in /test-files
npm run test:extra  # Network suite: 9 additional public MISMO samples (needs internet)
```

The suites assert that every leaf value and attribute survives `parse → compose` exactly, that output is well-formed with a single XML declaration, and that XLink relationships are indexed correctly.

## Browser / Front-End Usage (no build step)

mismo.js is browser-first: drop in **one `<script>` tag** and `window.MismoJS` is yours — no bundler, no npm, no build step. All `dist/` builds bundle the XML parser, so the end consumer needs zero dependencies.

### Option A — classic `<script>` tag (recommended)

```html
<script src="https://cdn.jsdelivr.net/gh/Spuds0588/MISMO.js@v0.2.0/dist/mismo.iife.js"></script>
<script>
  const engine = new MismoJS.MismoEngine();
  const parsed = engine.parse(`<MESSAGE>…</MESSAGE>`);
</script>
```

Use `@main` instead of a pinned tag to always track the latest commit. Self-hosting? Serve `dist/mismo.iife.js` from your own static assets and point the `<script src>` at it.

### Option B — ES module import

```html
<script type="module">
  import { MismoEngine } from "https://cdn.jsdelivr.net/gh/Spuds0588/MISMO.js@v0.2.0/dist/mismo.js";
  const engine = new MismoEngine();
</script>
```

### Upload a MISMO XML file → parse → export back to XML

A complete, copy-pasteable example with no framework required (see [`examples/browser-demo.html`](./examples/browser-demo.html) for a styled, runnable version):

```html
<input type="file" id="xmlFile" accept=".xml" />
<pre id="output"></pre>
<button id="download" disabled>Export MISMO XML</button>

<script src="https://cdn.jsdelivr.net/gh/Spuds0588/MISMO.js@v0.2.0/dist/mismo.iife.js"></script>
<script>
  const engine = new MismoJS.MismoEngine();

  // 1. Upload → parse
  document.getElementById("xmlFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const xml = await file.text();              // read the uploaded .xml
    window.parsed = engine.parse(xml);          // MISMO XML → JS object
    document.getElementById("output").textContent =
      JSON.stringify(window.parsed, null, 2);
    document.getElementById("download").disabled = false;
  });

  // 2. Export → compose + download as .xml
  document.getElementById("download").addEventListener("click", () => {
    if (!window.parsed) return;
    const xml = engine.compose(window.parsed);  // JS object → MISMO XML
    const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "exported-mismo.xml";
    a.click();
    URL.revokeObjectURL(url);
  });
</script>
```

## Quick Start Usage

### Parsing MISMO XML

```javascript
import { MismoEngine } from 'mismo.js';

// 1. Initialize the engine
const engine = new MismoEngine();

// 2. Parse a raw XML string
const xmlPayload = `<MESSAGE>...</MESSAGE>`;
const parsedData = engine.parse(xmlPayload);

console.log(parsedData.MESSAGE.DEAL_SETS.DEAL_SET.DEALS.DEAL[0]);
```

### Querying Relationships (XLinks)

The engine automatically indexes all relationships upon parsing. You don't need to manually traverse the tree to find out which property belongs to which loan.

```javascript
// Get all entity IDs linked to a specific Borrower (e.g., "Borrower_1")
const linkedEntities = engine.getLinkedEntities("Borrower_1");
console.log(linkedEntities); // Outputs array of IDs, e.g., ["Role_1", "Loan_1"]
```

### Composing Back to XML

```javascript
const updatedData = {
    MESSAGE: {
        // ... modified MISMO structure
    }
};

const newXmlString = engine.compose(updatedData);
console.log(newXmlString);
```

## Architectural Notes
While `mismo.js` acts as a zero-dependency package for end-users, under the hood it leverages [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) for raw text manipulation to ensure 10MB+ ULDD/UCD files can be parsed in under 1.5 seconds without blocking the main browser thread. `fast-xml-parser` is bundled directly into the `dist/` build via Vite.

## Test Data & Example Files

To make testing easy, this repository includes official industry-standard MISMO XML sample files in the `/test-files` directory. These files are sourced from the Fannie Mae / Freddie Mac Uniform Mortgage Data Program (UMDP).

- **UCD (Uniform Closing Dataset) Samples:** Represents complex, deeply nested MISMO 3.3/3.4 closing disclosure data.
- **ULDD (Uniform Loan Delivery Dataset) Samples:** Represents massive loan delivery payloads.

### How to test with them:
1. Run `npm run dev` to launch the local diagnostic dashboard.
2. Click **"Choose File"** in your browser.
3. Select any `.xml` file from the `/test-files` folder in this repository.
4. View the lightning-fast parsing times and XLink relationship mappings directly in your console and browser UI.

*(Note: If you need the complete, exhaustive test suites for every edge case, you can download the official GSE test zip files directly from the [Fannie Mae UCD Tech Resources page](https://singlefamily.fanniemae.com/delivering/uniform-mortgage-data-program/uniform-closing-dataset).)*

## Reporting Parsing Issues

Found a file that parses incorrectly, loses data, or throws? **Please file a GitHub issue** — a reproducible sample is the single most valuable thing you can include.

We can't fix what we can't reproduce, so please use the [Parsing bug report template](https://github.com/Spuds0588/MISMO.js/issues/new/choose) and include:

1. **Example MISMO XML (required):** Paste the smallest XML snippet that reproduces the problem, or attach a `.xml` file.
   - *Data privacy:* replace all real borrower/PII data (names, SSNs, loan numbers, addresses) with placeholders first.
2. **Engine version:** the `mismo.js` version you're using (see `package.json`).
3. **Environment:** browser + version, or Node.js version.
4. **Expected vs. actual behavior:** what you expected the parsed JSON to look like vs. what you got, including any error message and stack trace.

**Before filing, please run the repro through `npm test` and `npm run test:extra`** — if it reproduces there, attach the sample file to the issue so we can add it to the test suite permanently.

## Versioning

See [CHANGELOG.md](./CHANGELOG.md) for release notes. Releases are tagged on GitHub (e.g., `v0.2.0`).
