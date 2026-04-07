import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, hash, createVersion, sign, verify, generateKeyPair, diff } from '../src/index.js';

const SOURCE = 'https://example.com/page';
const CONTENT = '# Hello\nThis is a skill (recette).';

describe('encode / decode', () => {
  it('round-trip plain', async () => {
    const url = await encode(SOURCE, CONTENT);
    assert(url.includes('?hs='));
    const { url: src, content } = await decode(url);
    assert.equal(content, CONTENT);
    assert.equal(src, SOURCE);
  });

  it('round-trip gzip', async () => {
    const url = await encode(SOURCE, CONTENT, { compress: 'gz' });
    assert(url.includes('?hs=gz.'));
    const { content } = await decode(url);
    assert.equal(content, CONTENT);
  });

  it('round-trip brotli (Node.js)', async () => {
    const url = await encode(SOURCE, CONTENT, { compress: 'br' });
    assert(url.includes('?hs=br.'));
    const { content } = await decode(url);
    assert.equal(content, CONTENT);
  });

  it('handles UTF-8', async () => {
    const utf8 = 'Ça marche avec les accents et 日本語 🚀';
    const url = await encode(SOURCE, utf8);
    const { content } = await decode(url);
    assert.equal(content, utf8);
  });

  it('decode raw param', async () => {
    const url = await encode(SOURCE, CONTENT);
    const param = new URL(url).searchParams.get('hs');
    const { content } = await decode(param);
    assert.equal(content, CONTENT);
  });
});

describe('hash', () => {
  it('returns 64-char hex', async () => {
    const h = await hash(SOURCE, CONTENT);
    assert.equal(h.length, 64);
    assert(/^[0-9a-f]+$/.test(h));
  });

  it('is deterministic', async () => {
    const h1 = await hash(SOURCE, CONTENT);
    const h2 = await hash(SOURCE, CONTENT);
    assert.equal(h1, h2);
  });

  it('changes with previousHash (chaining)', async () => {
    const h1 = await hash(SOURCE, CONTENT);
    const h2 = await hash(SOURCE, CONTENT, h1);
    assert.notEqual(h1, h2);
  });
});

describe('createVersion', () => {
  it('contains hash, timestamp, url, content', async () => {
    const v = await createVersion(SOURCE, CONTENT);
    assert.equal(v.url, SOURCE);
    assert.equal(v.content, CONTENT);
    assert.equal(v.hash.length, 64);
    assert.ok(v.timestamp > 0);
  });
});

describe('sign / verify', () => {
  it('round-trip', async () => {
    const kp = await generateKeyPair();
    const h = await hash(SOURCE, CONTENT);
    const sig = await sign(h, kp.privateKey);
    const ok = await verify(h, sig, kp.publicKey);
    assert.equal(ok, true);
  });

  it('rejects wrong signature', async () => {
    const kp = await generateKeyPair();
    const h = await hash(SOURCE, CONTENT);
    const sig = await sign(h, kp.privateKey);
    const tampered = sig.slice(0, -4) + 'AAAA';
    const ok = await verify(h, tampered, kp.publicKey);
    assert.equal(ok, false);
  });
});

describe('diff', () => {
  it('detects changed keys', () => {
    const changed = diff({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 });
    assert.deepEqual(changed.sort(), ['b', 'c']);
  });

  it('returns empty for equal objects', () => {
    assert.deepEqual(diff({ a: 1 }, { a: 1 }), []);
  });
});
