using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>Monta as pecas do .dmap sobre a cena base, com salas ocultas que aparecem por gatilho.</summary>
    public static class Tabuleiro
    {
        static readonly string[] Bundles = { "d3/coreset/tiles", "d3/dle04/tiles" };
        /// <summary>Pecas que moram no bundle de terreno do Ato II (a plataforma e a plataforma afundada).</summary>
        public static readonly Dictionary<string, string> PecasDeTerreno = new Dictionary<string, string> { ["platform"] = "d3/terrain/platform&vault/platform.prefab", ["vault"] = "d3/terrain/platform&vault/vault.prefab" };
        /// <summary>Caixas: pecas macicas que ficam no chao com o topo num nivel fixo (o modelo ja traz a altura); nao levam pilares.</summary>
        public static bool EhCaixa(string tile) { var t = (tile ?? "").Trim(); return string.Equals(t, "platform", StringComparison.OrdinalIgnoreCase) || EhCaixaDoJogo(t); }
        /// <summary>A caixa do jogo do Ato I usada como plataforma (topo no nivel 3). O jogo nao tem essa peca: ela aparece com o
        /// modelo da plataforma do Ato II (topo no nivel 2), esticado na altura ate o nivel 3.</summary>
        public static bool EhCaixaDoJogo(string tile) => string.Equals((tile ?? "").Trim(), "gamebox", StringComparison.OrdinalIgnoreCase);
        /// <summary>Onde a caixa se apoia: a plataforma do Ato II fica no chao (topo 2) ou sobre a caixa do jogo (topo 5); a caixa
        /// do jogo, sempre no chao.</summary>
        static float BaseDaCaixa(Dmap.Peca p) => EhCaixaDoJogo(p.Tile) ? 0f : Jogo.Altura(Math.Max(0, p.Nivel - 2));
        /// <summary>Altura do topo de cada casa coberta por uma caixa (objetos e inimigos em cima dela ficam ali).</summary>
        static readonly Dictionary<(int, int), float> _topoDaCaixa = new Dictionary<(int, int), float>();
        /// <summary>Altura no mundo de algo no nivel dado sobre a casa (x,y): o topo da caixa, se houver, ou a altura do nivel.</summary>
        public static float AlturaEm(int x, int y, int nivel) => nivel > 0 && _topoDaCaixa.TryGetValue((x, y), out var h) ? h : Jogo.Altura(nivel);

        public static bool Montado { get; private set; }
        public static bool NossaCena { get; private set; }

        static readonly Dictionary<string, GameTile> _catalogo = new Dictionary<string, GameTile>();
        static readonly List<GameTile> _postas = new List<GameTile>();
        static readonly Dictionary<GameTile, Dmap.Peca> _pecaDe = new Dictionary<GameTile, Dmap.Peca>();
        static readonly Dictionary<GameTile, int> _indiceDe = new Dictionary<GameTile, int>();
        static Dmap _mapa;
        static readonly Dictionary<string, List<GameTile>> _ocultas = new Dictionary<string, List<GameTile>>(StringComparer.OrdinalIgnoreCase);
        static readonly List<GameTile> _terrenoDaBase = new List<GameTile>();
        static GameObject _deposito;
        /// <summary>Casa (x,y) -> grupo oculto que a cobre. Serve para esconder objetos e inimigos junto com a sala.</summary>
        public static readonly Dictionary<(int, int), string> GrupoDaCasa = new Dictionary<(int, int), string>();
        public static readonly List<string> PorColocar = new List<string>();
        static List<GameTile> _porSoltar;

        public static IEnumerable<string> GruposOcultos => _ocultas.Keys;
        public static bool GrupoOculto(string g) => !string.IsNullOrEmpty(g) && _ocultas.ContainsKey(g);

        public static void Reiniciar()
        {
            Montado = false;
            NossaCena = false;
            _postas.Clear();
            _pecaDe.Clear();
            _indiceDe.Clear();
            _ocultas.Clear();
            _terrenoDaBase.Clear();
            GrupoDaCasa.Clear();
            _topoDaCaixa.Clear();
            PorColocar.Clear();
            _porSoltar = null;
            _deposito = null;
        }

        public static void Desmontado() { Montado = false; }

        public static IEnumerator Montar(Dmap m)
        {
            Reiniciar();
            _mapa = m;
            var pecas = m.Board.Pecas;
            if (pecas.Count == 0) { Log.Info("o mapa não tem peças; fica o tabuleiro da cena base"); yield break; }

            float limite = Time.unscaledTime + 300f, aviso = Time.unscaledTime + 15f;
            while (Time.unscaledTime < limite && !Jogo.EncontroPronto)
            {
                if (Time.unscaledTime >= aviso) { aviso = Time.unscaledTime + 15f; Log.Info("esperando o encontro começar (há alguma tela pedindo «Continuar»?)"); }
                yield return null;
            }
            if (!Jogo.EncontroPronto) { Log.Info("o encontro não começou; não monto o tabuleiro"); yield break; }

            yield return CarregarCatalogo();
            if (_catalogo.Count == 0) { Log.Info("nenhuma peça carregou; fica o tabuleiro da cena base"); yield break; }
            if (!Jogo.EncontroPronto) { Log.Info("o encontro acabou enquanto as peças carregavam; não monto o tabuleiro"); yield break; }

            var gc = Jogo.Controle;
            var enc = gc.CurrentEncounter;
            ApartarBase(enc);

            foreach (var p in pecas.OrderBy(p => Ordem(p)))
            {
                var tile = Colocar(p, enc.transform);
                if (tile == null) continue;
                _postas.Add(tile);
                _pecaDe[tile] = p;
                _indiceDe[tile] = pecas.IndexOf(p);
                if (!string.IsNullOrEmpty(p.Grupo))
                {
                    Esconder(tile, true);
                    if (!_ocultas.TryGetValue(p.Grupo, out var lista)) _ocultas[p.Grupo] = lista = new List<GameTile>();
                    lista.Add(tile);
                    foreach (var casa in CasasDe(tile)) GrupoDaCasa[casa] = p.Grupo;
                }
                else Esconder(tile, false); // fica invisivel ate soltar
            }
            if (_ocultas.Count > 0) Log.Info("salas que aparecem depois: " + string.Join(", ", _ocultas.Select(kv => kv.Key + " (" + kv.Value.Count + ")").ToArray()));
            if (_postas.Count == 0) { Log.Info("nenhuma peça do mapa pôde ser posta"); yield break; }

            enc.AllTiles = _postas.ToArray();
            gc.ResetLineOfSightCoordinates();
            yield return null;
            Montado = true;
            NossaCena = true;
            _porSoltar = _postas.Where(t => string.IsNullOrEmpty(_pecaDe[t].Grupo)).ToList();
            Enquadrar(enc);
            var cam = Jogo.Cena?.CameraEncounter;
            if (cam != null) cam.FocusOn(Centro(_porSoltar));
            Log.Info("tabuleiro montado: " + _postas.Count + " de " + pecas.Count + " peças, " + (Jogo.Cena?.AllGameGridCoords?.Count ?? 0) + " casas na grade");
        }

        static int Ordem(Dmap.Peca p)
        {
            // alfombras (underlay) primeiro, depois visiveis, depois ocultas
            if (_mapa?.PecaDaOficina(p.Tile)?.Fundo == true) return 0;
            var t = Buscar(p.Tile);
            if (t != null && t.IsUnderlay) return 0;
            return string.IsNullOrEmpty(p.Grupo) ? 1 : 2;
        }

        static GameTile Buscar(string id)
        {
            if (string.IsNullOrEmpty(id)) return null;
            if (EhCaixaDoJogo(id)) id = "platform";
            _catalogo.TryGetValue(id.Trim().ToLowerInvariant(), out var t);
            return t;
        }

        static IEnumerator CarregarCatalogo()
        {
            _catalogo.Clear();
            var ab = Jogo.Persistente?.ABLoader;
            if (ab == null) { Log.Info("sem carregador de bundles"); yield break; }
            foreach (var bundle in Bundles)
            {
                bool carregado = false;
                try { carregado = ab.IsLoaded(bundle); } catch { }
                if (!carregado) yield return ab.CoroutineLoadBundle(bundle);
                List<GameTile> lista = null;
                try { lista = ab.LoadAllAssets<GameTile>(bundle); } catch (Exception ex) { Log.Info("bundle «" + bundle + "»: " + ex.Message); }
                if (lista == null) continue;
                foreach (var t in lista) if (t != null) _catalogo[t.name.ToLowerInvariant()] = t;
            }
            foreach (var kv in PecasDeTerreno)
            {
                if (_catalogo.ContainsKey(kv.Key)) continue;
                GameObject go = null;
                try { go = ab.LoadAsset<GameObject>(kv.Value); } catch { }
                if (go == null)
                {
                    string bundle = null;
                    try { bundle = ab.GetBundleName(kv.Value); } catch (Exception ex) { Log.Info("bundle de «" + kv.Key + "»: " + ex.Message); }
                    if (!string.IsNullOrEmpty(bundle))
                    {
                        bool ja = false; try { ja = ab.IsLoaded(bundle); } catch { }
                        if (!ja) yield return ab.CoroutineLoadBundle(bundle);
                        try { go = ab.LoadAsset<GameObject>(kv.Value); } catch (Exception ex) { Log.Info("«" + kv.Key + "»: " + ex.Message); }
                    }
                }
                var t = go != null ? go.GetComponent<GameTile>() : null;
                if (t != null) _catalogo[kv.Key] = t; else Log.Info("peça de terreno «" + kv.Key + "» não carregou");
            }
            Log.Info("catálogo de peças: " + _catalogo.Count);
        }

        static void ApartarBase(GameEncounter enc)
        {
            var da = enc.GetComponentsInChildren<GameTile>(true);
            if (da.Length == 0) return;
            _deposito = new GameObject("@Bigorna-PecasDaBase");
            _deposito.SetActive(false);
            int n = 0;
            foreach (var t in da)
            {
                if (t.isTerrain) _terrenoDaBase.Add(t);
                t.transform.SetParent(_deposito.transform, true);
                n++;
            }
            Log.Info("apartadas " + n + " peças da cena base (" + _terrenoDaBase.Count + " de terreno reservadas)");
        }

        static GameTile Colocar(Dmap.Peca p, Transform pai)
        {
            var propria = _mapa?.PecaDaOficina(p.Tile);
            if (propria != null)
            {
                var molde = _catalogo.Values.FirstOrDefault(t => t != null && !t.IsUnderlay && !t.isTerrain && t.LocalGridCoords != null && t.LocalGridCoords.Any(c => c != null) && t.LineOfSightGameObject != null);
                if (molde == null) { Log.Info("  sem peça de molde para a peça da Oficina «" + propria.Nome + "»"); return null; }
                GameTile feita = null;
                try { feita = Oficina.MontarPeca(propria, p, pai, molde); } catch (Exception ex) { Log.Erro("montando a peça da Oficina «" + propria.Nome + "»", ex); }
                if (feita != null) foreach (var v in feita.GetComponentsInChildren<GameVisibility>(true)) v.SetVisibility(true, false);
                return feita;
            }
            var prefab = Buscar(p.Tile);
            if (prefab == null) { Log.Info("  peça desconhecida: " + p.Tile); return null; }
            var go = UnityEngine.Object.Instantiate(prefab.gameObject, pai);
            go.name = prefab.name;
            go.transform.rotation = Quaternion.Euler(0f, p.Rot, 0f);
            if (EhCaixaDoJogo(p.Tile)) { var e = go.transform.localScale; go.transform.localScale = new Vector3(e.x, e.y * 1.5f, e.z); go.name = NomeDaCaixa; }   // (topo 2 → 3)
            go.SetActive(true);
            var tile = go.GetComponent<GameTile>();
            Alinhar(tile, p);
            if (EhCaixa(p.Tile) && tile.LocalGridCoords != null)
                foreach (var c in tile.LocalGridCoords) { if (c == null) continue; var w = c.transform.position; _topoDaCaixa[(Mathf.RoundToInt(w.x), Mathf.RoundToInt(-w.z))] = w.y; }
            foreach (var v in go.GetComponentsInChildren<GameVisibility>(true)) v.SetVisibility(true, false);
            return tile;
        }

        /// <summary>A casa local (0,0) da peca vai para a casa (x,y) do mapa; a rotacao gira em torno dela.</summary>
        static void Alinhar(GameTile tile, Dmap.Peca p)
        {
            var casas = tile.LocalGridCoords;
            if (casas == null || casas.Length == 0) return;
            var ancora = casas.FirstOrDefault(c => c != null && c.LocalCoordinates.x == 0 && c.LocalCoordinates.y == 0) ?? casas.FirstOrDefault(c => c != null);
            if (ancora == null) return;
            // a caixa fica no chao: o modelo ja tem a altura do topo
            var alvo = new Vector3(p.X, (EhCaixa(p.Tile) ? BaseDaCaixa(p) : Jogo.Altura(p.Nivel)) + (tile.IsUnderlay ? -0.1f : 0f), -p.Y);
            var tr = tile.transform;
            var atual = ancora.transform.position;
            tr.position = new Vector3(tr.position.x + (alvo.x - atual.x), alvo.y, tr.position.z + (alvo.z - atual.z));
            // garante que todas as casas caem em inteiros
            var pos = ancora.transform.position;
            tr.position += new Vector3(Mathf.Round(pos.x) - pos.x, 0f, Mathf.Round(pos.z) - pos.z);
        }

        public static IEnumerable<(int, int)> CasasDe(GameTile t)
        {
            if (t == null || t.LocalGridCoords == null) yield break;
            foreach (var c in t.LocalGridCoords)
            {
                if (c == null) continue;
                var w = c.transform.position;
                yield return (Mathf.RoundToInt(w.x), Mathf.RoundToInt(-w.z));
            }
        }

        static void Esconder(GameTile t, bool tirarBloqueios)
        {
            var v = t.GetComponent<GameVisibility>();
            if (v != null)
            {
                if (tirarBloqueios && v.BlockingPositions != null && v.BlockingPositions.Length > 0)
                    try { Jogo.Cena?.RemoveDynamicBlockingPositions(v.BlockingPositions); } catch { }
                v.SetVisibility(false, false);
            }
            t.gameObject.SetActive(false);
        }

        /// <summary>Solta as pecas visiveis (depois da escolha de herois): um aviso geral e depois uma peca de cada vez,
        /// cada uma com o seu aviso; a grade e refeita quando a ultima aparece.</summary>
        public static void Soltar()
        {
            var lista = _porSoltar;
            _porSoltar = null;
            if (lista == null || lista.Count == 0) return;
            UmaAUma(lista);
        }

        /// <summary>As pecas entram em grupos, como no jogo: um aviso por grupo (ate 4 pecas) com a lista delas; todas aparecem juntas
        /// quando o aviso sai (a fila e a mesma dos outros avisos, na ordem). Antes era um aviso por peca.</summary>
        static void UmaAUma(List<GameTile> lista)
        {
            var pecas = lista.Where(t => t != null).ToList();
            for (int k = 0; k < pecas.Count; k += 4)
            {
                var grupo = pecas.Skip(k).Take(4).ToList();
                bool ultimo = k + 4 >= pecas.Count;
                string texto = (grupo.Count == 1 ? Idioma.T("Coloquem a peça:\n", "Place the tile:\n") : k == 0 ? Idioma.T("Coloquem as peças:\n", "Place the tiles:\n") : Idioma.T("E também:\n", "And also:\n")) + string.Join("\n", grupo.Select(t => "• " + LinhaDaPeca(t)).ToArray());
                Dialogos.Mensagem(texto, ultimo ? (Action)(() => Nucleo.Instancia?.StartCoroutine(RefazerGrade(1.2f))) : null, Idioma.T("Montagem", "Setup"), () =>
                {
                    foreach (var t in grupo) Aparecer(t, false);
                    Jogo.Som("Place_Generic");
                    try { Jogo.Cena?.CameraEncounter?.FocusOn(Centro(grupo)); } catch { }
                });
            }
        }

        static void Aparecer(GameTile t, bool camera = true)
        {
            if (t == null) return;
            t.gameObject.SetActive(true);
            if (_indiceDe.TryGetValue(t, out var ip)) Objetos.MostrarPilares(ip);
            var v = t.GetComponent<GameVisibility>();
            if (v != null)
            {
                v.AnimShow = GameVisibility.VisibilityAnimationTypes.Drop;
                v.SetVisibility(true, true, 0f);
            }
            Rotular(t);
            if (!camera) return;
            Jogo.Som("Place_Generic");
            try { Jogo.Cena?.CameraEncounter?.FocusOn(Centro(new List<GameTile> { t })); } catch { }
        }

        static string LinhaDaPeca(GameTile t)
        {
            var p = _pecaDe.TryGetValue(t, out var pp) ? pp : null;
            return ((t.name ?? "").StartsWith("@Bigorna-") ? Idioma.T("o objeto 3D ", "the 3D object ") : "") + "<b>" + NomeNaMesa(t) + "</b>" + (p != null && EhCaixa(p.Tile) ? Idioma.T(" (uma caixa: no chão, com o topo no nível " + p.Nivel + ", sem pilares)", " (a box: on the floor, its top at level " + p.Nivel + ", no pillars)") : p != null && p.Nivel > 0 ? Idioma.T(", no nível " + p.Nivel + ", sobre pilares", ", at level " + p.Nivel + ", on pillars") : "")
                + (t.IsUnderlay ? Idioma.T(" (subcamada: as peças de chão vão por cima dela)", " (underlay: the floor tiles go on top of it)") : "");
        }

        static void Rotular(GameTile t)
        {
            try { if (t.TextTileId != null) Jogo.Cena?.AddTextCallout(t.TextTileId, true); } catch { }
        }

        static IEnumerator RefazerGrade(float espera)
        {
            yield return new WaitForSeconds(espera);
            try { if (Jogo.EncontroPronto) Jogo.Controle.ResetLineOfSightCoordinates(); } catch (Exception ex) { Log.Info("refazendo a grade: " + ex.Message); }
        }

        /// <summary>Revela uma sala oculta. Devolve quantas pecas apareceram.</summary>
        public static int Revelar(string grupo)
        {
            if (string.IsNullOrEmpty(grupo) || !_ocultas.TryGetValue(grupo, out var lista)) { Log.Info("não há peças no grupo «" + grupo + "»"); return 0; }
            _ocultas.Remove(grupo);
            var cena = Jogo.Cena;
            foreach (var t in lista)
            {
                if (t == null) continue;
                var v = t.GetComponent<GameVisibility>();
                if (v != null && v.BlockingPositions != null && v.BlockingPositions.Length > 0)
                    try { cena?.AddDynamicBlockingPositions(v.BlockingPositions); } catch { }
                PorColocar.Add(t.name);
            }
            foreach (var casa in lista.SelectMany(CasasDe).ToList()) GrupoDaCasa.Remove(casa);
            UmaAUma(lista);           // as pecas, em grupos
            Objetos.Revelar(grupo);   // depois os objetos da sala, um por aviso
            Inimigos.Revelar(grupo);  // por fim os inimigos, que esperam a fila esvaziar
            Enquadrar(Jogo.Encontro, lista);   // as pecas reveladas ainda estao desligadas (aparecem com o aviso), mas contam
            Log.Info("reveladas " + lista.Count + " peça(s) do grupo «" + grupo + "»");
            return lista.Count;
        }

        /// <summary>Ajusta os limites da camera ao tabuleiro visivel.</summary>
        static void Enquadrar(GameEncounter enc, List<GameTile> tambem = null)
        {
            if (enc == null) return;
            var visiveis = _postas.Where(t => t != null && (t.gameObject.activeSelf || (tambem != null && tambem.Contains(t)))).ToList();
            if (visiveis.Count == 0) visiveis = _postas;
            var casas = visiveis.SelectMany(CasasDe).ToList();
            if (casas.Count == 0) return;
            float minX = casas.Min(c => c.Item1), maxX = casas.Max(c => c.Item1), minY = casas.Min(c => c.Item2), maxY = casas.Max(c => c.Item2);
            var centro = new Vector3((minX + maxX) / 2f, 0f, -(minY + maxY) / 2f);
            float raio = Mathf.Max(15f, Mathf.Max(maxX - minX, maxY - minY) / 2f + 8f);
            enc.BoundsOrigin = centro;
            enc.BoundsRadius = raio;
        }

        /// <summary>O ponto da grade na casa (x, y) de uma peca posta, no nivel mais proximo do pedido.</summary>
        public static Transform CasaNaGrade(int x, int y, int nivel)
        {
            Transform melhor = null; float dist = float.MaxValue, alvo = Jogo.Altura(nivel);
            foreach (var t in _postas)
            {
                if (t == null || !t.gameObject.activeInHierarchy || t.LocalGridCoords == null) continue;
                foreach (var c in t.LocalGridCoords)
                {
                    if (c == null) continue; var w = c.transform.position;
                    if (Mathf.RoundToInt(w.x) != x || Mathf.RoundToInt(-w.z) != y) continue;
                    float d = Mathf.Abs(w.y - alvo); if (d < dist) { dist = d; melhor = c.transform; }
                }
            }
            if (melhor == null)
            {
                var cena = Jogo.Cena;
                if (cena?.AllGameGridCoords != null)
                    foreach (var c in cena.AllGameGridCoords.Values)
                    {
                        if (c == null) continue; var w = c.transform.position;
                        if (Mathf.RoundToInt(w.x) == x && Mathf.RoundToInt(-w.z) == y) { float d = Mathf.Abs(w.y - alvo); if (d < dist) { dist = d; melhor = c.transform; } }
                    }
            }
            return melhor;
        }

        /// <summary>Levanta a peca (ou objeto) da mesa, como o jogo faz ao tirar: sobe e some; depois volta ao lugar, desligada.</summary>
        internal static IEnumerator Levantar(GameObject go, float atraso, Action fim = null)
        {
            if (atraso > 0f) yield return new WaitForSeconds(atraso);
            if (go == null) { fim?.Invoke(); yield break; }
            var tr = go.transform; var p0 = tr.position; float t = 0f, dur = 0.45f;
            while (t < dur && go != null)
            {
                t += Time.deltaTime; float k = Mathf.Clamp01(t / dur);
                tr.position = p0 + Vector3.up * (12f * k * k);
                yield return null;
            }
            if (go != null) { go.SetActive(false); tr.position = p0; }
            fim?.Invoke();
        }

        static Vector3 Centro(List<GameTile> pecas)
        {
            var casas = pecas.SelectMany(CasasDe).ToList();
            if (casas.Count == 0) return Vector3.zero;
            return new Vector3((float)casas.Average(c => c.Item1), 0f, -(float)casas.Average(c => c.Item2));
        }

        /// <summary>Escada ou ponte do mapa: e uma peca (GameTile) e entra na grade como chao. A casa de menor x,y
        /// do seu quadro, depois de girar, vai para (o.X, o.Y), como o editor reserva (3x2 a escada, 6x2 a ponte).</summary>
        public static GameTile PlantarTerreno(GameObject corpo, Dmap.Objeto o, Transform pai)
        {
            var tile = corpo.GetComponent<GameTile>();
            if (tile == null) { Log.Info("  «" + o.Tipo + "» não é uma peça (sem GameTile); vai como objeto comum"); return null; }
            corpo.transform.SetParent(pai, true);
            corpo.SetActive(true);
            // a escadaria do jogo, com giro 0, sobe para -x; no editor, com giro 0, a seta (o sentido de subida) aponta para +x.
            // Os mapas originais confirmam (o nivel de cima fica do lado oposto a seta quando o giro vem direto do jogo),
            // entao a escada entra meia-volta girada: o mesmo quadro, subindo para onde a seta do editor aponta.
            corpo.transform.rotation = Quaternion.Euler(0f, o.Rot + (o.Tipo == "Staircase" ? 180 : 0), 0f);
            corpo.transform.position = Vector3.zero;
            var casas = tile.LocalGridCoords;
            if (casas == null || casas.Length == 0) { Log.Info("  «" + o.Tipo + "» sem casas na grade"); return null; }
            float minX = casas.Where(c => c != null).Min(c => c.transform.position.x);
            float maxZ = casas.Where(c => c != null).Max(c => c.transform.position.z); // menor y do editor = maior z
            corpo.transform.position = new Vector3(o.X - minX, Jogo.Altura(o.Nivel), -o.Y - maxZ);
            var pos = casas.First(c => c != null).transform.position;
            corpo.transform.position += new Vector3(Mathf.Round(pos.x) - pos.x, 0f, Mathf.Round(pos.z) - pos.z);
            // (da sala a que pertence: sai da mesa com ela, e nunca com a sala inicial; sem isso, uma escada de sala fechada
            // contava como da sala 1 e sumia quando a sala 1 saia)
            var peca = new Dmap.Peca { Tile = o.Tipo, Pos = new[] { o.X, o.Y }, Rot = o.Rot, Nivel = o.Nivel, GrupoAlt = string.IsNullOrEmpty(o.Revelar) ? null : o.Revelar };
            _postas.Add(tile);
            _pecaDe[tile] = peca;
            var enc = Jogo.Encontro;
            if (enc != null) enc.AllTiles = _postas.ToArray();
            Log.Info("  terreno «" + o.Tipo + "» na grade: casas " + string.Join(" ", CasasDe(tile).Select(c => c.Item1 + "," + c.Item2).ToArray()) + (o.Nivel > 0 ? " · nível " + o.Nivel : ""));
            return tile;
        }

        /// <summary>Tira uma sala inteira do tabuleiro (pecas, pilares, objetos e inimigos), antes de qualquer peca nova entrar.</summary>
        public static void RemoverGrupo(string grupo)
        {
            if (string.IsNullOrEmpty(grupo)) return;
            if (_ocultas.TryGetValue(grupo, out var escondidas))
            {
                _ocultas.Remove(grupo);
                foreach (var t in escondidas) { _postas.Remove(t); foreach (var c in CasasDe(t)) GrupoDaCasa.Remove(c); }
                Inimigos.RemoverNasCasas(new HashSet<(int, int)>(), grupo);
                Log.Info("sala «" + grupo + "» descartada antes de aparecer");
                return;
            }
            var pecas = _postas.Where(t => t != null && _pecaDe.TryGetValue(t, out var p) && string.Equals(p.Grupo, grupo, StringComparison.OrdinalIgnoreCase)).ToList();
            var alvo = pecas.Concat(_postas.Where(t => t != null && !pecas.Contains(t) && _pecaDe.TryGetValue(t, out var q) && q.Grupo == null && grupo == "room-1")).Distinct().ToList();
            RemoverPecas(alvo, "a sala " + grupo.Replace("room-", ""), grupo);
        }

        /// <summary>Tira uma peca (indice no .dmap) com tudo o que esta sobre ela.</summary>
        public static void RemoverPeca(int indice)
        {
            // so uma peca ainda no tabuleiro (uma ja removida continua no indice e seria "retirada" de novo)
            var t = _indiceDe.FirstOrDefault(kv => kv.Value == indice && kv.Key != null && _postas.Contains(kv.Key)).Key;
            if (t == null) { Log.Info("removeTile: a peça #" + indice + " não está no tabuleiro"); return; }
            RemoverPecas(new List<GameTile> { t }, null, null);
        }

        /// <summary>O nome de uma peca para quem joga: o numero dela; o terreno posto como peca (escadaria, ponte), pelo nome.</summary>
        static string NomeNaMesa(GameTile t) { var n = (t?.name ?? "?").Trim(); return n.StartsWith("@Bigorna-") ? Objetos.Nome(n.Substring(9)) : (t != null && t.IsUnderlay) || n.IndexOf("underlay", StringComparison.OrdinalIgnoreCase) >= 0 ? NomeDaSubcamada(n) : n == NomeDaCaixa ? Idioma.T(NomeDaCaixa, "Game box (Act I)") : n; }
        /// <summary>O nome (go.name) da caixa do jogo posta como peca; na mesa aparece na lingua do mod.</summary>
        const string NomeDaCaixa = "Caixa do jogo (Ato I)";
        /// <summary>As subcamadas (peças de fundo) em portugues: agua, agua fetida, brasas, espinhos.</summary>
        static string NomeDaSubcamada(string n)
        {
            var k = (n ?? "").ToLowerInvariant();
            return k.Contains("fetid") ? Idioma.T("Subcamada de água fétida", "Fetid water underlay") : k.Contains("water") ? Idioma.T("Subcamada de água", "Water underlay") : k.Contains("ember") ? Idioma.T("Subcamada de brasas", "Embers underlay") : k.Contains("spike") ? Idioma.T("Subcamada de espinhos", "Spikes underlay") : Idioma.T("Subcamada", "Underlay");
        }

        /// <summary>Tira pecas com tudo o que esta nelas. As contas (grade, grupos, bloqueios, inimigos que nao contam como
        /// derrotados) mudam na hora; na mesa, como no jogo: um aviso geral e depois uma peca de cada vez, com a camera nela e as
        /// casas destacadas; ao fechar o aviso, a peca e o que estava sobre ela sobem e somem.</summary>
        static void RemoverPecas(List<GameTile> pecas, string rotulo, string grupo)
        {
            if (pecas.Count == 0) { Log.Info("nada a remover" + (rotulo != null ? " em " + rotulo : "")); return; }
            var casas = new HashSet<(int, int)>(pecas.SelectMany(CasasDe));
            var indices = new HashSet<int>(pecas.Where(t => _indiceDe.ContainsKey(t)).Select(t => _indiceDe[t]));
            var objetos = Objetos.RetirarNasCasas(casas, indices);        // marcados como retirados; o corpo continua a vista
            var inimigos = Inimigos.RetirarNasCasas(casas, grupo);         // idem: saem da mesa junto com a peca deles
            // as contas mudam agora: uma sala nova pode reaproveitar estas pecas logo em seguida
            foreach (var t in pecas)
            {
                var v = t.GetComponent<GameVisibility>();
                if (v != null && v.BlockingPositions != null && v.BlockingPositions.Length > 0) try { Jogo.Cena?.RemoveDynamicBlockingPositions(v.BlockingPositions); } catch { }
                _postas.Remove(t);
                foreach (var c in CasasDe(t)) GrupoDaCasa.Remove(c);
            }
            var enc = Jogo.Encontro; if (enc != null) enc.AllTiles = _postas.ToArray();
            Log.Info("removidas " + pecas.Count + " peça(s)" + (rotulo != null ? " (" + rotulo + ")" : "") + ", " + objetos.Count + " objeto(s), " + inimigos.Count + " inimigo(s)");
            var r = new Retirada { Pecas = pecas, Objetos = objetos, Inimigos = inimigos };
            if (_lote != null) _lote.Add(r); else Desmontar(new List<Retirada> { r });
        }

        /// <summary>O que uma remocao tira da mesa (pecas, objetos sobre elas, inimigos).</summary>
        class Retirada { public List<GameTile> Pecas; public List<Objetos.NaMesa> Objetos; public List<SerializedEnemy> Inimigos; }
        static List<Retirada> _lote;
        /// <summary>As remocoes seguidas de um gatilho (as salas deixadas para tras num ponto sem volta) viram um aviso so.</summary>
        public static void IniciarLote() { if (_lote == null) _lote = new List<Retirada>(); }
        public static void FecharLote() { var l = _lote; _lote = null; if (l != null && l.Count > 0) Desmontar(l); }

        /// <summary>A desmontagem na mesa: um aviso com tudo o que sai, em grupo (as pecas, os objetos, os inimigos), com as pecas
        /// destacadas; ao fechar, tudo sobe e some de uma vez.</summary>
        static void Desmontar(List<Retirada> lote)
        {
            var pecas = lote.SelectMany(r => r.Pecas).Where(t => t != null).Distinct().ToList();
            var objetos = lote.SelectMany(r => r.Objetos).Distinct().ToList();
            var inimigos = lote.SelectMany(r => r.Inimigos).Distinct().ToList();
            var nomes = pecas.Select(NomeNaMesa).GroupBy(n => n).OrderBy(g => g.Key).Select(g => g.Count() > 1 ? g.Key + " ×" + g.Count() : g.Key).ToList();
            var partes = new List<string> { Idioma.T("as peças <b>", "the tiles <b>") + string.Join(", ", nomes.ToArray()) + "</b>" };
            var soltos = objetos.Where(o => o.Dados?.DaPeca < 0).Select(o => o.Rotulo).GroupBy(n => n).Select(g => g.Count() > 1 ? g.Key + " ×" + g.Count() : g.Key).ToList();
            if (soltos.Count > 0) partes.Add(Idioma.T("os objetos ", "the objects ") + string.Join(", ", soltos.ToArray()));
            if (inimigos.Count > 0) partes.Add(Idioma.T("os inimigos ", "the enemies ") + string.Join(", ", inimigos.Select(e => Inimigos.NomeDoInimigo(e)).ToArray()));
            var realce = new List<Transform>();
            Dialogos.Mensagem(Idioma.T("Retirem do tabuleiro ", "Remove from the board ") + string.Join("; ", partes.ToArray()) + Idioma.T(". Guardem tudo: volta à caixa.", ". Put it all away: it goes back in the box."),
                () =>
                {
                    var cena = Jogo.Cena; var nucleo = Nucleo.Instancia;
                    foreach (var tr in realce) try { cena?.RemovePersitentHighlight(tr); } catch { }
                    foreach (var t in pecas)
                    {
                        try { cena?.RemoveOutline(t.gameObject); } catch { }
                        try { if (t.TextTileId != null) cena?.RemoveTextCallout(t.TextTileId); } catch { }
                    }
                    foreach (var e in inimigos) Inimigos.Tirar(e);
                    foreach (var o in objetos) if (o.Corpo != null && o.Corpo.activeSelf) nucleo?.StartCoroutine(Levantar(o.Corpo, 0f, () => Objetos.Mostrar(o, false)));
                    foreach (var t in pecas)
                        if (_indiceDe.TryGetValue(t, out var ip))
                            foreach (var pl in Objetos.PilaresDaPeca(ip)) if (!objetos.Contains(pl) && pl.Corpo != null && pl.Corpo.activeSelf) nucleo?.StartCoroutine(Levantar(pl.Corpo, 0.05f, () => Objetos.Mostrar(pl, false)));
                    Jogo.Som("Place_Generic");
                    for (int i = 0; i < pecas.Count; i++)
                    {
                        var t = pecas[i]; bool ultima = i == pecas.Count - 1;
                        nucleo?.StartCoroutine(Levantar(t.gameObject, 0.1f, () =>
                        {
                            try { t.GetComponent<GameVisibility>()?.SetVisibility(false, false); } catch { }
                            t.gameObject.SetActive(false);
                            if (ultima) RefazerGradeAgora();
                        }));
                    }
                }, Idioma.T("Desmontagem", "Teardown"),
                () =>
                {
                    var cena = Jogo.Cena;
                    try { cena?.CameraEncounter?.FocusOn(Centro(pecas)); } catch { }
                    foreach (var t in pecas)
                    {
                        try { cena?.AddOutline(t.gameObject); } catch { }
                        if (t.LocalGridCoords != null)
                            foreach (var c in t.LocalGridCoords) if (c != null) try { cena?.AddPersistentHighlight(c.transform); realce.Add(c.transform); } catch { }
                    }
                });
            Log.Info("desmontagem na mesa: " + pecas.Count + " peça(s), " + objetos.Count + " objeto(s), " + inimigos.Count + " inimigo(s), de uma vez");
        }

        /// <summary>Refaz a grade agora (depois de por terreno ou revelar salas).</summary>
        public static void RefazerGradeAgora()
        {
            try { if (Jogo.EncontroPronto) Jogo.Controle.ResetLineOfSightCoordinates(); } catch (Exception ex) { Log.Info("refazendo a grade: " + ex.Message); }
        }

        public static string GrupoDe(int x, int y) => GrupoDaCasa.TryGetValue((x, y), out var g) ? g : null;

        public static string GrupoDe(int[] pos) => pos != null && pos.Length >= 2 ? GrupoDe(pos[0], pos[1]) : null;
    }
}
