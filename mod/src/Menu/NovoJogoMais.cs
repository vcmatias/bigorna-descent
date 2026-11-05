using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using FFG.Core;
using FFG.D3;
using Newtonsoft.Json;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>
    /// v262, o "Novo jogo +": a campanha oficial de novo desde a missao 1 do Ato I, com as regras e a historia do proprio jogo,
    /// e o grupo de uma partida terminada (Ato I ou Ato II vencido) como ele esta: herois, armas, armaduras, apetrechos, itens,
    /// ouro, XP, materiais, receitas, pericias, lendas, companheiros e proezas. Vencido o Ato I, segue para o Ato II pela
    /// passagem de ato do jogo. A partida nasce como a do botao "Nova campanha" do jogo (SerializedGame novo, Initialize,
    /// missao inicial, primeira ranhura livre, o quadro de dificuldade do jogo e a introducao), entao a historia comeca do zero
    /// (os quadros de variaveis da cena nascem na tela de titulo, limpos).
    ///
    /// O mod nao muda metodos do jogo: ele vigia a partida marcada como Novo jogo + (pelo SaveSlotGUID, em
    /// Bigorna/NovoJogoMais.json) e acerta o estado:
    /// - XP: nunca abaixo do que o grupo trouxe (a historia pode subir alem dele);
    /// - receitas repetidas (a historia da uma receita que o grupo ja tem: um registro novo, "nao fabricada"): fica uma, a ja
    ///   fabricada vale;
    /// - item dado de novo quando o grupo ja tem a versao melhorada, ou copia a mais de um item unico: sai;
    /// - item do grupo equipado que a historia tirou do inventario: volta;
    /// - proeza concluida que volta a ser oferecida ou em andamento (a passagem ao Ato II oferece a inicial do ato): sai;
    /// - itens e receitas de um ato posterior na lista do que pode ser sorteado ou vendido: saem;
    /// - monstros mais fortes: a progressao da campanha (CampaignProgression, que a historia define a cada missao) recebe um
    ///   acrescimo fixo, reaplicado cada vez que a historia a muda;
    /// - na primeira missao do Ato II, se o jogo aplicar o "grupo pronto" do Ato II (o de quem comeca no Ato II sem save), o
    ///   grupo guardado na passagem de ato volta.
    /// As virtudes dos herois comecam como numa campanha nova (elas guiam escolhas da historia).
    /// </summary>
    public static class NovoJogoMais
    {
        /// <summary>O acrescimo na progressao da campanha (cada missao da historia soma cerca de 2): monstros de umas seis
        /// missoes adiante.</summary>
        public const int AcrescimoDeProgressao = 12;

        public class Marca
        {
            public string Origem;            // o nome da partida de onde o grupo veio
            public int Xp;                   // o XP que o grupo trouxe (piso)
            public List<string> Itens = new List<string>();   // os itens que o grupo trouxe (os que voltam se a historia tirar, equipados)
            public string GrupoNoAto2;       // o grupo (JSON) guardado na passagem ao Ato II
            public bool RestauradoNoAto2;
            public int? Progressao;          // o ultimo valor da progressao da campanha escrito pelo mod
            public int Ciclo = 1;            // quantas vezes o grupo recomecou
        }

        static string Arquivo => Path.Combine(Application.persistentDataPath, "Bigorna", "NovoJogoMais.json");
        static Dictionary<string, Marca> _marcas;
        static Dictionary<string, Marca> Marcas
        {
            get
            {
                if (_marcas != null) return _marcas;
                try { _marcas = File.Exists(Arquivo) ? JsonConvert.DeserializeObject<Dictionary<string, Marca>>(File.ReadAllText(Arquivo)) : null; } catch (Exception ex) { Log.Erro("Novo jogo +: lendo as marcas", ex); }
                return _marcas ?? (_marcas = new Dictionary<string, Marca>());
            }
        }
        static void Gravar()
        {
            try { Directory.CreateDirectory(Path.GetDirectoryName(Arquivo)); File.WriteAllText(Arquivo, JsonConvert.SerializeObject(Marcas, Formatting.Indented)); }
            catch (Exception ex) { Log.Erro("Novo jogo +: gravando as marcas", ex); }
        }

        /// <summary>A partida em jogo agora e um Novo jogo +.</summary>
        public static Marca Atual { get { var d = Jogo.Partida; return d != null && !string.IsNullOrEmpty(d.SaveSlotGUID) && Marcas.TryGetValue(d.SaveSlotGUID, out var m) ? m : null; } }

        /// <summary>Uma partida gravada que venceu o Ato I ou o Ato II da campanha oficial (o grupo pode recomecar).</summary>
        public static bool Terminada(Encontro.GrupoDoSave.Save s)
        {
            if (s == null || s.Campanha != null) return false;
            var g = Encontro.GrupoDoSave.JogoDoSave(s.Slot); if (g == null || g.CompletedDestinationIds == null) return false;
            return g.CompletedDestinationIds.Contains("STORY_QUEST_14") || g.CompletedDestinationIds.Contains("ACT2_QUEST_11");
        }

        /// <summary>Monta a partida nova com o grupo do save e abre o quadro de dificuldade do jogo, que leva a introducao da
        /// missao 1. Devolve um erro, ou null.</summary>
        public static string Comecar(Encontro.GrupoDoSave.Save s)
        {
            try
            {
                var de = Encontro.GrupoDoSave.JogoDoSave(s.Slot);
                if (de == null) return T("Não consegui ler a partida gravada.", "Could not read the saved game.");
                var salvar = SingletonBehaviour<SaveLoadController>.Instance;
                // (v267: sem limite de ranhuras; o jogo tem a constante MAX_SAVE_SLOT = 10, mas nao a usa, e a Nova campanha dele
                //  grava na primeira ranhura livre, como aqui. Com as partidas das campanhas da comunidade, dez se passa logo.)
                var campanhaId = Act.ActI.AsCampaignId();
                var nova = new SerializedGame(campanhaId);
                nova.Initialize();
                var campanha = UserCollectionManager.GetCampaign(campanhaId, true);
                if (campanha?.StartingQuest == null) return T("O jogo não deu a campanha do Ato I.", "The game did not give the Act I campaign.");
                nova.ActiveDestinationIds.Add(campanha.StartingQuest.Id);
                int ciclo = 1; if (!string.IsNullOrEmpty(de.SaveSlotGUID) && Marcas.TryGetValue(de.SaveSlotGUID, out var antiga)) ciclo = antiga.Ciclo + 1;
                // (v268: um nome que já termina em "+" ou "+N" ganha o número seguinte, sem dobrar: "Equipe +" → "Equipe +2")
                var baseDoNome = string.IsNullOrEmpty(de.PartyName) ? "Bigorna" : de.PartyName.Trim();
                var fimDoNome = System.Text.RegularExpressions.Regex.Match(baseDoNome, @"^(.*?)\s*\+(\d*)$");
                if (fimDoNome.Success && fimDoNome.Groups[1].Value.Length > 0)
                {
                    baseDoNome = fimDoNome.Groups[1].Value;
                    int jaEra = fimDoNome.Groups[2].Value.Length > 0 && int.TryParse(fimDoNome.Groups[2].Value, out var nn) ? nn : 1;
                    ciclo = Math.Max(ciclo, jaEra + 1);
                }
                nova.PartyName = baseDoNome + " +" + (ciclo > 1 ? ciclo.ToString() : "");

                // o grupo: o que a campanha nova da (as virtudes, as pecas iniciais dos herois que o save nao tem) e o do save
                var virtudes = nova.AllPlayers.Where(p => p != null).ToDictionary(p => p.HeroId, p => new[] { p.VirtueOneValue, p.VirtueTwoValue });
                var iniciais = (nova.ItemInventory ?? new List<SerializedItem>()).ToList();
                var noSave = new HashSet<string>((de.AllPlayers ?? new SerializedPlayer[0]).Where(p => p != null).Select(p => p.HeroId));
                // (v268: as armas e o apetrecho com que cada herói começa a campanha nova, para quem trouxer peças de fora da coleção)
                var armasIniciais = nova.AllPlayers.Where(p => p != null).ToDictionary(p => p.HeroId, p => JsonUtility.ToJson(new ArmasIniciais { E = p.EquippedWeapons, D = p.DefaultWeaponsBuild, T = p.EquippedTrinketId, I = p.EquippedWeaponIndex }));
                Encontro.GrupoDoSave.CopiarParaNovoJogo(de, nova);
                ForaDaColecao(nova, armasIniciais);
                foreach (var p in nova.AllPlayers.Where(p => p != null))
                {
                    if (virtudes.TryGetValue(p.HeroId, out var v)) { p.VirtueOneValue = v[0]; p.VirtueTwoValue = v[1]; }
                    p.HealthState = HeroHealth.Normal;
                    if (noSave.Contains(p.HeroId)) continue;
                    // (um heroi que o save nao tinha fica com as suas pecas iniciais, que a copia do inventario levou)
                    foreach (var id in Equipados(p)) { var it = iniciais.FirstOrDefault(x => x != null && x.Id == id); if (it != null && !nova.ItemInventory.Any(x => x != null && x.Id == id)) nova.ItemInventory.Add(it); }
                }
                // o que pode ser sorteado ou vendido: o do XP do grupo, so do Ato I (o resto entra com o Ato II)
                // (v267: a mesma conta de SerializedGame.AddAllAvailableItemsBasedOnXP, com o XP desta partida: a do jogo le o XP da
                //  partida em jogo, que na tela de titulo nao existe, e parava com NullReferenceException; o sorteio ficava vazio)
                try
                {
                    int disponiveis = 0;
                    foreach (var m in UserCollectionManager.GetAllItemModels(true))
                    {
                        if (m == null || m.XPRequiredForDrop > nova.PartyXP) continue;
                        if (m is RecipeModel) { if (!nova.AvailableRecipeIds.Contains(m.Id) && nova.GetDiscoveredRecipe(m.Id) == null) { nova.AvailableRecipeIds.Add(m.Id); disponiveis++; } }
                        else if (!(m is ConsumableModel) && !nova.AvailableItemIds.Contains(m.Id) && nova.GetDiscoveredItem(m.Id) == null) { nova.AvailableItemIds.Add(m.Id); disponiveis++; }
                    }
                    Log.Info("Novo jogo +: " + disponiveis + " item(ns) e receita(s) entram no sorteio pelo XP " + nova.PartyXP);
                }
                catch (Exception ex) { Log.Info("Novo jogo +: itens pelo XP " + ex.Message); }
                ForaDeAtosPosteriores(nova);

                var marca = new Marca { Origem = de.PartyName, Xp = nova.PartyXP, Itens = nova.ItemInventory.Where(x => x != null).Select(x => x.Id).Distinct().ToList(), Ciclo = ciclo };
                Marcas[nova.SaveSlotGUID] = marca; Gravar();
                SingletonBehaviour<GameData>.Instance.CurrentSaveIndex = salvar.GetFirstFreeIndex();
                Log.Info("Novo jogo +: «" + nova.PartyName + "» (ranhura " + SingletonBehaviour<GameData>.Instance.CurrentSaveIndex + ", ciclo " + ciclo + ") com o grupo do save " + s.Slot + ": " + nova.Gold + " de ouro, " + nova.PartyXP + " de XP, "
                    + nova.ItemInventory.Count + " itens, " + (nova.DiscoveredRecipes?.Count ?? 0) + " receitas, " + (nova.UnlockedSkills?.Count ?? 0) + " perícias, " + (nova.RealCompletedFeats?.Count ?? 0) + " proezas concluídas");
                var ui = SingletonBehaviour<UIGame>.Instance;
                ui.DifficultySelectDialog.StageGameData(nova);
                ui.OnDifficultySelectButtonClicked(false, null);
                return null;
            }
            catch (Exception ex) { Log.Erro("Novo jogo +", ex); return T("Não consegui montar o Novo jogo +: ", "Could not set up the New Game +: ") + ex.Message; }
        }

        static IEnumerable<string> Equipados(SerializedPlayer p)
        {
            foreach (var w in (p.EquippedWeapons ?? new List<SerializedWeapon>()).Where(w => w != null))
                foreach (var id in new[] { w.PartAId, w.PartBId, w.PartCId }) if (!string.IsNullOrEmpty(id)) yield return id;
            if (!string.IsNullOrEmpty(p.EquippedTrinketId)) yield return p.EquippedTrinketId;
        }

        /// <summary>v268: o que o save tem e a coleção do jogo não (uma partida de outro computador, de uma caixa desmarcada na
        /// Coleção, ou editada): fica de fora da partida nova. Uma proeza de fora travava a fase das trevas (o FeatsController do
        /// jogo quebrava a cada interação: «FeatModel ... is not owned», relato de 04/11/2026); um herói com arma ou apetrecho de
        /// fora volta às peças com que a campanha nova o faz começar.</summary>
        [Serializable] class ArmasIniciais { public List<SerializedWeapon> E, D; public string T; public int I; }
        static void ForaDaColecao(SerializedGame g, Dictionary<string, string> iniciais)
        {
            bool Fora<TM>(Func<string, bool, TM> pegar, string id) where TM : class
            {
                if (string.IsNullOrEmpty(id)) return false;
                try { return pegar(id, false) != null && pegar(id, true) == null; } catch { return false; }
            }
            int n = 0;
            int Tirar<TX>(List<TX> l, Func<TX, bool> fora) { if (l == null) return 0; int k = l.RemoveAll(x => x != null && fora(x)); n += k; return k; }
            Tirar(g.RealCompletedFeats, id => Fora(UserCollectionManager.GetFeat, id));
            Tirar(g.PendingNewFeatIds, id => Fora(UserCollectionManager.GetFeat, id));
            Tirar(g.FeatProgresses, x => Fora(UserCollectionManager.GetFeat, x.RealFeatId));
            Tirar(g.UnlockedSkills, id => Fora(UserCollectionManager.GetSkill, id));
            Tirar(g.UnlockedLegends, id => Fora(UserCollectionManager.GetLegend, id));
            Tirar(g.UnlockedCompanions, id => Fora(UserCollectionManager.GetCompanion, id));
            Tirar(g.ItemInventory, x => Fora(UserCollectionManager.GetItem, x.Id));
            Tirar(g.DiscoveredRecipes, x => Fora(UserCollectionManager.GetRecipe, x.Id));
            Tirar(g.CraftingMaterials, x => Fora(UserCollectionManager.GetCraftingMaterial, x.Id));
            Tirar(g.SharedWeaponIds, id => Fora(UserCollectionManager.GetWeapon, id));
            foreach (var p in g.AllPlayers.Where(p => p != null))
            {
                bool armaFora = (p.EquippedWeapons ?? new List<SerializedWeapon>()).Concat(p.DefaultWeaponsBuild ?? new List<SerializedWeapon>())
                    .Any(w => w != null && (Fora(UserCollectionManager.GetWeapon, w.Id) || Fora(UserCollectionManager.GetWeaponPart, w.PartAId) || Fora(UserCollectionManager.GetWeaponPart, w.PartBId) || Fora(UserCollectionManager.GetWeaponPart, w.PartCId)))
                    || Fora(UserCollectionManager.GetTrinket, p.EquippedTrinketId);
                if (!armaFora || !iniciais.TryGetValue(p.HeroId, out var json)) continue;
                try
                {
                    var antes = JsonUtility.FromJson<ArmasIniciais>(json);
                    p.EquippedWeapons = antes.E; p.DefaultWeaponsBuild = antes.D; p.EquippedTrinketId = antes.T; p.EquippedWeaponIndex = antes.I;
                    n++; Log.Info("Novo jogo +: " + p.HeroId + " tinha arma ou apetrecho de fora da coleção; volta às peças iniciais");
                }
                catch (Exception ex) { Log.Info("Novo jogo +: armas de " + p.HeroId + ": " + ex.Message); }
            }
            if (n > 0) Log.Info("Novo jogo +: " + n + " coisa(s) de fora da coleção do jogo ficaram de fora (proezas, perícias, itens, receitas, armas)");
        }

        static void ForaDeAtosPosteriores(SerializedGame d)
        {
            var ato = d.CurrentAct;
            int i = d.AvailableItemIds?.RemoveAll(id => { var m = UserCollectionManager.GetItem(id, true); return m != null && m.Act > ato; }) ?? 0;
            int r = d.AvailableRecipeIds?.RemoveAll(id => { var m = UserCollectionManager.GetRecipe(id, true); return m != null && m.Act > ato; }) ?? 0;
            if (i + r > 0) Log.Info("Novo jogo +: " + i + " item(ns) e " + r + " receita(s) de um ato posterior fora do sorteio e da loja");
        }

        // ------------------------------------------------------------ a vigia
        static float _proxima;
        static string _guid;
        static Act _ato;
        static HashSet<string> _itensAntes;

        /// <summary>A cada meio segundo, na partida marcada: o estado acertado (ver o resumo da classe).</summary>
        public static void Batimento()
        {
            if (Time.unscaledTime < _proxima) return; _proxima = Time.unscaledTime + 0.5f;
            var d = Jogo.Partida; if (d == null) return;
            Marca m; try { m = Atual; } catch { return; }
            if (m == null) { _guid = null; return; }
            if (_guid != d.SaveSlotGUID) { _guid = d.SaveSlotGUID; _ato = d.CurrentAct; _itensAntes = null; Log.Info("Novo jogo +: partida «" + d.PartyName + "» em jogo (ciclo " + m.Ciclo + ", XP de piso " + m.Xp + ")"); }
            try { Acertar(d, m); } catch (Exception ex) { Log.Erro("Novo jogo +: vigia", ex); _proxima = Time.unscaledTime + 10f; }
        }

        static void Acertar(SerializedGame d, Marca m)
        {
            bool mudou = false;
            // o XP: nunca abaixo do que o grupo trouxe
            if (d.PartyXP < m.Xp) { Log.Info("Novo jogo +: XP " + d.PartyXP + " → " + m.Xp + " (o que o grupo trouxe)"); d.PartyXP = m.Xp; mudou = true; }
            // receitas repetidas: fica uma (a ja fabricada vale)
            if (d.DiscoveredRecipes != null)
                foreach (var gr in d.DiscoveredRecipes.Where(x => x != null).GroupBy(x => x.Id).Where(g => g.Count() > 1).ToList())
                {
                    var fica = gr.FirstOrDefault(x => x.Crafted) ?? gr.First();
                    foreach (var x in gr) if (!ReferenceEquals(x, fica)) d.DiscoveredRecipes.Remove(x);
                    Log.Info("Novo jogo +: receita " + gr.Key + " repetida (" + gr.Count() + "): fica uma" + (fica.Crafted ? ", já fabricada" : "")); mudou = true;
                }
            // proezas concluidas oferecidas de novo ou em andamento
            if (d.RealCompletedFeats != null && d.RealCompletedFeats.Count > 0)
            {
                int a = d.PendingNewFeatIds?.RemoveAll(id => d.RealCompletedFeats.Contains(id)) ?? 0;
                int b = d.FeatProgresses?.RemoveAll(fp => fp != null && d.RealCompletedFeats.Contains(fp.RealFeatId)) ?? 0;
                if (a + b > 0) { Log.Info("Novo jogo +: " + (a + b) + " proeza(s) já concluída(s) fora das oferecidas e das em andamento"); mudou = true; }
            }
            // itens: o basico dado de novo com a versao melhorada no grupo, a copia a mais de um unico, o equipado tirado
            if (d.ItemInventory != null)
            {
                var agora = d.ItemInventory.Where(x => x != null).ToList();
                var ids = new HashSet<string>(agora.Select(x => x.Id));
                if (_itensAntes != null)
                {
                    foreach (var novo in agora.Where(x => !_itensAntes.Contains(x.Id)).ToList())
                    {
                        if (agora.Any(x => x.Model != null && x.Model.IsUpgrade && x.Model.BaseItemId == novo.Id))
                        { d.ItemInventory.Remove(novo); Log.Info("Novo jogo +: " + novo.Id + " dado de novo, e o grupo já tem a versão melhorada: sai"); mudou = true; }
                    }
                    foreach (var gr in d.ItemInventory.Where(x => x != null && Unico(x.Model)).GroupBy(x => x.Id).Where(g => g.Count() > 1).ToList())
                    { foreach (var x in gr.Skip(1).ToList()) d.ItemInventory.Remove(x); Log.Info("Novo jogo +: " + gr.Key + " (único) repetido: fica um"); mudou = true; }
                }
                foreach (var p in (d.AllPlayers ?? new SerializedPlayer[0]).Where(p => p != null))
                    foreach (var id in Equipados(p))
                        if (m.Itens.Contains(id) && !d.ItemInventory.Any(x => x != null && x.Id == id))
                        {
                            var modelo = UserCollectionManager.GetItem(id, true); if (modelo == null) continue;
                            d.ItemInventory.Add(new SerializedItem(modelo)); Log.Info("Novo jogo +: " + id + " (do grupo, equipado em " + p.HeroId + ") saiu do inventário: volta"); mudou = true;
                        }
                _itensAntes = new HashSet<string>(d.ItemInventory.Where(x => x != null).Select(x => x.Id));
            }
            // o sorteio e a loja: so o que e do ato
            int antes = (d.AvailableItemIds?.Count ?? 0) + (d.AvailableRecipeIds?.Count ?? 0);
            ForaDeAtosPosteriores(d);
            if ((d.AvailableItemIds?.Count ?? 0) + (d.AvailableRecipeIds?.Count ?? 0) != antes) mudou = true;
            // a passagem ao Ato II: o grupo guardado; na primeira missao do Ato II, o "grupo pronto" do jogo nao fica
            if (d.CurrentAct != _ato)
            {
                if (d.CurrentAct == Act.ActII && m.GrupoNoAto2 == null) { m.GrupoNoAto2 = JsonUtility.ToJson(d); Gravar(); Log.Info("Novo jogo +: passagem ao Ato II, o grupo guardado"); }
                _ato = d.CurrentAct;
            }
            if (d.CurrentAct == Act.ActII && d.QuestId == "ACT2_QUEST_1" && m.GrupoNoAto2 != null && !m.RestauradoNoAto2)
            {
                var guardado = JsonUtility.FromJson<SerializedGame>(m.GrupoNoAto2);
                if (guardado != null && GrupoPronto(guardado, d))
                {
                    Encontro.GrupoDoSave.CopiarParaNovoJogo(guardado, d); m.RestauradoNoAto2 = true; Gravar(); mudou = true;
                    Log.Info("Novo jogo +: o jogo aplicou o grupo pronto do Ato II: o grupo guardado na passagem voltou");
                }
            }
            // os monstros: a progressao da campanha com o acrescimo, cada vez que a historia a muda
            try
            {
                var bb = GameData.GlobalBB;
                if (bb != null)
                {
                    int p = bb.GetValue<int>("CampaignProgression");
                    // (a historia define a progressao a cada missao, ou soma a ela: abaixo do que o mod escreveu, a historia a
                    // definiu, e recebe o acrescimo; acima, a historia somou ao valor ja acrescido, e fica)
                    if (m.Progressao == null || p < m.Progressao.Value) { int alvo = p + AcrescimoDeProgressao; bb.SetValue("CampaignProgression", alvo); m.Progressao = alvo; Gravar(); Log.Info("Novo jogo +: progressão da campanha " + p + " → " + alvo); }
                    else if (p > m.Progressao.Value) { Log.Info("Novo jogo +: progressão da campanha " + m.Progressao + " → " + p + " (a história somou)"); m.Progressao = p; Gravar(); }
                }
            }
            catch (Exception ex) { Log.Info("Novo jogo +: progressão " + ex.Message); }
            if (mudou) try { Jogo.DadosJogo?.SetDirty(); } catch { }
        }

        static bool Unico(ItemModel m) => (m is WeaponPartsModel w && w.IsUnique) || (m is ConsumableModel c && c.IsUnique);

        /// <summary>O jogo trocou o grupo pelo "grupo pronto" do Ato II: a maior parte das armas equipadas e dos itens que o grupo
        /// tinha na passagem sumiu.</summary>
        static bool GrupoPronto(SerializedGame guardado, SerializedGame d)
        {
            var antes = new HashSet<string>((guardado.ItemInventory ?? new List<SerializedItem>()).Where(x => x != null).Select(x => x.Id));
            if (antes.Count == 0) return false;
            int ficaram = (d.ItemInventory ?? new List<SerializedItem>()).Count(x => x != null && antes.Contains(x.Id));
            return ficaram * 2 < antes.Count;
        }
    }
}
