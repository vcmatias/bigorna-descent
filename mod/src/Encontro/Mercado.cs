using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using Bigorna.Motor;
using FFG.Core;
using FFG.D3;
using FFG.D3.WorldMap;
using TMPro;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Encontro
{
    /// <summary>O gatilho "Abrir a loja" (openShop): a loja no meio do mapa, como a da cidade, e depois a aventura segue. O
    /// estoque vem do que o autor marcou: a loja da cidade (o estoque atual da campanha: comprar aqui tira de la, vender poe
    /// la, como no jogo), a lista dele (itens e quantidades) e o pool de itens do mapa. Os precos sao os do jogo (vender: 75% do
    /// valor), vezes a porcentagem do autor. Limites do autor: quantas vezes a loja abre ("uses"), quantas unidades por visita
    /// ("maxBuys"), se compra materiais do grupo ("sell"). O que a lista e o pool vendem conta por mapa: nao volta a outra visita.</summary>
    public static class Mercado
    {
        public static string Titulo() => Jogo.Texto("UI_SHOP", T("Loja", "Shop"));

        public static void Abrir(Dictionary<string, object> p)
        {
            var chave = P.Texto(p, "key") ?? "loja";
            int usos = Math.Max(0, P.Inteiro(p, "uses", 0));
            var vUsos = "loja-usos:" + chave;
            if (usos > 0 && Roteiro.Var(vUsos) >= usos)
            {
                Dialogos.Mensagem(Roteiro.ComContadores(P.Texto(p, "closedText")) ?? T("A loja já fechou.", "The shop has closed."), null, Titulo());
                return;
            }
            if (Jogo.Partida == null) { Dialogos.Mensagem(T("O grupo pode comprar e vender na mesa, como na loja da cidade.", "The party may buy and sell at the table, as in the city's shop."), null, Titulo()); return; }
            Dialogos.JanelaPropria(fechou =>
            {
                Roteiro.Vars[vUsos] = Roteiro.Var(vUsos) + 1;
                try { new Visita(p, chave, fechou).Abrir(); return true; }
                catch (Exception ex) { Log.Erro("abrindo a loja", ex); return false; }
            });
        }

        class Oferta
        {
            public ItemModel Item;
            public int Qtd;        // -1: sem fim
            public string Fonte;   // city | list | pool
            public bool Acumula => Item is CraftingMaterialModel || Item is ConsumableModel;
        }

        class Visita
        {
            readonly SerializedGame _d;
            readonly string _chave;
            readonly Action _fechou;
            readonly int _pctCompra, _pctVenda, _maxUnidades;
            readonly bool _vende;
            readonly List<Oferta> _ofertas = new List<Oferta>();
            readonly Dictionary<string, int> _qtd = new Dictionary<string, int>(StringComparer.Ordinal);
            readonly List<string> _recibo = new List<string>();
            ShopController _cidade;
            Janela _j;
            int _aba, _compradas;
            string _aviso = "";

            public Visita(Dictionary<string, object> p, string chave, Action fechou)
            {
                _d = Jogo.Partida; _chave = chave; _fechou = fechou;
                _pctCompra = Mathf.Clamp(P.Inteiro(p, "price", 100), 0, 1000);
                _pctVenda = Mathf.Clamp(P.Inteiro(p, "sellPrice", 100), 0, 1000);
                _maxUnidades = Math.Max(0, P.Inteiro(p, "maxBuys", 0));
                _vende = P.Booleano(p, "sell", true);
                var fontes = (P.Textos(p, "sources") ?? new List<string> { "city" }).Select(x => x.Trim().ToLowerInvariant()).ToList();
                if (fontes.Contains("city"))
                {
                    try
                    {
                        _cidade = new ShopController(); _cidade.LoadShopData();
                        foreach (var kv in _cidade.FeaturedItems) Por(kv.Key, kv.Value, "city");
                        foreach (var kv in _cidade.Materials) Por(kv.Key, kv.Value, "city");
                    }
                    catch (Exception ex) { Log.Info("loja: o estoque da cidade não abriu (" + ex.Message + ")"); _cidade = null; }
                }
                if (fontes.Contains("list"))
                {
                    var ids = P.Textos(p, "items") ?? new List<string>(); var qs = P.Lista(p, "qty") ?? new List<int>();
                    for (int i = 0; i < ids.Count; i++)
                    {
                        var m = Modelo(ids[i]); if (m == null) { Log.Info("loja: o item «" + ids[i] + "» não existe nesta coleção"); continue; }
                        int q = i < qs.Count ? qs[i] : 1;
                        Por(m, q <= 0 ? -1 : Math.Max(0, q - Vendidos(m.Id)), "list");
                    }
                }
                if (fontes.Contains("pool"))
                    foreach (var id in Butim.Pool())
                    {
                        var m = Modelo(id); if (m == null) continue;
                        int q = (m is CraftingMaterialModel || m is ConsumableModel) ? 10 : 1;
                        Por(m, Math.Max(0, q - Vendidos(m.Id)), "pool");
                    }
                Log.Info("loja «" + chave + "»: " + _ofertas.Count + " oferta(s) de " + string.Join("+", fontes.ToArray()) + ", compra a " + _pctCompra + "%, vende a " + _pctVenda + "%"
                    + (_maxUnidades > 0 ? ", até " + _maxUnidades + " por visita" : "") + (_vende ? "" : ", sem venda"));
            }

            static ItemModel Modelo(string id) { if (string.IsNullOrEmpty(id)) return null; try { return UserCollectionManager.GetItem(id, false); } catch { return null; } }
            int Vendidos(string id) => Roteiro.Var("loja:" + _chave + ":" + id);

            void Por(ItemModel m, int q, string fonte)
            {
                if (m == null || _ofertas.Any(o => o.Item.Id == m.Id)) return;
                _ofertas.Add(new Oferta { Item = m, Qtd = q, Fonte = fonte });
            }

            /// <summary>Um item unico (nao acumula) que o grupo ja tem, ou uma receita que ja conhece: nao se compra de novo.</summary>
            bool JaTem(ItemModel m)
            {
                try
                {
                    if (m is RecipeModel r) return _d.GetDiscoveredRecipe(r.Id) != null;
                    if (m is CraftingMaterialModel || m is ConsumableModel) return false;
                    return _d.GetItem(m.Id) != null || _d.GetDiscoveredItem(m) != null;
                }
                catch { return false; }
            }

            int Preco(ItemModel m) => Math.Max(0, Mathf.RoundToInt(m.GetValue() * _pctCompra / 100f));
            int PrecoVenda(ItemModel m) => Math.Max(0, Mathf.RoundToInt(m.GetValue(true) * _pctVenda / 100f));
            string Ouro(int v) => v + " " + Jogo.Texto("UI_GOLD", T("ouro", "gold"));

            public static string Nome(ItemModel m)
            {
                if (m is RecipeModel r) return Butim.NomeItem(r.CraftedItemId) + " (" + Jogo.Texto("UI_RECIPE", T("receita", "recipe")).ToLowerInvariant() + ")";
                return Butim.NomeItem(m.Id);
            }

            static string Tipo(ItemModel m)
            {
                if (m is RecipeModel) return Jogo.Texto("UI_RECIPE", T("Receita", "Recipe"));
                if (m is CraftingMaterialModel) return T("Material de fabricação", "Crafting material");
                if (m is ConsumableModel) return T("Consumível", "Consumable");
                if (m is WeaponPartsModel) return T("Peça de arma", "Weapon part");
                if (m is ArmorModel) return T("Armadura", "Armor");
                if (m is TrinketModel) return T("Adorno", "Trinket");
                return T("Item", "Item");
            }

            static string Descricao(ItemModel m)
            {
                try { var k = m.GetDescriptionKey(); if (string.IsNullOrEmpty(k)) return ""; var t = FFGLocalization.Get(k, false); return string.IsNullOrEmpty(t) || t == k ? "" : t.Replace("\n", " "); }
                catch { return ""; }
            }

            public void Abrir()
            {
                _j = Janela.Nova(Titulo(), 1360f, 860f, Fechou);
                Desenhar();
            }

            void Fechou()
            {
                if (_recibo.Count > 0) Log.Info("loja «" + _chave + "»: " + string.Join("; ", _recibo.ToArray()));
                Jogo.Sujo();
                try { Jogo.UI?.HeroMenu?.SyncTo(Jogo.Partida.ActivePlayers); } catch { }
                _fechou?.Invoke();
            }

            int RestaNaVisita => _maxUnidades > 0 ? Math.Max(0, _maxUnidades - _compradas) : int.MaxValue;

            void Desenhar()
            {
                if (_j == null) return;
                _j.Limpar();
                _j.Canto.text = Jogo.Texto("UI_GOLD", T("Ouro", "Gold")) + ": <color=#D9B45A>" + _d.Gold + "</color>";
                var abas = _j.Linha(_j.Corpo, 54f);
                _j.Botao(abas, T("Comprar", "Buy"), () => { _aba = 0; _aviso = ""; Desenhar(); }, 200f, _aba == 0);
                if (_vende) _j.Botao(abas, T("Vender", "Sell"), () => { _aba = 1; _aviso = ""; Desenhar(); }, 200f, _aba == 1);
                var dica = _j.Texto(abas, _maxUnidades > 0 ? TF("Nesta visita: ainda {0} de {1} compra(s).", "This visit: {0} of {1} purchase(s) left.", RestaNaVisita, _maxUnidades) : "", 22f, Janela.Apagado, TextAlignmentOptions.MidlineRight);
                Janela.Flex(dica, 1f);
                var lista = _j.Rolagem(_j.Corpo);
                if (_aba == 0) Compras(lista); else Vendas(lista);
                var pe = _j.Linha(_j.Corpo, 60f);
                var av = _j.Texto(pe, _aviso, 24f, Janela.Pergaminho); Janela.Flex(av, 1f);
                _j.Botao(pe, T("Fechar", "Close"), () => _j.Fechar(), 220f, true);
            }

            void Vazio(RectTransform lista, string s) { var t = _j.Texto(lista, s, 26f, Janela.Apagado, TextAlignmentOptions.Center); Janela.Altura(t, 120f); }

            /// <summary>"−  n  +": quantas unidades (so para o que acumula).</summary>
            int Quantas(RectTransform linha, string id, int maximo)
            {
                maximo = Math.Max(1, maximo);
                int n = Mathf.Clamp(_qtd.TryGetValue(id, out var q) ? q : 1, 1, maximo); _qtd[id] = n;
                _j.Botao(linha, "−", () => { _qtd[id] = Math.Max(1, n - 1); Desenhar(); }, 48f, false, n > 1);
                var t = _j.Texto(linha, n.ToString(), 26f, Janela.Pergaminho, TextAlignmentOptions.Center); Janela.Largura(t, 54f);
                _j.Botao(linha, "+", () => { _qtd[id] = Math.Min(maximo, n + 1); Desenhar(); }, 48f, false, n < maximo);
                return n;
            }

            void Compras(RectTransform lista)
            {
                var vivas = _ofertas.Where(o => o.Qtd != 0 && !JaTem(o.Item)).ToList();
                if (vivas.Count == 0) { Vazio(lista, T("Nada à venda agora.", "Nothing for sale right now.")); return; }
                foreach (var o in vivas)
                {
                    var linha = _j.Linha(lista, 96f, 14f, Janela.Fileira);
                    _j.Icone(linha, Janela.ImagemDe(o.Item), 78f);
                    var col = _j.Coluna(linha, 2f); Janela.Flex(col, 1f);
                    var n1 = _j.Texto(col, Nome(o.Item), 27f, Janela.Pergaminho); Janela.Altura(n1, 34f);
                    var d = Descricao(o.Item);
                    var n2 = _j.Texto(col, Tipo(o.Item) + (d.Length > 0 ? " · " + d : ""), 18f, Janela.Apagado); Janela.Altura(n2, 46f); n2.alignment = TextAlignmentOptions.TopLeft;
                    var est = _j.Texto(linha, o.Qtd < 0 ? "" : "×" + o.Qtd, 24f, Janela.Apagado, TextAlignmentOptions.Center); Janela.Largura(est, 70f);
                    int preco = Preco(o.Item);
                    var pr = _j.Texto(linha, Ouro(preco), 26f, Janela.Ouro, TextAlignmentOptions.MidlineRight); Janela.Largura(pr, 130f);
                    int cabe = preco > 0 ? _d.Gold / preco : int.MaxValue;
                    int max = Math.Min(Math.Min(o.Qtd < 0 ? 99 : o.Qtd, RestaNaVisita), cabe);
                    int n = 1;
                    if (o.Acumula && max > 1) n = Quantas(linha, o.Item.Id, max); else _j.Espaco(linha, 178f);
                    var oo = o; int nn = n;
                    _j.Botao(linha, T("Comprar", "Buy"), () => Comprar(oo, nn), 160f, false, max >= 1);
                }
            }

            void Comprar(Oferta o, int qtd)
            {
                var m = o.Item; int custo = Preco(m) * qtd;
                if (qtd <= 0 || _d.Gold < custo || (o.Qtd >= 0 && o.Qtd < qtd) || RestaNaVisita < qtd || JaTem(m)) return;
                try
                {
                    if (m is RecipeModel rec) { _d.AddTreasureDuringQuest(new SerializedRecipe(rec)); _d.AvailableRecipeIds?.Remove(rec.Id); }
                    else if (m is ConsumableModel c) { var ja = _d.GetConsumableItem(c, false); if (ja != null) ja.Qty = Math.Max(0, ja.Qty + qtd); else _d.AddTreasureDuringQuest(new SerializedConsumableItem(c, qtd)); }
                    else if (m is CraftingMaterialModel cm) { var ja = _d.GetCraftingMaterial(cm); if (ja != null) ja.Qty += qtd; else _d.AddTreasureDuringQuest(new SerializedCraftingMaterial(cm, qtd)); }
                    else { _d.AddTreasureDuringQuest(new SerializedItem(m)); _d.AvailableItemIds?.Remove(m.Id); }
                    _d.Gold -= custo;
                    if (o.Qtd > 0) o.Qtd -= qtd;
                    if (o.Fonte == "city" && _cidade != null)
                    {
                        if (m is CraftingMaterialModel cm2) { if (_cidade.Materials.ContainsKey(cm2)) _cidade.Materials[cm2] = Math.Max(0, _cidade.Materials[cm2] - qtd); }
                        else if (_cidade.FeaturedItems.ContainsKey(m)) _cidade.FeaturedItems[m] = 0;
                        _cidade.SaveShopData();
                    }
                    else Roteiro.Vars["loja:" + _chave + ":" + m.Id] = Vendidos(m.Id) + qtd;
                    _compradas += qtd; _qtd.Remove(m.Id);
                    var nome = (qtd > 1 ? qtd + " " : "") + Nome(m);
                    _recibo.Add(T("comprou ", "bought ") + nome + " (" + custo + ")");
                    _aviso = T("Compraram ", "Bought ") + nome + T(" por ", " for ") + Ouro(custo) + ".";
                    Jogo.Som("Reward_Generic"); Jogo.Sujo();
                    Log.Info("  loja: compra " + nome + " por " + custo + " (ouro agora " + _d.Gold + ")");
                }
                catch (Exception ex) { Log.Erro("comprando «" + m.Id + "»", ex); _aviso = T("A compra não deu certo.", "The purchase failed."); }
                Desenhar();
            }

            void Vendas(RectTransform lista)
            {
                var mats = (_d.CraftingMaterials ?? new List<SerializedCraftingMaterial>()).Where(x => x?.Model != null && x.Qty > 0).OrderBy(x => Butim.NomeItem(x.Model.Id)).ToList();
                if (mats.Count == 0) { Vazio(lista, T("O grupo não tem materiais para vender.", "The party has no materials to sell.")); return; }
                foreach (var sm in mats)
                {
                    var m = sm.Model;
                    var linha = _j.Linha(lista, 88f, 14f, Janela.Fileira);
                    _j.Icone(linha, Janela.ImagemDe(m), 70f);
                    var col = _j.Coluna(linha, 2f); Janela.Flex(col, 1f);
                    var n1 = _j.Texto(col, Butim.NomeItem(m.Id), 27f, Janela.Pergaminho); Janela.Altura(n1, 34f);
                    var n2 = _j.Texto(col, T("Vocês têm ", "You have ") + sm.Qty, 20f, Janela.Apagado); Janela.Altura(n2, 28f);
                    var pr = _j.Texto(linha, Ouro(PrecoVenda(m)), 26f, Janela.Ouro, TextAlignmentOptions.MidlineRight); Janela.Largura(pr, 130f);
                    int n = sm.Qty > 1 ? Quantas(linha, "v:" + m.Id, sm.Qty) : 1; if (sm.Qty <= 1) _j.Espaco(linha, 178f);
                    var smm = sm; int nn = n;
                    _j.Botao(linha, T("Vender", "Sell"), () => Vender(smm, nn), 160f);
                }
            }

            void Vender(SerializedCraftingMaterial sm, int qtd)
            {
                var m = sm.Model; if (qtd <= 0 || sm.Qty < qtd) return;
                try
                {
                    int ganho = PrecoVenda(m) * qtd;
                    sm.Qty -= qtd; if (sm.Qty <= 0) _d.RemoveTreasureDuringQuest(sm);
                    _d.Gold += ganho;
                    if (_cidade != null) { if (_cidade.Materials.ContainsKey(m)) _cidade.Materials[m] += qtd; else _cidade.Materials.Add(m, qtd); _cidade.SaveShopData(); }
                    _qtd.Remove("v:" + m.Id);
                    var nome = (qtd > 1 ? qtd + " " : "") + Butim.NomeItem(m.Id);
                    _recibo.Add(T("vendeu ", "sold ") + nome + " (" + ganho + ")");
                    _aviso = T("Venderam ", "Sold ") + nome + T(" por ", " for ") + Ouro(ganho) + ".";
                    Jogo.Som("Reward_Generic"); Jogo.Sujo();
                    Log.Info("  loja: venda " + nome + " por " + ganho + " (ouro agora " + _d.Gold + ")");
                }
                catch (Exception ex) { Log.Erro("vendendo «" + m.Id + "»", ex); _aviso = T("A venda não deu certo.", "The sale failed."); }
                Desenhar();
            }
        }
    }
}
