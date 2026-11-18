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
   In English nothing of this is installed. The choice lives in localStorage['bigorna-idioma'] (a code of IDIOMAS); without it,
   the language picked in the installer or in the mod's panel (window.BIGORNA_IDIOMA, from bigorna-idioma.js, written by
   the mod next to the editor) decides, and without that the language of the game (`lang` at the root of the game data). */

const IDIOMAS = [['en', 'English'], ['pt', 'Português (Brasil)'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pl', 'Polski'], ['hu', 'Magyar'], ['cs', 'Čeština'], ['ru', 'Русский'], ['ko', '한국어'], ['zh-cn', '简体中文'], ['zh-tw', '繁體中文']];
const IDIOMAS_COD = IDIOMAS.map(x => x[0]);
const IDIOMA = (() => {
  // (v258, v259: the mod's one-shot generator says the language of the game, ?lingua=<code>: the interface is in Portuguese for
  //  pt and in English for the others; the texts of the map follow LINGUA_TEXTOS)
  // (v373: the editor in Spanish too; the one-shot generator page keeps pt / en for its interface, its texts follow LINGUA_TEXTOS)
  try { const s = location.search || ''; const m = /[?&]lingua=([a-z]{2}(?:-[a-z]{2})?)(&|$)/.exec(s);
    if (m) return /[?&]gerador=1(&|$)/.test(s) ? (m[1] === 'pt' ? 'pt' : 'en') : (IDIOMAS_COD.includes(m[1]) ? m[1] : 'en'); } catch { }
  try { const v = localStorage.getItem('bigorna-idioma'); if (IDIOMAS_COD.includes(v)) return v; } catch { }
  if (IDIOMAS_COD.includes(window.BIGORNA_IDIOMA)) return window.BIGORNA_IDIOMA;   // picked in the installer or in the mod's panel
  const l = (window.BIGORNA_JOGO || {}).lang;
  const c0 = typeof l === 'string' ? l.trim().toLowerCase().replace('_', '-') : ''; const c = c0.startsWith('zh') ? (/tw|hk|hant/.test(c0) ? 'zh-tw' : 'zh-cn') : c0.slice(0, 2);
  return IDIOMAS_COD.includes(c) ? c : 'en';
})();
/* v259: the language of the texts a map is written in (the generator): the editor's own (pt or en) or, in the mod's one-shot
   generator, any language of the game (?gerador=1&lingua=<code>). For a language other than pt and en, a text is its English
   one looked up in the table of that language (GERADOR_TRAD[<code>], from bigorna-gerador-<code>.js: the texts of the
   generator and of its stories, keyed by a hash of the English), the English when it is not there. A sentence made of pieces (a name drawn, a number) is looked up as its template: each piece already given by the table
   (the longest first, a whole word) becomes {s0}, {s1}…, each number {n0}, {n1}…, and the table's sentence gets them back.
   The pseudo-language qq marks every text it looks up (⟦…⟧) and the collector (window._coletaTrad) gets the templates:
   that is how the list to translate is made (tools/gerador_trad) */
const LINGUA_TEXTOS = (() => { try { const s = location.search || ''; const m = /[?&]lingua=([a-z]{2}(?:-[a-z]{2})?)(&|$)/.exec(s); if (m && /[?&]gerador=1(&|$)/.test(s)) return m[1]; } catch { } return IDIOMA; })();
const OUTRA_LINGUA = LINGUA_TEXTOS !== 'en' && LINGUA_TEXTOS !== 'pt';
/* the key of an English text in the tables: FNV-1a of the text, 8 hex digits */
const chaveDoTexto = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
/* the numbers of a text, outside its own marks ({vilao}, [n], <style=…>, {#var}), as {n0}, {n1}… */
const numerosDoModelo = (s, nums) => s.split(/(\{[^{}]*\}|\[[^\[\]]*\]|<[^<>]*>)/).map((p, i) => i % 2 ? p : p.replace(/\d+/g, d => '{n' + (nums.push(d) - 1) + '}')).join('');
const _pecasDadas = new Map();   // a text the table gave → its English (the pieces a later sentence may carry; v353: the English is the key of its sheet)
const _letra = /[\p{L}\p{N}]/u;
function modeloDoTexto(en) {
  const pecas = [], nums = []; let t = en;
  if (_pecasDadas.size) {
    const cands = [..._pecasDadas.keys()].filter(x => x.length < t.length && t.includes(x)).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
    for (const x of cands) { let i = 0, out = '', achou = false;
      while (true) { const k = t.indexOf(x, i); if (k < 0) break;
        const antes = k > 0 ? t[k - 1] : '', depois = t[k + x.length] || '';
        if ((antes && _letra.test(antes) && _letra.test(x[0])) || (depois && _letra.test(depois) && _letra.test(x[x.length - 1]))) { out += t.slice(i, k + 1); i = k + 1; continue; }
        let n = pecas.indexOf(x); if (n < 0) n = pecas.push(x) - 1; out += t.slice(i, k) + '\u0001' + String.fromCharCode(0x41 + n) + '\u0002'; i = k + x.length; achou = true; }
      if (achou) t = out + t.slice(i); }
  }
  // (the pieces numbered in the order they come in the sentence: the same sentence, the same template)
  const ordem = []; t.replace(/\u0001([A-Z])\u0002/g, (m, c) => { const k = c.charCodeAt(0) - 0x41; if (!ordem.includes(k)) ordem.push(k); return m; });
  t = numerosDoModelo(t, nums).replace(/\u0001([A-Z])\u0002/g, (m, c) => '{s' + ordem.indexOf(c.charCodeAt(0) - 0x41) + '}');
  return { t, pecas: ordem.map(k => pecas[k]), nums };
}
const _registrar = (en, saida) => { if (en.length < 3 || !saida) return; _pecasDadas.set(saida, en);
  const c = saida.charAt(0), C = c.toUpperCase(), l = c.toLowerCase(); if (C !== c) _pecasDadas.set(C + saida.slice(1), en); if (l !== c) _pecasDadas.set(l + saida.slice(1), en); };
const recomecarTraducao = () => _pecasDadas.clear();   // (at the start of each map)
/* a text in the language made from the table's (a template filled with names): a piece, too, for the sentences that carry it */
const pecaNaLingua = s => { if (OUTRA_LINGUA && typeof s === 'string' && (s.length >= 3 || (s.length >= 1 && /[\u1100-\u11ff\u3040-\u30ff\u3400-\u9fff\uac00-\ud7a3]/.test(s)))) _registrar('...', s); return s; };   // (v353: a short Korean or Chinese name is a whole word too)
const TRADZ = en => { if (!OUTRA_LINGUA || typeof en !== 'string' || !en) return en;
  const qq = LINGUA_TEXTOS === 'qq';
  const tab = !qq && typeof window !== 'undefined' && window.GERADOR_TRAD ? window.GERADOR_TRAD[LINGUA_TEXTOS] : null;
  if (!qq && !tab) return en;
  if (_pecasDadas.has(en)) return en;   // (a text the table already gave, passed again: it is in the language)
  if (tab) { const v = tab[chaveDoTexto(en)]; if (typeof v === 'string' && (v || /^\s*(the|an?)\s*$/i.test(en))) { _registrar(en, v); return v; } }   // (v370: an article the language has none for comes empty)
  const m = modeloDoTexto(en);
  if (qq) { if (typeof window !== 'undefined' && window._coletaTrad) window._coletaTrad(m.t, en); const o = '\u27e6' + en + '\u27e7'; _registrar(en, o); return o; }   // (a test language: every text it would look up comes marked)
  const v = m.t === en ? null : tab[chaveDoTexto(m.t)];
  if (typeof v !== 'string' || !v) { if (typeof window !== 'undefined' && window._faltaTrad) window._faltaTrad(m.t, en); return en; }   // (the tests count what is missing)
  // (v353: the marks of the language: ⟨s0:m=er|f=sie|n=es⟩ agrees with the piece, ⟨n0:one=…|few=…|many=…⟩ with the number,
  //  {s0:dat} asks for a form of the piece)
  const peca = (k, n) => k === 's' ? m.pecas[+n] : m.nums[+n];
  const r = v.replace(/\u27e8([sn])(\d+):([^\u27e9]*)\u27e9/g, (x, k, n, ops) => { const a = peca(k, n); if (a === undefined) return x; const o = rotuloNaLingua(a, ops, k === 'n'); return o == null ? x : o; })
    .replace(/\{([sn])(\d+)(?::([^{}]+))?\}/g, (x, k, n, f, i, t) => { const a = peca(k, n); if (a === undefined) return x; const r2 = k === 's' && f ? formaNaLingua(a, f) : a;
      // (a name the translation put at the start of a sentence gets the capital there; a fragment keeps its own start)
      return k === 's' && ((i === 0 && /^\P{Ll}/u.test(en)) || (i > 0 && /[.!?。！？]\s+$/.test(t.slice(0, i)))) ? r2.charAt(0).toUpperCase() + r2.slice(1) : r2; });
  _registrar(en, r); return r; };
/* v353: the grammar of the names in the other languages. A sheet per name and language (tools/gerador_trad/formas/<lang>.json,
   window.GERADOR_FORMAS[lang], keyed by the hash of the name's English, or by '=' and its text in the language): its gender (g),
   number (num: s or p), animate (anim), and the forms the sentences ask for, by the names of the language's own grammar (de: nom,
   ak, dat, gen; pl: mian, dop, cel, bier, narz, miejsc; fr: art, de, a…). A translated sentence asks for a form by {key:form}
   and for an agreement by ⟨key:label=text|label=text⟩ (the label: the gender of the name, pl for a plural, * for any; for a
   number, the plural categories of the language: one, few, many, other). With no sheet, Korean particles and Hungarian suffixes
   come by rule; any other form missing leaves the name as it is (the nominative). */
const _formas = () => (typeof window !== 'undefined' && window.GERADOR_FORMAS && window.GERADOR_FORMAS[LINGUA_TEXTOS]) || null;
function fichaDe(s) {
  const F = _formas(); s = String(s ?? ''); if (!F || !s) return null;
  const en = _pecasDadas.get(s); const baixa = s.charAt(0).toLowerCase() + s.slice(1);
  return (typeof en === 'string' && en !== '...' && F[chaveDoTexto(en)]) || F['=' + s] || F['=' + baixa] || F[chaveDoTexto(s)] || null;
}
// (Korean: the particle by the last syllable, with or without a final consonant; 으로/로 also takes 로 after ㄹ)
const PARTICULAS_KO = [['을', '를'], ['이', '가'], ['은', '는'], ['과', '와'], ['아', '야'], ['이나', '나'], ['이랑', '랑'], ['으로', '로'], ['이라는', '라는'], ['이에요', '예요']];
function particulaKo(s, f) {
  const par = PARTICULAS_KO.find(p => p.includes(f)); if (!par) return ['의', '에', '에서', '에게', '도', '만', '까지', '부터'].includes(f) ? s + f : null;   // (these do not change)
  const c = String(s).trim().slice(-1).charCodeAt(0);
  if (!(c >= 0xac00 && c <= 0xd7a3)) return s + par[0] + '(' + par[1] + ')';   // (not Hangul: both, as Korean writes it)
  const jong = (c - 0xac00) % 28;
  return s + (par[0] === '으로' ? (jong && jong !== 8 ? '으로' : '로') : (jong ? par[0] : par[1]));
}
// (Hungarian: the suffix by vowel harmony; a final a or e gets long before it)
const SUFIXOS_HU = { ba: ['ba', 'be'], ban: ['ban', 'ben'], bol: ['ból', 'ből'], ra: ['ra', 're'], rol: ['ról', 'ről'], nak: ['nak', 'nek'], hoz: ['hoz', 'hez', 'höz'], tol: ['tól', 'től'], val: ['val', 'vel'], ert: ['ért', 'ért'], ig: ['ig', 'ig'], nal: ['nál', 'nél'], on: ['on', 'en', 'ön'] };
function sufixoHu(s, f) {
  const suf = SUFIXOS_HU[f]; if (!suf) return null; let w = String(s); const ult = (w.split(/\s+/).pop() || '').toLowerCase();
  const tras = /[aáoóuú]/.test(ult), vogais = ult.match(/[aáeéiíoóöőuúüű]/g) || []; const uv = vogais[vogais.length - 1] || 'e';
  let k = tras ? 0 : /[öőüű]/.test(uv) ? 2 : 1; if (k >= suf.length) k = 1;
  let x = suf[k];
  if (f === 'val') { const di = /(cs|dz|gy|ly|ny|sz|ty|zs)$/i.exec(w); const fim = w.slice(-1);
    if (di) { w = w.slice(0, -2) + di[1][0] + di[1]; x = x.slice(1); }   // (a double letter: szekrény → szekrénnyel)
    else if (/[bcdfghjklmnprstvzy]/i.test(fim)) x = fim + x.slice(1); }   // (-val after a consonant doubles it: kard → karddal)
  const vogalFinal = /[aáeéiíoóöőuúüű]$/i.test(w);
  if (/a$/.test(w)) w = w.slice(0, -1) + 'á'; else if (/e$/.test(w)) w = w.slice(0, -1) + 'é';
  if (f === 'on' && vogalFinal) x = 'n';   // (-on after a vowel is just -n: almán, kapun)
  return w + x;
}
function formaNaLingua(s, f) {
  s = String(s ?? ''); if (!f) return s; const fi = fichaDe(s);
  let r = fi && typeof fi[f] === 'string' ? fi[f] : null;
  if (r == null && /^ko/.test(LINGUA_TEXTOS)) r = particulaKo(fi && fi.t || s, f);
  if (r == null && LINGUA_TEXTOS === 'hu') r = sufixoHu(fi && fi.t || s, f);
  if (r == null) return s;
  return /^\p{Lu}/u.test(s) && !/^\p{Lu}/u.test(r) ? r.charAt(0).toUpperCase() + r.slice(1) : r;
}
/* the option of an agreement mark: the labels of the name's sheet, from the most precise (fp, the gender in the plural) to the
   most general (*), else the first option; a number picks by the plural rules of the language. null: the mark has no labels (the Portuguese ⟨k:o|a⟩) */
const _plurais = {};
function rotuloNaLingua(s, ops, numero) {
  const itens = String(ops).split('|').map(x => { const i = x.indexOf('='); return i < 0 ? null : { l: x.slice(0, i).split(',').map(y => y.trim()), t: x.slice(i + 1) }; });
  if (!itens.length || itens.some(x => !x)) return null;
  let cand;
  if (numero || /^\d+$/.test(String(s).trim())) {
    const lg = LINGUA_TEXTOS.split('-')[0]; let pr = _plurais[lg]; try { pr = pr || (_plurais[lg] = new Intl.PluralRules(lg)); } catch { pr = null; }
    cand = [pr ? pr.select(+String(s).trim()) : 'other', 'other', '*'];
  } else {
    const fi = fichaDe(s) || {}; const g = String(fi.g || ''); const p = fi.num === 'p';
    cand = [];
    if (g) cand.push(g + (p ? 'p' : 's'));
    if (p) { if (fi.vir || g === 'mo') cand.push('vir'); cand.push('pl'); }
    if (g) { cand.push(g); if (g.length > 1) cand.push(g[0]); }
    if (fi.anim) cand.push('anim');
    if (!p) cand.push('sg');
    cand.push('*');
  }
  for (const c of cand) { const o = itens.find(x => x.l.includes(c)); if (o) return o.t; }
  return itens[0].t;   // (no label of the name: the first option)
}
/* texts written in both languages: L2(en, pt), T2({en, pt}), TXT of {en, pt} (a list: its first), LP() the key, EM the list
   of {en: [...], pt: [...]} in the language of the texts (the same length: a draw picks the same one in every language) */
const LP = () => LINGUA_TEXTOS === 'pt' ? 'pt' : 'en';
const L2 = (en, pt) => LINGUA_TEXTOS === 'pt' ? pt : OUTRA_LINGUA ? TRADZ(en) : en;
/* (v361: a translated template may ask for a form of what fills it, {0:dat}, {1:을}, or agree with it, ⟨0:f=…|*=…⟩, as it does
   with a name of the story) */
const _encherNumerados = (t, v) => String(t).replace(/\u27e8(\d+):([^\u27e9]*)\u27e9/g, (x, k, ops) => { if (v[+k] === undefined) return x; const o = rotuloNaLingua(String(v[+k]), ops, typeof v[+k] === 'number'); return o == null ? x : o; })
  .replace(/\{(\d+)(?::([^{}]+))?\}/g, (m, k, f) => v[+k] === undefined ? m : f && OUTRA_LINGUA ? formaNaLingua(v[+k], f) : v[+k]);
const LF = (en, pt, ...v) => { const r = _encherNumerados(L2(en, pt), v); return OUTRA_LINGUA ? pecaNaLingua(r) : r; };
const EM = x => { if (!x) return []; if (OUTRA_LINGUA) return Array.isArray(x[LINGUA_TEXTOS]) ? x[LINGUA_TEXTOS] : (x.en || []).map(TRADZ); return x[LP()] || x.en || []; };
/* a text that goes into the exported file (the players read it in the game): in the language of the work being exported
   (the original, or the language a translated copy is being exported in), not in the language of the editor */
const LE2 = (en, pt) => { if (OUTRA_LINGUA) return TRADZ(en); let l = '', o = ''; try { o = linguaOriginal(); l = LINGUA_EDICAO || o; } catch { l = o = IDIOMA; }
  // (a language other than these two keeps the original's text: only the author's own translations go into the file)
  if (!/^(pt|en)/.test(l || '')) l = o; return /^pt/.test(l || '') ? pt : en; };
const LEF = (en, pt, ...v) => { const r = _encherNumerados(LE2(en, pt), v); return OUTRA_LINGUA ? pecaNaLingua(r) : r; };
/* a pronoun (she, his…) that goes inside an English sentence looked up whole: it stays English there, so the table has the
   sentence with it (each language agrees it its own way); in Portuguese, the Portuguese */
const PRON = (en, pt) => LINGUA_TEXTOS === 'pt' ? pt : en;
const T2 = o => L2(o.en, o.pt);
const TXT = o => { if (typeof o === 'string') return o; if (OUTRA_LINGUA && o && o[LINGUA_TEXTOS] == null) { const v = o.en || ''; return TRADZ(Array.isArray(v) ? (v[0] || '') : v); }
  const v = o ? (o[OUTRA_LINGUA ? LINGUA_TEXTOS : LP()] || o.en || '') : ''; return Array.isArray(v) ? (v[0] || '') : v; };

const tr = (() => {
  if (IDIOMA === 'en') return s => s;

  // ------------------------------------------------------------ the dictionary (compiled on first use: idioma_<code>.js come after this file)
  let DIC = null;
  function compilar() {
    // (v374: one dictionary per language, idioma_<code>.js, each a const TR_<CODE>)
    // (v375: Portuguese inside the app; each other language in its own block of the page, <script type=text/plain
    //  id=bigorna-idioma-<code>>, parsed only here, when the editor is in it)
    let fonte = null;
    try { if (IDIOMA === 'pt') fonte = TR_PT;
      else { const el = document.getElementById('bigorna-idioma-' + IDIOMA); if (el) fonte = new Function(el.textContent + '\nreturn TR_' + IDIOMA.toUpperCase().replace('-', '_') + ';')(); } } catch (e) { console.error('dicionário ' + IDIOMA + ': ' + e); }
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
    'habilidade', 'weapon', 'arma', 'mat', 'item', 'monstro', 'missao', 'no', 'de', 'para', 'depois', 'ramo', 'cells', 'pos', 'marcador', 'desde', 'grupo',
    'dano', 'imune', 'mec']);   // (v376: a damage type, a condition, a trait of a monster: the game's names, shown translated)
  const ehIdentificador = v => /^[a-z]+(?:[_-][a-z0-9]+)+$/.test(v) || /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(v) || /^(?:B_|g[0-9a-z]{6,})/.test(v) || /^[A-Z0-9_]+$/.test(v);
  let usuario = new Set(), usuarioQuando = 0;
  function coletar() {
    const s = new Set();
    const guarda = (v, k) => { if (v.length > 0 && v.length < 240 && !TECNICAS.has(k) && !v.startsWith('data:') && !v.startsWith('imagens/') && !ehIdentificador(v)) s.add(v.trim()); };
    const anda = (x, k, prof) => {
      if (!x || prof > 30) return;
      if (Array.isArray(x)) { for (const y of x) { if (typeof y === 'string') guarda(y, k); else if (y && typeof y === 'object') anda(y, k, prof + 1); } return; }
      if (typeof x !== 'object') return;
      for (const c in x) { const v = x[c]; if (typeof v === 'string') guarda(v, c); else if (v && typeof v === 'object') anda(v, c, prof + 1); }
    };
    // (v237: the entries of other packages do not change: their strings are gathered once per set of packages)
    // (v239: in a campaign every map points to the same Workshop: it is walked once, not once per map)
    const jaVistos = new Set();
    const andaSemPacotes = (x, k, prof) => { if (x && typeof x === 'object' && !Array.isArray(x) && x._doPacote) return;
      if (k === 'bestiario' && x && typeof x === 'object') { if (jaVistos.has(x)) return; jaVistos.add(x); } if (Array.isArray(x)) { for (const y of x) { if (typeof y === 'string') guarda(y, k); else if (y && typeof y === 'object' && !y._doPacote) anda2(y, k, prof + 1); } return; } anda2(x, k, prof); };
    const anda2 = (x, k, prof) => { if (!x || prof > 30 || typeof x !== 'object') return; for (const c in x) { const v = x[c]; if (typeof v === 'string') guarda(v, c); else if (v && typeof v === 'object') andaSemPacotes(v, c, prof + 1); } };
    try { andaSemPacotes(campanha, '', 0); } catch { }
    try { if (!campanha) andaSemPacotes(projeto, '', 0); } catch { }
    try { const b = typeof oficina === 'function' ? oficina() : null; if (b) { let n = 0; Object.values(b).forEach(l => { if (Array.isArray(l)) l.forEach(x => { if (x && x._doPacote) n++; }); });
      if (n !== doPacotesN) { doPacotesN = n; const s0 = s; const tmp = new Set(); const guarda0 = (v, k) => { if (v.length > 0 && v.length < 240 && !TECNICAS.has(k) && !v.startsWith('data:') && !v.startsWith('imagens/') && !ehIdentificador(v)) tmp.add(v.trim()); };
        const anda0 = (x, k, prof) => { if (!x || prof > 30) return; if (Array.isArray(x)) { for (const y of x) { if (typeof y === 'string') guarda0(y, k); else if (y && typeof y === 'object') anda0(y, k, prof + 1); } return; } if (typeof x !== 'object') return; for (const c in x) { const v = x[c]; if (typeof v === 'string') guarda0(v, c); else if (v && typeof v === 'object') anda0(v, c, prof + 1); } };
        Object.values(b).forEach(l => { if (Array.isArray(l)) l.forEach(x => { if (x && x._doPacote) anda0(x, '', 1); }); }); doPacotesStr = tmp; }
      doPacotesStr.forEach(v => s.add(v)); } } catch { }
    return s;
  }
  let doPacotesN = -1, doPacotesStr = new Set();
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
      const partes = c.split(sep); let mudou = false; const fora = [];
      // (v374: a run of pieces that is a whole entry of the dictionary goes in one piece: an entry of two sentences joined
      //  to others in the same text)
      for (let i = 0; i < partes.length; i += 2) {
        let feito = false;
        for (let j = partes.length - 1; j > i + 1 && !feito; j -= 2) { const junto = partes.slice(i, j + 1).join(''); const v = DIC.exato.get(junto.trim());
          if (v !== undefined && !ehDoUsuario(junto.trim())) { fora.push(v); i = j; feito = mudou = true; if (i + 1 < partes.length) fora.push(partes[i + 1]); } }
        if (feito) continue;
        const t = trParte(partes[i], prof + 1); if (t !== partes[i]) mudou = true; fora.push(t); if (i + 1 < partes.length) fora.push(partes[i + 1]);
      }
      return mudou ? fora.join('') : c;
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
  try { await guardarEstado(); } catch { }
  try { if (typeof Auto !== 'undefined' && Auto.passo) await Promise.race([Auto.passo(true), new Promise(ok => setTimeout(ok, 1500))]); } catch { }
  try { localStorage.setItem('bigorna-idioma', v); } catch { }
  location.reload();
}
