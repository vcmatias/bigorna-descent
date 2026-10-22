using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using FFG.Core;
using FFG.D3;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Encontro
{
    /// <summary>
    /// "Continuar herois": o grupo de uma partida gravada do jogo (um save) entra num mapa avulso ou numa campanha do Bigorna
    /// como esta: herois (armas montadas, apetrecho, virtudes), itens, ouro, XP, materiais, receitas, armas compartilhadas,
    /// pericias, lendas e companheiros liberados, proezas (em andamento e concluidas) e as fraquezas dos monstros ja
    /// descobertas. O inventario inicial que o autor definiu fica de fora (ele vem com "Grupo novo").
    /// O save escolhido nao muda ao comecar. No fim do mapa (ou da campanha), a mesa escolhe: levar o grupo de volta ao save,
    /// criar um save novo com ele, ou descartar.
    /// </summary>
    public static class GrupoDoSave
    {
        /// <summary>Uma partida gravada do jogo, para a lista de escolha.</summary>
        public class Save
        {
            public int Slot; public string Nome; public string Guid; public Act Ato; public DateTime Quando; public bool NoMeioDeMissao;
            /// <summary>A campanha da comunidade de onde e a partida (null: campanha do jogo).</summary>
            public string Campanha;
            /// <summary>O carimbo de tempo da gravacao de onde o grupo saiu (0: desconhecido).</summary>
            public long Carimbo;
            public string Rotulo => (string.IsNullOrEmpty(Nome) ? T("(sem nome)", "(no name)") : Nome);
            public string Detalhe => T("Ato ", "Act ") + (Ato == Act.ActII ? "II" : Ato == Act.ActIII ? "III" : "I") + " · " + T("ranhura ", "slot ") + Slot
                + (Quando == DateTime.MinValue ? "" : " · " + DataHora(Quando)) + (NoMeioDeMissao ? T(" · no meio de uma missão", " · in the middle of a quest") : "")
                + (Campanha != null ? T(" · campanha da comunidade «", " · community campaign “") + Campanha + T("»", "”") : "");
        }

        /// <summary>De onde veio o grupo em jogo agora (null: grupo novo).</summary>
        public static Save Origem { get; private set; }

        /// <summary>O grupo no fim do mapa (o jogo em JSON), esperando a escolha da mesa.</summary>
        static string _fim;
        static Save _fimOrigem;
        static string _fimNome;
        static string _aviso;
        public static bool Pendente => _fim != null;

        /// <summary>O texto que explica a diferenca entre os dois botoes (a ficha e a lista de saves mostram).</summary>
        public static string TextoDosBotoes => T("«Grupo novo» começa com o inventário inicial definido pelo criador. «Usar meus heróis» traz o grupo de uma partida gravada como ele está (heróis, armas, itens, ouro, XP, materiais, receitas, perícias, proezas e as fraquezas já descobertas dos monstros), sem o inventário inicial do criador; a partida gravada escolhida não muda, e no fim vocês escolhem se o grupo volta para ela, vira uma partida gravada nova ou é descartado.",
            "“New party” starts with the starting inventory set by the creator. “Use my heroes” brings the party of a saved game as it is (heroes, weapons, items, gold, XP, materials, recipes, skills, feats and the monster weaknesses already discovered), without the creator's starting inventory; the chosen save does not change, and at the end you choose whether the party goes back to it, becomes a new save or is discarded.");

        public static string TextoCurto => T("«Grupo novo» traz o inventário inicial definido pelo criador. «Usar meus heróis» traz o grupo de uma partida gravada como ele está, sem esse inventário.",
            "“New party” brings the starting inventory set by the creator. “Use my heroes” brings the party of a saved game as it is, without that inventory.");

        static SaveLoadController Salvar => SingletonBehaviour<SaveLoadController>.IsInitialized ? SingletonBehaviour<SaveLoadController>.Instance : null;

        /// <summary>As partidas gravadas, a mais recente primeiro (fora a ranhura de rascunho dos mapas avulsos do Bigorna).</summary>
        public static List<Save> Saves()
        {
            var r = new List<Save>(); if (Salvar == null) return r;
            foreach (var kv in Bigorna.Campanha.SavesDaComunidade.Infos())
            {
                var i = kv.Value; if (i == null || kv.Key < 1) continue;
                if (kv.Key == 0 && i.PartyName == "Bigorna") continue;   // (o rascunho que os mapas avulsos usam: refeito a cada mapa)
                DateTime quando = DateTime.MinValue; try { if (i.Timestamp > 0) quando = new DateTime(i.Timestamp); } catch { }
                r.Add(new Save { Slot = kv.Key, Nome = i.PartyName, Guid = i.SlotGUID, Ato = i.Act, Quando = quando, Campanha = Bigorna.Campanha.SavesDaComunidade.CampanhaDe(i) });
            }
            return r.OrderByDescending(x => x.Quando).ToList();
        }

        /// <summary>O jogo gravado mais recente de uma ranhura (a partida inteira).</summary>
        static SerializedSaveData Ler(int slot)
        {
            var s = Salvar; if (s == null) return null;
            try { return s.GetMostRecentSaveData(slot); } catch (Exception ex) { Log.Erro("lendo o save " + slot, ex); return null; }
        }

        /// <summary>Uma partida nova (de mapa ou de campanha) recebe o grupo do save. Devolve um erro, ou null.</summary>
        public static string Trazer(SerializedGame partida, Save save)
        {
            Origem = null;
            if (save == null) return null;
            var dados = Ler(save.Slot); var g = dados?.GameSceneData?.GameState;
            if (g == null) return T("Não consegui ler a partida gravada «", "Could not read the saved game “") + save.Rotulo + T("».", "”.");
            Copiar(g, partida, true);
            Origem = save; Origem.Guid = dados.SlotGUID ?? save.Guid; Origem.Carimbo = dados.Timestamp;
            Log.Info("grupo do save " + save.Slot + " («" + save.Nome + "»): " + partida.Gold + " de ouro, " + (partida.ItemInventory?.Count ?? 0) + " itens, " + (partida.UnlockedSkills?.Count ?? 0) + " perícias, "
                + (partida.RealCompletedFeats?.Count ?? 0) + " proezas concluídas, " + (partida.DiscoveredEnemyVulnerabilities?.Count ?? 0) + " fraquezas descobertas");
            return null;
        }

        /// <summary>Uma campanha reaberta pelo menu do jogo: o grupo dela veio deste save (nada e copiado de novo).</summary>
        public static void Lembrar(Save s) { Origem = s; }

        /// <summary>Grupo novo: nada vem de save nenhum.</summary>
        public static void SemOrigem() { Origem = null; }

        /// <summary>O que e do grupo passa de uma partida a outra; o resto (missao, mapa-mundi, cidade, historia) fica.
        /// As listas sao copiadas dentro das listas de destino (o controle de proezas do jogo guarda as dele).</summary>
        static void Copiar(SerializedGame de, SerializedGame para, bool novoMapa)
        {
            // (de volta a uma partida do jogo, o que so existe no mapa (itens, receitas, pericias, proezas e pecas da Oficina:
            // B_..., BIGORNA_...) fica de fora: o jogo, sem o mapa, nao o conheceria)
            bool Fica(string id) => novoMapa || !Proprio(id);
            para.Gold = de.Gold; para.PartyXP = de.PartyXP;
            para.FeatRerollsRemaining = de.FeatRerollsRemaining; para.TotalFeatsRerolled = de.TotalFeatsRerolled;
            Lista(de.CraftingMaterials, ref para.CraftingMaterials, x => x != null && Fica(x.Id));
            Lista(de.ItemInventory, ref para.ItemInventory, x => x != null && Fica(x.Id));
            Lista(de.DiscoveredRecipes, ref para.DiscoveredRecipes, x => x != null && Fica(x.Id));
            Lista(de.SharedWeaponIds, ref para.SharedWeaponIds, Fica);
            Lista(de.DiscoveredEnemyVulnerabilities, ref para.DiscoveredEnemyVulnerabilities, null);
            Lista(de.UnlockedSkills, ref para.UnlockedSkills, Fica);
            Lista(de.UnlockedLegends, ref para.UnlockedLegends, Fica);
            Lista(de.UnlockedCompanions, ref para.UnlockedCompanions, Fica);
            Lista(de.FeatProgresses, ref para.FeatProgresses, x => Fica(x.RealFeatId));
            Lista(de.RealCompletedFeats, ref para.RealCompletedFeats, Fica);
            Lista(de.PendingNewFeatIds, ref para.PendingNewFeatIds, Fica);
            if (de.AllPlayers == null || para.AllPlayers == null) return;
            foreach (var h in de.AllPlayers)
            {
                if (h == null || string.IsNullOrEmpty(h.HeroId)) continue;
                var alvo = para.AllPlayers.FirstOrDefault(x => x != null && x.HeroId == h.HeroId);
                if (alvo == null) continue;
                int indice = alvo.Index;
                // (armas ou apetrecho da Oficina num heroi que volta: ele fica com os que tinha na partida)
                var armas = alvo.EquippedWeapons; var padrao = alvo.DefaultWeaponsBuild; var apetrecho = alvo.EquippedTrinketId; int mao = alvo.EquippedWeaponIndex;
                bool proprias = !novoMapa && ((h.EquippedWeapons ?? new List<SerializedWeapon>()).Concat(h.DefaultWeaponsBuild ?? new List<SerializedWeapon>())
                    .Any(w => w != null && (Proprio(w.Id) || Proprio(w.PartAId) || Proprio(w.PartBId) || Proprio(w.PartCId))) || Proprio(h.EquippedTrinketId));
                try { JsonUtility.FromJsonOverwrite(JsonUtility.ToJson(h), alvo); } catch (Exception ex) { Log.Info("  herói " + h.HeroId + ": " + ex.Message); continue; }
                alvo.Index = indice;
                if (proprias) { alvo.EquippedWeapons = armas; alvo.DefaultWeaponsBuild = padrao; alvo.EquippedTrinketId = apetrecho; alvo.EquippedWeaponIndex = mao; Log.Info("  " + h.HeroId + ": armas da Oficina ficam no mapa"); }
                if (novoMapa) alvo.HealthState = HeroHealth.Normal;   // (um mapa novo comeca com todos inteiros, como uma missao do jogo)
            }
        }

        /// <summary>Um id do que o mapa criou (Oficina): itens, receitas, proezas B_..., pericias e runas BIGORNA_...</summary>
        static bool Proprio(string id) => !string.IsNullOrEmpty(id) && (id.StartsWith("B_", StringComparison.Ordinal) || id.StartsWith("BIGORNA_", StringComparison.Ordinal));

        static void Lista<T>(List<T> de, ref List<T> para, Func<T, bool> fica)
        {
            if (para == null) para = new List<T>();
            para.Clear();
            if (de != null) para.AddRange(fica == null ? de : de.Where(fica));
        }

        // ------------------------------------------------------------ o fim
        /// <summary>O mapa (ou a campanha) terminou: o grupo como esta agora espera a escolha da mesa.</summary>
        public static void AoTerminar(string nome)
        {
            if (Origem == null) return;
            try
            {
                var d = Jogo.DadosJogo?.Data; if (d == null) return;
                _fim = JsonUtility.ToJson(d); _fimOrigem = Origem; _fimNome = nome; _aviso = null;
                _situacao = Verificar(_fimOrigem);
                Log.Info("partida de origem «" + _fimOrigem.Nome + "»: " + (_situacao == Situacao.Igual ? "como estava" : _situacao == Situacao.Mudou ? "mudou durante a aventura" : "não está mais lá"));
                Log.Info("fim de «" + nome + "» com o grupo do save " + Origem.Slot + ": a mesa escolhe o destino do grupo");
            }
            catch (Exception ex) { Log.Erro("guardando o grupo no fim", ex); }
            Origem = null;
        }

        // ------------------------------------------------------------ a partida de origem, no fim
        enum Situacao { Igual, Mudou, Sumiu }
        static Situacao _situacao;
        static DateTime _mudouEm;

        /// <summary>A partida de onde o grupo saiu, agora: a mesma gravacao (o grupo pode voltar a ela), outra gravacao (ela foi
        /// jogada ou gravada de novo durante a aventura) ou nenhuma (apagada, ou a ranhura guarda outra partida). Se a partida
        /// mudou de ranhura, a ranhura nova passa a valer.</summary>
        static Situacao Verificar(Save o)
        {
            _mudouEm = DateTime.MinValue;
            var dados = Ler(o.Slot);
            if (dados == null || (!string.IsNullOrEmpty(o.Guid) && dados.SlotGUID != o.Guid))
            {
                dados = null;
                if (!string.IsNullOrEmpty(o.Guid)) foreach (var kv in Bigorna.Campanha.SavesDaComunidade.Infos()) if (kv.Value?.SlotGUID == o.Guid) { o.Slot = kv.Key; dados = Ler(kv.Key); break; }
                if (dados == null) return Situacao.Sumiu;
                Log.Info("a partida de origem «" + o.Nome + "» está agora na ranhura " + o.Slot);
            }
            if (o.Carimbo != 0 && dados.Timestamp == o.Carimbo) return Situacao.Igual;
            try { if (dados.Timestamp > 0) _mudouEm = new DateTime(dados.Timestamp); } catch { }
            return Situacao.Mudou;
        }

        static string LevarAoSave()
        {
            var o = _fimOrigem;
            if (Verificar(o) != Situacao.Igual) { _situacao = Verificar(o); return T("A partida oficial mudou agora há pouco: o grupo não foi levado.", "The official game changed just now: the party was not taken there."); }
            var dados = Ler(o.Slot); var g = dados?.GameSceneData?.GameState;
            if (g == null) return T("A partida gravada «", "The saved game “") + o.Rotulo + T("» não está mais lá.", "” is no longer there.");
            var fim = JsonUtility.FromJson<SerializedGame>(_fim);
            Copiar(fim, g, false);
            Gravar(dados, o.Slot);
            return null;
        }

        static string NovoSave()
        {
            var o = _fimOrigem;
            if (Verificar(o) == Situacao.Sumiu) { _situacao = Situacao.Sumiu; return T("A partida gravada «", "The saved game “") + o.Rotulo + T("» não está mais lá.", "” is no longer there."); }
            var dados = Ler(o.Slot); var g = dados?.GameSceneData?.GameState;
            if (g == null) return T("A partida gravada «", "The saved game “") + o.Rotulo + T("» não está mais lá.", "” is no longer there.");
            var fim = JsonUtility.FromJson<SerializedGame>(_fim);
            Copiar(fim, g, false);
            int slot; try { slot = Salvar.GetFirstFreeIndex(); } catch (Exception ex) { return ex.Message; }
            var guid = System.Guid.NewGuid().ToString("N");
            dados.SlotGUID = guid; g.SaveSlotGUID = guid;
            dados.PartyName = g.PartyName = (o.Nome ?? "") + " · " + (_fimNome ?? "Bigorna");
            Gravar(dados, slot);
            return null;
        }

        /// <summary>Um arquivo novo na ranhura, como o jogo grava (o mais recente vale; os antigos ficam como historico).</summary>
        static void Gravar(SerializedSaveData dados, int slot)
        {
            var agora = DateTime.Now;
            dados.Timestamp = agora.Ticks;
            var g = dados.GameSceneData?.GameState;
            if (g != null) { dados.AllPlayers = g.AllPlayers; dados.ProductIDs = g.OwnedProductIDs ?? dados.ProductIDs; }
            var caminho = Path.Combine(SaveLoadController.GetSaveDirectory(slot), agora.ToString("yyyy-MM-dd_HH-mm-ss") + ".sav");
            IOUtility.WriteJsonToFile(dados, caminho, true, false);
            Log.Info("grupo gravado na ranhura " + slot + ": " + caminho);
        }

        // ------------------------------------------------------------ a janela da escolha (no menu, ou no mapa-mundi ao fim de uma campanha)
        static GUIStyle _titulo, _texto, _botao, _janela;
        public static void Desenhar()
        {
            if (_fim == null) return;
            var cena = Jogo.CenaAtual(); if (cena == Scene.Game || (Jogo.Carregador != null && Jogo.Carregador.IsLoading)) return;
            if (_botao == null)
            {
                _botao = new GUIStyle(GUI.skin.button) { fontSize = 16, padding = new RectOffset(12, 12, 8, 8), wordWrap = true };
                _titulo = new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Bold, wordWrap = true };
                _texto = new GUIStyle(GUI.skin.label) { fontSize = 15, wordWrap = true };
                _janela = new GUIStyle(GUI.skin.window);
            }
            float w = Mathf.Min(760f, Screen.width - 40f), h = _situacao == Situacao.Igual ? 330f : 380f;
            var r = new Rect((Screen.width - w) / 2f, (Screen.height - h) / 2f, w, h);
            GUI.Box(r, GUIContent.none, _janela); GUI.Box(r, GUIContent.none, _janela);   // (duas vezes: mais opaca)
            GUILayout.BeginArea(new Rect(r.x + 18f, r.y + 14f, r.width - 36f, r.height - 28f));
            GUILayout.Label(T("O que fazer com o grupo?", "What to do with the party?"), _titulo);
            GUILayout.Label(T("«", "“") + (_fimNome ?? "") + T("» terminou. O grupo veio da partida gravada «", "” is over. The party came from the saved game “") + _fimOrigem.Rotulo + T("» (", "” (") + _fimOrigem.Detalhe + ").", _texto);
            // (a partida de origem mudou durante a aventura: o butim fica fora dela, e a copia leva a partida como esta agora)
            if (_situacao == Situacao.Mudou)
                GUILayout.Label(T("A partida «", "The game “") + _fimOrigem.Rotulo + T("» mudou depois que o grupo saiu dela", "” changed after the party left it") + (_mudouEm == DateTime.MinValue ? "" : T(" (gravada em ", " (saved on ") + DataHora(_mudouEm) + ")")
                    + T(". O butim desta aventura fica fora dela: o grupo voltaria por cima do que aconteceu lá nesse meio-tempo, e isso se perderia. Vocês podem gravar uma cópia da partida, como ela está agora, com o grupo desta aventura; a original fica como está.",
                        ". This adventure's loot stays out of it: the party would go back over what happened there in the meantime, and that would be lost. You can create a copy of that game, as it is now, with this adventure's party; the original stays as it is."), _texto);
            else if (_situacao == Situacao.Sumiu)
                GUILayout.Label(T("A partida «", "The game “") + _fimOrigem.Rotulo + T("» foi apagada (ou a ranhura dela guarda outra partida). O grupo desta aventura só pode ser descartado.", "” was deleted (or its slot holds another game). This adventure's party can only be discarded."), _texto);
            if (_aviso != null) GUILayout.Label(_aviso, _texto);
            GUILayout.Space(8f);
            string erro = null; bool feito = false;
            if (_situacao == Situacao.Igual && GUILayout.Button(T("Levar o grupo de volta à partida gravada «", "Take the party back to the save “") + _fimOrigem.Rotulo + T("»", "”"), _botao, GUILayout.Height(44f)))
            { try { erro = LevarAoSave(); } catch (Exception ex) { Log.Erro("levando o grupo ao save", ex); erro = ex.Message; } feito = erro == null; }
            if (_situacao != Situacao.Sumiu && GUILayout.Button(_situacao == Situacao.Mudou ? T("Gravar uma cópia da partida «", "Create a copy of the game “") + _fimOrigem.Rotulo + T("» com o grupo desta aventura (a original fica como está)", "” with this adventure's party (the original stays as it is)") : T("Gravar o grupo numa partida nova", "Create a new save with the party"), _botao, GUILayout.Height(_situacao == Situacao.Mudou ? 60f : 44f)))
            { try { erro = NovoSave(); } catch (Exception ex) { Log.Erro("criando o save novo", ex); erro = ex.Message; } feito = erro == null; }
            if (GUILayout.Button(T("Descartar (a partida gravada fica como estava)", "Discard (the save stays as it was)"), _botao, GUILayout.Height(44f)))
            { Log.Info("grupo do fim descartado"); feito = true; }
            GUILayout.EndArea();
            if (erro != null) _aviso = erro;
            if (feito) { _fim = null; _fimOrigem = null; _fimNome = null; _aviso = null; try { Menu.PainelMapas.Reler(); } catch { } }
        }
    }
}
