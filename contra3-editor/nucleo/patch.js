/* Contra III editor — patches. An edit is shared as an IPS patch made against the original ROM, so it carries
   only the changed bytes and nobody's copy of the game. */
'use strict';

/* IPS from the original to the edited ROM (same size) */
function criarIps(original, editada) {
  if (original.length !== editada.length) throw new Error('ips: tamanhos diferentes');
  const out = [0x50, 0x41, 0x54, 0x43, 0x48];   // PATCH
  let i = 0;
  while (i < editada.length) {
    if (original[i] === editada[i]) { i++; continue; }
    // an offset spelling "EOF" would end the patch early: start one byte sooner
    let ini = i === 0x454F46 ? i - 1 : i, fim = i;
    // a record ends at 6 equal bytes in a row (cheaper to start a new one) or at 65535 bytes
    let iguais = 0;
    while (fim < editada.length && fim - ini < 0xFFFF) {
      if (original[fim] === editada[fim]) { if (++iguais > 6) break; } else iguais = 0;
      fim++;
    }
    fim -= Math.min(iguais, fim - ini - 1);
    const n = fim - ini;
    out.push(ini >> 16 & 0xFF, ini >> 8 & 0xFF, ini & 0xFF, n >> 8, n & 0xFF);
    for (let k = ini; k < fim; k++) out.push(editada[k]);
    i = fim;
  }
  out.push(0x45, 0x4F, 0x46);   // EOF
  return Uint8Array.from(out);
}

/* applies an IPS (records and RLE records) to a copy of rom */
function aplicarIps(rom, ips) {
  const txt = String.fromCharCode(...ips.subarray(0, 5));
  if (txt !== 'PATCH') throw new Error('ips: cabecalho');
  const out = new Uint8Array(rom);
  let p = 5;
  for (;;) {
    if (p + 3 > ips.length) throw new Error('ips: cortado');
    const pos = ips[p] << 16 | ips[p + 1] << 8 | ips[p + 2]; p += 3;
    if (pos === 0x454F46) return out;
    let n = ips[p] << 8 | ips[p + 1]; p += 2;
    if (n === 0) { n = ips[p] << 8 | ips[p + 1]; out.fill(ips[p + 2], pos, pos + n); p += 3; }
    else { out.set(ips.subarray(p, p + n), pos); p += n; }
  }
}

if (typeof module !== 'undefined') module.exports = { criarIps, aplicarIps };
