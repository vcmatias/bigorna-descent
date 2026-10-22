/* Bigorna Rooms v2 — the Workshop's feats: the goals each hero pursues during the quests (attack with a spear 5 times,
   open 3 chests…), counted by the game itself, with rewards when completed (skill cards, recipes). The game's feats can be
   imported and changed, new ones written for any hero. The feat pool limits what the game offers: for each hero with a feat
   in the pool, only the pool's feats are offered (the ones already in progress keep going). */
'use strict';

const MOMENTOS_FACANHA = [[1, 'After the hero attacks'], [10, 'After the hero’s attack is resolved'], [2, 'After a monster attacks'], [3, 'When the hero is hurt'], [4, 'When a monster is defeated'],
  [5, 'When the hero interacts (tokens, doors, chests…)'], [9, 'After an attack or an interaction'], [6, 'When the party gains items'], [7, 'At the end of each round'], [8, 'At the end of the quest']];
const TIPOS_ITEM_FACANHA = ['Materials', 'Consumables', 'Armor', 'Trinkets', 'Weapon parts', 'Recipes'];
const OBJETOS_FACANHA = ['Any', 'Chest', 'Shelf', 'Lectern', 'Well', 'Cauldron', 'Door', 'Sight token', 'Bell', 'Blood shrine', 'Fire', 'Ladder', 'Statue', 'Wagon', 'Vault', 'Platform'];
const CONDICOES_FACANHA = [[1, 'Dazed'], [2, 'Enfeebled'], [4, 'Afflicted'], [8, 'Slowed'], [16, 'Exposed'], [32, 'Doomed'], [64, 'Confused']];
/* the hero's health (HeroHealth: 0 none, 1 minor, 2 major, 3 defeated): the game counts "at least" that state, or, with
   InvertCondition, exactly that state */
const SAUDE_FACANHA = [[1, false, 'Has at least a minor injury'], [2, false, 'Has at least a major injury'], [3, false, 'Has been defeated'], [0, true, 'Has no injury'], [1, true, 'Has exactly a minor injury'], [2, true, 'Has exactly a major injury']];
/* the game's finer switches (on, with a value of their own); the other finer ones are on/off or numbers */
const SIM_NAO_FEITO = new Set(['DamagedEnemy', 'AnyHero', 'AnyHeroInjured', 'AnyOtherHeroInjured', 'EnemyHasTactic', 'FirstAttackOfRound', 'FirstInteractionOfRound', 'FirstTimeInteracted', 'FirstTimeAttackedByHero', 'HeroAttackedThisRound', 'OtherHeroDidDamage', 'AllOtherHeroesDidDamageThisRound', 'AllHeroesDidDamageThisRound', 'DiedFromAffliction']);
const facanhaDoJogo = id => (CAT.facanhas || []).find(f => f._id === id);
/* the game's text of a feat: "<b>Name</b>: what to do" */
function partesDoTexto(t) { const m = (t || '').match(/^\s*<b>([\s\S]*?)<\/b>\s*:?\s*([\s\S]*)$/); return m ? { nome: m[1].trim(), corpo: m[2].trim() } : { nome: '', corpo: (t || '').trim() }; }
const nomeFacanha = f => f.nome || '(no name)';
/* a reward of a feat: a skill id (as the game keeps it), 'RECEITA:' + a recipe of the workshop, 'ITEM:' + an item id (as "Give an item" keeps it) */
function nomeDoPremio(id) {
  if (typeof id === 'string' && id.startsWith('ITEM:')) return semGlifo(nomeItem(id.slice(5)));
  // (a recipe: the name of the item it crafts; the line under it says it is a recipe)
  if (typeof id === 'string' && id.startsWith('RECEITA:')) { const r = (oficina().receitas || []).find(x => x.id === id.slice(8)); return r ? semGlifo(itemAlvo(r.item)?.nome || nomeReceita(r)) : tr('a recipe (gone)'); }
  const rj = receitaDoJogoPorId(id); if (rj) return semGlifo(itemAlvo(rj.CraftedItemId)?.nome || id).replace(/\s*✚\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const n = nomeDePericiaPorId(id); return n || id;
}
const receitaDoJogoPorId = id => (CAT.receitas || []).find(x => x._id === id) || null;
const tipoDoPremio = id => id.startsWith('ITEM:') ? 'item' : id.startsWith('RECEITA:') || receitaDoJogoPorId(id) ? 'recipe (the party learns it)' : nomeDePericiaPorId(id) ? 'skill card' : 'of the game';
function imagemDoPremio(id) {
  if (id.startsWith('ITEM:')) return imagemDoItemEscolhido(id.slice(5));
  if (id.startsWith('RECEITA:')) { const r = (oficina().receitas || []).find(x => x.id === id.slice(8)); return r ? itemAlvo(r.item)?.img || '' : ''; }
  const rj = receitaDoJogoPorId(id); if (rj) return itemAlvo(rj.CraftedItemId)?.img || '';
  return '';
}

function filtrosDoJogo(c) {
  const on = k => c[k] && c[k].Enable;
  return { armas: on('WeaponClasses') ? [...c.WeaponClasses.Value] : null, inimigos: on('EnemyTypes') ? [...c.EnemyTypes.Value] : null, itens: on('ItemType') ? [...c.ItemType.Value] : null,
    objeto: on('InteractableType') ? c.InteractableType.Value : null, condicao: on('EnemyConditions') ? c.EnemyConditions.Value : null,
    lesao: on('HeroInjured') ? { valor: c.HeroInjured.Value, inverso: !!c.HeroInjured.InvertCondition } : null,
    danoTotal: !!on('GoalIsTotalDamage'), fraqueza: !!on('WeaknessDamage'), vitoria: on('IsVictory') ? !!c.IsVictory.Value : null,
    danoMinimo: on('MinimumDamage') ? c.MinimumDamage.Value : 0, mesmoInimigo: on('SameEnemy') ? !!c.SameEnemy.Value : null,
    // (the finer conditions: a switch keeps its value, an on/off is true, a number its number)
    ...Object.fromEntries(EXTRAS_FEITO.map(k => [k, !on(k) ? null : SIM_NAO_FEITO.has(k) ? !!c[k].Value : c[k].Value === undefined ? true : c[k].Value])) };
}
function facanhaDoCatalogo(c) {
  const { nome, corpo } = partesDoTexto(c.desc_en);
  return { id: 'B_' + uid(), base: c._id, custom: false, nome: nome || c._id, texto: corpo, heroi: c.HeroSource?.id || HEROIS_IDS[0], meta: c.Goal || 1, momento: c.Timing || 1,
    filtros: filtrosDoJogo(c), extrasConhecidos: c.FirstAttackOfRound !== undefined, precisa: c.AmountCompletedRequired || 0, ato: c._act || 0, premios: null, premiosJogo: (c.Rewards || []).map(r => r && r.id).filter(Boolean), outrosPremios: (c.Rewards || []).filter(r => !r || !r.id).length };
}
function novaFacanha(hid) {
  const f = { id: 'B_' + uid(), base: null, custom: true, nome: tr('New feat'), texto: tr('Attack with your spear.'), heroi: hid || HEROIS_IDS[0], meta: 3, momento: 1,
    filtros: { armas: null, inimigos: null, itens: null, objeto: null, condicao: null, lesao: null, danoTotal: false, fraqueza: false, vitoria: null, danoMinimo: 0, mesmoInimigo: null }, extrasConhecidos: true, precisa: 0, ato: 0, premios: [] };
  oficina().facanhas.push(f); poolDasFacanhas().push(f.id); abrirProezas(f.heroi, f.id); return f;
}
/* ------------------------------------------------------------ v232: the feats of each hero, in the heroes tab
   The feats of a profile are the ones the game offers that hero (the feat pool): with none, the game offers its own. "Define
   feats", under the hero's name in the picture of the party, opens them. A feat of another hero comes in as a copy for this
   one (the feat of the game stays as it is, for its hero). A feat that asks for a weapon the hero does not use is shown in
   red: it can never be done. */
const PROEZAS = '@proezas:';
const poolDasFacanhas = () => (oficina().poolFacanhas = oficina().poolFacanhas || []);
/* v241: the feats of the game come already defined: a hero of the game with no feat in the pool gets the game's own (the
   same the game offers it), in their tiers; the user changes them from there */
function predefinirProezas(b) {
  if (!b || typeof CAT === 'undefined' || !Array.isArray(CAT.facanhas) || typeof HEROIS_IDS === 'undefined') return;
  const pool = b.poolFacanhas = b.poolFacanhas || [];
  const heroiDe = id => { const f = (b.facanhas || []).find(x => x.id === id); if (f) return f.heroi; const c = facanhaDoJogo(id); return (c && c.HeroSource && c.HeroSource.id) || ''; };
  const comProezas = new Set(pool.map(heroiDe));
  HEROIS_IDS.forEach(h => { if (comProezas.has(h)) return; CAT.facanhas.filter(c => c.HeroSource && c.HeroSource.id === h).forEach(c => { if (!pool.includes(c._id)) pool.push(c._id); }); });
}
const heroiDaFacanhaId = id => { const f = (oficina().facanhas || []).find(x => x.id === id); if (f) return f.heroi; const c = facanhaDoJogo(id); return (c && c.HeroSource && c.HeroSource.id) || ''; };
const facanhasDoHeroi = hid => poolDasFacanhas().filter(id => heroiDaFacanhaId(id) === hid);
function armasDaFacanha(id) { const f = (oficina().facanhas || []).find(x => x.id === id); const c = f ? null : facanhaDoJogo(id); const x = f ? f.filtros : c ? filtrosDoJogo(c) : null; return x && Array.isArray(x.armas) ? x.armas : []; }
/* v250: the runes and the unique weapons (class Rune) belong to no hero: any hero may carry one, so a feat that asks for one
   can always be done; only a class of a hero's own weapon, that this hero does not use, makes the feat impossible */
const armaGenerica = k => !HEROIS_JOGO.some(hj => (hj.classes || []).includes(k));
const armaServe = (k, m) => armaGenerica(k) || m.includes(k);
function avisoDeArmaDaFacanha(id, hid) { const a = armasDaFacanha(id); if (!a.length) return ''; const m = maosDe(hid); if (a.some(k => armaServe(k, m))) return '';
  return tr('It asks for') + ' ' + a.map(k => tr(NOME_CLASSE[k])).join(' / ') + ', ' + tr('which') + ' ' + nomeDoPerfil(hid) + ' ' + tr('does not use: this feat can never be done.'); }
function abrirProezas(hid, fid) { abaF = 'herois'; heroiSel = PROEZAS + hid; fichaSel = fid || null; $('#telaFichas').hidden = false; renderFichas(); }
const nomeDaFacanhaId = id => { const f = (oficina().facanhas || []).find(x => x.id === id); if (f) return nomeFacanha(f); const c = facanhaDoJogo(id); return c ? (partesDoTexto(c.desc_en).nome || id) : id; };
/* a feat for this hero: its own (by id), or a copy of one of another hero */
function facanhaParaHeroi(hid, fonte) {
  const pool = poolDasFacanhas();
  if (fonte.f) { if (fonte.f.heroi === hid) { if (!pool.includes(fonte.f.id)) pool.push(fonte.f.id); return fonte.f.id; }
    const d = clone(fonte.f); d.id = 'B_' + uid(); d.base = null; d.custom = true; d.heroi = hid; d.origem = fonte.f.origem || fonte.f.base || fonte.f.id; d.extrasConhecidos = true; d.textoAuto = fonte.f.base && !fonte.f.custom ? false : fonte.f.textoAuto; if (!d.premios) d.premios = [...(fonte.f.premiosJogo || [])]; delete d.premiosJogo; delete d.outrosPremios; d.premios = (d.premios || []).filter(p => !heroiDaPericiaPorId(p) || heroiDaPericiaPorId(p) === hid);
    oficina().facanhas.push(d); pool.push(d.id); return d.id; }
  const c = fonte.c; if ((c.HeroSource && c.HeroSource.id) === hid) { if (!pool.includes(c._id)) pool.push(c._id); return c._id; }
  const d = facanhaDoCatalogo(c); d.id = 'B_' + uid(); d.base = null; d.custom = true; d.heroi = hid; d.origem = c._id; d.extrasConhecidos = true; d.textoAuto = false; if (!d.premios) d.premios = [...(d.premiosJogo || [])]; delete d.premiosJogo; delete d.outrosPremios;
  d.premios = (d.premios || []).filter(p => !heroiDaPericiaPorId(p) || heroiDaPericiaPorId(p) === hid);
  oficina().facanhas.push(d); pool.push(d.id); return d.id;
}
/* v234: every feat, with no hero (the game's and the workshop's own; the copies made for a hero are that hero's): the column
   on the left of a hero's feats. A click adds it to the hero (one of another hero comes as a copy). */
let _buscaProezas = '';
const origemDaFacanha = id => { const f = (oficina().facanhas || []).find(x => x.id === id); return f ? (f.origem || f.base || f.id) : id; };
function todasAsProezas() {
  const importadas = new Set((oficina().facanhas || []).map(f => f.base).filter(Boolean));
  const proprias = (oficina().facanhas || []).filter(f => !f.origem).map(f => ({ chave: f.base || f.id, fonte: { f }, nome: nomeFacanha(f), texto: semTagsFacanha(f.texto || ''), tier: f.precisa || 0, armas: (f.filtros && f.filtros.armas) || [], propria: !f.base }));
  const doJogo = (CAT.facanhas || []).filter(c => !importadas.has(c._id)).map(c => ({ chave: c._id, fonte: { c }, nome: partesDoTexto(c.desc_en).nome || c._id, texto: semTagsFacanha(partesDoTexto(c.desc_en).corpo), tier: c.AmountCompletedRequired || 0, armas: filtrosDoJogo(c).armas || [], propria: false }));
  return proprias.concat(doJogo).sort((a, b) => a.tier - b.tier || a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' }));
}
function colunaDeTodasAsProezas(el, hid) {
  const tem = new Set(facanhasDoHeroi(hid).map(origemDaFacanha)); const m = maosDe(hid);
  el.innerHTML = `<div class="sub">${esc(tr('Every feat'))}</div><input type="search" id="fp_busca" placeholder="${esc(tr('Search a feat…'))}" value="${esc(_buscaProezas)}">
    <p class="ajuda">${esc(tr('Click a feat to add it to this hero.'))}</p><div class="listaTodas"></div>`;
  const lista = el.querySelector('.listaTodas');
  const pintar = () => { const q = semAcento(_buscaProezas.trim().toLowerCase()); let tierAntes = null;
    lista.innerHTML = todasAsProezas().filter(x => !q || semAcento((x.nome + ' ' + x.texto).toLowerCase()).includes(q)).map(x => {
      const ja = tem.has(x.chave); const ruim = x.armas.length && !x.armas.some(k => armaServe(k, m));
      const cab = x.tier !== tierAntes ? `<div class="tierTodas">Tier ${x.tier}</div>` : ''; tierAntes = x.tier;
      return cab + `<button class="proezaTodas ${ja ? 'ja' : ''} ${ruim ? 'erro' : ''}" data-todas="${esc(x.chave)}" ${ja ? 'disabled' : ''} title="${esc(x.texto)}"><span data-sem-traducao>${esc(x.nome)}</span>${x.propria ? ` <small class="etq custom">${esc(tr('custom feat'))}</small>` : ''}${ruim ? ` <small class="avisoVermelho">${esc(x.armas.map(k => tr(NOME_CLASSE[k])).join(' / '))}</small>` : ''}<i>${ja ? '✓' : '+'}</i></button>`; }).join('') || `<p class="ajuda">${esc(tr('No feat found.'))}</p>`;
    lista.querySelectorAll('[data-todas]').forEach(b => b.onclick = () => { const x = todasAsProezas().find(y => y.chave === b.dataset.todas); if (!x) return;
      const topo = lista.scrollTop; const id = facanhaParaHeroi(hid, x.fonte); abrirProezas(hid, id); const l2 = document.querySelector('.listaTodas'); if (l2) l2.scrollTop = topo;
      const ruim = avisoDeArmaDaFacanha(id, hid); if (ruim) aviso(ruim); }); };
  pintar();
  el.querySelector('#fp_busca').oninput = e => { _buscaProezas = e.target.value; pintar(); };
}
/* v234: the feats of the hero, compact, on the hero's sheet (under the weapons): by tier; red when the weapon does not fit */
const tierDaFacanhaId = id => { const f = (oficina().facanhas || []).find(x => x.id === id); if (f) return f.precisa || 0; const c = facanhaDoJogo(id); return (c && c.AmountCompletedRequired) || 0; };
/* v237: the feats of a hero by tier, as the game lays them out (each hero has 6 in tier 0, 6 in tier 4, 4 in tier 8, 2 in tier
   12 and 2 in tier 14): a square for each feat and an empty one for each place the tier still lacks; a tier of a custom feat
   outside these comes in its own row */
const TIERS_DO_JOGO = [[0, 6], [4, 6], [8, 4], [12, 2], [14, 2]];
function proezasPorTier(hid) {
  const por = new Map(TIERS_DO_JOGO.map(([t, n]) => [t, { t, n, ids: [] }]));
  facanhasDoHeroi(hid).forEach(id => { const t = tierDaFacanhaId(id); if (!por.has(t)) por.set(t, { t, n: 0, ids: [] }); por.get(t).ids.push(id); });
  return [...por.values()].sort((a, b) => a.t - b.t).map((g, k) => ({ ...g, cor: Math.min(4, TIERS_DO_JOGO.findIndex(([t]) => t >= g.t) < 0 ? 4 : TIERS_DO_JOGO.findIndex(([t]) => t >= g.t)) }));
}
/* the squares of a tier: comBotao, the feats open with a click (the hero's sheet); otherwise plain marks (a tier's header) */
function casasDoTier(g, hid, comBotao) {
  const cheias = g.ids.map(id => { const ruim = avisoDeArmaDaFacanha(id, hid); const nome = nomeDaFacanhaId(id); const tit = esc(nome + (ruim ? ' · ' + ruim : ''));
    return comBotao ? `<button class="casaProeza c${g.cor} ${ruim ? 'erro' : ''}" data-rolp="${esc(id)}" title="${tit}" data-sem-traducao>${esc((nome.trim()[0] || '?').toUpperCase())}</button>`
      : `<span class="casaProeza c${g.cor} ${ruim ? 'erro' : ''}" title="${tit}"></span>`; });
  const vazias = Array.from({ length: Math.max(0, g.n - g.ids.length) }, () => comBotao ? `<button class="casaProeza vazia" data-rolp="" title="${esc(tr('An empty place in this tier: define a feat'))}"></button>` : '<span class="casaProeza vazia"></span>');
  return cheias.concat(vazias).join('');
}
function rolDeProezas(hid) {
  const gs = proezasPorTier(hid); const n = gs.reduce((a, g) => a + g.ids.length, 0), total = gs.reduce((a, g) => a + Math.max(g.n, g.ids.length), 0);
  return `<div class="rolProezas"><div class="cabRol"><span>✦ ${esc(tr('Feats'))} <span class="etq">${n}/${total}</span></span><button class="sm" data-rolp="">${esc(tr('Define feats'))}</button></div>
    <div class="piramideProezas">${gs.map(g => `<div class="linhaTier ${g.ids.length < g.n ? 'falta' : ''}"><span class="rotTier">${g.t}</span><span class="casasTier">${casasDoTier(g, hid, true)}</span><span class="rotTier"></span></div>`).join('')}</div>
    ${n ? '' : `<small class="ajuda">${esc(tr('None defined: the game offers this hero its own.'))}</small>`}</div>`;
}
/* the feats of a hero: the list (each with its warning), and the sheet of the one picked */
const _tiersAbertos = new Set();
function painelDeProezas(c, hid) {
  const ids = facanhasDoHeroi(hid); if (fichaSel && !ids.includes(fichaSel)) fichaSel = null;
  const fora = (oficina().facanhas || []).filter(f => f.heroi === hid && !ids.includes(f.id));
  c.innerHTML = `<div class="proezasDuas"><aside class="todasProezas" id="fp_todas"></aside><div class="proezasDoHeroi">
    <div class="cabF"><h2>${esc(tr('Feats of'))} ${esc(nomeDoPerfil(hid))} <span class="etq">${ids.length}</span></h2><div class="botoes"><button class="sm" id="fp_volta">◂ ${esc(tr('The party'))}</button><button class="sm primario" id="fp_nova">+ ${esc(tr('New feat'))}</button></div></div>
    <p class="ajuda">${esc(ids.length ? tr('The feats the game offers this hero, two at a time, as their tier allows. Add more from the column on the left.') : tr('No feat defined: the game offers this hero its own feats. Add feats from the column on the left to choose them.'))}</p>
    <div class="tiersProezas">${proezasPorTier(hid).map(g => { const falta = Math.max(0, g.n - g.ids.length); const aberto = _tiersAbertos.has(hid + ':' + g.t) || g.ids.includes(fichaSel);
      return `<details class="tierProeza ${falta ? 'falta' : ''}" data-tier="${g.t}" ${aberto ? 'open' : ''}><summary><span class="nomeTier">Tier ${g.t}</span><span class="casasTier">${casasDoTier(g, hid, false)}</span><small>${falta ? esc(falta + ' ' + tr(falta > 1 ? 'places empty' : 'place empty')) : g.ids.length ? '✓' : ''}</small></summary>
        <div class="listaProezas">${g.ids.map(id => { const f = (oficina().facanhas || []).find(x => x.id === id); const ruim = avisoDeArmaDaFacanha(id, hid);
          return `<div class="no proeza ${fichaSel === id ? 'ativo' : ''} ${ruim ? 'erro' : ''}" data-fac="${esc(id)}"><div><div data-sem-traducao>${esc(nomeDaFacanhaId(id))}</div><small>${f ? esc(resumoFacanha(f)) + (f.base ? ' · ' + esc(tr('from the game')) : ' · ' + esc(tr('custom'))) : esc(tr('of the game, as it is'))}</small>${ruim ? `<small class="avisoVermelho">${esc(ruim)}</small>` : ''}</div><button class="sm" data-facx="${esc(id)}" title="${esc(tr('Take it out of this hero’s feats'))}">✕</button></div>`; }).join('') || `<p class="ajuda">${esc(tr('No feat in this tier: add one from the column on the left (its tier is set on its sheet).'))}</p>`}</div></details>`; }).join('')}</div>
    ${fora.length ? `<div class="sub">${esc(tr('Feats of this hero in the workshop, not offered'))}</div><div>${fora.map(f => `<span class="tag">${esc(nomeFacanha(f))} <a href="#" data-facin="${esc(f.id)}">+</a></span>`).join(' ')}</div>` : ''}
    <div id="fp_ficha"></div></div></div>`;
  colunaDeTodasAsProezas($('#fp_todas'), hid);
  $('#fp_volta').onclick = () => { heroiSel = EQUIPE; fichaSel = null; renderHerois(); };
  $('#fp_nova').onclick = () => novaFacanha(hid);
  c.querySelectorAll('details[data-tier]').forEach(d => d.ontoggle = () => { const k = hid + ':' + d.dataset.tier; if (d.open) _tiersAbertos.add(k); else _tiersAbertos.delete(k); });
  c.querySelectorAll('[data-fac]').forEach(d => d.onclick = e => { if (e.target.closest('[data-facx]')) return; fichaSel = d.dataset.fac; renderHerois(); });
  c.querySelectorAll('[data-facx]').forEach(b => b.onclick = () => { oficina().poolFacanhas = poolDasFacanhas().filter(id => id !== b.dataset.facx); if (fichaSel === b.dataset.facx) fichaSel = null; renderHerois(); });
  c.querySelectorAll('[data-facin]').forEach(a => a.onclick = ev => { ev.preventDefault(); poolDasFacanhas().push(a.dataset.facin); fichaSel = a.dataset.facin; renderHerois(); });
  if (!fichaSel) return; const el = $('#fp_ficha');
  const f = (oficina().facanhas || []).find(x => x.id === fichaSel);
  if (f) { fichaFacanha(el, f); return; }
  // (a feat of the game in the pool, not brought in: its text; a copy to change it)
  const cj = facanhaDoJogo(fichaSel); if (!cj) return;
  el.innerHTML = `<div class="cabF"><h2 data-sem-traducao>${esc(nomeDaFacanhaId(fichaSel))} <span class="etq">${esc(tr('the game’s'))}</span></h2><div class="botoes"><button class="sm primario" id="ff_trazer">⧉ ${esc(tr('Duplicate'))}</button></div></div><p>${esc(semTagsFacanha(partesDoTexto(cj.desc_en).corpo))}</p>`;
  $('#ff_trazer').onclick = () => { const id = fichaSel; oficina().poolFacanhas = poolDasFacanhas().filter(x => x !== id); const d = facanhaDoCatalogo(cj); d.id = 'B_' + uid(); d.base = null; d.custom = true; d.heroi = hid; d.textoAuto = false; delete d.premiosJogo; oficina().facanhas.push(d); poolDasFacanhas().push(d.id); abrirProezas(hid, d.id); };
}

function renderFacanhas() {
  if (abaF !== 'facanhas') return renderHerois();   // (v232: the feats are in the heroes tab)
  const lista = oficina().facanhas; if (fichaSel && !lista.some(x => x.id === fichaSel)) fichaSel = null;
  const esq = $('#esqF');
  esq.innerHTML = `<div class="bloco"><h2>Feats <span class="etq">${lista.length}</span></h2>
    <div class="botoes"><button class="sm" id="f_importarF">Import…</button><button class="sm primario" id="f_novaF">+ New feat</button></div>
    <p class="ajuda">A feat is a goal a hero pursues during the quests (attack with a spear 5 times, open 3 chests…). The game counts it by itself and gives the reward when it is done. Import the game’s feats (they stay as in the game; duplicate one to change it), or write new ones for any hero.</p>
    <div id="f_lista"></div></div>
    <div class="bloco"><h2>Feat pool</h2><p class="ajuda">For each hero with a feat here, the game offers only these (the feats already in progress keep going). Heroes with none here keep the game’s feats.</p><div id="f_poolF"></div></div>`;
  const l = $('#f_lista');
  botaoDeFiltro(esq.querySelector('.bloco'), lista, renderFacanhas);
  const ordem = lista.filter(f => HEROIS_IDS.includes(f.heroi)).sort((a, b) => HEROIS_IDS.indexOf(a.heroi) - HEROIS_IDS.indexOf(b.heroi));
  listaEmGrupos(l, ordem, f => {
      const d = document.createElement('div'); d.className = 'no' + (fichaSel === f.id ? ' ativo' : ''); const r = retratoDoPerfil(f.heroi);
      d.innerHTML = `${r ? `<img class="face" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="face"></span>'}<div><div>${esc(nomeFacanha(f))}</div><small>${esc(resumoFacanha(f))}${f.base ? (f.custom ? ' · changed' : ' · from the game') : ' · custom'}${(oficina().poolFacanhas || []).includes(f.id) ? ' · in the pool' : ''}</small></div>`;
      d.onclick = () => { fichaSel = f.id; renderFacanhas(); }; return d;
  }, f => [f.heroi, nomeDoPerfil(f.heroi)]);
  widgetPoolFacanhas($('#f_poolF'));
  $('#f_importarF').onclick = importarFacanha; $('#f_novaF').onclick = novaFacanha;
  const f = lista.find(x => x.id === fichaSel); const c = $('#centroF');
  if (!f) { c.innerHTML = '<div class="vazio"><h2>Feats</h2><p>Pick a feat on the left, import one from the game, or write a new one.</p></div>'; return; }
  fichaFacanha(c, f);
}
function resumoFacanha(f) { const m = MOMENTOS_FACANHA.find(x => x[0] === f.momento); return (f.filtros?.danoTotal ? f.meta + ' damage' : f.meta + '×') + ' · ' + (m ? m[1].toLowerCase() : '?'); }

/* the pool: workshop feats and feats of the game not imported */
function widgetPoolFacanhas(el) {
  const pool = oficina().poolFacanhas = oficina().poolFacanhas || [];
  const oficinaF = oficina().facanhas;
  const nomeNoPool = id => { const f = oficinaF.find(x => x.id === id); if (f) return nomeDoPerfil(f.heroi) + ': ' + nomeFacanha(f); const c = facanhaDoJogo(id); return c ? nomeDoPerfil(c.HeroSource?.id) + ': ' + (partesDoTexto(c.desc_en).nome || id) + L2(' (game)', ' (jogo)') : id; };
  const importadas = new Set(oficinaF.map(f => f.base).filter(Boolean));
  const opcoes = HEROIS_IDS.map(h => { const ws = oficinaF.filter(f => f.heroi === h && !pool.includes(f.id)); const gs = (CAT.facanhas || []).filter(c => c.HeroSource?.id === h && !importadas.has(c._id) && !pool.includes(c._id));
    return ws.length + gs.length ? `<optgroup label="${esc(nomeDoPerfil(h))}">${ws.map(f => `<option value="${esc(f.id)}">${esc(nomeFacanha(f))} ${L2('(workshop)', '(oficina)')}</option>`).join('')}${gs.map(c => `<option value="${esc(c._id)}">${esc(partesDoTexto(c.desc_en).nome || c._id)} ${L2('(game)', '(jogo)')}</option>`).join('')}</optgroup>` : ''; }).join('');
  el.innerHTML = `<div class="linha"><select class="poolAdd"><option value="">+ add a feat…</option>${opcoes}</select>${oficinaF.some(f => !pool.includes(f.id)) ? '<button class="sm" data-todas>All workshop feats</button>' : ''}</div>
    <div>${pool.map((id, i) => `<span class="tag">${esc(nomeNoPool(id))} <a href="#" data-pooldel="${i}">✕</a></span>`).join('') || '<span class="ajuda">empty: the game offers its own feats</span>'}</div>`;
  el.querySelector('.poolAdd').onchange = e => { if (e.target.value && !pool.includes(e.target.value)) pool.push(e.target.value); renderFacanhas(); };
  const t = el.querySelector('[data-todas]'); if (t) t.onclick = () => { oficinaF.forEach(f => { if (!pool.includes(f.id)) pool.push(f.id); }); renderFacanhas(); };
  el.querySelectorAll('[data-pooldel]').forEach(a => a.onclick = ev => { ev.preventDefault(); pool.splice(+a.dataset.pooldel, 1); renderFacanhas(); });
}

function importarFacanha() {
  const ja = new Set(oficina().facanhas.map(f => f.base));
  const lista = (CAT.facanhas || []).slice().sort((a, b) => HEROIS_IDS.indexOf(a.HeroSource?.id) - HEROIS_IDS.indexOf(b.HeroSource?.id) || (a._act - b._act) || (partesDoTexto(a.desc_en).nome || '').localeCompare(partesDoTexto(b.desc_en).nome || ''));
  modalImportacao('Import feats of the game', lista.map(c => ({ c, nome: nomeDoPerfil(c.HeroSource?.id) + ': ' + (partesDoTexto(c.desc_en).nome || c._id), img: retratoDoPerfil(c.HeroSource?.id), sub: (ACT_NOME[c._act || 0] || '') + ' · ' + semTagsFacanha(partesDoTexto(c.desc_en).corpo).slice(0, 90), ja: ja.has(c._id) })), escolhidas => {
    const novas = escolhidas.map(({ c }) => facanhaDoCatalogo(c)); novas.forEach(f => oficina().facanhas.push(f)); if (novas[0]) fichaSel = novas[0].id; renderFacanhas();
    aviso(novas.length === 1 ? 'Feat imported. Change it if you like.' : novas.length + ' feats imported.');
  }, [{ nome: 'Act', opcoes: [[0, ACT_NOME[0]], [1, ACT_NOME[1]]], de: e => e.c._act || 0 },
      { nome: 'Hero', opcoes: HEROIS_IDS.map(h => [h, nomeDoPerfil(h)]), de: e => e.c.HeroSource?.id || '' },
      { nome: 'When', opcoes: MOMENTOS_FACANHA.map(([v, n]) => [v, n]), de: e => e.c.Timing || 1 }]);
}
const semTagsFacanha = t => (t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------ the conditions, as the game checks them
   Each moment of counting has what the game knows then: the hero (all but item gains), the monster (attacks and defeats),
   the damage (the hero's attacks), the object (interactions), the items, the end of the quest. A condition that needs what
   the moment lacks never holds, so the sheet offers only the ones that fit (FeatsController.CheckParameters). */
const COM_HEROI = [1, 2, 3, 4, 5, 7, 8, 9, 10], COM_MONSTRO = [1, 2, 4, 9, 10], COM_DANO = [1, 9, 10], COM_OBJETO = [5, 9], POR_RODADA = [1, 4, 5, 9, 10], QUALQUER_HEROI = [1, 4, 6, 9, 10];
/* k: the key in f.filtros (the game's own name for the new ones); tipo: lista (ticks), sel (one of), sim (on/off: two
   readings), liga (on only), num (a number); g: group; em: the moments it fits */
const CONDICOES_FEITO = [
  { k: 'armas', g: 'Hero', tipo: 'lista', nome: 'With these weapons', lista: () => CLASSES_ARMA, em: COM_HEROI, ajuda: 'Counts only while the hero fights with a weapon of one of the ticked kinds (the one in hand at that moment).' },
  { k: 'AttackWithBothWeapons', g: 'Hero', tipo: 'liga', nome: 'Has used both weapons this round', em: COM_HEROI, ajuda: 'Counts only if the hero has already attacked with the other weapon this round: an attack with each weapon in the same round.' },
  { k: 'lesao', g: 'Hero', tipo: 'sel', nome: 'The hero’s health', em: COM_HEROI, ajuda: 'The hero’s health at that moment. “At least” also counts a worse state (a major injury is at least a minor one); “exactly” counts that state only.' },
  { k: 'HeroAttackedThisRound', g: 'Hero', tipo: 'sim', nome: 'The hero attacked this round', sim: ['Has already attacked this round', 'Has not attacked yet this round'], em: COM_HEROI, ajuda: 'Whether this hero has already attacked some monster earlier this round.' },
  { k: 'AnyHeroInjured', g: 'Hero', tipo: 'sim', nome: 'Some hero injured', sim: ['Some hero is injured', 'No hero is injured'], em: COM_HEROI, ajuda: 'Whether some hero of the party has an injury at that moment (at the moment “When the hero is hurt”, the hero being hurt does not count).' },
  { k: 'AnyOtherHeroInjured', g: 'Hero', tipo: 'sim', nome: 'Another hero injured', sim: ['Another hero is injured', 'No other hero is injured'], em: COM_HEROI, ajuda: 'Whether some hero other than this one has an injury at that moment.' },
  { k: 'AnyHero', g: 'Hero', tipo: 'liga', nome: 'Any hero’s action counts (not only this hero’s)', em: QUALQUER_HEROI, ajuda: 'The action of any hero counts toward this hero’s feat (attack, defeat, items gained), not only this hero’s own.' },
  { k: 'FirstAttackOfRound', g: 'Round', tipo: 'sim', nome: 'Attacks this round', sim: ['Before any hero attacks this round', 'After some hero attacked this round'], em: COM_HEROI, ajuda: 'Whether some hero has already attacked this round. “Before” counts only the first attack of the round.' },
  { k: 'FirstInteractionOfRound', g: 'Round', tipo: 'sim', nome: 'Interactions this round', sim: ['Before any hero interacts this round', 'After some hero interacted this round'], em: COM_HEROI, ajuda: 'Whether some hero has already interacted this round. “Before” counts only the first interaction of the round.' },
  { k: 'AllOtherHeroesDidDamageThisRound', g: 'Round', tipo: 'sim', nome: 'The other heroes attacked this round', sim: ['Every other hero attacked this round', 'Not every other hero attacked this round'], em: COM_HEROI, ajuda: 'Whether every other hero of the party has already attacked this round.' },
  { k: 'AllHeroesDidDamageThisRound', g: 'Round', tipo: 'sim', nome: 'Every hero attacked this round', sim: ['Every hero attacked this round', 'Not every hero attacked this round'], em: COM_HEROI, ajuda: 'Whether every hero of the party, this one included, has already attacked this round.' },
  { k: 'EnemiesOnMap', g: 'Round', tipo: 'num', nome: 'At least this many monsters on the map', min: 1, em: COM_HEROI, ajuda: 'Counts only while there are at least this many monsters on the map.' },
  { k: 'inimigos', g: 'Monster', tipo: 'lista', nome: 'Against these monsters', lista: () => TIPOS_MONSTRO, em: COM_MONSTRO, ajuda: 'Counts only against monsters of one of the ticked kinds.' },
  { k: 'condicao', g: 'Monster', tipo: 'sel', nome: 'The monster has a condition', em: COM_MONSTRO, ajuda: 'Counts only against a monster that has this condition at that moment.' },
  { k: 'StatusCount', g: 'Monster', tipo: 'num', nome: 'The monster has at least this many conditions', min: 1, em: COM_MONSTRO, ajuda: 'Counts only against a monster with at least this many conditions at once.' },
  { k: 'DamagedEnemy', g: 'Monster', tipo: 'sim', nome: 'The monster already damaged', sim: ['The monster is already damaged', 'The monster is undamaged'], em: COM_MONSTRO, ajuda: 'Whether the monster had already lost some health.' },
  { k: 'mesmoInimigo', g: 'Monster', tipo: 'sim', nome: 'The same monster this round', sim: ['The same monster the hero attacked before this round', 'A different monster from the one attacked before this round'], em: COM_MONSTRO, ajuda: 'Compares with the monsters this hero attacked earlier this round. The first attack of the round always counts.' },
  { k: 'FirstTimeAttackedByHero', g: 'Monster', tipo: 'sim', nome: 'First attack on this monster', sim: ['The first time this hero attacks this monster', 'The hero has attacked this monster before'], em: COM_MONSTRO, ajuda: 'Whether this hero is attacking this monster for the first time in the quest.' },
  { k: 'OtherHeroDidDamage', g: 'Monster', tipo: 'sim', nome: 'Other heroes attacked this monster', sim: ['Another hero also attacked this monster', 'Only this hero attacked this monster'], em: COM_MONSTRO, ajuda: 'Whether another hero has also attacked this monster.' },
  { k: 'EnemyWasAttackedThisRound', g: 'Monster', tipo: 'liga', nome: 'No hero attacked this monster yet this round', em: COM_MONSTRO, ajuda: 'Counts only if no hero has attacked this monster yet this round.' },
  { k: 'EnemyHasTactic', g: 'Monster', tipo: 'sim', nome: 'The monster’s tactic', sim: ['The monster has a tactic', 'The monster has no tactic'], em: COM_MONSTRO, ajuda: 'Whether the monster has a tactic card.' },
  { k: 'DiedFromAffliction', g: 'Monster', tipo: 'sim', nome: 'Defeated by affliction', sim: ['Defeated by affliction', 'Not defeated by affliction'], em: [4], ajuda: 'Whether the monster was defeated by the damage of the Afflicted condition (not by an attack).' },
  { k: 'danoMinimo', g: 'Damage', tipo: 'num', nome: 'Minimum damage of the attack', min: 1, em: COM_DANO, ajuda: 'Counts only an attack that deals at least this much damage.' },
  { k: 'objeto', g: 'Object', tipo: 'sel', nome: 'Interacting with', em: COM_OBJETO, ajuda: 'Counts only interactions with this kind of object. Without this condition, every object counts except the sight tokens.' },
  { k: 'RequireObjectRemove', g: 'Object', tipo: 'liga', nome: 'The object leaves the board (opened, taken, put out)', em: COM_OBJETO, ajuda: 'Counts only when the object leaves the board with the interaction (a chest opened and gone, a token taken, a fire put out).' },
  { k: 'FirstTimeInteracted', g: 'Object', tipo: 'sim', nome: 'First interaction with the object', sim: ['An object nobody interacted with yet', 'An object already interacted with'], em: COM_OBJETO, ajuda: 'Whether the object had already been interacted with in this quest (by any hero).' },
  { k: 'itens', g: 'Items', tipo: 'lista', nome: 'Gaining these items', lista: () => TIPOS_ITEM_FACANHA, em: [6], ajuda: 'Counts only the items of the ticked kinds.' },
  { k: 'vitoria', g: 'Quest', tipo: 'sim', nome: 'The quest ends in', sim: ['Victory', 'Defeat'], em: [8], ajuda: 'Counts only if the quest ends this way.' },
];
const GRUPOS_FEITO = [['Hero', 'The hero'], ['Round', 'The round'], ['Monster', 'The monster'], ['Damage', 'The damage'], ['Object', 'The object'], ['Items', 'The items'], ['Quest', 'The quest']];
/* how the goal counts: one of these (the game takes the last one switched on, so only one) */
const CONTAGENS_FEITO = [
  { k: 'vezes', nome: 'Times', em: null, ajuda: 'Each time the moment comes and every condition holds, it counts one.' },
  { k: 'dano', nome: 'Damage dealt, in total', em: COM_DANO, ajuda: 'The damage of each counted attack is added up until it reaches the goal.' },
  { k: 'fraqueza', nome: 'Damage from weaknesses, in total', em: COM_DANO, ajuda: 'Only the damage that comes from the monster’s weaknesses is added up.' },
  { k: 'excesso', nome: 'Damage from weaknesses beyond the monster’s health, in total', em: COM_DANO, ajuda: 'Only the weakness damage beyond the health the monster had left is added up (the damage “wasted” on the kill).' },
  { k: 'naRodada', nome: 'Rounds in which it happens a number of times', em: POR_RODADA, n: 'Times in the same round', ajuda: 'A round counts one when it happens that many times in the same round.' },
  { k: 'seguidas', nome: 'Rounds in a row in which it happens', em: POR_RODADA, n: 'From the round number', ajuda: 'It must happen at least once every round; from that round in a row on, each round counts one. A round without it starts the streak over.' },
];
const EXTRAS_FEITO = CONDICOES_FEITO.filter(d => /^[A-Z]/.test(d.k)).map(d => d.k).concat(['ExcessWeaknessDamage', 'AmountOfTimeDuringRound', 'ForAmountOfRounds']);
const ativaCond = (x, d) => d.tipo === 'lista' ? !!(x[d.k] && x[d.k].length) : d.k === 'danoMinimo' ? (x.danoMinimo || 0) > 0 : d.tipo === 'liga' ? !!x[d.k] : x[d.k] !== null && x[d.k] !== undefined;
const contagemDe = x => x.danoTotal ? 'dano' : x.fraqueza ? 'fraqueza' : x.ExcessWeaknessDamage ? 'excesso' : x.AmountOfTimeDuringRound ? 'naRodada' : x.ForAmountOfRounds ? 'seguidas' : 'vezes';
function porContagem(x, k, n) { x.danoTotal = k === 'dano'; x.fraqueza = k === 'fraqueza'; x.ExcessWeaknessDamage = k === 'excesso' || null; x.AmountOfTimeDuringRound = k === 'naRodada' ? Math.max(1, n || 2) : null; x.ForAmountOfRounds = k === 'seguidas' ? Math.max(1, n || 2) : null; }
/* what stops fitting when the moment changes: taken out (and said) */
function ajustarAoMomento(f) {
  const x = f.filtros, fora = [];
  CONDICOES_FEITO.forEach(d => { if (ativaCond(x, d) && !d.em.includes(f.momento)) { fora.push(tr(d.nome)); x[d.k] = d.tipo === 'lista' ? null : d.k === 'danoMinimo' ? 0 : null; } });
  const ct = CONTAGENS_FEITO.find(z => z.k === contagemDe(x)); if (ct && ct.em && !ct.em.includes(f.momento)) { fora.push(tr(ct.nome)); porContagem(x, 'vezes'); }
  return fora;
}

/* ------------------------------------------------------------ v235: the text of a feat, made from its rules
   The text is not typed: it is put together from the moment, the conditions and the way of counting, in the language of
   the work (pt or en), like the game's own ("Ataque com seu arco um inimigo que ainda não sofreu dano"):
     1. the verb of the moment (Ataque, Derrote, Interaja, Ganhe, Sofra, Termine uma rodada, Vença uma missão…), in the
        imperative, or "Qualquer herói ataca…" when any hero's action counts;
     2. the weapon (com seu arco; "Usando seu martelo," before the verb when the monster has a clause of its own);
     3. what the action is done to: the monster (um inimigo, do tipo Lobo, with its clauses "que esteja exposto", "que
        ainda não sofreu dano"…), the object (um baú, uma porta ou portão…) or the items (um consumível…);
     4. the damage (pelo menos N de dano em um único ataque; dano a inimigos… in total; a fraqueza do inimigo);
     5. the count inside a round or across rounds (três vezes na mesma rodada; em duas rodadas seguidas; N inimigos
        diferentes na mesma rodada);
     6. the clauses of the hero and of the round (estando ferido; enquanto houver inimigos no mapa; antes que qualquer
        herói ataque nesta rodada…), after a comma.
   The goal (how many times, how much damage) is not in the text: the game shows it as the feat's progress. */
const GRAM_FEITO = {
  pt: {
    classes: [['martelo', 'm'], ['besta', 'f'], ['espada', 'f'], ['martelo de guerra', 'm'], ['sino de guerra', 'm'], ['lança', 'f'], ['varinha', 'f'], ['cajado', 'm'], ['manopla', 'f'], ['facas de arremesso', 'fp'], ['espadas duplas', 'fp'], ['arco', 'm'], ['arma rúnica', 'f']],
    tipos: ['Berserker', 'Bandido', 'Zelote', 'Golem', 'Feérico', 'Lobo', 'Espectro', 'Inumano', 'Arauto', 'Centurião', 'Irmã de sangue', 'Arauto da ruína', 'Dragão', 'Salamandra', 'Vampiro', 'Reanimado', 'Legionário', 'Mercenário'],
    cond: { 1: ['confuso', 'confusos'], 2: ['febril', 'febris'], 4: ['atormentado', 'atormentados'], 8: ['atrasado', 'atrasados'], 16: ['exposto', 'expostos'], 32: ['condenado', 'condenados'], 64: ['desorientado', 'desorientados'] },
    objetos: [null, 'um baú', 'uma estante', 'um apoio de livro', 'um poço', 'um caldeirão', 'uma porta ou portão', 'um marcador de vista', 'um sino', 'um altar', 'um fogo', 'uma escada de mão', 'uma estátua', 'uma carroça', 'uma cripta', 'uma plataforma'],
    itens: ['materiais', 'um consumível', 'uma armadura', 'um apetrecho', 'uma parte de arma', 'uma receita'],
    num: { m: ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'], f: ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'] },
  },
  en: {
    classes: [['hammer'], ['crossbow'], ['sword'], ['war hammer'], ['warbell'], ['spear'], ['wand'], ['staff'], ['gauntlet'], ['throwing knives', 'p'], ['dual blades', 'p'], ['bow'], ['rune weapon']],
    tipos: ['Berserker', 'Bandit', 'Zealot', 'Golem', 'Fae', 'Wolf', 'Specter', 'Wight', 'Harbinger', 'Centurion', 'Bloodsister', 'Doomcaller', 'Dragon', 'Salamander', 'Vampire', 'Reanimate', 'Legionnaire', 'Mercenary'],
    cond: { 1: 'dazed', 2: 'enfeebled', 4: 'afflicted', 8: 'slowed', 16: 'exposed', 32: 'doomed', 64: 'confused' },
    objetos: [null, 'a chest', 'a shelf', 'a lectern', 'a well', 'a cauldron', 'a door or gate', 'a sight token', 'a bell', 'an altar', 'a fire', 'a ladder', 'a statue', 'a wagon', 'a vault', 'a platform'],
    itens: ['materials', 'a consumable', 'an armor', 'a trinket', 'a weapon part', 'a recipe'],
    num: { m: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] },
  },
};
const ouLista = (l, ou) => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' ' + ou + ' ' + l[l.length - 1];
const eLista = (l, e) => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' ' + e + ' ' + l[l.length - 1];
/* the feat's text (without the name), in the language given ('pt' | 'en'; the work's language by default) */
function textoDaRegra(f, lingua) {
  const L = /^pt/.test(lingua || LE2('en', 'pt')) ? 'pt' : 'en', G = GRAM_FEITO[L], pt = L === 'pt';
  const x = f.filtros || {}, m = f.momento || 1;
  const num = (n, g) => (G.num[g] || G.num.m)[n] || String(n);
  const ct = x.ExcessWeaknessDamage ? 'excesso' : x.fraqueza ? 'fraqueza' : contagemDe(x), cabe = k => { const d = CONDICOES_FEITO.find(z => z.k === k); return !!d && d.em.includes(m) && ativaCond(x, d); };
  const val = k => cabe(k) ? x[k] : null;
  const qualquer = !!val('AnyHero') && QUALQUER_HEROI.includes(m);
  const voce = qualquer ? (pt ? 'ele' : 'they') : (pt ? 'você' : 'you');
  // 1. the weapon
  const armas = [...new Set(val('armas') || [])].filter(k => G.classes[k]);
  const arma = armas.length ? ouLista(armas.map(k => { const [n, g] = G.classes[k];
    if (pt) return qualquer ? (g === 'fp' ? n : (g === 'f' ? 'uma ' : 'um ') + n) : ({ m: 'seu ', f: 'sua ', fp: 'suas ', mp: 'seus ' }[g] || 'seu ') + n;
    return qualquer ? (g === 'p' ? n : (/^[aeiou]/.test(n) ? 'an ' : 'a ') + n) : 'your ' + n; }), pt ? 'ou' : 'or') : '';
  // 3. the monster: an enemy, of these kinds, with its clauses; n > 1: that many (plural)
  const noRodada = ct === 'naRodada' && (x.AmountOfTimeDuringRound || 2) > 1 ? x.AmountOfTimeDuringRound || 2 : 0, seguidas = ct === 'seguidas' ? Math.max(1, x.ForAmountOfRounds || 2) : 0;
  const mesmo = val('mesmoInimigo');
  const clausulasDoMonstro = pl => { const r = [], cond = val('condicao'), st = val('StatusCount'), dano = val('DamagedEnemy'), pri = val('FirstTimeAttackedByHero'), outro = val('OtherHeroDidDamage'), tat = val('EnemyHasTactic');
    if (pt) {
      if (st) r.push((pl ? 'que tenham ' : 'que tenha ') + (st > 1 ? st + ' ou mais status' : 'algum status'));
      if (dano === true) r.push(pl ? 'que já sofreram dano' : 'que já sofreu dano'); else if (dano === false) r.push(pl ? 'que ainda não sofreram dano' : 'que ainda não sofreu dano');
      if (pri === true) r.push('que ' + voce + ' não atacou antes'); else if (pri === false) r.push('que ' + voce + ' já atacou antes');
      if (outro === true) r.push(pl ? 'que receberam dano de outro herói' : 'que recebeu dano de outro herói'); else if (outro === false) r.push('que só ' + voce + ' atacou');
      if (val('EnemyWasAttackedThisRound')) r.push(pl ? 'que ainda não foram atacados nesta rodada' : 'que ainda não foi atacado nesta rodada');
      if (tat === true) r.push(pl ? 'que têm uma tática' : 'que tem uma tática'); else if (tat === false) r.push(pl ? 'que não têm tática' : 'que não tem tática');
    } else {
      const ser = pl ? 'are' : 'is', ter = pl ? 'have' : 'has';
      if (st) r.push('that ' + ter + ' ' + (st > 1 ? st + ' or more conditions' : 'a condition'));
      if (dano === true) r.push('that ' + ter + ' already been damaged'); else if (dano === false) r.push('that ' + ter + ' not been damaged yet');
      if (pri === true) r.push('that ' + voce + ' have not attacked before'); else if (pri === false) r.push('that ' + voce + ' have attacked before');
      if (outro === true) r.push('that another hero has also damaged'); else if (outro === false) r.push('that only ' + voce + ' attacked');
      if (val('EnemyWasAttackedThisRound')) r.push('that ' + ter + ' not been attacked this round yet');
      if (tat === true) r.push('that ' + ter + ' a tactic'); else if (tat === false) r.push('that ' + ter + ' no tactic');
    }
    return r; };
  const tiposDoMonstro = () => { const t = (val('inimigos') || []).map(k => G.tipos[k]).filter(Boolean); if (!t.length) return '';
    return pt ? (t.length > 1 ? ' dos tipos ' : ' do tipo ') + ouLista(t, 'ou') : ' of type ' + ouLista(t, 'or'); };
  /* n: how many (0: one); semArtigo: the plural with no number (dano a inimigos…) */
  const monstro = (n, semArtigo) => { const pl = n > 1 || semArtigo; let base; const cd = val('condicao'), adj = cd != null && G.cond[cd] ? G.cond[cd] : null;
    if (pt) { const a = adj ? ' ' + adj[pl ? 1 : 0] : '';
      base = mesmo === true && !pl ? 'o mesmo inimigo' + a : (semArtigo ? 'inimigos' : pl ? num(n, 'm') + ' inimigos' : 'um inimigo') + a + (mesmo === false ? (pl ? ' diferentes' : ' diferente') : ''); }
    else { const a = adj ? adj + ' ' : '', um = /^[aeiou]/.test(a || 'enemy') ? 'an ' : 'a ';
      base = mesmo === true && !pl ? 'the same ' + a + 'enemy' : mesmo === false ? (semArtigo ? 'different ' + a + 'enemies' : pl ? num(n) + ' different ' + a + 'enemies' : 'a different ' + a + 'enemy')
        : semArtigo ? a + 'enemies' : pl ? num(n) + ' ' + a + 'enemies' : um + a + 'enemy'; }
    const cl = clausulasDoMonstro(pl);
    let s = base + tiposDoMonstro() + (cl.length ? ' ' + eLista(cl, pt ? 'e' : 'and') : '');
    if (mesmo === true && !pl && !noRodada && !seguidas) s += pt ? ' que ' + voce + ' atacou antes nesta rodada' : ' ' + voce + ' attacked before this round';
    if (mesmo === false && !pl && !noRodada) s += pt ? ' do que ' + voce + ' atacou antes nesta rodada' : ' from the one ' + voce + ' attacked before this round';
    return { s, especifico: mesmo != null || !!tiposDoMonstro() || cl.length > 0 || !!adj, clausulas: cl.length > 0 }; };
  // 5. the count in a round or in a row
  const vezesNaRodada = n => pt ? num(n, 'f') + (n > 1 ? ' vezes' : ' vez') + ' na mesma rodada' : (n === 1 ? 'once' : n === 2 ? 'twice' : num(n) + ' times') + ' in the same round';
  const emSeguida = n => pt ? 'por ' + num(n, 'f') + ' rodadas seguidas' : 'for ' + num(n) + ' rounds in a row';
  // the verbs: [imperative, any hero (third person)]
  const V = pt ? { atacar: ['Ataque', 'ataca'], derrotar: ['Derrote', 'derrota'], ganhar: ['Ganhe', 'ganha'], causar: ['Cause', 'causa'], interagir: ['Interaja', 'interage'], abrir: ['Abra', 'abre'], ativar: ['Ative', 'ativa'], apagar: ['Apague', 'apaga'], usar: ['Usando', 'usando'] }
    : { atacar: ['Attack', 'attacks'], derrotar: ['Defeat', 'defeats'], ganhar: ['Gain', 'gains'], causar: ['Deal', 'deals'], interagir: ['Interact', 'interacts'], abrir: ['Open', 'opens'], ativar: ['Activate', 'activates'], apagar: ['Put out', 'puts out'], usar: ['Using', 'using'] };
  const verbo = k => qualquer ? (pt ? 'Qualquer herói ' : 'Any hero ') + V[k][1] : V[k][0];
  const com = a => (pt ? 'com ' : 'with ') + a;
  let nucleo = '', contagemDita = false;
  const minimo = val('danoMinimo');
  const danoMin = n => pt ? 'pelo menos ' + n + ' de dano' : 'at least ' + n + ' damage';
  // 2 + 3. the core of each moment
  if (m === 1 || m === 10) {
    if (ct === 'dano') { const a = monstro(0, true); nucleo = verbo('causar') + (pt ? ' dano a ' : ' damage to ') + a.s + ' ' + (arma ? com(arma) : (pt ? 'com seus ataques' : 'with ' + (qualquer ? 'their' : 'your') + ' attacks')) + (minimo ? (pt ? ', com ataques de ' : ', with attacks of ') + danoMin(minimo) : ''); }
    else if (ct === 'fraqueza' || ct === 'excesso') { const a = monstro(0); nucleo = verbo('causar') + (pt ? ' dano adicional usando a fraqueza de ' : ' extra damage using the weakness of ') + a.s + (arma ? ' ' + com(arma) : '') + (ct === 'excesso' ? (pt ? ', além da vida que restava a ele' : ', beyond the health it had left') : ''); }
    else if (minimo) { const a = monstro(0); nucleo = verbo('causar') + ' ' + danoMin(minimo) + (a.especifico ? (pt ? ' a ' : ' to ') + a.s : '') + (pt ? ' com um único ataque' : ' with a single attack') + (arma ? ' ' + com(arma) : ''); }
    else { const esp = !!tiposDoMonstro() || clausulasDoMonstro(false).length > 0 || val('condicao') != null; const plural = noRodada > 1 && (mesmo === false || (esp && mesmo !== true)); const a = monstro(plural ? noRodada : 0);
      nucleo = verbo('atacar') + (arma ? ' ' + com(arma) : '') + (a.especifico || plural ? ' ' + a.s : '');
      if (plural) { nucleo += pt ? ' na mesma rodada' : ' in the same round'; contagemDita = true; } }
  } else if (m === 2) nucleo = pt ? 'Resolva a ativação de um inimigo' : 'Resolve an enemy’s activation';
  else if (m === 3) nucleo = pt ? 'Sofra um ferimento' : 'Suffer an injury';
  else if (m === 4) {
    const plural = noRodada > 1; const a = monstro(plural ? noRodada : 0); const tormento = val('DiedFromAffliction');
    if (tormento === true) { const suj = a.s.charAt(0).toUpperCase() + a.s.slice(1);
      nucleo = pt ? suj + (plural ? ' são derrotados' : ' é derrotado') + ' pelo dano de Atormentado' : suj + (plural ? ' are defeated' : ' is defeated') + ' by the damage of Afflicted';
    } else {
      nucleo = arma && a.clausulas ? V.usar[qualquer ? 1 : 0] + ' ' + arma + ', ' + (qualquer ? (pt ? 'qualquer herói ' : 'any hero ') + V.derrotar[1] : V.derrotar[0].toLowerCase()) + ' ' + a.s
        : verbo('derrotar') + ' ' + a.s + (arma ? ' ' + com(arma) : '');
      if (tormento === false && !arma) nucleo += pt ? ' com um ataque' : ' with an attack';
    }
    if (plural) { nucleo += pt ? ' na mesma rodada' : ' in the same round'; contagemDita = true; }
  } else if (m === 5 || m === 9) {
    const o = cabe('objeto') ? x.objeto : null, sai = !!val('RequireObjectRemove'), pri = val('FirstTimeInteracted');
    const nome = o ? G.objetos[o] : '';
    const alvo = nome || (pri != null || sai ? (pt ? 'uma peça do terreno' : 'a terrain piece') : '');
    const qual = /^uma /.test(alvo) ? 'a qual' : 'o qual';
    const novo = pri === true ? (pt ? ' com ' + qual + ' nenhum herói interagiu ainda' : ' that no hero has interacted with before') : pri === false ? (pt ? ' com ' + qual + ' algum herói já interagiu' : ' that some hero has already interacted with') : '';
    let inter;
    if (o === 7) inter = verbo('ativar') + ' ' + nome + novo;
    else if (sai && o === 6) inter = verbo('abrir') + ' ' + nome + novo;
    else if (sai && o === 1) inter = verbo('abrir') + ' ' + nome + novo;
    else if (sai && o === 10) inter = verbo('apagar') + ' ' + nome + novo;
    else inter = verbo('interagir') + (alvo ? (pt ? ' com ' : ' with ') + alvo + novo + (sai ? (pt ? ', que sai do tabuleiro' : ', which leaves the board') : '') : '');
    if (m === 9) { const a = monstro(0); const at = verbo('atacar') + (a.especifico ? ' ' + a.s : '') + (minimo ? (pt ? ' causando ' : ' dealing ') + danoMin(minimo) : '');
      nucleo = at + (pt ? ' ou ' : ' or ') + inter.replace(/^Qualquer herói |^Any hero /, '').replace(/^\S+/, w => w.toLowerCase()) + (arma ? (pt ? ', com ' + arma + ' em mãos' : ', with ' + arma + ' in hand') : '');
    } else nucleo = inter + (arma ? (pt ? ', com ' + arma + ' em mãos' : ', with ' + arma + ' in hand') : '');
  } else if (m === 6) { const t = (val('itens') || []).map(k => G.itens[k]).filter(Boolean); nucleo = verbo('ganhar') + ' ' + (t.length ? ouLista(t, pt ? 'ou' : 'or') : (pt ? 'um item' : 'an item')); }
  else if (m === 7) nucleo = pt ? 'Termine uma rodada' : 'End a round';
  else if (m === 8) { const v = val('vitoria'); nucleo = v === true ? (pt ? 'Vença uma missão' : 'Win a quest') : v === false ? (pt ? 'Perca uma missão' : 'Lose a quest') : (pt ? 'Termine uma missão' : 'Finish a quest'); }
  // 5. the count
  if (!contagemDita && noRodada) nucleo += ' ' + vezesNaRodada(noRodada);
  if (seguidas) nucleo += ' ' + emSeguida(seguidas);
  // 6. the hero and the round
  const cl = [], ini = m === 7 || m === 8;
  const les = val('lesao');
  let prefixo = '';
  if (les) { const k = les.valor + (les.inverso && les.valor ? '!' : '');
    const t = pt ? { '0': 'sem nenhum ferimento', '1': 'com um ferimento', '2': 'com um ferimento grave', '3': 'tendo sido derrotado', '1!': 'com exatamente um ferimento leve', '2!': 'com exatamente um ferimento grave', '3!': 'tendo sido derrotado' }
      : { '0': 'with no injury', '1': 'with an injury', '2': 'with a major injury', '3': 'having been defeated', '1!': 'with exactly a minor injury', '2!': 'with exactly a major injury', '3!': 'having been defeated' };
    const v = k === '0' && val('AnyHeroInjured') === false ? '' : t[k]; if (v) { if (ini || qualquer || /^(Um inimigo|An enemy|[A-ZÀ-Ú]\S* inimigos|[A-Z]\S* enemies)/.test(nucleo)) cl.push(v);
      else prefixo = (pt ? (/^(sem|tendo)/.test(v) ? v : 'estando ' + v) : (/^(with no|having)/.test(v) ? v : v.replace(/^with/, 'while having'))) + ', '; } }
  if (val('AttackWithBothWeapons')) cl.push(pt ? 'depois de já ter atacado com a outra arma nesta rodada' : 'after attacking with the other weapon this round');
  const atacou = val('HeroAttackedThisRound'), antes = [1, 9, 10].includes(m);
  if (atacou === true) cl.push(pt ? 'depois de já ter atacado nesta rodada' : 'after attacking this round'); else if (atacou === false) cl.push(m === 7 ? (pt ? 'sem ter atacado' : 'without attacking') : pt ? 'sem ter atacado ' + (antes ? 'antes ' : '') + 'nesta rodada' : 'without attacking ' + (antes ? 'earlier ' : '') + 'this round');
  const fer = val('AnyHeroInjured'), ferOutro = val('AnyOtherHeroInjured');
  if (fer === true) cl.push(pt ? 'enquanto algum herói estiver ferido' : 'while some hero is injured'); else if (fer === false) cl.push(pt ? 'sem que nenhum herói esteja ferido' : 'while no hero is injured');
  if (ferOutro === true && fer !== true) cl.push(pt ? 'enquanto outro herói estiver ferido' : 'while another hero is injured'); else if (ferOutro === false && fer !== false) cl.push(pt ? 'sem que outro herói esteja ferido' : 'while no other hero is injured');
  const pa = val('FirstAttackOfRound'), pi = val('FirstInteractionOfRound');
  if (pa === true && pi === true) cl.push(pt ? 'antes que qualquer herói ataque ou interaja nesta rodada' : 'before any hero attacks or interacts this round');
  else { if (pa === true) cl.push(pt ? 'antes que qualquer herói ataque nesta rodada' : 'before any hero attacks this round'); if (pi === true) cl.push(pt ? 'antes que qualquer herói interaja nesta rodada' : 'before any hero interacts this round'); }
  if (pa === false && pi === false) cl.push(pt ? 'depois que algum herói já atacou e algum já interagiu nesta rodada' : 'after some hero has attacked and some hero has interacted this round');
  else { if (pa === false) cl.push(pt ? 'depois que algum herói já atacou nesta rodada' : 'after some hero has attacked this round'); if (pi === false) cl.push(pt ? 'depois que algum herói já interagiu nesta rodada' : 'after some hero has interacted this round'); }
  const rodada = s => ini && m === 7 ? s : (pt ? 'numa rodada ' : 'in a round ') + s;
  const outros = val('AllOtherHeroesDidDamageThisRound'), todos = val('AllHeroesDidDamageThisRound');
  if (outros === true) cl.push(rodada(pt ? 'em que todos os outros heróis já atacaram' : 'in which every other hero has attacked')); else if (outros === false) cl.push(rodada(pt ? 'em que nem todos os outros heróis atacaram' : 'in which not every other hero has attacked'));
  if (todos === true) cl.push(rodada(pt ? 'em que todos os heróis já atacaram' : 'in which every hero has attacked')); else if (todos === false) cl.push(rodada(pt ? 'em que nem todos os heróis atacaram' : 'in which not every hero has attacked'));
  const inim = val('EnemiesOnMap');
  if (inim) cl.push(pt ? (m === 7 ? 'com ' : 'enquanto houver ') + (inim > 1 ? inim + ' ou mais inimigos' : 'inimigos') + ' no mapa' : (m === 7 ? 'with ' : 'while there ' + (inim > 1 ? 'are ' : 'are ')) + (inim > 1 ? inim + ' or more enemies' : 'enemies') + ' on the map');
  // (in "End a round" the round's clauses read as its own: "Termine uma rodada em que…")
  const rodadaEm = (pt ? /^em que / : /^in which /);
  if (m === 7) cl.sort((a, b) => (rodadaEm.test(b) ? 1 : 0) - (rodadaEm.test(a) ? 1 : 0));
  let s = nucleo;
  const comOracao = / (que|qual|that|which|from the one|do que) /.test(nucleo) || /, (com|with) .* (em mãos|in hand)$/.test(nucleo);
  cl.forEach((c, i) => { s += (i === 0 && !comOracao ? ' ' : ', ') + c; });
  if (prefixo) s = prefixo + s.charAt(0).toLowerCase() + s.slice(1);
  s = s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
/* the text the game shows: the game's own for a feat of the game (and for a copy whose rules were not touched yet);
   otherwise the one made from the rules */
const textoAutomatico = f => !(f.base && !f.custom) && f.textoAuto !== false;
function textoDaFacanha(f, lingua) { return textoAutomatico(f) ? textoDaRegra(f, lingua) : (f.texto || ''); }

function fichaFacanha(c, f) {
  setTimeout(() => primeiraVista(f), 0);   // (v240: the sheet fills its defaults first)
  // (a game feat imported with older game data: its finer conditions come in once the data has them)
  if (f.base && !f.extrasConhecidos) { const cg = facanhaDoJogo(f.base); if (cg && cg.FirstAttackOfRound !== undefined) { const fg = filtrosDoJogo(cg); EXTRAS_FEITO.forEach(k => { if (f.filtros[k] === undefined) f.filtros[k] = fg[k]; }); f.extrasConhecidos = true; } }
  const x = f.filtros; const mudou = () => { f.custom = true; };
  const premios = f.premios || f.premiosJogo || [];
  const skillsDoHeroi = periciasParaPremio(f.heroi);
  const cabe = d => d.em.includes(f.momento);
  const ativas = CONDICOES_FEITO.filter(d => ativaCond(x, d));
  const livres = CONDICOES_FEITO.filter(d => cabe(d) && !ativaCond(x, d));
  const controle = d => {
    if (d.tipo === 'lista') return `<div class="marcas">${d.lista().map((n, i) => `<label class="chk"><input type="checkbox" data-mf="${d.k}" value="${i}" ${(x[d.k] || []).includes(i) ? 'checked' : ''}> ${esc(String(n).replace(/([a-z])([A-Z])/g, '$1 $2'))}</label>`).join('')}</div>`;
    if (d.tipo === 'sim') return `<select data-cv="${d.k}"><option value="1" ${x[d.k] === true ? 'selected' : ''}>${esc(tr(d.sim[0]))}</option><option value="0" ${x[d.k] === false ? 'selected' : ''}>${esc(tr(d.sim[1]))}</option></select>`;
    if (d.tipo === 'num') return `<input type="number" min="${d.min || 0}" data-cn="${d.k}" value="${d.k === 'danoMinimo' ? x.danoMinimo || 1 : x[d.k] || 1}" style="width:80px">`;
    if (d.tipo === 'liga') return '';
    if (d.k === 'lesao') { const opc = SAUDE_FACANHA.concat(x.lesao && !SAUDE_FACANHA.some(([v, i]) => v === x.lesao.valor && i === !!x.lesao.inverso) ? [[x.lesao.valor, !!x.lesao.inverso, 'Any health (always counts)']] : []);
      return `<select data-cs="lesao">${opc.map(([v, i, n]) => `<option value="${i ? '!' : ''}${v}" ${x.lesao && x.lesao.valor === v && !!x.lesao.inverso === i ? 'selected' : ''}>${esc(tr(n))}</option>`).join('')}</select>`; }
    if (d.k === 'condicao') return `<select data-cs="condicao">${CONDICOES_FACANHA.map(([v, n]) => `<option value="${v}" ${x.condicao === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    if (d.k === 'objeto') return `<select data-cs="objeto">${OBJETOS_FACANHA.map((n, i) => i ? `<option value="${i}" ${x.objeto === i ? 'selected' : ''}>${esc(n)}</option>` : '').join('')}</select>`;
    return '';
  };
  const linhaCond = d => `<div class="condFeito ${cabe(d) ? '' : 'foraDoMomento'}" data-cond="${d.k}"><div class="cab"><b>${esc(tr(GRUPOS_FEITO.find(g => g[0] === d.g)[1]))}:</b> ${esc(tr(d.nome))}<span class="espaco"></span><button class="sm" data-condx="${d.k}" title="${esc(tr('Remove this condition'))}">✕</button></div>${controle(d)}${d.ajuda ? `<p class="ajuda">${esc(tr(d.ajuda))}</p>` : ''}</div>`;
  const ct = contagemDe(x); const cts = CONTAGENS_FEITO.filter(z => !z.em || z.em.includes(f.momento)); const ctd = CONTAGENS_FEITO.find(z => z.k === ct);
  const orig = !!f.base, mudado = orig && !!f.custom;
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeFacanha(f))} ${etiquetaEstado(f)}</h2><div class="botoes">${orig ? `<button class="sm primario" id="ff_dup">⧉ ${esc(tr('Duplicate'))}</button>` : ''}${mudado ? `<button class="sm" id="ff_volta">↺ ${esc(tr('Back to the game’s'))}</button>` : ''}<button class="sm perigo" id="ff_apaga">Delete</button></div></div>
    ${orig ? avisoOficial(mudado ? 'This original was changed by an older version of the editor: “↺ Back to the game’s” undoes it.' : '', 'Whether the workshop offers it (the pool of feats) is chosen in the list.') : ''}
    <div class="folha"><div class="col">
      <div class="duas"><label class="campo">Name <input id="ff_nome" value="${esc(f.nome || '')}"></label>
      <label class="campo">Hero <select id="ff_heroi">${HEROIS_IDS.map(h => `<option value="${h}" ${f.heroi === h ? 'selected' : ''}>${esc(nomeDoPerfil(h))}</option>`).join('')}</select></label></div>
      <div id="ff_texto"></div>
      <div class="sub">${esc(tr('Trigger'))}</div>
      <label class="campo"><select id="ff_momento">${MOMENTOS_FACANHA.map(([v, n]) => `<option value="${v}" ${f.momento === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <p class="ajuda">The moment the game checks the feat. Pick it first: the conditions and the ways of counting below are only the ones the game checks at this moment.</p>
      <div class="sub">${esc(tr('Conditions'))}</div>
      <div id="ff_conds">${ativas.map(linhaCond).join('') || `<p class="ajuda">${esc(tr('No condition: every time counts.'))}</p>`}</div>
      ${livres.length ? `<select id="ff_novaCond"><option value="">${esc(tr('+ add a condition…'))}</option>${GRUPOS_FEITO.map(([g, gn]) => { const ds = livres.filter(d => d.g === g); return ds.length ? `<optgroup label="${esc(tr(gn))}">${ds.map(d => `<option value="${d.k}" title="${esc(tr(d.ajuda || ''))}">${esc(tr(d.nome))}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>` : ''}
      <p class="ajuda">One at a time: every condition added must hold for the moment to count.${f.momento === 9 ? ' ' + tr('With a monster condition, only the attacks count (an interaction has no monster).') : ''}</p>
      ${f.base && !f.extrasConhecidos ? '<p class="ajuda aviso">Other finer conditions of this feat in the game are kept as they are (the game data of this editor is older: open the game with the mod once to bring them here).</p>' : ''}
      <div class="duas"><label class="campo">Counting <select id="ff_cont">${cts.map(z => `<option value="${z.k}" ${ct === z.k ? 'selected' : ''} title="${esc(tr(z.ajuda || ''))}">${esc(tr(z.nome))}</option>`).join('')}</select></label>
      <label class="campo">${esc(tr(ct === 'vezes' ? (f.momento === 6 ? 'Items gained' : 'x times') : /^(dano|fraqueza|excesso)$/.test(ct) ? 'Damage in total' : 'Rounds'))} <input type="number" min="1" id="ff_meta" value="${f.meta || 1}" style="width:80px"></label></div>
      ${ctd && ctd.n ? `<label class="campo">${esc(tr(ctd.n))} <input type="number" min="1" id="ff_contn" value="${(ct === 'naRodada' ? x.AmountOfTimeDuringRound : x.ForAmountOfRounds) || 2}" style="width:80px"></label>` : ''}
      <p class="ajuda">${esc(tr(f.momento === 6 ? 'Each item gained counts one.' : (ctd && ctd.ajuda) || ''))}</p>
    </div><div class="col">
      <div class="sub">Tier</div>
      <label class="campo">${esc(tr('Tier'))} <input type="number" min="0" id="ff_precisa" value="${f.precisa || 0}" style="width:80px"></label>
      <p class="ajuda">${esc(tr('The tier is the number of feats the hero must have completed for this one to appear (0: from the start). The game offers each hero two feats at a time, among the ones their tier allows; its own go in tiers 0, 4, 8, 12 and 14.'))}</p>
      ${avisoDeArmaDaFacanha(f.id, f.heroi) ? `<p class="avisoVermelho">${esc(avisoDeArmaDaFacanha(f.id, f.heroi))}</p>` : ''}
      <div class="sub">${esc(tr('Reward'))}</div>
      <div id="ff_premios"></div>
      <button class="sm" id="ff_premio">+ ${esc(tr('Reward…'))}</button>
      <p class="ajuda">Like “Give an item”: any item of the workshop, plus the hero’s skill cards and the workshop’s recipes. In the game a feat only gives skill cards (the physical card at the table) and recipes; the items come through the mod, into the party’s inventory, when the players take the reward in the feats window.</p>
    </div></div>`;
  /* how the feat reads in the game: the name (in bold) and the text made from the rules (v235: the text is not typed) */
  const previa = () => { const el = $('#ff_texto'); if (!el) return; const auto = textoAutomatico(f); const t = textoDaFacanha(f); if (auto) f.texto = t;
    el.innerHTML = `<div class="sub">${esc(tr('Text'))}</div><p class="textoGerado" data-sem-traducao><b>${esc(nomeFacanha(f))}</b>: ${esc(semTagsFacanha(t))}</p>
      <p class="ajuda">${esc(tr(orig && !f.custom ? 'The game’s text.' : auto ? 'Made from the trigger, the conditions and the counting below: it follows them. The goal is not in the text: the game shows it as the feat’s progress.' : 'The text of the game’s feat this one came from: once a rule changes, the text is made from the rules.'))}</p>`; };
  const regra = () => { f.textoAuto = true; mudou(); previa(); };
  const re = () => { f.textoAuto = true; mudou(); renderFacanhas(); };
  $('#ff_nome').oninput = e => { f.nome = e.target.value; mudou(); previa(); };
  // the new name goes to the title and the list without redrawing the sheet (a redraw here ate the next click)
  $('#ff_nome').onchange = () => { const a = document.querySelector('#f_lista .no.ativo > div > div'); if (a) a.textContent = nomeFacanha(f); const h = c.querySelector('h2'); if (h && h.firstChild) h.firstChild.textContent = nomeFacanha(f) + ' '; };
  $('#ff_heroi').onchange = e => { f.heroi = e.target.value; if (f.premios) f.premios = f.premios.filter(id => { if (id.startsWith('ITEM:') || id.startsWith('RECEITA:')) return true; const h = heroiDaPericiaPorId(id); return !h || h === f.heroi; }); re(); };
  $('#ff_momento').onchange = e => { f.momento = +e.target.value; const fora = ajustarAoMomento(f); re(); if (fora.length) aviso(tr('Taken out (the game does not check them at this moment):') + ' ' + fora.join('; ') + '.'); };
  $('#ff_meta').oninput = e => { f.meta = Math.max(1, +e.target.value || 1); mudou(); };
  $('#ff_cont').onchange = e => { porContagem(x, e.target.value); re(); };
  const cn = $('#ff_contn'); if (cn) cn.oninput = e => { const n = Math.max(1, +e.target.value || 1); if (ct === 'naRodada') x.AmountOfTimeDuringRound = n; else x.ForAmountOfRounds = n; regra(); };
  /* a new condition comes with its first value (a list: nothing ticked yet, the first one of the list) */
  const nc = $('#ff_novaCond'); if (nc) nc.onchange = e => { const d = CONDICOES_FEITO.find(z => z.k === e.target.value); if (!d) return;
    x[d.k] = d.k === 'armas' ? ((typeof maosDe === 'function' && maosDe(f.heroi).length) ? [...new Set(maosDe(f.heroi))] : [0]) : d.tipo === 'lista' ? [0] : d.tipo === 'sim' || d.tipo === 'liga' ? true : d.tipo === 'num' ? Math.max(1, d.min || 1) : d.k === 'lesao' ? { valor: 1, inverso: false } : d.k === 'condicao' ? 1 : d.k === 'objeto' ? 1 : true; re(); };
  c.querySelectorAll('[data-condx]').forEach(b => b.onclick = () => { const d = CONDICOES_FEITO.find(z => z.k === b.dataset.condx); x[d.k] = d.tipo === 'lista' ? null : d.k === 'danoMinimo' ? 0 : null; re(); });
  c.querySelectorAll('[data-mf]').forEach(cb => cb.onchange = () => { const k = cb.dataset.mf; const v = [...c.querySelectorAll(`[data-mf="${k}"]:checked`)].map(z => +z.value); x[k] = v.length ? v : null; if (!v.length) re(); else regra(); });
  c.querySelectorAll('[data-cv]').forEach(s => s.onchange = () => { x[s.dataset.cv] = s.value === '1'; regra(); });
  c.querySelectorAll('[data-cn]').forEach(i => i.oninput = () => { x[i.dataset.cn] = Math.max(1, +i.value || 1); regra(); });
  c.querySelectorAll('[data-cs]').forEach(s => s.onchange = () => { const k = s.dataset.cs, v = s.value;
    if (k === 'lesao') x.lesao = { valor: +v.replace('!', ''), inverso: v.startsWith('!') }; else x[k] = +v; regra(); });
  $('#ff_precisa').oninput = e => { f.precisa = Math.max(0, +e.target.value || 0); mudou(); };
  /* the rewards, the way "Give an item" picks them: pictures and names; an item has a quantity */
  const pintaPremios = () => { const el = $('#ff_premios'); const ps = f.premios || f.premiosJogo || [];
    el.innerHTML = `<div class="lootMonstro">${ps.map((id, i) => { const img = imagemDoPremio(id), item = id.startsWith('ITEM:');
      return `<div class="itemEscolhido">${img ? `<img loading="lazy" decoding="async" ${imgTardia(img)} alt="">` : '<span class="vazio">✦</span>'}<div><b data-sem-traducao>${esc(nomeDoPremio(id))}</b><small>${esc(tr(tipoDoPremio(id)))}</small>${item && !itemDaOficina(id.slice(5)) ? `<small class="erro">${esc(tr('not in the workshop!'))}</small>` : ''}</div>${item ? `<input type="number" min="1" data-pq="${esc(id)}" value="${(f.qtdPremios || {})[id] || 1}" style="width:56px" title="${esc(tr('Quantity'))}">` : ''}<button class="sm" data-premiodel="${i}" title="${esc(tr('Remove'))}">✕</button></div>`; }).join('') || `<p class="ajuda">${esc(tr('No reward.'))}</p>`}</div>${!f.premios && f.outrosPremios ? `<p class="ajuda">${esc(tr('+ {n} reward(s) of the game kept as they are (recipes, legends…).').replace('{n}', f.outrosPremios))}</p>` : ''}`;
    el.querySelectorAll('[data-premiodel]').forEach(a => a.onclick = () => { f.premios = f.premios || [...(f.premiosJogo || [])]; const [id] = f.premios.splice(+a.dataset.premiodel, 1); if (f.qtdPremios) delete f.qtdPremios[id]; mudou(); pintaPremios(); });
    el.querySelectorAll('[data-pq]').forEach(q => q.oninput = () => { f.qtdPremios = f.qtdPremios || {}; f.qtdPremios[q.dataset.pq] = Math.max(1, +q.value || 1); mudou(); }); };
  pintaPremios(); previa();
  $('#ff_premio').onclick = () => {
    const cartas = periciasParaPremio(f.heroi).map(s => ({ id: s.id, nome: s.nome, img: '', sub: tr('skill card') }));
    abrirEscolhaDeItem(null, id => { const v = id.startsWith('RECEITA:') || cartas.some(x => x.id === id) ? id : 'ITEM:' + id;
      f.premios = f.premios || [...(f.premiosJogo || [])]; if (!f.premios.includes(v)) f.premios.push(v); else if (v.startsWith('ITEM:')) { f.qtdPremios = f.qtdPremios || {}; f.qtdPremios[v] = (f.qtdPremios[v] || 1) + 1; } mudou(); pintaPremios(); },
      { antes: cartas.length ? [[tr('Skill cards of') + ' ' + nomeDoHeroi(f.heroi), cartas]] : [], titulo: tr('Pick the reward') });
  };
  $('#ff_apaga').onclick = () => { if (!confirm('Delete the feat “' + nomeFacanha(f) + '”?')) return; oficina().facanhas = oficina().facanhas.filter(z => z !== f); oficina().poolFacanhas = (oficina().poolFacanhas || []).filter(id => id !== f.id); fichaSel = null; renderFacanhas(); };
  if (abaF === 'herois') { const hs = c.querySelector('#ff_heroi'); if (hs) hs.closest('label').hidden = true; }   // (in the hero's feats, the hero is the one of the panel)
  if (!orig) return;
  travarOficial(c, '');
  $('#ff_dup').onclick = () => { const nome = nomeDaCopia(nomeFacanha(f), (oficina().facanhas || []).map(nomeFacanha)); if (!nome) return;
    const d = clone(f); d.id = 'B_' + uid(); d.base = null; d.custom = true; d.nome = nome; d.extrasConhecidos = true; d.textoAuto = false; if (!d.premios) d.premios = [...(f.premiosJogo || [])]; delete d.premiosJogo; delete d.outrosPremios;
    oficina().facanhas.push(d); const pool = poolDasFacanhas(); const k = pool.indexOf(f.id); if (k >= 0) pool[k] = d.id; fichaSel = d.id; renderFacanhas(); aviso(tr('Duplicated: this one is yours to change.')); };
  const vj = $('#ff_volta'); if (vj) vj.onclick = () => { const cj = facanhaDoJogo(f.base); if (!cj) return; const n = facanhaDoCatalogo(cj); Object.keys(f).forEach(k => { if (k !== 'id') delete f[k]; }); Object.assign(f, n, { id: f.id }); renderFacanhas(); };
}

// ------------------------------------------------------------ export
const idFacanhaExportada = id => { const f = (oficina().facanhas || []).find(x => x.id === id); return f ? (f.base || f.id) : id; };
function facanhasExportadas() {
  return (oficina().facanhas || []).map(f => { const x = f.filtros || {};
    return { id: f.base || f.id, ...(f.base ? { game: f.base } : {}), hero: f.heroi, text: '<b>' + (f.nome || 'Feat') + '</b>: ' + textoDaFacanha(f), goal: f.meta || 1, timing: f.momento || 1, required: f.precisa || 0, act: f.ato || 0,
      ...(f.premios ? { rewards: f.premios.filter(id => !id.startsWith('ITEM:')).map(id => id.startsWith('RECEITA:') ? idReceitaExportada(id.slice(8)) : id) } : {}),
      // (items: the game gives none on a feat; the mod hands them over when the reward is taken)
      ...((f.premios || []).some(id => id.startsWith('ITEM:')) ? { rewardItems: f.premios.filter(id => id.startsWith('ITEM:')).map(id => ({ item: idItemExportado(id.slice(5)), qty: (f.qtdPremios || {})[id] || 1 })) } : {}),
      params: { weapons: x.armas || [], enemies: x.inimigos || [], items: x.itens || [], interactable: x.objeto ?? null, condition: x.condicao ?? null, injury: x.lesao ? { value: x.lesao.valor, invert: !!x.lesao.inverso } : null,
        totalDamage: !!x.danoTotal, weakness: !!x.fraqueza, victory: x.vitoria ?? null, minDamage: x.danoMinimo || null, sameEnemy: x.mesmoInimigo ?? null,
        // (the finer conditions, by the game's names; conditionsAll: the list is whole, the ones left out are switched off;
        // otherwise, a game feat whose finer conditions this editor does not know, only the ones listed change)
        ...{ conditionsAll: !!(f.extrasConhecidos || !f.base), conditions: Object.fromEntries(EXTRAS_FEITO.filter(k => x[k] !== null && x[k] !== undefined && (SIM_NAO_FEITO.has(k) || x[k] !== false)).map(k => [k, x[k]])) } } };
  });
}
const poolFacanhasExportado = () => [...new Set((oficina().poolFacanhas || []).map(idFacanhaExportada))];
