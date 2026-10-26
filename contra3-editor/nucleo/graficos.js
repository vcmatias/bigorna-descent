/* Contra III editor — SNES graphics: planar tiles, BGR555 colours and the game's sprite frames. */
'use strict';

/* bytes per 8x8 tile at 2, 4 or 8 bits per pixel */
function bytesPorTile(bpp) { return bpp * 8; }

/* one tile's 64 colour indices. SNES planar: bitplanes come in pairs, row by row (planes 0/1 in bytes 0-15,
   planes 2/3 in bytes 16-31, ...) */
function lerTile(dados, pos, bpp) {
  const px = new Uint8Array(64);
  for (let y = 0; y < 8; y++) for (let par = 0; par < bpp / 2; par++) {
    const b0 = dados[pos + par * 16 + y * 2] || 0, b1 = dados[pos + par * 16 + y * 2 + 1] || 0;
    for (let x = 0; x < 8; x++) {
      const m = 0x80 >> x;
      px[y * 8 + x] |= ((b0 & m ? 1 : 0) | (b1 & m ? 2 : 0)) << (par * 2);
    }
  }
  return px;
}
/* writes 64 indices back as one planar tile */
function escreverTile(dados, pos, bpp, px) {
  for (let par = 0; par < bpp / 2; par++) for (let y = 0; y < 8; y++) {
    let b0 = 0, b1 = 0;
    for (let x = 0; x < 8; x++) {
      const v = px[y * 8 + x] >> (par * 2);
      if (v & 1) b0 |= 0x80 >> x;
      if (v & 2) b1 |= 0x80 >> x;
    }
    dados[pos + par * 16 + y * 2] = b0; dados[pos + par * 16 + y * 2 + 1] = b1;
  }
}

/* BGR555 word -> [r, g, b] 0-255, and back */
function corDe555(w) { const c = v => (v << 3) | (v >> 2); return [c(w & 31), c(w >> 5 & 31), c(w >> 10 & 31)]; }
function corPara555(r, g, b) { return (r >> 3) | (g >> 3) << 5 | (b >> 3) << 10; }
/* n colours read from raw BGR555 words at pos */
function lerPaleta(dados, pos, n) { const l = []; for (let i = 0; i < n; i++) l.push(corDe555((dados[pos + 2 * i] | dados[pos + 2 * i + 1] << 8) & 0x7FFF)); return l; }
/* a grey ramp for looking at tiles before the right palette is known */
function paletaCinza(bpp) { const n = 1 << bpp; return Array.from({ length: n }, (_, i) => { const v = Math.round(i * 255 / (n - 1)); return [v, v, v]; }); }

/* a sprite frame as $00:EB1A builds it into OAM (data bank $06): a count byte, then 4 bytes per piece
   [x offset s8][y offset s8][tile][attributes vhppccct]. The actor's own attribute bits are ORed in; bit 5 of
   the attribute byte also selects the large sprite size in the OAM high table. */
function lerQuadroSprite(rom, pos) {
  const s8 = v => v > 127 ? v - 256 : v;
  const n = rom[pos], pecas = [];
  if (n === 0 || n > 64) return null;
  for (let i = 0; i < n; i++) {
    const p = pos + 1 + 4 * i, atr = rom[p + 3];
    pecas.push({ x: s8(rom[p]), y: s8(rom[p + 1]), tile: rom[p + 2] | (atr & 1) << 8, paleta: atr >> 1 & 7, prioridade: atr >> 4 & 3, grande: !!(atr & 0x20), hflip: !!(atr & 0x40), vflip: !!(atr & 0x80) });
  }
  return { pecas, tamanho: 1 + 4 * n };
}

if (typeof module !== 'undefined') module.exports = { bytesPorTile, lerTile, escreverTile, corDe555, corPara555, lerPaleta, paletaCinza, lerQuadroSprite };
