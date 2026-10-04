using System;
using System.Collections.Generic;
using System.Linq;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>Cartao em pe no lugar da figura animada de um monstro da Oficina. As figuras do jogo sao por tipo e reaproveitadas
    /// (pool): a vista de inimigos (EnemyPreview, uma por monstro na partida) e a figura de colocacao (plastico). A cada 0,25 s
    /// procura as figuras dos monstros com cartao, esconde o modelo (o que esta sob um Animator ou e SkinnedMeshRenderer,
    /// nunca a base colorida nem a interface) e poe a placa com a imagem, do tamanho da figura; desfaz quando a figura
    /// volta ao pool para outro monstro. A placa respira de leve e treme quando o monstro perde vida.</summary>
    public static class CartoesDeMonstro
    {
        class Def { public string Imagem; public float Escala; public Texture2D Tex; public string Modelo, TexModelo; public float Giro; public Mesh Malha; public Texture2D TexM; public bool Tentou; public Material Mat; }
        static readonly Dictionary<string, Def> _defs = new Dictionary<string, Def>(StringComparer.Ordinal);
        static float _proxima;
        static readonly HashSet<int> _semMalha = new HashSet<int>();

        public static bool Tem(string idModelo) => !string.IsNullOrEmpty(idModelo) && _defs.ContainsKey(idModelo);

        public static void Registrar(string idModelo, string imagem, float escala) => Registrar(idModelo, imagem, escala, null, null, 0f);

        /// <summary>Cartao em pe (imagem) ou figura 3D (arquivo OBJ ao lado do mapa, com textura opcional) do monstro.</summary>
        public static void Registrar(string idModelo, string imagem, float escala, string modelo, string texModelo, float giro)
        {
            if (string.IsNullOrEmpty(idModelo)) return;
            if (string.IsNullOrEmpty(imagem) && string.IsNullOrEmpty(modelo)) { _defs.Remove(idModelo); return; }
            if (_defs.TryGetValue(idModelo, out var d) && d.Imagem == imagem && d.Modelo == modelo && d.TexModelo == texModelo) { d.Escala = escala <= 0 ? 1f : escala; d.Giro = giro; return; }
            _defs[idModelo] = new Def { Imagem = imagem, Escala = escala <= 0 ? 1f : escala, Modelo = modelo, TexModelo = texModelo, Giro = giro };
            Log.Info((string.IsNullOrEmpty(modelo) ? "cartão em pé" : "figura 3D «" + modelo + "»") + " para o monstro «" + idModelo + "» (escala " + escala.ToString("0.00") + ")");
        }

        /// <summary>A malha da figura 3D: o OBJ ao lado do .dmap (ou do .dcamp), lido uma vez.</summary>
        static Mesh Malha(Def d)
        {
            if (d.Malha != null || d.Tentou) return d.Malha;
            d.Tentou = true;
            string arq = null;
            foreach (var pasta in new[] { System.IO.Path.GetDirectoryName((Motor.Roteiro.Mapa ?? Lancador.Atual)?.Caminho ?? "") ?? "", Campanha.Campanha.Aberta?.Pasta ?? "" })
            {
                if (string.IsNullOrEmpty(pasta)) continue;
                var c = System.IO.Path.Combine(pasta, System.IO.Path.GetFileName(d.Modelo));
                if (System.IO.File.Exists(c)) { arq = c; break; }
            }
            if (arq == null) { Log.Info("  figura 3D: não achei «" + d.Modelo + "» (ele vai na mesma pasta do .dmap)"); return null; }
            try { d.Malha = LeitorObj.Ler(arq); } catch (Exception ex) { Log.Erro("lendo a figura 3D «" + d.Modelo + "»", ex); }
            if (d.Malha != null) Log.Info("  figura 3D «" + d.Modelo + "»: " + d.Malha.vertexCount + " vértices");
            if (!string.IsNullOrEmpty(d.TexModelo)) { try { d.TexM = Oficina.LerImagem(d.TexModelo, "@Bigorna-Figura3D"); } catch { } }
            return d.Malha;
        }

        static Material MaterialDaFigura(Def d, List<Renderer> escondidos)
        {
            if (d.Mat != null) return d.Mat;   // um por figura 3D, reusado a cada vez que ela e vestida
            Material m = null;
            foreach (var n in new[] { "Standard", "Legacy Shaders/Diffuse", "Mobile/Diffuse" }) { Shader sh = null; try { sh = Shader.Find(n); } catch { } if (sh != null) { m = new Material(sh); break; } }
            if (m == null) { var velho = escondidos.Select(r => r.sharedMaterial).FirstOrDefault(x => x != null); if (velho != null) m = new Material(velho); }
            if (m == null) { var base_ = Oficina.Material(d.TexM ?? Oficina.Textura("#b9b4aa"), null); if (base_ != null) m = new Material(base_); }   // copia: o de Oficina e compartilhado
            if (m == null) return null;
            if (d.TexM != null) { m.mainTexture = d.TexM; try { if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", d.TexM); } catch { } m.color = Color.white; }
            else { m.mainTexture = null; m.color = new Color(0.73f, 0.71f, 0.67f); }   // sem textura: miniatura sem pintura
            try { if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.25f); } catch { }
            return d.Mat = m;
        }

        static Texture2D Tex(Def d)
        {
            if (d.Tex == null) { try { d.Tex = Oficina.LerImagem(d.Imagem, "@Bigorna-CartaoMonstro"); } catch (Exception ex) { Log.Info("imagem do cartão: " + ex.Message); } }
            return d.Tex;
        }

        static Material NovoMaterial(Texture2D tex)
        {
            return Oficina.Transparente(tex);   // compartilhado por textura (antes um novo a cada vez que a figura era vestida)
        }

        /// <summary>Chamado a cada quadro pelo nucleo; trabalha a cada 0,25 s.</summary>
        public static void Batimento()
        {
            if (_defs.Count == 0 || Time.unscaledTime < _proxima) return;
            _proxima = Time.unscaledTime + 0.25f;
            if (!Jogo.EncontroPronto) return;
            foreach (var pv in UnityEngine.Object.FindObjectsOfType<EnemyPreview>())
            {
                if (pv == null) continue;
                string id = null; SerializedEnemy e = null;
                try { e = pv.Enemy; id = e?.Model?.Id; } catch { }
                var marca = pv.GetComponent<Marca>();
                if (Tem(id) && pv.gameObject.activeInHierarchy) { if (marca == null || marca.Id != id || marca.Inimigo != e) Vestir(pv.gameObject, id, e, false); }
                else if (marca != null) marca.Desfazer();
            }
        }

        /// <summary>A figura de colocacao (plastico) de um monstro que acabou de entrar.</summary>
        public static void VestirFigura(GameObject figura, string idModelo)
        {
            if (figura == null) return;
            if (Tem(idModelo)) Vestir(figura, idModelo, null, true);
            else figura.GetComponent<Marca>()?.Desfazer();
        }

        public static void Despir(GameObject figura) { figura?.GetComponent<Marca>()?.Desfazer(); }

        static void Vestir(GameObject alvo, string id, SerializedEnemy e, bool plastico)
        {
            var d = _defs[id]; bool figura3d = !string.IsNullOrEmpty(d.Modelo);
            Texture2D tex = null; Mesh malha = null;
            if (figura3d) { malha = Malha(d); if (malha == null) return; }
            else { tex = Tex(d); if (tex == null) return; }
            var velha = alvo.GetComponent<Marca>(); if (velha != null) velha.Desfazer();
            // o que se esconde: o modelo (sob Animator, ou malha com pele); fica a base colorida (GameDynamicMaterials) e a interface
            var manter = new HashSet<Transform>();
            try { var dm = alvo.GetComponent<GameDynamicMaterials>(); if (dm != null && dm.DynamicMaterialObjects != null) foreach (var o in dm.DynamicMaterialObjects) if (o != null) manter.Add(o.transform); } catch { }
            bool Mantido(Transform t) { for (var x = t; x != null && x != alvo.transform; x = x.parent) if (manter.Contains(x)) return true; return false; }
            // na vista de inimigos, o que a EnemyPreview aponta (brilho, interface, textos, fichas, icones) fica
            var pv = alvo.GetComponent<EnemyPreview>();
            if (pv != null)
                foreach (var f in typeof(EnemyPreview).GetFields(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public))
                {
                    object v = null; try { v = f.GetValue(pv); } catch { }
                    if (v is Component cp && cp != null) manter.Add(cp.transform); else if (v is GameObject go && go != null) manter.Add(go.transform);
                }
            var animadores = alvo.GetComponentsInChildren<Animator>(true).Select(a => a.transform).ToList();
            bool SobAnimador(Transform t) => animadores.Any(a => t == a || t.IsChildOf(a));
            var esconder = alvo.GetComponentsInChildren<Renderer>(true).Where(r => r != null && !(r is ParticleSystemRenderer) && !Mantido(r.transform)
                && (r is SkinnedMeshRenderer || SobAnimador(r.transform) || ((plastico || pv != null) && r is MeshRenderer))
                && r.gameObject.name.IndexOf("Text", StringComparison.OrdinalIgnoreCase) < 0).ToList();
            if (esconder.Count == 0) { if (_semMalha.Add(alvo.GetInstanceID())) Log.Info("  cartão do monstro «" + id + "»: a figura (" + alvo.name + ") ainda não tem malha; tento de novo"); return; }
            // tamanho: o da figura que some (em pe, no mundo), vezes a escala da ficha
            var b = esconder[0].bounds; foreach (var r in esconder.Skip(1)) b.Encapsulate(r.bounds);
            float altura = Mathf.Clamp(b.size.y, 0.4f, 8f) * d.Escala;
            var marca = alvo.AddComponent<Marca>();
            marca.Id = id; marca.Inimigo = e; marca.Escondidos = esconder; marca.Vida = SafeVida(e);
            foreach (var r in esconder) r.enabled = false;
            if (figura3d) { MontarFigura(alvo, d, malha, b, altura, marca, esconder, plastico); return; }
            float largura = altura * tex.width / Mathf.Max(1, tex.height);
            var ancora = new GameObject("@Bigorna-CartaoMonstro");
            ancora.transform.SetParent(alvo.transform, false);
            ancora.transform.position = new Vector3(b.center.x, b.min.y, b.center.z);
            var placa = GameObject.CreatePrimitive(PrimitiveType.Quad);
            placa.name = "Placa";
            var col = placa.GetComponent<Collider>(); if (col != null) UnityEngine.Object.DestroyImmediate(col);
            placa.transform.SetParent(ancora.transform, false);
            // tamanho no mundo, qualquer que seja a escala do pai
            var s = alvo.transform.lossyScale; float sx = Mathf.Abs(s.x) < 1e-4f ? 1f : Mathf.Abs(s.x), sy = Mathf.Abs(s.y) < 1e-4f ? 1f : Mathf.Abs(s.y);
            placa.transform.localScale = new Vector3(largura / sx, altura / sy, 1f);
            placa.transform.localPosition = new Vector3(0f, altura / 2f / sy, 0f);
            var mr = placa.GetComponent<MeshRenderer>(); var m = NovoMaterial(tex); if (m != null) mr.sharedMaterial = m; mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            placa.layer = alvo.layer;
            // espessura de papelao: camadas da mesma silhueta atras da imagem, na cor do papelao, e o verso
            float sz = Mathf.Abs(s.z) < 1e-4f ? 1f : Mathf.Abs(s.z);
            Engrossar(placa, m, Mathf.Clamp(altura * 0.035f, 0.04f, 0.12f) / sz);
            marca.Ancora = ancora; marca.Placa = placa.transform; marca.Altura = altura / sy;
            Log.Info("  cartão em pé no monstro «" + id + "» (" + (plastico ? "figura de colocação" : "vista de inimigos") + "): " + esconder.Count + " malha(s) escondida(s), " + altura.ToString("0.00") + " de altura");
        }

        /// <summary>As cores de papelao e verso de cada material de frente, feitas uma vez.</summary>
        static readonly Dictionary<Material, (Material papelao, Material verso)> _espessuras = new Dictionary<Material, (Material, Material)>();
        /// <summary>Da espessura a uma placa (um Quad com a imagem): camadas da silhueta atras dela, cor de papelao, e o verso
        /// com a imagem um pouco mais escura. "espessura" no espaco local da placa.</summary>
        public static void Engrossar(GameObject placa, Material frente, float espessura)
        {
            if (placa == null || frente == null || espessura <= 0f) return;
            const int camadas = 7;
            if (!_espessuras.TryGetValue(frente, out var par) || par.papelao == null || par.verso == null)
                _espessuras[frente] = par = (new Material(frente) { color = new Color(0.64f, 0.54f, 0.40f, 1f) }, new Material(frente) { color = new Color(0.78f, 0.76f, 0.72f, 1f) });
            var papelao = par.papelao; var verso = par.verso;
            for (int i = 1; i <= camadas; i++)
            {
                var q = GameObject.CreatePrimitive(PrimitiveType.Quad);
                q.name = i == camadas ? "Verso" : "Papelao";
                var c = q.GetComponent<Collider>(); if (c != null) UnityEngine.Object.DestroyImmediate(c);
                q.transform.SetParent(placa.transform, false);
                q.transform.localPosition = new Vector3(0f, 0f, espessura * i / camadas);
                q.layer = placa.layer;
                var r = q.GetComponent<MeshRenderer>(); r.sharedMaterial = i == camadas ? verso : papelao; r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }
        }

        /// <summary>Figura 3D no lugar da figura do jogo: a malha do OBJ, da altura da figura que some (vezes a escala),
        /// sobre o centro da base, virada como o monstro (mais o giro da ficha).</summary>
        static void MontarFigura(GameObject alvo, Def d, Mesh malha, Bounds b, float altura, Marca marca, List<Renderer> esconder, bool plastico)
        {
            var ancora = new GameObject("@Bigorna-Figura3D");
            ancora.transform.SetParent(alvo.transform, false);
            ancora.transform.position = new Vector3(b.center.x, b.min.y, b.center.z);
            var go = new GameObject("Figura");
            go.transform.SetParent(ancora.transform, false);
            go.layer = alvo.layer;
            go.AddComponent<MeshFilter>().sharedMesh = malha;
            var mr = go.AddComponent<MeshRenderer>(); var mat = MaterialDaFigura(d, esconder); if (mat != null) mr.sharedMaterial = mat;
            var mb = malha.bounds; float alt = Mathf.Max(1e-4f, mb.size.y);
            var s = alvo.transform.lossyScale; float sx = Mathf.Abs(s.x) < 1e-4f ? 1f : Mathf.Abs(s.x), sy = Mathf.Abs(s.y) < 1e-4f ? 1f : Mathf.Abs(s.y), sz = Mathf.Abs(s.z) < 1e-4f ? 1f : Mathf.Abs(s.z);
            float k = altura / alt;
            go.transform.localScale = new Vector3(k / sx, k / sy, k / sz);
            go.transform.localRotation = Quaternion.Euler(0f, d.Giro, 0f);
            // pe no chao e centro da malha sobre a ancora
            var centro = go.transform.localRotation * new Vector3(mb.center.x * k / sx, 0f, mb.center.z * k / sz);
            go.transform.localPosition = new Vector3(-centro.x, -mb.min.y * k / sy, -centro.z);
            marca.Ancora = ancora; marca.Placa = null; marca.Figura = go.transform; marca.Altura = altura / sy;
            Log.Info("  figura 3D no monstro «" + d.Modelo + "» (" + (plastico ? "figura de colocação" : "vista de inimigos") + "): " + esconder.Count + " malha(s) escondida(s), " + altura.ToString("0.00") + " de altura");
        }

        static int SafeVida(SerializedEnemy e) { try { return e != null ? e.Health : 0; } catch { return 0; } }

        public class Marca : MonoBehaviour
        {
            public string Id; public SerializedEnemy Inimigo; public List<Renderer> Escondidos; public GameObject Ancora; public Transform Placa, Figura; public float Altura; public int Vida;
            float _tremor, _fase = UnityEngine.Random.value * 6f;
            public void Desfazer()
            {
                if (Escondidos != null) foreach (var r in Escondidos) if (r != null) r.enabled = true;
                if (Ancora != null) Destroy(Ancora);
                Destroy(this);
            }
            void LateUpdate()
            {
                if (Escondidos != null) foreach (var r in Escondidos) if (r != null && r.enabled) r.enabled = false; // o jogo pode reacender
                if (Ancora == null) return;
                if (Figura != null)
                {
                    // a figura 3D fica parada, virada como o monstro; so treme quando perde vida
                    int v3 = SafeVida(Inimigo); if (Inimigo != null && v3 < Vida) _tremor = 0.4f; Vida = v3;
                    float l3 = 0f; if (_tremor > 0f) { _tremor -= Time.deltaTime; l3 = Mathf.Sin(Time.time * 55f) * 0.05f * Mathf.Clamp01(_tremor / 0.4f); }
                    Ancora.transform.localRotation = Quaternion.Euler(0f, 0f, l3 * 40f);
                    return;
                }
                if (Placa == null) return;
                Camera cam = null;
                try { cam = Jogo.Cena?.CameraEncounter?.Camera; } catch { }
                if (cam == null) cam = Camera.main;
                if (cam != null) { var dd = Ancora.transform.position - cam.transform.position; dd.y = 0f; if (dd.sqrMagnitude > 1e-4f) Ancora.transform.rotation = Quaternion.LookRotation(dd, Vector3.up); }
                int vida = SafeVida(Inimigo); if (Inimigo != null && vida < Vida) _tremor = 0.4f; Vida = vida;
                float t = Time.time + _fase;
                float resp = 1f + Mathf.Sin(t * 1.8f) * 0.015f;
                float lado = 0f; if (_tremor > 0f) { _tremor -= Time.deltaTime; lado = Mathf.Sin(Time.time * 55f) * 0.06f * Mathf.Clamp01(_tremor / 0.4f); }
                var sc = Placa.localScale; Placa.localScale = new Vector3(sc.x, Altura * resp, sc.z);
                Placa.localPosition = new Vector3(lado * sc.x, Altura * resp / 2f, 0f);
            }
        }
    }
}
