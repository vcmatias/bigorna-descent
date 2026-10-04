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
const ehChaveCrua = t => typeof t === 'string' && /^[A-Z0-9_']+$/.test(t) && /[A-Z]/.test(t) && t.includes('_');
function nomeLegivel(n) {
  let s = String(n || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^UNUSED\s+/i, '').replace(/^(A\d)?S?Q\d+[A-Z]?\s*(-\s*)?/i, '').replace(/^\d+\s+/, '').replace(/^E\d+\s+/, '').replace(/^(Final\s+)?Boss\s+/i, '');
  if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/(^|\s)\w/g, c => c.toUpperCase());
  return s || String(n || '');
}
CAT.monstros.forEach(m => { if (ehChaveCrua(m.name_en)) { m._chave = m.name_en; m.name_en = nomeLegivel(m._name) || m.name_en; } if (ehChaveCrua(m.plural_en)) m.plural_en = m.name_en; });
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
const nomeObj = id => varObj(id)?.nome || OBJETO[id]?.name_en || id;
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
const clone = x => JSON.parse(JSON.stringify(x));
/* runs fn with map p as the map on screen (what reads "projeto" sees p), and puts the map on screen back */
function comProjeto(p, fn) { const antes = projeto; projeto = p; try { return fn(); } finally { projeto = antes; } }

// ------------------------------------------------------------ state
function projetoNovo() {
  return { meta: { name: '', author: '', intro: '', description: '', music: '', background: '', scene: '', finalMission: { tipo: 'defeat_all', texto: '', rodadas: 8 }, limite: 0 },
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
const C = 30;
const IMG = {};

let avisoT;
function aviso(t, longo) { const a = $('#aviso'); a.textContent = t; a.classList.add('mostra'); clearTimeout(avisoT); if (!longo) avisoT = setTimeout(() => a.classList.remove('mostra'), 3000); }
function avisoLongo(t, ms) { aviso(t, true); avisoT = setTimeout(() => $('#aviso').classList.remove('mostra'), ms || 7000); }

/* the workshop in use: the campaign's (shared by its maps) or the map's own. Kept under the old key `bestiario` in the files. */
function oficina() { const b = campanha ? (campanha.bestiario = campanha.bestiario || oficinaVazia()) : (projeto.bestiario = projeto.bestiario || oficinaVazia()); ['monstros', 'personagens', 'itens', 'pecas', 'objetos', 'herois', 'armas', 'maos', 'receitas', 'facanhas', 'poolFacanhas', 'pericias'].forEach(k => { b[k] = b[k] || []; }); if (!b.padroes || typeof b.padroes !== 'object' || Array.isArray(b.padroes)) b.padroes = {}; nomesNaLinguaDoJogo(b); return b; }
const bestiario = oficina;
const MONSTROS = () => bestiario().monstros;
const PERSONAGENS_B = () => bestiario().personagens;
const ITENS_B = () => bestiario().itens;
/* custom music of the maps: the files live in the browser (IndexedDB) and go next to the map files when exported */
const AUDIOS = {};
async function guardarAudio(nome, blob) { AUDIOS[nome] = blob; await Config.guardarBlob('audio:' + nome, blob); }
async function carregarAudios() {
  const nomes = new Set(); const ver = p => { if (p && p.meta && p.meta.musica && p.meta.musica.arquivo) nomes.add(p.meta.musica.arquivo); };
  ver(projeto); (campanha && campanha.missoes || []).forEach(ver);
  // videos: boxes of the scenes and "Play a video" triggers
  (campanha?.dialogos || []).forEach(d => { if (d.video?.arquivo) nomes.add(d.video.arquivo); });
  [campanha?.meta?.mapaProprio, campanha?.meta?.cidade].forEach(a => { if (a?.arquivo) nomes.add(a.arquivo); });
  [projeto?.bestiario, campanha?.bestiario].forEach(b => (b?.objetos || []).forEach(v => { if (v.modelo?.arquivo) nomes.add(v.modelo.arquivo); }));
  [projeto?.bestiario, campanha?.bestiario].forEach(b => (b?.monstros || []).forEach(m => { if (m.modelo?.arquivo) nomes.add(m.modelo.arquivo); Object.values(m.sons?.arquivos || {}).forEach(a => a?.arquivo && nomes.add(a.arquivo)); }));
  [projeto, ...(campanha?.missoes || [])].forEach(p => (p?.salas || []).forEach(s => donosDaSala(s).forEach(({ o }) => todosGatilhos(o).forEach(g => { if (g.video?.arquivo) nomes.add(g.video.arquivo); if (g.som?.arquivo) nomes.add(g.som.arquivo); }))));
  for (const n of nomes) if (!AUDIOS[n]) { try { const b = await Config.lerBlob('audio:' + n); if (b) AUDIOS[n] = b; } catch { } }
}
/* the music files a set of exported map documents needs: [{nome, texto: Blob|null, sub}] */
/* the media files (music, videos of "Play a video") a set of exported map documents needs: [{nome, texto: Blob|null, sub}] */
/* the media files the actions of a map use (videos and own sounds), also inside branches and answers */
const videosDoMapa = d => { const r = []; const anda = x => { if (Array.isArray(x)) x.forEach(anda); else if (x && typeof x === 'object') { if ((x.id === 'playVideo' || x.id === 'playSound') && x.params && x.params.file) r.push(x.params.file); Object.values(x).forEach(anda); } }; anda(d && d.triggers); return r; };
const musicasDosMapas = (docs, sub) => [...new Set(docs.flatMap(d => [d && d.meta && d.meta.music && d.meta.music.file, ...videosDoMapa(d), ...((d && d.custom && d.custom.objects) || []).map(o => o.model), ...((d && d.custom && d.custom.enemies) || []).flatMap(e => [e.model, ...(e.sounds && e.sounds.mode === 'files' ? ['spawn', 'attack', 'defend', 'defeat'].map(k => e.sounds[k]) : [])])]).filter(Boolean))].map(nome => ({ nome, texto: AUDIOS[nome] || null, sub }));
/* the videos of the scenes of a campaign (files next to the .dcamp) */
const videosDasCenas = (dcamp, sub) => [...new Set([...(dcamp?.dialogues || []).filter(d => d.type === 'video' && d.video).map(d => d.video), dcamp?.meta?.worldMap?.file, dcamp?.meta?.city?.file].filter(Boolean))].map(nome => ({ nome, texto: AUDIOS[nome] || null, sub }));
const monstro = id => MONSTROS().find(m => m.id === id) || null;
/* "Balanced from enemy pool": a space of the room the game fills by its own rule for random spawns (the room's spawn
   pool, the map's tier range, points from the number of heroes). See regraDoBalanceio and simularBalanceio. */
const POOL_ID = '@pool';
const ehPool = id => id === POOL_ID;
/* its picture: the Enemy tool's ghost, light on the blue of the balanced spaces (built on first use: the glyphs live in desenho.js) */
let _iconePool = null;
const iconePool = () => _iconePool || (_iconePool = icone('Enemy', '#f3cf8f', '#22364c'));
const nomeIni = id => ehPool(id) ? 'Balanced from enemy pool' : monstro(id)?.nome || id || '?';
const runaDoItem = id => typeof id === 'string' && id.startsWith('RUNA:') ? (oficina().armas || []).find(a => a.runa && a.id === id.slice(5)) : null;
const receitaDoItem = id => typeof id === 'string' && id.startsWith('RECEITA:') ? (oficina().receitas || []).find(r => r.id === id.slice(8)) : null;
const nomeItem = id => receitaDoItem(id) ? nomeReceita(receitaDoItem(id)) : runaDoItem(id) ? 'Rune: ' + (runaDoItem(id).nova?.nome || 'New rune') : ITENS_B().find(i => i.id === id)?.nome || LOOT.find(l => l.id === id)?.name_en || id;
/* the items that may be handed out: only the workshop's (item 4 of the 24/09 batch). Old projects may still point at game loot ids: those are kept but flagged */
const itemDaOficina = id => !!ITENS_B().find(i => i.id === id) || !!runaDoItem(id) || !!receitaDoItem(id);
const opcoesItens = atual => ITENS_B().map(i => `<option value="${esc(i.id)}" ${atual === i.id ? 'selected' : ''}>${esc(i.nome)}</option>`).join('') + ((oficina().armas || []).some(a => a.runa) ? `<optgroup label="Runes of the workshop (the weapon comes with its rune)">${oficina().armas.filter(a => a.runa).map(a => `<option value="RUNA:${esc(a.id)}" ${atual === 'RUNA:' + a.id ? 'selected' : ''}>${esc(nomeItem('RUNA:' + a.id))}</option>`).join('')}</optgroup>` : '') + ((oficina().receitas || []).length ? `<optgroup label="Recipes of the workshop (the party learns it)">${oficina().receitas.map(r => `<option value="RECEITA:${esc(r.id)}" ${atual === 'RECEITA:' + r.id ? 'selected' : ''}>${esc(nomeReceita(r))}</option>`).join('')}</optgroup>` : '') + (atual && !itemDaOficina(atual) ? `<option value="${esc(atual)}" selected>${esc(nomeItem(atual))} (not in the workshop!)</option>` : '');
/* heroes drawn at random from the party when a scene plays (the mod picks two different ones each time): @hero1, @hero2;
   {hero1} and {hero2} in the text become their names. @actor is the hero who used the object that plays the scene
   ({actor} in the text); a scene played by nothing a hero used takes a random one */
const HEROIS_SORTEADOS = [{ id: '@hero1', nome: 'Random hero 1' }, { id: '@hero2', nome: 'Random hero 2' }, { id: '@actor', nome: 'The hero who used the object' }];
const nomePersonagem = id => { const s = HEROIS_SORTEADOS.find(h => h.id === id); if (s) return tr(s.nome); return PERSONAGENS_B().find(p => p.id === id)?.nome || id || ''; };
function retratoDoMonstro(m) { if (!m) return ''; if (m.retrato) return m.retrato; const b = chaveArte(m.textureTab); return RETRATOS.monstros[b] || ''; }
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
  const oc = ocupacao(sala, indice, ehAlfombra(p.tile), p.level || 0); if (casasDaPeca(p).some(([x, y]) => oc.has(x + ',' + y))) return true;
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
const rotulo = o => o.ehContador ? 'Counter “' + (o.nome || '?') + '”' : o.enemy ? nomeIni(o.enemy) : (o.name || nomeObj(o.type));
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
function pecasSemApoio() { const r = []; projeto.salas.forEach((s, si) => s.pecas.forEach((p, pi) => { if (ehAlfombra(p.tile) || ehCaixa(p.tile) || !(p.level > 0)) return; if (!(p.pilares || []).length) r.push({ p, si, pi }); })); return r; }

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
  if (ehDaOficina(num)) return 1; const t = PECAS.find(x => numeroDaPeca(x.id) === num); return t && (t.act || 1) > atos ? 0 : 1; }
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
  s.pecas.forEach(q => { if (!defPeca(q.tile)) { p.push('a workshop tile of this room no longer exists'); return; } if (!ehAlfombra(q.tile) && !ehCaixa(q.tile) && q.level > 0 && !(q.pilares || []).length) p.push('tile ' + nomePeca(q.tile) + ' is elevated with no pillars (warning)'); const enc = encaixesDaPeca(q); (q.pilares || []).forEach(x => { if (!enc.has(x.pos.join(','))) p.push('tile ' + nomePeca(q.tile) + ': the pillar at ' + x.pos.join(',') + ' is not in a socket (warning)'); }); });
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
      if (g.tipo === 'counter' && !g.contador) p.push('"' + rotulo(o) + '": count without a counter');
      if (g.tipo === 'remove_room' && !projeto.salas[g.sala]) p.push('"' + rotulo(o) + '": remove room without a room');
      if (g.tipo === 'remove_tile' && !projeto.salas[g.sala]?.pecas[g.peca]) p.push('"' + rotulo(o) + '": remove tile without a tile');
      if (g.tipo === 'scene' && !(g.caixas || []).some(c => c.text)) p.push('"' + rotulo(o) + '": scene without text');
      if (g.tipo === 'rounds' && !(o['rodada:' + g.uid] || []).length) p.push('"' + rotulo(o) + '": every N rounds with nothing inside');
      if (g.tipo === 'rounds' && (o['rodada:' + g.uid] || []).some(x => ['skill_test', 'choice', 'rounds'].includes(x.tipo))) p.push('"' + rotulo(o) + '": every N rounds holds a skill test, a choice or another “Every N rounds”: take it out');
      if (g.tipo === 'counter' && g.acao === 'use' && !(o['conta:' + g.uid] || []).length) p.push('"' + rotulo(o) + '": use a count with nothing inside');
      if (g.tipo === 'add_tile' && !projeto.salas[g.sala]?.pecas[g.peca]) p.push('"' + rotulo(o) + '": add tile without a tile');
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
function normalizarOficina(b) {
  if (!b) return b; b.pecas = b.pecas || []; b.objetos = b.objetos || [];
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
  return b;
}
function normalizar(p) {
  p.meta = p.meta || {}; p.meta.finalMission = p.meta.finalMission || { tipo: 'defeat_all', texto: '', rodadas: 8 }; p.meta.limite = p.meta.limite || (p.objetivo?.limite) || 0;
  if (p.meta.music === undefined) p.meta.music = ''; if (p.meta.background === undefined) p.meta.background = ''; if (p.meta.scene === undefined) p.meta.scene = '';
  p.reserva = p.reserva || []; p.itensPool = p.itensPool || []; p.contadores = (p.contadores || []).filter(c => c && c.nome); p.contadores.forEach(c => { c.id = c.id || uid(); c.ehContador = true; c.gatilhos = c.gatilhos || []; });
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
  campanha = { meta: { name: '', author: projeto.meta.author || '', description: '' }, intro: '', missoes: [projeto], nos: [], dialogos: [], bestiario: projeto.bestiario || { monstros: [], personagens: [], itens: [] } };
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
  return true;
}
function salvarRapido() { try { localStorage.setItem(CHAVE_RAPIDA, JSON.stringify(estadoAtual())); aviso('Quick save done (kept in this browser).'); } catch (e) { aviso('Quick save failed: ' + e.message); } }
function carregarRapido(semPergunta) {
  let e = null; try { e = JSON.parse(localStorage.getItem(CHAVE_RAPIDA) || 'null'); } catch { }
  if (!e) return aviso('Nothing quick-saved yet.');
  if (!semPergunta && !confirm('Quick load replaces the current work with the quick save from ' + new Date(e.quando).toLocaleString() + '. Continue?')) return;
  if (aplicarEstado(e)) { camposDaMissao(); tudo(); enquadrar(); aviso('Quick load done.'); }
  return 'fechar';
}
/* the work in progress is kept in the browser every 2 s and restored when the page is opened again */
function guardarEstado() { if (typeof REDEFININDO !== 'undefined' && REDEFININDO) return; try { if (projeto.salas.length || campanha || projeto.meta.name || Object.values(projeto.bestiario || {}).some(l => Array.isArray(l) && l.length)) localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estadoAtual())); } catch { } }
function restaurarEstado() {
  let e = null; try { e = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || 'null'); } catch { }
  if (!e || !(e.campanha || e.projeto)) return false;
  if (!aplicarEstado(e)) return false;
  return true;
}
function autorGuardado() { try { return localStorage.getItem(CHAVE_AUTOR) || ''; } catch { return ''; } }
function guardarAutor(a) { try { localStorage.setItem(CHAVE_AUTOR, a || ''); } catch { } }
