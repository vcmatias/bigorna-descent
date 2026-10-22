using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Bigorna.Acervo
{
    // A parte do acervo que nao depende do jogo (testada fora dele): a ficha, o zip, a verificacao, instalar e remover, o
    // registro do que o acervo instalou e a juncao dos pacotes exigidos ao "custom" de um mapa. Formato em acervo/FORMATO.md.

    /// <summary>Os textos de erro do nucleo (a ficha da tela mostra a razao) na lingua do mod: o mod liga Escolher a
    /// Idioma.T; fora do jogo (nos testes, que compilam este arquivo sozinho), portugues.</summary>
    public static class LinguaDosErros
    {
        public static Func<string, string, string> Escolher = (pt, en) => pt;
        public static string T(string pt, string en) => Escolher(pt, en);
    }

    /// <summary>Um pacote que um mapa exige (na ficha: id, edicao, nome; no .dmap: id, edition, name).</summary>
    public class Requisito
    {
        [JsonProperty("id")] public string Id;
        [JsonProperty("edicao")] public int Edicao = 1;
        [JsonProperty("nome")] public string Nome;

        public static List<Requisito> DoMapa(JToken requires)
        {
            var r = new List<Requisito>();
            if (!(requires is JArray a)) return r;
            foreach (var x in a.OfType<JObject>())
            {
                var id = (string)x["id"]; if (!Ficha.IdValido(id)) continue;
                r.Add(new Requisito { Id = id, Edicao = Math.Max(1, (int?)x["edition"] ?? (int?)x["edicao"] ?? 1), Nome = (string)x["name"] ?? (string)x["nome"] ?? id });
            }
            return r;
        }
    }

    public class Ficha
    {
        [JsonProperty("formato")] public string Formato;
        [JsonProperty("versao")] public int Versao;
        [JsonProperty("id")] public string Id;
        [JsonProperty("tipo")] public string Tipo;
        [JsonProperty("nome")] public string Nome;
        [JsonProperty("autor")] public string Autor;
        [JsonProperty("resumo")] public string Resumo;
        [JsonProperty("lingua")] public string Lingua;
        [JsonProperty("ato")] public int Ato = 1;
        [JsonProperty("edicao")] public int Edicao = 1;
        [JsonProperty("requer")] public List<Requisito> Requer = new List<Requisito>();
        [JsonProperty("conteudo")] public JObject Conteudo;
        [JsonProperty("data")] public string Data;
        [JsonProperty("publicado")] public string Publicado;
        [JsonProperty("url")] public string Url;
        [JsonProperty("tamanho")] public long Tamanho;
        [JsonProperty("sha256")] public string Sha256;

        static readonly Regex Id_ = new Regex("^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$");
        public static bool IdValido(string id) => !string.IsNullOrEmpty(id) && Id_.IsMatch(id);
        public bool EhPacote => Tipo == "pacote";
        public bool EhMapa => Tipo == "mapa" || Tipo == "campanha";

        public static List<Ficha> DoIndice(string json)
        {
            var j = Pacotes.LerJson(json);
            if ((string)j["formato"] != "bigorna-acervo-indice") throw new Exception(LinguaDosErros.T("o índice do acervo não é do Bigorna", "the community library index is not a Bigorna one"));
            var r = new List<Ficha>();
            foreach (var x in (j["itens"] as JArray ?? new JArray()).OfType<JObject>())
            {
                try
                {
                    var f = x.ToObject<Ficha>();
                    if (f == null || !IdValido(f.Id) || (f.Tipo != "mapa" && f.Tipo != "campanha" && f.Tipo != "pacote") || string.IsNullOrEmpty(f.Url)) continue;
                    f.Requer = (f.Requer ?? new List<Requisito>()).Where(q => q != null && IdValido(q.Id)).ToList();
                    f.Edicao = Math.Max(1, f.Edicao);
                    r.Add(f);
                }
                catch { }
            }
            return r;
        }
    }

    public static class Zip
    {
        public class Entrada { public string Nome; public byte[] Dados; }

        /// <summary>As entradas de um .zip, pelo diretorio central (guardadas ou comprimidas com deflate); as pastas ficam de fora.</summary>
        public static List<Entrada> Ler(byte[] z)
        {
            var r = new List<Entrada>();
            int fim = -1;
            for (int i = z.Length - 22; i >= Math.Max(0, z.Length - 65557); i--) if (BitConverter.ToUInt32(z, i) == 0x06054b50) { fim = i; break; }
            if (fim < 0) throw new Exception(LinguaDosErros.T("zip sem diretório central", "zip without a central directory"));
            int n = BitConverter.ToUInt16(z, fim + 10); int p = (int)BitConverter.ToUInt32(z, fim + 16);
            for (int k = 0; k < n; k++)
            {
                if (p + 46 > z.Length || BitConverter.ToUInt32(z, p) != 0x02014b50) throw new Exception(LinguaDosErros.T("zip danificado", "damaged zip"));
                int metodo = BitConverter.ToUInt16(z, p + 10); int comp = (int)BitConverter.ToUInt32(z, p + 20); int tam = (int)BitConverter.ToUInt32(z, p + 24);
                int ln = BitConverter.ToUInt16(z, p + 28), le = BitConverter.ToUInt16(z, p + 30), lc = BitConverter.ToUInt16(z, p + 32); int local = (int)BitConverter.ToUInt32(z, p + 42);
                var nome = Encoding.UTF8.GetString(z, p + 46, ln).Replace('\\', '/');
                p += 46 + ln + le + lc;
                if (nome.EndsWith("/")) continue;
                if (tam < 0 || comp < 0 || tam > 300 * 1024 * 1024) throw new Exception(LinguaDosErros.T("arquivo grande demais no zip: ", "file too large in the zip: ") + nome);
                int dados = local + 30 + BitConverter.ToUInt16(z, local + 26) + BitConverter.ToUInt16(z, local + 28);
                if (dados + comp > z.Length) throw new Exception(LinguaDosErros.T("zip danificado", "damaged zip"));
                byte[] b;
                if (metodo == 0) { b = new byte[tam]; Buffer.BlockCopy(z, dados, b, 0, tam); }
                else if (metodo == 8) using (var ms = new MemoryStream(z, dados, comp)) using (var d = new DeflateStream(ms, CompressionMode.Decompress)) using (var o = new MemoryStream(tam)) { d.CopyTo(o); b = o.ToArray(); }
                else throw new Exception(LinguaDosErros.T("compressão " + metodo + " desconhecida (", "unknown compression " + metodo + " (") + nome + ")");
                if (b.Length != tam) throw new Exception(LinguaDosErros.T("tamanho errado no zip: ", "wrong size in the zip: ") + nome);
                r.Add(new Entrada { Nome = nome, Dados = b });
            }
            return r;
        }
    }

    /// <summary>O que o acervo instalou: por id, o tipo, a edicao, a pasta e os arquivos (so estes sao trocados ou apagados).</summary>
    public class Registro
    {
        public class Item
        {
            [JsonProperty("tipo")] public string Tipo;
            [JsonProperty("edicao")] public int Edicao;
            [JsonProperty("nome")] public string Nome;
            [JsonProperty("pasta")] public string Pasta;
            [JsonProperty("arquivos")] public List<string> Arquivos = new List<string>();
            [JsonProperty("requer")] public List<Requisito> Requer = new List<Requisito>();
        }
        [JsonProperty("itens")] public Dictionary<string, Item> Itens = new Dictionary<string, Item>();
        [JsonIgnore] public string Caminho;

        public static Registro Carregar(string caminho)
        {
            Registro r = null;
            try { if (File.Exists(caminho)) r = JsonConvert.DeserializeObject<Registro>(File.ReadAllText(caminho)); } catch { }
            r = r ?? new Registro(); r.Itens = r.Itens ?? new Dictionary<string, Item>(); r.Caminho = caminho;
            return r;
        }

        public void Gravar()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Caminho));
            var tmp = Caminho + ".tmp"; File.WriteAllText(tmp, JsonConvert.SerializeObject(this, Formatting.Indented));
            if (File.Exists(Caminho)) File.Delete(Caminho); File.Move(tmp, Caminho);
        }

        public int EdicaoDe(string id) => Itens.TryGetValue(id ?? "", out var i) ? i.Edicao : 0;
    }

    public static class Instalador
    {
        public static readonly string[] Tipos = { ".dmap", ".dcamp", ".bigorna", ".json", ".ogg", ".mp3", ".wav", ".mp4", ".webm", ".png", ".jpg", ".jpeg", ".webp", ".glb", ".gltf", ".obj", ".bin", ".mtl" };
        static readonly Regex NomeSeguro = new Regex(@"^[^/\\:*?""<>|\x00-\x1f]{1,120}$");
        static readonly Regex ImagemDaObra = new Regex(@"^imagens/[0-9a-f]{32}\.(png|jpg|webp|gif)$");

        public static string Sha256(byte[] b) { using (var h = SHA256.Create()) return string.Concat(h.ComputeHash(b).Select(x => x.ToString("x2"))); }

        /// <summary>As entradas do zip, conferidas: a soma (se a ficha a traz), a ficha de dentro (mesmo id e tipo, edicao), os
        /// nomes (planos, sem caminho) e os tipos de arquivo. Erro com a razao, se algo nao bate.</summary>
        public static List<Zip.Entrada> Conferir(byte[] zip, Ficha esperada)
        {
            if (!string.IsNullOrEmpty(esperada.Sha256) && !string.Equals(Sha256(zip), esperada.Sha256, StringComparison.OrdinalIgnoreCase))
                throw new Exception(LinguaDosErros.T("o arquivo baixado não confere com o acervo (soma diferente)", "the downloaded file does not match the community library (different checksum)"));
            var es = Zip.Ler(zip);
            var fj = es.FirstOrDefault(e => e.Nome == "bigorna-acervo.json") ?? throw new Exception(LinguaDosErros.T("o arquivo não traz a ficha do acervo", "the file has no community library sheet"));
            var f = JsonConvert.DeserializeObject<Ficha>(Encoding.UTF8.GetString(fj.Dados).TrimStart('﻿'));
            if (f == null || f.Formato != "bigorna-acervo" || f.Id != esperada.Id || f.Tipo != esperada.Tipo) throw new Exception(LinguaDosErros.T("a ficha de dentro do arquivo não é a desta entrada do acervo", "the sheet inside the file does not belong to this community library entry"));
            if (f.Edicao != esperada.Edicao) throw new Exception(LinguaDosErros.T("a edição do arquivo (" + f.Edicao + ") não é a do acervo (" + esperada.Edicao + ")", "the file edition (" + f.Edicao + ") is not the community library one (" + esperada.Edicao + ")"));
            var vistos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var e in es)
            {
                // (v240: as imagens da obra vao numa pasta "imagens", com o nome do conteudo; nenhuma outra pasta)
                if (ImagemDaObra.IsMatch(e.Nome)) { if (!vistos.Add(e.Nome)) throw new Exception(LinguaDosErros.T("arquivo repetido: ", "repeated file: ") + e.Nome); continue; }
                if (e.Nome.Contains("/") || e.Nome.StartsWith(".") || !NomeSeguro.IsMatch(e.Nome)) throw new Exception(LinguaDosErros.T("nome de arquivo não aceito: ", "file name not accepted: ") + e.Nome);
                if (!Tipos.Contains(Path.GetExtension(e.Nome).ToLowerInvariant())) throw new Exception(LinguaDosErros.T("tipo de arquivo não aceito: ", "file type not accepted: ") + e.Nome);
                if (!vistos.Add(e.Nome)) throw new Exception(LinguaDosErros.T("arquivo repetido: ", "repeated file: ") + e.Nome);
            }
            if (f.Tipo == "mapa" && !es.Any(e => e.Nome.EndsWith(".dmap", StringComparison.OrdinalIgnoreCase))) throw new Exception(LinguaDosErros.T("o mapa não traz o .dmap", "the map has no .dmap"));
            if (f.Tipo == "campanha" && !es.Any(e => e.Nome.EndsWith(".dcamp", StringComparison.OrdinalIgnoreCase))) throw new Exception(LinguaDosErros.T("a campanha não traz o .dcamp", "the campaign has no .dcamp"));
            if (f.Tipo == "pacote" && !es.Any(e => e.Nome == "pacote.json")) throw new Exception(LinguaDosErros.T("o pacote não traz o pacote.json", "the package has no pacote.json"));
            return es;
        }

        public static string PastaDe(Ficha f, string raizMapas, string raizPacotes) => Path.Combine(f.EhPacote ? raizPacotes : raizMapas, f.Id);

        /// <summary>Instala (ou atualiza) uma entrada do acervo: confere o zip, apaga os arquivos da edicao anterior (so os que o acervo
        /// pos), grava os novos e anota no registro. A pasta e a do id; o que nao veio do acervo (o progresso de uma campanha) fica.</summary>
        public static void Instalar(byte[] zip, Ficha f, string raizMapas, string raizPacotes, Registro reg)
        {
            var es = Conferir(zip, f);
            var pasta = PastaDe(f, raizMapas, raizPacotes);
            // um arquivo que nao veio do acervo, com o nome de um que vem: a pasta e de outra coisa (um mapa feito a mao com o mesmo nome)
            reg.Itens.TryGetValue(f.Id, out var antes);
            var nossos = new HashSet<string>(antes?.Arquivos ?? new List<string>(), StringComparer.OrdinalIgnoreCase);
            foreach (var e in es) if (!nossos.Contains(e.Nome) && File.Exists(Path.Combine(pasta, e.Nome)) && e.Nome != "bigorna-acervo.json")
                    throw new Exception(LinguaDosErros.T("a pasta " + Path.GetFileName(pasta) + " já tem um «" + e.Nome + "» que não veio do acervo", "the folder " + Path.GetFileName(pasta) + " already has a “" + e.Nome + "” that did not come from the community library"));
            Directory.CreateDirectory(pasta);
            foreach (var velho in nossos) { var c = Path.Combine(pasta, velho.Replace('/', Path.DirectorySeparatorChar)); try { if (File.Exists(c)) File.Delete(c); } catch { } }
            foreach (var e in es) { var alvo = Path.Combine(pasta, e.Nome.Replace('/', Path.DirectorySeparatorChar)); Directory.CreateDirectory(Path.GetDirectoryName(alvo)); File.WriteAllBytes(alvo, e.Dados); }
            reg.Itens[f.Id] = new Registro.Item { Tipo = f.Tipo, Edicao = f.Edicao, Nome = f.Nome, Pasta = pasta, Arquivos = es.Select(e => e.Nome).ToList(), Requer = f.Requer ?? new List<Requisito>() };
            reg.Gravar();
            Pacotes.Esquecer();
        }

        /// <summary>Tira uma entrada instalada pelo acervo: so os arquivos dela; a pasta sai se ficar vazia.</summary>
        public static bool Remover(string id, Registro reg)
        {
            if (!reg.Itens.TryGetValue(id ?? "", out var it)) return false;
            foreach (var a in it.Arquivos) { var c = Path.Combine(it.Pasta, a.Replace('/', Path.DirectorySeparatorChar)); try { if (File.Exists(c)) File.Delete(c); } catch { } }
            try { var im = Path.Combine(it.Pasta, "imagens"); if (Directory.Exists(im) && !Directory.EnumerateFileSystemEntries(im).Any()) Directory.Delete(im); } catch { }
            try { if (Directory.Exists(it.Pasta) && !Directory.EnumerateFileSystemEntries(it.Pasta).Any()) Directory.Delete(it.Pasta); } catch { }
            reg.Itens.Remove(id); reg.Gravar();
            Pacotes.Esquecer();
            return true;
        }
    }

    /// <summary>Os pacotes instalados e a juncao deles ao "custom" de um mapa ou campanha que os exige.</summary>
    public static class Pacotes
    {
        /// <summary>A pasta dos pacotes (definida pelo mod ao iniciar; nos testes, por eles).</summary>
        public static string Raiz;
        class Lido { public DateTime Quando; public JObject Json; }
        static readonly Dictionary<string, Lido> _cache = new Dictionary<string, Lido>(StringComparer.OrdinalIgnoreCase);
        public static void Esquecer() { lock (_cache) _cache.Clear(); }

        public static string PastaDo(string id)
        {
            if (string.IsNullOrEmpty(Raiz) || !Ficha.IdValido(id)) return null;
            var p = Path.Combine(Raiz, id);
            if (File.Exists(Path.Combine(p, "pacote.json"))) return p;
            // (v241: um pacote numa pasta de outro nome: achado pelo id do pacote.json; a busca de novo so depois de 10 s)
            lock (_porId)
            {
                if ((DateTime.UtcNow - _porIdQuando).TotalSeconds > 10)
                {
                    _porId.Clear(); _porIdQuando = DateTime.UtcNow;
                    try { foreach (var d in Directory.GetDirectories(Raiz)) { var c = Path.Combine(d, "pacote.json"); if (!File.Exists(c)) continue;
                            try { var t = File.ReadAllText(c); var m = System.Text.RegularExpressions.Regex.Match(t.Length > 4000 ? t.Substring(0, 4000) : t, "\"id\"\\s*:\\s*\"([^\"]+)\""); if (m.Success && !_porId.ContainsKey(m.Groups[1].Value)) _porId[m.Groups[1].Value] = d; } catch { } } }
                    catch { }
                }
                if (_porId.TryGetValue(id, out var achada)) return achada;
            }
            return p;
        }
        static readonly Dictionary<string, string> _porId = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        static DateTime _porIdQuando = DateTime.MinValue;

        /// <summary>O pacote.json de um pacote instalado, ou null.</summary>
        public static JObject Ler(string id)
        {
            var pasta = PastaDo(id); if (pasta == null) return null;
            var c = Path.Combine(pasta, "pacote.json"); if (!File.Exists(c)) return null;
            var quando = File.GetLastWriteTimeUtc(c);
            lock (_cache) if (_cache.TryGetValue(c, out var t) && t.Quando == quando) return t.Json;
            JObject j = null;
            try { j = LerJson(File.ReadAllText(c)); if ((string)j["format"] != "bigorna-pacote") j = null; } catch { j = null; }
            lock (_cache) _cache[c] = new Lido { Quando = quando, Json = j };
            return j;
        }

        public static int EdicaoInstalada(string id) { var j = Ler(id); return j == null ? 0 : Math.Max(1, (int?)j["edition"] ?? 1); }

        /// <summary>O texto de um .dmap/.dcamp cita "requires"? (So entao ele e lido em JSON solto para a juncao; os outros seguem
        /// pelo caminho de sempre.)</summary>
        public static bool ExigePacotes(string texto) => texto != null && texto.IndexOf("\"requires\"", StringComparison.Ordinal) >= 0;

        /// <summary>JSON solto sem converter textos com cara de data (o "2026-10-14" fica texto, como na leitura direta).</summary>
        public static JObject LerJson(string texto)
        {
            using (var r = new JsonTextReader(new StringReader(texto)) { DateParseHandling = DateParseHandling.None })
                return JObject.Load(r);
        }

        static string Chave(JObject o) => (string)o["id"] ?? (string)o["_id"] ?? (string)o["hero"];

        /// <summary>Junta ao "custom" do documento (um .dmap ou .dcamp ainda em JSON) o de cada pacote que ele exige; o que o
        /// documento ja tem (pelo id) vence. Devolve os pacotes que faltam (nao instalados).</summary>
        public static List<Requisito> Juntar(JObject doc, Func<string, JObject> ler = null)
        {
            ler = ler ?? Ler;
            var faltam = new List<Requisito>();
            var reqs = Requisito.DoMapa(doc["requires"]);
            if (reqs.Count == 0) return faltam;
            var custom = doc["custom"] as JObject; if (custom == null) { custom = new JObject(); doc["custom"] = custom; }
            foreach (var q in reqs)
            {
                var pk = ler(q.Id);
                if (pk == null) { faltam.Add(q); continue; }
                // (v241: uma edicao mais velha que a pedida tambem falta: pode nao ter o que o mapa usa; o que ela tem entra)
                if (Math.Max(1, (int?)pk["edition"] ?? 1) < q.Edicao) faltam.Add(q);
                var dele = pk["custom"] as JObject; if (dele == null) continue;
                foreach (var prop in dele.Properties())
                {
                    if (prop.Value is JArray lista)
                    {
                        var meu = custom[prop.Name] as JArray; if (meu == null) { meu = new JArray(); custom[prop.Name] = meu; }
                        var ja = new HashSet<string>(meu.OfType<JObject>().Select(Chave).Where(k => k != null), StringComparer.Ordinal);
                        var textos = new HashSet<string>(meu.Where(x => !(x is JObject)).Select(x => x.ToString(Formatting.None)), StringComparer.Ordinal);
                        foreach (var x in lista)
                        {
                            if (x is JObject o) { var k = Chave(o); if (k != null ? ja.Add(k) : !meu.Any(m => JToken.DeepEquals(m, o))) meu.Add(o.DeepClone()); }
                            else if (textos.Add(x.ToString(Formatting.None))) meu.Add(x.DeepClone());
                        }
                    }
                    else if (custom[prop.Name] == null) custom[prop.Name] = prop.Value.DeepClone();
                }
            }
            return faltam;
        }

        /// <summary>As pastas dos pacotes exigidos (para achar modelos, sons e imagens deles).</summary>
        public static IEnumerable<string> Pastas(IEnumerable<Requisito> reqs)
        {
            foreach (var q in reqs ?? Enumerable.Empty<Requisito>()) { var p = PastaDo(q.Id); if (p != null && Directory.Exists(p)) yield return p; }
        }
    }
}
