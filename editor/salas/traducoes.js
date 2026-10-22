/* Bigorna Rooms: a map (or a campaign) in several languages. Nothing changes until the author adds a language to the work
   (Map setup, or the campaign screen): the work keeps being written in its own language (meta.lingua, the original);
   each language added (meta.linguas) gets a table of translations, original text -> translated text (meta.traducoes).
   Two ways to write them: the Translations window (every text of the work, one language at a time) and the flags of the
   top bar, which switch the whole editor to that language: the text fields show and keep the translation, the original
   stays behind. On export, the file carries "languages" (the original first) and "translations": for each language, the
   texts of the file as exported (an exported text may differ from the typed one) and their translations, found by
   exporting the work once more in that language and pairing the texts that changed. The mod reads the language of the
   game (or the one the player picks on the card of the map) and swaps the texts as it loads the file. */
'use strict';

/* the keys of the work that hold a text the players read (names of things, texts of objects, triggers, scenes...) */
const CHAVES_TEXTO = new Set(['name', 'nome', 'plural', 'text', 'texto', 'textClick', 'textUse', 'textGasto', 'textoDepois', 'intro', 'description', 'descricao', 'desc',
  'regra', 'conclusao', 'vazio', 'fechado', 'response', 'title', 'titulo', 'contador', 'hint', 'defesa']);
/* what never is a text to translate (the generator's notes, the editor's own copy, ids, files, pictures, the tables themselves) */
const FORA_TEXTO = new Set(['gerado', 'bigornaSalas', 'traducoes', 'linguas', 'traducoesRever', 'escolhas', 'nomeJogo', 'imagemBase', 'logic', 'textureTab', 'speaker', 'cast', 'som', 'video',
  'audio', 'lembrarNome', 'img', 'imagem', 'retrato', 'modelo', 'arquivo', 'acaoExtra', 'musica', 'music', 'fundo', 'background']);
const ROTULO_CAMPO = { name: 'name', nome: 'name', plural: 'plural', text: 'text', texto: 'text', textClick: 'text when looked at', textUse: 'text when used', textGasto: 'text once used up',
  textoDepois: 'text afterwards', intro: 'introduction', description: 'description', descricao: 'description', desc: 'description', regra: 'special rule', conclusao: 'conclusion',
  vazio: 'text when every answer was used', fechado: 'text once closed', response: 'text after the answer', title: 'title', titulo: 'title', contador: 'counter', hint: 'hint', defesa: 'defense' };

const obraDaLingua = () => campanha || projeto;
const linguaOriginal = (ob = obraDaLingua()) => codigoDeLingua((ob && ob.meta && ob.meta.lingua) || linguaPadrao());
/* the languages added to the work (the original never among them) */
const linguasExtras = (ob = obraDaLingua()) => { if (!ob || !ob.meta) return []; const o = linguaOriginal(ob); return [...new Set((ob.meta.linguas || []).map(codigoDeLingua))].filter(l => l !== o && LINGUA_DE[l]); };
const linguasDaObra = (ob = obraDaLingua()) => [linguaOriginal(ob), ...linguasExtras(ob)];
function tabelaDe(l, criar, ob = obraDaLingua()) {
  const m = ob.meta; if (!m.traducoes || typeof m.traducoes !== 'object') { if (!criar) return {}; m.traducoes = {}; }
  if (!m.traducoes[l] || typeof m.traducoes[l] !== 'object') { if (!criar) return {}; m.traducoes[l] = {}; }
  return m.traducoes[l];
}

/* every text field of the work: cb(object, key, where) — the maps (rooms, objects, triggers, counters, events), the campaign
   (cards, scenes) and the Workshop */
function camposDeTexto(cb, ob = obraDaLingua()) {
  if (!ob) return;
  const anda = (x, onde, pular) => {
    if (Array.isArray(x)) { x.forEach(v => anda(v, onde)); return; }
    if (!x || typeof x !== 'object') return;
    const sala = Array.isArray(x.pecas) && Array.isArray(x.objetos);   // (the name of a room is the editor's, not the players')
    for (const k of Object.keys(x)) {
      if (FORA_TEXTO.has(k) || (pular && pular.has(k))) continue; const v = x[k];
      if (typeof v === 'string') { if (CHAVES_TEXTO.has(k) && v.trim() && !(sala && k === 'nome')) cb(x, k, onde); }
      else if (Array.isArray(v)) v.forEach((item, i) => anda(item, ondeDe(onde, k, item, i)));
      else if (v && typeof v === 'object') anda(v, ondeDe(onde, k, v, -1));
    }
  };
  const ondeDe = (onde, k, item, i) => {
    if (k === 'salas') return (onde ? onde + ' · ' : '') + tr('Room') + ' ' + (i + 1);
    if (k === 'objetos' && item) return onde + ' · ' + (item.name || nomeObj(item.type));
    if (k === 'contadores' && item) return (onde ? onde + ' · ' : '') + tr('Counter') + ' ' + (item.nome || '');
    if (k === 'eventos') return (onde ? onde + ' · ' : '') + tr('Rounds');
    if (k === 'bestiario') return tr('Workshop');
    if (k === 'monstros' && item) return onde + ' · ' + (item.nome || tr('Monster'));
    if (k === 'itens' && item) return onde + ' · ' + (item.nome || tr('Item'));
    if (k === 'dialogos') return tr('Scene');
    if (k === 'nos' && item) return tr('Card') + ' ' + (item.num || '');
    if (k === 'meta') return onde || tr('Map setup');
    return onde;
  };
  if (ob === campanha) {
    anda(ob, tr('Campaign'), new Set(['missoes', 'bestiario']));
    (ob.missoes || []).forEach((pm, i) => anda(pm, (pm.meta && pm.meta.name) || tr('Map') + ' ' + (i + 1), new Set(['bestiario'])));
    if (ob.bestiario) anda(ob.bestiario, tr('Workshop'));
  } else anda(ob, '');
}

/* the texts of the Workshop that go in the file (the entries changed or made by the author: the game's own come translated
   by the game); null when it cannot be told (then every one counts). Read with the work in its original language. */
function textosDaOficina() {
  try { const r = new Set(); const anda = x => { if (typeof x === 'string') r.add(x); else if (Array.isArray(x)) x.forEach(anda); else if (x && typeof x === 'object') Object.values(x).forEach(anda); }; anda(conteudoCustom()); return r; }
  catch (e) { return null; }
}
const ondeNaOficina = onde => !!onde && onde.startsWith(tr('Workshop'));

// ------------------------------------------------------------ the editor in another language (the flags of the top bar)
/* while LINGUA_EDICAO is set, the text fields of the work hold the translation (or the original, where there is none yet);
   _sombra keeps each field's original. Leaving writes what was typed into the table and puts the originals back. */
let LINGUA_EDICAO = null, _sombra = [], _obraSombra = null, _emVariante = false;
function entrarNaLingua(l) {
  if (LINGUA_EDICAO) sairDaLingua(true);
  const ob = obraDaLingua(); if (!ob || !l || codigoDeLingua(l) === linguaOriginal(ob)) return;
  const tab = tabelaDe(l, false, ob); _sombra = []; const doOficina = textosDaOficina();
  camposDeTexto((o, k, onde) => { const orig = o[k]; if (doOficina && ondeNaOficina(onde) && !doOficina.has(orig)) return; const t = Object.prototype.hasOwnProperty.call(tab, orig) ? tab[orig] : ''; const m = typeof t === 'string' && t.trim() ? t : orig; _sombra.push({ o, k, orig, m }); o[k] = m; }, ob);
  LINGUA_EDICAO = l; _obraSombra = ob;
}
function sairDaLingua(gravar = true) {
  if (!LINGUA_EDICAO) return;
  const tab = gravar && _obraSombra ? tabelaDe(LINGUA_EDICAO, true, _obraSombra) : null;
  for (const s of _sombra) {
    const a = s.o[s.k];
    if (tab && typeof a === 'string' && a !== s.m) { if (!a.trim() || a === s.orig) delete tab[s.orig]; else tab[s.orig] = a; }
    s.o[s.k] = s.orig;
  }
  _sombra = []; LINGUA_EDICAO = null; _obraSombra = null;
}
/* runs fn with the work in its original language (saving, exporting, publishing), then back to the language of the screen */
function comOriginal(fn) {
  if (!LINGUA_EDICAO || _emVariante) return fn();
  const l = LINGUA_EDICAO; sairDaLingua(true);
  try { return fn(); } finally { entrarNaLingua(l); }
}
/* fn with the work in language l, nothing kept (the second export, to pair the texts) */
function emVariante(l, fn) { _emVariante = true; entrarNaLingua(l); try { return fn(); } finally { sairDaLingua(false); _emVariante = false; } }
function trocarLinguaDeEdicao(l) {
  l = codigoDeLingua(l); if ((LINGUA_EDICAO || linguaOriginal()) === l) return;
  sairDaLingua(true); if (l !== linguaOriginal()) entrarNaLingua(l);
  tudo();
}

/* an original changed (a typo fixed in the original language): its translations follow it to the new text, marked to check */
let _vistos = new WeakMap(), _obraVista = null;
function acompanharOriginais() {
  const ob = obraDaLingua(); if (!ob || LINGUA_EDICAO || !linguasExtras(ob).length) { _obraVista = null; return; }
  if (_obraVista !== ob) { _vistos = new WeakMap(); _obraVista = ob; camposDeTexto((o, k) => { const m = _vistos.get(o) || {}; m[k] = o[k]; _vistos.set(o, m); }, ob); return; }
  const usados = new Set(); const mudados = [];
  camposDeTexto((o, k) => { usados.add(o[k]); const m = _vistos.get(o) || {}; if (m[k] !== undefined && m[k] !== o[k]) mudados.push([m[k], o[k]]); m[k] = o[k]; _vistos.set(o, m); }, ob);
  for (const [velho, novo] of mudados) for (const l of linguasExtras(ob)) {
    const tab = tabelaDe(l, false, ob); if (!Object.prototype.hasOwnProperty.call(tab, velho) || Object.prototype.hasOwnProperty.call(tab, novo) || usados.has(velho)) continue;
    tab[novo] = tab[velho]; delete tab[velho];
    const rv = ob.meta.traducoesRever = ob.meta.traducoesRever || {}; (rv[l] = rv[l] || {})[novo] = true; if (rv[l][velho]) delete rv[l][velho];
  }
}

// ------------------------------------------------------------ export: "languages" and "translations"
/* an id, a file, a date: never a text (an id made from a name changes with the language; the file keeps the original's) */
const pareceId = s => /^[a-z0-9][a-z0-9_.:\-\/]*$/.test(s) || /\.(dmap|dcamp|ogg|mp3|wav|mp4|webm|png|jpe?g|glb|gltf|obj)$/i.test(s) || /^@/.test(s);
function diffTextos(a, b, out = {}) {
  if (typeof a === 'string') { if (typeof b === 'string' && a !== b && a.trim() && b.trim() && !pareceId(a) && !Object.prototype.hasOwnProperty.call(out, a)) out[a] = b; return out; }
  if (Array.isArray(a)) { if (Array.isArray(b)) for (let i = 0; i < Math.min(a.length, b.length); i++) diffTextos(a[i], b[i], out); return out; }
  if (a && typeof a === 'object' && b && typeof b === 'object') for (const k of Object.keys(a)) { if (k === 'bigornaSalas' || k === 'translations' || k === 'languages') continue; diffTextos(a[k], b[k], out); }
  return out;
}
function comTraducoes(doc, refazer) {
  const ls = linguasExtras(); if (!ls.length || !doc) return doc;
  doc.languages = linguasDaObra(); doc.translations = {};
  for (const l of ls) doc.translations[l] = diffTextos(doc, emVariante(l, refazer));
  return doc;
}
{
  const base = montarDmap;
  montarDmap = function (p = projeto) { return comOriginal(() => { const d = base(p); return _emVariante ? d : comTraducoes(d, () => base(p)); }); };
}
{
  const base = montarDcamp;
  montarDcamp = function (reusar) { return comOriginal(() => { const r = base(reusar); if (!_emVariante) comTraducoes(r.dcamp, () => base().dcamp); return r; }); };
}
{
  const base = estadoAtual;
  // (in another language, a copy taken with the originals back in place: what is kept is always the original)
  estadoAtual = function () { return LINGUA_EDICAO && !_emVariante ? comOriginal(() => JSON.parse(JSON.stringify(base()))) : base(); };
}
{
  const base = aplicarEstado;
  aplicarEstado = function (e) { if (LINGUA_EDICAO) sairDaLingua(true); _obraVista = null; return base(e); };
}
{
  const base = guardarEstado;
  guardarEstado = function () { try { acompanharOriginais(); } catch (e) { console.warn(e); } return base(); };
}
{
  const base = montarPacote;
  montarPacote = function (...a) { return comOriginal(() => base(...a)); };
}
{
  // a map that becomes a campaign: its languages and translations go with it (the campaign is the work now)
  const base = criarCampanha;
  criarCampanha = function (...a) {
    if (LINGUA_EDICAO) sairDaLingua(true);
    const pm = projeto, r = base(...a);
    if (campanha && pm && pm.meta && (pm.meta.linguas || []).length && !(campanha.meta.linguas || []).length) {
      campanha.meta.linguas = pm.meta.linguas; campanha.meta.traducoes = pm.meta.traducoes || {}; if (pm.meta.traducoesRever) campanha.meta.traducoesRever = pm.meta.traducoesRever;
      delete pm.meta.linguas; delete pm.meta.traducoes; delete pm.meta.traducoesRever;
    }
    return r;
  };
}

// ------------------------------------------------------------ the languages of the work (Map setup, campaign screen)
function acrescentarLingua(l) {
  const ob = obraDaLingua(); l = codigoDeLingua(l); if (!LINGUA_DE[l] || l === linguaOriginal(ob)) return;
  ob.meta.linguas = [...new Set([...(ob.meta.linguas || []), l])]; tabelaDe(l, true, ob);
}
function tirarLingua(l) {
  const ob = obraDaLingua(); if (LINGUA_EDICAO === l) sairDaLingua(true);
  ob.meta.linguas = (ob.meta.linguas || []).filter(x => codigoDeLingua(x) !== l); if (ob.meta.traducoes) delete ob.meta.traducoes[l]; if (ob.meta.traducoesRever) delete ob.meta.traducoesRever[l];
  if (!ob.meta.linguas.length) { delete ob.meta.linguas; delete ob.meta.traducoes; delete ob.meta.traducoesRever; }
}
/* the row "Also in": the flags of the languages added (✕ takes one out), "+ language" and the Translations window */
function htmlLinguasDaObra(curto) {
  const ex = linguasExtras(), resto = LINGUAS.filter(x => x.cod !== linguaOriginal() && !ex.includes(x.cod));
  return `<div class="linguasObra"><span class="rotulo">${esc(tr('Also in'))}</span>${ex.map(l => `<span class="linguaExtra" data-sem-traducao>${imgBandeira(l, 15)} ${esc(LINGUA_DE[l].nome)} <button class="sm" data-tiralingua="${l}" title="${esc(tr('Take this language out (its translations go too)'))}">✕</button></span>`).join('')}
    <select data-poelingua data-sem-traducao><option value="">${esc(tr('+ language…'))}</option>${resto.map(x => `<option value="${x.cod}">${esc(x.nome)}${x.nome !== x.pt && IDIOMA === 'pt' ? ' · ' + esc(x.pt) : ''}</option>`).join('')}</select>
    ${ex.length ? `<button class="sm" data-traducoes>🌐 ${esc(tr('Translations…'))}</button>` : ''}</div>
    ${curto ? '' : `<p class="ajuda">${esc(ex.length ? tr('The players get the map in the language of their game when the map has it, or pick one on the card of the map; without it, the original.') : tr('One language is enough. Add another to translate the texts of the work (the original stays as it is).'))}</p>`}`;
}
function ligarLinguasDaObra(el, depois) {
  if (!el) return;
  el.querySelectorAll('[data-tiralingua]').forEach(b => b.onclick = () => { const l = b.dataset.tiralingua; const n = Object.keys(tabelaDe(l, false)).length; if (n && !confirm(tr('Take out the language and its translations?') + ' (' + LINGUA_DE[l].nome + ': ' + n + ')')) return; tirarLingua(l); depois(); tudo(); });
  const s = el.querySelector('[data-poelingua]'); if (s) s.onchange = () => { if (!s.value) return; acrescentarLingua(s.value); aviso(tr('Language added: translate the texts in the Translations window, or switch the editor to it with its flag in the top bar.')); depois(); tudo(); };
  const t = el.querySelector('[data-traducoes]'); if (t) t.onclick = () => abrirTraducoes();
}

// ------------------------------------------------------------ the flags of the top bar and the strip of the language being edited
{
  const base = renderCabecalho;
  renderCabecalho = function () {
    if (LINGUA_EDICAO && _obraSombra !== obraDaLingua()) sairDaLingua(true);   // another work was opened
    base();
    let caixa = document.getElementById('linguasEdicao');
    if (!caixa) { const ac = document.querySelector('header .acoes'); if (!ac) return; caixa = document.createElement('span'); caixa.id = 'linguasEdicao'; caixa.setAttribute('data-sem-traducao', ''); ac.insertBefore(caixa, ac.firstChild); }
    const ls = linguasExtras(); const atual = LINGUA_EDICAO || linguaOriginal();
    caixa.hidden = !ls.length;
    caixa.innerHTML = ls.length ? linguasDaObra().map(l => `<button class="sm bandeiraEdicao${l === atual ? ' ativo' : ''}" data-edlingua="${l}" title="${esc(tr(l === linguaOriginal() ? 'Edit in the original language' : 'Edit the texts in this language'))}: ${esc(LINGUA_DE[l].nome)}">${imgBandeira(l, 16)}</button>`).join('') : '';
    caixa.querySelectorAll('[data-edlingua]').forEach(b => b.onclick = () => trocarLinguaDeEdicao(b.dataset.edlingua));
    let faixa = document.getElementById('faixaLingua');
    if (!faixa) { const c = document.getElementById('centro'); if (!c) return; faixa = document.createElement('div'); faixa.id = 'faixaLingua'; c.appendChild(faixa); }
    faixa.hidden = !LINGUA_EDICAO;
    if (LINGUA_EDICAO) {
      const tab = tabelaDe(LINGUA_EDICAO, false, _obraSombra); const unicos = new Set(_sombra.map(s => s.orig)); const feitos = [...unicos].filter(o => tab[o] && tab[o].trim()).length;
      faixa.innerHTML = `${imgBandeira(LINGUA_EDICAO, 16)} <b>${esc(tr('Editing the texts in'))} ${esc(LINGUA_DE[LINGUA_EDICAO].nome)}</b> · ${feitos} ${esc(tr('of'))} ${unicos.size} ${esc(tr('translated'))} · <span>${esc(tr('Texts not translated yet show the original. What you add now (rooms, objects, triggers) takes its texts as originals: add new things in the original language.'))}</span> <button class="sm" data-voltalingua>${imgBandeira(linguaOriginal(), 14)} ${esc(tr('Back to the original'))}</button> <button class="sm" data-traducoes>🌐 ${esc(tr('Translations…'))}</button>`;
      faixa.querySelector('[data-voltalingua]').onclick = () => trocarLinguaDeEdicao(linguaOriginal());
      faixa.querySelector('[data-traducoes]').onclick = () => abrirTraducoes(LINGUA_EDICAO);
    }
  };
}

// ------------------------------------------------------------ the Translations window
/* the texts to translate, once each, in reading order, with where they are; the Workshop's only when the file carries them */
function textosParaTraduzir() {
  return comOriginal(() => {
    const doOficina = textosDaOficina(), vistos = new Map();
    camposDeTexto((o, k, onde) => {
      const t = o[k]; if (vistos.has(t)) return;
      if (doOficina && ondeNaOficina(onde) && !doOficina.has(t)) return;
      vistos.set(t, { texto: t, onde: (onde ? onde + ' · ' : '') + tr(ROTULO_CAMPO[k] || k) });
    });
    return [...vistos.values()];
  });
}
const csvCampo = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
function lerCsv(t) {
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; continue; }
    if (c === '"') aspas = true; else if (c === ',') { linha.push(campo); campo = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; } else campo += c; }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}
function abrirTraducoes(lingua) {
  const voltar = LINGUA_EDICAO; if (LINGUA_EDICAO) sairDaLingua(true);
  const ls = linguasExtras(); if (!ls.length) { if (voltar) entrarNaLingua(voltar); return aviso(tr('Add a language to the work first (Map setup, or the campaign screen).')); }
  let l = ls.includes(lingua) ? lingua : ls[0], soFaltam = false;
  const textos = textosParaTraduzir();
  const { fundo } = modal(tr('Translations'), `<div class="linha trCab"><label>${esc(tr('Language'))} <select id="tr_lingua" data-sem-traducao>${ls.map(x => `<option value="${x}">${esc(LINGUA_DE[x].nome)}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" id="tr_faltam"> ${esc(tr('Only the texts not translated yet'))}</label><span id="tr_conta" class="etq"></span>
      <button class="sm" id="tr_csv" title="${esc(tr('A file for a translator: one line per text, the original and the translation'))}">⇩ CSV</button><label class="sm botaoArquivo">⇧ CSV<input type="file" id="tr_ler" accept=".csv,text/csv" hidden></label></div>
    <p class="ajuda">${esc(tr('The original on the left, its translation on the right. A text left empty shows the original in the game. The same text in several places is translated once.'))}</p>
    <div id="tr_lista" data-sem-traducao></div>`, (el, fechar) => {
    const lista = el.querySelector('#tr_lista');
    const conta = () => { const tab = tabelaDe(l, false); const n = textos.filter(x => (tab[x.texto] || '').trim()).length; el.querySelector('#tr_conta').textContent = n + ' ' + tr('of') + ' ' + textos.length + ' ' + tr('translated'); };
    const pinta = () => {
      const tab = tabelaDe(l, false), rever = ((obraDaLingua().meta.traducoesRever || {})[l]) || {};
      const vis = textos.map((x, i) => ({ ...x, i })).filter(x => !soFaltam || !(tab[x.texto] || '').trim());
      lista.innerHTML = vis.length ? vis.map(x => `<div class="trLinha${rever[x.texto] ? ' rever' : ''}"><small>${esc(x.onde)}${rever[x.texto] ? ' · <b>' + esc(tr('the original changed: check the translation')) + '</b>' : ''}</small><div class="trPar"><div class="trOrig">${esc(x.texto)}</div><textarea data-tr="${x.i}" rows="${Math.min(6, Math.max(1, Math.ceil(x.texto.length / 60)))}" placeholder="${esc(LINGUA_DE[l].nome)}">${esc(tab[x.texto] || '')}</textarea></div></div>`).join('')
        : `<p class="ajuda">${esc(tr(textos.length ? 'Every text is translated.' : 'The work has no texts yet.'))}</p>`;
      lista.querySelectorAll('[data-tr]').forEach(t => t.oninput = () => { const x = textos[+t.dataset.tr]; const tb = tabelaDe(l, true); if (t.value.trim()) tb[x.texto] = t.value; else delete tb[x.texto];
        const rv = obraDaLingua().meta.traducoesRever; if (rv && rv[l] && rv[l][x.texto]) { delete rv[l][x.texto]; t.closest('.trLinha').classList.remove('rever'); } conta(); });
      conta();
    };
    el.querySelector('#tr_lingua').value = l;
    el.querySelector('#tr_lingua').onchange = e => { l = e.target.value; pinta(); };
    el.querySelector('#tr_faltam').onchange = e => { soFaltam = e.target.checked; pinta(); };
    el.querySelector('#tr_csv').onclick = () => { const tab = tabelaDe(l, false); baixarArquivo(slug(obraDaLingua().meta.name || 'map') + '-' + linguaOriginal() + '-' + l + '.csv', '﻿' + [[linguaOriginal(), l, tr('where')], ...textos.map(x => [x.texto, tab[x.texto] || '', x.onde])].map(r => r.map(csvCampo).join(',')).join('\r\n'), 'text/csv'); };
    el.querySelector('#tr_ler').onchange = async e => { const f = e.target.files[0]; if (!f) return; const linhas = lerCsv((await f.text()).replace(/^﻿/, '')); const conhecidos = new Set(textos.map(x => x.texto)); const tb = tabelaDe(l, true); let n = 0;
      linhas.slice(1).forEach(r => { if (r.length >= 2 && conhecidos.has(r[0]) && r[1].trim()) { tb[r[0]] = r[1]; n++; } }); aviso(tr('Translations read') + ': ' + n); pinta(); };
    pinta();
  }, true);
  // (closing the window: back to the language the editor was in, with what was typed here)
  const fim = () => { if (voltar && linguasExtras().includes(voltar)) entrarNaLingua(voltar); tudo(); };
  const obs = new MutationObserver(() => { if (!document.body.contains(fundo)) { obs.disconnect(); fim(); } }); obs.observe(document.body, { childList: true, subtree: true });
}
