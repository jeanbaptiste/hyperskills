/**
 * hyperskills — Encode and decode hyperskills (skills/recipes in URLs)
 * Spec: https://hyperskills.net
 *
 * Format: source_url?hs=BASE64_CONTENT
 * Compression: prefix "gz." (gzip) or "br." (brotli, Node.js only)
 * Traceability: SHA-256(sourceUrl + content [+ previousHash])
 * Signature: Ed25519 via crypto.subtle
 */

// --- Helpers ---

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64) {
  // Normalize base64url → base64 standard
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function compressGzip(bytes) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function decompressGzip(bytes) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  return new Response(ds.readable).text();
}

async function compressBrotli(bytes) {
  // Node.js only — CompressionStream does not support brotli
  const { brotliCompress } = await import('node:zlib');
  const { promisify } = await import('node:util');
  const buf = await promisify(brotliCompress)(Buffer.from(bytes));
  return new Uint8Array(buf);
}

async function decompressBrotli(bytes) {
  const { brotliDecompress } = await import('node:zlib');
  const { promisify } = await import('node:util');
  const buf = await promisify(brotliDecompress)(Buffer.from(bytes));
  return buf.toString('utf-8');
}

// --- Public API ---

/**
 * Encode a skill into a hyperskill URL.
 *
 * @param {string} sourceUrl - The URL where the skill applies
 * @param {string} content - Free-form content: Markdown, SQL, YAML, HTML, text
 * @param {{ compress?: 'gz' | 'br' }} [options]
 *   - compress: 'gz' (gzip, browser + Node) | 'br' (brotli, Node.js only)
 * @returns {Promise<string>} Hyperskill URL
 */
export async function encode(sourceUrl, content, options = {}) {
  const { compress } = options;
  const bytes = new TextEncoder().encode(content);
  let param;

  if (compress === 'gz') {
    const compressed = await compressGzip(bytes);
    param = 'gz.' + btoa(String.fromCharCode(...compressed));
  } else if (compress === 'br') {
    const compressed = await compressBrotli(bytes);
    param = 'br.' + btoa(String.fromCharCode(...compressed));
  } else {
    param = toBase64(content);
  }

  const url = new URL(sourceUrl);
  url.searchParams.set('hs', param);
  return url.toString();
}

/**
 * Decode a hyperskill URL or raw ?hs= param value.
 *
 * @param {string} urlOrParam - Full URL or raw base64 param
 * @returns {Promise<{ url: string, content: string }>}
 */
export async function decode(urlOrParam) {
  let param;
  let sourceUrl = '';

  try {
    const url = new URL(urlOrParam, typeof window !== 'undefined' ? window.location.href : 'https://example.com');
    param = url.searchParams.get('hs') ?? urlOrParam;
    url.searchParams.delete('hs');
    sourceUrl = url.toString().replace(/[?&]$/, '');
  } catch {
    param = urlOrParam;
  }

  let content;

  if (param.startsWith('gz.')) {
    const bytes = Uint8Array.from(atob(param.slice(3)), c => c.charCodeAt(0));
    content = await decompressGzip(bytes);
  } else if (param.startsWith('br.')) {
    const bytes = Uint8Array.from(atob(param.slice(3)), c => c.charCodeAt(0));
    content = await decompressBrotli(bytes);
  } else {
    content = fromBase64(param);
  }

  return { url: sourceUrl, content };
}

/**
 * Compute SHA-256 hash of sourceUrl + content (+ optional previousHash for chaining).
 *
 * @param {string} sourceUrl
 * @param {string} content
 * @param {string} [previousHash]
 * @returns {Promise<string>} 64-char hex string
 */
export async function hash(sourceUrl, content, previousHash) {
  const text = sourceUrl + content + (previousHash ?? '');
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a versioned snapshot of a skill with hash and optional chain.
 *
 * @param {string} sourceUrl
 * @param {string} content
 * @param {string} [previousHash]
 * @returns {Promise<{ hash: string, previousHash?: string, timestamp: number, url: string, content: string }>}
 */
export async function createVersion(sourceUrl, content, previousHash) {
  const h = await hash(sourceUrl, content, previousHash);
  return { hash: h, previousHash, timestamp: Date.now(), url: sourceUrl, content };
}

/**
 * Sign a hash with an Ed25519 private key.
 *
 * @param {string} hashHex - 64-char hex string from hash()
 * @param {CryptoKey} privateKey - Ed25519 CryptoKey
 * @returns {Promise<string>} base64 signature
 */
export async function sign(hashHex, privateKey) {
  const bytes = new TextEncoder().encode(hashHex);
  const sig = await crypto.subtle.sign('Ed25519', privateKey, bytes);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Verify an Ed25519 signature.
 *
 * @param {string} hashHex - 64-char hex string from hash()
 * @param {string} signatureB64 - base64 signature from sign()
 * @param {CryptoKey} publicKey - Ed25519 CryptoKey
 * @returns {Promise<boolean>}
 */
export async function verify(hashHex, signatureB64, publicKey) {
  const bytes = new TextEncoder().encode(hashHex);
  const sig = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  return crypto.subtle.verify('Ed25519', publicKey, sig, bytes);
}

/**
 * Generate an Ed25519 key pair for signing.
 *
 * @returns {Promise<{ privateKey: CryptoKey, publicKey: CryptoKey }>}
 */
export async function generateKeyPair() {
  return crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
}

/**
 * Get the ?hs= param from the current browser URL.
 * Returns null in Node.js or if param is absent.
 *
 * @returns {string|null}
 */
export function getHsParam() {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('hs');
}

/**
 * Shallow diff two objects — returns changed key names.
 *
 * @param {unknown} prev
 * @param {unknown} next
 * @returns {string[]}
 */
export function diff(prev, next) {
  if (typeof prev !== 'object' || typeof next !== 'object' || !prev || !next) {
    return prev !== next ? ['(root)'] : [];
  }
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  return [...keys].filter(k => JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
}
