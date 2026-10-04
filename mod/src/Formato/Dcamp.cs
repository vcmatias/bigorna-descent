using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Bigorna.Formato
{
    /// <summary>Uma campanha (.dcamp): nos no mapa-mundi (mapas e paradas narrativas), dialogos e abertura. Mesmo formato do DescentForge.</summary>
    public class Dcamp
    {
        [JsonProperty("format")] public string Formato;
        [JsonProperty("version")] public int Versao;
        /// <summary>A versao do formato que este mod conhece (como Dmap.VersaoAtual).</summary>
        public const int VersaoAtual = 2;
        [JsonProperty("meta")] public Meta Metadados = new Meta();
        [JsonProperty("nodes")] public List<No> Nos = new List<No>();
        [JsonProperty("dialogues")] public List<Dialogo> Dialogos = new List<Dialogo>();
        [JsonProperty("intro")] public string Intro;
        [JsonProperty("custom")] public Dmap.Personalizado Custom = new Dmap.Personalizado();
        /// <summary>O inventario de saida do grupo (veteranos de batalhas anteriores): ouro, itens, materiais e pericias.</summary>
        [JsonProperty("start")] public Inicio Comeco;
        public class Inicio
        {
            [JsonProperty("gold")] public int Ouro;
            [JsonProperty("items")] public List<ItemInicial> Itens = new List<ItemInicial>();
            [JsonProperty("skills")] public List<string> Pericias = new List<string>();
        }
        public class ItemInicial
        {
            [JsonProperty("item")] public string Item;
            [JsonProperty("qty")] public int Qtd = 1;
        }
        [JsonIgnore] public string Caminho;
        [JsonIgnore] public string Pasta => Path.GetDirectoryName(Caminho ?? "") ?? "";
        [JsonIgnore] public string NomeVisivel => string.IsNullOrEmpty(Metadados?.Nome) ? Path.GetFileNameWithoutExtension(Caminho ?? "campanha") : Metadados.Nome;
        [JsonIgnore] public string Id => string.IsNullOrEmpty(Metadados?.Id) ? Path.GetFileNameWithoutExtension(Caminho ?? "campanha") : Metadados.Id;

        public class Meta
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("name")] public string Nome;
            [JsonProperty("author")] public string Autor;
            [JsonProperty("description")] public string Descricao;
            [JsonProperty("act")] public string Ato;
            [JsonProperty("worldMap")] public MapaDaCampanha MapaProprio;
            [JsonProperty("city")] public ImagemDaCampanha Cidade;
        }

        /// <summary>A imagem propria do mapa-mundi (ao lado do .dcamp), cobrindo o quadro de 1820x1024 do canvas dos destinos.</summary>
        public class MapaDaCampanha
        {
            [JsonProperty("file")] public string Arquivo;
            [JsonProperty("clouds")] public bool Nuvens = true;
            [JsonProperty("mist")] public bool Nevoa;
            /// <summary>As estradas desenhadas no editor: cada uma, uma linha de pontos [x, y] nas coordenadas dos destinos.
            /// Entre lugares que nenhuma estrada liga, a viagem vai em linha reta.</summary>
            [JsonProperty("roads")] public List<List<float[]>> Estradas;
            /// <summary>O lugar da cidade neste mapa [x, y]; sem ele, a cidade fica onde o jogo a pos.</summary>
            [JsonProperty("cityAt")] public float[] Cidade;
        }

        public class ImagemDaCampanha
        {
            [JsonProperty("file")] public string Arquivo;
        }

        public class No
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("name")] public string Nome;
            [JsonProperty("description")] public string Descricao;
            [JsonProperty("coords")] public float[] Coords;
            [JsonProperty("marker")] public string Marcador;      // main | side | narrative | city
            [JsonProperty("num")] public int Num;
            [JsonProperty("kind")] public string Tipo;            // scenario | dialogue
            [JsonProperty("map")] public string Mapa;
            [JsonProperty("onArrive")] public string AoChegar;
            [JsonProperty("onTravel")] public string AoViajar;
            [JsonProperty("onComplete")] public string AoCompletar;
            [JsonProperty("spawn")] public Aparicao Aparece = new Aparicao();
            [JsonProperty("rewards")] public Recompensa Premios = new Recompensa();
            [JsonIgnore] public bool EhMapa => Tipo != "dialogue" && !string.IsNullOrEmpty(Mapa);
            /// <summary>Parada que acontece na visita a cidade: nao vai ao mapa-mundi; toca quando o grupo entra na cidade.</summary>
            [JsonIgnore] public bool NaCidade => !EhMapa && string.Equals(Marcador, "city", StringComparison.OrdinalIgnoreCase);
            [JsonIgnore] public float X => Coords != null && Coords.Length > 0 ? Coords[0] : 0f;
            [JsonIgnore] public float Y => Coords != null && Coords.Length > 1 ? Coords[1] : 0f;
        }

        public class Aparicao
        {
            [JsonProperty("auto")] public bool Auto = true;
            [JsonProperty("afterNodes")] public List<string> DepoisDosNos = new List<string>();
            [JsonProperty("afterQuests")] public List<string> DepoisDasMissoes = new List<string>();
            [JsonProperty("questsThisAct")] public int MissoesDoAto;
            /// <summary>v4: no trancado ate um gatilho "unlock a campaign map" pôr esta variavel da campanha em 1.</summary>
            [JsonProperty("unlockVar")] public string VarLiberacao;
            /// <summary>v3: so aparece se a campanha lembra (ou nao) de uma escolha do grupo.</summary>
            [JsonProperty("choice")] public Escolha Escolha;
        }

        /// <summary>Uma escolha lembrada pela campanha: a variavel "choice:..." vale 1 quando o grupo fez a escolha.</summary>
        public class Escolha
        {
            [JsonProperty("var")] public string Var;
            [JsonProperty("value")] public int Valor = 1;
        }

        public class Recompensa
        {
            [JsonProperty("items")] public List<string> Itens = new List<string>();
            [JsonProperty("materials")] public int Materiais;
            [JsonProperty("gold")] public int Ouro;
        }

        public class Dialogo
        {
            [JsonProperty("id")] public string Id;
            [JsonProperty("type")] public string Tipo;            // normal | choice | ...
            [JsonProperty("speaker")] public string Personagem;
            [JsonProperty("title")] public string Titulo;
            [JsonProperty("text")] public string Texto;
            [JsonProperty("cast")] public List<string> Elenco = new List<string>();
            [JsonProperty("background")] public int Fundo = 7;
            [JsonProperty("options")] public List<Opcao> Opcoes = new List<Opcao>();
            [JsonProperty("next")] public string Seguinte;
            /// <summary>v2: acoes que correm quando a caixa aparece (dar item, liberar no...).</summary>
            [JsonProperty("actions")] public List<JObject> Acoes = new List<JObject>();
            /// <summary>v3: caixa "cutscene": o filme do jogo que toca aqui (tipo "cutscene").</summary>
            [JsonProperty("cutscene")] public string Cena;
            /// <summary>v3: caixa "video": um filme proprio (MP4/WebM) na pasta da campanha.</summary>
            [JsonProperty("video")] public string Video;
            /// <summary>v3: primeira caixa de uma cena com "so se": falhando, a cena e pulada para "skipTo".</summary>
            [JsonProperty("onlyIf")] public Escolha SoSe;
            [JsonProperty("skipTo")] public string Pular;
        }

        public class Opcao
        {
            [JsonProperty("text")] public string Texto;
            [JsonProperty("then")] public List<JObject> Entao = new List<JObject>();
        }

        public No NoPorId(string id) => string.IsNullOrEmpty(id) ? null : Nos.FirstOrDefault(n => string.Equals(n.Id, id, StringComparison.OrdinalIgnoreCase));
        public Dialogo DialogoPorId(string id) => string.IsNullOrEmpty(id) ? null : Dialogos.FirstOrDefault(d => string.Equals(d.Id, id, StringComparison.OrdinalIgnoreCase));
        public string CaminhoDoMapa(No n) { if (n == null || string.IsNullOrEmpty(n.Mapa)) return null; var c = Path.Combine(Pasta, n.Mapa); return File.Exists(c) ? c : null; }

        public static Dcamp Carregar(string caminho)
        {
            var d = JsonConvert.DeserializeObject<Dcamp>(File.ReadAllText(caminho));
            if (d == null) throw new Exception("arquivo vazio");
            if (d.Formato != "dcamp") throw new Exception("não é um .dcamp (format=" + d.Formato + ")");
            if (d.Versao > VersaoAtual) Log.Info("«" + Path.GetFileName(caminho) + "» foi feita num editor mais novo (formato v" + d.Versao + "; este mod lê até v" + VersaoAtual + "): o que ele não conhece fica de fora. Atualize o Bigorna.");
            d.Caminho = caminho;
            d.Nos = d.Nos ?? new List<No>(); d.Dialogos = d.Dialogos ?? new List<Dialogo>();
            foreach (var n in d.Nos) { n.Aparece = n.Aparece ?? new Aparicao(); n.Aparece.DepoisDosNos = n.Aparece.DepoisDosNos ?? new List<string>(); n.Aparece.DepoisDasMissoes = n.Aparece.DepoisDasMissoes ?? new List<string>(); n.Premios = n.Premios ?? new Recompensa(); n.Premios.Itens = n.Premios.Itens ?? new List<string>(); }
            foreach (var g in d.Dialogos) { g.Elenco = g.Elenco ?? new List<string>(); g.Opcoes = g.Opcoes ?? new List<Opcao>(); g.Acoes = g.Acoes ?? new List<JObject>(); foreach (var o in g.Opcoes) o.Entao = o.Entao ?? new List<JObject>(); }
            if (d.Custom == null) d.Custom = new Dmap.Personalizado();
            if (d.Custom.Inimigos == null) d.Custom.Inimigos = new List<JObject>(); if (d.Custom.Itens == null) d.Custom.Itens = new List<JObject>(); if (d.Custom.Personagens == null) d.Custom.Personagens = new List<JObject>();
            return d;
        }

        /// <summary>Todas as campanhas da pasta de mapas: um .dcamp na raiz ou em cada subpasta.</summary>
        public static List<Dcamp> CarregarTodas(string pasta)
        {
            var lista = new List<Dcamp>();
            if (!Directory.Exists(pasta)) return lista;
            var arquivos = Directory.GetFiles(pasta, "*.dcamp").ToList();
            foreach (var sub in Directory.GetDirectories(pasta)) arquivos.AddRange(Directory.GetFiles(sub, "*.dcamp"));
            foreach (var arq in arquivos.OrderBy(x => x))
            {
                try { lista.Add(Carregar(arq)); }
                catch (Exception ex) { Log.Info("campanha ilegível " + Path.GetFileName(arq) + ": " + ex.Message); }
            }
            return lista;
        }
    }
}
