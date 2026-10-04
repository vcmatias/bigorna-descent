/* Bigorna Rooms v2 — the campaign screen.
   Story flow: cards (Map n, Side quest n, Waypoint n, Dialogue n, Scene n) linked by arrows in the order the players live
   them. World map: where maps, side quests and waypoints sit, and how they are marked (main quest, side quest, narrative
   event, city visit). Boxes: double-click a dialogue or scene card to write its boxes in a flow of their own; a box may
   branch only when it asks a question. Data: `campanha` = {meta, intro, missoes[], nos[], dialogos[], bestiario}.
   nos[]: {id, num, nome, tipo:'map'|'side'|'travel'|'dialogue'|'scene', missao, dialogo (head box), coords, fluxo, descricao, depois[], auto, marcador,
     recompensas {items, materials, gold}}
   dialogos[]: {id, cena (card id), type:'normal'|'choice', speaker, title, text, cast[], background, options[{text, next, acoes[]}], depois[], fluxo, acoes[]} */
'use strict';

const MAPA_LIENZO = (MUNDO.map && MUNDO.map.canvas) || [1600, 900];
const OFICIAIS = [...(MUNDO.quests || []), ...(MUNDO.narrativeEvents || [])].filter(d => d.coords);
const FUNDO_PADRAO = 7;
const COR_NO = { map: '#e0a458', side: '#e5c15a', travel: '#69b4a1', dialogue: '#8fa8ff', scene: '#b48fe0' };
const NOME_TIPO = { map: 'Map', side: 'Side quest', travel: 'Waypoint', dialogue: 'Scene', scene: 'Scene' };
/* how a card shows up: only maps are quests (main or side); waypoints and scenes are narrative events or city visits */
const MARCADORES = [['main', 'Main quest'], ['side', 'Side quest'], ['narrative', 'Narrative event'], ['city', 'City visit']];
const MARCADORES_DO_MAPA = [['main', 'Main quest'], ['side', 'Side quest']];
const MARCADORES_DA_PARADA = [['narrative', 'Narrative event (a marker on the world map)'], ['city', 'City visit (happens when the party enters the city)']];
const MARCADORES_DA_CENA = [['narrative', 'Narrative event (plays at its point of the story)'], ['city', 'City visit (plays the next time the party enters the city)']];
const marcadoresDe = n => ehDialogo(n) ? MARCADORES_DA_CENA : n.tipo === 'travel' ? MARCADORES_DA_PARADA : MARCADORES_DO_MAPA;
const CARTAO = [176, 64], CAIXA = [200, 96];
const noMapaMundi = n => n.tipo === 'map' || n.tipo === 'side' || n.tipo === 'travel';
const ehAncora = noMapaMundi;
const ehDialogo = n => n.tipo === 'dialogue' || n.tipo === 'scene';
if (ARTE.worldmap) { const i = new Image(); i.onload = () => desenharC(); i.src = ARTE.worldmap; IMG['worldmap'] = i; }
const rostoDe = id => retratoDoPersonagem(PERSONAGENS_B().find(p => p.id === id));

let abaC = 'fluxo';                   // fluxo | mundo | caixas
let cenaAberta = null;                // card whose boxes are open
let noSel = null, caixaSel = null;
const vistaC = { zoom: 1, px: 40, py: 40 };
let arrastoC = null, movendoNo = null, ligando = null, ligacao = null, mouseC = null, portaOpcao = null;
/* the arrow picked in the links popup (drawn highlighted): {de, para, op} */
let setaDestacada = null;
let estradaNova = null, colocandoCidade = false, movendoCidade = null, estradaRealce = -1;   // roads and the city on the campaign's own world map
const ehSetaDestacada = (de, para, op) => !!setaDestacada && setaDestacada.de === de && setaDestacada.para === para && (setaDestacada.op ?? null) === (op ?? null);

// ------------------------------------------------------------ data helpers
/* the campaign progression a map sets for the balanced spawns (Map setup → Balancing) */
const progressoDoMapa = m => m ? regraDoBalanceio(m).progresso : '?';
function idUnico(base, usados) { let id = base, n = 2; while (usados.includes(id)) id = base + '-' + (n++); return id; }
function noDaMissao(i) { return campanha ? campanha.nos.find(n => n.missao === i) : null; }
function noPorId(id) { return campanha.nos.find(n => n.id === id); }
function caixaPorId(id) { return campanha.dialogos.find(d => d.id === id); }
function caixasDaCena(n) { return n ? campanha.dialogos.filter(d => d.cena === n.id) : []; }
function proximoNum(tipo) { return campanha.nos.filter(n => n.tipo === tipo).reduce((m, n) => Math.max(m, n.num || 0), 0) + 1; }
function rotuloDoNo(n) { return NOME_TIPO[n.tipo] + ' ' + (n.num || '?'); }
function nomeDoNo(n) {
  if (n.missao !== null && n.missao !== undefined && campanha.missoes[n.missao] && campanha.missoes[n.missao].meta.name) return campanha.missoes[n.missao].meta.name;
  return n.nome || rotuloDoNo(n);
}
function novoNo(tipo, missao) {
  const ids = campanha.nos.map(n => n.id);
  const n = { id: idUnico(tipo + '-' + proximoNum(tipo), ids), num: proximoNum(tipo), nome: '', tipo, missao: tipo === 'map' || tipo === 'side' ? missao : null, dialogo: null,
    coords: [0, 0], fluxo: null, descricao: '', depois: [], auto: true, marcador: tipo === 'side' ? 'side' : tipo === 'map' ? 'main' : 'narrative', recompensas: { items: [], materials: 0 } };
  const k = campanha.nos.filter(noMapaMundi).length; n.coords = [-500 + (k % 6) * 180, 250 - Math.floor(k / 6) * 140];
  campanha.nos.push(n);
  if (ehDialogo(n)) { const d = novaCaixa(n); n.dialogo = d.id; if (tipo === 'scene') { let ant = d; for (let i = 1; i < 4; i++) { const c = novaCaixa(n); c.depois = [ant.id]; ant = c; } } }
  return n;
}
function novaCaixa(n) {
  const k = caixasDaCena(n).length;
  const d = { id: idUnico('box-' + slug(n.id) + '-' + (k + 1), campanha.dialogos.map(x => x.id)), cena: n.id, type: 'normal', speaker: '', title: '', text: '', cast: [], background: FUNDO_PADRAO, options: [], depois: [], fluxo: [k * 240, 0], acoes: [] };
  campanha.dialogos.push(d); return d;
}
function inserirNo(tipo, missao) {
  if (tipo === 'scene') tipo = 'dialogue';
  const n = novoNo(tipo, missao);
  const s = noSel && noPorId(noSel);
  if (s && s !== n) n.depois = [s.id]; else { const ultimo = campanha.nos.filter(x => x !== n).slice(-1)[0]; if (ultimo) n.depois = [ultimo.id]; }
  arrumarFluxo(false); return n;
}
function normalizarCampanha(c) {
  c.nos = c.nos || []; c.dialogos = c.dialogos || []; c.escolhas = (c.escolhas || []).filter(x => x && x.nome);
  // dialogues and scenes are one kind now ("Scene"): the old scenes join the numbering
  if ((c.nos || []).some(n => n.tipo === 'scene')) { let k = 0; c.nos.forEach(n => { if (n.tipo === 'scene' || n.tipo === 'dialogue') { n.tipo = 'dialogue'; n.num = ++k; } }); } c.intro = c.intro || ''; c.meta = c.meta || { name: '', author: '', description: '' }; c.bestiario = c.bestiario || { monstros: [], personagens: [], itens: [] };
  c.missoes.forEach((m, i) => { let n = c.nos.find(x => x.missao === i); if (!n) { n = novoNo('map', i); const ant = c.nos.find(x => x.missao === i - 1); if (ant) n.depois = [ant.id]; } n.recompensas = n.recompensas || { items: [], materials: 0 }; n.depois = n.depois || []; });
  c.nos = c.nos.filter(n => ehDialogo(n) || n.tipo === 'travel' || c.missoes[n.missao]);
  c.nos.forEach(n => { if (n.tipo === 'event') n.tipo = 'travel'; if (!n.marcador || !marcadoresDe(n).some(([v]) => v === n.marcador)) n.marcador = n.tipo === 'side' ? 'side' : n.tipo === 'map' ? 'main' : 'narrative'; });
  c.nos.forEach(n => { if (!n.num) n.num = proximoNum(n.tipo); });
  // older boxes: chained by "next" and hung on a card by its head; now every box belongs to a card (cena) and links by depois
  c.dialogos.forEach(d => { d.cast = d.cast || []; d.options = d.options || []; if (d.background === undefined) d.background = FUNDO_PADRAO; d.type = d.type === 'cutscene' ? 'video' : (d.type || 'normal'); d.depois = d.depois || []; d.acoes = d.acoes || []; d.options.forEach(o => { o.acoes = o.acoes || []; if (o.then) { o.then.forEach(a => { if (a.action === 'showDialogue') o.next = o.next || a.dialogue; else o.acoes.push(a); }); delete o.then; } }); });
  c.nos.filter(ehDialogo).forEach(n => {
    const cabeca = caixaPorId(n.dialogo); if (!cabeca) { const d = novaCaixa(n); n.dialogo = d.id; return; }
    if (!cabeca.cena) { let d = cabeca, k = 0; const vistos = new Set(); while (d && !vistos.has(d.id)) { vistos.add(d.id); d.cena = n.id; d.fluxo = d.fluxo || [k++ * 240, 0]; const prox = d.next ? caixaPorId(d.next) : null; if (prox && !prox.cena) { prox.depois = [d.id]; } delete d.next; d = prox; } }
  });
  c.dialogos = c.dialogos.filter(d => d.cena && c.nos.some(n => n.id === d.cena));
  c.dialogos.forEach(d => { if (!d.fluxo) d.fluxo = [0, 0]; });
  arrumarFluxo(false);
}
function arrumarFluxo(forcar) {
  const nos = campanha.nos; const prof = {};
  const calc = (n, vistos) => { if (prof[n.id] !== undefined) return prof[n.id]; if (vistos.has(n.id)) return 0; vistos.add(n.id); const ants = (n.depois || []).map(noPorId).filter(Boolean); prof[n.id] = ants.length ? 1 + Math.max(...ants.map(a => calc(a, vistos))) : 0; return prof[n.id]; };
  nos.forEach(n => calc(n, new Set()));
  const linhas = {};
  nos.forEach(n => { if (n.fluxo && !forcar) return; const d = prof[n.id]; linhas[d] = (linhas[d] || 0); let y = linhas[d]; if (!forcar) { while (nos.some(m => m !== n && m.fluxo && Math.abs(m.fluxo[0] - d * 230) < 10 && Math.abs(m.fluxo[1] - y * 100) < 10)) y++; } n.fluxo = [d * 230, y * 100]; linhas[d] = y + 1; });
}
function apagarNo(id) {
  const n = noPorId(id); if (!n) return;
  if (n.tipo === 'map' || n.tipo === 'side') {
    if (campanha.missoes.length <= 1) return aviso('A campaign keeps at least one map.');
    if (!confirm('Delete “' + nomeDoNo(n) + '” and all its rooms?')) return;
    const mi = n.missao; campanha.missoes.splice(mi, 1);
    campanha.nos.forEach(m => { if (m.missao > mi) m.missao--; });
    // every holder of triggers (objects, monsters, counters) and every list of them (otherwise, outcomes)
    donosDaCampanha().forEach(({ o }) => todosGatilhos(o).forEach(g => { if (g.tipo === 'unlock_map' && g.missaoAntiga !== undefined) { if (g.missaoAntiga === mi) delete g.missaoAntiga; else if (g.missaoAntiga > mi) g.missaoAntiga--; } if (g.tipo === 'unlock_map' && g.no === id) delete g.no; }));
    // the map open stays open (its index moves down when an earlier map goes); if it was the one deleted, the next one opens
    const eraAtual = missaoAtual === mi; if (mi < missaoAtual) missaoAtual--;
    missaoAtual = Math.max(0, Math.min(missaoAtual, campanha.missoes.length - 1));
    projeto = campanha.missoes[missaoAtual]; if (eraAtual) { salaAtual = projeto.salas.length ? 0 : -1; sel = null; }
  } else if (!confirm('Delete “' + nomeDoNo(n) + '”' + (ehDialogo(n) ? ' and its boxes?' : '?'))) return;
  if (ehDialogo(n)) campanha.dialogos = campanha.dialogos.filter(d => d.cena !== n.id);
  const antes = n.depois || [];
  campanha.nos = campanha.nos.filter(m => m.id !== id);
  campanha.nos.forEach(m => { if ((m.depois || []).includes(id)) { m.depois = m.depois.filter(x => x !== id); antes.forEach(a => { if (!m.depois.includes(a)) m.depois.push(a); }); } });
  campanha.dialogos.forEach(d => { d.acoes = d.acoes.filter(a => a.node !== id); d.options.forEach(o => { o.acoes = o.acoes.filter(a => a.node !== id); }); });
  noSel = null;
}
function ligar(de, para) { if (!de || !para || de === para) return false; para.depois = para.depois || []; if (para.depois.includes(de.id)) return false; if ((de.depois || []).includes(para.id)) { aviso('They already link the other way round.'); return false; } para.depois.push(de.id); return true; }
function desligar(de, para) { para.depois = (para.depois || []).filter(x => x !== de.id); }

// ------------------------------------------------------------ open / close / tabs
function abrirCampanha(aba) {
  if (!campanha) criarCampanha();
  normalizarCampanha(campanha);
  $('#telaCampanha').hidden = false;
  $('#c_nome').value = campanha.meta.name || '';
  const no = noDaMissao(missaoAtual); if (no && !noSel) noSel = no.id;
  mudarAba(aba || (abaC === 'caixas' ? 'fluxo' : abaC));
}
function fecharCampanha() { antesDeSairDaCena(() => { esconderPainel('janelaVariaveis'); esconderPainel('janelaInventario'); if (abaC === 'caixas') trocarAba('fluxo'); fecharPopup(); $('#telaCampanha').hidden = true; camposDaMissao(); tudo(); }); }
/* the boxes of a scene that have nothing to show yet */
function caixasVazias(n) {
  return caixasDaCena(n).filter(d => d.type === 'video' ? !d.video
    : d.type === 'choice' ? !(d.text || '').trim() || !(d.options || []).some(o => (o.text || '').trim())
    : !(d.text || '').trim() && !(d.title || '').trim());
}
/* leaving a scene's boxes with empty ones: a warning first (unless the user asked not to see it again) */
function antesDeSairDaCena(seguir) {
  const n = abaC === 'caixas' && cenaAberta ? noPorId(cenaAberta) : null;
  const vazias = n ? caixasVazias(n) : [];
  if (!vazias.length || jaVisto('aviso:cenasVazias')) return seguir();
  const porque = d => d.type === 'video' ? 'video box with no video' : d.type === 'choice' ? 'question with no text or no answers' : 'box with no text';
  modal('Empty boxes in “' + nomeDoNo(n) + '”', `<p>${vazias.length === 1 ? 'This box has' : 'These boxes have'} nothing to show yet:</p>
    <ul>${vazias.map(d => `<li><b>${esc(d.title || (d.type === 'video' ? 'Video' : 'Box') + ' ' + (caixasDaCena(n).indexOf(d) + 1))}</b>: ${porque(d)}</li>`).join('')}</ul>
    <p class="ajuda">They are exported as they are. Fill them, or delete the ones you do not need.</p>
    <label class="chk"><input type="checkbox" data-naoavisar> Do not warn me again (⚙ Settings brings the warning back)</label>
    <div class="botoes" style="justify-content:flex-end;margin-top:10px"><button data-ficar>Stay and fill them</button><button class="primario" data-sair>Leave anyway</button></div>`, (el, fechar) => {
    const lembrar = () => { if (el.querySelector('[data-naoavisar]').checked) marcarVisto('aviso:cenasVazias'); };
    el.querySelector('[data-ficar]').onclick = () => { lembrar(); fechar(); caixaSel = vazias[0].id; renderC(); };
    el.querySelector('[data-sair]').onclick = () => { lembrar(); fechar(); seguir(); };
  });
}
function mudarAba(aba) {
  if (abaC === 'caixas' && aba !== 'caixas') return antesDeSairDaCena(() => trocarAba(aba));
  trocarAba(aba);
}
function trocarAba(aba) {
  abaC = aba; fecharPopup(); estradaNova = null; colocandoCidade = false;
  if (aba !== 'caixas') cenaAberta = null;
  $$('#abasC button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === aba));
  $('#cCaixas').hidden = aba !== 'caixas';
  $('#dicaC').title = aba === 'fluxo' ? 'Drag a card to move it · drag from its ● onto another card to link (the target comes after) · click the ● to see where it leads, or the tip of an arrow to see what comes into a card (remove links there) · ✎ or double-click opens the card · arrows nudge the selected card (or the view) · + and − zoom · Del deletes'
    : aba === 'mundo' ? 'Drag a marker to place it on the world map · faded dots are the official destinations · with your own map picture, draw the roads on the left · arrows nudge · + and − zoom'
    : 'Boxes of “' + (cenaAberta ? nomeDoNo(noPorId(cenaAberta)) : '') + '”: drag from a box’s ● (or an answer’s ●) onto another box to say what comes next · only a question may branch · double-click the background adds a box';
  renderC();
  redimensionarC(); enquadrarC();
}
$('#cVoltar').onclick = fecharCampanha;
$$('#abasC button').forEach(b => b.onclick = () => mudarAba(b.dataset.aba));
$('#cVars').onclick = () => abrirVariaveis();
$('#cInv').onclick = () => abrirInventario();
$('#dicaC').onclick = () => avisoLongo($('#dicaC').title);
$('#cCaixas').onclick = () => mudarAba('fluxo');
$('#c_nome').oninput = e => { campanha.meta.name = e.target.value; renderEsqC(); };
$('#cExportar').onclick = () => exportarCampanha();
$('#cApagar').onclick = () => apagarCampanha();
/* Delete campaign: everything goes (campaign, maps, scenes, workshop, variables); the editor starts over with an empty map */
function apagarCampanha() {
  if (!campanha) return;
  // (a campaign with no name: the name shown is the editor's words for it, in the editor's language)
  const nome = campanha.meta.name || (typeof tr === 'function' ? tr('without a name') : 'without a name');
  const confere = v => { const a = v.trim().toLowerCase(); return a === nome.trim().toLowerCase() || (!campanha.meta.name && a === 'without a name'); };
  const b = campanha.bestiario || {}; const n = k => (b[k] || []).length;
  const oficinaTx = [[n('monstros'), 'monster(s)'], [n('personagens'), 'NPC(s)'], [n('itens'), 'item(s)'], [n('herois'), 'hero(es)'], [n('armas'), 'weapon(s)'], [n('receitas'), 'recipe(s)'], [n('facanhas'), 'feat(s)'], [n('pecas') + n('objetos'), 'tile(s)/object(s) of your own']].filter(([q]) => q).map(([q, t]) => q + ' ' + t).join(', ');
  const mapas = campanha.missoes.map((m, i) => (m.meta.name || 'Map ' + (i + 1)) + ' (' + m.salas.length + ' room(s))');
  const cenas = campanha.nos.filter(ehDialogo).length, vars = escolhasDaCampanha().length;
  modal('Delete the campaign “' + nome + '”?', `<p class="ajuda aviso"><b>Everything of this campaign is erased from the editor, and it cannot be undone:</b></p>
    <ul class="ajuda">
      <li>${mapas.length} map(s): ${esc(mapas.join(', ') || 'none')}</li>
      <li>the story flow: ${campanha.nos.length} card(s), ${cenas} scene(s) with their boxes${vars ? ', ' + vars + ' story variable(s)' : ''}</li>
      <li>the workshop${oficinaTx ? ': ' + esc(oficinaTx) : ' (empty)'}</li>
      <li>the world map positions, the rewards, the music and videos chosen</li>
    </ul>
    <p class="ajuda">Files already exported stay in the folder${Config.nomePasta() ? ' (' + esc(Config.nomePasta()) + ')' : ''}; delete them there if you want. Autosave stops following this campaign, so it will not erase them. The game keeps the progress of any party that played it.</p>
    <button class="op destaque" data-o="exp"><b>Export, then delete</b><small>Writes the .dcamp and its maps${Config.nomePasta() ? ' into ' + esc(Config.nomePasta()) : ' (download)'}, then deletes.</small></button>
    <div class="op perigo" style="cursor:default"><b>Delete without exporting</b><small>Type the name of the campaign to confirm: <b>${esc(nome)}</b></small>
      <div class="linha" style="margin-top:6px"><input id="ca_nome" placeholder="${esc(nome)}"><button class="sm perigo" id="ca_ja" disabled>Delete for good</button></div></div>
    <div class="rodape"><button data-o="nao">Cancel</button></div>`, (el, fechar) => {
    const inp = el.querySelector('#ca_nome'), ja = el.querySelector('#ca_ja');
    inp.oninput = () => { ja.disabled = !confere(inp.value); };
    el.querySelector('[data-o="nao"]').onclick = fechar;
    ja.onclick = () => { if (!confere(inp.value)) return; fechar(); limparTudo(); aviso('The campaign “' + nome + '” was deleted. The editor starts over with an empty map.'); };
    el.querySelector('[data-o="exp"]').onclick = async () => { fechar(); try { if (!(await exportarTudo(true))) return; } catch (e) { return aviso('Export failed (' + e.message + '): nothing was deleted.'); } limparTudo(); aviso('Exported and deleted. The editor starts over with an empty map.'); };
  }, true);
}
$('#cEnquadrar').onclick = () => enquadrarC();
function renderC() { renderEsqC(); renderDirC(); desenharC(); }
function abrirCaixas(n) { if (!n || !ehDialogo(n)) return; cenaAberta = n.id; noSel = n.id; caixaSel = n.dialogo; mudarAba('caixas'); }

// ------------------------------------------------------------ left column
const DESTINO_EDICAO = { map: 'Build the rooms of this map', side: 'Build the rooms of this side quest', travel: 'Place this waypoint on the world map', dialogue: 'Write the boxes of this scene', scene: 'Write the boxes of this scene' };
function editarNo(n) {
  if (!n) return; noSel = n.id;
  if (ehDialogo(n)) { abrirCaixas(n); return; }
  if (n.tipo === 'travel') { if (abaC === 'mundo') { mudarAba('fluxo'); } else mudarAba('mundo'); return; }
  if (n.missao === null || n.missao === undefined || !campanha.missoes[n.missao]) return aviso('This card has no map.');
  trocarMissao(n.missao); fecharCampanha();
}
function renderEsqC() {
  const el = $('#esqC');
  if (abaC === 'caixas') { $('#cBotoes').innerHTML = '';
    const n = noPorId(cenaAberta); const caixas = caixasDaCena(n);
    el.innerHTML = `<div class="bloco"><h2>${esc(rotuloDoNo(n))}${n.nome ? ' · ' + esc(n.nome) : ''}</h2><div class="botoes"><button class="sm" id="cAddCaixa">+ Box</button><button class="sm" id="cAddVideo" title="A box that plays your own film (a cutscene)">+ Video (cutscene)</button><button class="sm primario" id="cSimular">▶ Simulate</button></div><div id="cListaCaixas"></div><p class="ajuda">Boxes play in the order of the arrows, starting at the first. A question box branches: each answer leads to its own next box. A video box plays your own film (MP4 or WebM) between the other boxes.</p></div>`;
    const l = $('#cListaCaixas');
    caixas.forEach((d, i) => { const dv = document.createElement('div'); dv.className = 'no' + (caixaSel === d.id ? ' ativo' : ''); const r = rostoDe(d.speaker);
      dv.innerHTML = `${r ? `<img class="face" src="${r}" alt="">` : '<span class="face"></span>'}<div><div>${d.id === n.dialogo ? '▶ ' : ''}${esc(d.type === 'video' ? '▶ ' + (d.video?.nome || 'video') : d.title || (d.text || '').slice(0, 26) || 'Box ' + (i + 1))}</div><small>${esc(d.type === 'video' ? 'video' : d.speaker ? nomePersonagem(d.speaker) : 'narrator')}${d.type === 'choice' ? ' · question' : ''}${d.acoes.length ? ' · ' + d.acoes.length + ' action(s)' : ''}</small></div>`;
      dv.onclick = () => { caixaSel = d.id; renderC(); }; l.appendChild(dv); });
    const addCaixa = video => { const d = novaCaixa(n); if (video) d.type = 'video'; const s = caixaSel && caixaPorId(caixaSel); if (s && s.type !== 'choice' && !campanha.dialogos.some(x => (x.depois || []).includes(s.id))) d.depois = [s.id]; d.fluxo = [(s ? s.fluxo[0] : 0) + 240, s ? s.fluxo[1] : 0]; caixaSel = d.id; renderC(); };
    $('#cAddCaixa').onclick = () => addCaixa(false);
    $('#cAddVideo').onclick = () => addCaixa(true);
    $('#cSimular').onclick = () => simular(n);
    return;
  }
  el.innerHTML = `<div class="bloco"><h2>${abaC === 'fluxo' ? 'Story flow' : 'World map'}</h2>
    <div id="cListaNos"></div>
    <p class="ajuda">${abaC === 'fluxo' ? 'Read left to right: map → scene → waypoint (the party moves on the world map) → scene → next maps. Cards with no arrow in are available from the start. Each card keeps its number for good; the name is yours.' : 'Every map, side quest and waypoint has a place here and a marker kind: main quest, side quest, narrative event or city visit.'}</p></div>`
    + (abaC === 'mundo' ? `<div class="bloco"><h2>Map picture</h2><div id="cMapaProprio"></div></div>` : '');
  if (abaC === 'mundo') campoMapaProprio($('#cMapaProprio'));
  const depois = ' (it goes after the selected card)';
  $('#cBotoes').innerHTML = `<button class="sm" id="cAddMap" title="A new map${depois}">+ Map</button><button class="sm" id="cAddSide" title="A new side quest${depois}">+ Side quest</button><button class="sm" id="cAddTravel" title="The party moves on the world map${depois}">+ Waypoint</button>${abaC === 'fluxo' ? `<button class="sm" id="cAddDlg" title="Boxes of text, questions and videos (your own films), played in a row${depois}">+ Scene</button><span class="sep"></span><button class="sm" id="cArrumar" title="Lay the cards out left to right">Auto-arrange</button>` : ''}`;
  const l = $('#cListaNos');
  campanha.nos.forEach(n => {
    if (abaC === 'mundo' && !noMapaMundi(n)) return;
    const dv = document.createElement('div'); dv.className = 'no' + (noSel === n.id ? ' ativo' : '');
    const cab = ehDialogo(n) ? caixaPorId(n.dialogo) : null; const r = cab ? rostoDe(cab.speaker) : '';
    dv.innerHTML = `${r ? `<img class="face" src="${r}" alt="">` : `<span class="ponto ${n.tipo}"></span>`}<div style="flex:1;min-width:0"><div>${esc(rotuloDoNo(n))}${nomeDoNo(n) !== rotuloDoNo(n) ? ' · ' + esc(nomeDoNo(n)) : ''}</div><small>${n.missao !== null && n.missao !== undefined ? (campanha.missoes[n.missao]?.salas.length || 0) + ((campanha.missoes[n.missao]?.salas.length || 0) === 1 ? ' room' : ' rooms') + ' · progression ' + progressoDoMapa(campanha.missoes[n.missao]) : ehDialogo(n) ? caixasDaCena(n).length + ' box(es)' : MARCADORES.find(m => m[0] === n.marcador)?.[1] || ''}${(n.depois || []).length ? ' · after ' + n.depois.map(noPorId).filter(Boolean).map(rotuloDoNo).join(', ') : ' · from the start'}</small></div><button class="sm editar" title="${esc(DESTINO_EDICAO[n.tipo])}">✎</button>`;
    dv.onclick = () => { noSel = n.id; renderC(); };
    dv.querySelector('.editar').onclick = ev => { ev.stopPropagation(); editarNo(n); };
    l.appendChild(dv);
  });
  const depoisDe = () => { const s = noSel && noPorId(noSel); return s && s.missao !== null && s.missao !== undefined ? s.missao : missaoAtual; };
  const ligarAoSelecionado = n => { const s = noSel && noPorId(noSel); if (s && s !== n) { n.depois = [s.id]; n.fluxo = null; arrumarFluxo(false); } };
  $('#cAddMap').onclick = () => { const idx = novaMissao('map', depoisDe()); ligarAoSelecionado(noDaMissao(idx)); noSel = noDaMissao(idx).id; renderC(); };
  $('#cAddSide').onclick = () => { const idx = novaMissao('side', depoisDe()); ligarAoSelecionado(noDaMissao(idx)); noSel = noDaMissao(idx).id; renderC(); };
  $('#cAddTravel').onclick = () => { const n = inserirNo('travel'); noSel = n.id; renderC(); if (abaC === 'fluxo') aviso('Waypoint added. Place it on the World map tab.'); };
  const bd = $('#cAddDlg'); if (bd) bd.onclick = () => { const n = inserirNo('dialogue'); noSel = n.id; renderC(); };
  const ar = $('#cArrumar'); if (ar) ar.onclick = () => { arrumarFluxo(true); desenharC(); enquadrarC(); };
}

// ------------------------------------------------------------ right column
function renderDirC() {
  const el = $('#dirC');
  if (abaC === 'caixas') return renderCaixaProps(el, caixaSel && caixaPorId(caixaSel));
  const n = noSel && noPorId(noSel);
  if (!n) { el.innerHTML = '<div class="bloco"><h2>Selection</h2><p class="ajuda">Click a card or a marker.</p></div>'; return; }
  const m = n.missao !== null && n.missao !== undefined ? campanha.missoes[n.missao] : null;
  el.innerHTML = `<div class="bloco"><h2><span class="ponto ${n.tipo}"></span>${esc(rotuloDoNo(n))}</h2>
    <label class="campo">Name <input id="n_nome" value="${esc(m ? m.meta.name : n.nome || '')}" placeholder="${esc(rotuloDoNo(n))}"></label>
    ${htmlSeEscolha(n, 'n_seesc')}${n.seEscolha ? `<p class="ajuda">${ehDialogo(n) ? 'Otherwise the scene is skipped (the story goes on).' : 'Otherwise it does not appear on the world map (unless a box unlocks it by hand).'}</p>` : ''}
    ${ehDialogo(n) ? `<p class="ajuda">${caixasDaCena(n).length} box(es): text, questions and videos (your own films), played one after the other in the same frame. Played at this point of the story: after a map it is the map’s closing scene; after a waypoint it plays on arrival; before anything it opens the campaign.</p><label class="campo">Plays as <select id="n_marcador">${MARCADORES_DA_CENA.map(([v, t]) => `<option value="${v}" ${n.marcador === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${n.marcador === 'city' ? '<p class="ajuda">It waits for the next visit to the city after the card before it; the scenes that follow it play in the same visit.</p>' : ''}<button id="n_caixas" class="primario largo">Write the boxes ▸</button>`
      : `<label class="campo">Description (shown on the world map) <textarea id="n_desc" rows="2">${esc(n.descricao || '')}</textarea></label>
      ${m ? `<button id="n_salas" class="primario largo">Build the rooms ▸</button><p class="ajuda">${m.salas.length} room(s) · campaign progression ${progressoDoMapa(m)} (Map setup → Balancing).</p>` : '<p class="ajuda">A stop on the world map: the party’s marker moves there. Put scene cards after it for what happens on arrival.</p>'}
      <label class="campo">${n.tipo === 'travel' ? 'Happens as' : 'On the world map as'} <select id="n_marcador">${marcadoresDe(n).map(([v, t]) => `<option value="${v}" ${n.marcador === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" id="n_auto" ${n.auto !== false ? 'checked' : ''}> Appears on the world map on its own when unlocked</label>
      ${(() => { const q = quemDesbloqueia(n); return q.length ? `<p class="ajuda">🔒 Locked until unlocked by ${q.map(x => '<b>' + esc(x) + '</b>').join(', ')} (“Unlock a campaign map”).</p>` : ''; })()}
      ${n.tipo !== 'travel' ? `<div class="sub">Rewards on completion</div>
      <div class="duas"><label class="campo">Gold <input id="n_ouro" type="number" min="0" value="${n.recompensas?.gold || 0}" style="width:80px"></label>
      <label class="campo">Crafting materials <input id="n_mat" type="number" min="0" value="${n.recompensas?.materials || 0}" style="width:80px"></label></div>
      <label class="campo">Items <select id="n_item"><option value="">+ add an item…</option>${ITENS_B().map(i => `<option value="${esc(i.id)}">${esc(i.nome)}</option>`).join('')}</select>${ITENS_B().length ? '' : '<small class="ajuda">Only workshop items can be given: import or create them in the Workshop (rooms screen).</small>'}</label>
      <div>${(n.recompensas?.items || []).map(it => `<span class="tag">${esc(nomeItem(it))} <a href="#" data-delitem="${esc(it)}">✕</a></span>`).join('')}</div>` : ''}
      <p class="ajuda">World map position: ${n.coords[0]}, ${n.coords[1]}.</p>`}
    <div class="linha acoes"><button class="sm perigo" id="n_apagar">Delete this ${NOME_TIPO[n.tipo].toLowerCase()}</button></div></div>`;
  const se = $('#n_seesc'); if (se) se.onchange = e => { lerSeEscolha(n, e.target.value); renderDirC(); renderEsqC(); desenharC(); };
  $('#n_nome').oninput = e => { if (m) m.meta.name = e.target.value; else n.nome = e.target.value; renderEsqC(); desenharC(); };
  const nd = $('#n_desc'); if (nd) nd.oninput = e => { n.descricao = e.target.value; if (m) m.meta.description = e.target.value; };
  const bs = $('#n_salas'); if (bs) bs.onclick = () => { trocarMissao(n.missao); fecharCampanha(); };
  const bc = $('#n_caixas'); if (bc) bc.onclick = () => abrirCaixas(n);
  const mk = $('#n_marcador'); if (mk) mk.onchange = e => { n.marcador = e.target.value; if (n.tipo === 'map' && e.target.value === 'side') n.tipo = 'side'; else if (n.tipo === 'side' && e.target.value === 'main') n.tipo = 'map'; renderC(); };
  const au = $('#n_auto'); if (au) au.onchange = e => { n.auto = e.target.checked; };
  const nm = $('#n_mat'); if (nm) nm.onchange = e => { n.recompensas.materials = Math.max(0, +e.target.value || 0); };
  const no = $('#n_ouro'); if (no) no.onchange = e => { n.recompensas.gold = Math.max(0, +e.target.value || 0); };
  const ni = $('#n_item'); if (ni) ni.onchange = e => { if (!e.target.value) return; if (!n.recompensas.items.includes(e.target.value)) n.recompensas.items.push(e.target.value); renderDirC(); };
  el.querySelectorAll('[data-delitem]').forEach(a => a.onclick = ev => { ev.preventDefault(); n.recompensas.items = n.recompensas.items.filter(i => i !== a.dataset.delitem); renderDirC(); });
  $('#n_apagar').onclick = () => { apagarNo(n.id); renderC(); renderCabecalho(); };
}
const ACOES_CAIXA = [['unlockNode', 'Unlock a map or waypoint'], ['giveItem', 'Give an item'], ['giveMaterials', 'Give crafting materials'], ['completeNode', 'Mark a map or waypoint as completed'], ['remember', 'Remember a choice']];
/* choices the campaign remembers (a short phrase): an answer ticked “Remember this answer”, or a “Remember a choice” action.
   Cards, scenes and map triggers can then happen only if the party made (or did not make) that choice. */
const varEscolha = nome => 'choice:' + slug(nome || '');
function escolhasDaCampanha() {
  if (!campanha) return []; const r = new Set((campanha.escolhas || []).map(x => x.nome));
  (campanha.dialogos || []).forEach(d => { (d.acoes || []).forEach(a => { if (a.action === 'remember' && a.nome) r.add(a.nome); }); (d.options || []).forEach(o => { if (o.lembrar && (o.lembrarNome || o.text)) r.add(o.lembrarNome || o.text); (o.acoes || []).forEach(a => { if (a.action === 'remember' && a.nome) r.add(a.nome); }); }); });
  return [...r].sort();
}
/* the “Only if” select of a card: always / the party chose X / the party did not choose X */
function htmlSeEscolha(x, id) {
  const es = escolhasDaCampanha(); const v = x.seEscolha ? (x.seEscolha.sim === false ? 'nao:' : 'sim:') + x.seEscolha.nome : '';
  if (!es.length && !v) return `<label class="campo">Only if <select disabled><option>Always</option></select></label><p class="ajuda">No remembered choice yet: in a question box, tick “Remember this answer”.</p>`;
  const nomes = es.includes(x.seEscolha?.nome) || !x.seEscolha ? es : [...es, x.seEscolha.nome];
  return `<label class="campo">Only if <select id="${id}"><option value="">Always</option>${nomes.map(n => `<option value="sim:${esc(n)}" ${v === 'sim:' + n ? 'selected' : ''}>The party chose “${esc(n)}”</option><option value="nao:${esc(n)}" ${v === 'nao:' + n ? 'selected' : ''}>The party did not choose “${esc(n)}”</option>`).join('')}</select></label>`;
}
function lerSeEscolha(x, valor) { if (!valor) delete x.seEscolha; else x.seEscolha = { nome: valor.slice(4), sim: valor.startsWith('sim:') }; }

// ------------------------------------------------------------ Story variables (the choices the campaign remembers)
/* every holder of triggers in the maps of the campaign (objects, monsters, counters), with where it is */
function donosDaCampanha() {
  const r = [];
  (campanha?.missoes || []).forEach((m, mi) => {
    m.salas.forEach((s, si) => donosDaSala(s).forEach(({ o, chave }) => r.push({ mi, si, o, chave })));
    (m.contadores || []).forEach(c => r.push({ mi, si: 0, o: c, chave: 'C:' + c.id }));
  });
  return r;
}
const nomeDoMapa = mi => { const n = campanha.nos.find(x => x.missao === mi); return n ? rotuloDoNo(n) + (nomeDoNo(n) !== rotuloDoNo(n) ? ' · ' + nomeDoNo(n) : '') : 'Map ' + (mi + 1); };
/* what sets a choice (answers, actions of boxes) and what depends on it (cards, map triggers) */
function usosDaEscolha(nome) {
  const define = [], usa = [];
  campanha.dialogos.forEach(d => { const n = noPorId(d.cena); if (!n) return;
    (d.acoes || []).forEach(a => { if (a.action === 'remember' && a.nome === nome) define.push({ tipo: 'caixa', n, d, texto: rotuloDoNo(n) + ' · when a box is shown' }); });
    (d.options || []).forEach(o => {
      if (o.lembrar && (o.lembrarNome || o.text) === nome) define.push({ tipo: 'caixa', n, d, texto: rotuloDoNo(n) + ' · answer “' + (o.text || '?') + '”' });
      (o.acoes || []).forEach(a => { if (a.action === 'remember' && a.nome === nome) define.push({ tipo: 'caixa', n, d, texto: rotuloDoNo(n) + ' · answer “' + (o.text || '?') + '”' }); });
    });
  });
  campanha.nos.forEach(n => { if (n.seEscolha && n.seEscolha.nome === nome) usa.push({ tipo: 'no', n, texto: rotuloDoNo(n) + ' · only if ' + (n.seEscolha.sim === false ? 'not chosen' : 'chosen') }); });
  donosDaCampanha().forEach(({ mi, si, o, chave }) => (o.gatilhos || []).forEach((g, gi) => (g.requisitos || []).forEach(r => {
    if (r.tipo === 'choice' && r.nome === nome) usa.push({ tipo: 'mapa', mi, si, chave, o, gi, texto: nomeDoMapa(mi) + ' · ' + rotulo(o) + ' · ' + (GATILHO[g.tipo]?.nome || g.tipo) + (r.sim === false ? ' (if not chosen)' : ' (if chosen)') });
  })));
  return { define, usa };
}
function renomearEscolha(velho, novo) {
  const troca = a => { if (a.action === 'remember' && a.nome === velho) a.nome = novo; };
  campanha.dialogos.forEach(d => { (d.acoes || []).forEach(troca); (d.options || []).forEach(o => { if (o.lembrar && (o.lembrarNome || o.text) === velho) { if (novo) o.lembrarNome = novo; else { o.lembrar = false; delete o.lembrarNome; } } (o.acoes || []).forEach(troca); }); });
  campanha.nos.forEach(n => { if (n.seEscolha && n.seEscolha.nome === velho) { if (novo) n.seEscolha.nome = novo; else delete n.seEscolha; } });
  donosDaCampanha().forEach(({ o }) => (o.gatilhos || []).forEach(g => { if (!g.requisitos) return; if (novo) g.requisitos.forEach(r => { if (r.tipo === 'choice' && r.nome === velho) r.nome = novo; }); else g.requisitos = g.requisitos.filter(r => !(r.tipo === 'choice' && r.nome === velho)); }));
  if (!novo) campanha.dialogos.forEach(d => { d.acoes = (d.acoes || []).filter(a => !(a.action === 'remember' && a.nome === velho)); (d.options || []).forEach(o => { o.acoes = (o.acoes || []).filter(a => !(a.action === 'remember' && a.nome === velho)); }); });
  const c = campanha.escolhas.find(x => x.nome === velho); if (c) { if (novo) c.nome = novo; else campanha.escolhas = campanha.escolhas.filter(x => x !== c); }
}
function irParaUsoDaEscolha(u, fechar) {
  fechar();
  if (u.tipo === 'caixa') { abrirCaixas(u.n); caixaSel = u.d.id; renderC(); return; }
  if (u.tipo === 'no') { mudarAba('fluxo'); noSel = u.n.id; renderC(); return; }
  trocarMissao(u.mi); fecharCampanha();
  if (typeof u.chave === 'string' && u.chave.startsWith('C:')) { abrirConsequencia(u.o, u.gi); return; }
  irParaDono(u.si, u.chave); gatAberto = 'gatilhos' + u.gi; renderPropriedades();
}
/* the Story variables button (top of the campaign screen) */
function abrirVariaveis() {
  campanha.escolhas = campanha.escolhas || [];
  escolhasDaCampanha().forEach(n => { if (!campanha.escolhas.some(x => x.nome === n)) campanha.escolhas.push({ nome: n, nota: '' }); });
  campanha.escolhas.sort((a, b) => a.nome.localeCompare(b.nome));
  const usos = campanha.escolhas.map(x => usosDaEscolha(x.nome));
  const chip = (u, i, k, lado) => `<button class="sm usoCont" data-v="${i}" data-lado="${lado}" data-k="${k}" title="Open it">${esc(u.texto)}</button>`;
  const linhas = campanha.escolhas.map((x, i) => { const { define, usa } = usos[i];
    return `<div class="contador"><div class="linha"><input data-vn="${i}" value="${esc(x.nome)}" title="Rename: every answer, card and map trigger that uses it follows"><button class="sm" data-vx="${i}" title="Delete">✕</button></div>
      <input data-vnota="${i}" value="${esc(x.nota || '')}" placeholder="What it means (a note for you)" style="margin-top:6px">
      <div class="usos"><span class="rotuloTx">Set by</span> ${define.map((u, k) => chip(u, i, k, 'define')).join('') || '<span class="ajuda aviso">nothing sets it yet: tick “Remember this answer” in a question box and give it this name. Until then “chose” is never true.</span>'}</div>
      <div class="usos"><span class="rotuloTx">Used by</span> ${usa.map((u, k) => chip(u, i, k, 'usa')).join('') || '<span class="ajuda">nothing depends on it yet: pick it in “Only if” of a card, or as the requirement “A choice in the campaign” of a map trigger.</span>'}</div></div>`; }).join('');
  janelaFlutuante('janelaVariaveis', 'Story variables', `<p class="ajuda">The choices the campaign remembers from one map to the next: spared the bandit, sided with the rebels, took the cursed ring… A choice is set when the party picks an answer ticked “Remember this answer” (or by a “Remember a choice” action) and stays for the rest of the campaign. Cards of the story flow and triggers of the maps can then happen only if the party made it, or did not.</p>
    ${linhas || '<p class="ajuda">No variable yet.</p>'}
    <div class="linha" style="margin-top:10px"><input id="vn_novo" placeholder="New variable (Spared the bandit, Sided with the rebels…)"><button class="sm primario" id="vn_mais">+ New variable</button></div>`, (el, fechar) => {
    const volta = () => { abrirVariaveis(); renderC(); };
    el.querySelectorAll('[data-vn]').forEach(inp => inp.onchange = () => { const x = campanha.escolhas[+inp.dataset.vn]; const novo = inp.value.trim(); if (!novo) { inp.value = x.nome; return; } if (novo !== x.nome && campanha.escolhas.some(y => y.nome === novo)) { aviso('There is already a variable called ' + novo + '.'); inp.value = x.nome; return; } renomearEscolha(x.nome, novo); volta(); });
    el.querySelectorAll('[data-vnota]').forEach(inp => inp.oninput = () => { campanha.escolhas[+inp.dataset.vnota].nota = inp.value; });
    el.querySelectorAll('[data-vx]').forEach(b => b.onclick = () => { const x = campanha.escolhas[+b.dataset.vx]; const { define, usa } = usos[+b.dataset.vx];
      if ((define.length || usa.length) && !confirm('Delete “' + x.nome + '”? ' + (define.length ? define.length + ' answer(s) or action(s) stop remembering it. ' : '') + (usa.length ? usa.length + ' card(s) or trigger requirement(s) lose this condition.' : ''))) return;
      renomearEscolha(x.nome, ''); volta(); });
    el.querySelectorAll('.usoCont').forEach(b => b.onclick = () => irParaUsoDaEscolha(usos[+b.dataset.v][b.dataset.lado][+b.dataset.k], fechar));
    const novo = () => { const n = $('#vn_novo').value.trim(); if (!n) return aviso('Give the variable a name.'); if (campanha.escolhas.some(x => x.nome === n)) return aviso('There is already a variable called ' + n + '.'); campanha.escolhas.push({ nome: n, nota: '' }); volta(); };
    $('#vn_mais').onclick = novo; $('#vn_novo').onkeydown = e => { if (e.key === 'Enter') novo(); };
  }, true);
}
function renderCaixaProps(el, d) {
  if (!d) { el.innerHTML = '<div class="bloco"><h2>Box</h2><p class="ajuda">Pick a box on the left, or add one.</p></div>'; return; }
  const n = noPorId(d.cena); const outras = caixasDaCena(n).filter(x => x.id !== d.id);
  const acoesHtml = (lista, chave) => `<div id="${chave}">${lista.map((a, i) => `<div class="linha acaoCx"><span>${esc(ACOES_CAIXA.find(x => x[0] === a.action)?.[1] || a.action)}: <b>${esc(a.action === 'unlockNode' || a.action === 'completeNode' ? (noPorId(a.node) ? rotuloDoNo(noPorId(a.node)) + (nomeDoNo(noPorId(a.node)) !== rotuloDoNo(noPorId(a.node)) ? ' · ' + nomeDoNo(noPorId(a.node)) : '') : '?') : a.action === 'giveItem' ? nomeItem(a.item) : a.action === 'giveMaterials' ? a.n + ' material(s)' : a.action === 'remember' ? '“' + a.nome + '”' : a.var + ' = ' + a.value)}</b></span><button class="sm" data-acx="${chave}:${i}">✕</button></div>`).join('')}<div class="linha"><select data-acadd="${chave}"><option value="">+ what happens…</option>${ACOES_CAIXA.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div></div>`;
  const video = d.type === 'video';
  el.innerHTML = `<div class="bloco"><h2>Box${d.id === n.dialogo ? ' (first)' : ''}</h2>
    <label class="campo">Kind <select id="d_tipo"><option value="normal" ${d.type === 'normal' || !d.type ? 'selected' : ''}>Plain box</option><option value="choice" ${d.type === 'choice' ? 'selected' : ''}>Question (the players choose an answer)</option><option value="video" ${video ? 'selected' : ''}>Video (your own film)</option></select></label>
    ${video ? `<div id="d_video"></div><p class="ajuda">The scene goes on with the next box when the film ends.</p>` : `
    <label class="campo">Speaker <select id="d_speaker"><option value="">Narrator (no portrait)</option>${PERSONAGENS_B().map(p => `<option value="${esc(p.id)}" ${d.speaker === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>${PERSONAGENS_B().length ? '' : '<small class="ajuda">No NPCs yet: import or create them in the NPCs tab of the Workshop (top bar of the rooms screen).</small>'}</label>
    <label class="campo">Title (optional) <input id="d_title" value="${esc(d.title || '')}"></label>
    <label class="campo">Text <textarea id="d_texto" rows="5">${esc(d.text || '')}</textarea></label>
    <label class="campo">Others in the scene <select id="d_cast"><option value="">+ add…</option>${PERSONAGENS_B().filter(p => p.id !== d.speaker && !d.cast.includes(p.id)).map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}</select></label>
    <div>${d.cast.map(id => `<span class="tag">${esc(nomePersonagem(id))} <a href="#" data-delcast="${esc(id)}">✕</a></span>`).join('')}</div>
    <label class="campo">Background <select id="d_bg">${FUNDOS.map(f => `<option value="${f.id}" ${(d.background ?? FUNDO_PADRAO) === f.id ? 'selected' : ''}>${esc(f.name_en)}</option>`).join('')}</select></label>`}
    ${d.type === 'choice' ? '<div class="sub">Answers <button class="sm" id="d_addop">+ Answer</button></div><div id="d_ops"></div>' : ''}
    <div class="sub">When this box is shown</div>${acoesHtml(d.acoes, 'acoes')}
    <div class="linha acoes"><button class="sm perigo" id="d_apagar">Delete this box</button></div></div>`;
  if (video) campoVideo($('#d_video'), d, () => { renderEsqC(); desenharC(); });
  else {
  $('#d_speaker').onchange = e => { d.speaker = e.target.value; d.cast = d.cast.filter(c => c !== d.speaker); renderC(); };
  $('#d_title').oninput = e => { d.title = e.target.value; renderEsqC(); desenharC(); };
  $('#d_texto').oninput = e => { d.text = e.target.value; desenharC(); };
  $('#d_cast').onchange = e => { if (e.target.value) d.cast.push(e.target.value); renderC(); };
  el.querySelectorAll('[data-delcast]').forEach(a => a.onclick = ev => { ev.preventDefault(); d.cast = d.cast.filter(c => c !== a.dataset.delcast); renderC(); });
  $('#d_bg').onchange = e => { d.background = +e.target.value; };
  }
  $('#d_tipo').onchange = e => { d.type = e.target.value; if (d.type === 'choice') { const seg = campanha.dialogos.find(x => (x.depois || []).includes(d.id)); if (!d.options.length) d.options = [{ text: '', next: seg ? seg.id : '', acoes: [] }, { text: '', next: '', acoes: [] }]; if (seg) seg.depois = seg.depois.filter(x => x !== d.id); } else { d.options.forEach(o => { if (o.next && caixaPorId(o.next) && !campanha.dialogos.some(x => (x.depois || []).includes(d.id))) { caixaPorId(o.next).depois.push(d.id); } }); } renderC(); };
  const ligarAcoes = () => el.querySelectorAll('[data-acadd]').forEach(s => s.onchange = () => { const v = s.value; if (!v) return; const [chave, idx] = s.dataset.acadd.split(':'); const lista = chave === 'acoes' ? d.acoes : d.options[+idx].acoes;
    if (v === 'unlockNode' || v === 'completeNode') { const alvos = campanha.nos.filter(ehAncora); if (!alvos.length) return aviso('No map or waypoint to unlock.'); escolherOpcao(v === 'unlockNode' ? 'Unlock which one?' : 'Complete which one?', alvos.map(a => ({ id: a.id, titulo: rotuloDoNo(a) + (nomeDoNo(a) !== rotuloDoNo(a) ? ' · ' + nomeDoNo(a) : ''), sub: MARCADORES.find(m => m[0] === a.marcador)?.[1] })), id => { lista.push({ action: v, node: id }); renderDirC(); }); }
    else if (v === 'giveItem') { const its = ITENS_B().map(i => ({ id: i.id, titulo: i.nome, sub: 'workshop item' })); if (!its.length) return aviso('Only workshop items can be given: import or create them in the Workshop first.'); escolherOpcao('Give which item?', its, id => { lista.push({ action: 'giveItem', item: id, qty: 1 }); renderDirC(); }); }
    else if (v === 'giveMaterials') { const nn = +prompt('How many crafting materials?', '1') || 1; lista.push({ action: 'giveMaterials', n: nn }); renderDirC(); }
    else if (v === 'remember') { const nome = (prompt('What does the campaign remember? A short phrase, like “Spared the bandit”.' + (escolhasDaCampanha().length ? '\nStory variables: ' + escolhasDaCampanha().join(' · ') : ''), chave === 'acoes' ? '' : (d.options[+idx].text || '')) || '').trim(); if (!nome) return; lista.push({ action: 'remember', nome }); renderDirC(); }
    s.value = ''; });
  const ligarRemocoes = () => el.querySelectorAll('[data-acx]').forEach(b => b.onclick = () => { const [chave, i] = b.dataset.acx.split(':'); const [k, idx] = chave.split('-'); (k === 'acoes' ? d.acoes : d.options[+idx].acoes).splice(+i, 1); renderDirC(); });
  const ops = $('#d_ops'); if (ops) {
    const pinta = () => { ops.innerHTML = ''; d.options.forEach((op, i) => { const dv = document.createElement('div'); dv.className = 'cartao';
      dv.innerHTML = `<div class="linha"><input data-op="text" value="${esc(op.text || '')}" placeholder="Answer ${i + 1}"><button class="sm" data-rm="${i}">✕</button></div><p class="ajuda">Then: <b>${op.next && caixaPorId(op.next) ? esc(caixaPorId(op.next).title || (caixaPorId(op.next).text || '').slice(0, 24) || 'a box') : 'end of the scene'}</b> (drag from the answer’s ● on the canvas)</p><label class="chk"><input type="checkbox" data-lembra ${op.lembrar ? 'checked' : ''}> Remember this answer</label>${op.lembrar ? `<input data-lembranome list="dl_escolhas" value="${esc(op.lembrarNome || '')}" placeholder="${esc(op.text || 'Answer ' + (i + 1))}" title="How the campaign calls this choice (empty: the answer’s text). Pick one of the Story variables or write a new name."><datalist id="dl_escolhas">${escolhasDaCampanha().map(n => `<option value="${esc(n)}">`).join('')}</datalist><p class="ajuda">Later, cards, scenes and map triggers can happen only if the party chose it (“Only if”).</p>` : ''}${acoesHtml(op.acoes, 'op-' + i)}`;
      dv.querySelector('[data-op="text"]').oninput = e => { op.text = e.target.value; desenharC(); };
      dv.querySelector('[data-rm]').onclick = () => { d.options.splice(i, 1); renderC(); };
      dv.querySelector('[data-lembra]').onchange = e => { op.lembrar = e.target.checked; renderDirC(); };
      const ln = dv.querySelector('[data-lembranome]'); if (ln) ln.oninput = e => { op.lembrarNome = e.target.value.trim(); };
      ops.appendChild(dv); }); ligarAcoes(); ligarRemocoes(); };
    pinta(); $('#d_addop').onclick = () => { if (d.options.length >= 4) return aviso('At most 4 answers.'); d.options.push({ text: '', next: '', acoes: [] }); renderC(); };
  } else { ligarAcoes(); ligarRemocoes(); }
  $('#d_apagar').onclick = () => { if (caixasDaCena(n).length <= 1) return aviso('A scene keeps at least one box.'); const antes = d.depois || []; campanha.dialogos = campanha.dialogos.filter(x => x !== d); campanha.dialogos.forEach(x => { if ((x.depois || []).includes(d.id)) { x.depois = x.depois.filter(y => y !== d.id); antes.forEach(a => { if (!x.depois.includes(a)) x.depois.push(a); }); } x.options.forEach(o => { if (o.next === d.id) o.next = antes[0] ? '' : ''; }); }); if (n.dialogo === d.id) n.dialogo = caixasDaCena(n)[0].id; caixaSel = null; renderC(); };
}

// ------------------------------------------------------------ simulation (how the boxes read in the game)
function simular(n) {
  const cabeca = caixaPorId(n.dialogo); if (!cabeca) return aviso('This card has no boxes.');
  let atual = cabeca; const vistos = new Set();
  const { fundo, cx, fechar } = modal('Simulation · ' + nomeDoNo(n), '<div id="sim"></div>', el => {
    const mostrar = () => {
      if (!atual || vistos.has(atual.id + (atual.type === 'choice' ? '' : ''))) { el.innerHTML = '<div class="simFim">End of the scene.</div><div class="rodape"><button id="sim_fechar">Close</button></div>'; el.querySelector('#sim_fechar').onclick = fechar; return; }
      const d = atual; const fundoN = FUNDOS.find(f => f.id === (d.background ?? FUNDO_PADRAO));
      const seguinte = campanha.dialogos.find(x => (x.depois || []).includes(d.id));
      if (d.type === 'video') { vistos.add(d.id); el.innerHTML = `<div class="quadro"><div class="texto">▶ Video: <b>${esc(d.video?.nome || '(no video yet)')}</b>${d.video && AUDIOS[d.video.arquivo] ? `<video controls src="${URL.createObjectURL(AUDIOS[d.video.arquivo])}" style="width:100%;max-height:300px;margin-top:8px;background:#000"></video>` : ''}<br><small>In the game the film plays full screen here.</small></div><div class="opcoes"><button data-next>${seguinte ? 'Continue ▸' : 'Close'}</button></div></div>`; el.querySelector('[data-next]').onclick = () => { if (!seguinte) return fechar(); atual = seguinte; mostrar(); }; return; }
      el.innerHTML = `<div class="quadro bg-${d.background ?? FUNDO_PADRAO}"><div class="fundoNome">${esc(fundoN?.name_en || '')}</div>
        <div class="cabeca">${rostoDe(d.speaker) ? `<img src="${rostoDe(d.speaker)}" alt="">` : ''}<div><div class="nome">${esc(d.speaker ? nomePersonagem(d.speaker) : 'Narrator')}</div><div class="titulo">${esc(d.title || '')}</div></div></div>
        <div class="texto">${esc(d.text || '(no text yet)')}</div>
        ${d.cast.length ? `<div class="elenco">${d.cast.map(id => rostoDe(id) ? `<img src="${rostoDe(id)}" title="${esc(nomePersonagem(id))}" alt="">` : '').join('')}</div>` : ''}
        ${d.acoes.length ? `<div class="simAcoes">${d.acoes.map(a => '✦ ' + esc(ACOES_CAIXA.find(x => x[0] === a.action)?.[1] || a.action)).join('<br>')}</div>` : ''}
        ${d.type === 'choice' ? `<div class="opcoes">${d.options.map((o, i) => `<button data-op="${i}">${esc(o.text || 'Answer ' + (i + 1))}</button>`).join('')}</div>` : `<div class="opcoes"><button data-next>${seguinte ? 'Continue ▸' : 'Close'}</button></div>`}</div>`;
      el.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { const o = d.options[+b.dataset.op]; atual = o.next ? caixaPorId(o.next) : null; if (!atual) { el.innerHTML = '<div class="simFim">End of the scene.</div><div class="rodape"><button id="sim_fechar">Close</button></div>'; el.querySelector('#sim_fechar').onclick = fechar; } else mostrar(); });
      const nx = el.querySelector('[data-next]'); if (nx) nx.onclick = () => { if (!seguinte) return fechar(); atual = seguinte; mostrar(); };
    };
    mostrar();
  }, true);
}

// ------------------------------------------------------------ link popup (click on a card's ● port)
function fecharPopup() { const p = document.getElementById('popupLigacoes'); if (p) p.remove(); if (setaDestacada) { setaDestacada = null; desenharC(); } }
/* the links of a card (or box). From its ● (start of the arrows): where it leads. From the tip of an arrow: what comes into it.
   Hovering a line lights up its arrow; ✕ removes it. */
function abrirPopupLigacoes(n, cx, cy, modo = 'saida') {
  fecharPopup();
  const lista = abaC === 'caixas' ? caixasDaCena(noPorId(cenaAberta)) : campanha.nos; const por = id => lista.find(x => x.id === id); const nome = x => abaC === 'caixas' ? (x.title || (x.text || '').slice(0, 20) || 'box') : rotuloDoNo(x);
  let linhas;
  if (modo === 'saida') linhas = lista.filter(m => (m.depois || []).includes(n.id)).map(m => ({ de: n.id, para: m.id, op: null, rot: '→ ' + nome(m), tirar: () => desligar(n, m) }));
  else {
    linhas = (n.depois || []).map(por).filter(Boolean).map(m => ({ de: m.id, para: n.id, op: null, rot: '← ' + nome(m), tirar: () => desligar(m, n) }));
    if (abaC === 'caixas') lista.forEach(m => (m.type === 'choice' ? m.options : []).forEach((o, i) => { if (o.next === n.id) linhas.push({ de: m.id, para: n.id, op: i, rot: '← ' + nome(m) + ' · answer ' + (i + 1) + (o.text ? ' “' + o.text.slice(0, 18) + '”' : ''), tirar: () => { o.next = ''; } }); }));
  }
  const p = document.createElement('div'); p.id = 'popupLigacoes';
  const r = $('#centroC').getBoundingClientRect();
  p.style.left = Math.min(r.width - 300, Math.max(8, cx - r.left + 12)) + 'px'; p.style.top = Math.min(r.height - 60, Math.max(40, cy - r.top - 10)) + 'px';
  p.innerHTML = `<b>${esc(nome(n))}</b><div class="subtitulo">${modo === 'saida' ? 'Leads to' : 'Comes after (arrows into it)'}</div>${linhas.map((l, k) => `<div class="linha setaLinha" data-k="${k}"><span>${esc(l.rot)}</span><button class="sm" data-del="${k}" title="Remove this arrow">✕</button></div>`).join('') || (modo === 'saida' ? '<p class="ajuda">nothing yet: drag from the ● onto another card</p>' : '<p class="ajuda">nothing: available from the start</p>')}
    <p class="ajuda" style="margin-top:6px">${modo === 'saida' ? 'Point at a line to light its arrow. To see what comes into a card, click the tip of an arrow.' : 'Point at a line to light its arrow. To see where a card leads, click its ●.'}</p>
    <div style="text-align:right;margin-top:6px"><button class="sm" id="popFechar">Close</button></div>`;
  $('#centroC').appendChild(p);
  const acender = l => { setaDestacada = l ? { de: l.de, para: l.para, op: l.op } : (linhas.length === 1 ? { de: linhas[0].de, para: linhas[0].para, op: linhas[0].op } : null); desenharC(); };
  p.querySelectorAll('.setaLinha').forEach(d => { const l = linhas[+d.dataset.k]; d.onmouseenter = () => acender(l); d.onmouseleave = () => acender(null); });
  p.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { linhas[+b.dataset.del].tirar(); renderC(); abrirPopupLigacoes(n, cx, cy, modo); });
  p.querySelector('#popFechar').onclick = fecharPopup;
  acender(null);
}
/* the tip of the arrows coming into a card (or box): its left middle */
function pontaEm(px, py) {
  if (abaC === 'mundo') return null;
  for (const n of visiveis()) { const [x, y] = posDoNo(n); const h = tam()[1];
    const temEntrada = (n.depois || []).length || (abaC === 'caixas' && visiveis().some(m => m.type === 'choice' && m.options.some(o => o.next === n.id)));
    if (temEntrada && (px - x) ** 2 + (py - (y + h / 2)) ** 2 <= 11 ** 2) return n; }
  return null;
}

// ------------------------------------------------------------ canvas
const telaC = $('#telaC'), ctxC = telaC.getContext('2d');
function redimensionarC() { const r = telaC.getBoundingClientRect(); telaC.width = Math.max(1, r.width * devicePixelRatio); telaC.height = Math.max(1, r.height * devicePixelRatio); desenharC(); }
window.addEventListener('resize', () => { if (!$('#telaCampanha').hidden) redimensionarC(); });
const mundoParaPx = ([x, y]) => [MAPA_LIENZO[0] / 2 + x, MAPA_LIENZO[1] / 2 - y];
const pxParaMundo = (px, py) => [Math.round(px - MAPA_LIENZO[0] / 2), Math.round(MAPA_LIENZO[1] / 2 - py)];
function pontoC(ev) { const r = telaC.getBoundingClientRect(); return [(ev.clientX - r.left - vistaC.px) / vistaC.zoom, (ev.clientY - r.top - vistaC.py) / vistaC.zoom]; }
function posDoNo(n) { return abaC === 'mundo' ? mundoParaPx(n.coords || [0, 0]) : (n.fluxo || [0, 0]); }
function visiveis() { return abaC === 'mundo' ? campanha.nos.filter(noMapaMundi) : abaC === 'caixas' ? caixasDaCena(noPorId(cenaAberta)) : campanha.nos; }
const tam = () => abaC === 'caixas' ? CAIXA : CARTAO;
function alturaCaixa(d) { return CAIXA[1] + (d.type === 'choice' ? d.options.length * 18 : 0); }
function noEm(px, py) {
  const lista = visiveis(); const [w, h] = tam();
  for (let i = lista.length - 1; i >= 0; i--) { const n = lista[i]; const [x, y] = posDoNo(n); const hh = abaC === 'caixas' ? alturaCaixa(n) : h;
    if (abaC === 'mundo') { if ((px - x) ** 2 + (py - y) ** 2 <= 16 ** 2) return n; } else if (px >= x && px <= x + w && py >= y && py <= y + hh) return n; }
  return null;
}
/* the ● ports: a card's (or box's) output; on a question box, one per answer */
function portaEm(px, py) {
  if (abaC === 'mundo') return null;
  for (const n of visiveis()) { const [x, y] = posDoNo(n); const [w, h] = tam();
    if (abaC === 'caixas' && n.type === 'choice') { for (let i = 0; i < n.options.length; i++) { const cy = y + h - 10 + i * 18; if ((px - (x + w)) ** 2 + (py - cy) ** 2 <= 10 ** 2) return { n, op: i }; } continue; }
    const cx = x + w, cy = y + h / 2; if ((px - cx) ** 2 + (py - cy) ** 2 <= 10 ** 2) return { n, op: null }; }
  return null;
}
function ancorasAntes(n, vistos = new Set()) { const r = []; (n.depois || []).map(noPorId).filter(Boolean).forEach(a => { if (vistos.has(a.id)) return; vistos.add(a.id); if (ehAncora(a)) r.push(a); else r.push(...ancorasAntes(a, vistos)); }); return r; }

function desenharC() {
  if ($('#telaCampanha').hidden) return;
  const dpr = devicePixelRatio; ctxC.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = telaC.width / dpr, H = telaC.height / dpr;
  ctxC.fillStyle = COR.fundo; ctxC.fillRect(0, 0, W, H);
  ctxC.save(); ctxC.translate(vistaC.px, vistaC.py); ctxC.scale(vistaC.zoom, vistaC.zoom);
  if (abaC === 'mundo') desenharMundo(); else if (abaC === 'caixas') desenharCaixas(); else desenharFluxo();
  ctxC.restore();
}
function seta(x1, y1, x2, y2, cor, curva, largura = 2) {
  ctxC.strokeStyle = cor; ctxC.fillStyle = cor; ctxC.lineWidth = largura / vistaC.zoom; ctxC.beginPath(); ctxC.moveTo(x1, y1);
  if (curva) { const dx = Math.max(40, Math.abs(x2 - x1) / 2); ctxC.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2); } else ctxC.lineTo(x2, y2);
  ctxC.stroke();
  const a = curva ? 0 : Math.atan2(y2 - y1, x2 - x1);
  ctxC.beginPath(); ctxC.moveTo(x2, y2); ctxC.lineTo(x2 - 12 * Math.cos(a - .4), y2 - 12 * Math.sin(a - .4)); ctxC.lineTo(x2 - 12 * Math.cos(a + .4), y2 - 12 * Math.sin(a + .4)); ctxC.closePath(); ctxC.fill();
}
function grade() { ctxC.strokeStyle = COR.grade; ctxC.lineWidth = 1 / vistaC.zoom; ctxC.beginPath(); for (let x = -3000; x <= 6000; x += 50) { ctxC.moveTo(x, -3000); ctxC.lineTo(x, 4000); } for (let y = -3000; y <= 4000; y += 50) { ctxC.moveTo(-3000, y); ctxC.lineTo(6000, y); } ctxC.stroke(); }
function desenharFluxo() {
  grade();
  const simples = vistaC.zoom < 0.7;
  campanha.nos.forEach(n => (n.depois || []).forEach(id => { const a = noPorId(id); if (!a) return; const [ax, ay] = posDoNo(a), [bx, by] = posDoNo(n); const luz = ehSetaDestacada(a.id, n.id, null); seta(ax + CARTAO[0], ay + CARTAO[1] / 2, bx, by + CARTAO[1] / 2, luz ? COR.cobreClaro : 'rgba(200,190,170,.7)', true, luz ? 4 : 2); }));
  if (ligando && mouseC) { const [ax, ay] = posDoNo(ligando.n); seta(ax + CARTAO[0], ay + CARTAO[1] / 2, mouseC[0], mouseC[1], COR.cobreClaro, true); }
  campanha.nos.forEach(n => {
    const [x, y] = posDoNo(n); const selecionado = noSel === n.id; const cor = COR_NO[n.tipo];
    ctxC.fillStyle = '#23262d'; ctxC.strokeStyle = selecionado ? '#fff' : cor; ctxC.lineWidth = (selecionado ? 3 : 2) / vistaC.zoom;
    ctxC.beginPath(); ctxC.roundRect(x, y, CARTAO[0], CARTAO[1], 8); ctxC.fill(); ctxC.stroke();
    ctxC.fillStyle = cor; ctxC.beginPath(); ctxC.roundRect(x, y, 8, CARTAO[1], [8, 0, 0, 8]); ctxC.fill();
    if (simples) { ctxC.fillStyle = '#eef0f4'; ctxC.font = `bold ${22 / vistaC.zoom > 40 ? 40 : 22}px system-ui`; ctxC.textAlign = 'center'; ctxC.fillText(rotuloDoNo(n), x + CARTAO[0] / 2 + 4, y + CARTAO[1] / 2 + 8); ctxC.textAlign = 'left'; }
    else {
      let tx = x + 14;
      const cab = ehDialogo(n) ? caixaPorId(n.dialogo) : null; const face = cab && cab.speaker ? retratoImg('rosto:' + cab.speaker, rostoDe(cab.speaker)) : null;
      if (face && face.complete && face.naturalWidth) { ctxC.save(); ctxC.beginPath(); ctxC.arc(x + 32, y + CARTAO[1] / 2, 20, 0, Math.PI * 2); ctxC.clip(); ctxC.drawImage(face, x + 12, y + CARTAO[1] / 2 - 20, 40, 40); ctxC.restore(); tx = x + 58; }
      ctxC.fillStyle = cor; ctxC.font = `bold 10px system-ui`; ctxC.fillText(rotuloDoNo(n).toUpperCase() + (n.seEscolha ? ' · ONLY IF' : ''), tx, y + 16);
      ctxC.fillStyle = '#eef0f4'; ctxC.font = `bold 13px system-ui`; ctxC.fillText((nomeDoNo(n) === rotuloDoNo(n) ? '' : nomeDoNo(n)).slice(0, face ? 17 : 22), tx, y + 34);
      ctxC.fillStyle = COR.texto; ctxC.font = `10px system-ui`;
      const m = n.missao !== null && n.missao !== undefined ? campanha.missoes[n.missao] : null;
      const linha3 = m ? (n.missao === missaoAtual ? '▸ ' : '') + m.salas.length + (m.salas.length === 1 ? ' room' : ' rooms') + ' · progression ' + progressoDoMapa(m) : n.tipo === 'travel' ? 'world map: ' + n.coords[0] + ', ' + n.coords[1] : caixasDaCena(n).length + ' box(es)' + (cab && cab.speaker ? ' · ' + nomePersonagem(cab.speaker) : '');
      ctxC.fillText(linha3.slice(0, face ? 20 : 26), tx, y + 52);
    }
    ctxC.fillStyle = COR.cobreClaro; ctxC.beginPath(); ctxC.arc(x + CARTAO[0], y + CARTAO[1] / 2, 7, 0, Math.PI * 2); ctxC.fill(); ctxC.strokeStyle = '#1b1d22'; ctxC.lineWidth = 1.5 / vistaC.zoom; ctxC.stroke();
  });
}
function desenharCaixas() {
  grade();
  const n = noPorId(cenaAberta); const caixas = caixasDaCena(n);
  caixas.forEach(d => {
    (d.depois || []).forEach(id => { const a = caixaPorId(id); if (!a) return; const [ax, ay] = posDoNo(a), [bx, by] = posDoNo(d); const luz = ehSetaDestacada(a.id, d.id, null); seta(ax + CAIXA[0], ay + CAIXA[1] / 2, bx, by + CAIXA[1] / 2, luz ? COR.cobreClaro : 'rgba(200,190,170,.7)', true, luz ? 4 : 2); });
  });
  caixas.forEach(d => { if (d.type !== 'choice') return; const [x, y] = posDoNo(d); d.options.forEach((o, i) => { const alvo = o.next && caixaPorId(o.next); if (!alvo) return; const [bx, by] = posDoNo(alvo); const luz = ehSetaDestacada(d.id, alvo.id, i); seta(x + CAIXA[0], y + CAIXA[1] - 10 + i * 18, bx, by + CAIXA[1] / 2, luz ? COR.cobreClaro : 'rgba(180,143,224,.8)', true, luz ? 4 : 2); }); });
  if (ligando && mouseC) { const [ax, ay] = posDoNo(ligando.n); const oy = ligando.op !== null ? ay + CAIXA[1] - 10 + ligando.op * 18 : ay + CAIXA[1] / 2; seta(ax + CAIXA[0], oy, mouseC[0], mouseC[1], COR.cobreClaro, true); }
  caixas.forEach(d => {
    const [x, y] = posDoNo(d); const h = alturaCaixa(d); const selecionado = caixaSel === d.id; const cor = d.type === 'choice' ? COR_NO.scene : d.type === 'video' ? COR_NO.travel : COR_NO.dialogue;
    ctxC.fillStyle = '#23262d'; ctxC.strokeStyle = selecionado ? '#fff' : cor; ctxC.lineWidth = (selecionado ? 3 : 2) / vistaC.zoom; ctxC.beginPath(); ctxC.roundRect(x, y, CAIXA[0], h, 8); ctxC.fill(); ctxC.stroke();
    const face = d.speaker ? retratoImg('rosto:' + d.speaker, rostoDe(d.speaker)) : null; let tx = x + 10;
    if (face && face.complete && face.naturalWidth) { ctxC.save(); ctxC.beginPath(); ctxC.arc(x + 26, y + 26, 18, 0, Math.PI * 2); ctxC.clip(); ctxC.drawImage(face, x + 8, y + 8, 36, 36); ctxC.restore(); tx = x + 50; }
    ctxC.fillStyle = cor; ctxC.font = 'bold 10px system-ui'; ctxC.fillText((d.id === n.dialogo ? 'FIRST · ' : '') + (d.type === 'video' ? '▶ VIDEO' : (d.speaker ? nomePersonagem(d.speaker) : 'NARRATOR').toUpperCase().slice(0, 22)), tx, y + 18);
    ctxC.fillStyle = '#eef0f4'; ctxC.font = '11px system-ui';
    const linhas = quebrar(d.type === 'video' ? (d.video?.nome || '(no video yet)') : d.text || (d.title ? d.title : '(empty box)'), 30).slice(0, 3); linhas.forEach((l, i) => ctxC.fillText(l, x + 10, y + 38 + i * 14));
    if (d.acoes.length) { ctxC.fillStyle = COR.cobreClaro; ctxC.fillText('✦ ' + d.acoes.length + ' action(s)', x + 10, y + CAIXA[1] - 8); }
    if (d.type === 'choice') { d.options.forEach((o, i) => { const oy = y + CAIXA[1] - 10 + i * 18; ctxC.fillStyle = COR.texto; ctxC.font = '10px system-ui'; ctxC.fillText('▸ ' + (o.text || 'Answer ' + (i + 1)).slice(0, 28), x + 10, oy + 4); ctxC.fillStyle = COR_NO.scene; ctxC.beginPath(); ctxC.arc(x + CAIXA[0], oy, 6, 0, Math.PI * 2); ctxC.fill(); }); }
    else { ctxC.fillStyle = COR.cobreClaro; ctxC.beginPath(); ctxC.arc(x + CAIXA[0], y + CAIXA[1] / 2, 7, 0, Math.PI * 2); ctxC.fill(); ctxC.strokeStyle = '#1b1d22'; ctxC.lineWidth = 1.5 / vistaC.zoom; ctxC.stroke(); }
  });
}
function quebrar(t, n) { const palavras = String(t).split(/\s+/); const r = []; let l = ''; palavras.forEach(p => { if ((l + ' ' + p).trim().length > n) { r.push(l.trim()); l = p; } else l += ' ' + p; }); if (l.trim()) r.push(l.trim()); return r; }
/* the campaign's own world map: the picture covers the whole frame the game shows (1820×1024 units of the destinations'
   canvas, origin at the centre), a little more than the 1600×900 of the game's own picture */
const QUADRO_PROPRIO = [1820, 1024];
const limitesDoMundo = () => campanha?.meta?.mapaProprio ? [QUADRO_PROPRIO[0] / 2, QUADRO_PROPRIO[1] / 2] : [800, 450];
function imagemDoMapaProprio() {
  const a = campanha?.meta?.mapaProprio; const blob = a && AUDIOS[a.arquivo]; if (!blob) return null;
  const chave = 'mapaProprio:' + a.arquivo; if (!IMG[chave]) { const i = new Image(); i.onload = () => desenharC(); i.src = URL.createObjectURL(blob); IMG[chave] = i; }
  const i = IMG[chave]; return i.complete && i.naturalWidth ? i : null;
}
function campoMapaProprio(el) {
  if (!el) return; const m = campanha.meta; const mp = m.mapaProprio, ci = m.cidade;
  const linha = (rot, a, dado) => `<div class="linha"><label class="sm botaoArquivo">${a ? 'Replace…' : rot}<input type="file" accept="image/png,image/jpeg" data-img="${dado}" hidden></label>${a ? `<small>${esc(a.nome)}${AUDIOS[a.arquivo] ? '' : ' (file not in this browser)'}</small> <button class="sm" data-tira="${dado}" title="Back to the game's picture">✕</button>` : ''}</div>`;
  el.innerHTML = `<div class="sub">World map</div>${linha('Use my own world map…', mp, 'mapa')}
    ${mp ? `<label class="chk"><input type="checkbox" data-op="nuvens" ${m.nuvens !== false ? 'checked' : ''}> The game's clouds and birds over it</label>
    <label class="chk"><input type="checkbox" data-op="nevoa" ${m.nevoa ? 'checked' : ''}> The game's mist over it</label>` : ''}
    <p class="ajuda">PNG or JPG, 16:9 (1820×1024 fits exactly). It covers the whole frame the game shows; the game's water, burnt land, place names and roads are hidden. The mist covers a fixed region of the game's own map (the Mistlands).</p>
    ${mp ? camposDasEstradas() : ''}
    <div class="sub">City</div>${linha('Use my own city picture…', ci, 'cidade')}
    <p class="ajuda">The background of the city screen (shops, armory, crafting stay where they are).</p>`;
  el.querySelectorAll('[data-img]').forEach(inp => inp.onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const ext = (f.name.match(/\.(png|jpe?g)$/i) || [])[1]; if (!ext) return aviso('Use a PNG or JPG picture.');
    const qual = inp.dataset.img; const nome = (qual === 'mapa' ? 'worldmap-' : 'city-') + uid().slice(-6) + '.' + ext.toLowerCase().replace('jpeg', 'jpg');
    await guardarAudio(nome, f); if (qual === 'mapa') m.mapaProprio = { arquivo: nome, nome: f.name }; else m.cidade = { arquivo: nome, nome: f.name };
    renderEsqC(); desenharC();
  });
  el.querySelectorAll('[data-tira]').forEach(b => b.onclick = () => { if (b.dataset.tira === 'mapa') delete m.mapaProprio; else delete m.cidade; renderEsqC(); desenharC(); });
  el.querySelectorAll('[data-op]').forEach(ch => ch.onchange = () => { m[ch.dataset.op] = ch.checked; });
  if (mp) ligarEstradas(el);
}
/* roads on the campaign's own world map: lines of points [x, y] in world coordinates (y up). The game's travel walks
   the roads; between places no road joins, the mod draws a straight line. The city can move to any spot of the map. */
const CIDADE_DO_JOGO = MAPAS_DO_JOGO.cidade_act1 || null;
const estradasDoMapa = () => campanha.meta.estradas || (campanha.meta.estradas = []);
const lugarDaCidade = () => campanha?.meta?.posCidade || CIDADE_DO_JOGO;
const compEstrada = e => Math.round(e.slice(1).reduce((s, v, i) => s + Math.hypot(v[0] - e[i][0], v[1] - e[i][1]), 0));
function camposDasEstradas() {
  const m = campanha.meta; const es = estradasDoMapa();
  return `<div class="sub">Roads</div>
    <div class="linha"><button class="sm${estradaNova ? ' primario' : ''}" id="cEstrada">${estradaNova ? '✓ Finish this road' : '✎ Draw a road'}</button>${estradaNova ? '<button class="sm" id="cEstradaCancela">Cancel</button>' : ''}${es.length && !estradaNova ? '<button class="sm" id="cEstradasApagar">Delete all</button>' : ''}</div>
    <div class="listaEstradas">${es.map((e, i) => `<div class="linhaEstrada" data-estrada="${i}"><span>Road ${i + 1}</span><small>${e.length} points · ${compEstrada(e)} units</small><button class="sm" data-tira-estrada="${i}" title="Delete this road">✕</button></div>`).join('')}</div>
    <p class="ajuda">${estradaNova ? 'Click along the road on the map. Double-click or Enter ends it, Backspace takes back the last point, Esc cancels.' : 'Click along a road on the map. Points snap to the places, to the city and to the other roads, so crossings join.'} The party travels along the roads; between places that no road joins, it goes in a straight line. With no roads at all, every trip is a straight line.</p>
    <div class="sub">Where the city is</div>
    <div class="linha"><button class="sm${colocandoCidade ? ' primario' : ''}" id="cCidadeLugar">${colocandoCidade ? 'Click the map…' : 'Place the city…'}</button>${m.posCidade ? `<small>${m.posCidade.join(', ')}</small> <button class="sm" id="cCidadeVolta" title="Back to the game's spot">✕</button>` : `<small>${CIDADE_DO_JOGO ? "the game's spot" : "the game's spot (open the world map once in the game to see it here)"}</small>`}</div>
    <p class="ajuda">The city marker can also be dragged on the map.</p>`;
}
function ligarEstradas(el) {
  const m = campanha.meta;
  el.querySelector('#cEstrada').onclick = () => { if (estradaNova) terminarEstrada(); else { estradaNova = { pontos: [] }; colocandoCidade = false; renderEsqC(); desenharC(); } };
  const cancela = el.querySelector('#cEstradaCancela'); if (cancela) cancela.onclick = () => { estradaNova = null; renderEsqC(); desenharC(); };
  const apagar = el.querySelector('#cEstradasApagar'); if (apagar) apagar.onclick = () => { if (!confirm('Delete all ' + estradasDoMapa().length + ' road(s)?')) return; m.estradas = []; renderEsqC(); desenharC(); };
  el.querySelectorAll('[data-tira-estrada]').forEach(b => b.onclick = () => { estradasDoMapa().splice(+b.dataset.tiraEstrada, 1); estradaRealce = -1; renderEsqC(); desenharC(); });
  el.querySelectorAll('[data-estrada]').forEach(d => { d.onmouseenter = () => { estradaRealce = +d.dataset.estrada; desenharC(); }; d.onmouseleave = () => { estradaRealce = -1; desenharC(); }; });
  el.querySelector('#cCidadeLugar').onclick = () => { colocandoCidade = !colocandoCidade; estradaNova = null; renderEsqC(); };
  const volta = el.querySelector('#cCidadeVolta'); if (volta) volta.onclick = () => { delete m.posCidade; renderEsqC(); desenharC(); };
}
function terminarEstrada() {
  const pts = estradaNova ? estradaNova.pontos : []; estradaNova = null;
  if (pts.length >= 2) { estradasDoMapa().push(pts); aviso('Road ' + estradasDoMapa().length + ' drawn (' + pts.length + ' points).'); }
  else if (pts.length) aviso('A road needs two points at least.');
  renderEsqC(); desenharC();
}
const pertoDe = (a, b, tol) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
/* the point clicked, stuck to a place, the city, a point of a road, or the middle of a road (which then gets that
   point too, so the crossing joins) */
function pegaEstrada([x, y], inserir) {
  const tol = 14 / vistaC.zoom; const p = [x, y];
  const alvos = [...visiveis().map(n => n.coords), lugarDaCidade(), ...estradasDoMapa().flat(), ...(estradaNova ? estradaNova.pontos.slice(0, -1) : [])].filter(Boolean);
  let melhor = null, dm = tol;
  alvos.forEach(a => { const d = Math.hypot(a[0] - x, a[1] - y); if (d <= dm) { dm = d; melhor = a; } });
  if (melhor) return [melhor[0], melhor[1]];
  for (const e of estradasDoMapa()) for (let i = 0; i + 1 < e.length; i++) {
    const [ax, ay] = e[i], [bx, by] = e[i + 1]; const vx = bx - ax, vy = by - ay; const L2 = vx * vx + vy * vy; if (!L2) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / L2)); const q = [Math.round(ax + vx * t), Math.round(ay + vy * t)];
    if (Math.hypot(q[0] - x, q[1] - y) <= tol * .8) { if (inserir && t > 0 && t < 1) e.splice(i + 1, 0, q); return [q[0], q[1]]; }
  }
  return p;
}
function pontoDaEstrada(px, py) {
  const [lx, ly] = limitesDoMundo(); const [x, y] = pxParaMundo(px, py);
  const p = pegaEstrada([Math.max(-lx, Math.min(lx, x)), Math.max(-ly, Math.min(ly, y))], true);
  const pts = estradaNova.pontos; if (pts.length && pertoDe(pts[pts.length - 1], p, 1)) return;
  pts.push(p); desenharC();
}
function desenharEstradas() {
  ctxC.lineJoin = 'round'; ctxC.lineCap = 'round';
  const linha = (pts, cor, larg) => { if (pts.length < 2) return; ctxC.beginPath(); pts.forEach((v, i) => { const [x, y] = mundoParaPx(v); if (i) ctxC.lineTo(x, y); else ctxC.moveTo(x, y); }); ctxC.strokeStyle = cor; ctxC.lineWidth = larg / vistaC.zoom; ctxC.stroke(); };
  estradasDoMapa().forEach((e, i) => { linha(e, 'rgba(27,29,34,.85)', 7); linha(e, i === estradaRealce ? '#ffffff' : '#e0a458', 3.5); });
  if (estradaNova) {
    const pts = [...estradaNova.pontos]; if (mouseC && pts.length) pts.push(pegaEstrada(pxParaMundo(...mouseC), false));
    ctxC.setLineDash([10 / vistaC.zoom, 7 / vistaC.zoom]); linha(pts, 'rgba(27,29,34,.85)', 7); linha(pts, '#f3cf8f', 3.5); ctxC.setLineDash([]);
    ctxC.fillStyle = '#f3cf8f'; [...estradasDoMapa().flat(), ...estradaNova.pontos].forEach(v => { const [x, y] = mundoParaPx(v); ctxC.beginPath(); ctxC.arc(x, y, 3.5 / vistaC.zoom, 0, Math.PI * 2); ctxC.fill(); });
  }
  const c = lugarDaCidade(); if (!c) return;
  const [x, y] = mundoParaPx(c);
  ctxC.fillStyle = '#23262d'; ctxC.strokeStyle = movendoCidade ? '#fff' : COR.cobreClaro; ctxC.lineWidth = 2.5 / vistaC.zoom; ctxC.beginPath(); ctxC.roundRect(x - 14, y - 14, 28, 28, 6); ctxC.fill(); ctxC.stroke();
  ctxC.fillStyle = COR.cobreClaro; ctxC.font = 'bold 16px system-ui'; ctxC.textAlign = 'center'; ctxC.fillText('♜', x, y + 6); ctxC.textAlign = 'left';
  const t = 'City' + (campanha.meta.posCidade ? '' : " (the game's spot)"); ctxC.font = '12px system-ui'; const w = ctxC.measureText(t).width;
  ctxC.fillStyle = 'rgba(0,0,0,.6)'; ctxC.fillRect(x + 18, y - 9, w + 8, 17); ctxC.fillStyle = '#fff'; ctxC.fillText(t, x + 22, y + 3);
}
const cidadeEm = (px, py) => { const c = abaC === 'mundo' && campanha.meta.mapaProprio && lugarDaCidade(); if (!c) return false; const [x, y] = mundoParaPx(c); return Math.abs(px - x) <= 15 && Math.abs(py - y) <= 15; };
const verticesEm = c => estradasDoMapa().flatMap(e => e.filter(v => pertoDe(v, c, 2)));
function desenharMundo() {
  const im = IMG['worldmap']; const prop = imagemDoMapaProprio();
  if (prop) { ctxC.imageSmoothingQuality = 'high'; const [x0, y0] = mundoParaPx([-QUADRO_PROPRIO[0] / 2, QUADRO_PROPRIO[1] / 2]); ctxC.drawImage(prop, x0, y0, QUADRO_PROPRIO[0], QUADRO_PROPRIO[1]); }
  else if (im && im.complete && im.naturalWidth) { ctxC.imageSmoothingQuality = 'high'; ctxC.drawImage(im, 0, 0, MAPA_LIENZO[0], MAPA_LIENZO[1]); } else { ctxC.fillStyle = '#2a2d35'; ctxC.fillRect(0, 0, MAPA_LIENZO[0], MAPA_LIENZO[1]); }
  { const [lx, ly] = limitesDoMundo(); const [bx, by] = mundoParaPx([-lx, ly]); ctxC.strokeStyle = COR.gradeForte; ctxC.lineWidth = 2 / vistaC.zoom; ctxC.strokeRect(bx, by, lx * 2, ly * 2); }
  if (!prop) ctxC.globalAlpha = .5; if (!prop) OFICIAIS.forEach(d => { const [x, y] = mundoParaPx(d.coords); ctxC.fillStyle = '#eef0f4'; ctxC.beginPath(); ctxC.arc(x, y, 5, 0, Math.PI * 2); ctxC.fill(); }); ctxC.globalAlpha = 1;
  if (campanha.meta.mapaProprio) desenharEstradas();
  const lista = visiveis();
  lista.forEach(n => ancorasAntes(n).forEach(a => { const [ax, ay] = posDoNo(a), [bx, by] = posDoNo(n); ctxC.setLineDash([6, 4]); seta(ax, ay, bx, by, 'rgba(255,255,255,.6)', false); ctxC.setLineDash([]); }));
  lista.forEach(n => {
    const [x, y] = posDoNo(n); const selecionado = noSel === n.id; const mk = n.marcador || 'main';
    ctxC.fillStyle = mk === 'main' ? COR_NO.map : mk === 'side' ? COR_NO.side : mk === 'narrative' ? COR_NO.travel : '#c7cbd3'; ctxC.beginPath(); ctxC.arc(x, y, 13, 0, Math.PI * 2); ctxC.fill();
    ctxC.strokeStyle = selecionado ? '#fff' : '#1b1d22'; ctxC.lineWidth = (selecionado ? 3.5 : 2) / vistaC.zoom; ctxC.stroke();
    ctxC.fillStyle = '#1b1d22'; ctxC.font = `bold 14px system-ui`; ctxC.textAlign = 'center'; ctxC.fillText(mk === 'main' ? '✦' : mk === 'side' ? '◆' : mk === 'narrative' ? '✎' : '⌂', x, y + 5); ctxC.textAlign = 'left';
    const t = rotuloDoNo(n) + (nomeDoNo(n) !== rotuloDoNo(n) ? ' · ' + nomeDoNo(n) : ''); ctxC.font = `12px system-ui`; const w = ctxC.measureText(t).width;
    ctxC.fillStyle = 'rgba(0,0,0,.6)'; ctxC.fillRect(x + 17, y - 9, w + 8, 17); ctxC.fillStyle = '#fff'; ctxC.fillText(t, x + 21, y + 3);
  });
}
function enquadrarC() {
  const r = telaC.getBoundingClientRect(); if (!r.width) return;
  let x0, y0, x1, y1; const [w, h] = tam();
  if (abaC === 'mundo') { const [lx, ly] = limitesDoMundo(); [x0, y0] = mundoParaPx([-lx, ly]); [x1, y1] = mundoParaPx([lx, -ly]); }
  else { const ps = visiveis().map(posDoNo); if (!ps.length) { vistaC.zoom = 1; vistaC.px = 60; vistaC.py = 60; return desenharC(); } x0 = Math.min(...ps.map(p => p[0])); y0 = Math.min(...ps.map(p => p[1])); x1 = Math.max(...ps.map(p => p[0])) + w; y1 = Math.max(...ps.map(p => p[1])) + h + 40; }
  vistaC.zoom = Math.min(2, Math.max(0.2, Math.min(r.width / (x1 - x0 + 120), r.height / (y1 - y0 + 120))));
  vistaC.px = r.width / 2 - (x0 + x1) / 2 * vistaC.zoom; vistaC.py = r.height / 2 - (y0 + y1) / 2 * vistaC.zoom; desenharC();
}
function zoomC(f) { const r = telaC.getBoundingClientRect(); const mx = r.width / 2, my = r.height / 2; const z = Math.min(3, Math.max(0.15, vistaC.zoom * f)); const k = z / vistaC.zoom; vistaC.px = mx - (mx - vistaC.px) * k; vistaC.py = my - (my - vistaC.py) * k; vistaC.zoom = z; desenharC(); }
telaC.addEventListener('contextmenu', ev => ev.preventDefault());
telaC.addEventListener('mousedown', ev => {
  fecharPopup();
  if (ev.button === 2 || ev.shiftKey || ev.button === 1) { arrastoC = { x: ev.clientX, y: ev.clientY, px: vistaC.px, py: vistaC.py }; return; }
  if (ev.button !== 0) return;
  const [px, py] = pontoC(ev);
  if (abaC === 'mundo' && estradaNova) { pontoDaEstrada(px, py); return; }
  if (abaC === 'mundo' && colocandoCidade) { const [lx, ly] = limitesDoMundo(); const [x, y] = pxParaMundo(px, py); campanha.meta.posCidade = [Math.max(-lx, Math.min(lx, x)), Math.max(-ly, Math.min(ly, y))]; colocandoCidade = false; renderEsqC(); desenharC(); return; }
  if (cidadeEm(px, py)) { const c = lugarDaCidade(); const [cx, cy] = mundoParaPx(c); movendoCidade = { dx: px - cx, dy: py - cy, grudados: verticesEm(c), moveu: false }; desenharC(); return; }
  const ponta = !portaEm(px, py) && pontaEm(px, py);
  if (ponta) { if (abaC === 'caixas') caixaSel = ponta.id; else noSel = ponta.id; renderEsqC(); renderDirC(); const [x, y] = posDoNo(ponta); const R = telaC.getBoundingClientRect(); abrirPopupLigacoes(ponta, R.left + vistaC.px + x * vistaC.zoom, R.top + vistaC.py + (y + tam()[1] / 2) * vistaC.zoom, 'entrada'); desenharC(); return; }
  const p = portaEm(px, py); if (p) { ligando = p; ligacao = { moveu: false, clique: [ev.clientX, ev.clientY] }; if (abaC === 'caixas') caixaSel = p.n.id; else noSel = p.n.id; renderEsqC(); renderDirC(); return; }
  const n = noEm(px, py);
  if (n) { if (abaC === 'caixas') caixaSel = n.id; else noSel = n.id; movendoNo = { n, dx: px - posDoNo(n)[0], dy: py - posDoNo(n)[1], moveu: false, grudados: abaC === 'mundo' && n.coords ? verticesEm(n.coords) : [] }; renderEsqC(); renderDirC(); desenharC(); }
  else { arrastoC = { x: ev.clientX, y: ev.clientY, px: vistaC.px, py: vistaC.py, limpar: true }; }
});
telaC.addEventListener('mousemove', ev => {
  if (arrastoC) { vistaC.px = arrastoC.px + (ev.clientX - arrastoC.x); vistaC.py = arrastoC.py + (ev.clientY - arrastoC.y); arrastoC.moveu = true; desenharC(); return; }
  const [px, py] = pontoC(ev); mouseC = [px, py];
  if (estradaNova && abaC === 'mundo') { telaC.style.cursor = 'crosshair'; desenharC(); return; }
  if (colocandoCidade && abaC === 'mundo') { telaC.style.cursor = 'crosshair'; return; }
  if (movendoCidade) { const [lx, ly] = limitesDoMundo(); const [wx, wy] = pxParaMundo(px - movendoCidade.dx, py - movendoCidade.dy); const c = [Math.max(-lx, Math.min(lx, wx)), Math.max(-ly, Math.min(ly, wy))]; campanha.meta.posCidade = c; movendoCidade.grudados.forEach(v => { v[0] = c[0]; v[1] = c[1]; }); movendoCidade.moveu = true; desenharC(); return; }
  if (movendoNo) { const { n, dx, dy } = movendoNo; movendoNo.moveu = true; if (abaC === 'mundo') { const [wx, wy] = pxParaMundo(px - dx, py - dy); const [lx, ly] = limitesDoMundo(); n.coords = [Math.max(-lx, Math.min(lx, wx)), Math.max(-ly, Math.min(ly, wy))]; (movendoNo.grudados || []).forEach(v => { v[0] = n.coords[0]; v[1] = n.coords[1]; }); } else n.fluxo = [Math.round((px - dx) / 10) * 10, Math.round((py - dy) / 10) * 10]; desenharC(); return; }
  if (ligando) { if (Math.hypot(ev.clientX - ligacao.clique[0], ev.clientY - ligacao.clique[1]) > 6) ligacao.moveu = true; desenharC(); return; }
  telaC.style.cursor = portaEm(px, py) || pontaEm(px, py) ? 'pointer' : noEm(px, py) || cidadeEm(px, py) ? 'grab' : 'default';
});
window.addEventListener('mouseup', ev => {
  if (arrastoC) { const a = arrastoC; arrastoC = null; if (a.limpar && !a.moveu) { if (abaC === 'caixas') caixaSel = null; else noSel = null; renderC(); } }
  if (ligando) {
    const de = ligando; ligando = null; const moveu = ligacao && ligacao.moveu; ligacao = null;
    const [w, h] = tam();
    if (!moveu) { if (de.op === null) { const [x, y] = posDoNo(de.n); abrirPopupLigacoes(de.n, telaC.getBoundingClientRect().left + vistaC.px + (x + w) * vistaC.zoom, telaC.getBoundingClientRect().top + vistaC.py + (y + h / 2) * vistaC.zoom, 'saida'); } else { de.n.options[de.op].next = ''; aviso('Answer unlinked.'); renderC(); } desenharC(); return; }
    const [px, py] = pontoC(ev); const alvo = noEm(px, py);
    if (alvo && alvo !== de.n) {
      if (abaC === 'caixas') {
        if (de.op !== null) { de.n.options[de.op].next = alvo.id; aviso('Answer ' + (de.op + 1) + ' leads to that box.'); }
        else if (de.n.type === 'choice') aviso('A question links through its answers: drag from an answer’s ●.');
        else if (campanha.dialogos.some(x => x !== alvo && (x.depois || []).includes(de.n.id))) aviso('A plain box leads to one box only. Remove the existing link first (click its ●), or turn the box into a question to branch.');
        else if (ligar(de.n, alvo)) aviso('Linked.');
      } else if (ligar(de.n, alvo)) aviso('“' + rotuloDoNo(alvo) + '” comes after “' + rotuloDoNo(de.n) + '”.');
    }
    renderC(); return;
  }
  if (movendoNo) { const m = movendoNo; movendoNo = null; if (m.moveu) renderDirC(); }
  if (movendoCidade) { const m = movendoCidade; movendoCidade = null; if (m.moveu) renderEsqC(); desenharC(); }
});
telaC.addEventListener('dblclick', ev => { if (estradaNova && abaC === 'mundo') { terminarEstrada(); return; } const [px, py] = pontoC(ev); const n = noEm(px, py);
  if (abaC === 'caixas') { if (!n) { const d = novaCaixa(noPorId(cenaAberta)); d.fluxo = [Math.round(px / 10) * 10, Math.round(py / 10) * 10]; caixaSel = d.id; renderC(); } return; }
  if (!n) return; if (n.missao !== null && n.missao !== undefined) { trocarMissao(n.missao); fecharCampanha(); } else if (ehDialogo(n)) abrirCaixas(n); });
telaC.addEventListener('wheel', ev => { ev.preventDefault(); const r = telaC.getBoundingClientRect(); const mx = ev.clientX - r.left, my = ev.clientY - r.top; const f = ev.deltaY < 0 ? 1.15 : 1 / 1.15; const z = Math.min(3, Math.max(0.15, vistaC.zoom * f)); const k = z / vistaC.zoom; vistaC.px = mx - (mx - vistaC.px) * k; vistaC.py = my - (my - vistaC.py) * k; vistaC.zoom = z; desenharC(); }, { passive: false });
window.addEventListener('keydown', ev => {
  if ($('#telaCampanha').hidden || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || $('.modal')) return;
  if (abaC === 'mundo' && (estradaNova || colocandoCidade)) {
    if (ev.key === 'Escape') { estradaNova = null; colocandoCidade = false; renderEsqC(); desenharC(); ev.preventDefault(); return; }
    if (ev.key === 'Enter' && estradaNova) { terminarEstrada(); ev.preventDefault(); return; }
    if (ev.key === 'Backspace' && estradaNova) { estradaNova.pontos.pop(); desenharC(); ev.preventDefault(); return; }
  }
  if (ev.key === 'Escape') { if (ligando) { ligando = null; desenharC(); } else if (document.getElementById('popupLigacoes')) fecharPopup(); else if (abaC === 'caixas') mudarAba('fluxo'); else fecharCampanha(); return; }
  const n = abaC === 'caixas' ? (caixaSel && caixaPorId(caixaSel)) : (noSel && noPorId(noSel));
  if (ev.key.startsWith('Arrow')) {
    ev.preventDefault();
    const dx = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0, dy = ev.key === 'ArrowUp' ? -1 : ev.key === 'ArrowDown' ? 1 : 0;
    if (n && (abaC !== 'mundo' || noMapaMundi(n))) { if (abaC === 'mundo') n.coords = [n.coords[0] + dx * 10, n.coords[1] - dy * 10]; else n.fluxo = [(n.fluxo || [0, 0])[0] + dx * 10, (n.fluxo || [0, 0])[1] + dy * 10]; desenharC(); renderDirC(); }
    else { vistaC.px -= dx * 60; vistaC.py -= dy * 60; desenharC(); }
    return;
  }
  if (ev.key === '+' || ev.key === '=') { zoomC(1.2); return; } if (ev.key === '-' || ev.key === '_') { zoomC(1 / 1.2); return; }
  if (ev.key === 'Delete' && n) { if (abaC === 'caixas') { $('#d_apagar')?.click(); } else { apagarNo(n.id); renderC(); renderCabecalho(); } }
});

/* who unlocks a map card: the "Unlock a campaign map" triggers that point to it, in any map of the campaign */
function quemDesbloqueia(n) {
  const r = []; campanha.missoes.forEach((mp, mi) => { const ant = projeto; projeto = mp; try { (mp.salas || []).forEach(ss => donosDaSala(ss).forEach(({ o }) => todosGatilhos(o).forEach(g => { if (g.tipo === 'unlock_map' && noDoDesbloqueio(g)?.id === n.id) r.push(rotulo(o) + ' (' + (mp.meta.name || 'map ' + (mi + 1)) + ')'); }))); (mp.contadores || []).forEach(c => todosGatilhos(c).forEach(g => { if (g.tipo === 'unlock_map' && noDoDesbloqueio(g)?.id === n.id) r.push(rotulo(c) + ' (' + (mp.meta.name || 'map ' + (mi + 1)) + ')'); })); } finally { projeto = ant; } });
  return r;
}

// ------------------------------------------------------------ Starting inventory (a party of veterans)
/* what the party already holds when the campaign starts, won in battles before it: gold, items of the Workshop (one of
   each; materials in any number), weapon parts and skills. The mod gives them to the new party; the generators leave the
   unique ones (armor, trinkets, weapon parts) out of the item pools, and the game never draws an item the party has */
const EMPILHAVEIS = new Set(['CraftingMaterialModel']);
function inventarioInicial() { const v = campanha.inventario = campanha.inventario || {}; v.itens = v.itens || []; v.pericias = v.pericias || []; v.ouro = Math.max(0, +v.ouro || 0); return v; }
const clsDoItem = id => ITENS_B().find(i => i.id === id)?.cls || (CAT.itens || []).find(i => i._id === id)?._cls || '';
const nomeItemInicial = id => ITENS_B().find(i => i.id === id)?.nome || (CAT.itens || []).find(i => i._id === id)?.name_en || nomeItem(id);
/* the unique items of the starting inventory (a pool never offers them again) */
function itensIniciaisUnicos() { if (!campanha || !campanha.inventario) return new Set(); return new Set((campanha.inventario.itens || []).filter(x => !EMPILHAVEIS.has(clsDoItem(x.id))).map(x => x.id)); }
function inventarioExportado() {
  if (!campanha || !campanha.inventario) return null; const v = inventarioInicial();
  if (!v.ouro && !v.itens.length && !v.pericias.length) return null;
  return { gold: v.ouro, items: v.itens.map(x => ({ item: idItemExportado(x.id), qty: EMPILHAVEIS.has(clsDoItem(x.id)) ? Math.max(1, +x.qtd || 1) : 1 })), skills: v.pericias.slice() };
}
/* the picture of an item: the Workshop's portrait, else the game's (by its name or the file of its texture) */
function iconeDoItemInicial(id) {
  const w = ITENS_B().find(i => i.id === id); if (w) { const r = retratoDoItem(w); if (r) return r; }
  const rec = (CAT.receitas || []).find(r => r._id === id); if (rec) return iconeDoItemInicial(rec.CraftedItemId);
  const c = (CAT.itens || []).find(i => i._id === id); if (!c) return '';
  const arq = (c.TextureAssetPath || '').split('/').pop().replace(/\.(png|jpg)$/i, '');
  return RETRATOS.itens[c._name] || RETRATOS.itens[c.name_en] || RETRATOS.itens[arq] || '';
}
/* every item a party could already hold, by kind: the game's (local data) and the Workshop's (its own, or replacing a game one) */
function catalogoDoInventario() {
  const kinds = [['CraftingMaterialModel', 'Materials'], ['ConsumableModel', 'Consumables'], ['ArmorModel', 'Armor'], ['TrinketModel', 'Trinkets'], ['WeaponPartsModel', 'Weapon parts']];
  const doJogo = cls => (CAT.itens || []).filter(i => i._cls === cls && !/_UPGRADED$/.test(i._id)).map(i => ({ id: i._id, nome: i.name_en || i._name || i._id }));
  const daOficina = cls => ITENS_B().filter(i => (cls === 'WeaponPartsModel' ? i.cls === cls : doTipoItem(i, cls))).map(i => ({ id: i.id, nome: i.nome || i.id, base: i.base }));
  const grupos = kinds.map(([cls, nome]) => { const of = daOficina(cls); const tiradas = new Set(of.map(x => x.base).filter(Boolean));
    return { cls, nome, itens: of.concat(doJogo(cls).filter(x => !tiradas.has(x.id) && !of.some(o => o.id === x.id))) }; });
  const receitas = (CAT.receitas || []).map(r => ({ id: r._id, nome: (nomeItemInicial(r.CraftedItemId) || r._id) })).concat((oficina().receitas || []).map(r => ({ id: 'RECEITA:' + r.id, nome: nomeReceita(r) })));
  grupos.push({ cls: 'RecipeModel', nome: 'Recipes', itens: receitas });
  return grupos.filter(g => g.itens.length);
}
/* a save of the game (SavedGames/<slot>/*.sav, plain JSON): gold, materials with their counts, items (and what the heroes have
   equipped), recipes found and skills unlocked */
function inventarioDoSave(texto) {
  const d = JSON.parse(texto); const g = d.GameSceneData?.GameState || d.GameState || d; if (!g || (g.Gold == null && !g.ItemInventory)) throw new Error('not a save of the game');
  const itens = []; const por = (id, qtd) => { if (!id) return; const x = itens.find(y => y.id === id); if (x) x.qtd = Math.max(x.qtd, qtd || 1); else itens.push({ id, qtd: qtd || 1 }); };
  (g.CraftingMaterials || []).forEach(m => { if (m.Qty > 0) por(m.Id, m.Qty); });
  (g.ItemInventory || []).forEach(m => por(m.Id, 1));
  (g.QuestConsumables || []).forEach(m => por(m.Id, m.Qty || 1));
  (g.DiscoveredRecipes || []).forEach(m => por(m.Id, 1));
  (g.AllPlayers || d.AllPlayers || []).forEach(pl => { por(pl.EquippedTrinketId, 1); (pl.EquippedWeapons || []).forEach(w => [w.PartAId, w.PartBId, w.PartCId].forEach(x => por(x, 1))); });
  return { ouro: Math.max(0, +g.Gold || 0), itens, pericias: (g.UnlockedSkills || []).slice(), grupo: d.PartyName || g.PartyName || '' };
}
let filtroInventario = { texto: '', soTem: false };
/* a game id as the list shows it: the Workshop's item that stands for it, when there is one */
const idNaLista = id => ITENS_B().find(i => i.base === id)?.id || id;
function abrirInventario() {
  const v = inventarioInicial();
  // (ids of the game, from a save or from before, become the Workshop's item that stands for them; twins merge)
  { const junta = []; v.itens.forEach(x => { const id = idNaLista(x.id); const j = junta.find(y => y.id === id); if (j) j.qtd = Math.max(+j.qtd || 1, +x.qtd || 1); else junta.push({ ...x, id }); }); v.itens = junta; }
  const qtdDe = id => v.itens.find(x => x.id === id);
  const grupos = catalogoDoInventario(); const conhecidos = new Set(grupos.flatMap(g => g.itens.map(i => i.id)));
  const outros = v.itens.filter(x => !conhecidos.has(x.id)).map(x => ({ id: x.id, nome: nomeItemInicial(x.id) }));
  if (outros.length) grupos.push({ cls: '', nome: 'Others', itens: outros });
  const empilha = (cls, id) => cls === 'CraftingMaterialModel' || EMPILHAVEIS.has(clsDoItem(id));
  const letra = n => esc(((n || '?').trim()[0] || '?').toUpperCase());
  const ficha = (g, it) => { const tem = qtdDe(it.id); const img = iconeDoItemInicial(it.id); const pilha = empilha(g.cls, it.id);
    return `<div class="invItem${tem ? ' tem' : ''}" data-inv="${esc(it.id)}" data-nome="${esc((it.nome || '').toLowerCase())}">
      ${img ? `<img src="${img}" alt="" loading="lazy">` : `<span class="invLetra">${letra(it.nome)}</span>`}
      <span class="invNome" data-sem-traducao title="${esc(it.nome)}">${esc(it.nome)}</span>
      ${pilha ? `<span class="invQtd"><button class="sm" data-menos>−</button><input type="number" min="0" max="9999" value="${tem ? Math.max(1, +tem.qtd || 1) : 0}" data-qtd><button class="sm" data-mais>+</button></span>` : `<input type="checkbox" ${tem ? 'checked' : ''} data-marca>`}</div>`; };
  const skills = HEROIS_IDS.map(h => ({ h, nome: nomeDoHeroi(h), img: retratoDoHeroi(h), l: periciasParaPremio(h) })).filter(x => x.l.length);
  const total = () => `${v.itens.length} ${tr('items')} · ${v.pericias.length} ${tr('skills')} · ${v.ouro} ${tr('gold')}`;
  janelaFlutuante('janelaInventario', 'Starting inventory', `<p class="ajuda">For a party of veterans: what it already holds when the campaign starts, won in earlier battles. The party receives it when the campaign begins. Tick the items it has; type how many of the materials. The item pools of the generated maps leave out the unique items the party already has, and the game never gives an item twice.</p>
    <div class="invTopo">
      <label class="invOuro"><span class="moeda">●</span> <span>Starting gold</span> <input type="number" min="0" id="inv_ouro" value="${v.ouro}"></label>
      <label class="sm botaoArquivo" title="The game keeps its saves in Legends of the Dark_Data/SavedGames/&lt;slot&gt;/ (the newest .sav file of a slot)">📂 Import a save of the game (.sav)<input type="file" accept=".sav,.backup,.json,application/json" id="inv_sav" hidden></label>
      <button class="sm" id="inv_limpar">Clear all</button>
      <input type="search" id="inv_busca" placeholder="${esc(tr('Search an item…'))}" value="${esc(filtroInventario.texto)}">
      <label class="chk"><input type="checkbox" id="inv_so" ${filtroInventario.soTem ? 'checked' : ''}> Only what the party has</label>
      <span class="ajuda" id="inv_total">${total()}</span>
    </div>
    ${grupos.map(g => `<details class="invGrupo" open data-cls="${g.cls}"><summary><span>${esc(tr(g.nome))}</span> <small class="etq">${g.itens.filter(i => qtdDe(i.id)).length} / ${g.itens.length}</small></summary><div class="invGrade">${g.itens.map(it => ficha(g, it)).join('')}</div></details>`).join('')}
    ${ITENS_B().length || (CAT.itens || []).length ? '' : '<p class="ajuda aviso">The Workshop has no items yet: import them in the Items tab.</p>'}
    <details class="invGrupo" open><summary><span>${tr('Skills (unlocked)')}</span> <small class="etq">${v.pericias.length}</small></summary>
      ${skills.map(x => `<div class="invHeroi">${x.img ? `<img class="redondo grande" src="${x.img}" alt="">` : ''}<b data-sem-traducao>${esc(x.nome)}</b></div><div class="invGrade">${x.l.map(sk => `<label class="invItem pericia${v.pericias.includes(sk.id) ? ' tem' : ''}"><input type="checkbox" data-per="${esc(sk.id)}" ${v.pericias.includes(sk.id) ? 'checked' : ''}><span class="invNome" data-sem-traducao>${esc(sk.nome)}</span></label>`).join('')}</div>`).join('') || '<span class="ajuda">None.</span>'}
    </details>`, (el) => {
    const volta = () => abrirInventario();
    const atualizar = () => { el.querySelector('#inv_total').textContent = total(); el.querySelectorAll('.invGrupo[data-cls]').forEach(d => { const e = d.querySelector('summary .etq'); const its = [...d.querySelectorAll('[data-inv]')]; if (e) e.textContent = its.filter(x => qtdDe(x.dataset.inv)).length + ' / ' + its.length; }); };
    const filtrar = () => { const t = filtroInventario.texto.toLowerCase().trim(); el.querySelectorAll('.invItem').forEach(x => { const nome = x.dataset.nome ?? x.textContent.toLowerCase(); const tem = x.dataset.inv ? !!qtdDe(x.dataset.inv) : !!x.querySelector('input:checked');
      x.hidden = (t && !nome.includes(t)) || (filtroInventario.soTem && !tem); }); };
    const porQtd = (id, q) => { const x = qtdDe(id); if (q > 0) { if (x) x.qtd = q; else v.itens.push({ id, qtd: q }); } else if (x) v.itens.splice(v.itens.indexOf(x), 1);
      const f = el.querySelector(`[data-inv="${CSS.escape(id)}"]`); if (f) f.classList.toggle('tem', q > 0); atualizar(); };
    el.querySelector('#inv_ouro').onchange = e => { v.ouro = Math.max(0, +e.target.value || 0); atualizar(); };
    el.querySelector('#inv_busca').oninput = e => { filtroInventario.texto = e.target.value; filtrar(); };
    el.querySelector('#inv_so').onchange = e => { filtroInventario.soTem = e.target.checked; filtrar(); };
    el.querySelector('#inv_limpar').onclick = () => { if (!confirm(tr('Clear the whole starting inventory?'))) return; v.itens = []; v.pericias = []; v.ouro = 0; volta(); };
    el.querySelector('#inv_sav').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader();
      r.onload = () => { try { const s = inventarioDoSave(r.result);
          if ((v.itens.length || v.pericias.length || v.ouro) && !confirm(tr('Replace the starting inventory with the one of this save?'))) return;
          v.ouro = s.ouro; v.itens = s.itens; v.pericias = s.pericias; volta();
          aviso(tr('Imported from the save') + (s.grupo ? ' «' + s.grupo + '»' : '') + ': ' + s.itens.length + ' ' + tr('items') + ', ' + s.pericias.length + ' ' + tr('skills') + ', ' + s.ouro + ' ' + tr('gold') + '.'); }
        catch (ex) { alert(tr('This file is not a save of the game.') + '\n' + ex.message); } };
      r.readAsText(f); };
    el.addEventListener('click', e => { const f = e.target.closest('[data-inv]'); if (!f) return; const inp = f.querySelector('[data-qtd]');
      if (e.target.matches('[data-menos],[data-mais]')) { e.preventDefault(); const q = Math.max(0, (+inp.value || 0) + (e.target.matches('[data-mais]') ? 1 : -1)); inp.value = q; porQtd(f.dataset.inv, q); return; }
      if (inp || e.target.matches('input')) return;
      const cb = f.querySelector('[data-marca]'); if (cb) { cb.checked = !cb.checked; porQtd(f.dataset.inv, cb.checked ? 1 : 0); } });
    el.addEventListener('change', e => { const f = e.target.closest('[data-inv]');
      if (f && e.target.matches('[data-qtd]')) { const q = Math.max(0, Math.min(9999, Math.round(+e.target.value || 0))); e.target.value = q; porQtd(f.dataset.inv, q); }
      else if (f && e.target.matches("[data-marca]")) porQtd(f.dataset.inv, e.target.checked ? 1 : 0);
      else if (e.target.matches('[data-per]')) { const id = e.target.dataset.per; if (e.target.checked) { if (!v.pericias.includes(id)) v.pericias.push(id); } else v.pericias = v.pericias.filter(x => x !== id); e.target.closest('.invItem').classList.toggle('tem', e.target.checked); atualizar(); } });
    filtrar();
  }, true);
}
