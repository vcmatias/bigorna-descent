using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Bigorna.Formato
{
    /// <summary>
    /// Modelo do arquivo .dmap (mesmo JSON exportado pelo editor DescentForge).
    /// Tudo tolerante: campos ausentes viram valores vazios, nunca excecao.
    /// </summary>
    public class Dmap
    {
        public class Meta
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("name")] public string Nome;
            [JsonProperty("author")] public string Autor;
            [JsonProperty("description")] public string Descricao;
            [JsonProperty("difficulty")] public string Dificuldade;
            [JsonProperty("heroCount")] public int[] Herois;
            [JsonProperty("estimatedMinutes")] public int Minutos;
            [JsonProperty("intro")] public string Intro;
            [JsonProperty("music")] public Musica Musica;
            /// <summary>Extensao Bigorna v3: cena base pedida, fundo dos quadros narrativos.</summary>
            [JsonProperty("scene")] public string Cena;
            [JsonProperty("background")] public string Fundo;
        }

        public class Musica
        {
            [JsonProperty("file")] public string Arquivo;
            [JsonProperty("url")] public string Url;
            [JsonProperty("title")] public string Titulo;
            [JsonProperty("when")] public string Quando;
            [JsonProperty("loop")] public bool Repetir = true;
            /// <summary>Extensao Bigorna v3: evento Wwise de musica do jogo.</summary>
            [JsonProperty("event")] public string Evento;
        }

        public class Tabuleiro
        {
            [JsonProperty("tiles")] public List<Peca> Pecas = new List<Peca>();
            [JsonProperty("blocked")] public List<int[]> Bloqueadas = new List<int[]>();
            [JsonProperty("baseScene")] public string CenaBase;
            [JsonProperty("floor")] public string Piso;
            [JsonProperty("levels")] public int Niveis = 1;
            [JsonProperty("gridSize")] public JToken Grade;
        }

        public class Peca
        {
            [JsonProperty("tile")] public string Tile;
            [JsonProperty("pos")] public int[] Pos;
            [JsonProperty("rot")] public int Rot;
            [JsonProperty("level")] public int Nivel;
            /// <summary>Sala oculta: a peca so entra quando o grupo for revelado. O editor ja exportou como "reveal" e como "group".</summary>
            [JsonProperty("reveal")] public string Revelar;
            [JsonProperty("group")] public string GrupoAlt;
            /// <summary>Extensao Bigorna v3: pilares que sustentam esta peca (entram com ela).</summary>
            [JsonProperty("pillars")] public List<Pilar> Pilares = new List<Pilar>();
            [JsonIgnore] public string Grupo => string.IsNullOrEmpty(Revelar) ? GrupoAlt : Revelar;
            [JsonIgnore] public int X => Pos != null && Pos.Length > 0 ? Pos[0] : 0;
            [JsonIgnore] public int Y => Pos != null && Pos.Length > 1 ? Pos[1] : 0;
        }

        public class Pilar
        {
            [JsonProperty("pos")] public int[] Pos;
            [JsonProperty("type")] public string Tipo;
            [JsonIgnore] public int Altura => Tipo == "PillarTall" ? 3 : Tipo == "Pillar" ? 2 : 1;
        }
        public class Conteudo
        {
            [JsonProperty("enemies")] public List<Inimigo> Inimigos = new List<Inimigo>();
            [JsonProperty("heroStart")] public List<int[]> InicioHerois = new List<int[]>();
            [JsonProperty("interactables")] public List<Objeto> Objetos = new List<Objeto>();
            /// <summary>Extensao Bigorna: inimigos que podem sair nas geracoes aleatorias (spawnRandom) desde o inicio.</summary>
            [JsonProperty("reserve")] public List<string> Reserva = new List<string>();
            /// <summary>Pool de itens do mapa: os itens que se pode obter nele (os gatilhos de item aleatorio sorteiam daqui).</summary>
            [JsonProperty("itemPool")] public List<string> PoolItens = new List<string>();
            /// <summary>Extensao Bigorna: a regra do jogo para os monstros "balanced from enemy pool" (faixa de tier e progresso).</summary>
            [JsonProperty("balance")] public Balanco Balanco;
        }

        public class Balanco
        {
            [JsonProperty("minTier")] public int TierMinimo = 1;
            [JsonProperty("maxTier")] public int TierMaximo = 3;
            [JsonProperty("progression")] public int Progresso = 20;
        }

        public class Inimigo
        {
            [JsonProperty("enemy")] public string Id;
            [JsonProperty("pos")] public int[] Pos;
            [JsonProperty("group")] public string Grupo;
            [JsonProperty("tier")] public int Tier;
            [JsonProperty("level")] public int Nivel;
            [JsonProperty("text")] public string Texto;
            /// <summary>Marca do inimigo com gatilhos proprios "ao ser derrotado": enemyDefeated sai com ela (tag).</summary>
            [JsonProperty("tag")] public int Marca;
            /// <summary>Vaga "balanced from enemy pool" (enemy = "@pool"): os monstros que podem sair nela e a intensidade da sala.</summary>
            [JsonProperty("pool")] public List<string> Pool;
            [JsonProperty("intensity")] public int Intensidade;
            /// <summary>Tier pelo numero de herois (posicao 0 = 1 heroi ... 3 = 4 herois), como os chefes do jogo; vazio = Tier.</summary>
            [JsonProperty("tierByHeroes")] public int[] TierPorHerois;
            /// <summary>Um campeao (gerador de mapas): +ataque ou +defesa sobre o nivel, aplicados quando ele entra.</summary>
            [JsonProperty("attackBonus")] public int BonusAtaque;
            [JsonProperty("defenseBonus")] public int BonusDefesa;
        }

        public class Objeto
        {
            [JsonProperty("type")] public string Tipo;
            [JsonProperty("pos")] public int[] Pos;
            [JsonProperty("level")] public int Nivel;
            [JsonProperty("rot")] public int Rot;
            [JsonProperty("name")] public string Nome;
            [JsonProperty("text")] public string Texto;
            /// <summary>Extensao Bigorna: texto de "olhar" (clique sem heroi escolhido), sem gastar o objeto.</summary>
            [JsonProperty("preview")] public string Previa;
            /// <summary>Extensao Bigorna: o que o objeto e depois de gasto (um bau aberto, um corpo ja revistado). Uma ficha de interacao
            /// gasta sem este texto sai da mesa; com ele, fica como cenario e o toque mostra o texto.</summary>
            [JsonProperty("spent")] public string TextoGasto;
            [JsonProperty("loot")] public Butim Butim;
            [JsonProperty("behavior")] public string Comportamento;
            [JsonProperty("uses")] public string Usos;
            /// <summary>Extensao Bigorna: gemeo de outro objeto (indice): o toque nele vale pelo outro, e os dois somem e aparecem juntos
            /// (dois pontos de interesse sob um arco, em simetria).</summary>
            [JsonProperty("twin")] public int Gemeo = -1;
            [JsonProperty("freeAction")] public bool AcaoGratis;
            /// <summary>Extensao Bigorna: comeca escondido ate um showObject.</summary>
            [JsonProperty("hidden")] public bool Escondido;
            /// <summary>"vertex": o objeto fica no cruzamento de quatro casas (pos = canto superior esquerdo da casa pos). Pilares curtos e altos sempre ficam ali (como no DescentForge).</summary>
            [JsonProperty("anchor")] public string Ancora;
            /// <summary>Extensao Bigorna v3: sala oculta a que o objeto pertence (mesmo sem casa por baixo).</summary>
            [JsonProperty("reveal")] public string Revelar;
            /// <summary>Extensao Bigorna: objeto da Oficina (id em custom.objects); o corpo no app e a ficha de interacao.</summary>
            [JsonProperty("custom")] public string Proprio;
            /// <summary>Extensao Bigorna: as casas que o objeto cobre, ja giradas (objetos da Oficina).</summary>
            [JsonProperty("cells")] public int[][] Casas;
            /// <summary>Pilar de sustentacao: indice da peca a que pertence (entra com ela); -1 para objetos comuns.</summary>
            [JsonIgnore] public int DaPeca = -1;
            [JsonIgnore] public bool NoCruzamento => !string.Equals(Ancora, "cell", StringComparison.OrdinalIgnoreCase) && (string.Equals(Ancora, "vertex", StringComparison.OrdinalIgnoreCase) || Tipo == "PillarShort" || Tipo == "PillarTall");
            [JsonIgnore] public bool EhPilar => Tipo != null && Tipo.StartsWith("Pillar", StringComparison.OrdinalIgnoreCase);
            /// <summary>Escadas e pontes sao chao: entram na grade como pecas.</summary>
            [JsonIgnore] public bool EhTerreno => Tipo == "Staircase" || Tipo == "Bridge";
            [JsonIgnore] public int X => Pos != null && Pos.Length > 0 ? Pos[0] : 0;
            [JsonIgnore] public int Y => Pos != null && Pos.Length > 1 ? Pos[1] : 0;
            [JsonIgnore] public bool TemPosicao => Pos != null && Pos.Length >= 2;
        }

        public class Personalizado
        {
            [JsonProperty("enemies")] public List<JObject> Inimigos = new List<JObject>();
            [JsonProperty("items")] public List<JObject> Itens = new List<JObject>();
            [JsonProperty("characters")] public List<JObject> Personagens = new List<JObject>();
            /// <summary>Herois da Oficina: alteram um dos seis herois do jogo (nome, retrato, figura, armas).</summary>
            [JsonProperty("heroes")] public List<JObject> Herois = new List<JObject>();
            /// <summary>Armas da Oficina: pecas alteradas de uma arma do jogo, ou uma arma nova no lugar dela.</summary>
            [JsonProperty("weapons")] public List<JObject> Armas = new List<JObject>();
            /// <summary>As duas armas que cada heroi segura: {hero, weapons: [id, id]} (so os que mudam).</summary>
            [JsonProperty("heroWeapons")] public List<JObject> Maos = new List<JObject>();
            /// <summary>Receitas da Oficina: {id, game?, item, ingredients: [{material, qty}], value, start}.</summary>
            [JsonProperty("recipes")] public List<JObject> Receitas = new List<JObject>();
            /// <summary>Pericias da Oficina: {id, game?, hero, name, cost} (as cartas ficam na mesa).</summary>
            [JsonProperty("skills")] public List<JObject> Pericias = new List<JObject>();
            /// <summary>Facanhas da Oficina: {id, game?, hero, text, goal, timing, required, act, rewards?, params?}.</summary>
            [JsonProperty("feats")] public List<JObject> Facanhas = new List<JObject>();
            /// <summary>Pool de facanhas: para os herois com alguma aqui, so estas sao oferecidas.</summary>
            [JsonProperty("featPool")] public List<string> PoolFacanhas = new List<string>();
            /// <summary>Pecas da Oficina: forma (casas relativas a pos, giradas por rot como uma peca do jogo) e cor.</summary>
            [JsonProperty("tiles")] public List<PecaPropria> Pecas = new List<PecaPropria>();
            /// <summary>Objetos da Oficina: forma, cor e icone (PNG em data URI, opcional).</summary>
            [JsonProperty("objects")] public List<ObjetoProprio> Objetos = new List<ObjetoProprio>();
        }
        public class PecaPropria
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("name")] public string Nome;
            [JsonProperty("cells")] public int[][] Casas;
            [JsonProperty("colour")] public string Cor;
            /// <summary>Peca de fundo (underlay): vai sob as pecas de chao, no nivel 0.</summary>
            [JsonProperty("underlay")] public bool Fundo;
            [JsonProperty("copies")] public int Copias = 1;
            /// <summary>Uma imagem (PNG/JPG em data URI) estendida sobre o retangulo que envolve as casas.</summary>
            [JsonProperty("texture")] public string Textura;
            /// <summary>Uma imagem repetida em cada casa (como as pecas do jogo).</summary>
            [JsonProperty("squareTexture")] public string TexturaRepetida;
        }
        public class ObjetoProprio
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("name")] public string Nome;
            [JsonProperty("cells")] public int[][] Casas;
            [JsonProperty("colour")] public string Cor;
            [JsonProperty("icon")] public string Icone;
            /// <summary>"token" (ficha de interacao) ou "standee" (cartao em pe com a imagem).</summary>
            [JsonProperty("display")] public string Exibir;
            /// <summary>Imagem do cartao em pe (PNG em data URI).</summary>
            [JsonProperty("standee")] public string Cartao;
            /// <summary>Altura do cartao em casas.</summary>
            [JsonProperty("standeeHeight")] public float AlturaCartao = 1.4f;
            [JsonIgnore] public bool EhCartao => string.Equals(Exibir, "standee", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(Cartao);
            /// <summary>Imagem do topo do bloco (PNG em data URI; vazio usa o icone).</summary>
            [JsonProperty("blockTop")] public string TopoDoBloco;
            /// <summary>Altura do bloco em casas.</summary>
            [JsonProperty("blockHeight")] public float AlturaDoBloco = 0.6f;
            [JsonIgnore] public bool EhBloco => string.Equals(Exibir, "block", StringComparison.OrdinalIgnoreCase);
            /// <summary>Modelo 3D: arquivo OBJ ao lado do mapa, textura (data URI, opcional), altura em casas e giro.</summary>
            [JsonProperty("model")] public string Modelo;
            [JsonProperty("modelTexture")] public string TexModelo;
            [JsonProperty("modelHeight")] public float AlturaModelo = 1f;
            [JsonProperty("modelTurn")] public float GiroModelo;
            [JsonIgnore] public bool EhModelo => string.Equals(Exibir, "model", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(Modelo);
        }
        public PecaPropria PecaDaOficina(string id) => string.IsNullOrEmpty(id) || Custom?.Pecas == null ? null : Custom.Pecas.FirstOrDefault(p => p != null && string.Equals(p.Id, id, StringComparison.Ordinal));
        public ObjetoProprio ObjetoDaOficina(string id) => string.IsNullOrEmpty(id) || Custom?.Objetos == null ? null : Custom.Objetos.FirstOrDefault(p => p != null && string.Equals(p.Id, id, StringComparison.Ordinal));
        public class Butim
        {
            [JsonProperty("mode")] public string Modo = "none";
            [JsonProperty("items")] public List<string> Itens = new List<string>();
            [JsonProperty("traits")] public List<string> Tracos = new List<string>();
            [JsonProperty("points")] public int Pontos;
            [JsonProperty("count")] public int Quantos;
            [JsonProperty("gold")] public int Ouro;
            [JsonProperty("materials")] public int Materiais;
            [JsonProperty("recipes")] public int Receitas;
            [JsonProperty("gear")] public int Equipamento;
        }

        public class Objetivos
        {
            [JsonProperty("primary")] public List<Objetivo> Principais = new List<Objetivo>();
            [JsonProperty("optional")] public List<Objetivo> Opcionais = new List<Objetivo>();
            [JsonProperty("failConditions")] public List<Objetivo> Derrota = new List<Objetivo>();
        }

        public class Objetivo
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("params")] public Dictionary<string, object> Params = new Dictionary<string, object>();
            [JsonProperty("text")] public string Texto;
            /// <summary>Extensao Bigorna v3: missao anunciada por gatilho (fica escondida ate announceMission) e a sua chave.</summary>
            [JsonProperty("hidden")] public bool Escondido;
            [JsonProperty("mission")] public string Missao;
        }

        public class Gatilho
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("name")] public string Nome;
            [JsonProperty("once")] public bool UmaVez = true;
            /// <summary>Extensao Bigorna: comeca desligado ate um enableTrigger.</summary>
            [JsonProperty("disabled")] public bool Desligado;
            [JsonProperty("event")] public Clausula Evento = new Clausula();
            [JsonProperty("conditions")] public List<Clausula> Condicoes = new List<Clausula>();
            [JsonProperty("actions")] public List<Clausula> Acoes = new List<Clausula>();
            /// <summary>Extensao Bigorna v3: o que corre quando as condicoes falham (requisito nao cumprido).</summary>
            [JsonProperty("else")] public List<Clausula> Senao = new List<Clausula>();
            [JsonIgnore] public string Rotulo => string.IsNullOrEmpty(Nome) ? Id : Nome;
        }

        /// <summary>Evento, condicao ou acao: um id e um saco de parametros.</summary>
        public class Clausula
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("params")] public Dictionary<string, object> Params = new Dictionary<string, object>();
        }

        [JsonProperty("format")] public string Formato;
        [JsonProperty("version")] public int Versao;
        [JsonProperty("meta")] public Meta Metadados = new Meta();
        [JsonProperty("board")] public Tabuleiro Board = new Tabuleiro();
        [JsonProperty("spawns")] public Conteudo Spawns = new Conteudo();
        [JsonProperty("objectives")] public Objetivos Roteiro = new Objetivos();
        [JsonProperty("triggers")] public List<Gatilho> Gatilhos = new List<Gatilho>();
        /// <summary>Extensao Bigorna v3: monstros, itens e personagens proprios do mapa (fichas completas).</summary>
        [JsonProperty("custom")] public Personalizado Custom = new Personalizado();

        [JsonIgnore] public string Caminho;

        [JsonIgnore]
        public string NomeVisivel => !string.IsNullOrEmpty(Metadados?.Nome) ? Metadados.Nome : Path.GetFileNameWithoutExtension(Caminho ?? "mapa");

        [JsonIgnore]
        public string Resumo
        {
            get
            {
                var partes = new List<string>();
                if (!string.IsNullOrEmpty(Metadados?.Autor)) partes.Add("por " + Metadados.Autor);
                partes.Add((Board?.Pecas?.Count ?? 0) + " peças");
                partes.Add((Spawns?.Inimigos?.Count ?? 0) + " inimigos");
                partes.Add((Gatilhos?.Count ?? 0) + " gatilhos");
                if (Metadados?.Herois != null && Metadados.Herois.Length == 2) partes.Add(Metadados.Herois[0] + " a " + Metadados.Herois[1] + " heróis");
                return string.Join(" · ", partes.ToArray());
            }
        }

        /// <summary>A versao do formato que este mod conhece. Um mapa de versao maior (de um editor mais novo) e lido do mesmo
        /// jeito: o que este mod nao conhece fica de fora, sem erro (regras em compat/LEIAME.md).</summary>
        public const int VersaoAtual = 3;

        public static Dmap Carregar(string caminho)
        {
            var d = JsonConvert.DeserializeObject<Dmap>(File.ReadAllText(caminho));
            if (d == null) throw new Exception("arquivo vazio");
            if (d.Formato != "dmap") throw new Exception("não é um .dmap (format=" + d.Formato + ")");
            if (d.Versao > VersaoAtual) Log.Info("«" + Path.GetFileName(caminho) + "» foi feito num editor mais novo (formato v" + d.Versao + "; este mod lê até v" + VersaoAtual + "): o que ele não conhece fica de fora. Atualize o Bigorna.");
            d.Caminho = caminho;
            d.Normalizar();
            return d;
        }

        public void Normalizar()
        {
            if (Metadados == null) Metadados = new Meta();
            if (Board == null) Board = new Tabuleiro();
            if (Board.Pecas == null) Board.Pecas = new List<Peca>();
            if (Board.Bloqueadas == null) Board.Bloqueadas = new List<int[]>();
            if (Spawns == null) Spawns = new Conteudo();
            if (Spawns.Inimigos == null) Spawns.Inimigos = new List<Inimigo>();
            if (Spawns.InicioHerois == null) Spawns.InicioHerois = new List<int[]>();
            if (Spawns.Objetos == null) Spawns.Objetos = new List<Objeto>();
            if (Roteiro == null) Roteiro = new Objetivos();
            if (Roteiro.Principais == null) Roteiro.Principais = new List<Objetivo>();
            if (Roteiro.Opcionais == null) Roteiro.Opcionais = new List<Objetivo>();
            if (Roteiro.Derrota == null) Roteiro.Derrota = new List<Objetivo>();
            if (Gatilhos == null) Gatilhos = new List<Gatilho>();
            Gatilhos.RemoveAll(g => g == null);
            Spawns.Inimigos.RemoveAll(i => i == null);
            Spawns.Objetos.RemoveAll(o => o == null);
            Board.Pecas.RemoveAll(p => p == null);
            int n = 0;
            foreach (var g in Gatilhos)
            {
                if (g.Evento == null) g.Evento = new Clausula();
                if (g.Condicoes == null) g.Condicoes = new List<Clausula>();
                if (g.Acoes == null) g.Acoes = new List<Clausula>();
                g.Condicoes.RemoveAll(c => c == null);
                g.Acoes.RemoveAll(a => a == null);
                if (string.IsNullOrEmpty(g.Id)) g.Id = "t" + (++n) + "_" + Math.Abs((g.Nome ?? "").GetHashCode());
            }
            foreach (var o in Roteiro.Principais.Concat(Roteiro.Opcionais).Concat(Roteiro.Derrota))
                if (o != null && o.Params == null) o.Params = new Dictionary<string, object>();
            foreach (var g in Gatilhos) { if (g.Senao == null) g.Senao = new List<Clausula>(); g.Senao.RemoveAll(a => a == null); }
            if (Custom == null) Custom = new Personalizado();
            if (Custom.Inimigos == null) Custom.Inimigos = new List<JObject>(); if (Custom.Itens == null) Custom.Itens = new List<JObject>(); if (Custom.Personagens == null) Custom.Personagens = new List<JObject>();
            if (Custom.Pecas == null) Custom.Pecas = new List<PecaPropria>(); if (Custom.Objetos == null) Custom.Objetos = new List<ObjetoProprio>();
            Custom.Pecas.RemoveAll(p => p == null || p.Casas == null || p.Casas.Length == 0); Custom.Objetos.RemoveAll(p => p == null);
            // v3: os pilares de cada peca viram objetos no cruzamento, presos a peca (entram junto com ela); ficam depois dos objetos do mapa, para nao mudar os indices
            for (int pi = 0; pi < Board.Pecas.Count; pi++)
            {
                var p = Board.Pecas[pi];
                if (p.Pilares == null) { p.Pilares = new List<Pilar>(); continue; }
                foreach (var q in p.Pilares)
                {
                    if (q == null || q.Pos == null || q.Pos.Length < 2) continue;
                    var tipo = q.Tipo == "PillarTall" || q.Tipo == "Pillar" ? q.Tipo : "PillarShort";
                    Spawns.Objetos.Add(new Objeto { Tipo = tipo, Pos = new[] { q.Pos[0], q.Pos[1] }, Rot = 0, Nivel = Math.Max(0, p.Nivel - q.Altura), Nome = "", Texto = "", Ancora = "vertex", Revelar = p.Grupo, DaPeca = pi, Butim = new Butim(), Comportamento = "custom" });
                }
            }
        }

        public static List<Dmap> CarregarTodos(string pasta)
        {
            var lista = new List<Dmap>();
            if (!Directory.Exists(pasta)) return lista;
            foreach (var arq in Directory.GetFiles(pasta, "*.dmap").OrderBy(x => x))
            {
                try { lista.Add(Carregar(arq)); }
                catch (Exception ex) { Log.Info("mapa ilegível " + Path.GetFileName(arq) + ": " + ex.Message); }
            }
            return lista;
        }
    }

    /// <summary>Leitura tolerante de parametros vindos do JSON.</summary>
    public static class P
    {
        public static string Texto(Dictionary<string, object> p, string chave, string padrao = null)
        {
            if (p == null || !p.TryGetValue(chave, out var v) || v == null) return padrao;
            var s = v.ToString();
            return string.IsNullOrEmpty(s) ? padrao : s;
        }

        public static int Inteiro(Dictionary<string, object> p, string chave, int padrao)
        {
            if (p == null || !p.TryGetValue(chave, out var v) || v == null) return padrao;
            if (v is bool b) return b ? 1 : 0;
            if (v is long l) return (int)l;
            if (v is int i) return i;
            if (v is double d) return (int)Math.Round(d);
            return int.TryParse(v.ToString(), out var r) ? r : padrao;
        }

        public static bool Booleano(Dictionary<string, object> p, string chave, bool padrao)
        {
            if (p == null || !p.TryGetValue(chave, out var v) || v == null) return padrao;
            if (v is bool b) return b;
            var s = v.ToString().Trim().ToLowerInvariant();
            if (s.Length == 0) return padrao;
            if (int.TryParse(s, out var n)) return n != 0;
            return s == "true" || s == "sim" || s == "yes" || s == "si" || s == "sí";
        }

        public static List<int> Lista(Dictionary<string, object> p, string chave)
        {
            if (p == null || !p.TryGetValue(chave, out var v) || v == null) return null;
            var lista = new List<int>();
            if (v is JArray ja)
            {
                foreach (var t in ja) if (int.TryParse(t?.ToString(), out var n)) lista.Add(n);
                return lista;
            }
            if (v is IEnumerable<object> en)
            {
                foreach (var t in en) if (int.TryParse(t?.ToString(), out var n)) lista.Add(n);
                return lista;
            }
            var s = v.ToString();
            foreach (var parte in s.Split(new[] { ',', ' ', ';' }, StringSplitOptions.RemoveEmptyEntries))
                if (int.TryParse(parte, out var n)) lista.Add(n);
            return lista.Count > 0 ? lista : null;
        }

        public static List<string> Textos(Dictionary<string, object> p, string chave)
        {
            if (p == null || !p.TryGetValue(chave, out var v) || v == null) return null;
            var lista = new List<string>();
            if (v is JArray ja) { foreach (var t in ja) { var s = t?.ToString(); if (!string.IsNullOrEmpty(s)) lista.Add(s); } return lista; }
            var str = v.ToString();
            foreach (var parte in str.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)) lista.Add(parte.Trim());
            return lista;
        }

        /// <summary>Le uma celula: "cell": [x,y] ou "x"/"y" soltos.</summary>
        public static int[] Celula(Dictionary<string, object> p, string chave = "cell")
        {
            var l = Lista(p, chave);
            if (l != null && l.Count >= 2) return new[] { l[0], l[1] };
            if (p != null && p.ContainsKey("x") && p.ContainsKey("y")) return new[] { Inteiro(p, "x", 0), Inteiro(p, "y", 0) };
            return null;
        }

        /// <summary>Le uma area: "area": [x1,y1,x2,y2]; aceita uma celula solta como area 1x1.</summary>
        public static int[] Area(Dictionary<string, object> p, string chave = "area")
        {
            var l = Lista(p, chave);
            if (l != null && l.Count >= 4) return new[] { Math.Min(l[0], l[2]), Math.Min(l[1], l[3]), Math.Max(l[0], l[2]), Math.Max(l[1], l[3]) };
            if (l != null && l.Count >= 2) return new[] { l[0], l[1], l[0], l[1] };
            var c = Celula(p);
            if (c != null) return new[] { c[0], c[1], c[0], c[1] };
            return null;
        }

        /// <summary>Sub-lista de clausulas (para condicoes aninhadas e acoes "if").</summary>
        public static List<Dmap.Clausula> Clausulas(Dictionary<string, object> p, string chave)
        {
            if (p == null || !p.TryGetValue(chave, out var v) || v == null) return null;
            try
            {
                if (v is JArray ja) return ja.ToObject<List<Dmap.Clausula>>();
                if (v is JObject jo) return new List<Dmap.Clausula> { jo.ToObject<Dmap.Clausula>() };
            }
            catch (Exception ex) { Log.Info("cláusulas em «" + chave + "» ilegíveis: " + ex.Message); }
            return null;
        }
    }
}
