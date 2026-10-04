using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Vagas "balanced from enemy pool" (inimigo "@pool" no mapa). Na hora de entrar, as vagas de um mesmo grupo (a sala)
    /// viram monstros pela regra do proprio jogo para os surgimentos aleatorios (SpawnRandomEnemies com tiers em sequencia):
    /// - pontos = intensidade x 0,1 x (jogadores x 1,5) x progresso da campanha, mais a sobra dos surgimentos anteriores;
    /// - custo por tier (_EnemyTierCosts): 10, 15, 20, 30, 40, 55, 70, 90, 120, 160...;
    /// - o tier desejado e o maximo da faixa; sem pontos para ele, desce ate um que caiba;
    /// - entram monstros do pool que tenham esse tier, um por vaga, ate 5, enquanto os pontos pagarem o tier minimo;
    /// - a sobra fica guardada para o proximo surgimento do mapa;
    /// - como o jogo, so entra um monstro se houver figura livre do tipo dele (miniaturas das caixas do jogador, menos as
    ///   que ja estao em jogo, as reservadas e as desta mesma leva).
    /// Diferenca do jogo: se os pontos nao pagam nem o tier minimo, entra um monstro no tier minimo (a sala nao fica vazia).
    /// </summary>
    public static class Balanceado
    {
        public const string Id = "@pool";
        static readonly int[] CustosDoJogo = { 10, 15, 20, 30, 40, 55, 70, 90, 120, 160, 240, 320 };
        static int _banco;

        public static void Reiniciar() { _banco = 0; }

        public static bool EhVaga(Dmap.Inimigo e) => e != null && string.Equals(e.Id, Id, StringComparison.OrdinalIgnoreCase);

        static int Custo(int tier)
        {
            try { if (EnemyTierCostModel.Instance != null) return EnemyTierCostModel.Instance.GetTierCost(tier); } catch { }
            return CustosDoJogo[Mathf.Clamp(tier - 1, 0, CustosDoJogo.Length - 1)];
        }

        /// <summary>Figuras livres de um tipo, como o jogo conta: as das caixas do jogador, menos as em jogo, as que o jogo
        /// reservou e as que ja vao entrar nesta leva.</summary>
        public static int FigurasLivres(EnemyTypes tipo, Dictionary<EnemyTypes, int> vaoEntrar)
        {
            int limite;
            try { limite = UserCollectionManager.GetEnemyTypeLimits(tipo); }
            catch (KeyNotFoundException) { limite = 0; }
            catch { return 99; }
            int emJogo = 0, reservadas = 0;
            try { emJogo = Jogo.Partida?.GetInPlayCount(tipo) ?? 0; reservadas = Jogo.Partida?.GetReservedCount(tipo) ?? 0; } catch { }
            vaoEntrar.TryGetValue(tipo, out var n);
            return limite - emJogo - reservadas - n - Inimigos.ACaminho(tipo);   // (e os de outras levas que ainda vao entrar)
        }

        static void Contar(Dictionary<EnemyTypes, int> vaoEntrar, string id)
        {
            var m = string.IsNullOrEmpty(id) ? null : UserCollectionManager.GetEnemy(id, false);
            if (m != null) vaoEntrar[m.Type] = (vaoEntrar.TryGetValue(m.Type, out var n) ? n : 0) + 1;
        }

        /// <summary>As vagas da lista viram monstros; o resto passa como esta.</summary>
        public static List<Dmap.Inimigo> Expandir(List<Dmap.Inimigo> lista)
        {
            if (lista == null || !lista.Any(EhVaga)) return lista;
            var r = lista.Where(e => !EhVaga(e)).ToList();
            var vaoEntrar = new Dictionary<EnemyTypes, int>();
            foreach (var e in r) Contar(vaoEntrar, e.Id);        // os postos a mao desta leva tambem ocupam figuras
            foreach (var grupo in lista.Where(EhVaga).GroupBy(e => e.Grupo ?? "", StringComparer.OrdinalIgnoreCase))
            {
                try { var saiu = Sortear(grupo.ToList(), vaoEntrar); r.AddRange(saiu); if (saiu.Count == 0) Motor.Roteiro.GrupoVazio(grupo.Key); }
                catch (Exception ex) { Log.Erro("balanceando o grupo «" + grupo.Key + "»", ex); }
            }
            return r;
        }

        static List<Dmap.Inimigo> Sortear(List<Dmap.Inimigo> vagas, Dictionary<EnemyTypes, int> vaoEntrar)
        {
            var saida = new List<Dmap.Inimigo>();
            // os inimigos iniciais entram antes de o roteiro comecar (Roteiro.Mapa ainda null): vale o mapa que o Lancador abre
            var regra = (Motor.Roteiro.Mapa ?? Lancador.Atual)?.Spawns?.Balanco ?? new Dmap.Balanco();
            int tMin = Mathf.Clamp(regra.TierMinimo, 1, 10), tMax = Mathf.Clamp(Math.Max(regra.TierMaximo, tMin), 1, 10);
            int progresso = Math.Max(1, regra.Progresso);
            var nomes = (vagas[0].Pool != null && vagas[0].Pool.Count > 0 ? vagas[0].Pool : Inimigos.Reserva).Where(x => !string.IsNullOrEmpty(x)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            var pool = new List<EnemyModel>();
            foreach (var n in nomes) { var m = UserCollectionManager.GetEnemy(n, false); if (m != null && m.Tiers != null && m.Tiers.Length > 0) pool.Add(m); }
            string grupo = vagas[0].Grupo;
            if (pool.Count == 0) { Log.Info("balanced (" + grupo + "): o pool está vazio; nenhum monstro entra"); return saida; }

            int jogadores = 2;
            try { jogadores = Mathf.Clamp(Jogo.Partida?.ActivePlayerCount ?? 2, 1, 4); } catch { }
            int intensidade = Mathf.Clamp(vagas[0].Intensidade > 0 ? vagas[0].Intensidade : vagas.Count, 1, 10);
            int multiplicador = (int)(jogadores * 1.5f) * progresso;           // como o gerador de pontos do jogo (inteiro)
            int pontos = Mathf.RoundToInt(intensidade * 0.1f * multiplicador) + _banco;
            int antes = pontos;

            // vagas em ordem aleatoria (o jogo sorteia as casas livres)
            var casas = vagas.OrderBy(_ => UnityEngine.Random.value).ToList();
            int limite = Math.Min(5, casas.Count);
            int desejado = tMax;
            var detalhes = new List<string>();
            while (saida.Count < limite && pontos >= Custo(tMin))
            {
                // o tier desejado cabe nos pontos e algum monstro do pool o tem; senao, desce
                // so os monstros com figura livre (como o jogo: as miniaturas das caixas, menos as em jogo)
                bool Livre(EnemyModel m) => FigurasLivres(m.Type, vaoEntrar) > 0;
                int t = desejado;
                while (t >= tMin && (Custo(t) > pontos || !pool.Any(m => m.GetEnemyTierInfo(t) != null && Livre(m)))) t--;
                if (t < tMin) { if (!pool.Any(Livre)) detalhes.Add("sem figuras livres"); break; }
                desejado = t;
                var opcoes = pool.Where(m => m.GetEnemyTierInfo(t) != null && Livre(m)).ToList();
                var escolhido = opcoes[UnityEngine.Random.Range(0, opcoes.Count)];
                var vaga = casas[saida.Count];
                saida.Add(new Dmap.Inimigo { Id = escolhido.Id, Pos = vaga.Pos, Grupo = vaga.Grupo, Nivel = vaga.Nivel, Tier = t });
                vaoEntrar[escolhido.Type] = (vaoEntrar.TryGetValue(escolhido.Type, out var ja) ? ja : 0) + 1;
                pontos -= Custo(t);
                detalhes.Add(escolhido.Id + " t" + t);
            }
            if (saida.Count == 0 && pool.Any(m => FigurasLivres(m.Type, vaoEntrar) > 0) && !detalhes.Contains("sem figuras livres"))
            {
                // pontos curtos: um monstro no menor tier que o pool tem dentro da faixa (ou o menor que ele tem)
                var candidatos = pool.Where(m => FigurasLivres(m.Type, vaoEntrar) > 0).Select(m => new { m, t = m.Tiers.Select(x => x.Tier).Where(x => x >= tMin && x <= tMax).DefaultIfEmpty(m.MinTier).Min() }).ToList();
                int menor = candidatos.Min(c => c.t);
                var opcoes = candidatos.Where(c => c.t == menor).ToList();
                var c0 = opcoes[UnityEngine.Random.Range(0, opcoes.Count)];
                var vaga = casas[0];
                saida.Add(new Dmap.Inimigo { Id = c0.m.Id, Pos = vaga.Pos, Grupo = vaga.Grupo, Nivel = vaga.Nivel, Tier = menor });
                vaoEntrar[c0.m.Type] = (vaoEntrar.TryGetValue(c0.m.Type, out var ja0) ? ja0 : 0) + 1;
                detalhes.Add(c0.m.Id + " t" + menor + " (pontos curtos: o mínimo)");
                pontos = Math.Max(0, pontos - Custo(menor));
            }
            _banco = Math.Max(0, pontos);
            Log.Info("balanced (" + grupo + "): " + jogadores + " jogador(es), intensidade " + intensidade + ", progresso " + progresso + ", tiers " + tMin + "–" + tMax
                + " → " + antes + " pontos, " + vagas.Count + " vaga(s): " + string.Join(", ", detalhes.ToArray()) + "; sobra " + _banco);
            return saida;
        }
    }
}
