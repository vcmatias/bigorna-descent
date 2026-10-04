using System;
using System.Collections;
using System.Linq;
using FFG.Core;
using FFG.D3;
using FFG.D3.UI;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Video;

namespace Bigorna.Encontro
{
    /// <summary>Toca uma cena (video) do proprio jogo pelo quadro de cutscene da interface, como o jogo faz nas missoes oficiais.
    /// O nome pode ser o id do modelo (CUTSCENE_01), o nome do asset (Cutscene_01) ou o evento de som (Cutscene_1_Introduction).</summary>
    public static class Cinematica
    {
        public static bool EmMarcha { get; private set; }

        static string Chave(string s) => (s ?? "").Trim().ToLowerInvariant().Replace("_", "").Replace("-", "").Replace(" ", "");

        public static CutsceneModel Achar(string nome)
        {
            if (string.IsNullOrEmpty(nome)) return null;
            var todas = UserCollectionManager.GetCutscenes(true);
            if (todas == null) return null;
            var k = Chave(nome);
            return todas.FirstOrDefault(c => c != null && (Chave(c.Id) == k || Chave(c.name) == k || Chave(c.SoundEventName) == k))
                ?? todas.FirstOrDefault(c => c != null && (Chave(c.Id).Contains(k) || Chave(c.name).Contains(k)));
        }

        public static string Lista()
        {
            try
            {
                var todas = UserCollectionManager.GetCutscenes(true);
                if (todas == null) return "(o catálogo ainda não carregou)";
                return string.Join("\n", todas.Where(c => c != null).Select(c => c.Id + "  ·  " + c.name + "  ·  " + c.SoundEventName).ToArray());
            }
            catch (Exception ex) { return ex.Message; }
        }

        public static bool Tocar(string nome) => Tocar(nome, null);

        /// <summary>Toca e chama "aoFim" quando o filme acaba (ou logo, se nao der para tocar).</summary>
        public static bool Tocar(string nome, Action aoFim)
        {
            var modelo = Achar(nome);
            bool ok = false;
            if (modelo == null) Log.Info("cena «" + nome + "» não existe nesta coleção. Cenas disponíveis:\n" + Lista());
            else if (EmMarcha) Log.Info("já há uma cena em andamento; «" + nome + "» é pulada");
            else if (Nucleo.Instancia == null || Jogo.UI == null || Jogo.Persistente == null) Log.Info("a interface do jogo não está pronta; «" + nome + "» é pulada");
            else { Nucleo.Instancia.StartCoroutine(Correr(modelo, aoFim)); ok = true; }
            if (!ok) { try { aoFim?.Invoke(); } catch (Exception ex) { Log.Erro("depois da cena", ex); } }
            return ok;
        }

        static IEnumerator Correr(CutsceneModel modelo, Action aoFim)
        {
            // um erro no meio do filme (interface destruida...) nao pode deixar EmMarcha preso nem a conversa sem continuacao
            yield return Lancador.Seguro("cena " + modelo.Id, Filme(modelo));
            if (EmMarcha) { EmMarcha = false; try { var pgo = Jogo.Persistente; if (pgo != null) pgo.IsPlayingCutscene = false; } catch { } }
            try { aoFim?.Invoke(); } catch (Exception ex) { Log.Erro("depois da cena", ex); }
        }

        static IEnumerator Filme(CutsceneModel modelo)
        {
            EmMarcha = true;
            Log.Info("cena: " + modelo.Id + " (" + modelo.name + ")");
            var espera = new WaitForSeconds(0.5f);
            var pgo = Jogo.Persistente;
            var ui = Jogo.UI;
            string bundle = null;
            try
            {
                var quadro = ui.Cutscene;
                quadro.Reset();
                ui.LoadingScreen.SetLoadingInfo(false, null);
                ui.FadeUI(true);
            }
            catch (Exception ex) { Log.Erro("preparando a cena", ex); EmMarcha = false; yield break; }
            yield return espera;
            try { bundle = modelo.GetCutsceneAssetBundlePath().ToLowerInvariant(); } catch (Exception ex) { Log.Info("caminho da cena: " + ex.Message); }
            if (!string.IsNullOrEmpty(bundle)) yield return pgo.StartCoroutine(pgo.ABLoader.CoroutineLoadBundle(bundle));
            bool pronto = false;
            try
            {
                var quadro = ui.Cutscene;
                ui.OnAdjustAspectRatioFitter(quadro.GetComponent<AspectRatioFitter>());
                quadro.Show(false);
                quadro.SetVideoClip(pgo.ABLoader.LoadAsset<VideoClip>(modelo.VideoAssetPath), true);
                quadro.SetSubtitles(modelo.Subtitles);
                pgo.Audio.PauseMusic();
                AkBankManager.LoadBankAsync(modelo.MusicSoundbank);
                AkBankManager.LoadBankAsync(modelo.VoiceSoundbank);
                pronto = true;
            }
            catch (Exception ex) { Log.Erro("montando a cena", ex); }
            if (!pronto) { Recolher(bundle, modelo); EmMarcha = false; yield break; }
            float limite = Time.unscaledTime + 20f;
            while (!ui.Cutscene.VideoIsPrepared && Time.unscaledTime < limite) yield return null;
            ui.FadeUI(false);
            yield return espera;
            try
            {
                pgo.IsPlayingCutscene = true;
                pgo.Audio.PostEvent(modelo.SoundEventName, ui.Cutscene.gameObject);
                ui.Cutscene.PlayCutscene();
            }
            catch (Exception ex) { Log.Erro("tocando a cena", ex); pgo.IsPlayingCutscene = false; }
            while (pgo.IsPlayingCutscene)
            {
                if (Input.anyKeyDown || Input.GetMouseButtonDown(0)) { try { ui.Cutscene.SetContinueVisibility(true); } catch { } }
                yield return null;
            }
            yield return new WaitForSeconds(0.8f);
            Recolher(bundle, modelo);
            try { ui.Cutscene.Hide(true); } catch { }
            EmMarcha = false;
        }

        static void Recolher(string bundle, CutsceneModel modelo)
        {
            try
            {
                var pgo = Jogo.Persistente;
                var ui = Jogo.UI;
                pgo.Audio.PostEvent("Music_Cutscene_Stop", ui.Cutscene.gameObject);
                ui.Cutscene.Reset();
                if (!string.IsNullOrEmpty(bundle)) pgo.ABLoader.UnloadBundle(bundle);
                AkBankManager.UnloadBank(modelo.MusicSoundbank);
                AkBankManager.UnloadBank(modelo.VoiceSoundbank);
                AkBankManager.DoUnloadBanks();
                pgo.Audio.ResumeMusic();
                ui.FadeUI(false);
                pgo.IsPlayingCutscene = false;
            }
            catch (Exception ex) { Log.Info("recolhendo a cena: " + ex.Message); }
        }
    }
}
