/* Contra III editor — side-scrolling stages: enemy spawn lists and the tile collision thresholds.
   See docs/FORMATOS.md for the evidence. Everything here lives in bank $05 and is addressed by 16-bit pointers. */
'use strict';
if (typeof require === 'function') var { snesParaArquivo, le16 } = require('./rom.js');

const TAB_INIMIGOS = 0x947A;   // word per stage ($86 * 2): a table of word pointers, one spawn list per screen
const TAB_NIVEL = 0x89CC;      // byte per stage: the level code L ($1698), 0/2/4/6 for stages 1/3/4/6
const TAB_LIMIARES = 0x8A03;   // word per L: 12 ascending tile numbers that split tiles into collision classes
const ENTRADA = 10;
/* the class each threshold opens ($00:CC37): tiles below T0 are empty, below T1 solid, ... at or above T11 solid */
const CLASSES_COLISAO = ['vazio', 'sólido', 'plataforma (atravessa)', 'rampa A', 'rampa B', 'rampa C', 'rampa D', 'rampa E', 'rampa F', 'agarrar', 'escalar (esq.)', 'escalar (dir.)', 'sólido (alto)'];

const b05 = ender => snesParaArquivo(0x050000 | ender);

/* one screen's list: 10-byte entries sorted by trigger, ended by a $FF trigger byte ($00:CE6E) */
function lerLista(rom, ender) {
  const pos = b05(ender);
  if (pos < 0) return null;
  const entradas = [];
  for (let i = 0; i < 64; i++) {
    const p = pos + ENTRADA * i;
    if ((p & 0x7FFF) >= 0x8000 - 1) return null;
    if (rom[p] === 0xFF) return { ender, pos, entradas };
    const s16 = v => v > 0x7FFF ? v - 0x10000 : v;
    entradas.push({ pos: p, gatilho: rom[p], tipo: rom[p + 1], slotFim: rom[p + 2], slotIni: rom[p + 3], x: s16(le16(rom, p + 4)), y: s16(le16(rom, p + 6)), param: le16(rom, p + 8) });
    if (i && entradas[i].gatilho < entradas[i - 1].gatilho) return null;   // the spawner needs them in order
  }
  return null;
}

/* the spawn lists of a stage, screen by screen. How many screens a table has is not stored; the lists are read
   while their pointers point at well-formed lists, up to the 32-screen map limit. */
function lerInimigos(rom, fase) {
  const tab = le16(rom, b05(TAB_INIMIGOS + 2 * fase));
  if (tab < 0x8000) return null;
  const telas = [];
  for (let i = 0; i < 32; i++) {
    const ender = le16(rom, b05(tab + 2 * i));
    const l = ender >= 0x8000 ? lerLista(rom, ender) : null;
    if (!l) break;
    telas.push(l);
  }
  return { tabela: tab, telas };
}

/* writes one entry back over its own 10 bytes */
function gravarEntrada(rom, e) {
  if (e.gatilho < 0 || e.gatilho > 0xFE) throw new Error('gatilho fora de 0-254');
  const w = (p, v) => { rom[p] = v & 0xFF; rom[p + 1] = v >> 8 & 0xFF; };
  rom[e.pos] = e.gatilho; rom[e.pos + 1] = e.tipo & 0xFF; rom[e.pos + 2] = e.slotFim & 0xFF; rom[e.pos + 3] = e.slotIni & 0xFF;
  w(e.pos + 4, e.x); w(e.pos + 6, e.y); w(e.pos + 8, e.param);
}

/* the 12 collision thresholds of a stage */
function lerLimiares(rom, fase) {
  const nivel = rom[b05(TAB_NIVEL + fase)];
  const ender = le16(rom, b05(TAB_LIMIARES + nivel));
  if (ender < 0x8000) return null;
  const p = b05(ender);
  return { nivel, ender, valores: Array.from({ length: 12 }, (_, i) => le16(rom, p + 2 * i)) };
}
/* the collision class of a tile number, from the thresholds */
function classeDoTile(limiares, tile) { let i = 0; while (i < 12 && (tile & 0x3FF) >= limiares[i]) i++; return i; }

if (typeof module !== 'undefined') module.exports = { TAB_INIMIGOS, TAB_NIVEL, TAB_LIMIARES, CLASSES_COLISAO, lerLista, lerInimigos, gravarEntrada, lerLimiares, classeDoTile };
