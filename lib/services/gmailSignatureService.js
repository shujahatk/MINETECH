/**
 * MineTech Gmail Signature Integration Service
 * 
 * Interacts with Google Workspace / Gmail REST API to retrieve the exact
 * formatted HTML signature configured on the connected Gmail sending identity.
 * 
 * Supports:
 * 1. OAuth2 Settings API (GET https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs)
 * 2. Scope validation (requires https://www.googleapis.com/auth/gmail.settings.basic)
 * 3. Exact HTML preservation (colors, fonts, bolding, links, layout)
 * 4. High-fidelity manual fallback identical to the user's Gmail signature
 * 5. Persistent sync metadata (lastSyncedAt, source, sendAsEmail) saved to Supabase
 */

import { GMAIL_SYNC_CONFIG } from './gmailSyncService.js';
import { supabaseAdmin } from '../supabase.js';
import { updateWorkspaceSettings } from './workspaceSettingsService.js';

// The verified MineTech official Gmail signature HTML fallback
// Strictly preserving original font formatting, colors, bolding, hyperlinks, and layout
export const OFFICIAL_GMAIL_SIGNATURE_HTML = `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">
  <div dir="ltr">
    <p style="margin-top:16px; margin-bottom:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:1.5; color:#1f2937;">
      Regards,<br/>
      <strong style="color:#0f172a;">Abdullah Rauf</strong> - Head of Sales | Mo. +32 486 287 751 | <a href="mailto:rauf@mine-tech.be" style="color:#0284c7; text-decoration:none;" target="_blank">rauf@mine-tech.be</a><br/>
      <strong style="color:#0f172a;">Minetech Resources BV – Belgium</strong> | BTW No. BE 1011004868 | <a href="https://www.mine-tech.be" style="color:#0284c7; text-decoration:none;" target="_blank">www.mine-tech.be</a>
    </p>
    <p style="margin-top:8px; margin-bottom:0; font-family:Arial, Helvetica, sans-serif; font-size:11px; line-height:1.4; color:#6b7280;">
      Facility Address: Frederik Hendrikstraat 60, 4586 AC, Lamswaarde, Netherlands<br/>
      Registered Office Address: Kernenergiestraat 19, Bus W16, 2610 Antwerpen, Belgium
    </p>
  </div>
</div>`;

// In-memory state for synced Gmail signatures and metadata (hydrated from Supabase)
let syncedSignatureState = {
  signatureHtml: OFFICIAL_GMAIL_SIGNATURE_HTML,
  sendAsEmail: 'rauf@mine-tech.be',
  displayName: 'Abdullah Rauf',
  isPrimary: true,
  source: 'official_reference', // 'gmail_api' | 'official_reference' | 'manual'
  lastSyncedAt: new Date().toISOString(),
  permissionStatus: 'ready', // 'ready' | 'missing_permissions' | 'unconfigured'
  requiredScope: 'https://www.googleapis.com/auth/gmail.settings.basic',
};

/**
 * Hydrate state from persistent Supabase settings
 */
export function hydrateGmailSignatureFromSettings(savedState) {
  if (savedState && savedState.signatureHtml) {
    syncedSignatureState = {
      ...syncedSignatureState,
      ...savedState,
    };
  }
}

/**
 * Exchange OAuth Refresh Token for a fresh Google API Access Token
 */
async function getGoogleAccessToken() {
  const clientId = GMAIL_SYNC_CONFIG.CLIENT_ID;
  const clientSecret = GMAIL_SYNC_CONFIG.CLIENT_SECRET;
  const refreshToken = GMAIL_SYNC_CONFIG.REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    const errorData = await tokenRes.json().catch(() => ({}));
    throw new Error(errorData.error_description || errorData.error || 'Failed to refresh Google OAuth token');
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

/**
 * Sync signature from Gmail Settings API for the connected account
 */
export async function syncGmailSignature({ targetEmail = null } = {}) {
  const syncEmail = targetEmail || GMAIL_SYNC_CONFIG.USER || 'rauf@mine-tech.be';

  // 1. Check if OAuth credentials exist
  if (!GMAIL_SYNC_CONFIG.CLIENT_ID || !GMAIL_SYNC_CONFIG.REFRESH_TOKEN) {
    // If OAuth is not configured, safely maintain verified official signature
    syncedSignatureState = {
      ...syncedSignatureState,
      source: 'official_reference',
      sendAsEmail: syncEmail,
      permissionStatus: 'unconfigured',
      lastSyncedAt: new Date().toISOString(),
    };

    updateWorkspaceSettings({ active_gmail_signature: syncedSignatureState }).catch(() => { });

    return {
      success: true,
      signatureHtml: syncedSignatureState.signatureHtml,
      sendAsEmail: syncEmail,
      displayName: syncedSignatureState.displayName,
      lastSyncedAt: syncedSignatureState.lastSyncedAt,
      source: 'official_reference',
      notice: 'Google OAuth not directly connected in environment. Using verified official MineTech Gmail signature.',
    };
  }

  try {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      throw new Error('Could not obtain Google access token');
    }

    // 2. Query Gmail Settings SendAs API
    const sendAsUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs';
    const res = await fetch(sendAsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    // 3. Handle Permission / Scope Check
    if (res.status === 403 || res.status === 401) {
      const errJson = await res.json().catch(() => ({}));
      const isScopeError =
        JSON.stringify(errJson).includes('insufficientPermissions') ||
        JSON.stringify(errJson).includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT');

      syncedSignatureState.permissionStatus = 'missing_permissions';
      updateWorkspaceSettings({ active_gmail_signature: syncedSignatureState }).catch(() => { });

      return {
        success: false,
        reason: 'missing_permissions',
        requiredScope: 'https://www.googleapis.com/auth/gmail.settings.basic',
        message: 'Gmail authentication is connected, but signature-reading permission (gmail.settings.basic) has not been granted. Please authorize the required scope.',
        signatureHtml: syncedSignatureState.signatureHtml,
        lastSyncedAt: syncedSignatureState.lastSyncedAt,
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gmail API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const sendAsList = data.sendAs || [];

    // Find identity matching syncEmail or primary identity
    const matchedIdentity =
      sendAsList.find((id) => id.sendAsEmail?.toLowerCase() === syncEmail.toLowerCase()) ||
      sendAsList.find((id) => id.isPrimary) ||
      sendAsList[0];

    if (!matchedIdentity) {
      throw new Error(`No sending identity found in Gmail for ${syncEmail}`);
    }

    const rawSignature = matchedIdentity.signature || '';
    let finalSignatureHtml = rawSignature;

    if (rawSignature && !rawSignature.includes('gmail_signature')) {
      finalSignatureHtml = `<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">${rawSignature}</div>`;
    } else if (!rawSignature) {
      finalSignatureHtml = OFFICIAL_GMAIL_SIGNATURE_HTML;
    }

    syncedSignatureState = {
      signatureHtml: finalSignatureHtml,
      sendAsEmail: matchedIdentity.sendAsEmail || syncEmail,
      displayName: matchedIdentity.displayName || 'Abdullah Rauf',
      isPrimary: Boolean(matchedIdentity.isPrimary),
      source: 'gmail_api',
      lastSyncedAt: new Date().toISOString(),
      permissionStatus: 'ready',
      requiredScope: 'https://www.googleapis.com/auth/gmail.settings.basic',
    };

    // Persist to Supabase
    updateWorkspaceSettings({ active_gmail_signature: syncedSignatureState }).catch(() => { });

    return {
      success: true,
      signatureHtml: syncedSignatureState.signatureHtml,
      sendAsEmail: syncedSignatureState.sendAsEmail,
      displayName: syncedSignatureState.displayName,
      lastSyncedAt: syncedSignatureState.lastSyncedAt,
      source: 'gmail_api',
      identities: sendAsList.map((id) => ({
        sendAsEmail: id.sendAsEmail,
        displayName: id.displayName,
        isPrimary: id.isPrimary,
      })),
    };
  } catch (err) {
    console.warn('[GmailSignatureService] Sync failed:', err.message);
    return {
      success: false,
      reason: 'api_error',
      message: err.message,
      signatureHtml: syncedSignatureState.signatureHtml,
      lastSyncedAt: syncedSignatureState.lastSyncedAt,
    };
  }
}

/**
 * Retrieve the active Gmail signature and sync metadata
 */
export function getActiveGmailSignature() {
  return syncedSignatureState;
}

/**
 * Update manual HTML signature fallback and persist permanently
 */
export function setManualSignatureHtml(html, senderEmail = 'rauf@mine-tech.be') {
  if (!html || !html.trim()) return syncedSignatureState;

  syncedSignatureState = {
    ...syncedSignatureState,
    signatureHtml: html.trim(),
    sendAsEmail: senderEmail,
    source: 'manual',
    lastSyncedAt: new Date().toISOString(),
  };

  // Persist to Supabase
  updateWorkspaceSettings({ active_gmail_signature: syncedSignatureState }).catch(() => { });

  return syncedSignatureState;
}
