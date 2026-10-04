using System;
using FFG.Core;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// O jogo fecha um quadro no apertar do botao e trata o soltar como clique no tabuleiro.
    /// Aqui, por meio segundo depois de um quadro nosso fechar, o clique no tabuleiro e engolido.
    /// O jogo guarda so 4 acertos do raio do clique, em ordem qualquer: num canto cheio (um arco na borda entre pecas, com as
    /// pecas das salas por abrir) o nosso objeto pode ficar de fora e o clique se perde. Aqui o raio e refeito com todos os
    /// acertos, do mais perto ao mais longe; se o primeiro clicavel e um objeto nosso, ele recebe o clique.
    /// </summary>
    public static class Cliques
    {
        static InputController.ClickDelegate _nosso;
        static InputController.ClickDelegate _anterior;
        static InputController _onde;

        public static void Instalar()
        {
            var ic = Jogo.Cena?.InputSystem;
            if (ic == null) return;
            if (ReferenceEquals(ic, _onde) && ic.ClickHandler == _nosso) return;
            var anterior = ic.ClickHandler;
            if (anterior == _nosso) anterior = _anterior;
            _anterior = anterior;
            _nosso = (Vector3 pos, bool apertado) =>
            {
                if (Dialogos.RecemFechado) return true; // engole o clique
                if (Menu.Relatos.Aberto && Menu.Relatos.Janela.Contains(new Vector2(pos.x, Screen.height - pos.y))) return true;   // o clique foi na janela de relato
                if (!apertado) { try { if (NossoObjeto(pos)) return true; } catch (Exception ex) { Log.Info("cliques: " + ex.Message); } }
                var a = _anterior;
                return a != null && a(pos, apertado);
            };
            ic.ClickHandler = _nosso;
            _onde = ic;
            Log.Info("cliques: filtro instalado" + (anterior != null ? " (encadeado ao do jogo)" : ""));
        }

        /// <summary>O soltar do botao (o jogo so chama isto quando nao houve arrasto): o clicavel mais perto no raio, se for nosso.</summary>
        static bool NossoObjeto(Vector3 pos)
        {
            var cam = _onde?.InputCamera?.Camera ?? Camera.main;
            if (cam == null) return false;
            int mascara = ~0;
            try { if (SingletonBehaviour<GameSceneController>.IsInitialized) mascara = SingletonBehaviour<GameSceneController>.Instance.GetCurrentCameraCullingMask(); } catch { }
            var acertos = Physics.RaycastAll(cam.ScreenPointToRay(pos), 100f, mascara);
            if (acertos.Length == 0) return false;
            Array.Sort(acertos, (a, b) => a.distance.CompareTo(b.distance));
            foreach (var h in acertos)
            {
                if (h.collider == null) continue;
                var c = h.collider.GetComponentInParent<IClickable>();
                if (c == null) continue;
                if (!(c is Objetos.Clicavel meu)) return false;   // um heroi, um monstro: o jogo cuida
                if (!TemOQueFazer(meu.Posto)) continue;          // decoracao (um arco sem texto nem gatilho): o clique passa
                if (c.Click()) return true;
            }
            return false;
        }

        static bool TemOQueFazer(Objetos.NaMesa p)
        {
            if (p?.Dados == null) return false;
            if (p.Dados.Gemeo >= 0) { var m = Objetos.Pegar(p.Dados.Gemeo); if (m != null && m != p && m.Dados?.Gemeo < 0) return TemOQueFazer(m); }
            return !string.IsNullOrEmpty(p.Dados.Previa) || !string.IsNullOrEmpty(p.Dados.Texto) || Motor.Roteiro.FazAlgoAoUsar(p.Indice);
        }

        public static void Batimento()
        {
            if (!Jogo.EmEncontro || !Tabuleiro.NossaCena) return;
            try { Instalar(); } catch (Exception ex) { Log.Info("cliques: " + ex.Message); }
        }
    }
}
