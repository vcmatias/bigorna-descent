/* Bigorna Rooms — the community library, like Valkyrie's: a public GitHub repository (vcmatias/bigorna-acervo) with an index of maps,
   campaigns and Workshop packages. Two places: maps (played in the game; the mod downloads them) and packages (content of
   the Workshop; the editor brings them into its library, the mod brings those a map needs).
   Publishing: the editor builds the community library file (a .zip with the community library card, the map files or the package) and opens a
   form on GitHub already filled with the card; the author drops the .zip into it and sends it. Once approved, it goes
   into the index by itself. A map tells which packages it needs ("requires"): the entries that came unchanged from a
   package that is in the community library leave the map's "custom" (the mod takes them from the package); a changed entry stays.
   Format: acervo/FORMATO.md. */
'use strict';

const ACERVO_REPO = 'vcmatias/bigorna-acervo';
const VERSAO_DO_EDITOR = '@@VERSAO_BIGORNA@@';
/* (another community library, for tests: localStorage bigorna-acervo-base / bigorna-acervo-formulario) */
function lerLocal(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } }
const acervoBase = () => lerLocal('bigorna-acervo-base') || 'https://raw.githubusercontent.com/' + ACERVO_REPO + '/main/';
const acervoFormulario = () => lerLocal('bigorna-acervo-formulario') || 'https://github.com/' + ACERVO_REPO + '/issues/new';
const ID_ACERVO = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/;
const TIPOS_ACERVO = ['mapa', 'campanha', 'pacote'];
const NOME_TIPO_ACERVO = { mapa: 'Map', campanha: 'Campaign', pacote: 'Package' };

// ------------------------------------------------------------ zip (stored; read: stored or deflate)
const TABELA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABELA_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
/* [{nome, dados: Uint8Array}] → Blob of a .zip (no compression: the media are compressed already, and anyone reads it) */
function montarZip(arquivos) {
  const enc = new TextEncoder(); const partes = []; const central = []; let pos = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome); const d = a.dados; const crc = crc32(d);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, 0, true); loc.setUint16(12, 0x21, true); loc.setUint32(14, crc, true); loc.setUint32(18, d.length, true); loc.setUint32(22, d.length, true);
    loc.setUint16(26, nome.length, true); loc.setUint16(28, 0, true);
    partes.push(new Uint8Array(loc.buffer), nome, d);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, 0, true); cen.setUint16(14, 0x21, true); cen.setUint32(16, crc, true); cen.setUint32(20, d.length, true); cen.setUint32(24, d.length, true);
    cen.setUint16(28, nome.length, true); cen.setUint32(42, pos, true);
    central.push(new Uint8Array(cen.buffer), nome);
    pos += 30 + nome.length + d.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true); fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: 'application/zip' });
}
/* the entries of a .zip: [{nome, dados: Uint8Array}] */
async function lerZip(buf) {
  const b = new Uint8Array(buf); const v = new DataView(b.buffer, b.byteOffset, b.byteLength); const dec = new TextDecoder();
  let fim = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('not a zip');
  const n = v.getUint16(fim + 10, true); let p = v.getUint32(fim + 16, true); const r = [];
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('damaged zip');
    const metodo = v.getUint16(p + 10, true), comp = v.getUint32(p + 20, true), tam = v.getUint32(p + 24, true), ln = v.getUint16(p + 28, true), le = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const nome = dec.decode(b.subarray(p + 46, p + 46 + ln)); p += 46 + ln + le + lc;
    if (nome.endsWith('/')) continue;
    const ini = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true); const bruto = b.subarray(ini, ini + comp);
    let dados;
    if (metodo === 0) dados = bruto.slice();
    else if (metodo === 8) dados = new Uint8Array(await new Response(new Blob([bruto]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error('unknown compression ' + metodo);
    if (dados.length !== tam) throw new Error('wrong size in the zip: ' + nome);
    r.push({ nome, dados });
  }
  return r;
}
async function sha256Hex(buf) { const h = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function bytesDe(x) {
  if (x instanceof Uint8Array) return x;
  if (typeof x === 'string') return x.startsWith('data:') ? new Uint8Array(await (await fetch(x)).arrayBuffer()) : new TextEncoder().encode(x);
  if (x && typeof x.arrayBuffer === 'function') return new Uint8Array(await x.arrayBuffer());
  return null;
}

// ------------------------------------------------------------ the index
async function lerIndiceDoAcervo() {
  const r = await fetch(acervoBase() + 'indice.json', { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || j.formato !== 'bigorna-acervo-indice') throw new Error(tr('the community library index is not Bigorna’s'));
  return (j.itens || []).filter(f => f && ID_ACERVO.test(f.id || '') && TIPOS_ACERVO.includes(f.tipo) && f.url);
}
function novoIdDoAcervo(nome) { return (slug(nome || 'map').slice(0, 40).replace(/-+$/, '') || 'map') + '-' + Math.random().toString(36).slice(2, 6).padEnd(4, '0'); }

// ------------------------------------------------------------ packages: what the mod reads, what the map needs
/* runs fn with the Workshop b as the one on screen (to export a package as the mod reads it, the "custom" of a map) */
function comOficina(b, fn) { const c0 = campanha, p0 = projeto; campanha = null; projeto = { ...projetoNovo(), bestiario: b }; try { return fn(); } finally { campanha = c0; projeto = p0; } }
/* a package as the mod reads it: the same "custom" a map carries, made only of the package's entries */
function customDoPacote(pk) {
  const b = oficinaVazia(); const ct = pk.conteudo || {};
  CATEGORIAS_PACOTE.forEach(c => { b[c.k] = clone(ct[c.k] || []); });
  if (Array.isArray(ct.maos)) b.maos = clone(ct.maos);
  if (Array.isArray(ct.poolFacanhas)) b.poolFacanhas = clone(ct.poolFacanhas);
  if (ct.padroes && typeof ct.padroes === 'object') b.padroes = { ...(b.padroes || {}), ...clone(ct.padroes) };
  const r = comOficina(b, () => conteudoCustom());
  Object.keys(r).forEach(k => { if (Array.isArray(r[k]) && !r[k].length) delete r[k]; });
  return r;
}
/* the packages the work on screen uses, against the community library: those that can be required (in the community library, at the edition of
   this browser's library) and those whose entries stay inside the map (with the reason) */
async function pacotesParaExigir(indice) {
  const uso = usoDosPacotes(); const bib = await bibliotecaDePacotes(); const exigir = [], dentro = [];
  for (const [id] of uso) {
    const noAcervo = indice.find(f => f.tipo === 'pacote' && f.id === id); const naBib = bib.find(p => p.id === id);
    const nome = naBib?.nome || noAcervo?.nome || id;
    if (!noAcervo) { dentro.push({ id, nome, porque: tr('it is not in the community library') }); continue; }
    const pk = naBib ? await lerDaBiblioteca(id) : null;
    if (!pk) { dentro.push({ id, nome, porque: tr('it is not in this browser’s library') }); continue; }
    if ((pk.edicao || 1) !== noAcervo.edicao) { dentro.push({ id, nome, porque: tr('the community library has edition') + ' ' + noAcervo.edicao + ', ' + tr('your library has') + ' ' + (pk.edicao || 1) }); continue; }
    exigir.push({ id, edicao: noAcervo.edicao, nome, custom: customDoPacote(pk) });
  }
  return { exigir, dentro };
}
const chaveDaEntrada = o => o && typeof o === 'object' ? (o.id ?? o._id ?? o.hero) : undefined;
/* takes out of a map (or campaign) the entries equal to those of a required package; returns {id: how many left} */
function enxugarDoc(doc, exigir) {
  const tirou = {};
  for (const q of exigir) {
    tirou[q.id] = tirou[q.id] || 0;
    for (const [k, lista] of Object.entries(q.custom)) {
      if (k === 'featPool' || !Array.isArray(lista) || !Array.isArray(doc.custom?.[k])) continue;
      const doPacote = new Map(lista.filter(o => chaveDaEntrada(o) != null).map(o => [chaveDaEntrada(o), JSON.stringify(o)]));
      const antes = doc.custom[k].length;
      doc.custom[k] = doc.custom[k].filter(o => { const c = chaveDaEntrada(o); return !(c != null && doPacote.get(c) === JSON.stringify(o)); });
      tirou[q.id] += antes - doc.custom[k].length;
    }
  }
  return tirou;
}

// ------------------------------------------------------------ what goes into the community library file
/* the map or campaign on screen: {tipo, nome, docs: [{nome, doc}], midias: [{nome, blob}], faltam: [names], ato, conteudo, exigidos, dentro} */
async function obraParaOAcervo(indice) {
  await prepararTopos();
  const { exigir, dentro } = await pacotesParaExigir(indice);
  let tipo, nome, docs, midias, ato, conteudo = {};
  if (campanha) {
    const { cid, dcamp, mapas } = montarDcamp();
    tipo = 'campanha'; nome = campanha.meta.name || 'Campaign'; ato = dcamp.meta.requiresAct === 'II' ? 2 : 1; conteudo = { mapas: mapas.length };
    docs = [{ nome: cid + '.dcamp', doc: dcamp }, ...mapas.map(m => ({ nome: m.nome, doc: m.doc }))];
    midias = () => [...musicasDosMapas(mapas.map(m => m.doc), cid), ...videosDasCenas(dcamp, cid)];
  } else {
    const d = montarDmap(); tipo = 'mapa'; nome = projeto.meta.name || 'Map'; ato = atoNecessario(projeto) > 1 ? 2 : 1;
    docs = [{ nome: d.meta.id + '.dmap', doc: d }]; midias = () => musicasDosMapas([d], null);
  }
  // the entries of the required packages leave the files; a package that took nothing out is not required
  const tirados = {}; docs.forEach(x => Object.entries(enxugarDoc(x.doc, exigir)).forEach(([id, n]) => { tirados[id] = (tirados[id] || 0) + n; }));
  const exigidos = exigir.filter(q => tirados[q.id] > 0);
  exigir.filter(q => !tirados[q.id]).forEach(q => dentro.push({ id: q.id, nome: q.nome, porque: tr('all its entries were changed here') }));
  const requires = exigidos.map(q => ({ id: q.id, edition: q.edicao, name: q.nome }));
  docs.forEach(x => { if (requires.length) x.doc.requires = requires; else delete x.doc.requires; });
  const ms = midias(); const faltam = ms.filter(a => !a.texto).map(a => a.nome);
  return { tipo, nome, docs, midias: ms.filter(a => a.texto).map(a => ({ nome: a.nome, blob: a.texto })), faltam, ato, conteudo, exigidos, dentro };
}
/* a package of the library: the .bigorna (for the editor), pacote.json (for the mod) and its media as files */
async function pacoteParaOAcervo(pk) {
  const custom = customDoPacote(pk);
  const docs = [{ nome: 'pacote.bigorna', doc: pk }, { nome: 'pacote.json', doc: { format: 'bigorna-pacote', version: 1, id: pk.id, edition: pk.edicao || 1, name: pk.nome || '', custom } }];
  const midias = Object.entries(pk.midia || {}).filter(([n, d]) => typeof d === 'string' && d.startsWith('data:') && /^[^/\\]+$/.test(n)).map(([n, d]) => ({ nome: n, blob: d }));
  return { tipo: 'pacote', nome: pk.nome || 'Package', docs, midias, faltam: [], ato: 1, conteudo: { entradas: contarPacote(pk) }, exigidos: [], dentro: [] };
}
async function zipDoAcervo(ficha, preparo) {
  const arquivos = [{ nome: 'bigorna-acervo.json', dados: new TextEncoder().encode(JSON.stringify(ficha, null, 1)) }];
  const usados = new Set(['bigorna-acervo.json']);
  for (const x of preparo.docs) { if (usados.has(x.nome)) continue; usados.add(x.nome); arquivos.push({ nome: x.nome, dados: new TextEncoder().encode(JSON.stringify(x.doc, null, 1)) }); }
  for (const m of preparo.midias) { if (usados.has(m.nome)) continue; const d = await bytesDe(m.blob); if (d) { usados.add(m.nome); arquivos.push({ nome: m.nome, dados: d }); } }
  return montarZip(arquivos);
}
function urlDoFormulario(ficha) {
  const titulo = '[' + ficha.tipo + '] ' + ficha.nome + ' (' + tr('edition') + ' ' + ficha.edicao + ')';
  return acervoFormulario() + '?template=publicar.yml&title=' + encodeURIComponent(titulo) + '&ficha=' + encodeURIComponent(JSON.stringify(ficha));
}

// ------------------------------------------------------------ publish
/* qual: undefined for the map or campaign on screen; a package id of the library */
async function publicarNoAcervo(idPacote) {
  let indice;
  try { indice = await lerIndiceDoAcervo(); } catch (e) { return avisoLongo(tr('No connection to the community library') + ' (' + (e.message || e) + '). ' + tr('Publishing needs the internet.')); }
  let preparo, id, edicao, guardar;
  if (idPacote) {
    const pk = await lerDaBiblioteca(idPacote); if (!pk) return aviso(tr('This package is no longer in this browser.'));
    if (!ID_ACERVO.test(pk.id || '')) return avisoLongo(tr('This package has an id the community library does not take. Export it again as a new package.'));
    id = pk.id; edicao = pk.edicao || 1;
    const la = indice.find(f => f.id === id);
    if (la && la.tipo !== 'pacote') return avisoLongo(tr('The community library has something else with this id.'));
    if (la && la.edicao >= edicao) return avisoLongo(tr('The community library already has edition') + ' ' + la.edicao + ' ' + tr('of this package. Make a new edition first: ⚙ → Export a package → “New edition of …”.'));
    preparo = await pacoteParaOAcervo(pk); guardar = () => {};
  } else {
    preparo = await obraParaOAcervo(indice);
    const meta = campanha ? campanha.meta : projeto.meta;
    const ant = meta.acervo || meta.loja;   // (a 0.1.4 guardava em meta.loja)
    id = ant?.id && ID_ACERVO.test(ant.id) ? ant.id : novoIdDoAcervo(preparo.nome);
    const la = indice.find(f => f.id === id);
    if (la && la.tipo !== preparo.tipo) id = novoIdDoAcervo(preparo.nome);
    edicao = ((indice.find(f => f.id === id) || {}).edicao || 0) + 1;
    guardar = () => { meta.acervo = { id, edicao }; delete meta.loja; tudo(); };
  }
  const lingua = IDIOMA === 'pt' ? 'pt' : 'en';
  const resumo0 = idPacote ? '' : ((campanha ? campanha.meta.description : projeto.meta.description) || '');
  modal(tr('Publish to the community library'), `<p class="ajuda">${tr('The community library is where players find maps, campaigns and packages, in the game and in the editor. The editor saves the file for the community library and opens a form on GitHub, already filled: drop the file into it and send it (you need a free GitHub account). If it passes the automatic check, it goes into the community library by itself.')}</p>
    <p><b>${esc(tr(NOME_TIPO_ACERVO[preparo.tipo]))}</b> · ${tr('edition')} ${edicao}${edicao > 1 ? ' <small class="ajuda">(' + tr('a new edition of what is in the community library') + ')</small>' : ''}</p>
    <label class="campo">${tr('Name')} <input id="ac_nome" value="${esc(preparo.nome)}" data-sem-traducao></label>
    <label class="campo">${tr('Author')} <input id="ac_autor" value="${esc(autorGuardado() || '')}" data-sem-traducao></label>
    <label class="campo">${tr('Summary (what players read in the community library)')} <textarea id="ac_resumo" rows="3" maxlength="400" data-sem-traducao>${esc(resumo0)}</textarea></label>
    <label class="campo">${tr('Language')} <select id="ac_lingua"><option value="pt">Português</option><option value="en">English</option><option value="pt,en">Português + English</option></select></label>
    ${preparo.exigidos.length ? `<p class="ajuda">${tr('Packages this needs (players get them with it)')}: ${preparo.exigidos.map(q => '<b data-sem-traducao>' + esc(q.nome) + '</b> (' + tr('edition') + ' ' + q.edicao + ')').join(', ')}</p>` : ''}
    ${preparo.dentro.length ? `<p class="ajuda">${tr('Packages whose entries go inside the file')}: ${preparo.dentro.map(q => '<span data-sem-traducao>' + esc(q.nome) + '</span> (' + esc(q.porque) + ')').join('; ')}</p>` : ''}
    ${preparo.faltam.length ? `<p class="aviso">${tr('Files missing in this browser (they stay out)')}: <span data-sem-traducao>${preparo.faltam.map(esc).join(', ')}</span></p>` : ''}
    <label class="chk"><input type="checkbox" id="ac_ok"> ${tr('This is mine (or I may share it), and it has no art or text copied from the game.')}</label>
    <div class="linha"><span class="espaco"></span><button class="primario" id="ac_publicar" disabled>${tr('Save the file and open the form')}</button></div>`, (el, fechar) => {
    el.querySelector('#ac_lingua').value = lingua;
    el.querySelector('#ac_ok').onchange = e => { el.querySelector('#ac_publicar').disabled = !e.target.checked; };
    el.querySelector('#ac_publicar').onclick = async () => {
      const nome = el.querySelector('#ac_nome').value.trim() || preparo.nome; const autor = el.querySelector('#ac_autor').value.trim();
      if (autor && autor !== autorGuardado()) guardarAutor(autor);
      const ficha = { formato: 'bigorna-acervo', versao: 1, id, tipo: preparo.tipo, nome, autor, resumo: el.querySelector('#ac_resumo').value.trim().slice(0, 400), lingua: el.querySelector('#ac_lingua').value,
        ato: preparo.ato, edicao, requer: preparo.exigidos.map(q => ({ id: q.id, edicao: q.edicao, nome: q.nome })), conteudo: preparo.conteudo, editor: VERSAO_DO_EDITOR, data: new Date().toISOString().slice(0, 10) };
      const zip = await zipDoAcervo(ficha, preparo);
      const arquivo = 'bigorna-acervo-' + id + '-' + edicao + '.zip';
      const a = document.createElement('a'); a.href = URL.createObjectURL(zip); a.download = arquivo; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      guardar(); fechar();
      window.open(urlDoFormulario(ficha), '_blank', 'noopener');
      modal(tr('Almost there'), `<ol class="passos"><li>${tr('The file')} <b data-sem-traducao>${esc(arquivo)}</b> ${tr('was saved (in Downloads, or the folder of your browser).')}</li>
        <li>${tr('On the GitHub page that opened, drag that file into the “File” box and press “Create” (or “Submit new issue”).')}</li>
        <li>${tr('A check runs by itself and answers in the page. If all is right, it goes into the community library in a few minutes; if not, the answer says what to fix (edit the request and it runs again).')}</li></ol>
        <p class="ajuda">${tr('The page did not open?')} <a href="${esc(urlDoFormulario(ficha))}" target="_blank" rel="noopener">${tr('Open the form')}</a></p>`, null);
    };
  }, true);
}

// ------------------------------------------------------------ the community packages (into the library)
async function abrirAcervoDePacotes() {
  modal(tr('Community packages'), `<p class="ajuda">${tr('Workshop packages shared by other authors. A package downloaded here goes into your library (⚙ → My packages), ready to add to any map or campaign.')}</p><div id="ac_lista" class="listaPacote"><p class="ajuda">${tr('Asking the community library…')}</p></div>`, async (el, fechar) => {
    let indice;
    try { indice = (await lerIndiceDoAcervo()).filter(f => f.tipo === 'pacote'); }
    catch (e) { el.querySelector('#ac_lista').innerHTML = `<p class="aviso">${tr('No connection to the community library')} (${esc(e.message || String(e))}).</p>`; return; }
    const pinta = async () => {
      const bib = await bibliotecaDePacotes();
      el.querySelector('#ac_lista').innerHTML = indice.length ? indice.map(f => { const tem = bib.find(p => p.id === f.id); const ed = tem ? tem.edicao : 0;
        return `<div class="catPacote fichaPacote" data-id="${esc(f.id)}"><div><b data-sem-traducao>${esc(f.nome || f.id)}</b> <small>${tr('edition')} ${f.edicao}${f.conteudo?.entradas ? ' · ' + f.conteudo.entradas + ' ' + tr('entries') : ''}${f.autor ? ' · <span data-sem-traducao>' + esc(f.autor) + '</span>' : ''}${f.lingua ? ' · ' + esc(f.lingua.toUpperCase()) : ''}</small>
          ${f.resumo ? `<br><small data-sem-traducao>${esc(f.resumo)}</small>` : ''}<br><small class="${ed && ed < f.edicao ? 'aviso' : 'ajuda'}">${!ed ? tr('not in your library') : ed < f.edicao ? tr('your library has edition') + ' ' + ed : tr('in your library')}</small></div>
          <div class="linha">${!ed || ed < f.edicao ? `<button class="sm primario" data-acao="baixar">${ed ? tr('Update') : tr('Download')}</button>` : ''}${ed ? `<button class="sm" data-acao="usar">${tr('Add to this work…')}</button>` : ''}</div></div>`; }).join('')
        : `<p class="ajuda">${tr('The community library has no packages yet.')}</p>`;
      el.querySelectorAll('[data-acao]').forEach(bt => bt.onclick = async () => {
        const f = indice.find(x => x.id === bt.closest('[data-id]').dataset.id);
        if (bt.dataset.acao === 'usar') { const pk = await lerDaBiblioteca(f.id); if (pk) { fechar(); abrirImportacaoDePacote(pk); } return; }
        bt.disabled = true; bt.textContent = tr('Downloading…');
        try { const pk = await baixarPacoteDoAcervo(f); await guardarNaBiblioteca(pk); aviso(tr('Package in your library') + ': ' + (pk.nome || f.nome)); }
        catch (e) { avisoLongo(tr('The package did not come') + ': ' + (e.message || e)); }
        pinta();
      });
    };
    pinta();
  }, true);
}
/* downloads a package of the community library, checks it (sum, card, file) and returns the Workshop package inside */
async function baixarPacoteDoAcervo(f) {
  const r = await fetch(acervoBase() + f.url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = await r.arrayBuffer();
  if (f.sha256 && (await sha256Hex(buf)) !== f.sha256.toLowerCase()) throw new Error(tr('the file does not match the community library'));
  const es = await lerZip(buf); const dec = new TextDecoder();
  const ficha = JSON.parse(dec.decode((es.find(e => e.nome === 'bigorna-acervo.json') || {}).dados || new Uint8Array()) || 'null');
  if (!ficha || ficha.id !== f.id || ficha.tipo !== 'pacote') throw new Error(tr('the card inside the file is not this one'));
  const pk = JSON.parse(dec.decode((es.find(e => e.nome === 'pacote.bigorna') || {}).dados || new Uint8Array()) || 'null');
  if (!pk || pk.formato !== FORMATO_PACOTE || pk.id !== f.id) throw new Error(tr('the file has no Workshop package'));
  return pk;
}

// ------------------------------------------------------------ the community library, from the header
function abrirAcervo() {
  const obra = campanha ? tr('this campaign') : tr('this map');
  modal(tr('Community library'), `<p class="ajuda">${tr('Like Valkyrie’s: players download maps and campaigns in the game (Community maps → Download maps), and the packages a map needs come along. Authors publish from here.')}</p>
    <div class="linha"><button class="primario" id="ac_obra">${tr('Publish')} ${esc(obra)}…</button><button id="ac_pacotes">${tr('Community packages…')}</button><button id="ac_meus">${tr('Publish one of my packages…')}</button></div>`, (el, fechar) => {
    el.querySelector('#ac_obra').onclick = () => { fechar(); publicarNoAcervo(); };
    el.querySelector('#ac_pacotes').onclick = () => { fechar(); abrirAcervoDePacotes(); };
    el.querySelector('#ac_meus').onclick = async () => {
      const eu = autorGuardado() || ''; const l = (await bibliotecaDePacotes()).filter(p => !p.autor || p.autor === eu);
      if (!l.length) return aviso(tr('No package of yours in this browser: export one first (⚙ → Export a package).'));
      fechar();
      modal(tr('Publish one of my packages'), `<div class="listaPacote">${l.map(p => `<div class="catPacote fichaPacote" data-id="${esc(p.id)}"><div><b data-sem-traducao>${esc(p.nome)}</b> <small>${tr('edition')} ${p.edicao} · ${p.n} ${tr('entries')}</small></div><div class="linha"><button class="sm primario" data-acao="publicar">${tr('Publish')}</button></div></div>`).join('')}</div>`, (el2, fechar2) => {
        el2.querySelectorAll('[data-acao]').forEach(bt => bt.onclick = () => { fechar2(); publicarNoAcervo(bt.closest('[data-id]').dataset.id); });
      }, true);
    };
  });
}
$('#btnAcervo').onclick = () => abrirAcervo();
