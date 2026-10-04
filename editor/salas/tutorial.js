/* The tutorial of the first use, in the order Victor wrote it (29/09/2026). The first time the editor opens it asks: the
   tutorial, or "I know it all" (asked again, and ⚙ Settings can repeat it). The tutorial starts on an empty map with the
   Workshop, the generators, the campaign and the objects' default script locked, and opens the editor step by step:
   the first rooms by hand (tiles, heroes, a door with "Open a room"), a chest that gives items, the default script (a door
   that opens its room by itself), monsters (none yet: to the Workshop, import about ten), the room generator (a door with no
   script, one room to place), and at last the campaign, where everything unlocks and each part explains itself once. Leaving
   the campaign closes it with the map generator and the bug report of the game (F9).
   A small panel in a corner says the task at hand; windows (popups) mark the turns; what a step has not reached is locked
   (dimmed, not clickable) and what to do now glows. It never starts by itself under automation (the tests drive the editor).
   Kept in this browser: bigorna-tutorial. */
const CHAVE_TUTORIAL = 'bigorna-tutorial';
/* what the tutorial may lock (CSS selectors); ⚙ stays open (to skip or repeat), and so do the view controls */
const TRANCAVEIS = ['#btnOficina', '#btnNovaSala', '[data-f="peca"]', '[data-f="heroi"]', '[data-f="objeto"]', '[data-f="apagar"]', '[data-f="inimigo"]', '[data-f="pilar"]',
  '#m_nome', '#btnMapa', '#btnExportar', '#btnGerarSala', '#btnGerarMapa', '#btnCampanha', '#btnApagarTudo'];
const OCULTAVEIS = ['#btnGerarSala', '#btnGerarMapa', '#btnCampanha', '#btnOficina'];
const SO_PORTA = '#gradeObj .item:not([data-obj="Door"])', SO_BAU = '#gradeObj .item:not([data-obj="Chest"])';
/* the steps. libera: what it opens (with every step before it); tranca: what it locks besides, while it lasts; alvo: what
   glows; texto: the task in the corner panel; janela: [title, text] of the window at its start; feito: the task is done;
   padrao: the objects' default script held 'sim' / 'nao' (and hidden) / null (the user's box); gatilhos: the only triggers
   offered; ao: what the step does when it starts */
const PASSOS_TUTORIAL = [
  { id: 'sala', titulo: 'The starting room', texto: 'Every map starts with the starting room: it is the only room on the table when the map begins. Let’s put it down.', alvo: '#btnNovaSala', libera: ['#btnNovaSala'], padrao: 'nao', gatilhos: [],
    feito: () => projeto.salas.length >= 1 },
  { id: 'pecas', titulo: 'Tiles', texto: 'With Tile (T), pick a tile from the palette and click the board. R rotates it. Put down at least two. Remember: each physical tile can appear only once in a room.', alvo: '[data-f="peca"]', libera: ['[data-f="peca"]', '[data-f="apagar"]'], padrao: 'nao', gatilhos: [],
    feito: () => (projeto.salas[0]?.pecas || []).length >= 2 },
  { id: 'herois', titulo: 'Where the heroes start', texto: 'With Hero (H), click the squares where the heroes start: choose 2 to 4 squares in the starting room.', alvo: '[data-f="heroi"]', libera: ['[data-f="heroi"]'], padrao: 'nao', gatilhos: [],
    feito: () => (projeto.salas[0]?.herois || []).length >= 2 },
  { id: 'porta', titulo: 'The next room', texto: 'Rooms are born from an object. With Object (O), place a Door at the edge of the room. Select it, add the “Open a room” trigger, and choose a new room. It appears, ready for its tiles.', alvo: '[data-f="objeto"]', libera: ['[data-f="objeto"]'], tranca: [SO_PORTA], padrao: 'nao', gatilhos: ['open_room'], destaque: true,
    // (the arrow goes with the work: the Object button, the door in the palette, the door placed, the button of its triggers)
    agora: () => { const s0 = projeto.salas[0]; const di = s0 ? s0.objetos.findIndex(o => ehTipo(o, 'Door')) : -1;
      if (di < 0) return ferramenta === 'objeto' ? { alvo: '#gradeObj .item[data-obj="Door"]', rotulo: 'The door' } : { alvo: '[data-f="objeto"]' };
      if (!(sel && sel.tipo === 'objeto' && sel.sala === 0 && sel.i === di)) return { ponto: () => Tutorial.centroDoObjeto(0, di), rotulo: 'Click the door', extra: 'Select the door you placed: click it.' };
      return { alvo: '#o_add', rotulo: 'Add the trigger here', extra: 'In the panel of the door, press “+ Add” beside Triggers and choose “Open a room”.' }; },
    feito: () => projeto.salas.length >= 2 && projeto.salas[0].objetos.some(o => ehTipo(o, 'Door') && (o.gatilhos || []).some(g => g.tipo === 'open_room' && g.sala !== '' && g.sala != null)) },
  { id: 'pecas2', titulo: 'The tiles of the new room', texto: 'With Tile (T), lay at least two tiles in the new room. It is the active room now (highlighted in the list of rooms); another room becomes the active one with a click in the list, or a double click on the board.', alvo: '[data-f="peca"]', padrao: 'nao', gatilhos: [],
    janela: ['Nice work!', 'The first room is already tied to its door: when a hero opens it, the next room appears on the table. Now lay out the tiles of the new room: at least two.'],
    ao: () => { const k = Tutorial.salaDaPorta(); if (k != null) { salaAtual = k; nivel = 0; sel = null; } ferramenta = 'peca'; tudo(); },
    feito: () => { const k = Tutorial.salaDaPorta(); return k != null && (projeto.salas[k]?.pecas || []).length >= 2; } },
  { id: 'bau', titulo: 'A chest for the party', texto: 'Place a Chest (Object) in a room, select it and add the “Give or take away an item” trigger. Choose what it gives the party when it is opened.', alvo: '[data-f="objeto"]', tranca: [SO_BAU], padrao: 'nao', gatilhos: ['give_item'],
    janela: ['A chest for the party', 'Now let’s add a chest and make it hand out some items to the party. The other buttons and triggers can wait their turn.'],
    // (the step waits for what the chest gives: an item picked, or a draw from the item pool, or gold)
    agora: () => projeto.salas.some(s => s.objetos.some(o => ehTipo(o, 'Chest') && (o.gatilhos || []).some(g => g.tipo === 'give_item'))) ? { extra: 'Now choose what the chest gives: in its trigger, pick the item (or another option under “What”).' } : {},
    feito: () => projeto.salas.some(s => s.objetos.some(o => ehTipo(o, 'Chest') && (o.gatilhos || []).some(g => g.tipo === 'give_item' && g.acao !== 'remove' && (g.item || ['newitem', 'random', 'gold'].includes(g.modo))))) },
  { id: 'padrao', titulo: 'The default script', texto: 'With “Default script” ticked (it glows over the objects), place a new Door at the edge of a room.', alvo: 'label:has(#objPadrao)', reserva: '[data-f="objeto"]', destaque: true, tranca: [SO_PORTA], padrao: 'sim', gatilhos: [],
    janela: ['The default script', 'Look at the “Default script” box above the objects. With it, each object arrives with the behavior it has in the game: a chest gives items, a tree has three answers, and a door opens a new room. Place a door and see it in action.'],
    feito: () => projeto.salas.length >= Tutorial.marca('salas') + 1 },
  { id: 'pecas3', titulo: 'A brand-new room', texto: 'With Tile (T), lay at least two tiles in the new room (the active room now).', alvo: '[data-f="peca"]', padrao: 'nao', gatilhos: [],
    janela: ['A brand-new room', 'The door came with its script and has already created a new room tied to it. Lay out its tiles now: at least two.'],
    // (the new room: the last one when the step began)
    ao: () => { salaAtual = Tutorial.marca('salas') - 1; nivel = 0; sel = null; ferramenta = 'peca'; tudo(); },
    feito: () => (projeto.salas[Tutorial.marca('salas') - 1]?.pecas || []).length >= 2 },
  { id: 'monstros', titulo: 'Monsters', texto: 'Let’s put some monsters in a room: press Enemy (E).', alvo: '#pl_monstros', reserva: '[data-f="inimigo"]', libera: ['[data-f="inimigo"]'], padrao: null, gatilhos: null,
    janela: ['Monsters', 'Now for some monsters: the Enemy button is unlocked.'],
    feito: () => MONSTROS().length >= 10 || projeto.salas.some(s => (s.inimigos || []).length) },
  { id: 'importar', titulo: 'The monster workshop', texto: 'In the Workshop, press “Import…” and bring in about 10 monsters from the game for this map.', alvo: '#f_importar', libera: ['#btnOficina'], tranca: ['#abasF button:not([data-aba="monstros"])'], padrao: null, gatilhos: null,
    janela: ['Ops!', 'Oops, there are no monsters available yet. They come from the Workshop: “Import…” brings in monsters from your game, with filters for act, type, and size, while “+ Create” lets you make your own. Import about 10 monsters for this map.'],
    ao: () => { abrirFichas('monstros'); }, feito: () => MONSTROS().length >= 10 },
  { id: 'oficinas', titulo: 'The workshops', texto: 'Have a look around the other workshops if you like, then head back to Rooms (◂ Rooms).', alvo: '#fVoltar', libera: ['#btnOficina'], padrao: null, gatilhos: null,
    janela: ['The spawn pool', 'These monsters automatically go into the map’s spawn pool, and the game draws balanced groups for each room from it. So import only the monsters you actually want to fight. There is also a workshop for every part of the game: NPCs, items, weapons, recipes, feats, skills, heroes, tiles, and objects. They are all unlocked now. Have a look around.'],
    feito: () => $('#telaFichas').hidden },
  { id: 'porta2', titulo: 'A door with no script', texto: 'Untick “Default script” (it glows) and place a Door at the edge of a room. This time, it stays quiet and opens nothing by itself.', alvo: 'label:has(#objPadrao)', reserva: '[data-f="objeto"]', destaque: true, libera: ['#m_nome', '#btnMapa'], tranca: [SO_PORTA, '[data-f="peca"]', '[data-f="heroi"]', '[data-f="apagar"]', '[data-f="inimigo"]', '[data-f="pilar"]', '#btnOficina', '#m_nome', '#btnMapa'], padrao: null, gatilhos: [], semPadrao: true,
    janela: ['Rooms made for you', 'Besides building rooms by hand, the editor can build them for you: choose the object that will open the room, and the generator creates one with tiles, objects, and monsters according to your settings. The map name and Map setup are unlocked now too. First, we want a door with no script. A door with the default script would open a new room by itself, and that is not what we want here.'],
    ao: () => { ferramenta = 'objeto'; objetoEscolhido = 'Door'; tudo(); }, feito: () => Tutorial.portasSemScript() > Tutorial.marca('portas') },
  { id: 'gerar', titulo: 'Generate a room', texto: 'Press ✦ Generate room, then click the door you have just placed.', alvo: '#btnGerarSala', libera: ['#btnGerarSala'], padrao: null, gatilhos: null,
    janela: ['Generate a room', 'Now for the room generator. Press ✦ Generate room and click the door that will connect to the new room.'],
    feito: () => { const j = $('#janelaGerador'); return !!(j && !j.hidden); } },
  { id: 'posicionar', titulo: 'Place the room', texto: 'Press ✦ Generate in the window, move the room (drag, arrows, R) next to its door, then “Use this”.', alvo: '[data-usar]', reserva: '#gr_gerar', destaque: true, padrao: null, gatilhos: null, umCandidato: true,
    // ("Use this" waits until the room has moved or turned; meanwhile the arrow points at the room itself)
    agora: () => GER.previa == null ? { alvo: '#gr_gerar' } : Tutorial.previaMovida() ? { alvo: '[data-usar]' } : { ponto: Tutorial.centroDaPrevia(), rotulo: 'Drag me · R turns', tranca: ['[data-usar]'], extra: 'First move the room (drag it or use the arrows) or turn it (R). “Use this” becomes available as soon as the room has moved.' },
    janela: ['Where it goes', 'Generate a room. For this tutorial, one is enough (the generator usually offers three). Before placing it on the map, click the new room to move it and press R to turn it. Preferably, place it next to the door that will open it, although a room can be opened by any object and placed anywhere. Once it is where you want it, press “Use this”.'],
    ao: () => { const j = $('#janelaGerador'); if (j) { j.style.left = '8px'; j.style.top = '70px'; j.style.right = 'auto'; } }, feito: () => projeto.salas.length > Tutorial.marca('salas') && !projeto.salas.some(s => s._previa) },
  { id: 'campanha', titulo: 'The campaign', texto: 'Press “Start a campaign”: everything is unlocked from there.', alvo: '#btnCampanha', libera: ['#btnCampanha'], padrao: null, gatilhos: null,
    janela: ['Nice work!', 'You have built rooms by hand, programmed objects, brought in monsters, and generated a room. Now only the campaign remains: it connects maps on the world map, with scenes, choices, and rewards between them. Press “Start a campaign” and the rest of the editor opens up.'],
    feito: () => !$('#telaCampanha').hidden },
  { id: 'explorar', titulo: 'The campaign', texto: 'Explore the story flow, a scene (and its boxes), the starting inventory, and the story variables. Then go back to Rooms (◂ Rooms) to finish.', libera: TRANCAVEIS, padrao: null, gatilhos: null,
    feito: () => $('#telaCampanha').hidden }
];
/* the windows of the campaign, the first time each part opens during the tutorial */
const JANELAS_CAMPANHA = {
  fluxo: ['The story flow', 'The story flow shows the campaign as cards: maps, scenes, world-map travel, and choices, all linked by arrows. To make a link, drag from a card’s ● to another card. What happens after each map depends on those links and the story variables.'],
  caixas: ['Scenes', 'A scene is a sequence of boxes: who speaks, the text, the background picture, and questions whose answers can lead to different boxes. Double-click the background to add a box; then drag from a box’s ● to choose what comes next.'],
  inventario: ['Starting inventory', 'What a veteran party already has when the campaign starts: gold, items, weapon parts, and skills. The generators leave unique items the party already owns out of the loot.'],
  variaveis: ['Story variables', 'Here are the choices the campaign can remember (spared the prisoner, took the relic…). Use these memories to create story branches. For example: if the prisoner was spared, show answer 1 + a new item; otherwise, show answer 2.'],
  mundo: ['The world map', 'This is where the campaign’s maps take place. Drag the markers onto the world map and draw the roads the party travels between them.']
};
/* the windows of the tutorial asked by the editor (Tutorial.explicar): a tile laid again */
const JANELAS_EDITOR = {
  'pecas-reuso': ['Tiles are limited', 'The box contains one of each physical tile (its A and B sides are the same piece). So each tile can occupy only one place on the table at a time. This one is already in an earlier room; to place it here, the earlier copy has to come off the table first. The next window handles that for you: when a hero opens this room, the game removes the earlier tile. Each button in that window is explained there.'],
  'pecas-mesma-sala': ['Tiles are limited', 'The box contains one of each physical tile (its A and B sides are the same piece), and this room is already using this one. To place it somewhere else, remove the earlier one first (Erase, or select it and press Delete), or choose another tile from the palette.']
};
var Tutorial = (() => {
  let estado = null, painel = null, estilo = null, relogio = null, janelaAberta = false;
  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE_TUTORIAL) || 'null'); } catch { return null; } };
  const gravar = () => { try { localStorage.setItem(CHAVE_TUTORIAL, JSON.stringify(estado)); } catch { } };
  const passo = () => estado && !estado.feito ? PASSOS_TUTORIAL[estado.passo] : null;
  const liberados = () => new Set(PASSOS_TUTORIAL.slice(0, estado.passo + 1).flatMap(p => p.libera || []));
  const portasSemScript = () => projeto.salas.reduce((n, s) => n + s.objetos.filter(o => ehTipo(o, 'Door') && !todosGatilhos(o).length).length, 0);
  /* what the step points at right now: its own "agora" (a step that changes as the work goes), else its target on screen,
     else its fallback (the Object button while the default-script box is not on screen) */
  function mira(p) {
    let m = {}; try { m = (p.agora && p.agora()) || {}; } catch { }
    if (!m.alvo && !m.ponto) { const tem = sel => { try { return !!document.querySelector(sel); } catch { return false; } }; m.alvo = p.alvo && (tem(p.alvo) || !p.reserva) ? p.alvo : p.reserva; }
    return m;
  }
  const ESTILO_BRILHO = ' { outline: 3px solid #e0a458 !important; outline-offset: 2px; animation: tutBrilho 1.2s ease-in-out infinite; }\n@keyframes tutBrilho { 50% { outline-color: rgba(224,164,88,.25); } }\n';
  /* "call the attention": a flash over the screen when the step begins, the target pulsing and shaking in gold and fire, a
     big bouncing arrow with a label over it */
  const ESTILO_CHAMADA = ` { outline: 4px solid #ffe066 !important; outline-offset: 3px; border-radius: 6px; position: relative; z-index: 60; width: fit-content !important; transform-origin: center;
      box-shadow: 0 0 0 6px rgba(255,90,40,.95), 0 0 30px 14px rgba(255,210,60,.95), 0 0 70px 30px rgba(255,120,40,.55) !important;
      animation: tutChamada .8s ease-in-out infinite !important; }
    @keyframes tutChamada { 0%, 100% { transform: scale(1) rotate(0); filter: brightness(1.15); } 20% { transform: scale(1.14) rotate(-3deg); filter: brightness(1.7) saturate(1.6); }
      40% { transform: scale(1.2) rotate(3deg); filter: brightness(1.9) hue-rotate(-15deg); } 60% { transform: scale(1.14) rotate(-2deg); filter: brightness(1.6); } 80% { transform: scale(1.06) rotate(1deg); } }
    #tutSeta { position: fixed; z-index: 9500; pointer-events: none; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);
      font: 900 15px system-ui; color: #1f1300; text-shadow: none; animation: tutPulo .6s ease-in-out infinite alternate; }
    #tutSeta b { background: linear-gradient(90deg, #ffe066, #ff8a3d, #ffe066); background-size: 200% 100%; animation: tutFaixa 1s linear infinite; padding: 6px 12px; border-radius: 999px;
      box-shadow: 0 0 0 3px #1f1300, 0 0 24px 6px rgba(255,200,60,.9); white-space: nowrap; letter-spacing: .5px; text-transform: uppercase; }
    #tutSeta i { font-style: normal; font-size: 46px; line-height: 1; filter: drop-shadow(0 0 10px rgba(255,190,60,.95)) drop-shadow(0 3px 0 #1f1300); }
    @keyframes tutPulo { from { margin-top: -14px; } to { margin-top: 4px; } }
    @keyframes tutFaixa { to { background-position: -200% 0; } }
    #tutFlash { position: fixed; inset: 0; z-index: 9400; pointer-events: none; background: radial-gradient(circle, rgba(255,230,120,.55), rgba(255,120,40,.25) 60%, transparent 80%); animation: tutFlash 1.1s ease-out forwards; }
    @keyframes tutFlash { 0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; } }
`;
  let seta = null, setaRaf = 0, extraMostrado = '';
  function aplicar() {
    if (!estilo) { estilo = document.createElement('style'); estilo.id = 'tutEstilo'; document.head.appendChild(estilo); }
    const p = passo(); if (!p) { estilo.textContent = ''; mostrarSeta(null); return; }
    const m = mira(p);
    const lib = liberados(); const trancados = TRANCAVEIS.filter(s => !lib.has(s)).concat(p.tranca || [], m.tranca || []);
    // (the big tools, not yet opened, are not shown at all: Generate a room, Generate a map, Campaign, Workshop)
    const ocultos = trancados.filter(x => OCULTAVEIS.includes(x)), esmaecidos = trancados.filter(x => !OCULTAVEIS.includes(x));
    estilo.textContent = (esmaecidos.length ? esmaecidos.join(', ') + ' { pointer-events: none !important; opacity: .3 !important; filter: grayscale(1); }\n' : '')
      + (ocultos.length ? ocultos.join(', ') + ' { display: none !important; }\n' : '')
      + (p.padrao === 'nao' ? 'label:has(#objPadrao) { display: none !important; }\n' : '')
      + (m.alvo ? m.alvo + (p.destaque ? ESTILO_CHAMADA : ESTILO_BRILHO) : p.destaque ? ESTILO_CHAMADA.replace(/^[^@]*?\}\s*/, '') : '');
    // (the box shows what the step holds)
    const cx = document.getElementById('objPadrao'); if (cx && p.padrao) cx.checked = p.padrao === 'sim';
    mostrarSeta(p.destaque ? m : null);
  }
  /* the arrow over the target (an element, or a point of the board), following it while it moves */
  function mostrarSeta(m) {
    if (!m) { if (seta) { seta.remove(); seta = null; } cancelAnimationFrame(setaRaf); setaRaf = 0; return; }
    if (!seta) { seta = document.createElement('div'); seta.id = 'tutSeta'; document.body.appendChild(seta); }
    const rot = tr(m.rotulo || 'Right here!'); if (seta.dataset.r !== rot) { seta.dataset.r = rot; seta.innerHTML = `<b>${esc(rot)}</b><i>👇</i>`; }
    seta._m = m;
    if (!setaRaf) { const segue = () => { if (!seta) { setaRaf = 0; return; } const mm = seta._m; let x = null, y = null;
        if (mm.ponto) { try { const pt = typeof mm.ponto === 'function' ? mm.ponto() : Tutorial.centroDaPrevia(); if (pt) [x, y] = pt; } catch { } }
        else if (mm.alvo) { let el = null; try { el = [...document.querySelectorAll(mm.alvo)].find(e => e.getClientRects().length); } catch { } if (el) { const r = el.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top - 10; } }
        seta.style.display = x == null ? 'none' : ''; if (x != null) { seta.style.left = Math.max(60, Math.min(innerWidth - 60, x)) + 'px'; seta.style.top = Math.max(90, y) + 'px'; }
        setaRaf = requestAnimationFrame(segue); }; setaRaf = requestAnimationFrame(segue); }
  }
  function flash() { const f = document.createElement('div'); f.id = 'tutFlash'; document.body.appendChild(f); setTimeout(() => f.remove(), 1200); }
  /* the panel of the task at hand: at the bottom, in the middle; it can be dragged by its title bar anywhere (the place is
     kept; a new key, so a place kept when it stood at the left is forgotten) */
  const CHAVE_POS = 'bigorna-tutorial-pos2';
  const posGuardada = () => { try { return JSON.parse(localStorage.getItem(CHAVE_POS) || 'null'); } catch { return null; } };
  function posicionarPainel() {
    const g = posGuardada();
    if (g) { painel.style.left = Math.max(0, Math.min(innerWidth - 120, g.left)) + 'px'; painel.style.top = Math.max(0, Math.min(innerHeight - 60, g.top)) + 'px'; painel.style.bottom = 'auto'; painel.style.right = 'auto'; painel.style.transform = 'none'; }
    else { painel.style.left = '50%'; painel.style.transform = 'translateX(-50%)'; painel.style.bottom = '90px';   // (above the notices, which also stand at the bottom in the middle)
      painel.style.top = 'auto'; painel.style.right = 'auto'; }
  }
  function desenhar() {
    const p = passo(); if (!p) { if (painel) painel.hidden = true; return; }
    if (!painel) { painel = document.createElement('div'); painel.id = 'tutorial'; painel.setAttribute('role', 'dialog');
      painel.style.cssText = 'position:fixed;z-index:9000;max-width:380px;background:#1f2228;color:#e8e4dc;border:1px solid #e0a458;border-radius:10px;padding:0 14px 12px;box-shadow:0 6px 24px rgba(0,0,0,.45);font-size:13px;line-height:1.45';
      document.body.appendChild(painel); posicionarPainel(); }
    painel.hidden = false;
    let extra = ''; try { extra = (p.agora && p.agora() || {}).extra || ''; } catch { } extraMostrado = extra;
    painel.innerHTML = `<div data-tut="alca" title="${esc(tr('Drag to move this panel'))}" style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;cursor:move;user-select:none;padding:10px 0 2px;touch-action:none"><b style="color:#f3cf8f">⠿ ${esc(tr(p.titulo))}</b><small>${tr('Tutorial')} · ${estado.passo + 1} / ${PASSOS_TUTORIAL.length}</small></div>
      <p style="margin:6px 0 10px">${esc(tr(p.texto))}</p>${extra ? `<p style="margin:0 0 10px;color:#ffd27a"><b>${esc(tr(extra))}</b></p>` : ''}
      <div style="display:flex;gap:6px;justify-content:flex-end"><button data-tut="pular">${tr('Skip the tutorial')}</button></div>`;
    painel.querySelector('[data-tut="pular"]').onclick = () => { if (confirm(tr('Skip the tutorial? Everything unlocks now. If you change your mind, ⚙ Settings can run it again.'))) terminar(); };
    const alca = painel.querySelector('[data-tut="alca"]');
    alca.onpointerdown = ev => { if (ev.button !== 0) return; ev.preventDefault(); const r = painel.getBoundingClientRect(); const dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      alca.setPointerCapture(ev.pointerId);
      alca.onpointermove = e => { const left = Math.max(0, Math.min(innerWidth - r.width, e.clientX - dx)), top = Math.max(0, Math.min(innerHeight - 40, e.clientY - dy));
        painel.style.left = left + 'px'; painel.style.top = top + 'px'; painel.style.bottom = 'auto'; painel.style.right = 'auto'; painel.style.transform = 'none'; };
      alca.onpointerup = e => { alca.onpointermove = alca.onpointerup = null; try { alca.releasePointerCapture(e.pointerId); } catch { }
        const q = painel.getBoundingClientRect(); try { localStorage.setItem(CHAVE_POS, JSON.stringify({ left: Math.round(q.left), top: Math.round(q.top) })); } catch { } }; };
  }
  /* a window of the tutorial (one at a time) */
  function janela(titulo, texto, depois, botoes) {
    janelaAberta = true;
    modal(tr(titulo), `<p>${esc(tr(texto))}</p><div class="botoes" style="justify-content:flex-end;margin-top:10px">${(botoes || [['ok', 'OK']]).map(([id, t], i) => `<button data-b="${id}" class="${i === (botoes || [1]).length - 1 ? 'primario' : ''}">${esc(tr(t))}</button>`).join('')}</div>`, (el, fechar) => {
      const m = el.closest('.modal'); m.id = 'janelaTutorial'; m.onclick = null; m.style.zIndex = 9100;   // (only its buttons close it; over the task panel, which stands in the middle too)
      el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { fechar(); janelaAberta = false; depois && depois(b.dataset.b); });
      el.closest('.modal').querySelector('.fechar').onclick = () => { el.closest('.modal').remove(); janelaAberta = false; depois && depois('ok'); };
    });
  }
  function entrar() {
    const p = passo(); if (!p) return;
    estado.marcas = { salas: projeto.salas.length, portas: portasSemScript() }; gravar(); aplicar(); desenhar();
    // (a task already done moves on at once: a chest programmed before its step)
    let pronto = false; try { pronto = ['bau', 'importar'].includes(p.id) && p.feito(); } catch { }
    if (pronto) return avancar();
    const seguir = () => { try { p.ao && p.ao(); } catch { } aplicar(); if (p.destaque) flash(); };
    if (p.janela) janela(p.janela[0], p.janela[1], seguir); else seguir();
  }
  function avancar() { if (estado.passo >= PASSOS_TUTORIAL.length - 1) return terminar(true); estado.passo++; entrar(); }
  function terminar(fim) {
    const ja = estado && estado.feito; estado = { passo: PASSOS_TUTORIAL.length - 1, feito: true }; gravar(); aplicar(); desenhar();
    if (fim && !ja) janela('The map generator', 'Just like rooms, whole maps can be generated too. ✦ Generate map (experimental) builds a map with its story, objectives, and finale. It is still experimental, so feel free to try it and use it. To keep exploring the editor, follow the Hints in the left column: each one disappears after you try what it shows. Found a bug or have a suggestion? During the game, press F9 (“Report a problem”). Nothing is sent without your click. And if you want to revisit this tutorial, you can repeat it from ⚙ Settings.');
  }
  /* every half second: the task of the step, the windows of the campaign, the Enemy button with no monster */
  function conferir() {
    const p = passo(); if (!p || janelaAberta) return;
    aplicar();
    // Enemy with no monster in the Workshop: the palette offers "Open the Workshop"; the mouse over it (or a click) brings "oops"
    if (p.id === 'monstros' && !MONSTROS().length) { const b = document.getElementById('pl_monstros');
      if (b && !b._tut) { b._tut = true; const vai = ev => { if (ev && ev.type === 'click') { ev.stopImmediatePropagation(); ev.preventDefault(); } if (passo() && passo().id === 'monstros' && !janelaAberta) { estado.passo++; entrar(); } };
        b.addEventListener('mouseenter', vai); b.addEventListener('click', vai, true); } }
    if (p.id === 'explorar' && !$('#telaCampanha').hidden) {
      const partes = { fluxo: abaC === 'fluxo', mundo: abaC === 'mundo', caixas: abaC === 'caixas', inventario: !!($('#janelaInventario') && !$('#janelaInventario').hidden), variaveis: !!($('#janelaVariaveis') && !$('#janelaVariaveis').hidden) };
      const k = Object.keys(partes).find(k => partes[k] && !(estado.vistas || []).includes(k));
      if (k) { estado.vistas = (estado.vistas || []).concat([k]); gravar(); return janela(JANELAS_CAMPANHA[k][0], JANELAS_CAMPANHA[k][1]); }
    }
    if (p.id === 'posicionar') { const j = $('#janelaGerador'); if (j && !j.hidden && !j._tut) { j._tut = true; j.style.left = '8px'; j.style.top = '70px'; j.style.right = 'auto';
        // (the panel moves out of the generator's way, unless the user placed it)
        if (painel && !posGuardada()) { const a = j.getBoundingClientRect(), q = painel.getBoundingClientRect(); if (q.left < a.right && q.right > a.left) { painel.style.left = 'auto'; painel.style.right = '16px'; } } } }
    { let extra = ''; try { extra = (p.agora && p.agora() || {}).extra || ''; } catch { } if (extra !== extraMostrado) desenhar(); }
    let ok = false; try { ok = !!(p.feito && p.feito()); } catch { }
    if (ok) avancar();
  }
  /* the tutorial starts on an empty map (the work on screen goes into the quick save first) */
  function iniciar() {
    if (projeto.salas.length || campanha) { try { salvarRapido(); } catch { } }
    campanha = null; projeto = projetoNovo(); projeto.meta.author = typeof autorGuardado === 'function' ? autorGuardado() : ''; salaAtual = -1; sel = null; ferramenta = null;
    try { $('#telaFichas').hidden = true; } catch { } try { if (!$('#telaCampanha').hidden) fecharCampanha(); } catch { }
    tudo(); estado = { v: 2, passo: 0, feito: false }; entrar();
    if (!relogio) relogio = setInterval(conferir, 500);
  }
  /* the first question: the tutorial, or "I know it all" (sure? ⚙ can repeat it) */
  function perguntar() {
    janela('Welcome to Bigorna Rooms', 'This editor creates maps and campaigns for Descent: Legends of the Dark, played in-game through the Bigorna mod. Want a guided tour, or do you already know your way around?', r => {
      if (r === 'tutorial') return iniciar();
      janela('Are you sure about that?', 'The tutorial walks you through the editor step by step. If you ever want to revisit it, you can repeat it from ⚙ Settings.', r2 => { if (r2 === 'sim') { estado = { passo: PASSOS_TUTORIAL.length - 1, feito: true }; gravar(); } else perguntar(); }, [['nao', 'Back'], ['sim', 'Yes, skip it']]);
    }, [['sabe', 'I know my way around'], ['tutorial', 'Start the tutorial']]);
  }
  /* the first time: nothing of the editor kept in this browser yet (the language aside) */
  const primeiraVez = () => { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^bigorna-/.test(k) && k !== 'bigorna-idioma') return false; } } catch { } return true; };
  /* on opening: the question the first time (never under automation); a tutorial left half way goes on */
  function aoAbrir() { const e = ler(); if (e && (e.feito || e.v !== 2)) return;   // (v 2: the steps of this tutorial; an older one left half way is let go)
    if (!e) { if (!navigator.webdriver && primeiraVez()) perguntar(); return; }
    estado = e; aplicar(); desenhar(); if (!relogio) relogio = setInterval(conferir, 500); }
  /* an explanation the editor asks for at a moment of its own (a tile laid twice): once per tutorial, then what comes next */
  function explicar(chave, depois) {
    const J = JANELAS_EDITOR[chave]; if (!J || !estado || estado.feito || (estado.vistas || []).includes(chave)) return false;
    estado.vistas = (estado.vistas || []).concat([chave]); gravar(); janela(J[0], J[1], () => { try { depois && depois(); } catch { } }); return true;
  }
  /* the room of the generator on the board: where it is now, and whether it moved or turned since it appeared */
  let previaVista = null;
  const marcaDaPrevia = () => { const s = projeto.salas[GER.previa]; return s ? JSON.stringify(s.pecas.map(q => [q.pos, q.rot])) : ''; };
  function previaMovida() { if (GER.previa == null) { previaVista = null; return false; } const m = marcaDaPrevia();
    if (!previaVista || previaVista.c !== GER.previaDe) previaVista = { c: GER.previaDe, m, movida: false };
    if (m !== previaVista.m) previaVista.movida = true; return previaVista.movida; }
  function centroDaPrevia() { if (GER.previa == null) return null; const cs = [...chaoDaSala(GER.previa).keys()].map(k => k.split(',').map(Number)); if (!cs.length) return null;
    const x = cs.reduce((a, c) => a + c[0], 0) / cs.length + .5, y = cs.reduce((a, c) => a + c[1], 0) / cs.length + .5; const r = tela.getBoundingClientRect();
    return [r.left + vista.px + x * C * vista.zoom, r.top + vista.py + y * C * vista.zoom]; }   // (the middle of the room: the arrow points at what to drag)
  /* the middle of an object of room si on screen (the arrow points at it) */
  function centroDoObjeto(si, oi) { const o = projeto.salas[si]?.objetos[oi]; if (!o) return null; const cs = casasDoObjeto(o);
    const x = cs.reduce((a, c) => a + c[0], 0) / cs.length + .5, y = cs.reduce((a, c) => a + c[1], 0) / cs.length + .5; const r = tela.getBoundingClientRect();
    return [r.left + vista.px + x * C * vista.zoom, r.top + vista.py + y * C * vista.zoom]; }
  /* the room the door of the starting room opens (the step of the door made it) */
  function salaDaPorta() { const s0 = projeto.salas[0]; if (!s0) return null;
    for (const o of s0.objetos) { if (!ehTipo(o, 'Door')) continue; const g = (o.gatilhos || []).find(x => x.tipo === 'open_room' && x.sala !== '' && x.sala != null); if (g) return +g.sala; }
    return null; }
  const janelaAbertaAgora = () => janelaAberta;
  return { iniciar, perguntar, aoAbrir, conferir, terminar, explicar, previaMovida, centroDaPrevia, centroDoObjeto, salaDaPorta, janelaAberta: janelaAbertaAgora, estado: () => estado, ativo: () => !!estado && !estado.feito,
    marca: k => (estado && estado.marcas && estado.marcas[k]) || 0, portasSemScript,
    padrao: () => passo()?.padrao ?? null, gatilhos: () => passo()?.gatilhos ?? null, exigeSemPadrao: () => !!passo()?.semPadrao, umCandidato: () => !!passo()?.umCandidato };
})();
/* the hints of the tour: each part marks itself seen when it opens */
(() => {
  const marcando = (nome, chave) => { try { const f = eval(nome); if (typeof f !== 'function') return; const g = function (...a) { try { marcarVisto(typeof chave === 'function' ? chave(...a) : chave); } catch { } return f.apply(this, a); }; eval(nome + ' = g'); } catch { } };
  marcando('iniciarGerador', 'dica:gerarSala'); marcando('abrirGeradorMapa', 'dica:gerarMapa'); marcando('tabelaDaSimulacao', 'dica:simular'); marcando('abrirHistorias', 'dica:historias');
  marcando('abrirInventario', 'dica:inventario'); marcando('abrirVariaveis', 'dica:variaveis'); marcando('exportarPacote', 'dica:pacotes'); marcando('importarPacote', 'dica:pacotes');
  marcando('trocarAba', aba => 'dica:aba-' + aba); marcando('renderFichas', () => 'dica:oficina-' + abaF);
})();
/* the notes of the tutorial inside the editor's own windows */
(() => { const st = document.createElement('style'); st.textContent = '.tutNota { display: block; margin: 4px 0 8px; padding: 6px 8px; border-left: 3px solid #e0a458; background: rgba(224,164,88,.12); color: #f3cf8f; font-size: 12px; line-height: 1.4; white-space: normal; text-align: left; }'; document.head.appendChild(st); })();
Tutorial.aoAbrir();
