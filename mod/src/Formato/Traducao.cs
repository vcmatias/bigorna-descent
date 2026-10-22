using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Bigorna.Formato
{
    /// <summary>Mapas e campanhas em varias linguas (editor 0.1.7). O arquivo traz "languages" (a original primeiro) e
    /// "translations": por lingua, o texto como foi exportado e a traducao dele. Ao carregar, o mod escolhe a lingua: a que o
    /// jogador marcou na ficha do mapa (guardada por mapa ou campanha), senao a do jogo quando o mapa a tem, senao a original;
    /// e troca cada texto do arquivo pela traducao, antes de ler o resto (o que nao tem traducao fica no original). Sem
    /// "translations", nada muda. Sem dependencia da Unity (o teste do mod roda fora do jogo).</summary>
    public static class Traducao
    {
        /// <summary>A lingua do jogo, no codigo do acervo ("pt", "en", "cs"...); o mod atualiza.</summary>
        public static string LinguaDoJogo = "en";
        /// <summary>Quem diz a lingua do jogo na hora (o mod liga ao jogo; null: vale LinguaDoJogo).</summary>
        public static Func<string> LinguaDoJogoAgora;
        /// <summary>Onde ficam as escolhas dos jogadores (por mapa ou campanha).</summary>
        public static string ArquivoDeEscolhas;

        static Dictionary<string, string> _escolhas;

        public static string Codigo(string l)
        {
            var k = (l ?? "").Trim().ToLowerInvariant().Replace('_', '-');
            if (k == "cz") return "cs"; if (k == "pt-br") return "pt"; if (k == "zh" || k == "zh-hans") return "zh-cn"; if (k == "zh-hant") return "zh-tw";
            return k;
        }

        /// <summary>O arquivo tem traducoes (o leitor so monta a arvore do JSON quando precisa).</summary>
        public static bool TemTraducoes(string texto) => texto != null && texto.IndexOf("\"translations\"", StringComparison.Ordinal) >= 0;

        /// <summary>As linguas do arquivo: a original primeiro (meta.language), depois as das traducoes.</summary>
        public static List<string> Linguas(JObject j)
        {
            var r = new List<string>();
            void Por(string l) { l = Codigo(l); if (l.Length > 0 && !r.Contains(l)) r.Add(l); }
            Por((string)j?["meta"]?["language"]);
            if (j?["languages"] is JArray ls) foreach (var l in ls) Por((string)l);
            if (j?["translations"] is JObject ts) foreach (var p in ts.Properties()) Por(p.Name);
            return r;
        }

        /// <summary>A chave da escolha: a pasta da campanha (o .dcamp e os mapas dela vao juntos) ou o proprio arquivo.</summary>
        public static string Chave(string caminho)
        {
            if (string.IsNullOrEmpty(caminho)) return "";
            try
            {
                var pasta = Path.GetDirectoryName(caminho);
                if (!string.IsNullOrEmpty(pasta) && Directory.Exists(pasta) && Directory.GetFiles(pasta, "*.dcamp").Length > 0) return Path.GetFullPath(pasta).ToLowerInvariant();
                return Path.GetFullPath(caminho).ToLowerInvariant();
            }
            catch { return caminho.ToLowerInvariant(); }
        }

        static Dictionary<string, string> Escolhas()
        {
            if (_escolhas != null) return _escolhas;
            _escolhas = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try { if (!string.IsNullOrEmpty(ArquivoDeEscolhas) && File.Exists(ArquivoDeEscolhas)) { var d = JsonConvert.DeserializeObject<Dictionary<string, string>>(File.ReadAllText(ArquivoDeEscolhas)); if (d != null) foreach (var kv in d) _escolhas[kv.Key] = kv.Value; } }
            catch (Exception ex) { Log.Info("línguas escolhidas: " + ex.Message); }
            return _escolhas;
        }

        /// <summary>O jogador escolheu a lingua deste mapa (ou campanha) na ficha.</summary>
        public static void Definir(string chave, string lingua)
        {
            if (string.IsNullOrEmpty(chave)) return;
            var e = Escolhas(); e[chave] = Codigo(lingua);
            try { if (!string.IsNullOrEmpty(ArquivoDeEscolhas)) File.WriteAllText(ArquivoDeEscolhas, JsonConvert.SerializeObject(e, Formatting.Indented)); }
            catch (Exception ex) { Log.Info("gravando a língua escolhida: " + ex.Message); }
        }

        /// <summary>A lingua em que o mapa abre: a escolhida, a do jogo, a original (nessa ordem, entre as que ele tem).</summary>
        public static string Escolher(string chave, List<string> linguas)
        {
            if (linguas == null || linguas.Count == 0) return "";
            if (!string.IsNullOrEmpty(chave) && Escolhas().TryGetValue(chave, out var e) && linguas.Contains(Codigo(e))) return Codigo(e);
            string agora = null; try { agora = LinguaDoJogoAgora?.Invoke(); } catch { }
            var j = Codigo(string.IsNullOrEmpty(agora) ? LinguaDoJogo : agora);
            if (linguas.Contains(j)) return j;
            return linguas[0];
        }

        /// <summary>Troca os textos do arquivo pelos da lingua (fora a copia do editor e as proprias tabelas). Devolve quantos.</summary>
        public static int Aplicar(JObject j, string lingua)
        {
            if (j == null || string.IsNullOrEmpty(lingua)) return 0;
            if (!(j["translations"] is JObject ts)) return 0;
            var tab = ts.Properties().FirstOrDefault(p => Codigo(p.Name) == Codigo(lingua))?.Value as JObject;
            if (tab == null) return 0;
            var d = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var p in tab.Properties()) { var v = p.Value.Type == JTokenType.String ? (string)p.Value : null; if (!string.IsNullOrEmpty(v)) d[p.Name] = v; }
            if (d.Count == 0) return 0;
            int n = 0;
            void Anda(JToken t)
            {
                if (t is JObject o) { foreach (var p in o.Properties().ToList()) { if (p.Name == "bigornaSalas" || p.Name == "translations" || p.Name == "languages") continue; Anda(p.Value); } }
                else if (t is JArray a) { foreach (var x in a.ToList()) Anda(x); }
                else if (t is JValue v && v.Type == JTokenType.String) { var s = (string)v.Value; if (s != null && d.TryGetValue(s, out var tr)) { v.Value = tr; n++; } }
            }
            Anda(j);
            return n;
        }
    }
}
