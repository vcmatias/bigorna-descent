using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;

namespace Bigorna.Formato
{
    /// <summary>
    /// v265: uma partida de mapa oneshot em andamento, guardada fora das ranhuras do jogo. O mapa oneshot joga na ranhura de
    /// rascunho (0), que o proximo mapa apaga; a cada gravacao do jogo no meio do mapa, a gravacao (.sav e .qlog), o estado do
    /// mod naquele instante (estado.json) e uma copia do mapa (mapa.dmap) vao para Bigorna\Oneshot\Andamento\&lt;id&gt;, com a
    /// ficha da partida (ficha.json: o mapa, a semente, a equipe, a rodada, quando). O id e o da ranhura da partida
    /// (SaveSlotGUID): a mesma partida retomada e gravada de novo atualiza a mesma pasta. Vencido ou perdido o mapa, a pasta
    /// sai. Sem dependencia da Unity (o teste fora do jogo usa esta classe).
    /// </summary>
    public class Andamento
    {
        /// <summary>A ficha da partida (ficha.json), para a lista de partidas em andamento.</summary>
        public class Ficha
        {
            [JsonProperty("version")] public int Versao = 1;
            [JsonProperty("id")] public string Id;
            [JsonProperty("map")] public string Mapa;
            [JsonProperty("seed")] public string Semente;
            [JsonProperty("length")] public int Duracao = -1;
            [JsonProperty("difficulty")] public int Dificuldade = -1;
            /// <summary>A equipe de uma partida gravada ("Usar meus herois"): o nome dela; null: equipe nova.</summary>
            [JsonProperty("party")] public string Equipe;
            [JsonProperty("heroes")] public List<string> Herois = new List<string>();
            [JsonProperty("round")] public int Rodada;
            [JsonProperty("when")] public long Quando;
            [JsonProperty("save")] public string Sav;
            [JsonProperty("log")] public string Qlog;
        }

        /// <summary>A pasta das partidas em andamento (o mod a define: Bigorna\Oneshot\Andamento, na pasta de dados do jogo).</summary>
        public static string Raiz;
        public const int Maximo = 12;

        public string Pasta;
        public Ficha Dados;
        public string Id => Dados?.Id ?? Path.GetFileName(Pasta);
        public string CaminhoMapa => Path.Combine(Pasta, "mapa.dmap");
        public string CaminhoEstado => Path.Combine(Pasta, "estado.json");
        public string CaminhoSav => string.IsNullOrEmpty(Dados?.Sav) ? null : Path.Combine(Pasta, Dados.Sav);
        public string CaminhoQlog => string.IsNullOrEmpty(Dados?.Qlog) ? null : Path.Combine(Pasta, Dados.Qlog);
        public DateTime Quando { get { try { return Dados != null && Dados.Quando > 0 ? new DateTime(Dados.Quando) : DateTime.MinValue; } catch { return DateTime.MinValue; } } }

        static string PastaDe(string id) => string.IsNullOrEmpty(Raiz) || string.IsNullOrEmpty(id) ? null : Path.Combine(Raiz, Limpo(id));
        static string Limpo(string id) => new string(id.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());

        /// <summary>As partidas em andamento inteiras (ficha, mapa, estado e gravacao no lugar), a mais recente primeiro.</summary>
        public static List<Andamento> Todos()
        {
            var r = new List<Andamento>();
            if (string.IsNullOrEmpty(Raiz) || !Directory.Exists(Raiz)) return r;
            foreach (var p in Directory.GetDirectories(Raiz))
            {
                try
                {
                    var f = Path.Combine(p, "ficha.json"); if (!File.Exists(f)) continue;
                    var a = new Andamento { Pasta = p, Dados = JsonConvert.DeserializeObject<Ficha>(File.ReadAllText(f)) };
                    if (a.Dados == null || !File.Exists(a.CaminhoMapa) || !File.Exists(a.CaminhoEstado) || a.CaminhoSav == null || !File.Exists(a.CaminhoSav)) continue;
                    r.Add(a);
                }
                catch { }
            }
            return r.OrderByDescending(a => a.Dados.Quando).ToList();
        }

        public static Andamento Por(string id)
        {
            var p = PastaDe(id); if (p == null) return null;
            return Todos().FirstOrDefault(a => string.Equals(Path.GetFullPath(a.Pasta).TrimEnd('/', '\\'), Path.GetFullPath(p).TrimEnd('/', '\\'), StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>Guarda a gravacao mais recente da partida: o .sav e o .qlog copiados (os de antes saem), o estado do mod, a
        /// ficha e, na primeira vez, o mapa. Escreve primeiro em arquivos temporarios: uma pasta pela metade nao aparece na lista.</summary>
        public static Andamento Gravar(Ficha ficha, string estadoJson, string sav, string qlog, string mapa)
        {
            var pasta = PastaDe(ficha?.Id); if (pasta == null) throw new ArgumentException("sem id ou sem pasta");
            if (string.IsNullOrEmpty(sav) || !File.Exists(sav)) throw new FileNotFoundException("a gravação do jogo não está lá", sav);
            Directory.CreateDirectory(pasta);
            var destMapa = Path.Combine(pasta, "mapa.dmap");
            if (!File.Exists(destMapa))
            {
                if (string.IsNullOrEmpty(mapa) || !File.Exists(mapa)) throw new FileNotFoundException("o mapa não está lá", mapa);
                Copiar(mapa, destMapa);
            }
            var nomeSav = Path.GetFileName(sav); var nomeQlog = !string.IsNullOrEmpty(qlog) && File.Exists(qlog) ? Path.GetFileName(qlog) : null;
            Copiar(sav, Path.Combine(pasta, nomeSav));
            if (nomeQlog != null) Copiar(qlog, Path.Combine(pasta, nomeQlog));
            Escrever(Path.Combine(pasta, "estado.json"), estadoJson ?? "{}");
            ficha.Sav = nomeSav; ficha.Qlog = nomeQlog;
            Escrever(Path.Combine(pasta, "ficha.json"), JsonConvert.SerializeObject(ficha, Formatting.Indented));
            // (as gravacoes anteriores desta partida saem: fica so a mais recente)
            foreach (var f in Directory.GetFiles(pasta))
            {
                var n = Path.GetFileName(f); var ext = Path.GetExtension(f).ToLowerInvariant();
                if ((ext == ".sav" || ext == ".qlog") && !string.Equals(n, nomeSav, StringComparison.OrdinalIgnoreCase) && !string.Equals(n, nomeQlog, StringComparison.OrdinalIgnoreCase)) try { File.Delete(f); } catch { }
            }
            Podar();
            return new Andamento { Pasta = pasta, Dados = ficha };
        }

        static void Copiar(string de, string para)
        {
            if (string.Equals(Path.GetFullPath(de), Path.GetFullPath(para), StringComparison.OrdinalIgnoreCase)) return;
            var tmp = para + ".tmp"; File.Copy(de, tmp, true);
            if (File.Exists(para)) File.Delete(para);
            File.Move(tmp, para);
        }

        static void Escrever(string arq, string texto)
        {
            var tmp = arq + ".tmp"; File.WriteAllText(tmp, texto, new System.Text.UTF8Encoding(false));
            if (File.Exists(arq)) File.Delete(arq);
            File.Move(tmp, arq);
        }

        /// <summary>A partida terminou (ou a mesa a descartou): a pasta sai.</summary>
        public static bool Apagar(string id)
        {
            var p = PastaDe(id); if (p == null || !Directory.Exists(p)) return false;
            try { Directory.Delete(p, true); return true; } catch { return false; }
        }

        /// <summary>No maximo Maximo partidas guardadas: as mais antigas saem (e as pastas sem ficha, restos de uma gravacao que
        /// nao terminou).</summary>
        public static void Podar(int maximo = Maximo)
        {
            if (string.IsNullOrEmpty(Raiz) || !Directory.Exists(Raiz)) return;
            var boas = Todos();
            foreach (var a in boas.Skip(Math.Max(1, maximo))) try { Directory.Delete(a.Pasta, true); } catch { }
            var ficam = new HashSet<string>(boas.Take(Math.Max(1, maximo)).Select(a => Path.GetFullPath(a.Pasta).TrimEnd('/', '\\')), StringComparer.OrdinalIgnoreCase);
            foreach (var p in Directory.GetDirectories(Raiz))
                if (!ficam.Contains(Path.GetFullPath(p).TrimEnd('/', '\\')) && !File.Exists(Path.Combine(p, "ficha.json")) && Directory.GetLastWriteTimeUtc(p) < DateTime.UtcNow.AddHours(-1))
                    try { Directory.Delete(p, true); } catch { }
        }

        public EstadoDoMapa LerEstado() => JsonConvert.DeserializeObject<EstadoDoMapa>(File.ReadAllText(CaminhoEstado));
    }

    /// <summary>
    /// v265: o estado do mod numa partida de mapa, no instante em que o jogo grava. O jogo guarda o que e dele (herois,
    /// inimigos com vida e condicoes, rodada, fase, objetivo, casas bloqueadas); isto guarda o que e do Bigorna: o roteiro
    /// (variaveis, gatilhos, objetivos, contagens), as pecas (na mesa, ocultas, fora, movidas), os objetos (usados, a vista,
    /// onde estao), de onde veio cada inimigo, os protegidos, o pool de itens, os destaques e a equipe de origem.
    /// </summary>
    public class EstadoDoMapa
    {
        [JsonProperty("version")] public int Versao = 1;
        /// <summary>As entidades do jogo que o mod criou (pecas e objetos): saem da gravacao ao retomar (o jogo nao as tem na cena;
        /// o mod as poe de novo).</summary>
        [JsonProperty("ours")] public List<string> Nossos = new List<string>();
        [JsonProperty("script")] public RoteiroE Roteiro = new RoteiroE();
        [JsonProperty("board")] public TabuleiroE Tabuleiro = new TabuleiroE();
        [JsonProperty("objects")] public List<ObjetoE> Objetos = new List<ObjetoE>();
        [JsonProperty("enemies")] public InimigosE Inimigos = new InimigosE();
        [JsonProperty("escort")] public EscoltaE Escolta = new EscoltaE();
        [JsonProperty("loot")] public ButimE Butim = new ButimE();
        [JsonProperty("highlights")] public RealcesE Realces = new RealcesE();
        [JsonProperty("origin")] public OrigemE Origem;

        public class RoteiroE
        {
            [JsonProperty("vars")] public Dictionary<string, int> Vars = new Dictionary<string, int>();
            [JsonProperty("fired")] public List<string> Disparados = new List<string>();
            [JsonProperty("times")] public Dictionary<string, int> Vezes = new Dictionary<string, int>();
            [JsonProperty("off")] public List<string> Desligados = new List<string>();
            [JsonProperty("announced")] public List<string> Anunciadas = new List<string>();
            [JsonProperty("levels")] public List<string> Niveis = new List<string>();
            [JsonProperty("timers")] public List<CronometroE> Cronometros = new List<CronometroE>();
            [JsonProperty("objective")] public int Atual;
            [JsonProperty("optionalsDone")] public List<int> OpcionaisFeitos = new List<int>();
            [JsonProperty("alive")] public Dictionary<string, string> Vivos = new Dictionary<string, string>();
            [JsonProperty("defeated")] public int Derrotados;
            [JsonProperty("defeatedByGroup")] public Dictionary<string, int> DerrotadosPorGrupo = new Dictionary<string, int>();
            [JsonProperty("emptyGroups")] public List<string> GruposVazios = new List<string>();
            [JsonProperty("round")] public int Rodada = -1;
            [JsonProperty("health")] public Dictionary<string, int> Saude = new Dictionary<string, int>();
        }
        public class CronometroE { [JsonProperty("id")] public string Id; [JsonProperty("every")] public int Cada; [JsonProperty("left")] public int Restam; [JsonProperty("next")] public int Proxima; [JsonProperty("object")] public int Objeto = -1; }

        public class TabuleiroE
        {
            /// <summary>Cada peca do mapa (pelo indice): 0 na mesa, 1 oculta (sala ainda fechada), 2 fora da mesa.</summary>
            [JsonProperty("tiles")] public List<PecaE> Pecas = new List<PecaE>();
            [JsonProperty("hidden")] public List<string> Ocultas = new List<string>();
            [JsonProperty("removedCells")] public List<int[]> Tiradas = new List<int[]>();
            [JsonProperty("cellGroups")] public List<CasaE> GrupoDaCasa = new List<CasaE>();
        }
        public const int NaMesa = 0, Oculta = 1, Fora = 2;
        public class PecaE { [JsonProperty("i")] public int I; [JsonProperty("state")] public int Estado; [JsonProperty("moved")] public Dmap.Peca Movida; }
        public class CasaE { [JsonProperty("x")] public int X; [JsonProperty("y")] public int Y; [JsonProperty("group")] public string Grupo; }

        public class ObjetoE
        {
            [JsonProperty("i")] public int I;
            [JsonProperty("used")] public bool Usado;
            [JsonProperty("times")] public int Vezes;
            [JsonProperty("group")] public string Grupo;
            [JsonProperty("hidden")] public bool Escondido;
            [JsonProperty("hiddenByAction")] public bool EscondidoPorAcao;
            [JsonProperty("visible")] public bool Visivel;
            [JsonProperty("pos")] public int[] Pos;
            [JsonProperty("rot")] public int Rot;
            [JsonProperty("level")] public int Nivel;
        }

        public class InimigosE
        {
            [JsonProperty("groupOf")] public Dictionary<string, string> GrupoDe = new Dictionary<string, string>();
            [JsonProperty("modelOf")] public Dictionary<string, string> ModeloDe = new Dictionary<string, string>();
            [JsonProperty("originOf")] public Dictionary<string, OrigemRef> OrigemDe = new Dictionary<string, OrigemRef>();
            [JsonProperty("reserve")] public List<string> Reserva = new List<string>();
            [JsonProperty("waiting")] public List<EsperaE> EmSalaOculta = new List<EsperaE>();
            [JsonProperty("bank")] public int Banco;
        }
        /// <summary>Uma entrada de inimigo: a do mapa (pelo indice em spawns.enemies) ou uma feita no jogo (gatilho, vaga balanceada).</summary>
        public class OrigemRef { [JsonProperty("i")] public int I = -1; [JsonProperty("own")] public Dmap.Inimigo Propria; }
        public class EsperaE { [JsonProperty("enemy")] public OrigemRef Inimigo; [JsonProperty("room")] public string Sala; }

        public class EscoltaE
        {
            [JsonProperty("names")] public List<string> Chaves = new List<string>();
            [JsonProperty("rules")] public List<RegraE> Regras = new List<RegraE>();
            [JsonProperty("round")] public Dictionary<string, string> DaRodada = new Dictionary<string, string>();
            [JsonProperty("roundNo")] public int Rodada = int.MinValue;
        }
        public class RegraE { [JsonProperty("name")] public string Nome; [JsonProperty("group")] public string Grupo; [JsonProperty("chance")] public int Chance; }

        public class ButimE
        {
            /// <summary>O pool de itens em jogo (null: o do mapa, sem mudancas).</summary>
            [JsonProperty("pool")] public List<string> Pool;
            [JsonProperty("given")] public List<string> DoPool = new List<string>();
        }

        /// <summary>As casas destacadas pelo mod (posicoes no mundo), por lista: ate serem apagadas, ate a proxima rodada, destinos.</summary>
        public class RealcesE
        {
            [JsonProperty("kept")] public List<float[]> Realces = new List<float[]>();
            [JsonProperty("untilRound")] public List<float[]> AteARodada = new List<float[]>();
            [JsonProperty("targets")] public List<float[]> Destinos = new List<float[]>();
        }

        /// <summary>A partida gravada de onde veio a equipe ("Usar meus herois"), para a escolha do fim.</summary>
        public class OrigemE
        {
            [JsonProperty("slot")] public int Slot; [JsonProperty("name")] public string Nome; [JsonProperty("guid")] public string Guid;
            [JsonProperty("act")] public int Ato; [JsonProperty("when")] public long Quando; [JsonProperty("midQuest")] public bool NoMeio;
            [JsonProperty("campaign")] public string Campanha; [JsonProperty("stamp")] public long Carimbo;
        }

        public string ParaJson() => JsonConvert.SerializeObject(this, Formatting.None, new JsonSerializerSettings { NullValueHandling = NullValueHandling.Ignore });
        public static EstadoDoMapa DeJson(string t) => JsonConvert.DeserializeObject<EstadoDoMapa>(t);
    }
}
