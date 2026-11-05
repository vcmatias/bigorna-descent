/* v278: the bridge of the one-shot generator for Linux. There the game runs through Steam's Proton and the Bigorna Editor
   app (WebView2) does not open, so the generator page (Bigorna-Gerador.html?gerador=1&ponte=1&lingua=<code>, opened by the
   mod's Abrir-o-gerador.html in Chrome or Chromium) does the app's job: the player picks the game's Bigorna/Oneshot folder
   once (File System Access; the choice is kept in the browser), and the page watches it. A pedido-navegador.json becomes a map:
   the page takes it (removes it), runs the generator and writes resposta-navegador.json; every 2 s it writes
   gerador-navegador.json ({ estado, lingua, quando }), and the mod shows "connected" while that is fresh. A request in another
   language reloads the page in it (the request waits in the session). Names of its own: on Windows nobody writes them. */
const BigornaPonte = (() => {
  if (typeof location === 'undefined' || !/[?&]ponte=1(&|$)/.test(location.search || '')) return null;
  const PT = /^pt/.test(LINGUA_TEXTOS) || (LINGUA_TEXTOS !== 'en' && /^pt/i.test(navigator.language || ''));
  const L = (pt, en) => PT ? pt : en;
  const BD = 'bigorna-ponte', LOJA = 'pastas', PEDIDO = 'pedido-navegador.json', RESPOSTA = 'resposta-navegador.json', ESTADO = 'gerador-navegador.json', ESPERA = 'bigorna-ponte-pedido';
  let pasta = null, ocupado = false, estado = 'esperando', feitos = 0, ultimoPulso = 0;
  const abrir = () => new Promise((ok, erro) => { const r = indexedDB.open(BD, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
  async function guardar(h) { try { const b = await abrir(); await new Promise(ok => { const t = b.transaction(LOJA, 'readwrite'); t.objectStore(LOJA).put(h, 'oneshot'); t.oncomplete = ok; t.onerror = ok; }); } catch { } }
  async function lembrada() { try { const b = await abrir(); return await new Promise(ok => { const t = b.transaction(LOJA, 'readonly').objectStore(LOJA).get('oneshot'); t.onsuccess = () => ok(t.result || null); t.onerror = () => ok(null); }); } catch { return null; } }

  // the screen: one card, the game's dark colours
  const tela = document.createElement('div'); tela.id = 'ponte';
  tela.innerHTML = `<style>
    html,body{margin:0;background:#12151b;color:#e8e2d4;font:16px/1.55 system-ui,sans-serif}
    #ponte{max-width:640px;margin:8vh auto;padding:28px 30px;background:#1b1f27;border:1px solid #3a3326;border-radius:14px;box-shadow:0 10px 40px #0008}
    #ponte h1{margin:0 0 6px;font-size:22px;color:#e0a458}#ponte p{margin:8px 0;color:#bdb6a6}
    #ponte button{margin:12px 8px 0 0;padding:10px 18px;border-radius:9px;border:1px solid #6b5530;background:#e0a458;color:#1b1206;font-weight:600;cursor:pointer}
    #ponte button.sec{background:none;color:#e0a458}#ponte .estado{margin-top:16px;padding:10px 14px;border-radius:9px;background:#12151b;color:#cfc7b5}
    #ponte code{background:#12151b;padding:1px 6px;border-radius:5px;word-break:break-all}#ponte .ok{color:#a8e6a1}#ponte .erro{color:#ff9a7a}</style>
    <h1>Bigorna · ${L('gerador do mapa oneshot', 'one-shot map generator')}</h1>
    <p>${L('Deixe esta aba aberta enquanto joga: o jogo pede o mapa, e esta página o faz.', 'Keep this tab open while you play: the game asks for the map, and this page makes it.')}</p>
    <p>${L('Escolha a pasta <code>Bigorna/Oneshot</code> dos dados do jogo (o caminho aparece no quadro do mapa oneshot, no jogo).', 'Choose the game data folder <code>Bigorna/Oneshot</code> (the path is shown in the one-shot map window, in the game).')}</p>
    <div id="pBotoes"><button id="pEscolher">${L('Escolher a pasta', 'Choose the folder')}</button></div>
    <div class="estado" id="pEstado">${L('Carregando o gerador…', 'Loading the generator…')}</div>`;
  document.body.appendChild(tela);
  const $e = id => document.getElementById(id);
  const mostrar = (t, cls) => { const e = $e('pEstado'); e.className = 'estado ' + (cls || ''); e.innerHTML = t; };
  if (typeof window.showDirectoryPicker !== 'function') {
    mostrar(L('Este navegador não grava em pastas. Abra esta página no Chrome ou no Chromium (o Firefox não serve).', 'This browser cannot write to folders. Open this page in Chrome or Chromium (Firefox will not do).'), 'erro');
    $e('pBotoes').hidden = true;
  }

  async function ler(n) { try { const f = await pasta.getFileHandle(n); return await (await f.getFile()).text(); } catch { return null; } }
  async function gravar(n, t) { const f = await pasta.getFileHandle(n, { create: true }); const w = await f.createWritable(); await w.write(t); await w.close(); }
  /* the answer appears at once: written under another name and renamed when the browser can (the mod also waits for a
     whole, readable answer: getFileHandle makes an empty file before the writing ends) */
  async function gravarDeUmaVez(n, t) {
    const tmp = n + '.tmp'; await gravar(tmp, t);
    try { const f = await pasta.getFileHandle(tmp); if (typeof f.move === 'function') { await tirar(n); await f.move(n); return; } } catch { }
    await gravar(n, t); await tirar(tmp);
  }
  async function tirar(n) { try { await pasta.removeEntry(n); } catch { } }
  async function pulso() { if (!pasta || Date.now() - ultimoPulso < 2000) return; ultimoPulso = Date.now(); try { await gravar(ESTADO, JSON.stringify({ estado, lingua: LINGUA_TEXTOS, quando: Date.now(), feitos })); } catch (e) { mostrar(L('Não consegui gravar na pasta: ', 'Could not write to the folder: ') + e.message, 'erro'); } }

  async function rodar(texto) {
    let p; try { p = JSON.parse(texto); } catch { return; }
    if (p.lingua && p.lingua !== LINGUA_TEXTOS) {
      // (another language: the page reloads in it; the request waits in the session)
      try { sessionStorage.setItem(ESPERA, texto); } catch { }
      location.replace(location.pathname + '?gerador=1&ponte=1&lingua=' + encodeURIComponent(p.lingua)); return;
    }
    ocupado = true; estado = 'gerando'; ultimoPulso = 0; await pulso();
    mostrar(L('Gerando o mapa…', 'Generating the map…'));
    const t0 = performance.now(); let r;
    try { r = await BigornaGerador.rodar(p); } catch (e) { r = { erro: String(e && e.message || e) }; }
    try { await gravarDeUmaVez(RESPOSTA, JSON.stringify(r)); } catch (e) { mostrar(L('Não consegui gravar a resposta: ', 'Could not write the answer: ') + e.message, 'erro'); }
    feitos++; ocupado = false; estado = 'pronto'; ultimoPulso = 0; await pulso();
    mostrar(r.erro ? L('O gerador não conseguiu: ', 'The generator could not: ') + r.erro : L('Mapa feito: ', 'Map made: ') + '<b>' + (r.nome || '') + '</b> (' + (r.semente || '') + ', ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s). ' + L('Pode voltar ao jogo.', 'You can go back to the game.'), r.erro ? 'erro' : 'ok');
  }

  async function vigiar() {
    if (!pasta) return;
    try {
      await pulso();
      if (!ocupado) {
        let t = null; try { t = sessionStorage.getItem(ESPERA); if (t) sessionStorage.removeItem(ESPERA); } catch { }
        if (!t) { t = await ler(PEDIDO); if (t) await tirar(PEDIDO); }
        if (t) await rodar(t);
      }
    } catch (e) { console.error(e); }
    setTimeout(vigiar, 500);
  }

  async function usarPasta(h) {
    pasta = h; await guardar(h);
    estado = 'pronto'; ultimoPulso = 0;
    $e('pBotoes').innerHTML = `<button class="sec" id="pTrocar">${L('Trocar de pasta', 'Change folder')}</button>`; $e('pTrocar').onclick = escolher;
    mostrar('<span class="ok">' + L('Pronto, vigiando a pasta ', 'Ready, watching the folder ') + '<code>' + h.name + '</code>.</span> ' + L('No jogo, toquem em Gerar.', 'In the game, tap Generate.'));
    vigiar();
  }
  async function escolher() {
    try {
      const h = await window.showDirectoryPicker({ id: 'bigorna-oneshot', mode: 'readwrite' });
      if (!/oneshot/i.test(h.name) && !confirm(L('Esta pasta não se chama «Oneshot». Usar assim mesmo?', 'This folder is not called “Oneshot”. Use it anyway?'))) return;
      await usarPasta(h);
    } catch (e) { if (e && e.name !== 'AbortError') mostrar(String(e.message || e), 'erro'); }
  }
  $e('pEscolher') && ($e('pEscolher').onclick = escolher);

  async function iniciar() {
    while (!(window.BigornaGerador && BigornaGerador.pronto())) await new Promise(r => setTimeout(r, 200));
    mostrar(L('O gerador está pronto. Escolha a pasta.', 'The generator is ready. Choose the folder.'));
    const h = await lembrada(); if (!h || typeof h.queryPermission !== 'function') return;
    if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return usarPasta(h);
    // (the browser asks again after a restart: one click on the same folder)
    $e('pBotoes').insertAdjacentHTML('afterbegin', `<button id="pContinuar">${L('Continuar com a pasta ', 'Continue with the folder ')}${h.name}</button>`);
    $e('pContinuar').onclick = async () => { if (await h.requestPermission({ mode: 'readwrite' }) === 'granted') usarPasta(h); };
  }
  iniciar();
  return { usarPasta, get estado() { return estado; }, get feitos() { return feitos; } };
})();
if (typeof window !== 'undefined') window.BigornaPonte = BigornaPonte;
