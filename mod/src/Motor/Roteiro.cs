using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using FFG.D3.UI;
using NodeCanvas.DialogueTrees;
using UnityEngine;

namespace Bigorna.Motor
{
    /// <summary>
    /// Motor de gatilhos e objetivos. Le o estado da partida a cada batimento, dispara eventos,
    /// avalia condicoes e executa acoes. O que o app nao consegue ver, a mesa declara (ver Mesa).
    /// </summary>
    public static class Roteiro
    {
        public static Dmap Mapa { get; private set; }
        public static bool EmMarcha { get; private set; }

        // variaveis e gatilhos
        public static readonly Dictionary<string, int> Vars = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        static readonly HashSet<string> _disparados = new HashSet<string>();
        static readonly Dictionary<string, int> _vezes = new Dictionary<string, int>();
        static readonly HashSet<string> _desligados = new HashSet<string>();
        static readonly List<(float quando, Dmap.Gatilho g)> _temporizadores = new List<(float, Dmap.Gatilho)>();
        static readonly HashSet<string> _executando = new HashSet<string>();

        // objetivos
        static readonly List<Dmap.Objetivo> _principais = new List<Dmap.Objetivo>();
        static int _atual;
        static readonly List<Dmap.Objetivo> _opcionais = new List<Dmap.Objetivo>();
        static readonly HashSet<int> _opcionaisFeitos = new HashSet<int>();
        static readonly HashSet<string> _anunciadas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        /// <summary>Missoes adicionadas por gatilho ficam escondidas ate serem anunciadas.</summary>
        public static bool Anunciado(Dmap.Objetivo o) => o == null || !o.Escondido || (!string.IsNullOrEmpty(o.Missao) && _anunciadas.Contains(o.Missao));
        public static void AnunciarMissao(string chave)
        {
            if (string.IsNullOrEmpty(chave) || !_anunciadas.Add(chave)) return;
            Log.Info("missão anunciada: " + chave);
            MostrarObjetivo(); Mesa.Atualizar();
        }
        static void CumpriuMissao(Dmap.Objetivo o) { if (o != null && !string.IsNullOrEmpty(o.Missao)) { Vars["mission-" + o.Missao] = 1; Disparar("missionComplete", ("mission", o.Missao)); } }
        public static int ObjetivoAtual => _principais.Count == 0 ? 0 : _atual + 1;
        public static int QuantosObjetivos => _principais.Count;
        public static Dmap.Objetivo Objetivo => _atual < _principais.Count ? _principais[_atual] : null;
        public static IEnumerable<(int i, Dmap.Objetivo o, bool feito)> Opcionais => _opcionais.Select((o, i) => (i, o, _opcionaisFeitos.Contains(i)));

        // inimigos vistos
        static Dictionary<string, string> _vivos = new Dictionary<string, string>();
        static bool _todosPendente;
        static readonly System.Text.RegularExpressions.Regex SalaDoPool = new System.Text.RegularExpressions.Regex(@"^room-(\d+)-pool$");
        static readonly HashSet<string> _retirados = new HashSet<string>();
        public static int Derrotados { get; private set; }
        static readonly Dictionary<string, int> _derrotadosPorGrupo = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        public static int DerrotadosDoGrupo(string g) => !string.IsNullOrEmpty(g) && _derrotadosPorGrupo.TryGetValue(g, out var n) ? n : 0;
        /// <summary>Grupos balanceados que nao geraram nenhum monstro (pool vazio, sem pontos ou sem figuras livres): nada a derrotar,
        /// entao contam como derrotados; o groupDefeated deles sai no batimento seguinte a entrada.</summary>
        static readonly HashSet<string> _gruposVazios = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static readonly HashSet<string> _vaziosPendentes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        /// <summary>Zerados junto com os inimigos (Inimigos.Reiniciar), antes da montagem: os grupos iniciais vazios acontecem antes de o roteiro comecar.</summary>
        public static void EsquecerGruposVazios() { _gruposVazios.Clear(); _vaziosPendentes.Clear(); }
        public static void GrupoVazio(string g) { if (string.IsNullOrEmpty(g)) return; _gruposVazios.Add(g); _vaziosPendentes.Add(g); Log.Info("grupo «" + g + "» sem monstros: conta como derrotado"); }
        /// <summary>O grupo ja teve alguem derrotado, ou entrou vazio.</summary>
        public static bool GrupoResolvido(string g) => DerrotadosDoGrupo(g) > 0 || (!string.IsNullOrEmpty(g) && _gruposVazios.Contains(g));
        public static int VivosNoGrupo(string g) => string.IsNullOrEmpty(g) ? 0 : _vivos.Values.Count(v => string.Equals(v, g, StringComparison.OrdinalIgnoreCase));

        // rodada e herois
        public static int Rodada { get; private set; } = -1;
        static readonly Dictionary<string, HeroHealth> _saudeVista = new Dictionary<string, HeroHealth>();
        static bool _perdido;

        // fim
        static bool? _fecharCom;
        /// <summary>Como o mapa terminou (null: ainda em jogo), para o quadro de fim do jogo dizer isso em palavras.</summary>
        public static bool? Resultado;
        static float _fecharDesde;
        static bool _redeDeSeguranca;
        static float _proximaOlhada;
        public static int ObjetoDaPergunta = -1;
        public static readonly List<string> Pendencias = new List<string>();

        public static void Comecar(Dmap m)
        {
            // as casas de saida dos herois (destacadas pelo aviso logo antes) ficam ate a proxima rodada
            Parar(true);
            Butim.NovoMapa();
            Mapa = m;
            if (m == null) return;
            EmMarcha = true;
            Rodada = -1;
            _principais.AddRange(m.Roteiro.Principais.Where(o => o != null));
            _opcionais.AddRange(m.Roteiro.Opcionais.Where(o => o != null));
            _atual = 0;
            foreach (var g in m.Gatilhos) if (g.Desligado) _desligados.Add(g.Id);
            Objetos.AoUsar = AoUsarObjeto;
            MostrarObjetivo();
            if (!string.IsNullOrEmpty(m.Metadados.Intro)) Dialogos.Mensagem(m.Metadados.Intro, null, m.NomeVisivel);
            Log.Info("roteiro em marcha: " + m.Gatilhos.Count + " gatilhos, " + _principais.Count + " objetivo(s)" + (_opcionais.Count > 0 ? " e " + _opcionais.Count + " opcional(is)" : "") + ", " + m.Roteiro.Derrota.Count + " condição(ões) de derrota");
            Disparar("mapStart");
            AgendarTemporizadores();
        }

        public static void Parar() => Parar(false);

        static void Parar(bool manterDestinos)
        {
            EmMarcha = false;
            Mapa = null;
            Vars.Clear();
            _varsMudadas.Clear();
            _anunciadas.Clear();
            _disparados.Clear();
            _niveis.Clear();
            _cronometros.Clear();
            _vezes.Clear();
            _desligados.Clear();
            _temporizadores.Clear();
            _executando.Clear();
            _principais.Clear();
            _opcionais.Clear();
            _opcionaisFeitos.Clear();
            _atual = 0;
            _vivos = new Dictionary<string, string>();
            _todosPendente = false;
            _retirados.Clear();
            Derrotados = 0;
            _derrotadosPorGrupo.Clear();
            _saudeVista.Clear();
            _perdido = false;
            _fecharCom = null; Resultado = null;
            _redeDeSeguranca = false;
            ObjetoDaPergunta = -1;
            Pendencias.Clear();
            if (!manterDestinos) Acoes.LimparDestinos();
            Acoes.LimparRealces();
            Escolta.Reiniciar();
            Condicoes.Reiniciar();
            Objetos.AoUsar = null;
            Mesa.Fechar();
        }

        // ------------------------------------------------------------------ gatilhos

        public static Dmap.Gatilho GatilhoPorId(string id) => string.IsNullOrEmpty(id) ? null : Mapa?.Gatilhos.FirstOrDefault(g => string.Equals(g.Id, id, StringComparison.OrdinalIgnoreCase) || string.Equals(g.Nome, id, StringComparison.OrdinalIgnoreCase));

        public static bool Gasto(Dmap.Gatilho g)
        {
            if (g == null) return true;
            if (_desligados.Contains(g.Id)) return true;
            return g.UmaVez && _disparados.Contains(g.Id);
        }

        /// <summary>Eventos de estado (variavel igual/acima, vida abaixo, monstros ou ameaca acima): o gatilho corre quando o estado
        /// passa a valer, uma vez, e volta a poder correr depois que o estado deixa de valer. Antes corria a cada batimento
        /// (0,35 s) enquanto valia; com requisito falhando, o "senao" se repetia do mesmo jeito.</summary>
        static readonly HashSet<string> _niveis = new HashSet<string>();
        static void Nivel(Dmap.Gatilho g, bool vale, string chave = null)
        {
            var k = (g.Id ?? "") + (chave == null ? "" : "|" + chave);
            if (!vale) { _niveis.Remove(k); return; }
            if (_niveis.Add(k)) Executar(g);
        }

        /// <summary>groupDefeated de um grupo; o grupo balanceado de uma sala (room-N-pool) responde perguntas e testes a 20000 + sala.</summary>
        static void DispararGrupo(string g)
        {
            var mg = SalaDoPool.Match(g);
            if (mg.Success) ObjetoDaPergunta = 20000 + int.Parse(mg.Groups[1].Value) - 1;
            try { Disparar("groupDefeated", ("group", g)); }
            finally { if (mg.Success) ObjetoDaPergunta = -1; }
        }

        /// <summary>Contagens de rodadas de um gatilho "Every N rounds" (startRoundTimer): a partir da rodada em que o objeto foi usado,
        /// a cada N rodadas (quantas vezes pedido, 0 = ate o fim) dispara o evento roundTimer do gatilho; perguntas e testes de dentro
        /// respondem ao objeto dono. Usado de novo, o objeto recomeca a contagem.</summary>
        class Cronometro { public string Id; public int Cada, Restam, Proxima, Objeto; }
        static readonly List<Cronometro> _cronometros = new List<Cronometro>();
        public static void IniciarCronometro(string id, int cada, int vezes, int objeto)
        {
            if (string.IsNullOrEmpty(id)) return;
            cada = Math.Max(1, cada);
            _cronometros.RemoveAll(c => c.Id == id);
            int agora = Math.Max(0, Rodada);
            _cronometros.Add(new Cronometro { Id = id, Cada = cada, Restam = Math.Max(0, vezes), Proxima = agora + cada, Objeto = objeto });
            Log.Info("rodadas: «" + id + "» a cada " + cada + " rodada(s)" + (vezes > 0 ? ", " + vezes + " vez(es)" : ", até o fim") + "; a próxima é a " + (agora + cada));
        }
        public static void PararCronometro(string id) => _cronometros.RemoveAll(c => c.Id == id);
        static void Cronometros(int rodada)
        {
            foreach (var c in _cronometros.Where(c => rodada >= c.Proxima).ToList())
            {
                c.Proxima = rodada + c.Cada;
                if (c.Restam > 0 && --c.Restam == 0) _cronometros.Remove(c);
                Log.Info("rodadas: «" + c.Id + "» na rodada " + rodada);
                if (c.Objeto >= 0) ObjetoDaPergunta = c.Objeto;
                try { Disparar("roundTimer", ("timer", c.Id)); }
                finally { if (c.Objeto >= 0) ObjetoDaPergunta = -1; }
            }
        }

        public static bool JaDisparou(string id) => !string.IsNullOrEmpty(id) && _disparados.Contains(id);
        public static int Vezes(string id) => !string.IsNullOrEmpty(id) && _vezes.TryGetValue(id, out var n) ? n : 0;

        public static IEnumerable<Dmap.Gatilho> Gatilhos(string evento) => (Mapa?.Gatilhos ?? new List<Dmap.Gatilho>()).Where(g => string.Equals(g.Evento?.Id, evento, StringComparison.OrdinalIgnoreCase) && !Gasto(g));

        /// <summary>Dispara todos os gatilhos de um evento cujos parametros casem com os dados informados.</summary>
        public static int Disparar(string evento, params (string chave, object valor)[] dados)
        {
            int n = 0;
            foreach (var g in Gatilhos(evento).ToList())
                if (Casa(g, dados) && Executar(g)) n++;
            return n;
        }

        static bool Casa(Dmap.Gatilho g, (string chave, object valor)[] dados)
        {
            var p = g.Evento?.Params;
            if (p == null || dados == null) return true;
            foreach (var (chave, valor) in dados)
            {
                if (!p.TryGetValue(chave, out var esperado) || esperado == null) continue;
                var e = esperado.ToString();
                if (e.Length == 0) continue;
                if (valor is int vi && int.TryParse(e, out var ei)) { if (vi != ei) return false; continue; }
                if (!string.Equals(e, valor?.ToString(), StringComparison.OrdinalIgnoreCase)) return false;
            }
            // a resposta de um objeto so vale para uma pergunta desse objeto: uma escolha sem objeto nao a dispara
            if (string.Equals(g.Evento?.Id, "choiceMade", StringComparison.OrdinalIgnoreCase) && p.TryGetValue("interactable", out var dono) && dono != null && dono.ToString().Length > 0
                && !dados.Any(d => d.chave == "interactable")) return false;
            return true;
        }

        public static bool Executar(Dmap.Gatilho g, bool forcar = false, bool semCondicoes = false)
        {
            if (g == null) return false;
            if (!forcar && Gasto(g)) return false;
            if (_executando.Contains(g.Id)) { Log.Info("gatilho «" + g.Rotulo + "» chamou a si mesmo; ignorado"); return false; }
            // (o modo de teste abre uma sala pelo gatilho dela mesmo quando a condicao e uma resposta ainda nao dada)
            if (!semCondicoes && !Condicoes.Todas(g.Condicoes, g))
            {
                if (g.Senao != null && g.Senao.Count > 0) { Efeitos++; Log.Info("gatilho «" + g.Rotulo + "»: requisito não cumprido; corre o «senão»"); _executando.Add(g.Id); try { Acoes.Executar(g.Senao, g); } finally { _executando.Remove(g.Id); } Mesa.Atualizar(); }
                return false;
            }
            _disparados.Add(g.Id);
            _vezes[g.Id] = Vezes(g.Id) + 1;
            if ((g.Acoes ?? new List<Dmap.Clausula>()).Any(a => a != null && a.Id != "setVar")) Efeitos++;
            Log.Info("gatilho «" + g.Rotulo + "» (" + (g.Evento?.Id ?? "?") + ")");
            _executando.Add(g.Id);
            try { Acoes.Executar(g.Acoes, g); }
            finally { _executando.Remove(g.Id); }
            Disparar("afterTrigger", ("trigger", g.Id));
            if (_executando.Count == 0) SoltarVarsMudadas();
            Mesa.Atualizar();
            return true;
        }

        // contadores: "varChanged" sai depois que o gatilho que mudou a variavel termina (a mensagem dele vem antes da consequencia)
        static readonly List<string> _varsMudadas = new List<string>();
        public static void VarMudou(string v)
        {
            if (string.IsNullOrEmpty(v)) return;
            if (!_varsMudadas.Contains(v)) _varsMudadas.Add(v);
            if (_executando.Count == 0) SoltarVarsMudadas();
        }
        static void SoltarVarsMudadas()
        {
            for (int volta = 0; volta < 20 && _varsMudadas.Count > 0; volta++)
            {
                var lote = _varsMudadas.ToList(); _varsMudadas.Clear();
                foreach (var v in lote) Disparar("varChanged", ("var", v), ("value", Var(v)));
            }
        }

        public static void Ligar(string id, bool ligado)
        {
            var g = GatilhoPorId(id);
            if (g == null) { Log.Info("gatilho «" + id + "» não existe"); return; }
            if (ligado) { _desligados.Remove(g.Id); _disparados.Remove(g.Id); _niveis.RemoveWhere(k => k == g.Id || k.StartsWith(g.Id + "|")); }
            else _desligados.Add(g.Id);
            Log.Info("gatilho «" + g.Rotulo + "» " + (ligado ? "ligado" : "desligado"));
            Mesa.Atualizar();
        }

        static void AgendarTemporizadores()
        {
            foreach (var g in Gatilhos("timer"))
            {
                int s = P.Inteiro(g.Evento.Params, "seconds", 30);
                _temporizadores.Add((Time.unscaledTime + s, g));
            }
        }

        // ------------------------------------------------------------------ objetos

        /// <summary>Quantos gatilhos fizeram algo a vista (mais que marcar variaveis), ou correram o "senao". Para saber se um uso
        /// passou em branco.</summary>
        public static int Efeitos;

        static void AoUsarObjeto(Objetos.NaMesa p, SerializedPlayer heroi)
        {
            if (!EmMarcha) return;
            int i = p.Indice;
            var tipo = (p.Dados?.Tipo ?? "").ToLowerInvariant();
            ObjetoDaPergunta = i;
            int antes = Efeitos;
            try
            {
                Disparar("interacted", ("interactable", i));
                if (tipo == "chest" || tipo == "vault") Disparar("chestOpened", ("interactable", i));
                if (tipo == "door" || tipo == "gate") Disparar("doorOpened", ("interactable", i));
                Butim.Entregar(p.Dados?.Butim, p.Rotulo);
                // um uso recusado (requisito nao cumprido: o objeto volta a ficar como estava) nao cumpre objetivo nenhum
                if (p.Vezes > 0) ChecarObjetivosPorObjeto(i);
                else Log.Info("  uso recusado: objetivos do objeto ficam em aberto");
                // nada aconteceu (tudo o que o objeto fazia ja foi feito): diz isso, em vez de o clique passar em branco
                if (heroi != null && Efeitos == antes && string.IsNullOrEmpty(p.Dados?.Texto) && FazAlgoAoUsar(i) && !Dialogos.Ocupado && Dialogos.NaFila == 0 && !Jogo.MostrandoMensagem)
                    Dialogos.Mensagem(NadaMais, null, p.Rotulo);
            }
            finally { ObjetoDaPergunta = -1; }
            Mesa.Atualizar();
        }

        public const string NadaMais = "Não há mais nada a fazer aqui.";

        public static void Escolheu(int opcao, int objeto)
        {
            Vars["ultimaEscolha"] = opcao;
            Log.Info("o jogador escolheu a opção " + opcao + (objeto >= 0 ? " (objeto #" + objeto + ")" : ""));
            // o que a resposta faz pertence ao mesmo objeto: um teste pedido por ela responde a ele (sem isto, o resultado do
            // teste saia sem objeto e disparava as respostas de mesmo numero de outros objetos, como o salto do alcapao)
            int antes = ObjetoDaPergunta;
            if (objeto >= 0) ObjetoDaPergunta = objeto;
            try
            {
                if (objeto >= 0) Disparar("choiceMade", ("option", opcao), ("interactable", objeto));
                else Disparar("choiceMade", ("option", opcao));
            }
            finally { ObjetoDaPergunta = antes; }
        }

        // ------------------------------------------------------------------ batimento

        public static void Batimento()
        {
            try { FecharSeForHora(); } catch (Exception ex) { Log.Erro("fechando a partida", ex); }
            if (!EmMarcha) return;
            if (Time.unscaledTime < _proximaOlhada) return;
            _proximaOlhada = Time.unscaledTime + 0.35f;
            try { Olhar(); } catch (Exception ex) { Log.Erro("o roteiro falhou ao olhar a partida", ex); }
        }

        static void Olhar()
        {
            var gc = Jogo.Controle;
            var partida = Jogo.Partida;
            if (gc == null || partida == null) return;

            // rodadas
            int rodada = gc.RoundCount;
            if (rodada != Rodada && rodada >= 0)
            {
                if (Rodada >= 0)
                {
                    Disparar("roundEnd", ("round", Rodada));
                    foreach (var g in Gatilhos("everyNRounds").ToList())
                    {
                        int n = P.Inteiro(g.Evento.Params, "n", 2);
                        if (n > 0 && rodada % n == 0) Executar(g);
                    }
                }
                if (Rodada >= 0) { Acoes.LimparDestinos(); Acoes.LimparAteARodada(); }
                Rodada = rodada;
                Disparar("roundStart", ("round", rodada));
                if (_cronometros.Count > 0) Cronometros(rodada);
            }

            // temporizadores
            if (_temporizadores.Count > 0)
            {
                foreach (var t in _temporizadores.Where(t => Time.unscaledTime >= t.quando).ToList())
                {
                    _temporizadores.Remove(t);
                    if (Executar(t.g) && !t.g.UmaVez) _temporizadores.Add((Time.unscaledTime + P.Inteiro(t.g.Evento.Params, "seconds", 30), t.g));
                }
            }

            // inimigos: quem sumiu da lista morreu (ou foi retirado por nos)
            var agora = new Dictionary<string, string>();
            foreach (var e in Jogo.Inimigos)
            {
                Inimigos.GrupoDe.TryGetValue(e.GUID, out var grupo);
                agora[e.GUID] = grupo ?? "";
                if (!string.IsNullOrEmpty(e.ModelId)) Inimigos.ModeloDe[e.GUID] = e.ModelId;
            }
            HashSet<string> gruposCaidos = null;   // dois do mesmo grupo caindo no mesmo batimento: groupDefeated sai uma vez so
            foreach (var kv in _vivos)
            {
                if (agora.ContainsKey(kv.Key)) continue;
                if (_retirados.Remove(kv.Key)) continue;
                Derrotados++;
                if (!string.IsNullOrEmpty(kv.Value)) _derrotadosPorGrupo[kv.Value] = DerrotadosDoGrupo(kv.Value) + 1;
                Inimigos.ModeloDe.TryGetValue(kv.Key, out var modelo);
                Log.Info("inimigo derrotado: " + (modelo ?? "?") + (string.IsNullOrEmpty(kv.Value) ? "" : " [" + kv.Value + "]") + " · total " + Derrotados);
                // a marca liga a morte aos gatilhos daquele inimigo; perguntas e testes que eles abrirem respondem a 10000 + marca
                int marca = Inimigos.OrigemDe.TryGetValue(kv.Key, out var origem) && origem != null ? origem.Marca : 0;
                if (marca > 0) ObjetoDaPergunta = 10000 + marca;
                try { Disparar("enemyDefeated", ("enemy", modelo ?? ""), ("tag", marca)); }
                finally { if (marca > 0) ObjetoDaPergunta = -1; }
                Disparar("enemiesDefeatedCount", ("n", Derrotados));
                if (!string.IsNullOrEmpty(kv.Value) && !agora.Values.Contains(kv.Value) && !Inimigos.EsperandoDoGrupo(kv.Value)
                    && (gruposCaidos ?? (gruposCaidos = new HashSet<string>(StringComparer.OrdinalIgnoreCase))).Add(kv.Value))
                {
                    DispararGrupo(kv.Value);
                }
            }
            // grupos balanceados que entraram vazios: saem quando a entrada termina e nao ha ninguem do grupo em jogo ou esperando sala
            if (_vaziosPendentes.Count > 0 && Inimigos.Gerando == 0)
                foreach (var g in _vaziosPendentes.ToList())
                {
                    if (agora.Values.Contains(g) || Inimigos.EsperandoDoGrupo(g)) { _vaziosPendentes.Remove(g); continue; }   // entrou gente depois: segue a regra comum
                    _vaziosPendentes.Remove(g);
                    if (gruposCaidos == null || !gruposCaidos.Contains(g)) DispararGrupo(g);
                }
            // "todos derrotados" fica pendente enquanto ha inimigos entrando ou esperando sala; sai quando isso acaba sem ninguem novo
            if (_vivos.Count > 0 && agora.Count == 0) _todosPendente = true;
            else if (agora.Count > 0) _todosPendente = false;
            if (_todosPendente && agora.Count == 0 && Inimigos.Gerando == 0 && Inimigos.AguardandoSala == 0) { _todosPendente = false; Disparar("allEnemiesDefeated"); }
            _vivos = agora;

            foreach (var g in Gatilhos("enemyHealthBelow").ToList())
            {
                var id = P.Texto(g.Evento.Params, "enemy");
                int pct = P.Inteiro(g.Evento.Params, "pct", 50);
                Nivel(g, Inimigos.Vivos(id, null).Any(e => e.StartingHealth > 0 && e.Health * 100 / e.StartingHealth < pct));
            }
            foreach (var g in Gatilhos("enemyCountAbove").ToList())
                Nivel(g, agora.Count > P.Inteiro(g.Evento.Params, "n", 5));
            foreach (var g in Gatilhos("threatAbove").ToList())
                Nivel(g, AmeacaTotal() > P.Inteiro(g.Evento.Params, "n", 5));
            foreach (var g in Gatilhos("variableEquals").ToList())
                Nivel(g, Var(P.Texto(g.Evento.Params, "var")) == P.Inteiro(g.Evento.Params, "value", 1));
            foreach (var g in Gatilhos("variableAbove").ToList())
                Nivel(g, Var(P.Texto(g.Evento.Params, "var")) > P.Inteiro(g.Evento.Params, "value", 1));

            // herois
            OlharHerois(partida);

            // um gatilho deste batimento pode ter fechado o roteiro (vitoria/derrota): nada mais e julgado
            if (Inimigos.Gerando == 0 && EmMarcha)
            {
                ChecarObjetivos();
                if (EmMarcha) ChecarDerrota(partida, agora.Count, rodada);
            }
        }

        public static int AmeacaTotal()
        {
            int total = 0;
            foreach (var e in Jogo.Inimigos) if (e.ThreatValues != null && e.ThreatValues.Length > 0) total += e.ThreatValues.Max();
            return total;
        }

        static void OlharHerois(SerializedGame partida)
        {
            var herois = Jogo.Herois;
            foreach (var h in herois)
            {
                var id = h.HeroId ?? "?";
                if (!_saudeVista.TryGetValue(id, out var antes)) { _saudeVista[id] = h.HealthState; continue; }
                if (antes == h.HealthState) continue;
                _saudeVista[id] = h.HealthState;
                Log.Info("  " + id + ": " + antes + " → " + h.HealthState);
                if (h.HealthState == HeroHealth.Defeated) Disparar("heroDefeated", ("hero", id));
                foreach (var g in Gatilhos("heroHealthBelow").ToList())
                {
                    var quem = P.Texto(g.Evento.Params, "hero");
                    if (!string.IsNullOrEmpty(quem) && !string.Equals(quem, id, StringComparison.OrdinalIgnoreCase)) continue;
                    Nivel(g, Saude(h) < P.Inteiro(g.Evento.Params, "pct", 50), id);
                }
            }
            if (herois.Count > 0)
                foreach (var g in Gatilhos("partyHealthBelow").ToList())
                    Nivel(g, SaudeDoGrupo() < P.Inteiro(g.Evento.Params, "pct", 50));
        }

        /// <summary>Saude aproximada em porcentagem, a partir do estado de ferimento.</summary>
        public static int Saude(SerializedPlayer h)
        {
            switch (h.HealthState)
            {
                case HeroHealth.Normal: return 100;
                case HeroHealth.MinorInjury: return 66;
                case HeroHealth.MajorInjury: return 33;
                default: return 0;
            }
        }

        public static int SaudeDoGrupo()
        {
            var herois = Jogo.Herois;
            return herois.Count == 0 ? 100 : (int)herois.Average(Saude);
        }

        public static int Var(string nome) => !string.IsNullOrEmpty(nome) && Vars.TryGetValue(nome, out var v) ? v : 0;

        // ------------------------------------------------------------------ objetivos

        /// <summary>{#var} no texto vira o valor da variavel (os contadores da Oficina: chaves achadas...).</summary>
        public static string ComContadores(string t) => string.IsNullOrEmpty(t) || t.IndexOf("{#", StringComparison.Ordinal) < 0 ? t : System.Text.RegularExpressions.Regex.Replace(t, @"\{#([^}]+)\}", m => Var(m.Groups[1].Value).ToString());

        /// <summary>Algum gatilho de uso deste objeto faz mais do que marcar que ele foi usado?</summary>
        public static bool FazAlgoAoUsar(int indice) => (Mapa?.Gatilhos ?? new List<Dmap.Gatilho>()).Any(g => string.Equals(g.Evento?.Id, "interacted", StringComparison.OrdinalIgnoreCase) && P.Inteiro(g.Evento.Params, "interactable", -1) == indice && ((g.Acoes ?? new List<Dmap.Clausula>()).Any(a => a != null && a.Id != "setVar") || (g.Senao ?? new List<Dmap.Clausula>()).Count > 0));

        public static string TextoDe(Dmap.Objetivo o)
        {
            if (o == null) return "";
            if (!string.IsNullOrEmpty(o.Texto)) return o.Texto;
            return ObjetivosAuto.NomeGenerico(o.Id);
        }

        public static void MostrarObjetivo()
        {
            var texto = TextoObjetivo();
            if (texto != null) DefinirTextoObjetivo(texto, true);
        }

        static string TextoObjetivo()
        {
            if (Objetivo == null && _opcionais.Count == 0) return null;
            var sb = new System.Text.StringBuilder();
            if (Objetivo != null) sb.Append(Anunciado(Objetivo) ? TextoDe(Objetivo) : "Explorem: a missão final ainda vai ser revelada.");
            for (int i = 0; i < _opcionais.Count; i++)
            {
                if (!Anunciado(_opcionais[i])) continue;
                if (sb.Length > 0) sb.Append('\n');
                var t = TextoDe(_opcionais[i]);
                sb.Append(_opcionaisFeitos.Contains(i) ? "✓ <s>" + t + "</s>" : "· " + t);
            }
            return sb.ToString();
        }

        public static void DefinirTextoObjetivo(string texto, bool final)
        {
            if (string.IsNullOrEmpty(texto)) return;
            try
            {
                var partida = Jogo.Partida;
                if (partida != null)
                {
                    partida.CurrentObjectiveData.CurrentObjective = texto;
                    partida.CurrentObjectiveData.IsFinalObjective = final;
                    partida.CurrentObjectiveData.Key = null;
                    partida.CurrentObjectiveData.Arguments = null;
                }
                var ui = Jogo.UI;
                if (ui != null)
                {
                    ui.SetObjectiveText(texto, final);
                    var tipo = ui.GetType();
                    tipo.GetField("_lastObjectiveKey", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public)?.SetValue(ui, null);
                    tipo.GetField("_LastObjectiveArguments", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Public)?.SetValue(ui, null);
                    ui.SetDirty();
                }
            }
            catch (Exception ex) { Log.Info("não pus o texto do objetivo: " + ex.Message); }
        }

        /// <summary>Se o jogo pisou o texto do objetivo com uma chave crua, repoe o nosso.</summary>
        public static void VigiarObjetivo()
        {
            if (!EmMarcha) return;
            try
            {
                var rotulo = Jogo.UI?.LabelCurrentObjective;
                if (rotulo == null || !rotulo.gameObject.activeInHierarchy) return;
                var t = (rotulo.text ?? "").Trim();
                if (t.Length > 0 && Silencio.EhChaveCrua(t)) { Log.Info("o objetivo foi pisado por «" + t + "»; reposto"); MostrarObjetivo(); }
            }
            catch { }
        }

        static void ChecarObjetivos()
        {
            for (int i = 0; i < _opcionais.Count; i++)
                if (!_opcionaisFeitos.Contains(i) && Anunciado(_opcionais[i]) && ObjetivosAuto.Cumprido(_opcionais[i])) MarcarOpcional(i);
            if (Objetivo != null && Anunciado(Objetivo) && ObjetivosAuto.Cumprido(Objetivo)) Avancar();
        }

        static void ChecarObjetivosPorObjeto(int indice)
        {
            for (int i = 0; i < _opcionais.Count; i++)
                if (!_opcionaisFeitos.Contains(i) && Anunciado(_opcionais[i]) && ObjetivosAuto.FechaComObjeto(_opcionais[i], indice)) MarcarOpcional(i);
            if (Objetivo != null && Anunciado(Objetivo) && ObjetivosAuto.FechaComObjeto(Objetivo, indice)) Avancar();
        }

        public static void MarcarOpcional(int i)
        {
            if (i < 0 || i >= _opcionais.Count || !_opcionaisFeitos.Add(i)) return;
            CumpriuMissao(_opcionais[i]);
            var t = TextoDe(_opcionais[i]);
            Log.Info("objetivo opcional cumprido: " + t);
            MostrarObjetivo();
            Dialogos.Mensagem("Objetivo opcional cumprido: " + t, null, "Objetivo");
            Mesa.Atualizar();
        }

        /// <summary>O objetivo atual foi cumprido; passa ao proximo ou fecha com vitoria.</summary>
        public static void Avancar()
        {
            if (!EmMarcha) return;
            for (int volta = 0; volta <= _principais.Count; volta++)
            {
                var feito = Objetivo;
                Log.Info("objetivo cumprido: " + TextoDe(feito));
                CumpriuMissao(feito);
                _atual++;
                Disparar("objectiveComplete", ("n", _atual));
                if (_atual >= _principais.Count) { Completar(true); return; }
                Log.Info("  agora: «" + TextoDe(Objetivo) + "»");
                MostrarObjetivo();
                Disparar("objectiveStart", ("n", _atual + 1));
                Mesa.Atualizar();
                if (!ObjetivosAuto.JaEstava(Objetivo)) return;
                Log.Info("  «" + TextoDe(Objetivo) + "» já estava feito; passa ao seguinte");
            }
            Completar(true);
        }

        /// <summary>Pula para o objetivo N (1 = primeiro). Extensao Bigorna.</summary>
        public static void IrParaObjetivo(int n)
        {
            if (n < 1 || n > _principais.Count) { Log.Info("objetivo " + n + " não existe"); return; }
            _atual = n - 1;
            MostrarObjetivo();
            Disparar("objectiveStart", ("n", n));
            Mesa.Atualizar();
        }

        // ------------------------------------------------------------------ derrota e fim

        static void ChecarDerrota(SerializedGame partida, int inimigos, int rodada)
        {
            if (_perdido) return;
            var herois = Jogo.Herois;
            if (herois.Count > 0 && herois.Any(h => h.HealthState == HeroHealth.Defeated))
            {
                _perdido = true;
                Log.Info("um herói caiu: missão perdida (regra do jogo)");
                _redeDeSeguranca = true;
                Completar(false);
                return;
            }
            foreach (var d in Mapa.Roteiro.Derrota)
            {
                if (d == null) continue;
                bool caiu = false;
                switch (d.Id)
                {
                    case "all_heroes_defeated": caiu = herois.Count > 0 && herois.All(h => h.HealthState == HeroHealth.Defeated); break;
                    case "hero_defeated":
                    {
                        var quem = P.Texto(d.Params, "hero");
                        caiu = herois.Any(h => h.HealthState == HeroHealth.Defeated && (string.IsNullOrEmpty(quem) || string.Equals(h.HeroId, quem, StringComparison.OrdinalIgnoreCase)));
                        break;
                    }
                    case "round_limit": caiu = rodada > P.Inteiro(d.Params, "rounds", 12); break;
                    case "party_health_below": caiu = herois.Count > 0 && SaudeDoGrupo() < P.Inteiro(d.Params, "hp", 25); break;
                    case "enemies_exceed": caiu = inimigos > P.Inteiro(d.Params, "n", 8); break;
                    case "ritual_completed": caiu = rodada > P.Inteiro(d.Params, "rounds", 8); break;
                }
                if (caiu)
                {
                    _perdido = true;
                    Log.Info("condição de derrota: " + d.Id);
                    Completar(false);
                    return;
                }
            }
        }

        public static void DeclararDerrota(Dmap.Objetivo d)
        {
            if (_perdido || !EmMarcha) return;
            _perdido = true;
            Log.Info("a mesa declara derrota: " + (d?.Id ?? "?"));
            Completar(false);
        }

        public static void Completar(bool vitoria)
        {
            if (!EmMarcha) return;
            EmMarcha = false;
            Log.Info(vitoria ? "VITÓRIA: o roteiro termina" : "DERROTA: o roteiro termina");
            Lancador.Resultado = vitoria;
            Tabuleiro.Desmontado();
            _fecharCom = vitoria; Resultado = vitoria;
            _fecharDesde = Time.unscaledTime;
            Mesa.Fechar();
        }

        static bool JogoFechaSozinho()
        {
            try
            {
                var arvores = SingletonBehaviour<GameDefaultDialogueTrees>.IsInitialized ? SingletonBehaviour<GameDefaultDialogueTrees>.Instance : null;
                var fim = arvores?.EndOfQuestTree;
                var ferido = arvores?.HeroInjuredTree;
                if ((fim != null && fim.isRunning) || (ferido != null && ferido.isRunning)) return true;
                var processo = Jogo.Persistente?.ProcessStack?.CurrentProcess;
                if (processo != null && (ReferenceEquals(processo, fim) || ReferenceEquals(processo, ferido))) return true;
                var resumo = Jogo.UI?.QuestSummaryDialog;
                return resumo != null && resumo.IsVisible;
            }
            catch { return false; }
        }

        static void FecharSeForHora()
        {
            if (!_fecharCom.HasValue || Time.unscaledTime - _fecharDesde < 0.5f) return;
            if (_redeDeSeguranca)
            {
                if (JogoFechaSozinho()) { _fecharCom = null; _redeDeSeguranca = false; Log.Info("  o jogo fecha a partida sozinho pelo herói caído"); return; }
                if (Time.unscaledTime - _fecharDesde < 8f) return;
            }
            bool ocupado = Jogo.MostrandoMensagem || Dialogos.Ocupado || Dialogos.NaFila > 0;
            if (ocupado && Time.unscaledTime - _fecharDesde < 12f) return;
            bool vitoria = _fecharCom.Value;
            _fecharCom = null;
            _redeDeSeguranca = false;
            try
            {
                var fim = SingletonBehaviour<GameDefaultDialogueTrees>.IsInitialized ? SingletonBehaviour<GameDefaultDialogueTrees>.Instance.EndOfQuestTree : null;
                if (fim != null && fim.isRunning) { Log.Info("  o jogo já está fechando; não chamo por cima"); return; }
                Jogo.Controle.EndQuest(vitoria);
                Log.Info("  EndQuest(" + vitoria + ") chamado");
            }
            catch (Exception ex) { Log.Erro("não consegui fechar o encontro", ex); }
        }

        public static void Retirado(string guid) { if (!string.IsNullOrEmpty(guid)) _retirados.Add(guid); }
    }
}
