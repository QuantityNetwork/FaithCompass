import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM envelope for secrets at rest (webhook signing secrets, provider
 * credentials). Format: v1.<iv>.<tag>.<ciphertext>, base64url segments.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
    this.key = key;
  }

  static fromBase64(value: string): SecretBox {
    return new SecretBox(Buffer.from(value, "base64"));
  }

  static ephemeral(): SecretBox {
    return new SecretBox(randomBytes(32));
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
  }

  decrypt(envelope: string): string {
    const [version, iv, tag, data] = envelope.split(".");
    if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported secret envelope");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  }
}
