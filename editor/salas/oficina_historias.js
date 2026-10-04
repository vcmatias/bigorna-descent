/* The Stories workshop (Workshop > Stories): the stories of the map generator (historias.js, made from
   editor/historias/bigorna-historias.json), family by family, element by element. Every text in English and Portuguese, the
   tags (factions, places, acts, premises), the carriers, the narrative metadata (function, what sets it off, what it
   causes, its consequences, the fields of its family) and its links to elements of other families with a strength; the
   links that come to it from others; the gaps of the whole file.
   What the user changes is kept in this browser (localStorage 'bigorna-historias', the same place as imported stories): a
   changed element replaces the one of the file in the generator, a new one joins the draw, one switched off leaves it.
   "Export" writes the whole file (the file plus the changes), ready to take the place of bigorna-historias.json. */
'use strict';
let histCaminho = 'pecas', histSel = null, histBusca = '';
const NOME_FAMILIA_HIST = { pecas: 'Pieces that unlock', ondas: 'Waves', escolta: 'Guides (escort)', resgate: 'Captives (rescue)', relogio: 'Clocks', viloes: 'Villains', fichas: 'Story tokens' };
const NOME_REGRA_HIST = { mercador: 'Merchant', aliado: 'Sellsword ally', rivais: 'Rival band', perseguidor: 'Pursuer', campeao: 'Champion', altares: 'Altars' };
/* the names of the fields, for the forms (a field not listed shows its own key) */
const ROTULO_CAMPO_HIST = { nome: 'Name', plural: 'Plural', singular: 'Singular', contador: 'Counter', olhar: 'Look (tapped with no hero)', revela: 'Line when the room is set up',
  achar: 'When found', conta: 'Counter line', objetivo1: 'Objective (one)', objetivoN: 'Objective (several)', trancado1: 'Locked (one)', trancadoN: 'Locked (several)', objetivo: 'Objective',
  trancado: 'Locked', teste: 'Test', cena: 'Scene', soa: 'When it sounds', onda: 'Each wave', ultima: 'Last wave', chama: 'Who it calls', ela: 'Feminine', quem: 'Who', motivo: 'Why',
  marco: 'Waystone', batidas: 'Beats', premio: 'Reward', premioMenor: 'Smaller reward', traicao: 'Betrayal', possessao: 'Possession', artigo: 'Article', todos: 'All found',
  missao: 'Mission', traidor: 'Traitor', lugares: 'Where they are held', abalo: 'Tremor', saidaOlhar: 'Exit: look', saidaRevela: 'Exit: line', intro: 'Intro', fadiga: 'Fatigue each round',
  fadigaIntro: 'Fatigue: intro', limiteIntro: 'Round limit: intro', limiteAviso: 'Round limit: warning', falas: 'Lines', uso: 'When used', item: 'Gives an item', ouro: 'Gold',
  modo: 'Mode', portadores: 'Carriers', reaproveita: 'May reuse an object of the room', veste: 'Is the object itself', antes: 'Before', pergunta: 'Question', stat: 'Attribute',
  text: 'Text', ok: 'Success', fail: 'Failure', sucessos: 'Successes', cumulativo: 'Cumulative', abre: 'Opens', semOuro: 'No gold', trago: 'Brought', contrato: 'Contract',
  recusa: 'Refusal', bando: 'Band', Bando: 'Band (capital)', lider: 'Leader', bolsa: 'Purse', chegada: 'Arrival', denovo: 'Again', boato: 'Rumour', fim: 'End', cai: 'Falls', entrada: 'Entrance',
  // the narrative block
  funcao: 'Function', fases: 'Phases', gatilhos: 'Set off by', gera: 'Causes', consequencias: 'Consequences', requer: 'Needs', ambientes_preferidos: 'Preferred places',
  ambientes_compativeis: 'Compatible places', faccoes_compativeis: 'Compatible factions', faccoes_incompativeis: 'Incompatible factions', tags: 'Tags', textos: 'Author guidance',
  perfil_especifico: 'Profile', relacoes_especificas: 'Specific relations', combina_com: 'Goes with', faccao: 'Faction', ambientes: 'Places', propositos: 'Purposes',
  gatilhos_preferidos: 'Preferred triggers', consequencias_preferidas: 'Preferred consequences', transicoes_preferidas: 'Preferred transitions',
  texto_narrativo_especifico: 'Author guidance (specific)', temas_narrativos: 'Narrative themes', pontes_intercategoriais: 'Links', personalidade_operacional: 'Operational personality',
  ativacoes_preferidas: 'Preferred activations', pos_onda: 'After the wave', causa_especifica: 'Specific cause', pode_ser_ativado_em: 'May start at', efeitos_narrativos: 'Narrative effects',
  funcao_profissional_especifica: 'Professional role', informacoes_que_pode_carregar: 'What they may know', complicacoes_possiveis: 'Possible complications',
  drama_especifico: 'Drama', marcos_preferidos: 'Preferred waystones', mote_narrativo: 'Motto', evidencias_anteriores: 'Earlier evidence', entrada_deve_retomar: 'Entrance must recall',
  informacao_especifica: 'Information', funcoes_preferidas: 'Preferred functions', descoberta: 'Discovery', acao: 'Action', consequencia: 'Consequence', ponte: 'Bridge' };
const rotuloHist = k => /^\d+$/.test(k) ? '#' + (+k + 1) : (ROTULO_CAMPO_HIST[k] || k);

// ------------------------------------------------------------ where things are
/* every list of the stories file, by path: the 7 families, the extra rules, the narrators and clues of each premise */
function caminhosHistorias() {
  const H = HISTORIAS;
  return FAMILIAS_NARRATIVAS.concat(Object.keys(H.regras || {}).map(k => 'regras.' + k), Object.keys(H.aberturas || {}).flatMap(k => ['aberturas.' + k + '.npcs', 'aberturas.' + k + '.pistas']));
}
function nomeCaminhoHist(c) {
  const p = c.split('.');
  if (p[0] === 'regras') return tr('Extra rule') + ': ' + tr(NOME_REGRA_HIST[p[1]] || p[1]);
  if (p[0] === 'aberturas') { const pr = (typeof PREMISSAS_MAPA !== 'undefined' ? PREMISSAS_MAPA : []).find(x => x.id === p[1]); return tr('Opening') + ' (' + (pr ? TXT(pr.nome) : p[1]) + '): ' + tr(p[2] === 'npcs' ? 'narrators' : 'clues'); }
  return tr(NOME_FAMILIA_HIST[c] || c);
}
/* a family whose items have no id (the champion's lines, the altars): edited as one whole list */
const baseHist = c => noCaminho(HISTORIAS, c) || [];
const listaSemIdHist = c => { const b = baseHist(c); return Array.isArray(b) && b.length && !b.some(x => x && x.id); };
const originalHist = (c, id) => (Array.isArray(baseHist(c)) ? baseHist(c) : []).find(x => x && x.id === id) || null;
/* the user's store (a copy: the cache of historiasImportadas is never changed in place) */
function lojaHist() { return clone(historiasImportadas() || {}); }
function gravarLojaHist(loja) { try { localStorage.setItem(CHAVE_HISTORIAS, JSON.stringify(loja)); return true; } catch { alert(tr('The stories could not be kept in this browser.')); return false; } }
function noCaminhoHist(loja, c, criar) { const p = c.split('.'); let o = loja; for (let i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== 'object') { if (!criar) return null; o[p[i]] = {}; } o = o[p[i]]; } return { pai: o, k: p[p.length - 1] }; }
/* the state of an element: 'original', 'changed', 'new', 'off' */
function estadoHist(c, el) { if (!el) return 'original'; const o = originalHist(c, el.id); if (el.desativado) return 'off'; if (!o) return 'new'; return JSON.stringify(o) === JSON.stringify(el) ? 'original' : 'changed'; }
/* keeps an element (or removes the change when it is the file's own again) */
function salvarHist(c, el) {
  const loja = lojaHist(); const n = noCaminhoHist(loja, c, true); let lista = Array.isArray(n.pai[n.k]) ? n.pai[n.k] : [];
  lista = lista.filter(x => x && x.id !== el.id); const o = originalHist(c, el.id);
  if (!o || JSON.stringify(o) !== JSON.stringify(el)) lista.push(el);
  if (lista.length) n.pai[n.k] = lista; else delete n.pai[n.k];
  return gravarLojaHist(loja);
}
function salvarListaInteiraHist(c, todos) { const loja = lojaHist(); const n = noCaminhoHist(loja, c, true); if (JSON.stringify(todos) === JSON.stringify(baseHist(c))) delete n.pai[n.k]; else n.pai[n.k] = { _todos: todos }; return gravarLojaHist(loja); }
function tirarDaLojaHist(c, id) { const loja = lojaHist(); const n = noCaminhoHist(loja, c, false); if (!n || !Array.isArray(n.pai[n.k])) return; n.pai[n.k] = n.pai[n.k].filter(x => x && x.id !== id); if (!n.pai[n.k].length) delete n.pai[n.k]; gravarLojaHist(loja); }
/* the links that come to an element from the others: [{ caminho, id, forca }] */
function pontesRecebidasHist(fam, id) {
  const r = []; FAMILIAS_NARRATIVAS.forEach(f => HIST(f).forEach(e => ((e.narrativa || {}).pontes_intercategoriais || []).forEach(p => { if (p.categoria === fam && p.id === id) r.push({ caminho: f, id: e.id, forca: p.forca || 0 }); })));
  return r.sort((a, b) => b.forca - a.forca);
}
const nomeElHist = e => { if (!e) return ''; const n = e.nome || e.singular || e.bando || e.olhar; return (n ? TXT(n) : '') || e.id || ''; };
/* the whole file, the user's changes in place: the same shape as bigorna-historias.json */
function historiasCompletas() {
  const H = clone(HISTORIAS);
  const r = { formato: 'bigorna-historias', versao: H.versao || 5 };
  FAMILIAS_NARRATIVAS.forEach(f => { r[f] = histCompleto(f); });
  r.regras = {}; Object.keys(H.regras || {}).forEach(k => { r.regras[k] = histCompleto('regras.' + k); });
  r.aberturas = {}; Object.keys(H.aberturas || {}).forEach(k => { r.aberturas[k] = { npcs: histCompleto('aberturas.' + k + '.npcs'), pistas: histCompleto('aberturas.' + k + '.pistas') }; });
  r.narrativa = gramaticaNarrativa(); if (H.fonte_versao != null) r.fonte_versao = H.fonte_versao; if (H.melhoria_textual) r.melhoria_textual = H.melhoria_textual;
  return clone(r);
}

// ------------------------------------------------------------ the workshop tab
function renderHistoriasOficina() {
  const caminhos = caminhosHistorias(); if (!caminhos.includes(histCaminho)) histCaminho = 'pecas';
  const semId = listaSemIdHist(histCaminho);
  const todos = semId ? [] : histCompleto(histCaminho); const busca = histBusca.trim().toLowerCase();
  const lista = todos.filter(e => !busca || JSON.stringify(e).toLowerCase().includes(busca));
  if (!semId && histSel && histSel !== '#relatorio' && histSel !== '#gramatica' && !todos.some(e => e.id === histSel)) histSel = null;
  const mudancas = Object.keys(historiasImportadas() || {}).length;
  const grupos = [[tr('Families'), FAMILIAS_NARRATIVAS], [tr('Extra rules'), caminhos.filter(c => c.startsWith('regras.'))], [tr('Openings'), caminhos.filter(c => c.startsWith('aberturas.'))]];
  $('#esqF').innerHTML = `<div class="bloco"><h2>Stories <span class="etq">${caminhos.length}</span></h2>
    <label class="campo">List <select id="hs_cam">${grupos.map(([g, cs]) => `<optgroup label="${esc(g)}">${cs.map(c => `<option value="${c}" ${c === histCaminho ? 'selected' : ''}>${esc(nomeCaminhoHist(c))} (${listaSemIdHist(c) ? histCompleto(c).length : HIST(c).length})</option>`).join('')}</optgroup>`).join('')}</select></label>
    ${semId ? '' : `<input id="hs_busca" placeholder="${esc(tr('Search (any text, id, tag…)'))}" value="${esc(histBusca)}"><div class="botoes"><button class="sm primario" id="hs_novo">+ New</button></div>`}
    <div id="hs_lista" data-sem-traducao></div>
    <div class="sub">${tr('The whole file')}</div>
    <div class="botoes"><button class="sm" id="hs_rel">Gaps report</button><button class="sm" id="hs_gram">Grammar</button></div>
    <div class="botoes"><button class="sm" id="hi_exp">Export the stories (JSON)</button><button class="sm" id="hi_imp">Import stories…</button></div>
    <div class="botoes"><button class="sm" id="hs_esq" ${mudancas ? '' : 'disabled'}>Forget my changes</button></div>
    <p class="ajuda">Changes are kept in this browser and used by the map generator at once. Export writes the whole file (with your changes) to replace editor/historias/bigorna-historias.json.</p></div>`;
  const l = $('#hs_lista');
  if (semId) l.innerHTML = `<p class="ajuda">${esc(tr('A list with no names: edited as a whole, on the right.'))}</p>`;
  lista.forEach(e => { const est = estadoHist(histCaminho, e); const np = ((e.narrativa || {}).pontes_intercategoriais || []).length;
    const d = document.createElement('div'); d.className = 'no' + (histSel === e.id ? ' ativo' : '') + (est === 'off' ? ' apagado' : '');
    d.innerHTML = `<div><div>${esc(nomeElHist(e))}</div><small>${esc(e.id)}${np ? ' · ' + np + ' ↔' : ''}${est !== 'original' ? ` · <b class="estHist estHist-${est}">${esc(tr({ changed: 'changed', new: 'new', off: 'off' }[est]))}</b>` : ''}</small></div>`;
    d.onclick = () => { histSel = e.id; renderHistoriasOficina(); }; l.appendChild(d); });
  if (!semId && !lista.length) l.innerHTML = `<p class="ajuda">${esc(tr('Nothing found.'))}</p>`;
  $('#hs_cam').onchange = e => { histCaminho = e.target.value; histSel = listaSemIdHist(histCaminho) ? '#lista' : null; renderHistoriasOficina(); };
  if ($('#hs_busca')) { const b = $('#hs_busca'); b.oninput = () => { histBusca = b.value; clearTimeout(b._t); b._t = setTimeout(() => { renderHistoriasOficina(); const n = $('#hs_busca'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); }; }
  if ($('#hs_novo')) $('#hs_novo').onclick = () => novoElementoHist();
  $('#hs_rel').onclick = () => { histSel = '#relatorio'; renderHistoriasOficina(); };
  $('#hs_gram').onclick = () => { histSel = '#gramatica'; renderHistoriasOficina(); };
  $('#hi_exp').onclick = () => baixarArquivo('bigorna-historias.json', JSON.stringify(historiasCompletas(), null, 1), 'application/json');
  $('#hi_imp').onclick = importarHistorias;
  $('#hs_esq').onclick = () => { if (!confirm(tr('Forget every change and every imported story? The stories of the file stay.'))) return; try { localStorage.removeItem(CHAVE_HISTORIAS); } catch { } renderHistoriasOficina(); };
  const c = $('#centroF');
  if (histSel === '#relatorio') return relatorioHist(c);
  if (histSel === '#gramatica') return gramaticaHist(c);
  if (semId) return listaInteiraHist(c);
  const el = todos.find(x => x.id === histSel);
  if (!el) { c.innerHTML = `<div class="vazio"><h2>Stories</h2><p>${esc(tr('The stories of the map generator: pick an element on the left. Every text, tag and narrative link of the generator is here.'))}</p></div>`; return; }
  fichaHist(c, el);
}
/* a new element: a copy of the one on screen (or of the first of the list), with its own id */
function novoElementoHist() {
  const modelo = histCompleto(histCaminho).find(x => x.id === histSel) || histCompleto(histCaminho)[0]; if (!modelo) return;
  let id = prompt(tr('Id of the new element (letters, numbers and hyphens):'), modelo.id + '-2'); if (!id) return; id = slug(id);
  if (histCompleto(histCaminho).some(x => x.id === id)) return alert(tr('This id is already in use.'));
  const novo = clone(modelo); novo.id = id; delete novo.desativado;
  if (salvarHist(histCaminho, novo)) { histSel = id; renderHistoriasOficina(); }
}

// ------------------------------------------------------------ the form of an element
const ehBilingueHist = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).every(k => k === 'en' || k === 'pt') && Object.values(v).every(x => typeof x === 'string' || Array.isArray(x));
const caminhoDeHist = k => k.split('|').map(x => /^\d+$/.test(x) ? +x : x);
function lerHist(o, k) { return caminhoDeHist(k).reduce((x, p) => x == null ? x : x[p], o); }
function porHist(o, k, v) { const p = caminhoDeHist(k); let x = o; for (let i = 0; i < p.length - 1; i++) x = x[p[i]]; x[p[p.length - 1]] = v; }
function tirarHist(o, k) { const p = caminhoDeHist(k); let x = o; for (let i = 0; i < p.length - 1; i++) x = x[p[i]]; if (Array.isArray(x)) x.splice(p[p.length - 1], 1); else delete x[p[p.length - 1]]; }
/* any value of an element as form fields (k: its path, "a|0|en") */
function camposHist(v, k, nivel = 0) {
  const nome = rotuloHist(String(k).split('|').pop());
  if (ehBilingueHist(v)) {
    const caixa = l => { const t = Array.isArray(v[l]) ? v[l].join('\n') : (v[l] || ''); return `<label class="campo"><small>${l.toUpperCase()}</small><textarea rows="${Math.min(6, Math.max(1, Math.ceil(t.length / 70)))}" data-hk="${esc(k + '|' + l)}" ${Array.isArray(v[l]) ? 'data-linhas="1"' : ''}>${esc(t)}</textarea></label>`; };
    return `<div class="campoHist"><div class="rotHist">${esc(tr(nome))}</div><div class="duas">${caixa('en')}${caixa('pt')}</div></div>`;
  }
  if (Array.isArray(v)) {
    if (v.every(x => typeof x === 'string' || typeof x === 'number')) return `<label class="campo campoHist"><span class="rotHist">${esc(tr(nome))}</span><input data-hk="${esc(k)}" data-lista="${v.length && v.every(x => typeof x === 'number') ? 'n' : 's'}" value="${esc(v.join(', '))}" placeholder="${esc(tr('separated by commas'))}"></label>`;
    return `<fieldset class="grupoHist"><legend>${esc(tr(nome))} <button class="sm" data-hadd="${esc(k)}" title="${esc(tr('Add one more (a copy of the last)'))}">+</button></legend>${v.map((x, i) => `<div class="itemHist">${camposHist(x, k + '|' + i, nivel + 1)}<button class="sm" data-hdel="${esc(k + '|' + i)}" title="${esc(tr('Remove'))}">✕</button></div>`).join('')}</fieldset>`;
  }
  if (v && typeof v === 'object') return `<fieldset class="grupoHist"><legend>${esc(tr(nome))}</legend>${Object.keys(v).map(kk => camposHist(v[kk], k + '|' + kk, nivel + 1)).join('')}</fieldset>`;
  if (typeof v === 'boolean') return `<label class="chk campoHist"><input type="checkbox" data-hk="${esc(k)}" data-bool="1" ${v ? 'checked' : ''}> ${esc(tr(nome))}</label>`;
  if (typeof v === 'number') return `<label class="campo campoHist"><span class="rotHist">${esc(tr(nome))}</span><input type="number" data-hk="${esc(k)}" data-num="1" value="${v}"></label>`;
  const t = v == null ? '' : String(v);
  return `<label class="campo campoHist"><span class="rotHist">${esc(tr(nome))}</span><textarea rows="${Math.min(5, Math.max(1, Math.ceil(t.length / 80)))}" data-hk="${esc(k)}">${esc(t)}</textarea></label>`;
}
/* the tags of an element: factions, places, acts, premises (an empty list fits all) */
function etiquetasHist(el) {
  const ops = { f: Object.keys(typeof FACCOES_MAPA !== 'undefined' ? FACCOES_MAPA : {}), t: Object.keys(typeof TEMAS_SALA !== 'undefined' ? TEMAS_SALA : {}).filter(t => t !== 'qualquer'), a: [1, 2], p: (typeof PREMISSAS_MAPA !== 'undefined' ? PREMISSAS_MAPA : []).map(p => p.id) };
  const nomes = { f: 'Factions', t: 'Places', a: 'Acts', p: 'Premises' };
  const nomeOp = (k, v) => k === 't' ? tr(TXT(TEMAS_SALA[v]?.nome || v)) : k === 'p' ? TXT((PREMISSAS_MAPA.find(p => p.id === v) || {}).nome || v) : k === 'a' ? (v === 1 ? tr('Act I') : tr('Act II')) : v;
  return Object.keys(ops).filter(k => Array.isArray(el[k])).map(k => `<div class="campoHist"><div class="rotHist">${esc(tr(nomes[k]))} <small>${esc(tr('(none ticked: any)'))}</small></div><div class="chipsHist">${ops[k].map(v => `<label class="chk"><input type="checkbox" data-htag="${k}" value="${v}" ${el[k].includes(v) ? 'checked' : ''}> ${esc(nomeOp(k, v))}</label>`).join('')}</div></div>`).join('');
}
/* the links of an element to the others, and those that come to it */
function pontesHist(el) {
  const ps = (el.narrativa || {}).pontes_intercategoriais || []; const vem = FAMILIAS_NARRATIVAS.includes(histCaminho) ? pontesRecebidasHist(histCaminho, el.id) : [];
  const opcoes = f => HIST(f).map(e => `<option value="${esc(e.id)}">${esc(nomeElHist(e))} (${esc(e.id)})</option>`).join('');
  const linha = (p, i) => `<tr><td><select data-hpf="${i}">${FAMILIAS_NARRATIVAS.map(f => `<option value="${f}" ${p.categoria === f ? 'selected' : ''}>${esc(nomeCaminhoHist(f))}</option>`).join('')}</select></td>
      <td><select data-hpi="${i}" data-sem-traducao>${opcoes(p.categoria).replace(`value="${esc(p.id)}"`, `value="${esc(p.id)}" selected`)}${elementoHistoria(p.categoria, p.id) ? '' : `<option value="${esc(p.id)}" selected>⚠ ${esc(p.id)}</option>`}</select></td>
      <td><input type="number" min="0" max="99" data-hpn="${i}" value="${p.forca || 0}" style="width:4em"></td><td><button class="sm" data-hpir="${i}" title="${esc(tr('Go to it'))}">→</button><button class="sm" data-hpdel="${i}" title="${esc(tr('Remove'))}">✕</button></td></tr>`;
  return `<div class="sub">${tr('Links to other families')} <span class="etq">${ps.length}</span></div>
    <p class="ajuda">${esc(tr('Candidate causes and consequences for the generator: the stronger the link, the likelier the two meet in a map.'))}</p>
    <table class="tabela tabHist"><tr><th>${tr('Family')}</th><th>${tr('Element')}</th><th>${tr('Strength')}</th><th></th></tr>${ps.map(linha).join('')}</table>
    <div class="botoes"><button class="sm" id="hs_padd">+ ${tr('Link')}</button></div>
    ${vem.length ? `<div class="sub">${tr('Links that come to it')} <span class="etq">${vem.length}</span></div><div class="chipsHist" data-sem-traducao>${vem.map(v => `<button class="sm" data-hvem="${esc(v.caminho + ':' + v.id)}">${esc(nomeElHist(elementoHistoria(v.caminho, v.id)))} <small>${esc(tr(NOME_FAMILIA_HIST[v.caminho] || v.caminho))} · ${v.forca}</small></button>`).join('')}</div>` : ''}`;
}
function fichaHist(c, el0) {
  const el = clone(el0); const est = estadoHist(histCaminho, el); const orig = originalHist(histCaminho, el.id);
  const textos = Object.keys(el).filter(k => !['id', 'f', 't', 'a', 'p', 'narrativa', 'desativado'].includes(k));
  c.innerHTML = `<div class="cabF"><h2><span data-sem-traducao>${esc(nomeElHist(el))}</span> <span class="etq ${est !== 'original' ? 'custom' : ''}">${esc(tr({ original: 'from the file', changed: 'changed', new: 'new', off: 'off' }[est]))}</span></h2>
      <div class="botoes"><button class="sm" id="hs_dup">Duplicate</button><button class="sm" id="hs_rest" ${est === 'changed' || (est === 'off' && orig) ? '' : 'hidden'}>Restore the file’s</button>
      ${est === 'new' ? '<button class="sm" id="hs_del">Delete</button>' : `<button class="sm" id="hs_off">${est === 'off' ? 'Switch on' : 'Switch off'}</button>`}</div></div>
    <p class="ajuda"><b>${esc(nomeCaminhoHist(histCaminho))}</b> · id <code data-sem-traducao>${esc(el.id)}</code>${est === 'off' ? ' · ' + esc(tr('switched off: the generator leaves it out')) : ''}</p>
    <div class="folha"><div class="col" data-sem-traducao>
      ${etiquetasHist(el) ? `<div class="sub">${tr('Tags')}</div>${etiquetasHist(el)}` : ''}
      <div class="sub">${tr('Texts and placement')}</div>
      <p class="ajuda">${esc(L2('Placeholders: {vilao} {lugar} {alvo} {n} {X} {limite} {desde}… In Portuguese, “de {vilao}” becomes “do …” by itself.', 'Marcadores: {vilao} {lugar} {alvo} {n} {X} {limite} {desde}… Em português, “de {vilao}” vira “do …” sozinho.'))}</p>
      ${textos.map(k => camposHist(el[k], k)).join('')}
    </div><div class="col" data-sem-traducao>
      ${el.narrativa ? `<div class="sub">${tr('Narrative')}</div>${pontesHist(el)}
        ${Object.keys(el.narrativa).filter(k => k !== 'pontes_intercategoriais').map(k => camposHist(el.narrativa[k], 'narrativa|' + k)).join('')}` : `<div class="sub">${tr('Narrative')}</div><p class="ajuda">${esc(tr('No narrative metadata yet.'))}</p><button class="sm" id="hs_narr">+ ${tr('Narrative metadata')}</button>`}
      <details class="jsonHist"><summary>${tr('JSON of the element')}</summary><textarea id="hs_json" rows="14" spellcheck="false">${esc(JSON.stringify(el, null, 1))}</textarea><div class="botoes"><button class="sm" id="hs_jsonok">${tr('Apply the JSON')}</button></div></details>
    </div></div>`;
  // (each change is kept at once; a change of structure (+, ✕, a family of a link) draws the form again)
  const guardar = (redesenhar) => { if (salvarHist(histCaminho, el) && redesenhar) renderHistoriasOficina(); else { const b = c.querySelector('.cabF .etq'); const e2 = estadoHist(histCaminho, el); if (b) { b.textContent = tr({ original: 'from the file', changed: 'changed', new: 'new', off: 'off' }[e2]); b.classList.toggle('custom', e2 !== 'original'); }
      const rb = $('#hs_rest'); if (rb) rb.hidden = !(e2 === 'changed' || (e2 === 'off' && orig)); } };
  c.querySelectorAll('[data-hk]').forEach(inp => {
    const ev = inp.dataset.bool ? 'onchange' : 'oninput';
    inp[ev] = () => { const k = inp.dataset.hk; let v;
      if (inp.dataset.bool) v = inp.checked; else if (inp.dataset.num) v = +inp.value || 0;
      else if (inp.dataset.lista) { v = inp.value.split(',').map(x => x.trim()).filter(Boolean); if (inp.dataset.lista === 'n') v = v.map(Number).filter(x => !isNaN(x)); }
      else if (inp.dataset.linhas) v = inp.value.split('\n'); else v = inp.value;
      porHist(el, k, v); clearTimeout(inp._t); inp._t = setTimeout(() => guardar(false), 300); };
  });
  c.querySelectorAll('[data-htag]').forEach(cb => cb.onchange = () => { const k = cb.dataset.htag; const val = k === 'a' ? +cb.value : cb.value; el[k] = el[k].filter(x => x !== val); if (cb.checked) el[k].push(val); guardar(false); });
  c.querySelectorAll('[data-hadd]').forEach(b => b.onclick = e => { e.preventDefault(); const a = lerHist(el, b.dataset.hadd); a.push(a.length ? clone(a[a.length - 1]) : ''); guardar(true); });
  c.querySelectorAll('[data-hdel]').forEach(b => b.onclick = e => { e.preventDefault(); tirarHist(el, b.dataset.hdel); guardar(true); });
  const ps = () => (el.narrativa.pontes_intercategoriais = el.narrativa.pontes_intercategoriais || []);
  c.querySelectorAll('[data-hpf]').forEach(s => s.onchange = () => { const p = ps()[+s.dataset.hpf]; p.categoria = s.value; p.id = (HIST(s.value)[0] || {}).id || ''; guardar(true); });
  c.querySelectorAll('[data-hpi]').forEach(s => s.onchange = () => { ps()[+s.dataset.hpi].id = s.value; guardar(false); });
  c.querySelectorAll('[data-hpn]').forEach(s => s.oninput = () => { ps()[+s.dataset.hpn].forca = Math.max(0, +s.value || 0); clearTimeout(s._t); s._t = setTimeout(() => guardar(false), 300); });
  c.querySelectorAll('[data-hpdel]').forEach(b => b.onclick = () => { ps().splice(+b.dataset.hpdel, 1); guardar(true); });
  c.querySelectorAll('[data-hpir]').forEach(b => b.onclick = () => { const p = ps()[+b.dataset.hpir]; if (!p) return; histCaminho = p.categoria; histSel = p.id; histBusca = ''; renderHistoriasOficina(); });
  c.querySelectorAll('[data-hvem]').forEach(b => b.onclick = () => { const [f, id] = b.dataset.hvem.split(':'); histCaminho = f; histSel = id; histBusca = ''; renderHistoriasOficina(); });
  if ($('#hs_padd')) $('#hs_padd').onclick = () => { const f = FAMILIAS_NARRATIVAS.find(x => x !== histCaminho) || 'fichas'; ps().push({ categoria: f, id: (HIST(f)[0] || {}).id || '', forca: 5 }); guardar(true); };
  if ($('#hs_narr')) $('#hs_narr').onclick = () => { el.narrativa = clone((HISTORIAS.narrativa && HISTORIAS.narrativa.elemento_narrativo) || { funcao: [], gera: [], consequencias: [] }); el.narrativa.pontes_intercategoriais = []; guardar(true); };
  $('#hs_dup').onclick = () => { histSel = el.id; novoElementoHist(); };
  if ($('#hs_rest')) $('#hs_rest').onclick = () => { if (!confirm(tr('Go back to the text of the file? Your changes to this element are lost.'))) return; tirarDaLojaHist(histCaminho, el.id); renderHistoriasOficina(); };
  if ($('#hs_del')) $('#hs_del').onclick = () => { if (!confirm(tr('Delete this new element?'))) return; tirarDaLojaHist(histCaminho, el.id); histSel = null; renderHistoriasOficina(); };
  if ($('#hs_off')) $('#hs_off').onclick = () => { if (el.desativado) delete el.desativado; else el.desativado = true; guardar(true); };
  $('#hs_jsonok').onclick = () => { let j; try { j = JSON.parse($('#hs_json').value); } catch (e) { return alert(tr('This is not valid JSON') + ': ' + e.message); }
    if (!j || typeof j !== 'object' || Array.isArray(j)) return alert(tr('This is not valid JSON')); if (j.id !== el.id) return alert(tr('The id cannot change here: duplicate the element instead.'));
    Object.keys(el).forEach(k => delete el[k]); Object.assign(el, j); guardar(true); };
}
/* a family with no ids (the champion's lines, the altars): one form for the whole list */
function listaInteiraHist(c) {
  const todos = clone(histCompleto(histCaminho)); const mudou = JSON.stringify(todos) !== JSON.stringify(baseHist(histCaminho));
  c.innerHTML = `<div class="cabF"><h2>${esc(nomeCaminhoHist(histCaminho))} <span class="etq ${mudou ? 'custom' : ''}">${esc(tr(mudou ? 'changed' : 'from the file'))}</span></h2>
    <div class="botoes"><button class="sm" id="hs_rest" ${mudou ? '' : 'hidden'}>Restore the file’s</button></div></div>
    <div class="folha"><div class="col" data-sem-traducao>${camposHist(todos, '_todos')}</div></div>`;
  const raiz = { _todos: todos }; const guardar = r => { salvarListaInteiraHist(histCaminho, raiz._todos); if (r) return renderHistoriasOficina();
    const m = JSON.stringify(raiz._todos) !== JSON.stringify(baseHist(histCaminho)); const b = c.querySelector('.cabF .etq'); if (b) { b.textContent = tr(m ? 'changed' : 'from the file'); b.classList.toggle('custom', m); } $('#hs_rest').hidden = !m; };
  c.querySelectorAll('[data-hk]').forEach(inp => inp.oninput = () => { let v = inp.value; if (inp.dataset.lista) v = v.split(',').map(x => x.trim()).filter(Boolean); else if (inp.dataset.linhas) v = v.split('\n');
    porHist(raiz, inp.dataset.hk, v); clearTimeout(inp._t); inp._t = setTimeout(() => guardar(false), 300); });
  c.querySelectorAll('[data-hadd]').forEach(b => b.onclick = e => { e.preventDefault(); const a = lerHist(raiz, b.dataset.hadd); a.push(a.length ? clone(a[a.length - 1]) : ''); guardar(true); });
  c.querySelectorAll('[data-hdel]').forEach(b => b.onclick = e => { e.preventDefault(); tirarHist(raiz, b.dataset.hdel); guardar(true); });
  if ($('#hs_rest')) $('#hs_rest').onclick = () => { const loja = lojaHist(); const n = noCaminhoHist(loja, histCaminho, false); if (n) delete n.pai[n.k]; gravarLojaHist(loja); renderHistoriasOficina(); };
}
/* the gaps of the whole file (with the user's changes) */
function relatorioHist(c) {
  const r = relatorioNarrativo(); const vai = s => { const [f, id] = s.split(' → ')[0].split(':'); return `<button class="sm" data-hir="${esc(f + ':' + id)}">${esc(s)}</button>`; };
  c.innerHTML = `<div class="cabF"><h2>${tr('Gaps report')}</h2></div><div class="folha"><div class="col">
    <p>${r.comNarrativa} / ${r.elementos} ${tr('elements')} · ${r.pontes} ${tr('links between families')} · ${r.soDeIda} ${tr('one-way links')}</p>
    <table class="tabela"><tr><th>${tr('Family')}</th><th>${tr('Elements')}</th><th>${tr('With metadata')}</th><th>${tr('Links')}</th><th>${tr('Mean strength')}</th></tr>${Object.entries(r.porFamilia).map(([f, x]) => `<tr><td>${esc(tr(NOME_FAMILIA_HIST[f] || f))}</td><td>${x.elementos}</td><td>${x.comNarrativa}</td><td>${x.pontes}</td><td>${x.forcaMedia}</td></tr>`).join('')}</table>
    <div class="sub">${tr('Broken links')} <span class="etq">${r.quebradas.length}</span></div><div class="chipsHist" data-sem-traducao>${r.quebradas.map(vai).join('') || '<span class="ajuda">—</span>'}</div>
    <div class="sub">${tr('Elements with no link')} <span class="etq">${r.semPontes.length}</span></div><div class="chipsHist" data-sem-traducao>${r.semPontes.map(vai).join('') || '<span class="ajuda">—</span>'}</div>
    <div class="sub">${tr('Elements with no narrative metadata')} <span class="etq">${r.semNarrativa.length}</span></div><div class="chipsHist" data-sem-traducao>${r.semNarrativa.map(vai).join('') || '<span class="ajuda">—</span>'}</div>
    </div><div class="col"><div class="sub">${tr('Gaps')} <span class="etq">${r.lacunas.length}</span></div><ul data-sem-traducao>${r.lacunas.map(x => `<li>${esc(x)}</li>`).join('') || '<li>—</li>'}</ul></div></div>`;
  c.querySelectorAll('[data-hir]').forEach(b => b.onclick = () => { const [f, id] = b.dataset.hir.split(':'); histCaminho = f; histSel = id; histBusca = ''; renderHistoriasOficina(); });
}
/* the grammar (arcs, events, transitions, pacing rules…): read here; changed as JSON */
function gramaticaHist(c) {
  const g = gramaticaNarrativa(); const mudou = !!(historiasImportadas() || {}).narrativa;
  c.innerHTML = `<div class="cabF"><h2>${tr('Narrative grammar')} <span class="etq ${mudou ? 'custom' : ''}">${esc(tr(mudou ? 'changed' : 'from the file'))}</span></h2><div class="botoes">${mudou ? '<button class="sm" id="hs_rest">Restore the file’s</button>' : ''}</div></div>
    <p class="ajuda">${esc(tr('Arcs, events, environment transitions, pacing rules and playbooks: the rules the generator follows to compose a story. Change them as JSON.'))}</p>
    <div class="folha"><div class="col" data-sem-traducao>${(g.arcos || []).map(a => `<p><b>${esc(a.id)}</b>: ${esc((a.padrao || []).join(' → '))}</p>`).join('')}
      ${g.regras_ritmo ? `<p><b>regras_ritmo</b>: ${esc(JSON.stringify(g.regras_ritmo))}</p>` : ''}</div>
    <div class="col"><textarea id="hs_gjson" rows="24" spellcheck="false">${esc(JSON.stringify(g, null, 1))}</textarea><div class="botoes"><button class="sm" id="hs_gok">${tr('Apply the JSON')}</button></div></div></div>`;
  $('#hs_gok').onclick = () => { let j; try { j = JSON.parse($('#hs_gjson').value); } catch (e) { return alert(tr('This is not valid JSON') + ': ' + e.message); }
    const loja = lojaHist(); if (JSON.stringify(j) === JSON.stringify(HISTORIAS.narrativa || {})) delete loja.narrativa; else loja.narrativa = j; gravarLojaHist(loja); renderHistoriasOficina(); };
  if ($('#hs_rest')) $('#hs_rest').onclick = () => { const loja = lojaHist(); delete loja.narrativa; gravarLojaHist(loja); renderHistoriasOficina(); };
}
/* a stories file (the whole file or a part): what differs from the file of the editor is kept as a change, what is new joins */
function importarHistorias() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then(t => {
    let j; try { j = JSON.parse(t); } catch { return alert(tr('This file is not a stories file.')); }
    if (!j || typeof j !== 'object' || (j.formato && j.formato !== 'bigorna-historias')) return alert(tr('This file is not a stories file.'));
    let n = 0; const loja = lojaHist();
    caminhosHistorias().forEach(c => { const lista = c.split('.').reduce((x, k) => x && x[k], j); if (!Array.isArray(lista)) return;
      if (listaSemIdHist(c)) { if (JSON.stringify(lista) !== JSON.stringify(histCompleto(c))) { const nn = noCaminhoHist(loja, c, true); nn.pai[nn.k] = { _todos: lista }; n++; } return; }
      lista.forEach(el => { if (!el || !el.id) return; const atual = histCompleto(c).find(x => x.id === el.id); if (atual && JSON.stringify(atual) === JSON.stringify(el)) return;
        const nn = noCaminhoHist(loja, c, true); const ls = Array.isArray(nn.pai[nn.k]) ? nn.pai[nn.k] : []; nn.pai[nn.k] = ls.filter(x => x.id !== el.id).concat(originalHist(c, el.id) && JSON.stringify(originalHist(c, el.id)) === JSON.stringify(el) ? [] : [el]); n++; }); });
    if (j.narrativa && JSON.stringify(j.narrativa) !== JSON.stringify(gramaticaNarrativa())) { loja.narrativa = j.narrativa; n++; }
    if (!gravarLojaHist(loja)) return;
    avisoLongo(tr('Stories imported') + ': ' + n, 5000); if (!$('#telaFichas').hidden && abaF === 'historias') renderHistoriasOficina(); }); };
  inp.click();
}
/* (the Stories button of the map generator opens the workshop tab) */
function abrirHistorias() { abrirFichas('historias'); }
/* (the workshop off for now: its tab hidden; see oficinaHistoriasAtiva in narrativa.js) */
{ const b = document.querySelector('[data-aba="historias"]'); if (b && !oficinaHistoriasAtiva()) b.style.display = 'none'; }
