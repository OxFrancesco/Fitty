export type EncryptedJson = {
  ciphertext: string;
  iv: string;
  version: 1;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return base64Decode(padded);
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getAesKey(secret: string): Promise<CryptoKey> {
  const trimmed = secret.trim();
  let keyBytes: Uint8Array | undefined;

  try {
    const decoded = base64Decode(trimmed);
    if (decoded.byteLength === 16 || decoded.byteLength === 24 || decoded.byteLength === 32) {
      keyBytes = decoded;
    }
  } catch {
    keyBytes = undefined;
  }

  if (!keyBytes) {
    keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(trimmed)));
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", textEncoder.encode(secret), { hash: "SHA-256", name: "HMAC" }, false, [
    "sign",
    "verify"
  ]);
}

export async function encryptJson(value: unknown, secret: string): Promise<EncryptedJson> {
  const key = await getAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ iv, name: "AES-GCM" }, key, plaintext);

  return {
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
    iv: base64Encode(iv),
    version: 1
  };
}

export async function decryptJson<T>(encrypted: EncryptedJson, secret: string): Promise<T> {
  if (encrypted.version !== 1) {
    throw new Error("Unsupported encrypted payload version");
  }

  const key = await getAesKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { iv: toArrayBuffer(base64Decode(encrypted.iv)), name: "AES-GCM" },
    key,
    toArrayBuffer(base64Decode(encrypted.ciphertext))
  );

  return JSON.parse(textDecoder.decode(plaintext)) as T;
}

export async function signJson(payload: Record<string, unknown>, secret: string): Promise<string> {
  const body = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySignedJson<T extends Record<string, unknown>>(
  token: string,
  secret: string,
  maxAgeMs: number
): Promise<T> {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    throw new Error("Malformed signed payload");
  }

  const key = await getHmacKey(secret);
  const expected = await crypto.subtle.sign("HMAC", key, textEncoder.encode(body));
  const expectedSignature = base64UrlEncode(new Uint8Array(expected));
  if (!(await secureEqual(signature, expectedSignature))) {
    throw new Error("Invalid signed payload");
  }

  const payload = JSON.parse(textDecoder.decode(base64UrlDecode(body))) as T;
  const createdAt = payload.createdAt;
  if (typeof createdAt !== "number" || Date.now() - createdAt > maxAgeMs) {
    throw new Error("Expired signed payload");
  }

  return payload;
}

export async function secureEqual(left: string | undefined, right: string | undefined): Promise<boolean> {
  if (!left || !right) {
    return false;
  }

  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(left)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(right))
  ]);

  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let diff = left.length === right.length ? 0 : 1;

  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }

  return diff === 0;
}

export async function stableHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return base64UrlEncode(new Uint8Array(digest)).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
