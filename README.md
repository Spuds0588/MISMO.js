# MISMO.js

A lightweight, client-optimized library to read, manipulate, and generate MISMO 3.4 compliant XML files directly in the browser or Node.js. 

Designed for modern mortgage tech (Point-of-Sale portals, digital closing dashboards, etc.), `mismo.js` translates dense MISMO XML payloads into predictable, developer-friendly JavaScript objects in milliseconds.

## Features

- **Bi-directional Processing:** Translate MISMO 3.4 XML to JSON and serialize it back to XML seamlessly.
- **Predictable Schema Arrays:** Automatically enforces known MISMO collection blocks (e.g., `LOAN`, `PARTY`, `PROPERTY`) into arrays, eliminating the classic XML-to-JSON defect where single elements parse as objects instead of lists.
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
To generate the final, minified distribution files (`dist/mismo.js` for ES Modules and `dist/mismo.umd.cjs` for legacy/Node):

```bash
npm run build
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

To make testing easy, this repository includes official industry-standard MISMO XML sample files in the `/test-data` directory. These files are sourced from the Fannie Mae / Freddie Mac Uniform Mortgage Data Program (UMDP).

- **UCD (Uniform Closing Dataset) Samples:** Represents complex, deeply nested MISMO 3.3/3.4 closing disclosure data.
- **ULDD (Uniform Loan Delivery Dataset) Samples:** Represents massive loan delivery payloads.

### How to test with them:
1. Run `npm run dev` to launch the local diagnostic dashboard.
2. Click **"Choose File"** in your browser.
3. Select any `.xml` file from the `/test-data` folder in this repository.
4. View the lightning-fast parsing times and XLink relationship mappings directly in your console and browser UI.

*(Note: If you need the complete, exhaustive test suites for every edge case, you can download the official GSE test zip files directly from the [Fannie Mae UCD Tech Resources page](https://singlefamily.fanniemae.com/delivering/uniform-mortgage-data-program/uniform-closing-dataset).)*
