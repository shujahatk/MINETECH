import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: DATA_ENCRYPTION_KEY or JWT_SECRET must be defined for secure encryption operations.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt sensitive plain text using AES-256-GCM authenticated encryption
 */
export function encryptSensitiveData(plainText) {
  if (!plainText || typeof plainText !== 'string') return plainText;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM encrypted string
 */
export function decryptSensitiveData(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) {
    return cipherText;
  }
  
  try {
    const [ivHex, tagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !tagHex || !encryptedHex) return cipherText;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.warn('[Encryption] Failed to decrypt string payload:', err.message);
    return cipherText;
  }
}

export default {
  encryptSensitiveData,
  decryptSensitiveData,
};
