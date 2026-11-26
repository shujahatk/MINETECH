import { requireAuth } from '../../../../../../lib/middleware/authGuard.js';
import { supabaseAdmin } from '../../../../../../lib/supabase.js';
import {
  getDocumentByIdAsync,
  getAllDocumentsAsync,
} from '../../../../../../lib/services/documentLibraryService.js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getMimeType(fileName = '', defaultType = 'application/pdf') {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'csv':
      return 'text/csv';
    case 'txt':
      return 'text/plain';
    default:
      return defaultType || 'application/octet-stream';
  }
}

/**
 * Retrieve local static document buffer if explicitly requested by exact name
 */
function getLocalCollateralBuffer(name = '') {
  try {
    const publicDocDir = path.join(process.cwd(), 'public', 'documents');
    if (!fs.existsSync(publicDocDir)) return null;

    const lower = (name || '').toLowerCase();
    // Do NOT match synthetic IDs or custom uploaded documents
    if (lower.startsWith('custom-') || lower.startsWith('camp-att-')) {
      return null;
    }

    let targetFile = null;
    if (lower === 'minetech_bleaching_clay.pdf' || lower === 'minetech_bleaching_clay') {
      targetFile = 'MineTech_Bleaching_Clay.pdf';
    } else if (lower === 'minetech_corporate_brochure_2026.pdf' || lower === 'minetech_corporate_brochure_2026') {
      targetFile = 'MineTech_Corporate_Brochure_2026.pdf';
    } else if (lower === 'minetech_bentonite.pdf' || lower === 'minetech_bentonite' || lower === 'minetech_bentonite_product_profiles.pdf') {
      targetFile = 'MineTech_Bentonite.pdf';
    } else if (lower === 'minetech_activated_bleaching_earth_tds.pdf') {
      targetFile = 'MineTech_Activated_Bleaching_Earth_TDS.pdf';
    }

    if (targetFile) {
      const fullPath = path.join(publicDocDir, targetFile);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath);
      }
    }

    // Direct filename match if it exists
    const directPath = path.join(publicDocDir, name);
    if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
      return fs.readFileSync(directPath);
    }
  } catch (e) {
    console.warn('[preview] local collateral read error:', e.message);
  }
  return null;
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get('id') || '';
    const rawFileName = searchParams.get('fileName') || searchParams.get('name') || '';
    const id = decodeURIComponent(rawId).trim();
    const queryFileName = decodeURIComponent(rawFileName).trim();
    const isDownload = searchParams.get('download') === '1';

    if (!id && !queryFileName) {
      return new Response('Document ID or filename is required', { status: 400 });
    }

    const cleanId = (id || queryFileName).toLowerCase();
    const cleanFileName = (queryFileName || id).toLowerCase();
    let buffer = null;
    let resolvedFileName = queryFileName || id || 'document.pdf';
    if (!resolvedFileName.includes('.')) resolvedFileName += '.pdf';

    let doc = null;

    // 1. Direct lookup in workspace_settings custom documents (where uploaded docs live)
    try {
      const { data: sRows } = await supabaseAdmin
        .from('email_campaigns')
        .select('id, stats')
        .order('created_at', { ascending: false })
        .limit(10);

      const settingsRow = (sRows || []).find(
        (r) => r.stats?.is_workspace_settings === true || r.stats?.is_workspace_settings === 'true'
      );

      if (settingsRow && Array.isArray(settingsRow.stats?.custom_documents)) {
        doc = settingsRow.stats.custom_documents.find((d) => {
          if (!d) return false;
          const dId = (d.id || '').toLowerCase();
          const dFile = (d.fileName || '').toLowerCase();
          const dName = (d.name || '').toLowerCase();
          return (
            dId === cleanId ||
            dFile === cleanFileName ||
            dName === cleanFileName ||
            (cleanId.length > 8 && dId.includes(cleanId)) ||
            (dId.length > 8 && cleanId.includes(dId))
          );
        });
      }

      // Also check campaign_attachments in recent campaigns
      if (!doc) {
        for (const row of sRows || []) {
          const campAtts = row.stats?.campaign_attachments || [];
          const found = campAtts.find((a) => {
            if (!a) return false;
            const aId = (a.id || '').toLowerCase();
            const aFile = (a.fileName || '').toLowerCase();
            const aName = (a.name || '').toLowerCase();
            return aId === cleanId || aFile === cleanFileName || aName === cleanFileName;
          });
          if (found) {
            doc = found;
            break;
          }

          if (Array.isArray(row.stats?.drafts)) {
            for (const draft of row.stats.drafts) {
              const matched = (draft.assigned_attachments || []).find((a) => {
                if (!a) return false;
                const aId = (a.id || '').toLowerCase();
                const aFile = (a.fileName || '').toLowerCase();
                const aName = (a.name || '').toLowerCase();
                return aId === cleanId || aFile === cleanFileName || aName === cleanFileName;
              });
              if (matched) {
                doc = matched;
                break;
              }
            }
            if (doc) break;
          }
        }
      }
    } catch (e) {
      console.warn('[preview] workspace_settings lookup warning:', e.message);
    }

    // 2. Lookup in Document Library Service if still not found
    if (!doc && id) {
      try {
        doc = await getDocumentByIdAsync(id);
      } catch (_) {}
    }
    if (!doc) {
      try {
        const allDocs = await getAllDocumentsAsync();
        doc = allDocs.find((d) => {
          if (!d) return false;
          const dId = (d.id || '').toLowerCase();
          const dFile = (d.fileName || '').toLowerCase();
          const dName = (d.name || '').toLowerCase();
          return dId === cleanId || dFile === cleanFileName || dName === cleanFileName;
        });
      } catch (_) {}
    }

    // If doc resolved, use its official fileName
    if (doc) {
      resolvedFileName = doc.fileName || doc.name || resolvedFileName;
    }

    // 3. Priority: Retrieve actual file buffer from Supabase Storage or URL
    let storagePath = doc?.storagePath || '';
    if (!storagePath && doc?.url && doc.url.includes('/email-attachments/')) {
      storagePath = doc.url.split('/email-attachments/')[1];
    }

    // A. Direct Supabase Storage download by storagePath
    if (storagePath) {
      try {
        const { data: blob, error: downloadErr } = await supabaseAdmin.storage
          .from('email-attachments')
          .download(storagePath);

        if (!downloadErr && blob) {
          buffer = Buffer.from(await blob.arrayBuffer());
        }
      } catch (stErr) {
        console.warn('[preview] Supabase download error:', stErr.message);
      }

      // If download failed, try fetching via public URL
      if (!buffer) {
        try {
          const publicUrl = `https://oatkydlnhenemojbaxwx.supabase.co/storage/v1/object/public/email-attachments/${storagePath}`;
          const fetchRes = await fetch(publicUrl);
          if (fetchRes.ok) {
            buffer = Buffer.from(await fetchRes.arrayBuffer());
          }
        } catch (_) {}
      }
    }

    // B. Direct fetch via doc.url if it is an HTTP link
    if (!buffer && doc?.url && doc.url.startsWith('http')) {
      try {
        const fetchRes = await fetch(doc.url);
        if (fetchRes.ok) {
          buffer = Buffer.from(await fetchRes.arrayBuffer());
        }
      } catch (fErr) {
        console.warn('[preview] doc.url fetch warning:', fErr.message);
      }
    }

    // C. Decode base64 data if available on doc
    if (!buffer && doc?.dataBase64) {
      try {
        buffer = Buffer.from(doc.dataBase64, 'base64');
      } catch (_) {}
    }

    // D. Search uploads folder in Supabase Storage by ID timestamp or filename
    if (!buffer && (cleanId.startsWith('custom-') || cleanId.startsWith('camp-att-') || cleanFileName)) {
      try {
        const { data: files } = await supabaseAdmin.storage
          .from('email-attachments')
          .list('uploads', { limit: 100 });

        if (files && files.length > 0) {
          // Extract timestamp digits if present in custom-1795...
          const idDigits = (id.match(/\d{8,}/) || [''])[0];
          const cleanTarget = (doc?.fileName || queryFileName || id).toLowerCase().replace(/[^a-z0-9]/g, '');

          const matchedFile = files.find((f) => {
            if (idDigits && f.name.includes(idDigits)) return true;
            const cleanF = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanTarget && (cleanF.includes(cleanTarget) || cleanTarget.includes(cleanF.replace(/^\d+_/, '')));
          });

          if (matchedFile) {
            const { data: blob } = await supabaseAdmin.storage
              .from('email-attachments')
              .download(`uploads/${matchedFile.name}`);

            if (blob) {
              buffer = Buffer.from(await blob.arrayBuffer());
              resolvedFileName = matchedFile.name.replace(/^\d+_/, '');
            }
          }
        }
      } catch (listErr) {
        console.warn('[preview] storage list fallback warning:', listErr.message);
      }
    }

    // 4. Exact Local Static Collateral check (for standard catalog PDFs)
    if (!buffer) {
      buffer = getLocalCollateralBuffer(cleanFileName) || getLocalCollateralBuffer(cleanId);
    }

    // 5. If still not found and id is an authentic MineTech brochure name, serve fallback collateral
    if (!buffer) {
      if (cleanFileName.includes('bentonite')) {
        buffer = getLocalCollateralBuffer('MineTech_Bentonite.pdf');
      } else if (cleanFileName.includes('clay') || cleanFileName.includes('bleaching')) {
        buffer = getLocalCollateralBuffer('MineTech_Bleaching_Clay.pdf');
      } else if (cleanFileName.includes('brochure') || cleanFileName.includes('corporate')) {
        buffer = getLocalCollateralBuffer('MineTech_Corporate_Brochure_2026.pdf');
      }
    }

    if (!buffer || buffer.length === 0) {
      return new Response('Unable to load document: File not found', { status: 404 });
    }

    const mimeType = getMimeType(resolvedFileName, doc?.fileType || 'application/pdf');
    const disposition = isDownload ? 'attachment' : 'inline';
    const safeAsciiName = resolvedFileName.replace(/[^\w.-]/g, '_');

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `${disposition}; filename="${safeAsciiName}"`,
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[API /api/email/workspace/documents/preview Error]:', err);
    return new Response('Error loading document preview: ' + err.message, { status: 500 });
  }
}
