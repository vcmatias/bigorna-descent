/* Bigorna Rooms v2 — the interface: ribbon, room list, floating palette and properties, dialogs, keyboard. */
'use strict';
/* the label of a Workshop entry that may come from the game: from the game, changed (a game entry edited) or custom */
const etiquetaEstado = x => `<span class="etq ${x.custom ? 'custom' : ''}">${tr(x.base ? (x.custom ? 'changed' : 'from the game') : 'custom')}</span>`;

function tudo() { ajustarEspeciais(); renderCabecalho(); renderFaixa(); renderSalas(); renderPaleta(); renderPropriedades(); renderConferencia(); desenhar(); }

// ------------------------------------------------------------ header
function renderCabecalho() {
  const em = !!campanha;
  $('#btnCampanha').textContent = em ? 'Campaign ▸' : 'Start a campaign';
  $('#btnExportar').textContent = (em ? 'Export campaign' : 'Export map') + (Config.nomePasta() ? ' → ' + Config.nomePasta() : '');
  $('#blocoCampanha').hidden = !em;
  if (em) { const m = campanha.missoes[missaoAtual], no = noDaMissao(missaoAtual); $('#campNome').textContent = campanha.meta.name || '(campaign without a name)'; $('#missaoAtualInfo').innerHTML = `<span class="n">${missaoAtual + 1}</span><div><div>${esc(m?.meta.name || 'Map ' + (missaoAtual + 1))}</div><small>${m?.salas.length || 0} rooms${no && no.tipo === 'side' ? ' · side quest' : ''} · map ${missaoAtual + 1} of ${campanha.missoes.length}</small></div>`; }
  $('#btnMapa').disabled = !projeto.meta.name;
  $('#btnMapa').title = projeto.meta.name ? 'Music, scene, spawn pool, final mission, intro' : 'Give the map a name first';
}
function camposDaMissao() { normalizar(projeto); $('#m_nome').value = projeto.meta.name || ''; }

// ------------------------------------------------------------ ribbon (tools, level, view)
const FERRAMENTAS = [
  ['peca', 'Tile', 'T', 'Pick a tile in the palette and click the board. R rotates. Each physical tile (side A or B) only once per room; same-level tiles cannot overlap. Underlays go under the tiles.'],
  ['heroi', 'Hero', 'H', 'Click the spaces where the heroes start (starting room only, 2 to 4).'],
  ['objeto', 'Object', 'O', 'Doors, chests, tokens… Any object can carry triggers and requirements. Staircases and bridges are floor: they may go off the tiles.'],
  ['inimigo', 'Enemy', 'E', 'Monsters placed in a room. In the starting room they are there from the start; in any other room they enter automatically when the room opens. Monsters that come later (in a room already open) use a “Spawn monsters” trigger.'],
  ['pilar', 'Pillar', 'P', 'Pick the level of the elevated tile on the ribbon and click one of its sockets (the dots: between two squares on a straight edge, never a corner). The pillar belongs to that tile and enters the game with it. Level 1 tiles take short, medium or tall pillars; level 2 medium or tall; level 3 tall.'],
  ['apagar', 'Delete', 'D', 'Click what you want to remove.'],
];
function renderFaixa() {
  const el = $('#faixa'); const semSala = salaAtual < 0 || !!escolha || vista3d.on;
  el.innerHTML = `<div class="grupo"><div class="botoes">${FERRAMENTAS.map(([id, nome, letra, ajuda]) => { const off = id === 'heroi' && salaAtual !== 0; return `<button data-f="${id}" class="fer ${ferramenta === id ? 'ativo' : ''}" ${semSala || off ? 'disabled' : ''} title="${esc(ajuda)} (${letra})"><span class="ico"><img src="${icone(id === 'peca' ? 'Tile' : id === 'heroi' ? 'Hero' : id === 'objeto' ? 'Chest' : id === 'inimigo' ? 'Enemy' : id === 'pilar' ? 'PillarObj' : 'Delete', '#f3cf8f', null)}" alt=""></span><span class="rot"><u>${letra}</u>${nome.slice(1)}</span></button>` + (id === 'pilar' ? `<button id="fxContas" class="fer" ${vista3d.on ? 'disabled' : ''} title="Every counter of the map (keys found, levers pulled…): create them, set where they start, see what adds to them and what waits for them"><span class="ico"><img src="${icone('Counter', '#f3cf8f', null)}" alt=""></span><span class="rot">Counts${contadoresDoMapa().length ? ' <span class="etq">' + contadoresDoMapa().length + '</span>' : ''}</span></button>` : ''); }).join('')}</div><div class="legenda">Place · Esc selects</div></div>
    <div class="grupo"><div class="botoes"><button id="fxRot" title="Rotate the selection or the piece in hand (R)" ${semSala ? 'disabled' : ''}>↻ Rotate</button><button id="fxCopiar" title="Copy the selection (Ctrl+C), then paste it with Ctrl+V: a click places each copy" ${!sel || !['objeto', 'inimigo'].includes(sel.tipo) ? 'disabled' : ''}>⧉ Copy</button><button id="fxColar" title="Paste the copied piece (Ctrl+V): click where it goes" ${!areaCopia || semSala ? 'disabled' : ''}>📋 Paste</button></div><div class="legenda">Edit</div></div>
    <div class="grupo"><div class="botoes niveis">${[0, 1, 2, 3, 4, 5, 6].map(l => `<button data-nv="${l}" class="${nivel === l ? 'ativo' : ''}" ${l > nivelMaximoLiberado() ? 'disabled' : ''} title="${l > 3 && l > nivelMaximoLiberado() ? 'Levels 4 to 6 open once something stands at level 3 (the game box of Act I, a tile at level 3)' : 'Level you work on (PageUp / PageDown): new pieces go there and only what is on it can be picked'}">${l}</button>`).join('')}</div><div class="legenda">Level ${nivel > 0 ? '· only level ' + nivel + ' is editable' : '· floor'}</div></div>
    <div class="grupo"><div class="botoes"><button id="fxMenos" title="Zoom out (−)">−</button><button id="fxMais" title="Zoom in (+)">+</button><button id="fxEnq" title="Fit the map in view">⤢ Fit</button><button id="fx3d" class="${vista3d.on ? 'ativo' : ''}" title="Turn the map in three dimensions to see the layers (3). Looking only: go back to the plan to edit.">◈ 3D</button></div><div class="legenda">${vista3d.on ? 'View · drag moves · right-drag turns' : 'View · drag to pan · wheel zooms'}</div></div>
    <div class="grupo cresce"><div class="salaTitulo">${salaAtual < 0 ? 'No room yet' : 'Room ' + (salaAtual + 1) + ' · ' + esc(projeto.salas[salaAtual].nome)}</div><div class="legenda">${vista3d.on ? '3D view: drag moves the map; turn and tilt it with the panel on the board (or Q/E, W/S, right-drag). Esc or the 3D button returns to the plan.' : escolha ? '<span class="pedido">' + esc(escolha.texto) + '</span>' : ferramenta ? esc(FERRAMENTAS.find(f => f[0] === ferramenta)[3]) : 'Click a piece to edit it · drag to move · arrows nudge · Esc clears'}</div></div>`;
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { ferramenta = ferramenta === b.dataset.f ? null : b.dataset.f; sel = null; tudo(); });
  el.querySelectorAll('[data-nv]').forEach(b => b.onclick = () => mudarNivel(+b.dataset.nv));
  $('#fxContas').onclick = abrirContadores;
  $('#fxRot').onclick = girar_selecao; $('#fxCopiar').onclick = () => copiarSelecao(); $('#fxColar').onclick = () => colar();
  $('#fxMenos').onclick = () => zoomCentro(1 / 1.2); $('#fxMais').onclick = () => zoomCentro(1.2); $('#fxEnq').onclick = enquadrar; $('#fx3d').onclick = () => alternar3d();
}
/* the level in work: like the rooms, only what is on it can be picked; the selection is dropped when it is not there */
function mudarNivel(l) {
  if (l === nivel) return; nivel = l;
  if (sel && sel.tipo !== 'contador') { const it = sel.tipo === 'pilar' ? projeto.salas[sel.sala]?.pecas[sel.pi] : sel.tipo === 'heroi' ? null : listaDe(sel)?.[sel.i]; const lv = sel.tipo === 'heroi' ? projeto.salas[sel.sala]?.herois[sel.i]?.[2] : sel.tipo === 'peca' && it && ehAlfombra(it.tile) ? 0 : it?.level; if (!noNivel(lv, sel.tipo === 'objeto' && it && ehTipo(it, 'Staircase'))) sel = null; }
  tudo();
}
function girar_selecao() {
  if (sel && sel.tipo === 'contador') return;
  if (sel && sel.tipo === 'peca') { const s = projeto.salas[sel.sala]; const p = s.pecas[sel.i]; const r = ((p.rot || 0) + 90) % 360; if (colide({ ...p, rot: r }, sel.sala, sel.i)) return aviso('Rotated, the tile overlaps another one.'); girarPecaComAnexos(sel.sala, sel.i); tudo(); return; }
  if (sel && sel.tipo === 'objeto') { const o = projeto.salas[sel.sala].objetos[sel.i]; o.rot = ((o.rot || 0) + 90) % 360; tudo(); return; }
  rot = (rot + 90) % 360; renderPaleta(); desenhar();
}
function apagarSelecao(q) {
  if (!q || q.tipo === 'contador') return;
  const disse = (tipo, nome) => aviso(tipo + ' deleted' + (nome ? ': ' + nome : '') + '.');
  if (q.tipo === 'pilar') { const p = projeto.salas[q.sala].pecas[q.pi]; p.pilares = (p.pilares || []).filter(x => !(x.pos[0] === q.pos[0] && x.pos[1] === q.pos[1])); sel = null; tudo(); disse('Pillar'); return; }
  if (q.tipo === 'objeto') { const o = projeto.salas[q.sala].objetos[q.i]; const nome = o ? rotulo(o) : ''; removerObjeto(q.sala, q.i); if (!projeto.salas[q.sala].objetos.includes(o)) disse('Object', nome); return; }
  if (q.tipo === 'peca') {
    const desc = descricaoDosAnexos(q.sala, q.i);
    if (desc && !confirm('Removing this tile also removes what sits on it: ' + desc + '.\n\nRemove them all?')) return;
    const tile = projeto.salas[q.sala].pecas[q.i]?.tile; const nome = nomePeca(tile);
    removerPecaComAnexos(q.sala, q.i); sel = null; tudo(); disse(ehAlfombra(tile) ? 'Underlay' : 'Tile', nome + (desc ? ' (with ' + desc + ')' : '')); return;
  }
  const item = listaDe(q)[q.i];
  listaDe(q).splice(q.i, 1); if (q.tipo === 'inimigo') acertarRefsDeInimigo(q); sel = null; tudo();
  disse(q.tipo === 'inimigo' ? 'Monster' : q.tipo === 'heroi' ? 'Hero space' : 'Item', q.tipo === 'inimigo' && item ? nomeIni(item.enemy) : '');
}
/* a monster left its list: the "Remove monsters → one monster" triggers aimed at it lose the target, the ones aimed at
   later monsters of the same list move up one (g.inimigo = {sala, tipo:'sala'|'gat', i, obj, g, l}) */
function acertarRefsDeInimigo(q) {
  const mesma = r => r && r.sala === q.sala && (q.g !== undefined ? r.tipo === 'gat' && r.obj === q.obj && r.g === q.g && (r.l || 'gatilhos') === (q.l || 'gatilhos') : r.tipo === 'sala');
  const olha = o => todosGatilhos(o).forEach(g => { if (!mesma(g.inimigo)) return; if (g.inimigo.i === q.i) delete g.inimigo; else if (g.inimigo.i > q.i) g.inimigo.i--; });
  projeto.salas.forEach(ss => donosDaSala(ss).forEach(({ o }) => olha(o))); (projeto.contadores || []).forEach(olha);
}
function removerPecaComAnexos(si, pi) {
  const s = projeto.salas[si]; const a = anexosDaPeca(si, pi);
  a.herois.sort((x, y) => y - x).forEach(hi => s.herois.splice(hi, 1));
  // spawned monsters: list and monster found first (a monster brought by another one on the same tile would lose its list)
  a.inimigos.filter(r => r.tipo === 'gat').map(r => { const l = gatDe(s, r)?.inimigos; return [l, l && l[r.k]]; }).forEach(([l, e]) => { const k = l ? l.indexOf(e) : -1; if (k >= 0) l.splice(k, 1); });
  a.inimigos.filter(r => r.tipo === 'sala').sort((x, y) => y.i - x.i).forEach(r => s.inimigos.splice(r.i, 1));
  a.objetos.sort((x, y) => y - x).forEach(oi => removerObjeto(si, oi, true, true));
  s.pecas.splice(pi, 1);
  acertarRefsDePeca(si, pi, null);
}
/* "Add / Remove a tile" triggers (objects, monsters, groups and counters) after tile pi of room si left it: null = deleted, or its new {sala, peca} */
function acertarRefsDePeca(si, pi, novo) {
  const olha = o => todosGatilhos(o).forEach(g => { if ((g.tipo === 'remove_tile' || g.tipo === 'add_tile') && g.sala === si && g.peca !== undefined) { if (g.peca === pi) { if (novo) { g.sala = novo.sala; g.peca = novo.peca; } else delete g.peca; } else if (g.peca > pi) g.peca--; } });
  projeto.salas.forEach(ss => donosDaSala(ss).forEach(({ o }) => olha(o))); (projeto.contadores || []).forEach(olha);
}
/* new uids for the triggers of a copy (and its spawned monsters), with its outcome lists ("ok:<uid>", "op1:<uid>"…) following */
function novosUids(o) {
  if (o.enemy && o.uid) o.uid = uid();
  // (the monsters of its spawns too, with their own "when defeated" triggers)
  const m = new Map(); todosGatilhos(o).forEach(g => { const n = uid(); if (g.uid) m.set(g.uid, n); g.uid = n; (g.inimigos || []).forEach(novosUids); });
  Object.keys(o).forEach(k => { if (!LISTA_FILHA.test(k)) return; const i = k.indexOf(':'); const n = m.get(k.slice(i + 1)); if (n) { o[k.slice(0, i + 1) + n] = o[k]; delete o[k]; } });
  return o;
}
/* Ctrl+C / Ctrl+V: the copied object (with texts, triggers and requirements) or monster stays in memory and can be pasted
   as many times as wanted, in any room or map; each paste asks for a click */
let areaCopia = null;
function copiarSelecao() {
  if (!sel || !projeto.salas[sel.sala]) return aviso('Select an object or a monster to copy.');
  if (sel.tipo === 'objeto') { const o = projeto.salas[sel.sala].objetos[sel.i]; areaCopia = { tipo: 'objeto', dado: clone(o) }; aviso('“' + rotulo(o) + '” copied. Ctrl+V pastes it (a click places it).'); }
  else if (sel.tipo === 'inimigo') { const e = listaDe(sel)[sel.i]; areaCopia = { tipo: 'inimigo', dado: clone(e) }; aviso(nomeIni(e.enemy) + ' copied. Ctrl+V pastes it (a click places it).'); }
  else return aviso(sel.tipo === 'peca' ? 'Tiles are single physical pieces: they are not copied.' : 'Only objects and monsters can be copied.');
  renderFaixa();
}
function colar() {
  if (!areaCopia) return aviso('Nothing copied yet: select an object or a monster and press Ctrl+C.');
  if (salaAtual < 0) return aviso('Create or pick a room first.');
  const si = salaAtual, s = projeto.salas[si];
  if (areaCopia.tipo === 'objeto') {
    const c = clone(areaCopia.dado); c.gatilhos = c.gatilhos || []; c.gatilhos.forEach(g => { if (g.tipo === 'open_room') { g.tipo = 'text'; g.text = ''; } }); delete c.hidden;
    if (ehDaOficina(c.type) && !varObj(c.type)) return aviso('That workshop object is not in this workshop.');
    pedirClique({ modo: 'space', g: null, si, texto: 'Click where the copy of “' + rotulo(c) + '” goes (Esc to stop).', repetir: true, cb: (x, y) => {
      const n = clone(c); n.pos = [x, y]; if (!ehTerreno(n)) n.level = nivel;
      if (!ehTerreno(n) && !casasDoObjeto(n).every(([cx, cy]) => salaNoNivel(cx, cy, nivel) === si)) return aviso('Put the copy on a tile of room ' + (si + 1) + ' at level ' + nivel + '.'), false;
      s.objetos.push(novosUids(n)); return true; } });
    return;
  }
  const e0 = areaCopia.dado;
  if (!monstro(e0.enemy)) return aviso('That monster is not in this workshop.');
  pedirClique({ modo: 'space', g: null, si, texto: 'Click where the copy of ' + nomeIni(e0.enemy) + ' goes (Esc to stop).', repetir: true, cb: (x, y) => {
    if (salaNoNivel(x, y, nivel) !== si) return aviso('Put it on a tile of this room at level ' + nivel + '.'), false;
    if (inimigosDaSala(s).some(({ e }) => e.pos[0] === x && e.pos[1] === y)) return aviso('There is already a monster there.'), false;
    s.inimigos.push(novosUids({ ...clone(e0), pos: [x, y], level: nivel })); return true; } });
}
function copiarObjeto() {
  if (!sel || sel.tipo !== 'objeto') return;
  const s = projeto.salas[sel.sala]; const o = s.objetos[sel.i];
  const c = clone(o); c.gatilhos = c.gatilhos || []; c.gatilhos.forEach(g => { if (g.tipo === 'open_room') { g.tipo = 'text'; g.text = ''; } }); novosUids(c);
  c.name = o.name ? o.name + ' (copy)' : ''; delete c.hidden;
  pedirClique({ modo: 'space', g: null, si: sel.sala, texto: 'Click where the copy of “' + rotulo(o) + '” goes (Esc cancels).', cb: (x, y) => {
    c.pos = [x, y]; c.level = ehTerreno(c) ? c.level : nivel; if (!ehTerreno(c) && !casasDoObjeto(c).every(([cx, cy]) => salaNoNivel(cx, cy, nivel) === sel.sala)) return aviso('Put the copy on a tile of this room at level ' + nivel + '.'), false;
    s.objetos.push(c); sel = { tipo: 'objeto', sala: sel.sala, i: s.objetos.length - 1 }; aviso('Copied with its texts, triggers and requirements. An “Open a room” trigger is not copied: two objects may open the same room, but add that trigger by hand.'); return true; } });
}

// ------------------------------------------------------------ left column: rooms and checklist
function renderSalas() {
  const el = $('#listaSalas'); el.innerHTML = '';
  projeto.salas.forEach((s, i) => {
    const d = document.createElement('div'); d.className = 'sala' + (i === salaAtual ? ' ativa' : '') + (s._previa ? ' previa' : '');
    const probs = problemasDaSala(i); const abre = abridoresDe(i);
    d.innerHTML = `<span class="n">${i + 1}</span><div><div><span data-sem-traducao>${esc(s.nome)}</span>${s._previa ? ' <span class="etq">preview · not added yet</span>' : ''}</div><small>${s.pecas.length} tiles · ${s.objetos.length} objects · ${inimigosDaSala(s).length} monsters${abre.length ? ' · opened by ' + abre.map(x => '“' + esc(rotulo(x.o)) + '”').join(', ') : ''}</small></div><span class="${probs.length ? 'falta' : 'ok'}" title="${esc(probs.join('; '))}">${probs.length ? '!' : '✓'}</span>`;
    d.onclick = () => { if (vista3d.on) return focar3d(i); salaAtual = i; sel = null; ferramenta = null; tudo(); enquadrarSala(i); };
    el.appendChild(d);
  });
  const b = $('#btnNovaSala'); b.hidden = projeto.salas.length > 0;
  $('#ajudaSala').textContent = projeto.salas.length === 0 ? 'Everything starts with the starting room, the only one visible when the map begins.' : 'New rooms are born from an object: select it, add the trigger “Open a room”. Pick a room here before touching what is in it.';
}
/* hints under the checklist: at most four at a time; each one goes away when the user has done what it teaches,
   and the next one in the list takes its place */
const DICAS = [
  { id: 'salas', principal: true, texto: '<b>Split your map into rooms.</b> Place an object (a door, a lever, a chest…) and give it the trigger “Open a room” to open the next room: the board is revealed little by little, as the players explore.', feita: () => projeto.salas.length >= 2 },
  { id: 'heroi', texto: '<b>Hero (H)</b> marks the squares where the heroes start, in the starting room (2 to 4 squares). The players put their figures there before the first room appears.', feita: () => projeto.salas.length >= 2 },
  { id: 'luta', texto: 'Give each room its fight: monsters placed in it with <b>Enemy (E)</b>, or brought by a trigger when something happens.', feita: () => projeto.salas.some(s => inimigosDaSala(s).length) },
  { id: '3d', texto: 'Press <b>3D</b> to see the map in relief: elevated tiles, pillars, stairs and ladders.', feita: () => jaVisto('dica:3d') },
  { id: 'setup', texto: '<b>Map setup</b> holds the introduction, the music, the final mission and the round limit.', feita: () => jaVisto('dica:setup') },
  { id: 'oficina', texto: 'The <b>Workshop (⚒)</b> holds the monsters, NPCs, items and weapons of the map: only what is there can be placed or found.', feita: () => jaVisto('dica:oficina') },
  { id: 'pecaUnica', texto: 'A room is one set of tiles: the same physical tile appears only once in it (sides A and B are the same piece). Reusing a tile in a later room takes the earlier room off the table.', feita: () => projeto.salas.length >= 3 },
  { id: 'niveis', texto: 'Tiles can stand at levels 1, 2 and 3 (the level buttons) on <b>pillars (P)</b>; the app counts the pillars your boxes have.', feita: () => projeto.salas.some(s => s.pecas.some(p => (p.level || 0) > 0)) },
  { id: 'contagem', texto: '<b>Counts</b> keep a number during the map (keys found, seals broken): triggers add to it, and a map objective can wait for the total.', feita: () => (projeto.contadores || []).length > 0 },
  { id: 'exportar', texto: '<b>Export map</b> writes the .dmap: into the folder chosen in ⚙, or into Downloads, from where the game (with the mod) brings it by itself; in the game, “Mapas da comunidade” lists it.', feita: () => jaVisto('dica:exportar') },
  { id: 'campanha', texto: '<b>Start a campaign</b> to chain maps on the world map, with scenes, choices and rewards between them.', feita: () => !!campanha },
  // (the tour of the whole editor: one hint per part, gone once the part is opened)
  { id: 'gerarSala', texto: '<b>✦ Generate room</b> builds a room for you from an archetype: click the object that will open it, pick among the candidates, place it and use it.', feita: () => jaVisto('dica:gerarSala') },
  { id: 'gerarMapa', texto: '<b>✦ Generate map</b> (experimental) builds a whole map: premise, objective, extra rule, rooms, monsters and finale. Try it and tell us.', feita: () => jaVisto('dica:gerarMapa') },
  { id: 'simular', texto: 'In the map generator, <b>Simulate</b> plays the generated map by the easy rules with 2, 3 and 4 heroes: won or not, health lost, items, monsters.', feita: () => jaVisto('dica:simular') },
  { id: 'historias', texto: 'The generator dresses its maps with stories (villains, guides, captives, pieces…): <b>Stories…</b> in its window exports them and imports new ones.', feita: () => jaVisto('dica:historias') },
  { id: 'ofPersonagens', texto: 'The Workshop’s <b>NPCs</b> tab holds the people of your stories: they speak in scenes and can stand on the board.', feita: () => jaVisto('dica:oficina-personagens') },
  { id: 'ofItens', texto: 'The Workshop’s <b>Items</b> tab: import the game’s items and materials, or create your own; only these can be found.', feita: () => jaVisto('dica:oficina-itens') },
  { id: 'ofArmas', texto: 'The Workshop’s <b>Weapons</b> tab builds weapons from their three parts (A, B, C), as in the app.', feita: () => jaVisto('dica:oficina-armas') },
  { id: 'ofReceitas', texto: 'The Workshop’s <b>Recipes</b> tab: what the party can craft, and from which materials.', feita: () => jaVisto('dica:oficina-receitas') },
  { id: 'ofFacanhas', texto: 'The Workshop’s <b>Feats</b> tab: goals of the campaign that pay a reward when reached.', feita: () => jaVisto('dica:oficina-facanhas') },
  { id: 'ofPericias', texto: 'The Workshop’s <b>Skills</b> tab: skill cards of your own, with their pictures, printable as a PDF.', feita: () => jaVisto('dica:oficina-pericias') },
  { id: 'ofHerois', texto: 'The Workshop’s <b>Heroes</b> tab: the heroes of the party, with their own art and cards.', feita: () => jaVisto('dica:oficina-herois') },
  { id: 'ofPecas', texto: 'The Workshop’s <b>Tiles</b> and <b>Objects</b> tabs make pieces of your own: any shape, any colour, with their default script.', feita: () => jaVisto('dica:oficina-pecas') || jaVisto('dica:oficina-objetos') },
  { id: 'fluxo', texto: 'In the campaign, the <b>story flow</b> links maps, scenes, travel and choices with arrows.', feita: () => jaVisto('dica:aba-fluxo') },
  { id: 'cenas', texto: 'In the campaign, open a scene card to write its <b>boxes</b>: who speaks, the text, questions that branch.', feita: () => jaVisto('dica:aba-caixas') },
  { id: 'mundo', texto: 'In the campaign, the <b>World map</b> places each map and draws the roads between them.', feita: () => jaVisto('dica:aba-mundo') },
  { id: 'inventario', texto: 'In the campaign, <b>Starting inventory</b> gives a party of veterans gold, items, weapon parts and skills from the start.', feita: () => jaVisto('dica:inventario') },
  { id: 'variaveis', texto: 'In the campaign, <b>Story variables</b> remember the players’ choices; cards, triggers and answers can depend on them.', feita: () => jaVisto('dica:variaveis') },
  { id: 'pacotes', texto: 'In ⚙ Settings, <b>Workshop packages</b> export what you made (monsters, items, skills…) to share, and import others’.', feita: () => jaVisto('dica:pacotes') },
  { id: 'salvaPadrao', texto: 'Program an object as you like, then <b>Save as the default</b> in its panel: the next ones of its kind placed with “Default script” ticked come programmed like it.', feita: () => jaVisto('dica:salvaPadrao') },
  // (one hint per trigger: gone once the map uses it)
  { id: 'gat-open_room', texto: 'Trigger <b>Open a room</b>: a door, a lever or a chest reveals the next room when used; several objects may open the same room.', feita: () => usouGatilho('open_room') },
  { id: 'gat-spawn', texto: 'Trigger <b>Spawn monsters</b>: monsters enter when the object is used: drawn from the room’s spawn pool, or one of the Workshop on the space you click. Try it on a trapped chest.', feita: () => usouGatilho('spawn') },
  { id: 'gat-give_item', texto: 'Trigger <b>Give or take away an item</b>: the party receives an item, a random item of the pool, materials or gold; set to “Take away”, it charges gold or materials (a merchant, a thief).', feita: () => usouGatilho('give_item') },
  { id: 'gat-rounds', texto: 'Trigger <b>Every N rounds (waves)</b>: runs the triggers inside every N rounds, or once N rounds later: waves of monsters, a fuse, a ritual that ends.', feita: () => usouGatilho('rounds') },
  { id: 'gat-text', texto: 'Trigger <b>Show a text</b>: a message box with your text: a clue, a warning, what the heroes see.', feita: () => usouGatilho('text') },
  { id: 'gat-counter', texto: 'Trigger <b>A counter reaches a number</b>: counts keys found, levers pulled, seals broken; “Use” runs its triggers when the count reaches a number.', feita: () => usouGatilho('counter') },
  { id: 'gat-skill_test', texto: 'Trigger <b>Skill test</b>: the players roll at the table and enter their successes; success and failure each have their own text and triggers.', feita: () => usouGatilho('skill_test') },
  { id: 'gat-choice', texto: 'Trigger <b>A choice in the campaign</b>: a question with up to five answers, each with its own text and triggers: open the chest or leave it, spare or strike.', feita: () => usouGatilho('choice') },
  { id: 'gat-mission', texto: 'Trigger <b>An objective was completed</b>: a new goal announced during the map and listed with the objectives; Map setup says which one ends the map.', feita: () => usouGatilho('mission') },
  { id: 'gat-unlock_map', texto: 'Trigger <b>Unlock a campaign map</b>: a map of the campaign stays locked until this runs: a secret path found, a side quest earned.', feita: () => usouGatilho('unlock_map') },
  { id: 'gat-remove_room', texto: 'Trigger <b>Remove a room</b>: takes a whole room off the board, with everything on it, and frees its tiles for the rooms ahead.', feita: () => usouGatilho('remove_room') },
  { id: 'gat-remove_tile', texto: 'Trigger <b>Remove a tile</b>: takes one tile off the board with what stands on it, freeing it for a later room.', feita: () => usouGatilho('remove_tile') },
  { id: 'gat-remove_enemy', texto: 'Trigger <b>Remove monsters</b>: takes monsters off the board without counting them as defeated: they flee, they vanish.', feita: () => usouGatilho('remove_enemy') },
  { id: 'gat-enemy_condition', texto: 'Trigger <b>Change monster conditions</b>: heals, hurts or gives a condition to monsters: a poisoned well, a blessing of the villain.', feita: () => usouGatilho('enemy_condition') },
  { id: 'gat-move_heroes', texto: 'Trigger <b>Move the heroes</b>: lights spaces in the game and tells the table to move the heroes there: a trap door, a teleport.', feita: () => usouGatilho('move_heroes') },
  { id: 'gat-add_tile', texto: 'Trigger <b>Add a tile</b>: a tile appears during play, with what stands on it: a bridge lowered, a wall collapsed, a secret passage.', feita: () => usouGatilho('add_tile') },
  { id: 'gat-add_object', texto: 'Trigger <b>Add an object</b>: a new object appears on the board when this one is used: a chest after the fight, a lever behind the wall.', feita: () => usouGatilho('add_object') },
  { id: 'gat-remove_object', texto: 'Trigger <b>Remove an object</b>: an object of the map disappears: a barricade broken, a door burned.', feita: () => usouGatilho('remove_object') },
  { id: 'gat-highlight', texto: 'Trigger <b>Highlight</b>: draws the players’ eyes to an object or a space.', feita: () => usouGatilho('highlight') },
  { id: 'gat-scene', texto: 'Trigger <b>Play a scene</b>: a dialogue in the game’s story window, with portraits, background and questions that branch.', feita: () => usouGatilho('scene') },
  { id: 'gat-cutscene', texto: 'Trigger <b>Play a video</b>: plays your own video full screen; the players can skip it with a click.', feita: () => usouGatilho('cutscene') },
  { id: 'gat-sound', texto: 'Trigger <b>Play a sound</b>: a sound effect of the game or your own file: a scream, a bell, the rumble of the collapse.', feita: () => usouGatilho('sound') },
  { id: 'gat-item_pool', texto: 'Trigger <b>Change the item pool</b>: adds an item to (or removes one from) the pool the random loot comes from, for the rest of the map.', feita: () => usouGatilho('item_pool') },
  { id: 'gat-reserve', texto: 'Trigger <b>Change the spawn pool</b>: adds a monster to (or removes one from) the spawn pool, for the rest of the map: the villain calls new allies.', feita: () => usouGatilho('reserve') },
  { id: 'gat-end_map', texto: 'Trigger <b>End the map</b>: ends the map on the spot, in victory or in defeat: the villain escaped, the time ran out.', feita: () => usouGatilho('end_map') },
  { id: 'gat-escort', texto: 'Trigger <b>Escort (a protected one)</b>: someone the heroes protect: the monsters may target it, and it falls when its health runs out.', feita: () => usouGatilho('escort') }
];
/* a trigger kind the map already uses (kept once seen, so its hint stays gone) */
function usouGatilho(id) {
  if (jaVisto('dica:gat-' + id)) return true;
  let tem = false; try { tem = (campanha ? campanha.missoes : [projeto]).some(pm => pm.salas.some(s => s.objetos.some(o => todosGatilhos(o).some(g => g.tipo === id)))); } catch { }
  if (tem) setTimeout(() => marcarVisto('dica:gat-' + id), 0); return tem;
}
function renderDicas() {
  const ul = $('#dicas'); if (!ul) return;
  const ativas = DICAS.filter(d => (d.id !== 'historias' || oficinaHistoriasAtiva()) && (() => { try { return !d.feita(); } catch { return true; } })()).slice(0, 4);
  ul.innerHTML = ativas.map(d => `<li class="${d.principal ? 'principal' : ''}" data-dica="${d.id}">${d.texto}</li>`).join('');
  $('#blocoDicas').hidden = !ativas.length;
}
function renderConferencia() {
  renderDicas(); if (typeof Tutorial !== 'undefined') Tutorial.conferir();
  const ul = $('#conferencia'); ul.innerHTML = '';
  const itens = [];
  if (projeto.salas.length === 0) itens.push(['falta', 'Create the starting room.']);
  projeto.salas.forEach((s, i) => { const p = problemasDaSala(i); itens.push([p.length && p.some(x => !x.endsWith('(warning)')) ? 'falta' : 'ok', 'Room ' + (i + 1) + ': ' + (p.length ? p.join('; ') : 'ready')]); });
  const fm = projeto.meta.finalMission || {};
  if (fm.tipo === 'defeat_all' && projeto.salas.length && !projeto.salas.some(s => inimigosDaSala(s).length)) itens.push(['falta', 'The final mission is to defeat every monster, but there are none (Map setup).']);
  if (fm.tipo === 'defeat_room' && (!projeto.salas[fm.sala || 0] || !inimigosDaSala(projeto.salas[fm.sala || 0]).length)) itens.push(['falta', 'The final mission is to defeat the monsters of room ' + ((fm.sala || 0) + 1) + ', but it has none (Map setup).']);
  if (fm.tipo === 'use_object' && !projeto.salas[fm.sala]?.objetos[fm.objeto]) itens.push(['falta', 'The final mission needs an object (Map setup).']);
  if (fm.tipo === 'trigger' && !missoesInternas().some(m => m.uid === fm.uid)) itens.push(['falta', 'The final mission points to an objective trigger that no longer exists (Map setup).']);
  if ((projeto.meta.notasImportacao || []).length) itens.push(['ok', 'Converted from an original map: ' + projeto.meta.notasImportacao.length + ' import note(s) in Map setup (warning).']);
  (projeto.contadores || []).forEach(c => {
    if (c.conta === 'monstros' && c.monstro && !monstro(c.monstro)) itens.push(['falta', 'Counter “' + c.nome + '” counts a monster that is no longer in the workshop (Counts button).']);
    if (c.conta && !(+c.total > 0) && !totalAutomatico(c.nome) && ((c.gatilhos || []).length || c.missao)) itens.push(['falta', 'Counter “' + c.nome + '” counts ' + (c.conta === 'rodadas' ? 'rounds' : 'monsters') + ' by itself: set its Total (Counts button).']);
  });
  pecasSemApoio().forEach(({ p, si }) => itens.push(['falta', 'Room ' + (si + 1) + ': tile ' + nomePeca(p.tile) + ' is elevated (level ' + p.level + ') with no pillars.']));
  const n = contagemPilares(); Object.keys(SUPORTES).forEach(k => { if (n[k] > caixaDoPilar(k)) itens.push(['falta', n[k] + ' ' + SUPORTES[k].nome.toLowerCase() + 's; the boxes have ' + caixaDoPilar(k) + ' (' + SUPORTES[k].porAto + ').']); });
  projeto.salas.forEach((s, si) => { const c = contagemPilaresNaSala(si); Object.keys(SUPORTES).forEach(k => { if (c[k] > caixaDoPilar(k)) itens.push(['falta', 'Room ' + (si + 1) + ' alone uses ' + c[k] + ' ' + SUPORTES[k].nome.toLowerCase() + 's; the boxes have ' + caixaDoPilar(k) + ' (' + SUPORTES[k].porAto + ').']); }); });
  if (!projeto.meta.name) itens.push(['falta', 'Give the map a name.']);
  if (!projeto.meta.author) itens.push(['falta', 'Set the author in ⚙ Settings (it goes into the map file).']);
  if (campanha && !campanha.meta.name) itens.push(['falta', 'Give the campaign a name (campaign screen).']);
  itens.forEach(([c, t]) => { const li = document.createElement('li'); li.className = c; li.textContent = t; ul.appendChild(li); });
}
function missoesInternas() { const r = []; projeto.salas.forEach((s, si) => donosDaSala(s).forEach(({ o, chave: oi }) => (o.gatilhos || []).forEach(g => { if (g.tipo === 'mission' && g.modo !== 'map') r.push({ uid: g.uid, g, si, oi, nome: g.text || 'Objective of ' + rotulo(o) }); })));
  // the map missions of the counters, and the missions their consequences announce
  (projeto.contadores || []).forEach(c => { if (c.missao) r.push({ uid: c.missao.uid, si: -1, oi: 'C:' + c.id, nome: c.missao.texto || textoMissaoContador(c) }); (c.gatilhos || []).forEach(g => { if (g.tipo === 'mission' && g.modo !== 'map') r.push({ uid: g.uid, g, si: -1, oi: 'C:' + c.id, nome: g.text || 'Objective of ' + rotulo(c) }); }); });
  return r; }
const ondeMissao = x => x.si >= 0 ? ' (room ' + (x.si + 1) + ')' : ' (counter)';

// ------------------------------------------------------------ floating panels
/* a floating window: dragged by its bar, resized by its corner; position and size are remembered per window */
function painelFlutuante(id, titulo, aoFechar) {
  let d = $('#' + id);
  if (!d) {
    d = document.createElement('div'); d.className = 'flutuante'; d.id = id;
    d.innerHTML = `<div class="barra"><span class="tit"></span><button class="fechar" title="Close">✕</button></div><div class="corpo"></div>`;
    document.body.appendChild(d);
    let pos = null; try { pos = JSON.parse(localStorage.getItem('bigorna-painel-' + id) || 'null'); } catch { }
    if (pos) { d.style.left = Math.min(pos[0], innerWidth - 80) + 'px'; d.style.top = Math.min(pos[1], innerHeight - 40) + 'px'; d.style.right = 'auto'; d.style.bottom = 'auto'; }
    let tam = null; try { tam = JSON.parse(localStorage.getItem('bigorna-painel-tam-' + id) || 'null'); } catch { }
    if (tam) { d.style.width = Math.min(tam[0], innerWidth - 20) + 'px'; d.style.height = Math.min(tam[1], innerHeight - 20) + 'px'; d.style.maxHeight = 'none'; }
    const barra = d.querySelector('.barra'); let arr = null;
    barra.onmousedown = ev => { if (ev.target.classList.contains('fechar')) return; const r = d.getBoundingClientRect(); arr = { x: ev.clientX - r.left, y: ev.clientY - r.top }; ev.preventDefault(); };
    window.addEventListener('mousemove', ev => { if (!arr) return; const x = Math.max(0, Math.min(innerWidth - 80, ev.clientX - arr.x)), y = Math.max(0, Math.min(innerHeight - 40, ev.clientY - arr.y)); d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.right = 'auto'; d.style.bottom = 'auto'; });
    window.addEventListener('mouseup', () => { if (arr) { arr = null; try { localStorage.setItem('bigorna-painel-' + id, JSON.stringify([parseInt(d.style.left), parseInt(d.style.top)])); } catch { } } });
    // the corner handle (CSS resize): once the user resizes, the window keeps that size
    let ultimo = null;
    const vigia = new ResizeObserver(() => {
      if (d.hidden) return;
      const w = Math.round(d.offsetWidth), h = Math.round(d.offsetHeight);
      if (ultimo && (Math.abs(ultimo[0] - w) > 2 || Math.abs(ultimo[1] - h) > 2) && d.dataset.redim === '1') { d.style.maxHeight = 'none'; try { localStorage.setItem('bigorna-painel-tam-' + id, JSON.stringify([w, h])); } catch { } }
      ultimo = [w, h];
    });
    vigia.observe(d);
    // only a drag of the corner counts as a resize (content changes also change the size)
    d.addEventListener('mousedown', ev => { const r = d.getBoundingClientRect(); d.dataset.redim = (ev.clientX > r.right - 18 && ev.clientY > r.bottom - 18) ? '1' : '0'; });
    window.addEventListener('mouseup', () => { setTimeout(() => { d.dataset.redim = '0'; }, 50); });
    d.querySelector('.fechar').onclick = () => { if (d._aoFechar) return d._aoFechar(); if (id === 'paleta') { ferramenta = null; tudo(); } else { sel = null; tudo(); } };
  }
  d._aoFechar = aoFechar || null;
  d.querySelector('.tit').textContent = titulo;
  return d;
}
/* a floating window used like modal(): same arguments, but it stays movable and resizable and the board stays usable */
function janelaFlutuante(id, titulo, html, aoMontar) {
  const d = painelFlutuante(id, titulo, () => { d.hidden = true; });
  const corpo = d.querySelector('.corpo'); corpo.innerHTML = html; d.hidden = false;
  const fechar = () => { d.hidden = true; };
  aoMontar && aoMontar(corpo, fechar);
  return { fundo: d, cx: d, fechar };
}
function esconderPainel(id) { const d = $('#' + id); if (d) d.hidden = true; }

// ------------------------------------------------------------ palette (floating)
function renderPaleta() {
  if (salaAtual < 0 || escolha || vista3d.on || !ferramenta || ferramenta === 'apagar' || ferramenta === 'heroi') { esconderPainel('paleta'); return; }
  const d = painelFlutuante('paleta', ({ peca: 'Tiles', objeto: 'Objects', inimigo: 'Monsters', pilar: 'Pillars' })[ferramenta]); d.hidden = false;
  const el = d.querySelector('.corpo'); el.innerHTML = '';
  if (ferramenta === 'peca') {
    el.innerHTML = `<p class="ajuda">Rotation ${rot}° (R) · level ${nivel} (ribbon). Greyed tiles are already in this room; amber ones are in another room (reusing them removes the earlier room).</p><div class="grade" id="gradePecas"></div><div class="subtitulo">Underlays (go under the tiles; ${CAIXA_ALFOMBRAS} double-sided cards: water / spikes and embers / fetid water share them)</div><div class="grade" id="gradeAlfombras"></div>`;
    const g = $('#gradePecas');
    PECAS.forEach(t => {
      const dv = document.createElement('div'); dv.className = 'item' + (t.id === pecaEscolhida ? ' ativo' : '');
      const usada = projeto.salas[salaAtual].pecas.some(p => numeroDaPeca(p.tile) === numeroDaPeca(t.id));
      const noutra = !usada && projeto.salas.some((sl, si) => si !== salaAtual && sl.pecas.some(p => numeroDaPeca(p.tile) === numeroDaPeca(t.id)));
      if (usada) dv.classList.add('usada'); if (noutra) dv.classList.add('noutra');
      dv.title = usada ? 'Tile ' + numeroDaPeca(t.id) + ' is already in this room (side A or B)' : noutra ? 'Tile ' + numeroDaPeca(t.id) + ' is in another room: reusing it here needs that room removed first' : t.w + '×' + t.h;
      dv.innerHTML = `<img src="${miniatura(t)}" alt=""><div>${t.id.toUpperCase()} <small>${t.w}×${t.h}${t.act === 2 ? ' · II' : ''}</small></div>`;
      dv.onclick = () => { if (usada && typeof Tutorial !== 'undefined' && Tutorial.ativo() && Tutorial.explicar('pecas-mesma-sala')) return; if (usada) return aviso('Tile ' + numeroDaPeca(t.id) + ' is already in this room.'); pecaEscolhida = t.id; renderPaleta(); }; g.appendChild(dv);
    });
    const vs = oficina().pecas.filter(v => !v.underlay); if (vs.length) { const st = document.createElement('div'); st.className = 'subtitulo'; st.textContent = 'Workshop tiles (made in the Workshop)'; g.after(st); const gv = document.createElement('div'); gv.className = 'grade'; st.after(gv);
      vs.forEach(v => { const t = defPeca(v.id); if (!t) return; const dv = document.createElement('div'); dv.className = 'item' + (v.id === pecaEscolhida ? ' ativo' : '');
        const usada = projeto.salas[salaAtual].pecas.some(p => numeroDaPeca(p.tile) === numeroDaPeca(v.id)); if (usada) dv.classList.add('usada');
        dv.innerHTML = `<img src="${miniatura(t, v)}" alt=""><div>${esc(v.nome)} <small>${t.w}×${t.h} · ${t.cells.length} sq.</small></div>`;
        const noutra = !usada && projeto.salas.some((sl, si) => si !== salaAtual && sl.pecas.some(p => p.tile === v.id)); if (noutra) dv.classList.add('noutra');
        dv.onclick = () => { if (usada) return aviso(v.nome + ' is already in this room.'); pecaEscolhida = v.id; renderPaleta(); }; gv.appendChild(dv); }); }
    const ga = $('#gradeAlfombras');
    [...ALFOMBRAS, ...oficina().pecas.filter(v => v.underlay).map(v => defPeca(v.id)).filter(Boolean)].forEach(t => {
      const dv = document.createElement('div'); dv.className = 'item' + (t.id === pecaEscolhida ? ' ativo' : '');
      const v = varPeca(t.id); const n = usoAlfombra(t.id); const verso = VERSO_ALFOMBRA[t.id]; const cx = caixaAlfombra(t.id);
      if (n >= cx) dv.classList.add('usada');
      dv.title = verso ? 'Same cards as ' + nomeAlfombra(verso) + ' (the other face)' : v ? 'Workshop underlay' : '';
      dv.innerHTML = `<img src="${miniatura(t, v)}" alt=""><div>${esc(nomeAlfombra(t.id))} <small>${n}/${cx} ${v ? 'cop' + (cx > 1 ? 'ies' : 'y') : 'cards'} used${verso ? ' · back: ' + esc(nomeAlfombra(verso)) : v ? ' · workshop' : ''}</small></div>`;
      dv.onclick = () => { pecaEscolhida = t.id; renderPaleta(); }; ga.appendChild(dv);
    });
  } else if (ferramenta === 'objeto') {
    el.innerHTML = `<p class="ajuda">${ehTerreno({ type: objetoEscolhido }) ? 'Staircases and bridges are floor: they climb from the ribbon level to the next one and may sit off the tiles. The arrow on a staircase shows the way up; R turns it.' : 'Rotation ' + rot + '° (R). Pillar (object): a column placed on a square like any object, with texts and triggers; it holds nothing up.'}</p><div class="grade objetos" id="gradeObj"></div>`;
    // the default version or an empty one (the choice stays for the next objects)
    const pd = document.createElement('label'); pd.className = 'campo'; pd.title = tr('Default: the object comes with the programming it has in the game (a chest opens once and holds things, a tree has three answers, a door opens a room…), or the one the Workshop gave it. Unticked: an empty object.');
    pd.innerHTML = `<span><input type="checkbox" id="objPadrao" ${usarPadraoObjeto() ? 'checked' : ''}> ${tr('Default script')}</span>`; el.insertBefore(pd, el.firstChild);
    $('#objPadrao').onchange = e => { try { localStorage.setItem('bigorna-padrao-objeto', e.target.checked ? '1' : '0'); } catch {} };
    const g = $('#gradeObj');
    OBJETOS.forEach(o => {
      const dv = document.createElement('div'); dv.className = 'item' + (o.id === objetoEscolhido ? ' ativo' : ''); dv.dataset.obj = o.id;   // (the tutorial names the pieces it lets through)
      // how many of it are on the table while this room is open, of how many the boxes hold
      const caixa = caixaDoTerreno(o.id); const uso = caixa === null ? 0 : terrenoEmUso(o.id);
      if (caixa !== null && uso >= caixa) dv.classList.add('usada');
      if (caixa !== null) dv.title = uso + ' ' + tr('on the table') + ' / ' + caixa + ' ' + tr('in your boxes') + (grupoDoTerreno(o.id) === 'Fichas' ? ' (' + tr('points of interest and interaction tokens share the same tokens') + ')' : '') + partilhaDe(grupoDoTerreno(o.id));
      dv.innerHTML = `<img src="${iconeObj(o.id)}" alt=""><div>${esc(nomeObj(o.id))}<small>${o.w}×${o.h}${TERRENO.has(o.id) ? ' · floor' : ''}${o.act === 2 ? ' · II' : ''}${caixa !== null ? ` · <b class="${uso >= caixa ? 'esgotado' : ''}">${uso}/${caixa}</b>` : ''}</small></div>`;
      dv.onclick = () => { objetoEscolhido = o.id; renderPaleta(); desenhar(); }; g.appendChild(dv);
    });
    const vs = oficina().objetos; if (vs.length) { const st = document.createElement('div'); st.className = 'subtitulo'; st.textContent = 'Workshop objects (made in the Workshop)'; el.appendChild(st); const gv = document.createElement('div'); gv.className = 'grade objetos'; el.appendChild(gv);
      vs.forEach(v => { const o = defObj(v.id); if (!o) return; const dv = document.createElement('div'); dv.className = 'item' + (v.id === objetoEscolhido ? ' ativo' : '');
        dv.innerHTML = `<img src="${iconeObj(v.id)}" alt=""><div>${esc(v.nome)}<small>${o.w}×${o.h} · ${o.cells.length} sq.</small></div>`;
        dv.onclick = () => { objetoEscolhido = v.id; renderPaleta(); desenhar(); }; gv.appendChild(dv); }); }
  } else if (ferramenta === 'inimigo') {
    if (!MONSTROS().length) { el.innerHTML = '<p class="ajuda">The workshop has no monsters. Open the <b>Workshop</b> (top bar) and import monsters from the game, or create your own; only those can be placed.</p><button class="primario largo" id="pl_monstros">Open the Workshop</button>'; $('#pl_monstros').onclick = () => abrirFichas('monstros'); return; }
    el.innerHTML = `<input id="filtroIni" placeholder="filter…"><div class="grade monstros" id="gradeIni"></div>`;
    paletaMonstros($('#gradeIni'), $('#filtroIni'), inimigoEscolhido, id => { inimigoEscolhido = id; renderPaleta(); }, true);
  } else if (ferramenta === 'pilar') {
    const n = contagemPilares(), ns = contagemPilaresNaSala(salaAtual);
    el.innerHTML = `<p class="ajuda">Click a socket (dot) of an elevated tile of this room at level ${nivel}: sockets sit between two squares on a straight edge, never at a corner. The pillar belongs to the tile: it moves and enters the game with it.</p><div class="grade pilares">${Object.keys(SUPORTES).map(k => `<div class="item ${pilarEscolhido === k ? 'ativo' : ''}" data-p="${k}"><span class="pil n${SUPORTES[k].nivel}">${SUPORTES[k].nivel}</span><div>${SUPORTES[k].nome}<small>level ${SUPORTES[k].nivel}${SUPORTES[k].act === 2 ? ' · Act II' : ''} · ${ns[k]} in this room · ${n[k]}/${caixaDoPilar(k)} in the box</small></div></div>`).join('')}</div>`;
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { pilarEscolhido = b.dataset.p; renderPaleta(); desenhar(); });
  }
}
/* a "balanced from enemy pool" space: the room's pool, its intensity and what the game would do for 1 to 4 heroes */
function fichaVagaPool(el, s, q, lista, e) {
  const si = q.sala; const r = regraDoBalanceio(); const pool = poolDaSala(si).map(monstro).filter(Boolean); const vagas = vagasPoolDaSala(s);
  el.innerHTML = `<div class="linha"><img class="redondo grande" src="${iconePool()}" alt=""><p class="ajuda">Room ${si + 1} · space ${e.pos[0]},${e.pos[1]}${(e.level || 0) > 0 ? ' · level ' + e.level : ''} · ${vagas} balanced space${vagas > 1 ? 's' : ''} in this room</p></div>
    <p class="ajuda">When the room ${si === 0 ? 'starts' : 'opens'}, the game fills these spaces with its own rule for random spawns: points = intensity ÷ 10 × heroes × 1.5 × progression; it takes the highest tier of the map’s range the points pay for (costs 10, 15, 20, 30, 40, 55…), and monsters of the pool that have that tier enter, one per space (up to 5), while the points last. Leftover points go to the next balanced room. All may enter, or just one strong monster.</p>
    <label class="campo">Intensity of this room <select id="vp_int">${Array.from({ length: 10 }, (_, k) => k + 1).map(n => `<option value="${n}" ${intensidadeDaSala(s) === n ? 'selected' : ''}>${n}${n === vagas && !s.intensidade ? ' (= spaces, default)' : ''}</option>`).join('')}</select></label>
    <div class="sub">Spawn pool of this room</div>
    <p class="ajuda">${pool.length ? pool.map(m => esc(m.nome) + ' <small>(tiers ' + m.tiers.map(t => t.tier).join(', ') + ')</small>').join(' · ') : '<b>Empty.</b> Nothing would enter.'} <a href="#" id="vp_pool">change</a></p>
    <div class="sub">What the game would do</div>
    ${tabelaBalanceio(vagas, intensidadeDaSala(s), poolDaSala(si))}
    <p class="ajuda">Tier range ${r.min}–${r.max}, campaign progression ${r.progresso} (<a href="#" id="vp_regra">Map setup</a>). Which monster of the pool enters is drawn in the game.</p>
    <div class="sub">When the group is defeated <button class="sm" id="vp_add">+ Add</button></div>
    <p class="ajuda">Triggers of the balanced group of this room: they run once, when the last monster that entered by these spaces is defeated (however many the game put in).</p>
    <div id="vp_gats"></div>
    <div class="linha acoes"><button id="e_mais">+ Another space</button><button id="e_apaga" class="perigo">Remove</button></div>`;
  $('#vp_add').onclick = () => abrirCatalogo(s, 'G:' + si, 'gatilhos');
  renderGatilhos($('#vp_gats'), s, 'G:' + si, 'gatilhos');
  $('#vp_int').onchange = ev => { const n = +ev.target.value; s.intensidade = n === vagas ? 0 : n; renderPropriedades(); };
  $('#vp_pool').onclick = ev => { ev.preventDefault(); sel = null; renderPropriedades(); };
  $('#vp_regra').onclick = ev => { ev.preventDefault(); $('#btnMapa').click(); };
  $('#e_apaga').onclick = () => apagarSelecao(q);
  $('#e_mais').onclick = () => pedirClique({ modo: 'space', si, texto: 'Click the space for another balanced space (Esc to stop).', repetir: true, cb: (x, y) => {
    if (salaNoNivel(x, y, nivel) !== si) return aviso('Put it on a tile of this room at level ' + nivel + ' (the ribbon level).'), false;
    if (inimigosDaSala(projeto.salas[si]).some(({ e: z }) => z.pos[0] === x && z.pos[1] === y)) return aviso('There is already a monster there.'), false;
    projeto.salas[si].inimigos.push({ enemy: POOL_ID, pos: [x, y], level: nivel }); return true; } });
}
function paletaMonstros(g, filtro, atual, cb, comPool) {
  const pinta = f => { g.innerHTML = '';
    if (comPool && (!f || 'balanced from enemy pool'.includes(f))) { const dv = document.createElement('div'); dv.className = 'item poolIni' + (atual === POOL_ID ? ' ativo' : '');
      dv.innerHTML = `<img class="redondo" src="${iconePool()}" alt=""><div>Balanced from enemy pool<small>the game decides: how many, which and how strong</small></div>`; dv.title = 'Place one or more of these spaces in a room: when the room opens, the game fills them from the room\u2019s spawn pool with its own rule (points from the number of heroes, the map\u2019s tier range). All may enter, or just one strong monster.';
      dv.onclick = () => cb(POOL_ID); g.appendChild(dv); } MONSTROS().filter(m => !f || (m.nome || '').toLowerCase().includes(f)).forEach(m => {
    const dv = document.createElement('div'); dv.className = 'item' + (m.id === atual ? ' ativo' : '');
    const r = retratoDoMonstro(m);
    dv.innerHTML = `${r ? `<img class="redondo" src="${r}" alt="">` : '<span class="redondo vazio"></span>'}<div>${esc(m.nome)}<small>${esc(m.tipo)} · ${(m.tiers || [])[0]?.hp ?? '?'} hp${m.custom ? ' · custom' : ''}</small></div>`;
    dv.onclick = () => cb(m.id); g.appendChild(dv); }); };
  pinta(''); if (filtro) filtro.oninput = e => pinta(e.target.value.toLowerCase());
}

// ------------------------------------------------------------ properties (floating): selection or room
function renderPropriedades() {
  if (salaAtual < 0 || escolha) { esconderPainel('props'); return; }
  if (!sel || !projeto.salas[sel.sala]) { renderSalaProps(); return; }
  const s = projeto.salas[sel.sala];
  if (sel.tipo === 'contador') { const c = donoDe(s, 'C:' + sel.id); if (!c) { sel = null; return renderPropriedades(); } const d = painelFlutuante('props', rotulo(c)); d.hidden = false; fichaContador(d.querySelector('.corpo'), s, c); return; }
  if (sel.tipo === 'peca') {
    const p = s.pecas[sel.i]; const t = defPeca(p.tile); const alf = t?.kind === 'underlay';
    const d = painelFlutuante('props', (alf ? 'Underlay ' : 'Tile ') + nomePeca(p.tile)); d.hidden = false; const el = d.querySelector('.corpo');
    const desc = descricaoDosAnexos(sel.sala, sel.i);
    el.innerHTML = `<p class="ajuda">Room ${sel.sala + 1} · ${p.rot || 0}°${desc ? ' · carries ' + esc(desc) : ''}</p>
      ${ehCaixa(p.tile) ? `<p class="ajuda"><b>A box</b>: ${p.tile === 'gamebox' ? 'the game box of Act I used as a platform: it stands on the floor with its top at level 3. The platform and the vault of Act II may stand on it.' : p.level > CAIXAS.platform ? 'it stands on the game box, with its top at level ' + p.level + '.' : 'it stands on the floor with its top at level ' + p.level + '.'} It takes no pillars; nothing fits under it, and over it only a tile above its top, on pillars.</p>` : alf ? '' : `<label class="campo">Level <select id="p_nivel">${[0, 1, 2, 3].map(l => `<option value="${l}" ${(p.level || 0) === l ? 'selected' : ''}>${l}${l ? ' (elevated)' : ' (floor)'}</option>`).join('')}</select></label>
      <div class="sub">Pillars of this tile ${p.level > 0 ? '<span class="etq">' + (p.pilares || []).length + '</span>' : ''}</div>
      ${p.level > 0 ? ((p.pilares || []).length ? '<div class="lista">' + p.pilares.map((q, qi) => `<div class="linha"><span class="pil n${SUPORTES[q.type].nivel}">${SUPORTES[q.type].nivel}</span><select data-pil="${qi}">${pilaresPermitidos(p.level).map(k => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${SUPORTES[k].nome}</option>`).join('')}</select><small>socket ${q.pos.join(',')}</small><button class="sm" data-pildel="${qi}">✕</button></div>`).join('') + '</div>' : '<p class="ajuda">None yet: use the Pillar tool on its sockets (level ${p.level} on the ribbon). Allowed here: ' + pilaresPermitidos(p.level).map(k => SUPORTES[k].nome.toLowerCase()).join(', ') + '.</p>') : '<p class="ajuda">A floor tile needs no pillars.</p>'}`}
      <div class="linha acoes"><button id="p_gira">↻ Rotate</button><button id="p_mover">Move to another room…</button><button id="p_apaga" class="perigo">Remove</button></div>`;
    $('#p_gira').onclick = girar_selecao;
    $('#p_apaga').onclick = () => apagarSelecao(sel);
    $('#p_mover').onclick = () => moverPecaParaSala(sel.sala, sel.i);
    const nv = $('#p_nivel'); if (nv) nv.onchange = e => { const l = +e.target.value; if (colide({ ...p, level: l }, sel.sala, sel.i)) { e.target.value = p.level || 0; return aviso('At that level the tile overlaps another one.'); } p.level = l; p.pilares = (p.pilares || []).filter(q => pilaresPermitidos(l).includes(q.type)); if (l === 0) p.pilares = []; tudo(); };
    el.querySelectorAll('[data-pil]').forEach(sl => sl.onchange = () => { p.pilares[+sl.dataset.pil].type = sl.value; tudo(); });
    el.querySelectorAll('[data-pildel]').forEach(b => b.onclick = () => { p.pilares.splice(+b.dataset.pildel, 1); tudo(); });
  } else if (sel.tipo === 'pilar') {
    const p = s.pecas[sel.pi]; const q = (p.pilares || []).find(x => x.pos[0] === sel.pos[0] && x.pos[1] === sel.pos[1]); if (!q) { sel = null; return renderPropriedades(); }
    const d = painelFlutuante('props', SUPORTES[q.type].nome); d.hidden = false; const el = d.querySelector('.corpo');
    el.innerHTML = `<p class="ajuda">Socket ${q.pos.join(',')} of tile ${nomePeca(p.tile)} (level ${p.level}). It enters the game together with the tile.</p><label class="campo">Kind <select id="q_tipo">${pilaresPermitidos(p.level).map(k => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${SUPORTES[k].nome} (level ${SUPORTES[k].nivel})</option>`).join('')}</select></label><div class="linha acoes"><button id="q_apaga" class="perigo">Remove</button></div>`;
    $('#q_tipo').onchange = e => { q.type = e.target.value; tudo(); }; $('#q_apaga').onclick = () => apagarSelecao(sel);
  } else if (sel.tipo === 'objeto') {
    const o = s.objetos[sel.i]; const d = painelFlutuante('props', rotulo(o)); d.hidden = false; renderObjeto(d.querySelector('.corpo'), s, sel.i);
  } else if (sel.tipo === 'inimigo') {
    const lista = sel.g !== undefined ? gatDe(s, sel).inimigos : s.inimigos;
    const e = lista[sel.i]; const m = monstro(e.enemy);
    const d = painelFlutuante('props', nomeIni(e.enemy)); d.hidden = false; const el = d.querySelector('.corpo');
    if (ehPool(e.enemy)) return fichaVagaPool(el, s, sel, lista, e);
    el.innerHTML = `<div class="linha">${iconeIni(e.enemy) ? `<img class="redondo grande" src="${iconeIni(e.enemy)}" alt="">` : ''}<p class="ajuda">Room ${sel.sala + 1} · space ${e.pos[0]},${e.pos[1]}${(e.level || 0) > 0 ? ' · level ' + e.level : ''}${sel.g !== undefined ? (typeof sel.obj === 'string' ? ' · enters when “' + esc(rotulo(donoDe(s, sel.obj) || {})) + '” is defeated' : ' · enters with “' + esc(rotulo(s.objetos[sel.obj])) + '”') : sel.sala === 0 ? ' · present from the start' : ' · enters automatically when this room opens'}${m ? '' : ' · <b>not in the workshop</b>'}</p></div>
      ${e.tierPorHerois ? '' : `<label class="campo">Tier <select id="e_tier">${(m?.tiers || [{ tier: e.tier || 1 }]).map(t => `<option value="${t.tier}" ${(e.tier || 0) === t.tier ? 'selected' : ''}>${t.tier} · ${t.hp} hp · def ${t.def} · atk ${t.atk}</option>`).join('')}</select></label>`}
      <div class="linha porHerois"><label class="chk"><input type="checkbox" id="e_porHerois" ${e.tierPorHerois ? 'checked' : ''}> Tier by the number of heroes</label><button class="sm" id="e_balTier" title="Balance: sets the tiers for 1–2, 3 and 4 heroes by the game's points (room intensity ÷ 10 × heroes × 1.5 × progression, shared by the monsters placed in this room), each one above the other">⚖ Balance</button></div>
      ${e.tierPorHerois ? `<label class="campo">Room intensity <select id="e_int">${Array.from({ length: 10 }, (_, k) => k + 1).map(n => `<option value="${n}" ${intensidadeParaMonstros(s, lista) === n ? 'selected' : ''}>${n}${!s.intensidade && n === monstrosComuns(lista) ? ' (= monsters here, default)' : ''}</option>`).join('')}</select></label>` : ''}
      ${e.tierPorHerois ? `<div class="linha tiersHerois">${[2, 3, 4].map(h => `<label class="campo">${h === 2 ? '1–2' : h} heroes <select data-th="${h}">${(m?.tiers || [{ tier: e.tier || 1 }]).map(t => `<option value="${t.tier}" ${e.tierPorHerois[h - 1] === t.tier ? 'selected' : ''}>${t.tier} · ${t.hp} hp</option>`).join('')}</select></label>`).join('')}</div>
        <p class="ajuda">Like the game's bosses (Levirax: tier 7, 8 or 9 for 2, 3 or 4 heroes). The difficulty (Journey, Heroic, Warfare) still applies on top.</p>` : ''}
      <div class="sub">When defeated <button class="sm" id="e_add">+ Add</button></div>
      <p class="ajuda">Triggers of this monster: they run every time it is defeated, after the game’s own effects (loot, objectives). Taking it off with “Remove monsters” does not count.</p>
      <div id="e_gats"></div>
      <div class="linha acoes"><button id="e_mais">+ Another like this</button><button id="e_ficha">Edit in the workshop</button><button id="e_apaga" class="perigo">Remove</button></div>`;
    if ($('#e_tier')) $('#e_tier').onchange = ev => { e.tier = +ev.target.value; };
    $('#e_porHerois').onchange = ev => {
      if (ev.target.checked) { const ts = (m?.tiers || []).map(t => t.tier).sort((a, b) => a - b); const base = e.tier || ts[0] || 1; const perto = n => ts.length ? ts.reduce((a, t) => Math.abs(t - n) < Math.abs(a - n) ? t : a, ts[0]) : n;
        e.tierPorHerois = [base, base, perto(base + 1), perto(base + 2)]; }
      else { e.tier = e.tierPorHerois?.[1] || e.tier; delete e.tierPorHerois; }
      renderPropriedades(); };
    $('#e_balTier').onclick = () => {
      const t = tiersPelaRegra(m, intensidadeParaMonstros(s, lista), monstrosComuns(lista)); if (!t) return aviso('This monster has no tiers (Workshop).');
      e.tierPorHerois = t; e.tier = t[1]; renderPropriedades();
      aviso('Tiers ' + t[1] + ', ' + t[2] + ' and ' + t[3] + ' for 1–2, 3 and 4 heroes (room intensity ' + intensidadeParaMonstros(s, lista) + ', progression ' + regraDoBalanceio().progresso + (monstrosComuns(lista) > 1 ? ', points shared by ' + monstrosComuns(lista) + ' monsters' : '') + ').'); };
    const ei = $('#e_int'); if (ei) ei.onchange = () => { const n = +ei.value; s.intensidade = n === monstrosComuns(lista) && !vagasPoolDaSala(s) ? 0 : n; renderPropriedades(); };
    el.querySelectorAll('[data-th]').forEach(sl => sl.onchange = () => { const h = +sl.dataset.th; e.tierPorHerois[h - 1] = +sl.value; if (h === 2) { e.tierPorHerois[0] = +sl.value; e.tier = +sl.value; } });
    const chaveE = chaveDoInimigo(e);
    $('#e_add').onclick = () => abrirCatalogo(s, chaveE, 'gatilhos');
    renderGatilhos($('#e_gats'), s, chaveE, 'gatilhos');
    $('#e_apaga').onclick = () => apagarSelecao(sel);
    $('#e_ficha').onclick = () => abrirFichas('monstros', e.enemy);
    $('#e_mais').onclick = () => {
      const g = sel.g !== undefined ? gatDe(s, sel) : null; const si = sel.sala; const tier = e.tier;
      pedirClique({ modo: 'space', g, si, texto: 'Click the space for another ' + nomeIni(e.enemy) + ' (Esc to stop).', repetir: true, cb: (x, y) => {
        if (salaNoNivel(x, y, nivel) < 0) return aviso('Put it on a tile at level ' + nivel + ' (the ribbon level).'), false;
        if (inimigosDaSala(projeto.salas[si]).some(({ e: z }) => z.pos[0] === x && z.pos[1] === y)) return aviso('There is already a monster there.'), false;
        (g ? g.inimigos : projeto.salas[si].inimigos).push({ enemy: e.enemy, pos: [x, y], tier, level: nivel, ...(e.tierPorHerois ? { tierPorHerois: [...e.tierPorHerois] } : {}) }); return true; } });
    };
  } else if (sel.tipo === 'heroi') {
    const h = s.herois[sel.i]; const d = painelFlutuante('props', 'Hero space ' + (sel.i + 1)); d.hidden = false;
    d.querySelector('.corpo').innerHTML = `<p class="ajuda">Space ${h[0]},${h[1]}. Heroes start here (2 to 4 spaces in the starting room).</p><div class="linha acoes"><button id="h_apaga" class="perigo">Remove</button></div>`;
    $('#h_apaga').onclick = () => apagarSelecao(sel);
  }
}
function moverPecaParaSala(si, pi) {
  const outras = projeto.salas.map((s, i) => i).filter(i => i !== si);
  if (!outras.length) return aviso('There is no other room yet.');
  escolherOpcao('Move the tile (and what sits on it) to which room?', outras.map(i => ({ id: i, titulo: (i + 1) + ' · ' + projeto.salas[i].nome, sub: projeto.salas[i].pecas.length + ' tiles' })), i => {
    const de = projeto.salas[si], para = projeto.salas[i]; const p = de.pecas[pi];
    if (para.pecas.some(q => numeroDaPeca(q.tile) === numeroDaPeca(p.tile))) return aviso('Room ' + (i + 1) + ' already has tile ' + numeroDaPeca(p.tile) + '.');
    const a = anexosDaPeca(si, pi);
    const objs = a.objetos.sort((x, y) => y - x).map(oi => { const o = de.objetos[oi]; removerObjeto(si, oi, true, true); return o; });
    const inis = a.inimigos.filter(r => r.tipo === 'sala').sort((x, y) => y.i - x.i).map(r => de.inimigos.splice(r.i, 1)[0]);
    const hs = a.herois.sort((x, y) => y - x).map(hi => de.herois.splice(hi, 1)[0]);
    de.pecas.splice(pi, 1); para.pecas.push(p); acertarRefsDePeca(si, pi, { sala: i, peca: para.pecas.length - 1 }); objs.reverse().forEach(o => para.objetos.push(o));
    inis.reverse().forEach(e => para.inimigos.push(e));
    if (i === 0) hs.reverse().forEach(h => para.herois.push(h)); else if (hs.length) aviso('Hero spaces only exist in the starting room: they were dropped.');
    salaAtual = i; sel = { tipo: 'peca', sala: i, i: para.pecas.length - 1 }; tudo();
  });
}

// ------------------------------------------------------------ room properties (nothing selected)
function renderSalaProps() {
  const s = projeto.salas[salaAtual]; if (!s) return esconderPainel('props');
  const d = painelFlutuante('props', 'Room ' + (salaAtual + 1)); d.hidden = false; const el = d.querySelector('.corpo');
  const abre = abridoresDe(salaAtual);
  el.innerHTML = `<label class="campo">Name <input id="s_nome" value="${esc(s.nome)}"></label>
    ${s.arquetipo ? `<p class="ajuda">Generated as: <b>${esc(tr(ARQUETIPO_SALA(s.arquetipo)?.nome || s.arquetipo))}</b></p>` : ''}
    ${salaAtual > 0 ? `<p class="ajuda">Opened by: ${abre.length ? abre.map(x => '<b>' + esc(rotulo(x.o)) + '</b> (room ' + (x.r.sala + 1) + ')').join(', ') : '<span class="erro">no object opens this room; give one an “Open a room” trigger</span>'}</p>` : '<p class="ajuda">Visible from the start. The map introduction, music and final mission are in <b>Map setup</b> (top bar).</p>'}
    ${salaAtual > 0 && (s.inimigos || []).length ? `<p class="ajuda">${s.inimigos.length} monster(s) placed in this room enter automatically when it opens (after its tiles and objects).</p>` : ''}
    ${salaAtual > 0 ? `<label class="campo">Text when revealed <textarea id="s_texto" rows="3" placeholder="What the players read when the room appears">${esc(s.texto)}</textarea></label>` : ''}
    <label class="campo">${salaAtual > 0 ? 'Text after the room is set up' : 'Text after the board is set up'} <textarea id="s_depois" rows="2" placeholder="What the heroes find in it: a person, an object (the interaction tokens)">${esc(s.textoDepois || '')}</textarea></label>
    ${s.objetivos.length ? `<div class="sub">Older objectives of this room</div>
    <p class="ajuda">Listed from the start of the map. Objectives now come from the “Add an objective” trigger of an object; these stay until you remove them.</p>
    <div id="ob_lista"></div>` : ''}
    <div class="sub">Spawn pool of this room</div>
    <p class="ajuda">Starts with every monster of the map’s pool (Workshop). Click a lit one to leave it out of this room only; click a dim one to add it for this room only.</p>
    <div id="s_pool"></div>
    ${projeto.salas.length > 1 ? '<div class="linha acoes"><button id="s_apaga" class="perigo">Remove this room</button></div>' : ''}`;
  widgetPoolDaSala($('#s_pool'), salaAtual);
  $('#s_nome').oninput = e => { s.nome = e.target.value; renderSalas(); renderFaixa(); desenhar(); };
  const t = $('#s_texto'); if (t) t.oninput = e => { s.texto = e.target.value; };
  const td = $('#s_depois'); if (td) td.oninput = e => { s.textoDepois = e.target.value; };
  const ap = $('#s_apaga'); if (ap) ap.onclick = () => {
    const n = salaAtual, aviso0 = n === 0 ? '\n\nRoom 2 becomes the starting room: give it hero spaces.' : '', depois = n < projeto.salas.length - 1 ? '\n\nThe rooms after it move up one number; the triggers, requirements and missions that point to them follow.' : '';
    if (!confirm('Remove room ' + (n + 1) + ' (' + s.nome + ') and everything in it? The triggers that open or remove it go too.' + depois + aviso0)) return;
    removerSala(n); salaAtual = Math.min(n, projeto.salas.length - 1); sel = null; limparAbridores(); tudo(); };
  if (s.objetivos.length) renderObjetivos(s);
}
/* takes a room out of the map (any room, not only the last): references to later rooms move up one number;
   references to the removed room go (triggers that open, remove or add pieces of it, requirements about it, targets in it) */
function removerSala(idx) {
  const mapa = i => i === idx ? undefined : i > idx ? i - 1 : i;
  const grupoNovo = str => { const m = /^room-(\d+)(-pool)?$/.exec(str || ''); if (!m) return str; const k = mapa(+m[1] - 1); return k === undefined ? null : 'room-' + (k + 1) + (m[2] || ''); };
  const DA_SALA = ['open_room', 'remove_room', 'remove_tile', 'add_tile'];
  const requisitos = lista => (lista || []).filter(r => { if (r.sala === undefined || !['room_open', 'enemies_defeated', 'object_used'].includes(r.tipo)) return true; if (r.sala === idx) return false; r.sala = mapa(r.sala); return true; });
  const ajustar = o => {
    o.requisitos = requisitos(o.requisitos);
    listasDe(o).forEach(l => { if (!o[l]) return; o[l] = o[l].filter(g => {
      if (DA_SALA.includes(g.tipo) && g.sala !== undefined) { if (g.sala === idx) return false; g.sala = mapa(g.sala); }
      if (g.objSala !== undefined) { if (g.objSala === idx) { delete g.objSala; delete g.objIndex; } else g.objSala = mapa(g.objSala); }
      if (g.inimigo) { if (g.inimigo.sala === idx) delete g.inimigo; else g.inimigo.sala = mapa(g.inimigo.sala); }
      if (g.salaAlvo !== undefined) { if (g.salaAlvo === idx) delete g.salaAlvo; else g.salaAlvo = mapa(g.salaAlvo); }
      if (g.grupo) { const ng = grupoNovo(g.grupo); if (ng === null) delete g.grupo; else g.grupo = ng; }
      g.requisitos = requisitos(g.requisitos); return true; }); });
  };
  projeto.salas.forEach((ss, si) => { if (si === idx) return; donosDaSala(ss).forEach(({ o }) => ajustar(o)); ss.abertaPor = (ss.abertaPor || []).filter(r => r.sala !== idx).map(r => ({ ...r, sala: mapa(r.sala) })); });
  (projeto.contadores || []).forEach(ajustar);
  const fm = projeto.meta.finalMission; if (fm && fm.sala !== undefined) { if (fm.sala === idx) { fm.sala = 0; delete fm.objeto; } else fm.sala = mapa(fm.sala); }
  projeto.salas.splice(idx, 1);
}
const TIPOS_OBJETIVO = [['use_object', 'Use an object of this room'], ['defeat_room', 'Defeat the enemies of this room'], ['table', 'Declared at the table (anything the app cannot see)']];
function renderObjetivos(s) {
  const el = $('#ob_lista'); el.innerHTML = '';
  s.objetivos.forEach((o, i) => {
    const dv = document.createElement('div'); dv.className = 'objetivo';
    dv.innerHTML = `<div class="linha"><input data-k="texto" value="${esc(o.texto || '')}" placeholder="Objective text, as shown in the game"><button class="sm" data-apaga="${i}" title="Remove">✕</button></div>
      <select data-k="tipo">${TIPOS_OBJETIVO.map(([v, t]) => `<option value="${v}" ${o.tipo === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      ${o.tipo === 'use_object' ? `<select data-k="objeto"><option value="-1">— pick an object of this room —</option>${s.objetos.map((ob, j) => `<option value="${j}" ${o.objeto === j ? 'selected' : ''}>${esc(rotulo(ob))} (${ob.pos[0]},${ob.pos[1]})</option>`).join('')}</select>` : ''}`;
    dv.querySelectorAll('[data-k]').forEach(inp => { const k = inp.dataset.k; const h = () => { if (k === 'objeto') o.objeto = +inp.value; else o[k] = inp.value; if (k !== 'texto') renderSalaProps(); renderConferencia(); renderSalas(); }; if (inp.tagName === 'INPUT') inp.oninput = h; else inp.onchange = h; });
    dv.querySelector('[data-apaga]').onclick = () => { s.objetivos.splice(i, 1); renderSalaProps(); renderConferencia(); };
    el.appendChild(dv);
  });
}
/* the room's spawn pool as a grid of pictures; used in the room panel and in the Spawn monsters trigger (depois = what the
   trigger panel redraws after a change, since its balance table depends on the pool) */
function widgetPoolDaSala(el, si, depois) {
  const s = projeto.salas[si]; s.reserva = s.reserva || { add: [], remove: [] };
  const doMapa = projeto.reserva || [];
  const mudou = !!((s.reserva.add || []).length || (s.reserva.remove || []).length);
  const refazer = () => { renderConferencia(); if (depois) { depois(); return; } widgetPoolDaSala(el, si); if (sel && sel.tipo === 'inimigo') renderPropriedades(); };
  gradeDoPool(el, id => poolDaSala(si).includes(id), id => {
    if (doMapa.includes(id)) { const r = s.reserva.remove = s.reserva.remove || []; const k = r.indexOf(id); if (k >= 0) r.splice(k, 1); else r.push(id); }
    else { const a = s.reserva.add = s.reserva.add || []; const k = a.indexOf(id); if (k >= 0) a.splice(k, 1); else a.push(id); }
    refazer();
  }, id => doMapa.includes(id) ? ((s.reserva.remove || []).includes(id) ? 'map pool · left out here' : 'map pool') : (s.reserva.add || []).includes(id) ? 'this room only' : '',
  mudou ? `<button class="sm" data-igual>Same as the map pool</button>` : '', true);
  const ig = el.querySelector('[data-igual]'); if (ig) ig.onclick = () => { s.reserva = { add: [], remove: [] }; refazer(); };
}

// ------------------------------------------------------------ generic option dialog
function escolherOpcao(titulo, opcoes, cb, ajuda) {
  const fundo = document.createElement('div'); fundo.className = 'modal';
  const cx = document.createElement('div'); cx.className = 'cx';
  cx.innerHTML = `<h2>${esc(titulo)}</h2>${ajuda ? '<p class="ajuda">' + ajuda + '</p>' : ''}` + opcoes.map((o, i) => `<button class="op ${o.classe || ''}" data-i="${i}"><b>${esc(o.titulo)}</b>${o.sub ? '<small>' + esc(o.sub) + '</small>' : ''}</button>`).join('') + `<div class="rodape"><button id="op_fechar">Cancel</button></div>`;
  fundo.appendChild(cx); document.body.appendChild(fundo);
  fundo.onclick = e => { if (e.target === fundo) fundo.remove(); };
  cx.querySelector('#op_fechar').onclick = () => fundo.remove();
  cx.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { fundo.remove(); cb(opcoes[+b.dataset.i].id, opcoes[+b.dataset.i]); });
  return fundo;
}
function modal(titulo, html, aoMontar, largo) {
  const fundo = document.createElement('div'); fundo.className = 'modal';
  const cx = document.createElement('div'); cx.className = 'cx' + (largo ? ' larga' : '');
  cx.innerHTML = `<div class="cabecalho"><h2>${esc(titulo)}</h2><button class="sm fechar">✕</button></div><div class="conteudo">${html}</div>`;
  fundo.appendChild(cx); document.body.appendChild(fundo);
  const fechar = () => fundo.remove();
  fundo.onclick = e => { if (e.target === fundo) fechar(); }; cx.querySelector('.fechar').onclick = fechar;
  aoMontar && aoMontar(cx.querySelector('.conteudo'), fechar);
  return { fundo, cx, fechar };
}

// ------------------------------------------------------------ map setup (name locked in the header; the rest here)
function abrirMapa() {
  marcarVisto('dica:setup');
  const m = projeto.meta; m.finalMission = m.finalMission || { tipo: 'defeat_all', texto: '', rodadas: 8 };
  const fm = m.finalMission;
  modal('Map setup · ' + (m.name || 'Map'), `${(m.notasImportacao || []).length ? `<div class="secao notasImportacao"><h3>Import notes</h3><p class="ajuda">This map was converted from an original map of the game. What was simplified or left out:</p><ul>${m.notasImportacao.map(n => `<li data-sem-traducao>${esc(n)}</li>`).join('')}</ul><button class="sm" id="mp_semNotas">Clear these notes</button></div>` : ''}
    <label class="campo">Introduction (before the map starts) <textarea id="mp_intro" rows="3">${esc(m.intro || '')}</textarea></label>
    <label class="campo">Description (in the map list) <textarea id="mp_desc" rows="2">${esc(m.description || '')}</textarea></label>
    <div class="sub">Custom music</div>
    <div id="mp_musica"></div>
    <label class="campo">Background of the story boxes <select id="mp_bg"><option value="">Default</option>${FUNDOS.map(f => `<option value="${f.id}" ${String(m.background) === String(f.id) ? 'selected' : ''}>${esc(f.name_en)}</option>`).join('')}</select></label>
    <div class="secao">
      <h3>Balancing</h3>
      <p class="ajuda">What the monsters and the rewards of this map draw from, and how hard the game's rule makes the “Balanced from enemy pool” spaces.</p>
      <div class="sub">Campaign progression</div>
      <p class="ajuda">Sets the points of the balanced spaces: points = intensity of the room ÷ 10 × heroes × 1.5 × progression (the intensity is set on a balanced space, 1 to 10). The game's quest 1 uses 20 and each quest adds 2.</p>
      <div class="linha"><label class="campo">Progression <input id="mp_bprog" type="number" min="1" max="200" value="${regraDoBalanceio().progresso}" style="width:80px"></label>
        <label class="campo">Lowest tier <select id="mp_bmin">${Array.from({ length: 10 }, (_, k) => `<option ${regraDoBalanceio().min === k + 1 ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></label>
        <label class="campo">Highest tier <select id="mp_bmax">${Array.from({ length: 10 }, (_, k) => `<option ${regraDoBalanceio().max === k + 1 ? 'selected' : ''}>${k + 1}</option>`).join('')}</select></label></div>
      <p class="ajuda">The tiers the game picks from (its default is 1 to 3; quest 1 stays at 1).</p>
      <div class="sub">Monster pool</div>
      <p class="ajuda">Monsters the “Balanced from enemy pool” spaces and the “Spawn from the pool” trigger draw from. Each room starts with this list and may change it (room panel). Edited in the Workshop too.</p>
      <div id="mp_pool"></div>
      <div class="sub">Item pool</div>
      <p class="ajuda">Items (and materials) the heroes may get in this map. The “Give an item” trigger draws from it: a random item (never the same twice, nor one the party already has), or random materials worth N loot points. Edited in the Workshop too.</p>
      <div id="mp_itens"></div>
    </div>
    <div class="sub">Final mission (ends the map with a victory)</div>
    <label class="campo">Kind <select id="mp_fm">${[['defeat_all', 'Defeat every monster (default)'], ['defeat_room', 'Defeat the monsters of a room'], ['survive_rounds', 'Survive N rounds'], ['use_object', 'Use a specific object (click it)'], ['reach_room', 'Reach a room (declared at the table)'], ['table', 'Declared at the table'], ['trigger', 'An objective added by a trigger']].map(([v, t]) => `<option value="${v}" ${fm.tipo === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <div id="mp_fmCampos"></div>
    <label class="campo">Text shown for the mission <input id="mp_fmTexto" value="${esc(fm.texto || '')}" placeholder="Default text if empty"></label>
    <label class="campo">Round limit (defeat when reached) <input id="mp_limite" type="number" min="0" value="${m.limite || 0}" style="width:80px"> <small>0 = no limit</small></label>`, (el, fechar) => {
    el.querySelector('#mp_intro').oninput = e => { m.intro = e.target.value; };
    el.querySelector('#mp_desc').oninput = e => { m.description = e.target.value; };
    campoMusica(el.querySelector('#mp_musica'), m);
    el.querySelector('#mp_bg').onchange = e => { m.background = e.target.value; };
    el.querySelector('#mp_fmTexto').oninput = e => { fm.texto = e.target.value; };
    const sn = el.querySelector('#mp_semNotas'); if (sn) sn.onclick = () => { delete m.notasImportacao; sn.closest('.secao').remove(); renderConferencia(); };
    el.querySelector('#mp_limite').onchange = e => { m.limite = Math.max(0, +e.target.value || 0); };
    widgetPool(el.querySelector('#mp_pool'), projeto.reserva, renderConferencia);
    const bal = () => { const r = regraDoBalanceio(); let a = +el.querySelector('#mp_bmin').value, b = +el.querySelector('#mp_bmax').value; if (b < a) { b = a; el.querySelector('#mp_bmax').value = String(b); } projeto.balanceio = { min: a, max: b, progresso: Math.max(1, Math.min(200, +el.querySelector('#mp_bprog').value || r.progresso)) }; renderPropriedades(); };
    ['#mp_bmin', '#mp_bmax', '#mp_bprog'].forEach(k => el.querySelector(k).onchange = bal);
    widgetPoolItens(el.querySelector('#mp_itens'), projeto.itensPool);
    const campos = () => {
      const c = el.querySelector('#mp_fmCampos');
      if (fm.tipo === 'survive_rounds') c.innerHTML = `<label class="campo">Rounds <input id="mp_rod" type="number" min="1" value="${fm.rodadas || 8}" style="width:80px"></label>`;
      else if (fm.tipo === 'use_object') c.innerHTML = `<p>Object: <b>${projeto.salas[fm.sala]?.objetos[fm.objeto] ? esc(rotulo(projeto.salas[fm.sala].objetos[fm.objeto])) + ' (room ' + (fm.sala + 1) + ')' : 'none yet'}</b> <button class="sm" id="mp_obj">Click the object on the board</button></p>`;
      else if (fm.tipo === 'defeat_room') { if (fm.sala === undefined || !projeto.salas[fm.sala]) fm.sala = 0; c.innerHTML = `<label class="campo">Room <select id="mp_sala">${projeto.salas.map((s, i) => `<option value="${i}" ${fm.sala === i ? 'selected' : ''}>${i + 1} · ${esc(s.nome)} (${inimigosDaSala(s).length} monster(s))</option>`).join('')}</select></label><p class="ajuda">Every monster placed in that room and every monster its triggers bring must be defeated. The map ends when the last one falls.</p>`; }
      else if (fm.tipo === 'reach_room') c.innerHTML = `<label class="campo">Room <select id="mp_sala">${projeto.salas.map((s, i) => `<option value="${i}" ${fm.sala === i ? 'selected' : ''}>${i + 1} · ${esc(s.nome)}</option>`).join('')}</select></label>`;
      else if (fm.tipo === 'trigger') { const ms = missoesInternas(); c.innerHTML = ms.length ? `<label class="campo">Objective <select id="mp_uid">${ms.map(x => `<option value="${x.uid}" ${fm.uid === x.uid ? 'selected' : ''}>${esc(x.nome)}${ondeMissao(x)}</option>`).join('')}</select></label><p class="ajuda">The objective is announced when its trigger fires; as the mission, completing it ends the map.</p>` : '<p class="ajuda">No “Add an objective” trigger exists yet. Add one to an object first.</p>'; }
      else c.innerHTML = '';
      const r = c.querySelector('#mp_rod'); if (r) r.onchange = e => { fm.rodadas = Math.max(1, +e.target.value || 8); };
      const sl = c.querySelector('#mp_sala'); if (sl) sl.onchange = e => { fm.sala = +e.target.value; };
      const u = c.querySelector('#mp_uid'); if (u) { fm.uid = fm.uid || ms0(); u.onchange = e => { fm.uid = e.target.value; }; }
      const ob = c.querySelector('#mp_obj'); if (ob) ob.onclick = () => { fechar(); pedirClique({ modo: 'object', g: null, si: salaAtual, texto: 'Click the object whose use completes the map.', cb: (x, y, q) => { if (!q || q.tipo !== 'objeto') return aviso('Click an object.'), false; fm.sala = q.sala; fm.objeto = q.i; setTimeout(abrirMapa, 0); return true; } }); };
    };
    const ms0 = () => missoesInternas()[0]?.uid;
    campos();
    el.querySelector('#mp_fm').onchange = e => { fm.tipo = e.target.value; if (fm.tipo === 'trigger') fm.uid = ms0(); campos(); renderConferencia(); };
  }, true);
}
/* one object URL per file (the panels are redrawn often: a new URL each time would keep every old one alive) */
const _urlsBlob = new WeakMap();
const urlDoBlob = b => { let u = _urlsBlob.get(b); if (!u) { u = URL.createObjectURL(b); _urlsBlob.set(b, u); } return u; };
/* the map's own music: an audio file played in a loop instead of the game's music */
function campoMusica(el, m) {
  const mu = m.musica; const blob = mu && AUDIOS[mu.arquivo];
  el.innerHTML = `<p class="ajuda">Your own music for this map, played in a loop in place of the game’s. <b>OGG</b> (Ogg Vorbis) is the format that suits the game best; WAV and MP3 also work. The file is saved next to the map file in the CustomMaps folder (the same folder as the .dmap).</p>
    <div class="linha"><label class="sm botaoArquivo">${mu ? 'Replace the music…' : 'Add music (OGG, WAV, MP3)…'}<input type="file" accept=".ogg,.oga,.wav,.mp3,audio/ogg,audio/wav,audio/mpeg" id="mp_musArq" hidden></label>
    ${mu ? `<b>${esc(mu.nome || mu.arquivo)}</b> <small class="ajuda">(${esc(mu.arquivo)}${blob ? ', ' + Math.round(blob.size / 1024) + ' KB' : ', file not in this browser: add it again'})</small><button class="sm perigo" id="mp_musTira">Remove</button>` : '<span class="ajuda">No music: the game plays its own.</span>'}</div>
    ${mu ? `<label class="chk"><input type="checkbox" id="mp_musLoop" ${mu.loop !== false ? 'checked' : ''}> Loop (starts again when it ends)</label>${blob ? `<audio controls src="${urlDoBlob(blob)}" style="width:100%;margin-top:6px"></audio>` : ''}` : ''}`;
  el.querySelector('#mp_musArq').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const ext = (f.name.match(/\.(ogg|oga|wav|mp3)$/i) || [])[1]; if (!ext) return aviso('Use an OGG, WAV or MP3 file.');
    const nome = 'music-' + (slug(m.name || 'map') || 'map') + '-' + uid().slice(-5) + '.' + ext.toLowerCase().replace('oga', 'ogg');
    await guardarAudio(nome, f); m.musica = { arquivo: nome, nome: f.name, loop: true };
    campoMusica(el, m); aviso('Music added' + (f.size > 15e6 ? ' (a large file: an OGG of 3 to 8 MB is plenty)' : '') + '.');
  };
  const t = el.querySelector('#mp_musTira'); if (t) t.onclick = () => { delete m.musica; campoMusica(el, m); };
  const lp = el.querySelector('#mp_musLoop'); if (lp) lp.onchange = e => { m.musica.loop = e.target.checked; };
}
/* your own film (MP4 or WebM) for a box of a scene or a "Play a video" trigger: alvo.video = {arquivo, nome} */
function campoVideo(el, alvo, depois) {
  const v = alvo.video; const blob = v && AUDIOS[v.arquivo];
  el.innerHTML = `<div class="linha"><label class="sm botaoArquivo">${v ? 'Replace the video…' : 'Add a video (MP4, WebM)…'}<input type="file" accept=".mp4,.m4v,.webm,video/mp4,video/webm" hidden></label>
    ${v ? `<b>${esc(v.nome || v.arquivo)}</b> <small class="ajuda">(${blob ? Math.round(blob.size / 1024 / 1024 * 10) / 10 + ' MB' : 'file not in this browser: add it again'})</small>` : '<span class="ajuda">No video yet.</span>'}</div>
    ${blob ? `<video controls src="${urlDoBlob(blob)}" style="width:100%;margin-top:6px;max-height:220px;background:#000"></video>` : ''}
    <p class="ajuda">It plays full screen; a click (or Space, Enter, Esc) skips it. <b>MP4 (H.264 video, AAC sound)</b> is the safest format; WebM (VP8) also works. The file is saved next to the campaign or map file.</p>`;
  el.querySelector('input[type=file]').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const ext = (f.name.match(/\.(mp4|m4v|webm)$/i) || [])[1]; if (!ext) return aviso('Use an MP4 or WebM file.');
    const nome = 'video-' + (slug(f.name.replace(/\.[^.]+$/, '')) || 'film').slice(0, 30) + '-' + uid().slice(-5) + '.' + ext.toLowerCase().replace('m4v', 'mp4');
    await guardarAudio(nome, f); alvo.video = { arquivo: nome, nome: f.name };
    campoVideo(el, alvo, depois); depois && depois(); aviso('Video added' + (f.size > 200e6 ? ' (a large file: consider compressing it)' : '') + '.');
  };
}
/* the items that may be got in the map: workshop items (and runes of the workshop) */
function widgetPoolItens(el, lista) {
  const opcoes = ITENS_B().filter(i => !lista.includes(i.id)).map(i => `<option value="${esc(i.id)}">${esc(i.nome)}</option>`).join('') + (oficina().armas || []).filter(a => a.runa && !lista.includes('RUNA:' + a.id)).map(a => `<option value="RUNA:${esc(a.id)}">${esc(nomeItem('RUNA:' + a.id))}</option>`).join('');
  el.innerHTML = `<div class="linha"><select class="poolAdd"><option value="">+ add an item…</option>${opcoes}</select>${opcoes ? '<button class="sm" data-todos>All workshop items</button>' : ''}</div>
    <div>${lista.map((id, i) => `<span class="tag">${esc(nomeItem(id))}${itemDaOficina(id) ? '' : ' (not in the workshop!)'} <a href="#" data-pooldel="${i}">✕</a></span>`).join('') || '<span class="ajuda">empty</span>'}</div>${ITENS_B().length ? '' : '<p class="ajuda">The workshop has no items: import or create them in the Items tab.</p>'}`;
  el.querySelector('.poolAdd').onchange = e => { if (e.target.value && !lista.includes(e.target.value)) lista.push(e.target.value); widgetPoolItens(el, lista); };
  const t = el.querySelector('[data-todos]'); if (t) t.onclick = () => { ITENS_B().forEach(i => { if (!lista.includes(i.id)) lista.push(i.id); }); widgetPoolItens(el, lista); };
  el.querySelectorAll('[data-pooldel]').forEach(a => a.onclick = ev => { ev.preventDefault(); lista.splice(+a.dataset.pooldel, 1); widgetPoolItens(el, lista); });
}
/* a list of monster ids (bestiary) with an add select and removable tags */
function widgetPool(el, lista, depois) {
  const faltam = MONSTROS().filter(m => !lista.includes(m.id));
  gradeDoPool(el, id => lista.includes(id), id => { const k = lista.indexOf(id); if (k >= 0) lista.splice(k, 1); else lista.push(id); widgetPool(el, lista, depois); depois && depois(); }, () => '',
    (faltam.length ? `<button class="sm" data-todosm>All workshop monsters (${faltam.length})</button>` : '') + (lista.length ? '<button class="sm" data-nenhum>None</button>' : ''));
  const tm = el.querySelector('[data-todosm]'); if (tm) tm.onclick = () => { MONSTROS().forEach(m => { if (!lista.includes(m.id)) lista.push(m.id); }); widgetPool(el, lista, depois); depois && depois(); };
  const nn = el.querySelector('[data-nenhum]'); if (nn) nn.onclick = () => { lista.splice(0); widgetPool(el, lista, depois); depois && depois(); };
}
/* a pool as a grid of the workshop's monsters, with their pictures (like the Enemy palette): click one to put it in or
   take it out; the ones in the pool are lit and ticked */
function gradeDoPool(el, dentro, alternar, nota, botoes, compacta) {
  const ms = MONSTROS(); const filtroAntes = el.querySelector('.poolFiltro')?.value || '';
  if (!ms.length) { el.innerHTML = '<p class="ajuda">The workshop has no monsters: import or create them first.</p>'; return; }
  const n = ms.filter(m => dentro(m.id)).length;
  el.innerHTML = `<div class="linha poolTopo"><small>${n} of ${ms.length} in the pool · click to put in or take out</small>${botoes || ''}</div>${ms.length > 8 ? `<input class="poolFiltro" placeholder="filter…" value="${esc(filtroAntes)}">` : ''}<div class="${compacta ? 'gradePool compacta' : 'grade monstros gradePool'}"></div>`;
  const g = el.querySelector('.gradePool');
  const pinta = f => { g.innerHTML = ''; ms.filter(m => !f || (m.nome || '').toLowerCase().includes(f)).forEach(m => {
    const on = dentro(m.id); const r = retratoDoMonstro(m); const nt = nota(m.id);
    const dv = document.createElement('div'); dv.className = 'item' + (on ? ' ativo' : ' fora'); dv.title = on ? 'In the pool: click to take it out' : 'Click to put it in the pool';
    const f = figurasDoTipo(m.tipo); const tf = f === null ? '' : f ? ' · ' + f + ' miniature' + (f > 1 ? 's' : '') : ' · no miniature';
    if (compacta) { dv.title = m.nome + ' (' + m.tipo + tf + (nt ? ' · ' + nt : '') + ')\n' + dv.title; dv.innerHTML = `${r ? `<img src="${r}" alt="">` : `<span class="vazio">${esc((m.nome || '?').slice(0, 2))}</span>`}${on ? '<b class="visto">✓</b>' : ''}`; }
    else dv.innerHTML = `${r ? `<img class="redondo" src="${r}" alt="">` : '<span class="redondo vazio"></span>'}<div>${on ? '✓ ' : ''}${esc(m.nome)}<small>${esc(m.tipo)}${tf}${nt ? ' · ' + esc(nt) : ''}</small></div>`;
    dv.onclick = () => alternar(m.id); g.appendChild(dv); }); };
  pinta(filtroAntes.toLowerCase()); const fi = el.querySelector('.poolFiltro'); if (fi) fi.oninput = e => pinta(e.target.value.toLowerCase());
}

// ------------------------------------------------------------ pending clicks on the board
function pedirClique(p) { escolha = p; if (p.g) { const s = projeto.salas[p.si]; const oi = s.objetos.findIndex(o => todosGatilhos(o).includes(p.g)); if (oi >= 0) sel = { tipo: 'objeto', sala: p.si, i: oi }; else { const x = inimigosDaSala(s).find(({ e }) => todosGatilhos(e).includes(p.g)); if (x) sel = selDoInimigo(p.si, x.origem); } } renderFaixa(); renderPaleta(); renderPropriedades(); aviso(p.texto, true); desenhar(); }
function terminarClique() { const e = escolha; escolha = null; $('#aviso').classList.remove('mostra'); tudo(); if (e && e.aoTerminar) e.aoTerminar(); }

// ------------------------------------------------------------ top bar wiring
$('#m_nome').oninput = e => { projeto.meta.name = e.target.value; renderConferencia(); renderCabecalho(); };
$('#btnNovaSala').onclick = () => novaSala(null);
$('#btnMapa').onclick = () => abrirMapa();
$('#btnOficina').onclick = () => abrirFichas(abaF || 'monstros');
$('#btnGerarSala').onclick = () => iniciarGerador();
$('#btnGerarMapa').onclick = () => (typeof abrirGeradorMapa === 'function' ? abrirGeradorMapa() : aviso('Soon.'));
$('#btnCampanha').onclick = () => { if (!campanha) { criarCampanha(); tudo(); avisoLongo('Campaign started: this map is map 1. The campaign screen links maps, waypoints and dialogues and places them on the world map.'); } abrirCampanha('fluxo'); };
$('#btnEnquadrar')?.addEventListener('click', enquadrar);

// ------------------------------------------------------------ keyboard
window.addEventListener('keydown', ev => {
  if (ev.key === 'F5' || ev.key === 'F9') { ev.preventDefault(); if (ev.key === 'F5') salvarRapido(); else carregarRapido(); return; }
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if (!$('#telaCampanha').hidden || $('#telaFichas') && !$('#telaFichas').hidden || $('.modal')) return;
  if (ev.key === 'Escape') { fecharPopupEscolha(); if (vista3d.on) { alternar3d(false); return; } if (escolha) { terminarClique(); return; } sel = null; ferramenta = null; tudo(); return; }
  if (ev.key === '3' && !ev.ctrlKey && !ev.metaKey) { alternar3d(); return; }
  if (vista3d.on) { const k = ev.key.toLowerCase();
    if (ev.key === '+' || ev.key === '=') zoom3d(1.2); else if (ev.key === '-' || ev.key === '_') zoom3d(1 / 1.2);
    else if (k === 'q') girar3d(-45); else if (k === 'e') girar3d(45); else if (k === 'w') inclinar3d(-12); else if (k === 's') inclinar3d(12);
    else if (k === 't') vistaDeCima(); else if (ev.key === 'Home') vistaInicial(); else if (k === 'f') enquadrar3d();
    else if (ev.key.startsWith('Arrow')) { ev.preventDefault(); const dx = ev.key === 'ArrowLeft' ? 1 : ev.key === 'ArrowRight' ? -1 : 0, dy = ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowDown' ? -1 : 0; vista3d.px += dx * 60; vista3d.py += dy * 60; pedirDesenho(); }
    return; }
  // a generated room on the board, before it is used: the arrows move it and R turns it
  if (posicionandoPrevia() && (ev.key === 'r' || ev.key === 'R')) { girarPrevia(); return; }
  if (posicionandoPrevia() && !sel && ev.key.startsWith('Arrow')) { ev.preventDefault(); moverPrevia(ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0, ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0); return; }
  if (ev.key === 'r' || ev.key === 'R') { girar_selecao(); return; }
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'c' || ev.key === 'C')) { ev.preventDefault(); if (!escolha) copiarSelecao(); return; }
  if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'v' || ev.key === 'V')) { ev.preventDefault(); if (!escolha) colar(); return; }
  if (ev.key === 'c' || ev.key === 'C') { if (sel && sel.tipo === 'objeto') copiarObjeto(); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { if (sel && !escolha) apagarSelecao(sel); return; }
  const atalhos = { t: 'peca', h: 'heroi', o: 'objeto', e: 'inimigo', p: 'pilar', d: 'apagar' };
  if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && atalhos[ev.key.toLowerCase()] && salaAtual >= 0 && !escolha) { const f = atalhos[ev.key.toLowerCase()]; if (f === 'heroi' && salaAtual !== 0) return; ferramenta = ferramenta === f ? null : f; sel = null; tudo(); return; }
  if (ev.key.startsWith('Arrow')) {
    ev.preventDefault();
    const dx = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0, dy = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
    if (sel && !escolha && projeto.salas[sel.sala]) { moverSelecao(dx, dy); return; }
    vista.px -= dx * 60; vista.py -= dy * 60; desenhar(); return;
  }
  if (ev.key === '+' || ev.key === '=') { zoomCentro(1.2); return; } if (ev.key === '-' || ev.key === '_') { zoomCentro(1 / 1.2); return; }
  if (ev.key === 'PageUp') { ev.preventDefault(); mudarNivel(Math.min(nivelMaximoLiberado(), nivel + 1)); }
  if (ev.key === 'PageDown') { ev.preventDefault(); mudarNivel(Math.max(0, nivel - 1)); }
});

// ------------------------------------------------------------ Ctrl+Z / Ctrl+Y in every text box
/* The panels are rebuilt often (a new element for the same field), and some edits are made by buttons, so the browser's own
   undo loses track. Each text box has its own history here, kept by a key that survives the rebuild: where it is (the ids and
   data-i of its ancestors, its own data-* attributes) and what is selected (piece, workshop entry, campaign node). */
const Desfazer = (() => {
  const historicos = new Map(); let aplicando = false;
  const ehTexto = el => el && ((el.tagName === 'TEXTAREA') || (el.tagName === 'INPUT' && /^(text|search|)$/i.test(el.type || '')));
  function chave(el) {
    const anc = []; for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (p.dataset && p.dataset.i !== undefined) anc.push('i' + p.dataset.i); if (p.id) { anc.push('#' + p.id); break; } }
    const proprios = [...el.attributes].filter(a => a.name.startsWith('data-') || a.name === 'id' || a.name === 'placeholder').map(a => a.name + '=' + a.value).join('&');
    let ctx = ''; try { ctx = JSON.stringify([sel, salaAtual, typeof fichaSel !== 'undefined' ? fichaSel : null, typeof abaF !== 'undefined' ? abaF : null, typeof noSel !== 'undefined' ? noSel : null, typeof caixaSel !== 'undefined' ? caixaSel : null, missaoAtual]); } catch { }
    return anc.reverse().join('/') + '|' + proprios + '|' + ctx;
  }
  function hist(el) { const k = chave(el); let h = historicos.get(k); if (!h) { h = { pilha: [el.value], i: 0, t: 0 }; historicos.set(k, h); } return h; }
  document.addEventListener('focusin', e => { if (!ehTexto(e.target)) return; const h = hist(e.target); if (h.pilha[h.i] !== e.target.value) { h.pilha.splice(h.i + 1); h.pilha.push(e.target.value); h.i = h.pilha.length - 1; } }, true);
  document.addEventListener('input', e => {
    if (aplicando || !ehTexto(e.target)) return;
    const h = hist(e.target); const v = e.target.value, agora = Date.now();
    const juntar = agora - h.t < 700 && h.i > 0 && !/[\s.,;:!?]$/.test(v);
    h.pilha.splice(h.i + 1);
    if (juntar) h.pilha[h.i] = v; else { h.pilha.push(v); h.i = h.pilha.length - 1; }
    if (h.pilha.length > 200) { h.pilha.shift(); h.i--; }
    h.t = agora;
  }, true);
  function aplicar(el, v) { aplicando = true; try { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } finally { aplicando = false; } }
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const el = document.activeElement; if (!ehTexto(el)) return;
    const k = e.key.toLowerCase(); const refazer = k === 'y' || (k === 'z' && e.shiftKey); if (k !== 'z' && k !== 'y') return;
    e.preventDefault(); e.stopPropagation();
    const k0 = chave(el); const h = hist(el); if (h.pilha[h.i] !== el.value) { h.pilha.splice(h.i + 1); h.pilha.push(el.value); h.i = h.pilha.length - 1; }
    if (refazer) { if (h.i < h.pilha.length - 1) { h.i++; aplicar(el, h.pilha[h.i]); } }
    else if (h.i > 0) { h.i--; aplicar(el, h.pilha[h.i]); }
    h.t = 0;
    let alvo = el;
    if (!document.contains(el)) { alvo = [...document.querySelectorAll('textarea, input')].find(x => ehTexto(x) && chave(x) === k0) || null; }
    if (alvo) { alvo.focus(); const fim = alvo.value.length; try { alvo.setSelectionRange(fim, fim); } catch { } }
  }, true);
  return { historicos };
})();
