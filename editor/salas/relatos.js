/* Bigorna Rooms: "Report a problem" (F9), the same as the mod's in the game (mod/src/Menu/Relatos.cs). The user writes what
   happened; the editor packs a .zip with the text (relato.txt), the editor's log of errors and warnings since the page opened
   (registro.txt), the log of what was done (acoes.txt: v299) and, when the box is ticked, the work on screen (its .bmap or .bcamp and the editor's own copy of it,
   trabalho.json, pictures left out). Nothing leaves the computer without the click on "Send": then the package goes to the
   same receiver as the mod's reports (tools/relatos/Codigo.gs), which e-mails it to the author. When sending fails, the package
   is saved as a file for the user to send another way. (Quick load moved from F9 to F8.) */
const RELATO_ENDERECO = 'https://script.google.com/macros/s/AKfycby6N5KRsKBRRasQl2okyDMFkdgRRvRUG76AB1WKJF-CaNiHI3BDjAsmh07BTOIuxwA/exec';
const RELATO_CHAVE = 'bigorna-relato-1';          // the same as the mod's (Relatos.Chave) and the receiver's
const RELATO_LIMITE = 6 * 1024 * 1024;            // the same as the mod's (Relatos.LimiteDoPacote)
const RELATO_ISSUES = 'https://github.com/vcmatias/bigorna-descent/issues';

/* the log of the editor: errors and warnings of the console, and what nothing caught, from the opening of the page */
const REGISTRO_DO_EDITOR = [];
(() => {
  const texto = a => { if (a instanceof Error) return a.stack || String(a); if (typeof a === 'string') return a; try { return JSON.stringify(a); } catch { return String(a); } };
  const guardar = (tipo, args) => { try { REGISTRO_DO_EDITOR.push((new Date().toISOString().slice(11, 19) + ' ' + tipo + ' ' + [...args].map(texto).join(' ')).slice(0, 4000)); if (REGISTRO_DO_EDITOR.length > 300) REGISTRO_DO_EDITOR.shift(); } catch { } };
  for (const k of ['error', 'warn']) { const original = console[k]; console[k] = function (...a) { guardar(k, a); return original.apply(this, a); }; }
  window.addEventListener('error', e => guardar('uncaught', [e.error || (e.message + ' @ ' + e.filename + ':' + e.lineno)]));
  window.addEventListener('unhandledrejection', e => guardar('unhandled', [e.reason]));
})();

/* v299: the log of what was done in the editor, from the same pictures Ctrl+Z keeps (Historico, interface.js): each change of
   the work gets a line with the hour, the gesture that made it (the button, field or key: never what was typed) and the parts
   of the work that changed (salas[2].objetos, meta.name...); undo and redo too. It goes in the report as acoes.txt. */
const REGISTRO_DE_ACOES = [];
let _gestoDoRelato = '';
function anotarAcao(t) { try { REGISTRO_DE_ACOES.push(new Date().toISOString().slice(11, 19) + ' ' + String(t).slice(0, 600)); if (REGISTRO_DE_ACOES.length > 400) REGISTRO_DE_ACOES.shift(); } catch { } }
(() => {
  const curto = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const descrever = el => {
    if (!el || el.nodeType !== 1) return '';
    const alvo = el.closest('button, a, select, input, textarea, label, summary, [data-aba], [data-i], [data-o], [data-sala], canvas, [id]') || el;
    const tag = alvo.tagName.toLowerCase(), id = alvo.id ? '#' + alvo.id : '';
    const dados = Object.keys(alvo.dataset || {}).slice(0, 3).map(k => k + '=' + curto(alvo.dataset[k])).join(',');
    // (a field: its label, never the value)
    const rotulo = /^(input|textarea|select)$/.test(tag) ? curto(alvo.closest('label')?.childNodes[0]?.textContent || alvo.placeholder || alvo.name) : tag === 'canvas' ? '' : curto(alvo.innerText || alvo.title || alvo.getAttribute('aria-label'));
    return tag + id + (dados ? '[' + dados + ']' : '') + (rotulo ? ' “' + rotulo + '”' : '') + (tag === 'select' && alvo.selectedOptions && alvo.selectedOptions[0] ? ' = ' + curto(alvo.selectedOptions[0].text) : '');
  };
  document.addEventListener('pointerdown', e => { _gestoDoRelato = 'click ' + descrever(e.target); }, true);
  document.addEventListener('change', e => { _gestoDoRelato = 'change ' + descrever(e.target); }, true);
  document.addEventListener('input', e => { _gestoDoRelato = 'typing in ' + descrever(e.target); }, true);
  document.addEventListener('keydown', e => { if (e.key.length > 1 || e.ctrlKey || e.metaKey || e.altKey) { const el = document.activeElement; _gestoDoRelato = 'key ' + (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey && e.key.length > 1 ? 'Shift+' : '') + e.key + (el && el !== document.body ? ' in ' + descrever(el) : ''); } }, true);
})();
/* the parts of the work that changed between two pictures (at most 8 paths, 6 levels down) */
function partesMudadas(a, b) {
  const saida = [];
  const ir = (x, y, cam, prof) => {
    if (saida.length >= 8 || x === y) return;
    if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null || prof >= 6) { if (JSON.stringify(x) !== JSON.stringify(y)) saida.push(cam || '(all)'); return; }
    if (Array.isArray(x) && Array.isArray(y) && x.length !== y.length) { saida.push(cam + ': ' + x.length + ' → ' + y.length); return; }
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) { if (saida.length >= 8) break; ir(x[k], y[k], Array.isArray(x) ? cam + '[' + k + ']' : (cam ? cam + '.' : '') + k, prof + 1); }
  };
  ir(a, b, '', 0); return saida;
}
function anotarMudanca(antes, depois) {
  const gesto = _gestoDoRelato || '(no gesture)'; _gestoDoRelato = '';
  setTimeout(() => {
    let partes = [];
    try { partes = antes && antes.length + depois.length < 6e6 ? partesMudadas(JSON.parse(antes), JSON.parse(depois)) : [antes ? 'the work (too big to compare)' : 'the work as it opened']; } catch { partes = ['?']; }
    anotarAcao(gesto + ' → ' + (partes.join(' · ') || 'no visible part'));
  }, 0);
}

/* an anonymous code of this browser (drawn the first time, with no data of the person): the receiver limits the reports
   per person per day, as it does with the mod's code */
function pessoaDoRelato() {
  try { let c = localStorage.getItem('bigorna-relato-pessoa'); if (!c || c.length < 8) { c = 'ed' + [...crypto.getRandomValues(new Uint8Array(5))].map(b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('bigorna-relato-pessoa', c); } return c; }
  catch { return 'sem-codigo'; }
}

/* the package: [{nome, dados}] and the name of the work's file (or '') */
function arquivosDoRelato(texto, contato, comObra) {
  const enc = new TextEncoder(); const arqs = []; let obra = '';
  const registro = [...REGISTRO_DO_EDITOR];
  if (comObra) {
    try { arqs.push({ nome: 'trabalho.json', dados: enc.encode(textoComAssets(estadoAtualSemQuando(), true).txt) }); }
    catch (e) { registro.push('report: the work on screen could not be copied: ' + (e && e.stack || e)); }
    try {
      const c = !!campanha; const nome = slug((c ? campanha.meta.name : projeto.meta.name) || (c ? 'campaign' : 'map')) + (c ? '.bcamp' : '.bmap');
      arqs.push({ nome, dados: enc.encode(JSON.stringify(c ? montarDcamp() : montarDmap())) }); obra = nome;
    } catch (e) { registro.push('report: the export of the work failed: ' + (e && e.stack || e)); }
  }
  const jogo = window.BIGORNA_JOGO || null;
  const cabeca = ['Bigorna Rooms ' + VERSAO_DO_EDITOR, 'Game data: ' + (jogo ? 'game ' + (jogo.jogo || '?') + ', format ' + (jogo.formato || '?') : 'none'),
    'Language: ' + IDIOMA, 'Export folder: ' + (typeof Arquivos !== 'undefined' && Arquivos.ativo ? 'yes' : 'no'), 'Browser: ' + navigator.userAgent,
    'When: ' + new Date().toISOString(), 'Work: ' + (obra || (comObra ? 'not exported (see registro.txt)' : 'not sent')), 'Contact: ' + (contato || '-'), '', texto];
  arqs.unshift({ nome: 'relato.txt', dados: enc.encode(cabeca.join('\n')) }, { nome: 'registro.txt', dados: enc.encode(registro.join('\n') || '(no errors or warnings)') },
    { nome: 'acoes.txt', dados: enc.encode(REGISTRO_DE_ACOES.join('\n') || '(nothing changed since the editor opened)') });
  return { arqs, obra };
}
const nomeDoRelato = () => 'relato-editor-' + new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15) + '.zip';
async function base64DoBlob(b) { const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function salvarPacoteDoRelato(blob, nome) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

function abrirRelato() {
  if ($('#rl_texto')) { $('#rl_texto').focus(); return; }
  modal('Report a problem', `<p class="ajuda">Write what happened and what you expected. The package carries your text, the editor's log of errors, the log of what was done in the editor and, if you leave the box ticked, the work on screen. Nothing is sent without your click.</p>
    <label class="campo">What happened <textarea id="rl_texto" rows="7"></textarea></label>
    <label class="campo">Contact (optional: an e-mail or a Discord name, for an answer) <input id="rl_contato" maxlength="120"></label>
    <label class="campo"><input type="checkbox" id="rl_obra" checked> Send the work on screen (the map or campaign, without its pictures)</label>
    <div class="linha"><button id="rl_enviar">Send</button><button id="rl_salvar">Save the package</button></div>
    <p id="rl_situacao" class="ajuda"></p>`, (el, fechar) => {
    const situacao = (t, extra) => { const s = el.querySelector('#rl_situacao'); s.textContent = tr(t); if (extra) { const x = document.createElement('span'); x.dataset.semTraducao = ''; x.textContent = ' ' + extra; s.appendChild(x); } };
    const pacote = () => { const texto = el.querySelector('#rl_texto').value.trim(), contato = el.querySelector('#rl_contato').value.trim();
      const { arqs, obra } = arquivosDoRelato(texto, contato, el.querySelector('#rl_obra').checked); return { texto, contato, obra, blob: montarZip(arqs), nome: nomeDoRelato() }; };
    el.querySelector('#rl_salvar').onclick = () => { const p = pacote(); salvarPacoteDoRelato(p.blob, p.nome); situacao('Package saved. Send this file to the author (attach it to an issue on GitHub):', RELATO_ISSUES); };
    el.querySelector('#rl_enviar').onclick = async () => {
      const bt = el.querySelector('#rl_enviar'); if (!el.querySelector('#rl_texto').value.trim()) { situacao('Write what happened first.'); return; }
      bt.disabled = true; situacao('Sending…');
      let p; try { p = pacote(); } catch (e) { console.error('report', e); situacao('The package could not be made.'); bt.disabled = false; return; }
      if (p.blob.size > RELATO_LIMITE) { salvarPacoteDoRelato(p.blob, p.nome); situacao('The package is too big to send. It was saved as a file: send it to the author (attach it to an issue on GitHub):', RELATO_ISSUES); bt.disabled = false; return; }
      const corpo = JSON.stringify({ chave: RELATO_CHAVE, pessoa: pessoaDoRelato(), versao: 'editor ' + VERSAO_DO_EDITOR, jogo: (window.BIGORNA_JOGO || {}).jogo || '-',
        mapa: 'editor' + (p.obra ? ': ' + p.obra : ''), campanha: '', contato: p.contato, texto: p.texto, nome: p.nome, arquivo: await base64DoBlob(p.blob) });
      let r = null;
      try { const resp = await fetch(RELATO_ENDERECO, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corpo }); r = await resp.json(); }
      catch (e) { console.warn('report not sent', e); }
      bt.disabled = false;
      if (r && r.ok) { situacao('Sent. Thank you! Report number:', r.id || ''); el.querySelector('#rl_texto').value = ''; el.querySelector('#rl_contato').value = ''; return; }
      salvarPacoteDoRelato(p.blob, p.nome);
      if (r && (r.erro === 'limite da pessoa' || r.erro === 'limite do dia'))
        situacao(r.erro === 'limite da pessoa' ? 'You have already sent 5 reports today, the daily limit. The package was saved as a file: send it tomorrow, or attach it to an issue on GitHub:' : 'Today\'s report limit has been reached. The package was saved as a file: send it tomorrow, or attach it to an issue on GitHub:', RELATO_ISSUES);
      else situacao('The report could not be sent (no internet?). The package was saved as a file: send it to the author (attach it to an issue on GitHub):', RELATO_ISSUES);
    };
    setTimeout(() => el.querySelector('#rl_texto').focus(), 0);
  });
}
