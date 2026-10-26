/* Contra III editor — the asset scripts in bank $05 that load compressed graphics (and sound) into the machine.

   $00:90A8 reads a script at $05:xxxx: a type byte (0 BG, through the $1300 stream frame into $7E:2400; 1 OBJ,
   through $1340 into $7E:2800; 2 and up: other loaders), a flags byte (bit 0: decode in the background, a chunk
   per frame), then entries [destination word][24-bit pointer to an LZSS stream] until a $FFFF word.
   The roots below are the script addresses the code loads (LDX #imm before JSL $0090A8) and the word tables it
   indexes (by stage $86, by mode, ...). */
'use strict';
if (typeof require === 'function') var { snesParaArquivo, le16 } = require('./rom.js');

const RAIZES_SCRIPT = [
  { ender: 0xF55B, onde: '$00:809C (boot)' },
  { ender: 0xCF41, onde: '$00:A75C' },
  { ender: 0x8527, onde: '$00:B108' }, { ender: 0x8530, onde: '$00:B10F' },
  { ender: 0x8539, onde: '$00:B116' }, { ender: 0x8542, onde: '$00:B11D' },
  { ender: 0x87AB, onde: '$00:B524' }, { ender: 0x8976, onde: '$00:BC68' },
  { ender: 0x8ADD, onde: '$00:BEB3' }, { ender: 0x8AD4, onde: '$00:BEBA' },
];
/* word tables of script addresses; the length is not known from the code, so entries are read while they parse */
const TABELAS_SCRIPT = [
  { ender: 0x87F1, onde: '$00:B6BC', indice: 'fase ($86)' },
  { ender: 0x88E1, onde: '$00:B9AB', indice: '$008942' },
  { ender: 0x88ED, onde: '$00:B9B5', indice: '$008942' },
  { ender: 0x85CB, onde: '$00:B2EA', indice: '$1E48' },
  { ender: 0x8A0D, onde: '$00:BEC4', indice: '$1670' },
  { ender: 0x9E4A, onde: '$00:D082', indice: 'tabela' },
];
const TIPOS_SCRIPT = ['tipo 0 (quadro $1300)', 'tipo 1 (quadro $1340)', 'tipo 2'];

/* parses the script at $05:ender; returns null when it does not look like one */
function lerScript(rom, ender) {
  let p = snesParaArquivo(0x050000 | ender);
  if (p < 0) return null;
  const tipo = rom[p], flags = rom[p + 1], entradas = [];
  if (tipo > 7) return null;
  p += 2;
  for (let k = 0; k < 64; k++) {
    if ((p & 0x7FFF) > 0x7FFB) return null;
    const destino = le16(rom, p);
    if (destino === 0xFFFF) return { ender, tipo, flags, entradas };
    const ponteiro = le16(rom, p + 2) | rom[p + 4] << 16, pos = snesParaArquivo(ponteiro);
    if (pos < 0) return null;
    const fim = le16(rom, pos);
    if (fim < 3 || (pos & 0x7FFF) + fim > 0x8000) return null;    // a stream never crosses its bank
    entradas.push({ destino, ponteiro, pos, tamanho: fim });
    p += 5;
  }
  return null;
}

/* every script reachable from the known roots and tables, without repeats */
function listarScripts(rom) {
  const vistos = new Map();
  const juntar = (ender, onde) => { if (vistos.has(ender)) return true; const s = lerScript(rom, ender); if (!s) return false; s.onde = onde; vistos.set(ender, s); return true; };
  for (const r of RAIZES_SCRIPT) juntar(r.ender, r.onde);
  for (const t of TABELAS_SCRIPT) {
    const p = snesParaArquivo(0x050000 | t.ender);
    for (let i = 0; i < 16; i++) {
      const ender = le16(rom, p + 2 * i);
      if (ender < 0x8000 || !juntar(ender, `${t.onde} [${t.indice} ${i}]`)) break;
    }
  }
  return [...vistos.values()];
}

if (typeof module !== 'undefined') module.exports = { RAIZES_SCRIPT, TABELAS_SCRIPT, TIPOS_SCRIPT, lerScript, listarScripts };

/* writes a re-encoded stream over the old one, in place. It must fit in the old stream's bytes: moving a stream
   means rewriting its pointer and finding free space, which comes later. */
function regravarFluxo(rom, pos, novo, tamanhoAntigo) {
  if (novo.length > tamanhoAntigo) throw new Error(`nao cabe:${novo.length}:${tamanhoAntigo}`);
  rom.set(novo, pos);
  return tamanhoAntigo - novo.length;
}
if (typeof module !== 'undefined') module.exports.regravarFluxo = regravarFluxo;
