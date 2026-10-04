using System;
using System.Collections.Generic;
using System.Linq;
using FFG.D3;
using I2.Loc;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// A escolta: um protegido (uma ficha na mesa, com 5 fichas de vida ao lado) que os monstros podem escolher como alvo.
    /// O jogo guarda em cada monstro em jogo um "alvo substituto" (TempTargetOverride, uma chave de texto): a janela de
    /// ativacao mostra esse nome no lugar do heroi. O jogo o apaga depois de cada ativacao; por isso, a cada quadro, os
    /// monstros escolhidos para a rodada que ainda nao ativaram recebem o nome do protegido. Nada muda no modelo do monstro
    /// nem na Oficina: vale so para a figura em jogo, naquela ativacao.
    /// Escolhidos: os "cacadores" (grupos que entram atraidos pelos marcos) sempre; os outros, com uma chance por rodada.
    /// </summary>
    public static class Escolta
    {
        const string Chave = "BIGORNA_ESCOLTA_ALVO";
        public static bool Ativa { get; private set; }
        static string _nome;
        static int _chance;
        static readonly HashSet<string> _cacadores = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, bool> _daRodada = new Dictionary<string, bool>(StringComparer.Ordinal);
        static int _rodada = int.MinValue;

        public static void Reiniciar() { Ativa = false; _nome = null; _chance = 0; _cacadores.Clear(); _daRodada.Clear(); _rodada = int.MinValue; }

        public static void Comecar(string nome, int chance, IEnumerable<string> cacadores)
        {
            Ativa = true; _nome = string.IsNullOrEmpty(nome) ? "o protegido" : nome; _chance = Mathf.Clamp(chance, 0, 100);
            _cacadores.Clear(); foreach (var g in cacadores ?? Enumerable.Empty<string>()) if (!string.IsNullOrEmpty(g)) _cacadores.Add(g);
            _daRodada.Clear();
            Jogo.Termo(Chave, _nome);   // (o nome do protegido, na janela de ativacao)
            Log.Info("escolta: «" + _nome + "» é alvo dos caçadores (" + _cacadores.Count + " grupo(s)) e de " + _chance + "% das outras ativações");
        }

        public static void Parar()
        {
            if (!Ativa) return;
            Ativa = false; _daRodada.Clear();
            // quem ainda tinha o protegido como alvo volta ao heroi sorteado pelo jogo
            try { foreach (var e in Jogo.Inimigos) if (e != null && e.TempTargetOverride == Chave) e.TempTargetOverride = null; } catch { }
            Log.Info("escolta: encerrada");
        }

        public static void Batimento()
        {
            if (!Ativa) return;
            int rodada = Motor.Roteiro.Rodada;
            if (rodada != _rodada) { _rodada = rodada; _daRodada.Clear(); }
            foreach (var e in Jogo.Inimigos)
            {
                if (e == null || e.HasActivated || e.Health <= 0) continue;
                if (!_daRodada.TryGetValue(e.GUID, out var alvo))
                {
                    bool cacador = Inimigos.GrupoDe.TryGetValue(e.GUID, out var g) && _cacadores.Contains(g ?? "");
                    alvo = cacador || UnityEngine.Random.Range(0, 100) < _chance;
                    _daRodada[e.GUID] = alvo;
                    if (alvo) Log.Info("escolta: " + e.ModelId + (cacador ? " (caçador)" : "") + " mira «" + _nome + "» nesta rodada");
                }
                // (uma tatica do proprio jogo que troque o alvo durante a ativacao vale: so preenchemos o campo vazio)
                if (alvo && string.IsNullOrEmpty(e.TempTargetOverride)) e.TempTargetOverride = Chave;
            }
        }
    }
}
