/* Bigorna Rooms v2 — the board: procedural textures, own icons, drawing and mouse/keyboard on the canvas. */
'use strict';

const tela = $('#tela'), ctx = tela.getContext('2d');
let cursor = null, cruz = null, arrasto = null, movendo = null, movendoSala = null;

// ------------------------------------------------------------ textures (drawn here, nothing from the old editor)
function ruido(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function textura(nome) {
  const S = 64, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d'); const r = ruido(nome.length * 7919 + nome.charCodeAt(0));
  const grao = (base, forca, n) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${base},${(r() * forca).toFixed(2)})`; g.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); } };
  switch (nome) {
    case 'flagstone': g.fillStyle = '#5f5a52'; g.fillRect(0, 0, S, S); grao('255,255,255', .12, 220); grao('0,0,0', .25, 220);
      g.strokeStyle = 'rgba(20,18,16,.75)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2); g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2 + 3, S / 2); g.lineTo(S, S / 2 - 2); g.moveTo(0, S / 2 + 4); g.lineTo(S / 2 + 3, S / 2); g.lineTo(S / 2 - 2, S); g.stroke(); break;
    case 'dirt': g.fillStyle = '#6a5236'; g.fillRect(0, 0, S, S); grao('255,220,160', .18, 300); grao('0,0,0', .3, 260); for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(40,28,16,.5)'; g.beginPath(); g.ellipse(r() * S, r() * S, 3 + r() * 5, 2 + r() * 3, r() * 3, 0, 7); g.fill(); } break;
    case 'grass': g.fillStyle = '#4d6b34'; g.fillRect(0, 0, S, S); grao('200,240,120', .2, 300); grao('0,20,0', .3, 200); g.strokeStyle = 'rgba(120,170,70,.7)'; for (let i = 0; i < 60; i++) { const x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 4 - 2, y - 3 - r() * 4); g.stroke(); } break;
    case 'wood': g.fillStyle = '#7a5a3a'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 16) { g.fillStyle = `rgba(0,0,0,${0.12 + r() * .1})`; g.fillRect(0, y, S, 1); for (let x = 0; x < S; x += 2) { g.fillStyle = `rgba(255,220,170,${(r() * .12).toFixed(2)})`; g.fillRect(x, y + 2 + r() * 12, 2, 1); } } break;
    case 'underlay-embers': g.fillStyle = 'rgba(70,20,5,.85)'; g.fillRect(0, 0, S, S); for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S, k = 1 + r() * 3; const gr = g.createRadialGradient(x, y, 0, x, y, k * 3); gr.addColorStop(0, 'rgba(255,200,60,.95)'); gr.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = gr; g.fillRect(x - k * 3, y - k * 3, k * 6, k * 6); } break;
    case 'underlay-water': g.fillStyle = 'rgba(30,70,120,.8)'; g.fillRect(0, 0, S, S); g.strokeStyle = 'rgba(160,210,255,.55)'; g.lineWidth = 1.5; for (let i = 0; i < 9; i++) { const y = r() * S; g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x / 6 + i) * 2); g.stroke(); } break;
    case 'underlay-fetidwater': g.fillStyle = 'rgba(50,80,30,.85)'; g.fillRect(0, 0, S, S); for (let i = 0; i < 25; i++) { g.fillStyle = `rgba(150,190,60,${(.2 + r() * .4).toFixed(2)})`; g.beginPath(); g.arc(r() * S, r() * S, 1 + r() * 4, 0, 7); g.fill(); } g.strokeStyle = 'rgba(200,230,120,.35)'; for (let i = 0; i < 5; i++) { const y = r() * S; g.beginPath(); for (let x = 0; x <= S; x += 8) g.lineTo(x, y + Math.sin(x / 5 + i) * 2); g.stroke(); } break;
    case 'underlay-spikes': g.fillStyle = 'rgba(60,58,55,.85)'; g.fillRect(0, 0, S, S); for (let i = 0; i < 18; i++) { const x = r() * S, y = r() * S; g.fillStyle = '#c9c4b8'; g.beginPath(); g.moveTo(x - 3, y + 4); g.lineTo(x, y - 6); g.lineTo(x + 3, y + 4); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x - 3, y + 3, 6, 1.5); } break;
    case 'generica': // neutral grey stone: the workshop colour goes over it (overlay), so the grain and the joints show through any colour
      g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); grao('255,255,255', .18, 260); grao('0,0,0', .22, 260);
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(3, 3); g.lineTo(S - 3, 3); g.moveTo(3, 3); g.lineTo(3, S - 3); g.stroke(); break;
    default: g.fillStyle = '#555'; g.fillRect(0, 0, S, S);
  }
  return cv;
}
const TEX = {}; ['flagstone', 'dirt', 'grass', 'wood', 'underlay-embers', 'underlay-water', 'underlay-fetidwater', 'underlay-spikes', 'generica'].forEach(n => { TEX[n] = textura(n); });

// ------------------------------------------------------------ icons: line glyphs, copper on dark
const GLIFOS = {
  Door: '<rect x="14" y="8" width="36" height="52" rx="3"/><circle cx="42" cy="34" r="3" fill="C"/><path d="M14 8 L32 4 L50 8"/>',
  Gate: '<path d="M8 60V20a24 24 0 0 1 48 0v40"/><path d="M20 60V22M32 60V14M44 60V22M8 40h48"/>',
  Chest: '<rect x="8" y="26" width="48" height="30" rx="3"/><path d="M8 26a24 12 0 0 1 48 0"/><rect x="28" y="30" width="8" height="10" fill="C"/>',
  Shelf: '<rect x="8" y="6" width="48" height="52"/><path d="M8 24h48M8 42h48"/><path d="M14 24V10M22 24V12M30 24V9M40 42V28M48 42V30M16 58V46M26 58V48"/>',
  Lectern: '<path d="M18 58h28M32 58V30M20 30h24l4-14H16z"/><path d="M22 22h20"/>',
  Well: '<ellipse cx="32" cy="46" rx="20" ry="8"/><path d="M12 46V30a20 8 0 0 1 40 0v16"/><path d="M16 26 L32 8 L48 26"/><path d="M32 8v26"/>',
  Cauldron: '<path d="M14 26h36l-4 24a14 8 0 0 1-28 0z"/><ellipse cx="32" cy="26" rx="18" ry="5"/><path d="M12 22 L52 22"/><path d="M26 16c0-5 4-5 4-10M36 16c0-5 4-5 4-10" stroke-dasharray="2 2"/>',
  SightToken: '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="8" fill="C"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8"/>',
  Bell: '<path d="M20 44c0-16 2-26 12-26s12 10 12 26z"/><path d="M14 44h36"/><circle cx="32" cy="50" r="4" fill="C"/><path d="M32 18v-6"/>',
  BloodShrine: '<path d="M16 58h32M20 58V34h24v24"/><path d="M32 34V14M24 22h16"/><circle cx="32" cy="46" r="4" fill="C"/>',
  Fire: '<path d="M32 58c-12 0-18-8-18-18 0-8 6-12 8-20 4 6 6 8 6 14 4-4 6-8 4-16 8 6 16 14 16 24 0 10-6 16-16 16z"/><path d="M32 58c-5 0-8-4-8-8 0-4 4-6 8-12 4 6 8 8 8 12 0 4-3 8-8 8z" fill="C"/>',
  Ladder: '<path d="M20 6v52M44 6v52M20 16h24M20 28h24M20 40h24M20 52h24"/>',
  LadderMedium: '<path d="M22 14v40M42 14v40M22 24h20M22 34h20M22 44h20"/>',
  Statue: '<path d="M18 58h28M22 58V46h20v12"/><path d="M32 46V22"/><circle cx="32" cy="14" r="6"/><path d="M22 30l10-8 10 8"/>',
  Wagon: '<path d="M10 20h40l6 18H10z"/><circle cx="20" cy="46" r="7"/><circle cx="44" cy="46" r="7"/><path d="M10 20V12M50 20V12"/>',
  Archway: '<path d="M10 58V24a22 22 0 0 1 44 0v34"/><path d="M18 58V26a14 14 0 0 1 28 0v32"/>',
  BellFrame: '<path d="M10 58V24a22 22 0 0 1 44 0v34"/><path d="M18 58V26a14 14 0 0 1 28 0v32"/><path d="M32 10v6"/>',
  Barricade: '<path d="M8 50h48"/><path d="M14 50L26 22M22 50L34 22M30 50L42 22M38 50L50 22"/><path d="M12 30L52 30"/>',
  Bridge: '<path d="M6 44q26-26 52 0"/><path d="M6 44v10M58 44v10"/><path d="M14 38v10M22 33v10M32 31v10M42 33v10M50 38v10"/>',
  DragonArch: '<path d="M6 58V30q26-30 52 0v28"/><path d="M6 30q10 6 14 0M44 30q4 6 14 0"/><path d="M28 22l4-8 4 8"/>',
  DragonHead: '<path d="M10 40q10-24 30-24 12 0 16 10l-8 4 6 6-10 2-2 10q-14 4-24-2z"/><circle cx="38" cy="26" r="2.5" fill="C"/><path d="M14 40l-6 10M46 46l6 8"/>',
  RoundTable: '<ellipse cx="32" cy="28" rx="24" ry="12"/><path d="M12 30v14M52 30v14M32 40v14M22 50h20"/>',
  StoneTable: '<rect x="8" y="20" width="48" height="12"/><path d="M14 32v22M50 32v22M14 44h36"/>',
  Tree: '<path d="M32 58V40"/><path d="M32 6l18 22H38l12 14H14l12-14H14z"/>',
  Staircase: '<path d="M8 56h10V44h10V32h10V20h10V8h8"/><path d="M8 56L56 8"/>',
  PillarObj: '<rect x="16" y="6" width="32" height="8"/><rect x="16" y="50" width="32" height="8"/><path d="M22 14v36M42 14v36"/><path d="M28 18v28M36 18v28" stroke-opacity=".5"/>',
  PillarPush: '<rect x="16" y="6" width="32" height="8"/><rect x="16" y="50" width="32" height="8"/><path d="M22 14v36M42 14v36"/><path d="M28 18v28M36 18v28" stroke-opacity=".5"/>',
  Tile: '<path d="M8 20h28v28H8zM36 20h20v16H36zM20 48h16v10H20z"/>',
  Counter: '<rect x="8" y="12" width="48" height="40" rx="4"/><path d="M18 22v20M26 22v20M34 22v20M42 22v20M14 38l34-12"/>',
  Delete: '<path d="M14 18h36M26 18v-6h12v6M18 18l3 38h22l3-38M27 26v22M37 26v22"/>',
  Hero: '<circle cx="32" cy="20" r="10"/><path d="M12 58c0-14 8-22 20-22s20 8 20 22z"/>',
  Oficina: '<path d="M10 44h30l6-8H18zM22 44v10M36 44v10M16 54h26"/><path d="M38 30l14-14M44 14l8 8"/>',
  Rune: '<path d="M32 6v52M18 16l28 14-28 14M18 44h28"/>',
  Skull: '<path d="M14 34a18 18 0 1 1 36 0v8H40v8H24v-8H14z"/><circle cx="25" cy="32" r="4" fill="C"/><circle cx="39" cy="32" r="4" fill="C"/>',
  Key: '<circle cx="20" cy="32" r="10"/><path d="M30 32h26M48 32v8M54 32v6"/>',
  Lever: '<path d="M12 54h40M24 54a8 8 0 0 1 16 0M32 50L46 14"/><circle cx="46" cy="12" r="5" fill="C"/>',
  Crystal: '<path d="M32 6l14 18-14 34-14-34z"/><path d="M18 24h28M32 6v52"/>',
  Trap: '<path d="M8 46h48M12 46l6-12 6 12 6-12 6 12 6-12 6 12 6-12"/>',
  Coffin: '<path d="M24 6h16l8 14-6 38H22l-6-38z"/><path d="M32 16v20M24 24h16"/>',
  Enemy: '<path d="M14 58V30a18 18 0 0 1 36 0v28"/><circle cx="24" cy="30" r="3" fill="C"/><circle cx="40" cy="30" r="3" fill="C"/><path d="M24 44l4 6 4-6 4 6 4-6"/>',
};
function icone(nome, cor, fundo, tam) {
  const g = GLIFOS[nome] || '<rect x="12" y="12" width="40" height="40" rx="6"/><path d="M20 32h24M32 20v24"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${fundo ? `<rect width="64" height="64" rx="10" fill="${fundo}"/>` : ''}<g fill="none" stroke="${cor}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${g.replace(/fill="C"/g, `fill="${cor}"`)}</g></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const iconeObj = tipo => { const b = baseObj(tipo); if (b && ARTE_OBJ[b]?.url) return ARTE_OBJ[b].url; const v = varObj(tipo); if (v) return v.icone || icone(v.glifo || 'Oficina', '#f3cf8f', v.cor || '#6a5a48'); return icone(tipo, '#e0b070', 'rgba(26,24,28,.85)'); };
/* the board image of an object: a workshop object's own picture, or its glyph (light, over its coloured squares); a game object's glyph */
function imagemObj(tipo) { const v = varObj(tipo); if (v?.icone) return retratoImg('obj:' + v.id + ':' + v.icone.length, v.icone); if (v) return IMG['obj:' + (GLIFOS[v.glifo] ? v.glifo : 'Oficina')]; return IMG['obj:' + tipo]; }
/* everything off the ribbon level is faded: only that level can be picked (like the rooms) */
const alfaNivel = (lv, escada) => noNivel(lv, escada) ? 1 : 0.3;
Object.keys(GLIFOS).forEach(k => { const i = new Image(); i.onload = () => desenhar(); i.src = icone(k, '#f0c88a', null); IMG['obj:' + k] = i; });
const retratoImg = (chave, src) => { if (!src) return null; if (IMG[chave]) return IMG[chave]; const i = new Image(); i.onload = () => desenhar(); i.src = src; IMG[chave] = i; return i; };

// ------------------------------------------------------------ thumbnails
const miniaturas = {};
function miniatura(t, v) {
  const chave = v ? v.id + ':' + (v.cor || '') + ':' + JSON.stringify(t.cells) + ':' + (v.texModo || '') + ':' + (v.texModo === 'inteira' ? (v.texInteira || '').length : (v.texRepetida || '').length) : t.id;
  if (miniaturas[chave]) return miniaturas[chave];
  const xs = t.cells.map(c => c[0]), ys = t.cells.map(c => c[1]); const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1; const S = 14;
  const cv = document.createElement('canvas'); cv.width = w * S; cv.height = h * S; const c2 = cv.getContext('2d');
  t.cells.forEach(([x, y]) => { if (v) { c2.save(); c2.translate((x - x0) * S, (y - y0) * S); casaDaOficina(c2, v, x, y, S); c2.restore(); } else { const tex = TEX[texturaDe(t)]; if (tex) c2.drawImage(tex, (x - x0) * S, (y - y0) * S, S, S); } });
  t.cells.forEach(([x, y]) => { c2.strokeStyle = 'rgba(0,0,0,.6)'; c2.strokeRect((x - x0) * S + .5, (y - y0) * S + .5, S - 1, S - 1); });
  const url = cv.toDataURL(); if (v && texturasPendentes(v)) return url;   // drawn again when the pictures arrive
  if (v) Object.keys(miniaturas).forEach(k => { if (k.startsWith(v.id + ':')) delete miniaturas[k]; });   // older looks of the same piece
  return (miniaturas[chave] = url);
}
/* pictures kept as data URLs (workshop textures): loaded once; the board redraws when one arrives */
const _imgsDados = new Map();
function imagemDeDados(url) {
  if (!url) return null; let i = _imgsDados.get(url);
  if (!i) { i = new Image(); i.onload = () => { Object.keys(miniaturas).forEach(k => { if (k.startsWith('B_')) delete miniaturas[k]; }); desenhar(); if (ferramenta === 'peca') renderPaleta(); }; i.src = url; _imgsDados.set(url, i); }
  return i.complete && i.naturalWidth ? i : null;
}
/* the picture of one square of a workshop tile (local square lx,ly), drawn into 0,0..S,S: a part of the whole picture,
   the square's own picture, or the colour with the grain */
function casaDaOficina(g, v, lx, ly, S) {
  const cs = v.cells && v.cells.length ? v.cells : [[0, 0]];
  if (v.texModo === 'inteira') { const img = imagemDeDados(v.texInteira); if (img) { const [w, h] = extensao(cs); const x0 = Math.min(...cs.map(c => c[0])), y0 = Math.min(...cs.map(c => c[1])); const iw = img.naturalWidth / w, ih = img.naturalHeight / h; g.drawImage(img, (lx - x0) * iw, (ly - y0) * ih, iw, ih, 0, 0, S, S); return true; } }
  if (v.texModo === 'repetida') { const img = imagemDeDados(v.texRepetida); if (img) { g.drawImage(img, 0, 0, S, S); return true; } }
  chaoDaOficina(g, v.cor, 0, 0, S); return false;
}
const texturasPendentes = v => (v.texModo === 'inteira' && v.texInteira && !imagemDeDados(v.texInteira)) || (v.texModo === 'repetida' && v.texRepetida && !imagemDeDados(v.texRepetida));
/* one square of a workshop tile: the chosen colour with the generic grain over it */
function chaoDaOficina(g, cor, x, y, S) {
  g.save(); g.fillStyle = cor || '#8a7a66'; g.fillRect(x, y, S, S);
  g.globalCompositeOperation = 'overlay'; g.drawImage(TEX.generica, x, y, S, S); g.restore();
}

// ------------------------------------------------------------ drawing
function redimensionar() { const r = tela.getBoundingClientRect(); tela.width = r.width * devicePixelRatio; tela.height = r.height * devicePixelRatio; desenhar(); }
window.addEventListener('resize', redimensionar);
function paraCasa(ev) { const r = tela.getBoundingClientRect(); const x = (ev.clientX - r.left - vista.px) / (C * vista.zoom), y = (ev.clientY - r.top - vista.py) / (C * vista.zoom); return [Math.floor(x), Math.floor(y)]; }
function paraCruzamento(ev) { const r = tela.getBoundingClientRect(); const x = (ev.clientX - r.left - vista.px) / (C * vista.zoom), y = (ev.clientY - r.top - vista.py) / (C * vista.zoom); return [Math.round(x), Math.round(y)]; }
function cruzamentoPerto(ev) { const r = tela.getBoundingClientRect(); const x = (ev.clientX - r.left - vista.px) / (C * vista.zoom), y = (ev.clientY - r.top - vista.py) / (C * vista.zoom); const vx = Math.round(x), vy = Math.round(y); return Math.hypot(x - vx, y - vy) <= 0.33 ? [vx, vy] : null; }
const COR = { fundo: '#1b1d22', grade: '#262a31', gradeForte: '#30353e', texto: '#8b93a1', cobre: '#e0a458', cobreClaro: '#f3cf8f', selec: '#ffffff', ok: '#7cc576', erro: '#e05a4f', gatilho: '#8fa8ff', abre: '#e0a458', heroi: '#69b4a1', inimigo: '#d0574f', spawn: '#a77bd6', pool: '#6fa3d8' };

function desenhar() {
  if (vista3d.on) return desenhar3d();
  const dpr = devicePixelRatio; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = tela.width / dpr, H = tela.height / dpr;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(vista.px, vista.py); ctx.scale(vista.zoom, vista.zoom);
  const c0 = Math.floor(-vista.px / (C * vista.zoom)) - 1, c1 = Math.ceil((W - vista.px) / (C * vista.zoom)) + 1;
  const l0 = Math.floor(-vista.py / (C * vista.zoom)) - 1, l1 = Math.ceil((H - vista.py) / (C * vista.zoom)) + 1;
  ctx.lineWidth = 1 / vista.zoom;
  for (let x = c0; x <= c1; x++) { ctx.strokeStyle = x % 5 ? COR.grade : COR.gradeForte; ctx.beginPath(); ctx.moveTo(x * C, l0 * C); ctx.lineTo(x * C, l1 * C); ctx.stroke(); }
  for (let y = l0; y <= l1; y++) { ctx.strokeStyle = y % 5 ? COR.grade : COR.gradeForte; ctx.beginPath(); ctx.moveTo(c0 * C, y * C); ctx.lineTo(c1 * C, y * C); ctx.stroke(); }
  ctx.fillStyle = COR.texto; ctx.font = `${10 / vista.zoom}px system-ui`;
  for (let x = c0; x <= c1; x += 5) ctx.fillText(x, x * C + 2, l0 * C + 10 / vista.zoom + 2);
  for (let y = l0; y <= l1; y += 5) ctx.fillText(y, c0 * C + 2, y * C + 10 / vista.zoom + 2);

  const pecas = []; projeto.salas.forEach((s, si) => s.pecas.forEach((p, pi) => { const alf = ehAlfombra(p.tile); pecas.push({ p, si, pi, alf, ordem: alf ? -1 : (p.level || 0) }); }));
  pecas.sort((a, b) => a.ordem - b.ordem);
  const adicionadas = pecasAdicionadas();
  pecas.forEach(({ p, si, pi, alf }) => desenharPeca(p, (si !== salaAtual ? 0.35 : 1) * (adicionadas.has(si + ':' + pi) ? 0.55 : 1) * alfaNivel(alf ? 0 : p.level), sel && sel.tipo === 'peca' && sel.sala === si && sel.i === pi, si === salaAtual));
  // a room still in preview (the room generator): tinted blue and striped, with a dashed edge and a label, to show it is provisional
  projeto.salas.forEach((s, si) => { if (s._previa) desenharPrevia(si); });
  // pillars of the tiles
  pilaresDoMapa().forEach(({ q, si, p }) => desenharPilar(q, (si === salaAtual ? 1 : 0.4) * alfaNivel(p.level), sel && sel.tipo === 'pilar' && sel.sala === si && sel.pos[0] === q.pos[0] && sel.pos[1] === q.pos[1], p.level));
  // room labels
  projeto.salas.forEach((s, si) => {
    const casas = s.pecas.filter(p => !ehAlfombra(p.tile)).flatMap(casasDaPeca); if (!casas.length) return;
    const cx = casas.reduce((a, c) => a + c[0], 0) / casas.length + 0.5, cy = casas.reduce((a, c) => a + c[1], 0) / casas.length + 0.5;
    ctx.fillStyle = si === salaAtual ? 'rgba(243,207,143,.95)' : 'rgba(139,147,161,.55)'; ctx.font = `600 ${13 / vista.zoom}px system-ui`; ctx.textAlign = 'center';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 5; ctx.fillText((si + 1) + ' · ' + s.nome, cx * C, cy * C); ctx.shadowBlur = 0; ctx.textAlign = 'left';
  });
  // heroes
  projeto.salas.forEach((s, si) => s.herois.forEach((h, hi) => {
    ctx.globalAlpha = (si === salaAtual ? 1 : 0.4) * alfaNivel(h[2] || 0);
    ctx.fillStyle = COR.heroi; ctx.beginPath(); ctx.arc(h[0] * C + C / 2, h[1] * C + C / 2, C * 0.36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10261f'; ctx.font = `bold ${12 / vista.zoom}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('H' + (hi + 1), h[0] * C + C / 2, h[1] * C + C / 2 + 4.5 / vista.zoom); ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    if (sel && sel.tipo === 'heroi' && sel.sala === si && sel.i === hi) marcarSelecao(h[0], h[1], 1, 1);
  }));
  // objects: floor-like first
  const objetos = []; projeto.salas.forEach((s, si) => s.objetos.forEach((o, oi) => objetos.push({ o, si, oi })));
  objetos.sort((a, b) => (ehTerreno(a.o) ? 0 : 1) - (ehTerreno(b.o) ? 0 : 1));
  objetos.forEach(({ o, si, oi }) => {
    const selecionado = sel && sel.tipo === 'objeto' && sel.sala === si && sel.i === oi;
    const casas = casasDoObjeto(o); const img = imagemObj(o.type);
    const xs = casas.map(c => c[0]), ys = casas.map(c => c[1]); const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1;
    const aN = alfaNivel(o.level, ehTipo(o, 'Staircase')); const vo = varObj(o.type);
    ctx.globalAlpha = (si === salaAtual ? 1 : 0.4) * (o.hidden ? 0.55 : 1) * aN;
    const tex = !vo && texturaDoObjeto(o.type);
    if (tex) desenharTexturaGirada(tex, o, x0, y0, w, h);
    else if (vo) { casas.forEach(([x, y]) => { ctx.fillStyle = vo.cor || '#6a5a48'; ctx.fillRect(x * C + 1.5, y * C + 1.5, C - 3, C - 3); }); ctx.fillStyle = 'rgba(0,0,0,.25)'; casas.forEach(([x, y]) => ctx.fillRect(x * C + 1.5, y * C + C - 5, C - 3, 3.5)); }
    else if (ehTerreno(o)) { ctx.fillStyle = 'rgba(120,110,95,.6)'; ctx.fillRect(x0 * C, y0 * C, w * C, h * C); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1 / vista.zoom; casas.forEach(([x, y]) => ctx.strokeRect(x * C + .5, y * C + .5, C - 1, C - 1)); }
    else { ctx.fillStyle = 'rgba(20,18,24,.72)'; arredondado(x0 * C + 2, y0 * C + 2, w * C - 4, h * C - 4, 5 / vista.zoom); ctx.fill(); }
    if (!tex && img && img.complete && img.naturalWidth) desenharImagemGirada(img, o, x0, y0, w, h);
    if (ehTipo(o, 'Staircase') || ehTipo(o, 'Ladder') || ehTipo(o, 'LadderMedium')) desenharSeta(o, x0, y0, w, h);
    ctx.globalAlpha = aN;
    if ((o.gatilhos || []).length) { ctx.strokeStyle = o.gatilhos.some(g => g.tipo === 'open_room') ? COR.abre : COR.gatilho; ctx.lineWidth = 2.5 / vista.zoom; arredondado(x0 * C + 1.5, y0 * C + 1.5, w * C - 3, h * C - 3, 5 / vista.zoom); ctx.stroke(); }
    if ((o.requisitos || []).length || (o.gatilhos || []).some(g => (g.requisitos || []).length)) { ctx.fillStyle = '#ffd166'; ctx.font = `bold ${11 / vista.zoom}px system-ui`; ctx.fillText('🔒', x0 * C + 2, y0 * C + 12 / vista.zoom); }
    if (escolha && escolha.modo === 'object') { const pulso = 0.5 + 0.5 * Math.sin(Date.now() / 250); ctx.strokeStyle = `rgba(255,230,120,${0.4 + 0.6 * pulso})`; ctx.lineWidth = 4 / vista.zoom; ctx.strokeRect(x0 * C - 2, y0 * C - 2, w * C + 4, h * C + 4); }
    ctx.fillStyle = '#fff'; ctx.font = `${10 / vista.zoom}px system-ui`; ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    ctx.fillText(rotulo(o).slice(0, 18) + ((o.level || 0) > 0 ? ' L' + o.level : ''), x0 * C + 3, y0 * C + h * C - 3); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (selecionado) marcarSelecao(x0, y0, w, h);
  });
  // enemies
  projeto.salas.forEach((s, si) => inimigosDaSala(s).forEach(({ e, origem }) => {
    const [x, y] = e.pos; const img = retratoImg('ini:' + e.enemy, iconeIni(e.enemy));
    const spawn = origem.tipo === 'gat';
    ctx.globalAlpha = (si === salaAtual ? 1 : 0.4) * (spawn ? 0.85 : 1) * alfaNivel(e.level);
    ctx.fillStyle = ehPool(e.enemy) ? COR.pool : spawn ? COR.spawn : COR.inimigo; ctx.beginPath(); ctx.arc(x * C + C / 2, y * C + C / 2, C * 0.44, 0, Math.PI * 2); ctx.fill();
    if (img && img.complete && img.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(x * C + C / 2, y * C + C / 2, C * 0.38, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, x * C + C * 0.12, y * C + C * 0.12, C * 0.76, C * 0.76); ctx.restore(); }
    else { ctx.fillStyle = '#fff'; ctx.font = `bold ${11 / vista.zoom}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(nomeIni(e.enemy).slice(0, 2).toUpperCase(), x * C + C / 2, y * C + C / 2 + 4 / vista.zoom); ctx.textAlign = 'left'; }
    ctx.globalAlpha = 1;
    const selecionado = sel && sel.tipo === 'inimigo' && sel.sala === si && ((origem.tipo === 'sala' && sel.g === undefined && sel.i === origem.i) || (origem.tipo === 'gat' && sel.g === origem.g && sel.obj === origem.obj && (sel.l || 'gatilhos') === origem.l && sel.i === origem.k));
    if (selecionado) marcarSelecao(x, y, 1, 1);
  }));
  // the pillar tool shows the sockets of the elevated tiles of this room at the ribbon level
  if (ferramenta === 'pilar' && !escolha && salaAtual >= 0) { const tomados = new Set(pilaresDoMapa().map(({ q }) => q.pos[0] + ',' + q.pos[1])); (projeto.salas[salaAtual]?.pecas || []).forEach(p => { if (ehAlfombra(p.tile) || ehCaixa(p.tile) || !(p.level > 0) || (p.level || 0) !== nivel) return;
    encaixesDaPeca(p).forEach(k => { if (tomados.has(k)) return; const [vx, vy] = k.split(',').map(Number); ctx.fillStyle = 'rgba(243,207,143,.85)'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1 / vista.zoom; ctx.beginPath(); ctx.arc(vx * C, vy * C, C * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }); }); }
  // a tile being dragged over another: red edge (it goes back when released)
  if (movendo && movendo.tipo === 'peca') { const p = projeto.salas[movendo.sala]?.pecas[movendo.i]; if (p && colide(p, movendo.sala, movendo.i)) { ctx.strokeStyle = COR.erro; ctx.lineWidth = 3 / vista.zoom; casasDaPeca(p).forEach(([x, y]) => ctx.strokeRect(x * C + 1.5, y * C + 1.5, C - 3, C - 3)); } }
  // pool spawn spaces and pending destinations of the selected object's triggers
  if (sel && (sel.tipo === 'objeto' || sel.tipo === 'inimigo')) { const o = sel.tipo === 'objeto' ? projeto.salas[sel.sala]?.objetos[sel.i] : listaDe(sel)?.[sel.i]; todosGatilhos(o).forEach(g => {
    ctx.setLineDash([4 / vista.zoom, 3 / vista.zoom]); ctx.lineWidth = 2 / vista.zoom;
    if (g.tipo === 'move_heroes') { ctx.setLineDash([]); (g.cells || []).forEach((c, k) => { ctx.strokeStyle = COR.heroi; ctx.lineWidth = 2.5 / vista.zoom; ctx.strokeRect(c[0] * C + 3, c[1] * C + 3, C - 6, C - 6); ctx.fillStyle = COR.heroi; ctx.font = `bold ${11 / vista.zoom}px system-ui`; ctx.fillText('H' + (k + 1), c[0] * C + C / 2 - 7 / vista.zoom, c[1] * C + C / 2 + 4 / vista.zoom); }); return; }
    if (g.cell) { ctx.strokeStyle = COR.pool; ctx.strokeRect(g.cell[0] * C + 2, g.cell[1] * C + 2, C - 4, C - 4); }
    (g.cells || []).forEach(c => { ctx.strokeStyle = COR.pool; ctx.strokeRect(c[0] * C + 3, c[1] * C + 3, C - 6, C - 6); ctx.fillStyle = COR.pool; ctx.font = `bold ${10 / vista.zoom}px system-ui`; ctx.fillText('?', c[0] * C + C / 2 - 3 / vista.zoom, c[1] * C + C / 2 + 4 / vista.zoom); });
    ctx.setLineDash([]); }); }
  // cursor previews
  if (cursor && salaAtual >= 0 && !escolha && ferramenta === 'peca') {
    const p = { tile: pecaEscolhida, pos: cursor, rot, level: ehAlfombra(pecaEscolhida) ? 0 : nivel }; if (ehEspecial(pecaEscolhida)) p.level = nivelEspecial(p);
    const bate = colide(p, salaAtual, -1) || (!ehAlfombra(pecaEscolhida) && projeto.salas[salaAtual].pecas.some(q => numeroDaPeca(q.tile) === numeroDaPeca(p.tile)));
    ctx.globalAlpha = 0.55; desenharPeca(p, 1, false, true); ctx.globalAlpha = 1;
    ctx.strokeStyle = bate ? COR.erro : COR.ok; ctx.lineWidth = 2 / vista.zoom;
    casasDaPeca(p).forEach(([x, y]) => ctx.strokeRect(x * C + 1, y * C + 1, C - 2, C - 2));
  } else if (cruz && salaAtual >= 0 && !escolha && ferramenta === 'pilar') {
    const ok = pilarCabe(cruz[0], cruz[1]);
    ctx.globalAlpha = 0.75; desenharPilar({ type: pilarEscolhido, pos: cruz }, 1, false, ok.ok ? ok.peca.level : 0); ctx.globalAlpha = 1;
    ctx.strokeStyle = ok.ok ? COR.ok : COR.erro; ctx.lineWidth = 2 / vista.zoom; ctx.beginPath(); ctx.arc(cruz[0] * C, cruz[1] * C, C * 0.36, 0, Math.PI * 2); ctx.stroke();
  } else if (cursor && salaAtual >= 0 && (escolha || ferramenta === 'objeto' || ferramenta === 'inimigo' || ferramenta === 'heroi')) {
    const casas = !escolha && ferramenta === 'objeto' ? casasDoObjeto({ type: objetoEscolhido, pos: cursor, rot }) : [cursor];
    const ok = escolha ? (escolha.modo === 'object' ? !!oQueHa(cursor[0], cursor[1], true) : salaNoNivel(cursor[0], cursor[1], nivel) >= 0) : (!escolha && ferramenta === 'objeto' && ehTerreno({ type: objetoEscolhido })) || casas.every(([x, y]) => salaNoNivel(x, y, nivel) === salaAtual);
    ctx.strokeStyle = ok ? COR.ok : COR.erro; ctx.lineWidth = 2 / vista.zoom;
    casas.forEach(([x, y]) => ctx.strokeRect(x * C + 1, y * C + 1, C - 2, C - 2));
    if (!escolha && ferramenta === 'objeto') { const tex = texturaDoObjeto(objetoEscolhido); const img = tex || imagemObj(objetoEscolhido); if (img && img.complete && img.naturalWidth) { ctx.globalAlpha = .6; const xs = casas.map(c => c[0]), ys = casas.map(c => c[1]); const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1; (tex ? desenharTexturaGirada : desenharImagemGirada)(img, { type: objetoEscolhido, rot }, Math.min(...xs), Math.min(...ys), w, h); ctx.globalAlpha = 1; } }
  }
  ctx.restore();
}
function arredondado(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function marcarSelecao(x, y, w, h) { ctx.save(); ctx.strokeStyle = COR.selec; ctx.lineWidth = 2.5 / vista.zoom; ctx.shadowColor = COR.cobreClaro; ctx.shadowBlur = 10; ctx.strokeRect(x * C - 1, y * C - 1, w * C + 2, h * C + 2); ctx.restore(); }
/* a game object's own texture (texturas.js): the whole footprint, turned with the object */
function desenharTexturaGirada(img, o, x0, y0, w, h) {
  const d = defObj(o.type) || { w, h }; ctx.save(); ctx.translate((x0 + w / 2) * C, (y0 + h / 2) * C); ctx.rotate(rotVisual(o) * Math.PI / 180);
  ctx.drawImage(img, -(d.w || 1) * C / 2, -(d.h || 1) * C / 2, (d.w || 1) * C, (d.h || 1) * C); ctx.restore();
}
function desenharImagemGirada(img, o, x0, y0, w, h) {
  const d = defObj(o.type) || { w: 1, h: 1 }; const bw = (d.w || 1) * C, bh = (d.h || 1) * C;
  ctx.save(); ctx.translate(x0 * C + w * C / 2, y0 * C + h * C / 2); ctx.rotate(rotVisual(o) * Math.PI / 180);
  const l = Math.min(bw, bh) * 0.82; ctx.drawImage(img, -l / 2, -l / 2, l, l); ctx.restore();
}
/* the staircase climbs along its rotation: the arrow shows the way up */
function desenharSeta(o, x0, y0, w, h) {
  ctx.save(); ctx.translate(x0 * C + w * C / 2, y0 * C + h * C / 2); ctx.rotate(((o.rot || 0) % 360) * Math.PI / 180);
  const L = (defObj(o.type)?.w || 3) * C * 0.42;
  ctx.strokeStyle = COR.cobreClaro; ctx.fillStyle = COR.cobreClaro; ctx.lineWidth = 3 / vista.zoom; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L - 6, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L - 9, -6); ctx.lineTo(L - 9, 6); ctx.closePath(); ctx.fill();
  ctx.font = `bold ${9 / vista.zoom}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('UP', L - 14, -8 / vista.zoom); ctx.restore();
}
function desenharPilar(q, alfa, selecionado, nivelPeca) {
  const [vx, vy] = q.pos; const x = vx * C, y = vy * C; const n = SUPORTES[q.type]?.nivel || 1;
  ctx.save(); ctx.globalAlpha *= alfa;
  ctx.fillStyle = ['#b98a55', '#8f6a3c', '#5f4626'][n - 1]; ctx.beginPath(); ctx.moveTo(x, y - C * .34); ctx.lineTo(x + C * .3, y); ctx.lineTo(x, y + C * .34); ctx.lineTo(x - C * .3, y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.5 / vista.zoom; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${10 / vista.zoom}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(n, x, y + 3.5 / vista.zoom); ctx.textAlign = 'left';
  if (selecionado) { ctx.strokeStyle = COR.selec; ctx.lineWidth = 2 / vista.zoom; ctx.beginPath(); ctx.arc(x, y, C * 0.4, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
/* the floor of a tile: the game texture, or (workshop tile) the chosen colour over the generic grain */
function pintarChao(p, t, v, casas) {
  ctx.imageSmoothingQuality = 'high';
  if (v) { const r = p.rot || 0; (v.cells && v.cells.length ? v.cells : [[0, 0]]).forEach(([lx, ly]) => { const [dx, dy] = girar([lx, ly], r); ctx.save(); ctx.translate((p.pos[0] + dx + .5) * C, (p.pos[1] + dy + .5) * C); ctx.rotate(r * Math.PI / 180); ctx.translate(-C / 2, -C / 2); casaDaOficina(ctx, v, lx, ly, C); ctx.restore(); }); return; }
  const tex = TEX[texturaDe(t)];
  if (tex) casas.forEach(([x, y]) => ctx.drawImage(tex, x * C, y * C, C, C)); else { ctx.fillStyle = '#555'; casas.forEach(([x, y]) => ctx.fillRect(x * C, y * C, C, C)); }
}
function desenharPrevia(si) {
  const casas = [...chaoDaSala(si).keys()].map(k => k.split(',').map(Number)); if (!casas.length) return;
  const S = new Set(casas.map(c => c.join(','))); const z = vista.zoom;
  ctx.save(); ctx.beginPath(); casas.forEach(([x, y]) => ctx.rect(x * C, y * C, C, C)); ctx.clip();
  ctx.fillStyle = 'rgba(70,170,255,.38)'; casas.forEach(([x, y]) => ctx.fillRect(x * C, y * C, C, C));
  const xs = casas.map(c => c[0]), ys = casas.map(c => c[1]); const x0 = Math.min(...xs) * C, y0 = Math.min(...ys) * C, x1 = (Math.max(...xs) + 1) * C, y1 = (Math.max(...ys) + 1) * C;
  ctx.strokeStyle = 'rgba(210,240,255,.28)'; ctx.lineWidth = 6 / z; ctx.beginPath(); for (let d = x0 - (y1 - y0); d < x1; d += 18 / z) { ctx.moveTo(d, y1); ctx.lineTo(d + (y1 - y0), y0); } ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.strokeStyle = '#7fd0ff'; ctx.lineWidth = 3 / z; ctx.setLineDash([8 / z, 5 / z]); ctx.lineDashOffset = -(performance.now() / 60) / z;
  casas.forEach(([x, y]) => { ctx.beginPath();
    if (!S.has(x + ',' + (y - 1))) { ctx.moveTo(x * C, y * C); ctx.lineTo((x + 1) * C, y * C); }
    if (!S.has(x + ',' + (y + 1))) { ctx.moveTo(x * C, (y + 1) * C); ctx.lineTo((x + 1) * C, (y + 1) * C); }
    if (!S.has((x - 1) + ',' + y)) { ctx.moveTo(x * C, y * C); ctx.lineTo(x * C, (y + 1) * C); }
    if (!S.has((x + 1) + ',' + y)) { ctx.moveTo((x + 1) * C, y * C); ctx.lineTo((x + 1) * C, (y + 1) * C); }
    ctx.stroke(); });
  ctx.setLineDash([]);
  const rot = tr('PREVIEW · not added yet'); ctx.font = `bold ${12 / z}px system-ui`; const w = ctx.measureText(rot).width;
  const lx = Math.min(...casas.filter(c => c[1] * C === y0).map(c => c[0])) * C;   // (over the top row, where the room begins)
  ctx.fillStyle = 'rgba(20,60,100,.92)'; ctx.fillRect(lx, y0 - 20 / z, w + 12 / z, 18 / z); ctx.fillStyle = '#bfe6ff'; ctx.fillText(rot, lx + 6 / z, y0 - 7 / z);
  ctx.restore();
}
function desenharPeca(p, alfa, selecionada, ativa) {
  const t = defPeca(p.tile); if (!t) return; const v = varPeca(p.tile);
  const casas = casasDaPeca(p); const alfombra = t.kind === 'underlay';
  ctx.save(); ctx.globalAlpha *= alfa * (alfombra ? 0.9 : 1);
  ctx.beginPath(); casas.forEach(([x, y]) => ctx.rect(x * C, y * C, C, C)); ctx.clip();
  pintarChao(p, t, v, casas);
  if ((p.level || 0) > 0) { ctx.fillStyle = `rgba(255,236,200,${0.1 * p.level})`; casas.forEach(([x, y]) => ctx.fillRect(x * C, y * C, C, C)); }
  ctx.restore();
  // bevelled edge
  const S = new Set(casas.map(c => c.join(',')));
  const borda = (cor, largura, off) => { ctx.strokeStyle = cor; ctx.lineWidth = largura / vista.zoom; if (alfombra) ctx.setLineDash([4 / vista.zoom, 3 / vista.zoom]);
    casas.forEach(([x, y]) => { ctx.beginPath();
      if (!S.has(x + ',' + (y - 1))) { ctx.moveTo(x * C, y * C + off); ctx.lineTo((x + 1) * C, y * C + off); }
      if (!S.has(x + ',' + (y + 1))) { ctx.moveTo(x * C, (y + 1) * C - off); ctx.lineTo((x + 1) * C, (y + 1) * C - off); }
      if (!S.has((x - 1) + ',' + y)) { ctx.moveTo(x * C + off, y * C); ctx.lineTo(x * C + off, (y + 1) * C); }
      if (!S.has((x + 1) + ',' + y)) { ctx.moveTo((x + 1) * C - off, y * C); ctx.lineTo((x + 1) * C - off, (y + 1) * C); }
      ctx.stroke(); }); ctx.setLineDash([]); };
  ctx.save(); ctx.globalAlpha *= alfa;
  borda('rgba(0,0,0,.85)', 1.5, 0); if (!alfombra) borda((p.level || 0) > 0 ? 'rgba(255,225,170,.7)' : 'rgba(255,255,255,.18)', 1.5, 2 / vista.zoom);
  if (selecionada) borda(COR.selec, 2.5, 0);
  ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = `bold ${11 / vista.zoom}px system-ui`; ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
  const [lx, ly] = casas.reduce((a, c) => c[1] < a[1] || (c[1] === a[1] && c[0] < a[0]) ? c : a, casas[0]);
  ctx.fillText(nomePeca(p.tile) + ((p.level || 0) > 0 ? ' L' + p.level : ''), lx * C + 3, ly * C + 12 / vista.zoom); ctx.shadowBlur = 0;
  ctx.restore();
  desenharMuros(p, alfa);
}
/* the walls of a walled tile (the vault): the ring of squares at level 2, lit like a raised top, with the drop to the floor
   inside shaded and a label on each side */
function desenharMuros(p, alfa) {
  const mu = murosDaPeca(p); if (!mu) return; const z = vista.zoom; const S = new Set(casasDaPeca(p).map(c => c.join(',')));
  ctx.save(); ctx.globalAlpha *= alfa;
  mu.casas.forEach(([x, y]) => { ctx.fillStyle = 'rgba(214,200,172,.55)'; ctx.fillRect(x * C, y * C, C, C);
    ctx.strokeStyle = 'rgba(90,75,55,.55)'; ctx.lineWidth = 1 / z; ctx.beginPath(); for (let k = 1; k < 3; k++) { ctx.moveTo(x * C, y * C + k * C / 3); ctx.lineTo((x + 1) * C, y * C + k * C / 3); } ctx.stroke(); });
  // the drop inside: a thick dark edge where a wall meets the floor
  ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 5 / z; ctx.beginPath();
  mu.casas.forEach(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const k = (x + dx) + ',' + (y + dy); if (!S.has(k) || mu.chaves.has(k)) return;
    if (dx === 1) { ctx.moveTo((x + 1) * C, y * C); ctx.lineTo((x + 1) * C, (y + 1) * C); } if (dx === -1) { ctx.moveTo(x * C, y * C); ctx.lineTo(x * C, (y + 1) * C); }
    if (dy === 1) { ctx.moveTo(x * C, (y + 1) * C); ctx.lineTo((x + 1) * C, (y + 1) * C); } if (dy === -1) { ctx.moveTo(x * C, y * C); ctx.lineTo((x + 1) * C, y * C); } }));
  ctx.stroke();
  const xs = mu.casas.map(c => c[0]), ys = mu.casas.map(c => c[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  ctx.fillStyle = '#3a2e1e'; ctx.font = `bold ${10 / z}px system-ui`; ctx.textAlign = 'center';
  const rot = tr('WALL · L') + ((p.level || 0) + mu.altura); ctx.fillText(rot, ((x0 + x1 + 1) / 2) * C, y0 * C + C * 0.62); ctx.fillText(rot, ((x0 + x1 + 1) / 2) * C, y1 * C + C * 0.62);
  ctx.textAlign = 'left'; ctx.restore();
}

// ------------------------------------------------------------ what is under the mouse (only the active room can be picked)
/* what can be picked at square x,y: only the active room (unless a trigger asks for any room) and only the ribbon level */
function candidatosEm(x, y, qualquerSala, todosNiveis) {
  const r = [];
  const salas = qualquerSala ? projeto.salas.map((s, si) => si) : [salaAtual];
  const ok = (lv, escada) => todosNiveis || noNivel(lv, escada);
  salas.forEach(si => {
    const s = projeto.salas[si]; if (!s) return;
    inimigosDaSala(s).forEach(({ e, origem }) => { if (e.pos[0] === x && e.pos[1] === y && ok(e.level)) r.push({ ...selDoInimigo(si, origem), nome: nomeIni(e.enemy) + (origem.tipo === 'sala' ? '' : ' (spawn)') }); });
    s.herois.forEach((h, hi) => { if (h[0] === x && h[1] === y && ok(h[2])) r.push({ tipo: 'heroi', sala: si, i: hi, nome: 'Hero space ' + (hi + 1) }); });
    s.objetos.forEach((o, oi) => { if (!ehTerreno(o) && ok(o.level) && casasDoObjeto(o).some(c => c[0] === x && c[1] === y)) r.push({ tipo: 'objeto', sala: si, i: oi, nome: rotulo(o) }); });
    s.objetos.forEach((o, oi) => { if (ehTerreno(o) && ok(o.level, ehTipo(o, 'Staircase')) && casasDoObjeto(o).some(c => c[0] === x && c[1] === y)) r.push({ tipo: 'objeto', sala: si, i: oi, nome: rotulo(o) }); });
    let melhor = null; s.pecas.forEach((p, pi) => { if (!ok(ehAlfombra(p.tile) ? 0 : p.level) || !casasDaPeca(p).some(c => c[0] === x && c[1] === y)) return; const lv = ehAlfombra(p.tile) ? -1 : (p.level || 0); if (!melhor || lv >= melhor.lv) melhor = { lv, q: { tipo: 'peca', sala: si, i: pi, nome: (ehAlfombra(p.tile) ? 'Underlay ' : 'Tile ') + nomePeca(p.tile) } }; });
    if (melhor) r.push(melhor.q);
  });
  return r;
}
function oQueHa(x, y, qualquerSala) { const c = candidatosEm(x, y, qualquerSala); return c[0] || null; }
/* the level of what sits at x,y on another level (to tell the user where to go), or null */
function outroNivelEm(x, y, qualquerSala) { const c = candidatosEm(x, y, qualquerSala, true)[0]; if (!c) return null; const it = c.tipo === 'peca' ? projeto.salas[c.sala].pecas[c.i] : c.tipo === 'heroi' ? null : listaDe(c)[c.i]; const lv = c.tipo === 'heroi' ? projeto.salas[c.sala].herois[c.i][2] : (c.tipo === 'peca' && ehAlfombra(it.tile) ? 0 : it?.level); return { ...c, nivel: lv || 0 }; }
function listaDe(q) { const s = projeto.salas[q.sala]; return q.tipo === 'inimigo' ? (q.g !== undefined ? gatDe(s, q).inimigos : s.inimigos) : q.tipo === 'objeto' ? s.objetos : q.tipo === 'heroi' ? s.herois : s.pecas; }
/* can a pillar of the chosen kind go at this point? it must be a socket (between two squares on a straight edge) of an elevated tile
   of the active room at the ribbon level, and that level must allow the pillar kind */
function pilarCabe(vx, vy) {
  const s = projeto.salas[salaAtual]; if (!s) return { ok: false, motivo: 'no room' };
  if (nivel === 0) return { ok: false, motivo: 'Pillars hold up elevated tiles: pick the level of that tile (1 to 3) on the ribbon first.' };
  if (pilarEm(vx, vy)) return { ok: false, motivo: 'There is already a pillar there.' };
  const k = vx + ',' + vy;
  if (s.pecas.some(p => ehCaixa(p.tile) && cantosDaPeca(p).has(vx + ',' + vy))) return { ok: false, motivo: 'The platform is a box standing on the floor: it needs no pillars.' };
  let peca = null, canto = false; s.pecas.forEach(p => { if (ehAlfombra(p.tile) || ehCaixa(p.tile) || (p.level || 0) !== nivel) return; if (encaixesDaPeca(p).has(k)) peca = p; else if (cantosDaPeca(p).has(k)) canto = true; });
  if (!peca) return { ok: false, motivo: canto ? 'No socket there: pillars fit only between two squares on a straight edge of the tile (never at its corners or inside it). The dots show the sockets.' : 'Pillars go in the sockets of an elevated tile of this room at level ' + nivel + ' (the dots on its edges).' };
  if (!pilaresPermitidos(peca.level).includes(pilarEscolhido)) return { ok: false, motivo: SUPORTES[pilarEscolhido].nome + ' is too short for a level ' + peca.level + ' tile: it takes ' + pilaresPermitidos(peca.level).map(x => SUPORTES[x].nome.toLowerCase()).join(' or ') + '.' };
  return { ok: true, peca };
}

// ------------------------------------------------------------ mouse
tela.addEventListener('mousemove', ev => {
  if (vista3d.on) return mouse3d('move', ev);
  if (arrasto) { vista.px = arrasto.px + (ev.clientX - arrasto.x); vista.py = arrasto.py + (ev.clientY - arrasto.y); arrasto.moveu = true; desenhar(); return; }
  const c = paraCasa(ev);
  if (movendoSala) { const dx = c[0] - movendoSala.de[0], dy = c[1] - movendoSala.de[1]; if (dx || dy) { moverPrevia(dx, dy); movendoSala.de = c; } return; }
  if (movendo) { const dx = c[0] - movendo.de[0], dy = c[1] - movendo.de[1]; if (!dx && !dy) return;
    if (movendo.tipo === 'peca') { moverPecaComAnexos(movendo.sala, movendo.i, dx, dy, movendo.anexos); movendo.total[0] += dx; movendo.total[1] += dy; movendo.de = c; }
    else if (movendo.tipo === 'heroi') { const it = listaDe(movendo)[movendo.i]; it[0] += dx; it[1] += dy; movendo.de = c; }
    else if (movendo.tipo === 'pilar') { return; }
    else { const it = listaDe(movendo)[movendo.i]; it.pos = [it.pos[0] + dx, it.pos[1] + dy]; movendo.total[0] += dx; movendo.total[1] += dy; movendo.de = c; }
    desenhar(); return; }
  cursor = c; cruz = paraCruzamento(ev); desenhar();
});
tela.addEventListener('mouseleave', () => { cursor = null; cruz = null; desenhar(); });
tela.addEventListener('contextmenu', ev => ev.preventDefault());
// a double click on something of another room makes that room the active one (and picks what was clicked); also with a tool
// in hand (its first click does nothing outside the active room) and from another level: the level goes to that of the tile
// clicked, when nothing of the room stands at the level on screen
tela.addEventListener('dblclick', ev => {
  if (vista3d.on || escolha) return;
  const [x, y] = paraCasa(ev); const fora = oQueHa(x, y, true);
  const naCasa = s => s.pecas.filter(q => casasDaPeca(q).some(c => c[0] === x && c[1] === y));
  const alvo = fora ? fora.sala : projeto.salas.findIndex(s => naCasa(s).length);
  if (alvo == null || alvo < 0 || alvo === salaAtual) return;
  salaAtual = alvo; sel = null; gatAberto = -1; arrasto = null; movendo = null;
  let mudouNivel = false;
  if (!fora) { const q = naCasa(projeto.salas[alvo]).filter(q => !ehAlfombra(q.tile)).sort((a, b) => (b.level || 0) - (a.level || 0))[0]; if (q && (q.level || 0) !== nivel) { nivel = q.level || 0; mudouNivel = true; } }
  const cands = candidatosEm(x, y, false); if (cands.length) sel = cands.find(c => c.tipo !== 'peca') || cands[0];
  tudo(); aviso('Room ' + (alvo + 1) + (projeto.salas[alvo].nome ? ' (' + projeto.salas[alvo].nome + ')' : '') + ' is now the active room' + (mudouNivel ? ' (level ' + nivel + ')' : '') + '.');
});
tela.addEventListener('mousedown', ev => {
  fecharPopupEscolha();
  if (vista3d.on) return mouse3d('down', ev);
  if (ev.button === 2 || ev.button === 1 || ev.shiftKey) { arrasto = { x: ev.clientX, y: ev.clientY, px: vista.px, py: vista.py }; return; }
  if (ev.button !== 0) return;
  if (salaAtual < 0) { arrasto = { x: ev.clientX, y: ev.clientY, px: vista.px, py: vista.py }; return; }
  const [x, y] = paraCasa(ev); const s = projeto.salas[salaAtual];
  // the generated room waiting on the board is dragged whole
  if (!escolha && !ferramenta && posicionandoPrevia() && chaoDaSala(GER.previa).has(x + ',' + y)) { movendoSala = { de: [x, y] }; tela.style.cursor = 'grabbing'; return; }
  if (escolha) { const q = oQueHa(x, y, true); let ok = false; try { ok = escolha.cb(x, y, q); } catch (e) { console.error(e); } if (ok) { if (escolha.repetir) { renderPropriedades(); renderSalas(); renderConferencia(); desenhar(); } else terminarClique(); } return; }
  if (!ferramenta) {
    const cz = cruzamentoPerto(ev); const pil = cz && pilarEm(cz[0], cz[1]);
    if (pil && pil.si === salaAtual && (pil.p.level || 0) === nivel) { sel = { tipo: 'pilar', sala: pil.si, pi: pil.pi, pos: [cz[0], cz[1]] }; tudo(); return; }
    const cands = candidatosEm(x, y, false);
    if (!cands.length) {
      const fora = oQueHa(x, y, true), outro = !fora && (outroNivelEm(x, y, false) || outroNivelEm(x, y, true));
      if (fora) aviso('That belongs to room ' + (fora.sala + 1) + ' (' + projeto.salas[fora.sala].nome + '). Double-click to make it the active room.');
      else if (outro) aviso('That is on level ' + outro.nivel + '. Pick level ' + outro.nivel + ' on the ribbon (PageUp / PageDown) to work on it.');
      sel = null; arrasto = { x: ev.clientX, y: ev.clientY, px: vista.px, py: vista.py, limpar: true }; tudo(); return; }
    const semPeca = cands.filter(c => c.tipo !== 'peca');
    if (semPeca.length > 1) { abrirPopupEscolha(ev, cands, q => { sel = q; gatAberto = -1; tudo(); }); return; }
    sel = cands[0]; gatAberto = -1; movendo = { ...sel, de: [x, y], total: [0, 0], anexos: sel.tipo === 'peca' ? anexosDaPeca(sel.sala, sel.i) : null }; tudo(); return;
  }
  if (ferramenta === 'apagar') {
    const cz = cruzamentoPerto(ev); const pil = cz && pilarEm(cz[0], cz[1]);
    if (pil && pil.si === salaAtual && (pil.p.level || 0) === nivel) { apagarSelecao({ tipo: 'pilar', sala: pil.si, pi: pil.pi, pos: [cz[0], cz[1]] }); return; }
    const q = oQueHa(x, y, false); if (!q) return;
    apagarSelecao(q); return;
  }
  if (ferramenta === 'peca') {
    const alfombra = ehAlfombra(pecaEscolhida);
    const caixa = ehCaixa(pecaEscolhida);
    const p = { tile: pecaEscolhida, pos: [x, y], rot, level: alfombra ? 0 : nivel, pilares: [] }; if (ehEspecial(pecaEscolhida)) p.level = nivelEspecial(p);   // (a special tile takes the level of where it stands)
    if (alfombra && usoAlfombra(pecaEscolhida) >= caixaAlfombra(pecaEscolhida)) return aviso(VERSO_ALFOMBRA[pecaEscolhida] ? 'All ' + CAIXA_ALFOMBRAS + ' ' + nomeAlfombra(pecaEscolhida) + ' / ' + nomeAlfombra(VERSO_ALFOMBRA[pecaEscolhida]) + ' cards are already on the map (the two faces share the same cards).' : 'All ' + caixaAlfombra(pecaEscolhida) + ' cop' + (caixaAlfombra(pecaEscolhida) > 1 ? 'ies' : 'y') + ' of ' + nomeAlfombra(pecaEscolhida) + ' are already on the map (change the copies in the Workshop).');
    if (alfombra && nivel > 0) return aviso('Underlays lie on the floor: pick level 0 on the ribbon.');
    if (!alfombra && s.pecas.some(q => numeroDaPeca(q.tile) === numeroDaPeca(p.tile)) && typeof Tutorial !== 'undefined' && Tutorial.ativo() && Tutorial.explicar('pecas-mesma-sala')) return;   // (the tutorial explains it the first time)
    if (!alfombra && s.pecas.some(q => numeroDaPeca(q.tile) === numeroDaPeca(p.tile))) return aviso(ehDaOficina(p.tile) ? 'The workshop tile ' + nomePeca(p.tile) + ' is already in this room (each one is a single piece).' : 'Tile ' + numeroDaPeca(p.tile) + ' is already in this room (side A or B).');
    if (colide(p, salaAtual, -1)) return aviso(alfombra ? 'It overlaps another underlay.' : 'It overlaps another tile of the same level.');
    const reuso = !alfombra && pecaReutilizada(numeroDaPeca(p.tile), salaAtual);
    const por = () => { s.pecas.push(p); sel = { tipo: 'peca', sala: salaAtual, i: s.pecas.length - 1 }; ferramenta = null; if (caixa) { if (nivel !== p.level) nivel = p.level; tudo(); avisoLongo(nomePeca(p.tile) + ' is a box with its top at level ' + p.level + ': it needs no pillars. The ribbon went to level ' + p.level + ' to work on top of it.'); return; } tudo(); if (p.level > 0) avisoLongo('Elevated tile (level ' + p.level + '): give it pillars in its sockets (between two squares on a straight edge) with the Pillar tool (' + pilaresPermitidos(p.level).map(k => SUPORTES[k].nome.toLowerCase()).join(', ') + ').'); };
    if (reuso) { avisarReuso(reuso, salaAtual, por); return; }
    por(); return;
  }
  if (ferramenta === 'heroi') {
    if (salaAtual !== 0) return aviso('Hero spaces go in the starting room only.');
    if (salaNoNivel(x, y, nivel) !== 0) return aviso('Put the heroes on a tile of the starting room at level ' + nivel + ' (the ribbon level).');
    if (s.herois.some(h => h[0] === x && h[1] === y)) return aviso('There is already a hero on that space.');
    if (s.herois.length >= 4) return aviso('At most 4 hero spaces.');
    s.herois.push([x, y, nivel]); tudo(); return;
  }
  if (ferramenta === 'objeto') {
    const terreno = ehTerreno({ type: objetoEscolhido });
    const v = varObj(objetoEscolhido);
    const o = { type: objetoEscolhido, pos: [x, y], rot, level: nivel, name: '', textClick: v?.textClick || '', textUse: v?.textUse || '', gatilhos: [], requisitos: [], senao: [] };
    if (escadaSemApoio(o)) return aviso(AVISO_ESCADA(nivel));
    // (an archway stands with its middle on the tiles: its feet may hang off them, as on the table)
    if (!terreno && !(ehArco(o) ? meioDoArco(o).meio : casasDoObjeto(o)).every(([cx, cy]) => salaNoNivel(cx, cy, nivel) === salaAtual)) return aviso(ehArco(o) ? 'Put the middle of the archway on tiles of this room at level ' + nivel + ' (its feet may hang off the tiles).' : 'Put the object on a tile of this room at level ' + nivel + ' (the ribbon level). Staircases and bridges are floor and may go off the tiles.');
    // the default version (the programming the piece carries in the game, or the Workshop's) or an empty one: the palette's choice
    // (a step of the tutorial asks for a door with no script: the box must be unticked first)
    if (typeof Tutorial !== 'undefined' && Tutorial.ativo() && Tutorial.exigeSemPadrao() && usarPadraoObjeto()) return avisoLongo(tr('Untick “Default script” first: a door with it opens a new room by itself.'), 6000);
    if (usarPadraoObjeto()) aplicarPadrao(o);
    const por = () => { s.objetos.push(o); sel = { tipo: 'objeto', sala: salaAtual, i: s.objetos.length - 1 }; ferramenta = null; gatAberto = -1; tudo();
      // more pieces on the table than the boxes hold: say so (the piece stays)
      const caixa = caixaDoTerreno(o.type); if (caixa !== null) { const uso = terrenoEmUso(o.type); if (uso > caixa) avisoLongo(tr('More than your boxes hold') + ': ' + uso + ' ' + tr('on the table') + ' / ' + caixa + ' ' + tr('in your boxes') + ' (' + nomeObj(baseObj(o.type)) + ').' + partilhaDe(grupoDoTerreno(o.type))); }
      // a door, a gate or a point of interest with its default script opens a room: the room is created at once and tied to
      // it (the user lays its tiles next); the trigger can still be pointed at another room
      const abre = (o.gatilhos || []).find(g => g.tipo === 'open_room' && (g.sala === '' || g.sala == null));
      if (abre && ['Door', 'Gate', 'SightToken'].includes(baseObj(o.type))) { const si = salaAtual, oi = s.objetos.length - 1; const nova = novaSala({ sala: si, objeto: oi }); abre.sala = nova; limparAbridores(); tudo();
        avisoLongo(L2('“' + rotulo(o) + '” opens room ' + (nova + 1) + '. Lay its tiles now: they stay hidden until it is used.', '“' + rotulo(o) + '” abre a sala ' + (nova + 1) + '. Coloquem as peças dela agora: elas ficam ocultas até o objeto ser usado.'), 6000); } };
    // a pillar object takes a pillar from the boxes (the interactive pillar a medium one)
    const semPilar = k => { const ex = excessoDePilares(k, salaAtual); if (ex === 'wait') return true; if (ex) { avisoLongo(ex); return true; } return false; };
    if (objetoEscolhido === 'PillarPush') { escolherOpcao('Size of the interactive pillar', TAMANHOS_INTERATIVO.map(k => ({ id: k, titulo: SUPORTES[k].nome, sub: caixaDoPilar(k) + ' in the boxes (' + SUPORTES[k].porAto + ')' })), k => { if (semPilar(k)) return; o.tamanho = k; por(); }, 'A pillar the heroes use like a door or a chest.'); return; }
    if (objetoEscolhido === 'PillarObj') { escolherOpcao('Size of the pillar', Object.entries(SUPORTES).map(([k, v]) => ({ id: k, titulo: v.nome, sub: 'Reaches level ' + v.nivel + ' · ' + caixaDoPilar(k) + ' in the boxes (' + v.porAto + ')' })), k => { if (semPilar(k)) return; o.tamanho = k; por(); }, 'A column standing on a square, used as an object (it holds up no tile).'); return; }
    por(); return;
  }
  if (ferramenta === 'pilar') {
    const [vx, vy] = paraCruzamento(ev);
    const cabe = pilarCabe(vx, vy); if (!cabe.ok) return aviso(cabe.motivo);
    const excede = excessoDePilares(pilarEscolhido, salaAtual); if (excede === 'wait') return; if (excede) return avisoLongo(excede);
    cabe.peca.pilares.push({ pos: [vx, vy], type: pilarEscolhido }); sel = { tipo: 'pilar', sala: salaAtual, pi: s.pecas.indexOf(cabe.peca), pos: [vx, vy] }; tudo();
    return;
  }
  if (ferramenta === 'inimigo') {
    if (!inimigoEscolhido || (!ehPool(inimigoEscolhido) && !monstro(inimigoEscolhido))) return aviso('Pick a monster in the palette first. No monsters yet? Open the Workshop and import or create one.');
    if (salaNoNivel(x, y, nivel) !== salaAtual) return aviso('Put the enemy on a tile of this room at level ' + nivel + ' (the ribbon level).');
    if (inimigosDaSala(s).some(({ e }) => e.pos[0] === x && e.pos[1] === y)) return aviso('There is already an enemy on that space.');
    s.inimigos.push(ehPool(inimigoEscolhido) ? { enemy: POOL_ID, pos: [x, y], level: nivel } : { enemy: inimigoEscolhido, pos: [x, y], tier: (monstro(inimigoEscolhido)?.tiers || [{ tier: 1 }])[0].tier, level: nivel }); sel = { tipo: 'inimigo', sala: salaAtual, i: s.inimigos.length - 1 }; tudo(); return;
  }
});
window.addEventListener('mouseup', ev => {
  if (vista3d.on) return mouse3d('up', ev);
  if (arrasto) { const a = arrasto; arrasto = null; if (a.limpar && !a.moveu) { sel = null; tudo(); } }
  if (movendoSala) { movendoSala = null; tudo(); renderLugarPrevia(); }
  if (movendo) { const q = movendo; movendo = null;
    // a tile released over another one goes back to where it was, with what it carries
    if (q.tipo === 'peca') { const p = projeto.salas[q.sala]?.pecas[q.i]; if (p && colide(p, q.sala, q.i)) { moverPecaComAnexos(q.sala, q.i, -q.total[0], -q.total[1], q.anexos); aviso('It overlapped another tile of the same level: it went back to where it was.'); } }
    // a staircase dragged off its tiles (level 1 up) goes back
    if (q.tipo === 'objeto') { const o = projeto.salas[q.sala]?.objetos[q.i]; if (o && escadaSemApoio(o)) { o.pos = [o.pos[0] - q.total[0], o.pos[1] - q.total[1]]; aviso(AVISO_ESCADA(o.level)); } }
    tudo(); }
});
tela.addEventListener('wheel', ev => { ev.preventDefault(); if (vista3d.on) return mouse3d('wheel', ev); const r = tela.getBoundingClientRect(); const mx = ev.clientX - r.left, my = ev.clientY - r.top;
  const f = ev.deltaY < 0 ? 1.15 : 1 / 1.15; const z = Math.min(4, Math.max(0.2, vista.zoom * f)); const k = z / vista.zoom;
  vista.px = mx - (mx - vista.px) * k; vista.py = my - (my - vista.py) * k; vista.zoom = z; desenhar(); }, { passive: false });
function zoomCentro(f) { if (vista3d.on) return zoom3d(f); const r = tela.getBoundingClientRect(); const mx = r.width / 2, my = r.height / 2; const z = Math.min(4, Math.max(0.2, vista.zoom * f)); const k = z / vista.zoom; vista.px = mx - (mx - vista.px) * k; vista.py = my - (my - vista.py) * k; vista.zoom = z; desenhar(); }
function enquadrar() {
  if (vista3d.on) return enquadrar3d();
  const casas = projeto.salas.flatMap(s => s.pecas.flatMap(casasDaPeca).concat(s.objetos.flatMap(casasDoObjeto)));
  const r = tela.getBoundingClientRect();
  if (!casas.length) { vista.zoom = 1; vista.px = r.width / 2 - 20 * C; vista.py = r.height / 2 - 20 * C; return desenhar(); }
  const xs = casas.map(c => c[0]), ys = casas.map(c => c[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
  vista.zoom = Math.min(3, Math.max(0.3, Math.min(r.width / ((x1 - x0 + 4) * C), r.height / ((y1 - y0 + 4) * C))));
  vista.px = r.width / 2 - (x0 + x1) / 2 * C * vista.zoom; vista.py = r.height / 2 - (y0 + y1) / 2 * C * vista.zoom; desenhar();
}
/* the camera on one room (a click on it in the list): centred on it, zoomed out only when it would not fit */
function enquadrarSala(si) {
  const s = projeto.salas[si]; if (!s) return; const casas = s.pecas.flatMap(casasDaPeca).concat(s.objetos.flatMap(casasDoObjeto)); if (!casas.length) return;
  const r = tela.getBoundingClientRect(); const xs = casas.map(c => c[0]), ys = casas.map(c => c[1]); const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
  const cabe = Math.min(3, Math.max(0.3, Math.min(r.width / ((x1 - x0 + 4) * C), r.height / ((y1 - y0 + 4) * C))));
  vista.zoom = Math.min(vista.zoom, cabe);
  vista.px = r.width / 2 - (x0 + x1) / 2 * C * vista.zoom; vista.py = r.height / 2 - (y0 + y1) / 2 * C * vista.zoom; desenhar();
}
setInterval(() => { if (escolha) { if (escolha.modo === 'object') desenhar(); tela.style.cursor = 'pointer'; } else { const c = ferramenta ? 'crosshair' : 'default'; if (tela.style.cursor !== c) tela.style.cursor = c; } }, 80);

/* arrows: the selected tile (with what sits on it), object, pillar, hero or enemy moves one square; with nothing selected the view pans */
function moverSelecao(dx, dy) {
  if (!sel || sel.tipo === 'contador') return;
  if (sel.tipo === 'pilar') return aviso('Pillars stay in the sockets of their tile: move the tile.');
  const s = projeto.salas[sel.sala]; const lista = listaDe(sel); const it = lista[sel.i]; if (!it) return;
  if (sel.tipo === 'peca') { const np = { ...it, pos: [it.pos[0] + dx, it.pos[1] + dy] }; if (colide(np, sel.sala, sel.i)) return aviso('It would overlap another tile.'); moverPecaComAnexos(sel.sala, sel.i, dx, dy); }
  else if (sel.tipo === 'heroi') { it[0] += dx; it[1] += dy; }
  else { it.pos = [it.pos[0] + dx, it.pos[1] + dy]; }
  tudo();
}
/* the popup that asks which of the overlapping pieces the click meant */
function abrirPopupEscolha(ev, cands, cb) {
  fecharPopupEscolha();
  const d = document.createElement('div'); d.id = 'popupEscolha';
  d.innerHTML = '<div class="titulo">Which one?</div>' + cands.map((c, i) => `<button data-i="${i}">${esc(c.nome)}<small>${c.tipo}</small></button>`).join('');
  d.style.left = (ev.clientX + 8) + 'px'; d.style.top = (ev.clientY + 8) + 'px';
  d.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const q = cands[+b.dataset.i]; fecharPopupEscolha(); cb(q); });
  document.body.appendChild(d);
}
function fecharPopupEscolha() { const d = $('#popupEscolha'); if (d) d.remove(); }
