import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { ingestPersonalizedEmails, extractEmailsHeuristic } from '@/lib/services/personalizedEmailExtractor';
import { matchAllDraftsToCrm } from '@/lib/services/personalizedCompanyMatcher';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const contentType = request.headers.get('content-type') || '';
    let drafts = [];
    let extractionSummary = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { success: false, message: 'Please provide a valid document file (PDF, DOCX, or TXT).' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name || 'uploaded_document.pdf';
      const mimeType = file.type || 'application/pdf';

      const ingestionResult = await ingestPersonalizedEmails(buffer, fileName, mimeType);
      drafts = ingestionResult.drafts;
      extractionSummary = ingestionResult.summary;
    } else {
      // JSON payload with rawText
      const body = await request.json().catch(() => ({}));
      const rawText = body.rawText || body.text || '';

      if (!rawText || rawText.trim().length === 0) {
        return NextResponse.json(
          { success: false, message: 'Document text is empty. Please provide email content.' },
          { status: 400 }
        );
      }

      drafts = extractEmailsHeuristic(rawText);
      extractionSummary = {
        totalIdentified: drafts.length,
        successfullyExtracted: drafts.filter((d) => !d.needs_correction).length,
        requiringManualCorrection: drafts.filter((d) => d.needs_correction).length,
        missingSubjectCount: drafts.filter((d) => !d.subject || d.subject.startsWith('Personalized Outreach #')).length,
        rawTextLength: rawText.length,
      };
    }

    if (!drafts || drafts.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No personalized emails could be identified in the uploaded document.' },
        { status: 400 }
      );
    }

    // Run AI company matching against existing CRM database
    const matchingResult = await matchAllDraftsToCrm(drafts);
    const enrichedDrafts = matchingResult.matchedDrafts;

    // Persist active workspace draft batch in Supabase
    const nowIso = new Date().toISOString();
    const batchId = `batch-${Date.now()}`;
    const workspaceBatch = {
      name: `Email Workspace — Imported ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
      subject: `Personalized Outreach Batch (${enrichedDrafts.length} emails)`,
      body_html: '<p>Personalized Outreach Batch</p>',
      body_plain: 'Personalized Outreach Batch',
      status: 'DRAFT',
      stats: {
        is_personalized_workspace: true,
        batch_id: batchId,
        extraction_summary: extractionSummary,
        matching_summary: matchingResult.summary,
        drafts: enrichedDrafts,
        updated_at: nowIso,
      },
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: savedBatch } = await supabaseAdmin
      .from('email_campaigns')
      .insert(workspaceBatch)
      .select('id, name, created_at')
      .single();

    return NextResponse.json({
      success: true,
      batchId: savedBatch?.id || batchId,
      message: `Successfully extracted and matched ${enrichedDrafts.length} personalized emails.`,
      drafts: enrichedDrafts,
      extractionSummary,
      matchingSummary: matchingResult.summary,
    });
  } catch (err) {
    console.error('[API /api/email/workspace/upload Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to process document upload' },
      { status: 500 }
    );
  }
}
