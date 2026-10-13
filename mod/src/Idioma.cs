using System;
using System.IO;
using UnityEngine;

namespace Bigorna
{
    /// <summary>A lingua do mod (paineis, avisos e mensagens na mesa): portugues ou ingles, num mod so.
    /// A escolha fica em bigorna-idioma.txt, na pasta de dados do jogo: o instalador grava a lingua escolhida nele, e o
    /// painel "Mapas da comunidade" troca. Sem o arquivo, segue a lingua do jogo (portugues so se o jogo estiver em
    /// portugues). O editor recebe a mesma escolha em Editor/bigorna-idioma.js (ele so a usa enquanto a pessoa nao
    /// escolher outra lingua nas configuracoes dele). Os registros (bigorna.log) e os relatos seguem em portugues.</summary>
    public static class Idioma
    {
        public static string Arquivo => Path.Combine(Application.persistentDataPath, "bigorna-idioma.txt");
        public static string ArquivoDoEditor => Path.Combine(Application.persistentDataPath, "Editor", "bigorna-idioma.js");

        static bool? _escolhido;
        static bool _lido;
        /// <summary>Liga quando o jogo chega a tela de titulo. Antes disso, perguntar a lingua ao jogo (FFGLocalization) no
        /// meio do carregamento das traducoes derrubava o jogo na abertura; ate la vale a lingua do Windows.</summary>
        public static bool JogoPronto;
        static bool _linguaDoJogo; static float _consultaAte = -1f;

        /// <summary>true: portugues; false: ingles.</summary>
        public static bool Pt
        {
            get
            {
                if (!_lido) { _lido = true; _escolhido = Ler(); }
                if (_escolhido.HasValue) return _escolhido.Value;
                // sem escolha: a lingua do Windows ate a tela de titulo; depois, a do jogo (pode mudar no menu dele), relida a
                // cada 2 s (o OnGUI pergunta varias vezes por quadro)
                if (!JogoPronto) return Application.systemLanguage == SystemLanguage.Portuguese;
                if (Time.unscaledTime >= _consultaAte) { _linguaDoJogo = Dados.DadosDoEditor.LinguaDoJogo().StartsWith("pt"); _consultaAte = Time.unscaledTime + 2f; }
                return _linguaDoJogo;
            }
        }

        public static string Codigo => Pt ? "pt" : "en";

        /// <summary>O texto na lingua do mod.</summary>
        public static string T(string pt, string en) => Pt ? pt : en;

        static bool? Ler()
        {
            try
            {
                if (!File.Exists(Arquivo)) return null;
                var t = File.ReadAllText(Arquivo).Trim().ToLowerInvariant();
                if (t.StartsWith("pt")) return true;
                if (t.StartsWith("en")) return false;
            }
            catch (Exception ex) { Log.Info("não li " + Arquivo + ": " + ex.Message); }
            return null;
        }

        /// <summary>Troca a lingua (botao do painel) e grava a escolha para as proximas vezes.</summary>
        public static void Definir(bool pt)
        {
            _lido = true; _escolhido = pt;
            try { File.WriteAllText(Arquivo, pt ? "pt" : "en"); } catch (Exception ex) { Log.Erro("gravando " + Arquivo, ex); }
            GravarParaOEditor();
            Log.Info("língua do mod: " + Codigo);
        }

        /// <summary>A lingua para o editor, ao lado dele (o editor carrega esse arquivo antes dos dados).</summary>
        public static void GravarParaOEditor()
        {
            try
            {
                var conteudo = "window.BIGORNA_IDIOMA = \"" + Codigo + "\";\n";
                Directory.CreateDirectory(Path.GetDirectoryName(ArquivoDoEditor));
                if (File.Exists(ArquivoDoEditor) && File.ReadAllText(ArquivoDoEditor) == conteudo) return;
                File.WriteAllText(ArquivoDoEditor, conteudo);
            }
            catch (Exception ex) { Log.Erro("gravando " + ArquivoDoEditor, ex); }
        }
    }
}
