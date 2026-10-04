using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using FFG.Core;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>Pecas e objetos feitos na Oficina do editor: o jogo nao tem modelo para eles, entao o mod os constroi.
    /// Peca: um clone de uma peca do jogo (pelos componentes GameTile/GameEntity/GameVisibility) sem o visual dela, com uma
    /// laje fina por casa na cor escolhida (grao generico), superficie de clique, objeto de linha de visao e uma casa da grade
    /// por quadrado. Objeto: a ficha de interacao do jogo sobre quadrados na cor escolhida, com o icone enviado (se houver).</summary>
    public static class Oficina
    {
        /// <summary>Os tipos de dano e os alcances do jogo na ordem dos seus enums (DamageTypes, TargetRanges): o editor grava pelo nome.</summary>
        internal static readonly string[] Danos = { "Crush", "Slash", "Pierce", "Ignos", "Anemos", "Aquos", "Terros", "Lumos", "Umbros", "Vigos", "Mortos", "Toxos", "Fortunos" };
        internal static readonly string[] Alcances = { "Melee", "Near", "Far" };

        static readonly Dictionary<string, Texture2D> _texturas = new Dictionary<string, Texture2D>();
        static Shader _sombreador;
        static bool _procurou;

        public static Color Cor(string hex, Color padrao)
        {
            if (!string.IsNullOrEmpty(hex) && ColorUtility.TryParseHtmlString(hex.Trim(), out var c)) return c;
            return padrao;
        }

        /// <summary>Textura 64x64: a cor com um grao de pedra neutro por cima (overlay), borda escura e luz no canto.</summary>
        public static Texture2D Textura(string hex)
        {
            var chave = (hex ?? "").ToLowerInvariant();
            if (_texturas.TryGetValue(chave, out var t) && t != null) return t;
            var cor = Cor(hex, new Color(0.54f, 0.48f, 0.4f));
            const int S = 64;
            t = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, name = "@Bigorna-Grao-" + chave };
            var rnd = new System.Random(7919);
            var px = new Color[S * S];
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float g = 0.5f + (float)(rnd.NextDouble() - 0.5) * 0.28f;
                    if (x < 2 || y < 2 || x >= S - 2 || y >= S - 2) g = 0.22f;
                    else if (x < 4 || y >= S - 4) g = Mathf.Min(1f, g + 0.12f);
                    px[y * S + x] = new Color(Overlay(cor.r, g), Overlay(cor.g, g), Overlay(cor.b, g), 1f);
                }
            t.SetPixels(px);
            t.Apply(false, false);
            _texturas[chave] = t;
            return t;
        }

        static float Overlay(float b, float s) => b < 0.5f ? 2f * b * s : 1f - 2f * (1f - b) * (1f - s);

        /// <summary>Materiais compartilhados: o mesmo para a mesma textura (e o mesmo molde, quando nao ha sombreador proprio).
        /// O jogo nao mexe no sharedMaterial das pecas e objetos (o esmaecer e o contorno nao tocam nele), entao dividir e seguro;
        /// antes cada peca, casa pintada, objeto e cartao ganhava materiais novos, que ficavam na memoria a cada partida.</summary>
        static readonly Dictionary<long, Material> _materiais = new Dictionary<long, Material>();
        static long Chave(UnityEngine.Object a, UnityEngine.Object b, int tipo) => ((long)(a != null ? a.GetInstanceID() : 0) << 32) ^ (uint)((b != null ? b.GetInstanceID() : 0) * 31 + tipo);
        static Material Guardado(long k, Func<Material> criar) { if (_materiais.TryGetValue(k, out var m) && m != null) return m; m = criar(); if (m != null) _materiais[k] = m; return m; }

        /// <summary>Um material simples com a textura; procura um sombreador que o jogo tenha incluido. Compartilhado: nao mudar o que volta.</summary>
        public static Material Material(Texture2D tex, Material reserva) { Procurar(); return Guardado(Chave(tex, _sombreador != null ? null : reserva, 1), () => NovoMaterial(tex, reserva)); }

        /// <summary>Material transparente e sem luz para imagens de pe ou deitadas (icone, cartao, topo do bloco). Compartilhado.</summary>
        public static Material Transparente(Texture2D tex) => Guardado(Chave(tex, null, 2), () =>
        {
            Shader sh = null; foreach (var n in new[] { "Sprites/Default", "Unlit/Transparent", "Legacy Shaders/Transparent/Diffuse" }) { try { sh = Shader.Find(n); } catch { } if (sh != null) break; }
            var m = sh != null ? new Material(sh) : NovoMaterial(tex, null);
            if (m != null) m.mainTexture = tex;
            return m;
        });

        /// <summary>Material de modelo 3D (iluminado): a textura dele, ou a cor de miniatura sem pintura. Compartilhado.</summary>
        public static Material DeModelo(Texture2D tex) => Guardado(Chave(tex, null, 3), () =>
        {
            Material m = null;
            foreach (var n in new[] { "Standard", "Legacy Shaders/Diffuse", "Mobile/Diffuse" }) { Shader sh = null; try { sh = Shader.Find(n); } catch { } if (sh != null) { m = new Material(sh); break; } }
            if (m == null) m = NovoMaterial(tex ?? Textura("#b9b4aa"), null);
            if (m == null) return null;
            if (tex != null) { m.mainTexture = tex; try { if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", tex); } catch { } m.color = Color.white; }
            else { m.mainTexture = null; m.color = new Color(0.73f, 0.71f, 0.67f); }
            try { if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.25f); } catch { }
            return m;
        });

        static void Procurar()
        {
            if (!_procurou)
            {
                _procurou = true;
                foreach (var nome in new[] { "Standard", "Legacy Shaders/Diffuse", "Mobile/Diffuse", "Unlit/Texture", "Sprites/Default" })
                {
                    try { _sombreador = Shader.Find(nome); } catch { _sombreador = null; }
                    if (_sombreador != null) { Log.Info("oficina: sombreador «" + nome + "»"); break; }
                }
                if (_sombreador == null) Log.Info("oficina: nenhum sombreador padrão; uso o material da peça de molde");
            }
        }

        static Material NovoMaterial(Texture2D tex, Material reserva)
        {
            Procurar();
            Material m = _sombreador != null ? new Material(_sombreador) : (reserva != null ? new Material(reserva) : null);
            if (m == null) return null;
            try { m.mainTexture = tex; } catch { }
            foreach (var prop in new[] { "_MainTex", "_BaseMap", "_BaseColorMap", "_Albedo" }) try { if (m.HasProperty(prop)) m.SetTexture(prop, tex); } catch { }
            foreach (var prop in new[] { "_Color", "_BaseColor" }) try { if (m.HasProperty(prop)) m.SetColor(prop, Color.white); } catch { }
            try { if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.1f); } catch { }
            return m;
        }

        static IEnumerable<(int, int)> Casas(int[][] casas)
        {
            if (casas == null) yield break;
            foreach (var c in casas) if (c != null && c.Length >= 2) yield return (c[0], c[1]);
        }

        /// <summary>Monta uma peca da Oficina a partir de uma peca do jogo que serve de molde (so pelos componentes).</summary>
        public static GameTile MontarPeca(Dmap.PecaPropria def, Dmap.Peca p, Transform pai, GameTile molde)
        {
            if (def == null || molde == null) return null;
            var casas = Casas(def.Casas).ToList();
            if (casas.Count == 0) return null;
            var go = UnityEngine.Object.Instantiate(molde.gameObject, pai);
            go.name = string.IsNullOrEmpty(def.Nome) ? Idioma.T("Peça própria", "Custom tile") : def.Nome.Trim();
            go.transform.rotation = Quaternion.identity;
            go.transform.position = Vector3.zero;
            var tile = go.GetComponent<GameTile>();
            tile.IsUnderlay = def.Fundo;
            tile.isTerrain = false;
            var coordMolde = (tile.LocalGridCoords ?? new GameGridCoordinates[0]).FirstOrDefault(c => c != null);
            if (coordMolde == null) { Log.Info("  peça da Oficina «" + go.name + "»: o molde não tem casas"); UnityEngine.Object.Destroy(go); return null; }
            float alturaCasa = go.transform.InverseTransformPoint(coordMolde.transform.position).y;
            // o que se aproveita do molde: o material (reserva) e as camadas da superficie e da linha de visao
            var rendMolde = molde.GetComponentsInChildren<Renderer>(true).FirstOrDefault(r => r != null && r.sharedMaterial != null);
            var colMolde = molde.GetComponentsInChildren<Collider>(true).FirstOrDefault(c => c != null && !c.isTrigger && (molde.LineOfSightGameObject == null || !c.transform.IsChildOf(molde.LineOfSightGameObject.transform)));
            int camadaSuperficie = colMolde != null ? colMolde.gameObject.layer : molde.gameObject.layer;
            int camadaVisao = molde.LineOfSightGameObject != null ? molde.LineOfSightGameObject.layer : 0;
            var plantilha = UnityEngine.Object.Instantiate(coordMolde.gameObject);
            plantilha.SetActive(false);
            // tira tudo o que e do molde: filhos (visual, casas, linha de visao, rotulo) e o visual/colisores da raiz
            foreach (Transform filho in go.transform.Cast<Transform>().ToList()) UnityEngine.Object.Destroy(filho.gameObject);
            foreach (var r in go.GetComponents<Renderer>()) r.enabled = false;
            foreach (var c in go.GetComponents<Collider>()) c.enabled = false;
            tile.TextTileId = null;

            var mat = Material(Textura(def.Cor), rendMolde != null ? rendMolde.sharedMaterial : null);
            var superficie = new GameObject("@Bigorna-Superficie") { layer = camadaSuperficie };
            superficie.transform.SetParent(go.transform, false);
            var visao = new GameObject("@Bigorna-LinhaDeVisao") { layer = camadaVisao };
            visao.transform.SetParent(go.transform, false);
            const float espessura = 0.1f;
            var coords = new List<GameGridCoordinates>();
            foreach (var (cx, cy) in casas)
            {
                // casa (cx,cy) do editor: x para a direita, y para baixo (= -z no mundo)
                var laje = GameObject.CreatePrimitive(PrimitiveType.Cube);
                laje.name = "Laje " + cx + "," + cy;
                laje.layer = camadaSuperficie;
                laje.transform.SetParent(superficie.transform, false);
                laje.transform.localPosition = new Vector3(cx, alturaCasa - espessura / 2f, -cy);
                laje.transform.localScale = new Vector3(0.995f, espessura, 0.995f);
                var mr = laje.GetComponent<MeshRenderer>(); if (mr != null && mr) { if (mat != null) mr.sharedMaterial = mat; }
                var bc = new GameObject("Visao " + cx + "," + cy) { layer = camadaVisao };
                bc.transform.SetParent(visao.transform, false);
                bc.transform.localPosition = new Vector3(cx, alturaCasa - espessura / 2f, -cy);
                var col = bc.AddComponent<BoxCollider>(); col.size = new Vector3(1f, espessura, 1f);
                var casa = UnityEngine.Object.Instantiate(plantilha, go.transform);
                casa.name = "Casa " + cx + "," + cy;
                casa.SetActive(true);
                casa.transform.localPosition = new Vector3(cx, alturaCasa, -cy);
                casa.transform.localRotation = Quaternion.identity;
                var gc = casa.GetComponent<GameGridCoordinates>();
                gc.LocalCoordinates = new Vector2Int(cx, cy);
                gc.OutOfBounds = false;
                gc.HasCoordinateOffset = false;
                gc.ObjectsAtThisCoord = new List<GameObject>();
                coords.Add(gc);
            }
            UnityEngine.Object.Destroy(plantilha);
            try { Pintar(def, casas, superficie.transform, alturaCasa, rendMolde != null ? rendMolde.sharedMaterial : null); } catch (Exception ex) { Log.Erro("pintando a peça da Oficina «" + go.name + "»", ex); }
            tile.LocalGridCoords = coords.ToArray();
            tile.LineOfSightGameObject = visao;
            // a casa (0,0) relativa fica em pos; a rotacao gira em torno dela (como no editor)
            go.transform.rotation = Quaternion.Euler(0f, p.Rot, 0f);
            go.transform.position = new Vector3(p.X, def.Fundo ? -0.1f : Jogo.Altura(p.Nivel), -p.Y);
            go.SetActive(true);
            Log.Info("  peça da Oficina «" + go.name + "»" + (def.Fundo ? " (de fundo)" : "") + ": " + casas.Count + " casa(s) em " + p.X + "," + p.Y + (p.Nivel > 0 ? " · nível " + p.Nivel : "")
                + (!string.IsNullOrEmpty(def.Textura) ? " · imagem inteira" : !string.IsNullOrEmpty(def.TexturaRepetida) ? " · imagem repetida por casa" : " · cor " + def.Cor));
            return tile;
        }

        /// <summary>A imagem da peca por cima das lajes: uma so, estendida sobre o retangulo que envolve as casas (cada casa
        /// mostra a sua parte), ou a mesma repetida em cada casa.</summary>
        static void Pintar(Dmap.PecaPropria def, List<(int, int)> casas, Transform pai, float alturaCasa, Material reserva)
        {
            float yt = alturaCasa + 0.004f;
            int x0 = casas.Min(c => c.Item1), x1 = casas.Max(c => c.Item1), y0 = casas.Min(c => c.Item2), y1 = casas.Max(c => c.Item2);
            float W = x1 - x0 + 1, H = y1 - y0 + 1;
            void Face(string nome, IEnumerable<(int, int)> quais, Texture2D tex, bool inteira)
            {
                var vs = new List<Vector3>(); var uvs = new List<Vector2>(); var tri = new List<int>();
                foreach (var (cx, cy) in quais)
                {
                    int b = vs.Count;
                    float u0 = inteira ? (cx - x0) / W : 0f, u1 = inteira ? (cx - x0 + 1) / W : 1f;
                    float vTopo = inteira ? 1f - (cy - y0) / H : 1f, vBase = inteira ? 1f - (cy - y0 + 1) / H : 0f;
                    vs.Add(new Vector3(cx - 0.5f, yt, -cy - 0.5f)); uvs.Add(new Vector2(u0, vBase));
                    vs.Add(new Vector3(cx - 0.5f, yt, -cy + 0.5f)); uvs.Add(new Vector2(u0, vTopo));
                    vs.Add(new Vector3(cx + 0.5f, yt, -cy + 0.5f)); uvs.Add(new Vector2(u1, vTopo));
                    vs.Add(new Vector3(cx + 0.5f, yt, -cy - 0.5f)); uvs.Add(new Vector2(u1, vBase));
                    tri.AddRange(new[] { b, b + 1, b + 2, b, b + 2, b + 3 });
                }
                if (vs.Count == 0) return;
                var malha = new Mesh { name = "@Bigorna-" + nome };
                malha.SetVertices(vs); malha.SetUVs(0, uvs); malha.SetTriangles(tri, 0); malha.RecalculateNormals(); malha.RecalculateBounds();
                var go = new GameObject(nome);
                go.transform.SetParent(pai, false);
                go.AddComponent<MeshFilter>().sharedMesh = malha;
                var mr = go.AddComponent<MeshRenderer>(); var m = Material(tex, reserva); if (m != null) mr.sharedMaterial = m;
                mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            if (!string.IsNullOrEmpty(def.Textura))
            {
                var tex = LerImagemGuardada(def.Textura, "@Bigorna-PecaInteira-" + def.Id);
                if (tex != null) Face("Imagem", casas, tex, true); else Log.Info("  imagem da peça «" + def.Nome + "»: ilegível");
                return;
            }
            if (string.IsNullOrEmpty(def.TexturaRepetida)) return;
            var rep = LerImagemGuardada(def.TexturaRepetida, "@Bigorna-PecaRepetida-" + def.Id);
            if (rep != null) Face("Imagem", casas, rep, false); else Log.Info("  imagem da peça «" + def.Nome + "»: ilegível");
        }

        /// <summary>Veste a ficha de interacao de um objeto da Oficina: um quadrado na cor por casa (sem colisor) e o icone por cima.</summary>
        public static void VestirObjeto(GameObject corpo, Dmap.Objeto o, Dmap.ObjetoProprio def, Objetos.NaMesa posto = null)
        {
            if (corpo == null || o == null) return;
            var casas = Casas(o.Casas).ToList();
            if (casas.Count == 0) casas.Add((o.X, o.Y));
            bool modelo = def != null && def.EhModelo;
            bool cartao = def != null && def.EhCartao && !modelo;
            bool bloco = def != null && def.EhBloco && !cartao && !modelo;
            if (cartao || bloco || modelo)
            {
                // o cartao substitui a ficha: o visual dela some (os colisores clonados continuam clicaveis)
                foreach (var r in corpo.GetComponentsInChildren<Renderer>(true)) r.enabled = false;
            }
            var cor = def != null ? def.Cor : "#6a5a48";
            var mat = Material(Textura(cor), corpo.GetComponentsInChildren<Renderer>(true).FirstOrDefault(r => r != null && r.sharedMaterial != null)?.sharedMaterial);
            var raiz = new GameObject("@Bigorna-Pegada");
            raiz.transform.SetParent(corpo.transform, true);
            float y = corpo.transform.position.y + 0.02f;
            foreach (var (x, cy) in casas)
            {
                var q = GameObject.CreatePrimitive(PrimitiveType.Cube);
                q.name = "Pegada " + x + "," + cy;
                var col = q.GetComponent<Collider>(); if (col != null) UnityEngine.Object.Destroy(col);
                q.transform.SetParent(raiz.transform, true);
                q.transform.position = new Vector3(x, y, -cy);
                q.transform.rotation = Quaternion.identity;
                q.transform.localScale = new Vector3(0.9f, 0.03f, 0.9f);
                var mr = q.GetComponent<MeshRenderer>(); if (mr != null && mat != null) mr.sharedMaterial = mat;
            }
            if (modelo) { try { if (MontarModelo(corpo, raiz.transform, casas, y - 0.02f, o, def, posto)) return; } catch (Exception ex) { Log.Erro("montando o modelo 3D de «" + (def?.Nome ?? "?") + "»", ex); }
                foreach (var r in corpo.GetComponentsInChildren<Renderer>(true)) if (!r.transform.IsChildOf(raiz.transform)) r.enabled = true;   // sem o modelo: volta a ficha
                return; }
            if (bloco) { try { MontarBloco(corpo, raiz.transform, casas, y - 0.02f, def, mat, posto); } catch (Exception ex) { Log.Erro("montando o bloco de «" + (def?.Nome ?? "?") + "»", ex); } return; }
            if (cartao) { try { MontarCartao(corpo, raiz.transform, casas, y - 0.02f, def, posto); } catch (Exception ex) { Log.Erro("montando o cartão de «" + (def?.Nome ?? "?") + "»", ex); } return; }
            var icone = def?.Icone;
            if (!string.IsNullOrEmpty(icone))
            {
                try
                {
                    int virgula = icone.IndexOf(',');
                    var bytes = Convert.FromBase64String(virgula >= 0 ? icone.Substring(virgula + 1) : icone);
                    var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false) { name = "@Bigorna-Icone-" + (def.Id ?? "") };
                    if (ImageConversion.LoadImage(tex, bytes))
                    {
                        var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
                        quad.name = "@Bigorna-Icone";
                        var col = quad.GetComponent<Collider>(); if (col != null) UnityEngine.Object.Destroy(col);
                        quad.transform.SetParent(raiz.transform, true);
                        float cx = (float)casas.Average(c => c.Item1), cz = -(float)casas.Average(c => c.Item2);
                        quad.transform.position = new Vector3(cx, y + 0.9f, cz);
                        quad.transform.rotation = Quaternion.Euler(60f, 0f, 0f);
                        quad.transform.localScale = Vector3.one * 0.8f;
                        var m = Transparente(tex);
                        if (m != null) quad.GetComponent<MeshRenderer>().sharedMaterial = m;
                    }
                }
                catch (Exception ex) { Log.Info("  ícone de «" + (def?.Nome ?? "?") + "»: " + ex.Message); }
            }
        }

        /// <summary>Imagens da Oficina ja lidas (nome + conteudo). As texturas de LerImagem nao descarregam e nunca eram
        /// destruidas: cada copia de uma peca, cada objeto e cada vez que o mapa abria criava outra. A mesma imagem com o mesmo
        /// nome sai daqui.</summary>
        static readonly Dictionary<(string, string), Texture2D> _imagens = new Dictionary<(string, string), Texture2D>();

        static Texture2D LerImagemGuardada(string dataUri, string nome)
        {
            if (string.IsNullOrEmpty(dataUri)) return null;
            var chave = (nome ?? "", dataUri);
            // null guardado = imagem ilegivel; uma textura destruida (!= null por referencia) e lida de novo
            if (_imagens.TryGetValue(chave, out var t) && (t != null || ReferenceEquals(t, null))) return t;
            try { t = LerImagem(dataUri, nome); }
            catch { _imagens[chave] = null; throw; }
            _imagens[chave] = t;
            return t;
        }

        internal static Texture2D LerImagem(string dataUri, string nome)
        {
            if (string.IsNullOrEmpty(dataUri)) return null;
            int virgula = dataUri.IndexOf(',');
            var bytes = Convert.FromBase64String(virgula >= 0 ? dataUri.Substring(virgula + 1) : dataUri);
            var tex = new Texture2D(2, 2, TextureFormat.RGBA32, true) { name = nome, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Trilinear, anisoLevel = 4, hideFlags = HideFlags.DontUnloadUnusedAsset };
            return ImageConversion.LoadImage(tex, bytes) ? tex : null;
        }

        /// <summary>Cartao em pe: a imagem numa placa vertical sobre o centro das casas, sempre virada para a camera,
        /// com uma base escura; clicar nela usa o objeto.</summary>
        static void MontarCartao(GameObject corpo, Transform raiz, List<(int, int)> casas, float y, Dmap.ObjetoProprio def, Objetos.NaMesa posto)
        {
            var tex = LerImagemGuardada(def.Cartao, "@Bigorna-Cartao-" + def.Id);
            if (tex == null) { Log.Info("  cartão de «" + def.Nome + "»: imagem ilegível"); return; }
            float h = Mathf.Clamp(def.AlturaCartao <= 0 ? 1.4f : def.AlturaCartao, 0.3f, 6f);
            float w = h * tex.width / Mathf.Max(1, tex.height);
            float cx = (float)casas.Average(c => c.Item1), cz = -(float)casas.Average(c => c.Item2);
            var ancora = new GameObject("@Bigorna-Cartao");
            ancora.transform.SetParent(raiz, true);
            ancora.transform.position = new Vector3(cx, y, cz);
            ancora.transform.rotation = Quaternion.identity;
            ancora.AddComponent<Virado>();
            // a placa
            var placa = GameObject.CreatePrimitive(PrimitiveType.Quad);
            placa.name = "Placa";
            var mc = placa.GetComponent<Collider>(); if (mc != null) UnityEngine.Object.DestroyImmediate(mc);
            placa.transform.SetParent(ancora.transform, false);
            placa.transform.localPosition = new Vector3(0f, h / 2f + 0.05f, 0f);
            placa.transform.localRotation = Quaternion.identity;
            placa.transform.localScale = new Vector3(w, h, 1f);
            var m = Transparente(tex);
            if (m != null) { var mr = placa.GetComponent<MeshRenderer>(); mr.sharedMaterial = m; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; }
            // espessura de papelao (camadas da silhueta atras da imagem)
            if (m != null) CartoesDeMonstro.Engrossar(placa, m, Mathf.Clamp(h * 0.035f, 0.04f, 0.12f));
            // a base (um pe de papelao escuro)
            var pe = GameObject.CreatePrimitive(PrimitiveType.Cube);
            pe.name = "Base";
            var pc = pe.GetComponent<Collider>(); if (pc != null) UnityEngine.Object.DestroyImmediate(pc);
            pe.transform.SetParent(ancora.transform, false);
            pe.transform.localPosition = new Vector3(0f, 0.03f, 0.1f);
            pe.transform.localScale = new Vector3(Mathf.Max(0.4f, w * 0.7f), 0.06f, 0.35f);
            var mb = Material(Textura("#2a2622"), null); if (mb != null) pe.GetComponent<MeshRenderer>().sharedMaterial = mb;
            // clicavel: na mesma camada dos colisores que o jogo ja entrega ao mod
            if (posto != null)
            {
                var ref_ = corpo.GetComponentsInChildren<Objetos.Clicavel>(true).FirstOrDefault();
                placa.layer = ref_ != null ? ref_.gameObject.layer : corpo.layer;
                var bc = placa.AddComponent<BoxCollider>(); bc.size = new Vector3(1f, 1f, 0.05f);
                placa.AddComponent<Objetos.Clicavel>().Posto = posto;
            }
            Log.Info("  cartão em pé de «" + def.Nome + "»: " + tex.width + "x" + tex.height + " px, " + h.ToString("0.0") + " casa(s) de altura");
        }

        /// <summary>Bloco: um cubo na cor do objeto sobre cada casa, da altura escolhida, com a imagem (ou o icone) estendida
        /// pelo topo de todas as casas juntas; clicar nele usa o objeto.</summary>
        static void MontarBloco(GameObject corpo, Transform raiz, List<(int, int)> casas, float y, Dmap.ObjetoProprio def, Material mat, Objetos.NaMesa posto)
        {
            float h = Mathf.Clamp(def.AlturaDoBloco <= 0 ? 0.6f : def.AlturaDoBloco, 0.1f, 4f);
            var ancora = new GameObject("@Bigorna-Bloco");
            ancora.transform.SetParent(raiz, true);
            var ref_ = posto != null ? corpo.GetComponentsInChildren<Objetos.Clicavel>(true).FirstOrDefault() : null;
            foreach (var (x, cy) in casas)
            {
                var cubo = GameObject.CreatePrimitive(PrimitiveType.Cube);
                cubo.name = "Bloco " + x + "," + cy;
                var col = cubo.GetComponent<Collider>(); if (col != null) UnityEngine.Object.DestroyImmediate(col);
                cubo.transform.SetParent(ancora.transform, true);
                cubo.transform.position = new Vector3(x, y + h / 2f, -cy);
                cubo.transform.rotation = Quaternion.identity;
                cubo.transform.localScale = new Vector3(0.98f, h, 0.98f);
                var mr = cubo.GetComponent<MeshRenderer>(); if (mr != null && mat != null) mr.sharedMaterial = mat;
                if (posto != null)
                {
                    cubo.layer = ref_ != null ? ref_.gameObject.layer : corpo.layer;
                    cubo.AddComponent<BoxCollider>();
                    cubo.AddComponent<Objetos.Clicavel>().Posto = posto;
                }
            }
            var fonte = !string.IsNullOrEmpty(def.TopoDoBloco) ? def.TopoDoBloco : def.Icone;
            var tex = LerImagemGuardada(fonte, "@Bigorna-Topo-" + def.Id);
            if (tex != null)
            {
                int x0 = casas.Min(c => c.Item1), x1 = casas.Max(c => c.Item1), y0 = casas.Min(c => c.Item2), y1 = casas.Max(c => c.Item2);
                float W = x1 - x0 + 1, H = y1 - y0 + 1, lado = Mathf.Max(W, H);
                // a imagem cobre o quadrado que envolve as casas, centrada, sem esticar
                float ox = (x0 + x1) / 2f - lado / 2f, oz = -(y0 + y1) / 2f - lado / 2f;
                var vs = new List<Vector3>(); var uvs = new List<Vector2>(); var tri = new List<int>();
                float yt = y + h + 0.006f;
                foreach (var (x, cy) in casas)
                {
                    int b = vs.Count;
                    var cantos = new[] { new Vector3(x - 0.5f, yt, -cy - 0.5f), new Vector3(x - 0.5f, yt, -cy + 0.5f), new Vector3(x + 0.5f, yt, -cy + 0.5f), new Vector3(x + 0.5f, yt, -cy - 0.5f) };
                    foreach (var c in cantos) { vs.Add(c); uvs.Add(new Vector2((c.x - ox) / lado, (c.z - oz) / lado)); }
                    tri.AddRange(new[] { b, b + 1, b + 2, b, b + 2, b + 3 });
                }
                var malha = new Mesh { name = "@Bigorna-TopoDoBloco" };
                malha.SetVertices(vs); malha.SetUVs(0, uvs); malha.SetTriangles(tri, 0); malha.RecalculateNormals(); malha.RecalculateBounds();
                var topo = new GameObject("Topo");
                topo.transform.SetParent(ancora.transform, false);
                topo.transform.position = Vector3.zero; topo.transform.rotation = Quaternion.identity; topo.transform.localScale = Vector3.one;
                topo.transform.SetParent(ancora.transform, true);
                topo.AddComponent<MeshFilter>().sharedMesh = malha;
                var tr = topo.AddComponent<MeshRenderer>();
                var m = Transparente(tex);
                if (m != null) { tr.sharedMaterial = m; tr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; }
            }
            Log.Info("  bloco de «" + def.Nome + "»: " + casas.Count + " casa(s), " + h.ToString("0.0") + " de altura" + (tex != null ? ", imagem no topo " + tex.width + "x" + tex.height : ", sem imagem"));
        }

        /// <summary>Um arquivo ao lado do .dmap (ou do .dcamp da campanha aberta), ou null.</summary>
        public static string AoLadoDoMapa(string nome)
        {
            if (string.IsNullOrEmpty(nome)) return null;
            // durante a montagem o roteiro ainda nao comecou (Roteiro.Mapa e null): vale o mapa que o Lancador esta abrindo
            foreach (var pasta in new[] { System.IO.Path.GetDirectoryName((Motor.Roteiro.Mapa ?? Lancador.Atual)?.Caminho ?? "") ?? "", Campanha.Campanha.Aberta?.Pasta ?? "" })
            {
                if (string.IsNullOrEmpty(pasta)) continue;
                var c = System.IO.Path.Combine(pasta, System.IO.Path.GetFileName(nome));
                if (System.IO.File.Exists(c)) return c;
            }
            return null;
        }

        /// <summary>Malhas lidas, pelo caminho completo e a data do arquivo (dois mapas com um "arvore.obj" diferente, ou o
        /// OBJ trocado, nao reaproveitam a malha errada).</summary>
        static readonly Dictionary<string, Mesh> _malhas = new Dictionary<string, Mesh>(StringComparer.OrdinalIgnoreCase);

        /// <summary>Modelo 3D (OBJ) de pe sobre o centro das casas, da altura escolhida, girado com o objeto; clicar nele usa o objeto.</summary>
        static bool MontarModelo(GameObject corpo, Transform raiz, List<(int, int)> casas, float y, Dmap.Objeto o, Dmap.ObjetoProprio def, Objetos.NaMesa posto)
        {
            var arq = AoLadoDoMapa(def.Modelo);
            if (arq == null) { Log.Info("  modelo 3D de «" + def.Nome + "»: não achei «" + def.Modelo + "» (ele vai na mesma pasta do .dmap)"); return false; }
            var chave = arq; try { chave += "|" + System.IO.File.GetLastWriteTimeUtc(arq).Ticks; } catch { }
            // null guardado = OBJ ilegivel (nao tenta de novo); uma malha destruida e lida outra vez
            if (!_malhas.TryGetValue(chave, out var malha) || (!ReferenceEquals(malha, null) && malha == null))
            {
                malha = null;
                try { malha = LeitorObj.Ler(arq); } catch (Exception ex) { Log.Erro("lendo o modelo 3D «" + def.Modelo + "»", ex); }
                _malhas[chave] = malha;
            }
            if (malha == null) return false;
            // a textura vai pelo conteudo (antes era pelo id do objeto: dois mapas com o mesmo id trocavam as texturas)
            Texture2D tex = null;
            if (!string.IsNullOrEmpty(def.TexModelo)) { try { tex = LerImagemGuardada(def.TexModelo, "@Bigorna-ModeloObjeto-" + def.Id); } catch { } }
            var m = DeModelo(tex);
            float h = Mathf.Clamp(def.AlturaModelo <= 0 ? 1f : def.AlturaModelo, 0.1f, 8f);
            float cx = (float)casas.Average(c => c.Item1), cz = -(float)casas.Average(c => c.Item2);
            var ancora = new GameObject("@Bigorna-Modelo");
            ancora.transform.SetParent(raiz, true);
            ancora.transform.position = new Vector3(cx, y, cz);
            ancora.transform.rotation = Quaternion.Euler(0f, o.Rot + def.GiroModelo, 0f);
            var go = new GameObject("Modelo");
            go.transform.SetParent(ancora.transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = malha;
            var mr = go.AddComponent<MeshRenderer>(); if (m != null) mr.sharedMaterial = m;
            var mb = malha.bounds; float k = h / Mathf.Max(1e-4f, mb.size.y);
            go.transform.localScale = Vector3.one * k;
            go.transform.localPosition = new Vector3(-mb.center.x * k, -mb.min.y * k, -mb.center.z * k);
            if (posto != null)
            {
                var ref_ = corpo.GetComponentsInChildren<Objetos.Clicavel>(true).FirstOrDefault();
                go.layer = ref_ != null ? ref_.gameObject.layer : corpo.layer;
                var bc = go.AddComponent<BoxCollider>(); bc.center = mb.center; bc.size = mb.size;
                go.AddComponent<Objetos.Clicavel>().Posto = posto;
            }
            Log.Info("  modelo 3D de «" + def.Nome + "»: " + malha.vertexCount + " vértices, " + h.ToString("0.0") + " casa(s) de altura" + (tex != null ? ", com textura" : ""));
            return true;
        }

        /// <summary>Mantem o cartao virado para a camera (so gira em torno do eixo vertical).</summary>
        public class Virado : MonoBehaviour
        {
            void LateUpdate()
            {
                Camera cam = null;
                try { cam = Jogo.Cena?.CameraEncounter?.Camera; } catch { }
                if (cam == null) cam = Camera.main;
                if (cam == null) return;
                var d = transform.position - cam.transform.position; d.y = 0f;
                if (d.sqrMagnitude > 0.0001f) transform.rotation = Quaternion.LookRotation(d, Vector3.up);
            }
        }

        /// <summary>As casas de um objeto do mapa: as da Oficina (ja giradas) ou o retangulo do tipo.</summary>
        public static IEnumerable<(int, int)> CasasDoObjeto(Dmap.Objeto o, int[] tamanho)
        {
            if (o.Casas != null && o.Casas.Length > 0) { foreach (var c in Casas(o.Casas)) yield return c; yield break; }
            int w = tamanho[0], h = tamanho[1];
            if (o.Rot % 180 != 0) { var tmp = w; w = h; h = tmp; }
            for (int i = 0; i < w; i++) for (int j = 0; j < h; j++) yield return (o.X + i, o.Y + j);
        }
    }
}
