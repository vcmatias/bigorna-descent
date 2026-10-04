'use strict';   // first file of the app script (montar_salas.py PARTES): this line makes the whole script strict
/* Bigorna Rooms: the language of the interface. The code writes its interface in English; in Portuguese the texts are
   swapped on the way to the screen, without touching the code that makes them:
   - tr(s): the Portuguese of an English interface text (the text itself in English, or when it is unknown): exact
     lookup, then the same text with its numbers and “quoted names” taken out ({n}, {q} in the dictionary), then the
     patterns of the dictionary (idioma_pt.js), then piece by piece (lines, " · ", "; ", sentences, ": ");
   - the page: a MutationObserver translates text nodes and the title / placeholder / aria-label / label attributes as
     they are written; alert, confirm, prompt, aviso and avisoLongo translate their message; texts drawn on a <canvas>
     are looked up (exact and numbers only, in capitals too, piece by piece around " · ").
   What the user wrote (names of maps, rooms, objects, monsters; texts of the scenes) is never translated: elements
   marked data-sem-traducao are skipped, the value and text of text fields too, and any text that is exactly one of the
   strings of the work in progress (projeto / campanha) is left as it is.
   In English nothing of this is installed. The choice lives in localStorage['bigorna-idioma'] ('en' | 'pt'); without it,
   the language picked in the installer or in the mod's panel (window.BIGORNA_IDIOMA, from bigorna-idioma.js, written by
   the mod next to the editor) decides, and without that the language of the game (`lang` at the root of the game data). */

const IDIOMAS = [['en', 'English'], ['pt', 'Português (Brasil)']];
const IDIOMA = (() => {
  try { const v = localStorage.getItem('bigorna-idioma'); if (v === 'en' || v === 'pt') return v; } catch { }
  if (window.BIGORNA_IDIOMA === 'pt' || window.BIGORNA_IDIOMA === 'en') return window.BIGORNA_IDIOMA;   // picked in the installer or in the mod's panel
  const l = (window.BIGORNA_JOGO || {}).lang;
  return typeof l === 'string' && /^pt/i.test(l) ? 'pt' : 'en';
})();
/* texts written in both languages: L2(en, pt), T2({en, pt}), TXT of {en, pt} (a list: its first), LP() the key */
const LP = () => IDIOMA === 'pt' ? 'pt' : 'en';
const L2 = (en, pt) => IDIOMA === 'pt' ? pt : en;
const T2 = o => L2(o.en, o.pt);
const TXT = o => { if (typeof o === 'string') return o; const v = o ? (o[LP()] || o.en || '') : ''; return Array.isArray(v) ? (v[0] || '') : v; };

const tr = (() => {
  if (IDIOMA === 'en') return s => s;

  // ------------------------------------------------------------ the dictionary (compiled on first use: idioma_pt.js comes after this file)
  let DIC = null;
  function compilar() {
    let fonte = null; try { fonte = TR_PT; } catch { }
    fonte = fonte || { exact: {}, patterns: [] };
    const exato = new Map(), modelos = new Map();
    for (const [k, v] of Object.entries(fonte.exact || {})) {
      if (typeof v !== 'string') continue;
      if (/\{[nq]\}/.test(k)) modelos.set(k, v); else exato.set(k, v);
    }
    DIC = { exato, modelos, padroes: (fonte.patterns || []).filter(p => p && p[0] instanceof RegExp), maiusc: null, maiuscModelos: null };
  }
  /* the canvas draws some labels in capitals (MAP 1, NARRATOR): the same entries, looked up in capitals */
  function compilarMaiusc() {
    DIC.maiusc = new Map(); DIC.maiuscModelos = new Map();
    for (const k of DIC.exato.keys()) { const u = k.toUpperCase(); if (u !== k && !DIC.exato.has(u)) DIC.maiusc.set(u, k); }
    for (const [k, v] of DIC.modelos) DIC.maiuscModelos.set(k.toUpperCase().replace(/\{N\}/g, '{n}').replace(/\{Q\}/g, '{q}'), v);
  }

  // ------------------------------------------------------------ what the user wrote: never translated
  /* keys of the work whose strings are identifiers, not text the user typed */
  const TECNICAS = new Set(['id', 'uid', 'tipo', 'type', 'tile', 'enemy', 'base', 'action', 'modo', 'fonte', 'como', 'alvo', 'cls', 'glifo', 'cor', 'arquivo', 'file',
    'retrato', 'imagem', 'icone', 'textura', 'textureTab', 'rostoBase', 'imagemBase', 'modelo', 'efeitoBase', 'comportamento', 'heroi', 'heroiBase', 'speaker', 'slot',
    'lado', 'kind', 'rangeType', 'alcance', 'condition', 'condicao', 'momento', 'mode', 'mec', 'tema', 'papel', 'tipoMaterial', 'classe', 'classes', 'arteModo',
    'somModo', 'quando', 'conta', 'acao', 'traits', 'music', 'musica', 'background', 'scene', 'tamanho', 'anchor', 'lang', 'video', 'som', 'cena', 'fundo', 'raridade',
    'habilidade', 'weapon', 'arma', 'mat', 'item', 'monstro', 'missao', 'no', 'de', 'para', 'depois', 'ramo', 'cells', 'pos', 'marcador', 'desde', 'grupo']);
  const ehIdentificador = v => /^[a-z]+(?:[_-][a-z0-9]+)+$/.test(v) || /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(v) || /^(?:B_|g[0-9a-z]{6,})/.test(v) || /^[A-Z0-9_]+$/.test(v);
  let usuario = new Set(), usuarioQuando = 0;
  function coletar() {
    const s = new Set();
    const guarda = (v, k) => { if (v.length > 0 && v.length < 240 && !TECNICAS.has(k) && !v.startsWith('data:') && !ehIdentificador(v)) s.add(v.trim()); };
    const anda = (x, k, prof) => {
      if (!x || prof > 30) return;
      if (Array.isArray(x)) { for (const y of x) { if (typeof y === 'string') guarda(y, k); else if (y && typeof y === 'object') anda(y, k, prof + 1); } return; }
      if (typeof x !== 'object') return;
      for (const c in x) { const v = x[c]; if (typeof v === 'string') guarda(v, c); else if (v && typeof v === 'object') anda(v, c, prof + 1); }
    };
    try { anda(campanha, '', 0); } catch { }
    try { if (!campanha) anda(projeto, '', 0); } catch { }
    return s;
  }
  /* rebuilt once per batch of changes (the DOM) or every half second (the canvas); a change empties the cache */
  function atualizarUsuario() {
    const novo = coletar(); usuarioQuando = performance.now();
    let igual = novo.size === usuario.size; if (igual) for (const v of novo) if (!usuario.has(v)) { igual = false; break; }
    if (!igual) { usuario = novo; cache.clear(); }
    return usuario;
  }
  const ehDoUsuario = t => usuario.has(t);

  // ------------------------------------------------------------ translation
  const cache = new Map();
  const RE_BORDAS = /^(\s*)([\s\S]*?)(\s*)$/;
  const RE_MODELO = /“[^“”]*”|"[^"\n]*"|\d+(?:[.,]\d+)*/g, RE_NUMEROS = /\d+(?:[.,]\d+)*/g;
  const RE_VAGAS = /\{([nqQ])(\d*)\}/g;
  /* separators of the pieces of a longer text, in order: lines, " · ", "; ", sentences, ": " */
  const SEPARADORES = [/(\n+)/, /( · )/, /(; )/, /(?<=[.!?…)])( +)(?=[A-Z“"(¿])/, /(: )/];

  function trParte(x, prof) {
    const m = RE_BORDAS.exec(x); const c = m[2];
    if (!c || ehDoUsuario(c)) return x;
    const t = nucleo(c, prof); return t === c ? x : m[1] + t + m[3];
  }
  function modelo(c, soNumeros, modelos = DIC.modelos) {
    const v = { n: [], q: [] };
    const chave = c.replace(soNumeros ? RE_NUMEROS : RE_MODELO, x => {
      if (x[0] === '“' || x[0] === '"') { v.q.push(x.slice(1, -1)); return x[0] + '{q}' + x[x.length - 1]; }
      v.n.push(x); return '{n}';
    });
    if (chave === c) return null;
    const alvo = modelos.get(chave); if (alvo === undefined) return null;
    const i = { n: 0, q: 0 };
    return alvo.replace(RE_VAGAS, (_, t, k) => {
      const lista = v[t === 'n' ? 'n' : 'q']; const x = k ? lista[+k - 1] : lista[i[t === 'n' ? 'n' : 'q']++];
      if (x === undefined) return '';
      return t === 'Q' && !ehDoUsuario(x) ? nucleo(x, 3) : x;
    });
  }
  function aplicar(rep, m, prof) {
    if (typeof rep === 'function') return rep(m, x => trParte(x || '', prof + 1));
    return rep.replace(/\$(T?)(\d)/g, (_, t, k) => { const x = m[+k] ?? ''; return t ? trParte(x, prof + 1) : x; });
  }
  function nucleo(c, prof) {
    let v = DIC.exato.get(c); if (v !== undefined) return v;
    if (!/[A-Za-z]/.test(c)) return c;
    if (DIC.modelos.size) { v = modelo(c, false); if (v === null) v = modelo(c, true); if (v !== null) return v; }
    for (const [re, rep] of DIC.padroes) { const m = re.exec(c); if (m) return aplicar(rep, m, prof); }
    if (prof < 4) for (const sep of SEPARADORES) {
      if (!sep.test(c)) continue;
      const partes = c.split(sep); let mudou = false;
      for (let i = 0; i < partes.length; i += 2) { const t = trParte(partes[i], prof + 1); if (t !== partes[i]) { partes[i] = t; mudou = true; } }
      return mudou ? partes.join('') : c;
    }
    return c;
  }
  function traduzir(s) {
    if (typeof s !== 'string' || !s) return s;
    const h = cache.get(s); if (h !== undefined) return h;
    if (!DIC) compilar();
    const m = RE_BORDAS.exec(s); let r = s;
    if (m[2] && /[A-Za-z]/.test(m[2])) { const t = nucleo(m[2], 0); if (t !== m[2]) r = m[1] + t + m[3]; }
    if (cache.size > 20000) cache.clear();
    cache.set(s, r); return r;
  }
  /* the canvas: exact and numbers only, in capitals too, piece by piece around " · " (drawn every frame: the result is
     cached; the strings of the work are looked at every half second) */
  const cacheTela = new Map();
  function pecaTela(c) {
    if (!c || !/[A-Za-z]/.test(c) || ehDoUsuario(c)) return null;
    let t = DIC.exato.get(c); if (t !== undefined) return t;
    if (DIC.modelos.size) { t = modelo(c, false) ?? modelo(c, true); if (t !== null) return t; }
    if (c === c.toUpperCase()) {
      if (!DIC.maiusc) compilarMaiusc();
      const k = DIC.maiusc.get(c); if (k !== undefined) return DIC.exato.get(k).toUpperCase();
      t = modelo(c, false, DIC.maiuscModelos) ?? modelo(c, true, DIC.maiuscModelos); if (t !== null) return t.toUpperCase();
    }
    return null;
  }
  function traduzirTela(s) {
    if (typeof s !== 'string' || !s) return s;
    if (performance.now() - usuarioQuando > 500) { const antes = usuario; atualizarUsuario(); if (usuario !== antes) cacheTela.clear(); }
    let r = cacheTela.get(s);
    if (r === undefined) {
      if (!DIC) compilar();
      r = s; const m = RE_BORDAS.exec(s);
      let t = pecaTela(m[2]);
      // the board writes the level after a label: "Door L1"
      if (t === null) { const n = / L(\d)$/.exec(m[2]); if (n) { const b = pecaTela(m[2].slice(0, -3)); if (b !== null) t = b + ' N' + n[1]; } }
      if (t === null && m[2].includes(' · ')) { let mudou = false; const ps = m[2].split(' · ').map(p => { const x = pecaTela(p); if (x === null) return p; mudou = true; return x; }); if (mudou) t = ps.join(' · '); }
      if (t !== null) r = m[1] + t + m[3];
      if (cacheTela.size > 5000) cacheTela.clear();
      cacheTela.set(s, r);
    }
    return r;
  }

  // ------------------------------------------------------------ the page
  const PULAR = 'script,style,textarea,code,[data-sem-traducao],[contenteditable=""],[contenteditable="true"]';
  const PULAR_ATTR = 'script,style,code,[data-sem-traducao]';   // a textarea's text is the user's, its placeholder and title are not
  /* elements whose own text is what the user wrote (previews of messages and scene boxes); their labels are children */
  const DADO = '.previaTx, .cenaResumo li, .quadro .texto, .cenaCx p';
  const ATRIBUTOS = ['title', 'placeholder', 'aria-label', 'label', 'value'];
  const escrito = new WeakMap();        // text node -> the text written last
  const escritoAttr = new WeakMap();    // element -> {attribute: value written last}
  const escritoAtalho = new WeakMap();  // label with an underlined key -> its text written last
  let precisaUsuario = true;            // the set of user strings is rebuilt at most once per batch
  const usuarioDoLote = () => { if (precisaUsuario) { precisaUsuario = false; atualizarUsuario(); } return usuario; };
  const ehOpcaoFixa = el => el && el.tagName === 'OPTION' && (!el.hasAttribute('value') || el.getAttribute('value') === el.textContent.trim());

  function textoNo(n) {
    const d = n.data; if (!d || escrito.get(n) === d || !/[A-Za-z]/.test(d)) return;
    const p = n.parentElement; if (p && p.matches(DADO) && !/^\s*\(.*\)\s*$/.test(d)) return;   // "(empty)" there is the editor's
    const u = usuarioDoLote();
    // the text of a template ("\n      " inside a paragraph) is shown with single spaces: looked up that way
    const t = traduzir(/\n\s/.test(d) ? d.replace(/\s+/g, ' ') : d); if (t === d || t.trim() === d.trim().replace(/\s+/g, ' ')) return;
    if (!ehOpcaoFixa(p) && u.has(d.trim())) return;
    // an option without a value answers with its text: its English text becomes its value before the text changes
    if (p && p.tagName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', p.textContent);
    escrito.set(n, t); n.data = t;
  }
  /* a label with its shortcut underlined (<u>T</u>ile): translated whole, the key underlined in the Portuguese word or
     added after it */
  function atalho(el) {
    const u = el.firstElementChild, letra = u.textContent;
    if (letra.length !== 1 || [...el.childNodes].some(x => x !== u && x.nodeType !== 3)) return;
    const txt = el.textContent.trim(); if (escritoAtalho.get(el) === txt) return;
    const t = traduzir(txt); if (t === txt) return;
    const i = t.toLowerCase().indexOf(letra.toLowerCase());
    const u2 = document.createElement('u'); u2.textContent = i >= 0 ? t[i] : letra;
    el.replaceChildren(...(i >= 0 ? [t.slice(0, i), u2, t.slice(i + 1)] : [t + ' (', u2, ')']).filter(x => x !== ''));
    el.childNodes.forEach(x => { if (x.nodeType === 3) escrito.set(x, x.data); });
    escritoAtalho.set(el, el.textContent.trim());
  }
  function atributo(el, a) {
    if (a === 'value' && !(el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type))) return;
    if (a === 'label' && el.tagName !== 'OPTGROUP' && el.tagName !== 'OPTION') return;
    const v = el.getAttribute(a); if (!v) return;
    const w = escritoAttr.get(el); if (w && w[a] === v) return;
    const u = usuarioDoLote();
    const t = traduzir(v); if (t === v) return;
    if (u.has(v.trim())) return;
    (w || escritoAttr.set(el, {}).get(el))[a] = t; el.setAttribute(a, t);
  }
  function elemento(el) {
    for (const a of ATRIBUTOS) if (el.hasAttribute(a)) atributo(el, a);
    if (el.childElementCount === 1 && el.firstElementChild.tagName === 'U') atalho(el);
  }
  const filtro = { acceptNode: n => { if (n.nodeType !== 1 || !n.matches(PULAR)) return NodeFilter.FILTER_ACCEPT; if (n.tagName === 'TEXTAREA' && !n.closest(PULAR_ATTR)) elemento(n); return NodeFilter.FILTER_REJECT; } };
  function varrer(raiz) {
    if (raiz.nodeType === 3) { const p = raiz.parentElement; if (p && !p.closest(PULAR)) textoNo(raiz); return; }
    if (raiz.nodeType !== 1) return;
    if (raiz.closest(PULAR)) { if (raiz.tagName === 'TEXTAREA' && !raiz.closest(PULAR_ATTR)) elemento(raiz); return; }
    elemento(raiz);
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filtro);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) textoNo(n); else elemento(n); }
  }
  function lote(regs) {
    precisaUsuario = true;
    for (const r of regs) {
      if (r.type === 'childList') { for (const n of r.addedNodes) if (n.isConnected) varrer(n); }
      else if (r.type === 'characterData') { const n = r.target; if (n.isConnected && escrito.get(n) !== n.data) { const p = n.parentElement; if (p && !p.closest(PULAR)) textoNo(n); } }
      else if (r.type === 'attributes') { const el = r.target; if (el.isConnected && !el.closest(PULAR_ATTR) && !(el.parentElement && el.parentElement.closest(PULAR))) atributo(el, r.attributeName); }
    }
  }
  const vigia = new MutationObserver(lote);
  vigia.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  queueMicrotask(() => { precisaUsuario = true; varrer(document.body); });
  document.documentElement.lang = 'pt-BR';

  // ------------------------------------------------------------ dialogs and toasts
  const alerta = window.alert, confirma = window.confirm, pergunta = window.prompt;
  window.alert = m => alerta.call(window, traduzir(m));
  window.confirm = m => confirma.call(window, traduzir(m));
  window.prompt = (m, v) => pergunta.call(window, traduzir(m), v);
  /* aviso and avisoLongo (base.js) are function declarations: they already exist here */
  try { const a0 = aviso; aviso = (t, longo) => a0(traduzir(t), longo); } catch { }
  try { const a1 = avisoLongo; avisoLongo = (t, ms) => a1(traduzir(t), ms); } catch { }

  // ------------------------------------------------------------ canvas
  const P = CanvasRenderingContext2D.prototype;
  const f0 = P.fillText, s0 = P.strokeText, m0 = P.measureText;
  P.fillText = function (t, ...r) { return f0.call(this, traduzirTela(t), ...r); };
  P.strokeText = function (t, ...r) { return s0.call(this, traduzirTela(t), ...r); };
  P.measureText = function (t) { return m0.call(this, traduzirTela(t)); };

  traduzir.tela = traduzirTela;   // what the canvas would draw (for tests)
  return traduzir;
})();

/* the language picked in ⚙ Settings: the work is kept first (as the editor keeps it every 2 s), then the page reloads */
async function mudarIdioma(v) {
  if (!IDIOMAS.some(x => x[0] === v) || v === IDIOMA) return;
  try { guardarEstado(); } catch { }
  try { if (typeof Auto !== 'undefined' && Auto.passo) await Promise.race([Auto.passo(true), new Promise(ok => setTimeout(ok, 1500))]); } catch { }
  try { localStorage.setItem('bigorna-idioma', v); } catch { }
  location.reload();
}
