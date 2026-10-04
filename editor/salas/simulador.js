/* Simulation of a map (debug): a small party plays the map on the table's own rules, at a low intensity, to see whether
   it can be won and whether it asks the right effort. The model (see LEIAME, "Simulação"):
   - heroes: SIM.herois of them, SIM.vida health each (a pool: the party falls when the pool is empty), SIM.acoes actions a
     round, no special weapons nor abilities; every test roll gives SIM.sucessos successes (a test asking more fails; a
     cumulative one adds them up try after try); an attack deals SIM.dano per success minus the monster's defence (at least
     1);
   - monsters: the map's own and the balanced groups (the game's rule, simularVagas, for the party's size); each alive
     monster hits once a round for its base attack + 1 (SIM.golpe), the round after it comes in when it came in away from
     the party;
   - the party goes where the map needs it (what opens a room, adds to a count, ends the map) and, while nothing presses,
     uses what else it finds (searches, chests, people); it heals only from what the texts say ("heals 3");
   - moving to another room (or across the room) is a move of the whole party: one action of each hero.
   What it reports, besides the outcome: health lost and left, rounds, items and gold, monsters, heals that came when the
   party was whole, effects against monsters used with no monster in play. */
const SIM = { herois: 2, vida: 8, acoes: 2, sucessos: 2, dano: 3, defesa: 0.5, golpe: 0, fadiga: 0.3, maxRodadas: 60 };

function simularMapa(pm, opcoes = {}) {
  const cfg = { ...SIM, ...opcoes }; const H = cfg.herois;
  return comProjeto(pm, () => simularPartida(pm, cfg, H));
}
function simularPartida(pm, cfg, H) {
  const R = { venceu: false, perdeu: false, motivo: '', rodadas: 0, limite: pm.meta.limite || 0, vidaMax: H * cfg.vida, danoSofrido: 0, vidaMin: H * cfg.vida, curaUtil: 0, curaPerdida: 0, curasCheio: [],
    itens: 0, pontosEspolio: 0, ouro: 0, monstros: 0, monstrosPorSala: {}, efeitosVazios: [], testesImpossiveis: [], travado: false, usados: 0, log: [] };
  let vida = H * cfg.vida, fadiga = 0, ouro = 0, rodada = 1, local = 0, venceu = false, perdeu = false;
  const abertas = new Set([0]); const removidas = new Set(); const cont = {}; const contCheio = new Set(); const vigias = [];
  (pm.contadores || []).forEach(c => { cont[c.nome] = c.inicio || 0; });
  const usos = new Map(); const gastos = new Set(); const escondidos = new Set(); const tirados = new Set(); const opcoesUsadas = new Map(); const acumulado = {};
  const timers = []; const vivos = []; const grupos = {};   // monsters in play; groups: uid → {sala, dono, lista, vivos}
  pm.salas.forEach((s, si) => s.objetos.forEach((o, oi) => { if (o.hidden) escondidos.add(si + ':' + oi); }));
  const log = t => { if (R.log.length < 400) R.log.push('R' + rodada + ': ' + t); };
  const numeroDe = (t, re) => { const m = re.exec(t || ''); return m ? +m[1] : 0; };
  // ---- effects told in texts (the table applies them): damage, fatigue, heals
  const efeitosDoTexto = (t, onde) => {
    if (!t) return; const cada = /(cada herói(?! que)|every hero(?! carrying)|each hero(?! carrying)|todos os heróis)/i.test(t) ? H : 1;
    // (a test told in the text, "whoever fails suffers 2 damage": the party rolls its successes; a test asks at most 2 here)
    if (/(quem falhar|whoever fails|who fails)/i.test(t) && cfg.sucessos >= 2) return;
    const dano = numeroDe(t, /(?:sofre|sofrem|sofram|suffers?)\s+(\d+)\s+(?:de\s+)?(?:dano|damage)/i); if (dano) ferir(dano * cada, 'texto');
    const fad = numeroDe(t, /(?:sofre|sofrem|sofram|suffers?)\s+(\d+)\s+(?:de\s+)?(?:fadiga|fatigue)/i); if (fad) fadiga += fad * cada;
    let cura = numeroDe(t, /(?:cura|curam|heals?)\s+(\d+)/i); if (/(cura tudo|heals? fully|cura toda)/i.test(t)) cura = cfg.vida;
    if (cura) curar(cura * cada, onde);
  };
  R.danoPor = {}; const ferir = (n, de) => { R.danoPor[de] = (R.danoPor[de] || 0) + n; vida -= n; R.danoSofrido += n; if (vida < R.vidaMin) R.vidaMin = vida; if (vida <= 0 && !perdeu) { perdeu = true; R.motivo = 'party defeated (' + de + ')'; } };
  const curar = (n, onde) => { const falta = H * cfg.vida - vida; const util = Math.min(falta, n); vida += util; R.curaUtil += util; R.curaPerdida += n - util; if (n - util > 0 && util === 0) R.curasCheio.push(onde); };
  // ---- requirements
  const vivosDaSala = si => vivos.filter(m => m.sala === si && m.hp > 0).length;
  const reqOk = rs => (rs || []).every(r => r.tipo === 'counter' ? (cont[r.contador] || 0) >= (r.meta || 1) : r.tipo === 'room_open' ? abertas.has(r.sala) : r.tipo === 'enemies_defeated' ? abertas.has(r.sala) && !vivosDaSala(r.sala) : r.tipo === 'gold' ? ouro >= (r.amount || 0) : true);
  // ---- monsters
  const statsDe = (id, tier) => { const m = monstro(id); const ts = (m?.tiers || []); const t = ts.find(x => x.tier === tier) || ts.slice().sort((a, b) => Math.abs(a.tier - tier) - Math.abs(b.tier - tier))[0]; return t ? { hp: t.hp, def: t.def, atk: t.atk } : { hp: 20, def: 1, atk: 1 }; };
  const media = (ids, tier) => { const ss = ids.map(id => statsDe(id, tier)); if (!ss.length) return { hp: 20, def: 1, atk: 1 }; const k = x => Math.round(ss.reduce((a, s) => a + s[x], 0) / ss.length); return { hp: k('hp'), def: k('def'), atk: k('atk') }; };
  const entrar = (sala, st, grupo, dono) => { const m = { sala, ...st, grupo, dono, chegando: sala !== local }; log('monster in room ' + (sala + 1) + ' hp' + st.hp + ' atk' + st.atk + ' def' + st.def); vivos.push(m); R.monstros++; R.monstrosPorSala[sala] = (R.monstrosPorSala[sala] || 0) + 1; if (grupo) { grupos[grupo] = grupos[grupo] || { sala, lista: [], dono }; grupos[grupo].lista.push(m); } return m; };
  const poolDaSala = si => poolDe(pm, si).filter(id => monstro(id));
  const porPool = (si, vagas, intensidade, grupo, dono) => { if (!vagas) return; const x = simularVagas(vagas, intensidade, poolDaSala(si), H, pm); for (let k = 0; k < x.n; k++) entrar(si, media(poolDaSala(si), x.tier), grupo, dono); };
  const abrirSala = si => { if (abertas.has(si) || removidas.has(si)) return; abertas.add(si); log('room ' + (si + 1) + ' opens');
    const s = pm.salas[si]; (s.inimigos || []).filter(e => !ehPool(e.enemy)).forEach(e => { const m = entrar(si, statsDe(e.enemy, (e.tierPorHerois ? e.tierPorHerois[Math.min(3, H - 1)] : e.tier) || 1), null, e); if (e.bonusAtaque) m.atk += e.bonusAtaque; if (e.bonusDefesa) m.def += e.bonusDefesa; });
    porPool(si, vagasPoolDaSala(s), intensidadeDaSala(s), 'G' + si, s.grupoPool || null); };
  // ---- the lists of an owner
  const executar = (dono, lista, si, ctx = {}) => { for (const g of (dono && dono[lista]) || []) { if (venceu || perdeu) return; passo(dono, g, si, ctx); } };
  const passo = (o, g, si, ctx) => {
    if (!reqOk(g.requisitos)) { if (o['senao:' + g.uid]) executar(o, 'senao:' + g.uid, si, ctx); ctx.falhouReq = true; return; }
    switch (g.tipo) {
      case 'text': efeitosDoTexto(g.text, 'room ' + (si + 1)); break;
      case 'counter': { const a = g.acao || 'add'; if (a === 'use') { vigias.push({ o, g, si, feito: false }); break; }
        cont[g.contador] = a === 'set' ? (g.n ?? 0) : a === 'sub' ? (cont[g.contador] || 0) - (g.n ?? 1) : (cont[g.contador] || 0) + (g.n ?? 1); contadores(); break; }
      case 'open_room': abrirSala(g.sala); break;
      case 'spawn': if (g.fonte === 'pool') porPool(si, (g.cells || []).length, intensidadeDoGatilho(g), g.uid, o); else (g.inimigos || []).forEach(e => { const m = entrar(si, statsDe(e.enemy, (e.tierPorHerois ? e.tierPorHerois[Math.min(3, H - 1)] : e.tier) || 1), g.uid, o); m.dono = e; if (e.bonusAtaque) m.atk += e.bonusAtaque; }); break;
      case 'rounds': timers.push({ o, g, si, desde: rodada, feitas: 0 }); break;
      case 'skill_test': { const S = g.successes || 2; let ok;
        if (g.cumulativo) { acumulado[g.uid] = (acumulado[g.uid] || 0) + cfg.sucessos; ok = acumulado[g.uid] >= S; } else ok = cfg.sucessos >= S;
        if (!ok && !g.cumulativo) { ctx.impossivel = true; if (!R.testesImpossiveis.includes(g.uid)) R.testesImpossiveis.push(g.uid); }
        ctx.teste = ok ? 'ok' : 'fail'; executar(o, (ok ? 'ok:' : 'fail:') + g.uid, si, ctx); if (ok && g.cumulativo) ctx.gasta = true; break; }
      case 'choice': { const i = escolher(o, g, si); ctx.opcao = i; if (i === -2) { ctx.nada = true; break; } if (i < 0) break; if (g.umaVez) { const u = opcoesUsadas.get(g.uid) || new Set(); u.add(i); opcoesUsadas.set(g.uid, u); }
        executar(o, 'op' + i + ':' + g.uid, si, ctx); break; }
      case 'remove_object': { const k = g.proprio ? ctx.chave : g.objSala + ':' + g.objIndex; if (k) tirados.add(k); break; }
      case 'add_object': escondidos.delete(g.objSala + ':' + g.objIndex); break;
      case 'give_item': if (g.acao === 'remove') { if (g.modo === 'gold') ouro -= g.amount || 0; break; }
        if (g.modo === 'gold') { ouro += g.amount || 0; R.ouro += g.amount || 0; } else if (g.modo === 'newitem') { if ((g.requisitos || []).some(r => r.tipo === 'gold')) R.comprados = (R.comprados || 0) + (g.amount || 1); else R.itens += g.amount || 1; } else R.pontosEspolio += g.points || 0; break;
      case 'move_heroes': local = g._sala ?? (salaDasCasas(g.cells) ?? local); break;
      case 'remove_room': removidas.add(g.sala); vivos.forEach(m => { if (m.sala === g.sala) m.hp = 0; }); break;
      case 'enemy_condition': { const alvo = vivos.filter(m => m.hp > 0);
        if (g.acao === 'heal') { alvo.filter(m => g.alvo !== 'group' || ('room-' + (m.sala + 1)) === g.grupo || m.grupo === g.grupo).forEach(m => { m.hp += g.amount || 0; }); break; }
        if (!alvo.length) R.efeitosVazios.push('room ' + (si + 1) + ': ' + (g.acao === 'damage' ? 'damage' : g.condition || g.acao));
        if (g.acao === 'damage') alvo.forEach(m => { m.hp -= g.amount || 1; }); mortes(); break; }
      case 'end_map': if (g.resultado === 'derrota') { perdeu = true; R.motivo = 'end_map (defeat)'; } else { venceu = true; } break;
    }
  };
  const salaDasCasas = cells => { if (!(cells || []).length) return null; const [x, y] = cells[0]; for (let si = 0; si < pm.salas.length; si++) if (chaoDaSala(si, pm).has(x + ',' + y)) return si; return null; };
  // counters full: their own triggers (once) and the watches waiting on them
  const contadores = () => { (pm.contadores || []).forEach(c => { if (!contCheio.has(c.nome) && c.total && (cont[c.nome] || 0) >= c.total) { contCheio.add(c.nome); executar(c, 'gatilhos', 0, {}); } });
    vigias.forEach(v => { if (!v.feito && (cont[v.g.contador] || 0) >= (v.g.n || 1)) { v.feito = true; executar(v.o, 'conta:' + v.g.uid, v.si, {}); } }); };
  // a monster falls: its own triggers, and its group's when the whole group is down
  const caidos = new Set();
  const mortes = () => { let mudou = true; while (mudou) { mudou = false;
    vivos.slice().forEach(m => { if (m.hp > 0 || caidos.has(m)) return; caidos.add(m); mudou = true; if (m.dono && m.dono.enemy && !m.dono.ehGrupo) executar(m.dono, 'gatilhos', m.sala, {}); });
    Object.entries(grupos).forEach(([u, gr]) => { if (gr.feito || gr.lista.some(m => m.hp > 0)) return; gr.feito = true; mudou = true;
      if (u.startsWith('G')) { const gp = pm.salas[gr.sala]?.grupoPool; if (gp) executar(gp, 'gatilhos', gr.sala, {}); }
      else if (gr.dono) executar(gr.dono, 'grupo:' + u, gr.sala, {}); }); } };
  // ---- the heroes' choices among the answers of a question
  const escolher = (o, g, si) => {
    const n = (g.options || []).length; if (!n) return -1; const usadas = opcoesUsadas.get(g.uid) || new Set();
    const livres = [...Array(n).keys()].filter(i => !g.umaVez || !usadas.has(i)); if (!livres.length) return -1;
    // a question that gates the way (a point of no return, a waystone, a merchant): the first answer; searches: the best
    const texto = i => { const l = o['op' + i + ':' + g.uid] || []; return JSON.stringify(l.concat(l.filter(x => x.tipo === 'skill_test').flatMap(x => o['ok:' + x.uid] || []))) + ' ' + (g.options[i].response || ''); };
    const valor = i => { const t = texto(i); let v = 0; if (/open_room|"counter"|move_heroes/.test(t)) v += 10; if (/newitem/.test(t)) v += 4; if (/"random"/.test(t)) v += 2; if (/"gold"/.test(t) && !/"remove"/.test(t)) v += 1;
      if (/(cura|heals?)\s+\d/i.test(t)) v += vida < H * cfg.vida - 2 ? 5 : -2; if (/enemy_condition/.test(t) && !/"acao":"heal"/.test(t)) v += vivos.some(m => m.hp > 0) ? 3 : -6;
      // (a status question, "the guide fell": never the bad news by choice)
      if (/"tipo":"escort","acao":"fim"|"acao":"set","n":0/.test(t)) v -= 20; if (/"remove".*"gold"|"acao":"remove"/.test(t)) v -= 1; if (/(Ainda não|Not yet|Nada, obrigado|Nothing, thanks|Seguir sem|Go on without|Deixar|Leave it)/i.test(g.options[i].text || '')) v -= 5; return v; };
    const melhor = livres.slice().sort((a, b) => valor(b) - valor(a))[0];
    return g.umaVez && valor(melhor) < 0 ? -2 : melhor;
  };
  // ---- what the party can do next: the objects of the open rooms not spent, with what using them brings
  const candidatos = () => { const out = [];
    pm.salas.forEach((s, si) => { if (!abertas.has(si) || removidas.has(si)) return;
      s.objetos.forEach((o, oi) => { const k = si + ':' + oi; if (gastos.has(k) || tirados.has(k) || escondidos.has(k) || inuteis.has(k) || !(o.gatilhos || []).length) return;
        if (o.gemeo != null && !gastos.has(si + ':' + o.gemeo)) { /* the twin stands for the same thing */ }
        const gs = todosGatilhos(o); const t = JSON.stringify(gs);
        const fecha = gs.filter(g => g.tipo === 'open_room').some(g => !abertas.has(g.sala) && !removidas.has(g.sala));
        const progride = fecha || gs.some(g => g.tipo === 'counter' && (g.acao || 'add') === 'add' && !contCheio.has(g.contador)) || ehObjetoFinal(si, oi);
        const bloqueado = (o.gatilhos || []).length && (o.gatilhos || []).every(g => !reqOk(g.requisitos)) && !(o.gatilhos || []).some(g => o['senao:' + g.uid] && /open_room|"counter"/.test(JSON.stringify(o['senao:' + g.uid])));
        // (a search whose every answer left is of no use now: later)
        const busca = (o.gatilhos || []).find(g => g.tipo === 'choice' && g.umaVez); if (busca && !progride && escolher(o, busca, si) === -2) return;
        // (a heal and nothing else, with the party whole: later, when it is of use)
        if (!progride && !busca && /(cura|heals?)\s+\d/i.test(t) && !/give_item/.test(t) && vida >= H * cfg.vida) return;
        out.push({ si, oi, o, k, progride, bloqueado, util: /give_item|cura|heals|newitem/.test(t), t }); }); });
    return out; };
  const fm = pm.meta.finalMission || { tipo: 'defeat_all' };
  const ehObjetoFinal = (si, oi) => fm.tipo === 'use_object' && fm.sala === si && fm.objeto === oi;
  const venceuJa = () => { if (venceu) return true;
    if (fm.tipo === 'defeat_room') return abertas.has(fm.sala) && !vivosDaSala(fm.sala);
    if (fm.tipo === 'trigger') { const c = (pm.contadores || []).find(x => x.missao && x.missao.uid === fm.uid); return c ? (cont[c.nome] || 0) >= c.total : false; }
    if (fm.tipo === 'use_object') return !!R._finalOk;
    if (fm.tipo === 'defeat_all') return rodada > 1 && !vivos.some(m => m.hp > 0);
    return false; };
  // ---- the distance, in party moves, from where the party is to room si (through the rooms opened from each other)
  const distancia = si => { if (si === local) return 0; const viz = new Map(); pm.salas.forEach((x, j) => { const ab = abridorDe(pm, j); if (!ab) return; [[ab.ri, j], [j, ab.ri]].forEach(([a, b]) => { if (!viz.has(a)) viz.set(a, []); viz.get(a).push(b); }); });
    const d = new Map([[local, 0]]); const fila = [local]; while (fila.length) { const a = fila.shift(); for (const b of viz.get(a) || []) if (!d.has(b) && abertas.has(b) && !removidas.has(b)) { d.set(b, d.get(a) + 1); fila.push(b); } }
    return d.has(si) ? d.get(si) : 3; };
  // ---- one use of an object by a hero
  const estado = () => abertas.size + '|' + JSON.stringify(cont) + '|' + JSON.stringify(acumulado) + '|' + vivos.filter(m => m.hp > 0).length + '|' + tirados.size + '|' + escondidos.size + '|' + R.itens + '|' + ouro + '|' + timers.length;
  const inuteis = new Set(); let ultimoEstado = '';
  const usar = c => { const { si, oi, o, k } = c; const ctx = { chave: k }; const e0 = estado(); log('use ' + baseObj(o.type) + ' in room ' + (si + 1) + (o.name ? ' "' + o.name + '"' : '') + (c.progride ? ' [progress]' : ''));
    // (as the export does: an object locked by a requirement that also removes itself leaves the board only when a locked
    // trigger runs, never when its requirement fails)
    const travados = (o.gatilhos || []).filter(g => (g.requisitos || []).length); const saiSo = travados.length ? (o.gatilhos || []).filter(g => !(g.requisitos || []).length && g.tipo === 'remove_object' && g.proprio) : [];
    const passou = travados.some(g => reqOk(g.requisitos));
    for (const g of (o.gatilhos || []).filter(g => !saiSo.includes(g))) { if (venceu || perdeu) break; passo(o, g, si, ctx); }
    if (saiSo.length && passou) saiSo.forEach(g => passo(o, g, si, ctx)); if (o.acaoExtra && ctx.opcao != null && o.acaoExtra['op' + ctx.opcao + ':' + (o.gatilhos || [])[0]?.uid]) { /* a free answer */ }
    R.usados++; if (ehObjetoFinal(si, oi) && !ctx.falhouReq) R._finalOk = true;
    const n = (usos.get(k) || 0) + 1; usos.set(k, n);
    const limite = o.usos === 'always' ? Infinity : +o.usos > 0 ? +o.usos : 1;
    if (!ctx.falhouReq && (n >= limite || ctx.gasta)) gastos.add(k);
    if (ctx.impossivel) gastos.add(k);   // (a test the party can never pass: it stops trying)
    const gUmaVez = (o.gatilhos || []).find(g => g.tipo === 'choice' && g.umaVez); if (gUmaVez && (opcoesUsadas.get(gUmaVez.uid) || new Set()).size >= (gUmaVez.options || []).length) gastos.add(k);
    mortes(); contadores();
    // a use that changed nothing (a status question, a locked door tried): not again until something changes
    if (estado() === e0) inuteis.add(k); else { inuteis.clear(); ultimoEstado = estado(); }
    return ctx; };
  // ---- the rounds
  let semProgresso = 0;
  while (!venceu && !perdeu && rodada <= cfg.maxRodadas) {
    // start of the round: timers ("rounds"), map events, pressure
    timers.forEach(t => { const n = t.g.n || 1; const passou = rodada - t.desde; if (t.g.modo === 'uma') { if (!t.feitas && passou >= n) { t.feitas = 1; executar(t.o, 'rodada:' + t.g.uid, t.si, {}); } }
      else if (passou > 0 && passou % n === 0 && (!t.g.vezes || t.feitas < t.g.vezes)) { t.feitas++; executar(t.o, 'rodada:' + t.g.uid, t.si, {}); } });
    (pm.eventos || []).forEach(ev => { const r0 = ev.rodada || 1; if (rodada < r0) return; if (rodada === r0 || (ev.cada && (rodada - r0) % ev.cada === 0)) executar(ev, 'gatilhos', ev.sala || 0, {}); });
    const pr = pm.meta.pressao; if (pr && pr.tipo === 'fadiga' && rodada >= pr.desde) fadiga += H;
    mortes(); contadores(); if (venceuJa()) { venceu = true; break; } if (perdeu) break;
    // the heroes' actions
    let acoes = H * cfg.acoes; let fez = false;
    while (acoes > 0 && !venceu && !perdeu) {
      const alvo = vivos.filter(m => m.hp > 0).sort((a, b) => a.hp - b.hp)[0];
      if (alvo) { alvo.hp -= Math.max(1, (cfg.danoAtaque != null ? cfg.danoAtaque : cfg.sucessos * cfg.dano) - Math.floor((alvo.def || 0) * cfg.defesa));   // (custom: the user's average damage per attack)
         acoes--; if (alvo.hp <= 0) log('a monster falls'); fez = true; mortes(); contadores(); if (venceuJa()) venceu = true; continue; }
      { const e = estado(); if (e !== ultimoEstado) { inuteis.clear(); ultimoEstado = e; } }
      const cs = candidatos().filter(c => !c.bloqueado);
      const pressa = R.limite && rodada > R.limite * 0.6;
      // (what stops monsters from coming, a possessed one, a nest, and what is half done, first; then the nearest)
      const para = c => /"acao":"set","n":0/.test(c.t) && /skill_test/.test(c.t) ? 0 : (c.o.gatilhos || []).some(g => g.tipo === 'skill_test' && acumulado[g.uid]) ? 0 : 1;
      const prog = cs.filter(c => c.progride).sort((a, b) => para(a) - para(b) || distancia(a.si) - distancia(b.si));
      const opc = pressa ? [] : cs.filter(c => !c.progride && (c.util || /choice/.test(c.t))).sort((a, b) => distancia(a.si) - distancia(b.si));
      // first what is on the way (in this room), then the nearest thing that moves the map on
      const aqui = opc.filter(c => c.si === local); const c = (prog[0] && para(prog[0]) === 0 ? prog[0] : null) || aqui[0] || prog[0] || opc[0];
      if (!c) break;
      const d = distancia(c.si) + (c.si === local ? 0 : 0);
      const custo = d * H + 1; if (custo > acoes && d > 0) { if (acoes >= H) { acoes -= H; local = c.si; fez = true; } else acoes = 0; continue; }
      acoes -= d * H + 1; local = c.si; usar(c); fez = true; if (venceuJa()) venceu = true;
    }
    if (venceu || perdeu) break;
    // the monsters: every monster in play hits once (one that came in away from the party arrives first)
    { let d = 0; vivos.filter(m => m.hp > 0).forEach(m => { if (m.chegando) { m.chegando = false; return; } d += (m.atk || 1) + cfg.golpe; ferir((m.atk || 1) + cfg.golpe, 'monsters'); R.danoPor['room ' + (m.sala + 1) + ' ' + (pm.salas[m.sala]?.funcao || '')] = (R.danoPor['room ' + (m.sala + 1) + ' ' + (pm.salas[m.sala]?.funcao || '')] || 0) + (m.atk || 1) + cfg.golpe; }); if (d) log('monsters hit for ' + d + ' (health ' + vida + ')'); }
    if (perdeu) break;
    if (!fez && !vivos.some(m => m.hp > 0)) { semProgresso++; if (semProgresso >= 3) { R.travado = true; R.motivo = 'stuck: nothing left to do'; break; } } else semProgresso = 0;
    rodada++;
    if (R.limite && rodada > R.limite) { perdeu = true; R.motivo = 'round limit'; break; }
  }
  // fatigue weighs as damage at the end (the table converts it)
  if (fadiga) ferir(Math.floor(fadiga * cfg.fadiga), 'fatigue');
  if (!venceu && !perdeu && rodada > cfg.maxRodadas) R.motivo = 'too many rounds';
  R.venceu = venceu && !perdeu; R.perdeu = !R.venceu; R.rodadas = rodada; R.vidaFinal = Math.max(0, vida); R.fadiga = fadiga;
  return R;
}
/* the static look at a map: effects against monsters in rooms where no monster ever is, heals in the first room */
function olharEstatico(pm) {
  const out = { efeitosSemMonstros: [], curasNoInicio: 0 }; const com = salasComMonstros(pm); const temMonstro = si => com.has(si);
  pm.salas.forEach((s, si) => s.objetos.forEach(o => { const gs = todosGatilhos(o);
    if (!temMonstro(si) && gs.some(g => g.tipo === 'enemy_condition' && g.acao !== 'heal')) out.efeitosSemMonstros.push(si + 1);
    if (si === 0 && JSON.stringify(gs).match(/(cura|heals?) \d/i)) out.curasNoInicio++; }));
  return out;
}
/* the verdict for the easy level: can it be won, and is it a fair effort */
const META_FACIL = { perdaMin: 0.25, perdaMax: 0.8, vidaMinMin: 0.15, itensMax: 3, monstrosPorSalaPorHeroi: 0.75, monstrosSalaMais: 2 };
function avaliarFacil(pm, R, H = SIM.herois) {
  const p = []; const est = olharEstatico(pm);
  if (!R.venceu) p.push('not won: ' + (R.motivo || '?'));
  const perda = R.danoSofrido / R.vidaMax;
  if (R.venceu && perda < META_FACIL.perdaMin) p.push('too easy: ' + Math.round(perda * 100) + '% of health lost');
  if (perda > META_FACIL.perdaMax || R.vidaMin / R.vidaMax < META_FACIL.vidaMinMin) p.push('too hard: health fell to ' + Math.max(0, Math.round(R.vidaMin / R.vidaMax * 100)) + '%');
  if (R.itens > META_FACIL.itensMax) p.push('too many items: ' + R.itens);
  if (R.monstros > Math.max(2, pm.salas.length) * H * META_FACIL.monstrosPorSalaPorHeroi) p.push('too many monsters: ' + R.monstros);
  const cheia = Object.entries(R.monstrosPorSala).filter(([, n]) => n > H + META_FACIL.monstrosSalaMais); if (cheia.length) p.push('crowded rooms: ' + cheia.map(([s, n]) => (+s + 1) + ' (' + n + ')').join(', '));
  if (R.curasCheio.length) p.push('heals with the party whole: ' + R.curasCheio.length);
  if (R.efeitosVazios.length || est.efeitosSemMonstros.length) p.push('effects against monsters with none in play: ' + (R.efeitosVazios.length + est.efeitosSemMonstros.length));
  if (R.testesImpossiveis.length) p.push('tests the easy party cannot pass: ' + R.testesImpossiveis.length);
  return { problemas: p, perda: Math.round(perda * 100), vidaMin: Math.max(0, Math.round(R.vidaMin / R.vidaMax * 100)), est };
}
/* many generated maps of the easy level, simulated: a table (Map generator, with the debug switch on) */
function simularLote(n = 20, base = {}, herois = [2]) {
  const out = []; const prems = PREMISSAS_MAPA.map(x => x.id); const temas = Object.keys(TEMAS_SALA).filter(t => t !== 'qualquer');
  for (let i = 0; i < n; i++) {
    const o = { premissa: prems[i % prems.length], truque: 'auto', modalidade: 'auto', duracao: ['curta', 'media', 'longa'][i % 3], dificuldade: 'facil', pressao: 'auto', tema: temas[i % temas.length], semente: 'sim' + i, atos: 2, manterPool: false, manterItens: false, ...base };
    const r = gerarMapa(o); if (r.erro) { out.push({ i, erro: r.erro }); continue; }
    herois.forEach(H => { const R = simularMapa(r.projeto, { herois: H }); const a = avaliarFacil(r.projeto, R, H);
      out.push({ i, H, danoPor: R.danoPor, premissa: o.premissa, duracao: o.duracao, modalidade: r.projeto.meta.gerado.modalidade, truque: r.projeto.meta.gerado.truque, salas: r.projeto.salas.length, venceu: R.venceu, motivo: R.motivo, rodadas: R.rodadas, limite: R.limite, perda: a.perda, vidaMin: a.vidaMin, itens: R.itens, monstros: R.monstros, curasCheio: R.curasCheio.length, efeitosVazios: R.efeitosVazios.length + a.est.efeitosSemMonstros.length, problemas: a.problemas }); });
  }
  return out;
}
/* the table of the simulation of one map, for 2, 3 and 4 heroes (Map generator > Simulate) */
function tabelaDaSimulacao(pm, custom) {
  const lista = custom && custom.listaHerois && custom.listaHerois.length ? custom.listaHerois : [2, 3, 4];
  const linhas = lista.map(H => { const R = simularMapa(pm, { ...(custom || {}), herois: H }); const a = avaliarFacil(pm, R, H);
    return `<tr><td>${H}</td><td>${R.venceu ? '✓' : '✗'}</td><td>${R.rodadas}${R.limite ? ' / ' + R.limite : ''}</td><td>${a.perda}%</td><td>${a.vidaMin}%</td><td>${R.monstros}</td><td>${R.itens}</td><td>${esc(a.problemas.map(x => tr(x.split(':')[0]) + (x.includes(':') ? ':' + x.slice(x.indexOf(':') + 1) : '')).join('; ') || tr('none'))}</td></tr>`; });
  return `<table class="simBal"><thead><tr><th>${tr('Heroes')}</th><th>${tr('Won')}</th><th>${tr('Rounds')}</th><th>${tr('Health lost')}</th><th>${tr('Lowest health')}</th><th>${tr('Monsters')}</th><th>${tr('Items')}</th><th>${tr('Findings')}</th></tr></thead><tbody>${linhas.join('')}</tbody></table>`;
}

/* the custom simulation (Map generator > Custom simulation): the party the user describes, kept in this browser */
const CAMPOS_SIM = [
  ['vida', 'Health per hero', 8, 1, 40, 1],
  ['danoAtaque', 'Average damage per attack', 6, 1, 30, 1],
  ['acoes', 'Attacks (actions) per hero per round', 2, 1, 6, 1],
  ['sucessos', 'Average successes on a test roll', 2, 0, 8, 1],
  ['golpe', 'Extra damage of each monster hit', 0, 0, 10, 1],
  ['defesa', 'Share of the monster’s defence that counts (0 to 1)', 0.5, 0, 1, 0.1],
  ['fadiga', 'Damage per point of fatigue (0 to 1)', 0.3, 0, 1, 0.1]
];
function simulacaoGuardada() { try { return JSON.parse(localStorage.getItem('bigorna-sim-custom') || 'null') || {}; } catch { return {}; } }
function formularioSimulacao() {
  const g = simulacaoGuardada(); const her = g.listaHerois || [2, 3, 4];
  return `<div class="simCfg"><div class="linha"><span>${tr('Heroes')}:</span>${[1, 2, 3, 4].map(n => `<label class="chk"><input type="checkbox" data-simh="${n}" ${her.includes(n) ? 'checked' : ''}> ${n}</label>`).join('')}</div>
    <div class="grade2">${CAMPOS_SIM.map(([k, rot, def, mi, ma, pa]) => `<label class="campo"><span>${tr(rot)}</span><input type="number" data-sim="${k}" min="${mi}" max="${ma}" step="${pa}" value="${g[k] != null ? g[k] : def}"></label>`).join('')}</div>
    <p class="ajuda">${tr('An attack deals the average damage minus the share of the monster’s defence (at least 1); a test passes when the average successes reach what it asks. The findings (too easy, too hard) keep the measures of the easy level.')}</p></div>`;
}
function lerSimulacaoCustom() {
  const c = {}; document.querySelectorAll('#gm_simCfg [data-sim]').forEach(i => { const v = parseFloat(i.value); const campo = CAMPOS_SIM.find(x => x[0] === i.dataset.sim); c[i.dataset.sim] = isFinite(v) ? Math.min(campo[4], Math.max(campo[3], v)) : campo[2]; });
  c.listaHerois = [...document.querySelectorAll('#gm_simCfg [data-simh]:checked')].map(i => +i.dataset.simh); if (!c.listaHerois.length) c.listaHerois = [2, 3, 4];
  try { localStorage.setItem('bigorna-sim-custom', JSON.stringify(c)); } catch { }
  return c;
}
