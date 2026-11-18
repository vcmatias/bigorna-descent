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
const COR_NO = { map: '#e0a458', side: '#e5c15a', travel: '#69b4a1', dialogue: '#8fa8ff', scene: '#b48fe0', branch: '#d98ab4' };
const NOME_TIPO = { map: 'Map', side: 'Side quest', travel: 'Waypoint', dialogue: 'Scene', scene: 'Scene', branch: 'Crossroads' };
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
  if (tipo === 'branch') { n.saidas = [{ cond: null, para: '' }]; n.outros = ''; }
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
  c.nos = c.nos.filter(n => ehDialogo(n) || n.tipo === 'travel' || n.tipo === 'branch' || c.missoes[n.missao]);
  c.nos.forEach(n => { if (n.tipo === 'event') n.tipo = 'travel'; if (!n.marcador || !marcadoresDe(n).some(([v]) => v === n.marcador)) n.marcador = n.tipo === 'side' ? 'side' : n.tipo === 'map' ? 'main' : 'narrative'; });
  c.nos.forEach(n => { if (!n.num) n.num = proximoNum(n.tipo); });
  c.nos.filter(n => n.tipo === 'branch').forEach(sincronizarRamo);
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
/* the boxes of a scene laid out left to right: each column one step further from the first box along the arrows (the
   plain ones and the answers of a question), the branches one under the other; boxes no arrow reaches go last */
function arrumarCaixas(n) {
  const cx = caixasDaCena(n); if (!cx.length) return; const ids = new Set(cx.map(d => d.id));
  const saidas = d => [...cx.filter(x => (x.depois || []).includes(d.id)).map(x => x.id), ...(d.type === 'choice' ? d.options.map(o => o.next).filter(id => ids.has(id)) : [])];
  const prof = {}; const fila = [n.dialogo && ids.has(n.dialogo) ? n.dialogo : cx[0].id]; prof[fila[0]] = 0;
  // (longest path, guarded: a box is pushed further only up to the number of boxes)
  for (let k = 0; k < fila.length && k < cx.length * cx.length; k++) { const d = caixaPorId(fila[k]); saidas(d).forEach(id => { if (prof[id] === undefined || (prof[id] < prof[d.id] + 1 && prof[d.id] + 1 < cx.length)) { prof[id] = prof[d.id] + 1; fila.push(id); } }); }
  const fim = Math.max(0, ...Object.values(prof)) + 1; const linhas = {};
  cx.forEach(d => { const c = prof[d.id] ?? fim; const y = linhas[c] || 0; d.fluxo = [c * 240, y]; linhas[c] = y + (typeof alturaCaixa === 'function' ? alturaCaixa(d) : 90) + 30; });
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
  campanha.meta.lingua = campanha.meta.lingua || linguaPadrao(); $('#c_lingua').innerHTML = opcoesDeLingua(campanha.meta.lingua); $('#c_painelLingua').hidden = true;
  pintarLinguasDaCampanha();
  const no = noDaMissao(missaoAtual); if (no && !noSel) noSel = no.id;
  mudarAba(aba || (abaC === 'caixas' ? 'fluxo' : abaC));
}
function telaCampanhaAberta() { const t = document.getElementById('telaCampanha'); return !!t && !t.hidden; }
function fecharCampanha() { antesDeSairDaCena(() => { esconderPainel('janelaVariaveis'); esconderPainel('janelaInventario'); if (abaC === 'caixas') trocarAba('fluxo'); fecharPopup(); $('#telaCampanha').hidden = true; descarregarImagens(); camposDaMissao(); tudo(); }); }
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
  if (aba !== abaC) descarregarImagens();   // (v239)
  abaC = aba; fecharPopup(); estradaNova = null; colocandoCidade = false;
  if (aba !== 'caixas') cenaAberta = null;
  $$('#abasC button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === aba));
  $('#cCaixas').hidden = aba !== 'caixas';
  $('#dicaC').title = aba === 'fluxo' ? 'Drag a card to move it · drag from its ● onto another card to link (the target comes after) · click the ● to see where it leads, or the tip of an arrow to see what comes into a card (you remove links there) · ✎ or double-click opens the card · arrows nudge the selected card (or the view) · + and − zoom · Del deletes'
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
$('#c_lingua').onchange = e => { campanha.meta.lingua = e.target.value; pintarLinguasDaCampanha(); renderCabecalho(); };
/* the languages of the campaign: only its flags (the original first) beside the name; a click on them opens the options
   (the language of the campaign, the other languages added by the author, the Translations window) */
function pintarLinguasDaCampanha() {
  $('#c_bandeira').innerHTML = imgsBandeira(linguasDaObra().join(','), 16) + ' <span class="seta">▾</span>';
  const d = $('#c_linguas'); if (!d) return; d.innerHTML = htmlLinguasDaObra(); ligarLinguasDaObra(d, pintarLinguasDaCampanha);
}
$('#c_bandeira').onclick = e => { e.stopPropagation(); $('#c_painelLingua').hidden = !$('#c_painelLingua').hidden; };
document.addEventListener('mousedown', e => { const p = $('#c_painelLingua'); if (p && !p.hidden && !e.target.closest('.linguaCampanha') && !e.target.closest('.modal')) p.hidden = true; });
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
    <p class="ajuda">Files already exported stay in the folder${Config.nomePasta() ? ' (' + esc(Config.nomePasta()) + ')' : ''}; delete them there if you like. Autosave stops following this campaign, so it leaves them in place. The game keeps the progress of every party that played it.</p>
    <button class="op destaque" data-o="exp"><b>Export, then delete</b><small>Writes the .bcamp and its maps${Config.nomePasta() ? ' into ' + esc(Config.nomePasta()) : ' (download)'}, then deletes.</small></button>
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
const DESTINO_EDICAO = { map: 'Build the rooms of this map', side: 'Build the rooms of this side quest', travel: 'Place this waypoint on the world map', dialogue: 'Write the boxes of this scene', scene: 'Write the boxes of this scene', branch: 'Choose the exits of this crossroads' };
function editarNo(n) {
  if (!n) return; noSel = n.id;
  if (ehDialogo(n)) { abrirCaixas(n); return; }
  if (n.tipo === 'branch') { if (abaC !== 'fluxo') mudarAba('fluxo'); else renderC(); return; }
  if (n.tipo === 'travel') { if (abaC === 'mundo') { mudarAba('fluxo'); } else mudarAba('mundo'); return; }
  if (n.missao === null || n.missao === undefined || !campanha.missoes[n.missao]) return aviso('This card has no map.');
  trocarMissao(n.missao); fecharCampanha();
}
function renderEsqC() {
  const el = $('#esqC');
  if (abaC === 'caixas') { $('#cBotoes').innerHTML = '';
    const n = noPorId(cenaAberta); const caixas = caixasDaCena(n);
    el.innerHTML = `<div class="bloco"><h2>${esc(rotuloDoNo(n))}${n.nome ? ' · ' + esc(n.nome) : ''}</h2><div class="botoes"><button class="sm" id="cAddCaixa">+ Box</button><button class="sm" id="cAddOpcoes" title="A box with answers: each one leads to its own next box">+ Box with options</button><button class="sm" id="cAddVideo" title="A box that plays your own film (a cutscene)">+ Video (cutscene)</button><button class="sm" id="cArrumarCaixas" title="Lay the boxes out left to right, in the order of the arrows">Auto-arrange</button><button class="sm primario" id="cSimular">▶ Simulate</button></div><div id="cListaCaixas"></div><p class="ajuda">Boxes play in the order of the arrows, starting at the first. A question box branches: each answer leads to its own next box. A video box plays your own film (MP4 or WebM) between the other boxes.</p></div>`;
    const l = $('#cListaCaixas');
    caixas.forEach((d, i) => { const dv = document.createElement('div'); dv.className = 'no' + (caixaSel === d.id ? ' ativo' : ''); const r = rostoDe(d.speaker);
      dv.innerHTML = `${r ? `<img class="face" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="face"></span>'}<div><div>${d.id === n.dialogo ? '▶ ' : ''}${esc(d.type === 'video' ? '▶ ' + (d.video?.nome || 'video') : d.title || (d.text || '').slice(0, 26) || 'Box ' + (i + 1))}</div><small>${esc(d.type === 'video' ? 'video' : d.speaker ? nomePersonagem(d.speaker) : 'narrator')}${d.type === 'choice' ? ' · question' : ''}${d.acoes.length ? ' · ' + d.acoes.length + ' action(s)' : ''}</small></div>`;
      dv.onclick = () => { caixaSel = d.id; renderC(); }; l.appendChild(dv); });
    const addCaixa = tipo => { const d = novaCaixa(n); if (tipo === 'video') d.type = 'video'; if (tipo === 'choice') { d.type = 'choice'; d.options = [{ text: '', next: '', acoes: [] }, { text: '', next: '', acoes: [] }]; } const s = caixaSel && caixaPorId(caixaSel); if (s && s.type !== 'choice' && !campanha.dialogos.some(x => (x.depois || []).includes(s.id))) d.depois = [s.id]; d.fluxo = [(s ? s.fluxo[0] : 0) + 240, s ? s.fluxo[1] : 0]; caixaSel = d.id; renderC(); };
    $('#cAddCaixa').onclick = () => addCaixa('normal');
    $('#cAddOpcoes').onclick = () => addCaixa('choice');
    $('#cAddVideo').onclick = () => addCaixa('video');
    $('#cArrumarCaixas').onclick = () => { arrumarCaixas(n); renderC(); enquadrarC(); };
    $('#cSimular').onclick = () => simular(n);
    return;
  }
  el.innerHTML = `<div class="bloco"><h2>${abaC === 'fluxo' ? 'Story flow' : 'World map'}</h2>
    <div id="cListaNos"></div>
    <p class="ajuda">${abaC === 'fluxo' ? 'Read from left to right: map → scene → waypoint (the party moves on the world map) → scene → next maps. A card with no arrow coming in is available from the start. Each card keeps its number for good; you choose the name.' : 'Every map, side quest and waypoint has a place here and a marker kind: main quest, side quest, narrative event or city visit.'}</p></div>`
    + (abaC === 'mundo' ? `<div class="bloco"><h2>Map picture</h2><div id="cMapaProprio"></div></div>` : '');
  if (abaC === 'mundo') campoMapaProprio($('#cMapaProprio'));
  const depois = ' (it goes after the selected card)';
  $('#cBotoes').innerHTML = `<button class="sm" id="cAddMap" title="A new map${depois}">+ Map</button><button class="sm" id="cAddSide" title="A new side quest${depois}">+ Side quest</button><button class="sm" id="cAddTravel" title="The party moves on the world map${depois}">+ Waypoint</button>${abaC === 'fluxo' ? `<button class="sm" id="cAddDlg" title="Boxes of text, questions and videos (your own films), played in a row${depois}">+ Scene</button><button class="sm" id="cAddRamo" title="The story goes one way or another, by the story variables${depois}">${esc(tr('+ Crossroads'))}</button><span class="sep"></span><button class="sm" id="cArrumar" title="Lay the cards out left to right">Auto-arrange</button>` : ''}`;
  const l = $('#cListaNos');
  campanha.nos.forEach(n => {
    if (abaC === 'mundo' && !noMapaMundi(n)) return;
    const dv = document.createElement('div'); dv.className = 'no' + (noSel === n.id ? ' ativo' : '');
    const cab = ehDialogo(n) ? caixaPorId(n.dialogo) : null; const r = cab ? rostoDe(cab.speaker) : '';
    dv.innerHTML = `${r ? `<img class="face" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : `<span class="ponto ${n.tipo}"></span>`}<div style="flex:1;min-width:0"><div>${esc(rotuloDoNo(n))}${nomeDoNo(n) !== rotuloDoNo(n) ? ' · ' + esc(nomeDoNo(n)) : ''}</div><small>${n.missao !== null && n.missao !== undefined ? (campanha.missoes[n.missao]?.salas.length || 0) + ((campanha.missoes[n.missao]?.salas.length || 0) === 1 ? ' room' : ' rooms') + ' · progression ' + progressoDoMapa(campanha.missoes[n.missao]) : ehDialogo(n) ? caixasDaCena(n).length + ' box(es)' : n.tipo === 'branch' ? tr((n.saidas || []).length + 1 + ' exits') : MARCADORES.find(m => m[0] === n.marcador)?.[1] || ''}${(n.depois || []).length ? ' · after ' + n.depois.map(noPorId).filter(Boolean).map(rotuloDoNo).join(', ') : ' · from the start'}</small></div><button class="sm editar" title="${esc(DESTINO_EDICAO[n.tipo])}">✎</button>`;
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
  const br = $('#cAddRamo'); if (br) br.onclick = () => { const n = inserirNo('branch'); noSel = n.id; renderC(); };
  const ar = $('#cArrumar'); if (ar) ar.onclick = () => { arrumarFluxo(true); desenharC(); enquadrarC(); };
}

// ------------------------------------------------------------ right column
function renderDirC() {
  const el = $('#dirC');
  if (abaC === 'caixas') return renderCaixaProps(el, caixaSel && caixaPorId(caixaSel));
  const n = noSel && noPorId(noSel);
  if (!n) { el.innerHTML = '<div class="bloco"><h2>Selection</h2><p class="ajuda">Click a card or a marker.</p></div>'; return; }
  if (n.tipo === 'branch') return renderRamo(el, n);
  const m = n.missao !== null && n.missao !== undefined ? campanha.missoes[n.missao] : null;
  el.innerHTML = `<div class="bloco"><h2><span class="ponto ${n.tipo}"></span>${esc(rotuloDoNo(n))}</h2>
    <label class="campo">Name <input id="n_nome" value="${esc(m ? m.meta.name : n.nome || '')}" placeholder="${esc(rotuloDoNo(n))}"></label>
    ${htmlCondicao(n.seEscolha, 'n_seesc')}${n.seEscolha ? `<p class="ajuda">${ehDialogo(n) ? 'Otherwise the scene is skipped (the story goes on).' : 'If the condition above fails, it stays off the world map (a box can still unlock it by hand).'}</p>` : ''}
    ${ehDialogo(n) ? `<p class="ajuda">${caixasDaCena(n).length} box(es): text, questions and videos (your own films), played one after the other in the same frame. Played at this point of the story: after a map it is the map’s closing scene; after a waypoint it plays on arrival; before anything it opens the campaign.</p><label class="campo">Plays as <select id="n_marcador">${MARCADORES_DA_CENA.map(([v, t]) => `<option value="${v}" ${n.marcador === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${n.marcador === 'city' ? '<p class="ajuda">This card waits for the party’s next visit to the city after the card before it. The scenes after it play during that same visit.</p>' : ''}<button id="n_caixas" class="primario largo">Write the boxes ▸</button>`
      : `<label class="campo">Description (shown on the world map) <textarea id="n_desc" rows="2">${esc(n.descricao || '')}</textarea></label>
      ${m ? `<button id="n_salas" class="primario largo">Build the rooms ▸</button><p class="ajuda">${m.salas.length} room(s) · campaign progression ${progressoDoMapa(m)} (Map setup → Balancing).</p>` : '<p class="ajuda">A stop on the world map. When the party gets there, its marker moves to this spot. Put scene cards after it for what happens on arrival.</p>'}
      <label class="campo">${n.tipo === 'travel' ? 'Happens as' : 'On the world map as'} <select id="n_marcador">${marcadoresDe(n).map(([v, t]) => `<option value="${v}" ${n.marcador === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" id="n_auto" ${n.auto !== false ? 'checked' : ''}> Appears on the world map on its own when unlocked</label>
      ${(() => { const q = quemDesbloqueia(n); return q.length ? `<p class="ajuda">🔒 Locked until unlocked by ${q.map(x => '<b>' + esc(x) + '</b>').join(', ')} (“Unlock a campaign map”).</p>` : ''; })()}
      ${n.tipo !== 'travel' ? `<div class="sub">Rewards on completion</div>
      <div class="duas"><label class="campo">Gold <input id="n_ouro" type="number" min="0" value="${n.recompensas?.gold || 0}" style="width:80px"></label>
      <label class="campo">Crafting materials <input id="n_mat" type="number" min="0" value="${n.recompensas?.materials || 0}" style="width:80px"></label></div>
      <label class="campo">Items <select id="n_item"><option value="">+ add an item…</option>${ITENS_B().map(i => `<option value="${esc(i.id)}">${esc(i.nome)}</option>`).join('')}</select>${ITENS_B().length ? '' : '<small class="ajuda">Only Workshop items can be given. Import them from the game or create your own in the Workshop (rooms screen).</small>'}</label>
      <div>${(n.recompensas?.items || []).map(it => `<span class="tag">${esc(nomeItem(it))} <a href="#" data-delitem="${esc(it)}">✕</a></span>`).join('')}</div>` : ''}
      <p class="ajuda">World map position: ${n.coords[0]}, ${n.coords[1]}.</p>`}
    <div class="linha acoes">${m && (n.tipo === 'map' || n.tipo === 'side') ? `<button class="sm" id="n_duplicar" title="${esc(tr('Makes a copy of this map, rooms and all, placed after the same cards. Change the copy to make a variation'))}">⧉ ${esc(tr(n.tipo === 'side' ? 'Duplicate this side quest' : 'Duplicate this map'))}</button>` : ''}<button class="sm perigo" id="n_apagar">Delete this ${NOME_TIPO[n.tipo].toLowerCase()}</button></div></div>`;
  ligarCondicao(el, 'n_seesc', () => n.seEscolha, c => { if (c) n.seEscolha = c; else delete n.seEscolha; }, leve => { if (leve) return desenharC(); renderDirC(); renderEsqC(); desenharC(); });
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
  const dp = $('#n_duplicar'); if (dp) dp.onclick = () => duplicarNo(n);
}
/* v377: a Crossroads card: the story goes on by the first exit whose condition holds, from the top (none: “In any other case”).
   Each exit leads to one card, the card linked after it: n.saidas [{cond, para}], n.outros (a card id). The cards linked after
   the Crossroads by an arrow and in no exit join it (the other case first, then a new exit). */
function sincronizarRamo(n) {
  n.saidas = n.saidas || []; n.outros = n.outros || '';
  const alvos = campanha.nos.filter(m => (m.depois || []).includes(n.id)).map(m => m.id);
  n.saidas.forEach(x => { if (x.para && !alvos.includes(x.para)) x.para = ''; }); if (n.outros && !alvos.includes(n.outros)) n.outros = '';
  const usados = new Set([n.outros, ...n.saidas.map(x => x.para)].filter(Boolean)); const vistos = new Set();
  n.saidas.forEach(x => { if (x.para && vistos.has(x.para)) x.para = ''; else if (x.para) vistos.add(x.para); });
  alvos.forEach(id => { if (usados.has(id)) return; usados.add(id); if (!n.outros) n.outros = id; else n.saidas.push({ cond: null, para: id }); });
}
/* the card an exit leads to: it now comes only after the Crossroads; the card it led to before goes back after what comes
   before the Crossroads (so it does not end up open from the start) */
function ligarSaida(n, k, id) {
  const atual = k === 'outros' ? n.outros : n.saidas[k].para;
  if (atual && atual !== id) { const m = noPorId(atual); if (m) { desligar(n, m); if (!(m.depois || []).length) m.depois = (n.depois || []).slice(); } }
  if (id) { const m = noPorId(id); if (m) { m.depois = [n.id]; m.fluxo = null; }
    n.saidas.forEach(x => { if (x.para === id) x.para = ''; }); if (n.outros === id) n.outros = ''; }
  if (k === 'outros') n.outros = id; else n.saidas[k].para = id;
  arrumarFluxo(false);
}
function antecessores(n, r = new Set()) { (n.depois || []).forEach(id => { if (r.has(id)) return; r.add(id); const a = noPorId(id); if (a) antecessores(a, r); }); return r; }
function renderRamo(el, n) {
  sincronizarRamo(n);
  const antes = antecessores(n); const alvos = campanha.nos.filter(m => m !== n && !antes.has(m.id));
  const nomeDe = m => rotuloDoNo(m) + (nomeDoNo(m) !== rotuloDoNo(m) ? ' · ' + nomeDoNo(m) : '');
  const opcoes = id => `<option value="">${esc(tr('— nothing —'))}</option>${alvos.map(m => `<option value="${esc(m.id)}" ${id === m.id ? 'selected' : ''}>${esc(nomeDe(m))}</option>`).join('')}`;
  el.innerHTML = `<div class="bloco"><h2><span class="ponto branch"></span>${esc(rotuloDoNo(n))}</h2>
    <label class="campo">Name <input id="n_nome" value="${esc(n.nome || '')}" placeholder="${esc(rotuloDoNo(n))}"></label>
    <p class="ajuda">${esc(tr('The story goes on by the first exit whose condition holds, checked from the top. When none holds, it goes on by “In any other case”. Once a card after it has played, the way taken stays for the rest of the campaign.'))}</p>
    ${n.saidas.map((x, k) => `<div class="cartao saidaRamo"><div class="sub">${esc(tr('Exit ' + (k + 1)))} <span class="sep"></span><button class="sm" data-rsobe="${k}" title="${esc(tr('Move up'))}" ${k ? '' : 'disabled'}>↑</button><button class="sm" data-rdesce="${k}" title="${esc(tr('Move down'))}" ${k < n.saidas.length - 1 ? '' : 'disabled'}>↓</button><button class="sm" data-rtira="${k}" title="${esc(tr('Remove this exit'))}">✕</button></div>
      ${htmlCondicao(x.cond, 'rc' + k, 'Only if', true)}${condValida(x.cond) ? '' : `<p class="ajuda aviso">${esc(tr('Pick a condition: without one, this exit never happens.'))}</p>`}
      <label class="campo">${esc(tr('Goes to'))} <select data-rpara="${k}">${opcoes(x.para)}</select></label></div>`).join('')}
    <button class="sm" id="r_mais">${esc(tr('+ Exit'))}</button>
    <div class="cartao saidaRamo"><div class="sub">${esc(tr('In any other case'))}</div><label class="campo">${esc(tr('Goes to'))} <select data-rpara="outros">${opcoes(n.outros)}</select></label></div>
    <p class="ajuda">${esc(tr('An exit can also be linked on the canvas: drag from the ● of the Crossroads onto a card.'))}</p>
    <div class="linha acoes"><button class="sm perigo" id="n_apagar">Delete this ${esc(NOME_TIPO.branch.toLowerCase())}</button></div></div>`;
  const tudoC = () => { renderC(); };
  $('#n_nome').oninput = e => { n.nome = e.target.value; renderEsqC(); desenharC(); };
  n.saidas.forEach((x, k) => ligarCondicao(el, 'rc' + k, () => x.cond, c => { x.cond = c; }, leve => { if (!leve) renderDirC(); desenharC(); }));
  el.querySelectorAll('[data-rpara]').forEach(sl => sl.onchange = () => { const k = sl.dataset.rpara; ligarSaida(n, k === 'outros' ? 'outros' : +k, sl.value); tudoC(); });
  el.querySelectorAll('[data-rsobe]').forEach(b => b.onclick = () => { const k = +b.dataset.rsobe; [n.saidas[k - 1], n.saidas[k]] = [n.saidas[k], n.saidas[k - 1]]; renderDirC(); });
  el.querySelectorAll('[data-rdesce]').forEach(b => b.onclick = () => { const k = +b.dataset.rdesce; [n.saidas[k + 1], n.saidas[k]] = [n.saidas[k], n.saidas[k + 1]]; renderDirC(); });
  el.querySelectorAll('[data-rtira]').forEach(b => b.onclick = () => { const k = +b.dataset.rtira; const x = n.saidas[k]; if (x.para) ligarSaida(n, k, ''); n.saidas.splice(k, 1); tudoC(); });
  $('#r_mais').onclick = () => { n.saidas.push({ cond: null, para: '' }); renderDirC(); };
  $('#n_apagar').onclick = () => { apagarNo(n.id); renderC(); renderCabecalho(); };
}
const ACOES_CAIXA = [['unlockNode', 'Unlock a map or waypoint'], ['giveItem', 'Give an item'], ['giveMaterials', 'Give crafting materials'], ['completeNode', 'Mark a map or waypoint as completed'], ['remember', 'Remember a choice'], ['variavel', 'Change a number variable']];
/* the variables of the campaign (Story variables): a choice the party made, yes or no (an answer ticked “Remember this
   answer”, or a “Remember a choice” action: it counts as 1), or, v377, a number (Honour, Fear, Villagers saved…) that
   answers, boxes and map triggers add to or take from, never below 0 nor above its maximum. Cards, scenes, Crossroads and map
   triggers can then happen only if the party made (or did not make) a choice, or if a number is at least, at most… */
const varEscolha = nome => 'choice:' + slug(nome || '');
const variavelDe = nome => (campanha?.escolhas || []).find(x => x.nome === nome);
const ehNumero = nome => !!variavelDe(nome)?.numero;
function escolhasDaCampanha() {
  if (!campanha) return []; const r = new Set((campanha.escolhas || []).map(x => x.nome));
  const acao = a => { if ((a.action === 'remember' || a.action === 'variavel') && a.nome) r.add(a.nome); };
  (campanha.dialogos || []).forEach(d => { (d.acoes || []).forEach(acao); (d.options || []).forEach(o => { if (o.lembrar && (o.lembrarNome || o.text)) r.add(o.lembrarNome || o.text); (o.acoes || []).forEach(acao); }); });
  return [...r].sort();
}
const variaveisNumero = () => escolhasDaCampanha().filter(ehNumero);
/* a condition on the variables: {nome, sim} for a yes/no one; {nome, op: ge|le|eq|gt|max, n, outra, entre[]} for a number */
const OPS_CONDICAO = [['ge', 'is at least'], ['le', 'is at most'], ['eq', 'is exactly'], ['gt', 'is more than'], ['max', 'is the highest of']];
function condValida(c) { if (!c || !c.nome) return false; if (!c.op) return true; if (c.op === 'gt') return !!c.outra; if (c.op === 'max') return (c.entre || []).length > 0; return true; }
function textoCondicao(c) {
  if (!c || !c.nome) return tr('(no condition yet)');
  if (!c.op) return tr(c.sim === false ? 'The party did not choose “' + c.nome + '”' : 'The party chose “' + c.nome + '”');
  if (c.op === 'gt') return tr('“' + c.nome + '” is more than “' + (c.outra || '?') + '”');
  if (c.op === 'max') return tr('“' + c.nome + '” is the highest of the variables ticked');
  return tr('“' + c.nome + '” ' + OPS_CONDICAO.find(o => o[0] === c.op)[1] + ' ' + (+c.n || 0));
}
/* the values the variables start with (a map played on its own: its conditions read them) */
const iniciosDasVariaveis = () => Object.fromEntries((campanha?.escolhas || []).filter(x => x.numero && +x.inicial > 0).map(x => [varEscolha(x.nome), +x.inicial]));
function condExportada(c) {
  if (!condValida(c)) return { var: '', op: 'never' };
  if (!c.op) return { var: varEscolha(c.nome), value: c.sim === false ? 0 : 1 };
  if (c.op === 'gt') return { var: varEscolha(c.nome), op: 'gt', other: varEscolha(c.outra) };
  if (c.op === 'max') return { var: varEscolha(c.nome), op: 'max', among: c.entre.map(varEscolha) };
  return { var: varEscolha(c.nome), op: c.op, value: Math.max(0, +c.n || 0) };
}
/* the select of a condition (and, for a number, its operator and number, or the other variables): “Only if” of a card,
   an exit of a Crossroads, the requirement “A choice in the campaign” of a map trigger. semSempre: no “Always” */
function htmlCondicao(c, id, rotulo = 'Only if', semSempre = false) {
  const es = escolhasDaCampanha(); const nomes = c && c.nome && !es.includes(c.nome) ? [...es, c.nome] : es;
  const v = !c || !c.nome ? '' : c.op ? 'num:' + c.nome : (c.sim === false ? 'nao:' : 'sim:') + c.nome;
  if (!nomes.length) return `<label class="campo">${esc(tr(rotulo))} <select disabled><option>${esc(tr(semSempre ? '— pick —' : 'Always'))}</option></select></label><p class="ajuda">${esc(tr('No story variable yet: in a question box, tick “Remember this answer”, or create one with the Story variables button.'))}</p>`;
  const ops = nomes.map(n => ehNumero(n) ? `<option value="num:${esc(n)}" ${v === 'num:' + n ? 'selected' : ''}>${esc(tr('“' + n + '” is…'))}</option>`
    : `<option value="sim:${esc(n)}" ${v === 'sim:' + n ? 'selected' : ''}>${esc(tr('The party chose “' + n + '”'))}</option><option value="nao:${esc(n)}" ${v === 'nao:' + n ? 'selected' : ''}>${esc(tr('The party did not choose “' + n + '”'))}</option>`).join('');
  let mais = '';
  if (c && c.op) {
    const outras = variaveisNumero().filter(n => n !== c.nome);
    mais = `<div class="linha condNum"><select data-cop="${id}">${OPS_CONDICAO.filter(([k]) => (k !== 'gt' && k !== 'max') || outras.length).map(([k, t]) => `<option value="${k}" ${c.op === k ? 'selected' : ''}>${esc(tr(t))}</option>`).join('')}</select>`
      + (c.op === 'gt' ? `<select data-coutra="${id}"><option value="">${esc(tr('— pick —'))}</option>${outras.map(n => `<option value="${esc(n)}" ${c.outra === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`
        : c.op === 'max' ? '' : `<input data-cn="${id}" type="number" min="0" value="${Math.max(0, +c.n || 0)}" style="width:64px">`) + '</div>'
      + (c.op === 'max' ? `<div class="condEntre">${outras.map(n => `<label class="chk"><input type="checkbox" data-centre="${id}" value="${esc(n)}" ${(c.entre || []).includes(n) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</div><p class="ajuda">${esc(tr('A tie counts as the highest: in a Crossroads, the first exit that holds wins.'))}</p>` : '');
  }
  return `<label class="campo">${esc(tr(rotulo))} <select id="${id}"><option value="">${esc(tr(semSempre ? '— pick —' : 'Always'))}</option>${ops}</select></label>${mais}`;
}
/* reads the controls of htmlCondicao back: pega() the condition now (or null), poe(c) keeps it (null: none) */
function ligarCondicao(raiz, id, pega, poe, depois) {
  const sel = raiz.querySelector('#' + id); if (!sel) return;
  sel.onchange = () => { const v = sel.value; if (!v) poe(null); else { const nome = v.slice(4); poe(v.startsWith('num:') ? { nome, op: 'ge', n: 1 } : { nome, sim: v.startsWith('sim:') }); } depois(); };
  const c = pega(); if (!c) return;
  const op = raiz.querySelector(`[data-cop="${id}"]`); if (op) op.onchange = () => { c.op = op.value; if (c.op === 'max' && !c.entre) c.entre = []; poe(c); depois(); };
  const n = raiz.querySelector(`[data-cn="${id}"]`); if (n) n.onchange = () => { c.n = Math.max(0, +n.value || 0); poe(c); depois(true); };
  const ou = raiz.querySelector(`[data-coutra="${id}"]`); if (ou) ou.onchange = () => { c.outra = ou.value; poe(c); depois(true); };
  raiz.querySelectorAll(`[data-centre="${id}"]`).forEach(ch => ch.onchange = () => { c.entre = [...raiz.querySelectorAll(`[data-centre="${id}"]:checked`)].map(x => x.value); poe(c); depois(true); });
}
/* every condition on the variables in the campaign (cards, Crossroads exits, map triggers), with a way to drop it */
function condicoesDaCampanha() {
  const r = [];
  campanha.nos.forEach(n => { if (n.seEscolha) r.push({ c: n.seEscolha, tipo: 'no', n, tirar: () => delete n.seEscolha });
    if (n.tipo === 'branch') (n.saidas || []).forEach((s, k) => { if (s.cond) r.push({ c: s.cond, tipo: 'ramo', n, k, tirar: () => { s.cond = null; } }); }); });
  donosDaCampanha().forEach(({ mi, si, o, chave }) => todosGatilhos(o).forEach(g => { const gi = (o.gatilhos || []).indexOf(g); (g.requisitos || []).forEach(q => {
    if (q.tipo === 'choice') r.push({ c: q, tipo: 'mapa', mi, si, chave, o, g, gi, tirar: () => { g.requisitos = g.requisitos.filter(x => x !== q); } }); }); }));
  return r;
}
/* the actions on the variables: box actions and answers (remember, change), map triggers “Add / subtract / use a campaign variable”,
   the counters that bring their count to the campaign */
function acoesDasVariaveis() {
  const r = [];
  campanha.dialogos.forEach(d => { const n = noPorId(d.cena); if (!n) return;
    (d.acoes || []).forEach(a => { if (a.action === 'remember' || a.action === 'variavel') r.push({ a, tipo: 'caixa', n, d, onde: rotuloDoNo(n) + ' · ' + tr('when a box is shown'), tirar: () => { d.acoes = d.acoes.filter(x => x !== a); } }); });
    (d.options || []).forEach(o => {
      if (o.lembrar && (o.lembrarNome || o.text)) r.push({ a: { action: 'remember', nome: o.lembrarNome || o.text }, resposta: o, tipo: 'caixa', n, d, onde: rotuloDoNo(n) + ' · ' + tr('answer “' + (o.text || '?') + '”'), tirar: () => { o.lembrar = false; delete o.lembrarNome; } });
      (o.acoes || []).forEach(a => { if (a.action === 'remember' || a.action === 'variavel') r.push({ a, tipo: 'caixa', n, d, onde: rotuloDoNo(n) + ' · ' + tr('answer “' + (o.text || '?') + '”'), tirar: () => { o.acoes = o.acoes.filter(x => x !== a); } }); });
    });
  });
  donosDaCampanha().forEach(({ mi, si, o, chave }) => todosGatilhos(o).forEach(g => { if (g.tipo === 'campaign_var') r.push({ a: g, tipo: 'mapa', mi, si, chave, o, gi: (o.gatilhos || []).indexOf(g), onde: nomeDoMapa(mi) + ' · ' + rotulo(o), tirar: () => { g.nome = ''; } }); }));
  (campanha.missoes || []).forEach((m, mi) => (m.contadores || []).forEach(c => { if (c.campanha && c.campanha.nome) r.push({ a: c.campanha, tipo: 'contador', mi, c, onde: nomeDoMapa(mi) + ' · ' + tr('counter “' + c.nome + '” when the map is won'), tirar: () => { delete c.campanha; } }); }));
  return r;
}
/* the marks {Name} in the texts of the boxes: the value of the variable when the box is shown */
const RE_MARCA_VAR = /\{([^{}]+)\}/g;
const ehMarcaDoJogo = s => /^(hero[1-4]|actor)$/i.test(s);
function marcasDoTexto(t) { const r = []; String(t || '').replace(RE_MARCA_VAR, (m, n) => { if (!ehMarcaDoJogo(n) && !r.includes(n)) r.push(n); return m; }); return r; }
function textoComValores(t) { const es = new Set(escolhasDaCampanha()); return String(t || '').replace(RE_MARCA_VAR, (m, n) => es.has(n) ? '{var:' + varEscolha(n) + '}' : m); }

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
/* what sets or changes a variable (answers, actions of boxes, map triggers, counters) and what depends on it (cards,
   Crossroads exits, map triggers, other conditions, the texts that show its value) */
const usaVariavel = (c, nome) => c && (c.nome === nome || c.outra === nome || (c.entre || []).includes(nome));
function usosDaEscolha(nome) {
  const define = [], usa = [];
  acoesDasVariaveis().forEach(u => { if (u.a.nome === nome || u.a.outra === nome) define.push({ ...u, texto: u.onde + (u.a.action === 'remember' ? '' : ' (' + resumoMudanca(u.a) + ')') }); });
  condicoesDaCampanha().forEach(u => { if (!usaVariavel(u.c, nome)) return;
    const t = textoCondicao(u.c);
    usa.push({ ...u, texto: u.tipo === 'mapa' ? nomeDoMapa(u.mi) + ' · ' + rotulo(u.o) + ' · ' + tr(GATILHO[u.g.tipo]?.nome || u.g.tipo) + ' (' + t + ')' : u.tipo === 'ramo' ? rotuloDoNo(u.n) + ' · ' + tr('exit ' + (u.k + 1)) + ' (' + t + ')' : rotuloDoNo(u.n) + ' · ' + tr('only if') + ' ' + t }); });
  campanha.dialogos.forEach(d => { const n = noPorId(d.cena); if (n && [d.text, d.title, ...(d.options || []).map(o => o.text)].some(t => marcasDoTexto(t).includes(nome))) usa.push({ tipo: 'caixa', n, d, texto: rotuloDoNo(n) + ' · ' + tr('shows its value') }); });
  return { define, usa };
}
/* “+ 2”, “− 1”, “= 0”, “+ Honour” (a change of a number variable), “yes”/“no” for a yes/no one */
function resumoMudanca(a) {
  const op = a.op || a.acao || 'add';
  if (!ehNumero(a.nome) && a.action !== 'variavel') return op === 'set' && !+a.n ? tr('no') : tr('yes');
  return op === 'addvar' ? '+ ' + (a.outra || '?') : (op === 'sub' ? '− ' : op === 'set' ? '= ' : '+ ') + Math.max(0, +(a.n ?? 1) || 0);
}
function renomearEscolha(velho, novo) {
  acoesDasVariaveis().forEach(u => {
    if (u.a.nome === velho) { if (novo) { if (u.resposta) u.resposta.lembrarNome = novo; else u.a.nome = novo; } else u.tirar(); }
    else if (u.a.outra === velho) { if (novo) u.a.outra = novo; else u.tirar(); }
  });
  condicoesDaCampanha().forEach(u => { const c = u.c;
    if (c.nome === velho) { if (novo) c.nome = novo; else u.tirar(); return; }
    if (c.outra === velho) { if (novo) c.outra = novo; else u.tirar(); return; }
    if ((c.entre || []).includes(velho)) c.entre = novo ? c.entre.map(x => x === velho ? novo : x) : c.entre.filter(x => x !== velho);
  });
  // (the texts that show its value follow the new name; deleted, the mark stays and the box warns about it)
  if (novo) { const tro = t => String(t || '').split('{' + velho + '}').join('{' + novo + '}');
    campanha.dialogos.forEach(d => { if (d.text) d.text = tro(d.text); if (d.title) d.title = tro(d.title); (d.options || []).forEach(o => { if (o.text) o.text = tro(o.text); }); }); }
  const c = campanha.escolhas.find(x => x.nome === velho); if (c) { if (novo) c.nome = novo; else campanha.escolhas = campanha.escolhas.filter(x => x !== c); }
}
function irParaUsoDaEscolha(u, fechar) {
  fechar();
  if (u.tipo === 'caixa') { abrirCaixas(u.n); caixaSel = u.d.id; renderC(); return; }
  if (u.tipo === 'no' || u.tipo === 'ramo') { mudarAba('fluxo'); noSel = u.n.id; renderC(); return; }
  trocarMissao(u.mi); fecharCampanha();
  if (u.tipo === 'contador') { abrirContadores(); return; }
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
    return `<div class="contador"><div class="linha"><input data-vn="${i}" value="${esc(x.nome)}" title="Rename: every answer, card and map trigger that uses it follows"><select data-vtipo="${i}" title="${esc(tr('Yes or no: a choice the party made. Number: a score that answers, boxes and map triggers add to or take from.'))}"><option value="">${esc(tr('Yes or no'))}</option><option value="num" ${x.numero ? 'selected' : ''}>${esc(tr('Number'))}</option></select><button class="sm" data-vx="${i}" title="Delete">✕</button></div>
      ${x.numero ? `<div class="linha"><label class="campo" style="margin:0">${esc(tr('Starts at'))} <input data-vini="${i}" type="number" min="0" value="${Math.max(0, +x.inicial || 0)}" style="width:64px"></label><label class="campo" style="margin:0" title="${esc(tr('The number never goes above this. Empty: no limit. It never goes below 0.'))}">${esc(tr('Maximum'))} <input data-vmax="${i}" type="number" min="0" value="${+x.maximo || ''}" placeholder="${esc(tr('none'))}" style="width:64px"></label></div>` : ''}
      <input data-vnota="${i}" value="${esc(x.nota || '')}" placeholder="What it means (a note for you)" style="margin-top:6px">
      <div class="usos"><span class="rotuloTx">Set by</span> ${define.map((u, k) => chip(u, i, k, 'define')).join('') || (x.numero ? `<span class="ajuda aviso">${esc(tr('nothing changes it yet: in a box or an answer, add “Change a number variable”; in a map, the trigger “Add / subtract / use a campaign variable”, or a counter brought to the campaign.'))}</span>` : '<span class="ajuda aviso">nothing sets it yet: tick “Remember this answer” in a question box and give it this name. Until then “chose” is never true.</span>')}</div>
      <div class="usos"><span class="rotuloTx">Used by</span> ${usa.map((u, k) => chip(u, i, k, 'usa')).join('') || '<span class="ajuda">nothing depends on it yet: pick it in “Only if” of a card, or as the requirement “A choice in the campaign” of a map trigger.</span>'}</div></div>`; }).join('');
  janelaFlutuante('janelaVariaveis', 'Story variables', `<div class="explicaVars">
    <p class="ajuda">${esc(tr('Story variables keep what happened in the campaign, from one map to the next. They stay hidden from the players and let the story change with what the party did.'))}</p>
    <ul class="ajuda">
      <li>${esc(tr('Yes or no: a choice of the party, such as “Spared the bandit”. It becomes “yes” when the party picks an answer ticked “Remember this answer”.'))}</li>
      <li>${esc(tr('Number: a score, such as Honour or Villagers saved. Answers, boxes and map triggers add points to it or take them away. The lowest it goes is 0.'))}</li>
    </ul>
    <p class="ajuda">${esc(tr('To use one, pick it in “Only if” of a card, in an exit of a Crossroads or in the requirement of a map trigger. Example: the map “Tower” appears only if Honour is at least 3.'))}</p>
    <p class="ajuda">${esc(tr('To show its value to the players, use “Insert a variable” in the text of a box.'))}</p></div>
    ${linhas || '<p class="ajuda">No variable yet.</p>'}
    <div class="linha" style="margin-top:10px"><input id="vn_novo" placeholder="New variable (Spared the bandit, Sided with the rebels…)"><button class="sm primario" id="vn_mais">+ New variable</button></div>`, (el, fechar) => {
    const volta = () => { abrirVariaveis(); renderC(); };
    el.querySelectorAll('[data-vn]').forEach(inp => inp.onchange = () => { const x = campanha.escolhas[+inp.dataset.vn]; const novo = inp.value.trim(); if (!novo) { inp.value = x.nome; return; } if (novo !== x.nome && campanha.escolhas.some(y => y.nome === novo)) { aviso('There is already a variable called ' + novo + '.'); inp.value = x.nome; return; } renomearEscolha(x.nome, novo); volta(); });
    el.querySelectorAll('[data-vnota]').forEach(inp => inp.oninput = () => { campanha.escolhas[+inp.dataset.vnota].nota = inp.value; });
    el.querySelectorAll('[data-vtipo]').forEach(sl => sl.onchange = () => { const x = campanha.escolhas[+sl.dataset.vtipo];
      if (sl.value) { x.numero = true; x.inicial = x.inicial || 0; }
      else { const us = usosDaEscolha(x.nome); const contas = us.define.filter(u => u.a.action === 'variavel' || u.a.tipo === 'campaign_var' || u.tipo === 'contador').length + us.usa.filter(u => u.c && (u.c.op || u.c.outra === x.nome || (u.c.entre || []).includes(x.nome))).length;
        if (contas && !confirm(tr('Make “' + x.nome + '” a yes/no variable? ' + contas + ' change(s) or condition(s) with numbers stop working until you fix them.'))) { sl.value = 'num'; return; }
        delete x.numero; delete x.inicial; delete x.maximo; condicoesDaCampanha().forEach(u => { if (u.c.nome === x.nome && u.c.op) { delete u.c.op; delete u.c.n; delete u.c.outra; delete u.c.entre; u.c.sim = true; } }); }
      volta(); });
    el.querySelectorAll('[data-vini]').forEach(inp => inp.onchange = () => { const x = campanha.escolhas[+inp.dataset.vini]; x.inicial = Math.max(0, +inp.value || 0); if (+x.maximo && x.inicial > x.maximo) x.inicial = x.maximo; volta(); });
    el.querySelectorAll('[data-vmax]').forEach(inp => inp.onchange = () => { const x = campanha.escolhas[+inp.dataset.vmax]; const m = Math.max(0, +inp.value || 0); if (m) x.maximo = m; else delete x.maximo; if (m && +x.inicial > m) x.inicial = m; volta(); });
    el.querySelectorAll('[data-vx]').forEach(b => b.onclick = () => { const x = campanha.escolhas[+b.dataset.vx]; const { define, usa } = usos[+b.dataset.vx];
      if ((define.length || usa.length) && !confirm('Delete “' + x.nome + '”? ' + (define.length ? define.length + ' answer(s) or action(s) stop remembering it. ' : '') + (usa.length ? usa.length + ' card(s) or trigger requirement(s) lose this condition.' : ''))) return;
      renomearEscolha(x.nome, ''); volta(); });
    el.querySelectorAll('.usoCont').forEach(b => b.onclick = () => irParaUsoDaEscolha(usos[+b.dataset.v][b.dataset.lado][+b.dataset.k], fechar));
    const novo = () => { const n = $('#vn_novo').value.trim(); if (!n) return aviso('Give the variable a name.'); if (campanha.escolhas.some(x => x.nome === n)) return aviso('There is already a variable called ' + n + '.'); campanha.escolhas.push({ nome: n, nota: '' }); volta(); };
    $('#vn_mais').onclick = novo; $('#vn_novo').onkeydown = e => { if (e.key === 'Enter') novo(); };
  }, true);
}
/* v377: the avisos of the variables (shown in the check of the campaign): a condition that can never hold, a number nothing
   changes, a mark in a text that is no variable */
function avisosDasVariaveis() {
  if (!campanha) return [];
  const p = [], es = new Set(escolhasDaCampanha());
  (campanha.escolhas || []).forEach(x => { const us = usosDaEscolha(x.nome);
    if (x.numero && !us.define.length && us.usa.length) p.push(tr('Story variable “' + x.nome + '”: nothing changes it, so it stays at ' + (+x.inicial || 0)));
    us.usa.forEach(u => { const c = u.c; if (!c || c.nome !== x.nome || !c.op) return;
      if (+x.maximo && (c.op === 'ge' || c.op === 'eq') && +c.n > +x.maximo) p.push(tr('Story variable “' + x.nome + '”: a condition asks for more than its maximum (' + x.maximo + ')')); }); });
  campanha.nos.filter(n => n.tipo === 'branch').forEach(n => (n.saidas || []).forEach((s, k) => { if (!condValida(s.cond)) p.push(tr(rotuloDoNo(n) + ': exit ' + (k + 1) + ' has no condition, so it never happens')); }));
  campanha.dialogos.forEach(d => { const n = noPorId(d.cena); if (!n) return; [d.text, d.title, ...(d.options || []).map(o => o.text)].forEach(t => marcasDoTexto(t).forEach(m => { if (!es.has(m)) p.push(tr(rotuloDoNo(n) + ': “{' + m + '}” in a text is no story variable')); })); });
  return [...new Set(p)];
}
function renderCaixaProps(el, d) {
  if (!d) { el.innerHTML = '<div class="bloco"><h2>Box</h2><p class="ajuda">Pick a box on the left, or add one.</p></div>'; return; }
  const n = noPorId(d.cena); const outras = caixasDaCena(n).filter(x => x.id !== d.id);
  const linhaVar = (a, chave, i) => { const outras = variaveisNumero().filter(x => x !== a.nome); const op = a.op || 'add';
    return `<div class="linha acaoCx acaoVar"><span>${esc(tr('Change a number variable'))}: <b>“${esc(a.nome || '?')}”</b></span><select data-avop="${chave}:${i}"><option value="add" ${op === 'add' ? 'selected' : ''}>${esc(tr('Add'))}</option><option value="sub" ${op === 'sub' ? 'selected' : ''}>${esc(tr('Take away'))}</option><option value="set" ${op === 'set' ? 'selected' : ''}>${esc(tr('Set to'))}</option>${outras.length || op === 'addvar' ? `<option value="addvar" ${op === 'addvar' ? 'selected' : ''}>${esc(tr('Add another variable'))}</option>` : ''}</select>${op === 'addvar' ? `<select data-avoutra="${chave}:${i}"><option value="">${esc(tr('— pick —'))}</option>${outras.map(x => `<option value="${esc(x)}" ${a.outra === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>` : `<input data-avn="${chave}:${i}" type="number" min="0" value="${Math.max(0, +(a.n ?? 1) || 0)}" style="width:56px">`}<button class="sm" data-acx="${chave}:${i}">✕</button></div>`; };
  const acoesHtml = (lista, chave) => `<div id="${chave}">${lista.map((a, i) => a.action === 'variavel' ? linhaVar(a, chave, i) : `<div class="linha acaoCx"><span>${esc(ACOES_CAIXA.find(x => x[0] === a.action)?.[1] || a.action)}: <b>${esc(a.action === 'unlockNode' || a.action === 'completeNode' ? (noPorId(a.node) ? rotuloDoNo(noPorId(a.node)) + (nomeDoNo(noPorId(a.node)) !== rotuloDoNo(noPorId(a.node)) ? ' · ' + nomeDoNo(noPorId(a.node)) : '') : '?') : a.action === 'giveItem' ? nomeItem(a.item) : a.action === 'giveMaterials' ? a.n + ' material(s)' : a.action === 'remember' ? '“' + a.nome + '”' : a.var + ' = ' + a.value)}</b></span><button class="sm" data-acx="${chave}:${i}">✕</button></div>`).join('')}<div class="linha"><select data-acadd="${chave}"><option value="">+ what happens…</option>${ACOES_CAIXA.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></div></div>`;
  const video = d.type === 'video';
  el.innerHTML = `<div class="bloco"><h2>Box${d.id === n.dialogo ? ' (first)' : ''}</h2>
    <label class="campo">Kind <select id="d_tipo"><option value="normal" ${d.type === 'normal' || !d.type ? 'selected' : ''}>Plain box</option><option value="choice" ${d.type === 'choice' ? 'selected' : ''}>Question (the players choose an answer)</option><option value="video" ${video ? 'selected' : ''}>Video (your own film)</option></select></label>
    ${video ? `<div id="d_video"></div><p class="ajuda">The scene goes on with the next box when the film ends.</p>` : `
    <label class="campo">Speaker <select id="d_speaker"><option value="">Narrator (no portrait)</option><optgroup label="${esc(tr('Heroes of the party'))}">${HEROIS_DA_CAMPANHA.map(x => `<option value="${x.id}" ${d.speaker === x.id ? 'selected' : ''}>${esc(tr(x.nome))}</option>`).join('')}</optgroup>${PERSONAGENS_B().map(p => `<option value="${esc(p.id)}" ${d.speaker === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>${PERSONAGENS_B().length ? '' : '<small class="ajuda">No NPCs yet. Import or create them in the “NPCs” tab of the Workshop (top bar of the rooms screen).</small>'}</label>
    <label class="campo">Title (optional) <input id="d_title" value="${esc(d.title || '')}"></label>
    <label class="campo">Text <textarea id="d_texto" rows="5">${esc(d.text || '')}</textarea></label>
    ${escolhasDaCampanha().length ? `<div class="barraTx"><span>${esc(tr('Insert a variable:'))}</span>${escolhasDaCampanha().map(v => `<button class="sm fichaTx" data-insvar="${esc(v)}" title="${esc(tr('In the game, the text shows its value here'))}">${esc(v)}</button>`).join('')}</div>` : ''}<div class="marcasTx ajuda" id="d_marcas"></div>
    <label class="campo">Others in the scene <select id="d_cast"><option value="">+ add…</option>${HEROIS_DA_CAMPANHA.filter(x => x.id !== d.speaker && !d.cast.includes(x.id)).map(x => `<option value="${x.id}">${esc(tr(x.nome))}</option>`).join('')}${PERSONAGENS_B().filter(p => p.id !== d.speaker && !d.cast.includes(p.id)).map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}</select></label>
    ${/^@hero/.test(d.speaker || '') || (d.cast || []).some(x => /^@hero/.test(x)) ? `<p class="ajuda">${esc(tr('Hero 1 is the first hero of the party, hero 2 the second, and so on. With fewer heroes, hero 3 speaks as hero 1 and hero 4 as hero 2. In the text, {hero1} to {hero4} become the heroes’ names.'))}</p>` : ''}
    <div>${d.cast.map(id => `<span class="tag">${esc(nomePersonagem(id))} <a href="#" data-delcast="${esc(id)}">✕</a></span>`).join('')}</div>
    <label class="campo">Background <select id="d_bg">${FUNDOS.map(f => `<option value="${f.id}" ${(d.background ?? FUNDO_PADRAO) === f.id ? 'selected' : ''}>${esc(f.name_en)}</option>`).join('')}</select></label>`}
    ${d.type === 'choice' ? '<div class="sub">Answers <button class="sm" id="d_addop">+ Answer</button></div><div id="d_ops"></div>' : ''}
    <div class="sub">When this box is shown</div>${acoesHtml(d.acoes, 'acoes')}
    <div class="linha acoes"><button class="sm perigo" id="d_apagar">Delete this box</button></div></div>`;
  if (video) campoVideo($('#d_video'), d, () => { renderEsqC(); desenharC(); });
  else {
  $('#d_speaker').onchange = e => { d.speaker = e.target.value; d.cast = d.cast.filter(c => c !== d.speaker); renderC(); };
  $('#d_title').oninput = e => { d.title = e.target.value; renderEsqC(); desenharC(); };
  const es = new Set(escolhasDaCampanha());
  const pintarMarcas = () => { const ms = marcasDoTexto(d.text); $('#d_marcas').innerHTML = ms.map(m => es.has(m) ? `<span class="ok">✓ <b data-sem-traducao>{${esc(m)}}</b> ${esc(tr('shows its value'))}</span>` : `<span class="ruim">⚠ <b data-sem-traducao>{${esc(m)}}</b> ${esc(tr('is no story variable'))}</span>`).join(' · '); };
  $('#d_texto').oninput = e => { d.text = e.target.value; desenharC(); pintarMarcas(); }; pintarMarcas();
  el.querySelectorAll('[data-insvar]').forEach(b => b.onclick = () => { const t = $('#d_texto'); const a = t.selectionStart ?? t.value.length, z = t.selectionEnd ?? a; const m = '{' + b.dataset.insvar + '}';
    t.value = t.value.slice(0, a) + m + t.value.slice(z); d.text = t.value; t.focus(); t.selectionStart = t.selectionEnd = a + m.length; desenharC(); pintarMarcas(); });
  $('#d_cast').onchange = e => { if (e.target.value) d.cast.push(e.target.value); renderC(); };
  el.querySelectorAll('[data-delcast]').forEach(a => a.onclick = ev => { ev.preventDefault(); d.cast = d.cast.filter(c => c !== a.dataset.delcast); renderC(); });
  $('#d_bg').onchange = e => { d.background = +e.target.value; };
  }
  $('#d_tipo').onchange = e => { d.type = e.target.value; if (d.type === 'choice') { const seg = campanha.dialogos.find(x => (x.depois || []).includes(d.id)); if (!d.options.length) d.options = [{ text: '', next: seg ? seg.id : '', acoes: [] }, { text: '', next: '', acoes: [] }]; if (seg) seg.depois = seg.depois.filter(x => x !== d.id); } else { d.options.forEach(o => { if (o.next && caixaPorId(o.next) && !campanha.dialogos.some(x => (x.depois || []).includes(d.id))) { caixaPorId(o.next).depois.push(d.id); } }); } renderC(); };
  const ligarAcoes = () => el.querySelectorAll('[data-acadd]').forEach(s => s.onchange = () => { const v = s.value; if (!v) return; const ref = s.dataset.acadd; const chave = ref === 'acoes' ? 'acoes' : 'op', idx = ref === 'acoes' ? undefined : ref.split('-')[1]; const lista = chave === 'acoes' ? d.acoes : d.options[+idx].acoes;
    if (v === 'unlockNode' || v === 'completeNode') { const alvos = campanha.nos.filter(ehAncora); if (!alvos.length) return aviso('No map or waypoint to unlock.'); escolherOpcao(v === 'unlockNode' ? 'Unlock which one?' : 'Complete which one?', alvos.map(a => ({ id: a.id, titulo: rotuloDoNo(a) + (nomeDoNo(a) !== rotuloDoNo(a) ? ' · ' + nomeDoNo(a) : ''), sub: MARCADORES.find(m => m[0] === a.marcador)?.[1] })), id => { lista.push({ action: v, node: id }); renderDirC(); }); }
    else if (v === 'giveItem') { const its = ITENS_B().map(i => ({ id: i.id, titulo: i.nome, sub: 'workshop item' })); if (!its.length) return aviso('Only workshop items can be given: import or create them in the Workshop first.'); escolherOpcao('Give which item?', its, id => { lista.push({ action: 'giveItem', item: id, qty: 1 }); renderDirC(); }); }
    else if (v === 'giveMaterials') { const nn = +prompt('How many crafting materials?', '1') || 1; lista.push({ action: 'giveMaterials', n: nn }); renderDirC(); }
    else if (v === 'variavel') { const nums = variaveisNumero();
      const poe = nome => { lista.push({ action: 'variavel', nome, op: 'add', n: 1 }); renderDirC(); };
      escolherOpcao(tr('Change which variable?'), [...nums.map(x => ({ id: x, titulo: x, sub: variavelDe(x)?.nota || tr('a number of the campaign') })), { id: '', titulo: tr('+ New number variable…'), sub: tr('Honour, Fear, Villagers saved…') }], id => {
        if (id) return poe(id);
        const nome = (prompt(tr('The name of the new number variable (Honour, Fear, Villagers saved…):')) || '').trim(); if (!nome) return;
        if (campanha.escolhas.some(x => x.nome === nome) && !ehNumero(nome)) return aviso(tr('There is already a yes/no variable called “' + nome + '”: change its kind in Story variables, or pick another name.'));
        if (!campanha.escolhas.some(x => x.nome === nome)) campanha.escolhas.push({ nome, nota: '', numero: true, inicial: 0 }); poe(nome); }); }
    else if (v === 'remember') { const nome = (prompt('What does the campaign remember? A short phrase, like “Spared the bandit”.' + (escolhasDaCampanha().length ? '\nStory variables: ' + escolhasDaCampanha().join(' · ') : ''), chave === 'acoes' ? '' : (d.options[+idx].text || '')) || '').trim(); if (!nome) return; lista.push({ action: 'remember', nome }); renderDirC(); }
    s.value = ''; });
  const acaoDe = ref => { const [chave, i] = ref.split(':'); const [k, idx] = chave.split('-'); return (k === 'acoes' ? d.acoes : d.options[+idx].acoes)[+i]; };
  const ligarRemocoes = () => { el.querySelectorAll('[data-acx]').forEach(b => b.onclick = () => { const [chave, i] = b.dataset.acx.split(':'); const [k, idx] = chave.split('-'); (k === 'acoes' ? d.acoes : d.options[+idx].acoes).splice(+i, 1); renderDirC(); });
    el.querySelectorAll('[data-avop]').forEach(sl => sl.onchange = () => { const a = acaoDe(sl.dataset.avop); a.op = sl.value; if (a.op !== 'addvar') delete a.outra; renderDirC(); });
    el.querySelectorAll('[data-avn]').forEach(inp => inp.onchange = () => { acaoDe(inp.dataset.avn).n = Math.max(0, +inp.value || 0); });
    el.querySelectorAll('[data-avoutra]').forEach(sl => sl.onchange = () => { acaoDe(sl.dataset.avoutra).outra = sl.value; }); };
  const ops = $('#d_ops'); if (ops) {
    const pinta = () => { ops.innerHTML = ''; d.options.forEach((op, i) => { const dv = document.createElement('div'); dv.className = 'cartao';
      dv.innerHTML = `<div class="linha"><input data-op="text" value="${esc(op.text || '')}" placeholder="Answer ${i + 1}"><button class="sm" data-rm="${i}">✕</button></div><p class="ajuda">Then: <b>${op.next && caixaPorId(op.next) ? esc(caixaPorId(op.next).title || (caixaPorId(op.next).text || '').slice(0, 24) || 'a box') : 'end of the scene'}</b> (drag from the answer’s ● on the canvas)</p><label class="chk"><input type="checkbox" data-lembra ${op.lembrar ? 'checked' : ''}> Remember this answer</label>${op.lembrar ? `<input data-lembranome list="dl_escolhas" value="${esc(op.lembrarNome || '')}" placeholder="${esc(op.text || 'Answer ' + (i + 1))}" title="The name the campaign gives this choice. Left empty, it uses the answer’s text. Pick one of the “Story variables” or write a new name."><datalist id="dl_escolhas">${escolhasDaCampanha().map(n => `<option value="${esc(n)}">`).join('')}</datalist><p class="ajuda">Later, cards, scenes and map triggers can happen only if the party chose it (“Only if”).</p>` : ''}${acoesHtml(op.acoes, 'op-' + i)}`;
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
      if (d.type === 'video') { vistos.add(d.id); el.innerHTML = `<div class="quadro"><div class="texto">▶ Video: <b>${esc(d.video?.nome || '(no video yet)')}</b>${d.video && AUDIOS[d.video.arquivo] ? `<video controls loading="lazy" decoding="async" ${imgTardia(URL.createObjectURL(AUDIOS[d.video.arquivo]))} style="width:100%;max-height:300px;margin-top:8px;background:#000"></video>` : ''}<br><small>In the game the film plays full screen here.</small></div><div class="opcoes"><button data-next>${seguinte ? 'Continue ▸' : 'Close'}</button></div></div>`; el.querySelector('[data-next]').onclick = () => { if (!seguinte) return fechar(); atual = seguinte; mostrar(); }; return; }
      el.innerHTML = `<div class="quadro bg-${d.background ?? FUNDO_PADRAO}"><div class="fundoNome">${esc(fundoN?.name_en || '')}</div>
        <div class="cabeca">${rostoDe(d.speaker) ? `<img loading="lazy" decoding="async" ${imgTardia(rostoDe(d.speaker))} alt="">` : ''}<div><div class="nome">${esc(d.speaker ? nomePersonagem(d.speaker) : 'Narrator')}</div><div class="titulo">${esc(d.title || '')}</div></div></div>
        <div class="texto">${esc(d.text || '(no text yet)')}</div>
        ${d.cast.length ? `<div class="elenco">${d.cast.map(id => rostoDe(id) ? `<img loading="lazy" decoding="async" ${imgTardia(rostoDe(id))} title="${esc(nomePersonagem(id))}" alt="">` : '').join('')}</div>` : ''}
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
    <p class="ajuda" style="margin-top:6px">${modo === 'saida' ? 'Point at a line to light up its arrow. Click the tip of an arrow to see what comes into a card.' : 'Point at a line to light its arrow. To see where a card leads, click its ●.'}</p>
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
    if (simples) { ctxC.fillStyle = '#eef0f4'; let fs = 22 / vistaC.zoom > 40 ? 40 : 22; ctxC.font = `bold ${fs}px system-ui`; const lw = ctxC.measureText(tr(rotuloDoNo(n))).width; if (lw > CARTAO[0] - 18) { fs = Math.max(10, Math.floor(fs * (CARTAO[0] - 18) / lw)); ctxC.font = `bold ${fs}px system-ui`; } ctxC.textAlign = 'center'; ctxC.fillText(rotuloDoNo(n), x + CARTAO[0] / 2 + 4, y + CARTAO[1] / 2 + 8); ctxC.textAlign = 'left'; }
    else {
      let tx = x + 14;
      const cab = ehDialogo(n) ? caixaPorId(n.dialogo) : null; const face = cab && cab.speaker ? retratoImg('rosto:' + cab.speaker, rostoDe(cab.speaker)) : null;
      if (face && face.complete && face.naturalWidth) { ctxC.save(); ctxC.beginPath(); ctxC.arc(x + 32, y + CARTAO[1] / 2, 20, 0, Math.PI * 2); ctxC.clip(); ctxC.drawImage(face, x + 12, y + CARTAO[1] / 2 - 20, 40, 40); ctxC.restore(); tx = x + 58; }
      ctxC.fillStyle = cor; ctxC.font = `bold 10px system-ui`; ctxC.fillText(rotuloDoNo(n).toUpperCase() + (n.seEscolha ? ' · ONLY IF' : ''), tx, y + 16);
      ctxC.fillStyle = '#eef0f4'; ctxC.font = `bold 13px system-ui`; ctxC.fillText((nomeDoNo(n) === rotuloDoNo(n) ? '' : nomeDoNo(n)).slice(0, face ? 17 : 22), tx, y + 34);
      ctxC.fillStyle = COR.texto; ctxC.font = `10px system-ui`;
      const m = n.missao !== null && n.missao !== undefined ? campanha.missoes[n.missao] : null;
      const linha3 = m ? (n.missao === missaoAtual ? '▸ ' : '') + m.salas.length + (m.salas.length === 1 ? L2(' room', ' sala') : L2(' rooms', ' salas')) + L2(' · progression ', ' · progressão ') + progressoDoMapa(m) : n.tipo === 'travel' ? L2('world map: ', 'mapa-múndi: ') + n.coords[0] + ', ' + n.coords[1] : n.tipo === 'branch' ? tr((n.saidas || []).length + 1 + ' exits') : caixasDaCena(n).length + L2(' box(es)', ' caixa(s)') + (cab && cab.speaker ? ' · ' + nomePersonagem(cab.speaker) : '');
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
    <p class="ajuda">PNG or JPG, 16:9 (1820×1024 fits exactly). It covers the whole frame the game shows; it hides the game’s water, burnt land, place names and roads. The mist covers a fixed region of the game’s own map (the Mistlands).</p>
    ${mp ? camposDasEstradas() : ''}
    <div class="sub">City</div>${linha('Use my own city picture…', ci, 'cidade')}
    <p class="ajuda">The background picture of the city screen. The shops, the armory and crafting stay in their places on top of it.</p>`;
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
    <p class="ajuda">${estradaNova ? 'Click along the road on the map, point by point. To end it, double-click or press Enter. Backspace takes back the last point; Esc cancels.' : 'Click along a road on the map, point by point. The points snap to the places, to the city and to the other roads, so the crossings join.'} The party travels along the roads; between places that no road joins, it goes in a straight line. With no roads at all, every trip is a straight line.</p>
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
        else if (campanha.dialogos.some(x => x !== alvo && (x.depois || []).includes(de.n.id))) aviso('A plain box leads to one box only. To change where it leads, first remove its link (click its ●). To branch, turn the box into a question: each answer can lead to its own box.');
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
/* Ctrl+C / Ctrl+V: a card of the story flow (with its boxes, or a copy of its map) or a box of a scene */
let areaC = null;
function copiarC(n) {
  if (!n) return aviso(tr(abaC === 'caixas' ? 'Pick a box to copy.' : 'Pick a card to copy.'));
  if (abaC === 'caixas') { areaC = { tipo: 'caixa', d: clone(n) }; aviso(tr('Box copied: Ctrl+V pastes it (here or in another scene).')); return; }
  if (abaC === 'mundo' && !noMapaMundi(n)) return;
  areaC = { tipo: 'no', n: clone(n), caixas: ehDialogo(n) ? clone(caixasDaCena(n)) : [], missao: (n.tipo === 'map' || n.tipo === 'side') && campanha.missoes[n.missao] ? clone(campanha.missoes[n.missao]) : null };
  aviso(tr('Card copied: Ctrl+V pastes a copy (unlinked).'));
}
/* v372: duplicate a map or side quest of the campaign (the rooms and all): the copy comes after the same cards as the original
   and keeps its condition, so it can be changed into a variation (and linked elsewhere). Ctrl+C / Ctrl+V gives an unlinked copy. */
function duplicarNo(n) {
  if (!n || !(n.tipo === 'map' || n.tipo === 'side') || !campanha.missoes[n.missao]) return;
  const guarda = areaC;
  areaC = { tipo: 'no', n: clone(n), caixas: [], missao: clone(campanha.missoes[n.missao]) };
  colarC(true);
  areaC = guarda;
}
function colarC(duplicar) {
  if (!areaC) return aviso(tr('Nothing copied yet (Ctrl+C on a card or a box).'));
  if (areaC.tipo === 'caixa') {
    if (abaC !== 'caixas' || !cenaAberta) return aviso(tr('A box is pasted into a scene: open the scene’s boxes.'));
    const cena = noPorId(cenaAberta); const d = clone(areaC.d); const k = caixasDaCena(cena).length;
    d.id = idUnico('box-' + slug(cena.id) + '-' + (k + 1), campanha.dialogos.map(x => x.id)); d.cena = cena.id; d.depois = []; (d.options || []).forEach(o => { o.next = ''; });
    d.fluxo = [(d.fluxo || [0, 0])[0] + 40, (d.fluxo || [0, 0])[1] + 40]; areaC.d.fluxo = d.fluxo.slice();
    campanha.dialogos.push(d); caixaSel = d.id; renderC(); aviso(tr('Box pasted (unlinked: link it in the flow).')); return;
  }
  if (abaC === 'caixas') return aviso(tr('A card is pasted in the story flow.'));
  const o = areaC.n; const n = clone(o); const tipo = n.tipo;
  n.id = idUnico(tipo + '-' + proximoNum(tipo), campanha.nos.map(x => x.id)); n.num = proximoNum(tipo); n.depois = duplicar ? (o.depois || []).filter(noPorId) : [];
  if (n.nome) n.nome = n.nome + ' ' + tr('(copy)');
  if (n.tipo === 'branch') { (n.saidas || []).forEach(x => { x.para = ''; }); n.outros = ''; }
  n.fluxo = n.fluxo ? [n.fluxo[0] + 40, n.fluxo[1] + 40] : null; n.coords = [(n.coords || [0, 0])[0] + 40, (n.coords || [0, 0])[1] - 40];
  areaC.n.fluxo = n.fluxo && n.fluxo.slice(); areaC.n.coords = n.coords.slice();
  if (areaC.missao) { const p = clone(areaC.missao); if (p.meta && p.meta.name) p.meta.name = p.meta.name + ' ' + tr('(copy)'); campanha.missoes.push(p); n.missao = campanha.missoes.length - 1; }
  campanha.nos.push(n);
  if (ehDialogo(o)) {   // the boxes of the scene, with new names and the links among them kept
    const novos = new Map(); const usados = campanha.dialogos.map(x => x.id);
    areaC.caixas.forEach((d, k) => { const id = idUnico('box-' + slug(n.id) + '-' + (k + 1), usados); usados.push(id); novos.set(d.id, id); });
    areaC.caixas.forEach(d0 => { const d = clone(d0); d.id = novos.get(d0.id); d.cena = n.id; d.depois = (d.depois || []).map(x => novos.get(x)).filter(Boolean); (d.options || []).forEach(op => { op.next = novos.get(op.next) || ''; }); campanha.dialogos.push(d); });
    n.dialogo = novos.get(o.dialogo) || (caixasDaCena(n)[0] || {}).id || null; if (!n.dialogo) { const d = novaCaixa(n); n.dialogo = d.id; }
  }
  noSel = n.id; if (duplicar) { n.fluxo = null; arrumarFluxo(false); } renderC(); renderCabecalho();   // (the copy gets a free place in the flow, beside the original)
  aviso(tr(duplicar ? 'Map duplicated. The copy comes after the same cards as the original. To change it, open it with “Build the rooms”.' : 'Card pasted (unlinked: link it in the flow).'));
}
window.addEventListener('keydown', ev => {
  if ($('#telaCampanha').hidden || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || $('.modal')) return;
  if (abaC === 'mundo' && (estradaNova || colocandoCidade)) {
    if (ev.key === 'Escape') { estradaNova = null; colocandoCidade = false; renderEsqC(); desenharC(); ev.preventDefault(); return; }
    if (ev.key === 'Enter' && estradaNova) { terminarEstrada(); ev.preventDefault(); return; }
    if (ev.key === 'Backspace' && estradaNova) { estradaNova.pontos.pop(); desenharC(); ev.preventDefault(); return; }
  }
  if (ev.key === 'Escape') { if (ligando) { ligando = null; desenharC(); } else if (document.getElementById('popupLigacoes')) fecharPopup(); else if (abaC === 'caixas') mudarAba('fluxo'); else fecharCampanha(); return; }
  const n = abaC === 'caixas' ? (caixaSel && caixaPorId(caixaSel)) : (noSel && noPorId(noSel));
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'c' || ev.key === 'C')) { ev.preventDefault(); copiarC(n); return; }
  if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'v' || ev.key === 'V')) { ev.preventDefault(); colarC(); return; }
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
      ${img ? `<img loading="lazy" decoding="async" ${imgTardia(img)} alt="" loading="lazy">` : `<span class="invLetra">${letra(it.nome)}</span>`}
      <span class="invNome" data-sem-traducao title="${esc(it.nome)}">${esc(it.nome)}</span>
      ${pilha ? `<span class="invQtd"><button class="sm" data-menos>−</button><input type="number" min="0" max="9999" value="${tem ? Math.max(1, +tem.qtd || 1) : 0}" data-qtd><button class="sm" data-mais>+</button></span>` : `<input type="checkbox" ${tem ? 'checked' : ''} data-marca>`}</div>`; };
  const skills = HEROIS_IDS.map(h => ({ h, nome: nomeDoHeroi(h), img: retratoDoHeroi(h), l: periciasParaPremio(h) })).filter(x => x.l.length);
  const total = () => `${v.itens.length} ${tr('items')} · ${v.pericias.length} ${tr('skills')} · ${v.ouro} ${tr('gold')}`;
  janelaFlutuante('janelaInventario', 'Starting inventory', `<p class="ajuda">For a party of veterans: what it already holds when the campaign starts, won in earlier battles. The party receives all of it when the campaign begins. Tick the items it has and type how many of each material. The item pools of the generated maps leave out the unique items the party already has, and the game never gives the same item twice.</p>
    <div class="invTopo">
      <label class="invOuro"><span class="moeda">●</span> <span>Starting gold</span> <input type="number" min="0" id="inv_ouro" value="${v.ouro}"></label>
      <label class="sm botaoArquivo" title="Fills the starting inventory with the gold, items and materials of a save. The game keeps its saves in Legends of the Dark_Data/SavedGames/&lt;slot&gt;/: pick the newest .sav file of the slot.">📂 Import a save of the game (.sav)<input type="file" accept=".sav,.backup,.json,application/json" id="inv_sav" hidden></label>
      <button class="sm" id="inv_limpar">Clear all</button>
      <input type="search" id="inv_busca" placeholder="${esc(tr('Search an item…'))}" value="${esc(filtroInventario.texto)}">
      <label class="chk"><input type="checkbox" id="inv_so" ${filtroInventario.soTem ? 'checked' : ''}> Only what the party has</label>
      <span class="ajuda" id="inv_total">${total()}</span>
    </div>
    ${grupos.map(g => `<details class="invGrupo" open data-cls="${g.cls}"><summary><span>${esc(tr(g.nome))}</span> <small class="etq">${g.itens.filter(i => qtdDe(i.id)).length} / ${g.itens.length}</small></summary><div class="invGrade">${g.itens.map(it => ficha(g, it)).join('')}</div></details>`).join('')}
    ${ITENS_B().length || (CAT.itens || []).length ? '' : '<p class="ajuda aviso">The Workshop has no items yet: import them in the Items tab.</p>'}
    <details class="invGrupo" open><summary><span>${tr('Skills (unlocked)')}</span> <small class="etq">${v.pericias.length}</small></summary>
      ${skills.map(x => `<div class="invHeroi">${x.img ? `<img class="redondo grande" loading="lazy" decoding="async" ${imgTardia(x.img)} alt="">` : ''}<b data-sem-traducao>${esc(x.nome)}</b></div><div class="invGrade">${x.l.map(sk => `<label class="invItem pericia${v.pericias.includes(sk.id) ? ' tem' : ''}"><input type="checkbox" data-per="${esc(sk.id)}" ${v.pericias.includes(sk.id) ? 'checked' : ''}><span class="invNome" data-sem-traducao>${esc(sk.nome)}</span></label>`).join('')}</div>`).join('') || '<span class="ajuda">None.</span>'}
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
