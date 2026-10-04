/* Bigorna Rooms v2 — export (.dmap v3, .dcamp v2), open, import rooms, autosave, settings, start-up. */
'use strict';

const idExportado = id => { const m = monstro(id); return m ? (m.custom || !m.base ? m.id : m.base) : id; };
const varDesbloqueio = noId => 'unlock-' + noId;
const idItemExportado = id => { if (typeof id === 'string' && id.startsWith('RECEITA:')) return idReceitaExportada(id.slice(8)); if (typeof id === 'string' && id.startsWith('RUNA:')) return 'BIGORNA_RUNE_' + id.slice(5) + '_A'; const i = ITENS_B().find(x => x.id === id); return i ? (i.custom || !i.base ? i.id : i.base) : id; };
const idPersonagemExportado = id => { const p = PERSONAGENS_B().find(x => x.id === id); return p ? (p.custom || !p.base ? p.id : p.base) : id; };
/* the custom sheets the mod must inject: every bestiary entry that is custom (edited, created or with its own portrait) */
/* the top of a block goes to the game as PNG: a drawn icon (SVG) is rasterised beforehand and kept here */
const TOPOS = {};
const sigTopo = v => (v.glifo || 'Oficina') + '|' + (v.cor || '');
async function svgParaPng(src, lado) { const i = new Image(); await new Promise((r, f) => { i.onload = r; i.onerror = f; i.src = src; }); const c = document.createElement('canvas'); c.width = c.height = lado; c.getContext('2d').drawImage(i, 0, 0, lado, lado); return c.toDataURL('image/png'); }
async function prepararTopos() {
  for (const b of [projeto && projeto.bestiario, campanha && campanha.bestiario].filter(Boolean)) for (const v of (b.objetos || []))
    if (v.exibir === 'block' && !v.topo && !v.icone && !TOPOS[sigTopo(v)]) { try { TOPOS[sigTopo(v)] = await svgParaPng(iconeObj(v.id), 256); } catch (e) { console.warn('block top', e); } }
}
/* the defense text goes out only when it differs from the behaviour monster's (so the game keeps its translation) */
function defesaExportada(m) {
  const c = CAT.monstros.find(z => z._id === (m.comportamento || m.base)); const t = (m.defesa || '').trim();
  if (!t || (c && t === (c.defense_en || '').trim() && !!m.defesaApos === !!c.ShowDefenseAfterAttack)) return {};
  return { defense: t, defenseAfterAttack: !!m.defesaApos };
}
/* the automatic part of the defense: left out when it is the behaviour monster's */
function efeitoDefesaExportado(m) {
  const modo = m.defesaModo || 'jogo'; if (modo === 'jogo') return {};
  return { defenseEffect: modo === 'nenhum' ? 'none' : 'custom', defenseEffects: modo === 'proprio' ? (m.defesaEfeitos || []).map(f => ({ kind: f.tipo, amount: f.n || 1 })) : [] };
}
function conteudoCustom() {
  const b = bestiario();
  return {
    enemies: b.monstros.filter(m => m.custom || !m.base).map(m => ({ id: m.id, base: m.base || '', behaviour: m.comportamento || m.base || '', type: m.tipo, name: m.nome, plural: m.plural || m.nome, description: m.desc || '', size: m.size || 0, named: !!m.named, villain: !!m.villain,
      tiers: (m.tiers || []).map(t => ({ tier: t.tier, health: t.hp, defense: t.def, attack: t.atk })), mechanical: m.mec || [], theme: m.tema || [], strength: m.strength || 0,
      weaknesses: (m.wr || []).map(w => ({ damage: w.dano, kind: w.tipo, when: w.quando || 'always' })), immune: m.imune || [],
      activations: (m.ativacoes || []).map(a => ({ ...a })), tactics: (m.taticas || []).map(a => ({ ...a })), loot: (m.loot || []).map(idItemExportado), sounds: sonsExportados(m), portrait: m.retrato || '', ...defesaExportada(m), ...efeitoDefesaExportado(m),
      ...(m.figura === 'standee' && m.standee ? { standee: m.standee, standeeScale: m.escalaStandee || 1 } : {}), ...(m.figura === 'modelo' && m.modelo ? { model: m.modelo.arquivo, modelTexture: m.modeloTex || '', modelScale: m.escalaModelo || 1, modelTurn: m.giroModelo || 0 } : {}), ...(m.arteModo === 'imagem' && m.arte ? { art: m.arte, artScale: m.arteEscala ?? 1, artRaise: m.arteAltura ?? 0, artShift: m.arteLado ?? 0 } : {}) })),
    items: b.itens.filter(i => i.custom || !i.base).map(i => ({ id: i.id, base: i.efeitoBase || i.base || '', kind: i.cls, name: comGlifoDoJogo(i.nome), description: i.desc || '', rarity: i.raridade || 1, value: i.valor || 0, unique: !!i.unico, weaponClass: i.classe || '', slot: i.slot || '', traits: i.traits || [], damage: i.dano || 0, ability: i.habilidade === '-' ? '' : i.habilidade || '', ...(i.cls === 'WeaponPartsModel' && !i.habilidade && i.habTexto ? { abilityText: i.habTexto, abilityChance: i.slot === 'A' ? 0 : (i.habChance ?? 30) } : {}), ...(i.cls === 'WeaponPartsModel' && i.habilidade === '-' ? { noAbility: true } : {}), ...(i.cls === 'CraftingMaterialModel' ? { materialType: +i.tipoMaterial || 0 } : {}), portrait: i.retrato || '' })),
    heroes: heroisExportados(),
    weapons: armasExportadas(),
    recipes: receitasExportadas(),
    skills: periciasExportadas(), feats: facanhasExportadas(), featPool: poolFacanhasExportado(),
    heroWeapons: (b.maos || []).map(x => ({ hero: x.id, weapons: x.classes.map(k => armaDaClasse(k)?._id).filter(Boolean) })).filter(x => x.weapons.length === 2),
    characters: b.personagens.filter(p => p.custom || !p.base).map(p => ({ id: p.id, base: p.base || '', role: 'npc', name: p.nome, portrait: p.retrato || '' })),
    // workshop tiles and objects: the squares (tile: relative to pos, turned by rot like a game tile; object: its footprint is also written on each placement) and the colour
    tiles: (b.pecas || []).map(v => ({ id: v.id, name: v.nome || 'Tile', cells: (v.cells || [[0, 0]]).map(c => [c[0], c[1]]), colour: v.cor || '#8a7a66',
      ...(v.underlay ? { underlay: true, copies: Math.max(1, +v.copias || 1) } : {}),
      ...(v.texModo === 'inteira' && v.texInteira ? { texture: v.texInteira } : {}),
      ...(v.texModo === 'repetida' && v.texRepetida ? { squareTexture: v.texRepetida } : {}) })),
    objects: (b.objetos || []).map(v => ({ id: v.id, name: v.nome || 'Object', cells: (v.cells || [[0, 0]]).map(c => [c[0], c[1]]), colour: v.cor || '#e0b070', icon: v.icone || '', display: v.exibir === 'standee' && v.standee ? 'standee' : v.exibir === 'block' ? 'block' : 'token', ...(v.exibir === 'standee' && v.standee ? { standee: v.standee, standeeHeight: v.alturaStandee || 1.4 } : {}), ...(v.exibir === 'block' ? { blockTop: v.topo || v.icone || TOPOS[sigTopo(v)] || '', blockHeight: v.alturaBloco || 0.6 } : {}), ...(v.exibir === 'model' && v.modelo ? { display: 'model', model: v.modelo.arquivo, modelTexture: v.modeloTex || '', modelHeight: v.alturaModelo || 1, modelTurn: v.giroModelo || 0 } : {}) })),
  };
}
/* the helpers that read the global `projeto` (a monster picked on the board, the totals of the counters) must read the map
   being built: a campaign exports every map, not only the one open */
/* the versions of the file formats this editor writes. A map published stays valid for good: a new version only adds
   (keys, triggers, parameters), never renames, removes or changes the type of what is there; the version goes up only
   when an old mod would read a new map wrong. tools/compat.py checks it (rules in compat/LEIAME.md) */
const VERSAO_DMAP = 3, VERSAO_DCAMP = 2;
function montarDmap(p = projeto) { return comProjeto(p, () => montarDmapDe(p)); }
function montarDmapDe(p) {
  const grupo = i => 'room-' + (i + 1);
  const tiles = [], enemies = [], interactables = [], triggers = [], optional = [];
  const indiceDe = new Map(), indicePeca = new Map();
  /* a monster with "when defeated" triggers carries a tag: the mod fires enemyDefeated with it */
  const marcas = new Map(); const marcaDe = e => { if (!todosGatilhos(e).length) return 0; if (!marcas.has(e)) marcas.set(e, marcas.size + 1); return marcas.get(e); };
  const inimigoExportado = (e, group, si) => ehPool(e.enemy) && si !== undefined
    ? { enemy: POOL_ID, pos: [e.pos[0], e.pos[1]], group: group + '-pool', tier: 0, level: e.level || 0, pool: poolDe(p, si).filter(id => monstro(id)).map(idExportado), intensity: intensidadeDaSala(p.salas[si]) }
    : { enemy: idExportado(e.enemy), pos: [e.pos[0], e.pos[1]], group, tier: (e.tierPorHerois ? e.tierPorHerois[1] : e.tier) || 0, level: e.level || 0, ...(e.tierPorHerois ? { tierByHeroes: e.tierPorHerois.slice(0, 4) } : {}), ...(marcaDe(e) ? { tag: marcaDe(e) } : {}), ...(e.bonusAtaque ? { attackBonus: e.bonusAtaque } : {}), ...(e.bonusDefesa ? { defenseBonus: e.bonusDefesa } : {}) };
  let niveis = 1;
  /* tiles added by a trigger ("Add a tile"): hidden in their own group, with the objects on them */
  const adicionadas = pecasAdicionadas(p), casaAdicionada = new Map();
  adicionadas.forEach((gr, k) => { const [si, qi] = k.split(':').map(Number); const q = p.salas[si].pecas[qi]; if (!ehAlfombra(q.tile)) casasDaPeca(q).forEach(([x, y]) => casaAdicionada.set(x + ',' + y + ',' + (q.level || 0), gr)); });
  const grupoDoObjeto = o => casaAdicionada.get(o.pos[0] + ',' + o.pos[1] + ',' + (o.level || 0)) || null;   // by its anchor space, as the mod does
  p.salas.forEach((s, si) => {
    s.pecas.forEach((q, qi) => { niveis = Math.max(niveis, (q.level || 0) + 1); indicePeca.set(si + ':' + qi, tiles.length); const gAd = adicionadas.get(si + ':' + qi); tiles.push({ tile: q.tile, pos: [q.pos[0], q.pos[1]], rot: q.rot || 0, level: q.level || 0, ...(gAd ? { reveal: gAd } : si > 0 ? { reveal: grupo(si) } : {}), pillars: (q.pilares || []).map(x => ({ pos: [x.pos[0], x.pos[1]], type: x.type })) }); });
    s.objetos.forEach(o => {
      indiceDe.set(o, interactables.length);
      interactables.push({ type: ehTipo(o, 'PillarObj') ? (SUPORTES[o.tamanho] ? o.tamanho : 'Pillar') : ehTipo(o, 'PillarPush') && o.tamanho === 'PillarShort' ? 'PillarPushShort' : ehDaOficina(o.type) ? 'InteractToken' : o.type, ...(ehDaOficina(o.type) ? { custom: o.type, cells: casasDoObjeto(o) } : {}), pos: [o.pos[0], o.pos[1]], rot: o.rot || 0, level: o.level || 0, name: o.name || varObj(o.type)?.nome || '', text: o.textUse || '', preview: o.textClick || '', ...(o.textGasto ? { spent: o.textGasto } : {}),
        loot: { mode: 'none', items: [], traits: [], points: 0 }, behavior: 'custom', freeAction: false, uses: o.usos || '', ...(o.hidden ? { hidden: true } : {}), ...(grupoDoObjeto(o) ? { reveal: grupoDoObjeto(o) } : si > 0 ? { reveal: grupo(si) } : {}), ...(ehTipo(o, 'PillarObj') || ehTipo(o, 'PillarPush') ? { anchor: 'cell' } : {}) });
    });
    (s.inimigos || []).forEach(e => enemies.push(inimigoExportado(e, grupo(si), si)));
  });
  const gruposDe = (si, g) => g.alvo === 'all' ? [null] : g.alvo === 'group' ? (g.grupo ? [g.grupo] : []) : gruposDaSalaDe(p, si);   // no group picked: nothing (not every monster)
  const missoesObj = {};
  /* "You may perform an additional action" (the game's own sentence, shown in its language by the mod): at the end of the
     last text of what a list does, or on its own */
  // twins: a second point of interest that stands for another (two under an archway, for symmetry)
  p.salas.forEach(s => s.objetos.forEach(o => { if (o.gemeo == null) return; const m = s.objetos[o.gemeo]; const i = indiceDe.get(o); if (m && m !== o && i != null && indiceDe.has(m)) interactables[i].twin = indiceDe.get(m); }));
  const comExtra = (o, lista, acoes) => { if (!(o && o.acaoExtra && o.acaoExtra[lista])) return acoes;
    const t = acoes.map(a => a.id).lastIndexOf('showMessage'); if (t >= 0 && acoes.slice(t + 1).every(a => !/^show|^play|Choice|Challenge/.test(a.id))) acoes[t] = { ...acoes[t], params: { ...acoes[t].params, additionalAction: true } }; else acoes.push({ id: 'additionalAction', params: {} }); return acoes; };
  /* gold next to random loot or a random item goes in the same treasure window */
  const juntarButim = acoes => {
    for (let i = 0; i < acoes.length; i++) {
      if (acoes[i].id !== 'giveGold') continue;
      const j = [i - 1, i + 1].find(k => acoes[k] && (acoes[k].id === 'giveRandomLoot' || acoes[k].id === 'giveRandomItem'));
      if (j == null) continue;
      acoes[j] = { ...acoes[j], params: { ...acoes[j].params, gold: (acoes[j].params.gold || 0) + (acoes[i].params.amount || 0) } };
      acoes.splice(i, 1); i--;
    }
    return acoes;
  };
  /* what runs on the success of a test besides its own list (a search answer that is spent only when the test passes) */
  const noSucesso = new Map();
  const acoesDe = (s, si, o, lista, extras, soEstes) => {
    const idx = indiceDe.get(o); const acoes = [];
    (soEstes || o[lista] || []).forEach(g => { const antes = acoes.length;
      switch (g.tipo) {
        case 'end_map': acoes.push({ id: g.resultado === 'vitoria' ? 'winEncounter' : 'loseEncounter', params: {} }); break;
        case 'open_room': { const alvo = p.salas[g.sala]; if (!alvo) break; acoes.push({ id: 'revealTiles', params: { group: grupo(g.sala) } }); /* (the room's text after it is set up on the table: before, it came while the tiles were still in the box) */ { const t = [alvo.texto, alvo.textoDepois].filter(Boolean).join('\n\n'); if (t) acoes.push({ id: 'showMessage', params: { text: t } }); } acoes.push({ id: 'setVar', params: { var: 'room-' + (g.sala + 1) + '-open', value: 1 } });
          const r = alvo.reserva || { add: [], remove: [] }; (r.add || []).forEach(id => acoes.push({ id: 'addEnemyToReserve', params: { enemy: idExportado(id) } })); (r.remove || []).forEach(id => acoes.push({ id: 'removeEnemyFromReserve', params: { enemy: idExportado(id) } })); break; }
        case 'give_item': if (g.acao === 'remove') { acoes.push(g.modo === 'material' ? { id: 'removeRandomMaterial', params: { amount: g.amount || 1 } } : { id: 'removeGold', params: { amount: g.amount || 10 } }); break; } if (g.modo === 'craft') acoes.push({ id: 'giveRandomLoot', params: { points: (g.amount || 1) * 5 } }); else if (g.modo === 'random') acoes.push({ id: 'giveRandomLoot', params: { points: g.points || 3 } }); else if (g.modo === 'craft') acoes.push({ id: 'giveMaterials', params: { amount: g.amount || 1 } }); else if (g.modo === 'gold') acoes.push({ id: 'giveGold', params: { amount: g.amount || 10 } }); else if (g.modo === 'newitem') acoes.push({ id: 'giveRandomItem', params: { count: g.amount || 1 } }); else if (g.item) acoes.push({ id: 'giveLoot', params: { loot: idItemExportado(g.item) } }); break;
        case 'mission': {
          const texto = g.text || 'Objective of ' + rotulo(o); let ob;
          if (g.como === 'use_object') { const alvo = p.salas[g.objSala]?.objetos[g.objIndex]; ob = alvo ? { id: 'use_object', params: { interactable: indiceDe.get(alvo) }, text: texto } : { id: 'table_declared', params: {}, text: texto }; }
          else if (g.como === 'defeat_room') { const gs = gruposDaSalaDe(p, g.salaAlvo ?? si); ob = gs.length === 1 ? { id: 'defeat_group', params: { group: gs[0] }, text: texto } : gs.length ? { id: 'defeat_groups', params: { groups: gs }, text: texto } : { id: 'table_declared', params: {}, text: texto }; }
          else if (g.como === 'counter') ob = { id: 'counter_at_least', params: { var: varDoContador(g.contador), n: g.meta || 3 }, text: texto };
          else ob = { id: 'table_declared', params: {}, text: texto };
          ob.mission = g.uid; ob.hidden = true; missoesObj[g.uid] = ob;
          acoes.push({ id: 'showMessage', params: { text: 'New objective: ' + texto } }); acoes.push({ id: 'announceMission', params: { mission: g.uid } });
          break; }
        case 'unlock_map': { const n = noDoDesbloqueio(g); if (n) acoes.push({ id: 'setCampaignVar', params: { var: varDesbloqueio(n.id), value: 1 } }); break; }
        case 'text': if (g.text) acoes.push({ id: 'showMessage', params: { text: g.text } }); break;
        case 'counter': { const v = varDoContador(g.contador);
          if (g.acao === 'use') { const dentro = acoesDe(s, si, o, 'conta:' + g.uid, extras); if (!dentro.length || !g.contador) break;
            const n = Math.max(1, +g.n || 1), chegou = [{ id: 'varAbove', params: { var: v, value: n - 1 } }], nome = 'Count ' + g.contador + ' at ' + n + ': ' + rotulo(o);
            if (g.desde === 'uso') {
              // armed by this trigger: runs once, when the count gets there (or at once, if it already is)
              const arma = 'armed-' + g.uid, feito = 'done-' + g.uid, guarda = [{ id: 'varAbove', params: { var: arma, value: 0 } }, { id: 'varEquals', params: { var: feito, value: 0 } }, ...chegou], faz = [{ id: 'setVariable', params: { var: feito, value: 1 } }, ...dentro];
              acoes.push({ id: 'setVariable', params: { var: arma, value: 1 } });
              extras.push({ id: 'count-at-' + g.uid, name: nome, once: false, event: { id: 'varChanged', params: { var: v } }, conditions: guarda, actions: faz });
              extras.push({ id: 'count-at-' + g.uid + '-armed', name: nome + ' (armed)', once: false, event: { id: 'varChanged', params: { var: arma } }, conditions: guarda, actions: faz });
            } else extras.push({ id: 'count-at-' + g.uid, name: nome, once: true, event: { id: 'varChanged', params: { var: v } }, conditions: chegou, actions: dentro });
            break; }
          acoes.push({ id: g.acao === 'sub' ? 'subVariable' : g.acao === 'set' ? 'setVariable' : 'addVariable', params: { var: v, value: g.n ?? 1 } }); if (g.texto) acoes.push({ id: 'showMessage', params: { text: textoContadorParaJogo(g) } }); break; }
        case 'skill_test': {
          // which test of this object is running (an object may have more than one): the outcome triggers check it
          const nTeste = todosGatilhos(o).filter(x => x.tipo === 'skill_test').indexOf(g) + 1; const qual = { id: 'varEquals', params: { var: 'teste-' + idx, value: nTeste } };
          acoes.push({ id: 'setVar', params: { var: 'teste-' + idx, value: nTeste } }, { id: 'setVar', params: { var: 'escolha-' + idx, value: 0 } });
          acoes.push({ id: 'showChallenge', params: { text: g.text || '', successes: g.successes || 2, secret: !!g.secret, cumulative: !!g.cumulativo, id: g.uid, difficulty: ({ 1: 'easy', 2: 'standard', 3: 'hard' })[g.successes || 2] || 'extreme' } });
          // a cumulative test right on an object that can be used every time: the success spends the object
          const gasta = g.cumulativo && o.usos === 'always' && (o.gatilhos || []).includes(g) && !o.enemy;
          const ok = comExtra(o, 'ok:' + g.uid, [...(noSucesso.get(g.uid) || []), ...(gasta ? [{ id: 'spendObject', params: { interactable: idx } }] : []), ...(g.ok ? [{ id: 'showMessage', params: { text: g.ok } }] : []), ...acoesDe(s, si, o, 'ok:' + g.uid, extras)]);
          const fail = comExtra(o, 'fail:' + g.uid, [...(g.fail ? [{ id: 'showMessage', params: { text: g.fail } }] : []), ...acoesDe(s, si, o, 'fail:' + g.uid, extras)]);
          if (ok.length) extras.push({ id: 'ok-' + g.uid, name: 'Success: ' + rotulo(o), once: false, event: { id: 'choiceMade', params: { interactable: idx, option: 0 } }, conditions: [{ id: 'varEquals', params: { var: 'ultimoDesafio', value: 1 } }, qual], actions: ok });
          if (fail.length) extras.push({ id: 'fail-' + g.uid, name: 'Failure: ' + rotulo(o), once: false, event: { id: 'choiceMade', params: { interactable: idx, option: 1 } }, conditions: [{ id: 'varEquals', params: { var: 'ultimoDesafio', value: 0 } }, qual], actions: fail });
          break; }
        case 'spawn': if (g.fonte === 'pool') { if ((g.cells || []).length) { const pool = poolDe(p, si).filter(id => monstro(id)).map(idExportado);
            // the spaces of the trigger are one group of balanced spaces: the mod applies the game's rule to all of them at once
            g.cells.forEach(c => enemies.push({ enemy: POOL_ID, pos: [c[0], c[1]], group: g.uid, tier: 0, level: c[2] || 0, pool, intensity: intensidadeDoGatilho(g) }));
            acoes.push({ id: 'spawnGroup', params: { group: g.uid } });
            // "when the group is defeated": the consequences of the whole group, whenever its last monster falls
            const aoCair = acoesDe(s, si, o, 'grupo:' + g.uid, extras);
            if (aoCair.length) extras.push({ id: 'group-defeated-' + g.uid, name: 'Group defeated: ' + rotulo(o), once: false, event: { id: 'groupDefeated', params: { group: g.uid } }, conditions: [], actions: aoCair }); } }
          else if ((g.inimigos || []).length) { g.inimigos.forEach(e => enemies.push(inimigoExportado(e, g.uid))); acoes.push({ id: 'spawnGroup', params: { group: g.uid } }); } break;
        case 'remove_enemy': if (g.alvo === 'one') { const r = inimigoRef(g.inimigo); if (r) acoes.push({ id: 'removeEnemy', params: { enemy: idExportado(r.enemy), slot: slotDoInimigo(g.inimigo) } }); } else gruposDe(si, g).forEach(gr => acoes.push(gr ? { id: 'removeGroup', params: { group: gr } } : { id: 'removeAllEnemies', params: {} })); break;
        case 'enemy_condition': gruposDe(si, g).forEach(gr => { const pr = gr ? { group: gr } : {};
          if (g.acao === 'heal') acoes.push({ id: 'healEnemy', params: { ...pr, amount: g.amount || 2, all: true } }); else if (g.acao === 'damage') acoes.push({ id: 'damageEnemy', params: { ...pr, amount: g.amount || 2, all: true } });
          else if (g.acao === 'remove') acoes.push({ id: 'clearConditions', params: pr }); else if (g.acao === 'bonus') acoes.push({ id: 'enemyBonus', params: { ...pr, ...(g.enemy ? { enemy: idExportado(g.enemy) } : {}), attack: g.ataque || 0, defense: g.defesa || 0 } }); else acoes.push({ id: 'applyConditionGroup', params: { ...pr, condition: g.condition || CONDICOES[0] } }); }); break;
        case 'escort': acoes.push(g.acao === 'fim' ? { id: 'escortEnd', params: {} } : { id: 'escort', params: { name: g.nome || '', chance: g.chance ?? 25, hunters: (g.cacadores || []).slice() } }); break;
        case 'move_object': { const alvo = p.salas[g.objSala]?.objetos[g.objIndex]; if (alvo && g.cell) acoes.push({ id: 'moveObject', params: { interactable: indiceDe.get(alvo), cell: [g.cell[0], g.cell[1]], level: g.cell[2] || 0 } }); break; }
        case 'move_heroes': { const cs = g.cells || (g.cell ? [g.cell] : []); if (cs.length) acoes.push({ id: 'moveHeroes', params: { spots: cs.flat(), area: [cs[0][0], cs[0][1], cs[0][0], cs[0][1]], ...(g.text ? { text: g.text } : {}) } }); break; }
        case 'add_object': { const alvo = p.salas[g.objSala]?.objetos[g.objIndex]; if (alvo) acoes.push({ id: 'showObject', params: { interactable: indiceDe.get(alvo) } }); break; }
        case 'remove_object': { const alvo = g.proprio ? (o.ehContador || o.enemy ? null : o) : p.salas[g.objSala]?.objetos[g.objIndex]; if (alvo) acoes.push({ id: 'hideObject', params: { interactable: indiceDe.get(alvo) } }); break; }
        case 'remove_room': if (p.salas[g.sala]) acoes.push({ id: 'removeRoom', params: { group: grupo(g.sala) } }); break;
        case 'remove_tile': { const k = indicePeca.get(g.sala + ':' + g.peca); if (k !== undefined) acoes.push({ id: 'removeTile', params: { tile: k } }); break; }
        case 'add_tile': { const gr = adicionadas.get(g.sala + ':' + g.peca); if (gr) acoes.push({ id: 'revealTiles', params: { group: gr } }); break; }
        case 'highlight': { if (g.cell) acoes.push({ id: 'highlightArea', params: { area: [g.cell[0], g.cell[1], g.cell[0], g.cell[1]], ...(g.ateRodada ? { untilRound: true } : {}) } }); else { const alvo = p.salas[g.objSala]?.objetos[g.objIndex]; if (alvo) acoes.push({ id: 'outlineObject', params: { interactable: indiceDe.get(alvo) } }); } break; }
        case 'choice': {
          // which question of this holder is open (an object may ask more than one, or also have a test): the answer triggers check it
          const todas = (g.options || []).map((x, i) => ({ x, i })).filter(({ x }) => x.text); if (!todas.length) break;
          const nEsc = todosGatilhos(o).filter(x => x.tipo === 'choice').indexOf(g) + 1; const qual = { id: 'varEquals', params: { var: 'escolha-' + idx, value: nEsc } };
          acoes.push({ id: 'setVar', params: { var: 'escolha-' + idx, value: nEsc } }, { id: 'setVar', params: { var: 'teste-' + idx, value: 0 } });
          // a search (each answer once): an answer chosen greys out, the others stay, as in the game
          const vUma = k => 'op-' + g.uid + '-' + k;
          acoes.push({ id: 'showChoice', params: { text: g.text || '', options: todas.map(({ x }) => x.text), ...(g.umaVez ? { once: todas.map((z, k) => vUma(k)), empty: g.vazio || 'Nothing more to do here.' } : {}) } });
          todas.forEach(({ x, i }, k) => {
            // an answer that asks a cumulative test is spent only when the test passes (the tries add up in between)
            const cumul = g.umaVez ? (o['op' + i + ':' + g.uid] || []).filter(t => t.tipo === 'skill_test' && t.cumulativo) : [];
            cumul.forEach(t => noSucesso.set(t.uid, [{ id: 'setVar', params: { var: vUma(k), value: 1 } }]));
            const depois = comExtra(o, 'op' + i + ':' + g.uid, [...(g.umaVez && !cumul.length ? [{ id: 'setVar', params: { var: vUma(k), value: 1 } }] : []), ...(x.response ? [{ id: 'showMessage', params: { text: x.response } }] : []), ...acoesDe(s, si, o, 'op' + i + ':' + g.uid, extras)]);
            if (depois.length) extras.push({ id: 'ans-' + g.uid + '-' + k, name: 'Answer ' + (k + 1) + ': ' + rotulo(o), once: false, event: { id: 'choiceMade', params: { interactable: idx, option: k } }, conditions: [qual], actions: depois }); });
          break; }
        case 'scene': { const cx = (g.caixas || []).filter(c => c.text || c.type === 'choice'); if (!cx.length) break; const tem = new Set(cx.map(c => c.id));
          // a box left empty is skipped: what pointed at it goes on to the box after it
          const alvo = id => { const vistos = new Set(); while (id && !tem.has(id) && !vistos.has(id)) { vistos.add(id); const c = g.caixas.find(z => z.id === id); id = c && c.type !== 'choice' ? c.next : ''; } return id && tem.has(id) ? 'sc-' + g.uid + '-' + id : ''; };
          acoes.push({ id: 'playScene', params: { start: alvo(g.inicio) || 'sc-' + g.uid + '-' + cx[0].id, dialogues: cx.map(c => ({ id: 'sc-' + g.uid + '-' + c.id, type: c.type === 'choice' ? 'choice' : 'normal', speaker: c.speaker ? idPersonagemExportado(c.speaker) : '', title: c.title || '', text: c.text || '', cast: (c.cast || []).map(idPersonagemExportado), background: c.background ?? FUNDO_PADRAO,
            options: c.type === 'choice' ? (c.options || []).filter(o => o.text).map(o => ({ text: o.text, then: alvo(o.next) ? [{ action: 'showDialogue', dialogue: alvo(o.next) }] : [] })) : [], next: c.type === 'choice' ? '' : alvo(c.next), actions: [] })) } }); break; }
        case 'rounds': { const dentro = acoesDe(s, si, o, 'rodada:' + g.uid, extras); if (!dentro.length) break;
          // the round counter runs the triggers inside; questions and tests there answer to this holder (the mod sets it when the rounds come)
          extras.push({ id: 'rounds-' + g.uid, name: 'Rounds: ' + rotulo(o), once: false, event: { id: 'roundTimer', params: { timer: g.uid } }, conditions: [], actions: dentro });
          acoes.push({ id: 'startRoundTimer', params: { timer: g.uid, every: Math.max(1, +g.n || 2), times: g.modo === 'uma' ? 1 : Math.max(0, +g.vezes || 0), interactable: idx ?? -1 } }); break; }
        case 'cutscene': if (g.video?.arquivo) acoes.push({ id: 'playVideo', params: { file: g.video.arquivo } }); else if (g.name) acoes.push({ id: 'playCutscene', params: { cutscene: g.name } }); break;
        case 'sound': if (g.somModo === 'arquivo') { if (g.som?.arquivo) acoes.push({ id: 'playSound', params: { file: g.som.arquivo } }); } else acoes.push({ id: 'playSound', params: { sound: g.name || 'Place_Generic' } }); break;
        case 'item_pool': if (g.item) acoes.push({ id: g.acao === 'remove' ? 'removeItemFromPool' : 'addItemToPool', params: { item: idItemExportado(g.item) } }); break;
        case 'reserve': if (g.enemy) acoes.push({ id: g.acao === 'remove' ? 'removeEnemyFromReserve' : 'addEnemyToReserve', params: { enemy: idExportado(g.enemy) } }); break;
        case 'objective': optional.push({ id: 'use_object', params: { interactable: idx }, text: g.text || 'Use ' + rotulo(o) + '.' }); break;
      }
      // a trigger with a requirement inside another's list (an answer, a success, every N rounds, a map event): it runs only
      // if the requirement holds, else its "if it fails" (before, a requirement there was ignored)
      if (!soEstes && (lista !== 'gatilhos' || !indiceDe.has(o)) && (g.requisitos || []).length) { const cond = condicoesDe(g); const feitas = acoes.splice(antes);
        if (cond.length) acoes.push({ id: 'if', params: { conditions: cond, then: feitas, else: acoesDe(s, si, o, 'senao:' + g.uid, extras) } }); else acoes.push(...feitas); }
    });
    return juntarButim(acoes);
  };
  /* the triggers of a holder in blocks, in order: the ones without a requirement run together; each one with a requirement is a
     block of its own (conditions + what runs when they fail) */
  const blocosDe = (s, si, o, extras) => {
    const r = []; let solto = null;
    // an object that removes itself and also has triggers with a requirement (a point of interest locked by a count): it
    // leaves the board only when a locked trigger runs, never when its requirement fails (the heroes must be able to come back)
    const travados = (o.gatilhos || []).filter(g => (g.requisitos || []).length);
    const saiSo = travados.length ? (o.gatilhos || []).filter(g => !(g.requisitos || []).length && g.tipo === 'remove_object' && g.proprio) : [];
    // a trigger marked "first time" (g.primeiraVez: a key shared by several objects) runs once, the first time any of them
    // is used: a scene before the first seal, whichever seal it is
    (o.gatilhos || []).filter(g => !saiSo.includes(g) && g.primeiraVez).forEach(g => { const v = 'first-' + slug(String(g.primeiraVez));
      r.push({ cond: [{ id: 'varEquals', params: { var: v, value: 0 } }], gs: [g], senao: null, primeira: v }); });
    (o.gatilhos || []).filter(g => !saiSo.includes(g) && !g.primeiraVez).forEach(g => {
      if (!(g.requisitos || []).length) { if (!solto) { solto = { cond: [], gs: [], senao: null }; r.push(solto); } solto.gs.push(g); }
      else {
        // the same requirement as the trigger before it, with no "if it fails" of its own: the same block (a branch of the
        // original maps, or a way out guarded by several triggers, fails or passes once)
        const ult = r[r.length - 1]; const mesma = ult && !ult.primeira && ult.cond.length && ult.req === JSON.stringify(g.requisitos) && !(o['senao:' + g.uid] || []).length;
        if (mesma) { ult.gs.splice(ult.gs.length - saiSo.length, 0, g); solto = null; return; }
        solto = null; r.push({ cond: condicoesDe(g), gs: [g, ...saiSo], senao: 'senao:' + g.uid, req: JSON.stringify(g.requisitos) }); }
    });
    return r.map(b => ({ cond: b.cond, acoes: (b.primeira ? [{ id: 'setVar', params: { var: b.primeira, value: 1 } }] : []).concat(acoesDe(s, si, o, 'gatilhos', extras, b.gs)), senao: b.senao ? comExtra(o, b.senao, acoesDe(s, si, o, b.senao, extras)) : [], primeira: !!b.primeira }));
  };
  const condicoesDe = o => (o.requisitos || []).map(r => {
    switch (r.tipo) {
      case 'item': return r.item ? { id: 'hasItem', params: { item: idItemExportado(r.item) } } : null;
      case 'mission': return r.uid ? { id: 'varEquals', params: { var: 'mission-' + r.uid, value: 1 } } : null;
      case 'room_open': return r.sala > 0 ? { id: 'varEquals', params: { var: 'room-' + (r.sala + 1) + '-open', value: 1 } } : null;   // the starting room is always open
      case 'enemies_defeated': return { id: 'groupsDefeated', params: { groups: gruposDaSalaDe(p, r.sala || 0) } };
      case 'object_used': { const alvo = p.salas[r.sala]?.objetos[r.objeto]; return alvo ? { id: 'varEquals', params: { var: 'used-' + indiceDe.get(alvo), value: 1 } } : null; }
      case 'choice': return r.nome ? { id: 'campaignVar', params: { var: varEscolha(r.nome), value: r.sim === false ? 0 : 1 } } : null;
      case 'gold': return { id: 'goldAtLeast', params: { amount: r.amount || 1 } };
      case 'counter': return r.contador ? { id: 'varAbove', params: { var: varDoContador(r.contador), value: (r.meta || 3) - 1 } } : null;
      default: return null;
    }
  }).filter(Boolean);
  p.salas.forEach((s, si) => s.objetos.forEach(o => {
    const idx = indiceDe.get(o); const extras = [];
    const blocos = blocosDe(s, si, o, extras); const ev = { id: 'interacted', params: { interactable: idx } };
    const marca = { id: 'setVar', params: { var: 'used-' + idx, value: 1 } };
    // the additional action of the object's own triggers: after what they do (with no triggers: when it is used)
    if (o.acaoExtra && o.acaoExtra.gatilhos) { const b0 = blocos.find(b => !b.cond.length); if (b0) comExtra(o, 'gatilhos', b0.acoes); }
    if (!blocos.length || blocos[0].cond.length) triggers.push({ id: 'use-' + idx, name: 'Use: ' + rotulo(o), once: !o.usos, event: ev, conditions: [], actions: comExtra(o, blocos.some(b => !b.cond.length) ? '' : 'gatilhos', [marca]) });
    blocos.forEach((b, k) => {
      const primeiro = k === 0 && !b.cond.length;
      // a requirement that fails leaves a single-use object usable (the heroes come back with the key)
      if (b.primeira) { triggers.push({ id: 'use-' + idx + '-first', name: 'Use: ' + rotulo(o) + ' (first time)', once: true, event: ev, conditions: b.cond, actions: b.acoes }); return; }
      const senao = b.cond.length ? [...b.senao, ...(!o.usos ? [{ id: 'reopenObject', params: { interactable: idx } }] : [])] : [];
      triggers.push({ id: 'use-' + idx + (primeiro ? '' : '-' + (k + 1)), name: 'Use: ' + rotulo(o) + (b.cond.length ? ' (requirement)' : ''), once: !o.usos, event: ev, conditions: b.cond, actions: primeiro ? [marca, ...b.acoes] : b.acoes, ...(b.cond.length ? { else: senao } : {}) });
    });
    triggers.push(...extras);
  }));
  // map events (the generator's modes): at a round, or every N rounds from a round; what they do is written like the
  // triggers of an object (the pursuer coming in, its wounds closing)
  const inimigosDeEventos = [];
  (p.eventos || []).forEach(ev => { const si = ev.sala || 0; const s = p.salas[si]; if (!s) return; const extras = [];
    (ev.gatilhos || []).forEach(g => (g.inimigos || []).forEach(e => inimigosDeEventos.push({ s, si, e })));
    const acoes = acoesDe(s, si, ev, 'gatilhos', extras); if (!acoes.length) return;
    const quando = ev.cada ? { event: { id: 'everyNRounds', params: { n: ev.cada } }, conditions: [{ id: 'roundAtLeast', params: { round: ev.rodada || 1 } }] } : { event: { id: 'roundStart', params: { round: ev.rodada || 1 } }, conditions: [] };
    triggers.push({ id: 'event-' + ev.uid, name: 'Map event (round ' + (ev.rodada || 1) + (ev.cada ? ', every ' + ev.cada : '') + ')', once: !ev.cada, ...quando, actions: acoes }); triggers.push(...extras); });
  // the balanced group of a room: what happens when its last monster is defeated (once; choices and tests answer to 20000 + room)
  p.salas.forEach((s, si) => { const gp = s.grupoPool; if (!gp || !vagasPoolDaSala(s) || !todosGatilhos(gp).length) return; indiceDe.set(gp, 20000 + si); const extras = [];
    blocosDe(s, si, gp, extras).forEach((b, k) => { if (b.acoes.length || b.cond.length) triggers.push({ id: 'group-defeated-' + (si + 1) + (k ? '-' + (k + 1) : ''), name: 'Balanced group defeated: ' + s.nome + (b.cond.length ? ' (requirement)' : ''), once: true, event: { id: 'groupDefeated', params: { group: 'room-' + (si + 1) + '-pool' } }, conditions: b.cond, actions: b.acoes, ...(b.cond.length ? { else: b.senao } : {}) }); });
    triggers.push(...extras); });
  // monsters: what happens when each one is defeated (every time; choices and tests answer to 10000 + its tag)
  p.salas.flatMap((s, si) => inimigosDaSala(s).map(({ e }) => ({ s, si, e }))).concat(inimigosDeEventos).forEach(({ s, si, e }) => {
    const n = marcaDe(e); if (!n) return; indiceDe.set(e, 10000 + n); const extras = [];
    blocosDe(s, si, e, extras).forEach((b, k) => { if (b.acoes.length || b.cond.length) triggers.push({ id: 'defeated-' + n + (k ? '-' + (k + 1) : ''), name: 'Defeated: ' + rotulo(e) + (b.cond.length ? ' (requirement)' : ''), once: false, event: { id: 'enemyDefeated', params: { tag: n } }, conditions: b.cond, actions: b.acoes, ...(b.cond.length && b.senao.length ? { else: b.senao } : {}) }); });
    triggers.push(...extras);
  });
  const converter = (o, si, s) => {
    switch (o.tipo) {
      case 'use_object': { const obj = s.objetos[o.objeto]; return obj ? { id: 'use_object', params: { interactable: indiceDe.get(obj) }, text: o.texto || 'Use ' + rotulo(obj) + '.' } : null; }
      case 'defeat_room': { const gs = gruposDaSalaDe(p, si); return gs.length === 1 ? { id: 'defeat_group', params: { group: gs[0] }, text: o.texto || 'Defeat the monsters of ' + s.nome + '.' } : { id: 'defeat_all', params: {}, text: o.texto || 'Defeat the monsters of ' + s.nome + '.' }; }
      default: return { id: 'table_declared', params: {}, text: o.texto || 'Objective declared at the table.' };
    }
  };
  p.salas.forEach((s, si) => s.objetivos.forEach(o => { const c = converter(o, si, s); if (c) optional.push(c); }));
  // counters (Counts button): the map mission of each one, and its consequence when the count reaches the total
  (p.contadores || []).forEach(c => {
    if (!c.nome) return; const v = varDoContador(c.nome), meta = metaDoContador(c);
    if (c.missao) {
      const ob = { id: 'counter_at_least', params: { var: v, n: meta }, text: c.missao.texto || textoMissaoContador(c), mission: c.missao.uid, ...(c.missao.quando === 'first' ? { hidden: true } : {}) };
      missoesObj[c.missao.uid] = ob;
      if (c.missao.quando === 'first') triggers.push({ id: 'count-mission-' + slug(c.nome), name: 'Mission of the counter ' + c.nome, once: true, event: { id: 'varChanged', params: { var: v } }, conditions: [], actions: [{ id: 'showMessage', params: { text: 'New objective: ' + ob.text } }, { id: 'announceMission', params: { mission: c.missao.uid } }] });
    }
    // a counter that counts by itself: +1 per monster defeated (any, or one kind) or per round passed
    if (c.conta === 'monstros') triggers.push({ id: 'count-auto-' + slug(c.nome), name: 'Counter ' + c.nome + ': monsters defeated', once: false, event: { id: 'enemyDefeated', params: c.monstro ? { enemy: idExportado(c.monstro) } : {} }, conditions: [], actions: [{ id: 'addVariable', params: { var: v, value: 1 } }] });
    if (c.conta === 'rodadas') triggers.push({ id: 'count-auto-' + slug(c.nome), name: 'Counter ' + c.nome + ': rounds passed', once: false, event: { id: 'roundEnd', params: {} }, conditions: [], actions: [{ id: 'addVariable', params: { var: v, value: 1 } }] });
    if (!p.salas[0]) return; const extras = [];
    // once, when the count reaches the total; a requirement is judged at that moment: it holds → the triggers, it fails → "If it fails"
    blocosDe(p.salas[0], 0, c, extras).forEach((b, k) => { if (!b.acoes.length && !b.senao.length) return;
      triggers.push({ id: 'count-done-' + slug(c.nome) + (k ? '-' + (k + 1) : ''), name: 'Count complete: ' + c.nome + (b.cond.length ? ' (requirement)' : ''), once: true, event: { id: 'varChanged', params: { var: v } }, conditions: [{ id: 'varAbove', params: { var: v, value: meta - 1 } }],
        actions: b.cond.length ? [{ id: 'if', params: { conditions: b.cond, then: b.acoes, else: b.senao } }] : b.acoes }); });
    triggers.push(...extras);
  });
  Object.values(missoesObj).forEach(ob => optional.push(ob));
  const fm = p.meta.finalMission || { tipo: 'defeat_all' }; let primary;
  switch (fm.tipo) {
    case 'survive_rounds': primary = { id: 'survive_rounds', params: { rounds: fm.rodadas || 8 }, text: fm.texto || 'Survive ' + (fm.rodadas || 8) + ' rounds.' }; break;
    case 'use_object': { const obj = p.salas[fm.sala]?.objetos[fm.objeto]; primary = obj ? { id: 'use_object', params: { interactable: indiceDe.get(obj) }, text: fm.texto || 'Use ' + rotulo(obj) + '.' } : null; break; }
    case 'reach_room': { const s = p.salas[fm.sala || 0]; const c = s?.pecas[0] ? casasDaPeca(s.pecas[0])[0] : [0, 0]; primary = { id: 'reach_cell', params: { cell: c }, text: fm.texto || 'Reach ' + (s?.nome || 'the room') + '.' }; break; }
    case 'table': primary = { id: 'table_declared', params: {}, text: fm.texto || 'Objective declared at the table.' }; break;
    case 'defeat_room': { const sr = p.salas[fm.sala || 0]; const gs = gruposDaSalaDe(p, fm.sala || 0); const tx = fm.texto || 'Defeat the monsters of ' + (sr?.nome || 'the room') + '.'; primary = gs.length === 1 ? { id: 'defeat_group', params: { group: gs[0] }, text: tx } : gs.length ? { id: 'defeat_groups', params: { groups: gs }, text: tx } : null; break; }
    case 'trigger': { const ob = missoesObj[fm.uid]; if (ob) { const k = optional.indexOf(ob); if (k >= 0) optional.splice(k, 1); primary = { ...ob, text: fm.texto || ob.text }; } break; }
  }
  if (!primary) primary = { id: 'defeat_all', params: {}, text: fm.texto || 'Defeat every monster.' };
  const failConditions = [{ id: 'all_heroes_defeated', params: {} }];
  if (p.meta.limite > 0) failConditions.push({ id: 'round_limit', params: { rounds: p.meta.limite } });
  // the pressure of the map (generator): fatigue at the start of every round from a round on, or a warning before the limit
  const pr = p.meta.pressao;
  if (pr && pr.tipo === 'fadiga' && pr.desde > 0) triggers.push({ id: 'pressure-fatigue', name: 'Pressure: fatigue each round', once: false, event: { id: 'roundStart', params: {} }, conditions: [{ id: 'roundAtLeast', params: { round: pr.desde } }], actions: [{ id: 'showMessage', params: { text: pr.texto || 'Every hero suffers 1 fatigue.' } }] });
  // the countdown of a map with a round limit (generator): a line at the start of every round
  const contagem = p.meta.limite > 0 && p.meta.contagem && typeof linhasDaContagem === 'function' ? linhasDaContagem(p.meta.limite) : [];
  contagem.forEach(c => { if (c && c.rodada > 0 && c.texto) triggers.push({ id: 'countdown-' + c.rodada, name: 'Countdown: round ' + c.rodada, once: true, event: { id: 'roundStart', params: { round: c.rodada } }, conditions: [], actions: [{ id: 'showMessage', params: { text: c.texto } }] }); });
  if (pr && pr.tipo === 'limite' && pr.desde > 0 && !contagem.length) triggers.push({ id: 'pressure-limit', name: 'Pressure: two rounds left', once: true, event: { id: 'roundStart', params: { round: pr.desde } }, conditions: [], actions: [{ id: 'showMessage', params: { text: pr.texto || 'Two rounds left!' } }] });
  // counters that start at a number other than zero (Counts button)
  const inicios = (p.contadores || []).filter(c => c.nome && +c.inicio);
  // what the heroes find in the starting room, once the board is set up
  if (p.salas[0]?.textoDepois) triggers.unshift({ id: 'room-1-found', name: 'Starting room: what the heroes find', once: true, event: { id: 'mapStart', params: {} }, conditions: [], actions: [{ id: 'showMessage', params: { text: p.salas[0].textoDepois } }] });
  if (inicios.length) triggers.unshift({ id: 'counters-start', name: 'Counters: start values', once: true, event: { id: 'mapStart', params: {} }, conditions: [], actions: inicios.map(c => ({ id: 'initVariable', params: { var: varDoContador(c.nome), value: +c.inicio } })) });
  const id = slug(p.meta.name);
  const r0 = p.salas[0]?.reserva || { add: [], remove: [] };
  return {
    format: 'dmap', version: VERSAO_DMAP,
    meta: { id, name: p.meta.name || 'Map', author: p.meta.author || autorGuardado() || '', description: p.meta.description || '', difficulty: 'normal',
      heroCount: [2, Math.max(2, Math.min(4, p.salas[0]?.herois.length || 4))], intro: p.meta.intro || '', music: p.meta.musica && p.meta.musica.arquivo ? { file: p.meta.musica.arquivo, title: p.meta.musica.nome || '', when: 'map', loop: p.meta.musica.loop !== false, url: '', event: '' } : { file: '', title: '', when: 'map', loop: true, url: '', event: p.meta.music || '' }, scene: '', background: p.meta.background || '',
      created: new Date().toISOString().slice(0, 10), editor: 'bigorna-rooms' },
    board: { gridSize: [60, 60], levels: niveis, tiles, blocked: [], floor: 'flagstone' },
    spawns: { heroStart: (p.salas[0]?.herois || []).map(h => [h[0], h[1], h[2] || 0]), enemies, interactables, reserve: [...new Set([...(p.reserva || []).filter(x => !(r0.remove || []).includes(x)), ...(r0.add || [])])].map(idExportado), itemPool: (p.itensPool || []).map(idItemExportado), ...(enemies.some(e => e.enemy === POOL_ID) ? { balance: (r => ({ minTier: r.min, maxTier: r.max, progression: r.progresso }))(regraDoBalanceio(p)) } : {}) },
    objectives: { primary: [primary], optional, failConditions },
    triggers,
    custom: conteudoCustom(),
    bigornaSalas: clone(p)
  };
}
function gruposDaSalaDe(p, si) { const s = p.salas[si]; const g = []; if ((s.inimigos || []).some(e => !ehPool(e.enemy))) g.push('room-' + (si + 1)); if (vagasPoolDaSala(s)) g.push('room-' + (si + 1) + '-pool'); donosDaSala(s).map(({ o }) => o).concat(inimigosDaSala(s).map(({ e }) => e)).forEach(o => todosGatilhos(o).forEach(x => { if (x.tipo === 'spawn' && (x.fonte === 'pool' ? (x.cells || []).length : x.inimigos?.length) && !g.includes(x.uid)) g.push(x.uid); })); return g; }

/* the roads of the campaign's own world map (whole units) and the city's spot on it */
function estradasExportadas() {
  const r = (campanha.meta.estradas || []).filter(e => e.length >= 2).map(e => e.map(v => [Math.round(v[0]), Math.round(v[1])]));
  return { ...(r.length ? { roads: r } : {}), ...(campanha.meta.posCidade ? { cityAt: campanha.meta.posCidade.map(Math.round) } : {}) };
}

/* the .dcamp: maps and waypoints become nodes; dialogue/scene cards become box chains hung on the anchor before them */
function montarDcamp() {
  normalizarCampanha(campanha);
  const cid = slug(campanha.meta.name || 'campaign');
  const ids = {}; const usados = [];
  campanha.nos.filter(ehAncora).forEach(n => { ids[n.id] = idUnico(slug(nomeDoNo(n) === rotuloDoNo(n) ? rotuloDoNo(n) : nomeDoNo(n)), usados); usados.push(ids[n.id]); });
  const acaoExp = a => a.action === 'remember' ? { action: 'setVar', var: varEscolha(a.nome), value: 1 } : a.action === 'unlockNode' || a.action === 'completeNode' ? { action: a.action, node: ids[a.node] || a.node } : a.action === 'giveItem' ? { action: 'giveItem', item: idItemExportado(a.item), qty: a.qty || 1 } : { ...a };
  const dialogues = campanha.dialogos.map(d => { const seg = campanha.dialogos.find(x => (x.depois || []).includes(d.id)); return { id: d.id, type: d.type || 'normal', speaker: d.speaker ? idPersonagemExportado(d.speaker) : '', title: d.title || '', text: d.text || '', cast: (d.cast || []).map(idPersonagemExportado), background: d.background ?? FUNDO_PADRAO,
    options: d.type === 'choice' ? (d.options || []).filter(o => o.text).map(o => ({ text: o.text, then: [...(o.lembrar && (o.lembrarNome || o.text) ? [{ action: 'setVar', var: varEscolha(o.lembrarNome || o.text), value: 1 }] : []), ...(o.acoes || []).map(acaoExp), ...(o.next ? [{ action: 'showDialogue', dialogue: o.next }] : [])] })) : [], next: d.type === 'choice' ? '' : (seg ? seg.id : ''), actions: (d.acoes || []).map(acaoExp), ...(d.type === 'video' ? { video: d.video?.arquivo || '' } : {}) }; });
  const copia = Object.fromEntries(dialogues.map(d => [d.id, d]));
  const cauda = id => { let d = copia[id]; const vistos = new Set(); while (d && d.next && copia[d.next] && !vistos.has(d.next)) { vistos.add(d.next); d = copia[d.next]; } return d; };
  const ganchos = {}; let abertura = ''; const visitas = [];
  const inicioDeCadeia = campanha.nos.filter(n => ehDialogo(n) && !(n.depois || []).map(noPorId).some(a => a && ehDialogo(a))).sort((a, b) => ((a.fluxo || [0, 0])[0] - (b.fluxo || [0, 0])[0]) || ((a.fluxo || [0, 0])[1] - (b.fluxo || [0, 0])[1]));
  inicioDeCadeia.forEach(n => {
    const ancora = (n.depois || []).map(noPorId).find(a => a && ehAncora(a));
    const cadeiaToda = []; let atual = n; const vistos = new Set();
    while (atual && ehDialogo(atual) && !vistos.has(atual.id)) { vistos.add(atual.id); if (copia[atual.dialogo]) cadeiaToda.push({ cab: atual.dialogo, no: atual }); atual = campanha.nos.find(m => ehDialogo(m) && (m.depois || []).includes(atual.id)); }
    // a scene marked "City visit" (and the scenes after it) waits for the next visit to the city: a stop of its own, off the world map
    const k = cadeiaToda.findIndex(x => x.no.marcador === 'city');
    if (k >= 0) visitas.push({ no: cadeiaToda[k].no, cabs: cadeiaToda.slice(k).map(x => x.cab), ancora });
    const cadeia = cadeiaToda.slice(0, k >= 0 ? k : cadeiaToda.length).map(x => x.cab);
    if (!cadeia.length) return;
    // the last box of a scene leads to the next scene (after a question: once the answer and its boxes are done)
    for (let i = 0; i + 1 < cadeia.length; i++) { const t = cauda(cadeia[i]); if (t && !t.next) t.next = cadeia[i + 1]; }
    // a scene with "Only if": its first box checks the choice and, when it fails, jumps to the next scene of the chain
    cadeia.forEach((cab, i) => { const no = campanha.nos.find(m => ehDialogo(m) && m.dialogo === cab); if (no && no.seEscolha && copia[cab]) { copia[cab].onlyIf = { var: varEscolha(no.seEscolha.nome), value: no.seEscolha.sim === false ? 0 : 1 }; copia[cab].skipTo = cadeia[i + 1] || ''; } });
    // several scenes with nothing before them: they all open the campaign, one after the other (left to right on the flow)
    if (!ancora) { if (!abertura) abertura = cadeia[0]; else { const t = cauda(abertura); if (t && !t.next) t.next = cadeia[0]; } return; }
    const g = ganchos[ancora.id] || (ganchos[ancora.id] = {}); const chave = ancora.tipo === 'travel' ? 'onArrive' : 'onComplete';
    if (!g[chave]) g[chave] = cadeia[0]; else { const t = cauda(g[chave]); if (t && !t.next) t.next = cadeia[0]; }
  });
  // maps an "Unlock a campaign map" trigger points to: locked until the trigger runs (a campaign variable)
  const bloqueados = new Set(); campanha.missoes.forEach(mp => (mp.salas || []).forEach(ss => donosDaSala(ss).forEach(({ o }) => todosGatilhos(o).forEach(g => { if (g.tipo === 'unlock_map') { const ant = projeto; projeto = mp; try { const nn = noDoDesbloqueio(g); if (nn) bloqueados.add(nn.id); } finally { projeto = ant; } } }))));
  campanha.missoes.forEach(mp => (mp.contadores || []).forEach(c => todosGatilhos(c).forEach(g => { if (g.tipo === 'unlock_map') { const nn = noDoDesbloqueio(g); if (nn) bloqueados.add(nn.id); } })));
  const nodes = campanha.nos.filter(ehAncora).map(n => ({ id: ids[n.id], num: n.num, name: nomeDoNo(n), description: n.descricao || '', coords: [n.coords[0], n.coords[1]],
    marker: n.marcador || (n.tipo === 'side' ? 'side' : n.tipo === 'travel' ? 'narrative' : 'main'), kind: n.tipo === 'travel' ? 'dialogue' : 'scenario', map: n.tipo === 'travel' ? '' : ids[n.id] + '.dmap',
    onArrive: ganchos[n.id]?.onArrive || '', onTravel: '', onComplete: n.tipo === 'travel' ? '' : (ganchos[n.id]?.onComplete || ''),
    spawn: { auto: n.auto !== false, afterNodes: ancorasAntes(n).map(a => ids[a.id]).filter(Boolean), afterQuests: [], questsThisAct: 0, ...(bloqueados.has(n.id) ? { unlockVar: varDesbloqueio(n.id) } : {}), ...(n.seEscolha ? { choice: { var: varEscolha(n.seEscolha.nome), value: n.seEscolha.sim === false ? 0 : 1 } } : {}) },
    rewards: { items: (n.recompensas?.items || []).map(idItemExportado), materials: n.recompensas?.materials || 0, gold: n.recompensas?.gold || 0 } }));
  visitas.forEach(v => {
    for (let i = 0; i + 1 < v.cabs.length; i++) { const t = cauda(v.cabs[i]); if (t && !t.next) t.next = v.cabs[i + 1]; }
    const id = idUnico('city-' + slug(nomeDoNo(v.no)), usados); usados.push(id);
    nodes.push({ id, num: v.no.num, name: nomeDoNo(v.no), description: '', coords: [0, 0], marker: 'city', kind: 'dialogue', map: '', onArrive: v.cabs[0], onTravel: '', onComplete: '',
      spawn: { auto: true, afterNodes: v.ancora ? [ids[v.ancora.id]] : [], afterQuests: [], questsThisAct: 0, ...(v.no.seEscolha ? { choice: { var: varEscolha(v.no.seEscolha.nome), value: v.no.seEscolha.sim === false ? 0 : 1 } } : {}) },
      rewards: { items: [], materials: 0 } });
  });
  let intro = abertura;
  if (campanha.intro) { dialogues.unshift({ id: 'd-opening', type: 'normal', speaker: '', title: campanha.meta.name || 'Campaign', text: campanha.intro, cast: [], background: FUNDO_PADRAO, options: [], next: abertura || '', actions: [] }); intro = 'd-opening'; }
  const dcamp = { format: 'dcamp', version: VERSAO_DCAMP,
    meta: { id: cid, name: campanha.meta.name || 'Campaign', author: campanha.meta.author || autorGuardado() || '', description: campanha.meta.description || '', act: 'I', ...(campanha.meta.mapaProprio ? { worldMap: { file: campanha.meta.mapaProprio.arquivo, clouds: campanha.meta.nuvens !== false, mist: !!campanha.meta.nevoa, ...estradasExportadas() } } : {}), ...(campanha.meta.cidade ? { city: { file: campanha.meta.cidade.arquivo } } : {}), heroCount: [2, 4], requiresAct2: false, created: new Date().toISOString().slice(0, 10), editor: 'bigorna-rooms' },
    nodes, dialogues, shop: { replace: false, items: [] }, intro, custom: conteudoCustom(), ...(inventarioExportado() ? { start: inventarioExportado() } : {}),
    bigornaSalas: { campanha: clone(campanha) } };
  const mapas = campanha.nos.filter(n => n.tipo === 'map' || n.tipo === 'side').map(n => { const d = montarDmap(campanha.missoes[n.missao]); d.meta.id = ids[n.id]; return { nome: ids[n.id] + '.dmap', doc: d }; });
  return { cid, dcamp, mapas };
}
async function exportarCampanha() {
  await prepararTopos();
  const { cid, dcamp, mapas } = montarDcamp();
  const r = await Config.exportar(cid + '.dcamp', JSON.stringify(dcamp, null, 1), cid);
  for (const m of mapas) await Config.exportar(m.nome, JSON.stringify(m.doc, null, 1), cid);
  for (const a of [...musicasDosMapas(mapas.map(m => m.doc), cid), ...videosDasCenas(dcamp, cid)]) if (a.texto) await Config.exportar(a.nome, a.texto, cid);
  aviso(r.onde === 'pasta' ? 'Campaign saved to ' + r.pasta + ' (' + (mapas.length + 1) + ' files).' : 'Downloaded ' + (mapas.length + 1) + ' files. Put them all in a folder named “' + cid + '” inside CustomMaps.');
  if (r.onde === 'pasta') Auto.marcar();
}
$('#btnExportar').onclick = () => exportarTudo();
/* exports the map (or the whole campaign); returns false if the user gave up at the checklist question */
async function exportarTudo(semPerguntar) {
  const faltas = $$('#conferencia li.falta').map(l => l.textContent);
  if (!semPerguntar && faltas.length && !confirm('The checklist has pending items:\n\n' + faltas.join('\n') + '\n\nExport anyway?')) return false;
  await prepararTopos();
  marcarVisto('dica:exportar');
  if (!campanha) {
    const d = montarDmap();
    const r = await Config.exportar(d.meta.id + '.dmap', JSON.stringify(d, null, 1));
    for (const a of musicasDosMapas([d], null)) if (a.texto) await Config.exportar(a.nome, a.texto);
    aviso(r.onde === 'pasta' ? 'Saved to ' + r.pasta + '\\' + r.nome + '. In the game, open “Community maps”.' : 'Downloaded ' + r.nome + '. The game brings it from Downloads into its maps list by itself (with the mod).');
    if (r.onde === 'pasta') Auto.marcar();
    return true;
  }
  await exportarCampanha();
  return true;
}

// ------------------------------------------------------------ clear the map: only what is on the board (asks first, offers to export)
function apagarTudo() {
  const m = projeto.meta || {};
  if (!projeto.salas.length && !m.name && !m.intro && !m.description && !(projeto.reserva || []).length) return aviso('The map has nothing to clear.');
  const oque = 'the ' + projeto.salas.length + ' room(s) of the map “' + (m.name || 'without a name') + '”: tiles, pillars, objects, monsters, hero spaces and their triggers, and its name and map setup (texts, music, mission, pools, counters)';
  modal('Clear the map?', `<p>This erases ${esc(oque)}. The workshop${campanha ? ', the other maps, the campaign' : ''} and the author stay. Files already exported stay in the folder.</p><p class="ajuda">Do you want to export it before clearing?</p>
    <button class="op destaque" data-o="exp"><b>Export, then clear</b><small>${campanha ? 'Writes the .dcamp and its maps' : 'Writes the .dmap'}${Config.nomePasta() ? ' into ' + esc(Config.nomePasta()) : ' (download)'}, then clears.</small></button>
    <button class="op perigo" data-o="ja"><b>Clear without exporting</b><small>Everything not exported is lost.</small></button>
    <div class="rodape"><button data-o="nao">Cancel</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="nao"]').onclick = fechar;
    el.querySelector('[data-o="ja"]').onclick = () => { if (!confirm('Clear the map without exporting? This cannot be undone.')) return; fechar(); limparMapa(); };
    el.querySelector('[data-o="exp"]').onclick = async () => { fechar(); try { if (!(await exportarTudo())) return; } catch (e) { return aviso('Export failed (' + e.message + '): nothing was cleared.'); } limparMapa(); };
  });
}
/* the rooms, the name and the map setup go; the workshop and the author stay (in a campaign the map keeps its place) */
function limparMapa() {
  const novo = projetoNovo(); const autor = projeto.meta.author || '';
  Object.keys(projeto).forEach(k => { if (k !== 'bestiario') delete projeto[k]; });
  Object.keys(novo).forEach(k => { if (k !== 'bestiario') projeto[k] = novo[k]; });
  projeto.meta.author = autor; if (!projeto.bestiario) projeto.bestiario = novo.bestiario;
  salaAtual = -1; sel = null; ferramenta = null; escolha = null; nivel = 0; gatAberto = -1;
  guardarEstado(); if (!campanha && !Object.values(projeto.bestiario || {}).some(l => Array.isArray(l) && l.length)) try { localStorage.removeItem(CHAVE_ESTADO); } catch { }
  camposDaMissao(); tudo(); enquadrar(); aviso('The map was cleared. Start with the starting room.');
}
function limparTudo() {
  Auto.esquecer();   // so autosave never deletes the files of the cleared work
  campanha = null; projeto = projetoNovo(); projeto.meta.author = autorGuardado(); missaoAtual = 0; salaAtual = -1;
  sel = null; ferramenta = null; escolha = null; nivel = 0; gatAberto = -1; if (vista3d.on) vista3d.on = false;
  try { localStorage.removeItem(CHAVE_ESTADO); } catch { }
  $('#telaCampanha').hidden = true; $('#telaFichas').hidden = true;
  camposDaMissao(); tudo(); enquadrar(); aviso('Everything was cleared. Start with the starting room.');
}
$('#btnApagarTudo').onclick = apagarTudo;

// ------------------------------------------------------------ open a file / import rooms
function lerProjetoDe(texto) {
  const d = JSON.parse(texto);
  // (a file of a newer editor opens as well: what this one does not know stays out)
  const novo = (d.format === 'dcamp' ? d.version > VERSAO_DCAMP : d.version > VERSAO_DMAP) || undefined;
  if (d.format === 'dcamp' && d.bigornaSalas?.campanha) return { campanha: d.bigornaSalas.campanha, novo };
  if (d.format === 'dmap' && d.bigornaSalas) return { projeto: d.bigornaSalas, novo };
  throw new Error('This file was not made with Bigorna Rooms (it has no room data), so its logic cannot be read.');
}
async function escolherArquivo(tipos) {
  if (typeof window.showOpenFilePicker === 'function') {
    try { const opts = { types: [{ description: 'Bigorna map or campaign', accept: { 'application/json': tipos } }], multiple: false, id: 'bigorna-abrir' }; const pasta = Config.pastaAtual(); if (pasta) opts.startIn = pasta; const [h] = await window.showOpenFilePicker(opts); const f = await h.getFile(); return await f.text(); }
    catch (e) { if (e && e.name === 'AbortError') return null; if (e && e.name !== 'TypeError' && e.name !== 'NotAllowedError' && e.name !== 'SecurityError') throw e; }
  }
  return new Promise(resolve => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = tipos.join(','); inp.onchange = async () => { const f = inp.files[0]; resolve(f ? await f.text() : null); }; inp.oncancel = () => resolve(null); inp.click(); });
}
async function abrirArquivo() {
  const texto = await escolherArquivo(['.dmap', '.dcamp']); if (!texto) return;
  const que = lerProjetoDe(texto);
  if (que.campanha) { aplicarEstado({ campanha: que.campanha, missaoAtual: 0, salaAtual: 0 }); } else { aplicarEstado({ projeto: que.projeto, salaAtual: 0 }); }
  carregarAudios(); camposDaMissao(); tudo(); enquadrar(); que.novo ? avisoLongo('This file was made with a newer version of the editor: it opened, but what this version does not know was left out. Update Bigorna before saving it again.') : aviso((que.campanha ? 'Campaign' : 'Map') + ' opened.');
  return 'fechar';
}
async function importarSalas() {
  const texto = await escolherArquivo(['.dmap']); if (!texto) return;
  let d; try { d = JSON.parse(texto); } catch { return aviso('That file is not readable JSON.'); }
  if (d.format !== 'dmap' || !d.bigornaSalas?.salas) return aviso('That map was not made with Bigorna Rooms: its room logic is not readable, so nothing was imported.');
  const fonte = normalizar(clone(d.bigornaSalas)); const outro = fonte.bestiario || { monstros: [], personagens: [], itens: [] };
  if (!fonte.salas.length) return aviso('That map has no rooms.');
  modal('Import rooms from “' + (fonte.meta.name || 'map') + '”', `<p class="ajuda">Tick the rooms to bring in. Each comes with its tiles, pillars, objects, monsters and triggers; triggers that point at rooms left behind are dropped. The map you are working on is kept.</p>
    <div>${fonte.salas.map((s, i) => `<label class="chk"><input type="checkbox" data-s="${i}" checked> ${i + 1} · ${esc(s.nome)} <small>(${s.pecas.length} tiles · ${s.objetos.length} objects · ${inimigosDaSalaDe(s).length} monsters)</small></label>`).join('')}</div>
    <div class="rodape"><button data-o="cancel">Cancel</button><button class="primario" data-o="ok">Import</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="cancel"]').onclick = fechar;
    el.querySelector('[data-o="ok"]').onclick = () => {
      const escolhidas = [...el.querySelectorAll('[data-s]:checked')].map(c => +c.dataset.s); if (!escolhidas.length) return aviso('Tick at least one room.');
      const base = projeto.salas.length; const mapa = {}; escolhidas.forEach((si, k) => { mapa[si] = base + k; });
      const b = bestiario(); const traz = id => { if (monstro(id)) return id; const m = outro.monstros.find(x => x.id === id); if (m) { b.monstros.push(clone(m)); return id; } return id; };
      escolhidas.forEach(si => {
        const s = clone(fonte.salas[si]); s.nome = s.nome + (projeto.salas.some(x => x.nome === s.nome) ? ' (imported)' : '');
        if (base > 0) { s.inimigos.forEach(e => traz(e.enemy)); const o0 = s.objetos[0]; if (s.inimigos.length && o0) { o0.gatilhos.push({ uid: uid(), tipo: 'spawn', fonte: 'list', inimigos: s.inimigos.splice(0) }); } s.herois = []; }
        s.objetos.forEach(o => { listasDe(o).forEach(l => { o[l] = (o[l] || []).filter(g => { if (['open_room', 'remove_room'].includes(g.tipo)) { if (mapa[g.sala] === undefined) return false; g.sala = mapa[g.sala]; } if (g.tipo === 'remove_tile' || g.tipo === 'add_tile') { if (mapa[g.sala] === undefined) return false; g.sala = mapa[g.sala]; } if (g.objSala !== undefined) { if (mapa[g.objSala] === undefined) { delete g.objIndex; delete g.objSala; } else g.objSala = mapa[g.objSala]; } if (g.inimigo) { if (mapa[g.inimigo.sala] === undefined) delete g.inimigo; else g.inimigo.sala = mapa[g.inimigo.sala]; } if (g.tipo === 'mission' && g.modo === 'map') return false; (g.inimigos || []).forEach(e => traz(e.enemy)); if (g.enemy) traz(g.enemy); g.uid = uid(); return true; }); });
          [o, ...todosGatilhos(o)].forEach(x => { x.requisitos = (x.requisitos || []).filter(r => { if (r.sala !== undefined) { if (mapa[r.sala] === undefined) return false; r.sala = mapa[r.sala]; } if (r.tipo === 'mission') return false; return true; }); }); });
        s.abertaPor = []; (s.reserva?.add || []).forEach(traz);
        projeto.salas.push(s);
      });
      limparAbridores(); fechar(); salaAtual = base; sel = null; tudo(); enquadrar();
      aviso(escolhidas.length + ' room(s) imported as room ' + (base + 1) + (escolhidas.length > 1 ? '–' + (base + escolhidas.length) : '') + '. Give each one an opener trigger if it lost it, and check for repeated tiles.');
    };
  });
}
function inimigosDaSalaDe(s) { return inimigosDaSala(s).length; }

// ------------------------------------------------------------ autosave into the CustomMaps folder
const Auto = (() => {
  let ultimo = null, gravados = new Set(), salvando = false, erroVisto = false;
  const audiosNaPasta = new Set();   // music files already written (a name is never reused for other contents)
  const el = $('#autoEstado');
  const hora = () => new Date().toTimeString().slice(0, 5);
  function estado(texto, classe, aoClicar) { el.hidden = !texto; el.textContent = texto || ''; el.className = 'auto' + (classe ? ' ' + classe : ''); el.onclick = aoClicar || null; el.title = classe === 'pedir' ? 'The browser needs your permission to write into the folder' : 'Autosave: the files in the export folder follow your work. Turn it off in ⚙.'; }
  function retrato() {
    try {
      if (campanha) { const { cid, dcamp, mapas } = montarDcamp(); const mus = [...musicasDosMapas(mapas.map(m => m.doc), cid), ...videosDasCenas(dcamp, cid)]; return { chave: JSON.stringify([dcamp.nodes, dcamp.dialogues, mapas.map(m => m.doc.board), mapas.map(m => m.doc.spawns), mapas.map(m => m.doc.triggers), dcamp.custom, mapas.map(m => m.doc.meta), mus.map(a => a.nome + !!a.texto)]), arquivos: [{ nome: cid + '.dcamp', texto: JSON.stringify(dcamp, null, 1), sub: cid }, ...mapas.map(m => ({ nome: m.nome, texto: JSON.stringify(m.doc, null, 1), sub: cid })), ...mus] }; }
      if (!projeto.salas.length && !projeto.meta.name) return null;
      const d = montarDmap(); const mus = musicasDosMapas([d], null); return { chave: JSON.stringify([d.board, d.spawns, d.triggers, d.objectives, d.meta, d.custom, mus.map(a => a.nome + !!a.texto)]), arquivos: [{ nome: d.meta.id + '.dmap', texto: JSON.stringify(d, null, 1), sub: null }, ...mus] };
    } catch (e) { console.warn('autosave', e); return null; }
  }
  async function passo(forcar) {
    guardarEstado();
    if (salvando) return;
    if (!Config.suportado() || !Config.pastaAtual()) { estado(''); return; }
    if (!Config.autoSalvar()) { estado('autosave off'); return; }
    await prepararTopos();
    const r = retrato(); if (!r) return;
    if (!forcar && r.chave === ultimo) return;
    if (!(await Config.permissao(false))) { estado('click to allow autosave', 'pedir', async () => { if (await Config.permissao(true)) passo(true); }); return; }
    salvando = true;
    try {
      let ok = true; const agora = new Set();
      for (const a of r.arquivos) { const c = (a.sub ? a.sub + '/' : '') + a.nome; agora.add(c); if (a.texto === null) continue; const blob = a.texto instanceof Blob; if (blob && audiosNaPasta.has(c)) continue; if (!(await Config.gravarQuieto(a.nome, a.texto, a.sub))) ok = false; else if (blob) audiosNaPasta.add(c); }
      if (ok) { for (const c of gravados) if (!agora.has(c)) { const i = c.indexOf('/'); await Config.apagarQuieto(i < 0 ? c : c.slice(i + 1), i < 0 ? null : c.slice(0, i)); } gravados = agora; ultimo = r.chave; erroVisto = false; estado('saved ' + hora() + ' → ' + Config.nomePasta() + (r.arquivos[0].sub ? '\\' + r.arquivos[0].sub : '')); }
      else { if (!erroVisto) { erroVisto = true; aviso('Autosave could not write into ' + Config.nomePasta() + '. Check the folder in ⚙.'); } estado('autosave failed', 'erro'); }
    } finally { salvando = false; }
  }
  function esquecer() { ultimo = null; gravados = new Set(); audiosNaPasta.clear(); estado(''); }
  function marcar() { const r = retrato(); if (r) { ultimo = r.chave; gravados = new Set(r.arquivos.map(a => (a.sub ? a.sub + '/' : '') + a.nome)); estado('saved ' + hora() + ' → ' + Config.nomePasta()); } }
  Config.carregar().then(() => carregarAudios()).then(() => { passo(false); setInterval(() => passo(false), 2000); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) passo(false); });
  return { passo, marcar, esquecer };
})();

// ------------------------------------------------------------ settings (⚙): folder, author, open, import, quick save/load
const EXTRAS_CONFIG = [
  { secao: 'Language / Idioma', opcoes: IDIOMAS, valor: () => IDIOMA, acao: v => mudarIdioma(v) },   // idioma.js: saves the work, then reloads
  { campo: 'Author (goes into every map and campaign file you export)', valor: () => autorGuardado(), acao: v => { guardarAutor(v); projeto.meta.author = v; if (campanha) { campanha.meta.author = v; campanha.missoes.forEach(m => { m.meta.author = v; }); } renderConferencia(); } },
  { rotulo: '📂 Open a map or campaign…', acao: abrirArquivo, ajuda: 'Open a .dmap or .dcamp made with Bigorna Rooms (replaces the current work).' },
  { rotulo: '⇩ Import rooms from a .dmap…', acao: importarSalas, ajuda: 'Brings chosen rooms of another Bigorna map into this one, without replacing it.' },
  { rotulo: '💾 Quick save (F5)', acao: salvarRapido, ajuda: 'Quick save keeps a copy in this browser; quick load brings it back.' },
  { rotulo: '↩ Quick load (F9)', acao: () => carregarRapido() },
  { secao: 'Workshop packages', rotulo: '📦 Export a package…', acao: () => { exportarPacote(); return 'fechar'; }, ajuda: 'A .bigorna file with what you made in the Workshop (monsters, NPCs, items, weapons, recipes, feats, skills with their cards, heroes, tiles, objects): the parts you pick, or everything at once.' },
  { secao: 'Workshop packages', rotulo: '📥 Import a package…', acao: () => { importarPacote(); return 'fechar'; }, ajuda: 'Brings a package into the Workshop of the map or campaign on screen.' },
  { secao: 'Other settings', rotulo: '🧱 Pieces in your boxes…', acao: () => abrirTerrenoDasCaixas(), ajuda: 'How many of each piece your boxes hold (3D objects, tokens, pillars, tiles, your own pieces): the generators use only these, and the object buttons show how many are on the table.' },
  { secao: 'Other settings', rotulo: '🎓 Repeat the tutorial', acao: () => { Tutorial.iniciar(); return 'fechar'; }, ajuda: 'The guided tutorial again, on an empty map: the work on screen goes into the quick save first (↩ Quick load brings it back).' },
  { secao: 'Other settings', rotulo: '↺ Show tips and warnings again', acao: () => { limparVistos(); renderConferencia(); aviso('Hints, first-visit explanations and warnings will show again.'); }, ajuda: 'Brings back the hints of Rooms, the explanations shown the first time a tab opens and the warnings you chose not to see again.' },
  { secao: 'Other settings', rotulo: '⟲ Reset everything…', acao: resetarConfiguracoes, ajuda: 'Reset everything: the work on screen, the Workshop, the quick save, archetypes, tips and warnings, window positions and sizes, author, export folder and autosave. The language stays.' },
];
/* the 3D terrain the user owns: the estimate for the chosen boxes, or the user's own counts */
function abrirTerrenoDasCaixas() {
  const proprio = terrenoProprio() || {}; const atos = ATOS.get();
  const val = k => proprio[k] !== undefined ? proprio[k] : '';
  const campo = (k, rotulo, est, sub) => `<label class="linha"><span style="flex:1">${esc(rotulo)}${sub ? ` <small class="ajuda">${esc(sub)}</small>` : ''}</span><input type="number" min="0" max="99" data-g="${esc(k)}" value="${val(k)}" placeholder="${est === null ? '∞' : est}" style="width:64px"></label>`;
  // 3D terrain of the game, by kind (the estimate of the boxes chosen as placeholder)
  const grupos = [...new Set([1, 2].flatMap(a => Object.keys(TERRENO_POR_ATO[a])).concat(OBJETOS.filter(o => !ehDaOficina(o.id) && !o.objeto).map(o => grupoDoTerreno(o.id))))].filter(Boolean);
  const estimativa = g => { let n = null; [1, 2].forEach(a => { if (TERRENO_POR_ATO[a][g] !== undefined) n = (n || 0) + (a <= atos ? TERRENO_POR_ATO[a][g] : 0); }); return n; };
  const nome = g => g === 'Fichas' ? tr('Explore / sight tokens') : tr(nomeObj(g));
  const objetos = grupos.sort((x, y) => nome(x).localeCompare(nome(y))).map(g => campo(g, nome(g), estimativa(g), partilhaDe(g) ? tr(NOTA_PARTILHA) : '')).join('');
  const pilares = Object.keys(SUPORTES).map(t => campo('pilar:' + t, tr(SUPORTES[t].nome), [1, 2].reduce((n, a) => n + (a <= atos ? PILARES_POR_ATO[a][t] || 0 : 0), 0), tr('level') + ' ' + SUPORTES[t].nivel)).join('');
  // the tiles: one entry per physical tile (its two sides)
  const porNum = new Map(); PECAS.filter(t => t.kind === 'tile' && !['platform', 'vault', 'gamebox'].includes(t.id)).forEach(t => { const n = numeroDaPeca(t.id); if (!porNum.has(n)) porNum.set(n, []); porNum.get(n).push(t); });
  const pecas = [...porNum.entries()].sort((x, y) => (parseInt(x[0]) || 999) - (parseInt(y[0]) || 999) || String(x[0]).localeCompare(String(y[0]))).map(([n, l]) => campo('peca:' + n, tr('Tile') + ' ' + l.map(t => nomePeca(t.id)).join(' / '), (l[0].act || 1) <= atos ? 1 : 0, (l[0].act || 1) === 2 ? 'Act II' : 'Act I')).join('');
  // the Workshop's own pieces (made by hand, or reproduced)
  const b = bestiario() || {}; const doUsuario = (b.objetos || []).map(o => campo(o.id, o.nome || tr('Workshop object'), null)).concat((b.pecas || []).map(q => campo('peca:' + q.id, q.nome || tr('Workshop tile'), 1))).join('');
  const secao = (t, corpo, aberta) => `<details ${aberta ? 'open' : ''} class="secaoTerreno"><summary><b>${esc(t)}</b></summary><div class="terrenoCaixas">${corpo}</div></details>`;
  modal(tr('Pieces in your boxes'), `<p class="ajuda">${tr('How many of each piece you have: the generators use only these, and the object buttons show how many are on the table while a room is open. A blank field keeps the count of the boxes chosen (shown faded); ∞ means no limit. Players who put boxes together (two Act I boxes…) or made pieces by hand raise the numbers here.')} (${tr('Boxes')}: ${atos === 1 ? tr('Act I') : tr('Acts I and II')})</p>
    ${secao(tr('3D objects and tokens'), objetos, true)}${secao(tr('Pillars that hold tiles'), pilares)}${secao(tr('Map tiles'), pecas)}${doUsuario ? secao(tr('Workshop pieces'), doUsuario) : ''}
    <div class="rodape"><button data-o="est">${tr('Use the counts of the boxes')}</button><button data-o="nao">${tr('Cancel')}</button><button class="primario" data-o="ok">${tr('Save')}</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="nao"]').onclick = fechar;
    el.querySelector('[data-o="est"]').onclick = () => { try { localStorage.removeItem('bigorna-terreno'); } catch { } fechar(); tudo(); aviso(tr('Piece counts: those of the boxes chosen.')); };
    el.querySelector('[data-o="ok"]').onclick = () => { const v = {}; el.querySelectorAll('[data-g]').forEach(i => { if (i.value !== '') v[i.dataset.g] = Math.max(0, +i.value || 0); });
      try { if (Object.keys(v).length) localStorage.setItem('bigorna-terreno', JSON.stringify(v)); else localStorage.removeItem('bigorna-terreno'); } catch { } fechar(); tudo(); aviso(tr('Piece counts saved.')); };
  });
}
/* everything goes back to the start: the work on screen (map or campaign), the Workshop (monsters, items, materials,
   objects… imported or made), the quick save, the generators' archetypes and boxes, hints and warnings, window positions
   and sizes, the author, the export folder and the autosave. The language of the editor stays. The copy of the game data
   kept in the browser also stays: it is the game's, and is read again from the mod's files anyway. Asks first and offers
   to export the work. */
let REDEFININDO = false;
function resetarConfiguracoes() {
  const temTrabalho = !!(campanha || projeto.salas.length || projeto.meta.name || Object.values(bestiario() || {}).some(l => Array.isArray(l) && l.length));
  modal(tr('Reset everything?'), `<p>${tr('This erases everything the editor keeps: the map or campaign on screen, the Workshop (monsters, items, materials, objects, imported or made), the quick save, your archetypes, the hints and warnings, window positions and sizes, the author, the export folder and the autosave.')}</p><p class="ajuda">${tr('The language of the editor stays. Files already exported stay in their folder.')}</p>
    ${temTrabalho ? `<button class="op destaque" data-o="exp"><b>${tr('Export, then reset')}</b><small>${tr('Writes the work on screen first.')}</small></button>` : ''}
    <button class="op perigo" data-o="ja"><b>${tr('Reset everything')}</b><small>${tr('Everything not exported is lost.')}</small></button>
    <div class="rodape"><button data-o="nao">${tr('Cancel')}</button></div>`, (el, fechar) => {
    el.querySelector('[data-o="nao"]').onclick = fechar;
    el.querySelector('[data-o="ja"]').onclick = () => { if (temTrabalho && !confirm(tr('Reset everything without exporting? This cannot be undone.'))) return; fechar(); redefinirTudo(); };
    const ex = el.querySelector('[data-o="exp"]'); if (ex) ex.onclick = async () => { fechar(); try { if (!(await exportarTudo())) return; } catch (e) { return aviso(tr('Export failed') + ' (' + e.message + '): ' + tr('nothing was reset.')); } redefinirTudo(); };
  });
}
async function redefinirTudo() {
  REDEFININDO = true;   // no autosave may write the old work back while the page reloads
  try { Auto.esquecer(); } catch { }
  campanha = null; projeto = projetoNovo();
  try { Object.keys(localStorage).filter(k => /^bigorna/i.test(k) && k !== 'bigorna-idioma').forEach(k => localStorage.removeItem(k)); } catch { }
  try { sessionStorage.clear(); } catch { }
  try { await Config.limparPasta(); } catch { }
  location.reload();
}
$('#btnConfig').onclick = () => Config.abrirDialogo(() => { renderCabecalho(); renderConferencia(); }, EXTRAS_CONFIG);

// ------------------------------------------------------------ start-up: restore the last work
(function iniciar() {
  const restaurado = restaurarEstado();
  if (!projeto.meta.author) projeto.meta.author = autorGuardado();
  camposDaMissao(); tudo(); redimensionar(); enquadrar();
  if (restaurado) aviso('Your last work was restored' + (campanha ? ' (campaign “' + (campanha.meta.name || '?') + '”)' : projeto.meta.name ? ' (map “' + projeto.meta.name + '”)' : '') + '.');
})();
