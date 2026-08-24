/**
 * Web Push implementation using Web Crypto API (Cloudflare Worker compatible).
 * Implements RFC 8291 (content encryption) + RFC 8188 (aes128gcm) + VAPID (RFC 8292).
 * No Node crypto.createECDH dependency.
 */

const TE = new TextEncoder();

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  const padded = b64 + "=".repeat(padLen);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Ensure a Uint8Array is backed by a plain ArrayBuffer (TS 5.7+ BufferSource fix). */
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToB64url(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Import the VAPID private key (raw 32-byte scalar) as a Web Crypto ECDSA key. */
async function getVapidSigningKey(): Promise<CryptoKey> {
  const privB64 = process.env["VAPID_PRIVATE_KEY"]!;
  const pubB64 = process.env["VAPID_PUBLIC_KEY"]!;
  // Public key is 65 bytes: 0x04 || x(32) || y(32) — extract coordinates for JWK
  const pubBytes = b64urlToBytes(pubB64);
  const x = bytesToB64url(pubBytes.slice(1, 33));
  const y = bytesToB64url(pubBytes.slice(33, 65));
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: privB64, x, y },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** Create a VAPID JWT for the given push-service origin. */
async function createVapidJwt(audience: string): Promise<string> {
  const subject = process.env["VAPID_SUBJECT"]!;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };
  const headerB64 = bytesToB64url(TE.encode(JSON.stringify(header)));
  const payloadB64 = bytesToB64url(TE.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const key = await getVapidSigningKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, TE.encode(signingInput)),
  );
  return `${signingInput}.${bytesToB64url(sig)}`;
}

/** Import a subscriber's p256dh public key (65-byte uncompressed) as ECDH key. */
async function importSubPublicKey(p256dh: string): Promise<CryptoKey> {
  const pubBytes = b64urlToBytes(p256dh);
  const x = bytesToB64url(pubBytes.slice(1, 33));
  const y = bytesToB64url(pubBytes.slice(33, 65));
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y },
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

/**
 * Encrypt a payload per RFC 8291 (aes128gcm content encoding).
 * Returns the full record: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext+tag
 */
async function encryptPayload(
  p256dh: string,
  auth: string,
  payload: string,
): Promise<Uint8Array> {
  // 1. Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey),
  ); // 65 bytes

  // 2. Derive shared secret
  const subPubKey = await importSubPublicKey(p256dh);
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subPubKey },
      ephemeral.privateKey,
      256,
    ),
  );

  // 3. Derive IKM: HKDF(salt=auth_secret, ikm=shared_secret,
  //    info="WebPush: info\0" || sub_pub_raw || server_pub_raw, 32 bytes)
  const authSecret = b64urlToBytes(auth);
  const subPubRaw = b64urlToBytes(p256dh);
  const webpushInfo = concatBytes(
    TE.encode("WebPush: info"),
    new Uint8Array([0]),
    subPubRaw,
    serverPubRaw,
  );
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, [
    "deriveBits",
  ]);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret, info: webpushInfo },
      ikmKey,
      256,
    ),
  );

  // 4. Generate random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. Derive CEK (16 bytes) and nonce base (12 bytes)
  const ikmKey2 = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const cekInfo = concatBytes(TE.encode("Content-Encoding: aes128gcm"), new Uint8Array([0]));
  const nonceInfo = concatBytes(TE.encode("Content-Encoding: nonce"), new Uint8Array([0]));
  const cek = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
      ikmKey2,
      128,
    ),
  );
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
      ikmKey2,
      96,
    ),
  );

  // 6. Pad payload: payload || 0x02 (last-record delimiter, pad=0)
  const payloadBytes = TE.encode(payload);
  const plaintext = new Uint8Array(payloadBytes.length + 1);
  plaintext.set(payloadBytes, 0);
  plaintext[payloadBytes.length] = 2;

  // 7. Encrypt with AES-128-GCM (Web Crypto returns ciphertext || auth_tag)
  const cekKey = await crypto.subtle.importKey("raw", buf(cek), "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, cekKey, buf(plaintext)),
  );

  // 8. Construct record: salt(16) || rs(4=4096) || idlen(1=65) || keyid(65) || encrypted
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, rs, new Uint8Array([65]), serverPubRaw);
  return concatBytes(header, encrypted);
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export type PushResult = { endpoint: string; status: number; ok: boolean };

/**
 * Send a Web Push message to a single subscription.
 * Returns the HTTP status from the push service.
 */
export async function sendWebPush(
  sub: PushSubscriptionRow,
  payload: object,
  ttlSeconds = 2419200,
): Promise<PushResult> {
  const audience = new URL(sub.endpoint).origin;
  const jwt = await createVapidJwt(audience);
  const publicKey = process.env["VAPID_PUBLIC_KEY"]!;
  const body = await encryptPayload(sub.p256dh, sub.auth_key, JSON.stringify(payload));

  const response = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
    },
    body: body.buffer,
  });

  return { endpoint: sub.endpoint, status: response.status, ok: response.ok };
}

/**
 * Send a push to all active subscriptions of given users.
 * Deactivates subscriptions that return 410 Gone or 404.
 * Returns per-subscription results.
 */
export async function sendPushToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: object,
): Promise<PushResult[]> {
  const results: PushResult[] = [];
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const result = await sendWebPush(sub, payload);
        results.push(result);
      } catch (err) {
        results.push({ endpoint: sub.endpoint, status: 0, ok: false });
        console.error("[push] send error:", err);
      }
    }),
  );
  return results;
}

/** Endpoints returning these statuses should be deactivated. */
export function shouldDeactivate(status: number): boolean {
  return status === 410 || status === 404 || status === 0;
}
