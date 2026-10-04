using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Bigorna.Menu
{
    /// <summary>
    /// O navegador nao grava direto na pasta de mapas do jogo sem que a pessoa escolha a pasta uma vez; sem isso, o editor
    /// baixa os arquivos. Ao abrir a lista de mapas (e ao iniciar o jogo), o mod traz da pasta Downloads do Windows os mapas
    /// (.dmap) e campanhas (.dcamp) feitos pelo editor Bigorna, com os arquivos que eles citam (musica, video, modelos,
    /// imagens), para CustomMaps: a campanha na pasta dela, com os seus mapas. Os arquivos saem de Downloads (movidos).
    /// So entram arquivos do Bigorna (o JSON guarda "bigornaSalas"); o resto de Downloads fica como esta.
    /// </summary>
    public static class RecolhaDosDownloads
    {
        static readonly Regex Copia = new Regex(@"\s\(\d+\)(?=\.[^.]+$)");   // "mapa (1).dmap": a copia baixada de novo
        static readonly string[] Midias = { ".ogg", ".mp3", ".wav", ".mp4", ".webm", ".png", ".jpg", ".jpeg", ".webp", ".glb", ".gltf", ".obj", ".bin" };

        public static string PastaDownloads()
        {
            try
            {
                using (var k = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"))
                {
                    var v = k?.GetValue("{374DE290-123F-4565-9164-39C4925E467B}") as string;
                    if (!string.IsNullOrEmpty(v)) { v = Environment.ExpandEnvironmentVariables(v); if (Directory.Exists(v)) return v; }
                }
            }
            catch { }
            var p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            return Directory.Exists(p) ? p : null;
        }

        /// <summary>Traz os arquivos do Bigorna de Downloads para CustomMaps. Devolve quantos mapas e campanhas vieram.</summary>
        public static int Recolher(string destino)
        {
            var origem = PastaDownloads(); if (origem == null || string.IsNullOrEmpty(destino)) return 0;
            int n = 0;
            try
            {
                Directory.CreateDirectory(destino);
                // (a copia mais nova de cada nome, quando o navegador baixou o mesmo arquivo mais de uma vez)
                var arquivos = Directory.GetFiles(origem).Where(f => f.EndsWith(".dcamp", StringComparison.OrdinalIgnoreCase) || f.EndsWith(".dmap", StringComparison.OrdinalIgnoreCase))
                    .GroupBy(f => Copia.Replace(Path.GetFileName(f), ""), StringComparer.OrdinalIgnoreCase).Select(g => g.OrderByDescending(File.GetLastWriteTimeUtc).ToList()).ToList();
                var usados = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                // campanhas primeiro: levam os seus mapas
                foreach (var g in arquivos.Where(g => g[0].EndsWith(".dcamp", StringComparison.OrdinalIgnoreCase)))
                {
                    var j = Ler(g[0]); if (j == null || (string)j["format"] != "dcamp") continue;
                    var cid = (string)j["meta"]?["id"]; if (string.IsNullOrEmpty(cid)) cid = Path.GetFileNameWithoutExtension(Copia.Replace(Path.GetFileName(g[0]), ""));
                    var pasta = Path.Combine(destino, Limpo(cid)); Directory.CreateDirectory(pasta);
                    Mover(g, Path.Combine(pasta, Copia.Replace(Path.GetFileName(g[0]), "")), usados);
                    foreach (var no in (j["nodes"] as JArray) ?? new JArray())
                    {
                        var m = (string)no["map"]; if (string.IsNullOrEmpty(m)) continue;
                        var dele = arquivos.FirstOrDefault(x => string.Equals(Copia.Replace(Path.GetFileName(x[0]), ""), m, StringComparison.OrdinalIgnoreCase));
                        if (dele == null) continue;
                        var jm = Ler(dele[0]); Mover(dele, Path.Combine(pasta, m), usados);
                        if (jm != null) MoverCitados(jm, origem, pasta, usados);
                    }
                    MoverCitados(j, origem, pasta, usados);
                    Log.Info("recolhida de Downloads a campanha «" + cid + "»"); n++;
                }
                foreach (var g in arquivos.Where(g => g[0].EndsWith(".dmap", StringComparison.OrdinalIgnoreCase)))
                {
                    if (usados.Contains(g[0])) continue;
                    var j = Ler(g[0]); if (j == null || (string)j["format"] != "dmap") continue;
                    var nome = Copia.Replace(Path.GetFileName(g[0]), "");
                    Mover(g, Path.Combine(destino, nome), usados); MoverCitados(j, origem, destino, usados);
                    Log.Info("recolhido de Downloads o mapa «" + nome + "»"); n++;
                }
            }
            catch (Exception ex) { Log.Info("recolhendo de Downloads: " + ex.Message); }
            return n;
        }

        /// <summary>O JSON de um arquivo do Bigorna (null quando e de outro programa).</summary>
        static JObject Ler(string f)
        {
            try { var t = File.ReadAllText(f); if (t.IndexOf("bigornaSalas", StringComparison.Ordinal) < 0) return null; return JObject.Parse(t); }
            catch { return null; }
        }

        static void Mover(List<string> copias, string alvo, HashSet<string> usados)
        {
            var f = copias[0];
            try { if (File.Exists(alvo)) File.Delete(alvo); File.Copy(f, alvo); } catch (Exception ex) { Log.Info("  não copiei " + f + ": " + ex.Message); return; }
            foreach (var c in copias) { usados.Add(c); try { File.Delete(c); } catch { } }
        }

        /// <summary>Os arquivos citados pelo JSON (so nomes, sem pasta) que estao em Downloads: vao junto.</summary>
        static void MoverCitados(JToken j, string origem, string alvo, HashSet<string> usados)
        {
            var nomes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            void Anda(JToken t) { if (t is JValue v && v.Type == JTokenType.String) { var s = (string)v; if (s.Length < 200 && s.IndexOfAny(new[] { '/', '\\', ':' }) < 0 && Midias.Any(e => s.EndsWith(e, StringComparison.OrdinalIgnoreCase))) nomes.Add(s); } else foreach (var c in t.Children()) Anda(c); }
            Anda(j);
            foreach (var nome in nomes)
            {
                var copias = Directory.GetFiles(origem).Where(f => string.Equals(Copia.Replace(Path.GetFileName(f), ""), nome, StringComparison.OrdinalIgnoreCase)).OrderByDescending(File.GetLastWriteTimeUtc).ToList();
                if (copias.Count > 0) Mover(copias, Path.Combine(alvo, nome), usados);
            }
        }

        static string Limpo(string s) { foreach (var c in Path.GetInvalidFileNameChars()) s = s.Replace(c, '_'); return s; }
    }
}
