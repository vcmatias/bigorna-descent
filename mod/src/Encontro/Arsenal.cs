using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using Bigorna.Motor;
using FFG.Core;
using FFG.D3;
using FFG.D3.UI;
using TMPro;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Encontro
{
    /// <summary>O gatilho "Abrir o arsenal" (openArmory): o arsenal da cidade no meio do mapa. Cada heroi troca as armas (as do
    /// proprio conjunto e as runicas do grupo, como no jogo) e as pecas delas (as que o grupo tem, da mesma classe da arma).
    /// O autor escolhe o que vale ("weapons", "parts") e quantas vezes abre ("uses"). As regras sao as do arsenal do jogo
    /// (UIArmoryDialog): a runica equipada sai das compartilhadas e volta quando sai da mao; a arma do conjunto que fica de
    /// fora guarda as pecas. Os herois com armas da Oficina postas por este mapa ficam como estao.</summary>
    public static class Arsenal
    {
        public static string Titulo() => Jogo.Texto("UI_ARMORY", T("Arsenal", "Armory"));

        public static void Abrir(Dictionary<string, object> p)
        {
            var chave = P.Texto(p, "key") ?? "arsenal";
            int usos = Math.Max(0, P.Inteiro(p, "uses", 0));
            var vUsos = "arsenal-usos:" + chave;
            if (usos > 0 && Roteiro.Var(vUsos) >= usos)
            {
                Dialogos.Mensagem(Roteiro.ComContadores(P.Texto(p, "closedText")) ?? T("O arsenal já fechou.", "The armory has closed."), null, Titulo());
                return;
            }
            if (Jogo.Partida == null || Jogo.Herois.Count == 0) { Dialogos.Mensagem(T("Os heróis podem trocar armas e peças na mesa, como no arsenal da cidade.", "The heroes may change weapons and parts at the table, as in the city's armory."), null, Titulo()); return; }
            Dialogos.JanelaPropria(fechou =>
            {
                Roteiro.Vars[vUsos] = Roteiro.Var(vUsos) + 1;
                try { new Visita(P.Booleano(p, "weapons", true), P.Booleano(p, "parts", true), fechou).Abrir(); return true; }
                catch (Exception ex) { Log.Erro("abrindo o arsenal", ex); return false; }
            });
        }

        static readonly WeaponPartSlots[] Encaixes = { WeaponPartSlots.A, WeaponPartSlots.B, WeaponPartSlots.C };

        public static string NomeArma(WeaponModel m)
        {
            if (m == null) return "?";
            try { var t = FFGLocalization.Get(m.KeyName, false); if (!string.IsNullOrEmpty(t) && t != m.KeyName) return t; } catch { }
            return m.name;
        }

        static WeaponPartsModel Parte(SerializedWeapon w, WeaponPartSlots s) => s == WeaponPartSlots.A ? w.PartA : s == WeaponPartSlots.B ? w.PartB : w.PartC;

        class Visita
        {
            readonly SerializedGame _d = Jogo.Partida;
            readonly List<SerializedPlayer> _herois = Jogo.Herois;
            readonly bool _armas, _pecas;
            readonly Action _fechou;
            Janela _j;
            int _h;
            string _aviso = "";
            int _mudancas;

            public Visita(bool armas, bool pecas, Action fechou) { _armas = armas; _pecas = pecas; _fechou = fechou; }

            public void Abrir()
            {
                _j = Janela.Nova(Titulo(), 1360f, 960f, Fechou);
                Jogo.Som("Armory");
                Log.Info("arsenal: " + _herois.Count + " herói(s), armas " + (_armas ? "sim" : "não") + ", peças " + (_pecas ? "sim" : "não"));
                Desenhar();
            }

            void Fechou()
            {
                Log.Info("arsenal: " + _mudancas + " troca(s)");
                Jogo.Sujo();
                try { Jogo.UI?.HeroMenu?.SyncTo(Jogo.Partida.ActivePlayers); } catch { }
                _fechou?.Invoke();
            }

            /// <summary>As armas que podem ir para a mao i do heroi: a que esta nela, as do conjunto dele que nao estao na outra mao
            /// e as runicas compartilhadas do grupo (nenhum heroi com ela). Em ordem fixa, para as setas andarem sempre igual.</summary>
            List<SerializedWeapon> Opcoes(SerializedPlayer h, int i)
            {
                var atual = h.EquippedWeapons[i]; var outra = h.EquippedWeapons[1 - i];
                var l = new List<SerializedWeapon> { atual };
                foreach (var w in h.DefaultWeaponsBuild ?? new List<SerializedWeapon>())
                    if (w?.Model != null && w.Model.Id != outra?.Model?.Id && l.All(x => x.Model.Id != w.Model.Id)) l.Add(w);
                try { foreach (var w in _d.GetOwnedRuneWeapons() ?? new List<SerializedWeapon>()) if (w?.Model != null && w.Model.Id != outra?.Model?.Id && l.All(x => x.Model.Id != w.Model.Id)) l.Add(w); }
                catch (Exception ex) { Log.Info("arsenal: runas " + ex.Message); }
                return l.OrderBy(x => x.Model.Class == WeaponClasses.Rune ? 1 : 0).ThenBy(x => x.Model.Id, StringComparer.Ordinal).ToList();
            }

            void TrocarArma(SerializedPlayer h, int i, int passo)
            {
                var ops = Opcoes(h, i); if (ops.Count < 2) return;
                var antes = h.EquippedWeapons[i];
                int k = ops.FindIndex(x => x.Model.Id == antes.Model.Id); if (k < 0) k = 0;
                var nova = ops[((k + passo) % ops.Count + ops.Count) % ops.Count];
                h.EquippedWeapons[i] = nova;
                if (antes.Model.Class == WeaponClasses.Rune) { if (!_d.SharedWeaponIds.Contains(antes.Model.Id)) _d.SharedWeaponIds.Add(antes.Model.Id); }
                else h.UpdateDefaultWeaponBuild(antes);
                if (nova.Model.Class == WeaponClasses.Rune) _d.SharedWeaponIds.Remove(nova.Model.Id);
                _mudancas++; Jogo.Som("AR_Change_Part"); Mudou();
                _aviso = Herois.NomeDe(h) + T(" empunha ", " now wields ") + NomeArma(nova.Model) + ".";
                Log.Info("  arsenal: " + h.Model?.Id + " mão " + (i + 1) + ": " + antes.Model.Id + " → " + nova.Model.Id);
                Desenhar();
            }

            void TrocarPeca(SerializedPlayer h, int i, WeaponPartSlots s, int passo)
            {
                var w = h.EquippedWeapons[i];
                var ops = _d.GetOwnedPartsOfWeaponClass(w.Model.Class, s) ?? new List<WeaponPartsModel>(); if (ops.Count < 2) return;
                var atual = Parte(w, s);
                int k = ops.FindIndex(x => atual != null && x.Id == atual.Id); if (k < 0) k = passo > 0 ? -1 : 0;
                var nova = ops[((k + passo) % ops.Count + ops.Count) % ops.Count];
                h.EquippedWeapons[i] = new SerializedWeapon(w.Model, s == WeaponPartSlots.A ? nova : w.PartA, s == WeaponPartSlots.B ? nova : w.PartB, s == WeaponPartSlots.C ? nova : w.PartC);
                _mudancas++; Jogo.Som("AR_Change_Part"); Mudou();
                _aviso = NomeArma(w.Model) + ": " + Butim.NomeItem(nova.Id) + ".";
                Log.Info("  arsenal: " + h.Model?.Id + " mão " + (i + 1) + " peça " + s + ": " + (atual?.Id ?? "-") + " → " + nova.Id);
                Desenhar();
            }

            void Mudou()
            {
                Jogo.Sujo();
                try { Jogo.UI?.HeroMenu?.SyncTo(Jogo.Partida.ActivePlayers); } catch { }
            }

            void Desenhar()
            {
                if (_j == null) return;
                _j.Limpar();
                _h = Mathf.Clamp(_h, 0, _herois.Count - 1);
                var h = _herois[_h];
                _j.Canto.text = "";
                var abas = _j.Linha(_j.Corpo, 54f);
                for (int k = 0; k < _herois.Count; k++) { int kk = k; _j.Botao(abas, Herois.NomeDe(_herois[k]), () => { _h = kk; _aviso = ""; Desenhar(); }, 250f, k == _h); }
                var corpo = _j.Coluna(_j.Corpo, 10f); Janela.Flex(corpo, 1f, 1f);
                if (HeroisProprios.ArmasDoMapa(h))
                {
                    var t = _j.Texto(corpo, TF("As armas de {0} vêm deste mapa: o arsenal não as troca.", "The weapons of {0} come from this map: the armory does not change them.", Herois.NomeDe(h)), 26f, Janela.Apagado, TextAlignmentOptions.Center);
                    Janela.Altura(t, 160f);
                }
                else if (h.EquippedWeapons == null || h.EquippedWeapons.Count < 2) { var t = _j.Texto(corpo, T("Este herói não tem armas para trocar.", "This hero has no weapons to change."), 26f, Janela.Apagado, TextAlignmentOptions.Center); Janela.Altura(t, 160f); }
                else
                {
                    var lado = _j.Linha(corpo, 690f, 26f);
                    for (int i = 0; i < 2; i++) Mao(lado, h, i);
                }
                var pe = _j.Linha(_j.Corpo, 60f);
                var av = _j.Texto(pe, _aviso, 24f, Janela.Pergaminho); Janela.Flex(av, 1f);
                _j.Botao(pe, T("Pronto", "Done"), () => _j.Fechar(), 220f, true);
            }

            /// <summary>O desenho da arma inteira, montado pelo proprio jogo (o prefab da arma com as tres pecas, como no arsenal e
            /// no painel do heroi), encaixado na altura dada.</summary>
            void Arte(RectTransform pai, SerializedWeapon w, float alto)
            {
                var caixa = Janela.Caixa(pai, "Arte"); Janela.Altura(caixa, alto);
                try
                {
                    var molde = string.IsNullOrEmpty(w.Model.PrefabAssetPath) ? null : Jogo.Persistente?.ABLoader?.LoadAsset<GameObject>(w.Model.PrefabAssetPath);
                    if (molde == null) return;
                    var go = UnityEngine.Object.Instantiate(molde, caixa, false);
                    var le = go.GetComponent<UnityEngine.UI.LayoutElement>() ?? go.AddComponent<UnityEngine.UI.LayoutElement>(); le.ignoreLayout = true;
                    foreach (var g in go.GetComponentsInChildren<UnityEngine.UI.Graphic>(true)) g.raycastTarget = false;
                    go.GetComponent<UIWeaponArtDisplay>()?.LoadWeaponSprites(w);
                    if (go.transform is RectTransform rt)
                    {
                        rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f); rt.anchoredPosition = Vector2.zero;
                        float lw = Mathf.Max(1f, rt.rect.width), lh = Mathf.Max(1f, rt.rect.height);
                        float e = Mathf.Min(alto * 2.2f / lw, alto / lh); if (e > 0.01f && e < 20f) rt.localScale = Vector3.one * e;
                    }
                }
                catch (Exception ex) { Log.Info("arsenal: desenho da arma " + ex.Message); }
            }

            static string NomePeca(WeaponPartsModel p)
            {
                try { var t = FFGLocalization.Get(p.Id, false); if (!string.IsNullOrEmpty(t) && t != p.Id) return t; } catch { }
                return Butim.NomeItem(p.Id);
            }

            static string Habilidade(WeaponPartsModel p)
            {
                try { if (p.Ability != null) return (p.Ability.GetFormattedDescription() ?? "").Replace("\n", " "); } catch { }
                return Jogo.Texto("UI_NO_ABILITY", T("Sem habilidade", "No ability"));
            }

            void Mao(RectTransform pai, SerializedPlayer h, int i)
            {
                var w = h.EquippedWeapons[i];
                var col = _j.Coluna(pai, 10f); Janela.Flex(col, 1f);
                col.gameObject.AddComponent<UnityEngine.UI.Image>().color = Janela.Fileira;
                var vl = col.GetComponent<UnityEngine.UI.VerticalLayoutGroup>(); vl.padding = new RectOffset(18, 18, 14, 14);
                var rot = _j.Texto(col, T("Arma ", "Weapon ") + (i + 1), 22f, Janela.Ouro); Janela.Altura(rot, 30f);
                var ops = _armas ? Opcoes(h, i) : null;
                var topo = _j.Linha(col, 64f, 10f);
                bool troca = ops != null && ops.Count > 1;
                if (troca) _j.Botao(topo, "◀", () => TrocarArma(h, i, -1), 60f);
                var nome = _j.Texto(topo, NomeArma(w?.Model), 30f, Janela.Pergaminho, TextAlignmentOptions.Center); Janela.Flex(nome, 1f);
                if (troca) _j.Botao(topo, "▶", () => TrocarArma(h, i, +1), 60f);
                if (w?.Model == null) return;
                Arte(col, w, 190f);
                if (w.Model.Class == WeaponClasses.Rune)
                {
                    var t = _j.Texto(col, T("Arma rúnica: sem peças para trocar.", "Rune weapon: no parts to change."), 22f, Janela.Apagado, TextAlignmentOptions.Center); Janela.Altura(t, 60f);
                    return;
                }
                foreach (var s in Encaixes)
                {
                    var parte = Parte(w, s);
                    List<WeaponPartsModel> pops = null; try { pops = _pecas ? _d.GetOwnedPartsOfWeaponClass(w.Model.Class, s) : null; } catch { }
                    // (como no arsenal do jogo: o nome da peca e a habilidade dela; o desenho da arma inteira fica em cima)
                    var linha = _j.Linha(col, 92f, 12f, new Color(0f, 0f, 0f, 0.2f));
                    var tx = _j.Coluna(linha, 2f); Janela.Flex(tx, 1f);
                    var nm = _j.Texto(tx, parte != null ? NomePeca(parte) : T("(sem peça)", "(no part)"), 24f, Janela.Pergaminho); Janela.Altura(nm, 32f);
                    var ds = _j.Texto(tx, parte != null ? Habilidade(parte) : "", 17f, Janela.Apagado); Janela.Altura(ds, 44f); ds.alignment = TextAlignmentOptions.TopLeft;
                    if (pops != null && pops.Count > 1)
                    {
                        var ss = s;
                        _j.Botao(linha, "◀", () => TrocarPeca(h, i, ss, -1), 56f);
                        _j.Botao(linha, "▶", () => TrocarPeca(h, i, ss, +1), 56f);
                    }
                }
            }
        }
    }
}
