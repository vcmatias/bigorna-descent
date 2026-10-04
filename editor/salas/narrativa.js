/* The narrative layer of the map generator. The stories file (historias.js, made from editor/historias/bigorna-historias.json)
   gives each element of a family (pieces, waves, guides, captives, clocks, villains, tokens) a block "narrativa": what it
   is for in a story (funcao, fases), what sets it off (gatilhos), what it causes (gera, consequencias), what it needs
   (requer), the family's own fields (a clock's cause and when it may start, what a captive knows, the drama of a guide, the
   evidence a villain leaves…) and its links to elements of other families with a strength (pontes_intercategoriais).
   HISTORIAS.narrativa is the grammar: arcs, events, environment transitions, pacing rules, playbooks.
   Step 1 (this file): the readers. Step 3 (gerador_mapas.js: escolherVilao, roteiroDe, cenaDoChefe): the opening is the
   anchor of the chain (cadeia_inicial), the villain is weighed by its links to it and to what the plan drew, and the boss
   scene takes the opening up again and answers it. The fields
   "textos" and "texto_narrativo_especifico" are guidance for the author, never text for the table. */
'use strict';
// ------------------------------------------------------------ the stories: the file and the user's changes
const CHAVE_HISTORIAS = 'bigorna-historias';
/* the Stories workshop (Workshop > Stories) is off for now: its tab, its button in the map generator and its hint are hidden,
   and the generator uses only the stories file (the changes kept in this browser wait, untouched). It comes back with
   localStorage 'bigorna-oficina-historias' = '1' (the tests turn it on so) */
const oficinaHistoriasAtiva = () => { try { return localStorage.getItem('bigorna-oficina-historias') === '1'; } catch { return false; } };
/* the value at a dotted path ('regras.mercador') of an object, or undefined */
const noCaminho = (o, caminho) => caminho.split('.').reduce((x, k) => x && x[k], o);
/* a family of skins by its path ('pecas', 'regras.mercador', 'aberturas.resgate.npcs'); the user's changes and imported
   stories (Workshop > Stories) join those of the file */
/* (the Stories workshop keeps the user's work in the same place: a changed element of the file replaces it, in its place in
   the list; a new one comes after; one switched off ("desativado") is left out; a family whose items have no id (the
   champion's lines, the altars) is kept whole, as { _todos: [...] }) */
const HIST = caminho => histCompleto(caminho).filter(x => !(x && x.desativado));
function histCompleto(caminho) { const base = noCaminho(HISTORIAS, caminho); const extra = noCaminho(historiasImportadas(), caminho);
  if (extra && !Array.isArray(extra) && Array.isArray(extra._todos)) return extra._todos;
  if (!Array.isArray(base) && !Array.isArray(extra)) return base || extra || [];
  const ext = Array.isArray(extra) ? extra.filter(x => x && x.id) : []; const ids = new Set((base || []).map(b => b && b.id).filter(Boolean));
  return (base || []).map(b => (b && b.id && ext.find(x => x.id === b.id)) || b).concat(ext.filter(x => !ids.has(x.id))); }
/* the user's changes and imported stories (Workshop > Stories), kept in this browser (read once per change) */
let _histCache = { bruto: null, v: {} };
function historiasImportadas() { if (!oficinaHistoriasAtiva()) return {}; let bruto = null; try { bruto = localStorage.getItem(CHAVE_HISTORIAS); } catch { }
  if (bruto === _histCache.bruto) return _histCache.v; let v = {}; try { v = JSON.parse(bruto || 'null') || {}; } catch { v = {}; } if (typeof v !== 'object') v = {};
  _histCache = { bruto, v }; return v; }

// ------------------------------------------------------------ the narrative layer
const FAMILIAS_NARRATIVAS = ['pecas', 'ondas', 'escolta', 'resgate', 'relogio', 'viloes', 'fichas'];
/* an element of a family (with the imported ones), or null */
function elementoHistoria(fam, id) { return (HIST(fam) || []).find(x => x && x.id === id) || null; }
/* the narrative block of an element (the element itself, or family + id), or null */
function narrativaDe(fam, id) { const e = fam && typeof fam === 'object' ? fam : elementoHistoria(fam, id); return (e && e.narrativa) || null; }
/* the grammar of the stories (arcs, events, transitions…), {} when the file has none */
function gramaticaNarrativa() { const u = historiasImportadas().narrativa; if (u && typeof u === 'object' && !Array.isArray(u)) return u;   // (changed in the Stories workshop)
  return (HISTORIAS.narrativa) || {}; }
/* the links of an element to elements of other families, strongest first: [{ categoria, id, forca, elemento }]. Only links to
   elements that exist; categoria: only that family; min: the weakest strength wanted */
function pontesDe(fam, id, opc = {}) {
  const n = narrativaDe(fam, id); if (!n) return [];
  return (n.pontes_intercategoriais || []).filter(p => p && (!opc.categoria || p.categoria === opc.categoria) && (p.forca || 0) >= (opc.min || 0))
    .map(p => ({ categoria: p.categoria, id: p.id, forca: p.forca || 0, elemento: elementoHistoria(p.categoria, p.id) })).filter(p => p.elemento)
    .sort((a, b) => b.forca - a.forca);
}
/* how strongly two elements are linked (either direction; 0 when not) */
function forcaEntre(famA, idA, famB, idB) {
  const de = (f1, i1, f2, i2) => ((narrativaDe(f1, i1) || {}).pontes_intercategoriais || []).filter(p => p.categoria === f2 && p.id === i2).reduce((m, p) => Math.max(m, p.forca || 0), 0);
  return Math.max(de(famA, idA, famB, idB), de(famB, idB, famA, idA));
}
/* what the stories file has and lacks: elements without a narrative block, links to elements that do not exist, elements
   with no link, one-way links, the parts of the grammar present. For the author (Workshop > Stories) and the tests */
function relatorioNarrativo() {
  const r = { elementos: 0, comNarrativa: 0, semNarrativa: [], pontes: 0, quebradas: [], semPontes: [], soDeIda: 0, porFamilia: {}, gramatica: Object.keys(gramaticaNarrativa()), lacunas: [] };
  FAMILIAS_NARRATIVAS.forEach(fam => { const lista = HIST(fam) || []; const f = r.porFamilia[fam] = { elementos: lista.length, comNarrativa: 0, pontes: 0, forcaMedia: 0 };
    let soma = 0;
    lista.forEach(e => { r.elementos++; const n = e.narrativa; if (!n) { r.semNarrativa.push(fam + ':' + e.id); return; } r.comNarrativa++; f.comNarrativa++;
      const ps = n.pontes_intercategoriais || []; if (!ps.length) r.semPontes.push(fam + ':' + e.id);
      ps.forEach(p => { r.pontes++; f.pontes++; soma += p.forca || 0;
        if (!elementoHistoria(p.categoria, p.id)) r.quebradas.push(fam + ':' + e.id + ' → ' + p.categoria + ':' + p.id);
        else if (!((narrativaDe(p.categoria, p.id) || {}).pontes_intercategoriais || []).some(q => q.categoria === fam && q.id === e.id)) r.soDeIda++; }); });
    f.forcaMedia = f.pontes ? Math.round(soma / f.pontes * 10) / 10 : 0; });
  // (what the generator will ask of the file and it does not give yet)
  const H = HISTORIAS;
  const semNarr = (lista, nome) => { const n = (lista || []).filter(x => !(x && x.narrativa)).length; if (n) r.lacunas.push(nome + ': ' + n + ' sem metadados narrativos'); };
  Object.entries(H.aberturas || {}).forEach(([k, v]) => { semNarr(v.npcs, 'aberturas.' + k + '.npcs'); semNarr(v.pistas, 'aberturas.' + k + '.pistas'); });
  // (a list of plain names, the champions: their metadata stand beside them, in the grammar's regras_especiais)
  const paralelo = k => ((gramaticaNarrativa().regras_especiais || {})[k] || {}).metadado_individual || {};
  Object.entries(H.regras || {}).forEach(([k, v]) => semNarr((v || []).filter(x => !(typeof x === 'string' && paralelo(k)[x])), 'regras.' + k));
  ['arcos', 'eventos', 'transicoes', 'regras_ritmo', 'causalidade'].forEach(k => { if (!r.gramatica.includes(k)) r.lacunas.push('gramática sem ' + k); });
  return r;
}
