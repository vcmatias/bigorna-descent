/* Bigorna Rooms v2 — the Workshop: monsters, NPCs, items, tiles and objects of this map (or campaign), and the tabs of the
   other files (heroes: herois.js, weapons: armas.js, recipes: receitas.js, feats: facanhas.js, skills: pericias.js, stories:
   oficina_historias.js).
   Monsters, NPCs and items: only what is here can be used in the map. Entries are imported from the game (one by one)
   or created from scratch; an imported entry that is edited becomes custom and is exported with its full sheet for the mod to inject.
   Tiles and objects: variants over a game tile/object (the physical piece and the app behaviour stay the base's); the variant
   carries your name, texture or icon, colour and default texts, and sits in the palette beside the game pieces. */
'use strict';

let abaF = 'monstros', fichaSel = null;
/* the Items tab works by kind: the kind is picked first, then its entries are imported or created (weapon parts live in the Weapons tab) */
let tipoItem = null;
const TIPOS_ITEM = [['ArmorModel', 'Armor', 'Worn by a hero: a card with its rule, kept in the party’s inventory.'], ['ConsumableModel', 'Consumables', 'Potions and one-use cards the heroes spend during a quest.'], ['TrinketModel', 'Trinkets', 'Charms a hero carries; some have an effect the app applies.'], ['CraftingMaterialModel', 'Materials', 'Crafting materials: loot is paid in them and recipes cost them.']];
const doTipoItem = (x, t) => x.cls === t || (t === 'TrinketModel' && x.cls === 'TableItem');
const ACT_NOME = { 0: 'Act I', 1: 'Act II' };
const lerImagem = (arquivo, lado) => new Promise(res => { const r = new FileReader(); r.onload = () => { const i = new Image(); i.onload = () => { const cv = document.createElement('canvas'); const k = Math.min(1, lado / Math.max(i.width, i.height)); cv.width = Math.round(i.width * k); cv.height = Math.round(i.height * k); cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height); res(cv.toDataURL('image/png')); }; i.src = r.result; }; r.readAsDataURL(arquivo); });
const bits = (mask, lista) => lista.filter((n, i) => mask & (1 << i));

// ------------------------------------------------------------ import from the game catalog
function ativacaoDoCatalogo(ref) {
  const a = ref && (CAT.ativacoes[ref.id] || Object.values(CAT.ativacoes).find(x => x._name === ref.ref)); if (!a) return null;
  return { id: a._id, nome: a._name, speed: a.Speed, damage: a.Damage, aim: a.Aim, attack: a.Attack, range: a.Range, healing: a.Healing, shield: a.Shield, initiative: a.Initiative, rangeType: ALCANCES[a.RangeType] || 'Melee', next: a.NextActivation?.id || '', text: a.text_en || '', hint: a.hint_en || '' };
}
function monstroDoCatalogo(c) {
  return { id: 'B_' + uid(), base: c._id, custom: false, nome: c.name_en, nomeJogo: c.name_en, plural: c.plural_en || c.name_en, desc: c.desc_en || '', tipo: TIPOS_MONSTRO[c.Type] || 'Berserker', act: c._act || 0,
    tiers: (c.Tiers || []).map(t => ({ tier: t.Tier, hp: t.StartingHealth, def: t.Defense, atk: t.BaseAttack })), size: c.Size || 0, named: !!c.IsNamed, villain: !!c.IsVillain,
    mec: bits(c.MechanicalTraits || 0, TRACOS_MEC), tema: bits(c.ThemeTraits || 0, TRACOS_TEMA),
    wr: (c.WeaknessesAndResistances || []).map(w => ({ dano: DANOS[w.TraitValue] || 'Crush', tipo: w.TraitType === -1 ? 'resist' : 'weak', quando: w.TraitIs === 2 ? 'hard' : w.TraitIs === 1 ? 'off' : 'always' })),
    imune: bits(c.ImmuneTo || 0, CONDICOES), strength: c.StrengthsValue || 0,
    ativacoes: (c.Activations || []).map(ativacaoDoCatalogo).filter(Boolean), taticas: (c.ManualActivations || []).map(ativacaoDoCatalogo).filter(Boolean),
    loot: [], sons: { modo: 'tipo', tipo: TIPOS_MONSTRO[c.Type] || 'Bandit' }, textureTab: c.TextureTabAssetPath || '', logic: c.LogicAssetPath || '', comportamento: c._id, retrato: '', defesa: c.defense_en || '', defesaApos: !!c.ShowDefenseAfterAttack };
}
/* the six heroes of the box also exist as story characters: imported, they speak in dialogues like any NPC */
const ehHeroiDaCaixa = id => /^STORY_CHARACTER_(BRYNN|CHANCE|GALADEN|KEHLI|SYRUS|VAERIX)$/.test(id || '');
function personagemDoCatalogo(c) {
  const rosto = chaveArte(c.TextureAssetPathDefault || c.TextureAssetPathActI);
  return { id: 'B_' + uid(), base: c._id, custom: false, nome: c.name_en, papel: 'npc', desc: '', rostoBase: rosto || c._name, retrato: '' };
}
/* the names of the game's pieces follow the language of the game data: a sheet imported while the data was in another
   language (the first data of the full editor were in English) kept the old name. Once per language of the data, the
   sheets the user did not change take the names and texts of the game again; a changed one only when its name is still
   the game's (nomeJogo) */
function nomesNaLinguaDoJogo(b) {
  const lingua = JOGO.lang || 'en'; if (b._lingua === lingua) return; b._lingua = lingua;
  const doJogo = (lista, id) => (lista || []).find(c => c._id === id);
  const refazer = (x, c, campos) => { if (!c || !c.name_en) return; const mesmoNome = x.nomeJogo && x.nome === x.nomeJogo;
    if (!x.custom || mesmoNome) { x.nome = c.name_en; if (!x.custom) campos.forEach(([k, ck]) => { if (c[ck]) x[k] = c[ck]; }); } x.nomeJogo = c.name_en; };
  (b.itens || []).forEach(x => { if (x.base) refazer(x, doJogo(CAT.itens, x.base), [['desc', 'desc_en']]); });
  (b.monstros || []).forEach(x => { if (x.base) refazer(x, doJogo(CAT.monstros, x.base), [['plural', 'plural_en'], ['desc', 'desc_en']]); });
  (b.personagens || []).forEach(x => { if (x.base) refazer(x, doJogo(CAT.personagens, x.base), []); });
  (b.pericias || []).forEach(p => { if (!p.base) return; const s = (CAT.habilidades || []).find(c => c._id === p.base); if (!s) return; if (!p.custom || p.nome === p.nomeJogo) p.nome = s.name_en; p.nomeJogo = s.name_en; });
}
function itemDoCatalogo(c) {
  const img = chaveArte(c.ArmoryAssetPath || c.TextureAssetPath);
  return { id: 'B_' + uid(), base: c._id, custom: false, cls: c._cls, nome: c.name_en, nomeJogo: c.name_en, desc: c.desc_en || '', raridade: c.Rarity || 0, valor: c.Value || 0, imagemBase: img || c._name, retrato: '',
    ...(c._cls === 'CraftingMaterialModel' ? { tipoMaterial: c.MaterialType || 0 } : {}),
    classe: c.Class !== undefined ? (CLASSES_ARMA[c.Class] || '') : '', slot: c.Slot !== undefined ? ['A', 'B', 'C'][c.Slot] || 'A' : '', traits: (c.Traits || []).map(t => DANOS[t]).filter(Boolean), dano: c.Damage || 0, habilidade: c.Ability?.id || c.AbilityKey || '', unico: !!c.IsUnique, digital: c.IsDigital !== 0 };
}

// ------------------------------------------------------------ screen
function abrirFichas(aba, id) {
  marcarVisto('dica:oficina');
  abaF = aba || 'monstros'; if (id) fichaSel = id;
  if (abaF === 'itens' && id) { const it = oficina().itens.find(x => x.id === id); if (it && it.cls === 'WeaponPartsModel') { abaF = 'armas'; armaSel = armaDaClasse(CLASSES_ARMA.indexOf(it.classe))?._id || null; slotSel = Math.max(0, 'ABC'.indexOf(it.slot || 'A')); pecaAberta = it.id; } else if (it) tipoItem = it.cls === 'TableItem' ? 'TrinketModel' : it.cls; }
  $('#telaFichas').hidden = false; renderFichas();
}
function fecharFichas() { $('#telaFichas').hidden = true; if (inimigoEscolhido && !monstro(inimigoEscolhido)) inimigoEscolhido = null; if (!defPeca(pecaEscolhida)) pecaEscolhida = PECAS[0].id; if (!defObj(objetoEscolhido)) objetoEscolhido = 'Door'; tudo(); }
$('#fVoltar').onclick = fecharFichas;
$$('#abasF button').forEach(b => b.onclick = () => { abaF = b.dataset.aba; fichaSel = null; renderFichas(); });
/* the explanation of each workshop tab: [title, html]. Monsters, items and weapons show it the first time they open; the "?"
   of the header shows the one of the tab on screen. (Those three are translated by the dictionary; the others carry both
   languages here) */
function explicacaoDaAba(aba) {
  const onde = campanha ? 'campaign' : 'map', ondePt = campanha ? 'campanha' : 'mapa';
  const dois = (en, pt) => '<div data-sem-traducao>' + L2(en, pt) + '</div>';
  switch (aba) {
    case 'monstros': return ['The monster workshop', `<p>Here you prepare the monsters of this ${onde}. Only the monsters listed here can be placed on the board or drawn from the spawn pool.</p>
    <ul><li><b>Import</b> a monster from the game (Act I or Act II) and change what you want: name, health, defense, weaknesses and resistances, activations and tactics, loot, sounds, picture and figure.</li>
    <li><b>Create</b> a new monster from a type: it borrows the behaviour of that type and you write the rest.</li></ul>
    ${typeof Tutorial !== 'undefined' && Tutorial.ativo() ? '<p><b>For this tutorial, import about 10 monsters</b> of the act you want to play: they go into the spawn pool of the map.</p>' : `<p><b>To begin, import just 2 or 3 monsters.</b> A short list is easier to balance and to test; add more as the ${onde} grows.</p>`}`];
    case 'itens': return ['The item workshop', `<p>Here you choose the items of this ${onde}: import them from the game, change them (name, rarity, value, damage, abilities) or create your own.
    Only the items listed here can be dropped by monsters, found or given by triggers, and the <b>item pool</b> is what random-item triggers draw from.</p>
    <p><b>The selection of available items is essential for the balance of the game.</b> Strong items early make the fights easy; too few, or weak ones, leave the heroes behind the monsters.
    Pick them on purpose, thinking of the heroes' progress along the ${onde}.</p>`];
    case 'armas': return ['How weapons work in the app', `<p>In the app, a weapon is the sum of its <b>three parts</b>: part <b>A</b>, part <b>B</b> and part <b>C</b>
    (for example the head, the haft and the grip). The app adds up what each part gives: damage, damage types, abilities and the chance of each ability.</p>
    <p>So every change is made <b>on the parts</b>: pick a weapon, open one of its parts and change it, or create a new part for one of the three places.
    The weapon itself only keeps its name.</p>
    <p class="ajuda">A change applies while this ${campanha ? 'campaign' : 'map'} is played, to every copy of the part, also the ones bought or found later.</p>`];
    case 'personagens': return [L2('The NPC workshop', 'A oficina de NPCs'), dois(`<p>Here are the people of your stories: guides, captives, merchants, villains who talk. Import a character of the game or create one, with a name and a portrait.</p>
      <p>They speak in the scenes of the ${onde} and of the “Play a scene” triggers, and they can stand on the board.</p>`, `<p>Aqui ficam as pessoas das suas histórias: guias, prisioneiros, mercadores, vilões que falam. Importe um personagem do jogo ou crie um, com nome e retrato.</p>
      <p>Eles falam nas cenas da ${ondePt} e dos gatilhos “Tocar uma cena”, e podem ficar no tabuleiro.</p>`)];
    case 'receitas': return [L2('The recipe workshop', 'A oficina de receitas'), dois(`<p>What the party can craft, and from which materials. Import the recipes of the game or create your own: the item made, the materials and how many of each, the value.</p>
      <p>A recipe may be known from the start, or given later by a trigger (a book on a lectern, a reward).</p>`, `<p>O que o grupo pode fabricar, e com quais materiais. Importe as receitas do jogo ou crie as suas: o item feito, os materiais e quantos de cada um, o valor.</p>
      <p>Uma receita pode ser conhecida desde o começo ou entregue depois por um gatilho (um livro num púlpito, uma recompensa).</p>`)];
    case 'pecas': return [L2('The tile workshop', 'A oficina de peças'), dois(`<p>Tiles of your own: any shape (click the squares), any colour or picture. They go on the board like the tiles of the box, and the mod draws them in the game.</p>
      <p>Use them for what the box lacks: a pit, a raised floor, a rug under the tiles (a tile of the background).</p>`, `<p>Peças suas: qualquer forma (clique nas casas), qualquer cor ou imagem. Elas vão para o tabuleiro como as peças da caixa, e o mod as desenha no jogo.</p>
      <p>Use-as para o que a caixa não tem: um fosso, um piso elevado, um tapete sob as peças (uma peça de fundo).</p>`)];
    case 'objetos': return [L2('The object workshop', 'A oficina de objetos'), dois(`<p>Objects of your own: their squares on the board, a colour and an icon. In the game they show as an interaction token, a standing card, a block or a 3D model.</p>
      <p>Each one may have its own default script, like the objects of the game: the next ones placed come already programmed.</p>`, `<p>Objetos seus: as casas que ocupam no tabuleiro, uma cor e um ícone. No jogo eles aparecem como ficha de interação, cartão em pé, bloco ou modelo 3D.</p>
      <p>Cada um pode ter o seu script padrão, como os objetos do jogo: os próximos colocados já chegam programados.</p>`)];
    case 'herois': return [L2('The hero workshop', 'A oficina de heróis'), dois(`<p>The six heroes of the game, changed for this ${onde}: name, portrait, art on the board and voice.</p>
      <p>Their weapons change in the Weapons tab, and their skill cards in the Skills tab.</p>`, `<p>Os seis heróis do jogo, alterados para ${campanha ? 'esta' : 'este'} ${ondePt}: nome, retrato, arte no tabuleiro e voz.</p>
      <p>As armas deles mudam na aba Armas, e as cartas de perícia na aba Perícias.</p>`)];
    case 'facanhas': return [L2('The feat workshop', 'A oficina de façanhas'), dois(`<p>Feats are goals a hero reaches during the ${onde} (defeat monsters, open chests, survive a fight…) that pay a reward. Import the feats of the game or create your own: the hero, the goal, when it counts and the reward.</p>
      <p>The feat pool decides which feats are offered: for a hero with any feat in it, only those.</p>`, `<p>Façanhas são metas que um herói alcança durante a ${ondePt} (derrotar monstros, abrir baús, sobreviver a uma luta…) e que pagam uma recompensa. Importe as façanhas do jogo ou crie as suas: o herói, a meta, quando ela conta e a recompensa.</p>
      <p>O pool de façanhas decide quais são oferecidas: para um herói com alguma façanha nele, só essas.</p>`)];
    case 'pericias': return [L2('The skill workshop', 'A oficina de perícias'), dois(`<p>Skill cards of your own for the heroes: the name, the cost in XP and the cards, each with its picture.</p>
      <p>The cards stay at the table: print them as a PDF and play them as the cards of the box.</p>`, `<p>Cartas de perícia suas para os heróis: o nome, o custo em XP e as cartas, cada uma com a sua imagem.</p>
      <p>As cartas ficam na mesa: imprima-as em PDF e jogue-as como as cartas da caixa.</p>`)];
    case 'historias': return [L2('The stories workshop', 'A oficina de histórias'), dois(`<p>The stories the map generator dresses its maps with: villains, guides, captives, pieces, clocks, openings. Change their texts and their links, switch some off, add new ones.</p>
      <p>Your changes stay in this browser and are used by the generator at once; Export writes the whole file.</p>`, `<p>As histórias com que o gerador de mapas veste os mapas: vilões, guias, prisioneiros, peças, relógios, aberturas. Mude os textos e as ligações, desligue algumas, crie novas.</p>
      <p>As mudanças ficam neste navegador e o gerador as usa na hora; Exportar grava o arquivo inteiro.</p>`)];
  }
  return null;
}
function explicarAba() { if (abaF === 'monstros' || abaF === 'itens') { const e = explicacaoDaAba(abaF); explicarUmaVez(abaF, e[0], e[1]); } }
/* the "?" of the header: the explanation of the tab on screen, any time */
$('#fAjuda').onclick = () => { const e = explicacaoDaAba(abaF); if (!e) return; modal(e[0], e[1] + `<div class="botoes" style="justify-content:flex-end;margin-top:10px"><button class="primario" data-ok>Got it</button></div>`, (el, fechar) => { el.querySelector('[data-ok]').onclick = fechar; }); };
function renderFichas() {
  explicarAba();
  $$('#abasF button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === abaF));
  if (abaF === 'herois') { renderHerois(); return; }
  if (abaF === 'armas') { renderArmas(); return; }
  if (abaF === 'receitas') { renderReceitas(); return; }
  if (abaF === 'facanhas') { renderFacanhas(); return; }
  if (abaF === 'pericias') { renderPericias(); return; }
  if (abaF === 'historias' && !oficinaHistoriasAtiva()) abaF = 'monstros';
  if (abaF === 'historias') { renderHistoriasOficina(); return; }
  const lista = abaF === 'itens' ? oficina().itens.filter(x => tipoItem && doTipoItem(x, tipoItem)) : oficina()[abaF]; if (fichaSel && !lista.some(x => x.id === fichaSel) && !(abaF === 'objetos' && String(fichaSel).startsWith('padrao:') && padroesDaOficina()[fichaSel.slice(7)])) fichaSel = null;
  const esq = $('#esqF'); const variante = abaF === 'pecas' || abaF === 'objetos';
  const titulo = { monstros: 'Monsters', personagens: 'NPCs', itens: 'Items', pecas: 'Tiles', objetos: 'Objects' }[abaF];
  const escolhaTipo = abaF === 'itens' ? `<div class="tiposItem">${TIPOS_ITEM.map(([k, n]) => `<button class="sm ${tipoItem === k ? 'ativo' : ''}" data-tipoitem="${k}">${n}</button>`).join('')}</div>` : '';
  if (abaF === 'itens' && !tipoItem) {
    esq.innerHTML = `<div class="bloco"><h2>Items</h2><div class="botoes"><button class="sm" id="f_importar">Import…</button></div><p class="ajuda">Import the game’s items (all kinds together, with filters), or pick a kind to see its entries and create your own. Weapon parts are made in the Weapons tab, recipes in the Recipes tab.</p>${escolhaTipo}</div>`;
    esq.querySelectorAll('[data-tipoitem]').forEach(b => b.onclick = () => { tipoItem = b.dataset.tipoitem; fichaSel = null; renderFichas(); });
    $('#f_importar').onclick = importar;
    $('#centroF').innerHTML = `<div class="vazio"><h2>Items</h2>${TIPOS_ITEM.map(([k, n, ex]) => `<p><b>${n}</b>: ${ex}</p>`).join('')}<p>Pick a kind on the left.</p></div>`; return;
  }
  esq.innerHTML = `<div class="bloco"><h2>${abaF === 'itens' ? TIPOS_ITEM.find(t => t[0] === tipoItem)[1] : titulo} <span class="etq">${lista.length}</span></h2>${escolhaTipo}
    <div class="botoes">${variante ? `<button class="sm primario" id="f_novo">+ New ${abaF === 'pecas' ? 'tile' : 'object'}</button>` : `<button class="sm" id="f_importar">Import…</button><button class="sm primario" id="f_novo">+ Create</button>`}</div>
    <p class="ajuda">${abaF === 'monstros' ? 'Only monsters listed here can be placed on the board or drawn from the pool. Import the game’s monsters one by one, edit them, or create your own from a type.' : abaF === 'personagens' ? 'Only NPCs listed here appear in dialogues (speaker and cast). Import the game’s NPCs (the six heroes of the box too, to speak as NPCs) or create your own with a portrait.' : abaF === 'itens' ? esc(TIPOS_ITEM.find(t => t[0] === tipoItem)[2]) + ' Only items listed in the workshop can be given by triggers, rewards and dialogues, dropped by monsters or crafted.' : abaF === 'pecas' ? 'Your own tiles, made from scratch: click the squares of their shape and pick a colour. Each one is a single physical piece (once per room, like the game tiles) and appears in the Tile palette.' : 'Your own objects, made from scratch: click the squares they cover, pick a colour and an icon, write default texts. They take triggers and requirements like any object and appear in the Object palette.'}</p>
    <div id="f_lista"></div></div>` + (abaF === 'monstros' ? `<div class="bloco"><h2>Spawn pool of the map</h2><p class="ajuda">Monsters the “Spawn from the pool” trigger draws from. Each room starts with this list and may adjust it.</p><div id="f_pool"></div></div>` : abaF === 'itens' ? `<div class="bloco"><h2>Item pool of the map</h2><p class="ajuda">Items the heroes may get in this map: random-item triggers draw from it.</p><div id="f_poolItens"></div></div>` : '');
  const l = $('#f_lista');
  lista.forEach(x => {
    const d = document.createElement('div'); d.className = 'no' + (fichaSel === x.id ? ' ativo' : '');
    const r = abaF === 'monstros' ? retratoDoMonstro(x) : abaF === 'personagens' ? retratoDoPersonagem(x) : abaF === 'itens' ? retratoDoItem(x) : abaF === 'pecas' ? (defPeca(x.id) ? miniatura(defPeca(x.id), x) : '') : iconeObj(x.id);
    d.innerHTML = `${r ? `<img class="face ${variante ? 'quadrada' : ''}" src="${r}" alt="">` : '<span class="face"></span>'}<div><div>${esc(x.nome || '(no name)')}</div><small>${abaF === 'monstros' ? esc(x.tipo) + (x.tiers?.length ? ' · ' + x.tiers[0].hp + ' hp' : '') : abaF === 'personagens' ? (ehHeroiDaCaixa(x.base) ? 'hero of the box, as NPC' : 'NPC') : abaF === 'itens' ? esc(x.cls.replace('Model', '')) : abaF === 'pecas' || abaF === 'objetos' ? (x.cells || []).length + ' square(s) · ' + extensao(x.cells || [[0, 0]]).join('×') : ''}${variante ? '' : x.custom ? ' · custom' : x.base ? ' · from the game' : ''}</small></div>`;
    d.onclick = () => { fichaSel = x.id; renderFichas(); }; l.appendChild(d);
  });
  if (!lista.length) l.innerHTML = '<p class="ajuda">Nothing yet.</p>';
  // the game's objects whose default this Workshop changed (only those: the others keep the game's default)
  if (abaF === 'objetos') { const jogo = objetosDoJogoComPadrao(); if (jogo.length) { const st = document.createElement('div'); st.className = 'sub'; st.textContent = tr('Game objects with a default of their own'); l.appendChild(st);
    jogo.forEach(k => { const d = document.createElement('div'); d.className = 'no' + (fichaSel === 'padrao:' + k ? ' ativo' : ''); d.innerHTML = `<img class="face quadrada" src="${iconeObj(k)}" alt=""><div><div>${esc(nomeObj(k))}</div><small>${tr('game object · default of its own')}</small></div>`; d.onclick = () => { fichaSel = 'padrao:' + k; renderFichas(); }; l.appendChild(d); }); } }
  esq.querySelectorAll('[data-tipoitem]').forEach(b => b.onclick = () => { tipoItem = b.dataset.tipoitem; fichaSel = null; renderFichas(); });
  if (!variante) $('#f_importar').onclick = importar; $('#f_novo').onclick = () => criarFicha();
  if (abaF === 'monstros') widgetPool($('#f_pool'), projeto.reserva, renderConferencia);
  if (abaF === 'itens') widgetPoolItens($('#f_poolItens'), projeto.itensPool = projeto.itensPool || []);
  const x = lista.find(y => y.id === fichaSel);
  const c = $('#centroF');
  if (!x && abaF === 'objetos' && String(fichaSel || '').startsWith('padrao:')) { fichaPadraoJogo(c, fichaSel.slice(7)); return; }
  if (!x) { c.innerHTML = `<div class="vazio"><h2>${titulo}</h2><p>Pick an entry on the left, import one from the game, or create a new one.</p></div>`; return; }
  if (abaF === 'monstros') fichaMonstro(c, x); else if (abaF === 'personagens') fichaPersonagem(c, x); else if (abaF === 'itens') fichaItem(c, x); else if (abaF === 'pecas') fichaPeca(c, x); else fichaObjeto(c, x);
}
/* importing from the game: click entries to tick them (several at once), or tick every entry shown, then import them together.
   filtros: [{ nome, opcoes: [[valor, rótulo]], de: entrada -> valor or [valores] }]; chips of one row add up (or), rows narrow each other (and) */
function modalImportacao(titulo, entradas, aoImportar, filtros = []) {
  const marcadas = new Set();
  const escolhidos = filtros.map(() => new Set());
  const valores = (fl, x) => { const v = fl.de(x); return (Array.isArray(v) ? v : [v]).map(String); };
  filtros.forEach(fl => { fl.opcoes = fl.opcoes.filter(([v]) => entradas.some(x => valores(fl, x).includes(String(v)))); });
  const linhas = filtros.map((fl, fi) => fl.opcoes.length > 1 ? `<div class="impFiltro"><b>${esc(fl.nome)}</b>${fl.opcoes.map(([v, r]) => `<button class="sm chipF" data-f="${fi}" data-v="${esc(String(v))}">${esc(r)} <small>${entradas.filter(x => valores(fl, x).includes(String(v))).length}</small></button>`).join('')}</div>` : '').join('');
  const { fundo } = modal(titulo, `<div class="linha impBarra"><input id="imp_filtro" placeholder="filter by name…"><button class="sm" id="imp_todos">Tick all shown</button><button class="sm" id="imp_nenhum">Untick all</button><button class="sm primario" id="imp_ok" disabled>Import</button></div>${linhas ? `<div class="impFiltros">${linhas}<button class="sm" id="imp_limpa" hidden>Clear filters</button></div>` : ''}<p class="ajuda" id="imp_conta"></p><div class="grade importar" id="imp_lista"></div>`, el => {
    const ok = el.querySelector('#imp_ok');
    const conta = () => { ok.textContent = marcadas.size ? 'Import ' + marcadas.size : 'Import'; ok.disabled = !marcadas.size; };
    let visiveis = [];
    const passa = x => filtros.every((fl, fi) => !escolhidos[fi].size || valores(fl, x).some(v => escolhidos[fi].has(v)));
    const pinta = f => { const g = el.querySelector('#imp_lista'); g.innerHTML = ''; visiveis = entradas.filter(x => (!f || x.nome.toLowerCase().includes(f)) && passa(x));
      el.querySelector('#imp_conta').textContent = visiveis.length + ' of ' + entradas.length + ' shown';
      const lp = el.querySelector('#imp_limpa'); if (lp) lp.hidden = !escolhidos.some(e => e.size);
      visiveis.forEach(x => {
        const d = document.createElement('div'); d.className = 'item' + (x.ja ? ' usada' : '') + (marcadas.has(x) ? ' marcado' : '');
        d.innerHTML = `<span class="marca">${x.ja ? '✓' : marcadas.has(x) ? '☑' : '☐'}</span>${x.img ? `<img class="redondo" src="${x.img}" alt="">` : '<span class="redondo vazio"></span>'}<div>${esc(x.nome)}<small>${esc(x.sub || '')}${x.ja ? ' · imported' : ''}</small></div>`;
        if (!x.ja) d.onclick = () => { if (marcadas.has(x)) marcadas.delete(x); else marcadas.add(x); d.classList.toggle('marcado'); d.querySelector('.marca').textContent = marcadas.has(x) ? '☑' : '☐'; conta(); };
        g.appendChild(d); }); };
    pinta(''); conta();
    el.querySelector('#imp_filtro').oninput = e => pinta(e.target.value.toLowerCase());
    const filtroTexto = () => el.querySelector('#imp_filtro').value.toLowerCase();
    el.querySelectorAll('.chipF').forEach(b => b.onclick = () => { const e = escolhidos[+b.dataset.f]; if (e.has(b.dataset.v)) e.delete(b.dataset.v); else e.add(b.dataset.v); b.classList.toggle('ativo', e.has(b.dataset.v)); pinta(filtroTexto()); });
    const lp = el.querySelector('#imp_limpa'); if (lp) lp.onclick = () => { escolhidos.forEach(e => e.clear()); el.querySelectorAll('.chipF').forEach(b => b.classList.remove('ativo')); pinta(filtroTexto()); };
    el.querySelector('#imp_todos').onclick = () => { visiveis.filter(x => !x.ja).forEach(x => marcadas.add(x)); pinta(el.querySelector('#imp_filtro').value.toLowerCase()); conta(); };
    el.querySelector('#imp_nenhum').onclick = () => { marcadas.clear(); pinta(el.querySelector('#imp_filtro').value.toLowerCase()); conta(); };
    ok.onclick = () => { const escolhidas = entradas.filter(x => marcadas.has(x)); fundo.remove(); aoImportar(escolhidas); };
  }, true);
}
/* one Import button per tab: every game entry of the tab, narrowed by filters (act, kind, type…) */
const TIPO_DO_ITEM = cls => cls === 'TableItem' ? 'TrinketModel' : cls;
function importar() {
  const ehItem = abaF === 'itens';
  const lista = abaF === 'monstros' ? CAT.monstros.filter(m => m.name_en && !/^ENEMY_/.test(m.name_en)).sort((a, b) => a.name_en.localeCompare(b.name_en))
    : abaF === 'personagens' ? CAT.personagens.filter(p => p.name_en && !/^(Variable|NPC_|Text)/.test(p.name_en)).sort((a, b) => (ehHeroiDaCaixa(b._id) - ehHeroiDaCaixa(a._id)) || a.name_en.localeCompare(b.name_en))
    : CAT.itens.filter(i => TIPOS_ITEM.some(([k]) => doTipoItem({ cls: i._cls }, k)) && i.name_en && i.name_en !== 'Text').sort((a, b) => a.name_en.localeCompare(b.name_en));
  const ja = new Set(bestiario()[abaF].map(x => x.base));
  const imagem = x => abaF === 'monstros' ? RETRATOS.monstros[chaveArte(x.TextureTabAssetPath)] : abaF === 'personagens' ? RETRATOS.personagens[chaveArte(x.TextureAssetPathDefault || x.TextureAssetPathActI)] || RETRATOS.personagens[x._name] : RETRATOS.itens[chaveArte(x.ArmoryAssetPath || x.TextureAssetPath)] || RETRATOS.itens[x._name];
  const tipoMonstro = x => x.IsVillain ? 'villain' : x.IsNamed ? 'unique' : 'common';
  const ROT_TIPO = { common: 'Common', unique: 'Unique', villain: 'Villain (boss)' };
  const nomeTipoItem = x => TIPOS_ITEM.find(([k]) => k === TIPO_DO_ITEM(x._cls))?.[1] || x._cls.replace('Model', '');
  const sub = x => (ACT_NOME[x._act || 0] || '') + ' · ' + (abaF === 'monstros' ? (TIPOS_MONSTRO[x.Type] || '?') + ' · ' + ROT_TIPO[tipoMonstro(x)].toLowerCase() + (x.Size ? ' · large' : '') + ' · ' + ((x.Tiers || [])[0]?.StartingHealth ?? '?') + ' hp' : abaF === 'personagens' ? (ehHeroiDaCaixa(x._id) ? 'hero of the box, as NPC' : 'NPC') : nomeTipoItem(x) + (x.IsUnique ? ' · unique' : ''));
  const act = { nome: 'Act', opcoes: [[0, ACT_NOME[0]], [1, ACT_NOME[1]]], de: x => x._act || 0 };
  const filtros = abaF === 'monstros' ? [act,
      { nome: 'Kind', opcoes: [['common', 'Common'], ['unique', 'Unique'], ['villain', 'Villain (boss)']], de: tipoMonstro },
      { nome: 'Size', opcoes: [[0, 'Normal'], [2, 'Large']], de: x => x.Size || 0 },
      { nome: 'Type', opcoes: TIPOS_MONSTRO.map((t, i) => [i, t]).filter(([, t]) => t).sort((a, b) => a[1].localeCompare(b[1])), de: x => x.Type }]
    : abaF === 'personagens' ? [act, { nome: 'Kind', opcoes: [['hero', 'Heroes of the box'], ['npc', 'NPCs']], de: x => ehHeroiDaCaixa(x._id) ? 'hero' : 'npc' }]
    : [act, { nome: 'Kind', opcoes: TIPOS_ITEM.map(([k, n]) => [k, n]), de: x => TIPO_DO_ITEM(x._cls) }, { nome: 'Unique', opcoes: [['1', 'Unique'], ['0', 'Regular']], de: x => x.IsUnique ? '1' : '0' }];
  const titulo = 'Import from the game · ' + (ehItem ? 'items' : abaF === 'personagens' ? 'NPCs' : 'monsters');
  modalImportacao(titulo, lista.map(x => ({ x, nome: x.name_en, img: imagem(x), sub: sub(x), ja: ja.has(x._id) })), escolhidas => {
    const novos = escolhidas.map(({ x }) => abaF === 'monstros' ? monstroDoCatalogo(x) : abaF === 'personagens' ? personagemDoCatalogo(x) : itemDoCatalogo(x));
    novos.forEach(n => bestiario()[abaF].push(n));
    if (novos[0]) { fichaSel = novos[0].id; if (ehItem) tipoItem = TIPO_DO_ITEM(novos[0].cls); }
    renderFichas();
    aviso(novos.length === 1 ? escolhidas[0].nome + ' imported. Edit it if you like; edited entries become custom.' : novos.length + ' entries imported. Edit them if you like; edited entries become custom.');
  }, filtros.map(fl => ({ ...fl, de: e => fl.de(e.x) })));
}
function criarFicha() {
  if (abaF === 'pecas') { const v = { id: 'B_' + uid(), custom: true, nome: tr('New tile ' + (oficina().pecas.length + 1)), cells: [[0, 0], [1, 0], [0, 1], [1, 1]], cor: PALETA_CORES[0], notas: '' }; oficina().pecas.push(v); fichaSel = v.id; renderFichas(); return; }
  if (abaF === 'objetos') { const v = { id: 'B_' + uid(), custom: true, nome: tr('New object ' + (oficina().objetos.length + 1)), cells: [[0, 0]], cor: '#6a5a48', glifo: 'Oficina', icone: '', textClick: '', textUse: '', notas: '' }; oficina().objetos.push(v); fichaSel = v.id; renderFichas(); return; }
  if (abaF === 'monstros') {
    escolherOpcao('New monster: pick its type', TIPOS_MONSTRO.map(t => ({ id: t, titulo: t, sub: 'The type gives the figure, animations and behaviour of the game; everything else is yours.' })), tipo => {
      const base = CAT.monstros.find(m => TIPOS_MONSTRO[m.Type] === tipo && !m.IsNamed && m.name_en && !/^ENEMY_/.test(m.name_en)) || CAT.monstros.find(m => TIPOS_MONSTRO[m.Type] === tipo);
      const m = base ? monstroDoCatalogo(base) : { id: 'B_' + uid(), base: null, tipo, tiers: [], size: 0, mec: [], tema: [], wr: [], imune: [], ativacoes: [], taticas: [], loot: [], sons: { modo: 'tipo', tipo }, textureTab: '', logic: '', retrato: '' };
      m.base = null; m.custom = true; m.nome = 'New ' + tipo; m.plural = 'New ' + tipo + 's'; m.desc = ''; m.named = false;
      bestiario().monstros.push(m); fichaSel = m.id; renderFichas(); aviso('Monster created from the ' + tipo + ' type. Fill in its sheet.');
    }, 'Choose the type first: it decides the figure and the animated art in the app (the game has no others) and the behaviour rules of that family. Then the rest of the sheet opens.');
  } else if (abaF === 'personagens') {
    const p = { id: 'B_' + uid(), base: null, custom: true, nome: tr('New NPC'), papel: 'npc', desc: '', rostoBase: '', retrato: '' };
    bestiario().personagens.push(p); fichaSel = p.id; renderFichas();
  } else {
    const cls = tipoItem || 'TrinketModel'; const mat = cls === 'CraftingMaterialModel';
    const i = { id: 'B_' + uid(), base: null, custom: true, cls, nome: tr(mat ? 'New material' : 'New item'), desc: '', raridade: 1, valor: mat ? 5 : 0, imagemBase: '', retrato: '', traits: [], dano: 0, habilidade: '', unico: false, digital: true, efeitoBase: '', ...(mat ? { tipoMaterial: 0 } : {}) };
    bestiario().itens.push(i); fichaSel = i.id; renderFichas();
  }
}
function apagarFicha(x) {
  const lista = oficina()[abaF];
  if (abaF === 'pecas' || abaF === 'objetos') {
    const mapas = campanha ? campanha.missoes : [projeto];
    const n = mapas.reduce((k, m) => k + m.salas.reduce((j, s) => j + (abaF === 'pecas' ? s.pecas.filter(p => p.tile === x.id).length : s.objetos.filter(o => o.type === x.id).length), 0), 0);
    if (n && !confirm(x.nome + ' is placed ' + n + ' time(s)' + (campanha ? ' in the maps of the campaign' : ' on the board') + '. Delete it and take those placements off the board' + (abaF === 'pecas' ? ' (with what sits on them, in this map)' : ' (with their triggers)') + '?')) return;
    mapas.forEach(m => m.salas.forEach((s, si) => {
      if (abaF === 'pecas') { for (let pi = s.pecas.length - 1; pi >= 0; pi--) if (s.pecas[pi].tile === x.id) { if (m === projeto) removerPecaComAnexos(si, pi); else s.pecas.splice(pi, 1); } }
      else { for (let oi = s.objetos.length - 1; oi >= 0; oi--) if (s.objetos[oi].type === x.id) { if (m === projeto) removerObjeto(si, oi, true, true); else s.objetos.splice(oi, 1); } }
    }));
    sel = null; if (pecaEscolhida === x.id) pecaEscolhida = PECAS[0].id; if (objetoEscolhido === x.id) objetoEscolhido = 'Door';
  }
  // in a campaign the workshop is shared: every map counts
  if (abaF === 'monstros') { const usado = (campanha ? campanha.missoes : [projeto]).some(p => p.salas.some(s => inimigosDaSala(s).some(({ e }) => e.enemy === x.id) || (s.reserva?.add || []).includes(x.id)) || (p.reserva || []).includes(x.id)); if (usado && !confirm(x.nome + ' is placed on the board or in the pool. Remove it anyway (those monsters become invalid)?')) return; }
  lista.splice(lista.indexOf(x), 1); esquecerFicha(abaF, x.id); fichaSel = null; renderFichas();
}
/* a deleted entry leaves no stale id in the lists that only name it: item pools, loot, rewards and feat rewards (items,
   recipes as RECEITA:id, runes as RUNA:id), spawn pools (monsters), speakers and casts of the boxes (NPCs) */
function esquecerFicha(tipo, id) {
  const mapas = campanha ? campanha.missoes : [projeto];
  const tira = l => { if (Array.isArray(l)) for (let k = l.length - 1; k >= 0; k--) if (l[k] === id) l.splice(k, 1); };
  if (tipo === 'itens') {
    mapas.forEach(m => tira(m.itensPool)); oficina().monstros.forEach(m => tira(m.loot));
    (campanha?.nos || []).forEach(n => tira(n.recompensas?.items)); (oficina().facanhas || []).forEach(f => tira(f.premios));
  } else if (tipo === 'monstros') mapas.forEach(m => { tira(m.reserva); m.salas.forEach(s => { tira(s.reserva?.add); tira(s.reserva?.remove); }); });
  else if (tipo === 'personagens') {
    const caixas = [...(campanha?.dialogos || []), ...mapas.flatMap(m => [...m.salas.flatMap(s => donosDaSala(s).map(({ o }) => o)), ...(m.contadores || [])].flatMap(o => todosGatilhos(o)).flatMap(g => g.caixas || []))];
    caixas.forEach(d => { if (d.speaker === id) d.speaker = ''; tira(d.cast); });
  }
}
function retratoCampo(x, rotuloTxt, aoMudar) {
  const atual = abaF === 'monstros' ? retratoDoMonstro(x) : abaF === 'personagens' ? retratoDoPersonagem(x) : retratoDoItem(x);
  return `<div class="retrato"><div class="quadro">${atual ? `<img src="${atual}" alt="">` : '<span>no portrait</span>'}</div><div><label class="sm botaoArquivo">Upload PNG/JPG<input type="file" accept="image/png,image/jpeg,image/webp" data-retrato hidden></label>${atual ? '<button class="sm" data-espelhar="retrato" title="Flip the picture left to right">⇋ Mirror</button>' : ''}${x.retrato ? '<button class="sm" data-retratoLimpa>Use the game art</button>' : ''}<p class="ajuda">${rotuloTxt}</p></div></div>`;
}
function ligarRetrato(el, x, lado) {
  const inp = el.querySelector('[data-retrato]'); if (inp) inp.onchange = async e => { const f = e.target.files[0]; if (!f) return; x.retrato = await lerImagem(f, lado || 256); x.custom = true; delete IMG['ini:' + x.id]; renderFichas(); };
  const lp = el.querySelector('[data-retratoLimpa]'); if (lp) lp.onclick = () => { x.retrato = ''; delete IMG['ini:' + x.id]; renderFichas(); };
}
/* ⇋ Mirror: flips a picture left to right and keeps the flipped copy (a game portrait becomes the entry's own) */
function espelharImagem(src) { return new Promise((ok, erro) => { const i = new Image(); i.onload = () => { const cv = document.createElement('canvas'); cv.width = i.naturalWidth; cv.height = i.naturalHeight; const g = cv.getContext('2d'); g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(i, 0, 0); ok(cv.toDataURL('image/png')); }; i.onerror = erro; i.src = src; }); }
function ligarEspelhos(el, x) {
  el.querySelectorAll('[data-espelhar]').forEach(b => b.onclick = async () => {
    const campo = b.dataset.espelhar;
    const atual = campo === 'retrato' ? (abaF === 'monstros' ? retratoDoMonstro(x) : abaF === 'personagens' ? retratoDoPersonagem(x) : retratoDoItem(x)) : x[campo];
    if (!atual) return;
    try { x[campo] = await espelharImagem(atual); } catch { return aviso('Could not flip this picture.'); }
    if (abaF !== 'pecas' && abaF !== 'objetos') x.custom = true;
    Object.keys(IMG).forEach(k => { if (k.includes(x.id)) delete IMG[k]; });
    renderFichas(); desenhar();
  });
}
/* the game's tier curve, read from its own monsters: each tier's health is the health of the tier before times the step
   below (rounded at every step; a monster made of tier 1 = 24 hp goes 29, 36, 50, 68, 88, 110, 132), the defense
   grows 1 per tier and the base attack follows the common curve +1, +1, +1, then +1 every two tiers */
const PASSO_VIDA = { 2: 1.2, 3: 1.25, 4: 1.4, 5: 1.35, 6: 1.3, 7: 1.25, 8: 1.2, 9: 1.2, 10: 1.2 };
const CURVA_ATAQUE = [0, 0, 1, 2, 3, 3, 4, 4, 5, 5, 6];   // by tier
const fimDaCurva = b => Math.min(10, Math.max(8, b + 3));   // a lone tier grows to tier 8 (like most of the game's monsters)
const ataqueDaCurva = t => CURVA_ATAQUE[Math.max(1, Math.min(10, t))] + Math.max(0, t - 10);
function tierPelaCurva(base, tier) {
  const b = Math.max(1, base.tier); let hp = base.hp;
  for (let t = b + 1; t <= tier; t++) hp = Math.round(hp * (PASSO_VIDA[t] || 1.2) + 1e-9);
  return { tier, hp, def: Math.max(0, base.def + tier - base.tier), atk: Math.max(0, base.atk + ataqueDaCurva(tier) - ataqueDaCurva(b)) };
}
const marcar = (x, el) => { x.custom = true; if (el) { const t = el.querySelector('.custom'); if (t) t.textContent = 'custom'; } };
const liga = (el, x, depois) => el.querySelectorAll('[data-c]').forEach(inp => { const k = inp.dataset.c; const h = () => { if (inp.type === 'checkbox') x[k] = inp.checked; else if (inp.type === 'number') x[k] = +inp.value || 0; else x[k] = inp.value; marcar(x, el); depois && depois(k); }; if (inp.tagName === 'TEXTAREA' || (inp.tagName === 'INPUT' && inp.type !== 'checkbox' && inp.type !== 'number')) inp.oninput = h; else inp.onchange = h; });
const chks = (nome, lista, atual, cols) => `<div class="chks ${cols || ''}">${lista.map(v => `<label class="chk"><input type="checkbox" data-chk="${nome}" value="${esc(v)}" ${atual.includes(v) ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</div>`;
const ligaChks = (el, x, depois) => el.querySelectorAll('[data-chk]').forEach(c => c.onchange = () => { const k = c.dataset.chk; x[k] = [...el.querySelectorAll(`[data-chk="${k}"]:checked`)].map(z => z.value); marcar(x, el); depois && depois(); });
/* the sounds of a workshop monster: the game's sound of a kind of monster (when it appears and when it attacks, as the
   game plays for every monster), or the user's own files, one per moment (a moment without a file stays silent) */
const MOMENTOS_SOM = [['spawn', 'Appears'], ['attack', 'Attacks'], ['defend', 'Is hit'], ['defeat', 'Is defeated']];
function sonsDoMonstro(m) {
  if (!m.sons || !m.sons.modo) m.sons = { modo: 'tipo', tipo: m.tipo || 'Bandit' };
  m.sons.arquivos = m.sons.arquivos || {};
  return m.sons;
}
function ligarSons(el, m, c) {
  const s = sonsDoMonstro(m);
  el.innerHTML = `<div class="botoes">${[['tipo', 'By monster type'], ['arquivos', 'My own sound files']].map(([k, n]) => `<button class="sm ${s.modo === k ? 'ativo' : ''}" data-sommodo="${k}">${n}</button>`).join('')}</div>
    ${s.modo === 'tipo'
      ? `<label class="campo">Sounds like <select data-somtipo>${TIPOS_MONSTRO.map(t => `<option ${(s.tipo || m.tipo) === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
         <p class="ajuda">The game's sound for that kind of monster, when it appears and when it attacks.</p>`
      : `<div class="somArquivos">${MOMENTOS_SOM.map(([k, n]) => { const a = s.arquivos[k]; const blob = a && AUDIOS[a.arquivo];
          return `<div class="linha"><b class="somMomento">${n}</b><label class="sm botaoArquivo">${a ? 'Replace…' : 'Choose a file…'}<input type="file" accept=".ogg,.mp3,.wav,audio/ogg,audio/mpeg,audio/wav" data-somarq="${k}" hidden></label>
            ${a ? `<small>${esc(a.nome)}${blob ? '' : ' (file not in this browser)'}</small>${blob ? `<button class="sm" data-somouve="${k}" title="Listen">▶</button>` : ''}<button class="sm" data-somtira="${k}" title="Remove">✕</button>` : '<small class="ajuda">silent</small>'}</div>`; }).join('')}</div>
         <p class="ajuda">OGG, MP3 or WAV. Each file plays at its moment in the app: when the monster appears, when it activates, when a hero hits it and when it falls. A moment without a file stays silent. The files are exported next to the map.</p>`}`;
  el.querySelectorAll('[data-sommodo]').forEach(r => r.onclick = () => { s.modo = r.dataset.sommodo; if (s.modo === 'tipo' && !s.tipo) s.tipo = m.tipo; marcar(m, c); ligarSons(el, m, c); });
  const st = el.querySelector('[data-somtipo]'); if (st) st.onchange = () => { s.tipo = st.value; marcar(m, c); };
  el.querySelectorAll('[data-somarq]').forEach(inp => inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const ext = (f.name.match(/\.(ogg|mp3|wav)$/i) || [])[1];
    if (!ext) return aviso('Use an OGG, MP3 or WAV file.');
    const nome = 'sound-' + (slug(m.nome || 'monster') || 'monster').slice(0, 20) + '-' + inp.dataset.somarq + '-' + uid().slice(-5) + '.' + ext.toLowerCase();
    await guardarAudio(nome, f); s.arquivos[inp.dataset.somarq] = { arquivo: nome, nome: f.name };
    marcar(m, c); ligarSons(el, m, c);
  });
  el.querySelectorAll('[data-somouve]').forEach(b => b.onclick = () => { const a = s.arquivos[b.dataset.somouve]; const blob = a && AUDIOS[a.arquivo]; if (blob) { const au = new Audio(URL.createObjectURL(blob)); au.play().catch(() => aviso('The browser could not play this file.')); } });
  el.querySelectorAll('[data-somtira]').forEach(b => b.onclick = () => { delete s.arquivos[b.dataset.somtira]; marcar(m, c); ligarSons(el, m, c); });
}
/* the monster's sounds as the .dmap carries them */
function sonsExportados(m) {
  const s = sonsDoMonstro(m);
  if (s.modo !== 'arquivos') return { mode: 'type', type: s.tipo || m.tipo || '' };
  const r = { mode: 'files' }; MOMENTOS_SOM.forEach(([k]) => { if (s.arquivos[k]) r[k] = s.arquivos[k].arquivo; }); return r;
}

// ------------------------------------------------------------ monster sheet
function fichaMonstro(c, m) {
  const cab = `<div class="cabF"><h2>${esc(m.nome)} <span class="etq custom">${m.custom ? 'custom' : 'from the game'}</span></h2><div class="botoes"><button class="sm" id="fm_dup">Duplicate</button><button class="sm perigo" id="fm_apaga">Delete</button></div></div>`;
  const variantes = CAT.monstros.filter(z => TIPOS_MONSTRO[z.Type] === m.tipo && z.name_en && !/^ENEMY_/.test(z.name_en));
  c.innerHTML = cab + `<div class="folha">
    <div class="col">
      ${retratoCampo(m, 'Shown on the monster tab in the app and in this editor. Square, 256 px or more.')}
      <div class="duas"><label class="campo">Name (singular) <input data-c="nome" value="${esc(m.nome)}"></label><label class="campo">Plural <input data-c="plural" value="${esc(m.plural || '')}"></label></div>
      <div data-descricao></div>
      <div class="duas"><label class="campo">Type <input value="${esc(m.tipo)}" disabled title="Fixed once created: it picks the figure and behaviour"></label>
      <label class="campo">Size <select data-c="size">${TAMANHOS.map((t, i) => `<option value="${i}" ${m.size === i ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <label class="campo">Behaviour (rules and figure of…) <select data-c="comportamento">${variantes.map(z => `<option value="${esc(z._id)}" ${m.comportamento === z._id ? 'selected' : ''}>${esc(z.name_en)}${z.IsNamed ? ' (boss)' : ''}</option>`).join('')}</select><small class="ajuda">The app runs this monster with the logic, figure and animations of the chosen game monster of the same type.</small></label>
      <div class="duas"><label class="chk"><input type="checkbox" data-c="named" ${m.named ? 'checked' : ''}> Named (unique boss)</label><label class="chk"><input type="checkbox" data-c="villain" ${m.villain ? 'checked' : ''}> Villain (boss music and tab)</label></div>
      <div class="sub">Animated art (activation, attack and info windows)</div>
      <div class="botoes"><button class="sm ${m.arteModo === 'imagem' ? '' : 'ativo'}" data-arte="jogo">Animation of the game</button><button class="sm ${m.arteModo === 'imagem' ? 'ativo' : ''}" data-arte="imagem">My picture</button></div>
      ${m.arteModo === 'imagem' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${m.arte ? `<img src="${m.arte}" alt="">` : '<span>no picture</span>'}</div><div>
        <label class="sm botaoArquivo">Upload the picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-arteimg hidden></label>${m.arte ? '<button class="sm" data-espelhar="arte" title="Flip the picture left to right">⇋ Mirror</button>' : ''}${m.standee && m.arte !== m.standee ? '<button class="sm" data-artecard>Use the standing card picture</button>' : ''}
        ${ajustesArte(m, false, k => ({ esc: 'data-artesc', alt: 'data-artey', lado: 'data-artex' })[k])}
        <p class="ajuda">Takes the place of the animated drawing of the behaviour monster in the windows that show it (its activation, a hero attacking it, its info). It is fitted to the part of each window that is really visible; the adjustments above move it from there. It breathes lightly, and the game’s own hit reactions (shake, flash) apply to it. PNG with a transparent background looks best.</p></div></div>`
        : '<p class="ajuda">The animated drawing of the monster chosen in Behaviour.</p>'}
      <div class="sub">Figure on the board</div>
      <div class="botoes"><button class="sm ${!['standee', 'modelo'].includes(m.figura) ? 'ativo' : ''}" data-fig="anim">Animated (game)</button><button class="sm ${m.figura === 'standee' ? 'ativo' : ''}" data-fig="standee">Standing card</button><button class="sm ${m.figura === 'modelo' ? 'ativo' : ''}" data-fig="modelo">3D model</button></div>
      ${m.figura === 'modelo' ? `<div id="fm_modelo"></div>` : ''}
      ${m.figura === 'standee' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${m.standee ? `<img src="${m.standee}" alt="">` : '<span>no picture</span>'}</div><div>
        <label class="sm botaoArquivo">Upload the card picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-standee hidden></label>${m.standee ? '<button class="sm" data-espelhar="standee" title="Flip the picture left to right">⇋ Mirror</button>' : ''}
        <label class="campo">Size <select data-esc>${ESCALAS_STANDEE.map(([k, n]) => `<option value="${k}" ${(m.escalaStandee || 1) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <p class="ajuda">The animated figure of the behaviour monster is hidden and this picture stands in its place, turned to the camera, as tall as the figure it replaces (times the size). It breathes lightly and shakes when hurt; the monster still moves, attacks and is clicked as usual. Transparent PNG, taller than wide.</p></div></div>`
        : '<p class="ajuda">The animated figure of the monster chosen in Behaviour.</p>'}
      <div class="sub">Tiers <button class="sm" id="fm_tier">+ Tier</button></div>
      <p class="ajuda">One line per difficulty tier the monster exists in: starting health, defense and base attack. ⚖ Balance, beside the lowest tier, recalculates the others from it with the game's own curve.</p>
      <div id="fm_tiers"></div>
      <div class="sub">Weaknesses, resistances and immunities</div>
      <div class="wr">${DANOS.map(d => { const w = (m.wr || []).find(z => z.dano === d); const v = w ? w.tipo + ':' + (w.quando || 'always') : ''; const op = (val, txt) => `<option value="${val}" ${v === val ? 'selected' : ''}>${txt}</option>`;
        return `<label>${d}<select data-wr="${d}" title="(H/W): only on the Heroic and Warfare difficulties">${op('', '—')}${op('weak:always', 'weak')}${op('resist:always', 'resists')}${op('weak:hard', 'weak (H/W)')}${op('resist:hard', 'resists (H/W)')}${v.endsWith(':off') ? op(v, (w.tipo === 'weak' ? 'weak' : 'resists') + ' · off') : ''}</select></label>`; }).join('')}</div>
      <p class="ajuda">(H/W): the weakness or resistance counts only on the Heroic and Warfare difficulties, like the game's own (110 of its monsters have a resistance like that).</p>
      <div class="sub">Immune to</div>${chks('imune', CONDICOES, m.imune || [], 'tres')}
      <div class="sub">Traits</div>${chks('mec', TRACOS_MEC, m.mec || [], 'tres')}<div class="sub pequena">Theme</div>${chks('tema', TRACOS_TEMA, m.tema || [], 'tres')}
    </div>
    <div class="col">
      <div class="sub">Activations <button class="sm" id="fm_ativ">+ Activation</button></div>
      <p class="ajuda">What the monster does on its turn, in order; “next” chains them. Speed, damage, aim, attack, range, healing, shield, initiative and range type are the numbers the app uses; the text is what the players read.</p>
      <div id="fm_ativs"></div>
      <div class="sub">Tactics (manual activations) <button class="sm" id="fm_tat">+ Tactic</button></div>
      <p class="ajuda">Special activations the app may pick through the type’s behaviour.</p>
      <div id="fm_tats"></div>
      <div class="sub">Defense (when a hero attacks it)</div>
      <p class="ajuda">The monster’s own rule shown in the attack window, like the bandit’s “Smokebomb”. Leave empty to keep the one of the behaviour monster.</p>
      <div class="linha"><button class="sm" id="fm_defimport" title="Copy the defense of another monster of the game">Import…</button><span class="ajuda">the defense of another monster</span></div>
      <label class="campo" id="fm_defcopiaCampo" hidden>Copy the defense of another monster <select id="fm_defcopia"><option value="">— pick one —</option>${DEFESAS_DO_JOGO().map((d, i) => `<option value="${i}">${esc(d.nomes)}: ${esc(d.regra)}</option>`).join('')}</select></label>
      <div class="txAtiv txDefesa" id="fm_def"></div>
      <label class="chk"><input type="checkbox" id="fm_defapos" ${m.defesaApos ? 'checked' : ''}> Show it after the attack (not before)</label>
      <div class="sub pequena">What the app does by itself when a hero attacks it</div>
      <div class="botoes">${[['jogo', 'Same as the behaviour monster'], ['nenhum', 'Nothing (the table applies the text)'], ['proprio', 'My own effect']].map(([k, n]) => `<button class="sm ${(m.defesaModo || 'jogo') === k ? 'ativo' : ''}" data-dmodo="${k}">${n}</button>`).join('')}</div>
      ${(m.defesaModo || 'jogo') === 'proprio' ? `<div id="fm_defef">${(m.defesaEfeitos || []).map((f, i) => `<div class="linha efeitoDef"><select data-ef="tipo" data-i="${i}">${EFEITOS_DEFESA.map(([k, n]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select><label>N <select data-ef="n" data-i="${i}">${[1, 2, 3, 4, 5].map(v => `<option ${f.n === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><button class="sm" data-efx="${i}">✕</button></div>`).join('') || '<p class="ajuda">No effect yet.</p>'}</div><button class="sm" id="fm_defadd">+ Effect</button><p class="ajuda">Applied every time a hero attacks this monster, before the attack. Write the same in the rules above so the players know.</p>`
        : `<p class="ajuda">${(m.defesaModo || 'jogo') === 'nenhum' ? 'The app changes nothing; the players apply the defense at the table.' : 'The behaviour monster’s rule: ' + (DEFESA_AUTOMATICA[m.tipo] || 'none, the players apply the text at the table') + '.'}</p>`}
      <div class="sub">Default loot</div>
      <div id="fm_loot"></div>
      <div class="sub">Sounds</div>
      <div id="fm_sons"></div>
    </div></div>`;
  ligarRetrato(c, m, 256); ligarEspelhos(c, m);
  liga(c, m, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = m.nome + ' '; renderFichasLista(true); } if (k === 'size') m.size = +m.size; });
  editorDeDescricao(c.querySelector('[data-descricao]'), m, 'desc', 'Description', () => marcar(m, c));
  ligaChks(c, m);
  c.querySelectorAll('[data-wr]').forEach(s => s.onchange = () => { m.wr = (m.wr || []).filter(z => z.dano !== s.dataset.wr); if (s.value) { const [tipo, quando] = s.value.split(':'); m.wr.push({ dano: s.dataset.wr, tipo, quando: quando || 'always' }); } marcar(m, c); });
  ligarSons(c.querySelector('#fm_sons'), m, c);
  c.querySelectorAll('[data-arte]').forEach(b => b.onclick = () => { m.arteModo = b.dataset.arte; if (m.arteModo === 'imagem' && !m.arte) aplicarPadraoArte(m, false); marcar(m, c); renderFichas(); });
  const ua = c.querySelector('[data-arteimg]'); if (ua) ua.onchange = async e => { const f = e.target.files[0]; if (!f) return; if (!m.arte) aplicarPadraoArte(m, false); m.arte = await lerImagem(f, 768); marcar(m); renderFichas(); };
  const aes = c.querySelector('[data-artesc]'); if (aes) aes.onchange = e => { m.arteEscala = +e.target.value; marcar(m, c); };
  const aey = c.querySelector('[data-artey]'); if (aey) aey.onchange = e => { m.arteAltura = +e.target.value; marcar(m, c); };
  const aex = c.querySelector('[data-artex]'); if (aex) aex.onchange = e => { m.arteLado = +e.target.value; marcar(m, c); };
  const uc = c.querySelector('[data-artecard]'); if (uc) uc.onclick = () => { if (!m.arte) aplicarPadraoArte(m, false); m.arte = m.standee; marcar(m); renderFichas(); };
  c.querySelectorAll('[data-fig]').forEach(b => b.onclick = () => { m.figura = b.dataset.fig; marcar(m, c); renderFichas(); desenhar(); });
  const us = c.querySelector('[data-standee]'); if (us) us.onchange = async e => { const f = e.target.files[0]; if (!f) return; m.standee = await lerImagem(f, 512); marcar(m); delete IMG['standee:' + m.id]; renderFichas(); desenhar(); };
  const es = c.querySelector('[data-esc]'); if (es) es.onchange = e => { m.escalaStandee = +e.target.value; marcar(m, c); desenhar(); };
  const fmm = c.querySelector('#fm_modelo'); if (fmm) campoModelo3d(fmm, m, () => marcar(m, c));
  $('#fm_dup').onclick = () => { const d = clone(m); d.id = 'B_' + uid(); d.nome = m.nome + ' (copy)'; d.custom = true; bestiario().monstros.push(d); fichaSel = d.id; renderFichas(); };
  $('#fm_apaga').onclick = () => apagarFicha(m);
  const tiers = () => { const el = $('#fm_tiers'); const primeiro = (m.tiers || []).reduce((a, t, i) => a < 0 || t.tier < m.tiers[a].tier ? i : a, -1);
    el.innerHTML = (m.tiers || []).map((t, i) => `<div class="linha tier"><label>tier <input type="number" min="1" max="10" value="${t.tier}" data-t="tier" data-i="${i}"></label><label>hp <input type="number" min="1" value="${t.hp}" data-t="hp" data-i="${i}"></label><label>def <input type="number" min="0" value="${t.def}" data-t="def" data-i="${i}"></label><label>atk <input type="number" min="0" value="${t.atk}" data-t="atk" data-i="${i}"></label><button class="sm" data-tx="${i}">✕</button>${i === primeiro ? `<button class="sm" id="fm_balancear" title="Recalculate the other tiers from this one with the game's own curve: health grows ×1.2, ×1.25, ×1.4, ×1.35, ×1.3, ×1.25, ×1.2 per tier, defense +1 per tier, attack +1 up to tier 4 and then +1 every two tiers${m.tiers.length === 1 ? '. With this tier alone, it creates the tiers up to ' + fimDaCurva(t.tier) : ''}">⚖ Balance</button>` : ''}</div>`).join('') || '<p class="ajuda">No tier: the monster cannot be placed. Add one.</p>';
    el.querySelectorAll('[data-t]').forEach(inp => inp.onchange = () => { m.tiers[+inp.dataset.i][inp.dataset.t] = +inp.value || 0; marcar(m, c); });
    el.querySelectorAll('[data-tx]').forEach(b => b.onclick = () => { m.tiers.splice(+b.dataset.tx, 1); marcar(m, c); tiers(); });
    const bal = el.querySelector('#fm_balancear'); if (bal) bal.onclick = () => {
      const base = m.tiers[primeiro]; const outros = m.tiers.filter(t => t !== base);
      const alvo = outros.length ? [...new Set(outros.map(t => t.tier).filter(n => n > base.tier))].sort((a, b) => a - b) : Array.from({ length: fimDaCurva(base.tier) - base.tier }, (_, k) => base.tier + 1 + k);
      if (!alvo.length) return aviso('No tier above tier ' + base.tier + ' to balance.');
      if (outros.length && !confirm('Recalculate tier' + (alvo.length > 1 ? 's ' + alvo[0] + '–' + alvo[alvo.length - 1] : ' ' + alvo[0]) + ' from tier ' + base.tier + ' with the game\u2019s curve? Their current numbers are replaced.')) return;
      m.tiers = [base, ...alvo.map(n => tierPelaCurva(base, n))];
      marcar(m, c); tiers(); aviso('Tiers ' + m.tiers.map(t => t.tier).join(', ') + ' balanced from tier ' + base.tier + '.');
    }; };
  tiers(); $('#fm_tier').onclick = () => { const u = (m.tiers || []).reduce((a, t) => !a || t.tier > a.tier ? t : a, null); m.tiers.push(u ? tierPelaCurva(u, u.tier + 1) : { tier: 1, hp: 20, def: 1, atk: 1 }); marcar(m, c); tiers(); };
  const ativs = (chave, el) => { const lista = m[chave] || (m[chave] = []); el.innerHTML = lista.map((a, i) => `<div class="ativ ${chave === 'taticas' ? 'tatica' : ''}"><div class="cabAtiv"><span class="numAtiv">${chave === 'taticas' ? 'Tactic' : 'Activation'} ${i + 1}</span><input data-a="nome" data-i="${i}" value="${esc(a.nome || '')}" placeholder="Name"><button class="sm" data-ax="${i}" title="Delete this ${chave === 'taticas' ? 'tactic' : 'activation'}">✕</button></div>
      <div class="nums">${['speed', 'damage', 'aim', 'attack', 'range', 'healing', 'shield', 'initiative'].map(k => `<label>${k}<input type="number" data-a="${k}" data-i="${i}" value="${a[k] || 0}"></label>`).join('')}<label>range type<select data-a="rangeType" data-i="${i}">${ALCANCES.map(r => `<option ${a.rangeType === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label><label>next<select data-a="next" data-i="${i}"><option value="">—</option>${lista.map((z, j) => j !== i ? `<option value="${esc(z.id || z.nome)}" ${a.next === (z.id || z.nome) ? 'selected' : ''}>${esc(z.nome)}</option>` : '').join('')}</select></label></div>
      <div class="txAtiv" data-i="${i}"></div></div>`).join('') || '<p class="ajuda">None.</p>';
    el.querySelectorAll('[data-a]').forEach(inp => { const h = () => { const a = lista[+inp.dataset.i]; a[inp.dataset.a] = inp.type === 'number' ? +inp.value || 0 : inp.value; marcar(m, c); }; if (inp.tagName === 'SELECT' || inp.type === 'number') inp.onchange = h; else inp.oninput = h; });
    el.querySelectorAll('.txAtiv').forEach(d => editorDeTexto(d, lista[+d.dataset.i], () => marcar(m, c)));
    el.querySelectorAll('[data-ax]').forEach(b => b.onclick = () => { const [z] = lista.splice(+b.dataset.ax, 1); const ref = z && (z.id || z.nome); if (ref) lista.forEach(a => { if (a.next === ref) a.next = ''; }); marcar(m, c); ativs(chave, el); }); };
  ativs('ativacoes', $('#fm_ativs')); ativs('taticas', $('#fm_tats'));
  const dfs = { text: m.defesa || '', hint: '' }; const dEl = $('#fm_def');
  editorDeTexto(dEl, dfs, () => { m.defesa = dfs.text; marcar(m, c); }, { soRegras: true });
  $('#fm_defapos').onchange = e => { m.defesaApos = e.target.checked; marcar(m, c); };
  $('#fm_defimport').onclick = () => { const cp = $('#fm_defcopiaCampo'); cp.hidden = !cp.hidden; $('#fm_defimport').classList.toggle('ativo', !cp.hidden); if (!cp.hidden) $('#fm_defcopia').focus(); };
  $('#fm_defcopia').onchange = e => { const d = DEFESAS_DO_JOGO()[+e.target.value]; if (!d) return; m.defesa = d.texto; m.defesaApos = d.apos;
    // the automatic part goes with the copied defense when the mod can do it; the Anger of the berserker becomes "damage +1"
    let nota = '';
    if (d.regra === 'Anger') { m.defesaModo = 'proprio'; m.defesaEfeitos = [{ tipo: 'damage', n: 1 }]; }
    else if (d.tipos.includes(m.tipo)) m.defesaModo = 'jogo';
    else { m.defesaModo = 'nenhum'; m.defesaEfeitos = []; if (d.tipos.some(t => DEFESA_AUTOMATICA[t])) nota = ' In the game part of it is automatic; add it under “My own effect” if you want the app to apply it.'; }
    marcar(m, c); renderFichas(); aviso('Defense “' + d.regra + '” copied.' + nota); };
  c.querySelectorAll('[data-dmodo]').forEach(b => b.onclick = () => { m.defesaModo = b.dataset.dmodo; if (m.defesaModo === 'proprio' && !(m.defesaEfeitos || []).length) m.defesaEfeitos = [{ tipo: 'damage', n: 1 }]; marcar(m, c); renderFichas(); });
  c.querySelectorAll('[data-ef]').forEach(s => s.onchange = () => { const f = m.defesaEfeitos[+s.dataset.i]; f[s.dataset.ef] = s.dataset.ef === 'n' ? +s.value : s.value; marcar(m, c); });
  c.querySelectorAll('[data-efx]').forEach(b => b.onclick = () => { m.defesaEfeitos.splice(+b.dataset.efx, 1); marcar(m, c); renderFichas(); });
  const efa = c.querySelector('#fm_defadd'); if (efa) efa.onclick = () => { (m.defesaEfeitos = m.defesaEfeitos || []).push({ tipo: 'damage', n: 1 }); marcar(m, c); renderFichas(); };
  $('#fm_ativ').onclick = () => { m.ativacoes.push({ id: 'ACT_' + uid(), nome: 'Attack', speed: 3, damage: 2, aim: 0, attack: 1, range: 0, healing: 0, shield: 0, initiative: 0, rangeType: 'Melee', next: '', text: '', hint: '' }); marcar(m, c); ativs('ativacoes', $('#fm_ativs')); };
  $('#fm_tat').onclick = () => { m.taticas.push({ id: 'TAC_' + uid(), nome: 'Tactic', speed: 3, damage: 2, aim: 0, attack: 1, range: 0, healing: 0, shield: 0, initiative: 0, rangeType: 'Melee', next: '', text: '', hint: '' }); marcar(m, c); ativs('taticas', $('#fm_tats')); };
  const loot = () => { const el = $('#fm_loot'); m.loot = m.loot || []; el.innerHTML = `<select class="poolAdd"><option value="">+ add a workshop item…</option>${ITENS_B().filter(l => !m.loot.includes(l.id)).map(l => `<option value="${l.id}">${esc(l.nome)}</option>`).join('')}</select><div>${m.loot.map((id, i) => `<span class="tag">${esc(nomeItem(id))}${itemDaOficina(id) ? '' : ' (not in the workshop!)'} <a href="#" data-ld="${i}">✕</a></span>`).join('') || '<span class="ajuda">none (the app draws by value)</span>'}</div>${ITENS_B().length ? '' : '<p class="ajuda">Only workshop items can be dropped: import or create them in the Items tab.</p>'}`;
    el.querySelector('.poolAdd').onchange = e => { if (e.target.value) { m.loot.push(e.target.value); marcar(m, c); loot(); } }; el.querySelectorAll('[data-ld]').forEach(a => a.onclick = ev => { ev.preventDefault(); m.loot.splice(+a.dataset.ld, 1); marcar(m, c); loot(); }); };
  loot();
}
/* soNomes: only the names changed (typing a name): the thumbnails are left alone */
function renderFichasLista(soNomes) { const l = $('#f_lista'); if (!l) return; const lista = abaF === 'itens' ? bestiario().itens.filter(x => tipoItem && doTipoItem(x, tipoItem)) : bestiario()[abaF]; l.querySelectorAll('.no').forEach((d, i) => { const x = lista[i]; if (!x) return; d.querySelector('div > div').textContent = x.nome || '(no name)'; if (soNomes) return; const img = d.querySelector('img.face'); if (img && abaF === 'pecas' && defPeca(x.id)) img.src = miniatura(defPeca(x.id), x); if (img && abaF === 'objetos') img.src = iconeObj(x.id); const sm = d.querySelector('small'); if (sm && (abaF === 'pecas' || abaF === 'objetos')) sm.textContent = (x.cells || []).length + ' square(s) · ' + extensao(x.cells || [[0, 0]]).join('×'); }); }

// ------------------------------------------------------------ NPC sheet
function fichaPersonagem(c, p) {
  const herois = CAT.herois.filter(h => h._cls === 'HeroModel');
  c.innerHTML = `<div class="cabF"><h2>${esc(p.nome)} <span class="etq custom">${p.custom ? 'custom' : 'from the game'}</span></h2><div class="botoes"><button class="sm perigo" id="fp_apaga">Delete</button></div></div><div class="folha"><div class="col">
    ${retratoCampo(p, 'Portrait in the story boxes (speaker and cast). Transparent PNG of the bust, 512 px or more, looks best.')}
    <label class="campo">Name <input data-c="nome" value="${esc(p.nome)}"></label>
    ${ehHeroiDaCaixa(p.base) ? '<p class="ajuda">A hero of the box used as an NPC: it only speaks in dialogues. To change the playable hero, use the Heroes tab.</p>' : ''}
    <label class="campo">Notes (for you, not shown in the app) <textarea data-c="desc" rows="3">${esc(p.desc || '')}</textarea></label>
    </div></div>`;
  ligarRetrato(c, p, 512); ligarEspelhos(c, p);
  liga(c, p, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = p.nome + ' '; renderFichasLista(true); } });
  $('#fp_apaga').onclick = () => apagarFicha(p);
}

// ------------------------------------------------------------ item sheet
function fichaItem(c, i) {
  const mat = i.cls === 'CraftingMaterialModel';
  const bases = CAT.itens.filter(z => z._cls === (i.cls === 'TableItem' ? 'TrinketModel' : i.cls) && z.name_en && z.name_en !== 'Text');
  const receitas = (oficina().receitas || []).filter(r => r.item === i.id);
  c.innerHTML = `<div class="cabF"><h2>${esc(i.nome)} <span class="etq custom">${i.custom ? 'custom' : 'from the game'}</span></h2><div class="botoes"><button class="sm perigo" id="fi_apaga">Delete</button></div></div><div class="folha"><div class="col">
    ${retratoCampo(i, mat ? 'The material’s picture in the app. Square, 256 px or more.' : 'Card art shown in the app. Square, 256 px or more.')}
    <label class="campo">Name <input data-c="nome" value="${esc(i.nome)}"></label>
    <div data-descricao></div>
    ${mat ? `<div class="duas"><label class="campo">Kind <select data-c="tipoMaterial"><option value="0" ${!+i.tipoMaterial ? 'selected' : ''}>Base material (common: leather, metal…)</option><option value="1" ${+i.tipoMaterial === 1 ? 'selected' : ''}>Essence (uncommon: Ignos, Lumos…)</option></select></label>
      <label class="campo">Value (loot points) <input type="number" min="1" data-c="valor" value="${i.valor || 5}"></label></div>
      <p class="ajuda">Random loot is paid in materials up to its points: the value is what one unit is worth. Recipes list how many units they cost.</p>`
    : `<div class="duas"><label class="campo">Kind <input value="${esc(TIPOS_ITEM.find(t => doTipoItem(i, t[0]))?.[1] || i.cls)}${i.cls === 'TableItem' ? ' (table-only card)' : ''}" disabled></label><label class="campo">Rarity <select data-c="raridade">${RARIDADES.map((r, k) => k ? `<option value="${k}" ${i.raridade === k ? 'selected' : ''}>${r}</option>` : '').join('')}</select></label></div>
    <div class="duas"><label class="campo">Value (gold) <input type="number" min="0" data-c="valor" value="${i.valor || 0}"></label>${i.cls === 'ConsumableModel' ? `<label class="chk"><input type="checkbox" data-c="unico" ${i.unico ? 'checked' : ''}> Unique (one per party)</label>` : ''}</div>
    ${i.cls !== 'TableItem' ? `<label class="campo">Effect of (game item of the same kind) <select data-c="efeitoBase"><option value="">— none: played at the table —</option>${bases.map(b => `<option value="${esc(b._id)}" ${(i.efeitoBase || (i.custom ? '' : i.base)) === b._id ? 'selected' : ''}>${esc(b.name_en)}</option>`).join('')}</select><small class="ajuda">The app applies the effect of this game item; the card shows your name, text and art.</small></label>` : '<p class="ajuda">A card the app shows and hands to the party; its effect is applied at the table.</p>'}`}
    <div class="sub">Recipes</div><p class="ajuda">${receitas.length ? 'Crafted by: ' + receitas.map(r => esc(nomeReceita(r))).join(', ') + '.' : mat ? 'Recipes may cost this material (Recipes tab).' : 'No recipe crafts it yet.'} <button class="sm" id="fi_receita">${mat ? 'Open the Recipes tab' : '+ A recipe for it'}</button></p>
    </div></div>`;
  ligarRetrato(c, i, 256); ligarEspelhos(c, i);
  editorDeDescricao(c.querySelector('[data-descricao]'), i, 'desc', mat ? 'Description' : 'Description (the card text)', () => marcar(i, c));
  liga(c, i, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = i.nome + ' '; renderFichasLista(true); } if (k === 'raridade') i.raridade = +i.raridade; if (k === 'tipoMaterial') i.tipoMaterial = +i.tipoMaterial; });
  ligaChks(c, i);
  $('#fi_receita').onclick = () => { if (mat) { abaF = 'receitas'; fichaSel = null; renderFichas(); } else novaReceita(i.id); };
  $('#fi_apaga').onclick = () => apagarFicha(i);
}

// ------------------------------------------------------------ workshop tiles and objects: shape by clicking squares, colour from a palette
/* the shape editor: a grid of squares; a click turns a square on or off. The shape must stay in one piece (squares joined by a side). */
const GRADE_FORMA = 12;
function editorDeForma(el, v, depois) {
  const pinta = () => {
    const S = new Set((v.cells || []).map(c => c.join(',')));
    const [w, h] = extensao(v.cells.length ? v.cells : [[0, 0]]);
    // one free row and column around the shape (while it fits) so it can also grow to the left and upwards
    const ox = w < GRADE_FORMA ? 1 : 0, oy = h < GRADE_FORMA ? 1 : 0;
    el.innerHTML = `<div class="forma" style="grid-template-columns:repeat(${GRADE_FORMA},1fr)">${Array.from({ length: GRADE_FORMA * GRADE_FORMA }, (_, i) => { const x = i % GRADE_FORMA - ox, y = Math.floor(i / GRADE_FORMA) - oy; return `<button class="cq ${S.has(x + ',' + y) ? 'on' : ''}" data-q="${x},${y}" style="${S.has(x + ',' + y) ? 'background:' + esc(v.cor || '#8a7a66') : ''}"></button>`; }).join('')}</div>
      <div class="linha"><small class="ajuda">${v.cells.length} square(s) · ${w}×${h} (up to ${GRADE_FORMA}×${GRADE_FORMA}). Click to add or take out a square; the shape must stay in one piece.</small></div>
      <div class="linha botoes"><button class="sm" data-f="gira">↻ Turn</button><button class="sm" data-f="limpa">Clear</button></div>`;
    el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const [x, y] = b.dataset.q.split(',').map(Number); const k = x + ',' + y; const tinha = S.has(k);
      let novo = tinha ? v.cells.filter(c => c.join(',') !== k) : v.cells.concat([[x, y]]);
      if (!novo.length) return aviso('A piece needs at least one square.');
      if (!inteira(novo)) return aviso(tinha ? 'Taking that square out would split the piece in two.' : 'That square does not touch the piece: squares must join by a side.');
      const [nw, nh] = extensao(novo); if (nw > GRADE_FORMA || nh > GRADE_FORMA) return aviso('Up to ' + GRADE_FORMA + '×' + GRADE_FORMA + ' squares.');
      v.cells = novo; depois(); pinta();
    });
    el.querySelector('[data-f="gira"]').onclick = () => { v.cells = v.cells.map(c => girar(c, 90)); depois(); pinta(); };
    el.querySelector('[data-f="limpa"]').onclick = () => { v.cells = [[0, 0]]; depois(); pinta(); };
  };
  const antes = depois; depois = () => { const x0 = Math.min(...v.cells.map(c => c[0])), y0 = Math.min(...v.cells.map(c => c[1])); v.cells = v.cells.map(([x, y]) => [x - x0, y - y0]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    antes(); };
  pinta();
}
function inteira(cells) { if (!cells.length) return false; const S = new Set(cells.map(c => c.join(','))); const vistos = new Set([cells[0].join(',')]); const fila = [cells[0]]; while (fila.length) { const [x, y] = fila.pop(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const k = (x + dx) + ',' + (y + dy); if (S.has(k) && !vistos.has(k)) { vistos.add(k); fila.push([x + dx, y + dy]); } }); } return vistos.size === cells.length; }
function paletaDeCores(atual, cb) {
  const d = document.createElement('div'); d.className = 'cores';
  d.innerHTML = PALETA_CORES.map(c => `<button class="cor ${c === atual ? 'ativo' : ''}" data-cor="${c}" style="background:${c}" title="${c}"></button>`).join('') + `<label class="cor outra" title="Another colour"><input type="color" value="${esc(atual || '#8a7a66')}"></label>`;
  d.querySelectorAll('[data-cor]').forEach(b => b.onclick = () => cb(b.dataset.cor));
  d.querySelector('input').onchange = e => cb(e.target.value);
  return d;
}
/* what a change of shape breaks on the board: pillars out of their sockets, overlaps (warned in the checklist) */
function aoMudarForma(tipo, v) { (campanha ? campanha.missoes : [projeto]).flatMap(m => m.salas).forEach(s => { if (tipo === 'pecas') s.pecas.forEach(p => { if (p.tile !== v.id) return; const e = encaixesDaPeca(p); p.pilares = (p.pilares || []).filter(q => e.has(q.pos.join(','))); }); }); }

/* the surface of a workshop tile: colour (with the generic grain), one picture across the whole tile, or a picture per square */
const MODOS_TEXTURA = [['cor', 'Colour'], ['inteira', 'One picture for the whole tile'], ['repetida', 'One picture repeated on every square']];
function fichaPeca(c, v) {
  const t = defPeca(v.id); const modo = v.texModo || 'cor';
  const [w, h] = extensao(v.cells && v.cells.length ? v.cells : [[0, 0]]);
  c.innerHTML = `<div class="cabF"><h2>${esc(v.nome)} <span class="etq">workshop ${v.underlay ? 'underlay' : 'tile'}</span></h2><div class="botoes"><button class="sm" id="fv_dup">Duplicate</button><button class="sm perigo" id="fv_apaga">Delete</button></div></div><div class="folha"><div class="col">
    <label class="campo">Name <input data-c="nome" value="${esc(v.nome)}"></label>
    <div class="sub">Kind</div>
    <div class="botoes"><button class="sm ${!v.underlay ? 'ativo' : ''}" data-und="0">Tile</button><button class="sm ${v.underlay ? 'ativo' : ''}" data-und="1">Underlay</button></div>
    ${v.underlay ? `<label class="campo">Copies in your box <select id="fv_copias">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${(+v.copias || 1) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><p class="ajuda">An underlay lies on the floor under the tiles (level 0), like water or spikes: the tiles go on top of it. It is not bound to one room, and the map may use it as many times as you have copies.</p>` : ''}
    <div class="sub">Shape</div><div id="fv_forma"></div>
    <div class="sub">Surface</div>
    <div class="botoes">${MODOS_TEXTURA.map(([k, n]) => `<button class="sm ${modo === k ? 'ativo' : ''}" data-tm="${k}">${n}</button>`).join('')}</div>
    ${modo === 'cor' ? '<p class="ajuda">The tile has a generic stone grain; the colour goes over it.</p><div id="fv_cores"></div>'
      : modo === 'inteira' ? `<div class="retrato" style="margin-top:6px"><div class="quadro">${v.texInteira ? `<img src="${v.texInteira}" alt="">` : '<span>no picture</span>'}</div><div><label class="sm botaoArquivo">${v.texInteira ? 'Replace the picture…' : 'Upload the picture (PNG, JPG)…'}<input type="file" accept="image/png,image/jpeg,image/webp" data-texint hidden></label>${v.texInteira ? '<button class="sm" data-texintx>✕</button>' : ''}<p class="ajuda">Stretched over the ${w}×${h} rectangle around the shape; squares outside the shape are cut away. Best as a ${w}:${h} picture (a scan or a photo of your tile, seen from above). It turns with the tile.</p></div></div>`
      : `<div class="retrato" style="margin-top:6px"><div class="quadro">${v.texRepetida ? `<img src="${v.texRepetida}" alt="">` : '<span>no picture</span>'}</div><div><label class="sm botaoArquivo">${v.texRepetida ? 'Replace the picture…' : 'Upload the picture (PNG, JPG)…'}<input type="file" accept="image/png,image/jpeg,image/webp" data-texrep hidden></label>${v.texRepetida ? '<button class="sm" data-texrepx>✕</button>' : ''}<p class="ajuda">One square of floor (a square picture fits best), repeated on each of the ${(v.cells || []).length} squares, like the game tiles. It turns with the tile.</p></div></div>`}
    <label class="campo">Notes (for you) <textarea data-c="notas" rows="3">${esc(v.notas || '')}</textarea></label>
    </div><div class="col">
    <div class="sub">Preview</div><div class="previa"><img id="fv_prev" src="${miniatura(t, v)}" alt=""></div>
    <p class="ajuda">${v.underlay ? 'A workshop underlay is your own board piece: in the app the mod lays it under the tiles, with your picture or colour.' : 'A workshop tile is your own physical piece: once per room, reusing it in another room asks to remove the earlier one, and it takes pillars in its sockets (between two squares on a straight edge) when elevated. In the app the mod builds it as a flat tile of this shape, with your picture or colour, and the heroes walk on it like on any tile.'}</p>
    </div></div>`;
  const refazer = () => { const img = c.querySelector('#fv_prev'); if (img) img.src = miniatura(defPeca(v.id), v); renderFichasLista(); desenhar(); };
  liga(c, v, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = v.nome + ' '; renderFichasLista(true); } });
  editorDeForma(c.querySelector('#fv_forma'), v, () => { aoMudarForma('pecas', v); refazer(); });
  const cores = () => { const el = c.querySelector('#fv_cores'); if (!el) return; el.innerHTML = ''; el.appendChild(paletaDeCores(v.cor, cor => { v.cor = cor; cores(); editorDeForma(c.querySelector('#fv_forma'), v, () => { aoMudarForma('pecas', v); refazer(); }); refazer(); })); };
  cores();
  c.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { v.texModo = b.dataset.tm; if (v.texModo === 'cor') delete v.texModo; renderFichas(); desenhar(); });
  c.querySelectorAll('[data-und]').forEach(b => b.onclick = () => {
    const quer = b.dataset.und === '1'; if (!!v.underlay === quer) return;
    const salas = (campanha ? campanha.missoes : [projeto]).flatMap(m => m.salas);   // the campaign's maps share the workshop
    const usos = salas.reduce((n, sl) => n + sl.pecas.filter(p => p.tile === v.id).length, 0);
    if (usos && !confirm(v.nome + ' is on the board ' + usos + ' time(s). Turn it into ' + (quer ? 'an underlay (it goes to level 0, under the tiles)' : 'a tile') + '?')) return;
    if (quer) { v.underlay = true; v.copias = v.copias || Math.max(1, usos); salas.forEach(sl => sl.pecas.forEach(p => { if (p.tile === v.id) { p.level = 0; p.pilares = []; } })); } else delete v.underlay;
    if (pecaEscolhida === v.id) pecaEscolhida = PECAS[0].id; renderFichas(); desenhar(); });
  const cp = c.querySelector('#fv_copias'); if (cp) cp.onchange = e => { v.copias = +e.target.value; };
  const ti = c.querySelector('[data-texint]'); if (ti) ti.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.texInteira = await lerImagem(f, Math.min(1536, 256 * Math.max(w, h))); renderFichas(); desenhar(); };
  const tx = c.querySelector('[data-texintx]'); if (tx) tx.onclick = () => { delete v.texInteira; renderFichas(); desenhar(); };
  const tr = c.querySelector('[data-texrep]'); if (tr) tr.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.texRepetida = await lerImagem(f, 256); renderFichas(); desenhar(); };
  const trx = c.querySelector('[data-texrepx]'); if (trx) trx.onclick = () => { delete v.texRepetida; renderFichas(); desenhar(); };
  $('#fv_dup').onclick = () => { const d = clone(v); d.id = 'B_' + uid(); d.nome = v.nome + ' (copy)'; oficina().pecas.push(d); fichaSel = d.id; renderFichas(); };
  $('#fv_apaga').onclick = () => apagarFicha(v);
}

/* a 3D figure for a monster of the workshop: an OBJ file (saved next to the map files) and one texture */
const GIROS_MODELO = [[0, 'As exported'], [90, 'Turned 90°'], [180, 'Turned around (180°)'], [270, 'Turned 270°']];
function campoModelo3d(el, m, mudou, objeto) {
  const mo = m.modelo; const blob = mo && AUDIOS[mo.arquivo];
  el.innerHTML = `<div class="retrato" style="margin-top:8px"><div class="quadro alto"><canvas width="180" height="240" data-previa3d></canvas></div><div>
    <div class="linha"><label class="sm botaoArquivo">${mo ? 'Replace the model…' : 'Upload the model (OBJ)…'}<input type="file" accept=".obj" data-obj hidden></label>${mo ? `<b>${esc(mo.nome)}</b> <small class="ajuda">${blob ? Math.round(blob.size / 1024) + ' KB' : 'file not in this browser: upload it again'}${mo.vertices ? ' · ' + mo.vertices.toLocaleString() + ' vertices, ' + (mo.faces || 0).toLocaleString() + ' faces' : ''}</small>` : ''}</div>
    <div class="linha" style="margin-top:6px"><label class="sm botaoArquivo">${m.modeloTex ? 'Replace the texture…' : 'Upload the texture (PNG, JPG)…'}<input type="file" accept="image/png,image/jpeg,image/webp" data-objtex hidden></label>${m.modeloTex ? `<img src="${m.modeloTex}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px"><button class="sm" data-objtexx>✕</button>` : '<span class="ajuda">none: a grey unpainted miniature</span>'}</div>
    <div class="duas">${objeto ? `<label class="campo">Height <select data-altmod>${ALTURAS_MODELO.map(([k, n]) => `<option value="${k}" ${(m.alturaModelo || 1) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : `<label class="campo">Size <select data-escmod>${ESCALAS_STANDEE.map(([k, n]) => `<option value="${k}" ${(m.escalaModelo || 1) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
    <label class="campo">Facing <select data-giromod>${GIROS_MODELO.map(([k, n]) => `<option value="${k}" ${(m.giroModelo || 0) === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <p class="ajuda">${objeto ? 'Your model stands on the object’s squares, centred, as tall as the height chosen, turned with the object; clicking it uses the object.' : 'The figure of the behaviour monster is hidden and your model stands in its place, as tall as the figure it replaces (times the size), turned as the monster turns.'} <b>OBJ</b> (Wavefront) with UVs and one texture image: in Blender, File → Export → Wavefront (.obj). Up to about 100,000 faces keeps the game smooth. The file is saved next to the map files.</p></div></div>`;
  const cv = el.querySelector('[data-previa3d]');
  if (blob) previaObj(cv, blob, m); else { const g = cv.getContext('2d'); g.fillStyle = '#15171b'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#8b93a1'; g.font = '12px system-ui'; g.fillText('no model', 60, 124); }
  el.querySelector('[data-obj]').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; if (!/\.obj$/i.test(f.name)) return aviso('Use an OBJ file (Wavefront).');
    const txt = await f.text(); const vertices = (txt.match(/^v\s/gm) || []).length, faces = (txt.match(/^f\s/gm) || []).length;
    if (!vertices || !faces) return aviso('This OBJ has no vertices or faces.');
    const nome = (objeto ? 'object-' : 'figure-') + (slug(m.nome || (objeto ? 'object' : 'monster')) || 'model').slice(0, 24) + '-' + uid().slice(-5) + '.obj';
    await guardarAudio(nome, f); m.modelo = { arquivo: nome, nome: f.name, vertices, faces };
    mudou && mudou(); campoModelo3d(el, m, mudou, objeto); aviso('Model added' + (faces > 150000 ? ' (a heavy model: consider decimating it)' : '') + '.');
  };
  el.querySelector('[data-objtex]').onchange = async e => { const f = e.target.files[0]; if (!f) return; m.modeloTex = await lerImagem(f, 1024); mudou && mudou(); campoModelo3d(el, m, mudou, objeto); };
  const tx = el.querySelector('[data-objtexx]'); if (tx) tx.onclick = () => { delete m.modeloTex; mudou && mudou(); campoModelo3d(el, m, mudou, objeto); };
  const em = el.querySelector('[data-escmod]'); if (em) em.onchange = e => { m.escalaModelo = +e.target.value; mudou && mudou(); };
  const am = el.querySelector('[data-altmod]'); if (am) am.onchange = e => { m.alturaModelo = +e.target.value; mudou && mudou(); };
  el.querySelector('[data-giromod]').onchange = e => { m.giroModelo = +e.target.value; mudou && mudou(); };   // the running preview reads the facing every frame
}
/* a turning cloud of the model's points (just to see that it is the right file and how it faces) */
const _previas3d = new WeakMap();
async function previaObj(cv, blob, m) {
  if (!blob) return; const antigo = _previas3d.get(cv); if (antigo) cancelAnimationFrame(antigo.raf);
  const txt = await blob.text(); const vs = []; const re = /^v\s+(\S+)\s+(\S+)\s+(\S+)/gm; let r;
  while ((r = re.exec(txt))) vs.push([+r[1], +r[2], +r[3]]);
  if (!vs.length) return;
  const passo = Math.max(1, Math.floor(vs.length / 5000)); const pts = vs.filter((_, i) => i % passo === 0);
  const min = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k]))), max = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k])));
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, alt = Math.max(1e-6, max[1] - min[1]);
  const g = cv.getContext('2d'); const k = (cv.height - 30) / alt; const estado = { raf: 0 }; _previas3d.set(cv, estado);
  const t0 = performance.now();
  const quadro = t => {
    if (!cv.isConnected) return;
    const a = ((m.giroModelo || 0) * Math.PI / 180) + (t - t0) / 2500; const ca = Math.cos(a), sa = Math.sin(a);
    g.fillStyle = '#15171b'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgba(243,207,143,.55)';
    for (const p of pts) { const x = (p[0] - cx) * ca - (p[2] - cz) * sa; g.fillRect(cv.width / 2 + x * k, cv.height - 15 - (p[1] - min[1]) * k, 1.4, 1.4); }
    estado.raf = requestAnimationFrame(quadro);
  };
  estado.raf = requestAnimationFrame(quadro);
}
const ALTURAS_MODELO = [[0.3, 'Very low (like a coin or a trap)'], [0.6, 'Low (like a crate)'], [1, 'One square (like a hero)'], [1.5, 'Tall (like a big monster)'], [2.2, 'Very tall (like a statue)'], [3.2, 'Huge (like a tower)']];
/* size of a monster's standing card, relative to the figure it replaces */
const ESCALAS_STANDEE = [[0.75, 'Smaller than the figure (×0.75)'], [1, 'As tall as the figure'], [1.25, 'Taller (×1.25)'], [1.5, 'Much taller (×1.5)'], [2, 'Double (×2)']];
/* what the app applies by itself, per monster type, when a hero attacks (the rest of each defense is applied at the table) */
const DEFESA_AUTOMATICA = { Berserker: 'damage +1, permanently (Anger)', Golem: 'raises its defense', Vampire: 'raises its defense', Zealot: 'strengthens another enemy', Doomcaller: 'changes its own numbers' };
const EFEITOS_DEFESA = [['damage', 'Damage +N, permanently'], ['nextDamage', 'Damage +N on its next activation'], ['defense', 'Defense +N, permanently'], ['roundDefense', 'Defense +N until the end of the round'], ['heal', 'Recovers N health']];
/* the defenses of the game's monsters (one entry per distinct text), for copying into another monster */
let _defesas = null;
function DEFESAS_DO_JOGO() {
  if (_defesas) return _defesas; const porTexto = new Map();
  CAT.monstros.forEach(z => { const t = (z.defense_en || '').trim(); if (!t || !z.name_en || /^ENEMY_/.test(z.name_en)) return; const d = porTexto.get(t) || { texto: t, apos: !!z.ShowDefenseAfterAttack, nomes: [], tipos: [], regra: (t.match(/<b>([^<]+?):?<\/b>/) || [, t.replace(/<[^>]+>/g, '').slice(0, 40)])[1].replace(/:$/, '') }; if (!d.nomes.includes(z.name_en)) d.nomes.push(z.name_en); const tp = TIPOS_MONSTRO[z.Type]; if (tp && !d.tipos.includes(tp)) d.tipos.push(tp); porTexto.set(t, d); });
  _defesas = [...porTexto.values()].map(d => ({ ...d, nomes: d.nomes.slice(0, 3).join(', ') + (d.nomes.length > 3 ? '…' : '') })).sort((a, b) => a.regra.localeCompare(b.regra)); return _defesas;
}
/* picture in place of the animated figure: new pictures start at 60% of the frame, 15% higher and 30% to the side
   (heroes to the left, monsters to the right). That is the default position; the adjustments move it from there.
   The values stored (and exported) are absolute: scale, raise and shift in fractions of the frame. */
const ARTE_PADRAO = { escala: 0.6, altura: 0.15, lado: 0.3 };
const ladoPadraoArte = heroi => heroi ? -ARTE_PADRAO.lado : ARTE_PADRAO.lado;
function aplicarPadraoArte(x, heroi) { if (x.arteEscala === undefined && x.arteAltura === undefined && x.arteLado === undefined) { x.arteEscala = ARTE_PADRAO.escala; x.arteAltura = ARTE_PADRAO.altura; x.arteLado = ladoPadraoArte(heroi); } }
const TAMANHOS_ARTE = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3];
const DELTAS_ALTURA = [0.25, 0.2, 0.15, 0.1, 0.05, 0, -0.05, -0.1, -0.15, -0.2, -0.3];
const DELTAS_LADO = [-0.3, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4];
const quase = (a, b) => Math.abs(a - b) < 1e-6;
const pct = v => Math.round(Math.abs(v) * 100) + '%';
/* the three selects (size, up/down, left/right), labelled from the default position; attr(k) gives each select its hook */
function ajustesArte(x, heroi, attr) {
  const base = { a: ARTE_PADRAO.altura, l: ladoPadraoArte(heroi) };
  const esc = x.arteEscala ?? 1, alt = x.arteAltura ?? 0, lado = x.arteLado ?? 0;
  const lista = (vals, atual) => { const v = vals.slice(); if (!v.some(z => quase(z, atual))) v.push(atual); return v; };
  const opc = (vals, atual, rot) => vals.map(v => `<option value="${v}" ${quase(v, atual) ? 'selected' : ''}>${rot(v)}</option>`).join('');
  const rotEsc = v => pct(v) + (quase(v, ARTE_PADRAO.escala) ? ' (default)' : quase(v, 1) ? ' (fills the frame)' : '');
  const rotAlt = v => { const d = Math.round((v - base.a) * 100) / 100; return (quase(d, 0) ? 'Default (' + pct(base.a) + ' higher)' : pct(d) + (d > 0 ? ' higher' : ' lower')) + (quase(v, 0) && !quase(d, 0) ? ' · on the bottom' : ''); };
  const rotLado = v => { const d = Math.round((v - base.l) * 100) / 100; return (quase(d, 0) ? 'Default (' + pct(base.l) + ' to the ' + (base.l < 0 ? 'left' : 'right') + ')' : pct(d) + (d < 0 ? ' to the left' : ' to the right')) + (quase(v, 0) && !quase(d, 0) ? ' · centre of the frame' : ''); };
  const alts = lista(DELTAS_ALTURA.map(d => Math.round((base.a + d) * 100) / 100), alt).sort((p, q) => q - p);
  const lados = lista(DELTAS_LADO.map(d => Math.round((base.l + d) * 100) / 100), lado).sort((p, q) => p - q);
  return `<div class="duas"><label class="campo">Size in the window <select ${attr('esc')}>${opc(lista(TAMANHOS_ARTE, esc).sort((p, q) => p - q), esc, rotEsc)}</select></label>
    <label class="campo">Up / down <select ${attr('alt')}>${opc(alts, alt, rotAlt)}</select></label>
    <label class="campo">Left / right <select ${attr('lado')}>${opc(lados, lado, rotLado)}</select></label></div>`;
}
const ALTURAS_BLOCO = [[0.15, 'Flat (like a rug or a plate)'], [0.6, 'Low (like a crate)'], [1, 'One square tall'], [1.6, 'Tall (like a wall block)']];
/* height of a standing card, in board squares (a hero figure is about one) */
const ALTURAS_STANDEE = [[0.8, 'Small (like a chest)'], [1.4, 'Medium (like a hero)'], [2.2, 'Large (like a big monster)'], [3.2, 'Huge (like a statue)']];
const GLIFOS_OFICINA = ['Oficina', 'Chest', 'Door', 'Lectern', 'Well', 'Cauldron', 'Bell', 'Statue', 'Fire', 'SightToken', 'BloodShrine', 'Tree', 'Key', 'Lever', 'Crystal', 'Rune', 'Skull', 'Trap', 'Coffin', 'RoundTable', 'StoneTable', 'Barricade', 'Gate', 'Archway'];
function fichaObjeto(c, v) {
  c.innerHTML = `<div class="cabF"><h2>${esc(v.nome)} <span class="etq">workshop object</span></h2><div class="botoes"><button class="sm" id="fv_dup">Duplicate</button><button class="sm perigo" id="fv_apaga">Delete</button></div></div><div class="folha"><div class="col">
    <label class="campo">Name <input data-c="nome" value="${esc(v.nome)}"></label>
    <div class="sub">Squares it covers</div><div id="fv_forma"></div>
    <div class="sub">Colour</div><div id="fv_cores"></div>
    <label class="campo">Default text when clicked <textarea data-c="textClick" rows="2" placeholder="Filled into each new placement; edit it there if you like">${esc(v.textClick || '')}</textarea></label>
    <label class="campo">Default text when used <textarea data-c="textUse" rows="2">${esc(v.textUse || '')}</textarea></label>
    <label class="campo">Notes (for you) <textarea data-c="notas" rows="3">${esc(v.notas || '')}</textarea></label>
    </div><div class="col">
    <div class="sub">Icon</div>
    <div class="retrato"><div class="quadro"><img id="fv_prev" src="${iconeObj(v.id)}" alt=""></div><div><label class="sm botaoArquivo">Upload a picture (PNG)<input type="file" accept="image/png,image/jpeg,image/webp" data-icone hidden></label>${v.icone ? '<button class="sm" data-espelhar="icone" title="Flip the picture left to right">⇋ Mirror</button>' : ''}${v.icone ? '<button class="sm" data-iconeLimpa>Use a drawn icon</button>' : ''}<p class="ajuda">Or pick a drawn icon below.</p></div></div>
    <div class="glifos">${GLIFOS_OFICINA.map(g => `<button class="gl ${!v.icone && (v.glifo || 'Oficina') === g ? 'ativo' : ''}" data-gl="${g}" title="${g}"><img src="${icone(g, '#f3cf8f', v.cor || '#6a5a48')}" alt=""></button>`).join('')}</div>
    <div class="sub">In the app</div>
    <div class="botoes"><button class="sm ${!['standee', 'block', 'model'].includes(v.exibir) ? 'ativo' : ''}" data-ex="token">Interaction token</button><button class="sm ${v.exibir === 'standee' ? 'ativo' : ''}" data-ex="standee">Standing card</button><button class="sm ${v.exibir === 'block' ? 'ativo' : ''}" data-ex="block">Block</button><button class="sm ${v.exibir === 'model' ? 'ativo' : ''}" data-ex="model">3D model</button></div>
    ${v.exibir === 'standee' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${v.standee ? `<img src="${v.standee}" alt="">` : '<span>no picture</span>'}</div><div>
        <label class="sm botaoArquivo">Upload the card picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-standee hidden></label>${v.standee ? '<button class="sm" data-espelhar="standee" title="Flip the picture left to right">⇋ Mirror</button>' : ''}
        <label class="campo">Height <select data-alt>${ALTURAS_STANDEE.map(([h, n]) => `<option value="${h}" ${(v.alturaStandee || 1.4) === h ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <p class="ajuda">A picture standing upright on the object’s squares, always turned to the camera, like a cardboard standee. Use a PNG with a transparent background, taller than wide; the width follows the picture. Clicking the card uses the object.</p></div></div>`
      : v.exibir === 'block' ? `<div class="retrato" style="margin-top:8px"><div class="quadro"><img src="${v.topo || iconeObj(v.id)}" alt=""></div><div>
        <label class="sm botaoArquivo">Upload the top picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-topo hidden></label>${v.topo ? '<button class="sm" data-espelhar="topo" title="Flip the picture left to right">⇋ Mirror</button><button class="sm" data-topoLimpa>Use the icon</button>' : ''}
        <label class="campo">Height <select data-altb>${ALTURAS_BLOCO.map(([h, n]) => `<option value="${h}" ${(v.alturaBloco || 0.6) === h ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <p class="ajuda">A solid block in the object’s colour on each of its squares, with the picture laid on top across all of them (the icon, if you upload none). Square pictures fit best. Clicking the block uses the object.</p></div></div>`
      : v.exibir === 'model' ? '<div id="fv_modelo"></div>'
      : '<p class="ajuda">A generic interaction token of the game, standing on coloured squares of this shape (with the uploaded icon above it, if any).</p>'}
    <p class="ajuda">Either way the players put your own piece there at the table. Triggers, requirements and texts work as on any object.</p>
    <div class="sub">Default</div>
    <p class="ajuda">${padroesDaOficina()[v.id] ? tr('This object has a default') + ' (' + (padroesDaOficina()[v.id].gatilhos || []).length + ' ' + tr('trigger(s)') + ').' : tr('This object has no default yet.')} ${tr('To program it: place the object on the map, give it texts and triggers, and use “Save as the default” in its panel. Objects placed with “Default” ticked come with it.')}</p>
    ${padroesDaOficina()[v.id] ? '<button class="sm" id="fv_padraoLimpa">' + tr('Remove the default') + '</button>' : ''}
    </div></div>`;
  const refazer = () => { const img = c.querySelector('#fv_prev'); if (img) img.src = iconeObj(v.id); renderFichasLista(); desenhar(); };
  liga(c, v, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = v.nome + ' '; renderFichasLista(true); } });
  editorDeForma(c.querySelector('#fv_forma'), v, refazer);
  const cores = () => { const el = c.querySelector('#fv_cores'); el.innerHTML = ''; el.appendChild(paletaDeCores(v.cor, cor => { v.cor = cor; renderFichas(); })); };
  cores();
  c.querySelectorAll('[data-gl]').forEach(b => b.onclick = () => { v.glifo = b.dataset.gl; v.icone = ''; renderFichas(); });
  ligarEspelhos(c, v);
  const up = c.querySelector('[data-icone]'); up.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.icone = await lerImagem(f, 128); renderFichas(); };
  const lp = c.querySelector('[data-iconeLimpa]'); if (lp) lp.onclick = () => { v.icone = ''; renderFichas(); };
  c.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { v.exibir = b.dataset.ex; renderFichas(); desenhar(); });
  const us = c.querySelector('[data-standee]'); if (us) us.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.standee = await lerImagem(f, 512); delete IMG['standee:' + v.id]; renderFichas(); desenhar(); };
  const al = c.querySelector('[data-alt]'); if (al) al.onchange = e => { v.alturaStandee = +e.target.value; desenhar(); };
  const ut = c.querySelector('[data-topo]'); if (ut) ut.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.topo = await lerImagem(f, 512); delete IMG['topo:' + v.id]; renderFichas(); desenhar(); };
  const tl = c.querySelector('[data-topoLimpa]'); if (tl) tl.onclick = () => { v.topo = ''; delete IMG['topo:' + v.id]; renderFichas(); desenhar(); };
  if (v.exibir === 'block') prepararTopos();
  const fm = c.querySelector('#fv_modelo'); if (fm) campoModelo3d(fm, v, () => desenhar(), true);
  const ab = c.querySelector('[data-altb]'); if (ab) ab.onchange = e => { v.alturaBloco = +e.target.value; desenhar(); };
  const pl = c.querySelector('#fv_padraoLimpa'); if (pl) pl.onclick = () => { delete padroesDaOficina()[v.id]; renderFichas(); };
  $('#fv_dup').onclick = () => { const d = clone(v); d.id = 'B_' + uid(); d.nome = v.nome + ' (copy)'; oficina().objetos.push(d); fichaSel = d.id; renderFichas(); };
  $('#fv_apaga').onclick = () => apagarFicha(v);
}

// ------------------------------------------------------------ activation texts, in plain words
/* The game stores these texts with markup: <i>narration</i>, <b>bold</b>, <style=Term><link=TERM_X>word</link></style> for rule
   words (tooltips in the app), private-font characters for icons, and {0} {1} {2} for names or numbers the app fills in.
   Here the user writes plain text: a narration box (italics), a rules box with **bold**, [fatigue]-style icons and [monster]-style
   blanks; rule words (scar, terrify, focus…) are linked by themselves. The markup is rebuilt on every keystroke. */
const ICONES_TX = { fatigue: ['TERM_FATIGUE', ''], damage: ['TERM_DAMAGE', ''], advantage: ['TERM_ADVANTAGE', ''], surge: ['TERM_SURGE', ''], success: ['TERM_SUCCESS', ''], health: ['TERM_HEALTH_DIAL', ''], action: ['TERM_ACTIONS', ''] };
const TERMOS_TX = { 'hero card': 'TERM_HERO_CARD', 'attack card': 'TERM_ATTACK_CARDS', scarred: 'TERM_SCARRED', scars: 'TERM_SCARRED', scar: 'TERM_SCARRED', terrifies: 'TERM_TERRIFIED', terrified: 'TERM_TERRIFIED', terrify: 'TERM_TERRIFIED', focus: 'TERM_FOCUSED', negates: 'TERM_NEGATING', wounded: 'TERM_WOUNDS', tests: 'TERM_TESTS', impeded: 'TERM_IMPEDE', underlays: 'TERM_UNDERLAYS', underlay: 'TERM_UNDERLAYS', shifts: 'TERM_SHIFT', Shifts: 'TERM_SHIFT', infects: 'TERM_INFECTED', infect: 'TERM_INFECTED', stresses: 'TERM_STRESSED', prepare: 'TERM_PREPARED' };
/* the rule words of the game's texts (items, monsters): written plainly, they go back to the game as highlighted terms */
Object.assign(TERMOS_TX, { condition: 'TERM_CONDITIONS', conditions: 'TERM_CONDITIONS', Shift: 'TERM_SHIFT', shift: 'TERM_SHIFT', enfeebled: 'TERM_ENFEEBLED', enfeeble: 'TERM_ENFEEBLED', Enfeeble: 'TERM_ENFEEBLED',
  dazed: 'TERM_DAZED', daze: 'TERM_DAZED', exposed: 'TERM_EXPOSED', expose: 'TERM_EXPOSED', Expose: 'TERM_EXPOSED', afflicted: 'TERM_AFFLICTED', afflict: 'TERM_AFFLICTED', affliction: 'TERM_AFFLICTED', Afflicted: 'TERM_AFFLICTED', Affliction: 'TERM_AFFLICTED',
  shroud: 'TERM_SHROUDED', slowed: 'TERM_SLOWED', slow: 'TERM_SLOWED', Slow: 'TERM_SLOWED', doomed: 'TERM_DOOMED', doom: 'TERM_DOOMED', Doom: 'TERM_DOOMED', weakness: 'TERM_WEAKNESSES', injury: 'TERM_INJURIES', test: 'TERM_TESTS',
  Focus: 'TERM_FOCUSED', speed: 'TERM_SPEED', XP: 'TERM_EXPERIENCE', Prepare: 'TERM_PREPARED', stress: 'TERM_STRESSED', Scar: 'TERM_SCARRED', confuse: 'TERM_CONFUSED', confused: 'TERM_CONFUSED', Charge: 'TERM_CHARGE', 'skill card': 'TERM_SKILLS', Reach: 'TERM_REACH', impede: 'TERM_IMPEDE' });
const GLIFO_ICONE = Object.fromEntries(Object.entries(ICONES_TX).map(([n, [, g]]) => [g, n]));
const ICONE_DO_TERMO = Object.fromEntries(Object.entries(ICONES_TX).map(([n, [t]]) => [t, n]));
/* what each {n} of a text stands for, guessed from how the game's text uses it */
function vagasDe(texto, padrao) {
  const t = (texto || '').replace(/<[^>]+>/g, ''); const ns = [...new Set([...t.matchAll(/\{(\d)\}/g)].map(x => +x[1]))].sort();
  if (!ns.length) return padrao.slice();
  const r = [];
  ns.forEach(n => {
    const re = s => new RegExp(s.replace(/N/g, '\\{' + n + '\\}'), 'i');
    let tipo = 'hero';
    if (re("\\bthe N").test(t)) tipo = 'monster';
    else if (re("N\\s+(spaces?|damage|health|cards?|times)\\b").test(t) || re("(tests? \\w+|suffers?|recovers?|terrif\\w+|scars?|places?)\\s+N\\b").test(t) || re("^\\s*N\\s*$").test(t)) tipo = 'number';
    r[n] = tipo;
  });
  for (let i = 0; i < r.length; i++) if (!r[i]) r[i] = 'name';
  const vistos = {}; return r.map(x => { vistos[x] = (vistos[x] || 0) + 1; return vistos[x] > 1 ? x + ' ' + vistos[x] : x; });
}
const VAGA_EXPLICA = { monster: 'the name of this monster', hero: 'the name of the hero it targets (or another name the app fills in)', number: 'a number the app works out', name: 'a name the app fills in' };
function paraAmigavel(txt, vagas) {
  let t = txt || '';
  // an icon term (its glyph may be missing in the text): [fatigue], [damage]...
  t = t.replace(/<link=(TERM_[A-Z_0-9]+)>([^<]*)<\/link>/g, (x, termo, w) => ICONE_DO_TERMO[termo] && (!w.trim() || GLIFO_ICONE[w]) ? '[' + ICONE_DO_TERMO[termo] + ']' : x);
  t = t.replace(/<style=[^>]*>/g, '').replace(/<\/style>/g, '').replace(/<link=[^>]*>/g, '').replace(/<\/link>/g, '');
  t = t.replace(/[-]/g, ch => GLIFO_ICONE[ch] ? '[' + GLIFO_ICONE[ch] + ']' : '');
  t = t.replace(/\{(\d)\}/g, (x, n) => '[' + (vagas[+n] || 'blank ' + n) + ']');
  let narr = '', regras = t;
  const mm = t.match(/^\s*<i>([\s\S]*?)<\/i>\s*/); if (mm) { narr = mm[1]; regras = t.slice(mm[0].length); }
  const md = x => x.replace(/<b>([\s\S]*?)<\/b>/g, '**$1**').replace(/<i>([\s\S]*?)<\/i>/g, '*$1*').replace(/<[^>]+>/g, '');
  return { narr: md(narr).trim(), regras: md(regras).trim() };
}
function paraJogo(narr, regras, vagas, comTermos) {
  const fichas = s => s.replace(/\[([^\]]+)\]/g, (x, nome) => { const k = nome.trim().toLowerCase(); if (ICONES_TX[k]) return '<style=Term><link=' + ICONES_TX[k][0] + '>' + ICONES_TX[k][1] + '</link></style>'; const n = vagas.indexOf(k); return n >= 0 ? '{' + n + '}' : x; });
  const md = s => s.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  const termos = s => { if (!comTermos) return s; const chaves = Object.keys(TERMOS_TX).sort((a, b) => b.length - a.length); const re = new RegExp('(<[^>]+>)|\\b(' + chaves.map(k => k.replace(/ /g, '\\s')).join('|') + ')\\b', 'g'); return s.replace(re, (x, tag, w) => tag ? tag : '<style=Term><link=' + TERMOS_TX[w] + '>' + w + '</link></style>'); };
  const a = fichas((narr || '').trim()), b = fichas(termos(md((regras || '').trim())));
  return (a ? '<i>' + a + '</i>' : '') + (a && b ? '\n\n' : '') + b;
}
/* how the app shows a text (for the preview) */
function previaDoJogo(txt, vagas) {
  let h = esc(txt || '').replace(/&lt;(\/?)(i|b)&gt;/g, '<$1$2>');
  h = h.replace(/&lt;style=[^&]*&gt;&lt;link=([A-Z_0-9]+)&gt;([\s\S]*?)&lt;\/link&gt;&lt;\/style&gt;/g, (x, termo, w) => GLIFO_ICONE[w] ? `<span class="icoTx">${GLIFO_ICONE[w]}</span>` : `<span class="termoTx" title="${termo}">${w}</span>`);
  h = h.replace(/\{(\d)\}/g, (x, n) => `<span class="vagaTx" title="${esc(VAGA_EXPLICA[(vagas[+n] || '').replace(/ \d+$/, '')] || '')}">${esc(vagas[+n] || 'blank ' + n)}</span>`);
  h = h.replace(/\[([^\]]+)\]/g, (x, n) => `<span class="vagaTx erro" title="The app does not fill this in for this activation">${esc(n)}?</span>`);
  return h.replace(/\n/g, '<br>');
}
/* a text of the game (item card, monster description) written plainly: [icons], **bold**, *italics* and the rule words go back to
   the game's marks by themselves; what the app shows is previewed below */
function editorDeDescricao(el, x, campo, rotulo, mudou) {
  if (!el) return;
  const t = paraAmigavel(x[campo] || '', []); const texto = (t.narr ? '*' + t.narr + '*\n\n' : '') + t.regras;
  el.innerHTML = `<label class="campo">${rotulo}<textarea data-dz rows="4">${esc(texto)}</textarea></label>
    <div class="barraTx"><span>Insert:</span>${Object.keys(ICONES_TX).map(k => `<button class="sm" data-ins="[${k}]" title="Icon: ${k}">${k}</button>`).join('')}<span class="sep"></span><button class="sm" data-neg title="Bold: select words and click (or write **words**)"><b>B</b></button></div>
    <div class="previaTx" data-prev></div>`;
  const ta = el.querySelector('[data-dz]'), prev = el.querySelector('[data-prev]');
  const pinta = () => { prev.innerHTML = '<div class="rotuloTx">In the app:</div>' + (previaDoJogo(x[campo] || '', []) || '<span class="ajuda">(nothing)</span>'); };
  ta.oninput = () => { x[campo] = paraJogo('', ta.value, [], true); pinta(); mudou && mudou(); };
  el.querySelectorAll('[data-ins]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => { const i = ta.selectionStart ?? ta.value.length, j = ta.selectionEnd ?? i; ta.value = ta.value.slice(0, i) + b.dataset.ins + ta.value.slice(j); ta.focus(); ta.selectionStart = ta.selectionEnd = i + b.dataset.ins.length; ta.oninput(); }; });
  const ng = el.querySelector('[data-neg]'); ng.onmousedown = e => e.preventDefault(); ng.onclick = () => { const i = ta.selectionStart, j = ta.selectionEnd; if (i === j) return aviso('Select the words to make bold first.'); ta.value = ta.value.slice(0, i) + '**' + ta.value.slice(i, j) + '**' + ta.value.slice(j); ta.oninput(); };
  pinta();
}
function editorDeTexto(d, a, mudou, opc = {}) {
  a.vagas = a.vagas || vagasDe(a.text, ['monster', 'hero']);
  a.vagasDica = a.vagasDica || vagasDe(a.hint, ['monster', 'hero']);
  const t = paraAmigavel(a.text, a.vagas), dca = paraAmigavel(a.hint, a.vagasDica);
  // "**Bloodlust:** After the defense…": the bold name of the rule goes to its own box, the rules stay plain
  const mNome = t.regras.match(/^\*\*([^*]+?)\*\*\s*/); const nomeRegra = mNome ? mNome[1].replace(/:\s*$/, '') : ''; if (mNome) t.regras = t.regras.slice(mNome[0].length);
  const botoes = vagas => vagas.map(v => `<button class="sm fichaTx" data-ins="[${esc(v)}]" title="${esc(VAGA_EXPLICA[v.replace(/ \d+$/, '')] || '')}">${esc(v)}</button>`).join('');
  d.innerHTML = `<label class="campo">Narration <small>(read aloud, shown in italics)</small><textarea data-tx="narr" rows="2" placeholder="The monster lunges forward, roaring…">${esc(t.narr)}</textarea></label>
    <label class="campo">Rule name <small>(optional, shown in bold before the rules, like “Bloodlust:”)</small><input data-tx="nome" value="${esc(nomeRegra)}" placeholder="Bloodlust"></label>
    <label class="campo">What happens <small>(the rules)</small><textarea data-tx="regras" rows="2" placeholder="After the attack, the target is pushed 2 spaces.">${esc(t.regras)}</textarea></label>
    <div class="barraTx"><span>Insert:</span>${botoes(a.vagas)}<span class="sep"></span>${Object.keys(ICONES_TX).map(k => `<button class="sm" data-ins="[${k}]" title="Icon: ${k}">${k}</button>`).join('')}<span class="sep"></span><button class="sm" data-neg title="Bold: select a word and click (or write **word**)"><b>B</b></button></div>
    <label class="campo">Hint before it <small>(optional, shown in italics before the activation)</small><input data-tx="dica" value="${esc((dca.narr + (dca.regras ? ' ' + dca.regras : '')).trim())}" placeholder="The monster eyes the weakest hero…"></label>
    <div class="barraTx"><span>Insert in the hint:</span>${botoes(a.vagasDica).replace(/data-ins/g, 'data-insd')}</div>
    <div class="previaTx" data-prev></div>
    <p class="ajuda">Write plain text. The buttons put in the names the app fills in (${a.vagas.map(v => '[' + esc(v) + '] = ' + esc(VAGA_EXPLICA[v.replace(/ \d+$/, '')] || v)).join(', ')}) and the game icons. Rule words like scar, terrify or focus become the game’s highlighted terms by themselves.</p>`;
  if (opc.soRegras) { const some = x => { if (x) x.style.display = 'none'; }; some(d.querySelector('[data-tx=narr]').closest('label')); some(d.querySelector('[data-tx=dica]').closest('label')); some(d.querySelectorAll('.barraTx')[1]); some(d.querySelector('.ajuda')); d.querySelector('[data-tx=regras]').placeholder = opc.exemploRegras || 'After the attack, this enemy shifts 2 away from the hero.'; d.querySelector('[data-tx=nome]').placeholder = opc.exemploNome || 'Smokebomb'; }
  const nomeR = d.querySelector('[data-tx=nome]');
  const narr = d.querySelector('[data-tx=narr]'), regras = d.querySelector('[data-tx=regras]'), dica = d.querySelector('[data-tx=dica]'), prev = d.querySelector('[data-prev]');
  let ultimo = regras;
  const atualizar = () => { const nr = nomeR.value.trim().replace(/:\s*$/, ''); a.text = paraJogo(narr.value, (nr ? '**' + nr + ':** ' : '') + regras.value.trim(), a.vagas, true); const hv = dica.value.trim(); a.hint = hv ? paraJogo(hv, '', a.vagasDica, false) : ''; prev.innerHTML = '<div class="rotuloTx">In the app:</div>' + (previaDoJogo(a.text, a.vagas) || '<span class="ajuda">(nothing yet)</span>') + (a.hint ? '<div class="rotuloTx">Hint:</div>' + previaDoJogo(a.hint, a.vagasDica) : ''); mudou(); };
  const inserir = (campo, texto) => { const i = campo.selectionStart ?? campo.value.length, j = campo.selectionEnd ?? i; campo.value = campo.value.slice(0, i) + texto + campo.value.slice(j); campo.focus(); campo.selectionStart = campo.selectionEnd = i + texto.length; campo.dispatchEvent(new Event('input', { bubbles: true })); };
  [narr, regras].forEach(x => { x.onfocus = () => { ultimo = x; }; x.oninput = atualizar; });
  dica.oninput = atualizar; nomeR.oninput = atualizar;
  d.querySelectorAll('[data-ins]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => inserir(ultimo, b.dataset.ins); });
  d.querySelectorAll('[data-insd]').forEach(b => { b.onmousedown = e => e.preventDefault(); b.onclick = () => inserir(dica, b.dataset.insd); });
  const ng = d.querySelector('[data-neg]'); ng.onmousedown = e => e.preventDefault(); ng.onclick = () => { const c = ultimo; const i = c.selectionStart, j = c.selectionEnd; if (i === j) return aviso('Select the words to make bold first.'); c.value = c.value.slice(0, i) + '**' + c.value.slice(i, j) + '**' + c.value.slice(j); c.dispatchEvent(new Event('input', { bubbles: true })); };
  prev.innerHTML = '<div class="rotuloTx">In the app:</div>' + (previaDoJogo(a.text, a.vagas) || '<span class="ajuda">(nothing yet)</span>') + (a.hint ? '<div class="rotuloTx">Hint:</div>' + previaDoJogo(a.hint, a.vagasDica) : '');
}

// ------------------------------------------------------------ the default of a game object, changed in the Workshop
const objetosDoJogoComPadrao = () => Object.keys(padroesDaOficina()).filter(k => !ehDaOficina(k) && OBJETO[k]).sort((a, b) => nomeObj(a).localeCompare(nomeObj(b)));
function fichaPadraoJogo(c, k) {
  const p = padroesDaOficina()[k]; if (!p) { c.innerHTML = ''; return; }
  const lista = (p.gatilhos || []).map(g => `<li>${esc(tr(resumoGatilho(g)))}</li>`).join('');
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeObj(k))} <span class="etq custom">${tr('game object · default of its own')}</span></h2><div class="botoes"><button class="sm" id="fpj_volta">${tr('Back to the game’s default')}</button></div></div>
    <div class="folha"><div class="col"><div class="retrato"><div class="quadro"><img src="${iconeObj(k)}" alt=""></div></div>
    <div class="sub">${tr('Text when looked at')}</div><p>${esc(p.textClick || '—')}</p>
    <div class="sub">${tr('Text when used')}</div><p>${esc(p.textUse || '—')}</p>
    <div class="sub">${tr('Triggers')}</div>${lista ? `<ul>${lista}</ul>` : '<p>—</p>'}
    <p class="ajuda">${tr('Objects of this kind placed with “Default” ticked come with this programming. To change it: place one on the map, program it and use “Save as the default” in its panel. The same as the game’s one, it leaves this list.')}</p></div></div>`;
  c.querySelector('#fpj_volta').onclick = () => { delete padroesDaOficina()[k]; fichaSel = null; renderFichas(); };
}
