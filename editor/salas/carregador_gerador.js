/* v274: the loader of the one-shot generator page (Bigorna-Gerador.html): only the generator, with no editor screen.
   The mod's game data comes from bigorna-gerador-dados.js (the game data without the pictures, which the generator does
   not use; the mod writes it next to bigorna-game-data.js), or from bigorna-game-data.js when the light one is missing.
   Then the table of texts of the game's language (bigorna-gerador-<code>.js) and the code. The editor's code reads a few
   screen elements when it loads; here they are loose elements that nobody sees. */
(function () {
  'use strict';
  const busca = location.search || '';
  const ling = (/[?&]lingua=([a-z]{2}(?:-[a-z]{2})?)(&|$)/.exec(busca) || [])[1];
  const soltos = {};
  const qs = Document.prototype.querySelector, porId = Document.prototype.getElementById;
  const solto = s => soltos[s] || (soltos[s] = document.createElement(/^#(tela|canvas)/.test(s) ? 'canvas' : /^#(m_|i_|in_)|input/.test(s) ? 'input' : 'div'));
  Document.prototype.querySelector = function (s) { const e = qs.call(this, s); return e || (typeof s === 'string' && /^#[\w-]+$/.test(s) ? solto(s) : null); };
  Document.prototype.getElementById = function (id) { return porId.call(this, id) || solto('#' + id); };
  window.BIGORNA_SO_GERADOR = true;
  function carregar(src, depois) { const t = document.createElement('script'); t.src = src; t.onload = () => depois(true); t.onerror = () => depois(false); document.head.appendChild(t); }
  function dados(depois) {
    if (window.BIGORNA_JOGO) return depois();
    carregar('bigorna-gerador-dados.js', ok => { if (ok && window.BIGORNA_JOGO) return depois(); carregar('bigorna-game-data.js', () => depois()); });
  }
  function tabela(depois) {
    if (!ling || ling === 'pt' || ling === 'en' || ling === 'qq' || (window.GERADOR_TRAD && window.GERADOR_TRAD[ling])) return depois();
    carregar('bigorna-gerador-' + ling + '.js', () => depois());
  }
  function rodar() {
    if (!window.BIGORNA_JOGO) { window.BIGORNA_GERADOR_ERRO = 'no game data next to the generator (bigorna-gerador-dados.js or bigorna-game-data.js)'; return; }
    window.BIGORNA_MAPA = window.BIGORNA_MAPA || {};
    const fonte = document.getElementById('bigorna-app');
    const s = document.createElement('script'); s.textContent = fonte.textContent; document.body.appendChild(s); fonte.remove();
  }
  dados(() => tabela(rodar));
})();
