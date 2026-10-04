using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Campanha
{
    /// <summary>Uma campanha (.dcamp) jogada sobre o mapa-mundi do proprio jogo: os nos viram destinos; ao chegar num mapa,
    /// o .dmap e montado sobre a cena que o jogo carregou; ao voltar, o no e completado, as recompensas e o dialogo de
    /// conclusao saem, e os nos seguintes aparecem.</summary>
    public static class Campanha
    {
        public static Dcamp Aberta { get; private set; }
        public static Progresso Estado { get; private set; }
        static Dcamp.No _emCurso;
        static int _ranhuraVista = int.MinValue;
        static string _introPendente;
        static float _proximaTentativa;


        public static void Abrir(Dcamp c)
        {
            Fechar();
            Aberta = c; Menu.Relatos.UltimaCampanha = c?.Caminho ?? Menu.Relatos.UltimaCampanha;
            Estado = Progresso.Carregar(c);
            try { Encontro.Personalizados.Registrar(c.Custom, "campanha «" + c.NomeVisivel + "»"); } catch (Exception ex) { Log.Erro("conteúdo próprio da campanha", ex); }
            Log.Info("campanha aberta: «" + c.NomeVisivel + "» (" + c.Nos.Count + " nós, " + Estado.Completados.Count + " completados)");
        }

        /// <summary>Partida nova (ou continuada pelo progresso da pasta) no mapa-mundi do jogo.</summary>
        public static string Comecar(Dcamp c, bool recomecar)
        {
            try
            {
                Abrir(c);
                if (recomecar) Estado.Zerar();
                var modelo = CampanhaDoJogo(c);
                if (modelo == null) return "Nenhuma campanha do jogo disponível para servir de base.";
                var partida = new SerializedGame(modelo.Id);
                partida.Initialize();
                partida.PartyName = c.NomeVisivel;
                try { partida.UnavailableHeroes?.Clear(); } catch { }
                try { if (partida.FeatProgresses.Count == 0 && partida.RealCompletedFeats.Count == 0) partida.SetPartyStartingFeats(); } catch (Exception ex) { Log.Info("proezas de saída: " + ex.Message); }
                try { InventarioInicial(partida, c.Comeco); } catch (Exception ex) { Log.Erro("inventário de saída da campanha", ex); }
                int n = 0;
                foreach (var no in c.Nos)
                {
                    if (!Estado.DeveAparecer(no)) continue;
                    MapaMundi.Registrar(c, no);
                    partida.ActiveDestinationIds.AddUniqueItem(no.Id);
                    n++;
                }
                if (n == 0) return "A campanha não tem nenhum nó disponível no início (todos completados?). Use «Recomeçar».";
                var salvar = SingletonBehaviour<SaveLoadController>.Instance;
                Jogo.DadosJogo.CurrentSaveIndex = salvar.GetFirstFreeIndex();
                Log.Info("partida de «" + c.NomeVisivel + "» na ranhura " + Jogo.DadosJogo.CurrentSaveIndex + " com " + n + " destino(s) de saída");
                _ranhuraVista = Jogo.DadosJogo.CurrentSaveIndex;
                Jogo.Carregador.LoadWorldMap(partida, true);
                _emCurso = null;
                _introPendente = Estado.Completados.Count == 0 ? c.Intro : null;
                return null;
            }
            catch (Exception ex) { Log.Erro("começando a campanha", ex); return ex.Message; }
        }

        /// <summary>O que o grupo ja traz ao comecar (veteranos): ouro, itens (um de cada: armaduras, apetrechos, pecas de arma,
        /// consumiveis conhecidos), materiais (com quantidade) e pericias desbloqueadas.</summary>
        static void InventarioInicial(SerializedGame g, Dcamp.Inicio ini)
        {
            if (g == null || ini == null) return;
            int itens = 0, pericias = 0;
            if (ini.Ouro > 0) g.Gold += ini.Ouro;
            foreach (var it in ini.Itens ?? new List<Dcamp.ItemInicial>())
            {
                if (it == null || string.IsNullOrEmpty(it.Item)) continue;
                ItemModel m = null; try { m = UserCollectionManager.GetItem(it.Item, false); } catch { }
                if (m == null) { Log.Info("  item de saída «" + it.Item + "» não existe"); continue; }
                // (uma receita ja descoberta: entra nas receitas do grupo, como o save do jogo guarda)
                if (m is RecipeModel rm) { if (g.DiscoveredRecipes == null) g.DiscoveredRecipes = new List<SerializedRecipe>(); if (!g.DiscoveredRecipes.Any(x => x != null && x.Id == rm.Id)) g.DiscoveredRecipes.Add(new SerializedRecipe(rm)); itens++; continue; }
                if (m is CraftingMaterialModel cm) { var ja = g.GetCraftingMaterial(cm); int q = Math.Max(1, it.Qtd); if (ja != null) ja.Qty += q; else g.AddTreasureDuringQuest(new SerializedCraftingMaterial(cm, q)); }
                else if (g.GetItem(m.Id) == null) g.AddTreasureDuringQuest(new SerializedItem(m));
                itens++;
            }
            foreach (var s in ini.Pericias ?? new List<string>())
            {
                if (string.IsNullOrEmpty(s)) continue;
                SkillModel sk = null; try { sk = UserCollectionManager.GetSkill(s, false); } catch { }
                if (sk == null) { Log.Info("  perícia de saída «" + s + "» não existe"); continue; }
                g.UnlockedSkills.AddUniqueItem(sk.Id); pericias++;
            }
            Log.Info("inventário de saída: " + ini.Ouro + " de ouro, " + itens + " item(ns), " + pericias + " perícia(s)");
        }

        static CampaignModel CampanhaDoJogo(Dcamp c)
        {
            List<CampaignModel> lista;
            try { lista = UserCollectionManager.GetCampaigns(true).ToList(); } catch { return null; }
            if (lista.Count == 0) return null;
            var ato = MapaMundi.AtoDe(c);
            return lista.FirstOrDefault(x => x.Act == ato) ?? lista.First();
        }

        /// <summary>Partida carregada pelo menu do jogo: se os destinos ativos sao de uma campanha nossa, reabre-a.</summary>
        public static bool ReabrirSeForPreciso()
        {
            if (Aberta != null) return false;
            try
            {
                var dados = Jogo.DadosJogo; var partida = dados?.Data;
                var ativos = partida?.ActiveDestinationIds;
                if (ativos == null || ativos.Count == 0 || dados.CurrentSaveIndex == _ranhuraVista) return false;
                _ranhuraVista = dados.CurrentSaveIndex;
                foreach (var c in Dcamp.CarregarTodas(Bootstrap.PastaMapas))
                {
                    if (!c.Nos.Any(n => ativos.Contains(n.Id))) continue;
                    Log.Info("partida carregada é da campanha «" + c.NomeVisivel + "»; reabrindo");
                    Abrir(c);
                    try { partida.UnavailableHeroes?.Clear(); } catch { }
                    return true;
                }
            }
            catch (Exception ex) { Log.Info("reconhecendo a campanha da partida: " + ex.Message); }
            return false;
        }

        public static void Fechar()
        {
            _ranhuraVista = int.MinValue;
            if (Aberta == null) return;
            MapaMundi.Limpar();
            Aberta = null; Estado = null; _emCurso = null; _introPendente = null;
        }

        /// <summary>Poe/tira destinos no mapa-mundi e solta a abertura, quando e a vez.</summary>
        public static void Sincronizar()
        {
            if (Aberta == null) return;
            try { MapaMundi.Sincronizar(Aberta, Estado); } catch (Exception ex) { Log.Info("sincronizando o mapa: " + ex.Message); }
            if (_introPendente != null && !Dialogos.QuadroVisivel && !Dialogos.Ocupado)
            {
                var d = Aberta.DialogoPorId(_introPendente);
                _introPendente = null;
                if (d != null) { Log.Info("abertura da campanha: «" + d.Id + "»"); Conversa.Tocar(Aberta, d, null); }
            }
        }

        /// <summary>No mapa-mundi, a cada quadro: a ficha do destino e as tentativas pendentes.</summary>
        public static void Batimento()
        {
            if (Aberta == null) return;
            VisitaACidade();
            MapaMundi.VigiarFicha();
            if (Time.unscaledTime >= _proximaTentativa) { _proximaTentativa = Time.unscaledTime + 1f; Sincronizar(); }
        }

        static string _naCidade;
        /// <summary>Na cidade: as paradas marcadas "city visit" que ja estao disponiveis tocam, uma de cada vez (a seguinte
        /// quando a anterior terminou e nenhum quadro esta aberto).</summary>
        static void VisitaACidade()
        {
            if (Jogo.CenaAtual() != Scene.City) { _naCidade = null; return; }
            if (_naCidade != null) { if (Estado.Completado(_naCidade)) _naCidade = null; else return; }
            if (Dialogos.QuadroVisivel || Dialogos.Ocupado) return;
            var n = Aberta.Nos.FirstOrDefault(x => x.NaCidade && Estado.DeveAparecer(x));
            if (n == null) return;
            _naCidade = n.Id;
            Log.Info("visita à cidade: «" + (n.Nome ?? n.Id) + "»");
            AoPulsarParada(n.Id, false);
        }

        /// <summary>O jogador mandou o grupo a uma parada narrativa (sem mapa): viagem, chegada e conclusao.</summary>
        public static void AoPulsarParada(string id, bool viajar = true)
        {
            var n = Aberta?.NoPorId(id);
            if (n == null) return;
            Log.Info("parada «" + (n.Nome ?? n.Id) + "»");
            if (viajar) { try { Jogo.Partida.CurrentDestinationId = n.Id; } catch { } }
            Action concluir = () => Completar(n);
            Action chegar = () => { var d = Aberta.DialogoPorId(n.AoChegar); if (d != null) Conversa.Tocar(Aberta, d, concluir); else concluir(); };
            var viagem = Aberta.DialogoPorId(n.AoViajar);
            if (viagem != null) Conversa.Tocar(Aberta, viagem, chegar); else chegar();
        }

        /// <summary>O jogo carregou a cena de um destino nosso: montamos o mapa dele por cima.</summary>
        public static void AoEntrarNoEncontro()
        {
            if (Aberta == null || _emCurso != null) return;
            string id = null;
            try { id = Jogo.Partida?.CurrentDestinationId; } catch { }
            if (string.IsNullOrEmpty(id) || !MapaMundi.EhNosso(id)) return;
            var n = Aberta.NoPorId(id);
            if (n == null || !n.EhMapa) return;
            var caminho = Aberta.CaminhoDoMapa(n);
            if (caminho == null) { Log.Info("«" + n.Id + "» aponta para «" + n.Mapa + "», que não está na pasta da campanha"); return; }
            try
            {
                var m = Dmap.Carregar(caminho);
                _emCurso = n;
                var chegada = Aberta.DialogoPorId(n.AoChegar);
                Lancador.Prologo = chegada == null ? null : (Action<Action> )(fim => Conversa.Tocar(Aberta, chegada, fim));
                Log.Info("montando «" + m.NomeVisivel + "» sobre a cena que o jogo carregou (nó " + n.Id + ")");
                Lancador.PrepararSobreCena(m);
            }
            catch (Exception ex) { _emCurso = null; Log.Erro("o mapa «" + n.Mapa + "» não abriu", ex); }
        }

        /// <summary>De volta ao mapa-mundi: vitoria completa o no; derrota deixa-o disponivel.</summary>
        public static void AoVoltarDoEncontro(bool vitoria)
        {
            if (Aberta == null || _emCurso == null) return;
            var n = _emCurso; _emCurso = null;
            if (vitoria) Completar(n);
            else Log.Info("«" + n.Id + "» foi perdido: continua disponível no mapa");
        }

        static void Completar(Dcamp.No n)
        {
            Estado.Completar(n.Id);
            try { Jogo.Partida?.CompletedDestinationIds?.AddUniqueItem(n.Id); Jogo.Partida?.ActiveDestinationIds?.Remove(n.Id); Jogo.Sujo(); } catch { }
            Recompensar(n);
            var d = Aberta.DialogoPorId(n.AoCompletar);
            if (d != null) Conversa.Tocar(Aberta, d, Sincronizar); else Sincronizar();
        }

        public static void CompletarPorAcao(string id) { var n = Aberta?.NoPorId(id); if (n != null && !Estado.Completado(n.Id)) Completar(n); }
        public static void Liberar(string id) { if (Aberta == null) return; Estado.Liberar(id); Sincronizar(); }

        static void Recompensar(Dcamp.No n)
        {
            var p = n.Premios; if (p == null) return;
            foreach (var item in p.Itens) DarItem(item, 1);
            if (p.Materiais > 0) DarMateriais(p.Materiais);
            if (p.Ouro > 0) Motor.Butim.Entregar(new Formato.Dmap.Butim { Modo = "explicit", Ouro = p.Ouro }, "Recompensa");
        }

        public static void DarItem(string id, int quantidade)
        {
            if (string.IsNullOrEmpty(id)) return;
            Motor.Butim.DarItem(id, quantidade, "Recompensa");
        }

        public static void DarMateriais(int n)
        {
            Motor.Butim.DarMateriais(n, "Recompensa");
        }
    }
}
