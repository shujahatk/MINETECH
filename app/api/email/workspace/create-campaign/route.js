import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware/authGuard';
import { supabaseAdmin } from '@/lib/supabase';
import { createCampaign, launchCampaign } from '@/lib/services/campaignService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/email/workspace/create-campaign
 * 
 * Groups selected personalized emails into a single campaign.
 * Each company retains its OWN individualized email, subject, and attachments.
 */
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const {
      name,
      draftIds,
      batchId,
      autoLaunch = false,
      scheduledAt = null,
      allowUnapproved = false,
    } = body;

    if (!Array.isArray(draftIds) || draftIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Please select at least one personalized email to create a campaign.' },
        { status: 400 }
      );
    }

    // 1. Fetch active workspace batch
    let targetBatch = null;
    if (batchId) {
      const { data } = await supabaseAdmin
        .from('email_campaigns')
        .select('*')
        .eq('id', batchId)
        .single();
      targetBatch = data;
    } else {
      const { data } = await supabaseAdmin
        .from('email_campaigns')
        .select('*')
        .filter('stats->>is_personalized_workspace', 'eq', 'true')
        .order('created_at', { ascending: false })
        .limit(1);
      targetBatch = data && data.length > 0 ? data[0] : null;
    }

    if (!targetBatch || !targetBatch.stats?.drafts) {
      return NextResponse.json(
        { success: false, message: 'No active email workspace found.' },
        { status: 404 }
      );
    }

    const allDrafts = targetBatch.stats.drafts || [];
    const targetIdSet = new Set(draftIds);
    const selectedDrafts = allDrafts.filter((d) => targetIdSet.has(d.id));

    if (selectedDrafts.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid drafts found matching the selected IDs.' },
        { status: 400 }
      );
    }

    // 2. Validate selected drafts
    const validationErrors = [];
    const personalizedRecipients = [];

    for (const draft of selectedDrafts) {
      const companyLabel = draft.extracted_company || draft.matched_lead?.company_name || `Draft #${draft.id}`;

      if (!draft.matched_lead?.id) {
        validationErrors.push(`"${companyLabel}" is not matched to a CRM company. Please match it before adding to campaign.`);
        continue;
      }

      if (!allowUnapproved && draft.approval_status !== 'approved') {
        validationErrors.push(`"${companyLabel}" is not approved yet (Status: ${draft.approval_status}). Please approve or allow unapproved emails.`);
        continue;
      }

      const contacts = Array.isArray(draft.selected_contacts) ? draft.selected_contacts : [];
      const primaryContact = contacts.find((c) => c.is_primary && c.email) || contacts.find((c) => c.email);

      if (!primaryContact || !primaryContact.email) {
        validationErrors.push(`"${companyLabel}" has no contact with a valid email address selected.`);
        continue;
      }

      // Collect any additional contacts as CC
      const additionalCcEmails = contacts
        .filter((c) => c !== primaryContact && c.email)
        .map((c) => c.email.trim());

      const finalCc = Array.from(new Set([...(draft.cc_emails || []), ...additionalCcEmails]));
      const finalBcc = Array.from(new Set(draft.bcc_emails || []));

      personalizedRecipients.push({
        leadId: draft.matched_lead.id,
        companyName: draft.extracted_company || draft.matched_lead.company_name,
        contactName: primaryContact.name || draft.matched_lead.contact_name || 'Contact',
        contactEmail: primaryContact.email.trim().toLowerCase(),
        to: primaryContact.email.trim().toLowerCase(),
        cc: finalCc,
        bcc: finalBcc,
        customSubject: draft.edited_subject || draft.extracted_subject,
        customBodyHtml: draft.edited_body_html || draft.extracted_body_html,
        customBodyPlain: draft.edited_body_plain || draft.extracted_body_plain,
        attachments: draft.assigned_attachments || [],
        signatureHtml: draft.assigned_signature_html || null,
        draftId: draft.id,
        approvalStatus: draft.approval_status || 'needs_review',
      });
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Campaign creation stopped due to validation errors (${validationErrors.length} issues).`,
          errors: validationErrors,
        },
        { status: 400 }
      );
    }

    // 3. Create the campaign strictly as DRAFT
    const campaignName = name?.trim() || `Personalized Outreach — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    const campaignResult = await createCampaign({
      name: campaignName,
      subject: `Personalized Outreach (${personalizedRecipients.length} companies)`,
      bodyHtml: '<p>Personalized B2B Outreach Batch</p>',
      bodyText: 'Personalized B2B Outreach Batch',
      campaignType: 'personalized_batch',
      scheduledAt,
      status: 'DRAFT',
      personalizedRecipients,
    });

    if (!campaignResult || !campaignResult.id) {
      throw new Error('Failed to create campaign record in database.');
    }

    // 4. Update the active workspace batch stats in Supabase
    // Mark only the selected drafts as included in this campaign.
    // Unselected drafts remain saved in the workspace!
    const nowIso = new Date().toISOString();
    const updatedDrafts = allDrafts.map((d) => {
      if (targetIdSet.has(d.id)) {
        return {
          ...d,
          campaign_id: campaignResult.id,
          campaign_name: campaignName,
          campaign_created_at: nowIso,
          status_in_campaign: 'created',
        };
      }
      return d;
    });

    await supabaseAdmin
      .from('email_campaigns')
      .update({
        stats: {
          ...targetBatch.stats,
          drafts: updatedDrafts,
          updated_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq('id', targetBatch.id);

    return NextResponse.json({
      success: true,
      message: `Draft campaign "${campaignName}" created with ${personalizedRecipients.length} personalized emails. Open Campaign Review to inspect before sending.`,
      campaign: campaignResult,
      campaignId: campaignResult.id,
      campaignName,
      recipientsCount: personalizedRecipients.length,
      launched: false,
    });
  } catch (err) {
    console.error('[API /api/email/workspace/create-campaign Error]:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Failed to create personalized campaign' },
      { status: 500 }
    );
  }
}
