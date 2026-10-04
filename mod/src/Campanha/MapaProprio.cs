using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using FFG.D3;
using FFG.D3.WorldMap;
using UnityEngine;
using UnityEngine.UI;

namespace Bigorna.Campanha
{
    /// <summary>
    /// Mapa-mundi e cidade proprios de uma campanha. O mapa do jogo e uma malha ("Map") atras do canvas dos destinos; o
    /// mod esconde essa malha, a agua, a terra queimada, os nomes dos lugares e os pontos de estrada (a rede nova vem de
    /// Estradas), e poe no lugar um
    /// quadro com a imagem da campanha cobrindo o quadro inteiro do canvas (1820x1024 unidades, origem no centro): as
    /// coordenadas dos destinos continuam as mesmas. Nuvens e passaros do jogo ficam por cima (opcao "clouds"); a nevoa
    /// das Terras da Nevoa so fica se a campanha pedir ("mist"). Na cidade, a maior imagem do quadro da cidade (o fundo)
    /// recebe a imagem da campanha. Tudo vale so para a cena aberta: a cena seguinte ja vem do jogo.
    /// </summary>
    public static class MapaProprio
    {
        public const float LarguraQuadro = 1820f, AlturaQuadro = 1024f;
        static readonly Dictionary<string, Texture2D> _texturas = new Dictionary<string, Texture2D>(StringComparer.OrdinalIgnoreCase);
        static int _visualFeito, _cidadeFeita;
        static GameObject _quadro;
        static float _proxima;
        static bool _diagCidade;

        /// <summary>O mapa da cena atual e o da campanha (a foto do mapa para o editor nao deve fotografar este).</summary>
        public static bool Ativo => _quadro != null;

        public static void Batimento()
        {
            if (Time.unscaledTime < _proxima) return;
            _proxima = Time.unscaledTime + 0.5f;
            var c = Campanha.Aberta;
            if (c == null || !SingletonBehaviour<WorldMapSceneController>.IsInitialized) return;
            var cena = SingletonBehaviour<WorldMapSceneController>.Instance;
            try { MundoProprio(c, cena); } catch (Exception ex) { Log.Erro("mapa-múndi próprio", ex); _visualFeito = -1; }
            try { CidadePropria(c, cena); } catch (Exception ex) { Log.Erro("cidade própria", ex); _cidadeFeita = -1; }
        }

        // ------------------------------------------------------------ mapa-mundi
        static void MundoProprio(Formato.Dcamp c, WorldMapSceneController cena)
        {
            var mp = c.Metadados?.MapaProprio;
            var vis = cena.MapVisual;
            if (mp == null || string.IsNullOrEmpty(mp.Arquivo) || vis == null || cena.CanvasWorldmap == null) return;
            try { Estradas.Montar(c, cena, mp); } catch (Exception ex) { Log.Erro("estradas do mapa próprio", ex); }
            int id = vis.GetInstanceID();
            if (_visualFeito == id) { Manter(vis, mp); return; }
            if (_visualFeito == -1) return;   // falhou nesta cena: nao insiste a cada meio segundo
            var tex = Textura(c, mp.Arquivo);
            if (tex == null) { _visualFeito = -1; return; }

            var malha = vis.transform.Find("Map")?.GetComponent<Renderer>();
            float z = malha != null ? malha.bounds.center.z : vis.transform.position.z;
            Esconder(vis, mp);

            // os nomes dos lugares e os pontos das estradas do mapa do jogo
            foreach (Transform f in cena.CanvasWorldmap.transform)
                if (f.name.StartsWith("Name_Locations", StringComparison.OrdinalIgnoreCase)) f.gameObject.SetActive(false);
            foreach (var tp in cena.CanvasWorldmap.GetComponentsInChildren<TravelPoint>(true))
                if (!tp.name.StartsWith("@Bigorna-Estrada", StringComparison.Ordinal))
                    foreach (var r in tp.GetComponentsInChildren<CanvasRenderer>(true)) r.cull = true;

            var cv = cena.CanvasWorldmap.transform;
            var centro = cv.TransformPoint(Vector3.zero);
            var largura = Vector3.Distance(cv.TransformPoint(new Vector3(-LarguraQuadro / 2f, 0f, 0f)), cv.TransformPoint(new Vector3(LarguraQuadro / 2f, 0f, 0f)));
            var altura = Vector3.Distance(cv.TransformPoint(new Vector3(0f, -AlturaQuadro / 2f, 0f)), cv.TransformPoint(new Vector3(0f, AlturaQuadro / 2f, 0f)));

            if (_quadro != null) UnityEngine.Object.Destroy(_quadro);
            _quadro = new GameObject("@Bigorna-MapaProprio");
            _quadro.layer = vis.gameObject.layer;
            _quadro.transform.SetParent(vis.transform, true);
            _quadro.transform.position = new Vector3(centro.x, centro.y, z - 0.01f);
            _quadro.transform.rotation = Quaternion.identity;
            var escalaPai = vis.transform.lossyScale;
            _quadro.transform.localScale = new Vector3(largura / Mathf.Max(0.0001f, escalaPai.x), altura / Mathf.Max(0.0001f, escalaPai.y), 1f);
            _quadro.AddComponent<MeshFilter>().sharedMesh = Quadro();
            var rq = _quadro.AddComponent<MeshRenderer>();
            var sh = Shader.Find("Sprites/Default") ?? Shader.Find("Unlit/Texture") ?? vis.GetComponentsInChildren<SpriteRenderer>(true).Select(s => s.sharedMaterial?.shader).FirstOrDefault(s => s != null);
            if (sh == null && malha == null) { Log.Info("mapa-múndi próprio: sem shader para o quadro"); UnityEngine.Object.Destroy(_quadro); _quadro = null; _visualFeito = -1; return; }
            var mat = sh != null ? new Material(sh) : new Material(malha.sharedMaterial);
            mat.mainTexture = tex;
            rq.sharedMaterial = mat;
            rq.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; rq.receiveShadows = false;
            _visualFeito = id;
            Log.Info("mapa-múndi próprio «" + mp.Arquivo + "» (" + tex.width + "×" + tex.height + ", shader " + (sh != null ? sh.name : "do mapa") + "), quadro " + largura.ToString("0.0") + "×" + altura.ToString("0.0")
                + " em " + _quadro.transform.position + "; nuvens " + (mp.Nuvens ? "sim" : "não") + ", névoa " + (mp.Nevoa ? "sim" : "não"));
        }

        /// <summary>O que o jogo liga sozinho (a nevoa e a terra queimada vem da configuracao da partida) volta a ser apagado.</summary>
        static void Manter(WorldMapVisual vis, Formato.Dcamp.MapaDaCampanha mp) => Esconder(vis, mp);

        static void Esconder(WorldMapVisual vis, Formato.Dcamp.MapaDaCampanha mp)
        {
            foreach (Transform f in vis.transform)
            {
                if (_quadro != null && f == _quadro.transform) continue;
                var n = f.name;
                bool fora = n == "Map" || n.IndexOf("Water", StringComparison.OrdinalIgnoreCase) >= 0 || n.IndexOf("Burnt", StringComparison.OrdinalIgnoreCase) >= 0
                    || (!mp.Nevoa && n.IndexOf("Mist", StringComparison.OrdinalIgnoreCase) >= 0)
                    || (!mp.Nuvens && (n.IndexOf("Cloud", StringComparison.OrdinalIgnoreCase) >= 0 || n.IndexOf("Bird", StringComparison.OrdinalIgnoreCase) >= 0));
                if (!fora) continue;
                if (n == "Map" || n == "Clouds") { var r = f.GetComponent<Renderer>(); if (r != null && r.enabled) r.enabled = false; }
                else if (f.gameObject.activeSelf) f.gameObject.SetActive(false);
            }
        }

        /// <summary>Um quadrado de 1x1 no plano XY, com cor branca nos vertices e as duas faces (qualquer shader o mostra).</summary>
        static Mesh _malhaQuadro;
        static Mesh Quadro()
        {
            if (_malhaQuadro != null) return _malhaQuadro;
            var m = new Mesh { name = "Bigorna quadro" };
            m.vertices = new[] { new Vector3(-0.5f, -0.5f, 0f), new Vector3(0.5f, -0.5f, 0f), new Vector3(0.5f, 0.5f, 0f), new Vector3(-0.5f, 0.5f, 0f) };
            m.uv = new[] { new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(1f, 1f), new Vector2(0f, 1f) };
            m.colors = new[] { Color.white, Color.white, Color.white, Color.white };
            m.triangles = new[] { 0, 2, 1, 0, 3, 2, 0, 1, 2, 0, 2, 3 };
            m.RecalculateNormals(); m.RecalculateBounds();
            _malhaQuadro = m; UnityEngine.Object.DontDestroyOnLoad(m); m.hideFlags |= HideFlags.DontUnloadUnusedAsset;
            return m;
        }

        // ------------------------------------------------------------ cidade
        static void CidadePropria(Formato.Dcamp c, WorldMapSceneController cena)
        {
            var ci = c.Metadados?.Cidade;
            var cv = cena.CanvasCity;
            if (ci == null || string.IsNullOrEmpty(ci.Arquivo) || cv == null || !cv.gameObject.activeInHierarchy) return;
            int id = cv.GetInstanceID();
            if (_cidadeFeita == id || _cidadeFeita == -1) return;
            if (!_diagCidade) { _diagCidade = true; try { Diagnostico(cv); } catch { } }
            var tex = Textura(c, ci.Arquivo);
            if (tex == null) { _cidadeFeita = -1; return; }
            // o fundo: a maior imagem do quadro da cidade
            Graphic fundo = null; float maior = 0f;
            foreach (var g in cv.GetComponentsInChildren<Graphic>(true))
            {
                if (!(g is Image) && !(g is RawImage)) continue;
                var r = g.rectTransform.rect; float a = Mathf.Abs(r.width * r.height);
                if (a > maior) { maior = a; fundo = g; }
            }
            if (fundo == null) { Log.Info("cidade própria: não achei a imagem de fundo"); _cidadeFeita = -1; return; }
            if (fundo is RawImage raw) raw.texture = tex;
            else { var img = (Image)fundo; img.sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f); img.overrideSprite = null; img.preserveAspect = false; }
            _cidadeFeita = id;
            Log.Info("cidade própria «" + ci.Arquivo + "» no lugar de «" + fundo.name + "» (" + fundo.rectTransform.rect.size + ")");
        }

        static void Diagnostico(Canvas cv)
        {
            var sb = new StringBuilder("cidade, diagnóstico: canvas «" + cv.name + "» " + cv.renderMode + "\n");
            void Arvore(Transform t, int nivel)
            {
                if (nivel > 3) return; int k = 0;
                foreach (Transform f in t)
                {
                    if (++k > 20) { sb.Append(new string(' ', 2 + nivel * 2) + "…\n"); break; }
                    var r = f as RectTransform; var g = f.GetComponent<Graphic>();
                    string tex = g is Image im && im.sprite != null ? " sprite=" + im.sprite.name : g is RawImage ri && ri.texture != null ? " tex=" + ri.texture.name : "";
                    sb.Append(new string(' ', 2 + nivel * 2) + (f.gameObject.activeSelf ? "" : "(inativo) ") + f.name + (r != null ? " rect=" + r.rect.size : "") + tex + "\n");
                    Arvore(f, nivel + 1);
                }
            }
            Arvore(cv.transform, 0);
            Log.Info(sb.ToString());
        }

        // ------------------------------------------------------------ imagens
        static Texture2D Textura(Formato.Dcamp c, string arquivo)
        {
            var caminho = Path.Combine(c.Pasta, Path.GetFileName(arquivo));
            if (_texturas.TryGetValue(caminho, out var t) && t != null) return t;
            if (!File.Exists(caminho)) { Log.Info("imagem da campanha: não achei «" + caminho + "» (ela vai na pasta da campanha)"); return null; }
            var tex = new Texture2D(2, 2, TextureFormat.RGBA32, true);
            if (!tex.LoadImage(File.ReadAllBytes(caminho))) { Log.Info("imagem da campanha: «" + arquivo + "» não é PNG nem JPG"); return null; }
            tex.name = "Bigorna " + Path.GetFileName(arquivo); tex.wrapMode = TextureWrapMode.Clamp; tex.filterMode = FilterMode.Trilinear; tex.anisoLevel = 4;
            tex.hideFlags |= HideFlags.DontUnloadUnusedAsset;
            return _texturas[caminho] = tex;
        }

        /// <summary>Nova cena do mapa-mundi ou da cidade: tudo sera aplicado de novo.</summary>
        public static void NovaCena() { _visualFeito = 0; _cidadeFeita = 0; _quadro = null; Estradas.NovaCena(); }
    }
}
