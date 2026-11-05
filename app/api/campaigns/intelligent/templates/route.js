import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/middleware/authGuard';
import {
  parseFileToText,
  splitMultiDraftText,
  createAndClassifyTemplate,
  unpackTemplateMetadata
} from '@/lib/services/templateIntelligenceService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { data: templates, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const unpacked = (templates || []).map((t) => {
      const meta = unpackTemplateMetadata(t);
      return {
        ...t,
        ...meta
      };
    });

    return NextResponse.json({ success: true, data: unpacked });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const contentType = request.headers.get('content-type') || '';
    const userId = auth.user?.id || null;

    let draftsToProcess = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const pastedText = formData.get('pastedText') || formData.get('text');

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name || 'uploaded_templates.txt';
        const parsed = await parseFileToText(buffer, fileName, file.type);

        if (parsed?.isTabular && Array.isArray(parsed.rows)) {
          // Tabular rows (CSV/Excel) with Subject/Body columns
          draftsToProcess = parsed.rows.map((r, i) => {
            const subject = r.Subject || r.subject || r.Title || r.title || `Imported Draft ${i + 1}`;
            const body = r.Body || r.body || r.Content || r.content || r.Text || r.text || '';
            const name = r.Name || r.name || subject;
            return {
              name,
              subject,
              body,
              body_plain: body,
              body_html: `<p>${body.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
            };
          }).filter((d) => d.body.trim().length > 0);
        } else {
          // Plain text from TXT, DOCX, PDF, or raw sheet
          const rawText = typeof parsed === 'string' ? parsed : String(parsed);
          draftsToProcess = splitMultiDraftText(rawText);
        }
      } else if (pastedText && typeof pastedText === 'string') {
        draftsToProcess = splitMultiDraftText(pastedText);
      }
    } else {
      // JSON body
      const bodyJson = await request.json();
      if (bodyJson.text || bodyJson.pastedText) {
        draftsToProcess = splitMultiDraftText(bodyJson.text || bodyJson.pastedText);
      } else if (bodyJson.subject && bodyJson.body) {
        draftsToProcess = [{
          name: bodyJson.name || bodyJson.subject,
          subject: bodyJson.subject,
          body: bodyJson.body,
          body_plain: bodyJson.body,
          body_html: bodyJson.bodyHtml || `<p>${bodyJson.body.replace(/\n/g, '<br/>')}</p>`
        }];
      }
    }

    if (draftsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid email drafts or content detected' },
        { status: 400 }
      );
    }

    // Classify and persist each draft
    const savedTemplates = [];
    for (const draft of draftsToProcess) {
      const saved = await createAndClassifyTemplate({
        name: draft.name,
        subject: draft.subject,
        body: draft.body,
        bodyHtml: draft.body_html,
        userId
      });
      savedTemplates.push(saved);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded and AI-classified ${savedTemplates.length} prewritten templates.`,
      data: savedTemplates
    });
  } catch (err) {
    console.error('[API /api/campaigns/intelligent/templates POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

