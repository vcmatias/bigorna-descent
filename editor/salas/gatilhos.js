/* Bigorna Rooms v2 — objects: texts, triggers, requirements, consequences; room/tile removal; tile reuse; pillar limits. */
'use strict';

const TIPOS_GATILHO = [
  { id: 'open_room', nome: 'Open a room', expl: 'Reveals a room when this object is used: its tiles, pillars, doors and objects are placed in that order. Several objects (levers, doors…) may open the same room; a new room can be created here too.' },
  { id: 'spawn', nome: 'Spawn monsters', expl: 'Monsters enter when the object is used. Either drawn from the spawn pool of this room (the spaces you click share the game’s rule: how many enter and how strong depend on the points) or one enemy of the workshop, on the space you click.' },
  { id: 'give_item', nome: 'Give or take away an item', expl: 'The party receives it in the app’s inventory, with the game’s treasure window: an item you pick (of the workshop, a rune or a recipe of the workshop), a random item from the item pool of the map, random materials from the item pool worth N loot points, or gold. The item pool is set in Map setup. Set to “Take away”, it takes gold or random crafting materials from the party instead: a merchant’s price, a thief.' },
  { id: 'rounds', nome: 'Every N rounds (waves)', expl: 'From when the object is used, the round counter runs the triggers inside: every N rounds (as many times as you say, or to the end of the map), or once, N rounds later. For a wave, put “Spawn monsters” inside: the spawn has its own “When the group is defeated”.' },
  { id: 'text', nome: 'Show a text', expl: 'A message box with your text.' },
  { id: 'counter', nome: 'Add / subtract / use a count', expl: 'Adds to (or takes from) a counter of the map, or uses it: “Use” runs the triggers inside when the count reaches a number. Counters: keys found, levers pulled, seals broken… The count lives only in the app (nothing goes to the inventory). A mission, or the requirement of an object, can wait for the counter to reach a number.' },
  { id: 'skill_test', nome: 'Skill test', expl: 'The players roll at the table and enter their successes; the mod compares with your number. Open test: the box says how many are needed. Secret: it does not. Each result (success, failure) may have its own text and its own triggers.' },
  { id: 'choice', nome: 'Multiple choice', expl: 'A question with up to five answers; each answer may show a text afterwards and have its own triggers.' },
  { id: 'mission', nome: 'Add an objective', expl: 'A goal on this map, announced when the object is used and listed with the objectives. An objective does not end the map: the mission does (Map setup). An objective can be chosen there as the mission.' },
  { id: 'unlock_map', nome: 'Unlock a campaign map', expl: 'A map of the campaign (a card of the story flow) stays locked until this trigger runs. Unlocked, it appears on the world map as soon as the cards before it in the story flow are completed.' },
  { id: 'remove_room', nome: 'Remove a room', expl: 'Takes a whole room off the board during play: its tiles, pillars, objects and monsters. Frees those tiles for reuse in a later room; the heroes cannot go back there.' },
  { id: 'remove_tile', nome: 'Remove a tile', expl: 'Takes one tile off the board with everything on it (objects, pillars, monsters). Frees it for reuse in a later room.' },
  { id: 'remove_enemy', nome: 'Remove monsters', expl: 'Takes monsters off the board without counting them as defeated: one specific monster (click it), a spawn group, the monsters of this room, or all.' },
  { id: 'enemy_condition', nome: 'Change monster conditions', expl: 'Heal, damage, apply or remove a condition on a spawn group, on the monsters of this room or on all. Heroes are healed at the table (use a text).' },
  { id: 'move_heroes', nome: 'Move the heroes', expl: 'Lights up the spaces you click in the game and tells the table to move the heroes there (one hero per space), every time it fires.' },
  { id: 'add_tile', nome: 'Add a tile', expl: 'A tile appears on the board when this object is used, with the objects and monsters placed on it (a bridge, a collapsed wall, a secret passage). Lay the tile in any room first: it stays faded in the editor and out of play until the trigger fires. Then click it here.' },
  { id: 'add_object', nome: 'Add an object', expl: 'A new object appears on the board when this one is used. Pick its kind and click where it goes.' },
  { id: 'remove_object', nome: 'Remove an object', expl: 'An object of this map disappears from the board (click it).' },
  { id: 'highlight', nome: 'Highlight', expl: 'Draws attention to an object (outline) or a space (highlight).' },
  { id: 'scene', nome: 'Play a scene', expl: 'A scene of dialogue boxes, like the scenes of the story flow: who speaks, the text, the others in the picture, the background; a box may ask a question and each answer lead to another box. The scene plays in the game’s story window.' },
  { id: 'cutscene', nome: 'Play a video', expl: 'Plays your own film (MP4 or WebM) full screen; the players can skip it with a click.' },
  { id: 'sound', nome: 'Play a sound', expl: 'Plays a sound effect of the game (listen to them in the game: F7 → sounds) or your own sound file (OGG, MP3 or WAV).' },
  { id: 'item_pool', nome: 'Change the item pool', expl: 'Adds an item to (or removes one from) the item pool of the map, the one “Give an item” draws its random items and materials from, for the rest of the map.' },
  { id: 'reserve', nome: 'Change the spawn pool', expl: 'Adds a monster to (or removes one from) the pool the game draws from, for the rest of the map.' },
  { id: 'end_map', nome: 'End the map', expl: 'The map ends here, in victory or in defeat (a villain escaped, the time ran out…).' },
  { id: 'escort', nome: 'Escort (a protected one)', expl: 'Someone the heroes protect (a token on the table, with 5 interaction tokens beside it as its health): from now on the monsters may pick it as their target; the activation window shows it by name. The hunters (spawn groups you list) always go for it; the others, with a chance each round. “End” stops it (it fell, or it is safe).' },
  { id: 'move_object', nome: 'Move an object', oculto: true, expl: 'Moves an object of the map to a space (the generator uses it to take the protected one beside the waystone it woke).' },
  { id: 'objective', nome: 'Room objective', oculto: true, expl: 'Using this object counts as an objective of the room (listed and ticked). Older maps only: use “Add a mission → An object is used”.' },
];
const GATILHO = Object.fromEntries(TIPOS_GATILHO.map(t => [t.id, t]));
/* the marker "additional action" beside the button that adds triggers: as in the game, the hero who used the object may
   perform an additional action ("You may perform an additional action", shown by the game in its language) */
const temExtra = (o, lista) => !!(o && o.acaoExtra && o.acaoExtra[lista]);
const chipExtra = (o, lista) => o && !o.enemy && !o.ehContador ? `<label class="chk chipExtra" title="${esc(tr('As in the game: after this, the hero who used the object may perform an additional action (the game shows its own sentence).'))}"><input type="checkbox" data-extra="${esc(lista)}" ${temExtra(o, lista) ? 'checked' : ''}> ⚡ ${esc(tr('Additional action'))}</label>` : '';
function ligarExtras(el, o) { if (!el || !o) return; el.querySelectorAll('input[data-extra]').forEach(i => { if (i._ligado) return; i._ligado = true;
  i.onclick = e => e.stopPropagation();
  i.onchange = () => { o.acaoExtra = o.acaoExtra || {}; if (i.checked) o.acaoExtra[i.dataset.extra] = true; else delete o.acaoExtra[i.dataset.extra]; if (!Object.keys(o.acaoExtra).length) delete o.acaoExtra; renderConferencia(); }; }); }
/* triggers shown together in the catalog: one entry, then the kind */
const GRUPOS_GATILHO = [
  { id: 'grp:addremove', nome: 'Add / Remove…', expl: 'Puts something on the board, or takes it off, during play: tiles, objects, monsters, rooms.', pergunta: 'Add or remove?',
    ramos: [
      { id: 'ramo:add', nome: 'Add…', expl: 'Something appears on the board: a tile, an object or monsters.', pergunta: 'Add what?',
        membros: [['add_tile', 'A tile'], ['add_object', 'An object'], ['spawn', 'Spawn monsters']] },
      { id: 'ramo:remove', nome: 'Remove…', expl: 'Takes something off the board: a tile, a room, an object or monsters.', pergunta: 'Remove what?',
        membros: [['remove_tile', 'A tile'], ['remove_room', 'A room'], ['remove_object', 'An object'], ['remove_enemy', 'A monster (or a group, the room’s, all)']] },
    ] },
  { id: 'grp:media', nome: 'Play a scene, video or sound', expl: 'A scene of dialogue boxes (like the story flow), your own film full screen, a sound effect of the game or your own sound file.', pergunta: 'Play what?',
    membros: [['scene', 'A scene (dialogue boxes)'], ['cutscene', 'A video (your own film)'], ['sound', 'A sound (game effect or your own file)']] },
  { id: 'grp:pool', nome: 'Change item / spawn pool', expl: 'Adds to (or removes from) the item pool or the monster spawn pool of the map, for the rest of the map.', pergunta: 'Change which pool?',
    membros: [['item_pool', 'Item'], ['reserve', 'Monster spawn']] },
];
const membrosDoGrupo = gr => gr.membros || gr.ramos.flatMap(r => r.membros);
/* "Remove an object" aimed at the object that holds it (a point of interest is taken away when used, as in the game) */
const ehAutoRemocao = (g, si, oi) => g.tipo === 'remove_object' && (g.proprio || (g.objSala === si && g.objIndex === oi));
const autoRemocao = () => ({ uid: uid(), tipo: 'remove_object', proprio: true });
/* a "Show a text" trigger (with its requirements), and the same with the text in the editor's language (the generators) */
const gatilhoTexto = (text, requisitos = []) => ({ uid: uid(), tipo: 'text', text, requisitos });
const txtT = (en, pt) => gatilhoTexto(L2(en, pt));
/* a result list of a trigger (ok, fail, grupo, rodada…), found on whichever holder keeps it */
function listaDoGatilho(g, prefixo) { const k = prefixo + ':' + g.uid; for (const ss of projeto.salas) for (const { o } of donosDaSala(ss)) if (o[k]) return o[k]; for (const c of projeto.contadores || []) if (c[k]) return c[k]; return []; }
const grupoDoGatilho = id => GRUPOS_GATILHO.find(gr => membrosDoGrupo(gr).some(([m]) => m === id));
/* tiles that enter the board by an "Add a tile" trigger: 'room:tile' -> reveal group of that tile */
function pecasAdicionadas(p = projeto) {
  const m = new Map(), olha = o => todosGatilhos(o).forEach(g => { if (g.tipo === 'add_tile' && p.salas[g.sala]?.pecas[g.peca]) m.set(g.sala + ':' + g.peca, 'tile-' + (g.sala + 1) + '-' + (g.peca + 1)); });
  p.salas.forEach(ss => donosDaSala(ss).forEach(({ o }) => olha(o))); (p.contadores || []).forEach(olha);
  return m;
}
/* the explanation of a trigger kind, worded for its holder (object or monster) */
const explDe = (tipo, o) => { const t = GATILHO[tipo]?.expl || ''; return o && o.enemy ? t.replace(/when (this|the) object is used/gi, 'when the monster is defeated').replace(/when this one is used/gi, 'when the monster is defeated') : t; };
/* "Play a sound" with the user's own file (OGG, MP3, WAV): kept in the browser, exported next to the map */
function campoSomProprio(el, g) {
  const s = g.som; const blob = s && AUDIOS[s.arquivo];
  el.innerHTML = `<div class="linha"><label class="sm botaoArquivo">${s ? 'Replace the file…' : 'Choose a sound file (OGG, MP3, WAV)…'}<input type="file" accept=".ogg,.mp3,.wav,audio/ogg,audio/mpeg,audio/wav" hidden></label>
    ${s ? `<b>${esc(s.nome)}</b>${blob ? ' <button class="sm" data-ouvir title="Listen">▶</button>' : ' <small class="ajuda">(file not in this browser: add it again)</small>'}` : '<span class="ajuda">No file yet.</span>'}</div>
    <p class="ajuda">Plays once, at the volume of the game’s effects. The file is exported next to the map.</p>`;
  el.querySelector('input[type=file]').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const ext = (f.name.match(/\.(ogg|mp3|wav)$/i) || [])[1]; if (!ext) return aviso('Use an OGG, MP3 or WAV file.');
    const nome = 'sound-' + (slug(f.name.replace(/\.[^.]+$/, '')) || 'sound').slice(0, 24) + '-' + uid().slice(-5) + '.' + ext.toLowerCase();
    await guardarAudio(nome, f); g.som = { arquivo: nome, nome: f.name }; campoSomProprio(el, g); renderGatilhosSoResumo();
  };
  const o = el.querySelector('[data-ouvir]'); if (o) o.onclick = () => { const au = new Audio(URL.createObjectURL(blob)); au.play().catch(() => aviso('The browser could not play this file.')); };
}
/* what "Give an item" needs from the item pool and does not find there (null when it is there) */
function poolSemO(materiais) {
  const pool = projeto.itensPool || [];
  const mat = pool.some(id => ITENS_B().find(i => i.id === id)?.cls === 'CraftingMaterialModel'), item = pool.some(id => { const i = ITENS_B().find(x => x.id === id); return i && i.cls !== 'CraftingMaterialModel'; });
  return materiais ? (mat ? null : 'The item pool has no materials: add crafting materials to it (Workshop → Items, or Map setup).') : (item ? null : 'The item pool has no items: add items to it (Workshop → Items, or Map setup).');
}
const SO_CONSEQUENCIA = new Set(['end_map', 'escort', 'move_object', 'unlock_map', 'text', 'counter', 'sound', 'skill_test', 'choice', 'spawn', 'enemy_condition', 'highlight', 'give_item', 'remove_enemy', 'move_heroes', 'add_object', 'add_tile', 'remove_object', 'cutscene', 'scene', 'rounds']);
const TIPOS_REQUISITO = [
  { id: 'item', nome: 'The party has an item', expl: 'An item of the workshop must be in the party’s possession.' },
  { id: 'mission', nome: 'An objective was completed', expl: 'An objective added by an “Add an objective” trigger must already be completed.' },
  { id: 'room_open', nome: 'A room is open', expl: 'Another room must already be revealed.' },
  { id: 'enemies_defeated', nome: 'A room’s monsters are defeated', expl: 'Every monster that entered with a room (start or spawn) must be defeated.' },
  { id: 'object_used', nome: 'Another object was used', expl: 'Some other object of the map must have been used first (click it).' },
  { id: 'choice', nome: 'A choice in the campaign', expl: 'Something the party chose earlier in the campaign (an answer ticked “Remember this answer”): or that it did not choose.' },
  { id: 'gold', nome: 'The party has gold', expl: 'The party must have at least this much gold (a merchant’s price).' },
  { id: 'counter', nome: 'A counter reaches a number', expl: 'A counter of the map (see the “Add / subtract / use a count” trigger, or the Counts button on the ribbon) must have reached a number: 3 keys found, all the seals broken…' },
];

// ------------------------------------------------------------ object panel
function renderObjeto(el, s, oi) {
  const o = s.objetos[oi]; const terreno = ehTerreno(o);
  el.innerHTML = `<div class="linha"><img class="icoObj" src="${iconeObj(o.type)}" alt=""><p class="ajuda">${esc(nomeObj(o.type))} · room ${sel.sala + 1} · space ${o.pos[0]},${o.pos[1]}${(o.level || 0) > 0 ? ' · level ' + o.level : ''}${o.hidden ? ' · hidden until a trigger shows it' : ''}${ehTipo(o, 'PillarObj') ? ' · a column standing on a square; it supports no tile' : ''}</p></div>
    ${terreno ? `<label class="campo">Base level <select id="o_nivel">${[0, 1, 2, 3].map(l => `<option value="${l}" ${(o.level || 0) === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label><p class="ajuda">${ehTipo(o, 'Staircase') ? 'The arrow shows the way up (R turns it). It climbs from the base level to the next one. From level 1 up it stands on tiles of its base level.' : 'Floor: heroes walk on it. It may sit off the tiles.'}</p>` : ''}
    ${ehTipo(o, 'PillarObj') || ehTipo(o, 'PillarPush') ? `<label class="campo">Size <select id="o_pilar">${Object.entries(SUPORTES).filter(([k]) => !ehTipo(o, 'PillarPush') || TAMANHOS_INTERATIVO.includes(k)).map(([k, v]) => `<option value="${k}" ${(o.tamanho || 'Pillar') === k ? 'selected' : ''}>${v.nome} (reaches level ${v.nivel})</option>`).join('')}</select></label>` : ''}
    <label class="campo">Name <input id="o_nome" value="${esc(o.name || '')}" placeholder="${esc(nomeObj(o.type))}"></label>
    ${ehTipo(o, 'SightToken') ? '<p class="ajuda">A point of interest fires as soon as it is tapped, with or without a hero (it costs no action), and usually leaves the board: it reveals what lies ahead (open a room). Kept on the board and usable many times, it works as a passage between tiles that do not touch.</p>' : `<label class="campo">Text when looked at <small>(a player taps it with no hero chosen)</small><textarea id="o_click" rows="2" placeholder="Shown when a player taps the object without using it">${esc(o.textClick || '')}</textarea></label>`}
    <label class="campo">Text when used <small>(a hero uses it: tap it with the hero chosen)</small><textarea id="o_uso" rows="2" placeholder="Shown when a hero uses the object">${esc(o.textUse || '')}</textarea></label>
    ${terreno ? '' : `<label class="campo">Text once used up <small>(what it is after use: an open chest, a body already searched. It shows whenever the spent object is touched, looked at or used by a hero, and costs no action; an interaction token with no such text leaves the table when spent)</small><textarea id="o_gasto" rows="2" placeholder="Empty: the token leaves the table once spent">${esc(o.textGasto || '')}</textarea></label>`}
    ${terreno ? '' : `<label class="campo">Can be used <select id="o_usos">${[['', 'Once (like in the game)'], ['2', 'Twice'], ['3', 'Three times'], ['5', 'Five times'], ['always', 'Every time (never runs out)']].map(([k, n]) => `<option value="${k}" ${(o.usos || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
    <div class="sub">Triggers <button class="sm" id="o_add">+ Add</button> ${chipExtra(o, 'gatilhos')}</div>
    <p class="ajuda">${ehTipo(o, 'SightToken') ? 'They run in order when the point of interest is tapped.' : 'They run in order when a hero uses the object (an action: tap it with the hero chosen). Tapped with no hero, it only shows the text when looked at.'} A requirement goes inside the box of a trigger (open it) and holds back only that trigger.</p>
    <div id="o_gats"></div>
    <div class="linha acoes"><button id="o_copia">⧉ Copy</button><button id="o_apaga" class="perigo">Remove</button></div>
    ${terreno ? '' : `<div class="sub">Default of “${esc(nomeObj(o.type))}” ${padroesDaOficina()[o.type] ? '<small>(the Workshop’s)</small>' : temPadrao(o.type) ? '<small>(the game’s)</small>' : '<small>(none)</small>'}</div>
    <div class="linha acoes">${temPadrao(o.type) ? '<button class="sm" id="o_padrao" title="Replaces the texts and triggers of this object with the default of its kind">Apply the default</button>' : ''}<button class="sm" id="o_salvaPadrao" title="The texts and triggers of this object become the default of its kind, in the Workshop: objects placed from now on come with them">Save as the default</button>${padroesDaOficina()[o.type] ? '<button class="sm" id="o_padraoOriginal" title="The Workshop forgets its default for this kind">Back to the game’s default</button>' : ''}</div>`}`;
  $('#o_nome').oninput = e => { o.name = e.target.value; desenhar(); renderSalas(); };
  const op = $('#o_pilar'); if (op) op.onchange = e => { o.tamanho = e.target.value; tudo(); };
  if ($('#o_click')) $('#o_click').oninput = e => { o.textClick = e.target.value; };
  $('#o_uso').oninput = e => { o.textUse = e.target.value; };
  if ($('#o_gasto')) $('#o_gasto').oninput = e => { o.textGasto = e.target.value; if (!o.textGasto) delete o.textGasto; };
  const us = $('#o_usos'); if (us) us.onchange = e => { o.usos = e.target.value; if (!o.usos) delete o.usos; renderConferencia();
    const gi = o.usos ? (o.gatilhos || []).findIndex(g => ehAutoRemocao(g, sel.sala, oi)) : -1; if (gi < 0) return;
    escolherOpcao('“' + rotulo(o) + '” removes itself when used', [
      { id: 'tirar', titulo: 'Remove that trigger', sub: 'The object stays on the board and can be used ' + (o.usos === 'always' ? 'every time' : o.usos + ' times') + '.' },
      { id: 'manter', titulo: 'Keep it', sub: 'The object still leaves the board at its first use, so the other uses never happen.' }],
      id => { if (id === 'tirar') { const k = o.gatilhos.findIndex(g => ehAutoRemocao(g, sel.sala, oi)); if (k >= 0) o.gatilhos.splice(k, 1); gatAberto = -1; tudo(); aviso('The “Remove an object” trigger of “' + rotulo(o) + '” is gone.'); } },
      'It has a “Remove an object” trigger aimed at itself (points of interest get it by default, as in the game).'); };
  $('#o_add').onclick = () => abrirCatalogo(s, oi, 'gatilhos'); ligarExtras(el, o);
  $('#o_copia').onclick = () => copiarObjeto();
  const bp = $('#o_padrao'); if (bp) bp.onclick = () => { if (!confirm(tr('Replace the texts and triggers of this object with the default of its kind?'))) return; aplicarPadrao(o); tudo(); };
  const bs = $('#o_salvaPadrao'); if (bs) bs.onclick = () => { marcarVisto('dica:salvaPadrao'); const r = salvarComoPadrao(o); aviso(r === 'original' ? tr('This is the game’s default already: nothing to keep in the Workshop.') : tr('Saved: the default of this kind is now this object’s programming (in the Workshop).')); renderObjeto(el, s, oi); };
  const bo = $('#o_padraoOriginal'); if (bo) bo.onclick = () => { delete padroesDaOficina()[o.type]; aviso(tr('The Workshop forgot its default: the game’s one is back.')); renderObjeto(el, s, oi); };
  $('#o_apaga').onclick = () => apagarSelecao({ tipo: 'objeto', sala: sel.sala, i: oi });
  const nv = $('#o_nivel'); if (nv) nv.onchange = e => { const antes = o.level || 0, quer = +e.target.value; o.level = quer; if (escadaSemApoio(o)) { o.level = antes; e.target.value = antes; return aviso(AVISO_ESCADA(quer)); } tudo(); };
  renderGatilhos($('#o_gats'), s, oi, 'gatilhos');
}
function removerObjeto(si, oi, semPergunta, semRender) {
  const s = projeto.salas[si]; const o = s.objetos[oi];
  const abre = (o.gatilhos || []).filter(g => g.tipo === 'open_room').map(g => g.sala).filter(x => abridoresDe(x).length === 1);
  if (abre.length && !semPergunta) {
    if (confirm('This is the only object that opens room ' + abre.map(x => x + 1).join(', ') + '.\n\nOK: first move all its triggers to another object (you click it), then delete.\nCancel: delete anyway; the room stays without an opener until another object gets an “Open a room” trigger.')) { transferirGatilhos(si, oi, () => removerObjeto(si, oi, true)); return; }
  }
  s.objetos.splice(oi, 1);
  s.objetos.forEach(x => { if (x.gemeo == null) return; if (x.gemeo === oi) delete x.gemeo; else if (x.gemeo > oi) x.gemeo--; });
  s.objetivos.forEach(ob => { if (ob.objeto === oi) ob.objeto = -1; else if (ob.objeto > oi) ob.objeto--; });
  const fm = projeto.meta.finalMission; if (fm && fm.tipo === 'use_object' && fm.sala === si) { if (fm.objeto === oi) fm.objeto = -1; else if (fm.objeto > oi) fm.objeto--; }
  // every holder, the counters' consequences too
  projeto.salas.flatMap(ss => donosDaSala(ss)).concat(donosContadores()).forEach(({ o: x }) => { todosGatilhos(x).forEach(g => { if (g.objSala === si && g.objIndex !== undefined) { if (g.objIndex === oi) delete g.objIndex; else if (g.objIndex > oi) g.objIndex--; } });
    [x, ...todosGatilhos(x)].flatMap(z => z.requisitos || []).forEach(r => { if (r.tipo === 'object_used' && r.sala === si) { if (r.objeto === oi) delete r.objeto; else if (r.objeto > oi) r.objeto--; } }); });
  limparAbridores();
  if (!semRender) { sel = null; tudo(); }
}
function transferirGatilhos(si, oi, depois) {
  const s = projeto.salas[si]; const o = s.objetos[oi];
  pedirClique({ modo: 'object', g: o.gatilhos[0], si, texto: 'Click the object that receives the triggers of “' + rotulo(o) + '” (Esc cancels).', cb: (x, y, q) => {
    if (!q || q.tipo !== 'objeto') return aviso('Click an object.'), false;
    if (q.sala === si && q.i === oi) return aviso('That is the same object; click another one.'), false;
    const alvo = projeto.salas[q.sala].objetos[q.i];
    // "Remove an object" aimed at the object itself stays there (moved, it would take the other object off the board)
    const fica = o.gatilhos.filter(g => g.proprio), fUid = new Set(fica.map(g => g.uid));
    alvo.gatilhos = (alvo.gatilhos || []).concat(o.gatilhos.filter(g => !g.proprio)); o.gatilhos = fica; alvo.requisitos = (alvo.requisitos || []).concat((o.requisitos || []).splice(0)); alvo.senao = (alvo.senao || []).concat((o.senao || []).splice(0)); listasDe(o).filter(l => l.includes(':') && !fUid.has(l.slice(l.indexOf(':') + 1))).forEach(l => { alvo[l] = o[l]; delete o[l]; });
    limparAbridores(); aviso('Triggers moved to “' + rotulo(alvo) + '”.');
    setTimeout(() => { depois && depois(); }, 0); return true; } });
}

// ------------------------------------------------------------ triggers list and fields
function resumoGatilho(g) {
  switch (g.tipo) {
    case 'open_room': return projeto.salas[g.sala] ? 'opens ' + (projeto.salas[g.sala].nome || 'room ' + (+g.sala + 1)) : 'opens a room (pick it)';
    case 'give_item': if (g.acao === 'remove') return g.modo === 'material' ? 'takes ' + (g.amount || 1) + ' random material(s)' : 'takes ' + (g.amount || 10) + ' gold'; return g.modo === 'random' || g.modo === 'craft' ? 'random loot (' + (g.points || 3) + ' pts)' : g.modo === 'craft' ? (g.amount || 1) + ' crafting material(s)' : g.modo === 'gold' ? (g.amount || 10) + ' gold' : g.modo === 'newitem' ? (g.amount || 1) + ' random item(s) of the pool' : 'item: ' + (g.item ? nomeItem(g.item) : '?');
    case 'unlock_map': { const n = noDoDesbloqueio(g); return 'unlocks ' + (n ? rotuloDoNo(n) + (nomeDoNo(n) !== rotuloDoNo(n) ? ' “' + nomeDoNo(n) + '”' : '') : '(no map yet)'); }
    case 'mission': return 'objective: ' + (g.text || '?').slice(0, 30);
    case 'text': return 'text: ' + (g.text || '').slice(0, 40);
    case 'counter': if (g.acao === 'use') { const d = listaDoGatilho(g, 'conta').length; return 'when ' + (g.contador || '(no counter yet)') + ' reaches ' + Math.max(1, +g.n || 1) + (g.desde === 'uso' ? ' (from when it runs)' : '') + ' · ' + (d ? d + ' trigger(s)' : 'nothing inside yet'); }
      return (g.acao === 'sub' ? '− ' : g.acao === 'set' ? '= ' : '+ ') + (g.n ?? 1) + ' ' + (g.contador || '(no counter yet)');
    case 'skill_test': return (g.secret ? 'secret' : 'open') + ' test, ' + (g.successes || 2) + ' success(es)'; // outcome counts are added by renderGatilhos
    case 'spawn': return g.fonte === 'pool' ? (g.cells || []).length + ' balanced space(s) from the pool' : (g.inimigos || []).length ? nomeIni(g.inimigos[0].enemy) + ((g.inimigos || []).length > 1 ? ' +' + (g.inimigos.length - 1) : '') : 'no monster yet';
    case 'remove_enemy': return 'removes ' + (g.alvo === 'all' ? 'all monsters' : g.alvo === 'group' ? 'a spawn group' : g.alvo === 'one' ? (inimigoRef(g.inimigo) ? nomeIni(inimigoRef(g.inimigo).enemy) + ' at ' + inimigoRef(g.inimigo).pos.join(',') : 'one monster (none picked yet)') : 'the monsters of this room');
    case 'enemy_condition': return ({ heal: 'heals', damage: 'damages', apply: 'applies ' + (g.condition || '?') + ' to', remove: 'removes ' + (g.condition || '?') + ' from', bonus: 'changes attack/defence of' })[g.acao || 'apply'] + ' ' + (g.alvo === 'all' ? 'all' : g.alvo === 'group' ? 'a spawn group' : 'the monsters of this room');
    case 'end_map': return 'ends the map in ' + (g.resultado === 'vitoria' ? 'victory' : 'defeat');
    case 'escort': return g.acao === 'fim' ? 'ends the escort' : 'starts the escort of ' + (g.nome || 'the protected one') + ' (' + (g.chance ?? 25) + '% of the other monsters, ' + (g.cacadores || []).length + ' hunter group(s))';
    case 'move_object': return 'moves ' + (g.objIndex !== undefined ? rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {}) : '(no object)') + (g.cell ? ' to ' + g.cell.join(',') : '');
    case 'move_heroes': return 'moves the heroes' + ((g.cells || []).length ? ' to ' + g.cells.map(c => c.join(',')).join('; ') : ' (no destination yet)');
    case 'add_object': return 'adds ' + nomeObj(g.objType || 'Chest') + (g.objIndex !== undefined ? '' : ' (no place yet)');
    case 'remove_object': return 'removes ' + (g.proprio ? 'itself' : g.objIndex !== undefined ? rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {}) : '(no target yet)');
    case 'remove_room': return 'removes ' + (projeto.salas[g.sala]?.nome || '(no room yet)');
    case 'add_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; return 'adds tile ' + (p ? nomePeca(p.tile) + ' of room ' + (g.sala + 1) : '(none yet)'); }
    case 'remove_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; return 'removes tile ' + (p ? nomePeca(p.tile) + ' of room ' + (g.sala + 1) : '(none yet)'); }
    case 'highlight': return 'highlights ' + (g.objIndex !== undefined ? rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {}) : g.cell ? 'space ' + g.cell.join(',') : '(no target yet)');
    case 'choice': return 'choice: ' + (g.text || '').slice(0, 30) + ' (' + (g.options || []).length + ' answers)';
    case 'scene': { const cx = g.caixas || []; const c0 = cx.find(c => c.id === g.inicio) || cx[0]; return 'scene: ' + cx.length + ' box(es)' + (c0 ? ' · ' + (c0.speaker ? nomePersonagem(c0.speaker) + ': ' : '') + '“' + (c0.text || '').slice(0, 30) + ((c0.text || '').length > 30 ? '…' : '') + '”' : ''); }
    case 'rounds': { const n = Math.max(1, +g.n || 2), d = listaDoGatilho(g, 'rodada').length; return (g.modo === 'uma' ? 'once, ' + n + ' round(s) later' : 'every ' + n + ' round(s)' + (+g.vezes ? ', ' + g.vezes + ' time(s)' : ', to the end')) + ' · ' + (d ? d + ' trigger(s)' : 'nothing inside yet'); }
    case 'cutscene': return g.video ? 'video ' + (g.video.nome || g.video.arquivo) : g.name ? 'game cutscene ' + (CUTSCENES.find(c => c.id === g.name)?.label || g.name) : '(no video yet)';
    case 'sound': return g.somModo === 'arquivo' ? 'own sound: ' + (g.som?.nome || '(no file yet)') : 'sound ' + (g.name || '?');
    case 'reserve': return (g.acao === 'remove' ? 'removes ' : 'adds ') + nomeIni(g.enemy || '?') + (g.acao === 'remove' ? ' from' : ' to') + ' the spawn pool';
    case 'item_pool': return (g.acao === 'remove' ? 'removes ' : 'adds ') + (g.item ? semGlifo(nomeItem(g.item)) : '(no item yet)') + (g.acao === 'remove' ? ' from' : ' to') + ' the item pool';
    case 'objective': return 'objective: ' + (g.text || '').slice(0, 30);
    default: return g.tipo;
  }
}
/* monsters: what may happen when one is defeated (the triggers of an object, less the ones that belong to objects) */
const SO_OBJETO = new Set(['open_room', 'objective']);
/* the key of the trigger that owns a nested list (ok:, fail:, op0:, rodada:… + its uid), however deep it sits: the key of
   a nested trigger carries the keys of every trigger above it, so opening it keeps them all open */
function chavePai(o, lista) { const uid = lista.split(':')[1]; for (const L of listasDe(o)) { const k = (o[L] || []).findIndex(x => x.uid === uid); if (k >= 0) return chaveDe(o, L, k); } return ''; }
/* key of an open trigger: "gatilhos3"; a trigger inside the outcome of a skill test: "gatilhos1|ok:<uid>0" */
function chaveDe(o, lista, gi) { return lista.includes(':') ? chavePai(o, lista) + '|' + lista + gi : lista + gi; }
function renderGatilhos(el, s, oi, lista) {
  const o = donoDe(s, oi); if (!o) return; const gs = o[lista] || (o[lista] = []); el.innerHTML = '';
  if (!gs.length) { el.innerHTML = '<p class="ajuda">' + (lista.includes(':') ? 'Nothing else happens.' : lista === 'senao' ? 'Nothing happens when the requirement fails (only the texts above).' : o.ehContador ? 'Nothing happens when the count is complete.' : o.enemy ? 'Nothing: its defeat only counts for the objectives (and the game’s own effects).' : 'No triggers: using the object only shows its text.') + '</p>'; return; }
  gs.forEach((g, gi) => {
    const reqs = g.requisitos || []; const podeReq = lista === 'gatilhos';
    const d = document.createElement('div'); d.className = 'gat' + (reqs.length ? ' comReq' : ''); const chave = chaveDe(o, lista, gi);
    const aberto = gatAberto === chave || String(gatAberto).startsWith(chave + '|');
    d.innerHTML = `<div class="cab"><span>${aberto ? '▾' : '▸'}</span><b>${esc(GATILHO[g.tipo]?.nome || g.tipo)}</b><small>${reqs.length ? '<span class="cadeado" title="Only when its requirement holds">🔒 ' + reqs.length + '</span> ' : ''}${esc(resumoGatilho(g))}</small><button class="sm" data-x title="Remove">✕</button></div>${aberto ? '<div class="corpo"><p class="expl">' + esc(explDe(g.tipo, o)) + '</p><div class="campos"></div>'
      + (podeReq ? `<div class="reqGat"><div class="sub">Requirement <button class="sm" data-addreq>+ Add</button></div><p class="ajuda">${reqs.length ? 'This trigger runs only when every requirement holds; the other triggers are not held back.' : 'None: this trigger always runs.'}</p><div class="reqs"></div>`
        + (reqs.length ? `<div class="sub">If it fails <button class="sm" data-addsenao>+ Add</button> ${chipExtra(o, 'senao:' + g.uid)}</div><div class="senaoGat"></div>` : '') + '</div>' : '') + '</div>' : ''}`;
    d.querySelector('.cab').onclick = ev => { if (ev.target.dataset.x !== undefined) return; gatAberto = aberto ? (lista.includes(':') ? chavePai(o, lista) : -1) : chave; renderPropriedades(); };
    d.querySelector('[data-x]').onclick = () => removerGatilho(s, oi, gi, lista);
    if (aberto) {
      camposGatilho(d.querySelector('.campos'), s, oi, g, lista); ligarExtras(d, o);
      if (podeReq) {
        d.querySelector('[data-addreq]').onclick = () => abrirRequisitos(s, oi, g);
        renderRequisitos(d.querySelector('.reqs'), s, oi, g);
        const sn = d.querySelector('[data-addsenao]'); if (sn) { sn.onclick = () => abrirCatalogo(s, oi, 'senao:' + g.uid); renderGatilhos(d.querySelector('.senaoGat'), s, oi, 'senao:' + g.uid); }
      }
    }
    el.appendChild(d);
  });
}
function removerGatilho(s, oi, gi, lista) {
  const g = donoDe(s, oi)[lista][gi];
  if (g.tipo === 'open_room' && projeto.salas[g.sala] && abridoresDe(g.sala).length === 1) {
    if (confirm('This is the only trigger that opens room ' + (g.sala + 1) + '.\n\nOK: move all the triggers of this object to another object (you click it) instead of deleting.\nCancel: delete the trigger; the room stays without an opener until another object gets an “Open a room” trigger.')) { transferirGatilhos(sel.sala, oi, () => { sel = null; tudo(); }); return; }
  }
  const o = donoDe(s, oi);   // before the hidden object goes: the indices after it move up
  if (g.tipo === 'add_object' && g.objIndex !== undefined) { const ts = g.objSala, ti = g.objIndex, alvo = projeto.salas[ts]?.objetos[ti]; if (alvo && alvo.hidden) { removerObjeto(ts, ti, true, true); if (sel && sel.tipo === 'objeto' && sel.sala === ts && sel.i > ti) sel.i--; } }
  if (g.tipo === 'skill_test') { delete o['ok:' + g.uid]; delete o['fail:' + g.uid]; } delete o['senao:' + g.uid]; delete o['grupo:' + g.uid]; delete o['rodada:' + g.uid]; delete o['conta:' + g.uid];
  if (g.tipo === 'choice') Object.keys(o).filter(k => new RegExp('^op\\d+:' + g.uid + '$').test(k)).forEach(k => delete o[k]); gatAberto = lista.includes(':') ? chavePai(o, lista) : -1; o[lista].splice(gi, 1); limparAbridores(); tudo();
}
function camposGatilho(el, s, oi, g, lista) {
  const si = sel.sala;
  const campo = (rot, html) => `<label class="campo">${rot}${html}</label>`;
  const alvos = () => `<select data-k="alvo"><option value="room" ${g.alvo === 'room' || !g.alvo ? 'selected' : ''}>Monsters of this room</option><option value="all" ${g.alvo === 'all' ? 'selected' : ''}>All monsters</option><option value="group" ${g.alvo === 'group' ? 'selected' : ''}>A spawn group…</option></select>` +
    (g.alvo === 'group' ? `<select data-k="grupo">${gruposDaMissao().map(x => `<option value="${x.id}" ${g.grupo === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('') || '<option value="">(no spawn groups yet)</option>'}</select>` : '');
  const itens = () => ITENS_B().length || g.item ? `<select data-k="item"><option value="">— pick —</option>${opcoesItens(g.item)}</select>` : `<p class="ajuda">The workshop has no items yet. <button class="sm" data-oficina="itens">Open the Workshop</button></p>`;
  let html = '';
  switch (g.tipo) {
    case 'open_room': html = campo('Opens', `<select data-k="sala">${projeto.salas[g.sala] ? '' : '<option value="" selected>— pick the room —</option>'}${projeto.salas.map((r, ri) => ri > 0 && ri !== si ? `<option value="${ri}" ${ri === g.sala ? 'selected' : ''}>${ri + 1} · ${esc(r.nome)}${abridoresDe(ri).length ? '' : ' (no opener yet)'}</option>` : '').join('')}</select>`) + `${projeto.salas[g.sala] ? `<p><button class="sm" data-ir="${g.sala}">Go to that room</button></p>` : ''}<p class="ajuda">Several objects may open the same room (two levers, say): the room appears with the first one used.</p>`; break;
    case 'give_item': { if (g.modo === 'craft') { g.modo = 'random'; g.points = (g.amount || 1) * 5; }
      const acao = campo('Action', `<select data-k="acao"><option value="" ${g.acao !== 'remove' ? 'selected' : ''}>Give</option><option value="remove" ${g.acao === 'remove' ? 'selected' : ''}>Take away</option></select>`);
      // taking away: only gold or random crafting materials (a merchant's price, a thief), never a chosen item
      if (g.acao === 'remove') { if (g.modo !== 'material') g.modo = 'gold';
        html = acao + campo('What', `<select data-k="modo"><option value="gold" ${g.modo === 'gold' ? 'selected' : ''}>Gold</option><option value="material" ${g.modo === 'material' ? 'selected' : ''}>Random crafting materials</option></select>`) +
          campo(g.modo === 'material' ? 'How many' : 'Gold', `<input data-k="amount" type="number" min="1" value="${g.amount || (g.modo === 'material' ? 1 : 10)}" style="width:70px">`) +
          `<p class="ajuda">${g.modo === 'material' ? 'Units drawn at random from the materials the party carries (never below zero).' : 'Never below zero. To charge a price, put the requirement “The party has gold” on this trigger.'}</p>`; break; }
      const modo = ['random', 'gold', 'newitem'].includes(g.modo) ? g.modo : 'item';
      const temMat = (projeto.itensPool || []).some(id => ITENS_B().find(i => i.id === id)?.cls === 'CraftingMaterialModel'), temItem = (projeto.itensPool || []).some(id => ITENS_B().find(i => i.id === id)?.cls !== 'CraftingMaterialModel');
      html = acao + campo('What', `<select data-k="modo"><option value="item" ${modo === 'item' ? 'selected' : ''}>An item (pick it)</option><option value="newitem" ${modo === 'newitem' ? 'selected' : ''}>A random item from the item pool</option><option value="random" ${modo === 'random' ? 'selected' : ''}>Random materials from the item pool (worth N loot points)</option><option value="gold" ${modo === 'gold' ? 'selected' : ''}>Gold</option></select>`) +
      (modo === 'item' ? escolhaDeItem(g.item) :
       modo === 'random' ? campo('Loot points', `<input data-k="points" type="number" min="1" value="${g.points || 10}" style="width:70px">`) + (temMat ? '' : `<div class="alertaPool"><b>The item pool has no materials.</b> This trigger draws its materials from the item pool: add crafting materials to it, or the game falls back to one of its own loot kinds. <button class="sm" data-poolitens>Open the item pool</button></div>`) + `<p class="ajuda">Materials of the item pool (Map setup) are drawn until they add up to these points (each unit is worth its value: base materials 5, essences 25 to 30).</p>` :
       modo === 'newitem' ? campo('How many', `<input data-k="amount" type="number" min="1" value="${g.amount || 1}" style="width:70px">`) + (temItem ? '' : `<div class="alertaPool"><b>The item pool has no items.</b> This trigger draws from the item pool: add items to it, or the game falls back to the items not yet discovered. <button class="sm" data-poolitens>Open the item pool</button></div>`) + `<p class="ajuda">Drawn from the item pool of the map (Map setup), never twice, never one the party already has.</p>` :
       campo('Gold', `<input data-k="amount" type="number" min="1" value="${g.amount || 10}" style="width:70px">`)); break; }
    case 'unlock_map': { const alvos = mapasParaLiberar(); const n = noDoDesbloqueio(g);
      html = alvos.length ? campo('Map', `<select data-k="no"><option value="">— pick —</option>${alvos.map(a => `<option value="${a.id}" ${n && n.id === a.id ? 'selected' : ''}>${esc(rotuloDoNo(a) + (nomeDoNo(a) !== rotuloDoNo(a) ? ' · ' + nomeDoNo(a) : ''))}</option>`).join('')}</select>`) + `<p class="ajuda">That map stays off the world map until this trigger runs; then it appears as soon as the cards before it in the story flow are completed. <button class="sm" data-campanha="1">Campaign screen</button></p>`
        : `<p class="ajuda">${campanha ? 'The campaign has no other map yet: add one in the story flow.' : 'This map is not in a campaign yet.'}</p>${campanha ? '<button class="sm" data-campanha="1">Campaign screen</button>' : ''}`; break; }
    case 'mission': html = campo('Objective text', `<input data-k="text" value="${esc(g.text || '')}" placeholder="What the players must do, as shown in the objectives">`) +
        campo('Completed when', `<select data-k="como"><option value="defeat_room" ${g.como === 'defeat_room' ? 'selected' : ''}>Monsters are defeated</option><option value="use_object" ${g.como === 'use_object' ? 'selected' : ''}>An object is used (click it)</option><option value="counter" ${g.como === 'counter' ? 'selected' : ''}>A counter reaches a number</option><option value="table" ${!g.como || g.como === 'table' ? 'selected' : ''}>Declared at the table</option></select>`) +
        (g.como === 'defeat_room' ? campo('Of the room', `<select data-k="salaAlvo">${projeto.salas.map((r, ri) => `<option value="${ri}" ${(g.salaAlvo ?? si) === ri ? 'selected' : ''}>${ri + 1} · ${esc(r.nome)}${ri === si ? ' (this room)' : ''}</option>`).join('')}</select>`) + '<p class="ajuda">Every monster of that room (the ones placed in it and the ones its triggers bring) must be defeated.</p>' : '') +
        (g.como === 'counter' ? camposContador(g, 'meta') : '') +
        (!g.como || g.como === 'table' ? '<p class="ajuda aviso">Declared at the table: the app only shows the objective text among the objectives and checks nothing by itself. It counts as completed when the table marks it in the Bigorna panel of the game (F8 → “Optional completed”); only then the requirement “An objective was completed” holds and, if it was chosen as the mission, the map ends.</p>' : '') +
        (g.como === 'use_object' ? `<p>Object: <b>${g.objIndex !== undefined ? esc(rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {})) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the object</button></p>` : '') +
        `<p class="ajuda">${projeto.meta.finalMission?.tipo === 'trigger' && projeto.meta.finalMission.uid === g.uid ? '<b>This objective is the mission of the map: completing it ends the map.</b>' : 'An objective does not end the map. To make it the mission, pick it in Map setup → Final mission → “An objective added by a trigger”.'}</p>`; break;
    case 'text': html = campo('Text', `<textarea data-k="text" rows="3">${esc(g.text || '')}</textarea>`); break;
    case 'counter': html = camposContador(g, 'conta'); break;
    case 'skill_test': html = campo('Text', `<textarea data-k="text" rows="2" placeholder="What the heroes attempt">${esc(g.text || '')}</textarea>`) + campo('Successes needed', `<input data-k="successes" type="number" min="1" max="9" value="${g.successes || 2}" style="width:70px">`) +
      `<label class="chk"><input type="checkbox" data-k="secret" ${g.secret ? 'checked' : ''}> Secret test (the players are not told how many successes they need)</label>` +
      `<label class="chk"><input type="checkbox" data-k="cumulativo" ${g.cumulativo ? 'checked' : ''}> Successes add up over tries (a lock, a heavy door: each try brings them closer)</label>` +
      `<p class="ajuda">As in the game: an open test tells how many successes are needed and the players say at the table whether they passed or failed; a secret test (or one that adds up) asks how many successes they rolled. As a guide: 1 success is easy, 2 standard, 3 hard, 4 or more extreme.</p>` +
      `<div class="resultado ok"><div class="sub">If they succeed <button class="sm" data-res="ok">+ Add</button> ${chipExtra(donoDe(s, oi), 'ok:' + g.uid)}</div>` + campo('Text', `<textarea data-k="ok" rows="2" placeholder="Shown on success (optional)">${esc(g.ok || '')}</textarea>`) + `<div data-lres="ok"></div></div>` +
      `<div class="resultado fail"><div class="sub">If they fail <button class="sm" data-res="fail">+ Add</button> ${chipExtra(donoDe(s, oi), 'fail:' + g.uid)}</div>` + campo('Text', `<textarea data-k="fail" rows="2" placeholder="Shown on failure (optional)">${esc(g.fail || '')}</textarea>`) + `<div data-lres="fail"></div></div>`; break;
    case 'spawn': { const lista = g.fonte !== 'pool'; const um = (g.inimigos || [])[0]; const escolhido = g.inimigoEscolhido || um?.enemy || MONSTROS()[0]?.id || '';
      html = campo('Monsters', `<select data-k="fonte"><option value="pool" ${!lista ? 'selected' : ''}>From the spawn pool of this room (balanced)</option><option value="list" ${lista ? 'selected' : ''}>One enemy from the workshop</option></select>`) +
      (!lista ? `<div class="sub">Spawn pool of this room</div><div class="poolDoGatilho"></div><p class="ajuda">${poolDaSala(si).length ? 'The game draws from the lit monsters. Changing them here changes the pool of the room (the same as the room panel).' : '<b>The pool is empty: light at least one monster above.</b>'}</p><p>Spaces: <b>${esc((g.cells || []).map(c => c.slice(0, 2).join(',')).join('; ') || 'none yet')}</b></p><button class="sm" id="g_por">Click the spaces where they appear</button>${(g.cells || []).length ? '<button class="sm" id="g_limpa" style="margin-left:6px">Clear</button>' : ''}` +
        ((g.cells || []).length ? `<p class="ajuda">The spaces work together, by the game's rule for random spawns: one budget of points for all of them (intensity ÷ 10 × heroes × 1.5 × progression, Map setup › Balancing) decides how many monsters enter and how strong. All may enter, or just one strong monster.</p>` +
          campo('Intensity', `<select data-k="intensidade">${Array.from({ length: 10 }, (_, k) => k + 1).map(n => `<option value="${n}" ${intensidadeDoGatilho(g) === n ? 'selected' : ''}>${n}${n === g.cells.length && !g.intensidade ? ' (= spaces, default)' : ''}</option>`).join('')}</select>`) +
          tabelaBalanceio(g.cells.length, intensidadeDoGatilho(g), poolDaSala(si)) +
          `<div class="resultado grupo"><div class="sub">When the group is defeated <button class="sm" data-res="grupo">+ Add</button></div><p class="ajuda">Runs when the last monster this trigger put in is defeated (however many the game chose), every time the trigger brings a new group.</p><div data-lres="grupo"></div></div>` : '')
        : !MONSTROS().length ? '<p class="ajuda">The workshop has no monsters: create or import them first (Workshop, top bar).</p>'
        : campo('Monster', `<select data-k="inimigoEscolhido" data-sem-render="1">${MONSTROS().map(m => `<option value="${m.id}" ${escolhido === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>`) +
          `<p>Space: <b>${um ? um.pos.join(',') + ((g.inimigos || []).length > 1 ? ' (and ' + (g.inimigos.length - 1) + ' more, from an older version of this trigger)' : '') : 'none yet'}</b> <button class="sm" id="g_por">${um ? 'Click to move it' : 'Click where it appears'}</button></p>`); break; }
    case 'remove_enemy': html = campo('Target', `<select data-k="alvo"><option value="room" ${g.alvo === 'room' || !g.alvo ? 'selected' : ''}>Monsters of this room</option><option value="one" ${g.alvo === 'one' ? 'selected' : ''}>One specific monster…</option><option value="all" ${g.alvo === 'all' ? 'selected' : ''}>All monsters</option><option value="group" ${g.alvo === 'group' ? 'selected' : ''}>A spawn group…</option></select>` +
      (g.alvo === 'group' ? `<select data-k="grupo">${gruposDaMissao().map(x => `<option value="${x.id}" ${g.grupo === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('') || '<option value="">(no spawn groups yet)</option>'}</select>` : '')) +
      (g.alvo === 'one' ? `<p>Monster: <b>${inimigoRef(g.inimigo) ? esc(nomeIni(inimigoRef(g.inimigo).enemy)) + ' at ' + inimigoRef(g.inimigo).pos.join(',') : 'none yet'}</b> <button class="sm" id="g_alvo">Click it on the board</button></p><p class="ajuda">If it is not on the board when the trigger fires, nothing happens.</p>` : ''); break;
    case 'enemy_condition': html = campo('Action', `<select data-k="acao"><option value="heal" ${g.acao === 'heal' ? 'selected' : ''}>Heal</option><option value="damage" ${g.acao === 'damage' ? 'selected' : ''}>Damage</option><option value="apply" ${g.acao === 'apply' || !g.acao ? 'selected' : ''}>Apply a condition</option><option value="remove" ${g.acao === 'remove' ? 'selected' : ''}>Remove conditions</option></select>`) +
      ((g.acao === 'heal' || g.acao === 'damage') ? campo('Amount', `<input data-k="amount" type="number" min="1" value="${g.amount || 2}" style="width:70px">`) : '') + (g.acao === 'apply' ? campo('Condition', `<select data-k="condition">${CONDICOES.map(c => `<option ${g.condition === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`) : '') + campo('Target', alvos()); break;
    case 'move_heroes': html = `<p>Destination: <b>${(g.cells || []).length ? (g.cells.length === 1 ? 'space ' : g.cells.length + ' spaces: ') + g.cells.map(c => c.join(',')).join('; ') : 'none yet'}</b></p><button class="sm" id="g_alvo">Click the spaces where the heroes appear</button>${(g.cells || []).length ? ' <button class="sm" id="g_limpa">Clear</button>' : ''}` +
      campo('Text for the table (optional)', `<input data-k="text" value="${esc(g.text || '')}" placeholder="Move the heroes to the highlighted spaces.">`) +
      `<p class="ajuda">In the game these spaces light up and the table is told to move the heroes there (one hero per space), every time the trigger fires. The light goes out at the next round or the next move. For an object used many times, set “Can be used” above.</p>`; break;
    case 'add_object': html = campo('Kind', `<select data-k="objType">${OBJETOS.map(x => `<option value="${x.id}" ${(g.objType || 'Chest') === x.id ? 'selected' : ''}>${esc(nomeObj(x.id))}</option>`).join('')}</select>`) + `<p>Place: <b>${g.objIndex !== undefined ? 'space ' + (projeto.salas[g.objSala]?.objetos[g.objIndex]?.pos || []).join(',') : 'none yet'}</b> <button class="sm" id="g_alvo">${g.objIndex !== undefined ? 'Click to move it' : 'Click where it appears'}</button></p>` + (g.objIndex !== undefined ? '<p class="ajuda">The new object is on the board (faded): select it to give it a name, texts and triggers.</p>' : ''); break;
    case 'remove_object': html = g.proprio ? `<p>Target: <b>this object itself</b> <button class="sm" id="g_alvo">Pick another object</button></p><p class="ajuda">Used, it leaves the board (like a point of interest in the game).</p>` : `<p>Target: <b>${g.objIndex !== undefined ? esc(rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {})) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the object</button></p>`; break;
    case 'remove_room': html = campo('Room', `<select data-k="sala"><option value="">— pick —</option>${projeto.salas.map((r, ri) => ri !== si ? `<option value="${ri}" ${g.sala === ri ? 'selected' : ''}>${ri + 1} · ${esc(r.nome)}</option>` : '').join('')}</select>`) + '<p class="ajuda">In the game the removal happens before any new tile is placed, so freed tiles can be reused right away.</p>'; break;
    case 'add_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; html = `<p>Tile: <b>${p ? nomePeca(p.tile) + ' of room ' + (g.sala + 1) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the tile on the board</button></p><p class="ajuda">Everything placed on that tile enters with it.</p>`; break; }
    case 'scene': html = `<p><b>${(g.caixas || []).length} box(es)</b> <button class="sm primario" id="g_cena">✎ Write the scene…</button></p><ol class="cenaResumo">${ordemDaCena(g).slice(0, 6).map(c => `<li>${c.speaker ? '<b>' + esc(nomePersonagem(c.speaker)) + ':</b> ' : ''}${esc((c.text || '(empty)').slice(0, 60))}${c.type === 'choice' ? ' <small>(question, ' + (c.options || []).length + ' answers)</small>' : ''}</li>`).join('')}</ol>`; break;
    case 'rounds': html = `<div class="duas">` + campo('When', `<select data-k="modo"><option value="cada" ${g.modo !== 'uma' ? 'selected' : ''}>Every N rounds</option><option value="uma" ${g.modo === 'uma' ? 'selected' : ''}>Once, N rounds later</option></select>`) + campo('N', `<input type="number" min="1" data-k="n" value="${Math.max(1, +g.n || 2)}" style="width:70px">`) + `</div>` +
      (g.modo !== 'uma' ? campo('How many times', `<select data-k="vezes">${[0, 1, 2, 3, 4, 5, 6, 8, 10].map(v => `<option value="${v}" ${(+g.vezes || 0) === v ? 'selected' : ''}>${v ? v + ' time(s)' : 'To the end of the map'}</option>`).join('')}</select>`) : '') +
      `<p class="ajuda">${g.modo === 'uma' ? 'Counts from the round the object is used in: ' + Math.max(1, +g.n || 2) + ' round(s) later, at the start of that round, the triggers below run once.' : 'Counts from the round the object is used in: every ' + Math.max(1, +g.n || 2) + ' round(s) after it, at the start of the round, the triggers below run' + (+g.vezes ? ' (' + g.vezes + ' time(s) in all).' : ', until the map ends.')} Used again, the object starts the count over.</p>` +
      `<div class="resultado rodada"><div class="sub">When the rounds come <button class="sm" data-res="rodada">+ Add</button></div><div data-lres="rodada"></div></div>`; break;
    case 'remove_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; html = `<p>Tile: <b>${p ? nomePeca(p.tile) + ' of room ' + (g.sala + 1) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the tile on the board</button></p><p class="ajuda">Everything on that tile goes with it.</p>`; break; }
    case 'end_map': html = campo('Result', `<select data-k="resultado"><option value="derrota" ${g.resultado !== 'vitoria' ? 'selected' : ''}>Defeat</option><option value="vitoria" ${g.resultado === 'vitoria' ? 'selected' : ''}>Victory</option></select>`); break;
    case 'escort': html = campo('Action', `<select data-k="acao"><option value="inicio" ${g.acao !== 'fim' ? 'selected' : ''}>Start</option><option value="fim" ${g.acao === 'fim' ? 'selected' : ''}>End</option></select>`) + (g.acao === 'fim' ? '' : campo('Name', `<input data-k="nome" value="${esc(g.nome || '')}">`) + campo('Chance (%)', `<input type="number" min="0" max="100" data-k="chance" value="${g.chance ?? 25}">`) + `<p class="ajuda">${(g.cacadores || []).length} hunter group(s).</p>`); break;
    case 'highlight': html = campo('Mode', `<select data-k="modo"><option value="object" ${g.modo !== 'space' ? 'selected' : ''}>Outline an object</option><option value="space" ${g.modo === 'space' ? 'selected' : ''}>Highlight a space</option></select>`) + `<p>Target: <b>${g.objIndex !== undefined ? esc(rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {})) : g.cell ? 'space ' + g.cell.join(',') : 'none yet'}</b> <button class="sm" id="g_alvo">Click the ${g.modo === 'space' ? 'space' : 'object'}</button></p>`; break;
    case 'choice': html = campo('Question', `<textarea data-k="text" rows="2">${esc(g.text || '')}</textarea>`) + '<div id="g_ops"></div><button class="sm" id="g_op">+ Answer</button>' +
      `<label class="chk"><input type="checkbox" data-k="umaVez" ${g.umaVez ? 'checked' : ''}> Each answer only once (a search: the answer chosen greys out, the others stay)</label>` +
      (g.umaVez ? campo('When every answer was used', `<input data-k="vazio" value="${esc(g.vazio || '')}" placeholder="Nothing more to do here.">`) + '<p class="ajuda">The object needs one use per answer: “Can be used” is set to the number of answers.</p>' : ''); break;
    case 'cutscene': html = '<div id="g_video"></div>' + (g.name && !g.video ? `<p class="ajuda">This trigger still plays a game cutscene (${esc(CUTSCENES.find(c => c.id === g.name)?.label || g.name)}); add a video to replace it.</p>` : ''); break;
    case 'sound': { const proprio = g.somModo === 'arquivo'; const sfx = Object.keys(SONS).filter(b => /^SFX_/i.test(b)).sort(); const atual = g.name || 'Place_Generic'; const ehSfx = sfx.some(b => SONS[b].includes(atual));
      html = campo('Sound', `<select data-k="somModo"><option value="jogo" ${!proprio ? 'selected' : ''}>A sound effect of the game</option><option value="arquivo" ${proprio ? 'selected' : ''}>My own sound file</option></select>`) +
        (proprio ? '<div id="g_som"></div>'
          : campo('Effect', `<select data-k="name">${ehSfx ? '' : `<option value="${esc(atual)}" selected>${esc(atual)} (not a sound effect: pick one)</option>`}${sfx.map(b => `<optgroup label="${esc(b.replace(/^SFX_/, ''))}">${SONS[b].map(e => `<option value="${esc(e)}" ${atual === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</optgroup>`).join('')}</select>`) + '<p class="ajuda">Only the game’s sound effects (music and voices stay with the game). Listen to them in the game: F7 → sounds.</p>'); break; }
    case 'reserve': html = campo('Action', `<select data-k="acao"><option value="add" ${g.acao !== 'remove' ? 'selected' : ''}>Add to the pool</option><option value="remove" ${g.acao === 'remove' ? 'selected' : ''}>Remove from the pool</option></select>`) + campo('Monster', `<select data-k="enemy"><option value="">— pick —</option>${MONSTROS().map(m => `<option value="${m.id}" ${g.enemy === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>`); break;
    case 'item_pool': html = campo('Action', `<select data-k="acao"><option value="add" ${g.acao !== 'remove' ? 'selected' : ''}>Add to the item pool</option><option value="remove" ${g.acao === 'remove' ? 'selected' : ''}>Remove from the item pool</option></select>`) + escolhaDeItem(g.item)
      + `<p class="ajuda">The item pool (Map setup) is what “Give an item” draws from: a random item, or random materials worth N loot points. From now on, for the rest of the map, it ${g.acao === 'remove' ? 'no longer holds' : 'also holds'} this item.</p>`; break;
    case 'objective': html = campo('Objective text', `<input data-k="text" value="${esc(g.text || '')}" placeholder="As shown in the game">`); break;
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-k]').forEach(inp => {
    const k = inp.dataset.k;
    const h = () => {
      if (g.tipo === 'counter' && k === 'acao') { if (!g.texto || Object.values(TEXTO_CONTADOR).includes(g.texto)) g.texto = TEXTO_CONTADOR[inp.value] || ''; if (inp.value === 'use' && !(+g.n >= 1)) g.n = 1; }
      if (g.tipo === 'open_room' && k === 'sala') { g.sala = +inp.value; limparAbridores(); tudo(); return; }
      if (g.tipo === 'give_item' && k === 'modo' && (inp.value === 'random' || inp.value === 'newitem')) { const falta = poolSemO(inp.value === 'random'); if (falta) aviso(falta); }
      if (k === 'intensidade') { const n = +inp.value; g.intensidade = n === (g.cells || []).length ? 0 : n; renderPropriedades(); return; }
      if (inp.type === 'checkbox') g[k] = inp.checked; else if (inp.type === 'number') g[k] = +inp.value || 0; else if (k === 'sala' || k === 'salaAlvo') g[k] = inp.value === '' ? undefined : +inp.value; else g[k] = inp.value;
      if (k === 'alvo' && g.alvo === 'group' && !g.grupo) g.grupo = gruposDaMissao()[0]?.id;   // the list shows the first group as chosen
      // a search: one use of the object per answer
      // a test whose successes add up: the object can be tried again until it is done
      if (g.tipo === 'skill_test' && k === 'cumulativo') { const dono = donoDe(s, oi); if (dono && !dono.enemy && g.cumulativo && !dono.usos) { dono.usos = 'always'; aviso('“' + rotulo(dono) + '” can now be used every time (change it in “Can be used”).'); } renderPropriedades(); return; }
      if (g.tipo === 'choice' && k === 'umaVez') { const dono = donosDaSala(s).map(x => x.o).find(x => !x.enemy && todosGatilhos(x).includes(g)); const n = String((g.options || []).filter(x => x.text).length || 3);
        if (dono && g.umaVez && dono.usos !== 'always') { dono.usos = n; aviso('“' + rotulo(dono) + '” can now be used ' + n + ' times, one per answer.'); } renderPropriedades(); return; }
      if (['modo', 'alvo', 'acao', 'como', 'secret', 'fonte', 'desde'].includes(k) || (g.tipo === 'counter' && g.acao === 'use' && k === 'n') || (inp.tagName === 'SELECT' && !inp.dataset.semRender)) renderPropriedades(); else renderGatilhosSoResumo(); renderConferencia();
    };
    if (inp.tagName === 'TEXTAREA' || (inp.tagName === 'INPUT' && inp.type !== 'checkbox' && inp.type !== 'number')) inp.oninput = h; else inp.onchange = h;
  });
  el.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { salaAtual = +b.dataset.ir; sel = null; tudo(); });
  if (g.tipo === 'cutscene') campoVideo(el.querySelector('#g_video'), g, () => { renderGatilhosSoResumo(); renderConferencia(); });
  if (g.tipo === 'counter') {
    const tx = el.querySelector('[data-cont-tx]'), pv = el.querySelector('[data-prev-cont]'); const pinta = () => { if (pv) pv.innerHTML = previaContador(g); };
    if (tx) { tx.addEventListener('input', pinta); el.querySelector('[data-k="contador"]')?.addEventListener('input', pinta); el.querySelector('[data-k="n"]')?.addEventListener('change', pinta); }
    el.querySelectorAll('[data-ins-cont]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { const i = tx.selectionStart ?? tx.value.length, j = tx.selectionEnd ?? i; tx.value = tx.value.slice(0, i) + b.dataset.insCont + tx.value.slice(j); tx.focus(); tx.selectionStart = tx.selectionEnd = i + b.dataset.insCont.length; tx.dispatchEvent(new Event('input', { bubbles: true })); }; });
  }
  el.querySelectorAll('[data-escolheitem]').forEach(b => b.onclick = () => abrirEscolhaDeItem(g.item, id => { g.item = id; renderPropriedades(); renderConferencia(); }));
  if (g.tipo === 'sound' && g.somModo === 'arquivo') campoSomProprio(el.querySelector('#g_som'), g);
  el.querySelectorAll('[data-poolitens]').forEach(b => b.onclick = () => abrirFichas('itens'));
  el.querySelectorAll('[data-oficina]').forEach(b => b.onclick = () => abrirFichas(b.dataset.oficina));
  el.querySelectorAll('[data-missao]').forEach(b => b.onclick = () => { if (campanha) trocarMissao(+b.dataset.missao); });
  el.querySelectorAll('[data-campanha]').forEach(b => b.onclick = () => abrirCampanha('fluxo'));
  if (g.tipo === 'spawn' && g.fonte === 'pool') {
    const pd = el.querySelector('.poolDoGatilho'); if (pd) widgetPoolDaSala(pd, si, () => renderPropriedades());
    el.querySelector('#g_por').onclick = () => pedirClique({ modo: 'space', g, si, texto: 'Click each space where a pool monster appears (Esc to stop).', repetir: true, cb: (x, y) => { if (salaNoNivel(x, y, nivel) < 0) return aviso('Put it on a tile at level ' + nivel + ' (the ribbon level).'), false; g.cells = g.cells || []; if (!g.cells.some(c => c[0] === x && c[1] === y)) g.cells.push(nivel > 0 ? [x, y, nivel] : [x, y]); return true; } });
    const lp = el.querySelector('#g_limpa'); if (lp) lp.onclick = () => { g.cells = []; renderPropriedades(); };
  } else if (g.tipo === 'spawn') {
    const sel1 = el.querySelector('[data-k="inimigoEscolhido"]');
    if (sel1) sel1.onchange = () => { g.inimigoEscolhido = sel1.value; if ((g.inimigos || []).length) { const e = g.inimigos[0]; e.enemy = sel1.value; e.tier = (monstro(sel1.value)?.tiers || [{ tier: 1 }])[0].tier; g.inimigos = [e]; } renderPropriedades(); renderGatilhosSoResumo(); tudo(); };
    const por = el.querySelector('#g_por');
    if (por) por.onclick = () => { const id = g.inimigoEscolhido || (g.inimigos || [])[0]?.enemy || MONSTROS()[0]?.id; if (!id) return aviso('Create or import a monster first.'); pedirClique({ modo: 'space', g, si, texto: 'Click the space where ' + nomeIni(id) + ' appears (Esc to cancel).', cb: (x, y) => {
      if (salaNoNivel(x, y, nivel) < 0) return aviso('Put the monster on a tile at level ' + nivel + ' (the ribbon level).'), false; g.inimigos = [{ enemy: id, pos: [x, y], tier: (monstro(id)?.tiers || [{ tier: 1 }])[0].tier, level: nivel }]; return true; } }); };
  }
  if (g.tipo === 'move_heroes') { const lp = el.querySelector('#g_limpa'); if (lp) lp.onclick = () => { g.cells = []; delete g.cell; renderPropriedades(); desenhar(); }; }
  const bc = el.querySelector('#g_cena'); if (bc) bc.onclick = () => abrirCenaDoGatilho(g, () => tudo());
  const alvo = el.querySelector('#g_alvo'); if (alvo) alvo.onclick = () => {
    if (g.tipo === 'move_heroes') pedirClique({ modo: 'space', g, si, repetir: true, texto: 'Click each space where a hero appears (Esc to stop).', cb: (x, y) => { g.cells = g.cells || []; delete g.cell; if (!g.cells.some(c => c[0] === x && c[1] === y)) g.cells.push([x, y]); return true; } });
    else if (g.tipo === 'add_object') pedirClique({ modo: 'space', g, si, texto: 'Click where the new ' + nomeObj(g.objType || 'Chest') + ' appears.', cb: (x, y) => {
      const sd = salaNoNivel(x, y, nivel); if (sd < 0) return aviso('Put the object on a tile at level ' + nivel + ' (the ribbon level).'), false; const alvoS = projeto.salas[sd];
      if (g.objIndex !== undefined && projeto.salas[g.objSala]?.objetos[g.objIndex]) { const ob = projeto.salas[g.objSala].objetos[g.objIndex]; if (g.objSala === sd) { ob.pos = [x, y]; ob.level = nivel; return true; } removerObjeto(g.objSala, g.objIndex, true, true); }
      alvoS.objetos.push({ type: g.objType || 'Chest', pos: [x, y], rot: 0, level: nivel, name: '', textClick: '', textUse: '', hidden: true, gatilhos: ehTipo({ type: g.objType || 'Chest' }, 'SightToken') ? [autoRemocao()] : [], requisitos: [], senao: [] }); g.objSala = sd; g.objIndex = alvoS.objetos.length - 1; return true; } });
    else if (g.tipo === 'remove_enemy') pedirClique({ modo: 'object', g, si, texto: 'Click the monster to remove.', cb: (x, y, q) => { if (!q || q.tipo !== 'inimigo') return aviso('Click a monster.'), false; g.inimigo = { sala: q.sala, tipo: q.g !== undefined ? 'gat' : 'sala', i: q.i, obj: q.obj, g: q.g, l: q.l }; return true; } });
    else if (g.tipo === 'remove_object' || g.tipo === 'mission') pedirClique({ modo: 'object', g, si, texto: g.tipo === 'mission' ? 'Click the object that completes the objective.' : 'Click the object to remove.', cb: (x, y, q) => { if (!q || q.tipo !== 'objeto') return aviso('Click an object.'), false; g.objSala = q.sala; g.objIndex = q.i; delete g.proprio; return true; } });
    else if (g.tipo === 'add_tile') pedirClique({ modo: 'object', g, si, texto: 'Click the tile that appears (any room).', cb: (x, y, q) => { const c = candidatosEm(x, y, true).find(z => z.tipo === 'peca'); if (!c) return aviso('Click a tile.'), false; if (c.sala === 0 && projeto.salas[0].pecas.length === 1) return aviso('That is the only tile of the starting room.'), false; g.sala = c.sala; g.peca = c.i; return true; } });
    else if (g.tipo === 'remove_tile') pedirClique({ modo: 'object', g, si, texto: 'Click the tile to remove (any room).', cb: (x, y, q) => { const c = candidatosEm(x, y, true).find(z => z.tipo === 'peca'); if (!c) return aviso('Click a tile.'), false; g.sala = c.sala; g.peca = c.i; return true; } });
    else if (g.tipo === 'highlight') { if (g.modo === 'space') pedirClique({ modo: 'space', g, si, texto: 'Click the space to highlight.', cb: (x, y) => { g.cell = [x, y]; delete g.objIndex; return true; } }); else pedirClique({ modo: 'object', g, si, texto: 'Click the object to outline.', cb: (x, y, q) => { if (!q || q.tipo !== 'objeto') return aviso('Click an object.'), false; g.objSala = q.sala; g.objIndex = q.i; delete g.cell; return true; } }); }
  };
  if (g.tipo === 'choice') {
    const ops = el.querySelector('#g_ops'); g.options = g.options || [];
    const pinta = () => { ops.innerHTML = ''; g.options.forEach((op, i) => { const d = document.createElement('div'); d.className = 'opcao';
      const lista = 'op' + i + ':' + g.uid;
      d.innerHTML = `<div class="linha"><input data-op="text" value="${esc(op.text || '')}" placeholder="Answer ${i + 1}"><button class="sm" data-rm="${i}">✕</button></div><textarea data-op="response" rows="2" placeholder="Text shown after this answer (optional)">${esc(op.response || '')}</textarea>
        <div class="resultado op"><div class="sub">Then <button class="sm" data-resop="${i}">+ Add</button> ${chipExtra(donoDe(s, oi), lista)}</div><div data-lresop="${i}"></div></div>`;
      ligarExtras(d, donoDe(s, oi));
      d.querySelectorAll('[data-op]').forEach(inp => inp.oninput = () => { op[inp.dataset.op] = inp.value; renderGatilhosSoResumo(); renderConferencia(); });
      renderGatilhos(d.querySelector('[data-lresop]'), s, oi, lista);
      d.querySelector('[data-resop]').onclick = () => abrirCatalogo(s, oi, lista);
      d.querySelector('[data-rm]').onclick = () => { const dono = donoDe(s, oi); g.options.splice(i, 1);
        // the triggers of the answers after it move up one place with them
        for (let k = i; k <= g.options.length; k++) { const de = 'op' + (k + 1) + ':' + g.uid, para = 'op' + k + ':' + g.uid; if (dono[de]) dono[para] = dono[de]; else delete dono[para]; delete dono[de]; }
        renderPropriedades(); }; ops.appendChild(d); }); };
    pinta(); el.querySelector('#g_op').onclick = () => { if (g.options.length >= 5) return aviso('At most 5 answers.'); g.options.push({ text: '', response: '' }); pinta(); };
  }
  if (g.tipo === 'skill_test' || g.tipo === 'rounds' || (g.tipo === 'counter' && g.acao === 'use') || (g.tipo === 'spawn' && g.fonte === 'pool')) {
    el.querySelectorAll('[data-lres]').forEach(d => renderGatilhos(d, s, oi, d.dataset.lres + ':' + g.uid));
    el.querySelectorAll('[data-res]').forEach(b => b.onclick = () => abrirCatalogo(s, oi, b.dataset.res + ':' + g.uid));
  }
}
function renderGatilhosSoResumo() { const dono = sel && (sel.tipo === 'contador' ? donoDe(null, 'C:' + sel.id) : sel.tipo === 'inimigo' ? listaDe(sel)?.[sel.i] : projeto.salas[sel.sala]?.objetos[sel.i]); const dono2 = dono && ehPool(dono.enemy) ? grupoPoolDe(projeto.salas[sel.sala]) : dono; if (dono2) ['o_gats', 'o_senaos', 'e_gats', 'c_gats', 'vp_gats'].forEach(id => { const el = $('#' + id); if (!el) return; const lista = id === 'o_senaos' ? 'senao' : 'gatilhos'; el.querySelectorAll(':scope > .gat').forEach((d, gi) => { const g = (dono2[lista] || [])[gi]; if (g) d.querySelector('.cab small').textContent = resumoGatilho(g); }); }); renderSalas(); }

// ------------------------------------------------------------ requirements
function renderRequisitos(el, s, oi, g) {
  const o = g; el.innerHTML = '';
  if (!(o.requisitos || []).length) return;
  o.requisitos.forEach((r, ri) => {
    const d = document.createElement('div'); d.className = 'gat req';
    let campos = '';
    if (r.tipo === 'item') campos = ITENS_B().length || r.item ? `<select data-k="item"><option value="">— pick —</option>${opcoesItens(r.item)}</select>` : `<p class="ajuda">The workshop has no items yet. <button class="sm" data-oficina="itens">Open the Workshop</button></p>`;
    else if (r.tipo === 'mission') { const ms = missoesInternas(); campos = ms.length ? `<select data-k="uid">${ms.map(x => `<option value="${x.uid}" ${r.uid === x.uid ? 'selected' : ''}>${esc(x.nome)}${ondeMissao(x)}</option>`).join('')}</select>` : '<span class="ajuda">no “Add an objective” trigger exists yet</span>'; if (ms.length && r.uid === undefined) r.uid = ms[0].uid; }
    else if (r.tipo === 'room_open' || r.tipo === 'enemies_defeated') campos = `<select data-k="sala">${projeto.salas.map((x, i) => `<option value="${i}" ${r.sala === i ? 'selected' : ''}>${i + 1} · ${esc(x.nome)}</option>`).join('')}</select>`;
    else if (r.tipo === 'counter') campos = `<input data-k="contador" list="dl_contadores" value="${esc(r.contador || '')}" placeholder="Keys" style="width:140px"> reaches <input data-k="meta" type="number" min="1" value="${r.meta || 3}" style="width:64px">${listaContadores()}`;
    else if (r.tipo === 'choice') { const es = escolhasDaCampanha(); const v = r.nome ? (r.sim === false ? 'nao:' : 'sim:') + r.nome : ''; const nomes = !r.nome || es.includes(r.nome) ? es : [...es, r.nome];
      campos = nomes.length ? `<select data-escolha><option value="">— pick —</option>${nomes.map(n => `<option value="sim:${esc(n)}" ${v === 'sim:' + n ? 'selected' : ''}>The party chose “${esc(n)}”</option><option value="nao:${esc(n)}" ${v === 'nao:' + n ? 'selected' : ''}>The party did not choose “${esc(n)}”</option>`).join('')}</select>` : `<span class="ajuda">${campanha ? 'No remembered choice yet: in a question box of a scene, tick “Remember this answer”.' : 'Only in a campaign: start one (top bar) and remember answers in its scenes.'}</span>`; }
    else if (r.tipo === 'gold') campos = `at least <input data-k="amount" type="number" min="1" value="${r.amount || 30}" style="width:70px"> gold`;
    else if (r.tipo === 'object_used') campos = `<b>${projeto.salas[r.sala]?.objetos[r.objeto] ? esc(rotulo(projeto.salas[r.sala].objetos[r.objeto])) : 'none yet'}</b> <button class="sm" data-clique>Click the object</button>`;
    d.innerHTML = `<div class="cab"><b>${esc(TIPOS_REQUISITO.find(t => t.id === r.tipo)?.nome || r.tipo)}</b><button class="sm" data-x title="Remove">✕</button></div><div class="corpo">${campos}</div>`;
    d.querySelector('[data-x]').onclick = () => { o.requisitos.splice(ri, 1); if (!o.requisitos.length) { const dono = donoDe(s, oi); if (dono && !(dono['senao:' + g.uid] || []).length) delete dono['senao:' + g.uid]; } tudo(); };
    d.querySelectorAll('[data-k]').forEach(inp => inp.onchange = () => { r[inp.dataset.k] = inp.dataset.k === 'sala' || inp.type === 'number' ? +inp.value : inp.value.trim(); renderConferencia(); });
    const ec = d.querySelector('[data-escolha]'); if (ec) ec.onchange = () => { if (!ec.value) delete r.nome; else { r.nome = ec.value.slice(4); r.sim = ec.value.startsWith('sim:'); } renderConferencia(); };
    const of = d.querySelector('[data-oficina]'); if (of) of.onclick = () => abrirFichas(of.dataset.oficina);
    const cl = d.querySelector('[data-clique]'); if (cl) cl.onclick = () => pedirClique({ modo: 'object', g, si: sel.sala, texto: 'Click the object that must be used first.', cb: (x, y, q) => { if (!q || q.tipo !== 'objeto') return aviso('Click an object.'), false; r.sala = q.sala; r.objeto = q.i; return true; } });
    el.appendChild(d);
  });
}
function abrirRequisitos(s, oi, g) {
  const o = g; const dono = donoDe(s, oi);
  escolherOpcao('Requirement for “' + (GATILHO[g.tipo]?.nome || g.tipo) + '” of “' + rotulo(dono) + '”', TIPOS_REQUISITO.map(t => ({ id: t.id, titulo: t.nome, sub: t.expl })), id => {
    const r = { tipo: id }; if (id === 'room_open' || id === 'enemies_defeated') r.sala = 0; if (id === 'counter') { r.contador = contadoresDoMapa()[0] || tr('Keys'); r.meta = 3; } if (id === 'gold') r.amount = 30;
    o.requisitos = o.requisitos || []; o.requisitos.push(r); gatAberto = chaveDe(dono, 'gatilhos', (dono.gatilhos || []).indexOf(g)); tudo();
  }, 'This trigger runs only when every requirement holds; the other triggers of “' + rotulo(dono) + '” are not held back. When one fails, the “If it fails” triggers of this box run instead.');
}

// ------------------------------------------------------------ trigger catalog
function abrirCatalogo(s, oi, lista) {
  const o = donoDe(s, oi); if (!o) return;
  const resultado = lista.includes(':') ? (lista.startsWith('ok:') ? 'If the test succeeds: ' : lista.startsWith('fail:') ? 'If the test fails: ' : lista.startsWith('senao:') ? 'If the requirement fails: ' : lista.startsWith('grupo:') ? 'When the group is defeated: ' : lista.startsWith('rodada:') ? 'When the rounds come: ' : lista.startsWith('conta:') ? 'When the count is reached: ' : 'After answer ' + (+lista.slice(2, lista.indexOf(':')) + 1) + ': ') : '';
  let tipos = resultado ? TIPOS_GATILHO.filter(t => (SO_CONSEQUENCIA.has(t.id) || ['open_room', 'remove_room', 'remove_tile', 'add_tile', 'reserve', 'item_pool'].includes(t.id)) && !['skill_test', 'choice'].includes(t.id) && !(/^(rodada|conta):/.test(lista) && t.id === 'rounds'))
 : lista === 'senao' ? TIPOS_GATILHO.filter(t => SO_CONSEQUENCIA.has(t.id)) : TIPOS_GATILHO;
  if (o.enemy) tipos = tipos.filter(t => !SO_OBJETO.has(t.id));
  if (o.ehContador) tipos = tipos.filter(t => CONSEQ_CONTADOR.has(t.id));
  tipos = tipos.filter(t => !t.oculto);
  // (a step of the tutorial may allow only the trigger it teaches)
  const soEstes = typeof Tutorial !== 'undefined' && Tutorial.ativo() ? Tutorial.gatilhos() : null; if (soEstes) tipos = tipos.filter(t => soEstes.includes(t.id));
  const ids = new Set(tipos.map(t => t.id)), opcoes = [], postos = new Set();
  tipos.forEach(t => {
    const gr = grupoDoGatilho(t.id);
    if (!gr) { opcoes.push({ id: t.id, titulo: t.nome, sub: explDe(t.id, o) }); return; }
    if (postos.has(gr.id)) return; postos.add(gr.id);
    const ms = membrosDoGrupo(gr).filter(([m]) => ids.has(m));
    opcoes.push(ms.length > 1 ? { id: gr.id, titulo: gr.nome, sub: gr.expl + ' (' + ms.map(([, r]) => r.split(' (')[0].toLowerCase()).join(', ') + ')' } : { id: ms[0][0], titulo: GATILHO[ms[0][0]].nome, sub: explDe(ms[0][0], o) });
  });
  const titulo = o.ehContador ? 'When “' + o.nome + '” reaches ' + metaDoContador(o) : (resultado || (lista === 'senao' ? 'When the requirement fails: ' : o.ehGrupo ? 'When the balanced group is defeated: ' : o.enemy ? 'When this monster is defeated: ' : 'Add a trigger to ')) + '“' + rotulo(o) + '”';
  const escolher = id => adicionarGatilho(s, oi, id, id === 'mission' ? 'internal' : undefined, lista);
  escolherOpcao(titulo, opcoes, id => {
    const gr = GRUPOS_GATILHO.find(x => x.id === id); if (!gr) return escolher(id);
    const membros = (r, tit) => escolherOpcao(r.pergunta + ' · ' + tit, r.membros.filter(([m]) => ids.has(m)).map(([m, rt]) => ({ id: m, titulo: rt, sub: explDe(m, o) })), escolher);
    if (!gr.ramos) return membros(gr, titulo);
    const ramos = gr.ramos.filter(r => r.membros.some(([m]) => ids.has(m)));
    if (ramos.length === 1) return membros(ramos[0], titulo);
    escolherOpcao(gr.pergunta + ' · ' + titulo, ramos.map(r => ({ id: r.id, titulo: r.nome, sub: r.expl + ' (' + r.membros.filter(([m]) => ids.has(m)).map(([, rt]) => rt.split(' (')[0].toLowerCase()).join(', ') + ')' })), rid => membros(ramos.find(r => r.id === rid), titulo));
  }, o.ehContador ? 'What happens once, when the count reaches ' + metaDoContador(o) + ' (the total of the counter). Several triggers run in order.' : lista === 'senao' ? 'Runs instead of the triggers when a requirement is not met.' : o.enemy ? 'What happens when this monster is defeated, after the game’s own effects (loot, objectives). Several triggers run in order, every time it is defeated.' : 'What happens when a hero uses this object. Several triggers run in order.');
}
function adicionarGatilho(s, oi, tipo, modo, lista) {
  const o = donoDe(s, oi); const si = sel.sala; lista = lista || 'gatilhos';
  const g = { uid: uid(), tipo };
  const gs = o[lista] || (o[lista] = []);
  if (tipo === 'open_room') {
    const outras = projeto.salas.map((r, ri) => ri > 0 && ri !== si ? ri : -1).filter(x => x >= 0);
    const criar = () => { gs.push(g); gatAberto = chaveDe(o, lista, gs.length - 1); const nova = novaSala({ sala: si, objeto: oi }); g.sala = nova; limparAbridores(); aviso('“' + rotulo(o) + '” opens room ' + (nova + 1) + '. Lay its tiles; they stay hidden until the object is used.'); };
    if (!outras.length) { criar(); return; }
    escolherOpcao('Which room does “' + rotulo(o) + '” open?', [...outras.map(ri => ({ id: ri, titulo: (ri + 1) + ' · ' + projeto.salas[ri].nome, sub: projeto.salas[ri].pecas.length + ' tiles · ' + (abridoresDe(ri).length ? 'also opened by ' + abridoresDe(ri).map(x => rotulo(x.o)).join(', ') : 'no opener yet') })), { id: -1, titulo: 'A new room', sub: 'Creates the next room; you then lay its tiles.', classe: 'destaque' }],
      ri => { if (ri < 0) { criar(); return; } gs.push(g); g.sala = ri; limparAbridores(); gatAberto = chaveDe(o, lista, gs.length - 1); tudo(); aviso('“' + rotulo(o) + '” now opens ' + projeto.salas[ri].nome + '.'); });
    return;
  }
  if (tipo === 'unlock_map') {
    gs.push(g); gatAberto = chaveDe(o, lista, gs.length - 1);
    const alvos = mapasParaLiberar();
    if (!alvos.length) { tudo(); return avisoLongo(campanha ? 'The campaign has no other map yet: add one in the story flow (Campaign screen), then pick it here.' : 'This map is not in a campaign yet: start one (top bar), add the other maps to the story flow, then pick one here.'); }
    escolherOpcao('Which map does “' + rotulo(o) + '” unlock?', alvos.map(n => ({ id: n.id, titulo: rotuloDoNo(n) + (nomeDoNo(n) !== rotuloDoNo(n) ? ' · ' + nomeDoNo(n) : ''), sub: 'Locked until this trigger runs' })), id => { g.no = id; tudo(); });
    tudo(); return;
  }
  if (tipo === 'mission') {
    g.modo = 'internal';
    g.text = ''; g.como = 'table';
  }
  if (tipo === 'spawn') { g.fonte = 'pool'; g.cells = []; g.inimigos = []; }
  if (tipo === 'rounds') { g.modo = 'cada'; g.n = 2; g.vezes = 0; }
  if (tipo === 'scene') { const c = novaCaixaCena(); g.caixas = [c]; g.inicio = c.id; }
  if (tipo === 'choice') g.options = [{ text: '', response: '' }, { text: '', response: '' }];
  if (tipo === 'sound') g.name = 'Place_Generic';
  if (tipo === 'counter') { g.acao = 'add'; g.n = 1; g.contador = contadoresDoMapa()[0] || tr('Keys'); g.texto = TEXTO_CONTADOR.add; }
  if (tipo === 'reserve' || tipo === 'item_pool') g.acao = 'add';
  if (tipo === 'move_heroes') { g.cells = []; if (!o.enemy && !o.ehContador && !o.usos && !ehTipo(o, 'Door') && !ehTipo(o, 'Gate')) { o.usos = 'always'; aviso('“' + rotulo(o) + '” can now be used every time (change it in “Can be used”).'); } }
  gs.push(g); gatAberto = chaveDe(o, lista, gs.length - 1); tudo();
  if (tipo === 'scene') abrirCenaDoGatilho(g, () => tudo());
}

// ------------------------------------------------------------ reusing a tile that is already in another room
/* a tile already on the table while room si is open, with no copy of it left in the boxes (two boxes: two of each) */
function pecaReutilizada(num, si) {
  let fora = new Set(); try { limparAbridores(); fora = removidosAntes(si).salas; } catch { }
  const usos = []; projeto.salas.forEach((s, ri) => { if (ri === si || fora.has(ri) || s._previa) return; s.pecas.forEach((q, pi) => { if (!ehAlfombra(q.tile) && numeroDaPeca(q.tile) === num) usos.push({ sala: ri, peca: pi }); }); });
  const nesta = (projeto.salas[si]?.pecas || []).filter(q => !ehAlfombra(q.tile) && numeroDaPeca(q.tile) === num).length;
  return usos.length && usos.length + nesta >= caixaDaPeca(num) ? usos[0] : null;
}
function avisarReuso(reuso, si, por) {
  // (in the tutorial, the first time: why a tile laid again asks this, then the window with its buttons explained)
  const tut = typeof Tutorial !== 'undefined' && Tutorial.ativo();
  if (tut && Tutorial.explicar('pecas-reuso', () => avisarReuso(reuso, si, por))) return;
  const nota = t => tut ? `<small class="tutNota">🎓 ${esc(tr(t))}</small>` : '';
  const abre = abridoresDe(si);
  const dona = projeto.salas[reuso.sala]; const p = dona.pecas[reuso.peca];
  if (!abre.length) { avisoLongo('Tile ' + nomePeca(p.tile) + ' is already in room ' + (reuso.sala + 1) + '. To reuse it here, this room needs an opener object first (an “Open a room” trigger): the removal of the earlier tile hangs on that object.'); return; }
  const alvo = abre[0].o;
  const fundo = modal('Tile ' + nomePeca(p.tile) + ' is already in room ' + (reuso.sala + 1), `<p class="ajuda">Each physical tile exists once. To use it here, the game must take it off the board when this room opens (the players cannot go back there). A trigger is added to “${esc(rotulo(alvo))}”, the object that opens this room.</p>
    <button class="op" data-o="tile"><b>Remove only that tile</b><small>“Remove a tile” trigger: tile ${nomePeca(p.tile)} of room ${reuso.sala + 1} and everything on it.</small></button>${nota('Remove only that tile: the earlier room stays on the table, without this tile. When a hero opens this room, the game takes the tile off the board (with whatever stands on it) and it can be laid here. Good when the party may still walk through the earlier room.')}
    <div class="op estatico"><b>Remove whole rooms</b><small>“Remove a room” trigger for each room ticked:</small><div id="ru_salas">${projeto.salas.map((s, i) => i !== si ? `<label class="chk"><input type="checkbox" data-s="${i}" ${i === reuso.sala ? 'checked' : ''}> ${i + 1} · ${esc(s.nome)}</label>` : '').join('')}</div><button class="sm" data-o="rooms">Remove the ticked rooms</button>${nota('Remove whole rooms: when a hero opens this room, the game clears each ticked room off the board, with its tiles, objects and monsters, and all their tiles go back to the box for the rooms ahead. Good when the party leaves those rooms behind for good.')}</div>
    ${nota('Cancel leaves everything as it was: pick another tile in the palette.')}<div class="rodape"><button data-o="cancel">Cancel</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="cancel"]').onclick = fechar;
    el.querySelector('[data-o="tile"]').onclick = () => { alvo.gatilhos.unshift({ uid: uid(), tipo: 'remove_tile', sala: reuso.sala, peca: reuso.peca }); fechar(); por(); aviso('Trigger added to “' + rotulo(alvo) + '”: removes tile ' + nomePeca(p.tile) + ' when this room opens.'); };
    el.querySelector('[data-o="rooms"]').onclick = () => { const salas = [...el.querySelectorAll('[data-s]:checked')].map(c => +c.dataset.s); if (!salas.length) return aviso('Tick at least one room.'); salas.forEach(ri => alvo.gatilhos.unshift({ uid: uid(), tipo: 'remove_room', sala: ri })); fechar(); por(); aviso('Trigger(s) added to “' + rotulo(alvo) + '”: removes room ' + salas.map(x => x + 1).join(', ') + ' when this room opens.'); };
  });
}
/* the box has a fixed number of each pillar: a room may not exceed it; across rooms, earlier rooms can be removed */
function excessoDePilares(tipo, si) {
  const caixa = caixaDoPilar(tipo); const nesta = contagemPilaresNaSala(si)[tipo]; const total = contagemPilares()[tipo];
  if (nesta + 1 > caixa) return 'This room already uses all ' + caixa + ' ' + SUPORTES[tipo].nome.toLowerCase() + 's of the boxes.';
  if (total + 1 > caixa) {
    const donas = [...new Set([...pilaresDoMapa().filter(x => x.q.type === tipo && x.si !== si).map(x => x.si), ...projeto.salas.map((s, ri) => ri !== si && (s.objetos || []).some(o => pilarDoObjeto(o) === tipo) ? ri : -1).filter(ri => ri >= 0)])];
    const abre = abridoresDe(si);
    if (!abre.length) return 'All ' + caixa + ' ' + SUPORTES[tipo].nome.toLowerCase() + 's are in use (room ' + donas.map(x => x + 1).join(', ') + '). This room needs an opener object before those rooms can be removed to free them.';
    const alvo = abre[0].o;
    modal('No ' + SUPORTES[tipo].nome.toLowerCase() + ' left in the boxes', `<p class="ajuda">All ${caixa} are used in room ${donas.map(x => x + 1).join(', ')}. Remove those rooms when this one opens (a “Remove a room” trigger on “${esc(rotulo(alvo))}”), so the pillars come back to the box?</p><div id="ru_salas">${donas.map(i => `<label class="chk"><input type="checkbox" data-s="${i}" checked> ${i + 1} · ${esc(projeto.salas[i].nome)}</label>`).join('')}</div><div class="rodape"><button data-o="cancel">Cancel</button><button class="primario" data-o="ok">Add the removal triggers</button></div>`, (el, fechar) => {
      el.querySelector('[data-o="cancel"]').onclick = fechar;
      el.querySelector('[data-o="ok"]').onclick = () => { const salas = [...el.querySelectorAll('[data-s]:checked')].map(c => +c.dataset.s); salas.forEach(ri => { if (!alvo.gatilhos.some(g => g.tipo === 'remove_room' && g.sala === ri)) alvo.gatilhos.unshift({ uid: uid(), tipo: 'remove_room', sala: ri }); }); fechar(); aviso('Removal trigger(s) added to “' + rotulo(alvo) + '”. Place the pillar again.'); tudo(); };
    });
    return 'wait';
  }
  return null;
}

// ------------------------------------------------------------ counters (keys found, levers pulled…): only in the app
/* every counter name used in the map (for the suggestions) */
function contadoresDoMapa() { const r = new Set((projeto.contadores || []).map(c => c.nome).filter(Boolean)); projeto.salas.forEach(s => { donosDaSala(s).concat(donosContadores()).forEach(({ o }) => { todosGatilhos(o).forEach(g => { if ((g.tipo === 'counter' || (g.tipo === 'mission' && g.como === 'counter')) && g.contador) r.add(g.contador); }); [o, ...todosGatilhos(o)].flatMap(x => x.requisitos || []).forEach(q => { if (q.tipo === 'counter' && q.contador) r.add(q.contador); }); }); }); return [...r].sort(); }
/* where a counter is used: what changes it (triggers) and what waits for it (missions, requirements) */
function usosDoContador(nome) {
  const r = [];
  const donos = projeto.salas.flatMap((s, si) => donosDaSala(s).map(d => ({ ...d, si }))).concat(donosContadores().map(d => ({ ...d, si: -1 })));
  donos.forEach(({ o, chave, si }) => {
    todosGatilhos(o).forEach(g => {
      if (g.tipo === 'counter' && g.contador === nome && g.acao === 'use') r.push({ si, chave, o, requer: true, q: { meta: Math.max(1, +g.n || 1) }, texto: 'at ' + Math.max(1, +g.n || 1) + ': its triggers' });
      else if (g.tipo === 'counter' && g.contador === nome) r.push({ si, chave, o, muda: true, g, texto: (g.acao === 'sub' ? '− ' : g.acao === 'set' ? '= ' : '+ ') + (g.n ?? 1) });
      if (g.tipo === 'mission' && g.como === 'counter' && g.contador === nome) r.push({ si, chave, o, espera: true, g, texto: 'objective at ' + (g.meta || 3) });
    });
    [o, ...todosGatilhos(o)].flatMap(x => x.requisitos || []).forEach(q => { if (q.tipo === 'counter' && q.contador === nome) r.push({ si, chave, o, requer: true, q, texto: 'requires ' + (q.meta || 3) }); });
  });
  return r;
}
function renomearContador(velho, novo) {
  projeto.salas.flatMap(s => donosDaSala(s)).concat(donosContadores()).forEach(({ o }) => { todosGatilhos(o).forEach(g => { if ((g.tipo === 'counter' || g.tipo === 'mission') && g.contador === velho) g.contador = novo; }); [o, ...todosGatilhos(o)].flatMap(x => x.requisitos || []).forEach(q => { if (q.tipo === 'counter' && q.contador === velho) q.contador = novo; }); });
  const c = (projeto.contadores || []).find(x => x.nome === velho); if (c) c.nome = novo;
}
function irParaDono(si, chave) {
  const s = projeto.salas[si]; if (!s) return; salaAtual = si; ferramenta = null; gatAberto = -1;
  if (typeof chave === 'number') sel = { tipo: 'objeto', sala: si, i: chave };
  else if (String(chave).startsWith('G:')) { const i = (s.inimigos || []).findIndex(e => ehPool(e.enemy)); sel = i >= 0 ? { tipo: 'inimigo', sala: si, i } : null; }
  else { const x = inimigosDaSala(s).find(({ e }) => 'E:' + e.uid === chave); sel = x ? selDoInimigo(si, x.origem) : null; }
  tudo();
}
/* consequences of a counter: what can happen when the count is complete (nothing tied to an object being used) */
const CONSEQ_CONTADOR = new Set(['end_map', 'escort', 'move_object', 'give_item', 'text', 'counter', 'mission', 'unlock_map', 'remove_room', 'remove_tile', 'add_tile', 'remove_enemy', 'remove_object', 'enemy_condition', 'move_heroes', 'add_object', 'highlight', 'cutscene', 'scene', 'sound', 'reserve', 'item_pool']);
const metaDoContador = c => Math.max(1, totalDoContador(c.nome));
const textoMissaoContador = c => c.conta === 'rodadas' ? 'Hold out for ' + metaDoContador(c) + ' rounds.' : c.conta === 'monstros' ? 'Defeat ' + metaDoContador(c) + ' monsters' + (c.monstro ? ' (' + nomeIni(c.monstro) + ')' : '') + '.' : 'Find the ' + metaDoContador(c) + ' ' + c.nome + '.';
/* a counter counts by the triggers (Add / subtract / use a count), or by itself: monsters defeated (any, or one kind) or rounds passed */
const CONTA_CONTADOR = { '': 'Triggers', monstros: 'Monsters defeated', rodadas: 'Rounds passed' };
const textoContaAuto = c => c.conta === 'monstros' ? '+1 per ' + (c.monstro ? nomeIni(c.monstro) : 'monster') + ' defeated' : c.conta === 'rodadas' ? '+1 per round passed' : '';
function novoContador(nome) { const c = { id: uid(), nome, inicio: 0, ehContador: true, gatilhos: [] }; projeto.contadores = projeto.contadores || []; projeto.contadores.push(c); return c; }
/* the map mission of a counter: listed with the objectives and completed when the count reaches its total */
function htmlMissaoContador(c) {
  const m = c.missao;
  return `<label class="chk"><input type="checkbox" data-cm="on" ${m ? 'checked' : ''}> An objective of the map: completed when the count reaches ${metaDoContador(c)}</label>` + (m ? `
    <label class="campo">Objective text <input data-cm="texto" value="${esc(m.texto || '')}" placeholder="${esc(textoMissaoContador(c))}"></label>
    <label class="campo">Listed <select data-cm="quando"><option value="start" ${m.quando !== 'first' ? 'selected' : ''}>From the start of the map</option><option value="first" ${m.quando === 'first' ? 'selected' : ''}>When the count first changes (announced then)</option></select></label>` : '');
}
function ligarMissaoContador(el, c, depois) {
  el.querySelectorAll('[data-cm]').forEach(inp => {
    const k = inp.dataset.cm;
    const h = () => { if (k === 'on') { c.missao = inp.checked ? { uid: 'cm' + uid(), texto: '', quando: 'start' } : undefined; depois(); return; } c.missao[k] = inp.value; if (k === 'quando') depois(); renderConferencia(); };
    if (inp.tagName === 'INPUT' && inp.type !== 'checkbox') inp.oninput = h; else inp.onchange = h;
  });
}
function abrirConsequencia(c, gi) {
  const si = Math.max(0, salaAtual); if (!projeto.salas[si]) return aviso('Create the starting room first.');
  salaAtual = si; ferramenta = null; sel = { tipo: 'contador', sala: si, id: c.id }; gatAberto = gi === undefined ? -1 : chaveDe(c, 'gatilhos', gi); tudo();
}
/* the counter in the side panel: its map mission and its consequence */
function fichaContador(el, s, c) {
  const chave = 'C:' + c.id;
  el.innerHTML = `<p class="ajuda">Starts at ${+c.inicio || 0}; total ${metaDoContador(c)}${c.conta ? '; ' + esc(textoContaAuto(c)) : ''}. <button class="sm" id="c_contas">Counts…</button></p>
    <div class="sub">Map objective</div><div id="c_missao">${htmlMissaoContador(c)}</div>
    <div class="sub">Consequence <button class="sm" id="c_add">+ Add</button></div>
    <p class="ajuda">What happens once, when the count reaches ${metaDoContador(c)}: open the way, give a reward, show a text…</p>
    <div id="c_gats"></div>`;
  ligarMissaoContador(el, c, () => renderPropriedades());
  $('#c_contas').onclick = abrirContadores;
  $('#c_add').onclick = () => abrirCatalogo(s, chave, 'gatilhos');
  renderGatilhos($('#c_gats'), s, chave, 'gatilhos');
}
/* the Counts button (ribbon): every counter of the map in one place */
function abrirContadores() {
  projeto.contadores = projeto.contadores || []; projeto.contadores.forEach(c => { c.id = c.id || uid(); c.ehContador = true; c.gatilhos = c.gatilhos || []; });
  contadoresDoMapa().forEach(n => { if (!projeto.contadores.some(c => c.nome === n)) novoContador(n); });
  projeto.contadores = projeto.contadores.filter(c => c.nome).sort((a, b) => a.nome.localeCompare(b.nome));
  const chip = u => `<button class="sm usoCont" data-si="${u.si}" data-ch="${esc(String(u.chave))}" title="${u.si >= 0 ? 'Room ' + (u.si + 1) + ' · ' + esc(projeto.salas[u.si].nome) + ': select it' : 'Open this counter'}">${esc(rotulo(u.o))} <small>${esc(u.texto)}</small></button>`;
  const linhas = projeto.contadores.map((c, i) => { const us = usosDoContador(c.nome); const muda = us.filter(u => u.muda), missoes = us.filter(u => u.espera), requer = us.filter(u => u.requer);
    return `<div class="contador" data-c="${i}"><div class="linha"><input data-cn="${i}" value="${esc(c.nome)}" title="Rename: every trigger and requirement that uses it follows"><label class="campo" style="margin:0">Starts at <input data-ci="${i}" type="number" min="0" value="${+c.inicio || 0}" style="width:64px"></label><label class="campo" style="margin:0" title="[total] in the messages, the objective and the consequence. Empty: what the “Add” triggers add up to">Total <input data-ct="${i}" type="number" min="0" value="${+c.total || ''}" placeholder="${totalAutomatico(c.nome) || ''}" style="width:64px"></label><button class="sm" data-cx="${i}" title="${us.length ? 'Used by ' + us.length + ' trigger(s) or requirement(s): they lose the counter' : 'Delete'}">✕</button></div>
      <div class="linha contaLinha"><label class="campo" style="margin:0;flex:0 0 auto" title="Triggers: only the “Add / subtract / use a count” triggers change it. Monsters defeated or rounds passed: it also adds 1 by itself">Counts <select data-cc2="${i}">${Object.entries(CONTA_CONTADOR).map(([k, t]) => `<option value="${k}" ${(c.conta || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${c.conta === 'monstros' ? `<select data-cmo="${i}" title="Which monsters count"><option value="">Any monster</option>${MONSTROS().map(m => `<option value="${m.id}" ${c.monstro === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}${c.monstro && !MONSTROS().some(m => m.id === c.monstro) ? `<option value="${esc(c.monstro)}" selected>? (no longer in the workshop)</option>` : ''}</select>` : ''}</div>
      <div class="usos"><span class="rotuloTx">Changed by</span> ${c.conta ? `<span class="ajuda contaAuto">${esc(textoContaAuto(c))}</span>` : ''}${muda.map(chip).join('') || (c.conta ? '' : '<span class="ajuda">nothing yet: give an object (or a monster) an “Add / subtract / use a count” trigger, or make it count monsters defeated or rounds passed</span>')}</div>
      <div class="usos"><span class="rotuloTx">Map objective</span> <div class="missaoCont" data-mc="${i}">${htmlMissaoContador(c)}</div>${missoes.map(chip).join('')}</div>
      ${requer.length ? `<div class="usos"><span class="rotuloTx">Required / used by</span> ${requer.map(chip).join('')}</div>` : ''}
      <div class="usos"><span class="rotuloTx">Consequence</span> ${(c.gatilhos || []).map((g, gi) => `<button class="sm consCont" data-cc="${i}" data-gi="${gi}" title="Open it">${esc(GATILHO[g.tipo]?.nome || g.tipo)} <small>${esc(resumoGatilho(g))}</small></button>`).join('')}<button class="sm primario" data-cadd="${i}" title="What happens once, when the count reaches ${metaDoContador(c)}">+ Trigger</button></div></div>`; }).join('');
  janelaFlutuante('janelaContadores', 'Counts of the map', `<p class="ajuda">Counters keep a number during the map: keys found, levers pulled, seals broken… They live only in the app (nothing goes to the inventory). Triggers add to them or take from them; when a count reaches its total, its map objective is completed and its consequence runs (once). A counter can also count by itself the monsters defeated or the rounds passed.</p>
    ${linhas || '<p class="ajuda">No counter yet.</p>'}
    <div class="linha" style="margin-top:10px"><input id="cn_novo" placeholder="New counter (Keys, Levers, Seals…)"><button class="sm primario" id="cn_mais">+ New counter</button></div>`, (el, fechar) => {
    const volta = () => { abrirContadores(); renderFaixa(); renderPropriedades(); };
    el.querySelectorAll('[data-cn]').forEach(inp => inp.onchange = () => { const c = projeto.contadores[+inp.dataset.cn]; const novo = inp.value.trim(); if (!novo) { inp.value = c.nome; return; } if (novo !== c.nome && projeto.contadores.some(x => x.nome === novo)) { aviso('There is already a counter called ' + novo + '.'); inp.value = c.nome; return; } renomearContador(c.nome, novo); volta(); });
    el.querySelectorAll('[data-cc2]').forEach(sl => sl.onchange = () => { const c = projeto.contadores[+sl.dataset.cc2]; if (sl.value) c.conta = sl.value; else delete c.conta; if (c.conta !== 'monstros') delete c.monstro; renderConferencia(); volta(); });
    el.querySelectorAll('[data-cmo]').forEach(sl => sl.onchange = () => { const c = projeto.contadores[+sl.dataset.cmo]; if (sl.value) c.monstro = sl.value; else delete c.monstro; renderConferencia(); volta(); });
    el.querySelectorAll('[data-ci]').forEach(inp => inp.oninput = () => { projeto.contadores[+inp.dataset.ci].inicio = Math.max(0, +inp.value || 0); });
    el.querySelectorAll('[data-ct]').forEach(inp => inp.oninput = () => { projeto.contadores[+inp.dataset.ct].total = Math.max(0, +inp.value || 0); renderPropriedades(); });
    el.querySelectorAll('[data-mc]').forEach(d => ligarMissaoContador(d, projeto.contadores[+d.dataset.mc], volta));
    el.querySelectorAll('[data-cx]').forEach(b => b.onclick = () => { const c = projeto.contadores[+b.dataset.cx]; const us = usosDoContador(c.nome);
      if ((us.length || (c.gatilhos || []).length || c.missao) && !confirm('Delete “' + c.nome + '”? ' + (us.length ? us.length + ' trigger(s) or requirement(s) lose the counter. ' : '') + ((c.gatilhos || []).length ? 'Its consequence (' + c.gatilhos.length + ' trigger(s)) goes too. ' : '') + (c.missao ? 'Its map objective goes too.' : ''))) return;
      if (sel && sel.tipo === 'contador' && sel.id === c.id) sel = null;
      renomearContador(c.nome, ''); projeto.contadores = projeto.contadores.filter(x => x !== c && x.nome); renderConferencia(); volta(); });
    el.querySelectorAll('.usoCont').forEach(b => b.onclick = () => { fechar(); const ch = b.dataset.ch; if (ch.startsWith('C:')) { const c = donoDe(null, ch); if (c) abrirConsequencia(c); return; } irParaDono(+b.dataset.si, /^\d+$/.test(ch) ? +ch : ch); });
    el.querySelectorAll('.consCont').forEach(b => b.onclick = () => { fechar(); abrirConsequencia(projeto.contadores[+b.dataset.cc], +b.dataset.gi); });
    el.querySelectorAll('[data-cadd]').forEach(b => b.onclick = () => { const c = projeto.contadores[+b.dataset.cadd]; if (!projeto.salas.length) return aviso('Create the starting room first.'); fechar(); abrirConsequencia(c); abrirCatalogo(projeto.salas[sel.sala], 'C:' + c.id, 'gatilhos'); });
    const novo = () => { const n = $('#cn_novo').value.trim(); if (!n) return aviso('Give the counter a name.'); if (projeto.contadores.some(x => x.nome === n)) return aviso('There is already a counter called ' + n + '.'); novoContador(n); volta(); };
    $('#cn_mais').onclick = novo; $('#cn_novo').onkeydown = e => { if (e.key === 'Enter') novo(); };
  }, true);
}
/* the message of a count: [count] (the counter's name, highlighted), [n] (the count now), [total] */
const TEXTO_CONTADOR = { add: tr('You found a [count] ([n] of [total]).'), sub: tr('You lost a [count] ([n] of [total]).'), set: tr('[count]: [n] of [total].') };   // default messages, in the editor's language
const VAGAS_CONTADOR = { count: 'the name of the counter, highlighted', n: 'the count after this trigger', total: 'the total of the counter (Counts button)' };
function totalDoContador(nome) {
  const c = (projeto.contadores || []).find(x => x.nome === nome); if (c && +c.total > 0) return +c.total;
  return totalAutomatico(nome);
}
/* without a total set: what the "add" triggers add up to (3 keys of +1 → 3), else the number a mission or requirement waits for */
function totalAutomatico(nome) {
  const us = usosDoContador(nome); const soma = us.filter(u => u.muda && (u.g.acao || 'add') === 'add').reduce((a, u) => a + (+u.g.n || 0), 0);
  return soma || Math.max(0, ...us.filter(u => u.espera || u.requer).map(u => +(u.g || u.q).meta || 0)) || 0;
}
function textoContadorParaJogo(g) {
  const v = varDoContador(g.contador);
  return (g.texto || '').replace(/\[count\]/gi, '<style=Term>' + (g.contador || '?') + '</style>').replace(/\[n\]|\{n\}/gi, '{#' + v + '}').replace(/\[total\]/gi, String(totalDoContador(g.contador)));
}
function previaContador(g) {
  if (!g.texto) return '<span class="ajuda">(no message)</span>';
  const chip = (t, dica) => `<span class="vagaTx" title="${esc(dica)}">${esc(t)}</span>`;
  return '<div class="rotuloTx">In the app:</div>' + esc(g.texto).replace(/\[count\]/gi, `<b class="termoTx">${esc(g.contador || '?')}</b>`).replace(/\[n\]|\{n\}/gi, chip('n', VAGAS_CONTADOR.n)).replace(/\[total\]/gi, chip(String(totalDoContador(g.contador)), VAGAS_CONTADOR.total));
}
const listaContadores = () => `<datalist id="dl_contadores">${contadoresDoMapa().map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
const varDoContador = nome => 'cont-' + slug(nome || 'counter');
function camposContador(g, uso) {
  const nome = `<label class="campo">Counter <input data-k="contador" list="dl_contadores" value="${esc(g.contador || '')}" placeholder="Keys"></label>${listaContadores()}`;
  if (uso === 'meta') return nome + `<label class="campo">Completed when it reaches <input data-k="meta" type="number" min="1" value="${g.meta || 3}" style="width:70px"></label><p class="ajuda">Give each object that counts (each key, each lever) an “Add / subtract / use a count” trigger with this counter. The mission ends by itself when the number is reached.</p>`;
  const acao = `<label class="campo">Action <select data-k="acao"><option value="add" ${!g.acao || g.acao === 'add' ? 'selected' : ''}>Add</option><option value="sub" ${g.acao === 'sub' ? 'selected' : ''}>Take away</option><option value="set" ${g.acao === 'set' ? 'selected' : ''}>Set to</option><option value="use" ${g.acao === 'use' ? 'selected' : ''}>Use: when it reaches</option></select></label>`;
  if (g.acao === 'use') { const n = Math.max(1, +g.n || 1);
    return nome + `<div class="duas">${acao}<label class="campo">Number <input data-k="n" type="number" min="1" value="${n}" style="width:70px"></label></div>
    <label class="campo">Watching from <select data-k="desde"><option value="inicio" ${g.desde !== 'uso' ? 'selected' : ''}>The start of the map</option><option value="uso" ${g.desde === 'uso' ? 'selected' : ''}>When this trigger runs</option></select></label>
    <p class="ajuda">${g.desde === 'uso' ? 'Armed when this trigger runs (the object used, the monster defeated…): the triggers below run once, as soon as the count is at ' + n + ' or more (at once, if it already is).' : 'From the start of the map: the triggers below run once, the moment the count reaches ' + n + '. The object does not need to be used.'}</p>
    <div class="resultado conta"><div class="sub">When the count reaches ${n} <button class="sm" data-res="conta">+ Add</button></div><div data-lres="conta"></div></div>`; }
  return nome + `<div class="duas">${acao}
    <label class="campo">Amount <input data-k="n" type="number" min="0" value="${g.n ?? 1}" style="width:70px"></label></div>
    <label class="campo">Message to the players (optional) <input data-k="texto" data-cont-tx value="${esc(g.texto || '')}" placeholder="${esc(TEXTO_CONTADOR[g.acao || 'add'])}"></label>
    <div class="barraTx"><span>Insert:</span>${Object.entries(VAGAS_CONTADOR).map(([k, x]) => `<button class="sm fichaTx" data-ins-cont="[${k}]" title="${esc(x)}">${k}</button>`).join('')}</div>
    <div class="previaTx" data-prev-cont>${previaContador(g)}</div>
    <p class="ajuda">[count] is the name of the counter (highlighted like the rule words of the game), [n] the count after this trigger, [total] the total of the counter (Counts button). Missions and requirements can wait for the counter to reach a number (“A counter reaches a number”).</p>`;
}

// ------------------------------------------------------------ picking an item: a window with the items by kind, with their pictures
function escolhaDeItem(atual) {
  const img = atual ? imagemDoItemEscolhido(atual) : '';
  return `<div class="itemEscolhido">${img ? `<img src="${img}" alt="">` : '<span class="vazio"></span>'}<div><b>${atual ? esc(semGlifo(nomeItem(atual))) : 'No item yet'}</b>${atual && !itemDaOficina(atual) ? '<small class="erro">not in the workshop!</small>' : ''}</div><button class="sm" data-escolheitem>${atual ? 'Change…' : 'Pick the item…'}</button></div>`;
}
function imagemDoItemEscolhido(id) {
  const w = ITENS_B().find(i => i.id === id); if (w) return retratoDoItem(w);
  const r = runaDoItem(id); if (r) return figurasDaArma(armaPorId(r.id))[0] || '';
  const rc = receitaDoItem(id); if (rc) return itemAlvo(rc.item)?.img || '';
  return '';
}
function abrirEscolhaDeItem(atual, escolher) {
  const grupos = [['Armor', ITENS_B().filter(i => i.cls === 'ArmorModel')], ['Consumables', ITENS_B().filter(i => i.cls === 'ConsumableModel')], ['Trinkets', ITENS_B().filter(i => i.cls === 'TrinketModel' || i.cls === 'TableItem')],
    ['Weapon parts', ITENS_B().filter(i => i.cls === 'WeaponPartsModel')], ['Materials', ITENS_B().filter(i => i.cls === 'CraftingMaterialModel')]].map(([n, xs]) => [n, xs.map(i => ({ id: i.id, nome: semGlifo(i.nome) + (/[\uE000-\uF8FF]/.test(i.nome || '') ? ' +' : ''), img: retratoDoItem(i), sub: i.cls === 'WeaponPartsModel' ? (i.classe || '') + ' · ' + (i.slot || '') : '' }))])
    .concat([['Runes of the workshop', (oficina().armas || []).filter(a => a.runa).map(a => ({ id: 'RUNA:' + a.id, nome: nomeItem('RUNA:' + a.id), img: imagemDoItemEscolhido('RUNA:' + a.id), sub: 'the weapon comes with it' }))],
      ['Recipes (the party learns them)', (oficina().receitas || []).map(r => ({ id: 'RECEITA:' + r.id, nome: nomeReceita(r), img: itemAlvo(r.item)?.img || '', sub: custoResumo(r) }))]]).filter(([, xs]) => xs.length);
  if (!grupos.length) return aviso('The workshop has no items yet: import or create them in the Items tab.');
  modal('Pick the item', `<input id="ei_filtro" placeholder="filter…"><div id="ei_grupos"></div>`, (el, fechar) => {
    const pinta = f => { el.querySelector('#ei_grupos').innerHTML = grupos.map(([n, xs]) => { const v = xs.filter(x => !f || x.nome.toLowerCase().includes(f)); return v.length ? `<div class="sub">${esc(n)} <small>(${v.length})</small></div><div class="grade escolhaItem">${v.map(x => `<div class="item ${x.id === atual ? 'marcado' : ''}" data-ei="${esc(x.id)}">${x.img ? `<img src="${x.img}" alt="">` : '<span class="vazio"></span>'}<div>${esc(x.nome)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</div></div>`).join('')}</div>` : ''; }).join('') || '<p class="ajuda">Nothing matches.</p>';
      el.querySelectorAll('[data-ei]').forEach(d => d.onclick = () => { fechar(); escolher(d.dataset.ei); }); };
    pinta(''); el.querySelector('#ei_filtro').oninput = e => pinta(e.target.value.toLowerCase());
  }, true);
}

// ------------------------------------------------------------ "Play a scene": the boxes of a scene written in the trigger
/* g.caixas: [{id, type:'normal'|'choice', speaker, title, text, cast[], background, next, options[{text, next}]}], g.inicio: the first box.
   The window works like the boxes of a story-flow scene: the boxes in reading order, joined by arrows, the chosen one on the right. */
const novaCaixaCena = () => ({ id: 'cx-' + uid().slice(-6), type: 'normal', speaker: '', title: '', text: '', cast: [], background: FUNDO_PADRAO, next: '', options: [] });
function ordemDaCena(g) {
  const cx = g.caixas || []; const porId = Object.fromEntries(cx.map(c => [c.id, c])); const r = [], vistos = new Set();
  const anda = id => { const c = porId[id]; if (!c || vistos.has(c.id)) return; vistos.add(c.id); r.push(c); if (c.type === 'choice') (c.options || []).forEach(o => anda(o.next)); else anda(c.next); };
  anda(g.inicio || cx[0]?.id); cx.forEach(c => { if (!vistos.has(c.id)) { vistos.add(c.id); r.push(c); } }); return r;
}
function abrirCenaDoGatilho(g, aoFechar) {
  g.caixas = g.caixas || []; if (!g.caixas.length) { const c = novaCaixaCena(); g.caixas.push(c); g.inicio = c.id; }
  let selId = g.inicio || g.caixas[0].id;
  const { fundo } = modal('Scene: the dialogue boxes', `<div class="cenaG"><div class="cenaEsq"><div class="linha botoes"><button class="sm" data-cn="box">+ Box after the chosen one</button><button class="sm" data-cn="choice">+ Question after it</button><button class="sm" data-cn="ler">▶ Read it</button></div><div class="cenaFluxo"></div></div><div class="cenaDir"></div></div>`, el => {
    const numDe = c => ordemDaCena(g).indexOf(c) + 1;
    const porId = id => g.caixas.find(c => c.id === id);
    const opcoesDestino = (atual, eu) => `<option value="">End of the scene</option>${ordemDaCena(g).filter(c => c !== eu).map(c => `<option value="${c.id}" ${atual === c.id ? 'selected' : ''}>Box ${numDe(c)}${c.speaker ? ' · ' + esc(nomePersonagem(c.speaker)) : ''}: ${esc((c.text || '').slice(0, 30))}</option>`).join('')}`;
    const fluxo = () => {
      const f = el.querySelector('.cenaFluxo'); const ordem = ordemDaCena(g);
      f.innerHTML = ordem.map((c, i) => { const rosto = c.speaker ? retratoDoPersonagem(PERSONAGENS_B().find(p => p.id === c.speaker)) : '';
        const seta = c.type === 'choice' ? (c.options || []).map((o, k) => `<div class="cenaOp">${esc(o.text || 'Answer ' + (k + 1))} → ${o.next && porId(o.next) ? 'Box ' + numDe(porId(o.next)) : 'end'}</div>`).join('') : `<div class="cenaSeg">${c.next && porId(c.next) ? '↓ Box ' + numDe(porId(c.next)) : '■ end of the scene'}</div>`;
        return `<div class="cenaCx ${c.id === selId ? 'ativo' : ''} ${c.type === 'choice' ? 'pergunta' : ''}" data-cx="${c.id}"><div class="cab">${rosto ? `<img src="${rosto}" alt="">` : '<span class="semRosto">✦</span>'}<b>Box ${i + 1}${c.id === (g.inicio || ordem[0]?.id) ? ' (first)' : ''}</b><small>${esc(c.speaker ? nomePersonagem(c.speaker) : 'Narrator')}${c.title ? ' · ' + esc(c.title) : ''}</small></div><p>${esc((c.text || '(no text yet)').slice(0, 140))}</p>${seta}</div>`; }).join('');
      f.querySelectorAll('[data-cx]').forEach(d => d.onclick = () => { selId = d.dataset.cx; pinta(); });
    };
    const props = () => {
      const d = porId(selId); const p = el.querySelector('.cenaDir'); if (!d) { p.innerHTML = ''; return; }
      p.innerHTML = `<label class="campo">Kind <select data-k="type"><option value="normal" ${d.type !== 'choice' ? 'selected' : ''}>Plain box</option><option value="choice" ${d.type === 'choice' ? 'selected' : ''}>Question (the players choose an answer)</option></select></label>
        <label class="campo">Speaker <select data-k="speaker"><option value="">Narrator (no portrait)</option>${HEROIS_SORTEADOS.map(x => `<option value="${x.id}" ${d.speaker === x.id ? 'selected' : ''}>${esc(tr(x.nome))}</option>`).join('')}${PERSONAGENS_B().map(x => `<option value="${esc(x.id)}" ${d.speaker === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>${PERSONAGENS_B().length ? '' : '<small class="ajuda">No NPCs yet: import or create them in the NPCs tab of the Workshop.</small>'}</label>
        <label class="campo">Title (optional) <input data-k="title" value="${esc(d.title || '')}"></label>
        <label class="campo">Text <textarea data-k="text" rows="5">${esc(d.text || '')}</textarea></label>
        <label class="campo">Others in the scene <select data-cast><option value="">+ add…</option>${HEROIS_SORTEADOS.filter(x => x.id !== d.speaker && !(d.cast || []).includes(x.id)).map(x => `<option value="${x.id}">${esc(tr(x.nome))}</option>`).join('')}${PERSONAGENS_B().filter(x => x.id !== d.speaker && !(d.cast || []).includes(x.id)).map(x => `<option value="${esc(x.id)}">${esc(x.nome)}</option>`).join('')}</select></label>
        <div>${(d.cast || []).map(id => `<span class="tag">${esc(nomePersonagem(id))} <a href="#" data-delcast="${esc(id)}">✕</a></span>`).join('')}</div>
        <label class="campo">Background <select data-k="background">${FUNDOS.map(f => `<option value="${f.id}" ${(d.background ?? FUNDO_PADRAO) === f.id ? 'selected' : ''}>${esc(f.name_en)}</option>`).join('')}</select></label>
        ${d.type === 'choice' ? `<div class="sub">Answers <button class="sm" data-addop>+ Answer</button></div>${(d.options || []).map((o, k) => `<div class="cartao"><div class="linha"><input data-op="${k}" value="${esc(o.text || '')}" placeholder="Answer ${k + 1}"><button class="sm" data-rmop="${k}">✕</button></div><label class="campo">Then <select data-opnext="${k}">${opcoesDestino(o.next, d)}</select></label></div>`).join('')}`
          : `<label class="campo">Then <select data-k="next">${opcoesDestino(d.next, d)}</select></label>`}
        <div class="linha acoes">${d.id !== g.inicio ? '<button class="sm" data-primeira>Make it the first box</button>' : ''}<button class="sm perigo" data-apaga>Delete this box</button></div>`;
      p.querySelectorAll('[data-k]').forEach(inp => { const k = inp.dataset.k; const ev = inp.tagName === 'SELECT' ? 'onchange' : 'oninput'; inp[ev] = () => {
        if (k === 'background') d.background = +inp.value; else d[k] = inp.value;
        if (k === 'type') { if (d.type === 'choice' && !(d.options || []).length) d.options = [{ text: '', next: d.next || '' }, { text: '', next: '' }]; if (d.type !== 'choice' && (d.options || []).length) d.next = d.next || d.options.find(o => o.next)?.next || ''; pinta(); }
        else if (k === 'speaker') { d.cast = (d.cast || []).filter(c => c !== d.speaker); pinta(); } else fluxo(); }; });
      const ca = p.querySelector('[data-cast]'); if (ca) ca.onchange = () => { if (ca.value) (d.cast = d.cast || []).push(ca.value); pinta(); };
      p.querySelectorAll('[data-delcast]').forEach(a => a.onclick = e => { e.preventDefault(); d.cast = d.cast.filter(c => c !== a.dataset.delcast); pinta(); });
      p.querySelectorAll('[data-op]').forEach(inp => inp.oninput = () => { d.options[+inp.dataset.op].text = inp.value; fluxo(); });
      p.querySelectorAll('[data-opnext]').forEach(s => s.onchange = () => { d.options[+s.dataset.opnext].next = s.value; pinta(); });
      p.querySelectorAll('[data-rmop]').forEach(b => b.onclick = () => { if (d.options.length <= 1) return aviso('A question keeps at least one answer.'); d.options.splice(+b.dataset.rmop, 1); pinta(); });
      const ad = p.querySelector('[data-addop]'); if (ad) ad.onclick = () => { if (d.options.length >= 5) return aviso('At most 5 answers.'); d.options.push({ text: '', next: '' }); pinta(); };
      const pr = p.querySelector('[data-primeira]'); if (pr) pr.onclick = () => { g.inicio = d.id; pinta(); };
      p.querySelector('[data-apaga]').onclick = () => {
        if (g.caixas.length <= 1) return aviso('A scene keeps at least one box.');
        const seguinte = d.type === 'choice' ? '' : d.next;
        g.caixas = g.caixas.filter(c => c !== d);
        g.caixas.forEach(c => { if (c.next === d.id) c.next = seguinte; (c.options || []).forEach(o => { if (o.next === d.id) o.next = seguinte; }); });
        if (g.inicio === d.id) g.inicio = seguinte || g.caixas[0].id;
        selId = g.inicio; pinta(); };
    };
    const pinta = () => { fluxo(); props(); };
    const nova = tipo => {
      const d = porId(selId); const c = novaCaixaCena(); if (tipo === 'choice') { c.type = 'choice'; c.options = [{ text: '', next: '' }, { text: '', next: '' }]; }
      if (d) { c.speaker = d.speaker; c.background = d.background; c.cast = (d.cast || []).slice();
        if (d.type === 'choice') { const livre = d.options.find(o => !o.next); if (livre) livre.next = c.id; } else { if (tipo === 'choice') c.options[0].next = d.next || ''; else c.next = d.next || ''; d.next = c.id; } }
      g.caixas.push(c); selId = c.id; pinta(); const t = el.querySelector('[data-k="text"]'); if (t) t.focus();
    };
    el.querySelector('[data-cn="box"]').onclick = () => nova('normal');
    el.querySelector('[data-cn="choice"]').onclick = () => nova('choice');
    el.querySelector('[data-cn="ler"]').onclick = () => lerCena(g);
    pinta();
  }, true);
  const fechar = fundo.querySelector('.fechar'); const antes = fechar.onclick; fechar.onclick = () => { antes && antes(); aoFechar && aoFechar(); };
  fundo.addEventListener('click', e => { if (e.target === fundo) aoFechar && aoFechar(); });
}
/* ▶ Read it: the boxes one after the other, as the players will see them (answers pick the way) */
function lerCena(g) {
  const porId = id => (g.caixas || []).find(c => c.id === id); let d = porId(g.inicio) || g.caixas[0]; let n = 0;
  const passo = () => {
    if (!d || n++ > 40) return aviso('End of the scene.');
    const quem = d.speaker ? nomePersonagem(d.speaker) : 'Narrator';
    if (d.type === 'choice') escolherOpcao(quem + (d.title ? ' · ' + d.title : ''), (d.options || []).map((o, k) => ({ id: k, titulo: o.text || 'Answer ' + (k + 1), sub: o.next && porId(o.next) ? 'goes on' : 'ends the scene' })), k => { d = porId(d.options[k].next); passo(); }, esc(d.text || ''));
    else escolherOpcao(quem + (d.title ? ' · ' + d.title : ''), [{ id: 'ok', titulo: d.next && porId(d.next) ? 'Next ▸' : 'End' }], () => { d = porId(d.next); passo(); }, esc(d.text || ''));
  };
  passo();
}

/* "Unlock a campaign map": the maps of the story flow other than this one; the target of a trigger (an older "Add a mission → a new map" points to its map) */
const mapasParaLiberar = () => campanha ? campanha.nos.filter(n => (n.tipo === 'map' || n.tipo === 'side') && n.missao !== missaoAtual) : [];
const noDoDesbloqueio = g => campanha ? (noPorId(g.no) || (g.missaoAntiga !== undefined ? noDaMissao(g.missaoAntiga) : null) || null) : null;
