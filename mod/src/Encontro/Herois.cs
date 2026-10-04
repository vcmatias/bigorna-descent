using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>Escolha do grupo pela tela do proprio jogo e aviso das casas de saida.</summary>
    public static class Herois
    {
        static bool _terminado;

        /// <summary>Campanha: o grupo ja foi escolhido no mapa-mundi do jogo; so cabe respeitar as vagas do mapa.</summary>
        public static void Manter(Dmap m)
        {
            int vagas = Mathf.Clamp(m.Spawns.InicioHerois.Count, 2, 4);
            if (m.Spawns.InicioHerois.Count < 2 && m.Metadados.Herois != null && m.Metadados.Herois.Length > 1) vagas = Mathf.Clamp(m.Metadados.Herois[1], 2, 4);
            Log.Info("grupo: campanha, entra o grupo escolhido no mapa-mundi (" + vagas + " vaga(s))");
            HeroisProprios.DarRunas(); ReceitasProprias.DarIniciais();
            Recortar(vagas);
        }

        public static IEnumerator Escolher(Dmap m)
        {
            int geracao = Lancador.Geracao;
            HeroisProprios.DarRunas();   // antes da escolha: as runas da Oficina aparecem entre as armas
            ReceitasProprias.DarIniciais();
            int vagas = Mathf.Clamp(m.Spawns.InicioHerois.Count, 2, 4);
            if (m.Spawns.InicioHerois.Count < 2 && m.Metadados.Herois != null && m.Metadados.Herois.Length > 1) vagas = Mathf.Clamp(m.Metadados.Herois[1], 2, 4);
            var ui = Jogo.UI;
            var tela = ui?.IntroSequenceHeroSelectDialog;
            var disponiveis = UserCollectionManager.GetHeroes(true)?.ToList();
            if (tela == null || disponiveis == null || disponiveis.Count < 2)
            {
                Log.Info("grupo: sem tela de escolha; entra o grupo já montado");
                Recortar(vagas);
                yield break;
            }
            _terminado = false;
            bool aberto = false;
            try
            {
                var persistente = Jogo.Persistente;
                var pedido = new MessageRequest { Key = "Escolham até " + vagas + " heróis para esta missão.", CallbackContinue = () => { } };
                var cfg = new StoryMessageSettings { BackgroundType = StoryMessageBackgroundType.Camp, CloseOnFinish = true };
                ui.StoryMessageDialog.IsHeroSelect = true;
                persistente.StoryMessages.DisplayMessage(pedido, cfg);
                tela.SyncTo(disponiveis, false, false, AoConfirmar);
                aberto = true;
                Log.Info("grupo: perguntando com quais heróis entrar (" + vagas + " vaga(s), " + disponiveis.Count + " disponíveis)");
            }
            catch (Exception ex) { Log.Info("grupo: não abri a escolha: " + ex.Message); }
            if (!aberto) { Recortar(vagas); yield break; }
            while (!_terminado && geracao == Lancador.Geracao) yield return null;
            if (geracao != Lancador.Geracao) yield break;   // outro preparo comecou (ou o encontro acabou): o grupo nao e mais deste
            float limite = Time.unscaledTime + 5f;
            while (Time.unscaledTime < limite && Jogo.MostrandoMensagem) yield return null;
            if (Jogo.MostrandoMensagem) { Log.Info("grupo: o quadro da escolha não fechou; fecho eu"); Silencio.FecharQuadros(); }
            Recortar(vagas);
        }

        static void AoConfirmar()
        {
            try
            {
                var ui = Jogo.UI;
                ui.StoryMessageDialog.IsHeroSelect = false;
                ui.StoryMessageDialog.OnContinueButtonClicked();
            }
            catch (Exception ex) { Log.Info("grupo: ao fechar a escolha: " + ex.Message); }
            _terminado = true;
        }

        static void Recortar(int vagas)
        {
            try
            {
                var partida = Jogo.Partida;
                if (partida?.ActivePlayers == null) return;
                int sobra = partida.ActivePlayers.Count - vagas;
                for (int i = 0; i < sobra; i++) partida.ActivePlayers.RemoveAt(partida.ActivePlayers.Count - 1);
                if (sobra > 0) Jogo.UI?.HeroMenu?.SyncTo(partida.ActivePlayers);
                Log.Info("grupo: entram " + string.Join(", ", partida.ActivePlayers.Select(h => h?.HeroId ?? "?").ToArray()) + (sobra > 0 ? " (" + sobra + " ficaram de fora: o mapa só tem " + vagas + " vagas)" : ""));
                HeroisProprios.TrocarArmas();
            }
            catch (Exception ex) { Log.Info("grupo: ao ajustar: " + ex.Message); }
        }

        /// <summary>Diz em que casas os herois comecam.</summary>
        public static void AvisarSaida(Dmap m)
        {
            var herois = Jogo.Herois;
            var casas = m.Spawns.InicioHerois;
            if (herois.Count == 0 || casas.Count == 0) return;
            var linhas = new List<string>();
            for (int i = 0; i < herois.Count && i < casas.Count; i++)
            {
                var c = casas[i];
                if (c == null || c.Length < 2) continue;
                linhas.Add(NomeDe(herois[i]) + ": casa " + c[0] + "," + c[1]);
                Log.Info("  saída de " + herois[i].HeroId + ": " + c[0] + "," + c[1]);
            }
            if (linhas.Count == 0) return;
            var inicio = casas.Take(herois.Count).Where(c => c != null && c.Length >= 2).ToList();
            Dialogos.Mensagem("Posições iniciais (casas destacadas):\n" + string.Join("\n", linhas.ToArray()), null, "Heróis", () =>
            {
                try
                {
                    var trs = inicio.Select(c => Tabuleiro.CasaNaGrade(c[0], c[1], c.Length > 2 ? c[2] : 0)).Where(t => t != null).ToList();
                    int n = Motor.Acoes.Destacar(trs);
                    var centro = new Vector3((float)inicio.Average(c => c[0]), 0f, -(float)inicio.Average(c => c[1]));
                    Jogo.Cena?.CameraEncounter?.FocusOn(centro);
                    Log.Info("  início dos heróis: câmera no centro das saídas, " + n + " casa(s) destacadas");
                }
                catch (Exception ex) { Log.Info("  destacando o início dos heróis: " + ex.Message); }
            });
        }

        public static string NomeDe(SerializedPlayer h)
        {
            try
            {
                var m = h?.Model;
                if (m != null)
                {
                    var nome = FFGLocalization.Get(m.KeyName, false);
                    if (!string.IsNullOrEmpty(nome)) return nome;
                    return m.name;
                }
            }
            catch { }
            return h?.HeroId ?? "?";
        }

        public static SerializedPlayer Por(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            return Jogo.Herois.FirstOrDefault(h => string.Equals(h.HeroId, id, StringComparison.OrdinalIgnoreCase));
        }
    }
}
