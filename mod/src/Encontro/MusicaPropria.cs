using System;
using System.Collections;
using System.IO;
using Bigorna.Formato;
using FFG.Core;
using UnityEngine;
using UnityEngine.Networking;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Musica propria do mapa: um arquivo de audio (OGG, WAV ou MP3) ao lado do .dmap, tocado em loop no lugar da musica do
    /// jogo. A musica do jogo (Wwise) fica muda enquanto a nossa toca; o volume segue o controle de musica das opcoes.
    /// </summary>
    public static class MusicaPropria
    {
        static AudioSource _fonte;
        static float _proximoAjuste;
        static bool _calando;


        /// <summary>Comeca a musica do mapa, se ele tiver uma. Devolve false quando nao ha (o jogo segue com a dele).</summary>
        public static bool Tocar(Dmap m)
        {
            var mu = m?.Metadados?.Musica;
            if (mu == null || string.IsNullOrEmpty(mu.Arquivo)) return false;
            string arq;
            try { arq = Path.Combine(Path.GetDirectoryName(m.Caminho ?? "") ?? "", Path.GetFileName(mu.Arquivo)); }
            catch { return false; }
            if (!File.Exists(arq)) { Log.Info("música própria: não achei «" + arq + "» (ela vai na mesma pasta do .dmap)"); return false; }
            if (Nucleo.Instancia == null) return false;
            Nucleo.Instancia.StartCoroutine(Carregar(arq, mu.Repetir, mu.Titulo));
            return true;
        }

        static IEnumerator Carregar(string arq, bool repetir, string titulo)
        {
            var ext = Path.GetExtension(arq).ToLowerInvariant();
            var tipo = ext == ".wav" ? AudioType.WAV : ext == ".mp3" ? AudioType.MPEG : AudioType.OGGVORBIS;
            using (var req = UnityWebRequestMultimedia.GetAudioClip(new Uri(arq).AbsoluteUri, tipo))
            {
                if (req.downloadHandler is DownloadHandlerAudioClip dh) dh.compressed = true;
                yield return req.SendWebRequest();
                if (!string.IsNullOrEmpty(req.error)) { Log.Info("música própria: não li «" + arq + "»: " + req.error); yield break; }
                AudioClip clip = null;
                try { clip = DownloadHandlerAudioClip.GetContent(req); } catch (Exception ex) { Log.Info("música própria: " + ex.Message); }
                if (clip == null) { Log.Info("música própria: o arquivo não é um áudio que o jogo lê (use OGG Vorbis)"); yield break; }
                clip.name = "Bigorna " + Path.GetFileName(arq);
                if (_fonte == null)
                {
                    var go = new GameObject("Bigorna Musica");
                    UnityEngine.Object.DontDestroyOnLoad(go);
                    _fonte = go.AddComponent<AudioSource>();
                    _fonte.spatialBlend = 0f; _fonte.playOnAwake = false; _fonte.ignoreListenerPause = true;
                }
                _fonte.Stop(); _fonte.clip = clip; _fonte.loop = repetir; _fonte.volume = Volume();
                _calando = true; Calar();
                _fonte.Play();
                Log.Info("música própria: «" + (string.IsNullOrEmpty(titulo) ? Path.GetFileName(arq) : titulo) + "» (" + Mathf.RoundToInt(clip.length) + " s" + (repetir ? ", em loop" : "") + ")");
            }
        }

        static float Volume()
        {
            int v = Settings.MusicVolSlider;
            if (v <= 0) { try { v = FFGPlayerPrefs.GetInt("PREF_MUSIC_VOLUME", 50); } catch { v = 50; } }
            return Mathf.Clamp01(v / 100f);
        }

        /// <summary>Pausa a musica propria (um filme vai tocar) ou a retoma.</summary>
        public static void Pausar(bool pausar) { try { if (_fonte == null || _fonte.clip == null) return; if (pausar) _fonte.Pause(); else if (_calando) _fonte.UnPause(); } catch { } }

        static void Calar() { try { AkSoundEngine.SetRTPCValue("MusicVolume", 0f); } catch { } }

        /// <summary>Em todo quadro: o volume segue as opcoes e a musica do jogo continua muda (as opcoes a devolvem).</summary>
        public static void Batimento()
        {
            if (!_calando || _fonte == null) return;
            if (Time.unscaledTime < _proximoAjuste) return;
            _proximoAjuste = Time.unscaledTime + 0.5f;
            _fonte.volume = Volume();
            Calar();
        }

        /// <summary>Ao sair do encontro: para a nossa musica e devolve o volume da do jogo.</summary>
        public static void Parar()
        {
            if (_fonte != null) { _fonte.Stop(); if (_fonte.clip != null) { UnityEngine.Object.Destroy(_fonte.clip); _fonte.clip = null; } }
            if (!_calando) return;
            _calando = false;
            try { AkSoundEngine.SetRTPCValue("MusicVolume", (float)Mathf.Max(0, Settings.MusicVolSlider > 0 ? Settings.MusicVolSlider : FFGPlayerPrefs.GetInt("PREF_MUSIC_VOLUME", 50))); } catch { }
            Log.Info("música própria: parada; a do jogo volta");
        }
    }
}
