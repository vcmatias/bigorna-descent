/* Bigorna Rooms: the game data the editor works with.
   Nothing from the game ships with the editor. The Bigorna mod reads the player's own copy of Descent: Legends of the
   Dark and writes bigorna-game-data.js (tiles, catalog, English texts, pictures, sounds, world map destinations) and
   bigorna-worldmap.js (the world map, pictured in the game) next to the editor. The loader at the end of the page
   puts them in window.BIGORNA_JOGO and window.BIGORNA_MAPA before this code runs. */
'use strict';

const JOGO = window.BIGORNA_JOGO || {};
const MAPAS_DO_JOGO = window.BIGORNA_MAPA || {};

/* the placeable objects the Bigorna mod knows how to put on the board: id (the mod's name for it), size in squares
   and the act whose box brings it */
const OBJETOS_DO_JOGO = [
  { id: 'Chest', name_en: 'Chest', w: 1, h: 1, act: 1 },
  { id: 'Shelf', name_en: 'Bookshelf', w: 2, h: 1, act: 1 },
  { id: 'Lectern', name_en: 'Lectern', w: 1, h: 1, act: 1 },
  { id: 'Well', name_en: 'Well', w: 1, h: 1, act: 1 },
  { id: 'Cauldron', name_en: 'Cauldron', w: 1, h: 1, act: 1 },
  { id: 'Door', name_en: 'Door', w: 2, h: 1, act: 1 },
  { id: 'SightToken', name_en: 'Point of interest', w: 1, h: 1, act: 1 },
  { id: 'InteractToken', name_en: 'Interact token', w: 1, h: 1, act: 1 },
  { id: 'Bell', name_en: 'Bell', w: 4, h: 1, act: 2 },
  { id: 'BellFrame', name_en: 'Bell frame', w: 4, h: 1, act: 2 },
  { id: 'BloodShrine', name_en: 'Blood shrine', w: 1, h: 1, act: 2 },
  { id: 'Fire', name_en: 'Fire', w: 1, h: 1, act: 2 },
  { id: 'Ladder', name_en: 'Ladder', w: 1, h: 1, act: 2 },
  { id: 'Statue', name_en: 'Statue', w: 3, h: 3, act: 2 },
  { id: 'Wagon', name_en: 'Wagon', w: 3, h: 2, act: 2 },
  { id: 'Archway', name_en: 'Archway', w: 4, h: 1, act: 1 },
  { id: 'Barricade', name_en: 'Spiked barricade', w: 2, h: 1, act: 1 },
  { id: 'Bridge', name_en: 'Bridge', w: 6, h: 2, act: 2 },
  { id: 'DragonArch', name_en: 'Dragon arch', w: 7, h: 6, act: 1 },
  { id: 'DragonHead', name_en: 'Dragon head', w: 2, h: 3, act: 1 },
  { id: 'Gate', name_en: 'Gate', w: 2, h: 1, act: 1 },
  { id: 'Pillar', name_en: 'Pillar', w: 1, h: 1, act: 1 },
  { id: 'PillarShort', name_en: 'Short pillar', w: 1, h: 1, act: 1 },
  { id: 'PillarTall', name_en: 'Tall pillar', w: 1, h: 1, act: 1 },
  { id: 'PillarPush', name_en: 'Interactive pillar', w: 1, h: 1, act: 1 },
  { id: 'LadderMedium', name_en: 'Medium ladder', w: 1, h: 1, act: 2 },
  { id: 'RoundTable', name_en: 'Round table', w: 1, h: 1, act: 1 },
  { id: 'Staircase', name_en: 'Staircase', w: 3, h: 2, act: 1 },
  { id: 'StoneTable', name_en: 'Stone table', w: 2, h: 1, act: 1 },
  { id: 'Tree', name_en: 'Tree', w: 1, h: 1, act: 1 }
];

const DADOS = {
  tiles: JOGO.tiles || [],
  interactables: OBJETOS_DO_JOGO.map(o => ({ ...o })),
  backgrounds: JOGO.backgrounds || [],
  sounds: JOGO.sounds || {},
  cutscenes: JOGO.cutscenes || []
};
/* the game box of Act I used as a platform (its top at level 3): the footprint of the platform of Act II, which the game has
   (the mod shows it in the game with that model, taller) */
if (!DADOS.tiles.some(t => t.id === 'gamebox')) { const pl = DADOS.tiles.find(t => t.id === 'platform'); if (pl) DADOS.tiles.push({ ...pl, id: 'gamebox', act: 1, floor: 'wood' }); }
/* the world map: the editor draws the destinations on the same 1600×900 frame the game uses (origin at the centre, y up) */
const ARTE = { worldmap: MAPAS_DO_JOGO.act1 || MAPAS_DO_JOGO.act2 || '' };
const MUNDO = { map: { canvas: [1600, 900] }, quests: (JOGO.destinos || {}).quests || [], narrativeEvents: (JOGO.destinos || {}).narrativeEvents || [] };
window.CATALOGO = JOGO.catalogo || { monstros: [], ativacoes: {}, itens: [], receitas: [], loots: [], personagens: [], herois: [], facanhas: [], habilidades: [] };
window.RETRATOS = JOGO.retratos || { monstros: {}, itens: {}, personagens: {}, herois: {} };
