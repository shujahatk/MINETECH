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

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isDownload = searchParams.get('download') === '1';

    if (!id) {
      return new Response('Document ID is required', { status: 400 });
    }

    // 1. Find document in library
    let doc = await getDocumentByIdAsync(id);
    if (!doc) {
      const allDocs = await getAllDocumentsAsync();
      doc = allDocs.find((d) => d.id === id || d.fileName === id || d.name === id);
    }

    // 2. If not found in library, search active workspace batch drafts
    if (!doc) {
      const { data: batches } = await supabaseAdmin
        .from('email_campaigns')
        .select('stats')
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);

      if (batches && batches.length > 0 && Array.isArray(batches[0].stats?.drafts)) {
        for (const draft of batches[0].stats.drafts) {
          const found = (draft.assigned_attachments || []).find(
            (a) => a.id === id || a.fileName === id || a.name === id
          );
          if (found) {
            doc = found;
            break;
          }
        }
      }
    }

    if (!doc) {
      return new Response('Document not found', { status: 404 });
    }

    const fileName = doc.fileName || doc.name || 'document.pdf';
    const mimeType = getMimeType(fileName, doc.fileType);
    let buffer = null;

    // Strategy A: From Supabase Storage if storagePath exists or url references storage
    let storagePath = doc.storagePath;
    if (!storagePath && doc.url && doc.url.includes('/email-attachments/')) {
      storagePath = doc.url.split('/email-attachments/')[1];
    }

    if (storagePath) {
      try {
        const { data: blob, error: downloadErr } = await supabaseAdmin.storage
          .from('email-attachments')
          .download(storagePath);

        if (!downloadErr && blob) {
          buffer = Buffer.from(await blob.arrayBuffer());
        } else if (downloadErr) {
          console.warn('[preview] Supabase download error:', downloadErr.message);
        }
      } catch (stErr) {
        console.warn('[preview] Supabase storage exception:', stErr.message);
      }
    }

    // Strategy B: If file is in public folder (e.g. /documents/MineTech_Corporate_Brochure_2026.pdf)
    if (!buffer && doc.url && doc.url.startsWith('/documents/')) {
      try {
        const localFilePath = path.join(process.cwd(), 'public', doc.url);
        if (fs.existsSync(localFilePath)) {
          buffer = await fs.promises.readFile(localFilePath);
        }
      } catch (fsErr) {
        console.warn('[preview] Local file read warning:', fsErr.message);
      }
    }

    // Strategy C: From base64 if available (seed collateral)
    if (!buffer && doc.dataBase64) {
      buffer = Buffer.from(doc.dataBase64, 'base64');
    }

    // Strategy D: If external HTTP URL, fetch it server-side
    if (!buffer && doc.url && (doc.url.startsWith('http://') || doc.url.startsWith('https://'))) {
      try {
        const fetchRes = await fetch(doc.url);
        if (fetchRes.ok) {
          buffer = Buffer.from(await fetchRes.arrayBuffer());
        }
      } catch (fErr) {
        console.warn('[preview] URL fetch warning:', fErr.message);
      }
    }

    if (!buffer || buffer.length === 0) {
      return new Response('Unable to retrieve document content from storage', { status: 404 });
    }

    const disposition = isDownload ? 'attachment' : 'inline';
    const safeAsciiName = fileName.replace(/[^\w.-]/g, '_');

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `${disposition}; filename="${safeAsciiName}"`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[API /api/email/workspace/documents/preview Error]:', err);
    return new Response(`Preview error: ${err.message}`, { status: 500 });
  }
}
