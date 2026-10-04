/* Shared settings of the Bigorna editors (all UI text in English).
   For now, one setting: the folder the exported files go to (the CustomMaps folder
   of Descent). Uses the File System Access API (Chrome/Edge); the chosen folder handle
   is kept in the browser's IndexedDB. Without a folder, or in a browser without the
   API, the file is downloaded as usual. */
const Config = (() => {
  const BD = 'bigorna-config', LOJA = 'chaves';
  let pasta = null;        // FileSystemDirectoryHandle
  let pronto = null;

  function abrirBD() {
    return new Promise((ok, erro) => {
      const r = indexedDB.open(BD, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
      r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
    });
  }
  async function ler(chave) {
    try { const bd = await abrirBD(); return await new Promise((ok, erro) => { const t = bd.transaction(LOJA, 'readonly').objectStore(LOJA).get(chave); t.onsuccess = () => ok(t.result); t.onerror = () => erro(t.error); }); }
    catch { return undefined; }
  }
  async function gravar(chave, valor) {
    try { const bd = await abrirBD(); await new Promise((ok, erro) => { const t = bd.transaction(LOJA, 'readwrite').objectStore(LOJA); const q = valor === undefined ? t.delete(chave) : t.put(valor, chave); q.onsuccess = () => ok(); q.onerror = () => erro(q.error); }); }
    catch (e) { console.warn('config: could not save', e); }
  }

  const suportado = () => typeof window.showDirectoryPicker === 'function';

  async function carregar() {
    if (!pronto) pronto = (async () => { const h = await ler('pastaExport'); if (h && typeof h.queryPermission === 'function') pasta = h; })();
    return pronto;
  }

  async function escolherPasta() {
    if (!suportado()) throw new Error('This browser does not let the page write into a folder. Use Chrome or Edge.');
    const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'bigorna-custommaps', startIn: 'documents' });
    pasta = h; await gravar('pastaExport', h);
    return h.name;
  }

  async function limparPasta() { pasta = null; await gravar('pastaExport', undefined); }

  async function temPermissao(pedir) {
    if (!pasta) return false;
    try {
      const opts = { mode: 'readwrite' };
      if ((await pasta.queryPermission(opts)) === 'granted') return true;
      if (pedir && (await pasta.requestPermission(opts)) === 'granted') return true;
    } catch { }
    return false;
  }

  function baixar(nome, texto) {
    const b = new Blob([texto], { type: 'application/json' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* Exporta: grava na pasta escolhida, ou baixa. Devolve {onde:'pasta'|'download', nome, pasta}. */
  async function exportar(nome, texto, subpasta) {
    await carregar();
    if (pasta && await temPermissao(true)) {
      try {
        const alvo = subpasta ? await pasta.getDirectoryHandle(subpasta, { create: true }) : pasta;
        const arq = await alvo.getFileHandle(nome, { create: true });
        const w = await arq.createWritable(); await w.write(texto); await w.close();
        return { onde: 'pasta', nome, pasta: pasta.name + (subpasta ? '\\' + subpasta : '') };
      } catch (e) { console.warn('config: could not write into the folder, downloading instead', e); }
    }
    baixar(nome, texto);
    return { onde: 'download', nome };
  }

  /* Autosave: grava sem pedir permissao (so quando ja foi concedida). Devolve true se gravou. */
  async function gravarQuieto(nome, texto, subpasta) {
    await carregar();
    if (!pasta || !(await temPermissao(false))) return false;
    try {
      const alvo = subpasta ? await pasta.getDirectoryHandle(subpasta, { create: true }) : pasta;
      const arq = await alvo.getFileHandle(nome, { create: true });
      const w = await arq.createWritable(); await w.write(texto); await w.close();
      return true;
    } catch (e) { console.warn('config: autosave could not write ' + nome, e); return false; }
  }
  /* Apaga um arquivo que o proprio editor gravou (renomeacao do mapa). Silencioso. */
  async function apagarQuieto(nome, subpasta) {
    try {
      if (!pasta || !(await temPermissao(false))) return false;
      const alvo = subpasta ? await pasta.getDirectoryHandle(subpasta) : pasta;
      await alvo.removeEntry(nome); return true;
    } catch { return false; }
  }
  const CHAVE_AUTO = 'bigorna-autosave';
  const autoSalvar = () => { try { return localStorage.getItem(CHAVE_AUTO) !== '0'; } catch { return true; } };
  const porAutoSalvar = v => { try { localStorage.setItem(CHAVE_AUTO, v ? '1' : '0'); } catch { } };
  const permissao = pedir => temPermissao(pedir);

  const nomePasta = () => pasta ? pasta.name : null;
  const pastaAtual = () => pasta;

  /* Settings dialog, independent of the calling editor's stylesheet. */
  /* extras: [{rotulo, ajuda, acao}] — buttons the calling editor adds (quick save / quick load, for instance);
     {secao, opcoes: [[valor, rótulo]], valor, acao} — a choice shown first, as a select (the language, for instance) */
  function abrirDialogo(aoMudar, extras) {
    let fundo = document.getElementById('bgConfigFundo');
    if (fundo) fundo.remove();
    fundo = document.createElement('div'); fundo.id = 'bgConfigFundo';
    fundo.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center';
    const cx = document.createElement('div');
    cx.style.cssText = 'background:#26221e;color:#e8e0d2;border:1px solid #3b342d;border-radius:10px;padding:18px 20px;width:min(560px,92vw);max-height:90vh;overflow-y:auto;box-sizing:border-box;font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5)';
    const b = 'font:inherit;background:#3a332c;color:#e8e0d2;border:1px solid #3b342d;border-radius:6px;padding:6px 12px;cursor:pointer';
    // the sections folded away (export folder, author, other settings) stay as the user left them while the dialog is open
    const abertas = new Set();
    const titulo = t => `<span style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#a89b88">${t}</span>`;
    const dobra = (id, rot, resumo, corpo) => `<details data-dobra="${id}" ${abertas.has(id) ? 'open' : ''} style="margin:14px 0 0;border-top:1px solid #3b342d;padding-top:10px">
        <summary style="cursor:pointer;list-style:revert">${titulo(rot)}${resumo ? `<span style="margin-left:8px;color:#8c8173;font-size:12px">${resumo}</span>` : ''}</summary>
        <div style="margin-top:8px">${corpo}</div></details>`;
    const pintar = () => {
      const secoes = extras ? [...new Set(extras.filter(x => !x.campo && !x.opcoes).map(x => x.secao || 'Work in progress'))] : [];
      const botoesDe = sec => `<div style="display:flex;gap:8px;flex-wrap:wrap">${extras.map((x, i) => x.campo || x.opcoes || (x.secao || 'Work in progress') !== sec ? '' : `<button data-extra="${i}" style="${b}">${x.rotulo}</button>`).join('')}</div>
        <p style="margin:6px 0 0;color:#a89b88;font-size:12px">${extras.filter(x => !x.campo && !x.opcoes && (x.secao || 'Work in progress') === sec).map(x => x.ajuda || '').filter(Boolean).join(' ')}</p>`;
      const pastaCorpo = `
        <p style="margin:0 0 8px">${pasta ? 'Exported files go straight into <b>' + pasta.name + '</b>.' : 'No folder chosen: exported files are downloaded, and the game (with the mod) brings them from Downloads into its maps list by itself. Choosing the folder is only needed for autosave and the list of files.'}</p>
        ${pasta ? `<label style="display:flex;gap:8px;align-items:center;margin:0 0 8px;cursor:pointer"><input type="checkbox" id="cfgAuto" ${autoSalvar() ? 'checked' : ''}> Autosave: keep the files in <b>${pasta.name}</b> up to date as you work (no need to export)</label>` : ''}
        <p style="margin:0 0 12px;color:#a89b88;font-size:12px">The maps folder of Descent is <code>C:\\Users\\&lt;you&gt;\\AppData\\LocalLow\\Fantasy Flight Games\\Descent - Legends of the Dark\\CustomMaps</code>. The AppData folder is hidden: paste that path into the address bar of the folder picker.${suportado() ? '' : '<br><b>This browser cannot write into folders; use Chrome or Edge.</b>'}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="cfgEscolher" style="${b};background:#d98a2b;color:#1d1a17;font-weight:600" ${suportado() ? '' : 'disabled'}>${pasta ? 'Change folder…' : 'Choose folder…'}</button>
          ${pasta ? `<button id="cfgArquivos" style="${b}" title="Everything in the folder (maps, campaigns and their folders), with the option to delete">Files in the folder…</button><button id="cfgLimpar" style="${b}">Download instead</button>` : ''}
          <button id="cfgCopiar" style="${b}" title="Copies the CustomMaps path; paste it in Explorer's address bar">Copy CustomMaps path</button>
        </div>`;
      const autor = extras ? extras.map((x, i) => x.campo ? `<label style="display:block">${x.campo}<input data-extra-campo="${i}" value="${String(x.valor() || '').replace(/"/g, '&quot;')}" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;font:inherit;padding:6px 8px;background:#1d1a17;color:#e8e0d2;border:1px solid #3b342d;border-radius:6px"></label>` : '').join('') : '';
      const nomeAutor = extras && extras.find(x => x.campo) ? String(extras.find(x => x.campo).valor() || '') : '';
      cx.innerHTML = `
        <div style="display:flex;align-items:center;margin:0 0 12px"><h2 style="margin:0;font-size:18px;flex:1">Settings</h2><button id="cfgFechar" style="${b}">Close</button></div>
        ${extras ? extras.map((x, i) => x.opcoes ? `<div data-sem-traducao style="margin:0 0 14px"><label style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${titulo(x.secao || '')}<select data-extra-opcao="${i}" style="font:inherit;padding:5px 8px;background:#1d1a17;color:#e8e0d2;border:1px solid #3b342d;border-radius:6px">${x.opcoes.map(([v, r]) => `<option value="${v}" ${x.valor() === v ? 'selected' : ''}>${r}</option>`).join('')}</select></label></div>` : '').join('') : ''}
        ${secoes.filter(sec => sec === 'Work in progress').map(sec => `<div style="margin:0 0 6px">${titulo(sec)}</div>${botoesDe(sec)}`).join('')}
        ${dobra('pasta', 'Export folder', pasta ? '<span data-sem-traducao>' + pasta.name + '</span>' : '', pastaCorpo)}
        ${autor ? dobra('autor', 'Author', nomeAutor ? '<span data-sem-traducao>' + nomeAutor.replace(/</g, '&lt;') + '</span>' : '', autor) : ''}
        ${secoes.filter(sec => sec !== 'Work in progress').map(sec => dobra('sec:' + sec, sec, '', botoesDe(sec))).join('')}
        <p id="cfgErro" style="margin:10px 0 0;color:#d9534f"></p>`;
      cx.querySelectorAll('[data-dobra]').forEach(d => d.ontoggle = () => { if (d.open) abertas.add(d.dataset.dobra); else abertas.delete(d.dataset.dobra); });
      cx.querySelectorAll('[data-extra-campo]').forEach(inp => inp.oninput = () => { try { extras[+inp.dataset.extraCampo].acao(inp.value); } catch (e) { cx.querySelector('#cfgErro').textContent = e.message || String(e); } });
      cx.querySelectorAll('[data-extra-opcao]').forEach(sl => sl.onchange = async () => { try { await extras[+sl.dataset.extraOpcao].acao(sl.value); } catch (e) { cx.querySelector('#cfgErro').textContent = e.message || String(e); } });
      cx.querySelectorAll('[data-extra]').forEach(bt => bt.onclick = async () => { try { const r = await extras[+bt.dataset.extra].acao(); if (r === 'fechar') fechar(); else pintar(); } catch (e) { cx.querySelector('#cfgErro').textContent = e.message || String(e); } });
      cx.querySelector('#cfgFechar').onclick = fechar;
      cx.querySelector('#cfgEscolher').onclick = async () => {
        try { await escolherPasta(); pintar(); aoMudar && aoMudar(); }
        catch (e) { if (e && e.name !== 'AbortError') cx.querySelector('#cfgErro').textContent = e.message || String(e); }
      };
      const ca = cx.querySelector('#cfgAuto'); if (ca) ca.onchange = async () => { porAutoSalvar(ca.checked); if (ca.checked) await temPermissao(true); aoMudar && aoMudar(); };
      const l = cx.querySelector('#cfgLimpar'); if (l) l.onclick = async () => { await limparPasta(); pintar(); aoMudar && aoMudar(); };
      const ar = cx.querySelector('#cfgArquivos'); if (ar) ar.onclick = () => arquivos();
      cx.querySelector('#cfgCopiar').onclick = async () => {
        const caminho = '%USERPROFILE%\\AppData\\LocalLow\\Fantasy Flight Games\\Descent - Legends of the Dark\\CustomMaps';
        try { await navigator.clipboard.writeText(caminho); cx.querySelector('#cfgErro').style.color = '#6cbf6c'; cx.querySelector('#cfgErro').textContent = 'Copied: ' + caminho + ' (paste it in the Explorer address bar).'; }
        catch (e) { cx.querySelector('#cfgErro').textContent = 'Could not copy: ' + (e.message || e); }
      };
    };
    /* the files in the export folder: every map, campaign and folder, with their size and date, and a button to delete
       each (a folder goes with everything in it). The browser cannot open Explorer; this is the way to tidy the folder */
    const expandidas = new Set();
    const kb = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
    async function itensDe(dir, caminho) {
      const l = [];
      for await (const [nome, h] of dir.entries()) {
        const it = { nome, h, pai: dir, caminho: caminho ? caminho + '/' + nome : nome, pasta: h.kind === 'directory' };
        if (!it.pasta) { try { const f = await h.getFile(); it.tam = f.size; it.data = f.lastModified; } catch { } }
        l.push(it);
      }
      return l.sort((a, b) => (b.pasta - a.pasta) || a.nome.localeCompare(b.nome));
    }
    async function arquivos(msg) {
      if (!pasta) return pintar();
      cx.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin:0 0 10px"><button id="arqVoltar" style="${b}">‹ Back</button><h2 style="margin:0;font-size:17px;flex:1"><span>Files in the folder</span> <span data-sem-traducao style="color:#d9a35a">${pasta.name}</span></h2><button id="arqAtualizar" style="${b}">Refresh</button></div>
        <p style="margin:0 0 8px;color:#a89b88;font-size:12px">Delete what you no longer want in the folder: maps (.dmap), campaigns (.dcamp) and their folders. What is deleted here is gone for good.</p>
        <div id="arqLista" style="max-height:52vh;overflow:auto;border:1px solid #3b342d;border-radius:6px;padding:4px 0">…</div>
        <p id="arqMsg" style="margin:8px 0 0;color:#6cbf6c;font-size:13px">${msg || ''}</p>`;
      cx.querySelector('#arqVoltar').onclick = () => pintar();
      cx.querySelector('#arqAtualizar').onclick = () => arquivos();
      const lista = cx.querySelector('#arqLista');
      let perm = false; try { perm = (await pasta.queryPermission({ mode: 'read' })) === 'granted' || (await pasta.requestPermission({ mode: 'read' })) === 'granted'; } catch { }
      if (!perm) { lista.innerHTML = '<p style="margin:8px 12px">The browser did not allow reading the folder.</p>'; return; }
      const linhas = []; const todos = [];
      const andar = async (dir, caminho, nivel) => {
        for (const it of await itensDe(dir, caminho)) {
          todos.push(it); const i = todos.length - 1; const aberta = expandidas.has(it.caminho);
          linhas.push(`<div style="display:flex;align-items:center;gap:8px;padding:3px 10px 3px ${10 + nivel * 18}px;border-bottom:1px solid #2f2a25">
            ${it.pasta ? `<button data-abre="${i}" style="${b};padding:0 6px;min-width:26px">${aberta ? '▾' : '▸'}</button>` : '<span style="display:inline-block;min-width:26px"></span>'}
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-sem-traducao>${it.pasta ? '📁 ' : '📄 '}${it.nome.replace(/</g, '&lt;')}</span>
            <span style="color:#8c8173;font-size:12px;min-width:150px;text-align:right" data-sem-traducao>${it.pasta ? '' : kb(it.tam || 0) + ' · ' + (it.data ? new Date(it.data).toLocaleString() : '')}</span>
            <button data-apaga="${i}" style="${b};padding:2px 10px;color:#ff9a8a">Delete</button></div>`);
          if (it.pasta && aberta) await andar(it.h, it.caminho, nivel + 1);
        }
      };
      try { await andar(pasta, '', 0); } catch (e) { lista.innerHTML = '<p style="margin:8px 12px">' + (e.message || e) + '</p>'; return; }
      lista.innerHTML = linhas.join('') || '<p style="margin:8px 12px">The folder is empty.</p>';
      lista.querySelectorAll('[data-abre]').forEach(bt => bt.onclick = () => { const it = todos[+bt.dataset.abre]; if (expandidas.has(it.caminho)) expandidas.delete(it.caminho); else expandidas.add(it.caminho); arquivos(); });
      lista.querySelectorAll('[data-apaga]').forEach(bt => bt.onclick = async () => {
        const it = todos[+bt.dataset.apaga];
        const pergunta = it.pasta ? 'Delete the folder "' + it.caminho + '" and everything in it? It cannot be undone.' : 'Delete "' + it.caminho + '"? It cannot be undone.';
        if (!confirm(typeof tr === 'function' ? tr(pergunta) : pergunta)) return;
        try {
          if (!(await temPermissao(true))) throw new Error('The browser did not allow changing the folder.');
          await it.pai.removeEntry(it.nome, { recursive: it.pasta });
          arquivos('Deleted: ' + it.caminho);
        } catch (e) { const m = cx.querySelector('#arqMsg'); if (m) { m.style.color = '#d9534f'; m.textContent = e.message || String(e); } }
      });
    }
    const fechar = () => fundo.remove();
    fundo.onclick = e => { if (e.target === fundo) fechar(); };
    fundo.appendChild(cx); document.body.appendChild(fundo);
    carregar().then(pintar); pintar();
  }

  /* binary files the editor keeps for the work (the custom music): kept in IndexedDB, like the folder handle */
  const guardarBlob = (chave, blob) => gravar(chave, blob), lerBlob = chave => ler(chave);
  return { guardarBlob, lerBlob, carregar, escolherPasta, limparPasta, exportar, gravarQuieto, apagarQuieto, autoSalvar, porAutoSalvar, permissao, nomePasta, pastaAtual, abrirDialogo, suportado };
})();
