import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

// A save is about 3 MB of JSON. Browsers cap storage near 5 MB and Android's
// AsyncStorage defaults to 6 MB, so uncompressed saves would allow one or
// two slots. Deflate shrinks a save about 5x in under 100 ms on desktop.
// Base64 keeps the text safe for SQLite, which can cut strings at a null.
const PREFIX = 'z1:';
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(128);
for (let i = 0; i < ABC.length; i++) LOOKUP[ABC.charCodeAt(i)] = i;

function toBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  // Build in slices so String.fromCharCode never gets too many arguments.
  const SLICE = 3 * 8192;
  for (let start = 0; start < bytes.length; start += SLICE) {
    const end = Math.min(bytes.length, start + SLICE);
    const codes: number[] = [];
    for (let i = start; i < end; i += 3) {
      const n = (bytes[i] << 16) | ((i + 1 < end ? bytes[i + 1] : 0) << 8) | (i + 2 < end ? bytes[i + 2] : 0);
      codes.push(ABC.charCodeAt((n >> 18) & 63), ABC.charCodeAt((n >> 12) & 63));
      codes.push(i + 1 < end ? ABC.charCodeAt((n >> 6) & 63) : 61, i + 2 < end ? ABC.charCodeAt(n & 63) : 61);
    }
    parts.push(String.fromCharCode(...codes));
  }
  return parts.join('');
}

function fromBase64(text: string): Uint8Array {
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((text.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    const n = (LOOKUP[text.charCodeAt(i)] << 18) | (LOOKUP[text.charCodeAt(i + 1)] << 12) | (LOOKUP[text.charCodeAt(i + 2)] << 6) | LOOKUP[text.charCodeAt(i + 3)];
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

export function compress(text: string): string {
  return PREFIX + toBase64(deflateSync(strToU8(text), { level: 6 }));
}

// Plain text passes through, so saves written before compression still load.
export function decompress(text: string): string {
  return text.startsWith(PREFIX) ? strFromU8(inflateSync(fromBase64(text.slice(PREFIX.length)))) : text;
}
