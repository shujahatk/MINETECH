# MINETECH — PRODUCTION DEPLOYMENT CHECKLIST & RUNBOOK

**Target Environment:** Production Node.js 18+ / 20+ / Docker Container  
**Platform Version:** 2.0.0 (Hardened Master Release)  
**Database:** MongoDB Atlas (M10+ Dedicated Cluster Recommended)  

---

## 1. Pre-Deployment Infrastructure Prerequisites

- [ ] **Domain & SSL/TLS:** Fully qualified domain name (e.g. `app.minetech.io`) with active TLS 1.3 / HTTPS certificate.
- [ ] **MongoDB Atlas Cluster:**
  - Whitelist production server IP / VPC peering.
  - Replica set connection string with `retryWrites=true&w=majority`.
  - Database user with `readWrite` role scoped to `minetech-outbound`.
- [ ] **Node.js Runtime:** Node.js v18.18+ or v20+ with npm v9+.

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env.production` on the production server. Populate all keys with real credentials:

```bash
# Application
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.minetech.io

# Authentication (Cryptographically random 64-char string)
JWT_SECRET=<GENERATE_VIA: openssl rand -hex 32>
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<STRONG_PASSWORD_MIN_12_CHARS>

# MongoDB Primary Database
MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/minetech-outbound?retryWrites=true&w=majority

# Anthropic Claude 3.5 Sonnet
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Resend Email Delivery
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
EMAIL_FROM=outreach@yourdomain.com
EMAIL_FROM_NAME=MineTech Outbound
REPLY_TO=replies@yourdomain.com

# Twilio Telephony (Voice & SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
TWILIO_TWIML_APP_SID=AP...

# Security & CORS
CORS_ALLOWED_ORIGINS=https://app.minetech.io
```

---

## 3. Email DNS & Deliverability Setup

Add the following DNS records to your domain's DNS provider (Cloudflare, Route53, Namecheap, etc.):

### A. SPF (Sender Policy Framework)
- **Type:** `TXT`
- **Host:** `@` (or sending subdomain)
- **Value:** `v=spf1 include:resend.com ~all`

### B. DKIM (DomainKeys Identified Mail)
- **Type:** `TXT` / `CNAME`
- **Host:** `resend._domainkey` (as provided in Resend Dashboard)
- **Value:** `<RESEND_PUBLIC_DKIM_KEY>`

### C. DMARC (Domain-based Message Authentication)
- **Type:** `TXT`
- **Host:** `_dmarc`
- **Value:** `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@yourdomain.com`

### D. MX Records (Inbound Reply Tracking)
- **Type:** `MX`
- **Host:** `replies` (subdomain)
- **Priority:** `10`
- **Value:** `feedback-smtp.us-east-1.amazonses.com` (or Resend MX endpoint)

---

## 4. Webhook URL Configuration

Configure the following endpoints in provider developer dashboards:

| Provider | Purpose | Webhook Endpoint URL |
| :--- | :--- | :--- |
| **Twilio Voice** | Voice TwiML Handler | `https://app.minetech.io/api/webhooks/twilio/twiml` |
| **Twilio Voice** | Status & Recording Callback | `https://app.minetech.io/api/webhooks/twilio/status` |
| **Twilio SMS** | Inbound SMS Receiver | `https://app.minetech.io/api/webhooks/twilio/sms` |
| **Twilio SMS** | Outbound SMS Delivery Status | `https://app.minetech.io/api/webhooks/twilio/sms-status` |
| **Resend** | Delivery, Bounce, Open, Click Webhooks | `https://app.minetech.io/api/webhooks/resend` |
| **Listmonk** | Campaign Event Webhooks | `https://app.minetech.io/api/webhooks/listmonk` |

---

## 5. Build & Deployment Commands

```bash
# 1. Install production dependencies
npm ci --only=production

# 2. Run automated validation test suite
npm test

# 3. Create optimized Next.js production build
npm run build

# 4. Start production process with PM2 process manager
pm2 start npm --name "minetech-outbound" -- start -- -p 3000

# 5. Enable PM2 system restart hook
pm2 startup
pm2 save
```

---

## 6. Post-Deployment Smoke Tests

Execute these 5 verification steps immediately after deployment:

1. **Health Check:** `curl -s https://app.minetech.io/api/system/health | jq .`
   - Expected: `{"success": true, "database": "connected"}`
2. **Admin Login:** Log in via `https://app.minetech.io/login` with `ADMIN_EMAIL`.
   - Verify `auth_token` HttpOnly cookie is set with `secure; samesite=lax`.
3. **Queue Acquisition:** Navigate to `/workstation` and click "Next Lead".
   - Verify lead lock is acquired and 5-minute timer begins countdown.
4. **Controlled Email Test:** Send 1 test email from `/email/compose` to a team test inbox.
   - Verify email arrives and thread appears in `/email/inbox`.
5. **DNC Safety Test:** Mark a test lead as `DNC`. Attempt to trigger email/SMS.
   - Verify action is blocked with `"Channel suppressed"`.

---

## 7. Rollback Procedure

If a critical issue occurs post-deployment:

```bash
# 1. Revert to previous Git commit
git checkout HEAD~1

# 2. Re-install & Re-build
npm ci --only=production
npm run build

# 3. Reload PM2 cluster with zero-downtime reload
pm2 reload minetech-outbound
```
