using System;
using System.Collections;
using System.IO;
using FFG.Core;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Video;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Filme proprio (MP4 ou WebM) ao lado do .dcamp ou do .dmap, tocado em tela cheia por cima de tudo. A musica do jogo e a
    /// musica propria ficam em pausa enquanto ele toca. Clique, Espaco, Enter ou Esc pulam o filme.
    /// </summary>
    public static class VideoProprio
    {
        public static bool EmMarcha { get; private set; }

        /// <summary>Toca o arquivo e chama "aoFim" quando termina, e pulado, ou logo, se nao der para tocar.</summary>
        public static void Tocar(string arquivo, Action aoFim)
        {
            void Fim() { try { aoFim?.Invoke(); } catch (Exception ex) { Log.Erro("depois do filme", ex); } }
            if (string.IsNullOrEmpty(arquivo) || !File.Exists(arquivo)) { Log.Info("filme: não achei «" + arquivo + "» (ele vai na mesma pasta do .dcamp ou do .dmap)"); Fim(); return; }
            if (EmMarcha) { Log.Info("já há um filme tocando; «" + Path.GetFileName(arquivo) + "» é pulado"); Fim(); return; }
            if (Nucleo.Instancia == null) { Fim(); return; }
            Nucleo.Instancia.StartCoroutine(Correr(arquivo, Fim));
        }

        static IEnumerator Correr(string arquivo, Action fim)
        {
            EmMarcha = true;
            Log.Info("filme: " + Path.GetFileName(arquivo));
            GameObject raiz = null; RenderTexture rt = null;
            var pgo = Jogo.Persistente;
            bool pausouMusica = false;
            VideoPlayer vp = null; RawImage tela = null;
            try
            {
                raiz = new GameObject("Bigorna Filme");
                UnityEngine.Object.DontDestroyOnLoad(raiz);
                var canvas = raiz.AddComponent<Canvas>();
                canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 32000;
                raiz.AddComponent<GraphicRaycaster>();
                var fundo = new GameObject("fundo", typeof(RectTransform)); fundo.transform.SetParent(raiz.transform, false);
                var imgFundo = fundo.AddComponent<Image>(); imgFundo.color = Color.black; Esticar(fundo.GetComponent<RectTransform>());
                var go = new GameObject("video", typeof(RectTransform)); go.transform.SetParent(raiz.transform, false);
                tela = go.AddComponent<RawImage>(); tela.color = Color.black; Esticar(go.GetComponent<RectTransform>());
                var proporcao = go.AddComponent<AspectRatioFitter>(); proporcao.aspectMode = AspectRatioFitter.AspectMode.FitInParent; proporcao.aspectRatio = 16f / 9f;
                vp = raiz.AddComponent<VideoPlayer>();
                vp.playOnAwake = false; vp.source = VideoSource.Url; vp.url = new Uri(arquivo).AbsoluteUri;
                vp.renderMode = VideoRenderMode.RenderTexture; vp.isLooping = false; vp.skipOnDrop = true;
                vp.audioOutputMode = VideoAudioOutputMode.Direct;
                vp.Prepare();
            }
            catch (Exception ex) { Log.Erro("montando o filme", ex); }
            float limite = Time.unscaledTime + 15f;
            while (vp != null && !vp.isPrepared && Time.unscaledTime < limite) yield return null;
            if (vp == null || !vp.isPrepared) { Log.Info("filme: o jogo não conseguiu abrir «" + Path.GetFileName(arquivo) + "» (use MP4 H.264 ou WebM VP8)"); Limpar(raiz, rt); EmMarcha = false; fim(); yield break; }
            try
            {
                int w = (int)Math.Max(16, vp.width), h = (int)Math.Max(16, vp.height);
                rt = new RenderTexture(w, h, 0); vp.targetTexture = rt;
                tela.texture = rt; tela.color = Color.white;
                var ar = tela.GetComponent<AspectRatioFitter>(); if (ar != null) ar.aspectRatio = (float)w / h;
                for (ushort i = 0; i < vp.audioTrackCount; i++) vp.SetDirectAudioVolume(i, Volume());
                try { pgo?.Audio.PauseMusic(); pausouMusica = true; } catch { }
                MusicaPropria.Pausar(true);
                vp.Play();
            }
            catch (Exception ex) { Log.Erro("tocando o filme", ex); }
            bool acabou = false;
            vp.loopPointReached += _ => acabou = true;
            float comecou = Time.unscaledTime;
            while (!acabou)
            {
                if (Time.unscaledTime - comecou > 0.4f && (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return))) { Log.Info("filme pulado"); break; }
                if (!vp.isPlaying && Time.unscaledTime - comecou > 2f && vp.frame > 0 && (ulong)vp.frame >= vp.frameCount - 1) break;
                yield return null;
            }
            try { vp.Stop(); } catch { }
            Limpar(raiz, rt);
            if (pausouMusica) { try { pgo?.Audio.ResumeMusic(); } catch { } }
            MusicaPropria.Pausar(false);
            yield return null;
            EmMarcha = false;
            fim();
        }

        static void Esticar(RectTransform r) { r.anchorMin = Vector2.zero; r.anchorMax = Vector2.one; r.offsetMin = Vector2.zero; r.offsetMax = Vector2.zero; }

        static void Limpar(GameObject raiz, RenderTexture rt)
        {
            try { if (raiz != null) UnityEngine.Object.Destroy(raiz); } catch { }
            try { if (rt != null) { rt.Release(); UnityEngine.Object.Destroy(rt); } } catch { }
        }

        static float Volume()
        {
            int v = Settings.MusicVolSlider;
            if (v <= 0) { try { v = FFGPlayerPrefs.GetInt("PREF_MUSIC_VOLUME", 50); } catch { v = 50; } }
            return Mathf.Clamp01(Math.Max(v, 40) / 100f);
        }
    }
}
