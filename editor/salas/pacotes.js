/* Bigorna Rooms v2 — packages of the Workshop. What the user made (monsters, NPCs, items, weapons, recipes, feats,
   skills with their card pictures, heroes, tiles, objects) goes into a .bigorna file: chosen parts, or all of it at once;
   a package comes back into the Workshop of the map or campaign on screen. What an entry needs goes along with it (a
   monster's loot, a recipe's item and materials, a feat's rewards). Opened from ⚙ Settings.
   Shared packages: a package has an id and an edition, and the entries it brought into a Workshop remember them
   (entry.pacote = {id, edicao}). The library of this browser keeps every package exported or imported here, so the same
   monsters, heroes or tiles go into any map or campaign, and a newer edition updates them where they are used. The
   package carries its media (3D models, monster sounds) as data; the maps exported keep everything inside, as before. */
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
  return { formato: FORMATO_PACOTE, versao: 1, id: opcoes.id || novoIdDePacote(opcoes.nome), edicao: opcoes.edicao || 1, nome: opcoes.nome || tr('Workshop package'), autor: autorGuardado() || '', criado: new Date().toISOString().slice(0, 10), conteudo: cont };
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
    <div class="linha"><label class="campo">${tr('Package name')} <input id="pk_nome" value="${esc(campanha?.meta?.name || projeto.meta.name || '')}" placeholder="${esc(tr('My creations'))}"></label>
      <label class="campo">${tr('Save as')} <select id="pk_qual"><option value="">${tr('A new package')}</option></select></label></div>
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
    // "save as": a new package, or a new edition of one in the library (same id, the edition goes up)
    let biblioteca = [];
    bibliotecaDePacotes().then(l => { const eu = autorGuardado() || ''; biblioteca = l.filter(p => !p.autor || p.autor === eu);   // new editions only of one's own packages
      l = biblioteca; const sel = el.querySelector('#pk_qual'); if (!sel) return;
      sel.innerHTML += l.map(p => `<option value="${esc(p.id)}">${esc(tr('New edition of'))} “${esc(p.nome)}” (${p.edicao} → ${p.edicao + 1})</option>`).join('');
      const usados = usoDosPacotes(); const meu = l.find(p => usados.has(p.id)); if (meu) { sel.value = meu.id; el.querySelector('#pk_nome').value = meu.nome; } });
    el.querySelector('#pk_qual').onchange = e => { const p = biblioteca.find(x => x.id === e.target.value); if (p) el.querySelector('#pk_nome').value = p.nome; };
    const gravar = async sel => { const escolha = {}; CATEGORIAS_PACOTE.forEach(c => { escolha[c.k] = (b[c.k] || []).filter(x => sel(c, x)); });
      const nome = el.querySelector('#pk_nome').value.trim() || tr('My creations'); const base = biblioteca.find(p => p.id === el.querySelector('#pk_qual').value);
      const pk = montarPacote(escolha, { nome, dependencias: el.querySelector('#pk_dep').checked, cartas: el.querySelector('#pk_cartas').checked, ...(base ? { id: base.id, edicao: base.edicao + 1 } : {}) });
      if (!contarPacote(pk)) return aviso(tr('Nothing to export.'));
      await anexarMidia(pk);
      baixarArquivo(nomeDeArquivo(nome), JSON.stringify(pk)); fechar();
      await guardarNaBiblioteca(pk); marcarDoPacote(pk);   // the entries of the Workshop that went in now belong to this package
      aviso(tr('Package exported') + ': ' + contarPacote(pk) + ' ' + tr('entries') + (pk.edicao > 1 ? ' · ' + tr('edition') + ' ' + pk.edicao : '') + '.'); };
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
      const y = clone(x); if (pk.id) y.pacote = { id: pk.id, edicao: pk.edicao || 1 };
      if (i < 0) { l.push(y); r.novos++; } else if (substituir) { l[i] = y; r.trocados++; } else r.mantidos++; }); });
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
    if (!pk.id) pk.id = 'pacote-' + slug(pk.nome || 'package') + '-' + (pk.criado || '').replace(/-/g, '');   // a package made before ids: one id per file
    pk.edicao = pk.edicao || 1;
    await guardarNaBiblioteca(pk);
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
    el.querySelector('#pk_imp').onclick = async () => { await instalarMidia(pk); const r = juntarPacote(pk, escolha, el.querySelector('#pk_subst').checked); fechar(); tudo();
      if (!$('#telaFichas').hidden) renderFichas();
      aviso(tr('Package imported') + ': ' + r.novos + ' ' + tr('new entries') + (r.trocados ? ', ' + r.trocados + ' ' + tr('replaced') : '') + (r.mantidos ? ', ' + r.mantidos + ' ' + tr('kept as they were') : '') + '.'); };
  }, true);
}


// ------------------------------------------------------------ shared packages: ids, editions, media, the library

function novoIdDePacote(nome) { return (slug(nome || 'package') || 'package').slice(0, 32) + '-' + Math.random().toString(36).slice(2, 8); }

/* the media files the entries of a package use (3D models, monster sounds): every {arquivo} inside them */
function arquivosDoPacote(pk) {
  const r = new Set(); const anda = x => { if (Array.isArray(x)) x.forEach(anda); else if (x && typeof x === 'object') { if (typeof x.arquivo === 'string' && x.arquivo) r.add(x.arquivo); Object.values(x).forEach(anda); } };
  anda(pk.conteudo); return [...r];
}
const blobParaDados = b => new Promise((ok, erro) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => erro(f.error); f.readAsDataURL(b); });
/* the package takes its media along as data (pk.midia: {name: data URI}); a file missing in this browser stays out */
async function anexarMidia(pk) {
  const midia = {};
  for (const n of arquivosDoPacote(pk)) { let b = AUDIOS[n]; if (!b) { try { b = await Config.lerBlob('audio:' + n); } catch { } } if (b) midia[n] = await blobParaDados(b); }
  if (Object.keys(midia).length) pk.midia = midia; else delete pk.midia;
  return pk;
}
/* the media of a package comes into this browser (kept as the files uploaded by hand) */
async function instalarMidia(pk) {
  for (const [n, d] of Object.entries(pk.midia || {})) {
    if (AUDIOS[n] || typeof d !== 'string' || !d.startsWith('data:')) continue;
    try { await guardarAudio(n, await (await fetch(d)).blob()); } catch { }
  }
}

/* the library: an index [{id, nome, autor, edicao, criado, n}] and each package kept whole, in this browser */
const CHAVE_BIBLIOTECA = 'pacotes:indice';
async function bibliotecaDePacotes() { try { const l = await Config.lerBlob(CHAVE_BIBLIOTECA); return Array.isArray(l) ? l : []; } catch { return []; } }
async function lerDaBiblioteca(id) { try { return await Config.lerBlob('pacote:' + id); } catch { return null; } }
async function guardarNaBiblioteca(pk) {
  const l = await bibliotecaDePacotes(); const i = l.findIndex(p => p.id === pk.id);
  if (i >= 0 && l[i].edicao > (pk.edicao || 1)) return false;   // the library keeps the newest edition
  const ficha = { id: pk.id, nome: pk.nome || '', autor: pk.autor || '', edicao: pk.edicao || 1, criado: pk.criado || '', n: contarPacote(pk) };
  if (i >= 0) l[i] = ficha; else l.push(ficha);
  await Config.guardarBlob('pacote:' + pk.id, JSON.parse(JSON.stringify(pk))); await Config.guardarBlob(CHAVE_BIBLIOTECA, l);
  return true;
}
async function tirarDaBiblioteca(id) { const l = (await bibliotecaDePacotes()).filter(p => p.id !== id); await Config.guardarBlob('pacote:' + id, null); await Config.guardarBlob(CHAVE_BIBLIOTECA, l); }

/* the packages the Workshop on screen uses: id → the oldest edition among its entries */
function usoDosPacotes() {
  const b = oficina(); const r = new Map();
  CATEGORIAS_PACOTE.forEach(c => (b[c.k] || []).forEach(x => { const p = x.pacote; if (p && p.id) r.set(p.id, Math.min(r.get(p.id) || Infinity, p.edicao || 1)); }));
  return r;
}
/* after exporting: the entries of the Workshop that went into the package belong to it, at this edition */
function marcarDoPacote(pk) {
  const b = oficina();
  CATEGORIAS_PACOTE.forEach(c => ((pk.conteudo || {})[c.k] || []).forEach(x => { const y = (b[c.k] || []).find(e => e.id === x.id); if (y) y.pacote = { id: pk.id, edicao: pk.edicao || 1 }; }));
}
/* a newer edition updates its entries in the Workshop on screen: those that came from it are replaced, the new ones come
   in; an entry with the same id that came from elsewhere is left alone */
async function atualizarDoPacote(pk) {
  const b = oficina(); const escolha = new Set();
  CATEGORIAS_PACOTE.forEach(c => ((pk.conteudo || {})[c.k] || []).forEach(x => { const y = (b[c.k] || []).find(e => e.id === x.id); if (!y || (y.pacote && y.pacote.id === pk.id)) escolha.add(c.k + ':' + x.id); }));
  await instalarMidia(pk);
  return juntarPacote(pk, escolha, true);
}

/* ⚙ → My packages: the library of this browser, with what the Workshop on screen uses */
async function abrirBibliotecaDePacotes() {
  const l = await bibliotecaDePacotes();
  modal(tr('My packages'), `<p class="ajuda">${tr('The packages exported or imported in this browser. Add one to the map or campaign on screen, update it where a newer edition exists, or save its file to share with other authors. The maps you export keep everything inside them: players need no package.')}</p><div id="pk_bib" class="listaPacote"></div>`, (el, fechar) => {
    const pinta = async () => {
      const lista = await bibliotecaDePacotes(); const uso = usoDosPacotes();
      el.querySelector('#pk_bib').innerHTML = lista.length ? lista.map(p => { const u = uso.get(p.id);
        const estado = u == null ? tr('not used here') : u < p.edicao ? tr('used here at edition') + ' ' + u + ' · ' + tr('a newer one is available') : tr('used here');
        return `<div class="catPacote fichaPacote" data-id="${esc(p.id)}"><div><b data-sem-traducao>${esc(p.nome)}</b> <small>${tr('edition')} ${p.edicao} · ${p.n} ${tr('entries')}${p.autor ? ' · <span data-sem-traducao>' + esc(p.autor) + '</span>' : ''}</small><br><small class="${u != null && u < p.edicao ? 'aviso' : 'ajuda'}">${estado}</small></div>
          <div class="linha">${u != null && u < p.edicao ? `<button class="sm primario" data-acao="atualizar">${tr('Update here')}</button>` : `<button class="sm" data-acao="usar">${tr('Add to this work…')}</button>`}<button class="sm" data-acao="arquivo">${tr('Save the file')}</button><button class="sm" data-acao="tirar" title="${esc(tr('Remove from this browser'))}">✕</button></div></div>`; }).join('')
        : `<p class="ajuda">${tr('No package yet: export one (⚙ → Export a package) or import a .bigorna file.')}</p>`;
      el.querySelectorAll('[data-acao]').forEach(bt => bt.onclick = async () => {
        const id = bt.closest('[data-id]').dataset.id; const pk = await lerDaBiblioteca(id); if (!pk) return aviso(tr('This package is no longer in this browser.'));
        const acao = bt.dataset.acao;
        if (acao === 'usar') { fechar(); abrirImportacaoDePacote(pk); }
        else if (acao === 'atualizar') { const r = await atualizarDoPacote(pk); tudo(); if (!$('#telaFichas').hidden) renderFichas(); aviso(tr('Package updated') + ': ' + r.trocados + ' ' + tr('replaced') + (r.novos ? ', ' + r.novos + ' ' + tr('new entries') : '') + '.'); pinta(); }
        else if (acao === 'arquivo') baixarArquivo(nomeDeArquivo(pk.nome), JSON.stringify(pk));
        else if (acao === 'tirar') { await tirarDaBiblioteca(id); pinta(); }
      });
    };
    pinta();
  }, true);
}

/* on opening a work: a word when the library holds a newer edition of a package it uses */
async function avisarPacotesNovos() {
  const uso = usoDosPacotes(); if (!uso.size) return;
  const novos = (await bibliotecaDePacotes()).filter(p => uso.has(p.id) && uso.get(p.id) < p.edicao);
  if (novos.length) avisoLongo(tr('A newer edition of a package used here is in your library') + ': ' + novos.map(p => '“' + p.nome + '”').join(', ') + '. ' + tr('⚙ → My packages updates it.'));
}
