import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptionConfig {
  enabled: boolean;
  key: Buffer;
  keyVersion: number;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

class EncryptionService {
  private config: EncryptionConfig | null = null;

  initialize(config: EncryptionConfig) {
    if (config.enabled && config.key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes for AES-256');
    }
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config?.enabled ?? false;
  }

  encrypt(plaintext: string): EncryptedData {
    if (!this.config || !this.config.enabled) {
      throw new Error('Encryption is not enabled');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.config.key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.config.keyVersion,
    };
  }

  decrypt(encrypted: EncryptedData): string {
    if (!this.config || !this.config.enabled) {
      throw new Error('Encryption is not enabled');
    }

    // In production, you would fetch the correct key based on keyVersion
    // For now, we assume the current key can decrypt
    if (encrypted.keyVersion !== this.config.keyVersion) {
      console.warn(
        `Decrypting with key version ${encrypted.keyVersion}, current version is ${this.config.keyVersion}`
      );
    }

    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.config.key, iv);

    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  // Helper to encrypt message body for database storage
  encryptMessage(body: string): {
    body: string;
    encrypted: boolean;
    keyVersion: number | null;
    iv: string | null;
    authTag: string | null;
  } {
    if (!this.isEnabled()) {
      return {
        body,
        encrypted: false,
        keyVersion: null,
        iv: null,
        authTag: null,
      };
    }

    const encrypted = this.encrypt(body);
    return {
      body: encrypted.ciphertext,
      encrypted: true,
      keyVersion: encrypted.keyVersion,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    };
  }

  // Helper to decrypt message body from database
  decryptMessage(data: {
    body: string;
    encrypted: boolean;
    keyVersion: number | null;
    iv: string | null;
    authTag: string | null;
  }): string {
    if (!data.encrypted) {
      return data.body;
    }

    if (!data.iv || !data.authTag || data.keyVersion === null) {
      throw new Error('Invalid encrypted message data');
    }

    return this.decrypt({
      ciphertext: data.body,
      iv: data.iv,
      authTag: data.authTag,
      keyVersion: data.keyVersion,
    });
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();

// Helper to initialize from environment variables
export function initializeEncryptionFromEnv() {
  const enabled = process.env.CHAT_ENCRYPTION_ENABLED === 'true';
  const keyString = process.env.CHAT_MESSAGE_KEY || '';

  let key: Buffer;
  if (enabled) {
    if (!keyString) {
      throw new Error('CHAT_MESSAGE_KEY is required when encryption is enabled');
    }

    // Support base64: prefix
    if (keyString.startsWith('base64:')) {
      key = Buffer.from(keyString.slice(7), 'base64');
    } else {
      key = Buffer.from(keyString, 'utf8');
    }

    if (key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes');
    }
  } else {
    // Dummy key when encryption is disabled
    key = Buffer.alloc(32);
  }

  encryptionService.initialize({
    enabled,
    key,
    keyVersion: 1,
  });

  console.log(`Encryption ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

