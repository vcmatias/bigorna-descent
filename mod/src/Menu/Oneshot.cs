using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using Bigorna.Dados;
using FFG.D3;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>
    /// v258, o "Mapa oneshot": um mapa novo feito na hora pelo gerador de mapas do proprio editor, com as mesmas regras. O mod
    /// nao tem uma copia do gerador: ele pede ao aplicativo Bigorna Editor (instalado pelo mod), sem janela a vista, que abra o
    /// editor num perfil proprio e rode o gerador (Bigorna Editor.exe --gerador pedido.json resposta.json). O pedido leva so o
    /// que a tela do jogo pergunta (duracao e dificuldade), as caixas da colecao do jogador e a lingua; o resto o gerador
    /// sorteia (premissa, objetivo, regras extras, terreno), com os monstros e itens do proprio jogo. Os textos do mapa saem na
    /// lingua do jogo (v259: portugues e ingles do proprio editor; as outras pelas tabelas bigorna-gerador-<lingua>.js). A resposta traz a
    /// semente, o .dmap e a simulacao (2, 3 e 4 herois, como no editor). O mapa fica em Bigorna\Oneshot\oneshot.dmap, na pasta
    /// de dados do jogo, fora da lista dos mapas da comunidade.
    /// </summary>
    public static class Oneshot
    {
        public class Simulacao
        {
            public int Herois, Vida, Rodadas, Limite, Perda, VidaMin, Monstros, Itens; public bool Venceu;
            public List<string> Achados = new List<string>();
        }
        public class Resultado
        {
            public string Erro, Semente, Nome, Caminho;
            /// <summary>v266: o que o mapa saiu (a semente de 7 caracteres traz a duracao, a dificuldade e as caixas); -1: nao veio.</summary>
            public int Duracao = -1, Dificuldade = -1, Atos;
            public List<Simulacao> Simulacao = new List<Simulacao>();
        }

        public static string Pasta => Path.Combine(Application.persistentDataPath, "Bigorna", "Oneshot");
        public static string CaminhoDoMapa => Path.Combine(Pasta, "oneshot.dmap");
        /// <summary>v266: a lista dos mapas jogados (Formato.MapasJogados) mora ao lado do mapa.</summary>
        public static void Garantir() { if (string.IsNullOrEmpty(Formato.MapasJogados.Arquivo)) Formato.MapasJogados.Arquivo = Path.Combine(Pasta, "jogados.json"); }

        /// <summary>v266: o mapa que esta em oneshot.dmap agora (a semente e o nome, de oneshot.json); null: nenhum.</summary>
        public class Ficha { public string Semente, Nome; }
        /// <summary>v266: um mapa jogado que terminou com a ultima copia dele (CaminhoDoFim): a tela de titulo pergunta se ele vira mapa novo.</summary>
        public static Ficha FimPendente; public static string CaminhoDoFim;
        public static Ficha Ultimo()
        {
            try
            {
                var f = Path.Combine(Pasta, "oneshot.json");
                if (!File.Exists(f) || !File.Exists(CaminhoDoMapa)) return null;
                var j = JObject.Parse(File.ReadAllText(f, Encoding.UTF8));
                var r = new Ficha { Semente = (string)j["seed"], Nome = (string)j["name"] };
                return string.IsNullOrEmpty(r.Semente) ? null : r;
            }
            catch { return null; }
        }
        public static bool AppInstalado => File.Exists(DadosDoEditor.ArquivoApp);
        public static bool Gerando { get; private set; }
        public static readonly string[] Duracoes = { "curta", "media", "longa" };
        public static readonly string[] Dificuldades = { "facil", "normal", "dificil" };

        /// <summary>As caixas da colecao do jogo: 2 com o Ato II (uma expansao, ou um produto com missoes do Ato II), senao 1.</summary>
        public static int Atos()
        {
            try
            {
                foreach (var p in UserCollectionManager.GetProducts(true))
                {
                    if (p == null) continue;
                    if (p.Type == ProductType.Expansion) return 2;
                    if (!string.IsNullOrEmpty(p.ActName) && p.ActName.IndexOf("II", StringComparison.OrdinalIgnoreCase) >= 0) return 2;
                    if (p.Quests != null && p.Quests.Any(q => q != null && q.Act == Act.ActII)) return 2;
                }
            }
            catch (Exception ex) { Log.Info("mapa oneshot: caixas da coleção " + ex.Message); }
            return 1;
        }

        /// <summary>Pede o mapa ao aplicativo e espera (ate 3 min). semente vazia: uma nova. atoGrupo: o ato da equipe do save (1 ou
        /// 2; 0: equipe nova, vale o ato que o mapa pede), para a vida da simulacao (v261: as cartas do Ato II tem mais vida).</summary>
        public static IEnumerator Gerar(int duracao, int dificuldade, string semente, Action<Resultado> fim, int atoGrupo = 0)
        {
            Gerando = true; var r = new Resultado(); Process pr = null;
            string pedido = Path.Combine(Pasta, "pedido.json"), resposta = Path.Combine(Pasta, "resposta.json");
            int atos = Atos(); float inicio = Time.unscaledTime;
            try
            {
                Directory.CreateDirectory(Pasta); if (File.Exists(resposta)) File.Delete(resposta);
                var j = new JObject { ["duracao"] = Duracoes[Mathf.Clamp(duracao, 0, 2)], ["dificuldade"] = Dificuldades[Mathf.Clamp(dificuldade, 0, 2)], ["atos"] = atos, ["lingua"] = Codigo };   // (v259: a lingua do jogo, qualquer uma: o editor tem as tabelas dos textos do gerador)
                if (!string.IsNullOrEmpty(semente)) j["semente"] = semente;
                if (atoGrupo == 1 || atoGrupo == 2) j["atoGrupo"] = atoGrupo;
                File.WriteAllText(pedido, j.ToString(Formatting.None), new UTF8Encoding(false));
                if (!DadosDoEditor.AppEmDia(true) && AppInstalado) r.Erro = T("O aplicativo Bigorna Editor precisa ser atualizado para gerar o mapa, e está aberto (o arquivo dele fica preso). Fechem o editor e toquem em Gerar de novo.",
                    "The Bigorna Editor app must be updated to make the map, and it is open (its file is locked). Close the editor and tap Generate again.");
                else if (!AppInstalado) r.Erro = T("O aplicativo Bigorna Editor ainda não está instalado. Ele é instalado na tela de título, com o aplicativo fechado; tentem de novo em seguida.",
                    "The Bigorna Editor app is not installed yet. It is installed at the title screen, with the app closed; try again in a moment.");
                else
                {
                    Log.Info("mapa oneshot: gerando (" + j.ToString(Formatting.None) + ")");
                    pr = Process.Start(new ProcessStartInfo(DadosDoEditor.ArquivoApp, "--gerador \"" + pedido + "\" \"" + resposta + "\" --editor \"" + DadosDoEditor.Pasta + "\"")
                    { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = DadosDoEditor.PastaApp });
                }
            }
            catch (Exception ex) { Log.Erro("mapa oneshot: pedido", ex); r.Erro = T("Não consegui chamar o gerador: ", "Could not call the generator: ") + ex.Message; }
            float ate = Time.unscaledTime + 180f;
            while (r.Erro == null && pr != null && !Saiu(pr) && Time.unscaledTime < ate) yield return new WaitForSecondsRealtime(0.25f);
            if (r.Erro == null)
            {
                try
                {
                    if (pr != null && !Saiu(pr)) { try { pr.Kill(); } catch { } r.Erro = T("O gerador não respondeu a tempo.", "The generator did not answer in time."); }
                    else if (!File.Exists(resposta)) r.Erro = T("O gerador não deu resposta (veja bigorna-app.log).", "The generator gave no answer (see bigorna-app.log).");
                    else
                    {
                        var o = JObject.Parse(File.ReadAllText(resposta, Encoding.UTF8));
                        if (o["erro"] != null) r.Erro = T("O gerador não conseguiu fazer o mapa: ", "The generator could not make the map: ") + (string)o["erro"];
                        else
                        {
                            r.Semente = (string)o["semente"]; r.Nome = (string)o["nome"];
                            r.Duracao = Array.IndexOf(Duracoes, (string)o["duracao"] ?? ""); r.Dificuldade = Array.IndexOf(Dificuldades, (string)o["dificuldade"] ?? ""); r.Atos = (int?)o["atos"] ?? 0;
                            r.Caminho = CaminhoDoMapa;
                            File.WriteAllText(r.Caminho, (string)o["dmap"] ?? "", new UTF8Encoding(false));
                            File.WriteAllText(Path.Combine(Pasta, "oneshot.json"), new JObject { ["seed"] = r.Semente, ["name"] = r.Nome }.ToString(Formatting.None), new UTF8Encoding(false));   // (v266: de quem é o oneshot.dmap)
                            foreach (var s in (o["simulacao"] as JArray) ?? new JArray())
                                r.Simulacao.Add(new Simulacao { Herois = (int?)s["herois"] ?? 0, Vida = (int?)s["vida"] ?? 8, Venceu = (bool?)s["venceu"] ?? false, Rodadas = (int?)s["rodadas"] ?? 0, Limite = (int?)s["limite"] ?? 0,
                                    Perda = (int?)s["perda"] ?? 0, VidaMin = (int?)s["vidaMin"] ?? 0, Monstros = (int?)s["monstros"] ?? 0, Itens = (int?)s["itens"] ?? 0,
                                    Achados = ((s["achados"] as JArray) ?? new JArray()).Select(x => (string)x).Where(x => !string.IsNullOrEmpty(x)).ToList() });
                        }
                    }
                }
                catch (Exception ex) { Log.Erro("mapa oneshot: resposta", ex); r.Erro = T("A resposta do gerador não veio inteira: ", "The generator's answer was incomplete: ") + ex.Message; }
            }
            Gerando = false;
            Log.Info("mapa oneshot: " + (r.Erro != null ? "erro: " + r.Erro : "semente " + r.Semente + " («" + r.Nome + "»)") + " em " + (Time.unscaledTime - inicio).ToString("0.0") + " s");
            fim?.Invoke(r);
        }

        static bool Saiu(Process p) { try { return p.HasExited; } catch { return true; } }

        /// <summary>A simulacao em linhas para a tela (TMP, colunas por posicao), como a tabela do editor.</summary>
        public static string TextoDaSimulacao(Resultado r)
        {
            if (r == null || r.Simulacao.Count == 0) return T("Sem simulação.", "No simulation.");
            var sb = new StringBuilder();
            sb.Append("<b>").Append(T("Heróis", "Heroes")).Append("<pos=13%>").Append(T("Venceu", "Won")).Append("<pos=26%>").Append(T("Rodadas", "Rounds"))
              .Append("<pos=40%>").Append(T("Vida perdida", "Health lost")).Append("<pos=58%>").Append(T("Menor vida", "Lowest health"))
              .Append("<pos=75%>").Append(T("Monstros", "Monsters")).Append("<pos=89%>").Append(T("Itens", "Items")).Append("</b>\n");
            foreach (var s in r.Simulacao)
                sb.Append(s.Herois).Append("<pos=13%>").Append(s.Venceu ? T("sim", "yes") : T("não", "no")).Append("<pos=26%>").Append(s.Rodadas).Append(s.Limite > 0 ? " / " + s.Limite : "")
                  .Append("<pos=40%>").Append(s.Perda).Append("%<pos=58%>").Append(s.VidaMin).Append("%<pos=75%>").Append(s.Monstros).Append("<pos=89%>").Append(s.Itens).Append("\n");
            var achados = r.Simulacao.Where(s => s.Achados.Count > 0).Select(s => s.Herois + T(" heróis: ", " heroes: ") + string.Join(", ", s.Achados.ToArray())).ToList();
            if (achados.Count > 0) sb.Append("<size=80%><i>").Append(string.Join(" · ", achados.ToArray())).Append("</i></size>\n");
            // (v261: a vida de cada heroi e a do ato: 8 no Ato I, 11 no Ato II)
            sb.Append("<size=75%>").Append(TF("Um grupo simples joga o mapa pelas regras fáceis (2 sucessos por teste, 2 ações por herói, sem armas nem habilidades especiais, {0} de vida cada), como na simulação do editor.",
                "A plain party plays the map by the easy rules (2 successes per test, 2 actions per hero, no special weapons nor abilities, {0} health each), as in the editor's simulation.", r.Simulacao[0].Vida > 0 ? r.Simulacao[0].Vida : 8)).Append("</size>");
            return sb.ToString();
        }
    }
}
