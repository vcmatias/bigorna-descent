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
/* the language a work was made in: one of the game's (linguas.js), told by the author (map setup, campaign screen), shown
   with its flag. The emoji go in the GitHub request title; the pages show the flag pictures (Windows shows no flag emoji) */
const codigoDeLingua = l => { const k = String(l || '').trim().toLowerCase().replace('_', '-'); return k === 'cz' ? 'cs' : k === 'pt-br' ? 'pt' : k; };
const bandeiras = l => String(l || '').split(',').map(x => (LINGUA_DE[codigoDeLingua(x)] || {}).emoji || x.trim().toUpperCase()).filter(Boolean).join(' ');
const imgBandeira = (cod, alto = 14) => { const l = LINGUA_DE[codigoDeLingua(cod)]; return l ? `<img class="bandeira" loading="lazy" decoding="async" ${imgTardia(l.png)} alt="${esc(l.emoji)}" title="${esc(l.nome)}" style="height:${alto}px;vertical-align:-2px;border:1px solid #0004">` : esc(String(cod || '').toUpperCase()); };
const imgsBandeira = (l, alto) => String(l || '').split(',').filter(x => x.trim()).map(x => imgBandeira(x, alto)).join(' ');
/* the language a new work starts with: the editor's */
const linguaPadrao = () => (LINGUA_DE[IDIOMA] ? IDIOMA : 'en');
const opcoesDeLingua = sel => LINGUAS.map(l => `<option value="${l.cod}"${l.cod === codigoDeLingua(sel) ? ' selected' : ''}>${esc(l.nome)}${l.nome !== l.pt && IDIOMA === 'pt' ? ' · ' + esc(l.pt) : ''}</option>`).join('');
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
/* (the Workshop is one: it is swapped for b while fn runs, and comes back) */
function comOficina(b, fn) { const c0 = campanha, p0 = projeto, o0 = _oficina; campanha = null; _oficina = b; projeto = { ...projetoNovo(), bestiario: b }; try { return fn(); } finally { campanha = c0; projeto = p0; _oficina = o0; } }
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
      const doPacote = new Map(lista.filter(o => chaveDaEntrada(o) != null).map(o => [chaveDaEntrada(o), jsonOriginal(o)]));
      const antes = doc.custom[k].length;
      doc.custom[k] = doc.custom[k].filter(o => { const c = chaveDaEntrada(o); return !(c != null && doPacote.get(c) === jsonOriginal(o)); });
      tirou[q.id] += antes - doc.custom[k].length;
    }
  }
  return tirou;
}

// ------------------------------------------------------------ what goes into the community library file
/* the map or campaign on screen: {tipo, nome, docs: [{nome, doc}], midias: [{nome, blob}], faltam: [names], ato, conteudo, exigidos, dentro} */
async function obraParaOAcervo(indice, vinculos = []) {
  await prepararTopos();
  const { exigir, dentro } = await pacotesParaExigir(indice);
  // (v243: the packages of the community library the author linked the work to: they count as required, as downloaded)
  for (const v of vinculos) { const i = exigir.findIndex(q => q.id === v.id); if (i >= 0) exigir.splice(i, 1); const j = dentro.findIndex(q => q.id === v.id); if (j >= 0) dentro.splice(j, 1); exigir.push(v); }
  let tipo, nome, docs, midias, ato, conteudo = {};
  _semSepararPacotes = true;   // (v241: the library decides here which packages are required)
  try {
  if (campanha) {
    const { cid, dcamp, mapas } = montarDcamp();
    tipo = 'campanha'; nome = campanha.meta.name || 'Campaign'; ato = dcamp.meta.requiresAct === 'II' ? 2 : 1; conteudo = { mapas: mapas.length };
    docs = [{ nome: cid + '.dcamp', doc: dcamp }, ...mapas.map(m => ({ nome: m.nome, doc: m.doc }))];
    midias = () => [...musicasDosMapas(mapas.map(m => m.doc), cid), ...videosDasCenas(dcamp, cid)];
  } else {
    const d = montarDmap(); tipo = 'mapa'; nome = projeto.meta.name || 'Map'; ato = atoNecessario(projeto) > 1 ? 2 : 1;
    docs = [{ nome: d.meta.id + '.dmap', doc: d }]; midias = () => musicasDosMapas([d], null);
  }
  } finally { _semSepararPacotes = false; }
  // the entries of the required packages leave the files; a package is required when it took something out or has an entry
  // changed here (the changed one goes in the file, over the package's); the others are not required
  const tirados = {}; docs.forEach(x => Object.entries(enxugarDoc(x.doc, exigir)).forEach(([id, n]) => { tirados[id] = (tirados[id] || 0) + n; }));
  const exigidos = exigir.filter(q => tirados[q.id] > 0 || conteudoProprio(docs, [q]).length < conteudoProprio(docs, []).length);
  // (v243: what is left of the Workshop of one's own, outside every required package: the work waits for a package with it)
  const proprios = conteudoProprio(docs, exigidos);
  const requires = exigidos.map(q => ({ id: q.id, edition: q.edicao, name: q.nome }));
  docs.forEach(x => { if (requires.length) x.doc.requires = requires; else delete x.doc.requires; });
  const ms = midias(); const faltam = ms.filter(a => !a.texto).map(a => a.nome);
  return { tipo, nome, docs, midias: ms.filter(a => a.texto).map(a => ({ nome: a.nome, blob: a.texto })), faltam, ato, conteudo, exigidos, dentro, proprios };
}
/* v243: the Workshop content a map or campaign carries in its "custom" (monsters, items, heroes, NPCs, weapons, skills, feats,
   recipes, tiles, objects) that no required package has (by id). The feat pool is a list of the game's ids: it has no owner.
   [{k, id, nome}], each once */
const CHAVES_SEM_DONO = new Set(['featPool']);
function conteudoProprio(docs, exigidos) {
  const doPacote = new Set();
  exigidos.forEach(q => Object.entries(q.custom || {}).forEach(([k, l]) => { if (Array.isArray(l)) l.forEach(o => { const c = chaveDaEntrada(o); if (c != null) doPacote.add(k + ':' + c); }); }));
  const r = new Map();
  docs.forEach(x => Object.entries(x.doc.custom || {}).forEach(([k, l]) => {
    if (CHAVES_SEM_DONO.has(k) || !Array.isArray(l)) return;
    l.forEach(o => { const c = chaveDaEntrada(o); if (c == null || doPacote.has(k + ':' + c) || r.has(k + ':' + c)) return; r.set(k + ':' + c, { k, id: c, nome: (o && (o.name || o.nome)) || String(c) }); });
  }));
  return [...r.values()];
}
const NOME_DA_CHAVE = { enemies: 'Monsters', items: 'Items', heroes: 'Heroes', weapons: 'Weapons', recipes: 'Recipes', skills: 'Skills', feats: 'Feats', heroWeapons: 'Heroes’ weapons', characters: 'NPCs', tiles: 'Tiles', objects: 'Objects' };
const listaDeProprios = l => Object.entries(l.reduce((g, e) => { (g[e.k] = g[e.k] || []).push(e); return g; }, {})).map(([k, es]) => `<details class="catPacote" open><summary><b>${esc(tr(NOME_DA_CHAVE[k] || k))}</b> <small>${es.length}</small></summary>${es.map(e => `<div class="sub" data-sem-traducao>${esc(String(e.nome))}</div>`).join('')}</details>`).join('');
/* a package of the community library as a link of the work: {id, edicao, nome, custom} (downloaded and checked) */
async function vinculoDoAcervo(f) { const pk = await baixarPacoteDoAcervo(f); return { id: f.id, edicao: f.edicao, nome: f.nome || pk.nome || f.id, custom: customDoPacote(pk) }; }
/* a package of the library: the .bigorna (for the editor), pacote.json (for the mod) and its media as files */
async function pacoteParaOAcervo(pk) {
  const custom = customDoPacote(pk);
  const docs = [{ nome: 'pacote.bigorna', doc: pk }, { nome: 'pacote.json', doc: { format: 'bigorna-pacote', version: 1, id: pk.id, edition: pk.edicao || 1, name: pk.nome || '', custom } }];
  const midias = Object.entries(pk.midia || {}).filter(([n, d]) => typeof d === 'string' && d.startsWith('data:') && /^[^/\\]+$/.test(n)).map(([n, d]) => ({ nome: n, blob: d }));
  return { tipo: 'pacote', nome: pk.nome || 'Package', docs, midias, faltam: [], ato: 1, conteudo: { entradas: contarPacote(pk) }, exigidos: [], dentro: [] };
}
async function zipDoAcervo(ficha, preparo) {
  await originaisProntos(); const arquivos = [{ nome: 'bigorna-acervo.json', dados: new TextEncoder().encode(JSON.stringify(ficha, null, 1)) }];
  const usados = new Set(['bigorna-acervo.json']);
  // (v240: the files keep the references; the pictures go in the zip's "imagens" folder, each once)
  const imgs = new Set();
  for (const x of preparo.docs) { if (usados.has(x.nome)) continue; usados.add(x.nome); const t = await textoOriginal(x.doc); imagensDoTexto(t).forEach(n => imgs.add(n)); arquivos.push({ nome: x.nome, dados: new TextEncoder().encode(t) }); }
  for (const n of imgs) { const d = await bytesDaImg('imagens/' + n); if (d) arquivos.push({ nome: 'imagens/' + n, dados: d }); else console.warn('picture not in the store', n); }
  for (const m of preparo.midias) { if (usados.has(m.nome)) continue; const d = await bytesDe(m.blob); if (d) { usados.add(m.nome); arquivos.push({ nome: m.nome, dados: d }); } }
  return montarZip(arquivos);
}
function urlDoFormulario(ficha) {
  const titulo = bandeiras(ficha.lingua) + ' [' + ficha.tipo + '] ' + ficha.nome + ' (' + tr('edition') + ' ' + ficha.edicao + ')';
  return acervoFormulario() + '?template=publicar.yml&title=' + encodeURIComponent(titulo) + '&ficha=' + encodeURIComponent(JSON.stringify(ficha));
}

// ------------------------------------------------------------ publish
/* qual: undefined for the map or campaign on screen; a package id of the library, or the package itself (v244: made in the
   window that picks its entries) */
async function publicarNoAcervo(idPacote, vinculos) {
  let indice;
  try { indice = await lerIndiceDoAcervo(); } catch (e) { return avisoLongo(tr('No connection to the community library') + ' (' + (e.message || e) + '). ' + tr('Publishing needs the internet.')); }
  let preparo, id, edicao, guardar;
  if (idPacote) {
    const pk = typeof idPacote === 'object' ? idPacote : await lerDaBiblioteca(idPacote); if (!pk) return aviso(tr('This package is no longer in this browser.'));
    if (!ID_ACERVO.test(pk.id || '')) return avisoLongo(tr('This package has an id the community library does not take. Export it again as a new package.'));
    id = pk.id; edicao = pk.edicao || 1;
    const la = indice.find(f => f.id === id);
    if (la && la.tipo !== 'pacote') return avisoLongo(tr('The community library has something else with this id.'));
    if (la && la.edicao >= edicao) return avisoLongo(tr('The community library already has edition') + ' ' + la.edicao + ' ' + tr('of this package. Make a new edition first: ⚙ → Export a package → “New edition of …”.'));
    preparo = await pacoteParaOAcervo(pk); guardar = () => {};
  } else {
    const meta = campanha ? campanha.meta : projeto.meta;
    // (v243: the packages the work was linked to before, and one's Workshop published as a package, are tried by themselves)
    if (!vinculos) {
      vinculos = []; preparo = await obraParaOAcervo(indice);
      if (preparo.proprios.length) {
        const ja = new Set(preparo.exigidos.map(q => q.id));
        const quais = new Set([...((meta.acervo && meta.acervo.vinculos) || []), ...(Arquivos.ativo && MEU_PACOTE.id ? [MEU_PACOTE.id] : [])]);
        for (const f of indice.filter(f => f.tipo === 'pacote' && quais.has(f.id) && !ja.has(f.id))) { try { vinculos.push(await vinculoDoAcervo(f)); } catch (e) { console.warn('package of the community library', f.id, e); } }
        if (vinculos.length) preparo = await obraParaOAcervo(indice, vinculos);
      }
    } else preparo = await obraParaOAcervo(indice, vinculos);
    if (preparo.proprios.length) return pedirPacoteDaObra(preparo, indice, vinculos);
    const ant = meta.acervo || meta.loja;   // (a 0.1.4 guardava em meta.loja)
    id = ant?.id && ID_ACERVO.test(ant.id) ? ant.id : novoIdDoAcervo(preparo.nome);
    const la = indice.find(f => f.id === id);
    if (la && la.tipo !== preparo.tipo) id = novoIdDoAcervo(preparo.nome);
    edicao = ((indice.find(f => f.id === id) || {}).edicao || 0) + 1;
    const ligados = preparo.exigidos.map(q => q.id);
    guardar = () => { meta.acervo = { id, edicao, ...(ligados.length ? { vinculos: ligados } : {}) }; delete meta.loja; tudo(); };
  }
  // (the language the work was made in: kept since it was created; a package, or a work made before that, takes the editor's)
  const linguaDe = l => LINGUA_DE[codigoDeLingua(l)] ? codigoDeLingua(l) : linguaPadrao();
  const lingua = linguaDe(idPacote ? null : (campanha ? campanha.meta.lingua : projeto.meta.lingua));
  const resumo0 = idPacote ? '' : ((campanha ? campanha.meta.description : projeto.meta.description) || '');
  modal(tr('Publish to the community library'), `<p class="ajuda">${tr('The community library is where players find maps, campaigns and packages, in the game and in the editor. The editor saves the file for the community library and opens a form on GitHub, already filled: drop the file into it and send it (you need a free GitHub account). If it passes the automatic check, it goes into the community library by itself.')}</p>
    <p><b>${esc(tr(NOME_TIPO_ACERVO[preparo.tipo]))}</b> · ${tr('edition')} ${edicao}${edicao > 1 ? ' <small class="ajuda">(' + tr('a new edition of what is in the community library') + ')</small>' : ''}</p>
    <label class="campo">${tr('Name')} <input id="ac_nome" value="${esc(preparo.nome)}" data-sem-traducao></label>
    <label class="campo">${tr('Author')} <input id="ac_autor" value="${esc(autorGuardado() || '')}" data-sem-traducao></label>
    <label class="campo">${tr('Summary (what players read in the community library)')} <textarea id="ac_resumo" rows="3" maxlength="400" data-sem-traducao>${esc(resumo0)}</textarea></label>
    <label class="campo">${tr('Language')} <span id="ac_bandeira"></span> <select id="ac_lingua" data-sem-traducao>${opcoesDeLingua(lingua)}</select></label>
    ${!idPacote && linguasExtras().length ? `<p class="ajuda">${tr('Also in')}: ${linguasExtras().map(l => imgBandeira(l, 15) + ' <span data-sem-traducao>' + esc(LINGUA_DE[l].nome) + '</span>').join(', ')}</p>` : ''}
    ${preparo.exigidos.length ? `<p class="ajuda">${tr('Packages this needs (players download them first)')}: ${preparo.exigidos.map(q => '<b data-sem-traducao>' + esc(q.nome) + '</b> (' + tr('edition') + ' ' + q.edicao + ')').join(', ')}</p>` : ''}
    ${preparo.faltam.length ? `<p class="aviso">${tr('Files missing in this browser (they stay out)')}: <span data-sem-traducao>${preparo.faltam.map(esc).join(', ')}</span></p>` : ''}
    <p class="ajuda">${tr('The Bigorna project takes no responsibility for what is published in the community library: each author answers for their own work.')}</p>
    <div class="linha"><span class="espaco"></span><button class="primario" id="ac_publicar">${tr('Save the file and open the form')}</button></div>`, (el, fechar) => {
    const mostraBandeira = () => { el.querySelector('#ac_bandeira').innerHTML = imgBandeira(el.querySelector('#ac_lingua').value, 18); };
    el.querySelector('#ac_lingua').onchange = mostraBandeira; mostraBandeira();
    el.querySelector('#ac_publicar').onclick = async () => {
      const nome = el.querySelector('#ac_nome').value.trim() || preparo.nome; const autor = el.querySelector('#ac_autor').value.trim();
      if (autor && autor !== autorGuardado()) guardarAutor(autor);
      const ficha = { formato: 'bigorna-acervo', versao: 1, id, tipo: preparo.tipo, nome, autor, resumo: el.querySelector('#ac_resumo').value.trim().slice(0, 400), lingua: [codigoDeLingua(el.querySelector('#ac_lingua').value), ...(idPacote ? [] : linguasExtras())].filter((x, i, l) => l.indexOf(x) === i).join(','),
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

/* v243: the work uses Workshop content of one's own that no package of the community library has. In the community library that
   content goes in a package, published on its own; the work requires it (players get the package first). Two ways: link the
   work to packages of the community library that have it, or make a package with it (published first, then the work) */
function pedirPacoteDaObra(preparo, indice, vinculos) {
  const obra = campanha ? tr('This campaign') : tr('This map');
  const meta = campanha ? campanha.meta : projeto.meta;
  const pacotes = indice.filter(f => f.tipo === 'pacote');
  const ligados = new Set([...preparo.exigidos.map(q => q.id), ...vinculos.map(v => v.id)]);
  modal(tr('Workshop content of your own'), `<p class="ajuda">${esc(obra + ' ' + tr('uses Workshop content of your own. In the community library that content goes in a package, published on its own: the work requires the package, and players download it first.'))}</p>
    <div class="listaPacote" id="pp_lista">${listaDeProprios(preparo.proprios)}</div>
    ${preparo.dentro.length ? `<p class="ajuda">${esc(tr('Packages of your library that did not count'))}: ${preparo.dentro.map(q => '<span data-sem-traducao>' + esc(q.nome) + '</span> (' + esc(q.porque) + ')').join('; ')}</p>` : ''}
    <h4>${esc(tr('Link to packages of the community library'))}</h4>
    ${pacotes.length ? `<p class="ajuda">${esc(tr('Tick the packages that have this content. The editor downloads them and checks.'))}</p><div class="listaPacote">${pacotes.map(f => `<label class="chk sub"><input type="checkbox" data-pp="${esc(f.id)}"${ligados.has(f.id) ? ' checked' : ''}> <b data-sem-traducao>${esc(f.nome || f.id)}</b> <small>${tr('edition')} ${f.edicao}${f.autor ? ' · <span data-sem-traducao>' + esc(f.autor) + '</span>' : ''}${f.conteudo?.entradas ? ' · ' + f.conteudo.entradas + ' ' + tr('entries') : ''}</small></label>`).join('')}</div>
      <div class="linha"><span class="ajuda" id="pp_estado"></span><span class="espaco"></span><button class="primario" id="pp_ligar">${esc(tr('Link and continue'))}</button></div>`
      : `<p class="ajuda">${esc(tr('The community library has no packages yet.'))}</p>`}
    <h4>${esc(tr('Make a package with this content'))}</h4>
    <p class="ajuda">${esc(tr('Pick the Workshop entries that go in the package (what this work uses comes ticked) and publish it on its own. Once it is in the community library (a few minutes after the check), publish the work again: it is linked to the package by itself.'))}</p>
    <div class="linha"><span class="espaco"></span><button id="pp_montar">${esc(tr('Make the package…'))}</button></div>`, (el, fechar) => {
    const lembrar = idp => { meta.acervo = { ...(meta.acervo || {}), vinculos: [...new Set([...((meta.acervo && meta.acervo.vinculos) || []), idp])] }; tudo(); };
    const bt = el.querySelector('#pp_ligar');
    if (bt) bt.onclick = async () => {
      const ids = [...el.querySelectorAll('[data-pp]:checked')].map(ch => ch.dataset.pp); const estado = el.querySelector('#pp_estado');
      if (!ids.length) { estado.textContent = tr('Tick a package first.'); return; }
      bt.disabled = true; estado.textContent = tr('Downloading…');
      const novos = [];
      try { for (const idp of ids) { const ja = vinculos.find(v => v.id === idp); novos.push(ja || await vinculoDoAcervo(pacotes.find(f => f.id === idp))); } }
      catch (e) { bt.disabled = false; estado.textContent = tr('The package did not come') + ': ' + (e.message || e); return; }
      const p2 = await obraParaOAcervo(indice, novos); bt.disabled = false;
      if (p2.proprios.length) { estado.textContent = tr('These packages do not have all of it. Still missing') + ': ' + p2.proprios.length + ' ' + tr('entries') + '.'; el.querySelector('#pp_lista').innerHTML = listaDeProprios(p2.proprios); return; }
      fechar(); publicarNoAcervo(undefined, novos);
    };
    el.querySelector('#pp_montar').onclick = () => {
      fechar();
      escolherPacoteParaPublicar({ usados: preparo.proprios, nome: meta.name, depois: pk => lembrar(pk.id) });
    };
  }, true);
}

/* v244: before a package goes to the community library, a window says what that means and lets the author tick the Workshop
   entries that go in it. It starts as a new package, or a new edition of one of one's packages (its entries ticked); from a
   work that needs a package (opcoes.usados: the entries it uses, [{k, id}]), those come ticked. What the entries need goes
   along (loot, recipes, rewards) when asked. Then the publishing as always; opcoes.depois(pk) once the package is made */
async function escolherPacoteParaPublicar(opcoes = {}) {
  let indice = []; try { indice = await lerIndiceDoAcervo(); } catch (e) { return avisoLongo(tr('No connection to the community library') + ' (' + (e.message || e) + '). ' + tr('Publishing needs the internet.')); }
  const eu = autorGuardado() || ''; const meus = (await bibliotecaDePacotes()).filter(p => p.meu || !p.autor || p.autor === eu);
  const b = oficina(); const usados = new Set((opcoes.usados || []).map(e => String(e.id)));
  const usa = x => [x.id, x._id, x.base].some(v => v != null && usados.has(String(v)));
  let base = null, pkBase = null, marcadas = new Map(CATEGORIAS_PACOTE.map(c => [c.k, new Set()]));
  // (the entries to choose from: one's own of the Workshop, and those of the package the edition starts from)
  const lista = c => { const r = new Map(); ((pkBase && pkBase.conteudo || {})[c.k] || []).forEach(x => { if (x && x.id != null) r.set(x.id, x); });
    (b[c.k] || []).filter(x => x && c.proprio(x) && (!doPacote(x) || (base && x._doPacote === base.id))).forEach(x => r.set(x.id, x));
    return [...r.values()].filter(x => !(c.k === 'receitas' && receitaDeItemDaOficina(x))); };   // (v245: recipes go with their items)
  const marcarDe = () => { marcadas = new Map(CATEGORIAS_PACOTE.map(c => [c.k, new Set(lista(c).filter(x => usados.size ? usa(x) : pkBase ? ((pkBase.conteudo || {})[c.k] || []).some(y => y.id === x.id) : true).map(x => x.id))])); };
  const edicaoDe = () => { if (!base) return 1; const la = indice.find(f => f.id === base.id); return la ? Math.max(base.edicao || 1, la.edicao || 0) + 1 : (base.edicao || 1); };
  marcarDe();
  modal(tr('Publish a package to the community library'), `<p class="ajuda">${esc(tr('A package carries Workshop entries (monsters, items, heroes, NPCs, weapons, skills, feats, recipes, tiles, objects) to the community library, published on its own. Whoever downloads it gets those entries; maps and campaigns that use them require the package, and players download it first. Tick what goes in it.'))}</p>
    <div class="linha"><label class="campo">${tr('Package')} <select id="pa_base"><option value="">${tr('A new package')}</option>${meus.map(p => `<option value="${esc(p.id)}">${esc(tr('New edition of'))} “${esc(p.nome || p.id)}”</option>`).join('')}</select></label>
      <label class="campo">${tr('Package name')} <input id="pa_nome" value="${esc(opcoes.nome || '')}" placeholder="${esc(tr('My creations'))}" data-sem-traducao></label></div>
    <p class="ajuda" id="pa_edicao"></p>
    <label class="chk"><input type="checkbox" id="pa_dep" checked> ${tr('Take along what the entries need')}</label>
    <div id="pa_lista" class="listaPacote"></div>
    <div class="linha"><span class="ajuda" id="pa_conta"></span><span class="espaco"></span><button class="primario" id="pa_ok">${esc(tr('Publish the ticked ones…'))}</button></div>`, (el, fechar) => {
    const pinta = () => {
      el.querySelector('#pa_edicao').textContent = tr('edition') + ' ' + edicaoDe() + (base && indice.some(f => f.id === base.id) ? ' (' + tr('a new edition of what is in the community library') + ')' : '');
      el.querySelector('#pa_lista').innerHTML = CATEGORIAS_PACOTE.map(c => { const l = lista(c); if (!l.length) return ''; const m = marcadas.get(c.k);
        return `<details class="catPacote"${m.size ? ' open' : ''}><summary><label class="chk"><input type="checkbox" data-cat="${c.k}" ${m.size === l.length ? 'checked' : ''}> <b>${esc(tr(c.nome))}</b> <small>${m.size} / ${l.length}</small></label></summary>
          ${l.map(x => `<label class="chk sub"><input type="checkbox" data-cat="${c.k}" data-id="${esc(x.id)}" ${m.has(x.id) ? 'checked' : ''}> <span data-sem-traducao>${esc(c.rotulo(x) || x.id)}</span>${usados.size && usa(x) ? ' <small class="ajuda">' + esc(tr('used by the work')) + '</small>' : ''}</label>`).join('')}</details>`; }).join('') || `<p class="ajuda">${tr('The Workshop has nothing of yours yet.')}</p>`;
      const n = [...marcadas.values()].reduce((s, m) => s + m.size, 0); el.querySelector('#pa_conta').textContent = n + ' ' + tr('entries ticked'); el.querySelector('#pa_ok').disabled = !n;
      el.querySelectorAll('#pa_lista [data-cat]').forEach(ch => ch.onchange = () => { const m = marcadas.get(ch.dataset.cat); const c = CATEGORIAS_PACOTE.find(x => x.k === ch.dataset.cat);
        if (ch.dataset.id) { const x = lista(c).find(y => String(y.id) === ch.dataset.id); if (x) { if (ch.checked) m.add(x.id); else m.delete(x.id); } } else { m.clear(); if (ch.checked) lista(c).forEach(x => m.add(x.id)); } pinta(); });
    };
    el.querySelector('#pa_base').onchange = async e => { base = meus.find(p => p.id === e.target.value) || null; pkBase = base ? await lerDaBiblioteca(base.id) : null;
      if (base) el.querySelector('#pa_nome').value = base.nome || ''; marcarDe(); pinta(); };
    el.querySelector('#pa_ok').onclick = async () => {
      const escolha = {}; CATEGORIAS_PACOTE.forEach(c => { const m = marcadas.get(c.k); escolha[c.k] = lista(c).filter(x => m.has(x.id)); });
      const nome = el.querySelector('#pa_nome').value.trim() || (base && base.nome) || tr('My creations');
      const pk = montarPacote(escolha, { nome, dependencias: el.querySelector('#pa_dep').checked, ...(base ? { id: base.id, edicao: edicaoDe() } : {}) });
      if (!contarPacote(pk)) return aviso(tr('Nothing to export.'));
      await anexarMidia(pk);
      if (!Arquivos.ativo) { await guardarNaBiblioteca(pk); marcarDoPacote(pk); }   // (the browser: the library keeps it, and the Workshop knows its entries are in it)
      else if (pk.id === MEU_PACOTE.id) await guardarNaBiblioteca(pk);
      fechar();
      if (typeof opcoes.depois === 'function') opcoes.depois(pk);
      publicarNoAcervo(pk);
    };
    if (opcoes.base) { const s = el.querySelector('#pa_base'); s.value = opcoes.base; s.onchange({ target: s }); } else pinta();
  }, true);
}

// ------------------------------------------------------------ the community packages (into the library)
async function abrirAcervoDePacotes(destaque) {
  const quer = new Set((destaque || []).map(q => q.id));   // (v241: the packages a work asked for, first and marked)
  modal(tr('Community packages'), `<p class="ajuda">${tr('Workshop packages shared by other authors. A package downloaded here goes into your library (⚙ → My packages), ready to add to any map or campaign.')}</p>${quer.size ? `<p class="aviso">${esc(tr('The packages marked are needed by the file you tried to open: download them, then open the file again.'))}</p>` : ''}<div id="ac_lista" class="listaPacote"><p class="ajuda">${tr('Asking the community library…')}</p></div>`, async (el, fechar) => {
    let indice;
    try { indice = (await lerIndiceDoAcervo()).filter(f => f.tipo === 'pacote').sort((a, b) => (quer.has(b.id) ? 1 : 0) - (quer.has(a.id) ? 1 : 0)); }
    catch (e) { el.querySelector('#ac_lista').innerHTML = `<p class="aviso">${tr('No connection to the community library')} (${esc(e.message || String(e))}).</p>`; return; }
    const pinta = async () => {
      const bib = await bibliotecaDePacotes();
      el.querySelector('#ac_lista').innerHTML = indice.length ? indice.map(f => { const tem = bib.find(p => p.id === f.id); const ed = tem ? tem.edicao : 0;
        return `<div class="catPacote fichaPacote${quer.has(f.id) ? ' pedido' : ''}" data-id="${esc(f.id)}"><div>${quer.has(f.id) ? `<span class="etq aviso">${esc(tr('needed'))}</span> ` : ''}<b data-sem-traducao>${esc(f.nome || f.id)}</b> <small>${tr('edition')} ${f.edicao}${f.conteudo?.entradas ? ' · ' + f.conteudo.entradas + ' ' + tr('entries') : ''}${f.autor ? ' · <span data-sem-traducao>' + esc(f.autor) + '</span>' : ''}${f.lingua ? ' · ' + imgsBandeira(f.lingua) : ''}</small>
          ${f.resumo ? `<br><small data-sem-traducao>${esc(f.resumo)}</small>` : ''}<br><small class="${ed && ed < f.edicao ? 'aviso' : 'ajuda'}">${!ed ? tr('not in your library') : ed < f.edicao ? tr('your library has edition') + ' ' + ed : tr('in your library')}</small></div>
          <div class="linha">${!ed || ed < f.edicao ? `<button class="sm primario" data-acao="baixar">${ed ? tr('Update') : tr('Download')}</button>` : ''}${ed && !Arquivos.ativo ? `<button class="sm" data-acao="usar">${tr('Add to this work…')}</button>` : ''}</div></div>`; }).join('')
        : `<p class="ajuda">${tr('The community library has no packages yet.')}</p>`;
      el.querySelectorAll('[data-acao]').forEach(bt => bt.onclick = async () => {
        const f = indice.find(x => x.id === bt.closest('[data-id]').dataset.id);
        if (bt.dataset.acao === 'usar') { const pk = await lerDaBiblioteca(f.id); if (pk) { fechar(); abrirImportacaoDePacote(pk); } return; }
        bt.disabled = true; bt.textContent = tr('Downloading…');
        try { const pk = await baixarPacoteDoAcervo(f);
          // (the app: into the Pacotes folder, with the files the mod reads, and into the Workshop)
          if (Arquivos.ativo) { const r = await instalarPerguntando(pk, pk._zip); tudo(); if (!$('#telaFichas').hidden) renderFichas(); aviso(tr('Package in the Workshop') + ': ' + (pk.nome || f.nome) + ' (' + r.n + ' ' + tr('entries') + ')'); }
          else { await guardarNaBiblioteca(pk); aviso(tr('Package in your library') + ': ' + (pk.nome || f.nome)); } }
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
  Object.defineProperty(pk, '_zip', { value: es, enumerable: false });   // (the files of the package, for the Pacotes folder of the app)
  await guardarImagensDoZip(es); await extrairImagens(pk.conteudo);   // (v240: its pictures into the store)
  return pk;
}

// ------------------------------------------------------------ the community library, from the header
function abrirAcervo() {
  const obra = campanha ? tr('this campaign') : tr('this map');
  modal(tr('Community library'), `<p class="ajuda">${tr('Like Valkyrie’s: players download maps and campaigns in the game (Community maps → Download maps), and the packages a map needs come along. Authors publish from here.')}</p>
    <div class="linha"><button class="primario" id="ac_obra">${tr('Publish')} ${esc(obra)}…</button><button id="ac_pacotes">${tr('Community packages…')}</button><button id="ac_meus">${tr('Publish one of my packages…')}</button></div>`, (el, fechar) => {
    el.querySelector('#ac_obra').onclick = () => { fechar(); publicarNoAcervo(); };
    el.querySelector('#ac_pacotes').onclick = () => { fechar(); abrirAcervoDePacotes(); };
    el.querySelector('#ac_meus').onclick = () => { fechar(); escolherPacoteParaPublicar(); };
  });
}
$('#btnAcervo').onclick = () => abrirAcervo();

/* ------------------------------------------------------------ v241: the packages a file requires
   A map or campaign names in "requires" the packages whose assets it uses ({id, edition, name}). It opens only when the
   packages are here, at that edition or a newer one (the app: the Pacotes folder; a browser: its library) */
async function pacotesQueFaltam(requires) {
  const req = Array.isArray(requires) ? requires.filter(q => q && q.id) : []; if (!req.length) return [];
  const tem = Arquivos.ativo ? (PACOTES_DA_PASTA || []).concat([{ id: MEU_PACOTE.id, edicao: MEU_PACOTE.edicao }]) : await bibliotecaDePacotes();
  return req.filter(q => { const p = tem.find(x => x.id === q.id); return !p || (p.edicao || 1) < (q.edition || q.edicao || 1); })
    .map(q => { const p = tem.find(x => x.id === q.id); return { id: q.id, edicao: q.edition || q.edicao || 1, nome: q.name || q.nome || q.id, tem: p ? p.edicao || 1 : 0 }; });
}
/* the window that says which packages a file needs, with the way to them (the community packages) */
function avisarPacotesQueFaltam(faltam, oque) {
  modal(tr('Packages needed'), `<p>${esc(oque === 'campanha' ? tr('This campaign needs these Workshop packages, with its assets:') : tr('This map needs these Workshop packages, with its assets:'))}</p>
    <ul>${faltam.map(q => `<li><b data-sem-traducao>${esc(q.nome)}</b> <small>(${esc(tr('edition'))} ${q.edicao}${q.tem ? ' · ' + esc(tr('you have edition')) + ' ' + q.tem : ''})</small></li>`).join('')}</ul>
    <p class="ajuda">${esc(tr('Get them first (the community library has the packages its authors published; a package file can also be imported in ⚙ → Import a package), then open the file again.'))}</p>
    <div class="botoes"><button class="primario" data-ac>${esc(tr('Community packages…'))}</button><button data-fecha>${esc(tr('Close'))}</button></div>`, (el, fechar) => {
    el.querySelector('[data-ac]').onclick = () => { fechar(); abrirAcervoDePacotes(faltam); };
    el.querySelector('[data-fecha]').onclick = fechar;
  });
}
