using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FFG.Core;
using FFG.D3;
using FFG.D3.WorldMap;
using UnityEngine;

namespace Bigorna.Campanha
{
    /// <summary>
    /// As estradas do mapa-mundi proprio. A viagem do jogo anda pelos pontos de estrada (TravelPoint) do mapa oficial: o
    /// caminho e o de menos pontos entre o ponto atual e o ponto mais perto do destino, e cada ponto se acende com um
    /// intervalo. Com o mapa proprio, o mod troca a rede inteira: um ponto em cada lugar da campanha e na cidade, pontos ao
    /// longo das estradas desenhadas no editor, e, entre lugares que nenhuma estrada liga, uma linha reta de pontos.
    /// Os pontos da linha reta ficam um pouco mais juntos: a conta de pontos do jogo prefere a estrada quando ha uma.
    /// </summary>
    public static class Estradas
    {
        const float PassoEstrada = 50f, PassoReto = 40f;
        static int _feito;

        public static void NovaCena() { _feito = 0; }

        public static void Montar(Formato.Dcamp c, WorldMapSceneController cena, Formato.Dcamp.MapaDaCampanha mp)
        {
            if (!SingletonBehaviour<TravelPointController>.IsInitialized) return;
            var tpc = SingletonBehaviour<TravelPointController>.Instance;
            int id = tpc.GetInstanceID();
            if (_feito == id || _feito == -1) return;
            _feito = -1;   // uma falha no meio nao se repete a cada meio segundo

            var todos = tpc.GetComponentsInChildren<TravelPoint>(true);
            foreach (var v in todos) if (v != null && v.name.StartsWith("@Bigorna-Estrada", StringComparison.Ordinal)) UnityEngine.Object.Destroy(v.gameObject);   // de uma montagem anterior
            var antigos = todos.Where(v => v != null && !v.name.StartsWith("@Bigorna-Estrada", StringComparison.Ordinal)).ToArray();
            var modelo = antigos.FirstOrDefault(p => p.ImagePoint != null) ?? antigos.FirstOrDefault();
            if (modelo == null) { Log.Info("estradas: o mapa não tem pontos de viagem para copiar"); return; }
            var pai = modelo.transform.parent;
            float z = modelo.transform.localPosition.z;

            // a cidade (no lugar pedido pela campanha, se houver)
            var noCidade = cena.DestinationCity;
            Vector2 cidade = noCidade != null ? (Vector2)noCidade.transform.localPosition : tpc.TravelPointCity != null ? (Vector2)tpc.TravelPointCity.transform.localPosition : Vector2.zero;
            if (mp.Cidade != null && mp.Cidade.Length >= 2)
            {
                cidade = new Vector2(mp.Cidade[0], mp.Cidade[1]);
                if (noCidade != null) { var lp = noCidade.transform.localPosition; noCidade.transform.localPosition = new Vector3(cidade.x, cidade.y, lp.z); }
            }

            // os lugares: a cidade e cada parada da campanha que aparece no mapa
            var lugares = new List<Rede.P> { new Rede.P(cidade.x, cidade.y) };
            foreach (var n in c.Nos) if (!n.NaCidade && n.Coords != null && n.Coords.Length >= 2) lugares.Add(new Rede.P(n.X, n.Y));
            var estradas = (mp.Estradas ?? new List<List<float[]>>()).Select(e => (e ?? new List<float[]>()).Where(v => v != null && v.Length >= 2).Select(v => new Rede.P(v[0], v[1])).ToList()).Where(e => e.Count >= 2).ToList();
            var rede = Rede.Planejar(lugares, estradas, PassoEstrada, PassoReto);

            // os pontos novos: copias de um ponto do jogo, sob o mesmo pai
            var novos = new TravelPoint[rede.Pontos.Count];
            for (int i = 0; i < novos.Length; i++)
            {
                var go = UnityEngine.Object.Instantiate(modelo.gameObject, pai, false);
                go.name = "@Bigorna-Estrada-" + i;
                go.transform.localPosition = new Vector3(rede.Pontos[i].X, rede.Pontos[i].Y, z);
                go.transform.localRotation = modelo.transform.localRotation;
                foreach (var r in go.GetComponentsInChildren<CanvasRenderer>(true)) r.cull = false;
                var tp = go.GetComponent<TravelPoint>();
                tp.DtOnVisit = null;
                tp.IgnoreTravelEvents = rede.EhLugar[i];
                tp.Required = 0; tp.Excluded = 0;
                tp.SetColor(Color.white);
                tp.SetVisibility(false, false);
                novos[i] = tp;
            }
            for (int i = 0; i < novos.Length; i++) novos[i].ConnectedPoints = rede.Ligacoes[i].Select(j => novos[j]).ToArray();

            // a rede do jogo sai de cena
            var antigoCidade = tpc.TravelPointCity; var antigoAtual = tpc.CurrentPoint;
            foreach (var a in antigos) if (a != null) a.gameObject.SetActive(false);
            typeof(TravelPointController).GetField("_travelPoints", BindingFlags.Instance | BindingFlags.NonPublic)?.SetValue(tpc, novos);
            (typeof(TravelPointController).GetField("_path", BindingFlags.Instance | BindingFlags.NonPublic)?.GetValue(tpc) as List<TravelPoint>)?.Clear();
            try { tpc.OnClearHistory(); } catch { }

            tpc.TravelPointCity = novos[rede.Lugar[0]];
            TravelPoint atual = null;
            if (antigoAtual != null && antigoAtual != antigoCidade)
            {
                try
                {
                    var d = cena.GetDestination(SingletonBehaviour<GameData>.Instance.Data.CurrentDestinationId);
                    if (d != null) atual = tpc.FindClosestPoint(d.MapCoordinates);
                }
                catch { }
                if (atual == null) atual = tpc.FindClosestPoint(antigoAtual.transform.localPosition);
            }
            tpc.CurrentPoint = atual ?? tpc.TravelPointCity;
            _feito = id;
            Log.Info("estradas do mapa próprio: " + estradas.Count + " estrada(s), " + lugares.Count + " lugar(es), " + novos.Length + " ponto(s), " + rede.Retas + " linha(s) reta(s)"
                + (mp.Cidade != null && mp.Cidade.Length >= 2 ? "; cidade em " + cidade : ""));
        }
    }

    /// <summary>O desenho da rede, sem nada da Unity (da para testar fora do jogo).</summary>
    public static class Rede
    {
        public struct P
        {
            public float X, Y;
            public P(float x, float y) { X = x; Y = y; }
            public static float Dist(P a, P b) => (float)Math.Sqrt((a.X - b.X) * (a.X - b.X) + (a.Y - b.Y) * (a.Y - b.Y));
            public override string ToString() => "(" + X + ", " + Y + ")";
        }

        public class Resultado
        {
            public List<P> Pontos = new List<P>();
            public List<HashSet<int>> Ligacoes = new List<HashSet<int>>();
            public List<bool> EhLugar = new List<bool>();
            /// <summary>O ponto de cada lugar pedido (lugares no mesmo lugar dividem o ponto).</summary>
            public int[] Lugar;
            public int Retas;
            public int Novo(P p, bool lugar) { Pontos.Add(p); Ligacoes.Add(new HashSet<int>()); EhLugar.Add(lugar); return Pontos.Count - 1; }
            public void Ligar(int a, int b) { if (a == b) return; Ligacoes[a].Add(b); Ligacoes[b].Add(a); }
        }

        /// <summary>Um vertice de estrada a esta distancia de um lugar e o proprio lugar; vertices a esta distancia entre si
        /// sao o mesmo cruzamento.</summary>
        public const float JuntaLugar = 20f, JuntaCruzamento = 4f;

        public static Resultado Planejar(List<P> lugares, List<List<P>> estradas, float passoEstrada, float passoReto)
        {
            var r = new Resultado { Lugar = new int[lugares.Count] };
            for (int i = 0; i < lugares.Count; i++)
            {
                int j = -1;
                for (int k = 0; k < i; k++) if (P.Dist(lugares[k], lugares[i]) < 1f) { j = r.Lugar[k]; break; }
                r.Lugar[i] = j >= 0 ? j : r.Novo(lugares[i], true);
            }
            int nLugares = r.Pontos.Count;

            // cada vertice de estrada vira um ponto-chave (lugar, cruzamento, ponta) ou so forma (a curva da estrada)
            var limpas = new List<List<P>>();
            foreach (var e in estradas)
            {
                var l = new List<P>();
                foreach (var v in e) if (l.Count == 0 || P.Dist(l[l.Count - 1], v) >= 1f) l.Add(v);
                if (l.Count >= 2) limpas.Add(l);
            }
            var grupo = new List<int[]>();            // por estrada, o grupo de cada vertice
            var centros = new List<P>(); var usos = new List<int>();
            foreach (var l in limpas)
            {
                var g = new int[l.Count];
                for (int i = 0; i < l.Count; i++)
                {
                    int achou = -1; float melhor = JuntaLugar;
                    for (int k = 0; k < nLugares; k++) { var d = P.Dist(r.Pontos[k], l[i]); if (d <= melhor) { melhor = d; achou = k; } }
                    if (achou >= 0) { g[i] = achou; continue; }
                    for (int k = 0; k < centros.Count; k++) if (P.Dist(centros[k], l[i]) <= JuntaCruzamento) { achou = nLugares + k; break; }
                    if (achou < 0) { centros.Add(l[i]); usos.Add(0); achou = nLugares + centros.Count - 1; }
                    g[i] = achou;
                }
                grupo.Add(g);
            }
            var contagem = new Dictionary<int, int>();
            foreach (var g in grupo) foreach (var x in g.Distinct()) contagem[x] = contagem.TryGetValue(x, out var n) ? n + 1 : 1;
            var chave = new Dictionary<int, int>();   // grupo -> ponto
            for (int k = 0; k < nLugares; k++) chave[k] = k;
            int Chave(int gr, P pos) { if (!chave.TryGetValue(gr, out var p)) chave[gr] = p = r.Novo(pos, false); return p; }

            // ligacoes pela estrada, e quais pontos-chave uma estrada junta (para saber que lugares ja se alcancam)
            var pai = new Dictionary<int, int>();
            int Raiz(int a) { while (pai.TryGetValue(a, out var b) && b != a) a = b; return a; }
            void Unir(int a, int b) { a = Raiz(a); b = Raiz(b); if (a != b) pai[a] = b; }
            for (int e = 0; e < limpas.Count; e++)
            {
                var l = limpas[e]; var g = grupo[e];
                bool EhChave(int i) => i == 0 || i == l.Count - 1 || g[i] < nLugares || contagem[g[i]] > 1 || Array.IndexOf(g, g[i]) != i || Array.LastIndexOf(g, g[i]) != i;
                int ini = 0;
                for (int i = 1; i < l.Count; i++)
                {
                    if (!EhChave(i)) continue;
                    var trecho = new List<P>();
                    for (int k = ini; k <= i; k++) trecho.Add(g[k] < nLugares ? r.Pontos[g[k]] : l[k]);
                    int a = Chave(g[ini], l[ini]), b = Chave(g[i], l[i]);
                    if (a != b || Comprimento(trecho) >= passoEstrada) { Encher(r, trecho, a, b, passoEstrada); Unir(a, b); }
                    ini = i;
                }
            }

            // entre lugares que as estradas nao juntam: linha reta
            for (int i = 0; i < nLugares; i++)
                for (int j = i + 1; j < nLugares; j++)
                {
                    if (Raiz(i) == Raiz(j)) continue;
                    Encher(r, new List<P> { r.Pontos[i], r.Pontos[j] }, i, j, passoReto);
                    r.Retas++;
                }
            return r;
        }

        static float Comprimento(List<P> l) { float s = 0; for (int i = 1; i < l.Count; i++) s += P.Dist(l[i - 1], l[i]); return s; }

        /// <summary>Pontos a cada passo (mais ou menos) ao longo da linha, de a ate b.</summary>
        static void Encher(Resultado r, List<P> linha, int a, int b, float passo)
        {
            float total = Comprimento(linha);
            int n = Math.Max(1, (int)Math.Round(total / passo));
            int anterior = a, seg = 0; float antes = 0f;
            for (int k = 1; k < n; k++)
            {
                float alvo = total * k / n;
                while (seg < linha.Count - 2 && antes + P.Dist(linha[seg], linha[seg + 1]) < alvo) { antes += P.Dist(linha[seg], linha[seg + 1]); seg++; }
                float d = P.Dist(linha[seg], linha[seg + 1]); float t = d > 0 ? (alvo - antes) / d : 0f;
                var p = new P(linha[seg].X + (linha[seg + 1].X - linha[seg].X) * t, linha[seg].Y + (linha[seg + 1].Y - linha[seg].Y) * t);
                int novo = r.Novo(p, false);
                r.Ligar(anterior, novo); anterior = novo;
            }
            r.Ligar(anterior, b);
        }
    }
}
