using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Bigorna.Formato;
using FFG.D3;
using FFG.D3.UI;
using I2.Loc;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Bigorna.Encontro
{
    /// <summary>Monstros, itens e personagens proprios de um mapa ou campanha: fichas do .dmap/.dcamp viram modelos do jogo,
    /// registrados na colecao como se fossem oficiais (mesmo truque dos destinos de campanha). Os nomes entram como termos
    /// de localizacao; os retratos PNG substituem a textura da aba (monstros) ou do quadro narrativo (personagens).</summary>
    public static class Personalizados
    {
        static readonly HashSet<string> _registrados = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, Texture2D> _retratos = new Dictionary<string, Texture2D>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, string> _nomes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        static readonly HashSet<string> _personagens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static readonly string[] TracosMec = { "Melee", "Ranged", "Striker", "Tank", "Support", "Debuffer", "Fast", "Slow", "Flying", "Huge", "Small" };
        static readonly string[] TracosTema = { "Intelligent", "Creature", "Undead", "Dragonkind", "Uthuk", "Otherworldly", "Construct", "Wild", "Fire", "Cold", "Civilized", "Subterranean", "Water", "MagicUser", "Raider", "Mercenary", "Stealthy", "Incorporeal", "Humanoid", "UndeadFaction", "UthukFaction", "DragonFaction", "BaronialFaction" };
        static readonly string[] Condicoes = { "Dazed", "Enfeebled", "Afflicted", "Slowed", "Exposed", "Doomed", "Confused" };

        public static string NomeDe(string id) => id != null && _nomes.TryGetValue(id, out var n) ? n : null;

        public static void Registrar(Dmap.Personalizado c, string origem)
        {
            if (c == null) return;
            int n = 0;
            foreach (var j in c.Inimigos) { try { if (RegistrarInimigo(j)) n++; } catch (Exception ex) { Log.Erro("monstro próprio «" + (string)j["id"] + "»", ex); } }
            foreach (var j in c.Itens) { try { RegistrarItem(j); } catch (Exception ex) { Log.Erro("item próprio «" + (string)j["id"] + "»", ex); } }
            foreach (var j in c.Personagens) { try { if (RegistrarPersonagem(j)) n++; } catch (Exception ex) { Log.Erro("personagem próprio «" + (string)j["id"] + "»", ex); } }
            try { HeroisProprios.Registrar(c.Herois, c.Armas, c.Maos, origem); } catch (Exception ex) { Log.Erro("heróis da Oficina", ex); }
            try { ReceitasProprias.Registrar(c.Receitas, origem); } catch (Exception ex) { Log.Erro("receitas da Oficina", ex); }
            // (antes das facanhas: uma facanha pode premiar uma pericia nova)
            try { PericiasProprias.Registrar(c.Pericias, origem); } catch (Exception ex) { Log.Erro("perícias da Oficina", ex); }
            try { FacanhasProprias.Registrar(c.Facanhas, c.PoolFacanhas, origem); } catch (Exception ex) { Log.Erro("façanhas da Oficina", ex); }
            if (c.Inimigos.Count + c.Itens.Count + c.Personagens.Count > 0) Log.Info("conteúdo próprio de " + origem + ": " + c.Inimigos.Count + " monstro(s), " + c.Itens.Count + " item(ns), " + c.Personagens.Count + " personagem(ns)");
        }

        // ------------------------------------------------------------ localizacao
        static void NaColecao(string tipo, string id, object modelo)
        {
            foreach (var nome in new[] { "s_all" + tipo, "s_owned" + tipo })
            {
                try
                {
                    var f = typeof(UserCollectionManager).GetField(nome, BindingFlags.Static | BindingFlags.NonPublic);
                    var dic = f?.GetValue(null) as System.Collections.IDictionary;
                    if (dic != null) dic[id] = modelo; else Log.Info("não achei " + nome);
                }
                catch (Exception ex) { Log.Info("registrando «" + id + "» em " + nome + ": " + ex.Message); }
            }
        }
        static int Mascara(JToken lista, string[] nomes)
        {
            int m = 0;
            foreach (var x in (lista as JArray) ?? new JArray()) { int i = Array.IndexOf(nomes, (string)x); if (i >= 0) m |= 1 << i; }
            return m;
        }
        static Texture2D Textura(string dataUrl)
        {
            if (string.IsNullOrEmpty(dataUrl)) return null;
            int k = dataUrl.IndexOf("base64,", StringComparison.Ordinal); if (k < 0) return null;
            try
            {
                var bytes = Convert.FromBase64String(dataUrl.Substring(k + 7));
                var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
                if (!tex.LoadImage(bytes)) return null;
                tex.name = "Bigorna_retrato"; tex.hideFlags |= HideFlags.DontUnloadUnusedAsset; return tex;
            }
            catch (Exception ex) { Log.Info("retrato ilegível: " + ex.Message); return null; }
        }

        // ------------------------------------------------------------ monstros
        static bool RegistrarInimigo(JObject j)
        {
            var id = (string)j["id"];
            try { if (!string.IsNullOrEmpty((string)j["model"])) CartoesDeMonstro.Registrar(id, null, (float?)j["modelScale"] ?? 1f, (string)j["model"], (string)j["modelTexture"], (float?)j["modelTurn"] ?? 0f); else CartoesDeMonstro.Registrar(id, (string)j["standee"], (float?)j["standeeScale"] ?? 1f); } catch (Exception ex) { Log.Info("cartão de «" + id + "»: " + ex.Message); }
            try { RegistrarArte(id, (string)j["art"], (float?)j["artScale"] ?? 1f, (float?)j["artRaise"] ?? 0f, (float?)j["artShift"] ?? 0f); } catch (Exception ex) { Log.Info("arte de «" + id + "»: " + ex.Message); }
            if (string.IsNullOrEmpty(id) || _registrados.Contains(id)) return false;
            var tipo = (string)j["type"] ?? "Berserker";
            EnemyModel basee = null;
            foreach (var chave in new[] { (string)j["behaviour"], (string)j["base"] })
                if (!string.IsNullOrEmpty(chave)) { try { basee = UserCollectionManager.GetEnemy(chave, false); } catch { } if (basee != null) break; }
            if (basee == null)
            {
                try { basee = UserCollectionManager.GetEnemies(false).FirstOrDefault(e => string.Equals(e.Type.ToString(), tipo, StringComparison.OrdinalIgnoreCase) && !e.IsNamed) ?? UserCollectionManager.GetEnemies(false).FirstOrDefault(e => string.Equals(e.Type.ToString(), tipo, StringComparison.OrdinalIgnoreCase)); } catch { }
            }
            if (basee == null) { Log.Info("monstro «" + id + "»: nenhum monstro do tipo " + tipo + " na coleção para servir de base"); return false; }
            var m = ScriptableObject.CreateInstance<EnemyModel>();
            m.name = "Bigorna_" + id;
            Reflexao.Por(m, "_id", id); Reflexao.Por(m, "_act", basee.Act);
            var nome = (string)j["name"] ?? id; _nomes[id] = nome;
            m.KeyNameSingular = Jogo.Termo("BIGORNA_" + id + "_SING", nome);
            m.KeyNamePlural = Jogo.Termo("BIGORNA_" + id + "_PLUR", (string)j["plural"] ?? nome);
            m.KeyNameDescription = Jogo.Termo("BIGORNA_" + id + "_DESC", (string)j["description"] ?? "");
            var defesa = (string)j["defense"];
            m.DefensiveKey = !string.IsNullOrWhiteSpace(defesa) ? Jogo.Termo("BIGORNA_" + id + "_DEFEND", defesa) : basee.DefensiveKey;
            m.ShowDefenseAfterAttack = !string.IsNullOrWhiteSpace(defesa) ? ((bool?)j["defenseAfterAttack"] ?? basee.ShowDefenseAfterAttack) : basee.ShowDefenseAfterAttack;
            m.IsNamed = (bool?)j["named"] ?? false; m.IsVillain = (bool?)j["villain"] ?? false;
            m.NoPlasticID = basee.NoPlasticID; m.IsBossTexture = basee.IsBossTexture; m.IsBossTabOverride = basee.IsBossTabOverride; m.BossTabOverride = basee.BossTabOverride;
            m.IsRandomEligible = true; m.RandSpawnBlockedByDefault = false; m.IsRandomSpecial = basee.IsRandomSpecial; m.IsLimitiedSpawn = false; m.SpawnCountPerQuest = 1;
            m.Type = basee.Type; m.Size = (EnemySize)Mathf.Clamp((int?)j["size"] ?? (int)basee.Size, 0, 3);
            m.MechanicalTraits = (EnemyMechanicalTraits)Mascara(j["mechanical"], TracosMec); m.ThemeTraits = (EnemyThemeTraits)Mascara(j["theme"], TracosTema);
            m.StrengthsValue = (int?)j["strength"] ?? basee.StrengthsValue;
            var wr = new List<AppliedDamageTrait>();
            foreach (var w in (j["weaknesses"] as JArray) ?? new JArray())
            {
                int d = Array.IndexOf(Oficina.Danos, (string)w["damage"]); if (d < 0) continue;
                var quando = (string)w["when"]; var t = new AppliedDamageTrait((string)w["kind"] == "resist" ? EnemyTraitType.Resistance : EnemyTraitType.Weakness, (DamageTraits)d);
                t.TraitIs = quando == "hard" ? EnemyTraitActive.HighDifficultyOnly : quando == "off" ? EnemyTraitActive.AlwaysOff : EnemyTraitActive.AlwaysOn;
                wr.Add(t);
            }
            m.WeaknessesAndResistances = wr.ToArray();
            m.ImmuneTo = (EnemyConditions)Mascara(j["immune"], Condicoes);
            var tiers = new List<EnemyTier>();
            foreach (var t in (j["tiers"] as JArray) ?? new JArray()) tiers.Add(new EnemyTier { Tier = (int?)t["tier"] ?? 1, StartingHealth = (int?)t["health"] ?? 10, Defense = (int?)t["defense"] ?? 1, BaseAttack = (int?)t["attack"] ?? 1 });
            if (tiers.Count == 0) tiers.AddRange(basee.Tiers ?? new EnemyTier[0]);
            m.Tiers = tiers.ToArray();
            _novas.Clear();
            m.Activations = Ativacoes(j["activations"] as JArray, basee.Activations, id);
            m.ManualActivations = Ativacoes(j["tactics"] as JArray, basee.ManualActivations, id);
            LogicaPropria.Registrar(id, basee, _novas);
            var efeitos = new List<LogicaPropria.EfeitoDeDefesa>();
            foreach (var f in (j["defenseEffects"] as JArray) ?? new JArray()) efeitos.Add(new LogicaPropria.EfeitoDeDefesa { Tipo = (string)f["kind"], N = (int?)f["amount"] ?? 1 });
            LogicaPropria.DefinirDefesa(id, (string)j["defenseEffect"], efeitos);
            foreach (var campo in new[] { "SpawnSound", "AttackSound", "DefendSound", "DefeatSound", "DefaultLoot" })
            { try { var f = typeof(EnemyModel).GetField(campo); f.SetValue(m, f.GetValue(basee)); } catch (Exception ex) { Log.Info("copiando " + campo + ": " + ex.Message); } }
            try { VozesProprias.Aplicar(m, id, j["sounds"] as JObject); } catch (Exception ex) { Log.Erro("sons de «" + id + "»", ex); }
            m.DataAssetBundleName = basee.DataAssetBundleName; m.TextureTabAssetPath = basee.TextureTabAssetPath; m.TextureTabBossAssetPath = basee.TextureTabBossAssetPath;
            m.AnimatedPrefabAssetPath = basee.AnimatedPrefabAssetPath; m.AnimatedBossPrefabAssetPath = basee.AnimatedBossPrefabAssetPath; m.PlasticPrefabAssetPath = basee.PlasticPrefabAssetPath;
            m.PreviewPrefabAssetPath = basee.PreviewPrefabAssetPath; m.MaterialAssetPath = basee.MaterialAssetPath; m.LogicAssetPath = basee.LogicAssetPath;
            NaColecao("Enemies", id, m);
            var retrato = Textura((string)j["portrait"]); if (retrato != null) _retratos[id] = retrato;
            _registrados.Add(id);
            Log.Info("monstro próprio «" + nome + "» (" + id + ") sobre " + basee.Id + ": " + m.Tiers.Length + " nível(is), " + m.Activations.Length + " ativação(ões)" + (retrato != null ? ", retrato próprio" : ""));
            return true;
        }

        static readonly List<string> _novas = new List<string>();
        static readonly HashSet<string> _criadas = new HashSet<string>(StringComparer.Ordinal);

        /// <summary>Grava o texto de uma ativacao do jogo na chave que a arvore do monstro base mostra, so se mudou.</summary>
        static void TextoDoJogo(string aid, string sufixo, string texto)
        {
            if (string.IsNullOrEmpty(texto)) return;
            foreach (var k in new[] { aid + sufixo, sufixo == "_ACTIVATION" ? aid : null })
            {
                if (k == null) continue;
                try
                {
                    if (LocalizationManager.GetTermData(k) == null) continue;
                    if (LocalizationManager.GetTranslation(k) == texto) return;
                    Jogo.Termo(k, texto); return;
                }
                catch { }
            }
            Jogo.Termo(aid + sufixo, texto);
        }

        static EnemyActivationModel[] Ativacoes(JArray lista, EnemyActivationModel[] daBase, string dono)
        {
            if (lista == null || lista.Count == 0) return daBase ?? new EnemyActivationModel[0];
            var feitas = new List<(EnemyActivationModel a, string next)>();
            foreach (var j in lista)
            {
                var aid = (string)j["id"] ?? (dono + "_" + feitas.Count);
                EnemyActivationModel a = null;
                try { a = UserCollectionManager.GetEnemyActivation(aid, false); } catch { }
                bool nova = a == null;
                if (nova) { a = ScriptableObject.CreateInstance<EnemyActivationModel>(); a.name = (string)j["nome"] ?? aid; Reflexao.Por(a, "_id", aid); }
                a.Speed = (int?)j["speed"] ?? 0; a.Damage = (int?)j["damage"] ?? 0; a.Aim = (int?)j["aim"] ?? 0; a.Attack = (int?)j["attack"] ?? 0; a.Range = (int?)j["range"] ?? 0;
                a.Healing = (int?)j["healing"] ?? 0; a.Shield = (int?)j["shield"] ?? 0; a.Initiative = (int?)j["initiative"] ?? 0;
                int r = Array.IndexOf(Oficina.Alcances, (string)j["rangeType"]); a.RangeType = r >= 0 ? (TargetRanges)r : TargetRanges.Melee;
                a.DisplayTarget = true; if (nova) a.HasDelayedText = false;
                var texto = (string)j["text"]; var dica = (string)j["hint"];
                if (nova) _criadas.Add(aid);
                if (_criadas.Contains(aid)) { _novas.Add(aid); if (!string.IsNullOrEmpty(texto)) Jogo.Termo(aid + "_ACTIVATION", texto); if (!string.IsNullOrEmpty(dica)) Jogo.Termo(aid + "_HINT", dica); }
                else { TextoDoJogo(aid, "_ACTIVATION", texto); TextoDoJogo(aid, "_HINT", dica); }
                if (nova) NaColecao("EnemyActivations", aid, a);
                feitas.Add((a, (string)j["next"]));
            }
            foreach (var (a, next) in feitas) { if (string.IsNullOrEmpty(next)) continue; var alvo = feitas.FirstOrDefault(x => x.a.Id == next || x.a.name == next).a; if (alvo != null) a.NextActivation = alvo; }
            return feitas.Select(x => x.a).ToArray();
        }

        // ------------------------------------------------------------ itens: modelos de verdade, que entram no inventario
        static readonly Dictionary<string, string> _colecaoDoTipo = new Dictionary<string, string>
        { { "ArmorModel", "Armor" }, { "TrinketModel", "Trinkets" }, { "ConsumableModel", "Consumables" }, { "WeaponPartsModel", "WeaponParts" }, { "TableItem", "Trinkets" }, { "CraftingMaterialModel", "CraftingMaterials" } };

        static void RegistrarItem(JObject j)
        {
            var id = (string)j["id"]; if (string.IsNullOrEmpty(id)) return;
            _nomes[id] = (string)j["name"] ?? id;
            var retrato = Textura((string)j["portrait"]); if (retrato != null) _retratos[id] = retrato;
            _registrados.Add(id);
            try { CriarItem(j, id, retrato); } catch (Exception ex) { Log.Erro("modelo do item «" + id + "»", ex); }
        }

        /// <summary>Um item da Oficina vira um modelo do jogo (copia de um item do mesmo tipo, que da o efeito) com o nosso id, nome,
        /// texto, raridade, valor e arte; assim os gatilhos o poem no inventario e as telas do jogo o mostram.</summary>
        static void CriarItem(JObject j, string id, Texture2D retrato)
        {
            var tipo = (string)j["kind"] ?? "TrinketModel";
            if (!_colecaoDoTipo.TryGetValue(tipo, out var colecao)) { Log.Info("  item «" + id + "»: tipo «" + tipo + "» desconhecido"); return; }
            ItemModel baseItem = null;
            var bid = (string)j["base"];
            try { if (!string.IsNullOrEmpty(bid)) baseItem = UserCollectionManager.GetItem(bid, false); } catch { }
            var classe = tipo == "TableItem" ? typeof(TrinketModel) : typeof(UserCollectionManager).Assembly.GetType("FFG.D3." + tipo);
            if (baseItem == null || !classe.IsInstanceOfType(baseItem)) baseItem = PrimeiroDaColecao(colecao, classe);
            if (baseItem == null) { Log.Info("  item «" + id + "»: nenhum item do jogo do tipo " + tipo + " para copiar"); return; }
            var m = UnityEngine.Object.Instantiate(baseItem); m.name = id;
            Reflexao.Por(m, "_id", id);
            m.KeyName = Jogo.Termo("BIGORNA_ITEM_" + id + "_NAME", (string)j["name"] ?? id);
            m.KeyDescription = Jogo.Termo("BIGORNA_ITEM_" + id + "_DESC", (string)j["description"] ?? "");
            int r = (int?)j["rarity"] ?? 1; if (r >= 1 && r <= 3) m.Rarity = (ItemRarity)r;
            m.Value = Math.Max(0, (int?)j["value"] ?? m.Value);
            m.IsUpgrade = false; m.BaseItemId = "";
            if (retrato != null)
            {
                retrato.name = "@Bigorna-Item-" + id;
                var caminho = PacoteVirtual.Registrar("D3/Bigorna/Items/" + id + ".png", retrato);
                m.TextureAssetPath = caminho;
                if (m is WeaponPartsModel pr) { pr.ArmoryAssetPath = caminho; pr.IsPromo = false; pr.NoTexture = false; }
            }
            if (m is ConsumableModel c) c.IsUnique = (bool?)j["unique"] ?? c.IsUnique;
            if (m is CraftingMaterialModel cmat) { cmat.MaterialType = (CraftingMaterialType)Mathf.Clamp((int?)j["materialType"] ?? (int)cmat.MaterialType, 0, 1); cmat.Value = Math.Max(1, (int?)j["value"] ?? cmat.Value); }
            if (m is TrinketModel t && tipo == "TableItem") { t.AbilityType = TrinketModel.TrinketAbilityType.None; t.hasLogic = false; t.AbilityKey = ""; }
            if (m is WeaponPartsModel p)
            {
                if (Enum.TryParse<WeaponClasses>((string)j["weaponClass"] ?? "", true, out var wc)) p.Class = wc;
                if (Enum.TryParse<WeaponPartSlots>((string)j["slot"] ?? "", true, out var sl)) p.Slot = sl;
                p.Damage = Mathf.Clamp((int?)j["damage"] ?? p.Damage, 0, 20);
                var tr = new List<DamageTraits>(); foreach (var x in (j["traits"] as JArray) ?? new JArray()) if (Enum.TryParse<DamageTraits>((string)x, true, out var d)) tr.Add(d);
                p.Traits = tr.ToArray();
                var hab = (string)j["ability"];
                var txt = (string)j["abilityText"];
                if (!string.IsNullOrEmpty(hab))
                {
                    var outra = UserCollectionManager.GetWeaponParts(false).FirstOrDefault(x => x?.Ability != null && x.Ability.Id == hab);
                    if (outra != null) { p.Ability = outra.Ability; p.HasLogic = outra.HasLogic; p.LogicAssetPath = outra.LogicAssetPath; }
                }
                else if (!string.IsNullOrWhiteSpace(txt))
                {
                    // habilidade propria: o app mostra o texto quando ela dispara; a mesa aplica
                    var a = ScriptableObject.CreateInstance<WeaponAbilityModel>(); var aid = id + "_ABILITY"; a.name = aid;
                    Reflexao.Por(a, "_id", aid);
                    a.KeyName = Jogo.Termo("BIGORNA_ITEM_" + aid, (string)j["name"] ?? "");
                    a.KeyDesc = Jogo.Termo("BIGORNA_ITEM_" + aid + "_DESC", txt);
                    a.Chance = Mathf.Clamp01(((float?)j["abilityChance"] ?? 30f) / 100f);
                    a.EffectTiming = EffectTiming.None; a.ShowPostAttackMessage = true; a.IsUpgrade = false; a.isPartA = p.Slot == WeaponPartSlots.A;
                    p.Ability = a; p.HasLogic = false; p.LogicAssetPath = "";
                }
                else if ((bool?)j["noAbility"] == true || tipo == "WeaponPartsModel" && string.IsNullOrEmpty((string)j["base"])) { p.Ability = null; p.HasLogic = false; p.LogicAssetPath = ""; }
            }
            NaColecao(colecao, id, m);
            Log.Info("  item «" + ((string)j["name"] ?? id) + "» (" + id + "): " + tipo + " a partir de " + baseItem.Id);
        }

        static ItemModel PrimeiroDaColecao(string colecao, Type classe)
        {
            try
            {
                var f = typeof(UserCollectionManager).GetField("s_all" + colecao, BindingFlags.Static | BindingFlags.NonPublic);
                if (f?.GetValue(null) is System.Collections.IDictionary dic)
                    foreach (var v in dic.Values) if (v is ItemModel im && classe.IsInstanceOfType(im) && !im.IsUpgrade && !im.Id.StartsWith("B_")) return im;
            }
            catch { }
            return null;
        }

        // ------------------------------------------------------------ personagens dos quadros narrativos
        static bool RegistrarPersonagem(JObject j)
        {
            var id = (string)j["id"]; if (string.IsNullOrEmpty(id) || _registrados.Contains(id)) return false;
            var nome = (string)j["name"] ?? id; _nomes[id] = nome; _personagens.Add(id);
            StoryCharacterModel basee = null;
            var chave = (string)j["base"];
            try { if (!string.IsNullOrEmpty(chave)) basee = UserCollectionManager.GetStoryCharacter(chave, false); } catch { }
            if (basee == null) { try { basee = UserCollectionManager.GetStoryCharacters(false).FirstOrDefault(c => !c.IsVariableCharacter()); } catch { } }
            if (basee == null) { Log.Info("personagem «" + id + "»: sem personagem base na coleção"); return false; }
            var m = ScriptableObject.CreateInstance<StoryCharacterModel>();
            m.name = "Bigorna_" + id;
            Reflexao.Por(m, "_id", id); Reflexao.Por(m, "_act", basee.Act);
            m.KeyName = Jogo.Termo("BIGORNA_" + id + "_NAME", nome);
            m.DataAssetBundleName = basee.DataAssetBundleName;
            m.TextureAssetPathDefault = basee.TextureAssetPathDefault; m.TextureAssetPathActI = basee.TextureAssetPathActI; m.TextureAssetPathActII = basee.TextureAssetPathActII;
            m.TextureSizeDefault = basee.TextureSizeDefault; m.TextureSizeActI = basee.TextureSizeActI; m.TextureSizeActII = basee.TextureSizeActII; m.TextureSize = basee.TextureSize;
            m.hasProductSpecificArt = basee.hasProductSpecificArt;
            NaColecao("StoryCharacters", id, m);
            var retrato = Textura((string)j["portrait"]); if (retrato != null) _retratos[id] = retrato;
            _registrados.Add(id);
            Log.Info("personagem próprio «" + nome + "» (" + id + ")" + (retrato != null ? ", retrato próprio" : ", retrato de " + basee.Id));
            return true;
        }

        // ------------------------------------------------------------ retratos por cima da interface
        /// <summary>Abas de monstros com retrato proprio: a textura da aba e trocada quando o jogo a sincroniza.</summary>
        static List<UIEnemyMiniTab> _abas = new List<UIEnemyMiniTab>();
        static bool _avisouArte;
        static int _quadroAbas = -1;
        /// <summary>Em todo quadro, antes de a interface ser desenhada: a aba de um monstro nosso mostra o nosso retrato. O jogo carrega
        /// o retrato original num processo em segundo plano (UIEnemyMiniTab.CoroutineLoadTextures) e o poe na aba quando fica pronto;
        /// trocar aqui, no mesmo quadro, antes do desenho, evita que o original apareca por um instante.</summary>
        public static void RetratosAntesDoQuadro()
        {
            try { ArteNasJanelas(); } catch (Exception ex) { if (!_avisouArte) { _avisouArte = true; Log.Info("arte nas janelas: " + ex.Message); } }
            if (_retratos.Count == 0) return;
            if (Time.frameCount != _quadroAbas)
            {
                _quadroAbas = Time.frameCount;   // em todo quadro (uma vez so, mesmo se a interface pedir o desenho de novo): uma aba nova nao mostra o retrato original nem por um instante
                _abas = Resources.FindObjectsOfTypeAll<UIEnemyMiniTab>().Where(a => a != null && a.gameObject.scene.IsValid()).ToList();
            }
            foreach (var aba in _abas)
            {
                if (aba == null || aba.ImageEnemy == null || !aba.isActiveAndEnabled) continue;
                SerializedEnemy e = null; try { e = aba.Enemy; } catch { }
                if (e == null || !_retratos.TryGetValue(e.ModelId ?? "", out var tex)) continue;
                if (aba.ImageEnemy.texture != tex) aba.ImageEnemy.texture = tex;
                if (!aba.ImageEnemy.enabled) aba.ImageEnemy.enabled = true;
            }
        }

        // ------------------------------------------------------------ arte animada (a janela de ativacao, de ataque do heroi e de informacao)
        /// <summary>Imagem propria no lugar do desenho animado do monstro. O jogo desenha o modelo animado (Flat) numa camera e
        /// mostra a textura dela (RT_Enemy_Animated) numa RawImage de cada janela; para os nossos monstros a RawImage recebe a nossa
        /// imagem, com a proporcao certa (uvRect) e uma respiracao leve. Os tremores e clarões do jogo (tweens na RawImage) continuam.</summary>
        static readonly Dictionary<string, Texture2D> _artes = new Dictionary<string, Texture2D>(StringComparer.Ordinal);
        static readonly Dictionary<string, string> _artesFonte = new Dictionary<string, string>(StringComparer.Ordinal);
        static List<MonoBehaviour> _janelas = new List<MonoBehaviour>();
        static readonly Dictionary<Type, (FieldInfo inimigo, FieldInfo imagem)> _camposJanela = new Dictionary<Type, (FieldInfo, FieldInfo)>();
        static readonly HashSet<RawImage> _comArte = new HashSet<RawImage>();

        static readonly Dictionary<string, (float escala, float altura, float lado)> _artesAjuste = new Dictionary<string, (float, float, float)>(StringComparer.Ordinal);
        static readonly HashSet<string> _areaAnotada = new HashSet<string>();
        static void RegistrarArte(string id, string arte, float escala, float altura, float lado)
        {
            if (string.IsNullOrEmpty(id)) return;
            _artesAjuste[id] = (Mathf.Clamp(escala <= 0 ? 1f : escala, 0.2f, 2f), Mathf.Clamp(altura, -0.8f, 0.8f), Mathf.Clamp(lado, -0.8f, 0.8f));
            if (string.IsNullOrEmpty(arte)) { _artes.Remove(id); _artesFonte.Remove(id); return; }
            if (_artesFonte.TryGetValue(id, out var f) && f == arte && _artes.ContainsKey(id)) return;
            var tex = Oficina.LerImagem(arte, "@Bigorna-Arte-" + id);
            if (tex == null) { Log.Info("arte de «" + id + "»: imagem ilegível"); return; }
            tex.wrapMode = TextureWrapMode.Clamp;
            _artes[id] = tex; _artesFonte[id] = arte;
            Log.Info("arte animada própria para o monstro «" + id + "» (" + tex.width + "x" + tex.height + ")");
        }

        static (FieldInfo inimigo, FieldInfo imagem) CamposDe(Type t)
        {
            if (_camposJanela.TryGetValue(t, out var c)) return c;
            const BindingFlags B = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
            c = (t.GetField("_enemy", B), t.GetField("ImageRTAnimatedEnemy", B));
            _camposJanela[t] = c;
            return c;
        }

        static int _quadroJanelas = -1;
        static UIHeroStatusDialog[] _fichas = new UIHeroStatusDialog[0];
        static FieldInfo _heroiDoAtaque, _imgHeroiAtaque, _imgHeroiStatus;

        static void ArteNasJanelas()
        {
            if (_artes.Count == 0) return;
            // procura as janelas em todo quadro: uma janela que acabou de ser criada nao pode mostrar nem um quadro do desenho original
            // (uma vez por quadro: a interface pode pedir o desenho mais de uma vez no mesmo quadro)
            if (Time.frameCount != _quadroJanelas)
            {
                _quadroJanelas = Time.frameCount;
                _janelas = Resources.FindObjectsOfTypeAll<UIEnemyActivationDialog>().Cast<MonoBehaviour>()
                    .Concat(Resources.FindObjectsOfTypeAll<UIEnemyInfoDialog>()).Concat(Resources.FindObjectsOfTypeAll<UIHeroAttackDialog>())
                    .Where(j => j != null && j.gameObject.scene.IsValid()).ToList();
                _fichas = Resources.FindObjectsOfTypeAll<UIHeroStatusDialog>();
            }
            foreach (var j in _janelas)
            {
                if (j == null || !j.isActiveAndEnabled) continue;
                var (fi, fr) = CamposDe(j.GetType()); if (fi == null || fr == null) continue;
                var img = fr.GetValue(j) as RawImage; if (img == null) continue;
                string id = null; try { id = (fi.GetValue(j) as SerializedEnemy)?.Model?.Id; } catch { }
                PorArte(img, id, j.GetType().Name, "D3/Textures/RT_Enemy_Animated.renderTexture");
            }
            // o heroi animado: na janela de ataque (quem ataca) e na ficha do heroi
            const BindingFlags B = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
            if (_heroiDoAtaque == null) { _heroiDoAtaque = typeof(UIHeroAttackDialog).GetField("_player", B); _imgHeroiAtaque = typeof(UIHeroAttackDialog).GetField("ImageRTAnimatedHero", B); _imgHeroiStatus = typeof(UIHeroStatusDialog).GetField("ImageRTAnimatedHero", B); }
            foreach (var j in _janelas)
            {
                if (!(j is UIHeroAttackDialog) || !j.isActiveAndEnabled) continue;
                var img = _imgHeroiAtaque?.GetValue(j) as RawImage; if (img == null) continue;
                string id = null; try { id = (_heroiDoAtaque?.GetValue(j) as SerializedPlayer)?.Model?.Id; } catch { }
                PorArte(img, id, "UIHeroAttackDialog (herói)", "D3/Textures/RT_Hero_Animated.renderTexture");
            }
            foreach (var j in _fichas)
            {
                if (j == null || !j.gameObject.scene.IsValid() || !j.isActiveAndEnabled) continue;
                var img = _imgHeroiStatus?.GetValue(j) as RawImage; if (img == null) continue;
                string id = null; try { var herois = Jogo.Partida?.ActivePlayers; int k = j.SelectedIndex; if (herois != null && k >= 0 && k < herois.Count) id = herois[k]?.Model?.Id; } catch { }
                PorArte(img, id, "UIHeroStatusDialog", "D3/Textures/RT_Hero_Animated.renderTexture");
            }
        }

        /// <summary>Poe a arte propria de "id" (monstro ou heroi) na imagem animada, ou devolve a textura animada do jogo.</summary>
        static void PorArte(RawImage img, string id, string janela, string texturaDoJogo)
        {
            if (id != null && _artes.TryGetValue(id, out var tex))
            {
                if (img.texture != tex) img.texture = tex;
                // a imagem inteira dentro da parte VISIVEL do quadro (a janela de ataque corta o quadro com mascara e com a
                // borda da tela), sem deformar; o que sobra fica transparente pela borda da textura
                var r = img.rectTransform.rect; float RW = Mathf.Max(1f, r.width), RH = Mathf.Max(1f, r.height);
                var vis = AreaVisivel(img);
                if (_areaAnotada.Add(janela)) Log.Info("  arte própria na " + janela + ": quadro " + RW.ToString("0") + "x" + RH.ToString("0") + ", parte visível x " + vis.xMin.ToString("0.00") + "–" + vis.xMax.ToString("0.00") + ", y " + vis.yMin.ToString("0.00") + "–" + vis.yMax.ToString("0.00"));
                float Wv = vis.width * RW, Hv = vis.height * RH, ia = tex.height > 0 ? (float)tex.width / tex.height : 1f;
                var aj = _artesAjuste.TryGetValue(id, out var a) ? a : (1f, 0f, 0f);
                float resp = 1f - 0.012f * Mathf.Sin(Time.unscaledTime * 1.8f);
                float Hi = Mathf.Min(Hv, Wv / ia) * aj.Item1 * resp, Wi = Hi * ia;
                float x0 = vis.xMin * RW + (Wv - Wi) / 2f + aj.Item3 * Wv;        // centrada na parte visivel, mais o ajuste para os lados
                float y0 = vis.yMin * RH + Hv * 0.02f + aj.Item2 * Hv;             // em pe no fundo, mais o ajuste de altura
                img.uvRect = new Rect(-x0 / Wi, -y0 / Hi, RW / Wi, RH / Hi);
                _comArte.Add(img);
            }
            else if (_comArte.Contains(img))
            {
                // a janela passou a mostrar outro: volta a textura animada do jogo
                _comArte.Remove(img);
                img.uvRect = new Rect(0f, 0f, 1f, 1f);
                try { img.texture = Jogo.Persistente.ABLoader.LoadAsset<Texture>(texturaDoJogo); } catch { }
            }
        }

        /// <summary>Arte animada de um heroi da Oficina (mesmo mecanismo dos monstros).</summary>
        internal static void RegistrarArteDeHeroi(string id, string arte, float escala, float altura, float lado) => RegistrarArte(id, arte, escala, altura, lado);
        internal static void EsquecerArte(string id) { _artes.Remove(id); _artesFonte.Remove(id); _artesAjuste.Remove(id); }

        /// <summary>Parte do retangulo da imagem que aparece de fato (0..1 nos dois eixos): recortada pelas mascaras acima dela e pela tela.</summary>
        static Rect AreaVisivel(RawImage img)
        {
            try
            {
                Rect Mundo(RectTransform t) { var c = new Vector3[4]; t.GetWorldCorners(c); return Rect.MinMaxRect(Mathf.Min(c[0].x, c[2].x), Mathf.Min(c[0].y, c[2].y), Mathf.Max(c[0].x, c[2].x), Mathf.Max(c[0].y, c[2].y)); }
                var todo = Mundo(img.rectTransform); if (todo.width < 1e-4f || todo.height < 1e-4f) return new Rect(0, 0, 1, 1);
                var v = todo;
                void Cortar(Rect m) { v = Rect.MinMaxRect(Mathf.Max(v.xMin, m.xMin), Mathf.Max(v.yMin, m.yMin), Mathf.Min(v.xMax, m.xMax), Mathf.Min(v.yMax, m.yMax)); }
                foreach (var m in img.GetComponentsInParent<RectMask2D>(true)) if (m.enabled && m.transform != img.transform) Cortar(Mundo(m.rectTransform));
                foreach (var m in img.GetComponentsInParent<Mask>(true)) if (m.enabled && m.transform != img.transform) Cortar(Mundo(m.rectTransform));
                var raiz = img.canvas != null ? img.canvas.rootCanvas : null;
                if (raiz != null && raiz.transform is RectTransform rt) Cortar(Mundo(rt));
                if (v.width <= todo.width * 0.1f || v.height <= todo.height * 0.1f) return new Rect(0, 0, 1, 1);
                return Rect.MinMaxRect((v.xMin - todo.xMin) / todo.width, (v.yMin - todo.yMin) / todo.height, (v.xMax - todo.xMin) / todo.width, (v.yMax - todo.yMin) / todo.height);
            }
            catch { return new Rect(0, 0, 1, 1); }
        }

        public static void AplicarRetratosDasAbas()
        {
            if (_retratos.Count == 0) return;
            try
            {
                foreach (var aba in UnityEngine.Object.FindObjectsOfType<UIEnemyMiniTab>())
                {
                    var e = aba.Enemy; if (e == null || aba.ImageEnemy == null) continue;
                    if (!_retratos.TryGetValue(e.ModelId ?? "", out var tex)) continue;
                    if (aba.ImageEnemy.texture == tex) continue;
                    aba.ImageEnemy.texture = tex; aba.ImageEnemy.enabled = true;
                }
            }
            catch (Exception ex) { Log.Info("retratos das abas: " + ex.Message); }
        }

        /// <summary>Quadro narrativo aberto: os personagens nossos com retrato proprio recebem a sua textura.</summary>
        public static void AplicarRetratosDoQuadro()
        {
            if (_retratos.Count == 0) return;
            try
            {
                var quadro = Jogo.UI?.StoryMessageDialog; if (quadro == null) return;
                foreach (var c in quadro.GetComponentsInChildren<UIStoryMessageCharacter>(true))
                {
                    if (c.ImageCharacter == null || c.NameCharacter == null) continue;
                    var nome = c.NameCharacter.text;
                    var id = _nomes.FirstOrDefault(kv => _personagens.Contains(kv.Key) && kv.Value == nome).Key;
                    if (id == null || !_retratos.TryGetValue(id, out var tex) || c.ImageCharacter.texture == tex) continue;
                    c.ImageCharacter.texture = tex;
                    var r = c.ImageCharacter.rectTransform; var alvo = r.sizeDelta; float alt = alvo.y > 0 ? alvo.y : 800f;
                    r.sizeDelta = new Vector2(alt * tex.width / Mathf.Max(1, tex.height), alt);
                }
            }
            catch (Exception ex) { Log.Info("retratos do quadro: " + ex.Message); }
        }
    }
}
