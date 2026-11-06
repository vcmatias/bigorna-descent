using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Bigorna.Encontro;
using Bigorna.Formato;
using Bigorna.Motor;
using FFG.D3;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Bigorna.Menu
{
    /// <summary>v268: o canal de teste, para uma IA (ou um script) jogar e conferir o mod sem clicar na tela. Fica desligado; liga
    /// com o arquivo Bigorna\Teste\ativo (na pasta de dados do jogo, ao lado de Bigorna\Oneshot) com algo escrito, e desliga
    /// quando ele sai ou fica vazio.
    /// Ligado:
    /// - estado.json: a cena, o mapa, a rodada, o objetivo, os herois, os monstros, os objetos, as salas fechadas, o quadro aberto
    ///   (o do mod e o do jogo, com os textos e os botoes), reescrito a cada segundo;
    /// - transcricao.txt: cada texto que o mod mostra a mesa (avisos, cenas, escolhas, testes, o objetivo), com a hora e a rodada;
    /// - comandos.jsonl: uma linha JSON por comando, {"id": "1", "cmd": "...", ...}; a resposta sai em respostas.jsonl, com o
    ///   mesmo id. Os comandos usam os botoes e os metodos que o jogador e o modo de teste (F7) usam:
    ///   estado · botoes · clicar {texto | caminho, n} · digitar {texto, campo} · usar {indice, heroi}
    ///   · abrirSala {grupo} · derrotarTodos · derrotar {guid} · vencer · testesPassam {valor} · acao {acao, params}
    ///   · gatilho {gatilho: o id do gatilho do mapa, semCondicoes} · anotar {texto}.
    /// v300 (atalhos, espera, velocidade, confiança; nada disso roda com o canal desligado):
    ///   mapas · abrirMapa {mapa: arquivo ou nome, herois: [ids ou nomes]} · herois {herois} (a próxima escolha de heróis do mod
    ///   fica feita) · recomecar · abandonar · fimDaRodada (o botão do jogo) · variaveis · variavel {nome, valor}
    ///   · responder {n | texto} (o quadro do mod aberto) · aguardar {ate, valor, segundos} (a resposta só sai quando a condição
    ///   vale, ou "esgotado": ate = livre | noMapa | titulo | cena | rodada | quadro | semQuadro | transcricao | resultado)
    ///   · velocidade {valor: 1 a 4} · pularCenas {valor} · captura {nome}.
    ///   Só uma instância do jogo usa o canal (o arquivo "trava" fica preso por ela); o estado sai inteiro (arquivo temporário e
    ///   troca), com o quadro e a hora do jogo (para ver se ele travou); os erros do registro do jogo vão para a transcrição.</summary>
    public static class CanalDeTeste
    {
        public static string Pasta => Path.Combine(Application.persistentDataPath, "Bigorna", "Teste");
        static string Arq(string nome) => Path.Combine(Pasta, nome);
        public static bool Ligado { get; private set; }
        static float _proximaChecagem, _proximoEstado;
        static long _lidos;
        static readonly StringBuilder _buffer = new StringBuilder();
        static FileStream _trava; static bool _avisouTrava;
        /// <summary>v300: os heróis da próxima escolha do mod (Herois.Escolher): com eles, a tela de escolha não abre.</summary>
        public static List<string> HeroisPedidos;
        /// <summary>v300: com o canal ligado, as cenas do jogo e os vídeos próprios são pulados (o que vem depois deles segue).</summary>
        public static bool PularCenas => Ligado && _pularCenas;
        static bool _pularCenas;
        class Espera { public JToken Id; public string Ate, Valor; public float Limite; public int Linhas; public JObject Pedido; }
        static readonly List<Espera> _esperas = new List<Espera>();
        static int _linhasAnotadas;
        static readonly List<string> _recentes = new List<string>();

        /// <summary>No batimento do mod: liga e desliga pelo arquivo, le os comandos novos e reescreve o estado.</summary>
        public static void Batimento()
        {
            float agora = Time.unscaledTime;
            if (agora >= _proximaChecagem)
            {
                _proximaChecagem = agora + 2f;
                bool deve = false; try { deve = TamanhoDe(Arq("ativo")) > 0; } catch { }   // (vazio = desligado: quem não pode apagar arquivos o esvazia)
                if (deve != Ligado)
                {
                    if (deve && !Prender()) deve = false;   // (v300: outra instância do jogo já usa o canal)
                    if (deve != Ligado)
                    {
                        Ligado = deve;
                        if (Ligado) { _lidos = TamanhoDe(Arq("comandos.jsonl")); Application.logMessageReceived += DoRegistro; Log.Info("canal de teste ligado (" + Pasta + ")"); Anotar("canal", "ligado"); }
                        else Desligar();
                    }
                }
            }
            if (!Ligado) return;
            Descarregar();
            LerComandos();   // (v301: também gravando; os comandos que mexem no jogo esperam a gravação, os de olhar respondem)
            if (_esperas.Count > 0) Esperas();
            if (agora >= _proximoEstado)
            {
                _proximoEstado = agora + 1f;
                try { GravarInteiro(Arq("estado.json"), Estado().ToString(Formatting.Indented)); } catch (Exception ex) { Log.Info("canal de teste: estado: " + ex.Message); }
                // (os quadros do proprio jogo tambem vao para a transcricao, os do mod ja foram quando abriram)
                try
                {
                    var qj = Dialogos.Ocupado ? null : QuadroDoJogo(); var assin = qj?["textos"]?.ToString(Formatting.None);
                    if (assin != _ultimoDoJogo) { _ultimoDoJogo = assin; if (qj != null) Anotar("jogo:" + (string)qj["tipo"], string.Join(" / ", qj["textos"].Select(t => (string)t).ToArray()), null, qj["botoes"].Select(t => (string)t).ToList()); }
                }
                catch { }
            }
        }
        static string _ultimoDoJogo;

        /// <summary>v300: a trava da instância: o arquivo "trava" aberto sem partilha enquanto o canal está ligado. A segunda
        /// instância do jogo não consegue abri-lo e fica de fora (antes, as duas liam os mesmos comandos).</summary>
        static bool Prender()
        {
            if (_trava != null) return true;
            try
            {
                Directory.CreateDirectory(Pasta);
                _trava = new FileStream(Arq("trava"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                _trava.SetLength(0); var b = Encoding.UTF8.GetBytes(System.Diagnostics.Process.GetCurrentProcess().Id + "\n"); _trava.Write(b, 0, b.Length); _trava.Flush();
                _avisouTrava = false; return true;
            }
            catch (Exception ex)
            {
                _trava = null;
                if (!_avisouTrava) { _avisouTrava = true; Log.Info("canal de teste: outra instância do jogo já usa o canal; esta fica de fora (" + ex.Message + ")"); }
                return false;
            }
        }

        static void Desligar()
        {
            Application.logMessageReceived -= DoRegistro;
            try { _trava?.Dispose(); } catch { } _trava = null;
            if (Mathf.Abs(Time.timeScale - _velocidade) < 0.01f && _velocidade != 1f) Time.timeScale = 1f;
            _velocidade = 1f; _pularCenas = false; HeroisPedidos = null; _esperas.Clear(); _errosVistos.Clear();
            Log.Info("canal de teste desligado");
        }

        /// <summary>v300: os erros e exceções do registro do jogo (e do mod) vão para a transcrição, com a primeira linha da pilha.</summary>
        static void DoRegistro(string texto, string pilha, LogType tipo)
        {
            if (tipo != LogType.Error && tipo != LogType.Exception && tipo != LogType.Assert) return;
            try
            {
                // (v301: o mesmo erro só uma vez por ligação do canal; o jogo repete alguns aos montes, como o «EntityManager … GUID»)
                var chave = System.Text.RegularExpressions.Regex.Replace(texto ?? "", @"\d+|\([^)]*\)", "#");
                _errosVistos.TryGetValue(chave, out var n); _errosVistos[chave] = n + 1;
                if (n == 1) Anotar("erro", "(o erro acima se repete; as próximas vezes ficam fora da transcrição)");
                if (n > 0) return;
                var l1 = (pilha ?? "").Split('\n').FirstOrDefault(x => x.Trim().Length > 0) ?? ""; Anotar("erro", texto + (l1.Length > 0 ? " @ " + l1.Trim() : ""));
            }
            catch { }
        }

        /// <summary>v300: um arquivo gravado inteiro: o texto vai para um temporário e troca de lugar com o antigo (quem lê nunca o
        /// pega pela metade).</summary>
        static void GravarInteiro(string p, string texto)
        {
            var tmp = p + ".tmp"; File.WriteAllText(tmp, texto, new UTF8Encoding(false));
            if (File.Exists(p)) File.Replace(tmp, p, null); else File.Move(tmp, p);
        }

        static long TamanhoDe(string p) { try { return File.Exists(p) ? new FileInfo(p).Length : 0; } catch { return 0; } }

        // ------------------------------------------------------------ transcricao

        /// <summary>Um texto que a mesa viu (o tipo: aviso, cena, escolha, teste, objetivo, teste do F7…).</summary>
        public static void Anotar(string tipo, string texto, string titulo = null, IList<string> opcoes = null)
        {
            if (!Ligado || string.IsNullOrEmpty(texto) && string.IsNullOrEmpty(titulo)) return;
            var linha = new StringBuilder();
            linha.Append(DateTime.Now.ToString("HH:mm:ss")).Append(" r").Append(Jogo.Rodada).Append(" [").Append(tipo).Append("] ");
            if (!string.IsNullOrEmpty(titulo)) linha.Append("«").Append(Limpo(titulo)).Append("» ");
            linha.Append(Limpo(texto));
            if (opcoes != null && opcoes.Count > 0) linha.Append(" {").Append(string.Join(" | ", opcoes.Select(Limpo).ToArray())).Append("}");
            var l = linha.ToString();
            lock (_buffer) { _buffer.AppendLine(l); _linhasAnotadas++; _recentes.Add(l); if (_recentes.Count > 200) _recentes.RemoveAt(0); }
        }

        static void Descarregar()
        {
            string t; lock (_buffer) { if (_buffer.Length == 0) return; t = _buffer.ToString(); _buffer.Length = 0; }
            try { File.AppendAllText(Arq("transcricao.txt"), t, new UTF8Encoding(false)); } catch { }
        }

        static string Limpo(string t) => System.Text.RegularExpressions.Regex.Replace((t ?? "").Replace("<br>", " / "), "<[^>]+>", "").Replace("\r", "").Replace("\n", " / ").Trim();

        // ------------------------------------------------------------ comandos

        static void LerComandos()
        {
            var p = Arq("comandos.jsonl"); long tam = TamanhoDe(p);
            if (tam < _lidos) _lidos = 0;                 // (o arquivo foi recomecado)
            if (tam == _lidos) return;
            string novo;
            try
            {
                using (var f = new FileStream(p, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                {
                    f.Seek(_lidos, SeekOrigin.Begin);
                    var bytes = new byte[tam - _lidos]; int n = 0; while (n < bytes.Length) { int r = f.Read(bytes, n, bytes.Length - n); if (r <= 0) break; n += r; }
                    novo = Encoding.UTF8.GetString(bytes, 0, n);
                    // (so as linhas inteiras: a ultima pode estar sendo escrita)
                    int fim = novo.LastIndexOf('\n'); if (fim < 0) return;
                    novo = novo.Substring(0, fim + 1); _lidos += Encoding.UTF8.GetByteCount(novo);
                }
            }
            catch (Exception ex) { Log.Info("canal de teste: lendo comandos: " + ex.Message); return; }
            foreach (var linha in novo.Split('\n'))
            {
                var l = linha.Trim().TrimStart('﻿'); if (l.Length == 0) continue;
                JObject c = null, r;
                try { c = JObject.Parse(l); r = Executar(c); }
                catch (Exception ex) { r = new JObject { ["ok"] = false, ["erro"] = ex.Message }; }
                if (r == null) continue;   // (v300: «aguardar»: a resposta sai quando a condição valer)
                Responder(c, r);
            }
        }

        static void Responder(JObject c, JObject r)
        {
            r["id"] = c?["id"]; r["cmd"] = c?["cmd"]; r["quadro"] = Time.frameCount;
            try { File.AppendAllText(Arq("respostas.jsonl"), r.ToString(Formatting.None) + "\n", new UTF8Encoding(false)); } catch { }
            Log.Info("canal de teste: " + (string)c?["cmd"] + " → " + ((bool?)r["ok"] == true ? "ok" : (string)r["erro"]));
        }

        static JObject Ok(JToken resultado = null) => new JObject { ["ok"] = true, ["resultado"] = resultado };
        static JObject Erro(string e) => new JObject { ["ok"] = false, ["erro"] = e };

        static JObject Executar(JObject c)
        {
            var cmd = ((string)c["cmd"] ?? "").Trim();
            bool noMapa = Jogo.EmEncontro && Roteiro.EmMarcha;
            // (v301: com o jogo gravando, só os comandos de olhar; antes o canal não lia nada, e uma gravação presa o deixava surdo)
            if (Jogo.Salvando && !SoOlhar.Contains(cmd)) return Erro("o jogo está gravando: só respondem " + string.Join(", ", SoOlhar.ToArray()));
            switch (cmd)
            {
                case "estado": return Ok(Estado());
                case "botoes": return Ok(new JArray(Botoes().Select((b, i) => new JObject { ["n"] = i, ["texto"] = b.texto, ["caminho"] = b.caminho, ["ativo"] = b.ativo })));
                case "clicar":
                {
                    var lista = Botoes(); var texto = (string)c["texto"]; var caminho = (string)c["caminho"]; int? n = (int?)c["n"];
                    var achados = n.HasValue && texto == null && caminho == null ? lista.Skip(n.Value).Take(1).ToList()
                        : lista.Where(b => (caminho == null || string.Equals(b.caminho, caminho, StringComparison.Ordinal)) && (texto == null || Casa(b.texto, texto))).ToList();
                    if (achados.Count == 0) return Erro("nenhum botão assim (veja «botoes»)");
                    var alvo = achados[Math.Min(achados.Count - 1, texto != null || caminho != null ? (n ?? 0) : 0)];
                    if (!alvo.ativo) return Erro("o botão «" + alvo.texto + "» está desligado");
                    Clicar(alvo.go); Anotar("clique", alvo.texto); return Ok(alvo.texto);
                }
                case "digitar":
                {
                    var campos = UnityEngine.Object.FindObjectsOfType<TMP_InputField>().Where(f => f.isActiveAndEnabled && f.interactable).ToList();
                    var nome = (string)c["campo"]; var f0 = nome == null ? campos.FirstOrDefault() : campos.FirstOrDefault(f => Casa(f.name, nome) || Casa(f.placeholder is TMP_Text ph ? ph.text : "", nome));
                    if (f0 == null) return Erro("nenhum campo de texto na tela");
                    f0.text = (string)c["texto"] ?? ""; f0.onValueChanged?.Invoke(f0.text); f0.onEndEdit?.Invoke(f0.text); f0.onSubmit?.Invoke(f0.text);
                    return Ok(f0.name);
                }
                case "usar":
                {
                    if (!noMapa) return Erro("fora de um mapa do Bigorna");
                    if (Depuracao.Ocupado()) return Erro("o jogo está ocupado (gravando, pondo monstros ou com um quadro aberto)");
                    var o = Objetos.Pegar((int?)c["indice"] ?? -1); if (o == null) return Erro("objeto inexistente");
                    var hid = (string)c["heroi"]; SerializedPlayer h = hid == null ? null : Jogo.Herois.FirstOrDefault(x => Casa(x.HeroId, hid) || Casa(Herois.NomeDe(x), hid));
                    if (hid != null && h == null) return Erro("herói inexistente");
                    if (h != null) Objetos.Usar(o, h); else Objetos.Usar(o.Indice);
                    return Ok(o.Rotulo);
                }
                case "abrirSala":
                {
                    if (!noMapa) return Erro("fora de um mapa do Bigorna");
                    var f = Depuracao.Fechadas(); var g = (string)c["grupo"];
                    var s = g == null ? f.FirstOrDefault() : f.FirstOrDefault(x => string.Equals(x.grupo, g, StringComparison.OrdinalIgnoreCase));
                    if (s.grupo == null) return Erro(f.Count == 0 ? "todas as salas estão abertas" : "sala fechada inexistente");
                    Depuracao.Abrir(s.grupo, s.g); return Ok(s.grupo);
                }
                case "derrotarTodos": if (!noMapa) return Erro("fora de um mapa do Bigorna"); Depuracao.DerrotarTodos((int?)c["heroi"] ?? -1); return Ok();
                case "derrotar":
                {
                    if (!noMapa) return Erro("fora de um mapa do Bigorna");
                    var e = Jogo.Inimigos.FirstOrDefault(x => string.Equals(x.GUID, (string)c["guid"], StringComparison.OrdinalIgnoreCase)); if (e == null) return Erro("monstro inexistente");
                    var quem = Acoes.DerrotarPorHeroi(e, (int?)c["heroi"] ?? 0); return quem == null ? Erro("não deu para derrotar") : Ok(Inimigos.NomeDoInimigo(e) + " por " + quem);   // (v277: pelas mãos de um herói, o índice em «heroi»)
                }
                case "vencer": if (!noMapa) return Erro("fora de um mapa do Bigorna"); Roteiro.Completar(true); return Ok();
                case "testesPassam": Depuracao.TestesPassam = (bool?)c["valor"] ?? true; if (!Depuracao.Ligada) Depuracao.Alternar(); return Ok(Depuracao.TestesPassam);
                case "acao":
                {
                    if (!noMapa) return Erro("fora de um mapa do Bigorna");
                    var a = new Dmap.Clausula { Id = (string)c["acao"] };
                    if (c["params"] is JObject po) a.Params = po.ToObject<Dictionary<string, object>>();
                    Acoes.Executar(new List<Dmap.Clausula> { a }, null); return Ok(a.Id);
                }
                case "gatilho":
                {
                    if (!noMapa) return Erro("fora de um mapa do Bigorna");
                    var g = Roteiro.Mapa?.Gatilhos?.FirstOrDefault(x => string.Equals(x.Id, (string)c["gatilho"], StringComparison.OrdinalIgnoreCase));
                    if (g == null) return Erro("gatilho inexistente (use «gatilho»: o id)");
                    return Ok(Roteiro.Executar(g, true, (bool?)c["semCondicoes"] ?? false));
                }
                // ------------------------------------------------ v300: atalhos
                case "mapas": return Ok(new JArray(ArquivosDeMapa().Select(f => Path.GetFileNameWithoutExtension(f))));
                case "abrirMapa":
                {
                    if (Jogo.EmEncontro || Lancador.Preparando) return Erro("já há um mapa em jogo (use «abandonar» ou «recomecar»)");
                    var arq = AcharMapa((string)c["mapa"]); if (arq == null) return Erro("mapa inexistente (veja «mapas»)");
                    Dmap m; try { m = Dmap.Carregar(arq); } catch (Exception ex) { return Erro("o mapa não abriu: " + ex.Message); }
                    HeroisPedidos = Lista(c["herois"]);
                    var e = Lancador.Lancar(m); if (e != null) { HeroisPedidos = null; return Erro(e); }
                    return Ok(m.NomeVisivel);
                }
                case "herois": HeroisPedidos = Lista(c["herois"]); return Ok(HeroisPedidos == null ? null : new JArray(HeroisPedidos));
                case "recomecar":
                {
                    var m = Lancador.Atual; if (m == null || !Jogo.EmEncontro) return Erro("nenhum mapa em jogo");
                    HeroisPedidos = Jogo.Herois.Select(h => h.HeroId).ToList();
                    try { Dialogos.Limpar(); } catch { }
                    var e = Lancador.Lancar(m); if (e != null) { HeroisPedidos = null; return Erro(e); }
                    return Ok(m.NomeVisivel);
                }
                case "abandonar":
                {
                    if (!Jogo.EmEncontro) return Erro("nenhum mapa em jogo");
                    try { Dialogos.Limpar(); } catch { }
                    try { Roteiro.Parar(); } catch { }
                    Jogo.Carregador.LoadTitlescreen(false, false, false); return Ok();
                }
                case "fimDaRodada":
                {
                    if (!noMapa) return Erro("fora de um mapa do Bigorna");
                    if (Depuracao.Ocupado()) return Erro("o jogo está ocupado (gravando, pondo monstros ou com um quadro aberto)");
                    var gc = Jogo.Controle; if (gc == null || gc.IsEndingRound) return Erro("a rodada já está terminando");
                    gc.EndRound(); return Ok(Jogo.Rodada);
                }
                case "variaveis": return Ok(JObject.FromObject(Roteiro.Vars.ToDictionary(k => k.Key, k => k.Value)));
                case "variavel":
                {
                    var nome = (string)c["nome"]; if (string.IsNullOrEmpty(nome)) return Erro("falta o «nome»");
                    if (c["valor"] != null) { Roteiro.Vars[nome] = (int)c["valor"]; Anotar("canal", "variável " + nome + " = " + (int)c["valor"]); }
                    return Ok(Roteiro.Vars.TryGetValue(nome, out var v) ? (JToken)v : null);
                }
                case "responder":
                {
                    var q = Dialogos.Descrever(); if (q == null) return Erro("nenhum quadro do mod aberto");
                    var ops = (q["opcoes"] as JArray)?.Select(x => (string)x).ToList() ?? new List<string>();
                    if (ops.Count == 0) return Erro("o quadro aberto não tem opções (use «clicar»)");
                    int i = c["n"] != null ? (int)c["n"] : ops.FindIndex(x => Casa(x, (string)c["texto"]));
                    if (i < 0 || i >= ops.Count) return Erro("opção inexistente: " + string.Join(" | ", ops.ToArray()));
                    var alvo = Botoes().FirstOrDefault(b => b.ativo && Limpo(b.texto) == Limpo(ops[i]));
                    if (alvo.go == null) return Erro("o botão da opção «" + ops[i] + "» não está na tela");
                    Clicar(alvo.go); Anotar("clique", ops[i]); return Ok(ops[i]);
                }
                // ------------------------------------------------ v300: esperar no próprio mod
                case "aguardar":
                {
                    var ate = ((string)c["ate"] ?? "livre").Trim();
                    if (!CondicoesDeEspera.Contains(ate)) return Erro("«ate» desconhecido: " + string.Join(", ", CondicoesDeEspera.ToArray()));
                    var w = new Espera { Id = c["id"], Ate = ate, Valor = (string)c["valor"], Limite = Time.unscaledTime + Mathf.Clamp((float?)c["segundos"] ?? 60f, 0.5f, 900f), Linhas = _linhasAnotadas, Pedido = c };
                    if (Vale(w)) return Ok(Situacao());
                    _esperas.Add(w); return null;
                }
                // ------------------------------------------------ v300: mais rápido na tela
                case "velocidade":
                {
                    float v = Mathf.Clamp((float?)c["valor"] ?? 1f, 1f, 4f); _velocidade = v; Time.timeScale = v;
                    Anotar("canal", "velocidade " + v); return Ok(v);
                }
                case "pularCenas": _pularCenas = (bool?)c["valor"] ?? true; Anotar("canal", "pular cenas: " + _pularCenas); return Ok(_pularCenas);
                case "captura":
                {
                    var nome = Path.GetFileName((string)c["nome"] ?? ("captura-" + DateTime.Now.ToString("HHmmss"))); if (!nome.EndsWith(".png", StringComparison.OrdinalIgnoreCase)) nome += ".png";
                    var arq = Arq(nome); try { if (File.Exists(arq)) File.Delete(arq); } catch { }
                    ScreenCapture.CaptureScreenshot(arq); return Ok(arq);   // (o arquivo sai no fim do quadro)
                }
                case "anotar": Anotar("nota", (string)c["texto"]); return Ok();
                default: return Erro("comando desconhecido: " + cmd);
            }
        }

        static bool Casa(string a, string b) => !string.IsNullOrEmpty(a) && !string.IsNullOrEmpty(b) && Limpo(a).IndexOf(b.Trim(), StringComparison.OrdinalIgnoreCase) >= 0;

        // ------------------------------------------------------------ v300: apoio dos atalhos e das esperas

        static float _velocidade = 1f;
        static readonly List<string> SoOlhar = new List<string> { "estado", "botoes", "mapas", "variaveis", "captura", "aguardar", "anotar" };
        static readonly Dictionary<string, int> _errosVistos = new Dictionary<string, int>();
        static readonly List<string> CondicoesDeEspera = new List<string> { "livre", "noMapa", "titulo", "cena", "rodada", "quadro", "semQuadro", "transcricao", "resultado" };

        static List<string> Lista(JToken t) => t is JArray a ? a.Select(x => (string)x).Where(x => !string.IsNullOrWhiteSpace(x)).ToList() : t != null && t.Type == JTokenType.String ? new List<string> { (string)t } : null;

        static IEnumerable<string> ArquivosDeMapa()
        {
            foreach (var pasta in Bootstrap.PastasDeMapas)
            {
                if (!Directory.Exists(pasta)) continue;
                foreach (var f in Directory.GetFiles(pasta, "*", SearchOption.AllDirectories))
                    if (f.EndsWith(Arquivos.Mapa, StringComparison.OrdinalIgnoreCase) || f.EndsWith(Arquivos.MapaAntigo, StringComparison.OrdinalIgnoreCase)) yield return f;
            }
        }

        /// <summary>O arquivo do mapa: um caminho, o nome do arquivo (sem a extensão) ou o nome do mapa.</summary>
        static string AcharMapa(string q)
        {
            if (string.IsNullOrWhiteSpace(q)) return null;
            if (File.Exists(q)) return q;
            var todos = ArquivosDeMapa().ToList();
            var porArquivo = todos.FirstOrDefault(f => string.Equals(Path.GetFileNameWithoutExtension(f), q.Trim(), StringComparison.OrdinalIgnoreCase));
            if (porArquivo != null) return porArquivo;
            foreach (var f in todos) { try { var m = Dmap.CarregarFicha(f); if (m != null && Casa(m.NomeVisivel, q) && Limpo(m.NomeVisivel).Length == q.Trim().Length) return f; } catch { } }
            foreach (var f in todos) { try { var m = Dmap.CarregarFicha(f); if (m != null && Casa(m.NomeVisivel, q)) return f; } catch { } }
            return null;
        }

        /// <summary>v300: os heróis pedidos pelo canal, na ordem pedida, no lugar do grupo que a partida trouxe; null se nenhum
        /// casou (a escolha normal segue).</summary>
        public static List<SerializedPlayer> HeroisDoPedido(SerializedGame partida, IEnumerable<HeroModel> disponiveis)
        {
            var pedidos = HeroisPedidos; HeroisPedidos = null;
            if (!Ligado || pedidos == null || pedidos.Count == 0 || partida == null || disponiveis == null) return null;
            var r = new List<SerializedPlayer>();
            foreach (var q in pedidos)
            {
                var h = disponiveis.FirstOrDefault(x => x != null && (string.Equals(x.Id, q, StringComparison.OrdinalIgnoreCase) || Casa(FFGLocalization.Get(x.KeyName, false), q)));
                var sp = h == null ? null : partida.GetPlayer(h, false);
                if (sp != null && !r.Contains(sp)) r.Add(sp); else Log.Info("canal de teste: herói «" + q + "» não está na coleção");
            }
            return r.Count > 0 ? r : null;
        }

        /// <summary>Sem quadro, sem gravação, sem carga e sem monstros entrando: o jogo espera o jogador.</summary>
        static bool Livre()
        {
            try
            {
                var tl = Jogo.UI?.LoadingScreen;
                if (Jogo.Carregador != null && Jogo.Carregador.IsLoading) return false;
                if (tl != null && tl.IsWaitingForInput) return false;
                if (Jogo.Salvando || Lancador.Preparando || Depuracao.Ocupado() || Jogo.MostrandoMensagem) return false;
                if (Jogo.EmEncontro && Jogo.Controle != null && Jogo.Controle.IsEndingRound) return false;
                return true;
            }
            catch { return false; }
        }

        static bool Vale(Espera w)
        {
            switch (w.Ate)
            {
                case "livre": return Livre();
                case "noMapa": return Jogo.EmEncontro && Roteiro.EmMarcha && !Lancador.Preparando && Livre();
                case "titulo": return Jogo.CenaAtual() == Scene.Titlescene && (Jogo.Carregador == null || !Jogo.Carregador.IsLoading);
                case "cena": return string.Equals(Jogo.CenaAtual()?.ToString(), w.Valor, StringComparison.OrdinalIgnoreCase) && (Jogo.Carregador == null || !Jogo.Carregador.IsLoading);
                case "rodada": return int.TryParse(w.Valor, out var n) && Jogo.Rodada >= n && Livre();
                case "quadro": { var q = Dialogos.Descrever(); var j = q == null ? QuadroDoJogo() : null; var t = (q ?? j)?.ToString(Formatting.None); return t != null && (string.IsNullOrEmpty(w.Valor) || t.IndexOf(w.Valor, StringComparison.OrdinalIgnoreCase) >= 0); }
                case "semQuadro": return Dialogos.Descrever() == null && QuadroDoJogo() == null && Dialogos.NaFila == 0;
                case "transcricao":
                {
                    if (string.IsNullOrEmpty(w.Valor)) return false;
                    lock (_buffer) { int novas = _linhasAnotadas - w.Linhas; for (int i = Math.Max(0, _recentes.Count - novas); i < _recentes.Count; i++) if (_recentes[i].IndexOf(w.Valor, StringComparison.OrdinalIgnoreCase) >= 0) return true; }
                    return false;
                }
                case "resultado": return Roteiro.Resultado != null;
            }
            return false;
        }

        static JObject Situacao() => new JObject { ["cena"] = Jogo.CenaAtual()?.ToString(), ["rodada"] = Jogo.Rodada, ["livre"] = Livre(), ["quadroDoMod"] = Dialogos.Descrever(), ["resultado"] = Roteiro.Resultado };

        static void Esperas()
        {
            for (int i = _esperas.Count - 1; i >= 0; i--)
            {
                var w = _esperas[i]; bool vale; try { vale = Vale(w); } catch { vale = false; }
                if (!vale && Time.unscaledTime < w.Limite) continue;
                _esperas.RemoveAt(i);
                var r = vale ? Ok(Situacao()) : new JObject { ["ok"] = false, ["erro"] = "esgotado", ["resultado"] = Situacao() };
                Responder(w.Pedido, r);
            }
        }

        // ------------------------------------------------------------ botoes da tela

        struct Botao { public string texto, caminho; public bool ativo; public GameObject go; }

        /// <summary>Os botoes visiveis (Unity UI) das telas abertas, de cima para baixo: o texto, o caminho na cena, se aceita clique.</summary>
        static List<Botao> Botoes()
        {
            var r = new List<Botao>();
            foreach (var s in Selectable.allSelectablesArray)
            {
                if (s == null || !s.isActiveAndEnabled || !(s is Button || s is Toggle)) continue;
                var cg = s.GetComponentsInParent<CanvasGroup>(); if (cg.Any(g => g.alpha <= 0.01f || !g.blocksRaycasts)) continue;
                var cv = s.GetComponentInParent<Canvas>(); if (cv == null || !cv.isActiveAndEnabled) continue;
                var txt = string.Join(" ", s.GetComponentsInChildren<TMP_Text>(false).Select(t => Limpo(t.text)).Where(t => t.Length > 0).ToArray());
                if (txt.Length == 0) txt = string.Join(" ", s.GetComponentsInChildren<Text>(false).Select(t => Limpo(t.text)).Where(t => t.Length > 0).ToArray());
                var rt = s.transform as RectTransform; var y = rt != null ? rt.position.y : 0f;
                r.Add(new Botao { texto = txt.Length > 0 ? txt : "(" + s.name + ")", caminho = Caminho(s.transform), ativo = s.interactable, go = s.gameObject });
            }
            return r.OrderByDescending(b => b.go.transform.position.y).ThenBy(b => b.go.transform.position.x).ToList();
        }

        static string Caminho(Transform t) { var partes = new List<string>(); for (var x = t; x != null; x = x.parent) partes.Add(x.name); partes.Reverse(); return string.Join("/", partes.ToArray()); }

        /// <summary>Um clique como o do jogador: aperta e solta o botao, e o clique (o que o EventSystem faria).</summary>
        static void Clicar(GameObject go)
        {
            var es = EventSystem.current; var ev = new PointerEventData(es) { button = PointerEventData.InputButton.Left, position = RectTransformUtility.WorldToScreenPoint(null, go.transform.position) };
            ExecuteEvents.Execute(go, ev, ExecuteEvents.pointerEnterHandler);
            ExecuteEvents.Execute(go, ev, ExecuteEvents.pointerDownHandler);
            ExecuteEvents.Execute(go, ev, ExecuteEvents.pointerUpHandler);
            ExecuteEvents.Execute(go, ev, ExecuteEvents.pointerClickHandler);
            ExecuteEvents.Execute(go, ev, ExecuteEvents.pointerExitHandler);
        }

        // ------------------------------------------------------------ estado

        static JObject Estado()
        {
            var o = new JObject
            {
                ["hora"] = DateTime.Now.ToString("s"),
                ["quadro"] = Time.frameCount, ["tempoDoJogo"] = Math.Round(Time.unscaledTime, 1), ["pid"] = System.Diagnostics.Process.GetCurrentProcess().Id,   // (v300: o batimento)
                ["livre"] = Livre(), ["velocidade"] = Time.timeScale, ["pularCenas"] = _pularCenas, ["esperas"] = _esperas.Count,
                ["versao"] = Bootstrap.Versao,
                ["cena"] = Jogo.CenaAtual()?.ToString(),
                ["salvando"] = Jogo.Salvando,
                ["mapa"] = Lancador.Atual?.NomeVisivel,
                ["roteiro"] = Roteiro.EmMarcha,
                ["rodada"] = Jogo.Rodada,
                ["resultado"] = Roteiro.Resultado,
                ["modoDeTeste"] = Depuracao.Ligada,
                ["testesPassam"] = Depuracao.TestesPassam,
            };
            try
            {
                var quadro = Dialogos.Descrever(); if (quadro != null) o["quadroDoMod"] = quadro;
                o["filaDeQuadros"] = Dialogos.NaFila;
                try { var tl = Jogo.UI?.LoadingScreen; o["carga"] = new JObject { ["carregando"] = Jogo.Carregador?.IsLoading ?? false, ["esperaToque"] = tl != null && tl.IsWaitingForInput, ["quadroAtivo"] = tl != null && tl.gameObject.activeInHierarchy, ["botaoAtivo"] = tl != null && tl.ButtonLoadingContinue != null && tl.ButtonLoadingContinue.gameObject.activeInHierarchy, ["gravando"] = SingletonBehaviour<SaveLoadController>.IsInitialized && SingletonBehaviour<SaveLoadController>.Instance.IsLoading }; } catch { }   // (v288: a carga do jogo, para os testes)
                var jogo = QuadroDoJogo(); if (jogo != null) o["quadroDoJogo"] = jogo;
            }
            catch (Exception ex) { o["erroQuadro"] = ex.Message; }
            if (!Jogo.EmEncontro) return o;
            try
            {
                if (Roteiro.Objetivo != null) o["objetivo"] = Limpo(Roteiro.TextoDe(Roteiro.Objetivo));
                o["objetivoN"] = Roteiro.ObjetivoAtual; o["objetivos"] = Roteiro.QuantosObjetivos;
                o["opcionais"] = new JArray(Roteiro.Opcionais.Where(x => Roteiro.Anunciado(x.o)).Select(x => new JObject { ["texto"] = Limpo(Roteiro.TextoDe(x.o)), ["feito"] = x.feito, ["missao"] = x.o.Missao }));
                o["herois"] = new JArray(Jogo.Herois.Select(h => new JObject { ["id"] = h.HeroId, ["nome"] = Herois.NomeDe(h), ["saude"] = h.HealthState.ToString(), ["indice"] = h.Index }));
                o["monstros"] = new JArray(Jogo.Inimigos.Where(e => e.Health > 0).Select(e =>
                {
                    var casa = Inimigos.CasaDe(e);
                    return new JObject { ["guid"] = e.GUID, ["id"] = e.ModelId, ["nome"] = Inimigos.NomeDoInimigo(e), ["vida"] = e.Health, ["tier"] = e.Tier, ["defesa"] = e.Defense,
                        ["grupo"] = Inimigos.GrupoDe.TryGetValue(e.GUID ?? "", out var g) ? g : null, ["casa"] = casa.HasValue ? new JArray(casa.Value.Item1, casa.Value.Item2) : null };
                }));
                o["objetos"] = new JArray(Objetos.Postos.Where(p => p != null && p.Dados != null && !Objetos.EhEscadaDeMao(p.Dados.Tipo)).Select(p => new JObject
                {
                    ["indice"] = p.Indice, ["rotulo"] = Limpo(p.Rotulo), ["tipo"] = p.Dados.Tipo, ["visivel"] = p.Visivel, ["usado"] = p.Usado, ["vezes"] = p.Vezes,
                    ["casa"] = p.Dados.TemPosicao ? new JArray(p.Dados.X, p.Dados.Y) : null
                }));
                o["salasFechadas"] = new JArray(Depuracao.Fechadas().Select(f => f.grupo));
                o["variaveis"] = JObject.FromObject(Roteiro.Vars.ToDictionary(k => k.Key, k => k.Value));
            }
            catch (Exception ex) { o["erroMapa"] = ex.Message; }
            return o;
        }

        /// <summary>O quadro do proprio jogo aberto agora (aviso ou cena): os textos e os botoes dele.</summary>
        static JObject QuadroDoJogo()
        {
            var ui = Jogo.UI; if (ui == null) return null;
            Component q = ui.StoryMessageDialog != null && ui.StoryMessageDialog.IsVisible ? (Component)ui.StoryMessageDialog : ui.MessageDialog != null && ui.MessageDialog.IsVisible ? ui.MessageDialog : null;
            if (q == null) return null;
            return new JObject
            {
                ["tipo"] = q == (Component)ui.StoryMessageDialog ? "cena" : "aviso",
                ["textos"] = new JArray(q.GetComponentsInChildren<TMP_Text>(false).Where(t => t.GetComponentInParent<Selectable>() == null).Select(t => Limpo(t.text)).Where(t => t.Length > 0).Distinct()),
                ["botoes"] = new JArray(q.GetComponentsInChildren<Selectable>(false).Where(s => s.isActiveAndEnabled).Select(s => string.Join(" ", s.GetComponentsInChildren<TMP_Text>(false).Select(t => Limpo(t.text)).Where(t => t.Length > 0).ToArray())).Where(t => t.Length > 0))
            };
        }
    }
}
