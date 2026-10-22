/* Bigorna Rooms v2 — the Workshop's weapons: each sheet changes one of the twelve weapons of the heroes while this map
   (or campaign) is played: names, damage, damage types, pictures, ability texts and chances of its parts, or a new weapon
   in its place. Runes (weapons any hero may take) can be changed the same way, and new runes created. The pieces can be assembled by dragging them; "Fix box" makes the box of a piece follow where it was left
   (the template changes and the app draws the piece there) and "Forge" bakes the pictures into the weapon. Only what differs from the game is stored and exported. */
'use strict';

let armaSel = null, pecaAberta = null;
const ARMAS_DOS_HEROIS = () => HEROIS_JOGO.flatMap(hj => maosDe(hj.id).map((k, i) => ({ w: armaDaClasse(k), k, i, heroi: hj.id }))).filter(x => x.w);
/* the twelve weapons of the heroes, by name */
const ARMAS_DOS_12 = () => HEROIS_JOGO.flatMap(hj => hj.classes).sort((a, b) => (armaDaClasse(a)?.name_en || '').localeCompare(armaDaClasse(b)?.name_en || ''));
const armaEditada = wid => oficina().armas.find(a => a.id === wid);
function armaParaEditar(wid) { let a = armaEditada(wid); if (!a) { a = { id: wid }; oficina().armas.push(a); } return a; }
function armaMudou(a) { return !!(a && (a.runa || a.nome || a.nova || Object.keys(a.pecas || {}).some(p => Object.keys(a.pecas[p]).length))); }
/* drops what no longer differs from the game (and the entry itself when nothing does) */
function limparArmas() {
  const b = oficina();
  b.armas.forEach(a => { Object.keys(a.pecas || {}).forEach(p => { if (!Object.keys(a.pecas[p]).length) delete a.pecas[p]; }); if (a.pecas && !Object.keys(a.pecas).length) delete a.pecas; });
  b.armas = b.armas.filter(armaMudou);
}
const nomeDaArma = w => { const a = armaEditada(w._id); return a?.nova ? (a.nova.nome || (a.runa ? 'New rune' : 'New weapon')) : (a?.nome || w.name_en); };
/* runes: weapons of no hero (class Rune); the party gets one with its rune (part A) and any hero may take it */
/* the game calls five of them just "Rune": the editor shows the name of their rune (part A) instead */
let runasNomeadas = false;
const RUNAS_JOGO = () => { const r = CAT.itens.filter(i => i._cls === 'WeaponModel' && i.Class === 12);
  if (!runasNomeadas) { runasNomeadas = true; r.forEach(i => { if (i.name_en === 'Rune') i.name_en = 'Rune: ' + (semGlifo(itemDoJogo((i.StartingWeaponParts || [])[0]?.id)?.name_en) || i._id); }); }
  return r.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || '')); };
const RUNAS_PROPRIAS = () => oficina().armas.filter(a => a.runa);
/* a weapon by id: the game's, or a rune of the workshop (drawn over the game rune it is made from) */
function armaPorId(wid) { const a = armaEditada(wid); if (a && a.runa) { const b = itemDoJogo(a.base) || RUNAS_JOGO()[0]; return { ...b, _id: a.id, name_en: (a.nova && a.nova.nome) || 'New rune', _runaPropria: true }; } return itemDoJogo(wid); }
/* the parts of a weapon: a hero weapon takes every part of its class; a rune only its own (and the upgraded rune) */
const pecasDaArma = w => w.Class === 12 ? (() => { const ids = (w.StartingWeaponParts || []).map(r => r.id); if (ids[0]) ids.push(ids[0] + '_UPGRADED'); return ids.map(itemDoJogo).filter(Boolean).sort((a, b) => a.Slot - b.Slot); })() : pecasDaClasse(w.Class);
function novaRuna() {
  const base = RUNAS_JOGO().find(r => r._id === 'WEAPON_RUNE_OF_BLADES') || RUNAS_JOGO()[0];
  const a = { id: 'B_' + uid(), runa: true, base: base._id, inicio: true, nova: { nome: tr('New rune'), alcance: ALCANCES[base.RangeApproximation] || 'Near', pecas: { A: { dano: 2, traits: ['Umbros'] }, B: {}, C: {} } } };
  oficina().armas.push(a); armaSel = a.id; pecaAberta = null; renderArmas();
}

// ------------------------------------------------------------ categories (organisation of the Workshop only)
/* the author's own categories and subcategories of weapons ("Enchanted swords", "Cursed hammers"): oficina().categoriasArmas
   [{id, nome, pai}] (pai: the category a subcategory belongs to); a weapon goes in one by oficina().armasCat[weapon id], a
   new part of the Workshop by its own item.categoria. They only organise the Weapons tab: nothing changes in the game. */
let modoArmas = (() => { try { return localStorage.getItem('bigorna-armas-modo') === 'cat' ? 'cat' : 'tipo'; } catch { return 'tipo'; } })();
const categoriasArmas = () => oficina().categoriasArmas;
const categoriaPorId = id => categoriasArmas().find(c => c.id === id) || null;
const subcategoriasDe = id => categoriasArmas().filter(c => c.pai === id);
const nomeDaCategoria = id => { const c = categoriaPorId(id); if (!c) return ''; const p = c.pai ? categoriaPorId(c.pai) : null; return p ? p.nome + ' › ' + c.nome : c.nome; };
const categoriaDaArma = wid => (categoriaPorId(oficina().armasCat[wid]) ? oficina().armasCat[wid] : '');
const categoriaDaPeca = it => (it && categoriaPorId(it.categoria) ? it.categoria : '');
/* the select of a sheet: no category, every category and, under it, its subcategories */
function opcoesCategoria(atual) {
  const raizes = categoriasArmas().filter(c => !c.pai);
  return `<option value="">${esc(tr('— no category —'))}</option>` + raizes.map(c => `<option value="${esc(c.id)}" ${atual === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`
    + subcategoriasDe(c.id).map(s => `<option value="${esc(s.id)}" ${atual === s.id ? 'selected' : ''}>&nbsp;&nbsp;› ${esc(s.nome)}</option>`).join('')).join('');
}
function novaCategoria(pai) {
  const nome = (prompt(tr(pai ? 'Name of the subcategory' : 'Name of the category (e.g. Enchanted swords)')) || '').trim(); if (!nome) return null;
  const c = { id: 'cat-' + uid(), nome, ...(pai ? { pai } : {}) }; categoriasArmas().push(c); return c;
}
function renomearCategoria(id) { const c = categoriaPorId(id); if (!c) return; const n = (prompt(tr('New name'), c.nome) || '').trim(); if (n) c.nome = n; }
function apagarCategoria(id) {
  const c = categoriaPorId(id); if (!c) return;
  const ids = new Set([id, ...subcategoriasDe(id).map(s => s.id)]);
  if (!confirm(tr('Delete the category and its subcategories? The weapons and parts in them stay, without a category.') + ' (' + c.nome + ')')) return;
  oficina().categoriasArmas = categoriasArmas().filter(x => !ids.has(x.id));
  const m = oficina().armasCat; Object.keys(m).forEach(k => { if (ids.has(m[k])) delete m[k]; });
  ITENS_B().forEach(i => { if (ids.has(i.categoria)) delete i.categoria; });
}
/* the left column by category: each category, its weapons and new parts, then its subcategories; what has none at the end */
function listaPorCategoria(l, dosHerois, runas) {
  const armas = [...dosHerois, ...runas];
  const pecas = ITENS_B().filter(i => i.cls === 'WeaponPartsModel' && i.custom);
  const linhaArma = (x, fundo) => { const sel = armaSel === x.w._id; const d = document.createElement('div'); d.className = 'no' + (fundo ? ' sub' : '') + (sel ? ' ativo' : '');
    const img = figurasDaArma(x.w)[0];
    d.innerHTML = `${img ? `<img class="face quadrada" loading="lazy" decoding="async" ${imgTardia(img)} alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div data-sem-traducao>${esc(nomeDaArma(x.w))}</div><small>${x.runa ? esc(tr(x.runa === 'propria' ? 'rune of the workshop' : 'rune of the game')) : esc(NOME_CLASSE[x.k]) + ' · ' + esc(nomeDoHeroi(x.heroi))}</small></div>`;
    d.onclick = () => { if (armaSel !== x.w._id) slotSel = 0; armaSel = x.w._id; pecaAberta = null; renderArmas(); };
    if (!sel || x.runa) return d;
    // (the chosen weapon: its heads, hafts and grips, as in the list by kind)
    const f = document.createDocumentFragment(); f.appendChild(d); const sub = document.createElement('div'); sub.className = 'subLista';
    sub.innerHTML = EXPL_SLOT.map(([n, curta], s) => `<div class="no sub ${slotSel === s ? 'ativo' : ''}" data-slot="${s}"><div><div>${'ABC'[s]} · ${n}</div><small>${curta}</small></div></div>`).join('');
    sub.querySelectorAll('[data-slot]').forEach(e => e.onclick = () => { slotSel = +e.dataset.slot; pecaAberta = null; renderArmas(); }); f.appendChild(sub); return f; };
  const linhaPeca = it => { const k = CLASSES_ARMA.indexOf(it.classe); const s = 'ABC'.indexOf(it.slot || 'A'); const dona = dosHerois.find(x => x.k === k);
    const d = document.createElement('div'); d.className = 'no sub' + (pecaAberta === it.id ? ' ativo' : ''); const img = retratoDoItem(it);
    d.innerHTML = `${img ? `<img class="face quadrada" loading="lazy" decoding="async" ${imgTardia(img)} alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div data-sem-traducao>${esc(it.nome || '')}</div><small>${esc(NOME_CLASSE[k] || it.classe || '')} · ${esc(tr(['head', 'haft', 'grip'][s] || 'head'))}</small></div>`;
    d.onclick = () => { if (dona) { armaSel = dona.w._id; slotSel = s; } pecaAberta = it.id; renderArmas(); }; return d; };
  const bloco = (cat, nivel) => {
    const c = document.createElement('div'); c.className = 'catArmas' + (nivel ? ' subcat' : '');
    const nArmas = armas.filter(x => categoriaDaArma(x.w._id) === cat.id), nPecas = pecas.filter(i => categoriaDaPeca(i) === cat.id);
    c.innerHTML = `<div class="catCab"><b data-sem-traducao>📁 ${esc(cat.nome)}</b><small>${nArmas.length + nPecas.length}</small><span class="espaco"></span>${nivel ? '' : `<button class="sm" data-subcat title="${esc(tr('New subcategory'))}">+</button>`}<button class="sm" data-rencat title="${esc(tr('Rename'))}">✎</button><button class="sm" data-apcat title="${esc(tr('Delete the category'))}">✕</button></div>`;
    const sub = c.querySelector('[data-subcat]'); if (sub) sub.onclick = () => { if (novaCategoria(cat.id)) renderArmas(); };
    c.querySelector('[data-rencat]').onclick = () => { renomearCategoria(cat.id); renderArmas(); };
    c.querySelector('[data-apcat]').onclick = () => { apagarCategoria(cat.id); renderArmas(); };
    nArmas.forEach(x => c.appendChild(linhaArma(x, true))); nPecas.forEach(i => c.appendChild(linhaPeca(i)));
    if (!nArmas.length && !nPecas.length && !subcategoriasDe(cat.id).length) { const v = document.createElement('p'); v.className = 'ajuda'; v.textContent = tr('Empty: pick it in the sheet of a weapon or of a new part.'); c.appendChild(v); }
    if (!nivel) subcategoriasDe(cat.id).forEach(s => c.appendChild(bloco(s, 1)));
    return c;
  };
  categoriasArmas().filter(c => !c.pai).forEach(c => l.appendChild(bloco(c, 0)));
  const nova = document.createElement('div'); nova.innerHTML = `<button class="sm" id="f_novaCat">+ ${esc(tr('New category'))}</button>`; nova.querySelector('button').onclick = () => { if (novaCategoria(null)) renderArmas(); }; l.appendChild(nova);
  const semA = armas.filter(x => !categoriaDaArma(x.w._id)), semP = pecas.filter(i => !categoriaDaPeca(i));
  if (semA.length || semP.length) { const s = document.createElement('div'); s.className = 'catArmas sem'; s.innerHTML = `<div class="catCab"><b>${esc(tr('No category'))}</b><small>${semA.length + semP.length}</small></div>`;
    semA.forEach(x => s.appendChild(linhaArma(x, true))); semP.forEach(i => s.appendChild(linhaPeca(i))); l.appendChild(s); }
}

// ------------------------------------------------------------ the tab
/* the left column goes by kind of weapon (sword, bow...), each split in heads, hafts and grips; runes and unique weapons
   (any hero may take them, and they are not split in parts) share one entry */
let slotSel = 0;
const EXPL_SLOT = [
  ['Heads', 'damage, damage types and the hero’s power', 'The striking end of the weapon. It sets the damage and the damage types of every attack, and holds the hero’s power: an ability the hero spends to use. One head is fitted at a time; the party may own several.'],
  ['Hafts', 'an ability that may trigger on hits', 'The shaft or guard that joins head and grip. It gives an ability that may trigger when an attack hits; its chance is shown in %.'],
  ['Grips', 'another ability that may trigger on hits', 'Where the hero holds the weapon. It gives a second ability that may trigger when an attack hits (chance in %).']];
const EXPL_RUNA = [['A', 'The rune: damage, damage types and power'], ['B', 'First effect: an ability that may trigger on hits'], ['C', 'Second effect: another ability that may trigger on hits']];
const ehRunaId = wid => { const w = armaPorId(wid); return !!w && w.Class === 12; };
/* parts of the workshop (made here, handed out by triggers or crafted by recipes) of a kind and slot */
const pecasPropriasDe = (k, s) => ITENS_B().filter(i => i.cls === 'WeaponPartsModel' && i.classe === CLASSES_ARMA[k] && (i.slot || 'A') === 'ABC'[s]);
/* the first visit to the Weapons tab explains that the app counts a weapon as its three parts (explicacaoDaAba, fichas.js) */
function avisoDasArmas() { const e = explicacaoDaAba('armas'); explicarUmaVez('armas', e[0], e[1]); }
function renderArmas() {
  avisoDasArmas();
  const esq = $('#esqF'); const dosHerois = ARMAS_DOS_HEROIS().sort((x, y) => NOME_CLASSE[x.k].localeCompare(NOME_CLASSE[y.k]));
  const runas = [...RUNAS_JOGO().map(w => ({ w, k: 12, runa: 'jogo' })), ...RUNAS_PROPRIAS().map(a => ({ w: armaPorId(a.id), k: 12, runa: 'propria' }))];
  const todas = [...dosHerois, ...runas]; if (!armaSel || !todas.some(x => x.w._id === armaSel)) armaSel = dosHerois[0]?.w._id;
  const naRuna = ehRunaId(armaSel);
  esq.innerHTML = `<div class="bloco"><h2>Weapons <span class="etq">${oficina().armas.filter(armaMudou).length} changed</span></h2>
    <p class="ajuda">Pick a kind of weapon, then its heads, hafts or grips. What you change applies while this ${campanha ? 'campaign' : 'map'} is played (to every copy of the part, also the ones bought or found later); what you leave stays as in the game.</p>
    <div class="botoes modoArmas"><button class="sm ${modoArmas === 'tipo' ? 'ativo' : ''}" data-modoarmas="tipo">By kind</button><button class="sm ${modoArmas === 'cat' ? 'ativo' : ''}" data-modoarmas="cat">By category</button></div><div class="botoes">${botaoLote()}</div><div id="f_lista"></div></div>`;
  esq.querySelectorAll('[data-modoarmas]').forEach(b => b.onclick = () => { modoArmas = b.dataset.modoarmas; try { localStorage.setItem('bigorna-armas-modo', modoArmas); } catch { } renderArmas(); });
  const l = $('#f_lista');
  if (modoArmas === 'cat') { listaPorCategoria(l, dosHerois, runas); const x = todas.find(z => z.w._id === armaSel); if (x) fichaArma($('#centroF'), x); return; }
  dosHerois.forEach(x => {
    const a = armaEditada(x.w._id); const sel = armaSel === x.w._id;
    const d = document.createElement('div'); d.className = 'no' + (sel ? ' ativo' : '');
    const img = figurasDaArma(x.w)[0];
    const novas = [0, 1, 2].reduce((n, s) => n + pecasPropriasDe(x.k, s).length, 0);
    d.innerHTML = `${img ? `<img class="face quadrada" loading="lazy" decoding="async" ${imgTardia(img)} alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div>${esc(NOME_CLASSE[x.k])}${nomeDaArma(x.w) !== NOME_CLASSE[x.k] && nomeDaArma(x.w) !== x.w.name_en ? ' · ' + esc(nomeDaArma(x.w)) : ''}</div><small>${esc(nomeDoHeroi(x.heroi))}’s${armaMudou(a) ? (a.nova ? ' · new weapon' : ' · changed') : ''}${novas ? ' · ' + novas + ' new part(s)' : ''}</small></div>`;
    d.onclick = () => { if (armaSel !== x.w._id) slotSel = 0; armaSel = x.w._id; pecaAberta = null; renderArmas(); }; l.appendChild(d);
    if (sel) { const sub = document.createElement('div'); sub.className = 'subLista';
      sub.innerHTML = EXPL_SLOT.map(([n, curta], s) => `<div class="no sub ${slotSel === s ? 'ativo' : ''}" data-slot="${s}"><div><div>${'ABC'[s]} · ${n}</div><small>${curta}</small></div></div>`).join('');
      sub.querySelectorAll('[data-slot]').forEach(e => e.onclick = () => { slotSel = +e.dataset.slot; pecaAberta = null; renderArmas(); }); l.appendChild(sub); }
  });
  // runes and unique weapons: one entry, each weapon whole
  const r = document.createElement('div'); r.className = 'no' + (naRuna ? ' ativo' : '');
  const imgR = figurasDaArma(runas[0].w)[0];
  r.innerHTML = `${imgR ? `<img class="face quadrada" loading="lazy" decoding="async" ${imgTardia(imgR)} alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div>Runes / unique</div><small>any hero · ${runas.length} weapon(s)</small></div>`;
  r.onclick = () => { if (!naRuna) { armaSel = runas[0].w._id; pecaAberta = null; renderArmas(); } }; l.appendChild(r);
  if (naRuna) { const sub = document.createElement('div'); sub.className = 'subLista';
    runas.forEach(x => { const a = armaEditada(x.w._id); const d = document.createElement('div'); d.className = 'no sub' + (armaSel === x.w._id ? ' ativo' : '');
      d.innerHTML = `<div><div>${esc(nomeDaArma(x.w))}</div><small>${x.runa === 'propria' ? 'rune of the workshop' + (a.inicio ? ' · the party has it' : '') : (x.w._id === 'WEAPON_DRAGONSBANE' ? 'unique weapon' : 'rune of the game') + (armaMudou(a) ? ' · changed' : '')}</small></div>`;
      d.onclick = () => { armaSel = x.w._id; pecaAberta = null; renderArmas(); }; sub.appendChild(d); });
    const b = document.createElement('div'); b.innerHTML = '<button class="sm" id="f_novaRuna">+ New rune</button>'; sub.appendChild(b); b.querySelector('button').onclick = novaRuna;
    l.appendChild(sub); }
  const x = todas.find(z => z.w._id === armaSel); if (x) fichaArma($('#centroF'), x);
}
/* the three pictures the app lays over each other: the starting pieces (with their own pictures) or the new weapon's */
function figurasDaArma(w) {
  const a = armaEditada(w._id) || {}; const nova = a.nova; const inicio = (w.StartingWeaponParts || []).map(r => itemDoJogo(r.id));
  return ['A', 'B', 'C'].map((sl, s) => nova ? ((nova.pecas || {})[sl] || {}).imagem || imagemDaPeca(inicio[s]) : (((a.pecas || {})[inicio[s]?._id] || {}).imagem || imagemDaPeca(inicio[s])));
}
/* the hero sheet shows its two weapons and sends to this tab */
function resumoArmaDoHeroi(k, i) {
  const w = armaDaClasse(k); if (!w) return ''; const a = armaEditada(w._id);
  return `<div class="ativ arma"><div class="cabAtiv"><span class="numAtiv">Weapon ${i + 1}</span><b>${esc(nomeDaArma(w))}</b><span class="etq ${armaMudou(a) ? 'custom' : ''}">${armaMudou(a) ? (a.nova ? 'new weapon' : 'changed') : 'as in the game'}</span></div>
    <div class="vistaArma">${figurasDaArma(w).map(f => f ? `<img loading="lazy" decoding="async" ${imgTardia(f)} alt="">` : '<span></span>').join('')}</div>
    <button class="sm" data-irarma="${w._id}">Edit in the Weapons tab →</button></div>`;
}

/* the sheet of a weapon: two columns beside the list on the left. In the middle, the parts of the chosen slot (A heads, B
   hafts, C grips: icon and name; a rune shows its own parts); a click puts the part in the forge. On the right, wider, the
   forge: the weapon put together with the three parts in it, to drag, size and turn, and for each part its stats (a
   window: name, picture, damage, damage types, ability…). */
function fichaArma(c, x) {
  setTimeout(() => primeiraVista(x), 0);   // (v240: the sheet fills its defaults first)
  const w = x.w, k = x.k; const a = armaEditada(w._id) || {}; const nova = a.nova;
  const propria = x.runa === 'propria';
  const f = estadoDaForja(w);
  if (!c.querySelector('#fa_forja')) _rolagemFicha = null;   // (coming from another tab: from the top)
  const yFicha = _rolagemFicha === w._id && $('#telaFichas') && !$('#telaFichas').hidden ? c.scrollTop : 0; _rolagemFicha = w._id;   // (the same weapon redrawn keeps its scroll)
  // (a part opened from elsewhere, the Items tab or a category: it goes in the forge, in its slot)
  if (pecaAberta) { const it = ITENS_B().find(i => i.id === pecaAberta && i.cls === 'WeaponPartsModel'); const gp = itemDoJogo(pecaAberta);
    const sl = it ? 'ABC'.indexOf(it.slot || 'A') : gp && gp.Slot !== undefined ? gp.Slot : -1; if (sl >= 0 && !nova) { porNaForja(w, sl, pecaAberta); slotSel = x.runa ? slotSel : sl; } pecaAberta = null; }
  const etiqueta = propria ? 'rune of the workshop' : armaMudou(a) ? (nova ? 'new weapon' : 'changed') : 'as in the game';
  const cab = `<div class="cabF"><h2>${esc(nomeDaArma(w))} <span class="etq ${armaMudou(a) ? 'custom' : ''}">${etiqueta}</span></h2><div class="botoes">${propria ? '<button class="sm perigo" id="fa_apaga">Delete this rune</button>' : armaMudou(a) ? '<button class="sm perigo" id="fa_volta">Back to the game’s weapon</button>' : ''}</div></div>`;
  const quem = x.runa ? 'A rune: any hero may take it, in the hero choice before a quest or in the armory, once the party has its rune (part A).' : `Weapon ${x.i + 1} of ${esc(nomeDoHeroi(x.heroi))} (${NOME_CLASSE[k]}).`;
  const nomeCampo = `<div class="duas">${propria || nova ? `<label class="campo">Name <input data-wnome="${w._id}" value="${esc(nova ? nova.nome || '' : a.nome || '')}" placeholder="${esc(nova ? (propria ? 'Name of the new rune' : 'Name of the new weapon') : w.name_en)}"></label>` : `<p class="ajuda">${esc(tr('A weapon of the game: its parts stay as in the game. Duplicate a part (✎ beside its name) to make one of your own from it, and put it together here.'))}</p>`}
    <label class="campo">${esc(tr('Category'))} <span class="linha"><select data-wcat>${opcoesCategoria(categoriaDaArma(w._id))}</select><button class="sm" data-novacat title="${esc(tr('New category'))}">+</button></span></label></div><p class="ajuda">${quem}</p>` +
    (propria ? `<label class="campo">Made from <select data-rbase>${RUNAS_JOGO().map(r => `<option value="${r._id}" ${a.base === r._id ? 'selected' : ''}>${esc(r.name_en)}${r._id === 'WEAPON_DRAGONSBANE' ? ' (Dragonsbane)' : ''}</option>`).join('')}</select></label><p class="ajuda">The game rune it copies: frame, figure and sounds in the app, and the pictures of the parts you leave as they are.</p>
      <label class="chk"><input type="checkbox" data-rinicio ${a.inicio ? 'checked' : ''}> The party has it from the start of the ${campanha ? 'campaign’s maps' : 'map'} (the heroes pick it in the hero choice)</label>` : '')
    + (nova ? `<label class="campo">Range <select data-nk="alcance">${ALCANCES.map(r => `<option ${(nova.alcance || ALCANCES[w.RangeApproximation] || 'Melee') === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>` : '');
  // (a new weapon in the place of a game one: only in projects made before; the parts of the workshop do it now)
  const modos = nova && !x.runa ? `<p class="ajuda aviso">${esc(tr('A new weapon in the place of this one (made in an older version). “Back to the game’s weapon” undoes it.'))}</p>` : '';
  c.innerHTML = `<div class="armasGrade"><div class="armasMeio" id="fa_meio"></div><div class="armasForja">${cab}<div class="ativ arma" data-arma="${w._id}">${nomeCampo}${modos}<div id="fa_forja"></div></div></div></div>`;
  // (the sheet keeps its scroll while the same weapon is redrawn: a part chosen, a piece forged…)
  c.scrollTop = yFicha;
  pintarMeio(w, x);
  ligarForja($('#fa_forja'), w).then(() => { if (_rolagemFicha === w._id && c.isConnected) c.scrollTop = yFicha; });
  const apaga = $('#fa_apaga'); if (apaga) apaga.onclick = () => { if (!confirm('Delete the rune “' + nomeDaArma(w) + '”?')) return; oficina().armas = oficina().armas.filter(z => z.id !== w._id); esquecerFicha('itens', 'RUNA:' + w._id); armaSel = null; forja = null; renderArmas(); };
  const rb = c.querySelector('[data-rbase]'); if (rb) rb.onchange = () => { a.base = rb.value; forja = null; renderArmas(); };
  const ri = c.querySelector('[data-rinicio]'); if (ri) ri.onchange = () => { a.inicio = ri.checked; renderArmas(); };
  const volta = $('#fa_volta'); if (volta) volta.onclick = () => { if (!confirm('Undo every change to the ' + w.name_en + '?')) return; oficina().armas = oficina().armas.filter(z => z.id !== w._id); forja = null; renderArmas(); };
  const wc = c.querySelector('[data-wcat]'); if (wc) wc.onchange = () => { if (wc.value) oficina().armasCat[w._id] = wc.value; else delete oficina().armasCat[w._id]; renderArmas(); };
  const nc = c.querySelector('[data-novacat]'); if (nc) nc.onclick = () => { const cat = novaCategoria(null); if (cat) { oficina().armasCat[w._id] = cat.id; renderArmas(); } };
  ligarArmas(c, w);
}
/* the middle column: the parts of the slot chosen on the left (a rune: its own parts), icon and name; the one in the
   forge is marked; a click puts it in the forge. A new part of the Workshop is made here too. */
let _cliqueMeio = {}, _rolagemMeio = { w: null, y: 0 }, _rolagemFicha = null;
function pintarMeio(w, x) {
  const el = $('#fa_meio'); if (!el) return; const k = x ? x.k : w.Class; const a = armaEditada(w._id) || {}; const nova = a.nova; const f = estadoDaForja(w);
  const runa = w.Class === 12; const s0 = runa ? null : slotSel;
  const linha = (id, img, nome, sub, s, propria) => `<div class="pecaMeio ${f.escolhidas[s] === id && !nova ? 'naForja' : ''}" ${propria ? `data-pecap="${esc(id)}"` : `data-peca="${esc(id)}"`} data-slotp="${s}" title="${esc(tr('Click: into the forge · double click: its stats'))}">${img ? `<img loading="lazy" decoding="async" ${imgTardia(img)} alt="">` : '<span class="semImg"></span>'}<div><b data-sem-traducao>${esc(nome)}</b><small>${esc(sub)}</small></div><button class="sm lapis" data-pstats title="${esc(tr(propria ? 'Its stats' : 'Its stats (a part of the game: duplicate it to change it)'))}">✎</button></div>`;
  let html;
  if (nova) {
    const sl = s0 === null ? 0 : s0; const q = (nova.pecas || {})['ABC'[sl]] || {};
    html = `<div class="sub">${'ABC'[sl]} · ${esc(EXPL_SLOT[sl][0])}</div><p class="ajuda">A new weapon has one part of each: its stats are on the right (✎ Stats).</p>`
      + `<div class="pecaMeio naForja" data-slotp="${sl}">${(q.imagem || imagemDaPeca(itemDoJogo((w.StartingWeaponParts || [])[sl]?.id))) ? `<img loading="lazy" decoding="async" ${imgTardia(q.imagem || imagemDaPeca(itemDoJogo((w.StartingWeaponParts || [])[sl]?.id)))} alt="">` : '<span class="semImg"></span>'}<div><b data-sem-traducao>${esc(q.nome || ['Head', 'Haft', 'Grip'][sl])}</b><small>${esc(tr('new weapon'))}</small></div></div>`;
  } else if (runa) {
    html = EXPL_RUNA.map(([sl, expl], s) => `<div class="sub pequena">${sl} · ${esc(expl)}</div>` + pecasDaArma(w).filter(p => p.Slot === s).map(p => { const e = (a.pecas || {})[p._id] || {};
      return linha(p._id, e.imagem || imagemDaPeca(p), ((n => n + (/_UPGRADED$/.test(p._id) && !/[+✚]\s*$/.test(n) ? ' +' : ''))(e.nome || semGlifo(p.name_en))), resumoPeca(p, e), s, false); }).join('')).join('');
  } else {
    const [nomeSlot, , explSlot] = EXPL_SLOT[s0]; const proprias = pecasPropriasDe(k, s0);
    proprias.forEach(i => { if (['New head', 'New haft', 'New grip'].includes(i.nome) && tr(i.nome) !== i.nome) i.nome = tr(i.nome); });   // (made before the names were translated)
    html = `<div class="cabMeio"><b>${'ABC'[s0]} · ${esc(nomeSlot)}</b><button class="sm primario" data-novapeca="${s0}" title="A new ${['head', 'haft', 'grip'][s0]} of the workshop for this weapon: an item the party gets from a trigger or crafts with a recipe">+ New ${['head', 'haft', 'grip'][s0]}</button></div><p class="ajuda">${esc(explSlot)}</p>`
      + pecasDaArma(w).filter(p => p.Slot === s0).map(p => { const e = (a.pecas || {})[p._id] || {}; return linha(p._id, e.imagem || imagemDaPeca(p), ((n => n + ((/_UPGRADED$/.test(p._id) || p.IsUpgrade) && !/[+✚]\s*$/.test(n) ? ' +' : ''))(e.nome || semGlifo(p.name_en))), resumoPeca(p, e) + (Object.keys(e).length ? ' · ' + tr('changed') : ''), s0, false); }).join('')
      + `<div class="sub pequena">New ${nomeSlot.toLowerCase()} of the workshop</div>`
      + (proprias.length ? proprias.map(it => linha(it.id, retratoDoItem(it), it.nome || '', 'workshop', s0, true)).join('') : `<p class="ajuda">None yet (“+ New ${nomeSlot.toLowerCase().replace(/s$/, '')}” above). A new ${nomeSlot.toLowerCase().replace(/s$/, '')} is an item: the party gets it from a “Give an item” trigger or crafts it with a recipe, and fits it in the armory.</p>`);
  }
  el.innerHTML = html;
  // (the column keeps its scroll while the same weapon is redrawn)
  if (_rolagemMeio.w === w._id) el.scrollTop = _rolagemMeio.y; _rolagemMeio = { w: w._id, y: el.scrollTop }; el.onscroll = () => { _rolagemMeio.y = el.scrollTop; };
  // (a click puts it in the forge; a double click, or ✎, opens its stats)
  el.querySelectorAll('[data-peca],[data-pecap]').forEach(d => { const id = d.dataset.peca || d.dataset.pecap, sl = +d.dataset.slotp;
    const stats = () => { if (!nova) porNaForja(w, sl, id); renderArmas(); abrirStats(w, sl); };
    // (the first click redraws the column: the second one is caught by the time and the part, not by the element)
    d.onclick = e => { if (e.target.closest('[data-pstats]')) return; const agora = Date.now(); if (_cliqueMeio.id === id && agora - _cliqueMeio.t < 450) { _cliqueMeio = {}; return stats(); } _cliqueMeio = { id, t: agora }; if (nova || f.escolhidas[sl] === id) return; porNaForja(w, sl, id); renderArmas(); };
    const b = d.querySelector('[data-pstats]'); if (b) b.onclick = e => { e.stopPropagation(); stats(); }; });
  const np = el.querySelector('[data-novapeca]'); if (np) np.onclick = () => { const sl = +np.dataset.novapeca; const nome = tr(['New head', 'New haft', 'New grip'][sl]);
    const it = { id: 'B_' + uid(), base: null, custom: true, cls: 'WeaponPartsModel', nome, desc: '', raridade: 1, valor: 50, imagemBase: '', retrato: '', classe: CLASSES_ARMA[k], slot: 'ABC'[sl], traits: sl ? [] : ['Slash'], dano: sl ? 0 : 3, habilidade: '', habTexto: '', habChance: 30, unico: false, digital: true, efeitoBase: '' };
    bestiario().itens.push(it); porNaForja(w, sl, it.id); renderArmas(); abrirStats(w, sl); };
}
function formPecaPropria(el, w, it, apos, aoApagar) {
  if (!it) return; const s = 'ABC'.indexOf(it.slot || 'A'); const inicio = itemDoJogo((w.StartingWeaponParts || [])[s]?.id);
  const hab = it.habilidade ? itemDoJogo(it.habilidade) : null;
  el.innerHTML = `<label class="campo">Name <input data-ik="nome" value="${esc(it.nome || '')}"></label>
    ${campoImagemPeca(it.retrato, imagemDaPeca(inicio), 'q')}
    <div class="duas"><label class="campo">Rarity <select data-ik="raridade">${RARIDADES.map((r, n) => n ? `<option value="${n}" ${it.raridade === n ? 'selected' : ''}>${r}</option>` : '').join('')}</select></label><label class="campo">Value (gold) <input type="number" min="0" data-ik="valor" value="${it.valor || 0}"></label></div>
    ${s === 0 ? `<label class="campo">Damage <input type="number" min="0" max="20" data-ik="dano" value="${it.dano ?? 3}" style="width:80px"></label><div class="chks tres">${DANOS.map(d => `<label class="chk"><input type="checkbox" data-itrait value="${d}" ${(it.traits || []).includes(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div>` : ''}
    <label class="campo">${s === 0 ? 'Power of the hero' : 'Ability'} <select data-ik="habilidade"><option value="">${s === 0 ? 'My own power (text)' : 'My own ability (text and chance)'}</option><option value="-" ${it.habilidade === '-' ? 'selected' : ''}>None</option>${habilidadesParaCopiar(s).map(x => `<option value="${x.a._id}" ${it.habilidade === x.a._id ? 'selected' : ''}>${L2('Copy: ', 'Cópia: ')}${esc(semGlifo(x.a.name_en || x.p.name_en))}${/_UPGRADED$/.test(x.p._id) ? ' +' : ''}${automatica(x.p) ? L2(' (automatic)', ' (automática)') : ''}</option>`).join('')}</select></label>
    ${it.habilidade && it.habilidade !== '-' ? `<p class="ajuda">${esc(textoDoJogo(hab && hab.desc_en))}</p>` : it.habilidade === '-' ? '' : `${s > 0 ? `<label class="campo">Chance (%) <input type="number" min="0" max="100" data-ik="habChance" value="${it.habChance ?? 30}" style="width:70px"></label>` : ''}<div class="txAtiv" data-itx></div>`}
    <label class="campo">${esc(tr('Category'))} <select data-icat>${opcoesCategoria(categoriaDaPeca(it))}</select></label>
    <p class="ajuda">An item of the workshop: give it with a “Give an item” trigger or craft it with a recipe; the heroes fit it in the armory.</p>
    <div class="sub">${esc(tr('Recipe'))}</div><div data-ireceitas></div>
    <div class="botoes"><button class="sm perigo" data-iapaga>Delete this part</button></div>`;
  const redes = () => (apos || renderArmas)();
  el.querySelectorAll('[data-ik]').forEach(inp => { const h = () => { const k = inp.dataset.ik; it[k] = inp.type === 'number' || k === 'raridade' ? +inp.value || 0 : inp.value;  if (inp.tagName === 'SELECT') redes(); }; if (inp.tagName === 'SELECT') inp.onchange = h; else inp.oninput = h; });
  el.querySelectorAll('[data-itrait]').forEach(cb => cb.onchange = () => { it.traits = [...el.querySelectorAll('[data-itrait]:checked')].map(z => z.value); });
  const up = el.querySelector('[data-qimg]'); if (up) up.onchange = async e => { const f = e.target.files[0]; if (!f) return; it.retrato = await lerImagem(f, 512); esquecerAjuste(it, 'retrato'); redes(); };
  const es = el.querySelector('[data-qesp]'); if (es) es.onclick = () => pintarImagemPeca(it, 'retrato', it.nome || '', redes);
  const vj = el.querySelector('[data-qimgjogo]'); if (vj) vj.onclick = () => { it.retrato = ''; redes(); };
  const tam = el.querySelector('[data-qtam]'); const ij = imagemDaPeca(inicio); if (tam && ij) { const im = new Image(); im.onload = () => { tam.textContent = im.naturalWidth + '×' + im.naturalHeight + ' px'; }; im.src = ij; }
  const tx = el.querySelector('[data-itx]'); if (tx) { const obj = { text: it.habTexto || '', hint: '' }; editorDeTexto(tx, obj, () => { it.habTexto = obj.text; }, { soRegras: true, exemploNome: s === 0 ? 'Heavy Blow' : 'Bleed', exemploRegras: s === 0 ? 'Spend 1 [fatigue]: add 2 [damage].' : 'The target suffers 1 [damage].' }); }
  const ic = el.querySelector('[data-icat]'); if (ic) ic.onchange = () => { if (ic.value) it.categoria = ic.value; else delete it.categoria; redes(); };
  const ir = el.querySelector('[data-ireceitas]'); if (ir) { const refazer = () => editorDeReceitas(ir, it, refazer); refazer(); }
  el.querySelector('[data-iapaga]').onclick = () => { if (!confirm('Delete “' + it.nome + '”?')) return; const l = bestiario().itens; l.splice(l.indexOf(it), 1); tirarReceitasDoItem(it); esquecerFicha('itens', it.id); pecaAberta = null; if (forja) forja.escolhidas = forja.escolhidas.map((x, n) => x === it.id ? forja.inicio[n] : x); if (aoApagar) aoApagar(); else redes(); };
}
function resumoPeca(p, e) {
  const hab = habilidadeDe(p); const dano = e && e.dano !== undefined ? e.dano : p.Damage; const tr = e && e.traits ? e.traits : (p.Traits || []).map(t => DANOS[t]);
  const ch = e && e.chance !== undefined ? e.chance : hab ? Math.round(hab.Chance * 100) : 0;
  return [e && e.imagem ? 'own picture' + (e.molde ? ' (box fixed)' : '') : '', p.Slot === 0 ? dano + ' damage' + (tr.length ? ' · ' + tr.join(', ') : '') : '', p.Slot > 0 && hab ? ch + '%' : '', !hab ? 'no ability' : ''].filter(Boolean).join(' · ');
}
/* a part of the game: as it is in the game (it is not changed here). "Duplicate" makes a part of the workshop from it, the
   same in everything, that can be changed and goes in the forge. Changes made in older versions show, with a way back. */
function formPeca(el, w, p, apos) {
  const hab = habilidadeDe(p); const a = armaEditada(w._id) || {}; const e = (a.pecas || {})[p._id] || {};
  const tr0 = e.traits || (p.Traits || []).map(t => DANOS[t]); const ch = hab ? (e.chance ?? Math.round(hab.Chance * 100)) : 0;
  el.innerHTML = `<p class="ajuda aviso">${esc(tr('A part of the game: it stays as in the game. Duplicate it to make one of your own, the same in everything, to change and to put together in the forge.'))}</p>
    <div class="retrato imgPeca"><div class="quadro"><img loading="lazy" decoding="async" ${imgTardia(e.imagem || imagemDaPeca(p))} alt=""></div><div><b data-sem-traducao>${esc(semGlifo(e.nome || p.name_en))}</b>
      ${p.Slot === 0 ? `<p>${esc(tr('Damage'))}: ${e.dano ?? p.Damage} · ${tr0.map(d => esc(tr(d))).join(', ')}</p>` : ''}${hab && p.Slot > 0 ? `<p>${esc(tr('Chance'))}: ${ch}%</p>` : ''}</div></div>
    ${hab ? `<div class="sub pequena">${p.Slot === 0 ? 'Power of the hero (spend to use)' : 'Ability'}</div><div class="previaTx caixaApp" data-sem-traducao>${tmpParaHtml(e.texto || hab.desc_en || '', vagasDe(e.texto || hab.desc_en || '', ['monster', 'hero']))}</div>` : '<p class="ajuda">No ability (a starting part).</p>'}
    <div class="botoes"><button class="sm primario" data-pdup>⧉ ${esc(tr('Duplicate'))}</button>${Object.keys(e).length ? `<button class="sm" data-pvolta>${esc(tr('Back to the game’s part'))}</button>` : ''}</div>
    <div class="sub">${esc(tr('Recipe'))}</div><div data-preceitas></div>`;
  // (v241: the recipes of a part of the game, and of its upgraded version, are edited here)
  const pr = el.querySelector('[data-preceitas]'); if (pr) { const alvo = { id: p._id, base: p._id, nome: semGlifo(p.name_en) }; const refazer = () => editorDeReceitas(pr, alvo, refazer); refazer(); }
  el.querySelector('[data-pdup]').onclick = () => { const it = duplicarPeca(w, p); porNaForja(w, p.Slot, it.id); pecaAberta = null; slotSel = w.Class === 12 ? slotSel : p.Slot;
    const m = [...document.querySelectorAll('.modal')].pop(); if (m && m.contains(el)) m.remove(); limparArmas(); renderArmas(); abrirStats(w, p.Slot); aviso(tr('Duplicated: this part is yours to change.')); };
  const v = el.querySelector('[data-pvolta]'); if (v) v.onclick = () => { const a2 = armaEditada(w._id); if (a2 && a2.pecas) delete a2.pecas[p._id]; pecaAberta = null; apos(); };
}
/* a part of the game copied as a part of the workshop: name, picture, damage and its types, ability (the copy keeps what the
   app does with it) and chance */
function duplicarPeca(w, p) {
  const e = ((armaEditada(w._id) || {}).pecas || {})[p._id] || {}; const hab = habilidadeDe(p);
  const it = { id: 'B_' + uid(), base: null, custom: true, cls: 'WeaponPartsModel', nome: semGlifo(e.nome || p.name_en) + ' ' + tr('(copy)'), desc: '', raridade: p.Rarity || 1, valor: p.Value || 50, imagemBase: '',
    retrato: e.imagem || imagemDaPeca(p) || '', classe: CLASSES_ARMA[w.Class], slot: 'ABC'[p.Slot], traits: e.traits || (p.Traits || []).map(t => DANOS[t]), dano: e.dano ?? (p.Damage || 0),
    habilidade: hab ? hab._id : '-', habTexto: e.texto || '', habChance: hab ? (e.chance ?? Math.round(hab.Chance * 100)) : 30, unico: false, digital: true, efeitoBase: '' };
  if (e.molde) { it.molde = e.molde.slice(); it.moldeArma = w._id; }
  bestiario().itens.push(it); return it;
}
/* abilities of the game that a new part may copy (same slot): the copy keeps what the app does with it */
const _habsCopiar = {};   // by slot: the catalog does not change
function habilidadesParaCopiar(s) {
  if (_habsCopiar[s]?.length) return _habsCopiar[s];
  const vistas = new Set(); return _habsCopiar[s] = CAT.itens.filter(i => i._cls === 'WeaponPartsModel' && i.Slot === s && i.Ability && i.Ability.id).map(p => ({ p, a: habilidadeDe(p) })).filter(x => x.a && !vistas.has(x.a._id) && vistas.add(x.a._id))
    .sort((x, y) => (x.a.name_en || '').localeCompare(y.a.name_en || ''));
}
function formArmaNova(w, n, soSlot, semAlcance) {
  n.pecas = n.pecas || {};
  return (semAlcance ? '' : `<label class="campo">Range <select data-nk="alcance">${ALCANCES.map(r => `<option ${(n.alcance || ALCANCES[w.RangeApproximation] || 'Melee') === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <p class="ajuda">${w._runaPropria ? 'A rune of its own, made from the ' + esc(itemDoJogo(armaEditada(w._id)?.base)?.name_en || 'game rune') + ' (same frame, figure and sounds). The rune (part A) is what the party receives; with it any hero may take the weapon.' : 'It takes the place of the ' + esc(w.name_en) + ' while the ' + (campanha ? 'campaign' : 'map') + ' is played (same figure and sounds), in the hands of whoever has it. Upgrades bought in the campaign do not apply to it.'}</p>`) +
    SLOTS_ARMA.map(([sl, expl], s) => { if (soSlot !== null && soSlot !== undefined && s !== soSlot) return ''; const q = n.pecas[sl] || {}; const hab = q.copia ? itemDoJogo(q.copia) : null;
      return `<div class="ativ novaPeca"><div class="sub pequena">${sl} · ${expl}</div>
        <label class="campo">Name <input data-np="${sl}" data-nq="nome" value="${esc(q.nome || '')}" placeholder="${['Head', 'Haft', 'Grip'][s]}"></label>
        <div data-nimg="${sl}">${campoImagemPeca(q.imagem, imagemDaPeca(itemDoJogo((w.StartingWeaponParts || [])[s]?.id)), 'n')}${q.molde ? '<p class="ajuda">Box fixed: the app draws this picture in the box you set in “Assemble”.</p>' : ''}</div>
        ${s === 0 ? `<label class="campo">Damage <input type="number" min="0" max="20" data-np="${sl}" data-nq="dano" value="${q.dano ?? 3}" style="width:80px"></label><div class="chks tres">${DANOS.map(d => `<label class="chk"><input type="checkbox" data-ntrait="${sl}" value="${d}" ${(q.traits || []).includes(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div>` : ''}
        <label class="campo">Ability <select data-np="${sl}" data-nq="copia"><option value="">${s === 0 ? 'My own power (text)' : 'My own ability (text and chance)'}</option><option value="-" ${q.copia === '-' ? 'selected' : ''}>None</option>${habilidadesParaCopiar(s).map(x => `<option value="${x.a._id}" ${q.copia === x.a._id ? 'selected' : ''}>${L2('Copy: ', 'Cópia: ')}${esc(semGlifo(x.a.name_en || x.p.name_en))}${/_UPGRADED$/.test(x.p._id) ? ' +' : ''}${automatica(x.p) ? L2(' (automatic)', ' (automática)') : ''}</option>`).join('')}</select></label>
        ${q.copia && q.copia !== '-' ? `<p class="ajuda">${esc(textoDoJogo(hab && hab.desc_en))}${hab && s > 0 ? ' (' + Math.round(hab.Chance * 100) + '%)' : ''}</p>` : q.copia === '-' ? '' : `${s > 0 ? `<label class="campo">Chance (%) <input type="number" min="0" max="100" data-np="${sl}" data-nq="chance" value="${q.chance ?? 30}" style="width:70px"></label>` : ''}<div class="txAtiv" data-ntx="${sl}"></div><p class="ajuda">The app shows this text when it triggers; the players apply it.</p>`}
      </div>`; }).join('');
}
function ligarArmas(c, w) {
  const apos = () => { limparArmas(); renderArmas(); };
  const ed = () => armaParaEditar(w._id);
  c.querySelectorAll('[data-wnome]').forEach(inp => inp.oninput = () => { const a = ed(); const v = inp.value.trim(); if (a.nova) a.nova.nome = v; else if (v) a.nome = v; else delete a.nome; c.querySelector('h2').firstChild.textContent = nomeDaArma(w) + ' '; });
  c.querySelectorAll('[data-wmodo]').forEach(b => b.onclick = () => { const a = ed(); if (b.dataset.wmodo === 'nova') { if (!a.nova) a.nova = { nome: '', pecas: { A: { dano: 3, traits: ['Slash'] }, B: {}, C: {} } }; } else if (a.nova && confirm('Drop the new weapon and go back to the game’s?')) delete a.nova; forja = null; apos(); });
  const novaDe = () => ed().nova;
  c.querySelectorAll('[data-nk]').forEach(s => s.onchange = () => { novaDe()[s.dataset.nk] = s.value; });
}
/* the stats of a part of a new weapon (its window): name, picture, damage, damage types, ability */
function ligarArmaNova(c, w, apos) {
  const ed = () => armaParaEditar(w._id); const novaDe = () => ed().nova;
  c.querySelectorAll('[data-np]').forEach(inp => { const h = () => { const n = novaDe(); const q = (n.pecas[inp.dataset.np] = n.pecas[inp.dataset.np] || {}); const k = inp.dataset.nq; q[k] = inp.type === 'number' ? +inp.value : inp.value; if (k === 'copia') apos(); }; if (inp.tagName === 'SELECT') inp.onchange = h; else inp.oninput = h; });
  c.querySelectorAll('[data-ntrait]').forEach(cb => cb.onchange = () => { const n = novaDe(); const sl = cb.dataset.ntrait; (n.pecas[sl] = n.pecas[sl] || {}).traits = [...cb.closest('.novaPeca').querySelectorAll('[data-ntrait]:checked')].map(z => z.value); });
  c.querySelectorAll('[data-nimg]').forEach(d => { const sl = d.dataset.nimg; const n = novaDe(); ligarImagemPeca(d, 'n', () => (n.pecas[sl] = n.pecas[sl] || {}), apos, imagemDaPeca(itemDoJogo((w.StartingWeaponParts || [])[['A', 'B', 'C'].indexOf(sl)]?.id))); });
  c.querySelectorAll('[data-ntx]').forEach(d => { const n = novaDe(); const q = (n.pecas[d.dataset.ntx] = n.pecas[d.dataset.ntx] || {}); const obj = { text: q.texto || '', hint: '' }; editorDeTexto(d, obj, () => { q.texto = obj.text; }, { soRegras: true, exemploNome: 'Thunderclap', exemploRegras: 'The target is dazed.' }); });
}

/* the picture of a weapon part: the piece drawn in the weapon (the game lays the three pieces A, B and C over each
   other in the weapon's frame) and its icon in the lists. Same proportions as the game's piece fit best. */
function campoImagemPeca(propria, doJogo, pre) {
  const atual = propria || doJogo;
  return `<div class="retrato imgPeca"><div class="quadro">${atual ? `<img loading="lazy" decoding="async" ${imgTardia(atual)} alt="" data-${pre}medida>` : '<span>no picture</span>'}</div><div>
    <label class="sm botaoArquivo">Upload a picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-${pre}img hidden></label>
    ${propria ? `<button class="sm" data-${pre}esp title="Zoom on this piece alone and paint over it, in any colour, or erase what should not show">🖌 Fine tuning</button><button class="sm" data-${pre}imgjogo>Use the game’s</button>` : ''}
    <p class="ajuda" data-${pre}dica>The piece as drawn in the weapon. Transparent PNG, ideally the same shape as the game’s${doJogo ? ' (<span data-' + pre + 'tam>…</span>)' : ''}.</p></div></div>`;
}
/* 🖌 Fine tuning from the stats of a part (the same painter as the forge's): the painted picture takes the place of the
   old one, which Reset (on the piece's row in the forge) brings back; in the forge the piece keeps its place and size */
function pintarImagemPeca(x, campo, nome, apos) {
  const src = x[campo]; if (!src) return; const i = new Image();
  i.onload = () => ajusteFino(i, nome, (png, fator) => {
    const antes = campo === 'retrato' ? 'retratoAntesDaForja' : 'imagemAntesDaForja'; if (!(antes in x)) x[antes] = src; x[campo] = png; esquecerAjuste(x, campo);
    (forja?.camadas || []).forEach(c => { if (c.img && c.src === src) { c._posDesfeita = { x: c.x, y: c.y, k: c.k / fator, r: c.r || 0, ex: c.ex || 1, ey: c.ey || 1, fx: c.fx || 1, fy: c.fy || 1 }; c.src = null; } });
    limparArmas(); apos(); aviso(tr('Painted: the piece keeps its new picture.')); });
  i.src = src;
}
/* an uploaded picture goes to the game's box (a forged box belonged to the picture it was baked with) */
function ligarImagemPeca(el, pre, alvo, apos, doJogo) {
  const up = el.querySelector(`[data-${pre}img]`); if (up) up.onchange = async e => { const f = e.target.files[0]; if (!f) return; const x = alvo(); x.imagem = await lerImagem(f, 512); esquecerAjuste(x, 'imagem'); delete x.molde; apos(); };
  const es = el.querySelector(`[data-${pre}esp]`); if (es) es.onclick = () => { const x = alvo(); if (x.imagem) pintarImagemPeca(x, 'imagem', tr('the picture'), apos); };
  const vj = el.querySelector(`[data-${pre}imgjogo]`); if (vj) vj.onclick = () => { const x = alvo(); delete x.imagem; delete x.molde; esquecerAjuste(x, 'imagem'); apos(); };
  const tam = el.querySelector(`[data-${pre}tam]`); if (tam && doJogo) { const i = new Image(); i.onload = () => { tam.textContent = i.naturalWidth + '×' + i.naturalHeight + ' px'; }; i.src = doJogo; }
}

// ------------------------------------------------------------ assembling a weapon (drag the pieces, forge the template, bake)
/* where the app puts each piece of each weapon: centre (x right, y up, from the middle of the weapon frame) and size of
   the box A, B and C; the piece is fitted in its box keeping its proportions. "rot": the whole set is turned (degrees). */
const MOLDES_ARMA = {"bow":{"A":[-41.5,0.0,163.9,479.6],"B":[11.8,0.0,18.8,458.7],"C":[82.6,0.0,58.0,369.0],"ordem":"BAC"},"crossbow":{"A":[-13.3,-33.2,354.0,291.0],"B":[6.9,-2.0,372.0,262.0],"C":[-25.6,111.8,188.0,104.0],"ordem":"CBA"},"dragonsbane":{"A":[0.0,0.0,318.0,500.0],"B":[0.0,0.0,318.0,500.0],"C":[0.0,0.0,318.0,500.0]},"dualblades":{"A":[20.5,56.7,277.0,378.0],"B":[106.3,-48.9,200.0,237.0],"C":[-48.3,-124.1,306.0,234.0],"ordem":"BAC"},"gauntlet":{"A":[100.8,-90.7,206.0,221.0],"B":[63.8,-70.3,211.0,221.0],"C":[-63.0,89.6,285.0,288.0],"ordem":"BAC"},"hammer":{"A":[51.5,90.3,312.0,247.0],"B":[-20.5,-5.5,152.0,167.0],"C":[-121.0,-125.9,165.0,150.0],"ordem":"ABC"},"knives":{"A":[-5.3,-77.6,248.0,248.0],"B":[22.4,-37.4,208.0,210.0],"C":[31.7,6.0,409.0,368.0],"ordem":"CBA"},"runefear":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runeice":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runelightning":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runeofblades":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runesunburst":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"spear":{"A":[-0.2,179.0,126.4,148.6],"B":[-0.0,-27.8,40.9,335.5],"C":[-1.5,-206.1,94.3,89.9],"ordem":"ACB"},"staff":{"A":[0.0,0.0,122.0,512.0],"B":[12.9,-21.8,91.0,248.0],"C":[0.0,0.0,122.0,512.0],"ordem":"CAB"},"sword":{"A":[-20.4,83.4,184.0,337.0],"B":[8.9,-68.8,186.0,98.0],"C":[8.6,-161.1,49.0,173.0],"ordem":"ACB"},"wand":{"A":[25.4,48.2,372.0,360.0],"B":[-105.9,-71.8,132.0,151.0],"C":[-146.7,-157.5,132.0,151.0],"ordem":"ABC"},"warbell":{"A":[0.1,-169.1,190.0,168.0],"B":[-2.4,147.6,108.0,213.0],"C":[0.4,-39.6,61.0,187.0],"ordem":"BCA"},"warhammer":{"A":[78.9,151.2,184.0,155.0],"B":[-28.3,-23.5,160.0,364.0],"C":[-139.0,-201.0,61.0,83.0],"rot":-13.09,"ordem":"CAB"}};
const moldeDaArma = w => MOLDES_ARMA[(w?._bundle || '').split('/').pop()];
/* the slots from the one drawn first to the one on top, as in the game's prefab (Image_Bottom, _Middle, _Top); the spear's
   pieces are drawn at 89% of their frames there, and its boxes here are that size */
const ordemDaArma = w => [...((moldeDaArma(w) || {}).ordem || 'ABC')].map(l => 'ABC'.indexOf(l));
/* a forged box, relative to the game's box of the slot: the shift of the centre along the box's own axes (in box
   widths and heights, y up) and the change of size. The mod applies it to the picture's frame in the app. */
function formaForjada(w, s, molde) {
  const lay = moldeDaArma(w); if (!lay || !molde) return null; const g = lay['ABC'[s]]; const phi = -(lay.rot || 0) * Math.PI / 180;
  const dx = molde[0] - g[0], dy = -(molde[1] - g[1]);   // canvas axes (y down)
  const u = (dx * Math.cos(phi) + dy * Math.sin(phi)) / g[2], vBaixo = (-dx * Math.sin(phi) + dy * Math.cos(phi)) / g[3];
  const r = n => Math.round(n * 10000) / 10000;
  return { x: r(u), y: r(-vBaixo), w: r(molde[2] / g[2]), h: r(molde[3] / g[3]) };
}
const mesmaCaixa = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 0.5);
/* the forge, always open on the right of a weapon's sheet. forja: the weapon in it, the part in each slot (game mode;
   a new weapon has its own three), each piece where it was left (dragged, sized, turned: kept while the tab is redrawn,
   until another weapon), the box of each piece (the game's, or one fixed here) and the piece chosen. */
let forja = null;
let areaForja = null;   // what Ctrl+C took on the forge (a piece's or a box's place, size and turn)
let _fundoForja = null;
const fundoDaForja = () => { if (!_fundoForja) { _fundoForja = new Image(); _fundoForja.onload = () => { const t = document.querySelector('#mt_tela'); if (t && t._pintar) t._pintar(); }; _fundoForja.src = FUNDO_FORJA; } return _fundoForja; };
function estadoDaForja(w) {
  const nova = !!(armaEditada(w._id) || {}).nova;
  if (forja && forja.wid === w._id && forja.nova === nova) return forja;
  const inicio = (w.StartingWeaponParts || []).map(r => r.id);
  forja = { wid: w._id, nova, inicio, escolhidas: [0, 1, 2].map(s => inicio[s]), camadas: [0, 1, 2].map(s => ({ s, img: null, src: null, x: 0, y: 0, k: 1, r: 0, ex: 1, ey: 1, fx: 1, fy: 1 })), moldes: [null, null, null], sel: -1, mexida: false };
  return forja;
}
const pecaPropriaDaArma = id => ITENS_B().find(i => i.id === id && i.cls === 'WeaponPartsModel');
/* a part goes in its slot of the forge: its picture and its box (the one forged with it, or the game's) */
function porNaForja(w, s, id) { const f = estadoDaForja(w); if (s < 0 || s > 2 || !id) return; f.escolhidas[s] = id; f.moldes[s] = null; f.sel = s; }
function entradaDaForja(w, s) {
  const f = estadoDaForja(w); const a = armaEditada(w._id) || {}; if (a.nova) return (a.nova.pecas || {})['ABC'[s]] || {};
  const it = pecaPropriaDaArma(f.escolhidas[s]); if (it) return { imagem: it.retrato || '', ...(it.molde && it.moldeArma === w._id ? { molde: it.molde } : {}) };
  return ((a.pecas || {})[f.escolhidas[s]]) || {};
}
function fonteDaForja(w, s) { const f = estadoDaForja(w); const a = armaEditada(w._id) || {}; return entradaDaForja(w, s).imagem || imagemDaPeca(itemDoJogo(a.nova || pecaPropriaDaArma(f.escolhidas[s]) ? f.inicio[s] : f.escolhidas[s])); }
function nomeNaForja(w, s) {
  const f = estadoDaForja(w); const a = armaEditada(w._id) || {};
  if (a.nova) return ((a.nova.pecas || {})['ABC'[s]] || {}).nome || tr(['Head', 'Haft', 'Grip'][s]);
  const it = pecaPropriaDaArma(f.escolhidas[s]); if (it) return it.nome || '';
  const p = itemDoJogo(f.escolhidas[s]); const e = (a.pecas || {})[f.escolhidas[s]] || {}; return e.nome || (p ? semGlifo(p.name_en) : '?');
}
async function ligarForja(el, w) {
  if (!el) return;
  const wid = w._id; const lay = moldeDaArma(w); const f = estadoDaForja(w);
  // (a part of the game stays as it is: only the parts of the workshop (and a new weapon of an older project) move)
  const editavel = k => !!((armaEditada(wid) || {}).nova || pecaPropriaDaArma(f.escolhidas[k]));
  const linhasPecas = [0, 1, 2].map(s => `<div class="mtPeca ${editavel(s) ? '' : 'doJogo'}" data-mts="${s}"><b>${'ABC'[s]}</b><span class="mtNome" data-sem-traducao>${esc(nomeNaForja(w, s))}</span><button class="sm lapis" data-stats="${s}" title="${esc(tr('Its stats'))}">✎</button><small class="etq mtForjada" data-mtforjada="${s}" title="${esc(tr('Forged'))}">✔</small>${editavel(s) ? `<button class="sm primario mtForjar" data-forjar="${s}" title="${esc(tr('Keep this piece as it is now (only this one): in the game too'))}">⚒ Forge</button><button class="sm mtRedef" data-redefinir="${s}" title="${esc(tr('Undo what was forged, painted or moved on this piece (only this one): its picture and its place of before'))}">↺ Reset</button>` : `<small class="etq">${esc(tr('of the game'))}</small>`}</div>`).join('');
  if (!lay) { el.innerHTML = `<div class="forjaLado semMolde">${linhasPecas}<p class="ajuda">${esc(tr('No layout known for this weapon.'))}</p></div>`;
    el.querySelectorAll('[data-stats]').forEach(b => b.onclick = () => abrirStats(w, +b.dataset.stats)); el.querySelectorAll('[data-mtforjada]').forEach(d => { d.style.display = 'none'; }); return; }
  const jogo = s => lay['ABC'[s]].slice(0, 4);
  const ordemDoJogo = ordemDaArma(w), ordem = () => ordemDoJogo;   // the pieces drawn in the game's order (its prefab)
  [0, 1, 2].forEach(s => { if (!f.moldes[s]) f.moldes[s] = (entradaDaForja(w, s).molde || jogo(s)).slice(); });
  const moldes = f.moldes, camadas = f.camadas;
  const phi = -(lay.rot || 0) * Math.PI / 180;   // canvas angle (y down) of the weapon in the app
  /* the box of a piece (hidden): where the app draws its picture. It follows the piece: on Forge it becomes the box around it */
  const caixa = s => { const b = moldes[s]; return { cx: b[0], cy: -b[1], w: b[2], h: b[3] }; };
  let arrasto = null;
  const normal = c => { c.ex = c.ex || 1; c.ey = c.ey || 1; c.fx = c.fx === -1 ? -1 : 1; c.fy = c.fy === -1 ? -1 : 1; };
  const ajustar = c => { const b = caixa(c.s); if (!c.img) return; c.k = Math.min(b.w / c.img.naturalWidth, b.h / c.img.naturalHeight); c.x = b.cx; c.y = b.cy; c.r = 0; c.ex = c.ey = c.fx = c.fy = 1; };
  const carregar = (c, src) => new Promise(ok => { c.src = src; if (!src) { c.img = null; return ok(); } const i = new Image(); i.onload = () => { c.img = i; ok(); }; i.onerror = () => { c.img = null; ok(); }; i.src = src; });
  const L = 620;
  el.innerHTML = `<p class="ajuda">${esc(tr('Pick the parts in the middle column (a double click, or ✎, opens the stats of one). To change a piece, first choose A, B or C on the right; then, on its square, drag it, pull the corners (size) or the sides (stretch or shorten it) and turn it by the round handle (Shift: by 15°; or Q/E, the wheel for the size); mirror it, and paint over it or erase parts of it (🖌 Fine tuning). A double click on another piece (where it is alone) makes it the chosen one. The parts of the game stay as they are; the ones of the workshop change.'))}</p><p class="ajuda">${esc(tr('⚒ Forge, on the row of a piece, keeps that piece as it is now (only that one), in the game too. ↺ Reset, beside it, undoes what was forged, painted or moved on that piece only.'))}${lay.rot ? ' <span>In the app this weapon is turned ' + Math.abs(lay.rot) + '°.</span>' : ''}</p>
    <div class="montagem"><canvas id="mt_tela" width="${L}" height="${L}" tabindex="0"></canvas><div class="mtLado">
      ${linhasPecas}
      <p class="ajuda" id="mt_nada">${esc(tr('Choose A, B or C above to change a piece.'))}</p>
      <div class="mtAjustes">
        <p class="ajuda mtMedidas" id="mt_medidas"></p>
        <div class="botoes mtBotoes"><button class="sm" id="mt_fx" title="Mirror left to right (H)">⇋ Mirror</button><button class="sm" id="mt_fy" title="Mirror top to bottom (V)">⇵ Flip</button><button class="sm" id="mt_fino" title="Zoom on this piece alone and paint over it, in any colour, or erase what should not show">🖌 Fine tuning</button></div>
      </div>
      <p class="ajuda mtAviso" id="mt_aviso" ${f.mexida ? '' : 'hidden'}>${esc(tr('Not forged yet: Forge keeps it.'))}</p>
      <div class="botoes"><button class="sm" id="mt_png">Download the template (PNG)</button></div>
    </div></div>`;
  const tela = el.querySelector('#mt_tela'), g = tela.getContext('2d'), $m = id => el.querySelector('#' + id);
  const mexeu = () => { f.mexida = true; camadas[f.sel].mexida = true; const av = $m('mt_aviso'); if (av) av.hidden = false; };
  const podeMexer = () => { if (f.sel < 0) { aviso(tr('Choose A, B or C on the right first.')); return false; } if (editavel(f.sel)) return true; aviso(tr('A part of the game stays as it is: duplicate it (✎) to move one of your own.')); return false; };
  // (a piece already in place keeps its position; a new part, or a new picture, is fitted in its box)
  // (after an undo (Ctrl+Z) each piece goes back where it was, not fitted again)
  const nasPosicoes = c => { if (c._posDesfeita) { Object.assign(c, c._posDesfeita); delete c._posDesfeita; return true; } return false; };
  await Promise.all(camadas.map(c => { const src = fonteDaForja(w, c.s); if (c.img && c.src === src) { nasPosicoes(c); normal(c); return null; } return carregar(c, src).then(() => { if (!nasPosicoes(c)) ajustar(c); normal(c); }); }));
  if (!tela.isConnected) return;
  // (a piece: its picture at its place, turned with the weapon and on its own, sized, stretched and mirrored)
  const angulo = c => phi + (c.r || 0) * Math.PI / 180;
  const escalas = c => [c.k * (c.ex || 1), c.k * (c.ey || 1)];
  const desenharCamada = (ctx, c) => { if (!c.img) return; const [sx, sy] = escalas(c); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(angulo(c)); ctx.scale(sx * (c.fx || 1), sy * (c.fy || 1)); ctx.drawImage(c.img, -c.img.naturalWidth / 2, -c.img.naturalHeight / 2); ctx.restore(); };
  const meias = c => { const [sx, sy] = escalas(c); return [c.img.naturalWidth * sx / 2, c.img.naturalHeight * sy / 2]; };   // half width and height on screen
  const nosEixos = (c, px, py) => { const a = angulo(c), dx = px - c.x, dy = py - c.y; return [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)]; };
  const doEixo = (c, u, v) => { const a = angulo(c); return [c.x + u * Math.cos(a) - v * Math.sin(a), c.y + u * Math.sin(a) + v * Math.cos(a)]; };
  const ALCAS_PECA = [[-1, -1, 'canto'], [1, -1, 'canto'], [1, 1, 'canto'], [-1, 1, 'canto'], [0, -1, 'lado'], [1, 0, 'lado'], [0, 1, 'lado'], [-1, 0, 'lado']];
  const GIRO_ALTURA = 28;
  const naPeca = (s, px, py) => { const c = camadas[s]; if (!c.img) return false; const [u, v] = nosEixos(c, px, py), [mw, mh] = meias(c); return Math.abs(u) <= mw && Math.abs(v) <= mh; };
  const naAlca = (px, py) => { const s = f.sel; if (s < 0 || !camadas[s].img || !editavel(s)) return null; const c = camadas[s]; const [u, v] = nosEixos(c, px, py), [mw, mh] = meias(c);
    if (Math.hypot(u, v + mh + GIRO_ALTURA) <= 10) return { tipo: 'giro' };
    const h = ALCAS_PECA.find(([hx, hy]) => Math.abs(u - hx * mw) <= 9 && Math.abs(v - hy * mh) <= 9); return h ? { tipo: h[2], hx: h[0], hy: h[1] } : null; };
  const pintar = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L, L); g.fillStyle = '#2a2e36'; g.fillRect(0, 0, L, L);
    g.setTransform(1, 0, 0, 1, L / 2, L / 2);
    // (the forge seen from above: the weapon lies on the anvil's face, its centre on the centre of the canvas)
    if (fundoDaForja().complete && fundoDaForja().naturalWidth) { const S = L * 1.3, b = FUNDO_FORJA_BIGORNA; g.drawImage(fundoDaForja(), -b.x * S, -b.y * S, S, S); g.fillStyle = 'rgba(16,12,8,.18)'; g.fillRect(-L / 2, -L / 2, L, L); }
    ordem().forEach(sI => desenharCamada(g, camadas[sI]));
    if (f.sel >= 0 && camadas[f.sel].img) { const c = camadas[f.sel], [mw, mh] = meias(c), cor = ['#ff7a62', '#7fb0ff', '#7fd68a'][f.sel], ed = editavel(f.sel);
      g.save(); g.translate(c.x, c.y); g.rotate(angulo(c)); g.strokeStyle = cor; g.lineWidth = 1.5; g.setLineDash([6, 4]); g.strokeRect(-mw, -mh, mw * 2, mh * 2); g.setLineDash([]);
      if (ed) { g.beginPath(); g.moveTo(0, -mh); g.lineTo(0, -mh - GIRO_ALTURA + 7); g.stroke(); g.fillStyle = '#fff'; g.lineWidth = 2;
        ALCAS_PECA.forEach(([hx, hy, t]) => { g.beginPath(); if (t === 'canto') g.rect(hx * mw - 5, hy * mh - 5, 10, 10); else g.arc(hx * mw, hy * mh, 5, 0, Math.PI * 2); g.fill(); g.stroke(); });
        g.beginPath(); g.arc(0, -mh - GIRO_ALTURA, 7, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = cor; g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('↻', 0, -mh - GIRO_ALTURA + 1); }
      g.restore(); }
    el.querySelectorAll('[data-mts]').forEach(d => d.classList.toggle('ativo', +d.dataset.mts === f.sel));
    el.querySelectorAll('[data-mtforjada]').forEach(d => { d.style.display = mesmaCaixa(moldes[+d.dataset.mtforjada], jogo(+d.dataset.mtforjada)) ? 'none' : ''; });
    const nada = $m('mt_nada'); if (nada) nada.hidden = f.sel >= 0;
    el.querySelectorAll('.mtAjustes input, .mtAjustes button').forEach(x => { x.disabled = f.sel < 0; });
    if (f.sel < 0 || !camadas[f.sel].img) { $m('mt_medidas').textContent = ''; return; }
    const c = camadas[f.sel], [mw, mh] = meias(c);
    $m('mt_medidas').textContent = Math.round(mw * 2) + ' × ' + Math.round(mh * 2) + ' · ' + Math.round(c.r || 0) + '°' + (c.fx === -1 ? ' · ⇋' : '') + (c.fy === -1 ? ' · ⇵' : '');
    $m('mt_fx').classList.toggle('primario', c.fx === -1); $m('mt_fy').classList.toggle('primario', c.fy === -1); };
  /* choosing a piece (its row on the right, or a double click on it) also shows its slot in the middle column */
  const escolher = s => { if (f.sel === s) return; f.sel = s; const runa = w.Class === 12; if (!runa && slotSel !== s) { slotSel = s; const x = [...ARMAS_DOS_HEROIS()].find(z => z.w._id === w._id); pintarMeio(w, x); pintarSlotsDaLista(); } };
  const outroNoPonto = (px, py) => { for (const s of ordem().slice().reverse()) if (s !== f.sel && naPeca(s, px, py)) return s; return -1; };
  const ponto = e => { const r = tela.getBoundingClientRect(); return [(e.clientX - r.left) * L / r.width - L / 2, (e.clientY - r.top) * L / r.height - L / 2]; };
  tela.onmousedown = e => { if (e.button !== 0) return; const [x, y] = ponto(e); tela.focus(); arrasto = null;
    const al = naAlca(x, y), na = f.sel >= 0 && naPeca(f.sel, x, y);
    if (!al && !na) { const o = outroNoPonto(x, y); if (o >= 0) aviso(f.sel < 0 ? tr('Choose A, B or C on the right first (or double-click the piece).') : L2('That is piece ' + 'ABC'[o] + ': double-click it (or choose it on the right) to change it.', 'Isso é da peça ' + 'ABC'[o] + ': clique duas vezes nela (ou escolha à direita) para mexer.')); pintar(); return; }
    if (!editavel(f.sel)) { podeMexer(); return; }
    const c = camadas[f.sel]; arrasto = { tipo: al ? al.tipo : 'mover', hx: al && al.hx, hy: al && al.hy, x, y, c0: { x: c.x, y: c.y, k: c.k, ex: c.ex, ey: c.ey, r: c.r || 0 }, m0: meias(c) }; };
  // (a double click: on another piece, where the chosen one is not, it becomes the chosen one; on the chosen piece, its stats)
  tela.ondblclick = e => { const [x, y] = ponto(e); const na = f.sel >= 0 && naPeca(f.sel, x, y); const o = na ? -1 : outroNoPonto(x, y);
    if (o >= 0) { escolher(o); pintar(); aviso(L2('Piece ' + 'ABC'[o] + ' chosen.', 'Peça ' + 'ABC'[o] + ' escolhida.')); return; }
    if (na) abrirStats(w, f.sel); };
  const mover = e => { if (!tela.isConnected) { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); return; } if (!arrasto) return;
    const [x, y] = ponto(e); const c = camadas[f.sel], a = arrasto, c0 = a.c0; const dx = x - a.x, dy = y - a.y;
    const ang = phi + c0.r * Math.PI / 180, du = dx * Math.cos(ang) + dy * Math.sin(ang), dv = -dx * Math.sin(ang) + dy * Math.cos(ang);
    const desloca = (su, sv) => { c.x = c0.x + su * Math.cos(ang) - sv * Math.sin(ang); c.y = c0.y + su * Math.sin(ang) + sv * Math.cos(ang); };
    if (a.tipo === 'mover') { c.x = c0.x + dx; c.y = c0.y + dy; }
    else if (a.tipo === 'lado') {   // stretch or shorten along one side: the opposite side stays
      const [mw, mh] = a.m0;
      if (a.hx) { const nw = Math.max(6, mw * 2 + a.hx * du); c.ex = c0.ex * nw / (mw * 2); desloca(a.hx * (nw - mw * 2) / 2, 0); }
      else { const nh = Math.max(6, mh * 2 + a.hy * dv); c.ey = c0.ey * nh / (mh * 2); desloca(0, a.hy * (nh - mh * 2) / 2); } }
    else if (a.tipo === 'canto') {   // the whole size: the opposite corner stays
      const [mw, mh] = a.m0; const k = Math.max(0.05, ((mw * 2 + a.hx * du) / (mw * 2) + (mh * 2 + a.hy * dv) / (mh * 2)) / 2);
      c.k = c0.k * k; desloca(a.hx * mw * (k - 1), a.hy * mh * (k - 1)); }
    else if (a.tipo === 'giro') { let r = Math.atan2(x - c0.x, -(y - c0.y)) * 180 / Math.PI - phi * 180 / Math.PI; if (!e.shiftKey) r = Math.round(r); else r = Math.round(r / 15) * 15; r = ((r + 540) % 360) - 180; c.r = r; }
    mexeu(); pintar(); };
  const soltar = () => { arrasto = null; if (!tela.isConnected) { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); } };
  window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
  tela.onmousemove = e => { if (arrasto) return; const [x, y] = ponto(e); const al = naAlca(x, y); tela.style.cursor = !al ? (f.sel >= 0 && naPeca(f.sel, x, y) ? 'move' : 'default') : al.tipo === 'giro' ? 'alias' : al.tipo === 'canto' ? 'nwse-resize' : al.hx ? 'ew-resize' : 'ns-resize'; };
  const girar = graus => { if (!podeMexer()) return; const c = camadas[f.sel]; let r = ((c.r || 0) + graus) % 360; if (r > 180) r -= 360; if (r < -180) r += 360; c.r = Math.round(r * 10) / 10; mexeu(); pintar(); };
  const espelhar = eixo => { if (!podeMexer()) return; const c = camadas[f.sel]; c[eixo] = c[eixo] === -1 ? 1 : -1; mexeu(); pintar(); };
  tela.onwheel = e => { e.preventDefault(); if (e.shiftKey) { girar((e.deltaY || e.deltaX) < 0 ? -3 : 3); return; } if (!podeMexer()) return; camadas[f.sel].k *= e.deltaY < 0 ? 1.05 : 1 / 1.05; mexeu(); pintar(); };
  $m('mt_fx').onclick = () => espelhar('fx'); $m('mt_fy').onclick = () => espelhar('fy');
  /* 🖌 Fine tuning: the chosen piece alone, zoomed, to paint over (any colour) or erase; its picture changes (no Forge needed),
     and it stays where it is on the forge */
  $m('mt_fino').onclick = () => { if (!podeMexer()) return; const k = f.sel, c = camadas[k]; if (!c.img) return aviso(tr('This piece has no picture to paint.'));
    ajusteFino(c.img, nomeNaForja(w, k), (png, fator) => {
      const arma = armaParaEditar(wid); const it = !arma.nova && pecaPropriaDaArma(f.escolhidas[k]);
      if (it) { if (!('retratoAntesDaForja' in it)) it.retratoAntesDaForja = it.retrato || ''; it.retrato = png; esquecerAjuste(it, 'retrato'); }
      else { arma.nova.pecas = arma.nova.pecas || {}; const e = (arma.nova.pecas['ABC'[k]] = arma.nova.pecas['ABC'[k]] || {}); if (!('imagemAntesDaForja' in e)) e.imagemAntesDaForja = e.imagem || ''; e.imagem = png; esquecerAjuste(e, 'imagem'); }
      // (the painted picture may be finer than the old one: the same size on the forge)
      c._posDesfeita = { x: c.x, y: c.y, k: c.k / fator, r: c.r || 0, ex: c.ex || 1, ey: c.ey || 1, fx: c.fx || 1, fy: c.fy || 1 }; c.src = null;
      limparArmas(); renderArmas(); aviso(tr('Painted: the piece keeps its new picture.')); }); };
  tela.onkeydown = e => { const d = e.shiftKey ? 10 : 1;
    // Ctrl+C / Ctrl+V: the place, size, stretch, turn and mirror of the chosen piece onto another chosen one
    if ((e.ctrlKey || e.metaKey) && !e.altKey && /^[cv]$/i.test(e.key)) { e.preventDefault(); if (f.sel < 0) return aviso(tr('Choose A, B or C on the right first.'));
      const c = camadas[f.sel];
      if (e.key.toLowerCase() === 'c') { areaForja = { x: c.x, y: c.y, k: c.k, r: c.r || 0, ex: c.ex || 1, ey: c.ey || 1, fx: c.fx || 1, fy: c.fy || 1 }; return aviso(tr('Piece copied: Ctrl+V gives its place, size and turn to the chosen piece.')); }
      if (!areaForja || areaForja.alvo) return aviso(tr('Nothing copied yet (Ctrl+C on a piece or a box).')); if (!podeMexer()) return;
      Object.assign(c, areaForja); mexeu(); pintar(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'e') { e.preventDefault(); girar((k === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 1)); return; }
    if (k === 'h') { e.preventDefault(); espelhar('fx'); return; } if (k === 'v') { e.preventDefault(); espelhar('fy'); return; }
    const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    if (mv) { e.preventDefault(); if (!podeMexer()) return; const c = camadas[f.sel]; c.x += mv[0]; c.y += mv[1]; mexeu(); pintar(); } };
  el.querySelectorAll('[data-mts]').forEach(d => d.onclick = e => { if (e.target.closest('select,label,button')) return; escolher(+d.dataset.mts); pintar(); tela.focus(); });
  el.querySelectorAll('[data-stats]').forEach(b => b.onclick = () => abrirStats(w, +b.dataset.stats));
  /* the box of a changed piece becomes the box around it as it is now (centre and size, along the weapon's axes) */
  const fixarCaixa = k => { const c = camadas[k]; if (!c.img) return; const t = (c.r || 0) * Math.PI / 180, [mw, mh] = meias(c), W = mw * 2, H = mh * 2;
    moldes[k] = [c.x, -c.y, Math.abs(W * Math.cos(t)) + Math.abs(H * Math.sin(t)), Math.abs(W * Math.sin(t)) + Math.abs(H * Math.cos(t))].map(v => Math.round(v * 10) / 10); };
  // (↺ Reset on a piece's row: what was forged, painted or moved on that piece goes (only it): its picture of before, in the
  //  game's box; the other pieces stay as they are)
  const redefinir = k => { if (!editavel(k)) return; const arma = armaEditada(wid) || {};
    [k].forEach(k => { const it = !arma.nova && pecaPropriaDaArma(f.escolhidas[k]);
      if (it) { if ('retratoAntesDaForja' in it) { it.retrato = it.retratoAntesDaForja; delete it.retratoAntesDaForja; } delete it.molde; delete it.moldeArma; }
      else { const e = arma.nova ? (arma.nova.pecas || {})['ABC'[k]] : (arma.pecas || {})[f.escolhidas[k]]; if (e) { if ('imagemAntesDaForja' in e) { if (e.imagemAntesDaForja) e.imagem = e.imagemAntesDaForja; else delete e.imagem; delete e.imagemAntesDaForja; } else if (!arma.nova) delete e.imagem; delete e.molde; } }
      moldes[k] = jogo(k); camadas[k].src = null; camadas[k].mexida = false; delete camadas[k]._posDesfeita; });
    f.mexida = camadas.some(x => x.mexida); f.sel = k; limparArmas(); renderArmas();
    aviso(L2('Reset ' + 'ABC'[k] + ': what was forged, painted or moved on this piece is undone.', 'Redefinida ' + 'ABC'[k] + ': o que foi forjado, pintado ou movido nesta peça foi desfeito.')); };
  /* a piece baked into a picture of its box: the app fits it back exactly where it is now (stretched, turned, mirrored) */
  const assar = c => { const b = caixa(c.s); const R = Math.max(1, Math.min(3, c.img ? 1 / Math.min(escalas(c)[0], escalas(c)[1]) : 1)); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(b.w * R)); cv.height = Math.max(1, Math.round(b.h * R));
    const x = cv.getContext('2d'); x.scale(cv.width / b.w, cv.height / b.h); x.translate(b.w / 2, b.h / 2); x.rotate(-phi); x.translate(-b.cx, -b.cy); desenharCamada(x, c); return cv.toDataURL('image/png'); };
  /* ⚒ Forge on a piece's row: only that piece is kept; the others stay as they are, changed or not */
  const forjar = k => {
    if (!editavel(k)) return aviso(tr('Only parts of the workshop are forged: duplicate a part of the game (✎) to make one of your own.'));
    const c = camadas[k]; if (!c.img) return aviso(tr('This piece has no picture to forge.'));
    escolher(k); const arma = armaParaEditar(wid);
    if (c.mexida) fixarCaixa(k); const png = assar(c); let e;
    // a part of the Workshop: its picture (the one of the item) and its box (for this weapon) stay in the item
    const it = !arma.nova && pecaPropriaDaArma(f.escolhidas[k]);
    if (it) { if (!('retratoAntesDaForja' in it)) it.retratoAntesDaForja = it.retrato || ''; it.retrato = png; esquecerAjuste(it, 'retrato'); if (mesmaCaixa(moldes[k], jogo(k))) { delete it.molde; delete it.moldeArma; } else { it.molde = moldes[k].slice(); it.moldeArma = wid; } }
    else {
      if (arma.nova) { arma.nova.pecas = arma.nova.pecas || {}; e = (arma.nova.pecas['ABC'[k]] = arma.nova.pecas['ABC'[k]] || {}); }
      else { arma.pecas = arma.pecas || {}; e = (arma.pecas[f.escolhidas[k]] = arma.pecas[f.escolhidas[k]] || {}); }
      if (!('imagemAntesDaForja' in e)) e.imagemAntesDaForja = e.imagem || ''; e.imagem = png; esquecerAjuste(e, 'imagem'); if (mesmaCaixa(moldes[k], jogo(k))) delete e.molde; else e.molde = moldes[k].slice();
    }
    // (this piece is its baked picture now: fitted again in its box; the others keep their changes)
    c.src = null; c.mexida = false; f.mexida = camadas.some(x => x.mexida);
    limparArmas(); renderArmas(); aviso(L2('Forged ' + 'ABC'[k] + ': this piece stays as you left it, in the game too.', 'Forjada ' + 'ABC'[k] + ': esta peça fica como você deixou, no jogo também.')); };
  el.querySelectorAll('[data-forjar]').forEach(b => b.onclick = e => { e.stopPropagation(); forjar(+b.dataset.forjar); });
  el.querySelectorAll('[data-redefinir]').forEach(b => b.onclick = e => { e.stopPropagation(); redefinir(+b.dataset.redefinir); });
  // (the template: each piece in its box, the boxes drawn, in the order of the pieces)
  $m('mt_png').onclick = () => { const cv = document.createElement('canvas'); cv.width = cv.height = L; const x = cv.getContext('2d'); x.fillStyle = '#f5f2eb'; x.fillRect(0, 0, L, L); x.translate(L / 2, L / 2);
    ordem().forEach(s => { const c = camadas[s]; desenharCamada(x, c); });
    [0, 1, 2].forEach(s => { const b = c0x(s); x.save(); x.translate(b.cx, b.cy); x.rotate(phi); x.strokeStyle = ['#c84632', '#326ec8', '#3c9646'][s]; x.setLineDash([6, 4]); x.lineWidth = 1.5; x.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); x.font = 'bold 15px system-ui'; x.fillStyle = x.strokeStyle; x.fillText('ABC'[s] + '  ' + Math.round(b.w) + '×' + Math.round(b.h), -b.w / 2 + 4, -b.h / 2 + 16); x.restore(); });
    const link = document.createElement('a'); link.download = 'template ' + nomeDaArma(w) + '.png'; link.href = cv.toDataURL('image/png'); link.click(); };
  // (the box of each piece as it would be forged now)
  const c0x = s => { const c = camadas[s]; if (!c.mexida || !c.img) return caixa(s); const t = (c.r || 0) * Math.PI / 180, [mw, mh] = meias(c); return { cx: c.x, cy: c.y, w: Math.abs(2 * mw * Math.cos(t)) + Math.abs(2 * mh * Math.sin(t)), h: Math.abs(2 * mw * Math.sin(t)) + Math.abs(2 * mh * Math.cos(t)) }; };
  tela._pintar = pintar; pintar();
}
/* 🖌 Fine tuning: a window with one picture, zoomed, to paint over it like a small Paintbrush: brush, pencil, spray, eraser,
   magic eraser (erases a region of one colour), fill bucket, colour picker, line, rectangle and ellipse (outlined or filled),
   any colour (and a palette), size, strength and tolerance. The wheel zooms, the right button (or Space) drags the view,
   Ctrl+Z / Ctrl+Y undo and redo. ⬚ Select (a rectangle) and ➰ Free select (a line drawn freely, closed by itself) take
   a part of the picture: Ctrl+X cuts it, Ctrl+C copies it, Ctrl+V pastes it (as a loose piece: dragged, nudged by the
   arrows, mirrored; Enter or a click outside fixes it, Esc gives it up), Delete erases it; dragging a selection moves it
   (Ctrl: a copy of it). What is copied stays for the next window too (another piece), and a picture copied elsewhere
   comes in with Ctrl+V. A small picture is painted at twice (or more) its size, so the strokes can be fine;
   aoConcluir(png, fator) gets the new picture and that factor. */
const FERRAMENTAS_PINTOR = [['pincel', '🖌', 'Brush', 'B'], ['lapis', '✏', 'Pencil', 'P'], ['spray', '💨', 'Spray', 'A'], ['borracha', '⌫', 'Eraser', 'E'], ['magica', '🪄', 'Magic eraser', 'W'],
  ['balde', '🪣', 'Fill', 'G'], ['gotas', '💧', 'Colour picker', 'I'], ['linha', '╱', 'Line', 'L'], ['retangulo', '▭', 'Rectangle', 'R'], ['elipse', '◯', 'Ellipse', 'O'],
  ['selecao', '⬚', 'Select', 'S'], ['laco', '➰', 'Free select', 'F']];
/* what was cut or copied in the Fine tuning: { cv (its pixels), x, y (where it was) }; it lasts from one window to the next */
let AREA_PINTOR = null;
const PALETA_PINTOR = ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff', '#7a1c1c', '#d62828', '#f77f00', '#fcbf49', '#eae2b7', '#2a9d8f', '#3a7d44', '#264653', '#1d3557', '#457b9d', '#6a4c93', '#b5838d', '#8d5524', '#c68642', '#e0ac69'];
function ajusteFino(img, nome, aoConcluir) {
  const W0 = img.naturalWidth, H0 = img.naturalHeight; const fator = Math.max(1, Math.min(4, Math.ceil(512 / Math.max(W0, H0))));
  const folha = document.createElement('canvas'); folha.width = W0 * fator; folha.height = H0 * fator; const fg = folha.getContext('2d', { willReadFrequently: true }); fg.imageSmoothingQuality = 'high'; fg.drawImage(img, 0, 0, folha.width, folha.height);
  const FW = folha.width, FH = folha.height;
  const desfazer = [fg.getImageData(0, 0, FW, FH)], refazer = [];
  const V = 600; let zoom = Math.min(V / FW, V / FH) * 0.92, px = (V - FW * zoom) / 2, py = (V - FH * zoom) / 2;
  let sel = null, selNova = null, solta = null, arrastoSolta = null, colarPendente = 0;
  let ferramenta = 'pincel', cor = '#000000', tam = 12, forca = 100, tolerancia = 32, borda = 3, corBorda = '#000000', pintarBorda = true, cheio = false, traco = null, arrastoVista = null, espaco = false, mouse = null, anterior = 'pincel';
  const { fechar, cx } = modal(tr('Fine tuning') + ' · ' + nome, `<div class="pintor"><canvas class="pintorTela" width="${V}" height="${V}" tabindex="0"></canvas>
    <div class="pintorLado">
      <div class="pintorFerr">${FERRAMENTAS_PINTOR.map(([k, ic, n, t]) => `<button class="sm ${k === 'pincel' ? 'primario' : ''}" data-pf="${k}" title="${esc(tr(n))} (${t})"><span>${ic}</span> ${esc(tr(n))}</button>`).join('')}</div>
      <div class="pintorCores"><input type="color" id="pf_cor" value="#000000" title="${esc(tr('Any colour'))}">${PALETA_PINTOR.map(c => `<button class="pintorCor" data-pc="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
      <div class="botoes pintorSel"><button class="sm" id="pf_cortar" title="Ctrl+X">✂ Cut</button><button class="sm" id="pf_copiar" title="Ctrl+C">⧉ Copy</button><button class="sm" id="pf_colar" title="Ctrl+V">📋 Paste</button><button class="sm" id="pf_apagar" title="Delete">🗑 Delete</button><button class="sm" id="pf_selfx" title="${esc(tr('Mirror the selection'))}">⇋</button><button class="sm" id="pf_selfy" title="${esc(tr('Flip the selection'))}">⇵</button></div>
      <label class="campo">Size <span class="linha"><input type="range" id="pf_tam" min="1" max="120" value="12" style="flex:1"><span class="mtPct" id="pf_tamn">12</span></span></label>
      <label class="campo">Strength <span class="linha"><input type="range" id="pf_forca" min="5" max="100" value="100" style="flex:1"><span class="mtPct" id="pf_forcan">100%</span></span></label>
      <label class="campo" title="${esc(tr('How different a colour may be and still be filled or erased by the bucket and the magic eraser'))}">Tolerance <span class="linha"><input type="range" id="pf_tol" min="0" max="160" value="32" style="flex:1"><span class="mtPct" id="pf_toln">32</span></span></label>
      <label class="campo" title="${esc(tr('The magic eraser cleans the edge it leaves (this many pixels): the colour erased comes out of it (no light fringe) and, ticked, it takes this colour (a dark outline). Clicked on a transparent part, it cleans the fringe left by an older erase. 0: no edge'))}">Edge <span class="linha"><input type="range" id="pf_borda" min="0" max="8" value="3" style="flex:1"><span class="mtPct" id="pf_bordan">3</span><label class="chk" title="${esc(tr('Paint the edge in this colour (off: the edge only loses the colour erased)'))}"><input type="checkbox" id="pf_bordapinta" checked></label><input type="color" id="pf_bordacor" value="#000000" title="${esc(tr('Colour of the edge'))}"><button class="sm" id="pf_contorno" title="${esc(tr('An outline of the edge colour and size around the whole piece'))}">◌ Outline</button></span></label>
      <label class="chk"><input type="checkbox" id="pf_cheio"> Filled shapes</label>
      <div class="botoes"><button class="sm" id="pf_desf" title="Ctrl+Z">↶ Undo</button><button class="sm" id="pf_ref" title="Ctrl+Y">↷ Redo</button><button class="sm" id="pf_ver" title="The whole piece in the window">⤢ Fit</button></div>
      <p class="ajuda">${esc(tr('The wheel zooms; the arrows (Shift: farther), the right button or Space move the piece in the window. The eraser and the magic eraser take away what should not show (it becomes transparent); Shift keeps a line straight and a shape square.'))}</p>
      <p class="ajuda">${esc(tr('⬚ Select or ➰ Free select (drawn freely) a part, then ✂ Ctrl+X, ⧉ Ctrl+C, 📋 Ctrl+V or Delete. Drag a selection to move it (Ctrl: a copy); the arrows nudge it; Enter or a click outside fixes it, Esc gives it up. What is copied can be pasted on another piece too; a picture copied elsewhere comes in with Ctrl+V.'))}</p>
      <div class="botoes"><button class="sm primario" id="pf_ok">Done</button><button class="sm" id="pf_nao">Cancel</button></div>
    </div></div>`, (el, fecharJ) => {
    const tela = el.querySelector('.pintorTela'), g = tela.getContext('2d');
    const xadrez = (() => { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8); return g.createPattern(c, 'repeat'); })();
    const pintar = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#2a2e36'; g.fillRect(0, 0, V, V);
      g.setTransform(zoom, 0, 0, zoom, px, py); g.fillStyle = xadrez; g.fillRect(0, 0, FW, FH); g.imageSmoothingEnabled = zoom < 2; g.drawImage(folha, 0, 0);
      if (solta) g.drawImage(solta.cv, Math.round(solta.x), Math.round(solta.y));
      const contorno = (fazer) => { g.beginPath(); fazer(); g.lineWidth = 1 / zoom; g.setLineDash([5 / zoom, 4 / zoom]); g.strokeStyle = '#000'; g.lineDashOffset = 0; g.stroke(); g.strokeStyle = '#fff'; g.lineDashOffset = 4.5 / zoom; g.stroke(); g.setLineDash([]); };
      const forma = q => () => { if (q.tipo === 'selecao') { const [a, b] = q.pontos[0], [c, d] = q.pontos[q.pontos.length - 1]; g.rect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); } else { q.pontos.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); } };
      if (solta) contorno(() => g.rect(Math.round(solta.x), Math.round(solta.y), solta.cv.width, solta.cv.height));
      else if (selNova) contorno(forma(selNova)); else if (sel) contorno(forma(sel));
      g.setTransform(1, 0, 0, 1, 0, 0); g.strokeStyle = 'rgba(255,255,255,.35)'; g.strokeRect(px - .5, py - .5, FW * zoom + 1, FH * zoom + 1);
      if (mouse && !arrastoVista && ['pincel', 'lapis', 'spray', 'borracha'].includes(ferramenta)) { g.beginPath(); if (ferramenta === 'lapis') g.rect(mouse[0] - tam * zoom / 2, mouse[1] - tam * zoom / 2, tam * zoom, tam * zoom); else g.arc(mouse[0], mouse[1], Math.max(1, tam * zoom / 2), 0, Math.PI * 2); g.strokeStyle = ferramenta === 'borracha' ? '#fff' : cor; g.lineWidth = 1.5; g.stroke(); } };
    const naFolha = e => { const r = tela.getBoundingClientRect(); const x = (e.clientX - r.left) * V / r.width, y = (e.clientY - r.top) * V / r.height; return [x, y, (x - px) / zoom, (y - py) / zoom]; };
    const rgba = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    // (a stroke or a shape is drawn whole, each move, over the picture before it: its strength does not pile up where it crosses itself)
    const tracar = (fim) => { fg.putImageData(desfazer[desfazer.length - 1], 0, 0); const t = traco, camada = document.createElement('canvas'); camada.width = FW; camada.height = FH; const cg = camada.getContext('2d');
      cg.strokeStyle = cg.fillStyle = cor; cg.lineWidth = tam; cg.lineCap = cg.lineJoin = 'round'; const p = t.pontos;
      if (t.f === 'pincel' || t.f === 'borracha') { cg.beginPath(); cg.moveTo(p[0][0], p[0][1]); if (p.length === 1) { cg.arc(p[0][0], p[0][1], tam / 2, 0, Math.PI * 2); cg.fill(); } else { p.forEach(q => cg.lineTo(q[0], q[1])); cg.stroke(); } }
      else if (t.f === 'lapis') { const s = Math.max(1, Math.round(tam)), m = Math.floor(s / 2); let [a, b] = [Math.floor(p[0][0]), Math.floor(p[0][1])]; cg.fillRect(a - m, b - m, s, s);
        p.slice(1).forEach(q => { const [x1, y1] = [Math.floor(q[0]), Math.floor(q[1])]; const n = Math.max(Math.abs(x1 - a), Math.abs(y1 - b)); for (let i = 1; i <= n; i++) cg.fillRect(Math.round(a + (x1 - a) * i / n) - m, Math.round(b + (y1 - b) * i / n) - m, s, s); [a, b] = [x1, y1]; }); }
      else if (t.f === 'spray') { t.gotas.forEach(([x, y]) => cg.fillRect(x, y, Math.max(1, fator), Math.max(1, fator))); }
      else { // shapes, from the first point to the last (Shift: straight / square)
        let [x0, y0] = p[0], [x1, y1] = p[p.length - 1];
        if (t.reto) { if (t.f === 'linha') { const a = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * Math.PI / 4, d = Math.hypot(x1 - x0, y1 - y0); x1 = x0 + d * Math.cos(a); y1 = y0 + d * Math.sin(a); } else { const d = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x1 = x0 + Math.sign(x1 - x0 || 1) * d; y1 = y0 + Math.sign(y1 - y0 || 1) * d; } }
        cg.beginPath(); if (t.f === 'linha') { cg.moveTo(x0, y0); cg.lineTo(x1, y1); cg.stroke(); }
        else { if (t.f === 'retangulo') { const ex = Math.round(Math.min(x0, x1)), ey = Math.round(Math.min(y0, y1)); cg.rect(ex, ey, Math.round(Math.max(x0, x1)) - ex, Math.round(Math.max(y0, y1)) - ey); } else cg.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2 || .5, Math.abs(y1 - y0) / 2 || .5, 0, 0, Math.PI * 2); if (t.cheio) cg.fill(); else cg.stroke(); } }
      fg.save(); fg.globalAlpha = forca / 100; fg.globalCompositeOperation = t.f === 'borracha' ? 'destination-out' : 'source-over'; fg.drawImage(camada, 0, 0); fg.restore(); };
    const gotejar = (x, y) => { const r = tam / 2, n = Math.max(3, Math.round(tam * tam / 30)); for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = r * Math.sqrt(Math.random()); traco.gotas.push([Math.round(x + d * Math.cos(a)), Math.round(y + d * Math.sin(a))]); } };
    /* the bucket and the magic eraser: the region of the clicked colour (within the tolerance) that touches the click */
    const regiao = (x, y) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= FW || y >= FH) return null; const d = fg.getImageData(0, 0, FW, FH), q = d.data, i0 = (y * FW + x) * 4;
      const ref = [q[i0], q[i0 + 1], q[i0 + 2], q[i0 + 3]], tol = tolerancia * tolerancia * 4; const marca = new Uint8Array(FW * FH);
      const igual = j => { const k = j * 4; const da = q[k + 3] - ref[3]; if (ref[3] < 8 && q[k + 3] < 8) return true; const dr = q[k] - ref[0], dg = q[k + 1] - ref[1], db = q[k + 2] - ref[2]; return dr * dr + dg * dg + db * db + da * da <= tol; };
      const pilha = [y * FW + x]; marca[y * FW + x] = 1;
      while (pilha.length) { const j = pilha.pop(); const jx = j % FW, jy = (j - jx) / FW; for (const [nx, ny] of [[jx - 1, jy], [jx + 1, jy], [jx, jy - 1], [jx, jy + 1]]) { if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue; const n = ny * FW + nx; if (marca[n] || !igual(n)) continue; marca[n] = 1; pilha.push(n); } }
      return { d, marca, ref }; };
    const encher = (x, y, apagar) => { const r = regiao(x, y); if (!r) return false; const { d, marca, ref } = r, q = d.data, a = forca / 100, [cr, cgg, cb] = rgba(cor);
      for (let j = 0; j < marca.length; j++) { if (!marca[j]) continue; const k = j * 4;
        if (apagar) { q[k + 3] = Math.round(q[k + 3] * (1 - a)); continue; }
        const ao = q[k + 3] / 255, an = a + ao * (1 - a); if (an <= 0) continue; q[k] = Math.round((cr * a + q[k] * ao * (1 - a)) / an); q[k + 1] = Math.round((cgg * a + q[k + 1] * ao * (1 - a)) / an); q[k + 2] = Math.round((cb * a + q[k + 2] * ao * (1 - a)) / an); q[k + 3] = Math.round(an * 255); }
      // (the magic eraser's edge, "Edge" pixels around what was erased: the colour erased (a white background) comes out of
      //  them, each keeping the colour of the piece next to it and becoming as transparent as it had white in it; then,
      //  if "paint" is on, they take the edge colour (black by default), keeping that transparency. Clicked on a
      //  transparent part, it cleans the light fringe left around it by an older erase)
      if (apagar && borda > 0) limparBorda(q, marca, ref);
      fg.putImageData(d, 0, 0); return true; };
    const limparBorda = (q, marca, ref) => { const N = FW * FH, dist = new Uint8Array(N), camadas = []; let fila = []; for (let j = 0; j < N; j++) if (marca[j]) { dist[j] = 1; fila.push(j); }
      const vizinhos = (j, f) => { const jx = j % FW, jy = (j - jx) / FW; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = jx + dx, ny = jy + dy; if (nx >= 0 && ny >= 0 && nx < FW && ny < FH) f(ny * FW + nx); } };
      const U = borda * 2;   // (the colour erased is taken out a little deeper than the edge painted: a soft picture blends it further in)
      for (let n = 1; n <= U + 1 && fila.length; n++) { const prox = []; for (const j of fila) vizinhos(j, m => { if (!dist[m]) { dist[m] = n + 1; prox.push(m); } }); camadas[n] = prox; fila = prox; }
      const a = forca / 100, lum = k => (q[k] + q[k + 1] + q[k + 2]) / 3;
      // the colour taken out: the one erased; on a transparent click, the near-white pixels touching the transparent part
      let B = null; if (ref[3] >= 8) B = ref.slice(0, 3); else { let s = [0, 0, 0], n = 0; for (const j of camadas[1] || []) { const k = j * 4; if (q[k + 3] > 20 && Math.min(q[k], q[k + 1], q[k + 2]) > 200) { s[0] += q[k]; s[1] += q[k + 1]; s[2] += q[k + 2]; n++; } } if (n >= 3) B = s.map(v => v / n); }
      // the piece's own colour, from the inside out: each pixel of the edge takes the mean of its neighbours further in
      const F = new Float32Array(N * 3), tem = new Uint8Array(N); for (const j of camadas[U + 1] || []) { const k = j * 4; if (q[k + 3] > 0) { F[j * 3] = q[k]; F[j * 3 + 1] = q[k + 1]; F[j * 3 + 2] = q[k + 2]; tem[j] = 1; } }
      for (let n = U; n >= 1; n--) { const camada = camadas[n] || [];
        for (const j of camada) { const k = j * 4; if (q[k + 3] === 0) continue; let s0 = 0, s1 = 0, s2 = 0, c = 0; vizinhos(j, m => { if (tem[m] && dist[m] > dist[j]) { s0 += F[m * 3]; s1 += F[m * 3 + 1]; s2 += F[m * 3 + 2]; c++; } });
          if (c) { F[j * 3] = s0 / c; F[j * 3 + 1] = s1 / c; F[j * 3 + 2] = s2 / c; } else { F[j * 3] = q[k]; F[j * 3 + 1] = q[k + 1]; F[j * 3 + 2] = q[k + 2]; } }
        for (const j of camada) if (q[j * 4 + 3] > 0) tem[j] = 1;
        // how much of the piece is in each pixel (between the colour taken out and the piece's): that much stays, and
        // its own colour without the part that came from the colour taken out (its texture stays)
        if (B) for (const j of camada) { const k = j * 4; if (q[k + 3] === 0) continue; const f = [F[j * 3], F[j * 3 + 1], F[j * 3 + 2]], d = f.map((v, i) => v - B[i]), dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
          if (dd < 900) continue; const t = Math.max(0, Math.min(1, ((q[k] - B[0]) * d[0] + (q[k + 1] - B[1]) * d[1] + (q[k + 2] - B[2]) * d[2]) / dd));
          for (let i = 0; i < 3; i++) { const v = t > 0.02 ? Math.max(0, Math.min(255, (q[k + i] - (1 - t) * B[i]) / t)) : f[i]; q[k + i] = Math.round(v * a + q[k + i] * (1 - a)); } q[k + 3] = Math.round(q[k + 3] * (1 - a + a * t)); } }
      if (pintarBorda) { const [er, eg, eb] = rgba(corBorda); for (let n = 1; n <= borda; n++) for (const j of camadas[n] || []) { const k = j * 4; if (q[k + 3] === 0) continue; q[k] = Math.round(er * a + q[k] * (1 - a)); q[k + 1] = Math.round(eg * a + q[k + 1] * (1 - a)); q[k + 2] = Math.round(eb * a + q[k + 2] * (1 - a)); } } };
    const guardarPasso = () => { desfazer.push(fg.getImageData(0, 0, FW, FH)); if (desfazer.length > 40) desfazer.splice(1, 1); refazer.length = 0; };
    const escolherCor = c => { cor = c; el.querySelector('#pf_cor').value = c; el.querySelectorAll('[data-pc]').forEach(b => b.classList.toggle('ativa', b.dataset.pc === c)); };
    /* the selection: its shape becomes a mask over the picture; the loose piece (cut, copied or pasted) floats over it */
    const fecharSel = q => { let pts = q.pontos; if (q.tipo === 'selecao') { let [[a, b]] = pts, [c, d] = pts[pts.length - 1]; if (q.reto) { const m = Math.max(Math.abs(c - a), Math.abs(d - b)); c = a + Math.sign(c - a || 1) * m; d = b + Math.sign(d - b || 1) * m; }
        [a, c] = [Math.round(Math.min(a, c)), Math.round(Math.max(a, c))]; [b, d] = [Math.round(Math.min(b, d)), Math.round(Math.max(b, d))]; pts = [[a, b], [c, d]]; }
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))), x1 = Math.min(FW, Math.ceil(Math.max(...xs))), y1 = Math.min(FH, Math.ceil(Math.max(...ys)));
      if (x1 - x0 < 2 || y1 - y0 < 2 || (q.tipo === 'laco' && pts.length < 3)) return null;
      const mascara = document.createElement('canvas'); mascara.width = FW; mascara.height = FH; const m = mascara.getContext('2d'); m.fillStyle = '#000'; m.beginPath();
      if (q.tipo === 'selecao') m.rect(pts[0][0], pts[0][1], pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]); else { pts.forEach(([x, y], i) => i ? m.lineTo(x, y) : m.moveTo(x, y)); m.closePath(); } m.fill();
      return { tipo: q.tipo, pontos: pts, mascara, caixa: [x0, y0, x1 - x0, y1 - y0] }; };
    const naSel = (x, y) => { if (!sel) return false; x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= FW || y >= FH) return false; return sel.mascara.getContext('2d').getImageData(x, y, 1, 1).data[3] > 0; };
    const naSolta = (x, y) => solta && x >= solta.x && y >= solta.y && x < solta.x + solta.cv.width && y < solta.y + solta.cv.height;
    // (the pixels of the selection, in a canvas of their own; cut: taken from the picture)
    const levantar = cortar => { const [x, y, w, h] = sel.caixa, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
      c.drawImage(folha, -x, -y); c.globalCompositeOperation = 'destination-in'; c.drawImage(sel.mascara, -x, -y);
      if (cortar) { fg.save(); fg.globalCompositeOperation = 'destination-out'; fg.drawImage(sel.mascara, 0, 0); fg.restore(); } return { cv, x, y }; };
    const copiaDe = a => { const cv = document.createElement('canvas'); cv.width = a.cv.width; cv.height = a.cv.height; cv.getContext('2d').drawImage(a.cv, 0, 0); return { cv, x: a.x, y: a.y }; };
    // (the loose piece goes into the picture where it is; a step to undo)
    const fixar = () => { if (!solta) return false; fg.drawImage(solta.cv, Math.round(solta.x), Math.round(solta.y)); solta = null; arrastoSolta = null; guardarPasso(); return true; };
    // (given up: a piece taken out of the picture goes back; a pasted one goes away)
    const desistir = () => { if (solta) { if (solta.tirada) fg.putImageData(desfazer[desfazer.length - 1], 0, 0); solta = null; arrastoSolta = null; } else { sel = null; } pintar(); };
    const copiar = () => { if (solta) AREA_PINTOR = copiaDe(solta); else if (sel) AREA_PINTOR = levantar(false); else return false; return true; };
    const cortar = () => { if (!copiar()) return; if (solta) { solta = null; arrastoSolta = null; } else { levantar(true); sel = null; } guardarPasso(); pintar(); };
    const apagarSel = () => { if (solta) { solta = null; arrastoSolta = null; guardarPasso(); } else if (sel) { fg.save(); fg.globalCompositeOperation = 'destination-out'; fg.drawImage(sel.mascara, 0, 0); fg.restore(); sel = null; guardarPasso(); } pintar(); };
    // (pasted: where it was cut or copied, if that is in this picture; otherwise in the middle of the window)
    const porSolta = (a, noLugar) => { fixar(); sel = null; if (ferramenta !== 'selecao' && ferramenta !== 'laco') escolherF('selecao');
      const s = copiaDe(a); if (!noLugar || s.x + s.cv.width > FW || s.y + s.cv.height > FH) { s.x = Math.round((V / 2 - px) / zoom - s.cv.width / 2); s.y = Math.round((V / 2 - py) / zoom - s.cv.height / 2); }
      solta = s; pintar(); };
    const colar = () => { if (AREA_PINTOR) porSolta(AREA_PINTOR, true); };
    // (a picture copied in another program: it comes in as a loose piece, made smaller if it is larger than this picture)
    const colarImagem = arq => { const u = URL.createObjectURL(arq), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); if (!tela.isConnected) return; const k = Math.min(1, FW / i.naturalWidth, FH / i.naturalHeight);
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(i.naturalWidth * k)); cv.height = Math.max(1, Math.round(i.naturalHeight * k)); const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(i, 0, 0, cv.width, cv.height); porSolta({ cv, x: 0, y: 0 }, false); }; i.src = u; };
    const aoColar = e => { if (!tela.isConnected) { document.removeEventListener('paste', aoColar); return; } const it = [...(e.clipboardData?.items || [])].find(x => x.kind === 'file' && x.type.startsWith('image/'));
      if (!it) return; e.preventDefault(); colarPendente = 0; colarImagem(it.getAsFile()); };
    document.addEventListener('paste', aoColar);
    const espelharSel = (h) => { if (!solta) { if (!sel) return; solta = levantar(true); solta.tirada = true; sel = null; } const cv = document.createElement('canvas'); cv.width = solta.cv.width; cv.height = solta.cv.height; const c = cv.getContext('2d');
      c.translate(h ? cv.width : 0, h ? 0 : cv.height); c.scale(h ? -1 : 1, h ? 1 : -1); c.drawImage(solta.cv, 0, 0); solta.cv = cv; pintar(); };
    tela.onmousedown = e => { e.preventDefault(); tela.focus(); const [x, y, fx, fy] = naFolha(e);
      if (e.button === 2 || e.button === 1 || espaco) { arrastoVista = { x, y, px, py }; return; }
      if (e.button !== 0) return;
      if (ferramenta === 'gotas') { const xx = Math.floor(fx), yy = Math.floor(fy); if (xx >= 0 && yy >= 0 && xx < FW && yy < FH) { const p = fg.getImageData(xx, yy, 1, 1).data; if (p[3] > 0) escolherCor('#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('')); } escolherF(anterior); return; }
      if (ferramenta === 'selecao' || ferramenta === 'laco') {
        if (naSolta(fx, fy)) { arrastoSolta = { fx, fy, x: solta.x, y: solta.y }; return; }
        if (!solta && naSel(fx, fy)) { solta = levantar(!(e.ctrlKey || e.metaKey)); solta.tirada = !(e.ctrlKey || e.metaKey); sel = null; arrastoSolta = { fx, fy, x: solta.x, y: solta.y }; pintar(); return; }
        fixar(); sel = null; selNova = { tipo: ferramenta, pontos: [[fx, fy]], reto: e.shiftKey }; pintar(); return; }
      if (ferramenta === 'balde' || ferramenta === 'magica') { if (encher(fx, fy, ferramenta === 'magica')) { guardarPasso(); pintar(); } return; }
      traco = { f: ferramenta, pontos: [[fx, fy]], gotas: [], cheio, reto: e.shiftKey }; if (ferramenta === 'spray') gotejar(fx, fy); tracar(); pintar(); };
    tela.oncontextmenu = e => e.preventDefault();
    const mover = e => { if (!tela.isConnected) { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); return; }
      const [x, y, fx, fy] = naFolha(e); mouse = [x, y];
      if (arrastoVista) { px = arrastoVista.px + x - arrastoVista.x; py = arrastoVista.py + y - arrastoVista.y; }
      else if (arrastoSolta) { solta.x = arrastoSolta.x + Math.round(fx - arrastoSolta.fx); solta.y = arrastoSolta.y + Math.round(fy - arrastoSolta.fy); }
      else if (selNova) { if (selNova.tipo === 'laco') selNova.pontos.push([fx, fy]); else { selNova.pontos[1] = [fx, fy]; selNova.reto = e.shiftKey; } }
      else if (traco) { traco.reto = e.shiftKey; traco.pontos.push([fx, fy]); if (traco.f === 'spray') gotejar(fx, fy); tracar(); }
      if (ferramenta === 'selecao' || ferramenta === 'laco') tela.style.cursor = arrastoSolta || (!arrastoVista && (naSolta(fx, fy) || (!solta && naSel(fx, fy)))) ? 'move' : 'crosshair';
      pintar(); };
    const soltar = () => { if (traco) { guardarPasso(); traco = null; } if (selNova) { sel = fecharSel(selNova); selNova = null; pintar(); } arrastoSolta = null; arrastoVista = null; };
    window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
    tela.onmouseleave = () => { mouse = null; pintar(); };
    tela.onwheel = e => { e.preventDefault(); const [x, y] = naFolha(e); const k = e.deltaY < 0 ? 1.15 : 1 / 1.15; const z = Math.max(0.1, Math.min(40, zoom * k)); px = x - (x - px) * z / zoom; py = y - (y - py) * z / zoom; zoom = z; pintar(); };
    const passo = (de, para) => { if (de.length < (de === desfazer ? 2 : 1)) return; if (de === desfazer) { para.push(desfazer.pop()); fg.putImageData(desfazer[desfazer.length - 1], 0, 0); } else { const d = refazer.pop(); desfazer.push(d); fg.putImageData(d, 0, 0); } pintar(); };
    const desfazerUm = () => { if (solta) return desistir(); sel = null; passo(desfazer, refazer); }, refazerUm = () => { if (solta) return; sel = null; passo(refazer, desfazer); };
    el.querySelector('#pf_desf').onclick = desfazerUm; el.querySelector('#pf_ref').onclick = refazerUm;
    el.querySelector('#pf_cortar').onclick = () => { cortar(); tela.focus(); }; el.querySelector('#pf_copiar').onclick = () => { copiar(); tela.focus(); };
    el.querySelector('#pf_colar').onclick = async () => { tela.focus(); if (AREA_PINTOR) return colar();
      try { for (const it of await navigator.clipboard.read()) { const t = it.types.find(x => x.startsWith('image/')); if (t) return colarImagem(await it.getType(t)); } } catch { } };
    el.querySelector('#pf_apagar').onclick = () => { apagarSel(); tela.focus(); };
    el.querySelector('#pf_selfx').onclick = () => { espelharSel(true); tela.focus(); }; el.querySelector('#pf_selfy').onclick = () => { espelharSel(false); tela.focus(); };
    const atalhos = Object.fromEntries(FERRAMENTAS_PINTOR.map(([k, , , t]) => [t.toLowerCase(), k]));
    // (the arrows move the piece in the window, as the right button does; Shift: farther)
    const SETAS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    // (with a selection or a loose piece, the arrows nudge it instead: a pixel; Shift: 10)
    const setas = e => { const m = SETAS[e.key]; if (!m || e.ctrlKey || e.metaKey || e.altKey) return false; e.preventDefault();
      if (!solta && sel) { solta = levantar(true); solta.tirada = true; sel = null; }
      if (solta) { const d = e.shiftKey ? 10 : 1; solta.x += m[0] * d; solta.y += m[1] * d; pintar(); return true; }
      const d = e.shiftKey ? 80 : 20; px += m[0] * d; py += m[1] * d; pintar(); return true; };
    el.addEventListener('keydown', e => { if (e.target === tela || e.target.matches('input[type=range], input[type=color]')) return; setas(e); });
    tela.onkeydown = e => { if (setas(e)) return; if ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) { e.preventDefault(); e.stopPropagation(); if (e.key.toLowerCase() === 'y' || e.shiftKey) refazerUm(); else desfazerUm(); return; }
      if ((e.ctrlKey || e.metaKey) && /^[xca]$/i.test(e.key)) { e.preventDefault(); e.stopPropagation(); const k = e.key.toLowerCase();
        if (k === 'x') cortar(); else if (k === 'c') copiar(); else { fixar(); if (ferramenta !== 'selecao' && ferramenta !== 'laco') escolherF('selecao'); sel = fecharSel({ tipo: 'selecao', pontos: [[0, 0], [FW, FH]] }); pintar(); } return; }
      // (Ctrl+V: a picture copied elsewhere comes by the paste event; if none comes, what was copied here)
      if ((e.ctrlKey || e.metaKey) && /^v$/i.test(e.key)) { e.stopPropagation(); const n = ++colarPendente; setTimeout(() => { if (colarPendente === n) { colarPendente = 0; colar(); } }, 60); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (solta || sel) { e.preventDefault(); e.stopPropagation(); apagarSel(); } return; }
      if (e.key === 'Escape') { if (solta || sel || selNova) { e.preventDefault(); e.stopPropagation(); selNova = null; desistir(); } return; }
      if (e.key === 'Enter') { e.preventDefault(); fixar(); sel = null; pintar(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); espaco = true; return; } const f = atalhos[e.key.toLowerCase()]; if (f) { e.preventDefault(); escolherF(f); } };
    tela.onkeyup = e => { if (e.key === ' ') espaco = false; };
    const escolherF = t => { if (t === 'gotas' && ferramenta !== 'gotas') anterior = ferramenta; if (t !== ferramenta) { fixar(); sel = null; selNova = null; } ferramenta = t; el.querySelectorAll('[data-pf]').forEach(b => b.classList.toggle('primario', b.dataset.pf === t)); tela.style.cursor = t === 'gotas' ? 'copy' : t === 'balde' || t === 'magica' ? 'cell' : 'crosshair'; pintar(); };
    el.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { escolherF(b.dataset.pf); tela.focus(); });
    el.querySelector('#pf_cor').oninput = e => { escolherCor(e.target.value); if (ferramenta === 'borracha' || ferramenta === 'magica') escolherF('pincel'); };
    el.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { escolherCor(b.dataset.pc); if (ferramenta === 'borracha' || ferramenta === 'magica' || ferramenta === 'gotas') escolherF('pincel'); tela.focus(); });
    el.querySelector('#pf_tam').oninput = e => { tam = +e.target.value; el.querySelector('#pf_tamn').textContent = tam; pintar(); };
    el.querySelector('#pf_forca').oninput = e => { forca = +e.target.value; el.querySelector('#pf_forcan').textContent = forca + '%'; };
    el.querySelector('#pf_borda').oninput = e => { borda = +e.target.value; el.querySelector('#pf_bordan').textContent = borda; };
    el.querySelector('#pf_bordacor').oninput = e => { corBorda = e.target.value; el.querySelector('#pf_bordapinta').checked = pintarBorda = true; };
    el.querySelector('#pf_bordapinta').onchange = e => { pintarBorda = e.target.checked; };
    // (◌ Outline: the shape of the piece in the edge colour, drawn all around it under the piece, "Edge" pixels wide)
    el.querySelector('#pf_contorno').onclick = () => { tela.focus(); fixar(); const n = Math.max(1, borda); const sil = document.createElement('canvas'); sil.width = FW; sil.height = FH; const sg = sil.getContext('2d');
      sg.drawImage(folha, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = corBorda; sg.fillRect(0, 0, FW, FH);
      const fora = document.createElement('canvas'); fora.width = FW; fora.height = FH; const og = fora.getContext('2d'); const passos = Math.max(16, n * 8);
      for (let r = 1; r <= n; r++) for (let i = 0; i < passos; i++) { const t = i * Math.PI * 2 / passos; og.drawImage(sil, r * Math.cos(t), r * Math.sin(t)); }
      og.drawImage(folha, 0, 0); fg.clearRect(0, 0, FW, FH); fg.drawImage(fora, 0, 0); guardarPasso(); pintar(); };
    el.querySelector('#pf_tol').oninput = e => { tolerancia = +e.target.value; el.querySelector('#pf_toln').textContent = tolerancia; };
    el.querySelector('#pf_cheio').onchange = e => { cheio = e.target.checked; };
    el.querySelector('#pf_ver').onclick = () => { zoom = Math.min(V / FW, V / FH) * 0.92; px = (V - FW * zoom) / 2; py = (V - FH * zoom) / 2; pintar(); };
    el.querySelector('#pf_nao').onclick = fecharJ;
    el.querySelector('#pf_ok').onclick = () => { fixar(); const png = folha.toDataURL('image/png'); fecharJ(); if (desfazer.length > 1) aoConcluir(png, fator); };
    escolherCor(cor); tela._pintar = pintar; pintar(); setTimeout(() => tela.focus(), 0);
  }, true);
  cx.style.width = 'min(1080px, 96vw)';
  return fechar;
}
/* the slots A, B, C in the list on the left follow the piece chosen in the forge */
function pintarSlotsDaLista() { document.querySelectorAll('#f_lista [data-slot]').forEach(d => d.classList.toggle('ativo', +d.dataset.slot === slotSel)); }
/* "✎ Stats": the window of the part in that slot of the forge (name, picture, damage, damage types, ability…) */
function abrirStats(w, s) {
  const a0 = armaEditada(w._id) || {}; const f = estadoDaForja(w);
  modal(tr('Stats') + ' · ' + 'ABC'[s] + ' · ' + nomeNaForja(w, s), '<div class="statsPeca"></div>', (el, fechar) => {
    const box = el.querySelector('.statsPeca');
    const pinta = () => {
      const a = armaEditada(w._id) || {}; const apos = () => { limparArmas(); renderArmas(); if (document.body.contains(box)) pinta(); };
      if (a.nova) { box.innerHTML = formArmaNova(w, a.nova, s, true); ligarArmaNova(box, w, apos); return; }
      const id = f.escolhidas[s]; const it = pecaPropriaDaArma(id);
      if (it) { box.innerHTML = `<div data-corpop="${esc(it.id)}"></div>`; formPecaPropria(box.firstChild, w, it, apos, () => { fechar(); renderArmas(); }); return; }
      const p = itemDoJogo(id); if (!p) { box.innerHTML = '<p class="ajuda">?</p>'; return; }
      box.innerHTML = `<div data-corpo="${esc(id)}"></div>`; formPeca(box.firstChild, w, p, apos);
    };
    pinta();
  }, true);
  // (closing it: the sheet shows the names and pictures as they are now)
  const fundo = [...document.querySelectorAll('.modal')].pop(); const obs = new MutationObserver(() => { if (!document.body.contains(fundo)) { obs.disconnect(); limparArmas(); renderArmas(); } }); obs.observe(document.body, { childList: true });
}

// ------------------------------------------------------------ export
/* only what differs from the game goes into the file */
function armasExportadas() {
  return oficina().armas.filter(armaMudou).map(a => {
    const wid = a.id; const w = armaPorId(wid); const o = { id: wid };
    if (a.runa) Object.assign(o, { rune: true, base: a.base, start: !!a.inicio });
    if (a.nova) {
      const n = a.nova;
      o.replace = { name: n.nome || 'New weapon', range: n.alcance || ALCANCES[w?.RangeApproximation] || 'Melee', parts: ['A', 'B', 'C'].map((sl, s) => { const q = (n.pecas || {})[sl] || {};
        const hab = q.copia === '-' ? null : q.copia ? { copy: q.copia } : (q.texto ? { name: q.nome || '', text: q.texto, chance: s ? (q.chance ?? 30) : 0 } : null);
        const forma = q.imagem && q.molde ? formaForjada(w, s, q.molde) : null;
        return { slot: sl, name: q.nome || ['Head', 'Haft', 'Grip'][s], ...(q.imagem ? { image: q.imagem } : {}), ...(forma ? { layout: forma } : {}), ...(s === 0 ? { damage: q.dano ?? 3, traits: q.traits || [] } : {}), ...(hab ? { ability: hab } : {}) }; }) };
      return o;
    }
    if (a.nome) o.name = a.nome;
    const partes = Object.entries(a.pecas || {}).filter(([, e]) => Object.keys(e).length).map(([pid, e]) => { const p = itemDoJogo(pid); const forma = e.imagem && e.molde && p ? formaForjada(w, p.Slot, e.molde) : null;
      return { id: pid, ...(e.nome ? { name: e.nome } : {}), ...(e.dano !== undefined ? { damage: e.dano } : {}), ...(e.traits ? { traits: e.traits } : {}), ...(e.texto ? { text: e.texto } : {}), ...(e.chance !== undefined ? { chance: e.chance } : {}), ...(e.imagem ? { image: e.imagem } : {}), ...(forma ? { layout: forma } : {}) }; });
    if (partes.length) o.parts = partes;
    return o;
  }).filter(o => o.name || o.parts || o.replace);
}
