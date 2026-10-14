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
            T("Este mapa precisa ", "This map needs ") + (faltam.Count == 1 ? T("do pacote ", "the package ") : T("dos pacotes ", "the packages ")) +
            string.Join(", ", faltam.Select(q => "«" + (q.Nome ?? q.Id) + "»").ToArray()) +
            T(". Baixe na aba Pacotes (ou baixe o mapa de novo pelo acervo, que ele vem junto).", ". Download it in the Packages tab (or download the map again from the community library: it comes along).");

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

        /// <summary>Baixa e instala uma entrada; de um mapa, antes os pacotes que ele exige. A ficha da tela se refaz a cada passo.</summary>
        public static IEnumerator Baixar(Ficha f, Action passo)
        {
            if (Situacao.ContainsKey(f.Id) && Situacao[f.Id].EndsWith("…")) yield break;
            var fila = new List<Ficha>();
            foreach (var q in f.EhMapa ? PacotesParaBaixar(f) : new List<Requisito>())
            {
                var pk = Achar(q.Id);
                if (pk == null || pk.Edicao < q.Edicao) { Situacao[f.Id] = T("O acervo não tem o pacote «", "The community library does not have the package «") + (q.Nome ?? q.Id) + "» (" + T("edição ", "edition ") + q.Edicao + ")"; passo?.Invoke(); yield break; }
                fila.Add(pk);
            }
            fila.Add(f);
            foreach (var x in fila)
            {
                Situacao[f.Id] = x == f ? T("Baixando…", "Downloading…") : T("Baixando o pacote «", "Downloading the package «") + x.Nome + "»…";
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
