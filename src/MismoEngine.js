import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Internal list of structural blocks that MUST always be arrays in MISMO 3.4.
// These are the repeatable collection containers from the MISMO logical data
// model (verified against the bundled UCD v2.0 test files) — forcing them into
// arrays eliminates the classic XML-to-JSON defect where a single instance
// parses as an object instead of a one-element list.
const MISMO_ARRAY_CONTAINERS = [
  // Top-level structural collections
  'DEAL_SET', 'DOCUMENT_SET', 'DEAL', 'DOCUMENT', 'EXECUTION',
  // Deal-level collections
  'LOAN', 'PARTY', 'PROPERTY', 'COLLATERAL', 'ROLE', 'RELATIONSHIP',
  'TAX_IDENTIFIER', 'AMORTIZATION_RULE', 'LIABILITY', 'CONTACT_POINT',
  // UCD / ULDD repeatable blocks
  'LOAN_IDENTIFIER', 'PARTY_ROLE_IDENTIFIER', 'ADDRESS', 'NAME',
  'INDIVIDUAL', 'LEGAL_ENTITY', 'LICENSE', 'REAL_ESTATE_AGENT',
  'FEE', 'FEE_PAYMENT', 'FEE_PAID_TO', 'CASH_TO_CLOSE_ITEM',
  'PREPAID_ITEM', 'PREPAID_ITEM_PAYMENT', 'PREPAID_ITEM_PAID_TO',
  'ESCROW_ITEM', 'ESCROW_ITEM_PAYMENT', 'CLOSING_ADJUSTMENT_ITEM',
  'INTEGRATED_DISCLOSURE_SECTION_SUMMARY',
  'INTEGRATED_DISCLOSURE_SUBSECTION_PAYMENT',
  'ESTIMATED_PROPERTY_COST_COMPONENT', 'PRORATION_ITEM',
  'CONTACT_POINT_TELEPHONE', 'CONTACT_POINT_EMAIL',
  'VIEW', 'VIEW_FILE', 'EXEMPTION'
];

export class MismoEngine {
  constructor(options = {}) {
    console.log('[mismo.js] Initializing MismoEngine...');
    
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      // Keep every value as a string. MISMO payloads carry money amounts
      // ("240000.00"), rates ("9.0000"), and identifiers ("000123") that would
      // be silently corrupted by JS number coercion ("240000", "9", "123").
      parseTagValue: false,
      parseAttributeValue: false,
      // Target MISMO collections explicitly to ensure predictable array shapes
      isArray: (tagName) => MISMO_ARRAY_CONTAINERS.includes(tagName)
    });
    
    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: options.prettyPrint ?? true,
      suppressEmptyNode: true
    });

    // Holds our indexed xlink mapping for high-level queries
    this.registry = [];
  }

  /**
   * Transforms raw MISMO 3.4 XML into a predictable JS object.
   */
  parse(xmlString) {
    console.log(`[mismo.js] Parsing MISMO payload (Length: ${xmlString.length} chars)`);
    
    const rawJson = this.parser.parse(xmlString);
    
    if (!rawJson.MESSAGE) {
      console.error('[mismo.js] Parse Error: Root <MESSAGE> node is missing. Invalid MISMO format.');
      throw new Error("Malformed payload: Missing root <MESSAGE> node.");
    }
    
    return this._normalizePayload(rawJson);
  }

  /**
   * Serializes a structured data object back into valid MISMO 3.4 XML.
   */
  compose(dataObject) {
    console.log('[mismo.js] Composing JSON object back to MISMO XML...');
    
    const hasRoot = Boolean(dataObject && dataObject.MESSAGE);
    const source = hasRoot ? dataObject : { MESSAGE: dataObject };
    
    // Inject the standard default mortgage namespace if missing, WITHOUT
    // mutating the caller's object.
    const wrapped = source.MESSAGE['@_xmlns']
      ? source
      : { ...source, MESSAGE: { '@_xmlns': "http://www.mismo.org/residential/2009/schemas", ...source.MESSAGE } };
    
    const built = this.builder.build(wrapped);
    // If the payload carries a parsed XML declaration (a root-level "?xml" node,
    // e.g. from a source file that began with <?xml ...?>), the builder already
    // emits it. Prepending a second declaration would produce non-well-formed
    // XML with two <?xml declarations, so only add one when none is present.
    const result = wrapped['?xml']
      ? built
      : '<?xml version="1.0" encoding="UTF-8"?>\n' + built;
    console.log(`[mismo.js] Compose complete. Generated ${result.length} chars.`);
    return result;
  }

  /**
   * Internal normalization: Traverses and builds the XLink registry.
   */
  _normalizePayload(jsonObj) {
    console.log('[mismo.js] Normalizing payload and indexing XLinks...');
    this.registry = [];
    this._traverseAndIndex(jsonObj);
    console.log(`[mismo.js] Normalization complete. Indexed ${this.registry.length} active relationships.`);
    return jsonObj;
  }

  _traverseAndIndex(node) {
    if (typeof node !== 'object' || node === null) return;
    
    if (Array.isArray(node)) {
        return node.forEach(n => this._traverseAndIndex(n));
    }

    // Phase 3: XLink Cross-Reference extraction
    if (node.RELATIONSHIP && Array.isArray(node.RELATIONSHIP)) {
        node.RELATIONSHIP.forEach(rel => {
            if (rel['@_xlink:from'] && rel['@_xlink:to']) {
                this.registry.push({
                    from: rel['@_xlink:from'],
                    to: rel['@_xlink:to'],
                    arcrole: rel['@_xlink:arcrole'] || 'urn:fdc:mismo.org:2009:residential'
                });
            }
        });
    }

    Object.values(node).forEach(child => this._traverseAndIndex(child));
  }

  /**
   * High-level query function to find connected entity IDs.
   */
  getLinkedEntities(sourceId) {
    console.log(`[mismo.js] Querying linked entities for source: ${sourceId}`);
    return this.registry.filter(rel => rel.from === sourceId).map(rel => rel.to);
  }

  /**
   * Date Sanitization utility (Phase 2)
   * YAGNI 1-liner to convert JS Date to YYYY-MM-DD
   */
  formatMismoDate(date) {
    return date instanceof Date ? date.toISOString().split('T')[0] : date;
  }
}
