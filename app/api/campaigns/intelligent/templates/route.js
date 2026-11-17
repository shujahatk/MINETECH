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

      if (file && typeof file === 'object' && typeof file.arrayBuffer === 'function') {
        if (file.size === 0 && (!pastedText || !String(pastedText).trim())) {
          return NextResponse.json(
            { success: false, error: 'The uploaded file is empty. Please select a non-empty template file.' },
            { status: 400 }
          );
        }

        if (file.size > 0) {
          let parsed;
          try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const fileName = file.name || 'uploaded_templates.txt';
            parsed = await parseFileToText(buffer, fileName, file.type);
          } catch (parseErr) {
            return NextResponse.json(
              { success: false, error: parseErr.message || 'Could not parse the uploaded file.' },
              { status: 400 }
            );
          }

          if (parsed?.isTabular && Array.isArray(parsed.rows)) {
            // Tabular rows (CSV/Excel) with Subject/Body columns
            draftsToProcess.push(
              ...parsed.rows.map((r, i) => {
                const subject = String(r.Subject || r.subject || r.Title || r.title || `Imported Draft ${i + 1}`).trim();
                const body = String(r.Body || r.body || r.Content || r.content || r.Text || r.text || '').trim();
                const name = String(r.Name || r.name || subject).trim();
                return {
                  name,
                  subject,
                  body,
                  body_plain: body,
                  body_html: `<p>${body.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`
                };
              }).filter((d) => d.body.trim().length > 0)
            );
          } else {
            // Plain text from TXT, DOCX, PDF, or raw sheet
            const rawText = (typeof parsed === 'string' ? parsed : String(parsed || '')).trim();
            if (rawText) {
              draftsToProcess.push(...splitMultiDraftText(rawText).filter((d) => (d.body || '').trim().length > 0));
            }
          }
        }
      }

      if (pastedText && typeof pastedText === 'string' && pastedText.trim()) {
        draftsToProcess.push(...splitMultiDraftText(pastedText.trim()).filter((d) => (d.body || '').trim().length > 0));
      }
    } else {
      // JSON body
      const bodyJson = await request.json().catch(() => ({}));
      if (bodyJson.text || bodyJson.pastedText) {
        const raw = String(bodyJson.text || bodyJson.pastedText || '').trim();
        if (raw) {
          draftsToProcess = splitMultiDraftText(raw).filter((d) => (d.body || '').trim().length > 0);
        }
      } else if (bodyJson.subject && (bodyJson.body || bodyJson.bodyPlain || bodyJson.bodyText)) {
        const cleanBody = String(bodyJson.body || bodyJson.bodyPlain || bodyJson.bodyText).trim();
        if (cleanBody) {
          draftsToProcess = [{
            name: String(bodyJson.name || bodyJson.subject).trim(),
            subject: String(bodyJson.subject).trim(),
            body: cleanBody,
            body_plain: cleanBody,
            body_html: bodyJson.bodyHtml || `<p>${cleanBody.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
            category: bodyJson.category || null
          }];
        }
      }
    }

    if (draftsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid email drafts or readable content detected in the upload.' },
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
        category: draft.category || null,
        userId
      });
      savedTemplates.push(saved);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded and classified ${savedTemplates.length} prewritten template${savedTemplates.length === 1 ? '' : 's'} with MineTech AI.`,
      data: savedTemplates
    });
  } catch (err) {
    console.error('[API /api/campaigns/intelligent/templates POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

