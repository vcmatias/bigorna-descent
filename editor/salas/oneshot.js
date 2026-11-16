/* v258: the map generator run by the mod ("One-shot map", in the game's menu). The game asks the Bigorna Editor app, with no
   window, to open this page with ?gerador=1 (a profile of its own: no Workshop of the user, no work kept, no tutorial, no
   files). The app waits for BigornaGerador.pronto() and calls BigornaGerador.rodar(pedido); the answer goes back to the app
   (chrome.webview), which writes it where the mod reads it.
   The map is the editor's own generator, with the options the game screen leaves automatic: premise, objective, extra rules
   and terrain drawn; the monsters and items are the game's (the starter selection of the boxes the player owns), so the
   map plays in the language of the game. The game chooses only the length, the difficulty and the boxes (from its collection).
   pedido: { duracao: 'curta'|'media'|'longa', dificuldade: 'facil'|'normal'|'dificil', atos: 1|2, semente?: text,
             atoGrupo?: 1|2 (v261: the act of the saved party, for the simulation's health),
             monstros?: [id] (v292: the original monsters, those of the boxes of the game's collection),
             herois?: 2|3|4 (v366: the number of heroes: its starting squares, the strength of the monsters for it, the
             simulation of that party alone) }
   answer: { semente (v266: the seed that is enough on its own, unless one in another shape was asked), duracao, dificuldade, atos, nome, dmap (the .dmap as text), simulacao: [{ herois, vida (per hero), venceu, rodadas, limite, perda, vidaMin, monstros,
             itens, achados }] } or { erro } */
const MODO_GERADOR = typeof location !== 'undefined' && /[?&]gerador=1(&|$)/.test(location.search || '');
const _mapasFeitos = new Map();   // (v352)
const BigornaGerador = {
  pronto() { return typeof CAT !== 'undefined' && !!CAT && Array.isArray(CAT.monstros) && CAT.monstros.length > 0 && typeof _oficinaPronta !== 'undefined' && _oficinaPronta; },
  async rodar(p) {
    try {
      p = p || {};
      let atos = +p.atos === 1 ? 1 : 2;
      let duracao = ['curta', 'media', 'longa'].includes(p.duracao) ? p.duracao : 'media';
      let dificuldade = ['facil', 'normal', 'dificil'].includes(p.dificuldade) ? p.dificuldade : 'normal';
      // (v266: the seed that is enough on its own brings the length, the difficulty and the boxes; a new map gets one)
      let semente = String(p.semente || '').trim(); const lida = lerSemente(semente);
      // (v346: Easy, Normal or Hard (p.dificuldade) and the adjustment, -2 to +2 (p.ajuste), out of the draws; v318's p.perigo, 1 to
      //  10, with no adjustment, keeps working as it was; the seed brings them too, and p.ajuste given wins over the seed's)
      let ajuste = p.ajuste != null ? ajusteDe(p.ajuste) : null;
      let perigo = Math.round(+p.perigo) >= 1 && Math.round(+p.perigo) <= 10 ? Math.round(+p.perigo) : null;
      if (lida) { ({ duracao, dificuldade, atos } = lida); if (lida.ajuste == null) { ajuste = null; perigo = lida.perigo; } else if (ajuste == null) ajuste = lida.ajuste; semente = lida.base; }   // (a seed of v318 keeps its own Danger: it is part of its draw)
      if (ajuste == null && perigo == null) ajuste = 0;
      const legado = ajuste == null;   // (v318: only the Danger)
      if (legado) dificuldade = difDoPerigo(perigo); else perigo = perigoDoAjuste(dificuldade, ajuste);
      const inteira = base => legado || !lerSemente(base) ? base : comAjuste(base, ajuste);
      // (v320: p.modo, the story by call or by surprise: the seed says which (modoDaSemente), so a new seed is drawn until it
      //  says the one asked; a seed given keeps its own)
      const modoPedido = !semente && ['chamado', 'surpresa'].includes(p.modo) ? p.modo : null;
      const novaSemente8 = per => { let s = ''; for (let t = 0; t < 60; t++) { s = legado ? sementeCompleta(duracao, difDoPerigo(per), atos, '', per) : sementeCompleta(duracao, dificuldade, atos, ''); if (!modoPedido || modoDaSemente(s) === modoPedido) break; } return s; };
      const originais = Array.isArray(p.monstros) && p.monstros.length ? new Set(p.monstros.map(String)) : null;
      const atoGrupo = +p.atoGrupo === 2 ? 2 : +p.atoGrupo === 1 ? 1 : 0;
      // (v366: the number of heroes, 2 to 4, told before the map; without it, the map is for any party)
      const nHerois = [2, 3, 4].includes(Math.round(+p.herois)) ? Math.round(+p.herois) : 0;
      const fazer = (sem, per, comSimulacao, soPremissa) => {
        recomecarTraducao();
        // the Workshop of the generation: only the game's own monsters and items of the boxes (a fresh one at each call)
        // (v292: only the original monsters, those of the boxes of the game, when the mod sends them)
        campanha = null; _oficina = oficinaVazia(); oficina(); selecaoInicial(atos, { monstros: true, itens: true }, originais);
        // (v292: oficina() brings back the Workshop of the map of the call before (the page answers many calls while it stays
        //  open): its monsters from outside the list leave, so a call with the list never draws one)
        if (originais) { const b = oficina(); b.monstros = b.monstros.filter(m => !m.base || originais.has(m.base)); }
        projeto = projetoNovo(); salaAtual = -1; ATOS.set(atos);
        // (v259: the names of the game's monsters, items and characters come in the game's language: inside a sentence they
        // are pieces of it, so the table has the sentence with {s0} in their place)
        if (OUTRA_LINGUA) { const b = oficina(); [...(b.monstros || []), ...(b.itens || []), ...(b.personagens || [])].forEach(x => { pecaNaLingua(x.nome); pecaNaLingua(x.plural); }); }
        { const l = lerSemente(sem); if (l) sem = l.base; } const dif = legado ? difDoPerigo(per) : dificuldade; const aj = legado ? null : ajuste;
        const o = { cronica: 'auto', modalidade: 'auto', premissa: 'random', truque: 'auto', duracao, dificuldade: dif, ...(legado ? { perigo: per } : { ajuste: aj }), tema: 'qualquer', atos, semente: sem, manterPool: false, manterItens: false, modo: 'auto' };
        // (v352: only the premise, from the plan alone: the notice board drops a repeated premise before the map is made)
        if (soPremissa) { try { return { premissa: planejarMapa(opcoesDoPerigo({ ...o, ...(legado ? {} : { ajuste: 0 }) })).premissa.id }; } catch (e) { return {}; } }
        // (v352: the map made stays kept while the page is open (the last 12): the notice picked, the same seed asked again and
        //  another adjustment of the same map come from it. It is kept at adjustment 0, and the adjustment moves its numbers
        //  only while the answer is written (desfazer puts them back))
        const chave = [sem, duracao, dif, legado ? 'p' + per : '', atos, originais ? [...originais].sort().join(',') : '', LINGUA_TEXTOS].join('|');
        let feito = _mapasFeitos.get(chave);
        if (feito) { _mapasFeitos.delete(chave); _mapasFeitos.set(chave, feito); recomecarTraducao(); feito.pecas.forEach(([k, v]) => _pecasDadas.set(k, v)); }
        else { feito = { r: gerarMapa(legado ? o : { ...o, ajuste: 0 }), pecas: [..._pecasDadas] };
          if (feito.r && !feito.r.erro && feito.r.projeto) { _mapasFeitos.set(chave, feito); while (_mapasFeitos.size > 12) _mapasFeitos.delete(_mapasFeitos.keys().next().value); } }
        const r = feito.r;
        if (!r || r.erro || !r.projeto) return { erro: (r && r.erro) || 'no map came out', semente: inteira(sem), duracao, dificuldade: dif, perigo: per, ajuste: aj, atos };
        const desfazer = []; if (!legado && aj) ajustarPerigo(r, opcoesDoPerigo(o), desfazer);
        if (nHerois) ajustarAoGrupo(r, nHerois, desfazer);   // (v366)
        try { return responder(r, sem, per, dif, aj, comSimulacao); } finally { desfazer.reverse().forEach(f => f()); }
      };
      const responder = (r, sem, per, dif, aj, comSimulacao) => {
        projeto = normalizar(clone(r.projeto)); salaAtual = 0; limparAbridores(); projeto.meta.lingua = LINGUA_TEXTOS;
        const aviso = { semente: inteira(sem), perigo: per, dificuldade: dif, ajuste: aj, nome: projeto.meta.name || '', premissa: r.plano.premissa.id, texto: projeto.meta.aviso || String(projeto.meta.intro || '').split('\n\n')[0], objetivo: (projeto.meta.finalMission && projeto.meta.finalMission.texto) || '' };
        if (!comSimulacao) return { aviso };
        const dmap = montarDmap(projeto);
        // (v261: the act of the party: the saved party's (p.atoGrupo, from the mod), else the act the map asks for)
        const simulacao = (nHerois ? [nHerois] : [2, 3, 4]).map(H => { const R = simularMapa(r.projeto, { herois: H, ...(atoGrupo ? { ato: atoGrupo } : {}) }); const a = avaliarFacil(r.projeto, R, H);
          return { herois: H, vida: Math.round(R.vidaMax / H), venceu: !!R.venceu, rodadas: R.rodadas || 0, limite: R.limite || 0, perda: a.perda, vidaMin: a.vidaMin, monstros: R.monstros || 0, itens: R.itens || 0,
            achados: (a.problemas || []).map(x => OUTRA_LINGUA ? TRADZ(String(x).split(':')[0]) : tr(String(x).split(':')[0])) }; });
        return { aviso, semente: inteira(sem), duracao, dificuldade: dif, perigo: per, ajuste: aj, atos, nome: projeto.meta.name || '', dmap: JSON.stringify(comFicha(dmap)), simulacao };   // (v264: with the card at the head, as exported)
      };
      // (v320: the notice board: p.chamados (2 to 4) calls around the Danger asked (one calmer, the others at it, one riskier), of
      //  different premises; the answer is the first one, whole, and the notices of all of them (seed, Danger, title, the call,
      //  the objective): the mod shows the board, and the one picked is asked again by its seed)
      const n = modoPedido === 'chamado' ? Math.max(0, Math.min(4, Math.round(+p.chamados) || 0)) : 0;
      if (n >= 2) {
        const perigos = Array.from({ length: n }, () => perigo);   // (v323: every notice at the Danger asked: the table chose it)
        const avisos = []; const vistas = new Set();
        for (const per of perigos) { let a = null; for (let t = 0; t < 4; t++) { let s8 = novaSemente8(per); /* (v352: a seed of a premise already on the board is passed over before its map is made) */ for (let u = 0; u < 12 && t < 3 && vistas.has(fazer(s8, per, false, true).premissa); u++) s8 = novaSemente8(per); const x = fazer(s8, per, false); if (x.aviso && (!vistas.has(x.aviso.premissa) || t === 3)) { a = x.aviso; break; } } if (a) { vistas.add(a.premissa); avisos.push(a); } }
        if (!avisos.length) return { erro: 'no map came out', duracao, dificuldade, perigo, ajuste, atos };
        const primeiro = fazer(avisos[0].semente, avisos[0].perigo, true); if (primeiro.erro) return primeiro;
        delete primeiro.aviso; return { ...primeiro, avisos };
      }
      if (!semente) semente = novaSemente8(perigo);
      const resp = fazer(semente, perigo, true); delete resp.aviso; return resp;
    } catch (e) { console.error(e); return { erro: String(e && e.message || e) }; }
  }
};
if (typeof window !== 'undefined') window.BigornaGerador = BigornaGerador;
