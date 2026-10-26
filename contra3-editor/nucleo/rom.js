/* Contra III editor — the ROM: loading, validation, LoROM addresses and the cartridge checksum.
   Only the player's own copy is ever read; nothing from the game ships with the editor. */
'use strict';

const ROM_TAMANHO = 0x100000;                 // 1 MB, 32 LoROM banks of 32 KB
const ROM_TITULO = 'CONTRA3 THE ALIEN WAR';   // internal header at $00:FFC0
const ROM_SHA256 = 'a93ea87fc835c530b5135c5294433d15eef6dbf656144b387e89ac19cf864996';

/* file offset of a LoROM address ($bb:8000-$bb:FFFF, banks $00-$1F and their $80-$9F mirrors), or -1 */
function snesParaArquivo(ender) {
  const banco = (ender >>> 16) & 0x7F, perto = ender & 0xFFFF;
  if (perto < 0x8000 || banco >= 0x20) return -1;
  return (banco << 15) | (perto & 0x7FFF);
}
/* the LoROM address of a file offset */
function arquivoParaSnes(pos) { return (((pos >>> 15) & 0x1F) << 16) | 0x8000 | (pos & 0x7FFF); }
function hex(n, d = 6) { return '$' + n.toString(16).toUpperCase().padStart(d, '0'); }
function hexSnes(ender) { return hex(ender >>> 16, 2) + ':' + hex(ender & 0xFFFF, 4).slice(1); }

/* the 16-bit cartridge checksum: the sum of every byte */
function somaRom(rom) { let s = 0; for (let i = 0; i < rom.length; i++) s += rom[i]; return s & 0xFFFF; }
function le16(rom, pos) { return rom[pos] | rom[pos + 1] << 8; }

/* writes checksum and complement into the header, so the recomp (and emulators) accept an edited ROM */
function corrigirChecksum(rom) {
  rom[0x7FDC] = 0xFF; rom[0x7FDD] = 0xFF; rom[0x7FDE] = 0; rom[0x7FDF] = 0;  // the sum with c + ~c counts as $1FE
  const s = somaRom(rom), c = s ^ 0xFFFF;
  rom[0x7FDC] = c & 0xFF; rom[0x7FDD] = c >> 8; rom[0x7FDE] = s & 0xFF; rom[0x7FDF] = s >> 8;
  return s;
}

async function sha256Hex(bytes) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

/* opens a dump: drops a 512-byte copier header, checks size, title and checksum, and says whether it is the
   exact original (SHA-256). An edited ROM (checksum fixed) still opens, with original = false. */
async function carregarRom(bytes) {
  let b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const avisos = [];
  if (b.length === ROM_TAMANHO + 512) { b = b.slice(512); avisos.push('cabecalho'); }
  if (b.length !== ROM_TAMANHO) throw new Error('tamanho:' + b.length);
  const titulo = String.fromCharCode(...b.subarray(0x7FC0, 0x7FC0 + ROM_TITULO.length));
  if (titulo !== ROM_TITULO) throw new Error('titulo:' + titulo);
  const rom = new Uint8Array(b);
  const soma = le16(rom, 0x7FDE), compl = le16(rom, 0x7FDC);
  if (((soma + compl) & 0xFFFF) !== 0xFFFF || somaRom(rom) !== soma) avisos.push('checksum');
  const sha = await sha256Hex(rom);
  return { rom, sha, original: sha === ROM_SHA256, avisos };
}

if (typeof module !== 'undefined') module.exports = { ROM_TAMANHO, ROM_TITULO, ROM_SHA256, snesParaArquivo, arquivoParaSnes, hex, hexSnes, somaRom, le16, corrigirChecksum, sha256Hex, carregarRom };
