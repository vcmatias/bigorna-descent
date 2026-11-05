using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Bigorna.Formato
{
    /// <summary>v270: os arquivos do Bigorna com nome, pasta e assinatura próprios, para não se confundirem com os do DescentForge
    /// (outro mod, com editor próprio e formato parecido): mapas .bmap e campanhas .bcamp na pasta Bigorna\Mapas, com
    /// "app": "bigorna" no começo do arquivo. Os .dmap e .dcamp antigos do Bigorna (reconhecidos pela marca do editor) continuam
    /// abrindo, lidos também da pasta antiga (CustomMaps), onde ficam como estão.</summary>
    public static class Arquivos
    {
        public const string Mapa = ".bmap", Campanha = ".bcamp", MapaAntigo = ".dmap", CampanhaAntiga = ".dcamp";
        public const string Assinatura = "bigorna";

        static bool Termina(string c, string e) => c != null && c.EndsWith(e, StringComparison.OrdinalIgnoreCase);
        public static bool EhMapa(string c) => Termina(c, Mapa) || Termina(c, MapaAntigo);
        public static bool EhCampanha(string c) => Termina(c, Campanha) || Termina(c, CampanhaAntiga);
        public static bool EhDoBigornaPeloNome(string c) => Termina(c, Mapa) || Termina(c, Campanha);

        /// <summary>O mesmo arquivo na outra forma do nome: x.dmap ↔ x.bmap, x.dcamp ↔ x.bcamp (uma campanha antiga cita os mapas
        /// pelo nome antigo).</summary>
        public static string NaOutraForma(string c)
        {
            if (Termina(c, MapaAntigo)) return c.Substring(0, c.Length - MapaAntigo.Length) + Mapa;
            if (Termina(c, Mapa)) return c.Substring(0, c.Length - Mapa.Length) + MapaAntigo;
            if (Termina(c, CampanhaAntiga)) return c.Substring(0, c.Length - CampanhaAntiga.Length) + Campanha;
            if (Termina(c, Campanha)) return c.Substring(0, c.Length - Campanha.Length) + CampanhaAntiga;
            return c;
        }
        /// <summary>O nome novo de um arquivo antigo (x.dmap → x.bmap); um nome novo fica.</summary>
        public static string NomeNovo(string c) => Termina(c, MapaAntigo) || Termina(c, CampanhaAntiga) ? NaOutraForma(c) : c;

        /// <summary>O arquivo que existe, com o nome dado ou na outra forma; null se nenhum.</summary>
        public static string Existente(string c)
        {
            if (string.IsNullOrEmpty(c)) return null;
            if (File.Exists(c)) return c;
            var o = NaOutraForma(c); return o != c && File.Exists(o) ? o : null;
        }

        /// <summary>Os arquivos de uma pasta (só ela): os novos e os antigos, sem dobrar o mesmo (x.bmap vence x.dmap).</summary>
        static List<string> DaPasta(string pasta, string novo, string antigo)
        {
            if (!Directory.Exists(pasta)) return new List<string>();
            var novos = Directory.GetFiles(pasta, "*" + novo).Where(f => Termina(f, novo)).ToList();
            var ja = new HashSet<string>(novos.Select(f => Path.GetFileNameWithoutExtension(f)), StringComparer.OrdinalIgnoreCase);
            return novos.Concat(Directory.GetFiles(pasta, "*" + antigo).Where(f => Termina(f, antigo) && !ja.Contains(Path.GetFileNameWithoutExtension(f)))).OrderBy(x => x, StringComparer.OrdinalIgnoreCase).ToList();
        }
        public static List<string> Mapas(string pasta) => DaPasta(pasta, Mapa, MapaAntigo);
        public static List<string> Campanhas(string pasta) => DaPasta(pasta, Campanha, CampanhaAntiga);

        /// <summary>Um documento do Bigorna: a assinatura, ou (os de antes dela) a marca do editor, a cópia do editor ou a ficha
        /// que só o Bigorna escreve.</summary>
        public static bool DoBigorna(JObject j)
        {
            if (j == null) return false;
            if (string.Equals((string)j["app"], Assinatura, StringComparison.OrdinalIgnoreCase)) return true;
            var ed = (string)(j["meta"] as JObject)?["editor"];
            if (!string.IsNullOrEmpty(ed) && ed.StartsWith("bigorna", StringComparison.OrdinalIgnoreCase)) return true;
            return j["bigornaSalas"] != null || j["ficha"] != null;
        }

        /// <summary>O mesmo, lendo do arquivo só o que precisa (a cabeça e, se preciso, o resto).</summary>
        public static bool DoBigorna(string caminho)
        {
            if (EhDoBigornaPeloNome(caminho)) return true;
            try { var h = LerInteiro(caminho); return DoBigorna(h); } catch { return false; }
        }

        static JObject LerInteiro(string caminho)
        {
            using (var sr = new StreamReader(caminho, Encoding.UTF8))
            using (var r = new JsonTextReader(sr) { DateParseHandling = DateParseHandling.None })
                return JObject.Load(r);
        }

        /// <summary>O texto do documento com a assinatura logo depois de "format" e "version" (a ficha continua no começo).</summary>
        public static string ComAssinatura(JObject j)
        {
            if (j == null) return null;
            if (!string.Equals((string)j["app"], Assinatura, StringComparison.Ordinal))
            {
                j.Remove("app");
                var depois = (JProperty)(j.Property("version") ?? j.Property("format"));
                if (depois != null) depois.AddAfterSelf(new JProperty("app", Assinatura)); else j.AddFirst(new JProperty("app", Assinatura));
            }
            return j.ToString(Formatting.None);
        }
    }
}
