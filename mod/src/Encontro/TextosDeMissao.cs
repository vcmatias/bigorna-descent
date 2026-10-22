using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Dados;
using FFG.D3;
using I2.Loc;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Os nomes e as regras de defesa dos monstros proprios de uma missao oficial (o Xenith da missao 14, o Ne'Krul da 12,
    /// os bandidos da 7...) ficam na fonte de textos daquela missao (qloc/...), que o jogo so carrega dentro dela. Num mapa
    /// do Bigorna o jogo mostrava a chave (Q14_XENITH_NAME, Q14_DEFEND_XENITH) e o aviso de entrada mostrava o nome interno
    /// do modelo. Aqui as fontes de missao sao lidas direto dos arquivos do jogo (numa thread, uma vez por sessao), em todas
    /// as linguas, e as chaves que faltam na fonte principal sao repostas antes de os monstros entrarem.
    /// </summary>
    public static class TextosDeMissao
    {
        static Dictionary<string, Dictionary<string, string>> _termos;
        static System.Threading.Thread _leitura;
        static readonly HashSet<string> _repostas = new HashSet<string>(StringComparer.Ordinal);

        public static bool Pronto => _termos != null;
        public static int Lidos => _termos?.Count ?? 0;

        /// <summary>As chaves de texto de um modelo de monstro (nome, plural, descricao, defesa).</summary>
        public static IEnumerable<string> ChavesDe(EnemyModel m)
        {
            if (m == null) yield break;
            foreach (var k in new[] { m.KeyNameSingular, m.KeyNamePlural, m.KeyNameDescription, m.DefensiveKey })
                if (!string.IsNullOrEmpty(k)) yield return k;
        }

        /// <summary>Comeca a ler as fontes de missao (so as chaves dos monstros da colecao). Chamar de novo nao rele.</summary>
        public static void Comecar()
        {
            if (_termos != null || _leitura != null) return;
            var chaves = new HashSet<string>(StringComparer.Ordinal);
            try { foreach (var e in UserCollectionManager.GetEnemies(false) ?? new List<EnemyModel>()) foreach (var k in ChavesDe(e)) chaves.Add(k); }
            catch (Exception ex) { Log.Info("textos das missões: a coleção não respondeu (" + ex.Message + "); leio todos os termos"); chaves = null; }
            var pasta = DadosDoEditor.PastaBundles;
            _leitura = new System.Threading.Thread(() =>
            {
                Dictionary<string, Dictionary<string, string>> r = null;
                try { r = TextosDoJogo.TermosDasFontes(BundlesDoJogo.Abrir(pasta), chaves, m => Log.Info("textos das missões: " + m)); }
                catch (Exception ex) { Log.Info("textos das missões: não li as fontes (" + ex.Message + ")"); }
                _termos = r ?? new Dictionary<string, Dictionary<string, string>>();
            }) { IsBackground = true };
            _leitura.Start();
        }

        /// <summary>Espera a leitura acabar (no maximo tantos segundos).</summary>
        public static IEnumerator Esperar(float segundos)
        {
            Comecar();
            float limite = Time.unscaledTime + segundos;
            while (_termos == null && Time.unscaledTime < limite) yield return null;
            if (_termos == null) Log.Info("textos das missões: a leitura passou de " + segundos + " s; sigo sem ela");
        }

        /// <summary>O jogo nao tem o texto dessa chave agora (devolve nada ou a propria chave).</summary>
        public static bool Falta(string chave)
        {
            if (string.IsNullOrEmpty(chave)) return false;
            try { var t = FFGLocalization.Get(chave, false); return string.IsNullOrEmpty(t) || t == chave; }
            catch { return true; }
        }

        /// <summary>Repoe as chaves que faltam de um modelo de monstro. Devolve quantas repos.</summary>
        public static int Repor(EnemyModel m)
        {
            int n = 0;
            if (_termos == null || m == null) return 0;
            foreach (var k in ChavesDe(m))
                if (Falta(k) && _termos.TryGetValue(k, out var por) && Escrever(k, por)) n++;
            // um nome que nenhum arquivo de textos do jogo traz: 11 modelos da colecao (Ne'Krul e Espectro da missao 12, Xenith
            // da 13, Igor e Eremita da 4, Necromante, Golem e Lobo da secundaria 2...) que nenhuma das 27 missoes oficiais poe
            // em jogo (as missoes usam outros modelos para esses personagens) e que nao entram ao acaso. Fica o nome do
            // modelo, sem o prefixo da missao ("Q12 Ne'Krul 1" -> "Ne'Krul 1"), em vez da chave
            foreach (var k in new[] { m.KeyNameSingular, m.KeyNamePlural })
                if (Falta(k) && !_termos.ContainsKey(k) && Escrever(k, new Dictionary<string, string> { ["en"] = TextosDoJogo.NomeSemMissao(m.name) })) n++;
            return n;
        }

        /// <summary>Repoe as chaves que faltam de todos os monstros da colecao (e dos que vierem depois, na entrada).</summary>
        public static void ReporTodos()
        {
            if (_termos == null) return;
            int n = 0, modelos = 0;
            try
            {
                foreach (var e in UserCollectionManager.GetEnemies(false) ?? new List<EnemyModel>())
                {
                    int r = Repor(e); n += r; if (r > 0) modelos++;
                }
            }
            catch (Exception ex) { Log.Info("textos das missões: " + ex.Message); }
            if (n > 0) Log.Info("textos das missões: " + n + " chave(s) repostas, de " + modelos + " monstro(s) (" + string.Join(", ", _repostas.Take(12)) + (_repostas.Count > 12 ? "…" : "") + ")");
        }

        static bool Escrever(string chave, Dictionary<string, string> por)
        {
            try
            {
                var fonte = LocalizationManager.Sources.FirstOrDefault(); if (fonte == null) return false;
                var t = fonte.AddTerm(chave, eTermType.Text, false);
                for (int i = 0; i < t.Languages.Length; i++)
                    t.Languages[i] = TextosDoJogo.Escolher(i < fonte.mLanguages.Count ? fonte.mLanguages[i].Code : "", por);
                _repostas.Add(chave);
                return true;
            }
            catch (Exception ex) { Log.Info("textos das missões: «" + chave + "»: " + ex.Message); return false; }
        }
    }
}
