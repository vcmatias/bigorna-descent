using System;
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

        public static string Lancar(Dmap m)
        {
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
                partida.PartyName = "Bigorna";
                partida.GameDifficulty = Dificuldade(m);
                var salvar = SingletonBehaviour<SaveLoadController>.Instance;
                Jogo.DadosJogo.CurrentSaveIndex = 0;
                if (salvar.GetExistingIndexes().Contains(0)) salvar.DeleteSaveSlot(0);
            }
            catch (Exception ex) { Log.Erro("preparando a partida", ex); return Idioma.T("Não consegui preparar a partida: ", "Could not prepare the game: ") + ex.Message; }
            Atual = m; Menu.Relatos.UltimoMapa = m?.Caminho ?? Menu.Relatos.UltimoMapa;
            Avulso = true;
            Resultado = null;
            Log.Info("abrindo «" + m.NomeVisivel + "» sobre a cena de " + cena.Id + ", dificuldade " + partida.GameDifficulty);
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
                yield return Seguro("inimigos", Inimigos.Povoar(m));
                if (minha != _geracao) yield break;
                Passo("bloqueios", () => Bloquear(m));
                Passo("roteiro", () => Roteiro.Comecar(m));
                Passo("música", () => { if (MusicaPropria.Tocar(m)) return; var ev = m.Metadados?.Musica?.Evento; if (!string.IsNullOrEmpty(ev)) Sons.Tocar(ev); });
                Passo("fase do herói", Silencio.FaseDoHeroi);
            }
            finally { if (minha == _geracao) Preparando = false; }
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

        /// <summary>Saimos do encontro: tudo volta ao zero.</summary>
        public static void Encerrar()
        {
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
