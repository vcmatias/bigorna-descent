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

function novaPericia() {
  const p = { id: 'pr' + uid(), heroi: HEROIS_IDS[0], nome: tr('New skill'), custo: 1, cartas: [], custom: true };
  oficina().pericias.push(p); abaF = 'pericias'; fichaSel = p.id; renderFichas();
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
  const lista = oficina().pericias; if (fichaSel && !lista.some(x => x.id === fichaSel)) fichaSel = null;
  const comCartas = lista.filter(p => (p.cartas || []).length);
  $('#esqF').innerHTML = `<div class="bloco"><h2>Skills <span class="etq">${lista.length}</span></h2>
    <div class="botoes"><button class="sm" id="f_importarP">Import…</button><button class="sm primario" id="f_novaP">+ New skill</button></div>
    <div class="botoes"><button class="sm" id="f_pdfP" ${comCartas.length ? '' : 'disabled'}>Print the cards (PDF)…</button></div>
    <p class="ajuda">Skill cards are played at the table; the app unlocks them (the reward of a feat) and lists them in each hero’s skill window. Import the game’s skills to rename them or change their cost, or create new ones for a hero: a feat can then reward them. Each skill can hold the pictures of your own cards (56 × 88 mm), to print.</p>
    <div id="f_lista"></div></div>`;
  const l = $('#f_lista');
  HEROIS_IDS.concat(['']).forEach(h => {
    const doH = lista.filter(p => (p.heroi || '') === h); if (!doH.length) return;
    const t = document.createElement('div'); t.className = 'sub pequena'; t.textContent = nomeHeroiPericia(h); l.appendChild(t);
    doH.forEach(p => {
      const d = document.createElement('div'); d.className = 'no' + (fichaSel === p.id ? ' ativo' : ''); const r = (p.cartas || [])[0]?.img || (h ? retratoDoHeroi(h) : '');
      d.innerHTML = `${r ? `<img class="face" src="${r}" alt="">` : '<span class="face"></span>'}<div><div data-sem-traducao>${esc(nomePericia(p))}</div><small>${p.custo || 1} XP · ${(p.cartas || []).length} ${tr('card(s)')}${p.base ? (p.custom ? ' · ' + tr('changed') : ' · ' + tr('from the game')) : ' · ' + tr('custom')}</small></div>`;
      d.onclick = () => { fichaSel = p.id; renderPericias(); }; l.appendChild(d);
    });
  });
  if (!lista.length) l.innerHTML = '<p class="ajuda">Nothing yet.</p>';
  $('#f_importarP').onclick = importarPericia; $('#f_novaP').onclick = novaPericia; $('#f_pdfP').onclick = () => imprimirCartas();
  const p = lista.find(x => x.id === fichaSel); const c = $('#centroF');
  if (!p) { c.innerHTML = '<div class="vazio"><h2>Skills</h2><p>Pick a skill on the left, import the game’s skills, or create a new one.</p></div>'; return; }
  fichaPericia(c, p);
}

function fichaPericia(c, p) {
  const mudou = () => { p.custom = true; };
  const jogo = p.base ? periciaDoJogo(p.base) : null;
  const premiam = (oficina().facanhas || []).filter(f => (f.premios || f.premiosJogo || []).includes(idPericiaExportada(p)));
  c.innerHTML = `<div class="cabF"><h2 data-sem-traducao>${esc(nomePericia(p))} ${etiquetaEstado(p)}</h2><div class="botoes"><button class="sm perigo" id="fp_apaga">Delete</button></div></div>
    <div class="folha"><div class="col">
      <label class="campo">Name <input id="fp_nome" value="${esc(p.nome || '')}" placeholder="${esc(jogo ? jogo.name_en : '')}"></label>
      <div class="duas"><label class="campo">Hero <select id="fp_heroi" ${p.base ? 'disabled' : ''}>${HEROIS_IDS.map(h => `<option value="${h}" ${p.heroi === h ? 'selected' : ''}>${esc(nomeHeroiPericia(h))}</option>`).join('')}${p.base ? '' : `<option value="" ${!p.heroi ? 'selected' : ''}>${esc(nomeHeroiPericia(''))}</option>`}</select></label>
      <label class="campo">XP cost <select id="fp_custo">${[1, 2, 3].map(n => `<option value="${n}" ${(p.custo || 1) === n ? 'selected' : ''}>${n} XP</option>`).join('')}</select></label></div>
      <p class="ajuda">${p.base ? 'A skill of the game: its hero stays the same; the name and the cost change while this map or campaign is played.' : p.heroi ? 'A new skill of this hero: the game lists it, locked, in the hero’s skill window; a feat of the Feats tab can reward it (or the rewards of the campaign).' : 'Tied to no hero, the skill stays only here, for its cards: the game does not see it.'}</p>
      ${p.heroi ? `<div class="sub">Rewarded by</div><div>${premiam.map(f => `<span class="tag">${esc(nomeFacanha(f))}</span>`).join('') || '<span class="ajuda">No feat of the workshop rewards it yet.</span>'} <button class="sm" id="fp_facanha">+ A feat that rewards it</button></div>` : ''}
      <label class="campo">Notes <textarea id="fp_notas" rows="3" placeholder="What the card does, for your own control">${esc(p.notas || '')}</textarea></label>
    </div><div class="col">
      <div class="sub">Cards (56 × 88 mm)</div>
      <div class="cartasP">${(p.cartas || []).map((k, i) => `<div class="cartaP"><img src="${k.img}" alt=""><div class="linha"><button class="sm" data-cesq="${i}" title="Move left" ${i ? '' : 'disabled'}>◂</button><button class="sm perigo" data-cdel="${i}" title="Remove">✕</button></div></div>`).join('')}</div>
      <label class="sm botaoArquivo">+ Add card pictures <input type="file" accept="image/*" multiple id="fp_cartas" hidden></label>
      <p class="ajuda">Your own pictures of this skill’s cards (both sides, or several versions), for your fun or your control. A landscape picture is turned. They are kept at print quality and printed at 56 × 88 mm with the button “Print the cards (PDF)”; they never go into the exported map.</p>
    </div></div>`;
  $('#fp_nome').oninput = e => { p.nome = e.target.value; mudou(); const h = c.querySelector('.cabF h2'); if (h && h.firstChild) h.firstChild.textContent = nomePericia(p) + ' '; };
  $('#fp_nome').onchange = () => renderPericias();
  const hs = $('#fp_heroi'); if (hs) hs.onchange = e => { p.heroi = e.target.value; mudou(); renderPericias(); };
  $('#fp_custo').onchange = e => { p.custo = +e.target.value; mudou(); renderPericias(); };
  $('#fp_notas').oninput = e => { p.notas = e.target.value; };
  $('#fp_apaga').onclick = () => { if (!confirm(tr('Delete this skill?'))) return; oficina().pericias = oficina().pericias.filter(x => x !== p); fichaSel = null; renderPericias(); };
  const nf = $('#fp_facanha'); if (nf) nf.onclick = () => { novaFacanha(); const f = oficina().facanhas[oficina().facanhas.length - 1]; if (f) { f.heroi = p.heroi; f.premios = [idPericiaExportada(p)]; renderFichas(); } };
  $('#fp_cartas').onchange = async e => { const fs = [...e.target.files]; for (const f of fs) { try { p.cartas.push({ uid: uid(), img: await imagemDeCarta(f) }); } catch { aviso('A picture could not be read.'); } } renderPericias(); };
  c.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => { p.cartas.splice(+b.dataset.cdel, 1); renderPericias(); });
  c.querySelectorAll('[data-cesq]').forEach(b => b.onclick = () => { const i = +b.dataset.cesq; const [k] = p.cartas.splice(i, 1); p.cartas.splice(i - 1, 0, k); renderPericias(); });
}

/* a card picture, turned upright when it came in landscape, cropped to 56 × 88 and kept as a JPEG at 300 dpi */
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
  return new Promise((ok, falha) => { const i = new Image(); i.onerror = falha; i.onload = () => {
    let u = url; if (!/^data:image\/jpeg/i.test(url)) { const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(i, 0, 0); u = cv.toDataURL('image/jpeg', 0.92); }
    const bin = atob(u.split(',')[1]); const bytes = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    ok({ bytes, w: i.width, h: i.height }); }; i.src = url; });
}

/* the skills for the mod: the game's changed (name, cost) and the new ones tied to a hero; never the pictures */
function periciasExportadas() {
  return (oficina().pericias || []).filter(p => p.heroi && (!p.base || p.custom)).map(p => ({ id: idPericiaExportada(p), ...(p.base ? { game: p.base } : {}), hero: p.heroi, name: nomePericia(p), cost: p.custo || 1 }));
}
