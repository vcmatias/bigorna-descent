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
    /// Receitas da Oficina. Uma receita do jogo pode ter os custos (materiais e quantidades), o preco e o item mudados; uma
    /// receita nova fabrica um item (da Oficina ou do jogo) pelos materiais escolhidos. As mudancas valem enquanto o mapa
    /// (ou a campanha) esta em jogo e sao desfeitas ao voltar ao menu. Receitas marcadas "desde o inicio" o grupo ja conhece
    /// ao se formar; as outras chegam por um gatilho "dar item".
    /// </summary>
    public static class ReceitasProprias
    {
        static readonly Desfazer _desfazer = new Desfazer();
        static readonly List<RecipeModel> _iniciais = new List<RecipeModel>();

        public static void Registrar(List<JObject> receitas, string origem)
        {
            if (receitas == null || receitas.Count == 0) return;
            Restaurar();
            int n = 0;
            foreach (var j in receitas) { try { if (Uma(j)) n++; } catch (Exception ex) { Log.Erro("receita «" + (string)j["id"] + "»", ex); } }
            Log.Info("receitas da Oficina de " + origem + ": " + n);
        }

        static RecipeModel.MaterialCost[] Custos(JToken lista)
        {
            var r = new List<RecipeModel.MaterialCost>();
            foreach (JObject x in (lista as JArray) ?? new JArray())
            {
                var id = (string)x["material"]; int q = (int?)x["qty"] ?? 0;
                if (string.IsNullOrEmpty(id) || q <= 0) continue;
                CraftingMaterialModel m = null; try { m = UserCollectionManager.GetItem(id, false) as CraftingMaterialModel; } catch { }
                if (m == null) { Log.Info("  material «" + id + "» desconhecido"); continue; }
                r.Add(new RecipeModel.MaterialCost { Material = m, Qty = q });
            }
            return r.ToArray();
        }

        static bool Uma(JObject j)
        {
            var id = (string)j["id"]; var jogo = (string)j["game"]; var itemId = (string)j["item"];
            var custos = Custos(j["ingredients"]);
            int valor = Math.Max(0, (int?)j["value"] ?? 0);
            ItemModel item = null; try { if (!string.IsNullOrEmpty(itemId)) item = UserCollectionManager.GetItem(itemId, false); } catch { }
            RecipeModel r;
            if (!string.IsNullOrEmpty(jogo))
            {
                r = UserCollectionManager.GetRecipe(jogo, false);
                if (r == null) { Log.Info("  receita do jogo «" + jogo + "» não existe"); return false; }
                var alvo = r; var ing = r.Ingredients; var v = r.Value; var cr = r.CraftedItemId; var kn = r.KeyName; var kd = r.KeyDescription; var tx = r.TextureAssetPath;
                _desfazer.Add(() => { alvo.Ingredients = ing; alvo.Value = v; alvo.CraftedItemId = cr; alvo.KeyName = kn; alvo.KeyDescription = kd; alvo.TextureAssetPath = tx; });
                r.Ingredients = custos; r.Value = valor;
                if (item != null && item.Id != r.CraftedItemId) { r.CraftedItemId = item.Id; r.KeyName = item.KeyName; r.KeyDescription = item.KeyDescription; r.TextureAssetPath = item.GetTextureAssetPath(); }
            }
            else
            {
                if (item == null) { Log.Info("  receita «" + id + "»: item «" + itemId + "» não existe"); return false; }
                var molde = UserCollectionManager.GetRecipes(false)?.FirstOrDefault(x => x != null && !x.IsUpgrade);
                if (molde == null) { Log.Info("  receita «" + id + "»: nenhuma receita do jogo para copiar"); return false; }
                r = UnityEngine.Object.Instantiate(molde); r.name = id;
                var f = typeof(ModelBase).GetField("_id", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
                f?.SetValue(r, id);
                r.KeyName = item.KeyName; r.KeyDescription = item.KeyDescription; r.TextureAssetPath = item.GetTextureAssetPath();
                r.CraftedItemId = item.Id; r.Ingredients = custos; r.Value = valor;
                r.IsUpgrade = false; r.BaseItemId = ""; r.BaseRecipeId = ""; r.PostCraftingDT = null; r.XPRequiredForDrop = 0;
                NaColecao("Recipes", id, r);
            }
            if ((bool?)j["start"] == true) _iniciais.Add(r);
            Log.Info("  receita " + r.Id + " → " + r.CraftedItemId + ": " + string.Join(", ", custos.Select(c => c.Qty + " " + c.Material.Id).ToArray()));
            return true;
        }

        static void NaColecao(string tipo, string id, object modelo)
        {
            foreach (var nome in new[] { "s_all" + tipo, "s_owned" + tipo })
            {
                try { if (typeof(UserCollectionManager).GetField(nome, BindingFlags.Static | BindingFlags.NonPublic)?.GetValue(null) is System.Collections.IDictionary dic) dic[id] = modelo; }
                catch (Exception ex) { Log.Info("registrando «" + id + "» em " + nome + ": " + ex.Message); }
            }
        }

        /// <summary>Ao formar o grupo: as receitas "desde o inicio" entram entre as conhecidas.</summary>
        public static void DarIniciais()
        {
            if (_iniciais.Count == 0) return;
            try
            {
                var d = Jogo.DadosJogo?.Data; if (d == null) return;
                foreach (var r in _iniciais) if (d.GetDiscoveredRecipe(r.Id) == null) { d.AddTreasureDuringQuest(new SerializedRecipe(r)); Log.Info("  o grupo conhece a receita «" + r.Id + "»"); }
            }
            catch (Exception ex) { Log.Erro("dando as receitas da Oficina", ex); }
        }

        public static void Restaurar()
        {
            _desfazer.Executar("valores das receitas do jogo"); _iniciais.Clear();
        }
    }
}
