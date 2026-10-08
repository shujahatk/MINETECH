// Default MineTech Product Catalog & Industry/Application Taxonomy
export const DEFAULT_PRODUCT_CATEGORIES = [
  {
    id: 'bentonite',
    name: 'Bentonite',
    grades: [
      'Drilling Grade (API 13A)',
      'Foundry Bonding Grade',
      'Civil Engineering / Piling',
      'Pet Litter Premium Sodium',
      'Animal Feed Binder',
      'Wastewater Treatment Bentonite',
    ],
  },
  {
    id: 'bleaching-earth',
    name: 'Bleaching Earth / Bleaching Clay',
    grades: [
      'PB1000 – Acid Activated Bleaching Earth',
      'PB1000FF – Acid Activated Bleaching Earth / Fast Filtration',
      'PB2000 – Thermal Activated Natural Bleaching Earth',
      'Standard Activated Bleaching Clay',
    ],
  },
  {
    id: 'kaolin',
    name: 'Kaolin',
    grades: [
      'Perfocoat – Calcined Kaolin, Mullite form',
      'Perfometa – Calcined Kaolin, Metakaolin',
      'PerfoHydra-80 – Hydrous / Levigated Kaolin',
      'Paper Coating Ultra-Fine Kaolin',
      'Cosmetic & Pharmaceutical Kaolin',
      'Ceramic Casting Kaolin',
    ],
  },
  {
    id: 'ball-clay',
    name: 'Ball Clay',
    grades: [
      'BC-80 Premium Plasticity',
      'Standard Ceramic Ball Clay',
      'Sanitaryware Refined Ball Clay',
    ],
  },
  {
    id: 'fire-clay',
    name: 'Fire Clay / Chamotte',
    grades: [
      'MTR-42 High Alumina Refractory Clay',
      'Calcined Chamotte (40-45% Al2O3)',
      'Plastic Refractory Fireclay',
    ],
  },
  {
    id: 'zeolite',
    name: 'Zeolite',
    grades: [
      'Natural Clinoptilolite (0.5-1.5mm)',
      'Natural Clinoptilolite Micronized Powder',
      'Synthetic 4A Molecular Sieve',
    ],
  },
  {
    id: 'bauxite',
    name: 'Bauxite',
    grades: [
      'Refractory Grade Calcined Bauxite (85% Al2O3)',
      'Metallurgical Grade Bauxite',
      'Abrasive Grade Bauxite',
    ],
  },
  {
    id: 'calcium-carbonate',
    name: 'Calcium Carbonate',
    grades: [
      'Ground GCC Superfine (2 Micron)',
      'Precipitated PCC Ultra-Bright',
      'Stearic Acid Coated Micro-Cal',
    ],
  },
  {
    id: 'other',
    name: 'Other Minerals',
    grades: ['Custom Specification / Blend'],
  },
];

export const DEFAULT_INDUSTRIES = [
  {
    id: 'ceramics',
    name: 'Ceramics',
    applications: [
      'Sanitaryware',
      'Tiles',
      'Porcelain',
      'Tableware',
      'Engobes',
      'Glazes',
      'Ceramic Colours',
      'Refractories',
    ],
  },
  {
    id: 'edible-oils',
    name: 'Edible Oils / Oil Refining',
    applications: [
      'Edible Oil Refining',
      'Palm Oil Bleaching',
      'Vegetable Oils (Soybean, Rapeseed, Sunflower)',
      'Animal Fats & Tallow',
      'Industrial / Used Cooking Oils',
      'Biodiesel Pre-treatment',
      'Oil Clarification & Decolorization',
    ],
  },
  {
    id: 'paints-coatings',
    name: 'Paints & Coatings',
    applications: ['Architectural Coatings', 'Industrial Primers', 'Emulsion Paints', 'Extender Pigments'],
  },
  {
    id: 'paper',
    name: 'Paper',
    applications: ['Paper Filling', 'Paper Coating', 'Board / Packaging'],
  },
  {
    id: 'construction',
    name: 'Construction',
    applications: ['Ready-mix Concrete Additive', 'Mortars & Grouts', 'Plasterboards', 'Drilling Muds'],
  },
  {
    id: 'drilling-tunnelling',
    name: 'Drilling / Tunnelling',
    applications: ['Horizontal Directional Drilling (HDD)', 'Oil & Gas Drilling', 'TBM Tunnelling Slurry', 'Diaphragm Walls'],
  },
  {
    id: 'foundry',
    name: 'Foundry / Metal Casting',
    applications: ['Green Sand Moulding', 'Core Binding', 'Lost Foam Coatings'],
  },
  {
    id: 'animal-feed',
    name: 'Animal Feed',
    applications: ['Toxin Binder (Mycotoxins)', 'Pelleting Aid', 'Feed Nutrition Carrier'],
  },
  {
    id: 'wastewater-environmental',
    name: 'Wastewater Treatment & Environmental',
    applications: ['Heavy Metal Removal', 'Effluent Clarification', 'Landfill Clay Liners (GCL)', 'Odor Control'],
  },
  {
    id: 'other-industry',
    name: 'Other',
    applications: ['General Industrial Manufacturing', 'Chemical Processing', 'Rubber & Plastics Compounding'],
  },
];

export const INCOTERMS_OPTIONS = ['FOB', 'CIF', 'CFR', 'DAP', 'DDP', 'EXW', 'FCA', 'CIP'];

export const PACKAGING_OPTIONS = [
  '1,000 kg Big Bags (Jumbo with PE liner)',
  '1,000 kg Big Bags (Without liner)',
  '25 kg Multi-ply Paper Bags (Shrink-wrapped Pallets)',
  '50 kg Woven PP Bags',
  'Bulk Silo Tanker (Road Truck)',
  'Bulk Vessel / Breakbulk Hold',
  'Custom Packaging Request',
];

export const COMPANY_TYPE_OPTIONS = [
  'Manufacturer',
  'Distributor',
  'Trader',
  'Importer',
  'Processor',
  'End User',
  'Refinery / Plant',
  'Other',
];

export const LEAD_SOURCE_OPTIONS = [
  'Cold Email',
  'Cold Call',
  'LinkedIn',
  'Website Inbound',
  'Referral',
  'Existing Relationship',
  'Trade Show',
  'Partner / Agent',
  'Distributor',
  'Direct Inquiry',
  'Other',
];

export const KNOWN_TRADE_SHOWS = [
  'Ceramitec 2026',
  'Intrafood 2026',
  'Oils+Fats 2026',
  'European Coatings Show 2026',
  'GIFA Foundry 2026',
  'Mining World 2026',
  'Other Event',
];

export const OPPORTUNITY_STATUS_OPTIONS = [
  { id: 'ACTIVE', label: 'Active (In Sales Pipeline)' },
  { id: 'ON_HOLD', label: 'On Hold (Deal on Pause / Preserved)' },
  { id: 'LOST', label: 'Lost (Closed Unconverted)' },
  { id: 'WON_RECURRING', label: 'Won / Recurring (Commercial Account)' },
];

export const SAMPLE_TECHNICAL_STATUSES = [
  'Requirements Not Yet Received',
  'Requirements Received',
  'TDS Requested',
  'TDS Sent',
  'Sample Not Required',
  'Sample Requested',
  'Sample Preparing',
  'Sample Sent',
  'Sample Delivered',
  'Sample Under Evaluation',
  'Additional Information Requested',
  'Sample Approved',
  'Sample Rejected',
];

export const TRIAL_STATUSES = [
  'Trial Discussed',
  'Quotation Sent',
  'Trial Confirmed',
  'Purchase Order Received',
  'Production / Preparation',
  'Shipped',
  'Delivered',
  'Trial Under Evaluation',
  'Trial Approved',
  'Trial Rejected',
];

export const NEXT_ACTION_PRESETS = [
  'Call Prospect',
  'Send Follow-up Email',
  'Send Technical Data Sheet (TDS)',
  'Send Mineral Sample Load',
  'Confirm Sample Delivery',
  'Check Lab Testing & Assay Result',
  'Send Commercial Quotation',
  'Follow Up Commercial Quotation',
  'Discuss Trial Load & Logistics',
  'Check Trial Production Result',
  'Request Purchase Order (PO)',
  'Schedule Technical / Commercial Meeting',
  'Prepare Contract / Agreement',
  'Review Recurring Order Schedule',
];

export const OPPORTUNITY_PRIORITIES = [
  { id: 'HOT', label: '🔥 Hot Priority' },
  { id: 'WARM', label: '⚡ Warm Opportunity' },
  { id: 'COLD', label: '❄️ Cold' },
  { id: 'STRATEGIC', label: '⭐ Strategic Account' },
  { id: 'HIGH_VOLUME', label: '🚢 High Volume Opportunity' },
];

export const CONTACT_DEPARTMENTS = [
  'Purchasing / Procurement',
  'Technical / R&D',
  'Production / Plant Management',
  'Quality Control / Lab',
  'Commercial / Executive Management',
  'Logistics / Supply Chain',
  'General Management',
  'Other',
];

export const DECISION_MAKER_ROLES = [
  'Decision Maker',
  'Technical Evaluator',
  'Purchasing Contact',
  'Influencer',
  'Gatekeeper',
  'Internal Champion',
  'Unknown',
];

// In-memory or database cached custom catalog store
let customCatalogCache = null;

export async function getCustomCatalog() {
  if (customCatalogCache) return customCatalogCache;
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('details')
      .eq('action', 'CATALOG_CONFIGURATION')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.details?.catalog) {
      customCatalogCache = data.details.catalog;
      return customCatalogCache;
    }
  } catch (err) {
    // If not found, fallback to defaults
  }

  return {
    categories: DEFAULT_PRODUCT_CATEGORIES,
    industries: DEFAULT_INDUSTRIES,
    incoterms: INCOTERMS_OPTIONS,
    packaging: PACKAGING_OPTIONS,
    companyTypes: COMPANY_TYPE_OPTIONS,
    leadSources: LEAD_SOURCE_OPTIONS,
    tradeShows: KNOWN_TRADE_SHOWS,
    sampleStatuses: SAMPLE_TECHNICAL_STATUSES,
    trialStatuses: TRIAL_STATUSES,
    nextActions: NEXT_ACTION_PRESETS,
  };
}

export async function saveCustomCatalog(catalogData, userId = 'system') {
  customCatalogCache = catalogData;
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action: 'CATALOG_CONFIGURATION',
      user_id: userId,
      details: {
        catalog: catalogData,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error saving custom catalog to DB:', err);
  }
  return customCatalogCache;
}
