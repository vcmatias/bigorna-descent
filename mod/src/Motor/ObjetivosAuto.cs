using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.D3;

namespace Bigorna.Motor
{
    /// <summary>Objetivos que o mod consegue julgar sozinho. Os demais a mesa declara.</summary>
    public static class ObjetivosAuto
    {
        static readonly HashSet<string> PorObjeto = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "use_object", "open_chest", "read_lectern", "open_vault", "open_door", "ring_bell", "use_shrine", "draw_well", "brew_cauldron",
            "discover_secret", "dialogue_complete", "choice_outcome", "deliver_item", "rescue_prisoner"
        };
        static readonly HashSet<string> PorContagemDeObjetos = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "use_n_objects", "search_shelves", "light_fires", "extinguish_fires", "open_all_chests", "reach_all_points", "collect_keys"
        };

        static readonly Dictionary<string, string> Genericos = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["defeat_all"] = "Derrotar todos os inimigos", ["defeat_boss"] = "Derrotar o chefe", ["defeat_group"] = "Derrotar o grupo",
            ["defeat_n"] = "Derrotar N inimigos", ["survive_rounds"] = "Sobreviver N rodadas", ["reach_cell"] = "Chegar à casa marcada",
            ["use_object"] = "Usar o objeto", ["open_chest"] = "Abrir o baú", ["use_n_objects"] = "Ativar os mecanismos",
        };

        public static string NomeGenerico(string id) => id != null && Genericos.TryGetValue(id, out var n) ? n : "Cumprir o objetivo";

        /// <summary>O mod julga este objetivo sozinho? Se nao, ele aparece na Mesa para ser declarado.</summary>
        public static bool Automatico(Dmap.Objetivo o)
        {
            if (o == null) return false;
            switch (o.Id)
            {
                case "defeat_all": case "defeat_group": case "defeat_boss": case "defeat_n": case "defeat_n_group":
                case "defeat_all_before_rounds": case "defeat_boss_alone": case "defeat_half": case "defeat_last_standing":
                case "survive_rounds": case "survive_no_death": case "survive_darkness": case "survive_outnumbered": case "survive_until_help":
                case "reduce_hp": case "timed_objective": case "counter_at_least": case "defeat_groups":
                    return true;
            }
            return PorObjeto.Contains(o.Id) || PorContagemDeObjetos.Contains(o.Id);
        }

        static int UsadosDoTipo(Dmap.Objetivo o)
        {
            // se o objetivo tem "type" (extensao), conta so objetos daquele tipo; senao, todos os usados
            var tipo = P.Texto(o.Params, "type");
            return Objetos.Postos.Count(p => p.Usado && (string.IsNullOrEmpty(tipo) || string.Equals(p.Dados?.Tipo, tipo, StringComparison.OrdinalIgnoreCase)));
        }

        public static bool Cumprido(Dmap.Objetivo o)
        {
            if (o == null) return false;
            var p = o.Params;
            var inimigos = Jogo.Inimigos;
            int vivos = inimigos.Count;
            int porVir = Encontro.Inimigos.AguardandoSala;   // os das salas ainda fechadas tambem contam para "todos"
            int rodada = Roteiro.Rodada;
            switch (o.Id)
            {
                case "defeat_all":
                case "defeat_last_standing":
                    return Roteiro.Derrotados > 0 && vivos == 0 && porVir == 0;
                case "defeat_all_before_rounds":
                    return Roteiro.Derrotados > 0 && vivos == 0 && porVir == 0 && rodada <= P.Inteiro(p, "rounds", 8);
                case "defeat_group":
                {
                    var g = P.Texto(p, "group");
                    return !string.IsNullOrEmpty(g) && Roteiro.GrupoResolvido(g) && Roteiro.VivosNoGrupo(g) == 0 && !Encontro.Inimigos.EsperandoDoGrupo(g);
                }
                case "defeat_boss":
                case "defeat_summoner":
                case "expose_boss":
                {
                    var id = P.Texto(p, "enemy");
                    return !string.IsNullOrEmpty(id) && Roteiro.Derrotados > 0 && !inimigos.Any(e => string.Equals(e.ModelId, id, StringComparison.OrdinalIgnoreCase));
                }
                case "defeat_boss_alone":
                {
                    var id = P.Texto(p, "enemy"); var g = P.Texto(p, "group");
                    bool chefe = !string.IsNullOrEmpty(id) && Roteiro.Derrotados > 0 && !inimigos.Any(e => string.Equals(e.ModelId, id, StringComparison.OrdinalIgnoreCase));
                    return chefe && (string.IsNullOrEmpty(g) || Roteiro.VivosNoGrupo(g) == 0);
                }
                case "defeat_n":
                    return Roteiro.Derrotados >= P.Inteiro(p, "n", 3);
                case "defeat_n_group":
                {
                    var g = P.Texto(p, "group");
                    return (string.IsNullOrEmpty(g) ? Roteiro.Derrotados : Roteiro.DerrotadosDoGrupo(g)) >= P.Inteiro(p, "n", 3);
                }
                case "defeat_half":
                    return Roteiro.Derrotados > 0 && Roteiro.Derrotados >= vivos;
                case "reduce_hp":
                {
                    var id = P.Texto(p, "enemy");
                    var e = inimigos.FirstOrDefault(x => string.Equals(x.ModelId, id, StringComparison.OrdinalIgnoreCase));
                    if (e == null) return !string.IsNullOrEmpty(id) && Roteiro.Derrotados > 0;
                    return e.StartingHealth > 0 && e.Health * 100 / e.StartingHealth <= P.Inteiro(p, "hp", 50);
                }
                case "survive_rounds": case "survive_no_death": case "survive_darkness": case "survive_outnumbered": case "survive_until_help": case "timed_objective":
                    return rodada >= P.Inteiro(p, "rounds", 8);
                case "counter_at_least":
                    return Roteiro.Var(P.Texto(p, "var")) >= P.Inteiro(p, "n", 1);
                case "defeat_groups":
                {
                    var gs = P.Textos(p, "groups") ?? new List<string>();
                    // os monstros postos na sala (grupo room-N) tem de ter entrado e caido; os de gatilhos, se entraram, tambem
                    return gs.Count > 0 && gs.All(g => Roteiro.VivosNoGrupo(g) == 0 && !Encontro.Inimigos.EsperandoDoGrupo(g) && (!g.StartsWith("room-", StringComparison.OrdinalIgnoreCase) || Roteiro.GrupoResolvido(g))) && gs.Any(Roteiro.GrupoResolvido);
                }
                case "open_all_chests":
                    return Objetos.Postos.Count(x => string.Equals(x.Dados?.Tipo, "Chest", StringComparison.OrdinalIgnoreCase)) > 0 && Objetos.Postos.Where(x => string.Equals(x.Dados?.Tipo, "Chest", StringComparison.OrdinalIgnoreCase)).All(x => x.Usado);
            }
            if (PorContagemDeObjetos.Contains(o.Id)) return UsadosDoTipo(o) >= P.Inteiro(p, "n", 1);
            return false;
        }

        /// <summary>Um objeto acabou de ser usado: isso fecha este objetivo?</summary>
        public static bool FechaComObjeto(Dmap.Objetivo o, int indice)
        {
            if (o == null) return false;
            if (PorContagemDeObjetos.Contains(o.Id)) return UsadosDoTipo(o) >= P.Inteiro(o.Params, "n", 1);
            if (!PorObjeto.Contains(o.Id)) return false;
            int alvo = P.Inteiro(o.Params, "interactable", -1);
            return alvo < 0 || alvo == indice;
        }

        /// <summary>Ao virar objetivo atual, ele ja esta cumprido?</summary>
        public static bool JaEstava(Dmap.Objetivo o)
        {
            if (o == null) return false;
            if (PorObjeto.Contains(o.Id))
            {
                int alvo = P.Inteiro(o.Params, "interactable", -1);
                return alvo >= 0 && Objetos.Usado(alvo);
            }
            if (PorContagemDeObjetos.Contains(o.Id)) return UsadosDoTipo(o) >= P.Inteiro(o.Params, "n", 1);
            return false;
        }
    }
}
