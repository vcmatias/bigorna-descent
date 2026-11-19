/* Simulation of a map (debug): a small party plays the map on the table's own rules, at a low intensity, to see whether
   it can be won and whether it asks the right effort. The model (see LEIAME, "Simulação"):
   - heroes: SIM.herois of them, the health of the act each (VIDA_POR_ATO: the Act II hero cards have more, 11 on average;
     the act of the party, or else the act the map asks for) (a pool: the party falls when the pool is empty), SIM.acoes actions a
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
const SIM = { herois: 2, vida: 8, acoes: 2, sucessos: 2, dano: 3, defesa: 0.5, golpe: 0, fadiga: 0.3, maxRodadas: 60, foco: 0.6, custoUso: 2, sucessosAtaque: 2 };
/* v382 (calibrated against maps played in the app, 19/11/2026): the health of the heroes' cards, in the order of the starter four
   (Brynn, Syrus, Galaden, Vaerix), so a party of two has a fragile hero as at the table; a monster's hit goes to the hero with the
   least health left most of the time (SIM.foco), as the app's targets did; using a thing costs one more action (the walk inside the
   room to it: SIM.custoUso); an attack rolls the hero's die: about 2 successes with the advantage paid in fatigue (SIM.sucessosAtaque) */
const VIDAS_POR_ATO = { 1: [10, 7, 9, 8], 2: [14, 9, 12, 11] };
/* v261: the health of a hero by act (the average of the hero cards: Act I about 8, Act II 11) */
const VIDA_POR_ATO = { 1: 8, 2: 11 };

/* v365: the successes of a test roll of the party, by the difficulty and the act: those the generator asks of a test of the base
   (sucessosDoTeste(2)); Easy, always 2 */
function sucessosDaMesa(dif, ato) { const aj = dif === 'facil' ? 0 : ({ normal: 1, dificil: 2 }[dif] ?? 1) + (ato === 2 ? 1 : 0); return Math.min(4, 2 + Math.min(2, aj)); }
/* opcoes.ato: the act of the party (the one-shot map with a saved party); without it, the act the map asks for. A health
   given in opcoes (the custom simulation) stays */
function simularMapa(pm, opcoes = {}) {
  const ato = +opcoes.ato === 2 || +opcoes.ato === 1 ? +opcoes.ato : comProjeto(pm, () => atoNecessario(pm));
  // (v365: the difficulty of the map: the party rolls the successes the generator counted on for it (sucessosDoTeste: a test
  //  of the base, 2, is passed in one roll), so a Normal or Hard map is played by the party it was made for; before, every map
  //  was played by the Easy party, and every Normal and Hard map was lost)
  const dif = ['facil', 'normal', 'dificil'].includes(opcoes.dificuldade) ? opcoes.dificuldade : (pm.meta && pm.meta.gerado && pm.meta.gerado.dificuldade) || 'facil';
  const cfg = { ...SIM, ...opcoes, ato, dificuldade: dif }; if (opcoes.vida == null) cfg.vida = VIDA_POR_ATO[ato] || SIM.vida;
  cfg.vidas = opcoes.vida != null ? null : (VIDAS_POR_ATO[ato] || null);
  // (v365: the party of a Normal or Hard map is the one those maps are made for: weapons that hit harder (5 a success) and armour
  //  that blocks 1 of each monster's hit; measured on generated maps: 3 heroes win about 8 Normal maps in 10 and 2 Hard maps in 3 (asked as the game asks for them, BigornaGerador.rodar)
  //  Easy keeps its party. To be measured against the table (the plan of the simulator, item 6))
  if (dif !== 'facil') { if (opcoes.dano == null) cfg.dano = 5; if (opcoes.golpe == null) cfg.golpe = -1; }
  if (opcoes.sucessos == null) cfg.sucessos = sucessosDaMesa(dif, +(pm.meta && pm.meta.gerado && pm.meta.gerado.atos) || ato);
  const H = cfg.herois;   // (the successes by the boxes of the map: the generator counts the tests by them)
  return comProjeto(pm, () => simularPartida(pm, cfg, H));
}
function simularPartida(pm, cfg, H) {
  const maxH = Array.from({ length: H }, (_, i) => (cfg.vidas && cfg.vidas[i % cfg.vidas.length]) || cfg.vida); const vidaTot = maxH.reduce((a, b) => a + b, 0);
  const R = { venceu: false, perdeu: false, motivo: '', rodadas: 0, limite: pm.meta.limite || 0, vidaMax: vidaTot, danoSofrido: 0, vidaMin: vidaTot, curaUtil: 0, curaPerdida: 0, curasCheio: [],
    itens: 0, pontosEspolio: 0, ouro: 0, monstros: 0, monstrosPorSala: {}, efeitosVazios: [], testesImpossiveis: [], travado: false, usados: 0, log: [] };
  let vida = vidaTot, fadiga = 0, ouro = 0, rodada = 1, local = 0, venceu = false, perdeu = false;
  const abertas = new Set([0]); const removidas = new Set(); const cont = {}; const contCheio = new Set(); const vigias = [];
  (pm.contadores || []).forEach(c => { cont[c.nome] = +c.inicio || 0; });   // (a new counter starts at 0; an older one, or a flag of the generator, at its start)
  const usos = new Map(); const gastos = new Set(); const escondidos = new Set(); const tirados = new Set(); const opcoesUsadas = new Map(); const acumulado = {};
  const timers = []; const vivos = []; const grupos = {};   // monsters in play; groups: uid → {sala, dono, lista, vivos}
  pm.salas.forEach((s, si) => s.objetos.forEach((o, oi) => { if (o.hidden) escondidos.add(si + ':' + oi); }));
  const log = t => { if (R.log.length < 400) R.log.push('R' + rodada + ': ' + t); };
  // v380: the diary, round by round, in plain sentences (English, translated where it is shown): «+ details» of the table
  R.diario = []; let dia = null, nEv = 0; const nota = t => { if (nEv > 3000) return; if (!dia || dia.r !== rodada) { dia = { r: rodada, ev: [] }; R.diario.push(dia); } dia.ev.push(t); nEv++; };
  const nomeDe = o => o.name || nomeObj(o.type); const golpes = { n: 0, dano: 0, caidos: 0 };
  const fimDaRodada = () => { nota('—'); dia.ev.pop(); dia.fim = { vida: Math.max(0, vida), max: vidaTot, fadiga, emJogo: vivos.filter(m => m.hp > 0).length }; };
  const soltarGolpes = () => { if (golpes.n) nota('The heroes attack ' + golpes.n + ' time(s): ' + golpes.dano + ' damage' + (golpes.caidos ? ', ' + golpes.caidos + ' monster(s) defeated.' : '.')); golpes.n = golpes.dano = golpes.caidos = 0; };
  const numeroDe = (t, re) => { const m = re.exec(t || ''); return m ? +m[1] : 0; };
  // ---- effects told in texts (the table applies them): damage, fatigue, heals
  const efeitosDoTexto = (t, onde) => {
    if (!t) return; const cada = /(cada herói(?! que)|every hero(?! carrying)|each hero(?! carrying)|todos os heróis)/i.test(t) ? H : 1;
    // (a test told in the text, "whoever fails suffers 2 damage": the party rolls its successes; a test asks at most 2 here)
    if (/(quem falhar|whoever fails|who fails)/i.test(t) && cfg.sucessos >= 2) return;
    const dano = numeroDe(t, /(?:sofre|sofrem|sofram|suffers?)\s+(\d+)\s+(?:de\s+)?(?:dano|damage)/i); if (dano) ferir(dano * cada, 'texto', cada > 1 ? 'cada' : undefined);
    const fad = numeroDe(t, /(?:sofre|sofrem|sofram|suffers?)\s+(\d+)\s+(?:de\s+)?(?:fadiga|fatigue)/i); if (fad) { fadiga += fad * cada; nota('A text gives the party ' + fad * cada + ' fatigue.'); }
    let cura = numeroDe(t, /(?:cura|curam|heals?)\s+(\d+)/i); if (/(cura tudo|heals? fully|cura toda)/i.test(t)) cura = cfg.vida;
    if (cura) curar(cura * cada, onde, cada > 1);
  };
  // v380: each hero's own health, besides the party's pool (the pool decides the end; each hero's is told in the table):
  // a monster keeps hitting the hero it went for when it came in (one after the other as they come), a damage to one hero goes
  // to the one with the most health left, a heal to one hero to the most wounded, the fatigue at the end is shared
  const vidaH = maxH.slice(), danoH = Array(H).fill(0), minH = maxH.slice(); let proxAlvo = 0;
  // (which hero a monster's hit lands on: half the time the one it went for, else any hero, by a fixed draw: the same map gives
  //  the same story every time)
  let semente = 0; for (const c of String((pm.meta && pm.meta.name) || '') + H) semente = (Math.imul(semente, 31) + c.charCodeAt(0)) >>> 0; semente = semente || 7;
  const sorteio = () => { semente = (Math.imul(semente, 1103515245) + 12345) >>> 0; return (semente >>> 16) / 65536; };
  const alvoDoGolpe = m => sorteio() < cfg.foco ? vidaH.indexOf(Math.min(...vidaH)) : sorteio() < 0.5 ? m.alvo : Math.floor(sorteio() * H);
  const maisVida = () => vidaH.indexOf(Math.max(...vidaH)), maisFerido = () => vidaH.indexOf(Math.min(...vidaH));
  // (the rule book, p. 18 and 14: a hero at 0 health is wounded and comes back to full health; the first wound is light, the next
  //  one turns it severe, and a hero with a severe wound who is wounded again makes the heroes lose)
  const feridas = Array(H).fill(0);
  const ferirH = (i, n, de) => { if (perdeu) return; danoH[i] += n; vidaH[i] -= n; if (vidaH[i] < minH[i]) minH[i] = vidaH[i];
    if (vidaH[i] > 0) return; feridas[i]++; minH[i] = 0;
    if (feridas[i] >= 3) { perdeu = true; R.motivo = 'severe wound (' + de + ')'; nota('Hero ' + (i + 1) + ', with a severe wound, is wounded again: the heroes lose.'); return; }
    vidaH[i] = maxH[i]; nota(feridas[i] === 1 ? 'Hero ' + (i + 1) + ' is wounded: a light wound, and back to full health.' : 'Hero ' + (i + 1) + ' is wounded again: the wound turns severe, and back to full health.'); };
  const repartir = (n, de) => { const b = Math.floor(n / H); let resto = n - b * H; for (let i = 0; i < H; i++) { const x = b + (resto > 0 ? 1 : 0); if (resto > 0) resto--; if (x) ferirH(i, x, de); } };
  const somaH = () => vidaH.reduce((a, v) => a + Math.max(0, v), 0);
  R.danoPor = {}; const ferir = (n, de, quem) => { if (quem === 'cada' || de === 'fatigue') repartir(n, de); else ferirH(typeof quem === 'number' ? quem % H : maisVida(), n, de); if (de === 'texto') nota('A text deals ' + n + ' damage to the party.'); else if (de === 'fatigue') nota('The fatigue weighs as ' + n + ' damage at the end.'); R.danoPor[de] = (R.danoPor[de] || 0) + n; R.danoSofrido += n; vida = somaH(); if (vida < R.vidaMin) R.vidaMin = vida; };
  const curar = (n, onde, cada) => { const antes = somaH(); if (cada) { const por = Math.floor(n / H); vidaH.forEach((v, i) => { vidaH[i] = Math.min(maxH[i], v + por); }); } else { const i = maisFerido(); vidaH[i] = Math.min(maxH[i], vidaH[i] + n); }
    const util = somaH() - antes; vida = antes; nota(util ? 'The party heals ' + util + '.' : 'A heal of ' + n + ' with the party whole: nothing to heal.'); vida += util; R.curaUtil += util; R.curaPerdida += n - util; if (n - util > 0 && util === 0) R.curasCheio.push(onde); };
  // ---- requirements
  const vivosDaSala = si => vivos.filter(m => m.sala === si && m.hp > 0).length;
  const reqOk = rs => (rs || []).every(r => r.tipo === 'counter' ? (r.op === 'gt' ? (cont[r.contador] || 0) > (cont[r.outro] || 0) : (cont[r.contador] || 0) >= (r.meta || 1)) : r.tipo === 'room_open' ? abertas.has(r.sala) : r.tipo === 'enemies_defeated' ? abertas.has(r.sala) && !vivosDaSala(r.sala) : r.tipo === 'gold' ? ouro >= (r.amount || 0) : true);
  // ---- monsters
  const statsDe = (id, tier) => { const m = monstro(id); const ts = (m?.tiers || []); const t = ts.find(x => x.tier === tier) || ts.slice().sort((a, b) => Math.abs(a.tier - tier) - Math.abs(b.tier - tier))[0]; return t ? { hp: t.hp, def: t.def, atk: t.atk } : { hp: 20, def: 1, atk: 1 }; };
  const media = (ids, tier) => { const ss = ids.map(id => statsDe(id, tier)); if (!ss.length) return { hp: 20, def: 1, atk: 1 }; const k = x => Math.round(ss.reduce((a, s) => a + s[x], 0) / ss.length); return { hp: k('hp'), def: k('def'), atk: k('atk') }; };
  const entrar = (sala, st, grupo, dono) => { const m = { sala, ...st, grupo, dono, chegando: sala !== local, alvo: proxAlvo++ % H }; nota('A monster comes into room ' + (sala + 1) + (dono && dono.enemy ? ', “' + nomeIni(dono.enemy) + '”' : '') + ': health ' + st.hp + ', attack ' + st.atk + ', defence ' + st.def + '.'); log('monster in room ' + (sala + 1) + ' hp' + st.hp + ' atk' + st.atk + ' def' + st.def); vivos.push(m); R.monstros++; R.monstrosPorSala[sala] = (R.monstrosPorSala[sala] || 0) + 1; if (grupo) { grupos[grupo] = grupos[grupo] || { sala, lista: [], dono }; grupos[grupo].lista.push(m); } return m; };
  const poolDaSala = si => poolDe(pm, si).filter(id => monstro(id));
  const porPool = (si, vagas, intensidade, grupo, dono, minimo) => { if (!vagas) return; const x = simularVagas(vagas, intensidade, poolDaSala(si), H, pm, [], minimo || 0); for (let k = 0; k < x.n; k++) entrar(si, media(poolDaSala(si), x.tier), grupo, dono); };
  // (how deep a room is: the rooms opened one from the other, from the start; a detour is as deep as the room beside it on the way)
  const _fundura = new Map(); const fundura = si => { if (_fundura.has(si)) return _fundura.get(si); _fundura.set(si, 0); const ab = si > 0 ? abridorDe(pm, si) : null; const f = ab && ab.ri !== si ? fundura(ab.ri) + 1 : 0; _fundura.set(si, f); return f; };
  const mare = (pm.eventos || []).some(ev => Object.keys(ev).some(k => Array.isArray(ev[k]) && ev[k].some(x => x && x.tipo === 'remove_room')));
  const abrirSala = si => { if (abertas.has(si) || removidas.has(si)) return; abertas.add(si); log('room ' + (si + 1) + ' opens'); nota('Room ' + (si + 1) + ' opens.');
    const s = pm.salas[si]; (s.inimigos || []).filter(e => !ehPool(e.enemy)).forEach(e => { const m = entrar(si, statsDe(e.enemy, (e.tierPorHerois ? e.tierPorHerois[Math.min(3, H - 1)] : e.tier) || 1), null, e); if (e.bonusAtaque) m.atk += e.bonusAtaque; if (e.bonusDefesa) m.def += e.bonusDefesa; });
    porPool(si, vagasPoolDaSala(s), intensidadeDaSala(s), 'G' + si, s.grupoPool || null); };
  // ---- the lists of an owner
  const executar = (dono, lista, si, ctx = {}) => { for (const g of (dono && dono[lista]) || []) { if (venceu || perdeu) return; passo(dono, g, si, ctx); } };
  const primeiras = new Set();   // (v348: a trigger marked "first time" (g.primeiraVez, a key shared by several objects) runs once, as in the export: a clue read again adds nothing)
  const passo = (o, g, si, ctx) => {
    if (g.primeiraVez) { if (primeiras.has(g.primeiraVez)) return; if (reqOk(g.requisitos)) primeiras.add(g.primeiraVez); }
    if (!reqOk(g.requisitos)) { if (o['senao:' + g.uid]) executar(o, 'senao:' + g.uid, si, ctx); ctx.falhouReq = true; return; }
    switch (g.tipo) {
      case 'text': efeitosDoTexto(g.text, 'room ' + (si + 1)); break;
      case 'counter': { const a = g.acao || 'add'; if (a === 'use') { vigias.push({ o, g, si, feito: false }); break; }
        cont[g.contador] = a === 'set' ? (g.n ?? 0) : a === 'sub' ? (cont[g.contador] || 0) - (g.n ?? 1) : (cont[g.contador] || 0) + (g.n ?? 1); { const cc = (pm.contadores || []).find(x => x.nome === g.contador); const l = cc ? limiteDoContador(cc) : 0; if (l && cont[g.contador] > l) cont[g.contador] = l; } nota('The count “' + g.contador + '” goes to ' + cont[g.contador] + '.'); contadores(); break; }
      case 'open_room': abrirSala(g.sala); break;
      case 'spawn': if (g.fonte === 'pool') porPool(si, (g.cells || []).length, intensidadeDoGatilho(g), g.uid, o, g.minimo); else (g.inimigos || []).forEach(e => { const m = entrar(si, statsDe(e.enemy, (e.tierPorHerois ? e.tierPorHerois[Math.min(3, H - 1)] : e.tier) || 1), g.uid, o); m.dono = e; if (e.bonusAtaque) m.atk += e.bonusAtaque; }); break;
      case 'rounds': timers.push({ o, g, si, desde: rodada, feitas: 0 }); break;
      case 'skill_test': { const S = g.successes || 2; let ok;
        if (g.cumulativo) { acumulado[g.uid] = (acumulado[g.uid] || 0) + cfg.sucessos; ok = acumulado[g.uid] >= S; } else ok = cfg.sucessos >= S;
        if (!ok && !g.cumulativo) { ctx.impossivel = true; if (!R.testesImpossiveis.includes(g.uid)) R.testesImpossiveis.push(g.uid); }
        nota(g.cumulativo ? 'Test of ' + S + ' success(es), adding up: ' + acumulado[g.uid] + ' so far' + (ok ? ', passed.' : '.') : 'Test of ' + S + ' success(es): ' + (ok ? 'passed.' : 'failed (the party rolls ' + cfg.sucessos + ').'));
        ctx.teste = ok ? 'ok' : 'fail'; executar(o, (ok ? 'ok:' : 'fail:') + g.uid, si, ctx); if (ok && g.cumulativo) ctx.gasta = true; break; }
      case 'choice': { const i = escolher(o, g, si); ctx.opcao = i; if (i === -2) { ctx.nada = true; nota('No answer is worth it now.'); break; } if (i < 0) break; nota('Answer chosen: “' + (((g.options[i] || {}).text || '?').trim().replace(/[.!…]+$/, '') || '?') + '”.'); if (g.umaVez) { const u = opcoesUsadas.get(g.uid) || new Set(); u.add(i); opcoesUsadas.set(g.uid, u); }
        executar(o, 'op' + i + ':' + g.uid, si, ctx); break; }
      case 'remove_object': { const k = g.proprio ? ctx.chave : g.objSala + ':' + g.objIndex; if (k) tirados.add(k); break; }
      case 'add_object': escondidos.delete(g.objSala + ':' + g.objIndex); break;
      case 'give_item': if (g.acao === 'remove') { if (g.modo === 'gold') ouro -= g.amount || 0; break; }
        if (g.modo === 'gold') { ouro += g.amount || 0; R.ouro += g.amount || 0; nota('The party gets ' + (g.amount || 0) + ' gold.'); } else if (g.modo === 'newitem' && !(g.requisitos || []).some(r => r.tipo === 'gold')) nota('The party finds ' + (g.amount || 1) + ' item(s).'); else if (g.modo !== 'newitem') nota('The party gets loot worth ' + (g.points || 0) + ' point(s).');
        if (g.modo === 'gold') { } else if (g.modo === 'newitem') { if ((g.requisitos || []).some(r => r.tipo === 'gold')) R.comprados = (R.comprados || 0) + (g.amount || 1); else R.itens += g.amount || 1; } else R.pontosEspolio += g.points || 0; break;
      case 'move_heroes': local = g._sala ?? (salaDasCasas(g.cells) ?? local); nota('The heroes are moved to room ' + (local + 1) + '.'); break;
      case 'remove_room': if (!removidas.has(g.sala)) { log('room ' + (g.sala + 1) + ' leaves the table'); nota('Room ' + (g.sala + 1) + ' leaves the table.'); } removidas.add(g.sala); if (g.sala > 0) abertas.delete(g.sala); vivos.forEach(m => { if (m.sala === g.sala) m.hp = 0; }); break;
      case 'enemy_condition': { if (g.acao === 'mirar' || g.acao === 'desmirar') break; const doGrupo = m => g.alvo !== 'group' || ('room-' + (m.sala + 1)) === g.grupo || m.grupo === g.grupo; const alvo = vivos.filter(m => m.hp > 0);
        if (g.acao === 'heal') { alvo.filter(doGrupo).forEach(m => { m.hp += g.amount || 0; }); break; }
        // (a named group, the villain who hunts: only it, and nothing to say when it is not in play)
        if (g.alvo === 'group' && /^gp/.test(g.grupo || '')) { if (g.acao === 'damage') alvo.filter(doGrupo).forEach(m => { m.hp -= g.amount || 1; }); mortes(); break; }
        if (!alvo.length) R.efeitosVazios.push('room ' + (si + 1) + ': ' + (g.acao === 'damage' ? 'damage' : g.condition || g.acao));
        if (g.acao === 'damage') alvo.forEach(m => { m.hp -= g.amount || 1; }); mortes(); break; }
      case 'end_map': if (g.resultado === 'derrota') { perdeu = true; R.motivo = 'end_map (defeat)'; nota('A trigger ends the map in defeat.'); } else { venceu = true; nota('A trigger ends the map in victory.'); } break;
    }
  };
  const salaDasCasas = cells => { if (!(cells || []).length) return null; const [x, y] = cells[0]; for (let si = 0; si < pm.salas.length; si++) if (chaoDaSala(si, pm).has(x + ',' + y)) return si; return null; };
  // counters full: their own triggers (once) and the watches waiting on them
  const contadores = () => { (pm.contadores || []).forEach(c => { if (!contCheio.has(c.nome) && metaDoContador(c) && (cont[c.nome] || 0) >= metaDoContador(c)) { contCheio.add(c.nome); executar(c, 'gatilhos', 0, {}); } });
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
    // (v348: what moves the map on is worth it while it still does: a room not open yet, a count not full yet (a puzzle solved
    //  asks again and again; its answer is worth nothing more), a way to another room)
    const lista = i => { const l = o['op' + i + ':' + g.uid] || []; return l.concat(l.filter(x => x.tipo === 'skill_test').flatMap(x => o['ok:' + x.uid] || [])); };
    const avanca = i => lista(i).some(x => (x.tipo === 'open_room' && !abertas.has(x.sala) && !removidas.has(x.sala)) || (x.tipo === 'counter' && (x.acao || 'add') !== 'use' && !contCheio.has(x.contador)) || x.tipo === 'move_heroes' || x.tipo === 'add_object'
      // (v365: a count of rounds that brings the waves of a last defense, or counts or opens: it moves the map on too; before, the
      //  table answered "not yet" at the guide's place, and the escort never ended)
      || (x.tipo === 'rounds' && (o['rodada:' + x.uid] || []).some(y => ['spawn', 'counter', 'open_room', 'end_map'].includes(y.tipo) && !(y.tipo === 'end_map' && y.resultado === 'derrota'))));
    const valor = i => { const t = texto(i); let v = 0; if (avanca(i)) v += 10; if (/newitem/.test(t)) v += 4; if (/"random"/.test(t)) v += 2; if (/"gold"/.test(t) && !/"remove"/.test(t)) v += 1;
      if (/(cura|heals?)\s+\d/i.test(t)) v += vida < vidaTot - 2 ? 5 : -2; if (/enemy_condition/.test(t) && !/"acao":"(heal|mirar|desmirar)"/.test(t)) v += vivos.some(m => m.hp > 0) ? 3 : -6;
      // (a status question, "the guide fell": never the bad news by choice)
      if (/"acao":"set","n":0/.test(t)) v -= 20; if (/"remove".*"gold"|"acao":"remove"/.test(t)) v -= 1; if (/(Ainda não|Not yet|Nada, obrigado|Nothing, thanks|Seguir sem|Go on without|Deixar|Leave it)/i.test(g.options[i].text || '')) v -= 5; return v; };
    const melhor = livres.slice().sort((a, b) => valor(b) - valor(a))[0];
    return g.umaVez && valor(melhor) < 0 ? -2 : melhor;
  };
  // ---- what the party can do next: the objects of the open rooms not spent, with what using them brings
  const candidatos = () => { const out = [];
    pm.salas.forEach((s, si) => { if (!abertas.has(si) || removidas.has(si)) return;
      s.objetos.forEach((o, oi) => { const k = si + ':' + oi; if (gastos.has(k) || tirados.has(k) || escondidos.has(k) || inuteis.has(k) || (!(o.gatilhos || []).length && !ehObjetoFinal(si, oi))) return;   // (v348: the object that ends the map counts with no trigger of its own: the way out)
        if (o.gemeo != null && !gastos.has(si + ':' + o.gemeo)) { /* the twin stands for the same thing */ }
        const gs = todosGatilhos(o); const t = JSON.stringify(gs);
        // (v365: a way still locked by its own count (the passage that waits for the riddle) opens nothing yet: the table read
        //  the words on it once and goes for what it asks)
        const fecha = gs.filter(g => g.tipo === 'open_room').some(g => !abertas.has(g.sala) && !removidas.has(g.sala) && (reqOk(g.requisitos) || !(g.requisitos || []).some(q => q.tipo === 'counter')));
        const progride = fecha || gs.some(g => g.tipo === 'counter' && (g.acao || 'add') === 'add' && !contCheio.has(g.contador)) || ehObjetoFinal(si, oi)
          || gs.some(g => g.tipo === 'add_object' && escondidos.has(g.objSala + ':' + g.objIndex))
          // (v365: what lets out a beast that counts when it falls (the cages of the pack): the count is in the beast)
          || gs.some(g => g.tipo === 'spawn' && (g.inimigos || []).some(e => (e.gatilhos || []).some(x => x.tipo === 'counter' && (x.acao || 'add') === 'add' && !contCheio.has(x.contador))));   // (v348: what brings a hidden object to the board (the lever of the loft: the ladder and the point up there) moves the map on)
        const bloqueado = (o.gatilhos || []).length && (o.gatilhos || []).every(g => !reqOk(g.requisitos)) && !(o.gatilhos || []).some(g => o['senao:' + g.uid] && /open_room|"counter"/.test(JSON.stringify(o['senao:' + g.uid])));
        // (a search whose every answer left is of no use now: later)
        // (v365: a stone or runes that only carry the party elsewhere is no step by itself: the walk is counted by distance; the
        //  table went back and forth through them and lost the rounds of a clock)
        if (!progride && /move_heroes/.test(t) && !/give_item|newitem|cura|heals|"spawn"|"counter"/.test(t)) return;
        const busca = (o.gatilhos || []).find(g => g.tipo === 'choice' && g.umaVez); if (busca && !progride && escolher(o, busca, si) === -2) return;
        // (a heal and nothing else, with the party whole: later, when it is of use)
        if (!progride && !busca && /(cura|heals?)\s+\d/i.test(t) && !/give_item/.test(t) && vida >= vidaTot) return;
        out.push({ si, oi, o, k, progride, bloqueado, fecha, util: /give_item|cura|heals|newitem/.test(t), t }); }); });
    return out; };
  const fm = pm.meta.finalMission || { tipo: 'defeat_all' };
  const ehObjetoFinal = (si, oi) => fm.tipo === 'use_object' && fm.sala === si && fm.objeto === oi;
  const venceuJa = () => { if (venceu) return true;
    if (fm.tipo === 'defeat_room') return abertas.has(fm.sala) && !vivosDaSala(fm.sala);
    if (fm.tipo === 'trigger') { const c = (pm.contadores || []).find(x => x.missao && x.missao.uid === fm.uid); return c ? (cont[c.nome] || 0) >= metaDoContador(c) : false; }
    if (fm.tipo === 'use_object') return !!R._finalOk;
    if (fm.tipo === 'defeat_all') return rodada > 1 && !vivos.some(m => m.hp > 0);
    return false; };
  // ---- the distance, in party moves, from where the party is to room si (through the rooms opened from each other)
  const distancia = si => { if (si === local) return 0; const viz = new Map(); pm.salas.forEach((x, j) => { const ab = abridorDe(pm, j); if (!ab) return; [[ab.ri, j], [j, ab.ri]].forEach(([a, b]) => { if (!viz.has(a)) viz.set(a, []); viz.get(a).push(b); }); });
    const d = new Map([[local, 0]]); const fila = [local]; while (fila.length) { const a = fila.shift(); for (const b of viz.get(a) || []) if (!d.has(b) && abertas.has(b) && !removidas.has(b)) { d.set(b, d.get(a) + 1); fila.push(b); } }
    return d.has(si) ? d.get(si) : 3; };
  // ---- one use of an object by a hero
  // (v365: a count the clock moves every round (the noise, a wave's rounds) is not something the party did: in the state it
  //  kept a locked door "worth trying" every round, and the party never went for what opens it)
  const doRelogio = new Set((pm.contadores || []).filter(c => c.ruido).map(c => c.nome));
  // (a count past its goal is the same as at its goal: an answer given again adds to it, and changes nothing)
  const metaDe = Object.fromEntries((pm.contadores || []).map(c => [c.nome, metaDoContador(c)]));
  const estado = () => abertas.size + '|' + JSON.stringify(Object.fromEntries(Object.entries(cont).filter(([k]) => !doRelogio.has(k)).map(([k, v]) => [k, Math.min(v, metaDe[k] ?? v)]))) + '|' + JSON.stringify(acumulado) + '|' + vivos.filter(m => m.hp > 0).length + '|' + tirados.size + '|' + escondidos.size + '|' + R.itens + '|' + ouro + '|' + timers.length;
  const inuteis = new Set(); let ultimoEstado = '';
  const usar = c => { const { si, oi, o, k } = c; const ctx = { chave: k }; const e0 = estado(); log('use ' + baseObj(o.type) + ' in room ' + (si + 1) + (o.name ? ' "' + o.name + '"' : '') + (c.progride ? ' [progress]' : '')); soltarGolpes(); nota('The party uses “' + nomeDe(o) + '” in room ' + (si + 1) + (c.progride ? ' (it moves the map on).' : '.'));
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
    const contAntes = { ...cont };   // (v365: what the clock alone changes, below)
    timers.forEach(t => { const n = t.g.n || 1; const passou = rodada - t.desde; if (t.g.modo === 'uma') { if (!t.feitas && passou >= n) { t.feitas = 1; nota('“' + nomeDe(t.o) + '”: its count of rounds is up, its triggers run.'); executar(t.o, 'rodada:' + t.g.uid, t.si, {}); } }
      else if (passou > 0 && passou % n === 0 && (!t.g.vezes || t.feitas < t.g.vezes)) { t.feitas++; nota('“' + nomeDe(t.o) + '”: its count of rounds is up, its triggers run.'); executar(t.o, 'rodada:' + t.g.uid, t.si, {}); } });
    (pm.eventos || []).forEach(ev => { const r0 = ev.rodada || 1; if (rodada < r0) return; if (rodada === r0 || (ev.cada && (rodada - r0) % ev.cada === 0)) executar(ev, 'gatilhos', ev.sala || 0, {}); });
    const pr = pm.meta.pressao; if (pr && pr.tipo === 'fadiga' && rodada >= pr.desde) fadiga += H * (pr.pior && rodada >= pr.pior ? 2 : 1);
    Object.keys(cont).forEach(k => { if (cont[k] !== contAntes[k]) doRelogio.add(k); });
    mortes(); contadores(); if (venceuJa()) { venceu = true; break; } if (perdeu) break;
    // the heroes' actions
    let acoes = H * cfg.acoes; let fez = false; let naFonte = false;
    while (acoes > 0 && !venceu && !perdeu) {
      // (v365: the room of the objective first, when it is to clear one (the lieutenant who flees): a table that took the weakest
      //  first fought the monsters that kept coming from the rooms beside and never reached it)
      const fmS = fm && fm.tipo === 'defeat_room' ? fm.sala : -1;
      const alvo = vivos.filter(m => m.hp > 0).sort((a, b) => (b.sala === fmS) - (a.sala === fmS) || a.hp - b.hp)[0];
      // (v348: with monsters in play, one hero a round still works on what keeps them coming, here in the room (the possessed one
      //  to free, the nest to seal): a table that only fights never gets to it, and the monsters never end)
      // (v360: the source may be in the open room next door, from where its monsters come to the party: the table walks there
      //  (the walk costs the round's moves) and works on it; standing where it was, it fought for ever)
      if (alvo && !naFonte) { const fs = candidatos().filter(c => !c.bloqueado && c.progride && /"acao":"set","n":0/.test(c.t) && /skill_test/.test(c.t)).sort((a, b) => distancia(a.si) - distancia(b.si)); const f = fs[0];
        if (f && f.si !== local) { const d = distancia(f.si); acoes -= Math.min(acoes, d * H); local = f.si; fez = true; soltarGolpes(); nota('The party walks to room ' + (local + 1) + '.'); if (acoes <= 0) continue; }
        if (f) { naFonte = true; acoes--; usar(f); fez = true; if (venceuJa()) venceu = true; continue; } }
      if (alvo) { const golpe = Math.max(1, (cfg.danoAtaque != null ? cfg.danoAtaque : Math.min(cfg.sucessos, cfg.sucessosAtaque || cfg.sucessos) * cfg.dano) - Math.floor((alvo.def || 0) * cfg.defesa)); alvo.hp -= golpe;   // (custom: the user's average damage per attack)
         golpes.n++; golpes.dano += golpe; acoes--; if (alvo.hp <= 0) { log('a monster falls'); golpes.caidos++; } fez = true; mortes(); contadores(); if (venceuJa()) venceu = true; continue; }
      { const e = estado(); if (e !== ultimoEstado) { inuteis.clear(); ultimoEstado = e; } }
      const cs = candidatos().filter(c => !c.bloqueado);
      const pressa = R.limite && rodada > R.limite * 0.6;
      // (what stops monsters from coming, a possessed one, a nest, and what is half done, first; then the nearest)
      // (v365: the source of the monsters goes first only while monsters are in play: a puzzle whose wrong answer resets its count
      //  looked like one, and the party kept answering it again instead of going through the way it had opened)
      const para = c => /"acao":"set","n":0/.test(c.t) && /skill_test/.test(c.t) && vivos.some(m => m.hp > 0) ? 0 : (c.o.gatilhos || []).some(g => g.tipo === 'skill_test' && acumulado[g.uid]) ? 0 : 1;
      // (v348: with the tide coming from the entrance, a table takes first what it needs from the rooms behind (the water takes a
      //  room with the seal left in it), oldest room first, and leaves the rest of a room for when nothing presses)
      const prog = cs.filter(c => c.progride).sort((a, b) => para(a) - para(b) || (mare ? fundura(a.si) - fundura(b.si) || (a.fecha ? 1 : 0) - (b.fecha ? 1 : 0) : 0) || distancia(a.si) - distancia(b.si));
      const opc = pressa ? [] : cs.filter(c => !c.progride && (c.util || /choice/.test(c.t))).sort((a, b) => distancia(a.si) - distancia(b.si));
      // first what is on the way (in this room), then the nearest thing that moves the map on
      const aqui = opc.filter(c => c.si === local); const c = (prog[0] && para(prog[0]) === 0 ? prog[0] : null) || (mare && prog[0] && (!prog[0].fecha || fundura(prog[0].si) < fundura(local)) ? prog[0] : null) || aqui[0] || prog[0] || opc[0];
      if (!c) break;
      const d = distancia(c.si) + (c.si === local ? 0 : 0);
      const custo = d * H + cfg.custoUso; if (custo > acoes && d > 0) { if (acoes >= H) { acoes -= H; local = c.si; fez = true; soltarGolpes(); nota('The party walks to room ' + (local + 1) + '.'); } else acoes = 0; continue; }
      acoes -= d * H + cfg.custoUso; local = c.si; usar(c); fez = true; if (venceuJa()) venceu = true;
    }
    soltarGolpes();
    if (venceu || perdeu) break;
    // the monsters: every monster in play hits once (one that came in away from the party arrives first)
    { let d = 0, chegam = 0; vivos.filter(m => m.hp > 0).forEach(m => { if (m.chegando) { m.chegando = false; chegam++; return; } d += (m.atk || 1) + cfg.golpe; ferir((m.atk || 1) + cfg.golpe, 'monsters', alvoDoGolpe(m)); R.danoPor['room ' + (m.sala + 1) + ' ' + (pm.salas[m.sala]?.funcao || '')] = (R.danoPor['room ' + (m.sala + 1) + ' ' + (pm.salas[m.sala]?.funcao || '')] || 0) + (m.atk || 1) + cfg.golpe; }); if (d) log('monsters hit for ' + d + ' (health ' + vida + ')'); if (d) nota('The monsters in play hit the party: ' + d + ' damage.'); if (chegam) nota(chegam + ' monster(s) reach the party: they hit from the next round.'); }
    fimDaRodada();
    if (perdeu) break;
    if (!fez && !vivos.some(m => m.hp > 0)) { semProgresso++; if (semProgresso >= 3) { R.travado = true; R.motivo = 'stuck: nothing left to do'; break; } } else semProgresso = 0;
    rodada++;
    if (R.limite && rodada > R.limite) { perdeu = true; R.motivo = 'round limit'; break; }
  }
  // fatigue weighs as damage at the end (the table converts it)
  soltarGolpes(); if (dia && !dia.fim) fimDaRodada();
  if (fadiga) ferir(Math.floor(fadiga * cfg.fadiga), 'fatigue');
  if (!venceu && !perdeu && rodada > cfg.maxRodadas) R.motivo = 'too many rounds';
  if (dia) dia.fim = { vida: Math.max(0, vida), max: vidaTot, fadiga, emJogo: vivos.filter(m => m.hp > 0).length };
  R.vidaHeroi = Math.round(vidaTot / H); R.vidaPorHeroi = maxH.slice(); R.perdaPorHeroi = danoH.slice(); R.vidaMinPorHeroi = minH.map(v => Math.max(0, v)); R.feridasPorHeroi = feridas.slice();
  R.venceu = venceu && !perdeu; R.perdeu = !R.venceu; R.rodadas = rodada; R.vidaFinal = Math.max(0, vida); R.fadiga = fadiga; R.contadores = { ...cont };   // (v348: where each count stood at the end, for whoever reads a simulation that got stuck)
  return R;
}
/* the static look at a map: effects against monsters in rooms where no monster ever is, heals in the first room */
function olharEstatico(pm) {
  const out = { efeitosSemMonstros: [], curasNoInicio: 0 }; const com = salasComMonstros(pm); const temMonstro = si => com.has(si);
  pm.salas.forEach((s, si) => s.objetos.forEach(o => { const gs = todosGatilhos(o);
    if (!temMonstro(si) && gs.some(g => g.tipo === 'enemy_condition' && !['heal', 'mirar', 'desmirar'].includes(g.acao) && !(g.alvo === 'group' && /^gp/.test(g.grupo || '')))) out.efeitosSemMonstros.push(si + 1);
    if (si === 0 && JSON.stringify(gs).match(/(cura|heals?) \d/i)) out.curasNoInicio++; }));
  return out;
}
/* the verdict for the easy level: can it be won, and is it a fair effort */
const META_FACIL = { perdaMin: 0.25, perdaMax: 0.8, vidaMinMin: 0.15, itensMax: 3, monstrosPorSalaPorHeroi: 0.75, monstrosSalaMais: 2 };
/* v365: the verdict of a Normal or Hard map, by its own measure: more of the health goes, the party may end low, more monsters */
const META_POR_DIF = { facil: META_FACIL, normal: { perdaMin: 0.35, perdaMax: 0.95, vidaMinMin: 0.05, itensMax: 99, monstrosPorSalaPorHeroi: 1, monstrosSalaMais: 3 },
  dificil: { perdaMin: 0.45, perdaMax: 1.1, vidaMinMin: 0, itensMax: 99, monstrosPorSalaPorHeroi: 1.25, monstrosSalaMais: 4 } };
function avaliarFacil(pm, R, H = SIM.herois) {
  const dif = (pm.meta && pm.meta.gerado && pm.meta.gerado.dificuldade) || 'facil'; const META_FACIL = META_POR_DIF[dif] || META_POR_DIF.facil;
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
  if (R.testesImpossiveis.length) p.push((dif === 'facil' ? 'tests the easy party cannot pass: ' : 'tests the party cannot pass: ') + R.testesImpossiveis.length);
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
/* v380: «+ details» of a line of the table: what happened, round by round, and how the map ended */
function resultadoDaSimulacao(R) {
  const n = R.rodadas; if (R.venceu) return 'The party wins the map in round ' + n + '.';
  const m = R.motivo || '';
  if (/^severe wound/.test(m)) return 'The heroes lose in round ' + n + ': a hero with a severe wound was wounded again.';
  if (/^party defeated \(monsters/.test(m)) return 'The party falls in round ' + n + ': the damage of the monsters.';
  if (/^party defeated \(texto/.test(m)) return 'The party falls in round ' + n + ': the damage of the texts.';
  if (/^party defeated \(fatigue/.test(m)) return 'The party falls in round ' + n + ': the fatigue.';
  if (m === 'round limit') return 'The map is lost in round ' + n + ': the round limit.';
  if (/^stuck/.test(m)) return 'The party is stuck in round ' + n + ': nothing left to do.';
  if (m === 'too many rounds') return 'The simulation stops at round ' + n + ': too many rounds.';
  if (/^end_map/.test(m)) return 'The map ends in defeat in round ' + n + ', by a trigger.';
  return 'The party falls in round ' + n + '.';
}
function diarioDaSimulacao(R) {
  const dias = (R.diario || []).map(d => `<div class="diaSim"><b>${esc(tr('Round ' + d.r))}</b><ul>${d.ev.map(t => `<li>${esc(tr(t))}</li>`).join('') || `<li class="ajuda">${esc(tr('Nothing new.'))}</li>`}</ul>`
    + (d.fim ? `<small>${esc(tr('End of the round: health ' + d.fim.vida + ' of ' + d.fim.max + ', fatigue ' + d.fim.fadiga + ', monsters in play ' + d.fim.emJogo + '.'))}</small>` : '') + '</div>').join('');
  return `<details class="simDiario"><summary>${esc(tr('+ details'))}</summary>${dias}<p class="fimSim"><b>${esc(tr(resultadoDaSimulacao(R)))}</b></p></details>`;
}
/* the table of the simulation of one map, for 2, 3 and 4 heroes (Map generator > Simulate) */
function tabelaDaSimulacao(pm, custom) {
  const lista = custom && custom.listaHerois && custom.listaHerois.length ? custom.listaHerois : [2, 3, 4];
  const linhas = lista.map(H => { const R = simularMapa(pm, { ...(custom || {}), herois: H }); const a = avaliarFacil(pm, R, H);
    return `<tr><td>${H}</td><td>${R.venceu ? '✓' : '✗'}</td><td>${R.rodadas}${R.limite ? ' / ' + R.limite : ''}</td><td title="${esc(tr('Health points of each hero (of ' + R.vidaHeroi + '). The whole party: ' + a.perda + '%'))}">${R.perdaPorHeroi.join('/')}</td><td title="${esc(tr('Health points of each hero (of ' + R.vidaHeroi + '). The whole party: ' + a.vidaMin + '%'))}">${R.vidaMinPorHeroi.join('/')}</td><td title="${esc(tr('Wounds of each hero: 0 none, 1 light, 2 severe.'))}">${(R.feridasPorHeroi || []).join('/')}</td><td>${R.monstros}</td><td>${R.itens}</td><td>${esc(a.problemas.map(x => tr(x.split(':')[0]) + (x.includes(':') ? ': ' + tr(x.slice(x.indexOf(':') + 1).trim()) : '')).join('; ') || tr('none'))}</td></tr><tr class="simDet"><td colspan="9">${diarioDaSimulacao(R)}</td></tr>`; });
  return `<table class="simBal"><thead><tr><th>${tr('Heroes')}</th><th>${tr('Won')}</th><th>${tr('Rounds')}</th><th>${tr('Health lost')}</th><th>${tr('Lowest health')}</th><th>${tr('Wounds')}</th><th>${tr('Monsters')}</th><th>${tr('Items')}</th><th>${tr('Findings')}</th></tr></thead><tbody>${linhas.join('')}</tbody></table>`;
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
    <p class="ajuda">${tr('How the simulation counts: an attack deals the average damage minus the monster’s share of defence, and at least 1. A test passes when the average successes reach what it asks. The findings (too easy, too hard) always use the measures of the easy level.')}</p></div>`;
}
function lerSimulacaoCustom(sel = '#gm_simCfg') {
  const c = {}; document.querySelectorAll(sel + ' [data-sim]').forEach(i => { const v = parseFloat(i.value); const campo = CAMPOS_SIM.find(x => x[0] === i.dataset.sim); c[i.dataset.sim] = isFinite(v) ? Math.min(campo[4], Math.max(campo[3], v)) : campo[2]; });
  c.listaHerois = [...document.querySelectorAll(sel + ' [data-simh]:checked')].map(i => +i.dataset.simh); if (!c.listaHerois.length) c.listaHerois = [2, 3, 4];
  try { localStorage.setItem('bigorna-sim-custom', JSON.stringify(c)); } catch { }
  return c;
}

/* the automatic balance of the map in hand (Map setup > Balancing): the simulator plays the map with 2, 3 and 4 heroes and
   looks for the step that brings each party into the window of the easy level (health lost between 25% and 80%, never
   below 15%), the middle (half the health) as close as it gets. What it may change: the intensity of the rooms with
   monsters and of the triggers that call monsters from the pool (all by the same step, within 1 to 10), and the tiers by the
   number of heroes of the monsters placed by hand (the game's rule, as ⚖ Balance on a monster). Nothing else: the
   progression, the pools, the monsters, the objects and the texts stay. Nothing changes until Apply */
const META_BAL = { perdaMin: 25, perdaMax: 80, vidaMin: 15, alvo: 50, passos: 6 };
/* the step d applied to p (changed in place): returns what changed, one line each */
function passoDeBalanceio(p, d) {
  const mud = []; const lim = x => Math.max(1, Math.min(10, x));
  const tiers = (e, intensidade, divisao, onde) => { const m = monstro(e.enemy); if (!m || ehPool(e.enemy)) return; const t = tiersPelaRegra(m, intensidade, divisao, p); if (!t) return;
    const antes = e.tierPorHerois ? [e.tierPorHerois[1], e.tierPorHerois[2], e.tierPorHerois[3]] : [e.tier || 1, e.tier || 1, e.tier || 1];
    if (antes[0] === t[1] && antes[1] === t[2] && antes[2] === t[3]) return;
    e.tierPorHerois = t; e.tier = t[1]; mud.push({ tipo: 'tier', onde, nome: nomeIni(e.enemy), de: antes, para: [t[1], t[2], t[3]] }); };
  p.salas.forEach((s, si) => {
    const fixos = (s.inimigos || []).filter(e => !ehPool(e.enemy)); const vagas = vagasPoolDaSala(s);
    if (vagas || fixos.length) { const base = vagas ? intensidadeDaSala(s) : intensidadeParaMonstros(s, s.inimigos); const nova = lim(base + d);
      if (nova !== base) { s.intensidade = nova; mud.push({ tipo: 'sala', onde: si, de: base, para: nova }); }
      fixos.forEach(e => tiers(e, intensidadeParaMonstros(s, s.inimigos), monstrosComuns(s.inimigos), si)); }
    s.objetos.forEach(o => todosGatilhos(o).forEach(g => { if (g.tipo !== 'spawn') return;
      if (g.fonte === 'pool') { const base = intensidadeDoGatilho(g), nova = lim(base + d); if (nova !== base) { g.intensidade = nova; mud.push({ tipo: 'gatilho', onde: si, nome: rotulo(o), de: base, para: nova }); } }
      else (g.inimigos || []).forEach(e => tiers(e, lim(intensidadeDoGatilho(g) + d), Math.max(1, (g.inimigos || []).length), si)); }));
  });
  return mud;
}
/* how far a map is from the window, for the parties asked (0: inside, at the middle) */
function notaDeBalanceio(pm, custom) {
  const lista = custom && custom.listaHerois && custom.listaHerois.length ? custom.listaHerois : [2, 3, 4]; let nota = 0; const por = [];
  lista.forEach(H => { const R = simularMapa(pm, { ...(custom || {}), herois: H }); const perda = R.danoSofrido / R.vidaMax * 100, vmin = Math.max(0, R.vidaMin / R.vidaMax * 100);
    let n = Math.abs(perda - META_BAL.alvo) * 0.1;
    if (!R.venceu) n += 1000; if (perda < META_BAL.perdaMin) n += META_BAL.perdaMin - perda; if (perda > META_BAL.perdaMax) n += perda - META_BAL.perdaMax; if (vmin < META_BAL.vidaMin) n += META_BAL.vidaMin - vmin;
    nota += n; por.push({ H, venceu: R.venceu, perda: Math.round(perda), vidaMin: Math.round(vmin) }); });
  return { nota, por };
}
/* the proposal: every step from -6 to +6 tried on a copy; the best one, or none when nothing does better than the map as it is */
function propostaDeBalanceio(pm, custom) {
  const atual = notaDeBalanceio(pm, custom); let melhor = { d: null, nota: atual.nota, por: atual.por, mud: [] };
  for (let d = -META_BAL.passos; d <= META_BAL.passos; d++) {
    const c = clone(pm); const mud = passoDeBalanceio(c, d); if (!mud.length) continue;
    const n = notaDeBalanceio(c, custom);
    if (n.nota < melhor.nota - 0.01 || (Math.abs(n.nota - melhor.nota) <= 0.01 && melhor.d !== null && Math.abs(d) < Math.abs(melhor.d))) melhor = { d, nota: n.nota, por: n.por, mud, copia: c };
  }
  return { atual, melhor };
}
/* one line per change, for the window */
function textoDaMudanca(x, p = projeto) {
  const sala = si => tr('room') + ' ' + (si + 1) + (p.salas[si]?.nome ? ' · ' + p.salas[si].nome : '');
  if (x.tipo === 'sala') return sala(x.onde) + ': ' + tr('intensity') + ' ' + x.de + ' → ' + x.para;
  if (x.tipo === 'gatilho') return sala(x.onde) + ', “' + tr(x.nome) + '”: ' + tr('intensity of the monsters it calls') + ' ' + x.de + ' → ' + x.para;
  return sala(x.onde) + ', ' + tr(x.nome) + ': ' + tr('tiers for 1–2, 3 and 4 heroes') + ' ' + x.de.join('/') + ' → ' + x.para.join('/');
}
