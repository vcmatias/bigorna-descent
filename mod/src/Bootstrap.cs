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

        /// <summary>v270: os mapas e campanhas do Bigorna (.bmap, .bcamp), numa pasta só dele: a antiga, CustomMaps, é também a do
        /// DescentForge, com o mesmo formato. O que o Bigorna grava vai para cá.</summary>
        public static string PastaMapas => Path.Combine(Application.persistentDataPath, "Bigorna", "Mapas");
        /// <summary>A pasta antiga: os .dmap e .dcamp do Bigorna de antes da v270 continuam lidos dali (só os que trazem a marca do
        /// Bigorna; os de outro editor ficam fora das listas). Nada é copiado nem mudado nela.</summary>
        public static string PastaMapasAntiga => Path.Combine(Application.persistentDataPath, "CustomMaps");
        /// <summary>As pastas lidas pelas listas: a nova primeiro, depois a antiga (retrocompatibilidade).</summary>
        public static string[] PastasDeMapas => new[] { PastaMapas, PastaMapasAntiga };
        /// <summary>As campanhas das duas pastas (a da pasta nova vence a da antiga com o mesmo id).</summary>
        public static System.Collections.Generic.List<Formato.Dcamp> Campanhas(string extra = "", bool soFicha = false)
        {
            var r = new System.Collections.Generic.List<Formato.Dcamp>(); var ids = new System.Collections.Generic.HashSet<string>(System.StringComparer.OrdinalIgnoreCase);
            foreach (var p in PastasDeMapas) foreach (var c in Formato.Dcamp.CarregarTodas(p, extra, soFicha)) if (string.IsNullOrEmpty(c.Id) || ids.Add(c.Id)) r.Add(c);
            return r;
        }
        /// <summary>Os pacotes baixados do acervo (conteudo da Oficina que os mapas exigem), ao lado de CustomMaps.</summary>
        public static string PastaPacotes => Path.Combine(Application.persistentDataPath, "Pacotes");
        static string _caminhoLog;
        /// <summary>(v263: guardado na primeira vez, na linha principal: a leitura ao fundo também escreve no registro)</summary>
        public static string CaminhoLog => _caminhoLog ?? (_caminhoLog = Path.Combine(Application.persistentDataPath, "bigorna.log"));

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
                Log.Info("mapas: " + PastaMapas + " (e os antigos do Bigorna em " + PastaMapasAntiga + ")");
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
