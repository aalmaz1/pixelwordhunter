/**
 * The full-test explanations use many syllables absent from the old subset.
 * Read the WOFF2 cmap with Node's built-in Brotli decoder so an accidental
 * re-subset cannot silently turn Korean into missing-glyph boxes on a device
 * without a Korean system font.
 */
import { expect, it } from 'vitest';
import fs from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';

// WOFF2 standard tag indices. Other tags use index 63 and carry four bytes.
const TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

function getCmap(font) {
  if (font.toString('ascii', 0, 4) !== 'wOF2') throw new Error('Expected a WOFF2 font');
  let cursor = 48;
  let uncompressedOffset = 0;
  let cmapOffset = null;
  let cmapLength = 0;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i += 1) {
      const byte = font[cursor++];
      value = value * 128 + (byte & 0x7f);
      if (!(byte & 0x80)) return value;
    }
    throw new Error('Invalid WOFF2 length');
  };
  const count = font.readUInt16BE(12);
  for (let i = 0; i < count; i += 1) {
    const flags = font[cursor++];
    const tagIndex = flags & 63;
    const tag = tagIndex === 63 ? font.toString('ascii', cursor, cursor + 4) : TAGS[tagIndex];
    if (tagIndex === 63) cursor += 4;
    let length = base128();
    const version = flags >> 6;
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    if (transformed) length = base128();
    if (tag === 'cmap') {
      if (transformed) throw new Error('Unexpected transformed cmap');
      cmapOffset = uncompressedOffset;
      cmapLength = length;
    }
    uncompressedOffset += length;
  }
  if (cmapOffset === null) throw new Error('Font has no cmap');
  const compressedLength = font.readUInt32BE(20);
  const data = brotliDecompressSync(font.subarray(cursor, cursor + compressedLength));
  return data.subarray(cmapOffset, cmapOffset + cmapLength);
}

function bmpGlyphChecker(cmap) {
  const recordCount = cmap.readUInt16BE(2);
  let table = -1;
  for (let i = 0; i < recordCount; i += 1) {
    const record = 4 + i * 8;
    const platform = cmap.readUInt16BE(record);
    const offset = cmap.readUInt32BE(record + 4);
    if ((platform === 0 || platform === 3) && cmap.readUInt16BE(offset) === 4) {
      table = offset;
      break;
    }
  }
  if (table < 0) throw new Error('Font has no Unicode BMP cmap');
  const count = cmap.readUInt16BE(table + 6) / 2;
  const ends = table + 14;
  const starts = ends + count * 2 + 2;
  const deltas = starts + count * 2;
  const offsets = deltas + count * 2;
  return (code) => {
    // Sorted end codes allow a binary search even for a full Hangul font.
    let low = 0, high = count;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (cmap.readUInt16BE(ends + middle * 2) < code) low = middle + 1;
      else high = middle;
    }
    if (low === count || code < cmap.readUInt16BE(starts + low * 2)) return false;
    const start = cmap.readUInt16BE(starts + low * 2);
    const delta = cmap.readInt16BE(deltas + low * 2);
    const range = cmap.readUInt16BE(offsets + low * 2);
    if (!range) return ((code + delta) & 0xffff) !== 0;
    const glyphOffset = offsets + low * 2 + range + (code - start) * 2;
    const glyph = cmap.readUInt16BE(glyphOffset);
    return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
  };
}

it('bundles glyphs for all modern Korean syllables', () => {
  const font = fs.readFileSync('assets/Mulmaru.woff2');
  const hasGlyph = bmpGlyphChecker(getCmap(font));
  const missing = [];
  for (let code = 0xac00; code <= 0xd7a3; code += 1) {
    if (!hasGlyph(code)) missing.push(String.fromCodePoint(code));
  }
  expect(missing, 'missing Hangul glyphs').toEqual([]);
});
