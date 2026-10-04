using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Bigorna.Dados.Unity;
using Newtonsoft.Json.Linq;

namespace Bigorna.Dados
{
    /// <summary>
    /// Os bundles do jogo lidos direto do disco (StreamingAssets/bundles), sem o carregador do jogo: o manifest.dat diz
    /// o arquivo de cada bundle. Codigo puro (sem Unity), para rodar numa thread e para testar fora do jogo.
    /// </summary>
    public sealed class BundlesDoJogo
    {
        public string Pasta { get; private set; }
        readonly Dictionary<string, string> _arquivos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        public IEnumerable<string> Nomes => _arquivos.Keys;
        public bool Tem(string nome) => nome != null && _arquivos.ContainsKey(nome);

        public static BundlesDoJogo Abrir(string pasta)
        {
            var b = new BundlesDoJogo { Pasta = pasta };
            var man = JObject.Parse(File.ReadAllText(Path.Combine(pasta, "manifest.dat")));
            foreach (var x in (man["bundleInfos"] as JArray) ?? new JArray())
            {
                var n = (string)x["name"]; var f = (string)x["filename"];
                if (!string.IsNullOrEmpty(n) && !string.IsNullOrEmpty(f) && File.Exists(Path.Combine(pasta, f))) b._arquivos[n] = f;
            }
            return b;
        }

        public string Caminho(string nome) => _arquivos.TryGetValue(nome ?? "", out var f) ? Path.Combine(Pasta, f) : null;
        public Pacote Pacote(string nome) => _arquivos.TryGetValue(nome ?? "", out var f) ? Unity.Pacote.Abrir(Path.Combine(Pasta, f)) : null;
    }

    /// <summary>
    /// Os textos do jogo por chave, em ingles e na lingua escolhida: os CSV de loc/en e loc/&lt;lingua&gt;, e os
    /// LanguageSourceAsset das missoes (qloc/*) e do bundle "localization" (nomes proprios de cada missao, como
    /// SQ2_NECROMANCER_NAME, que nao estao nos CSV).
    /// </summary>
    public sealed class TextosDoJogo
    {
        public string Lingua { get; private set; } = "en";
        public readonly Dictionary<string, string> En = new Dictionary<string, string>();
        public readonly Dictionary<string, string> Local = new Dictionary<string, string>();
        /// <summary>As chaves de cada fonte de missao (qloc/...), para cada resumo de missao levar so as suas.</summary>
        public readonly Dictionary<string, List<string>> ChavesDaFonte = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        /// <summary>O texto na lingua do jogo; sem ele, em ingles; sem nenhum, null.</summary>
        public string Texto(string k)
        {
            if (k == null) return null;
            if (Local.TryGetValue(k, out var v) && !string.IsNullOrEmpty(v)) return v;
            return En.TryGetValue(k, out var e) && !string.IsNullOrEmpty(e) ? e : null;
        }

        public static TextosDoJogo Ler(BundlesDoJogo b, string lingua, Action<string> log = null)
        {
            var t = new TextosDoJogo { Lingua = string.IsNullOrEmpty(lingua) ? "en" : lingua.ToLowerInvariant() };
            t.LerCsv(b, "loc/en", t.En, log);
            if (t.Lingua != "en") t.LerCsv(b, "loc/" + t.Lingua, t.Local, log);
            foreach (var n in b.Nomes.Where(n => n.StartsWith("qloc/", StringComparison.OrdinalIgnoreCase) || n.Equals("localization", StringComparison.OrdinalIgnoreCase)).OrderBy(n => n, StringComparer.Ordinal).ToList())
            {
                try { t.LerFontes(b, n); }
                catch (Exception ex) { log?.Invoke("textos de " + n + ": " + ex.Message); }
            }
            return t;
        }

        void LerCsv(BundlesDoJogo b, string bundle, Dictionary<string, string> dest, Action<string> log)
        {
            Pacote p;
            try { p = b.Pacote(bundle); }
            catch (Exception ex) { log?.Invoke(bundle + ": " + ex.Message); return; }
            if (p == null) { log?.Invoke(bundle + ": não há esse bundle"); return; }
            foreach (var o in p.Objetos)
            {
                if (o.Tipo != "TextAsset") continue;
                string texto;
                try
                {
                    var s = o.Ler()["m_Script"];
                    texto = s is string ss ? ss : s is byte[] bb ? Encoding.UTF8.GetString(bb) : null;
                }
                catch { continue; }
                if (texto == null) continue;
                foreach (var l in Csv(texto))
                    if (l.Count >= 4 && l[0].Length > 0 && l[0] != "Key" && !string.IsNullOrEmpty(l[3])) dest[l[0]] = l[3];
            }
        }

        void LerFontes(BundlesDoJogo b, string bundle)
        {
            var p = b.Pacote(bundle); if (p == null) return;
            foreach (var o in p.Objetos)
            {
                if (o.Tipo != "MonoBehaviour") continue;
                Dictionary<string, object> d;
                if (!o.TentarLer(out d) || !(d.TryGetValue("mSource", out var so) && so is Dictionary<string, object> src)) continue;
                var codigos = (src.TryGetValue("mLanguages", out var ml) ? ml as List<object> : null)?.Select(x => ((x as Dictionary<string, object>)?["Code"] as string ?? "").ToLowerInvariant()).ToList() ?? new List<string>();
                int iEn = codigos.IndexOf("en"), iL = codigos.IndexOf(Lingua);
                if (iEn < 0) iEn = 0;
                var chaves = new List<string>();
                foreach (var x in (src.TryGetValue("mTerms", out var mt) ? mt as List<object> : null) ?? new List<object>())
                {
                    if (!(x is Dictionary<string, object> term) || !(term["Term"] is string k) || k.Length == 0) continue;
                    var ls = term.TryGetValue("Languages", out var lv) ? lv as List<object> : null;
                    string Em(int i) => ls != null && i >= 0 && i < ls.Count ? ls[i] as string : null;
                    var en = Em(iEn); var lo = Em(iL);
                    if (!string.IsNullOrEmpty(en) && !En.ContainsKey(k)) En[k] = en;
                    if (!string.IsNullOrEmpty(lo) && Lingua != "en" && !Local.ContainsKey(k)) Local[k] = lo;
                    chaves.Add(k);
                }
                if (bundle.StartsWith("qloc/", StringComparison.OrdinalIgnoreCase))
                {
                    if (!ChavesDaFonte.TryGetValue(bundle, out var l)) ChavesDaFonte[bundle] = l = new List<string>();
                    l.AddRange(chaves);
                }
            }
        }

        /// <summary>CSV com aspas (campos com virgula, aspas dobradas e quebras de linha).</summary>
        public static IEnumerable<List<string>> Csv(string texto)
        {
            var linha = new List<string>(); var campo = new StringBuilder(); bool aspas = false;
            for (int i = 0; i < texto.Length; i++)
            {
                char c = texto[i];
                if (aspas)
                {
                    if (c == '"') { if (i + 1 < texto.Length && texto[i + 1] == '"') { campo.Append('"'); i++; } else aspas = false; }
                    else campo.Append(c);
                }
                else if (c == '"') aspas = true;
                else if (c == ',') { linha.Add(campo.ToString()); campo.Clear(); }
                else if (c == '\n' || c == '\r')
                {
                    if (c == '\r' && i + 1 < texto.Length && texto[i + 1] == '\n') i++;
                    linha.Add(campo.ToString()); campo.Clear(); yield return linha; linha = new List<string>();
                }
                else campo.Append(c);
            }
            if (campo.Length > 0 || linha.Count > 0) { linha.Add(campo.ToString()); yield return linha; }
        }
    }
}
