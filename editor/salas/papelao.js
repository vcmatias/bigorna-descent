/* Bigorna Rooms: the 3D stand-ins of the game's objects as what they are on the table: punchboard CARDBOARD pieces.
   Flat printed cards (with the grey-brown edge of the board showing), cards slotted in a cross (standees), and boxes
   folded from card. Everything is drawn here (inspired by the shapes of the game's pieces; nothing is taken from it).
   A part is a card: o = its top-left corner, u = its width, v = its height going down, all in squares (z up); `arte`
   paints its face (g, W, H, P) with P px per square; `n` is the outward normal of a box face (cards without one are
   seen from both sides). A cylinder part (`cil`) is kept for round things (bell, cauldron, table tops, tokens). */
'use strict';

const CARTAO_PX = 64;                         // px per square of the printed card images
const CARTAO_ESPESSURA = 0.035;               // thickness of the board, in squares
const COR_BORDA_CARTAO = '#8f8270';
const _cartoes = new Map();                   // key -> { img, borda } canvases

// ------------------------------------------------------------ builders (local squares)
const cartaV = (ax, ay, bx, by, z0, z1, arte, extra) => ({ o: [ax, ay, z1], u: [bx - ax, by - ay, 0], v: [0, 0, -(z1 - z0)], arte, ...extra });
const cartaPlano = (o, u, v, arte, extra) => ({ o, u, v, arte, ...extra });
/* a folded box: four sides and the top ('textura' on the top shows the object's texture from above) */
function caixaCartao(x, y, w, h, z0, z1, lados, topo, frente) {
  const H = z1 - z0; const L = typeof lados === 'function' ? lados : pintaCor(lados);
  return [
    { o: [x, y + h, z1], u: [w, 0, 0], v: [0, 0, -H], arte: frente || L, n: [0, 1, 0] },
    { o: [x + w, y, z1], u: [-w, 0, 0], v: [0, 0, -H], arte: L, n: [0, -1, 0] },
    { o: [x, y, z1], u: [0, h, 0], v: [0, 0, -H], arte: L, n: [-1, 0, 0] },
    { o: [x + w, y + h, z1], u: [0, -h, 0], v: [0, 0, -H], arte: L, n: [1, 0, 0] },
    { o: [x, y, z1], u: [w, 0, 0], v: [0, h, 0], arte: topo === 'textura' ? recorteDaTextura(x, y, w, h) : typeof topo === 'function' ? topo : topo ? pintaCor(topo) : L, n: [0, 0, 1] }
  ];
}
/* two cards slotted in a cross at (cx, cy): split at the slot, so each half can be drawn in the right order */
function cruzCartao(cx, cy, lx, ly, z0, z1, arteX, arteY) {
  const r = [];
  const metade = (ax, ay, bx, by, arte, s0, s1) => r.push({ ...cartaV(ax, ay, bx, by, z0, z1, arte), recorte: [s0, s1] });
  metade(cx - lx / 2, cy, cx, cy, arteX, 0, 0.5); metade(cx, cy, cx + lx / 2, cy, arteX, 0.5, 1);
  metade(cx, cy - ly / 2, cx, cy, arteY || arteX, 0, 0.5); metade(cx, cy, cx, cy + ly / 2, arteY || arteX, 0.5, 1);
  return r;
}
const cil = (cx, cy, r0, r1, z0, z1, cor, topo) => ({ cil: true, c: [cx, cy], r: [r0, r1], z: [z0, z1], cor, topo });
const pintaCor = cor => (g, W, H) => { g.fillStyle = cor || '#777'; g.fillRect(0, 0, W, H); contorno(g, W, H); };
const recorteDaTextura = (x, y, w, h) => ({ textura: [x, y, w, h] });
function contorno(g, W, H) { g.strokeStyle = 'rgba(20,14,10,.8)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2); }
/* the printed outline of a silhouette: fill, then the dark cut line around it */
function silhueta(g, desenhaCaminho, preencher) { g.save(); desenhaCaminho(); g.clip(); preencher(); g.restore(); desenhaCaminho(); g.strokeStyle = '#1c140e'; g.lineWidth = 2.2; g.stroke(); }

// ------------------------------------------------------------ printed surfaces
const pintaMadeira = (cor, vertical) => (g, W, H) => { madeira(g, 0, 0, W, H, cor, { vertical, tabuas: Math.max(2, Math.round((vertical ? W : H) / 16)), seed: Math.round(W * 7 + H), borda: false }); contorno(g, W, H); };
const pintaPedra = (cor, musgo) => (g, W, H) => { pedras(g, 0, 0, W, H, cor, { alt: 13, seed: Math.round(W + H * 3) });
  if (musgo) { const r = rngDe(Math.round(W * H)); for (let i = 0; i < W * H / 900; i++) { g.fillStyle = `rgba(${70 + r() * 30},${110 + r() * 30},${50},${0.35 + r() * 0.3})`; g.beginPath(); g.ellipse(r() * W, H * (0.55 + r() * 0.45), 3 + r() * 6, 2 + r() * 3, 0, 0, 7); g.fill(); } }
  contorno(g, W, H); };

/* the pieces, one function per game object: returns its parts */
const MODELOS_PAPELAO = {
  Chest() {
    const madeiraBau = (g, W, H) => { madeira(g, 0, 0, W, H, '#6e4222', { tabuas: 3, seed: 3, borda: false }); [0.12, 0.88].forEach(f => faixaMetal(g, W * f - 3, 0, 6, H, '#7c7a70')); g.fillStyle = '#9a9488'; g.fillRect(0, H - 5, W, 5); contorno(g, W, H); };
    const frente = (g, W, H) => { madeiraBau(g, W, H); g.fillStyle = '#c8a24a'; ret(g, W / 2 - 6, 2, 12, 13, 2); g.fill(); g.strokeStyle = '#3a2810'; g.lineWidth = 1.5; g.stroke(); g.fillStyle = '#2a1d10'; g.fillRect(W / 2 - 1, 6, 2, 5); };
    const p = caixaCartao(0.06, 0.14, 0.88, 0.72, 0, 0.36, madeiraBau, madeiraBau, frente);
    // the rounded lid: two ends shaped as half-rounds and five bent facets
    const tampa = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(0, H); g.ellipse(W / 2, H, W / 2, H, 0, Math.PI, 0); g.closePath(); }, () => { madeira(g, 0, 0, W, H, '#6e4222', { tabuas: 2, vertical: true, seed: 5, borda: false }); faixaMetal(g, 0, H - 4, W, 4, '#7c7a70'); });
    p.push(cartaV(0.06, 0.86, 0.06, 0.14, 0.36, 0.6, tampa, { n: [-1, 0, 0] }), cartaV(0.94, 0.14, 0.94, 0.86, 0.36, 0.6, tampa, { n: [1, 0, 0] }));
    const cy = 0.5, ry = 0.36, rz = 0.24, n = 5;
    for (let k = 0; k < n; k++) { const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n;
      const y0 = cy + Math.cos(a0) * ry, z0 = 0.36 + Math.sin(a0) * rz, y1 = cy + Math.cos(a1) * ry, z1 = 0.36 + Math.sin(a1) * rz; const am = (a0 + a1) / 2;
      p.push(cartaPlano([0.06, y0, z0], [0.88, 0, 0], [0, y1 - y0, z1 - z0], madeiraBau, { n: [0, Math.cos(am), Math.sin(am)] })); }
    return p;
  },
  Shelf() {
    const lado = pintaMadeira('#6a3c22', true);
    const frente = (g, W, H) => { madeira(g, 0, 0, W, H, '#5a321c', { tabuas: 2, vertical: true, seed: 8, borda: false });
      g.fillStyle = '#2a1a10'; const pr = 4; const alt = (H - 10) / pr; const r = rngDe(21); const cores = ['#8c2f2a', '#2f5a8c', '#3d7a3a', '#8c6d2a', '#5a3a7a', '#7a2f5a', '#c9b07a'];
      for (let i = 0; i < pr; i++) { const y = 6 + i * alt; g.fillStyle = '#20140c'; g.fillRect(6, y, W - 12, alt - 5);
        let x = 8; while (x < W - 12) { const bw = 4 + r() * 5, bh = alt * (0.55 + r() * 0.35); if (r() < 0.12) { g.fillStyle = '#6ab0a0'; g.beginPath(); g.ellipse(x + 4, y + alt - 9, 4, 4, 0, 0, 7); g.fill(); g.fillRect(x + 3, y + alt - 18, 2, 6); x += 10; continue; }
          g.fillStyle = cores[Math.floor(r() * cores.length)]; g.fillRect(x, y + alt - 5 - bh, bw - 1, bh); g.fillStyle = 'rgba(255,240,200,.3)'; g.fillRect(x + 1, y + alt - 5 - bh + 3, bw - 3, 2); x += bw; }
        g.fillStyle = '#7a4a2a'; g.fillRect(4, y + alt - 5, W - 8, 5); }
      contorno(g, W, H); };
    const p = caixaCartao(0.06, 0.2, 1.88, 0.6, 0, 1.7, lado, pintaMadeira('#7a4a2a'), frente);
    [[0.02, 0.16], [1.9, 0.16], [0.02, 0.76], [1.9, 0.76]].forEach(([x, y]) => p.push(...caixaCartao(x, y, 0.08, 0.08, 0, 1.85, '#4a2a16', '#5a341c')));
    return p;
  },
  Lectern() {
    const perna = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(W * 0.05, H); g.lineTo(W * 0.3, H); g.lineTo(W * 0.5, H * 0.55); g.lineTo(W * 0.7, H); g.lineTo(W * 0.95, H); g.lineTo(W * 0.58, H * 0.3); g.lineTo(W * 0.58, 0); g.lineTo(W * 0.42, 0); g.lineTo(W * 0.42, H * 0.3); g.closePath(); }, () => madeira(g, 0, 0, W, H, '#6a3e22', { tabuas: 2, vertical: true, seed: 9, borda: false }));
    const tampo = (g, W, H) => { madeira(g, 0, 0, W, H, '#7a4a28', { tabuas: 3, seed: 10, borda: false }); g.fillStyle = '#5a2a1a'; ret(g, W * 0.12, H * 0.12, W * 0.76, H * 0.7, 3); g.fill(); g.fillStyle = '#efe4c6'; ret(g, W * 0.15, H * 0.15, W * 0.34, H * 0.62, 2); g.fill(); ret(g, W * 0.51, H * 0.15, W * 0.34, H * 0.62, 2); g.fill();
      g.strokeStyle = 'rgba(80,60,40,.5)'; g.lineWidth = 0.8; for (let i = 0; i < 6; i++) { const y = H * (0.25 + i * 0.08); g.beginPath(); g.moveTo(W * 0.19, y); g.lineTo(W * 0.45, y); g.moveTo(W * 0.55, y); g.lineTo(W * 0.81, y); g.stroke(); } contorno(g, W, H); };
    return [...cruzCartao(0.5, 0.5, 0.7, 0.6, 0, 0.72, perna), cartaPlano([0.18, 0.24, 1.0], [0.64, 0, 0], [0, 0.56, -0.26], tampo)];
  },
  Well() {
    const pedra = pintaPedra('#9e9788', true);
    const p = caixaCartao(0.06, 0.06, 0.88, 0.88, 0, 0.5, pedra, 'textura');
    p.push(...caixaCartao(0.08, 0.44, 0.1, 0.12, 0.5, 1.55, '#5a3a1e', '#6a4424'), ...caixaCartao(0.82, 0.44, 0.1, 0.12, 0.5, 1.55, '#5a3a1e', '#6a4424'));
    p.push(...caixaCartao(0.1, 0.47, 0.8, 0.06, 1.18, 1.24, '#6a4424'));
    p.push(cil(0.5, 0.5, 0.1, 0.12, 0.8, 1.02, '#6a4a2a', '#2d5a70'));
    const telhas = (g, W, H) => { const r = rngDe(Math.round(W)); for (let j = 0; j * 9 < H + 9; j++) for (let i = -1; i * 12 < W + 12; i++) { g.fillStyle = tom('#6a4424', 0.8 + r() * 0.35); ret(g, i * 12 + (j % 2) * 6, j * 9, 12, 10, 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; g.stroke(); } contorno(g, W, H); };
    p.push(cartaPlano([-0.06, -0.06, 1.42], [1.12, 0, 0], [0, 0.56, 0.6], telhas), cartaPlano([-0.06, 0.5, 2.02], [1.12, 0, 0], [0, 0.56, -0.6], telhas));
    const empena = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(0, H); g.lineTo(W / 2, 0); g.lineTo(W, H); g.closePath(); }, () => madeira(g, 0, 0, W, H, '#5a3a1e', { tabuas: 3, vertical: true, seed: 12, borda: false }));
    p.push(cartaV(0.0, 0.94, 0.0, 0.06, 1.44, 1.98, empena), cartaV(1.0, 0.06, 1.0, 0.94, 1.44, 1.98, empena));
    return p;
  },
  Cauldron() {
    return [cil(0.26, 0.3, 0.05, 0.05, 0, 0.18, '#1c1c20'), cil(0.74, 0.3, 0.05, 0.05, 0, 0.18, '#1c1c20'), cil(0.5, 0.76, 0.05, 0.05, 0, 0.18, '#1c1c20'),
      cil(0.5, 0.5, 0.3, 0.46, 0.12, 0.42, '#26262c'), cil(0.5, 0.5, 0.46, 0.4, 0.42, 0.66, '#2c2c32', 'textura')];
  },
  Door() {
    const porta = (g, W, H) => silhueta(g, () => { const r = W / 2; g.beginPath(); g.moveTo(0, H); g.lineTo(0, r * 0.62); g.ellipse(W / 2, r * 0.62, W / 2, r * 0.62, 0, Math.PI, 0); g.lineTo(W, H); g.closePath(); },
      () => { madeira(g, 0, 0, W, H, '#7a4426', { tabuas: 6, vertical: true, seed: 14, borda: false }); [0.3, 0.72].forEach(f => { faixaMetal(g, 0, H * f - 4, W, 8, '#46464c'); for (let i = 1; i < 6; i++) rebite(g, W * i / 6, H * f); });
        g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, H * 0.1); g.lineTo(W / 2, H); g.stroke(); circulo(g, W * 0.56, H * 0.55, 6, null, '#b8a36a', 2.5); circulo(g, W * 0.44, H * 0.55, 6, null, '#b8a36a', 2.5); });
    const pe = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(0, H); g.lineTo(W * 0.4, 0); g.lineTo(W * 0.6, 0); g.lineTo(W, H); g.closePath(); }, () => madeira(g, 0, 0, W, H, '#5a321c', { tabuas: 2, seed: 15, borda: false }));
    return [cartaV(0.04, 0.5, 1.96, 0.5, 0, 1.95, porta), cartaV(0.35, 0.22, 0.35, 0.78, 0, 0.32, pe), cartaV(1.65, 0.22, 1.65, 0.78, 0, 0.32, pe)];
  },
  Gate() {
    const grade = (g, W, H) => silhueta(g, () => { g.beginPath(); const n = 9; g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.9); for (let i = n; i >= 0; i--) { const x = W * i / n; g.lineTo(x + (i ? -W / n * 0.5 : 0), H * 0.9); g.lineTo(Math.max(0, x - W / n * 0.25), H); g.lineTo(Math.max(0, x - W / n * 0.1), H * 0.9); } g.lineTo(0, H * 0.9); g.closePath(); },
      () => { g.fillStyle = '#16161a'; g.fillRect(0, 0, W, H); const n = 9; for (let i = 0; i <= n; i++) { const x = W * i / n; faixaMetal(g, x - 3, 0, 6, H, '#5a5e66'); } [0.12, 0.45, 0.78].forEach(f => faixaMetal(g, 0, H * f, W, 6, '#6a4424')); for (let i = 0; i <= n; i++) [0.12, 0.45, 0.78].forEach(f => rebite(g, W * i / n, H * f + 3, 1.8)); g.fillStyle = 'rgba(160,30,30,.45)'; g.fillRect(0, H * 0.86, W, 4); });
    const poste = pintaPedra('#8a8478', true);
    return [...caixaCartao(0, 0.3, 0.2, 0.4, 0, 2.1, poste), ...caixaCartao(1.8, 0.3, 0.2, 0.4, 0, 2.1, poste), cartaV(0.2, 0.5, 1.8, 0.5, 0.05, 1.95, grade)];
  },
  Archway() {
    const pedra = pintaPedra('#a29c90', true);
    const p = [];
    [0.08, 3.22].forEach(x => { p.push(...caixaCartao(x - 0.04, 0.12, 0.78, 0.76, 0, 0.25, pedra), ...caixaCartao(x, 0.18, 0.7, 0.64, 0.25, 2.85, pedra), ...caixaCartao(x - 0.06, 0.1, 0.82, 0.8, 2.85, 3.05, pedra)); });
    const lintel = (g, W, H) => { pedras(g, 0, 0, W, H, '#b0aa9e', { alt: H / 2, seed: 31 }); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, H - 4, W, 4); contorno(g, W, H); };
    p.push(...caixaCartao(0, 0.16, 4, 0.68, 3.05, 3.4, lintel));
    const arco = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H); g.ellipse(W / 2, H, W / 2, H * 0.8, 0, 0, Math.PI, true); g.closePath(); }, () => pedras(g, 0, 0, W, H, '#9a9488', { alt: 12, seed: 33 }));
    p.push(cartaV(0.78, 0.5, 3.22, 0.5, 2.3, 3.05, arco));
    return p;
  },
  Bell() {
    const arco = (g, W, H) => silhueta(g, () => { const e = W * 0.12; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.45); g.quadraticCurveTo(0, 0, W * 0.3, 0); g.lineTo(W * 0.7, 0); g.quadraticCurveTo(W, 0, W, H * 0.45); g.lineTo(W, H); g.lineTo(W - e, H); g.lineTo(W - e, H * 0.45); g.quadraticCurveTo(W - e, e, W * 0.66, e); g.lineTo(W * 0.34, e); g.quadraticCurveTo(e, e, e, H * 0.45); g.lineTo(e, H); g.closePath(); },
      () => { pedras(g, 0, 0, W, H, '#9c968a', { alt: 14, seed: 41 }); g.fillStyle = 'rgba(20,20,20,.25)'; g.fillRect(0, H * 0.9, W, H * 0.1); });
    const p = [cartaV(0, 0.4, 4, 0.4, 0, 3.1, arco), cartaV(4, 0.6, 0, 0.6, 0, 3.1, arco)];
    p.push(...caixaCartao(0, 0.4, 0.48, 0.2, 2.95, 3.1, '#9c968a'), ...caixaCartao(0.48, 0.4, 3.04, 0.2, 2.96, 3.1, '#9c968a'), ...caixaCartao(3.52, 0.4, 0.48, 0.2, 2.95, 3.1, '#9c968a'));
    p.push(...caixaCartao(1.97, 0.47, 0.06, 0.06, 2.1, 2.96, '#3a2a18'), cil(2, 0.5, 0.52, 0.2, 1.05, 2.15, '#a8802e', '#6a4a1a'), cil(2, 0.5, 0.2, 0.08, 2.15, 2.3, '#8a6428'));
    return p;
  },
  /* the bell's frame, standing alone (the bell taken out) */
  BellFrame() {
    const arco = (g, W, H) => silhueta(g, () => { const e = W * 0.12; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * 0.45); g.quadraticCurveTo(0, 0, W * 0.3, 0); g.lineTo(W * 0.7, 0); g.quadraticCurveTo(W, 0, W, H * 0.45); g.lineTo(W, H); g.lineTo(W - e, H); g.lineTo(W - e, H * 0.45); g.quadraticCurveTo(W - e, e, W * 0.66, e); g.lineTo(W * 0.34, e); g.quadraticCurveTo(e, e, e, H * 0.45); g.lineTo(e, H); g.closePath(); },
      () => { pedras(g, 0, 0, W, H, '#9c968a', { alt: 14, seed: 41 }); g.fillStyle = 'rgba(20,20,20,.25)'; g.fillRect(0, H * 0.9, W, H * 0.1); });
    const p = [cartaV(0, 0.4, 4, 0.4, 0, 3.1, arco), cartaV(4, 0.6, 0, 0.6, 0, 3.1, arco)];
    p.push(...caixaCartao(0, 0.4, 0.48, 0.2, 2.95, 3.1, '#9c968a'), ...caixaCartao(0.48, 0.4, 3.04, 0.2, 2.96, 3.1, '#9c968a'), ...caixaCartao(3.52, 0.4, 0.48, 0.2, 2.95, 3.1, '#9c968a'));
    return p;
  },
  BloodShrine() {
    const pilar = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(W * 0.12, H); g.lineTo(W * 0.2, H * 0.22); g.lineTo(W * 0.5, 0); g.lineTo(W * 0.8, H * 0.22); g.lineTo(W * 0.88, H); g.closePath(); },
      () => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#6e6a66'); gr.addColorStop(0.5, '#b8b4ac'); gr.addColorStop(1, '#6e6a66'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(40,36,32,.6)'; g.lineWidth = 1.5; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(W * 0.2, H * (0.22 + i * 0.13)); g.lineTo(W * 0.8, H * (0.22 + i * 0.13)); g.stroke(); }
        circulo(g, W * 0.5, H * 0.34, W * 0.1, null, '#3a3632', 2); g.fillStyle = '#9a0c14'; const r = rngDe(3); for (let i = 0; i < 5; i++) { const x = W * (0.3 + r() * 0.4); g.beginPath(); g.moveTo(x - 3, H * 0.42); g.quadraticCurveTo(x, H * (0.6 + r() * 0.3), x + 3, H * 0.42); g.fill(); } });
    return [...caixaCartao(0.08, 0.08, 0.84, 0.84, 0, 0.3, pintaPedra('#6c6560'), 'textura'), ...cruzCartao(0.5, 0.5, 0.62, 0.62, 0.3, 2.3, pilar)];
  },
  Fire() {
    const chamas = (g, W, H) => { const r = rngDe(Math.round(W));
      const lingua = (x, w, h, cor) => { g.fillStyle = cor; g.beginPath(); g.moveTo(x - w / 2, H * 0.88); g.quadraticCurveTo(x - w * 0.6, H * 0.88 - h * 0.5, x + (r() - 0.5) * w * 0.4, H * 0.88 - h); g.quadraticCurveTo(x + w * 0.6, H * 0.88 - h * 0.5, x + w / 2, H * 0.88); g.fill(); };
      silhueta(g, () => { g.beginPath(); for (let i = 0; i < 7; i++) { const x = W * (0.12 + i * 0.126), h = H * (0.45 + (i % 3 === 1 ? 0.45 : r() * 0.3)); g.moveTo(x - W * 0.09, H * 0.9); g.quadraticCurveTo(x - W * 0.1, H * 0.9 - h * 0.5, x, H * 0.9 - h); g.quadraticCurveTo(x + W * 0.1, H * 0.9 - h * 0.5, x + W * 0.09, H * 0.9); } g.rect(W * 0.08, H * 0.82, W * 0.84, H * 0.18); },
        () => { g.fillStyle = '#a0201a'; g.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) lingua(W * (0.18 + i * 0.13), W * 0.2, H * (0.35 + r() * 0.35), '#e2602a'); for (let i = 0; i < 4; i++) lingua(W * (0.3 + i * 0.13), W * 0.14, H * (0.2 + r() * 0.25), '#ffc84a');
          g.fillStyle = '#4a2a14'; g.fillRect(W * 0.08, H * 0.84, W * 0.84, H * 0.16); g.strokeStyle = '#2a160a'; g.lineWidth = 2; g.strokeRect(W * 0.08, H * 0.84, W * 0.84, H * 0.16); }); };
    return [...caixaCartao(0.1, 0.1, 0.8, 0.8, 0, 0.08, '#5e5852', 'textura'), ...cruzCartao(0.5, 0.5, 0.86, 0.86, 0.06, 1.0, chamas)];
  },
  Statue() {
    const pedra = pintaPedra('#5e6a78');
    // a guardian in armour leaning on a sword, with a round shield and a cloak down to the plinth
    const figura = (g, W, H) => { const c = W / 2;
      const corpo = () => { g.beginPath(); g.moveTo(c - W * 0.2, H); g.quadraticCurveTo(c - W * 0.26, H * 0.62, c - W * 0.27, H * 0.3); g.quadraticCurveTo(c - W * 0.3, H * 0.2, c - W * 0.18, H * 0.19); g.lineTo(c - W * 0.07, H * 0.17);
        g.lineTo(c - W * 0.075, H * 0.1); g.quadraticCurveTo(c - W * 0.08, H * 0.03, c, H * 0.015); g.quadraticCurveTo(c + W * 0.08, H * 0.03, c + W * 0.075, H * 0.1); g.lineTo(c + W * 0.07, H * 0.17); g.lineTo(c + W * 0.18, H * 0.19); g.quadraticCurveTo(c + W * 0.3, H * 0.2, c + W * 0.27, H * 0.3); g.quadraticCurveTo(c + W * 0.26, H * 0.62, c + W * 0.2, H); g.closePath();
        g.moveTo(c - W * 0.2, H * 0.45); g.arc(c - W * 0.25, H * 0.45, W * 0.13, 0, Math.PI * 2); };
      const pedra2 = () => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#46515d'); gr.addColorStop(0.5, '#a2aebb'); gr.addColorStop(1, '#46515d'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(28,34,42,.75)'; g.lineWidth = 2; [[-0.12, 0.5, -0.16, 0.99], [0.12, 0.5, 0.16, 0.99], [0, 0.55, 0, 0.99]].forEach(([a, b, d, e]) => { g.beginPath(); g.moveTo(c + W * a, H * b); g.lineTo(c + W * d, H * e); g.stroke(); });
        [-1, 1].forEach(sx => { g.beginPath(); g.ellipse(c + sx * W * 0.19, H * 0.22, W * 0.09, H * 0.04, 0, 0, 7); g.fillStyle = '#7a8694'; g.fill(); g.stroke(); });
        g.fillStyle = '#26303a'; g.fillRect(c - W * 0.05, H * 0.07, W * 0.1, H * 0.018); g.fillRect(c - W * 0.008, H * 0.07, W * 0.016, H * 0.06);
        circulo(g, c - W * 0.25, H * 0.45, W * 0.13, '#6c7884', '#26303a', 2.5); circulo(g, c - W * 0.25, H * 0.45, W * 0.045, '#b4bec8', '#26303a', 1.5);
        g.fillStyle = '#d0d8e0'; g.fillRect(c - W * 0.018, H * 0.34, W * 0.036, H * 0.6); g.strokeStyle = '#26303a'; g.lineWidth = 1.5; g.strokeRect(c - W * 0.018, H * 0.34, W * 0.036, H * 0.6);
        g.fillStyle = '#5a6674'; g.fillRect(c - W * 0.09, H * 0.33, W * 0.18, H * 0.022); g.fillRect(c - W * 0.02, H * 0.27, W * 0.04, H * 0.06); circulo(g, c, H * 0.265, W * 0.03, '#8a96a4', '#26303a', 1.5);
        g.fillStyle = '#7a8694'; g.beginPath(); g.ellipse(c, H * 0.36, W * 0.1, H * 0.03, 0, 0, 7); g.fill(); g.stroke(); };
      silhueta(g, corpo, pedra2); };
    return [...caixaCartao(0.4, 0.4, 2.2, 2.2, 0, 0.5, pedra, 'textura'), ...cruzCartao(1.5, 1.5, 1.7, 1.7, 0.5, 3.7, figura)];
  },
  Wagon() {
    const roda = (g, W, H) => { const c = W / 2, r = Math.min(W, H) / 2 - 1; silhueta(g, () => { g.beginPath(); g.arc(c, H / 2, r, 0, Math.PI * 2); }, () => { g.fillStyle = '#6a4424'; g.fillRect(0, 0, W, H); circulo(g, c, H / 2, r * 0.78, '#2a1a10'); g.strokeStyle = '#7a5230'; g.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(c, H / 2); g.lineTo(c + Math.cos(a) * r * 0.8, H / 2 + Math.sin(a) * r * 0.8); g.stroke(); } circulo(g, c, H / 2, r * 0.18, '#5a3a1e', '#1a100a', 2); faixaMetal(g, 0, 0, 0, 0); }); };
    const tabuas = pintaMadeira('#7a5230');
    const p = caixaCartao(0.35, 0.36, 2.2, 1.28, 0.42, 0.98, tabuas, 'textura');
    [[0.55, 0.3], [2.0, 0.3], [0.55, 1.7], [2.0, 1.7]].forEach(([x, y]) => p.push(cartaV(x - 0.38, y, x + 0.38, y, 0, 0.76, roda)));
    p.push(...caixaCartao(2.55, 0.94, 0.45, 0.12, 0.44, 0.54, '#5a3a1e'), ...caixaCartao(1.55, 0.5, 0.6, 0.6, 0.98, 1.46, pintaMadeira('#b08450')));
    return p;
  },
  Barricade() {
    const estacas = (g, W, H) => { const r = rngDe(44); const tronco = (x0, y0, x1, y1, e) => { g.lineCap = 'round'; g.strokeStyle = '#1c120a'; g.lineWidth = e + 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.strokeStyle = '#6e4a2a'; g.lineWidth = e; g.stroke(); g.strokeStyle = 'rgba(255,220,170,.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0 - 2); g.lineTo(x1, y1 - 2); g.stroke(); };
      [0.25, 0.75].forEach(f => { tronco(W * f - W * 0.18, H * 0.98, W * f + W * 0.18, H * 0.1, 9); tronco(W * f + W * 0.18, H * 0.98, W * f - W * 0.18, H * 0.1, 9);
        [[W * f + W * 0.18, H * 0.1], [W * f - W * 0.18, H * 0.1]].forEach(([x, y]) => { g.fillStyle = '#d8c09a'; g.beginPath(); g.moveTo(x - 4, y + 6); g.lineTo(x, y - 6); g.lineTo(x + 4, y + 6); g.fill(); }); });
      tronco(2, H * 0.55, W - 2, H * 0.55, 10); g.fillStyle = 'rgba(140,20,20,.6)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(W * (0.2 + r() * 0.6), H * (0.3 + r() * 0.4), 2 + r() * 3, 0, 7); g.fill(); } };
    return [cartaV(0, 0.5, 2, 0.5, 0, 1.15, estacas)];
  },
  Bridge() {
    const p = []; const n = 12; const alt = x => 0.12 + Math.sin(Math.PI * x / 6) * 0.42;
    const tabua = pintaMadeira('#8a6238', true);
    for (let i = 0; i < n; i++) { const x0 = 6 * i / n, x1 = 6 * (i + 1) / n; p.push(...caixaCartao(x0, 0.14, x1 - x0, 1.72, alt((x0 + x1) / 2) - 0.1, alt((x0 + x1) / 2), tabua, tabua)); }
    const corrimao = (g, W, H) => { const P = CARTAO_PX; silhueta(g, () => { g.beginPath(); for (let i = 0; i <= 6; i++) { const x = W * i / 6, y = H - (alt(i) + 0.4) / 1.0 * P; g.rect(x - 4, Math.max(0, y), 8, H - Math.max(0, y)); } g.moveTo(0, H - (alt(0) + 0.35) * P); for (let i = 1; i <= 24; i++) g.lineTo(W * i / 24, H - (alt(6 * i / 24) + 0.35) * P); g.lineTo(W, H - (alt(6) + 0.3) * P); for (let i = 24; i >= 0; i--) g.lineTo(W * i / 24, H - (alt(6 * i / 24) + 0.3) * P); g.closePath(); },
      () => { g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, W, H); g.fillStyle = '#c8a878'; for (let i = 0; i <= 24; i++) g.fillRect(W * i / 24, H - (alt(6 * i / 24) + 0.34) * P, 4, 2); }); };
    p.push(cartaV(0, 0.12, 6, 0.12, 0, 1.0, corrimao), cartaV(6, 1.88, 0, 1.88, 0, 1.0, corrimao));
    return p;
  },
  DragonArch() {
    const osso = '#d8cfae', escuro = '#4a4032';
    const corpo = (g, W, H) => { const P = CARTAO_PX; const X = x => x * P, Y = z => H - z * P;
      const espinha = t => [X(0.4 + 6.2 * t), Y(0.3 + Math.sin(Math.PI * Math.min(1, t * 1.1)) * 3.6)];
      g.lineCap = 'round'; g.lineJoin = 'round';
      const traco = (pts, e) => { g.strokeStyle = escuro; g.lineWidth = e + 4; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.strokeStyle = osso; g.lineWidth = e; g.stroke(); };
      const pts = Array.from({ length: 41 }, (_, i) => espinha(i / 40)); traco(pts, 14);
      for (let i = 4; i < 36; i += 2) { const [x, y] = espinha(i / 40); const l = P * (0.5 + Math.sin(Math.PI * i / 40) * 0.5); traco([[x, y], [x - l * 0.25, y + l * 0.9]], 5); traco([[x, y], [x + l * 0.25, y + l * 0.9]], 5); circulo(g, x, y, 7, osso, escuro, 2); }
      const [hx, hy] = espinha(0); g.fillStyle = osso; g.strokeStyle = escuro; g.lineWidth = 3; g.beginPath(); g.moveTo(hx - P * 0.1, hy - P * 0.2); g.quadraticCurveTo(hx + P * 0.5, hy - P * 0.55, hx + P * 0.9, hy - P * 0.1); g.lineTo(hx + P * 0.2, hy + P * 0.15); g.closePath(); g.fill(); g.stroke(); circulo(g, hx + P * 0.3, hy - P * 0.2, 6, '#2a1a10');
      traco([[hx + P * 0.1, hy - P * 0.35], [hx - P * 0.2, hy - P * 0.9]], 6); };
    const asa = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(W / 2, H); g.lineTo(0, H * 0.25); g.lineTo(W * 0.12, H * 0.5); g.lineTo(W * 0.22, H * 0.3); g.lineTo(W * 0.32, H * 0.55); g.lineTo(W / 2, H * 0.05); g.lineTo(W * 0.68, H * 0.55); g.lineTo(W * 0.78, H * 0.3); g.lineTo(W * 0.88, H * 0.5); g.lineTo(W, H * 0.25); g.closePath(); },
      () => { g.fillStyle = 'rgba(150,122,92,.78)'; g.fillRect(0, 0, W, H); g.strokeStyle = osso; g.lineWidth = 6; g.lineCap = 'round'; [[0, 0.25], [0.22, 0.3], [0.5, 0.05], [0.78, 0.3], [1, 0.25]].forEach(([x, y]) => { g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W * x, H * y); g.stroke(); }); });
    return [...caixaCartao(0.05, 2.6, 0.8, 0.8, 0, 0.4, pintaPedra('#7e786e', true)), ...caixaCartao(6.15, 2.6, 0.8, 0.8, 0, 0.4, pintaPedra('#7e786e', true)),
      cartaV(0, 3, 7, 3, 0, 4.3, corpo), cartaV(3.5, 0.3, 3.5, 5.7, 2.2, 4.0, asa)];
  },
  DragonHead() {
    const osso = '#d8cfae', escuro = '#4a4032';
    const perfil = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(W * 0.02, H * 0.72); g.quadraticCurveTo(W * 0.3, H * 0.5, W * 0.62, H * 0.42); g.lineTo(W * 0.7, H * 0.12); g.lineTo(W * 0.78, H * 0.4); g.quadraticCurveTo(W * 0.98, H * 0.45, W * 0.98, H * 0.75); g.lineTo(W * 0.9, H); g.lineTo(W * 0.35, H); g.lineTo(W * 0.3, H * 0.86); g.lineTo(W * 0.06, H * 0.84); g.closePath(); },
      () => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#efe7cc'); gr.addColorStop(1, '#9a9076'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(W * 0.62, H * 0.58, W * 0.07, H * 0.08, 0, 0, 7); g.fill(); circulo(g, W * 0.62, H * 0.58, 3, '#ff9a2a');
        g.fillStyle = osso; for (let i = 0; i < 7; i++) { const x = W * (0.1 + i * 0.05); g.beginPath(); g.moveTo(x, H * 0.84); g.lineTo(x + 3, H * 0.93); g.lineTo(x + 6, H * 0.84); g.fill(); } g.strokeStyle = escuro; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W * 0.06, H * 0.84); g.lineTo(W * 0.5, H * 0.8); g.stroke(); });
    const frente = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(W * 0.36, H); g.lineTo(W * 0.3, H * 0.62);
        g.quadraticCurveTo(W * 0.18, H * 0.5, W * 0.2, H * 0.42); g.quadraticCurveTo(W * 0.05, H * 0.3, W * 0.02, H * 0.02); g.quadraticCurveTo(W * 0.14, H * 0.2, W * 0.3, H * 0.34);
        g.quadraticCurveTo(W / 2, H * 0.26, W * 0.7, H * 0.34); g.quadraticCurveTo(W * 0.86, H * 0.2, W * 0.98, H * 0.02); g.quadraticCurveTo(W * 0.95, H * 0.3, W * 0.8, H * 0.42); g.quadraticCurveTo(W * 0.82, H * 0.5, W * 0.7, H * 0.62); g.lineTo(W * 0.64, H); g.closePath(); },
      () => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#8e846a'); gr.addColorStop(0.5, '#efe7cc'); gr.addColorStop(1, '#8e846a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(74,64,50,.7)'; g.lineWidth = 2; [0.08, 0.14, 0.2].forEach(f => { g.beginPath(); g.moveTo(W * f, H * (0.05 + f)); g.lineTo(W * (f + 0.06), H * (0.1 + f)); g.moveTo(W * (1 - f), H * (0.05 + f)); g.lineTo(W * (0.94 - f), H * (0.1 + f)); g.stroke(); });
        [0.4, 0.6].forEach(f => { g.fillStyle = '#2a1a10'; g.beginPath(); g.ellipse(W * f, H * 0.46, W * 0.05, H * 0.06, (f - 0.5) * 3, 0, 7); g.fill(); circulo(g, W * f, H * 0.46, 2.5, '#ff9a2a'); });
        g.fillStyle = '#2a1a10'; [0.46, 0.54].forEach(f => { g.beginPath(); g.ellipse(W * f, H * 0.86, 2.5, 5, 0, 0, 7); g.fill(); });
        g.strokeStyle = 'rgba(74,64,50,.6)'; g.beginPath(); g.moveTo(W / 2, H * 0.32); g.lineTo(W / 2, H * 0.78); g.stroke(); });
    return [...caixaCartao(0.35, 0.3, 1.3, 2.4, 0, 0.12, '#6e685e'), ...cruzCartao(1, 1.3, 1.7, 2.8, 0.1, 1.8, frente, perfil)];
  },
  RoundTable() {
    const pe = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(0, H); g.lineTo(W * 0.42, H * 0.7); g.lineTo(W * 0.44, 0); g.lineTo(W * 0.56, 0); g.lineTo(W * 0.58, H * 0.7); g.lineTo(W, H); g.closePath(); }, () => madeira(g, 0, 0, W, H, '#4a2e18', { tabuas: 1, vertical: true, seed: 17, borda: false }));
    return [...cruzCartao(0.5, 0.5, 0.8, 0.8, 0, 0.56, pe), cil(0.5, 0.5, 0.46, 0.46, 0.56, 0.64, '#5a3a1e', 'textura')];
  },
  StoneTable() {
    const x = (g, W, H) => silhueta(g, () => { g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.25, 0); g.lineTo(W / 2, H * 0.4); g.lineTo(W * 0.75, 0); g.lineTo(W, 0); g.lineTo(W * 0.62, H * 0.5); g.lineTo(W, H); g.lineTo(W * 0.75, H); g.lineTo(W / 2, H * 0.6); g.lineTo(W * 0.25, H); g.lineTo(0, H); g.lineTo(W * 0.38, H * 0.5); g.closePath(); }, () => pedras(g, 0, 0, W, H, '#8a8478', { alt: 10, seed: 23 }));
    return [cartaV(0.34, 0.22, 0.34, 0.78, 0, 0.62, x), cartaV(1.66, 0.78, 1.66, 0.22, 0, 0.62, x), ...caixaCartao(0.05, 0.16, 1.9, 0.68, 0.62, 0.78, pintaPedra('#9a948a'), 'textura')];
  },
  Tree() {
    const arvore = (g, W, H) => { const r = rngDe(Math.round(W * 3)); const galhos = [];
      const ramo = (x, y, a, l, e, n) => { const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l; galhos.push([x, y, x2, y2, e]); if (n > 0) { const k = 2 + (r() < 0.4 ? 1 : 0); for (let i = 0; i < k; i++) ramo(x2, y2, a + (i - (k - 1) / 2) * 0.55 + (r() - 0.5) * 0.3, l * (0.62 + r() * 0.15), e * 0.62, n - 1); } };
      ramo(W / 2, H * 0.94, -Math.PI / 2, H * 0.34, W * 0.13, 4);
      g.lineCap = 'round'; g.strokeStyle = '#140c06'; galhos.forEach(([a, b, c, d, e]) => { g.lineWidth = e + 3; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); });
      galhos.forEach(([a, b, c, d, e]) => { g.strokeStyle = '#4a3222'; g.lineWidth = e; g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); g.strokeStyle = 'rgba(200,170,140,.18)'; g.lineWidth = Math.max(1, e * 0.25); g.beginPath(); g.moveTo(a - e * 0.2, b); g.lineTo(c - e * 0.2, d); g.stroke(); });
      g.fillStyle = '#3a2618'; g.beginPath(); g.moveTo(W * 0.3, H); g.quadraticCurveTo(W * 0.44, H * 0.9, W * 0.45, H * 0.78); g.lineTo(W * 0.55, H * 0.78); g.quadraticCurveTo(W * 0.56, H * 0.9, W * 0.7, H); g.closePath(); g.fill(); g.strokeStyle = '#140c06'; g.lineWidth = 2; g.stroke(); };
    return [...cruzCartao(0.5, 0.5, 1.6, 1.6, 0, 3.4, arvore)];
  },
  SightToken() { return [cil(0.5, 0.5, 0.38, 0.38, 0, 0.05, '#8f8270', 'textura')]; },
  InteractToken() { return [cil(0.5, 0.5, 0.38, 0.38, 0, 0.05, '#8f8270', 'textura')]; }
};

/* the printed image of a card (and its edge silhouette), drawn once */
function imagemDoCartao(chave, arte, W, H, tex) {
  const k = chave + ':' + W + 'x' + H; let c = _cartoes.get(k); if (c) return c;
  const img = document.createElement('canvas'); img.width = Math.max(2, Math.round(W)); img.height = Math.max(2, Math.round(H)); const g = img.getContext('2d');
  if (arte && arte.textura) { if (tex && tex.complete) { const [x, y, w, h] = arte.textura; g.drawImage(tex, x * TEX_PX, y * TEX_PX, w * TEX_PX, h * TEX_PX, 0, 0, img.width, img.height); contorno(g, img.width, img.height); } else return null; }
  else arte(g, img.width, img.height, CARTAO_PX);
  const borda = document.createElement('canvas'); borda.width = img.width; borda.height = img.height; const b = borda.getContext('2d');
  b.drawImage(img, 0, 0); b.globalCompositeOperation = 'source-in'; b.fillStyle = COR_BORDA_CARTAO; b.fillRect(0, 0, borda.width, borda.height);
  // the same silhouette in black: laid over the face with some opacity, it shades the card away from the light (a
  // canvas filter would do it too, but it is far too slow)
  const sombra = document.createElement('canvas'); sombra.width = img.width; sombra.height = img.height; const sg = sombra.getContext('2d');
  sg.drawImage(img, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, sombra.width, sombra.height);
  c = { img, borda, sombra }; _cartoes.set(k, c); return c;
}
const alturaDoModelo = pecas => Math.max(...pecas.map(q => q.cil ? q.z[1] : Math.max(q.o[2], q.o[2] + q.u[2], q.o[2] + q.v[2], q.o[2] + q.u[2] + q.v[2])));
