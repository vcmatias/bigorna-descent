using System;
using System.Collections.Generic;
using System.Linq;
using FFG.Core;
using FFG.D3;
using NodeCanvas.Framework;
using UnityEngine;

namespace Bigorna.Menu
{
    /// <summary>Mapas oficiais: a escolha de uma missao do jogo para jogar de novo, com as regras do jogo (nada do mod por cima),
    /// como a tela de depuracao "encounter select" dos desenvolvedores: um grupo de 2 a 4 herois da colecao, a dificuldade, e o
    /// progresso da campanha ate aquela missao (missoes anteriores do ato vencidas, destinos abertos, eventos de cidade, o nivel
    /// de progressao dos inimigos). Joga-se na ranhura 0, a de depuracao do jogo (as partidas de verdade comecam na 1). Ao
    /// terminar a missao, o jogo iria ao mapa-mundi dessa campanha montada; voltamos ao menu.</summary>
    public static class MapasOficiais
    {
        /// <summary>Uma missao oficial esta em curso, aberta por esta lista.</summary>
        public static bool EmJogo;

        public static List<QuestModel> Lista()
        {
            try
            {
                // (so as do jogo: os destinos das campanhas do Bigorna entram na colecao com o nome "Bigorna_<id>" e ficam de fora)
                return UserCollectionManager.GetQuests(true).Where(q => q != null && !string.IsNullOrEmpty(q.NameKey) && !(q.name ?? "").StartsWith("Bigorna_")).ToList();
            }
            catch (Exception ex) { Log.Info("mapas oficiais: não li as missões: " + ex.Message); return new List<QuestModel>(); }
        }

        public static string Nome(QuestModel q)
        {
            try { var t = FFGLocalization.Get(q.NameKey, false); if (!string.IsNullOrEmpty(t)) return t; } catch { }
            return q.Id;
        }

        public static string Descricao(QuestModel q)
        {
            try { return string.IsNullOrEmpty(q.DescKey) ? "" : FFGLocalization.Get(q.DescKey, false) ?? ""; } catch { return ""; }
        }

        public static string NomeHeroi(HeroModel h)
        {
            try { var t = FFGLocalization.Get(h.KeyName, false); if (!string.IsNullOrEmpty(t)) return t; } catch { }
            return h.Id;
        }

        public static List<HeroModel> Herois()
        {
            try { return UserCollectionManager.GetHeroes(true).ToList(); } catch { return new List<HeroModel>(); }
        }

        /// <summary>Os herois que a missao exige (a historia conta com eles).</summary>
        public static HashSet<string> Exigidos(QuestModel q)
        {
            var s = new HashSet<string>();
            try { if (q.RequiredHeroes != null) foreach (var id in q.RequiredHeroes) if (!string.IsNullOrEmpty(id)) s.Add(id); } catch { }
            return s;
        }

        public static string Jogar(QuestModel q, List<HeroModel> herois, DifficultySetting dificuldade)
        {
            if (q == null) return "Escolha uma missão.";
            if (herois == null || herois.Count < 2 || herois.Count > 4) return "Escolha de 2 a 4 heróis.";
            SerializedGame partida;
            try
            {
                partida = new SerializedGame(q.Act.AsCampaignId());
                partida.Initialize();
                partida.UnavailableHeroes.Clear();
                foreach (var h in herois)
                {
                    var p = partida.GetPlayer(h, false);
                    if (p == null) return "O herói " + NomeHeroi(h) + " não está na coleção.";
                    partida.ActivePlayers.Add(p);
                }
                partida.QuestId = q.Id;
                partida.EncounterIndex = 0;
                partida.PartyName = "Bigorna";
                partida.GameDifficulty = dificuldade;
                Progresso(q, partida);
                Jogo.DadosJogo.CurrentSaveIndex = 0;
                var salvar = SingletonBehaviour<SaveLoadController>.Instance;
                if (salvar.GetExistingIndexes().Contains(0)) salvar.DeleteSaveSlot(0);
                if (q.Id == "STORY_QUEST_1" || q.Id == "ACT2_QUEST_1") Jogo.Carregador.LoadingIntroSequence = true;
            }
            catch (Exception ex) { Log.Erro("preparando a missão oficial", ex); return "Não consegui preparar a partida: " + ex.Message; }
            Log.Info("mapa oficial: " + q.Id + " (" + Nome(q) + "), " + herois.Count + " herói(s), dificuldade " + dificuldade + ", progressão " + partida.CampaignProgressionOverride);
            try { Jogo.Carregador.LoadLevel(q, partida, true); }
            catch (Exception ex) { Log.Erro("carregando a missão oficial", ex); return "O jogo não carregou a missão: " + ex.Message; }
            EmJogo = true;
            return null;
        }

        /// <summary>O ponto da campanha em que a missao acontece, como o jogo faz na sua tela de depuracao: as missoes do ato
        /// ate ela (na ordem da colecao) somam o que exigem; as ja jogadas ficam vencidas na lousa do ato.</summary>
        static void Progresso(QuestModel alvo, SerializedGame partida)
        {
            var completas = new List<string>(); var ativas = new List<string>(); var cidade = new List<string>(); var narrativa = new List<string>();
            bool lateral = alvo.Id.Contains("SIDE");
            foreach (var q in Lista())
            {
                if (q.Act != alvo.Act) continue;
                Requisitos(q.Id, lateral, alvo.Id, completas, ativas, cidade, narrativa);
                if (q.Id == alvo.Id) break;
            }
            ativas.RemoveAll(completas.Contains);
            foreach (var id in ativas) partida.ActiveDestinationIds.AddUniqueItem(id);
            foreach (var id in completas) partida.CompletedDestinationIds.AddUniqueItem(id);
            foreach (var id in cidade) partida.CompletedCityEventIds.AddUniqueItem(id);
            foreach (var id in narrativa) partida.CompletedNarrativeEventIds.AddUniqueItem(id);
            partida.CampaignProgressionOverride = Progressao(alvo.Id);
            // a lousa do ato: as missoes anteriores vencidas, a ultima delas, e quantas o Ato II ja jogou
            var lousa = alvo.Act == Act.ActI ? partida.Act1BBVarsOverriden : alvo.Act == Act.ActII ? partida.Act2BBVarsOverriden : null;
            if (lousa == null) return;
            string ultima = null; int n = 0;
            foreach (var id in completas)
            {
                string v = id;
                if (alvo.Act == Act.ActI) v = v.Replace("_4_S", "_4").Replace("STORY_QUEST_", "Quest_");
                else if (alvo.Act == Act.ActII) { v = v.Replace("ACT2_QUEST_", "Quest_"); n++; }
                if (!v.StartsWith("Quest_")) continue;
                lousa.Add(Var(v, "WIN")); ultima = id;
            }
            if (ultima != null) lousa.Add(Var("LastQuest", ultima));
            if (n > 0) lousa.Add(new Variable<int> { name = "Number of A2 Quests Played", value = n });
        }

        static Variable Var(string nome, string valor) => new Variable<string> { name = nome, value = valor };

        static int Progressao(string id)
        {
            switch (id)
            {
                case "STORY_QUEST_2": case "STORY_QUEST_3": case "STORY_QUEST_4_S": case "STORY_QUEST_5": return 22;
                case "STORY_QUEST_6": case "STORY_QUEST_7": case "STORY_QUEST_8": case "SIDE_QUEST_1": return 30;
                case "STORY_QUEST_9": case "SIDE_QUEST_2": return 32;
                case "STORY_QUEST_10": return 34;
                case "STORY_QUEST_11": case "STORY_QUEST_12": case "STORY_QUEST_13": return 36;
                case "STORY_QUEST_14": return 42;
                case "ACT2_QUEST_1": return 46;
                case "ACT2_QUEST_2": case "ACT2_QUEST_3": return 48;
                case "ACT2_QUEST_4": return 52;
                case "ACT2_QUEST_5": case "ACT2_QUEST_8": case "ACT2_QUEST_9": return 54;
                case "ACT2_QUEST_6": case "ACT2_QUEST_7": return 56;
                case "ACT2_QUEST_10": return 58;
                case "ACT2_QUEST_11": return 66;
                default: return 0;
            }
        }

        /// <summary>O que cada missao pede para estar aberta (os mesmos marcos da tela de depuracao do jogo).</summary>
        static void Requisitos(string id, bool lateral, string alvo, List<string> c, List<string> a, List<string> cid, List<string> nar)
        {
            void C(params string[] x) { foreach (var s in x) c.AddUniqueItem(s); }
            void A(params string[] x) { foreach (var s in x) a.AddUniqueItem(s); }
            void E(string s) => cid.AddUniqueItem(s);
            switch (id)
            {
                case "STORY_QUEST_2": case "STORY_QUEST_3": C("STORY_QUEST_1"); A("STORY_QUEST_2", "STORY_QUEST_3"); break;
                case "STORY_QUEST_4_S": case "STORY_QUEST_5": C("STORY_QUEST_2", "STORY_QUEST_3"); A("STORY_QUEST_4_S", "STORY_QUEST_5"); break;
                case "STORY_QUEST_6": case "STORY_QUEST_7": case "STORY_QUEST_8": C("STORY_QUEST_4_S", "STORY_QUEST_5"); A("STORY_QUEST_6", "STORY_QUEST_7", "STORY_QUEST_8"); E("CITY_EVENT_1"); break;
                case "SIDE_QUEST_1": E("CITY_EVENT_1"); A("SIDE_QUEST_1"); break;
                case "STORY_QUEST_9": if (!lateral || alvo == "SIDE_QUEST_2") { C("STORY_QUEST_6", "STORY_QUEST_7", "STORY_QUEST_8"); A("STORY_QUEST_9"); E("CITY_EVENT_6"); } break;
                case "STORY_QUEST_10": if (!lateral || alvo == "SIDE_QUEST_2") { C("STORY_QUEST_9"); A("STORY_QUEST_10"); E("CITY_EVENT_2"); } break;
                case "SIDE_QUEST_2": C("STORY_QUEST_10"); A("SIDE_QUEST_2"); break;
                case "STORY_QUEST_11": case "STORY_QUEST_12": case "STORY_QUEST_13": if (!lateral) { C("STORY_QUEST_10"); A("STORY_QUEST_11", "STORY_QUEST_12", "STORY_QUEST_13"); E("CITY_EVENT_5"); } break;
                case "STORY_QUEST_14": if (!lateral) { C("STORY_QUEST_11", "STORY_QUEST_12", "STORY_QUEST_13"); A("STORY_QUEST_14"); E("CITY_EVENT_5"); } break;
                case "ACT2_QUEST_2": case "ACT2_QUEST_3": C("ACT2_QUEST_1"); A("ACT2_QUEST_2", "ACT2_QUEST_3"); E("A2_S01_CITADEL"); break;
                case "ACT2_QUEST_4": C("ACT2_QUEST_2", "ACT2_QUEST_3"); A("ACT2_QUEST_4"); E("A2_S02_ELDER_BRIDGE"); break;
                case "ACT2_QUEST_5": C("ACT2_QUEST_4"); A("ACT2_QUEST_5"); E("A2_S03_LORDS_LOYALISTS"); break;
                case "ACT2_QUEST_6": case "ACT2_QUEST_7": C("ACT2_QUEST_5"); A("ACT2_QUEST_6", "ACT2_QUEST_7"); E("A2_S04_DRAGON_QUEEN"); break;
                case "ACT2_QUEST_8": case "ACT2_QUEST_9": C("ACT2_QUEST_6", "ACT2_QUEST_7"); A("ACT2_QUEST_8", "ACT2_QUEST_9"); E("A2_S05_DRAGONSBANE"); break;
                case "ACT2_QUEST_10": C("ACT2_QUEST_8", "ACT2_QUEST_9"); A("ACT2_QUEST_10"); E("A2_S06_MONSTERS_BALL"); break;
                case "ACT2_QUEST_11": C("ACT2_QUEST_10"); A("ACT2_QUEST_11"); nar.AddUniqueItem("SS07_DEATH_AND_BETRAYAL"); break;
            }
        }

        // ------------------------------------------------------------------ a aba no painel de mapas
        static QuestModel _escolhida;
        static readonly HashSet<string> _grupo = new HashSet<string>();
        static int _dificuldade = 1;
        static readonly string[] Dificuldades = { "Fácil", "Normal", "Difícil", "Brutal" };
        static readonly DifficultySetting[] Valores = { DifficultySetting.Journey, DifficultySetting.Standard, DifficultySetting.Heroic, DifficultySetting.Warfare };
        static List<QuestModel> _lista;
        static List<HeroModel> _herois;
        public static void Reler() { _lista = null; _herois = null; }
        public static int Quantas => (_lista ?? (_lista = Lista())).Count;

        /// <summary>Desenha a aba (dentro da rolagem do painel). Devolve uma mensagem de erro, se houver.</summary>
        public static string Desenhar(GUIStyle botao, GUIStyle texto, GUIStyle pequeno, Action fechar)
        {
            _lista = _lista ?? Lista(); _herois = _herois ?? Herois();
            string erro = null;
            if (_lista.Count == 0) { GUILayout.Label("Nenhuma missão do jogo encontrada na sua coleção.", texto); return null; }
            Act? ato = null;
            foreach (var q in _lista)
            {
                if (ato != q.Act) { ato = q.Act; GUILayout.Space(4f); GUILayout.Label(q.Act == Act.ActI ? "Ato I" : q.Act == Act.ActII ? "Ato II" : "Ato III", texto); }
                GUILayout.BeginVertical(GUI.skin.box);
                GUILayout.BeginHorizontal();
                GUILayout.BeginVertical();
                GUILayout.Label(Nome(q) + (q.Type == QuestModel.QuestType.Side ? "  (secundária)" : ""), texto);
                var d = Descricao(q); if (!string.IsNullOrEmpty(d) && _escolhida == q) GUILayout.Label(d, pequeno);
                GUILayout.EndVertical();
                if (GUILayout.Button(_escolhida == q ? "Fechar" : "Escolher", botao, GUILayout.Width(100f), GUILayout.Height(34f)))
                {
                    _escolhida = _escolhida == q ? null : q;
                    if (_escolhida != null) { _grupo.Clear(); foreach (var id in Exigidos(q)) _grupo.Add(id); }
                }
                GUILayout.EndHorizontal();
                if (_escolhida == q) erro = Configurar(q, botao, pequeno, fechar) ?? erro;
                GUILayout.EndVertical();
                GUILayout.Space(3f);
            }
            return erro;
        }

        static string Configurar(QuestModel q, GUIStyle botao, GUIStyle pequeno, Action fechar)
        {
            var exigidos = Exigidos(q);
            GUILayout.Label("Heróis (2 a 4)" + (exigidos.Count > 0 ? " · a missão exige os marcados em destaque" : "") + ":", pequeno);
            int col = 0;
            GUILayout.BeginHorizontal();
            foreach (var h in _herois)
            {
                bool tem = _grupo.Contains(h.Id), exige = exigidos.Contains(h.Id);
                GUI.enabled = !exige && (tem || _grupo.Count < 4);
                bool novo = GUILayout.Toggle(tem, (exige ? "★ " : "") + NomeHeroi(h), GUILayout.Width(160f));
                GUI.enabled = true;
                if (novo != tem) { if (novo) _grupo.Add(h.Id); else _grupo.Remove(h.Id); }
                if (++col % 4 == 0) { GUILayout.EndHorizontal(); GUILayout.BeginHorizontal(); }
            }
            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            GUILayout.Label("Dificuldade:", pequeno, GUILayout.Width(80f));
            _dificuldade = GUILayout.Toolbar(_dificuldade, Dificuldades, GUILayout.Width(360f));
            GUILayout.FlexibleSpace();
            GUI.enabled = _grupo.Count >= 2 && _grupo.Count <= 4;
            bool jogar = GUILayout.Button("Jogar", botao, GUILayout.Width(100f), GUILayout.Height(34f));
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            GUILayout.Label("Regras do jogo, sem nada do mod por cima; o grupo começa com o equipamento inicial e a campanha no ponto desta missão. Ao terminar, volta ao menu.", pequeno);
            if (!jogar) return null;
            var grupo = _herois.Where(h => _grupo.Contains(h.Id)).ToList();
            Log.Info("«Jogar» mapa oficial " + q.Id);
            var erro = Jogar(q, grupo, Valores[Mathf.Clamp(_dificuldade, 0, 3)]);
            if (erro == null) { _escolhida = null; fechar(); }
            return erro;
        }
    }
}
