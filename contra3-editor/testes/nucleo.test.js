'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { descomprimir, comprimir } = require('../nucleo/lzss.js');
const { snesParaArquivo, arquivoParaSnes, corrigirChecksum, somaRom, carregarRom, ROM_TITULO, hexSnes } = require('../nucleo/rom.js');
const { lerTile, escreverTile, corDe555, corPara555, lerQuadroSprite } = require('../nucleo/graficos.js');
const { criarIps, aplicarIps } = require('../nucleo/patch.js');
const { lerScript, regravarFluxo } = require('../nucleo/recursos.js');

/* a stream written by hand with every command, decoded the way $00:949C does */
test('lzss: cada comando', () => {
  const corpo = [
    0x83, 0x11, 0x22, 0x33,        // 3 literals
    0xC1, 0x44,                    // 3 x $44
    0xE0,                          // 2 zeros
    0xA0, 0x55, 0x66,              // 2 pairs: 00 55 00 66
    // copy 4 bytes from output position 0: field = (0 + $3DF) & $3FF = $3DF -> B = (4-2)<<2 | 3 = $0B, $DF
    0x0B, 0xDF,
    0x80,                          // empty literal run
  ];
  const s = Uint8Array.from([corpo.length + 2, 0, ...corpo]);
  const { dados, tamanho } = descomprimir(s, 0);
  assert.equal(tamanho, s.length);
  assert.deepEqual([...dados], [0x11, 0x22, 0x33, 0x44, 0x44, 0x44, 0, 0, 0, 0x55, 0, 0x66, 0x11, 0x22, 0x33, 0x44]);
});

test('lzss: copia do anel ainda zerado e sobreposta', () => {
  // field $000 points to ring position (0 - $3DF) & $3FF = $21, never written: zeros
  const a = descomprimir(Uint8Array.from([4, 0, 0x00, 0x00]), 0).dados;
  assert.deepEqual([...a], [0, 0]);
  // one literal then a 5-byte copy from position 0 that overlaps its own output
  const b = descomprimir(Uint8Array.from([6, 0, 0x81, 0x7A, (3 << 2) | 3, 0xDF]), 0).dados;
  assert.deepEqual([...b], [0x7A, 0x7A, 0x7A, 0x7A, 0x7A, 0x7A]);
});

function aleatorio(semente) { let a = semente >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a >>> 24; }; }
test('lzss: comprimir e descomprimir voltam ao mesmo', () => {
  const r = aleatorio(7);
  const casos = [new Uint8Array(0), Uint8Array.from([1]), new Uint8Array(5000)];
  // tile-like data: runs, zero pairs, repeats far back and noise
  const t = new Uint8Array(20000);
  for (let i = 0; i < t.length; i++) t[i] = i % 64 < 16 ? 0 : i % 2 ? r() & 7 : (i % 512 < 256 ? t[i - 2] || 0 : r());
  for (let i = 3000; i < 6000; i++) t[i] = t[i - 1000];
  casos.push(t, Uint8Array.from({ length: 3000 }, r));
  for (const c of casos) {
    const z = comprimir(c);
    const { dados, tamanho } = descomprimir(z, 0);
    assert.equal(tamanho, z.length);
    assert.deepEqual(dados, c);
  }
  assert.ok(comprimir(t).length < t.length * 0.8);
});

test('rom: enderecos LoROM', () => {
  assert.equal(snesParaArquivo(0x008000), 0);
  assert.equal(snesParaArquivo(0x05F55B), 0x2F55B);
  assert.equal(snesParaArquivo(0x85F55B), 0x2F55B);
  assert.equal(snesParaArquivo(0x057FFF), -1);
  assert.equal(snesParaArquivo(0x208000), -1);
  assert.equal(arquivoParaSnes(0x2F55B), 0x05F55B);
  assert.equal(hexSnes(0x05F55B), '$05:F55B');
});

function romFalsa() {
  const rom = new Uint8Array(0x100000);
  for (let i = 0; i < rom.length; i++) rom[i] = (i * 31 + (i >> 9)) & 0xFF;
  for (let i = 0; i < ROM_TITULO.length; i++) rom[0x7FC0 + i] = ROM_TITULO.charCodeAt(i);
  corrigirChecksum(rom);
  return rom;
}
test('rom: checksum corrigido e carga', async () => {
  const rom = romFalsa();
  assert.equal(somaRom(rom), rom[0x7FDE] | rom[0x7FDF] << 8);
  let r = await carregarRom(rom);
  assert.deepEqual(r.avisos, []); assert.equal(r.original, false);
  const comCabecalho = new Uint8Array(rom.length + 512); comCabecalho.set(rom, 512);
  r = await carregarRom(comCabecalho);
  assert.deepEqual(r.avisos, ['cabecalho']);
  rom[0x1234] ^= 1;
  r = await carregarRom(rom);
  assert.deepEqual(r.avisos, ['checksum']);
  await assert.rejects(carregarRom(new Uint8Array(10)), /tamanho/);
});

test('graficos: tile planar ida e volta', () => {
  for (const bpp of [2, 4, 8]) {
    const px = Uint8Array.from({ length: 64 }, (_, i) => (i * 7) & ((1 << bpp) - 1));
    const d = new Uint8Array(bpp * 8);
    escreverTile(d, 0, bpp, px);
    assert.deepEqual(lerTile(d, 0, bpp), px);
  }
  // 2bpp: row 0 plane 0 = $80 -> pixel (0,0) is 1
  const d = new Uint8Array(16); d[0] = 0x80; d[1] = 0x01;
  const t = lerTile(d, 0, 2); assert.equal(t[0], 1); assert.equal(t[7], 2);
  assert.deepEqual(corDe555(0x7FFF), [255, 255, 255]);
  assert.equal(corPara555(...corDe555(0x1234)), 0x1234);
});

test('graficos: quadro de sprite', () => {
  const d = Uint8Array.from([2, 0xF8, 0xF0, 0x10, 0x21, 8, 0, 0x11, 0xC0]);
  const q = lerQuadroSprite(d, 0);
  assert.equal(q.tamanho, 9);
  assert.deepEqual(q.pecas[0], { x: -8, y: -16, tile: 0x110, paleta: 0, prioridade: 2, grande: true, hflip: false, vflip: false });
  assert.equal(q.pecas[1].hflip && q.pecas[1].vflip, true);
});

test('patch: IPS ida e volta', () => {
  const a = romFalsa(), b = new Uint8Array(a);
  b[0] = 1; b[10] ^= 0xFF; b[12] ^= 0xFF; b[0x454F46] ^= 1; b[0xFFFFF] ^= 2;
  for (let i = 0x50000; i < 0x70000; i++) b[i] ^= 0x5A;   // longer than one record
  assert.deepEqual(aplicarIps(a, criarIps(a, b)), b);
  assert.equal(criarIps(a, a).length, 8);
});

test('recursos: script e regravacao', () => {
  const rom = new Uint8Array(0x100000);
  const pos = snesParaArquivo(0x058000), fluxo = comprimir(new Uint8Array(256));
  rom.set([0, 1, 0x00, 0x40, 0x00, 0x90, 0x06, 0xFF, 0xFF], pos);   // BG, background, VRAM $4000 <- $06:9000
  rom.set(fluxo, snesParaArquivo(0x069000));
  const s = lerScript(rom, 0x8000);
  assert.equal(s.tipo, 0); assert.equal(s.flags, 1);
  assert.deepEqual(s.entradas, [{ destino: 0x4000, ponteiro: 0x069000, pos: 0x31000, tamanho: fluxo.length }]);
  assert.equal(lerScript(rom, 0x8100), null);   // zeros: an entry pointing at $00:0000 is not a script
  assert.throws(() => regravarFluxo(rom, 0, new Uint8Array(10), 9), /nao cabe/);
});

const { lerInimigos, gravarEntrada, lerLimiares, classeDoTile } = require('../nucleo/fases.js');
test('fases: listas de inimigos e limiares', () => {
  const rom = new Uint8Array(0x100000), b = e => snesParaArquivo(0x050000 | e);
  const w = (p, v) => { rom[p] = v & 0xFF; rom[p + 1] = v >> 8; };
  w(b(0x947A + 2 * 1), 0xA000);                 // stage 1 -> screen table $05:A000
  w(b(0xA000), 0xA100); w(b(0xA002), 0xA200);   // two screens; the third pointer is 0
  rom.set([0x10, 0x05, 0x40, 0x20, 0x00, 0x01, 0xC0, 0x00, 0x03, 0x00, 0x80, 0x06, 0x40, 0x20, 0xF8, 0xFF, 0x10, 0x00, 0, 0, 0xFF], b(0xA100));
  rom[b(0xA200)] = 0xFF;
  const f = lerInimigos(rom, 1);
  assert.equal(f.telas.length, 2);
  assert.deepEqual(f.telas[0].entradas.map(e => [e.gatilho, e.tipo, e.x, e.y, e.param]), [[0x10, 5, 0x100, 0xC0, 3], [0x80, 6, -8, 0x10, 0]]);
  assert.equal(f.telas[1].entradas.length, 0);
  const e = { ...f.telas[0].entradas[1], x: 0x123, tipo: 9 };
  gravarEntrada(rom, e);
  assert.deepEqual(lerInimigos(rom, 1).telas[0].entradas[1].x, 0x123);
  // out-of-order triggers are not a list
  rom[b(0xA100)] = 0x90;
  assert.equal(lerInimigos(rom, 1).telas.length, 0);

  rom[b(0x89CC + 3)] = 4; w(b(0x8A03 + 4), 0xB000);
  for (let i = 0; i < 12; i++) w(b(0xB000) + 2 * i, 0x10 * (i + 1));
  const l = lerLimiares(rom, 3);
  assert.equal(l.nivel, 4); assert.equal(l.valores[11], 0xC0);
  assert.equal(classeDoTile(l.valores, 0x05), 0); assert.equal(classeDoTile(l.valores, 0x10), 1); assert.equal(classeDoTile(l.valores, 0x3FF), 12);
});
