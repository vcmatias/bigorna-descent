/* v258: the map generator run by the mod ("One-shot map", in the game's menu). The game asks the Bigorna Editor app, with no
   window, to open this page with ?gerador=1 (a profile of its own: no Workshop of the user, no work kept, no tutorial, no
   files). The app waits for BigornaGerador.pronto() and calls BigornaGerador.rodar(pedido); the answer goes back to the app
   (chrome.webview), which writes it where the mod reads it.
   The map is the editor's own generator, with the options the game screen leaves automatic: premise, objective, extra rules
   and terrain drawn; the monsters and items are the game's (the starter selection of the boxes the player owns), so the
   map plays in the language of the game. The game chooses only the length, the difficulty and the boxes (from its collection).
   pedido: { duracao: 'curta'|'media'|'longa', dificuldade: 'facil'|'normal'|'dificil', atos: 1|2, semente?: text,
             atoGrupo?: 1|2 (v261: the act of the saved party, for the simulation's health) }
   answer: { semente (v266: the seed that is enough on its own, unless one in another shape was asked), duracao, dificuldade, atos, nome, dmap (the .dmap as text), simulacao: [{ herois, vida (per hero), venceu, rodadas, limite, perda, vidaMin, monstros,
             itens, achados }] } or { erro } */
const MODO_GERADOR = typeof location !== 'undefined' && /[?&]gerador=1(&|$)/.test(location.search || '');
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
      if (lida) ({ semente, duracao, dificuldade, atos } = lida);
      if (!semente) semente = sementeCompleta(duracao, dificuldade, atos);
      recomecarTraducao();
      // the Workshop of the generation: only the game's own monsters and items of the boxes (a fresh one at each call)
      campanha = null; _oficina = oficinaVazia(); oficina(); selecaoInicial(atos, { monstros: true, itens: true });
      projeto = projetoNovo(); salaAtual = -1; ATOS.set(atos);
      // (v259: the names of the game's monsters, items and characters come in the game's language: inside a sentence they
      // are pieces of it, so the table has the sentence with {s0} in their place)
      if (OUTRA_LINGUA) { const b = oficina(); [...(b.monstros || []), ...(b.itens || []), ...(b.personagens || [])].forEach(x => { pecaNaLingua(x.nome); pecaNaLingua(x.plural); }); }
      const o = { cronica: 'auto', modalidade: 'auto', premissa: 'random', truque: 'auto', duracao, dificuldade, tema: 'qualquer', atos, semente, manterPool: false, manterItens: false };
      const r = gerarMapa(o);
      if (!r || r.erro || !r.projeto) return { erro: (r && r.erro) || 'no map came out', semente, duracao, dificuldade, atos };
      projeto = normalizar(clone(r.projeto)); salaAtual = 0; limparAbridores(); projeto.meta.lingua = LINGUA_TEXTOS;
      const dmap = montarDmap(projeto);
      // (v261: the act of the party: the saved party's (p.atoGrupo, from the mod), else the act the map asks for)
      const atoGrupo = +p.atoGrupo === 2 ? 2 : +p.atoGrupo === 1 ? 1 : 0;
      const simulacao = [2, 3, 4].map(H => { const R = simularMapa(r.projeto, { herois: H, ...(atoGrupo ? { ato: atoGrupo } : {}) }); const a = avaliarFacil(r.projeto, R, H);
        return { herois: H, vida: Math.round(R.vidaMax / H), venceu: !!R.venceu, rodadas: R.rodadas || 0, limite: R.limite || 0, perda: a.perda, vidaMin: a.vidaMin, monstros: R.monstros || 0, itens: R.itens || 0,
          achados: (a.problemas || []).map(x => OUTRA_LINGUA ? TRADZ(String(x).split(':')[0]) : tr(String(x).split(':')[0])) }; });
      return { semente, duracao, dificuldade, atos, nome: projeto.meta.name || '', dmap: JSON.stringify(comFicha(dmap)), simulacao };   // (v264: with the card at the head, as exported)
    } catch (e) { console.error(e); return { erro: String(e && e.message || e) }; }
  }
};
if (typeof window !== 'undefined') window.BigornaGerador = BigornaGerador;
