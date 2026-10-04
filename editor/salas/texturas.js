/* Bigorna Rooms: pictures and 3D stand-ins of the game's own objects, drawn here (nothing from the game).
   Each object has a texture seen from above (TEX_PX pixels per square, the object's own width × height, before
   rotation); the 3D view builds the object's cardboard piece from it (papelao.js). */
'use strict';

const TEX_PX = 64;
const TEXTURAS_OBJ = {};                     // game object id -> Image (texture seen from above)

// ------------------------------------------------------------ painting helpers
function tom(hex, k) {       // k > 1 lightens, k < 1 darkens
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex; const n = parseInt(m[1], 16);
  const f = c => Math.max(0, Math.min(255, Math.round(k >= 1 ? c + (255 - c) * (k - 1) : c * k)));
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
function sombraOval(g, cx, cy, rx, ry, a = 0.38) {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry)); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(cx, cy); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-cx, -cy); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2); g.fill(); g.restore();
}
function sombraRet(g, x, y, w, h, d = 5) { g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = d * 1.6; g.shadowOffsetX = d * 0.4; g.shadowOffsetY = d * 0.6; g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.restore(); }
function ret(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r || 0); else g.rect(x, y, w, h); }
/* planks along the longer side (or `vertical`), with seams, grain and knots */
function madeira(g, x, y, w, h, cor, opt = {}) {
  const r = rngDe(opt.seed || 7); const vert = opt.vertical ?? (h > w); const L = vert ? h : w, T = vert ? w : h;
  const n = opt.tabuas || Math.max(2, Math.round(T / 13)); const t = T / n;
  g.save(); ret(g, x, y, w, h, opt.raio || 0); g.clip();
  for (let i = 0; i < n; i++) {
    const c = tom(cor, 0.88 + r() * 0.24); g.fillStyle = c;
    if (vert) g.fillRect(x + i * t, y, t + 0.5, h); else g.fillRect(x, y + i * t, w, t + 0.5);
    g.strokeStyle = tom(cor, 0.72); g.lineWidth = 0.8; g.globalAlpha = 0.55;
    for (let k = 0; k < 3; k++) { const o = t * (0.2 + r() * 0.6); g.beginPath();
      for (let s = 0; s <= 8; s++) { const a = L * s / 8, b = o + Math.sin(s * 1.3 + r() * 2) * 1.2; vert ? (s ? g.lineTo(x + i * t + b, y + a) : g.moveTo(x + i * t + b, y + a)) : (s ? g.lineTo(x + a, y + i * t + b) : g.moveTo(x + a, y + i * t + b)); }
      g.stroke(); }
    g.globalAlpha = 1;
    if (r() < 0.5) { const a = L * (0.15 + r() * 0.7), b = t * (0.3 + r() * 0.4); g.fillStyle = tom(cor, 0.6); g.beginPath(); vert ? g.ellipse(x + i * t + b, y + a, 1.6, 2.6, 0, 0, 7) : g.ellipse(x + a, y + i * t + b, 2.6, 1.6, 0, 0, 7); g.fill(); }
    if (i) { g.fillStyle = 'rgba(0,0,0,.45)'; vert ? g.fillRect(x + i * t - 0.6, y, 1.2, h) : g.fillRect(x, y + i * t - 0.6, w, 1.2); }
  }
  g.restore();
  if (opt.borda !== false) { g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.4; ret(g, x + 0.7, y + 0.7, w - 1.4, h - 1.4, opt.raio || 0); g.stroke(); }
}
/* stones in courses, each a little different, with mortar */
function pedras(g, x, y, w, h, cor, opt = {}) {
  const r = rngDe(opt.seed || 11); const lh = opt.alt || 12; g.save(); ret(g, x, y, w, h, opt.raio || 0); g.clip();
  g.fillStyle = tom(cor, 0.55); g.fillRect(x, y, w, h);
  for (let j = 0, yy = y; yy < y + h; j++, yy += lh) {
    let xx = x - (j % 2 ? lh * 0.7 : 0);
    while (xx < x + w) { const lw = lh * (1.2 + r() * 1.2); g.fillStyle = tom(cor, 0.85 + r() * 0.3); ret(g, xx + 0.8, yy + 0.8, lw - 1.6, lh - 1.6, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(xx + 1.5, yy + 1.2, lw - 3, 1.5); xx += lw; }
  }
  g.restore();
}
function circulo(g, cx, cy, r, fill, stroke, lw = 1.5) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
function anelDePedras(g, cx, cy, r0, r1, cor, n, seed) {
  const r = rngDe(seed || 3);
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2 + 0.03, a1 = (i + 1) / n * Math.PI * 2 - 0.03;
    g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fillStyle = tom(cor, 0.82 + r() * 0.3); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.stroke(); }
}
function rebite(g, x, y, r = 1.6) { circulo(g, x, y, r, '#c9c2b0'); circulo(g, x - 0.4, y - 0.4, r * 0.45, '#fff'); }
function faixaMetal(g, x, y, w, h, cor = '#50555c') { const gr = g.createLinearGradient(x, y, x + (w < h ? w : 0), y + (w < h ? 0 : h)); gr.addColorStop(0, tom(cor, 1.35)); gr.addColorStop(0.5, cor); gr.addColorStop(1, tom(cor, 0.65)); g.fillStyle = gr; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.8; g.strokeRect(x, y, w, h); }
function chama(g, cx, cy, r) {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.3, '#ffd24a'); gr.addColorStop(0.65, '#f07a22'); gr.addColorStop(1, 'rgba(200,40,10,0)');
  g.fillStyle = gr; g.beginPath(); for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2, rr = r * (i % 2 ? 0.62 : 1); g[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill();
}

// ------------------------------------------------------------ the objects
/* w, h: squares; pintar(g, P): the texture (P px per square). The 3D stand-ins are the cardboard pieces of papelao.js */
const ARTE_OBJ = {
  Chest: { w: 1, h: 1, pintar(g, P) {
      sombraRet(g, P * 0.14, P * 0.24, P * 0.72, P * 0.54);
      madeira(g, P * 0.14, P * 0.24, P * 0.72, P * 0.54, '#8a5a30', { tabuas: 4, seed: 2 });
      [0.24, 0.66].forEach(f => { faixaMetal(g, P * (0.14 + f * 0.72) - 3, P * 0.24, 6, P * 0.54); rebite(g, P * (0.14 + f * 0.72), P * 0.29); rebite(g, P * (0.14 + f * 0.72), P * 0.73); });
      g.fillStyle = '#c8a24a'; ret(g, P * 0.45, P * 0.7, P * 0.1, P * 0.1, 2); g.fill(); g.fillStyle = '#2a1d10'; g.fillRect(P * 0.49, P * 0.735, 2, 4);
    }},
  Shelf: { w: 2, h: 1, pintar(g, P) {
      sombraRet(g, P * 0.08, P * 0.18, P * 1.84, P * 0.64);
      madeira(g, P * 0.08, P * 0.18, P * 1.84, P * 0.64, '#6e4526', { tabuas: 3, seed: 4 });
      const r = rngDe(9); let x = P * 0.14; const cores = ['#8c2f2a', '#2f5a8c', '#3d7a3a', '#8c6d2a', '#5a3a7a', '#7a2f5a', '#2f6d6d'];
      while (x < P * 1.84) { const bw = 5 + r() * 6; g.fillStyle = cores[Math.floor(r() * cores.length)]; g.fillRect(x, P * 0.62, bw - 1, P * 0.14); g.fillStyle = 'rgba(255,240,200,.35)'; g.fillRect(x + 1, P * 0.63, bw - 3, 2); x += bw; }
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(P * 0.08, P * 0.6, P * 1.84, 2);
    }},
  Lectern: { w: 1, h: 1, pintar(g, P) {
      sombraRet(g, P * 0.2, P * 0.22, P * 0.6, P * 0.56);
      madeira(g, P * 0.2, P * 0.22, P * 0.6, P * 0.56, '#7a4a28', { tabuas: 3, seed: 6 });
      g.save(); g.translate(P * 0.5, P * 0.5); g.rotate(-0.06);
      g.fillStyle = '#5a2a1a'; ret(g, -P * 0.25, -P * 0.18, P * 0.5, P * 0.34, 3); g.fill();
      g.fillStyle = '#efe4c6'; ret(g, -P * 0.23, -P * 0.16, P * 0.22, P * 0.3, 2); g.fill(); ret(g, P * 0.01, -P * 0.16, P * 0.22, P * 0.3, 2); g.fill();
      g.strokeStyle = 'rgba(80,60,40,.5)'; g.lineWidth = 0.8; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-P * 0.2, -P * 0.11 + i * 4); g.lineTo(-P * 0.04, -P * 0.11 + i * 4); g.moveTo(P * 0.04, -P * 0.11 + i * 4); g.lineTo(P * 0.2, -P * 0.11 + i * 4); g.stroke(); }
      g.fillStyle = '#a0201e'; g.fillRect(-1, -P * 0.16, 2, P * 0.36); g.restore();
    }},
  Well: { w: 1, h: 1, pintar(g, P) {
      const c = P / 2; sombraOval(g, c + 3, c + 4, P * 0.44, P * 0.44);
      anelDePedras(g, c, c, P * 0.27, P * 0.42, '#8b8577', 11, 4);
      const gr = g.createRadialGradient(c - 4, c - 4, 2, c, c, P * 0.27); gr.addColorStop(0, '#2d5a70'); gr.addColorStop(1, '#0b1a22'); circulo(g, c, c, P * 0.27, gr);
      circulo(g, c - 6, c - 5, 3, 'rgba(200,230,255,.35)');
      faixaMetal(g, P * 0.06, c - 3, P * 0.88, 6, '#6b4a2a'); circulo(g, c, c, 5, '#7a5a38', '#2a1d10', 1);
    }},
  Cauldron: { w: 1, h: 1, pintar(g, P) {
      const c = P / 2; sombraOval(g, c + 3, c + 4, P * 0.42, P * 0.42);
      circulo(g, c, c, P * 0.39, '#2a2a2e', '#0c0c0e', 2); circulo(g, c, c, P * 0.33, '#141416');
      const gr = g.createRadialGradient(c, c, 2, c, c, P * 0.31); gr.addColorStop(0, '#9be05a'); gr.addColorStop(1, '#2f6a1e'); circulo(g, c, c, P * 0.31, gr);
      const r = rngDe(12); for (let i = 0; i < 7; i++) circulo(g, c + (r() - 0.5) * P * 0.4, c + (r() - 0.5) * P * 0.4, 1.5 + r() * 3, 'rgba(220,255,180,.45)', 'rgba(40,90,20,.6)', 0.8);
      g.strokeStyle = '#55555c'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, P * 0.39, 0.1 * Math.PI, 0.9 * Math.PI, true); g.stroke();
    }},
  Door: { w: 2, h: 1, pintar(g, P) {
      pedras(g, 0, P * 0.3, P * 0.18, P * 0.4, '#8a8478', { alt: 8 }); pedras(g, P * 1.82, P * 0.3, P * 0.18, P * 0.4, '#8a8478', { alt: 8, seed: 3 });
      sombraRet(g, P * 0.18, P * 0.34, P * 1.64, P * 0.32, 3);
      madeira(g, P * 0.18, P * 0.34, P * 1.64, P * 0.32, '#7a4c28', { tabuas: 2, seed: 8 });
      [0.45, 1.55].forEach(f => faixaMetal(g, P * f - 3, P * 0.34, 6, P * 0.32));
      circulo(g, P * 1.0, P * 0.5, 5, null, '#b8a36a', 2); rebite(g, P * 1.0, P * 0.5, 2);
    }},
  SightToken: { w: 1, h: 1, pintar(g, P) {
      const c = P / 2; sombraOval(g, c + 2, c + 3, P * 0.4, P * 0.4, 0.45);
      const gr = g.createRadialGradient(c - 6, c - 6, 2, c, c, P * 0.38); gr.addColorStop(0, '#f6e6b6'); gr.addColorStop(1, '#b8914a'); circulo(g, c, c, P * 0.38, gr, '#5a4420', 2);
      g.fillStyle = '#fbf6e8'; g.beginPath(); g.moveTo(c - P * 0.26, c); g.quadraticCurveTo(c, c - P * 0.22, c + P * 0.26, c); g.quadraticCurveTo(c, c + P * 0.22, c - P * 0.26, c); g.fill(); g.strokeStyle = '#3a2a14'; g.lineWidth = 2; g.stroke();
      circulo(g, c, c, P * 0.1, '#3a6a8c'); circulo(g, c, c, P * 0.05, '#101418'); circulo(g, c - 2.5, c - 2.5, 1.8, '#fff');
    }},
  InteractToken: { w: 1, h: 1, pintar(g, P) {
      const c = P / 2; sombraOval(g, c + 2, c + 3, P * 0.4, P * 0.4, 0.45);
      const gr = g.createRadialGradient(c - 6, c - 6, 2, c, c, P * 0.38); gr.addColorStop(0, '#d8e6f2'); gr.addColorStop(1, '#6a86a0'); circulo(g, c, c, P * 0.38, gr, '#26384a', 2);
      g.strokeStyle = '#1c2a38'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.moveTo(c + Math.cos(a) * 7, c + Math.sin(a) * 7); g.lineTo(c + Math.cos(a) * P * 0.26, c + Math.sin(a) * P * 0.26); } g.stroke();
      circulo(g, c, c, 6, '#f3cf8f', '#1c2a38', 2);
    }},
  Bell: { w: 4, h: 1, pintar(g, P) {
      [0.1, 3.7].forEach((x, i) => { sombraRet(g, P * x, P * 0.2, P * 0.2, P * 0.6); madeira(g, P * x, P * 0.2, P * 0.2, P * 0.6, '#5e3c20', { tabuas: 2, vertical: true, seed: 20 + i }); });
      sombraRet(g, P * 0.1, P * 0.42, P * 3.8, P * 0.16, 3); madeira(g, P * 0.1, P * 0.42, P * 3.8, P * 0.16, '#6e4828', { tabuas: 1, seed: 22 });
      const c = P * 2, cy = P * 0.5; sombraOval(g, c + 4, cy + 5, P * 0.5, P * 0.46);
      const gr = g.createRadialGradient(c - 10, cy - 10, 3, c, cy, P * 0.46); gr.addColorStop(0, '#f2d38a'); gr.addColorStop(0.55, '#b88a38'); gr.addColorStop(1, '#6a4a1a'); circulo(g, c, cy, P * 0.46, gr, '#3a2810', 2);
      circulo(g, c, cy, P * 0.3, null, 'rgba(60,40,10,.6)', 2); circulo(g, c, cy, P * 0.12, '#8a6428', '#3a2810', 1.5); circulo(g, c, cy, 3, '#3a2810');
    }},
  BellFrame: { w: 4, h: 1, pintar(g, P) {
      [0.1, 3.7].forEach((x, i) => { sombraRet(g, P * x, P * 0.2, P * 0.2, P * 0.6); madeira(g, P * x, P * 0.2, P * 0.2, P * 0.6, '#5e3c20', { tabuas: 2, vertical: true, seed: 20 + i }); });
      sombraRet(g, P * 0.1, P * 0.42, P * 3.8, P * 0.16, 3); madeira(g, P * 0.1, P * 0.42, P * 3.8, P * 0.16, '#6e4828', { tabuas: 1, seed: 22 });
    }},
  BloodShrine: { w: 1, h: 1, pintar(g, P) {
      sombraRet(g, P * 0.12, P * 0.12, P * 0.76, P * 0.76);
      pedras(g, P * 0.12, P * 0.12, P * 0.76, P * 0.76, '#6c6560', { alt: 10, seed: 5, raio: 4 });
      const gr = g.createRadialGradient(P * 0.5, P * 0.5, 2, P * 0.5, P * 0.5, P * 0.24); gr.addColorStop(0, '#d0202a'); gr.addColorStop(1, '#4a0508');
      g.fillStyle = gr; g.beginPath(); g.ellipse(P * 0.5, P * 0.5, P * 0.24, P * 0.2, 0.3, 0, 7); g.fill();
      g.fillStyle = '#7a0a10'; [[0.3, 0.72, 3], [0.68, 0.28, 2.5], [0.74, 0.66, 2]].forEach(([x, y, r]) => circulo(g, P * x, P * y, r, '#7a0a10'));
      [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].forEach(([x, y]) => { circulo(g, P * x, P * y, 4, '#e8dcc0', '#6a5a40', 1); chama(g, P * x, P * y, 4); });
      circulo(g, P * 0.45, P * 0.44, 3, 'rgba(255,200,200,.35)');
    }},
  Fire: { w: 1, h: 1, pintar(g, P) {
      const c = P / 2; anelDePedras(g, c, c, P * 0.3, P * 0.42, '#6e6862', 9, 7);
      circulo(g, c, c, P * 0.3, '#1e1410');
      g.lineCap = 'round'; [[-0.6, '#6a4424'], [0.5, '#5a3a1e'], [1.6, '#7a4e2a']].forEach(([a, cor]) => { g.strokeStyle = cor; g.lineWidth = 7; g.beginPath(); g.moveTo(c + Math.cos(a) * P * 0.26, c + Math.sin(a) * P * 0.26); g.lineTo(c - Math.cos(a) * P * 0.22, c - Math.sin(a) * P * 0.22); g.stroke(); });
      chama(g, c, c, P * 0.27); chama(g, c + 3, c - 4, P * 0.14);
    }},
  Ladder: { w: 1, h: 1, pintar(g, P) { pintarEscadaDeMao(g, P, 1); }},
  LadderMedium: { w: 1, h: 1, pintar(g, P) { pintarEscadaDeMao(g, P, 1.4); }},
  Statue: { w: 3, h: 3, pintar(g, P) {
      const c = P * 1.5; sombraOval(g, c + 6, c + 8, P * 1.4, P * 1.4, 0.45);
      g.save(); g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; g.lineTo(c + Math.cos(a) * P * 1.38, c + Math.sin(a) * P * 1.38); } g.closePath(); g.clip();
      pedras(g, 0, 0, P * 3, P * 3, '#9a948a', { alt: 16, seed: 14 }); g.restore();
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; g.lineTo(c + Math.cos(a) * P * 1.38, c + Math.sin(a) * P * 1.38); } g.closePath(); g.stroke();
      circulo(g, c, c, P * 0.95, '#aaa498', 'rgba(0,0,0,.45)', 2);
      // the figure from above: a cloaked warrior, pauldrons, helmet, a shield on one arm and a sword held forward
      sombraOval(g, c + 6, c + 8, P * 0.7, P * 0.62, 0.5);
      const pedra = g.createRadialGradient(c - 16, c - 16, 4, c, c, P * 0.8); pedra.addColorStop(0, '#ebe6db'); pedra.addColorStop(1, '#8e887c');
      g.fillStyle = pedra; g.strokeStyle = '#5a554c'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(c - P * 0.42, c - P * 0.12); g.quadraticCurveTo(c - P * 0.62, c + P * 0.5, c - P * 0.2, c + P * 0.66); g.quadraticCurveTo(c, c + P * 0.74, c + P * 0.2, c + P * 0.66); g.quadraticCurveTo(c + P * 0.62, c + P * 0.5, c + P * 0.42, c - P * 0.12); g.quadraticCurveTo(c, c - P * 0.3, c - P * 0.42, c - P * 0.12); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(90,85,76,.5)'; g.lineWidth = 1.5; [-0.2, 0, 0.2].forEach(f => { g.beginPath(); g.moveTo(c + f * P, c + P * 0.05); g.quadraticCurveTo(c + f * P * 1.3, c + P * 0.4, c + f * P * 1.1, c + P * 0.66); g.stroke(); });
      [-1, 1].forEach(sx => { circulo(g, c + sx * P * 0.36, c - P * 0.1, P * 0.17, pedra, '#5a554c', 2.5); circulo(g, c + sx * P * 0.36, c - P * 0.1, P * 0.08, null, 'rgba(90,85,76,.5)', 1.5); });
      g.save(); g.translate(c - P * 0.58, c + P * 0.05); g.fillStyle = pedra; g.strokeStyle = '#5a554c'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, P * 0.18, P * 0.3, -0.2, 0, 7); g.fill(); g.stroke(); circulo(g, 0, 0, P * 0.06, '#c9c3b6', '#5a554c', 1.5); g.restore();
      g.lineCap = 'round'; g.strokeStyle = '#5a554c'; g.lineWidth = 8; g.beginPath(); g.moveTo(c + P * 0.42, c); g.lineTo(c + P * 0.62, c - P * 0.9); g.stroke(); g.strokeStyle = '#e4e0d6'; g.lineWidth = 4.5; g.stroke();
      g.strokeStyle = '#5a554c'; g.lineWidth = 5; g.beginPath(); g.moveTo(c + P * 0.3, c - P * 0.04); g.lineTo(c + P * 0.56, c + P * 0.06); g.stroke();
      circulo(g, c, c - P * 0.14, P * 0.2, pedra, '#5a554c', 2.5); g.strokeStyle = '#5a554c'; g.lineWidth = 3; g.beginPath(); g.moveTo(c, c - P * 0.34); g.lineTo(c, c + P * 0.06); g.stroke();
    }},
  Wagon: { w: 3, h: 2, pintar(g, P) {
      sombraRet(g, P * 0.2, P * 0.24, P * 2.3, P * 1.52, 6);
      [[0.5, 0.08], [2.0, 0.08], [0.5, 1.72], [2.0, 1.72]].forEach(([x, y]) => { g.fillStyle = '#3a2614'; ret(g, P * x - P * 0.2, P * y, P * 0.4, P * 0.2, 3); g.fill(); g.strokeStyle = '#1a100a'; g.lineWidth = 1.5; g.stroke(); for (let k = 1; k < 4; k++) { g.fillStyle = '#5e4226'; g.fillRect(P * x - P * 0.2 + k * P * 0.1, P * y + 2, 2, P * 0.2 - 4); } });
      madeira(g, P * 0.2, P * 0.24, P * 2.3, P * 1.52, '#8a6034', { tabuas: 6, seed: 30 });
      g.strokeStyle = '#4a3018'; g.lineWidth = 5; g.strokeRect(P * 0.22, P * 0.26, P * 2.26, P * 1.48);
      g.strokeStyle = '#5e3c20'; g.lineWidth = 5; g.beginPath(); g.moveTo(P * 2.5, P * 0.7); g.lineTo(P * 2.96, P * 0.84); g.moveTo(P * 2.5, P * 1.3); g.lineTo(P * 2.96, P * 1.16); g.stroke();
      const saco = (x, y, r) => { sombraOval(g, x + 3, y + 3, r, r * 0.9); const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); gr.addColorStop(0, '#e2cfa0'); gr.addColorStop(1, '#9a8054'); circulo(g, x, y, r, gr, '#5a4626', 1.5); g.fillStyle = '#6a5230'; g.fillRect(x - 2, y - r * 0.2, 4, r * 0.4); };
      saco(P * 0.75, P * 0.75, P * 0.3); saco(P * 1.2, P * 1.2, P * 0.28);
      sombraRet(g, P * 1.55, P * 0.5, P * 0.6, P * 0.6, 4); madeira(g, P * 1.55, P * 0.5, P * 0.6, P * 0.6, '#b08450', { tabuas: 3, seed: 31 }); g.strokeStyle = '#5a3c1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(P * 1.55, P * 0.5); g.lineTo(P * 2.15, P * 1.1); g.moveTo(P * 2.15, P * 0.5); g.lineTo(P * 1.55, P * 1.1); g.stroke();
    }},
  Archway: { w: 4, h: 1, pintar(g, P) {
      [0, 3.25].forEach((x, i) => { sombraRet(g, P * x + 2, P * 0.16, P * 0.75, P * 0.68); pedras(g, P * x + 2, P * 0.16, P * 0.75 - 4, P * 0.68, '#8e887c', { alt: 10, seed: 40 + i }); });
      sombraRet(g, P * 0.3, P * 0.3, P * 3.4, P * 0.4, 3);
      g.save(); ret(g, P * 0.3, P * 0.3, P * 3.4, P * 0.4, 3); g.clip(); for (let i = 0; i < 13; i++) { g.fillStyle = tom('#a09a8e', 0.85 + (i % 3) * 0.1); g.fillRect(P * 0.3 + i * P * 3.4 / 13 + 1, P * 0.3, P * 3.4 / 13 - 2, P * 0.4); } g.restore();
      g.fillStyle = '#c9b77a'; g.beginPath(); g.moveTo(P * 2, P * 0.32); g.lineTo(P * 2.14, P * 0.5); g.lineTo(P * 2, P * 0.68); g.lineTo(P * 1.86, P * 0.5); g.fill();
    }},
  Barricade: { w: 2, h: 1, pintar(g, P) {
      const r = rngDe(44); sombraRet(g, P * 0.1, P * 0.4, P * 1.8, P * 0.2, 4);
      g.lineCap = 'round';
      const tronco = (x0, y0, x1, y1, e) => { g.strokeStyle = '#3a2614'; g.lineWidth = e + 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = '#7a5430'; g.lineWidth = e; g.stroke(); g.strokeStyle = 'rgba(255,220,170,.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, y0 - e * 0.2); g.lineTo(x1, y1 - e * 0.2); g.stroke(); };
      tronco(P * 0.08, P * 0.5, P * 1.92, P * 0.5, 9);
      for (let i = 0; i < 5; i++) { const x = P * (0.25 + i * 0.37); tronco(x - P * 0.12, P * 0.9, x + P * 0.12, P * 0.1, 6);
        g.fillStyle = '#d8c09a'; g.beginPath(); g.moveTo(x + P * 0.12, P * 0.1); g.lineTo(x + P * 0.09, P * 0.2); g.lineTo(x + P * 0.16, P * 0.19); g.fill(); }
      [[0.3, 0.5], [1.7, 0.5]].forEach(([x, y]) => { g.strokeStyle = '#2a1d10'; g.lineWidth = 2; g.beginPath(); g.arc(P * x, P * y, 5, 0, 7); g.stroke(); });
    }},
  Bridge: { w: 6, h: 2, pintar(g, P) {
      sombraRet(g, 0, P * 0.12, P * 6, P * 1.76, 5);
      madeira(g, 0, P * 0.12, P * 6, P * 1.76, '#86603a', { tabuas: 18, vertical: true, seed: 50 });
      [0.18, 1.82].forEach(y => { g.strokeStyle = '#3a2614'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, P * y); g.lineTo(P * 6, P * y); g.stroke(); g.strokeStyle = '#c8a878'; g.lineWidth = 3; g.setLineDash([6, 3]); g.stroke(); g.setLineDash([]); });
      for (let i = 0; i <= 6; i++) [0.18, 1.82].forEach(y => { circulo(g, P * Math.min(5.94, Math.max(0.06, i)), P * y, 5, '#5a3c20', '#1a100a', 1.5); });
    }},
  DragonArch: { w: 7, h: 6, pintar(g, P) {
      const cx = P * 3.5, cy = P * 3.2; sombraOval(g, cx + 8, cy + 10, P * 3.2, P * 2.7, 0.35);
      const osso = (x0, y0, x1, y1, e) => { g.lineCap = 'round'; g.strokeStyle = '#5a5044'; g.lineWidth = e + 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = '#e4dcc6'; g.lineWidth = e; g.stroke(); };
      g.save(); g.strokeStyle = '#5a5044'; g.lineWidth = 18; g.beginPath(); g.arc(cx, cy + P * 1.2, P * 2.9, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); g.strokeStyle = '#e8e0ca'; g.lineWidth = 13; g.stroke(); g.restore();
      for (let i = 0; i < 9; i++) { const a = Math.PI * (1.12 + i * 0.095); const x = cx + Math.cos(a) * P * 2.9, y = cy + P * 1.2 + Math.sin(a) * P * 2.9; osso(x, y, x + Math.cos(a) * P * 0.1 + (x < cx ? -1 : 1) * P * 0.15, y + P * 1.5, 7); circulo(g, x, y, 7, '#d8d0b8', '#5a5044', 2); }
      const sx = cx, sy = P * 0.55; g.fillStyle = '#e8e0ca'; g.strokeStyle = '#5a5044'; g.lineWidth = 3; g.beginPath(); g.ellipse(sx, sy, P * 0.55, P * 0.42, 0, 0, 7); g.fill(); g.stroke();
      circulo(g, sx - P * 0.2, sy, 7, '#2a1a10'); circulo(g, sx + P * 0.2, sy, 7, '#2a1a10'); osso(sx - P * 0.35, sy - P * 0.25, sx - P * 0.75, sy - P * 0.45, 6); osso(sx + P * 0.35, sy - P * 0.25, sx + P * 0.75, sy - P * 0.45, 6);
      [[0.5, 5.4], [6.5, 5.4]].forEach(([x, y]) => { sombraRet(g, P * x - P * 0.45, P * y - P * 0.45, P * 0.9, P * 0.9); pedras(g, P * x - P * 0.45, P * y - P * 0.45, P * 0.9, P * 0.9, '#7e786e', { alt: 12, seed: 60 + x }); });
    }},
  DragonHead: { w: 2, h: 3, pintar(g, P) {
      const cx = P, cy = P * 1.5; sombraOval(g, cx + 6, cy + 8, P * 0.85, P * 1.4, 0.45);
      const gr = g.createLinearGradient(cx - P * 0.8, 0, cx + P * 0.8, 0); gr.addColorStop(0, '#9a927c'); gr.addColorStop(0.5, '#e8e0ca'); gr.addColorStop(1, '#9a927c');
      g.fillStyle = gr; g.strokeStyle = '#4a4236'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, P * 2.9); g.bezierCurveTo(cx + P * 0.45, P * 2.4, cx + P * 0.7, P * 1.2, cx + P * 0.72, P * 0.7); g.quadraticCurveTo(cx, P * 0.2, cx - P * 0.72, P * 0.7); g.bezierCurveTo(cx - P * 0.7, P * 1.2, cx - P * 0.45, P * 2.4, cx, P * 2.9); g.fill(); g.stroke();
      [-1, 1].forEach(s => { g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(cx + s * P * 0.34, P * 1.05, P * 0.16, P * 0.22, s * 0.3, 0, 7); g.fill(); circulo(g, cx + s * P * 0.34, P * 1.02, 3, '#ff9a2a');
        g.strokeStyle = '#4a4236'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + s * P * 0.55, P * 0.62); g.quadraticCurveTo(cx + s * P * 0.95, P * 0.3, cx + s * P * 0.8, P * 0.04); g.stroke(); g.strokeStyle = '#d8d0b8'; g.lineWidth = 6; g.stroke();
        g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(cx + s * P * 0.1, P * 2.55, 3, 6, 0, 0, 7); g.fill(); });
      g.strokeStyle = 'rgba(74,66,54,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, P * 0.5); g.lineTo(cx, P * 2.3); g.stroke();
    }},
  Gate: { w: 2, h: 1, pintar(g, P) {
      pedras(g, 0, P * 0.28, P * 0.22, P * 0.44, '#8a8478', { alt: 8, seed: 70 }); pedras(g, P * 1.78, P * 0.28, P * 0.22, P * 0.44, '#8a8478', { alt: 8, seed: 71 });
      sombraRet(g, P * 0.22, P * 0.44, P * 1.56, P * 0.12, 3);
      faixaMetal(g, P * 0.22, P * 0.45, P * 1.56, P * 0.1, '#4a4e55');
      for (let i = 0; i < 9; i++) { const x = P * (0.3 + i * 0.175); circulo(g, x, P * 0.5, 4, '#60656d', '#1a1c20', 1.2); g.fillStyle = '#9aa0a8'; g.beginPath(); g.moveTo(x, P * 0.5 - 7); g.lineTo(x + 3, P * 0.5 - 3); g.lineTo(x - 3, P * 0.5 - 3); g.fill(); }
    }},
  PillarObj: { w: 1, h: 1, pintar(g, P) { coluna(g, P, '#a39d90', false); }},
  PillarPush: { w: 1, h: 1, pintar(g, P) { coluna(g, P, '#9c9486', true); }},
  Pillar: { w: 1, h: 1, pintar(g, P) { coluna(g, P, '#a39d90', false); }},
  PillarShort: { w: 1, h: 1, pintar(g, P) { coluna(g, P, '#a39d90', false); }},
  PillarTall: { w: 1, h: 1, pintar(g, P) { coluna(g, P, '#a39d90', false); }},
  RoundTable: { w: 1, h: 1, pintar(g, P) {
      const c = P / 2; sombraOval(g, c + 3, c + 4, P * 0.42, P * 0.42);
      g.save(); g.beginPath(); g.arc(c, c, P * 0.4, 0, 7); g.clip(); madeira(g, 0, 0, P, P, '#8a5e36', { tabuas: 5, seed: 80, borda: false }); g.restore();
      circulo(g, c, c, P * 0.4, null, '#3a2412', 2.5);
      circulo(g, c - 9, c + 6, 7, '#d8d4c8', '#7a7468', 1); circulo(g, c + 10, c - 5, 6, '#c9b07a', '#6a5430', 1); circulo(g, c + 4, c + 11, 4, '#e8dcc0', '#6a5a40', 1); chama(g, c + 4, c + 11, 4);
    }},
  StoneTable: { w: 2, h: 1, pintar(g, P) {
      sombraRet(g, P * 0.08, P * 0.14, P * 1.84, P * 0.72);
      const gr = g.createLinearGradient(0, P * 0.14, 0, P * 0.86); gr.addColorStop(0, '#b4aea2'); gr.addColorStop(1, '#8a8478'); g.fillStyle = gr; ret(g, P * 0.08, P * 0.14, P * 1.84, P * 0.72, 5); g.fill(); g.strokeStyle = '#4e4a42'; g.lineWidth = 2; g.stroke();
      const r = rngDe(90); g.strokeStyle = 'rgba(60,56,50,.55)'; g.lineWidth = 1; for (let i = 0; i < 4; i++) { let x = P * (0.3 + r() * 1.4), y = P * (0.2 + r() * 0.2); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.4) * 12; y += 6 + r() * 6; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = '#6a2a24'; ret(g, P * 0.4, P * 0.36, P * 0.34, P * 0.26, 2); g.fill(); g.fillStyle = '#e8dcc0'; g.fillRect(P * 0.43, P * 0.38, P * 0.28, P * 0.22);
      circulo(g, P * 1.4, P * 0.5, 8, '#9a7a3a', '#4a3a18', 1.5); circulo(g, P * 1.4, P * 0.5, 4, '#c02a2a');
    }},
  Staircase: { w: 3, h: 2, pintar(g, P) {
      // six stone steps rising to the right (the arrow of the board says where it climbs)
      for (let i = 0; i < 6; i++) { const x = P * 3 * i / 6, lw = P * 0.5; pedras(g, x, 0, lw, P * 2, tom('#8e887c', 0.8 + i * 0.07), { alt: 14, seed: 90 + i });
        const gr = g.createLinearGradient(x, 0, x + lw, 0); gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,255,255,.12)'); g.fillStyle = gr; g.fillRect(x, 0, lw, P * 2);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + lw - 2, 0, 2, P * 2); }
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; g.strokeRect(1, 1, P * 3 - 2, P * 2 - 2);
    }},
  Tree: { w: 1, h: 1, pintar(g, P) {
      // a dead tree seen from above: bare branches spreading from the trunk
      const c = P / 2; sombraOval(g, c + 3, c + 4, P * 0.42, P * 0.42, 0.35); const r = rngDe(13); g.lineCap = 'round';
      const ramo = (x, y, a, l, e, n) => { const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; g.strokeStyle = '#140c06'; g.lineWidth = e + 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = '#4a3222'; g.lineWidth = e; g.stroke(); if (n > 0) [-0.45, 0.4].forEach(d => ramo(x2, y2, a + d + (r() - 0.5) * 0.3, l * 0.62, e * 0.6, n - 1)); };
      for (let i = 0; i < 5; i++) ramo(c, c, i / 5 * Math.PI * 2 + r() * 0.4, P * 0.2, 4, 2);
      circulo(g, c, c, P * 0.1, '#3a2618', '#140c06', 2); circulo(g, c, c, P * 0.05, null, 'rgba(200,170,140,.3)', 1);
    } }
};
function pintarEscadaDeMao(g, P, k) {
  sombraRet(g, P * 0.26, P * 0.08, P * 0.48, P * 0.84, 4);
  [0.26, 0.66].forEach(x => { g.fillStyle = '#7a5430'; g.fillRect(P * x, P * 0.06, P * 0.08, P * 0.88); g.fillStyle = 'rgba(255,220,170,.25)'; g.fillRect(P * x + 1, P * 0.06, 2, P * 0.88); });
  const n = Math.round(5 * k); for (let i = 0; i < n; i++) { const y = P * (0.14 + i * 0.76 / (n - 1)); g.fillStyle = '#8a6038'; g.fillRect(P * 0.3, y - 2.5, P * 0.4, 5); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(P * 0.3, y + 2, P * 0.4, 1.2); }
}
function coluna(g, P, cor, empurra) {
  const c = P / 2; sombraOval(g, c + 3, c + 4, P * 0.44, P * 0.44, 0.45);
  g.fillStyle = tom(cor, 0.8); ret(g, P * 0.08, P * 0.08, P * 0.84, P * 0.84, 4); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.stroke();
  const gr = g.createRadialGradient(c - 8, c - 8, 2, c, c, P * 0.36); gr.addColorStop(0, tom(cor, 1.35)); gr.addColorStop(1, tom(cor, 0.8)); circulo(g, c, c, P * 0.36, gr, 'rgba(0,0,0,.55)', 2);
  circulo(g, c, c, P * 0.26, null, 'rgba(0,0,0,.25)', 1.5);
  if (empurra) { g.strokeStyle = '#f3cf8f'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(c - 9, c); g.lineTo(c + 9, c); g.moveTo(c + 3, c - 6); g.lineTo(c + 9, c); g.lineTo(c + 3, c + 6); g.stroke(); }
}

/* the textures, drawn once when the editor starts */
Object.entries(ARTE_OBJ).forEach(([id, a]) => {
  try {
    const cv = document.createElement('canvas'); cv.width = a.w * TEX_PX; cv.height = a.h * TEX_PX;
    a.pintar(cv.getContext('2d'), TEX_PX);
    const im = new Image(); im.onload = () => { try { desenhar(); } catch (e) { } }; im.src = cv.toDataURL('image/png'); TEXTURAS_OBJ[id] = im; a.url = im.src;
  } catch (e) { console.warn('texture ' + id, e); }
});
const texturaDoObjeto = tipo => { const b = baseObj(tipo); const im = b && TEXTURAS_OBJ[b]; return im && im.complete && im.naturalWidth ? im : null; };
const _modelosPapelao = {};
const modeloDoObjeto = tipo => { const b = baseObj(tipo); if (!b || typeof MODELOS_PAPELAO === 'undefined' || !MODELOS_PAPELAO[b]) return null; return _modelosPapelao[b] || (_modelosPapelao[b] = MODELOS_PAPELAO[b]()); };
