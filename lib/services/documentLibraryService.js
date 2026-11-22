/**
 * MineTech Document Library Service
 * 
 * Provides a central repository of business documents, technical data sheets (TDS),
 * product specifications, brochures, certificates, and quotation templates.
 * 
 * Connected to Supabase for permanent persistence across restarts, refreshes, and logins.
 * Preconfigured documents are initial seed data only — once deleted, they NEVER return.
 */

import { supabaseAdmin } from '../supabase.js';
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from './workspaceSettingsService.js';

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

// In-memory cache synced with Supabase
let inMemoryCustomDocs = [];
let inMemoryDeletedDocIds = new Set();
let inMemoryRenamedDocs = new Map();

/**
 * Sync memory state from Supabase workspace settings
 */
async function syncFromDatabase() {
  try {
    const settings = await getWorkspaceSettings();
    const stats = settings.stats || {};

    if (Array.isArray(stats.deleted_doc_ids)) {
      inMemoryDeletedDocIds = new Set(stats.deleted_doc_ids);
    }
    if (Array.isArray(stats.custom_documents)) {
      inMemoryCustomDocs = stats.custom_documents;
    }
    if (stats.renamed_docs && typeof stats.renamed_docs === 'object') {
      inMemoryRenamedDocs = new Map(Object.entries(stats.renamed_docs));
    }
  } catch (err) {
    console.error('[documentLibraryService] syncFromDatabase error:', err);
  }
}

/**
 * Get all available documents (strictly excluding any deleted doc IDs)
 */
export function getAllDocuments() {
  const baseDocs = PRECONFIGURED_DOCUMENTS.filter((d) => !inMemoryDeletedDocIds.has(d.id)).map((d) => {
    if (inMemoryRenamedDocs.has(d.id)) {
      return { ...d, name: inMemoryRenamedDocs.get(d.id) };
    }
    return d;
  });

  const customDocs = inMemoryCustomDocs.filter((d) => !inMemoryDeletedDocIds.has(d.id)).map((d) => {
    if (inMemoryRenamedDocs.has(d.id)) {
      return { ...d, name: inMemoryRenamedDocs.get(d.id) };
    }
    return d;
  });

  return [...baseDocs, ...customDocs];
}

/**
 * Async getter: loads latest persistent state from Supabase before returning documents
 */
export async function getAllDocumentsAsync() {
  await syncFromDatabase();
  return getAllDocuments();
}

/**
 * Add a custom uploaded document to the library and persist to Supabase
 * Prevents duplicate uploads of the same file.
 */
export async function addCustomDocumentAsync(doc) {
  await syncFromDatabase();

  const safeFileName = doc.fileName || doc.name || 'document.pdf';
  const safeName = (doc.name || safeFileName).replace(/\.[^/.]+$/, '');

  // Check if a document with this filename or name already exists in active documents
  const existingDoc = inMemoryCustomDocs.find(
    (d) => !inMemoryDeletedDocIds.has(d.id) && (d.fileName === safeFileName || d.name === safeName)
  );

  if (existingDoc) {
    // Update existing document in place rather than creating duplicate
    existingDoc.fileSize = doc.fileSize || existingDoc.fileSize;
    existingDoc.description = doc.description || existingDoc.description;
    existingDoc.category = doc.category || existingDoc.category;
    if (doc.dataBase64) existingDoc.dataBase64 = doc.dataBase64;
    existingDoc.updatedAt = new Date().toISOString();

    await updateWorkspaceSettings({
      custom_documents: inMemoryCustomDocs,
    });

    return existingDoc;
  }

  const newDoc = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: safeName,
    fileName: safeFileName,
    category: doc.category || 'Custom Uploads',
    description: doc.description || 'Uploaded document',
    fileSize: doc.fileSize || '1.0 MB',
    fileType: doc.fileType || 'application/pdf',
    url: doc.url || '',
    dataBase64: doc.dataBase64 || null,
    isCustom: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  inMemoryCustomDocs.unshift(newDoc);

  await updateWorkspaceSettings({
    custom_documents: inMemoryCustomDocs,
  });

  return newDoc;
}

export function addCustomDocument(doc) {
  // Synchronous entrypoint that queues async persistence
  const safeFileName = doc.fileName || doc.name || 'document.pdf';
  const safeName = (doc.name || safeFileName).replace(/\.[^/.]+$/, '');

  const newDoc = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: safeName,
    fileName: safeFileName,
    category: doc.category || 'Custom Uploads',
    description: doc.description || 'Uploaded document',
    fileSize: doc.fileSize || '1.0 MB',
    fileType: doc.fileType || 'application/pdf',
    url: doc.url || '',
    dataBase64: doc.dataBase64 || null,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };

  inMemoryCustomDocs.unshift(newDoc);
  addCustomDocumentAsync(doc).catch((e) => console.error('[addCustomDocument] Save error:', e));

  return newDoc;
}

/**
 * Rename a document in the library and persist to Supabase
 */
export async function renameDocumentAsync(id, newName) {
  if (!id || !newName || !newName.trim()) {
    throw new Error('Valid document ID and new name are required');
  }

  await syncFromDatabase();
  const trimmed = newName.trim();
  inMemoryRenamedDocs.set(id, trimmed);

  let targetDoc = null;
  const customIdx = inMemoryCustomDocs.findIndex((d) => d.id === id);
  if (customIdx !== -1) {
    inMemoryCustomDocs[customIdx].name = trimmed;
    targetDoc = inMemoryCustomDocs[customIdx];
  } else {
    const pre = PRECONFIGURED_DOCUMENTS.find((d) => d.id === id);
    if (pre) {
      targetDoc = { ...pre, name: trimmed };
    }
  }

  if (!targetDoc) {
    throw new Error(`Document with ID ${id} not found`);
  }

  const renamedObj = Object.fromEntries(inMemoryRenamedDocs.entries());
  await updateWorkspaceSettings({
    custom_documents: inMemoryCustomDocs,
    renamed_docs: renamedObj,
  });

  // Cascade rename to active workspace batch drafts
  try {
    const { data: batches } = await supabaseAdmin
      .from('email_campaigns')
      .select('id, stats')
      .filter('stats->>is_personalized_workspace', 'eq', 'true')
      .order('created_at', { ascending: false })
      .limit(1);

    if (batches && batches.length > 0 && batches[0].stats?.drafts) {
      const batch = batches[0];
      let changed = false;
      const updatedDrafts = (batch.stats.drafts || []).map((d) => {
        if (Array.isArray(d.assigned_attachments) && d.assigned_attachments.some((a) => a.id === id)) {
          changed = true;
          return {
            ...d,
            assigned_attachments: d.assigned_attachments.map((a) =>
              a.id === id ? { ...a, name: trimmed } : a
            ),
          };
        }
        return d;
      });

      if (changed) {
        await supabaseAdmin
          .from('email_campaigns')
          .update({
            stats: { ...batch.stats, drafts: updatedDrafts },
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch.id);
      }
    }
  } catch (err) {
    console.error('[renameDocumentAsync] Cascade to drafts error:', err);
  }

  return targetDoc;
}

export function renameDocument(id, newName) {
  const trimmed = (newName || '').trim();
  inMemoryRenamedDocs.set(id, trimmed);
  renameDocumentAsync(id, newName).catch((e) => console.error('[renameDocument] Error:', e));

  const found = getAllDocuments().find((d) => d.id === id);
  return found || { id, name: trimmed };
}

/**
 * Delete a document from the library permanently
 * Guarantees that preconfigured or custom documents NEVER return.
 * Cascades to active workspace batch drafts by removing the deleted document.
 */
export async function deleteDocumentAsync(id) {
  if (!id) throw new Error('Document ID is required');

  await syncFromDatabase();
  const docToDelete = inMemoryCustomDocs.find((d) => d.id === id);
  if (docToDelete?.storagePath) {
    try {
      await supabaseAdmin.storage
        .from('email-attachments')
        .remove([docToDelete.storagePath]);
    } catch (e) {
      console.warn('[deleteDocumentAsync] Storage deletion warning:', e.message);
    }
  }

  inMemoryDeletedDocIds.add(id);
  inMemoryCustomDocs = inMemoryCustomDocs.filter((d) => d.id !== id);

  const deletedList = Array.from(inMemoryDeletedDocIds);
  await updateWorkspaceSettings({
    deleted_doc_ids: deletedList,
    custom_documents: inMemoryCustomDocs,
  });

  // Cascade: remove deleted document from all drafts in active workspace batch
  try {
    const { data: batches } = await supabaseAdmin
      .from('email_campaigns')
      .select('id, stats')
      .filter('stats->>is_personalized_workspace', 'eq', 'true')
      .order('created_at', { ascending: false })
      .limit(1);

    if (batches && batches.length > 0 && batches[0].stats?.drafts) {
      const batch = batches[0];
      let draftsChanged = false;
      const updatedDrafts = (batch.stats.drafts || []).map((d) => {
        if (Array.isArray(d.assigned_attachments) && d.assigned_attachments.some((a) => a.id === id)) {
          draftsChanged = true;
          return {
            ...d,
            assigned_attachments: d.assigned_attachments.filter((a) => a.id !== id),
            updated_at: new Date().toISOString(),
          };
        }
        return d;
      });

      if (draftsChanged) {
        await supabaseAdmin
          .from('email_campaigns')
          .update({
            stats: { ...batch.stats, drafts: updatedDrafts },
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch.id);
      }
    }
  } catch (err) {
    console.error('[deleteDocumentAsync] Cascade deletion error:', err);
  }

  return { success: true, id };
}

export function deleteDocument(id) {
  if (!id) throw new Error('Document ID is required');
  inMemoryDeletedDocIds.add(id);
  inMemoryCustomDocs = inMemoryCustomDocs.filter((d) => d.id !== id);
  deleteDocumentAsync(id).catch((e) => console.error('[deleteDocument] Error:', e));
  return { success: true, id };
}

/**
 * Get single document by ID
 */
export function getDocumentById(id) {
  if (!id || inMemoryDeletedDocIds.has(id)) return null;
  return getAllDocuments().find((d) => d.id === id) || null;
}

export async function getDocumentByIdAsync(id) {
  if (!id) return null;
  await syncFromDatabase();
  if (inMemoryDeletedDocIds.has(id)) return null;
  return getAllDocuments().find((d) => d.id === id) || null;
}

/**
 * Recommend relevant documents based on company products or email content
 */
export function recommendDocumentsForLead(lead = {}, emailContent = '') {
  const textCorpus = `${lead.company || ''} ${lead.industry || ''} ${lead.notes || ''} ${JSON.stringify(lead.custom_fields || {})} ${emailContent}`.toLowerCase();
  const allDocs = getAllDocuments();

  const recommended = [];
  const addedIds = new Set();

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

  // Suggest brochure if present in active documents and not already added
  const brochure = allDocs.find((d) => d.id === 'doc-brochure-minetech');
  if (brochure && !addedIds.has('doc-brochure-minetech')) {
    recommended.unshift({
      ...brochure,
      matchReason: 'General company introduction profile',
    });
  }

  return recommended;
}
