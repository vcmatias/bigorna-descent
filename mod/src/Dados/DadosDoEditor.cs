using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using Bigorna.Encontro;
using FFG.Core;
using FFG.D3;
using FFG.D3.WorldMap;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Bigorna.Dados
{
    /// <summary>
    /// Dados do jogo para o editor Bigorna Rooms, tirados da copia do jogo de quem joga. O editor publicado nao traz
    /// nada do jogo: na primeira vez que o jogo abre com o Bigorna (e a cada versao nova do jogo ou deste formato),
    /// o mod grava, na pasta Editor dos dados do jogo, o editor (Bigorna-Salas.html, embutido na DLL) e ao lado dele
    /// bigorna-game-data.js (pecas, catalogo de monstros, itens, personagens, herois, facanhas, receitas, textos em
    /// ingles, retratos, sons, destinos do mapa-mundi). O mapa-mundi so existe na cena dele: a imagem e fotografada
    /// na primeira visita ao mapa-mundi de cada ato e vai para bigorna-worldmap.js.
    /// </summary>
    public static class DadosDoEditor
    {
        /// <summary>Sobe quando o que se grava muda; um arquivo com outro carimbo e refeito.</summary>
        public const int Formato = 4;   // 3: figuras (miniaturas por tipo de monstro das caixas do jogador); 4: textos na lingua do jogo, missoes originais

        public static string Pasta => Path.Combine(Application.persistentDataPath, "Editor");
        public static string ArquivoDados => Path.Combine(Pasta, "bigorna-game-data.js");
        public static string ArquivoMapa => Path.Combine(Pasta, "bigorna-worldmap.js");
        public static string ArquivoEditor => Path.Combine(Pasta, "Bigorna-Salas.html");
        const string RecursoEditor = "Bigorna.Salas.html";

        public static bool Gerando { get; private set; }
        public static string Situacao { get; private set; }
        static float _situacaoAte;
        static bool _verificado;
        static readonly HashSet<string> _mapasVistos = new HashSet<string>();
        static string Carimbo => "formato " + Formato + "; jogo " + Application.version + "; lingua " + LinguaDoJogo();
        static string PastaBundles => Path.Combine(Application.streamingAssetsPath, "bundles");

        /// <summary>A lingua em que o jogo esta (codigo do I2: en, pt, es…); os textos do editor saem nela, com o ingles de reserva.</summary>
        public static string LinguaDoJogo()
        {
            try { var c = FFGLocalization.GetCurrentLanagueCode(); return string.IsNullOrEmpty(c) ? "en" : c.ToLowerInvariant(); }
            catch { return "en"; }
        }

        // ------------------------------------------------------------------ entrada

        /// <summary>Na tela de titulo: instala o editor e, se preciso, refaz os dados (uma vez por sessao).</summary>
        public static void NoTitulo()
        {
            try { InstalarEditor(); } catch (Exception ex) { Log.Erro("instalando o editor", ex); }
            if (_verificado || Gerando) return;
            _verificado = true;
            if (EmDia())
            {
                Log.Info("dados do editor em dia (" + ArquivoDados + ")");
                if (!TemAlgumMapa()) Avisar(FaltaMapa, 12f);
                return;
            }
            Nucleo.Instancia?.StartCoroutine(Gerar());
        }

        public static void Refazer() { if (!Gerando) Nucleo.Instancia?.StartCoroutine(Gerar()); }

        public static bool EditorInstalado => File.Exists(ArquivoEditor);

        public static void AbrirEditor()
        {
            try { Application.OpenURL("file:///" + (File.Exists(ArquivoEditor) ? ArquivoEditor : Pasta).Replace('\\', '/')); }
            catch (Exception ex) { Log.Info("não abri o editor: " + ex.Message); }
        }

        static bool EmDia()
        {
            try
            {
                if (!File.Exists(ArquivoDados)) return false;
                using (var r = new StreamReader(ArquivoDados))
                {
                    r.ReadLine();
                    var l = r.ReadLine();
                    return l != null && l.Contains(Carimbo + ";");
                }
            }
            catch { return false; }
        }

        /// <summary>Grava o editor embutido na DLL (so a DLL publicada o traz), se o da pasta for diferente.</summary>
        static void InstalarEditor()
        {
            using (var s = typeof(DadosDoEditor).Assembly.GetManifestResourceStream(RecursoEditor))
            {
                if (s == null) return;
                var novo = new byte[s.Length];
                int lidos = 0; while (lidos < novo.Length) { int n = s.Read(novo, lidos, novo.Length - lidos); if (n <= 0) break; lidos += n; }
                Directory.CreateDirectory(Pasta);
                if (File.Exists(ArquivoEditor))
                {
                    var velho = File.ReadAllBytes(ArquivoEditor);
                    if (velho.Length == novo.Length && velho.SequenceEqual(novo)) return;
                }
                File.WriteAllBytes(ArquivoEditor, novo);
                Log.Info("editor instalado: " + ArquivoEditor);
            }
        }

        static void Avisar(string texto, float segundos = 0f)
        {
            Situacao = texto;
            _situacaoAte = segundos > 0 ? Time.unscaledTime + segundos : float.MaxValue;
        }

        static GUIStyle _estilo;
        public static void Desenhar()
        {
            if (string.IsNullOrEmpty(Situacao)) return;
            if (Time.unscaledTime > _situacaoAte) { Situacao = null; return; }
            if (_estilo == null) { _estilo = new GUIStyle(GUI.skin.box) { fontSize = 14, wordWrap = true, alignment = TextAnchor.MiddleLeft, padding = new RectOffset(12, 12, 8, 8) }; _estilo.normal.textColor = new Color(1f, 0.9f, 0.6f); }
            GUI.Box(new Rect(12f, 36f, Mathf.Min(560f, Screen.width - 24f), 46f), Situacao, _estilo);
        }

        // ------------------------------------------------------------------ geracao

        static IEnumerator Gerar()
        {
            Gerando = true;
            Avisar("Bigorna: preparing the editor data from your game…");
            float t0 = Time.realtimeSinceStartup;
            float limite = Time.unscaledTime + 120f;
            while (Time.unscaledTime < limite && (Jogo.Persistente?.ABLoader == null || Contar("Enemies") == 0)) yield return null;
            var ab = Jogo.Persistente?.ABLoader;
            if (ab == null || Contar("Enemies") == 0)
            {
                Log.Info("dados do editor: a coleção do jogo não carregou; tento na próxima vez");
                Avisar("Bigorna: the game collection did not load; the editor data will be made next time.", 12f);
                _verificado = false; Gerando = false; yield break;
            }
            var carregados = new List<string>();
            var g = new Geracao();

            // textos: direto dos arquivos do jogo, na lingua dele (com o ingles de reserva) e com os termos das missoes
            var lingua = LinguaDoJogo();
            TextosDoJogo tx = null; BundlesDoJogo bj = null; string erroTx = null;
            var th = new System.Threading.Thread(() =>
            {
                try { bj = BundlesDoJogo.Abrir(PastaBundles); tx = TextosDoJogo.Ler(bj, lingua, m => Log.Info("textos: " + m)); }
                catch (Exception ex) { erroTx = ex.Message; }
            }) { IsBackground = true };
            th.Start();
            while (th.IsAlive) yield return null;
            if (tx != null && tx.En.Count > 0) { g.UsarTextos(tx); Log.Info("textos do jogo: " + tx.En.Count + " em inglês, " + tx.Local.Count + " em «" + lingua + "»"); }
            else
            {
                Log.Info("textos pelos arquivos falharam (" + erroTx + "); uso o carregador do jogo, em inglês");
                if (!ab.IsLoaded("loc/en")) { yield return ab.CoroutineLoadBundle("loc/en"); carregados.Add("loc/en"); }
                Passo("textos", () => g.LerTextos(ab));
            }
            g.Lingua = lingua;
            Passo("catálogo", () => g.Catalogo());
            Passo("destinos", () => g.Destinos());
            Passo("figuras", () => g.Figuras());
            Passo("fundos, sons e cenas", () => g.Diversos());
            yield return null;

            // pecas
            foreach (var b in new[] { "d3/coreset/tiles", "d3/dle04/tiles" })
            {
                bool ja = false; try { ja = ab.IsLoaded(b); } catch { }
                if (!ja) { yield return ab.CoroutineLoadBundle(b); carregados.Add(b); }
                Passo("peças de " + b, () => g.Pecas(ab, b));
            }
            foreach (var kv in Tabuleiro.PecasDeTerreno)
            {
                string b = null; try { b = ab.GetBundleName(kv.Value); } catch { }
                if (string.IsNullOrEmpty(b)) continue;
                bool ja = false; try { ja = ab.IsLoaded(b); } catch { }
                if (!ja) { yield return ab.CoroutineLoadBundle(b); carregados.Add(b); }
                Passo("peça " + kv.Key, () => g.PecaDeTerreno(ab, kv.Key, kv.Value));
            }
            yield return null;

            // retratos, bundle por bundle
            var porBundle = new Dictionary<string, List<Geracao.Pedido>>();
            foreach (var p in g.Pedidos)
            {
                string b = null; try { b = ab.GetBundleName(p.Caminho); } catch { }
                if (string.IsNullOrEmpty(b)) { g.SemBundle++; continue; }
                if (!porBundle.TryGetValue(b, out var l)) porBundle[b] = l = new List<Geracao.Pedido>();
                l.Add(p);
            }
            int feitos = 0, total = porBundle.Sum(kv => kv.Value.Count);
            foreach (var kv in porBundle.OrderBy(k => k.Key))
            {
                bool ja = false; try { ja = ab.IsLoaded(kv.Key); } catch { }
                if (!ja) yield return ab.CoroutineLoadBundle(kv.Key);
                int n = 0;
                foreach (var p in kv.Value)
                {
                    try { g.Retrato(ab, p); } catch (Exception ex) { g.Falhas++; if (g.Falhas <= 10) Log.Info("retrato «" + p.Caminho + "»: " + ex.Message); }
                    feitos++;
                    if (++n % 12 == 0) { Avisar("Bigorna: preparing the editor data from your game… pictures " + feitos + "/" + total); yield return null; }
                }
                if (!ja && NoTituloAinda()) { try { ab.UnloadBundle(kv.Key); } catch { } }
                yield return null;
            }
            // so solta o que carregou se ainda esta no titulo (fora dele, o jogo pode ter passado a usar o mesmo bundle)
            if (NoTituloAinda()) foreach (var b in carregados) { try { ab.UnloadBundle(b); } catch { } }
            yield return Resources.UnloadUnusedAssets();

            string erro = null;
            try { g.Gravar(ArquivoDados, Carimbo); }
            catch (Exception ex) { erro = ex.Message; Log.Erro("gravando os dados do editor", ex); }
            Serial.Vistos.Clear();
            float dt = Time.realtimeSinceStartup - t0;
            if (erro == null)
            {
                Log.Info("dados do editor gravados em " + dt.ToString("0.0") + " s: " + g.Resumo() + " → " + ArquivoDados);
                Avisar(TemAlgumMapa() ? "Bigorna: editor data ready (" + g.Resumo() + ")." : FaltaMapa, TemAlgumMapa() ? 10f : 16f);
            }
            else Avisar("Bigorna: could not write the editor data: " + erro, 20f);
            Gerando = false;
        }

        static bool NoTituloAinda() => Jogo.CenaAtual() == Scene.Titlescene && (Jogo.Carregador == null || !Jogo.Carregador.IsLoading);

        static void Passo(string nome, Action a)
        {
            try { a(); }
            catch (Exception ex) { Log.Erro("dados do editor: " + nome, ex); }
        }

        static int Contar(string colecao)
        {
            try { return (typeof(UserCollectionManager).GetField("s_all" + colecao, BindingFlags.Static | BindingFlags.NonPublic)?.GetValue(null) as IDictionary)?.Count ?? 0; }
            catch { return 0; }
        }

        /// <summary>Modelos de uma colecao do jogo, sem os que o proprio Bigorna registrou (Oficina, campanhas).</summary>
        static List<T> Todos<T>(string colecao) where T : ModelBase
        {
            var lista = new List<T>();
            try
            {
                if (typeof(UserCollectionManager).GetField("s_all" + colecao, BindingFlags.Static | BindingFlags.NonPublic)?.GetValue(null) is IDictionary d)
                    foreach (var v in d.Values) if (v is T m && m != null && !Nosso(m)) lista.Add(m);
            }
            catch (Exception ex) { Log.Info("coleção " + colecao + ": " + ex.Message); }
            return lista.OrderBy(m => m.Id ?? "", StringComparer.Ordinal).ToList();
        }

        static bool Nosso(ModelBase m)
        {
            var id = m.Id ?? "";
            return (m.name ?? "").StartsWith("Bigorna", StringComparison.Ordinal) || id.StartsWith("B_", StringComparison.Ordinal) || Campanha.MapaMundi.EhNosso(id);
        }

        static string SemD3(string bundle) => string.IsNullOrEmpty(bundle) ? null : (bundle.StartsWith("d3/", StringComparison.OrdinalIgnoreCase) ? bundle.Substring(3) : bundle);

        /// <summary>Chave de uma imagem no editor: o nome do arquivo do caminho, sem o .png (a mesma regra do editor).</summary>
        static string Chave(string caminho)
        {
            if (string.IsNullOrEmpty(caminho)) return null;
            var n = caminho.Split('/').Last();
            return n.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ? n.Substring(0, n.Length - 4) : n;
        }

        // ------------------------------------------------------------------ o conteudo

        class Geracao
        {
            public class Pedido { public string Grupo, Chave, Caminho; public int Lado; }

            readonly Dictionary<string, string> _en = new Dictionary<string, string>();
            readonly JObject _cat = new JObject();
            readonly JObject _ret = new JObject { ["monstros"] = new JObject(), ["itens"] = new JObject(), ["personagens"] = new JObject(), ["herois"] = new JObject() };
            readonly JArray _pecas = new JArray();
            readonly JObject _raiz = new JObject();
            public readonly List<Pedido> Pedidos = new List<Pedido>();
            readonly HashSet<string> _pedidos = new HashSet<string>();
            public int SemBundle, Falhas, Imagens;

            static readonly HashSet<string> Fora = new HashSet<string> { "SpawnSound", "AttackSound", "DefendSound", "DefeatSound", "DefaultLoot", "ColorLight", "ColorDark", "DamageCurve" };

            // ---------------- textos
            public void LerTextos(AssetBundleLoader ab)
            {
                var b = ab.GetBundle("loc/en");
                if (b == null) { Log.Info("dados do editor: loc/en não está carregado"); return; }
                foreach (var ta in b.LoadAllAssets<TextAsset>())
                {
                    if (ta == null) continue;
                    foreach (var linha in Csv(ta.text))
                        if (linha.Count >= 4 && linha[0].Length > 0 && linha[0] != "Key") _en[linha[0]] = linha[3];
                }
            }

            public string Lingua = "en";
            /// <summary>Textos lidos dos arquivos do jogo: o da lingua do jogo por cima do ingles (os campos *_en do editor mostram esse texto).</summary>
            public void UsarTextos(TextosDoJogo tx)
            {
                foreach (var kv in tx.En) _en[kv.Key] = kv.Value;
                foreach (var kv in tx.Local) if (!string.IsNullOrEmpty(kv.Value)) _en[kv.Key] = kv.Value;
            }

            /// <summary>O texto em ingles; sem texto, a propria chave (como o jogo mostra um termo que falta).</summary>
            string L(string k) => k == null ? null : (_en.TryGetValue(k, out var v) && !string.IsNullOrEmpty(v) ? v : k);
            string G(string k) => k != null && _en.TryGetValue(k, out var v) && !string.IsNullOrEmpty(v) ? v : null;
            static string S(JObject j, string k) => j.TryGetValue(k, out var v) && v.Type == JTokenType.String ? (string)v : null;

            void Pedir(string grupo, string chave, string caminho, int lado)
            {
                if (string.IsNullOrEmpty(chave) || string.IsNullOrEmpty(caminho)) return;
                if (!_pedidos.Add(grupo + "|" + chave)) return;
                Pedidos.Add(new Pedido { Grupo = grupo, Chave = chave, Caminho = caminho, Lado = lado });
            }

            // ---------------- catalogo
            public void Catalogo()
            {
                Serial.Vistos.Clear();
                var monstros = new JArray();
                foreach (var m in Todos<EnemyModel>("Enemies"))
                {
                    var j = Serial.Modelo(m, Fora);
                    j["name_en"] = L(m.KeyNameSingular); j["plural_en"] = L(m.KeyNamePlural); j["desc_en"] = L(m.KeyNameDescription);
                    j["defense_en"] = string.IsNullOrEmpty(m.DefensiveKey) ? "" : (_en.TryGetValue(m.DefensiveKey, out var d) ? d : "");
                    j["_bundle"] = SemD3(m.DataAssetBundleName);
                    monstros.Add(j);
                    Pedir("monstros", Chave(m.TextureTabAssetPath), m.TextureTabAssetPath, 256);
                }
                var ativacoes = new JObject();
                foreach (var a in Todos<EnemyActivationModel>("EnemyActivations"))
                {
                    var j = Serial.Modelo(a, Fora);
                    var k = a.Id ?? "";
                    j["_key"] = a.Id;
                    j["text_en"] = G(k + "_ACTIVATION") ?? G(k) ?? "";
                    j["hint_en"] = G(k + "_HINT") ?? "";
                    ativacoes[string.IsNullOrEmpty(k) ? a.name : k] = j;
                }

                var itens = new JArray();
                var vistos = new HashSet<UnityEngine.Object>();
                void Item(ModelBase it, bool comBundle)
                {
                    if (it == null || !vistos.Add(it)) return;
                    var j = Serial.Modelo(it, Fora);
                    j["_cls"] = it.GetType().Name;
                    var k = S(j, "KeyName"); j["name_en"] = !string.IsNullOrEmpty(k) ? L(k) : it.name;
                    var kd = S(j, "KeyDescription") ?? S(j, "KeyDesc") ?? S(j, "DescriptionKey"); j["desc_en"] = !string.IsNullOrEmpty(kd) ? L(kd) : "";
                    if (comBundle) j["_bundle"] = SemD3(S(j, "DataAssetBundleName") ?? BundleDe(S(j, "TextureAssetPath") ?? S(j, "ArmoryAssetPath")));
                    itens.Add(j);
                    foreach (var c in new[] { "TextureAssetPath", "ArmoryAssetPath" }) { var p = S(j, c); Pedir("itens", Chave(p), p, 192); }
                }
                foreach (var x in Todos<ArmorModel>("Armor")) Item(x, false);
                foreach (var x in Todos<TrinketModel>("Trinkets")) Item(x, false);
                foreach (var x in Todos<ConsumableModel>("Consumables")) Item(x, false);
                foreach (var x in Todos<CraftingMaterialModel>("CraftingMaterials")) Item(x, false);
                foreach (var x in Todos<WeaponModel>("Weapons")) Item(x, true);
                foreach (var x in Todos<WeaponPartsModel>("WeaponParts")) Item(x, true);
                // habilidades de arma: nao tem colecao propria; vem das referencias das pecas e armas
                foreach (var x in Serial.Vistos.OfType<WeaponAbilityModel>().Where(x => x != null && !Nosso(x)).OrderBy(x => x.Id, StringComparer.Ordinal).ToList()) Item(x, true);

                var receitas = new JArray();
                foreach (var r in Todos<RecipeModel>("Recipes"))
                {
                    var j = Serial.So(Serial.Modelo(r), "_id", "_act", "IsUpgrade", "BaseItemId", "Ingredients", "CraftedItemId", "Value", "TextureAssetPath");
                    var ing = new JArray();
                    foreach (var x in (j["Ingredients"] as JArray) ?? new JArray()) ing.Add(new JObject { ["id"] = Serial.IdDe(x["Material"]), ["qty"] = x["Qty"] ?? 0 });
                    j["Ingredients"] = ing;
                    receitas.Add(j);
                }
                var loots = new JArray();
                foreach (var l in Todos<LootModel>("Loots"))
                {
                    var j = Serial.Modelo(l);
                    var k = S(j, "KeyName");
                    var o = new JObject { ["_id"] = l.Id, ["name_en"] = !string.IsNullOrEmpty(k) ? L(k) : l.name };
                    foreach (var c in new[] { "CommonMat1", "CommonMat2", "UncommonMat1", "UncommonMat2" }) o[c] = Serial.IdDe(j[c]);
                    loots.Add(o);
                }
                var personagens = new JArray();
                foreach (var p in Todos<StoryCharacterModel>("StoryCharacters"))
                {
                    var j = Serial.Modelo(p, Fora);
                    var k = S(j, "KeyName"); j["name_en"] = !string.IsNullOrEmpty(k) ? L(k) : p.name;
                    personagens.Add(j);
                    foreach (var c in new[] { "TextureAssetPathDefault", "TextureAssetPathActI", "TextureAssetPathActII" }) { var cp = S(j, c); Pedir("personagens", Chave(cp), cp, 256); }
                }
                var herois = new JArray();
                foreach (var h in Todos<HeroModel>("Heroes"))
                {
                    var j = Serial.Modelo(h, Fora);
                    j["_cls"] = "HeroModel";
                    var k = S(j, "KeyName"); j["name_en"] = !string.IsNullOrEmpty(k) ? L(k) : h.name;
                    var kd = S(j, "KeyDescription") ?? S(j, "KeyDesc") ?? S(j, "DescriptionKey"); j["desc_en"] = !string.IsNullOrEmpty(kd) ? L(kd) : "";
                    j["_bundle"] = SemD3(h.DataAssetBundleName);
                    herois.Add(j);
                    Pedir("herois", h.Id, h.TextureAssetPathActI, 256);
                }
                var facanhas = new JArray();
                foreach (var f in Todos<FeatModel>("Feats"))
                {
                    var j = Serial.Modelo(f);
                    var kd = S(j, "KeyDescription") ?? S(j, "KeyDesc") ?? S(j, "DescriptionKey"); j["desc_en"] = !string.IsNullOrEmpty(kd) ? L(kd) : "";
                    facanhas.Add(Serial.So(j, "_id", "_act", "desc_en", "Goal", "HeroSource", "AmountCompletedRequired", "PrerequisiteFeats", "Rewards", "Timing", "WeaponClasses", "EnemyTypes", "ItemType",
                        "HeroInjured", "InteractableType", "EnemyConditions", "GoalIsTotalDamage", "WeaknessDamage", "IsVictory", "MinimumDamage", "SameEnemy"));
                }
                var habilidades = new JArray();
                foreach (var s in Todos<SkillModel>("Skills"))
                {
                    var j = Serial.Modelo(s);
                    var k = S(j, "KeyName"); j["name_en"] = !string.IsNullOrEmpty(k) ? L(k) : s.name;
                    habilidades.Add(Serial.So(j, "_id", "Hero", "name_en", "XPCost"));
                }
                _cat["monstros"] = monstros; _cat["ativacoes"] = ativacoes; _cat["itens"] = itens; _cat["receitas"] = receitas; _cat["loots"] = loots;
                _cat["personagens"] = personagens; _cat["herois"] = herois; _cat["facanhas"] = facanhas; _cat["habilidades"] = habilidades;
            }

            string BundleDe(string caminho)
            {
                if (string.IsNullOrEmpty(caminho)) return null;
                try { return Jogo.Persistente?.ABLoader?.GetBundleName(caminho); } catch { return null; }
            }

            // ---------------- mapa-mundi: pontos dos destinos oficiais (so referencia no editor)
            public void Destinos()
            {
                JArray Lista<T>(string colecao, Func<T, Vector2> coords) where T : ModelBase
                {
                    var a = new JArray();
                    foreach (var q in Todos<T>(colecao))
                    {
                        var c = coords(q);
                        if (c == Vector2.zero) continue;
                        a.Add(new JObject { ["id"] = q.Id, ["name"] = q.name, ["coords"] = new JArray(Math.Round(c.x, 1), Math.Round(c.y, 1)) });
                    }
                    return a;
                }
                _raiz["destinos"] = new JObject { ["quests"] = Lista<QuestModel>("Quests", q => q.MapCoordinates), ["narrativeEvents"] = Lista<NarrativeEventModel>("NarrativeEvents", q => q.MapCoordinates) };
                // todas as missoes do jogo, com a cena de cada uma (o conversor das missoes originais liga o resumo a elas)
                var oficiais = new JArray();
                foreach (var q in Todos<QuestModel>("Quests"))
                {
                    var c = q.MapCoordinates;
                    oficiais.Add(new JObject
                    {
                        ["id"] = q.Id ?? "", ["name"] = q.name ?? "", ["titulo"] = G(q.NameKey) ?? q.name ?? "", ["desc"] = G(q.DescKey) ?? "", ["tipo"] = q.Type.ToString(),
                        ["cena"] = q.SceneAssetPath ?? "", ["coords"] = new JArray(Math.Round(c.x, 1), Math.Round(c.y, 1))
                    });
                }
                _raiz["missoesOficiais"] = oficiais;
            }

            // ---------------- miniaturas: quantas figuras de cada tipo de monstro as caixas do jogador trazem
            public void Figuras()
            {
                var o = new JObject();
                foreach (EnemyTypes t in Enum.GetValues(typeof(EnemyTypes)))
                {
                    int n = 0;
                    try { n = UserCollectionManager.GetEnemyTypeLimits(t); } catch (KeyNotFoundException) { n = 0; } catch { continue; }
                    if (n > 0) o[t.ToString()] = n;
                }
                _raiz["figuras"] = o;
            }

            // ---------------- fundos das caixas de historia, sons, cenas do jogo
            public void Diversos()
            {
                var fundos = new JArray();
                foreach (StoryMessageBackgroundType v in Enum.GetValues(typeof(StoryMessageBackgroundType)))
                {
                    if ((int)v == 0) continue;
                    var partes = v.ToString().Split('_');
                    var nome = partes[0] + string.Concat(partes.Skip(1).Select(p => " " + p.ToLowerInvariant()));
                    fundos.Add(new JObject { ["id"] = (int)v, ["key"] = v.ToString(), ["name_en"] = nome });
                }
                _raiz["backgrounds"] = fundos;
                var sons = new JObject();
                foreach (var (banco, eventos) in Sons.Bancos) sons[banco] = new JArray(eventos);
                _raiz["sounds"] = sons;
                var cenas = new JArray();
                foreach (var c in Todos<CutsceneModel>("Cutscenes"))
                    cenas.Add(new JObject { ["id"] = c.Id, ["act"] = (int)c.Act + 1, ["label"] = "Act " + new string('I', (int)c.Act + 1) + " · " + c.Id });
                _raiz["cutscenes"] = cenas;
            }

            // ---------------- pecas
            public void Pecas(AssetBundleLoader ab, string bundle)
            {
                var lista = ab.LoadAllAssets<GameTile>(bundle);
                if (lista == null) return;
                int ato = bundle.Contains("dle04") ? 2 : 1;
                foreach (var t in lista) if (t != null) { var j = Peca(t, t.name.ToLowerInvariant(), ato); if (j != null) _pecas.Add(j); }
            }

            public void PecaDeTerreno(AssetBundleLoader ab, string id, string caminho)
            {
                var go = ab.LoadAsset<GameObject>(caminho);
                var t = go != null ? go.GetComponent<GameTile>() : null;
                if (t == null) { Log.Info("dados do editor: peça «" + id + "» não carregou"); return; }
                var j = Peca(t, id, 2);
                if (j != null) _pecas.Add(j);
            }

            /// <summary>As casas da peca como o mod as poe no tabuleiro (Tabuleiro.Alinhar e CasasDe): a casa local (0,0) e a
            /// ancora, e cada casa vale pela posicao dela no modelo (x para a direita, z do Unity invertido), com a peca sem
            /// rotacao. As coordenadas locais gravadas em algumas pecas do jogo discordam da posicao; vale a posicao.</summary>
            static JObject Peca(GameTile t, string id, int ato)
            {
                var casas = (t.LocalGridCoords ?? new GameGridCoordinates[0]).Where(c => c != null).ToList();
                if (casas.Count == 0) return null;
                var ancora = casas.FirstOrDefault(c => c.LocalCoordinates.x == 0 && c.LocalCoordinates.y == 0) ?? casas[0];
                var raiz = t.transform;
                var a = raiz.InverseTransformPoint(ancora.transform.position);
                var esc = raiz.lossyScale;
                var cs = casas.Select(c =>
                {
                    var d = raiz.InverseTransformPoint(c.transform.position) - a;
                    return new Vector2Int(Mathf.RoundToInt(d.x * esc.x), Mathf.RoundToInt(-d.z * esc.z));
                }).Distinct().ToList();
                int x0 = cs.Min(c => c.x), x1 = cs.Max(c => c.x), y0 = cs.Min(c => c.y), y1 = cs.Max(c => c.y);
                var j = new JObject
                {
                    ["id"] = id, ["kind"] = t.IsUnderlay ? "underlay" : "tile", ["w"] = x1 - x0 + 1, ["h"] = y1 - y0 + 1,
                    ["cells"] = new JArray(cs.Select(c => new JArray(c.x, c.y))), ["act"] = ato
                };
                if (!t.IsUnderlay) j["floor"] = Chao(t) ?? "flagstone";
                return j;
            }

            /// <summary>O tipo de chao da peca pelo material do modelo (so para o editor escolher a textura do desenho).</summary>
            static string Chao(GameTile t)
            {
                var votos = new Dictionary<string, int>();
                foreach (var r in t.GetComponentsInChildren<Renderer>(true))
                    foreach (var m in r.sharedMaterials)
                    {
                        if (m == null) continue;
                        var n = m.name.ToLowerInvariant();
                        string k = n.StartsWith("stone") ? "flagstone" : n.StartsWith("wood") ? "wood" : n.StartsWith("dirt") ? "dirt" : n.StartsWith("grass") ? "grass" : null;
                        if (k != null) votos[k] = (votos.TryGetValue(k, out var v) ? v : 0) + 1;
                    }
                return votos.Count == 0 ? null : votos.OrderByDescending(kv => kv.Value).First().Key;
            }

            // ---------------- imagens
            public void Retrato(AssetBundleLoader ab, Pedido p)
            {
                string uri = null;
                var tex = ab.LoadAsset<Texture2D>(p.Caminho);
                if (tex != null) uri = Dados.Imagens.DataUri(tex, p.Lado);
                else
                {
                    var s = ab.LoadAsset<Sprite>(p.Caminho);
                    if (s != null) uri = Dados.Imagens.DataUri(s, p.Lado);
                }
                if (uri == null) { Falhas++; return; }
                ((JObject)_ret[p.Grupo])[p.Chave] = uri;
                Imagens++;
            }

            // ---------------- gravacao
            public void Gravar(string arquivo, string carimbo)
            {
                var ordem = new Func<JToken, (int, int, string)>(t =>
                {
                    var id = (string)t["id"] ?? "";
                    if ((string)t["kind"] == "underlay") return (1, 0, id);
                    var num = new string(id.TakeWhile(char.IsDigit).ToArray());
                    return num.Length > 0 ? (0, int.Parse(num), id) : (2, 0, id);
                });
                _raiz["formato"] = Formato;
                _raiz["lang"] = Lingua;
                _raiz["jogo"] = Application.version;
                _raiz["bigorna"] = Bootstrap.Versao;
                _raiz["gerado"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
                _raiz["tiles"] = new JArray(_pecas.OrderBy(ordem));
                _raiz["catalogo"] = _cat;
                _raiz["retratos"] = _ret;
                Directory.CreateDirectory(Path.GetDirectoryName(arquivo));
                var tmp = arquivo + ".tmp";
                using (var sw = new StreamWriter(tmp, false, new UTF8Encoding(false)))
                {
                    sw.WriteLine("// Bigorna Rooms: data read from your own copy of Descent: Legends of the Dark by the Bigorna mod. It holds the game's texts and pictures: keep it to yourself.");
                    sw.WriteLine("// " + carimbo + "; " + DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
                    sw.Write("window.BIGORNA_JOGO = ");
                    using (var jw = new JsonTextWriter(sw) { Formatting = Formatting.None, CloseOutput = false }) _raiz.WriteTo(jw);
                    sw.WriteLine(";");
                }
                if (File.Exists(arquivo)) File.Delete(arquivo);
                File.Move(tmp, arquivo);
            }

            public string Resumo()
            {
                int N(string k) => (_cat[k] as JArray)?.Count ?? (_cat[k] as JObject)?.Count ?? 0;
                return _pecas.Count + " peças, " + N("monstros") + " monstros, " + N("ativacoes") + " ativações, " + N("itens") + " itens, " + N("personagens") + " personagens, "
                    + N("herois") + " heróis, " + N("facanhas") + " façanhas, " + N("receitas") + " receitas, " + Imagens + " imagens" + (Falhas > 0 ? " (" + Falhas + " falharam)" : "")
                    + (SemBundle > 0 ? ", " + SemBundle + " sem bundle" : "") + ", " + _en.Count + " textos";
            }

            /// <summary>CSV com aspas (campos com virgula, aspas dobradas e quebras de linha).</summary>
            static IEnumerable<List<string>> Csv(string texto)
            {
                if (string.IsNullOrEmpty(texto)) yield break;
                var linha = new List<string>(); var campo = new StringBuilder(); bool aspas = false;
                for (int i = 0; i < texto.Length; i++)
                {
                    char c = texto[i];
                    if (aspas)
                    {
                        if (c == '"') { if (i + 1 < texto.Length && texto[i + 1] == '"') { campo.Append('"'); i++; } else aspas = false; }
                        else campo.Append(c);
                        continue;
                    }
                    if (c == '"') aspas = true;
                    else if (c == ',') { linha.Add(campo.ToString()); campo.Clear(); }
                    else if (c == '\r') { }
                    else if (c == '\n') { linha.Add(campo.ToString()); campo.Clear(); yield return linha; linha = new List<string>(); }
                    else campo.Append(c);
                }
                if (campo.Length > 0 || linha.Count > 0) { linha.Add(campo.ToString()); yield return linha; }
            }
        }

        // ------------------------------------------------------------------ mapa-mundi

        /// <summary>No mapa-mundi: fotografa o mapa do ato uma vez (se o arquivo ainda nao tem esse ato).</summary>
        public static void NoMapaMundi()
        {
            string ato = null;
            try { var a = Jogo.Partida?.CurrentAct; if (a.HasValue) ato = "act" + ((int)a.Value + 1); } catch { }
            if (ato == null || _mapasVistos.Contains(ato)) return;
            _mapasVistos.Add(ato);
            if (TemMapa(ato)) { if (!TemCidade(ato)) Nucleo.Instancia?.StartCoroutine(GuardarCidade(ato)); return; }
            Nucleo.Instancia?.StartCoroutine(Fotografar(ato));
        }

        /// <summary>O arquivo do mapa ja tem o lugar da cidade do ato (o editor mostra a cidade no mapa proprio de uma campanha).</summary>
        static bool TemCidade(string ato)
        {
            try { return File.Exists(ArquivoMapa) && File.ReadAllText(ArquivoMapa).Contains("\"cidade_" + ato + "\""); } catch { return false; }
        }

        /// <summary>O lugar da cidade no canvas dos destinos (origem no centro, y para cima), ou null.</summary>
        static JArray LugarDaCidade(WorldMapSceneController c)
        {
            var no = c.DestinationCity;
            if (no == null) return null;
            var p = no.transform.localPosition;
            return new JArray((float)Math.Round(p.x, 1), (float)Math.Round(p.y, 1));
        }

        /// <summary>So o lugar da cidade, num arquivo que ja tem a foto (fotos anteriores a este dado).</summary>
        static IEnumerator GuardarCidade(string ato)
        {
            float limite = Time.unscaledTime + 30f;
            while (Time.unscaledTime < limite && !SingletonBehaviour<WorldMapSceneController>.IsInitialized) yield return null;
            yield return new WaitForSecondsRealtime(2f);
            if (!SingletonBehaviour<WorldMapSceneController>.IsInitialized || Campanha.MapaProprio.Ativo) { _mapasVistos.Remove(ato); yield break; }
            try
            {
                var lugar = LugarDaCidade(SingletonBehaviour<WorldMapSceneController>.Instance);
                if (lugar == null || !File.Exists(ArquivoMapa)) yield break;
                var txt = File.ReadAllText(ArquivoMapa);
                int a = txt.IndexOf('{'), b = txt.LastIndexOf('}');
                if (a < 0 || b <= a) yield break;
                var mapa = JObject.Parse(txt.Substring(a, b - a + 1));
                mapa["cidade_" + ato] = lugar;
                File.WriteAllText(ArquivoMapa, "// Bigorna Rooms: the world map pictured from your own copy of the game. Keep it to yourself.\nwindow.BIGORNA_MAPA = " + mapa.ToString(Formatting.None) + ";\n", new UTF8Encoding(false));
                Log.Info("lugar da cidade do " + ato + " guardado para o editor: " + lugar.ToString(Formatting.None));
            }
            catch (Exception ex) { Log.Erro("guardando o lugar da cidade", ex); }
        }

        /// <summary>Versao da foto: sobe quando o jeito de fotografar muda (a foto antiga e refeita).</summary>
        const int VersaoFoto = 2;

        /// <summary>O editor fica bloqueado ate existir a foto do mapa-mundi de algum ato (quem joga abriu uma campanha ate o mapa).</summary>
        public static bool TemAlgumMapa()
        {
            try { if (!File.Exists(ArquivoMapa)) return false; var t = File.ReadAllText(ArquivoMapa); return t.Contains("\"act1\":\"data:") || t.Contains("\"act2\":\"data:"); } catch { return false; }
        }

        static string FaltaMapa => T("Bigorna: dados do editor prontos. Para liberar o editor, abra uma campanha até o mapa-múndi.",
                                     "Bigorna: editor data ready. To unlock the editor, open a campaign up to the world map.");

        static string T(string pt, string en) => LinguaDoJogo().StartsWith("pt") ? pt : en;

        static bool TemMapa(string ato)
        {
            try { var t = File.Exists(ArquivoMapa) ? File.ReadAllText(ArquivoMapa) : ""; return t.Contains("\"" + ato + "\"") && t.Contains("\"foto\":" + VersaoFoto); } catch { return false; }
        }

        static IEnumerator Fotografar(string ato)
        {
            float limite = Time.unscaledTime + 30f;
            while (Time.unscaledTime < limite && !SingletonBehaviour<WorldMapSceneController>.IsInitialized) yield return null;
            yield return new WaitForSecondsRealtime(4f);
            if (!SingletonBehaviour<WorldMapSceneController>.IsInitialized || Jogo.CenaAtual() != Scene.Worldmap) { _mapasVistos.Remove(ato); yield break; }
            if (Campanha.MapaProprio.Ativo || Campanha.Campanha.Aberta?.Metadados?.MapaProprio?.Arquivo != null) { _mapasVistos.Remove(ato); yield break; }   // o mapa na tela e o de uma campanha
            yield return new WaitForEndOfFrame();
            try
            {
                var c = SingletonBehaviour<WorldMapSceneController>.Instance;
                var jpg = FotoDoMapa(c);
                if (jpg == null) { Log.Info("mapa-múndi: não consegui fotografar"); yield break; }
                var mapa = new JObject();
                if (File.Exists(ArquivoMapa))
                {
                    var txt = File.ReadAllText(ArquivoMapa);
                    int a = txt.IndexOf('{'), b = txt.LastIndexOf('}');
                    if (a >= 0 && b > a) try { mapa = JObject.Parse(txt.Substring(a, b - a + 1)); } catch { }
                }
                mapa["foto"] = VersaoFoto;
                mapa[ato] = "data:image/jpeg;base64," + Convert.ToBase64String(jpg);
                var lugarCidade = LugarDaCidade(c);
                if (lugarCidade != null) mapa["cidade_" + ato] = lugarCidade;
                foreach (var k in mapa.Properties().Where(p => p.Name.StartsWith("teste_")).Select(p => p.Name).ToList()) mapa.Remove(k);
                Directory.CreateDirectory(Pasta);
                File.WriteAllText(ArquivoMapa, "// Bigorna Rooms: the world map pictured from your own copy of the game. Keep it to yourself.\nwindow.BIGORNA_MAPA = " + mapa.ToString(Formatting.None) + ";\n", new UTF8Encoding(false));
                Log.Info("mapa-múndi do " + ato + " fotografado para o editor (" + jpg.Length / 1024 + " KB) → " + ArquivoMapa);
                Avisar(T("Bigorna: mapa-múndi fotografado; o editor está liberado.", "Bigorna: world map pictured; the editor is unlocked."), 8f);
            }
            catch (Exception ex) { Log.Erro("fotografando o mapa-múndi", ex); }
        }

        /// <summary>Uma camera ortografica com o angulo da camera do mapa, enquadrando o quadro que o editor usa (1600x900
        /// unidades do canvas dos destinos, origem no centro). O desenho do mapa e o canvas; os marcadores dos destinos, das
        /// cidades e dos pontos de viagem ficam escondidos so durante a foto.</summary>
        static byte[] FotoDoMapa(WorldMapSceneController c)
        {
            var cam0 = c.CameraWorld != null ? c.CameraWorld.Camera : null;
            if (cam0 == null || c.CanvasWorldmap == null) return null;
            var cv = c.CanvasWorldmap.transform;
            var centro = cv.TransformPoint(Vector3.zero);
            float meiaL = Vector3.Distance(cv.TransformPoint(new Vector3(-800f, 0f, 0f)), cv.TransformPoint(new Vector3(800f, 0f, 0f))) / 2f;
            float meiaA = Vector3.Distance(cv.TransformPoint(new Vector3(0f, -450f, 0f)), cv.TransformPoint(new Vector3(0f, 450f, 0f))) / 2f;
            if (meiaL <= 0 || meiaA <= 0) return null;
            var escondidos = new List<CanvasRenderer>();
            var go = new GameObject("@Bigorna-FotoDoMapa");
            RenderTexture rt = null;
            try
            {
                {
                    var nos = new List<Component>();
                    if (c.DestinationNodes != null) nos.AddRange(c.DestinationNodes.Where(x => x != null).Cast<Component>());
                    if (c.DestinationCity != null) nos.Add(c.DestinationCity);
                    if (c.CityNodes != null) nos.AddRange(c.CityNodes.Where(x => x != null).Cast<Component>());
                    nos.AddRange(UnityEngine.Object.FindObjectsOfType<TravelPoint>());
                    nos.AddRange(UnityEngine.Object.FindObjectsOfType<DestinationNode>());
                    foreach (var n in nos.Distinct())
                        foreach (var r in n.GetComponentsInChildren<CanvasRenderer>(true)) if (!r.cull) { r.cull = true; escondidos.Add(r); }
                }
                var cam = go.AddComponent<Camera>();
                cam.CopyFrom(cam0);
                cam.enabled = false;
                cam.orthographic = true;
                cam.orthographicSize = meiaA;
                cam.aspect = meiaL / meiaA;
                cam.transform.rotation = cam0.transform.rotation;
                float dist = Mathf.Max(1f, Vector3.Dot(centro - cam0.transform.position, cam0.transform.forward));
                cam.transform.position = centro - cam0.transform.forward * dist;
                rt = RenderTexture.GetTemporary(1600, 900, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Default);
                cam.targetTexture = rt;
                cam.Render();
                cam.targetTexture = null;
                var bytes = Imagens.Ler(rt, true, true);
                rt = null;
                return bytes;
            }
            finally
            {
                foreach (var r in escondidos) if (r != null) r.cull = false;
                if (rt != null) RenderTexture.ReleaseTemporary(rt);
                UnityEngine.Object.Destroy(go);
            }
        }
    }
}
