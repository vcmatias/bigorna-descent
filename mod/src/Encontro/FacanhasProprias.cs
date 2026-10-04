using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FFG.Core;
using FFG.D3;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Facanhas da Oficina. Uma facanha do jogo pode ter texto, heroi, meta, momento, filtros, pre-requisito e premios
    /// mudados; uma facanha nova nasce de uma copia de outra do jogo. O pool de facanhas restringe as que o jogo oferece:
    /// para cada heroi com alguma facanha no pool, as outras dele deixam de ser oferecidas (pedem 999 concluidas antes);
    /// as ja em andamento ou concluidas seguem valendo. Tudo e desfeito ao voltar ao menu.
    /// </summary>
    public static class FacanhasProprias
    {
        static readonly Desfazer _desfazer = new Desfazer();
        static readonly FieldInfo _campoId = typeof(ModelBase).GetField("_id", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
        static readonly FieldInfo _campoAto = typeof(ModelBase).GetField("_act", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);

        public static void Registrar(List<JObject> facanhas, List<string> pool, string origem)
        {
            if ((facanhas == null || facanhas.Count == 0) && (pool == null || pool.Count == 0)) return;
            Restaurar();
            int n = 0;
            foreach (var j in facanhas ?? new List<JObject>()) { try { if (Uma(j)) n++; } catch (Exception ex) { Log.Erro("façanha «" + (string)j["id"] + "»", ex); } }
            if (n > 0) Log.Info("façanhas da Oficina de " + origem + ": " + n);
            try { AplicarPool(pool); } catch (Exception ex) { Log.Erro("pool de façanhas", ex); }
        }

        static bool Uma(JObject j)
        {
            var id = (string)j["id"]; var jogo = (string)j["game"];
            FeatModel f;
            if (!string.IsNullOrEmpty(jogo))
            {
                f = UserCollectionManager.GetFeat(jogo, false);
                if (f == null) { Log.Info("  façanha do jogo «" + jogo + "» não existe"); return false; }
                Guardar(f);
            }
            else
            {
                var heroi0 = UserCollectionManager.GetHero((string)j["hero"] ?? "", false);
                var todas = UserCollectionManager.GetFeats(false);
                var molde = todas?.FirstOrDefault(x => x != null && heroi0 != null && x.HeroSource != null && x.HeroSource.Id == heroi0.Id) ?? todas?.FirstOrDefault(x => x != null);
                if (molde == null) { Log.Info("  façanha «" + id + "»: nenhuma façanha do jogo para copiar"); return false; }
                f = UnityEngine.Object.Instantiate(molde); f.name = id;
                _campoId?.SetValue(f, id);
                f.ResetParams(); f.PrerequisiteFeats = new FeatModel[0]; f.Rewards = new ScriptableObject[0];
                NaColecao("Feats", id, f);
                // ao sair ela fica na colecao (um save com ela em andamento nao quebra), mas nunca mais e oferecida
                var novo = f; _desfazer.Add(() => novo.AmountCompletedRequired = 999);
            }
            Aplicar(f, j);
            Log.Info("  façanha " + f.Id + " (" + (f.HeroSource != null ? f.HeroSource.Id : "?") + "): meta " + f.Goal + ", momento " + f.Timing + ", " + (f.Rewards?.Length ?? 0) + " prêmio(s)");
            return true;
        }

        static void Aplicar(FeatModel f, JObject j)
        {
            var texto = (string)j["text"]; if (!string.IsNullOrEmpty(texto)) f.DescriptionKey = texto;
            var h = (string)j["hero"]; if (!string.IsNullOrEmpty(h)) { var heroi = UserCollectionManager.GetHero(h, false); if (heroi != null) f.HeroSource = heroi; }
            if (j["goal"] != null) f.Goal = Math.Max(1, (int)j["goal"]);
            if (j["timing"] != null) f.Timing = (FeatTiming)(int)j["timing"];
            if (j["required"] != null) f.AmountCompletedRequired = Math.Max(0, (int)j["required"]);
            if (j["act"] != null) { try { _campoAto?.SetValue(f, Enum.ToObject(_campoAto.FieldType, (int)j["act"])); } catch { } }
            if (j["rewards"] is JArray premios)
            {
                var lista = new List<ScriptableObject>();
                foreach (var t in premios)
                {
                    var rid = (string)t; if (string.IsNullOrEmpty(rid)) continue;
                    ScriptableObject r = null;
                    try { r = UserCollectionManager.GetSkill(rid, false); } catch { }
                    if (r == null) try { r = UserCollectionManager.GetLegend(rid, false); } catch { }
                    if (r == null) try { r = UserCollectionManager.GetCompanion(rid, false); } catch { }
                    if (r == null) try { r = UserCollectionManager.GetRecipe(rid, false); } catch { }
                    if (r == null) Log.Info("  prêmio «" + rid + "» não existe"); else lista.Add(r);
                }
                f.Rewards = lista.ToArray();
            }
            if (!(j["params"] is JObject p)) return;
            int[] Ints(string k) => p[k] is JArray a ? a.Select(x => (int)x).ToArray() : null;
            var armas = Ints("weapons"); f.WeaponClasses = new FeatModel.WeaponParam(armas != null && armas.Length > 0, (armas ?? new int[0]).Select(x => (WeaponClasses)x).ToArray());
            var inimigos = Ints("enemies"); f.EnemyTypes = new FeatModel.EnemyParam(inimigos != null && inimigos.Length > 0, (inimigos ?? new int[0]).Select(x => (EnemyTypes)x).ToArray());
            var itens = Ints("items"); f.ItemType = new FeatModel.ItemParam(itens != null && itens.Length > 0, (itens ?? new int[0]).Select(x => (ItemType)x).ToArray());
            var obj = (int?)p["interactable"]; f.InteractableType = new FeatModel.InteractableParam(obj.HasValue, (InteractableType)(obj ?? 0));
            var cond = (int?)p["condition"]; f.EnemyConditions = new FeatModel.StatusParam(cond.HasValue, (EnemyConditions)(cond ?? 1));
            if (p["injury"] is JObject les) f.HeroInjured = new FeatModel.HeroInjuryParam(true, (HeroHealth)((int?)les["value"] ?? 1), (bool?)les["invert"] ?? false);
            else f.HeroInjured = new FeatModel.HeroInjuryParam(false, HeroHealth.Normal, false);
            f.GoalIsTotalDamage = new FeatModel.BoolParam((bool?)p["totalDamage"] ?? false);
            f.WeaknessDamage = new FeatModel.BoolParam((bool?)p["weakness"] ?? false);
            var vit = (bool?)p["victory"]; f.IsVictory = new FeatModel.SwitchParam(vit.HasValue, vit ?? true);
            var mind = (int?)p["minDamage"]; f.MinimumDamage = new FeatModel.IntParam(mind.HasValue && mind.Value > 0, mind ?? 0);
            var mesmo = (bool?)p["sameEnemy"]; f.SameEnemy = new FeatModel.SwitchParam(mesmo.HasValue, mesmo ?? true);
        }

        /// <summary>Guarda tudo o que Aplicar pode mudar numa facanha do jogo, para desfazer ao sair.</summary>
        static void Guardar(FeatModel f)
        {
            var dk = f.DescriptionKey; var g = f.Goal; var t = f.Timing; var hs = f.HeroSource; var req = f.AmountCompletedRequired; var rw = f.Rewards;
            var wc = f.WeaponClasses; var et = f.EnemyTypes; var it = f.ItemType; var ia = f.InteractableType; var ec = f.EnemyConditions; var hi = f.HeroInjured;
            var gt = f.GoalIsTotalDamage; var wd = f.WeaknessDamage; var iv = f.IsVictory; var md = f.MinimumDamage; var se = f.SameEnemy;
            object ato = null; try { ato = _campoAto?.GetValue(f); } catch { }
            _desfazer.Add(() =>
            {
                f.DescriptionKey = dk; f.Goal = g; f.Timing = t; f.HeroSource = hs; f.AmountCompletedRequired = req; f.Rewards = rw;
                f.WeaponClasses = wc; f.EnemyTypes = et; f.ItemType = it; f.InteractableType = ia; f.EnemyConditions = ec; f.HeroInjured = hi;
                f.GoalIsTotalDamage = gt; f.WeaknessDamage = wd; f.IsVictory = iv; f.MinimumDamage = md; f.SameEnemy = se;
                try { if (ato != null) _campoAto?.SetValue(f, ato); } catch { }
            });
        }

        /// <summary>Herois com facanhas no pool: as outras facanhas deles deixam de ser oferecidas.</summary>
        static void AplicarPool(List<string> pool)
        {
            if (pool == null || pool.Count == 0) return;
            var noPool = new HashSet<string>(pool.Where(x => !string.IsNullOrEmpty(x)), StringComparer.OrdinalIgnoreCase);
            var todas = UserCollectionManager.GetFeats(false)?.Where(x => x != null && x.HeroSource != null).ToList() ?? new List<FeatModel>();
            var herois = new HashSet<string>(todas.Where(x => noPool.Contains(x.Id)).Select(x => x.HeroSource.Id));
            int fora = 0;
            foreach (var f in todas)
            {
                if (!herois.Contains(f.HeroSource.Id) || noPool.Contains(f.Id)) continue;
                var alvo = f; var antes = f.AmountCompletedRequired;
                _desfazer.Add(() => alvo.AmountCompletedRequired = antes);
                f.AmountCompletedRequired = 999; fora++;
            }
            Log.Info("pool de façanhas: " + noPool.Count + " no pool, " + fora + " fora (heróis: " + string.Join(", ", herois.ToArray()) + ")");
        }

        static void NaColecao(string tipo, string id, object modelo)
        {
            foreach (var nome in new[] { "s_all" + tipo, "s_owned" + tipo })
            {
                try { if (typeof(UserCollectionManager).GetField(nome, BindingFlags.Static | BindingFlags.NonPublic)?.GetValue(null) is System.Collections.IDictionary dic) dic[id] = modelo; }
                catch (Exception ex) { Log.Info("registrando «" + id + "» em " + nome + ": " + ex.Message); }
            }
        }

        public static void Restaurar()
        {
            _desfazer.Executar("valores das façanhas do jogo");
        }
    }
}
