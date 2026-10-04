/* Bigorna Rooms v2 — the 3D view: the board seen from an angle, turned with the mouse, to check the layers.
   Orthographic projection (yaw around the vertical axis, pitch from top-down towards the horizon). Tiles are slabs
   at their level; objects, heroes and monsters lie flat on their tile; pillars are crossed grey cardboard pieces under their sockets.
   The view is for looking: the selection stays, but nothing is placed or moved here. */
'use strict';

const ALTURA_NIVEL = C * 1.05;      // height of one level
const LAJE = C * 0.22;              // thickness of a tile slab
let orbita = null;

/* projection of a world point (board units x, y and height z in pixels) to screen pixels, before pan and zoom */
const _trig3 = { yaw: NaN, pitch: NaN, ca: 1, sa: 0, cp: 1, sp: 0 };     // cos/sin of the angles, worked out again only when they change
function proj3(x, y, z) {
  const t = _trig3; if (t.yaw !== vista3d.yaw || t.pitch !== vista3d.pitch) { t.yaw = vista3d.yaw; t.pitch = vista3d.pitch; t.ca = Math.cos(t.yaw); t.sa = Math.sin(t.yaw); t.cp = Math.cos(t.pitch); t.sp = Math.sin(t.pitch); }
  const { ca, sa, cp, sp } = t;
  const X = x * C, Y = y * C;
  const u = X * ca - Y * sa, v = X * sa + Y * ca;
  return { sx: u, sy: v * cp - z * sp, perto: v * sp + z * cp };
}
const alturaDe = lv => (lv || 0) * ALTURA_NIVEL;
/* sets the canvas transform to the horizontal plane at height z: 2D drawing in board pixels then lands on that plane */
function planoEm(z) {
  const dpr = devicePixelRatio, k = vista3d.zoom; const ca = Math.cos(vista3d.yaw), sa = Math.sin(vista3d.yaw), cp = Math.cos(vista3d.pitch), sp = Math.sin(vista3d.pitch);
  ctx.setTransform(dpr * k * ca, dpr * k * sa * cp, -dpr * k * sa, dpr * k * ca * cp, dpr * vista3d.px, dpr * (vista3d.py - k * z * sp));
}
function planoTela() { const dpr = devicePixelRatio; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
const naTela = p => [vista3d.px + p.sx * vista3d.zoom, vista3d.py + p.sy * vista3d.zoom];
/* does an outward normal (nx, ny) of a vertical face point towards the viewer? */
const olhaParaMim = (nx, ny) => nx * Math.sin(vista3d.yaw) + ny * Math.cos(vista3d.yaw) > 0;

function desenhar3d() {
  const zoom2d = vista.zoom; vista.zoom = vista3d.zoom;      // the 2D helpers size lines and fonts by vista.zoom
  try { desenhar3dCorpo(); } finally { vista.zoom = zoom2d; }
}
function desenhar3dCorpo() {
  const dpr = devicePixelRatio; planoTela();
  const W = tela.width / dpr, H = tela.height / dpr;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, H);
  const lista = [];                       // what is drawn, far to near
  const fundo = [];                       // the underlays, drawn first (the tiles lie over them)
  const lajes = [];                       // the tiles, to hang what sits on them (a piece on a tile is always drawn right after it)
  // the 3D view is for looking, not editing: every room at full strength; the room the user clicked gets an outline
  const alfaSala = () => 1;
  const foco = vista3d.foco != null && projeto.salas[vista3d.foco] ? vista3d.foco : null;
  const casasFoco = foco != null ? new Set(projeto.salas[foco].pecas.filter(q => !ehAlfombra(q.tile)).flatMap(casasDaPeca).map(c => c.join(','))) : null;
  /* the entry of the tile under a square at the given level (the highest one covering it, if none at that level) */
  const lajesDaCasa = new Map();          // square -> the tiles covering it, in the order of `lajes`
  const lajeDe = (x, y, lv) => { let melhor = null; (lajesDaCasa.get(x + ',' + y) || []).forEach(t => { if (t.lv === lv) melhor = t; else if (!melhor || (melhor.lv !== lv && t.lv > melhor.lv)) melhor = t; }); return melhor; };
  const pendurar = (x, y, lv, item) => { const t = lajeDe(x, y, lv); if (t) t.filhos.push(item); else lista.push(item); };
  // ground grid around the map
  const todas = projeto.salas.flatMap(s => s.pecas.flatMap(casasDaPeca).concat(s.objetos.flatMap(casasDoObjeto)));
  const xs = todas.map(c => c[0]), ys = todas.map(c => c[1]);
  const gx0 = (todas.length ? Math.min(...xs) : 15) - 3, gx1 = (todas.length ? Math.max(...xs) : 25) + 4, gy0 = (todas.length ? Math.min(...ys) : 15) - 3, gy1 = (todas.length ? Math.max(...ys) : 25) + 4;
  planoEm(0); ctx.lineWidth = 1 / vista3d.zoom;
  for (let x = gx0; x <= gx1; x++) { ctx.strokeStyle = x % 5 ? COR.grade : COR.gradeForte; ctx.beginPath(); ctx.moveTo(x * C, gy0 * C); ctx.lineTo(x * C, gy1 * C); ctx.stroke(); }
  for (let y = gy0; y <= gy1; y++) { ctx.strokeStyle = y % 5 ? COR.grade : COR.gradeForte; ctx.beginPath(); ctx.moveTo(gx0 * C, y * C); ctx.lineTo(gx1 * C, y * C); ctx.stroke(); }
  // tiles (slabs) and their pillars
  const adicionadas = pecasAdicionadas();
  projeto.salas.forEach((s, si) => s.pecas.forEach((p, pi) => {
    const alf = ehAlfombra(p.tile); const aAd = adicionadas.has(si + ':' + pi) ? 0.55 : 1; const lv = alf ? 0 : (p.level || 0); const casas = casasDaPeca(p); if (!casas.length) return;
    const cx = casas.reduce((a, c) => a + c[0], 0) / casas.length + 0.5, cy = casas.reduce((a, c) => a + c[1], 0) / casas.length + 0.5;
    const topo = alturaDe(lv) + (alf ? 0.5 : 0);
    const selecionada = sel && sel.tipo === 'peca' && sel.sala === si && sel.i === pi;
    const entrada = { perto: proj3(cx, cy, topo).perto - (alf ? 0.01 : 0), casas: new Set(casas.map(c => c.join(','))), lv: alf ? -1 : lv, filhos: [], fn: () => {
      if (!alf && lv > 0) lados(casas, ehCaixa(p.tile) ? 0 : topo - LAJE, topo, alfaSala(si) * aAd, p);
      planoEm(topo); ctx.globalAlpha = 1; desenharPeca(p, alfaSala(si) * aAd, false, false); ctx.globalAlpha = 1;
      // the walls of a walled tile (the vault): a ring two levels high, drawn over its floor
      const mu = murosDaPeca(p); if (mu) { const zt = alturaDe(lv + mu.altura); lados(mu.casas, topo, zt, alfaSala(si) * aAd, p); planoEm(zt); ctx.globalAlpha = alfaSala(si) * aAd;
        mu.casas.forEach(([x, y]) => { ctx.fillStyle = '#bfae8c'; ctx.fillRect(x * C, y * C, C, C); ctx.strokeStyle = 'rgba(60,45,30,.7)'; ctx.lineWidth = 1 / vista3d.zoom; ctx.strokeRect(x * C, y * C, C, C); }); ctx.globalAlpha = 1; planoEm(topo); }
      if (si === foco && !alf) contornoDoFoco(casas, casasFoco);
      entrada.filhos.sort((a, b) => a.perto - b.perto).forEach(it => it.fn());
    } };
    // an underlay lies under the tiles (a sheet slid beneath them): all of them are drawn before anything else
    (alf ? fundo : lista).push(entrada); if (!alf) { lajes.push(entrada); entrada.casas.forEach(k => { const l = lajesDaCasa.get(k); if (l) l.push(entrada); else lajesDaCasa.set(k, [entrada]); }); }
    (p.pilares || []).forEach(q => {
      const z1 = topo - LAJE; const [vx, vy] = q.pos;
      const selecionado = sel && sel.tipo === 'pilar' && sel.sala === si && sel.pos[0] === vx && sel.pos[1] === vy;
      lista.push({ perto: proj3(vx, vy, z1 * 0.5).perto, fn: () => pilarCruz(vx, vy, 0, z1, alfaSala(si), selecionado, SUPORTES[q.type]?.nivel || 1) });
    });
  }));
  // heroes
  projeto.salas.forEach((s, si) => s.herois.forEach((h, hi) => {
    const z = alturaDe(h[2]) + 0.6; const selecionado = sel && sel.tipo === 'heroi' && sel.sala === si && sel.i === hi;
    pendurar(h[0], h[1], h[2] || 0, { perto: proj3(h[0] + .5, h[1] + .5, z).perto + 0.05, fn: () => { planoEm(z); ctx.globalAlpha = alfaSala(si);
      ctx.fillStyle = COR.heroi; ctx.beginPath(); ctx.arc(h[0] * C + C / 2, h[1] * C + C / 2, C * 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10261f'; ctx.font = `bold 12px system-ui`; ctx.textAlign = 'center'; ctx.fillText('H' + (hi + 1), h[0] * C + C / 2, h[1] * C + C / 2 + 4.5); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      if (selecionado) marcarSelecao(h[0], h[1], 1, 1); } });
  }));
  // objects, flat on their level
  projeto.salas.forEach((s, si) => s.objetos.forEach((o, oi) => {
    const casas = casasDoObjeto(o); const xs = casas.map(c => c[0]), ys = casas.map(c => c[1]); const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1;
    const terreno = ehTerreno(o); const z = alturaDe(o.level) + (terreno ? 0.4 : 0.8); const vObj = varObj(o.type);
    const selecionado = sel && sel.tipo === 'objeto' && sel.sala === si && sel.i === oi;
    // a column standing on a square is the same crossed cardboard pillar, one level tall
    // a staircase: stone steps rising from the ribbon level to the next one, towards the arrow
    // it stands on the tiles of its level: drawn after the last of them (so no tile covers it), steps among themselves far to near
    if (ehTipo(o, 'Staircase')) { const zb = alturaDe(o.level), lv = o.level || 0;
      const sob = casas.map(([cx, cy]) => lajeDe(cx, cy, lv)).filter(t => t && t.lv === lv).sort((a, b) => b.perto - a.perto)[0];
      const degraus = degrausDaEscadaria(o, x0, y0, w, h, zb, alfaSala(si) * (o.hidden ? 0.55 : 1), selecionado); degraus.forEach(it => sob ? sob.filhos.push(it) : lista.push(it));
      // the tile the staircase climbs to lies over its last step: drawn after the steps
      const [ux, uy] = SOBE[((o.rot || 0) % 360 + 360) % 360 / 90] || [1, 0]; const depois = sob ? sob.perto : Math.max(...degraus.map(it => it.perto));
      const cima = new Set(); casas.forEach(([cx, cy]) => [[cx, cy], [cx + ux, cy + uy]].forEach(([a, b]) => { const t = lajeDe(a, b, lv + 1); if (t && t.lv === lv + 1) cima.add(t); }));
      cima.forEach(t => { if (t.perto <= depois) t.perto = depois + 1e-4; }); return; }
    // a ladder: two rails leaning from the square towards the arrow's side, one level tall (short) or two (medium)
    if (ehTipo(o, 'Ladder') || ehTipo(o, 'LadderMedium')) { const zb = alturaDe(o.level); const n = ehTipo(o, 'LadderMedium') ? 2 : 1; pendurar(o.pos[0], o.pos[1], o.level || 0, { perto: proj3(o.pos[0] + .5, o.pos[1] + .5, zb + ALTURA_NIVEL * n / 2).perto + 0.08, fn: () => escadaDeMao(o, zb, n, alfaSala(si) * (o.hidden ? 0.55 : 1), selecionado) }); return; }
    if (ehTipo(o, 'PillarObj') || ehTipo(o, 'PillarPush')) { const zb = alturaDe(o.level); pendurar(o.pos[0], o.pos[1], o.level || 0, { perto: proj3(o.pos[0] + .5, o.pos[1] + .5, zb + ALTURA_NIVEL / 2).perto + 0.08, fn: () => pilarCruz(o.pos[0] + .5, o.pos[1] + .5, zb, zb + ALTURA_NIVEL * (SUPORTES[o.tamanho || 'Pillar']?.nivel || 2) / 2, alfaSala(si) * (o.hidden ? 0.55 : 1), selecionado) }); return; }
    // a game object with its own 3D stand-in (texturas.js): boxes and cylinders, textured on top
    const modelo = !vObj && modeloDoObjeto(o.type);
    if (modelo) { const zb = alturaDe(o.level); const alto = alturaDoModelo(modelo);
      pendurar(o.pos[0], o.pos[1], o.level || 0, { perto: proj3(x0 + w / 2, y0 + h / 2, zb + alto * C / 2).perto + 0.08, fn: () => desenharModelo(o, modelo, x0, y0, w, h, zb, alfaSala(si) * (o.hidden ? 0.55 : 1), selecionado) }); return; }
    (terreno ? it => lista.push(it) : it => pendurar(o.pos[0], o.pos[1], o.level || 0, it))({ perto: proj3(x0 + w / 2, y0 + h / 2, z).perto + (terreno ? 0.02 : 0.08), fn: () => { planoEm(z); ctx.globalAlpha = alfaSala(si) * (o.hidden ? 0.55 : 1);
      const img = imagemObj(o.type); const tex = !vObj && texturaDoObjeto(o.type);
      if (tex) desenharTexturaGirada(tex, o, x0, y0, w, h);
      else if (terreno) { ctx.fillStyle = 'rgba(120,110,95,.7)'; ctx.fillRect(x0 * C, y0 * C, w * C, h * C); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; casas.forEach(([x, y]) => ctx.strokeRect(x * C + .5, y * C + .5, C - 1, C - 1)); }
      else if (vObj) { ctx.fillStyle = vObj.cor || '#6a5a48'; casas.forEach(([x, y]) => ctx.fillRect(x * C + 1.5, y * C + 1.5, C - 3, C - 3)); }
      else { ctx.fillStyle = 'rgba(20,18,24,.8)'; arredondado(x0 * C + 2, y0 * C + 2, w * C - 4, h * C - 4, 5); ctx.fill(); }
      if (!tex && img && img.complete && img.naturalWidth) desenharImagemGirada(img, o, x0, y0, w, h);
      if (ehTipo(o, 'Staircase')) desenharSeta(o, x0, y0, w, h);
      if ((o.gatilhos || []).length) { ctx.strokeStyle = o.gatilhos.some(g => g.tipo === 'open_room') ? COR.abre : COR.gatilho; ctx.lineWidth = 2.5; arredondado(x0 * C + 1.5, y0 * C + 1.5, w * C - 3, h * C - 3, 5); ctx.stroke(); }
      ctx.globalAlpha = 1; if (selecionado) marcarSelecao(x0, y0, w, h);
      // a standing card: the picture upright over the centre of its squares, turned to the viewer
      const vb = vObj; if (vb && vb.exibir === 'block') desenharBloco(vb, casas, z - 0.8 + 0.4, alfaSala(si) * (o.hidden ? 0.55 : 1), x0, y0, w, h);
      const vm = vObj; if (vm && vm.exibir === 'model' && vm.modelo) desenharMalhaDoObjeto(vm, o, casas, z, alfaSala(si) * (o.hidden ? 0.55 : 1));
      const vo = vObj; if (vo && vo.exibir === 'standee' && vo.standee) { const im = retratoImg('standee:' + vo.id, vo.standee);
        if (im && im.complete && im.naturalWidth) { const cx = casas.reduce((a, c) => a + c[0], 0) / casas.length + 0.5, cy = casas.reduce((a, c) => a + c[1], 0) / casas.length + 0.5;
          const H = (vo.alturaStandee || 1.4) * C; const [bx, by] = naTela(proj3(cx, cy, z)); const [, ty] = naTela(proj3(cx, cy, z + H));
          const hp = by - ty, wp = H * vista3d.zoom * im.naturalWidth / im.naturalHeight; planoTela(); ctx.globalAlpha = alfaSala(si) * (o.hidden ? 0.55 : 1);
          if (hp > 2) ctx.drawImage(im, bx - wp / 2, ty, wp, hp); ctx.globalAlpha = 1; } } } });
  }));
  // monsters, flat too
  projeto.salas.forEach((s, si) => inimigosDaSala(s).forEach(({ e, origem }) => {
    const [x, y] = e.pos; const z = alturaDe(e.level) + 0.9; const spawn = origem.tipo === 'gat';
    const selecionado = sel && sel.tipo === 'inimigo' && sel.sala === si && ((origem.tipo === 'sala' && sel.g === undefined && sel.i === origem.i) || (origem.tipo === 'gat' && sel.g === origem.g && sel.obj === origem.obj && (sel.l || 'gatilhos') === origem.l && sel.i === origem.k));
    pendurar(x, y, e.level || 0, { perto: proj3(x + .5, y + .5, z).perto + 0.1, fn: () => { planoEm(z); const img = retratoImg('ini:' + e.enemy, iconeIni(e.enemy));
      ctx.globalAlpha = alfaSala(si) * (spawn ? 0.85 : 1);
      ctx.fillStyle = ehPool(e.enemy) ? COR.pool : spawn ? COR.spawn : COR.inimigo; ctx.beginPath(); ctx.arc(x * C + C / 2, y * C + C / 2, C * 0.44, 0, Math.PI * 2); ctx.fill();
      if (img && img.complete && img.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(x * C + C / 2, y * C + C / 2, C * 0.38, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, x * C + C * 0.12, y * C + C * 0.12, C * 0.76, C * 0.76); ctx.restore(); }
      ctx.globalAlpha = 1; if (selecionado) marcarSelecao(x, y, 1, 1);
      // a monster with a standing card: the picture upright on its space (height by the monster size)
      const mm = monstro(e.enemy); if (mm && mm.figura === 'standee' && mm.standee) { const im = retratoImg('standee:' + mm.id, mm.standee);
        if (im && im.complete && im.naturalWidth) { const H = [1.1, 1.4, 1.9, 2.6][mm.size || 0] * (mm.escalaStandee || 1) * C; const [bx, by] = naTela(proj3(x + .5, y + .5, z)); const [, ty] = naTela(proj3(x + .5, y + .5, z + H));
          const hp = by - ty, wp = H * vista3d.zoom * im.naturalWidth / im.naturalHeight; planoTela(); ctx.globalAlpha = alfaSala(si); if (hp > 2) ctx.drawImage(im, bx - wp / 2, ty, wp, hp); ctx.globalAlpha = 1; } } } });
  }));
  fundo.sort((a, b) => a.perto - b.perto).forEach(it => it.fn());
  lista.sort((a, b) => a.perto - b.perto).forEach(it => it.fn());
  // room labels, upright, at the ground
  planoTela();
  projeto.salas.forEach((s, si) => {
    const casas = s.pecas.filter(p => !ehAlfombra(p.tile)).flatMap(casasDaPeca); if (!casas.length) return;
    const lv = Math.max(...s.pecas.map(p => p.level || 0));
    const cx = casas.reduce((a, c) => a + c[0], 0) / casas.length + 0.5, cy = casas.reduce((a, c) => a + c[1], 0) / casas.length + 0.5;
    const [px, py] = naTela(proj3(cx, cy, alturaDe(lv) + C * 0.9));
    ctx.fillStyle = si === foco ? 'rgba(120,220,255,1)' : 'rgba(236,228,214,.85)'; ctx.font = `600 13px system-ui`; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
    ctx.fillText((si + 1) + ' · ' + s.nome, px, py); ctx.shadowBlur = 0; ctx.textAlign = 'left';
  });
  // level scale in the corner
  ctx.fillStyle = COR.texto; ctx.font = '11px system-ui'; ctx.fillText('3D view · drag moves the map · right-drag or Alt+drag turns it · Q/E turn 45° · W/S tilt · wheel zooms · Esc back to the plan', 12, H - 12);
}
/* the outline of the clicked room: the edges of its floor, drawn on the plane of each tile */
function contornoDoFoco(casas, todas) {
  const linha = (cor, larg) => { ctx.strokeStyle = cor; ctx.lineWidth = larg / vista3d.zoom; ctx.beginPath();
    casas.forEach(([x, y]) => { if (!todas.has(x + ',' + (y - 1))) { ctx.moveTo(x * C, y * C); ctx.lineTo((x + 1) * C, y * C); } if (!todas.has(x + ',' + (y + 1))) { ctx.moveTo(x * C, (y + 1) * C); ctx.lineTo((x + 1) * C, (y + 1) * C); }
      if (!todas.has((x - 1) + ',' + y)) { ctx.moveTo(x * C, y * C); ctx.lineTo(x * C, (y + 1) * C); } if (!todas.has((x + 1) + ',' + y)) { ctx.moveTo((x + 1) * C, y * C); ctx.lineTo((x + 1) * C, (y + 1) * C); } }); ctx.stroke(); };
  ctx.save(); ctx.globalAlpha = 1; linha('rgba(0,0,0,.55)', 7); linha('rgba(120,220,255,.95)', 3.5); ctx.restore();
}
/* a click on a room (in the list, or on its tiles in the view): it gets an outline and the camera goes to it */
function focar3d(si) {
  const s = projeto.salas[si]; if (!s) return; vista3d.foco = si; salaAtual = si; sel = null;
  const pts = []; s.pecas.forEach(p => { if (ehAlfombra(p.tile)) return; const z = alturaDe(p.level); casasDaPeca(p).forEach(([x, y]) => { pts.push(proj3(x, y, z), proj3(x + 1, y + 1, z), proj3(x + 1, y, z), proj3(x, y + 1, z)); }); });
  if (!pts.length) { tudo(); return; }
  const r = tela.getBoundingClientRect(); const x0 = Math.min(...pts.map(p => p.sx)), x1 = Math.max(...pts.map(p => p.sx)), y0 = Math.min(...pts.map(p => p.sy)), y1 = Math.max(...pts.map(p => p.sy));
  const zoom = Math.min(vista3d.zoom, Math.max(0.2, Math.min(r.width * 0.8 / Math.max(1, x1 - x0), r.height * 0.8 / Math.max(1, y1 - y0))));
  const alvo = { zoom, px: r.width / 2 - (x0 + x1) / 2 * zoom, py: r.height / 2 - (y0 + y1) / 2 * zoom };
  const de = { zoom: vista3d.zoom, px: vista3d.px, py: vista3d.py }, t0 = performance.now(), dur = 320; animacao3d = t0;
  const passo = t => { if (animacao3d !== t0) return; const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    vista3d.zoom = de.zoom + (alvo.zoom - de.zoom) * e; vista3d.px = de.px + (alvo.px - de.px) * e; vista3d.py = de.py + (alvo.py - de.py) * e; desenhar(); if (k < 1) requestAnimationFrame(passo); else animacao3d = null; };
  tudo(); requestAnimationFrame(passo);
}
/* the room whose tile is under the mouse in the 3D view (the one nearest the viewer), or -1 */
function salaEm3d(mx, my) {
  const ca = Math.cos(vista3d.yaw), sa = Math.sin(vista3d.yaw), cp = Math.cos(vista3d.pitch), sp = Math.sin(vista3d.pitch);
  const sx = (mx - vista3d.px) / vista3d.zoom, sy = (my - vista3d.py) / vista3d.zoom; let melhor = -1, perto = -Infinity;
  projeto.salas.forEach((s, si) => s.pecas.forEach(p => { if (ehAlfombra(p.tile)) return; const z = alturaDe(p.level); const v = (sy + z * sp) / cp;
    const X = sx * ca + v * sa, Y = -sx * sa + v * ca; const cx = Math.floor(X / C), cy = Math.floor(Y / C);
    if (casasDaPeca(p).some(c => c[0] === cx && c[1] === cy)) { const pp = proj3(cx + .5, cy + .5, z).perto; if (pp > perto) { perto = pp; melhor = si; } } }));
  return melhor;
}
/* the vertical faces of a slab between heights z0 and z1 around the given squares (only edges with no neighbour, facing the viewer) */
function lados(casas, z0, z1, alfa, p) {
  const S = new Set(casas.map(c => c.join(','))); const v = varPeca(p.tile); const cor = v?.cor || null;
  planoTela(); ctx.globalAlpha = alfa;
  const face = (ax, ay, bx, by, nx, ny) => {
    if (!olhaParaMim(nx, ny)) return;
    const a0 = naTela(proj3(ax, ay, z0)), a1 = naTela(proj3(ax, ay, z1)), b0 = naTela(proj3(bx, by, z0)), b1 = naTela(proj3(bx, by, z1));
    const luz = 0.55 + 0.45 * Math.max(0, nx * Math.sin(vista3d.yaw + 0.9) + ny * Math.cos(vista3d.yaw + 0.9));
    ctx.fillStyle = cor ? sombrear(cor, luz * 0.8) : `rgb(${Math.round(92 * luz)},${Math.round(80 * luz)},${Math.round(64 * luz)})`;
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(b0[0], b0[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1; ctx.stroke();
  };
  casas.forEach(([x, y]) => {
    if (!S.has(x + ',' + (y - 1))) face(x, y, x + 1, y, 0, -1);
    if (!S.has(x + ',' + (y + 1))) face(x, y + 1, x + 1, y + 1, 0, 1);
    if (!S.has((x - 1) + ',' + y)) face(x, y, x, y + 1, -1, 0);
    if (!S.has((x + 1) + ',' + y)) face(x + 1, y, x + 1, y + 1, 1, 0);
  });
  ctx.globalAlpha = 1;
}
function sombrear(hex, k) { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.round(((n >> 16) & 255) * k)), g = Math.min(255, Math.round(((n >> 8) & 255) * k)), b = Math.min(255, Math.round((n & 255) * k)); return `rgb(${r},${g},${b})`; }
/* a pillar as in the box: two tall grey cardboard pieces slotted into each other, a cross seen from above.
   Each of the four arms is a flat vertical panel from the centre outwards; they are drawn far to near. */
const MEIA_CRUZ = 0.27;
function pilarCruz(vx, vy, z0, z1, alfa, selecionado, numero) {
  planoTela(); ctx.globalAlpha = alfa;
  const braços = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => {
    const ex = vx + dx * MEIA_CRUZ, ey = vy + dy * MEIA_CRUZ;
    return { dx, dy, pts: [proj3(vx, vy, z0), proj3(ex, ey, z0), proj3(ex, ey, z1), proj3(vx, vy, z1)], perto: proj3(vx + dx * MEIA_CRUZ / 2, vy + dy * MEIA_CRUZ / 2, (z0 + z1) / 2).perto };
  }).sort((a, b) => a.perto - b.perto);
  braços.forEach(b => {
    const [p0, p1, p2, p3] = b.pts.map(naTela);
    // light from the upper left of the board: arms along x and along y get different greys, like the two pieces in the box
    const base = b.dx !== 0 ? '#9ba1a8' : '#7d838b';
    const g = ctx.createLinearGradient(p3[0], p3[1], p0[0], p0[1]); g.addColorStop(0, sombrear(base, 1.12)); g.addColorStop(1, sombrear(base, 0.78));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(20,22,26,.8)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(235,238,242,.55)'; ctx.beginPath(); ctx.moveTo(...p3); ctx.lineTo(...p2); ctx.stroke();   // the cut top edge of the cardboard
  });
  const [tx, ty] = naTela(proj3(vx, vy, z1)), [bx, by] = naTela(proj3(vx, vy, z0));
  if (numero && vista3d.zoom * C * MEIA_CRUZ > 6) { ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3; ctx.font = `bold ${Math.min(11, vista3d.zoom * C * 0.22)}px system-ui`; ctx.textAlign = 'center'; const ym = (ty + by) / 2 + 3; ctx.strokeText(numero, tx, ym); ctx.fillText(numero, tx, ym); ctx.textAlign = 'left'; }
  if (selecionado) { const r = vista3d.zoom * C * MEIA_CRUZ + 4; ctx.strokeStyle = COR.selec; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(tx, ty, r, Math.max(r * Math.cos(vista3d.pitch), 2), 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
/* the steps of a staircase, one per square: blocks from the low end to the high end (the arrow's side), each a bit taller, as items to
   draw far to near; the top, the riser, the back and the two sides of each block, lit from the upper left */
function degrausDaEscadaria(o, x0, y0, w, h, z0, alfa, selecionado) {
  const a = ((o.rot || 0) % 360) * Math.PI / 180, dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a));
  const L = dx !== 0 ? w : h, W = dx !== 0 ? h : w, px = -dy, py = dx;
  const cx = x0 + w / 2, cy = y0 + h / 2;
  const P = (t, s, z) => proj3(cx + dx * (t - L / 2) + px * (s - W / 2), cy + dy * (t - L / 2) + py * (s - W / 2), z);
  const n = Math.max(1, Math.round(L)), H = ALTURA_NIVEL, itens = [];   // one step per square along the way up (3 on the box's staircase)
  const face = (pts, cor) => { const q = pts.map(naTela); ctx.fillStyle = cor; ctx.beginPath(); ctx.moveTo(...q[0]); q.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(20,18,16,.75)'; ctx.lineWidth = 1; ctx.stroke(); };
  for (let k = 0; k < n; k++) {
    const t0 = k * L / n, t1 = (k + 1) * L / n, z1 = z0 + (k + 1) * H / n;
    itens.push({ perto: P((t0 + t1) / 2, W / 2, (z0 + z1) / 2).perto + 0.02, fn: () => {
      planoTela(); ctx.globalAlpha = alfa;
      if (olhaParaMim(px, py)) face([P(t0, W, z0), P(t1, W, z0), P(t1, W, z1), P(t0, W, z1)], '#8d857a'); else face([P(t0, 0, z0), P(t1, 0, z0), P(t1, 0, z1), P(t0, 0, z1)], '#8d857a');
      if (olhaParaMim(dx, dy)) face([P(t1, 0, z0), P(t1, W, z0), P(t1, W, z1), P(t1, 0, z1)], '#6f685f');
      else face([P(t0, 0, z0), P(t0, W, z0), P(t0, W, z1), P(t0, 0, z1)], '#766e64');
      face([P(t0, 0, z1), P(t1, 0, z1), P(t1, W, z1), P(t0, W, z1)], k === n - 1 ? '#b3ab9f' : '#a39b8f');
      if (selecionado && k === n - 1) { ctx.strokeStyle = COR.selec; ctx.lineWidth = 2; const q = [P(0, 0, z0), P(L, 0, z0), P(L, W, z0), P(0, W, z0)].map(naTela); ctx.beginPath(); ctx.moveTo(...q[0]); q.slice(1).forEach(p => ctx.lineTo(...p)); ctx.closePath(); ctx.stroke(); }
      ctx.globalAlpha = 1; } });
  }
  return itens;
}
/* a ladder standing on its square: the foot near the back of the square, the top against the side the arrow points to,
   n levels up; wooden rails and rungs */
function escadaDeMao(o, z0, n, alfa, selecionado) {
  planoTela(); ctx.globalAlpha = alfa;
  const a = ((o.rot || 0) % 360) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
  const cx = o.pos[0] + .5, cy = o.pos[1] + .5, hw = 0.2;
  const pe = [cx - dx * 0.32, cy - dy * 0.32], topo = [cx + dx * 0.47, cy + dy * 0.47], z1 = z0 + ALTURA_NIVEL * n;
  const ponto = (t, lado) => naTela(proj3(pe[0] + (topo[0] - pe[0]) * t + px * hw * lado, pe[1] + (topo[1] - pe[1]) * t + py * hw * lado, z0 + (z1 - z0) * t));
  const w = Math.max(1.5, vista3d.zoom * C * 0.06);
  // the rail further from the viewer first
  const lados = [-1, 1].sort((l1, l2) => proj3(cx + px * hw * l1, cy + py * hw * l1, z0).perto - proj3(cx + px * hw * l2, cy + py * hw * l2, z0).perto);
  const trilho = l => { const [x0, y0] = ponto(0, l), [x1, y1] = ponto(1.08, l); ctx.strokeStyle = 'rgba(30,20,12,.9)'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = '#9a6b3c'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  trilho(lados[0]);
  const degraus = 4 * n; ctx.lineCap = 'round';
  for (let k = 1; k <= degraus; k++) { const t = k / (degraus + 1); const [x0, y0] = ponto(t, -1), [x1, y1] = ponto(t, 1); ctx.strokeStyle = 'rgba(30,20,12,.85)'; ctx.lineWidth = w * 0.8 + 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = '#b8864f'; ctx.lineWidth = w * 0.8; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  trilho(lados[1]); ctx.lineCap = 'butt';
  if (selecionado) { const [sx, sy] = ponto(0.5, 0); const r = vista3d.zoom * C * 0.4; ctx.strokeStyle = COR.selec; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------ view control
function alternar3d(ligar) {
  const on = ligar === undefined ? !vista3d.on : ligar;
  if (on === vista3d.on) return;
  vista3d.on = on; vista3d.foco = null; cursor = null; cruz = null; ferramenta = null; escolha = null; movendo = null; arrasto = null; orbita = null;
  $('#controles3d').hidden = !on;
  if (on) { enquadrar3d(); marcarVisto('dica:3d'); } tudo();
}
/* one redraw per frame, however many mouse events arrive */
let quadroPedido = false;
function pedirDesenho() { if (quadroPedido) return; quadroPedido = true; requestAnimationFrame(() => { quadroPedido = false; desenhar(); }); }
/* the ground point at the centre of the canvas (board units) */
function centro3d() {
  const r = tela.getBoundingClientRect(); const ca = Math.cos(vista3d.yaw), sa = Math.sin(vista3d.yaw), cp = Math.cos(vista3d.pitch);
  const u = (r.width / 2 - vista3d.px) / vista3d.zoom, v = (r.height / 2 - vista3d.py) / vista3d.zoom / cp;
  return [(u * ca + v * sa) / C, (-u * sa + v * ca) / C];
}
/* new angles, turning around the centre of the view (the map stays in place on the screen) */
function angulo3d(yaw, pitch) {
  const [x, y] = centro3d(); const r = tela.getBoundingClientRect();
  vista3d.yaw = yaw; vista3d.pitch = Math.max(0, Math.min(1.45, pitch));   // 0 = straight from above, 1.45 = almost from the side
  const p = proj3(x, y, 0); vista3d.px = r.width / 2 - p.sx * vista3d.zoom; vista3d.py = r.height / 2 - p.sy * vista3d.zoom;
}
let animacao3d = null;
function animar3d(yaw, pitch) {
  const de = { yaw: vista3d.yaw, pitch: vista3d.pitch }, t0 = performance.now(), dur = 260; animacao3d = t0;
  const passo = t => { if (animacao3d !== t0) return; const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    angulo3d(de.yaw + (yaw - de.yaw) * e, de.pitch + (pitch - de.pitch) * e); desenhar(); if (k < 1) requestAnimationFrame(passo); else animacao3d = null; };
  requestAnimationFrame(passo);
}
const girar3d = graus => animar3d(vista3d.yaw + graus * Math.PI / 180, vista3d.pitch);
const inclinar3d = graus => animar3d(vista3d.yaw, vista3d.pitch + graus * Math.PI / 180);
const vistaDeCima = () => animar3d(Math.round(vista3d.yaw / (Math.PI / 2)) * Math.PI / 2, 0);
const vistaInicial = () => animar3d(-0.6, 0.95);
/* the mouse in 3D: dragging moves the map (the angle stays); the right button (or Alt+drag) turns it; the wheel zooms */
function mouse3d(tipo, ev) {
  if (tipo === 'down') { if (ev.button > 2) return; animacao3d = null; orbita = { x: ev.clientX, y: ev.clientY, yaw: vista3d.yaw, pitch: vista3d.pitch, px: vista3d.px, py: vista3d.py, girar: ev.button === 2 || ev.altKey, botao: ev.button }; return; }
  if (tipo === 'move') { if (!orbita) return; const dx = ev.clientX - orbita.x, dy = ev.clientY - orbita.y;
    if (orbita.girar) { vista3d.yaw = orbita.yaw; vista3d.pitch = orbita.pitch; vista3d.px = orbita.px; vista3d.py = orbita.py; angulo3d(orbita.yaw + dx * 0.008, orbita.pitch + dy * 0.006); }
    else { vista3d.px = orbita.px + dx; vista3d.py = orbita.py + dy; }
    pedirDesenho(); return; }
  if (tipo === 'up') { const o = orbita; orbita = null; if (o && o.botao === 0 && !o.girar && ev && Math.abs(ev.clientX - o.x) + Math.abs(ev.clientY - o.y) < 4) { const r = tela.getBoundingClientRect(); const si = salaEm3d(ev.clientX - r.left, ev.clientY - r.top); if (si >= 0) focar3d(si); } return; }
  if (tipo === 'wheel') { const r = tela.getBoundingClientRect(); const mx = ev.clientX - r.left, my = ev.clientY - r.top; const f = ev.deltaY < 0 ? 1.15 : 1 / 1.15; zoom3dEm(f, mx, my); }
}
$$('#controles3d [data-c3]').forEach(b => b.onclick = () => { const c = b.dataset.c3;
  if (c === 'esq') girar3d(-45); else if (c === 'dir') girar3d(45); else if (c === 'sobe') inclinar3d(-12); else if (c === 'desce') inclinar3d(12);
  else if (c === 'topo') vistaDeCima(); else if (c === 'inicio') vistaInicial(); else if (c === 'enq') enquadrar3d(); else if (c === 'sair') alternar3d(false); });
function zoom3dEm(f, mx, my) { const z = Math.min(4, Math.max(0.2, vista3d.zoom * f)); const k = z / vista3d.zoom; vista3d.px = mx - (mx - vista3d.px) * k; vista3d.py = my - (my - vista3d.py) * k; vista3d.zoom = z; pedirDesenho(); }
function zoom3d(f) { const r = tela.getBoundingClientRect(); zoom3dEm(f, r.width / 2, r.height / 2); }
function enquadrar3d() {
  const r = tela.getBoundingClientRect();
  const pts = [];
  projeto.salas.forEach(s => { s.pecas.forEach(p => { const z = alturaDe(ehAlfombra(p.tile) ? 0 : p.level); casasDaPeca(p).forEach(([x, y]) => { pts.push(proj3(x, y, 0), proj3(x + 1, y + 1, 0), proj3(x, y, z), proj3(x + 1, y + 1, z), proj3(x + 1, y, z), proj3(x, y + 1, z)); }); }); s.objetos.forEach(o => casasDoObjeto(o).forEach(([x, y]) => pts.push(proj3(x, y, alturaDe(o.level)), proj3(x + 1, y + 1, alturaDe(o.level))))); });
  if (!pts.length) { vista3d.zoom = 1; const c = proj3(20, 20, 0); vista3d.px = r.width / 2 - c.sx; vista3d.py = r.height / 2 - c.sy; return desenhar(); }
  const x0 = Math.min(...pts.map(p => p.sx)), x1 = Math.max(...pts.map(p => p.sx)), y0 = Math.min(...pts.map(p => p.sy)), y1 = Math.max(...pts.map(p => p.sy));
  vista3d.zoom = Math.min(3, Math.max(0.2, Math.min(r.width / (x1 - x0 + 4 * C), r.height / (y1 - y0 + 4 * C))));
  vista3d.px = r.width / 2 - (x0 + x1) / 2 * vista3d.zoom; vista3d.py = r.height / 2 - (y0 + y1) / 2 * vista3d.zoom; desenhar();
}

/* a workshop object shown as a block: slices from the floor to its height (darker sides), then the top face in its colour
   with the picture laid across all its squares (the icon when there is none) */
function escurecer(hex, k) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; const n = parseInt(m[1], 16); const f = c => Math.round(c * k); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
/* a flat plane in space: local px (u right, v down) -> screen; O is the world point (board px, height px) of the local
   origin, U and V the world vectors of one local px along u and v (the projection is linear, so this is one transform) */
function planoLivre(O, U, V) {
  const dpr = devicePixelRatio, k = vista3d.zoom; const ca = Math.cos(vista3d.yaw), sa = Math.sin(vista3d.yaw), cp = Math.cos(vista3d.pitch), sp = Math.sin(vista3d.pitch);
  const a = U[0] * ca - U[1] * sa, b = (U[0] * sa + U[1] * ca) * cp - U[2] * sp, c = V[0] * ca - V[1] * sa, d = (V[0] * sa + V[1] * ca) * cp - V[2] * sp;
  const e = O[0] * ca - O[1] * sa, f = (O[0] * sa + O[1] * ca) * cp - O[2] * sp;
  ctx.setTransform(dpr * k * a, dpr * k * b, dpr * k * c, dpr * k * d, dpr * (vista3d.px + k * e), dpr * (vista3d.py + k * f));
}
/* the cardboard piece of a game object (papelao.js): printed cards with the board's edge showing, folded boxes (their
   hidden faces skipped) and round parts; everything turned with the object and drawn far to near */
const _idArte = new WeakMap(); let _proxArte = 1;
function desenharModelo(o, pecas, x0, y0, w, h, zb, alfa, selecionado) {
  const d = defObj(o.type) || { w, h }; const dw = d.w || 1, dh = d.h || 1; const rot = rotVisual(o) * Math.PI / 180; const tex = texturaDoObjeto(o.type);
  const cx = x0 + w / 2, cy = y0 + h / 2, cr = Math.cos(rot), sr = Math.sin(rot);
  const ponto = ([lx, ly, lz]) => { const ux = lx - dw / 2, uy = ly - dh / 2; return [(cx + ux * cr - uy * sr) * C, (cy + ux * sr + uy * cr) * C, zb + lz * C]; };
  const vetor = ([vx, vy, vz]) => [(vx * cr - vy * sr) * C, (vx * sr + vy * cr) * C, vz * C];
  const sa = Math.sin(vista3d.yaw), ca = Math.cos(vista3d.yaw), sp = Math.sin(vista3d.pitch), cp = Math.cos(vista3d.pitch);
  const D = [sa * sp, ca * sp, cp]; const L = [-0.35, -0.55, 0.76]; const nl = Math.hypot(...L);
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2]; const unit = p => { const m = Math.hypot(...p) || 1; return p.map(x => x / m); };
  const pertoDe = P => (P[0] * sa + P[1] * ca) * sp + P[2] * cp;
  const itens = [];
  pecas.forEach(q => {
    if (q.cil) {
      itens.push({ perto: pertoDe(ponto([q.c[0], q.c[1], (q.z[0] + q.z[1]) / 2])), fn: () => {
        const z0 = zb + q.z[0] * C, z1 = zb + q.z[1] * C, H = z1 - z0; const n = Math.max(2, Math.min(60, Math.ceil(H * vista3d.zoom / 2)));
        const local = z => { planoEm(z); ctx.translate(cx * C, cy * C); ctx.rotate(rot); ctx.translate(-dw * C / 2, -dh * C / 2); };
        const disco = k => { ctx.beginPath(); ctx.arc(q.c[0] * C, q.c[1] * C, Math.max(0.5, (q.r[0] + (q.r[1] - q.r[0]) * k) * C), 0, Math.PI * 2); };
        for (let i = 0; i < n; i++) { const k = i / n; local(z0 + H * k); ctx.fillStyle = escurecer(q.cor, 0.5 + 0.38 * k); disco(k); ctx.fill(); }
        local(z1); disco(1); ctx.fillStyle = q.topo && q.topo !== 'textura' ? q.topo : q.cor; ctx.fill();
        if (q.topo === 'textura' && tex) { ctx.save(); disco(1); ctx.clip(); ctx.drawImage(tex, 0, 0, dw * C, dh * C); ctx.restore(); }
        ctx.strokeStyle = 'rgba(20,14,10,.7)'; ctx.lineWidth = 1.2 / vista3d.zoom; disco(1); ctx.stroke(); } });
      return;
    }
    const O = ponto(q.o), U = vetor(q.u), V = vetor(q.v);
    const N = unit(q.n ? vetor(q.n) : [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]]);
    if (q.n && dot(N, D) <= 0.001) return;                                   // a face of a box turned away
    if (!_idArte.has(q.arte)) _idArte.set(q.arte, _proxArte++);
    const lu = Math.hypot(...q.u), lv = Math.hypot(...q.v); const [s0, s1] = q.recorte || [0, 1]; const frac = s1 - s0;
    const im = imagemDoCartao(baseObj(o.type) + ':' + _idArte.get(q.arte), q.arte, lu / frac * CARTAO_PX, lv * CARTAO_PX, tex); if (!im) return;
    const sw = im.img.width * frac, sx = im.img.width * s0, sh = im.img.height;
    const Us = U.map(x => x / sw), Vs = V.map(x => x / sh);
    const centro = [O[0] + U[0] / 2 + V[0] / 2, O[1] + U[1] / 2 + V[1] / 2, O[2] + U[2] / 2 + V[2] / 2];
    const brilho = Math.min(1, q.n ? 0.6 + 0.45 * Math.max(0, dot(N, L) / nl) : 0.7 + 0.35 * Math.abs(dot(N, L)) / nl);
    itens.push({ perto: pertoDe(centro), fn: () => {
      if (!q.n) { const lado = dot(N, D) >= 0 ? -1 : 1; const e = CARTAO_ESPESSURA * C * lado;
        [0.5, 1].forEach(t => { planoLivre([O[0] + N[0] * e * t, O[1] + N[1] * e * t, O[2] + N[2] * e * t], Us, Vs); ctx.drawImage(im.borda, sx, 0, sw, sh, 0, 0, sw, sh); }); }
      planoLivre(O, Us, Vs); ctx.drawImage(im.img, sx, 0, sw, sh, 0, 0, sw, sh);
      if (brilho < 0.99) { const a0 = ctx.globalAlpha; ctx.globalAlpha = a0 * Math.min(0.6, 1 - brilho); ctx.drawImage(im.sombra, sx, 0, sw, sh, 0, 0, sw, sh); ctx.globalAlpha = a0; } } });
  });
  ctx.globalAlpha = alfa;
  itens.sort((a, b) => a.perto - b.perto).forEach(it => it.fn());
  ctx.globalAlpha = 1;
  if (selecionado) { planoEm(zb + 1); marcarSelecao(x0, y0, w, h); }
}
function desenharBloco(v, casas, z0, alfa, x0, y0, w, h) {
  const H = (v.alturaBloco || 0.6) * C, cor = v.cor || '#6a5a48'; const n = Math.max(3, Math.ceil(H / 3));
  ctx.globalAlpha = alfa;
  for (let i = 0; i < n; i++) { planoEm(z0 + H * i / n); ctx.fillStyle = escurecer(cor, 0.55 + 0.25 * i / n); casas.forEach(([x, y]) => ctx.fillRect(x * C + 0.5, y * C + 0.5, C - 1, C - 1)); }
  planoEm(z0 + H); ctx.fillStyle = cor; casas.forEach(([x, y]) => ctx.fillRect(x * C + 0.5, y * C + 0.5, C - 1, C - 1));
  const im = retratoImg('topo:' + v.id + ':' + (v.topo ? v.topo.length : (v.glifo || '') + (v.cor || '') + (v.icone || '').length), v.topo || iconeObj(v.id));
  if (im && im.complete && im.naturalWidth) {
    const lado = Math.max(w, h); ctx.save(); ctx.beginPath(); casas.forEach(([x, y]) => ctx.rect(x * C, y * C, C, C)); ctx.clip();
    ctx.drawImage(im, (x0 + w / 2 - lado / 2) * C, (y0 + h / 2 - lado / 2) * C, lado * C, lado * C); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; casas.forEach(([x, y]) => ctx.strokeRect(x * C + 0.5, y * C + 0.5, C - 1, C - 1));
  ctx.globalAlpha = 1;
}

/* the OBJ model of a workshop object, drawn in the 3D view: its triangles (thinned to a few thousand), flat-shaded, far to near */
const _malhasObj = {};
function malhaDoObj(arquivo) {
  const m = _malhasObj[arquivo]; if (m) return m.tris ? m : null;
  const blob = AUDIOS[arquivo]; if (!blob) return null;
  _malhasObj[arquivo] = {};
  blob.text().then(txt => {
    const vs = [], tris = [];
    for (const linha of txt.split(/\r?\n/)) {
      if (linha.startsWith('v ')) { const p = linha.trim().split(/\s+/); vs.push([+p[1], +p[2], +p[3]]); }
      else if (linha.startsWith('f ')) { const idx = linha.trim().split(/\s+/).slice(1).map(t => { const i = parseInt(t, 10); return i < 0 ? vs.length + i : i - 1; }); for (let k = 1; k + 1 < idx.length; k++) tris.push([idx[0], idx[k], idx[k + 1]]); }
    }
    if (!vs.length || !tris.length) { _malhasObj[arquivo].tris = []; return; }
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const v of vs) for (let k = 0; k < 3; k++) { if (v[k] < mn[k]) mn[k] = v[k]; if (v[k] > mx[k]) mx[k] = v[k]; }
    const alt = Math.max(1e-6, mx[1] - mn[1]), cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
    const passo = Math.max(1, Math.ceil(tris.length / 3000));
    _malhasObj[arquivo].tris = tris.filter((_, i) => i % passo === 0).map(t => t.map(i => { const v = vs[i] || [0, 0, 0]; return [(v[0] - cx) / alt, (v[1] - mn[1]) / alt, (v[2] - cz) / alt]; }));
    desenhar();
  }).catch(e => { console.warn('OBJ ' + arquivo, e); _malhasObj[arquivo].tris = []; });
  return null;
}
function desenharMalhaDoObjeto(v, o, casas, z, alfa) {
  const m = malhaDoObj(v.modelo.arquivo); if (!m || !m.tris.length) return;
  const H = v.alturaModelo || 1, ang = ((o.rot || 0) + (v.giroModelo || 0)) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  const cx = casas.reduce((a, c) => a + c[0], 0) / casas.length + 0.5, cy = casas.reduce((a, c) => a + c[1], 0) / casas.length + 0.5;
  const L = [-0.35, -0.55, 0.76], nl = Math.hypot(...L);
  const base = v.modeloTex ? 0xc8bca8 : 0xb9b4aa; const br = base >> 16, bg = (base >> 8) & 255, bb = base & 255;
  const faces = m.tris.map(t => {
    const P = t.map(([x, y, zz]) => { const bx = cx + (x * ca - zz * sa) * H, by = cy + (x * sa + zz * ca) * H, bz = z + y * H * C; return { b: [bx * C, by * C, bz], p: proj3(bx, by, bz) }; });
    const u = [0, 1, 2].map(k => P[1].b[k] - P[0].b[k]), w = [0, 1, 2].map(k => P[2].b[k] - P[0].b[k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const nn = Math.hypot(...n) || 1;
    const luz = Math.abs((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nn / nl);
    return { perto: (P[0].p.perto + P[1].p.perto + P[2].p.perto) / 3, pts: P.map(q => naTela(q.p)), luz };
  }).sort((a, b) => a.perto - b.perto);
  planoTela(); ctx.globalAlpha = alfa;
  for (const f of faces) { const k = 0.45 + 0.55 * f.luz; ctx.fillStyle = `rgb(${Math.round(br * k)},${Math.round(bg * k)},${Math.round(bb * k)})`; ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]); ctx.lineTo(f.pts[1][0], f.pts[1][1]); ctx.lineTo(f.pts[2][0], f.pts[2][1]); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 0.5; ctx.stroke(); }
  ctx.globalAlpha = 1;
}
