/* Bigorna Rooms v2 — objects: texts, triggers, requirements, consequences; room/tile removal; tile reuse; pillar limits. */
'use strict';

const TIPOS_GATILHO = [
  { id: 'open_room', nome: 'Open a room', expl: 'Shows a new room on the board when the object is used. Its tiles, pillars, doors and objects appear in that order. Example: a lever that opens the crypt. Several objects can open the same room, and you can also create the room from here.' },
  { id: 'spawn', nome: 'Spawn monsters', expl: 'Places monsters on the board when the object is used, in one of two ways: from the pool of the room (the game draws the monsters, and the points of the spaces you click decide how many enter and how strong they are) or one monster of the Workshop (you choose which one and the space where it enters).' },
  { id: 'give_item', nome: 'Give or take away an item', expl: 'The party receives something in the app’s inventory, with the game’s treasure window. It can be an item you pick (an item, a rune or a recipe of the workshop), a random item from the item pool of the map, random materials from the item pool worth N loot points, or gold. You set the item pool in “Map setup”. With “Take away”, it takes gold or random crafting materials from the party instead. Example: a merchant’s price, a thief.' },
  { id: 'rounds', nome: 'Every N rounds (waves)', expl: 'Counts the rounds from when the object is used and runs the triggers inside at the time you set: every N rounds (as many times as you choose, or until the end of the map), or only once, N rounds later. Example of a wave: put “Spawn monsters” inside; the spawn has its own “When the group is defeated”.' },
  { id: 'text', nome: 'Show a text', expl: 'Shows the players a message box with your text. Example: “The door is locked. Someone left a key nearby.”' },
  { id: 'counter', nome: 'Add / subtract / use a count', expl: 'Changes a counter of the map, or waits for it. A counter keeps a number during the map: keys found, levers pulled, seals broken. “Add” and “Take away” change the number; “Use” runs the triggers inside when it reaches the number you set. Example: each key adds 1, and at 3 the door opens. The number lives only in the app, outside the inventory.' },
  { id: 'campaign_var', nome: 'Add / subtract / use a campaign variable', expl: 'Adds to (or takes from) a story variable of the campaign, or uses it: “Use” runs the triggers inside when the variable reaches a number. The variable keeps its value for the next maps (Honour, Fear, Villagers saved…; a yes/no one is marked as chosen or not). Only in a campaign: create the variables with the Story variables button of the campaign screen.' },
  { id: 'skill_test', nome: 'Skill test', expl: 'The players roll at the table and enter their successes; the mod compares them with your number. In an open test, the box tells how many are needed. In a secret test, the number stays hidden. Each result (success, failure) may have its own text and its own triggers.' },
  { id: 'choice', nome: 'Multiple choice', expl: 'Asks the players a question, with up to five answers. Each answer may show a text and run its own triggers. Example: “Open the chest” or “Leave it be”.' },
  { id: 'mission', nome: 'Add an objective', expl: 'Adds a goal to this map. It is announced when the object is used and then listed with the objectives. The map ends when the mission is done, and you set the mission in “Map setup”. There you can also choose an objective as the mission.' },
  { id: 'unlock_map', nome: 'Unlock a campaign map', expl: 'Unlocks a map of the campaign, that is, a card of the story flow. That map stays locked until this trigger runs. Once unlocked, it appears on the world map as soon as the cards before it in the story flow are completed.' },
  { id: 'remove_room', nome: 'Remove a room', expl: 'Takes a whole room off the board during play: its tiles, pillars, objects and monsters. Its tiles become free, so a later room can use them. The heroes can never go back there. Example: a bridge that collapses behind the party.' },
  { id: 'remove_tile', nome: 'Remove a tile', expl: 'Takes one tile off the board. You choose: with everything on it (objects, pillars, monsters), or only the tile, so what stood on it stays on whatever lies below (an underlay: water, embers…). The tile is then free to be used again in a later room.' },
  { id: 'remove_enemy', nome: 'Remove monsters', expl: 'Takes monsters off the board without counting them as defeated. Choose one specific monster (click it), a spawn group, the monsters of this room, or all of them. Example: the cultists flee.' },
  { id: 'enemy_condition', nome: 'Change monster conditions', expl: 'Heals or damages monsters, or applies or removes a condition. It acts on a spawn group, on the monsters of this room or on all. It can also make them target a protected one: a token the heroes guard, whose name the activation window shows in place of the hero. To heal heroes, use a text: the players heal them at the table.' },
  { id: 'move_heroes', nome: 'Move the heroes', expl: 'Every time it fires, it lights up in the game the spaces you click and tells the players to move the heroes there, one hero per space. Example: a trap door drops the party into the cellar.' },
  { id: 'add_tile', nome: 'Add a tile', expl: 'A tile appears on the board when this object is used, with the objects and monsters placed on it. Example: a bridge, a collapsed wall, a secret passage. First lay the tile in any room. It stays faded in the editor and out of play until the trigger fires. Then click it here.' },
  { id: 'add_object', nome: 'Add an object', expl: 'A new object appears on the board when this one is used. Pick its kind and click where it goes. Example: a chest that appears after the lever is pulled.' },
  { id: 'remove_object', nome: 'Remove an object', expl: 'Takes an object of this map off the board when this runs. Click the object to choose it. Example: the boulder that blocked the passage is gone.' },
  { id: 'highlight', nome: 'Highlight', expl: 'Draws the players’ attention: it outlines an object or lights up a space. Example: the lever that opens the next room.' },
  { id: 'scene', nome: 'Play a scene', expl: 'Plays a scene of dialogue boxes, like the scenes of the story flow. In each box you set who speaks, the text, the others in the picture and the background. A box may ask a question, and each answer may lead to another box. The scene plays in the game’s story window.' },
  { id: 'cutscene', nome: 'Play a video', expl: 'Plays your own film (MP4 or WebM) full screen. The players can skip it with a click.' },
  { id: 'sound', nome: 'Play a sound', expl: 'Plays a sound when this runs: a sound effect of the game (to hear them, press F7 in the game and open the sounds) or your own file (OGG, MP3 or WAV).' },
  { id: 'item_pool', nome: 'Change the item pool', expl: 'Adds an item to the item pool of the map, or removes one, for the rest of the map. The item pool is where “Give or take away an item” draws its random items and materials from.' },
  { id: 'reserve', nome: 'Change the spawn pool', expl: 'Changes the spawn pool, the list the game draws monsters from. You add a monster to it or remove one. The change lasts until the end of the map.' },
  { id: 'shop', nome: 'Open the shop', expl: 'The party visits a shop in the middle of the map, like the one in the city. Then the adventure goes on. The party buys with the gold it has and sells crafting materials. You choose where the stock comes from (the city’s shop, your own list or the item pool of the map), the prices, how many purchases per visit and how many times the shop opens.' },
  { id: 'armory', nome: 'Open the armory', expl: 'The heroes visit an armory in the middle of the map, like the one in the city. Then the adventure goes on. Each hero can change weapons (their own and the party’s rune weapons) and weapon parts (those the party owns), as the game allows. You choose what can change and how many times the armory opens.' },
  { id: 'craft', nome: 'Open the crafting', expl: 'Opens crafting in the middle of the map, as in the city. Then the adventure goes on. The party makes the items of the recipes it knows, with the crafting materials it has. The game’s rules apply: each recipe once, and an upgrade replaces the item it improves. A weapon part just crafted can go straight onto the hero’s weapon. You choose which kinds can be crafted and how many times it opens.' },
  { id: 'end_map', nome: 'End the map', expl: 'The map ends here, in victory or in defeat. Example: a villain escaped, or the time ran out.' },
  { id: 'escort', nome: 'Escort (a protected one)', oculto: true, expl: 'Someone the heroes protect: a token on the table, with 5 interaction tokens beside it as its health. From now on the monsters may pick it as their target, and the activation window shows it by name. The hunters (the spawn groups you list) always go for it. The others have a chance to, each round. “End” stops the escort, when it fell or is safe.' },
  { id: 'move_object', nome: 'Move an object', expl: 'Moves an object of the map to its marker. The marker is a second object of the same kind: place it where the object should go, turned the way it should end. The marker stays out of the room setup; it only shows the new place. Click the object, then its marker.' },
  { id: 'move_tile', nome: 'Move a tile', expl: 'Moves a tile to its marker. The marker is the same tile placed a second time, where it should go. The marker stays out of the room setup. Whatever stands on the tile (objects, pillars) moves with it; on the table, the players move the figures. Click the tile, then its marker.' },
  { id: 'objective', nome: 'Room objective', oculto: true, expl: 'Using this object counts as an objective of the room, listed and ticked. For older maps only: today, use “Add an objective”.' },
];
const GATILHO = Object.fromEntries(TIPOS_GATILHO.map(t => [t.id, t]));
/* the marker "additional action" beside the button that adds triggers: as in the game, the hero who used the object may
   perform an additional action ("You may perform an additional action", shown by the game in its language) */
const temExtra = (o, lista) => !!(o && o.acaoExtra && o.acaoExtra[lista]);
const chipExtra = (o, lista) => o && !o.enemy && !o.ehContador ? `<label class="chk chipExtra" title="${esc(tr('As in the game: after this, the hero who used the object may perform an additional action. The game shows its own sentence for it.'))}"><input type="checkbox" data-extra="${esc(lista)}" ${temExtra(o, lista) ? 'checked' : ''}> ⚡ ${esc(tr('Additional action'))}</label>` : '';
function ligarExtras(el, o) { if (!el || !o) return; el.querySelectorAll('input[data-extra]').forEach(i => { if (i._ligado) return; i._ligado = true;
  i.onclick = e => e.stopPropagation();
  i.onchange = () => { o.acaoExtra = o.acaoExtra || {}; if (i.checked) o.acaoExtra[i.dataset.extra] = true; else delete o.acaoExtra[i.dataset.extra]; if (!Object.keys(o.acaoExtra).length) delete o.acaoExtra; renderConferencia(); }; }); }
/* triggers shown together in the catalog: one entry, then the kind */
const GRUPOS_GATILHO = [
  { id: 'grp:addremove', nome: 'Add / Remove…', expl: 'Changes the board during play. These triggers put tiles, objects, monsters or rooms on the board, take them off or move them.', pergunta: 'Add, remove or move?',
    ramos: [
      { id: 'ramo:add', nome: 'Add…', expl: 'Something appears on the board: a tile, an object or monsters. Example: a bridge over the chasm.', pergunta: 'Add what?',
        membros: [['add_tile', 'A tile'], ['add_object', 'An object'], ['spawn', 'Spawn monsters']] },
      { id: 'ramo:remove', nome: 'Remove…', expl: 'Takes something off the board: a tile, a room, an object or monsters. Example: a collapsed hall the heroes leave behind.', pergunta: 'Remove what?',
        membros: [['remove_tile', 'A tile'], ['remove_room', 'A room'], ['remove_object', 'An object'], ['remove_enemy', 'A monster (or a group, the room’s, all)']] },
      { id: 'ramo:move', nome: 'Move…', expl: 'Something changes place on the board: an object or a tile goes to its marker (a second copy placed where it should go).', pergunta: 'Move what?',
        membros: [['move_object', 'An object'], ['move_tile', 'A tile']] },
    ] },
  { id: 'grp:media', nome: 'Play a scene, video or sound', expl: 'Plays one of these when the object is used: a scene of dialogue boxes (like the story flow), your own film full screen, a sound effect of the game or your own sound file. Example: a short scene when the heroes open the crypt.', pergunta: 'Play what?',
    membros: [['scene', 'A scene (dialogue boxes)'], ['cutscene', 'A video (your own film)'], ['sound', 'A sound (game effect or your own file)']] },
  { id: 'grp:mercado', nome: 'Shop / Armory / Crafting', expl: 'The party visits a shop, an armory or the crafting workshop in the middle of the map, as in the city. Then the adventure goes on. Example: a merchant in the camp.', pergunta: 'Open what?',
    membros: [['shop', 'The shop (buy and sell)'], ['armory', 'The armory (weapons and weapon parts)'], ['craft', 'The crafting (items of the recipes the party knows)']] },
  { id: 'grp:pool', nome: 'Change item / spawn pool', expl: 'Adds items or monsters to the item pool or the monster spawn pool of the map, or takes them out, for the rest of the map. Example: after the alarm, the spawn pool gains more guards.', pergunta: 'Change which pool?',
    membros: [['item_pool', 'Item'], ['reserve', 'Monster spawn']] },
];
const membrosDoGrupo = gr => gr.membros || gr.ramos.flatMap(r => r.membros);
/* "Remove an object" aimed at the object that holds it (a point of interest is taken away when used, as in the game) */
const ehAutoRemocao = (g, si, oi) => g.tipo === 'remove_object' && (g.proprio || (g.objSala === si && g.objIndex === oi));
const autoRemocao = () => ({ uid: uid(), tipo: 'remove_object', proprio: true });
/* a "Show a text" trigger (with its requirements), and the same with the text in the editor's language (the generators) */
const gatilhoTexto = (text, requisitos = []) => ({ uid: uid(), tipo: 'text', text, requisitos });
const txtT = (en, pt) => gatilhoTexto(L2(en, pt));
/* v309: a text made of a template and the names of the map (the template is what the tables of the other languages know):
   txtTF('{0} falls.', '{0} cai.', X); with the person's gender: ⟨his|her⟩ in the templates, masculine first */
const LFG = (ela, en, pt, ...v) => { const g = t => String(t).replace(/⟨([^|⟩]*)\|([^⟩]*)⟩/g, (m, a, b) => ela ? b : a); return LF(g(en), g(pt), ...v); };
const txtTF = (en, pt, ...v) => gatilhoTexto(LF(en, pt, ...v));
const txtTG = (ela, en, pt, ...v) => gatilhoTexto(LFG(ela, en, pt, ...v));
/* a result list of a trigger (ok, fail, grupo, rodada…), found on whichever holder keeps it */
function listaDoGatilho(g, prefixo) { const k = prefixo + ':' + g.uid; for (const ss of projeto.salas) for (const { o } of donosDaSala(ss)) if (o[k]) return o[k]; for (const c of projeto.contadores || []) if (c[k]) return c[k]; return []; }
const grupoDoGatilho = id => GRUPOS_GATILHO.find(gr => membrosDoGrupo(gr).some(([m]) => m === id));
/* tiles that enter the board by an "Add a tile" trigger: 'room:tile' -> reveal group of that tile */
function pecasAdicionadas(p = projeto) {
  const m = new Map(), olha = o => todosGatilhos(o).forEach(g => { if (g.tipo === 'add_tile' && p.salas[g.sala]?.pecas[g.peca]) m.set(g.sala + ':' + g.peca, 'tile-' + (g.sala + 1) + '-' + (g.peca + 1)); });
  p.salas.forEach(ss => donosDaSala(ss).forEach(({ o }) => olha(o))); (p.contadores || []).forEach(olha); (p.eventos || []).forEach(olha);   // (an event of rounds may add one too)
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
  return materiais ? (mat ? null : 'The item pool has no materials yet. Add crafting materials to it in Workshop → Items or in “Map setup”.') : (item ? null : 'The item pool has no items: add items to it (Workshop → Items, or Map setup).');
}
const SO_CONSEQUENCIA = new Set(['shop', 'armory', 'craft', 'end_map', 'escort', 'move_object', 'move_tile', 'unlock_map', 'campaign_var', 'text', 'counter', 'sound', 'skill_test', 'choice', 'spawn', 'enemy_condition', 'highlight', 'give_item', 'remove_enemy', 'move_heroes', 'add_object', 'add_tile', 'remove_object', 'cutscene', 'scene', 'rounds']);
const TIPOS_REQUISITO = [
  { id: 'item', nome: 'The party has an item', expl: 'The trigger happens only if the party has this item of the Workshop. Example: the key that opens the vault.' },
  { id: 'mission', nome: 'An objective was completed', expl: 'The trigger happens only after an objective added by “Add an objective” is completed.' },
  { id: 'room_open', nome: 'A room is open', expl: 'The trigger happens only if another room is already revealed.' },
  { id: 'enemies_defeated', nome: 'A room’s monsters are defeated', expl: 'The trigger happens only when every monster that came with a room, at the start or by a spawn, is defeated.' },
  { id: 'object_used', nome: 'Another object was used', expl: 'The trigger happens only after another object of the map was used. Click that object to choose it.' },
  { id: 'choice', nome: 'A choice in the campaign', expl: 'The trigger happens only if a story variable of the campaign holds: the party chose an answer ticked “Remember this answer” (or did not), or a number variable is at least, at most or exactly a number, more than another one, or the highest of several.' },
  { id: 'gold', nome: 'The party has gold', expl: 'The trigger happens only if the party has at least this much gold. Example: a merchant’s price.' },
  { id: 'counter', nome: 'A counter reaches a number', expl: 'The trigger happens only when a counter of the map has reached a number. Example: 3 keys found, or all the seals broken. Counters change with the “Add / subtract / use a count” trigger and appear under the Counts button of the ribbon.' },
];

// ------------------------------------------------------------ object panel
function renderObjeto(el, s, oi) {
  const o = s.objetos[oi]; const terreno = ehTerreno(o);
  el.innerHTML = `<div class="linha"><img class="icoObj" loading="lazy" decoding="async" ${imgTardia(iconeObj(o.type))} alt=""><p class="ajuda">${esc(nomeObj(o.type))} · room ${sel.sala + 1} · space ${o.pos[0]},${o.pos[1]}${(o.level || 0) > 0 ? ' · level ' + o.level : ''}${o.hidden ? ' · hidden until a trigger shows it' : ''}${ehTipo(o, 'PillarObj') ? ' · a column standing on a square; it supports no tile' : ''}</p></div>
    ${terreno ? `<label class="campo">Base level <select id="o_nivel">${[0, 1, 2, 3].map(l => `<option value="${l}" ${(o.level || 0) === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label><p class="ajuda">${ehTipo(o, 'Staircase') ? 'The arrow shows the way up (R turns it). It climbs from the base level to the next one. From level 1 up it stands on tiles of its base level.' : 'Floor: heroes walk on it. It may sit off the tiles.'}</p>` : ''}
    ${ehTipo(o, 'PillarObj') || ehTipo(o, 'PillarPush') ? `<label class="campo">Size <select id="o_pilar">${Object.entries(SUPORTES).filter(([k]) => !ehTipo(o, 'PillarPush') || TAMANHOS_INTERATIVO.includes(k)).map(([k, v]) => `<option value="${k}" ${(o.tamanho || 'Pillar') === k ? 'selected' : ''}>${v.nome} (reaches level ${v.nivel})</option>`).join('')}</select></label>` : ''}
    <label class="campo">Name <input id="o_nome" value="${esc(o.name || '')}" placeholder="${esc(nomeObj(o.type))}"></label>
    ${ehTipo(o, 'SightToken') ? '<p class="ajuda">A point of interest fires as soon as a player taps it, with or without a hero. It costs no action. It usually leaves the board and reveals what lies ahead, for example with “Open a room”. Kept on the board and usable many times, it works as a passage between tiles that stand apart.</p>' : `<label class="campo">Text when looked at <small>(a player taps it with no hero chosen)</small><textarea id="o_click" rows="2" placeholder="Shown when a player taps the object without using it">${esc(o.textClick || '')}</textarea></label>`}
    <label class="campo">Text when used <small>(a hero uses it: tap it with the hero chosen)</small><textarea id="o_uso" rows="2" placeholder="Shown when a hero uses the object">${esc(o.textUse || '')}</textarea></label>
    ${terreno ? '' : `<label class="campo">Text once used up <small>(what the object becomes after use: an open chest, a body already searched. It shows every time someone touches the spent object, just looking or with a hero, and the hero spends no action. Left empty, an interaction token leaves the table once spent)</small><textarea id="o_gasto" rows="2" placeholder="Empty: the token leaves the table once spent">${esc(o.textGasto || '')}</textarea></label>`}
    ${terreno ? '' : `<label class="campo">Can be used <select id="o_usos">${[['', 'Once (like in the game)'], ['2', 'Twice'], ['3', 'Three times'], ['5', 'Five times'], ['always', 'Every time (never runs out)']].map(([k, n]) => `<option value="${k}" ${(o.usos || '') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
    <div class="sub">Triggers <button class="sm" id="o_add">+ Add</button> ${chipExtra(o, 'gatilhos')}</div>
    <p class="ajuda">${ehTipo(o, 'SightToken') ? 'They run in order when the point of interest is tapped.' : 'They run from top to bottom when a hero uses the object. Using it is an action: tap the object with the hero chosen. Tapped with no hero, it only shows the text when looked at.'} To make a trigger happen only under certain conditions, open its box and add a requirement. The other triggers run as usual.</p>
    <div id="o_gats"></div>
    <div class="linha acoes"><button id="o_copia">⧉ Copy</button><button id="o_apaga" class="perigo">Remove</button></div>
    ${terreno || EDITANDO_PADRAO ? '' : `<div class="sub">Default of “${esc(nomeObj(chaveDoPadrao(o)))}” ${padroesDaOficina()[chaveDoPadrao(o)] ? '<small>(the Workshop’s)</small>' : temPadrao(chaveDoPadrao(o)) ? '<small>(the game’s)</small>' : '<small>(none)</small>'}</div>
    <div class="linha acoes">${temPadrao(chaveDoPadrao(o)) ? '<button class="sm" id="o_padrao" title="Replaces the texts and triggers of this object with the default of its kind">Apply the default</button>' : ''}<button class="sm" id="o_salvaPadrao" title="${esc(tr(ehDaOficina(o.type) ? 'The texts and triggers of this object become its default, in the Workshop: objects placed from now on come with them' : 'The texts and triggers of this object become a new object of the Workshop (a copy of this piece of the game, with this default); you name it'))}">Save as the default</button>${padroesDaOficina()[o.type] && chaveDoPadrao(o) === o.type && !ehDaOficina(o.type) ? '<button class="sm" id="o_padraoOriginal" title="The Workshop forgets its default for this kind">Back to the game’s default</button>' : ''}</div>`}`;
  $('#o_nome').oninput = e => { o.name = e.target.value; desenhar(); renderSalas(); };
  const op = $('#o_pilar'); if (op) op.onchange = e => { o.tamanho = e.target.value; tudo(); };
  if ($('#o_click')) $('#o_click').oninput = e => { o.textClick = e.target.value; };
  $('#o_uso').oninput = e => { o.textUse = e.target.value; };
  if ($('#o_gasto')) $('#o_gasto').oninput = e => { o.textGasto = e.target.value; if (!o.textGasto) delete o.textGasto; };
  const us = $('#o_usos'); if (us) us.onchange = e => { o.usos = e.target.value; if (!o.usos) delete o.usos; renderConferencia();
    const gi = o.usos ? (o.gatilhos || []).findIndex(g => ehAutoRemocao(g, sel.sala, oi)) : -1; if (gi < 0) return;
    escolherOpcao('“' + rotulo(o) + '” removes itself when used', [
      { id: 'tirar', titulo: 'Remove that trigger', sub: 'The object stays on the board and can be used ' + (o.usos === 'always' ? 'every time' : o.usos + ' times') + '.' },
      { id: 'manter', titulo: 'Keep it', sub: 'The object still leaves the board the first time it is used, so its other uses never happen.' }],
      id => { if (id === 'tirar') { const k = o.gatilhos.findIndex(g => ehAutoRemocao(g, sel.sala, oi)); if (k >= 0) o.gatilhos.splice(k, 1); gatAberto = -1; tudo(); aviso('The “Remove an object” trigger of “' + rotulo(o) + '” is gone.'); } },
      'It has a “Remove an object” trigger aimed at itself (points of interest get it by default, as in the game).'); };
  $('#o_add').onclick = () => abrirCatalogo(s, oi, 'gatilhos'); ligarExtras(el, o);
  $('#o_copia').onclick = () => copiarObjeto();
  const bp = $('#o_padrao'); if (bp) bp.onclick = () => { if (!confirm(tr('Replace the texts and triggers of this object with the default of its kind?'))) return; aplicarPadrao(o); tudo(); };
  const bs = $('#o_salvaPadrao'); if (bs) bs.onclick = () => { marcarVisto('dica:salvaPadrao'); if (!ehDaOficina(o.type)) return batizarCopia(o, () => renderObjeto(el, s, oi)); const r = salvarComoPadrao(o); aviso(r === 'original' ? tr('This is the game’s default already: nothing to keep in the Workshop.') : tr('Saved in the Workshop. Objects of this kind that you place with “Default script” ticked now come with this object’s programming.')); renderObjeto(el, s, oi); };
  const bo = $('#o_padraoOriginal'); if (bo) bo.onclick = () => { delete padroesDaOficina()[o.type]; aviso(tr('The Workshop forgot its default: the game’s one is back.')); renderObjeto(el, s, oi); };
  $('#o_apaga').onclick = () => apagarSelecao({ tipo: 'objeto', sala: sel.sala, i: oi });
  const nv = $('#o_nivel'); if (nv) nv.onchange = e => { const antes = o.level || 0, quer = +e.target.value; o.level = quer; if (escadaSemApoio(o)) { o.level = antes; e.target.value = antes; return aviso(AVISO_ESCADA(quer)); } tudo(); };
  renderGatilhos($('#o_gats'), s, oi, 'gatilhos');
}
/* depois: called once the object is really gone (the question below answers later, or never with Cancel) */
function removerObjeto(si, oi, semPergunta, semRender, depois) {
  const s = projeto.salas[si]; const o = s.objetos[oi];
  const abre = (o.gatilhos || []).filter(g => g.tipo === 'open_room').map(g => g.sala).filter(x => abridoresDe(x).length === 1);
  if (abre.length && !semPergunta) {
    // three ways out: OK moves the triggers first, Delete anyway, Cancel keeps the object
    escolherOpcao('This is the only object that opens room ' + abre.map(x => x + 1).join(', ') + '.', [
      { id: 'mover', titulo: 'OK', sub: 'First move all its triggers to another object (you click it), then delete.' },
      { id: 'apagar', titulo: 'Delete anyway', classe: 'perigo', sub: 'The room stays without an opener until another object opens it.' }
    ], id => {
      const agora = projeto.salas[si]?.objetos.indexOf(o); if (agora == null || agora < 0) return;
      if (id === 'mover') transferirGatilhos(si, agora, () => { const k = projeto.salas[si].objetos.indexOf(o); if (k >= 0) removerObjeto(si, k, true, semRender, depois); });
      else removerObjeto(si, agora, true, semRender, depois);
    });
    return;
  }
  s.objetos.splice(oi, 1);
  s.objetos.forEach(x => { if (x.gemeo == null) return; if (x.gemeo === oi) delete x.gemeo; else if (x.gemeo > oi) x.gemeo--; });
  s.objetivos.forEach(ob => { if (ob.objeto === oi) ob.objeto = -1; else if (ob.objeto > oi) ob.objeto--; });
  const fm = projeto.meta.finalMission; if (fm && fm.tipo === 'use_object' && fm.sala === si) { if (fm.objeto === oi) fm.objeto = -1; else if (fm.objeto > oi) fm.objeto--; }
  // every holder, the counters' consequences too
  projeto.salas.flatMap(ss => donosDaSala(ss)).concat(donosContadores()).forEach(({ o: x }) => { todosGatilhos(x).forEach(g => { if (g.objSala === si && g.objIndex !== undefined) { if (g.objIndex === oi) delete g.objIndex; else if (g.objIndex > oi) g.objIndex--; }
      if (g.tipo === 'move_object' && g.marcaSala === si && g.marcaIndex !== undefined) { if (g.marcaIndex === oi) delete g.marcaIndex; else if (g.marcaIndex > oi) g.marcaIndex--; } });
    [x, ...todosGatilhos(x)].flatMap(z => z.requisitos || []).forEach(r => { if (r.tipo === 'object_used' && r.sala === si) { if (r.objeto === oi) delete r.objeto; else if (r.objeto > oi) r.objeto--; } }); });
  limparAbridores();
  if (!semRender) { sel = null; tudo(); }
  if (depois) depois();
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
/* the one-line summary of a trigger (the list of triggers, the counters): written in both languages here, because it mixes
   the author's texts and names with the editor's words (the page translation would have to guess where one ends) */
function resumoGatilho(g) {
  const R = L2, nada = R('(none yet)', '(nenhum ainda)'), alvoDe = a => a === 'all' ? R('all monsters', 'todos os monstros') : a === 'group' ? R('a spawn group', 'um grupo de surgimento') : R('the monsters of this room', 'os monstros desta sala');
  const protegido = g.nome || R('the protected one', 'o protegido');
  const usos = +g.usos ? R(' · opens ', ' · abre ') + (+g.usos) + '×' : '';
  const dentro = d => d ? d + R(' trigger(s)', ' gatilho(s)') : R('nothing inside yet', 'nada dentro ainda');
  switch (g.tipo) {
    case 'open_room': return projeto.salas[g.sala] ? R('opens ', 'abre ') + (projeto.salas[g.sala].nome || R('room ', 'sala ') + (+g.sala + 1)) : R('opens a room (pick it)', 'abre uma sala (escolha qual)');
    case 'give_item': if (g.acao === 'remove') return g.modo === 'material' ? R('takes ' + (g.amount || 1) + ' random material(s)', 'tira ' + (g.amount || 1) + ' material(is) ao acaso') : R('takes ' + (g.amount || 10) + ' gold', 'tira ' + (g.amount || 10) + ' de ouro');
      return g.modo === 'random' || g.modo === 'craft' ? R('random loot (' + (g.points || 3) + ' pts)', 'espólio ao acaso (' + (g.points || 3) + ' pts)') : g.modo === 'gold' ? R((g.amount || 10) + ' gold', (g.amount || 10) + ' de ouro') : g.modo === 'newitem' ? R((g.amount || 1) + ' random item(s) of the pool', (g.amount || 1) + ' item(ns) ao acaso da reserva') : R('item: ', 'item: ') + (g.item ? nomeItem(g.item) : '?');
    case 'campaign_var': { if (!g.nome) return tr('campaign variable (pick it)');
      if (g.acao === 'use') { const d = listaDoGatilho(g, 'conta').length; return R('when “', 'quando “') + g.nome + R('” reaches ', '” chega a ') + Math.max(1, +g.n || 1) + (g.desde === 'uso' ? R(' (from when it runs)', ' (desde quando roda)') : '') + ' · ' + dentro(d); }
      return '“' + g.nome + '” ' + (typeof resumoMudanca === 'function' ? resumoMudanca({ nome: g.nome, op: g.acao, n: g.n, outra: g.outra }) : ''); }
    case 'unlock_map': { const n = noDoDesbloqueio(g); return R('unlocks ', 'libera ') + (n ? rotuloDoNo(n) + (nomeDoNo(n) !== rotuloDoNo(n) ? ' “' + nomeDoNo(n) + '”' : '') : R('(no map yet)', '(nenhum mapa ainda)')); }
    case 'mission': return R('objective: ', 'objetivo: ') + (g.text || '?').slice(0, 30);
    case 'text': return R('text: ', 'texto: ') + (g.text || '').slice(0, 40);
    case 'counter': { const cont = g.contador || R('(no counter yet)', '(nenhum contador ainda)');
      if (g.acao === 'use') { const d = listaDoGatilho(g, 'conta').length; return R('when ', 'quando ') + cont + R(' reaches ', ' chega a ') + Math.max(1, +g.n || 1) + (g.desde === 'uso' ? R(' (from when it runs)', ' (desde quando roda)') : '') + ' · ' + dentro(d); }
      return (g.acao === 'sub' ? '− ' : g.acao === 'set' ? '= ' : '+ ') + (g.n ?? 1) + ' ' + cont; }
    case 'skill_test': return (g.secret ? R('secret test, ', 'teste secreto, ') : R('open test, ', 'teste aberto, ')) + (g.successes || 2) + R(' success(es)', ' sucesso(s)'); // outcome counts are added by renderGatilhos
    case 'spawn': return g.fonte === 'pool' ? (g.cells || []).length + R(' balanced space(s) from the pool', ' espaço(s) equilibrado(s) da reserva') : (g.inimigos || []).length ? nomeIni(g.inimigos[0].enemy) + ((g.inimigos || []).length > 1 ? ' +' + (g.inimigos.length - 1) : '') : R('no monster yet', 'nenhum monstro ainda');
    case 'remove_enemy': return R('removes ', 'remove ') + (g.alvo === 'all' ? R('all monsters', 'todos os monstros') : g.alvo === 'group' ? R('a spawn group', 'um grupo de surgimento') : g.alvo === 'one' ? (inimigoRef(g.inimigo) ? nomeIni(inimigoRef(g.inimigo).enemy) + R(' at ', ' em ') + inimigoRef(g.inimigo).pos.join(',') : R('one monster (none picked yet)', 'um monstro (nenhum escolhido ainda)')) : R('the monsters of this room', 'os monstros desta sala'));
    case 'enemy_condition': if (g.acao === 'mirar') return alvoDe(g.alvo) + R(' may target ', ' podem mirar em ') + protegido + ' (' + ((g.chance ?? 25) >= 100 ? R('always', 'sempre') : (g.chance ?? 25) + R('% each round', '% a cada rodada')) + ')';
      if (g.acao === 'desmirar') return R('the monsters stop targeting ', 'os monstros param de mirar em ') + protegido;
      return ({ heal: R('heals', 'cura'), damage: R('damages', 'causa dano em'), apply: R('applies ' + (g.condition || '?') + ' to', 'aplica ' + tr(g.condition || '?') + ' em'), remove: R('removes ' + (g.condition || '?') + ' from', 'remove ' + tr(g.condition || '?') + ' de'), bonus: R('changes attack/defence of', 'muda ataque/defesa de') })[g.acao || 'apply'] + ' ' + (g.alvo === 'all' ? R('all', 'todos') : g.alvo === 'group' ? R('a spawn group', 'um grupo de surgimento') : R('the monsters of this room', 'os monstros desta sala'));
    case 'shop': { const f = fontesDaLoja(g); return R('shop: ', 'loja: ') + (f.length ? f.map(x => ({ cidade: R('city stock', 'estoque da cidade'), lista: (g.itens || []).length + R(' item(s) of yours', ' item(ns) seus'), pool: R('item pool', 'reserva de itens') })[x]).join(' + ') : R('no stock yet', 'sem estoque ainda')) + ((g.preco ?? 100) !== 100 ? R(' · prices ', ' · preços a ') + g.preco + '%' : '') + usos; }
    case 'armory': return R('armory: ', 'arsenal: ') + (g.armas === false && g.pecas === false ? R('nothing to change', 'nada para trocar') : g.armas === false ? R('weapon parts', 'peças de arma') : g.pecas === false ? R('weapons', 'armas') : R('weapons and weapon parts', 'armas e peças de arma')) + usos;
    case 'craft': { const k = tiposDaForja(g); return R('crafting: ', 'fabricação: ') + (k.length === TIPOS_FORJA.length ? R('every kind', 'todo tipo') : k.length ? k.map(x => tr(TIPOS_FORJA.find(t => t[0] === x)[1].toLowerCase())).join(', ') : R('nothing to craft', 'nada para fabricar')) + usos; }
    case 'end_map': return g.resultado === 'vitoria' ? R('ends the map in victory', 'termina o mapa em vitória') : R('ends the map in defeat', 'termina o mapa em derrota');
    case 'escort': return g.acao === 'fim' ? R('ends the escort', 'termina a escolta') : R('starts the escort of ', 'começa a escolta de ') + protegido + ' (' + (g.chance ?? 25) + R('% of the other monsters, ', '% dos outros monstros, ') + (g.cacadores || []).length + R(' hunter group(s))', ' grupo(s) de caçadores)');
    case 'move_object': return R('moves ', 'move ') + (g.objIndex !== undefined ? rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {}) : R('(no object)', '(nenhum objeto)')) + (projeto.salas[g.marcaSala]?.objetos[g.marcaIndex] ? R(' to its marker', ' até a marca') : g.cell ? R(' to ', ' para ') + g.cell.join(',') : R(' (no marker yet)', ' (sem marca ainda)'));
    case 'move_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; return R('moves tile ', 'move a peça ') + (p ? nomePeca(p.tile) : nada) + (projeto.salas[g.marcaSala]?.pecas[g.marcaPeca] ? R(' to its marker', ' até a marca') : R(' (no marker yet)', ' (sem marca ainda)')); }
    case 'move_heroes': return R('moves the heroes', 'move os heróis') + ((g.cells || []).length ? R(' to ', ' para ') + g.cells.map(c => c.join(',')).join('; ') : R(' (no destination yet)', ' (sem destino ainda)'));
    case 'add_object': return R('adds ', 'acrescenta ') + nomeObj(g.objType || 'Chest') + (g.objIndex !== undefined ? '' : R(' (no place yet)', ' (sem lugar ainda)'));
    case 'remove_object': return R('removes ', 'remove ') + (g.proprio ? R('itself', 'a si mesmo') : g.objIndex !== undefined ? rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {}) : R('(no target yet)', '(sem alvo ainda)'));
    case 'remove_room': return R('removes ', 'remove ') + (projeto.salas[g.sala]?.nome || R('(no room yet)', '(nenhuma sala ainda)'));
    case 'add_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; return R('adds tile ', 'acrescenta a peça ') + (p ? nomePeca(p.tile) + R(' of room ', ' da sala ') + (g.sala + 1) : nada); }
    case 'remove_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; return R('removes tile ', 'remove a peça ') + (p ? nomePeca(p.tile) + R(' of room ', ' da sala ') + (g.sala + 1) : nada) + (g.manter ? R(' (keeps what stands on it)', ' (mantém o que está em cima)') : ''); }
    case 'highlight': return R('highlights ', 'destaca ') + (g.objIndex !== undefined ? rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {}) : g.cell ? R('space ', 'o espaço ') + g.cell.join(',') : R('(no target yet)', '(sem alvo ainda)'));
    case 'choice': return R('choice: ', 'escolha: ') + (g.text || '').slice(0, 30) + ' (' + (g.options || []).length + R(' answers)', ' respostas)');
    case 'scene': { const cx = g.caixas || []; const c0 = cx.find(c => c.id === g.inicio) || cx[0]; return R('scene: ', 'cena: ') + cx.length + R(' box(es)', ' caixa(s)') + (c0 ? ' · ' + (c0.speaker ? nomePersonagem(c0.speaker) + ': ' : '') + '“' + (c0.text || '').slice(0, 30) + ((c0.text || '').length > 30 ? '…' : '') + '”' : ''); }
    case 'rounds': { const n = Math.max(1, +g.n || 2), d = listaDoGatilho(g, 'rodada').length; return (g.modo === 'uma' ? R('once, ' + n + ' round(s) later', 'uma vez, ' + n + ' rodada(s) depois') : R('every ' + n + ' round(s)', 'a cada ' + n + ' rodada(s)') + (+g.vezes ? R(', ' + g.vezes + ' time(s)', ', ' + g.vezes + ' vez(es)') : R(', to the end', ', até o fim'))) + ' · ' + dentro(d); }
    case 'cutscene': return g.video ? R('video ', 'vídeo ') + (g.video.nome || g.video.arquivo) : g.name ? R('game cutscene ', 'cena do jogo ') + (CUTSCENES.find(c => c.id === g.name)?.label || g.name) : R('(no video yet)', '(nenhum vídeo ainda)');
    case 'sound': return g.somModo === 'arquivo' ? R('own sound: ', 'som próprio: ') + (g.som?.nome || R('(no file yet)', '(nenhum arquivo ainda)')) : R('sound ', 'som ') + (g.name || '?');
    case 'reserve': return (g.acao === 'remove' ? R('removes ', 'remove ') : R('adds ', 'acrescenta ')) + nomeIni(g.enemy || '?') + (g.acao === 'remove' ? R(' from the spawn pool', ' da reserva de monstros') : R(' to the spawn pool', ' à reserva de monstros'));
    case 'item_pool': return (g.acao === 'remove' ? R('removes ', 'remove ') : R('adds ', 'acrescenta ')) + (g.item ? semGlifo(nomeItem(g.item)) : R('(no item yet)', '(nenhum item ainda)')) + (g.acao === 'remove' ? R(' from the item pool', ' da reserva de itens') : R(' to the item pool', ' à reserva de itens'));
    case 'objective': return R('objective: ', 'objetivo: ') + (g.text || '').slice(0, 30);
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
  if (!gs.length) { el.innerHTML = '<p class="ajuda">' + (lista.includes(':') ? 'Nothing else happens.' : lista === 'senao' ? 'Nothing happens when the requirement fails (only the texts above).' : o.ehContador ? 'Nothing happens when the count is complete.' : o.enemy ? 'Nothing yet. Its defeat counts only for the objectives and for the game’s own effects.' : 'No triggers: using the object only shows its text.') + '</p>'; return; }
  gs.forEach((g, gi) => {
    const reqs = g.requisitos || []; const podeReq = lista === 'gatilhos';
    const d = document.createElement('div'); d.className = 'gat' + (reqs.length ? ' comReq' : ''); const chave = chaveDe(o, lista, gi);
    const aberto = gatAberto === chave || String(gatAberto).startsWith(chave + '|');
    d.innerHTML = `<div class="cab"><span>${aberto ? '▾' : '▸'}</span><b>${esc(GATILHO[g.tipo]?.nome || g.tipo)}</b><small>${reqs.length ? '<span class="cadeado" title="Only when its requirement holds">🔒 ' + reqs.length + '</span> ' : ''}${esc(resumoGatilho(g))}</small><button class="sm" data-x title="Remove">✕</button></div>${aberto ? '<div class="corpo"><p class="expl">' + esc(explDe(g.tipo, o)) + '</p><div class="campos"></div>'
      + (podeReq ? `<div class="reqGat"><div class="sub">Requirement <button class="sm" data-addreq>+ Add</button></div><p class="ajuda">${reqs.length ? 'This trigger runs only when every requirement holds. The other triggers run as usual.' : 'None: this trigger always runs.'}</p><div class="reqs"></div>`
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
    if (confirm('This is the only trigger that opens room ' + (g.sala + 1) + '.\n\nOK: move all the triggers of this object to another object (you click it) instead of deleting. That way the room can still be opened.\nCancel: delete the trigger; the room stays without an opener until another object gets an “Open a room” trigger.')) { transferirGatilhos(sel.sala, oi, () => { sel = null; tudo(); }); return; }
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
    case 'open_room': html = campo('Opens', `<select data-k="sala">${projeto.salas[g.sala] ? '' : '<option value="" selected>— pick the room —</option>'}${projeto.salas.map((r, ri) => ri > 0 && ri !== si ? `<option value="${ri}" ${ri === g.sala ? 'selected' : ''}>${ri + 1} · ${esc(r.nome)}${abridoresDe(ri).length ? '' : ' (no opener yet)'}</option>` : '').join('')}</select>`) + `${projeto.salas[g.sala] ? `<p><button class="sm" data-ir="${g.sala}">Go to that room</button></p>` : ''}<p class="ajuda">Several objects may open the same room, two levers for example. The room appears with the first one used.</p>`; break;
    case 'give_item': { if (g.modo === 'craft') { g.modo = 'random'; g.points = (g.amount || 1) * 5; }
      const acao = campo('Action', `<select data-k="acao"><option value="" ${g.acao !== 'remove' ? 'selected' : ''}>Give</option><option value="remove" ${g.acao === 'remove' ? 'selected' : ''}>Take away</option></select>`);
      // taking away: only gold or random crafting materials (a merchant's price, a thief), never a chosen item
      if (g.acao === 'remove') { if (g.modo !== 'material') g.modo = 'gold';
        html = acao + campo('What', `<select data-k="modo"><option value="gold" ${g.modo === 'gold' ? 'selected' : ''}>Gold</option><option value="material" ${g.modo === 'material' ? 'selected' : ''}>Random crafting materials</option></select>`) +
          campo(g.modo === 'material' ? 'How many' : 'Gold', `<input data-k="amount" type="number" min="1" value="${g.amount || (g.modo === 'material' ? 1 : 10)}" style="width:70px">`) +
          `<p class="ajuda">${g.modo === 'material' ? 'Units drawn at random from the materials the party carries (never below zero).' : 'The gold stops at zero. To charge a price, put the requirement “The party has gold” on this trigger.'}</p>`; break; }
      const modo = ['random', 'gold', 'newitem'].includes(g.modo) ? g.modo : 'item';
      const temMat = (projeto.itensPool || []).some(id => ITENS_B().find(i => i.id === id)?.cls === 'CraftingMaterialModel'), temItem = (projeto.itensPool || []).some(id => ITENS_B().find(i => i.id === id)?.cls !== 'CraftingMaterialModel');
      html = acao + campo('What', `<select data-k="modo"><option value="item" ${modo === 'item' ? 'selected' : ''}>An item (pick it)</option><option value="newitem" ${modo === 'newitem' ? 'selected' : ''}>A random item from the item pool</option><option value="random" ${modo === 'random' ? 'selected' : ''}>Random materials from the item pool (worth N loot points)</option><option value="gold" ${modo === 'gold' ? 'selected' : ''}>Gold</option></select>`) +
      (modo === 'item' ? escolhaDeItem(g.item) :
       modo === 'random' ? campo('Loot points', `<input data-k="points" type="number" min="1" value="${g.points || 10}" style="width:70px">`) + (temMat ? '' : `<div class="alertaPool"><b>The item pool has no materials.</b> This trigger draws its materials from the item pool. Add crafting materials to it. Without them, the game uses one of its own loot kinds. <button class="sm" data-poolitens>Open the item pool</button></div>`) + `<p class="ajuda">Materials of the item pool (Map setup) are drawn until they add up to these points (each unit is worth its value: base materials 5, essences 25 to 30).</p>` :
       modo === 'newitem' ? campo('How many', `<input data-k="amount" type="number" min="1" value="${g.amount || 1}" style="width:70px">`) + (temItem ? '' : `<div class="alertaPool"><b>The item pool has no items.</b> This trigger draws from the item pool. Add items to it. Without them, the game draws from the items not yet discovered. <button class="sm" data-poolitens>Open the item pool</button></div>`) + `<p class="ajuda">The game draws it from the item pool of the map (“Map setup”). Each item comes out once at most, and only items the party lacks.</p>` :
       campo('Gold', `<input data-k="amount" type="number" min="1" value="${g.amount || 10}" style="width:70px">`)); break; }
    case 'campaign_var': html = camposVarCampanha(g); break;
    case 'unlock_map': { const alvos = mapasParaLiberar(); const n = noDoDesbloqueio(g);
      html = alvos.length ? campo('Map', `<select data-k="no"><option value="">— pick —</option>${alvos.map(a => `<option value="${a.id}" ${n && n.id === a.id ? 'selected' : ''}>${esc(rotuloDoNo(a) + (nomeDoNo(a) !== rotuloDoNo(a) ? ' · ' + nomeDoNo(a) : ''))}</option>`).join('')}</select>`) + `<p class="ajuda">That map stays hidden from the world map until this trigger runs. Then it appears as soon as the cards before it in the story flow are completed. <button class="sm" data-campanha="1">Campaign screen</button></p>`
        : `<p class="ajuda">${campanha ? 'The campaign has no other map yet: add one in the story flow.' : 'This map is not in a campaign yet.'}</p>${campanha ? '<button class="sm" data-campanha="1">Campaign screen</button>' : ''}`; break; }
    case 'mission': html = campo('Objective text', `<input data-k="text" value="${esc(g.text || '')}" placeholder="What the players must do, as shown in the objectives">`) +
        campo('Completed when', `<select data-k="como"><option value="defeat_room" ${g.como === 'defeat_room' ? 'selected' : ''}>Monsters are defeated</option><option value="use_object" ${g.como === 'use_object' ? 'selected' : ''}>An object is used (click it)</option><option value="counter" ${g.como === 'counter' ? 'selected' : ''}>A counter reaches a number</option><option value="table" ${!g.como || g.como === 'table' ? 'selected' : ''}>Declared at the table</option></select>`) +
        (g.como === 'defeat_room' ? campo('Of the room', `<select data-k="salaAlvo">${projeto.salas.map((r, ri) => `<option value="${ri}" ${(g.salaAlvo ?? si) === ri ? 'selected' : ''}>${ri + 1} · ${esc(r.nome)}${ri === si ? ' (this room)' : ''}</option>`).join('')}</select>`) + '<p class="ajuda">The heroes must defeat every monster of that room: the ones placed in it and the ones its triggers bring.</p>' : '') +
        (g.como === 'counter' ? camposContador(g, 'meta') : '') +
        (!g.como || g.como === 'table' ? '<p class="ajuda aviso">Declared at the table: the app only shows the objective text among the objectives and checks nothing by itself. It counts as completed when the table marks it in the Bigorna panel of the game (F8 → “Optional completed”); only then the requirement “An objective was completed” holds and, if it was chosen as the mission, the map ends.</p>' : '') +
        (g.como === 'use_object' ? `<p>Object: <b>${g.objIndex !== undefined ? esc(rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {})) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the object</button></p>` : '') +
        `<p class="ajuda">${projeto.meta.finalMission?.tipo === 'trigger' && projeto.meta.finalMission.uid === g.uid ? '<b>This objective is the mission of the map: completing it ends the map.</b>' : 'An objective does not end the map. To make it the mission, pick it in Map setup → Final mission → “An objective added by a trigger”.'}</p>`; break;
    case 'text': html = campo('Text', `<textarea data-k="text" rows="3">${esc(g.text || '')}</textarea>`); break;
    case 'counter': html = camposContador(g, 'conta'); break;
    case 'skill_test': html = campo('Text', `<textarea data-k="text" rows="2" placeholder="What the heroes attempt">${esc(g.text || '')}</textarea>`) + campo('Successes needed', `<input data-k="successes" type="number" min="1" max="9" value="${g.successes || 2}" style="width:70px">`) +
      `<label class="chk"><input type="checkbox" data-k="secret" ${g.secret ? 'checked' : ''}> Secret test (the players are not told how many successes they need)</label>` +
      `<label class="chk"><input type="checkbox" data-k="cumulativo" ${g.cumulativo ? 'checked' : ''}> Successes add up over tries (a lock, a heavy door: each try brings them closer)</label>` +
      `<p class="ajuda">As in the game. An open test says how many successes are needed, and the players say at the table whether they passed or failed. A secret test, or one that adds up, asks how many successes they rolled. As a guide: 1 success is easy, 2 standard, 3 hard, 4 or more extreme.</p>` +
      `<div class="resultado ok"><div class="sub">If they succeed <button class="sm" data-res="ok">+ Add</button> ${chipExtra(donoDe(s, oi), 'ok:' + g.uid)}</div>` + campo('Text', `<textarea data-k="ok" rows="2" placeholder="Shown on success (optional)">${esc(g.ok || '')}</textarea>`) + `<div data-lres="ok"></div></div>` +
      `<div class="resultado fail"><div class="sub">If they fail <button class="sm" data-res="fail">+ Add</button> ${chipExtra(donoDe(s, oi), 'fail:' + g.uid)}</div>` + campo('Text', `<textarea data-k="fail" rows="2" placeholder="Shown on failure (optional)">${esc(g.fail || '')}</textarea>`) + `<div data-lres="fail"></div></div>`; break;
    case 'spawn': { const lista = g.fonte !== 'pool'; const um = (g.inimigos || [])[0]; const escolhido = g.inimigoEscolhido || um?.enemy || MONSTROS()[0]?.id || '';
      html = campo('Monsters', `<select data-k="fonte"><option value="pool" ${!lista ? 'selected' : ''}>From the spawn pool of this room (balanced)</option><option value="list" ${lista ? 'selected' : ''}>One enemy from the workshop</option></select>`) +
      (!lista ? `<div class="sub">Spawn pool of this room</div><div class="poolDoGatilho"></div><p class="ajuda">${poolDaSala(si).length ? 'The game draws from the lit monsters. Click a monster to light it or dim it. This is the pool of the room itself, the same one as in the room panel, so a change here shows there too.' : '<b>The pool is empty: light at least one monster above.</b>'}</p><p>Spaces: <b>${esc((g.cells || []).map(c => c.slice(0, 2).join(',')).join('; ') || 'none yet')}</b></p><button class="sm" id="g_por">Click the spaces where they appear</button>${(g.cells || []).length ? '<button class="sm" id="g_limpa" style="margin-left:6px">Clear</button>' : ''}` +
        ((g.cells || []).length ? `<p class="ajuda">The spaces work together, by the game's rule for random spawns: one budget of points for all of them (intensity ÷ 10 × heroes × 1.5 × progression, Map setup › Balancing) decides how many monsters enter and how strong. All may enter, or just one strong monster.</p>` +
          campo('Intensity', `<select data-k="intensidade">${Array.from({ length: 10 }, (_, k) => k + 1).map(n => `<option value="${n}" ${intensidadeDoGatilho(g) === n ? 'selected' : ''}>${n}${n === g.cells.length && !g.intensidade ? ' (= spaces, default)' : ''}</option>`).join('')}</select>`) +
          tabelaBalanceio(g.cells.length, intensidadeDoGatilho(g), poolDaSala(si)) +
          `<div class="resultado grupo"><div class="sub">When the group is defeated <button class="sm" data-res="grupo">+ Add</button></div><p class="ajuda">Runs when the group this trigger brought is fully defeated, that is, when its last monster falls (however many the game chose). Each time the trigger brings a new group, it runs again.</p><div data-lres="grupo"></div></div>` : '')
        : !MONSTROS().length ? '<p class="ajuda">The workshop has no monsters: create or import them first (Workshop, top bar).</p>'
        : campo('Monster', `<select data-k="inimigoEscolhido" data-sem-render="1">${MONSTROS().map(m => `<option value="${m.id}" ${escolhido === m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>`) +
          `<p>Space: <b>${um ? um.pos.join(',') + ((g.inimigos || []).length > 1 ? ' (and ' + (g.inimigos.length - 1) + ' more, from an older version of this trigger)' : '') : 'none yet'}</b> <button class="sm" id="g_por">${um ? 'Click to move it' : 'Click where it appears'}</button></p>`); break; }
    case 'remove_enemy': html = campo('Target', `<select data-k="alvo"><option value="room" ${g.alvo === 'room' || !g.alvo ? 'selected' : ''}>Monsters of this room</option><option value="one" ${g.alvo === 'one' ? 'selected' : ''}>One specific monster…</option><option value="all" ${g.alvo === 'all' ? 'selected' : ''}>All monsters</option><option value="group" ${g.alvo === 'group' ? 'selected' : ''}>A spawn group…</option></select>` +
      (g.alvo === 'group' ? `<select data-k="grupo">${gruposDaMissao().map(x => `<option value="${x.id}" ${g.grupo === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('') || '<option value="">(no spawn groups yet)</option>'}</select>` : '')) +
      (g.alvo === 'one' ? `<p>Monster: <b>${inimigoRef(g.inimigo) ? esc(nomeIni(inimigoRef(g.inimigo).enemy)) + ' at ' + inimigoRef(g.inimigo).pos.join(',') : 'none yet'}</b> <button class="sm" id="g_alvo">Click it on the board</button></p><p class="ajuda">If it is not on the board when the trigger fires, nothing happens.</p>` : ''); break;
    case 'enemy_condition': html = campo('Action', `<select data-k="acao"><option value="heal" ${g.acao === 'heal' ? 'selected' : ''}>Heal</option><option value="damage" ${g.acao === 'damage' ? 'selected' : ''}>Damage</option><option value="apply" ${g.acao === 'apply' || !g.acao ? 'selected' : ''}>Apply a condition</option><option value="remove" ${g.acao === 'remove' ? 'selected' : ''}>Remove conditions</option><option value="mirar" ${g.acao === 'mirar' ? 'selected' : ''}>Target a protected one</option><option value="desmirar" ${g.acao === 'desmirar' ? 'selected' : ''}>Stop targeting a protected one</option></select>`) +
      (g.acao === 'mirar' || g.acao === 'desmirar' ? campo('Protected one (its name, as the token is called)', `<input data-k="nome" value="${esc(g.nome || '')}" placeholder="the protected one">`) : '') +
      (g.acao === 'mirar' ? campo('Chance each round', `<input data-k="chance" type="number" min="1" max="100" value="${g.chance ?? 25}" style="width:70px"> %`) + `<p class="ajuda">Each round, each of these monsters has this chance to pick the protected one as its target. With 100 it always does, like hunters drawn to it. Then the activation window shows its name in place of the hero, and the monster attacks it. The protected one is a token on the table. The players track its health and say when it falls. A rule for a spawn group counts before a rule for all.</p>` : '') +
      (g.acao === 'desmirar' ? '<p class="ajuda">Every monster goes back to the heroes the game picks. Use it when the protected one falls or leaves.</p>' : '') +
      ((g.acao === 'heal' || g.acao === 'damage') ? campo('Amount', `<input data-k="amount" type="number" min="1" value="${g.amount || 2}" style="width:70px">`) : '') + (g.acao === 'apply' ? campo('Condition', `<select data-k="condition">${CONDICOES.map(c => `<option ${g.condition === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`) : '') + (g.acao === 'desmirar' ? '' : campo('Target', alvos())); break;
    case 'move_heroes': html = `<p>Destination: <b>${(g.cells || []).length ? (g.cells.length === 1 ? 'space ' : g.cells.length + ' spaces: ') + g.cells.map(c => c.join(',')).join('; ') : 'none yet'}</b></p><button class="sm" id="g_alvo">Click the spaces where the heroes appear</button>${(g.cells || []).length ? ' <button class="sm" id="g_limpa">Clear</button>' : ''}` +
      campo('Text for the table (optional)', `<input data-k="text" value="${esc(g.text || '')}" placeholder="Move the heroes to the highlighted spaces.">`) +
      `<p class="ajuda">In the game these spaces light up and the table is told to move the heroes there (one hero per space), every time the trigger fires. The light goes out at the next round or the next move. For an object used many times, set “Can be used” above.</p>`; break;
    case 'add_object': html = campo('Kind', `<select data-k="objType">${OBJETOS.map(x => `<option value="${x.id}" ${(g.objType || 'Chest') === x.id ? 'selected' : ''}>${esc(nomeObj(x.id))}</option>`).join('')}</select>`) + `<p>Place: <b>${g.objIndex !== undefined ? 'space ' + (projeto.salas[g.objSala]?.objetos[g.objIndex]?.pos || []).join(',') : 'none yet'}</b> <button class="sm" id="g_alvo">${g.objIndex !== undefined ? 'Click to move it' : 'Click where it appears'}</button></p>` + (g.objIndex !== undefined ? '<p class="ajuda">The new object is on the board, faded. Select it to give it a name, texts and triggers.</p>' : ''); break;
    case 'remove_object': html = g.proprio ? `<p>Target: <b>this object itself</b> <button class="sm" id="g_alvo">Pick another object</button></p><p class="ajuda">Used, it leaves the board (like a point of interest in the game).</p>` : `<p>Target: <b>${g.objIndex !== undefined ? esc(rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {})) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the object</button></p>`; break;
    case 'remove_room': html = campo('Room', `<select data-k="sala"><option value="">— pick —</option>${projeto.salas.map((r, ri) => ri !== si ? `<option value="${ri}" ${g.sala === ri ? 'selected' : ''}>${ri + 1} · ${esc(r.nome)}</option>` : '').join('')}</select>`) + '<p class="ajuda">In the game, the room is removed before any new tile is placed. So you can use the freed tiles in the next room right away.</p>'; break;
    case 'add_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; html = `<p>Tile: <b>${p ? nomePeca(p.tile) + ' of room ' + (g.sala + 1) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the tile on the board</button></p><p class="ajuda">Everything placed on that tile enters with it.</p>`; break; }
    case 'scene': html = `<p><b>${(g.caixas || []).length} box(es)</b> <button class="sm primario" id="g_cena">✎ Write the scene…</button></p><ol class="cenaResumo">${ordemDaCena(g).slice(0, 6).map(c => `<li>${c.speaker ? '<b>' + esc(nomePersonagem(c.speaker)) + ':</b> ' : ''}${esc((c.text || '(empty)').slice(0, 60))}${c.type === 'choice' ? ' <small>(question, ' + (c.options || []).length + ' answers)</small>' : ''}</li>`).join('')}</ol>`; break;
    case 'rounds': html = `<div class="duas">` + campo('When', `<select data-k="modo"><option value="cada" ${g.modo !== 'uma' ? 'selected' : ''}>Every N rounds</option><option value="uma" ${g.modo === 'uma' ? 'selected' : ''}>Once, N rounds later</option></select>`) + campo('N', `<input type="number" min="1" data-k="n" value="${Math.max(1, +g.n || 2)}" style="width:70px">`) + `</div>` +
      (g.modo !== 'uma' ? campo('How many times', `<select data-k="vezes">${[0, 1, 2, 3, 4, 5, 6, 8, 10].map(v => `<option value="${v}" ${(+g.vezes || 0) === v ? 'selected' : ''}>${v ? v + ' time(s)' : 'To the end of the map'}</option>`).join('')}</select>`) : '') +
      `<p class="ajuda">${g.modo === 'uma' ? 'Counts from the round the object is used in: ' + Math.max(1, +g.n || 2) + ' round(s) later, at the start of that round, the triggers below run once.' : 'Counts from the round the object is used in: every ' + Math.max(1, +g.n || 2) + ' round(s) after it, at the start of the round, the triggers below run' + (+g.vezes ? ' (' + g.vezes + ' time(s) in all).' : ', until the map ends.')} Used again, the object starts the count over.</p>` +
      `<div class="resultado rodada"><div class="sub">When the rounds come <button class="sm" data-res="rodada">+ Add</button></div><div data-lres="rodada"></div></div>`; break;
    case 'remove_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca]; html = `<p>Tile: <b>${p ? nomePeca(p.tile) + ' of room ' + (g.sala + 1) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the tile on the board</button></p>
      <label class="chk"><input type="checkbox" data-k="manter" ${g.manter ? 'checked' : ''}> Keep what stands on it (objects, monsters)</label>
      <p class="ajuda">${g.manter ? 'Only the tile leaves. What stood on it stays in place, on top of what lies below. Below there should be an underlay: water, fetid water, embers or spikes, with the game’s own rules for that ground. So lay the tile wholly over an underlay. Example: a floor that gives way and leaves the heroes in the water.' : 'Everything on that tile goes with it.'}</p>`; break; }
    case 'move_object': { const ob = projeto.salas[g.objSala]?.objetos[g.objIndex], mk = projeto.salas[g.marcaSala]?.objetos[g.marcaIndex];
      html = `<p>Object: <b>${ob ? esc(rotulo(ob)) + ' (room ' + (g.objSala + 1) + ')' : 'none yet'}</b> <button class="sm" id="g_alvo">Click the object</button></p>
      <p>Marker (where it goes): <b>${mk ? nomeObj(mk.type) + ' at ' + mk.pos.join(',') + (mk.level ? ', level ' + mk.level : '') : g.cell ? 'space ' + g.cell.join(',') : 'none yet'}</b> <button class="sm" id="g_marca">Click the marker</button></p>
      <p class="ajuda">The marker is a second ${ob ? esc(nomeObj(ob.type)) : 'object of the same kind'}, laid where the object goes and turned as it should end. It does not come out in the setup of the room.</p>`; break; }
    case 'move_tile': { const p = projeto.salas[g.sala]?.pecas[g.peca], mk = projeto.salas[g.marcaSala]?.pecas[g.marcaPeca];
      html = `<p>Tile: <b>${p ? nomePeca(p.tile) + ' of room ' + (g.sala + 1) : 'none yet'}</b> <button class="sm" id="g_alvo">Click the tile on the board</button></p>
      <p>Marker (where it goes): <b>${mk ? nomePeca(mk.tile) + ' at ' + mk.pos.join(',') + (mk.level ? ', level ' + mk.level : '') : 'none yet'}</b> <button class="sm" id="g_marca">Click the marker</button></p>
      <p class="ajuda">The marker shows where the tile goes. To make it, lay the same tile a second time in that place: the warning about a tile already in the room offers “Move the tile”. The marker stays out of the setup of the room. Objects and pillars on the tile go with it. The players move the figures at the table.</p>`; break; }
    case 'shop': html = camposDaLoja(g); break;
    case 'armory': html = `<label class="chk"><input type="checkbox" data-k="armas" ${g.armas !== false ? 'checked' : ''}> Change weapons (those of the hero and the party’s rune weapons)</label>
      <label class="chk"><input type="checkbox" data-k="pecas" ${g.pecas !== false ? 'checked' : ''}> Change weapon parts (those the party owns, of the weapon’s class)</label>` + camposDeAbertura(g, 'armory'); break;
    case 'craft': html = `<div class="sub">What may be crafted</div>${TIPOS_FORJA.map(([k, n]) => `<label class="chk"><input type="checkbox" data-tipoforja="${k}" ${tiposDaForja(g).includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}
      <p class="ajuda">The party crafts only the recipes it already knows, with the materials it has. You give recipes with “Give or take away an item”, the shop or the loot.</p>` + camposDeAbertura(g, 'craft'); break;
    case 'end_map': html = campo('Result', `<select data-k="resultado"><option value="derrota" ${g.resultado !== 'vitoria' ? 'selected' : ''}>Defeat</option><option value="vitoria" ${g.resultado === 'vitoria' ? 'selected' : ''}>Victory</option></select>`); break;
    case 'escort': html = campo('Action', `<select data-k="acao"><option value="inicio" ${g.acao !== 'fim' ? 'selected' : ''}>Start</option><option value="fim" ${g.acao === 'fim' ? 'selected' : ''}>End</option></select>`) + (g.acao === 'fim' ? '' : campo('Name', `<input data-k="nome" value="${esc(g.nome || '')}">`) + campo('Chance (%)', `<input type="number" min="0" max="100" data-k="chance" value="${g.chance ?? 25}">`) + `<p class="ajuda">${(g.cacadores || []).length}${L2(' hunter group(s).', ' grupo(s) de caçadores.')}</p>`); break;
    case 'highlight': html = campo('Mode', `<select data-k="modo"><option value="object" ${g.modo !== 'space' ? 'selected' : ''}>Outline an object</option><option value="space" ${g.modo === 'space' ? 'selected' : ''}>Highlight a space</option></select>`) + `<p>Target: <b>${g.objIndex !== undefined ? esc(rotulo(projeto.salas[g.objSala]?.objetos[g.objIndex] || {})) : g.cell ? 'space ' + g.cell.join(',') : 'none yet'}</b> <button class="sm" id="g_alvo">Click the ${g.modo === 'space' ? 'space' : 'object'}</button></p>`; break;
    case 'choice': html = campo('Question', `<textarea data-k="text" rows="2">${esc(g.text || '')}</textarea>`) + '<div id="g_ops"></div><button class="sm" id="g_op">+ Answer</button>' +
      `<label class="chk"><input type="checkbox" data-k="umaVez" ${g.umaVez ? 'checked' : ''}> Each answer only once (a search: the answer chosen greys out, the others stay)</label>` +
      (g.umaVez ? campo('When every answer was used', `<input data-k="vazio" value="${esc(g.vazio || '')}" placeholder="Nothing more to do here.">`) + '<p class="ajuda">The object needs one use per answer, so “Can be used” is set to the number of answers.</p>' : ''); break;
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
      if (inp.type === 'checkbox') g[k] = inp.checked; else if (inp.type === 'number' || inp.dataset.num) g[k] = +inp.value || 0; else if (k === 'sala' || k === 'salaAlvo') g[k] = inp.value === '' ? undefined : +inp.value; else g[k] = inp.value;
      if (k === 'alvo' && g.alvo === 'group' && !g.grupo) g.grupo = gruposDaMissao()[0]?.id;   // the list shows the first group as chosen
      // a search: one use of the object per answer
      // a test whose successes add up: the object can be tried again until it is done
      if (g.tipo === 'skill_test' && k === 'cumulativo') { const dono = donoDe(s, oi); if (dono && !dono.enemy && g.cumulativo && !dono.usos) { dono.usos = 'always'; aviso('“' + rotulo(dono) + '” can now be used every time (change it in “Can be used”).'); } renderPropriedades(); return; }
      if (g.tipo === 'choice' && k === 'umaVez') { const dono = donosDaSala(s).map(x => x.o).find(x => !x.enemy && todosGatilhos(x).includes(g)); const n = String((g.options || []).filter(x => x.text).length || 3);
        if (dono && g.umaVez && dono.usos !== 'always') { dono.usos = n; aviso('“' + rotulo(dono) + '” can now be used ' + n + ' times, one per answer.'); } renderPropriedades(); return; }
      if (['modo', 'alvo', 'acao', 'como', 'secret', 'fonte', 'desde', 'manter'].includes(k) || ((g.tipo === 'counter' || g.tipo === 'campaign_var') && g.acao === 'use' && k === 'n') || (inp.tagName === 'SELECT' && !inp.dataset.semRender)) renderPropriedades(); else renderGatilhosSoResumo(); renderConferencia();
    };
    if (inp.tagName === 'TEXTAREA' || (inp.tagName === 'INPUT' && inp.type !== 'checkbox' && inp.type !== 'number')) inp.oninput = h; else inp.onchange = h;
  });
  el.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { salaAtual = +b.dataset.ir; sel = null; tudo(); });
  if (g.tipo === 'cutscene') campoVideo(el.querySelector('#g_video'), g, () => { renderGatilhosSoResumo(); renderConferencia(); });
  if (g.tipo === 'shop') ligarLoja(el, g);
  el.querySelectorAll('[data-tipoforja]').forEach(c => c.onchange = () => { const k = new Set(tiposDaForja(g)); if (c.checked) k.add(c.dataset.tipoforja); else k.delete(c.dataset.tipoforja); g.tipos = TIPOS_FORJA.map(([x]) => x).filter(x => k.has(x)); renderGatilhosSoResumo(); renderConferencia(); });
  if (g.tipo === 'counter' || g.tipo === 'campaign_var') {
    const tx = el.querySelector('[data-cont-tx]'), pv = el.querySelector('[data-prev-cont]'); const pinta = () => { if (pv) pv.innerHTML = g.tipo === 'counter' ? previaContador(g) : previaVarCampanha(g); };
    if (tx) { tx.addEventListener('input', pinta); el.querySelector('[data-k="contador"]')?.addEventListener('input', pinta); el.querySelector('[data-k="nome"]')?.addEventListener('change', pinta); el.querySelector('[data-k="n"]')?.addEventListener('change', pinta); }
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
  // the marker of a move: a second object of the same kind, or the same tile laid again
  const bm = el.querySelector('#g_marca'); if (bm) bm.onclick = () => {
    if (g.tipo === 'move_object') { const ob = projeto.salas[g.objSala]?.objetos[g.objIndex]; if (!ob) return aviso('Click the object first.');
      pedirClique({ modo: 'object', g, si, texto: 'Click the marker: a second ' + nomeObj(ob.type) + ', where the object goes.', cb: (x, y, q) => { if (!q || q.tipo !== 'objeto') return aviso('Click an object.'), false;
        const mk = projeto.salas[q.sala].objetos[q.i]; if (mk === ob) return aviso('Click a second object, not the one that moves.'), false; if (baseObj(mk.type) !== baseObj(ob.type)) return aviso('The marker must be a ' + nomeObj(ob.type) + ' too.'), false;
        g.marcaSala = q.sala; g.marcaIndex = q.i; delete g.cell; return true; } }); }
    else if (g.tipo === 'move_tile') { const p = projeto.salas[g.sala]?.pecas[g.peca]; if (!p) return aviso('Click the tile first.');
      pedirClique({ modo: 'object', g, si, texto: 'Click the marker: the same tile laid again, where it goes.', cb: (x, y, q) => { const c = candidatosEm(x, y, true).find(z => z.tipo === 'peca' && !(z.sala === g.sala && z.i === g.peca)); if (!c) return aviso('Click the marker tile.'), false;
        const mk = projeto.salas[c.sala].pecas[c.i]; if (numeroDaPeca(mk.tile) !== numeroDaPeca(p.tile)) return aviso('The marker must be tile ' + numeroDaPeca(p.tile) + ' too.'), false; g.marcaSala = c.sala; g.marcaPeca = c.i; return true; } }); }
  };
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
    else if (g.tipo === 'move_object') pedirClique({ modo: 'object', g, si, texto: 'Click the object to move.', cb: (x, y, q) => { if (!q || q.tipo !== 'objeto') return aviso('Click an object.'), false; if (ehMarca('objeto', q.sala, q.i)) return aviso('That one is a marker: click the object itself.'), false; g.objSala = q.sala; g.objIndex = q.i; return true; } });
    else if (g.tipo === 'move_tile') pedirClique({ modo: 'object', g, si, texto: 'Click the tile to move (any room).', cb: (x, y, q) => { const c = candidatosEm(x, y, true).find(z => z.tipo === 'peca' && !ehMarca('peca', z.sala, z.i)); if (!c) return aviso('Click a tile (not its marker).'), false; g.sala = c.sala; g.peca = c.i; return true; } });
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
  if (g.tipo === 'skill_test' || g.tipo === 'rounds' || ((g.tipo === 'counter' || g.tipo === 'campaign_var') && g.acao === 'use') || (g.tipo === 'spawn' && g.fonte === 'pool')) {
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
    else if (r.tipo === 'choice') campos = campanha ? htmlCondicao(r.nome ? r : null, 'rq_' + (g.uid || 'g') + '_' + ri, 'Only if', true) + `<p class="ajuda">${esc(tr('Played on its own, out of the campaign, the map counts every variable as at the start of the campaign.'))}</p>` : `<span class="ajuda">Only in a campaign: start one (top bar) and remember answers in its scenes.</span>`;
    else if (r.tipo === 'gold') campos = `at least <input data-k="amount" type="number" min="1" value="${r.amount || 30}" style="width:70px"> gold`;
    else if (r.tipo === 'object_used') campos = `<b>${projeto.salas[r.sala]?.objetos[r.objeto] ? esc(rotulo(projeto.salas[r.sala].objetos[r.objeto])) : 'none yet'}</b> <button class="sm" data-clique>Click the object</button>`;
    d.innerHTML = `<div class="cab"><b>${esc(TIPOS_REQUISITO.find(t => t.id === r.tipo)?.nome || r.tipo)}</b><button class="sm" data-x title="Remove">✕</button></div><div class="corpo">${campos}</div>`;
    d.querySelector('[data-x]').onclick = () => { o.requisitos.splice(ri, 1); if (!o.requisitos.length) { const dono = donoDe(s, oi); if (dono && !(dono['senao:' + g.uid] || []).length) delete dono['senao:' + g.uid]; } tudo(); };
    d.querySelectorAll('[data-k]').forEach(inp => inp.onchange = () => { r[inp.dataset.k] = inp.dataset.k === 'sala' || inp.type === 'number' ? +inp.value : inp.value.trim(); renderConferencia(); });
    if (r.tipo === 'choice' && campanha) ligarCondicao(d, 'rq_' + (g.uid || 'g') + '_' + ri, () => r.nome ? r : null, c => { const cc = c && JSON.parse(JSON.stringify(c)); ['nome', 'sim', 'op', 'n', 'outra', 'entre'].forEach(k => delete r[k]); if (cc) Object.assign(r, cc, { tipo: 'choice' }); }, leve => { renderConferencia(); if (!leve) renderPropriedades(); });
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
/* v376: the kinds of a group of the catalogue, «the shop, the armory, the crafting»: the whole list as the dictionary has it,
   or each kind translated on its own */
function listaDoGrupo(ms) {
  const en = ms.map(([, r]) => r.split(' (')[0].toLowerCase()).join(', '), t = tr(en);
  return t !== en ? t : ms.map(([, r]) => tr(r.split(' (')[0]).toLowerCase()).join(', ');
}
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
    opcoes.push(ms.length > 1 ? { id: gr.id, titulo: gr.nome, sub: tr(gr.expl) } : { id: ms[0][0], titulo: GATILHO[ms[0][0]].nome, sub: explDe(ms[0][0], o) });
  });
  const titulo = o.ehContador ? 'When “' + o.nome + '” reaches ' + metaDoContador(o) : (resultado || (lista === 'senao' ? 'When the requirement fails: ' : o.ehGrupo ? 'When the balanced group is defeated: ' : o.enemy ? 'When this monster is defeated: ' : 'Add a trigger to ')) + '“' + rotulo(o) + '”';
  const escolher = id => adicionarGatilho(s, oi, id, id === 'mission' ? 'internal' : undefined, lista);
  escolherOpcao(titulo, opcoes, id => {
    const gr = GRUPOS_GATILHO.find(x => x.id === id); if (!gr) return escolher(id);
    const membros = (r, tit) => escolherOpcao(r.pergunta + ' · ' + tit, r.membros.filter(([m]) => ids.has(m)).map(([m, rt]) => ({ id: m, titulo: rt, sub: explDe(m, o) })), escolher);
    if (!gr.ramos) return membros(gr, titulo);
    const ramos = gr.ramos.filter(r => r.membros.some(([m]) => ids.has(m)));
    if (ramos.length === 1) return membros(ramos[0], titulo);
    escolherOpcao(gr.pergunta + ' · ' + titulo, ramos.map(r => ({ id: r.id, titulo: r.nome, sub: tr(r.expl) + ' (' + r.membros.filter(([m]) => ids.has(m)).map(([, rt]) => tr(rt.split(' (')[0]).toLowerCase()).join(', ') + ')' })), rid => membros(ramos.find(r => r.id === rid), titulo));
  }, o.ehContador ? 'What happens once, when the count reaches ' + metaDoContador(o) + '. Several triggers run in order.' : lista === 'senao' ? 'Runs instead of the triggers when a requirement is not met.' : o.enemy ? 'What happens when this monster is defeated. These triggers run after the game’s own effects (loot, objectives), from top to bottom, every time it is defeated.' : 'What happens when a hero uses this object. Several triggers run in order.');
}
function adicionarGatilho(s, oi, tipo, modo, lista) {
  const o = donoDe(s, oi); const si = sel.sala; lista = lista || 'gatilhos';
  const g = { uid: uid(), tipo };
  const gs = o[lista] || (o[lista] = []);
  // (in the default of a copy, in the Workshop: the room is made when the piece is placed, like the game's doors)
  if (tipo === 'open_room' && EDITANDO_PADRAO) { g.sala = ''; g.requisitos = []; gs.push(g); gatAberto = chaveDe(o, lista, gs.length - 1); tudo(); return; }
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
    if (!alvos.length) { tudo(); return avisoLongo(campanha ? 'The campaign has only this map so far. Add another one in the story flow (Campaign screen), then come back and pick it here.' : 'This map needs a campaign first. Start one in the top bar, add the other maps to the story flow, then pick one of them here.'); }
    escolherOpcao('Which map does “' + rotulo(o) + '” unlock?', alvos.map(n => ({ id: n.id, titulo: rotuloDoNo(n) + (nomeDoNo(n) !== rotuloDoNo(n) ? ' · ' + nomeDoNo(n) : ''), sub: 'Locked until this trigger runs' })), id => { g.no = id; tudo(); });
    tudo(); return;
  }
  if (tipo === 'campaign_var') { const vs = campanha ? escolhasDaCampanha() : []; g.nome = vs.find(ehNumero) || vs[0] || ''; g.acao = g.nome && ehNumero(g.nome) ? 'add' : 'set'; g.n = 1; g.texto = ''; }
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
  if (tipo === 'shop') { g.fontes = ['cidade']; g.itens = []; g.preco = 100; g.precoVenda = 100; g.vender = true; g.maxCompras = 0; g.usos = 0; }
  if (tipo === 'armory') { g.armas = true; g.pecas = true; g.usos = 0; }
  if (tipo === 'craft') { g.tipos = TIPOS_FORJA.map(([k]) => k); g.usos = 0; }
  // the shop and the armory may be visited again: the object stays usable (the trigger says how many times it opens)
  if ((tipo === 'shop' || tipo === 'armory' || tipo === 'craft') && !o.enemy && !o.ehContador && !o.usos && !ehTipo(o, 'Door') && !ehTipo(o, 'Gate') && lista === 'gatilhos') { o.usos = 'always'; aviso('“' + rotulo(o) + '” can now be used every time (change it in “Can be used”); the trigger says how many times the ' + ({ shop: 'shop', armory: 'armory', craft: 'crafting' })[tipo] + ' opens.'); }
  if (tipo === 'move_heroes') { g.cells = []; if (!o.enemy && !o.ehContador && !o.usos && !ehTipo(o, 'Door') && !ehTipo(o, 'Gate')) { o.usos = 'always'; aviso('“' + rotulo(o) + '” can now be used every time (change it in “Can be used”).'); } }
  gs.push(g); gatAberto = chaveDe(o, lista, gs.length - 1); tudo();
  if (tipo === 'scene') abrirCenaDoGatilho(g, () => tudo());
}

// ------------------------------------------------------------ reusing a tile that is already in another room
/* a tile already on the table while room si is open, with no copy of it left in the boxes (two boxes: two of each) */
function pecaReutilizada(num, si) {
  let fora = new Set(); try { limparAbridores(); fora = removidosAntes(si).salas; } catch { }
  const mk = marcasDoMapa(); const marca = (ri, pi) => mk.pecas.has(ri + ':' + pi);   // (a marker is the same physical tile: it does not count)
  const usos = []; projeto.salas.forEach((s, ri) => { if (ri === si || fora.has(ri) || s._previa) return; s.pecas.forEach((q, pi) => { if (!ehAlfombra(q.tile) && numeroDaPeca(q.tile) === num && !marca(ri, pi)) usos.push({ sala: ri, peca: pi }); }); });
  const nesta = (projeto.salas[si]?.pecas || []).filter((q, pi) => !ehAlfombra(q.tile) && numeroDaPeca(q.tile) === num && !marca(si, pi)).length;
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
    <button class="op" data-o="tile"><b>Remove only that tile</b><small>“Remove a tile” trigger: tile ${nomePeca(p.tile)} of room ${reuso.sala + 1} and everything on it.</small></button>
    <button class="op" data-o="tileSo"><b>Remove only that tile, keeping objects and monsters</b><small>“Remove a tile” trigger (keeping what stands on it): tile ${nomePeca(p.tile)} of room ${reuso.sala + 1} leaves; what stood on it stays, on whatever lies below (an underlay).</small></button>${nota('Remove only that tile. The earlier room stays on the table, without this tile. When a hero opens this room, the game takes the tile off the board, with whatever stands on it, and the tile is then laid here. Choose this when the party may still walk through the earlier room.')}
    <div class="op estatico"><b>Remove whole rooms</b><small>“Remove a room” trigger for each room ticked:</small><div id="ru_salas">${projeto.salas.map((s, i) => i !== si ? `<label class="chk"><input type="checkbox" data-s="${i}" ${i === reuso.sala ? 'checked' : ''}> ${i + 1} · ${esc(s.nome)}</label>` : '').join('')}</div><button class="sm" data-o="rooms">Remove the ticked rooms</button>${nota('Remove whole rooms. When a hero opens this room, the game clears each ticked room off the board, with its tiles, objects and monsters. All their tiles go back to the box, free for the rooms ahead. Choose this when the party leaves those rooms behind for good.')}</div>
    ${nota('Cancel leaves everything as it was: pick another tile in the palette.')}<div class="rodape"><button data-o="cancel">Cancel</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="cancel"]').onclick = fechar;
    el.querySelector('[data-o="tile"]').onclick = () => { alvo.gatilhos.unshift({ uid: uid(), tipo: 'remove_tile', sala: reuso.sala, peca: reuso.peca }); fechar(); por(); aviso('Trigger added to “' + rotulo(alvo) + '”: removes tile ' + nomePeca(p.tile) + ' when this room opens.'); };
    el.querySelector('[data-o="tileSo"]').onclick = () => { alvo.gatilhos.unshift({ uid: uid(), tipo: 'remove_tile', sala: reuso.sala, peca: reuso.peca, manter: true }); fechar(); por(); aviso('Trigger added to “' + rotulo(alvo) + '”: removes only tile ' + nomePeca(p.tile) + ' (what stands on it stays) when this room opens.'); };
    el.querySelector('[data-o="rooms"]').onclick = () => { const salas = [...el.querySelectorAll('[data-s]:checked')].map(c => +c.dataset.s); if (!salas.length) return aviso('Tick at least one room.'); salas.forEach(ri => alvo.gatilhos.unshift({ uid: uid(), tipo: 'remove_room', sala: ri })); fechar(); por(); aviso('Trigger(s) added to “' + rotulo(alvo) + '”: removes room ' + salas.map(x => x + 1).join(', ') + ' when this room opens.'); };
  });
}
/* the same tile laid again in its own room: it can only be the marker of where that tile moves to. "Move the tile" lays it
   as the marker and asks for the object whose use moves it ("Move a tile" trigger, added at once) */
function avisarMovimento(si, original, p) {
  const s = projeto.salas[si]; const q = s.pecas[original];
  modal('Tile ' + nomePeca(q.tile) + ' is already in this room', `<p class="ajuda">Each physical tile exists only once. Laid again here, it becomes a marker: it shows where that tile moves to during play. A “Move a tile” trigger then takes the tile, with what stands on it, to this place. The marker stays out of the setup of the room.</p>
    <button class="op" data-o="mover"><b>Move the tile</b><small>Lays this one as the marker; then click the object whose use moves the tile.</small></button>
    <div class="rodape"><button data-o="cancel">Cancel</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="cancel"]').onclick = fechar;
    el.querySelector('[data-o="mover"]').onclick = () => { fechar();
      s.pecas.push(p); const mi = s.pecas.length - 1; tudo();
      pedirClique({ modo: 'object', si, texto: 'Click the object whose use moves tile ' + nomePeca(q.tile) + ' (Esc cancels: the marker goes away).', cb: (x, y, c) => {
        if (!c || c.tipo !== 'objeto') return aviso('Click an object.'), false;
        const o = projeto.salas[c.sala].objetos[c.i]; o.gatilhos = o.gatilhos || [];
        o.gatilhos.push({ uid: uid(), tipo: 'move_tile', sala: si, peca: original, marcaSala: si, marcaPeca: mi, requisitos: [] });
        ferramenta = null; aviso('Trigger added to “' + rotulo(o) + '”: moves tile ' + nomePeca(q.tile) + ' to its marker.'); tudo(); return true; },
        aoTerminar: () => { if (s.pecas[mi] === p && !ehMarca('peca', si, mi)) { s.pecas.splice(mi, 1); tudo(); } } });
    };
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
const CONSEQ_CONTADOR = new Set(['shop', 'armory', 'craft', 'end_map', 'escort', 'move_object', 'move_tile', 'give_item', 'text', 'counter', 'mission', 'unlock_map', 'campaign_var', 'remove_room', 'remove_tile', 'add_tile', 'remove_enemy', 'remove_object', 'enemy_condition', 'move_heroes', 'add_object', 'highlight', 'cutscene', 'scene', 'sound', 'reserve', 'item_pool']);
/* the number the counter's objective and consequence wait for (chosen in the phrase "completed when the count reaches …"),
   never above the counter's limit; without one chosen: what the "add" triggers add up to */
const limiteDoContador = c => Math.max(0, +(c && c.limite) || 0);
const metaDoContador = c => { const l = limiteDoContador(c); const m = +c.meta > 0 ? +c.meta : Math.max(1, totalAutomatico(c.nome)); return l ? Math.min(l, m) : m; };
/* the choice of that number: 1 up to the limit (without a limit, up to 30 or the number already chosen) */
const seletorMetaContador = (c, attr) => { const l = limiteDoContador(c), m = metaDoContador(c); const fim = l || Math.max(30, m); return `<select ${attr} title="${esc(tr('The number the objective and the consequence wait for'))}">${Array.from({ length: fim }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === m ? 'selected' : ''}>${n}</option>`).join('')}</select>`; };
/* the objective of a counter left without a text of its own: it goes into the exported file, in the language of the work */
const textoMissaoContador = c => { const n = metaDoContador(c); return c.conta === 'rodadas' ? LE2('Hold out for ' + n + ' rounds.', 'Resistam por ' + n + ' rodadas.')
  : c.conta === 'monstros' ? LE2('Defeat ' + n + ' monsters', 'Derrotem ' + n + ' monstros') + (c.monstro ? ' (' + nomeIni(c.monstro) + ')' : '') + '.'
  : c.nome + LE2(': reach ' + n + '.', ': cheguem a ' + n + '.'); };
/* a counter counts by the triggers (Add / subtract / use a count), or by itself: monsters defeated (any, or one kind) or rounds passed */
const CONTA_CONTADOR = { '': 'Triggers', monstros: 'Monsters defeated', rodadas: 'Rounds passed' };
const textoContaAuto = c => c.conta === 'monstros' ? '+1 per ' + (c.monstro ? nomeIni(c.monstro) : 'monster') + ' defeated' : c.conta === 'rodadas' ? '+1 per round passed' : '';
function novoContador(nome) { const c = { id: uid(), nome, ehContador: true, gatilhos: [] }; projeto.contadores = projeto.contadores || []; projeto.contadores.push(c); return c; }
/* the map mission of a counter: listed with the objectives and completed when the count reaches its total */
function htmlMissaoContador(c) {
  const m = c.missao;
  return `<div class="linha fraseMeta"><label class="chk"><input type="checkbox" data-cm="on" ${m ? 'checked' : ''}> ${esc(tr('An objective of the map: completed when the count reaches'))}</label> ${seletorMetaContador(c, 'data-cm="meta"')}</div>` + (m ? `
    <label class="campo">Objective text <input data-cm="texto" value="${esc(m.texto || '')}" placeholder="${esc(textoMissaoContador(c))}"></label>
    <label class="campo">Listed <select data-cm="quando"><option value="start" ${m.quando !== 'first' ? 'selected' : ''}>From the start of the map</option><option value="first" ${m.quando === 'first' ? 'selected' : ''}>When the count first changes (announced then)</option></select></label>` : '');
}
function ligarMissaoContador(el, c, depois) {
  el.querySelectorAll('[data-cm]').forEach(inp => {
    const k = inp.dataset.cm;
    const h = () => { if (k === 'on') { c.missao = inp.checked ? { uid: 'cm' + uid(), texto: '', quando: 'start' } : undefined; depois(); return; } if (k === 'meta') { c.meta = +inp.value; depois(); renderConferencia(); return; } c.missao[k] = inp.value; if (k === 'quando') depois(); renderConferencia(); };
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
  el.innerHTML = `<p class="ajuda">${+c.inicio > 0 ? esc(tr('Starts at')) + ' ' + (+c.inicio) : esc(tr('Starts at 0'))}${limiteDoContador(c) ? '; ' + esc(tr('limit')) + ' ' + limiteDoContador(c) : ''}${c.conta ? '; ' + esc(textoContaAuto(c)) : ''}. <button class="sm" id="c_contas">Counts…</button></p>
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
    return `<div class="contador" data-c="${i}"><div class="linha"><input data-cn="${i}" value="${esc(c.nome)}" title="Rename: every trigger and requirement that uses it follows"><label class="campo" style="margin:0" title="${esc(tr('The count never goes above this number. Empty: no limit. It always starts at 0.'))}">${esc(tr('Limit'))} <input data-cl="${i}" type="number" min="0" value="${limiteDoContador(c) || ''}" placeholder="${esc(tr('none'))}" style="width:64px"></label><button class="sm" data-cx="${i}" title="${us.length ? 'Used by ' + us.length + ' trigger(s) or requirement(s): they lose the counter' : 'Delete'}">✕</button></div>
      <div class="linha contaLinha"><label class="campo" style="margin:0;flex:0 0 auto" title="Triggers: only the “Add / subtract / use a count” triggers change it. Monsters defeated or rounds passed: it also adds 1 by itself">Counts <select data-cc2="${i}">${Object.entries(CONTA_CONTADOR).map(([k, t]) => `<option value="${k}" ${(c.conta || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${c.conta === 'monstros' ? botaoMonstroDoContador(c, i) : ''}</div>
      <div class="usos"><span class="rotuloTx">Changed by</span> ${c.conta ? `<span class="ajuda contaAuto">${esc(textoContaAuto(c))}</span>` : ''}${muda.map(chip).join('') || (c.conta ? '' : '<span class="ajuda">nothing yet: give an object (or a monster) an “Add / subtract / use a count” trigger, or make it count monsters defeated or rounds passed</span>')}</div>
      <div class="usos"><span class="rotuloTx">Map objective</span> <div class="missaoCont" data-mc="${i}">${htmlMissaoContador(c)}</div>${missoes.map(chip).join('')}</div>
      ${requer.length ? `<div class="usos"><span class="rotuloTx">Required / used by</span> ${requer.map(chip).join('')}</div>` : ''}
      <div class="usos"><span class="rotuloTx">Consequence</span> ${(c.gatilhos || []).map((g, gi) => `<span class="chipCons"><button class="sm consCont" data-cc="${i}" data-gi="${gi}" title="${esc(tr('Open it to change it'))}">✎ ${esc(tr(GATILHO[g.tipo]?.nome || g.tipo))} <small>${esc(resumoGatilho(g))}</small></button><button class="sm" data-ccx="${i}:${gi}" title="${esc(tr('Remove'))}">✕</button></span>`).join('')}<button class="sm primario" data-cadd="${i}" title="What happens once, when the count reaches ${metaDoContador(c)}">+ Trigger</button></div></div>
      ${campanha && variaveisNumero().length ? `<div class="usos"><span class="rotuloTx">${esc(tr('To the campaign'))}</span> <select data-cpo="${i}"><option value="">${esc(tr('— nothing —'))}</option><option value="add" ${c.campanha?.op === 'add' ? 'selected' : ''}>${esc(tr('When the map is won, add the count to'))}</option><option value="set" ${c.campanha?.op === 'set' ? 'selected' : ''}>${esc(tr('When the map is won, set to the count'))}</option></select>${c.campanha ? `<select data-cpv="${i}"><option value="">${esc(tr('— pick —'))}</option>${variaveisNumero().map(v => `<option value="${esc(v)}" ${c.campanha.nome === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : ''}</div>` : ''}`; }).join('');
  janelaFlutuante('janelaContadores', 'Counts of the map', `<p class="ajuda">A counter keeps a number during the map: keys found, levers pulled, seals broken… It lives only in the app, outside the inventory. Triggers add to it or take from it. A count starts at 0 and stops at its limit, if it has one. When it reaches the number its objective waits for, the map objective is completed and its consequence runs once. A counter can also count by itself the monsters defeated or the rounds passed.</p>
    ${linhas || '<p class="ajuda">No counter yet.</p>'}
    <div class="linha" style="margin-top:10px"><input id="cn_novo" placeholder="New counter (Keys, Levers, Seals…)"><button class="sm primario" id="cn_mais">+ New counter</button></div>`, (el, fechar) => {
    const volta = () => { abrirContadores(); renderFaixa(); renderPropriedades(); };
    el.querySelectorAll('[data-cn]').forEach(inp => inp.onchange = () => { const c = projeto.contadores[+inp.dataset.cn]; const novo = inp.value.trim(); if (!novo) { inp.value = c.nome; return; } if (novo !== c.nome && projeto.contadores.some(x => x.nome === novo)) { aviso('There is already a counter called ' + novo + '.'); inp.value = c.nome; return; } renomearContador(c.nome, novo); volta(); });
    el.querySelectorAll('[data-cc2]').forEach(sl => sl.onchange = () => { const c = projeto.contadores[+sl.dataset.cc2]; if (sl.value) c.conta = sl.value; else delete c.conta; if (c.conta !== 'monstros') delete c.monstro; renderConferencia(); volta(); });
    el.querySelectorAll('[data-cmo]').forEach(b => b.onclick = () => { const c = projeto.contadores[+b.dataset.cmo]; escolherMonstroDoContador(c, () => { renderConferencia(); volta(); }); });
    el.querySelectorAll('[data-cl]').forEach(inp => inp.onchange = () => { const c = projeto.contadores[+inp.dataset.cl]; const l = Math.max(0, +inp.value || 0); if (l) c.limite = l; else delete c.limite; if (l && +c.meta > l) c.meta = l; renderConferencia(); volta(); });
    el.querySelectorAll('[data-ccx]').forEach(b => b.onclick = () => { const [i, gi] = b.dataset.ccx.split(':').map(Number); const c = projeto.contadores[i]; const g = c.gatilhos[gi];
      if (!confirm(tr('Remove this consequence?') + ' ' + (GATILHO[g.tipo]?.nome || g.tipo))) return; c.gatilhos.splice(gi, 1); Object.keys(c).filter(k => k.endsWith(':' + g.uid)).forEach(k => delete c[k]); renderConferencia(); renderPropriedades(); volta(); });
    el.querySelectorAll('[data-mc]').forEach(d => ligarMissaoContador(d, projeto.contadores[+d.dataset.mc], volta));
    el.querySelectorAll('[data-cpo]').forEach(sl => sl.onchange = () => { const c = projeto.contadores[+sl.dataset.cpo]; if (!sl.value) delete c.campanha; else c.campanha = { op: sl.value, nome: c.campanha?.nome || variaveisNumero()[0] || '' }; volta(); });
    el.querySelectorAll('[data-cpv]').forEach(sl => sl.onchange = () => { const c = projeto.contadores[+sl.dataset.cpv]; c.campanha.nome = sl.value; volta(); });
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
/* the monsters a counter counts: a window with every monster of the Workshop (yours too), by their pictures */
function botaoMonstroDoContador(c, i) { const m = c.monstro && MONSTROS().find(x => x.id === c.monstro); const r = m ? retratoDoMonstro(m) : '';
  return `<button class="sm escolhaMonstroCont" data-cmo="${i}" title="${esc(tr('Which monsters count'))}">${r ? `<img loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : ''}${esc(m ? m.nome : c.monstro ? tr('? (no longer in the workshop)') : tr('Any monster'))} ▾</button>`; }
function escolherMonstroDoContador(c, depois) {
  const ms = MONSTROS();
  modal(tr('Which monsters count'), `<p class="ajuda">${esc(tr('Every monster of the Workshop counts, the game’s and yours. Each defeat of one of them adds 1.'))}</p><div class="grade escolhaItem"><div class="item ${!c.monstro ? 'marcado' : ''}" data-mm=""><span class="vazio"></span><div>${esc(tr('Any monster'))}</div></div>${ms.map(m => { const r = retratoDoMonstro(m); return `<div class="item ${c.monstro === m.id ? 'marcado' : ''}" data-mm="${esc(m.id)}">${r ? `<img loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="vazio"></span>'}<div data-sem-traducao>${esc(m.nome)}<small>${esc(m.base ? tr('from the game') : tr('custom'))}</small></div></div>`; }).join('')}</div>${ms.length ? '' : `<p class="ajuda">${esc(tr('The workshop has no monsters: import or create them first.'))}</p>`}`, (el, fechar) => {
    el.querySelectorAll('[data-mm]').forEach(d => d.onclick = () => { if (d.dataset.mm) c.monstro = d.dataset.mm; else delete c.monstro; fechar(); depois(); });
  }, true);
}
const TEXTO_CONTADOR = (t => ({ add: t('You found a [count] ([n] of [total]).'), sub: t('You lost a [count] ([n] of [total]).'), set: t('[count]: [n] of [total].') }))(OUTRA_LINGUA ? TRADZ : tr);   // default messages, in the editor's language
const VAGAS_CONTADOR = { count: 'the name of the counter, highlighted', n: 'the count after this trigger', total: 'the number the counter’s objective waits for (Counts button)' };
function totalDoContador(nome) {
  const c = (projeto.contadores || []).find(x => x.nome === nome); if (c) return metaDoContador(c);
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
    <p class="ajuda">[count] is the name of the counter (highlighted like the rule words of the game), [n] the count after this trigger, [total] the number its objective waits for (Counts button). Missions and requirements can wait for the counter to reach a number (“A counter reaches a number”).</p>`;
}

/* v377: “Add / subtract / use a campaign variable”, built like the counter's trigger: the variable, the action (add, take away,
   set, add another variable, or use: the triggers inside run when it reaches a number) and a message to the players. A yes/no
   variable is marked as chosen or not, or used when it is chosen */
const VAGAS_VAR = { variable: 'the name of the variable, highlighted', n: 'its value after this trigger' };
const varDaCampanhaNoMapa = nome => 'campaign:' + varEscolha(nome);
function textoVarParaJogo(g) { return (g.texto || '').replace(/\[variable\]/gi, '<style=Term>' + (g.nome || '?') + '</style>').replace(/\[n\]/gi, '{#' + varDaCampanhaNoMapa(g.nome) + '}'); }
function previaVarCampanha(g) {
  if (!g.texto) return `<span class="ajuda">${esc(tr('(no message: the players do not see the change)'))}</span>`;
  const chip = (t, dica) => `<span class="vagaTx" title="${esc(dica)}">${esc(t)}</span>`;
  return '<div class="rotuloTx">In the app:</div>' + esc(g.texto).replace(/\[variable\]/gi, `<b class="termoTx">${esc(g.nome || '?')}</b>`).replace(/\[n\]/gi, chip('n', tr(VAGAS_VAR.n)));
}
function camposVarCampanha(g) {
  if (!campanha) return `<p class="ajuda">${esc(tr('Only in a campaign: start one (top bar) and create its story variables.'))}</p>`;
  const vs = escolhasDaCampanha();
  if (!vs.length) return `<p class="ajuda aviso">${esc(tr('The campaign has no story variable yet: create one with the Story variables button of the campaign screen.'))}</p><button class="sm" data-campanha="1">Campaign screen</button>`;
  const num = !g.nome || ehNumero(g.nome); const outras = variaveisNumero().filter(x => x !== g.nome);
  if (!num && !['set', 'use'].includes(g.acao)) g.acao = 'set'; if (num && !g.acao) g.acao = 'add';
  const nome = `<label class="campo">${esc(tr('Variable'))} <select data-k="nome"><option value="">${esc(tr('— pick —'))}</option>${vs.map(v => `<option value="${esc(v)}" ${g.nome === v ? 'selected' : ''}>${esc(v)}${ehNumero(v) ? '' : ' (' + esc(tr('yes or no')) + ')'}</option>`).join('')}</select></label>`;
  const op = (v, t) => `<option value="${v}" ${(g.acao || (num ? 'add' : 'set')) === v ? 'selected' : ''}>${esc(tr(t))}</option>`;
  const acao = `<label class="campo">Action <select data-k="acao">${num ? op('add', 'Add') + op('sub', 'Take away') + op('set', 'Set to') + (outras.length || g.acao === 'addvar' ? op('addvar', 'Add another variable') : '') + op('use', 'Use: when it reaches') : op('set', 'Mark it as') + op('use', 'Use: when it is chosen')}</select></label>`;
  if (g.acao === 'use') { const n = num ? Math.max(1, +g.n || 1) : 1; if (!num) g.n = 1;
    return nome + `<div class="duas">${acao}${num ? `<label class="campo">Number <input data-k="n" type="number" min="1" value="${n}" style="width:70px"></label>` : ''}</div>
    <label class="campo">Watching from <select data-k="desde"><option value="inicio" ${g.desde !== 'uso' ? 'selected' : ''}>The start of the map</option><option value="uso" ${g.desde === 'uso' ? 'selected' : ''}>When this trigger runs</option></select></label>
    <p class="ajuda">${esc(tr(g.desde === 'uso' ? 'Armed when this trigger runs: the triggers below run once, as soon as the variable is at the number or more (at once, if it already is).' : 'From the start of the map: the triggers below run once, as soon as the variable is at the number or more (at the start, if it already is). The object does not need to be used.'))}</p>
    <div class="resultado conta"><div class="sub">${esc(tr(num ? 'When “' + (g.nome || '?') + '” reaches ' + n : 'When “' + (g.nome || '?') + '” is chosen'))} <button class="sm" data-res="conta">+ Add</button></div><div data-lres="conta"></div></div>
    <p class="ajuda">${esc(tr('Played on its own, out of the campaign, the map counts every variable as at the start of the campaign.'))}</p>`; }
  const qto = !num ? `<label class="campo">${esc(tr('Mark it as'))} <select data-k="n"><option value="1" ${+(g.n ?? 1) ? 'selected' : ''}>${esc(tr('Chosen (yes)'))}</option><option value="0" ${+(g.n ?? 1) ? '' : 'selected'}>${esc(tr('Not chosen (no)'))}</option></select></label>`
    : g.acao === 'addvar' ? `<label class="campo">${esc(tr('Variable'))} <select data-k="outra"><option value="">${esc(tr('— pick —'))}</option>${outras.map(v => `<option value="${esc(v)}" ${g.outra === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`
    : `<label class="campo">Amount <input data-k="n" type="number" min="0" value="${Math.max(0, +(g.n ?? 1) || 0)}" style="width:70px"></label>`;
  return nome + `<div class="duas">${acao}${qto}</div>
    <label class="campo">Message to the players (optional) <input data-k="texto" data-cont-tx value="${esc(g.texto || '')}" placeholder="${esc(tr('Empty: the players do not see the change'))}"></label>
    <div class="barraTx"><span>Insert:</span>${Object.entries(VAGAS_VAR).map(([k, x]) => `<button class="sm fichaTx" data-ins-cont="[${k}]" title="${esc(tr(x))}">${k}</button>`).join('')}</div>
    <div class="previaTx" data-prev-cont>${previaVarCampanha(g)}</div>
    <p class="ajuda">${esc(tr(num ? 'Never below 0 nor above the maximum of the variable. It stays for the next maps; played on its own, out of the campaign, the map changes nothing.' : 'It stays for the next maps; played on its own, out of the campaign, the map changes nothing.'))}</p>`;
}

// ------------------------------------------------------------ "Open the shop" / "Open the armory"
/* g.fontes: where the stock comes from ('cidade': the campaign's shop, as in the city; 'lista': g.itens [{item, qtd}] (qtd 0:
   no end); 'pool': the item pool of the map). g.preco / g.precoVenda: % of the game's prices (selling: 75% of the value, as in
   the game). g.vender: the party may sell crafting materials. g.maxCompras: units per visit (0: no limit). g.usos: times it
   opens (0: every time); g.fechado: the text once it no longer opens. */
const FONTES_LOJA = [['cidade', 'The city’s shop', 'the campaign’s current stock. As in the game, what the party buys here leaves the city’s shop, and what it sells goes there'], ['lista', 'My list', 'items, consumables, recipes and materials you pick, with how many of each'], ['pool', 'The item pool of the map', 'what the item pool holds (“Map setup”): one of each item, ten of each material or consumable']];
/* "Open the crafting": g.tipos, the kinds of item that may be crafted (all, when new) */
const TIPOS_FORJA = [['armadura', 'Armor'], ['consumivel', 'Consumables'], ['adorno', 'Trinkets'], ['peca', 'Weapon parts']];
const tiposDaForja = g => (Array.isArray(g.tipos) ? g.tipos : TIPOS_FORJA.map(([k]) => k)).filter(k => TIPOS_FORJA.some(([x]) => x === k));
const fontesDaLoja = g => (Array.isArray(g.fontes) ? g.fontes : ['cidade']).filter(f => FONTES_LOJA.some(([k]) => k === f));
function camposDeAbertura(g, tipo) {
  const nome = ({ shop: 'shop', armory: 'armory', craft: 'crafting' })[tipo];
  return `<label class="campo">Opens <select data-k="usos" data-num="1">${[[0, 'Every time the trigger runs (no limit)'], [1, 'Once'], [2, 'Twice'], [3, 'Three times'], [5, 'Five times'], [10, 'Ten times']].map(([v, n]) => `<option value="${v}" ${(+g.usos || 0) === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`
    + (+g.usos ? `<label class="campo">Text once it no longer opens <input data-k="fechado" value="${esc(g.fechado || '')}" placeholder="${esc(({ shop: 'The shop has closed.', armory: 'The armory has closed.', craft: 'The crafting workshop has closed.' })[tipo])}"></label>` : '')
    + `<p class="ajuda">The ${nome} opens in its own window over the board; the next triggers run when it closes. ${tipo === 'armory' ? 'Heroes whose weapons this map sets (Workshop) keep them.' : 'To charge an entrance or limit who may enter, put a requirement on this trigger.'}</p>`;
}
function camposDaLoja(g) {
  const f = fontesDaLoja(g);
  const fontes = FONTES_LOJA.map(([k, n, sub]) => `<label class="chk" title="${esc(sub)}"><input type="checkbox" data-fonte="${k}" ${f.includes(k) ? 'checked' : ''}> ${esc(n)} <small>(${esc(sub)})</small></label>`).join('');
  const itens = (g.itens || []).map((x, i) => `<div class="linha itemLoja"><span>${esc(semGlifo(nomeItem(x.item)))}${itemDaOficina(x.item) ? '' : ' <small class="erro">not in the workshop!</small>'}</span><label class="sm">How many <input type="number" min="0" data-qtdloja="${i}" value="${+x.qtd || 0}" style="width:60px"></label><button class="sm" data-tiraloja="${i}" title="Remove">✕</button></div>`).join('');
  return `<div class="sub">Stock</div>${fontes}
    ${f.includes('lista') ? `<div class="listaLoja">${itens || '<p class="ajuda">No items in your list yet.</p>'}</div><button class="sm" data-poeloja>+ Item…</button><p class="ajuda">How many: 0 means no limit. What the party buys from your list stays sold, even at another visit of this map.</p>` : ''}
    ${f.includes('pool') && !(projeto.itensPool || []).length ? '<p class="ajuda erro">The item pool of the map is empty (Map setup).</p>' : ''}
    ${f.length ? '' : '<p class="ajuda erro">Pick at least one source of stock.</p>'}
    <div class="sub">Prices and limits</div>
    <div class="linha">${campo2('Buying prices (%)', `<input type="number" min="0" max="1000" data-k="preco" value="${g.preco ?? 100}" style="width:70px">`)}${campo2('Selling prices (%)', `<input type="number" min="0" max="1000" data-k="precoVenda" value="${g.precoVenda ?? 100}" style="width:70px">`)}</div>
    <p class="ajuda">100% means the game’s prices. The party sells for 75% of the value, as in the city.</p>
    <label class="chk"><input type="checkbox" data-k="vender" ${g.vender !== false ? 'checked' : ''}> The party may sell crafting materials</label>
    ${campo2('Purchases per visit (0 = no limit)', `<input type="number" min="0" data-k="maxCompras" value="${+g.maxCompras || 0}" style="width:70px">`)}
    ${camposDeAbertura(g, 'shop')}`;
}
const campo2 = (rot, html) => `<label class="campo">${rot} ${html}</label>`;
function ligarLoja(el, g) {
  el.querySelectorAll('[data-fonte]').forEach(c => c.onchange = () => { const f = new Set(fontesDaLoja(g)); if (c.checked) f.add(c.dataset.fonte); else f.delete(c.dataset.fonte); g.fontes = FONTES_LOJA.map(([k]) => k).filter(k => f.has(k)); if (c.checked && c.dataset.fonte === 'pool' && !(projeto.itensPool || []).length) aviso('The item pool of the map is empty: add items to it in Map setup.'); renderPropriedades(); renderConferencia(); });
  el.querySelectorAll('[data-qtdloja]').forEach(c => c.onchange = () => { const x = (g.itens || [])[+c.dataset.qtdloja]; if (x) x.qtd = Math.max(0, +c.value || 0); renderGatilhosSoResumo(); });
  el.querySelectorAll('[data-tiraloja]').forEach(b => b.onclick = () => { g.itens.splice(+b.dataset.tiraloja, 1); renderPropriedades(); renderConferencia(); });
  const pb = el.querySelector('[data-poeloja]'); if (pb) pb.onclick = () => abrirEscolhaDeItem(null, id => { g.itens = g.itens || []; const ja = g.itens.find(x => x.item === id); if (ja) ja.qtd = (+ja.qtd || 0) + 1; else g.itens.push({ item: id, qtd: 1 }); renderPropriedades(); renderConferencia(); });
}

// ------------------------------------------------------------ picking an item: a window with the items by kind, with their pictures
function escolhaDeItem(atual) {
  const img = atual ? imagemDoItemEscolhido(atual) : '';
  return `<div class="itemEscolhido">${img ? `<img loading="lazy" decoding="async" ${imgTardia(img)} alt="">` : '<span class="vazio"></span>'}<div><b>${atual ? esc(semGlifo(nomeItem(atual))) : 'No item yet'}</b>${atual && !itemDaOficina(atual) ? '<small class="erro">not in the workshop!</small>' : ''}</div><button class="sm" data-escolheitem>${atual ? 'Change…' : 'Pick the item…'}</button></div>`;
}
function imagemDoItemEscolhido(id) {
  const w = ITENS_B().find(i => i.id === id); if (w) return retratoDoItem(w);
  const r = runaDoItem(id); if (r) return figurasDaArma(armaPorId(r.id))[0] || '';
  const rc = receitaDoItem(id); if (rc) return itemAlvo(rc.item)?.img || '';
  return '';
}
function abrirEscolhaDeItem(atual, escolher, so = {}) {
  const grupos = [['Armor', ITENS_B().filter(i => i.cls === 'ArmorModel')], ['Consumables', ITENS_B().filter(i => i.cls === 'ConsumableModel')], ['Trinkets', ITENS_B().filter(i => i.cls === 'TrinketModel' || i.cls === 'TableItem')],
    ['Weapon parts', ITENS_B().filter(i => i.cls === 'WeaponPartsModel')], ['Materials', ITENS_B().filter(i => i.cls === 'CraftingMaterialModel')]].map(([n, xs]) => [n, xs.map(i => ({ id: i.id, nome: semGlifo(i.nome) + (/[\uE000-\uF8FF]/.test(i.nome || '') ? ' +' : ''), img: retratoDoItem(i), sub: i.cls === 'WeaponPartsModel' ? (i.classe || '') + ' · ' + (i.slot || '') : '' }))])
    .concat([['Runes of the workshop', (oficina().armas || []).filter(a => a.runa).map(a => ({ id: 'RUNA:' + a.id, nome: nomeItem('RUNA:' + a.id), img: imagemDoItemEscolhido('RUNA:' + a.id), sub: 'the weapon comes with it' }))],
      ['Recipes (the party learns them)', (oficina().receitas || []).map(r => ({ id: 'RECEITA:' + r.id, nome: nomeReceita(r), img: itemAlvo(r.item)?.img || '', sub: custoResumo(r) }))]]).filter(([n, xs]) => xs.length && !(so.soItens && /^(Runes|Recipes)/.test(n)));
  if (so.antes) grupos.unshift(...so.antes.filter(([n, xs]) => xs.length));
  if (!grupos.length) return aviso('The workshop has no items yet: import or create them in the Items tab.');
  modal(so.titulo || 'Pick the item', `<input id="ei_filtro" placeholder="filter…"><div id="ei_grupos"></div>`, (el, fechar) => {
    const pinta = f => { el.querySelector('#ei_grupos').innerHTML = grupos.map(([n, xs]) => { const v = xs.filter(x => !f || x.nome.toLowerCase().includes(f)); return v.length ? `<div class="sub">${esc(n)} <small>(${v.length})</small></div><div class="grade escolhaItem">${v.map(x => `<div class="item ${x.id === atual ? 'marcado' : ''}" data-ei="${esc(x.id)}">${x.img ? `<img loading="lazy" decoding="async" ${imgTardia(x.img)} alt="">` : '<span class="vazio"></span>'}<div>${esc(x.nome)}${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</div></div>`).join('')}</div>` : ''; }).join('') || '<p class="ajuda">Nothing matches.</p>';
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
    const opcoesDestino = (atual, eu) => `<option value="">End of the scene</option>${ordemDaCena(g).filter(c => c !== eu).map(c => `<option value="${c.id}" ${atual === c.id ? 'selected' : ''}>${L2('Box ', 'Caixa ')}${numDe(c)}${c.speaker ? ' · ' + esc(nomePersonagem(c.speaker)) : ''}: ${esc((c.text || '').slice(0, 30))}</option>`).join('')}`;
    const fluxo = () => {
      const f = el.querySelector('.cenaFluxo'); const ordem = ordemDaCena(g);
      f.innerHTML = ordem.map((c, i) => { const rosto = c.speaker ? retratoDoPersonagem(PERSONAGENS_B().find(p => p.id === c.speaker)) : '';
        const seta = c.type === 'choice' ? (c.options || []).map((o, k) => `<div class="cenaOp">${esc(o.text || L2('Answer ', 'Resposta ') + (k + 1))} → ${o.next && porId(o.next) ? L2('Box ', 'Caixa ') + numDe(porId(o.next)) : L2('end', 'fim')}</div>`).join('') : `<div class="cenaSeg">${c.next && porId(c.next) ? '↓ ' + L2('Box ', 'Caixa ') + numDe(porId(c.next)) : L2('■ end of the scene', '■ fim da cena')}</div>`;
        return `<div class="cenaCx ${c.id === selId ? 'ativo' : ''} ${c.type === 'choice' ? 'pergunta' : ''}" data-cx="${c.id}"><div class="cab">${rosto ? `<img loading="lazy" decoding="async" ${imgTardia(rosto)} alt="">` : '<span class="semRosto">✦</span>'}<b>${L2('Box ', 'Caixa ')}${i + 1}${c.id === (g.inicio || ordem[0]?.id) ? L2(' (first)', ' (primeira)') : ''}</b><small>${esc(c.speaker ? nomePersonagem(c.speaker) : 'Narrator')}${c.title ? ' · ' + esc(c.title) : ''}</small></div><p>${esc((c.text || '(no text yet)').slice(0, 140))}</p>${seta}</div>`; }).join('');
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
