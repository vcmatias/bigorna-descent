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
    /// <summary>Entrada de inimigos na partida pela via do proprio jogo (GameController.CreateEnemy/AddEnemy).</summary>
    public static class Inimigos
    {
        /// <summary>GUID do inimigo -> grupo do mapa.</summary>
        public static readonly Dictionary<string, string> GrupoDe = new Dictionary<string, string>();
        /// <summary>GUID -> id do modelo (guardado para saber quem morreu depois que sai da lista).</summary>
        public static readonly Dictionary<string, string> ModeloDe = new Dictionary<string, string>();
        /// <summary>GUID -> a entrada do mapa que o gerou (para remover "aquele" inimigo em particular).</summary>
        public static readonly Dictionary<string, Dmap.Inimigo> OrigemDe = new Dictionary<string, Dmap.Inimigo>();
        /// <summary>Reserva (spawn pool): ids de modelo que podem sair em spawnRandom.</summary>
        public static readonly List<string> Reserva = new List<string>();
        static readonly List<(Dmap.Inimigo inimigo, string sala)> _emSalaOculta = new List<(Dmap.Inimigo, string)>();
        /// <summary>Inimigos colocados em salas ainda fechadas: entram quando a sala abrir, entao ainda faltam derrotar.</summary>
        public static int AguardandoSala => _emSalaOculta.Count;
        public static int Gerando { get; private set; }
        /// <summary>Muda a cada Reiniciar: as entradas ainda em curso de um encontro anterior param e nao mexem na contagem nova.</summary>
        static int _epoca;

        /// <summary>Monstros ja decididos que ainda nao entraram na partida (esperam o aviso deles na fila), por tipo; e os
        /// ja criados, com a cor da base escolhida. Varios grupos podem entrar ao mesmo tempo: sem contar estes, cada grupo
        /// via as mesmas miniaturas livres, e o jogo recebia mais monstros de um tipo do que tem miniaturas (a previa do
        /// monstro falhava, e a partida ficava com um inimigo pela metade).</summary>
        static readonly Dictionary<EnemyTypes, int> _aCaminho = new Dictionary<EnemyTypes, int>();
        static readonly List<SerializedEnemy> _criados = new List<SerializedEnemy>();
        public static int ACaminho(EnemyTypes t) => _aCaminho.TryGetValue(t, out var n) ? n : 0;
        static void Caminho(EnemyTypes t, int d) { int n = ACaminho(t) + d; if (n <= 0) _aCaminho.Remove(t); else _aCaminho[t] = n; }

        public static void Reiniciar()
        {
            _epoca++;
            _aCaminho.Clear(); _criados.Clear();
            GrupoDe.Clear();
            ModeloDe.Clear();
            OrigemDe.Clear();
            Reserva.Clear();
            _emSalaOculta.Clear();
            Gerando = 0;
            Balanceado.Reiniciar();
            Motor.Roteiro.EsquecerGruposVazios();
        }

        /// <summary>Poe os inimigos iniciais: os que nao dependem de spawnGroup nem de sala oculta.</summary>
        public static IEnumerator Povoar(Dmap m)
        {
            var lista = m.Spawns.Inimigos;
            Reserva.Clear();
            foreach (var id in m.Spawns.Reserva ?? new List<string>()) if (!string.IsNullOrEmpty(id)) Reserva.Add(id);
            if (Reserva.Count > 0) Log.Info("reserva inicial (spawn pool): " + string.Join(", ", Reserva.ToArray()));
            if (lista.Count == 0) yield break;
            var porGatilho = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var g in m.Gatilhos)
                foreach (var a in g.Acoes)
                    if (a.Id == "spawnGroup") { var gr = P.Texto(a.Params, "group"); if (!string.IsNullOrEmpty(gr)) porGatilho.Add(gr); }
            var agora = new List<Dmap.Inimigo>();
            foreach (var e in lista)
            {
                if (!string.IsNullOrEmpty(e.Grupo) && porGatilho.Contains(e.Grupo)) continue;
                // o monstro posto numa sala fechada espera a sala abrir (pela casa, ou pelo grupo room-N da sala onde foi posto)
                var sala = Tabuleiro.GrupoDe(e.Pos);
                var grupoSala = e.Grupo != null && e.Grupo.EndsWith("-pool", StringComparison.OrdinalIgnoreCase) ? e.Grupo.Substring(0, e.Grupo.Length - 5) : e.Grupo;   // o grupo balanceado da sala (room-N-pool)
                if (string.IsNullOrEmpty(sala) && !string.IsNullOrEmpty(grupoSala) && Tabuleiro.GrupoOculto(grupoSala)) sala = grupoSala;
                if (!string.IsNullOrEmpty(sala)) { _emSalaOculta.Add((e, sala)); continue; }
                agora.Add(e);
            }
            if (porGatilho.Count > 0) Log.Info("grupos que entram por gatilho: " + string.Join(", ", porGatilho.ToArray()));
            if (_emSalaOculta.Count > 0) Log.Info(_emSalaOculta.Count + " inimigo(s) esperam a sala deles aparecer");
            if (agora.Count == 0) yield break;
            yield return Entrar(agora);
        }

        /// <summary>Uma sala apareceu: entram os inimigos que estavam nela (salvo os que chegam por spawnGroup).</summary>
        public static void Revelar(string sala)
        {
            var entram = _emSalaOculta.Where(x => string.Equals(x.sala, sala, StringComparison.OrdinalIgnoreCase)).ToList();
            if (entram.Count == 0) return;
            foreach (var x in entram) _emSalaOculta.Remove(x);
            EntrarAgora(entram.Select(x => x.inimigo).ToList());
        }

        /// <summary>O grupo ainda tem inimigos esperando a sala deles abrir: nao foi derrotado.</summary>
        public static bool EsperandoDoGrupo(string grupo) => _emSalaOculta.Any(x => string.Equals(x.inimigo.Grupo, grupo, StringComparison.OrdinalIgnoreCase));

        public static void EntrarAgora(List<Dmap.Inimigo> lista)
        {
            if (lista == null || lista.Count == 0) return;
            Gerando++;
            Nucleo.Instancia.StartCoroutine(Seguro(Entrar(lista), _epoca));
        }

        static IEnumerator Seguro(IEnumerator rotina, int epoca)
        {
            try
            {
                while (true)
                {
                    object atual;
                    try { if (!rotina.MoveNext()) break; atual = rotina.Current; }
                    catch (Exception ex) { Log.Erro("entrando inimigos", ex); break; }
                    yield return atual;
                }
            }
            finally { if (epoca == _epoca && Gerando > 0) Gerando--; }
        }

        static IEnumerator Entrar(List<Dmap.Inimigo> lista)
        {
            int epoca = _epoca;
            float limite = Time.unscaledTime + 60f;
            while (Time.unscaledTime < limite && !Jogo.EncontroPronto) yield return null;
            if (epoca != _epoca) yield break;
            lista = Balanceado.Expandir(lista);   // vagas "balanced from enemy pool": a regra do jogo decide quem entra
            var gc = Jogo.Controle;
            if (gc == null) yield break;
            // todos os desta leva ficam "a caminho" desde ja (as outras levas que entram ao mesmo tempo contam com eles)
            var tipos = new List<EnemyTypes?>();
            foreach (var e in lista) { EnemyTypes? t = null; try { var m = UserCollectionManager.GetEnemy(e.Id, false); if (m != null) t = m.Type; } catch { } tipos.Add(t); if (t.HasValue) Caminho(t.Value, 1); }
            int k = -1;
            foreach (var e in lista)
            {
                k++; if (k > 0 && tipos[k - 1].HasValue && epoca == _epoca) Caminho(tipos[k - 1].Value, -1);   // o anterior ja entrou (ou desistiu)
                if (epoca != _epoca || gc == null) { Log.Info("  entrada de inimigos interrompida: o encontro mudou"); yield break; }
                EnemyModel modelo = null; EnemyTier tier = null;
                try
                {
                    modelo = UserCollectionManager.GetEnemy(e.Id, false);
                    if (modelo == null) { Log.Info("  inimigo desconhecido: " + e.Id); continue; }
                    if (UserCollectionManager.GetEnemy(e.Id, true) == null) Log.Info("  «" + e.Id + "» é de uma caixa que você não tem: entra na partida, mas sem miniatura para colocar");
                    int pedido = e.Tier;
                    if (e.TierPorHerois != null && e.TierPorHerois.Length > 0)
                    {
                        int herois = 2; try { herois = Mathf.Clamp(Jogo.Partida?.ActivePlayerCount ?? 2, 1, 4); } catch { }
                        pedido = e.TierPorHerois[Mathf.Min(herois, e.TierPorHerois.Length) - 1];
                        Log.Info("  " + e.Id + ": tier " + pedido + " para " + herois + " herói(s)");
                    }
                    tier = modelo.GetEnemyTierInfo(pedido) ?? modelo.GetEnemyTierInfo(e.Tier) ?? modelo.Tiers.FirstOrDefault();
                    if (tier == null) { Log.Info("  " + e.Id + " não tem nível"); continue; }
                }
                catch (Exception ex) { Log.Info("  não li " + e.Id + ": " + ex.Message); continue; }
                yield return EntrarUm(gc, e, modelo, tier);
            }
            if (k >= 0 && tipos[k].HasValue && epoca == _epoca) Caminho(tipos[k].Value, -1);
            Jogo.Sujo();
        }

        /// <summary>Um inimigo, como o jogo faz: figura na casa, câmera nela, aviso na tela; ao fechar o aviso, ele entra na partida.</summary>
        static IEnumerator EntrarUm(GameController gc, Dmap.Inimigo e, EnemyModel modelo, EnemyTier tier)
        {
            int epoca = _epoca;
            // sem miniatura livre deste tipo (todas em jogo ou a caminho), o jogo nao tem como mostra-lo: ele nao entra
            if (Balanceado.FigurasLivres(modelo.Type, new Dictionary<EnemyTypes, int>()) + 1 <= 0)
            {
                Log.Info("  " + e.Id + ": sem miniatura livre de " + modelo.Type + "; não entra");
                Dialogos.Mensagem("Todas as miniaturas de <b>" + NomeDe(modelo) + "</b> já estão no tabuleiro: este não entra.", null, "Inimigo");
                yield break;
            }
            var pos = Jogo.Mundo(e.Pos, e.Pos != null && e.Pos.Length >= 2 ? Tabuleiro.AlturaEm(e.Pos[0], e.Pos[1], e.Nivel) : Jogo.Altura(e.Nivel));
            SerializedEnemy inimigo;
            try
            {
                inimigo = gc.CreateEnemy(modelo, tier);
                inimigo.SpawnPositions.AddUniqueItem(pos);
                inimigo.PlasticId = CorLivre(modelo.Type);
                _criados.Add(inimigo);
                if (e.BonusAtaque != 0 || e.BonusDefesa != 0) { inimigo.BaseAttack += e.BonusAtaque; inimigo.Defense += e.BonusDefesa; Log.Info("  " + e.Id + ": ataque " + (e.BonusAtaque >= 0 ? "+" : "") + e.BonusAtaque + ", defesa " + (e.BonusDefesa >= 0 ? "+" : "") + e.BonusDefesa); }
            }
            catch (Exception ex) { Log.Erro("  não consegui criar " + e.Id, ex); yield break; }
            if (!string.IsNullOrEmpty(e.Grupo)) GrupoDe[inimigo.GUID] = e.Grupo;
            ModeloDe[inimigo.GUID] = modelo.Id;
            OrigemDe[inimigo.GUID] = e;

            // espera a figura carregar (o jogo carrega o modelo em segundo plano)
            if (!gc.EnemyPlasticPools.ContainsKey(modelo.Type)) yield return GarantirBundles(modelo);
            float limite = Time.unscaledTime + 12f;
            while (Time.unscaledTime < limite && !gc.EnemyPlasticPools.ContainsKey(modelo.Type)) yield return null;
            limite = Time.unscaledTime + 12f;
            while (Time.unscaledTime < limite && CarregandoInimigos()) yield return null;
            while (Jogo.Salvando || Jogo.OutraTela || Jogo.MostrandoMensagem || Dialogos.Ocupado || Dialogos.NaFila > 0) yield return null; // um aviso de cada vez, depois dos que ja estao na fila (pecas, objetos); nunca durante a gravacao
            if (epoca != _epoca || gc == null) yield break;

            GameVisibility figura = null;
            PrefabPool pool = null;
            Transform casa = CasaDaGrade(pos);
            try
            {
                if (gc.EnemyPlasticPools.TryGetValue(modelo.Type, out pool) && pool != null)
                {
                    figura = pool.Spawn<GameVisibility>(pos, true);
                    Pintar(figura, inimigo.PlasticId);
                    try { CartoesDeMonstro.VestirFigura(figura.gameObject, modelo.Id); } catch (Exception ex) { Log.Info("  cartão na figura: " + ex.Message); }
                    figura.AnimShow = GameVisibility.VisibilityAnimationTypes.Drop;
                    figura.SetVisibility(true, true);
                    Jogo.Som("Place_Generic");
                }
                else Log.Info("  sem figura de " + modelo.Type + " carregada; só o aviso e a marca na casa");
                if (casa != null) Jogo.Cena?.AddPersistentHighlight(casa);
                Jogo.Cena?.CameraEncounter?.FocusOn(pos);
            }
            catch (Exception ex) { Log.Info("  figura de " + e.Id + ": " + ex.Message); }

            var nome = NomeDe(modelo);
            var cor = NomeCor(inimigo.PlasticId);
            Log.Info("  entra " + e.Id + " (" + modelo.Type + ") em " + Jogo.Casa(pos) + (string.IsNullOrEmpty(e.Grupo) ? "" : " [grupo " + e.Grupo + "]") + " · base " + cor);
            bool fechou = false;
            Dialogos.Mensagem("Coloquem <b>" + nome + "</b> na casa marcada (" + Jogo.Casa(pos) + "), base " + cor + "." + (string.IsNullOrEmpty(e.Texto) ? "" : "\n\n" + e.Texto), () => fechou = true, "Inimigo");
            limite = Time.unscaledTime + 180f;
            while (!fechou && Time.unscaledTime < limite) yield return null;
            while (Jogo.Salvando) yield return null;

            // o encontro acabou (ou outro comecou) enquanto o aviso esperava: nao poe o inimigo em outra partida
            _criados.Remove(inimigo);
            if (epoca == _epoca && gc != null)
            {
                try { gc.AddEnemy(inimigo); }
                catch (Exception ex)
                {
                    Log.Erro("  não consegui pôr " + e.Id + " na partida", ex);
                    // a partida nao fica com um inimigo pela metade (na lista, sem previa): as telas do jogo quebravam com ele
                    Desfazer(inimigo);
                }
            }
            try { if (casa != null) Jogo.Cena?.RemovePersitentHighlight(casa); } catch { }
            if (figura != null)
            {
                try { CartoesDeMonstro.Despir(figura.gameObject); figura.SetVisibility(false, true); pool.Return(figura.gameObject, 0.3f); }
                catch (Exception ex) { Log.Info("  não devolvi a figura: " + ex.Message); }
            }
        }

        static void Desfazer(SerializedEnemy inimigo)
        {
            try { Jogo.Controle?.RemoveEnemy(inimigo); }
            catch
            {
                try
                {
                    var d = Jogo.Partida; int i = d?.Enemies?.IndexOf(inimigo) ?? -1;
                    if (i >= 0) { try { Jogo.UI?.EnemyMenu?.RemoveMiniTab(i); } catch { } d.Enemies.RemoveAt(i); }
                    d?.SortedEnemyGUIDs?.Remove(inimigo.GUID);
                }
                catch (Exception ex) { Log.Info("  desfazendo o inimigo: " + ex.Message); }
            }
            GrupoDe.Remove(inimigo.GUID); ModeloDe.Remove(inimigo.GUID); OrigemDe.Remove(inimigo.GUID);
            Jogo.Sujo();
        }

        static bool CarregandoInimigos()
        {
            try { var d = Jogo.UI?.DialogEnemiesLoading; return d != null && d.IsVisible; } catch { return false; }
        }

        static Transform CasaDaGrade(Vector3 pos) => Jogo.CasaDaGrade(pos);

        static void Pintar(GameVisibility figura, PlasticIds id)
        {
            try
            {
                var material = Jogo.Cena.GetPlasticIdMaterial(id);
                var cor = figura.GetComponent<GameDynamicColor>(); if (cor != null) cor.SetColor(material.color);
                var mats = figura.GetComponent<GameDynamicMaterials>();
                if (mats != null)
                {
                    mats.SetMaterial(material);
                    if (mats.DynamicMaterialObjects.Length != 0) mats.DynamicMaterialObjects[0].transform.parent.transform.localEulerAngles = new Vector3(0f, (int)id * -90, 0f);
                }
                var contorno = figura.GetComponent<GameEnemiesOutline>();
                if (contorno != null) { contorno.SetOutlineColor(material.color); contorno.SetOutline(GameOutlineType.Constant); }
            }
            catch (Exception ex) { Log.Info("  pintando a figura: " + ex.Message); }
        }

        static string NomeCor(PlasticIds id)
        {
            switch (id)
            {
                case PlasticIds.Orange: return "laranja";
                case PlasticIds.Green: return "verde";
                case PlasticIds.Yellow: return "amarela";
                case PlasticIds.Purple: return "roxa";
                default: return id.ToString().ToLowerInvariant();
            }
        }

        static IEnumerator GarantirBundles(EnemyModel modelo)
        {
            var ab = Jogo.Persistente?.ABLoader;
            if (ab == null) yield break;
            foreach (var caminho in new[] { modelo.PlasticPrefabAssetPath, modelo.PreviewPrefabAssetPath, modelo.LogicAssetPath })
            {
                if (string.IsNullOrEmpty(caminho)) continue;
                bool ok = false;
                try { ok = ab.LoadAsset<GameObject>(caminho) != null; } catch { }
                if (ok) continue;
                string bundle = null;
                try { bundle = ab.GetBundleName(caminho); } catch { }
                if (string.IsNullOrEmpty(bundle)) continue;
                bool ja = false; try { ja = ab.IsLoaded(bundle); } catch { }
                if (!ja) yield return ab.CoroutineLoadBundle(bundle);
            }
        }

        static PlasticIds CorLivre(EnemyTypes tipo)
        {
            var usadas = new HashSet<PlasticIds>();
            foreach (var e in Jogo.Inimigos.Concat(_criados)) if (e.Model != null && e.Model.Type == tipo) usadas.Add(e.PlasticId);   // (os criados que esperam o aviso tambem ja tem cor)
            foreach (PlasticIds id in new[] { PlasticIds.Orange, PlasticIds.Green, PlasticIds.Yellow, PlasticIds.Purple }) if (!usadas.Contains(id)) return id;
            return PlasticIds.Orange;
        }

        public static string NomeDe(EnemyModel modelo)
        {
            try
            {
                var chave = modelo.KeyNameSingular;
                var nome = FFGLocalization.Get(chave, false);
                if (!string.IsNullOrEmpty(nome)) return nome;
            }
            catch { }
            return modelo.name;
        }

        public static IEnumerable<SerializedEnemy> Vivos(string id, string grupo)
        {
            foreach (var e in Jogo.Inimigos)
            {
                if (!string.IsNullOrEmpty(id) && !string.Equals(e.ModelId, id, StringComparison.OrdinalIgnoreCase)) continue;
                if (!string.IsNullOrEmpty(grupo) && !(GrupoDe.TryGetValue(e.GUID, out var g) && string.Equals(g, grupo, StringComparison.OrdinalIgnoreCase))) continue;
                yield return e;
            }
        }

        /// <summary>O inimigo vivo gerado por certa entrada do mapa (grupo + posicao dentro do grupo), se ainda estiver no tabuleiro.</summary>
        public static SerializedEnemy VivoDaEntrada(string grupo, int indice, List<Dmap.Inimigo> mapa)
        {
            var doGrupo = mapa.Where(x => string.Equals(x.Grupo ?? "", grupo ?? "", StringComparison.OrdinalIgnoreCase)).ToList();
            if (indice < 0 || indice >= doGrupo.Count) return null;
            var entrada = doGrupo[indice];
            foreach (var e in Jogo.Inimigos)
                if (OrigemDe.TryGetValue(e.GUID, out var o) && ReferenceEquals(o, entrada)) return e;
            return null;
        }

        /// <summary>Uma peca saiu do tabuleiro: os inimigos que estavam sobre ela (e os que esperavam a sala) deixam de contar, sem
        /// contar como derrotados; a figura sai quando a mesa tirar a peca.</summary>
        public static List<SerializedEnemy> RetirarNasCasas(HashSet<(int, int)> casas, string sala)
        {
            var saem = new List<SerializedEnemy>();
            foreach (var e in Jogo.Inimigos.ToList())
            {
                var c = CasaDe(e); bool sai = c.HasValue && casas.Contains(c.Value);
                if (!sai) try { foreach (var sp in e.SpawnPositions) if (casas.Contains((Mathf.RoundToInt(sp.x), Mathf.RoundToInt(-sp.z)))) { sai = true; break; } } catch { }
                if (!sai) continue;
                try { Motor.Roteiro.Retirado(e.GUID); } catch { }
                saem.Add(e);
            }
            if (!string.IsNullOrEmpty(sala)) _emSalaOculta.RemoveAll(x => string.Equals(x.sala, sala, StringComparison.OrdinalIgnoreCase));
            return saem;
        }

        public static string NomeDoInimigo(SerializedEnemy e) { try { return NomeDe(UserCollectionManager.GetEnemy(e.ModelId, false)) ?? e.ModelId; } catch { return e?.ModelId ?? "?"; } }

        /// <summary>A casa do inimigo: onde o mapa o pos ou, se nao, a primeira posicao de entrada.</summary>
        public static (int, int)? CasaDe(SerializedEnemy e)
        {
            if (e == null) return null;
            if (OrigemDe.TryGetValue(e.GUID, out var o) && o?.Pos != null && o.Pos.Length >= 2) return (o.Pos[0], o.Pos[1]);
            try { foreach (var sp in e.SpawnPositions) return (Mathf.RoundToInt(sp.x), Mathf.RoundToInt(-sp.z)); } catch { }
            return null;
        }

        public static List<string> RemoverNasCasas(HashSet<(int, int)> casas, string sala)
        {
            var nomes = new List<string>();
            foreach (var e in Jogo.Inimigos.ToList())
            {
                bool sai = false;
                try { foreach (var sp in e.SpawnPositions) if (casas.Contains((Mathf.RoundToInt(sp.x), Mathf.RoundToInt(-sp.z)))) { sai = true; break; } } catch { }
                if (!sai && OrigemDe.TryGetValue(e.GUID, out var o) && o?.Pos != null && o.Pos.Length >= 2 && casas.Contains((o.Pos[0], o.Pos[1]))) sai = true;
                if (!sai) continue;
                nomes.Add(NomeDe(UserCollectionManager.GetEnemy(e.ModelId, false)) ?? e.ModelId);
                try { Motor.Roteiro.Retirado(e.GUID); } catch { }
                Tirar(e);
            }
            if (!string.IsNullOrEmpty(sala)) _emSalaOculta.RemoveAll(x => string.Equals(x.sala, sala, StringComparison.OrdinalIgnoreCase));
            return nomes;
        }

        public static void Tirar(SerializedEnemy e)
        {
            try { Jogo.Controle.RemoveEnemy(e); } catch (Exception ex) { Log.Info("  não tirei o inimigo: " + ex.Message); }
        }
    }
}
