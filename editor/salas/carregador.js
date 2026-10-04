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

  function iniciar(jogo, mapa) {
    window.BIGORNA_JOGO = jogo;
    window.BIGORNA_MAPA = mapa || {};
    const tela = document.getElementById('semDados'); if (tela) tela.remove();
    const s = document.createElement('script');
    s.textContent = document.getElementById('bigorna-app').textContent;
    document.body.appendChild(s);
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

  function emPortugues(jogo) {
    try { const v = localStorage.getItem('bigorna-idioma'); if (v === 'pt') return true; if (v === 'en') return false; } catch { }
    const l = (jogo && jogo.lang) || navigator.language || '';
    return /^pt/i.test(l);
  }

  const PASTA = '%USERPROFILE%\\AppData\\LocalLow\\Fantasy Flight Games\\Descent - Legends of the Dark\\Editor';

  function telaBloqueio(jogo, mapa) {
    const pt = emPortugues(jogo);
    const L = (a, b) => pt ? a : b;
    const d = document.createElement('div');
    d.id = 'semDados';
    const passo = (feito, titulo, texto) => `<li class="${feito ? 'feito' : ''}"><span class="marca">${feito ? '\u2713' : '\u2022'}</span>
        <div><b>${titulo}</b><br>${texto}</div></li>`;
    function desenhar() {
      d.innerHTML = `<div class="semDadosCaixa">
      <h1>${L('O Bigorna Rooms está quase pronto', 'Bigorna Rooms is almost ready')}</h1>
      <p>${L('O editor vem sem nada do jogo. As peças, monstros, itens, textos, imagens e o mapa-múndi saem da <b>sua cópia</b> de <i>Descent: Legends of the Dark</i>, lidos pelo mod Bigorna. Ele fica liberado depois destas duas etapas:',
             'The editor ships without anything from the game. Its tiles, monsters, items, texts, pictures and world map come from <b>your own copy</b> of <i>Descent: Legends of the Dark</i>, read by the Bigorna mod. It unlocks after these two steps:')}</p>
      <ol class="passos">
        ${passo(!!jogo, L('Abra o jogo com o mod instalado', 'Start the game with the mod installed'),
          L('Na tela de título, o mod lê a sua cópia do jogo e grava os dados ao lado deste editor. Um aviso no canto mostra o andamento (leva alguns minutos na primeira vez).',
            'On the title screen, the mod reads your copy of the game and writes the data next to this editor. A notice in the corner shows the progress (a few minutes the first time).'))}
        ${passo(temMapa(mapa), L('Abra uma campanha até o mapa-múndi', 'Open a campaign up to the world map'),
          L('Comece ou continue uma campanha do jogo e espere o mapa-múndi aparecer: o mod fotografa o mapa para o editor. Qualquer ato serve; o outro entra quando você chegar a ele.',
            'Start or continue a campaign of the game and wait for the world map to show: the mod pictures it for the editor. Any act will do; the other one comes in when you get to it.'))}
      </ol>
      <p><button type="button" class="semDadosDeNovo">${L('Verificar de novo', 'Check again')}</button></p>
      <p class="semDadosNota">${L('Depois, abra o editor pelo atalho <b>Bigorna Rooms</b> ou pelo botão «Abrir editor» no painel «Mapas da comunidade» da tela de título. Os arquivos ficam em',
        'Then open the editor from the <b>Bigorna Rooms</b> shortcut or from the «Abrir editor» button in the «Mapas da comunidade» panel on the title screen. The files live in')} <code>${PASTA}</code>.</p>
      <details class="semDadosOutra"><summary>${L('Abriu uma cópia do editor de outra pasta? Escolha os arquivos', 'Opened a copy of the editor from another folder? Pick the files')}</summary>
        <label class="semDadosEscolha">${L('Escolha bigorna-game-data.js e bigorna-worldmap.js, da pasta acima', 'Choose bigorna-game-data.js and bigorna-worldmap.js, from the folder above')}
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
          e2.textContent = !jogo ? L('Falta bigorna-game-data.js.', 'bigorna-game-data.js is still missing.')
                                 : L('Falta o mapa-múndi: abra uma campanha até o mapa no jogo.', 'The world map is still missing: open a campaign up to the map in the game.');
        } catch (ex) { erro.hidden = false; erro.textContent = L('Não consegui ler: ', 'Could not read it: ') + ex.message; }
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
