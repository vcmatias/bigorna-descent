using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
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
            var opcoes = d.Tipo == "choice" ? d.Opcoes.Where(o => !string.IsNullOrEmpty(o.Texto)).Take(5).ToList() : new List<Dcamp.Opcao>();
            if (d.Acoes != null && d.Acoes.Count > 0) { var acoes = d.Acoes; d = new Dcamp.Dialogo { Id = d.Id, Tipo = d.Tipo, Personagem = d.Personagem, Titulo = d.Titulo, Texto = d.Texto, Elenco = d.Elenco, Fundo = d.Fundo, Opcoes = d.Opcoes, Seguinte = d.Seguinte, Acoes = new List<JObject>() }; var depoisReal = depois; depois = () => Executar(c, acoes, depoisReal, fundura); }
            if (opcoes.Count > 0)
            {
                Dialogos.Narrativa(d.Texto ?? "", d.Personagem, d.Fundo.ToString(), null, opcoes.Select(o => o.Texto).ToList(),
                    i => { if (i >= 0 && i < opcoes.Count) Executar(c, opcoes[i].Entao, depois, fundura); else depois(); }, d.Elenco, d.Titulo, continua: true);
            }
            else Dialogos.Narrativa(d.Texto ?? "", d.Personagem, d.Fundo.ToString(), depois, null, null, d.Elenco, d.Titulo, continua: true);
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
                        case "removeMaterials": Dialogos.Narrativa("O grupo entrega " + ((int?)a["amount"] ?? 1) + " material(is).", null, null); break;
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
