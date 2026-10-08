import { config } from 'dotenv';
config();

console.log('\n--- LIVE CREDENTIALS DISCOVERY ---');
const hasMongo = Boolean(process.env.MONGODB_URI);
const hasTwilio = Boolean(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
  !process.env.TWILIO_ACCOUNT_SID.includes('your_') &&
  process.env.TWILIO_AUTH_TOKEN &&
  !process.env.TWILIO_AUTH_TOKEN.includes('your_')
);
const hasResend = Boolean(
  process.env.RESEND_API_KEY &&
  process.env.RESEND_API_KEY.startsWith('re_') &&
  !process.env.RESEND_API_KEY.includes('your_')
);
const hasAnthropic = Boolean(
  process.env.ANTHROPIC_API_KEY &&
  process.env.ANTHROPIC_API_KEY.startsWith('sk-ant') &&
  !process.env.ANTHROPIC_API_KEY.includes('your_')
);

console.log(`MongoDB URI Configured:      ${hasMongo ? 'YES (Live Database Connected)' : 'NO'}`);
console.log(`Live Twilio Configured:       ${hasTwilio ? 'YES' : 'NO (Credentials Not Available)'}`);
console.log(`Live Resend Configured:       ${hasResend ? 'YES' : 'NO (Credentials Not Available)'}`);
console.log(`Live Anthropic Configured:    ${hasAnthropic ? 'YES' : 'NO (Credentials Not Available)'}`);
console.log('----------------------------------\n');
