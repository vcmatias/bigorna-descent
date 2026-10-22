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
/* the search of the Items tab (by name, with or without accents): it stays while the tab is open */
let buscaItens = '';
const semAcento = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const itemAchado = (x, b) => !b || semAcento(x.nome).includes(b);
const itensDaBusca = () => oficina().itens.filter(i => i.cls !== 'WeaponPartsModel' && TIPOS_ITEM.some(([k]) => doTipoItem(i, k)));
const nomeDoTipoItem = x => TIPOS_ITEM.find(([k]) => doTipoItem(x, k))?.[1] || x.cls;
/* the search box of the items; achados: where the entries found in every kind go (the start of the tab), or null (a kind on
   screen: its list hides what does not match, and the other kinds show what they have below it) */
function buscaDeItens(bloco, achados) {
  const caixa = document.createElement('div'); caixa.className = 'buscaItens';
  caixa.innerHTML = `<input id="f_busca" type="search" placeholder="${esc(tr('search the items by name…'))}" value="${esc(buscaItens)}"><small id="f_buscaConta"></small>`;
  const lista = bloco.querySelector('#f_lista'); if (lista) bloco.insertBefore(caixa, lista); else bloco.appendChild(caixa);
  const fora = document.createElement('div'); fora.className = 'outrosTipos'; (achados || bloco).appendChild(fora);
  const linha = x => { const r = retratoDoItem(x); return `<div class="no" data-achado="${esc(x.id)}">${r ? `<img class="face" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="face"></span>'}<div><div>${esc(x.nome || '(no name)')}</div><small>${esc(tr(nomeDoTipoItem(x)))}</small></div></div>`; };
  const aplicar = () => {
    const b = semAcento(buscaItens); const conta = caixa.querySelector('#f_buscaConta');
    if (lista) {
      const daqui = oficina().itens.filter(x => tipoItem && doTipoItem(x, tipoItem)); let n = 0;
      lista.querySelectorAll('.no[data-id]').forEach(d => { const x = daqui.find(y => y.id === d.dataset.id); const ve = !x || itemAchado(x, b); d.hidden = !ve; if (ve) n++; });
      conta.textContent = b ? n + ' ' + tr('of') + ' ' + daqui.length : '';
      const outros = b ? itensDaBusca().filter(x => !doTipoItem(x, tipoItem) && itemAchado(x, b)) : [];
      fora.innerHTML = outros.length ? `<div class="sub">${esc(tr('In the other item tabs'))}</div>` + outros.slice(0, 12).map(linha).join('') + (outros.length > 12 ? `<p class="ajuda">+${outros.length - 12}</p>` : '') : '';
    } else {
      const todos = b ? itensDaBusca().filter(x => itemAchado(x, b)) : [];
      conta.textContent = b ? todos.length + ' ' + tr('found') : '';
      fora.innerHTML = b ? (todos.length ? todos.map(linha).join('') : `<p class="ajuda">${esc(tr('No item of the workshop has that name.'))}</p>`) : '';
    }
    fora.querySelectorAll('[data-achado]').forEach(d => d.onclick = () => { const x = oficina().itens.find(y => y.id === d.dataset.achado); if (!x) return; tipoItem = TIPO_DO_ITEM(x.cls); fichaSel = x.id; renderFichas(); });
  };
  const inp = caixa.querySelector('#f_busca');
  inp.oninput = () => { buscaItens = inp.value; aplicar(); };
  inp.onkeydown = e => { if (e.key === 'Escape' && inp.value) { e.stopPropagation(); inp.value = buscaItens = ''; aplicar(); } };
  aplicar();
}
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
/* a monster of the workshop made from nothing: the type's figure, art and sounds; the rest blank */
function varianteDoTipo(tipo) { return CAT.monstros.find(z => monstroDeEscolha(z) && TIPOS_MONSTRO[z.Type] === tipo && !z.IsNamed && z.name_en && !/^ENEMY_/.test(z.name_en)) || CAT.monstros.find(z => TIPOS_MONSTRO[z.Type] === tipo); }
function monstroNovo(tipo) {
  const v = varianteDoTipo(tipo); const m = v ? monstroDoCatalogo(v) : { id: 'B_' + uid(), tipo, act: 0, sons: { modo: 'tipo', tipo }, textureTab: '', logic: '', comportamento: '' };
  return Object.assign(m, { base: null, custom: true, nome: tr('New monster'), nomeJogo: undefined, plural: tr('New monsters'), desc: '', named: false, villain: false, tiers: [{ tier: 1, hp: 20, def: 1, atk: 1 }], size: 0,
    mec: [], tema: [], wr: [], imune: [], strength: 0, ativacoes: [], taticas: [], loot: [], retrato: '', defesa: '', defesaApos: false, defesaImportada: false });
}
/* the monster's type changes: the figure, art, sounds and behaviour follow the type's first monster */
function mudarTipoDoMonstro(m, tipo) { const v = varianteDoTipo(tipo); m.tipo = tipo; if (v) { m.comportamento = v._id; m.textureTab = v.TextureTabAssetPath || ''; m.logic = v.LogicAssetPath || ''; } if (!m.sons || m.sons.modo !== 'arquivos') m.sons = { modo: 'tipo', tipo }; }
/* an original of the game: its numbers, activations, tactics and defense stay as in the game (duplicate it to change them) */
const monstroOriginal = m => !!(m && m.base);
/* the defense came from the game (imported, or the monster's own): only then the app's automatic part of it matters */
const defesaImportada = m => !!m.defesaImportada || ((m.defesa || '').trim() && DEFESAS_DO_JOGO().some(d => d.texto === (m.defesa || '').trim()));
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

/* ------------------------------------------------------------ the lists of the Workshop tabs: a filter, and the game's entries apart
   An entry imported from the game, as it is (base, not custom), is one of the game: it is changed nowhere (duplicate it to
   change it). The entries of one's own come first; the game's go in a block that folds ("Of the game"), as the game's tiles
   and objects do. "Filter" opens rows of chips, the categories of the tab: chips of one row add up, rows narrow each other. */
const filtrosDaOficina = {}, _filtroAberto = {}, _jogoAberto = {}, _ordemDaLista = {};
/* the orders of a list: the order of creation (as they came in), by name, by value in gold (the items) */
const ordensDaAba = () => [['criacao', 'Order of creation'], ['nome', 'A–Z'], ...(abaF === 'itens' ? [['valor', 'Value (gold)']] : [])];
function ordenarLista(xs) { const o = _ordemDaLista[chaveDaListaF()] || 'criacao'; if (o === 'nome') return xs.slice().sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), undefined, { sensitivity: 'base' }));
  if (o === 'valor') return xs.slice().sort((a, b) => (b.valor || 0) - (a.valor || 0) || String(a.nome || '').localeCompare(String(b.nome || ''))); return xs; }
const chaveDaListaF = () => abaF + (abaF === 'itens' ? ':' + tipoItem : '');
const ehDoJogoNaOficina = x => !!(x && x.base && !x.custom);
const ORIGEM_F = { nome: 'Origin', semRotulo: true, opcoes: [['proprio', 'Own'], ['jogo', 'Of the game']], de: x => ehDoJogoNaOficina(x) ? 'jogo' : 'proprio' };
const temReceita = x => receitasDoAlvo(x).length > 0 || receitasDoJogoDoAlvo(x).length > 0;
function categoriasDaAba() {
  switch (abaF) {
    case 'monstros': return [ORIGEM_F, { nome: 'Act', opcoes: [[0, ACT_NOME[0]], [1, ACT_NOME[1]]], de: x => x.act || 0 },
      { nome: 'Kind', opcoes: [['common', 'Common'], ['unique', 'Unique'], ['villain', 'Villain (boss)']], de: x => x.villain ? 'villain' : x.named ? 'unique' : 'common' },
      { nome: 'Size', opcoes: [[0, 'Normal'], [1, 'Large']], de: x => x.size ? 1 : 0 },
      { nome: 'Type', opcoes: [...new Set(MONSTROS().map(m => m.tipo).filter(Boolean))].sort().map(t => [t, t]), de: x => x.tipo }];
    case 'personagens': return [ORIGEM_F, { nome: 'Kind', opcoes: [['hero', 'Heroes of the box'], ['npc', 'NPCs']], de: x => ehHeroiDaCaixa(x.base) ? 'hero' : 'npc' }];
    case 'itens': {
      const r = [ORIGEM_F, { nome: 'Recipe', semRotulo: true, opcoes: [['com', 'With a recipe'], ['sem', 'Without a recipe']], de: x => temReceita(x) ? 'com' : 'sem' }];
      if (tipoItem === 'CraftingMaterialModel') r.push({ nome: 'Kind', opcoes: [[0, 'Base materials'], [1, 'Essences']], de: x => +x.tipoMaterial || 0 });
      else r.push({ nome: 'Rarity', opcoes: RARIDADES.map((n, k) => [k, n]).slice(1), de: x => x.raridade || 1 });
      if (tipoItem === 'ConsumableModel') r.push({ nome: 'Unique', opcoes: [['1', 'Unique'], ['0', 'Regular']], de: x => x.unico ? '1' : '0' });
      if (tipoItem === 'TrinketModel') r.push({ nome: 'Effect', opcoes: [['jogo', 'Effect of a game trinket'], ['gatilhos', 'With triggers'], ['mesa', 'Played at the table']],
        de: x => { const j = !!(x.efeitoBase || (!x.custom && x.base)), g = !!(x.disparos || []).length; return [...(j ? ['jogo'] : []), ...(g ? ['gatilhos'] : []), ...(!j && !g ? ['mesa'] : [])]; } });
      return r; }
    case 'facanhas': return [ORIGEM_F, { nome: 'Hero', opcoes: HEROIS_IDS.map(h => [h, nomeDoPerfil(h)]), de: x => x.heroi },
      { nome: 'When', opcoes: MOMENTOS_FACANHA.map(([k, n]) => [k, n]), de: x => x.momento },
      { nome: 'Feat pool', opcoes: [['1', 'In the pool'], ['0', 'Out of the pool']], de: x => (oficina().poolFacanhas || []).includes(x.id) ? '1' : '0' }];
    case 'pericias': return [ORIGEM_F, { nome: 'Hero', opcoes: HEROIS_IDS.map(h => [h, nomeHeroiPericia(h)]).concat([['', nomeHeroiPericia('')]]), de: x => x.heroi || '' },
      { nome: 'XP', opcoes: [[1, '1 XP'], [2, '2 XP'], [3, '3 XP']], de: x => x.custo || 1 },
      { nome: 'Cards', opcoes: [['com', 'With card pictures'], ['sem', 'Without card pictures']], de: x => (x.cartas || []).length ? 'com' : 'sem' }];
    case 'objetos': return [{ nome: 'Kind', opcoes: [['copia', 'Copies of game objects'], ['proprio', 'Objects of their own']], de: x => x.clone ? 'copia' : 'proprio' }];
  }
  return [];
}
const valoresF = (c, x) => [].concat(c.de(x)).map(String);
function filtrosDaLista() { const cats = categoriasDaAba(), k = chaveDaListaF(); const f = filtrosDaOficina[k] = (filtrosDaOficina[k] && filtrosDaOficina[k].length === cats.length) ? filtrosDaOficina[k] : cats.map(() => new Set()); return { cats, f }; }
function passaNosFiltros(x) { const { cats, f } = filtrosDaLista(); return cats.every((c, i) => !f[i].size || valoresF(c, x).some(v => f[i].has(v))); }
/* the button and its panel, in the buttons of the block of the list; refazer draws the tab again */
function botaoDeFiltro(bloco, itens, refazer) {
  const { cats, f } = filtrosDaLista(); const chave = chaveDaListaF();
  const linhas = cats.map((c, i) => ({ c, i, ops: c.opcoes.map(([v, r]) => [String(v), r, itens.filter(x => valoresF(c, x).includes(String(v))).length]) })).filter(l => l.ops.length > 1);
  const ordens = ordensDaAba(); if (!linhas.length && ordens.length < 2) return; const ordem = _ordemDaLista[chave] || 'criacao';
  const n = f.reduce((a, s) => a + s.size, 0); const botoes = bloco.querySelector('.botoes'); if (!botoes) return;
  const b = document.createElement('button'); b.className = 'sm botaoFiltro' + (n ? ' ativo' : ''); b.id = 'f_filtrar'; b.title = tr('Show only some categories of this tab');
  b.innerHTML = `⚲ <span>${esc(tr('Filter'))}</span>${n ? ` <span class="etq">${n}</span>` : ''}`; botoes.appendChild(b);
  const painel = document.createElement('div'); painel.className = 'filtrosF'; painel.hidden = !_filtroAberto[chave];
  painel.innerHTML = (ordens.length > 1 ? `<div class="impFiltro ordemF"><b>${esc(tr('Sort'))}</b>${ordens.map(([k, r]) => `<button class="sm chipF ${ordem === k ? 'ativo' : ''}" data-ord="${k}">${esc(tr(r))}</button>`).join('')}</div>` : '')
    + linhas.map(({ c, i, ops }) => `<div class="impFiltro">${c.semRotulo ? '' : `<b>${esc(tr(c.nome))}</b>`}${ops.map(([v, r, k]) => `<button class="sm chipF ${f[i].has(v) ? 'ativo' : ''}" data-fi="${i}" data-fv="${esc(v)}">${esc(tr(r))} <small>${k}</small></button>`).join('')}</div>`).join('')
    + (n ? `<button class="sm" id="f_limpaF">${esc(tr('Clear filters'))}</button>` : '');
  botoes.after(painel);
  b.onclick = () => { _filtroAberto[chave] = !_filtroAberto[chave]; painel.hidden = !_filtroAberto[chave]; };
  painel.querySelectorAll('[data-ord]').forEach(x => x.onclick = () => { _ordemDaLista[chave] = x.dataset.ord; refazer(); });
  painel.querySelectorAll('[data-fi]').forEach(x => x.onclick = () => { const s = f[+x.dataset.fi]; const v = x.dataset.fv; if (s.has(v)) s.delete(v); else s.add(v); refazer(); });
  const lp = painel.querySelector('#f_limpaF'); if (lp) lp.onclick = () => { f.forEach(s => s.clear()); refazer(); };
}
/* the list: the entries that pass the filter, one's own first, the game's in their folding block; grupo(x) = [key, title]
   splits them by hero (feats, skills) */
function listaEmGrupos(l, itens, pintar, grupo) {
  l.innerHTML = '';
  // (v240: the filters read once for the whole list: before, each entry read them again, and a Workshop of 5000 monsters
  // took seconds to draw)
  const { cats, f } = filtrosDaLista(); const passa = x => cats.every((c, i) => !f[i].size || valoresF(c, x).some(v => f[i].has(v)));
  const ordemG = grupo ? [...new Set(itens.map(x => grupo(x)[0]))] : []; const vis = ordenarLista(itens.filter(passa)); const proprios = vis.filter(x => !ehDoJogoNaOficina(x)), jogo = vis.filter(ehDoJogoNaOficina);
  const por = (alvo, xs) => {
    const seq = [];
    if (!grupo) xs.forEach(x => seq.push(x));
    else { const gs = new Map(); xs.forEach(x => { const [k, nome] = grupo(x); if (!gs.has(k)) gs.set(k, { nome, xs: [] }); gs.get(k).xs.push(x); });
      [...gs.entries()].sort((a, b) => ordemG.indexOf(a[0]) - ordemG.indexOf(b[0])).forEach(([, { nome, xs }]) => { seq.push({ _tituloF: nome }); xs.forEach(x => seq.push(x)); }); }
    listaAosPoucos(alvo, seq, pintar);
  };
  por(l, proprios);
  if (jogo.length) {
    const chave = chaveDaListaF(); const d = document.createElement('details'); d.className = 'rolJogo grupoJogo';
    d.open = !!_jogoAberto[chave] || jogo.some(x => x.id === fichaSel) || !proprios.length; d.ontoggle = () => { _jogoAberto[chave] = d.open; };
    d.innerHTML = `<summary>${esc(tr('Of the game'))} <span class="etq">${jogo.length}</span></summary><p class="ajuda">${esc(tr('As in the game: they change nowhere. Duplicate one to make it yours and change it.'))}</p><div class="lista"></div>`;
    por(d.querySelector('.lista'), jogo); l.appendChild(d);
  }
  if (!vis.length) l.innerHTML = `<p class="ajuda">${esc(itens.length ? tr('Nothing with these filters.') : 'Nothing yet.')}</p>`;
}
function listaAosPoucos(alvo, seq, pintar) {
  const sel = seq.findIndex(x => x && x.id != null && x.id === fichaSel);
  aosPoucos(alvo, seq, x => { if (x && x._tituloF !== undefined) { const t = document.createElement('div'); t.className = 'sub pequena'; t.textContent = x._tituloF; return t; } const d = pintar(x); d.dataset.id = x.id; return d; }, sel);
}
// ------------------------------------------------------------ screen
function abrirFichas(aba, id) {
  marcarVisto('dica:oficina');
  abaF = aba || 'monstros'; if (id) fichaSel = id;
  if (abaF === 'itens' && id) { const it = oficina().itens.find(x => x.id === id); if (it && it.cls === 'WeaponPartsModel') { abaF = 'armas'; armaSel = armaDaClasse(CLASSES_ARMA.indexOf(it.classe))?._id || null; slotSel = Math.max(0, 'ABC'.indexOf(it.slot || 'A')); pecaAberta = it.id; } else if (it) tipoItem = it.cls === 'TableItem' ? 'TrinketModel' : it.cls; }
  $('#telaFichas').hidden = false; renderFichas();
}
function fecharFichas() { $('#telaFichas').hidden = true; _abaDescarregada = null; descarregarImagens(); sairPadraoDaOficina(); if (inimigoEscolhido && !monstro(inimigoEscolhido)) inimigoEscolhido = null; if (!defPeca(pecaEscolhida)) pecaEscolhida = PECAS[0].id; if (!defObj(objetoEscolhido)) objetoEscolhido = 'Door'; tudo(); }
$('#fVoltar').onclick = fecharFichas;
$$('#abasF button').forEach(b => b.onclick = () => { abaF = b.dataset.aba; if (b.dataset.tipo) { tipoItem = b.dataset.tipo; buscaItens = ''; } fichaSel = null; renderFichas(); });
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
let _abaDescarregada = null;
function renderFichas() {
  { const aba = abaF + ':' + (abaF === 'itens' ? tipoItem : abaF === 'herois' ? heroiSel : ''); if (aba !== _abaDescarregada) { _abaDescarregada = aba; descarregarImagens(); } }   // (v239: the pictures of the tab left, unloaded)
  if (EDITANDO_PADRAO && !(abaF === 'objetos' && fichaSel === EDITANDO_PADRAO.fichaSel)) sairPadraoDaOficina();
  explicarAba();
  // (the items: each kind has a tab of its own; the weapon parts are in the Weapons tab)
  if (abaF === 'itens' && !TIPOS_ITEM.some(([k]) => k === tipoItem)) tipoItem = TIPOS_ITEM[0][0];
  $$('#abasF button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === abaF && (!b.dataset.tipo || b.dataset.tipo === tipoItem)));
  const lote = $('#fLote'); if (lote) { lote.hidden = abaF === 'historias'; lote.onclick = apagarVarios; }
  // (v249: the skills are in the heroes tab, under each hero: the old tab, and a skill opened from elsewhere, go there)
  if (abaF === 'pericias') { abaF = 'herois'; const p = fichaSel && (oficina().pericias || []).find(x => x.id === fichaSel); if (p) heroiSel = PERICIAS + (p.heroi || ''); else if (!String(heroiSel).startsWith(PERICIAS)) heroiSel = EQUIPE; }
  if (abaF === 'herois') { renderHerois(); return; }
  if (abaF === 'armas') { renderArmas(); return; }
  if (abaF === 'receitas') abaF = 'itens';   // (v230: the recipes are in the sheets of the items)
  if (abaF === 'facanhas') { abaF = 'herois'; heroiSel = EQUIPE; renderFichas(); return; }   // (v232: the feats are in the heroes tab, under each hero)
  if (abaF === 'historias' && !oficinaHistoriasAtiva()) abaF = 'monstros';
  if (abaF === 'historias') { renderHistoriasOficina(); return; }
  const lista = abaF === 'itens' ? oficina().itens.filter(x => tipoItem && doTipoItem(x, tipoItem)) : oficina()[abaF]; if (fichaSel && !lista.some(x => x.id === fichaSel) && !(abaF === 'objetos' && String(fichaSel).startsWith('padrao:') && padroesDaOficina()[fichaSel.slice(7)]) && !pecaDoJogoSel()) fichaSel = null;
  const esq = $('#esqF'); const variante = abaF === 'pecas' || abaF === 'objetos';
  const titulo = { monstros: 'Monsters', personagens: 'NPCs', itens: 'Items', pecas: 'Tiles', objetos: 'Objects' }[abaF];
  const escolhaTipo = '';
  esq.innerHTML = `<div class="bloco"><h2>${abaF === 'itens' ? TIPOS_ITEM.find(t => t[0] === tipoItem)[1] : titulo} <span class="etq">${lista.length}</span></h2>${escolhaTipo}
    <div class="botoes">${variante ? `<button class="sm primario" id="f_novo">+ New ${abaF === 'pecas' ? 'tile' : 'object'}</button>` : `<button class="sm" id="f_importar">Import…</button><button class="sm primario" id="f_novo">+ Create</button>`}${botaoLote()}</div>
    <p class="ajuda">${abaF === 'monstros' ? 'Only monsters listed here can be placed on the board or drawn from the pool. Import the game’s monsters one by one (they stay as in the game; duplicate one to change it), or create your own from a type.' : abaF === 'personagens' ? 'Only NPCs listed here appear in dialogues (speaker and cast). Import the game’s NPCs (the six heroes of the box too, to speak as NPCs) or create your own with a portrait.' : abaF === 'itens' ? esc(TIPOS_ITEM.find(t => t[0] === tipoItem)[2]) + ' Only items listed in the workshop can be given by triggers, rewards and dialogues, dropped by monsters or crafted.' : abaF === 'pecas' ? 'Your own tiles, made from scratch: click the squares of their shape and pick a colour. Each one is a single physical piece (once per room, like the game tiles) and appears in the Tile palette.' : 'Your own objects, made from scratch: click the squares they cover, pick a colour and an icon, write default texts. They take triggers and requirements like any object and appear in the Object palette.'}</p>
    <div id="f_lista"></div></div>` + (abaF === 'monstros' ? `<div class="bloco"><h2>Spawn pool of the map</h2><p class="ajuda">Monsters the “Spawn from the pool” trigger draws from. Each room starts with this list and may adjust it.</p><div id="f_pool"></div></div>` : abaF === 'itens' ? `<div class="bloco"><h2>Item pool of the map</h2><p class="ajuda">Items the heroes may get in this map: random-item triggers draw from it.</p><div id="f_poolItens"></div></div>` : '');
  const l = $('#f_lista');
  botaoDeFiltro(esq.querySelector('.bloco'), lista, renderFichas);
  listaEmGrupos(l, lista, x => {
    const d = document.createElement('div'); d.className = 'no' + (fichaSel === x.id ? ' ativo' : '');
    const r = abaF === 'monstros' ? retratoDoMonstro(x) : abaF === 'personagens' ? retratoDoPersonagem(x) : abaF === 'itens' ? retratoDoItem(x) : abaF === 'pecas' ? (defPeca(x.id) ? miniatura(defPeca(x.id), x) : '') : iconeObj(x.id);
    d.innerHTML = `${r ? `<img class="face ${variante ? 'quadrada' : ''}" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="face"></span>'}<div><div>${esc(x.nome || '(no name)')}</div><small>${abaF === 'monstros' ? esc(x.tipo) + (x.tiers?.length ? ' · ' + x.tiers[0].hp + ' hp' : '') : abaF === 'personagens' ? (ehHeroiDaCaixa(x.base) ? 'hero of the box, as NPC' : 'NPC') : abaF === 'itens' ? esc(x.cls.replace('Model', '')) : abaF === 'objetos' && x.clone ? esc(tr('copy of') + ' ' + nomeObj(x.clone)) : abaF === 'pecas' || abaF === 'objetos' ? (x.cells || []).length + ' square(s) · ' + extensao(x.cells || [[0, 0]]).join('×') : ''}${variante ? '' : x.custom ? ' · custom' : x.base ? ' · from the game' : ''}</small></div>`;
    d.onclick = () => { if (fichaSel === x.id) return; fichaSel = x.id; selecionarNaListaF(lista); }; return d;
  });
  // the game's objects whose default this Workshop changed (only those: the others keep the game's default)
  if (abaF === 'objetos') { const jogo = objetosDoJogoComPadrao(); if (jogo.length) { const st = document.createElement('div'); st.className = 'sub'; st.textContent = tr('Game objects with a default of their own'); l.appendChild(st);
    jogo.forEach(k => { const d = document.createElement('div'); d.className = 'no' + (fichaSel === 'padrao:' + k ? ' ativo' : ''); d.innerHTML = `<img class="face quadrada" loading="lazy" decoding="async" ${imgTardia(iconeObj(k))} alt=""><div><div>${esc(nomeObj(k))}</div><small>${tr('game object · default of its own')}</small></div>`; d.onclick = () => { fichaSel = 'padrao:' + k; renderFichas(); }; l.appendChild(d); }); } }
  if (variante) rolDasPecasDoJogo(esq.querySelector('.bloco'));
  if (!variante) $('#f_importar').onclick = importar; $('#f_novo').onclick = () => criarFicha();
  if (abaF === 'monstros') widgetPool($('#f_pool'), projeto.reserva, renderConferencia);
  if (abaF === 'itens') { widgetPoolItens($('#f_poolItens'), projeto.itensPool = projeto.itensPool || []); buscaDeItens(esq.querySelector('.bloco'), null); }
  centroDasFichas(lista);
}
/* v240: another entry of the same list: the list stays (only the one marked changes), the sheet is drawn */
function selecionarNaListaF(lista) {
  if (EDITANDO_PADRAO) sairPadraoDaOficina();
  $$('#esqF .no.ativo').forEach(d => d.classList.remove('ativo'));
  $$('#esqF .no[data-id]').forEach(d => { if (d.dataset.id === fichaSel) d.classList.add('ativo'); });
  centroDasFichas(lista);
}
function centroDasFichas(lista) {
  const titulo = { monstros: 'Monsters', personagens: 'NPCs', itens: 'Items', pecas: 'Tiles', objetos: 'Objects' }[abaF];
  const x = lista.find(y => y.id === fichaSel);
  setTimeout(() => primeiraVista(x), 0);   // (v240: the sheet fills its defaults first)
  const c = $('#centroF');
  if (!x && abaF === 'objetos' && String(fichaSel || '').startsWith('padrao:')) { fichaObjetoJogo(c, fichaSel.slice(7)); return; }
  if (!x && pecaDoJogoSel()) { if (abaF === 'pecas') fichaPecaJogo(c, fichaSel.slice(5)); else fichaObjetoJogo(c, fichaSel.slice(5)); return; }
  if (!x) { c.innerHTML = `<div class="vazio"><h2>${titulo}</h2><p>Pick an entry on the left, import one from the game, or create a new one.</p></div>`; return; }
  if (abaF === 'monstros') fichaMonstro(c, x); else if (abaF === 'personagens') fichaPersonagem(c, x); else if (abaF === 'itens') fichaItem(c, x); else if (abaF === 'pecas') fichaPeca(c, x); else fichaObjeto(c, x);
}
/* importing from the game: click entries to tick them (several at once), or tick every entry shown, then import them together.
   filtros: [{ nome, opcoes: [[valor, rótulo]], de: entrada -> valor or [valores] }]; chips of one row add up (or), rows narrow each other (and) */
function modalImportacao(titulo, entradas, aoImportar, filtros = [], opcoes = {}) {
  const acao = opcoes.acao || 'Import';
  const marcadas = new Set();
  const escolhidos = filtros.map(() => new Set());
  const valores = (fl, x) => { const v = fl.de(x); return (Array.isArray(v) ? v : [v]).map(String); };
  filtros.forEach(fl => { fl.opcoes = fl.opcoes.filter(([v]) => entradas.some(x => valores(fl, x).includes(String(v)))); });
  const linhas = filtros.map((fl, fi) => fl.opcoes.length > 1 ? `<div class="impFiltro"><b>${esc(fl.nome)}</b>${fl.opcoes.map(([v, r]) => `<button class="sm chipF" data-f="${fi}" data-v="${esc(String(v))}">${esc(r)} <small>${entradas.filter(x => valores(fl, x).includes(String(v))).length}</small></button>`).join('')}</div>` : '').join('');
  const { fundo } = modal(titulo, `<div class="linha impBarra"><input id="imp_filtro" placeholder="filter by name…"><button class="sm" id="imp_todos">Tick all shown</button><button class="sm" id="imp_nenhum">Untick all</button><button class="sm ${opcoes.acao ? 'perigo' : 'primario'}" id="imp_ok" disabled>${acao}</button></div>${linhas ? `<div class="impFiltros">${linhas}<button class="sm" id="imp_limpa" hidden>Clear filters</button></div>` : ''}<p class="ajuda" id="imp_conta"></p><div class="grade importar" id="imp_lista"></div>`, el => {
    const ok = el.querySelector('#imp_ok');
    const conta = () => { ok.textContent = marcadas.size ? acao + ' ' + marcadas.size : acao; ok.disabled = !marcadas.size; };
    let visiveis = [];
    const passa = x => filtros.every((fl, fi) => !escolhidos[fi].size || valores(fl, x).some(v => escolhidos[fi].has(v)));
    const pinta = f => { const g = el.querySelector('#imp_lista'); g.innerHTML = ''; visiveis = entradas.filter(x => (!f || x.nome.toLowerCase().includes(f)) && passa(x));
      el.querySelector('#imp_conta').textContent = visiveis.length + ' of ' + entradas.length + ' shown';
      const lp = el.querySelector('#imp_limpa'); if (lp) lp.hidden = !escolhidos.some(e => e.size);
      visiveis.forEach(x => {
        const d = document.createElement('div'); d.className = 'item' + (x.ja ? ' usada' : '') + (marcadas.has(x) ? ' marcado' : '');
        d.innerHTML = `<span class="marca">${x.ja ? '✓' : marcadas.has(x) ? '☑' : '☐'}</span>${x.img ? `<img class="redondo" loading="lazy" decoding="async" ${imgTardia(x.img)} alt="">` : '<span class="redondo vazio"></span>'}<div>${esc(x.nome)}<small>${esc(x.sub || '')}${x.ja ? ' · imported' : ''}</small></div>`;
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
  const lista = abaF === 'monstros' ? CAT.monstros.filter(m => monstroDeEscolha(m) && m.name_en && !/^ENEMY_/.test(m.name_en)).sort((a, b) => a.name_en.localeCompare(b.name_en))
    : abaF === 'personagens' ? CAT.personagens.filter(p => p.name_en && !/^(Variable|NPC_|Text)/.test(p.name_en)).sort((a, b) => (ehHeroiDaCaixa(b._id) - ehHeroiDaCaixa(a._id)) || a.name_en.localeCompare(b.name_en))
    : CAT.itens.filter(i => doTipoItem({ cls: i._cls }, tipoItem || TIPOS_ITEM[0][0]) && i.name_en && i.name_en !== 'Text').sort((a, b) => a.name_en.localeCompare(b.name_en));
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
    : [act, { nome: 'Unique', opcoes: [['1', 'Unique'], ['0', 'Regular']], de: x => x.IsUnique ? '1' : '0' }];
  const titulo = ehItem ? tr('Import from the game') + ' · ' + tr((TIPOS_ITEM.find(t => t[0] === tipoItem) || TIPOS_ITEM[0])[1]) : 'Import from the game · ' + (abaF === 'personagens' ? 'NPCs' : 'monsters');
  modalImportacao(titulo, lista.map(x => ({ x, nome: x.name_en, img: imagem(x), sub: sub(x), ja: ja.has(x._id) })), escolhidas => {
    const novos = escolhidas.map(({ x }) => abaF === 'monstros' ? monstroDoCatalogo(x) : abaF === 'personagens' ? personagemDoCatalogo(x) : itemDoCatalogo(x));
    novos.forEach(n => bestiario()[abaF].push(n));
    if (ehItem) novos.forEach(trazerReceitasDoItem);   // (v245: the item's recipe comes with it)
    if (novos[0]) { fichaSel = novos[0].id; if (ehItem) tipoItem = TIPO_DO_ITEM(novos[0].cls); }
    renderFichas();
    aviso(novos.length === 1 ? escolhidas[0].nome + ' imported. Edit it if you like; edited entries become custom.' : novos.length + ' entries imported. Edit them if you like; edited entries become custom.');
  }, filtros.map(fl => ({ ...fl, de: e => fl.de(e.x) })));
}
function criarFicha() {
  if (abaF === 'pecas') { const v = { id: 'B_' + uid(), custom: true, nome: tr('New tile ' + (oficina().pecas.length + 1)), cells: [[0, 0], [1, 0], [0, 1], [1, 1]], cor: PALETA_CORES[0], notas: '' }; oficina().pecas.push(v); fichaSel = v.id; renderFichas(); return; }
  if (abaF === 'objetos') { const v = { id: 'B_' + uid(), custom: true, nome: tr('New object ' + (oficina().objetos.length + 1)), cells: [[0, 0]], cor: '#6a5a48', glifo: 'Oficina', icone: '', exibir: 'block', textClick: '', textUse: '', notas: '' }; oficina().objetos.push(v); fichaSel = v.id; renderFichas(); return; }
  if (abaF === 'monstros') {
    // (a monster of its own: no game monster behind it; the type, chosen in the sheet, gives the figure and the animations)
    const m = monstroNovo('Bandit'); bestiario().monstros.push(m); fichaSel = m.id; renderFichas(); aviso('New monster: pick its type and fill in its sheet.');
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
  lista.splice(lista.indexOf(x), 1); if (abaF === 'itens') tirarReceitasDoItem(x); esquecerFicha(abaF, x.id); fichaSel = null; renderFichas();
}
/* v245: the same button in the list of each tab, beside Import and Create (the header keeps its own); one listener on the list */
const botaoLote = () => `<button class="sm" data-lote title="${esc(tr('Tick several entries of this tab and delete them at once'))}">${esc(tr('🗑 Delete several…'))}</button>`;
$('#esqF').addEventListener('click', e => { if (e.target.closest('[data-lote]')) apagarVarios(); });
/* 🗑 Delete several…: the entries of the tab on screen (filtered by name and kind), ticked and deleted at once. What a
   single Delete does for each is done here too: placements taken off the board, ids forgotten in pools, loot and rewards */
function entradasParaApagar() {
  const b = oficina(); const proprio = x => (x.custom || !x.base) ? 'own' : 'jogo';
  const nomeTipo = cls => (TIPOS_ITEM.find(([k]) => doTipoItem({ cls }, k)) || [, cls.replace('Model', '')])[1];
  switch (abaF) {
    case 'monstros': return b.monstros.map(x => ({ x, nome: x.nome || '(no name)', img: retratoDoMonstro(x), sub: '', origem: proprio(x) }));
    case 'personagens': return b.personagens.map(x => ({ x, nome: x.nome || '(no name)', img: retratoDoPersonagem(x), sub: '', origem: proprio(x) }));
    case 'itens': return b.itens.filter(i => doTipoItem(i, tipoItem)).map(x => ({ x, nome: x.nome || '(no name)', img: retratoDoItem(x), sub: nomeTipo(x.cls), tipo: TIPO_DO_ITEM(x.cls), origem: proprio(x) }));
    case 'armas': return b.itens.filter(i => i.cls === 'WeaponPartsModel').map(x => { const k = CLASSES_ARMA.indexOf(x.classe); return { x, nome: x.nome || '(no name)', img: retratoDoItem(x), sub: (NOME_CLASSE[k] || x.classe || '') + ' · ' + (x.slot || 'A'), arma: x.classe || '' }; });
    case 'receitas': return (b.receitas || []).map(x => ({ x, nome: nomeReceita(x), img: '', sub: '' }));
    case 'facanhas': return (b.facanhas || []).map(x => ({ x, nome: nomeFacanha(x), img: '', sub: x.heroi ? nomeDoHeroi(x.heroi) : '' }));
    case 'pericias': return (b.pericias || []).map(x => ({ x, nome: nomePericia(x), img: (x.cartas || [])[0]?.img || '', sub: x.heroi ? nomeDoHeroi(x.heroi) : '' }));
    case 'pecas': return (b.pecas || []).map(x => ({ x, nome: x.nome || x.id, img: defPeca(x.id) ? miniatura(defPeca(x.id)) : '', sub: '' }));
    case 'objetos': return (b.objetos || []).map(x => ({ x, nome: x.nome || x.id, img: '', sub: '' }));
    case 'herois': return heroisNovos().map(x => ({ x, nome: x.nome || tr('New hero'), img: x.retrato || '', sub: x.perfil ? tr('plays the profile of') + ' ' + nomeDoHeroiJogo(x.perfil) : tr('in the roster') }));
  }
  return null;
}
function apagarVarios() {
  // (v249: in the skills of a hero, the batch is of the Workshop's skills)
  if (abaF === 'herois' && String(heroiSel).startsWith(PERICIAS)) { abaF = 'pericias'; try { return apagarVarios(); } finally { if (abaF === 'pericias') abaF = 'herois'; } }
  const ents = entradasParaApagar(); if (!ents) return aviso(tr('This tab has nothing to delete in a batch.')); if (!ents.length) return aviso(tr('Nothing to delete in this tab.'));
  const filtros = [];
  if (abaF === 'armas') filtros.push({ nome: 'Weapon', opcoes: CLASSES_ARMA.map((c, k) => [c, NOME_CLASSE[k]]), de: e => e.arma });
  if (['monstros', 'personagens', 'itens'].includes(abaF)) filtros.push({ nome: 'Origin', opcoes: [['own', 'Made here or in a package'], ['jogo', 'Imported from the game']], de: e => e.origem });
  const aba = abaF; modalImportacao(tr('Delete several'), ents, escolhidas => { const a0 = abaF; abaF = aba; try { apagarEstas(escolhidas.map(e => e.x)); } finally { if (abaF === aba && aba !== a0) abaF = a0; } }, filtros, { acao: 'Delete' });
}
function apagarEstas(xs) {
  if (!xs.length) return; const b = oficina(); const ids = new Set(xs.map(x => x.id)); const mapas = campanha ? campanha.missoes : [projeto];
  // (what is on the board: counted first, asked once)
  let noTabuleiro = 0;
  if (abaF === 'pecas' || abaF === 'objetos') mapas.forEach(m => m.salas.forEach(s => { noTabuleiro += abaF === 'pecas' ? s.pecas.filter(p => ids.has(p.tile)).length : s.objetos.filter(o => ids.has(o.type)).length; }));
  if (abaF === 'monstros') mapas.forEach(m => m.salas.forEach(s => { noTabuleiro += inimigosDaSala(s).filter(({ e }) => ids.has(e.enemy)).length; }));
  const pergunta = tr('Delete') + ' ' + xs.length + ' ' + tr(xs.length > 1 ? 'entries' : 'entry') + '?' + (noTabuleiro ? ' ' + noTabuleiro + ' ' + tr(abaF === 'monstros' ? 'of them are placed on the board (those monsters become invalid).' : 'placements on the board go too.') : '') + ' ' + tr('It cannot be undone.');
  if (!confirm(pergunta)) return;
  if (abaF === 'pecas' || abaF === 'objetos') {
    mapas.forEach(m => m.salas.forEach((s, si) => {
      if (abaF === 'pecas') { for (let pi = s.pecas.length - 1; pi >= 0; pi--) if (ids.has(s.pecas[pi].tile)) { if (m === projeto) removerPecaComAnexos(si, pi); else s.pecas.splice(pi, 1); } }
      else { for (let oi = s.objetos.length - 1; oi >= 0; oi--) if (ids.has(s.objetos[oi].type)) { if (m === projeto) removerObjeto(si, oi, true, true); else s.objetos.splice(oi, 1); } }
    }));
    sel = null; if (ids.has(pecaEscolhida)) pecaEscolhida = PECAS[0].id; if (ids.has(objetoEscolhido)) objetoEscolhido = 'Door';
  }
  const fora = (k, tipo) => { b[k] = (b[k] || []).filter(x => !ids.has(x.id)); if (tipo) ids.forEach(id => esquecerFicha(tipo, id)); };
  if (abaF === 'monstros') fora('monstros', 'monstros');
  else if (abaF === 'personagens') fora('personagens', 'personagens');
  else if (abaF === 'itens' || abaF === 'armas') { fora('itens', 'itens'); xs.forEach(tirarReceitasDoItem); }
  else if (abaF === 'pecas' || abaF === 'objetos') fora(abaF, null);
  else if (abaF === 'receitas') { fora('receitas', null); ids.forEach(id => esquecerFicha('itens', 'RECEITA:' + id)); }
  else if (abaF === 'facanhas') { fora('facanhas', null); b.poolFacanhas = (b.poolFacanhas || []).filter(id => !ids.has(id)); }
  else if (abaF === 'pericias') fora('pericias', null);
  else if (abaF === 'herois') b.herois = b.herois.filter(x => !(ehHeroiNovo(x) && ids.has(x.id)));
  fichaSel = null; if (abaF === 'herois') heroiSel = null; if (abaF === 'armas') pecaAberta = null;
  renderFichas(); aviso(xs.length + ' ' + tr(xs.length > 1 ? 'entries deleted.' : 'entry deleted.'));
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
function retratoAtual(x) { return abaF === 'monstros' ? retratoDoMonstro(x) : abaF === 'personagens' ? retratoDoPersonagem(x) : retratoDoItem(x); }
function retratoCampo(x, rotuloTxt) {
  const atual = retratoAtual(x);
  return `<div class="retrato"><div class="quadro">${atual ? `<img loading="lazy" decoding="async" ${imgTardia(atual)} alt="">` : '<span>no portrait</span>'}</div><div><label class="sm botaoArquivo">Upload PNG/JPG<input type="file" accept="image/png,image/jpeg,image/webp" data-retrato hidden></label>${atual ? botaoAjustar('retrato') : ''}${x.retrato ? '<button class="sm" data-retratoLimpa>Use the game art</button>' : ''}${fonteDoCampo(x, 'arte') && !x.retratoDaArte ? `<button class="sm" data-retratoArte title="${esc(tr('The portrait cut from the picture of the figure; ✎ Adjust fits it'))}">${esc(tr(x.tiers ? 'Use the picture of the monster' : 'Use its picture'))}</button>` : ''}<p class="ajuda">${rotuloTxt}</p>${x.retratoDaArte ? '<p class="ajuda">Made from the picture of the monster (below): ✎ Adjust fits it in the portrait.</p>' : ''}</div></div>`;
}
const LADO_RETRATO = { monstros: 256, personagens: 512, itens: 256, herois: 256 };
function ligarRetrato(el, x, lado) {
  const inp = el.querySelector('[data-retrato]'); if (inp) inp.onchange = async e => { const f = e.target.files[0]; if (!f) return; await retratoDeArquivo(x, f, lado || 256); x.custom = true; delete IMG['ini:' + x.id]; renderFichas(); };
  const lp = el.querySelector('[data-retratoLimpa]'); if (lp) lp.onclick = () => { x.retrato = ''; esquecerAjuste(x, 'retrato'); delete x.retratoDaArte; delete IMG['ini:' + x.id]; renderFichas(); };
  // (v241: the portrait made from the picture of the figure, like the card on the board; ✎ Adjust makes it a portrait)
  const ra = el.querySelector('[data-retratoArte]'); if (ra) ra.onclick = async () => { await retratoDaArte(x, lado || 256); x.custom = true; delete IMG['ini:' + x.id]; renderFichas(); };
}

/* ------------------------------------------------------------ ✎ Adjust the picture
   A picture fitted in its frame (a portrait, a card, an icon…): its size, where it sits (dragged) and mirrored. The picture
   as uploaded stays in x.fontes[field] and the adjustment in x.ajustes[field], so it can be adjusted again without losing
   quality; x[field] is the picture as adjusted. A portrait is made by itself from the picture used (the uploaded one, or
   the monster's or hero's picture): its frame is square, cut from the top of a tall picture (where the face is). */
const carregarImagem = src => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = original(src); });   // (v238: the original, never the editor's light copy)
/* the picture in a W×H frame: covering it, times z, moved by dx, dy (fractions of the frame), mirrored */
function desenharAjuste(g, img, W, H, a) {
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (a.z || 1), w = img.naturalWidth * k, h = img.naturalHeight * k;
  g.save(); g.translate(W / 2 + (a.dx || 0) * W, H / 2 + (a.dy || 0) * H); if (a.esp) g.scale(-1, 1); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
}
async function assarAjuste(src, W, H, a) { const img = await carregarImagem(src); const cv = document.createElement('canvas'); cv.width = W; cv.height = H; desenharAjuste(cv.getContext('2d'), img, W, H, a); return cv.toDataURL('image/png'); }
/* the first adjustment of a portrait: the whole frame covered; a tall picture shows its top */
async function ajusteDeRetrato(src, W, H) { const img = await carregarImagem(src); const k = Math.max(W / img.naturalWidth, H / img.naturalHeight), h = img.naturalHeight * k; return { z: 1, dx: 0, dy: h > H * 1.15 ? Math.round(((h - H) / 2 - 0.03 * h) / H * 1000) / 1000 : 0, esp: false }; }
const fonteDoCampo = (x, campo) => (x.fontes || {})[campo] || x[campo] || '';
function esquecerAjuste(x, campo) { if (x.fontes) delete x.fontes[campo]; if (x.ajustes) delete x.ajustes[campo]; }
function guardarAjuste(x, campo, fonte, a) { if (fonte) (x.fontes = x.fontes || {})[campo] = fonte; else if (x.fontes) delete x.fontes[campo]; (x.ajustes = x.ajustes || {})[campo] = a; }
/* an uploaded portrait: kept as the source (up to 1024 px), the portrait made from it */
async function retratoDeArquivo(x, f, lado, moldura) {
  const src = await lerImagem(f, 1024); const a = await ajusteDeRetrato(src, lado, lado);
  delete x.retratoDaArte; guardarAjuste(x, 'retrato', src, a); x.retrato = await assarAjuste(src, lado, lado, a); if (moldura) x.retrato = await emMoldura(x.retrato);
}
/* the portrait made from the picture of the monster or hero (when it has no portrait of its own) */
async function retratoDaArte(x, lado, moldura) {
  const src = fonteDoCampo(x, 'arte'); if (!src) return; const a = await ajusteDeRetrato(src, lado, lado);
  x.retratoDaArte = true; guardarAjuste(x, 'retrato', null, a); x.retrato = await assarAjuste(src, lado, lado, a); if (moldura) x.retrato = await emMoldura(x.retrato);
}
const botaoAjustar = campo => `<button class="sm" data-ajustar="${campo}" title="${esc(tr('Size, position and mirror of the picture'))}">✎ ${esc(tr('Adjust'))}</button>`;
/* the window: the frame (round for a hero's framed portrait), the picture faint outside it; drag, wheel or slider */
function ajustarImagem(o) {
  const { W, H } = o; const a = Object.assign({ z: 1, dx: 0, dy: 0, esp: false }, o.ajuste || {});
  const vis = Math.min(1, 300 / Math.max(W, H)), M = 0.3, CW = Math.round(W * (1 + 2 * M)), CH = Math.round(H * (1 + 2 * M));
  modal(o.titulo || tr('Adjust the picture'), `<div class="ajusteImg"><canvas id="aj_tela" width="${CW}" height="${CH}" style="width:${Math.round(CW * vis)}px;height:${Math.round(CH * vis)}px" tabindex="0"></canvas><div class="ajLado">
      <label class="campo">Size <input type="range" id="aj_z" min="10" max="400" value="${Math.round(a.z * 100)}"></label>
      <label class="chk"><input type="checkbox" id="aj_esp" ${a.esp ? 'checked' : ''}> Mirror (flip left to right)</label>
      <div class="botoes"><button class="sm" id="aj_inteira">Whole picture</button><button class="sm" id="aj_cobrir">Fill the frame</button><button class="sm" id="aj_centro">Centre</button></div>
      <p class="ajuda">Drag the picture to move it; the wheel or the slider changes its size; the arrows nudge it. What is outside the ${o.redondo ? 'circle' : 'frame'} shows faint and is cut.${o.ajuda ? ' ' + o.ajuda : ''}</p>
      <div class="botoes"><button class="sm primario" id="aj_ok">Apply</button><button class="sm" id="aj_cancela">Cancel</button></div></div></div>`, async (el, fechar) => {
    const img = await carregarImagem(o.fonte).catch(() => null); if (!img) { fechar(); return aviso('Could not open this picture.'); }
    const tela = el.querySelector('#aj_tela'), g = tela.getContext('2d'), fz = el.querySelector('#aj_z');
    const ox = W * M, oy = H * M;
    const pintar = () => { g.clearRect(0, 0, CW, CH);
      for (let y = 0; y < CH; y += 16) for (let x = 0; x < CW; x += 16) { g.fillStyle = ((x + y) / 16) % 2 ? '#3a3f4a' : '#2f333c'; g.fillRect(x, y, 16, 16); }
      g.save(); g.translate(ox, oy); g.globalAlpha = 0.3; desenharAjuste(g, img, W, H, a); g.globalAlpha = 1;
      g.beginPath(); if (o.redondo) g.arc(W / 2, H / 2, Math.min(W, H) / 2 - 14, 0, Math.PI * 2); else g.rect(0, 0, W, H); g.save(); g.clip(); desenharAjuste(g, img, W, H, a); g.restore();
      g.lineWidth = Math.max(2, 2 / vis); g.strokeStyle = '#e0a458'; g.setLineDash([]); g.stroke(); g.restore(); fz.value = Math.round(a.z * 100); };
    let arr = null;
    const ponto = e => { const r = tela.getBoundingClientRect(); return [(e.clientX - r.left) * CW / r.width, (e.clientY - r.top) * CH / r.height]; };
    tela.onpointerdown = e => { const [x, y] = ponto(e); arr = { x, y, dx: a.dx, dy: a.dy }; tela.setPointerCapture(e.pointerId); tela.focus(); };
    tela.onpointermove = e => { if (!arr) return; const [x, y] = ponto(e); a.dx = arr.dx + (x - arr.x) / W; a.dy = arr.dy + (y - arr.y) / H; pintar(); };
    tela.onpointerup = () => { arr = null; };
    tela.onwheel = e => { e.preventDefault(); a.z = Math.max(0.1, Math.min(4, a.z * (e.deltaY < 0 ? 1.05 : 1 / 1.05))); pintar(); };
    tela.onkeydown = e => { const d = (e.shiftKey ? 10 : 1) / Math.max(W, H); const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]; if (mv) { e.preventDefault(); a.dx += mv[0]; a.dy += mv[1]; pintar(); } };
    fz.oninput = () => { a.z = +fz.value / 100; pintar(); };
    el.querySelector('#aj_esp').onchange = e => { a.esp = e.target.checked; pintar(); };
    el.querySelector('#aj_inteira').onclick = () => { a.z = Math.min(W / img.naturalWidth, H / img.naturalHeight) / Math.max(W / img.naturalWidth, H / img.naturalHeight); a.dx = a.dy = 0; pintar(); };
    el.querySelector('#aj_cobrir').onclick = () => { a.z = 1; pintar(); };
    el.querySelector('#aj_centro').onclick = () => { a.dx = a.dy = 0; pintar(); };
    el.querySelector('#aj_cancela').onclick = fechar;
    el.querySelector('#aj_ok').onclick = async () => { ['z', 'dx', 'dy'].forEach(k => { a[k] = Math.round(a[k] * 1000) / 1000; }); const png = await assarAjuste(o.fonte, W, H, a); fechar(); await o.aoAplicar(png, { ...a }); };
    pintar();
  });
}
/* ✎ Adjust on a sheet: the field's picture (a portrait made from the monster's picture uses that one) in its frame */
async function abrirAjuste(x, campo, apos, cfg = {}) {
  let fonte = fonteDoCampo(x, campo), derivado = false;
  if (campo === 'retrato' && !cfg.livre) { if (x.retratoDaArte && fonteDoCampo(x, 'arte')) { fonte = fonteDoCampo(x, 'arte'); derivado = true; } else if (!(x.fontes || {}).retrato) fonte = cfg.fonte || retratoAtual(x); }
  if (campo === 'standee' && !x.standee && cfg.fonte) { fonte = cfg.fonte; }
  if (!fonte) return aviso('No picture to adjust.');
  let W = cfg.lado || 0, H = cfg.lado || 0;
  if (!W) { const i = await carregarImagem(x[campo] || fonte).catch(() => null); if (!i) return aviso('Could not open this picture.'); W = i.naturalWidth; H = i.naturalHeight; }
  const ajuste = (x.ajustes || {})[campo] || (campo === 'retrato' && !cfg.livre ? await ajusteDeRetrato(fonte, W, H) : null);
  ajustarImagem({ W, H, fonte, ajuste, redondo: cfg.redondo, ajuda: cfg.ajuda, titulo: tr('Adjust the picture'), aoAplicar: async (png, a) => {
    guardarAjuste(x, campo, derivado ? null : fonte, a); x[campo] = cfg.moldura ? await emMoldura(png) : png;
    if (!['pecas', 'objetos', 'herois', 'armas'].includes(abaF)) x.custom = true;
    Object.keys(IMG).forEach(k => { if (k.includes(x.id)) delete IMG[k]; });
    (apos || (() => { renderFichas(); desenhar(); }))(); } });
}
/* ⇋ Mirror on its own (the weapon parts' pictures) */
function espelharImagem(src) { return new Promise((ok, erro) => { const i = new Image(); i.onload = () => { const cv = document.createElement('canvas'); cv.width = i.naturalWidth; cv.height = i.naturalHeight; const g = cv.getContext('2d'); g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(i, 0, 0); ok(cv.toDataURL("image/png")); }; i.onerror = erro; i.src = original(src); }); }
function ligarEspelhos(el, x, cfgs = {}) {
  el.querySelectorAll('[data-ajustar]').forEach(b => b.onclick = () => { const campo = b.dataset.ajustar; abrirAjuste(x, campo, null, Object.assign(campo === 'retrato' ? { lado: LADO_RETRATO[abaF] || 256 } : {}, cfgs[campo] || {})); });
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
  // (v240: read without filling the defaults in: an entry of a package read for the export is not changed)
  const s = m.sons && m.sons.modo ? { ...m.sons, arquivos: m.sons.arquivos || {} } : { modo: 'tipo', tipo: m.tipo || 'Bandit', arquivos: {} };
  if (s.modo !== 'arquivos') return { mode: 'type', type: s.tipo || m.tipo || '' };
  const r = { mode: 'files' }; MOMENTOS_SOM.forEach(([k]) => { if (s.arquivos[k]) r[k] = s.arquivos[k].arquivo; }); return r;
}

// ------------------------------------------------------------ monster sheet
function fichaMonstro(c, m) {
  const orig = monstroOriginal(m);
  const cab = `<div class="cabF"><h2>${esc(m.nome)} <span class="etq ${orig ? '' : 'custom'}">${orig ? 'original of the game' : 'custom'}</span></h2><div class="botoes"><button class="sm ${orig ? 'primario' : ''}" id="fm_dup">Duplicate</button><button class="sm perigo" id="fm_apaga">Delete</button></div></div>`
    + (orig ? '<p class="ajuda aviso">An original of the game: its name, numbers, activations, tactics and defense stay as in the game. Duplicate it (with another name) to make a monster of your own from it. The pictures, the loot and the sounds may change here.</p>' : '');
  const variantes = CAT.monstros.filter(z => monstroDeEscolha(z) && TIPOS_MONSTRO[z.Type] === m.tipo && z.name_en && !/^ENEMY_/.test(z.name_en));
  c.innerHTML = cab + `<div class="folha">
    <div class="col">
      ${retratoCampo(m, 'Shown on the monster tab in the app and in this editor. Square, 256 px or more.')}
      <div class="duas"><label class="campo">Name (singular) <input data-c="nome" value="${esc(m.nome)}"></label><label class="campo">Plural <input data-c="plural" value="${esc(m.plural || '')}"></label></div>
      <div data-descricao></div>
      <div class="duas"><label class="campo">Type ${orig ? `<input value="${esc(m.tipo)}" disabled>` : `<select data-tipom>${TIPOS_MONSTRO.filter(Boolean).slice().sort((a, b) => a.localeCompare(b)).map(t => `<option ${m.tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`}<small class="ajuda">The figure, animations and behaviour family in the app.</small></label>
      <label class="campo">Size <select data-c="size">${TAMANHOS.map((t, i) => `<option value="${i}" ${m.size === i ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <label class="campo">Behaviour (rules and figure of…) <select data-c="comportamento">${variantes.map(z => `<option value="${esc(z._id)}" ${m.comportamento === z._id ? 'selected' : ''}>${esc(z.name_en)}${z.IsNamed ? ' (boss)' : ''}</option>`).join('')}</select><small class="ajuda">The app runs this monster with the logic, figure and animations of the chosen game monster of the same type.</small></label>
      <div class="duas"><label class="chk"><input type="checkbox" data-c="named" ${m.named ? 'checked' : ''}> Named (unique boss)</label><label class="chk"><input type="checkbox" data-c="villain" ${m.villain ? 'checked' : ''}> Villain (boss music and tab)</label></div>
      <div class="sub">Animated art (activation, attack and info windows)</div>
      <div class="botoes"><button class="sm ${m.arteModo === 'imagem' ? '' : 'ativo'}" data-arte="jogo">Animation of the game</button><button class="sm ${m.arteModo === 'imagem' ? 'ativo' : ''}" data-arte="imagem">My picture</button></div>
      ${m.arteModo === 'imagem' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${m.arte ? `<img loading="lazy" decoding="async" ${imgTardia(m.arte)} alt="">` : '<span>no picture</span>'}</div><div>
        <label class="sm botaoArquivo">Upload the picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-arteimg hidden></label>${m.arte ? botaoAjustar('arte') : ''}
        ${ajustesArte(m, false, k => ({ esc: 'data-artesc', alt: 'data-artey', lado: 'data-artex' })[k])}
        <p class="ajuda">Takes the place of the animated drawing of the behaviour monster in the windows that show it (its activation, a hero attacking it, its info). It is fitted to the part of each window that is really visible; the adjustments above move it from there. It breathes lightly, and the game’s own hit reactions (shake, flash) apply to it. PNG with a transparent background looks best.</p></div></div>`
        : '<p class="ajuda">The animated drawing of the monster chosen in Behaviour.</p>'}
      <div class="sub">Figure on the board</div>
      <div class="botoes"><button class="sm ${!['standee', 'modelo'].includes(m.figura) ? 'ativo' : ''}" data-fig="anim">${L2('Animated (game)', 'Animada (jogo)')}</button><button class="sm ${m.figura === 'standee' ? 'ativo' : ''}" data-fig="standee">Standing card</button><button class="sm ${m.figura === 'modelo' ? 'ativo' : ''}" data-fig="modelo">3D model</button></div>
      ${m.figura === 'modelo' ? `<div id="fm_modelo"></div>` : ''}
      ${m.figura === 'standee' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${standeeDoMonstro(m) ? `<img loading="lazy" decoding="async" ${imgTardia(standeeDoMonstro(m))} alt="">` : '<span>no picture</span>'}</div><div>
        <p class="ajuda">${m.standee ? 'A picture of its own for the card.' : m.arte ? 'The picture of the monster (above), standing on the board.' : 'Upload the picture of the monster (Animated art → My picture): the card uses it. Or one for the card only:'}</p>
        <label class="sm botaoArquivo">${m.arte || m.standee ? 'Another picture for the card' : 'Upload the card picture (PNG)'}<input type="file" accept="image/png,image/webp,image/jpeg" data-standee hidden></label>${standeeDoMonstro(m) ? botaoAjustar('standee') : ''}${m.standee && m.arte ? '<button class="sm" data-standeeArte>Use the monster’s picture</button>' : ''}
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
      <div class="sub">Activations ${orig ? '' : '<button class="sm" id="fm_ativ">+ Activation</button><button class="sm" id="fm_ativImp">Import…</button>'}</div>
      <p class="ajuda"><b>The order counts:</b> the monster does its activations in this order (1 first); ↑ ↓ change it. “next” chains them. Speed, damage, aim, attack, range, healing, shield, initiative and range type are the numbers the app uses; the text is what the players read.</p>
      <div id="fm_ativs"></div>
      <div class="sub">Tactics (manual activations) ${orig ? '' : '<button class="sm" id="fm_tat">+ Tactic</button><button class="sm" id="fm_tatImp">Import…</button>'}</div>
      <p class="ajuda">Special activations the app may pick through the type’s behaviour. A tactic made here (+ Tactic) is picked by Bigorna instead: each round the app draws among the tactics whose condition holds, or none, never the same one twice in a row; the hint is shown when it is revealed, the text when the monster activates. With at least one of them, the game’s tactics of this monster stop coming.</p>
      <div id="fm_tats"></div>
      <div class="sub">Defense (when a hero attacks it)</div>
      <p class="ajuda">The monster’s own rule shown in the attack window, like the bandit’s “Smokebomb”. Leave empty to keep the one of the behaviour monster.</p>
      ${orig ? '' : `<div class="linha"><button class="sm" id="fm_defimport" title="Copy a defense of the game">Import…</button><span class="ajuda">a defense of the game</span></div>
      <label class="campo" id="fm_defcopiaCampo" hidden>A defense of the game <select id="fm_defcopia"><option value="">— pick one —</option>${DEFESAS_DO_JOGO().map((d, i) => `<option value="${i}">${esc(d.regra)}: ${esc(semTagsDefesa(d.texto).replace(/^[^:]{1,40}:\s*/, '').slice(0, 110))}</option>`).join('')}</select></label>`}
      <div class="txAtiv txDefesa" id="fm_def"></div>
      <label class="chk"><input type="checkbox" id="fm_defapos" ${m.defesaApos ? 'checked' : ''}> Show it after the attack (not before)</label>
      ${defesaImportada(m) ? `<div class="sub pequena">What the app does by itself when a hero attacks it</div>
      <div class="botoes">${[['jogo', 'Same as the behaviour monster'], ['nenhum', 'Nothing (the table applies the text)'], ['proprio', 'My own effect']].map(([k, n]) => `<button class="sm ${(m.defesaModo || 'jogo') === k ? 'ativo' : ''}" data-dmodo="${k}">${n}</button>`).join('')}</div>
      ${(m.defesaModo || 'jogo') === 'proprio' ? `<div id="fm_defef">${(m.defesaEfeitos || []).map((f, i) => `<div class="linha efeitoDef"><select data-ef="tipo" data-i="${i}">${EFEITOS_DEFESA.map(([k, n]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select><label>N <select data-ef="n" data-i="${i}">${opcoesDoN(f)}</select></label>${camposDoReforco(f, 'd:' + i)}<button class="sm" data-efx="${i}">✕</button></div>`).join('') || '<p class="ajuda">No effect yet.</p>'}</div><button class="sm" id="fm_defadd">+ Effect</button><p class="ajuda">Applied every time a hero attacks this monster, before the attack. Write the same in the rules above so the players know.</p>`
        : `<p class="ajuda">${(m.defesaModo || 'jogo') === 'nenhum' ? 'The app changes nothing; the players apply the defense at the table.' : 'The behaviour monster’s rule: ' + (DEFESA_AUTOMATICA[m.tipo] || 'none, the players apply the text at the table') + '.'}</p>`}` : (m.defesa || '').trim() ? '<p class="ajuda">A defense of your own: the players apply it at the table (the app applies by itself only a defense imported from the game).</p>' : ''}
      <div class="sub">Default loot</div>
      <div id="fm_loot"></div>
      <div class="sub">Sounds</div>
      <div id="fm_sons"></div>
    </div></div>`;
  ligarRetrato(c, m, 256); ligarEspelhos(c, m, { standee: { fonte: fonteDoCampo(m, 'arte') } });
  liga(c, m, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = m.nome + ' '; renderFichasLista(true); } if (k === 'size') m.size = +m.size; });
  editorDeDescricao(c.querySelector('[data-descricao]'), m, 'desc', 'Description', () => marcar(m, c));
  ligaChks(c, m);
  c.querySelectorAll('[data-wr]').forEach(s => s.onchange = () => { m.wr = (m.wr || []).filter(z => z.dano !== s.dataset.wr); if (s.value) { const [tipo, quando] = s.value.split(':'); m.wr.push({ dano: s.dataset.wr, tipo, quando: quando || 'always' }); } marcar(m, c); });
  ligarSons(c.querySelector('#fm_sons'), m, c);
  c.querySelectorAll('[data-arte]').forEach(b => b.onclick = () => { m.arteModo = b.dataset.arte; if (m.arteModo === 'imagem' && !m.arte) aplicarPadraoArte(m, false); marcar(m, c); renderFichas(); });
  // (the picture of the monster: the portrait is made from it, if it has none of its own, and the board card uses it)
  const ua = c.querySelector('[data-arteimg]'); if (ua) ua.onchange = async e => { const f = e.target.files[0]; if (!f) return; if (!m.arte) aplicarPadraoArte(m, false); m.arte = await lerImagem(f, 768); esquecerAjuste(m, 'arte');
    if (!m.retrato || m.retratoDaArte) await retratoDaArte(m, 256);
    if (m.figura !== 'modelo' && !m.standee) m.figura = 'standee';
    Object.keys(IMG).forEach(k => { if (k.includes(m.id)) delete IMG[k]; }); marcar(m); renderFichas(); desenhar(); };
  const aes = c.querySelector('[data-artesc]'); if (aes) aes.onchange = e => { m.arteEscala = +e.target.value; marcar(m, c); };
  const aey = c.querySelector('[data-artey]'); if (aey) aey.onchange = e => { m.arteAltura = +e.target.value; marcar(m, c); };
  const aex = c.querySelector('[data-artex]'); if (aex) aex.onchange = e => { m.arteLado = +e.target.value; marcar(m, c); };
  const sa = c.querySelector('[data-standeeArte]'); if (sa) sa.onclick = () => { m.standee = ''; esquecerAjuste(m, 'standee'); delete IMG['standee:' + m.id]; marcar(m); renderFichas(); desenhar(); };
  c.querySelectorAll('[data-fig]').forEach(b => b.onclick = () => { m.figura = b.dataset.fig; marcar(m, c); renderFichas(); desenhar(); });
  const us = c.querySelector('[data-standee]'); if (us) us.onchange = async e => { const f = e.target.files[0]; if (!f) return; m.standee = await lerImagem(f, 512); esquecerAjuste(m, 'standee'); marcar(m); delete IMG['standee:' + m.id]; renderFichas(); desenhar(); };
  const es = c.querySelector('[data-esc]'); if (es) es.onchange = e => { m.escalaStandee = +e.target.value; marcar(m, c); desenhar(); };
  const fmm = c.querySelector('#fm_modelo'); if (fmm) campoModelo3d(fmm, m, () => marcar(m, c));
  // (a duplicate is a monster of its own, under another name: an original's behaviour stays its figure and logic)
  $('#fm_dup').onclick = () => { const nomes = new Set(bestiario().monstros.map(z => (z.nome || '').trim().toLowerCase()));
    let nome = (prompt(tr('Name of the new monster (different from the original’s):'), m.nome + ' ' + tr('(copy)')) || '').trim(); if (!nome) return;
    if (nomes.has(nome.toLowerCase())) return aviso(tr('There is already a monster with this name. Pick another.'));
    const d = clone(m); d.id = 'B_' + uid(); d.nome = nome; d.plural = nome; d.custom = true; if (d.base) { d.comportamento = d.comportamento || d.base; d.base = null; delete d.nomeJogo; if ((d.defesa || '').trim()) d.defesaImportada = true; }
    bestiario().monstros.push(d); fichaSel = d.id; renderFichas(); aviso(tr('Duplicated: this one is yours to change.')); };
  const tpm = c.querySelector('[data-tipom]'); if (tpm) tpm.onchange = () => { mudarTipoDoMonstro(m, tpm.value); Object.keys(IMG).forEach(k => { if (k.includes(m.id)) delete IMG[k]; }); marcar(m); renderFichas(); desenhar(); };
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
  const ativs = (chave, el) => { const lista = m[chave] || (m[chave] = []); el.innerHTML = lista.map((a, i) => `<div class="ativ ${chave === 'taticas' ? 'tatica' : ''}"><div class="cabAtiv"><span class="numAtiv">${chave === 'taticas' ? L2('Tactic', 'Tática') : L2('Activation', 'Ativação')} ${i + 1}</span><input data-a="nome" data-i="${i}" value="${esc(nomeAtivacao(a))}" placeholder="Name">${orig ? '' : `<button class="sm" data-asobe="${i}" title="${esc(tr('Move up'))}" ${i ? '' : 'disabled'}>↑</button><button class="sm" data-adesce="${i}" title="${esc(tr('Move down'))}" ${i < lista.length - 1 ? '' : 'disabled'}>↓</button><button class="sm" data-arol="${i}" title="${esc(tr('Keep a copy in the roll of activations and tactics: it can be imported into any monster, in any map'))}">${noRol(chave, a) ? '✓ ' + esc(tr('In the roll')) : '+ ' + esc(tr('Add to the roll'))}</button><button class="sm" data-ax="${i}" title="Delete this ${chave === 'taticas' ? 'tactic' : 'activation'}">✕</button>`}</div>
      <div class="nums">${['speed', 'damage', 'aim', 'attack', 'range', 'healing', 'shield', 'initiative'].map(k => `<label>${k}<input type="number" data-a="${k}" data-i="${i}" value="${a[k] || 0}"></label>`).join('')}<label>range type<select data-a="rangeType" data-i="${i}">${ALCANCES.map(r => `<option ${a.rangeType === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label><label>next<select data-a="next" data-i="${i}"><option value="">—</option>${lista.map((z, j) => j !== i ? `<option value="${esc(z.id || z.nome)}" ${a.next === (z.id || z.nome) ? 'selected' : ''}>${esc(z.nome)}</option>` : '').join('')}</select></label></div>
      ${chave === 'taticas' && taticaPropria(a) ? `<div class="linha quandoTat"><label class="campo">When it can come <select data-a="quando" data-i="${i}">${QUANDO_TATICA.map(([k, n]) => `<option value="${k}" ${(a.quando || 'sempre') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div class="efeitosTat"><small>When revealed, the app applies:</small> ${(a.efeitos || []).map((f, j) => `<span class="tag"><select data-tef="tipo" data-i="${i}" data-j="${j}">${EFEITOS_DEFESA.map(([k, n]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select> N <select data-tef="n" data-i="${i}" data-j="${j}">${opcoesDoN(f)}</select>${camposDoReforco(f, i + ':' + j)} <a href="#" data-tefx="${i}:${j}">✕</a></span>`).join('')} <button class="sm" data-tefadd="${i}">+ effect</button></div></div>` : ''}
      <div class="txAtiv" data-i="${i}"></div></div>`).join('') || '<p class="ajuda">None.</p>';
    el.querySelectorAll('[data-a]').forEach(inp => { const h = () => { const a = lista[+inp.dataset.i]; a[inp.dataset.a] = inp.type === 'number' ? +inp.value || 0 : inp.value; marcar(m, c); }; if (inp.tagName === 'SELECT' || inp.type === 'number') inp.onchange = h; else inp.oninput = h; });
    el.querySelectorAll('.txAtiv').forEach(d => editorDeTexto(d, lista[+d.dataset.i], () => marcar(m, c)));
    el.querySelectorAll('[data-tef]').forEach(sl => sl.onchange = () => { const f = lista[+sl.dataset.i].efeitos[+sl.dataset.j]; f[sl.dataset.tef] = sl.dataset.tef === 'n' ? +sl.value : sl.value; marcar(m, c); if (sl.dataset.tef === 'tipo') { ajustarN(f); ativs(chave, el); } });
    ligarReforco(el, k => { const [i, j] = k.split(':').map(Number); return lista[i].efeitos[j]; }, () => { marcar(m, c); ativs(chave, el); });
    el.querySelectorAll('[data-tefx]').forEach(x => x.onclick = ev => { ev.preventDefault(); const [i, j] = x.dataset.tefx.split(':').map(Number); lista[i].efeitos.splice(j, 1); marcar(m, c); ativs(chave, el); });
    el.querySelectorAll('[data-tefadd]').forEach(x => x.onclick = () => { const a = lista[+x.dataset.tefadd]; (a.efeitos = a.efeitos || []).push({ tipo: 'roundDefense', n: 1 }); marcar(m, c); ativs(chave, el); });
    const mover = (i, d) => { const j = i + d; if (j < 0 || j >= lista.length) return; [lista[i], lista[j]] = [lista[j], lista[i]]; marcar(m, c); ativs(chave, el); irPara(el, j); };
    el.querySelectorAll('[data-asobe]').forEach(b => b.onclick = () => mover(+b.dataset.asobe, -1));
    el.querySelectorAll('[data-adesce]').forEach(b => b.onclick = () => mover(+b.dataset.adesce, 1));
    el.querySelectorAll('[data-arol]').forEach(b => b.onclick = () => { const a = lista[+b.dataset.arol]; if (noRol(chave, a)) return aviso(tr('Already in the roll.')); porNoRol(chave, a, m); ativs(chave, el); aviso(tr('In the roll: “Import…” brings it into any monster.')); });
    if (orig) travarOriginal(el);
    el.querySelectorAll('[data-ax]').forEach(b => b.onclick = () => { const [z] = lista.splice(+b.dataset.ax, 1); const ref = z && (z.id || z.nome); if (ref) lista.forEach(a => { if (a.next === ref) a.next = ''; }); marcar(m, c); ativs(chave, el); }); };
  ativs('ativacoes', $('#fm_ativs')); ativs('taticas', $('#fm_tats'));
  const dfs = { text: m.defesa || '', hint: '' }; const dEl = $('#fm_def');
  editorDeTexto(dEl, dfs, () => { m.defesa = dfs.text; marcar(m, c); }, { soRegras: true });
  $('#fm_defapos').onchange = e => { m.defesaApos = e.target.checked; marcar(m, c); };
  const dimp = $('#fm_defimport'); if (dimp) dimp.onclick = () => { const cp = $('#fm_defcopiaCampo'); cp.hidden = !cp.hidden; $('#fm_defimport').classList.toggle('ativo', !cp.hidden); if (!cp.hidden) $('#fm_defcopia').focus(); };
  const dcp = $('#fm_defcopia'); if (dcp) dcp.onchange = e => { const d = DEFESAS_DO_JOGO()[+e.target.value]; if (!d) return; m.defesa = d.texto; m.defesaApos = d.apos; m.defesaImportada = true;
    // the automatic part goes with the copied defense when the mod can do it; the Anger of the berserker becomes "damage +1"
    let nota = '';
    if (d.regra === 'Anger') { m.defesaModo = 'proprio'; m.defesaEfeitos = [{ tipo: 'damage', n: 1 }]; }
    else if (d.tipos.includes(m.tipo)) m.defesaModo = 'jogo';
    else { m.defesaModo = 'nenhum'; m.defesaEfeitos = []; if (d.tipos.some(t => DEFESA_AUTOMATICA[t])) nota = ' In the game part of it is automatic; add it under “My own effect” if you want the app to apply it.'; }
    marcar(m, c); renderFichas(); aviso('Defense “' + d.regra + '” copied.' + nota); };
  c.querySelectorAll('[data-dmodo]').forEach(b => b.onclick = () => { m.defesaModo = b.dataset.dmodo; if (m.defesaModo === 'proprio' && !(m.defesaEfeitos || []).length) m.defesaEfeitos = [{ tipo: 'damage', n: 1 }]; marcar(m, c); renderFichas(); });
  c.querySelectorAll('[data-ef]').forEach(s => s.onchange = () => { const f = m.defesaEfeitos[+s.dataset.i]; f[s.dataset.ef] = s.dataset.ef === 'n' ? +s.value : s.value; marcar(m, c); if (s.dataset.ef === 'tipo') { ajustarN(f); renderFichas(); } });
  c.querySelectorAll('[data-efx]').forEach(b => b.onclick = () => { m.defesaEfeitos.splice(+b.dataset.efx, 1); marcar(m, c); renderFichas(); });
  { const df = c.querySelector('#fm_defef'); if (df) ligarReforco(df, k => m.defesaEfeitos[+k.slice(2)], () => { marcar(m, c); renderFichas(); }); }
  const efa = c.querySelector('#fm_defadd'); if (efa) efa.onclick = () => { (m.defesaEfeitos = m.defesaEfeitos || []).push({ tipo: 'damage', n: 1 }); marcar(m, c); renderFichas(); };
  // (a new one goes to the end of the list, which scrolls to it, its name ready to type)
  const irPara = (el, i) => { const b = el.querySelectorAll('.ativ')[i]; if (!b) return; b.scrollIntoView({ block: 'center' }); b.classList.add('recem'); const n = b.querySelector('[data-a=nome]'); if (n) { n.focus(); n.select(); } };
  const nova = (chave, el, a) => { m[chave].push(a); marcar(m, c); ativs(chave, el); irPara(el, m[chave].length - 1); };
  const fa = $('#fm_ativ'); if (fa) fa.onclick = () => nova('ativacoes', $('#fm_ativs'), { id: 'ACT_' + uid(), nome: tr('Attack'), speed: 3, damage: 2, aim: 0, attack: 1, range: 0, healing: 0, shield: 0, initiative: 0, rangeType: 'Melee', next: '', text: '', hint: '' });
  const ft = $('#fm_tat'); if (ft) ft.onclick = () => nova('taticas', $('#fm_tats'), { id: 'TAC_' + uid(), nome: tr('Tactic'), speed: 3, damage: 2, aim: 0, attack: 1, range: 0, healing: 0, shield: 0, initiative: 0, rangeType: 'Melee', next: '', text: '', hint: '' });
  // (import: from the roll of the game's and your own; each comes as a copy of its own, at the end)
  const imp = (chave, el) => importarDoRol(chave === 'taticas' ? 'taticas' : 'ativacoes', copias => { copias.forEach(a => m[chave].push(a)); marcar(m, c); ativs(chave, el); irPara(el, m[chave].length - 1); });
  const fai = $('#fm_ativImp'); if (fai) fai.onclick = () => imp('ativacoes', $('#fm_ativs'));
  const fti = $('#fm_tatImp'); if (fti) fti.onclick = () => imp('taticas', $('#fm_tats'));
  if (orig) travarOriginal(c);
  // (the default loot, the way "Give an item" picks: the items with their pictures)
  const loot = () => { const el = $('#fm_loot'); m.loot = m.loot || [];
    el.innerHTML = `<div class="lootMonstro">${m.loot.map((id, i) => { const img = imagemDoItemEscolhido(id); return `<div class="itemEscolhido">${img ? `<img loading="lazy" decoding="async" ${imgTardia(img)} alt="">` : '<span class="vazio"></span>'}<div><b data-sem-traducao>${esc(semGlifo(nomeItem(id)))}</b>${itemDaOficina(id) ? '' : `<small class="erro">${esc(tr('not in the workshop!'))}</small>`}</div><button class="sm" data-ld="${i}" title="${esc(tr('Remove'))}">✕</button></div>`; }).join('') || `<p class="ajuda">${esc(tr('none (the app draws by value)'))}</p>`}</div>
      <button class="sm" data-lootmais>+ ${esc(tr('Item…'))}</button>${ITENS_B().length ? '' : `<p class="ajuda">${esc(tr('Only workshop items can be dropped: import or create them in the Items tab.'))}</p>`}`;
    el.querySelector('[data-lootmais]').onclick = () => abrirEscolhaDeItem(null, id => { if (!m.loot.includes(id)) m.loot.push(id); marcar(m, c); loot(); }, { soItens: true });
    el.querySelectorAll('[data-ld]').forEach(x => x.onclick = () => { m.loot.splice(+x.dataset.ld, 1); marcar(m, c); loot(); }); };
  loot();
}
/* soNomes: only the names changed (typing a name): the thumbnails are left alone */
function renderFichasLista(soNomes) { const l = $('#f_lista'); if (!l) return; const lista = abaF === 'itens' ? bestiario().itens.filter(x => tipoItem && doTipoItem(x, tipoItem)) : bestiario()[abaF]; if (!Array.isArray(lista)) return; l.querySelectorAll('.no[data-id]').forEach(d => { const x = lista.find(y => y.id === d.dataset.id); if (!x) return; d.querySelector('div > div').textContent = x.nome || '(no name)'; if (soNomes) return; const img = d.querySelector('img.face'); if (img && abaF === 'pecas' && defPeca(x.id)) img.src = miniatura(defPeca(x.id), x); if (img && abaF === 'objetos') img.src = iconeObj(x.id); const sm = d.querySelector('small'); if (sm && !x.clone && (abaF === 'pecas' || abaF === 'objetos')) sm.textContent = (x.cells || []).length + ' square(s) · ' + extensao(x.cells || [[0, 0]]).join('×'); }); }

// ------------------------------------------------------------ NPC sheet
/* v251: the picture of an NPC of one's own in the story boxes (the scenes). By default (Automatic), an NPC that is a monster or a
   hero (linked on the sheet, or found by the same name) uses that one's animated-figure picture with the legs cut off: the
   bottom part of the picture (a share of its height) leaves, and the torso stays. Or a picture of its own, or the portrait.
   The game's NPCs keep the game's picture. Exported as sceneArt + sceneCrop; the mod cuts it once and shows it in the boxes */
const CORTE_CENA = 0.45;
function figurasParaCena(b = oficina()) {
  const ms = (b.monstros || []).filter(m => m && m.arteModo === 'imagem' && m.arte).map(m => ({ chave: 'M:' + m.id, nome: m.nome || m.id, img: m.arte, tipo: 'monster' }));
  const hs = (b.herois || []).filter(h => h && h.arteModo === 'imagem' && h.arte).map(h => ({ chave: 'H:' + h.id, nome: h.nome || (typeof nomeDoHeroiJogo === 'function' ? nomeDoHeroiJogo(h.id) : h.id), img: h.arte, tipo: 'hero' }));
  return ms.concat(hs);
}
function figuraDaCena(p, b = oficina()) {
  const fs = figurasParaCena(b);
  if (p.cenaDe) return fs.find(f => f.chave === p.cenaDe) || null;
  const n = semAcento(p.nome || ''); return n ? fs.find(f => semAcento(f.nome) === n) || null : null;
}
function fonteDaCena(p, b = oficina()) {
  if (!p || p.base) return null;
  const modo = p.cenaModo || 'auto';
  if (modo === 'retrato') return null;
  if (modo === 'imagem') return p.cena ? { img: p.cena, corte: p.cenaCorte ?? 0 } : null;
  const f = figuraDaCena(p, b); return f ? { img: f.img, corte: p.cenaCorte ?? CORTE_CENA, figura: f } : null;
}
function campoDaCena(p) {
  if (p.base) return `<div class="sub">${esc(tr('Picture in the scenes'))}</div><p class="ajuda">${esc(tr('An NPC of the game: the game shows its own picture in the scenes.'))}</p>`;
  const modo = p.cenaModo || 'auto'; const fs = figurasParaCena(); const f = figuraDaCena(p); const fonte = fonteDaCena(p); const corte = Math.round(100 * (fonte ? fonte.corte : (p.cenaCorte ?? (modo === 'imagem' ? 0 : CORTE_CENA))));
  return `<div class="sub">${esc(tr('Picture in the scenes'))}</div>
    <div class="duas"><label class="campo">${esc(tr('Picture'))} <select data-cenamodo><option value="auto" ${modo === 'auto' ? 'selected' : ''}>${esc(tr('Automatic (the figure of the monster or hero)'))}</option><option value="imagem" ${modo === 'imagem' ? 'selected' : ''}>${esc(tr('A picture of its own'))}</option><option value="retrato" ${modo === 'retrato' ? 'selected' : ''}>${esc(tr('The portrait'))}</option></select></label>
    ${modo === 'auto' ? `<label class="campo">${esc(tr('Figure of'))} <select data-cenade><option value="">${esc(tr('The one with the same name') + (p.cenaDe ? '' : f ? ': ' + f.nome : ': ' + tr('none')))}</option>${fs.map(x => `<option value="${esc(x.chave)}" ${p.cenaDe === x.chave ? 'selected' : ''} data-sem-traducao>${esc(x.nome)} (${esc(tr(x.tipo === 'hero' ? 'hero' : 'monster'))})</option>`).join('')}</select></label>` : modo === 'imagem' ? `<label class="campo">&nbsp;<span class="linha"><label class="sm botaoArquivo">${esc(tr('Upload PNG/JPG'))}<input type="file" accept="image/png,image/jpeg,image/webp" data-cenaarq hidden></label></span></label>` : ''}</div>
    ${fonte ? `<label class="campo">${esc(tr('Cut from the bottom'))} <span class="linha"><input type="range" min="0" max="80" step="1" value="${corte}" data-cenacorte style="flex:1"><b data-cenapct>${corte}%</b></span></label>
      <div class="previaCena" data-previacena><img alt="" data-cenaimg></div>` : ''}
    <p class="ajuda">${esc(modo === 'auto' ? (fonte ? tr('The picture of the animated figure, with the legs cut off: only the torso shows in the scenes. Move the cut to fit it.') : tr('No monster or hero with an animated-figure picture goes by this name: the scenes show the portrait. Link one above, or pick a picture of its own.')) : modo === 'imagem' ? tr('A picture for the scenes (transparent PNG of the figure looks best); the cut takes off its bottom part.') : tr('The scenes show the portrait.'))}</p>`;
}
function ligarCena(c, p) {
  const s = c.querySelector('[data-cenamodo]'); if (!s) return;
  s.onchange = () => { p.cenaModo = s.value === 'auto' ? undefined : s.value; if (!p.cenaModo) delete p.cenaModo; delete p.cenaCorte; renderFichas(); };
  const de = c.querySelector('[data-cenade]'); if (de) de.onchange = () => { if (de.value) p.cenaDe = de.value; else delete p.cenaDe; renderFichas(); };
  const arq = c.querySelector('[data-cenaarq]'); if (arq) arq.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { p.cena = r.result; renderFichas(); }; r.readAsDataURL(f); };
  const fonte = fonteDaCena(p); const img = c.querySelector('[data-cenaimg]'), caixa = c.querySelector('[data-previacena]');
  const ajustar = () => { const corte = fonteDaCena(p)?.corte ?? 0; if (img.naturalWidth) caixa.style.aspectRatio = img.naturalWidth + ' / ' + Math.max(1, img.naturalHeight * (1 - corte)); };
  if (img && fonte) { img.onload = ajustar; img.src = fonte.img; }
  const r = c.querySelector('[data-cenacorte]'); if (r) r.oninput = () => { p.cenaCorte = +r.value / 100; c.querySelector('[data-cenapct]').textContent = r.value + '%'; if (img) ajustar(); };
}
function fichaPersonagem(c, p) {
  const herois = CAT.herois.filter(h => h._cls === 'HeroModel');
  const orig = !!p.base, mudado = orig && !!(p.nomeJogo ? p.nome !== p.nomeJogo : false);
  c.innerHTML = `<div class="cabF"><h2>${esc(p.nome)} <span class="etq ${orig ? '' : 'custom'}">${orig ? 'original of the game' : 'custom'}</span></h2><div class="botoes">${orig ? '<button class="sm primario" id="fp_dup">⧉ Duplicate</button>' : ''}${mudado ? '<button class="sm" id="fp_volta">↺ Back to the game’s</button>' : ''}<button class="sm perigo" id="fp_apaga">Delete</button></div></div>
    ${orig ? avisoOficial('', 'The portrait and your notes may change here.') : ''}<div class="folha"><div class="col">
    ${retratoCampo(p, 'Portrait in the story boxes (speaker and cast). Transparent PNG of the bust, 512 px or more, looks best.')}
    <label class="campo">Name <input data-c="nome" value="${esc(p.nome)}"></label>
    ${ehHeroiDaCaixa(p.base) ? '<p class="ajuda">A hero of the box used as an NPC: it only speaks in dialogues. To change the playable hero, use the Heroes tab.</p>' : ''}
    <label class="campo">Notes (for you, not shown in the app) <textarea data-c="desc" rows="3">${esc(p.desc || '')}</textarea></label>
    </div><div class="col">${campoDaCena(p)}</div></div>`;
  ligarRetrato(c, p, 512); ligarEspelhos(c, p); ligarCena(c, p);
  liga(c, p, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = p.nome + ' '; renderFichasLista(true); } });
  $('#fp_apaga').onclick = () => apagarFicha(p);
  if (!orig) return;
  travarOficial(c, '.retrato, [data-c=desc]');
  $('#fp_dup').onclick = () => { const nome = nomeDaCopia(p.nome, PERSONAGENS_B().map(z => z.nome)); if (!nome) return;
    const d = clone(p); d.id = 'B_' + uid(); d.nome = nome; d.custom = true; d.base = null; delete d.nomeJogo;
    PERSONAGENS_B().push(d); fichaSel = d.id; renderFichas(); aviso(tr('Duplicated: this one is yours to change.')); };
  const vj = $('#fp_volta'); if (vj) vj.onclick = () => { p.nome = p.nomeJogo; renderFichas(); };
}

// ------------------------------------------------------------ item sheet
function fichaItem(c, i) {
  const mat = i.cls === 'CraftingMaterialModel';
  const bases = CAT.itens.filter(z => z._cls === (i.cls === 'TableItem' ? 'TrinketModel' : i.cls) && z.name_en && z.name_en !== 'Text');
  const receitas = (oficina().receitas || []).filter(r => r.item === i.id);
  const orig = !!i.base, mudado = orig && itemMudou(i);
  c.innerHTML = `<div class="cabF"><h2>${esc(i.nome)} <span class="etq ${orig ? '' : 'custom'}">${orig ? (mudado ? 'original of the game, changed' : 'original of the game') : 'custom'}</span></h2><div class="botoes">${orig ? '<button class="sm primario" id="fi_dup">⧉ Duplicate</button>' : ''}${mudado ? '<button class="sm" id="fi_volta">↺ Back to the game’s</button>' : ''}<button class="sm perigo" id="fi_apaga">Delete</button></div></div>
    ${orig ? avisoOficial(mudado ? 'This original was changed by an older version of the editor: “↺ Back to the game’s” undoes it.' : '', 'The picture may change here.') : ''}<div class="folha"><div class="col">
    ${retratoCampo(i, mat ? 'The material’s picture in the app. Square, 256 px or more.' : 'Card art shown in the app. Square, 256 px or more.')}
    <label class="campo">Name <input data-c="nome" value="${esc(i.nome)}"></label>
    <div data-descricao></div>
    ${mat ? `<div class="duas"><label class="campo">Kind <select data-c="tipoMaterial"><option value="0" ${!+i.tipoMaterial ? 'selected' : ''}>Base material (common: leather, metal…)</option><option value="1" ${+i.tipoMaterial === 1 ? 'selected' : ''}>Essence (uncommon: Ignos, Lumos…)</option></select></label>
      <label class="campo">Value (loot points) <input type="number" min="1" data-c="valor" value="${i.valor || 5}"></label></div>
      <p class="ajuda">Random loot is paid in materials up to its points: the value is what one unit is worth. Recipes list how many units they cost.</p>`
    : `<div class="duas"><label class="campo">Kind <input value="${esc(tr(TIPOS_ITEM.find(t => doTipoItem(i, t[0]))?.[1] || i.cls))}${i.cls === 'TableItem' ? ' (table-only card)' : ''}" disabled></label><label class="campo">Rarity <select data-c="raridade">${RARIDADES.map((r, k) => k ? `<option value="${k}" ${i.raridade === k ? 'selected' : ''}>${r}</option>` : '').join('')}</select></label></div>
    <div class="duas"><label class="campo">Value (gold) <input type="number" min="0" data-c="valor" value="${i.valor || 0}"></label>${i.cls === 'ConsumableModel' ? `<label class="chk"><input type="checkbox" data-c="unico" ${i.unico ? 'checked' : ''}> Unique (one per party)</label>` : ''}</div>
    ${i.cls === 'ArmorModel' || i.cls === 'ConsumableModel' ? `<p class="ajuda">${i.cls === 'ArmorModel' ? 'Armor' : 'A consumable'} is played at the table: the app keeps it in the inventory and shows its card, with your name, text and art.</p>` : i.cls !== 'TableItem' ? `<label class="campo">Effect of (game item of the same kind) <select data-c="efeitoBase"><option value="">— none: played at the table —</option>${bases.map(b => `<option value="${esc(b._id)}" ${(i.efeitoBase || (i.custom ? '' : i.base)) === b._id ? 'selected' : ''}>${esc(b.name_en)}</option>`).join('')}</select><small class="ajuda">The app applies the effect of this game item; the card shows your name, text and art.</small></label>` : '<p class="ajuda">A card the app shows and hands to the party; its effect is applied at the table.</p>'}`}
    ${i.cls === 'TrinketModel' && !orig ? `<div class="sub">Triggers</div><p class="ajuda">What makes this trinket go off while a hero has it equipped, the chance of it, and what the app does then. The text goes on screen when it goes off, for what the table applies (health, fatigue…).</p><div id="fi_disparos"></div>` : ''}
    ${mat ? `<div class="sub">${esc(tr('Recipes that cost it'))}</div><div id="fi_usam"></div>` : `<div class="sub">${esc(tr('Recipe'))}</div><div id="fi_receitas"></div>`}
    </div></div>`;
  ligarRetrato(c, i, 256); ligarEspelhos(c, i);
  const fd = c.querySelector('#fi_disparos'); if (fd) pintarDisparos(fd, i, () => marcar(i, c));
  editorDeDescricao(c.querySelector('[data-descricao]'), i, 'desc', mat ? 'Description' : 'Description (the card text)', () => marcar(i, c));
  liga(c, i, k => { if (k === 'nome') { c.querySelector('h2').firstChild.textContent = i.nome + ' '; renderFichasLista(true); } if (k === 'raridade') i.raridade = +i.raridade; if (k === 'tipoMaterial') i.tipoMaterial = +i.tipoMaterial; });
  ligaChks(c, i);
  const fr = c.querySelector('#fi_receitas'); if (fr) { const refazer = () => { editorDeReceitas(fr, i, refazer); renderFichasLista(); }; editorDeReceitas(fr, i, refazer); }
  const fu = c.querySelector('#fi_usam'); if (fu) { const usam = (oficina().receitas || []).filter(r => (r.custos || []).some(x => x.mat === i.id || (i.base && x.mat === i.base)));
    // (v248: a receita é parte da coisa que ela cria: cada uma aparece com o ícone e o nome da coisa, e quanto deste material gasta;
    // o clique abre a ficha da coisa, também a da versão + pelo item dela)
    const doMat = r => (r.custos || []).filter(x => x.mat === i.id || (i.base && x.mat === i.base)).reduce((s, x) => s + (+x.qtd || 0), 0);
    fu.innerHTML = usam.length ? usam.map((r, k) => { const a = itemAlvo(r.item);
      return `<a href="#" class="tag receitaUsa" data-usa="${k}" title="${esc((a?.nome || '?') + ' ← ' + custoResumo(r))}">${a?.img ? `<img class="icoPeca" loading="lazy" decoding="async" ${imgTardia(a.img)} alt="">` : '<span class="icoPeca"></span>'}<span>${esc(a?.nome || '?')}</span> <small>× ${doMat(r)}</small></a>`; }).join(' ') : `<p class="ajuda">${esc(tr('No recipe costs it yet: the recipes are made in the sheet of the item they craft.'))}</p>`;
    fu.querySelectorAll('[data-usa]').forEach(a => a.onclick = ev => { ev.preventDefault(); const r = usam[+a.dataset.usa]; const ids = [r.item, semMais(r.item)]; const x = ITENS_B().find(z => ids.some(id => z.id === id || (z.base && z.base === id))); if (!x) return aviso(tr('The item of this recipe is not in the Workshop.')); abrirFichas('itens', x.id); }); }
  $('#fi_apaga').onclick = () => apagarFicha(i);
  if (!orig) return;
  travarOficial(c, '.retrato, #fi_receitas');
  $('#fi_dup').onclick = () => { const nome = nomeDaCopia(i.nome, ITENS_B().map(z => z.nome)); if (!nome) return;
    const d = clone(i); d.id = 'B_' + uid(); d.nome = nome; d.custom = true; d.efeitoBase = i.efeitoBase || i.base; d.base = null; delete d.nomeJogo;
    ITENS_B().push(d); fichaSel = d.id; renderFichas(); aviso(tr('Duplicated: this one is yours to change.')); };
  const vj = $('#fi_volta'); if (vj) vj.onclick = () => { voltarItemAoJogo(i); renderFichas(); };
}
/* ------------------------------------------------------------ the triggers of a trinket (like the tactics of a monster)
   i.disparos = [{ id, quando, chance (1-100), texto, efeitos: [{ tipo, n, cond, modo, item }] }]. The cause says when it may
   go off (with the trinket equipped); each time, the chance is drawn; the effects are applied by the app; the text goes on
   screen for the table. Effects on the enemy need a cause with an enemy in it (the attacked one, or the one that targets). */
const QUANDO_APETRECHO = [['ataque', 'When the hero attacks (any attack, with damage or not)'], ['dano', 'When the hero’s attack beats the enemy’s armor'], ['derrota', 'When the hero defeats an enemy'], ['interacao', 'When the hero finishes an interaction'], ['alvejado', 'When an enemy targets the hero (activates against them)'], ['tempo', 'When time passes (end of the round)'], ['ferido', 'When the hero is injured']];
const COM_ALVO = ['ataque', 'dano', 'alvejado'];
const EFEITOS_APETRECHO = [['damage', 'Damage +N on this attack (added to the weapon’s damage)', q => q === 'ataque'], ['condition', 'A condition on the enemy', q => COM_ALVO.includes(q)], ['defense', 'Enemy defense −N until the end of the round', q => COM_ALVO.includes(q)], ['speed', 'Enemy movement −N on its next activation', q => COM_ALVO.includes(q)],
  ['spawn', 'Reinforcement: N enemies enter', () => true], ['action', 'The hero gains an additional action', () => true], ['loot', 'Loot for the party', () => true], ['table', 'Applied at the table (a text on screen)', () => true]];
const CONDICOES_INIMIGO = [['random', 'At random'], ['dazed', 'Dazed'], ['enfeebled', 'Enfeebled'], ['afflicted', 'Afflicted'], ['slowed', 'Slowed'], ['exposed', 'Exposed'], ['doomed', 'Doomed'], ['confused', 'Confused']];
const MODOS_LOOT = [['random', 'Random items'], ['gold', 'Gold'], ['material', 'Materials'], ['item', 'A specific item']];
const CHANCES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
const efeitoCabe = (f, q) => { const e = EFEITOS_APETRECHO.find(x => x[0] === f.tipo); return !!e && e[2](q); };
const MODOS_REFORCO_AP = q => COM_ALVO.includes(q) ? [['igual', 'The same as the enemy of the trigger'], ['tipo', 'One of the same type'], ['reserva', 'One of the map’s pool'], ['outro', 'Another…']] : [['reserva', 'One of the map’s pool'], ['outro', 'Another…']];
function valoresDoDisparo(f) { if (f.tipo === 'spawn') return [1, 2, 3]; if (f.tipo === 'loot') return f.modo === 'gold' ? [5, 10, 15, 20, 25, 50, 75, 100] : f.modo === 'random' ? [1, 2, 3] : f.modo === 'item' ? [1, 2, 3] : [1, 2, 3, 4, 5]; return [1, 2, 3, 4, 5]; }
function ajustarDisparo(f, q) { if (f.tipo !== 'table') delete f.texto; else if (f.texto == null) f.texto = '';
  if (f.tipo !== 'spawn') { if (f.tipo !== 'loot') delete f.modo; delete f.monstro; } else { const ms = MODOS_REFORCO_AP(q).map(m => m[0]); if (!ms.includes(f.modo)) f.modo = ms[0]; if (f.modo !== 'outro') delete f.monstro; }
  if (f.tipo === 'action' || f.tipo === 'table') { delete f.n; return; } if (f.tipo === 'spawn') { const l = valoresDoDisparo(f); if (!l.includes(f.n)) f.n = 1; return; }
  if (f.tipo !== 'condition') delete f.cond; else if (!f.cond) f.cond = 'random'; if (f.tipo !== 'loot') { delete f.modo; delete f.item; } else if (!MODOS_LOOT.some(m => m[0] === f.modo)) f.modo = 'random'; if (f.modo !== 'item') delete f.item; const l = valoresDoDisparo(f); if (!l.includes(f.n)) f.n = l[0]; }
function pintarDisparos(el, i, mudou) {
  const lista = i.disparos = Array.isArray(i.disparos) ? i.disparos : [];
  // (v231: the text of a trigger is an effect, "applied at the table")
  lista.forEach(d => { if (d.texto) { (d.efeitos = d.efeitos || []).push({ tipo: 'table', texto: d.texto }); } delete d.texto; });
  const itens = ITENS_B().filter(x => x.cls !== 'WeaponPartsModel' && x.id !== i.id);
  const opc = (l, v) => l.map(([k, n]) => `<option value="${esc(String(k))}" ${String(v) === String(k) ? 'selected' : ''}>${esc(tr(n))}</option>`).join('');
  const efeito = (d, di, f, fi) => `<span class="tag efeitoDisp"><select data-df="tipo" data-d="${di}" data-f="${fi}">${opc(EFEITOS_APETRECHO.filter(e => e[2](d.quando) || e[0] === f.tipo).map(e => [e[0], e[1]]), f.tipo)}</select>`
    + (f.tipo === 'condition' ? ` <select data-df="cond" data-d="${di}" data-f="${fi}">${opc(CONDICOES_INIMIGO, f.cond)}</select>` : '')
    + (f.tipo === 'loot' ? ` <select data-df="modo" data-d="${di}" data-f="${fi}">${opc(MODOS_LOOT, f.modo)}</select>` : '')
    + (f.tipo === 'loot' && f.modo === 'item' ? ` <select data-df="item" data-d="${di}" data-f="${fi}"><option value="">${esc(tr('Pick the item…'))}</option>${itens.map(x => `<option value="${esc(x.id)}" ${f.item === x.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>` : '')
    + (f.tipo === 'spawn' ? ` <select data-df="modo" data-d="${di}" data-f="${fi}">${opc(MODOS_REFORCO_AP(d.quando), f.modo)}</select>` + (f.modo === 'outro' ? ` <button class="sm escolhaReforco" data-dfm="${di}:${fi}">${(() => { const m = f.monstro ? monstro(f.monstro) : null; const r = m ? retratoDoMonstro(m) : ''; return (r ? `<img loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '') + esc(m ? m.nome : tr('Pick the monster')); })()}</button>` : '') : '')
    + (f.tipo === 'table' ? ` <textarea rows="2" class="textoMesa" data-dft="${di}:${fi}" placeholder="${esc(tr('e.g. The hero recovers 1 health.'))}">${esc(f.texto || '')}</textarea>` : '')
    + (!['condition', 'action', 'table'].includes(f.tipo) ? ` N <select data-df="n" data-d="${di}" data-f="${fi}">${valoresDoDisparo(f).map(v => `<option value="${v}" ${f.n === v ? 'selected' : ''}>${v}</option>`).join('')}</select>` : '')
    + (efeitoCabe(f, d.quando) ? '' : ` <small class="aviso">${esc(tr('not with this cause'))}</small>`)
    + ` <a href="#" data-dfx="${di}:${fi}" title="${esc(tr('Remove'))}">✕</a></span>`;
  el.innerHTML = lista.map((d, di) => `<div class="ativ disparo"><div class="cabAtiv"><span class="numAtiv">${esc(tr('Trigger'))} ${di + 1}</span>
      <select data-d="${di}" data-dc="quando">${opc(QUANDO_APETRECHO, d.quando)}</select>
      <label class="chance">${esc(tr('Chance'))} <select data-d="${di}" data-dc="chance">${CHANCES.map(v => `<option value="${v}" ${d.chance === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></label>
      <button class="sm" data-dx="${di}" title="${esc(tr('Delete this trigger'))}">✕</button></div>
    <div class="efeitosTat"><small>${esc(tr('The app applies:'))}</small> ${(d.efeitos || []).map((f, fi) => efeito(d, di, f, fi)).join('')} <button class="sm" data-dfadd="${di}">+ ${esc(tr('effect'))}</button></div>
    </div>`).join('')
    + `<button class="sm" id="fi_dispadd">+ ${esc(tr('Trigger'))}</button>`;
  const de = (d, f) => lista[+d].efeitos[+f];
  const re = () => { mudou(); pintarDisparos(el, i, mudou); };
  el.querySelector('#fi_dispadd').onclick = () => { lista.push({ id: 'DSP_' + uid(), quando: 'ataque', chance: 25, texto: '', efeitos: [] }); re(); };
  el.querySelectorAll('[data-dx]').forEach(b => b.onclick = () => { lista.splice(+b.dataset.dx, 1); re(); });
  el.querySelectorAll('[data-dc]').forEach(x => x.onchange = () => { const d = lista[+x.dataset.d]; const k = x.dataset.dc;
    if (k === 'chance') d.chance = +x.value; else if (k === 'texto') { d.texto = x.value; mudou(); return; }
    else { d.quando = x.value; const antes = (d.efeitos || []).length; d.efeitos = (d.efeitos || []).filter(f => efeitoCabe(f, d.quando)); d.efeitos.forEach(f => ajustarDisparo(f, d.quando)); if (d.efeitos.length < antes) aviso(tr('Effects that need an enemy, or an attack, left with the change of cause.')); }
    re(); });
  el.querySelectorAll('[data-dft]').forEach(x => x.oninput = () => { const [d, f] = x.dataset.dft.split(':'); de(d, f).texto = x.value; mudou(); });
  el.querySelectorAll('[data-dfm]').forEach(b => b.onclick = () => { const [d, f] = b.dataset.dfm.split(':'); escolherMonstroDoReforco(de(d, f), re); });
  el.querySelectorAll('[data-dfadd]').forEach(b => b.onclick = () => { const d = lista[+b.dataset.dfadd]; const t = (EFEITOS_APETRECHO.find(e => e[2](d.quando)) || EFEITOS_APETRECHO[4])[0]; const f = { tipo: t, n: 1 }; ajustarDisparo(f, d.quando); (d.efeitos = d.efeitos || []).push(f); re(); });
  el.querySelectorAll('[data-df]').forEach(x => x.onchange = () => { const f = de(x.dataset.d, x.dataset.f); const k = x.dataset.df;
    const q = lista[+x.dataset.d].quando;
    if (k === 'n') f.n = +x.value; else if (k === 'tipo') { f.tipo = x.value; ajustarDisparo(f, q); } else if (k === 'modo') { f.modo = x.value; ajustarDisparo(f, q); if (f.tipo === 'spawn' && f.modo === 'outro' && !f.monstro) return escolherMonstroDoReforco(f, re); } else f[k] = x.value;
    re(); });
  el.querySelectorAll('[data-dfx]').forEach(a => a.onclick = ev => { ev.preventDefault(); const [d, f] = a.dataset.dfx.split(':').map(Number); lista[d].efeitos.splice(f, 1); re(); });
}
/* an original item against the game's: what plays (not the picture) */
const CAMPOS_ITEM_JOGO = ['nome', 'desc', 'raridade', 'valor', 'tipoMaterial', 'classe', 'slot', 'traits', 'dano', 'habilidade', 'unico'];
function itemMudou(i) { const c = (CAT.itens || []).find(z => z._id === i.base); if (!c) return false; const f = itemDoCatalogo(c);
  return !!i.efeitoBase || CAMPOS_ITEM_JOGO.some(k => JSON.stringify(i[k] ?? null) !== JSON.stringify(f[k] ?? null) && !(k === 'nome' && i.nome === i.nomeJogo)); }
function voltarItemAoJogo(i) { const c = (CAT.itens || []).find(z => z._id === i.base); if (!c) return; const f = itemDoCatalogo(c);
  CAMPOS_ITEM_JOGO.forEach(k => { if (k in f) i[k] = clone(f[k]); else delete i[k]; }); i.nomeJogo = f.nomeJogo; delete i.efeitoBase; }

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
    <label class="campo">How many of this piece you have <input type="number" min="1" max="99" id="fv_copias" value="${Math.max(1, +v.copias || 1)}" style="width:70px"></label>
    ${v.underlay ? `<p class="ajuda">An underlay lies on the floor under the tiles (level 0), like water or spikes: the tiles go on top of it. It is not bound to one room, and the map may use it as many times as you have copies.</p>` : ''}
    <div class="sub">Shape</div><div id="fv_forma"></div>
    <div class="sub">Surface</div>
    <div class="botoes">${MODOS_TEXTURA.map(([k, n]) => `<button class="sm ${modo === k ? 'ativo' : ''}" data-tm="${k}">${n}</button>`).join('')}</div>
    ${modo === 'cor' ? '<p class="ajuda">The tile has a generic stone grain; the colour goes over it.</p><div id="fv_cores"></div>'
      : modo === 'inteira' ? `<div class="retrato" style="margin-top:6px"><div class="quadro">${v.texInteira ? `<img loading="lazy" decoding="async" ${imgTardia(v.texInteira)} alt="">` : '<span>no picture</span>'}</div><div><label class="sm botaoArquivo">${v.texInteira ? 'Replace the picture…' : 'Upload the picture (PNG, JPG)…'}<input type="file" accept="image/png,image/jpeg,image/webp" data-texint hidden></label>${v.texInteira ? '<button class="sm" data-texintx>✕</button>' : ''}<p class="ajuda">Stretched over the ${w}×${h} rectangle around the shape; squares outside the shape are cut away. Best as a ${w}:${h} picture (a scan or a photo of your tile, seen from above). It turns with the tile.</p></div></div>`
      : `<div class="retrato" style="margin-top:6px"><div class="quadro">${v.texRepetida ? `<img loading="lazy" decoding="async" ${imgTardia(v.texRepetida)} alt="">` : '<span>no picture</span>'}</div><div><label class="sm botaoArquivo">${v.texRepetida ? 'Replace the picture…' : 'Upload the picture (PNG, JPG)…'}<input type="file" accept="image/png,image/jpeg,image/webp" data-texrep hidden></label>${v.texRepetida ? '<button class="sm" data-texrepx>✕</button>' : ''}<p class="ajuda">One square of floor (a square picture fits best), repeated on each of the ${(v.cells || []).length} squares, like the game tiles. It turns with the tile.</p></div></div>`}
    <label class="campo">Notes (for you) <textarea data-c="notas" rows="3">${esc(v.notas || '')}</textarea></label>
    </div><div class="col">
    <div class="sub">Preview</div><div class="previa"><img id="fv_prev" loading="lazy" decoding="async" ${imgTardia(miniatura(t, v))} alt=""></div>
    <p class="ajuda">${v.underlay ? 'A workshop underlay is your own board piece: in the app the mod lays it under the tiles, with your picture or colour.' : 'A workshop tile is your own physical piece: the map uses it as many times as you have it (in a room, or in rooms on the table together), like the tiles of the boxes; it takes pillars in its sockets (between two squares on a straight edge) when elevated. In the app the mod builds it as a flat tile of this shape, with your picture or colour, and the heroes walk on it like on any tile.'}</p>
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
  // (v241: how many of the piece the user has, for every workshop tile: the editor counts them as the tiles of the boxes)
  const cp = c.querySelector('#fv_copias'); if (cp) cp.onchange = e => { v.copias = Math.max(1, Math.min(99, Math.round(+e.target.value) || 1)); e.target.value = v.copias;
    try { const t = terrenoProprio(); if (t && t['peca:' + v.id] !== undefined) { delete t['peca:' + v.id]; localStorage.setItem('bigorna-terreno', JSON.stringify(t)); } } catch { }
    renderFichasLista(); if (typeof renderPaleta === 'function') renderPaleta(); };
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
    <div class="linha" style="margin-top:6px"><label class="sm botaoArquivo">${m.modeloTex ? 'Replace the texture…' : 'Upload the texture (PNG, JPG)…'}<input type="file" accept="image/png,image/jpeg,image/webp" data-objtex hidden></label>${m.modeloTex ? `<img loading="lazy" decoding="async" ${imgTardia(m.modeloTex)} alt="" style="width:40px;height:40px;object-fit:cover;border-radius:4px"><button class="sm" data-objtexx>✕</button>` : '<span class="ajuda">none: a grey unpainted miniature</span>'}</div>
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
  let ultimo = 0;
  const quadro = t => {
    if (!cv.isConnected) return;
    // (v237: 20 pictures a second, and none while the page is hidden or the preview is out of sight)
    if (t - ultimo < 50 || document.hidden || !cv.offsetParent) { estado.raf = requestAnimationFrame(quadro); return; } ultimo = t;
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
/* the tactics made in the Workshop (not the game's): the app picks among them itself, each one only "when" its condition holds */
const taticaPropria = a => !!a && /^(TAC|ACT)_/.test(a.id || '');
const QUANDO_TATICA = [['sempre', 'Any time'], ['ferido', 'When below half health'], ['ileso', 'When unhurt'], ['atingido', 'When hurt since its last tactic'], ['sozinho', 'When it is the last enemy'], ['bando', 'When two or more other enemies are in play']];
const EFEITOS_DEFESA = [['damage', 'Damage +N, permanently'], ['nextDamage', 'Damage +N on its next activation'], ['nextSpeed', 'Movement +N on its next activation'], ['defense', 'Defense +N, permanently'], ['roundDefense', 'Defense +N until the end of the round'], ['heal', 'Recovers N health'], ['healPct', 'Recovers N% of its health'], ['spawn', 'Reinforcement: N monsters enter']];
/* the values of N for an effect: a share of the health (it follows the tier), or a few points */
const valoresDoEfeito = t => t === 'healPct' ? [10, 20, 25, 30, 40, 50, 75, 100] : t === 'spawn' ? [1, 2, 3] : [1, 2, 3, 4, 5];
/* the reinforcement (effect "spawn"): which monster enters next to this one, N of them, at its tier: the same one, one of the
   same type (from the map's pool or its monsters), or one picked here */
const MODOS_REFORCO = [['igual', 'The same monster'], ['tipo', 'One of the same type'], ['outro', 'Another…']];
function camposDoReforco(f, chave) {
  if (f.tipo !== 'spawn') return '';
  const m = f.modo === 'outro' && f.monstro ? monstro(f.monstro) : null; const r = m ? retratoDoMonstro(m) : '';
  return ` <select data-spm="${chave}">${MODOS_REFORCO.map(([k, n]) => `<option value="${k}" ${(f.modo || 'igual') === k ? 'selected' : ''}>${esc(tr(n))}</option>`).join('')}</select>`
    + (f.modo === 'outro' ? ` <button class="sm escolhaReforco" data-spx="${chave}" title="${esc(tr('Pick the monster'))}">${r ? `<img loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : ''}${esc(m ? m.nome : tr('Pick the monster'))}</button>` : '');
}
/* the monster of a reinforcement, from the Workshop's, by their pictures */
function escolherMonstroDoReforco(f, depois) {
  const ms = MONSTROS(); if (!ms.length) return aviso(tr('The Workshop has no monster yet: import one in the Monsters tab.'));
  modal(tr('Which monster enters'), `<div class="grade escolhaItem">${ms.map(m => { const r = retratoDoMonstro(m); return `<div class="item ${f.monstro === m.id ? 'marcado' : ''}" data-rm="${esc(m.id)}">${r ? `<img loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="vazio"></span>'}<div>${esc(m.nome || m.id)}<small>${esc(m.tipo || '')}</small></div></div>`; }).join('')}</div>`, (el, fechar) => {
    el.querySelectorAll('[data-rm]').forEach(d => d.onclick = () => { f.monstro = d.dataset.rm; fechar(); depois(); });
  }, true);
}
/* the links of the reinforcement fields in a block of effects; achar(chave) gives the effect */
function ligarReforco(el, achar, depois) {
  el.querySelectorAll('[data-spm]').forEach(s => s.onchange = () => { const f = achar(s.dataset.spm); f.modo = s.value; if (f.modo !== 'outro') delete f.monstro; if (f.modo === 'outro' && !f.monstro) escolherMonstroDoReforco(f, depois); else depois(); });
  el.querySelectorAll('[data-spx]').forEach(b => b.onclick = () => escolherMonstroDoReforco(achar(b.dataset.spx), depois));
}
const opcoesDoN = f => { const l = valoresDoEfeito(f.tipo); return l.map(v => `<option value="${v}" ${f.n === v ? 'selected' : ''}>${v}${f.tipo === 'healPct' ? '%' : ''}</option>`).join(''); };
/* a change of kind: N goes to the nearest value the new kind takes */
function ajustarN(f) { if (f.tipo === 'spawn' && !f.modo) f.modo = 'igual'; if (f.tipo !== 'spawn') { delete f.modo; delete f.monstro; } const l = valoresDoEfeito(f.tipo); if (!l.includes(f.n)) f.n = f.tipo === 'healPct' ? 25 : Math.max(1, Math.min(5, Math.round(f.n / 20) || 1)); }
/* the defenses of the game's monsters (one entry per distinct text), for copying into another monster */
let _defesas = null;
/* ------------------------------------------------------------ the roll of activations and tactics
   The game's (every monster's activations and tactics) and the ones of your own added to it ("+ Add to the roll"), kept in
   this editor (the browser), for any map or campaign. Importing brings a copy into the monster. */
const CHAVE_ROL = 'bigorna-rol-ativacoes';
/* the name of an activation as the editor shows it. The game's own carry an internal English name ("Bandit Multi Shot"),
   never shown in the game; in Portuguese the editor shows the bold title of its text instead, when it has one ("Virote
   Bem Mirado"), or "Ataque básico" for the basic ones. Typing a name keeps what was typed. */
function nomeAtivacao(a) {
  const n = (a && a.nome) || '';
  if (IDIOMA !== 'pt' || !/^[A-Z][A-Za-z]*( [A-Z0-9][A-Za-z0-9]*)+$/.test(n)) return n;
  const m = (a.text || '').match(/^\s*<b>([^<]+?):?\s*<\/b>/); if (m) return m[1].trim();
  const b = n.match(/\b(?:Basic|Default)(?: (\d))?$/); if (b) return 'Ataque básico' + (b[1] ? ' ' + b[1] : '');
  return n;
}
function rolProprio() { try { const r = JSON.parse(localStorage.getItem(CHAVE_ROL) || '{}'); return { ativacoes: Array.isArray(r.ativacoes) ? r.ativacoes : [], taticas: Array.isArray(r.taticas) ? r.taticas : [] }; } catch { return { ativacoes: [], taticas: [] }; } }
function guardarRol(r) { try { localStorage.setItem(CHAVE_ROL, JSON.stringify(r)); } catch { aviso(tr('The browser did not keep the roll (storage full or blocked).')); } }
const noRol = (chave, a) => !!(a && a.rolId && rolProprio()[chave === 'taticas' ? 'taticas' : 'ativacoes'].some(x => x.rolId === a.rolId));
function porNoRol(chave, a, m) { const r = rolProprio(); const k = chave === 'taticas' ? 'taticas' : 'ativacoes'; a.rolId = a.rolId || 'ROL_' + uid(); const copia = clone(a); copia._de = m ? m.nome : ''; copia.next = ''; r[k] = r[k].filter(x => x.rolId !== a.rolId).concat([copia]); guardarRol(r); }
let _rolJogo = null;
function rolDoJogo() {
  if (_rolJogo) return _rolJogo; const r = { ativacoes: new Map(), taticas: new Map() };
  CAT.monstros.forEach(z => { if (!monstroDeEscolha(z) || !z.name_en || /^ENEMY_/.test(z.name_en)) return;
    [['ativacoes', z.Activations], ['taticas', z.ManualActivations]].forEach(([k, refs]) => (refs || []).forEach(ref => { const a = ativacaoDoCatalogo(ref); if (!a) return; const e = r[k].get(a.id) || { a, de: [] }; if (!e.de.includes(z.name_en)) e.de.push(z.name_en); r[k].set(a.id, e); })); });
  _rolJogo = { ativacoes: [...r.ativacoes.values()], taticas: [...r.taticas.values()] }; return _rolJogo;
}
const textoCurto = a => { const v = a.vagas || vagasDe(a.text || '', ['monster', 'hero']); const t = paraAmigavel(a.text || '', v); return (t.regras || t.narr).replace(/\*\*?/g, '').slice(0, 120); };
function importarDoRol(k, aoImportar) {
  const meus = rolProprio()[k].map(a => ({ a, meu: true, nome: (nomeAtivacao(a) || '?') + ' · ' + tr('yours') + (a._de ? ' (' + a._de + ')' : ''), sub: textoCurto(a) }));
  const jogo = rolDoJogo()[k].map(({ a, de }) => ({ a, meu: false, nome: (nomeAtivacao(a) || '?') + ' · ' + de.slice(0, 2).join(', ') + (de.length > 2 ? '…' : ''), sub: textoCurto(a) }));
  modalImportacao(tr(k === 'taticas' ? 'Import tactics' : 'Import activations'), [...meus, ...jogo].map(e => ({ ...e, img: '', ja: false })), escolhidas => {
    aoImportar(escolhidas.map(({ a }) => { const x = clone(a); x.id = (k === 'taticas' ? 'TAC_' : 'ACT_') + uid(); x.next = ''; delete x._de; return x; }));
  }, [{ nome: 'From', opcoes: [['meu', 'Yours (the roll)'], ['jogo', 'The game']], de: e => e.meu ? 'meu' : 'jogo' }]);
}
/* an original of the game: what stays as in the game can be seen, not changed */
/* ------------------------------------------------------------ originals of the game: only read
   An original of the game (item, hero, skill, feat, recipe, NPC; monsters and weapon parts have their own) is what the
   party of a saved game carries in "Continue heroes": it must play as in the game. Its sheet only reads; "⧉ Duplicate"
   makes a copy with another name, all of it to change. `livres`: what does not change how it plays and stays open
   (pictures, notes, what the map does with it). An original changed by an older version shows "↺ Back to the game's". */
function travarOficial(c, livres) {
  const ok = x => !!(livres && x.closest(livres));
  c.querySelectorAll('.folha input, .folha select, .folha textarea').forEach(x => { if (!ok(x)) { x.disabled = true; x.dataset.travado = '1'; } });
  c.querySelectorAll('.folha [contenteditable="true"]').forEach(x => { if (!ok(x)) { x.setAttribute('contenteditable', 'false'); x.dataset.travado = '1'; } });
  c.querySelectorAll('.folha button, .folha .botaoArquivo, .folha .barraTx').forEach(x => { if (!ok(x)) x.style.display = 'none'; });
  const f = c.querySelector('.folha'); if (f) f.classList.add('oficialTravado');
}
/* a click on a field of an original of the game that does not change (it is greyed and takes no clicks: the click falls to
   what is under it): a word on how to change it, a copy */
const TRAVADO_SEL = '[data-travado]';
document.addEventListener('pointerdown', e => {
  const caixa = e.target && e.target.closest && e.target.closest('.oficialTravado, .comTravados'); if (!caixa) return;
  if (e.target.closest(TRAVADO_SEL) || [...caixa.querySelectorAll(TRAVADO_SEL)].some(x => { if (!x.getClientRects().length) return false; const r = x.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }))
    aviso(tr('An original of the game does not change here: “Duplicate” it (with another name) and change the copy.'));
}, true);
const avisoOficial = (oque, livre) => `<p class="ajuda aviso">${esc(tr(oque))} ${esc(tr('An original of the game stays as in the game (a party that continues from a saved game carries it). Duplicate it, with another name, to make one of your own from it.'))}${livre ? ' ' + esc(tr(livre)) : ''}</p>`;
/* the name of a copy: asked, different from every name in `nomes` */
function nomeDaCopia(nome, nomes, pergunta) {
  const usados = new Set(nomes.map(n => (n || '').trim().toLowerCase()));
  const n = (prompt(tr(pergunta || 'Name of the copy (different from the original’s):'), nome + ' ' + tr('(copy)')) || '').trim(); if (!n) return null;
  if (usados.has(n.toLowerCase())) { aviso(tr('That name is already taken. Pick another.')); return null; }
  return n;
}

function travarOriginal(el) {
  const sel = '[data-c=nome], [data-c=plural], [data-c=size], [data-c=comportamento], [data-c=named], [data-c=villain], #fm_tier, #fm_tiers *, .wr *, [data-chk], #fm_ativs *, #fm_tats *, #fm_def *, #fm_defapos, [data-dmodo], #fm_defef *, #fm_defadd, [data-descricao] *';
  [el, ...el.querySelectorAll('*')].forEach(x => { if (!x.matches || !x.matches(sel)) return; let t = /^(INPUT|SELECT|TEXTAREA)$/.test(x.tagName); if ('disabled' in x) x.disabled = true; if (x.isContentEditable || x.getAttribute('contenteditable') === 'true') { x.setAttribute('contenteditable', 'false'); t = true; } if (t) x.dataset.travado = '1'; });
  el.classList.add('comTravados');
  el.querySelectorAll('#fm_tiers button, .barraTx, #fm_defef button').forEach(x => { x.style.display = 'none'; });
}
const semTagsDefesa = t => (t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function DEFESAS_DO_JOGO() {
  if (_defesas) return _defesas; const porTexto = new Map();
  CAT.monstros.forEach(z => { const t = (z.defense_en || '').trim(); if (!monstroDeEscolha(z) || !t || !z.name_en || /^ENEMY_/.test(z.name_en)) return; const d = porTexto.get(t) || { texto: t, apos: !!z.ShowDefenseAfterAttack, nomes: [], tipos: [], regra: (t.match(/<b>([^<]+?):?<\/b>/) || [, t.replace(/<[^>]+>/g, '').slice(0, 40)])[1].replace(/:$/, '') }; if (!d.nomes.includes(z.name_en)) d.nomes.push(z.name_en); const tp = TIPOS_MONSTRO[z.Type]; if (tp && !d.tipos.includes(tp)) d.tipos.push(tp); porTexto.set(t, d); });
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
  const rotEsc = v => pct(v) + (quase(v, ARTE_PADRAO.escala) ? L2(' (default)', ' (padrão)') : quase(v, 1) ? L2(' (fills the frame)', ' (preenche o quadro)') : '');
  const rotAlt = v => { const d = Math.round((v - base.a) * 100) / 100; return (quase(d, 0) ? L2('Default (' + pct(base.a) + ' higher)', 'Padrão (' + pct(base.a) + ' acima)') : pct(d) + (d > 0 ? L2(' higher', ' acima') : L2(' lower', ' abaixo'))) + (quase(v, 0) && !quase(d, 0) ? L2(' · on the bottom', ' · na base') : ''); };
  const rotLado = v => { const d = Math.round((v - base.l) * 100) / 100; const lado = x => x < 0 ? L2(' to the left', ' para a esquerda') : L2(' to the right', ' para a direita');
    return (quase(d, 0) ? L2('Default (', 'Padrão (') + pct(base.l) + lado(base.l) + ')' : pct(d) + lado(d)) + (quase(v, 0) && !quase(d, 0) ? L2(' · centre of the frame', ' · centro do quadro') : ''); };
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
  if (v.clone) { fichaClone(c, v); return; }
  c.innerHTML = `<div class="cabF"><h2>${esc(v.nome)} <span class="etq">workshop object</span></h2><div class="botoes"><button class="sm" id="fv_dup">Duplicate</button><button class="sm perigo" id="fv_apaga">Delete</button></div></div><div class="folha"><div class="col">
    <label class="campo">Name <input data-c="nome" value="${esc(v.nome)}"></label>
    <div class="sub">Squares it covers</div><div id="fv_forma"></div>
    <div class="sub">Colour</div><div id="fv_cores"></div>
    <label class="campo">Default text when clicked <textarea data-c="textClick" rows="2" placeholder="Filled into each new placement; edit it there if you like">${esc(v.textClick || '')}</textarea></label>
    <label class="campo">Default text when used <textarea data-c="textUse" rows="2">${esc(v.textUse || '')}</textarea></label>
    <label class="campo">Notes (for you) <textarea data-c="notas" rows="3">${esc(v.notas || '')}</textarea></label>
    </div><div class="col">
    <div class="sub">Icon</div>
    <div class="retrato"><div class="quadro"><img id="fv_prev" loading="lazy" decoding="async" ${imgTardia(iconeObj(v.id))} alt=""></div><div><label class="sm botaoArquivo">Upload a picture (PNG)<input type="file" accept="image/png,image/jpeg,image/webp" data-icone hidden></label>${v.icone ? botaoAjustar('icone') : ''}${v.icone ? '<button class="sm" data-iconeLimpa>Use a drawn icon</button>' : ''}<p class="ajuda">Or pick a drawn icon below.</p></div></div>
    <div class="glifos">${GLIFOS_OFICINA.map(g => `<button class="gl ${!v.icone && (v.glifo || 'Oficina') === g ? 'ativo' : ''}" data-gl="${g}" title="${g}"><img loading="lazy" decoding="async" ${imgTardia(icone(g, '#f3cf8f', v.cor || '#6a5a48'))} alt=""></button>`).join('')}</div>
    <div class="sub">In the app</div>
    <div class="botoes">${!['standee', 'block', 'model'].includes(v.exibir) ? '<button class="sm ativo" data-ex="token">Interaction token</button>' : ''}<button class="sm ${v.exibir === 'standee' ? 'ativo' : ''}" data-ex="standee">Standing card</button><button class="sm ${v.exibir === 'block' ? 'ativo' : ''}" data-ex="block">Block</button><button class="sm ${v.exibir === 'model' ? 'ativo' : ''}" data-ex="model">3D model</button></div>
    ${v.exibir === 'standee' ? `<div class="retrato" style="margin-top:8px"><div class="quadro alto">${v.standee ? `<img loading="lazy" decoding="async" ${imgTardia(v.standee)} alt="">` : '<span>no picture</span>'}</div><div>
        <label class="sm botaoArquivo">Upload the card picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-standee hidden></label>${v.standee ? botaoAjustar('standee') : ''}
        <label class="campo">Height <select data-alt>${ALTURAS_STANDEE.map(([h, n]) => `<option value="${h}" ${(v.alturaStandee || 1.4) === h ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <p class="ajuda">A picture standing upright on the object’s squares, always turned to the camera, like a cardboard standee. Use a PNG with a transparent background, taller than wide; the width follows the picture. Clicking the card uses the object.</p></div></div>`
      : v.exibir === 'block' ? `<div class="retrato" style="margin-top:8px"><div class="quadro"><img loading="lazy" decoding="async" ${imgTardia(v.topo || iconeObj(v.id))} alt=""></div><div>
        <label class="sm botaoArquivo">Upload the top picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-topo hidden></label>${v.topo ? botaoAjustar('topo') + '<button class="sm" data-topoLimpa>Use the icon</button>' : ''}
        <label class="campo">Height <select data-altb>${ALTURAS_BLOCO.map(([h, n]) => `<option value="${h}" ${(v.alturaBloco || 0.6) === h ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <p class="ajuda">A solid block in the object’s colour on each of its squares, with the picture laid on top across all of them (the icon, if you upload none). Square pictures fit best. Clicking the block uses the object.</p></div></div>`
      : v.exibir === 'model' ? '<div id="fv_modelo"></div>'
      : `<p class="ajuda">${esc(tr('A generic interaction token of the game, standing on coloured squares of this shape (with the uploaded icon above it, if any). An object made before the token left the choices keeps it; new objects pick among the other three.'))}</p>`}
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
  const up = c.querySelector('[data-icone]'); up.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.icone = await lerImagem(f, 128); esquecerAjuste(v, 'icone'); renderFichas(); };
  const lp = c.querySelector('[data-iconeLimpa]'); if (lp) lp.onclick = () => { v.icone = ''; renderFichas(); };
  c.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { v.exibir = b.dataset.ex; renderFichas(); desenhar(); });
  const us = c.querySelector('[data-standee]'); if (us) us.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.standee = await lerImagem(f, 512); esquecerAjuste(v, 'standee'); delete IMG['standee:' + v.id]; renderFichas(); desenhar(); };
  const al = c.querySelector('[data-alt]'); if (al) al.onchange = e => { v.alturaStandee = +e.target.value; desenhar(); };
  const ut = c.querySelector('[data-topo]'); if (ut) ut.onchange = async e => { const f = e.target.files[0]; if (!f) return; v.topo = await lerImagem(f, 512); esquecerAjuste(v, 'topo'); delete IMG['topo:' + v.id]; renderFichas(); desenhar(); };
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
/* ------------------------------------------------------------ the text box: as it shows in the app
   One box, written the way the app shows it: bold (B), italics (I, the narration), the game's icons (Icons ▾), the names
   the app fills in (the chips) and the rule words (scar, terrify, focus…), highlighted by themselves. Underneath, the
   game's own marks (TextMeshPro): <b>, <i>, <style=Term><link=TERM_…>…</link></style> and {0}, {1}… */
const SIMBOLO_ICONE = { fatigue: 'ϟ', damage: '✸', advantage: '▲', surge: '✦', success: '✔', health: '♥', action: '➤' };
const ROTULO_VAGA = v => tr(v.replace(/ \d+$/, '')) + (/ \d+$/.test(v) ? ' ' + v.match(/\d+$/)[0] : '');
function tmpParaHtml(tmp, vagas) {
  let h = esc(tmp || '');
  h = h.replace(/&lt;(\/?)(i|b)&gt;/g, '<$1$2>');
  h = h.replace(/&lt;style=[^&]*&gt;&lt;link=([A-Z_0-9]+)&gt;([\s\S]*?)&lt;\/link&gt;&lt;\/style&gt;/g, (x, termo, w) => {
    const ic = GLIFO_ICONE[w] || (ICONE_DO_TERMO[termo] && !w.trim() ? ICONE_DO_TERMO[termo] : null);
    return ic ? `<span class="icoTx" contenteditable="false" data-ico="${ic}" title="${esc(tr(ic))}">${SIMBOLO_ICONE[ic] || '?'}</span>` : `<span class="termoTx" data-termo="${termo}">${w}</span>`; });
  h = h.replace(/&lt;\/?[a-z]+(=[^&]*)?&gt;/gi, '');   // (other marks of the game: left out of the box)
  h = h.replace(/\{(\d)\}/g, (x, n) => { const v = vagas[+n] || 'name'; return `<span class="vagaTx" contenteditable="false" data-vaga="${esc(v)}" title="${esc(VAGA_EXPLICA[v.replace(/ \d+$/, '')] || '')}">${esc(ROTULO_VAGA(v))}</span>`; });
  return h.replace(/\n/g, '<br>');
}
const aplicarTermos = s => { const chaves = Object.keys(TERMOS_TX).sort((a, b) => b.length - a.length); const re = new RegExp('\\b(' + chaves.map(k => k.replace(/ /g, '\\s')).join('|') + ')\\b', 'g');
  return s.split(/(<style=Term><link=[^>]+>[\s\S]*?<\/link><\/style>|<[^>]+>)/).map((p, i) => i % 2 ? p : p.replace(re, w => '<style=Term><link=' + TERMOS_TX[w.replace(/\s+/g, ' ')] + '>' + w + '</link></style>')).join(''); };
function htmlParaTmp(el, vagas, termos) {
  let out = '';
  const anda = (n, primeiro) => {
    if (n.nodeType === 3) { out += n.nodeValue.replace(/\u200b/g, '').replace(/</g, '‹'); return; }
    if (n.nodeType !== 1) return;
    const t = n.tagName;
    if (t === 'BR') { out += '\n'; return; }
    if (n.classList.contains('icoTx')) { const k = n.dataset.ico; if (ICONES_TX[k]) out += '<style=Term><link=' + ICONES_TX[k][0] + '>' + ICONES_TX[k][1] + '</link></style>'; return; }
    if (n.classList.contains('vagaTx')) { const v = n.dataset.vaga; let i = vagas.indexOf(v); if (i < 0) { vagas.push(v); i = vagas.length - 1; } out += '{' + i + '}'; return; }
    if (n.classList.contains('termoTx') && n.dataset.termo) { out += '<style=Term><link=' + n.dataset.termo + '>' + n.textContent + '</link></style>'; return; }
    const bloco = (t === 'DIV' || t === 'P') && !primeiro && out && !out.endsWith('\n');
    if (bloco) out += '\n';
    const neg = t === 'B' || t === 'STRONG' || /^(bold|[6-9]00)$/.test(n.style && n.style.fontWeight || ''), ita = t === 'I' || t === 'EM' || (n.style && n.style.fontStyle === 'italic');
    if (neg) out += '<b>'; if (ita) out += '<i>';
    [...n.childNodes].forEach((c, i) => anda(c, i === 0 && primeiro));
    if (ita) out += '</i>'; if (neg) out += '</b>';
  };
  [...el.childNodes].forEach((c, i) => anda(c, i === 0));
  out = out.replace(/<\/b><b>/g, '').replace(/<\/i><i>/g, '').replace(/<(b|i)><\/\1>/g, '').replace(/\n+$/, '').replace(/^\s+|\s+$/g, '');
  return termos ? aplicarTermos(out) : out;
}
/* the box: o = { tmp, vagas (the names the app fills in, kept in order), aoMudar(tmp), linhas, placeholder, termos } */
function caixaDoApp(el, o) {
  const vagas = o.vagas || [];
  const chips = (o.chips || vagas.filter(v => !/ \d+$/.test(v))).filter((v, i, a) => a.indexOf(v) === i);
  el.innerHTML = `<div class="barraTx"><button class="sm" data-cmd="bold" title="${esc(tr('Bold: the name of a rule, a word to stand out'))}"><b>B</b></button><button class="sm" data-cmd="italic" title="${esc(tr('Italics: the narration, read aloud'))}"><i>I</i></button>
      <span class="menuIcones"><button class="sm" data-icones title="${esc(tr('The game’s icons'))}">${esc(tr('Icons'))} ▾</button><span class="paletaIcones" hidden>${Object.keys(ICONES_TX).map(k => `<button class="sm" data-ico="${k}" title="${esc(tr(k))}"><span class="icoTx">${SIMBOLO_ICONE[k]}</span> ${esc(tr(k))}</button>`).join('')}</span></span>
      ${chips.length ? '<span class="sep"></span>' + chips.map(v => `<button class="sm fichaTx" data-vaga="${esc(v)}" title="${esc(VAGA_EXPLICA[v.replace(/ \d+$/, '')] || '')}">+ ${esc(ROTULO_VAGA(v))}</button>`).join('') : ''}</div>
    <div class="previaTx caixaApp" contenteditable="true" data-sem-traducao spellcheck="false" style="min-height:${(o.linhas || 3) * 1.5}em" data-placeholder="${esc(o.placeholder || '')}">${tmpParaHtml(o.tmp, vagas)}</div>`;
  const cx = el.querySelector('.caixaApp'); let faixa = null;
  const guardar = () => { const s = getSelection(); if (s.rangeCount && cx.contains(s.getRangeAt(0).commonAncestorContainer)) faixa = s.getRangeAt(0).cloneRange(); };
  const mudou = () => { o.aoMudar(htmlParaTmp(cx, vagas, o.termos !== false)); };
  // (leaving the box, it is drawn again from what it became: the rule words show highlighted)
  cx.addEventListener('blur', () => { if (cx.isContentEditable) { const t = htmlParaTmp(cx, vagas, o.termos !== false); cx.innerHTML = tmpParaHtml(t, vagas); faixa = null; } });
  cx.addEventListener('keyup', guardar); cx.addEventListener('mouseup', guardar); cx.addEventListener('input', () => { guardar(); mudou(); });
  // (pasting brings the words, not another page's looks)
  cx.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
  const voltar = () => { cx.focus(); if (faixa) { const s = getSelection(); s.removeAllRanges(); s.addRange(faixa); } };
  // (inside italics or bold, what goes in keeps them: the chip or the icon, and what is typed after it)
  const inserirHtml = html => { voltar(); let h = html + '\u200b'; const s = getSelection(); let n = s.rangeCount ? s.getRangeAt(0).startContainer : null;
    for (; n && n !== cx; n = n.parentNode) { if (n.nodeType !== 1) continue; if (/^(I|EM)$/.test(n.tagName)) h = '<i>' + h + '</i>'; else if (/^(B|STRONG)$/.test(n.tagName)) h = '<b>' + h + '</b>'; }
    document.execCommand('insertHTML', false, h); guardar(); mudou(); };
  el.querySelectorAll('.barraTx button').forEach(b => { b.onmousedown = e => e.preventDefault(); });
  el.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => { voltar(); document.execCommand(b.dataset.cmd); guardar(); mudou(); });
  const pal = el.querySelector('.paletaIcones'); el.querySelector('[data-icones]').onclick = () => { pal.hidden = !pal.hidden; };
  el.querySelectorAll('.paletaIcones [data-ico]').forEach(b => b.onclick = () => { const k = b.dataset.ico; pal.hidden = true; inserirHtml(`<span class="icoTx" contenteditable="false" data-ico="${k}" title="${esc(tr(k))}">${SIMBOLO_ICONE[k]}</span>`); });
  el.querySelectorAll('.barraTx [data-vaga]').forEach(b => b.onclick = () => { const v = b.dataset.vaga; inserirHtml(`<span class="vagaTx" contenteditable="false" data-vaga="${esc(v)}">${esc(ROTULO_VAGA(v))}</span>`); });
  return cx;
}
/* a text of the game (item card, monster description, feat): one box, as it shows in the app */
function editorDeDescricao(el, x, campo, rotulo, mudou) {
  if (!el) return;
  el.innerHTML = `<div class="campo"><span>${rotulo}</span><div data-caixa></div></div>`;
  caixaDoApp(el.querySelector('[data-caixa]'), { tmp: x[campo] || '', vagas: [], linhas: 3, aoMudar: t => { x[campo] = t; mudou && mudou(); } });
}
/* an activation, a tactic, a defense or an ability: the text (with the names the app fills in) and, before it, the hint */
function editorDeTexto(d, a, mudou, opc = {}) {
  a.vagas = a.vagas || vagasDe(a.text, ['monster', 'hero']);
  a.vagasDica = a.vagasDica || vagasDe(a.hint, ['monster', 'hero']);
  d.innerHTML = `<div class="campo"><span>${esc(tr(opc.soRegras ? 'Text' : 'Text (as the players read it)'))}</span><div data-caixa="text"></div></div>
    ${opc.soRegras ? '' : `<div class="campo"><span>${esc(tr('Hint before it'))} <small>${esc(tr('(optional, shown before the activation)'))}</small></span><div data-caixa="hint"></div></div>`}
    <p class="ajuda">${esc(tr('Write it as it shows in the app: B for the name of the rule (“Bloodlust:”), I for the narration, Icons ▾ for the game’s icons, the chips for the names the app fills in. Rule words like scar, terrify or focus are highlighted by themselves.'))}</p>`;
  caixaDoApp(d.querySelector('[data-caixa=text]'), { tmp: a.text || '', vagas: a.vagas, chips: ['monster', 'hero'], linhas: 3, placeholder: opc.exemploRegras || tr('Bloodlust: after the attack, the target is pushed 2 spaces.'), aoMudar: t => { a.text = t; mudou(); } });
  const dh = d.querySelector('[data-caixa=hint]'); if (dh) caixaDoApp(dh, { tmp: a.hint || '', vagas: a.vagasDica, chips: ['monster', 'hero'], linhas: 1, termos: false, placeholder: tr('The monster eyes the weakest hero…'), aoMudar: t => { a.hint = t; mudou(); } });
}

// ------------------------------------------------------------ the default of a game object, changed in the Workshop
const objetosDoJogoComPadrao = () => Object.keys(padroesDaOficina()).filter(k => !ehDaOficina(k) && OBJETO[k]).sort((a, b) => nomeObj(a).localeCompare(nomeObj(b)));
function fichaPadraoJogo(c, k) {
  const p = padroesDaOficina()[k]; if (!p) { c.innerHTML = ''; return; }
  const lista = (p.gatilhos || []).map(g => `<li>${esc(tr(resumoGatilho(g)))}</li>`).join('');
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeObj(k))} <span class="etq custom">${tr('game object · default of its own')}</span></h2><div class="botoes"><button class="sm" id="fpj_volta">${tr('Back to the game’s default')}</button></div></div>
    <div class="folha"><div class="col"><div class="retrato"><div class="quadro"><img loading="lazy" decoding="async" ${imgTardia(iconeObj(k))} alt=""></div></div>
    <div class="sub">${tr('Text when looked at')}</div><p>${esc(p.textClick || '—')}</p>
    <div class="sub">${tr('Text when used')}</div><p>${esc(p.textUse || '—')}</p>
    <div class="sub">${tr('Triggers')}</div>${lista ? `<ul>${lista}</ul>` : '<p>—</p>'}
    <p class="ajuda">${tr('Objects of this kind placed with “Default” ticked come with this programming. To change it: place one on the map, program it and use “Save as the default” in its panel. The same as the game’s one, it leaves this list.')}</p></div></div>`;
  c.querySelector('#fpj_volta').onclick = () => { delete padroesDaOficina()[k]; fichaSel = null; renderFichas(); };
}

/* the game's tiles and objects, in the Workshop: to read, and to duplicate (a tile into one of the Workshop's, of the same
   shape; an object into a copy that is the same piece of the game, with a default of its own) */
let rolJogoAberto = false;
const pecaDoJogoSel = () => { const f = String(fichaSel || ''); if (!f.startsWith('jogo:')) return false; const k = f.slice(5); return abaF === 'pecas' ? !!PECA[k] && k !== 'gamebox' : abaF === 'objetos' ? !!OBJETO[k] : false; };
const pecasDoRol = () => DADOS.tiles.filter(t => t.id !== 'gamebox');
const nomeDaPecaDoJogo = t => t.kind === 'underlay' ? tr('Underlay') + ' · ' + tr(nomeAlfombra(t.id)) : t.id === 'platform' ? tr('Platform') : t.id === 'vault' ? tr('Vault') : tr('Tile') + ' ' + nomePeca(t.id);
function rolDasPecasDoJogo(bloco) {
  const pecas = abaF === 'pecas'; const lista = pecas ? pecasDoRol() : OBJETOS;
  const d = document.createElement('details'); d.className = 'rolJogo'; d.open = rolJogoAberto || pecaDoJogoSel(); d.ontoggle = () => { rolJogoAberto = d.open; };
  d.innerHTML = `<summary>${esc(tr(pecas ? 'Tiles of the game' : 'Objects of the game'))} <span class="etq">${lista.length}</span></summary><p class="ajuda">${esc(tr(pecas ? 'The game’s tiles, as they are. Duplicate one to make a Workshop tile of the same shape.' : 'The game’s objects, as they are. Duplicate one to make a copy: the same piece of the game, with a default (texts and triggers) of its own.'))}</p><div class="lista"></div>`;
  const l = d.querySelector('.lista');
  lista.forEach(t => { const e = document.createElement('div'); e.className = 'no' + (fichaSel === 'jogo:' + t.id ? ' ativo' : '');
    const img = pecas ? miniatura(t) : iconeObj(t.id); const nome = pecas ? nomeDaPecaDoJogo(t) : nomeObj(t.id);
    const sub = pecas ? t.cells.length + ' ' + tr('square(s)') + ' · ' + t.w + '×' + t.h : (t.w || 1) + '×' + (t.h || 1) + (padroesDaOficina()[t.id] ? ' · ' + tr('default of its own') : '');
    e.innerHTML = `<img class="face quadrada" loading="lazy" decoding="async" ${imgTardia(img)} alt=""><div><div>${esc(nome)}</div><small>${esc(sub)}${(t.act || 1) === 2 ? ' · II' : ''}</small></div>`;
    e.onclick = () => { fichaSel = 'jogo:' + t.id; rolJogoAberto = true; renderFichas(); }; l.appendChild(e); });
  bloco.appendChild(d);
}
/* the colour of a copied tile: the one of the game's floor */
const COR_DO_CHAO = { flagstone: '#6f6a60', dirt: '#7a5a3a', grass: '#4d6b34', wood: '#a0703f', 'underlay-embers': '#a8483a', 'underlay-water': '#2f4f6f', 'underlay-fetidwater': '#3f5e5a', 'underlay-spikes': '#3a3a3f' };
function fichaPecaJogo(c, k) {
  const t = PECA[k]; const nome = nomeDaPecaDoJogo(t);
  c.innerHTML = `<div class="cabF"><h2>${esc(nome)} <span class="etq">${esc(tr('the game’s tile'))}</span></h2><div class="botoes"><button class="sm primario" id="fpj_dup">⧉ ${esc(tr('Duplicate'))}</button></div></div>
    <div class="folha"><div class="col"><div class="previa"><img class="previaPixel" loading="lazy" decoding="async" ${imgTardia(miniatura(t))} alt=""></div></div><div class="col">
    <p>${t.cells.length} ${esc(tr('square(s)'))} · ${t.w}×${t.h}${(t.act || 1) === 2 ? ' · ' + esc(tr('Act II box')) : ''}</p>
    <p class="ajuda">${esc(tr('A tile of the game box: it is changed nowhere. “Duplicate” makes a Workshop tile of the same shape, in the colour of this floor, to change at will (a physical piece of your own, drawn by the mod).'))}</p></div></div>`;
  c.querySelector('#fpj_dup').onclick = () => {
    const x0 = Math.min(...t.cells.map(q => q[0])), y0 = Math.min(...t.cells.map(q => q[1]));
    const v = { id: 'B_' + uid(), custom: true, nome: nome + ' ' + tr('(copy)'), cells: t.cells.map(([x, y]) => [x - x0, y - y0]), cor: COR_DO_CHAO[texturaDe(t)] || PALETA_CORES[0], notas: '' };
    if (t.kind === 'underlay') { v.underlay = true; v.copias = 1; }
    oficina().pecas.push(v); fichaSel = v.id; renderFichas(); aviso(tr('Duplicated: this tile is yours to change.')); };
}
/* the default of a game object, as a copy starts with it: the Workshop's, or the game's (or nothing) */
const padraoParaCopia = k => padraoDe(k) || { textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
function criarCopia(k, nome, padrao) {
  const o = OBJETO[k]; const cells = []; for (let i = 0; i < (o.w || 1); i++) for (let j = 0; j < (o.h || 1); j++) cells.push([i, j]);
  const v = { id: 'B_' + uid(), clone: k, nome, cells, notas: '' }; oficina().objetos.push(v);
  padroesDaOficina()[v.id] = padrao; return v;
}
function duplicarObjetoDoJogo(k, nome, padrao) { const v = criarCopia(k, nome, padrao); fichaSel = v.id; renderFichas(); return v; }
/* "Save as the default" on a game object of the map: its programming becomes a new object of the Workshop, a copy of that
   piece, named here (the object on the map becomes that copy). On a copy already: it is updated, or another one is made */
function batizarCopia(o, depois) {
  const atual = o.molde && cloneDoJogo(o.molde); const k = o.type;
  const sugestao = (o.name || '').trim() || (atual ? atual.nome + ' ' + tr('(copy)') : nomeObj(k) + ' ' + tr('(copy)'));
  modal(tr('Name the new object'), `<p class="ajuda">${esc(tr('The texts and triggers of this object become a new object of the Workshop: on the board and in the game it is the same piece') + ' (' + nomeObj(k) + '), ' + tr('with this default. It waits in the Object palette.'))}</p>
    ${atual ? `<div class="opcoesCopia"><button class="op destaque" data-o="atualiza"><b>${esc(tr('Update') + ' “' + atual.nome + '”')}</b><small>${esc(tr('The copy this object came from gets this default.'))}</small></button></div><div class="sub">${esc(tr('Or a new object'))}</div>` : ''}
    <label class="campo">${esc(tr('Name'))} <input id="bc_nome" value="${esc(sugestao)}" maxlength="60"></label>
    <div class="rodape"><button data-o="nao">${esc(tr('Cancel'))}</button><button class="primario" data-o="cria">${esc(tr('Create the object'))}</button></div>`, (el, fechar) => {
    const nome = el.querySelector('#bc_nome'); setTimeout(() => { nome.focus(); nome.select(); }, 30);
    el.querySelector('[data-o="nao"]').onclick = fechar;
    const at = el.querySelector('[data-o="atualiza"]'); if (at) at.onclick = () => { padroesDaOficina()[atual.id] = programacaoDe(o); fechar(); aviso(tr('Saved') + ': “' + atual.nome + '”.'); depois && depois(); };
    const cria = () => { const n = nome.value.trim(); if (!n) { nome.focus(); return; }
      const v = criarCopia(k, n, programacaoDe(o)); o.molde = v.id; fechar();
      avisoLongo('“' + n + '” ' + tr('is in the Workshop (Objects) and in the Object palette.'), 5000); depois && depois(); };
    el.querySelector('[data-o="cria"]').onclick = cria; nome.onkeydown = e => { if (e.key === 'Enter') cria(); };
  });
}
/* the texts and triggers of a copy, edited in the Workshop itself with the object panel of the map: while its sheet is open
   the work on screen waits aside (nothing of it is saved, exported or undone meanwhile) and a board of its own holds the
   piece alone, programmed as the copy's default; each change goes back into the default. Leaving the sheet brings the work
   back */
/* d: what is edited, {chave (the key of the default: the copy's id or the game type), tipo, molde (the copy's id, or none),
   nome} */
function entrarPadraoNaOficina(d, alvo) {
  if (EDITANDO_PADRAO && EDITANDO_PADRAO.chave !== d.chave) sairPadraoDaOficina();
  if (!EDITANDO_PADRAO) {
    const k = d.tipo; const ob = OBJETO[k]; const w = (ob.w || 1) + 4, h = (ob.h || 1) + 4;
    EDITANDO_PADRAO = { ...d, fichaSel, antes: { projeto, campanha, missaoAtual, salaAtual, sel, ferramenta, gatAberto, vista: { ...vista } } };
    const p = projetoNovo(); p.meta.name = d.nome;
    const sala = { nome: d.nome, texto: '', pecas: [], objetos: [], inimigos: [], herois: [], objetivos: [], reserva: { add: [], remove: [] }, abertaPor: [] };
    for (let x = 0; x < w; x += 2) for (let y = 0; y < h; y += 3) sala.pecas.push({ tile: '1a', pos: [x + 1, y + 2], rot: 0, level: 0 });
    const o = { type: k, ...(d.molde ? { molde: d.molde } : {}), pos: [2, 2], rot: 0, level: 0, name: '', textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] };
    Object.assign(o, clone(padroesDaOficina()[d.chave] || padraoParaCopia(k))); sala.objetos.push(o); p.salas.push(sala);
    campanha = null; projeto = normalizar(p); missaoAtual = 0; salaAtual = 0; ferramenta = null; gatAberto = -1; escolha = null;
    const pp = $('#props'); if (pp) { pp.hidden = true; pp.querySelector('.corpo').innerHTML = ''; }
  }
  EDITANDO_PADRAO.alvo = alvo; sel = { tipo: 'objeto', sala: 0, i: 0 };
  renderObjeto(alvo, projeto.salas[0], 0);
  // (every change of the panel goes into the default at once)
  const guardar = () => setTimeout(() => guardarPadraoDaOficina(), 0);
  alvo.addEventListener('input', guardar); alvo.addEventListener('change', guardar); alvo.addEventListener('click', guardar);
}
/* the programming of the piece on its board becomes the default: of the copy; or of the game object in this Workshop (the
   same as the game's: the Workshop forgets it) */
function guardarPadraoDaOficina() {
  const e = EDITANDO_PADRAO; if (!e) return; const o = (projeto.salas[0]?.objetos || [])[0]; if (!o) return; const pp = padroesDaOficina();
  if (e.molde) { if (varObj(e.molde)) pp[e.chave] = programacaoDe(o); return; }
  const p = programacaoDe(o), orig = padraoOriginal(e.tipo); const igual = orig ? formaDaProgramacao(p) === formaDaProgramacao(orig) : !(p.gatilhos || []).length && !p.textClick && !p.textUse && !(p.requisitos || []).length;
  const tinha = !!pp[e.chave]; if (igual) delete pp[e.chave]; else pp[e.chave] = p;
  if (tinha !== !!pp[e.chave]) { const etq = document.querySelector('#centroF .cabF .etq'); if (etq) { etq.textContent = tr(pp[e.chave] ? 'game object · default of its own' : 'the game’s object'); etq.classList.toggle('custom', !!pp[e.chave]); } const vt = document.querySelector('#foj_volta'); if (vt) vt.hidden = !pp[e.chave]; }
}
function sairPadraoDaOficina() {
  const e = EDITANDO_PADRAO; if (!e) return; guardarPadraoDaOficina();
  const a = e.antes; EDITANDO_PADRAO = null; projeto = a.projeto; campanha = a.campanha; missaoAtual = a.missaoAtual; salaAtual = a.salaAtual; Object.assign(vista, a.vista);
  sel = a.sel; ferramenta = a.ferramenta; gatAberto = a.gatAberto; escolha = null;
  const pp = $('#props'); if (pp) pp.querySelector('.corpo').innerHTML = '';
  if ($('#telaFichas').hidden) tudo();
}
/* the sheet of a game object: its default changes here, for this Workshop (the game's own stays in the game: "Back to the
   game's default" brings it back); "Duplicate" makes a copy with a default of its own */
function fichaObjetoJogo(c, k) {
  const o = OBJETO[k]; const meu = !!padroesDaOficina()[k];
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeObj(k))} <span class="etq ${meu ? 'custom' : ''}">${esc(tr(meu ? 'game object · default of its own' : 'the game’s object'))}</span></h2><div class="botoes"><button class="sm primario" id="foj_dup">⧉ ${esc(tr('Duplicate'))}</button><button class="sm" id="foj_volta" ${meu ? '' : 'hidden'}>${esc(tr('Back to the game’s default'))}</button></div></div>
    <div class="folha"><div class="col"><div class="retrato"><div class="quadro"><img loading="lazy" decoding="async" ${imgTardia(iconeObj(k))} alt=""></div><div><p>${o.w || 1}×${o.h || 1}${(o.act || 1) === 2 ? ' · ' + esc(tr('Act II box')) : ''}</p></div></div>
      <p class="ajuda">${esc(tr('An object of the game. Its default (the texts and triggers it comes with when placed with “Default script” ticked) changes here for your Workshop; “Back to the game’s default” undoes it. “Duplicate” makes a copy: the same piece, with a default of its own; make as many as you like, each with a different default.'))}</p>
    </div><div class="col"><div class="sub">${esc(tr('Default'))}</div><div class="painelCopia"></div></div></div>`;
  entrarPadraoNaOficina({ chave: k, tipo: k, molde: null, nome: nomeObj(k) }, c.querySelector('.painelCopia'));
  c.querySelector('#foj_dup').onclick = () => { guardarPadraoDaOficina(); duplicarObjetoDoJogo(k, nomeObj(k) + ' ' + tr('(copy)'), padraoParaCopia(k)); aviso(tr('Duplicated: the copy has its own default, to change at will.')); };
  c.querySelector('#foj_volta').onclick = () => { if (!confirm(tr('Back to the game’s default') + '?')) return; sairPadraoDaOficina(); delete padroesDaOficina()[k]; renderFichas(); };
}
function fichaClone(c, v) {
  const k = v.clone; const pp = padroesDaOficina(); if (!pp[v.id]) pp[v.id] = padraoParaCopia(k);
  c.innerHTML = `<div class="cabF"><h2>${esc(v.nome)} <span class="etq custom">${esc(tr('copy of') + ' ' + nomeObj(k))}</span></h2><div class="botoes"><button class="sm" id="fc_dup">${esc(tr('Duplicate'))}</button><button class="sm perigo" id="fc_apaga">${esc(tr('Delete'))}</button></div></div>
    <div class="folha"><div class="col">
      <label class="campo">${esc(tr('Name'))} <input data-c="nome" value="${esc(v.nome)}"></label>
      <div class="retrato"><div class="quadro"><img loading="lazy" decoding="async" ${imgTardia(iconeObj(k))} alt=""></div><div><p class="ajuda">${esc(tr('On the board and in the game it is the game’s piece') + ' (' + nomeObj(k) + ', ' + (OBJETO[k].w || 1) + '×' + (OBJETO[k].h || 1) + '). ' + tr('What changes is its default.'))}</p></div></div>
      <label class="campo">${esc(tr('Notes (for you)'))} <textarea data-c="notas" rows="3">${esc(v.notas || '')}</textarea></label>
      <p class="ajuda">${esc(tr('Copies placed with “Default script” ticked come with this default. Changed on the map and saved with “Save as the default”, the default of the copy changes too.'))}</p>
      <button class="sm" id="fc_jogo">${esc(tr('Back to the game’s default'))}</button>
    </div><div class="col">
      <div class="sub">${esc(tr('Default'))}</div>
      <div class="painelCopia"></div>
    </div></div>`;
  liga(c, v, x => { if (x === 'nome') { c.querySelector('h2').firstChild.textContent = v.nome + ' '; renderFichasLista(true); } });
  entrarPadraoNaOficina({ chave: v.id, tipo: k, molde: v.id, nome: v.nome }, c.querySelector('.painelCopia'));
  c.querySelector('#fc_jogo').onclick = () => { if (!confirm(tr('Replace the default of this copy with the game’s?'))) return; sairPadraoDaOficina(); pp[v.id] = padraoOriginal(k) || { textClick: '', textUse: '', gatilhos: [], requisitos: [], senao: [] }; renderFichas(); };
  c.querySelector('#fc_dup').onclick = () => { guardarPadraoDaOficina(); duplicarObjetoDoJogo(k, v.nome + ' ' + tr('(copy)'), clone(pp[v.id])); };
  c.querySelector('#fc_apaga').onclick = () => { if (!confirm(tr('Delete') + ' ' + v.nome + '?')) return; sairPadraoDaOficina(); oficina().objetos = oficina().objetos.filter(x => x !== v); delete pp[v.id]; if (objetoEscolhido === v.id) objetoEscolhido = 'Door'; fichaSel = null; renderFichas(); };
}
