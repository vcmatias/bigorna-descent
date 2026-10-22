using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Bigorna.Dados
{
    /// <summary>Copia uma textura do jogo (em geral nao legivel pela CPU) para PNG ou JPEG em base64, passando pela
    /// placa de video. A reducao e feita pela metade de cada vez, para a imagem pequena nao sair serrilhada.</summary>
    public static class Imagens
    {
        public static string DataUri(Texture tex, int lado, bool jpeg = false, Rect? recorte = null)
        {
            if (tex == null) return null;
            var bytes = Codificar(tex, lado, jpeg, recorte);
            if (bytes == null) return null;
            return (jpeg ? "data:image/jpeg;base64," : "data:image/png;base64,") + Convert.ToBase64String(bytes);
        }

        public static string DataUri(Sprite s, int lado)
        {
            if (s == null || s.texture == null) return null;
            var t = s.texture; var r = s.textureRect;
            bool inteiro = Mathf.Approximately(r.width, t.width) && Mathf.Approximately(r.height, t.height);
            return DataUri(t, lado, false, inteiro ? (Rect?)null : new Rect(r.x / t.width, r.y / t.height, r.width / t.width, r.height / t.height));
        }

        static byte[] Codificar(Texture tex, int lado, bool jpeg, Rect? uv)
        {
            int w0 = uv.HasValue ? Mathf.RoundToInt(tex.width * uv.Value.width) : tex.width;
            int h0 = uv.HasValue ? Mathf.RoundToInt(tex.height * uv.Value.height) : tex.height;
            if (w0 <= 0 || h0 <= 0) return null;
            float esc = lado > 0 ? Mathf.Min(1f, lado / (float)Mathf.Max(w0, h0)) : 1f;
            int W = Mathf.Max(1, Mathf.RoundToInt(w0 * esc)), H = Mathf.Max(1, Mathf.RoundToInt(h0 * esc));

            // primeiro passo: recorte (se houver) no tamanho original ou na metade mais proxima do alvo
            int w = w0, h = h0;
            while (w / 2 >= W * 2 && h / 2 >= H * 2) { w /= 2; h /= 2; }
            var rt = RenderTexture.GetTemporary(w, h, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Default);
            rt.filterMode = FilterMode.Bilinear;
            if (uv.HasValue) Graphics.Blit(tex, rt, uv.Value.size, uv.Value.position); else Graphics.Blit(tex, rt);
            while (w != W || h != H)
            {
                int nw = Mathf.Max(W, w / 2), nh = Mathf.Max(H, h / 2);
                if (nw == w && nh == h) { nw = W; nh = H; }
                var rt2 = RenderTexture.GetTemporary(nw, nh, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Default);
                rt2.filterMode = FilterMode.Bilinear;
                Graphics.Blit(rt, rt2);
                RenderTexture.ReleaseTemporary(rt);
                rt = rt2; w = nw; h = nh;
            }
            return Ler(rt, jpeg, true);
        }

        /// <summary>Le a RenderTexture para a CPU e codifica; libera a textura temporaria se pedido.</summary>
        public static byte[] Ler(RenderTexture rt, bool jpeg, bool liberar)
        {
            var antes = RenderTexture.active;
            Texture2D t2 = null;
            try
            {
                RenderTexture.active = rt;
                t2 = new Texture2D(rt.width, rt.height, jpeg ? TextureFormat.RGB24 : TextureFormat.RGBA32, false);
                t2.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
                t2.Apply(false);
                return jpeg ? t2.EncodeToJPG(85) : t2.EncodeToPNG();
            }
            finally
            {
                RenderTexture.active = antes;
                if (liberar) RenderTexture.ReleaseTemporary(rt);
                if (t2 != null) UnityEngine.Object.Destroy(t2);
            }
        }
    }
    /// <summary>v240: as imagens das obras sao arquivos com o nome do proprio conteudo ("imagens/&lt;hash&gt;.png"). O .dmap, o .dcamp e
    /// o pacote.json levam so a referencia; o arquivo fica na pasta "imagens" ao lado deles, ou no deposito do editor
    /// (Bigorna\Imagens\&lt;2&gt;\&lt;hash&gt;.png). Um texto em data: URL (os arquivos antigos, ou um baixado avulso) continua valendo.</summary>
    public static class ImagensDaObra
    {
        /// <summary>A pasta de dados do jogo (definida ao iniciar: o Unity so a da na linha principal).</summary>
        public static string Dados;
        static readonly Regex Nome = new Regex("^[0-9a-f]{32}\\.(png|jpg|webp|gif)$");
        static Dictionary<string, string> _indice; static DateTime _indiceQuando;
        static readonly object _trava = new object();

        public static bool EhReferencia(string s) => s != null && s.Length <= 48 && s.StartsWith("imagens/", StringComparison.Ordinal) && Nome.IsMatch(s.Substring(8));

        /// <summary>Os bytes de uma imagem: a referencia lida do arquivo, ou o data: URL decodificado (null: nada legivel).</summary>
        public static byte[] Bytes(string s)
        {
            if (string.IsNullOrEmpty(s)) return null;
            if (s.StartsWith("imagens/", StringComparison.Ordinal))
            {
                var f = Achar(s.Substring(8));
                if (f == null) { Log.Info("imagem não encontrada: " + s + " (ela vai na pasta «imagens» ao lado do mapa)"); return null; }
                return File.ReadAllBytes(f);
            }
            int k = s.IndexOf("base64,", StringComparison.Ordinal);
            if (k >= 0) return Convert.FromBase64String(s.Substring(k + 7));
            int v = s.IndexOf(',');
            return Convert.FromBase64String(v >= 0 ? s.Substring(v + 1) : s);
        }

        /// <summary>O caminho do arquivo de uma imagem: o deposito, ou uma pasta "imagens" de CustomMaps ou de Pacotes.</summary>
        public static string Achar(string nome)
        {
            if (string.IsNullOrEmpty(Dados) || !Nome.IsMatch(nome ?? "")) return null;
            var f = Path.Combine(Dados, "Bigorna", "Imagens", nome.Substring(0, 2), nome);
            if (File.Exists(f)) return f;
            lock (_trava)
            {
                if (_indice != null && _indice.TryGetValue(nome, out var c) && File.Exists(c)) return c;
                // (a varredura de novo so depois de 10 s: um mapa com muitas imagens faltando faz uma so)
                if (_indice == null || (DateTime.UtcNow - _indiceQuando).TotalSeconds > 10)
                {
                    _indice = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase); _indiceQuando = DateTime.UtcNow;
                    foreach (var raiz in new[] { "CustomMaps", "Pacotes" })
                    {
                        var d = Path.Combine(Dados, raiz); if (!Directory.Exists(d)) continue;
                        try { foreach (var p in Directory.GetDirectories(d, "imagens", SearchOption.AllDirectories)) foreach (var a in Directory.GetFiles(p)) { var n = Path.GetFileName(a); if (Nome.IsMatch(n) && !_indice.ContainsKey(n)) _indice[n] = a; } }
                        catch (Exception ex) { Log.Info("procurando imagens em " + raiz + ": " + ex.Message); }
                    }
                    if (_indice.TryGetValue(nome, out c)) return c;
                }
            }
            return null;
        }
    }
}
