/* Contra III editor — the page: opens the player's ROM, browses and paints compressed graphics, views sprite
   frames, and exports an IPS patch or an edited ROM to test in the Contra3Recomp. */
'use strict';

const $ = id => document.getElementById(id);
const E = {
  original: null,   // the ROM as opened, never changed (the IPS base)
  rom: null,        // the ROM being edited
  fluxo: null,      // the open stream: { pos, tamanho, dados, titulo, mudou }
  tileSel: -1, corSel: 1,
};

// ------------------------------------------------------------ addresses typed as $bb:aaaa, bbaaaa or a file offset 0x...
function lerEndereco(txt) {
  const t = txt.trim().replace(/^\$/, '');
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  const m = t.match(/^([0-9a-f]{1,2}):?([0-9a-f]{4})$/i);
  if (!m) return -1;
  return snesParaArquivo(parseInt(m[1], 16) << 16 | parseInt(m[2], 16));
}
const descreverPos = pos => `${hexSnes(arquivoParaSnes(pos))} (arquivo ${hex(pos, 5)})`;

// ------------------------------------------------------------ opening the ROM
async function abrirRom(arquivo) {
  try {
    const r = await carregarRom(new Uint8Array(await arquivo.arrayBuffer()));
    E.original = r.rom; E.rom = new Uint8Array(r.rom); E.fluxo = null;
    const avisos = [];
    if (r.avisos.includes('cabecalho')) avisos.push('cabeçalho de copiadora removido');
    if (r.avisos.includes('checksum')) avisos.push('checksum não confere');
    $('estado').innerHTML = r.original
      ? `<span class="ok">ROM original confirmada (SHA-256).</span> ${avisos.join('; ')}`
      : `<span class="erro">Não é a ROM original (SHA-256 diferente).</span> O patch será feito contra esta cópia. ${avisos.join('; ')}`;
    listarRecursos();
    verFase();
    atualizarExportar();
  } catch (e) {
    const [tipo, v] = String(e.message).split(':');
    $('estado').innerHTML = `<span class="erro">${tipo === 'tamanho' ? `O arquivo tem ${v} bytes; a ROM tem 1 MB.` : tipo === 'titulo' ? 'Não é Contra III: The Alien Wars (USA).' : e.message}</span>`;
  }
}

// ------------------------------------------------------------ graphics
function listarRecursos() {
  const lista = $('lista-scripts'); lista.innerHTML = '';
  for (const s of listarScripts(E.rom)) {
    const cab = document.createElement('div');
    cab.className = 'script';
    cab.textContent = `$05:${hex(s.ender, 4).slice(1)} ${TIPOS_SCRIPT[s.tipo] || 'tipo ' + s.tipo} · ${s.onde}`;
    lista.append(cab);
    for (const en of s.entradas) {
      const d = document.createElement('div');
      d.textContent = `  ${hexSnes(en.ponteiro)} → ${hex(en.destino, 4)}  ${en.tamanho} b`;
      d.onclick = () => { abrirFluxo(en.pos, `${hexSnes(en.ponteiro)} → destino ${hex(en.destino, 4)}`, s.tipo); for (const x of lista.children) x.classList.remove('sel'); d.classList.add('sel'); };
      lista.append(d);
    }
  }
  if (!lista.children.length) lista.innerHTML = '<div class="nota">Nenhum script reconhecido.</div>';
}

function abrirFluxo(pos, titulo) {
  if (E.fluxo?.mudou && !confirm('O fluxo aberto tem mudanças não gravadas. Descartar?')) return;
  try {
    const { dados, tamanho } = descomprimir(E.rom, pos);
    E.fluxo = { pos, tamanho, dados, titulo, mudou: false };
    E.tileSel = -1;
    $('titulo-fluxo').textContent = `${titulo} · ${tamanho} b comprimidos, ${dados.length} b`;
    $('painel-tile').classList.add('escondido');
    $('resultado-gravar').textContent = '';
    desenharFolha();
  } catch (e) { $('titulo-fluxo').innerHTML = `<span class="erro">${descreverPos(pos)}: ${e.message}</span>`; }
}

function paletaAtual() {
  const bpp = +$('bpp').value, t = $('ender-paleta').value.trim();
  if (!t || /^cinza$/i.test(t)) return paletaCinza(bpp);
  const pos = lerEndereco(t);
  if (pos < 0) return paletaCinza(bpp);
  const n = 1 << bpp, linha = bpp === 8 ? 0 : +$('linha-paleta').value;
  return lerPaleta(E.rom, pos + linha * n * 2, n);
}

function pintarTile(img, largura, px, ox, oy, paleta, hflip = false, vflip = false, transparente = false) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = px[(vflip ? 7 - y : y) * 8 + (hflip ? 7 - x : x)];
    if (transparente && v === 0) continue;
    const X = ox + x, Y = oy + y;
    if (X < 0 || Y < 0 || X >= largura || Y * largura * 4 >= img.data.length) continue;
    const c = paleta[v] || [255, 0, 255], i = (Y * largura + X) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
}

function desenharFolha() {
  const f = E.fluxo, cv = $('folha');
  if (!f) return;
  const bpp = +$('bpp').value, zoom = +$('zoom').value, por = bytesPorTile(bpp);
  const n = Math.ceil(f.dados.length / por), cols = 16, linhas = Math.max(1, Math.ceil(n / cols));
  const tmp = document.createElement('canvas'); tmp.width = cols * 8; tmp.height = linhas * 8;
  const ctx = tmp.getContext('2d'), img = ctx.createImageData(tmp.width, tmp.height), pal = paletaAtual();
  for (let t = 0; t < n; t++) pintarTile(img, tmp.width, lerTile(f.dados, t * por, bpp), (t % cols) * 8, Math.floor(t / cols) * 8, pal);
  ctx.putImageData(img, 0, 0);
  cv.width = tmp.width * zoom; cv.height = tmp.height * zoom;
  const c2 = cv.getContext('2d'); c2.imageSmoothingEnabled = false; c2.drawImage(tmp, 0, 0, cv.width, cv.height);
  if (E.tileSel >= 0) { c2.strokeStyle = '#e0a458'; c2.lineWidth = 2; c2.strokeRect((E.tileSel % cols) * 8 * zoom, Math.floor(E.tileSel / cols) * 8 * zoom, 8 * zoom, 8 * zoom); }
}

function desenharTileGrande() {
  const f = E.fluxo, bpp = +$('bpp').value, cv = $('tile-grande'), ctx = cv.getContext('2d'), pal = paletaAtual();
  const px = lerTile(f.dados, E.tileSel * bytesPorTile(bpp), bpp), z = cv.width / 8;
  for (let i = 0; i < 64; i++) { const c = pal[px[i]] || [255, 0, 255]; ctx.fillStyle = `rgb(${c})`; ctx.fillRect((i % 8) * z, Math.floor(i / 8) * z, z, z); }
  const cores = $('cores'); cores.innerHTML = '';
  pal.slice(0, 16).forEach((c, i) => {
    const s = document.createElement('span'); s.style.background = `rgb(${c})`; s.title = 'cor ' + i;
    if (i === E.corSel) s.classList.add('sel');
    s.onclick = () => { E.corSel = i; desenharTileGrande(); };
    cores.append(s);
  });
}

$('folha').onclick = ev => {
  if (!E.fluxo) return;
  const zoom = +$('zoom').value, r = ev.target.getBoundingClientRect(), esc = ev.target.width / r.width;
  const t = Math.floor((ev.clientY - r.top) * esc / (8 * zoom)) * 16 + Math.floor((ev.clientX - r.left) * esc / (8 * zoom));
  if (t * bytesPorTile(+$('bpp').value) >= E.fluxo.dados.length) return;
  E.tileSel = t; $('painel-tile').classList.remove('escondido');
  desenharFolha(); desenharTileGrande();
};

let pintando = false;
function pintarEm(ev) {
  const cv = $('tile-grande'), r = cv.getBoundingClientRect();
  const x = Math.floor((ev.clientX - r.left) / r.width * 8), y = Math.floor((ev.clientY - r.top) / r.height * 8);
  if (x < 0 || y < 0 || x > 7 || y > 7) return;
  const bpp = +$('bpp').value, pos = E.tileSel * bytesPorTile(bpp), px = lerTile(E.fluxo.dados, pos, bpp);
  if (px[y * 8 + x] === E.corSel || E.corSel >= 1 << bpp) return;
  px[y * 8 + x] = E.corSel; escreverTile(E.fluxo.dados, pos, bpp, px);
  E.fluxo.mudou = true; $('resultado-gravar').textContent = 'mudanças não gravadas';
  desenharTileGrande(); desenharFolha();
}
$('tile-grande').onpointerdown = ev => { pintando = true; ev.target.setPointerCapture(ev.pointerId); pintarEm(ev); };
$('tile-grande').onpointermove = ev => { if (pintando) pintarEm(ev); };
$('tile-grande').onpointerup = () => { pintando = false; };

$('gravar-fluxo').onclick = () => {
  const f = E.fluxo; if (!f) return;
  const novo = comprimir(f.dados);
  try {
    const sobra = regravarFluxo(E.rom, f.pos, novo, f.tamanho);
    f.mudou = false;
    $('resultado-gravar').innerHTML = `<span class="ok">Gravado: ${novo.length} de ${f.tamanho} bytes (${sobra} livres).</span>`;
    atualizarExportar();
  } catch (e) {
    $('resultado-gravar').innerHTML = `<span class="erro">Não cabe: ${novo.length} bytes para ${f.tamanho}. Simplifique o desenho (mais cor repetida comprime melhor).</span>`;
  }
};
$('abrir-fluxo').onclick = () => { if (!E.rom) return; const p = lerEndereco($('ender-fluxo').value); if (p >= 0) abrirFluxo(p, descreverPos(p)); };
for (const id of ['bpp', 'zoom', 'ender-paleta', 'linha-paleta']) $(id).onchange = () => { desenharFolha(); if (E.tileSel >= 0) desenharTileGrande(); };

// ------------------------------------------------------------ sprite frames
let quadroPos = -1, quadroTam = 0;
function verQuadro(pos) {
  const q = E.rom && pos >= 0 ? lerQuadroSprite(E.rom, pos) : null, cv = $('quadro'), ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!q) { $('pecas').textContent = 'Não parece um quadro (0 ou mais de 64 peças).'; quadroTam = 1; return; }
  quadroPos = pos; quadroTam = q.tamanho;
  const img = ctx.createImageData(128, 128), pal = paletaAtual();
  for (const p of q.pecas.slice().reverse()) {   // the first piece wins, as in OAM
    const lado = p.grande ? 2 : 1;
    for (let ty = 0; ty < lado; ty++) for (let tx = 0; tx < lado; tx++) {
      const t = p.tile + (p.vflip ? lado - 1 - ty : ty) * 16 + (p.hflip ? lado - 1 - tx : tx);
      const px = E.fluxo ? lerTile(E.fluxo.dados, (t & 0x1FF) * 32, 4) : new Uint8Array(64).fill(1);
      pintarTile(img, 128, px, 64 + p.x + tx * 8, 64 + p.y + ty * 8, pal, p.hflip, p.vflip, true);
    }
  }
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 128; tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(tmp, 0, 0, 256, 256);
  ctx.strokeStyle = '#e0a45866'; ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
  $('pecas').textContent = `${descreverPos(pos)}: ${q.pecas.length} peças, ${q.tamanho} bytes\n` +
    q.pecas.map((p, i) => `${String(i).padStart(2)}  x ${String(p.x).padStart(4)}  y ${String(p.y).padStart(4)}  tile ${hex(p.tile, 3)}  pal ${p.paleta}  pri ${p.prioridade}${p.grande ? '  16x16' : ''}${p.hflip ? '  H' : ''}${p.vflip ? '  V' : ''}`).join('\n');
}
$('ver-quadro').onclick = () => verQuadro(lerEndereco($('ender-quadro').value));
$('proximo-quadro').onclick = () => { if (quadroPos < 0) return; const p = quadroPos + quadroTam; $('ender-quadro').value = hexSnes(arquivoParaSnes(p)); verQuadro(p); };

// ------------------------------------------------------------ stages: enemy lists and collision thresholds
const CAMPOS = [['gatilho', 'gatilho'], ['tipo', 'tipo'], ['x', 'x'], ['y', 'y'], ['param', 'param'], ['slotIni', 'slots de'], ['slotFim', 'até']];
const lerNumero = t => { t = t.trim(); const neg = t.startsWith('-'); if (neg) t = t.slice(1); const v = /^\$/.test(t) ? parseInt(t.slice(1), 16) : /^0x/i.test(t) ? parseInt(t, 16) : parseInt(t, 10); return neg ? -v : v; };
const mostrarCampo = (k, v) => k === 'x' || k === 'y' ? String(v) : hex(v, k === 'param' ? 4 : 2);
function verFase() {
  if (!E.rom) return;
  const fase = +$('fase').value, alvo = $('inimigos'); alvo.innerHTML = '';
  const f = lerInimigos(E.rom, fase);
  if (!f || !f.telas.length) alvo.innerHTML = '<p class="nota">Nenhuma lista reconhecida para esta fase.</p>';
  else f.telas.forEach((tela, i) => {
    const h = document.createElement('div'); h.className = 'tela';
    h.textContent = `tela ${i} · lista em ${hexSnes(0x050000 | tela.ender)} · ${tela.entradas.length} inimigos`;
    alvo.append(h);
    if (!tela.entradas.length) return;
    const t = document.createElement('table');
    t.innerHTML = '<tr>' + CAMPOS.map(([, n]) => `<th>${n}</th>`).join('') + '<th></th></tr>';
    for (const e of tela.entradas) {
      const tr = document.createElement('tr');
      for (const [k] of CAMPOS) {
        const td = document.createElement('td'), inp = document.createElement('input');
        inp.value = mostrarCampo(k, e[k]);
        inp.onchange = () => {
          const v = lerNumero(inp.value), novo = { ...e, [k]: v };
          try { if (Number.isNaN(v)) throw new Error('número inválido'); gravarEntrada(E.rom, novo); Object.assign(e, novo); inp.value = mostrarCampo(k, v); inp.classList.remove('erro'); atualizarExportar(); }
          catch (err) { inp.classList.add('erro'); inp.title = err.message; }
        };
        td.append(inp); tr.append(td);
      }
      const td = document.createElement('td'); td.className = 'nota'; td.textContent = descreverPos(e.pos); tr.append(td);
      t.append(tr);
    }
    alvo.append(t);
  });
  const l = lerLimiares(E.rom, fase);
  $('limiares').textContent = !l ? 'Sem tabela de limiares para esta fase.' :
    `código de nível ${l.nivel}, tabela ${hexSnes(0x050000 | l.ender)}\n` + CLASSES_COLISAO.map((c, i) => {
      const de = i ? l.valores[i - 1] : 0, ate = i < 12 ? l.valores[i] - 1 : 0x3FF;
      return `${(ate < de ? '(vazio)' : `${hex(de, 3)}-${hex(ate, 3)}`).padEnd(10)} ${c}`;
    }).join('\n');
}
$('fase').onchange = verFase;

// ------------------------------------------------------------ export and test
function baixar(bytes, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function romFinal() { const r = new Uint8Array(E.rom); corrigirChecksum(r); return r; }
function atualizarExportar() {
  if (!E.rom) return;
  let n = 0; for (let i = 0; i < E.rom.length; i++) if (E.rom[i] !== E.original[i]) n++;
  $('resumo-mudancas').textContent = n ? `${n} bytes mudados (o checksum é corrigido ao exportar).` : 'Nenhuma mudança ainda.';
  const nome = ($('nome').value || 'contra3-editado') + '.sfc';
  $('comando-recomp').textContent = `contra3.exe --rom "${nome}" --start-stage ${$('fase-teste').value}`;
}
$('baixar-ips').onclick = () => { if (E.rom) baixar(criarIps(E.original, romFinal()), ($('nome').value || 'contra3-editado') + '.ips'); };
$('baixar-rom').onclick = () => { if (E.rom) baixar(romFinal(), ($('nome').value || 'contra3-editado') + '.sfc'); };
$('nome').oninput = $('fase-teste').onchange = atualizarExportar;

// ------------------------------------------------------------ tabs, file picking, drag and drop
for (const b of document.querySelectorAll('#abas button')) b.onclick = () => {
  for (const x of document.querySelectorAll('#abas button, .aba')) x.classList.remove('ativa');
  b.classList.add('ativa'); $('aba-' + b.dataset.aba).classList.add('ativa');
};
$('arquivo').onchange = ev => ev.target.files[0] && abrirRom(ev.target.files[0]);
document.addEventListener('dragover', ev => ev.preventDefault());
document.addEventListener('drop', ev => { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if (f) abrirRom(f); });
window.addEventListener('beforeunload', ev => { if (E.fluxo?.mudou) ev.preventDefault(); });
