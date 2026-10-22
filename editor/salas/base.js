/* Bigorna Rooms v2 — base: catalogs, state, geometry, rules, autosave.
   A map is built room by room; rooms open through object triggers. Tiles may be elevated (levels 0-3) and carry the
   pillars that hold them up. Monsters, NPCs and items come from the map's own workshop (imported from the game
   or created), never straight from the game catalog. Exports .dmap (v3) / .dcamp (v2) for the Bigorna mod. */
'use strict';

// ------------------------------------------------------------ random numbers with a seed
function rngDe(semente) {
  let h = 1779033703 ^ String(semente).length; for (const ch of String(semente)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = h << 13 | h >>> 19; }
  let a = h >>> 0;
  const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = l => l[Math.floor(r() * l.length)];
  r.pesado = obj => { const e = Object.entries(obj).filter(([, w]) => w > 0); const t = e.reduce((s, [, w]) => s + w, 0); let x = r() * t; for (const [k, w] of e) { x -= w; if (x <= 0) return k; } return e[0]?.[0]; };
  r.embaralhar = l => { const c = l.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };
  return r;
}
/* the key of a picture of the game: the file name of its asset path, without .png */
const chaveArte = caminho => (caminho || '').split('/').pop().replace(/\.png$/i, '');
/* the key of a square in the sets and maps of squares */
const kc = (x, y) => x + ',' + y;
/* the neighbours of a square (the first four: its sides), and the way up of a staircase or ladder turned by rot (SOBE[rot/90]) */
const VIZ8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const VIZ4 = VIZ8.slice(0, 4);
const SOBE = [[1, 0], [0, 1], [-1, 0], [0, -1]];
// ------------------------------------------------------------ the boxes the player owns: Act I, or Acts I and II
/* the generators use only what comes in the chosen boxes: tiles, objects, monsters and items (a remembered choice) */
const ATOS = {
  get() { try { return localStorage.getItem('bigorna-atos') === '1' ? 1 : 2; } catch { return 2; } },
  set(v) { try { localStorage.setItem('bigorna-atos', String(v === 1 ? 1 : 2)); } catch { } }
};
const OPCOES_ATOS = [['1', 'Act I only'], ['2', 'Acts I and II']];

// ------------------------------------------------------------ catalogs
const PECAS = DADOS.tiles.filter(t => t.kind === 'tile');
const ALFOMBRAS = DADOS.tiles.filter(t => t.kind === 'underlay');
const PECA = Object.fromEntries(DADOS.tiles.map(t => [t.id, t]));
const TERRENO = new Set(['Staircase', 'Bridge']);                       // floor-like objects: may go off the tiles
/* pillars in the boxes: Act I brings 8 short and 4 medium; Act II brings 4 short, 4 medium and 4 tall */
const SUPORTES = { PillarShort: { nivel: 1, nome: 'Short pillar', caixa: 12, porAto: '8 in Act I, 4 in Act II', act: 1 }, Pillar: { nivel: 2, nome: 'Medium pillar', caixa: 8, porAto: '4 in Act I, 4 in Act II', act: 1 }, PillarTall: { nivel: 3, nome: 'Tall pillar', caixa: 4, porAto: 'Act II only', act: 2 } };
const MAXNIVEL = 6;   // (levels 4 to 6 open once something stands at level 3: the game box of Act I, a tile at level 3)
/* boxes: solid pieces standing on the floor with their top at a level: the platform of Act II (2) and the game box of Act I
   used as a platform (3) */
const CAIXAS = { platform: 2, gamebox: 3 };
/* the special tiles: the platform, the vault and the game box. They stand on the floor, never on other tiles; the one
   exception: the platform and the vault may stand on the game box of Act I (the platform's top then at 5, the vault's
   floor at 3). Nothing else of another level fits under them; over them, only above their top */
const ESPECIAIS = new Set(['platform', 'vault', 'gamebox']);
const ehEspecial = id => ESPECIAIS.has(id);
/* the game box under a platform or the vault (all its squares over the box), or null */
function caixaDoJogoSob(p, excetoSala, excetoIndice) {
  if (p.tile !== 'platform' && p.tile !== 'vault') return null; const cs = casasDaPeca(p);
  for (const [si, s] of projeto.salas.entries()) for (const [qi, q] of s.pecas.entries()) { if (q.tile !== 'gamebox' || (si === excetoSala && qi === excetoIndice) || q === p) continue;
    const S = new Set(casasDaPeca(q).map(c => c.join(','))); if (cs.every(c => S.has(c.join(',')))) return q; }
  return null;
}
/* the level a special tile takes where it stands: the game box 3; the platform 2, or 5 on the game box; the vault 0, or 3 */
function nivelEspecial(p, excetoSala, excetoIndice) {
  if (p.tile === 'gamebox') return CAIXAS.gamebox; const sob = caixaDoJogoSob(p, excetoSala, excetoIndice);
  if (p.tile === 'platform') return (sob ? CAIXAS.gamebox : 0) + CAIXAS.platform; if (p.tile === 'vault') return sob ? CAIXAS.gamebox : 0; return p.level || 0;
}
/* every special tile at the level of where it stands (after a move, a paste, an old map) */
function ajustarEspeciais() { try { projeto.salas.forEach((s, si) => s.pecas.forEach((q, qi) => { if (ehEspecial(q.tile)) { q.level = nivelEspecial(q, si, qi); q.pilares = []; } })); } catch { } }
/* the highest level open on the ribbon: 3, or 6 once something stands at level 3 or above */
const nivelMaximoLiberado = () => projeto.salas.some(s => s.pecas.some(q => !ehAlfombra(q.tile) && (q.level || 0) >= 3) || s.objetos.some(o => (o.level || 0) >= 3)) ? MAXNIVEL : 3;
/* tiles with walls: the vault (Act II) is a floor closed by a ring of squares at level 2 (its walls). Into it only by teleport
   or by a way at level 2 up to its walls (the heroes jump down inside); out of it by teleport or by a way up to the walls
   (a medium ladder), unless it ends the map. MUROS: the height of the walls over the floor of the tile */
const MUROS = { vault: 2 };
const MUROS_CACHE = new Map();   // (asked for every square of a vault, again and again: kept by tile, place and turn)
function murosDaPeca(q) {
  const h = MUROS[q && q.tile]; if (!h) return null; const ck = q.tile + '|' + q.pos[0] + ',' + q.pos[1] + '|' + (q.rot || 0) + '|' + (q.lado || '') + '|' + (q.flip ? 1 : 0);
  const ja = MUROS_CACHE.get(ck); if (ja) return ja; if (MUROS_CACHE.size > 5000) MUROS_CACHE.clear(); const r = murosDaPeca0(q, h); MUROS_CACHE.set(ck, r); return r;
}
function murosDaPeca0(q, h) {
  const cs = casasDaPeca(q); const S = new Set(cs.map(c => c.join(',')));
  const anel = cs.filter(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !S.has((x + dx) + ',' + (y + dy))));
  return { altura: h, casas: anel, chaves: new Set(anel.map(c => c.join(','))) };
}
/* the level of a square of a tile: its level, or its level plus the walls on the ring of a walled tile */
const nivelNaPeca = (q, x, y) => { const m = murosDaPeca(q); return (q.level || 0) + (m && m.chaves.has(x + ',' + y) ? m.altura : 0); };
const ehCaixa = id => !!CAIXAS[id];
const CAIXA_ALFOMBRAS = 3;                                                // underlay cards in the box for each pair of faces
/* each underlay card is printed on both sides: water / spikes and embers / fetid water share the same 3 cards */
const VERSO_ALFOMBRA = { 'underlay-water': 'underlay-spikes', 'underlay-spikes': 'underlay-water', 'underlay-embers': 'underlay-fetidwater', 'underlay-fetidwater': 'underlay-embers' };
const nomeAlfombra = id => varPeca(id) ? (varPeca(id).nome || 'Workshop underlay') : (id || '').replace('underlay-', '').replace('fetidwater', 'fetid water');
/* copies of an underlay: the game's share 3 double-sided cards; a workshop underlay has the copies you say (1 by default) */
const caixaAlfombra = id => varPeca(id) ? Math.max(1, +varPeca(id).copias || 1) : CAIXA_ALFOMBRAS;
/* cards of that pair on the map (this face and its back) */
const usoAlfombra = id => projeto.salas.reduce((k, sl) => k + sl.pecas.filter(p => p.tile === id || p.tile === VERSO_ALFOMBRA[id]).length, 0);
const OBJETOS = DADOS.interactables.filter(o => !['PillarShort', 'PillarTall', 'Pillar'].includes(o.id))
  .concat([{ id: 'PillarObj', name_en: 'Pillar (object)', w: 1, h: 1, act: 1, units: 4, objeto: true }]);
const OBJETO = Object.fromEntries(DADOS.interactables.concat([{ id: 'PillarObj', name_en: 'Pillar (object)', w: 1, h: 1 }]).map(o => [o.id, o]));
const CONDICOES = ['Dazed', 'Enfeebled', 'Afflicted', 'Slowed', 'Exposed', 'Doomed', 'Confused'];
const SONS = DADOS.sounds || {};
const CUTSCENES = DADOS.cutscenes || [];
/* the backgrounds of the story boxes: "no background" (0, the game's None) and those of the game */
const FUNDOS = [{ id: 0, name_en: 'No background' }].concat(DADOS.backgrounds || []);
/* the background that fits a place of the generator (a scene in a crypt is not on a road) */
const FUNDO_DO_TEMA = { masmorra: 4, cripta: 9, caverna: 4, fortaleza: 20, aldeia: 10, ermo: 1 };
const CAT = window.CATALOGO || { monstros: [], ativacoes: {}, itens: [], personagens: [], herois: [], loc: { en: {} } };
/* the "+" of the advanced items is a private glyph of the game's font (U+F5E2): shown here as ✚, written back on export */
const GLIFO_MAIS = '\uF5E2', MAIS = '✚';
const comMaisVisivel = t => typeof t === 'string' ? t.replace(/\s*\uF5E2\s*/g, ' ' + MAIS).replace(/\s+$/, '') : t;
const comGlifoDoJogo = t => typeof t === 'string' ? t.replace(/\s*✚/g, ' ' + GLIFO_MAIS) : t;
/* a few game monsters come with an untranslated key for a name (SQ2_NECROMANCER_NAME…): a readable name from the asset name */
const ehChaveCrua = t => typeof t === 'string' && ((/^[A-Z0-9_']+$/.test(t) && /[A-Z]/.test(t) && t.includes('_')) || /^[A-Za-z0-9]+(_[A-Za-z0-9]+)*_Name(_?\d+)?$/.test(t));
function nomeLegivel(n) {
  let s = String(n || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^UNUSED\s+/i, '').replace(/^(A\d)?S?Q\d+[A-Z]?\s*(-\s*)?/i, '').replace(/^\d+\s+/, '').replace(/^E\d+\s+/, '').replace(/^S\d+\s+/, '').replace(/^(Final\s+)?Boss\s+/i, '');
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase());
  return s || String(n || '');
}
/* 11 monsters of the game's collection with no text in any of the game's files (name and defense) and that no official quest
   puts in play (the quests use other models for these characters): out of every list to choose from; a map that already has
   one keeps it (the mod shows the model's name without the quest prefix) */
const MONSTROS_SEM_TEXTO = new Set(['ENEMY_BERSERKER_0', 'ENEMY_Q12_NE_KRUL_1', 'ENEMY_Q12_NE_KRUL_2', 'ENEMY_Q12_SPECTER', 'ENEMY_Q13_XENITH', 'ENEMY_Q4_HERMIT', 'ENEMY_Q4_IGOR', 'ENEMY_Q8_E2_BOSS_UTHUK', 'ENEMY_S2_GOLEM', 'ENEMY_S2_NECROMANCER', 'ENEMY_WOLF_S2']);
const monstroDeEscolha = z => !!z && !MONSTROS_SEM_TEXTO.has(z._id);
CAT.monstros.forEach(m => { if (ehChaveCrua(m.name_en)) { m._chave = m.name_en; m.name_en = (nomeLegivel(m._name) && tr(nomeLegivel(m._name))) || m.name_en; } if (ehChaveCrua(m.plural_en)) m.plural_en = m.name_en; });
(CAT.itens || []).forEach(i => { if (i.name_en) i.name_en = comMaisVisivel(i.name_en); });
const RETRATOS = window.RETRATOS || { monstros: {}, itens: {}, personagens: {} };
const TIPOS_MONSTRO = ['Berserker', 'Bandit', 'Zealot', 'Golem', 'Fae', 'Wolf', 'Specter', 'Wight', 'Harbinger', 'Centurion', 'Bloodsister', 'Doomcaller', 'Dragon', 'Salamander', 'Vampire', 'Reanimate', 'Legionnaire', 'Mercenary'];
const TAMANHOS = ['1×1 (small)', '2×1', '2×2 (large)', '3×2 (huge)'];
const TRACOS_MEC = ['Melee', 'Ranged', 'Striker', 'Tank', 'Support', 'Debuffer', 'Fast', 'Slow', 'Flying', 'Huge', 'Small'];
const TRACOS_TEMA = ['Intelligent', 'Creature', 'Undead', 'Dragonkind', 'Uthuk', 'Otherworldly', 'Construct', 'Wild', 'Fire', 'Cold', 'Civilized', 'Subterranean', 'Water', 'MagicUser', 'Raider', 'Mercenary', 'Stealthy', 'Incorporeal', 'Humanoid', 'UndeadFaction', 'UthukFaction', 'DragonFaction', 'BaronialFaction'];
const DANOS = ['Crush', 'Slash', 'Pierce', 'Ignos', 'Anemos', 'Aquos', 'Terros', 'Lumos', 'Umbros', 'Vigos', 'Mortos', 'Toxos', 'Fortunos'];
const ALCANCES = ['Melee', 'Near', 'Far'];
const CLASSES_ARMA = ['Hammer', 'Crossbow', 'Sword', 'Warhammer', 'Warbell', 'Spear', 'Wand', 'Staff', 'Gauntlet', 'ThrowingKnives', 'DualBlades', 'Bow', 'Rune'];   // in the game's order (WeaponClasses)
const RARIDADES = ['Invalid', 'Common', 'Uncommon', 'Gold'];
const LOOT = (CAT.loots || []).map(l => ({ id: l._id, name_en: l.name_en }));

/* workshop tiles and objects: made from scratch in the Workshop (id B_…). The shape is the set of squares the user
   clicked (`cells`, normalised to start at 0,0), the look a generic texture tinted with the chosen colour. They are
   the user's own physical pieces: a workshop tile follows the tile rules (once per room, reuse removes the earlier
   room, pillars in its sockets); a workshop object is an object like any other (texts, triggers, requirements). */
const ehDaOficina = id => !!id && String(id).startsWith('B_');
const varPeca = id => ehDaOficina(id) ? (oficina().pecas.find(x => x.id === id) || null) : null;
const varObj = id => ehDaOficina(id) ? (oficina().objetos.find(x => x.id === id) || null) : null;
const extensao = cells => { const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]); return [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1]; };
function defPeca(id) { const v = varPeca(id); if (v) { const cs = (v.cells && v.cells.length) ? v.cells : [[0, 0]]; const [w, h] = extensao(cs); return { id: v.id, kind: v.underlay ? 'underlay' : 'tile', cells: cs, w, h, act: 1, oficina: true }; } return ehDaOficina(id) ? null : (PECA[id] || null); }
function defObj(id) { const v = varObj(id); if (v) { const cs = (v.cells && v.cells.length) ? v.cells : [[0, 0]]; const [w, h] = extensao(cs); return { id: v.id, name_en: v.nome, cells: cs, w, h, act: 1, oficina: true }; } return ehDaOficina(id) ? null : (OBJETO[id] || null); }
const baseObj = id => ehDaOficina(id) ? null : id;                       // the game type (null for workshop objects)
/* a copy of a game object made in the Workshop (v.clone: the game type): on the board and in the game it is that piece;
   it differs in its default (texts and triggers), kept under its own id. Placed, it is the game type with o.molde */
const cloneDoJogo = id => { const v = varObj(id); return v && v.clone && OBJETO[v.clone] ? v : null; };
const tipoDoObjeto = id => cloneDoJogo(id)?.clone || id;
const chaveDoPadrao = o => (o && o.molde && cloneDoJogo(o.molde)) ? o.molde : o.type;
const nomeObj = id => varObj(id)?.nome || (OBJETO[id]?.name_en ? tr(OBJETO[id].name_en) : id);
const nomePeca = id => { const v = varPeca(id); if (v) return v.nome || 'Workshop tile'; if (ehDaOficina(id)) return '(deleted workshop tile)'; const t = PECA[id]; return t?.kind === 'underlay' ? id.replace('underlay-', '') : (id || '').toUpperCase(); };
const texturaDe = t => t ? (t.kind === 'underlay' ? t.id : t.floor) : null;
const numeroDaPeca = id => ehDaOficina(id) ? id : (id || '').replace(/[ab]$/i, '');
const ehAlfombra = id => defPeca(id)?.kind === 'underlay';
const ehTerreno = o => TERRENO.has(baseObj(o.type));
const ehTipo = (o, tipo) => baseObj(o.type) === tipo;
/* an archway, or the frame of the Act II bell used alone (the same frame: two feet and a passage of two squares) */
const TIPOS_ARCO = ['Archway', 'BellFrame'];
const ehArcoTipo = tipo => TIPOS_ARCO.includes(baseObj(tipo));
const ehArco = o => ehArcoTipo(o.type);
const PALETA_CORES = ['#8a7a66', '#6f6a60', '#9c8f7a', '#b3a58a', '#5b4a3a', '#7a5a3a', '#a0703f', '#c79a5a', '#4d6b34', '#6f8f45', '#3f5e5a', '#2f4f6f', '#4f6f9f', '#6a4f7f', '#7f3f4f', '#a8483a', '#c7c0b0', '#3a3a3f'];
/* unique within the session (a counter; before, two uids made in the same millisecond could meet, one time in tens of
   thousands, and a trigger then pointed at another's lists) and unlikely to meet across sessions (time and chance) */
let _uidN = 0;
const uid = () => 'g' + Date.now().toString(36) + (++_uidN).toString(36) + Math.random().toString(36).slice(2, 5).padEnd(3, '0');
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/\uF5E2/g, '✚').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = s => (s || 'map').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'map';
/* a deep copy, as JSON.parse(JSON.stringify(x)) makes it (undefined and functions left out, undefined in a list becomes null,
   NaN and Infinity become null, toJSON used), but the strings are shared, not copied: v237, a Workshop with pictures in data:
   URLs was copied as megabytes of text at each autosave */
function clone(x) {
  const pais = new Set();
  const c = (v, emLista) => {
    if (v === null) return null;
    const t = typeof v;
    if (t === 'string' || t === 'boolean') return v;
    if (t === 'number') return Number.isFinite(v) ? v : null;
    if (t === 'undefined' || t === 'function' || t === 'symbol') return emLista ? null : undefined;
    if (t === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
    if (typeof v.toJSON === 'function') return c(v.toJSON(), emLista);
    if (pais.has(v)) throw new TypeError('Converting circular structure to JSON');
    pais.add(v);
    let r;
    if (Array.isArray(v)) { r = new Array(v.length); for (let i = 0; i < v.length; i++) r[i] = c(v[i], true); }
    else { r = {}; for (const k of Object.keys(v)) { const y = c(v[k], false); if (y !== undefined) r[k] = y; } }
    pais.delete(v);
    return r;
  };
  const r = c(x, false);
  return r === undefined ? JSON.parse(JSON.stringify(x === undefined ? null : x)) : r;
}
/* runs fn with map p as the map on screen (what reads "projeto" sees p), and puts the map on screen back */
function comProjeto(p, fn) { const antes = projeto; projeto = p; try { return fn(); } finally { projeto = antes; } }

// ------------------------------------------------------------ state
function projetoNovo() {
  // (lingua: a do editor quando o mapa foi criado; vai no arquivo como meta.language e no acervo como a bandeira)
  return { meta: { name: '', author: '', intro: '', description: '', music: '', background: '', scene: '', finalMission: { tipo: 'defeat_all', texto: '', rodadas: 8 }, limite: 0, lingua: typeof IDIOMA === 'string' ? IDIOMA : 'en' },
    reserva: [], bestiario: oficinaVazia(), salas: [], campanha: { chegada: '', conclusao: '' } };
}
const oficinaVazia = () => ({ monstros: [], personagens: [], itens: [], pecas: [], objetos: [], herois: [], armas: [], maos: [], receitas: [] });
const vista3d = { on: false, yaw: -0.6, pitch: 0.95, zoom: 1, px: 0, py: 0 };   // the 3D view (tres.js)
let projeto = projetoNovo();
let campanha = null;             // {meta, intro, missoes[], nos[], dialogos[], bestiario}
let missaoAtual = 0;
let salaAtual = -1;
let ferramenta = null;           // null (select) | peca | heroi | objeto | inimigo | pilar | apagar
let pecaEscolhida = PECAS[0].id, rot = 0, objetoEscolhido = 'Door', inimigoEscolhido = null, pilarEscolhido = 'PillarShort';
let nivel = 0;                   // level for new tiles (and the base level of staircases)
let sel = null;                  // {tipo:'peca'|'objeto'|'inimigo'|'heroi', sala, i, [g, obj]}
let escolha = null;              // pending click on the map: {modo, g, si, texto, cb, repetir}
let gatAberto = -1;
const vista = { zoom: 1, px: 60, py: 40 };
/* editing the default of a copy of a game object on a board of its own (fichas.js): the work waits aside, nothing is saved */
let EDITANDO_PADRAO = null;
const C = 30;
const IMG = {};

let avisoT;
function aviso(t, longo) { const a = $('#aviso'); a.textContent = t; a.classList.add('mostra'); clearTimeout(avisoT); if (!longo) avisoT = setTimeout(() => a.classList.remove('mostra'), 3000); }
function avisoLongo(t, ms) { aviso(t, true); avisoT = setTimeout(() => $('#aviso').classList.remove('mostra'), ms || 7000); }

/* the Workshop: one for everything (every map and campaign), kept in a package of its own (in the app, a file in Pacotes;
   in a browser, in the browser). The maps and campaigns still hold it under the old key `bestiario`: each of them points
   to this same one, and a Workshop that came inside an older work (or a file opened) joins it (what it has that this one
   lacks, by id). The entries of the other packages of the folder are in it too, marked `_doPacote` (read only). */
let _oficina = null;
const LISTAS_DA_OFICINA = ['monstros', 'personagens', 'itens', 'pecas', 'objetos', 'herois', 'armas', 'maos', 'receitas', 'facanhas', 'poolFacanhas', 'pericias', 'categoriasArmas'];
function absorverOficina(b) {
  const g = _oficina; if (!b || b === g || typeof b !== 'object') return 0; let n = 0;
  LISTAS_DA_OFICINA.forEach(k => { const l = b[k]; if (!Array.isArray(l)) return; const d = g[k] = g[k] || [];
    l.forEach(x => { if (x && typeof x === 'object') { if (x.id == null || d.some(y => y && y.id === x.id)) return; d.push(x); n++; } else if (!d.includes(x)) d.push(x); }); });
  ['armasCat', 'padroes'].forEach(k => { const o = b[k]; if (!o || typeof o !== 'object' || Array.isArray(o)) return; g[k] = g[k] && typeof g[k] === 'object' && !Array.isArray(g[k]) ? g[k] : {}; Object.entries(o).forEach(([c, v]) => { if (!(c in g[k])) g[k][c] = v; }); });
  return n;
}
/* ------------------------------------------------------------ the party of a work
   Which hero of the roster plays which of the six profiles belongs to the map (or the campaign), not to the Workshop, which
   is one for every work: w.equipe = {HERO_X: id of the roster hero}. On a hero, h.perfil reads and writes it (an accessor,
   left out of the files). A Workshop of before (inside a work, or a package) brings its heroes with perfil written in them:
   that goes into the party of the work it came with, or of the work on screen. */
function equipeDe(w) { if (!w) return {}; if (!w.equipe || typeof w.equipe !== 'object' || Array.isArray(w.equipe)) w.equipe = {}; return w.equipe; }
const equipeAtual = () => equipeDe(campanha || projeto);
const _heroisPreparados = new WeakSet();
function migrarEquipe(p, b) {
  const alvo = campanha && (p === campanha || (campanha.missoes || []).includes(p)) ? campanha : p;
  (b && b.herois || []).forEach(h => { const d = h && Object.getOwnPropertyDescriptor(h, 'perfil'); if (!d || !('value' in d)) return; const v = d.value; delete h.perfil; if (v && h.novo) { const eq = equipeDe(alvo); if (!eq[v] && !Object.values(eq).includes(h.id)) eq[v] = h.id; } });
}
function prepararHerois(b) {
  (b.herois || []).forEach(h => {
    if (!h || typeof h !== 'object' || _heroisPreparados.has(h)) return;
    const d = Object.getOwnPropertyDescriptor(h, 'perfil');
    if (d && 'value' in d) { const v = d.value; delete h.perfil; if (v && h.novo) { const eq = equipeAtual(); if (!eq[v] && !Object.values(eq).includes(h.id)) eq[v] = h.id; } }
    Object.defineProperty(h, 'perfil', { configurable: true, enumerable: false,
      get() { const eq = equipeAtual(); return Object.keys(eq).find(k => eq[k] === h.id) || undefined; },
      set(v) { const eq = equipeAtual(); Object.keys(eq).forEach(k => { if (eq[k] === h.id) delete eq[k]; }); if (v) eq[v] = h.id; } });
    _heroisPreparados.add(h);
  });
}
/* the Workshop becomes b (the undo, Ctrl+Z, brings back the one of its picture) */
function trocarOficina(b) {
  if (!b || typeof b !== 'object') return; const velha = _oficina;
  // (the works pointing to the one of before point to b: nothing of the old one joins it)
  if (velha) for (const p of [projeto, campanha, ...(campanha?.missoes || [])]) if (p && p.bestiario === velha) p.bestiario = b;
  _oficina = b; oficina();
}
function oficina() {
  if (!_oficina) _oficina = oficinaVazia();
  for (const p of [projeto, campanha, ...(campanha?.missoes || [])]) if (p && p.bestiario !== _oficina) { if (p.bestiario) { migrarEquipe(p, p.bestiario); absorverOficina(p.bestiario); } p.bestiario = _oficina; }
  const b = _oficina; prepararHerois(b); ['monstros', 'personagens', 'itens', 'pecas', 'objetos', 'herois', 'armas', 'maos', 'receitas', 'facanhas', 'poolFacanhas', 'pericias', 'categoriasArmas'].forEach(k => { b[k] = b[k] || []; }); if (!b.armasCat || typeof b.armasCat !== 'object' || Array.isArray(b.armasCat)) b.armasCat = {}; if (!b.padroes || typeof b.padroes !== 'object' || Array.isArray(b.padroes)) b.padroes = {}; nomesNaLinguaDoJogo(b); return b; }
const bestiario = oficina;
const MONSTROS = () => bestiario().monstros;
const PERSONAGENS_B = () => bestiario().personagens;
const ITENS_B = () => bestiario().itens;
/* custom music of the maps: the files live in the browser (IndexedDB) and go next to the map files when exported */
const AUDIOS = {};
/* (in the app the file goes next to one's Workshop too, in its folder of Pacotes: the media of the Workshop are files) */
const nomeDeMidiaValido = n => /^[^/\\:*?"<>|]+$/.test(String(n || ''));
async function guardarAudio(nome, blob) { AUDIOS[nome] = blob; await Config.guardarBlob('audio:' + nome, blob); if (Arquivos.ativo && MEU_PACOTE.id && nomeDeMidiaValido(nome)) { try { await Arquivos.gravar('Pacotes/' + MEU_PACOTE.id + '/' + nome, blob); } catch (e) { console.warn('media not written', e); } } }
/* a media file the browser does not hold: in the app, from the folder of one's Workshop or of another package */
async function audioDaPasta(n) {
  if (!Arquivos.ativo || !nomeDeMidiaValido(n)) return null;
  for (const pasta of [MEU_PACOTE.id, ...PACOTES_DA_PASTA.map(p => p.pasta)].filter(Boolean)) { try { const b = await Arquivos.ler('Pacotes/' + pasta + '/' + n, 'blob'); if (b && b.size) return b; } catch { } }
  return null;
}
async function carregarAudios() {
  const nomes = new Set(); const ver = p => { if (p && p.meta && p.meta.musica && p.meta.musica.arquivo) nomes.add(p.meta.musica.arquivo); };
  ver(projeto); (campanha && campanha.missoes || []).forEach(ver);
  // videos: boxes of the scenes and "Play a video" triggers
  (campanha?.dialogos || []).forEach(d => { if (d.video?.arquivo) nomes.add(d.video.arquivo); });
  [campanha?.meta?.mapaProprio, campanha?.meta?.cidade].forEach(a => { if (a?.arquivo) nomes.add(a.arquivo); });
  [projeto?.bestiario, campanha?.bestiario].forEach(b => (b?.objetos || []).forEach(v => { if (v.modelo?.arquivo) nomes.add(v.modelo.arquivo); }));
  [projeto?.bestiario, campanha?.bestiario].forEach(b => (b?.monstros || []).forEach(m => { if (m.modelo?.arquivo) nomes.add(m.modelo.arquivo); Object.values(m.sons?.arquivos || {}).forEach(a => a?.arquivo && nomes.add(a.arquivo)); }));
  [projeto, ...(campanha?.missoes || [])].forEach(p => (p?.salas || []).forEach(s => donosDaSala(s).forEach(({ o }) => todosGatilhos(o).forEach(g => { if (g.video?.arquivo) nomes.add(g.video.arquivo); if (g.som?.arquivo) nomes.add(g.som.arquivo); }))));
  for (const n of nomes) if (!AUDIOS[n]) { try { const b = (await Config.lerBlob('audio:' + n)) || (await audioDaPasta(n)); if (b) AUDIOS[n] = b; } catch { } }
}
/* the music files a set of exported map documents needs: [{nome, texto: Blob|null, sub}] */
/* the media files (music, videos of "Play a video") a set of exported map documents needs: [{nome, texto: Blob|null, sub}] */
/* the media files the actions of a map use (videos and own sounds), also inside branches and answers */
const videosDoMapa = d => { const r = []; const anda = x => { if (Array.isArray(x)) x.forEach(anda); else if (x && typeof x === 'object') { if ((x.id === 'playVideo' || x.id === 'playSound') && x.params && x.params.file) r.push(x.params.file); Object.values(x).forEach(anda); } }; anda(d && d.triggers); return r; };
const musicasDosMapas = (docs, sub) => [...new Set(docs.flatMap(d => [d && d.meta && d.meta.music && d.meta.music.file, ...videosDoMapa(d), ...((d && d.custom && d.custom.objects) || []).map(o => o.model), ...((d && d.custom && d.custom.enemies) || []).flatMap(e => [e.model, ...(e.sounds && e.sounds.mode === 'files' ? ['spawn', 'attack', 'defend', 'defeat'].map(k => e.sounds[k]) : [])])]).filter(Boolean))].map(nome => ({ nome, texto: AUDIOS[nome] || null, sub }));
/* the videos of the scenes of a campaign (files next to the .dcamp) */
const videosDasCenas = (dcamp, sub) => [...new Set([...(dcamp?.dialogues || []).filter(d => d.type === 'video' && d.video).map(d => d.video), dcamp?.meta?.worldMap?.file, dcamp?.meta?.city?.file].filter(Boolean))].map(nome => ({ nome, texto: AUDIOS[nome] || null, sub }));
const monstro = id => MONSTROS().find(m => m.id === id) || null;
/* a large monster (the centurion, the bosses at the end of the acts): it takes 2x2 spaces, its position the top-left one */
const ehGrande = id => { const m = monstro(id); return !!m && ((m.size || 0) >= 2 || (m.mec || []).includes('Huge')); };
/* "Balanced from enemy pool": a space of the room the game fills by its own rule for random spawns (the room's spawn
   pool, the map's tier range, points from the number of heroes). See regraDoBalanceio and simularBalanceio. */
const POOL_ID = '@pool';
const ehPool = id => id === POOL_ID;
/* its picture: the Enemy tool's ghost, light on the blue of the balanced spaces (built on first use: the glyphs live in desenho.js) */
let _iconePool = null;
const iconePool = () => _iconePool || (_iconePool = icone('Enemy', '#f3cf8f', '#22364c'));
const nomeIni = id => ehPool(id) ? L2('Balanced from enemy pool', 'Balanceado da reserva de inimigos') : monstro(id)?.nome || id || '?';
const runaDoItem = id => typeof id === 'string' && id.startsWith('RUNA:') ? (oficina().armas || []).find(a => a.runa && a.id === id.slice(5)) : null;
const receitaDoItem = id => typeof id === 'string' && id.startsWith('RECEITA:') ? (oficina().receitas || []).find(r => r.id === id.slice(8)) : null;
const nomeItem = id => receitaDoItem(id) ? nomeReceita(receitaDoItem(id)) : runaDoItem(id) ? 'Rune: ' + (runaDoItem(id).nova?.nome || 'New rune') : ITENS_B().find(i => i.id === id)?.nome || LOOT.find(l => l.id === id)?.name_en || id;
/* the items that may be handed out: only the workshop's (item 4 of the 24/09 batch). Old projects may still point at game loot ids: those are kept but flagged */
const itemDaOficina = id => !!ITENS_B().find(i => i.id === id) || !!runaDoItem(id) || !!receitaDoItem(id);
const opcoesItens = atual => ITENS_B().map(i => `<option value="${esc(i.id)}" ${atual === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('') + ((oficina().armas || []).some(a => a.runa) ? `<optgroup label="Runes of the workshop (the weapon comes with its rune)">${oficina().armas.filter(a => a.runa).map(a => `<option value="RUNA:${esc(a.id)}" ${atual === 'RUNA:' + a.id ? 'selected' : ''}>${esc(nomeItem('RUNA:' + a.id))}</option>`).join('')}</optgroup>` : '') + ((oficina().receitas || []).length ? `<optgroup label="Recipes of the workshop (the party learns it)">${oficina().receitas.map(r => `<option value="RECEITA:${esc(r.id)}" ${atual === 'RECEITA:' + r.id ? 'selected' : ''}>${esc(nomeReceita(r))}</option>`).join('')}</optgroup>` : '') + (atual && !itemDaOficina(atual) ? `<option value="${esc(atual)}" selected>${esc(nomeItem(atual))} (not in the workshop!)</option>` : '');
/* heroes drawn at random from the party when a scene plays (the mod picks different ones each time): @hero1 to @hero4;
   {hero1} to {hero4} in the text become their names; with fewer heroes in the party, hero 3 repeats hero 1 and hero 4 hero 2. @actor is the hero who used the object that plays the scene
   ({actor} in the text); a scene played by nothing a hero used takes a random one */
const HEROIS_SORTEADOS = [{ id: '@hero1', nome: 'Random hero 1' }, { id: '@hero2', nome: 'Random hero 2' }, { id: '@hero3', nome: 'Random hero 3 (or 1)' }, { id: '@hero4', nome: 'Random hero 4 (or 2)' }, { id: '@actor', nome: 'The hero who used the object' }];
/* the heroes of the party in the campaign scenes (between maps): hero 1 is the first of the party, hero 2 the second...;
   with fewer heroes, hero 3 speaks as hero 1 and hero 4 as hero 2 (3 heroes: hero 4 as hero 1) */
const HEROIS_DA_CAMPANHA = [{ id: '@hero1', nome: 'Hero 1 of the party' }, { id: '@hero2', nome: 'Hero 2 of the party' }, { id: '@hero3', nome: 'Hero 3 (or hero 1)' }, { id: '@hero4', nome: 'Hero 4 (or hero 2)' }];
const nomePersonagem = id => { const s = (typeof telaCampanhaAberta === 'function' && telaCampanhaAberta() ? HEROIS_DA_CAMPANHA : HEROIS_SORTEADOS).find(h => h.id === id) || HEROIS_SORTEADOS.find(h => h.id === id); if (s) return tr(s.nome); return PERSONAGENS_B().find(p => p.id === id)?.nome || id || ''; };
/* v236: a big picture kept as a data: URL (a portrait, a tile's texture, a package's art) goes into the page as a short blob:
   URL, made once per picture: the lists of the Workshop put a hundred of them in at each click, and the page parsed megabytes
   of text each time. Only for showing: what is kept and exported stays the data: URL. */
const _urlsLeves = new Map();
function imgLeve(src) {
  if (typeof src !== 'string' || src.length < 8192 || !src.startsWith('data:')) return src;
  let u = _urlsLeves.get(src); if (u) return u;
  try { const i = src.indexOf(','), meta = src.slice(5, i), tipo = meta.split(';')[0] || 'application/octet-stream';
    let corpo; if (/;base64/i.test(meta)) { const b64 = src.slice(i + 1);
      if (typeof Uint8Array.fromBase64 === 'function') corpo = Uint8Array.fromBase64(b64);   // (native: much faster)
      else { const bin = atob(b64); corpo = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) corpo[k] = bin.charCodeAt(k); } }
    else corpo = decodeURIComponent(src.slice(i + 1));
    u = URL.createObjectURL(new Blob([corpo], { type: tipo })); } catch { u = src; }
  _urlsLeves.set(src, u); return u;
}
/* ------------------------------------------------------------ v239: pictures loaded apart, and unloaded
   As a web page does it: a picture goes into the page as a mark (data-leve) with an empty picture in its place; it is
   loaded (its blob: URL made) only when it comes near the screen, and a picture in a screen that is hidden never loads.
   When the tab changes, the pictures off the screen go back to the empty picture and their blob: URLs are freed (the
   browser drops their memory); coming back, they load again. */
const VAZIA = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const _fontesTardias = new Map();   // mark -> picture (the data: URL)
let _marcaTardia = 0;
/* the src of an <img> of a template: a big picture comes later; any other is itself */
function imgTardia(src) {
  if (typeof src !== 'string' || typeof IntersectionObserver !== 'function' || !(ehImg(src) || (src.length >= 8192 && src.startsWith('data:')))) return 'src="' + (src || '') + '"';
  const k = 'l' + (++_marcaTardia); _fontesTardias.set(k, src);
  return 'src="' + VAZIA + '" data-leve="' + k + '"';
}
/* (a screen over the whole page, the Workshop or the campaign: what is under it is not on screen) */
const telaPorCima = () => { for (const id of ['telaCampanha', 'telaFichas']) { const t = document.getElementById(id); if (t && !t.hidden) return t; } return null; };
const debaixoDaTela = (i, t = telaPorCima()) => !!t && !t.contains(i) && !i.closest('.modal');
const _vistaTardia = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; const i = e.target; if (debaixoDaTela(i)) return; _vistaTardia.unobserve(i);
  const f = _fontesTardias.get(i.dataset.leve); if (f) i.src = ehImg(f) ? urlLeve(f) : imgLeve(f);
}), { rootMargin: '600px 600px' }) : null;
function vigiarTardias(raiz) { if (!_vistaTardia) return; (raiz.matches?.('img[data-leve]') ? [raiz] : []).concat([...(raiz.querySelectorAll ? raiz.querySelectorAll('img[data-leve]') : [])]).forEach(i => { if (i.getAttribute('src') === VAZIA) _vistaTardia.observe(i); }); }
if (_vistaTardia && typeof MutationObserver === 'function') {
  let pend = [], agendado = false;
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) pend.push(n);
    if (!agendado && pend.length) { agendado = true; queueMicrotask(() => { agendado = false; const p = pend; pend = []; p.forEach(n => { if (n.isConnected) vigiarTardias(n); }); }); }
  }).observe(document.documentElement, { childList: true, subtree: true });
}
/* the tab changed: the pictures that are not on screen unloaded (blob: URLs freed), the marks of pictures gone forgotten */
let _descarregarPedido = 0;
function descarregarImagens() {
  if (_descarregarPedido) return; const fazer = () => { _descarregarPedido = 0; descarregarAgora(); };
  _descarregarPedido = typeof requestIdleCallback === 'function' ? requestIdleCallback(fazer, { timeout: 1500 }) : setTimeout(fazer, 300);
}
function descarregarAgora() {
  const naTela = new Set(), marcas = new Set(), alto = innerHeight, largo = innerWidth, topo = telaPorCima();
  // (v240: every position read first, then the changes made: a read after a change made the browser lay the page out again,
  // once per picture)
  const imgs = [...document.querySelectorAll('img[data-leve]')];
  const vis = imgs.map(i => { const r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > -alto && r.top < 2 * alto && r.right > -largo && r.left < 2 * largo && !debaixoDaTela(i, topo); });
  imgs.forEach((i, k) => { marcas.add(i.dataset.leve); const src = i.getAttribute('src');
    if (vis[k]) { if (src !== VAZIA) naTela.add(src); }
    else if (src !== VAZIA) i.src = VAZIA;
    // (the empty ones looked at again: the screen over them may have closed)
    if (_vistaTardia && (vis[k] ? src === VAZIA : true)) { _vistaTardia.unobserve(i); _vistaTardia.observe(i); } });
  // (the blob: URLs still on screen, of these or of any other picture of the page, stay)
  document.querySelectorAll('img[src^="blob:"]').forEach(i => naTela.add(i.getAttribute('src')));
  for (const [f, u] of _urlsLeves) if (u.startsWith('blob:') && !naTela.has(u)) { URL.revokeObjectURL(u); _urlsLeves.delete(f); }
  for (const [f, u] of _urlsImg) if (!naTela.has(u)) { URL.revokeObjectURL(u); _urlsImg.delete(f); }
  for (const k of _fontesTardias.keys()) if (!marcas.has(k)) _fontesTardias.delete(k);
}
/* ------------------------------------------------------------ v238: the light copies of the v238/v239 editor
   (v240: the pictures are files now, imagens.js. What stays here reads a work kept by those versions: a light copy
   "data:image/webp;leve=<hash>;…" finds its original in the database, by the hash, when it goes out to a file or into
   the store) */
const LEVE = 'data:image/webp;leve=';
const _originais = new Map();
const ehLeve = s => typeof s === 'string' && s.startsWith(LEVE);
const hashDaLeve = s => s.slice(LEVE.length, s.indexOf(';', LEVE.length));
/* the original of a picture (the light one gives its original back; any other string is itself) */
function original(s) { if (!ehLeve(s)) return s; const h = hashDaLeve(s), o = _originais.get(h); if (o) return o; _faltamOriginais.add(h); return s; }
/* (the light copies whose original was asked for and was not in memory: read from the database, and the text made again) */
const _faltamOriginais = new Set();
const trocarOriginais = (k, v) => ehLeve(v) ? original(v) : v;
/* the text of what goes out to a file: the originals in place of the light copies */
const jsonOriginal = (x, esp) => JSON.stringify(x, trocarOriginais, esp);
async function buscarFaltantes() {
  if (!_faltamOriginais.size || typeof Config === 'undefined') return false;
  const hs = [..._faltamOriginais]; _faltamOriginais.clear(); let veio = false;
  try { const m = await Config.lerVarios(hs.map(h => 'orig:' + h)); m.forEach((v, k) => { if (v) { _originais.set(k.slice(5), v); veio = true; } }); } catch { }
  return veio;
}
/* the text of a file that goes out, with the originals (read from the database when some were missing) */
async function textoOriginal(x, esp) { _faltamOriginais.clear(); let t = jsonOriginal(x, esp); if (_faltamOriginais.size && await buscarFaltantes()) t = jsonOriginal(x, esp); return t; }
async function originaisProntos() { await buscarFaltantes(); }

/* v240: a long list or grid drawn in parts, as a web page does: the first ones (and up to the one chosen), then the next
   ones when the end of what was drawn comes near the screen. criar(x, i) gives the element (or nothing) */
const LOTE_DA_LISTA = 150;
function aosPoucos(alvo, itens, criar, ate) {
  let i = 0;
  const passo = n => {
    const frag = document.createDocumentFragment();
    for (; i < itens.length && n > 0; i++, n--) { const e = criar(itens[i], i); if (e) frag.appendChild(e); }
    alvo.appendChild(frag);
    if (i < itens.length) {
      const mais = document.createElement('div'); mais.className = 'maisF'; mais.textContent = '…'; alvo.appendChild(mais);
      if (typeof IntersectionObserver !== 'function') { mais.remove(); passo(itens.length); return; }
      const io = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return; io.disconnect(); mais.remove(); passo(LOTE_DA_LISTA); }, { rootMargin: '800px 800px' });
      io.observe(mais);
    }
  };
  passo(Math.max(LOTE_DA_LISTA, (ate || 0) + 30));
}
function retratoDoMonstro(m) { if (!m) return ''; if (m.retrato) return m.retrato; const b = chaveArte(m.textureTab); return RETRATOS.monstros[b] || ''; }
/* the board card of a monster: a picture of its own, or the monster's picture */
function standeeDoMonstro(m) { return (m && (m.standee || m.arte)) || ''; }
function retratoDoPersonagem(p) { if (!p) return ''; if (p.retrato) return p.retrato; return RETRATOS.personagens[p.rostoBase] || ''; }
function retratoDoItem(i) { if (!i) return ''; if (i.retrato) return i.retrato; return RETRATOS.itens[i.imagemBase] || ''; }
const iconeIni = id => ehPool(id) ? iconePool() : retratoDoMonstro(monstro(id));
/* the game's rule, as the map sets it (Map setup): tier range and campaign progression (the game's quest 1 uses 20) */
const regraDoBalanceio = (p = projeto) => ({ min: 1, max: 3, progresso: 20, ...(p.balanceio || {}) });
const CUSTO_TIER = [10, 15, 20, 30, 40, 55, 70, 90, 120, 160, 240, 320];
const custoTier = t => CUSTO_TIER[Math.max(0, Math.min(CUSTO_TIER.length - 1, t - 1))];
const vagasPoolDaSala = s => (s.inimigos || []).filter(e => ehPool(e.enemy)).length;
const intensidadeDoGatilho = g => Math.max(1, Math.min(10, g.intensidade || (g.cells || []).length || 1));
/* hand-placed monsters: the room's intensity (default: how many of them there are) and the tiers the game's points
   would buy each one for 1–2, 3 and 4 heroes, every step above the one before (like the game's bosses: 7, 8, 9) */
const monstrosComuns = lista => Math.max(1, (lista || []).filter(e => !ehPool(e.enemy)).length);
const intensidadeParaMonstros = (s, lista) => Math.max(1, Math.min(10, s.intensidade || monstrosComuns(lista)));
function tiersPelaRegra(m, intensidade, divisao, p = projeto) {
  const r = regraDoBalanceio(p); const ts = [...new Set((m?.tiers || []).map(t => t.tier))].sort((a, b) => a - b); if (!ts.length) return null;
  const tierPara = h => { const pts = Math.round(intensidade * 0.1 * Math.floor(h * 1.5) * Math.max(1, r.progresso)) / Math.max(1, divisao); const cabem = ts.filter(t => custoTier(t) <= pts); return cabem.length ? cabem[cabem.length - 1] : ts[0]; };
  const acima = t => ts.find(x => x > t) ?? t;
  const t2 = tierPara(2), t3 = Math.max(tierPara(3), acima(t2)), t4 = Math.max(tierPara(4), acima(t3));
  return [t2, t2, t3, t4];
}
const intensidadeDaSala = s => Math.max(1, Math.min(10, s.intensidade || vagasPoolDaSala(s) || 1));
/* what the game would put in the balanced spaces of a room (without the leftover points of earlier spawns): the tier
   and how many monsters; which monster of the pool is drawn at the table */
function simularBalanceio(s, si, herois, p = projeto) { return simularVagas(vagasPoolDaSala(s), intensidadeDaSala(s), poolDe(p, si), herois, p, (s.inimigos || []).filter(e => !ehPool(e.enemy)).map(e => monstro(e.enemy)?.tipo).filter(Boolean)); }
/* the miniatures of each monster type in the player's boxes (the mod reads them from the game; null while the game data
   is older than that) */
const FIGURAS = JOGO.figuras || null;
const figurasDoTipo = t => FIGURAS ? (FIGURAS[t] || 0) : null;
/* the game's rule over a group of balanced spaces (the room's, or a "Spawn from the pool" trigger's): all the spaces
   of the group share one budget of points, so they decide together how many monsters enter and how strong; like the
   game, a monster enters only while there is a free miniature of its type (`ocupadas`: types already on the table) */
function simularVagas(vagas, intensidade, poolIds, herois, p = projeto, ocupadas = []) {
  const r = regraDoBalanceio(p); const min = Math.max(1, Math.min(10, r.min)), max = Math.max(min, Math.min(10, r.max));
  const pool = poolIds.map(monstro).filter(m => m && (m.tiers || []).length);
  if (!pool.length || !vagas) return { n: 0, tier: 0, pontos: 0, pool: pool.length };
  const fig = {}; pool.forEach(m => { const f = figurasDoTipo(m.tipo); fig[m.tipo] = f === null ? Infinity : f; }); ocupadas.forEach(t => { if (t in fig) fig[t]--; });
  const livre = m => fig[m.tipo] > 0; let limitado = false;
  let pontos = Math.round(Math.max(1, Math.min(10, intensidade)) * 0.1 * Math.floor(herois * 1.5) * Math.max(1, r.progresso)); const inicio = pontos;
  const tem = t => pool.some(m => livre(m) && m.tiers.some(x => x.tier === t)); let n = 0, tier = max;
  while (n < Math.min(5, vagas) && pontos >= custoTier(min)) { let t = tier; while (t >= min && (custoTier(t) > pontos || !tem(t))) t--; if (t < min) { limitado = !pool.some(livre); break; } tier = t; pontos -= custoTier(t); n++;
    const m = pool.filter(x => livre(x) && x.tiers.some(y => y.tier === t)).sort((a, b) => fig[b.tipo] - fig[a.tipo])[0]; fig[m.tipo]--; }
  if (!n) { if (!pool.some(livre)) return { n: 0, tier: 0, pontos: inicio, semFiguras: true, pool: pool.length };
    const menores = pool.filter(livre).map(m => { const ts = m.tiers.map(x => x.tier).filter(t => t >= min && t <= max); return ts.length ? Math.min(...ts) : Math.min(...m.tiers.map(x => x.tier)); }); return { n: 1, tier: Math.min(...menores), pontos: inicio, curto: true, pool: pool.length }; }
  return { n, tier, pontos: inicio, pool: pool.length, limitado };
}
/* the table "what the game would do" for 1 to 4 heroes */
function tabelaBalanceio(vagas, intensidade, poolIds) {
  return `<table class="simBal"><tbody>${[1, 2, 3, 4].map(h => { const x = simularVagas(vagas, intensidade, poolIds, h); return `<tr><td>${h} hero${h > 1 ? 'es' : ''}</td><td>${x.pontos} pts</td><td>${x.n ? x.n + ' monster' + (x.n > 1 ? 's' : '') + ', tier ' + x.tier + (x.curto ? ' (too few points: the minimum)' : '') + (x.limitado ? ' (no more miniatures)' : '') : x.semFiguras ? 'none: no free miniature' : '—'}</td></tr>`; }).join('')}</tbody></table>`;
}

// ------------------------------------------------------------ geometry
function girar([x, y], r) { r = ((r % 360) + 360) % 360; if (r === 90) return [-y, x]; if (r === 180) return [-x, -y]; if (r === 270) return [y, -x]; return [x, y]; }
function casasDaPeca(p) { const t = defPeca(p.tile); if (!t) return []; return t.cells.map(c => { const [x, y] = girar(c, p.rot || 0); return [p.pos[0] + x, p.pos[1] + y]; }); }
function tamanhoDoObjeto(o) { const d = defObj(o.type) || { w: 1, h: 1 }; let w = d.w || 1, h = d.h || 1; if ((o.rot || 0) % 180 !== 0) [w, h] = [h, w]; return [w, h]; }
/* the squares of an object: a rectangle for the game objects; the clicked shape for a workshop object, turned and put back at 0,0 (pos = top-left of its box) */
function casasDoObjeto(o) {
  const d = defObj(o.type);
  if (d && d.cells) { const g = d.cells.map(c => girar(c, o.rot || 0)); const x0 = Math.min(...g.map(c => c[0])), y0 = Math.min(...g.map(c => c[1])); return g.map(([x, y]) => [o.pos[0] + x - x0, o.pos[1] + y - y0]); }
  const [w, h] = tamanhoDoObjeto(o); const r = []; for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) r.push([o.pos[0] + i, o.pos[1] + j]); return r;
}
const cantosDaPeca = p => { const s = new Set(); casasDaPeca(p).forEach(([x, y]) => { s.add(x + ',' + y); s.add((x + 1) + ',' + y); s.add(x + ',' + (y + 1)); s.add((x + 1) + ',' + (y + 1)); }); return s; };
/* the floor: for each square, the room and the level of the highest tile (or staircase/bridge) covering it */
function chao() {
  const m = new Map();
  const por = (x, y, si, lv, extra) => { const k = x + ',' + y; const a = m.get(k); if (!a || lv > a.nivel) m.set(k, { sala: si, nivel: lv, ...extra }); };
  projeto.salas.forEach((s, si) => {
    s.pecas.forEach((p, pi) => { if (ehAlfombra(p.tile)) return; casasDaPeca(p).forEach(([x, y]) => por(x, y, si, nivelNaPeca(p, x, y), { peca: pi })); });
    s.objetos.forEach((o, oi) => { if (!ehTerreno(o)) return; casasDoObjeto(o).forEach(([x, y]) => por(x, y, si, o.level || 0, { terreno: oi })); });
  });
  // an underlay is floor where no tile covers it (as on the table: water, embers… showing beside the tiles)
  projeto.salas.forEach((s, si) => s.pecas.forEach((p, pi) => { if (!ehAlfombra(p.tile)) return; casasDaPeca(p).forEach(([x, y]) => { if (!m.has(x + ',' + y)) m.set(x + ',' + y, { sala: si, nivel: 0, peca: pi, alfombra: true }); }); }));
  return m;
}
function casaDoChao(x, y) { return chao().get(x + ',' + y) || null; }
function salaDaCasa(x, y) { const c = casaDoChao(x, y); return c ? c.sala : -1; }
/* the room whose floor is at level lv on square x,y (a tile of that level, or a staircase/bridge reaching it), or -1 */
function salaNoNivel(x, y, lv) {
  let r = -1;
  projeto.salas.forEach((s, si) => {
    if (r >= 0) return;
    if (s.pecas.some(p => !ehAlfombra(p.tile) && casasDaPeca(p).some(c => c[0] === x && c[1] === y) && nivelNaPeca(p, x, y) === lv)) { r = si; return; }
    if (s.objetos.some(o => ehTerreno(o) && ((o.level || 0) === lv || (ehTipo(o, 'Staircase') && (o.level || 0) + 1 === lv)) && casasDoObjeto(o).some(c => c[0] === x && c[1] === y))) r = si;
  });
  // (an underlay showing beside the tiles is floor at ground level)
  if (r < 0 && lv === 0) projeto.salas.forEach((s, si) => { if (r < 0 && s.pecas.some(p => ehAlfombra(p.tile) && casasDaPeca(p).some(c => c[0] === x && c[1] === y))) r = si; });
  return r;
}
/* can the user reach something at level lv now (the ribbon level)? a staircase reaches its base level and the next one */
const noNivel = (lv, escada) => (lv || 0) === nivel || (escada && (lv || 0) + 1 === nivel);
function nivelDaCasa(x, y) { const c = casaDoChao(x, y); return c ? c.nivel : -1; }
function ocupacao(excetoSala, excetoPeca, alfombra, lv) {
  const m = new Map();
  projeto.salas.forEach((s, si) => s.pecas.forEach((p, pi) => { if (si === excetoSala && pi === excetoPeca) return; if (ehAlfombra(p.tile) !== alfombra || (p.level || 0) !== lv) return; casasDaPeca(p).forEach(([x, y]) => m.set(x + ',' + y, si)); }));
  return m;
}
function colide(p, sala, indice) {
  // (the vault on the game box stands at level 3, the level of the box's top: the box under it is no overlap, nor the vault
  // or the platform over a box being moved)
  const sobreACaixa = (a, q) => q.tile === 'gamebox' && (a.tile === 'platform' || a.tile === 'vault') && casasDaPeca(a).every(c => casasDaPeca(q).some(d => d[0] === c[0] && d[1] === c[1]));
  const oc = ocupacao(sala, indice, ehAlfombra(p.tile), p.level || 0);
  if (casasDaPeca(p).some(([x, y]) => oc.has(x + ',' + y))) {
    const minhas0 = new Set(casasDaPeca(p).map(c => c.join(',')));
    const choca = projeto.salas.some((s, si) => s.pecas.some((q, qi) => !(si === sala && qi === indice) && ehAlfombra(q.tile) === ehAlfombra(p.tile) && (q.level || 0) === (p.level || 0)
      && !sobreACaixa(p, q) && !sobreACaixa(q, p) && casasDaPeca(q).some(c => minhas0.has(c.join(',')))));
    if (choca) return true;
  }
  if (ehAlfombra(p.tile)) return false;
  // a special tile (a box, the vault) fills every level up to its top: under it nothing fits, over it only a tile above its
  // top (on pillars); the platform and the vault may stand on the game box
  const minhas = new Set(casasDaPeca(p).map(c => c.join(',')));
  const topo = q => (q.level || 0) + (MUROS[q.tile] || 0);
  return projeto.salas.some((s, si) => s.pecas.some((q, qi) => {
    if ((si === sala && qi === indice) || ehAlfombra(q.tile) || !(ehEspecial(q.tile) || ehEspecial(p.tile))) return false;
    const suas = casasDaPeca(q); if (!suas.some(c => minhas.has(c.join(',')))) return false;
    if (q.tile === 'gamebox' && (p.tile === 'platform' || p.tile === 'vault') && [...minhas].every(k => suas.some(c => c.join(',') === k))) return false;
    if (p.tile === 'gamebox' && (q.tile === 'platform' || q.tile === 'vault') && suas.every(c => minhas.has(c.join(',')))) return false;
    if (ehEspecial(q.tile) && !ehEspecial(p.tile) && (p.level || 0) > topo(q)) return false;
    if (ehEspecial(p.tile) && !ehEspecial(q.tile) && (q.level || 0) > topo(p)) return false;
    return true; }));
}
/* the markers of the "Move" triggers: the second object (or the tile laid again) that shows where an object or a tile goes.
   A marker does not come out in the setup of its room (exported hidden, or not at all for a tile). {objetos, pecas}: "si:i" */
function marcasDoMapa(p = projeto) {
  const r = { objetos: new Set(), pecas: new Set() };
  (p.salas || []).forEach(s => (s.objetos || []).concat((s.inimigos || []), s.grupoPool ? [s.grupoPool] : []).forEach(o => todosGatilhos(o).forEach(g => {
    if (g.tipo === 'move_object' && g.marcaIndex !== undefined && p.salas[g.marcaSala]?.objetos[g.marcaIndex]) r.objetos.add(g.marcaSala + ':' + g.marcaIndex);
    if (g.tipo === 'move_tile' && g.marcaPeca !== undefined && p.salas[g.marcaSala]?.pecas[g.marcaPeca]) r.pecas.add(g.marcaSala + ':' + g.marcaPeca); })));
  (p.contadores || []).concat(p.eventos || []).forEach(c => todosGatilhos(c).forEach(g => {
    if (g.tipo === 'move_object' && g.marcaIndex !== undefined) r.objetos.add(g.marcaSala + ':' + g.marcaIndex);
    if (g.tipo === 'move_tile' && g.marcaPeca !== undefined) r.pecas.add(g.marcaSala + ':' + g.marcaPeca); }));
  return r;
}
const ehMarca = (tipo, si, i, p = projeto) => marcasDoMapa(p)[tipo === 'peca' ? 'pecas' : 'objetos'].has(si + ':' + i);
/* a tile wholly over underlays (every square of it has an underlay below): taken off keeping what stands on it, all of
   that stays on the underlay */
function pecaSobreAlfombra(q, p = projeto) { if (!q || ehAlfombra(q.tile) || (q.level || 0)) return false; const sob = new Set(); (p.salas || []).forEach(s => s.pecas.forEach(a => { if (ehAlfombra(a.tile)) casasDaPeca(a).forEach(c => sob.add(c.join(','))); }));
  const cs = casasDaPeca(q); return cs.length > 0 && cs.every(c => sob.has(c.join(','))); }
const rotulo = o => o.ehContador ? L2('Counter “', 'Contador “') + (o.nome || '?') + '”' : o.enemy ? nomeIni(o.enemy) : (o.name || (o.molde && cloneDoJogo(o.molde)?.nome) || nomeObj(o.type));
/* the consequence lists of an object: its triggers, what runs when a requirement fails, and the outcome lists hung on a
   trigger by its uid (LISTA_FILHA: "ok:<uid>"/"fail:<uid>" of a test, "op1:<uid>" of an answer, "senao:<uid>",
   "grupo:<uid>", "rodada:<uid>", "conta:<uid>") */
const LISTA_FILHA = /^(ok|fail|op\d+|senao|grupo|rodada|conta):/;
const listasDe = o => ['gatilhos', 'senao', ...Object.keys(o || {}).filter(k => LISTA_FILHA.test(k))];
const todosGatilhos = o => listasDe(o).flatMap(l => (o && o[l]) || []);
/* who holds triggers: an object (key: its index in the room) or a monster with "when defeated" triggers (key: 'E:' + its uid) */
const chaveDoInimigo = e => { if (!e.uid) e.uid = uid(); return 'E:' + e.uid; };
/* a counter (Counts button) holds the triggers of its consequence: key 'C:' + its id */
const donosContadores = () => (projeto.contadores || []).map(c => ({ o: c, chave: 'C:' + c.id }));
/* the balanced group of a room holds the triggers of "when the group is defeated" (key 'G:' + si) */
const grupoPoolDe = s => s ? (s.grupoPool = s.grupoPool || { ehGrupo: true, enemy: POOL_ID, gatilhos: [], senao: [] }) : null;
function donoDe(s, chave) { if (typeof chave === 'string' && chave.startsWith('G:')) return grupoPoolDe(s); if (typeof chave === 'string' && chave.startsWith('C:')) return (projeto.contadores || []).find(c => c.id === chave.slice(2)) || null; if (typeof chave === 'string' && chave.startsWith('E:')) { const u = chave.slice(2); return inimigosDaSala(s).find(x => x.e.uid === u)?.e || null; } return s?.objetos[chave]; }
function donosDaSala(s) { const r = s.objetos.map((o, oi) => ({ o, chave: oi })); if (s.grupoPool && todosGatilhos(s.grupoPool).length) r.push({ o: s.grupoPool, chave: 'G:' + projeto.salas.indexOf(s) }); inimigosDaSala(s).forEach(({ e }) => { if (e.uid && todosGatilhos(e).length) r.push({ o: e, chave: 'E:' + e.uid }); }); return r; }
const gatDe = (s, r) => donoDe(s, r.obj)?.[r.l || 'gatilhos']?.[r.g];
/* every enemy of a room: the starting ones (room 1) and the ones of its spawn triggers */
function inimigosDaSala(s) {
  const r = (s.inimigos || []).map((e, i) => ({ e, origem: { tipo: 'sala', i } }));
  // a spawn from the pool exports its spaces, not the list (monsters left from the other mode are not in play)
  const doDono = (o, chave) => listasDe(o).forEach(l => (o[l] || []).forEach((g, gi) => { if (g.tipo === 'spawn' && g.fonte !== 'pool') (g.inimigos || []).forEach((e, k) => r.push({ e, origem: { tipo: 'gat', obj: chave, g: gi, k, l } })); }));
  s.objetos.forEach((o, oi) => doDono(o, oi));
  // monsters that enter when another monster is defeated (and so on)
  if (s.grupoPool && todosGatilhos(s.grupoPool).length) doDono(s.grupoPool, 'G:' + projeto.salas.indexOf(s));
  for (let i = 0; i < r.length && i < 500; i++) { const e = r[i].e; if (e.uid && (e.gatilhos || []).length) doDono(e, 'E:' + e.uid); }
  return r;
}
/* the selection of a monster from where it comes from */
const selDoInimigo = (si, origem) => origem.tipo === 'sala' ? { tipo: 'inimigo', sala: si, i: origem.i } : { tipo: 'inimigo', sala: si, i: origem.k, g: origem.g, obj: origem.obj, l: origem.l };
/* a copied monster (or object) gets new ids for itself and its triggers; the outcome lists follow */
function inimigoRef(r) { if (!r) return null; const s = projeto.salas[r.sala]; if (!s) return null; if (r.tipo === 'gat') return gatDe(s, r)?.inimigos?.[r.i] || null; return s.inimigos[r.i] || null; }
/* group#index as the mod counts it: a monster of the room is in room-N (hand-placed) or room-N-pool (balanced), indexed within that group */
function slotDoInimigo(r) { if (!r) return null; if (r.tipo === 'gat') return gatDe(projeto.salas[r.sala], r)?.uid + '#' + r.i; const ls = projeto.salas[r.sala]?.inimigos || []; const pool = ehPool(ls[r.i]?.enemy); return 'room-' + (r.sala + 1) + (pool ? '-pool' : '') + '#' + ls.slice(0, r.i).filter(e => ehPool(e.enemy) === pool).length; }
function gruposDaMissao() { const r = []; projeto.salas.forEach((s, si) => { if ((s.inimigos || []).some(e => !ehPool(e.enemy))) r.push({ id: 'room-' + (si + 1), nome: (si === 0 ? 'Starting enemies of ' : 'Enemies placed in ') + s.nome + (si === 0 ? '' : ' (enter when it opens)') }); if (vagasPoolDaSala(s)) r.push({ id: 'room-' + (si + 1) + '-pool', nome: 'Balanced group of ' + s.nome }); donosDaSala(s).forEach(({ o }) => todosGatilhos(o).forEach(x => { if (x.tipo === 'spawn') r.push({ id: x.uid, nome: (o.enemy ? 'Spawn when “' + rotulo(o) + '” is defeated' : 'Spawn of “' + rotulo(o) + '”') + ' (' + s.nome + ')' }); })); }); return r; }

// ------------------------------------------------------------ pillars (belong to the tile they hold up)
function pilaresDoMapa() { const r = []; projeto.salas.forEach((s, si) => s.pecas.forEach((p, pi) => (p.pilares || []).forEach((q, qi) => r.push({ q, p, si, pi, qi })))); return r; }
/* the pillar a pillar object takes from the box: the pillar (object) of its size, the interactive pillar a medium one */
const pilarDoObjeto = o => ehTipo(o, 'PillarObj') ? (SUPORTES[o.tamanho] ? o.tamanho : 'Pillar') : ehTipo(o, 'PillarPush') ? (o.tamanho === 'PillarShort' ? 'PillarShort' : 'Pillar') : null;
/* the interactive pillar comes short or medium (the game's pushable pillar is medium; the short one is the short pillar made usable) */
const TAMANHOS_INTERATIVO = ['PillarShort', 'Pillar'];
function contagemPilaresNaSala(si) { const n = { PillarShort: 0, Pillar: 0, PillarTall: 0 }; const s = projeto.salas[si]; (s?.pecas || []).forEach(p => (p.pilares || []).forEach(q => { n[q.type] = (n[q.type] || 0) + 1; })); (s?.objetos || []).forEach(o => { const k = pilarDoObjeto(o); if (k) n[k]++; }); return n; }
function contagemPilares() { const n = { PillarShort: 0, Pillar: 0, PillarTall: 0 }; pilaresDoMapa().forEach(({ q }) => { n[q.type] = (n[q.type] || 0) + 1; }); projeto.salas.forEach(s => (s.objetos || []).forEach(o => { const k = pilarDoObjeto(o); if (k) n[k]++; })); return n; }
/* which pillar kinds a tile of the given level may take: level 1 → all three; level 2 → medium and tall; level 3 → tall */
function pilaresPermitidos(lv) { const h = lv > 3 ? lv - CAIXAS.gamebox : lv; return Object.keys(SUPORTES).filter(k => SUPORTES[k].nivel >= h); }   // (above level 3 the pillars stand on the game box)
/* the sockets of a tile: the corners between two squares on a straight stretch of its edge (never its outer or inner corners, never inside) */
function encaixesDaPeca(p) {
  const S = new Set(casasDaPeca(p).map(c => c.join(','))); const tem = (x, y) => S.has(x + ',' + y);
  const arestas = new Map(); const marca = (vx, vy, dir) => { const k = vx + ',' + vy; const a = arestas.get(k) || []; a.push(dir); arestas.set(k, a); };
  casasDaPeca(p).forEach(([x, y]) => {
    if (!tem(x, y - 1)) { marca(x, y, 'h'); marca(x + 1, y, 'h'); }
    if (!tem(x, y + 1)) { marca(x, y + 1, 'h'); marca(x + 1, y + 1, 'h'); }
    if (!tem(x - 1, y)) { marca(x, y, 'v'); marca(x, y + 1, 'v'); }
    if (!tem(x + 1, y)) { marca(x + 1, y, 'v'); marca(x + 1, y + 1, 'v'); }
  });
  const r = new Set(); arestas.forEach((a, k) => { if (a.length === 2 && a[0] === a[1]) r.add(k); }); return r;
}
function pilarEm(vx, vy) { for (const it of pilaresDoMapa()) if (it.q.pos[0] === vx && it.q.pos[1] === vy) return it; return null; }
function pecasSemApoio() { const r = []; projeto.salas.forEach((s, si) => s.pecas.forEach((p, pi) => { if (ehAlfombra(p.tile) || ehEspecial(p.tile) || !(p.level > 0)) return; if (!(p.pilares || []).length) r.push({ p, si, pi }); })); return r; }

// ------------------------------------------------------------ what sits on a tile (moves and dies with it)
function anexosDaPeca(si, pi) {
  const s = projeto.salas[si]; const p = s.pecas[pi]; if (!p) return { objetos: [], inimigos: [], herois: [] };
  const casas = new Set(casasDaPeca(p).map(c => c.join(',')));
  const lv = p.level || 0;
  const emCima = (x, y, l) => casas.has(x + ',' + y) && (l === undefined || l === lv || nivelDaCasa(x, y) === lv);
  const objetos = []; s.objetos.forEach((o, oi) => { if (ehTerreno(o)) return; if (casasDoObjeto(o).some(([x, y]) => emCima(x, y, o.level))) objetos.push(oi); });
  const inimigos = []; inimigosDaSala(s).forEach(({ e, origem }) => { if (emCima(e.pos[0], e.pos[1], e.level)) inimigos.push(origem); });
  const herois = []; s.herois.forEach((h, hi) => { if (emCima(h[0], h[1], h[2])) herois.push(hi); });
  return { objetos, inimigos, herois };
}
/* moves a tile with its pillars and what sits on it; `anexos` (taken when a mouse drag starts) keeps the load fixed while the tile passes over others */
function moverPecaComAnexos(si, pi, dx, dy, anexos) {
  const s = projeto.salas[si]; const p = s.pecas[pi];
  const a = anexos || anexosDaPeca(si, pi);
  p.pos = [p.pos[0] + dx, p.pos[1] + dy];
  (p.pilares || []).forEach(q => { q.pos = [q.pos[0] + dx, q.pos[1] + dy]; });
  a.objetos.forEach(oi => { const o = s.objetos[oi]; o.pos = [o.pos[0] + dx, o.pos[1] + dy]; });
  a.inimigos.forEach(r => { const e = r.tipo === 'sala' ? s.inimigos[r.i] : gatDe(s, r).inimigos[r.k]; e.pos = [e.pos[0] + dx, e.pos[1] + dy]; });
  a.herois.forEach(hi => { s.herois[hi][0] += dx; s.herois[hi][1] += dy; });
}
/* turns a tile a quarter turn clockwise around its anchor, with its pillars and what sits on it (objects, monsters, hero
   spaces turn with it, as the pieces on a board tile would) */
function girarPecaComAnexos(si, pi) {
  const s = projeto.salas[si]; const p = s.pecas[pi]; const a = anexosDaPeca(si, pi);
  const [px, py] = p.pos; const f = (x, y) => [px - (y - py), py + (x - px)]; const fv = (x, y) => [px + py - y + 1, py - px + x];
  p.rot = ((p.rot || 0) + 90) % 360;
  (p.pilares || []).forEach(q => { q.pos = fv(q.pos[0], q.pos[1]); });
  a.objetos.forEach(oi => { const o = s.objetos[oi]; const cs = casasDoObjeto(o).map(([x, y]) => f(x, y)); o.rot = ((o.rot || 0) + 90) % 360; o.pos = [Math.min(...cs.map(c => c[0])), Math.min(...cs.map(c => c[1]))]; });
  a.inimigos.forEach(r => { const e = r.tipo === 'sala' ? s.inimigos[r.i] : gatDe(s, r).inimigos[r.k]; e.pos = f(e.pos[0], e.pos[1]); });
  a.herois.forEach(hi => { const [x, y] = f(s.herois[hi][0], s.herois[hi][1]); s.herois[hi][0] = x; s.herois[hi][1] = y; });
}
function descricaoDosAnexos(si, pi) {
  const s = projeto.salas[si]; const a = anexosDaPeca(si, pi); const partes = [];
  if (a.objetos.length) partes.push(a.objetos.length + ' object(s): ' + a.objetos.map(oi => rotulo(s.objetos[oi])).join(', '));
  if (a.inimigos.length) partes.push(a.inimigos.length + ' monster(s)');
  if (a.herois.length) partes.push(a.herois.length + ' hero space(s)');
  const np = (s.pecas[pi].pilares || []).length; if (np) partes.push(np + ' pillar(s)');
  return partes.join('; ');
}

// ------------------------------------------------------------ rooms
function novaSala(abertaPor) {
  const n = projeto.salas.length + 1;
  projeto.salas.push({ nome: tr(n === 1 ? 'Starting room' : 'Room ' + n), texto: '', pecas: [], objetos: [], inimigos: [], herois: [], objetivos: [], reserva: { add: [], remove: [] }, abertaPor: abertaPor ? [abertaPor] : [] });
  salaAtual = n - 1; sel = null; ferramenta = 'peca'; gatAberto = -1;
  tudo();
  aviso(n === 1 ? 'Lay the tiles of the starting room, then hero spaces and at least one object. Other rooms open through object triggers.' : 'Lay the tiles of room ' + n + '. They stay hidden until a trigger opens the room.');
  return n - 1;
}
/* ------------------------------------------------------------ the 3D terrain in the boxes
   How many of each piece come in each box, for the counts on the object buttons. Totals from the rulebooks (Act I: 47
   3D terrain elements, 12 explore/sight tokens; The Betrayer's War: 34 terrain pieces, 2 explore/sight tokens); the split by
   kind is an estimate (the app keeps no count of the terrain), which the user corrects in Settings › Terrain in your
   boxes. Pillars that hold tiles are counted apart (SUPORTES). The two token kinds share the same double-sided tokens. */
/* counted in the boxes (Act I: 47 3D elements and 12 exploration / sight tokens). The Act I box has two archways; the
   Act II box has two bells and one bell frame, which stands alone as a frame too (PARTILHA_TERRENO): only one bell hangs
   at a time */
const TERRENO_POR_ATO = {
  1: { Door: 4, Gate: 2, Chest: 4, Shelf: 4, StoneTable: 3, RoundTable: 3, Tree: 3, Archway: 2, Barricade: 2, Cauldron: 1, Lectern: 1, Well: 1, DragonArch: 1, DragonHead: 1, Staircase: 4, Fichas: 12 },
  2: { BellFrame: 1, Bell: 2, BloodShrine: 2, Fire: 4, Ladder: 3, LadderMedium: 3, Statue: 1, Wagon: 1, Bridge: 1, Fichas: 2 }
};
/* the game's pieces face north at rotation 0 (their back to the south): the editor's pictures of the pieces with a front
   are drawn facing south, so they turn half a turn more when drawn */
const GIRO_ARTE = { Chest: 180, Shelf: 180, BloodShrine: 180, DragonHead: 180 };
const rotVisual = o => ((o.rot || 0) + (GIRO_ARTE[baseObj(o.type)] || 0)) % 360;
const grupoDoTerreno = tipo => { const t = baseObj(tipo) || tipo; return t === 'SightToken' || t === 'InteractToken' ? 'Fichas' : t; };
/* pillars that hold tiles, per box (the user corrects them in Settings › Terrain in your boxes) */
const PILARES_POR_ATO = { 1: { PillarShort: 8, Pillar: 4, PillarTall: 0 }, 2: { PillarShort: 4, Pillar: 4, PillarTall: 4 } };
function caixaDoPilar(tipo, atos = ATOS.get()) { const proprio = terrenoProprio(); const k = 'pilar:' + tipo; if (proprio && proprio[k] !== undefined && proprio[k] !== '') return +proprio[k];
  return [1, 2].reduce((n, a) => n + (a <= atos ? PILARES_POR_ATO[a][tipo] || 0 : 0), 0); }
/* how many copies of a tile (by its number: both sides are one piece) the boxes hold: 1 of each tile of the boxes owned,
   unless the user says otherwise (two boxes, a tile made by hand) */
function caixaDaPeca(num, atos = ATOS.get()) { const proprio = terrenoProprio(); const k = 'peca:' + num; if (proprio && proprio[k] !== undefined && proprio[k] !== '') return +proprio[k];
  if (ehDaOficina(num)) { const v = varPeca(num); return Math.max(1, +(v && v.copias) || 1); }   // (v241: how many the Workshop says)
  const t = PECAS.find(x => numeroDaPeca(x.id) === num); return t && (t.act || 1) > atos ? 0 : 1; }
function terrenoProprio() { try { const v = JSON.parse(localStorage.getItem('bigorna-terreno') || 'null'); return v && typeof v === 'object' ? v : null; } catch { return null; } }
/* how many pieces of a kind the user's boxes hold (of the acts owned; null: a kind the boxes do not count, such as the
   Workshop's objects) */
function caixaDoTerreno(tipo, atos = ATOS.get()) {
  const g = grupoDoTerreno(tipo); const proprio = terrenoProprio(); if (proprio && proprio[g] !== undefined && proprio[g] !== '') return +proprio[g];
  let n = null;
  [1, 2].forEach(a => { if (a <= atos && TERRENO_POR_ATO[a][g] !== undefined) n = (n || 0) + TERRENO_POR_ATO[a][g]; });
  if (n === null && [1, 2].some(a => TERRENO_POR_ATO[a][g] !== undefined)) n = 0;   // a kind only in a box the user does not have
  return n;
}
/* what is gone from the table by the time room si opens: the rooms, tiles and objects removed by the objects that open
   it, and by those that opened the rooms before it (their pieces go back to the box) */
function removidosAntes(si) {
  const r = { salas: new Set(), pecas: new Set(), objetos: new Set() }; const vistas = new Set();
  const subir = s => { if (s < 0 || vistas.has(s)) return; vistas.add(s);
    abridoresDe(s).forEach(({ r: ref, o }) => { todosGatilhos(o).forEach(g => {
      if (g.tipo === 'remove_room' && g.sala !== '' && g.sala !== undefined) r.salas.add(+g.sala);
      if (g.tipo === 'remove_tile' && g.sala !== undefined && g.peca !== undefined) r.pecas.add(g.sala + ':' + g.peca);
      if (g.tipo === 'remove_object') { if (g.proprio) r.objetos.add(ref.sala + ':' + ref.objeto); else if (g.objIndex !== undefined) r.objetos.add(g.objSala + ':' + g.objIndex); } });
      subir(ref.sala); }); };
  subir(si); return r;
}
/* pieces that stand on another piece of the box: the Act II bell hangs in its frame, so a bell on the table takes the
   frame, and with the frame on the table (alone) there is none left for the bell */
const PARTILHA_TERRENO = { Bell: 'BellFrame' };
const NOTA_PARTILHA = 'the bell hangs in its frame: a bell on the table takes the bell frame, and with one frame only one bell hangs at a time';
const partilhaDe = g => PARTILHA_TERRENO[g] || Object.keys(PARTILHA_TERRENO).find(k => PARTILHA_TERRENO[k] === g) ? ' (' + tr(NOTA_PARTILHA) + ')' : '';
/* the use of kind g when pieces are shared: the host counts its guests; a guest is out when its host is out */
function usoPartilhado(g, contar, caixa) {
  const hospede = Object.keys(PARTILHA_TERRENO).find(k => PARTILHA_TERRENO[k] === g);
  if (hospede) return contar(g) + contar(hospede);
  const host = PARTILHA_TERRENO[g]; if (!host) return contar(g);
  const A = caixa(host), B = caixa(g); if (A === null || B === null) return contar(g);
  return Math.max(contar(g), B - A + contar(host) + contar(g));
}
/* a bell hung over an archway (as in the Act II maps of the game): it takes a bell, not the bell frame */
const sinoNoArco = (o, s) => ehTipo(o, 'Bell') && (s.objetos || []).some(a => ehTipo(a, 'Archway') && a.pos[0] === o.pos[0] && a.pos[1] === o.pos[1] && (a.level || 0) < (o.level || 0));
/* the bells: those in the frame share it with the frame alone; those over an archway only count as bells */
function usoDosSinos(g, contar, contarNoArco, caixa) {
  const A = caixa('BellFrame'), B = caixa('Bell'); const todos = contar('Bell'), arco = contarNoArco(), naMoldura = todos - arco, molduras = contar('BellFrame');
  if (A === null || B === null) return contar(g);
  if (g === 'BellFrame') return molduras + naMoldura;
  return Math.max(todos, B - A + molduras + naMoldura + arco);
}
/* how many pieces of a kind are on the table while room si is open (removed pieces are back in the box) */
function terrenoEmUso(tipo, si = salaAtual) { const g = grupoDoTerreno(tipo);
  if (g === 'Bell' || g === 'BellFrame') return usoDosSinos(g, x => terrenoEmUsoSo(x, si), () => terrenoEmUsoSo('Bell', si, sinoNoArco), x => caixaDoTerreno(x));
  return usoPartilhado(g, x => terrenoEmUsoSo(x, si), x => caixaDoTerreno(x)); }
function terrenoEmUsoSo(tipo, si = salaAtual, filtro = null) {
  const g = grupoDoTerreno(tipo); const fora = removidosAntes(si); let n = 0;
  projeto.salas.forEach((s, ri) => { if (fora.salas.has(ri) || s._previa && ri !== si) return;
    const casasFora = new Set(); s.pecas.forEach((q, pi) => { if (fora.pecas.has(ri + ':' + pi)) casasDaPeca(q).forEach(c => casasFora.add(c.join(','))); });
    // the same piece in several states (an object and its variants on one square, as in the original maps) counts once
    const vistos = new Set();
    s.objetos.forEach((o, oi) => { if (grupoDoTerreno(o.type) !== g || fora.objetos.has(ri + ':' + oi) || (filtro && !filtro(o, s))) return;
      if (casasFora.size && casasDoObjeto(o).every(c => casasFora.has(c.join(',')))) return; const k = o.pos.join(',') + ':' + (o.level || 0); if (vistos.has(k)) return; vistos.add(k); n++; }); });
  return n;
}
function abridoresDe(si) { return (projeto.salas[si]?.abertaPor || []).map(r => ({ r, o: projeto.salas[r.sala]?.objetos[r.objeto] })).filter(x => x.o && todosGatilhos(x.o).some(g => g.tipo === 'open_room' && g.sala === si)); }
function limparAbridores() { projeto.salas.forEach((s, si) => { s.abertaPor = []; }); projeto.salas.forEach((s, si) => s.objetos.forEach((o, oi) => todosGatilhos(o).forEach(g => { if (g.tipo === 'open_room' && projeto.salas[g.sala]) projeto.salas[g.sala].abertaPor.push({ sala: si, objeto: oi }); }))); }
function poolDaSala(si) { return poolDe(projeto, si); }
function poolDe(p, si) { const s = p.salas[si]; const r = s.reserva || { add: [], remove: [] }; return [...new Set([...(p.reserva || []).filter(id => !(r.remove || []).includes(id)), ...(r.add || [])])]; }
/* from level 1 up a staircase stands on tiles of its base level (only on the floor, level 0, may it sit off the tiles) */
const temPecaEm = (x, y, lv) => projeto.salas.some(s => s.pecas.some(q => !ehAlfombra(q.tile) && (q.level || 0) === lv && casasDaPeca(q).some(c => c[0] === x && c[1] === y)));
const escadaSemApoio = o => ehTipo(o, 'Staircase') && (o.level || 0) >= 1 && !casasDoObjeto(o).every(([x, y]) => temPecaEm(x, y, o.level || 0));
const AVISO_ESCADA = lv => 'From level 1 up a staircase must stand on tiles: put it on tiles of level ' + lv + ' (only on the floor, level 0, may it go off the tiles).';
function problemasDaSala(si) {
  const s = projeto.salas[si]; const p = [];
  if (!s) return p;
  const pecasChao = s.pecas.filter(q => !ehAlfombra(q.tile));
  if (pecasChao.length === 0 && !s.objetos.some(ehTerreno)) p.push('no tiles');
  const nums = pecasChao.map(q => numeroDaPeca(q.tile)); const rep = nums.filter((n, i) => nums.indexOf(n) !== i && nums.filter(x => x === n).length > caixaDaPeca(n));
  if (rep.length) p.push('repeated tile: ' + [...new Set(rep)].join(', '));
  if (si === 0 && s.herois.length < 2) p.push('fewer than 2 hero spaces');
  // a point of interest fires as soon as a hero stands next to it: never next to where the heroes start
  if (si === 0 && s.herois.some(h => projeto.salas.some(ss => ss.objetos.some(o => ehTipo(o, 'SightToken') && !o.hidden && casasDoObjeto(o).some(([x, y]) => Math.max(Math.abs(x - h[0]), Math.abs(y - h[1])) <= 1))))) p.push('a hero starts next to a point of interest: it fires at once (warning)');
  if (si > 0 && !abridoresDe(si).length) p.push('no object opens this room');
  s.pecas.forEach(q => { if (!defPeca(q.tile)) { p.push('a workshop tile of this room no longer exists'); return; } if (!ehAlfombra(q.tile) && !ehEspecial(q.tile) && q.level > 0 && !(q.pilares || []).length) p.push('tile ' + nomePeca(q.tile) + ' is elevated with no pillars (warning)'); const enc = encaixesDaPeca(q); (q.pilares || []).forEach(x => { if (!enc.has(x.pos.join(','))) p.push('tile ' + nomePeca(q.tile) + ': the pillar at ' + x.pos.join(',') + ' is not in a socket (warning)'); }); });
  // the floor of every level, once: 'x,y,level' -> the first room whose tile (or staircase/bridge) is there, as salaNoNivel finds it
  const chaoNv = new Map(); const pisa = (x, y, lv, ri) => { const k = x + ',' + y + ',' + lv; if (!chaoNv.has(k)) chaoNv.set(k, ri); };
  projeto.salas.forEach((ss, ri) => { ss.pecas.forEach(q => { if (!ehAlfombra(q.tile)) casasDaPeca(q).forEach(([x, y]) => pisa(x, y, nivelNaPeca(q, x, y), ri)); }); ss.objetos.forEach(o => { if (ehTerreno(o)) casasDoObjeto(o).forEach(([x, y]) => { pisa(x, y, o.level || 0, ri); if (ehTipo(o, 'Staircase')) pisa(x, y, (o.level || 0) + 1, ri); }); }); });
  projeto.salas.forEach((ss, ri) => ss.pecas.forEach(q => { if (ehAlfombra(q.tile)) casasDaPeca(q).forEach(([x, y]) => pisa(x, y, 0, ri)); }));   // an underlay beside the tiles
  const salaEm = (x, y, lv) => chaoNv.has(x + ',' + y + ',' + lv) ? chaoNv.get(x + ',' + y + ',' + lv) : -1;
  // an underlay showing beside the tiles (water, embers, spikes…): nothing is set on it, nobody starts on it
  const cobertas = new Set(s.pecas.filter(q => !ehAlfombra(q.tile) && !(q.level > 0)).flatMap(q => casasDaPeca(q)).map(c => c.join(',')));
  const naSub = new Set(s.pecas.filter(q => ehAlfombra(q.tile)).flatMap(q => casasDaPeca(q)).map(c => c.join(',')).filter(k => !cobertas.has(k)));
  if (naSub.size) { s.objetos.forEach(o => { if (!ehTerreno(o) && !(o.level > 0) && casasDoObjeto(o).some(c => naSub.has(c.join(',')))) p.push('"' + rotulo(o) + '" stands on an underlay (warning)'); });
    inimigosDaSala(s).forEach(({ e }) => { if (e.pos && !(e.level > 0) && naSub.has(e.pos[0] + ',' + e.pos[1])) p.push(nomeIni(e.enemy) + ' stands on an underlay (warning)'); }); }
  // objects (in order), then the balanced group and the monsters with "when defeated" triggers
  s.objetos.forEach(o => { if (escadaSemApoio(o)) p.push('"' + rotulo(o) + '" (level ' + o.level + ') is not on tiles: from level 1 up a staircase stands on tiles'); });
  donosDaSala(s).forEach(({ o, chave }) => {
    if (typeof chave === 'number' && !ehTerreno(o)) {
      if (!sinoNoArco(o, s) && !casasDoObjeto(o).some(([x, y]) => salaEm(x, y, o.level || 0) === si)) p.push('"' + rotulo(o) + '" is off this room\'s floor (level ' + (o.level || 0) + ')');
      if (ehDaOficina(o.type) && !varObj(o.type)) p.push('"' + rotulo(o) + '" is a workshop object that no longer exists');
    }
    todosGatilhos(o).forEach(g => {
      if (g.tipo === 'spawn' && g.fonte !== 'pool' && !(g.inimigos || []).length) p.push('"' + rotulo(o) + '": spawn without monsters');
      if (g.tipo === 'spawn' && g.fonte === 'pool' && !(g.cells || []).length) p.push('"' + rotulo(o) + '": spawn from the pool without spaces');
      if (g.tipo === 'spawn' && g.fonte === 'pool' && !poolDaSala(si).length) p.push('"' + rotulo(o) + '": the spawn pool of this room is empty (warning)');
      if (g.tipo === 'move_heroes' && !(g.cells || []).length) p.push('"' + rotulo(o) + '": move heroes without a destination');
      if ((g.tipo === 'add_object' || g.tipo === 'remove_object') && g.objIndex === undefined && !g.proprio) p.push('"' + rotulo(o) + '": ' + g.tipo.replace('_', ' ') + ' without a target');
      if (g.tipo === 'highlight' && g.objIndex === undefined && !g.cell) p.push('"' + rotulo(o) + '": highlight without a target');
      if (g.tipo === 'choice' && !(g.options || []).some(x => x.text)) p.push('"' + rotulo(o) + '": choice without answers');
      if (g.tipo === 'remove_enemy' && g.alvo === 'one' && !inimigoRef(g.inimigo)) p.push('"' + rotulo(o) + '": remove enemy without a target');
      if (g.tipo === 'mission' && !g.text) p.push('"' + rotulo(o) + '": objective without a text');
      if (g.tipo === 'unlock_map' && campanha && !noDoDesbloqueio(g)) p.push('"' + rotulo(o) + '": unlock a campaign map without a map');
      if (g.tipo === 'give_item' && (g.modo === 'item' || !g.modo) && !g.item) p.push('"' + rotulo(o) + '": give item without an item (workshop items only)');
      if (g.tipo === 'give_item' && g.item && !itemDaOficina(g.item)) p.push('"' + rotulo(o) + '": gives an item that is not in the workshop');
      if (g.tipo === 'item_pool' && !g.item) p.push('"' + rotulo(o) + '": change the item pool without an item');
      if (g.tipo === 'shop' && !fontesDaLoja(g).length) p.push('"' + rotulo(o) + '": shop without stock (pick where it comes from)');
      if (g.tipo === 'shop' && fontesDaLoja(g).length === 1 && fontesDaLoja(g)[0] === 'lista' && !(g.itens || []).length) p.push('"' + rotulo(o) + '": shop with an empty list');
      if (g.tipo === 'shop' && fontesDaLoja(g).includes('lista') && (g.itens || []).some(x => !itemDaOficina(x.item))) p.push('"' + rotulo(o) + '": the shop sells an item that is not in the workshop');
      if (g.tipo === 'shop' && fontesDaLoja(g).length === 1 && fontesDaLoja(g)[0] === 'pool' && !(projeto.itensPool || []).length) p.push('"' + rotulo(o) + '": shop of the item pool, and the pool is empty (warning)');
      if (g.tipo === 'craft' && !tiposDaForja(g).length) p.push('"' + rotulo(o) + '": crafting where nothing may be crafted');
      if (g.tipo === 'armory' && g.armas === false && g.pecas === false) p.push('"' + rotulo(o) + '": armory where nothing may change');
      if (g.tipo === 'counter' && !g.contador) p.push('"' + rotulo(o) + '": count without a counter');
      if (g.tipo === 'remove_room' && !projeto.salas[g.sala]) p.push('"' + rotulo(o) + '": remove room without a room');
      if (g.tipo === 'remove_tile' && !projeto.salas[g.sala]?.pecas[g.peca]) p.push('"' + rotulo(o) + '": remove tile without a tile');
      if (g.tipo === 'scene' && !(g.caixas || []).some(c => c.text)) p.push('"' + rotulo(o) + '": scene without text');
      if (g.tipo === 'rounds' && !(o['rodada:' + g.uid] || []).length) p.push('"' + rotulo(o) + '": every N rounds with nothing inside');
      if (g.tipo === 'rounds' && (o['rodada:' + g.uid] || []).some(x => ['skill_test', 'choice', 'rounds'].includes(x.tipo))) p.push('"' + rotulo(o) + '": every N rounds holds a skill test, a choice or another “Every N rounds”: take it out');
      if (g.tipo === 'counter' && g.acao === 'use' && !(o['conta:' + g.uid] || []).length) p.push('"' + rotulo(o) + '": use a count with nothing inside');
      if (g.tipo === 'add_tile' && !projeto.salas[g.sala]?.pecas[g.peca]) p.push('"' + rotulo(o) + '": add tile without a tile');
      if (g.tipo === 'move_tile' && !projeto.salas[g.sala]?.pecas[g.peca]) p.push('"' + rotulo(o) + '": move tile without a tile');
      if (g.tipo === 'move_tile' && projeto.salas[g.sala]?.pecas[g.peca] && !projeto.salas[g.marcaSala]?.pecas[g.marcaPeca]) p.push('"' + rotulo(o) + '": move tile without a marker');
      if (g.tipo === 'move_object' && !projeto.salas[g.objSala]?.objetos[g.objIndex]) p.push('"' + rotulo(o) + '": move an object without an object');
      if (g.tipo === 'move_object' && projeto.salas[g.objSala]?.objetos[g.objIndex] && !projeto.salas[g.marcaSala]?.objetos[g.marcaIndex] && !g.cell) p.push('"' + rotulo(o) + '": move an object without a marker');
      if (g.tipo === 'remove_tile' && g.manter && projeto.salas[g.sala]?.pecas[g.peca] && !pecaSobreAlfombra(projeto.salas[g.sala].pecas[g.peca])) p.push('"' + rotulo(o) + '": remove tile keeping what stands on it, but the tile is not wholly over an underlay (warning)');
      if ((g.tipo === 'remove_enemy' || g.tipo === 'enemy_condition') && g.alvo === 'group' && !gruposDaMissao().some(x => x.id === g.grupo)) p.push('"' + rotulo(o) + '": ' + (g.tipo === 'remove_enemy' ? 'remove monsters' : 'monster conditions') + ' without a spawn group');
      if (g.tipo === 'mission' && g.modo !== 'map' && g.como === 'use_object' && !projeto.salas[g.objSala]?.objetos[g.objIndex]) p.push('"' + rotulo(o) + '": objective without its object');
      if (g.tipo === 'reserve' && !g.enemy) p.push('"' + rotulo(o) + '": change the spawn pool without a monster');
      if (g.tipo === 'cutscene' && !g.video?.arquivo && !g.name) p.push('"' + rotulo(o) + '": play a video without a video');
      if (g.tipo === 'sound' && g.somModo === 'arquivo' && !g.som?.arquivo) p.push('"' + rotulo(o) + '": play a sound without a file');
    });
    if (ehArco(o) && (o.gatilhos || []).length) p.push('"' + rotulo(o) + '": archways and bell frames cannot be clicked in the game, so their triggers never run');
    [o, ...todosGatilhos(o)].flatMap(x => x.requisitos || []).forEach(r => { if (r.tipo === 'item' && !r.item) p.push('"' + rotulo(o) + '": requirement without an item'); if (r.tipo === 'item' && r.item && !itemDaOficina(r.item)) p.push('"' + rotulo(o) + '": requires an item that is not in the workshop'); if (r.tipo === 'mission' && r.uid === undefined) p.push('"' + rotulo(o) + '": requirement without a mission'); else if (r.tipo === 'mission' && !missoesInternas().some(m => m.uid === r.uid)) p.push('"' + rotulo(o) + '": requires a mission that no longer exists'); });
  });
  inimigosDaSala(s).forEach(({ e }) => { if (salaEm(e.pos[0], e.pos[1], e.level || 0) < 0) p.push(nomeIni(e.enemy) + ' is off the floor (level ' + (e.level || 0) + ')'); if (!ehPool(e.enemy) && !monstro(e.enemy)) p.push(nomeIni(e.enemy) + ' is not in the workshop'); });
  if (vagasPoolDaSala(s) && !poolDaSala(si).map(monstro).filter(Boolean).length) p.push('Balanced spaces, but the spawn pool of this room is empty (Map setup or room panel)');
  return p;
}

// ------------------------------------------------------------ missions (campaign) and normalisation
/* workshop tiles/objects of the first version were looks over a game piece (`base`): they become shapes of their own */
/* (v240: the entries of a package are compared, to see a change, with how they were after the first normalization: the
   normalization fills defaults, and before it marked them all as changed) */
var _aNormalizar = [];
function normalizarOficina(b) {
  if (!b) return b;
  if (_aNormalizar.length) setTimeout(() => { const l = _aNormalizar; _aNormalizar = []; l.forEach(([k, x]) => { if (x._doPacote) _comoVeio.set(chaveDoOriginal(k, x), assinaturaDe(x)); }); }, 0); b.pecas = b.pecas || []; b.objetos = b.objetos || [];
  b.pecas.forEach(v => { if (!v.cells || !v.cells.length) v.cells = v.base && PECA[v.base] ? clone(PECA[v.base].cells) : [[0, 0]]; const x0 = Math.min(...v.cells.map(c => c[0])), y0 = Math.min(...v.cells.map(c => c[1])); if (x0 || y0) { v.cells = v.cells.map(([x, y]) => [x - x0, y - y0]); v.desloc = [x0, y0]; } if (!v.cor) v.cor = PALETA_CORES[0]; delete v.textura; delete v.imagem; });
  // names that came as raw keys (SQ2_NECROMANCER_NAME…) and the invisible "+" of advanced items
  (b.monstros || []).forEach(m => { const c = m.base && CAT.monstros.find(z => z._id === m.base); if (c && ehChaveCrua(m.nome)) m.nome = c.name_en; if (c && ehChaveCrua(m.plural)) m.plural = c.plural_en; });
  (b.itens || []).forEach(i => { if (i.nome) i.nome = comMaisVisivel(i.nome); });
  (b.monstros || []).forEach(m => { if (m.defesa === undefined) { const c = CAT.monstros.find(z => z._id === (m.comportamento || m.base)); m.defesa = c?.defense_en || ''; m.defesaApos = !!c?.ShowDefenseAfterAttack; } });
  // characters are NPCs only (the heroes have their own tab); a game hero imported as a character speaks as its story character
  (b.personagens || []).forEach(p => { if (p.papel === 'hero' || p.heroiBase !== undefined) { const hb = /^HERO_/.test(p.base || '') ? p.base : ''; if (hb) { const sc = CAT.personagens.find(c => c._id === 'STORY_CHARACTER_' + hb.slice(5)); if (sc) { p.base = sc._id; p.rostoBase = chaveArte(sc.TextureAssetPathDefault || sc.TextureAssetPathActI) || p.rostoBase; } } p.papel = 'npc'; delete p.heroiBase; delete p.cor; } });
  // weapons left the hero sheets: one entry per weapon of the game, in their own tab
  b.armas = b.armas || [];
  (b.herois || []).forEach(h => { Object.entries(h.armas || {}).forEach(([wid, a]) => { if (!b.armas.some(x => x.id === wid)) b.armas.push({ id: wid, ...a }); }); delete h.armas; });
  b.herois = (b.herois || []).filter(h => h.nome || h.retrato || h.arte || h.arteModo || h.voz);
  b.objetos.forEach(v => { if (!v.cells || !v.cells.length) { const o = v.base && OBJETO[v.base]; const w = o?.w || 1, h = o?.h || 1; v.cells = []; for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) v.cells.push([i, j]); } if (v.base && !v.glifo) v.glifo = v.base; if (!v.cor) v.cor = '#e0b070'; });
  if (typeof predefinirProezas === 'function') predefinirProezas(b);   // (v241: the game's feats, already in place)
  return b;
}
function normalizar(p) {
  p.meta = p.meta || {}; p.meta.finalMission = p.meta.finalMission || { tipo: 'defeat_all', texto: '', rodadas: 8 }; p.meta.limite = p.meta.limite || (p.objetivo?.limite) || 0;
  if (p.meta.music === undefined) p.meta.music = ''; if (p.meta.background === undefined) p.meta.background = ''; if (p.meta.scene === undefined) p.meta.scene = '';
  p.reserva = p.reserva || []; p.itensPool = p.itensPool || []; p.contadores = (p.contadores || []).filter(c => c && c.nome); p.contadores.forEach(c => { c.id = c.id || uid(); c.ehContador = true; c.gatilhos = c.gatilhos || []; if (+c.total > 0 && !(+c.meta > 0)) c.meta = +c.total; delete c.total; if (!(+c.inicio > 0)) delete c.inicio; });   // (v191: the old total is what the objective waits for; a new counter starts at 0; one of an older map, or a flag of the generator, keeps its start)
  p.bestiario = normalizarOficina(p.bestiario || oficinaVazia());
  if (campanha && campanha.bestiario) normalizarOficina(campanha.bestiario);
  // tiles placed from a first-version workshop tile whose cells did not start at 0,0: keep them where they were
  p.salas.forEach(s => s.pecas.forEach(q => { const v = p.bestiario.pecas.find(x => x.id === q.tile) || (campanha?.bestiario?.pecas || []).find(x => x.id === q.tile); if (v && v.desloc && !q.deslocado) { const [dx, dy] = girar(v.desloc, q.rot || 0); q.pos = [q.pos[0] + dx, q.pos[1] + dy]; q.deslocado = true; } }));
  p.campanha = p.campanha || { chegada: '', conclusao: '' };
  p.salas.forEach((s, si) => {
    s.objetivos = s.objetivos || []; s.inimigos = s.inimigos || []; s.herois = s.herois || [];
    if (Array.isArray(s.reserva)) s.reserva = { add: s.reserva, remove: [] }; s.reserva = s.reserva || { add: [], remove: [] };
    if (s.abertaPor && !Array.isArray(s.abertaPor)) s.abertaPor = [s.abertaPor]; s.abertaPor = s.abertaPor || [];
    s.pecas.forEach(q => { q.level = q.level || 0; q.pilares = q.pilares || []; if (ehCaixa(q.tile)) { q.level = q.tile === 'platform' && [2, 5].includes(q.level) ? q.level : CAIXAS[q.tile]; q.pilares = []; } if (q.tile === 'vault' && ![0, 3].includes(q.level)) q.level = 0; });
    s.herois.forEach(h => { if (h.length < 3) h.push(0); });
    // old projects: vertex pillars as objects become pillars of the tile they hold up
    const soltos = s.objetos.filter(o => o.anchor === 'vertex' || ['PillarShort', 'PillarTall'].includes(o.type) || (o.type === 'Pillar' && o.anchor === 'vertex'));
    soltos.forEach(o => { const alvo = s.pecas.find(q => !ehAlfombra(q.tile) && q.level > 0 && cantosDaPeca(q).has(o.pos.join(','))); if (alvo) alvo.pilares.push({ pos: [o.pos[0], o.pos[1]], type: SUPORTES[o.type] ? o.type : 'PillarShort' }); });
    s.objetos = s.objetos.filter(o => !soltos.includes(o));
    s.objetos.forEach(o => {
      o.gatilhos = o.gatilhos || []; o.level = o.level || 0; o.requisitos = o.requisitos || []; o.senao = o.senao || [];
      o.gatilhos.forEach(g => { g.uid = g.uid || uid(); });
      // older projects: the requirement of the whole object goes into each of its triggers (the "if it fails" into the first)
      if (o.requisitos.length) {
        if (!o.gatilhos.length && o.senao.length) o.gatilhos.push({ uid: uid(), tipo: 'text', text: '' });
        o.gatilhos.forEach((g, i) => { g.requisitos = clone(o.requisitos); if (i === 0 && o.senao.length) o['senao:' + g.uid] = o.senao; });
        o.requisitos = []; o.senao = [];
      }
      if (o.type === 'Pillar') o.type = 'PillarObj';
      if (o.textClick === undefined) { o.textClick = ''; o.textUse = o.text || ''; }
      todosGatilhos(o).forEach(g => {
        if (g.tipo === 'move_heroes' && g.cell && !g.cells) { g.cells = [g.cell]; delete g.cell; }
        if (g.tipo === 'new_mission') { g.tipo = 'mission'; g.modo = 'map'; }
        // "Add a mission → a new map of the campaign" became "Unlock a campaign map" (the map it created is its target)
        if (g.tipo === 'mission' && g.modo === 'map') { g.tipo = 'unlock_map'; if (g.missao !== undefined && g.missao >= 0) g.missaoAntiga = g.missao; delete g.missao; delete g.modo; }
        if (g.tipo === 'spawn_pool') { g.tipo = 'spawn'; g.fonte = 'pool'; }
        if (g.tipo === 'spawn' && !g.fonte) g.fonte = 'list';
        if (g.tipo === 'objective') { g.final = false; }
        if (g.tipo === 'mission' && g.modo !== 'map') g.final = false;
      });
    });
    s.objetivos.forEach(o => { o.final = false; });
  });
  // the objectives of a room became "Add an objective" triggers of the object that opens it (announced when the room opens);
  // the starting room (or a room with no opener) keeps its older ones, listed from the start, until removed
  p.salas.forEach((s, si) => { if (!s.objetivos.length || si === 0) return;
    let lista = null; p.salas.some(ss => ss.objetos.some(o => listasDe(o).some(k => (o[k] || []).some(g => g.tipo === 'open_room' && g.sala === si) && (lista = o[k]))));
    if (!lista) return;
    s.objetivos.forEach(ob => { const usa = ob.tipo === 'use_object' && s.objetos[ob.objeto];
      lista.push({ uid: uid(), tipo: 'mission', modo: 'internal', text: ob.texto || '', como: usa ? 'use_object' : ob.tipo === 'defeat_room' ? 'defeat_room' : 'table', ...(usa ? { objSala: si, objIndex: ob.objeto } : {}), ...(ob.tipo === 'defeat_room' ? { salaAlvo: si } : {}), requisitos: [] }); });
    s.objetivos = []; });
  if (p.objetivo && (p.objetivo.tipo || p.salas.some(s => s.objetivos.some(o => o.wasFinal)))) { /* older final objectives: the final mission of the map */ }
  delete p.objetivo;
  limparAbridores();
  return p;
}
function trocarMissao(i) {
  missaoAtual = i; projeto = campanha.missoes[i]; salaAtual = projeto.salas.length ? 0 : -1; sel = null; ferramenta = null; escolha = null;
  camposDaMissao(); tudo(); enquadrar();
}
function novaMissao(tipo, depoisDe) {
  criarCampanha();
  const p = projetoNovo(); p.meta.author = campanha.meta.author || projeto.meta.author || '';
  campanha.missoes.push(p);
  const idx = campanha.missoes.length - 1;
  const anterior = depoisDe === undefined ? missaoAtual : depoisDe;
  const no = novoNo(tipo || 'map', idx);
  const noAnt = noDaMissao(anterior); if (noAnt && noAnt !== no) no.depois = [noAnt.id];
  arrumarFluxo(false);
  return idx;
}
function criarCampanha() {
  if (campanha) return false;
  campanha = { meta: { name: '', author: projeto.meta.author || '', description: '', lingua: projeto.meta.lingua || (typeof IDIOMA === 'string' ? IDIOMA : 'en') }, intro: '', missoes: [projeto], nos: [], dialogos: [], bestiario: projeto.bestiario || { monstros: [], personagens: [], itens: [] } };
  const no = novoNo('map', 0); no.depois = [];
  normalizarCampanha(campanha);
  return true;
}

// ------------------------------------------------------------ quick save / autosave / restore
/* first-visit explanations, used tips and "don't warn me again" choices: kept in this browser; ⚙ can reset them */
const CHAVE_VISTOS = 'bigorna-rooms-vistos';
function vistos() { try { return JSON.parse(localStorage.getItem(CHAVE_VISTOS) || '{}') || {}; } catch { return {}; } }
const jaVisto = k => !!vistos()[k];
function marcarVisto(k) { const v = vistos(); if (v[k]) return; v[k] = 1; try { localStorage.setItem(CHAVE_VISTOS, JSON.stringify(v)); } catch { } if (typeof renderDicas === 'function') renderDicas(); }
function limparVistos() { try { localStorage.removeItem(CHAVE_VISTOS); } catch { } if (typeof renderDicas === 'function') renderDicas(); }
/* a window that explains a screen the first time it is opened */
function explicarUmaVez(chave, titulo, html) {
  if (jaVisto('explica:' + chave)) return;
  if (typeof Tutorial !== 'undefined' && Tutorial.ativo() && Tutorial.janelaAberta()) { setTimeout(() => explicarUmaVez(chave, titulo, html), 400); return; }   // (after the window of the tutorial)
  marcarVisto('explica:' + chave);
  modal(titulo, html + `<div class="botoes" style="justify-content:flex-end;margin-top:10px"><button class="primario" data-ok>Got it</button></div>`, (el, fechar) => { el.querySelector('[data-ok]').onclick = fechar; });
}
const CHAVE_RAPIDA = 'bigorna-rooms-quicksave', CHAVE_ESTADO = 'bigorna-rooms-estado', CHAVE_AUTOR = 'bigorna-rooms-autor';
function estadoAtual() { return { campanha, projeto: campanha ? null : projeto, missaoAtual, salaAtual, quando: Date.now() }; }
function aplicarEstado(e) {
  if (!e) return false;
  if (e.campanha) { campanha = e.campanha; normalizarCampanha(campanha); campanha.missoes.forEach(normalizar); missaoAtual = Math.min(e.missaoAtual || 0, campanha.missoes.length - 1); projeto = campanha.missoes[missaoAtual]; }
  else if (e.projeto) { campanha = null; projeto = normalizar(e.projeto); missaoAtual = 0; }
  else return false;
  salaAtual = projeto.salas.length ? Math.min(e.salaAtual ?? 0, projeto.salas.length - 1) : -1; sel = null; escolha = null; ferramenta = null;
  // (a Workshop of before inside the work: its party goes into the work now; the Workshop itself joins later, in oficina(),
  // so a caller that makes it the Workshop (the undo) still finds it as it came)
  for (const p of [projeto, campanha, ...(campanha?.missoes || [])]) if (p && p.bestiario && p.bestiario !== _oficina) migrarEquipe(p, p.bestiario);
  return true;
}
/* The work is kept in the browser's database (IndexedDB) and, when it fits, in the small storage too (the newer one opens).
   The pictures and other files inside the work (data: texts of the Workshop, of packages: they can be many megabytes) are
   kept apart, once each, under a key made from their contents: the saved work holds only "bigorna-asset:<key>" in their
   place, so it stays small however big the packages. Opening it fetches each picture back by its key. */
const PREFIXO_ASSET = 'bigorna-asset:', ASSET_MIN = 1500;
const _chaveDoAsset = new Map(), _assetsNoBanco = new Set();
const guardarNoBanco = (chave, texto) => { try { if (typeof Config !== 'undefined') return Config.guardarBlob(chave, texto); } catch { } return Promise.resolve(); };
const lerDoBanco = async chave => { try { if (typeof Config !== 'undefined') return await Config.lerBlob(chave); } catch { } return undefined; };
function hash53(s) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return 4294967296 * (2097151 & h2) + (h1 >>> 0); }
const chaveDoAsset = v => { let c = _chaveDoAsset.get(v); if (!c) { c = hash53(v).toString(36) + '-' + v.length.toString(36); _chaveDoAsset.set(v, c); } return c; };
/* the work as a small text (its pictures as keys) and the pictures not yet in the database */
function textoComAssets(obj, semOficina) {
  const novos = new Map();
  const txt = JSON.stringify(obj, (k, v) => { if (semOficina && k === 'bestiario') return undefined; if (typeof v !== 'string' || v.length < ASSET_MIN || !v.startsWith('data:')) return v; const c = chaveDoAsset(v); if (!_assetsNoBanco.has(c)) novos.set(c, v); return PREFIXO_ASSET + c; });
  return { txt, novos };
}
async function guardarAssets(novos) {
  if (!novos.size || typeof Config === 'undefined') return;
  await Config.gravarVarios([...novos].map(([c, v]) => ['asset:' + c, v])); novos.forEach((v, c) => _assetsNoBanco.add(c));
}
const chavesDeAssets = t => [...new Set([...String(t || '').matchAll(/"bigorna-asset:([a-z0-9-]+)"/g)].map(m => m[1]))];
/* a saved text back to the work: each key fetched (a key that is not there any more becomes an empty picture) */
async function lerComAssets(t, qualquer) {
  if (!t) return null; const ks = chavesDeAssets(t); let mapa = new Map();
  if (ks.length && typeof Config !== 'undefined') { mapa = await Config.lerVarios(ks.map(k => 'asset:' + k)); }
  let faltam = 0;
  try { const e = JSON.parse(t, (k, v) => { if (typeof v === 'string' && v.startsWith(PREFIXO_ASSET)) { const c = v.slice(PREFIXO_ASSET.length), x = mapa.get('asset:' + c); if (x === undefined) { faltam++; return ''; } _chaveDoAsset.set(x, c); _assetsNoBanco.add(c); return x; } return v; });
    if (faltam) console.warn('work: ' + faltam + ' picture(s) not found in the browser'); return e && (qualquer || e.campanha || e.projeto) ? e : null; } catch { return null; }
}
const quandoDe = t => { const m = /"quando":(\d+)\}$/.exec(t || ''); return m ? +m[1] : 0; };
function lerLocal(chave) { try { return localStorage.getItem(chave) || null; } catch { return null; } }
/* (the work is kept without its Workshop: the Workshop has its own package, guardarOficina) */
async function guardarTexto(chave, obj) {
  const { txt, novos } = textoComAssets(obj, true); await guardarAssets(novos);
  const comQuando = txt.slice(0, -1) + ',"quando":' + Date.now() + '}';
  try { localStorage.setItem(chave, comQuando); } catch { try { localStorage.removeItem(chave); } catch { } }
  await guardarNoBanco(chave, comQuando); return txt;
}
/* the newer of the two copies (the small storage's and the database's), its pictures fetched */
async function lerGuardado(chave) {
  const a = lerLocal(chave), b = await lerDoBanco(chave);
  const t = !b ? a : !a ? b : quandoDe(b) > quandoDe(a) ? b : a;
  return t ? await lerComAssets(t) : null;
}
function salvarRapido() {
  guardarTexto(CHAVE_RAPIDA, estadoAtualSemQuando()).then(() => aviso('Quick save done (kept in this browser).'), e => aviso('Quick save failed: ' + (e && e.message || e)));
}
function carregarRapido(semPergunta) {
  lerGuardado(CHAVE_RAPIDA).then(async e => {
    if (!e) return aviso('Nothing quick-saved yet.');
    if (!semPergunta && !confirm('Quick load replaces the current work with the quick save from ' + new Date(e.quando).toLocaleString() + '. Continue?')) return;
    await extrairImagens(e);
    if (aplicarEstado(e)) { camposDaMissao(); tudo(); enquadrar(); aviso('Quick load done.'); }
  });
  return 'fechar';
}
const estadoAtualSemQuando = () => ({ campanha, projeto: campanha ? null : projeto, missaoAtual, salaAtual });
/* the work in progress is kept every 2 s (only when it changed) and restored when the page is opened again */
let _estadoGuardado = null, estadoPronto = false, _guardando = null;
function temTrabalho() { return !!(projeto.salas.length || campanha || projeto.meta.name || Object.values(projeto.bestiario || {}).some(l => Array.isArray(l) && l.length)); }
function guardarEstado() {
  if ((typeof REDEFININDO !== 'undefined' && REDEFININDO) || !estadoPronto) return _guardando || Promise.resolve();
  if (EDITANDO_PADRAO) { guardarOficina(); return _guardando || Promise.resolve(); }   // (the work waits aside: only the Workshop is kept)
  try {
    guardarOficina();
    if (!temTrabalho()) return Promise.resolve();
    const { txt } = textoComAssets(estadoAtualSemQuando(), true); if (txt === _estadoGuardado) return _guardando || Promise.resolve();
    _estadoGuardado = txt;
    _guardando = (_guardando || Promise.resolve()).then(() => guardarTexto(CHAVE_ESTADO, estadoAtualSemQuando())).catch(e => { _estadoGuardado = null; console.warn('work not kept', e); });
    return _guardando;
  } catch { return Promise.resolve(); }
}
window.addEventListener('pagehide', () => { try { _adotarTodos = true; guardarEstado(); } catch { } });
document.addEventListener('visibilitychange', () => { if (document.hidden) _adotarTodos = true; });

/* ------------------------------------------------------------ the Workshop kept: a package of its own
   In the Bigorna Editor app: Pacotes/<id>/pacote.bigorna (the one marked "oficina"), written as it changes; every other
   package of that folder (imported, or brought from the community library, by the editor or by the mod) is read when the
   editor opens, and its entries come into the Workshop marked `_doPacote` (they change in a copy). In a browser: the
   browser's database and the small storage (key bigorna-oficina; the newer of the two). */
const CHAVE_OFICINA = 'bigorna-oficina';
const MEU_PACOTE = { id: '', nome: '', edicao: 1, criado: '' };
let _oficinaGuardada = null, _oficinaPronta = false, _oficinaGravando = null, _erroOficinaVisto = false, _impressaoDaOficina = null;
let PACOTES_DA_PASTA = [];   // the other packages of the folder: [{id, nome, autor, edicao, criado, n}]
const doPacote = x => !!(x && typeof x === 'object' && x._doPacote);
/* each entry of another package as it came (to know when it changed: the forge, a window of stats… change it in place;
   a changed one becomes one's own, the same id, and the package's file stays as it was) */
const _comoVeio = new Map();
const chaveDoOriginal = (k, x) => k + ':' + x._doPacote + ':' + x.id;
/* v236: a light fingerprint of an entry, or of the whole Workshop: the long strings (pictures and sounds in data: URLs) go in
   as their size, a sample of their characters and their end, so a change is seen without copying megabytes every 2 s (with
   big packages in the folder, the whole copy froze the editor at each check) */
function impressao(x, semMarca) {
  return JSON.stringify(x, (c, v) => { if (semMarca && (c === '_doPacote' || c === 'pacote')) return undefined;
    if (typeof v === 'string' && v.length > 2048) { let h = 0; for (let i = 0; i < v.length; i += 397) h = (h * 31 + v.charCodeAt(i)) | 0; return '\u00a7' + v.length + ':' + h + ':' + v.slice(-48); }
    return v; });
}
const semMarcas = x => impressao(x, true);
/* v239: the fingerprint of the work without its Workshop (the Workshop has its own; in a campaign every map points to the
   same one, and the fingerprint copied it once per map: 37 maps, over half a second every 2 s) */
function impressaoDaObra(x) {
  return JSON.stringify(x, (c, v) => { if (c === 'bestiario') return undefined;
    if (typeof v === 'string' && v.length > 2048) { let h = 0; for (let i = 0; i < v.length; i += 397) h = (h * 31 + v.charCodeAt(i)) | 0; return '\u00a7' + v.length + ':' + h + ':' + v.slice(-48); }
    return v; });
}
/* (v240: an entry of a package changed becomes one's own. Only the entries opened in a sheet (the Workshop, the heroes, the
   weapons, the skills, the feats) are compared: their edits are the user's. The others can only change by defaults the
   editor fills when it reads them, and with thousands of entries in packages, comparing all of them took a tenth of a
   second every 2 s and turned a thousand of them into one's own) */
const _tocadasF = new Set();
const assinaturaDe = x => { const t = semMarcas(x); let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } return t.length + ':' + (h1 >>> 0) + ':' + (h2 >>> 0); };
/* (an entry shown in a sheet for the first time: what the sheet fills in by itself, as it opens, is not an edit) */
function primeiraVista(x) {
  if (!x || x.id == null || _tocadasF.has(String(x.id))) return; _tocadasF.add(String(x.id)); if (!x._doPacote) return;
  setTimeout(() => { const b = oficina(); const k = Object.keys(b).find(c => Array.isArray(b[c]) && b[c].includes(x)); if (k && x._doPacote) _comoVeio.set(chaveDoOriginal(k, x), assinaturaDe(x)); }, 0);
}
function adotarMudados() {
  const abertas = _tocadasF; if (!abertas.size) return 0;
  const b = oficina(); let n = 0;
  Object.entries(b).forEach(([k, l]) => { if (Array.isArray(l)) l.forEach(x => { if (!doPacote(x) || !abertas.has(String(x.id))) return;
    const o = _comoVeio.get(chaveDoOriginal(k, x)); if (o !== undefined && o !== assinaturaDe(x)) { delete x._doPacote; delete x.pacote; n++; } }); });
  return n;
}
/* the Workshop of one's own: what came from another package stays out */
function oficinaPropria() {
  const b = oficina(), r = {};
  Object.entries(b).forEach(([k, v]) => { r[k] = Array.isArray(v) ? v.filter(x => !doPacote(x)) : v; });
  return r;
}
const pacoteDaOficina = () => ({ formato: 'bigorna-pacote', versao: 1, id: MEU_PACOTE.id, edicao: MEU_PACOTE.edicao, nome: MEU_PACOTE.nome, autor: autorGuardado() || '', criado: MEU_PACOTE.criado, oficina: true, conteudo: oficinaPropria() });
let _adotarTodos = false;
function guardarOficina(todos) {
  if (typeof REDEFININDO !== 'undefined' && REDEFININDO) return Promise.resolve();   // (v246: "Reset everything" takes the Workshop away)
  if (!_oficinaPronta) return _oficinaGravando || Promise.resolve();
  try {
    adotarMudados(); _adotarTodos = false;
    if (Arquivos.ativo) {
      if (!MEU_PACOTE.id) return Promise.resolve();
      const pk = pacoteDaOficina();
      // (the fingerprint first: the whole text only when something changed)
      const imp = impressao(pk); if (_oficinaGuardada !== null && imp === _impressaoDaOficina) return _oficinaGravando || Promise.resolve();
      _faltamOriginais.clear(); const txt = jsonOriginal(pk);
      if (_faltamOriginais.size) { buscarFaltantes().then(v => { if (v) guardarOficina(); }); return _oficinaGravando || Promise.resolve(); }   // (v238: a light copy is never written in place of its original)
      _impressaoDaOficina = imp; if (txt === _oficinaGuardada) return _oficinaGravando || Promise.resolve();
      _oficinaGuardada = txt;
      _oficinaGravando = (_oficinaGravando || Promise.resolve()).then(() => Arquivos.gravar('Pacotes/' + MEU_PACOTE.id + '/pacote.bigorna', txt))
        .then(() => { _erroOficinaVisto = false; }, e => { _oficinaGuardada = null; console.warn('workshop not kept', e); if (!_erroOficinaVisto) { _erroOficinaVisto = true; avisoLongo(tr('The Workshop could not be written in the Pacotes folder') + ': ' + (e && e.message || e)); } });
      return _oficinaGravando;
    }
    // (a copy in the small storage too, written at once: the database writes later, and a page closed right after a change
    // keeps it; the newer of the two is the one read)
    const propria = oficinaPropria(); const imp = impressao(propria); if (_oficinaGuardada !== null && imp === _impressaoDaOficina) return _oficinaGravando || Promise.resolve();
    _impressaoDaOficina = imp;
    const { txt, novos } = textoComAssets({ oficina: propria }, false); if (txt === _oficinaGuardada) return _oficinaGravando || Promise.resolve();
    _oficinaGuardada = txt; const comQuando = txt.slice(0, -1) + ',"quando":' + Date.now() + '}';
    const local = () => { try { localStorage.setItem(CHAVE_OFICINA, comQuando); } catch { try { localStorage.removeItem(CHAVE_OFICINA); } catch { } } };
    if (!novos.size) local();
    _oficinaGravando = (_oficinaGravando || Promise.resolve()).then(() => guardarAssets(novos)).then(() => { if (novos.size) local(); return guardarNoBanco(CHAVE_OFICINA, comQuando); }).catch(e => { _oficinaGuardada = null; console.warn('workshop not kept', e); });
    return _oficinaGravando;
  } catch (e) { console.warn('workshop', e); return Promise.resolve(); }
}
/* the entries of another package come into the Workshop: those with an id one's own Workshop already has stay out (one's
   copy is the one that counts); the media come into the browser like the files uploaded by hand */
function adicionarPacote(pk) {
  const b = oficina(), ct = pk.conteudo || {}, marca = { id: pk.id, edicao: pk.edicao || 1 }; let n = 0;
  Object.entries(ct).forEach(([k, l]) => {
    if (Array.isArray(l) && LISTAS_DA_OFICINA.includes(k)) { const d = b[k] = b[k] || []; const ids = new Set(d.map(y => y && y.id));
      // (v237: the package's own objects come in, with no copy: the file just read is not kept)
      l.forEach(x => { if (x && typeof x === 'object') { if (x.id == null || ids.has(x.id)) return; ids.add(x.id); const y = x; if (k === 'herois') delete y.perfil; y.pacote = marca; y._doPacote = pk.id; d.push(y); _comoVeio.set(chaveDoOriginal(k, y), assinaturaDe(y)); _aNormalizar.push([k, y]); n++; } else if (!d.includes(x)) d.push(x); }); }
    else if (k === 'padroes' && l && typeof l === 'object') Object.entries(l).forEach(([c, v]) => { if (!(c in b.padroes)) b.padroes[c] = v; });
  });
  if (typeof instalarMidia === 'function') instalarMidia(pk).catch(() => { });
  return n;
}
/* the packages of the folder (the app): the editor's file of each (pacote.bigorna), and the one that is one's Workshop */
/* v240: a package whose pictures came inside it (data: URLs) is read once: its pictures go into the store, and a copy with
   the references stays in Bigorna\Pacotes\<folder>.json, read in its place while the package file stays the same (its
   size and date). The package file itself is not changed (it belongs to the package). */
async function lerPacotesDaPasta() {
  const r = [];
  for (const p of (await Arquivos.lista('Pacotes')).filter(x => x.pasta)) {
    try {
      const info = (await Arquivos.lista('Pacotes/' + p.nome)).find(x => x.nome === 'pacote.bigorna' && !x.pasta); if (!info) continue;
      const marca = info.tam + ':' + info.quando, copia = 'Bigorna/Pacotes/' + p.nome + '.json';
      let pk = null;
      try { const c = await Arquivos.ler(copia, 'json'); if (c && c.marca === marca && c.pacote && !c.pacote.oficina) pk = c.pacote; } catch { }
      if (!pk) {
        const t = await Arquivos.ler('Pacotes/' + p.nome + '/pacote.bigorna'); if (!t) continue; pk = JSON.parse(t);
        if (!pk || pk.formato !== 'bigorna-pacote' || !pk.conteudo) continue;
        const n = await extrairImagens(pk.conteudo);
        if (n && pk.oficina) pk._extraiu = true;   // (one's own Workshop: written again with the references)
        else if (n) { try { await Arquivos.gravar(copia, JSON.stringify({ marca, pacote: pk })); } catch (e) { console.warn('package copy not kept', e); } }
      }
      if (pk && pk.formato === 'bigorna-pacote' && pk.conteudo) { pk._pasta = p.nome; pk._quando = p.quando; r.push(pk); }
    }
    catch (e) { console.warn('package ' + p.nome, e); }
  }
  return r;
}
const novoIdDaOficina = () => 'oficina-' + Math.random().toString(36).slice(2, 8);
async function carregarOficina() {
  const antes = _oficina;   // (what came in before, inside a work opened at once)
  try {
    if (Arquivos.ativo) {
      const pacotes = await lerPacotesDaPasta();
      const meus = pacotes.filter(p => p.oficina);
      const meu = meus[0] || { id: novoIdDaOficina(), nome: tr('My Workshop'), edicao: 1, criado: new Date().toISOString().slice(0, 10), conteudo: oficinaVazia() };
      Object.assign(MEU_PACOTE, { id: meu.id, nome: meu.nome || tr('My Workshop'), edicao: meu.edicao || 1, criado: meu.criado || '', _extraiu: !!meu._extraiu });
      _oficina = Object.assign(oficinaVazia(), meu.conteudo || {});
      meus.slice(1).forEach(p => absorverOficina(p.conteudo));   // (two Workshops of one's own in the folder: they join)
      oficina();
      const outros = pacotes.filter(p => !p.oficina);
      outros.forEach(adicionarPacote);
      PACOTES_DA_PASTA = outros.map(p => ({ id: p.id, nome: p.nome || p.id, autor: p.autor || '', edicao: p.edicao || 1, criado: p.criado || '', n: typeof contarPacote === 'function' ? contarPacote(p) : 0, pasta: p._pasta }));
      // (v241: each package of the folder with the file the mod reads, pacote.json, and its pictures beside it: the maps
      // that require it take its assets from there)
      setTimeout(() => { if (typeof garantirPacotesDoMod === 'function') garantirPacotesDoMod(outros).catch(e => console.warn('pacote.json', e)); }, 2500);
    } else {
      const a = lerLocal(CHAVE_OFICINA), d = await lerDoBanco(CHAVE_OFICINA);
      const t = !d ? a : !a ? d : quandoDe(d) > quandoDe(a) ? d : a;
      const e = t ? await lerComAssets(t, true) : null;
      if (e?.oficina) await extrairImagens(e.oficina);
      _oficina = Object.assign(oficinaVazia(), e?.oficina || {});
      _oficinaGuardada = t ? t.replace(/,"quando":\d+\}$/, '}') : null;
    }
  } catch (e) { console.warn('workshop not read', e); if (!_oficina) _oficina = oficinaVazia(); }
  (_oficina.herois || []).forEach(h => { const d = h && Object.getOwnPropertyDescriptor(h, 'perfil'); if (d && 'value' in d) delete h.perfil; });
  if (antes && antes !== _oficina) absorverOficina(antes);
  normalizarOficina(_oficina); oficina();
  // (v236: the Workshop as it came from the file is not written again until it changes: before, the 10 MB went out at each opening)
  if (Arquivos.ativo && MEU_PACOTE.id) { try { _impressaoDaOficina = MEU_PACOTE._extraiu ? null : impressao(pacoteDaOficina()); _oficinaGuardada = ''; } catch { } }
  _oficinaPronta = true;
}
function apagarEstadoGuardado() { _estadoGuardado = null; try { localStorage.removeItem(CHAVE_ESTADO); } catch { } guardarNoBanco(CHAVE_ESTADO, undefined); }
/* the work kept in the small storage with its pictures inside (an older version): opened at once; else (restaurarDoBanco) */
function restaurarEstado() {
  const t = lerLocal(CHAVE_ESTADO); restaurarEstado.quando = 0;
  if (!t || chavesDeAssets(t).length) return false;
  let e = null; try { e = JSON.parse(t); } catch { } if (!e || !(e.campanha || e.projeto)) return false;
  restaurarEstado.quando = e.quando || 0;
  return aplicarEstado(e);
}
async function restaurarDoBanco() {
  try {
    await carregarOficina(); carregarAudios().catch(() => { });
    try { if (typeof Config !== 'undefined') (await Config.chavesCom('asset:')).forEach(k => _assetsNoBanco.add(k.slice(6))); } catch { }
    const e = await lerGuardado(CHAVE_ESTADO);
    if (e) await extrairImagens(e);
    if (e && (e.quando || 0) > (restaurarEstado.quando || 0) && aplicarEstado(e)) return true;
    return false;
  } finally { estadoPronto = true; setTimeout(limparAssets, 15000); }
}
/* the pictures no saved copy (the work, the quick save) uses any more leave the database */
async function limparAssets() {
  try {
    if (typeof Config === 'undefined') return;
    const usados = new Set(); for (const ch of [CHAVE_ESTADO, CHAVE_RAPIDA]) { chavesDeAssets(lerLocal(ch)).forEach(k => usados.add(k)); chavesDeAssets(await lerDoBanco(ch)).forEach(k => usados.add(k)); }
    for (const ch of [CHAVE_OFICINA]) { chavesDeAssets(lerLocal(ch)).forEach(k => usados.add(k)); chavesDeAssets(await lerDoBanco(ch)).forEach(k => usados.add(k)); }   // (the Workshop's own)
    const { txt } = textoComAssets({ e: estadoAtualSemQuando(), o: Arquivos.ativo ? null : oficinaPropria() }, true); chavesDeAssets(txt).forEach(k => usados.add(k));   // (and what is on screen, not yet kept)
    const sobra = (await Config.chavesCom('asset:')).filter(k => !usados.has(k.slice(6)));
    if (sobra.length) { await Config.apagarVarios(sobra); sobra.forEach(k => _assetsNoBanco.delete(k.slice(6))); }
  } catch { }
}
function autorGuardado() { try { return localStorage.getItem(CHAVE_AUTOR) || ''; } catch { return ''; } }
function guardarAutor(a) { try { localStorage.setItem(CHAVE_AUTOR, a || ''); } catch { } }
