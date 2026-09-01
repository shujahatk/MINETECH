/**
 * Optional AI email drafting assistant with graceful fallback
 */
export async function generateAIEmailDraft({
  prompt = '',
  tone = 'Professional',
  goal = 'Cold Outreach',
  leadContext = {},
}) {
  const leadName = leadContext.name || leadContext.fullName || 'there';
  const company = leadContext.company || 'your organization';
  const jobTitle = leadContext.jobTitle || '';

  // If OpenAI API key is present
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert outbound copywriter. Write a concise, high-converting B2B cold email. Keep it under 100 words. Tone: ${tone}. Goal: ${goal}. Available merge fields: {{firstName}}, {{company}}, {{jobTitle}}. Output JSON with "subject" and "bodyHtml".`,
            },
            {
              role: 'user',
              content: `Context: ${prompt}. Prospect: ${leadName} at ${company} (${jobTitle}).`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        return {
          subject: parsed.subject || `Quick question regarding {{company}}`,
          bodyHtml: parsed.bodyHtml || parsed.body || '',
        };
      }
    } catch (err) {
      console.warn('[AIService] OpenAI request failed, using template generator:', err.message);
    }
  }

  // Graceful rule-based generation if no AI key or offline
  const toneSubjects = {
    Professional: `Quick question regarding growth at {{company}}`,
    Friendly: `Hey {{firstName}}, loved what you're building at {{company}}`,
    Direct: `Idea for {{company}}'s outbound pipeline`,
    Casual: `{{firstName}} / quick idea for {{company}}`,
  };

  const subject = toneSubjects[tone] || `Quick question for {{firstName}}`;

  const bodyHtml = `<p>Hi {{firstName}},</p>
<p>I came across {{company}} and noticed your focus on ${prompt || 'scaling outbound sales and client acquisition'}.</p>
<p>We recently helped a similar team streamline their sales pipeline by 40% using an email-first outbound workflow.</p>
<p>Would you be open to a brief 10-minute chat this Thursday at 2 PM to see if this makes sense for {{company}}?</p>
<p>Best regards,<br/>Alex</p>`;

  const bodyText = `Hi {{firstName}},\n\nI came across {{company}} and noticed your focus on ${prompt || 'scaling outbound sales and client acquisition'}.\n\nWe recently helped a similar team streamline their sales pipeline by 40% using an email-first outbound workflow.\n\nWould you be open to a brief 10-minute chat this Thursday at 2 PM to see if this makes sense for {{company}}?\n\nBest regards,\nAlex`;

  return { subject, bodyHtml, body: bodyText, bodyText };
}
