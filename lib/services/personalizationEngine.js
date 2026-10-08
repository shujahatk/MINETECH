import { generateAIEmailDraft, personalizeLeadHook, regenerateEmailCopy } from './aiService.js';

export const SUPPORTED_TAGS = [
  '{{firstName}}',
  '{{lastName}}',
  '{{fullName}}',
  '{{email}}',
  '{{company}}',
  '{{jobTitle}}',
  '{{industry}}',
  '{{website}}',
  '{{phone}}',
  '{{linkedin}}',
  '{{senderName}}',
  '{{senderEmail}}',
  '{{unsubscribeUrl}}',
];

/**
 * Centralized Merge Variable Engine for MineTech Outbound System
 * Handles all 80/20 merge variables with robust fallback values.
 */
export function substituteMergeVariables(template = '', context = {}, sender = {}) {
  if (!template || typeof template !== 'string') return '';

  const firstName = context.firstName || context.first_name || (context.fullName ? context.fullName.split(' ')[0] : '') || (context.full_name ? context.full_name.split(' ')[0] : '') || 'there';
  const lastName = context.lastName || context.last_name || (context.fullName && context.fullName.split(' ').length > 1 ? context.fullName.split(' ').slice(1).join(' ') : '') || '';
  const fullName = context.fullName || context.full_name || `${firstName} ${lastName}`.trim() || 'there';
  const email = context.email || '';
  const company = context.company || context.company_name || 'your company';
  const jobTitle = context.jobTitle || context.job_title || context.title || context.position || 'Executive';
  const industry = context.industry || context.niche || 'your industry';
  const website = context.website || '';
  const phone = context.phone || '';
  const linkedin = context.linkedin || '';
  const senderName = sender.name || sender.senderName || context.senderName || context.fromName || 'Sales Team';
  const senderEmail = sender.email || sender.senderEmail || context.senderEmail || context.fromEmail || 'outreach@8020aquisition.com';
  const unsubscribeUrl = context.unsubscribeUrl || `https://8020aquisition.com/unsubscribe?email=${encodeURIComponent(email)}`;

  return template
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*lastName\s*\}\}/gi, lastName)
    .replace(/\{\{\s*last_name\s*\}\}/gi, lastName)
    .replace(/\{\{\s*fullName\s*\}\}/gi, fullName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*email\s*\}\}/gi, email)
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\{\{\s*company_name\s*\}\}/gi, company)
    .replace(/\{\{\s*jobTitle\s*\}\}/gi, jobTitle)
    .replace(/\{\{\s*job_title\s*\}\}/gi, jobTitle)
    .replace(/\{\{\s*title\s*\}\}/gi, jobTitle)
    .replace(/\{\{\s*industry\s*\}\}/gi, industry)
    .replace(/\{\{\s*niche\s*\}\}/gi, industry)
    .replace(/\{\{\s*website\s*\}\}/gi, website)
    .replace(/\{\{\s*phone\s*\}\}/gi, phone)
    .replace(/\{\{\s*linkedin\s*\}\}/gi, linkedin)
    .replace(/\{\{\s*senderName\s*\}\}/gi, senderName)
    .replace(/\{\{\s*sender_name\s*\}\}/gi, senderName)
    .replace(/\{\{\s*senderEmail\s*\}\}/gi, senderEmail)
    .replace(/\{\{\s*sender_email\s*\}\}/gi, senderEmail)
    .replace(/\{\{\s*unsubscribeUrl\s*\}\}/gi, unsubscribeUrl)
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubscribeUrl)
    .replace(/\{\{\s*customHook\s*\}\}/gi, context.customHook || context.custom_hook || '')
    .replace(/\{\{\s*[\w.-]+\s*\}\}/g, ''); // Clear any unmapped merge tags
}

export const replaceMergeVariables = substituteMergeVariables;

/**
 * Universal render function supporting both standard and Claude AI personalization
 */
export async function renderEmail({
  templateText = '',
  subject = 'Outbound Update',
  lead = {},
  sender = {},
  useClaude = false,
  claudeApiKey = null,
  aiOptions = null,
}) {
  if (!useClaude) {
    const renderedBody = substituteMergeVariables(templateText, lead, sender);
    const renderedSubject = substituteMergeVariables(subject, lead, sender);
    return {
      subject: renderedSubject,
      bodyHtml: renderedBody,
      bodyText: renderedBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      isAiPersonalized: false,
    };
  }

  // Claude AI mode
  try {
    const aiDraft = await generateAIEmailDraft({
      prompt: aiOptions?.prompt || templateText,
      tone: aiOptions?.tone || 'Direct',
      leadContext: lead,
    });
    const renderedBody = substituteMergeVariables(aiDraft.bodyHtml || templateText, lead, sender);
    const renderedSubject = substituteMergeVariables(aiDraft.subject || subject, lead, sender);
    return {
      subject: renderedSubject,
      bodyHtml: renderedBody,
      bodyText: aiDraft.bodyText || renderedBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      isAiPersonalized: true,
    };
  } catch (err) {
    // Fall back to template text safely
    const fallbackBody = substituteMergeVariables(templateText, lead, sender);
    const fallbackSubject = substituteMergeVariables(subject, lead, sender);
    return {
      subject: fallbackSubject,
      bodyHtml: fallbackBody,
      bodyText: fallbackBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      isAiPersonalized: false,
      aiError: err.message,
    };
  }
}

/**
 * Renders Email Subject and Body for a Prospect
 */
export async function renderPersonalizedEmail({
  mode = 'standard',
  subject = '',
  bodyHtml = '',
  bodyText = '',
  prospect = {},
  sender = {},
  aiOptions = null,
}) {
  const mergeContext = {
    ...prospect,
    senderName: sender.name || sender.senderName || 'Sales Team',
    senderEmail: sender.email || sender.senderEmail || 'outreach@8020aquisition.com',
    unsubscribeUrl: `https://8020aquisition.com/unsubscribe?email=${encodeURIComponent(prospect.email || '')}`,
  };

  // 1. STANDARD MODE (No AI) - Claude is NEVER called
  if (mode !== 'claude' || !aiOptions) {
    const renderedSubject = substituteMergeVariables(subject, mergeContext, sender);
    const renderedHtml = substituteMergeVariables(bodyHtml, mergeContext, sender);
    const renderedText = substituteMergeVariables(bodyText || bodyHtml.replace(/<[^>]+>/g, '\n').trim(), mergeContext, sender);

    return {
      mode: 'standard',
      subject: renderedSubject,
      bodyHtml: renderedHtml,
      bodyText: renderedText,
      claudeInvoked: false,
    };
  }

  // 2. CLAUDE AI MODE (Optional personalization layer)
  let generatedSubject = subject;
  let generatedHtml = bodyHtml;
  let generatedText = bodyText;
  let aiTelemetry = null;

  try {
    if (aiOptions.action === 'generate') {
      const draft = await generateAIEmailDraft({
        prompt: aiOptions.prompt || 'Cold outbound introduction',
        tone: aiOptions.tone || 'Direct',
        goal: aiOptions.goal || 'Intro Call',
        leadContext: prospect,
        leadId: prospect.id || prospect._id,
        campaignId: aiOptions.campaignId,
      });
      generatedSubject = draft.subject || subject;
      generatedHtml = draft.bodyHtml || bodyHtml;
      generatedText = draft.bodyText || bodyText;
      aiTelemetry = draft.telemetry;
    } else if (aiOptions.action === 'personalize_hook') {
      const hookRes = await personalizeLeadHook({
        leadContext: prospect,
        tone: aiOptions.tone || 'Direct',
        customInstruction: aiOptions.prompt,
      });
      if (hookRes.hook) {
        generatedHtml = `<p>${hookRes.hook}</p>` + bodyHtml;
        generatedText = `${hookRes.hook}\n\n` + bodyText;
      }
    }
  } catch (err) {
    // Fall back to base content safely
    generatedSubject = subject;
    generatedHtml = bodyHtml;
    generatedText = bodyText;
  }

  // Apply final merge variable substitution
  const finalSubject = substituteMergeVariables(generatedSubject, mergeContext, sender);
  const finalHtml = substituteMergeVariables(generatedHtml, mergeContext, sender);
  const finalText = substituteMergeVariables(generatedText, mergeContext, sender);

  return {
    mode: 'claude',
    subject: finalSubject,
    bodyHtml: finalHtml,
    bodyText: finalText,
    claudeInvoked: true,
    telemetry: aiTelemetry,
  };
}

export default {
  SUPPORTED_TAGS,
  substituteMergeVariables,
  replaceMergeVariables,
  renderEmail,
  renderPersonalizedEmail,
};

