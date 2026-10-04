/* Bigorna Rooms v2 — packages of the Workshop. What the user made (monsters, NPCs, items, weapons, recipes, feats,
   skills with their card pictures, heroes, tiles, objects) goes into a .bigorna file: chosen parts, or all of it at once;
   a package comes back into the Workshop of the map or campaign on screen. What an entry needs goes along with it (a
   monster's loot, a recipe's item and materials, a feat's rewards). Opened from ⚙ Settings. */
'use strict';

const FORMATO_PACOTE = 'bigorna-pacote';
/* the kinds of a package: the list of the Workshop, its name, and which entries count as made by the user (new, changed,
   or holding something of their own) */
const CATEGORIAS_PACOTE = [
  { k: 'monstros', nome: 'Monsters', proprio: x => x.custom || !x.base, rotulo: x => x.nome },
  { k: 'personagens', nome: 'NPCs', proprio: x => x.custom || !x.base, rotulo: x => x.nome },
  { k: 'itens', nome: 'Items', proprio: x => x.custom || !x.base, rotulo: x => x.nome },
  { k: 'armas', nome: 'Weapons', proprio: x => armaMudou(x), rotulo: x => x.nome || (armaPorId(x.id)?.name_en) || x.id },
  { k: 'receitas', nome: 'Recipes', proprio: x => x.custom || !x.base || x.inicio, rotulo: x => nomeReceita(x) },
  { k: 'facanhas', nome: 'Feats', proprio: x => x.custom || !x.base, rotulo: x => nomeFacanha(x) },
  { k: 'pericias', nome: 'Skills', proprio: x => x.custom || !x.base || (x.cartas || []).length, rotulo: x => nomePericia(x) },
  { k: 'herois', nome: 'Heroes', proprio: x => heroiMudou(x), rotulo: x => nomeDoHeroi(x.id) },
  { k: 'pecas', nome: 'Tiles', proprio: () => true, rotulo: x => x.nome || x.id },
  { k: 'objetos', nome: 'Objects', proprio: () => true, rotulo: x => x.nome || x.id }
];
const idDaEntrada = x => x.id;

/* what the chosen entries need from the rest of the Workshop: items (loot, recipes, rewards), recipes and skills (feat
   rewards). Returns {k: Set(ids)} of entries to add */
function dependenciasDoPacote(escolha) {
  const b = oficina(); const precisa = { itens: new Set(), receitas: new Set(), pericias: new Set() };
  const temItem = id => typeof id === 'string' && b.itens.some(i => i.id === id);
  (escolha.monstros || []).forEach(m => (m.loot || []).forEach(id => { if (temItem(id)) precisa.itens.add(id); }));
  const daReceita = r => { if (temItem(r.item)) precisa.itens.add(r.item); (r.custos || []).forEach(c => { if (temItem(c.mat)) precisa.itens.add(c.mat); }); };
  (escolha.receitas || []).forEach(daReceita);
  (escolha.facanhas || []).forEach(f => (f.premios || []).forEach(id => {
    if (typeof id !== 'string') return;
    if (id.startsWith('RECEITA:')) { const r = b.receitas.find(x => x.id === id.slice(8)); if (r) { precisa.receitas.add(r.id); daReceita(r); } return; }
    const p = (b.pericias || []).find(x => x.base === id || idPericiaExportada(x) === id); if (p) precisa.pericias.add(p.id); }));
  return precisa;
}

/* the package itself: the chosen entries (and what they need, when asked), the heroes' weapons, the feat pool and the
   objects' default scripts that go with them */
function montarPacote(escolha, opcoes = {}) {
  const b = oficina(); const cont = {};
  CATEGORIAS_PACOTE.forEach(c => { cont[c.k] = (escolha[c.k] || []).map(clone); });
  if (opcoes.dependencias !== false) {
    const dep = dependenciasDoPacote(escolha);
    Object.entries(dep).forEach(([k, ids]) => ids.forEach(id => { if (!cont[k].some(x => x.id === id)) { const x = (b[k] || []).find(y => y.id === id); if (x) cont[k].push(clone(x)); } }));
  }
  if (opcoes.cartas === false) cont.pericias.forEach(p => { p.cartas = []; });
  if (cont.herois.length || cont.armas.length) cont.maos = clone(b.maos || []);
  if (cont.facanhas.length) cont.poolFacanhas = (b.poolFacanhas || []).filter(id => cont.facanhas.some(f => f.id === id));
  if (cont.objetos.length && b.padroes) cont.padroes = clone(b.padroes);
  Object.keys(cont).forEach(k => { if (Array.isArray(cont[k]) && !cont[k].length) delete cont[k]; });
  return { formato: FORMATO_PACOTE, versao: 1, nome: opcoes.nome || tr('Workshop package'), autor: autorGuardado() || '', criado: new Date().toISOString().slice(0, 10), conteudo: cont };
}
const contarPacote = pk => Object.entries(pk.conteudo || {}).reduce((n, [k, v]) => n + (Array.isArray(v) && CATEGORIAS_PACOTE.some(c => c.k === k) ? v.length : 0), 0);
function baixarArquivo(nome, texto, tipo = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: tipo })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const nomeDeArquivo = n => (slug(n || 'package') || 'package') + '.bigorna';

/* ⚙ → Export a package: the kinds, each entry ticked (all that the user made), "everything I made" at once */
function exportarPacote() {
  const b = oficina(); let soMeus = true;
  const lista = c => (b[c.k] || []).filter(x => !soMeus || c.proprio(x));
  const marcadas = new Map(CATEGORIAS_PACOTE.map(c => [c.k, new Set(lista(c).map(idDaEntrada))]));
  modal(tr('Export a Workshop package'), `<p class="ajuda">${tr('Pick what goes into the package: a .bigorna file that another map, another campaign or another player can import (⚙ → Import a package). What an entry needs goes along: a monster’s loot, a recipe’s item and materials, a feat’s rewards.')}</p>
    <div class="linha"><label class="campo">${tr('Package name')} <input id="pk_nome" value="${esc(campanha?.meta?.name || projeto.meta.name || '')}" placeholder="${esc(tr('My creations'))}"></label></div>
    <label class="chk"><input type="checkbox" id="pk_meus" checked> ${tr('Only what I made or changed')}</label>
    <label class="chk"><input type="checkbox" id="pk_dep" checked> ${tr('Take along what the entries need')}</label>
    <label class="chk"><input type="checkbox" id="pk_cartas" checked> ${tr('With the card pictures of the skills')}</label>
    <div id="pk_lista" class="listaPacote"></div>
    <div class="linha"><span class="ajuda" id="pk_conta"></span><span class="espaco"></span><button id="pk_tudo">${tr('Export everything I made')}</button><button class="primario" id="pk_ok">${tr('Export the ticked ones')}</button></div>`, (el, fechar) => {
    const pinta = () => {
      el.querySelector('#pk_lista').innerHTML = CATEGORIAS_PACOTE.map(c => { const l = lista(c); if (!l.length) return ''; const m = marcadas.get(c.k);
        return `<details class="catPacote"><summary><label class="chk"><input type="checkbox" data-cat="${c.k}" ${m.size === l.length ? 'checked' : ''}> <b>${esc(tr(c.nome))}</b> <small>${m.size} / ${l.length}</small></label></summary>
          ${l.map(x => `<label class="chk sub"><input type="checkbox" data-cat="${c.k}" data-id="${esc(x.id)}" ${m.has(x.id) ? 'checked' : ''}> <span data-sem-traducao>${esc(c.rotulo(x) || x.id)}</span></label>`).join('')}</details>`; }).join('') || `<p class="ajuda">${tr('The Workshop has nothing of yours yet.')}</p>`;
      const n = [...marcadas.values()].reduce((s, m) => s + m.size, 0); el.querySelector('#pk_conta').textContent = n + ' ' + tr('entries ticked'); el.querySelector('#pk_ok').disabled = !n;
      el.querySelectorAll('[data-cat]').forEach(ch => ch.onchange = () => { const m = marcadas.get(ch.dataset.cat); const c = CATEGORIAS_PACOTE.find(x => x.k === ch.dataset.cat);
        if (ch.dataset.id) { if (ch.checked) m.add(ch.dataset.id); else m.delete(ch.dataset.id); } else { m.clear(); if (ch.checked) lista(c).forEach(x => m.add(x.id)); } pinta(); });
    };
    el.querySelector('#pk_meus').onchange = e => { soMeus = e.target.checked; CATEGORIAS_PACOTE.forEach(c => { const ids = new Set(lista(c).map(idDaEntrada)); const m = marcadas.get(c.k); [...m].forEach(id => { if (!ids.has(id)) m.delete(id); }); if (!soMeus) ids.forEach(id => m.add(id)); }); pinta(); };
    const gravar = sel => { const escolha = {}; CATEGORIAS_PACOTE.forEach(c => { escolha[c.k] = (b[c.k] || []).filter(x => sel(c, x)); });
      const nome = el.querySelector('#pk_nome').value.trim() || tr('My creations'); const pk = montarPacote(escolha, { nome, dependencias: el.querySelector('#pk_dep').checked, cartas: el.querySelector('#pk_cartas').checked });
      if (!contarPacote(pk)) return aviso(tr('Nothing to export.'));
      baixarArquivo(nomeDeArquivo(nome), JSON.stringify(pk)); fechar(); aviso(tr('Package exported') + ': ' + contarPacote(pk) + ' ' + tr('entries') + '.'); };
    el.querySelector('#pk_ok').onclick = () => gravar((c, x) => marcadas.get(c.k).has(x.id));
    el.querySelector('#pk_tudo').onclick = () => gravar((c, x) => c.proprio(x));
    pinta();
  }, true);
}

/* merges a package into the Workshop on screen: new entries come in; one with an id already here is replaced or kept,
   as asked. Returns {novos, trocados, mantidos} */
function juntarPacote(pk, escolha, substituir) {
  const b = oficina(); const r = { novos: 0, trocados: 0, mantidos: 0 };
  CATEGORIAS_PACOTE.forEach(c => { const l = b[c.k] = b[c.k] || [];
    ((pk.conteudo || {})[c.k] || []).filter(x => !escolha || escolha.has(c.k + ':' + x.id)).forEach(x => { const i = l.findIndex(y => y.id === x.id);
      if (i < 0) { l.push(clone(x)); r.novos++; } else if (substituir) { l[i] = clone(x); r.trocados++; } else r.mantidos++; }); });
  const ct = pk.conteudo || {};
  if (Array.isArray(ct.maos)) ct.maos.forEach(m => { const i = (b.maos = b.maos || []).findIndex(y => y.id === m.id); if (i < 0) b.maos.push(clone(m)); else if (substituir) b.maos[i] = clone(m); });
  if (Array.isArray(ct.poolFacanhas)) ct.poolFacanhas.forEach(id => { b.poolFacanhas = b.poolFacanhas || []; if (!b.poolFacanhas.includes(id)) b.poolFacanhas.push(id); });
  if (ct.padroes && typeof ct.padroes === 'object') Object.entries(ct.padroes).forEach(([k, v]) => { if (!(k in b.padroes) || substituir) b.padroes[k] = clone(v); });
  return r;
}
/* ⚙ → Import a package: reads the file, shows what it holds, brings in the ticked entries */
function importarPacote() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.bigorna,.json,application/json';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; let pk;
    try { pk = JSON.parse(await f.text()); } catch { return aviso(tr('This file is not a Workshop package.')); }
    if (!pk || pk.formato !== FORMATO_PACOTE || !pk.conteudo) return aviso(tr('This file is not a Workshop package.'));
    abrirImportacaoDePacote(pk); };
  inp.click();
}
function abrirImportacaoDePacote(pk) {
  const b = oficina(); const escolha = new Set(); const ct = pk.conteudo || {};
  CATEGORIAS_PACOTE.forEach(c => (ct[c.k] || []).forEach(x => escolha.add(c.k + ':' + x.id)));
  const jaTem = (c, x) => (b[c.k] || []).some(y => y.id === x.id);
  modal(tr('Import a Workshop package'), `<p class="ajuda"><b data-sem-traducao>${esc(pk.nome || '')}</b>${pk.autor ? ' · <span data-sem-traducao>' + esc(pk.autor) + '</span>' : ''}${pk.criado ? ' · ' + esc(pk.criado) : ''}</p>
    <div class="listaPacote">${CATEGORIAS_PACOTE.map(c => { const l = ct[c.k] || []; if (!l.length) return '';
      return `<details class="catPacote" open><summary><b>${esc(tr(c.nome))}</b> <small>${l.length}</small></summary>${l.map(x => `<label class="chk sub"><input type="checkbox" data-k="${esc(c.k + ':' + x.id)}" checked> <span data-sem-traducao>${esc(c.rotulo(x) || x.id)}</span>${jaTem(c, x) ? ` <small class="aviso">${tr('already here')}</small>` : ''}</label>`).join('')}</details>`; }).join('')}</div>
    <label class="chk"><input type="checkbox" id="pk_subst"> ${tr('Replace the entries already here (same id)')}</label>
    <div class="linha"><span class="espaco"></span><button class="primario" id="pk_imp">${tr('Import into the Workshop')}</button></div>`, (el, fechar) => {
    el.querySelectorAll('[data-k]').forEach(ch => ch.onchange = () => { if (ch.checked) escolha.add(ch.dataset.k); else escolha.delete(ch.dataset.k); });
    el.querySelector('#pk_imp').onclick = () => { const r = juntarPacote(pk, escolha, el.querySelector('#pk_subst').checked); fechar(); tudo();
      if (!$('#telaFichas').hidden) renderFichas();
      aviso(tr('Package imported') + ': ' + r.novos + ' ' + tr('new entries') + (r.trocados ? ', ' + r.trocados + ' ' + tr('replaced') : '') + (r.mantidos ? ', ' + r.mantidos + ' ' + tr('kept as they were') : '') + '.'); };
  }, true);
}
