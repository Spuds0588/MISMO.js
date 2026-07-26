import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Internal list of structural blocks that MUST always be arrays in MISMO 3.4
const MISMO_ARRAY_CONTAINERS = [
  'DEAL', 'LOAN', 'PARTY', 'PROPERTY', 'DOCUMENT', 
  'ROLE', 'TAX_IDENTIFIER', 'AMORTIZATION_RULE',
  'LIABILITY', 'CONTACT_POINT', 'RELATIONSHIP', 'EXECUTION'
];

export class MismoEngine {
  constructor(options = {}) {
    console.log('[mismo.js] Initializing MismoEngine...');
    
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseAttributeValue: true,
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
    
    const wrapped = dataObject.MESSAGE ? dataObject : { MESSAGE: dataObject };
    
    // Inject standard default mortgage namespaces if missing
    if (!wrapped.MESSAGE['@_xmlns']) {
      wrapped.MESSAGE['@_xmlns'] = "http://www.mismo.org/residential/2009/schemas";
    }
    
    const result = '<?xml version="1.0" encoding="UTF-8"?>\n' + this.builder.build(wrapped);
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
