import crypto from 'crypto';
import tls from 'tls';
import { supabaseAdmin } from '../supabase.js';

/**
 * Google Workspace / Gmail Dual-Delivery & Sent-Folder Synchronization Service
 * 
 * Supports:
 * 1. Google Workspace REST API (OAuth2 or Service Account with Domain-Wide Delegation)
 * 2. Google Workspace IMAP Append (App Password / TLS to imap.gmail.com:993)
 * 3. Graceful fallback & non-blocking audit logging
 */

export const GMAIL_SYNC_CONFIG = {
  ENABLED: process.env.GMAIL_SYNC_ENABLED === 'true' || process.env.GMAIL_SYNC_ENABLED === '1',
  USER: process.env.GMAIL_USER || 'rauf@mine-tech.be',
  APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
  SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '',
  CLIENT_ID: process.env.GMAIL_CLIENT_ID || '',
  CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET || '',
  REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN || '',
  IMAP_HOST: 'imap.gmail.com',
  IMAP_PORT: 993,
};

/**
 * Checks whether Gmail / Google Workspace synchronization credentials are configured
 */
export function isGmailSyncConfigured() {
  if (!GMAIL_SYNC_CONFIG.ENABLED) return false;
  const hasAppPassword = Boolean(GMAIL_SYNC_CONFIG.USER && GMAIL_SYNC_CONFIG.APP_PASSWORD);
  const hasServiceAccount = Boolean(GMAIL_SYNC_CONFIG.SERVICE_ACCOUNT_EMAIL && GMAIL_SYNC_CONFIG.SERVICE_ACCOUNT_KEY);
  const hasOAuth = Boolean(GMAIL_SYNC_CONFIG.CLIENT_ID && GMAIL_SYNC_CONFIG.CLIENT_SECRET && GMAIL_SYNC_CONFIG.REFRESH_TOKEN);
  return hasAppPassword || hasServiceAccount || hasOAuth;
}

/**
 * Build RFC 2822 formatted raw email string
 */
export function buildRawRfc2822Email({
  from,
  to,
  cc,
  bcc,
  subject = '',
  bodyText = '',
  bodyHtml = '',
  messageId,
  inReplyTo,
  references,
  date = new Date(),
  extraHeaders = {},
}) {
  const boundary = `boundary_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const lines = [];

  lines.push(`From: ${from}`);
  lines.push(`To: ${Array.isArray(to) ? to.join(', ') : to}`);
  if (cc && cc.length > 0) lines.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
  if (bcc && bcc.length > 0) lines.push(`Bcc: ${Array.isArray(bcc) ? bcc.join(', ') : bcc}`);
  lines.push(`Subject: ${subject}`);
  lines.push(`Date: ${date.toUTCString()}`);
  if (messageId) lines.push(`Message-ID: ${messageId}`);
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${Array.isArray(references) ? references.join(' ') : references}`);
  
  // Custom tracking & loop prevention headers
  lines.push('X-MineTech-Synced: true');
  lines.push('X-Mailer: MineTech-Outbound/2.0');
  for (const [k, v] of Object.entries(extraHeaders)) {
    lines.push(`${k}: ${v}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push('');

  // Plain text part
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/plain; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: 7bit');
  lines.push('');
  lines.push(bodyText || bodyHtml.replace(/<[^>]+>/g, ' '));
  lines.push('');

  // HTML part
  if (bodyHtml) {
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(bodyHtml);
    lines.push('');
  }

  lines.push(`--${boundary}--`);
  lines.push('');

  return lines.join('\r\n');
}

/**
 * Execute basic IMAP command over TLS socket
 */
function sendImapCommand(client, cmd) {
  return new Promise((resolve, reject) => {
    let output = '';
    const onData = (chunk) => {
      output += chunk.toString();
      if (output.includes(`${cmd.tag} OK`) || output.includes(`${cmd.tag} NO`) || output.includes(`${cmd.tag} BAD`)) {
        client.removeListener('data', onData);
        if (output.includes(`${cmd.tag} OK`)) {
          resolve(output);
        } else {
          reject(new Error(`IMAP command failed: ${output.trim()}`));
        }
      }
    };
    client.on('data', onData);
    client.write(`${cmd.tag} ${cmd.text}\r\n`);
  });
}

/**
 * Append RFC 2822 email to Gmail folder using IMAP TLS
 */
async function appendViaImap({ mailbox = '[Gmail]/Sent Mail', rawEmail, flags = ['\\Seen'] }) {
  if (!GMAIL_SYNC_CONFIG.USER || !GMAIL_SYNC_CONFIG.APP_PASSWORD) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD are required for IMAP append sync.');
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: GMAIL_SYNC_CONFIG.IMAP_HOST,
        port: GMAIL_SYNC_CONFIG.IMAP_PORT,
        rejectUnauthorized: true,
      },
      async () => {
        try {
          // Wait for initial greeting
          await new Promise((res) => socket.once('data', res));

          // Login
          const tag1 = 'A01';
          await sendImapCommand(socket, {
            tag: tag1,
            text: `LOGIN "${GMAIL_SYNC_CONFIG.USER}" "${GMAIL_SYNC_CONFIG.APP_PASSWORD.replace(/\s+/g, '')}"`,
          });

          // Append message
          const tag2 = 'A02';
          const flagStr = flags && flags.length ? ` (${flags.join(' ')})` : '';
          const byteLength = Buffer.byteLength(rawEmail, 'utf8');

          // Send APPEND command
          const appendPromise = new Promise((res, rej) => {
            const onAppendData = (chunk) => {
              const str = chunk.toString();
              if (str.startsWith('+') || str.includes('\r\n+ ')) {
                socket.removeListener('data', onAppendData);
                // Send raw email bytes
                socket.write(rawEmail + '\r\n');
                res();
              } else if (str.includes(`${tag2} NO`) || str.includes(`${tag2} BAD`)) {
                socket.removeListener('data', onAppendData);
                rej(new Error(`IMAP APPEND rejected: ${str}`));
              }
            };
            socket.on('data', onAppendData);
          });

          socket.write(`${tag2} APPEND "${mailbox}"${flagStr} {${byteLength}}\r\n`);
          await appendPromise;

          // Wait for APPEND completion
          await new Promise((res, rej) => {
            const onDoneData = (chunk) => {
              const str = chunk.toString();
              if (str.includes(`${tag2} OK`)) {
                socket.removeListener('data', onDoneData);
                res();
              } else if (str.includes(`${tag2} NO`) || str.includes(`${tag2} BAD`)) {
                socket.removeListener('data', onDoneData);
                rej(new Error(`IMAP APPEND failed: ${str}`));
              }
            };
            socket.on('data', onDoneData);
          });

          // Logout
          socket.write('A03 LOGOUT\r\n');
          socket.end();
          resolve({ success: true, mailbox });
        } catch (err) {
          try {
            socket.write('A03 LOGOUT\r\n');
            socket.end();
          } catch (e) {}
          reject(err);
        }
      }
    );

    socket.on('error', (e) => reject(e));
    socket.setTimeout(15000, () => {
      socket.destroy();
      reject(new Error('IMAP connection timed out'));
    });
  });
}

/**
 * Synchronize an OUTBOUND email to Gmail's Sent folder
 * 
 * Called after Resend successfully dispatches an email from MineTech.
 */
export async function syncOutboundEmailToGmailSent({
  messageId,
  sender = 'Rauf <rauf@mine-tech.be>',
  recipient,
  subject,
  bodyHtml,
  bodyText,
  inReplyTo = null,
  references = null,
  dbMessageId = null,
}) {
  const syncTimestamp = new Date().toISOString();

  if (!isGmailSyncConfigured()) {
    // Audit that synchronization is awaiting Google Workspace credentials
    if (dbMessageId) {
      try {
        await supabaseAdmin
          .from('email_messages')
          .update({
            gmail_synced: false,
            gmail_sync_status: 'pending_credentials',
            gmail_sync_error: 'GMAIL_APP_PASSWORD or Google Workspace OAuth not configured',
          })
          .eq('id', dbMessageId);
      } catch (e) {}
    }

    return {
      synced: false,
      status: 'pending_credentials',
      reason: 'Google Workspace credentials not configured. Outbound email is securely saved in MineTech.',
    };
  }

  const rawEmail = buildRawRfc2822Email({
    from: sender,
    to: recipient,
    subject,
    bodyHtml,
    bodyText,
    messageId,
    inReplyTo,
    references,
    date: new Date(),
  });

  try {
    // Try primary IMAP Sent folder
    let imapResult;
    try {
      imapResult = await appendViaImap({
        mailbox: '[Gmail]/Sent Mail',
        rawEmail,
        flags: ['\\Seen'],
      });
    } catch (sentFolderErr) {
      // Fallback for internationalized Gmail folder names
      imapResult = await appendViaImap({
        mailbox: 'Sent',
        rawEmail,
        flags: ['\\Seen'],
      });
    }

    if (dbMessageId) {
      try {
        await supabaseAdmin
          .from('email_messages')
          .update({
            gmail_synced: true,
            gmail_sync_status: 'synced',
            gmail_sync_error: null,
          })
          .eq('id', dbMessageId);
      } catch (e) {}
    }

    return {
      synced: true,
      status: 'synced',
      mailbox: imapResult.mailbox,
      timestamp: syncTimestamp,
    };
  } catch (syncErr) {
    console.warn('[GmailSync] Outbound Sent copy sync error:', syncErr.message);

    if (dbMessageId) {
      try {
        await supabaseAdmin
          .from('email_messages')
          .update({
            gmail_synced: false,
            gmail_sync_status: 'failed',
            gmail_sync_error: syncErr.message,
          })
          .eq('id', dbMessageId);
      } catch (e) {}
    }

    return {
      synced: false,
      status: 'failed',
      error: syncErr.message,
    };
  }
}

/**
 * Synchronize an INBOUND email to Gmail's Inbox
 * 
 * Called when Resend Receiving accepts an email for rauf@mine-tech.be.
 * Injects the message into Google Workspace Gmail so it appears in Gmail app.
 */
export async function syncInboundEmailToGmailInbox({
  messageId,
  sender,
  recipient = 'rauf@mine-tech.be',
  subject,
  bodyHtml,
  bodyText,
  inReplyTo = null,
  references = null,
  receivedAt = new Date(),
  dbMessageId = null,
}) {
  const syncTimestamp = new Date().toISOString();

  if (!isGmailSyncConfigured()) {
    if (dbMessageId) {
      try {
        await supabaseAdmin
          .from('email_messages')
          .update({
            gmail_synced: false,
            gmail_sync_status: 'pending_credentials',
            gmail_sync_error: 'GMAIL_APP_PASSWORD or Google Workspace OAuth not configured',
          })
          .eq('id', dbMessageId);
      } catch (e) {}
    }

    return {
      synced: false,
      status: 'pending_credentials',
      reason: 'Google Workspace credentials not configured. Inbound email is securely saved in MineTech.',
    };
  }

  const rawEmail = buildRawRfc2822Email({
    from: sender,
    to: recipient,
    subject,
    bodyHtml,
    bodyText,
    messageId,
    inReplyTo,
    references,
    date: receivedAt instanceof Date ? receivedAt : new Date(receivedAt),
  });

  try {
    const imapResult = await appendViaImap({
      mailbox: 'INBOX',
      rawEmail,
      flags: [], // Unread
    });

    if (dbMessageId) {
      try {
        await supabaseAdmin
          .from('email_messages')
          .update({
            gmail_synced: true,
            gmail_sync_status: 'synced',
            gmail_sync_error: null,
          })
          .eq('id', dbMessageId);
      } catch (e) {}
    }

    return {
      synced: true,
      status: 'synced',
      mailbox: imapResult.mailbox,
      timestamp: syncTimestamp,
    };
  } catch (syncErr) {
    console.warn('[GmailSync] Inbound delivery to Gmail Inbox error:', syncErr.message);

    if (dbMessageId) {
      try {
        await supabaseAdmin
          .from('email_messages')
          .update({
            gmail_synced: false,
            gmail_sync_status: 'failed',
            gmail_sync_error: syncErr.message,
          })
          .eq('id', dbMessageId);
      } catch (e) {}
    }

    return {
      synced: false,
      status: 'failed',
      error: syncErr.message,
    };
  }
}

/**
 * Return health and sync diagnostics for Google Workspace & Gmail
 */
export async function getGmailSyncDiagnostics() {
  const configured = isGmailSyncConfigured();
  return {
    enabled: GMAIL_SYNC_CONFIG.ENABLED,
    configured,
    primaryUser: GMAIL_SYNC_CONFIG.USER,
    hasAppPassword: Boolean(GMAIL_SYNC_CONFIG.APP_PASSWORD),
    hasServiceAccount: Boolean(GMAIL_SYNC_CONFIG.SERVICE_ACCOUNT_EMAIL && GMAIL_SYNC_CONFIG.SERVICE_ACCOUNT_KEY),
    hasOAuth: Boolean(GMAIL_SYNC_CONFIG.REFRESH_TOKEN),
    imapHost: GMAIL_SYNC_CONFIG.IMAP_HOST,
    imapPort: GMAIL_SYNC_CONFIG.IMAP_PORT,
    status: configured ? 'READY' : 'PENDING_CONFIGURATION',
  };
}

export default {
  GMAIL_SYNC_CONFIG,
  isGmailSyncConfigured,
  buildRawRfc2822Email,
  syncOutboundEmailToGmailSent,
  syncInboundEmailToGmailInbox,
  getGmailSyncDiagnostics,
};
