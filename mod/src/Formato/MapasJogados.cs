using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;

namespace Bigorna.Formato
{
    /// <summary>
    /// v266: os mapas oneshot jogados e o que a mesa decidiu sobre cada um (guardar como mapa novo ou nao). O mapa oneshot fica
    /// em Bigorna\Oneshot\oneshot.dmap, que o proximo "Gerar" escreve por cima, e numa partida em andamento, que sai quando o
    /// mapa termina; antes de a ultima copia de um mapa jogado sair, o mod pergunta se ele vira um mapa novo da pasta de mapas
    /// (os Mapas da comunidade). A lista fica em Bigorna\Oneshot\jogados.json, pela semente. Sem dependencia da Unity.
    /// </summary>
    public static class MapasJogados
    {
        public class Item
        {
            [JsonProperty("seed")] public string Semente;
            [JsonProperty("name")] public string Nome;
            /// <summary>null: ainda sem decisao; "saved": guardado (Arquivo); "no": a mesa nao quis.</summary>
            [JsonProperty("decision")] public string Decisao;
            [JsonProperty("file")] public string Arquivo;
            [JsonProperty("when")] public long Quando;
        }
        public const string Guardado = "saved", Recusado = "no";
        const int Maximo = 300;

        /// <summary>O arquivo da lista (o mod o define: Bigorna\Oneshot\jogados.json).</summary>
        public static string Arquivo;

        static string Chave(string s) => (s ?? "").Trim().ToLowerInvariant();

        static List<Item> Ler()
        {
            try { if (!string.IsNullOrEmpty(Arquivo) && File.Exists(Arquivo)) return JsonConvert.DeserializeObject<List<Item>>(File.ReadAllText(Arquivo)) ?? new List<Item>(); } catch { }
            return new List<Item>();
        }
        static void Gravar(List<Item> l)
        {
            if (string.IsNullOrEmpty(Arquivo)) return;
            Directory.CreateDirectory(Path.GetDirectoryName(Arquivo));
            var tmp = Arquivo + ".tmp"; File.WriteAllText(tmp, JsonConvert.SerializeObject(l.OrderByDescending(x => x.Quando).Take(Maximo).ToList(), Formatting.Indented));
            if (File.Exists(Arquivo)) File.Delete(Arquivo);
            File.Move(tmp, Arquivo);
        }

        public static Item Por(string semente) { var k = Chave(semente); return k.Length == 0 ? null : Ler().FirstOrDefault(x => Chave(x.Semente) == k); }

        /// <summary>Uma partida comecou com este mapa (a decisao de antes, se houve, fica).</summary>
        public static void Jogado(string semente, string nome)
        {
            var k = Chave(semente); if (k.Length == 0) return;
            var l = Ler(); var i = l.FirstOrDefault(x => Chave(x.Semente) == k);
            if (i == null) l.Add(i = new Item { Semente = k });
            if (!string.IsNullOrEmpty(nome)) i.Nome = nome;
            i.Quando = DateTime.Now.Ticks;
            Gravar(l);
        }

        /// <summary>Jogado e ainda sem decisao: a pergunta vem antes de a ultima copia sair.</summary>
        public static bool Pendente(string semente) { var i = Por(semente); return i != null && i.Decisao == null; }

        public static void Decidir(string semente, string decisao, string arquivo = null)
        {
            var k = Chave(semente); if (k.Length == 0) return;
            var l = Ler(); var i = l.FirstOrDefault(x => Chave(x.Semente) == k);
            if (i == null) l.Add(i = new Item { Semente = k, Quando = DateTime.Now.Ticks });
            i.Decisao = decisao; if (arquivo != null) i.Arquivo = arquivo;
            Gravar(l);
        }

        /// <summary>Copia o mapa para a pasta de mapas como um mapa novo (oneshot-&lt;semente&gt;.dmap; a mesma semente guardada de novo
        /// fica no mesmo arquivo). Devolve o caminho.</summary>
        public static string GuardarComoNovo(string mapa, string pastaDeMapas, string semente)
        {
            if (string.IsNullOrEmpty(mapa) || !File.Exists(mapa)) throw new FileNotFoundException("o mapa não está lá", mapa);
            Directory.CreateDirectory(pastaDeMapas);
            var nome = "oneshot-" + new string(Chave(semente).Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());
            if (nome == "oneshot-") nome = "oneshot-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
            var destino = Path.Combine(pastaDeMapas, nome + ".dmap");
            var tmp = destino + ".tmp"; File.Copy(mapa, tmp, true);
            if (File.Exists(destino)) File.Delete(destino);
            File.Move(tmp, destino);
            return destino;
        }

        /// <summary>v266: a semente que basta sozinha (7 caracteres: o primeiro, de a a r, diz a duracao, a dificuldade e as caixas;
        /// os outros seis sao o sorteio), como o gerador do editor a le. null: outra forma (vale o que a tela escolheu).</summary>
        public static (int duracao, int dificuldade, int atos)? LerSemente(string s)
        {
            s = (s ?? "").Trim().ToLowerInvariant();
            if (s.Length != 7 || s[0] < 'a' || s[0] > 'r' || !s.Skip(1).All(c => (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z'))) return null;
            int k = s[0] - 'a';
            return (k / 6, (k / 2) % 3, k % 2 == 1 ? 2 : 1);
        }
    }
}
