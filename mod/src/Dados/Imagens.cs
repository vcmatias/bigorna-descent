using System;
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
}
