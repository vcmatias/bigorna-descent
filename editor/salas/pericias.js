/* Bigorna Rooms v2 — the Workshop's skills. A skill card is played at the table; the app only unlocks it (a feat's reward,
   or a trigger), and lists it, locked or unlocked, in the hero's skill window. Here the game's skills are imported (to
   rename them or change their XP cost) and new ones created for a hero: the mod adds them to the game while this map (or
   campaign) is played, so a feat can reward them. A skill tied to no hero exists only here, for its cards.
   Each skill may hold the pictures of its cards (the user's own, 56 × 88 mm), printed together as a PDF, nine to a page
   with crop marks. The pictures stay in the Workshop: they never go into the exported map. */
'use strict';

const CARTA_MM = [56, 88];
/* the picture of a card, kept at print quality (300 dpi at 56 × 88 mm) */
const CARTA_PX = [662, 1040];
const periciaDoJogo = id => (CAT.habilidades || []).find(s => s._id === id);
const nomePericia = p => p.nome || (p.base && periciaDoJogo(p.base)?.name_en) || '(no name)';
const nomeHeroiPericia = id => id ? nomeDoHeroi(id) : tr('No hero (cards only)');
/* the id a skill of the workshop goes by in the game (a game skill keeps its own) */
const idPericiaExportada = p => p.base || 'BIGORNA_SKILL_' + String(p.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
/* skills a feat can reward, of hero h: the game's (by the workshop's name when imported) and the new ones of the workshop */
function periciasParaPremio(h) {
  const of = oficina().pericias || []; const trocadas = new Map(of.filter(p => p.base).map(p => [p.base, p]));
  const jogo = (CAT.habilidades || []).filter(s => HEROIS_IDS[s.Hero] === h).map(s => ({ id: s._id, nome: trocadas.has(s._id) ? nomePericia(trocadas.get(s._id)) : s.name_en }));
  return jogo.concat(of.filter(p => !p.base && p.heroi === h).map(p => ({ id: idPericiaExportada(p), nome: nomePericia(p) + ' ' + tr('(workshop)') })));
}
/* the hero of a skill by the id a feat keeps (null: not a skill) */
function heroiDaPericiaPorId(id) {
  const p = (oficina().pericias || []).find(x => !x.base && idPericiaExportada(x) === id); if (p) return p.heroi || null;
  const s = periciaDoJogo(id); return s ? HEROIS_IDS[s.Hero] || null : null;
}
/* the name of a skill by the id a feat keeps */
function nomeDePericiaPorId(id) {
  const of = oficina().pericias || []; const p = of.find(x => x.base === id || idPericiaExportada(x) === id);
  if (p) return nomePericia(p); const s = periciaDoJogo(id); return s ? s.name_en : null;
}

function novaPericia(hid, custo) {
  const p = { id: 'pr' + uid(), heroi: hid === undefined ? HEROIS_IDS[0] : hid, nome: tr('New skill'), custo: custo || 1, cartas: [], custom: true };
  oficina().pericias.push(p); abrirPericias(p.heroi, p.id);   // (v249: the skills are in the heroes tab, under each hero)
}
function importarPericia() {
  const ja = new Set(oficina().pericias.map(p => p.base).filter(Boolean));
  const lista = (CAT.habilidades || []).filter(s => !ja.has(s._id)).slice().sort((a, b) => (a.Hero - b.Hero) || (a.XPCost - b.XPCost) || a.name_en.localeCompare(b.name_en));
  if (!lista.length) { aviso('Every skill of the game is already in the workshop.'); return; }
  modalImportacao('Import skills of the game', lista.map(s => ({ c: s, nome: nomeHeroiPericia(HEROIS_IDS[s.Hero]) + ': ' + s.name_en, img: retratoDoHeroi(HEROIS_IDS[s.Hero]), sub: s.XPCost + ' XP' })), escolhidas => {
    const novas = escolhidas.map(({ c }) => ({ id: 'pr' + uid(), base: c._id, heroi: HEROIS_IDS[c.Hero] || '', nome: c.name_en, nomeJogo: c.name_en, custo: c.XPCost || 1, cartas: [] }));
    novas.forEach(p => oficina().pericias.push(p)); if (novas[0]) fichaSel = novas[0].id; renderFichas();
    aviso(novas.length === 1 ? 'Skill imported.' : novas.length + ' skills imported.');
  }, [{ nome: 'Hero', opcoes: HEROIS_IDS.map((h, i) => [i, nomeHeroiPericia(h)]), de: e => e.c.Hero }, { nome: 'XP', opcoes: [[1, '1 XP'], [2, '2 XP'], [3, '3 XP']], de: e => e.c.XPCost }]);
}

function renderPericias() {
  if (abaF !== 'pericias') return renderHerois();   // (v249: the skills are in the heroes tab, under each hero)
  const lista = oficina().pericias; if (fichaSel && !lista.some(x => x.id === fichaSel)) fichaSel = null;
  const comCartas = lista.filter(p => (p.cartas || []).length);
  $('#esqF').innerHTML = `<div class="bloco"><h2>Skills <span class="etq">${lista.length}</span></h2>
    <div class="botoes"><button class="sm" id="f_importarP">Import…</button><button class="sm primario" id="f_novaP">+ New skill</button>${botaoLote()}</div>
    <div class="botoes"><button class="sm" id="f_pdfP" ${comCartas.length ? '' : 'disabled'}>Print the cards (PDF)…</button></div>
    <p class="ajuda">Skill cards are played at the table; the app unlocks them (the reward of a feat) and lists them in each hero’s skill window. Import the game’s skills to rename them or change their cost, or create new ones for a hero: a feat can then reward them. Each skill can hold the pictures of your own cards (56 × 88 mm), to print.</p>
    <div id="f_lista"></div></div>`;
  const l = $('#f_lista');
  botaoDeFiltro($('#esqF .bloco'), lista, renderPericias);
  const ordemH = HEROIS_IDS.concat(['']); const ordem = lista.slice().sort((a, b) => ordemH.indexOf(a.heroi || '') - ordemH.indexOf(b.heroi || ''));
  listaEmGrupos(l, ordem, p => { const h = p.heroi || '';
      const d = document.createElement('div'); d.className = 'no' + (fichaSel === p.id ? ' ativo' : ''); const r = (p.cartas || [])[0]?.img || (h ? retratoDoHeroi(h) : '');
      d.innerHTML = `${r ? `<img class="face" loading="lazy" decoding="async" ${imgTardia(r)} alt="">` : '<span class="face"></span>'}<div><div data-sem-traducao>${esc(nomePericia(p))}</div><small>${p.custo || 1} XP · ${(p.cartas || []).length} ${tr('card(s)')}${p.base ? (p.custom ? ' · ' + tr('changed') : ' · ' + tr('from the game')) : ' · ' + tr('custom')}</small></div>`;
      d.onclick = () => { fichaSel = p.id; renderPericias(); }; return d;
  }, p => [p.heroi || '', nomeHeroiPericia(p.heroi || '')]);
  $('#f_importarP').onclick = importarPericia; $('#f_novaP').onclick = novaPericia; $('#f_pdfP').onclick = () => imprimirCartas();
  const p = lista.find(x => x.id === fichaSel); const c = $('#centroF');
  if (!p) { c.innerHTML = '<div class="vazio"><h2>Skills</h2><p>Pick a skill on the left, import the game’s skills, or create a new one.</p></div>'; return; }
  fichaPericia(c, p);
}

function fichaPericia(c, p) {
  setTimeout(() => primeiraVista(p), 0);   // (v240: the sheet fills its defaults first)
  const mudou = () => { p.custom = true; };
  const jogo = p.base ? periciaDoJogo(p.base) : null;
  const premiam = (oficina().facanhas || []).filter(f => (f.premios || f.premiosJogo || []).includes(idPericiaExportada(p)));
  const orig = !!p.base, mudado = orig && !!jogo && ((p.nome && p.nome !== (p.nomeJogo || jogo.name_en)) || (p.custo || 1) !== (jogo.XPCost || 1));
  c.innerHTML = `<div class="cabF"><h2 data-sem-traducao>${esc(nomePericia(p))} ${etiquetaEstado(p)}</h2><div class="botoes">${orig ? `<button class="sm primario" id="fp_dup">⧉ ${esc(tr('Duplicate'))}</button>` : ''}${mudado ? `<button class="sm" id="fp_volta">↺ ${esc(tr('Back to the game’s'))}</button>` : ''}<button class="sm perigo" id="fp_apaga">Delete</button></div></div>
    ${orig ? avisoOficial(mudado ? 'This original was changed by an older version of the editor: “↺ Back to the game’s” undoes it.' : '', 'The pictures of its cards and your notes may change here.') : ''}
    <div class="folha"><div class="col">
      <label class="campo">Name <input id="fp_nome" value="${esc(p.nome || '')}" placeholder="${esc(jogo ? jogo.name_en : '')}"></label>
      <div class="duas"><label class="campo">Hero <select id="fp_heroi" ${p.base ? 'disabled' : ''}>${HEROIS_IDS.map(h => `<option value="${h}" ${p.heroi === h ? 'selected' : ''}>${esc(nomeHeroiPericia(h))}</option>`).join('')}${p.base ? '' : `<option value="" ${!p.heroi ? 'selected' : ''}>${esc(nomeHeroiPericia(''))}</option>`}</select></label>
      <label class="campo">XP cost <select id="fp_custo">${[1, 2, 3].map(n => `<option value="${n}" ${(p.custo || 1) === n ? 'selected' : ''}>${n} XP</option>`).join('')}</select></label></div>
      <p class="ajuda">${p.base ? 'A skill of the game: it stays as in the game (duplicate it to make a new skill from it).' : p.heroi ? 'A new skill of this hero: the game lists it, locked, in the hero’s skill window; a feat of the Feats tab can reward it (or the rewards of the campaign).' : 'Tied to no hero, the skill stays only here, for its cards: the game does not see it.'}</p>
      ${p.heroi ? `<div class="sub">Rewarded by</div><div>${premiam.map(f => `<span class="tag">${esc(nomeFacanha(f))}</span>`).join('') || '<span class="ajuda">No feat of the workshop rewards it yet.</span>'} <button class="sm" id="fp_facanha">+ A feat that rewards it</button></div>` : ''}
      <label class="campo">Notes <textarea id="fp_notas" rows="3" placeholder="What the card does, for your own control">${esc(p.notas || '')}</textarea></label>
    </div><div class="col">
      <div class="sub">Cards (56 × 88 mm)</div>
      <div class="cartasP">${(p.cartas || []).map((k, i) => `<div class="cartaP"><img loading="lazy" decoding="async" ${imgTardia(k.img)} alt=""><div class="linha"><button class="sm" data-cesq="${i}" title="Move left" ${i ? '' : 'disabled'}>◂</button><button class="sm perigo" data-cdel="${i}" title="Remove">✕</button></div></div>`).join('')}</div>
      <div class="linha"><label class="sm botaoArquivo">+ Add card pictures <input type="file" accept="image/*" multiple id="fp_cartas" hidden></label><button class="sm" id="fp_gerar" title="${esc(tr('Make a card for this skill: its name, its XP cost, the hero chosen above and the text of the notes'))}">✦ ${esc(tr('Generate card'))}</button></div>
      <p class="ajuda">Your own pictures of this skill’s cards (both sides, or several versions), for your fun or your control. A landscape picture is turned. They are kept at print quality and printed at 56 × 88 mm with the button “Print the cards (PDF)”; they never go into the exported map.</p>
    </div></div>`;
  $('#fp_nome').oninput = e => { p.nome = e.target.value; mudou(); const h = c.querySelector('.cabF h2'); if (h && h.firstChild) h.firstChild.textContent = nomePericia(p) + ' '; };
  $('#fp_nome').onchange = () => renderPericias();
  const hs = $('#fp_heroi'); if (hs) hs.onchange = e => { p.heroi = e.target.value; mudou(); if (String(heroiSel).startsWith(PERICIAS)) heroiSel = PERICIAS + (p.heroi || ''); renderPericias(); };
  $('#fp_custo').onchange = e => { p.custo = +e.target.value; mudou(); renderPericias(); };
  $('#fp_notas').oninput = e => { p.notas = e.target.value; };
  $('#fp_apaga').onclick = () => { if (!confirm(tr('Delete this skill?'))) return; oficina().pericias = oficina().pericias.filter(x => x !== p); fichaSel = null; renderPericias(); };
  const nf = $('#fp_facanha'); if (nf) nf.onclick = () => { novaFacanha(); const f = oficina().facanhas[oficina().facanhas.length - 1]; if (f) { f.heroi = p.heroi; f.premios = [idPericiaExportada(p)]; renderFichas(); } };
  $('#fp_gerar').onclick = async () => { if (!p.heroi) return aviso(tr('Pick the hero of the skill first: the card shows them.')); try { p.cartas.push({ uid: uid(), img: await cartaGeradaDaPericia(p), gerada: true }); renderPericias(); aviso(tr('Card made: the hero, the name, the cost and the notes of the skill. Write in the notes what the card does, and make it again.')); } catch (e) { console.error(e); aviso(tr('The card could not be made.')); } };
  $('#fp_cartas').onchange = async e => { const fs = [...e.target.files]; for (const f of fs) { try { p.cartas.push({ uid: uid(), img: await imagemDeCarta(f) }); } catch { aviso('A picture could not be read.'); } } renderPericias(); };
  c.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => { p.cartas.splice(+b.dataset.cdel, 1); renderPericias(); });
  c.querySelectorAll('[data-cesq]').forEach(b => b.onclick = () => { const i = +b.dataset.cesq; const [k] = p.cartas.splice(i, 1); p.cartas.splice(i - 1, 0, k); renderPericias(); });
  if (!orig) return;
  travarOficial(c, '.folha > .col:nth-child(2), #fp_notas, #fp_facanha');
  $('#fp_dup').onclick = () => { const nome = nomeDaCopia(nomePericia(p), oficina().pericias.map(nomePericia).concat((CAT.habilidades || []).map(x => x.name_en))); if (!nome) return;
    const d = { id: 'pr' + uid(), heroi: p.heroi || (jogo ? HEROIS_IDS[jogo.Hero] : '') || '', nome, custo: p.custo || (jogo && jogo.XPCost) || 1, cartas: clone(p.cartas || []), notas: p.notas || '', custom: true };
    oficina().pericias.push(d); fichaSel = d.id; renderPericias(); aviso(tr('Duplicated: this one is yours to change.')); };
  const vj = $('#fp_volta'); if (vj) vj.onclick = () => { p.nome = jogo.name_en; p.nomeJogo = jogo.name_en; p.custo = jogo.XPCost || 1; renderPericias(); };
}

/* a card picture, turned upright when it came in landscape, cropped to 56 × 88 and kept as a JPEG at 300 dpi */
/* a card made by the editor for a skill, at print size: a dark frame, parchment, the name on a banner, the XP cost on a
   coin, the hero chosen (the hero of the roster who plays the profile, when there is one: their figure, or their portrait)
   in the picture window with their name below, and the notes as the text of the card */
const carregarImagemDaCarta = src => new Promise(ok => { if (!src) return ok(null); src = original(src); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
async function cartaGeradaDaPericia(p) {
  const [W, H] = CARTA_PX; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  const fig = figuraDoHeroi(p.heroi); const img = await carregarImagemDaCarta(fig.src);
  const ret = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  // the frame and the parchment
  g.fillStyle = '#1d1712'; ret(0, 0, W, H, 34); g.fill();
  const perg = g.createLinearGradient(0, 0, 0, H); perg.addColorStop(0, '#efe3c6'); perg.addColorStop(1, '#d9c69e'); g.fillStyle = perg; ret(18, 18, W - 36, H - 36, 24); g.fill();
  g.strokeStyle = '#8a6a3c'; g.lineWidth = 4; ret(28, 28, W - 56, H - 56, 18); g.stroke();
  // the picture window: the hero (a figure stands on the bottom of it; a portrait fills it)
  const jx = 48, jy = 132, jw = W - 96, jh = 470;
  const fundo = g.createRadialGradient(W / 2, jy + jh * 0.45, 30, W / 2, jy + jh / 2, jw * 0.75); fundo.addColorStop(0, '#5b4630'); fundo.addColorStop(1, '#1f1913'); g.fillStyle = fundo; g.fillRect(jx, jy, jw, jh);
  if (img) { g.save(); g.beginPath(); g.rect(jx, jy, jw, jh); g.clip();
    if (fig.corpo) { const k = Math.min(jw * 0.95 / img.width, jh * 0.97 / img.height); const w = img.width * k, h = img.height * k; g.drawImage(img, W / 2 - w / 2, jy + jh - h, w, h); }
    else { const k = Math.max(jw / img.width, jh / img.height); const w = img.width * k, h = img.height * k; g.drawImage(img, W / 2 - w / 2, jy + jh / 2 - h / 2, w, h); }
    g.restore(); }
  g.strokeStyle = '#b08a4e'; g.lineWidth = 6; g.strokeRect(jx, jy, jw, jh); g.strokeStyle = '#2a2016'; g.lineWidth = 2; g.strokeRect(jx - 4, jy - 4, jw + 8, jh + 8);
  // the name on its banner
  const nome = nomePericia(p) || tr('Skill'); g.fillStyle = '#2b2118'; ret(48, 44, W - 96, 72, 12); g.fill(); g.strokeStyle = '#b08a4e'; g.lineWidth = 3; ret(48, 44, W - 96, 72, 12); g.stroke();
  let fs = 46; g.font = `bold ${fs}px Georgia, serif`; while (g.measureText(nome).width > W - 220 && fs > 22) { fs -= 2; g.font = `bold ${fs}px Georgia, serif`; }
  g.fillStyle = '#f3dfb4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(nome, W / 2 - 34, 81);
  // the XP cost on a coin
  const cx = W - 92, cy = 80; const moeda = g.createRadialGradient(cx - 10, cy - 10, 6, cx, cy, 46); moeda.addColorStop(0, '#f6dc8e'); moeda.addColorStop(1, '#a87a2c');
  g.fillStyle = moeda; g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#4a3315'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#2b1d0c'; g.font = 'bold 40px Georgia, serif'; g.fillText(String(p.custo || 1), cx, cy - 6); g.font = 'bold 18px Georgia, serif'; g.fillText('XP', cx, cy + 24);
  // the hero's name below the picture
  const heroi = nomeDoHeroi(p.heroi); g.fillStyle = '#2b2118'; ret(W / 2 - 170, jy + jh - 22, 340, 50, 10); g.fill(); g.strokeStyle = '#b08a4e'; g.lineWidth = 2; ret(W / 2 - 170, jy + jh - 22, 340, 50, 10); g.stroke();
  g.fillStyle = '#f3dfb4'; g.font = 'italic bold 28px Georgia, serif'; g.fillText(heroi, W / 2, jy + jh + 3);
  // the text: the notes of the skill, wrapped and made smaller until they fit
  const texto = String(p.notas || '').trim(); const tx = 66, ty = jy + jh + 56, tw = W - 132, th = H - ty - 64;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#2a1f14';
  let tam = 32, linhas = [];
  const quebrar = () => { linhas = []; texto.split(/\n+/).forEach(par => { let l = ''; par.split(/\s+/).forEach(pal => { const t = l ? l + ' ' + pal : pal; if (g.measureText(t).width > tw && l) { linhas.push(l); l = pal; } else l = t; }); linhas.push(l); }); };
  do { g.font = `${tam}px Georgia, serif`; quebrar(); if (linhas.length * tam * 1.25 <= th) break; tam -= 2; } while (tam > 16);
  const y0 = ty + (th - linhas.length * tam * 1.25) / 2 + tam; linhas.forEach((l, i) => g.fillText(l, W / 2, y0 + i * tam * 1.25));
  if (!texto) { g.fillStyle = 'rgba(42,31,20,.45)'; g.font = 'italic 26px Georgia, serif'; g.fillText(tr('(write in the notes what the card does)'), W / 2, ty + th / 2); }
  g.fillStyle = 'rgba(42,31,20,.5)'; g.font = '16px Georgia, serif'; g.fillText('Bigorna', W / 2, H - 40);
  return cv.toDataURL('image/jpeg', 0.92);
}
function imagemDeCarta(arquivo) {
  return new Promise((ok, falha) => { const r = new FileReader(); r.onerror = falha; r.onload = () => { const i = new Image(); i.onerror = falha; i.onload = () => {
    const deitada = i.width > i.height; const [W, H] = CARTA_PX; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const iw = deitada ? i.height : i.width, ih = deitada ? i.width : i.height; const k = Math.max(W / iw, H / ih);
    g.save(); g.translate(W / 2, H / 2); if (deitada) g.rotate(-Math.PI / 2); g.drawImage(i, -i.width * k / 2, -i.height * k / 2, i.width * k, i.height * k); g.restore();
    ok(cv.toDataURL('image/jpeg', 0.9)); }; i.src = r.result; }; r.readAsDataURL(arquivo); });
}

/* the print: the skills with cards, ticked; the paper; each card as many times as asked */
function imprimirCartas() {
  const lista = oficina().pericias.filter(p => (p.cartas || []).length); if (!lista.length) return;
  const marcadas = new Set(lista.map(p => p.id));
  modal('Print the skill cards', `<p class="ajuda">Nine cards to a page at their real size (56 × 88 mm), with crop marks. Print at 100% (“actual size”), without fitting to the page.</p>
    <div class="linha"><label class="campo">Paper <select id="pc_papel"><option value="a4">A4</option><option value="letter">Letter</option></select></label>
    <label class="campo">Copies of each card <input type="number" id="pc_copias" min="1" max="9" value="1" style="width:60px"></label></div>
    <div class="listaImp">${lista.map(p => `<label class="chk"><input type="checkbox" data-pc="${esc(p.id)}" checked> <span data-sem-traducao>${esc(nomePericia(p))}</span> <small>(${esc(nomeHeroiPericia(p.heroi))} · ${(p.cartas || []).length} ${tr('card(s)')})</small></label>`).join('')}</div>
    <div class="linha"><span class="ajuda" id="pc_conta"></span><button class="primario" id="pc_ok">Make the PDF</button></div>`, (el, fechar) => {
    const conta = () => { const n = lista.filter(p => marcadas.has(p.id)).reduce((s, p) => s + p.cartas.length, 0) * Math.max(1, +el.querySelector('#pc_copias').value || 1); el.querySelector('#pc_conta').textContent = n + ' ' + tr('card(s)') + ', ' + Math.ceil(n / 9) + ' ' + tr('page(s)'); el.querySelector('#pc_ok').disabled = !n; };
    el.querySelectorAll('[data-pc]').forEach(ch => ch.onchange = () => { if (ch.checked) marcadas.add(ch.dataset.pc); else marcadas.delete(ch.dataset.pc); conta(); });
    el.querySelector('#pc_copias').oninput = conta; conta();
    el.querySelector('#pc_ok').onclick = async () => {
      const copias = Math.max(1, Math.min(9, +el.querySelector('#pc_copias').value || 1)); const imgs = [];
      lista.filter(p => marcadas.has(p.id)).forEach(p => p.cartas.forEach(k => { for (let i = 0; i < copias; i++) imgs.push(k.img); }));
      const blob = await pdfDeCartas(imgs, el.querySelector('#pc_papel').value);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = tr('skill cards') + '.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); fechar();
    };
  });
}

/* a PDF of card pictures (JPEGs embedded as they are, DCTDecode): 3 × 3 cards of 56 × 88 mm centred on each page, crop marks
   at every cut line outside the grid */
async function pdfDeCartas(imgs, papel = 'a4') {
  const mm = 72 / 25.4; const [W, H] = papel === 'letter' ? [612, 792] : [595.28, 841.89]; const cw = CARTA_MM[0] * mm, ch = CARTA_MM[1] * mm;
  const COL = 3, LIN = 3, POR = COL * LIN; const x0 = (W - COL * cw) / 2, y0 = (H - LIN * ch) / 2;
  // each distinct picture once
  const unicas = [...new Set(imgs)]; const jpegs = await Promise.all(unicas.map(jpegDaCarta)); const idx = new Map(unicas.map((u, i) => [u, i]));
  const enc = new TextEncoder(); const partes = []; let tam = 0; const offs = [];
  const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); tam += b.length; };
  const obj = (n, ...corpo) => { offs[n] = tam; put(n + ' 0 obj\n'); corpo.forEach(put); put('\nendobj\n'); };
  const paginas = Math.max(1, Math.ceil(imgs.length / POR)); const nImg = jpegs.length;
  const idImg = k => 3 + k, idPag = p => 3 + nImg + p * 2, idCont = p => 4 + nImg + p * 2; const total = 2 + nImg + paginas * 2;
  put('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Count ' + paginas + ' /Kids [' + Array.from({ length: paginas }, (_, p) => idPag(p) + ' 0 R').join(' ') + '] >>');
  jpegs.forEach((j, k) => obj(idImg(k), '<< /Type /XObject /Subtype /Image /Width ' + j.w + ' /Height ' + j.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + j.bytes.length + ' >>\nstream\n', j.bytes, '\nendstream'));
  const f = v => (Math.round(v * 100) / 100).toString();
  for (let p = 0; p < paginas; p++) {
    const daPagina = imgs.slice(p * POR, (p + 1) * POR); let s = '';
    daPagina.forEach((u, i) => { const c = i % COL, l = Math.floor(i / COL); const x = x0 + c * cw, y = H - y0 - (l + 1) * ch;
      s += 'q ' + f(cw) + ' 0 0 ' + f(ch) + ' ' + f(x) + ' ' + f(y) + ' cm /Im' + idx.get(u) + ' Do Q\n'; });
    // crop marks: 2 to 8 mm outside the grid, on every cut line of the cards of this page
    const lins = Math.ceil(daPagina.length / COL), cols = Math.min(COL, daPagina.length); const topo = H - y0, base = H - y0 - lins * ch, esq = x0, dir = x0 + cols * cw;
    s += '0.25 w 0 G\n';
    for (let c = 0; c <= cols; c++) { const x = x0 + c * cw; s += f(x) + ' ' + f(topo + 2 * mm) + ' m ' + f(x) + ' ' + f(topo + 8 * mm) + ' l S ' + f(x) + ' ' + f(base - 2 * mm) + ' m ' + f(x) + ' ' + f(base - 8 * mm) + ' l S\n'; }
    for (let l = 0; l <= lins; l++) { const y = topo - l * ch; s += f(esq - 2 * mm) + ' ' + f(y) + ' m ' + f(esq - 8 * mm) + ' ' + f(y) + ' l S ' + f(dir + 2 * mm) + ' ' + f(y) + ' m ' + f(dir + 8 * mm) + ' ' + f(y) + ' l S\n'; }
    const usadas = [...new Set(daPagina.map(u => idx.get(u)))];
    obj(idPag(p), '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + f(W) + ' ' + f(H) + '] /Resources << /XObject << ' + usadas.map(k => '/Im' + k + ' ' + idImg(k) + ' 0 R').join(' ') + ' >> >> /Contents ' + idCont(p) + ' 0 R >>');
    const b = enc.encode(s); obj(idCont(p), '<< /Length ' + b.length + ' >>\nstream\n', b, '\nendstream');
  }
  const xref = tam; let x = 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n';
  for (let n = 1; n <= total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  put(x + 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(partes, { type: 'application/pdf' });
}
/* the JPEG bytes of a card picture (redrawn as a JPEG when it is not one) */
function jpegDaCarta(url) {
  url = original(url);   // (v238: the original picture, never the editor's light copy)
  return new Promise((ok, falha) => { const i = new Image(); i.onerror = falha; i.onload = () => {
    let u = url; if (!/^data:image\/jpeg/i.test(url)) { const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(i, 0, 0); u = cv.toDataURL('image/jpeg', 0.92); }
    const bin = atob(u.split(',')[1]); const bytes = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    ok({ bytes, w: i.width, h: i.height }); }; i.src = url; });
}

/* the skills for the mod: the game's changed (name, cost) and the new ones tied to a hero; never the pictures */
function periciasExportadas() {
  return (oficina().pericias || []).filter(p => p.heroi && (!p.base || p.custom)).map(p => ({ id: idPericiaExportada(p), ...(p.base ? { game: p.base } : {}), hero: p.heroi, name: nomePericia(p), cost: p.custo || 1 }));
}

/* v249: like the feats, the skills belong to the hero: on the hero's sheet, a square for each skill by its XP cost (each hero of
   the game has 5 skills of 1 XP, 5 of 2 XP and 1 of 3 XP); "Define skills" (on the sheet and under the hero in the picture of
   the party) opens the hero's skills beside every skill there is. The game's skills of the hero come with it, as in the game
   (opening one brings it into the Workshop, for its cards and notes; duplicate it to change it); a skill of another hero comes
   in as a copy of the hero's own. A skill tied to no hero (cards only) has a panel of its own. */
const PERICIAS = '@pericias:';
const XP_DO_JOGO = [[1, 5], [2, 5], [3, 1]];
function abrirPericias(hid, pid) { abaF = 'herois'; heroiSel = PERICIAS + (hid || ''); fichaSel = pid || null; $('#telaFichas').hidden = false; renderFichas(); }
/* the skills of a hero: the game's (its version in the Workshop, when imported) and the Workshop's own for the hero */
function periciasDoHeroi(hid) {
  const of = oficina().pericias || []; const importadas = new Map(of.filter(p => p.base).map(p => [p.base, p]));
  const jogo = hid ? (CAT.habilidades || []).filter(s => HEROIS_IDS[s.Hero] === hid).map(s => { const p = importadas.get(s._id);
    return { chave: p ? p.id : s._id, p: p || null, c: s, nome: p ? nomePericia(p) : s.name_en, xp: p ? (p.custo || 1) : (s.XPCost || 1), propria: false }; }) : [];
  const proprias = of.filter(p => !p.base && (p.heroi || '') === (hid || '')).map(p => ({ chave: p.id, p, c: null, nome: nomePericia(p), xp: p.custo || 1, propria: true }));
  return jogo.concat(proprias);
}
function periciasPorXp(hid) {
  const por = new Map(XP_DO_JOGO.map(([x, n]) => [x, { x, n: hid ? n : 0, ps: [] }]));
  periciasDoHeroi(hid).forEach(s => { if (!por.has(s.xp)) por.set(s.xp, { x: s.xp, n: 0, ps: [] }); por.get(s.xp).ps.push(s); });
  return [...por.values()].sort((a, b) => a.x - b.x).map((g, k) => ({ ...g, cor: Math.min(4, k * 2) }));
}
function casasDoXp(g, comBotao) {
  const cheias = g.ps.map(s => { const tit = esc(s.nome + ' · ' + s.xp + ' XP' + (s.propria ? ' · ' + tr('custom') : ''));
    return comBotao ? `<button class="casaProeza c${g.cor} ${s.propria ? 'propria' : ''}" data-rolk="${esc(s.chave)}" title="${tit}" data-sem-traducao>${esc((s.nome.trim()[0] || '?').toUpperCase())}</button>` : `<span class="casaProeza c${g.cor}" title="${tit}"></span>`; });
  const vazias = Array.from({ length: Math.max(0, g.n - g.ps.length) }, () => comBotao ? `<button class="casaProeza vazia" data-rolk="" title="${esc(tr('An empty place: define a skill'))}"></button>` : '<span class="casaProeza vazia"></span>');
  return cheias.concat(vazias).join('');
}
function rolDePericias(hid) {
  const gs = periciasPorXp(hid); const n = gs.reduce((a, g) => a + g.ps.length, 0);
  return `<div class="rolProezas rolPericias"><div class="cabRol"><span>❖ ${esc(tr('Skills'))} <span class="etq">${n}</span></span><button class="sm" data-rolk="">${esc(tr('Define skills'))}</button></div>
    <div class="piramideProezas">${gs.map(g => `<div class="linhaTier ${g.ps.length < g.n ? 'falta' : ''}"><span class="rotTier">${g.x} XP</span><span class="casasTier">${casasDoXp(g, true)}</span><span class="rotTier"></span></div>`).join('')}</div></div>`;
}
/* the Workshop entry of a skill of the hero (a game skill not brought in comes in now, as in the game) */
function periciaDaChave(hid, chave) {
  const of = oficina().pericias; let p = of.find(x => x.id === chave); if (p) return p;
  const s = periciaDoJogo(chave); if (!s) return null;
  p = of.find(x => x.base === s._id); if (p) return p;
  p = { id: 'pr' + uid(), base: s._id, heroi: HEROIS_IDS[s.Hero] || hid || '', nome: s.name_en, nomeJogo: s.name_en, custo: s.XPCost || 1, cartas: [] };
  of.push(p); return p;
}
/* every skill there is (the game's, the Workshop's own), the column on the left of a hero's skills */
let _buscaPericias = '';
function todasAsPericias() {
  const of = oficina().pericias || []; const importadas = new Map(of.filter(p => p.base).map(p => [p.base, p]));
  const jogo = (CAT.habilidades || []).map(s => { const p = importadas.get(s._id); return { chave: s._id, heroi: HEROIS_IDS[s.Hero] || '', nome: p ? nomePericia(p) : s.name_en, xp: p ? (p.custo || 1) : (s.XPCost || 1), propria: false, p: p || null }; });
  const proprias = of.filter(p => !p.base && !p.origem).map(p => ({ chave: p.id, heroi: p.heroi || '', nome: nomePericia(p), xp: p.custo || 1, propria: true, p }));
  return jogo.concat(proprias).sort((a, b) => a.xp - b.xp || a.nome.localeCompare(b.nome, undefined, { sensitivity: 'base' }));
}
/* a skill for this hero: one of the hero's own is just opened; one of another hero comes in as a copy (name, cost, cards, notes) */
function periciaParaHeroi(hid, x) {
  if (x.heroi === hid) return x.propria ? x.chave : periciaDaChave(hid, x.chave).id;
  const ja = (oficina().pericias || []).find(p => !p.base && p.heroi === hid && p.origem === x.chave); if (ja) return ja.id;
  const p = { id: 'pr' + uid(), heroi: hid, nome: x.nome, custo: x.xp, cartas: clone((x.p && x.p.cartas) || []), notas: (x.p && x.p.notas) || '', custom: true, origem: x.chave };
  oficina().pericias.push(p); return p.id;
}
function colunaDeTodasAsPericias(el, hid) {
  const tem = new Set(periciasDoHeroi(hid).map(s => s.p && s.p.origem ? s.p.origem : (s.c ? s.c._id : s.chave)));
  el.innerHTML = `<div class="sub">${esc(tr('Every skill'))}</div><input type="search" id="fk_busca" placeholder="${esc(tr('Search a skill…'))}" value="${esc(_buscaPericias)}">
    <p class="ajuda">${esc(tr('Click a skill to add it to this hero (one of another hero comes as a copy).'))}</p><div class="listaTodas"></div>`;
  const lista = el.querySelector('.listaTodas');
  const pintar = () => { const q = semAcento(_buscaPericias.trim().toLowerCase()); let antes = null;
    lista.innerHTML = todasAsPericias().filter(x => !q || semAcento((x.nome + ' ' + (x.heroi ? nomeDoHeroi(x.heroi) : '')).toLowerCase()).includes(q)).map(x => {
      const ja = tem.has(x.chave); const cab = x.xp !== antes ? `<div class="tierTodas">${x.xp} XP</div>` : ''; antes = x.xp;
      return cab + `<button class="proezaTodas ${ja ? 'ja' : ''}" data-todask="${esc(x.chave)}" ${ja ? 'disabled' : ''} title="${esc(x.heroi ? nomeDoHeroi(x.heroi) : tr('No hero (cards only)'))}"><span data-sem-traducao>${esc(x.nome)}</span><small class="ajuda" data-sem-traducao>${esc(x.heroi ? nomeDoHeroi(x.heroi) : '—')}</small>${x.propria ? ` <small class="etq custom">${esc(tr('custom'))}</small>` : ''}<i>${ja ? '✓' : '+'}</i></button>`; }).join('') || `<p class="ajuda">${esc(tr('No skill found.'))}</p>`;
    lista.querySelectorAll('[data-todask]').forEach(b => b.onclick = () => { const x = todasAsPericias().find(y => y.chave === b.dataset.todask); if (!x) return;
      const topo = lista.scrollTop; const id = periciaParaHeroi(hid, x); abrirPericias(hid, id); const l2 = document.querySelector('.listaTodas'); if (l2) l2.scrollTop = topo; }); };
  pintar();
  el.querySelector('#fk_busca').oninput = e => { _buscaPericias = e.target.value; pintar(); };
}
const _xpAbertos = new Set();
function painelDePericias(c, hid) {
  const todas = periciasDoHeroi(hid);
  // (the sheet picked: a Workshop skill of this hero; a game skill of the hero comes in when opened)
  if (fichaSel && !todas.some(s => s.chave === fichaSel || (s.p && s.p.id === fichaSel))) fichaSel = null;
  const comCartas = (oficina().pericias || []).filter(p => (p.cartas || []).length).length;
  const titulo = hid ? tr('Skills of') + ' ' + nomeDoPerfil(hid) : tr('Skills with no hero (cards only)');
  c.innerHTML = `<div class="proezasDuas">${hid ? '<aside class="todasProezas" id="fk_todas"></aside>' : '<div></div>'}<div class="proezasDoHeroi">
    <div class="cabF"><h2>${esc(titulo)} <span class="etq">${todas.length}</span></h2><div class="botoes"><button class="sm" id="fk_volta">◂ ${esc(tr('The party'))}</button>${comCartas ? `<button class="sm" id="fk_pdf">${esc(tr('Print the cards (PDF)…'))}</button>` : ''}<button class="sm primario" id="fk_nova">+ ${esc(tr('New skill'))}</button></div></div>
    <p class="ajuda">${esc(hid ? tr('The skills of the hero, by their XP cost: the game’s come with the hero, as in the game (open one to add its cards and notes; duplicate it to change it). Add others from the column on the left, or make new ones.') : tr('A skill tied to no hero stays only in the Workshop, for its cards: the game does not see it. Give it a hero on its sheet.'))}</p>
    <div class="tiersProezas">${periciasPorXp(hid).filter(g => g.n || g.ps.length).map(g => { const falta = Math.max(0, g.n - g.ps.length); const aberto = !hid || _xpAbertos.has(hid + ':' + g.x) || g.ps.some(s => s.chave === fichaSel || (s.p && s.p.id === fichaSel));
      return `<details class="tierProeza ${falta ? 'falta' : ''}" data-xp="${g.x}" ${aberto ? 'open' : ''}><summary><span class="nomeTier">${g.x} XP</span><span class="casasTier">${casasDoXp(g, false)}</span><small>${falta ? esc(falta + ' ' + tr(falta > 1 ? 'places empty' : 'place empty')) : g.ps.length ? '✓' : ''}</small></summary>
        <div class="listaProezas">${g.ps.map(s => { const p = s.p; const ativo = fichaSel && (s.chave === fichaSel || (p && p.id === fichaSel));
          const estado = s.propria ? tr('custom') : p && p.custom ? tr('of the game, changed') : tr('of the game');
          return `<div class="no proeza ${ativo ? 'ativo' : ''}" data-per="${esc(s.chave)}"><div><div data-sem-traducao>${esc(s.nome)}</div><small>${esc(estado)} · ${s.xp} XP${p && (p.cartas || []).length ? ' · ' + p.cartas.length + ' ' + esc(tr('card(s)')) : ''}</small></div>${s.propria ? `<button class="sm" data-perx="${esc(s.chave)}" title="${esc(tr('Delete this skill'))}">✕</button>` : ''}</div>`; }).join('') || `<p class="ajuda">${esc(tr('No skill of this cost: add one from the column on the left, or make a new one.'))}</p>`}
          ${hid ? `<button class="sm" data-novaxp="${g.x}">+ ${esc(tr('New skill of'))} ${g.x} XP</button>` : ''}</div></details>`; }).join('') || `<p class="ajuda">${esc(tr('None.'))}</p>`}</div>
    <div id="fk_ficha"></div></div></div>`;
  if (hid) colunaDeTodasAsPericias($('#fk_todas'), hid);
  $('#fk_volta').onclick = () => { heroiSel = EQUIPE; fichaSel = null; renderHerois(); };
  $('#fk_nova').onclick = () => novaPericia(hid || '');
  const pdf = $('#fk_pdf'); if (pdf) pdf.onclick = () => imprimirCartas();
  c.querySelectorAll('[data-novaxp]').forEach(b => b.onclick = () => novaPericia(hid, +b.dataset.novaxp));
  c.querySelectorAll('details[data-xp]').forEach(d => d.ontoggle = () => { const k = hid + ':' + d.dataset.xp; if (d.open) _xpAbertos.add(k); else _xpAbertos.delete(k); });
  c.querySelectorAll('[data-per]').forEach(d => d.onclick = e => { if (e.target.closest('[data-perx]')) return; const p = periciaDaChave(hid, d.dataset.per); if (!p) return; fichaSel = p.id; renderHerois(); });
  c.querySelectorAll('[data-perx]').forEach(b => b.onclick = () => { if (!confirm(tr('Delete this skill?'))) return; oficina().pericias = oficina().pericias.filter(x => x.id !== b.dataset.perx); if (fichaSel === b.dataset.perx) fichaSel = null; renderHerois(); });
  if (!fichaSel) return;
  const p = oficina().pericias.find(x => x.id === fichaSel) || (periciaDoJogo(fichaSel) ? periciaDaChave(hid, fichaSel) : null);
  if (p) { fichaSel = p.id; fichaPericia($('#fk_ficha'), p); }
}

