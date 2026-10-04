using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>Objetos interativos do mapa: portas, baus, fichas, moveis. Clicaveis pela via do proprio jogo (IClickable).</summary>
    public static class Objetos
    {
        public class NaMesa
        {
            public int Indice;
            public Dmap.Objeto Dados;
            public GameObject Corpo;
            public GameVisibility Vista;
            public bool Usado;
            public int Vezes;
            public string Grupo;          // sala oculta que o cobre
            public bool Escondido;        // fora do tabuleiro agora (por acao ou pela sala)
            public bool EscondidoPorAcao; // hideObject ou "hidden" no mapa: nao aparece quando a sala abre
            public string Rotulo => !string.IsNullOrEmpty(Dados?.Nome) ? Dados.Nome : Nome(Dados?.Tipo);
            public bool Visivel => Corpo != null && Corpo.activeSelf && !Escondido;
        }

        public class Clicavel : MonoBehaviour, IClickable
        {
            public NaMesa Posto;
            public bool Click()
            {
                try { return Objetos.Clicado(Posto); }
                catch (Exception ex) { Log.Erro("ao clicar em «" + (Posto?.Rotulo ?? "?") + "»", ex); return false; }
            }
        }

        /// <summary>Caminhos dos prefabs no bundle do jogo, por tipo do editor.</summary>
        static readonly Dictionary<string, string> Prefabs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Chest"] = "d3/terrain/chest/chest.prefab",
            ["Shelf"] = "d3/terrain/bookshelf/bookshelf.prefab",
            ["Lectern"] = "d3/terrain/altar/altar.prefab",
            ["Well"] = "d3/terrain/well/well.prefab",
            ["Cauldron"] = "d3/terrain/cauldron/terrain_cauldron.prefab",
            ["Door"] = "d3/terrain/door/door.prefab",
            ["SightToken"] = "d3/tokens/exploration token/exploration token.prefab",
            ["InteractToken"] = "d3/tokens/interact token/interact token.prefab",
            ["Bell"] = "d3/terrain/bell/bell.prefab",
            ["BellFrame"] = "d3/terrain/bell/bell.prefab",   // a moldura do sino sozinha: o mesmo prefab, sem o sino (SemSino)
            ["BloodShrine"] = "d3/terrain/bloodshrine/blood shrine.prefab",
            ["Fire"] = "d3/terrain/fire/fire.prefab",
            ["Ladder"] = "d3/terrain/ladder/short/ladder_short.prefab",
            ["LadderMedium"] = "d3/terrain/ladder/medium/ladder_medium.prefab",
            ["Statue"] = "d3/terrain/statue/statue.prefab",
            ["Wagon"] = "d3/terrain/wagon/wagon.prefab",
            ["Vault"] = "d3/terrain/platform&vault/vault.prefab",
            ["Platform"] = "d3/terrain/platform&vault/platform.prefab",
            ["Archway"] = "d3/terrain/archway/archway.prefab",
            ["Barricade"] = "d3/terrain/spiked barricade/spiked barricade.prefab",
            ["Bridge"] = "d3/terrain/bridge/bridge.prefab",
            ["DragonArch"] = "d3/terrain/dragonarch/terrain_dragonarch.prefab",
            ["DragonHead"] = "d3/terrain/dragonhead/terrain_dragonhead.prefab",
            ["Gate"] = "d3/terrain/gate/gate.prefab",
            ["Pillar"] = "d3/terrain/pillar/medium/pillar.prefab",
            ["PillarShort"] = "d3/terrain/pillar/short/pillar_short.prefab",
            ["PillarTall"] = "d3/terrain/pillar/tall/pillar_tall.prefab",
            ["PillarPush"] = "d3/terrain/pillar/medium/pillar (pushable).prefab",
            ["PillarPushShort"] = "d3/terrain/pillar/short/pillar_short.prefab",
            ["RoundTable"] = "d3/terrain/round table/round table.prefab",
            ["Staircase"] = "d3/terrain/staircase/staircase.prefab",
            ["StoneTable"] = "d3/terrain/stone table/stone table.prefab",
            ["Tree"] = "d3/terrain/tree/tree.prefab",
        };

        /// <summary>Tamanho (largura, fundo) em casas de cada tipo, sem rotacao.</summary>
        static readonly Dictionary<string, int[]> Tamanhos = new Dictionary<string, int[]>(StringComparer.OrdinalIgnoreCase)
        {
            // os mesmos do catalogo do editor (DATA.json) e do DescentForge
            ["Shelf"] = new[] { 2, 1 }, ["Door"] = new[] { 2, 1 }, ["Bell"] = new[] { 4, 1 }, ["BellFrame"] = new[] { 4, 1 }, ["Statue"] = new[] { 3, 3 }, ["Wagon"] = new[] { 3, 2 },
            ["Archway"] = new[] { 4, 1 }, ["Barricade"] = new[] { 2, 1 }, ["Bridge"] = new[] { 6, 2 }, ["DragonArch"] = new[] { 7, 6 }, ["DragonHead"] = new[] { 2, 3 },
            ["Gate"] = new[] { 2, 1 }, ["Staircase"] = new[] { 3, 2 }, ["StoneTable"] = new[] { 2, 1 },
        };

        static readonly Dictionary<string, string> NomesPt = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Chest"] = "Baú", ["Shelf"] = "Estante", ["Lectern"] = "Altar", ["Well"] = "Poço", ["Cauldron"] = "Caldeirão", ["Door"] = "Porta",
            ["SightToken"] = "Ponto de interesse", ["InteractToken"] = "Ficha de interação", ["Bell"] = "Sino", ["BloodShrine"] = "Santuário",
            ["Fire"] = "Fogo", ["Ladder"] = "Escada de mão", ["Statue"] = "Estátua", ["Wagon"] = "Carroça", ["Vault"] = "Cofre", ["Platform"] = "Plataforma",
            ["Archway"] = "Arco", ["Barricade"] = "Barricada", ["Bridge"] = "Ponte", ["Gate"] = "Portão", ["Pillar"] = "Pilar", ["PillarShort"] = "Pilar baixo", ["PillarPush"] = "Pilar interativo", ["PillarPushShort"] = "Pilar interativo baixo", ["PillarTall"] = "Pilar alto", ["Staircase"] = "Escadaria",
            ["Tree"] = "Árvore", ["RoundTable"] = "Mesa redonda", ["StoneTable"] = "Mesa de pedra",
            ["LadderMedium"] = "Escada de mão média", ["DragonArch"] = "Arco do dragão", ["DragonHead"] = "Cabeça de dragão", ["BellFrame"] = "Moldura do sino",
        };

        static readonly Dictionary<string, string> NomesEn = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Chest"] = "Chest", ["Shelf"] = "Bookshelf", ["Lectern"] = "Lectern", ["Well"] = "Well", ["Cauldron"] = "Cauldron", ["Door"] = "Door",
            ["SightToken"] = "Point of interest", ["InteractToken"] = "Interaction token", ["Bell"] = "Bell", ["BloodShrine"] = "Blood shrine",
            ["Fire"] = "Fire", ["Ladder"] = "Ladder", ["Statue"] = "Statue", ["Wagon"] = "Wagon", ["Vault"] = "Vault", ["Platform"] = "Platform",
            ["Archway"] = "Archway", ["Barricade"] = "Spiked barricade", ["Bridge"] = "Bridge", ["Gate"] = "Gate", ["Pillar"] = "Pillar", ["PillarShort"] = "Short pillar", ["PillarPush"] = "Interactive pillar", ["PillarPushShort"] = "Short interactive pillar", ["PillarTall"] = "Tall pillar", ["Staircase"] = "Staircase",
            ["Tree"] = "Tree", ["RoundTable"] = "Round table", ["StoneTable"] = "Stone table",
            ["LadderMedium"] = "Medium ladder", ["DragonArch"] = "Dragon arch", ["DragonHead"] = "Dragon head", ["BellFrame"] = "Bell frame",
        };
        static Dictionary<string, string> Nomes => Idioma.Pt ? NomesPt : NomesEn;

        public static readonly List<NaMesa> Postos = new List<NaMesa>();
        public static int[] TamanhoDe(string tipo) => tipo != null && Tamanhos.TryGetValue(tipo, out var t) ? t : new[] { 1, 1 };
        static readonly Dictionary<string, GameObject> _prefabs = new Dictionary<string, GameObject>(StringComparer.OrdinalIgnoreCase);
        public static Action<NaMesa, SerializedPlayer> AoUsar; // o motor de gatilhos se pendura aqui

        public static bool EhEscadaDeMao(string tipo) => string.Equals(tipo, "Ladder", StringComparison.OrdinalIgnoreCase) || string.Equals(tipo, "LadderMedium", StringComparison.OrdinalIgnoreCase);
        public static string Nome(string tipo) => tipo != null && Nomes.TryGetValue(tipo, out var n) ? n : (tipo ?? Idioma.T("objeto", "object"));

        public static void Limpar()
        {
            Postos.Clear();
            _prefabs.Clear();
        }

        public static NaMesa Pegar(int indice) => indice >= 0 && indice < Postos.Count ? Postos[indice] : null;
        public static bool Usado(int indice) => Pegar(indice)?.Usado == true;

        public static IEnumerator Colocar(Dmap m)
        {
            Postos.Clear();
            var lista = m.Spawns.Objetos;
            if (lista.Count == 0) yield break;
            for (int i = 0; i < 60 && !Jogo.GradePronta; i++) yield return null;
            yield return CarregarPrefabs(lista.Select(o => o.Tipo).Concat(lista.Any(o => !string.IsNullOrEmpty(o.Proprio)) ? new[] { "InteractToken" } : new string[0]).Distinct(StringComparer.OrdinalIgnoreCase));
            var enc = Jogo.Encontro;
            bool terreno = false; var iniciais = new List<NaMesa>();
            for (int i = 0; i < lista.Count; i++)
            {
                var o = lista[i];
                var posto = new NaMesa { Indice = i, Dados = o };
                Postos.Add(posto);
                if (!o.TemPosicao) { Log.Info("  objeto #" + i + " «" + posto.Rotulo + "» sem posição: fica só na mesa"); continue; }
                try
                {
                    var corpo = Corpo(o.Tipo);
                    if (corpo == null) { Log.Info("  «" + o.Tipo + "» sem prefab: só na mesa (" + o.X + "," + o.Y + ")"); continue; }
                    if (o.EhTerreno && Tabuleiro.PlantarTerreno(corpo, o, enc.transform) != null)
                    {
                        posto.Corpo = corpo;
                        posto.Vista = corpo.GetComponent<GameVisibility>();
                        foreach (var gi in corpo.GetComponentsInChildren<GameInteractable>(true)) gi.enabled = false;
                        terreno = true;
                    }
                    else
                    {
                        Plantar(corpo, posto, enc.transform);
                        if (!string.IsNullOrEmpty(o.Proprio)) try { Oficina.VestirObjeto(corpo, o, m.ObjetoDaOficina(o.Proprio), posto); } catch (Exception ex) { Log.Erro("vestindo o objeto da Oficina «" + posto.Rotulo + "»", ex); }
                    }
                    posto.Grupo = !string.IsNullOrEmpty(o.Revelar) ? o.Revelar : GrupoDoObjeto(o);
                    posto.EscondidoPorAcao = o.Escondido;
                    Mostrar(posto, false);
                    if (o.DaPeca >= 0) { /* pilar de sustentacao: aparece junto com a sua peca (Tabuleiro) */ }
                    else if (!string.IsNullOrEmpty(posto.Grupo)) Log.Info("  «" + posto.Rotulo + "» espera a sala «" + posto.Grupo + "»");
                    else if (!o.Escondido) iniciais.Add(posto); // aparecem em grupos, quando o aviso do grupo sair
                }
                catch (Exception ex) { Log.Erro("plantando «" + o.Tipo + "»", ex); }
            }
            ApresentarEmGrupos(iniciais);
            if (terreno) { yield return null; Tabuleiro.RefazerGradeAgora(); }
            Log.Info("objetos do mapa: " + Postos.Count + " (" + Postos.Count(p => p.Corpo != null) + " no tabuleiro)");
        }

        /// <summary>Sala oculta que cobre o objeto: qualquer casa do seu quadro (ou das quatro ao redor do cruzamento).</summary>
        static string GrupoDoObjeto(Dmap.Objeto o)
        {
            if (o.NoCruzamento)
            {
                foreach (var d in new[] { (0, 0), (-1, 0), (0, -1), (-1, -1) })
                {
                    var g = Tabuleiro.GrupoDe(o.X + d.Item1, o.Y + d.Item2);
                    if (!string.IsNullOrEmpty(g)) return g;
                }
                return null;
            }
            foreach (var (x, y) in Oficina.CasasDoObjeto(o, TamanhoDe(o.Tipo)))
            {
                var g = Tabuleiro.GrupoDe(x, y);
                if (!string.IsNullOrEmpty(g)) return g;
            }
            return null;
        }

        static IEnumerator CarregarPrefabs(IEnumerable<string> tipos)
        {
            var ab = Jogo.Persistente?.ABLoader;
            if (ab == null) yield break;
            foreach (var tipo in tipos)
            {
                if (string.IsNullOrEmpty(tipo) || _prefabs.ContainsKey(tipo)) continue;
                if (!Prefabs.TryGetValue(tipo, out var caminho)) { Log.Info("  tipo de objeto sem prefab conhecido: " + tipo); continue; }
                GameObject prefab = null;
                try { prefab = ab.LoadAsset<GameObject>(caminho); } catch { }
                if (prefab == null)
                {
                    string bundle = null;
                    try { bundle = ab.GetBundleName(caminho); } catch (Exception ex) { Log.Info("  bundle de «" + tipo + "»: " + ex.Message); }
                    if (!string.IsNullOrEmpty(bundle))
                    {
                        bool ja = false; try { ja = ab.IsLoaded(bundle); } catch { }
                        if (!ja) yield return ab.CoroutineLoadBundle(bundle);
                        try { prefab = ab.LoadAsset<GameObject>(caminho); } catch (Exception ex) { Log.Info("  «" + tipo + "» após carregar: " + ex.Message); }
                    }
                }
                if (prefab != null) { _prefabs[tipo] = prefab; Log.Info("  prefab de «" + tipo + "»: ok"); }
                else Log.Info("  prefab de «" + tipo + "» não carregou (" + caminho + ")");
            }
        }

        static GameObject Corpo(string tipo)
        {
            if (string.IsNullOrEmpty(tipo) || !_prefabs.TryGetValue(tipo, out var prefab)) return null;
            var go = UnityEngine.Object.Instantiate(prefab);
            go.name = "@Bigorna-" + tipo;
            if (string.Equals(tipo, "BellFrame", StringComparison.OrdinalIgnoreCase)) try { SemSino(go); } catch (Exception ex) { Log.Info("  moldura do sino: " + ex.Message); }
            return go;
        }

        /// <summary>A moldura do sino sozinha (na caixa do ato II ela se separa do sino): as malhas do prefab do sino perdem os
        /// triangulos do sino (o que pende no vao, abaixo da verga, e as cordas); ficam os pes e o arco. As malhas sao do jogo,
        /// copiadas em memoria; o arquivo do jogo fica intacto.</summary>
        static void SemSino(GameObject go)
        {
            int malhas = 0, tirados = 0;
            foreach (var mf in go.GetComponentsInChildren<MeshFilter>(true))
            {
                var m = mf.sharedMesh;
                if (m == null || !m.isReadable || m.bounds.extents.z < 1.5f) continue;   // so as malhas do arco inteiro (largura ~4 casas)
                var v = m.vertices;
                var nova = UnityEngine.Object.Instantiate(m);
                nova.name = m.name + " (moldura)";
                for (int sub = 0; sub < m.subMeshCount; sub++)
                {
                    var t = m.GetTriangles(sub); var fica = new List<int>(t.Length);
                    for (int i = 0; i + 2 < t.Length; i += 3)
                    {
                        if (DoSino(v[t[i]], v[t[i + 1]], v[t[i + 2]])) { tirados++; continue; }
                        fica.Add(t[i]); fica.Add(t[i + 1]); fica.Add(t[i + 2]);
                    }
                    nova.SetTriangles(fica, sub);
                }
                mf.sharedMesh = nova; malhas++;
            }
            Log.Info("  moldura do sino: " + tirados + " triângulo(s) do sino tirados de " + malhas + " malha(s)");
        }

        /// <summary>Um triangulo do sino, no espaco da malha (z ao longo do arco, y para cima): no vao (|z| &lt; 0,85) abaixo da
        /// verga (y &lt; 2,55), ou uma corda (fina e em pe, perto do meio).</summary>
        public static bool DoSino(Vector3 a, Vector3 b, Vector3 c)
        {
            float cz = (a.z + b.z + c.z) / 3f, cy = (a.y + b.y + c.y) / 3f;
            if (Mathf.Abs(cz) < 0.85f && cy < 2.55f) return true;
            float ez = Mathf.Max(a.z, Mathf.Max(b.z, c.z)) - Mathf.Min(a.z, Mathf.Min(b.z, c.z));
            float ey = Mathf.Max(a.y, Mathf.Max(b.y, c.y)) - Mathf.Min(a.y, Mathf.Min(b.y, c.y));
            return Mathf.Abs(cz) < 0.5f && ey > 0.1f && ey > 2f * ez;
        }

        static void Plantar(GameObject corpo, NaMesa posto, Transform pai)
        {
            var o = posto.Dados;
            corpo.transform.SetParent(pai, true);
            corpo.SetActive(true);
            // a escada de mao do jogo, girada 0, sobe para -x (como a escadaria); a seta do editor, girada 0, aponta +x: meia volta
            corpo.transform.rotation = Quaternion.Euler(0f, o.Rot + (EhEscadaDeMao(o.Tipo) ? 180 : 0), 0f);
            // pilares no cruzamento: o canto superior esquerdo da casa (x,y) e o ponto (x-0,5, -(y-0,5)) do mundo;
            // ficam ligeiramente afundados (-0,08), como nas missoes oficiais, para o topo encaixar na peca elevada
            var centro = o.NoCruzamento ? new Vector2(o.X - 0.5f, o.Y - 0.5f) : Centro(o);
            float altura = Tabuleiro.AlturaEm(o.X, o.Y, o.Nivel) + (o.EhPilar ? -0.08f : 0f);
            corpo.transform.position = new Vector3(centro.x, altura, -centro.y);
            posto.Corpo = corpo;

            // desliga a logica da missao original que vem no prefab (arvores de dialogo, interativos do jogo)
            foreach (var arvore in corpo.GetComponentsInChildren<NodeCanvas.DialogueTrees.DialogueTreeController>(true))
            {
                try { if (arvore.isRunning) arvore.StopBehaviour(); } catch { }
                arvore.enabled = false;
            }
            foreach (var gi in corpo.GetComponentsInChildren<GameInteractable>(true))
            {
                gi.DTController = null;
                gi.DTControllerPreview = null;
                gi.DefaultPreview = false;
                gi.OnlyInteractWithClick = false;
                gi.enabled = false;
            }
            // nosso clicavel: um clone do collider, para o jogo nos entregar o clique
            int n = 0;
            bool soMoldura = SemClique(o.Tipo);
            foreach (var col in corpo.GetComponentsInChildren<Collider>(true))
            {
                if (col == null || col.isTrigger) continue;
                // a moldura do sino sozinha e so passagem, como o arco: sem clique nem selecao (nao toma o clique do portao nela)
                if (soMoldura) { col.enabled = false; continue; }
                var go = new GameObject("@Bigorna-Clicavel") { layer = col.gameObject.layer };
                go.transform.SetParent(col.transform, false);
                go.transform.localPosition = Vector3.zero;
                go.transform.localRotation = Quaternion.identity;
                go.transform.localScale = Vector3.one;
                var clone = Clonar(col, go);
                if (clone == null) { UnityEngine.Object.Destroy(go); continue; }
                col.enabled = false;
                go.AddComponent<Clicavel>().Posto = posto;
                n++;
            }
            posto.Vista = corpo.GetComponent<GameVisibility>();
            if (posto.Vista != null) posto.Vista.AnimShow = GameVisibility.VisibilityAnimationTypes.Drop;
            Log.Info("  «" + posto.Rotulo + "» (" + o.Tipo + ") em " + o.X + "," + o.Y + " · " + (soMoldura ? "moldura, sem clique" : n + " collider(s)" + (n == 0 ? "  ← SEM COLLIDER, não dá para clicar" : "")));
        }

        /// <summary>Pecas que sao so passagem (como o arco comum, que nao tem collider): nao recebem clique nem selecao.</summary>
        public static bool SemClique(string tipo) => string.Equals(tipo, "BellFrame", StringComparison.OrdinalIgnoreCase);

        static Collider Clonar(Collider original, GameObject destino)
        {
            switch (original)
            {
                case BoxCollider b: { var c = destino.AddComponent<BoxCollider>(); c.center = b.center; c.size = b.size; return c; }
                case SphereCollider s: { var c = destino.AddComponent<SphereCollider>(); c.center = s.center; c.radius = s.radius; return c; }
                case CapsuleCollider cp: { var c = destino.AddComponent<CapsuleCollider>(); c.center = cp.center; c.radius = cp.radius; c.height = cp.height; c.direction = cp.direction; return c; }
                case MeshCollider m: { var c = destino.AddComponent<MeshCollider>(); c.sharedMesh = m.sharedMesh; c.convex = true; return c; }
                default: { var b2 = original.bounds; var c = destino.AddComponent<BoxCollider>(); c.center = destino.transform.InverseTransformPoint(b2.center); c.size = b2.size; return c; }
            }
        }

        /// <summary>Centro do objeto em coordenadas do mapa, dado o tamanho em casas e a rotacao.</summary>
        static Vector2 Centro(Dmap.Objeto o)
        {
            var casas = Oficina.CasasDoObjeto(o, TamanhoDe(o.Tipo)).ToList();
            if (!string.IsNullOrEmpty(o.Proprio) && casas.Count > 0)
            {
                // a ficha fica na casa mais perto do centro (a forma pode nao ser um retangulo)
                float mx = (float)casas.Average(c => c.Item1), my = (float)casas.Average(c => c.Item2);
                var perto = casas.OrderBy(c => (c.Item1 - mx) * (c.Item1 - mx) + (c.Item2 - my) * (c.Item2 - my)).First();
                return new Vector2(perto.Item1, perto.Item2);
            }
            int[] tam = TamanhoDe(o.Tipo);
            int w = tam[0], h = tam[1];
            if (o.Rot % 180 != 0) { var tmp = w; w = h; h = tmp; }
            return new Vector2(o.X + (w - 1) / 2f, o.Y + (h - 1) / 2f);
        }

        public static void Mostrar(NaMesa p, bool visivel, bool animar = false)
        {
            if (p == null) return;
            bool estava = !p.Escondido && p.Corpo != null && p.Corpo.activeSelf;
            p.Escondido = !visivel;
            if (p.Corpo == null) return;
            // ja a vista (um objeto trancado que "reabre"): nada a refazer; antes a queda de entrada tocava de novo e ele piscava
            if (visivel && estava) { foreach (var c in p.Corpo.GetComponentsInChildren<Clicavel>(true)) c.gameObject.SetActive(true); return; }
            // saindo durante o jogo (uma porta aberta, um objeto tirado): sobe e some, como as pecas da mesa, em vez de sumir de uma vez
            if (!visivel && animar && estava && Nucleo.Instancia != null)
            {
                foreach (var c in p.Corpo.GetComponentsInChildren<Clicavel>(true)) c.gameObject.SetActive(false);
                var corpo = p.Corpo;
                Nucleo.Instancia.StartCoroutine(Tabuleiro.Levantar(corpo, 0f, () => { if (p.Escondido && corpo != null) { if (p.Vista != null) p.Vista.SetVisibility(false, false); corpo.SetActive(false); } }));
                return;
            }
            if (visivel)
            {
                p.Corpo.SetActive(true);
                if (p.Vista != null) { p.Vista.AnimShow = GameVisibility.VisibilityAnimationTypes.Drop; p.Vista.SetVisibility(true, true, GameVisibility.GetRandomAnimDelay()); }
                foreach (var c in p.Corpo.GetComponentsInChildren<Clicavel>(true)) c.gameObject.SetActive(true);
            }
            else
            {
                if (p.Vista != null) p.Vista.SetVisibility(false, false);
                p.Corpo.SetActive(false);
            }
        }

        public static void Mostrar(int indice, bool visivel)
        {
            var p = Pegar(indice);
            if (p == null) { Log.Info("  objeto #" + indice + " não existe"); return; }
            if (visivel && !string.IsNullOrEmpty(p.Grupo) && Tabuleiro.GrupoOculto(p.Grupo))
            {
                p.Grupo = null; // pedido explicito: aparece mesmo com a sala fechada
            }
            p.EscondidoPorAcao = !visivel;
            Mostrar(p, visivel, !visivel);
            Log.Info("  objeto «" + p.Rotulo + "» " + (visivel ? "mostrado" : "escondido"));
            // os gemeos acompanham
            foreach (var q in Postos)
                if (q != p && q.Dados != null && q.Dados.Gemeo == indice)
                {
                    if (visivel && !string.IsNullOrEmpty(q.Grupo) && Tabuleiro.GrupoOculto(q.Grupo)) q.Grupo = null;
                    q.EscondidoPorAcao = !visivel; Mostrar(q, visivel);
                }
        }

        /// <summary>Os objetos entram em grupos, como no jogo: um aviso por grupo (ate 4 objetos), com as casas de todos destacadas;
        /// eles aparecem juntos quando o aviso sai.</summary>
        public const int PorGrupo = 4;
        static void ApresentarEmGrupos(List<NaMesa> lista)
        {
            var todos = lista.Where(p => p != null && p.Dados != null).ToList();
            for (int k = 0; k < todos.Count; k += PorGrupo) ApresentarGrupo(todos.Skip(k).Take(PorGrupo).ToList(), k == 0);
        }

        static string LinhaDoObjeto(NaMesa p)
        {
            var o = p.Dados;
            return "• <b>" + p.Rotulo + "</b>" + (string.Equals(p.Rotulo, Nome(o.Tipo)) ? "" : " (" + Nome(o.Tipo) + ")") + (o.NoCruzamento ? Idioma.T(", no canto marcado", ", at the marked corner") : "") + (o.Nivel > 0 ? Idioma.T(", nível ", ", level ") + o.Nivel : "");
        }

        static void ApresentarGrupo(List<NaMesa> grupo, bool primeiro)
        {
            if (grupo.Count == 0) return;
            var casas = new List<Transform>();
            string texto = (grupo.Count == 1 ? Idioma.T("Coloquem o objeto nas casas destacadas:\n", "Place the object on the highlighted spaces:\n") : primeiro ? Idioma.T("Coloquem os objetos nas casas destacadas:\n", "Place the objects on the highlighted spaces:\n") : Idioma.T("E também:\n", "And also:\n")) + string.Join("\n", grupo.Select(LinhaDoObjeto).ToArray());
            Dialogos.Mensagem(texto, () => { foreach (var c in casas) { try { if (c != null) Jogo.Cena?.RemovePersitentHighlight(c); } catch { } } }, Idioma.T("Objetos", "Objects"), () =>
            {
                var centros = new List<Vector3>();
                foreach (var p in grupo)
                {
                    // escondido (hideObject) ou retirado com a peca enquanto o aviso esperava na fila: nao aparece
                    if (p.EscondidoPorAcao) continue;
                    var o = p.Dados;
                    try
                    {
                        var centro = o.NoCruzamento ? new Vector2(o.X - 0.5f, o.Y - 0.5f) : Centro(o);
                        var pos = new Vector3(centro.x, Tabuleiro.AlturaEm(o.X, o.Y, o.Nivel), -centro.y); centros.Add(pos);
                        Mostrar(p, true);
                        // todas as casas que o objeto cobre (uma porta sao duas, uma estatua nove...)
                        if (!o.NoCruzamento)
                            foreach (var (x, y) in Oficina.CasasDoObjeto(o, TamanhoDe(o.Tipo)))
                            {
                                var c = Jogo.CasaDaGrade(new Vector3(x, pos.y, -y));
                                if (c != null && !casas.Contains(c)) { Jogo.Cena?.AddPersistentHighlight(c); casas.Add(c); }
                            }
                    }
                    catch (Exception ex) { Log.Info("  marcando «" + p.Rotulo + "»: " + ex.Message); }
                }
                try { if (centros.Count > 0) { Jogo.Cena?.CameraEncounter?.FocusOn(new Vector3(centros.Average(c => c.x), centros.Average(c => c.y), centros.Average(c => c.z))); Jogo.Som("Place_Generic"); } } catch { }
            });
        }

        /// <summary>Uma sala foi revelada: os objetos dela aparecem, salvo os escondidos por acao: primeiro as portas, depois o resto
        /// (os pilares de sustentacao ja entraram com as pecas).</summary>
        public static void Revelar(string grupo)
        {
            int n = 0;
            var ordem = Postos.Where(p => string.Equals(p.Grupo, grupo, StringComparison.OrdinalIgnoreCase)).OrderBy(p => p.Dados.Tipo == "Door" || p.Dados.Tipo == "Gate" ? 0 : 1).ToList();
            var entram = new List<NaMesa>();
            foreach (var p in ordem)
            {
                p.Grupo = null;
                if (p.Dados.DaPeca >= 0 || p.EscondidoPorAcao || p.Usado) continue;
                entram.Add(p);
                n++;
            }
            ApresentarEmGrupos(entram);
            if (n > 0) Log.Info("  " + n + " objeto(s) da sala «" + grupo + "» apareceram");
        }

        /// <summary>Os pilares de sustentacao de uma peca (indice no .dmap).</summary>
        public static List<NaMesa> PilaresDaPeca(int indicePeca) => Postos.Where(p => p.Dados != null && p.Dados.DaPeca == indicePeca).ToList();

        /// <summary>A peca entrou: os seus pilares aparecem com ela.</summary>
        public static void MostrarPilares(int indicePeca)
        {
            foreach (var p in PilaresDaPeca(indicePeca)) { p.Grupo = null; if (!p.Escondido && p.Corpo != null && p.Corpo.activeSelf) continue; Mostrar(p, true); }
        }

        /// <summary>Uma peca (ou sala) saiu do tabuleiro: os objetos sobre as casas dela e os seus pilares ficam retirados para sempre,
        /// sem esconder o corpo (a mesa o tira na sua vez).</summary>
        public static List<NaMesa> RetirarNasCasas(HashSet<(int, int)> casas, HashSet<int> pecas)
        {
            var saem = new List<NaMesa>();
            foreach (var p in Postos)
            {
                var o = p.Dados; if (o == null || !o.TemPosicao) continue;
                bool sai = pecas.Contains(o.DaPeca);
                if (!sai)
                {
                    if (o.NoCruzamento) sai = new[] { (0, 0), (-1, 0), (0, -1), (-1, -1) }.Any(d => casas.Contains((o.X + d.Item1, o.Y + d.Item2)));
                    else sai = Oficina.CasasDoObjeto(o, TamanhoDe(o.Tipo)).Any(c => casas.Contains(c));
                }
                if (!sai) continue;
                bool estava = p.Visivel && p.Corpo != null && p.Corpo.activeInHierarchy;
                p.EscondidoPorAcao = true; p.Usado = true; p.Grupo = null;
                if (estava) saem.Add(p); else Mostrar(p, false);
            }
            return saem;
        }

        public static List<string> RemoverNasCasas(HashSet<(int, int)> casas, HashSet<int> pecas)
        {
            var nomes = new List<string>();
            foreach (var p in Postos)
            {
                var o = p.Dados; if (o == null || !o.TemPosicao) continue;
                bool sai = pecas.Contains(o.DaPeca);
                if (!sai)
                {
                    if (o.NoCruzamento) sai = new[] { (0, 0), (-1, 0), (0, -1), (-1, -1) }.Any(d => casas.Contains((o.X + d.Item1, o.Y + d.Item2)));
                    else sai = Oficina.CasasDoObjeto(o, TamanhoDe(o.Tipo)).Any(c => casas.Contains(c));
                }
                if (!sai) continue;
                bool estava = p.Visivel;
                p.EscondidoPorAcao = true; p.Usado = true; p.Grupo = null; Mostrar(p, false);
                if (estava && o.DaPeca < 0) nomes.Add(p.Rotulo);
            }
            return nomes;
        }

        // o heroi escolhido no menu: o jogo o desmarca ao apertar o botao sobre algo que ele nao considera interativo
        // (pilar, estatua...), antes do nosso clique chegar; guardamos o ultimo escolhido e quando ele saiu
        static int _ultimoHeroi = -1; static float _heroiSaiuEm = -10f; static int _heroiAgora = -1;
        public static void VigiarHeroi()
        {
            int idx = -1; try { var menu = Jogo.UI?.HeroMenu; idx = menu != null ? menu.SelectedIndex : -1; } catch { }
            if (idx == _heroiAgora) return;
            if (idx < 0 && _heroiAgora >= 0) { _ultimoHeroi = _heroiAgora; _heroiSaiuEm = Time.unscaledTime; }
            _heroiAgora = idx;
        }

        static bool Clicado(NaMesa p)
        {
            // um gemeo: o toque vale pelo objeto de que ele e gemeo
            if (p?.Dados != null && p.Dados.Gemeo >= 0 && p.Visivel) { var m = Pegar(p.Dados.Gemeo); if (m != null && m != p) p = m; }
            if (p == null || !p.Visivel) return false;
            var gc = Jogo.Controle;
            if (gc != null && gc.IsEndingRound) return false;
            if (Dialogos.QuadroVisivel || Dialogos.Ocupado || Dialogos.RecemFechado) return false;
            try
            {
                var es = UnityEngine.EventSystems.EventSystem.current;
                if (es != null && es.IsPointerOverGameObject()) return false; // o clique foi num botao da interface, nao no tabuleiro
            }
            catch { }
            // o som do objeto, como o jogo faz ao tocar numa peca (o som proprio dela; fogo, se estiver em chamas). O clique e
            // nosso (o interativo do jogo esta desligado), entao o som tambem
            SomDoObjeto(p);
            // ja gasto (um bau aberto, um NPC que ja falou): uma resposta em vez de silencio; o heroi escolhido continua escolhido
            // (o mesmo texto ao olhar ou ao usar: o objeto gasto so lembra o que e, e o heroi nao gasta a acao)
            if (p.Usado) { Log.Info("o jogador toca «" + p.Rotulo + "» (objeto #" + p.Indice + "), já gasto"); Dialogos.Mensagem(TextoDoGasto(p), null, p.Rotulo); return true; }
            SerializedPlayer heroi = null;
            try
            {
                var menu = Jogo.UI?.HeroMenu;
                int idx = menu != null ? menu.SelectedIndex : -1;
                // desmarcado pelo jogo no aperto deste mesmo clique: vale o heroi que estava escolhido
                if (idx < 0 && _ultimoHeroi >= 0 && Time.unscaledTime - _heroiSaiuEm < 0.6f) { idx = _ultimoHeroi; Log.Info("  (o jogo tinha desmarcado o herói no aperto do clique; vale o que estava escolhido)"); }
                _ultimoHeroi = -1;
                var herois = Jogo.Herois;
                if (idx >= 0 && idx < herois.Count) heroi = herois[idx];
                if (menu != null) menu.SelectedIndex = -1;
            }
            catch { }
            // como no jogo: todo objeto pede um heroi escolhido. O ponto de interesse (SightToken) e explorado sem gastar a acao do
            // heroi (adjacente ou no mesmo espaco); sem heroi, o toque so mostra o que o objeto e: o texto de olhar e, num ponto
            // de interesse, como explorar (as palavras do jogo)
            bool pontoDeInteresse = string.Equals(p.Dados?.Tipo, "SightToken", StringComparison.OrdinalIgnoreCase);
            if (heroi == null)
            {
                Log.Info("o jogador olha «" + p.Rotulo + "» (objeto #" + p.Indice + ")");
                var previa = p.Usado && !string.IsNullOrEmpty(p.Dados?.TextoGasto) ? p.Dados.TextoGasto : p.Dados?.Previa;
                string texto;
                if (pontoDeInteresse)
                    texto = (!string.IsNullOrEmpty(previa) ? previa + "\n\n" : "")
                        + Idioma.T("<b>Ponto de interesse.</b> Para explorar, escolham um herói (toquem no retrato dele) e toquem aqui. Explorar não gasta a ação do herói; ele precisa estar adjacente ao marcador (a diagonal vale) ou no mesmo espaço.",
                            "<b>Point of interest.</b> To explore, choose a hero (tap their portrait) and tap here. Exploring does not use the hero's action; the hero must be adjacent to the token (diagonals count) or in the same space.");
                else texto = !string.IsNullOrEmpty(previa) ? previa : Idioma.T("Para usar, escolham um herói e gastem uma ação com ele neste objeto.", "To use it, choose a hero and spend one of their actions on this object.");
                Dialogos.Mensagem(texto, null, p.Rotulo);
                return true;
            }
            Log.Info("o jogador usa «" + p.Rotulo + "» (objeto #" + p.Indice + ")" + (heroi != null ? " com " + heroi.HeroId : ""));
            // as casas destacadas (onde os herois comecam, ou para onde foram levados) ja cumpriram o papel: os herois estao em jogo
            try { Motor.Acoes.LimparDestinos(); } catch { }
            Usar(p, heroi);
            return true;
        }

        /// <summary>O que um objeto ja gasto diz ao ser tocado, olhando ou com um heroi (o mesmo texto): o seu texto de depois de
        /// gasto, ou "nada mais a fazer"; e o aviso de que o toque nao custa a acao do heroi.</summary>
        public static string SemAcao => Idioma.T("<i>(Já usado: tocar aqui não gasta a ação do herói.)</i>", "<i>(Already used: tapping here does not use the hero's action.)</i>");
        public static string TextoDoGasto(NaMesa p) =>
            (!string.IsNullOrEmpty(p?.Dados?.TextoGasto) ? p.Dados.TextoGasto : Motor.Roteiro.NadaMais) + "\n\n" + SemAcao;

        static void SomDoObjeto(NaMesa p)
        {
            try
            {
                if (p?.Corpo == null) return;
                var vis = p.Corpo.GetComponentInChildren<GameVisibility>(true);
                string ev = null;
                if (vis != null && vis.IsOnFire) ev = "Interact_Fire";
                else { var ae = p.Corpo.GetComponentInChildren<AudioEvents>(true); if (ae != null && ae.EventOnInteract != null) ev = ((object)ae.EventOnInteract).ToString(); }
                if (!string.IsNullOrEmpty(ev)) { Jogo.Som(ev); Log.Info("  som do objeto: " + ev); }
            }
            catch (Exception ex) { Log.Info("  som do objeto: " + ex.Message); }
        }

        /// <summary>O ultimo heroi que usou um objeto: "@actor" numa cena (quem fala ou quem aparece) e "{actor}" no texto.</summary>
        public static SerializedPlayer QuemUsou;

        public static void Usar(NaMesa p, SerializedPlayer heroi)
        {
            if (p == null) return;
            // ja gasto: o clique de um heroi recebe uma resposta, em vez de nada
            if (p.Usado) { if (heroi != null) Dialogos.Mensagem(TextoDoGasto(p), null, p.Rotulo); return; }
            p.Vezes++;
            if (heroi != null) QuemUsou = heroi;   // ("@actor" nas cenas: o heroi que usou o objeto)
            var tipo = p.Dados?.Tipo ?? "";
            if (Gasto(p)) p.Usado = true;
            if (!string.IsNullOrEmpty(p.Dados?.Texto)) Dialogos.Mensagem(p.Dados.Texto, null, p.Rotulo);
            // sem texto de uso e sem gatilho que faca algo: mostra o texto de olhar, para o uso nao passar em branco
            else if (!string.IsNullOrEmpty(p.Dados?.Previa) && !Motor.Roteiro.FazAlgoAoUsar(p.Indice)) Dialogos.Mensagem(p.Dados.Previa, null, p.Rotulo);
            try { AoUsar?.Invoke(p, heroi); } catch (Exception ex) { Log.Erro("ao usar «" + p.Rotulo + "»", ex); }
            // a porta (ou o portao) aberta sai da mesa depois dos gatilhos, e so se abriu mesmo: trancada, ela "reabre" e fica
            if (p.Usado && (tipo == "Door" || tipo == "Gate")) Mostrar(p, false, true);
            // uma ficha de interacao gasta, sem texto de cenario, ja nao serve para nada: sai da mesa (como no jogo). Com texto de
            // gasto ela compoe a sala e fica; um objeto da Oficina (vestido como ficha) tambem fica
            else if (p.Usado && tipo == "InteractToken" && string.IsNullOrEmpty(p.Dados?.TextoGasto) && string.IsNullOrEmpty(p.Dados?.Proprio)) { Log.Info("  «" + p.Rotulo + "» gasta: sai da mesa"); Mostrar(p, false, true); }
        }

        /// <summary>Leva um objeto a outra casa (o protegido da escolta vai ao lado do marco que ativou). A figura desliza.</summary>
        public static void Mover(int indice, int x, int y, int nivel)
        {
            var p = Pegar(indice); if (p?.Dados == null) { Log.Info("  mover: objeto #" + indice + " não existe"); return; }
            p.Dados.Pos = new[] { x, y }; p.Dados.Nivel = nivel;
            if (p.Corpo == null) return;
            var o = p.Dados; var centro = o.NoCruzamento ? new Vector2(o.X - 0.5f, o.Y - 0.5f) : Centro(o);
            var alvo = new Vector3(centro.x, Tabuleiro.AlturaEm(o.X, o.Y, o.Nivel), -centro.y);
            Nucleo.Instancia?.StartCoroutine(Deslizar(p.Corpo.transform, alvo));
            Log.Info("  «" + p.Rotulo + "» vai para " + x + "," + y);
        }
        static System.Collections.IEnumerator Deslizar(Transform t, Vector3 alvo)
        {
            var de = t.position; float d = 0.6f;
            for (float k = 0; k < d && t != null; k += Time.deltaTime) { t.position = Vector3.Lerp(de, alvo, Mathf.SmoothStep(0, 1, k / d)); yield return null; }
            if (t != null) t.position = alvo;
        }

        public static void Usar(int indice)
        {
            var p = Pegar(indice);
            if (p == null) { Log.Info("  objeto #" + indice + " não existe"); return; }
            Usar(p, null);
        }

        static bool Gasto(NaMesa p)
        {
            var usos = (p.Dados?.Usos ?? "").Trim().ToLowerInvariant();
            if (usos == "always" || usos == "sempre" || usos == "infinite" || usos == "infinito" || usos == "inf" || usos == "0") return false;
            if (int.TryParse(usos, out var n) && n > 0) return p.Vezes >= n;
            return true; // um uso, como no jogo
        }

        public static void Reabrir(int indice)
        {
            var p = Pegar(indice);
            if (p == null) return;
            p.Usado = false;
            p.Vezes = 0;
            Mostrar(p, true);   // (ja a vista: fica como esta, sem piscar)
        }
    }
}
