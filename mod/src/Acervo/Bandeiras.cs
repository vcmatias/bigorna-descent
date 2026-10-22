using System.Collections.Generic;
using UnityEngine;

namespace Bigorna.Acervo
{
    /// <summary>
    /// As bandeiras da lingua de uma entrada do acervo (a lingua em que o mapa foi feito, uma das do jogo): os PNG de
    /// tools/bandeiras.py (BandeirasPng), lidos uma vez por sessao. A fonte do jogo nao tem emoji.
    /// </summary>
    public static class Bandeiras
    {
        static readonly Dictionary<string, Sprite> _feitas = new Dictionary<string, Sprite>();

        /// <summary>O codigo de uma lingua como o acervo guarda ("pt", "zh-cn"...); aceita os do jogo ("cz") e variantes.</summary>
        public static string Codigo(string l)
        {
            var k = (l ?? "").Trim().ToLowerInvariant().Replace('_', '-');
            if (k == "cz") return "cs"; if (k == "pt-br") return "pt"; if (k == "zh" || k == "zh-hans") return "zh-cn"; if (k == "zh-hant") return "zh-tw";
            return k;
        }

        /// <summary>As bandeiras de "pt", "en", "pt,en"... (na ordem); as linguas sem bandeira ficam de fora.</summary>
        public static List<Sprite> Da(string lingua)
        {
            var r = new List<Sprite>();
            foreach (var l in (lingua ?? "").Split(','))
            {
                var k = Codigo(l); if (!BandeirasPng.Base64.TryGetValue(k, out var b64)) continue;
                if (!_feitas.TryGetValue(k, out var s) || s == null)
                {
                    var t = new Texture2D(2, 2, TextureFormat.RGBA32, false) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Clamp, name = "Bigorna bandeira " + k };
                    if (!ImageConversion.LoadImage(t, System.Convert.FromBase64String(b64), true)) continue;
                    _feitas[k] = s = Sprite.Create(t, new Rect(0, 0, t.width, t.height), new Vector2(0.5f, 0.5f), 100f);
                }
                r.Add(s);
            }
            return r;
        }
    }
}
