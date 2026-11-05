using System;
using System.Collections.Generic;
using System.Linq;
using FFG.D3;
using Newtonsoft.Json.Linq;
using static Bigorna.Idioma;

namespace Bigorna.Encontro
{
    /// <summary>v271: o que a equipe de uma partida gravada leva (o Novo jogo + e o mapa oneshot com a equipe de uma partida),
    /// em seções para o quadro "O que vai com a equipe": ouro, proezas, a Caveira Imortal, armas, armaduras, itens e as
    /// fraquezas e resistências de monstros descobertas. Cada seção diz também o que fica de fora, como as cópias de verdade
    /// fazem (GrupoDoSave.Copiar e NovoJogoMais.ForaDaColecao).</summary>
    public static class Bagagem
    {
        public class Secao { public string Titulo; public List<string> Linhas = new List<string>(); public string Nota; }

        static bool Fora<TM>(Func<string, bool, TM> pegar, string id) where TM : class
        {
            if (string.IsNullOrEmpty(id)) return false;
            try { return pegar(id, false) != null && pegar(id, true) == null; } catch { return false; }
        }
        static bool Proprio(string id) => !string.IsNullOrEmpty(id) && (id.StartsWith("B_", StringComparison.Ordinal) || id.StartsWith("BIGORNA_", StringComparison.Ordinal));
        static string Nome(string chave, string reserva) { try { var t = FFGLocalization.Get(chave, false); if (!string.IsNullOrEmpty(t) && t != chave) return Limpo(t); } catch { } return reserva; }
        static string Limpo(string t) => System.Text.RegularExpressions.Regex.Replace(t ?? "", "<[^>]+>", "").Trim();
        static string Contados(IEnumerable<string> nomes) => string.Join(" · ", nomes.GroupBy(n => n).OrderBy(g => g.Key, StringComparer.CurrentCulture).Select(g => g.Count() > 1 ? g.Key + " ×" + g.Count() : g.Key).ToArray());

        static string NomeDoItem(string id) { var m = Pegar(() => UserCollectionManager.GetItem(id, false)); return m != null ? Nome(m.KeyName, m.name) : id; }
        static string NomeDaArma(string id) { var m = Pegar(() => UserCollectionManager.GetWeapon(id, false)); return m != null ? Nome(m.KeyName, m.name) : id; }
        static T Pegar<T>(Func<T> f) where T : class { try { return f(); } catch { return null; } }

        static readonly string[] DanosPt = { "Esmagamento", "Corte", "Perfuração" };
        static string NomeDoDano(DamageTraits d)
        {
            int i = (int)d;
            if (i <= 2) return T(DanosPt[i], d.ToString());
            return d.ToString();   // (Ignos, Lumos, Umbros...: os nomes do jogo, os mesmos em toda língua)
        }

        /// <summary>As seções do que vai com a equipe do save. novoJogoMais: a partida nova da campanha oficial (o que é de fora da
        /// coleção do jogo fica de fora); senão, um mapa oneshot.</summary>
        public static List<Secao> Montar(GrupoDoSave.Save save, bool novoJogoMais)
        {
            var r = new List<Secao>();
            var dados = GrupoDoSave.DadosDoSave(save.Slot); var g = dados?.GameSceneData?.GameState;
            if (g == null) { r.Add(new Secao { Titulo = T("Partida ilegível", "Unreadable game"), Nota = T("Não consegui ler esta partida gravada.", "Could not read this saved game.") }); return r; }
            bool Sai(Func<string, bool, object> pegar, string id) => novoJogoMais && Fora(pegar, id);

            // ouro e XP
            r.Add(new Secao { Titulo = T("Ouro", "Gold"), Linhas = { g.Gold + T(" de ouro", " gold") + "   ·   " + g.PartyXP + " XP" } });

            // as proezas concluídas, por herói
            var feitas = (g.RealCompletedFeats ?? new List<string>()).Distinct().ToList();
            var proezas = new Secao { Titulo = T("Proezas concluídas", "Completed feats") };
            var forasP = new List<string>();
            foreach (var grupo in feitas.Select(id => new { id, m = Pegar(() => UserCollectionManager.GetFeat(id, false)) }).GroupBy(x => x.m?.HeroSource != null ? NomeDoHeroiModelo(x.m.HeroSource) : T("Todos", "Any hero")).OrderBy(x => x.Key))
            {
                var nomes = new List<string>();
                foreach (var x in grupo)
                {
                    string n = x.id; try { if (x.m != null) { var f = x.m.GetLocalizedFeatName(); if (!string.IsNullOrEmpty(f)) n = Limpo(f); } } catch { }
                    if (Sai((i, o) => UserCollectionManager.GetFeat(i, o), x.id)) forasP.Add(n); else nomes.Add(n);
                }
                if (nomes.Count > 0) proezas.Linhas.Add("<b>" + grupo.Key + ":</b> " + string.Join(" · ", nomes.OrderBy(z => z).ToArray()));
            }
            if (proezas.Linhas.Count == 0) proezas.Linhas.Add(T("Nenhuma.", "None."));
            if (forasP.Count > 0) proezas.Nota = T("Ficam de fora (de caixas fora da coleção do jogo): ", "Left out (from boxes outside the game's collection): ") + string.Join(" · ", forasP.ToArray());
            r.Add(proezas);

            // a Caveira Imortal: os tipos de monstro que já deram a receita (no quadro global da partida)
            // (v279: o nome vem do próprio jogo, na língua dele: o pacote não leva textos do jogo)
            var nomeDaCaveira = Nome("TRINKET10_ID", T("Caveira Imortal", "Skull"));
            var caveira = new Secao { Titulo = nomeDaCaveira };
            var (primeira, segunda, achou) = TiposDaCaveira(dados);
            caveira.Linhas.Add(!achou ? TF("A gravação não traz a lista da {0}.", "The save does not hold the “{0}” list.", nomeDaCaveira) : primeira.Count == 0 ? T("Nenhum monstro recompensado ainda.", "No monster rewarded yet.") : "<b>" + T("Já recompensados:", "Already rewarded:") + "</b> " + string.Join(" · ", primeira.Select(NomeDoTipo).ToArray()));
            if (segunda.Count > 0) caveira.Linhas.Add("<b>" + T("Também pela segunda vez:", "Also a second time:") + "</b> " + string.Join(" · ", segunda.Select(NomeDoTipo).ToArray()));
            caveira.Nota = novoJogoMais ? TF("Esta lista fica na partida de origem: a partida nova recomeça a contagem da {0}.", "This list stays in the original game: the new game starts the “{0}” count over.", nomeDaCaveira)
                : T("Esta lista fica na partida gravada: o mapa oneshot não a usa nem a muda.", "This list stays in the saved game: the one-shot map neither uses nor changes it.");
            r.Add(caveira);

            // as armas de cada herói
            var armas = new Secao { Titulo = T("Armas", "Weapons") };
            foreach (var p in (g.AllPlayers ?? new SerializedPlayer[0]).Where(p => p != null && !string.IsNullOrEmpty(p.HeroId)))
            {
                var ws = (p.EquippedWeapons ?? new List<SerializedWeapon>()).Where(w => w != null && !string.IsNullOrEmpty(w.Id)).ToList(); if (ws.Count == 0) continue;
                var partes = ws.Select(w =>
                {
                    var pecas = new[] { w.PartAId, w.PartBId, w.PartCId }.Where(x => !string.IsNullOrEmpty(x)).Select(NomeDoItem).ToArray();
                    return NomeDaArma(w.Id) + (pecas.Length > 0 ? " <size=85%>(" + string.Join(", ", pecas) + ")</size>" : "");
                }).ToArray();
                bool armaFora = novoJogoMais && ws.Any(w => Fora((i, o) => UserCollectionManager.GetWeapon(i, o), w.Id) || new[] { w.PartAId, w.PartBId, w.PartCId }.Any(x => Fora((i, o) => UserCollectionManager.GetWeaponPart(i, o), x)));
                armas.Linhas.Add("<b>" + Herois.NomeDe(p) + ":</b> " + string.Join(" · ", partes) + (armaFora ? T("  <i>(volta às armas iniciais: peça de fora da coleção)</i>", "  <i>(back to the starting weapons: a part from outside the collection)</i>") : ""));
            }
            var pecasSoltas = (g.ItemInventory ?? new List<SerializedItem>()).Where(x => x != null && Pegar(() => UserCollectionManager.GetItem(x.Id, false)) is WeaponPartsModel).ToList();
            if (pecasSoltas.Count > 0) armas.Linhas.Add("<b>" + T("Peças no inventário:", "Parts in the inventory:") + "</b> " + Contados(pecasSoltas.Where(x => !Sai((i, o) => UserCollectionManager.GetItem(i, o), x.Id)).Select(x => NomeDoItem(x.Id))));
            if (armas.Linhas.Count == 0) armas.Linhas.Add(T("Nenhuma.", "None."));
            r.Add(armas);

            // armaduras e os outros itens do inventário
            var inv = (g.ItemInventory ?? new List<SerializedItem>()).Where(x => x != null && !string.IsNullOrEmpty(x.Id)).Select(x => new { x.Id, m = Pegar(() => UserCollectionManager.GetItem(x.Id, false)) }).ToList();
            var forasI = inv.Where(x => Sai((i, o) => UserCollectionManager.GetItem(i, o), x.Id) || (!novoJogoMais ? false : Proprio(x.Id))).ToList();
            var ficam = inv.Except(forasI).ToList();
            r.Add(new Secao { Titulo = T("Armaduras", "Armor"), Linhas = { Ou(Contados(ficam.Where(x => x.m is ArmorModel).Select(x => NomeDoItem(x.Id)))) } });
            var itens = new Secao { Titulo = T("Itens", "Items"), Linhas = { Ou(Contados(ficam.Where(x => !(x.m is ArmorModel) && !(x.m is WeaponPartsModel)).Select(x => NomeDoItem(x.Id)))) } };
            if (forasI.Count > 0) itens.Nota = T("Ficam de fora (fora da coleção do jogo, ou criados num mapa do Bigorna): ", "Left out (outside the game's collection, or made in a Bigorna map): ") + Contados(forasI.Select(x => NomeDoItem(x.Id)));
            r.Add(itens);

            // as fraquezas e resistências descobertas, por monstro
            var desc = new Secao { Titulo = T("Fraquezas e resistências de monstros descobertas", "Discovered monster weaknesses and resistances") };
            if ((g.DiscoveredEnemyVulnerabilities ?? new List<EnemyVulnerabilityFlags>()).Count > 0)
            {
                IEnumerable<EnemyModel> todos = null; try { todos = UserCollectionManager.GetEnemies(true); } catch { }
                foreach (var e in (todos ?? new EnemyModel[0]).Where(e => e != null && !string.IsNullOrEmpty(e.Id)).OrderBy(e => Inimigos.NomeDe(e) ?? e.Id))
                {
                    byte b; try { b = g.GetEnemyVulnerabilityFlags(e.Id); } catch { continue; }
                    if (b == 0 || e.WeaknessesAndResistances == null) continue;
                    var fracos = new List<string>(); var fortes = new List<string>();
                    for (int k = 0; k < e.WeaknessesAndResistances.Length && k < 8; k++)
                        if ((b & (1 << k)) != 0) (e.WeaknessesAndResistances[k].TraitType == EnemyTraitType.Weakness ? fracos : fortes).Add(NomeDoDano(e.WeaknessesAndResistances[k].TraitValue));
                    if (fracos.Count + fortes.Count == 0) continue;
                    desc.Linhas.Add("<b>" + (Inimigos.NomeDe(e) ?? e.Id) + ":</b> " + string.Join("; ", new[] { fracos.Count > 0 ? T("fraco a ", "weak to ") + string.Join(", ", fracos.ToArray()) : null, fortes.Count > 0 ? T("resiste a ", "resists ") + string.Join(", ", fortes.ToArray()) : null }.Where(z => z != null).ToArray()));
                }
            }
            if (desc.Linhas.Count == 0) desc.Linhas.Add(T("Nenhuma descoberta ainda.", "Nothing discovered yet."));
            r.Add(desc);
            return r;
        }

        static string Ou(string s) => string.IsNullOrEmpty(s) ? T("Nenhum.", "None.") : s;

        static string NomeDoHeroiModelo(HeroModel h) { try { var n = FFGLocalization.Get(h.KeyName, false); return string.IsNullOrEmpty(n) ? h.name : Limpo(n); } catch { return h?.name ?? "?"; } }

        /// <summary>O nome de um tipo de monstro: o de um monstro comum desse tipo, na língua do jogo.</summary>
        static string NomeDoTipo(string tipo)
        {
            try
            {
                var e = UserCollectionManager.GetEnemies(false).Where(m => m != null && string.Equals(m.Type.ToString(), tipo, StringComparison.OrdinalIgnoreCase)).OrderBy(m => m.IsNamed ? 1 : 0).ThenBy(m => m.Id, StringComparer.Ordinal).FirstOrDefault();
                var n = e != null ? Inimigos.NomeDe(e) : null; if (!string.IsNullOrEmpty(n)) return n;
            }
            catch { }
            return tipo;
        }

        /// <summary>Os tipos de monstro da Caveira Imortal no quadro global gravado da partida: UndyingSkullTypes (já deram a receita)
        /// e UndyingSkullTypesSecondary (a segunda vez).</summary>
        static (List<string>, List<string>, bool) TiposDaCaveira(SerializedSaveData dados)
        {
            var um = new List<string>(); var dois = new List<string>(); bool achou = false;
            try
            {
                foreach (var ent in dados?.GameSceneData?.SceneEntities ?? new List<SerializedSceneEntity>())
                {
                    var bb = ent?.SerializedBlackboard; if (string.IsNullOrEmpty(bb) || bb.IndexOf("UndyingSkullTypes", StringComparison.Ordinal) < 0) continue;
                    var j = JToken.Parse(bb) as JContainer; if (j == null) continue;
                    foreach (var o in j.Descendants().OfType<JObject>())
                    {
                        var nome = (string)o["_name"] ?? (o.Parent as JProperty)?.Name;
                        var lista = (o["_value"] ?? o["value"]) as JArray; if (lista == null) continue;
                        if (nome == "UndyingSkullTypes") { achou = true; um = lista.Select(x => (string)x).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList(); }
                        else if (nome == "UndyingSkullTypesSecondary") dois = lista.Select(x => (string)x).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList();
                    }
                }
            }
            catch (Exception ex) { Log.Info("Caveira Imortal no save: " + ex.Message); }
            return (um, dois, achou);
        }
    }
}
