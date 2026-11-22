import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getAllDocumentsAsync,
  addCustomDocumentAsync,
  renameDocumentAsync,
  deleteDocumentAsync,
  getDocumentByIdAsync,
  validateAndSanitizeFile,
  restoreDefaultDocumentsAsync,
  recordRecentlyUsedDocAsync,
  getRecentlyUsedDocumentsAsync,
} from '@/lib/services/documentLibraryService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const url = new URL(request.url);
    const docId = url.searchParams.get('id');

    if (docId) {
      const doc = await getDocumentByIdAsync(docId);
      if (!doc) {
        return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, document: doc });
    }

    const documents = await getAllDocumentsAsync();
    const recentlyUsed = await getRecentlyUsedDocumentsAsync();

    // Compute active workspace draft usage for every document
    let activeBatchDrafts = [];
    try {
      const { data: batches } = await supabaseAdmin
        .from('email_campaigns')
        .select('id, stats')
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);

      if (batches && batches.length > 0 && Array.isArray(batches[0].stats?.drafts)) {
        activeBatchDrafts = batches[0].stats.drafts;
      }
    } catch (e) {
      console.warn('[documents GET] Failed to fetch active batch for usage tracking:', e.message);
    }

    const enrichedDocs = documents.map((doc) => {
      const matchingDrafts = activeBatchDrafts.filter(
        (d) =>
          Array.isArray(d.assigned_attachments) &&
          d.assigned_attachments.some(
            (a) => a.id === doc.id || (a.fileName && a.fileName === doc.fileName) || a.name === doc.name
          )
      );

      return {
        ...doc,
        usage: {
          activeDraftsCount: matchingDrafts.length,
          companies: matchingDrafts.map(
            (d) => d.extracted_company || d.matched_lead?.company_name || `Draft #${d.id}`
          ).slice(0, 10),
          totalDrafts: activeBatchDrafts.length,
        },
      };
    });

    return NextResponse.json({
      success: true,
      documents: enrichedDocs,
      recentlyUsed,
    });
  } catch (err) {
    console.error('[API /api/email/workspace/documents GET Error]:', err);
    return NextResponse.json(
      { success: false, message: 'Failed to load document library' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const contentType = request.headers.get('content-type') || '';
    let docData = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const action = formData.get('action');

      if (action === 'restore_defaults') {
        const restored = await restoreDefaultDocumentsAsync();
        return NextResponse.json({
          success: true,
          documents: restored,
          message: 'Default preconfigured collateral restored successfully.',
        });
      }

      const file = formData.get('file');
      const name = formData.get('name') || file?.name || 'Custom Document';
      const category = formData.get('category') || 'Custom Uploads';
      const description = formData.get('description') || '';

      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { success: false, message: 'Please provide a file to upload.' },
          { status: 400 }
        );
      }

      // Phase 5 Security: MIME, Extension, and Size Validation
      try {
        validateAndSanitizeFile(file.name, file.type, file.size);
      } catch (valErr) {
        return NextResponse.json(
          { success: false, message: valErr.message },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64Data = buffer.toString('base64');
      const fileSizeMb = (buffer.length / (1024 * 1024)).toFixed(2) + ' MB';

      // Synchronize file to Supabase Storage bucket 'email-attachments'
      let storageUrl = '';
      let storagePath = '';
      try {
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        storagePath = `uploads/${Date.now()}_${sanitizedFileName}`;
        const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
          .from('email-attachments')
          .upload(storagePath, buffer, {
            contentType: file.type || 'application/pdf',
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          const { data: pubData } = supabaseAdmin.storage
            .from('email-attachments')
            .getPublicUrl(storagePath);
          storageUrl = pubData?.publicUrl || '';
        }
      } catch (storageEx) {
        console.warn('[documents POST] Storage upload warning:', storageEx.message);
      }

      docData = {
        name,
        fileName: file.name,
        fileSize: fileSizeMb,
        fileType: file.type || 'application/pdf',
        category,
        description,
        dataBase64: base64Data,
        url: storageUrl,
        storagePath,
      };
    } else {
      const body = await request.json();
      if (body.action === 'restore_defaults') {
        const restored = await restoreDefaultDocumentsAsync();
        return NextResponse.json({
          success: true,
          documents: restored,
          message: 'Default preconfigured collateral restored successfully.',
        });
      }
      if (body.action === 'record_recent' && body.docId) {
        await recordRecentlyUsedDocAsync(body.docId);
        const recentlyUsed = await getRecentlyUsedDocumentsAsync();
        return NextResponse.json({ success: true, recentlyUsed });
      }
      docData = body;
    }

    const savedDoc = await addCustomDocumentAsync(docData);
    await recordRecentlyUsedDocAsync(savedDoc.id);

    const documents = await getAllDocumentsAsync();
    const recentlyUsed = await getRecentlyUsedDocumentsAsync();

    return NextResponse.json({
      success: true,
      document: savedDoc,
      documents,
      recentlyUsed,
      message: 'Document added to library permanently.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/documents POST Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to save document' },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const { id, name } = body;

    if (!id || !name) {
      return NextResponse.json(
        { success: false, message: 'Document ID and new name are required.' },
        { status: 400 }
      );
    }

    const updatedDoc = await renameDocumentAsync(id, name);
    const documents = await getAllDocumentsAsync();

    return NextResponse.json({
      success: true,
      document: updatedDoc,
      documents,
      message: 'Document renamed successfully.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/documents PATCH Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to rename document' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    let docId = null;
    const url = new URL(request.url);
    docId = url.searchParams.get('id');

    if (!docId) {
      const body = await request.json().catch(() => ({}));
      docId = body.id;
    }

    if (!docId) {
      return NextResponse.json(
        { success: false, message: 'Document ID is required for deletion.' },
        { status: 400 }
      );
    }

    await deleteDocumentAsync(docId);
    const documents = await getAllDocumentsAsync();

    return NextResponse.json({
      success: true,
      deletedId: docId,
      documents,
      message: 'Document permanently removed from document library.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/documents DELETE Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
