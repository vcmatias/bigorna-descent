using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Bigorna
{
    /// <summary>A lingua do mod (paineis, avisos e mensagens na mesa): sempre a do jogo, nas 13 linguas dele (ingles, espanhol,
    /// frances, alemao, italiano, portugues, polones, hungaro, chines simplificado, tcheco, coreano, russo e chines
    /// tradicional). Antes da tela de titulo vale a lingua do Windows. Cada texto do codigo esta em portugues e ingles,
    /// T(pt, en); as outras linguas saem da tabela IdiomaTabela (gerada por tools/idioma_mod, chaveada pelo ingles), com o
    /// ingles de reserva. Textos montados usam TF(formatoPt, formatoEn, valores) com {0}, {1}... O editor recebe a lingua em
    /// Editor/bigorna-idioma.js (portugues ou ingles, as dele). Os registros (bigorna.log) e os relatos seguem em portugues.</summary>
    public static class Idioma
    {
        public static string ArquivoDoEditor => Path.Combine(Application.persistentDataPath, "Editor", "bigorna-idioma.js");

        /// <summary>Liga quando o jogo chega a tela de titulo. Antes disso, perguntar a lingua ao jogo (FFGLocalization) no
        /// meio do carregamento das traducoes derrubava o jogo na abertura; ate la vale a lingua do Windows.</summary>
        public static bool JogoPronto;
        static string _linguaDoJogo = "en"; static float _consultaAte = -1f;

        /// <summary>As linguas do jogo, no codigo do I2 (minusculas).</summary>
        public static readonly string[] Linguas = { "en", "es", "fr", "de", "it", "pt", "pl", "hu", "zh-cn", "cs", "ko", "ru", "zh-tw" };

        /// <summary>Um codigo de lingua (do jogo, do Windows) entre os do jogo; ingles se nao for um deles.</summary>
        public static string Normalizar(string c)
        {
            c = (c ?? "").Trim().ToLowerInvariant().Replace('_', '-');
            if (c.StartsWith("zh")) return c.Contains("tw") || c.Contains("hk") || c.Contains("hant") ? "zh-tw" : "zh-cn";
            if (c.Length >= 2) { var b = c.Substring(0, 2); foreach (var l in Linguas) if (l == b) return l; }
            return "en";
        }

        static string DoWindows()
        {
            switch (Application.systemLanguage)
            {
                case SystemLanguage.Portuguese: return "pt"; case SystemLanguage.Spanish: return "es"; case SystemLanguage.French: return "fr";
                case SystemLanguage.German: return "de"; case SystemLanguage.Italian: return "it"; case SystemLanguage.Polish: return "pl";
                case SystemLanguage.Hungarian: return "hu"; case SystemLanguage.Czech: return "cs"; case SystemLanguage.Korean: return "ko";
                case SystemLanguage.Russian: return "ru"; case SystemLanguage.ChineseTraditional: return "zh-tw";
                case SystemLanguage.Chinese: case SystemLanguage.ChineseSimplified: return "zh-cn";
                default: return "en";
            }
        }

        /// <summary>A lingua do mod agora: a do jogo (pode mudar no menu dele; relida a cada 2 s: o OnGUI pergunta varias vezes
        /// por quadro).</summary>
        public static string Codigo
        {
            get
            {
                if (!JogoPronto) return DoWindows();
                if (Time.unscaledTime >= _consultaAte)
                {
                    var c = Normalizar(Dados.DadosDoEditor.LinguaDoJogo()); _consultaAte = Time.unscaledTime + 2f;
                    if (c != _linguaDoJogo) { _linguaDoJogo = c; Log.Info("língua do mod: " + c + " (a do jogo)"); GravarParaOEditor(); }
                }
                return _linguaDoJogo;
            }
        }

        /// <summary>O mod esta em portugues.</summary>
        public static bool Pt => Codigo == "pt";

        /// <summary>O texto na lingua do mod.</summary>
        public static string T(string pt, string en)
        {
            var c = Codigo;
            if (c == "pt") return pt;
            if (c == "en" || string.IsNullOrEmpty(en)) return en;
            return IdiomaTabela.Buscar(en, c) ?? en;
        }

        /// <summary>Um texto montado: os formatos (com {0}, {1}...) na lingua do mod, preenchidos com os valores.</summary>
        public static string TF(string pt, string en, params object[] valores)
        {
            try { return string.Format(T(pt, en), valores); }
            catch (FormatException) { try { return string.Format(en, valores); } catch { return en; } }
        }

        /// <summary>Um dicionario de nomes (id → nome) na lingua do mod: o portugues, o ingles, ou o ingles traduzido.</summary>
        static readonly Dictionary<object, Dictionary<string, string>> _dics = new Dictionary<object, Dictionary<string, string>>();
        public static Dictionary<string, string> Dicionario(Dictionary<string, string> pt, Dictionary<string, string> en)
        {
            var c = Codigo; if (c == "pt") return pt; if (c == "en") return en;
            var chave = en.GetHashCode() + ":" + c;
            if (!_dics.TryGetValue(chave, out var d))
            {
                d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var kv in en) d[kv.Key] = T(pt.TryGetValue(kv.Key, out var p) ? p : kv.Value, kv.Value);
                _dics[chave] = d;
            }
            return d;
        }

        /// <summary>A data (e a hora) no jeito da lingua do mod.</summary>
        public static string Data(DateTime d) => d.ToString(FormatoData);
        public static string DataHora(DateTime d) => d.ToString(FormatoData + " HH:mm");
        static string FormatoData
        {
            get
            {
                switch (Codigo)
                {
                    case "pt": case "es": case "fr": case "it": return "dd/MM/yyyy";
                    case "de": case "pl": case "cs": case "ru": return "dd.MM.yyyy";
                    case "hu": return "yyyy.MM.dd.";
                    default: return "yyyy-MM-dd";
                }
            }
        }

        /// <summary>A lingua para o editor, ao lado dele (o editor carrega esse arquivo antes dos dados): portugues ou ingles,
        /// as linguas dele.</summary>
        public static void GravarParaOEditor()
        {
            try
            {
                var conteudo = "window.BIGORNA_IDIOMA = \"" + (Codigo == "pt" ? "pt" : "en") + "\";\n";
                Directory.CreateDirectory(Path.GetDirectoryName(ArquivoDoEditor));
                if (File.Exists(ArquivoDoEditor) && File.ReadAllText(ArquivoDoEditor) == conteudo) return;
                File.WriteAllText(ArquivoDoEditor, conteudo);
            }
            catch (Exception ex) { Log.Erro("gravando " + ArquivoDoEditor, ex); }
        }
    }
}
