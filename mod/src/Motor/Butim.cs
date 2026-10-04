using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Motor
{
    /// <summary>Butim de verdade: o que os gatilhos, objetos e recompensas dao entra no inventario do grupo como o jogo faz
    /// (GiveTreasure): item escolhido, loot aleatorio por pontos (materiais de um tipo de loot), materiais, itens aleatorios
    /// ainda nao descobertos, ouro. Aparece o quadro com a lista e a faixa de itens recebidos do jogo. O que o jogo nao guarda
    /// (receitas por numero) fica como aviso para a mesa.</summary>
    public static class Butim
    {
        public static string NomeItem(string id)
        {
            if (string.IsNullOrEmpty(id)) return "?";
            try
            {
                var item = UserCollectionManager.GetItem(id, false);
                if (item != null)
                {
                    var nome = FFGLocalization.Get(item.KeyName, false);
                    if (!string.IsNullOrEmpty(nome)) return nome;
                    return item.name;
                }
            }
            catch { }
            return id;
        }


        /// <summary>Itens do pool ja sorteados neste mapa (nao repetem).</summary>
        static readonly HashSet<string> _doPool = new HashSet<string>(StringComparer.Ordinal);
        static object _mapaDoPool;
        static object _mapaDaLista;
        static List<string> _pool = new List<string>();

        /// <summary>O pool de itens em jogo: comeca como o do mapa e muda pelos gatilhos "mudar o pool de itens".</summary>
        public static List<string> Pool()
        {
            if (!ReferenceEquals(_mapaDaLista, Roteiro.Mapa)) { _mapaDaLista = Roteiro.Mapa; _pool = new List<string>(Roteiro.Mapa?.Spawns?.PoolItens ?? new List<string>()); }
            return _pool;
        }
        /// <summary>Um mapa comeca: o pool volta ao do arquivo e nenhum item dele conta como ja dado.</summary>
        public static void NovoMapa() { _mapaDaLista = null; _mapaDoPool = null; _doPool.Clear(); }
        public static void MudarPool(string id, bool tirar)
        {
            if (string.IsNullOrEmpty(id)) return;
            var p = Pool();
            if (tirar) p.RemoveAll(x => string.Equals(x, id, StringComparison.OrdinalIgnoreCase));
            else if (!p.Contains(id)) p.Add(id);
            Log.Info("  pool de itens: " + string.Join(", ", p.ToArray()));
        }

        class Recebido
        {
            public readonly List<InventoryChange> Ganhos = new List<InventoryChange>();
            public readonly List<string> Digitais = new List<string>(), Fisicos = new List<string>(), Avisos = new List<string>();
        }

        public static void Entregar(Dmap.Butim b, string origem)
        {
            if (b == null) return;
            var modo = (b.Modo ?? "none").ToLowerInvariant();
            if (modo == "none") return;
            var d = Jogo.DadosJogo?.Data;
            var r = new Recebido();
            try
            {
                if (modo == "explicit" || modo == "items")
                    foreach (var i in b.Itens.Where(x => !string.IsNullOrEmpty(x))) Item(d, i, 1, r);
                else
                {
                    if (b.Pontos > 0) MateriaisPorPontos(d, b.Pontos, r);
                    for (int k = 0; k < b.Quantos; k++) ItemAleatorio(d, r);
                }
                if (b.Ouro > 0) Ouro(d, b.Ouro, r);
                if (b.Materiais > 0) MateriaisAleatorios(d, b.Materiais, r);
                for (int k = 0; k < b.Equipamento; k++) ItemAleatorio(d, r);
                if (b.Receitas > 0) r.Avisos.Add("Recebam " + b.Receitas + " receita(s) (na mesa).");
            }
            catch (Exception ex) { Log.Erro("entregando os espólios", ex); }
            Mostrar(r, origem);
        }

        /// <summary>Um item pelo id (do jogo ou da Oficina).</summary>
        public static void DarItem(string id, int qtd, string origem)
        {
            var r = new Recebido();
            try { Item(Jogo.DadosJogo?.Data, id, Math.Max(1, qtd), r); } catch (Exception ex) { Log.Erro("dando o item «" + id + "»", ex); }
            Mostrar(r, origem);
        }

        public static void DarMateriais(int n, string origem)
        {
            var r = new Recebido();
            try { MateriaisAleatorios(Jogo.DadosJogo?.Data, n, r); } catch (Exception ex) { Log.Erro("dando materiais", ex); }
            Mostrar(r, origem);
        }

        /// <summary>O ouro do grupo agora (sem dados do jogo: tanto quanto for preciso).</summary>
        public static int OuroDoGrupo() { try { var d = Jogo.DadosJogo?.Data; return d == null ? int.MaxValue : d.Gold; } catch { return int.MaxValue; } }

        /// <summary>O grupo perde ouro (nunca abaixo de zero): um mercador cobrando, um ladrão. Diz quanto se foi.</summary>
        public static void TirarOuro(int v, string origem)
        {
            if (v <= 0) return;
            var d = Jogo.DadosJogo?.Data; string texto;
            try
            {
                if (d == null) texto = "Percam " + v + " de ouro (na mesa).";
                else
                {
                    int tinha = d.Gold; d.ChangeGoldDuringQuest(-v); int foi = tinha - d.Gold;
                    Log.Info("  o grupo perde " + foi + " de ouro (tinha " + tinha + ")");
                    texto = foi > 0 ? "Perderam " + foi + " " + Jogo.Texto("UI_GOLD", "ouro") + "." : "O grupo não tinha ouro para perder.";
                    Jogo.Sujo();
                }
            }
            catch (Exception ex) { Log.Erro("tirando ouro", ex); return; }
            Dialogos.Mensagem(texto, null, origem ?? Jogo.Texto("UI_TREASURE", "Tesouro"));
        }

        /// <summary>O grupo perde n materiais de fabricação ao acaso (uma unidade de cada vez, dos que tem).</summary>
        public static void TirarMateriais(int n, string origem)
        {
            if (n <= 0) return;
            var d = Jogo.DadosJogo?.Data; var perdidos = new Dictionary<string, int>(); string texto;
            try
            {
                if (d == null) texto = "Percam " + n + " material(is) de fabricação ao acaso (na mesa).";
                else
                {
                    for (int k = 0; k < n; k++)
                    {
                        var tem = (d.CraftingMaterials ?? new List<SerializedCraftingMaterial>()).Where(x => x != null && x.Model != null && x.Qty > 0).ToList();
                        if (tem.Count == 0) break;
                        var m = tem[UnityEngine.Random.Range(0, tem.Count)]; m.Qty--;
                        var nome = NomeItem(m.Model.Id); perdidos[nome] = perdidos.TryGetValue(nome, out var q) ? q + 1 : 1;
                        if (m.Qty <= 0) d.RemoveTreasureDuringQuest(m);
                    }
                    Log.Info("  o grupo perde materiais: " + string.Join(", ", perdidos.Select(x => x.Value + " " + x.Key).ToArray()));
                    texto = perdidos.Count == 0 ? "O grupo não tinha materiais para perder." : "Perderam: " + string.Join(", ", perdidos.Select(x => x.Value + " " + x.Key).ToArray()) + ".";
                    Jogo.Sujo();
                }
            }
            catch (Exception ex) { Log.Erro("tirando materiais", ex); return; }
            Dialogos.Mensagem(texto, null, origem ?? Jogo.Texto("UI_TREASURE", "Tesouro"));
        }

        public static bool Tem(string id)
        {
            var d = Jogo.DadosJogo?.Data; if (d == null || string.IsNullOrEmpty(id)) return false;
            try
            {
                if (d.GetItem(id) != null) return true;
                var m = UserCollectionManager.GetItem(id, false);
                if (m is ConsumableModel c) return d.GetConsumableItem(c, true)?.Qty > 0;
                if (m is CraftingMaterialModel cm) return d.GetCraftingMaterial(cm)?.Qty > 0;
            }
            catch { }
            return false;
        }

        static void Item(SerializedGame d, string id, int qtd, Recebido r)
        {
            ItemModel m = null; try { m = UserCollectionManager.GetItem(id, false); } catch { }
            if (d != null && m is RecipeModel rec)
            {
                if (d.GetDiscoveredRecipe(rec.Id) != null) { r.Avisos.Add("O grupo já conhece a receita de «" + NomeItem(rec.CraftedItemId) + "»."); return; }
                d.AddTreasureDuringQuest(new SerializedRecipe(rec));
                r.Digitais.Add(Jogo.Texto("UI_RECIPE", "Receita") + ": " + NomeItem(rec.CraftedItemId));
                r.Ganhos.Add(new InventoryChange(rec, 1));
                Log.Info("  o grupo aprende a receita «" + rec.Id + "»");
                return;
            }
            if (d == null || m == null || m is RecipeModel) { r.Avisos.Add("Recebam «" + NomeItem(id) + "»" + (qtd > 1 ? " ×" + qtd : "") + " (peguem a carta)."); return; }
            var nome = NomeItem(id);
            if (m is ConsumableModel c)
            {
                var ja = d.GetConsumableItem(c, true);
                if (ja != null) ja.Qty = Math.Max(0, ja.Qty + qtd); else d.AddTreasureDuringQuest(new SerializedConsumableItem(c, qtd));
                r.Fisicos.Add(qtd + " " + nome);
            }
            else if (m is CraftingMaterialModel cm)
            {
                var ja = d.GetCraftingMaterial(cm);
                if (ja != null) ja.Qty += qtd; else d.AddTreasureDuringQuest(new SerializedCraftingMaterial(cm, qtd));
                r.Digitais.Add(qtd + " " + nome);
            }
            else
            {
                if (d.GetItem(id) != null) { r.Avisos.Add("O grupo já tem «" + nome + "»."); return; }
                d.AddTreasureDuringQuest(new SerializedItem(m));
                r.Digitais.Add(nome);
            }
            try { d.QuestSummary?.AddToObtainedItems(id, qtd); } catch { }
            r.Ganhos.Add(new InventoryChange(m, qtd));
            Log.Info("  o grupo recebe «" + nome + "»" + (qtd > 1 ? " ×" + qtd : ""));
        }

        /// <summary>Loot aleatorio de N pontos, como o GiveTreasure: um tipo de loot sorteado e materiais dele ate somar os pontos
        /// (as vezes um incomum).</summary>
        static void MateriaisPorPontos(SerializedGame d, int pontos, Recebido r)
        {
            // os materiais do pool de itens do mapa, quando ha: sorteados ate somar os pontos (cada unidade vale o seu valor)
            var doPool = Pool().Select(id => { try { return UserCollectionManager.GetItem(id, false) as CraftingMaterialModel; } catch { return null; } }).Where(x => x != null).Distinct().ToList();
            if (d != null && doPool.Count > 0)
            {
                var conta0 = new Dictionary<CraftingMaterialModel, int>(); int resto = pontos, voltas = 0;
                while (voltas++ < 60)
                {
                    var cabem = doPool.Where(x => Math.Max(1, x.Value) <= resto).ToList();
                    if (cabem.Count == 0) break;
                    var m = cabem[UnityEngine.Random.Range(0, cabem.Count)];
                    conta0[m] = conta0.TryGetValue(m, out var q) ? q + 1 : 1; resto -= Math.Max(1, m.Value);
                }
                if (conta0.Count == 0) { var barato = doPool.OrderBy(x => x.Value).First(); conta0[barato] = 1; }
                foreach (var kv in conta0) Item(d, kv.Key.Id, kv.Value, r);
                return;
            }
            var loots = UserCollectionManager.GetLoots(true)?.Where(x => x != null).ToList();
            if (d == null || loots == null || loots.Count == 0) { r.Avisos.Add("Recebam espólios aleatórios de " + pontos + " ponto(s) (na mesa)."); return; }
            var loot = loots[UnityEngine.Random.Range(0, loots.Count)];
            var conta = new Dictionary<CraftingMaterialModel, int>();
            void Soma(CraftingMaterialModel x) { if (x == null) return; conta[x] = conta.TryGetValue(x, out var n) ? n + 1 : 1; pontos -= Math.Max(1, x.Value); }
            float incomum = 0f; try { incomum = d.GetUncommonMaterialPercent(GameData.GlobalBB?.GetValue<int>("LootTarget") ?? 0); } catch { }
            var c1 = loot.GetRandomCraftingMaterial(true, int.MaxValue); var c2 = loot.GetRandomCraftingMaterial(true, int.MaxValue);
            if (incomum > UnityEngine.Random.Range(0f, 1f)) { var u = loot.GetRandomCraftingMaterial(false, int.MaxValue); if (u != null) Soma(u); }
            int guarda = 0;
            while (pontos > 0 && guarda++ < 40)
            {
                var ok = new[] { c1, c2 }.Where(x => x != null && Math.Max(1, x.Value) <= pontos).ToList();
                if (ok.Count == 0) { if (conta.Count == 0) Soma(c1 ?? c2); break; }
                Soma(ok[UnityEngine.Random.Range(0, ok.Count)]);
            }
            if (conta.Count == 0) { r.Avisos.Add("Recebam espólios aleatórios (na mesa)."); return; }
            foreach (var kv in conta) Item(d, kv.Key.Id, kv.Value, r);
        }

        static void MateriaisAleatorios(SerializedGame d, int n, Recebido r)
        {
            var mats = UserCollectionManager.GetCraftingMaterials(true)?.Where(x => x != null).ToList();
            if (d == null || mats == null || mats.Count == 0) { r.Avisos.Add("Recebam " + n + " material(is) de fabricação (na mesa)."); return; }
            var m = mats[UnityEngine.Random.Range(0, mats.Count)];
            Item(d, m.Id, n, r);
        }

        /// <summary>Um item ainda nao descoberto, dos disponiveis ao grupo (como o GiveTreasure aleatorio).</summary>
        static void ItemAleatorio(SerializedGame d, Recebido r)
        {
            // o pool de itens do mapa, quando existe: um item dele que o grupo ainda nao tem
            if (!ReferenceEquals(_mapaDoPool, Roteiro.Mapa)) { _doPool.Clear(); _mapaDoPool = Roteiro.Mapa; }
            var pool = Pool();
            if (pool != null && pool.Count > 0 && d != null)
            {
                var livres = pool.Where(id => { if (string.IsNullOrEmpty(id) || _doPool.Contains(id)) return false; bool tem; try { tem = d.GetDiscoveredItem(id) != null; } catch { tem = d.GetItem(id) != null; } if (tem) return false; try { return !(UserCollectionManager.GetItem(id, false) is CraftingMaterialModel); } catch { return true; } }).ToList();
                if (livres.Count == 0) { r.Avisos.Add("Todos os itens do pool deste mapa já foram obtidos."); return; }
                var id = livres[UnityEngine.Random.Range(0, livres.Count)];
                ItemModel m = null; try { m = UserCollectionManager.GetItem(id, false); } catch { }
                if (!(m is ConsumableModel || m is CraftingMaterialModel)) _doPool.Add(id);   // os que acumulam podem vir de novo
                Item(d, id, 1, r);
                return;
            }
            var ids = d?.AvailableItemIds;
            if (ids == null || ids.Count == 0) { r.Avisos.Add("Recebam um item aleatório (na mesa)."); return; }
            var novos = new List<string>();
            foreach (var id in ids)
            {
                ItemModel m = null; try { m = UserCollectionManager.GetItem(id, true); } catch { }
                if (m != null && !m.IsUpgrade && d.GetDiscoveredItem(m) == null) novos.Add(id);
            }
            if (novos.Count == 0) { r.Avisos.Add("Todos os itens já foram descobertos."); return; }
            var escolhido = novos[UnityEngine.Random.Range(0, novos.Count)];
            ids.Remove(escolhido);
            Item(d, escolhido, 1, r);
        }

        static void Ouro(SerializedGame d, int v, Recebido r)
        {
            if (d == null) { r.Avisos.Add("Recebam " + v + " de ouro."); return; }
            d.ChangeGoldDuringQuest(v);
            r.Ganhos.Add(new InventoryChange(new GoldDetails(v), v));
            r.Digitais.Add(v + " " + Jogo.Texto("UI_GOLD", "ouro"));
        }

        static void Mostrar(Recebido r, string origem)
        {
            if (r.Ganhos.Count == 0 && r.Avisos.Count == 0) return;
            string lista(List<string> l) => l.Count == 1 ? l[0] : string.Concat(l.Select(x => "\n  - " + x));
            var partes = new List<string>();
            if (r.Digitais.Count > 0) partes.Add(string.Format(Jogo.Texto("GAIN_DIGITAL_TREASURE", "Recebido: {0}"), lista(r.Digitais)));
            if (r.Fisicos.Count > 0) partes.Add(string.Format(Jogo.Texto("GAIN_PHYSICAL_TREASURE", "Peguem: {0}"), lista(r.Fisicos)));
            partes.AddRange(r.Avisos);
            var texto = string.Join("\n\n", partes.ToArray());
            Log.Info("  espólios" + (origem != null ? " de «" + origem + "»" : "") + ": " + texto.Replace("\n", " "));
            var ganhos = r.Ganhos.ToArray();
            if (ganhos.Length > 0)
            {
                try { Jogo.Persistente?.Audio?.PostEvent("Reward_Generic"); } catch { }
                try
                {
                    var feitos = Jogo.Persistente?.FeatController;
                    if (feitos != null) foreach (var g in ganhos)
                        {
                            ItemType? t = g.Item is ArmorModel ? ItemType.Armor : g.Item is ConsumableModel ? ItemType.Consumable : g.Item is CraftingMaterialModel ? ItemType.Material : g.Item is TrinketModel ? ItemType.Trinket : g.Item is WeaponPartsModel ? ItemType.WeaponPart : (ItemType?)null;
                            if (t.HasValue) feitos.ProgressItemGain(t.Value, null, g.Qty);
                        }
                }
                catch (Exception ex) { Log.Info("  façanhas dos espólios: " + ex.Message); }
            }
            Jogo.Sujo();
            Dialogos.Mensagem(texto, () => { try { if (ganhos.Length > 0) Jogo.UI?.InventoryChangedCallout?.CloseCallout(); } catch { } }, origem ?? Jogo.Texto("UI_TREASURE", "Tesouro"),
                () => { try { if (ganhos.Length > 0) { var c = Jogo.UI?.InventoryChangedCallout; if (c != null) { c.SyncTo(ganhos, null); c.gameObject.SetActive(true); } } } catch (Exception ex) { Log.Info("  faixa de itens: " + ex.Message); } });
        }
    }
}
