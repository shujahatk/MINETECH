/**
 * MineTech Product Taxonomy Service
 * 
 * Manages industrial minerals and chemical product categories for B2B trading & sourcing.
 * Supports:
 * - Bleaching Clay
 * - Bentonite
 * - Kaolin
 * - Fire Clay
 * - Ball Clay
 * - Extensible custom categories added at runtime or via settings.
 */

export const INITIAL_PRODUCTS = [
  {
    id: 'bleaching_clay',
    name: 'Bleaching Clay',
    aliases: ['bleaching earth', 'activated bleaching earth', 'bentonite bleaching clay', 'fullers earth', 'acid activated clay', 'bleaching', 'edible oil', 'oil bleaching'],
    category: 'Industrial Absorbents & Refining Clays',
    description: 'High-activity acid-activated montmorillonite clay used primarily for bleaching, refining, and decoloring animal, vegetable, and mineral oils.',
    buyerApplications: [
      'edible oil refining',
      'edible oil',
      'palm oil processing',
      'palm oil',
      'sunflower oil refining',
      'soybean oil refining',
      'canola oil bleaching',
      'tallow refining',
      'biodiesel purification',
      'lubricant re-refining',
      'wax bleaching'
    ],
    supplierKeywords: [
      'clay mining',
      'bentonite processing',
      'acid activation plant',
      'bleaching earth producer',
      'montmorillonite miner',
      'activated clay exporter'
    ]
  },
  {
    id: 'bentonite',
    name: 'Bentonite',
    aliases: ['sodium bentonite', 'calcium bentonite', 'montmorillonite', 'drilling bentonite', 'foundry bentonite'],
    category: 'Industrial Clays & Binders',
    description: 'Absorbent aluminium phyllosilicate clay consisting mostly of montmorillonite, used in drilling, foundry casting, pelletizing, and civil construction.',
    buyerApplications: [
      'oil and gas drilling',
      'foundry sand binding',
      'iron ore pelletizing',
      'civil engineering & diaphragm walls',
      'cat litter manufacturing',
      'environmental sealing & geosynthetics',
      'wine & beverage clarification',
      'feed additive'
    ],
    supplierKeywords: [
      'bentonite mine',
      'bentonite quarry',
      'bentonite exporter',
      'bentonite processing facility',
      'montmorillonite clay deposit'
    ]
  },
  {
    id: 'kaolin',
    name: 'Kaolin',
    aliases: ['china clay', 'hydrous kaolin', 'calcined kaolin', 'kaolinite', 'washed kaolin'],
    category: 'Fine Ceramic & Industrial Clays',
    description: 'Layered silicate mineral (kaolinite) widely utilized in ceramics, paper coating, paint, rubber, plastics, and refractory goods.',
    buyerApplications: [
      'ceramic tableware',
      'sanitaryware manufacturing',
      'paper coating & filler',
      'paints & architectural coatings',
      'rubber compounding',
      'fiberglass manufacturing',
      'cosmetics & pharmaceuticals',
      'porcelain tiles'
    ],
    supplierKeywords: [
      'kaolin mine',
      'china clay washery',
      'calcined kaolin plant',
      'kaolinite deposit',
      'kaolin exporter'
    ]
  },
  {
    id: 'fire_clay',
    name: 'Fire Clay',
    aliases: ['refractory clay', 'flint clay', 'fireclay', 'refractory fire clay', 'grog'],
    category: 'Refractory Minerals',
    description: 'High-temperature refractory clay containing alumina and silica, capable of resisting temperatures up to 1600°C+ without fusing.',
    buyerApplications: [
      'refractory brick manufacturing',
      'furnace linings',
      'kiln construction',
      'steel foundry refractories',
      'glass furnace pots',
      'fireplaces & chimney liners',
      'thermal insulation blocks'
    ],
    supplierKeywords: [
      'fire clay deposit',
      'refractory clay mine',
      'calcined flint clay producer',
      'fireclay exporter'
    ]
  },
  {
    id: 'ball_clay',
    name: 'Ball Clay',
    aliases: ['plastic clay', 'secondary clay', 'ceramic ball clay'],
    category: 'Ceramic Clays & Plasticizers',
    description: 'Extremely plastic sedimentary clay with high dry strength, vital for ceramic bodies, vitreous china, and sanitaryware casting.',
    buyerApplications: [
      'vitreous china sanitaryware',
      'ceramic wall & floor tiles',
      'fine tableware',
      'electrical porcelain insulators',
      'refractory mortars',
      'glazes and engobes'
    ],
    supplierKeywords: [
      'ball clay quarry',
      'ball clay pit',
      'ball clay processing & blending',
      'ball clay exporter'
    ]
  }
];

// In-memory runtime storage for extended custom products
let customProducts = [];

/**
 * Get all available products (initial + custom)
 */
export function getAllProducts() {
  return [...INITIAL_PRODUCTS, ...customProducts];
}

/**
 * Find product by ID or Name
 */
export function findProduct(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).toLowerCase().trim().replace(/[\s_-]+/g, '_');
  const all = getAllProducts();
  return all.find((p) => {
    if (p.id.toLowerCase() === clean) return true;
    if (p.name.toLowerCase() === identifier.toLowerCase().trim()) return true;
    if (p.aliases && p.aliases.some((a) => a.toLowerCase() === identifier.toLowerCase().trim())) return true;
    return false;
  }) || null;
}

/**
 * Register a new custom product category
 */
export function registerProduct({ id, name, category = 'Custom Minerals', description = '', aliases = [], buyerApplications = [], supplierKeywords = [] }) {
  if (!name) throw new Error('Product name is required');
  const generatedId = id || name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  
  const existing = findProduct(generatedId);
  if (existing) {
    return existing;
  }

  const newProd = {
    id: generatedId,
    name,
    category,
    description,
    aliases,
    buyerApplications,
    supplierKeywords
  };

  customProducts.push(newProd);
  return newProd;
}

/**
 * Intelligent keyword detection of relevant products in text (company name, description, website, or email copy)
 */
export function detectProductsInText(text = '') {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const all = getAllProducts();
  const detected = [];

  for (const prod of all) {
    let score = 0;
    const reasons = [];

    // Check primary name
    if (lower.includes(prod.name.toLowerCase())) {
      score += 10;
      reasons.push(`Direct match for "${prod.name}"`);
    }

    // Check aliases
    for (const alias of prod.aliases || []) {
      if (lower.includes(alias.toLowerCase())) {
        score += 8;
        reasons.push(`Matched alias "${alias}"`);
      }
    }

    // Check buyer applications
    for (const app of prod.buyerApplications || []) {
      if (lower.includes(app.toLowerCase())) {
        score += 5;
        reasons.push(`Matched buyer application "${app}"`);
      }
    }

    // Check supplier keywords
    for (const kw of prod.supplierKeywords || []) {
      if (lower.includes(kw.toLowerCase())) {
        score += 5;
        reasons.push(`Matched supplier keyword "${kw}"`);
      }
    }

    if (score > 0) {
      detected.push({
        product: prod,
        score,
        reasons
      });
    }
  }

  // Sort descending by score
  detected.sort((a, b) => b.score - a.score);
  return detected;
}
