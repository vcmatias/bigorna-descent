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
  (escolha.itens || []).forEach(i => (i.disparos || []).forEach(d => (d.efeitos || []).forEach(f => { if (f.tipo === 'loot' && temItem(f.item)) precisa.itens.add(f.item); })));   // (the item a trinket gives)
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
  CATEGORIAS_PACOTE.forEach(c => { cont[c.k] = (escolha[c.k] || []).map(x => { const y = clone(x); if (c.k === 'herois' && x && x.perfil) y.perfil = x.perfil; return y; }); });
  if (opcoes.dependencias !== false) {
    const dep = dependenciasDoPacote(escolha);
    Object.entries(dep).forEach(([k, ids]) => ids.forEach(id => { if (!cont[k].some(x => x.id === id)) { const x = (b[k] || []).find(y => y.id === id); if (x) cont[k].push(clone(x)); } }));
  }
  // (v245: the recipes of the items go with them: a recipe is part of the item it crafts)
  (cont.itens || []).forEach(i => receitasDoAlvo(i).forEach(r => { if (!cont.receitas.some(y => y.id === r.id)) cont.receitas.push(clone(r)); }));
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
function exportarPacote(opcoesDaTela = {}) {   // (v243: depois(pk): what comes after, the publishing of a work that needs the package)
  const b = oficina(); let soMeus = true;
  const lista = c => (b[c.k] || []).filter(x => (!soMeus || c.proprio(x)) && !(c.k === 'receitas' && receitaDeItemDaOficina(x)));   // (v245: recipes go with their items)
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
      baixarArquivo(nomeDeArquivo(nome), await textoAvulso(pk)); fechar();
      await guardarNaBiblioteca(pk); marcarDoPacote(pk);   // the entries of the Workshop that went in now belong to this package
      aviso(tr('Package exported') + ': ' + contarPacote(pk) + ' ' + tr('entries') + (pk.edicao > 1 ? ' · ' + tr('edition') + ' ' + pk.edicao : '') + '.');
      if (typeof opcoesDaTela.depois === 'function') opcoesDaTela.depois(pk); };
    el.querySelector('#pk_ok').onclick = () => gravar((c, x) => marcadas.get(c.k).has(x.id));
    el.querySelector('#pk_tudo').onclick = () => gravar((c, x) => c.proprio(x));
    pinta();
  }, true);
}

/* the entries of a package one's Workshop already has: the same id, or the same name in the same tab (a game monster each
   one imported, say). [{c, x (the package's), y (one's own), porId}] */
const normalNome = t => String(t || '').trim().toLowerCase();
function iguaisDoPacote(pk, escolha) {
  const b = oficina(); const r = [];
  CATEGORIAS_PACOTE.forEach(c => { const meus = (b[c.k] || []).filter(y => y && !doPacote(y));
    ((pk.conteudo || {})[c.k] || []).filter(x => x && (!escolha || escolha.has(c.k + ':' + x.id))).forEach(x => {
      let y = meus.find(z => z.id === x.id), porId = !!y;
      if (!y && c.k !== 'armas' && normalNome(c.rotulo(x))) y = meus.find(z => normalNome(c.rotulo(z)) === normalNome(c.rotulo(x)));
      if (y) r.push({ c, x, y, porId }); }); });
  return r;
}
/* the list of them, to choose which the package replaces (all ticked); aoDecidir(Set of the package's keys "k:id") */
function perguntarSubstituir(pk, iguais, aoDecidir) {
  modal(tr('Already in your Workshop'), `<p class="ajuda">${esc(tr('The package') + ' “' + (pk.nome || pk.id) + '” ' + tr('has entries your Workshop already has. Tick those the package replaces; the others stay as yours.'))}</p>
    <div class="listaPacote">${CATEGORIAS_PACOTE.map(c => { const l = iguais.filter(g => g.c === c); if (!l.length) return '';
      return `<details class="catPacote" open><summary><b>${esc(tr(c.nome))}</b> <small>${l.length}</small></summary>${l.map(g => `<label class="chk sub"><input type="checkbox" data-sub="${esc(c.k + ':' + g.x.id)}" checked> <span data-sem-traducao>${esc(c.rotulo(g.x) || g.x.id)}</span> <small>${esc(g.porId ? tr('the same entry') : tr('the same name'))}${(c.rotulo(g.y) || '') !== (c.rotulo(g.x) || '') ? ' · ' + esc(tr('yours')) + ': <span data-sem-traducao>' + esc(c.rotulo(g.y) || g.y.id) + '</span>' : ''}</small></label>`).join('')}</details>`; }).join('')}</div>
    <div class="linha"><button class="sm" id="ps_nada">${esc(tr('Untick all'))}</button><span class="espaco"></span><button id="ps_manter">${esc(tr('Keep mine'))}</button><button class="primario" id="ps_ok">${esc(tr('Replace the ticked'))}</button></div>`, (el, fechar) => {
    el.querySelector('#ps_nada').onclick = () => el.querySelectorAll('[data-sub]').forEach(ch => { ch.checked = false; });
    el.querySelector('#ps_manter').onclick = () => { fechar(); aoDecidir(new Set()); };
    el.querySelector('#ps_ok').onclick = () => { const s = new Set([...el.querySelectorAll('[data-sub]:checked')].map(ch => ch.dataset.sub)); fechar(); aoDecidir(s); };
  }, true);
}
/* an id becomes another everywhere it is used: the Workshop and the work on screen (an entry of one's own replaced by one of
   the package with the same name) */
function trocarIdEmTudo(velho, novo) {
  const anda = (o, vistos) => { if (!o || typeof o !== 'object' || vistos.has(o)) return; vistos.add(o);
    for (const k of Object.keys(o)) { const v = o[k]; if (v === velho) o[k] = novo; else if (v && typeof v === 'object') anda(v, vistos); } };
  const vistos = new Set(); anda(oficina(), vistos); anda(campanha || projeto, vistos);
  const pp = padroesDaOficina(); if (pp[velho] && !pp[novo]) { pp[novo] = pp[velho]; } delete pp[velho];
}
/* what was decided for each entry the Workshop had: replaced ones leave the Workshop (by name: their uses point to the new
   one; by id, in the app, the package's comes in its place); kept ones keep the package's out. Returns the choice of the
   package's entries to bring in */
function aplicarSubstituicoes(iguais, trocar, escolha, tirarPorId) {
  const b = oficina(); const fora = new Set();
  iguais.forEach(g => { const kx = g.c.k + ':' + g.x.id;
    if (trocar.has(kx)) { if (!g.porId || tirarPorId) b[g.c.k] = (b[g.c.k] || []).filter(z => z !== g.y); if (!g.porId) trocarIdEmTudo(g.y.id, g.x.id); }
    else fora.add(kx); });
  return { fora, escolha: escolha ? new Set([...escolha].filter(k => !fora.has(k))) : null };
}
/* the party a package brings (the profile each of its heroes played where it was made), into the work on screen: only in
   profiles still free, by heroes not playing another one here */
function equipeDoPacote(pk) {
  const eq = equipeAtual(); ((pk.conteudo || {}).herois || []).forEach(h => { if (h && h.novo && h.perfil && HEROIS_IDS.includes(h.perfil) && !eq[h.perfil] && !Object.values(eq).includes(h.id) && heroisNovos().some(x => x.id === h.id)) eq[h.perfil] = h.id; });
}
/* the app: a package goes into the Pacotes folder, after asking about the entries one's Workshop already has (null: the
   window was closed) */
function instalarPerguntando(pk, arquivos) {
  const iguais = pk.id === MEU_PACOTE.id ? [] : iguaisDoPacote(pk);
  if (!iguais.length) return instalarNaPasta(pk, arquivos);
  return new Promise((ok, erro) => perguntarSubstituir(pk, iguais, trocar => { aplicarSubstituicoes(iguais, trocar, null, true); instalarNaPasta(pk, arquivos).then(ok, erro); }));
}
/* merges a package into the Workshop on screen: new entries come in; one with an id already here is replaced or kept,
   as asked (substituir: true, false, or the Set of the package's keys "k:id" to replace). Returns {novos, trocados, mantidos} */
function juntarPacote(pk, escolha, substituir) {
  const troca = x => substituir instanceof Set ? substituir.has(x) : !!substituir;
  const b = oficina(); const r = { novos: 0, trocados: 0, mantidos: 0 };
  CATEGORIAS_PACOTE.forEach(c => { const l = b[c.k] = b[c.k] || [];
    ((pk.conteudo || {})[c.k] || []).filter(x => !escolha || escolha.has(c.k + ':' + x.id)).forEach(x => { const i = l.findIndex(y => y.id === x.id);
      const y = clone(x); if (pk.id) y.pacote = { id: pk.id, edicao: pk.edicao || 1 };
      if (i < 0) { l.push(y); r.novos++; } else if (troca(c.k + ':' + x.id)) { l[i] = y; r.trocados++; } else r.mantidos++; }); });
  const ct = pk.conteudo || {};
  const tudoTroca = substituir instanceof Set ? substituir.size > 0 : !!substituir;
  if (Array.isArray(ct.maos)) ct.maos.forEach(m => { const i = (b.maos = b.maos || []).findIndex(y => y.id === m.id); if (i < 0) b.maos.push(clone(m)); else if (tudoTroca) b.maos[i] = clone(m); });
  if (Array.isArray(ct.poolFacanhas)) ct.poolFacanhas.forEach(id => { b.poolFacanhas = b.poolFacanhas || []; if (!b.poolFacanhas.includes(id)) b.poolFacanhas.push(id); });
  if (ct.padroes && typeof ct.padroes === 'object') Object.entries(ct.padroes).forEach(([k, v]) => { if (!(k in b.padroes) || (substituir instanceof Set ? substituir.has('objetos:' + k) : substituir)) b.padroes[k] = clone(v); });
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
    await extrairImagens(pk.conteudo); await recolherImagens(pk.conteudo);   // (v240: its pictures into the store)
    // (the app: the package goes into the Pacotes folder and its entries into the Workshop, all of them, read only)
    if (Arquivos.ativo) {
      try { const r = await instalarPerguntando(pk); if (!r) return; equipeDoPacote(pk); tudo(); if (!$('#telaFichas').hidden) renderFichas();
        aviso(r.meu ? tr('Your own Workshop came back') + ': ' + r.n + ' ' + tr('new entries') + '.' : tr('Package in the Workshop') + ': “' + (pk.nome || pk.id) + '”, ' + r.n + ' ' + tr('entries') + (r.iguais ? ' (' + r.iguais + ' ' + tr('already in your Workshop: yours count') + ')' : '') + '.'); }
      catch (e) { avisoLongo(tr('The package could not be written in the Pacotes folder') + ': ' + (e.message || e)); }
      return;
    }
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
    <div class="linha"><span class="espaco"></span><button class="primario" id="pk_imp">${tr('Import into the Workshop')}</button></div>`, (el, fechar) => {
    el.querySelectorAll('[data-k]').forEach(ch => ch.onchange = () => { if (ch.checked) escolha.add(ch.dataset.k); else escolha.delete(ch.dataset.k); });
    const importar = async trocar => { await instalarMidia(pk); const a = aplicarSubstituicoes(iguais, trocar, escolha); const r = juntarPacote(pk, a.escolha, trocar); tudo();
      if (!$('#telaFichas').hidden) renderFichas();
      const novos = r.novos - iguais.filter(g => !g.porId && trocar.has(g.c.k + ':' + g.x.id)).length;
      aviso(tr('Package imported') + ': ' + novos + ' ' + tr('new entries') + (trocar.size ? ', ' + trocar.size + ' ' + tr('replaced') : '') + (a.fora.size ? ', ' + a.fora.size + ' ' + tr('kept as they were') : '') + '.'); };
    let iguais = [];
    el.querySelector('#pk_imp').onclick = () => { iguais = iguaisDoPacote(pk, escolha); fechar(); if (!iguais.length) return importar(new Set()); perguntarSubstituir(pk, iguais, importar); };
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
async function bibliotecaDePacotes() { if (Arquivos.ativo) return [fichaDoMeuPacote(), ...PACOTES_DA_PASTA]; try { const l = await Config.lerBlob(CHAVE_BIBLIOTECA); return Array.isArray(l) ? l : []; } catch { return []; } }
async function lerDaBiblioteca(id) {
  if (Arquivos.ativo) {   // (the app: one's Workshop as a package, or the file of a package of the folder)
    if (id === MEU_PACOTE.id) return meuPacote();
    const p = PACOTES_DA_PASTA.find(x => x.id === id); if (!p) return null;
    try { return JSON.parse(await Arquivos.ler('Pacotes/' + p.pasta + '/pacote.bigorna')); } catch { return null; }
  }
  try { const pk = await Config.lerBlob('pacote:' + id); if (pk && pk.conteudo) await extrairImagens(pk.conteudo); return pk; } catch { return null; } }
async function guardarNaBiblioteca(pk) {
  // (the app: the folder is the library; a new edition of one's Workshop is its edition from now on)
  if (Arquivos.ativo) { if (pk.id === MEU_PACOTE.id && (pk.edicao || 1) > MEU_PACOTE.edicao) { MEU_PACOTE.edicao = pk.edicao; guardarOficina(); } return true; }
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
  if (Arquivos.ativo) return abrirPacotesDaPasta();
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
        else if (acao === 'arquivo') baixarArquivo(nomeDeArquivo(pk.nome), await textoAvulso(pk));
        else if (acao === 'tirar') { await tirarDaBiblioteca(id); pinta(); }
      });
    };
    pinta();
  }, true);
}

/* on opening a work: a word when the library holds a newer edition of a package it uses */
async function avisarPacotesNovos() {
  if (Arquivos.ativo) return;   // (the app: the packages of the folder are the ones in use, whatever their edition)
  const uso = usoDosPacotes(); if (!uso.size) return;
  const novos = (await bibliotecaDePacotes()).filter(p => uso.has(p.id) && uso.get(p.id) < p.edicao);
  if (novos.length) avisoLongo(tr('A newer edition of a package used here is in your library') + ': ' + novos.map(p => '“' + p.nome + '”').join(', ') + '. ' + tr('⚙ → My packages updates it.'));
}

// ------------------------------------------------------------ the app: the Pacotes folder is the Workshop
/* one's Workshop as a package (to share it, publish it, or make a new edition of it) */
function meuPacote() {
  const pk = { formato: FORMATO_PACOTE, versao: 1, id: MEU_PACOTE.id, edicao: MEU_PACOTE.edicao, nome: MEU_PACOTE.nome, autor: autorGuardado() || '', criado: MEU_PACOTE.criado, conteudo: clone(oficinaPropria()) };
  Object.keys(pk.conteudo).forEach(k => { if (Array.isArray(pk.conteudo[k]) && !pk.conteudo[k].length) delete pk.conteudo[k]; });
  return pk;
}
const fichaDoMeuPacote = () => ({ id: MEU_PACOTE.id, nome: MEU_PACOTE.nome, autor: autorGuardado() || '', edicao: MEU_PACOTE.edicao, criado: MEU_PACOTE.criado, n: contarPacote({ conteudo: oficinaPropria() }), meu: true });
const pastaDoPacote = id => String(id || 'pacote').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
/* the entries of a package leave the Workshop (it was removed, or a new edition comes) */
function tirarDoPacote(id) { const b = oficina(); Object.keys(b).forEach(k => { if (Array.isArray(b[k])) b[k] = b[k].filter(x => !(doPacote(x) && x._doPacote === id)); }); }
/* a package into the Pacotes folder: its file (and, from the community library, the files the mod reads: pacote.json, the
   media); its entries into the Workshop (an id one's own Workshop has stays one's). One's own Workshop (the same id) joins
   it instead. Returns {n, iguais, meu} */
async function instalarNaPasta(pk, arquivos) {
  if (pk.id === MEU_PACOTE.id) { const n = absorverOficina(clone(pk.conteudo || {})); guardarOficina(); return { n, meu: true }; }
  const pasta = 'Pacotes/' + pastaDoPacote(pk.id); const doc = { ...pk }; delete doc.oficina; delete doc._pasta; delete doc._quando;
  for (const a of arquivos || []) if (a.nome !== 'pacote.bigorna' && /^[^/\\]+$/.test(a.nome)) await Arquivos.gravar(pasta + '/' + a.nome, a.dados);
  // (v240: its pictures into the store, and a copy in the package's "imagens" folder: the package file keeps the references)
  await extrairImagens(doc.conteudo); await recolherImagens(doc.conteudo);
  const txt = JSON.stringify(doc); try { await Deposito.copiarPara(pasta + '/imagens', [...imagensDoTexto(txt)]); } catch (e) { console.warn('package pictures', e); }
  await Arquivos.gravar(pasta + '/pacote.bigorna', txt);
  tirarDoPacote(pk.id); const n = adicionarPacote(doc);
  try { await garantirPacotesDoMod([{ ...doc, _pasta: pastaDoPacote(pk.id) }]); } catch (e) { console.warn('pacote.json', e); }   // (v241)
  const total = contarPacote(doc);
  PACOTES_DA_PASTA = PACOTES_DA_PASTA.filter(p => p.id !== pk.id).concat([{ id: pk.id, nome: doc.nome || pk.id, autor: doc.autor || '', edicao: doc.edicao || 1, criado: doc.criado || '', n: total, pasta: pastaDoPacote(pk.id) }]);
  return { n, iguais: Math.max(0, total - n) };
}
/* ⚙ → My packages, in the app: one's Workshop and the packages of the folder */
function abrirPacotesDaPasta() {
  modal(tr('My packages'), `<p class="ajuda">${tr('The Workshop is kept in the Pacotes folder of the game: your own (it changes as you work) and the packages imported or brought from the community library (their entries are in the Workshop and change in a copy). Every package in that folder comes in when the editor opens.')}</p><div id="pk_bib" class="listaPacote"></div>`, (el, fechar) => {
    const pinta = () => {
      const l = [fichaDoMeuPacote(), ...PACOTES_DA_PASTA];
      el.querySelector('#pk_bib').innerHTML = l.map(p => `<div class="catPacote fichaPacote" data-id="${esc(p.id)}"><div><b data-sem-traducao>${esc(p.nome)}</b> <small>${p.meu ? tr('your Workshop') + ' · ' : ''}${tr('edition')} ${p.edicao} · ${p.n} ${tr('entries')}${p.autor ? ' · <span data-sem-traducao>' + esc(p.autor) + '</span>' : ''}</small></div>
        <div class="linha"><button class="sm" data-acao="arquivo">${tr('Save the file')}</button>${p.meu ? '' : `<button class="sm" data-acao="tirar" title="${esc(tr('Remove from the Workshop (and from the Pacotes folder)'))}">✕</button>`}</div></div>`).join('');
      el.querySelectorAll('[data-acao]').forEach(bt => bt.onclick = async () => {
        const id = bt.closest('[data-id]').dataset.id;
        if (bt.dataset.acao === 'arquivo') { const pk = await lerDaBiblioteca(id); if (!pk) return aviso(tr('This package is no longer in the folder.')); if (id === MEU_PACOTE.id) await anexarMidia(pk); baixarArquivo(nomeDeArquivo(pk.nome), await textoAvulso(pk)); return; }
        const p = PACOTES_DA_PASTA.find(x => x.id === id); if (!p || !confirm(tr('Remove this package from the Workshop and from the Pacotes folder? Maps that use its entries keep them inside.'))) return;
        try { await Arquivos.apagar('Pacotes/' + p.pasta); } catch (e) { return aviso(e.message || String(e)); }
        tirarDoPacote(id); PACOTES_DA_PASTA = PACOTES_DA_PASTA.filter(x => x.id !== id); tudo(); if (!$('#telaFichas').hidden) renderFichas(); pinta();
      });
    };
    pinta();
  }, true);
}

/* an entry of another package, on its sheet: it is read, not changed; "Change a copy" makes it one's own (the same id: the
   maps that use it get the copy) */
function entradaAberta() {
  const b = oficina();
  if (abaF === 'herois') return (b.herois || []).find(x => x.id === heroiSel);
  if (abaF === 'armas') return (b.armas || []).find(x => x.id === armaSel);
  const l = b[abaF]; return Array.isArray(l) ? l.find(x => x && x.id === fichaSel) : null;
}
function travarDoPacote() {
  const x = entradaAberta(), c = $('#centroF'); if (!x || !doPacote(x) || !c || c.querySelector('.avisoPacote')) return;
  const p = PACOTES_DA_PASTA.find(q => q.id === x._doPacote); const nome = p ? p.nome : x._doPacote;
  c.querySelectorAll('input, select, textarea').forEach(e => { e.disabled = true; e.dataset.travado = '1'; });
  c.querySelectorAll('[contenteditable="true"]').forEach(e => { e.setAttribute('contenteditable', 'false'); e.dataset.travado = '1'; });
  c.querySelectorAll('button, .botaoArquivo').forEach(e => { if (!e.closest('.avisoPacote')) e.style.display = 'none'; });
  const av = document.createElement('div'); av.className = 'avisoPacote';
  av.innerHTML = `<p class="ajuda aviso">${esc(tr('From the package'))} “<span data-sem-traducao>${esc(nome)}</span>”: ${esc(tr('it is read here and comes as the package is. To change it, change a copy: it goes into your Workshop, with the same id (what uses it gets your copy).'))} <button class="sm primario" id="f_copiaPacote">${esc(tr('✎ Change a copy'))}</button></p>`;
  c.prepend(av);
  av.querySelector('#f_copiaPacote').onclick = () => {
    const k = Object.keys(oficina()).find(k => Array.isArray(oficina()[k]) && oficina()[k].includes(x)); if (!k) return;
    const y = clone(x); delete y._doPacote; delete y.pacote; const l = oficina()[k]; l[l.indexOf(x)] = y;
    renderFichas(); aviso(tr('Now it is yours: the changes go into your Workshop.'));
  };
}
/* (each time a sheet is drawn, whatever the tab: the entry of a package is read only) */
(() => { const c = document.getElementById('centroF'); if (!c || typeof MutationObserver === 'undefined') return; let pend = false;
  new MutationObserver(() => { if (pend) return; pend = true; queueMicrotask(() => { pend = false; try { travarDoPacote(); } catch (e) { console.warn('package entry', e); } }); }).observe(c, { childList: true }); })();

/* v241: the file the mod reads of each package of the Pacotes folder (pacote.json: the package's "custom", as a map carries
   it), made when it is not there or is of another edition; the pictures it names go into the package's "imagens" folder */
/* the revision of what the editor writes in a package's pacote.json: a file of an older revision is written again (v251: the
   pictures of the NPCs in the scenes) */
const REV_PACOTE_MOD = 2;
async function garantirPacotesDoMod(pacotes) {
  if (!Arquivos.ativo || (typeof REDEFININDO !== 'undefined' && REDEFININDO)) return;
  for (const pk of pacotes || []) {
    try {
      const pasta = 'Pacotes/' + (pk._pasta || pastaDoPacote(pk.id));
      const ha = (await Arquivos.lista(pasta)).some(x => x.nome === 'pacote.json' && !x.pasta);
      if (ha) { let j = null; try { j = await Arquivos.ler(pasta + '/pacote.json', 'json'); } catch { } if (j && j.id === pk.id && (j.edition || 1) === (pk.edicao || 1) && (j.rev || 1) >= REV_PACOTE_MOD) continue; }
      const custom = customDoPacote(pk); await extrairImagens(custom);
      const txt = JSON.stringify({ format: 'bigorna-pacote', version: 1, rev: REV_PACOTE_MOD, id: pk.id, edition: pk.edicao || 1, name: pk.nome || '', custom });
      try { await Deposito.copiarPara(pasta + '/imagens', [...imagensDoTexto(txt)]); } catch { }
      await Arquivos.gravar(pasta + '/pacote.json', txt);
    } catch (e) { console.warn('package for the mod: ' + pk.id, e); }
  }
}
