using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;

namespace Bigorna.Formato
{
    /// <summary>
    /// v319: o acompanhamento das equipes nos mapas oneshot, para o Perigo se ajustar sozinho. A cada mapa terminado fica um
    /// registro (o Perigo jogado, vitoria ou derrota, as rodadas, os herois feridos, os monstros derrotados) num arquivo por
    /// equipe, em Bigorna\Equipes. O indice olha os ultimos 3 mapas: derrota pesa -1, vitoria sem ferido +1, vitoria com
    /// feridos 0; soma de 2 ou mais sobe 1 ponto do Perigo, soma negativa desce 1 (um passo por mapa, entre 1 e 10).
    /// Sem dependencia da Unity.
    /// </summary>
    public static class Equipes
    {
        public class Registro
        {
            [JsonProperty("when")] public string Quando;
            [JsonProperty("seed")] public string Semente;
            [JsonProperty("map")] public string Mapa;
            [JsonProperty("danger")] public int Perigo;
            [JsonProperty("won")] public bool Venceu;
            [JsonProperty("rounds")] public int Rodadas;
            [JsonProperty("heroes")] public int Herois;
            [JsonProperty("injured")] public int Feridos;
            [JsonProperty("badlyInjured")] public int Graves;
            [JsonProperty("enemies")] public int Monstros;
        }

        public static string Pasta;   // (o mod diz onde: Bigorna\Equipes)
        const int Guardados = 30;

        static string Arquivo(string equipe)
        {
            var n = string.IsNullOrWhiteSpace(equipe) ? "_nova" : equipe.Trim();
            foreach (var c in Path.GetInvalidFileNameChars()) n = n.Replace(c, '_');
            return Path.Combine(Pasta ?? ".", n + ".json");
        }

        public static List<Registro> Ler(string equipe)
        {
            try { var a = Arquivo(equipe); if (File.Exists(a)) return JsonConvert.DeserializeObject<List<Registro>>(File.ReadAllText(a)) ?? new List<Registro>(); }
            catch { }
            return new List<Registro>();
        }

        public static void Registrar(string equipe, Registro r)
        {
            if (r == null || string.IsNullOrEmpty(Pasta)) return;
            var l = Ler(equipe); l.Add(r); if (l.Count > Guardados) l = l.Skip(l.Count - Guardados).ToList();
            Directory.CreateDirectory(Pasta);
            File.WriteAllText(Arquivo(equipe), JsonConvert.SerializeObject(l, Formatting.Indented));
        }

        /// <summary>O peso de um mapa no indice: derrota -1, vitoria sem ferido +1, vitoria com feridos 0.</summary>
        public static int Peso(Registro r) => r == null ? 0 : !r.Venceu ? -1 : (r.Feridos + r.Graves) == 0 ? 1 : 0;

        /// <summary>O Perigo sugerido para a equipe pelo historico (0: sem historico): o do ultimo mapa, um ponto acima ou abaixo
        /// conforme os ultimos 3.</summary>
        public static int Sugerido(string equipe)
        {
            var l = Ler(equipe).Where(r => r != null && r.Perigo >= 1).ToList(); if (l.Count == 0) return 0;
            var u = l.Skip(Math.Max(0, l.Count - 3)).ToList(); int soma = u.Sum(Peso), ultimo = u[u.Count - 1].Perigo;
            // (um mapa so: so uma derrota desce; subir pede dois mapas bons)
            int passo = soma >= 2 ? 1 : soma < 0 ? -1 : 0;
            return Math.Max(1, Math.Min(10, ultimo + passo));
        }
    }
}
