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
    <p class="ajuda">Pick a kind of weapon, then its heads, hafts or grips. What you change applies while this ${campanha ? 'campaign' : 'map'} is played (to every copy of the part, also the ones bought or found later); what you leave stays as in the game.</p><div id="f_lista"></div></div>`;
  const l = $('#f_lista');
  dosHerois.forEach(x => {
    const a = armaEditada(x.w._id); const sel = armaSel === x.w._id;
    const d = document.createElement('div'); d.className = 'no' + (sel ? ' ativo' : '');
    const img = figurasDaArma(x.w)[0];
    const novas = [0, 1, 2].reduce((n, s) => n + pecasPropriasDe(x.k, s).length, 0);
    d.innerHTML = `${img ? `<img class="face quadrada" src="${img}" alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div>${esc(NOME_CLASSE[x.k])}${nomeDaArma(x.w) !== NOME_CLASSE[x.k] && nomeDaArma(x.w) !== x.w.name_en ? ' · ' + esc(nomeDaArma(x.w)) : ''}</div><small>${esc(nomeDoHeroi(x.heroi))}’s${armaMudou(a) ? (a.nova ? ' · new weapon' : ' · changed') : ''}${novas ? ' · ' + novas + ' new part(s)' : ''}</small></div>`;
    d.onclick = () => { if (armaSel !== x.w._id) slotSel = 0; armaSel = x.w._id; pecaAberta = null; renderArmas(); }; l.appendChild(d);
    if (sel) { const sub = document.createElement('div'); sub.className = 'subLista';
      sub.innerHTML = EXPL_SLOT.map(([n, curta], s) => `<div class="no sub ${slotSel === s ? 'ativo' : ''}" data-slot="${s}"><div><div>${'ABC'[s]} · ${n}</div><small>${curta}</small></div></div>`).join('');
      sub.querySelectorAll('[data-slot]').forEach(e => e.onclick = () => { slotSel = +e.dataset.slot; pecaAberta = null; renderArmas(); }); l.appendChild(sub); }
  });
  // runes and unique weapons: one entry, each weapon whole
  const r = document.createElement('div'); r.className = 'no' + (naRuna ? ' ativo' : '');
  const imgR = figurasDaArma(runas[0].w)[0];
  r.innerHTML = `${imgR ? `<img class="face quadrada" src="${imgR}" alt="" style="object-fit:contain">` : '<span class="face"></span>'}<div><div>Runes / unique</div><small>any hero · ${runas.length} weapon(s)</small></div>`;
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
    <div class="vistaArma">${figurasDaArma(w).map(f => f ? `<img src="${f}" alt="">` : '<span></span>').join('')}</div>
    <button class="sm" data-irarma="${w._id}">Edit in the Weapons tab →</button></div>`;
}

function fichaArma(c, x) {
  const w = x.w, k = x.k; const a = armaEditada(w._id) || {}; const nova = a.nova;
  const propria = x.runa === 'propria';
  const etiqueta = propria ? 'rune of the workshop' : armaMudou(a) ? (nova ? 'new weapon' : 'changed') : 'as in the game';
  const cab = `<div class="cabF"><h2>${esc(nomeDaArma(w))} <span class="etq ${armaMudou(a) ? 'custom' : ''}">${etiqueta}</span></h2><div class="botoes">${propria ? '<button class="sm perigo" id="fa_apaga">Delete this rune</button>' : armaMudou(a) ? '<button class="sm perigo" id="fa_volta">Back to the game’s weapon</button>' : ''}</div></div>`;
  const quem = x.runa ? 'A rune: any hero may take it, in the hero choice before a quest or in the armory, once the party has its rune (part A).' : `Weapon ${x.i + 1} of ${esc(nomeDoHeroi(x.heroi))} (${NOME_CLASSE[k]}).`;
  const nomeCampo = `<label class="campo">Name <input data-wnome="${w._id}" value="${esc(nova ? nova.nome || '' : a.nome || '')}" placeholder="${esc(nova ? (propria ? 'Name of the new rune' : 'Name of the new weapon') : w.name_en)}"></label><p class="ajuda">${quem}</p>` +
    (propria ? `<label class="campo">Made from <select data-rbase>${RUNAS_JOGO().map(r => `<option value="${r._id}" ${a.base === r._id ? 'selected' : ''}>${esc(r.name_en)}${r._id === 'WEAPON_DRAGONSBANE' ? ' (Dragonsbane)' : ''}</option>`).join('')}</select></label><p class="ajuda">The game rune it copies: frame, figure and sounds in the app, and the pictures of the parts you leave as they are.</p>
      <label class="chk"><input type="checkbox" data-rinicio ${a.inicio ? 'checked' : ''}> The party has it from the start of the ${campanha ? 'campaign’s maps' : 'map'} (the heroes pick it in the hero choice)</label>` : '');
  const montar = `<button class="sm" data-montar="${w._id}" title="Drag the pieces to put the weapon together, forge the template and bake the pictures">⚒ Assemble / template</button>`;
  const novaPeca = x.runa ? '' : `<button class="sm primario" data-novapeca="${slotSel}" title="A new ${['head', 'haft', 'grip'][slotSel]} of the workshop for this weapon: an item the party gets from a trigger or crafts with a recipe">+ New ${['head', 'haft', 'grip'][slotSel]}</button>`;
  const modos = x.runa ? `<div class="botoes">${montar}</div>` : `<div class="botoes"><button class="sm ${nova ? '' : 'ativo'}" data-wmodo="jogo" data-w="${w._id}">${esc(w.name_en)} of the game (edit its parts)</button><button class="sm ${nova ? 'ativo' : ''}" data-wmodo="nova" data-w="${w._id}">A new weapon in its place</button>${montar}${novaPeca}</div>`;
  const vista = `<div class="vistaArma">${figurasDaArma(w).map(f => f ? `<img src="${f}" alt="">` : '<span></span>').join('')}<small>${nova ? 'new weapon' : 'starting pieces'}: A · B · C</small></div>`;
  let corpo;
  const [nomeSlot, , explSlot] = EXPL_SLOT[slotSel];
  const cabSlot = x.runa ? '' : `<div class="secaoSlot"><h3>${'ABC'[slotSel]} · ${nomeSlot}</h3><p class="ajuda">${explSlot}</p></div>`;
  if (nova) corpo = cabSlot + formArmaNova(w, nova, x.runa ? null : slotSel);
  else if (x.runa) { const pecas = pecasDaArma(w);
    corpo = `<p class="ajuda">${w.RangeApproximation !== undefined ? 'Range: ' + ALCANCES[w.RangeApproximation] + '. ' : ''}A rune is taken whole: its three cards go together. Click one to change it; <b>+</b> marks the upgraded rune.</p>` + EXPL_RUNA.map(([sl, expl], s) => `<div class="sub pequena">${sl} · ${expl}</div>` + pecas.filter(p => p.Slot === s).map(p => linhaDePeca(w, p, (a.pecas || {})[p._id])).join('')).join(''); }
  else { const pecas = pecasDaArma(w).filter(p => p.Slot === slotSel); const proprias = pecasPropriasDe(k, slotSel);
    corpo = cabSlot + `<p class="ajuda">${w.RangeApproximation !== undefined ? 'Range of the weapon: ' + ALCANCES[w.RangeApproximation] + '. ' : ''}Click a part to change it. <b>+</b> marks the upgraded version.</p>` + pecas.map(p => linhaDePeca(w, p, (a.pecas || {})[p._id])).join('')
      + `<div class="sub pequena">New ${nomeSlot.toLowerCase()} of the workshop</div>`
      + (proprias.length ? proprias.map(linhaDePecaPropria).join('') : `<p class="ajuda">None yet (“+ New ${nomeSlot.toLowerCase().replace(/s$/, '')}” above). A new ${nomeSlot.toLowerCase().replace(/s$/, '')} is an item: the party gets it from a “Give an item” trigger or crafts it with a recipe, and fits it in the armory.</p>`); }
  c.innerHTML = `${cab}<div class="ativ arma" data-arma="${w._id}">${nomeCampo}${modos}${vista}${corpo}</div>`;
  const apaga = $('#fa_apaga'); if (apaga) apaga.onclick = () => { if (!confirm('Delete the rune “' + nomeDaArma(w) + '”?')) return; oficina().armas = oficina().armas.filter(z => z.id !== w._id); esquecerFicha('itens', 'RUNA:' + w._id); armaSel = null; renderArmas(); };
  const rb = c.querySelector('[data-rbase]'); if (rb) rb.onchange = () => { a.base = rb.value; renderArmas(); };
  const ri = c.querySelector('[data-rinicio]'); if (ri) ri.onchange = () => { a.inicio = ri.checked; renderArmas(); };
  const volta = $('#fa_volta'); if (volta) volta.onclick = () => { if (!confirm('Undo every change to the ' + w.name_en + '?')) return; oficina().armas = oficina().armas.filter(z => z.id !== w._id); pecaAberta = null; renderArmas(); };
  c.querySelectorAll('[data-novapeca]').forEach(b => b.onclick = () => { const sl = +b.dataset.novapeca; const nome = tr(['New head', 'New haft', 'New grip'][sl]);
    const it = { id: 'B_' + uid(), base: null, custom: true, cls: 'WeaponPartsModel', nome, desc: '', raridade: 1, valor: 50, imagemBase: '', retrato: '', classe: CLASSES_ARMA[k], slot: 'ABC'[sl], traits: sl ? [] : ['Slash'], dano: sl ? 0 : 3, habilidade: '', habTexto: '', habChance: 30, unico: false, digital: true, efeitoBase: '' };
    bestiario().itens.push(it); pecaAberta = it.id; renderArmas(); });
  c.querySelectorAll('[data-pecap]').forEach(d => d.onclick = () => { pecaAberta = pecaAberta === d.dataset.pecap ? null : d.dataset.pecap; renderArmas(); });
  c.querySelectorAll('[data-corpop]').forEach(el => formPecaPropria(el, w, ITENS_B().find(i => i.id === el.dataset.corpop)));
  ligarArmas(c, w);
}
/* a part of the workshop: an item (Weapon part) of this kind and slot */
function linhaDePecaPropria(it) {
  const aberta = pecaAberta === it.id; const img = retratoDoItem(it);
  const resumo = [it.slot === 'A' ? (it.dano || 0) + ' damage' + ((it.traits || []).length ? ' · ' + it.traits.join(', ') : '') : '', it.habilidade ? 'ability copied' : it.habTexto ? (it.slot === 'A' ? 'own power' : (it.habChance ?? 30) + '%') : 'no ability', (RARIDADES[it.raridade] || '') + ' · ' + (it.valor || 0) + ' gold'].filter(Boolean).join(' · ');
  return `<div class="gat peca propria ${aberta ? 'aberta' : ''}"><div class="cab" data-pecap="${it.id}"><span>${aberta ? '▾' : '▸'}</span>${img ? `<img class="icoPeca" src="${img}" alt="">` : ''}<b>${esc(it.nome)}</b><small>${esc(resumo)} · workshop</small></div>${aberta ? `<div class="corpo" data-corpop="${it.id}"></div>` : ''}</div>`;
}
function formPecaPropria(el, w, it) {
  if (!it) return; const s = 'ABC'.indexOf(it.slot || 'A'); const inicio = itemDoJogo((w.StartingWeaponParts || [])[s]?.id);
  const hab = it.habilidade ? itemDoJogo(it.habilidade) : null;
  el.innerHTML = `<label class="campo">Name <input data-ik="nome" value="${esc(it.nome || '')}"></label>
    ${campoImagemPeca(it.retrato, imagemDaPeca(inicio), 'q')}
    <div class="duas"><label class="campo">Rarity <select data-ik="raridade">${RARIDADES.map((r, n) => n ? `<option value="${n}" ${it.raridade === n ? 'selected' : ''}>${r}</option>` : '').join('')}</select></label><label class="campo">Value (gold) <input type="number" min="0" data-ik="valor" value="${it.valor || 0}"></label></div>
    ${s === 0 ? `<label class="campo">Damage <input type="number" min="0" max="20" data-ik="dano" value="${it.dano ?? 3}" style="width:80px"></label><div class="chks tres">${DANOS.map(d => `<label class="chk"><input type="checkbox" data-itrait value="${d}" ${(it.traits || []).includes(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div>` : ''}
    <label class="campo">${s === 0 ? 'Power of the hero' : 'Ability'} <select data-ik="habilidade"><option value="">${s === 0 ? 'My own power (text)' : 'My own ability (text and chance)'}</option><option value="-" ${it.habilidade === '-' ? 'selected' : ''}>None</option>${habilidadesParaCopiar(s).map(x => `<option value="${x.a._id}" ${it.habilidade === x.a._id ? 'selected' : ''}>Copy: ${esc(semGlifo(x.a.name_en || x.p.name_en))}${/_UPGRADED$/.test(x.p._id) ? ' +' : ''}${automatica(x.p) ? ' (automatic)' : ''}</option>`).join('')}</select></label>
    ${it.habilidade && it.habilidade !== '-' ? `<p class="ajuda">${esc(textoDoJogo(hab && hab.desc_en))}</p>` : it.habilidade === '-' ? '' : `${s > 0 ? `<label class="campo">Chance (%) <input type="number" min="0" max="100" data-ik="habChance" value="${it.habChance ?? 30}" style="width:70px"></label>` : ''}<div class="txAtiv" data-itx></div>`}
    <p class="ajuda">An item of the workshop: give it with a “Give an item” trigger or craft it with a recipe; the heroes fit it in the armory.</p>
    <div class="botoes"><button class="sm" data-ireceita>${(oficina().receitas || []).some(r => r.item === it.id) ? 'Its recipe' : '+ A recipe for it'}</button><button class="sm perigo" data-iapaga>Delete this part</button></div>`;
  const redes = () => renderArmas();
  el.querySelectorAll('[data-ik]').forEach(inp => { const h = () => { const k = inp.dataset.ik; it[k] = inp.type === 'number' || k === 'raridade' ? +inp.value || 0 : inp.value; if (k === 'nome') el.closest('.gat').querySelector('b').textContent = it.nome; if (inp.tagName === 'SELECT') redes(); }; if (inp.tagName === 'SELECT') inp.onchange = h; else inp.oninput = h; });
  el.querySelectorAll('[data-itrait]').forEach(cb => cb.onchange = () => { it.traits = [...el.querySelectorAll('[data-itrait]:checked')].map(z => z.value); });
  const up = el.querySelector('[data-qimg]'); if (up) up.onchange = async e => { const f = e.target.files[0]; if (!f) return; it.retrato = await lerImagem(f, 512); redes(); };
  const es = el.querySelector('[data-qesp]'); if (es) es.onclick = async () => { try { it.retrato = await espelharImagem(it.retrato); } catch { return aviso('Could not flip this picture.'); } redes(); };
  const vj = el.querySelector('[data-qimgjogo]'); if (vj) vj.onclick = () => { it.retrato = ''; redes(); };
  const tam = el.querySelector('[data-qtam]'); const ij = imagemDaPeca(inicio); if (tam && ij) { const im = new Image(); im.onload = () => { tam.textContent = im.naturalWidth + '×' + im.naturalHeight + ' px'; }; im.src = ij; }
  const tx = el.querySelector('[data-itx]'); if (tx) { const obj = { text: it.habTexto || '', hint: '' }; editorDeTexto(tx, obj, () => { it.habTexto = obj.text; }, { soRegras: true, exemploNome: s === 0 ? 'Heavy Blow' : 'Bleed', exemploRegras: s === 0 ? 'Spend 1 [fatigue]: add 2 [damage].' : 'The target suffers 1 [damage].' }); }
  el.querySelector('[data-ireceita]').onclick = () => { const r = (oficina().receitas || []).find(x => x.item === it.id); if (r) { abaF = 'receitas'; fichaSel = r.id; renderFichas(); } else novaReceita(it.id); };
  el.querySelector('[data-iapaga]').onclick = () => { if (!confirm('Delete “' + it.nome + '”?')) return; const l = bestiario().itens; l.splice(l.indexOf(it), 1); esquecerFicha('itens', it.id); pecaAberta = null; redes(); };
}
function resumoPeca(p, e) {
  const hab = habilidadeDe(p); const dano = e && e.dano !== undefined ? e.dano : p.Damage; const tr = e && e.traits ? e.traits : (p.Traits || []).map(t => DANOS[t]);
  const ch = e && e.chance !== undefined ? e.chance : hab ? Math.round(hab.Chance * 100) : 0;
  return [e && e.imagem ? 'own picture' + (e.molde ? ' (box fixed)' : '') : '', p.Slot === 0 ? dano + ' damage' + (tr.length ? ' · ' + tr.join(', ') : '') : '', p.Slot > 0 && hab ? ch + '%' : '', !hab ? 'no ability' : ''].filter(Boolean).join(' · ');
}
function linhaDePeca(w, p, e) {
  const aberta = pecaAberta === p._id; const img = (e && e.imagem) || imagemDaPeca(p); const up = /_UPGRADED$/.test(p._id) || p.IsUpgrade;
  return `<div class="gat peca ${aberta ? 'aberta' : ''}"><div class="cab" data-peca="${p._id}"><span>${aberta ? '▾' : '▸'}</span>${img ? `<img class="icoPeca" src="${img}" alt="">` : ''}<b>${esc((e && e.nome) || semGlifo(p.name_en))}${up ? ' +' : ''}</b><small>${esc(resumoPeca(p, e))}${e && Object.keys(e).length ? ' · changed' : ''}</small></div>${aberta ? `<div class="corpo" data-corpo="${p._id}" data-w="${w._id}"></div>` : ''}</div>`;
}
function formPeca(el, w, p, apos) {
  const hab = habilidadeDe(p); const pegar = () => { const a = armaParaEditar(w._id); a.pecas = a.pecas || {}; return (a.pecas[p._id] = a.pecas[p._id] || {}); };
  const e = ((armaEditada(w._id) || {}).pecas || {})[p._id] || {};
  const tr = e.traits || (p.Traits || []).map(t => DANOS[t]);
  el.innerHTML = `<label class="campo">Name <input data-pk="nome" value="${esc(e.nome || '')}" placeholder="${esc(semGlifo(p.name_en))}"></label>
    ${campoImagemPeca(e.imagem, imagemDaPeca(p), 'p')}${e.molde ? '<p class="ajuda">Box fixed: the app draws this picture in the box you set in “Assemble”.</p>' : ''}
    ${p.Slot === 0 ? `<label class="campo">Damage <input type="number" min="0" max="20" data-pk="dano" value="${e.dano ?? p.Damage}" style="width:80px"></label><div class="sub pequena">Damage types</div><div class="chks tres">${DANOS.map(d => `<label class="chk"><input type="checkbox" data-trait="${d}" ${tr.includes(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div>` : ''}
    ${hab ? `<div class="sub pequena">${p.Slot === 0 ? 'Power of the hero (spend to use)' : 'Ability'}${p.Slot > 0 ? ` · chance <input type="number" min="0" max="100" data-pk="chance" value="${e.chance ?? Math.round(hab.Chance * 100)}" style="width:64px">%` : ''}</div>
      ${automatica(p) ? '<p class="ajuda aviso">The app applies this ability by itself. Changing the text does not change what it does' + (p.Slot > 0 ? ' (the chance does change)' : '') + '.</p>' : '<p class="ajuda">The app shows this text when the ability triggers; the players apply it.</p>'}
      <div class="txAtiv" data-hab></div>` : '<p class="ajuda">No ability (a starting part).</p>'}
    <button class="sm" data-pvolta>Back to the game’s part</button>`;
  el.querySelectorAll('[data-pk]').forEach(inp => inp.oninput = () => { const x = pegar(); const k = inp.dataset.pk; if (inp.value === '') delete x[k]; else x[k] = inp.type === 'number' ? +inp.value : inp.value.trim(); if (x[k] === '') delete x[k]; });
  ligarImagemPeca(el, 'p', () => pegar(), apos, imagemDaPeca(p));
  el.querySelectorAll('[data-trait]').forEach(cb => cb.onchange = () => { pegar().traits = [...el.querySelectorAll('[data-trait]:checked')].map(z => z.dataset.trait); });
  const d = el.querySelector('[data-hab]');
  if (d) { const obj = { text: e.texto || hab.desc_en || '', hint: '' }; editorDeTexto(d, obj, () => { const x = pegar(); if (obj.text && obj.text !== hab.desc_en) x.texto = obj.text; else delete x.texto; }, { soRegras: true, exemploNome: 'Heavy Blow', exemploRegras: 'During this attack, add 1 [damage].' }); }
  el.querySelector('[data-pvolta]').onclick = () => { const a = armaEditada(w._id); if (a && a.pecas) delete a.pecas[p._id]; pecaAberta = null; apos(); };
}
/* abilities of the game that a new part may copy (same slot): the copy keeps what the app does with it */
const _habsCopiar = {};   // by slot: the catalog does not change
function habilidadesParaCopiar(s) {
  if (_habsCopiar[s]?.length) return _habsCopiar[s];
  const vistas = new Set(); return _habsCopiar[s] = CAT.itens.filter(i => i._cls === 'WeaponPartsModel' && i.Slot === s && i.Ability && i.Ability.id).map(p => ({ p, a: habilidadeDe(p) })).filter(x => x.a && !vistas.has(x.a._id) && vistas.add(x.a._id))
    .sort((x, y) => (x.a.name_en || '').localeCompare(y.a.name_en || ''));
}
function formArmaNova(w, n, soSlot) {
  n.pecas = n.pecas || {};
  return `<label class="campo">Range <select data-nk="alcance">${ALCANCES.map(r => `<option ${(n.alcance || ALCANCES[w.RangeApproximation] || 'Melee') === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <p class="ajuda">${w._runaPropria ? 'A rune of its own, made from the ' + esc(itemDoJogo(armaEditada(w._id)?.base)?.name_en || 'game rune') + ' (same frame, figure and sounds). The rune (part A) is what the party receives; with it any hero may take the weapon.' : 'It takes the place of the ' + esc(w.name_en) + ' while the ' + (campanha ? 'campaign' : 'map') + ' is played (same figure and sounds), in the hands of whoever has it. Upgrades bought in the campaign do not apply to it.'}</p>` +
    SLOTS_ARMA.map(([sl, expl], s) => { if (soSlot !== null && soSlot !== undefined && s !== soSlot) return ''; const q = n.pecas[sl] || {}; const hab = q.copia ? itemDoJogo(q.copia) : null;
      return `<div class="ativ novaPeca"><div class="sub pequena">${sl} · ${expl}</div>
        <label class="campo">Name <input data-np="${sl}" data-nq="nome" value="${esc(q.nome || '')}" placeholder="${['Head', 'Haft', 'Grip'][s]}"></label>
        <div data-nimg="${sl}">${campoImagemPeca(q.imagem, imagemDaPeca(itemDoJogo((w.StartingWeaponParts || [])[s]?.id)), 'n')}${q.molde ? '<p class="ajuda">Box fixed: the app draws this picture in the box you set in “Assemble”.</p>' : ''}</div>
        ${s === 0 ? `<label class="campo">Damage <input type="number" min="0" max="20" data-np="${sl}" data-nq="dano" value="${q.dano ?? 3}" style="width:80px"></label><div class="chks tres">${DANOS.map(d => `<label class="chk"><input type="checkbox" data-ntrait="${sl}" value="${d}" ${(q.traits || []).includes(d) ? 'checked' : ''}> ${d}</label>`).join('')}</div>` : ''}
        <label class="campo">Ability <select data-np="${sl}" data-nq="copia"><option value="">${s === 0 ? 'My own power (text)' : 'My own ability (text and chance)'}</option><option value="-" ${q.copia === '-' ? 'selected' : ''}>None</option>${habilidadesParaCopiar(s).map(x => `<option value="${x.a._id}" ${q.copia === x.a._id ? 'selected' : ''}>Copy: ${esc(semGlifo(x.a.name_en || x.p.name_en))}${/_UPGRADED$/.test(x.p._id) ? ' +' : ''}${automatica(x.p) ? ' (automatic)' : ''}</option>`).join('')}</select></label>
        ${q.copia && q.copia !== '-' ? `<p class="ajuda">${esc(textoDoJogo(hab && hab.desc_en))}${hab && s > 0 ? ' (' + Math.round(hab.Chance * 100) + '%)' : ''}</p>` : q.copia === '-' ? '' : `${s > 0 ? `<label class="campo">Chance (%) <input type="number" min="0" max="100" data-np="${sl}" data-nq="chance" value="${q.chance ?? 30}" style="width:70px"></label>` : ''}<div class="txAtiv" data-ntx="${sl}"></div><p class="ajuda">The app shows this text when it triggers; the players apply it.</p>`}
      </div>`; }).join('');
}
function ligarArmas(c, w) {
  const apos = () => { limparArmas(); renderArmas(); };
  const ed = () => armaParaEditar(w._id);
  c.querySelectorAll('[data-wnome]').forEach(inp => inp.oninput = () => { const a = ed(); const v = inp.value.trim(); if (a.nova) a.nova.nome = v; else if (v) a.nome = v; else delete a.nome; c.querySelector('h2').firstChild.textContent = nomeDaArma(w) + ' '; });
  c.querySelectorAll('[data-wmodo]').forEach(b => b.onclick = () => { const a = ed(); if (b.dataset.wmodo === 'nova') { if (!a.nova) a.nova = { nome: '', pecas: { A: { dano: 3, traits: ['Slash'] }, B: {}, C: {} } }; } else if (a.nova && confirm('Drop the new weapon and go back to the game’s?')) delete a.nova; apos(); });
  c.querySelectorAll('[data-montar]').forEach(b => b.onclick = () => abrirMontagem(w._id));
  c.querySelectorAll('[data-peca]').forEach(d => d.onclick = () => { pecaAberta = pecaAberta === d.dataset.peca ? null : d.dataset.peca; renderArmas(); });
  c.querySelectorAll('[data-corpo]').forEach(el => formPeca(el, w, itemDoJogo(el.dataset.corpo), apos));
  // new weapon
  const novaDe = () => ed().nova;
  c.querySelectorAll('[data-nk]').forEach(s => s.onchange = () => { novaDe()[s.dataset.nk] = s.value; });
  c.querySelectorAll('[data-np]').forEach(inp => { const h = () => { const n = novaDe(); const q = (n.pecas[inp.dataset.np] = n.pecas[inp.dataset.np] || {}); const k = inp.dataset.nq; q[k] = inp.type === 'number' ? +inp.value : inp.value; if (k === 'copia') apos(); }; if (inp.tagName === 'SELECT') inp.onchange = h; else inp.oninput = h; });
  c.querySelectorAll('[data-ntrait]').forEach(cb => cb.onchange = () => { const n = novaDe(); const sl = cb.dataset.ntrait; (n.pecas[sl] = n.pecas[sl] || {}).traits = [...cb.closest('.novaPeca').querySelectorAll('[data-ntrait]:checked')].map(z => z.value); });
  c.querySelectorAll('[data-nimg]').forEach(d => { const sl = d.dataset.nimg; const n = novaDe(); ligarImagemPeca(d, 'n', () => (n.pecas[sl] = n.pecas[sl] || {}), apos, imagemDaPeca(itemDoJogo((w.StartingWeaponParts || [])[['A', 'B', 'C'].indexOf(sl)]?.id))); });
  c.querySelectorAll('[data-ntx]').forEach(d => { const n = novaDe(); const q = (n.pecas[d.dataset.ntx] = n.pecas[d.dataset.ntx] || {}); const obj = { text: q.texto || '', hint: '' }; editorDeTexto(d, obj, () => { q.texto = obj.text; }, { soRegras: true, exemploNome: 'Thunderclap', exemploRegras: 'The target is dazed.' }); });
}

/* the picture of a weapon part: the piece drawn in the weapon (the game lays the three pieces A, B and C over each
   other in the weapon's frame) and its icon in the lists. Same proportions as the game's piece fit best. */
function campoImagemPeca(propria, doJogo, pre) {
  const atual = propria || doJogo;
  return `<div class="retrato imgPeca"><div class="quadro">${atual ? `<img src="${atual}" alt="" data-${pre}medida>` : '<span>no picture</span>'}</div><div>
    <label class="sm botaoArquivo">Upload a picture (PNG)<input type="file" accept="image/png,image/webp,image/jpeg" data-${pre}img hidden></label>
    ${propria ? `<button class="sm" data-${pre}esp>⇋ Mirror</button><button class="sm" data-${pre}imgjogo>Use the game’s</button>` : ''}
    <p class="ajuda" data-${pre}dica>The piece as drawn in the weapon. Transparent PNG, ideally the same shape as the game’s${doJogo ? ' (<span data-' + pre + 'tam>…</span>)' : ''}.</p></div></div>`;
}
/* an uploaded picture goes to the game's box (a forged box belonged to the picture it was baked with) */
function ligarImagemPeca(el, pre, alvo, apos, doJogo) {
  const up = el.querySelector(`[data-${pre}img]`); if (up) up.onchange = async e => { const f = e.target.files[0]; if (!f) return; const x = alvo(); x.imagem = await lerImagem(f, 512); delete x.molde; apos(); };
  const es = el.querySelector(`[data-${pre}esp]`); if (es) es.onclick = async () => { const x = alvo(); if (!x.imagem) return; try { x.imagem = await espelharImagem(x.imagem); } catch { return aviso('Could not flip this picture.'); } apos(); };
  const vj = el.querySelector(`[data-${pre}imgjogo]`); if (vj) vj.onclick = () => { const x = alvo(); delete x.imagem; delete x.molde; apos(); };
  const tam = el.querySelector(`[data-${pre}tam]`); if (tam && doJogo) { const i = new Image(); i.onload = () => { tam.textContent = i.naturalWidth + '×' + i.naturalHeight + ' px'; }; i.src = doJogo; }
}

// ------------------------------------------------------------ assembling a weapon (drag the pieces, forge the template, bake)
/* where the app puts each piece of each weapon: centre (x right, y up, from the middle of the weapon frame) and size of
   the box A, B and C; the piece is fitted in its box keeping its proportions. "rot": the whole set is turned (degrees). */
const MOLDES_ARMA = {"bow":{"A":[-41.5,0.0,163.9,479.6],"B":[11.8,0.0,18.8,458.7],"C":[82.6,0.0,58.0,369.0]},"crossbow":{"A":[-13.3,-33.2,354.0,291.0],"B":[6.9,-2.0,372.0,262.0],"C":[-25.6,111.8,188.0,104.0]},"dragonsbane":{"A":[0.0,0.0,318.0,500.0],"B":[0.0,0.0,318.0,500.0],"C":[0.0,0.0,318.0,500.0]},"dualblades":{"A":[20.5,56.7,277.0,378.0],"B":[106.3,-48.9,200.0,237.0],"C":[-48.3,-124.1,306.0,234.0]},"gauntlet":{"A":[100.8,-90.7,206.0,221.0],"B":[63.8,-70.3,211.0,221.0],"C":[-63.0,89.6,285.0,288.0]},"hammer":{"A":[51.5,90.3,312.0,247.0],"B":[-20.5,-5.5,152.0,167.0],"C":[-121.0,-125.9,165.0,150.0]},"knives":{"A":[-5.3,-77.6,248.0,248.0],"B":[22.4,-37.4,208.0,210.0],"C":[31.7,6.0,409.0,368.0]},"runefear":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runeice":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runelightning":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runeofblades":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"runesunburst":{"A":[0.0,0.0,318.0,400.0],"B":[0.0,0.0,318.0,400.0],"C":[0.0,0.0,318.0,400.0]},"spear":{"A":[-0.2,179.0,142.0,167.0],"B":[-0.0,-27.8,46.0,377.0],"C":[-1.5,-206.1,106.0,101.0]},"staff":{"A":[0.0,0.0,122.0,512.0],"B":[12.9,-21.8,91.0,248.0],"C":[0.0,0.0,122.0,512.0]},"sword":{"A":[-20.4,83.4,184.0,337.0],"B":[8.9,-68.8,186.0,98.0],"C":[8.6,-161.1,49.0,173.0]},"wand":{"A":[25.4,48.2,372.0,360.0],"B":[-105.9,-71.8,132.0,151.0],"C":[-146.7,-157.5,132.0,151.0]},"warbell":{"A":[0.1,-169.1,190.0,168.0],"B":[-2.4,147.6,108.0,213.0],"C":[0.4,-39.6,61.0,187.0]},"warhammer":{"A":[78.9,151.2,184.0,155.0],"B":[-28.3,-23.5,160.0,364.0],"C":[-139.0,-201.0,61.0,83.0],"rot":-13.09}};
const moldeDaArma = w => MOLDES_ARMA[(w?._bundle || '').split('/').pop()];
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
function abrirMontagem(wid) {
  const w = armaPorId(wid); const lay = moldeDaArma(w); if (!lay) return aviso('No layout known for this weapon.');
  const a = armaEditada(wid) || {}; const nova = a.nova;
  const inicio = (w.StartingWeaponParts || []).map(r => r.id);
  const escolhidas = ['A', 'B', 'C'].map((sl, s) => inicio[s]);   // part ids (game mode)
  const entradaDe = s => nova ? ((nova.pecas || {})['ABC'[s]] || {}) : (((a.pecas || {})[escolhidas[s]]) || {});
  const fonteDe = s => entradaDe(s).imagem || imagemDaPeca(itemDoJogo(nova ? inicio[s] : escolhidas[s]));
  const jogo = s => lay['ABC'[s]].slice(0, 4);
  /* the template: the game's boxes, or the forged box saved with the picture of the piece */
  const moldes = [0, 1, 2].map(s => (entradaDe(s).molde || jogo(s)).slice());
  const phi = -(lay.rot || 0) * Math.PI / 180;   // canvas angle (y down) of the boxes
  const caixa = s => { const b = moldes[s]; return { cx: b[0], cy: -b[1], w: b[2], h: b[3] }; };
  const camadas = [0, 1, 2].map(s => ({ s, img: null, x: 0, y: 0, k: 1, r: 0 }));   // r: turn of the piece (degrees)
  let sel = 0, verCaixas = true, arrasto = null;
  const ajustar = c => { const b = caixa(c.s); if (!c.img) return; c.k = Math.min(b.w / c.img.naturalWidth, b.h / c.img.naturalHeight); c.x = b.cx; c.y = b.cy; c.r = 0; };
  const carregar = (c, src) => new Promise(ok => { if (!src) { c.img = null; return ok(); } const i = new Image(); i.onload = () => { c.img = i; ok(); }; i.onerror = () => { c.img = null; ok(); }; i.src = src; });
  const L = 620;
  const opcoesPeca = s => pecasDaArma(w).filter(p => p.Slot === s).map(p => `<option value="${p._id}" ${escolhidas[s] === p._id ? 'selected' : ''}>${esc(semGlifo(p.name_en))}${/_UPGRADED$/.test(p._id) ? ' +' : ''}</option>`).join('');
  const html = `<p class="ajuda">Drag the pieces to put the weapon together as you want it; the wheel (or the slider) changes the size of the chosen piece, Shift+wheel, Q/E or the turn slider rotate it, the arrows nudge it. A piece only shows inside its own box: what goes out of it is cut (shown faint). <b>Fix box</b> moves the box of the piece to where you left it: the template changes and the app draws the piece there. <b>Forge</b> turns each piece into a picture of the exact size of its box and puts it in the weapon.${lay.rot ? ' In the app this weapon is turned ' + Math.abs(lay.rot) + '°; the boxes show it.' : ''}</p>
    <div class="montagem"><canvas id="mt_tela" width="${L}" height="${L}" tabindex="0"></canvas><div class="mtLado">
      ${[0, 1, 2].map(s => `<div class="mtPeca" data-mts="${s}"><b>${'ABC'[s]}</b> ${['head', 'haft / guard', 'grip'][s]} <small class="etq" data-mtforjada="${s}">box fixed</small>
        ${nova ? '' : `<select data-mtp="${s}">${opcoesPeca(s)}</select>`}
        <label class="sm botaoArquivo">Picture…<input type="file" accept="image/png,image/webp,image/jpeg" data-mtimg="${s}" hidden></label><button class="sm" data-mtforja="${s}" title="The box of this piece follows where you left it (the template changes)">Fix box</button></div>`).join('')}
      <label class="campo">Size of the chosen piece <input type="range" id="mt_k" min="10" max="400" value="100"></label>
      <label class="campo">Turn of the chosen piece <span class="linha"><input type="range" id="mt_r" min="-180" max="180" value="0" style="flex:1"><input type="number" id="mt_rn" min="-180" max="180" value="0" style="width:64px">°</span></label>
      <label class="chk"><input type="checkbox" id="mt_cx" checked> Show the boxes</label>
      <div class="botoes"><button class="sm primario" id="mt_ok" title="Turn each piece into a picture of its box and put it in the weapon">⚒ Forge</button><button class="sm" id="mt_png">Download the template (PNG)</button><button class="sm" id="mt_jogo" title="The boxes of the game, each piece fitted in its own">Game’s template</button></div>
    </div></div>`;
  const m = modal('Assemble the ' + (nova ? (nova.nome || 'new weapon') : ((a.nome) || w.name_en)), html, async (el, fechar) => {
    const tela = el.querySelector('#mt_tela'), g = tela.getContext('2d'), fk = el.querySelector('#mt_k'), fr = el.querySelector('#mt_r'), frn = el.querySelector('#mt_rn');
    await Promise.all(camadas.map(c => carregar(c, fonteDe(c.s)).then(() => ajustar(c))));
    const desenharCamada = (ctx, c) => { if (!c.img) return; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(phi + (c.r || 0) * Math.PI / 180); ctx.scale(c.k, c.k); ctx.drawImage(c.img, -c.img.naturalWidth / 2, -c.img.naturalHeight / 2); ctx.restore(); };
    const caixas = (ctx, comMedida) => [0, 1, 2].forEach(s => { const b = caixa(s), cor = ['#c84632', '#326ec8', '#3c9646'][s]; ctx.save(); ctx.translate(b.cx, b.cy); ctx.rotate(phi); ctx.strokeStyle = cor; ctx.lineWidth = s === sel ? 3 : 1.5; ctx.setLineDash(s === sel ? [] : [6, 4]); ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.fillStyle = cor; ctx.font = 'bold 15px system-ui'; ctx.fillText('ABC'[s] + (comMedida ? '  ' + Math.round(b.w) + '×' + Math.round(b.h) : '') + (mesmaCaixa(moldes[s], jogo(s)) ? '' : ' fixed'), -b.w / 2 + 4, -b.h / 2 + 16); ctx.restore(); });
    const pintar = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, L, L); g.fillStyle = '#2a2e36'; g.fillRect(0, 0, L, L);
      g.setTransform(1, 0, 0, 1, L / 2, L / 2);
      // the game's box of a forged piece, faint, as a reference
      [0, 1, 2].forEach(s => { if (!verCaixas || mesmaCaixa(moldes[s], jogo(s))) return; const b = jogo(s); g.save(); g.translate(b[0], -b[1]); g.rotate(phi); g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([2, 4]); g.strokeRect(-b[2] / 2, -b[3] / 2, b[2], b[3]); g.restore(); });
      // what the app shows: each piece only inside its box; the chosen piece also shows, faint, what falls outside and is cut
      const recorte = (ctx, sI) => { const b = caixa(sI); ctx.translate(b.cx, b.cy); ctx.rotate(phi); ctx.beginPath(); ctx.rect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.rotate(-phi); ctx.translate(-b.cx, -b.cy); ctx.clip(); };
      g.save(); g.globalAlpha = 0.25; desenharCamada(g, camadas[sel]); g.restore();
      camadas.forEach(c => { g.save(); recorte(g, c.s); desenharCamada(g, c); g.restore(); }); if (verCaixas) caixas(g, true);
      el.querySelectorAll('[data-mts]').forEach(d => d.classList.toggle('ativo', +d.dataset.mts === sel));
      el.querySelectorAll('[data-mtforjada]').forEach(d => { d.style.display = mesmaCaixa(moldes[+d.dataset.mtforjada], jogo(+d.dataset.mtforjada)) ? 'none' : ''; });
      fr.value = frn.value = Math.round(camadas[sel].r || 0);
      fk.value = Math.round((camadas[sel].k / (camadas[sel].img ? Math.min(caixa(sel).w / camadas[sel].img.naturalWidth, caixa(sel).h / camadas[sel].img.naturalHeight) : 1)) * 100); };
    const noPonto = (px, py) => { for (let s = 2; s >= 0; s--) { const c = camadas[s]; if (!c.img) continue; const a = -(phi + (c.r || 0) * Math.PI / 180), dx = px - c.x, dy = py - c.y, cs = Math.cos(a), sn = Math.sin(a); const u = (dx * cs - dy * sn) / c.k, v = (dx * sn + dy * cs) / c.k; if (Math.abs(u) <= c.img.naturalWidth / 2 && Math.abs(v) <= c.img.naturalHeight / 2) return s; } return -1; };
    const ponto = e => { const r = tela.getBoundingClientRect(); return [(e.clientX - r.left) * L / r.width - L / 2, (e.clientY - r.top) * L / r.height - L / 2]; };
    tela.onmousedown = e => { const [x, y] = ponto(e); const s = noPonto(x, y); if (s >= 0) sel = s; arrasto = { x, y, cx: camadas[sel].x, cy: camadas[sel].y }; tela.focus(); pintar(); };
    // window listeners: they drop themselves once the window is closed (they piled up at every opening)
    const mover = e => { if (!tela.isConnected) { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); return; } if (!arrasto) return; const [x, y] = ponto(e); const c = camadas[sel]; c.x = arrasto.cx + x - arrasto.x; c.y = arrasto.cy + y - arrasto.y; pintar(); };
    const soltar = () => { arrasto = null; if (!tela.isConnected) { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); } };
    window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
    const girar = graus => { const c = camadas[sel]; let r = ((c.r || 0) + graus) % 360; if (r > 180) r -= 360; if (r < -180) r += 360; c.r = Math.round(r * 10) / 10; pintar(); };
    tela.onwheel = e => { e.preventDefault(); if (e.shiftKey) { girar((e.deltaY || e.deltaX) < 0 ? -3 : 3); return; } const c = camadas[sel]; c.k *= e.deltaY < 0 ? 1.05 : 1 / 1.05; pintar(); };
    fr.oninput = () => { camadas[sel].r = +fr.value; pintar(); }; frn.oninput = () => { camadas[sel].r = Math.max(-180, Math.min(180, +frn.value || 0)); pintar(); };
    tela.onkeydown = e => { const d = e.shiftKey ? 10 : 1, c = camadas[sel]; if (e.key === 'q' || e.key === 'Q' || e.key === 'e' || e.key === 'E') { e.preventDefault(); girar((e.key.toLowerCase() === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 1)); return; } const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]; if (mv) { e.preventDefault(); c.x += mv[0]; c.y += mv[1]; pintar(); } };
    fk.oninput = () => { const c = camadas[sel]; if (!c.img) return; c.k = Math.min(caixa(sel).w / c.img.naturalWidth, caixa(sel).h / c.img.naturalHeight) * (+fk.value / 100); pintar(); };
    el.querySelector('#mt_cx').onchange = e => { verCaixas = e.target.checked; pintar(); };
    el.querySelectorAll('[data-mts]').forEach(d => d.onclick = e => { if (e.target.closest('select,label,button')) return; sel = +d.dataset.mts; pintar(); });
    el.querySelectorAll('[data-mtp]').forEach(s => s.onchange = async () => { const k = +s.dataset.mtp; escolhidas[k] = s.value; moldes[k] = (entradaDe(k).molde || jogo(k)).slice(); await carregar(camadas[k], fonteDe(k)); ajustar(camadas[k]); sel = k; pintar(); });
    el.querySelectorAll('[data-mtimg]').forEach(inp => inp.onchange = async e => { const f = e.target.files[0]; if (!f) return; const k = +inp.dataset.mtimg; await carregar(camadas[k], await lerImagem(f, 1024)); ajustar(camadas[k]); sel = k; pintar(); });
    /* forge: the box of the piece becomes the piece as it is now (centre, size); the template changes */
    el.querySelectorAll('[data-mtforja]').forEach(b => b.onclick = () => { const k = +b.dataset.mtforja; const c = camadas[k]; sel = k; if (!c.img) { pintar(); return aviso('This piece has no picture.'); }
      // a turned piece: the box takes the whole turned picture (turn measured against the box)
      const t = (c.r || 0) * Math.PI / 180, W = c.img.naturalWidth * c.k, H = c.img.naturalHeight * c.k;
      moldes[k] = [c.x, -c.y, Math.abs(W * Math.cos(t)) + Math.abs(H * Math.sin(t)), Math.abs(W * Math.sin(t)) + Math.abs(H * Math.cos(t))].map(v => Math.round(v * 10) / 10); pintar(); });
    el.querySelector('#mt_jogo').onclick = () => { [0, 1, 2].forEach(s => { moldes[s] = jogo(s); ajustar(camadas[s]); }); pintar(); };
    /* each piece baked into a picture of its box: the app fits it back exactly where it is now */
    const assar = c => { const b = caixa(c.s); const R = Math.max(1, Math.min(3, c.img ? 1 / c.k : 1)); const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(b.w * R)); cv.height = Math.max(1, Math.round(b.h * R));
      const x = cv.getContext('2d'); x.scale(cv.width / b.w, cv.height / b.h); x.translate(b.w / 2, b.h / 2); x.rotate(-phi); x.translate(-b.cx, -b.cy); desenharCamada(x, c); return cv.toDataURL('image/png'); };
    el.querySelector('#mt_ok').onclick = () => {
      const arma = armaParaEditar(wid); let forjadas = 0;
      camadas.forEach(c => { if (!c.img) return; const png = assar(c); let e;
        if (arma.nova) { arma.nova.pecas = arma.nova.pecas || {}; e = (arma.nova.pecas['ABC'[c.s]] = arma.nova.pecas['ABC'[c.s]] || {}); }
        else { arma.pecas = arma.pecas || {}; e = (arma.pecas[escolhidas[c.s]] = arma.pecas[escolhidas[c.s]] || {}); }
        e.imagem = png; if (mesmaCaixa(moldes[c.s], jogo(c.s))) delete e.molde; else { e.molde = moldes[c.s].slice(); forjadas++; } });
      fechar(); limparArmas(); renderFichas(); aviso('Forged: the three pieces now have their own pictures, laid out as you assembled them' + (forjadas ? '; ' + forjadas + ' fixed box(es)' : '') + '.'); };
    el.querySelector('#mt_png').onclick = () => { const cv = document.createElement('canvas'); cv.width = cv.height = L; const x = cv.getContext('2d'); x.fillStyle = '#f5f2eb'; x.fillRect(0, 0, L, L); x.translate(L / 2, L / 2); camadas.forEach(c => { x.save(); const b = caixa(c.s); x.translate(b.cx, b.cy); x.rotate(phi); x.beginPath(); x.rect(-b.w / 2, -b.h / 2, b.w, b.h); x.rotate(-phi); x.translate(-b.cx, -b.cy); x.clip(); desenharCamada(x, c); x.restore(); }); caixas(x, true);
      const link = document.createElement('a'); link.download = 'template ' + (nova ? nova.nome || 'new weapon' : w.name_en) + '.png'; link.href = cv.toDataURL('image/png'); link.click(); };
    pintar();
  }, true);
  return m;
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
