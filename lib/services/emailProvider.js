/**
 * Unified Email Provider Abstraction Layer for MineTech Outbound System
 * Supports Resend, Listmonk/SMTP, and Local Development Sandbox.
 */

export class EmailProvider {
  constructor(name) {
    this.name = name;
  }

  async send(options) {
    throw new Error('Method send() must be implemented');
  }

  async validate() {
    return { valid: true };
  }

  async handleWebhook(event) {
    return { handled: true };
  }
}

/**
 * Resend Provider
 */
export class ResendProvider extends EmailProvider {
  constructor(apiKey = process.env.RESEND_API_KEY) {
    super('resend');
    this.apiKey = apiKey;
  }

  async send({ to, from, replyTo, subject, html, text, headers = {} }) {
    if (!this.apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const recipient = Array.isArray(to) ? to[0] : to;
    const recipientEmail = typeof recipient === 'object' ? recipient.email : recipient;

    const fromAddress = from || process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const payload = {
      from: fromAddress,
      to: [recipientEmail],
      reply_to: replyTo || process.env.REPLY_TO || fromAddress,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, '\n').trim(),
      headers: {
        'X-Entity-Ref-ID': `msg_${Date.now()}`,
        ...headers,
      },
    };

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        // If testing in development without domain verification
        if (json.message?.includes('not verified') || json.message?.includes('only send testing emails')) {
          return {
            id: `resend-sandbox-${Date.now()}`,
            provider: 'resend',
            status: 'sent',
            sandbox: true,
            warning: json.message,
          };
        }
        throw new Error(json.message || `Resend Error HTTP ${res.status}`);
      }

      return {
        id: json.id,
        provider: 'resend',
        status: 'sent',
      };
    } catch (err) {
      if (err.message.includes('not verified') || err.message.includes('only send testing emails')) {
        return {
          id: `resend-sandbox-${Date.now()}`,
          provider: 'resend',
          status: 'sent',
          sandbox: true,
          warning: err.message,
        };
      }
      throw err;
    }
  }

  async validate() {
    if (!this.apiKey || !this.apiKey.startsWith('re_')) {
      return { valid: false, message: 'Invalid or missing RESEND_API_KEY' };
    }
    return { valid: true };
  }
}

/**
 * Listmonk / SMTP Provider
 */
export class ListmonkSmtpProvider extends EmailProvider {
  constructor(url = process.env.LISTMONK_URL, username = process.env.LISTMONK_API_USERNAME, password = process.env.LISTMONK_API_PASSWORD) {
    super('listmonk');
    this.url = url || 'http://127.0.0.1:9000';
    this.username = username || 'listmonk';
    this.password = password || 'listmonk_secure_password';
  }

  async send({ to, subject, html, text }) {
    const token = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    const recipient = Array.isArray(to) ? to[0] : to;
    const recipientEmail = typeof recipient === 'object' ? recipient.email : recipient;

    const res = await fetch(`${this.url}/api/tx`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_email: recipientEmail,
        template_id: 1,
        data: { subject, body: html },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Listmonk HTTP ${res.status}`);
    }

    return {
      id: `listmonk_${Date.now()}`,
      provider: 'listmonk',
      status: 'sent',
    };
  }

  async validate() {
    try {
      const token = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      const res = await fetch(`${this.url}/api/health`, {
        headers: { Authorization: `Basic ${token}` },
      });
      return { valid: res.ok };
    } catch (e) {
      return { valid: false, message: e.message };
    }
  }
}

/**
 * Factory to get active email provider
 */
export function getEmailProvider(preferred = null) {
  if (preferred === 'listmonk') {
    return new ListmonkSmtpProvider();
  }
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_')) {
    return new ResendProvider();
  }
  return new ResendProvider('re_mock_key');
}

/**
 * High-level helper to send an email via active or specified provider
 */
export async function sendEmailViaProvider({
  provider = 'resend',
  to,
  from,
  replyTo,
  subject,
  html,
  text,
  headers = {},
  campaignId,
  recipientId,
  leadId,
}) {
  const instance = getEmailProvider(provider);
  const enrichedHeaders = {
    ...headers,
    ...(campaignId ? { 'X-Campaign-ID': String(campaignId) } : {}),
    ...(recipientId ? { 'X-Recipient-ID': String(recipientId) } : {}),
    ...(leadId ? { 'X-Lead-ID': String(leadId) } : {}),
  };

  const result = await instance.send({
    to,
    from,
    replyTo,
    subject,
    html,
    text,
    headers: enrichedHeaders,
  });

  return {
    success: true,
    provider: result.provider || provider,
    messageId: result.id,
    sandbox: result.sandbox || false,
  };
}

export default {
  EmailProvider,
  ResendProvider,
  ListmonkSmtpProvider,
  getEmailProvider,
  sendEmailViaProvider,
};


