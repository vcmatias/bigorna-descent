using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using FFG.Core;
using FFG.D3;
using Bigorna.Formato;

namespace Bigorna.Menu
{
    /// <summary>
    /// Que caixa um mapa ou uma campanha pede, para a ficha do menu mostrar a caixa certa (como o jogo faz com as partidas do
    /// Ato II). O editor grava "requiresAct" no arquivo; num arquivo de antes disso, o mod olha o que ele usa: as pecas e os
    /// objetos que so a caixa do Ato II tem e os monstros do Ato II.
    /// </summary>
    public static class AtoExigido
    {
        static readonly HashSet<string> Pecas2 = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "19a", "19b", "20a", "20b", "21a", "21b", "platform", "vault" };
        static readonly string[] Objetos2 = { "Bell", "BloodShrine", "Fire", "Ladder", "Statue", "Wagon", "Bridge", "PillarPush", "LadderMedium" };
        static readonly Dictionary<string, (DateTime, bool)> _lembrados = new Dictionary<string, (DateTime, bool)>(StringComparer.OrdinalIgnoreCase);

        static bool EhII(string t) { t = (t ?? "").Trim().ToUpperInvariant(); return t == "II" || t == "2"; }

        public static bool Ato2(Dmap m)
        {
            if (m == null) return false;
            if (!string.IsNullOrEmpty(m.Metadados?.AtoExigido)) return EhII(m.Metadados.AtoExigido);
            return Lembrar(m.Caminho, () => Olhar(m));
        }

        public static bool Ato2(Dcamp c)
        {
            if (c == null) return false;
            if (!string.IsNullOrEmpty(c.Metadados?.AtoExigido)) return EhII(c.Metadados.AtoExigido);
            return Lembrar(c.Caminho, () => c.Nos.Where(n => n != null && n.EhMapa).Any(n =>
            {
                var cm = c.CaminhoDoMapa(n); if (cm == null) return false;
                try { var d = Dmap.Carregar(cm); return Ato2(d); } catch { return false; }
            }));
        }

        static bool Lembrar(string caminho, Func<bool> calcular)
        {
            DateTime quando = DateTime.MinValue;
            try { if (!string.IsNullOrEmpty(caminho) && File.Exists(caminho)) quando = File.GetLastWriteTimeUtc(caminho); } catch { }
            if (!string.IsNullOrEmpty(caminho) && _lembrados.TryGetValue(caminho, out var v) && v.Item1 == quando) return v.Item2;
            bool r = false; try { r = calcular(); } catch (Exception ex) { Log.Info("ato de «" + caminho + "»: " + ex.Message); }
            if (!string.IsNullOrEmpty(caminho)) _lembrados[caminho] = (quando, r);
            return r;
        }

        static bool Olhar(Dmap m)
        {
            if (m.Board?.Pecas != null && m.Board.Pecas.Any(p => p != null && Pecas2.Contains((p.Tile ?? "").Trim()))) return true;
            if (m.Spawns?.Objetos != null && m.Spawns.Objetos.Any(o => o != null && Objetos2.Any(t => (o.Tipo ?? "").StartsWith(t, StringComparison.OrdinalIgnoreCase)))) return true;
            var ids = (m.Spawns?.Inimigos ?? new List<Dmap.Inimigo>()).Select(e => e?.Id).Concat(m.Spawns?.Reserva ?? new List<string>()).Where(x => !string.IsNullOrEmpty(x)).Distinct();
            foreach (var id in ids)
            {
                try { var e = UserCollectionManager.GetEnemy(id, false); if (e != null && e.Act == Act.ActII) return true; } catch { }
            }
            return false;
        }
    }
}
