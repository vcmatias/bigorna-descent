using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Networking;
using static Bigorna.Idioma;

namespace Bigorna.Acervo
{
    /// <summary>
    /// O acervo no jogo, como o do Valkyrie: o indice do repositorio do acervo no GitHub (mapas, campanhas e pacotes da Oficina),
    /// baixar, atualizar e remover. Baixar um mapa traz junto os pacotes que ele exige (os que faltam ou estao numa edicao
    /// mais velha). Sem internet, vale o ultimo indice lido (guardado em Acervo/indice.json). Formato em acervo/FORMATO.md.
    /// </summary>
    public static class Acervo
    {
        static Acervo() { LinguaDosErros.Escolher = T; }   // (os erros do nucleo, que a ficha mostra, na lingua do mod)
        const string EnderecoPadrao = "https://raw.githubusercontent.com/vcmatias/bigorna-acervo/main/";
        static string Pasta => Path.Combine(Application.persistentDataPath, "Acervo");
        static string CaminhoIndice => Path.Combine(Pasta, "indice.json");
        static string CaminhoRegistro => Path.Combine(Pasta, "instalados.json");

        /// <summary>A raiz do acervo; um endereco em Acervo/endereco.txt troca (para testar um acervo de outro lugar).</summary>
        public static string Endereco
        {
            get
            {
                try { var c = Path.Combine(Pasta, "endereco.txt"); if (File.Exists(c)) { var e = File.ReadAllText(c).Trim(); if (e.Length > 0) return e.EndsWith("/") ? e : e + "/"; } } catch { }
                return EnderecoPadrao;
            }
        }

        public static List<Ficha> Itens { get; private set; } = new List<Ficha>();
        public static bool Lendo { get; private set; }
        public static bool Leu { get; private set; }
        public static bool SemConexao { get; private set; }
        /// <summary>O que o acervo esta fazendo agora com cada id ("Baixando…", um erro), para a ficha mostrar.</summary>
        public static readonly Dictionary<string, string> Situacao = new Dictionary<string, string>();
        static Registro _reg;
        public static Registro Registro => _reg ?? (_reg = Registro.Carregar(Migrar()));

        /// <summary>A 0.1.4 guardava o registro em Loja/ (o acervo se chamava loja): ele vem para Acervo/ na primeira leitura.</summary>
        static string Migrar()
        {
            try
            {
                var velho = Path.Combine(Application.persistentDataPath, "Loja", "instalados.json");
                if (!File.Exists(CaminhoRegistro) && File.Exists(velho)) { Directory.CreateDirectory(Pasta); File.Copy(velho, CaminhoRegistro); Log.Info("acervo: registro trazido de Loja/"); }
            }
            catch (Exception ex) { Log.Info("acervo: registro antigo " + ex.Message); }
            return CaminhoRegistro;
        }

        public static IEnumerable<Ficha> Mapas => Itens.Where(f => f.EhMapa);
        public static IEnumerable<Ficha> DePacotes => Itens.Where(f => f.EhPacote);
        public static Ficha Achar(string id) => Itens.FirstOrDefault(f => f.Id == id);

        /// <summary>A edicao instalada (0: nao instalado). Um pacote vale tambem se foi posto a mao em Pacotes/.</summary>
        public static int Instalada(Ficha f)
        {
            var e = Registro.EdicaoDe(f.Id);
            if (e == 0 && f.EhPacote) e = Pacotes.EdicaoInstalada(f.Id);
            return e;
        }

        /// <summary>Os pacotes exigidos que faltam ou estao numa edicao mais velha que a pedida.</summary>
        public static List<Requisito> PacotesParaBaixar(Ficha f) => (f.Requer ?? new List<Requisito>()).Where(q => Pacotes.EdicaoInstalada(q.Id) < q.Edicao).ToList();

        public static string TextoFaltam(List<Requisito> faltam) =>
            T("Para jogar, falta ", "To play it, you need ") + (faltam.Count == 1 ? T("o pacote ", "the package ") : T("os pacotes ", "the packages ")) +
            string.Join(", ", faltam.Select(q => { int tem = Pacotes.EdicaoInstalada(q.Id); return T("«", "“") + (q.Nome ?? q.Id) + T("»", "”") + (tem > 0 ? T(" (edição ", " (edition ") + q.Edicao + T("; você tem a ", "; you have ") + tem + ")" : ""); }).ToArray()) +
            T(", com os monstros, tiles e outras peças que ele usa. Toque em «Baixar pacote» para ir até ele na aba Pacotes.", ", with the monsters, tiles and other pieces it uses. Tap “Get the package” to go to it in the Packages tab.");

        /// <summary>v241: os pacotes exigidos que faltam aqui (ou numa edicao mais velha), de uma lista de requisitos.</summary>
        public static List<Requisito> Faltam(List<Requisito> requer) => (requer ?? new List<Requisito>()).Where(q => Pacotes.EdicaoInstalada(q.Id) < q.Edicao).ToList();

        /// <summary>v241: os pacotes instalados com uma edicao nova no acervo.</summary>
        public static int AtualizacoesDePacotes() => DePacotes.Count(f => { int tem = Instalada(f); return tem > 0 && tem < f.Edicao; });

        /// <summary>Le o indice do acervo (uma vez por abertura da tela, ou de novo pelo botao). Sem conexao, o guardado.</summary>
        public static IEnumerator LerIndice(Action fim)
        {
            if (Lendo) yield break;
            Lendo = true; SemConexao = false;
            using (var req = UnityWebRequest.Get(Endereco + "indice.json"))
            {
                req.SetRequestHeader("User-Agent", "Bigorna/" + Bootstrap.Versao);
                req.SetRequestHeader("Cache-Control", "no-cache");
                req.timeout = 20;
                yield return req.SendWebRequest();
                string texto = null;
                if (req.result == UnityWebRequest.Result.Success) { texto = req.downloadHandler.text; try { Directory.CreateDirectory(Pasta); File.WriteAllText(CaminhoIndice, texto); } catch { } }
                else { SemConexao = true; Log.Info("acervo: não consegui ler o índice (" + req.error + ")"); try { if (File.Exists(CaminhoIndice)) texto = File.ReadAllText(CaminhoIndice); } catch { } }
                try { if (texto != null) Itens = Ficha.DoIndice(texto); }
                catch (Exception ex) { Log.Info("acervo: índice ilegível: " + ex.Message); }
            }
            Lendo = false; Leu = true;
            Log.Info("acervo: " + Itens.Count + " entrada(s) (" + Mapas.Count() + " mapa(s), " + DePacotes.Count() + " pacote(s))" + (SemConexao ? ", sem conexão" : ""));
            fim?.Invoke();
        }

        /// <summary>Baixa e instala uma entrada. v241: um mapa ou campanha so depois dos pacotes que exige (como no Valkyrie: o
        /// jogador baixa antes os pacotes, na aba Pacotes). A ficha da tela se refaz a cada passo.</summary>
        public static IEnumerator Baixar(Ficha f, Action passo)
        {
            if (Situacao.ContainsKey(f.Id) && Situacao[f.Id].EndsWith("…")) yield break;
            if (f.EhMapa && PacotesParaBaixar(f).Count > 0) { Situacao[f.Id] = T("Baixe antes os pacotes que ele exige.", "Download the packages it needs first."); passo?.Invoke(); yield break; }
            var fila = new List<Ficha> { f };
            foreach (var x in fila)
            {
                Situacao[f.Id] = x == f ? T("Baixando…", "Downloading…") : T("Baixando o pacote «", "Downloading the package “") + x.Nome + T("»…", "”…");
                if (x != f) Situacao[x.Id] = T("Baixando…", "Downloading…");
                passo?.Invoke();
                string erro = null; byte[] dados = null;
                using (var req = UnityWebRequest.Get(Endereco + x.Url))
                {
                    req.SetRequestHeader("User-Agent", "Bigorna/" + Bootstrap.Versao);
                    req.timeout = 600;
                    yield return req.SendWebRequest();
                    if (req.result != UnityWebRequest.Result.Success) erro = req.error; else dados = req.downloadHandler.data;
                }
                if (erro == null)
                    try { Instalador.Instalar(dados, x, Bootstrap.PastaMapas, Bootstrap.PastaPacotes, Registro); Log.Info("acervo: instalado «" + x.Nome + "» (" + x.Id + ", edição " + x.Edicao + ")"); }
                    catch (Exception ex) { erro = ex.Message; }
                if (erro != null)
                {
                    Log.Info("acervo: «" + x.Nome + "» não instalou: " + erro);
                    Situacao[f.Id] = T("Não deu: ", "Failed: ") + erro; if (x != f) Situacao.Remove(x.Id);
                    passo?.Invoke(); yield break;
                }
                Situacao.Remove(x.Id);
            }
            Situacao.Remove(f.Id);
            passo?.Invoke();
        }

        public static void Remover(Ficha f)
        {
            try { if (Instalador.Remover(f.Id, Registro)) Log.Info("acervo: removido «" + f.Nome + "» (" + f.Id + ")"); Situacao.Remove(f.Id); }
            catch (Exception ex) { Situacao[f.Id] = T("Não deu: ", "Failed: ") + ex.Message; }
        }

        /// <summary>Os mapas instalados que exigem um pacote (para avisar antes de remover).</summary>
        public static List<string> QuemExige(string idPacote) => Registro.Itens.Where(kv => (kv.Value.Requer ?? new List<Requisito>()).Any(q => q.Id == idPacote)).Select(kv => kv.Value.Nome ?? kv.Key).ToList();
    }
}
