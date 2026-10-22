using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using FFG.D3;
using Bigorna.Formato;
using Newtonsoft.Json.Linq;

namespace Bigorna.Campanha
{
    /// <summary>Toca os dialogos da campanha (quadros narrativos do jogo), encadeando "next" e as escolhas com as suas acoes.</summary>
    public static class Conversa
    {
        const int Fundura = 30;

        /// <summary>Toca uma cena da campanha. As caixas seguem no mesmo quadro (sem voltar a cidade entre uma e outra); o quadro
        /// fecha no fim da cena, antes de um filme ou antes de qualquer outro quadro.</summary>
        public static void Tocar(Dcamp c, Dcamp.Dialogo d, Action fim) => Tocar(c, d, () => { Dialogos.FecharNarrativa(); fim?.Invoke(); }, 0);

        static void Tocar(Dcamp c, Dcamp.Dialogo d, Action fim, int fundura)
        {
            if (d == null || fundura > Fundura) { fim?.Invoke(); return; }
            if (d.SoSe != null && !Progresso.Vale(d.SoSe, Campanha.Estado))
            {
                Log.Info("cena de «" + d.Id + "» pulada: a escolha «" + d.SoSe.Var + "» não confere");
                var pula = c?.DialogoPorId(d.Pular);
                if (pula != null && pula != d) Tocar(c, pula, fim, fundura + 1); else fim?.Invoke();
                return;
            }
            Log.Info("diálogo «" + d.Id + "»" + (string.IsNullOrEmpty(d.Personagem) ? "" : " (" + d.Personagem + ")"));
            var seguinte = c?.DialogoPorId(d.Seguinte);
            Action depois = () => { if (seguinte != null && seguinte != d) Tocar(c, seguinte, fim, fundura + 1); else fim?.Invoke(); };
            if (d.Tipo == "video")
            {
                var acoesV = d.Acoes; string arq = null;
                try { arq = System.IO.Path.Combine(c?.Pasta ?? "", System.IO.Path.GetFileName(d.Video ?? "")); } catch { }
                Dialogos.FecharNarrativa();
                Encontro.VideoProprio.Tocar(arq, () => { if (acoesV != null && acoesV.Count > 0) Executar(c, acoesV, depois, fundura); else depois(); });
                return;
            }
            if (d.Tipo == "cutscene")
            {
                var filme = d.Cena; var acoesF = d.Acoes;
                Dialogos.FecharNarrativa();
                Encontro.Cinematica.Tocar(filme, () => { if (acoesF != null && acoesF.Count > 0) Executar(c, acoesF, depois, fundura); else depois(); });
                return;
            }
            d = HeroisDoGrupo(d);
            var opcoes = d.Tipo == "choice" ? d.Opcoes.Where(o => !string.IsNullOrEmpty(o.Texto)).Take(5).ToList() : new List<Dcamp.Opcao>();
            if (d.Acoes != null && d.Acoes.Count > 0) { var acoes = d.Acoes; d = new Dcamp.Dialogo { Id = d.Id, Tipo = d.Tipo, Personagem = d.Personagem, Titulo = d.Titulo, Texto = d.Texto, Elenco = d.Elenco, Fundo = d.Fundo, Opcoes = d.Opcoes, Seguinte = d.Seguinte, Acoes = new List<JObject>() }; var depoisReal = depois; depois = () => Executar(c, acoes, depoisReal, fundura); }
            if (opcoes.Count > 0)
            {
                Dialogos.Narrativa(d.Texto ?? "", d.Personagem, d.Fundo.ToString(), null, opcoes.Select(o => o.Texto).ToList(),
                    i => { if (i >= 0 && i < opcoes.Count) Executar(c, opcoes[i].Entao, depois, fundura); else depois(); }, d.Elenco, d.Titulo, continua: true);
            }
            else Dialogos.Narrativa(d.Texto ?? "", d.Personagem, d.Fundo.ToString(), depois, null, null, d.Elenco, d.Titulo, continua: true);
        }

        /// <summary>Os herois do grupo nas cenas da campanha: "@hero1".."@hero4" (quem fala ou quem aparece) sao o primeiro, o segundo...
        /// heroi do grupo, sempre os mesmos; com menos herois, o 3 fala como o 1 e o 4 como o 2 (com tres, o 4 como o 1); "{hero1}"..
        /// "{hero4}" no texto viram o nome deles. As cenas dos gatilhos ja chegam aqui com os herois sorteados.</summary>
        static Dcamp.Dialogo HeroisDoGrupo(Dcamp.Dialogo d)
        {
            bool tem(string x) => !string.IsNullOrEmpty(x) && (x.IndexOf("@hero", StringComparison.OrdinalIgnoreCase) >= 0 || x.IndexOf("{hero", StringComparison.OrdinalIgnoreCase) >= 0 || x.IndexOf("@actor", StringComparison.OrdinalIgnoreCase) >= 0 || x.IndexOf("{actor}", StringComparison.OrdinalIgnoreCase) >= 0);
            if (!tem(d.Personagem) && !tem(d.Texto) && !tem(d.Titulo) && !(d.Elenco ?? new List<string>()).Any(tem) && !(d.Opcoes ?? new List<Dcamp.Opcao>()).Any(o => tem(o.Texto))) return d;
            List<SerializedPlayer> hs; try { hs = Jogo.Herois; } catch { hs = new List<SerializedPlayer>(); }
            int Vaga(int n) => hs.Count == 0 ? -1 : (Math.Max(1, n) - 1) % hs.Count;
            string Id(string quem)
            {
                if (string.IsNullOrEmpty(quem)) return quem;
                int n;
                if (string.Equals(quem, "@actor", StringComparison.OrdinalIgnoreCase)) n = 1;
                else if (!quem.StartsWith("@hero", StringComparison.OrdinalIgnoreCase) || !int.TryParse(quem.Substring(5), out n)) return quem;
                int v = Vaga(n); return v < 0 ? null : "STORY_CHARACTER_VARIABLE_HERO" + (v + 1);
            }
            string Nome(int n) { int v = Vaga(n); if (v < 0) return Idioma.T("o herói", "the hero"); try { return Encontro.Herois.NomeDe(hs[v]); } catch { return Idioma.T("o herói", "the hero"); } }
            string Texto(string t)
            {
                if (string.IsNullOrEmpty(t)) return t;
                t = System.Text.RegularExpressions.Regex.Replace(t, @"\{actor\}", m => Nome(1), System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                return System.Text.RegularExpressions.Regex.Replace(t, @"\{hero(\d)\}", m => Nome(int.Parse(m.Groups[1].Value)), System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            }
            var quem0 = Id(d.Personagem);
            var copia = new Dcamp.Dialogo
            {
                Id = d.Id, Tipo = d.Tipo, Personagem = quem0, Titulo = Texto(d.Titulo), Texto = Texto(d.Texto), Fundo = d.Fundo, Seguinte = d.Seguinte, Acoes = d.Acoes,
                Elenco = (d.Elenco ?? new List<string>()).Select(Id).Where(x => !string.IsNullOrEmpty(x) && x != quem0).Distinct().ToList(),
                Opcoes = (d.Opcoes ?? new List<Dcamp.Opcao>()).Select(o => new Dcamp.Opcao { Texto = Texto(o.Texto), Entao = o.Entao }).ToList()
            };
            return copia;
        }

        /// <summary>As acoes de uma resposta: liberar/completar nos, mostrar outro dialogo, dar itens ou materiais, variaveis.</summary>
        static void Executar(Dcamp c, List<JObject> acoes, Action depois, int fundura)
        {
            var fila = new Queue<JObject>((acoes ?? new List<JObject>()).Where(x => x != null));
            void Proxima()
            {
                if (fila.Count == 0) { depois?.Invoke(); return; }
                var a = fila.Dequeue();
                string que = (string)a["action"] ?? "";
                try
                {
                    switch (que)
                    {
                        case "unlockNode": Campanha.Liberar((string)a["node"]); break;
                        case "completeNode": Campanha.CompletarPorAcao((string)a["node"]); break;
                        case "showDialogue":
                        {
                            var d = c?.DialogoPorId((string)a["dialogue"]);
                            if (d != null) { Tocar(c, d, Proxima, fundura + 1); return; }
                            break;
                        }
                        case "giveItem": Campanha.DarItem((string)a["item"], (int?)a["qty"] ?? 1); break;
                        case "giveMaterials": Campanha.DarMateriais((int?)a["n"] ?? (int?)a["amount"] ?? 1); break;
                        case "removeMaterials": Dialogos.Narrativa(Idioma.TF("O grupo entrega {0} material(is).", "The party hands over {0} material(s).", ((int?)a["amount"] ?? 1)), null, null); break;
                        case "setVar": Campanha.Estado?.PorVar((string)a["var"], (int?)a["value"] ?? 1); break;
                        case "addVar": { var v = (string)a["var"]; Campanha.Estado?.PorVar(v, (Campanha.Estado?.Var(v) ?? 0) + ((int?)a["value"] ?? 1)); break; }
                        default: Log.Info("  ação de campanha desconhecida: " + que); break;
                    }
                }
                catch (Exception ex) { Log.Erro("ação «" + que + "»", ex); }
                Proxima();
            }
            Proxima();
        }
    }
}
