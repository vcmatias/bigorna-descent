using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Bigorna.Formato;
using FFG.D3;
using FFG.D3.WorldMap;
using UnityEngine;
using UnityEngine.UI;

namespace Bigorna.Campanha
{
    /// <summary>Os nos da campanha no mapa-mundi do jogo: cada um vira uma QuestModel falsa (com a cena base emprestada) registrada
    /// na colecao do jogo, para o mapa poder mostrar, viajar e salvar. Como o DescentForge fazia.</summary>
    public static class MapaMundi
    {
        static readonly Dictionary<string, IDestination> _nossos = new Dictionary<string, IDestination>(StringComparer.OrdinalIgnoreCase);
        static bool _todasPostas;
        static Button _enganchado;
        static string _noDaFicha;

        public static bool EhNosso(string id) => !string.IsNullOrEmpty(id) && _nossos.ContainsKey(id);

        /// <summary>Na tela de titulo: registra os nos de todas as campanhas, para "continuar partida" resolver os destinos salvos.</summary>
        public static int RegistrarTodas()
        {
            if (_todasPostas) return 0;
            int n = 0;
            try
            {
                if (Encontro.Lancador.CenaBase(null) == null) return 0;
                foreach (var c in Dcamp.CarregarTodas(Bootstrap.PastaMapas))
                    foreach (var no in c.Nos)
                        if (!string.IsNullOrEmpty(no?.Id) && !no.NaCidade && Registrar(c, no) != null) n++;
                _todasPostas = true;
                if (n > 0) Log.Info("destinos de campanhas registrados: " + n);
            }
            catch (Exception ex) { Log.Info("não registrei os destinos das campanhas: " + ex.Message); }
            return n;
        }

        public static IDestination Registrar(Dcamp c, Dcamp.No n)
        {
            if (_nossos.TryGetValue(n.Id, out var pronto)) return pronto;
            if (!n.EhMapa && string.Equals(n.Marcador, "narrative", StringComparison.OrdinalIgnoreCase)) return RegistrarEvento(c, n);
            var q = ScriptableObject.CreateInstance<QuestModel>();
            q.name = "Bigorna_" + n.Id;
            Por(q, "_id", n.Id);
            Por(q, "_act", AtoDe(c));
            Por(q, "_keyName", string.IsNullOrEmpty(n.Nome) ? n.Id : n.Nome);
            Por(q, "_descKey", n.Descricao ?? "");
            Por(q, "_mapCoordinates", new Vector2(n.X, n.Y));
            Por(q, "_useDefaultTravelDT", true);
            Por(q, "_hasArrivalDT", false);
            Por(q, "_spawnAutomatically", true);
            q.Type = n.Marcador == "main" ? QuestModel.QuestType.Main : QuestModel.QuestType.Side;
            q.RequiredHeroes = new string[0];
            q.RequireWin = false;
            var basee = Encontro.Lancador.CenaBase(null);
            if (basee != null)
            {
                q.SceneAssetPath = basee.SceneAssetPath;
                Por(q, "_localizationAssetPath", Ler(basee, "_localizationAssetPath"));
                Por(q, "_questMusic", Ler(basee, "_questMusic"));
            }
            _nossos[n.Id] = q;
            NaColecao(q);
            return q;
        }

        /// <summary>Parada narrativa marcada como evento narrativo: entra no mapa com o icone e o comportamento de evento do jogo.</summary>
        static IDestination RegistrarEvento(Dcamp c, Dcamp.No n)
        {
            var e = ScriptableObject.CreateInstance<NarrativeEventModel>();
            e.name = "Bigorna_" + n.Id;
            Por(e, "_id", n.Id);
            Por(e, "_act", AtoDe(c));
            Por(e, "_keyName", string.IsNullOrEmpty(n.Nome) ? n.Id : n.Nome);
            Por(e, "_keyDesc", n.Descricao ?? "");
            Por(e, "_mapCoordinates", new Vector2(n.X, n.Y));
            Por(e, "_useDefaultTravelDT", true);
            Por(e, "_hasArrivalDT", false);
            Por(e, "_spawnAutomatically", true);
            Por(e, "_requiredCompletedQuests", new string[0]);
            Por(e, "_requiredCompletedNarrativeEvents", new string[0]);
            Por(e, "_requiredCompletedCityEvents", new string[0]);
            _nossos[n.Id] = e;
            NaColecao(n.Id, e, "s_allNarrativeEvents", "s_ownedNarrativeEvents");
            return e;
        }

        static void NaColecao(QuestModel q) => NaColecao(q.Id, q, "s_allQuests", "s_ownedQuests");
        static void NaColecao(string id, object modelo, params string[] nomes)
        {
            foreach (var nome in nomes)
            {
                try
                {
                    var f = typeof(UserCollectionManager).GetField(nome, BindingFlags.Static | BindingFlags.NonPublic);
                    if (f?.GetValue(null) is System.Collections.IDictionary dic) dic[id] = modelo;
                    else Log.Info("não achei " + nome + ": o destino «" + id + "» não vai resolver");
                }
                catch (Exception ex) { Log.Info("registrando «" + id + "» em " + nome + ": " + ex.Message); }
            }
        }

        // (so os campos privados do modelo: um publico de mesmo nome fica como esta)
        static object Ler(object obj, string campo) => Reflexao.Ler(obj, campo, Reflexao.Privados);
        static void Por(object obj, string campo, object valor) => Reflexao.Por(obj, campo, valor, Reflexao.Privados);

        public static Act AtoDe(Dcamp c)
        {
            var t = (c.Metadados?.Ato ?? "I").Trim().ToUpperInvariant();
            return t == "II" ? Act.ActII : t == "III" ? Act.ActIII : Act.ActI;
        }

        static WorldMapSceneController Mapa => SingletonBehaviour<WorldMapSceneController>.IsInitialized ? SingletonBehaviour<WorldMapSceneController>.Instance : null;

        /// <summary>Poe no mapa os nos que devem aparecer e tira os que nao devem.</summary>
        public static void Sincronizar(Dcamp c, Progresso p)
        {
            var mapa = Mapa;
            if (c == null || mapa == null) return;
            int postos = 0, tirados = 0;
            foreach (var n in c.Nos)
            {
                if (n.NaCidade) continue;   // visita a cidade: nao e destino do mapa
                bool deve = p.DeveAparecer(n);
                var q = deve ? Registrar(c, n) : (_nossos.TryGetValue(n.Id, out var x) ? x : null);
                if (q == null) continue;
                var no = mapa.FindNode(q);
                if (deve && no == null) { mapa.AddDestination(q); postos++; try { Jogo.Partida?.ActiveDestinationIds.AddUniqueItem(n.Id); } catch { } }
                else if (!deve && no != null) { mapa.RemoveDestination(q); tirados++; try { Jogo.Partida?.ActiveDestinationIds.Remove(n.Id); } catch { } }
            }
            if (postos > 0 || tirados > 0) Log.Info("mapa-mundi: " + postos + " destino(s) posto(s), " + tirados + " tirado(s)");
        }

        public static void Limpar()
        {
            var mapa = Mapa;
            if (mapa != null)
                foreach (var kv in _nossos)
                    try { if (mapa.FindNode(kv.Value) != null) mapa.RemoveDestination(kv.Value); } catch (Exception ex) { Log.Info("tirando «" + kv.Key + "»: " + ex.Message); }
            _nossos.Clear();
            _todasPostas = false;
        }

        /// <summary>Destinos salvos que ninguem sabe resolver (campanha apagada?) saem da partida para o mapa nao quebrar.</summary>
        public static void RepararDestinos()
        {
            try
            {
                var lista = Jogo.Partida?.ActiveDestinationIds;
                if (lista == null || lista.Count == 0) return;
                var soltos = lista.Where(id => !Resolve(id)).ToList();
                if (soltos.Count == 0) return;
                var campanhas = Dcamp.CarregarTodas(Bootstrap.PastaMapas);
                foreach (var id in soltos)
                {
                    var c = campanhas.FirstOrDefault(x => x.Nos.Any(n => string.Equals(n.Id, id, StringComparison.OrdinalIgnoreCase)));
                    var no = c?.NoPorId(id);
                    if (no != null) { Registrar(c, no); if (Resolve(id)) continue; }
                    lista.Remove(id);
                    Log.Info("o destino «" + id + "» não é de nenhuma campanha conhecida: sai da partida");
                }
            }
            catch (Exception ex) { Log.Info("reparando destinos: " + ex.Message); }
        }

        static bool Resolve(string id)
        {
            try
            {
                if (string.IsNullOrEmpty(id)) return false;
                if (UserCollectionManager.QuestExists(id)) return UserCollectionManager.GetQuest(id, true) != null;
                if (UserCollectionManager.NarrativeEventExists(id)) return UserCollectionManager.GetNarrativeEvent(id, true) != null;
                return false;
            }
            catch { return false; }
        }

        /// <summary>A ficha do destino: nas paradas narrativas (sem mapa) o botao "viajar" e nosso, porque o jogo nao tem cena para carregar.</summary>
        public static void VigiarFicha()
        {
            var mapa = Mapa;
            if (mapa == null) return;
            string atual = null;
            try { atual = mapa.CurrentNode?.Model?.Id; } catch { }
            if (atual == _noDaFicha) return;
            _noDaFicha = atual;
            Desenganchar();
            if (atual == null || !EhNosso(atual)) return;
            try
            {
                var ficha = Jogo.UI?.DestinationDetails;
                if (ficha == null) return;
                var no = Campanha.Aberta?.NoPorId(atual);
                if (no != null && !no.EhMapa)
                {
                    var botao = ficha.ButtonTravel;
                    if (botao != null) { botao.onClick.AddListener(Pulsado); _enganchado = botao; }
                }
            }
            catch (Exception ex) { Log.Info("ficha do destino: " + ex.Message); }
        }

        static void Pulsado()
        {
            var id = _noDaFicha;
            Desenganchar();
            try { Jogo.UI?.DestinationDetails?.SetVisibility(false, true); } catch { }
            Campanha.AoPulsarParada(id);
        }

        static void Desenganchar()
        {
            if (_enganchado == null) return;
            try { _enganchado.onClick.RemoveListener(Pulsado); } catch { }
            _enganchado = null;
        }
    }
}
