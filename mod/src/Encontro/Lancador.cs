using System;
using System.IO;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using Bigorna.Motor;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>Abre um .dmap: carrega uma missao oficial como cena base e monta o mapa por cima.</summary>
    public static class Lancador
    {
        static readonly string[] CenasBase = { "OBSTACLE_COURSE", "DEVELOPER_ENEMY_TOOL", "SIDE_QUEST_1", "SIDE_QUEST_2" };
        public static Dmap Atual { get; private set; }
        public static bool Preparando { get; private set; }
        /// <summary>Mapa aberto como missao avulsa (fora de campanha): ao terminar, volta ao menu em vez do mapa-mundi.</summary>
        public static bool Avulso { get; private set; }
        /// <summary>Resultado do ultimo encontro (vitoria/derrota), posto pelo roteiro; null se o jogo fechou por conta propria.</summary>
        public static bool? Resultado;
        /// <summary>Campanha: um dialogo de chegada a tocar depois de montar o tabuleiro e antes de escolher os herois.</summary>
        public static Action<Action> Prologo;

        /// <summary>v265: o mapa oneshot em jogo (a semente, a duracao, a dificuldade, a equipe): as gravacoes do jogo no meio
        /// dele vao para as partidas em andamento (Retomada). null: outro mapa.</summary>
        public class InfoOneshot { public string Semente; public int Duracao = -1, Dificuldade = -1; public string Equipe; }
        public static InfoOneshot Oneshot { get; private set; }
        /// <summary>A partida em andamento deste mapa oneshot (o id da ranhura da partida, SaveSlotGUID).</summary>
        public static string AndamentoId { get; private set; }
        /// <summary>O nome do grupo nas gravacoes do mapa oneshot: a marca delas (os mapas avulsos gravam como "Bigorna").</summary>
        public const string NomeDoOneshot = "Bigorna Oneshot";

        /// <summary>Abre um mapa avulso: com grupo novo, ou com o grupo de uma partida gravada (Continuar herois).</summary>
        public static string Lancar(Dmap m, GrupoDoSave.Save grupo = null, InfoOneshot oneshot = null)
        {
            // (v263: a lista guarda os mapas lidos; a partida joga uma cópia lida agora, que a partida pode mudar à vontade)
            if (m != null && !string.IsNullOrEmpty(m.Caminho) && File.Exists(m.Caminho)) try { m = Dmap.Carregar(m.Caminho); } catch (Exception ex) { Log.Info("relendo o mapa para jogar: " + ex.Message); }
            if (m.PacotesFaltando != null && m.PacotesFaltando.Count > 0) return Acervo.Acervo.TextoFaltam(m.PacotesFaltando);
            var cena = CenaBase(m);
            if (cena == null) return Idioma.T("Nenhuma missão oficial disponível para servir de cena base.", "No official quest is available to serve as the base scene.");
            SerializedGame partida;
            try
            {
                partida = new SerializedGame(cena.Act.AsCampaignId());
                partida.Initialize();
                partida.UnavailableHeroes.Clear();
                var herois = UserCollectionManager.GetHeroes(true).Select(h => partida.GetPlayer(h, false)).Where(p => p != null).Take(4).ToList();
                if (herois.Count < 2) return Idioma.T("Faltam heróis na coleção (", "Not enough heroes in the collection (") + herois.Count + ").";
                foreach (var h in herois) partida.ActivePlayers.Add(h);
                partida.QuestId = cena.Id;
                partida.EncounterIndex = 0;
                partida.PartyName = oneshot != null ? NomeDoOneshot : "Bigorna";
                partida.GameDifficulty = Dificuldade(m);
                if (grupo != null) { var e = GrupoDoSave.Trazer(partida, grupo); if (e != null) return e; } else GrupoDoSave.SemOrigem();
                var salvar = SingletonBehaviour<SaveLoadController>.Instance;
                Jogo.DadosJogo.CurrentSaveIndex = 0;
                if (salvar.GetExistingIndexes().Contains(0)) salvar.DeleteSaveSlot(0);
            }
            catch (Exception ex) { Log.Erro("preparando a partida", ex); return Idioma.T("Não consegui preparar a partida: ", "Could not prepare the game: ") + ex.Message; }
            Atual = m; Menu.Relatos.UltimoMapa = m?.Caminho ?? Menu.Relatos.UltimoMapa;
            Avulso = true;
            Resultado = null;
            Oneshot = oneshot; AndamentoId = oneshot != null ? partida.SaveSlotGUID : null;
            if (oneshot != null) try { Menu.Oneshot.Garantir(); MapasJogados.Jogado(oneshot.Semente, m.NomeVisivel); } catch (Exception ex) { Log.Info("mapas jogados: " + ex.Message); }   // (v266: um mapa jogado; antes de a última cópia sair, a pergunta se ele vira mapa novo)
            Log.Info("abrindo «" + m.NomeVisivel + "» sobre a cena de " + cena.Id + ", dificuldade " + partida.GameDifficulty + (oneshot != null ? " (mapa oneshot: as gravações no meio dele ficam guardadas, partida " + AndamentoId + ")" : ""));
            try { Jogo.Carregador.LoadLevel(cena, partida, true); }
            catch (Exception ex) { Log.Erro("carregando a cena", ex); Atual = null; return Idioma.T("O jogo não carregou a cena: ", "The game did not load the scene: ") + ex.Message; }
            Nucleo.Instancia.StartCoroutine(Preparar(m));
            return null;
        }

        /// <summary>Campanha: o jogo ja carregou a cena base (viagem no mapa-mundi); so montamos o mapa por cima.</summary>
        public static void PrepararSobreCena(Dmap m)
        {
            Atual = m; Menu.Relatos.UltimoMapa = m?.Caminho ?? Menu.Relatos.UltimoMapa;
            Avulso = false;
            Resultado = null;
            Nucleo.Instancia.StartCoroutine(Preparar(m));
        }

        /// <summary>Cada preparo tem o seu numero: um preparo antigo que ainda esperava (tela de herois, prologo...) para
        /// quando outro comeca ou o encontro e encerrado, em vez de montar o mapa velho por cima do novo.</summary>
        static int _geracao;
        public static int Geracao => _geracao;

        static IEnumerator Preparar(Dmap m)
        {
            int minha = ++_geracao;
            Preparando = true;
            try
            {
                Roteiro.Parar();
                Silencio.Reiniciar();
                Dialogos.Limpar();
                Passo("textos das missões (leitura)", TextosDeMissao.Comecar);
                Passo("conteúdo próprio", () => Personalizados.Registrar(m.Custom, "«" + m.NomeVisivel + "»"));
                Objetos.Limpar();
                Inimigos.Reiniciar();
                yield return Seguro("tabuleiro", Tabuleiro.Montar(m));
                if (minha != _geracao) yield break;
                if (!Tabuleiro.Montado)
                {
                    Log.Info("AVISO: o tabuleiro não foi montado; nada mais é posto por cima");
                    Dialogos.Mensagem(Idioma.T("O tabuleiro do mapa não foi montado. Volte ao menu e abra o mapa outra vez.", "The map's board was not set up. Go back to the menu and open the map again."), null, "Bigorna");
                    yield break;
                }
                Silencio.Vigiando = true;
                if (Prologo != null)
                {
                    var prologo = Prologo; Prologo = null; bool fim = false;
                    try { prologo(() => fim = true); } catch (Exception ex) { Log.Erro("prólogo", ex); fim = true; }
                    float limite = Time.unscaledTime + 600f;
                    while (!fim && Time.unscaledTime < limite && minha == _geracao) yield return null;
                    if (minha != _geracao) yield break;
                }
                if (Avulso) yield return Seguro("grupo", Herois.Escolher(m));
                else Passo("grupo", () => Herois.Manter(m));
                if (minha != _geracao) yield break;
                Passo("soltar as peças", Tabuleiro.Soltar);
                yield return Seguro("objetos", Objetos.Colocar(m));
                if (minha != _geracao) yield break;
                Passo("saída dos heróis", () => Herois.AvisarSaida(m));
                Passo("calar a base", () => Silencio.Calar());
                Passo("apartar inimigos da base", () => Silencio.ApartarInimigosDaBase(new HashSet<string>(Inimigos.ModeloDe.Keys)));
                Passo("fase do herói", Silencio.FaseDoHeroi);
                yield return Seguro("textos das missões", TextosDeMissao.Esperar(30f));
                Passo("textos das missões", TextosDeMissao.ReporTodos);
                yield return Seguro("inimigos", Inimigos.Povoar(m));
                if (minha != _geracao) yield break;
                Passo("bloqueios", () => Bloquear(m));
                Passo("roteiro", () => Roteiro.Comecar(m));
                Passo("música", () => { if (MusicaPropria.Tocar(m)) return; var ev = m.Metadados?.Musica?.Evento; if (!string.IsNullOrEmpty(ev)) Sons.Tocar(ev); });
                Passo("fase do herói", Silencio.FaseDoHeroi);
            }
            finally { if (minha == _geracao) Preparando = false; }
        }

        // ------------------------------------------------------------ v265: retomar uma partida de mapa oneshot
        /// <summary>Continua uma partida de mapa oneshot do ponto da ultima gravacao: o conteudo proprio do mapa entra antes de o
        /// jogo ler a gravacao (os monstros, itens e armas da Oficina precisam existir para ela); a gravacao volta para a ranhura
        /// de rascunho, sem as entidades que o mod tinha posto (ele as poe de novo), e o jogo a carrega como carrega qualquer
        /// partida. Quando o encontro esta de pe, o mod monta o mapa por cima e o deixa como estava (PrepararRetomada).
        /// Devolve um erro, ou null.</summary>
        public static string Retomar(Andamento a)
        {
            if (a == null) return Idioma.T("A partida guardada não está mais lá.", "The saved game is no longer there.");
            var salvar = SingletonBehaviour<SaveLoadController>.IsInitialized ? SingletonBehaviour<SaveLoadController>.Instance : null;
            if (salvar == null) return Idioma.T("O jogo ainda não está pronto para carregar.", "The game is not ready to load yet.");
            Dmap m; EstadoDoMapa e;
            try { m = Dmap.Carregar(a.CaminhoMapa); e = a.LerEstado() ?? new EstadoDoMapa(); }
            catch (Exception ex) { Log.Erro("retomando o mapa oneshot: lendo a partida guardada", ex); return Idioma.T("Não consegui ler a partida guardada: ", "Could not read the saved game: ") + ex.Message; }
            if (m.PacotesFaltando != null && m.PacotesFaltando.Count > 0) return Acervo.Acervo.TextoFaltam(m.PacotesFaltando);
            SerializedSaveData sg;
            try
            {
                Personalizados.Registrar(m.Custom, "«" + m.NomeVisivel + "»");
                if (salvar.GetExistingIndexes().Contains(0)) salvar.DeleteSaveSlot(0);
                var pasta = SaveLoadController.GetSaveDirectory(0); Directory.CreateDirectory(pasta);
                File.Copy(a.CaminhoSav, Path.Combine(pasta, Path.GetFileName(a.CaminhoSav)), true);
                if (a.CaminhoQlog != null && File.Exists(a.CaminhoQlog)) File.Copy(a.CaminhoQlog, Path.Combine(pasta, Path.GetFileName(a.CaminhoQlog)), true);
                sg = salvar.GetMostRecentSaveData(0);
                if (sg?.GameSceneData?.GameState == null) throw new Exception(Idioma.T("a gravação está vazia", "the save is empty"));
                var nossos = new HashSet<string>(e.Nossos ?? new List<string>());
                int tiradas = sg.GameSceneData.SceneEntities?.RemoveAll(x => x != null && nossos.Contains(x.GUID)) ?? 0;
                Log.Info("retomando «" + m.NomeVisivel + "» (partida " + a.Id + ", rodada " + sg.RoundNumber + "): " + tiradas + " entidade(s) do mod tiradas da gravação; " + (sg.GameSceneData.GameState.Enemies?.Count ?? 0) + " inimigo(s), "
                    + (sg.GameSceneData.GameState.ActivePlayers?.Count ?? 0) + " herói(s)");
            }
            catch (Exception ex) { Log.Erro("retomando o mapa oneshot: a gravação", ex); return Idioma.T("Não consegui preparar a gravação: ", "Could not prepare the save: ") + ex.Message; }
            Atual = m; Menu.Relatos.UltimoMapa = m.Caminho ?? Menu.Relatos.UltimoMapa;
            Avulso = true;
            Resultado = null;
            var f = a.Dados ?? new Andamento.Ficha();
            Oneshot = new InfoOneshot { Semente = f.Semente, Duracao = f.Duracao, Dificuldade = f.Dificuldade, Equipe = f.Equipe };
            AndamentoId = !string.IsNullOrEmpty(sg.SlotGUID) ? sg.SlotGUID : a.Id;
            GrupoDoSave.ImportarOrigem(e.Origem);
            try { salvar.LoadGame(sg, 0); }
            catch (Exception ex) { Log.Erro("retomando o mapa oneshot: carregando", ex); Atual = null; Avulso = false; Oneshot = null; AndamentoId = null; return Idioma.T("O jogo não carregou a partida: ", "The game did not load the saved game: ") + ex.Message; }
            Nucleo.Instancia.StartCoroutine(PrepararRetomada(m, e));
            return null;
        }

        static IEnumerator PrepararRetomada(Dmap m, EstadoDoMapa e)
        {
            int minha = ++_geracao;
            Preparando = true;
            try
            {
                var salvar = SingletonBehaviour<SaveLoadController>.IsInitialized ? SingletonBehaviour<SaveLoadController>.Instance : null;
                // o jogo carrega a cena, repoe a gravacao e espera o "Continuar" da tela de carregamento
                float limite = Time.unscaledTime + 900f, aviso = Time.unscaledTime + 20f;
                yield return null;
                while (Time.unscaledTime < limite && minha == _geracao && salvar != null && salvar.IsLoading)
                {
                    if (Time.unscaledTime >= aviso) { aviso = Time.unscaledTime + 20f; Log.Info("retomando: esperando o jogo carregar a partida (a tela pede «Continuar»?)"); }
                    yield return null;
                }
                if (minha != _geracao) yield break;
                float ate = Time.unscaledTime + 30f;
                while (Time.unscaledTime < ate && minha == _geracao && !(Jogo.CenaAtual() == Scene.Game && Jogo.EncontroPronto)) yield return null;
                if (minha != _geracao) yield break;
                if (Jogo.CenaAtual() != Scene.Game || !Jogo.EncontroPronto)
                {
                    Log.Info("AVISO: a partida não carregou; nada a retomar");
                    Atual = null; Avulso = false; Oneshot = null; AndamentoId = null;
                    yield break;
                }
                Log.Info("retomando «" + m.NomeVisivel + "»: o jogo carregou a partida; o mapa vai por cima, como estava");
                Roteiro.Parar();
                Silencio.Reiniciar();
                Dialogos.Limpar();
                Passo("textos das missões (leitura)", TextosDeMissao.Comecar);
                Objetos.Limpar();
                Inimigos.Reiniciar();
                Passo("destaques da gravação", Acoes.EsquecerDestaquesDoJogo);
                Passo("o mapa como estava", () => { Tabuleiro.AplicarMovidas(m, e.Tabuleiro); Objetos.AplicarPosicoes(m, e.Objetos); });
                yield return Seguro("tabuleiro", Tabuleiro.Montar(m));
                if (minha != _geracao) yield break;
                if (!Tabuleiro.Montado)
                {
                    Log.Info("AVISO: o tabuleiro não foi montado na partida retomada");
                    Dialogos.Mensagem(Idioma.T("O tabuleiro do mapa não foi montado. Voltem ao menu e continuem a partida outra vez.", "The map's board was not set up. Go back to the menu and continue the game again."), null, "Bigorna");
                    yield break;
                }
                Passo("peças como estavam", () => Tabuleiro.Restaurar(e.Tabuleiro));
                Silencio.Vigiando = true;
                Passo("grupo", () => { HeroisProprios.DarRunas(); ReceitasProprias.DarIniciais(); HeroisProprios.TrocarArmas(); });
                yield return Seguro("objetos", Objetos.Colocar(m, true));
                if (minha != _geracao) yield break;
                Passo("objetos como estavam", () => Objetos.Restaurar(e.Objetos));
                Passo("calar a base", () => Silencio.Calar());
                Passo("fase do herói", Silencio.FaseDoHeroi);
                yield return Seguro("textos das missões", TextosDeMissao.Esperar(30f));
                Passo("textos das missões", TextosDeMissao.ReporTodos);
                Passo("inimigos como estavam", () => Inimigos.Restaurar(m, e.Inimigos));
                Passo("roteiro", () => Roteiro.Retomar(m, e));
                Passo("destaques", () => Acoes.RestaurarDestaques(e.Realces));
                Passo("música", () => { if (MusicaPropria.Tocar(m)) return; var ev = m.Metadados?.Musica?.Evento; if (!string.IsNullOrEmpty(ev)) Sons.Tocar(ev); });
                Passo("a mesa", () => AvisarRetomada(m));
            }
            finally { if (minha == _geracao) Preparando = false; }
        }

        /// <summary>A mesa pode ter guardado tudo: um aviso diz o que montar de novo (as pecas, os objetos e os monstros em jogo);
        /// os herois voltam para onde estavam (o app nao sabe onde).</summary>
        static void AvisarRetomada(Dmap m)
        {
            int rodada = Roteiro.Rodada >= 0 ? Roteiro.Rodada : Jogo.Rodada;
            Dialogos.Mensagem(Idioma.TF("A partida continua na rodada {0}, do ponto em que foi gravada. Se a mesa foi guardada, montem tudo como estava; os avisos a seguir dizem as peças, os objetos e os monstros em jogo. Os heróis voltam para onde estavam.",
                "The game resumes in round {0}, from the point where it was saved. If the table was put away, set it all up as it was; the next notices list the tiles, objects and monsters in play. The heroes go back to where they were.", Math.Max(1, rodada)), null, m.NomeVisivel);
            var pecas = Tabuleiro.PecasNaMesa();
            if (pecas.Count > 0) Dialogos.Mensagem(Idioma.T("Peças na mesa:\n", "Tiles on the table:\n") + string.Join(", ", pecas.ToArray()), null, Idioma.T("Montagem", "Setup"));
            var objetos = Objetos.VisiveisNaMesa();
            if (objetos.Count > 0) Dialogos.Mensagem(Idioma.T("Objetos na mesa:\n", "Objects on the table:\n") + string.Join("\n", objetos.Select(x => "• " + x).ToArray()), null, Idioma.T("Objetos", "Objects"));
            var inimigos = Inimigos.NaMesa();
            if (inimigos.Count > 0) Dialogos.Mensagem(Idioma.T("Monstros em jogo:\n", "Monsters in play:\n") + string.Join("\n", inimigos.Select(x => "• " + x).ToArray()), null, Idioma.T("Inimigos", "Enemies"));
        }

        static void Bloquear(Dmap m)
        {
            var cena = Jogo.Cena;
            if (cena == null || m.Board.Bloqueadas.Count == 0) return;
            int n = 0;
            foreach (var c in m.Board.Bloqueadas)
                if (c != null && c.Length >= 2) { cena.AddDynamicBlockingPosition(Jogo.Mundo(c[0], c[1])); n++; }
            Log.Info("bloqueadas " + n + " casa(s) do mapa");
        }

        public static void Passo(string nome, Action acao)
        {
            try { acao(); }
            catch (Exception ex) { Log.Erro("a etapa «" + nome + "» quebrou e foi pulada", ex); }
        }

        public static IEnumerator Seguro(string nome, IEnumerator rotina)
        {
            if (rotina == null) yield break;
            while (true)
            {
                object atual;
                try { if (!rotina.MoveNext()) break; atual = rotina.Current; }
                catch (Exception ex) { Log.Erro("a etapa «" + nome + "» quebrou e foi pulada", ex); break; }
                yield return atual;
            }
        }

        public static QuestModel CenaBase(Dmap m)
        {
            List<QuestModel> todas;
            try { todas = UserCollectionManager.GetQuests(true).ToList(); }
            catch (Exception ex) { Log.Info("não li as missões: " + ex.Message); return null; }
            var pedida = !string.IsNullOrEmpty(m?.Metadados?.Cena) ? m.Metadados.Cena : m?.Board?.CenaBase;
            if (!string.IsNullOrEmpty(pedida))
            {
                var q = todas.FirstOrDefault(x => x.Id == pedida);
                if (q != null) return q;
                Log.Info("o mapa pede a cena «" + pedida + "», que não está disponível; uso outra");
            }
            foreach (var id in CenasBase)
            {
                var q = todas.FirstOrDefault(x => x.Id == id);
                if (q != null) return q;
            }
            return todas.FirstOrDefault(q => q.Id != "STORY_QUEST_1" && q.Id != "ACT2_QUEST_1") ?? todas.FirstOrDefault();
        }

        static DifficultySetting Dificuldade(Dmap m)
        {
            switch ((m.Metadados?.Dificuldade ?? "").Trim().ToLowerInvariant())
            {
                case "easy": case "facil": case "fácil": case "journey": return DifficultySetting.Journey;
                case "hard": case "dificil": case "difícil": case "heroic": return DifficultySetting.Heroic;
                case "brutal": case "warfare": case "extreme": return DifficultySetting.Warfare;
                default: return DifficultySetting.Standard;
            }
        }

        /// <summary>Saimos do encontro: tudo volta ao zero. O mapa oneshot vencido ou perdido sai das partidas em andamento; o
        /// deixado no meio (gravar e sair) fica.</summary>
        public static void Encerrar()
        {
            // (v266: o mapa terminou numa partida retomada, e o oneshot.dmap ja e de outro mapa: a copia da partida e a ultima. Ela
            // fica guardada a parte, e na tela de titulo vem a pergunta se o mapa vira um mapa novo)
            if (Resultado.HasValue && Oneshot != null && Atual != null && !string.IsNullOrEmpty(Oneshot.Semente))
                try
                {
                    Menu.Oneshot.Garantir();
                    var ultimo = Menu.Oneshot.Ultimo();
                    bool ultimaCopia = ultimo == null || !string.Equals(ultimo.Semente, Oneshot.Semente, StringComparison.OrdinalIgnoreCase);
                    if (ultimaCopia && MapasJogados.Pendente(Oneshot.Semente) && !string.IsNullOrEmpty(Atual.Caminho) && File.Exists(Atual.Caminho))
                    {
                        var guarda = Path.Combine(Menu.Oneshot.Pasta, "fim-pendente.dmap"); File.Copy(Atual.Caminho, guarda, true);
                        Menu.Oneshot.FimPendente = new Menu.Oneshot.Ficha { Semente = Oneshot.Semente, Nome = Atual.NomeVisivel }; Menu.Oneshot.CaminhoDoFim = guarda;
                        Log.Info("mapa oneshot terminado («" + Atual.NomeVisivel + "», semente " + Oneshot.Semente + "): na tela de título, a pergunta se ele vira mapa novo");
                    }
                }
                catch (Exception ex) { Log.Info("guardando o mapa para a pergunta: " + ex.Message); }
            if (Resultado.HasValue && !string.IsNullOrEmpty(AndamentoId))
                try { Retomada.Garantir(); if (Andamento.Apagar(AndamentoId)) Log.Info("mapa oneshot " + (Resultado == true ? "vencido" : "perdido") + ": a partida sai das partidas em andamento"); } catch (Exception ex) { Log.Info("apagando a partida em andamento: " + ex.Message); }
            Oneshot = null; AndamentoId = null;
            _geracao++;   // um preparo ainda em curso para aqui
            Objetos.QuemUsou = null;
            Preparando = false;
            Atual = null;
            Avulso = false;
            Prologo = null;
            Roteiro.Parar();
            Tabuleiro.Reiniciar();
            Objetos.Limpar();
            Inimigos.Reiniciar();
            Dialogos.Limpar();
            Silencio.Reiniciar();
        }
    }
}
