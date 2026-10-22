/* ------------------------------------------------------------ v240: the pictures as files
   A picture of the work (a portrait, an art, a standee, a tile's texture, an icon, a card) is a file named by its content
   (the first 32 hex digits of the SHA-256 of its bytes): "imagens/<hash>.<png|jpg>". The work, the Workshop and the
   packages keep only that name (a reference), so saving, undoing, comparing and translating never carry megabytes.
   The files live in the store of the editor (the app: Bigorna\Imagens in the game's data folder; a browser: its database),
   with a light copy for the screen (WebP, at most 768 px). A map or campaign written into a folder takes along an "imagens"
   folder with the pictures it uses; a file downloaded alone (or a package to share) carries them inside (data: URLs), as
   before. A picture that comes in as a data: URL (an older file, a package, an upload) is moved into the store and its
   place takes the reference ("extrairImagens"). */
const IMG_RE = /^imagens\/([0-9a-f]{32})\.(png|jpg|webp|gif)$/;
const ehImg = s => typeof s === 'string' && s.length <= 48 && s.charCodeAt(0) === 105 && IMG_RE.test(s);
const hashDaImg = s => s.slice(8, 40);
const nomeDaImg = s => s.slice(8);
const IMG_LEVE_LADO = 768, IMG_MIN = 4096;
/* the light copy of a picture, for the screen (the original goes into what is written and baked) */
const urlLeve = ref => 'imagens/leve/' + hashDaImg(ref) + '.webp';
/* a picture's source for the screen: a reference shows its light copy; anything else is itself */
const fonteLeve = s => ehImg(s) ? urlLeve(s) : s;
/* (a key for a picture in a cache: a reference is itself; a data: URL, its length, as before) */
const marcaImg = s => ehImg(s) ? s : (s || '').length;

const Deposito = (() => {
  const app = typeof Arquivos !== 'undefined' && Arquivos.ativo;
  const tem = new Set();          // names known to be in the store
  const semLeve = new Set();      // hashes whose light copy is the original itself (small pictures)
  const nomePorHash = new Map();  // hash -> name of the original (its extension)
  const caminho = nome => 'Bigorna/Imagens/' + nome.slice(0, 2) + '/' + nome;
  const caminhoLeve = h => 'Bigorna/Imagens/leve/' + h.slice(0, 2) + '/' + h + '.webp';
  const lembrar = nome => { tem.add(nome); nomePorHash.set(nome.slice(0, 32), nome); };
  let listado = null;
  /* (a browser: the names in its database, read once) */
  function listar() {
    if (app) return Promise.resolve();
    return listado || (listado = (async () => { try { (await Config.chavesCom('img:')).forEach(k => lembrar(k.slice(4))); (await Config.chavesCom('imgsemleve:')).forEach(k => semLeve.add(k.slice(11))); } catch { } })());
  }
  async function existem(nomes) {
    const falta = nomes.filter(n => !tem.has(n)); if (!falta.length) return new Set(nomes);
    if (app) { try { const r = await fetch('/api/existem', { method: 'POST', body: falta.join('\n') }); if (r.ok) (await r.json()).tem.forEach(lembrar); } catch { } }
    else await listar();
    return new Set(nomes.filter(n => tem.has(n)));
  }
  /* original (Blob) and light copy (Blob, or null: the original serves) */
  async function gravar(nome, blob, leve) {
    const h = nome.slice(0, 32);
    if (app) { await Arquivos.gravar(caminho(nome), blob); if (leve) await Arquivos.gravar(caminhoLeve(h), leve); }
    else { const pares = [['img:' + nome, blob]]; if (leve) pares.push(['imgleve:' + h, leve]); else pares.push(['imgsemleve:' + h, 1]); await Config.gravarVarios(pares); }
    if (!leve) semLeve.add(h);
    lembrar(nome);
  }
  /* (an app of an earlier version, without the routes of the pictures: they are read through /api/ler, until the game, at
     its title screen, installs the new app) */
  const rotas = !app ? Promise.resolve(false) : fetch('/api/existem', { method: 'POST', body: '' }).then(r => r.status !== 404, () => true);
  const lerApi = async c => { const r = await fetch('/api/ler?c=' + encodeURIComponent(c), { cache: 'no-store' }); return r.ok ? r.blob() : null; };
  async function ler(nome) {
    if (app) { if (await rotas) { const r = await fetch('imagens/' + nome); return r.ok ? r.blob() : null; } return lerApi(caminho(nome)); }
    const b = await Config.lerBlob('img:' + nome); return b instanceof Blob ? b : null;
  }
  async function lerLeve(h) {
    if (app) { if (await rotas) { const r = await fetch('imagens/leve/' + h + '.webp'); return r.ok ? r.blob() : null; }
      const l = await lerApi(caminhoLeve(h)); if (l) return l; for (const e of ['png', 'jpg']) { const o = await lerApi(caminho(h + '.' + e)); if (o) return o; } return null; }
    await listar();
    if (!semLeve.has(h)) { const b = await Config.lerBlob('imgleve:' + h); if (b instanceof Blob) return b; }
    const n = nomePorHash.get(h); return n ? ler(n) : null;
  }
  /* (the app) the pictures not in the store, looked for in the data folder (the "imagens" folders of the maps, campaigns
     and packages) and copied into it; the names not found come back */
  async function recolher(nomes) {
    const falta = nomes.filter(n => !tem.has(n)); if (!falta.length) return [];
    if (!app) { await listar(); return falta.filter(n => !tem.has(n)); }
    try { const r = await fetch('/api/recolher', { method: 'POST', body: falta.join('\n') }); if (!r.ok) return falta; const j = await r.json(); falta.forEach(n => { if (!j.faltam.includes(n)) lembrar(n); }); return j.faltam; }
    catch { return falta; }
  }
  /* (the app) the pictures copied from the store into a folder of the data folder (the "imagens" of a map); the names not
     in the store come back */
  async function copiarPara(pasta, nomes) {
    if (!nomes.length) return [];
    const r = await fetch('/api/imagens?c=' + encodeURIComponent(pasta), { method: 'POST', body: nomes.join('\n') });
    if (!r.ok) throw new Error(await r.text()); return (await r.json()).faltam;
  }
  return { app, rotas, existem, gravar, ler, lerLeve, recolher, copiarPara, listar, lembrar, tem, semLeve, caminho, caminhoLeve };
})();

/* the browser: a reference is read from the database (the app serves it itself). An <img>, a new Image() and fetch() given a
   reference get its blob: URL, made when asked; the URLs of pictures off the screen are freed when the tab changes */
const _urlsImg = new Map();   // 'imagens/…' -> blob: URL
async function urlDaImg(u) {
  if (Deposito.app && await Deposito.rotas) return u;
  let r = _urlsImg.get(u); if (r) return r;
  const leve = u.startsWith('imagens/leve/'); const b = leve ? await Deposito.lerLeve(u.slice(13, 45)) : await Deposito.ler(u.slice(8));
  if (!b) return null;
  r = _urlsImg.get(u); if (r) return r;
  r = URL.createObjectURL(b); _urlsImg.set(u, r); return r;
}
if (typeof HTMLImageElement !== 'undefined') {
  // (the app with its routes: the pictures go straight; the browser, or an earlier app: read here and given as blob:)
  let direto = false; if (Deposito.app) Deposito.rotas.then(v => { direto = v; });
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, enumerable: true, get() { return d.get.call(this); },
    set(v) { if (typeof v === 'string' && v.startsWith('imagens/') && !direto) { const el = this; el._img = v; urlDaImg(v).then(u => { if (el._img === v) d.set.call(el, u || VAZIA_IMG); }, () => d.set.call(el, VAZIA_IMG)); return; } this._img = null; d.set.call(this, v); } });
  const f0 = window.fetch.bind(window);
  window.fetch = (r, o) => {
    if (typeof r === 'string' && r.startsWith('imagens/') && !direto) { const leve = r.startsWith('imagens/leve/');
      return (leve ? Deposito.lerLeve(r.slice(13, 45)) : Deposito.ler(r.slice(8))).then(b => b ? new Response(b, { status: 200, headers: { 'Content-Type': b.type || 'image/png' } }) : new Response('', { status: 404 })); }
    return f0(r, o);
  };
}
const VAZIA_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/* ------------------------------------------------------------ bytes, hash, light copy */
function bytesDeDataUrl(s) {
  const i = s.indexOf(','); const meta = s.slice(5, i); const tipo = (meta.split(';')[0] || '').toLowerCase();
  if (!/;base64/i.test(meta)) return { tipo, bytes: new TextEncoder().encode(decodeURIComponent(s.slice(i + 1))) };
  const b64 = s.slice(i + 1).replace(/\s/g, '');
  if (typeof Uint8Array.fromBase64 === 'function') { try { return { tipo, bytes: Uint8Array.fromBase64(b64) }; } catch { } }
  const bin = atob(b64); const u = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u[k] = bin.charCodeAt(k); return { tipo, bytes: u };
}
async function hashDosBytes(bytes) {
  try { const b = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(b)].slice(0, 16).map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch {   // (no crypto.subtle: four independent 32-bit hashes)
    let a = 0x811c9dc5, b = 0x01000193, c = 0x9e3779b9, d = bytes.length;
    for (let i = 0; i < bytes.length; i++) { const x = bytes[i]; a = Math.imul(a ^ x, 16777619); b = Math.imul(b + x, 2246822519) ^ (b >>> 13); c = Math.imul(c ^ (x + i), 3266489917); d = (d * 31 + x) | 0; }
    return [a, b, c, d].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }
}
const extDoTipo = t => t === 'image/png' ? 'png' : t === 'image/jpeg' || t === 'image/jpg' ? 'jpg' : null;
/* a picture the game does not read (WebP, GIF, BMP, AVIF…) goes into the store as PNG */
async function emPng(blob) {
  const bmp = await createImageBitmap(blob); const cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  cv.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close();
  return cv.convertToBlob ? cv.convertToBlob({ type: 'image/png' }) : new Promise(ok => cv.toBlob(ok, 'image/png'));
}
/* the light copy (null: the original is small enough to show as it is) */
async function fazerImgLeve(blob) {
  try {
    const bmp = await createImageBitmap(blob); const lado = Math.max(bmp.width, bmp.height);
    if (lado <= IMG_LEVE_LADO && blob.size <= 160000) { bmp.close && bmp.close(); return null; }
    const esc = Math.min(1, IMG_LEVE_LADO / lado); const w = Math.max(1, Math.round(bmp.width * esc)), h = Math.max(1, Math.round(bmp.height * esc));
    let saida;
    if (typeof OffscreenCanvas === 'function') { const cv = new OffscreenCanvas(w, h); const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h); saida = await cv.convertToBlob({ type: 'image/webp', quality: 0.82 }); }
    else { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h); saida = await new Promise(ok => cv.toBlob(ok, 'image/webp', 0.82)); }
    bmp.close && bmp.close();
    return saida && saida.type === 'image/webp' && saida.size < blob.size ? saida : null;
  } catch { return null; }
}
/* a picture (a data: URL or a Blob) into the store: its reference (null: not a picture that can be read) */
async function guardarImagem(x) {
  let blob, tipo;
  if (x instanceof Blob) { blob = x; tipo = x.type; }
  else { const d = bytesDeDataUrl(x); tipo = d.tipo; blob = new Blob([d.bytes], { type: tipo }); }
  let ext = extDoTipo(tipo);
  if (!ext) { try { blob = await emPng(blob); ext = 'png'; } catch { return null; } }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const nome = (await hashDosBytes(bytes)) + '.' + ext;
  if (!(await Deposito.existem([nome])).has(nome)) await Deposito.gravar(nome, blob, await fazerImgLeve(blob));
  return 'imagens/' + nome;
}

/* ------------------------------------------------------------ the pictures of a work moved into the store */
/* (the weapons' layers, the forge and the media of a package keep their data: URLs: they are composed and read as data) */
const ARVORES_SEM_IMG = new Set(['armas', 'forja', 'moldes', 'camadas', 'midia', 'mapasOficiais']);
const CAMPOS_SEM_IMG = new Set(['glifo']);
const pedeImg = (k, v) => typeof v === 'string' && v.length >= IMG_MIN && v.charCodeAt(0) === 100 && v.startsWith('data:image/') && !v.startsWith('data:image/svg') && !CAMPOS_SEM_IMG.has(k);
const _refPorTexto = new Map();   // (this session) a data: URL already moved -> its reference; by a cheap fingerprint plus the length
const marcaDoTexto = v => { let h = 0; for (let i = 0; i < v.length; i += 97) h = (Math.imul(h, 31) + v.charCodeAt(i)) | 0; return v.length + ':' + h + ':' + v.slice(-64); };
/* the screen that says the pictures are being moved (shown only when there are some to move) */
function telaDeImagens(total) {
  let el = document.getElementById('telaLeves');
  if (!el) { el = document.createElement('div'); el.id = 'telaLeves'; el.innerHTML = '<div class="caixaLeves"><div class="giroLeves"></div><b></b><small></small><div class="barraLeves"><i></i></div></div>'; document.body.appendChild(el); }
  const titulo = () => tr('Loading: storing the pictures apart and making their light copies for the editor');
  el.querySelector('b').textContent = titulo();
  el.querySelector('small').textContent = tr('The game keeps the original pictures, in full resolution. This is done once for each picture.');
  const passo = n => { el.querySelector('.barraLeves i').style.width = Math.round(100 * n / Math.max(1, total)) + '%'; el.querySelector('b').textContent = titulo() + ' (' + n + '/' + total + ')'; };
  return { passo, fim: () => el.remove() };
}
/* every picture of x (in place) moved into the store; returns how many places changed. pular(o): a subtree left as it is */
async function extrairImagens(x, pular) {
  if (!x || typeof x !== 'object') return 0;
  const achados = [], vistos = new WeakSet();
  const anda = (o, prof) => { if (!o || typeof o !== 'object' || prof > 40 || o.cls === 'WeaponPartsModel' || vistos.has(o) || (pular && pular(o))) return; vistos.add(o);
    if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { const v = o[i]; if (typeof v === 'string') { if (pedeImg('', v)) achados.push([o, i, v]); } else if (v && typeof v === 'object') anda(v, prof + 1); } return; }
    for (const k in o) { const v = o[k]; if (typeof v === 'string') { if (pedeImg(k, v)) achados.push([o, k, v]); } else if (v && typeof v === 'object' && !ARVORES_SEM_IMG.has(k)) anda(v, prof + 1); } };
  anda(x, 0); if (!achados.length) return 0;
  const unicos = [...new Set(achados.map(a => a[2]))]; const ref = new Map();
  const novos = []; for (const u of unicos) { const r = _refPorTexto.get(marcaDoTexto(u)); if (r && Deposito.tem.has(nomeDaImg(r))) ref.set(u, r); else novos.push(u); }
  const tela = novos.length > 3 ? telaDeImagens(novos.length) : null; let n = 0;
  try {
    for (const u0 of novos) {
      let u = u0;
      // (a light copy of the v238 editor: its original, kept in the database, when there is one)
      if (typeof ehLeve === 'function' && ehLeve(u)) { const h = hashDaLeve(u); let o = _originais.get(h); if (!o) { try { o = await Config.lerBlob('orig:' + h); } catch { } } if (typeof o === 'string' && o.startsWith('data:image/')) u = o; }
      let r = null; try { r = await guardarImagem(u); } catch (e) { console.warn('picture not stored', e); }
      if (r) { ref.set(u0, r); _refPorTexto.set(marcaDoTexto(u0), r); }
      n++; if (tela && (n % 4 === 0 || n === novos.length)) { tela.passo(n); await new Promise(ok => setTimeout(ok, 0)); }
    }
  } finally { if (tela) tela.fim(); }
  let trocas = 0; achados.forEach(([o, k, v]) => { const r = ref.get(v); if (r) { o[k] = r; trocas++; } });
  return trocas;
}
/* the references in a text (a map, a campaign, a package written): the names of their files */
function imagensDoTexto(t) { const s = new Set(); if (typeof t !== 'string') return s; const re = /"imagens\/([0-9a-f]{32}\.(?:png|jpg|webp|gif))"/g; let m; while ((m = re.exec(t))) s.add(m[1]); return s; }
/* the references of an object (walked) */
function imagensDe(x) { const s = new Set(); const anda = (o, prof) => { if (!o || typeof o !== 'object' || prof > 40) return; for (const k in o) { const v = o[k]; if (typeof v === 'string') { if (ehImg(v)) s.add(nomeDaImg(v)); } else if (v && typeof v === 'object') anda(v, prof + 1); } }; anda(x, 0); return s; }
/* a file that goes alone (downloaded, or a package to share): its references back as data: URLs, read from the store */
async function textoAvulso(x, esp) {
  const nomes = [...imagensDe(x)]; const dados = new Map();
  for (const n of nomes) { try { const b = await Deposito.ler(n); if (b) dados.set('imagens/' + n, await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(b); })); } catch { } }
  return JSON.stringify(x, (k, v) => typeof v === 'string' && dados.has(v) ? (dados.get(v) || v).replace(/^data:application\/octet-stream/, 'data:image/' + (v.endsWith('.jpg') ? 'jpeg' : v.slice(-3))) : (typeof trocarOriginais === 'function' ? trocarOriginais(k, v) : v), esp);
}
/* the bytes of a reference (for a zip) */
async function bytesDaImg(ref) { const b = await Deposito.ler(nomeDaImg(ref)); return b ? new Uint8Array(await b.arrayBuffer()) : null; }
/* the pictures a file written into the export folder uses, copied beside it (its "imagens" folder), once per session; the
   names not in the store come back */
const _naPasta = new Set();
async function garantirImagens(sub, nomes) {
  const pasta = typeof Config !== 'undefined' ? Config.pastaAtual() : null; if (!pasta || !nomes) return [];
  const chave = n => (sub || '') + '/' + n;
  const lista = [...nomes].filter(n => !_naPasta.has(chave(n))); if (!lista.length) return [];
  let faltam = [];
  if (typeof PastaApp !== 'undefined' && pasta instanceof PastaApp) faltam = await Deposito.copiarPara(pasta.rel + (sub ? '/' + sub : '') + '/imagens', lista);
  else {
    const dir = sub ? await pasta.getDirectoryHandle(sub, { create: true }) : pasta; const im = await dir.getDirectoryHandle('imagens', { create: true });
    for (const n of lista) {
      try { await im.getFileHandle(n); continue; } catch { }
      const b = await Deposito.ler(n); if (!b) { faltam.push(n); continue; }
      const f = await im.getFileHandle(n, { create: true }); const w = await f.createWritable(); await w.write(b); await w.close();
    }
  }
  lista.forEach(n => { if (!faltam.includes(n)) _naPasta.add(chave(n)); });
  if (faltam.length) console.warn('pictures not in the store', faltam);
  return faltam;
}
/* the pictures of a work that are not in the store: looked for (the app: in the "imagens" folders of the data folder) and,
   if still missing, said once. Their light copies are made */
async function recolherImagens(x) {
  const nomes = [...imagensDe(x)]; if (!nomes.length) return [];
  const tem = await Deposito.existem(nomes); const falta = nomes.filter(n => !tem.has(n)); if (!falta.length) return [];
  const faltam = await Deposito.recolher(falta);
  if (Deposito.app) for (const n of falta.filter(n => !faltam.includes(n))) { try { const b = await Deposito.ler(n); const l = b && await fazerImgLeve(b); if (l) await Arquivos.gravar(Deposito.caminhoLeve(n.slice(0, 32)), l); } catch { } }
  if (faltam.length && typeof avisoLongo === 'function') avisoLongo(tr('Some pictures of this file were not found (they go in the “imagens” folder beside it)') + ': ' + faltam.length);
  return faltam;
}
/* (export) a file into the folder with its pictures beside it; downloaded alone, with its pictures inside */
async function exportarComImagens(nome, doc, sub) {
  let t = null; await extrairImagens(doc);   // (the game's own pictures the file carries, too: stored once, not inside every map)
  const r = await Config.exportar(nome, async onde => onde === 'pasta' ? (t = jsonOriginal(doc)) : textoAvulso(doc), sub);
  r.imagens = t ? imagensDoTexto(t) : new Set();
  if (r.onde === 'pasta' && t) { try { await garantirImagens(sub, r.imagens); } catch (e) { console.warn('pictures beside the file', e); } }
  return r;
}
/* the pictures that came in while working (an upload, a portrait baked, a package added): moved into the store a moment
   after a change. The entries of packages already looked at are not walked again */
const _entradasVistas = new WeakSet();
let _extracaoPedida = null, _extraindo = null;
function agendarExtracao() { if (_extracaoPedida) return; _extracaoPedida = setTimeout(() => { _extracaoPedida = null; extrairNovas(); }, 1200); }
function extrairNovas() {
  if (_extraindo) return _extraindo;
  _extraindo = (async () => {
    try {
      const b = typeof oficina === 'function' ? oficina() : null;
      // (an entry of a package whose pictures move now: its "as it came" is taken again after, or it would count as changed)
      const mudam = []; if (b) Object.entries(b).forEach(([k, l]) => { if (Array.isArray(l)) l.forEach(x => { if (x && x._doPacote && !_entradasVistas.has(x) && temImagemEmbutida(x)) mudam.push([k, x, typeof assinaturaDe === 'function' ? assinaturaDe(x) : null]); }); });
      const n = await extrairImagens([typeof campanha !== 'undefined' && campanha ? campanha : projeto, b], o => !!o._doPacote && _entradasVistas.has(o));
      if (b) Object.values(b).forEach(l => { if (Array.isArray(l)) l.forEach(x => { if (x && x._doPacote) _entradasVistas.add(x); }); });
      mudam.forEach(([k, x, antes]) => { const c = chaveDoOriginal(k, x); if (_comoVeio.get(c) === antes) _comoVeio.set(c, assinaturaDe(x)); });
      return n;
    } catch (e) { console.warn('pictures not moved', e); return 0; } finally { _extraindo = null; }
  })();
  return _extraindo;
}
/* the pictures of a zip of the community library (its "imagens" folder) into the store, by their names */
async function guardarImagensDoZip(es) {
  const l = (es || []).filter(e => /^imagens\/[0-9a-f]{32}\.(png|jpg|webp|gif)$/.test(e.nome)); if (!l.length) return 0;
  const tem = await Deposito.existem(l.map(e => e.nome.slice(8))); let n = 0;
  for (const e of l) { const nome = e.nome.slice(8); if (tem.has(nome)) continue;
    const tipo = nome.endsWith('.png') ? 'image/png' : nome.endsWith('.jpg') ? 'image/jpeg' : nome.endsWith('.webp') ? 'image/webp' : 'image/gif';
    const b = new Blob([e.dados], { type: tipo }); await Deposito.gravar(nome, b, await fazerImgLeve(b)); n++; }
  return n;
}
/* (an object with a picture still inside it, as a data: URL that goes into the store) */
function temImagemEmbutida(x) { let tem = false; const anda = (o, k, prof) => { if (tem || !o || prof > 30) return; if (typeof o === 'string') { if (pedeImg(k, o)) tem = true; return; } if (typeof o !== 'object' || o.cls === 'WeaponPartsModel') return; for (const c in o) { if (ARVORES_SEM_IMG.has(c)) continue; anda(o[c], c, prof + 1); } }; anda(x, '', 0); return tem; }
/* ------------------------------------------------------------ v240: pictures no longer used */
/* the "imagens" folder of a folder of the export folder (a campaign's): the files no file of it uses go away */
async function limparImagensDaPasta(sub, usados) {
  const pasta = typeof Config !== 'undefined' ? Config.pastaAtual() : null; if (!pasta || !sub) return 0;
  let n = 0;
  try {
    if (typeof PastaApp !== 'undefined' && pasta instanceof PastaApp) {
      const rel = pasta.rel + '/' + sub + '/imagens';
      for (const x of await Arquivos.lista(rel)) if (!x.pasta && IMG_RE.test('imagens/' + x.nome) && !usados.has(x.nome)) { await Arquivos.apagar(rel + '/' + x.nome); _naPasta.delete(sub + '/' + x.nome); n++; }
    } else {
      const dir = await pasta.getDirectoryHandle(sub); const im = await dir.getDirectoryHandle('imagens');
      const fora = []; for await (const [nome, h] of im.entries()) if (h.kind === 'file' && IMG_RE.test('imagens/' + nome) && !usados.has(nome)) fora.push(nome);
      for (const nome of fora) { await im.removeEntry(nome); _naPasta.delete(sub + '/' + nome); n++; }
    }
  } catch { }
  return n;
}
/* every reference the editor still needs: the work, the Workshop (with the packages), the quick save, the work kept, the
   packages of this browser */
async function imagensEmUso() {
  const usados = new Set(); const somar = x => imagensDe(x).forEach(n => usados.add(n)); const somarTexto = t => imagensDoTexto(t).forEach(n => usados.add(n));
  try { somar(typeof campanha !== 'undefined' && campanha ? campanha : projeto); } catch { }
  try { somar(oficina()); } catch { }
  for (const k of [typeof CHAVE_RAPIDA !== 'undefined' ? CHAVE_RAPIDA : null, typeof CHAVE_ESTADO !== 'undefined' ? CHAVE_ESTADO : null, typeof CHAVE_OFICINA !== 'undefined' ? CHAVE_OFICINA : null].filter(Boolean)) {
    try { const v = await lerDoBanco(k); if (typeof v === 'string') somarTexto(v); else if (v) somar(v); } catch { }
    try { const v = localStorage.getItem(k); if (v) somarTexto(v); } catch { } }
  if (!Deposito.app) { try { for (const k of await Config.chavesCom('pacote:')) { const v = await Config.lerBlob(k); if (v) somar(v); } } catch { } }
  return usados;
}
/* ⚙ → the pictures of the store no longer used: counted, and (asked) removed. A picture a map still uses stays in that map's
   "imagens" folder, and comes back to the store when the map is opened */
async function limparDeposito(perguntar = true) {
  const usados = await imagensEmUso(); const fora = [];
  if (Deposito.app) {
    for (const d of await Arquivos.lista('Bigorna/Imagens')) { if (!d.pasta || !/^[0-9a-f]{2}$/.test(d.nome)) continue;
      for (const x of await Arquivos.lista('Bigorna/Imagens/' + d.nome)) if (!x.pasta && IMG_RE.test('imagens/' + x.nome) && !usados.has(x.nome)) fora.push([x.nome, x.tam || 0]); }
  } else { await Deposito.listar(); for (const n of Deposito.tem) if (!usados.has(n)) fora.push([n, 0]); }
  if (!fora.length) { if (perguntar) aviso(tr('No picture of the store is unused.')); return 0; }
  const mb = fora.reduce((a, [, t]) => a + t, 0) / 1048576;
  if (perguntar && !confirm(tr('Pictures of the store no longer used by the work, the Workshop or the packages') + ': ' + fora.length + (mb ? ' (' + mb.toFixed(1) + ' MB)' : '') + '.\n\n' + tr('Remove them? A map that uses one keeps it in its own “imagens” folder.'))) return 0;
  for (const [n] of fora) {
    const h = n.slice(0, 32);
    try { if (Deposito.app) { await Arquivos.apagar(Deposito.caminho(n)); try { await Arquivos.apagar(Deposito.caminhoLeve(h)); } catch { } } else await Config.apagarVarios(['img:' + n, 'imgleve:' + h, 'imgsemleve:' + h]); } catch { }
    Deposito.tem.delete(n);
  }
  if (perguntar) aviso(tr('Pictures removed') + ': ' + fora.length + '.');
  return fora.length;
}
