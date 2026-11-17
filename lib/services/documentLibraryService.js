/**
 * MineTech Document Library Service
 * 
 * Provides a central repository of business documents, technical data sheets (TDS),
 * product specifications, brochures, certificates, and quotation templates.
 * 
 * Connects directly to the Email Workspace, Email Editor, and CRM.
 */

export const PRECONFIGURED_DOCUMENTS = [
  {
    id: 'doc-brochure-minetech',
    name: 'MineTech Corporate Brochure & Company Profile',
    fileName: 'MineTech_Corporate_Brochure_2026.pdf',
    category: 'Corporate',
    description: 'Comprehensive overview of MineTech Resources BV trading operations, warehousing, logistics, and mineral portfolio.',
    fileSize: '2.4 MB',
    fileType: 'application/pdf',
    relevantProducts: ['all', 'General Industrial Minerals'],
    url: '/documents/MineTech_Corporate_Brochure_2026.pdf',
    isDefault: true,
  },
  {
    id: 'doc-bentonite-profiles',
    name: 'Bentonite Product Profiles & Technical Specifications',
    fileName: 'MineTech_Bentonite_Product_Profiles.pdf',
    category: 'Product Specifications',
    description: 'Technical data sheets covering Sodium and Calcium Bentonite grades for foundry, drilling, pelletizing, and civil works.',
    fileSize: '1.8 MB',
    fileType: 'application/pdf',
    relevantProducts: ['bentonite', 'Bentonite', 'Industrial Clays & Binders'],
    url: '/documents/MineTech_Bentonite_Product_Profiles.pdf',
  },
  {
    id: 'doc-bleaching-clay-specs',
    name: 'Activated Bleaching Earth (Clay) Technical Specifications',
    fileName: 'MineTech_Activated_Bleaching_Earth_TDS.pdf',
    category: 'Product Specifications',
    description: 'Detailed specifications for acid-activated montmorillonite bleaching clay for edible oil, palm oil, and biodiesel refining.',
    fileSize: '1.5 MB',
    fileType: 'application/pdf',
    relevantProducts: ['bleaching_clay', 'Bleaching Clay', 'Industrial Absorbents & Refining Clays'],
    url: '/documents/MineTech_Activated_Bleaching_Earth_TDS.pdf',
  },
  {
    id: 'doc-kaolin-tds',
    name: 'Kaolin Minerals Technical Data Sheet & Analysis',
    fileName: 'MineTech_Kaolin_TDS_Ceramics_Paper.pdf',
    category: 'Technical Data Sheets',
    description: 'Hydrous and calcined kaolin chemical assay, brightness (ISO 88+), particle size distribution, and ceramic parameters.',
    fileSize: '1.6 MB',
    fileType: 'application/pdf',
    relevantProducts: ['kaolin', 'Kaolin', 'Refractory & Ceramic Raw Materials'],
    url: '/documents/MineTech_Kaolin_TDS_Ceramics_Paper.pdf',
  },
  {
    id: 'doc-fire-clay-refractory',
    name: 'Fire Clay & Ball Clay Ceramic Raw Materials Profile',
    fileName: 'MineTech_Fire_Clay_Ball_Clay_Profile.pdf',
    category: 'Product Specifications',
    description: 'Refractoriness under load, plasticity index, thermal expansion, and firing characteristics for refractory and sanitaryware manufacturing.',
    fileSize: '1.4 MB',
    fileType: 'application/pdf',
    relevantProducts: ['fire_clay', 'ball_clay', 'Fire Clay', 'Ball Clay'],
    url: '/documents/MineTech_Fire_Clay_Ball_Clay_Profile.pdf',
  },
  {
    id: 'doc-perlite-zeolite',
    name: 'Expanded Perlite & Natural Zeolite Technical Overview',
    fileName: 'MineTech_Perlite_Zeolite_Technical_Overview.pdf',
    category: 'Product Specifications',
    description: 'Cation exchange capacity (CEC), thermal insulation values, bulk density, and filtration grades for Perlite and Zeolite.',
    fileSize: '1.7 MB',
    fileType: 'application/pdf',
    relevantProducts: ['zeolite', 'perlite', 'Zeolite', 'Perlite'],
    url: '/documents/MineTech_Perlite_Zeolite_Technical_Overview.pdf',
  },
  {
    id: 'doc-coa-template',
    name: 'MineTech Certificate of Analysis (COA) Sample',
    fileName: 'MineTech_Certificate_of_Analysis_Sample.pdf',
    category: 'Certificates',
    description: 'Official Certificate of Analysis demonstrating laboratory testing standards, moisture, mesh sizing, and chemical purity.',
    fileSize: '950 KB',
    fileType: 'application/pdf',
    relevantProducts: ['all'],
    url: '/documents/MineTech_Certificate_of_Analysis_Sample.pdf',
  },
  {
    id: 'doc-quotation-terms',
    name: 'Standard Commercial Terms & CIF Delivery Schedule',
    fileName: 'MineTech_Commercial_Terms_CIF_FOB.pdf',
    category: 'Commercial',
    description: 'Incoterms 2020 definitions (CIF, FOB, CFR, DDP), packaging options (Big Bags 1000kg, 25kg paper sacks), and payment terms.',
    fileSize: '820 KB',
    fileType: 'application/pdf',
    relevantProducts: ['all'],
    url: '/documents/MineTech_Commercial_Terms_CIF_FOB.pdf',
  },
];

/**
 * Generate a clean standard PDF document buffer for preconfigured attachments
 */
function createPdfBase64(title, details) {
  const safeTitle = (title || 'MineTech Resources').replace(/[()]/g, '');
  const safeDetails = (details || 'Industrial Minerals & Commercial Specifications').replace(/[()]/g, '').slice(0, 100);

  const streamContent = `BT\n/F1 16 Tf\n50 720 Td\n(${safeTitle}) Tj\n/F1 11 Tf\n0 -28 Td\n(MineTech Resources BV - Mineral Trading, Logistics & Sourcing) Tj\n0 -22 Td\n(${safeDetails}) Tj\nET`;
  const streamLength = Buffer.byteLength(streamContent);

  const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000240 00000 n \n0000000380 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n450\n%%EOF`;

  return Buffer.from(content).toString('base64');
}

PRECONFIGURED_DOCUMENTS.forEach((doc) => {
  if (!doc.dataBase64) {
    doc.dataBase64 = createPdfBase64(doc.name, doc.description);
  }
});

let customDocuments = [];

/**
 * Get all available documents in the document library
 */
export function getAllDocuments() {
  return [...PRECONFIGURED_DOCUMENTS, ...customDocuments];
}

/**
 * Add a custom uploaded document to the library
 */
export function addCustomDocument(doc) {
  const newDoc = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: doc.name || 'Custom Attachment',
    fileName: doc.fileName || doc.name,
    category: doc.category || 'Custom Attachments',
    description: doc.description || 'Uploaded document',
    fileSize: doc.fileSize || '1.0 MB',
    fileType: doc.fileType || 'application/pdf',
    url: doc.url || '',
    dataBase64: doc.dataBase64 || null,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };
  customDocuments.push(newDoc);
  return newDoc;
}

/**
 * Recommend relevant documents based on company products or email content
 */
export function recommendDocumentsForLead(lead = {}, emailContent = '') {
  const textCorpus = `${lead.company || ''} ${lead.industry || ''} ${lead.notes || ''} ${JSON.stringify(lead.custom_fields || {})} ${emailContent}`.toLowerCase();
  const allDocs = getAllDocuments();

  const recommended = [];
  const addedIds = new Set();

  // Check product relevance
  for (const doc of allDocs) {
    if (addedIds.has(doc.id)) continue;

    let isMatch = false;
    for (const prod of doc.relevantProducts || []) {
      if (prod === 'all') continue;
      const cleanProd = prod.toLowerCase().replace(/_/g, ' ');
      if (textCorpus.includes(cleanProd)) {
        isMatch = true;
        break;
      }
    }

    if (isMatch) {
      recommended.push({
        ...doc,
        matchReason: `Matches mineral topic in company/email context`,
      });
      addedIds.add(doc.id);
    }
  }

  // Always suggest the Corporate Brochure if nothing matched or as default
  if (!addedIds.has('doc-brochure-minetech')) {
    const brochure = allDocs.find((d) => d.id === 'doc-brochure-minetech');
    if (brochure) {
      recommended.unshift({
        ...brochure,
        matchReason: 'General company introduction profile',
      });
    }
  }

  return recommended;
}
