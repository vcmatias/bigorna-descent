using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using FFG.D3.Titlescene;
using Newtonsoft.Json;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Campanha
{
    /// <summary>
    /// As partidas gravadas das campanhas da comunidade. Uma campanha do Bigorna joga sobre o mapa-mundi do jogo e grava numa
    /// ranhura do jogo como uma campanha oficial; essas partidas saem da tela "Carregar campanha" do jogo (la ficam so os
    /// grupos das campanhas oficiais) e voltam pela ficha da propria campanha, em "Continuar campanha".
    /// Cada partida e reconhecida pelo identificador da ranhura (SlotGUID): as que o Bigorna comeca ou reabre ficam num
    /// registro (bigorna-saves.json, ao lado do registro do mod); as de antes do registro sao lidas uma vez: uma partida cujos
    /// destinos sao nos de uma campanha da pasta e dela; uma com destinos que o jogo nao conhece (de uma campanha que saiu da
    /// pasta) e da comunidade tambem. O rascunho dos mapas avulsos (ranhura 0, "Bigorna") sai da tela do jogo igualmente.
    /// </summary>
    public static class SavesDaComunidade
    {
        class Registro
        {
            /// <summary>Identificador da ranhura → id da campanha ("" quando a campanha nao esta mais na pasta).</summary>
            [JsonProperty("community")] public Dictionary<string, string> DaComunidade = new Dictionary<string, string>();
            /// <summary>Partidas ja lidas que sao de campanhas oficiais (nao sao lidas de novo).</summary>
            [JsonProperty("game")] public HashSet<string> DoJogo = new HashSet<string>();
        }

        static Registro _r;
        static string CaminhoRegistro => Path.Combine(Application.persistentDataPath, "bigorna-saves.json");
        static Registro R
        {
            get
            {
                if (_r != null) return _r;
                try { if (File.Exists(CaminhoRegistro)) _r = JsonConvert.DeserializeObject<Registro>(File.ReadAllText(CaminhoRegistro)); }
                catch (Exception ex) { Log.Info("registro das partidas da comunidade ilegível (" + ex.Message + "); começa vazio"); }
                _r = _r ?? new Registro();
                _r.DaComunidade = _r.DaComunidade ?? new Dictionary<string, string>();
                _r.DoJogo = _r.DoJogo ?? new HashSet<string>();
                return _r;
            }
        }
        static void Guardar() { try { File.WriteAllText(CaminhoRegistro, JsonConvert.SerializeObject(R, Formatting.Indented)); } catch (Exception ex) { Log.Info("registro das partidas da comunidade: " + ex.Message); } }

        static SaveLoadController Salvar => SingletonBehaviour<SaveLoadController>.IsInitialized ? SingletonBehaviour<SaveLoadController>.Instance : null;

        /// <summary>Uma partida de campanha da comunidade que comeca (ou que o jogo reabriu): fica no registro.</summary>
        public static void Registrar(string guid, Dcamp c)
        {
            if (string.IsNullOrEmpty(guid) || c == null) return;
            if (R.DaComunidade.TryGetValue(guid, out var ja) && ja == c.Id && !R.DoJogo.Contains(guid)) return;
            R.DoJogo.Remove(guid); R.DaComunidade[guid] = c.Id; Guardar();
            Log.Info("partida da campanha «" + c.NomeVisivel + "» registrada (" + guid + ")");
        }

        // ------------------------------------------------------------ as partidas gravadas
        /// <summary>A partida mais recente de cada ranhura (lida uma vez por arquivo: a leitura e do arquivo inteiro).</summary>
        static readonly Dictionary<string, SerializedSaveDataInfo> _infos = new Dictionary<string, SerializedSaveDataInfo>(StringComparer.OrdinalIgnoreCase);
        public static List<KeyValuePair<int, SerializedSaveDataInfo>> Infos()
        {
            var r = new List<KeyValuePair<int, SerializedSaveDataInfo>>(); var s = Salvar; if (s == null) return r;
            List<int> ranhuras; try { ranhuras = s.GetExistingIndexes(false); } catch (Exception ex) { Log.Info("ranhuras do jogo: " + ex.Message); return r; }
            foreach (var i in ranhuras)
            {
                try
                {
                    if (!SaveLoadController.GetMostRecentSaveFilePath(i, out var arq) || arq == null) continue;
                    if (!_infos.TryGetValue(arq, out var info)) { info = s.GetMostRecentSaveInfo(i); if (info == null) continue; _infos[arq] = info; }
                    r.Add(new KeyValuePair<int, SerializedSaveDataInfo>(i, info));
                }
                catch (Exception ex) { Log.Info("ranhura " + i + ": " + ex.Message); }
            }
            return r;
        }

        static bool Rascunho(int slot, SerializedSaveDataInfo i) => slot == 0 && i != null && i.PartyName == "Bigorna";

        /// <summary>Os nos de cada campanha da pasta (varias campanhas podem ter nos de mesmo id: "map-1").</summary>
        static List<KeyValuePair<Dcamp, HashSet<string>>> NosDasCampanhas()
            => Menu.PainelMapas.Campanhas.Select(c => new KeyValuePair<Dcamp, HashSet<string>>(c, new HashSet<string>(c.Nos.Where(n => !string.IsNullOrEmpty(n?.Id)).Select(n => n.Id), StringComparer.OrdinalIgnoreCase))).ToList();

        /// <summary>O jogo conhece o destino (missao ou evento do proprio jogo; os nossos ficam na colecao com o prefixo).</summary>
        static bool DoJogo(string id)
        {
            try
            {
                var q = UserCollectionManager.GetQuest(id, false); if (q != null) return !q.name.StartsWith("Bigorna_", StringComparison.Ordinal);
                var e = UserCollectionManager.GetNarrativeEvent(id, false); if (e != null) return !e.name.StartsWith("Bigorna_", StringComparison.Ordinal);
                return false;
            }
            catch { return true; }
        }

        static bool ColecaoPronta { get { try { var q = UserCollectionManager.GetQuests(false); return q != null && q.Count > 0; } catch { return false; } } }

        /// <summary>Uma partida de antes do registro: lida inteira, uma vez. Falso se nao deu para ler agora.</summary>
        static bool Classificar(int slot, SerializedSaveDataInfo info, List<KeyValuePair<Dcamp, HashSet<string>>> nos)
        {
            var guid = info?.SlotGUID; if (string.IsNullOrEmpty(guid) || !ColecaoPronta) return false;
            SerializedGame g = null;
            try { g = Salvar?.GetMostRecentSaveData(slot)?.GameSceneData?.GameState; } catch (Exception ex) { Log.Info("lendo a ranhura " + slot + ": " + ex.Message); }
            if (g == null) return false;
            var ids = (g.ActiveDestinationIds ?? new List<string>()).Concat(g.CompletedDestinationIds ?? new List<string>()).Where(x => !string.IsNullOrEmpty(x)).ToList();
            // (a campanha com mais nos entre os destinos da partida; empatadas, a de mesmo nome do grupo; senao, nenhuma em particular)
            string campanha = null;
            var notas = nos.Select(kv => new { c = kv.Key, n = ids.Count(kv.Value.Contains) }).Where(x => x.n > 0).OrderByDescending(x => x.n).ToList();
            if (notas.Count > 0)
            {
                var melhores = notas.Where(x => x.n == notas[0].n).ToList();
                var mesmoNome = melhores.Where(x => string.Equals(x.c.NomeVisivel, info.PartyName, StringComparison.OrdinalIgnoreCase)).ToList();
                campanha = melhores.Count == 1 ? melhores[0].c.Id : mesmoNome.Count == 1 ? mesmoNome[0].c.Id : "";
            }
            if (campanha == null && ids.Any(id => !DoJogo(id))) campanha = "";
            if (campanha != null) { R.DaComunidade[guid] = campanha; Log.Info("ranhura " + slot + " («" + info.PartyName + "»): partida de campanha da comunidade" + (campanha == "" ? " (que não está mais na pasta)" : " «" + campanha + "»")); }
            else R.DoJogo.Add(guid);
            return true;
        }

        static bool Conhecida(SerializedSaveDataInfo i) => i != null && !string.IsNullOrEmpty(i.SlotGUID) && (R.DaComunidade.ContainsKey(i.SlotGUID) || R.DoJogo.Contains(i.SlotGUID));

        /// <summary>Le as partidas que o registro ainda nao conhece (todas de uma vez: a tela do jogo abriu).</summary>
        public static void ClassificarTodas()
        {
            var nos = NosDasCampanhas(); bool mudou = false;
            foreach (var kv in Infos()) if (!Rascunho(kv.Key, kv.Value) && !Conhecida(kv.Value)) mudou |= Classificar(kv.Key, kv.Value, nos);
            if (mudou) Guardar();
        }

        /// <summary>Na tela de titulo: as partidas desconhecidas sao lidas aos poucos (uma por quadro), antes de alguem abrir a
        /// tela do jogo.</summary>
        public static IEnumerator AoEntrarNoTitulo()
        {
            for (int k = 0; k < 120 && !ColecaoPronta; k++) yield return null;
            var nos = NosDasCampanhas(); bool mudou = false;
            foreach (var kv in Infos())
            {
                if (Jogo.CenaAtual() != Scene.Titlescene) break;
                if (Rascunho(kv.Key, kv.Value) || Conhecida(kv.Value)) continue;
                mudou |= Classificar(kv.Key, kv.Value, nos);
                yield return null;
            }
            if (mudou) Guardar();
        }

        /// <summary>A partida e de uma campanha da comunidade (ou o rascunho dos mapas avulsos).</summary>
        public static bool DaComunidade(int slot, SerializedSaveDataInfo i) => Rascunho(slot, i) || (i != null && !string.IsNullOrEmpty(i.SlotGUID) && R.DaComunidade.ContainsKey(i.SlotGUID));

        /// <summary>O nome da campanha da comunidade de uma partida (null: e do jogo).</summary>
        public static string CampanhaDe(SerializedSaveDataInfo i)
        {
            if (i == null || string.IsNullOrEmpty(i.SlotGUID) || !R.DaComunidade.TryGetValue(i.SlotGUID, out var id)) return null;
            var c = Menu.PainelMapas.Campanhas.FirstOrDefault(x => x.Id == id);
            return c != null ? c.NomeVisivel : T("campanha que saiu da pasta", "campaign no longer in the folder");
        }

        /// <summary>A partida em andamento de uma campanha: a mais recente das ranhuras dela.</summary>
        public static KeyValuePair<int, SerializedSaveDataInfo>? EmAndamento(Dcamp c)
        {
            if (c == null) return null;
            KeyValuePair<int, SerializedSaveDataInfo>? r = null;
            foreach (var kv in Infos())
            {
                var g = kv.Value?.SlotGUID;
                if (string.IsNullOrEmpty(g) || !R.DaComunidade.TryGetValue(g, out var id) || id != c.Id) continue;
                if (r == null || kv.Value.Timestamp > r.Value.Value.Timestamp) r = kv;
            }
            return r;
        }

        /// <summary>"Continuar campanha": o jogo carrega a partida (a campanha reabre ao chegar no mapa-mundi). Devolve um erro.</summary>
        public static string Continuar(int slot, string nome)
        {
            var s = Salvar; if (s == null) return T("O jogo ainda não está pronto para carregar.", "The game is not ready to load yet.");
            if (!SaveLoadController.GetMostRecentSaveFilePath(slot, out var arq) || arq == null) return T("A partida gravada da campanha não está mais lá.", "The campaign's saved game is no longer there.");
            Log.Info("«Continuar campanha» «" + nome + "»: ranhura " + slot + " (" + Path.GetFileName(arq) + ")");
            try { s.LoadGame(arq, slot); } catch (Exception ex) { Log.Erro("carregando a partida da campanha", ex); return ex.Message; }
            return null;
        }

        // ------------------------------------------------------------ a tela "Carregar campanha" do jogo
        static HashSet<int> _ocultas;
        static bool _avisado;

        static TitlesceneController Cena => SingletonBehaviour<TitlesceneController>.IsInitialized ? SingletonBehaviour<TitlesceneController>.Instance : null;

        /// <summary>A cada quadro na tela de titulo: com a tela "Carregar campanha" do jogo aberta, as fichas das partidas da
        /// comunidade saem, e as que ficam sao numeradas de novo (1, 2, 3...).</summary>
        public static void Batimento()
        {
            if (Jogo.CenaAtual() != Scene.Titlescene) { _ocultas = null; return; }
            var lc = Cena?.CampaignLoad;
            if (lc == null || !lc.gameObject.activeInHierarchy || lc.GridSlots == null) { _ocultas = null; return; }
            if (_ocultas == null)
            {
                _ocultas = new HashSet<int>();
                try { ClassificarTodas(); foreach (var kv in Infos()) if (DaComunidade(kv.Key, kv.Value)) _ocultas.Add(kv.Key); }
                catch (Exception ex) { Log.Erro("partidas da comunidade na tela do jogo", ex); }
                if (_ocultas.Count > 0 && !_avisado) { _avisado = true; Log.Info("tela «Carregar campanha»: " + _ocultas.Count + " partida(s) de campanhas da comunidade fora da lista (" + string.Join(", ", _ocultas.Select(x => x.ToString()).ToArray()) + ")"); }
            }
            if (_ocultas.Count == 0) return;
            int visiveis = 0, carregando = 0;
            for (int k = 0; k < lc.GridSlots.childCount; k++)
            {
                var t = lc.GridSlots.GetChild(k); if (!t.gameObject.activeSelf) continue;
                var s = t.GetComponent<UISaveSlot>(); if (s == null) continue;
                if (s.SlotIndex < 0) { carregando++; visiveis++; continue; }
                if (_ocultas.Contains(s.SlotIndex)) { t.gameObject.SetActive(false); continue; }
                visiveis++;
                var n = visiveis.ToString(); if (s.LabelSlotIndex != null && s.LabelSlotIndex.text != n) s.LabelSlotIndex.text = n;
            }
            if (carregando == 0 && lc.PanelNoSaveSlots != null && lc.PanelNoSaveSlots.activeSelf != (visiveis == 0)) lc.PanelNoSaveSlots.SetActive(visiveis == 0);
        }
    }
}
