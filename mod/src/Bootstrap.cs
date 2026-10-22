using System;
using System.IO;
using UnityEngine;

namespace Bigorna
{
    /// <summary>Ponto de entrada. O Unity chama Init() por causa do registro em RuntimeInitializeOnLoads.json.</summary>
    public static class Bootstrap
    {
        public const string Versao = VersaoDoPacote.Texto;   // (do arquivo mod/VERSAO, pelo build.sh)
        static bool _iniciado;

        public static string PastaMapas => Path.Combine(Application.persistentDataPath, "CustomMaps");
        /// <summary>Os pacotes baixados do acervo (conteudo da Oficina que os mapas exigem), ao lado de CustomMaps.</summary>
        public static string PastaPacotes => Path.Combine(Application.persistentDataPath, "Pacotes");
        public static string CaminhoLog => Path.Combine(Application.persistentDataPath, "bigorna.log");

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        public static void Init()
        {
            if (_iniciado) return;
            _iniciado = true;
            try
            {
                Directory.CreateDirectory(PastaMapas);
                Acervo.Pacotes.Raiz = PastaPacotes;
                Dados.ImagensDaObra.Dados = Application.persistentDataPath;
                // mapas em varias linguas: a lingua do jogo (so depois da tela de titulo; antes, a do mod) e as escolhas das fichas
                Formato.Traducao.ArquivoDeEscolhas = Path.Combine(Application.persistentDataPath, "bigorna-linguas.json");
                Formato.Traducao.LinguaDoJogoAgora = () => Idioma.JogoPronto ? Dados.DadosDoEditor.LinguaDoJogo() : Idioma.Codigo;
                Log.Novo();
                string compilado = ""; try { compilado = " (DLL de " + System.IO.File.GetLastWriteTime(typeof(Bootstrap).Assembly.Location).ToString("dd/MM HH:mm") + ")"; } catch { }
                Log.Info("Bigorna " + Versao + compilado + " em marcha. Unity " + Application.unityVersion + " · " + Application.productName);
                Log.Info("mapas: " + PastaMapas);
                var go = new GameObject("@Bigorna");
                UnityEngine.Object.DontDestroyOnLoad(go);
                go.AddComponent<Nucleo>();
            }
            catch (Exception ex)
            {
                Log.Info("falha ao iniciar: " + ex);
            }
        }
    }
}
