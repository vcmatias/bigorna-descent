/* Contra III editor — Konami's LZSS, as the game decodes it at $00:949C / $00:94A9.

   A stream starts with a 16-bit end offset (counted from the stream's first byte); commands follow from offset 2
   and are read until that offset is reached. Output goes through a 1 KB ring that starts zeroed; the ring index is
   the output position & $3FF. Command byte B:
     $00-$7F  copy (B>>2)+2 bytes from the ring, starting at ((B&3)<<8 | next) - $3DF (& $3FF)
     $80-$9F  B&$1F literal bytes
     $A0-$BF  (B&$1F)+2 pairs: a $00, then one literal byte
     $C0-$DF  (B&$1F)+2 copies of the next byte
     $E0-$FF  (B&$1F)+2 zero bytes
   (ARCHITECTURE.md of the recomp swaps the $A0 and $E0 cases; the code at $00:9546 / $00:9587 is what counts.) */
'use strict';

const LZ_RING = 0x400, LZ_BASE = 0x3DF;

/* decodes the stream at file offset pos; returns the bytes and the stream's size in the ROM */
function descomprimir(rom, pos, limite = 0x10000) {
  const fim = rom[pos] | rom[pos + 1] << 8;
  if (fim < 2 || pos + fim > rom.length) throw new Error('lzss: fim invalido ' + fim);
  const anel = new Uint8Array(LZ_RING), saida = [];
  const por = b => { if (saida.length >= limite) throw new Error('lzss: saida grande demais'); anel[saida.length & 0x3FF] = b; saida.push(b); };
  let i = 2;
  const ler = () => { if (i >= fim) throw new Error('lzss: comando cortado'); return rom[pos + i++]; };
  while (i < fim) {
    const b = rom[pos + i++], n = b & 0x1F;
    if (b < 0x80) {
      let src = ((((b & 3) << 8) | ler()) - LZ_BASE) & 0x3FF;
      for (let k = (b >> 2) + 2; k > 0; k--) { por(anel[src]); src = (src + 1) & 0x3FF; }
    } else if (b < 0xA0) for (let k = 0; k < n; k++) por(ler());
    else if (b < 0xC0) for (let k = 0; k < n + 2; k++) { por(0); por(ler()); }
    else if (b < 0xE0) { const v = ler(); for (let k = 0; k < n + 2; k++) por(v); }
    else for (let k = 0; k < n + 2; k++) por(0);
  }
  return { dados: Uint8Array.from(saida), tamanho: fim };
}

/* encodes bytes into a stream the game decodes back exactly. Greedy: at each position it takes the command that
   saves the most bytes (window copy, byte run, zero run, zero/byte pairs), else grows a literal run. */
function comprimir(dados) {
  const n = dados.length, out = [0, 0], lit = [];
  const soltarLiterais = () => { for (let p = 0; p < lit.length; p += 31) { const c = lit.slice(p, p + 31); out.push(0x80 | c.length, ...c); } lit.length = 0; };
  const cadeias = new Map();   // 2-byte key -> positions, for window matches
  const chave = p => dados[p] << 8 | dados[p + 1];
  const anotar = p => { if (p + 1 >= n) return; const k = chave(p); let l = cadeias.get(k); if (!l) cadeias.set(k, l = []); l.push(p); };
  let p = 0;
  while (p < n) {
    let melhor = null;                                    // { ganho, cobre, bytes }
    const tentar = (cobre, bytes) => { const g = cobre - bytes.length; if (cobre >= 2 && (!melhor || g > melhor.ganho)) melhor = { ganho: g, cobre, bytes }; };
    // runs of one byte
    let r = 1; while (p + r < n && r < 33 && dados[p + r] === dados[p]) r++;
    if (r >= 2) tentar(r, dados[p] === 0 ? [0xE0 | (r - 2)] : [0xC0 | (r - 2), dados[p]]);
    // $00,x pairs
    let q = 0; while (p + 2 * q + 1 < n && q < 33 && dados[p + 2 * q] === 0) q++;
    if (q >= 2) tentar(2 * q, [0xA0 | (q - 2), ...Array.from({ length: q }, (_, k) => dados[p + 2 * k + 1])]);
    // window copy: the source is at most 1023 bytes back, and may overlap the output
    if (p + 1 < n) {
      const l = cadeias.get(chave(p)) || [];
      let melhorL = 0, melhorS = 0;
      for (let j = l.length - 1; j >= 0; j--) {
        const s = l[j]; if (p - s > 1023) break;
        let m = 0; while (m < 33 && p + m < n && dados[s + m] === dados[p + m]) m++;
        if (m > melhorL) { melhorL = m; melhorS = s; if (m === 33) break; }
      }
      if (melhorL >= 2) { const campo = ((melhorS & 0x3FF) + LZ_BASE) & 0x3FF; tentar(melhorL, [((melhorL - 2) << 2) | campo >> 8, campo & 0xFF]); }
    }
    // a command only pays when it saves bytes; a 2-byte copy inside a literal run costs the same as the literals
    if (melhor && melhor.ganho > 0) {
      soltarLiterais(); out.push(...melhor.bytes);
      for (let k = 0; k < melhor.cobre; k++) anotar(p + k);
      p += melhor.cobre;
    } else { lit.push(dados[p]); anotar(p); p++; }
  }
  soltarLiterais();
  if (out.length > 0xFFFF) throw new Error('lzss: fluxo grande demais');
  out[0] = out.length & 0xFF; out[1] = out.length >> 8;
  return Uint8Array.from(out);
}

if (typeof module !== 'undefined') module.exports = { descomprimir, comprimir };
