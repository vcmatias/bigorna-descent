using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FFG.Core;
using Loxodon.Framework.Asynchronous;
using Loxodon.Framework.Bundles;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Um "pacote" de recursos que so existe na memoria: imagens da Oficina registradas com um caminho como os do jogo
    /// ("D3/Bigorna/Heroes/HERO_BRYNN.png"). O carregador do jogo passa a achar esses caminhos e entrega a nossa imagem
    /// (como Sprite ou Texture) a qualquer tela que a peca: retrato do heroi, recorte, icone de arma...
    /// </summary>
    public class PacoteVirtual : IBundle
    {
        public const string NomeDoPacote = "bigorna/virtual";
        static readonly PacoteVirtual _unico = new PacoteVirtual();
        static readonly Dictionary<string, Texture2D> _texturas = new Dictionary<string, Texture2D>(StringComparer.OrdinalIgnoreCase);
        static readonly Dictionary<string, Sprite> _sprites = new Dictionary<string, Sprite>(StringComparer.OrdinalIgnoreCase);
        static object _carregadorVisto;

        public string Name => NomeDoPacote;

        /// <summary>Registra (ou troca) a imagem de um caminho e garante que o carregador do jogo conhece o pacote.</summary>
        public static string Registrar(string caminho, Texture2D tex)
        {
            if (string.IsNullOrEmpty(caminho) || tex == null) return null;
            // o jogo limpa os recursos sem uso ao carregar um nivel (mapa-mundi, cidade): a nossa imagem nao pode ir junto
            tex.hideFlags |= HideFlags.DontUnloadUnusedAsset;
            _texturas[caminho] = tex;
            _sprites.Remove(caminho);
            Instalar(caminho);
            return caminho;
        }

        /// <summary>Poe o pacote na lista do carregador e o caminho no mapa caminho → pacote.</summary>
        public static void Instalar(string soEste = null)
        {
            try
            {
                var ab = Jogo.Persistente?.ABLoader; if (ab == null) return;
                const BindingFlags B = BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public;
                var pacotes = ab.GetType().GetField("_loadedBundles", B)?.GetValue(ab) as Dictionary<string, IBundle>;
                if (pacotes != null && (!pacotes.TryGetValue(NomeDoPacote, out var ja) || ja != _unico)) pacotes[NomeDoPacote] = _unico;
                var leitor = ab.GetType().GetField("_pathInfoParser", B)?.GetValue(ab);
                var mapa = leitor?.GetType().GetField("dict", B)?.GetValue(leitor) as Dictionary<string, string>;
                if (mapa == null) { if (!ReferenceEquals(_carregadorVisto, ab)) Log.Info("pacote virtual: não achei o mapa de caminhos do carregador"); _carregadorVisto = ab; return; }
                foreach (var c in soEste != null && ReferenceEquals(_carregadorVisto, ab) ? new[] { soEste } : _texturas.Keys.ToArray()) mapa[c.ToLowerInvariant()] = NomeDoPacote;
                _carregadorVisto = ab;
            }
            catch (Exception ex) { Log.Info("pacote virtual: " + ex.Message); }
        }

        static FieldInfo _fPacotes, _fLeitor, _fDict; static object _abVisto; static string _chaveTeste, _chaveTesteMin;
        /// <summary>Chamado a cada quadro (e barato): o jogo esvazia a lista de pacotes ao carregar um nivel (mapa-mundi,
        /// cidade, encontro); quando o nosso sumiu dela, ou os caminhos sumiram do mapa, ele volta no mesmo quadro, antes
        /// que alguma tela peca a imagem e fique em branco.</summary>
        public static void Garantir()
        {
            if (_texturas.Count == 0) return;
            try
            {
                var ab = Jogo.Persistente?.ABLoader; if (ab == null) return;
                const BindingFlags B = BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public;
                if (!ReferenceEquals(_abVisto, ab)) { _abVisto = ab; _fPacotes = ab.GetType().GetField("_loadedBundles", B); _fLeitor = ab.GetType().GetField("_pathInfoParser", B); _fDict = null; }
                var pacotes = _fPacotes?.GetValue(ab) as Dictionary<string, IBundle>;
                bool falta = pacotes != null && (!pacotes.TryGetValue(NomeDoPacote, out var ja) || ja != _unico);
                if (!falta)
                {
                    var leitor = _fLeitor?.GetValue(ab);
                    if (leitor != null && _fDict == null) _fDict = leitor.GetType().GetField("dict", B);
                    var mapa = leitor != null ? _fDict?.GetValue(leitor) as Dictionary<string, string> : null;
                    if (_chaveTeste == null || !_texturas.ContainsKey(_chaveTeste)) { _chaveTeste = _texturas.Keys.First(); _chaveTesteMin = _chaveTeste.ToLowerInvariant(); }
                    falta = mapa != null && !mapa.ContainsKey(_chaveTesteMin);
                }
                if (falta) { _carregadorVisto = null; Instalar(); Log.Info("pacote virtual: o jogo tinha tirado as imagens da Oficina; de volta (" + _texturas.Count + ")"); }
            }
            catch { }
        }

        public static Sprite SpriteDe(string caminho) => Achar(caminho, typeof(Sprite)) as Sprite;
        public static bool Tem(string caminho) => !string.IsNullOrEmpty(caminho) && _texturas.ContainsKey(caminho);

        static UnityEngine.Object Achar(string nome, Type tipo)
        {
            if (nome == null || !_texturas.TryGetValue(nome, out var tex)) return null;
            if (tex == null) { Log.Info("pacote virtual: a imagem «" + nome + "» foi descartada pelo jogo"); return null; }
            if (tipo == typeof(Sprite))
            {
                if (!_sprites.TryGetValue(nome, out var sp) || sp == null)
                {
                    sp = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
                    sp.name = tex.name; sp.hideFlags |= HideFlags.DontUnloadUnusedAsset; _sprites[nome] = sp;
                }
                return sp;
            }
            if (tipo == null || tipo.IsAssignableFrom(typeof(Texture2D))) return tex;
            return null;
        }

        static ProgressResult<float, T> Pronto<T>(T v) { var r = new ProgressResult<float, T>(); r.SetResult(v); return r; }

        public T LoadAsset<T>(string name) where T : UnityEngine.Object => Achar(name, typeof(T)) as T;
        public UnityEngine.Object LoadAsset(string name, Type type) => Achar(name, type);
        public IProgressResult<float, T> LoadAssetAsync<T>(string name) where T : UnityEngine.Object => Pronto(LoadAsset<T>(name));
        public IProgressResult<float, UnityEngine.Object> LoadAssetAsync(string name, Type type) => Pronto(LoadAsset(name, type));
        public IProgressResult<float, T[]> LoadAssetsAsync<T>(params string[] names) where T : UnityEngine.Object => Pronto(names.Select(n => LoadAsset<T>(n)).ToArray());
        public IProgressResult<float, UnityEngine.Object[]> LoadAssetsAsync(Type type, params string[] names) => Pronto(names.Select(n => LoadAsset(n, type)).ToArray());
        public IProgressResult<float, Dictionary<string, T>> LoadAssetsToMapAsync<T>(params string[] names) where T : UnityEngine.Object => Pronto(names.ToDictionary(n => n, n => LoadAsset<T>(n)));
        public IProgressResult<float, Dictionary<string, UnityEngine.Object>> LoadAssetsToMapAsync(Type type, params string[] names) => Pronto(names.ToDictionary(n => n, n => LoadAsset(n, type)));
        public T[] LoadAllAssets<T>() where T : UnityEngine.Object => _texturas.Keys.Select(k => LoadAsset<T>(k)).Where(x => x != null).ToArray();
        public UnityEngine.Object[] LoadAllAssets(Type type) => _texturas.Keys.Select(k => LoadAsset(k, type)).Where(x => x != null).ToArray();
        public IProgressResult<float, T[]> LoadAllAssetsAsync<T>() where T : UnityEngine.Object => Pronto(LoadAllAssets<T>());
        public IProgressResult<float, UnityEngine.Object[]> LoadAllAssetsAsync(Type type) => Pronto(LoadAllAssets(type));
        public UnityEngine.Object[] LoadAssetWithSubAssets(string name, Type type) { var o = LoadAsset(name, type); return o != null ? new[] { o } : new UnityEngine.Object[0]; }
        public T[] LoadAssetWithSubAssets<T>(string name) where T : UnityEngine.Object { var o = LoadAsset<T>(name); return o != null ? new[] { o } : new T[0]; }
        public IProgressResult<float, T[]> LoadAssetWithSubAssetsAsync<T>(string name) where T : UnityEngine.Object => Pronto(LoadAssetWithSubAssets<T>(name));
        public IProgressResult<float, UnityEngine.Object[]> LoadAssetWithSubAssetsAsync(string name, Type type) => Pronto(LoadAssetWithSubAssets(name, type));
        public void Dispose() { }
    }
}
