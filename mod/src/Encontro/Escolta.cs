using System;
using System.Collections.Generic;
using System.Linq;
using FFG.D3;
using I2.Loc;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Os protegidos: uma ficha na mesa (um guia, um mercenario) que os monstros podem escolher como alvo. O jogo guarda em
    /// cada monstro em jogo um "alvo substituto" (TempTargetOverride, uma chave de texto): a janela de ativacao mostra esse
    /// nome no lugar do heroi. O jogo o apaga depois de cada ativacao; por isso, a cada quadro, os monstros escolhidos para a
    /// rodada que ainda nao ativaram recebem o nome do protegido. Nada muda no modelo do monstro nem na Oficina: vale so
    /// para a figura em jogo, naquela ativacao.
    /// Regras (acao "targetProtected" do gatilho "Mudar condicoes dos monstros"): um nome, uma chance por rodada e um grupo
    /// de surgimento (ou todos os monstros). As de um grupo vem antes das gerais. "targetProtectedEnd" desfaz as de um nome.
    /// A acao antiga "escort" (mapas antigos) vira as mesmas regras: os cacadores sempre, os outros pela chance.
    /// </summary>
    public static class Escolta
    {
        sealed class Regra { public string Nome, Chave, Grupo; public int Chance; }
        static readonly List<Regra> _regras = new List<Regra>();
        static readonly Dictionary<string, string> _chaves = new Dictionary<string, string>(StringComparer.Ordinal);
        static readonly Dictionary<string, string> _daRodada = new Dictionary<string, string>(StringComparer.Ordinal);
        static int _rodada = int.MinValue;

        public static bool Ativa => _regras.Count > 0;

        public static void Reiniciar() { _regras.Clear(); _chaves.Clear(); _daRodada.Clear(); _rodada = int.MinValue; }

        static string NomeDe(string nome) => string.IsNullOrEmpty(nome) ? Idioma.T("o protegido", "the protected one") : nome;

        static string ChaveDe(string nome)
        {
            if (_chaves.TryGetValue(nome, out var c)) return c;
            c = "BIGORNA_ALVO_" + _chaves.Count; _chaves[nome] = c;
            Jogo.Termo(c, nome);   // (o nome do protegido, na janela de ativacao)
            return c;
        }

        /// <summary>Os monstros do grupo (ou todos, com grupo vazio) passam a escolher o protegido, cada um com a chance
        /// por rodada (100: sempre). A mesma regra de novo troca a chance.</summary>
        public static void Mirar(string nome, int chance, string grupo)
        {
            nome = NomeDe(nome); grupo = string.IsNullOrEmpty(grupo) ? null : grupo;
            _regras.RemoveAll(r => r.Nome == nome && r.Grupo == grupo);
            var regra = new Regra { Nome = nome, Chave = ChaveDe(nome), Grupo = grupo, Chance = Mathf.Clamp(chance, 0, 100) };
            if (grupo != null) _regras.Insert(0, regra); else _regras.Add(regra);
            // (quem ja foi sorteado nesta rodada sem alvo pode ser sorteado de novo)
            foreach (var k in _daRodada.Where(kv => kv.Value == "").Select(kv => kv.Key).ToList()) _daRodada.Remove(k);
            Log.Info("alvo: «" + nome + "» para " + (grupo != null ? "o grupo " + grupo : "todos os monstros") + " (" + regra.Chance + "% por rodada)");
        }

        /// <summary>Os monstros param de escolher o protegido (todos os protegidos, com nome vazio).</summary>
        public static void PararDe(string nome)
        {
            var sai = _regras.Where(r => string.IsNullOrEmpty(nome) || r.Nome == nome).ToList(); if (sai.Count == 0) return;
            var chaves = new HashSet<string>(sai.Select(r => r.Chave));
            _regras.RemoveAll(r => sai.Contains(r));
            // quem ainda tinha o protegido como alvo volta ao heroi sorteado pelo jogo
            try { foreach (var e in Jogo.Inimigos) if (e != null && e.TempTargetOverride != null && chaves.Contains(e.TempTargetOverride)) e.TempTargetOverride = null; } catch { }
            foreach (var k in _daRodada.Where(kv => chaves.Contains(kv.Value)).Select(kv => kv.Key).ToList()) _daRodada.Remove(k);
            Log.Info("alvo: «" + (string.IsNullOrEmpty(nome) ? "todos" : nome) + "» deixa de ser alvo");
        }

        // a acao antiga "escort"
        public static void Comecar(string nome, int chance, IEnumerable<string> cacadores)
        {
            foreach (var g in cacadores ?? Enumerable.Empty<string>()) if (!string.IsNullOrEmpty(g)) Mirar(nome, 100, g);
            Mirar(nome, chance, null);
        }
        public static void Parar() => PararDe(null);

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
                    Inimigos.GrupoDe.TryGetValue(e.GUID, out var g); alvo = "";
                    foreach (var r in _regras)
                    {
                        if (r.Grupo != null && !string.Equals(r.Grupo, g, StringComparison.OrdinalIgnoreCase)) continue;
                        if (r.Chance >= 100 || UnityEngine.Random.Range(0, 100) < r.Chance) { alvo = r.Chave; Log.Info("alvo: " + e.ModelId + " mira «" + r.Nome + "» nesta rodada"); break; }
                    }
                    _daRodada[e.GUID] = alvo;
                }
                // (uma tatica do proprio jogo que troque o alvo durante a ativacao vale: so preenchemos o campo vazio)
                if (alvo != "" && string.IsNullOrEmpty(e.TempTargetOverride)) e.TempTargetOverride = alvo;
            }
        }
    }
}
