/* Bigorna Rooms: the room generator (and the measures of a room it and its analysis use).
   A room is measured on the board as the players meet it: its floor (tiles of the room, staircases and bridges linking
   levels), what blocks the way or the sight, the underlays, the monsters and the objects; from the square where the
   heroes come in (the hero spaces of the starting room, or the square next to the object that opens it).
   The generator builds rooms tile by tile from an archetype (ARQUETIPOS_SALA below: plain data, meant to be edited),
   makes many candidates, measures each one and shows the best three. */
'use strict';

// ------------------------------------------------------------ what blocks
/* the game's pieces of terrain: what stops a figure (move) and what stops a line of sight (vista) */
const BLOQUEIO_OBJETO = {
  Tree: { move: true, vista: true }, Statue: { move: true, vista: true }, Shelf: { move: true, vista: true }, Wagon: { move: true, vista: true },
  PillarObj: { move: true, vista: true }, PillarPush: { move: true, vista: true }, DragonHead: { move: true, vista: true },
  Barricade: { move: true, vista: false }, StoneTable: { move: true, vista: false }, RoundTable: { move: true, vista: false }, Cauldron: { move: true, vista: false },
  Chest: { move: true, vista: false }, Fire: { move: true, vista: false }, Lectern: { move: true, vista: false }, Well: { move: true, vista: false }, BloodShrine: { move: true, vista: false }, Bell: { move: true, vista: false },
  Gate: { move: true, vista: false }, Door: { move: false, vista: false }
};
const bloqueio = o => BLOQUEIO_OBJETO[baseObj(o.type)] || { move: false, vista: false };

// ------------------------------------------------------------ the floor of a room
/* the squares of room si: {chave: {x, y, nivel, peca, alfombra, escada, bloqueia, vista, objeto}} */
function chaoDaSala(si, p = projeto) {
  const s = p.salas[si]; const m = new Map(); const k = (x, y) => x + ',' + y;
  s.pecas.forEach((q, pi) => {
    if (ehAlfombra(q.tile)) return;
    const mu = murosDaPeca(q);   // (the walls of a walled tile: level 2 over its floor)
    casasDaPeca(q).forEach(([x, y]) => { const lv = nivelNaPeca(q, x, y); const a = m.get(k(x, y)); if (!a || lv > a.nivel) m.set(k(x, y), { x, y, nivel: lv, peca: pi, tile: q.tile, ...(mu && mu.chaves.has(x + ',' + y) ? { muro: true } : {}) }); });
  });
  // an underlay (water, embers…) lies on the table under the tiles, as in the game: where a tile covers it, the tile is the
  // floor; where it shows, it is floor too, of its own kind (before, an underlay counted only under the tiles, so one laid
  // wholly under a tile did nothing)
  s.pecas.forEach((q, pi) => { if (!ehAlfombra(q.tile)) return; casasDaPeca(q).forEach(([x, y]) => { if (!m.has(k(x, y))) m.set(k(x, y), { x, y, nivel: 0, peca: pi, tile: q.tile, alfombra: q.tile }); }); });
  s.objetos.forEach((o, oi) => {
    if (!ehTerreno(o) || o.hidden) return;
    casasDoObjeto(o).forEach(([x, y]) => { const a = m.get(k(x, y)); const lv = o.level || 0;
      if (ehTipo(o, 'Staircase')) m.set(k(x, y), { ...(a || {}), x, y, nivel: lv, escada: true, tile: a?.tile });
      // (a bridge is the floor where it lies: over a gap, over the underlay, or on the tiles its ends rest on; nothing is put on it)
      else if (!a || a.nivel < lv || a.alfombra) m.set(k(x, y), { x, y, nivel: lv, ponte: true }); else a.ponte = true; });
  });
  s.objetos.forEach((o, oi) => {
    if (ehTerreno(o) || o.hidden || sinoNoArco(o, s)) return; const b = bloqueio(o);   // (a bell over an archway hangs above the way)
    // (an archway or a bell frame: its two feet stop a figure; the way is through its middle)
    const pes = ehArco(o) ? new Set(meioDoArco(o).pes.map(([x, y]) => k(x, y))) : null;
    casasDoObjeto(o).forEach(([x, y]) => { const a = m.get(k(x, y)); if (!a) return; if (b.move || (pes && pes.has(k(x, y)))) a.bloqueia = true; if (b.vista) a.vista = true; a.objeto = oi;
      // a ladder (Act II): from its square up to the square its arrow points at, one level (short) or two (medium)
      if (ehTipo(o, 'Ladder') || ehTipo(o, 'LadderMedium')) { const [ux, uy] = SOBE[((o.rot || 0) % 360 + 360) % 360 / 90]; a.degrau = { x: x + ux, y: y + uy, dn: ehTipo(o, 'LadderMedium') ? 2 : 1 }; } });
  });
  return m;
}
/* a ladder links its square with the one above it */
const pelaEscadaDeMao = (a, b) => (a.degrau && a.degrau.x === b.x && a.degrau.y === b.y && b.nivel === a.nivel + a.degrau.dn) || (b.degrau && b.degrau.x === a.x && b.degrau.y === a.y && a.nivel === b.nivel + b.degrau.dn);
/* two squares of the floor are next to each other for a figure: same level, or a staircase between the level and the one above */
const passa = (a, b) => a.nivel === b.nivel || ((a.escada || b.escada) && Math.abs(a.nivel - b.nivel) <= 1);
function vizinhosAndaveis(ch, c, diag = true) {
  const r = []; for (const [dx, dy] of (diag ? VIZ8 : VIZ4)) { const n = ch.get((c.x + dx) + ',' + (c.y + dy)); if (!n || n.bloqueia || !(passa(c, n) || (!(dx && dy) && pelaEscadaDeMao(c, n)))) continue;
    if (dx && dy) { const a = ch.get((c.x + dx) + ',' + c.y), b = ch.get(c.x + ',' + (c.y + dy)); if (!a || !b || a.bloqueia || b.bloqueia) continue; } r.push(n); }
  return r;
}
function distancias(ch, origens) {
  const d = new Map(); const fila = [];
  origens.forEach(o => { const c = ch.get(o[0] + ',' + o[1]); if (c && !c.bloqueia) { d.set(o[0] + ',' + o[1], 0); fila.push(c); } });
  for (let i = 0; i < fila.length; i++) { const c = fila[i]; const dc = d.get(c.x + ',' + c.y); vizinhosAndaveis(ch, c).forEach(n => { const kk = n.x + ',' + n.y; if (!d.has(kk)) { d.set(kk, dc + 1); fila.push(n); } }); }
  return d;
}
/* a straight line of sight between two squares: every square it crosses is floor that does not block the sight */
function temVisao(ch, a, b) {
  const [x0, y0] = [a.x + .5, a.y + .5], [x1, y1] = [b.x + .5, b.y + .5]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
  for (let i = 1; i < n; i++) { const t = i / n; const x = Math.floor(x0 + (x1 - x0) * t), y = Math.floor(y0 + (y1 - y0) * t); if ((x === a.x && y === a.y) || (x === b.x && y === b.y)) continue; const c = ch.get(x + ',' + y); if (!c || c.vista || Math.abs(c.nivel - a.nivel) > 1) return false; }
  return true;
}
/* the square where the heroes come into room si: hero spaces (starting room), else the square next to its opener */
function entradaDaSala(si, p = projeto) {
  const s = p.salas[si];
  if (si === 0 && (s.herois || []).length) return s.herois.map(h => [h[0], h[1]]);
  const ch = chaoDaSala(si, p); const ab = [];
  p.salas.forEach((ss, ri) => ss.objetos.forEach(o => { if (todosGatilhos(o).some(g => g.tipo === 'open_room' && g.sala === si)) ab.push(o); }));
  if (!ab.length) return [];
  const cs = casasDoObjeto(ab[0]); let melhor = null, d = Infinity;
  ch.forEach(c => { if (c.bloqueia || c.muro) return; cs.forEach(([x, y]) => { const dd = Math.abs(c.x - x) + Math.abs(c.y - y); if (dd < d) { d = dd; melhor = c; } }); });
  return melhor ? [[melhor.x, melhor.y]] : [];
}
/* can the heroes reach everything in room si from its entry? Every free square, and a square on or next to every object
   they may use (a door, a lever, a chest…). Returns what is out of reach (empty when all is fine) */
function foraDeAlcance(si, p = projeto, entrada = null) {
  // (a climb hidden until something in the room reveals it, as the lever of the attic: within reach, it counts)
  const s0 = p.salas[si]; const revela = new Set(); s0.objetos.forEach(o => todosGatilhos(o).forEach(g => { if (g.tipo === 'add_object' && (g.objSala ?? si) === si && s0.objetos[g.objIndex]?.hidden && /^(Ladder|LadderMedium|Staircase)$/.test(baseObj(s0.objetos[g.objIndex].type))) revela.add(g.objIndex); }));
  if (revela.size) p = { ...p, salas: p.salas.map((x, i) => i === si ? { ...x, objetos: x.objetos.map((o, oi) => revela.has(oi) ? { ...o, hidden: false } : o) } : x) };
  const ch = chaoDaSala(si, p); const ent = entrada || entradaDaSala(si, p); if (!ent.length) return [];
  const d = distancias(ch, ent); const r = [];
  if ([...ch.values()].some(c => !c.bloqueia && !c.muro && !d.has(c.x + ',' + c.y))) r.push('squares');
  p.salas[si].objetos.forEach(o => { if (ehTerreno(o) || o.hidden || sinoNoArco(o, p.salas[si])) return; const cs = casasDoObjeto(o);   // (a bell over an archway is out of reach on purpose)
    if (!cs.some(([x, y]) => d.has(x + ',' + y) || VIZ8.some(([dx, dy]) => d.has((x + dx) + ',' + (y + dy))))) r.push(o); });
  return r;
}
/* the objects of room si that open other rooms (its exits) */
const saidasDaSala = (si, p = projeto) => p.salas[si].objetos.map((o, oi) => ({ o, oi })).filter(({ o }) => todosGatilhos(o).some(g => g.tipo === 'open_room'));

// ------------------------------------------------------------ the measures (C)
function medirSala(si, p = projeto, entradaFixa = null) {
  const s = p.salas[si]; const ch = chaoDaSala(si, p); const cells = [...ch.values()];
  const area = cells.length; if (!area) return null;
  const xs = cells.map(c => c.x), ys = cells.map(c => c.y);
  const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
  const niveis = [...new Set(cells.map(c => c.nivel))];
  const bloq = cells.filter(c => c.bloqueia).length;
  const alf = cells.filter(c => c.alfombra);
  const pisos = new Set(cells.map(c => c.tile && PECA[c.tile]?.floor).filter(Boolean));
  const entrada = entradaFixa || entradaDaSala(si, p);
  const dist = distancias(ch, entrada);
  const livres = cells.filter(c => !c.bloqueia);
  const alcancaveis = livres.filter(c => dist.has(c.x + ',' + c.y)).length;
  // the monsters of the room: placed in it, and brought onto its floor by the spawn triggers of the map
  const inis = [...(s.inimigos || [])];
  p.salas.forEach(ss => ss.objetos.concat(ss.inimigos || []).forEach(o => todosGatilhos(o).forEach(g => { if (g.tipo !== 'spawn') return;
    (g.fonte === 'pool' ? (g.cells || []).map(c => ({ enemy: POOL_ID, pos: [c[0], c[1]] })) : (g.inimigos || [])).forEach(e => { if (ch.has(e.pos[0] + ',' + e.pos[1])) inis.push(e); }); })));
  const dInimigos = inis.map(e => dist.get(e.pos[0] + ',' + e.pos[1])).filter(v => v !== undefined);
  const objs = s.objetos.filter(o => !ehTerreno(o));
  const tokens = objs.filter(o => ehTipo(o, 'SightToken') || ehTipo(o, 'InteractToken')).length;
  const baus = objs.filter(o => ehTipo(o, 'Chest')).length;
  // sight from the entry
  const e0 = entrada.length ? ch.get(entrada[0][0] + ',' + entrada[0][1]) : null;
  const visiveis = e0 ? livres.filter(c => temVisao(ch, e0, c)).length : 0;
  // cover: free squares next to something that blocks
  const cobertos = livres.filter(c => VIZ8.some(([dx, dy]) => ch.get((c.x + dx) + ',' + (c.y + dy))?.bloqueia)).length;
  // chokepoints: squares whose loss cuts the free floor in two (articulation points)
  const gargalos = articulacoes(ch, livres);
  // routes: separate ways from the entry to the far end (the exit, or the farthest square)
  const saidas = saidasDaSala(si, p);
  let alvo = null;
  if (saidas.length) { const cs = casasDoObjeto(saidas[0].o); let bd = Infinity; livres.forEach(c => cs.forEach(([x, y]) => { const dd = Math.abs(c.x - x) + Math.abs(c.y - y); if (dd < bd) { bd = dd; alvo = c; } })); }
  else { let md = -1; dist.forEach((v, k) => { if (v > md) { md = v; alvo = ch.get(k); } }); }
  const rotas = e0 && alvo ? caminhosSeparados(ch, e0, alvo, 3) : 0;
  const forma = formaDe(ch, w, h);
  const exitsVistas = e0 ? saidas.filter(({ o }) => casasDoObjeto(o).some(([x, y]) => { const c = ch.get(x + ',' + y) || { x, y }; return temVisao(ch, e0, c); })).length : 0;
  const maxDist = Math.max(0, ...dist.values());
  return {
    area, pecas: s.pecas.filter(q => !ehAlfombra(q.tile)).length, w, h, alongamento: +(Math.max(w, h) / Math.min(w, h)).toFixed(2), compacidade: +(area / (w * h)).toFixed(2), forma,
    niveis: niveis.length, elevadas: +(cells.filter(c => c.nivel > 0).length / area).toFixed(2), bloqueio: +(bloq / area).toFixed(2), alfombra: +(alf.length / area).toFixed(2),
    variedade: pisos.size + new Set(alf.map(c => c.alfombra)).size, objetos: objs.length, tokens, baus, inimigos: inis.length, pool: inis.filter(e => ehPool(e.enemy)).length,
    distInimigo: dInimigos.length ? Math.min(...dInimigos) : null, profundidade: maxDist, alcance: +(alcancaveis / Math.max(1, livres.length)).toFixed(2),
    visao: +(visiveis / Math.max(1, livres.length)).toFixed(2), cobertura: +(cobertos / Math.max(1, livres.length)).toFixed(2), gargalos: gargalos.length, rotas,
    saidas: saidas.length, saidasVistas: saidas.length ? +(exitsVistas / saidas.length).toFixed(2) : null, densidade: +((objs.length + inis.length) / area * 10).toFixed(2),
    intensidade: inis.length ? intensidadeDaSala(s) : 0, gatilhoSpawn: inis.length - (s.inimigos || []).length
  };
}
function articulacoes(ch, livres) {
  const idx = new Map(livres.map((c, i) => [c.x + ',' + c.y, i])); const n = livres.length; if (n < 3) return [];
  const viz = livres.map(c => vizinhosAndaveis(ch, c, false).map(v => idx.get(v.x + ',' + v.y)).filter(v => v !== undefined));
  const disc = new Array(n).fill(-1), low = new Array(n).fill(0), pai = new Array(n).fill(-1), ap = new Set(); let t = 0;
  for (let r = 0; r < n; r++) { if (disc[r] >= 0) continue;
    const pilha = [[r, 0]]; disc[r] = low[r] = t++; let filhosRaiz = 0;
    while (pilha.length) { const top = pilha[pilha.length - 1]; const [u, i] = top;
      if (i < viz[u].length) { top[1]++; const v = viz[u][i];
        if (disc[v] < 0) { pai[v] = u; disc[v] = low[v] = t++; pilha.push([v, 0]); if (u === r) filhosRaiz++; }
        else if (v !== pai[u]) low[u] = Math.min(low[u], disc[v]); }
      else { pilha.pop(); if (pilha.length) { const pu = pilha[pilha.length - 1][0]; low[pu] = Math.min(low[pu], low[u]); if (pu !== r && low[u] >= disc[pu]) ap.add(pu); } } }
    if (filhosRaiz > 1) ap.add(r); }
  return [...ap].map(i => livres[i]);
}
/* how many ways from a to b share no square (up to max): unit vertex capacities, augmenting paths */
function caminhosSeparados(ch, a, b, max) {
  const ka = a.x + ',' + a.y, kb = b.x + ',' + b.y; if (ka === kb) return 1;
  const usados = new Set(); const arestas = new Set(); let n = 0;
  for (; n < max; n++) {
    const ant = new Map([[ka, null]]); const fila = [ka]; let achou = false;
    while (fila.length && !achou) { const k = fila.shift(); const c = ch.get(k);
      for (const v of vizinhosAndaveis(ch, c, false)) { const kv = v.x + ',' + v.y; if (ant.has(kv) || (usados.has(kv) && kv !== kb) || arestas.has(k + '>' + kv)) continue; ant.set(kv, k); if (kv === kb) { achou = true; break; } fila.push(kv); } }
    if (!achou) break;
    for (let k = kb; ant.get(k) !== null; k = ant.get(k)) { const pk = ant.get(k); arestas.add(pk + '>' + k); arestas.add(k + '>' + pk); if (k !== kb) usados.add(k); }
  }
  return n;
}
/* the outline: islands (floor in pieces), compact, long, L, cross or irregular */
function formaDe(ch, w, h) {
  const cells = [...ch.values()]; const vistos = new Set(); let partes = 0;
  cells.forEach(c => { const k0 = c.x + ',' + c.y; if (vistos.has(k0)) return; partes++; const fila = [c]; vistos.add(k0);
    while (fila.length) { const u = fila.pop(); VIZ4.forEach(([dx, dy]) => { const kk = (u.x + dx) + ',' + (u.y + dy); if (ch.has(kk) && !vistos.has(kk)) { vistos.add(kk); fila.push(ch.get(kk)); } }); } });
  if (partes > 1) return 'ilhas';
  const comp = cells.length / (w * h), along = Math.max(w, h) / Math.min(w, h);
  if (comp >= 0.78) return along >= 2 ? 'alongada' : 'compacta';
  // the empty part of the frame: where does it lie? (four corners: cross; one or two on the same side: L)
  const x0 = Math.min(...cells.map(c => c.x)), y0 = Math.min(...cells.map(c => c.y));
  const cantos = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy]) => { let v = 0, tot = 0; for (let x = 0; x < Math.ceil(w / 3); x++) for (let y = 0; y < Math.ceil(h / 3); y++) { const px = cx ? x0 + w - 1 - x : x0 + x, py = cy ? y0 + h - 1 - y : y0 + y; tot++; if (!ch.has(px + ',' + py)) v++; } return v / tot > 0.6; });
  const n = cantos.filter(Boolean).length;
  if (n === 4) return 'cruz';
  if (n === 1 || (n === 2 && ((cantos[0] && cantos[1]) || (cantos[2] && cantos[3]) || (cantos[0] && cantos[2]) || (cantos[1] && cantos[3])))) return along >= 2.2 ? 'alongada' : 'L';
  return 'irregular';
}

// ------------------------------------------------------------ the archetypes (F): plain data, meant to be edited
/* Each archetype says what a room of its kind is made of and what its measures should look like (ranges from the
   rooms of the original maps, see GERADOR.md). Fields:
     id, nome, resumo            identifier, name and one line for the window
     funcoes                     story moments it fits (the "função" of the room: gancho, exploracao, tensao, confronto,
                                 respiro, recompensa, climax, fuga)
     area [min,max]              squares of floor; pecas [min,max] tiles
     formas {forma: peso}        outline wanted: compacta, alongada, L, cruz, irregular
     niveis 0..1                 chance of an elevated tile (with pillars and a staircase)
     alfombra 0..1               chance of an underlay (water, embers…)
     inimigos {espacos, distancia, padrao, como}
                                 balanced spaces [min,max]; squares from the entry [min,max]; where: fundo (far side),
                                 flancos (both sides), centro, espalhado; como: sala (enter when the room opens),
                                 armadilha (a token in the room brings them), nenhum
     objetos {base, extras, total}
                                 base: objects every room of the kind has {tipo: n}; extras: {tipo: [min,max]} drawn
                                 by theme (a type the theme lacks is skipped); total [min,max] before the "objects" option
     metas {medida: [min,max]}   target ranges of the measures (visao, cobertura, gargalos, rotas, densidade, bloqueio,
                                 distInimigo, profundidade, alongamento); pesos {medida: n} their weight in the score
     tesouro                     bau (the chests give items), token (a point of interest does), null
     textos {en:[…], pt:[…]}     provisional entry texts; {tema} becomes the place */
const ARQUETIPOS_SALA = [
  { id: 'emboscada', nome: 'Ambush', resumo: 'A quiet room that is not empty: the monsters come from the sides once the heroes are in.', funcoes: ['tensao', 'confronto'],
    area: [24, 44], pecas: [1, 2], formas: { compacta: 2, L: 2, irregular: 1 }, niveis: 0.15, alfombra: 0.2,
    inimigos: { espacos: [4, 5], distancia: [2, 4], padrao: 'flancos', como: 'armadilha' },
    objetos: { base: { InteractToken: 1 }, extras: { Barricade: [0, 2], Tree: [0, 2], StoneTable: [0, 1], Shelf: [0, 1], Cauldron: [0, 1] }, total: [2, 5] },
    metas: { visao: [0.5, 0.9], cobertura: [0.2, 0.45], gargalos: [0, 2], rotas: [1, 2], densidade: [1.5, 3.2], bloqueio: [0.04, 0.15], distInimigo: [2, 4] }, pesos: { cobertura: 2, distInimigo: 2 },
    textos: { en: ['The air in here is too still. Something waits among {tema}.', 'Silence, and the smell of fresh blood.'], pt: ['O ar aqui está parado demais. Algo espera entre {tema}.', 'Silêncio, e o cheiro de sangue fresco.'] } },
  { id: 'corredor', nome: 'Corridor / chokepoint', resumo: 'A long, narrow way: whoever holds the narrow part holds the room.', funcoes: ['tensao', 'fuga', 'exploracao'],
    area: [16, 34], pecas: [1, 3], formas: { alongada: 4, L: 2 }, niveis: 0.1, alfombra: 0.25,
    inimigos: { espacos: [2, 4], distancia: [4, 8], padrao: 'fundo', como: 'sala' },
    objetos: { base: {}, extras: { Barricade: [0, 1], InteractToken: [0, 1], Tree: [0, 1] }, total: [1, 3] },
    metas: { alongamento: [2, 4], gargalos: [2, 7], rotas: [1, 1], visao: [0.4, 0.9], cobertura: [0.05, 0.3], densidade: [0.6, 2], distInimigo: [4, 8] }, pesos: { alongamento: 2, gargalos: 2 },
    textos: { en: ['A narrow passage runs ahead, too narrow for two abreast.', '{Tema} narrow into a gullet.'], pt: ['Uma passagem estreita segue adiante, estreita demais para dois lado a lado.', '{Tema} se estreitam num gargalo.'] } },
  { id: 'arena', nome: 'Arena', resumo: 'Wide and open: a straight fight with room to move.', funcoes: ['confronto', 'climax'],
    area: [36, 64], pecas: [2, 3], formas: { compacta: 3, irregular: 1, cruz: 1 }, niveis: 0.2, alfombra: 0.15,
    inimigos: { espacos: [4, 6], distancia: [4, 7], padrao: 'espalhado', como: 'sala' },
    objetos: { base: {}, extras: { Barricade: [0, 2], Tree: [0, 2], RoundTable: [0, 1], StoneTable: [0, 1], Fire: [0, 1] }, total: [1, 4] },
    metas: { visao: [0.75, 1], cobertura: [0.1, 0.3], gargalos: [0, 1], rotas: [2, 3], densidade: [1, 2.2], bloqueio: [0.02, 0.1], distInimigo: [4, 7] }, pesos: { visao: 2, rotas: 2 },
    textos: { en: ['A wide open ground. There is nowhere to hide, for anyone.', '{Tema} open into a broad space, scarred by old fights.'], pt: ['Um campo largo e aberto. Não há onde se esconder, para ninguém.', '{Tema} se abrem num espaço amplo, marcado por lutas antigas.'] } },
  { id: 'exploracao', nome: 'Exploration room', resumo: 'Few or no monsters, several points of interest to search and a clue.', funcoes: ['exploracao', 'gancho'],
    area: [24, 44], pecas: [1, 2], formas: { L: 2, irregular: 2, compacta: 1 }, niveis: 0.25, alfombra: 0.25,
    inimigos: { espacos: [1, 3], distancia: [4, 7], padrao: 'fundo', como: 'sala' },
    objetos: { base: { InteractToken: 2 }, extras: { Shelf: [0, 1], Lectern: [0, 1], Chest: [0, 1], Well: [0, 1], Tree: [0, 2], Cauldron: [0, 1], Wagon: [0, 1] }, total: [3, 6] },
    metas: { visao: [0.4, 0.8], cobertura: [0.1, 0.35], rotas: [1, 2], densidade: [1.2, 3], profundidade: [4, 8] }, pesos: { densidade: 1.5 },
    textos: { en: ['Traces of those who came before are everywhere. Search carefully.', '{Tema} hide more than they show.'], pt: ['Há rastros dos que vieram antes por toda parte. Procurem com cuidado.', '{Tema} escondem mais do que mostram.'] } },
  { id: 'tesouro', nome: 'Treasure room', resumo: 'The reward, guarded or not: chests at the back, a price to reach them.', funcoes: ['recompensa'],
    area: [18, 36], pecas: [1, 2], formas: { compacta: 3, L: 1 }, niveis: 0.2, alfombra: 0.1,
    inimigos: { espacos: [1, 3], distancia: [3, 6], padrao: 'fundo', como: 'sala' },
    objetos: { base: { Chest: 2 }, extras: { Chest: [0, 1], Shelf: [0, 1], Lectern: [0, 1], StoneTable: [0, 1], Statue: [0, 1] }, total: [2, 5] },
    metas: { visao: [0.5, 1], cobertura: [0, 0.3], gargalos: [0, 2], densidade: [1.4, 4], profundidade: [3, 7] }, pesos: {}, tesouro: 'bau',
    textos: { en: ['Gold glints in the dark. Too easy?', 'Chests, dusty and forgotten, line the far wall.'], pt: ['Ouro reluz no escuro. Fácil demais?', 'Baús, empoeirados e esquecidos, alinham-se junto à parede do fundo.'] } },
  { id: 'respiro', nome: 'Respite', resumo: 'A calm place to breathe, heal and talk: no monsters, a little to find.', funcoes: ['respiro'],
    area: [12, 28], pecas: [1, 1], formas: { compacta: 3, L: 1 }, niveis: 0.1, alfombra: 0.1,
    inimigos: { espacos: [0, 0], distancia: [0, 0], padrao: 'fundo', como: 'nenhum' },
    objetos: { base: { InteractToken: 1 }, extras: { Well: [0, 1], Fire: [0, 1], RoundTable: [0, 1], Chest: [0, 1] }, total: [1, 3] },
    metas: { visao: [0.7, 1], cobertura: [0, 0.2], densidade: [0.3, 1.6], bloqueio: [0, 0.08] }, pesos: {},
    textos: { en: ['For a moment, all is quiet. Catch your breath.', 'A sheltered corner, untouched by the fighting.'], pt: ['Por um momento, tudo está quieto. Recuperem o fôlego.', 'Um canto abrigado, intocado pela luta.'] } },
  { id: 'abertura', nome: 'Opening room', resumo: 'Where the map begins: quiet, with little in it, and someone or something that starts telling the story.', funcoes: ['gancho'],
    area: [14, 30], pecas: [1, 2], formas: { compacta: 2, L: 2, irregular: 1 }, niveis: 0.1, alfombra: 0.15,
    inimigos: { espacos: [0, 0], distancia: [0, 0], padrao: 'fundo', como: 'nenhum' },
    objetos: { base: {}, extras: { Tree: [0, 1], Fire: [0, 1], Wagon: [0, 1], Well: [0, 1], StoneTable: [0, 1], Statue: [0, 1] }, total: [0, 1] },
    metas: { visao: [0.6, 1], cobertura: [0, 0.25], densidade: [0.2, 1.4], bloqueio: [0, 0.1] }, pesos: {},
    textos: { en: ['For now, nothing moves.', 'The way in is quiet. Too quiet, perhaps.'], pt: ['Por enquanto, nada se mexe.', 'A entrada está quieta. Quieta demais, talvez.'] } },
  { id: 'chefe', nome: 'Boss arena', resumo: 'The last room: large, with cover and a strong foe at the back.', funcoes: ['climax'],
    area: [38, 60], pecas: [2, 3], formas: { compacta: 2, L: 2, cruz: 1 }, niveis: 0.35, alfombra: 0.2,
    inimigos: { espacos: [4, 5], distancia: [5, 9], padrao: 'fundo', como: 'sala', chefe: true },
    objetos: { base: {}, extras: { Barricade: [0, 2], StoneTable: [0, 1], Statue: [0, 1], Fire: [0, 2], Chest: [0, 1], Archway: [0, 1] }, total: [3, 6] },
    metas: { visao: [0.4, 0.85], cobertura: [0.2, 0.5], gargalos: [0, 2], rotas: [1, 2], densidade: [1.2, 3.2], distInimigo: [5, 9], profundidade: [6, 10] }, pesos: { distInimigo: 2, cobertura: 1.5 },
    textos: { en: ['At the far end, something vast stirs. This is where it ends.', '{Tema} fall silent. It is waiting for you.'], pt: ['No extremo, algo enorme se mexe. É aqui que tudo termina.', '{Tema} se calam. Ele está esperando por vocês.'] } },
  { id: 'obstaculo', nome: 'Passage with an obstacle', resumo: 'The way is blocked by water, fire or rubble: go around, or through it.', funcoes: ['exploracao', 'tensao', 'fuga'],
    area: [22, 40], pecas: [1, 2], formas: { irregular: 2, L: 1, compacta: 1 }, niveis: 0.1, alfombra: 0.85,
    inimigos: { espacos: [1, 3], distancia: [4, 7], padrao: 'fundo', como: 'sala' },
    objetos: { base: { Barricade: 1 }, extras: { Tree: [0, 2], Barricade: [0, 1], InteractToken: [0, 1], Well: [0, 1] }, total: [2, 5] },
    metas: { bloqueio: [0.08, 0.25], cobertura: [0.2, 0.5], rotas: [1, 2], gargalos: [1, 4], visao: [0.4, 0.9] }, pesos: { bloqueio: 2 },
    textos: { en: ['The way ahead is cut. There must be another way through.', 'Rubble bars the path.'], pt: ['O caminho à frente está cortado. Deve haver outra passagem.', 'Escombros barram o caminho.'] } },
  { id: 'niveis', nome: 'Room on levels', resumo: 'A raised platform over the floor: whoever holds the height sees everything.', funcoes: ['confronto', 'exploracao'],
    area: [28, 50], pecas: [2, 3], formas: { L: 2, compacta: 1, irregular: 1 }, niveis: 1, alfombra: 0.15,
    inimigos: { espacos: [3, 4], distancia: [3, 7], padrao: 'espalhado', como: 'sala' },
    objetos: { base: {}, extras: { Chest: [0, 1], Barricade: [0, 1], Shelf: [0, 1], StoneTable: [0, 1], Tree: [0, 1] }, total: [2, 4] },
    metas: { visao: [0.4, 0.85], cobertura: [0.1, 0.35], rotas: [1, 2], densidade: [0.8, 2.3] }, pesos: {},
    textos: { en: ['Steps climb to a raised floor that overlooks the whole place.', '{Tema} rise in tiers; the high ground is taken.'], pt: ['Degraus sobem a um piso elevado que domina todo o lugar.', '{Tema} sobem em patamares; o alto já tem dono.'] } }
];
const ARQUETIPO_SALA = id => ARQUETIPOS_SALA.concat(arquetiposProprios()).find(a => a.id === id) || null;
/* the archetypes the user wrote (Settings of the generator), kept in the browser */
function arquetiposProprios() { try { const a = JSON.parse(localStorage.getItem('bigorna-arquetipos') || '[]'); return Array.isArray(a) ? a.filter(x => x && x.id && x.area) : []; } catch { return []; } }
const todosArquetipos = () => { const proprios = arquetiposProprios(); return ARQUETIPOS_SALA.filter(a => !proprios.some(p => p.id === a.id)).concat(proprios); };
const FUNCOES_SALA = [['', 'Not set'], ['gancho', 'Hook (why we are here)'], ['exploracao', 'Exploration'], ['tensao', 'Rising tension'], ['confronto', 'Confrontation'], ['respiro', 'Respite'], ['recompensa', 'Reward'], ['climax', 'Climax'], ['fuga', 'Escape']];
/* themes: the floors they use and the objects that belong there */
const TEMAS_SALA = {
  qualquer: { nome: 'Any', pisos: null, objetos: null, lugar: { en: 'the depths', pt: 'as profundezas' }, abridores: { Door: 3, Gate: 1, SightToken: 2, Archway: 1 }, decor: ['Statue', 'Fire', 'Bell', 'BloodShrine', 'Wagon', 'Well', 'Tree', 'Cauldron', 'DragonHead'] },
  masmorra: { nome: 'Dungeon', pisos: ['flagstone', 'wood'], objetos: ['Chest', 'Shelf', 'Lectern', 'Cauldron', 'StoneTable', 'RoundTable', 'Barricade', 'Statue', 'Archway', 'Fire', 'BloodShrine', 'Bell', 'InteractToken', 'Well'], lugar: { en: 'the halls', pt: 'os salões' }, abridores: { Door: 3, Gate: 2, SightToken: 1, Archway: 1 }, decor: ['Statue', 'Fire', 'Cauldron', 'Shelf'] },
  cripta: { nome: 'Crypt', pisos: ['flagstone'], objetos: ['Chest', 'Lectern', 'Statue', 'Archway', 'BloodShrine', 'Bell', 'Fire', 'Cauldron', 'StoneTable', 'InteractToken', 'Barricade', 'DragonHead'], lugar: { en: 'the tombs', pt: 'os túmulos' }, abridores: { Gate: 3, Archway: 2, Door: 1, SightToken: 1 }, decor: ['Statue', 'BloodShrine', 'Bell', 'Fire', 'DragonHead'] },
  fortaleza: { nome: 'Keep', pisos: ['flagstone', 'wood'], objetos: ['Chest', 'Shelf', 'StoneTable', 'RoundTable', 'Barricade', 'Bell', 'Statue', 'Fire', 'Wagon', 'Lectern', 'InteractToken', 'Archway'], lugar: { en: 'the keep', pt: 'a fortaleza' }, abridores: { Door: 3, Gate: 2, Archway: 1, SightToken: 1 }, decor: ['Barricade', 'Bell', 'Wagon', 'Fire', 'RoundTable'] },
  aldeia: { nome: 'Village', pisos: ['grass', 'dirt', 'wood'], objetos: ['Wagon', 'Well', 'Tree', 'RoundTable', 'Barricade', 'Fire', 'Chest', 'Bell', 'InteractToken', 'Cauldron', 'Statue'], lugar: { en: 'the village', pt: 'a aldeia' }, abridores: { SightToken: 3, Gate: 2, Archway: 1, Door: 1 }, decor: ['Wagon', 'Well', 'Tree', 'Fire', 'Bell'] },
  caverna: { nome: 'Cave', pisos: ['dirt', 'flagstone'], objetos: ['Chest', 'Barricade', 'Cauldron', 'Fire', 'Well', 'InteractToken', 'Statue', 'BloodShrine', 'DragonHead'], lugar: { en: 'the caves', pt: 'as cavernas' }, abridores: { SightToken: 3, Archway: 1, Gate: 1 }, decor: ['Fire', 'Cauldron', 'DragonHead', 'BloodShrine'] },
  ermo: { nome: 'Wilderness', pisos: ['dirt', 'grass'], objetos: ['Tree', 'Barricade', 'Well', 'Wagon', 'Fire', 'Chest', 'InteractToken', 'RoundTable', 'Statue'], lugar: { en: 'the wilds', pt: 'as terras selvagens' }, abridores: { SightToken: 3, Gate: 1, Archway: 1 }, decor: ['Tree', 'Wagon', 'Well', 'Fire', 'Statue'] }
};

const novaSemente = () => Math.random().toString(36).slice(2, 8);

/* an object kind of the chosen boxes */
const daCaixa = (tipo, atos) => (OBJETO[baseObj(tipo)]?.act || 1) <= atos;
/* a monster or item of the catalogue of the chosen boxes (the catalogue counts Act I as 0) */
const doAto = (c, atos) => (c?._act || 0) < atos;
// ------------------------------------------------------------ the Workshop: the only source of the generators
/* The generators use only what the Workshop holds (monsters, items, materials, objects of the Workshop), within the
   chosen boxes. When it holds too little to draw with variety, the window says so and offers a starter selection from
   the game, which the user then trims in the Workshop. */
const MINIMO_OFICINA = { monstros: 6, tipos: 3, cartas: 10, materiais: 4 };
const CLS_CARTAS = ['ArmorModel', 'TrinketModel', 'ConsumableModel'];
const actDoItem = i => { const c = i && i.base && (CATALOGO.itens || []).find(x => x._id === i.base); return c ? (c._act || 0) : 0; };
/* what the Workshop offers the generators within the boxes: monsters to draw (with tiers, neither villain nor named),
   bosses (named or villains), item cards, materials and the Workshop's own objects */
function daOficina(atos = 2) {
  const b = bestiario(); const ms = (b.monstros || []).filter(m => (m.tiers || []).length && (m.act || 0) < atos);
  const itens = (b.itens || []).filter(i => actDoItem(i) < atos);
  return { monstros: ms.filter(m => !m.villain && !m.named), chefes: ms.filter(m => m.villain || m.named),
    cartas: itens.filter(i => i.cls !== 'CraftingMaterialModel' && (i.custom || !i.base || CLS_CARTAS.includes(i.cls))),
    materiais: itens.filter(i => i.cls === 'CraftingMaterialModel'), objetos: (b.objetos || []).filter(v => v && v.id) };
}
/* the pools of map p that already have what the generated rooms draw from */
const reservaComMonstros = p => (p.reserva || []).some(id => monstro(id));
const reservaDeItensCompleta = p => { const l = (p.itensPool || []).map(id => ITENS_B().find(i => i.id === id)).filter(Boolean); return l.some(i => i.cls === 'CraftingMaterialModel') && l.some(i => i.cls !== 'CraftingMaterialModel'); };
/* what is missing for a generation that needs monsters and/or items: [{chave, rotulo, tem, min}] */
function faltasDaOficina(atos, precisa) {
  const of = daOficina(atos); const r = [];
  if (precisa.monstros) { const tipos = new Set(of.monstros.map(m => m.tipo)).size;
    if (of.monstros.length < MINIMO_OFICINA.monstros) r.push({ chave: 'monstros', rotulo: 'Monsters to draw', tem: of.monstros.length, min: MINIMO_OFICINA.monstros });
    if (tipos < MINIMO_OFICINA.tipos) r.push({ chave: 'monstros', rotulo: 'Monster types', tem: tipos, min: MINIMO_OFICINA.tipos }); }
  if (precisa.itens) {
    if (of.cartas.length < MINIMO_OFICINA.cartas) r.push({ chave: 'itens', rotulo: 'Item cards', tem: of.cartas.length, min: MINIMO_OFICINA.cartas });
    if (of.materiais.length < MINIMO_OFICINA.materiais) r.push({ chave: 'itens', rotulo: 'Crafting materials', tem: of.materiais.length, min: MINIMO_OFICINA.materiais }); }
  return r;
}
/* a starter selection into the Workshop, from the game and within the boxes: the monsters the game itself draws at random
   (no quest-specific ones; the named among them are the bosses), the item cards (no upgrades, no digital ones) and the
   crafting materials. What the Workshop already has is kept. Returns {monstros, itens} added */
function selecaoInicial(atos, cats) {
  const b = bestiario(); const n = { monstros: 0, itens: 0 }; const nomeOk = c => c && c.name_en && !/^[A-Z0-9_' ]+$/.test(c.name_en);
  if (cats.monstros) (CATALOGO.monstros || []).filter(c => nomeOk(c) && c.IsRandomEligible && !c.IsVillain && (c.Tiers || []).length && doAto(c, atos))
    .forEach(c => { if (!b.monstros.some(m => m.base === c._id)) { b.monstros.push(monstroDoCatalogo(c)); n.monstros++; } });
  if (cats.itens) (CATALOGO.itens || []).filter(c => nomeOk(c) && doAto(c, atos) && ((CLS_CARTAS.includes(c._cls) && !c.IsUpgrade && !c.IsDigital) || c._cls === 'CraftingMaterialModel'))
    .forEach(c => { if (!b.itens.some(i => i.base === c._id)) { b.itens.push(itemDoCatalogo(c)); n.itens++; } });
  return n;
}
/* the item pool of map p for the generated chests and searches: when it lacks item cards or materials, those of the
   Workshop (within the boxes). Returns how many were added */
function prepararItens(p, atos) {
  return comProjeto(p, () => { let n = 0;
    p.itensPool = p.itensPool || []; const of = daOficina(atos);
    const tem = mat => p.itensPool.some(id => { const i = ITENS_B().find(x => x.id === id); return i && (i.cls === 'CraftingMaterialModel') === mat; });
    // (the unique items the party starts the campaign with are never offered again)
    const ja = itensIniciaisUnicos(); p.itensPool = p.itensPool.filter(id => !ja.has(id));
    (tem(false) ? [] : of.cartas).concat(tem(true) ? [] : of.materiais).forEach(i => { if (!p.itensPool.includes(i.id) && !ja.has(i.id)) { p.itensPool.push(i.id); n++; } });
    return n; });
}
/* the monster pool of map p, when empty: monsters of the Workshop of different types (those of the faction first) */
function prepararReserva(p, atos, rng, tipos = [], quantos = 3, tierAte = 0) {
  if (reservaComMonstros(p)) return 0;
  // (tierAte: Easy prefers monsters that come in at a low tier: one whose first tier is 3 came in at 3 even where the
  // balance asked for 1, the simulation of the level found)
  const baixo = m => !tierAte || Math.min(99, ...(m.tiers || []).map(t => t.tier)) <= tierAte;
  const porTipo = new Map(); rng.embaralhar(daOficina(atos).monstros).sort((a, b) => (baixo(b) ? 2 : 0) + (tipos.includes(b.tipo) ? 1 : 0) - (baixo(a) ? 2 : 0) - (tipos.includes(a.tipo) ? 1 : 0)).forEach(m => { if (!porTipo.has(m.tipo)) porTipo.set(m.tipo, m); });
  p.reserva = [...porTipo.values()].slice(0, quantos).map(m => m.id); return p.reserva.length;
}
/* the warning of a window when the Workshop holds too little, with the way out: a starter selection, or the Workshop */
function mostrarFaltas(el, faltas, atos, precisa, depois) {
  el.innerHTML = `<div class="faltasOficina"><p><b>${tr('The Workshop holds too little to generate with variety')}</b> (${tr(atos === 1 ? 'Act I only' : 'Acts I and II')}):</p>
    <ul>${faltas.map(f => `<li>${tr(f.rotulo)}: <b>${f.tem}</b> / ${f.min}</li>`).join('')}</ul>
    <p class="ajuda">${tr('The generators use only what is in the Workshop: its monsters, items, materials and objects, within the chosen boxes.')} ${tr('A starter selection brings from the game the monsters the game itself draws at random (no quest-specific ones), the item cards and the crafting materials of the chosen boxes. Trim it in the Workshop as you like.')}</p>
    <div class="linha"><button class="primario" data-selecao>${tr('Add a starter selection')}</button><button data-oficina>${tr('Open the Workshop')}</button></div></div>`;
  el.querySelector('[data-selecao]').onclick = () => { const n = selecaoInicial(atos, { monstros: faltas.some(f => f.chave === 'monstros'), itens: faltas.some(f => f.chave === 'itens') });
    aviso(tr('Added to the Workshop') + ': ' + n.monstros + ' ' + tr('monsters') + ', ' + n.itens + ' ' + tr('items and materials') + '.'); tudo();
    const resto = faltasDaOficina(atos, precisa); if (resto.length) mostrarFaltas(el, resto, atos, precisa, depois); else depois(); };
  el.querySelector('[data-oficina]').onclick = () => abrirFichas(faltas[0].chave === 'itens' ? 'itens' : 'monstros');
}

// ------------------------------------------------------------ building one room
const PASSOS_TAMANHO = { P: [0, 0.4], M: [0.3, 0.7], G: [0.6, 1] };
/* the pieces the generator may still take from the box, beside what the rooms in `salas` (on the table together) use */
const naCaixaAte = (tipo, atos) => caixaDoTerreno(tipo, atos) ?? 0;
/* how many more pieces of a kind the box holds beside the rooms in `salas` (on the table together); Infinity for kinds the
   boxes do not count (the Workshop's objects) */
function objetoLivre(p, salas, tipo, atos) {
  const g0 = grupoDoTerreno(tipo); const caixa = g => caixaDoTerreno(g, atos);
  if (caixa(g0) === null) return Infinity;
  const contar = (g, filtro) => { let n = 0; salas.forEach(i => { const s = p.salas[i]; const vistos = new Set(); (s?.objetos || []).forEach(o => { if (grupoDoTerreno(o.type) !== g || (filtro && !filtro(o, s))) return; const k = o.pos.join(',') + ':' + (o.level || 0); if (!vistos.has(k)) { vistos.add(k); n++; } }); }); return n; };
  if (g0 === 'Bell' || g0 === 'BellFrame') return caixa(g0) - usoDosSinos(g0, g => contar(g), () => contar('Bell', sinoNoArco), caixa);
  return caixa(g0) - usoPartilhado(g0, contar, caixa);
}
function pecasLivres(p, salas, tipo, atos) { let n = 0; salas.forEach(i => { const vistos = new Set(); (p.salas[i]?.objetos || []).forEach(o => { if (grupoDoTerreno(o.type) !== grupoDoTerreno(tipo)) return; const k = o.pos.join(',') + ':' + (o.level || 0); if (!vistos.has(k)) { vistos.add(k); n++; } }); }); return Math.max(0, naCaixaAte(tipo, atos) - n); }
function pilaresLivres(p, salas, atos) { const r = {}; Object.keys(SUPORTES).forEach(t => { r[t] = caixaDoPilar(t, atos); });
  salas.forEach(i => { const s = p.salas[i]; if (!s) return; s.pecas.forEach(q => (q.pilares || []).forEach(x => { r[x.type] = (r[x.type] || 0) - 1; })); s.objetos.forEach(o => { const k = pilarDoObjeto(o); if (k) r[k] = (r[k] || 0) - 1; }); });
  Object.keys(r).forEach(t => { r[t] = Math.max(0, r[t]); }); return r; }
/* the tiles still in the box: one entry per physical tile (A and B are its two sides) not used by another room */
function estoquePecas(p, tema, excluir, atos = 2, convivem = null) {
  // (a tile is taken once for each copy the boxes hold: two boxes, two of each)
  const usos = new Map(); p.salas.forEach((s, si) => { if (si === excluir || (convivem && !convivem.includes(si))) return; s.pecas.forEach(q => { if (!ehAlfombra(q.tile)) { const n = numeroDaPeca(q.tile); usos.set(n, (usos.get(n) || 0) + 1); } }); });
  const porNumero = new Map();
  PECAS.filter(t => t.kind === 'tile' && !['platform', 'vault', 'gamebox'].includes(t.id) && (t.cells || []).length && (t.act || 1) <= atos).forEach(t => { const n = numeroDaPeca(t.id); if ((usos.get(n) || 0) >= caixaDaPeca(n, atos)) return; if (!porNumero.has(n)) porNumero.set(n, []); porNumero.get(n).push(t); });
  const pisos = TEMAS_SALA[tema]?.pisos;
  return [...porNumero.values()].map(l => pisos ? l.filter(t => pisos.includes(t.floor)) : l).filter(l => l.length);
}
/* the squares taken by the other rooms (floor, underlays and terrain) */
function casasOcupadas(p, excluir) {
  const r = new Set(); p.salas.forEach((s, si) => { if (si === excluir) return; s.pecas.forEach(q => casasDaPeca(q).forEach(([x, y]) => r.add(kc(x, y)))); s.objetos.forEach(o => { if (ehTerreno(o)) casasDoObjeto(o).forEach(([x, y]) => r.add(kc(x, y))); }); });
  return r;
}
/* the edges where a new room may start: a free square next to the floor of an existing room, with space beyond it */
/* altos: also the edges of raised tiles (a ledge the heroes jump down from, never to climb back): only for a map's point of
   no return */
function pontosDeLigacao(p = projeto, altos = false) {
  const ocup = casasOcupadas(p, -1); const r = [];
  p.salas.forEach((s, si) => {
    const ch = chaoDaSala(si, p);
    ch.forEach(c => { if ((c.nivel !== 0 && !altos) || c.bloqueia || c.escada || c.ponte || (c.muro && !altos) || c.degrau) return;   // (the top of the vault's wall: a ledge to jump down from)
      VIZ4.forEach(([dx, dy]) => { const ex = c.x + dx, ey = c.y + dy; if (ocup.has(kc(ex, ey))) return;
        // room to grow: the three squares ahead and their sides are free
        let livre = 0; for (let k = 1; k <= 4; k++) for (let l = -2; l <= 2; l++) { const x = ex + dx * (k - 1) + (dy ? l : 0), y = ey + dy * (k - 1) + (dx ? l : 0); if (!ocup.has(kc(x, y))) livre++; }
        if (livre >= 18) r.push({ sala: si, casa: [c.x, c.y], fora: [ex, ey], dir: [dx, dy], livre, nivel: c.nivel || 0 }); }); });
  });
  // one point per stretch of edge: keep the best of each 3 squares
  const escolhidos = []; r.sort((a, b) => b.livre - a.livre).forEach(pt => { if (!escolhidos.some(q => q.sala === pt.sala && q.nivel === pt.nivel && q.dir[0] === pt.dir[0] && q.dir[1] === pt.dir[1] && Math.abs(q.casa[0] - pt.casa[0]) + Math.abs(q.casa[1] - pt.casa[1]) < 4)) escolhidos.push(pt); });
  return escolhidos;
}
const nomeDirecao = d => d[1] < 0 ? L2('north', 'norte') : d[1] > 0 ? L2('south', 'sul') : d[0] > 0 ? L2('east', 'leste') : L2('west', 'oeste');

function gerarSala(opts) {
  const rng = rngDe(opts.semente);
  const arq = ARQUETIPO_SALA(opts.arquetipo) || ARQUETIPOS_SALA[0];
  const p = opts.projeto || projeto; const idx = p.salas.length;
  const tema = opts.tema || 'qualquer'; const temaObj = TEMAS_SALA[tema] || TEMAS_SALA.qualquer; const atos = opts.atos === 1 ? 1 : 2;
  const base = opts.base || null; const trava = opts.travas || {};
  const ocup = casasOcupadas(p, -1);
  let lig = opts.ligacao || null;
  let pecas, piso, subidas = [], alfombra = null, herois = [], entrada = [], abridor = null;
  // the rooms on the table together with this one (the others were taken away before it opens, or come after they go)
  // (in the editor: every room still on the table when the new one opens; those removed before it gave their pieces back)
  const convivem = opts.convivem || (() => { let fora = new Set(); try { if (p === projeto && lig) { limparAbridores(); fora = removidosAntes(lig.sala).salas; } } catch { } return p.salas.map((x, i) => i).filter(i => !fora.has(i)); })();
  let portaK = new Set(), frente = [], passagem = null; const flancos = new Set();   // in front of an archway's feet
  // triggers the opener of this room gets besides opening it (an ambush a round later…): {gatilhos, listas}
  const aoAbrir = { gatilhos: [], listas: {} };
  const [f0, f1] = PASSOS_TAMANHO[opts.tamanho || 'M'] || PASSOS_TAMANHO.M;
  // 0. the opener: an object in the room left behind, at its edge, that opens this one. It comes first: the new room may
  //    touch the rest of the map only in front of it (a door must shut the room it opens)
  if (lig && !(base && trava.pecas)) {
    const pesos = Object.fromEntries(Object.entries(temaObj.abridores || { Door: 3, Gate: 1, SightToken: 2, Archway: 1 }).filter(([t]) => daCaixa(t, atos)));
    const alto = lig.nivel || 0;   // a ledge: the room below is reached by jumping down, through a point of interest
    const tipoA = alto ? 'SightToken' : opts.abridor === 'porta' ? rng.pesado({ Door: pesos.Door || 1, Gate: pesos.Gate || 1 }) : opts.abridor && opts.abridor !== 'random' ? opts.abridor : rng.pesado(pesos);
    const R = p.salas[lig.sala]; const chR = chaoDaSala(lig.sala, p);
    // a free square of the room left behind: floor at level 0, nothing on it, and not where the heroes start
    // …and no monster there (placed or entering by a trigger)
    // (a monster standing where the opener must go: in a map, the monster steps aside, to a free square of its level)
    const iniR = new Map((R.inimigos || []).map((e, i) => [kc(e.pos[0], e.pos[1]), i])); let passaIni = false;
    const tomadasR = new Set(); R.objetos.concat(R.grupoPool ? [R.grupoPool] : []).forEach(o => todosGatilhos(o).forEach(g => { if (g.tipo === 'spawn') (g.cells || []).concat((g.inimigos || []).map(e => e.pos)).forEach(c => tomadasR.add(kc(c[0], c[1]))); }));
    const livreR = (x, y) => { const c = chR.get(kc(x, y)); return c && !c.alfombra && !c.bloqueia && !c.escada && !c.ponte && (!c.muro || alto > 0) && !c.degrau && c.nivel === alto && !R.objetos.some(o => casasDoObjeto(o).some(([a, b]) => a === x && b === y)) && !(R.herois || []).some(h => h[0] === x && h[1] === y) && !tomadasR.has(kc(x, y)) && (passaIni || !iniR.has(kc(x, y))); };
    // a point of interest fires as soon as a hero stands next to it: never next to where the heroes start
    const longeDosHerois = (x, y) => !(R.herois || []).some(h => Math.max(Math.abs(h[0] - x), Math.abs(h[1] - y)) <= 1);
    // ... at the edge: the square beyond it, in the way out, is free
    const naBorda = (x, y) => livreR(x, y) && !ocup.has(kc(x + lig.dir[0], y + lig.dir[1]));
    // a door: both its squares at the edge; an archway: its two middle squares (where the heroes pass) at the edge, its
    // feet on the floor beside them
    // the opener must not cut the room left behind, and the heroes must reach it (and everything else there)
    const entR = entradaDaSala(lig.sala, p);
    const foraAntes = foraDeAlcance(lig.sala, p, entR).length;   // (a room made by hand may already have something out of reach)
    // (…and a gate or anything that stops a figure, or any opener in a room where heroes land after a point of no return,
    // leaves four free squares at least to stand on)
    const alcancavel = o => { const pt = { ...p, salas: p.salas.map((x, i) => i === lig.sala ? { ...x, objetos: x.objetos.concat([o]) } : x) }; const f = foraDeAlcance(lig.sala, pt, entR); if (f.length > foraAntes || f.includes(o)) return false;
      if (!bloqueio(o).move && !ehArco(o) && !p.salas[lig.sala]?._pouso) return true; return [...chaoDaSala(lig.sala, pt).values()].filter(c => !c.bloqueia && c.objeto == null && !c.alfombra).length >= 4; };
    // the rooms on the table when the opener goes in: those around the room left behind (even when this room is a point of
    // no return, which clears them only as it opens)
    const mesaDoAbridor = [...new Set((opts.mesaDoAbridor || convivem).concat([lig.sala]))];
    const tenta = (tipo) => {
      if (alto && tipo !== 'SightToken') return null;
      // no archway left in the box: the frame of the bell (Act II) stands in for it
      if (tipo === 'Archway' && objetoLivre(p, mesaDoAbridor, 'Archway', atos) <= 0 && daCaixa('BellFrame', atos)) tipo = 'BellFrame';
      if (objetoLivre(p, mesaDoAbridor, tipo, atos) <= 0) return null;   // none left in the box
      if (tipo === 'SightToken') { const o = { type: 'SightToken', pos: [...lig.casa], rot: 0, level: alto }; return naBorda(...lig.casa) && longeDosHerois(...lig.casa) && alcancavel(o) ? o : null; }
      const w = (defObj(tipo)?.w || 2); const rot = lig.dir[1] !== 0 ? 0 : 90; const eixo = rot === 0 ? [1, 0] : [0, 1];
      const arco = ehArcoTipo(tipo);
      // the middle (or the door) over the point first, then slid along the edge by up to two squares
      for (const d of (arco ? [1, 2, 0, 3, -1, 4, -2, 5, -3, 6] : w > 1 ? [0, 1, -1, 2] : [0, 1, -1])) { const pos = [lig.casa[0] - eixo[0] * d, lig.casa[1] - eixo[1] * d]; const o = { type: tipo, pos, rot, level: 0 };
        if ((arco ? meioDoArco(o).pes.every(([x, y]) => livreR(x, y) || (!ocup.has(kc(x, y)) && !R.objetos.some(q => casasDoObjeto(q).some(([a, b]) => a === x && b === y)))) && meioDoArco(o).meio.every(([x, y]) => naBorda(x, y)) : casasDoObjeto(o).every(([x, y]) => naBorda(x, y))) && alcancavel(o)) return o; }
      return null; };
    let cs;
    if (opts.dono) {
      // the opener is an object (or monster) the user picked: no new object. The room opens in front of it when it stands at
      // this edge (a door of the map); otherwise through a passage two squares wide at the edge
      const junto = opts.dono.casas.filter(([x, y]) => { const c = chR.get(kc(x, y)); return c && c.nivel === 0 && !ocup.has(kc(x + lig.dir[0], y + lig.dir[1])) && Math.abs(x - lig.casa[0]) + Math.abs(y - lig.casa[1]) <= 1; });
      const passagem = tenta('Door');
      cs = junto.length ? junto : passagem ? casasDoObjeto(passagem) : naBorda(...lig.casa) ? [lig.casa] : null;
      if (!cs) return { erro: L2('No passage fits at that edge.', 'Nenhuma passagem cabe nessa borda.') };
    } else {
      // now and then a portal: an archway with a door (or a gate) in its middle; the door opens the room
      const portas = ['Door', 'Gate'].filter(t => daCaixa(t, atos) && OBJETO[t]);
      const querPortal = portas.length && (daCaixa('Archway', atos) || daCaixa('BellFrame', atos)) && (tipoA === 'Archway' ? rng() < 0.5 : (tipoA === 'Door' || tipoA === 'Gate') && rng() < 0.2);
      let o = (querPortal ? tenta('Archway') : null) || tenta(tipoA) || tenta('Door') || tenta('SightToken');
      let mover = null;
      if (!o && opts.moverInimigos && iniR.size) { passaIni = true; o = tenta(tipoA === 'Archway' ? 'Door' : tipoA) || tenta('Door') || tenta('SightToken');
        if (o) { const sob = casasDoObjeto(o).map(([x, y]) => iniR.get(kc(x, y))).filter(i => i != null); const usadas = new Set(casasDoObjeto(o).map(([x, y]) => kc(x, y))); mover = [];
          passaIni = false;
          for (const i of sob) { const e = R.inimigos[i]; const lv = e.level || 0;
            const livre = [...chR.values()].filter(c => c.nivel === lv && !c.alfombra && !c.bloqueia && !c.escada && !c.ponte && !c.muro && !c.degrau && !usadas.has(kc(c.x, c.y)) && !R.objetos.some(q => casasDoObjeto(q).some(([a, b]) => a === c.x && b === c.y)) && !iniR.has(kc(c.x, c.y)) && !tomadasR.has(kc(c.x, c.y)) && !(R.herois || []).some(h => h[0] === c.x && h[1] === c.y))
              .sort((a, b) => Math.abs(a.x - e.pos[0]) + Math.abs(a.y - e.pos[1]) - Math.abs(b.x - e.pos[0]) - Math.abs(b.y - e.pos[1]));
            if (!livre.length) { o = null; break; } usadas.add(kc(livre[0].x, livre[0].y)); mover.push({ i, pos: [livre[0].x, livre[0].y] }); } } }
      if (!o) return { erro: L2('No room at that edge for a door or a token.', 'Não cabe porta nem ficha nessa borda.') };
      let moldura = null, gemeo = null;
      if (querPortal && ehArco(o)) { const porta = portaNoArco(o, tipoA === 'Gate' || tipoA === 'Door' ? tipoA : rng.pick(portas)); if (porta && alcancavel(porta)) { moldura = { ...o, name: '', textClick: L2('A stone portal, its way shut by what stands in it.', 'Um portal de pedra, com a passagem fechada pelo que está nele.'), textUse: '', gatilhos: [], requisitos: [], senao: [] }; o = porta; } }
      // no portal after all: the kind asked for (a door, for the last room)
      if (!moldura && ehArco(o) && (querPortal && tipoA !== 'Archway' || opts.abridor === 'porta')) o = tenta(tipoA !== 'Archway' ? tipoA : 'Door') || tenta('Door') || o;
      // an archway alone opens nothing (in the game it is not used): a point of interest stands in its passage and opens
      // the room as the heroes come near; the archway is only its frame
      if (!moldura && ehArco(o)) {
        // two points of interest, one in each square of the passage (the game fires them also on the diagonal: the pair keeps
        // it even); the second stands for the first
        const meio = meioDoArco(o).meio.filter(([x, y]) => longeDosHerois(x, y)); const livres = objetoLivre(p, mesaDoAbridor, 'SightToken', atos);
        if (livres > 0 && meio.length) { moldura = { ...o, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
          o = { type: 'SightToken', pos: [meio[0][0], meio[0][1]], rot: 0, level: o.level || 0 };
          if (meio.length > 1 && livres > 1) gemeo = { type: 'SightToken', pos: [meio[1][0], meio[1][1]], rot: 0, level: o.level || 0, name: '', textUse: '', gatilhos: [], requisitos: [], senao: [] }; }
        else o = tenta('Door') || tenta('SightToken');
        if (!o) return { erro: L2('No room at that edge for a door or a token.', 'Não cabe porta nem ficha nessa borda.') };
      }
      abridor = { sala: lig.sala, objeto: { ...o, name: '', textClick: textoDeOlhar(o.type, rng), textUse: '', gatilhos: [], requisitos: [], senao: [] }, moldura, ...(gemeo ? { gemeo } : {}), ...(mover && mover.length ? { mover } : {}) };
      cs = casasDoObjeto(moldura || o); if (moldura) { const a = meioDoArco(moldura); passagem = a.meio; a.pes.forEach(([x, y]) => flancos.add(kc(x + lig.dir[0], y + lig.dir[1]))); }
      if (ehArco(o)) { const a = meioDoArco(o); passagem = a.meio; a.pes.forEach(([x, y]) => flancos.add(kc(x + lig.dir[0], y + lig.dir[1]))); }
    }
    portaK = new Set(cs.map(([x, y]) => kc(x, y))); frente = (passagem || cs).map(([x, y]) => [x + lig.dir[0], y + lig.dir[1]]);
    // the opener slid along the edge: the new room starts in front of it (where the heroes pass), not at the point asked
    if (frente.length && !frente.some(([x, y]) => x === lig.fora[0] && y === lig.fora[1])) { const f = frente[0]; lig = { ...lig, fora: [f[0], f[1]], casa: [f[0] - lig.dir[0], f[1] - lig.dir[1]] }; }
  }
  // the squares the new floor may not take: next to the floor of another room (sides and corners), except in front of the
  // opener. The squares in front of it may touch the room behind only through the opener's own squares
  const proibidas = new Set();
  ocup.forEach(k => { if (portaK.has(k)) return; const [x, y] = k.split(',').map(Number); VIZ8.forEach(([dx, dy]) => { const n = kc(x + dx, y + dy); if (!ocup.has(n)) proibidas.add(n); }); });
  frente.forEach(([x, y]) => { if (VIZ4.every(([dx, dy]) => { const n = kc(x + dx, y + dy); return !ocup.has(n) || portaK.has(n); })) proibidas.delete(kc(x, y)); });
  // in front of an archway's feet the new floor may go (the feet block the way: the heroes pass through the middle only)
  flancos.forEach(k => { const [x, y] = k.split(',').map(Number); if (VIZ4.every(([dx, dy]) => { const n = kc(x + dx, y + dy); return !ocup.has(n) || portaK.has(n); })) proibidas.delete(k); });
  const alvoArea = Math.round(arq.area[0] + (arq.area[1] - arq.area[0]) * (f0 + (f1 - f0) * rng()));
  const forma = rng.pesado(arq.formas || { irregular: 1 });
  const refazPiso = () => { piso = new Map(); pecas.forEach((q, i) => casasDaPeca(q).forEach(([x, y]) => { const a = piso.get(kc(x, y)); const lv = nivelNaPeca(q, x, y); if (!ehAlfombra(q.tile) && (!a || lv > a.nivel)) piso.set(kc(x, y), { x, y, nivel: lv, peca: i, ...(lv !== (q.level || 0) ? { muro: true } : {}) }); })); };
  if (base && trava.pecas) {
    pecas = clone(base.sala.pecas.filter(q => !ehAlfombra(q.tile))); subidas = clone(base.subidas || (base.escada ? [base.escada] : [])); alfombra = base.alfombra ? clone(base.alfombra) : null;
    herois = clone(base.sala.herois || []); abridor = base.abridor ? clone(base.abridor) : null; (base.abertura || []).forEach(([x, y]) => portaK.add(kc(x, y))); refazPiso();
  } else {
    // 1. the tiles
    const estoque = rng.embaralhar(estoquePecas(p, tema, -1, atos, convivem));
    if (!estoque.length) return { erro: L2('No free tile left in the box for this theme.', 'Não sobrou peça livre na caixa para este tema.') };
    pecas = []; piso = new Map(); const usadosN = new Set();
    const cabe = q => casasDaPeca(q).every(([x, y]) => !ocup.has(kc(x, y)) && !piso.has(kc(x, y)) && !proibidas.has(kc(x, y)));
    const lado = l => rng.pick(l);
    // (a simple room, asked for by a map: at most the tiles it says)
    const maxP = opts.pecasMax ? Math.max(1, Math.min(arq.pecas[1], opts.pecasMax)) : arq.pecas[1], minP = Math.min(arq.pecas[0], maxP);
    const alvoPecas = rng.int(minP, maxP);
    const medidaDe = cells => { const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]); const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1; return { w, h, comp: cells.length / (w * h), along: Math.max(w, h) / Math.min(w, h) }; };
    const notaForma = cells => { const m = medidaDe(cells); switch (forma) { case 'compacta': return m.comp * 2 - Math.max(0, m.along - 1.5); case 'alongada': return Math.min(m.along, 4) / 2 + m.comp * 0.3; case 'L': return 1 - Math.abs(m.comp - 0.66) * 3 - Math.max(0, m.along - 2) * 0.5; case 'cruz': return 1 - Math.abs(m.comp - 0.56) * 3; default: return 0.5; } };
    // the first tile: over the square beyond the edge (a new room next to another), or at the origin. Every tile, side,
    // turn and square of it is tried in a shuffled order; it must cover every square in front of the opener (where the
    // heroes pass: both squares of a door, the middle of an archway)
    let primeira = null, achadas = 0;
    // (a special tile asked for: the vault of Act II, the inside of the box, where the heroes arrive only by teleport)
    const especial = opts.pecaEspecial && PECA[opts.pecaEspecial] && (PECA[opts.pecaEspecial].act || 1) <= atos && !p.salas.some(s => s.pecas.some(q => q.tile === opts.pecaEspecial)) ? PECA[opts.pecaEspecial] : null;
    const tentativas = []; (especial ? [[especial]] : estoque).forEach(l => l.forEach(tile => [0, 90, 180, 270].forEach(rot => tile.cells.forEach(c0 => tentativas.push([tile, rot, girar(c0, rot)])))));
    for (const [tile, rot, c] of rng.embaralhar(tentativas)) {
      const o0 = opts.origem || [0, 0]; const pos = lig ? [lig.fora[0] - c[0], lig.fora[1] - c[1]] : [o0[0] - c[0], o0[1] - c[1]];
      const q = { tile: tile.id, pos, rot, level: 0, pilares: [] };
      if (!cabe(q)) continue;
      const cells = casasDaPeca(q);
      if (lig) { // it must grow away from the room it leaves, not along it
        const avanco = cells.reduce((s, [x, y]) => s + (x - lig.fora[0]) * lig.dir[0] + (y - lig.fora[1]) * lig.dir[1], 0) / cells.length;
        if (avanco < 1) continue; }
      if (frente.length > 1 && !frente.every(([fx, fy]) => cells.some(([x, y]) => x === fx && y === fy))) continue;
      // (on a map: of the first few that fit, the one nearest the middle of the table)
      if (!opts.atrator) { primeira = q; break; }
      const d = Math.hypot(cells.reduce((a, c) => a + c[0], 0) / cells.length - opts.atrator[0], cells.reduce((a, c) => a + c[1], 0) / cells.length - opts.atrator[1]) + rng() * 2;
      if (!primeira || d < primeira._d) { primeira = q; Object.defineProperty(q, '_d', { value: d, configurable: true }); }
      if (++achadas >= 6) break;
    }
    if (primeira) usadosN.add(numeroDaPeca(primeira.tile));
    if (!primeira) return { erro: L2('No tile fits there.', 'Nenhuma peça cabe ali.') };
    pecas.push(primeira); refazPiso();
    if (especial && piso.size >= alvoArea * 0.6) pecas._so = true;   // (the vault is a room of its own)
    // 2. the next tiles: touching the floor along at least two squares, towards the wanted outline and area
    while (!pecas._so && pecas.length < maxP && (pecas.length < alvoPecas || piso.size < alvoArea * 0.85)) {
      const borda = []; piso.forEach(c => VIZ4.forEach(([dx, dy]) => { const k = kc(c.x + dx, c.y + dy); if (!piso.has(k) && !ocup.has(k)) borda.push([c.x + dx, c.y + dy]); }));
      if (!borda.length) break;
      let melhor = null, nm = -Infinity;
      const livres = estoque.filter(l => !usadosN.has(numeroDaPeca(l[0].id)));
      for (let t = 0; t < 70; t++) {
        const tile = lado(rng.pick(livres) || []); if (!tile) break; const rot = [0, 90, 180, 270][rng.int(0, 3)];
        const cs = tile.cells.map(c => girar(c, rot)); const b = rng.pick(borda); const c = rng.pick(cs);
        const q = { tile: tile.id, pos: [b[0] - c[0], b[1] - c[1]], rot, level: 0, pilares: [] };
        if (!cabe(q)) continue;
        const novas = casasDaPeca(q); let contato = 0; novas.forEach(([x, y]) => VIZ4.forEach(([dx, dy]) => { if (piso.has(kc(x + dx, y + dy))) contato++; }));
        if (contato < 2) continue;
        // it must not cover the square the room is entered from, nor wrap around the room it leaves
        const todas = [...piso.values()].map(v => [v.x, v.y]).concat(novas);
        const area = todas.length;
        // (on a map, a pull towards the middle of the table: the room curls in, the map stays compact)
        const puxa = opts.atrator ? Math.hypot(novas.reduce((a, c) => a + c[0], 0) / novas.length - opts.atrator[0], novas.reduce((a, c) => a + c[1], 0) / novas.length - opts.atrator[1]) * 0.05 : 0;
        const n = notaForma(todas) - Math.abs(area - alvoArea) / alvoArea * 1.5 + Math.min(contato, 8) * 0.03 + rng() * 0.25 - puxa;
        if (n > nm) { nm = n; melhor = q; }
      }
      if (!melhor) break;
      pecas.push(melhor); usadosN.add(numeroDaPeca(melhor.tile)); refazPiso();
      if (pecas.length >= minP && piso.size >= alvoArea * 0.95) break;
    }
    // 3. height: tiles raised on pillars, reached by staircases (with Act II also by ladders); now and then a second
    //    level over the first and, with the tall pillars of Act II, a third. The pieces come from the box: staircases,
    //    ladders and pillars already on the table (in the rooms that stand with this one) are not there to take
    // (Act II, with its ladders, tall pillars and the platform, climbs more: as its maps do)
    // (a room of a map asked for height: always, with at least two tiles; for a walkway to leave from it, up to level 2)
    if (pecas.length >= 2 && !opts.semAlto && (opts.alto || rng() < Math.min(1, atos === 2 && arq.niveis && arq.id !== 'abertura' ? arq.niveis * 3 + 0.3 : (arq.niveis || 0) * 2 + 0.1))) {
      const entradaK = lig ? kc(lig.fora[0], lig.fora[1]) : null;
      // a tile that may go up: not the one entered by, not one a way up already stands on, and never the last low one
      const podeSubir = i => (i > 0 || !lig) && !(entradaK && casasDaPeca(pecas[i]).some(([x, y]) => kc(x, y) === entradaK))
        && !subidas.some(o => casasDoObjeto(o).some(([x, y]) => casasDaPeca(pecas[i]).some(([a, b]) => a === x && b === y)))
        && pecas.some((q, j) => j !== i && !(q.level));
      const pil = pilaresLivres(p, convivem, atos), con = { Staircase: pecasLivres(p, convivem, 'Staircase', atos), Ladder: pecasLivres(p, convivem, 'Ladder', atos), LadderMedium: pecasLivres(p, convivem, 'LadderMedium', atos) };
      const TIPO_PILAR = [null, 'PillarShort', 'Pillar', 'PillarTall'];
      const erguer = (i, nv) => { const tp = TIPO_PILAR[nv]; if (!tp) return false;
        // (pillars a map keeps for later, a walkway for instance: this room takes only what is left, three a tile then)
        const guarda = (opts.reservaPilares || {})[tp] || 0; const tem = pil[tp] - guarda;
        const soq = [...encaixesDaPeca(pecas[i])].map(v => v.split(',').map(Number)); const quer = Math.min(guarda ? 3 : 4, soq.length);
        if (tem < Math.min(3, quer)) return false;
        const escolhidos = []; while (escolhidos.length < Math.min(quer, tem)) { let m = null, dm = -1; soq.forEach(v => { if (escolhidos.some(q => q[0] === v[0] && q[1] === v[1])) return; const d = escolhidos.length ? Math.min(...escolhidos.map(q => Math.abs(q[0] - v[0]) + Math.abs(q[1] - v[1]))) : rng(); if (d > dm) { dm = d; m = v; } }); if (!m) break; escolhidos.push(m); }
        pecas[i].level = nv; pecas[i].pilares = escolhidos.map(v => ({ pos: v, type: tp })); pil[tp] -= escolhidos.length; refazPiso(); return true; };
      const baixar = i => { (pecas[i].pilares || []).forEach(q => { pil[q.type] = (pil[q.type] || 0) + 1; }); pecas[i].level = 0; pecas[i].pilares = []; refazPiso(); };
      // a way up from the floor at level `de` into tile i: a staircase (one level), a ladder (one) or a medium ladder (two)
      const ligar = (i, de) => { const dn = (pecas[i].level || 0) - de; const alto = new Set(casasDaPeca(pecas[i]).map(([x, y]) => kc(x, y)));
        const tomadas = new Set(subidas.flatMap(o => casasDoObjeto(o)).map(([x, y]) => kc(x, y)));
        const tipos = rng.embaralhar((dn === 1 ? ['Staircase', 'Staircase', 'Ladder'] : dn === 2 ? ['LadderMedium'] : []).filter(t => con[t] > 0 && (t === 'Staircase' || (atos === 2 && OBJETO[t]))));
        const ent0 = lig ? lig.fora : (opts.origem || [0, 0]); const perto0 = c => Math.abs(c.x - ent0[0]) + Math.abs(c.y - ent0[1]) + rng() * 3;
        const baixas = rng.embaralhar([...piso.values()].filter(c => c.nivel === de && !alto.has(kc(c.x, c.y)) && !tomadas.has(kc(c.x, c.y)) && kc(c.x, c.y) !== entradaK)).map(c => ({ c, k: perto0(c) })).sort((a, b) => a.k - b.k).map(x => x.c).slice(0, 80);   // (the way up on the side of the way in)
        for (const tipo of tipos) for (const c of baixas) for (const rot of [0, 90, 180, 270]) {
          const o = { type: tipo, pos: [c.x, c.y], rot, level: de }; const cs = casasDoObjeto(o);
          if (!cs.every(([x, y]) => piso.get(kc(x, y))?.nivel === de && !alto.has(kc(x, y)) && !tomadas.has(kc(x, y)) && kc(x, y) !== entradaK)) continue;
          const [ux, uy] = SOBE[rot / 90]; const topo = cs.filter(([x, y]) => !cs.some(([a, b]) => a === x + ux && b === y + uy));
          if (topo.every(([x, y]) => alto.has(kc(x + ux, y + uy)))) { con[tipo]--; return { ...o, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] }; } }
        return null; };
      let topoI = null;
      // a raised tile is a passage, not a dead end: first the tiles with low tiles on two sides or more (up by a staircase on
      // the side of the way in, down on the other by a jump: no ladder needed to come down)
      const vizinhosBaixos = i => { const ci = new Set(casasDaPeca(pecas[i]).map(([x, y]) => kc(x, y))); return pecas.filter((q, j) => j !== i && !(q.level) && casasDaPeca(q).filter(([x, y]) => VIZ4.some(([dx, dy]) => ci.has(kc(x + dx, y + dy)))).length >= 2).length; };
      let ordemSubir = rng.embaralhar(pecas.map((q, i) => i).filter(podeSubir)).map(i => ({ i, n: vizinhosBaixos(i) >= 2 && rng() < 0.8 ? 1 : 0 })).sort((a, b) => b.n - a.n).map(x => x.i);
      // (raised for a walkway back over the rooms behind: the tile nearest the way in goes up, so the walkway starts on that side)
      if (opts.alto === 2 && lig) { const dEnt = i => Math.min(...casasDaPeca(pecas[i]).map(([x, y]) => Math.abs(x - lig.fora[0]) + Math.abs(y - lig.fora[1]))); ordemSubir = ordemSubir.map(i => ({ i, d: dEnt(i) + rng() })).sort((a, b) => a.d - b.d).map(x => x.i); }
      for (const i of ordemSubir) {
        // straight to level 2 by a medium ladder, now and then
        const nv = atos === 2 && con.LadderMedium > 0 && (opts.alto === 2 || rng() < 0.35) ? 2 : 1;
        if (!erguer(i, nv)) { if (nv === 2 && erguer(i, 1)) { /* level 1 then */ } else continue; }
        const o = ligar(i, 0); if (!o) { baixar(i); continue; }
        subidas.push(o); topoI = i; break;
      }
      // higher: a tile next to the raised one, one level (or two) above it, reached from it
      for (let passo = 0; topoI !== null && passo < 2 && ((opts.alto === 2 && (pecas[topoI].level || 0) < 2) || rng() < (atos === 2 ? 0.85 : 0.7)); passo++) {
        const ci = new Set(casasDaPeca(pecas[topoI]).map(([x, y]) => kc(x, y))); const base0 = pecas[topoI].level || 0;
        const vizinhas = rng.embaralhar(pecas.map((q, j) => j).filter(j => j !== topoI && podeSubir(j) && !(pecas[j].level) && casasDaPeca(pecas[j]).some(([x, y]) => VIZ4.some(([dx, dy]) => ci.has(kc(x + dx, y + dy))))));
        let achou = null;
        for (const j of vizinhas) { const nv = Math.min(3, base0 + (atos === 2 && con.LadderMedium > 0 && base0 === 1 && rng() < 0.3 ? 2 : 1)); if (nv <= base0) break;
          if (!erguer(j, nv)) continue; const o = ligar(j, base0); if (!o) { baixar(j); continue; } subidas.push(o); achou = j; break; }
        if (achou === null) break; topoI = achou;
      }
      // the platform of Act II (a box standing on the floor, its top at level 2): now and then beside the highest tile,
      // walked onto from a tile at level 2, reached by a ladder from level 1
      const plataformaLivre = atos === 2 && PECA.platform && !p.salas.some((s, i) => (!convivem || convivem.includes(i)) && s.pecas.some(q => q.tile === 'platform'));
      if (topoI !== null && plataformaLivre && [1, 2].includes(pecas[topoI].level || 0) && rng() < (opts.plataforma ? 1 : 0.4)) {
        const de = pecas[topoI].level || 0; const ci = new Set(casasDaPeca(pecas[topoI]).map(([x, y]) => kc(x, y)));
        const borda = [...ci].map(k => k.split(',').map(Number)).flatMap(([x, y]) => VIZ4.map(([dx, dy]) => [x + dx, y + dy])).filter(([x, y]) => !piso.has(kc(x, y)) && !ocup.has(kc(x, y)));
        for (let t = 0; t < 160 && borda.length; t++) {
          const rot = [0, 90, 180, 270][rng.int(0, 3)]; const b = rng.pick(borda); const cs = PECA.platform.cells.map(c => girar(c, rot)); const c = rng.pick(cs);
          const q = { tile: 'platform', pos: [b[0] - c[0], b[1] - c[1]], rot, level: CAIXAS.platform, pilares: [] }; const novas = casasDaPeca(q);
          if (!novas.every(([x, y]) => !piso.has(kc(x, y)) && !ocup.has(kc(x, y)) && !proibidas.has(kc(x, y)))) continue;
          if (novas.filter(([x, y]) => VIZ4.some(([dx, dy]) => ci.has(kc(x + dx, y + dy)))).length < 2) continue;
          pecas.push(q); refazPiso(); if (de === q.level) break;   // (level with the highest tile: walked onto)
          const o = de < q.level ? ligar(pecas.length - 1, de) : null;
          if (o) { subidas.push(o); break; }
          pecas.pop(); refazPiso();
        }
      }
    }
    // 4. an underlay on the floor (water, embers…), clear of the entry
    // (a rule of the map may ask for one: the water of a rising tide)
    if ((opts.alfombraForcada || []).length || rng() < (arq.alfombra || 0)) {
      const tipos = (opts.alfombraForcada || []).length ? opts.alfombraForcada : tema === 'ermo' ? ['underlay-water', 'underlay-fetidwater'] : tema === 'masmorra' ? ['underlay-embers', 'underlay-water', 'underlay-spikes'] : ['underlay-water', 'underlay-embers', 'underlay-fetidwater', 'underlay-spikes'];
      const usadas = t => p.salas.reduce((n, s) => n + s.pecas.filter(q => q.tile === t || (PAR_ALFOMBRA[q.tile] === t)).length, 0);
      const tipo = rng.pick(tipos.filter(t => PECA[t] && usadas(t) < 3));
      if (tipo) {
        const perto = new Set(); if (lig) VIZ8.concat([[0, 0]]).forEach(([dx, dy]) => perto.add(kc(lig.fora[0] + dx, lig.fora[1] + dy)));
        // it shows beside the tiles, widening the floor (at least half of it outside them, the rest slid under a tile at
        // ground level); never over another room nor right beside one, nor at the way in
        const baixas = [...piso.values()].filter(c => c.nivel === 0);
        const rente = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dy]) => ocup.has(kc(x + dx, y + dy)));
        for (let t = 0; t < 160 && !alfombra && baixas.length; t++) { const c = rng.pick(baixas); const rot = [0, 90, 180, 270][rng.int(0, 3)]; const q = { tile: tipo, pos: [c.x + rng.int(-3, 3), c.y + rng.int(-3, 3)], rot, level: 0, pilares: [] };
          const cs = casasDaPeca(q); if (!cs.length) continue;
          const sob = cs.filter(([x, y]) => piso.has(kc(x, y))), fora = cs.filter(([x, y]) => !piso.has(kc(x, y)));
          if (!sob.length || fora.length * 2 < cs.length) continue;
          if (sob.some(([x, y]) => piso.get(kc(x, y)).nivel !== 0)) continue;
          if (cs.some(([x, y]) => perto.has(kc(x, y)) || subidas.some(e => casasDoObjeto(e).some(([a, b]) => a === x && b === y)))) continue;
          if (fora.some(([x, y]) => rente(x, y))) continue;
          alfombra = q; }
      }
    }
  }
  // 4b. a bridge now and then (the Act II box has one: one per map): over the underlay (embers, spikes, water), from floor
  // to floor, or between two raised tiles of the same level, over the gap. One over an underlay may be fragile: a point of
  // interest beside it says so, and it breaks a few rounds after it is explored (the underlay below is still there to
  // cross, with its damage: nobody is left behind)
  let ponte = null, ponteFragil = false; const rngP = rngDe(opts.semente + '#ponte');   // (its own draws: rooms with no bridge come out as before)
  if (opts.ponte !== 'nao' && !(base && trava.pecas) && daCaixa('Bridge', atos) && !p.salas.some(s => s.objetos.some(o => ehTipo(o, 'Bridge')))) {
    const perto = new Set(); if (lig) VIZ8.concat([[0, 0]]).forEach(([dx, dy]) => perto.add(kc(lig.fora[0] + dx, lig.fora[1] + dy)));
    const naEscada = (x, y) => subidas.some(e => casasDoObjeto(e).some(([a, b]) => a === x && b === y));
    const pontas = cs => { const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]); const deitada = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
      const eixo = deitada ? 0 : 1; const mi = Math.min(...cs.map(c => c[eixo])), ma = Math.max(...cs.map(c => c[eixo]));
      return { a: cs.filter(c => c[eixo] === mi), b: cs.filter(c => c[eixo] === ma), meio: cs.filter(c => c[eixo] !== mi && c[eixo] !== ma), eixo, mi, ma }; };
    const livre = cs => cs.every(([x, y]) => !ocup.has(kc(x, y)) && !perto.has(kc(x, y)) && !naEscada(x, y));
    // the bridge column by column along its length: floor at both ends (one column or more), a gap of two or more columns
    // in the middle (nothing of the room there at that level), never half and half; the squares of the gap
    const vao = (o, piso1, gap1) => { const cs = casasDoObjeto(o); const pt = pontas(cs); const cols = [];
      for (let v = pt.mi; v <= pt.ma; v++) { const col = cs.filter(c => c[pt.eixo] === v); const f = col.every(([x, y]) => piso1(x, y)), g = col.every(([x, y]) => gap1(x, y)); cols.push(f ? 'F' : g ? 'G' : 'X'); }
      const sq = cols.join(''); if (!/^F+G{2,}F+$/.test(sq)) return null;
      const meio = cs.filter(c => cols[c[pt.eixo] - pt.mi] === 'G'); return { cs, meio }; };
    // over the underlay: its ends on the floor of the room, its middle over the gap between (a concave corner, a notch), where
    // an underlay shows: the one of the room, or one laid there for it
    const querBaixa = opts.ponte === 'baixa' || opts.ponte === 'fragil' || (opts.ponte !== 'alta' && rngP() < (alfombra ? 0.35 : 0.07));
    if (querBaixa) {
      const chao0 = (x, y) => { const c = piso.get(kc(x, y)); return c && c.nivel === 0; };
      const cands = []; let ilhaPosta = null;
      // (from the rim only: the last square of floor before a gap, along the bridge)
      const aBorda = (c, rot) => rot === 0 ? (!piso.has(kc(c.x + 1, c.y)) || !piso.has(kc(c.x - 1, c.y))) : (!piso.has(kc(c.x, c.y + 1)) || !piso.has(kc(c.x, c.y - 1)));
      const achar = () => { cands.length = 0; piso.forEach(c => { if (c.nivel !== 0) return; for (const rot of [0, 90]) { if (!aBorda(c, rot)) continue; for (const dy of [0, 1]) for (const dx of [0, 1, 2, 3]) {
        const o = { type: 'Bridge', pos: rot === 0 ? [c.x - dx, c.y - dy] : [c.x - dy, c.y - dx], rot, level: 0, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
        const v = vao(o, chao0, (x, y) => !piso.has(kc(x, y))); if (!v) continue;
        if (!livre(v.meio) || v.cs.some(([x, y]) => perto.has(kc(x, y)) || naEscada(x, y))) continue;
        cands.push({ o, meio: v.meio }); } } }); };
      achar();
      // none: an island. One more tile, a little away from the floor (a gap of two to four squares, where the underlay will
      // show), that only the bridge reaches dry-shod
      if (!cands.length && !pecas._so && (opts.ponte || rngP() < 0.4)) {
        const livresN = rngP.embaralhar(estoquePecas(p, tema, -1, atos, convivem)).filter(l => !pecas.some(q => numeroDaPeca(q.tile) === numeroDaPeca(l[0].id))).slice(0, 5);
        const baixas = [...piso.values()].filter(c => c.nivel === 0);
        const junto = (x, y) => VIZ8.some(([dx, dy]) => piso.has(kc(x + dx, y + dy)));
        let ilha = null, vaos = 0;
        for (let t = 0; t < 60 && !ilha && livresN.length && baixas.length; t++) {
          const c = rngP.pick(baixas); const rot = rngP.pick([0, 90]); const o = { type: 'Bridge', pos: rot === 0 ? [c.x - rngP.int(0, 5), c.y - rngP.int(0, 1)] : [c.x - rngP.int(0, 1), c.y - rngP.int(0, 5)], rot, level: 0 };
          const cs = casasDoObjeto(o); const pt = pontas(cs); const cols = [];
          for (let v = pt.mi; v <= pt.ma; v++) { const col = cs.filter(q => q[pt.eixo] === v); cols.push(col.every(([x, y]) => piso.get(kc(x, y))?.nivel === 0) ? 'F' : col.every(([x, y]) => !piso.has(kc(x, y))) ? 'G' : 'X'); }
          let sq = cols.join(''); let inv = false; if (/^G+F+$/.test(sq)) { sq = sq.split('').reverse().join(''); inv = true; }
          const m = /^(F+)(G{3,})$/.exec(sq); if (!m || ++vaos > 6) { if (vaos > 6) break; continue; } const gap = rngP.int(2, Math.min(4, m[2].length - 1)); const nF = m[1].length;
          const colDe = i => cs.filter(q => q[pt.eixo] === (inv ? pt.ma - i : pt.mi + i));
          const meio = []; for (let i = nF; i < nF + gap; i++) meio.push(...colDe(i)); const pouso = []; for (let i = nF + gap; i < 6; i++) pouso.push(...colDe(i));
          if (meio.some(([x, y]) => ocup.has(kc(x, y)) || proibidas.has(kc(x, y)) || perto.has(kc(x, y)))) continue;
          const pousoK = new Set(pouso.map(([x, y]) => kc(x, y))), meioK = new Set(meio.map(([x, y]) => kc(x, y)));
          for (const l of livresN) { if (ilha) break; const tile = rngP.pick(l); for (const r of rngP.embaralhar([0, 90, 180, 270])) { if (ilha) break;
            for (const c0 of rngP.embaralhar(tile.cells.map(q => girar(q, r))).slice(0, 8)) {
              const q = { tile: tile.id, pos: [pouso[0][0] - c0[0], pouso[0][1] - c0[1]], rot: r, level: 0, pilares: [] }; const qc = casasDaPeca(q); const qk = new Set(qc.map(([x, y]) => kc(x, y)));
              if (![...pousoK].every(k => qk.has(k))) continue;
              if (qc.some(([x, y]) => meioK.has(kc(x, y)) || piso.has(kc(x, y)) || ocup.has(kc(x, y)) || proibidas.has(kc(x, y)) || junto(x, y))) continue;
              ilha = q; break; } } }
        }
        if (ilha) { pecas.push(ilha); refazPiso(); achar(); ilhaPosta = ilha; }
      }
      const tipos = ['underlay-embers', 'underlay-spikes', 'underlay-water'].filter(t => PECA[t]);
      const usadas = t => p.salas.reduce((n, s) => n + s.pecas.filter(q => q.tile === t || (PAR_ALFOMBRA[q.tile] === t)).length, 0);
      const rente = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dy]) => ocup.has(kc(x + dx, y + dy)));
      for (const cand of rngP.embaralhar(cands)) {
        const sob = q => new Set(casasDaPeca(q).map(([x, y]) => kc(x, y)));
        const bemPosta = q => { const cs = casasDaPeca(q); const fora = cs.filter(([x, y]) => !piso.has(kc(x, y))).length; return fora < cs.length && fora * 2 >= cs.length; };   // (partly under a tile, at least half showing)
        if (alfombra) { const S = sob(alfombra); if (cand.meio.every(([x, y]) => S.has(kc(x, y))) && bemPosta(alfombra)) { ponte = cand.o; break; } }
        // an underlay under the middle of the bridge (it shows there, beside the tiles): the room's own, moved there, or a new one
        const tipo = alfombra ? alfombra.tile : rngP.pick(tipos.filter(t => usadas(t) < 3)); if (!tipo) break;
        let q = null;
        for (let t = 0; t < 60 && !q; t++) { const [mx, my] = rngP.pick(cand.meio); const r = { tile: tipo, pos: [mx + rngP.int(-3, 1), my + rngP.int(-3, 1)], rot: [0, 90, 180, 270][rngP.int(0, 3)], level: 0, pilares: [] };
          const cs = casasDaPeca(r); if (!cs.length) continue; const S = new Set(cs.map(([x, y]) => kc(x, y)));
          if (!cand.meio.every(([x, y]) => S.has(kc(x, y)))) continue;
          const fora = cs.filter(([x, y]) => !piso.has(kc(x, y))); if (cs.some(([x, y]) => piso.has(kc(x, y)) && piso.get(kc(x, y)).nivel !== 0)) continue;
          if (fora.length === cs.length || fora.length * 2 < cs.length) continue;   // (slid partly under a tile, at least half showing)
          if (fora.some(([x, y]) => rente(x, y) || perto.has(kc(x, y)) || naEscada(x, y))) continue;
          q = r; }
        if (q) { alfombra = q; ponte = cand.o; break; }
      }
      if (ilhaPosta && !ponte) { pecas.splice(pecas.indexOf(ilhaPosta), 1); refazPiso(); }   // (an island with no bridge to it goes back to the box)
      if (ponte && (opts.ponte === 'fragil' || (opts.ponte !== 'baixa' && rngP() < 0.1))) ponteFragil = true;   // (rare)
    }
    // between two raised tiles of the same level: its ends on both, the gap under its middle
    const niveisAltos = [...new Set([...piso.values()].filter(c => c.nivel > 0).map(c => c.nivel))];
    if (!ponte && niveisAltos.length && (opts.ponte === 'alta' || rngP() < 0.35)) {
      const cands = [];
      const aBordaA = (c, rot, L) => { const f = (x, y) => piso.get(kc(x, y))?.nivel === L; return rot === 0 ? (!f(c.x + 1, c.y) || !f(c.x - 1, c.y)) : (!f(c.x, c.y + 1) || !f(c.x, c.y - 1)); };
      niveisAltos.forEach(L => [...piso.values()].filter(c => c.nivel === L).forEach(c => { for (const rot of [0, 90]) { if (!aBordaA(c, rot, L)) continue; for (const dy of [0, 1]) for (const dx of [0, 1, 2, 3]) {
        const o = { type: 'Bridge', pos: rot === 0 ? [c.x - dx, c.y - dy] : [c.x - dy, c.y - dx], rot, level: L, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
        const em = (x, y) => { const q = piso.get(kc(x, y)); return !!q && q.nivel === L; };
        const v = vao(o, em, (x, y) => { const q = piso.get(kc(x, y)); return !q || q.nivel < L; }); if (!v) continue;
        const pt = pontas(v.cs); const pa = piso.get(kc(...pt.a[0])).peca, pb = piso.get(kc(...pt.b[0])).peca; if (pa === pb) continue;   // (between two tiles)
        if (!livre(v.meio.filter(([x, y]) => !piso.has(kc(x, y)))) || v.cs.some(([x, y]) => naEscada(x, y))) continue;
        cands.push(o); } } }));
      // none: a raised island at the same level, on pillars, a gap away from a raised tile; only the bridge reaches it
      if (!cands.length && (opts.ponte === 'alta' || rngP() < 0.3) && !pecas._so) {
        const TP = [null, 'PillarShort', 'Pillar', 'PillarTall']; const pil = pilaresLivres(p, convivem, atos); pecas.forEach(q => (q.pilares || []).forEach(x => { pil[x.type] = (pil[x.type] || 0) - 1; }));
        const livresN = rngP.embaralhar(estoquePecas(p, tema, -1, atos, convivem)).filter(l => !pecas.some(q => numeroDaPeca(q.tile) === numeroDaPeca(l[0].id))).slice(0, 5);
        const junto = (x, y) => VIZ8.some(([dx, dy]) => piso.has(kc(x + dx, y + dy))) || piso.has(kc(x, y));
        let ilha = null, pb = null, vaos = 0;
        for (let t = 0; t < 80 && !ilha && livresN.length; t++) {
          const L = rngP.pick(niveisAltos); const tp = TP[L]; if (!tp || (pil[tp] || 0) < 3) continue;
          const altos = [...piso.values()].filter(c => c.nivel === L); const c = rngP.pick(altos); const rot = rngP.pick([0, 90]);
          const o = { type: 'Bridge', pos: rot === 0 ? [c.x - rngP.int(0, 5), c.y - rngP.int(0, 1)] : [c.x - rngP.int(0, 1), c.y - rngP.int(0, 5)], rot, level: L, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
          const cs = casasDoObjeto(o); const pt = pontas(cs); const cols = [];
          for (let v = pt.mi; v <= pt.ma; v++) { const col = cs.filter(q => q[pt.eixo] === v); cols.push(col.every(([x, y]) => piso.get(kc(x, y))?.nivel === L) ? 'F' : col.every(([x, y]) => !piso.has(kc(x, y)) || piso.get(kc(x, y)).nivel < L) ? 'G' : 'X'); }
          let sq = cols.join(''); let inv = false; if (/^G+F+$/.test(sq)) { sq = sq.split('').reverse().join(''); inv = true; }
          const m = /^(F+)(G{3,})$/.exec(sq); if (!m || ++vaos > 6) { if (vaos > 6) break; continue; } const gap = rngP.int(2, Math.min(4, m[2].length - 1)); const nF = m[1].length;
          const colDe = i => cs.filter(q => q[pt.eixo] === (inv ? pt.ma - i : pt.mi + i));
          const meio = []; for (let i = nF; i < nF + gap; i++) meio.push(...colDe(i)); const pouso = []; for (let i = nF + gap; i < 6; i++) pouso.push(...colDe(i));
          if (pouso.some(([x, y]) => piso.has(kc(x, y)))) continue;
          if (meio.concat(pouso).some(([x, y]) => ocup.has(kc(x, y)) || proibidas.has(kc(x, y)) || perto.has(kc(x, y))) || cs.some(([x, y]) => naEscada(x, y) || VIZ4.some(([dx, dy]) => naEscada(x + dx, y + dy)))) continue;
          const pousoK = new Set(pouso.map(([x, y]) => kc(x, y))), meioK = new Set(meio.map(([x, y]) => kc(x, y)));
          for (const l of livresN) { if (ilha) break; const tile = rngP.pick(l); for (const r of rngP.embaralhar([0, 90, 180, 270])) { if (ilha) break;
            for (const c0 of rngP.embaralhar(tile.cells.map(q => girar(q, r))).slice(0, 8)) {
              const q = { tile: tile.id, pos: [pouso[0][0] - c0[0], pouso[0][1] - c0[1]], rot: r, level: L, pilares: [] }; const qc = casasDaPeca(q); const qk = new Set(qc.map(([x, y]) => kc(x, y)));
              if (![...pousoK].every(k => qk.has(k))) continue;
              if (qc.some(([x, y]) => meioK.has(kc(x, y)) || ocup.has(kc(x, y)) || proibidas.has(kc(x, y)) || (!pousoK.has(kc(x, y)) && junto(x, y)) || naEscada(x, y))) continue;
              // its pillars: up to four sockets, spread out
              const soq = [...encaixesDaPeca(q)].map(v => v.split(',').map(Number)); const quer = Math.min(4, soq.length, pil[tp]); if (quer < 3) continue;
              const esc = []; while (esc.length < quer) { let mv = null, dm = -1; soq.forEach(v => { if (esc.some(e => e[0] === v[0] && e[1] === v[1])) return; const d = esc.length ? Math.min(...esc.map(e => Math.abs(e[0] - v[0]) + Math.abs(e[1] - v[1]))) : rngP(); if (d > dm) { dm = d; mv = v; } }); if (!mv) break; esc.push(mv); }
              q.pilares = esc.map(v => ({ pos: v, type: tp })); ilha = q; pb = o; break; } } }
        }
        if (ilha) { pecas.push(ilha); refazPiso(); ponte = pb; }
      }
      if (!ponte && cands.length) ponte = rngP.pick(cands);
    }
  }
  // the entry: the square beyond the edge, or the hero spaces of a starting room
  const ch0 = new Map(piso); subidas.forEach(escada => casasDoObjeto(escada).forEach(([x, y]) => { const a = ch0.get(kc(x, y)); ch0.set(kc(x, y), { ...(a || {}), x, y, nivel: escada.level || 0, escada: true }); }));
  if (lig) entrada = [lig.fora];
  else if (!(base && trava.pecas)) {
    // hero spaces: four free squares on the floor, at the edge farthest from the middle
    const cells = [...piso.values()].filter(c => c.nivel === 0 && !ch0.get(kc(c.x, c.y))?.escada);
    const cx = cells.reduce((s, c) => s + c.x, 0) / cells.length, cy = cells.reduce((s, c) => s + c.y, 0) / cells.length;
    const bordas = cells.filter(c => VIZ4.some(([dx, dy]) => !piso.has(kc(c.x + dx, c.y + dy))));
    const ponta = bordas.sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy))[rng.int(0, Math.min(3, bordas.length - 1))] || cells[0];
    herois = cells.slice().sort((a, b) => (Math.abs(a.x - ponta.x) + Math.abs(a.y - ponta.y)) - (Math.abs(b.x - ponta.x) + Math.abs(b.y - ponta.y))).slice(0, 4).map(c => [c.x, c.y, 0]);
  }
  if (!lig) entrada = herois.map(h => [h[0], h[1]]);
  const sala = { nome: '', texto: '', pecas: pecas.concat(alfombra ? [alfombra] : []), objetos: subidas.slice().concat(ponte ? [ponte] : []), inimigos: [], herois, objetivos: [], reserva: { add: [], remove: [] }, abertaPor: [], funcao: opts.funcao || (arq.funcoes || [])[0] || '', arquetipo: arq.id };
  if (base && trava.pecas) { sala.pecas = clone(base.sala.pecas); sala.objetos = subidas.map(clone).concat(base.sala.objetos.filter(o => ehTipo(o, 'Bridge')).map(o => ({ ...clone(o), gatilhos: [] }))); }
  // the map as it would be with this room (to measure it and check it)
  const pTemp = () => ({ ...p, salas: p.salas.map((s, i) => abridor && i === abridor.sala ? { ...s, objetos: s.objetos.concat(abridor.moldura ? [abridor.moldura] : [], [{ ...abridor.objeto, gatilhos: [{ uid: 'tmp', tipo: 'open_room', sala: idx, requisitos: [] }] }], abridor.gemeo ? [abridor.gemeo] : []) } : s).concat([sala]) });
  // 5. the objects
  const temTema = t => (!temaObj.objetos || temaObj.objetos.includes(t)) && daCaixa(t, atos);
  const escala = { poucos: 0.6, normal: 1, muitos: 1.5 }[opts.objetos || 'normal'] || 1;
  if (base && trava.objetos && trava.pecas) sala.objetos = clone(base.sala.objetos);
  else {
    const lista = []; Object.entries(arq.objetos?.base || {}).forEach(([t, n]) => { for (let i = 0; i < n; i++) lista.push(t); });
    Object.entries(arq.objetos?.extras || {}).forEach(([t, [a, b]]) => { if (!temTema(t) || !OBJETO[t]) return; const n = rng.int(a, b); for (let i = 0; i < n; i++) lista.push(t); });
    // the theme's own pieces: one or two now and then, so every kind of terrain shows up somewhere
    const decor = (temaObj.decor || []).filter(t => OBJETO[t] && daCaixa(t, atos) && temTema(t)); for (let k = rng.int(0, 2); k > 0 && decor.length; k--) lista.push(rng.pick(decor));
    const tot = Math.max(arq.objetos?.total?.[0] || 0, Math.min(Math.round((arq.objetos?.total?.[1] || 4) * escala), Math.round(lista.length * escala)));
    const escolhidos = lista.slice(0, Object.values(arq.objetos?.base || {}).reduce((a, b) => a + b, 0)).concat(rng.embaralhar(lista.slice(Object.values(arq.objetos?.base || {}).reduce((a, b) => a + b, 0)))).slice(0, Math.max(tot, Object.values(arq.objetos?.base || {}).reduce((a, b) => a + b, 0)));
    // the Workshop's own objects take the place of an interaction token now and then
    // (only those with a default script that does something: an object with no programming would sit there saying nothing)
    const proprios = daOficina(atos).objetos.filter(v => padraoPortatil(v.id)); const it = escolhidos.indexOf('InteractToken');
    if (proprios.length && it >= 0 && rng() < 0.5) escolhidos[it] = rng.pick(proprios).id;
    const naMesa = [...new Set(convivem.concat([idx]))];
    for (const t of escolhidos) { if (!daCaixa(t, atos) || objetoLivre(pTemp(), naMesa, t, atos) <= 0) continue; const o = porObjeto(t, sala, idx, entrada, rng, pTemp); if (o) sala.objetos.push(o); }
    if (arq.id !== 'abertura') noAlto(sala, idx, entrada, rng, pTemp, naMesa, atos);   // (the opening room stays bare)
    textosDosObjetos(sala, arq, rng, p, idx > 0 && !lig && (opts.inimigos || 'balanceado') !== 'nenhum', opts.tagsRoupas || { t: tema !== 'qualquer' ? tema : null, a: atos });
  }
  // 6. the monsters
  const modoIni = opts.inimigos || 'balanceado';
  // the boss comes from the map's pool, or from the Workshop's bosses and monsters while the pool is empty
  const pool = (p.reserva || []).filter(id => monstro(id)).concat((p.reserva || []).some(id => monstro(id)) ? [] : (() => { const of = daOficina(atos); return of.chefes.concat(of.monstros).map(m => m.id); })());
  if (base && trava.inimigos && trava.pecas) { sala.inimigos = clone(base.sala.inimigos); sala.intensidade = base.sala.intensidade; }
  else if (modoIni !== 'nenhum' && (arq.inimigos?.como || 'sala') !== 'nenhum') {
    const n = modoIni === 'escolhidos' ? (opts.escolhidos || []).length : rng.int(arq.inimigos.espacos[0], arq.inimigos.espacos[1]);
    const casas = casasDeInimigos(sala, idx, entrada, n + (arq.inimigos.chefe ? 1 : 0), arq.inimigos, rng, pTemp);
    let lista = casas.map(c => ({ enemy: POOL_ID, pos: [c.x, c.y], level: c.nivel }));
    if (modoIni === 'escolhidos') lista = casas.slice(0, n).map((c, i) => ({ enemy: opts.escolhidos[i], pos: [c.x, c.y], level: c.nivel, tier: Math.max(1, Math.min(4, Math.round((opts.intensidade || 5) / 3))) }));
    if (arq.inimigos.chefe && casas.length) { // the strongest of the pool, at the back
      const chefe = pool.map(monstro).filter(m => m && (m.act || 0) < atos).sort((a, b) => (b.villain ? 2 : 0) + (b.named ? 1 : 0) + (b.tiers?.length || 0) * 0.1 - ((a.villain ? 2 : 0) + (a.named ? 1 : 0) + (a.tiers?.length || 0) * 0.1))[0];
      const c = casas[casas.length - 1]; if (chefe && modoIni !== 'escolhidos') lista[lista.length - 1] = { enemy: chefe.id, pos: [c.x, c.y], level: c.nivel, tier: Math.max(2, Math.min(4, Math.round((opts.intensidade || 6) / 2.5))) };
    }
    if (arq.inimigos.como === 'armadilha' && idx > 0) {
      // the trap: the monsters come from the sides a round after the room opens (the opener counts the round); a room
      // with no opener of its own: its token (the bait) brings them
      const spawn = { uid: uid(), tipo: 'spawn', fonte: lista.every(e => ehPool(e.enemy)) ? 'pool' : 'list', cells: lista.filter(e => ehPool(e.enemy)).map(e => [e.pos[0], e.pos[1], e.level || 0]), inimigos: lista.filter(e => !ehPool(e.enemy)), intensidade: opts.intensidade || 0, requisitos: [] };
      if (lig && lista.length) { const g = { uid: uid(), tipo: 'rounds', modo: 'uma', n: 1, vezes: 0, requisitos: [] };
        aoAbrir.gatilhos.push(g); aoAbrir.listas['rodada:' + g.uid] = [gatilhoTexto(T2(rng.pick(TEXTOS_EMBOSCADA))), spawn]; lista = []; }
      else { const tok = sala.objetos.find(o => o._isca) || sala.objetos.find(o => ehTipo(o, 'InteractToken'));
        if (tok && lista.length) { tok.gatilhos = (tok.gatilhos || []).concat([spawn]); lista = []; } }
    }
    sala.inimigos = lista;
    if (lista.some(e => ehPool(e.enemy)) || arq.inimigos.como === 'armadilha') sala.intensidade = Math.max(1, Math.min(10, opts.intensidade || 5));
  }
  // 6b. cover in a fight: a few objects between the way in and the monsters (a barricade, a statue, a wagon…), so the heroes
  // go round, take cover or push through, instead of a straight line of blows. Never cutting anything off. Its own draws
  if (!(base && trava.objetos) && !['respiro', 'abertura'].includes(arq.id) && (sala.inimigos || []).length && entrada.length) {
    const rngC = rngDe(opts.semente + '#cobertura'); const ch = chaoDaSala(idx, pTemp());
    const mon = sala.inimigos.map(e => e.pos); const mx = mon.reduce((a, c) => a + c[0], 0) / mon.length, my = mon.reduce((a, c) => a + c[1], 0) / mon.length;
    const ex = entrada.reduce((a, c) => a + c[0], 0) / entrada.length, ey = entrada.reduce((a, c) => a + c[1], 0) / entrada.length;
    const vx = mx - ex, vy = my - ey, L2v = vx * vx + vy * vy;
    const tipos = ['Barricade', 'Statue', 'StoneTable', 'Wagon', 'Tree', 'Cauldron', 'Well', 'Fire'].filter(t => OBJETO[t] && temTema(t) && objetoLivre(p, convivem, t, atos) - sala.objetos.filter(o => o.type === t).length > 1);   // (one of each kind stays in the box for the rooms ahead)
    if (L2v >= 16 && tipos.length) {
      const tomadas = new Set(); sala.objetos.forEach(o => casasDoObjeto(o).forEach(([x, y]) => tomadas.add(kc(x, y)))); mon.forEach(([x, y]) => VIZ8.concat([[0, 0]]).forEach(([dx, dy]) => tomadas.add(kc(x + dx, y + dy))));
      entrada.forEach(([x, y]) => VIZ8.concat([[0, 0]]).forEach(([dx, dy]) => tomadas.add(kc(x + dx, y + dy)))); (sala.herois || []).forEach(h => VIZ8.concat([[0, 0]]).forEach(([dx, dy]) => tomadas.add(kc(h[0] + dx, h[1] + dy))));
      const livre = c => c && !c.alfombra && !c.escada && !c.ponte && !c.muro && !c.degrau && !c.bloqueia && !tomadas.has(kc(c.x, c.y));
      const meio = [...ch.values()].filter(c => { if (!livre(c)) return false; const t = ((c.x - ex) * vx + (c.y - ey) * vy) / L2v; const perp = Math.abs((c.x - ex) * vy - (c.y - ey) * vx) / Math.sqrt(L2v); return t >= 0.3 && t <= 0.75 && perp <= 2.5; });
      const quer = Math.min(3, 1 + Math.floor(ch.size / 30) + (rngC() < 0.4 ? 1 : 0));
      let postos = 0;
      for (let t = 0; t < 14 && postos < quer && meio.length; t++) {
        const c = rngC.pick(meio); const tipo = rngC.pick(tipos); const o = { type: tipo, pos: [c.x, c.y], rot: rngC.pick([0, 90]), level: c.nivel, name: '', textClick: textoDeOlhar(tipo, rngC), textUse: '', gatilhos: [], requisitos: [], senao: [] };
        if (!casasDoObjeto(o).every(([x, y]) => { const k = ch.get(kc(x, y)); return livre(k) && k.nivel === c.nivel; })) continue;
        sala.objetos.push(o);
        if (foraDeAlcance(idx, pTemp(), entrada).length) { sala.objetos.pop(); continue; }   // (nothing cut off)
        casasDoObjeto(o).forEach(([x, y]) => VIZ8.concat([[0, 0]]).forEach(([dx, dy]) => tomadas.add(kc(x + dx, y + dy)))); postos++;
      }
    }
  }
  // the fragile bridge: a point of interest at its end, on the side of the way in, warns it; explored, the hero who explored
  // it calls the others across (a scene), and some rounds later the bridge gives way into the underlay (a text says so)
  if (ponte && ponteFragil && sala.objetos.includes(ponte)) {
    const ch = chaoDaSala(idx, pTemp()); const d = distancias(ch, entrada);
    const tomadas = new Set(); sala.objetos.forEach(o => casasDoObjeto(o).forEach(([x, y]) => tomadas.add(kc(x, y)))); (sala.inimigos || []).forEach(e => tomadas.add(kc(e.pos[0], e.pos[1])));
    const cs = casasDoObjeto(ponte); const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]); const eixo = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys) ? 0 : 1;
    const mi = Math.min(...cs.map(c => c[eixo])), ma = Math.max(...cs.map(c => c[eixo]));
    const lados = [cs.filter(c => c[eixo] === mi), cs.filter(c => c[eixo] === ma)].sort((A, B) => Math.min(...A.map(([x, y]) => d.get(kc(x, y)) ?? 999)) - Math.min(...B.map(([x, y]) => d.get(kc(x, y)) ?? 999)));
    const junto = []; lados[0].forEach(([x, y]) => VIZ8.forEach(([dx, dy]) => { const c = ch.get(kc(x + dx, y + dy)); if (c && c.nivel === 0 && !c.alfombra && !c.ponte && !c.muro && !c.bloqueia && !c.escada && !c.degrau && !tomadas.has(kc(c.x, c.y)) && d.has(kc(c.x, c.y)) && !(sala.herois || []).some(h => Math.max(Math.abs(h[0] - c.x), Math.abs(h[1] - c.y)) <= 1)) junto.push(c); }));   // (never beside where the heroes start)
    const lugar = junto.sort((a, b) => d.get(kc(a.x, a.y)) - d.get(kc(b.x, b.y)))[0];
    if (lugar) {
      const oQue = /embers/.test(alfombra.tile) ? L2('the embers', 'as brasas') : /spikes/.test(alfombra.tile) ? L2('the spikes', 'os espinhos') : /fetid/.test(alfombra.tile) ? L2('the fetid water', 'a água fétida') : L2('the water', 'a água');
      const n = rngP.int(2, 3);
      const cx = (id, t, next) => ({ id, type: 'normal', speaker: '@actor', title: '', text: t, cast: ['@hero1'], background: FUNDO_DO_TEMA[opts.tema] ?? FUNDO_PADRAO, next, options: [] });
      const cena = { uid: uid(), tipo: 'scene', inicio: 's1', requisitos: [], caixas: [
        cx('s1', L2('This bridge will not hold for long: the boards are splitting under my feet!', 'Esta ponte não vai aguentar muito: as tábuas estão rachando sob os meus pés!'), 's2'),
        cx('s2', L2('Everyone across, now! We have ' + n + ' rounds at most before it falls into ' + oQue + '!', 'Todos para o outro lado, agora! Temos ' + n + ' rodadas, no máximo, antes que ela caia sobre ' + oQue + '!'), '')] };
      const rodadas = { uid: uid(), tipo: 'rounds', modo: 'uma', n, requisitos: [] };
      const poi = { type: 'SightToken', pos: [lugar.x, lugar.y], rot: 0, level: 0, name: L2('Fragile bridge', 'Ponte frágil'),
        textClick: L2('The bridge creaks and sways over ' + oQue + '. It looks ready to give way.', 'A ponte range e balança sobre ' + oQue + '. Parece prestes a ceder.'),
        textUse: L2('The bridge is fragile: it will break in ' + n + ' rounds. Whoever has not crossed by then will have to go through ' + oQue + '.', 'A ponte é frágil: vai quebrar em ' + n + ' rodadas. Quem não tiver passado até lá vai ter de atravessar ' + oQue + '.'),
        gatilhos: [cena, rodadas, autoRemocao()], requisitos: [], senao: [] };
      sala.objetos.push(poi);
      poi['rodada:' + rodadas.uid] = [{ uid: uid(), tipo: 'remove_object', objSala: idx, objIndex: sala.objetos.indexOf(ponte), requisitos: [] },
        txtT('With a long crack, the bridge gives way and falls into ' + oQue + '. From now on, the only way across is through ' + oQue + ', and it hurts.', 'Com um estalo longo, a ponte cede e cai sobre ' + oQue + '. Daqui em diante, o único caminho é por ' + oQue + ', e isso dói.')];
      ponte.name = L2('Fragile bridge', 'Ponte frágil');
    }
  }
  // 7. texts and triggers
  const lugar = (temaObj.lugar || TEMAS_SALA.qualquer.lugar)[LP()];
  const txts = (arq.textos || {})[LP()] || (arq.textos || {}).en || [''];
  sala.texto = idx > 0 ? rng.pick(txts).replace('{tema}', lugar).replace('{Tema}', lugar.charAt(0).toUpperCase() + lugar.slice(1)) : '';
  sala.nome = (L2(arq.nome, tr(arq.nome)) || arq.id);
  sala.textoDepois = textoDepoisDe(sala); sala.objetos.forEach(o => { delete o._revela; delete o._isca; });
  if (abridor) abridor.objeto.gatilhos = [{ uid: uid(), tipo: 'open_room', sala: idx, requisitos: [] }].concat(abridor.objeto.type === 'SightToken' ? [autoRemocao()] : []);
  // 8. measure and check
  const pt = pTemp(); const med = medirSala(idx, pt, opts.dono ? entrada : null) || {};
  const problemas = validarSalaGerada(sala, idx, pt, entrada, lig, !(base && trava.pecas), [...portaK], convivem);
  // a bridge that spoiled the room (not asked for): the room again, the same, with no bridge
  if (problemas.length && ponte && !opts.ponte) return gerarSala({ ...opts, ponte: 'nao' });
  const nota = problemas.length ? 0 : notaDaSala(med, arq);
  return { sala, abridor, aoAbrir, dono: opts.dono || null, abertura: [...portaK].map(k => k.split(',').map(Number)), escada: subidas[0] || null, subidas, alfombra, entrada, medidas: med, problemas, nota, frase: fraseDaSala(med, arq), arquetipo: arq.id, semente: opts.semente, forma, ligacao: lig, opcoes: { tamanho: opts.tamanho, tema, intensidade: opts.intensidade, atos } };
}
const PAR_ALFOMBRA = { 'underlay-water': 'underlay-spikes', 'underlay-spikes': 'underlay-water', 'underlay-embers': 'underlay-fetidwater', 'underlay-fetidwater': 'underlay-embers' };

/* where an object of a kind goes in the room being built; null when it fits nowhere */
const OBJ_PAREDE = new Set(['Chest', 'Shelf', 'Lectern', 'Statue', 'Bell', 'BloodShrine']);
/* a door (or gate) standing in the middle of an archway: its two squares are the archway's middle */
function portaNoArco(arco, tipo) {
  const meio = meioDoArco(arco).meio; const alvo = new Set(meio.map(([x, y]) => kc(x, y)));
  for (const pos of meio) for (const rot of [arco.rot || 0, ((arco.rot || 0) + 180) % 360]) {
    const o = { type: tipo, pos: [pos[0], pos[1]], rot, level: arco.level || 0 }; const cs = casasDoObjeto(o);
    if (cs.length === 2 && cs.every(([x, y]) => alvo.has(kc(x, y)))) return o; }
  return null;
}
/* an archway: four squares in a row; the heroes pass through the two in the middle, the two at the ends are its feet */
function meioDoArco(o) { const cs = casasDoObjeto(o).slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); return { meio: cs.slice(1, 3), pes: [cs[0], cs[cs.length - 1]], n: (o.rot || 0) % 180 === 0 ? [0, 1] : [1, 0] }; }
/* modoArco: 'passagem' (an archway inside the room: floor on both sides of its middle, best with its feet on the walls)
   or 'saida' (a way out: at the edge, floor on one side of its middle and open ground on the other) */
/* longe: { casas, min }: every square of the object at least min squares (as the heroes count: a diagonal is one) from each
   of those squares (a way back: never next to where it leads) */
function porObjeto(tipo, sala, idx, entrada, rng, pTemp, modoArco = 'passagem', longe = null) {
  const pt = pTemp(); const arco = ehArcoTipo(tipo); const ocupMapa = arco ? casasOcupadas(pt, idx) : null; const ch = chaoDaSala(idx, pt); const dist = distancias(ch, entrada); const maxd = Math.max(1, ...dist.values());
  const perto = new Set(); entrada.forEach(([x, y]) => VIZ8.concat([[0, 0]]).forEach(([dx, dy]) => perto.add(kc(x + dx, y + dy))));
  const ocupadas = new Set(); sala.objetos.forEach(o => casasDoObjeto(o).forEach(([x, y]) => ocupadas.add(kc(x, y)))); (sala.herois || []).forEach(h => ocupadas.add(kc(h[0], h[1])));
  // nothing on a monster, placed or entering by a trigger
  (sala.inimigos || []).forEach(e => ocupadas.add(kc(e.pos[0], e.pos[1]))); sala.objetos.concat(sala.grupoPool ? [sala.grupoPool] : []).forEach(o => todosGatilhos(o).forEach(g => { if (g.tipo === 'spawn') (g.cells || []).concat((g.inimigos || []).map(e => e.pos)).forEach(c => ocupadas.add(kc(c[0], c[1]))); }));
  const paredes = c => VIZ8.filter(([dx, dy]) => !ch.has(kc(c.x + dx, c.y + dy))).length;
  const faixa = { Chest: [0.55, 1], Shelf: [0.2, 1], Lectern: [0.3, 1], Statue: [0.4, 1], SightToken: [0.35, 0.85], InteractToken: [0.25, 0.75] }[tipo] || [0.3, 0.8];
  const bl = bloqueio({ type: tipo });
  let fa = null; const foraAntes = () => fa ?? (fa = foraDeAlcance(idx, pt, entrada).length);
  const livresAntes = [...ch.values()].filter(c => !c.bloqueia).length;
  let melhor = null, nm = -Infinity;
  const cells = rng.embaralhar([...ch.values()].filter(c => !c.alfombra && !c.escada && !c.ponte && !c.muro && !c.degrau && !c.bloqueia && dist.has(kc(c.x, c.y)))).slice(0, arco ? 400 : 40);
  for (const c of cells) for (const rot of (defObj(tipo)?.w || 1) > 1 || (defObj(tipo)?.h || 1) > 1 ? [0, 90] : [0]) {
    // (an archway: the square tried is the first of its middle; its feet may hang off the tiles, never on another room)
    const o = { type: tipo, pos: arco ? (rot === 0 ? [c.x - 1, c.y] : [c.x, c.y - 1]) : [c.x, c.y], rot, level: c.nivel, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
    const cs = casasDoObjeto(o); const pes = arco ? new Set(meioDoArco(o).pes.map(([x, y]) => kc(x, y))) : new Set();
    if (!cs.every(([x, y]) => { const k = ch.get(kc(x, y)); if (!k && pes.has(kc(x, y))) return !ocupMapa.has(kc(x, y)) && !ocupadas.has(kc(x, y)); return k && !k.alfombra && !k.escada && !k.degrau && !k.bloqueia && k.nivel === c.nivel && !ocupadas.has(kc(x, y)) && !(bl.move && perto.has(kc(x, y))); })) continue;
    if (cs.some(([x, y]) => entrada.some(e => e[0] === x && e[1] === y))) continue;
    if (longe && cs.some(([x, y]) => longe.casas.some(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) < longe.min))) continue;
    let extra = 0;
    if (arco) { const a = meioDoArco(o); const livre = (x, y) => { const k = ch.get(kc(x, y)); return k && !k.bloqueia && !k.escada && k.nivel === c.nivel && !ocupadas.has(kc(x, y)); };
      if (modoArco === 'saida') { if (![1, -1].some(sg => a.meio.every(([x, y]) => livre(x - a.n[0] * sg, y - a.n[1] * sg) && !ch.has(kc(x + a.n[0] * sg, y + a.n[1] * sg)) && !ocupMapa.has(kc(x + a.n[0] * sg, y + a.n[1] * sg))))) continue; }
      else { if (!a.meio.every(([x, y]) => livre(x + a.n[0], y + a.n[1]) && livre(x - a.n[0], y - a.n[1]))) continue;
        extra = a.pes.filter(([x, y]) => !ch.has(kc(x + a.n[0], y + a.n[1])) || !ch.has(kc(x - a.n[0], y - a.n[1]))).length * 0.6; } }
    const d = dist.get(kc(c.x, c.y)) / maxd;
    let n = -Math.abs(d - (faixa[0] + faixa[1]) / 2) * 2 + (d >= faixa[0] && d <= faixa[1] ? 1 : 0) + rng() * 0.4;
    n += extra; if (OBJ_PAREDE.has(tipo)) n += Math.min(3, paredes(c)) * 0.35; else if (bl.move) n -= paredes(c) * 0.2;
    // spread: away from the other objects
    const dmin = Math.min(9, ...sala.objetos.filter(x => !ehTerreno(x)).map(x => Math.abs(x.pos[0] - c.x) + Math.abs(x.pos[1] - c.y))); n += Math.min(dmin, 4) * 0.12;
    if (n <= nm) continue;
    if (bl.move || arco) { // nothing may be cut off: every free square still reachable from the entry (an archway's feet block too)
      const salaT = { ...sala, objetos: sala.objetos.concat([o]) }; const pt2 = { ...pt, salas: pt.salas.map((s, i) => i === idx ? salaT : s) };
      const ch2 = chaoDaSala(idx, pt2); const d2 = distancias(ch2, entrada); const livres = [...ch2.values()].filter(k => !k.bloqueia).length;
      if (d2.size < livres || livres < livresAntes - cs.length) continue;
      // …and every object of the room (doors to other rooms included) still has a square the heroes reach, on it or next to it
      if (foraDeAlcance(idx, pt2, entrada).length > foraAntes()) continue; }
    nm = n; melhor = o;
  }
  // a piece with a front (a chest, a shelf…) turns its back to the wall: in the game it faces north at rotation 0
  if (melhor && OBJ_PAREDE.has(tipo)) { const w1 = (defObj(tipo)?.w || 1) === (defObj(tipo)?.h || 1);
    const costas = r => [[0, 1], [-1, 0], [0, -1], [1, 0]][((r % 360) + 360) % 360 / 90];
    const nota = r => { const o = { ...melhor, rot: r }; const [bx, by] = costas(r); return casasDoObjeto(o).filter(([x, y]) => !ch.has(kc(x + bx, y + by))).length; };
    const giros = w1 ? [0, 90, 180, 270] : [melhor.rot, (melhor.rot + 180) % 360];
    melhor.rot = giros.reduce((a, r) => nota(r) > nota(a) ? r : a, giros.includes(melhor.rot) ? melhor.rot : giros[0]); }
  if (melhor) melhor.textClick = textoDeOlhar(tipo, rng);
  return melhor;
}
/* the squares of the monsters: at the wanted distance from the entry, in the wanted pattern, spread out */
function casasDeInimigos(sala, idx, entrada, n, regra, rng, pTemp) {
  if (n <= 0) return [];
  const pt = pTemp(); const ch = chaoDaSala(idx, pt); const dist = distancias(ch, entrada);
  const ocupadas = new Set(); sala.objetos.forEach(o => casasDoObjeto(o).forEach(([x, y]) => ocupadas.add(kc(x, y)))); (sala.herois || []).forEach(h => ocupadas.add(kc(h[0], h[1])));
  const maxd = Math.max(0, ...dist.values());
  let [a, b] = regra.distancia || [2, 6]; if (maxd < a) { a = Math.max(2, Math.floor(maxd * 0.6)); b = maxd; } b = Math.min(b, maxd);
  let cands = [...ch.values()].filter(c => !c.alfombra && !c.bloqueia && !c.escada && !c.ponte && !c.muro && !c.degrau && !ocupadas.has(kc(c.x, c.y)) && dist.has(kc(c.x, c.y)) && dist.get(kc(c.x, c.y)) >= Math.max(2, a) && dist.get(kc(c.x, c.y)) <= Math.max(a, b));
  if (cands.length < n) cands = [...ch.values()].filter(c => !c.alfombra && !c.bloqueia && !c.escada && !c.ponte && !c.muro && !c.degrau && !ocupadas.has(kc(c.x, c.y)) && (dist.get(kc(c.x, c.y)) || 0) >= 2);
  const e0 = entrada[0] || [0, 0]; const cx = cands.reduce((s, c) => s + c.x, 0) / Math.max(1, cands.length), cy = cands.reduce((s, c) => s + c.y, 0) / Math.max(1, cands.length);
  const eixo = [cx - e0[0], cy - e0[1]]; const lado = c => Math.sign((c.x - e0[0]) * eixo[1] - (c.y - e0[1]) * eixo[0]);
  const nota = c => { const d = dist.get(kc(c.x, c.y)) || 0; switch (regra.padrao) { case 'fundo': return d * 2 + rng(); case 'centro': return -Math.hypot(c.x - cx, c.y - cy) + rng(); case 'flancos': return Math.abs(lado(c)) * 3 + rng() * 2 - Math.abs(d - (a + b) / 2); default: return rng() * 3; } };
  const r = [];
  const ordem = cands.slice().sort((x, y) => nota(y) - nota(x));
  while (r.length < n && ordem.length) {
    // the next: good by the pattern and not next to the ones already placed (flanks alternate sides)
    let i = ordem.findIndex(c => !r.some(q => Math.max(Math.abs(q.x - c.x), Math.abs(q.y - c.y)) < 2) && (regra.padrao !== 'flancos' || !r.length || lado(c) !== lado(r[r.length - 1]) || r.length >= 2));
    if (i < 0) i = ordem.findIndex(c => !r.some(q => q.x === c.x && q.y === c.y)); if (i < 0) break;
    r.push(ordem.splice(i, 1)[0]);
  }
  if (regra.chefe) r.sort((x, y) => (dist.get(kc(x.x, x.y)) || 0) - (dist.get(kc(y.x, y.y)) || 0));
  return r;
}
/* The objects' content, as in the original maps:
   - a point of interest (SightToken) reveals new parts of the map: the generator uses it only to open rooms; it fires as
     soon as it is tapped (no action) and leaves the board;
   - an interaction token (InteractToken) is a thing or a person in the room: tapped, it says what it is; the text shown
     after the room is set up (textoDepois) presents it; used by a hero (an action), it does something;
   - trees, shelves, wells, cauldrons and wagons can be searched in three ways, each with its own outcome.
   Each text has an English and a Portuguese version: {en, pt}. */
const FICHAS_INTERACAO = [
  { olhar: { en: 'A wounded traveller, slumped against the wall.', pt: 'Um viajante ferido, caído contra a parede.' },
    revela: { en: 'Against a wall, a wounded traveller lies slumped, breathing hard.', pt: 'Encostado numa parede, um viajante ferido respira com dificuldade.' },
    uso: { en: 'The traveller grips your arm. "They went deeper in… and they were not alone."', pt: 'O viajante agarra seu braço. "Eles foram mais para dentro… e não estavam sozinhos."' },
    gasto: { en: 'The wounded traveller, who has told you what he knows.', pt: 'O viajante ferido, que já contou o que sabia.' } },
  { olhar: { en: 'An old man lying on a pallet, too weak to stand.', pt: 'Um velho deitado num catre, fraco demais para ficar de pé.' },
    revela: { en: 'In a corner of the room, an old man lies on a pallet.', pt: 'Num canto da sala, um velho está deitado num catre.' },
    uso: { en: '"You came… Take this. It is no use to me now."', pt: '"Vocês vieram… Levem isto. Já não me serve de nada."' }, item: true,
    gasto: { en: 'The old man on his pallet, who gave you what he had.', pt: 'O velho no catre, que já deu o que tinha.' } },
  { olhar: { en: 'Old writing carved into the stone.', pt: 'Escrita antiga entalhada na pedra.' },
    revela: { en: 'Part of a wall is covered in old carvings.', pt: 'Parte de uma parede está coberta de entalhes antigos.' },
    uso: { en: 'The carvings warn of a guardian that never sleeps. You commit the warning to memory.', pt: 'Os entalhes avisam de um guardião que nunca dorme. Vocês guardam o aviso na memória.' },
    gasto: { en: 'The old carvings, whose warning you already know.', pt: 'Os entalhes antigos, cujo aviso vocês já conhecem.' } },
  { olhar: { en: 'A body, still clutching a note.', pt: 'Um corpo, ainda segurando um bilhete.' },
    revela: { en: 'A body lies on the floor, a note still in its hand.', pt: 'Um corpo jaz no chão, com um bilhete ainda na mão.' },
    uso: { en: 'The note reads: "Do not trust the silence." Its purse is still full.', pt: 'O bilhete diz: "Não confiem no silêncio." A bolsa ainda está cheia.' }, item: true, ouro: 10,
    gasto: { en: 'The body, already searched; the note is gone from its hand.', pt: 'O corpo, já revistado; o bilhete não está mais na mão dele.' } },
  { olhar: { en: 'An abandoned pack, half torn open.', pt: 'Uma mochila abandonada, meio rasgada.' },
    revela: { en: 'Someone left a pack behind, in a hurry.', pt: 'Alguém deixou uma mochila para trás, às pressas.' },
    uso: { en: 'Among the rags, something still of use.', pt: 'Entre os trapos, algo ainda útil.' }, item: true,
    gasto: { en: 'The torn pack, already emptied.', pt: 'A mochila rasgada, já esvaziada.' } },
  { olhar: { en: 'A villager hiding in the shadows, shaking.', pt: 'Um aldeão escondido nas sombras, tremendo.' },
    revela: { en: 'In the shadows, a frightened villager hides and watches you.', pt: 'Nas sombras, um aldeão assustado se esconde e observa vocês.' },
    uso: { en: '"Please… the way ahead is watched. Keep to the walls."', pt: '"Por favor… o caminho adiante é vigiado. Fiquem junto às paredes."' },
    gasto: { en: 'The frightened villager, who has said what he could.', pt: 'O aldeão assustado, que já disse o que podia.' } }
];
const FICHA_ISCA = { olhar: { en: 'Someone lies huddled on the floor, not moving.', pt: 'Alguém está encolhido no chão, sem se mexer.' },
  revela: { en: 'In the middle of the room, someone lies huddled on the floor.', pt: 'No meio da sala, alguém está encolhido no chão.' },
  uso: [{ en: 'It was bait. Shapes pour in from both sides!', pt: 'Era uma isca. Vultos surgem dos dois lados!' }, { en: 'A click underfoot: the trap is sprung!', pt: 'Um clique sob os pés: a armadilha disparou!' }] };
const TEXTOS_EMBOSCADA = [{ en: 'You are barely in when shapes pour in from both sides: an ambush!', pt: 'Vocês mal entraram e vultos surgem dos dois lados: uma emboscada!' },
  { en: 'The quiet breaks all at once. They were waiting for you!', pt: 'O silêncio se rompe de uma vez. Eles estavam esperando por vocês!' }];
/* the triggers of the object that opens room si (a candidate c of the generator): open it, then whatever the room asks of its
   opener (c.aoAbrir). Returns what was added, to take it away again (a preview) */
function anexarAbertura(h, c, si, novoObjeto) {
  const extra = clone(c.aoAbrir || { gatilhos: [], listas: {} });
  const gs = [{ uid: uid(), tipo: 'open_room', sala: si, requisitos: [] }].concat(novoObjeto && h.type === 'SightToken' ? [autoRemocao()] : []).concat(extra.gatilhos);
  h.gatilhos = novoObjeto ? gs : (h.gatilhos || []).concat(gs); Object.assign(h, extra.listas);
  return { h, gs, chaves: Object.keys(extra.listas) };
}
/* the twin of an opener (a second point of interest under an archway): right after it, standing for it */
function porGemeo(pm, c) {
  if (!c.abridor || !c.abridor.gemeo) return; const lista = pm.salas[c.abridor.sala].objetos; const ob = lista[lista.length - 1];
  lista.push({ ...clone(c.abridor.gemeo), textClick: ob.textClick || '', gemeo: lista.length - 1, ...(ob._previa ? { _previa: true } : {}) });
}
/* The searches, as in the game: tapped with no hero, an object says what it is, and the look hints at the skill a test
   will ask (a tall smooth trunk: agility; loose stones: might; a dark hole: insight; whispering runes: will). Used by a
   hero, it asks a question with three answers; each answer can be chosen once (it greys out, the others stay).
   Each answer: {text, response, item (loot points), ouro (gold), fx (effects), teste {stat, sucessos, cumulativo, text, ok, fail,
   item, ouro, okFx, failFx}}. A test to break or pull something hard is cumulative (the successes add up over tries).
   fx: 'remover' (the object leaves the board), {cond: 'Afflicted'…} (the monsters of the room get a condition; with
   todos: every monster in play, for an object that may stand behind the monsters of its room), {dano: n} (every monster in play
   suffers n damage; the app does not track where figures stand). What happens to the heroes is done at the table (the text says). */
const STAT = { might: { en: 'Might', pt: 'força' }, agility: { en: 'Agility', pt: 'agilidade' }, insight: { en: 'Insight', pt: 'intuição' }, will: { en: 'Will', pt: 'disposição' } };
const BUSCAS = {
  Tree: { olhar: { en: 'A tall tree with a smooth trunk: its lowest branch is well above a man\'s reach. Fruit hangs on one side; mushrooms crowd the roots.', pt: 'Uma árvore alta de tronco liso: o galho mais baixo fica bem acima do alcance de um homem. Há frutos de um lado; cogumelos se amontoam nas raízes.' },
    pergunta: { en: 'The tree towers over you.', pt: 'A árvore se ergue sobre vocês.' }, opcoes: [
    { text: { en: 'Climb the tree.', pt: 'Escalar a árvore.' }, teste: { stat: 'agility', text: { en: 'The bark is smooth; you need quick hands and feet.', pt: 'A casca é lisa; é preciso ser rápido com mãos e pés.' }, ok: { en: 'From the top you see every corner. You may prepare 2 cards.', pt: 'Lá de cima vocês veem cada canto. Podem preparar 2 cartas.' }, fail: { en: 'You slide back down the smooth bark. Suffer 1 fatigue.', pt: 'Vocês escorregam pela casca lisa. Sofram 1 de fadiga.' } } },
    { text: { en: 'Pick the fruit.', pt: 'Colher os frutos.' }, response: { en: 'Sweet, with a sharp end. A hero heals 2.', pt: 'Doce, com um fim ácido. Um herói cura 2.' } },
    { text: { en: 'Forage among the roots.', pt: 'Vasculhar as raízes.' }, response: { en: 'Among the mushrooms, something useful.', pt: 'No meio dos cogumelos, algo útil.' }, item: 5 }] },
  Well: { olhar: { en: 'An old well. The rope is heavy and soaked; far below, something catches the light.', pt: 'Um velho poço. A corda está pesada e encharcada; lá no fundo, algo reflete a luz.' },
    pergunta: { en: 'Cold air rises from the well.', pt: 'Um ar frio sobe do poço.' }, opcoes: [
    { text: { en: 'Haul up the bucket.', pt: 'Puxar o balde.' }, teste: { stat: 'might', text: { en: 'Whatever is in the bucket, it is heavy.', pt: 'O que quer que esteja no balde, é pesado.' }, ok: { en: 'The bucket comes up, and in it something lost long ago.', pt: 'O balde sobe, e nele algo perdido há muito tempo.' }, fail: { en: 'The rope bites into your hands. Suffer 1 damage.', pt: 'A corda morde as mãos. Sofram 1 de dano.' }, item: 10 } },
    { text: { en: 'Drink.', pt: 'Beber.' }, response: { en: 'Cold, clean water. Each hero may discard 1 fatigue.', pt: 'Água fria e limpa. Cada herói pode descartar 1 de fadiga.' } },
    { text: { en: 'Listen at the edge.', pt: 'Escutar na borda.' }, teste: { stat: 'insight', text: { en: 'Echoes come up from the dark. What do they tell you?', pt: 'Ecos sobem da escuridão. O que eles contam?' }, ok: { en: 'The echoes give away the shape of the rooms ahead. You may focus 2 cards.', pt: 'Os ecos revelam a forma das salas adiante. Podem focar 2 cartas.' }, fail: { en: 'Whispers rise from below, and they know your names. Terrify 1 card.', pt: 'Sussurros sobem lá de baixo, e sabem os seus nomes. Aterrorizem 1 carta.' } } }] },
  Shelf: { olhar: { en: 'Tall shelves of books and bottles. The labels are in a cramped, strange hand; the top shelf sags under something heavy.', pt: 'Estantes altas com livros e frascos. Os rótulos estão numa letra apertada e estranha; a prateleira de cima enverga sob algo pesado.' },
    pergunta: { en: 'Dust covers everything on the shelves.', pt: 'A poeira cobre tudo nas estantes.' }, opcoes: [
    { text: { en: 'Read the labels.', pt: 'Ler os rótulos.' }, teste: { stat: 'insight', text: { en: 'Which of these is safe?', pt: 'Qual destes é seguro?' }, ok: { en: 'A clear tonic among the poisons. A hero heals 3.', pt: 'Um tônico claro no meio dos venenos. Um herói cura 3.' }, fail: { en: 'Wrong bottle. Infect 1 card.', pt: 'Frasco errado. Infectem 1 carta.' } } },
    { text: { en: 'Leaf through the books.', pt: 'Folhear os livros.' }, response: { en: 'A worn manual of tactics. Each hero may flip 1 card.', pt: 'Um manual gasto de táticas. Cada herói pode virar 1 carta.' } },
    { text: { en: 'Reach the top shelf.', pt: 'Alcançar a prateleira de cima.' }, teste: { stat: 'agility', text: { en: 'You climb the shelves themselves, carefully.', pt: 'Vocês sobem pelas próprias prateleiras, com cuidado.' }, ok: { en: 'A box wrapped in oilcloth, and inside it something worth keeping.', pt: 'Uma caixa embrulhada em oleado, e dentro algo que vale guardar.' }, fail: { en: 'The shelf tips and books rain down. Suffer 1 fatigue.', pt: 'A estante tomba e os livros despencam. Sofram 1 de fadiga.' }, item: 10 } }] },
  Cauldron: { olhar: { en: 'A heavy iron cauldron, still bubbling. The smell stings the eyes; it would take a strong back to move it.', pt: 'Um caldeirão de ferro pesado, ainda borbulhando. O cheiro arde nos olhos; seria preciso muita força para movê-lo.' },
    pergunta: { en: 'The brew bubbles.', pt: 'O caldo borbulha.' }, opcoes: [
    { text: { en: 'Taste the brew.', pt: 'Provar o caldo.' }, teste: { stat: 'insight', text: { en: 'Food or poison?', pt: 'Comida ou veneno?' }, ok: { en: 'Thick and salty, but it restores you. A hero heals 3.', pt: 'Grosso e salgado, mas revigora. Um herói cura 3.' }, fail: { en: 'Poison. Infect 1 card.', pt: 'Veneno. Infectem 1 carta.' } } },
    { text: { en: 'Tip it over.', pt: 'Virar o caldeirão.' }, teste: { stat: 'might', text: { en: 'You set your shoulder against the hot iron.', pt: 'Vocês apoiam o ombro no ferro quente.' }, ok: { en: 'The scalding brew floods the floor. Every monster in play right now is afflicted (those that come later are not).', pt: 'O caldo fervente inunda o chão. Cada monstro em jogo neste momento fica atormentado (os que vierem depois, não).' }, fail: { en: 'It barely rocks. Suffer 1 fatigue.', pt: 'Ele mal balança. Sofram 1 de fadiga.' }, okFx: [{ cond: 'Afflicted', todos: true }] } },
    { text: { en: 'Search the ashes beneath.', pt: 'Revirar as cinzas embaixo.' }, response: { en: 'Under the ashes, something did not burn.', pt: 'Sob as cinzas, algo não queimou.' }, item: 5 }] },
  Wagon: { olhar: { en: 'An abandoned wagon, loaded with crates. There is room beneath it for someone quick to slip under.', pt: 'Uma carroça abandonada, carregada de caixotes. Há espaço embaixo dela para alguém ágil passar por baixo.' },
    pergunta: { en: 'The wagon creaks.', pt: 'A carroça range.' }, opcoes: [
    { text: { en: 'Search the crates.', pt: 'Revistar os caixotes.' }, response: { en: 'Supplies, still good.', pt: 'Suprimentos, ainda bons.' }, item: 10 },
    { text: { en: 'Slip under the wagon.', pt: 'Passar por baixo da carroça.' }, teste: { stat: 'agility', text: { en: 'You dive under, out of sight.', pt: 'Vocês mergulham por baixo, fora de vista.' }, ok: { en: 'You come out where nobody expects you. Shift 3; you may prepare 1 card.', pt: 'Vocês saem onde ninguém espera. Desloquem 3; podem preparar 1 carta.' }, fail: { en: 'You get stuck halfway, in full view. Suffer 1 fatigue.', pt: 'Vocês ficam presos no meio, bem à vista. Sofram 1 de fadiga.' } } },
    { text: { en: 'Check the toolbox.', pt: 'Olhar a caixa de ferramentas.' }, response: { en: 'Rope and a crowbar, still good. Quick work.', pt: 'Corda e um pé de cabra, ainda bons. Trabalho rápido.' }, extra: true }] },
  Barricade: { olhar: { en: 'A barricade of sharpened stakes. One post looks loose, and the lashings are old and frayed.', pt: 'Uma barricada de estacas afiadas. Um dos postes parece solto, e as amarras estão velhas e puídas.' },
    pergunta: { en: 'The barricade bars the way.', pt: 'A barricada barra o caminho.' }, opcoes: [
    { text: { en: 'Smash it.', pt: 'Derrubar.' }, teste: { stat: 'might', sucessos: 3, cumulativo: true, text: { en: 'You throw your weight against the loose post.', pt: 'Vocês jogam o peso contra o poste solto.' }, ok: { en: 'The barricade collapses into splinters. Remove it.', pt: 'A barricada desaba em lascas. Retirem-na.' }, fail: { en: 'The stakes hold. Suffer 1 fatigue.', pt: 'As estacas aguentam. Sofram 1 de fadiga.' }, okFx: ['remover'] } },
    { text: { en: 'Find the weak lashing.', pt: 'Achar a amarra fraca.' }, teste: { stat: 'insight', text: { en: 'Which cord holds it all together?', pt: 'Qual corda segura tudo?' }, ok: { en: 'You cut the right cord and it falls apart. Remove it.', pt: 'Vocês cortam a corda certa e tudo se desfaz. Retirem-na.' }, fail: { en: 'Wrong cord: a stake whips back. Suffer 1 damage.', pt: 'Corda errada: uma estaca volta com tudo. Sofram 1 de dano.' }, okFx: ['remover'] } },
    { text: { en: 'Take cover behind it.', pt: 'Proteger-se atrás dela.' }, response: { en: 'Hunkered down, you catch your breath. You may focus 1 card.', pt: 'Abaixados, vocês recuperam o fôlego. Podem focar 1 carta.' } }] },
  Statue: { olhar: { en: 'A weathered statue. Deep handholds are carved into its robe; faded letters run around its base.', pt: 'Uma estátua gasta. Há apoios fundos entalhados no manto; letras apagadas contornam a base.' },
    pergunta: { en: 'The statue watches you.', pt: 'A estátua observa vocês.' }, opcoes: [
    { text: { en: 'Climb the statue.', pt: 'Escalar a estátua.' }, teste: { stat: 'agility', text: { en: 'Handhold after handhold, up the robe.', pt: 'Apoio após apoio, manto acima.' }, ok: { en: 'From its shoulders you see the whole room. Each hero may prepare 1 card.', pt: 'Dos ombros dela vocês veem a sala toda. Cada herói pode preparar 1 carta.' }, fail: { en: 'A handhold crumbles. Suffer 1 damage.', pt: 'Um apoio se esfarela. Sofram 1 de dano.' } } },
    { text: { en: 'Study the letters.', pt: 'Estudar as letras.' }, teste: { stat: 'insight', text: { en: 'Worn by the ages, the letters still say something.', pt: 'Gastas pelo tempo, as letras ainda dizem algo.' }, ok: { en: 'A groove in the stone hides a small compartment. It clicks open.', pt: 'Um sulco na pedra esconde um pequeno compartimento. Ele se abre com um clique.' }, fail: { en: 'The letters are worn beyond reading.', pt: 'As letras estão gastas demais para ler.' }, failExtra: true, item: 5 } },
    { text: { en: 'Pause before it.', pt: 'Parar diante dela.' }, response: { en: 'A moment of calm. A hero may discard 1 condition.', pt: 'Um momento de calma. Um herói pode descartar 1 condição.' } }] },
  Fire: { olhar: { en: 'A roaring fire. It hisses and spits as if something lived in it.', pt: 'Uma fogueira intensa. Ela chia e cospe como se algo vivesse nela.' },
    pergunta: { en: 'The flames dance.', pt: 'As chamas dançam.' }, opcoes: [
    { text: { en: 'Warm yourselves.', pt: 'Aquecer-se.' }, response: { en: 'The warmth seeps into your bones. Each hero may discard 1 fatigue.', pt: 'O calor entra nos ossos. Cada herói pode descartar 1 de fadiga.' } },
    { text: { en: 'Speak to the flames.', pt: 'Falar com as chamas.' }, teste: { stat: 'will', text: { en: 'Whatever lives in the fire listens to strong wills only.', pt: 'O que vive no fogo só escuta vontades firmes.' }, ok: { en: 'The flames bow to you. Each hero may focus 1 card.', pt: 'As chamas se curvam. Cada herói pode focar 1 carta.' }, fail: { en: 'The fire lashes out. Scar 1 card.', pt: 'O fogo chicoteia. Marquem 1 carta.' } } },
    { text: { en: 'Hurl a burning brand.', pt: 'Arremessar um tição.' }, teste: { stat: 'agility', text: { en: 'A quick throw, before it burns your hand.', pt: 'Um arremesso rápido, antes que queime a mão.' }, ok: { en: 'The brand bursts and sprays embers everywhere. Each monster in play right now suffers 1 damage.', pt: 'O tição se parte e espalha brasas por toda parte. Cada monstro em jogo neste momento sofre 1 de dano.' }, fail: { en: 'It falls short and sputters out. Suffer 1 fatigue.', pt: 'Ele cai antes e se apaga. Sofram 1 de fadiga.' }, okFx: [{ dano: 1 }] } }] },
  Bell: { olhar: { en: 'A great bronze bell, scratched with dark runes. Its housing is old and rusted.', pt: 'Um grande sino de bronze, riscado de runas escuras. O suporte é velho e enferrujado.' },
    pergunta: { en: 'The bell hangs silent.', pt: 'O sino pende em silêncio.' }, opcoes: [
    { text: { en: 'Ring it.', pt: 'Tocar o sino.' }, response: { en: 'The toll steadies your nerves. Each hero may prepare 1 card.', pt: 'A badalada acalma os nervos. Cada herói pode preparar 1 carta.' } },
    { text: { en: 'Scrape off the runes.', pt: 'Raspar as runas.' }, teste: { stat: 'will', text: { en: 'The runes resist you, cold as ice.', pt: 'As runas resistem, frias como gelo.' }, ok: { en: 'The runes flake away and the bell rings clear. Every monster in play right now is dazed (those that come later are not).', pt: 'As runas se soltam e o sino soa limpo. Cada monstro em jogo neste momento fica confuso (os que vierem depois, não).' }, fail: { en: 'The runes burn cold under your hands. Terrify 1 card.', pt: 'As runas queimam de frio nas mãos. Aterrorizem 1 carta.' }, okFx: [{ cond: 'Dazed', todos: true }] } },
    { text: { en: 'Break the housing.', pt: 'Quebrar o suporte.' }, teste: { stat: 'might', sucessos: 3, cumulativo: true, text: { en: 'Rust and bronze against your strength.', pt: 'Ferrugem e bronze contra a sua força.' }, ok: { en: 'The bell crashes down. Among the bronze scraps, something worth keeping.', pt: 'O sino despenca. Entre os restos de bronze, algo que vale guardar.' }, fail: { en: 'It does not give. Suffer 1 fatigue.', pt: 'Não cede. Sofram 1 de fadiga.' }, item: 5 } }] },
  BloodShrine: { olhar: { en: 'An altar slick with fresh blood. The stone seems to thirst, and something whispers from it.', pt: 'Um altar coberto de sangue fresco. A pedra parece ter sede, e algo sussurra dela.' },
    pergunta: { en: 'The whispers grow louder.', pt: 'Os sussurros ficam mais altos.' }, opcoes: [
    { text: { en: 'Cleanse the altar.', pt: 'Purificar o altar.' }, teste: { stat: 'will', text: { en: 'You set your will against the whispers.', pt: 'Vocês opõem a própria vontade aos sussurros.' }, ok: { en: 'The whispering stops. Each hero may discard 1 condition.', pt: 'Os sussurros param. Cada herói pode descartar 1 condição.' }, fail: { en: 'The whispers follow you. Terrify 1 card.', pt: 'Os sussurros seguem vocês. Aterrorizem 1 carta.' } } },
    { text: { en: 'Offer your blood.', pt: 'Oferecer o próprio sangue.' }, response: { en: 'Suffer 2 damage. Power floods in: you may focus 2 cards and prepare 1.', pt: 'Sofram 2 de dano. O poder invade: podem focar 2 cartas e preparar 1.' } },
    { text: { en: 'Smash the altar.', pt: 'Destruir o altar.' }, teste: { stat: 'might', sucessos: 4, cumulativo: true, text: { en: 'Old stone, hardened by blood: it will take more than one blow.', pt: 'Pedra velha, endurecida pelo sangue: vai precisar de mais de um golpe.' }, ok: { en: 'The altar splits in two, and the power in it drains away. Every monster in play right now is exposed (those that come later are not).', pt: 'O altar se parte em dois, e o poder que havia nele se esvai. Cada monstro em jogo neste momento fica exposto (os que vierem depois, não).' }, fail: { en: 'The stone jars your arms, but a crack runs through it. Suffer 1 damage.', pt: 'A pedra sacode os braços, mas uma rachadura se abre nela. Sofram 1 de dano.' }, okFx: [{ cond: 'Exposed', todos: true }] } }] },
  Lectern: { olhar: { en: 'A lectern with a heavy book. The ink is faded, and a few runes on the page glow faintly.', pt: 'Um púlpito com um livro pesado. A tinta está apagada, e algumas runas na página brilham de leve.' },
    pergunta: { en: 'The book lies open.', pt: 'O livro está aberto.' }, opcoes: [
    { text: { en: 'Read the faded text.', pt: 'Ler o texto apagado.' }, teste: { stat: 'insight', text: { en: 'Half the words are gone. Can you fill the gaps?', pt: 'Metade das palavras sumiu. Dá para preencher as lacunas?' }, ok: { en: 'A passage on your enemies and their weak points. Every monster in play right now is exposed (those that come later are not).', pt: 'Um trecho sobre os inimigos e seus pontos fracos. Cada monstro em jogo neste momento fica exposto (os que vierem depois, não).' }, fail: { en: 'The words swim before your eyes. Suffer 1 fatigue.', pt: 'As palavras dançam diante dos olhos. Sofram 1 de fadiga.' }, okFx: [{ cond: 'Exposed', todos: true }] } },
    { text: { en: 'Trace the glowing runes.', pt: 'Tocar as runas que brilham.' }, teste: { stat: 'will', text: { en: 'The runes pull at you. Hold on.', pt: 'As runas puxam vocês. Aguentem.' }, ok: { en: 'Warmth runs up your arm. A hero heals 3.', pt: 'Um calor sobe pelo braço. Um herói cura 3.' }, fail: { en: 'The runes bite. Scar 1 card.', pt: 'As runas mordem. Marquem 1 carta.' } } },
    { text: { en: 'Check between the pages.', pt: 'Olhar entre as páginas.' }, response: { en: 'Someone hid something here.', pt: 'Alguém escondeu algo aqui.' }, item: 5 }] },
  StoneTable: { olhar: { en: 'A heavy stone table. On it lie a leather journal and a small pouch; a dagger is driven deep into the stone.', pt: 'Uma pesada mesa de pedra. Sobre ela, um diário de couro e uma bolsinha; uma adaga está cravada fundo na pedra.' },
    pergunta: { en: 'What do you take a closer look at?', pt: 'O que vocês examinam de perto?' }, opcoes: [
    { text: { en: 'Read the journal.', pt: 'Ler o diário.' }, response: { en: 'Notes of someone who came before you. Each hero may prepare 1 card.', pt: 'Anotações de alguém que veio antes. Cada herói pode preparar 1 carta.' } },
    { text: { en: 'Open the pouch.', pt: 'Abrir a bolsinha.' }, response: { en: 'Coins and odds and ends.', pt: 'Moedas e miudezas.' }, ouro: 10, item: 5 },
    { text: { en: 'Pull out the dagger.', pt: 'Arrancar a adaga.' }, teste: { stat: 'might', sucessos: 3, cumulativo: true, text: { en: 'It is driven deep.', pt: 'Está cravada fundo.' }, ok: { en: 'It comes free: fine steel, well balanced.', pt: 'Ela sai: aço fino, bem equilibrado.' }, fail: { en: 'It will not budge. Suffer 1 fatigue.', pt: 'Não se mexe. Sofram 1 de fadiga.' }, item: 10 } }] },
  RoundTable: { olhar: { en: 'A round table with a dice game left half played, mugs still full and coins on the wood.', pt: 'Uma mesa redonda com um jogo de dados pela metade, canecas ainda cheias e moedas na madeira.' },
    pergunta: { en: 'Whoever sat here left in a hurry.', pt: 'Quem estava aqui saiu às pressas.' }, opcoes: [
    { text: { en: 'Take the coins.', pt: 'Pegar as moedas.' }, response: { en: 'Nobody will miss them.', pt: 'Ninguém vai sentir falta.' }, ouro: 15 },
    { text: { en: 'Drink from a mug.', pt: 'Beber de uma caneca.' }, teste: { stat: 'insight', text: { en: 'It smells like ale. Is that all?', pt: 'Cheira a cerveja. É só isso?' }, ok: { en: 'Strong ale, nothing more. A hero heals 2 and may discard 1 fatigue.', pt: 'Cerveja forte, nada mais. Um herói cura 2 e pode descartar 1 de fadiga.' }, fail: { en: 'Something was added to it. Infect 1 card.', pt: 'Colocaram algo nela. Infectem 1 carta.' } } },
    { text: { en: 'Roll the dice.', pt: 'Rolar os dados.' }, response: { en: 'Luck is with you.', pt: 'A sorte está com vocês.' }, extra: true }] },
  DragonHead: { olhar: { en: 'The skull of a great dragon. Some teeth hang loose; deep in one eye socket, a faint glow lingers.', pt: 'O crânio de um grande dragão. Alguns dentes estão soltos; no fundo de uma órbita, um brilho fraco persiste.' },
    pergunta: { en: 'The old bones creak.', pt: 'Os ossos velhos rangem.' }, opcoes: [
    { text: { en: 'Pry out a tooth.', pt: 'Arrancar um dente.' }, teste: { stat: 'might', sucessos: 3, cumulativo: true, text: { en: 'Even loose, a dragon\'s tooth holds fast.', pt: 'Mesmo solto, um dente de dragão resiste.' }, ok: { en: 'The tooth comes out, sharp as the day it was grown.', pt: 'O dente sai, afiado como no dia em que nasceu.' }, fail: { en: 'Your hand slips on the edge. Suffer 1 damage.', pt: 'A mão escorrega no gume. Sofram 1 de dano.' }, item: 10 } },
    { text: { en: 'Reach into the eye socket.', pt: 'Enfiar a mão na órbita.' }, teste: { stat: 'agility', text: { en: 'A narrow gap, and something sharp inside.', pt: 'Uma fresta estreita, e algo afiado lá dentro.' }, ok: { en: 'Your fingers close on a warm shard. You may prepare 1 card.', pt: 'Os dedos agarram um fragmento morno. Podem preparar 1 carta.' }, fail: { en: 'Something inside cuts deep. Suffer 1 damage and infect 1 card.', pt: 'Algo lá dentro corta fundo. Sofram 1 de dano e infectem 1 carta.' }, item: 5 } },
    { text: { en: 'Listen to the bones.', pt: 'Escutar os ossos.' }, teste: { stat: 'will', text: { en: 'An old presence stirs. Can you bear it?', pt: 'Uma presença antiga se agita. Vocês aguentam?' }, ok: { en: 'An old voice lends you its strength. You may focus 2 cards.', pt: 'Uma voz antiga empresta a sua força. Podem focar 2 cartas.' }, fail: { en: 'Its rage fills your head. Terrify 1 card.', pt: 'A fúria dele enche a cabeça. Aterrorizem 1 carta.' } } }] }
};
/* the tokens that ask a test: the look tells the skill before anyone tries */
const FICHAS_TESTE = [
  { olhar: { en: 'A patch of wall where the mortar has crumbled. It sounds hollow.', pt: 'Um trecho de parede com a argamassa esfarelada. Soa oco.' }, revela: { en: 'One stretch of wall looks weaker than the rest.', pt: 'Um trecho de parede parece mais fraco que o resto.' },
    teste: { stat: 'might', sucessos: 3, cumulativo: true, text: { en: 'You put your shoulder to the loose stones.', pt: 'Vocês encostam o ombro nas pedras soltas.' }, ok: { en: 'The stones give way. Behind them, a forgotten cache.', pt: 'As pedras cedem. Atrás delas, um esconderijo esquecido.' }, fail: { en: 'The wall holds; your shoulder does not. Suffer 1 damage.', pt: 'A parede aguenta; o ombro, não. Sofram 1 de dano.' }, item: 10 } },
  { olhar: { en: 'A narrow crack in the rock. Something glints inside, just out of reach.', pt: 'Uma fenda estreita na rocha. Algo brilha lá dentro, logo além do alcance.' }, revela: { en: 'Something glints inside a narrow crack in the rock.', pt: 'Algo brilha dentro de uma fenda estreita na rocha.' },
    teste: { stat: 'agility', text: { en: 'Only a quick, careful hand will fit.', pt: 'Só uma mão rápida e cuidadosa passa.' }, ok: { en: 'You pull it out without a scratch.', pt: 'Vocês o puxam sem um arranhão.' }, fail: { en: 'The rock scrapes your arm raw. Suffer 1 damage.', pt: 'A rocha esfola o braço. Sofram 1 de dano.' }, item: 10 } },
  { olhar: { en: 'A dark hole in the floor, with faint marks around its edge.', pt: 'Um buraco escuro no chão, com marcas fracas em volta da borda.' }, revela: { en: 'A dark hole opens in the floor.', pt: 'Um buraco escuro se abre no chão.' },
    teste: { stat: 'insight', text: { en: 'What made those marks? What is down there?', pt: 'O que fez essas marcas? O que há lá embaixo?' }, ok: { en: 'The marks tell you how they move. You may focus 2 cards.', pt: 'As marcas revelam como eles se movem. Podem focar 2 cartas.' }, fail: { en: 'You lean in too far and nearly fall. Suffer 1 fatigue.', pt: 'Vocês se inclinam demais e quase caem. Sofram 1 de fadiga.' } } },
  { olhar: { en: 'Runes painted on the floor pulse faintly, like a heartbeat.', pt: 'Runas pintadas no chão pulsam de leve, como um coração.' }, revela: { en: 'Runes on the floor pulse like a heartbeat.', pt: 'Runas no chão pulsam como um coração.' },
    teste: { stat: 'will', text: { en: 'The pulse reaches for your mind. Break the pattern.', pt: 'O pulso busca a mente de vocês. Quebrem o padrão.' }, ok: { en: 'The pattern breaks. Every monster in play right now is enfeebled (those that come later are not).', pt: 'O padrão se quebra. Cada monstro em jogo neste momento fica febril (os que vierem depois, não).' }, fail: { en: 'The pulse gets inside your head. Terrify 1 card.', pt: 'O pulso entra na cabeça. Aterrorizem 1 carta.' }, okFx: [{ cond: 'Enfeebled', todos: true }] } }
];
/* the effects of an answer, as triggers */
function efeitosDe(fx) {
  return (fx || []).map(f => f === 'remover' ? { uid: uid(), tipo: 'remove_object', proprio: true, requisitos: [] }
    : f.cond ? { uid: uid(), tipo: 'enemy_condition', acao: 'apply', condition: f.cond, alvo: f.todos ? 'all' : 'room', requisitos: [] }
    : f.dano ? { uid: uid(), tipo: 'enemy_condition', acao: 'damage', amount: f.dano, alvo: 'all', requisitos: [] } : null).filter(Boolean);   // the app does not know where the figures stand: every monster in play
}
const textoDoTeste = t => { const s = STAT[t.stat]; return L2(t.text.en + (s ? ' Test ' + s.en + '.' : '') + (t.cumulativo ? ' The successes add up over tries.' : ''), t.text.pt + (s ? ' Teste de ' + s.pt + '.' : '') + (t.cumulativo ? ' Os sucessos se somam a cada tentativa.' : '')); };
/* gold for the party */
const ouroDe = n => ({ uid: uid(), tipo: 'give_item', modo: 'gold', amount: n, requisitos: [] });
/* a test on object o (its triggers in list `lista`) */
/* how many successes a test asks: the base of the test (2 for an ordinary one) raised by the difficulty of the map (Easy
   +0, Normal +1, Hard +2) and by the Act II boxes (the heroes are stronger: +1). A test in one roll stays at 4 at most; a
   cumulative one (successes add up over tries, as the game's barricades at 7) climbs twice as fast */
let DIFICULDADE_TESTES = { dif: 'normal', atos: 1 };
function sucessosDoTeste(base, cumulativo) {
  // (Easy stays at the base whatever the boxes: a party that rolls two successes passes every test in one roll, and a
  // cumulative one in two; the simulation of the easy level showed the Act II step made them out of reach)
  const d = DIFICULDADE_TESTES; const aj = d.dif === 'facil' ? 0 : ({ normal: 1, dificil: 2 }[d.dif] ?? 1) + (d.atos === 2 ? 1 : 0);
  return cumulativo ? (base || 3) + 2 * aj : Math.min(4, (base || 2) + Math.min(2, aj));
}
function testeNoObjeto(o, t) {
  const txt = x => gatilhoTexto(T2(x));
  const item = n => ({ uid: uid(), tipo: 'give_item', modo: 'random', points: pontosDeButim(n), requisitos: [] });
  const g = { uid: uid(), tipo: 'skill_test', text: textoDoTeste(t), successes: sucessosDoTeste(t.sucessos, t.cumulativo), ...(t.cumulativo ? { cumulativo: true } : {}), requisitos: [] };
  o['ok:' + g.uid] = [txt(t.ok)].concat(t.ouro ? [ouroDe(t.ouro)] : []).concat(t.item ? [item(t.item)] : []).concat(efeitosDe(t.okFx)); o['fail:' + g.uid] = [txt(t.fail)].concat(efeitosDe(t.failFx));
  if (t.failExtra) o.acaoExtra = { ...(o.acaoExtra || {}), ['fail:' + g.uid]: true };   // nothing happened: the action is not lost
  return g;
}
/* a search on object o: one "Multiple choice" with the three answers, each once, and their outcomes */
/* the loot of the generated rooms, more generous than the first tables (a map of searches left the party without enough
   materials to craft a single weapon): the points of a random loot grow by half */
const pontosDeButim = n => Math.round((n || 10) * 1.5);
function busca(o, def) {
  const item = n => ({ uid: uid(), tipo: 'give_item', modo: 'random', points: pontosDeButim(n), requisitos: [] });
  const g = { uid: uid(), tipo: 'choice', text: T2(def.pergunta), options: def.opcoes.map(op => ({ text: T2(op.text), response: op.response ? T2(op.response) : '' })), umaVez: true, vazio: L2('Nothing more to find here.', 'Não há mais nada a encontrar aqui.'), requisitos: [] };
  def.opcoes.forEach((op, i) => {
    const lista = [];
    if (op.ouro) lista.push(ouroDe(op.ouro));
    if (op.item) lista.push(item(op.item));
    if (op.teste) lista.push(testeNoObjeto(o, op.teste));
    lista.push(...efeitosDe(op.fx));
    o['op' + i + ':' + g.uid] = lista;
    if (op.extra) o.acaoExtra = { ...(o.acaoExtra || {}), ['op' + i + ':' + g.uid]: true };
  });
  o.gatilhos = [g]; o.usos = def.opcoes.some(op => op.teste?.cumulativo) ? 'always' : String(def.opcoes.length);
  if (def.olhar) o.textClick = T2(def.olhar);
}
/* an object that was a search becomes something else (a key, a seal…): its search goes */
function semBusca(o) {
  const g = (o.gatilhos || []).find(x => x.tipo === 'choice' && x.umaVez); if (!g) return o;
  todosGatilhos(o).forEach(x => Object.keys(o).forEach(k => { if (k.endsWith(':' + x.uid)) delete o[k]; }));
  o.gatilhos = o.gatilhos.filter(x => x !== g); delete o.usos; delete o.acaoExtra; return o;
}
/* a raised tile is worth the climb: when nothing stands on it, a chest (or a token to search) goes up there, on a square
   away from where the ladder or staircase arrives, and only where the room stays whole. Before, a ledge could be empty */
function noAlto(sala, idx, entrada, rng, pTemp, naMesa, atos) {
  const altos = sala.pecas.filter(q => !ehAlfombra(q.tile) && (q.level || 0) > 0); if (!altos.length) return;
  const subida = o => ehTerreno(o) || ehTipo(o, 'Ladder') || ehTipo(o, 'LadderMedium');
  for (const q of altos) {
    const pt = pTemp(); const ch = chaoDaSala(idx, pt); const cs = casasDaPeca(q).filter(([x, y]) => ch.get(kc(x, y))?.nivel === (q.level || 0));
    const naPeca = new Set(cs.map(([x, y]) => kc(x, y)));
    if (sala.objetos.some(o => !subida(o) && casasDoObjeto(o).some(([x, y]) => naPeca.has(kc(x, y))))) continue;
    // where the heroes arrive up there (the top of a staircase, the square a ladder leads to): kept free
    const chegada = new Set(); [...ch.values()].forEach(c => { if (c.degrau) chegada.add(kc(c.degrau.x, c.degrau.y)); if (c.escada) VIZ4.forEach(([dx, dy]) => chegada.add(kc(c.x + dx, c.y + dy))); });
    const ocup = new Set(sala.objetos.flatMap(o => casasDoObjeto(o)).map(([x, y]) => kc(x, y)));
    const livres = cs.filter(([x, y]) => { const c = ch.get(kc(x, y)); return c && !c.bloqueia && !c.escada && !c.ponte && !c.muro && !c.degrau && !chegada.has(kc(x, y)) && !ocup.has(kc(x, y)); });
    const longe = ([x, y]) => Math.min(99, ...[...chegada].map(k => { const [a, b] = k.split(',').map(Number); return Math.abs(a - x) + Math.abs(b - y); }));
    const ordem = rng.embaralhar(livres).sort((a, b) => longe(b) - longe(a));
    const antes = foraDeAlcance(idx, pt, entrada).length;
    let feito = false;
    for (const t of ['Chest', 'InteractToken']) { if (feito || !daCaixa(t, atos) || !OBJETO[t] || objetoLivre(pt, naMesa, t, atos) <= 0) continue;
      for (const [x, y] of ordem) { const o = { type: t, pos: [x, y], rot: 0, level: q.level || 0, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
        sala.objetos.push(o); if (foraDeAlcance(idx, pTemp(), entrada).length <= antes) { feito = true; break; } sala.objetos.pop(); } }
  }
}
/* what the room shows after it is set up: its interaction tokens (and other things the heroes should notice) */
function textoDepoisDe(sala) { return sala.objetos.map(o => o._revela).filter(Boolean).join(' '); }
/* the people and things of the rooms (interaction tokens): the first ones of the generator and those of the stories
   (HISTORIAS.fichas) that fit the place (tags: theme, acts, faction, premise) */
function fichasDoGerador(tags, comTeste) {
  const hist = (HISTORIAS.fichas || []).filter(f => !!f.teste === comTeste && (typeof cabeRoupa !== 'function' || cabeRoupa(f, tags || {})));
  return (comTeste ? FICHAS_TESTE : FICHAS_INTERACAO).concat(hist);
}
function textosDosObjetos(sala, arq, rng, p, comIsca = true, tags = null) {
  const temItens = (p.itensPool || []).length > 0;
  // the people and things of the map do not repeat while there are new ones; those the other maps of the campaign already
  // show come last
  const vistas = new Set(p.salas.flatMap(ss => ss.objetos.map(o => o.textClick))); const evitar = p._evitarFichas || new Set();
  const ordem = l => { const e = rng.embaralhar(l.filter(f => !vistas.has(T2(f.olhar)))); return e.filter(f => !evitar.has(T2(f.olhar))).concat(e.filter(f => evitar.has(T2(f.olhar)))); };
  let bausComItem = 0; const fichas = ordem(fichasDoGerador(tags, false)); const testes = ordem(fichasDoGerador(tags, true));
  sala.objetos.forEach(o => {
    const t = baseObj(o.type);
    if (t === 'SightToken') { o.textClick = ''; o.gatilhos = [txtT('The way ahead is clearer from here.', 'Daqui o caminho adiante fica mais claro.'), autoRemocao()]; }
    else if (t === 'InteractToken') {
      const isca = comIsca && arq.inimigos?.como === 'armadilha' && !sala.objetos.some(x => x._isca);
      // a person or a thing to look at, or (now and then) a thing that asks a test, its skill hinted by the look
      const teste = !isca && rng() < 0.4 ? testes.shift() : null;
      const f = isca ? FICHA_ISCA : teste || fichas.shift() || rng.pick(fichasDoGerador(tags, false));
      o.textClick = T2(f.olhar); o._revela = T2(f.revela); if (isca) o._isca = true;
      if (teste) { o.gatilhos = [testeNoObjeto(o, teste.teste)]; if (teste.teste.cumulativo) o.usos = 'always'; }
      else { o.gatilhos = [gatilhoTexto(T2(Array.isArray(f.uso) ? rng.pick(f.uso) : f.uso))];
        if (!isca && (f.item || arq.tesouro === 'token')) o.gatilhos.push({ uid: uid(), tipo: 'give_item', modo: 'random', points: pontosDeButim(10), requisitos: [] });
        if (!isca && (f.ouro || arq.tesouro === 'token')) o.gatilhos.push(ouroDe(f.ouro || 10)); } }
    else if (t === 'Chest') { const item = arq.tesouro === 'bau' && temItens && bausComItem++ === 0; o.gatilhos = [...(item ? [{ uid: uid(), tipo: 'give_item', modo: 'newitem', amount: 1, requisitos: [] }] : []), { uid: uid(), tipo: 'give_item', modo: 'random', points: arq.tesouro === 'bau' ? 25 : 20, requisitos: [] }, ouroDe(arq.tesouro === 'bau' ? 30 : 15)]; }
    else if (BUSCAS[t]) busca(o, BUSCAS[t]);
    else if (ehDaOficina(o.type)) { const v = varObj(o.type); if (!v) return; aplicarPadrao(o); o.textClick = o.textClick || v.textClick || v.nome || ''; o.textUse = o.textUse || v.textUse || '';
      o._revela = L2('Here: ' + (v.nome || '') + '.', 'Aqui: ' + (v.nome || '') + '.'); }
  });
}
/* the rules that fail a room (H) */
function validarSalaGerada(sala, idx, p, entrada, lig, contato = true, abertura = [], convivem = null) {
  const r = []; const ch = chaoDaSala(idx, p);
  if (!sala.pecas.some(q => !ehAlfombra(q.tile))) r.push('no tiles');
  const nums = sala.pecas.filter(q => !ehAlfombra(q.tile)).map(q => numeroDaPeca(q.tile));
  const doMapa = p.salas.slice(0, idx).filter((s, i) => !convivem || convivem.includes(i)).flatMap(s => s.pecas.filter(q => !ehAlfombra(q.tile)).map(q => numeroDaPeca(q.tile)));
  if (nums.some(n => nums.filter(x => x === n).length + doMapa.filter(x => x === n).length > Math.max(1, caixaDaPeca(n, 2)))) r.push('a tile is used twice');
  if (!entrada.length) r.push('no entry'); else if (!entrada.every(([x, y]) => ch.has(kc(x, y)) && !ch.get(kc(x, y)).bloqueia)) r.push('the entry is not free floor');
  const d = distancias(ch, entrada); const livres = [...ch.values()].filter(c => !c.bloqueia && !c.muro).length;   // (the walls of the vault are not walked from inside)
  if (d.size < livres) r.push('squares out of reach');
  if (idx === 0 && (sala.herois || []).length < 2) r.push('fewer than 2 hero spaces');
  if (sala.objetos.some(o => !ehTerreno(o) && (ehArco(o) ? meioDoArco(o).meio : casasDoObjeto(o)).some(([x, y]) => !ch.has(kc(x, y))))) r.push('an object off the floor');
  if ((sala.inimigos || []).some(e => !ch.has(kc(e.pos[0], e.pos[1])))) r.push('a monster off the floor');
  if (sala.intensidade && (sala.intensidade < 1 || sala.intensidade > 10)) r.push('intensity out of range');
  if (lig) { const e = lig.fora; if (!ch.has(kc(e[0], e[1]))) r.push('the door leads nowhere'); }
  if (contato && vazamentosDaSala(idx, p, abertura).length) r.push('touches another room outside its door');
  const escadas = sala.objetos.filter(o => ehTipo(o, 'Staircase') || ehTipo(o, 'Ladder') || ehTipo(o, 'LadderMedium'));
  if (sala.pecas.some(q => (q.level || 0) > 0) && !escadas.length) r.push('a raised tile with no way up');
  return r;
}
/* where room si touches the floor of an earlier room (sides or corners) other than through the object that opens it:
   [[square of si, square of the other room]] (a later room answers for its own contacts). The squares in front of the
   opener may touch the room behind at a corner */
function vazamentosDaSala(si, p = projeto, abertura = []) {
  // (by level: a walkway two levels or more over another room touches nothing there, as a viaduct over a hall)
  const pisoDe = ri => { const m = new Map(); const pon = (k, lv) => { const a = m.get(k) || []; a.push(lv); m.set(k, a); }; p.salas[ri].pecas.forEach(q => { if (!ehAlfombra(q.tile)) casasDaPeca(q).forEach(([x, y]) => pon(kc(x, y), nivelNaPeca(q, x, y))); }); p.salas[ri].objetos.forEach(o => { if (ehTerreno(o)) casasDoObjeto(o).forEach(([x, y]) => pon(kc(x, y), (o.level || 0) + (ehTipo(o, 'Staircase') ? 1 : 0))); }); return m; };
  // (a walkway on pillars leans on the high floor of the room that opens it: there it touches on purpose)
  const deQuem = p.salas[si].elevada ? p.salas.findIndex(ss => ss.objetos.some(o => todosGatilhos(o).some(g => g.tipo === 'open_room' && g.sala === si))) : -1;
  const meuN = pisoDe(si); const outrosN = new Map(); p.salas.forEach((s, ri) => { if (ri < si && ri !== deQuem) pisoDe(ri).forEach((l, k) => outrosN.set(k, (outrosN.get(k) || []).concat(l))); });
  const tol = p.salas[si].elevada ? 0 : 1; const perto = (a, b) => a.some(x => b.some(y => Math.abs(x - y) <= tol));
  const meu = new Set(meuN.keys()); const outros = { has: k => outrosN.has(k) }; const juntos = (k, n) => perto(meuN.get(k) || [0], outrosN.get(n) || [0]);
  const porta = new Set(abertura.map(k => Array.isArray(k) ? kc(k[0], k[1]) : k)); p.salas.forEach(ss => ss.objetos.forEach(o => { if (!todosGatilhos(o).some(g => g.tipo === 'open_room' && g.sala === si)) return;
    casasDoObjeto(o).forEach(([x, y]) => porta.add(kc(x, y)));
    // a door in the middle of an archway (a portal): the archway is part of the way in
    const cs = casasDoObjeto(o); ss.objetos.forEach(a => { if (ehArco(a) && cs.every(c => meioDoArco(a).meio.some(m => m[0] === c[0] && m[1] === c[1]))) casasDoObjeto(a).forEach(([x, y]) => porta.add(kc(x, y))); }); }));
  const naFrente = k => { const [x, y] = k.split(',').map(Number); return VIZ4.some(([dx, dy]) => porta.has(kc(x + dx, y + dy))); };
  const r = [];
  meu.forEach(k => { const [x, y] = k.split(',').map(Number); VIZ8.forEach(([dx, dy]) => { const n = kc(x + dx, y + dy); if (!outros.has(n) || porta.has(n) || !juntos(k, n)) return; if (dx && dy && naFrente(k)) return; r.push([k, n]); }); });
  return r;
}
/* what a player reads tapping an object with no hero chosen: what it is (the triggers run only when a hero uses it) */
const TEXTOS_OLHAR = {
  Door: { en: ['A heavy door, shut tight. Something lies beyond it.', 'An old wooden door, banded with iron.'], pt: ['Uma porta pesada, bem fechada. Há algo do outro lado.', 'Uma velha porta de madeira, reforçada com ferro.'] },
  Archway: { en: ['A stone archway leading onward.'], pt: ['Um arco de pedra que leva adiante.'] },
  BellFrame: { en: ['A stone frame, its bell long gone.'], pt: ['Uma moldura de pedra, sem o sino que ela sustentava.'] },
  Gate: { en: ['An iron gate.'], pt: ['Um portão de ferro.'] },
  Chest: { en: ['A closed chest. It could hold anything.', 'A dusty chest with a rusted clasp.'], pt: ['Um baú fechado. Pode guardar qualquer coisa.', 'Um baú empoeirado, com o fecho enferrujado.'] },
  InteractToken: { en: ['Something here can be examined or used.'], pt: ['Algo aqui pode ser examinado ou usado.'] },
  Shelf: { en: ['Shelves crowded with dusty jars and books. A hero can spend an action to search them.'], pt: ['Prateleiras cheias de potes e livros empoeirados. Um herói pode gastar uma ação para vasculhá-las.'] },
  Lectern: { en: ['A lectern with an open book.'], pt: ['Um púlpito com um livro aberto.'] },
  Statue: { en: ['A weathered statue watches the room.'], pt: ['Uma estátua gasta vigia a sala.'] },
  Barricade: { en: ['A barricade blocks the way.'], pt: ['Uma barricada bloqueia a passagem.'] },
  Tree: { en: ['A tall tree, heavy with fruit. A hero can spend an action to search it.'], pt: ['Uma árvore alta, carregada de frutos. Um herói pode gastar uma ação para vasculhá-la.'] },
  StoneTable: { en: ['A heavy stone table.'], pt: ['Uma pesada mesa de pedra.'] },
  RoundTable: { en: ['A round table, the chairs pushed back in a hurry.'], pt: ['Uma mesa redonda, com as cadeiras afastadas às pressas.'] },
  Cauldron: { en: ['A cauldron, still warm. A hero can spend an action to investigate it.'], pt: ['Um caldeirão, ainda morno. Um herói pode gastar uma ação para investigá-lo.'] },
  Well: { en: ['An old well. The bottom is lost in the dark. A hero can spend an action to investigate it.'], pt: ['Um velho poço. O fundo se perde no escuro. Um herói pode gastar uma ação para investigá-lo.'] },
  Fire: { en: ['A fire crackles here.'], pt: ['Uma fogueira crepita aqui.'] },
  BloodShrine: { en: ['A shrine stained with old blood.'], pt: ['Um santuário manchado de sangue antigo.'] },
  Bell: { en: ['A great bronze bell.'], pt: ['Um grande sino de bronze.'] },
  DragonHead: { en: ['The skull of a great dragon, bleached by the years.'], pt: ['O crânio de um grande dragão, branqueado pelos anos.'] },
  DragonArch: { en: ['The bones of a dragon arch over the way.'], pt: ['Os ossos de um dragão formam um arco sobre o caminho.'] },
  Wagon: { en: ['An abandoned wagon. A hero can spend an action to search it.'], pt: ['Uma carroça abandonada. Um herói pode gastar uma ação para revistá-la.'] }
};
function textoDeOlhar(tipo, rng) { if (baseObj(tipo) === 'SightToken') return ''; const t = TEXTOS_OLHAR[baseObj(tipo)]; if (!t) return L2('Something of note.', 'Algo que chama a atenção.'); const l = t[LP()] || t.en; return rng ? rng.pick(l) : l[0]; }
/* the score (0–100): how close each measure is to the archetype's range */
function notaDaSala(m, arq) {
  let s = 0, w = 0;
  Object.entries(arq.metas || {}).forEach(([k, [a, b]]) => { const v = m[k]; if (v === null || v === undefined) return; const peso = (arq.pesos || {})[k] || 1; const larg = Math.max(0.05, b - a); const d = v < a ? (a - v) / larg : v > b ? (v - b) / larg : 0; s += peso * Math.exp(-d * 1.5); w += peso; });
  const [a0, a1] = arq.area; const da = m.area < a0 ? (a0 - m.area) / (a1 - a0 + 1) : m.area > a1 ? (m.area - a1) / (a1 - a0 + 1) : 0; s += 1.5 * Math.exp(-da * 1.5); w += 1.5;
  return Math.round(100 * s / Math.max(1, w));
}
/* one sentence on the strengths of a candidate */
function fraseDaSala(m, arq) {
  if (!m || !m.area) return '';
  const r = []; const pct = v => Math.round(v * 100) + '%';
  if (m.visao >= 0.75) r.push(L2('clear view from the entry (' + pct(m.visao) + ' of the room)', 'visão ampla da entrada (' + pct(m.visao) + ' da sala)'));
  else if (m.visao <= 0.45) r.push(L2('blind corners (' + pct(1 - m.visao) + ' hidden from the entry)', 'cantos cegos (' + pct(1 - m.visao) + ' escondidos da entrada)'));
  if (m.rotas >= 2) r.push(L2(m.rotas + ' separate routes', m.rotas + ' rotas separadas'));
  if (m.gargalos >= 2) r.push(L2(m.gargalos + ' chokepoints', m.gargalos + ' gargalos'));
  if (m.cobertura >= 0.25) r.push(L2('cover on ' + pct(m.cobertura) + ' of the floor', 'cobertura em ' + pct(m.cobertura) + ' do piso'));
  if (m.distInimigo !== null && m.inimigos) r.push(L2('monsters ' + m.distInimigo + ' squares away', 'monstros a ' + m.distInimigo + ' casas'));
  if (m.niveis >= 2) r.push(L2('a raised platform', 'uma plataforma elevada'));
  if (m.alfombra > 0) r.push(L2('hazard terrain', 'terreno perigoso'));
  const t = r.slice(0, 3).join(', ');
  return (t ? t.charAt(0).toUpperCase() + t.slice(1) : L2('A plain room', 'Uma sala simples')) + ' · ' + m.area + L2(' squares', ' casas') + ', ' + L2(m.forma, ({ compacta: 'compacta', alongada: 'alongada', L: 'em L', cruz: 'em cruz', irregular: 'irregular', ilhas: 'com ilhas' })[m.forma] || m.forma) + '.';
}
/* many candidates, the best three (different from one another) */
function gerarCandidatos(opts, n = 36) {
  const todos = [];
  for (let i = 0; i < n; i++) { const c = gerarSala({ ...opts, semente: opts.semente + '·' + i }); if (!c.erro) todos.push(c); }
  const validos = todos.filter(c => !c.problemas.length).sort((a, b) => b.nota - a.nota);
  const r = [];
  for (const c of validos) { if (r.length >= 3) break; const assin = c.sala.pecas.map(q => numeroDaPeca(q.tile)).sort().join('+'); if (r.some(x => x._assin === assin && Math.abs(x.medidas.area - c.medidas.area) < 4)) continue; c._assin = assin; r.push(c); }
  if (r.length < 3) validos.forEach(c => { if (r.length < 3 && !r.includes(c)) r.push(c); });
  return { candidatos: r, tentados: todos.length, validos: validos.length, erro: !todos.length ? (gerarSala({ ...opts, semente: opts.semente + '·x' }).erro || 'no candidate') : null };
}

// ------------------------------------------------------------ the window
/* a generation takes a moment: the button waits (disabled, "Generating…") while it runs */
function comEspera(botao, fn) {
  if (!botao || botao.disabled) return; const antes = botao.innerHTML;
  botao.disabled = true; botao.classList.add('carregando'); botao.textContent = tr('Generating…');
  setTimeout(() => { try { fn(); } finally { if (botao.isConnected) { botao.disabled = false; botao.classList.remove('carregando'); botao.innerHTML = antes; } } }, 40);
}
const GER = { opcoes: null, resultado: null, escolhido: -1, previa: null, sementeUsada: null, ultimoPonto: null };
const COR_PISO = { flagstone: '#7b7a74', wood: '#8a6a45', dirt: '#8c7650', grass: '#5d7a44' };
const COR_ALFOMBRA = { 'underlay-water': 'rgba(70,130,200,.55)', 'underlay-fetidwater': 'rgba(110,140,60,.6)', 'underlay-embers': 'rgba(220,90,40,.55)', 'underlay-spikes': 'rgba(150,150,160,.6)' };
/* a small picture of a candidate: its floor, the rooms around it (dim), objects, monsters, heroes and the opener */
function desenharCandidato(cv, c, p = projeto) {
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height; g.fillStyle = '#16181c'; g.fillRect(0, 0, W, H);
  const cells = []; c.sala.pecas.forEach(q => casasDaPeca(q).forEach(([x, y]) => cells.push([x, y])));
  const xs = cells.map(k => k[0]), ys = cells.map(k => k[1]); const m = 2;
  const x0 = Math.min(...xs) - m, y0 = Math.min(...ys) - m, x1 = Math.max(...xs) + m, y1 = Math.max(...ys) + m;
  const t = Math.floor(Math.min(W / (x1 - x0 + 1), H / (y1 - y0 + 1))); const ox = (W - t * (x1 - x0 + 1)) / 2, oy = (H - t * (y1 - y0 + 1)) / 2;
  const px = x => ox + (x - x0) * t, py = y => oy + (y - y0) * t;
  // the rooms around
  p.salas.forEach(s => s.pecas.forEach(q => { if (ehAlfombra(q.tile)) return; casasDaPeca(q).forEach(([x, y]) => { if (x < x0 || x > x1 || y < y0 || y > y1) return; g.fillStyle = '#2c3037'; g.fillRect(px(x), py(y), t - 1, t - 1); }); }));
  c.sala.pecas.forEach(q => { if (ehAlfombra(q.tile)) return; const cor = COR_PISO[PECA[q.tile]?.floor] || '#777'; casasDaPeca(q).forEach(([x, y]) => { g.fillStyle = cor; g.fillRect(px(x), py(y), t - 1, t - 1); if (q.level) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(px(x), py(y), t - 1, t - 1); } }); });
  c.sala.pecas.forEach(q => { if (!ehAlfombra(q.tile)) return; g.fillStyle = COR_ALFOMBRA[q.tile] || 'rgba(80,120,200,.5)'; casasDaPeca(q).forEach(([x, y]) => g.fillRect(px(x), py(y), t - 1, t - 1)); });
  // the outline of each tile
  g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1;
  c.sala.pecas.forEach(q => { if (ehAlfombra(q.tile)) return; const S = new Set(casasDaPeca(q).map(k => k.join(','))); casasDaPeca(q).forEach(([x, y]) => { [[0, -1, 0, 0, 1, 0], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1], [1, 0, 1, 0, 1, 1]].forEach(([dx, dy, a, b, cc, d]) => { if (S.has((x + dx) + ',' + (y + dy))) return; g.beginPath(); g.moveTo(px(x + a), py(y + b)); g.lineTo(px(x + cc), py(y + d)); g.stroke(); }); }); });
  const glifo = (o, xx, yy, ww, hh) => { const img = imagemObj(o.type); if (img && img.complete && img.naturalWidth) g.drawImage(img, xx + 1, yy + 1, ww - 2, hh - 2); else { g.fillStyle = '#e0a458'; g.font = Math.max(8, t * 0.6) + 'px system-ui'; g.textAlign = 'center'; g.fillText((baseObj(o.type) || '?')[0], xx + ww / 2, yy + hh * 0.72); } };
  c.sala.objetos.forEach(o => { const cs = casasDoObjeto(o); const ax = Math.min(...cs.map(k => k[0])), ay = Math.min(...cs.map(k => k[1])), bx = Math.max(...cs.map(k => k[0])), by = Math.max(...cs.map(k => k[1]));
    if (ehTipo(o, 'Staircase')) { g.fillStyle = 'rgba(243,207,143,.35)'; g.fillRect(px(ax), py(ay), (bx - ax + 1) * t, (by - ay + 1) * t); return; }
    g.fillStyle = 'rgba(20,20,24,.55)'; g.fillRect(px(ax), py(ay), (bx - ax + 1) * t - 1, (by - ay + 1) * t - 1); glifo(o, px(ax), py(ay), (bx - ax + 1) * t, (by - ay + 1) * t); });
  (c.sala.inimigos || []).forEach(e => { g.beginPath(); g.arc(px(e.pos[0]) + t / 2, py(e.pos[1]) + t / 2, t * 0.36, 0, Math.PI * 2); if (ehPool(e.enemy)) { g.strokeStyle = COR.pool; g.lineWidth = 2; g.stroke(); } else { g.fillStyle = COR.inimigo; g.fill(); } });
  c.sala.objetos.forEach(o => (o.gatilhos || []).forEach(gg => { if (gg.tipo === 'spawn') (gg.cells || []).forEach(k => { g.beginPath(); g.arc(px(k[0]) + t / 2, py(k[1]) + t / 2, t * 0.3, 0, Math.PI * 2); g.setLineDash([2, 2]); g.strokeStyle = COR.spawn; g.lineWidth = 2; g.stroke(); g.setLineDash([]); }); }));
  (c.sala.herois || []).forEach(h => { g.fillStyle = COR.heroi; g.fillRect(px(h[0]) + t * 0.2, py(h[1]) + t * 0.2, t * 0.6, t * 0.6); });
  (c.abridor ? casasDoObjeto(c.abridor.objeto) : c.abertura || []).forEach(([x, y]) => { g.strokeStyle = COR.abre; g.lineWidth = 2; g.strokeRect(px(x) + 1, py(y) + 1, t - 3, t - 3); });
  (c.entrada || []).forEach(([x, y]) => { if (c.abridor || c.dono) { g.fillStyle = 'rgba(224,164,88,.5)'; g.fillRect(px(x) + t * 0.35, py(y) + t * 0.35, t * 0.3, t * 0.3); } });
}
/* Generate room: the starting room right away; any other room is opened by an object or monster of the map, clicked
   first (it gets the trigger "Open a room" when a generated room is used) */
function iniciarGerador() {
  descartarPrevia(); const j = $('#janelaGerador'); if (j) j.hidden = true;
  if (!projeto.salas.length) { GER.dono = null; return abrirGerador(); }
  pedirClique({ modo: 'object', texto: tr('Click the object or monster that will open the new room: it gets the trigger “Open a room”. Esc cancels.'), cb: (x, y, q) => {
    const d = donoDoClique(q); if (!d) { aviso(tr('Click an object or a monster of the map (staircases and bridges are floor).')); return false; }
    GER.dono = d; setTimeout(abrirGerador, 0); return true; } });
}
function donoDoClique(q) {
  if (!q) return null; const s = projeto.salas[q.sala]; if (!s || s._previa) return null;
  if (q.tipo === 'objeto') { const o = s.objetos[q.i]; if (!o || ehTerreno(o)) return null; return { sala: q.sala, holder: o, rotulo: o.name || tr(rotulo(o)), casas: casasDoObjeto(o) }; }
  if (q.tipo === 'inimigo') { const e = listaDe(q)?.[q.i]; if (!e) return null; const holder = ehPool(e.enemy) ? grupoPoolDe(s) : e;
    return { sala: q.sala, holder, rotulo: ehPool(e.enemy) ? tr('the balanced group of this room') : nomeIni(e.enemy), casas: [[e.pos[0], e.pos[1]]] }; }
  return null;
}
function abrirGerador() {
  const d = painelFlutuante('janelaGerador', tr('Generate a room'), () => { descartarPrevia(); d.hidden = true; tudo(); });
  d.hidden = false; const corpo = d.querySelector('.corpo');
  const o = GER.opcoes = GER.opcoes || { atos: ATOS.get(), arquetipo: 'random', tamanho: 'M', intensidade: 5, tema: 'qualquer', objetos: 'normal', inimigos: 'balanceado', escolhidos: [], funcao: '', semente: novaSemente(), ponto: 'random', abridor: 'random' };
  const dono = projeto.salas.length ? GER.dono : null;
  const perto = pt => Math.min(...dono.casas.map(([x, y]) => Math.abs(x - pt.casa[0]) + Math.abs(y - pt.casa[1])));
  const pontos = !projeto.salas.length ? [] : dono ? pontosDeLigacao().filter(pt => pt.sala === dono.sala).sort((a, b) => perto(a) - perto(b)) : pontosDeLigacao();
  const arqs = todosArquetipos().filter(a => a.id !== 'niveis');   // (height is a trait of any room, not a kind of its own)
  const sel = (id, lista, v) => `<select id="${id}">${lista.map(([k, t]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  corpo.innerHTML = `${dono ? `<p class="linha">Opened by: <b data-sem-traducao>${esc(dono.rotulo)}</b> (room ${dono.sala + 1}) <button class="sm" id="gr_outro">Pick another</button></p>` : ''}<p class="ajuda">${dono ? 'The new room starts at an edge of that room, near it (in front of it, when it is a door at the edge). Used, it gets the trigger “Open a room”.' : projeto.salas.length ? 'The new room starts at the edge you pick, behind a door or a token of that room that opens it.' : 'The map is empty: the room will be the starting room, with the hero spaces.'} Each click on Generate makes three new candidates, each with its score (how close its measures are to the archetype) and what it does well. The one you pick appears on the board, framed and marked “preview” in the list of rooms, so you see it in place. It becomes a room of the map only with “Use this”.</p>
    <div class="geradorOpcoes">
      <label class="campo">Archetype ${sel('gr_arq', [['random', 'Random']].concat(arqs.map(a => [a.id, tr(a.nome)])), o.arquetipo)}</label>
      <label class="campo">Size ${sel('gr_tam', [['P', 'Small'], ['M', 'Medium'], ['G', 'Large']], o.tamanho)}</label>
      <label class="campo">Intensity <input id="gr_int" type="number" min="1" max="10" value="${o.intensidade}" style="width:60px"></label>
      <label class="campo">Terrain and theme ${sel('gr_tema', Object.entries(TEMAS_SALA).map(([k, t]) => [k, t.nome]), o.tema)}</label>
      <label class="campo">Objects ${sel('gr_obj', [['poucos', 'Few'], ['normal', 'Normal'], ['muitos', 'Many']], o.objetos)}</label>
      <label class="campo">Monsters ${sel('gr_ini', [['balanceado', 'Balanced group (the game\'s rule)'], ['escolhidos', 'Monsters I pick'], ['nenhum', 'None']], o.inimigos)}</label>
      <label class="campo">Story function ${sel('gr_fun', [['', 'The archetype\'s own']].concat(FUNCOES_SALA.slice(1)), o.funcao)}</label>
      <label class="campo" title="Tiles, objects, monsters and items the generator may use: those of the boxes you own">Boxes ${sel('gr_atos', OPCOES_ATOS, o.atos)}</label>
      <label class="campo" title="Each Generate uses a new seed. To see a room again, type its seed here before generating.">Seed <input id="gr_sem" value="${esc(o.semente)}" style="width:90px"></label>
    </div>
    <div id="gr_escolhidos" ${o.inimigos === 'escolhidos' ? '' : 'hidden'}><div class="sub">Monsters of the room</div><div class="linha" style="flex-wrap:wrap">${MONSTROS().map(m => `<label class="chk"><input type="checkbox" data-m="${m.id}" ${o.escolhidos.includes(m.id) ? 'checked' : ''}> ${esc(m.nome)}</label>`).join('') || '<span class="ajuda">No monster in the Workshop yet.</span>'}</div></div>
    ${pontos.length ? `<div class="linha" style="flex-wrap:wrap"><label class="campo">Where it starts ${sel('gr_pto', [['random', dono ? 'The edges nearest to it' : 'Random edge']].concat(pontos.map((pt, i) => [i, (pt.sala + 1) + ' · ' + projeto.salas[pt.sala].nome + ' · ' + nomeDirecao(pt.dir) + ' (' + pt.casa.join(',') + ')'])), pontos[+o.ponto] ? o.ponto : 'random')}</label>
      ${dono ? '' : `<label class="campo">Opened by ${sel('gr_abr', [['random', 'Random'], ['Door', 'A door'], ['SightToken', 'A point of interest (passage)'], ['Archway', 'An archway, with a point of interest in it']], o.abridor)}</label>`}</div>` : dono ? '<p class="ajuda aviso">That room has no free edge for a new room: pick an object of another room.</p>' : ''}
    <div class="linha"><button class="primario" id="gr_gerar">✦ Generate</button><button class="sm" id="gr_arqs" title="Write your own archetypes">Archetypes…</button><span class="ajuda" id="gr_info"></span></div>
    <div id="gr_cands" class="geradorCands"></div>
    <div id="gr_lugar" hidden><div class="linha" style="flex-wrap:wrap"><span class="rotuloTx">Place it on the board</span><button class="sm" data-mv="-1,0" title="Left">←</button><button class="sm" data-mv="0,-1" title="Up">↑</button><button class="sm" data-mv="0,1" title="Down">↓</button><button class="sm" data-mv="1,0" title="Right">→</button><button class="sm" id="gr_gira">⟳ Rotate (R)</button><span id="gr_lugarInfo" class="ajuda"></span></div>
      <p class="ajuda">Drag the room on the board to put it where you want; the arrow keys move it and R turns it.</p></div>
    <div id="gr_travas" hidden><div class="linha"><span class="rotuloTx">Variations of the picked one: keep its</span><label class="chk"><input type="checkbox" id="gr_tp" checked> tiles</label><label class="chk"><input type="checkbox" id="gr_to"> objects</label><label class="chk"><input type="checkbox" id="gr_ti"> monsters</label><button class="sm" id="gr_regerar">↻ Make variations</button></div><p class="ajuda">Three new candidates with what you keep and the rest made again (tiles kept: same place and shape, new objects and monsters).</p></div>`;
  const ler = () => { o.arquetipo = $('#gr_arq').value; o.tamanho = $('#gr_tam').value; o.intensidade = Math.max(1, Math.min(10, +$('#gr_int').value || 5)); o.tema = $('#gr_tema').value; o.objetos = $('#gr_obj').value; o.inimigos = $('#gr_ini').value; o.funcao = $('#gr_fun').value; o.semente = $('#gr_sem').value.trim() || novaSemente(); o.atos = +$('#gr_atos').value === 1 ? 1 : 2; ATOS.set(o.atos);
    o.escolhidos = [...corpo.querySelectorAll('[data-m]:checked')].map(c => c.dataset.m); if ($('#gr_pto')) o.ponto = $('#gr_pto').value; if ($('#gr_abr')) o.abridor = $('#gr_abr').value; };
  $('#gr_ini').onchange = () => { $('#gr_escolhidos').hidden = $('#gr_ini').value !== 'escolhidos'; };
  $('#gr_arqs').onclick = () => editarArquetipos();
  const outro = $('#gr_outro'); if (outro) outro.onclick = () => iniciarGerador();
  corpo.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const [dx, dy] = b.dataset.mv.split(',').map(Number); moverPrevia(dx, dy); });
  $('#gr_gira').onclick = () => girarPrevia();
  const optsDe = (base, travas) => { const rng = rngDe(o.semente + '#opts'); const arq = o.arquetipo === 'random' ? rng.pick(arqs.filter(a => !(projeto.salas.length === 0 && a.id === 'chefe') && a.id !== 'abertura')).id : o.arquetipo;
    return { arquetipo: arq, tamanho: o.tamanho, intensidade: o.intensidade, tema: o.tema, objetos: o.objetos, inimigos: o.inimigos, escolhidos: o.escolhidos, funcao: o.funcao, semente: o.semente, atos: o.atos, ligacao: null, abridor: o.abridor, dono: dono ? { sala: dono.sala, casas: dono.casas } : null, base, travas }; };
  // the edges to try: the one picked, or all of them shuffled (the edge of the last generation last), until one gives rooms
  const gerarNasBordas = op => {
    if (!pontos.length) return gerarCandidatos(op);
    const rng = rngDe(o.semente + '#bordas');
    const mesma = pt => GER.ultimoPonto && pt.sala === GER.ultimoPonto.sala && pt.casa[0] === GER.ultimoPonto.casa[0] && pt.casa[1] === GER.ultimoPonto.casa[1];
    // near the opener: the nearest edges first (the three nearest in a drawn order); otherwise any edge
    const ordem = o.ponto !== 'random' ? [pontos[+o.ponto]].filter(Boolean) : dono ? rng.embaralhar(pontos.slice(0, 3)).sort((a, b) => mesma(a) - mesma(b)).concat(pontos.slice(3)) : rng.embaralhar(pontos).sort((a, b) => mesma(a) - mesma(b));
    let r = null;
    for (const pt of ordem) { r = gerarCandidatos({ ...op, ligacao: pt }); if (r.candidatos.length) { GER.ultimoPonto = pt; return r; } }
    return r || gerarCandidatos(op); };
  // the picked candidate is shown on the board
  const escolher = i => { GER.escolhido = i; const c = GER.resultado?.candidatos[i]; if (c) { mostrarPrevia(c); enquadrar(); } mostrar(); };
  const mostrar = () => {
    const el = $('#gr_cands'); const r = GER.resultado; if (!r) { el.innerHTML = ''; return; }
    if (!r.candidatos.length) { el.innerHTML = `<p class="ajuda aviso">${esc(r.erro || 'No valid room came out: try another seed, a smaller size or another edge.')}</p>`; $('#gr_travas').hidden = true; return; }
    el.innerHTML = r.candidatos.map((c, i) => `<div class="cand ${GER.escolhido === i ? 'ativo' : ''}" data-c="${i}"><canvas width="220" height="190"></canvas><div class="linha"><b>${esc(tr(ARQUETIPO_SALA(c.arquetipo)?.nome || c.arquetipo))}</b><span class="etq">${c.nota}</span></div><p class="ajuda" data-sem-traducao>${esc(c.frase)}</p><div class="linha">${GER.escolhido === i ? '<span class="etq">On the board</span>' : `<button class="sm" data-prev="${i}">Show on the board</button>`}<button class="sm primario" data-usar="${i}">Use this</button></div></div>`).join('');
    el.querySelectorAll('.cand').forEach(div => desenharCandidato(div.querySelector('canvas'), r.candidatos[+div.dataset.c]));
    el.querySelectorAll('[data-prev]').forEach(b => b.onclick = ev => { ev.stopPropagation(); escolher(+b.dataset.prev); });
    el.querySelectorAll('.cand canvas').forEach(cv => cv.onclick = () => escolher(+cv.closest('.cand').dataset.c));
    el.querySelectorAll('[data-usar]').forEach(b => b.onclick = ev => { ev.stopPropagation(); if (usarCandidato(r.candidatos[+b.dataset.usar]) !== false) d.hidden = true; });
    $('#gr_travas').hidden = GER.escolhido < 0; renderLugarPrevia();
    $('#gr_info').textContent = r.validos + ' / ' + r.tentados + ' ' + tr('valid rooms');
  };
  // every Generate is a new draw: a new seed, unless one was typed in
  $('#gr_gerar').onclick = () => { ler(); if (!$('#gr_sem').value.trim() || o.semente === GER.sementeUsada) { o.semente = novaSemente(); $('#gr_sem').value = o.semente; } GER.sementeUsada = o.semente;
    // the Workshop is the source of the monsters (when the map's pool is empty) and of the items (when the item pool lacks them)
    const precisa = { monstros: o.inimigos === 'balanceado' && !reservaComMonstros(projeto), itens: !reservaDeItensCompleta(projeto) };
    const faltas = faltasDaOficina(o.atos, precisa); if (faltas.length) { descartarPrevia(); GER.resultado = null; GER.escolhido = -1; $('#gr_travas').hidden = true; tudo(); return mostrarFaltas($('#gr_cands'), faltas, o.atos, precisa, () => $('#gr_gerar').click()); }
    comEspera($('#gr_gerar'), () => { descartarPrevia(); GER.escolhido = -1; GER.resultado = gerarNasBordas(optsDe());
      if (typeof Tutorial !== 'undefined' && Tutorial.ativo() && Tutorial.umCandidato()) GER.resultado.candidatos = GER.resultado.candidatos.slice(0, 1);   // (the tutorial: one room to place)
      tudo(); if (GER.resultado.candidatos.length) escolher(0); else mostrar(); }); };
  $('#gr_regerar').onclick = () => { ler(); const base = GER.resultado?.candidatos[GER.escolhido]; if (!base) return aviso(tr('Pick a candidate first.'));
    const trv = { pecas: $('#gr_tp').checked || $('#gr_to').checked || $('#gr_ti').checked, objetos: $('#gr_to').checked, inimigos: $('#gr_ti').checked };
    o.semente = novaSemente(); $('#gr_sem').value = o.semente; GER.sementeUsada = o.semente; descartarPrevia();
    const op = optsDe(base, trv); op.arquetipo = base.arquetipo;
    comEspera($('#gr_regerar'), () => { GER.resultado = trv.pecas ? gerarCandidatos({ ...op, ligacao: base.ligacao }) : base.ligacao ? gerarCandidatos({ ...op, ligacao: base.ligacao }) : gerarNasBordas(op);
      GER.escolhido = -1; tudo(); if (GER.resultado.candidatos.length) escolher(0); else mostrar(); }); };
  mostrar();
}
/* the candidate on the board, as a room of the map, until another is picked or the window closes. The user may drag it,
   move it with the arrows and turn it (R) before using it */
function mostrarPrevia(c) {
  descartarPrevia();
  const s = clone(c.sala); s._previa = true; projeto.salas.push(s); const si = projeto.salas.length - 1;
  if (c.abridor) { if (c.abridor.moldura) projeto.salas[c.abridor.sala].objetos.push({ ...clone(c.abridor.moldura), _previa: true });
    const ob = clone(c.abridor.objeto); ob._previa = true; anexarAbertura(ob, c, si, true); projeto.salas[c.abridor.sala].objetos.push(ob); porGemeo(projeto, c); }
  if (c.dono && GER.dono?.holder) GER.gatPrevia = anexarAbertura(GER.dono.holder, c, si, false);
  GER.previa = si; GER.previaDe = c; salaAtual = si; sel = null; limparAbridores(); tudo(); renderLugarPrevia();
}
function descartarPrevia() {
  if (GER.gatPrevia) { const { h, gs, chaves } = GER.gatPrevia; h.gatilhos = (h.gatilhos || []).filter(x => !gs.includes(x)); chaves.forEach(k => delete h[k]); GER.gatPrevia = null; }
  if (GER.previa == null) return;
  projeto.salas.forEach(s => { s.objetos = s.objetos.filter(o => !o._previa); });
  projeto.salas = projeto.salas.filter(s => !s._previa); GER.previa = null; GER.previaDe = null;
  if (salaAtual >= projeto.salas.length) salaAtual = projeto.salas.length - 1; limparAbridores();
}

// ------------------------------------------------------------ moving and turning a whole room
/* every position of room s through f (squares) and fv (pillar sockets, at the corners of the squares) */
function mapearSala(s, f, fv, girou) {
  const cel = c => { const [x, y] = f(c[0], c[1]); return [x, y].concat(c.slice(2)); };
  s.pecas.forEach(q => { q.pos = f(q.pos[0], q.pos[1]); if (girou) q.rot = ((q.rot || 0) + girou) % 360; (q.pilares || []).forEach(v => { v.pos = fv(v.pos[0], v.pos[1]); }); });
  s.objetos.forEach(o => { const cs = casasDoObjeto(o).map(c => f(c[0], c[1])); if (girou) o.rot = ((o.rot || 0) + girou) % 360; o.pos = [Math.min(...cs.map(c => c[0])), Math.min(...cs.map(c => c[1]))]; });
  (s.inimigos || []).forEach(e => { e.pos = f(e.pos[0], e.pos[1]); });
  s.herois = (s.herois || []).map(cel);
  // the squares the triggers of the room point at (spawn spaces, where the heroes go, highlights)
  const donos = s.objetos.concat(s.inimigos || []).concat(s.grupoPool ? [s.grupoPool] : []);
  donos.forEach(o => todosGatilhos(o).forEach(g => { if (Array.isArray(g.cells)) g.cells = g.cells.map(cel); if (Array.isArray(g.cell)) g.cell = cel(g.cell); (g.inimigos || []).forEach(e => { if (e.pos) e.pos = f(e.pos[0], e.pos[1]); }); }));
}
function moverSala(s, dx, dy) { mapearSala(s, (x, y) => [x + dx, y + dy], (x, y) => [x + dx, y + dy], 0); }
/* a quarter turn clockwise, around the middle of its floor */
function girarSala(s) {
  const cs = s.pecas.filter(q => !ehAlfombra(q.tile)).flatMap(casasDaPeca); if (!cs.length) return;
  // the same pivot turn after turn (while the room is not moved), so four turns bring it back where it was
  const chave = JSON.stringify(cs); const g = s._giro;
  const [px, py] = g && g.depois === chave ? g.pivo : [Math.round(cs.reduce((a, c) => a + c[0], 0) / cs.length), Math.round(cs.reduce((a, c) => a + c[1], 0) / cs.length)];
  mapearSala(s, (x, y) => [px - (y - py), py + (x - px)], (x, y) => [px + py - y + 1, py - px + x], 90);
  Object.defineProperty(s, '_giro', { value: { pivo: [px, py], depois: JSON.stringify(s.pecas.filter(q => !ehAlfombra(q.tile)).flatMap(casasDaPeca)) }, configurable: true, enumerable: false, writable: true });
}
/* where the room on the board stands: overlapping another room, touching the map, or apart from it */
function situacaoDaSala(si) {
  const s = projeto.salas[si]; if (!s) return { choca: 0, toca: false };
  const choca = s.pecas.filter((q, qi) => colide(q, si, qi)).length;
  const meu = chaoDaSala(si); let toca = false;
  projeto.salas.forEach((o, oi) => { if (oi === si || toca || o._previa) return; const ch = chaoDaSala(oi);
    meu.forEach(c => { if (toca) return; VIZ4.forEach(([dx, dy]) => { const n = ch.get((c.x + dx) + ',' + (c.y + dy)); if (n && passa(c, n)) toca = true; }); }); });
  return { choca, toca };
}
/* a generated room waits on the board, with its window open: it can be dragged, moved and turned */
const posicionandoPrevia = () => GER.previa != null && !escolha && !ferramenta && salaAtual === GER.previa && !!$('#janelaGerador') && !$('#janelaGerador').hidden;
function moverPrevia(dx, dy) { const s = projeto.salas[GER.previa]; if (!s) return; moverSala(s, dx, dy); desenhar(); renderLugarPrevia(); }
function girarPrevia() { const s = projeto.salas[GER.previa]; if (!s) return; girarSala(s); desenhar(); renderLugarPrevia(); }
/* the line of the window that says where the room stands */
function renderLugarPrevia() {
  const el = $('#gr_lugarInfo'); if (!el) return; const box = $('#gr_lugar'); if (box) box.hidden = GER.previa == null;
  if (GER.previa == null) return; const st = situacaoDaSala(GER.previa);
  el.className = 'ajuda ' + (st.choca ? 'erro' : st.toca || GER.previa === 0 ? 'ok' : 'aviso');
  el.textContent = st.choca ? tr('It overlaps another room: move it.') : GER.previa === 0 ? tr('The starting room.') : st.toca ? tr('It touches the map.') : tr('It touches no tile of the map: the heroes will be moved there (you will click where).');
}
/* the room on the board becomes a room of the map. Placed apart from the map, the heroes are moved there: the user clicks
   the spaces where they appear */
function usarCandidato(c) {
  if (GER.previaDe !== c || GER.previa == null) mostrarPrevia(c);
  const nova = GER.previa; const s = projeto.salas[nova]; const st = situacaoDaSala(nova);
  if (st.choca) { aviso(tr('It overlaps another room: move it.')); return false; }
  delete s._previa; projeto.salas.forEach(ss => ss.objetos.forEach(o => { delete o._previa; }));
  let dono = null;
  if (GER.gatPrevia) { dono = GER.gatPrevia.h; GER.gatPrevia = null; }
  else if (c.abridor) dono = projeto.salas[c.abridor.sala].objetos.find(o => todosGatilhos(o).some(g => g.tipo === 'open_room' && g.sala === nova)) || null;
  GER.previa = null; GER.previaDe = null; GER.dono = null;
  // the chests and searches of the room draw from the item pool, the balanced spaces from the monster pool: from the Workshop when empty
  const atosC = c.opcoes?.atos || ATOS.get(); const avisos = [];
  if (donosDaSala(s).some(({ o }) => todosGatilhos(o).some(g => g.tipo === 'give_item' && g.modo === 'random'))) { const n = prepararItens(projeto, atosC); if (n) avisos.push(tr('The item pool of the map now has the items and materials of the Workshop') + ' (' + n + ')'); }
  const usaReserva = s.inimigos.some(e => ehPool(e.enemy)) || donosDaSala(s).some(({ o }) => todosGatilhos(o).some(g => g.tipo === 'spawn' && g.fonte === 'pool'));
  if (usaReserva) { const n = prepararReserva(projeto, atosC, rngDe(novaSemente())); if (n) avisos.push(tr('The monster pool of the map now has monsters of the Workshop') + ' (' + n + ')'); }
  salaAtual = nova; sel = null; limparAbridores(); tudo(); renderConferencia();
  aviso(tr('Room added') + ': ' + (nova + 1) + ' · ' + s.nome); if (avisos.length) avisoLongo(avisos.join('. ') + '.');
  if (nova > 0 && !st.toca && dono) pedirTransferencia(nova, dono);
  return true;
}
/* a room apart from the map: the object that opens it also moves the heroes there (up to 4 spaces, clicked on the new room) */
function pedirTransferencia(si, dono) {
  const g = { uid: uid(), tipo: 'move_heroes', cells: [], text: '', requisitos: [] }; dono.gatilhos = (dono.gatilhos || []).concat([g]);
  const texto = tr('The new room touches no tile of the map, so the heroes will be moved there. Click the spaces of the new room where they appear (up to 4; Esc when done).');
  avisoLongo(texto);
  pedirClique({ modo: 'space', texto, repetir: true, cb: (x, y) => {
      if (salaNoNivel(x, y, nivel) !== si) { aviso(tr('Click a space of the new room.')); return false; }
      if (g.cells.some(c => c[0] === x && c[1] === y)) return false;
      g.cells.push(nivel > 0 ? [x, y, nivel] : [x, y]); if (g.cells.length >= 4) setTimeout(terminarClique, 0); return true; },
    aoTerminar: () => { if (!g.cells.length) { dono.gatilhos = dono.gatilhos.filter(x => x !== g); avisoLongo(tr('No space was clicked: the heroes are not moved. Give the object that opens the room a “Move the heroes” trigger later.')); }
      else aviso(tr('The heroes will be moved to the new room') + ' (' + g.cells.length + ').'); } });
}
/* the user's own archetypes: JSON in the browser, same format as ARQUETIPOS_SALA */
function editarArquetipos() {
  const atual = JSON.stringify(arquetiposProprios(), null, 2);
  modal(tr('Archetypes of the generator'), `<p class="ajuda">Your own archetypes, in the same format as the built-in ones (see GERADOR.md next to the editor). One with the id of a built-in archetype replaces it. They stay in this browser.</p>
    <textarea id="ga_json" rows="18" style="width:100%;font-family:monospace;font-size:12px" data-sem-traducao>${esc(atual === '[]' ? '' : atual)}</textarea>
    <div class="rodape"><button data-o="modelo">Copy a built-in one as a start</button><button data-o="cancel">Cancel</button><button class="primario" data-o="ok">Save</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="cancel"]').onclick = fechar;
    el.querySelector('[data-o="modelo"]').onclick = () => { const t = el.querySelector('#ga_json'); let l = []; try { l = t.value.trim() ? JSON.parse(t.value) : []; } catch { } const m = clone(ARQUETIPOS_SALA.find(a => a.id === ($('#gr_arq')?.value || '')) || ARQUETIPOS_SALA[0]); m.id = m.id + '-meu'; m.nome = m.nome + ' (mine)'; l.push(m); t.value = JSON.stringify(l, null, 2); };
    el.querySelector('[data-o="ok"]').onclick = () => { const t = el.querySelector('#ga_json').value.trim(); let l = [];
      if (t) { try { l = JSON.parse(t); } catch (e) { return aviso(tr('That is not valid JSON') + ': ' + e.message); } if (!Array.isArray(l) || l.some(a => !a || !a.id || !Array.isArray(a.area) || !Array.isArray(a.pecas))) return aviso(tr('Each archetype needs at least id, area [min,max] and pecas [min,max].')); }
      try { localStorage.setItem('bigorna-arquetipos', JSON.stringify(l)); } catch { } fechar(); abrirGerador(); aviso(tr('Archetypes saved') + ': ' + l.length); };
  });
}

// ------------------------------------------------------------ the default of each object
/* "Default": the generic programming each piece carries, as the game's own pieces do (a chest is opened once and holds
   things; a tree, a well, a bookshelf… are searched with three answers, the game's ones; a door, a gate, a point of interest
   or an interaction token open a room). Pieces with no programming in the game (the archway, the bell frame, pillars,
   staircases, ladders, bridges) have none. The Workshop may replace the default of any kind, its own objects too
   (oficina().padroes[kind], saved from an object programmed on the map). The object palette places the default version or
   an empty one */
const SEM_PADRAO = new Set(['Archway', 'BellFrame', 'PillarObj', 'PillarPush', 'PillarPushShort', 'Pillar', 'PillarShort', 'PillarTall', 'Staircase', 'Ladder', 'LadderMedium', 'Bridge', 'DragonArch', 'Platform', 'Vault']);
const CHAVES_PROGRAMACAO = ['textClick', 'textUse', 'gatilhos', 'requisitos', 'senao', 'usos', 'acaoExtra'];
/* what an object does, apart from where it stands */
function programacaoDe(o) { const p = {}; Object.keys(o || {}).forEach(k => { if (CHAVES_PROGRAMACAO.includes(k) || (k.includes(':') && Array.isArray(o[k]))) p[k] = clone(o[k]); }); return p; }
/* a copy with fresh uids (every trigger of the copy is its own) */
function renovarUids(p) { const velhos = new Set(); const andar = x => { if (Array.isArray(x)) x.forEach(andar); else if (x && typeof x === 'object') { if (typeof x.uid === 'string' && x.uid) velhos.add(x.uid); Object.values(x).forEach(andar); } }; andar(p);
  // in two steps (old uids to marks, marks to new uids): a new uid never meets an old one that is part of it
  let t = JSON.stringify(p); const ordem = [...velhos].sort((a, b) => b.length - a.length); ordem.forEach((u, i) => { t = t.split(u).join('\u0001' + i + '\u0001'); }); ordem.forEach((u, i) => { t = t.split('\u0001' + i + '\u0001').join(uid()); }); return JSON.parse(t); }
function padraoOriginal(tipo) {
  const t = baseObj(tipo); if (!t || SEM_PADRAO.has(t) || !OBJETO[t]) return null;
  const olhar = TEXTOS_OLHAR[t] ? L2(TEXTOS_OLHAR[t].en[0], TEXTOS_OLHAR[t].pt[0]) : '';
  const o = { type: t, textClick: olhar, textUse: '', gatilhos: [], requisitos: [], senao: [] };
  if (BUSCAS[t]) { busca(o, BUSCAS[t]); o.textClick = T2(BUSCAS[t].olhar); }
  else if (t === 'Chest') o.gatilhos = [{ uid: uid(), tipo: 'give_item', modo: 'random', points: 20, requisitos: [] }, ouroDe(15)];
  else if (t === 'Door' || t === 'Gate') o.gatilhos = [{ uid: uid(), tipo: 'open_room', sala: '', requisitos: [] }];
  else if (t === 'SightToken' || t === 'InteractToken') { o.textClick = t === 'SightToken' ? '' : L2('Something here deserves a closer look.', 'Algo aqui merece um olhar mais atento.'); o.gatilhos = [{ uid: uid(), tipo: 'open_room', sala: '', requisitos: [] }, autoRemocao()]; }
  else return null;
  const p = programacaoDe(o); return p;
}
const padroesDaOficina = () => { const b = oficina(); b.padroes = b.padroes && typeof b.padroes === 'object' && !Array.isArray(b.padroes) ? b.padroes : {}; return b.padroes; };
/* the default of a kind: the Workshop's, or the game's; a fresh copy each time (null: the kind has none) */
function padraoDe(tipo) { const w = padroesDaOficina()[tipo]; const p = w ? clone(w) : padraoOriginal(tipo); return p ? renovarUids(p) : null; }
/* a default the generator may put in any room: it does something, and points at no room nor object of the map it came from */
const padraoPortatil = tipo => { const w = padroesDaOficina()[tipo]; if (!w || !(w.gatilhos || []).length) return false; const t = JSON.stringify(w); return !/"(open_room|remove_room|add_tile|remove_tile)"|"objSala"|"sala":/.test(t); };
const temPadrao = tipo => !!(padroesDaOficina()[tipo] || padraoOriginal(tipo));
/* the programming with its uids numbered in the order they appear (two copies of the same default compare equal) */
function formaDaProgramacao(p) {
  p = p || {}; const ids = new Map(); const dar = u => { if (typeof u === 'string' && u && !ids.has(u)) ids.set(u, '#' + ids.size + '#'); };
  // numbered in the order of the triggers, and of what each of them holds (its answers, its success and failure…)
  const vistos = new Set();
  const visitar = lista => { (lista || []).forEach(g => dar(g && g.uid)); (lista || []).forEach(g => { if (!g || !g.uid || vistos.has(g.uid)) return; vistos.add(g.uid); Object.keys(p).filter(k => k.endsWith(':' + g.uid)).sort((x, y) => x.split(':')[0].localeCompare(y.split(':')[0])).forEach(k => visitar(p[k])); }); };
  visitar(p.gatilhos); visitar(p.senao);
  let t = JSON.stringify(p); [...ids.keys()].sort((x, y) => y.length - x.length).forEach(u => { t = t.split(u).join(ids.get(u)); });
  return JSON.stringify(ordenar(JSON.parse(t)));
}
const ordenar = x => Array.isArray(x) ? x.map(ordenar) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().filter(k => !(Array.isArray(x[k]) && !x[k].length && ['requisitos', 'senao'].includes(k)) && x[k] !== '' && x[k] !== undefined).map(k => [k, ordenar(x[k])])) : x;
/* saves object o's programming as the default of its kind; the same as the game's default, the Workshop keeps nothing.
   Returns 'salvo', 'original' (it was the game's) */
function salvarComoPadrao(o) { const p = programacaoDe(o); const orig = padraoOriginal(o.type);
  if (orig && formaDaProgramacao(p) === formaDaProgramacao(orig)) { delete padroesDaOficina()[o.type]; return 'original'; }
  padroesDaOficina()[o.type] = p; return 'salvo'; }
const usarPadraoObjeto = () => { const t = typeof Tutorial !== 'undefined' && Tutorial.ativo() ? Tutorial.padrao() : null; if (t === 'sim') return true; if (t === 'nao') return false;   // (the tutorial holds it at a step)
  try { return localStorage.getItem('bigorna-padrao-objeto') !== '0'; } catch { return true; } };
/* puts the default on object o (its triggers and texts are replaced) */
function aplicarPadrao(o) { const p = padraoDe(o.type); if (!p) return false; CHAVES_PROGRAMACAO.forEach(k => { delete o[k]; }); Object.keys(o).forEach(k => { if (k.includes(':') && Array.isArray(o[k])) delete o[k]; }); Object.assign(o, { textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] }, p); return true; }
