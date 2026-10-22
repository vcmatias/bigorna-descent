using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using Bigorna.Motor;
using FFG.Core;
using FFG.D3;
using TMPro;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Encontro
{
    /// <summary>O gatilho "Abrir a fabricação" (openCrafting): a fabricação da cidade no meio do mapa. O grupo fabrica, com os
    /// materiais que tem, os itens das receitas que conhece, pela regra do proprio jogo (SerializedRecipe.CraftItem: gasta os
    /// materiais, poe o item no inventario; a melhoria troca o item de base, ate na arma ou no adorno que o heroi usa; cada
    /// receita fabrica uma vez). Uma peca de arma fabricada pode ir direto para a arma do heroi, como no jogo. O autor escolhe
    /// os tipos que valem ("kinds": armor, consumable, trinket, weaponPart) e quantas vezes abre ("uses").</summary>
    public static class Forja
    {
        public static string Titulo() => Jogo.Texto("UI_CRAFTING", T("Fabricação", "Crafting"));

        public static void Abrir(Dictionary<string, object> p)
        {
            var chave = P.Texto(p, "key") ?? "forja";
            int usos = Math.Max(0, P.Inteiro(p, "uses", 0));
            var vUsos = "forja-usos:" + chave;
            if (usos > 0 && Roteiro.Var(vUsos) >= usos)
            {
                Dialogos.Mensagem(Roteiro.ComContadores(P.Texto(p, "closedText")) ?? T("A oficina de fabricação já fechou.", "The crafting workshop has closed."), null, Titulo());
                return;
            }
            if (Jogo.Partida == null) { Dialogos.Mensagem(T("O grupo pode fabricar na mesa, como na cidade.", "The party may craft at the table, as in the city."), null, Titulo()); return; }
            var tipos = (P.Textos(p, "kinds") ?? new List<string> { "armor", "consumable", "trinket", "weaponPart" }).Select(x => x.Trim()).ToList();
            Dialogos.JanelaPropria(fechou =>
            {
                Roteiro.Vars[vUsos] = Roteiro.Var(vUsos) + 1;
                try { new Visita(tipos, fechou).Abrir(); return true; }
                catch (Exception ex) { Log.Erro("abrindo a fabricação", ex); return false; }
            });
        }

        static string TipoDe(ItemModel m) => m is ArmorModel ? "armor" : m is ConsumableModel ? "consumable" : m is TrinketModel ? "trinket" : m is WeaponPartsModel ? "weaponPart" : "other";

        class Visita
        {
            readonly SerializedGame _d = Jogo.Partida;
            readonly List<string> _tipos;
            readonly Action _fechou;
            Janela _j;
            string _aviso = "";
            WeaponPartsModel _paraEquipar;
            int _feitas;

            public Visita(List<string> tipos, Action fechou) { _tipos = tipos; _fechou = fechou; }

            public void Abrir()
            {
                _j = Janela.Nova(Titulo(), 1360f, 900f, Fechou);
                Jogo.Som("Crafting");
                Log.Info("fabricação: tipos " + string.Join(", ", _tipos.ToArray()));
                Desenhar();
            }

            void Fechou()
            {
                Log.Info("fabricação: " + _feitas + " item(ns) fabricado(s)");
                Jogo.Sujo();
                try { Jogo.UI?.HeroMenu?.SyncTo(Jogo.Partida.ActivePlayers); } catch { }
                _fechou?.Invoke();
            }

            static ItemModel Alvo(RecipeModel r) { try { return UserCollectionManager.GetItem(r.CraftedItemId, false); } catch { return null; } }

            static string Nome(RecipeModel r) => Butim.NomeItem(r.CraftedItemId);

            int Tenho(CraftingMaterialModel m) { try { return _d.GetCraftingMaterialAmount(m); } catch { return 0; } }

            static string Descricao(ItemModel m)
            {
                try { var k = m?.GetDescriptionKey(); if (string.IsNullOrEmpty(k)) return ""; var t = FFGLocalization.Get(k, false); return string.IsNullOrEmpty(t) || t == k ? "" : t.Replace("\n", " "); }
                catch { return ""; }
            }

            List<SerializedRecipe> Receitas() => (_d.DiscoveredRecipes ?? new List<SerializedRecipe>())
                .Where(r => r?.Model != null && !r.Crafted).Where(r => { var a = Alvo(r.Model); return a != null && _tipos.Contains(TipoDe(a)); })
                .OrderByDescending(r => SafeQtd(r) > 0).ThenBy(r => Nome(r.Model)).ToList();

            static int SafeQtd(SerializedRecipe r) { try { return r.CanCraftQty(); } catch { return 0; } }

            void Desenhar()
            {
                if (_j == null) return;
                _j.Limpar();
                _j.Canto.text = "";
                var lista = _j.Rolagem(_j.Corpo);
                var rs = Receitas();
                if (rs.Count == 0) { var t = _j.Texto(lista, T("O grupo não conhece nenhuma receita que se fabrique aqui.", "The party knows no recipe that can be crafted here."), 26f, Janela.Apagado, TextAlignmentOptions.Center); Janela.Altura(t, 120f); }
                foreach (var r in rs)
                {
                    var alvo = Alvo(r.Model); int pode = SafeQtd(r);
                    var linha = _j.Linha(lista, 112f, 14f, Janela.Fileira);
                    _j.Icone(linha, Janela.ImagemDe(alvo), 90f);
                    var col = _j.Coluna(linha, 2f); Janela.Flex(col, 1f);
                    var n1 = _j.Texto(col, Nome(r.Model) + (r.Model.IsUpgrade ? T("  (melhoria de ", "  (upgrade of ") + Butim.NomeItem(r.Model.BaseItemId) + ")" : ""), 26f, Janela.Pergaminho); Janela.Altura(n1, 32f);
                    var custos = (r.Model.GetMaterialCosts() ?? new RecipeModel.MaterialCost[0]).Where(c => c?.Material != null)
                        .Select(c => { int t = Tenho(c.Material); return "<color=" + (t >= c.Qty ? "#D9C9A3" : "#E07A6F") + ">" + c.Qty + " " + Butim.NomeItem(c.Material.Id) + " (" + t + ")</color>"; }).ToArray();
                    var n2 = _j.Texto(col, custos.Length > 0 ? string.Join(" · ", custos) : T("sem custo", "no cost"), 20f, Janela.Pergaminho); Janela.Altura(n2, 28f);
                    var n3 = _j.Texto(col, Descricao(alvo), 17f, Janela.Apagado); Janela.Altura(n3, 42f); n3.alignment = TextAlignmentOptions.TopLeft;
                    var rr = r;
                    _j.Botao(linha, T("Fabricar", "Craft"), () => Fabricar(rr), 180f, false, pode > 0);
                }
                var pe = _j.Linha(_j.Corpo, 60f);
                var av = _j.Texto(pe, _aviso, 24f, Janela.Pergaminho); Janela.Flex(av, 1f);
                if (_paraEquipar != null && QuemUsa(_paraEquipar, out var h, out _)) _j.Botao(pe, T("Equipar em ", "Equip on ") + Herois.NomeDe(h), Equipar, 300f);
                _j.Botao(pe, T("Fechar", "Close"), () => _j.Fechar(), 220f, true);
            }

            void Fabricar(SerializedRecipe r)
            {
                if (SafeQtd(r) <= 0) return;
                var alvo = Alvo(r.Model);
                try
                {
                    r.CraftItem();
                    _feitas++; Jogo.Som("CR_Craft"); Jogo.Sujo();
                    try { Jogo.Persistente?.FeatController?.ProgressItemGain(alvo is ArmorModel ? ItemType.Armor : alvo is ConsumableModel ? ItemType.Consumable : alvo is TrinketModel ? ItemType.Trinket : ItemType.WeaponPart, null, 1); } catch { }
                    _aviso = T("Fabricaram ", "Crafted ") + Nome(r.Model) + ".";
                    // uma peca nova (nao melhoria: a melhoria ja trocou a peca na arma) pode ir para a arma do heroi, como no jogo
                    _paraEquipar = !r.Model.IsUpgrade && alvo is WeaponPartsModel wp && wp.Class != WeaponClasses.Rune ? wp : null;
                    Log.Info("  fabricação: «" + r.Model.Id + "» → " + r.Model.CraftedItemId);
                    try { Jogo.UI?.HeroMenu?.SyncTo(Jogo.Partida.ActivePlayers); } catch { }
                }
                catch (Exception ex) { Log.Erro("fabricando «" + r.Model.Id + "»", ex); _aviso = T("A fabricação não deu certo.", "Crafting failed."); }
                Desenhar();
            }

            /// <summary>O heroi dono da peca e a arma da mesma classe (a da mao, senao a do conjunto), como o "Equipar" do jogo.</summary>
            bool QuemUsa(WeaponPartsModel p, out SerializedPlayer h, out SerializedWeapon w)
            {
                h = null; w = null;
                try
                {
                    var hm = UserCollectionManager.GetHeroModel(p.GetHero()); if (hm == null) return false;
                    h = _d.GetPlayer(hm, false); if (h == null || HeroisProprios.ArmasDoMapa(h)) return false;
                    w = (h.EquippedWeapons ?? new List<SerializedWeapon>()).FirstOrDefault(x => x?.Model != null && x.Model.Class == p.Class)
                        ?? (h.DefaultWeaponsBuild ?? new List<SerializedWeapon>()).FirstOrDefault(x => x?.Model != null && x.Model.Class == p.Class);
                    return w != null;
                }
                catch { return false; }
            }

            void Equipar()
            {
                var p = _paraEquipar; _paraEquipar = null;
                if (p != null && QuemUsa(p, out var h, out var w))
                {
                    try { w.SetWeaponPart(p); Jogo.Som("AR_Change_Part"); Jogo.Sujo(); try { Jogo.UI?.HeroMenu?.SyncTo(Jogo.Partida.ActivePlayers); } catch { } _aviso = Herois.NomeDe(h) + T(" equipou ", " equipped ") + Butim.NomeItem(p.Id) + "."; Log.Info("  fabricação: peça «" + p.Id + "» na arma de " + h.Model?.Id); }
                    catch (Exception ex) { Log.Erro("equipando a peça", ex); }
                }
                Desenhar();
            }
        }
    }
}
