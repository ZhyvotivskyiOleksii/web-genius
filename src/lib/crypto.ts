import { randomBytes, createDecipheriv, createCipheriv } from "crypto";

const keyB64 = process.env.ENCRYPTION_KEY || ""; // 32 bytes base64 recommended
const key = keyB64 ? Buffer.from(keyB64, "base64") : undefined;

export function encryptText(plain: string): string {
  if (!key) return plain; // fallback without encryption
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptText(encB64: string): string {
  if (!key) return encB64;
  const buf = Buffer.from(encB64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

