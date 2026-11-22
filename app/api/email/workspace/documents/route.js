import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  getAllDocumentsAsync,
  addCustomDocumentAsync,
  renameDocumentAsync,
  deleteDocumentAsync,
  getDocumentByIdAsync,
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
    return NextResponse.json({
      success: true,
      documents,
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

      // 25 MB max provider attachment size limit check
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, message: 'File exceeds maximum attachment limit of 25 MB.' },
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
      docData = await request.json();
    }

    const savedDoc = await addCustomDocumentAsync(docData);
    const documents = await getAllDocumentsAsync();

    return NextResponse.json({
      success: true,
      document: savedDoc,
      documents,
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
