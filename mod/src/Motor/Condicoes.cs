using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Motor
{
    /// <summary>Condicoes dos gatilhos. Alem das do editor, aceita not/anyOf/allOf aninhadas e outras extensoes.</summary>
    public static class Condicoes
    {
        /// <summary>Gatilho → a condicao que o barrou da ultima vez: os eventos de nivel (variavel igual, vida abaixo...) sao
        /// olhados a cada batimento, e a mesma recusa nao precisa ir ao log tres vezes por segundo.</summary>
        static readonly Dictionary<string, string> _barrado = new Dictionary<string, string>(StringComparer.Ordinal);
        public static void Reiniciar() { _barrado.Clear(); }

        public static bool Todas(List<Dmap.Clausula> lista, Dmap.Gatilho dono)
        {
            if (lista == null || lista.Count == 0) return true;
            var chave = dono?.Id ?? "";
            foreach (var c in lista)
            {
                bool ok;
                try { ok = Avaliar(c, dono); }
                catch (Exception ex) { Log.Info("condição «" + c?.Id + "» quebrou (" + ex.Message + "); dada como falsa"); ok = false; }
                if (!ok)
                {
                    var id = c?.Id ?? "";
                    if (!_barrado.TryGetValue(chave, out var antes) || antes != id) { _barrado[chave] = id; Log.Info("  condição «" + c?.Id + "» não vale; «" + (dono?.Rotulo ?? "?") + "» não dispara"); }
                    return false;
                }
            }
            _barrado.Remove(chave);
            return true;
        }

        public static bool Avaliar(Dmap.Clausula c, Dmap.Gatilho dono)
        {
            if (c == null || string.IsNullOrEmpty(c.Id)) return true;
            var p = c.Params;
            var inimigos = Jogo.Inimigos;
            var herois = Jogo.Herois;
            switch (c.Id)
            {
                // ---- extensoes logicas
                case "not": { var sub = P.Clausulas(p, "conditions") ?? P.Clausulas(p, "condition"); return sub == null || !sub.All(s => Avaliar(s, dono)); }
                case "allOf": { var sub = P.Clausulas(p, "conditions"); return sub == null || sub.All(s => Avaliar(s, dono)); }
                case "anyOf": { var sub = P.Clausulas(p, "conditions"); return sub == null || sub.Any(s => Avaliar(s, dono)); }
                case "triggerFired": return Roteiro.JaDisparou(Roteiro.GatilhoPorId(P.Texto(p, "trigger"))?.Id);
                case "triggerNotFired": return !Roteiro.JaDisparou(Roteiro.GatilhoPorId(P.Texto(p, "trigger"))?.Id);
                case "varBelow": return Roteiro.Var(P.Texto(p, "var")) < P.Inteiro(p, "value", 1);
                case "varBetween": { int v = Roteiro.Var(P.Texto(p, "var")); return v >= P.Inteiro(p, "min", 0) && v <= P.Inteiro(p, "max", 0); }
                case "varNotEquals": return Roteiro.Var(P.Texto(p, "var")) != P.Inteiro(p, "value", 1);
                case "heroCount": return herois.Count == P.Inteiro(p, "n", 2);
                case "heroCountAtLeast": return herois.Count >= P.Inteiro(p, "n", 2);
                case "enemyCountAtLeast": return inimigos.Count >= P.Inteiro(p, "n", 1);
                case "defeatedAtLeast": return Roteiro.Derrotados >= P.Inteiro(p, "n", 1);
                case "groupAlive": return Roteiro.VivosNoGrupo(P.Texto(p, "group")) > 0;
                // como o evento groupDefeated: os do grupo que esperam uma sala fechada ainda faltam
                case "groupDefeated": { var g = P.Texto(p, "group"); return Roteiro.GrupoResolvido(g) && Roteiro.VivosNoGrupo(g) == 0 && !Inimigos.EsperandoDoGrupo(g); }
                case "groupsDefeated": { var gs = P.Textos(p, "groups") ?? new List<string>(); return gs.Count > 0 && gs.All(g => Roteiro.VivosNoGrupo(g) == 0 && !Inimigos.EsperandoDoGrupo(g)) && gs.Any(Roteiro.GrupoResolvido); }
                case "goldAtLeast": return Butim.OuroDoGrupo() >= P.Inteiro(p, "amount", 1);
                case "hasItem": { var it = P.Texto(p, "item"); return !string.IsNullOrEmpty(it) && (Roteiro.Var("item-" + it) > 0 || Butim.Tem(it)); }
                case "objectVisible": return Objetos.Pegar(P.Inteiro(p, "interactable", -1))?.Visivel == true;
                case "roomRevealed": return !Tabuleiro.GrupoOculto(P.Texto(p, "group"));
                case "roomHidden": return Tabuleiro.GrupoOculto(P.Texto(p, "group"));

                // ---- do editor
                case "varEquals": return Roteiro.Var(P.Texto(p, "var")) == P.Inteiro(p, "value", 1);
                case "campaignVar": return (Bigorna.Campanha.Campanha.Estado?.Var(P.Texto(p, "var")) ?? 0) == P.Inteiro(p, "value", 1);
                case "varAbove": return Roteiro.Var(P.Texto(p, "var")) > P.Inteiro(p, "value", 1);
                case "roundAtLeast": return Roteiro.Rodada >= P.Inteiro(p, "round", 3);
                case "roundBefore": return Roteiro.Rodada < P.Inteiro(p, "round", 3);
                case "enemyInPlay": return Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group")).Any();
                case "enemyNotInPlay": return !Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group")).Any();
                case "enemyCountBelow": return inimigos.Count < P.Inteiro(p, "n", 3);
                case "enemyHasCondition":
                {
                    var estado = P.Texto(p, "condition") ?? "";
                    return Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group")).Any(e => TemEstado(e, estado));
                }
                case "enemyHasTrait":
                {
                    var traco = P.Texto(p, "trait") ?? "";
                    return Inimigos.Vivos(P.Texto(p, "enemy"), null).Any(e => (e.Model?.MechanicalTraits.ToString() ?? "").IndexOf(traco, StringComparison.OrdinalIgnoreCase) >= 0);
                }
                case "heroInPlay":
                {
                    var id = P.Texto(p, "hero");
                    return herois.Any(h => (string.IsNullOrEmpty(id) || string.Equals(h.HeroId, id, StringComparison.OrdinalIgnoreCase)) && h.HealthState != HeroHealth.Defeated);
                }
                case "heroHasTrinket":
                {
                    var id = P.Texto(p, "trinket") ?? P.Texto(p, "hero");
                    return herois.Any(h => !string.IsNullOrEmpty(h.EquippedTrinketId) && (string.IsNullOrEmpty(id) || h.EquippedTrinketId == id || string.Equals(h.HeroId, id, StringComparison.OrdinalIgnoreCase)));
                }
                case "heroVirtueIs": return Virtude(P.Texto(p, "hero")) >= P.Inteiro(p, "value", 1);
                case "objectUsed": return Objetos.Usado(P.Inteiro(p, "interactable", -1));
                case "objectNotUsed": return !Objetos.Usado(P.Inteiro(p, "interactable", -1));
                case "objectiveIs": return Roteiro.ObjetivoAtual == P.Inteiro(p, "n", 1);
                case "objectiveDone": return Roteiro.ObjetivoAtual > P.Inteiro(p, "n", 1);
                case "difficultyIs":
                {
                    var partida = Jogo.Partida;
                    var d = (P.Texto(p, "difficulty") ?? "").ToLowerInvariant();
                    if (partida == null) return false;
                    var atual = partida.GameDifficulty.ToString().ToLowerInvariant();
                    switch (d) { case "easy": d = "journey"; break; case "hard": d = "heroic"; break; case "extreme": case "brutal": d = "warfare"; break; }
                    return atual == d;
                }
                case "chance": return UnityEngine.Random.Range(0, 100) < P.Inteiro(p, "pct", 50);
                case "isOnFire": return HaFogo();
                case "partyHasItem":
                case "heroInArea":
                    Log.Info("  condição «" + c.Id + "» passa pela mesa: dada como verdadeira");
                    return true;
                default:
                    Log.Info("  condição «" + c.Id + "» desconhecida: dada como verdadeira");
                    return true;
            }
        }

        public static bool TemEstado(SerializedEnemy e, string estado)
        {
            if (string.IsNullOrEmpty(estado)) return false;
            if (!Enum.TryParse<SerializedEnemy.BoolFields>("Is" + estado, true, out var campo) && !Enum.TryParse(estado, true, out campo)) return false;
            return SerializedEnemy.GetBoolField(e, campo);
        }

        static int Virtude(string heroi)
        {
            foreach (var h in Jogo.Herois)
                if (string.IsNullOrEmpty(heroi) || string.Equals(h.HeroId, heroi, StringComparison.OrdinalIgnoreCase))
                    return Math.Max(h.VirtueOneValue, h.VirtueTwoValue);
            return 0;
        }

        static bool HaFogo()
        {
            try { return UnityEngine.Object.FindObjectsOfType<FFG.Core.GameVisibility>().Any(v => v != null && v.IsOnFire); }
            catch { return false; }
        }
    }
}
