using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using FFG.Core;
using FFG.D3;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Sons dos monstros da Oficina. O jogo toca, ao surgir e ao ativar, o som "Enemy_" + tipo do monstro; so um vilao usa
    /// os eventos proprios do modelo (surgir, atacar, defender, cair). Dois modos:
    /// - "type": o som de outro tipo de monstro. O modelo vira vilao com os eventos de surgir e atacar apontando para
    ///   "Enemy_" + o tipo escolhido (defender e cair ficam como num monstro comum).
    /// - "files": arquivos do usuario (OGG, MP3, WAV) ao lado do mapa. Os eventos do jogo ficam mudos (evento sem nome) e
    ///   o mod toca o arquivo de cada momento, que ele mesmo percebe: um monstro novo no tabuleiro (surgir), a ativacao
    ///   pedida pelo jogo (atacar), a vida que desce (golpe) e a vida que acaba ou o monstro que sai logo depois de um
    ///   golpe (cair).
    /// </summary>
    public static class VozesProprias
    {
        static readonly string[] Momentos = { "spawn", "attack", "defend", "defeat" };
        static readonly Dictionary<string, Dictionary<string, string>> _arquivos = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, AudioClip> _clips = new Dictionary<string, AudioClip>(StringComparer.OrdinalIgnoreCase);
        static readonly HashSet<string> _carregando = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, Estado> _vistos = new Dictionary<string, Estado>();
        static readonly Dictionary<string, object> _eventos = new Dictionary<string, object>();
        static object _ultimaAtivacao;
        static float _proximoSurgir;
        static AudioSource _fonte;

        class Estado { public string Modelo; public int Vida; public float Golpe = -99f; public bool Caiu; }

        /// <summary>Aplica os sons do .dmap ao modelo novo (chamado depois de copiar os sons do monstro-base).</summary>
        public static void Aplicar(EnemyModel m, string id, JObject sons)
        {
            _arquivos.Remove(id);
            if (sons == null) return;
            var modo = (string)sons["mode"];
            if (modo == "files")
            {
                var mapa = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var k in Momentos) { var a = (string)sons[k]; if (!string.IsNullOrEmpty(a)) mapa[k] = a; }
                m.IsVillain = true;
                Por(m, "SpawnSound", Evento("")); Por(m, "AttackSound", Evento(""));
                Por(m, "DefendSound", null); Por(m, "DefeatSound", null);
                _arquivos[id] = mapa;
                Log.Info("  sons próprios de «" + id + "»: " + (mapa.Count == 0 ? "nenhum arquivo (mudo)" : string.Join(", ", new List<string>(mapa.Keys).ToArray())));
                return;
            }
            var tipo = (string)sons["type"];
            if (string.IsNullOrEmpty(tipo) || !Enum.IsDefined(typeof(EnemyTypes), tipo)) return;
            if (string.Equals(tipo, m.Type.ToString(), StringComparison.OrdinalIgnoreCase) && !m.IsVillain) return;   // o som do proprio tipo: o jogo ja toca
            var nome = "Enemy_" + (EnemyTypes)Enum.Parse(typeof(EnemyTypes), tipo);
            m.IsVillain = true;
            Por(m, "SpawnSound", Evento(nome)); Por(m, "AttackSound", Evento(nome));
            Por(m, "DefendSound", null); Por(m, "DefeatSound", null);
            Log.Info("  som de «" + id + "»: " + nome);
        }

        static void Por(EnemyModel m, string campo, object valor)
        {
            try { typeof(EnemyModel).GetField(campo)?.SetValue(m, valor); }
            catch (Exception ex) { Log.Info("som «" + campo + "»: " + ex.Message); }
        }

        /// <summary>Um AK.Wwise.Event com o nome dado (o jogo toca pelo nome); nome vazio e um evento mudo.</summary>
        static object Evento(string nome)
        {
            if (_eventos.TryGetValue(nome, out var ja)) return ja;
            var tEv = typeof(EnemyModel).GetField("SpawnSound").FieldType;
            var ev = Activator.CreateInstance(tEv);
            var fRef = tEv.GetField("WwiseObjectReference");
            var r = ScriptableObject.CreateInstance(fRef.FieldType);
            r.name = "Bigorna " + nome; r.hideFlags = HideFlags.HideAndDontSave;
            for (var t = fRef.FieldType; t != null; t = t.BaseType)
            {
                var f = t.GetField("objectName", BindingFlags.Instance | BindingFlags.NonPublic);
                if (f != null) { f.SetValue(r, nome); break; }
            }
            fRef.SetValue(ev, r);
            return _eventos[nome] = ev;
        }

        // ------------------------------------------------------------ durante o encontro

        public static void NovoEncontro() { _vistos.Clear(); _ultimaAtivacao = null; }
        static readonly HashSet<string> _presentes = new HashSet<string>();

        public static void Batimento()
        {
            if (_arquivos.Count == 0 || !Jogo.EmEncontro) return;
            var gc = Jogo.Controle;
            if (gc == null) return;
            try
            {
                var req = gc.GetCurrentEnemyActivation();
                if (req != null && !ReferenceEquals(req, _ultimaAtivacao))
                {
                    _ultimaAtivacao = req;
                    if (req.Enemy != null) Tocar(req.Enemy.ModelId, "attack");
                }
            }
            catch { }
            var lista = Jogo.Partida?.Enemies;
            if (lista == null) return;
            var presentes = _presentes; presentes.Clear();   // reaproveitado: isto corre a cada quadro
            foreach (var e in lista)
            {
                if (e == null || string.IsNullOrEmpty(e.ModelId) || !_arquivos.ContainsKey(e.ModelId)) continue;
                var g = e.GUID ?? e.ModelId;
                presentes.Add(g);
                if (!_vistos.TryGetValue(g, out var s))
                {
                    _vistos[g] = new Estado { Modelo = e.ModelId, Vida = e.Health };
                    if (Time.unscaledTime >= _proximoSurgir) { _proximoSurgir = Time.unscaledTime + 0.8f; Tocar(e.ModelId, "spawn"); }
                    continue;
                }
                if (e.Health < s.Vida && !s.Caiu)
                {
                    if (e.Health <= 0) { s.Caiu = true; Tocar(e.ModelId, "defeat"); }
                    else { s.Golpe = Time.unscaledTime; Tocar(e.ModelId, "defend"); }
                }
                s.Vida = e.Health;
            }
            if (_vistos.Count > presentes.Count)
            {
                var sairam = new List<string>();
                foreach (var kv in _vistos) if (!presentes.Contains(kv.Key)) sairam.Add(kv.Key);
                foreach (var g in sairam)
                {
                    var s = _vistos[g];
                    // saiu logo depois de um golpe: caiu (um gatilho que tira o monstro nao faz som)
                    if (!s.Caiu && Time.unscaledTime - s.Golpe < 4f) Tocar(s.Modelo, "defeat");
                    _vistos.Remove(g);
                }
            }
        }

        static void Tocar(string modelo, string momento)
        {
            if (modelo == null || !_arquivos.TryGetValue(modelo, out var mapa) || !mapa.TryGetValue(momento, out var arquivo)) return;
            if (_clips.TryGetValue(arquivo, out var clip) && clip != null) { Soar(clip); return; }
            var caminho = Achar(arquivo);
            if (caminho == null) { Log.Info("som de «" + modelo + "» (" + momento + "): não achei «" + arquivo + "» (ele vai na mesma pasta do .dmap)"); _clips[arquivo] = null; return; }
            if (_carregando.Add(arquivo)) Nucleo.Instancia?.StartCoroutine(Carregar(arquivo, caminho, true));
        }

        /// <summary>Toca um arquivo de som do usuario (acao "Play a sound" com arquivo proprio), achado ao lado do mapa.</summary>
        public static void TocarArquivo(string arquivo)
        {
            if (string.IsNullOrEmpty(arquivo)) return;
            if (_clips.TryGetValue(arquivo, out var clip) && clip != null) { Soar(clip); return; }
            var caminho = Achar(arquivo);
            if (caminho == null) { Log.Info("som próprio: não achei «" + arquivo + "» (ele vai na mesma pasta do .dmap)"); return; }
            if (_carregando.Add(arquivo)) Nucleo.Instancia?.StartCoroutine(Carregar(arquivo, caminho, true));
        }

        /// <summary>Carrega de antemao os arquivos dos monstros deste mapa (o primeiro som ja sai na hora).</summary>
        public static void Preparar()
        {
            foreach (var mapa in _arquivos.Values)
                foreach (var a in mapa.Values)
                {
                    if (_clips.ContainsKey(a) || _carregando.Contains(a)) continue;
                    var c = Achar(a);
                    if (c != null && _carregando.Add(a)) Nucleo.Instancia?.StartCoroutine(Carregar(a, c, false));
                }
        }

        static string Achar(string arquivo)
        {
            foreach (var pasta in new[] { Path.GetDirectoryName((Motor.Roteiro.Mapa ?? Lancador.Atual)?.Caminho ?? "") ?? "", Campanha.Campanha.Aberta?.Pasta ?? "" })
            {
                if (string.IsNullOrEmpty(pasta)) continue;
                var c = Path.Combine(pasta, Path.GetFileName(arquivo));
                if (File.Exists(c)) return c;
            }
            return null;
        }

        static IEnumerator Carregar(string arquivo, string caminho, bool tocar)
        {
            var ext = Path.GetExtension(caminho).ToLowerInvariant();
            var tipo = ext == ".wav" ? AudioType.WAV : ext == ".mp3" ? AudioType.MPEG : AudioType.OGGVORBIS;
            using (var req = UnityWebRequestMultimedia.GetAudioClip(new Uri(caminho).AbsoluteUri, tipo))
            {
                yield return req.SendWebRequest();
                _carregando.Remove(arquivo);
                AudioClip clip = null;
                if (string.IsNullOrEmpty(req.error)) { try { clip = DownloadHandlerAudioClip.GetContent(req); } catch (Exception ex) { Log.Info("som «" + arquivo + "»: " + ex.Message); } }
                else Log.Info("som «" + arquivo + "»: " + req.error);
                if (clip != null) { clip.name = "Bigorna " + arquivo; UnityEngine.Object.DontDestroyOnLoad(clip); }
                _clips[arquivo] = clip;
                if (clip != null && tocar) Soar(clip);
            }
        }

        static void Soar(AudioClip clip)
        {
            if (_fonte == null)
            {
                var go = new GameObject("@Bigorna-Vozes");
                UnityEngine.Object.DontDestroyOnLoad(go);
                _fonte = go.AddComponent<AudioSource>();
                _fonte.spatialBlend = 0f; _fonte.playOnAwake = false;
            }
            int v = Settings.SFXVolSlider;
            if (v <= 0) { try { v = FFGPlayerPrefs.GetInt("PREF_SFX_VOLUME", 50); } catch { v = 50; } }
            _fonte.PlayOneShot(clip, Mathf.Clamp01(v / 100f));
        }
    }
}
