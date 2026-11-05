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
        static bool _avisouAto2;   // (o quadro pergunta a cada desenho: o registro diz uma vez)
        public static int Atos()
        {
            // (v268: o Ato II conta só com o conteúdo dele marcado na Coleção do jogo: as missões do Ato II entre as possuídas e os
            //  monstros dele também. Antes, um produto qualquer do tipo Expansion ou com "II" no nome bastava: um jogador só com
            //  o Ato I recebia mapas com monstros e escadas do Ato II, e um monstro de fora da coleção travava a fase das trevas
            //  (relato de 04/11/2026: «EnemyModel ENEMY_HARBINGER_SELLSWORD is not owned», GetAllLogicDTTimings quebrando))
            try
            {
                var missoes = UserCollectionManager.GetQuestsByAct(true, Act.ActII);
                if (missoes == null || missoes.Count == 0) return 1;
                var todos = UserCollectionManager.GetProducts(false) ?? new List<ProductModel>();
                var meus = UserCollectionManager.GetProducts(true) ?? new List<ProductModel>();
                // (v295: a caixa do Ato II marcada na Coleção; sem ela, as missões do Ato II que a cópia tiver não bastam: os
                //  monstros dela ficam fora da coleção («not owned») e saem com o nome errado no tabuleiro. Antes, um produto do Ato
                //  II sem missões na lista dele deixava passar)
                if (!meus.Any(p => p != null && p.Act == Act.ActII)) { if (!_avisouAto2) { _avisouAto2 = true; Log.Info("mapa oneshot: a caixa do Ato II está fora da coleção do jogo; só o Ato I"); } return 1; }
                // (o produto que traz as missões do Ato II precisa estar marcado, com os monstros dele)
                var doAto2 = todos.Where(p => p != null && p.Quests != null && p.Quests.Any(q => q != null && q.Act == Act.ActII)).ToList();
                if (doAto2.Count > 0 && !doAto2.Any(p => meus.Contains(p))) return 1;
                foreach (var p in doAto2.Where(x => meus.Contains(x)))
                    foreach (var e in p.Enemies ?? new EnemyModel[0])
                        if (e != null && UserCollectionManager.GetEnemy(e.Id, true) == null) { Log.Info("mapa oneshot: o Ato II está marcado, mas «" + e.Id + "» fica de fora da coleção; só o Ato I"); return 1; }
                return 2;
            }
            catch (Exception ex) { Log.Info("mapa oneshot: caixas da coleção " + ex.Message); }
            return 1;
        }

        /// <summary>v292: os monstros que o gerador pode usar: só os originais, os que as caixas da coleção do jogo trazem
        /// (ProductModel.Enemies dos produtos marcados). O jogo guarda outros modelos que nenhuma caixa usa: sem textos próprios,
        /// o nome deles sai errado no tabuleiro («Remova .», chaves cruas) e o jogo os diz «not owned». Vazia: o jogo não
        /// respondeu, e o gerador fica com a seleção dele.</summary>
        static string Resumo(JObject j) { if (j == null) return ""; var c = (JObject)j.DeepClone(); if (c["monstros"] is JArray m) c["monstros"] = m.Count + " das caixas"; return c.ToString(Formatting.None); }
        public static List<string> MonstrosOriginais()
        {
            var r = new List<string>();
            try
            {
                foreach (var p in UserCollectionManager.GetProducts(true) ?? new List<ProductModel>())
                    foreach (var e in p?.Enemies ?? new EnemyModel[0])
                        if (e != null && !string.IsNullOrEmpty(e.Id) && !r.Contains(e.Id)) r.Add(e.Id);
            }
            catch (Exception ex) { Log.Info("mapa oneshot: monstros das caixas: " + ex.Message); }
            return r;
        }

        /// <summary>Pede o mapa ao aplicativo e espera (ate 3 min). semente vazia: uma nova. atoGrupo: o ato da equipe do save (1 ou
        /// 2; 0: equipe nova, vale o ato que o mapa pede), para a vida da simulacao (v261: as cartas do Ato II tem mais vida).
        /// v272: atosPedidos (1 ou 2) limita as caixas da coleção (a caixa «Usar o Ato II» desmarcada pede 1).</summary>
        public static IEnumerator Gerar(int duracao, int dificuldade, string semente, Action<Resultado> fim, int atoGrupo = 0, int atosPedidos = 0)
        {
            Gerando = true; var r = new Resultado(); Process pr = null;
            // (v274: com o gerador aberto, o pedido vai para a pasta que ele vigia; sem ele, um processo só para este mapa, com
            //  outro nome de pedido, para o aberto nunca pegá-lo)
            // (v278: no Linux, pela ponte do navegador: a página do gerador, aberta no Chrome ou no Chromium, vigia a pasta e
            //  responde; nomes de arquivo só dela, que no Windows ninguém escreve)
            bool ponte = Plataforma.Wine;
            bool aberto = ponte || GeradorAberto();
            string pedido = Path.Combine(Pasta, ponte ? "pedido-navegador.json" : aberto ? "pedido.json" : "pedido-avulso.json"), resposta = Path.Combine(Pasta, ponte ? "resposta-navegador.json" : "resposta.json");
            int atos = Atos(); if (atosPedidos == 1) atos = 1; float inicio = Time.unscaledTime;
            JObject j = null;
            // (o processo de um mapa só; v286: também quando o gerador aberto não responde)
            Process Avulso()
            {
                var pa = Path.Combine(Pasta, "pedido-avulso.json"); File.WriteAllText(pa, j.ToString(Formatting.None), new UTF8Encoding(false));
                Log.Info("mapa oneshot: gerando (" + Resumo(j) + ")");
                return Process.Start(new ProcessStartInfo(DadosDoEditor.ArquivoApp, "--gerador \"" + pa + "\" \"" + resposta + "\" --editor \"" + DadosDoEditor.Pasta + "\"")
                { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = DadosDoEditor.PastaApp });
            }
            try
            {
                Directory.CreateDirectory(Pasta); if (File.Exists(resposta)) File.Delete(resposta);
                j = new JObject { ["duracao"] = Duracoes[Mathf.Clamp(duracao, 0, 2)], ["dificuldade"] = Dificuldades[Mathf.Clamp(dificuldade, 0, 2)], ["atos"] = atos, ["lingua"] = Codigo };   // (v259: a lingua do jogo, qualquer uma: o editor tem as tabelas dos textos do gerador)
                if (!string.IsNullOrEmpty(semente)) j["semente"] = semente;
                if (atoGrupo == 1 || atoGrupo == 2) j["atoGrupo"] = atoGrupo;
                var originais = MonstrosOriginais(); if (originais.Count > 0) j["monstros"] = new JArray(originais.ToArray());   // (v292)
                if (aberto)
                {
                    // (de uma vez: grava ao lado e troca o nome; o gerador nunca lê um pedido pela metade)
                    var tmp = pedido + ".tmp"; File.WriteAllText(tmp, j.ToString(Formatting.None), new UTF8Encoding(false));
                    if (File.Exists(pedido)) File.Delete(pedido); File.Move(tmp, pedido);
                    Log.Info("mapa oneshot: gerando " + (ponte ? "pela ponte do navegador, " + (PonteAtiva ? "conectada" : "ainda sem a página aberta") : "pelo gerador aberto, " + EstadoDoGerador()) + " (" + Resumo(j) + ")");
                }
                else File.WriteAllText(pedido, j.ToString(Formatting.None), new UTF8Encoding(false));
                if (aberto) { }
                else if (!DadosDoEditor.AppEmDia(true) && AppInstalado) r.Erro = T("O aplicativo Bigorna Editor precisa ser atualizado para gerar o mapa, e está aberto (o arquivo dele fica preso). Fechem o editor e toquem em Gerar de novo.",
                    "The Bigorna Editor app must be updated to make the map, and it is open (its file is locked). Close the editor and tap Generate again.");
                else if (!AppInstalado) r.Erro = T("O aplicativo Bigorna Editor ainda não está instalado. Ele é instalado na tela de título, com o aplicativo fechado; tentem de novo em seguida.",
                    "The Bigorna Editor app is not installed yet. It is installed at the title screen, with the app closed; try again in a moment.");
                else pr = Avulso();
            }
            catch (Exception ex) { Log.Erro("mapa oneshot: pedido", ex); r.Erro = T("Não consegui chamar o gerador: ", "Could not call the generator: ") + ex.Message; }
            float ate = Time.unscaledTime + 420f;   // (v271: o editor pronto pode levar 4 min num computador lento, e o mapa mais 1 a 2)
            while (r.Erro == null && pr != null && !Saiu(pr) && Time.unscaledTime < ate) yield return new WaitForSecondsRealtime(0.25f);
            while (r.Erro == null && aberto && !(ponte ? RespostaInteira(resposta) : File.Exists(resposta)) && (ponte || GeradorAberto()) && Time.unscaledTime < ate) yield return new WaitForSecondsRealtime(0.25f);
            // (v286: o gerador aberto caiu ou travou sem responder: o mesmo pedido vai ao processo de um mapa só)
            if (r.Erro == null && aberto && !ponte && !File.Exists(resposta) && !GeradorAberto() && Time.unscaledTime < ate && j != null)
            {
                Log.Info("mapa oneshot: o gerador aberto não respondeu; o mapa vai por um processo só para ele");
                try { File.Delete(pedido); } catch { }
                aberto = false;
                try { pr = Avulso(); } catch (Exception ex) { r.Erro = T("Não consegui chamar o gerador: ", "Could not call the generator: ") + ex.Message; }
                while (r.Erro == null && pr != null && !Saiu(pr) && Time.unscaledTime < ate) yield return new WaitForSecondsRealtime(0.25f);
            }
            if (r.Erro == null && ponte && !RespostaInteira(resposta))
            {
                r.Erro = T("O gerador do navegador não respondeu. Abram no Chrome ou no Chromium o arquivo «Abrir-o-gerador.html» (o caminho está no quadro) e toquem em Gerar de novo.",
                    "The browser generator did not answer. Open the file “Abrir-o-gerador.html” in Chrome or Chromium (the path is in the window) and tap Generate again.");
                try { File.Delete(pedido); } catch { }
            }
            else if (r.Erro == null && aberto && !File.Exists(resposta))
            {
                r.Erro = GeradorAberto() ? T("O gerador não respondeu a tempo.", "The generator did not answer in time.") : T("O gerador fechou antes de responder. Toquem em Gerar de novo.", "The generator closed before answering. Tap Generate again.");
                try { File.Delete(pedido); } catch { }
                if (GeradorAberto()) FecharGerador("sem resposta");
            }
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

        // ------------------------------------------------ v274: o gerador que fica aberto
        // (o mod o abre quando o quadro do mapa oneshot aparece: o motor e a página carregam enquanto o jogador escolhe a equipe,
        //  a duração e a dificuldade; depois, cada mapa leva só o tempo dele. Ele fecha quando a tela de título fica para trás,
        //  quando o jogo fecha, ou sozinho depois de 30 min sem pedido)
        static Process _gerador; static float _abertoEm = -100f;
        static string ArquivoDoGerador => Path.Combine(Pasta, "gerador.json");

        static JObject FichaDoGerador() { try { return File.Exists(ArquivoDoGerador) ? JObject.Parse(File.ReadAllText(ArquivoDoGerador, Encoding.UTF8)) : null; } catch { return null; } }

        /// <summary>O gerador aberto está de pé (o processo que o mod abriu, ou o da ficha gerador.json).</summary>
        public static bool GeradorAberto()
        {
            // (v286: aberto e sem dar sinal (a ficha gerador.json) em 45 s, ele travou antes de começar: fecha, e o mapa vai pelo
            //  processo de um mapa só. Visto em 05/11/2026: o processo ficou de pé sem escrever nada, e o quadro esperava sem fim)
            if (_gerador != null && !Saiu(_gerador) && !File.Exists(ArquivoDoGerador) && Time.unscaledTime - _abertoEm > 45f)
            {
                Log.Info("mapa oneshot: o gerador aberto não deu sinal em 45 s; fechado");
                try { _gerador.Kill(); } catch { }
                _gerador = null; return false;
            }
            if (_gerador != null && !Saiu(_gerador)) return true;
            var f = FichaDoGerador(); int pid = (int?)f?["pid"] ?? 0; if (pid <= 0) return false;
            try { var p = Process.GetProcessById(pid); return !p.HasExited && p.ProcessName.IndexOf("Bigorna", StringComparison.OrdinalIgnoreCase) >= 0; } catch { return false; }
        }
        /// <summary>O estado do gerador aberto para o registro: abrindo, carregando, pronto, gerando.</summary>
        public static string EstadoDoGerador() => (string)FichaDoGerador()?["estado"] ?? (GeradorAberto() ? "abrindo" : "fechado");
        public static bool GeradorPronto => GeradorAberto() && EstadoDoGerador() == "pronto";

        /// <summary>Abre o gerador, se ainda não está aberto (com o aplicativo instalado e em dia). v278: no Linux, só deixa pronto
        /// o arquivo que abre a página do gerador no navegador (o aplicativo não roda lá).</summary>
        public static void AbrirGerador()
        {
            if (Plataforma.Wine) { PrepararPonte(); return; }
            try
            {
                if (GeradorAberto() || Time.unscaledTime - _abertoEm < 15f) return;
                if (!AppInstalado || !DadosDoEditor.AppEmDia(true)) return;
                Directory.CreateDirectory(Pasta);
                foreach (var n in new[] { "sair", "pedido.json", "resposta.json", "gerador.json" }) { try { File.Delete(Path.Combine(Pasta, n)); } catch { } }
                _abertoEm = Time.unscaledTime;
                _gerador = Process.Start(new ProcessStartInfo(DadosDoEditor.ArquivoApp, "--gerador-residente \"" + Pasta + "\" --editor \"" + DadosDoEditor.Pasta + "\" --jogo " + Process.GetCurrentProcess().Id + " --lingua " + Codigo)
                    { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = DadosDoEditor.PastaApp });
                Log.Info("mapa oneshot: gerador aberto ao fundo (" + Codigo + ")");
            }
            catch (Exception ex) { Log.Info("mapa oneshot: o gerador não abriu ao fundo (" + ex.Message + ")"); }
        }

        // ------------------------------------------------ v278: a ponte do navegador (Linux)
        /// <summary>O arquivo que abre a página do gerador no modo de ponte, na língua do jogo (ao lado do editor).</summary>
        public static string ArquivoDaPonte => Path.Combine(DadosDoEditor.Pasta, "Abrir-o-gerador.html");
        /// <summary>A página do gerador está aberta no navegador: ela grava gerador-navegador.json a cada 2 s.</summary>
        public static bool PonteAtiva
        {
            get
            {
                try
                {
                    var f = Path.Combine(Pasta, "gerador-navegador.json"); if (!File.Exists(f)) return false;
                    var j = JObject.Parse(File.ReadAllText(f, Encoding.UTF8)); long q = (long?)j["quando"] ?? 0;
                    long agora = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
                    return Math.Abs(agora - q) < 8000;
                }
                catch { return false; }
            }
        }
        /// <summary>A resposta do navegador já está inteira (o navegador cria o arquivo vazio antes de escrever nele).</summary>
        static bool RespostaInteira(string f) { try { if (!File.Exists(f) || new FileInfo(f).Length == 0) return false; JObject.Parse(File.ReadAllText(f, Encoding.UTF8)); return true; } catch { return false; } }
        public static void PrepararPonte()
        {
            try
            {
                Directory.CreateDirectory(Pasta); Directory.CreateDirectory(DadosDoEditor.Pasta);
                var html = "<!doctype html><meta charset=\"utf-8\"><title>Bigorna</title><script>location.replace('Bigorna-Gerador.html?gerador=1&ponte=1&lingua=" + Codigo + "');</script>"
                    + "<p><a href=\"Bigorna-Gerador.html?gerador=1&amp;ponte=1&amp;lingua=" + Codigo + "\">Bigorna</a></p>";
                if (!File.Exists(ArquivoDaPonte) || File.ReadAllText(ArquivoDaPonte, Encoding.UTF8) != html) File.WriteAllText(ArquivoDaPonte, html, new UTF8Encoding(false));
            }
            catch (Exception ex) { Log.Info("mapa oneshot: ponte do navegador (" + ex.Message + ")"); }
        }
        /// <summary>Tenta abrir a página no navegador do Linux (winebrowser, do Wine, passa ao xdg-open); se não abrir, fica o
        /// caminho no quadro.</summary>
        public static void AbrirPonteNoNavegador()
        {
            PrepararPonte();
            try
            {
                var url = "file://" + Plataforma.CaminhoNoSistema(ArquivoDaPonte);
                Process.Start(new ProcessStartInfo("winebrowser.exe", "\"" + url + "\"") { UseShellExecute = false, CreateNoWindow = true });
                Log.Info("mapa oneshot: ponte do navegador aberta (" + url + ")");
            }
            catch (Exception ex) { Log.Info("mapa oneshot: o navegador não abriu (" + ex.Message + ")"); }
        }

        /// <summary>Pede ao gerador aberto que feche (o arquivo "sair" na pasta que ele vigia).</summary>
        public static void FecharGerador(string porque)
        {
            try
            {
                if (!GeradorAberto()) return;
                File.WriteAllText(Path.Combine(Pasta, "sair"), porque ?? "", new UTF8Encoding(false));
                Log.Info("mapa oneshot: gerador fechando (" + porque + ")");
                _gerador = null;
            }
            catch (Exception ex) { Log.Info("mapa oneshot: fechando o gerador (" + ex.Message + ")"); }
        }

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
