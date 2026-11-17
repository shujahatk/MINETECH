import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { getAllDocuments, addCustomDocument } from '@/lib/services/documentLibraryService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const documents = getAllDocuments();
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

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64Data = buffer.toString('base64');
      const fileSizeMb = (buffer.length / (1024 * 1024)).toFixed(2) + ' MB';

      docData = {
        name,
        fileName: file.name,
        fileSize: fileSizeMb,
        fileType: file.type || 'application/pdf',
        category,
        description,
        dataBase64: base64Data,
      };
    } else {
      docData = await request.json();
    }

    const savedDoc = addCustomDocument(docData);

    return NextResponse.json({
      success: true,
      document: savedDoc,
      message: 'Document added to library successfully.',
    });
  } catch (err) {
    console.error('[API /api/email/workspace/documents POST Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to save document' },
      { status: 500 }
    );
  }
}
