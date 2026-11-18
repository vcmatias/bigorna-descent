/* Bigorna Rooms: loader. The editor's code waits in a text block until the game data is in hand:
   1. the files the Bigorna mod writes next to the editor (bigorna-game-data.js, bigorna-worldmap.js), loaded by the
      script tags before this one; a copy is kept in the browser, so a copy of the editor opened from another
      folder still works;
   2. otherwise, that copy kept in the browser;
   3. otherwise, a screen that explains where the files come from and lets the user pick them.
   The editor stays locked until it has both the game data and the world map picture of at least one act. */
(function () {
  'use strict';
  const BD = 'bigorna-jogo', LOJA = 'dados';
  const abrir = () => new Promise((ok, erro) => { const r = indexedDB.open(BD, 1); r.onupgradeneeded = () => r.result.createObjectStore(LOJA); r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
  async function ler(k) {
    try { const b = await abrir(); return await new Promise(ok => { const t = b.transaction(LOJA, 'readonly').objectStore(LOJA).get(k); t.onsuccess = () => ok(t.result); t.onerror = () => ok(undefined); }); }
    catch (e) { return undefined; }
  }
  async function gravar(k, v) {
    try { const b = await abrir(); await new Promise(ok => { const t = b.transaction(LOJA, 'readwrite'); t.objectStore(LOJA).put(v, k); t.oncomplete = ok; t.onerror = ok; t.onabort = ok; }); }
    catch (e) { /* no browser storage: the files next to the editor are still read every time */ }
  }
  const selo = j => j ? [j.formato, j.jogo, j.gerado].join('|') : '';

  /* the loading screen (the editor's layout with no text): the editor takes it away when ready; the screen that asks for
     the game files, or a stuck start, too */
  const tirarEsqueleto = () => { const e = document.getElementById('esqueleto'); if (e) e.remove(); };
  function iniciar(jogo, mapa) {
    setTimeout(tirarEsqueleto, 15000);
    window.BIGORNA_JOGO = jogo;
    window.BIGORNA_MAPA = mapa || {};
    const tela = document.getElementById('semDados'); if (tela) tela.remove();
    // (v259: the mod's one-shot generator in a language other than pt and en: its table of texts, next to the editor, first)
    // (v373, v374: the editor in Spanish, French, German or Italian writes its maps in that language, by the same tables)
    const ling = /[?&]gerador=1(&|$)/.test(location.search || '') ? (/[?&]lingua=([a-z]{2}(?:-[a-z]{2})?)(&|$)/.exec(location.search || '') || [])[1] : (l => l !== 'pt' && l !== 'en' ? l : null)(linguaDoEditor(jogo));
    if (ling && ling !== 'pt' && ling !== 'en' && ling !== 'qq' && !(window.GERADOR_TRAD && window.GERADOR_TRAD[ling])) {
      const t = document.createElement('script'); t.src = 'bigorna-gerador-' + ling + '.js';
      t.onload = t.onerror = () => rodarApp(); document.head.appendChild(t); return;
    }
    rodarApp();
  }
  function rodarApp() {
    const s = document.createElement('script');
    const fonte = document.getElementById('bigorna-app');
    s.textContent = fonte.textContent;
    document.body.appendChild(s);
    // (v237: the app's text kept once: the copy it came in, 4 MB, leaves the page)
    fonte.remove();
  }

  /* the text of one of the mod's files: "window.BIGORNA_JOGO = {...};" or "window.BIGORNA_MAPA = {...};" */
  function interpretar(texto) {
    const qual = /BIGORNA_MAPA/.test(texto.slice(0, 600)) ? 'mapa' : /BIGORNA_JOGO/.test(texto.slice(0, 600)) ? 'jogo' : null;
    const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
    if (!qual || a < 0 || b < a) throw new Error('this is not a Bigorna data file');
    return { qual, dados: JSON.parse(texto.slice(a, b + 1)) };
  }

  /* the editor opens once both are in hand: the game data (the mod writes it on the title screen) and the world map
     picture of at least one act (the mod takes it when a campaign reaches the world map) */
  const temMapa = m => !!m && Object.keys(m).some(k => /^act\d+$/.test(k) && m[k]);

  /* the language of the editor, as idioma.js decides it (that file runs later, with the app) */
  function linguaDoEditor(jogo) {
    try { const m = /[?&]lingua=([a-z]{2}(?:-[a-z]{2})?)(&|$)/.exec(location.search || ''); if (m) return m[1]; } catch { }
    const LS = ['pt', 'en', 'es', 'fr', 'de', 'it', 'pl', 'hu', 'cs', 'ru', 'ko', 'zh-cn', 'zh-tw'];
    try { const v = localStorage.getItem('bigorna-idioma'); if (LS.includes(v)) return v; } catch { }
    if (LS.includes(window.BIGORNA_IDIOMA)) return window.BIGORNA_IDIOMA;
    const l0 = ((jogo && jogo.lang) || navigator.language || '').trim().toLowerCase().replace('_', '-'); const l = l0.startsWith('zh') ? (/tw|hk|hant/.test(l0) ? 'zh-tw' : 'zh-cn') : l0.slice(0, 2); return LS.includes(l) ? l : 'en';
  }

  const PASTA = '%USERPROFILE%\\AppData\\LocalLow\\Fantasy Flight Games\\Descent - Legends of the Dark\\Editor';

  function telaBloqueio(jogo, mapa) {
    const ling = linguaDoEditor(jogo), pt = ling === 'pt';   // (v373: in Spanish too)
    const L = (a, b, c) => pt ? a : ling === 'es' && c ? c : b;
    tirarEsqueleto();
    const d = document.createElement('div');
    d.id = 'semDados';
    const passo = (feito, titulo, texto) => `<li class="${feito ? 'feito' : ''}"><span class="marca">${feito ? '\u2713' : '\u2022'}</span>
        <div><b>${titulo}</b><br>${texto}</div></li>`;
    function desenhar() {
      d.innerHTML = `<div class="semDadosCaixa">
      <h1>${L('O Bigorna Rooms está quase pronto', 'Bigorna Rooms is almost ready', 'Bigorna Rooms está casi listo')}</h1>
      <p>${L('O editor vem sem nada do jogo. As peças, monstros, itens, textos, imagens e o mapa-múndi saem da <b>sua cópia</b> de <i>Descent: Legends of the Dark</i>, lidos pelo mod Bigorna. Ele fica liberado depois destas duas etapas:',
             'The editor ships without anything from the game. Its tiles, monsters, items, texts, pictures and world map come from <b>your own copy</b> of <i>Descent: Legends of the Dark</i>, read by the Bigorna mod. It unlocks after these two steps:',
             'El editor viene sin nada del juego. Sus losetas, monstruos, ítems, textos, imágenes y mapa del mundo salen de <b>tu propia copia</b> de <i>Descent: Leyendas de las Tinieblas</i>, leídos por el mod Bigorna. Se desbloquea después de estos dos pasos:')}</p>
      <ol class="passos">
        ${passo(!!jogo, L('Abra o jogo com o mod instalado', 'Start the game with the mod installed', 'Abre el juego con el mod instalado'),
          L('Na tela de título, o mod lê a sua cópia do jogo e grava os dados ao lado deste editor. Um aviso no canto mostra o andamento (leva alguns minutos na primeira vez).',
            'On the title screen, the mod reads your copy of the game and writes the data next to this editor. A notice in the corner shows the progress (a few minutes the first time).',
            'En la pantalla de título, el mod lee tu copia del juego y escribe los datos junto a este editor. Un aviso en la esquina muestra el progreso (unos minutos la primera vez).'))}
        ${passo(temMapa(mapa), L('Abra uma campanha até o mapa-múndi', 'Open a campaign up to the world map', 'Abre una campaña hasta el mapa del mundo'),
          L('Comece ou continue uma campanha do jogo e espere o mapa-múndi aparecer: o mod fotografa o mapa para o editor. Qualquer ato serve; o outro entra quando você chegar a ele.',
            'Start or continue a campaign of the game and wait for the world map to show: the mod pictures it for the editor. Any act will do; the other one comes in when you get to it.',
            'Empieza o continúa una campaña del juego y espera a que aparezca el mapa del mundo: el mod lo fotografía para el editor. Sirve cualquier acto; el otro entra cuando llegues a él.'))}
      </ol>
      <p><button type="button" class="semDadosDeNovo">${L('Verificar de novo', 'Check again', 'Comprobar de nuevo')}</button></p>
      <p class="semDadosNota">${L('Depois, abra o editor pelo atalho <b>Bigorna Rooms</b> ou pelo botão «Abrir editor» no painel «Mapas da comunidade» da tela de título. Os arquivos ficam em',
        'Then open the editor from the <b>Bigorna Rooms</b> shortcut or from the “Open editor” button in the “Community maps” panel on the title screen. The files live in',
        'Luego abre el editor desde el acceso directo <b>Bigorna Rooms</b> o desde el botón “Abrir editor” del panel “Mapas de la comunidad” de la pantalla de título. Los archivos están en')} <code>${PASTA}</code>.</p>
      <details class="semDadosOutra"><summary>${L('Abriu uma cópia do editor de outra pasta? Escolha os arquivos', 'Opened a copy of the editor from another folder? Pick the files', '¿Abriste una copia del editor desde otra carpeta? Elige los archivos')}</summary>
        <label class="semDadosEscolha">${L('Escolha bigorna-game-data.js e bigorna-worldmap.js, da pasta acima', 'Choose bigorna-game-data.js and bigorna-worldmap.js, from the folder above', 'Elige bigorna-game-data.js y bigorna-worldmap.js, de la carpeta de arriba')}
          <input type="file" accept=".js,.json" multiple></label>
      </details>
      <p class="semDadosErro" hidden></p>
    </div>`;
      d.querySelector('.semDadosDeNovo').onclick = () => location.reload();
      const erro = d.querySelector('.semDadosErro');
      d.querySelector('input').onchange = async e => {
        try {
          for (const f of e.target.files) {
            const r = interpretar(await f.text());
            if (r.qual === 'jogo') { jogo = r.dados; await gravar('jogo', jogo); await gravar('selo', selo(jogo)); }
            else { mapa = r.dados; await gravar('mapa', mapa); }
          }
          if (jogo && temMapa(mapa)) { iniciar(jogo, mapa); return; }
          desenhar();
          const e2 = d.querySelector('.semDadosErro'); e2.hidden = false;
          e2.textContent = !jogo ? L('Falta bigorna-game-data.js.', 'bigorna-game-data.js is still missing.', 'Aún falta bigorna-game-data.js.')
                                 : L('Falta o mapa-múndi: abra uma campanha até o mapa no jogo.', 'The world map is still missing: open a campaign up to the map in the game.', 'Aún falta el mapa del mundo: abre una campaña hasta el mapa en el juego.');
        } catch (ex) { erro.hidden = false; erro.textContent = L('Não consegui ler: ', 'Could not read it: ', 'No se pudo leer: ') + ex.message; }
      };
    }
    desenhar();
    document.body.appendChild(d);
  }

  async function comecar() {
    let jogo = window.BIGORNA_JOGO, mapa = window.BIGORNA_MAPA;
    if (window.BIGORNA_EMBUTIDO) { iniciar(jogo, mapa); return; }
    if (jogo) {
      if (await ler('selo') !== selo(jogo)) { await gravar('jogo', jogo); await gravar('selo', selo(jogo)); }
    } else jogo = await ler('jogo');
    if (temMapa(mapa)) gravar('mapa', mapa); else { const guardado = await ler('mapa'); if (temMapa(guardado)) mapa = guardado; }
    if (jogo && temMapa(mapa)) iniciar(jogo, mapa); else telaBloqueio(jogo, mapa);
  }
  comecar();
})();
