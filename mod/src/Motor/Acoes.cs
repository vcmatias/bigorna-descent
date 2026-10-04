using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.Core;
using FFG.D3;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Bigorna.Motor
{
    /// <summary>Acoes dos gatilhos. Alem das do editor: if, fireTrigger, goToObjective, askYesNo, randomVariable, revealRoom, log...</summary>
    public static class Acoes
    {
        static readonly List<Transform> _realces = new List<Transform>();
        static readonly List<Transform> _ateARodada = new List<Transform>();

        public static void Executar(List<Dmap.Clausula> lista, Dmap.Gatilho dono)
        {
            if (lista == null) return;
            for (int i = 0; i < lista.Count; i++)
            {
                var a = lista[i];
                if (a == null || string.IsNullOrEmpty(a.Id)) continue;
                if (a.Id == "wait")
                {
                    float s = Mathf.Max(0f, P.Inteiro(a.Params, "seconds", 1));
                    var resto = lista.Skip(i + 1).ToList();
                    Nucleo.Instancia.StartCoroutine(Depois(s, resto, dono, Roteiro.Mapa));
                    Tabuleiro.FecharLote();
                    Anunciar();
                    return;
                }
                // remocoes seguidas (as salas deixadas para tras) viram uma desmontagem so
                bool remove = a.Id == "removeRoom" || a.Id == "removeTile";
                if (remove) Tabuleiro.IniciarLote();
                try { Uma(a, dono); }
                catch (Exception ex) { Log.Erro("a ação «" + a.Id + "» falhou", ex); }
                var prox = i + 1 < lista.Count ? lista[i + 1] : null;
                if (remove && !(prox != null && (prox.Id == "removeRoom" || prox.Id == "removeTile"))) Tabuleiro.FecharLote();
            }
            Tabuleiro.FecharLote();
            Anunciar();
        }

        static IEnumerator Depois(float s, List<Dmap.Clausula> resto, Dmap.Gatilho dono, Dmap mapa)
        {
            yield return new WaitForSeconds(s);
            while (Jogo.Salvando) yield return null;
            // o resto so corre no mesmo mapa (outro encontro pode ter comecado durante a espera)
            if (Roteiro.EmMarcha && ReferenceEquals(Roteiro.Mapa, mapa)) Executar(resto, dono);
        }

        /// <summary>Herois sorteados numa cena: "@hero1".."@hero4" (quem fala ou quem aparece) viram herois diferentes do grupo,
        /// sorteados a cada vez que a cena toca, pelos personagens variaveis do proprio jogo (STORY_CHARACTER_VARIABLE_HEROn:
        /// retrato e nome do heroi daquela vaga); "{hero1}".."{hero4}" no texto viram o nome deles. Com menos herois que o pedido,
        /// os que faltam repetem os primeiros.</summary>
        static void HeroisSorteados(List<Dcamp.Dialogo> lista)
        {
            var herois = Jogo.Herois; if (herois.Count == 0) return;
            var ordem = Enumerable.Range(0, herois.Count).OrderBy(_ => UnityEngine.Random.value).ToList();
            // "@actor": o heroi que usou o objeto (o ultimo); sem ele, o primeiro sorteado. Os sorteados evitam repeti-lo
            int ator = -1; var quem0 = Encontro.Objetos.QuemUsou;
            if (quem0 != null) ator = herois.FindIndex(h => ReferenceEquals(h, quem0) || h.HeroId == quem0.HeroId);
            if (ator >= 0 && herois.Count > 1) { ordem.Remove(ator); ordem.Add(ator); }
            int Ator() => ator >= 0 ? ator : ordem[0];
            int Vaga(int n) => ordem[(n - 1) % ordem.Count];
            string Id(string quem)
            {
                if (string.Equals(quem, "@actor", StringComparison.OrdinalIgnoreCase)) return "STORY_CHARACTER_VARIABLE_HERO" + (Ator() + 1);
                if (string.IsNullOrEmpty(quem) || !quem.StartsWith("@hero", StringComparison.OrdinalIgnoreCase) || !int.TryParse(quem.Substring(5), out var n) || n < 1) return quem;
                return "STORY_CHARACTER_VARIABLE_HERO" + (Vaga(n) + 1);
            }
            string Texto(string t)
            {
                if (string.IsNullOrEmpty(t) || (t.IndexOf("{hero", StringComparison.OrdinalIgnoreCase) < 0 && t.IndexOf("{actor}", StringComparison.OrdinalIgnoreCase) < 0)) return t;
                t = System.Text.RegularExpressions.Regex.Replace(t, @"\{actor\}", m => Encontro.Herois.NomeDe(herois[Ator()]), System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                return System.Text.RegularExpressions.Regex.Replace(t, @"\{hero(\d)\}", m => Encontro.Herois.NomeDe(herois[Vaga(int.Parse(m.Groups[1].Value))]), System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            }
            bool usou = false;
            foreach (var d in lista)
            {
                var antes = d.Personagem; d.Personagem = Id(d.Personagem); usou |= antes != d.Personagem;
                if (d.Elenco != null) d.Elenco = d.Elenco.Select(Id).Distinct().Where(x => x != d.Personagem).ToList();
                d.Texto = Texto(d.Texto); d.Titulo = Texto(d.Titulo);
                foreach (var o in d.Opcoes ?? new List<Dcamp.Opcao>()) o.Texto = Texto(o.Texto);
            }
            if (usou) Log.Info("  cena com heróis sorteados: " + string.Join(", ", ordem.Take(2).Select(i => herois[i].HeroId).ToArray()));
        }

        /// <summary>Coisas que acontecem na mesa e o app so avisa (dano em heroi, itens...). Sao juntadas num quadro so.</summary>
        static void Anotar(string texto) { Roteiro.Pendencias.Add("• " + texto); }
        /// <summary>Uma cena de gatilho espera a fila de avisos: as pecas, os objetos e o texto da sala que abriu vem antes.</summary>
        static IEnumerator CenaDepoisDosAvisos(Dcamp cena, Dcamp.Dialogo primeira)
        {
            yield return null; yield return null;   // (as acoes seguintes do mesmo gatilho entram na fila primeiro)
            float t0 = Time.unscaledTime;
            while ((Dialogos.Ocupado || Dialogos.NaFila > 0) && Time.unscaledTime - t0 < 120f) yield return null;
            Campanha.Conversa.Tocar(cena, primeira, null);
        }

        /// <summary>A frase do proprio jogo para a acao adicional, no idioma do jogo (a chave UI_ADDITIONAL_ACTION).</summary>
        static string AcaoAdicional() => Jogo.Texto("UI_ADDITIONAL_ACTION", "O herói pode fazer mais uma ação.");

        static void Anunciar()
        {
            if (Roteiro.Pendencias.Count == 0) return;
            var texto = "Apliquem na mesa:\n" + string.Join("\n", Roteiro.Pendencias.ToArray());
            Roteiro.Pendencias.Clear();
            Dialogos.Mensagem(texto, null, "Na mesa");
        }

        static void Uma(Dmap.Clausula a, Dmap.Gatilho dono)
        {
            var p = a.Params;
            var gc = Jogo.Controle;
            switch (a.Id)
            {
                // ------------------------------------------------ extensoes de fluxo
                case "if":
                {
                    var cond = P.Clausulas(p, "conditions");
                    var entao = P.Clausulas(p, "then") ?? P.Clausulas(p, "actions");
                    var senao = P.Clausulas(p, "else");
                    bool ok = cond == null || cond.All(c => Condicoes.Avaliar(c, dono));
                    Log.Info("  if → " + (ok ? "então" : "senão"));
                    Executar(ok ? entao : senao, dono);
                    break;
                }
                case "fireTrigger":
                case "runTrigger":
                {
                    var g = Roteiro.GatilhoPorId(P.Texto(p, "trigger"));
                    if (g == null) Log.Info("  fireTrigger: gatilho «" + P.Texto(p, "trigger") + "» não existe");
                    else Roteiro.Executar(g, P.Booleano(p, "force", false));
                    break;
                }
                case "goToObjective": Roteiro.IrParaObjetivo(P.Inteiro(p, "n", 1)); break;
                case "randomVariable":
                {
                    var v = P.Texto(p, "var") ?? "sorte";
                    Roteiro.Vars[v] = UnityEngine.Random.Range(P.Inteiro(p, "min", 1), P.Inteiro(p, "max", 6) + 1);
                    Log.Info("  " + v + " = " + Roteiro.Vars[v] + " (sorteio)");
                    break;
                }
                case "subVariable": { var v = P.Texto(p, "var") ?? ""; Roteiro.Vars[v] = Roteiro.Var(v) - P.Inteiro(p, "value", 1); Log.Info("  " + v + " = " + Roteiro.Vars[v]); Roteiro.VarMudou(v); break; }
                case "askYesNo":
                {
                    var v = P.Texto(p, "var") ?? "resposta";
                    var sim = P.Texto(p, "yes") ?? "Sim"; var nao = P.Texto(p, "no") ?? "Não";
                    int objeto = Roteiro.ObjetoDaPergunta;
                    Dialogos.Escolha(P.Texto(p, "text") ?? "?", new List<string> { sim, nao }, i =>
                    {
                        Roteiro.Vars[v] = i == 0 ? 1 : 0;
                        Roteiro.Escolheu(i, objeto);
                    });
                    break;
                }
                case "revealRoom": Tabuleiro.Revelar(P.Texto(p, "group")); break;
                case "reopenObject": Objetos.Reabrir(P.Inteiro(p, "interactable", -1)); break;
                case "log": Log.Info("  [mapa] " + (P.Texto(p, "text") ?? "")); break;
                case "tableNote": Anotar(P.Texto(p, "text") ?? ""); break;

                // ------------------------------------------------ inimigos
                case "spawnGroup":
                {
                    var grupo = P.Texto(p, "group");
                    var lista = Roteiro.Mapa.Spawns.Inimigos.Where(e => string.Equals(e.Grupo, grupo, StringComparison.OrdinalIgnoreCase)).ToList();
                    if (lista.Count == 0) { Log.Info("  grupo «" + grupo + "» vazio"); break; }
                    Log.Info("  entra o grupo «" + grupo + "» (" + lista.Count + ")");
                    Inimigos.EntrarAgora(lista);
                    break;
                }
                case "spawnEnemyAt":
                {
                    var id = P.Texto(p, "enemy");
                    if (string.IsNullOrEmpty(id)) break;
                    int n = Math.Max(1, P.Inteiro(p, "count", 1));
                    var lista = new List<Dmap.Inimigo>();
                    for (int i = 0; i < n; i++) lista.Add(new Dmap.Inimigo { Id = id, Pos = P.Celula(p), Grupo = P.Texto(p, "group"), Tier = P.Inteiro(p, "tier", 0) });
                    Inimigos.EntrarAgora(lista);
                    break;
                }
                case "spawnRandom":
                {
                    int n = Math.Max(1, P.Inteiro(p, "count", 2));
                    var area = P.Area(p);
                    // sai da reserva (spawn pool) quando ha uma; senao, dos inimigos que o mapa ja tem
                    var modelos = Inimigos.Reserva.Count > 0 ? Inimigos.Reserva.Distinct().ToList() : Roteiro.Mapa.Spawns.Inimigos.Where(e => !Balanceado.EhVaga(e)).Select(e => e.Id).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList();
                    if (modelos.Count == 0) { Anotar("Entram " + n + " inimigos aleatórios" + (area != null ? " na área " + area[0] + "," + area[1] + " a " + area[2] + "," + area[3] : "")); break; }
                    var lista = new List<Dmap.Inimigo>();
                    var vaoEntrar = new Dictionary<EnemyTypes, int>();
                    for (int i = 0; i < n; i++)
                    {
                        int[] pos = area != null ? new[] { UnityEngine.Random.Range(area[0], area[2] + 1), UnityEngine.Random.Range(area[1], area[3] + 1) } : null;
                        // so tipos com figura livre (miniaturas das caixas menos as em jogo), como o jogo
                        var livres = modelos.Select(id => UserCollectionManager.GetEnemy(id, false)).Where(m => m != null && Balanceado.FigurasLivres(m.Type, vaoEntrar) > 0).ToList();
                        if (livres.Count == 0) { Log.Info("  spawnRandom: sem figuras livres para mais monstros"); break; }
                        var esc = livres[UnityEngine.Random.Range(0, livres.Count)];
                        vaoEntrar[esc.Type] = (vaoEntrar.TryGetValue(esc.Type, out var ja) ? ja : 0) + 1;
                        lista.Add(new Dmap.Inimigo { Id = esc.Id, Pos = pos, Grupo = P.Texto(p, "group") });
                    }
                    Inimigos.EntrarAgora(lista);
                    break;
                }
                case "removeEnemy":
                {
                    // Bigorna: "slot" = grupo#indice aponta para UM inimigo em particular do mapa
                    var slot = P.Texto(p, "slot");
                    if (!string.IsNullOrEmpty(slot))
                    {
                        int h = slot.LastIndexOf('#');
                        var grupo = h >= 0 ? slot.Substring(0, h) : slot;
                        int k = h >= 0 && int.TryParse(slot.Substring(h + 1), out var kk) ? kk : 0;
                        var alvo = Inimigos.VivoDaEntrada(grupo, k, Roteiro.Mapa.Spawns.Inimigos);
                        if (alvo == null) { Log.Info("  removeEnemy: o inimigo " + slot + " não está no tabuleiro; nada acontece"); break; }
                        Tirar(alvo);
                        break;
                    }
                    foreach (var e in Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group")).ToList()) Tirar(e);
                    break;
                }
                case "removeGroup":
                    foreach (var e in Inimigos.Vivos(null, P.Texto(p, "group")).ToList()) Tirar(e);
                    break;
                case "removeAllEnemies":
                    foreach (var e in Jogo.Inimigos) Tirar(e);
                    break;
                case "damageEnemy":
                case "healEnemy":
                {
                    int n = P.Inteiro(p, "amount", P.Inteiro(p, "n", 5));
                    bool cura = a.Id == "healEnemy";
                    // "all": cada inimigo que casa recebe (brasas espalhadas, cura do grupo); sem ele, so o mais ferido
                    var vivos = Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group")).OrderBy(x => x.Health).ToList();
                    if (!P.Booleano(p, "all", false)) vivos = vivos.Take(1).ToList();
                    if (vivos.Count == 0) { Log.Info("  " + a.Id + ": nenhum inimigo assim"); break; }
                    foreach (var alvo in vivos)
                    {
                        int antes = alvo.Health;
                        int depois = Mathf.Clamp(antes + (cura ? n : -n), -99, alvo.StartingHealth);
                        alvo.Health = depois;
                        Log.Info("  " + a.Id + " «" + alvo.ModelId + "»: " + antes + " → " + depois);
                        if (depois <= 0) Morrer(alvo);
                    }
                    Jogo.Sujo();
                    break;
                }
                case "applyConditionEnemy":
                case "applyConditionGroup":
                {
                    var estado = P.Texto(p, "condition");
                    foreach (var e in Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group"))) Estado(e, estado, true);
                    Jogo.Sujo();
                    break;
                }
                case "escort":
                    // a escolta: o protegido passa a ser alvo possivel dos monstros (os cacadores sempre; os outros, pela chance)
                    Escolta.Comecar(P.Texto(p, "name"), P.Inteiro(p, "chance", 25), P.Textos(p, "hunters") ?? new List<string>());
                    break;
                case "escortEnd": Escolta.Parar(); break;
                case "moveObject":
                {
                    var c = P.Celula(p); if (c == null) break;
                    Objetos.Mover(P.Inteiro(p, "interactable", -1), c[0], c[1], P.Inteiro(p, "level", 0));
                    break;
                }
                case "enemyBonus":
                {
                    // o campeao perde (ou ganha) um traco: ataque e defesa de quem casa
                    int at = P.Inteiro(p, "attack", 0), df = P.Inteiro(p, "defense", 0);
                    foreach (var e in Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group"))) { e.BaseAttack = Math.Max(0, e.BaseAttack + at); e.Defense = Math.Max(0, e.Defense + df); Log.Info("  enemyBonus «" + e.ModelId + "»: ataque " + e.BaseAttack + ", defesa " + e.Defense); }
                    Jogo.Sujo();
                    break;
                }
                case "clearConditions":
                    foreach (var e in Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group")))
                        foreach (SerializedEnemy.BoolFields campo in Enum.GetValues(typeof(SerializedEnemy.BoolFields)))
                            if ((int)campo < 100 && campo != SerializedEnemy.BoolFields.IsNamed) SerializedEnemy.SetBoolField(e, campo, false);
                    Jogo.Sujo();
                    break;
                case "addWeakness":
                case "addResistance":
                {
                    if (!Enum.TryParse<DamageTraits>(P.Texto(p, "trait") ?? "", true, out var traco)) { Anotar(a.Id + ": " + P.Texto(p, "trait")); break; }
                    var tipo = a.Id == "addWeakness" ? EnemyTraitType.Weakness : EnemyTraitType.Resistance;
                    foreach (var e in Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group")))
                        e.AdditionalWeaknessesAndResistances.Add(new AppliedDamageTrait(tipo, traco));
                    Jogo.Sujo();
                    break;
                }
                case "renameEnemy":
                {
                    var nome = P.Texto(p, "name");
                    foreach (var e in Inimigos.Vivos(P.Texto(p, "enemy"), P.Texto(p, "group"))) { e.KeyName = nome; e.IsNamed = true; }
                    Jogo.Sujo();
                    break;
                }
                case "reduceThreat": Anotar("Reduzam a ameaça em " + P.Inteiro(p, "amount", 2)); break;
                case "setEnemyTarget": Anotar("«" + P.Texto(p, "enemy") + "» passa a mirar " + P.Texto(p, "hero")); break;
                case "showEnemyActivation": Anotar("Ativação de «" + P.Texto(p, "enemy") + "»"); break;
                case "enemyDropsLoot": Anotar("«" + P.Texto(p, "enemy") + "» deixa cair espólios (" + P.Inteiro(p, "points", 3) + " pontos)"); break;
                case "addEnemyToReserve":
                case "removeEnemyFromReserve":
                {
                    var idModelo = P.Texto(p, "enemy") ?? "";
                    if (a.Id == "addEnemyToReserve") { if (!Inimigos.Reserva.Contains(idModelo)) Inimigos.Reserva.Add(idModelo); }
                    else Inimigos.Reserva.RemoveAll(x => string.Equals(x, idModelo, StringComparison.OrdinalIgnoreCase));
                    Log.Info("  reserva: " + string.Join(", ", Inimigos.Reserva.ToArray()));
                    // o pool do Bigorna e o que PODE sair; a "reserve list" do jogo e o contrario (segura figuras para depois):
                    // nada vai para ela
                    break;
                }
                case "addItemToPool": Butim.MudarPool(P.Texto(p, "item"), false); break;
                case "removeItemFromPool": Butim.MudarPool(P.Texto(p, "item"), true); break;
                case "blockRandomSpawn": case "unblockRandomSpawn": break;

                // ------------------------------------------------ herois (ficam na mesa)
                case "damageHeroes": Anotar("Cada herói sofre " + P.Inteiro(p, "amount", 2) + " de dano"); break;
                case "damageHero": Anotar(NomeHeroi(P.Texto(p, "hero")) + " sofre " + P.Inteiro(p, "amount", 2) + " de dano"); break;
                case "damageRandomHero":
                {
                    var herois = Jogo.Herois;
                    var h = herois.Count > 0 ? herois[UnityEngine.Random.Range(0, herois.Count)] : null;
                    Anotar((h != null ? Herois.NomeDe(h) : "Um herói") + " sofre " + P.Inteiro(p, "amount", 1) + " de dano");
                    break;
                }
                case "healHeroes": Anotar("Cada herói recupera " + P.Inteiro(p, "amount", 2) + " de vida"); break;
                case "moveHeroes":
                {
                    // entra na fila de avisos: depois das pecas e dos objetos da sala que abriu, antes dos inimigos (que esperam a
                    // fila esvaziar). As casas de destino se acendem com o aviso (ate a proxima rodada ou o proximo "mover herois")
                    var pares = P.Lista(p, "spots");
                    var casas = new List<int[]>();
                    if (pares != null) for (int k = 0; k + 1 < pares.Count; k += 2) casas.Add(new[] { pares[k], pares[k + 1], pares[k], pares[k + 1] });
                    if (casas.Count == 0) { var ar = P.Area(p); if (ar != null) casas.Add(ar); }
                    var txt = P.Texto(p, "text");
                    var texto = !string.IsNullOrEmpty(txt) ? txt : casas.Count > 0 ? "Movam os heróis para as casas destacadas (um herói por casa; se faltar casa, na casa livre mais próxima)." : "Movam todos os heróis para o lugar indicado.";
                    Dialogos.Mensagem(texto, null, "Na mesa", () =>
                    {
                        LimparDestinos();
                        var cena = Jogo.Cena; int n = 0;
                        if (cena != null)
                            foreach (var ar in casas)
                                foreach (var tr in TransformsDe(new Dictionary<string, object> { { "area", new List<object> { ar[0], ar[1], ar[2], ar[3] } } }))
                                { try { cena.AddPersistentHighlight(tr); _destinos.Add(tr); n++; } catch { } }
                        try { if (casas.Count > 0) cena?.CameraEncounter?.FocusOn(new Vector3(casas[0][0], 0f, -casas[0][1])); } catch { }
                        Log.Info("  mover heróis: " + n + " casa(s) de destino destacadas");
                    });
                    break;
                }
                case "moveHero": { var c = P.Celula(p); Anotar("Movam " + NomeHeroi(P.Texto(p, "hero")) + " para " + (c != null ? c[0] + "," + c[1] : "o lugar indicado")); break; }
                case "setHeroOnFire": Anotar(NomeHeroi(P.Texto(p, "hero")) + " pega fogo"); break;

                // ------------------------------------------------ butim
                case "giveLoot": { var it = P.Texto(p, "loot") ?? P.Texto(p, "item") ?? ""; if (it.Length > 0) Roteiro.Vars["item-" + it] = 1; Butim.Entregar(new Dmap.Butim { Modo = "explicit", Itens = new List<string> { it } }, null); break; }
                case "giveRandomLoot": Butim.Entregar(new Dmap.Butim { Modo = "random", Pontos = P.Inteiro(p, "points", 3), Ouro = P.Inteiro(p, "gold", 0), Tracos = P.Textos(p, "traits") ?? new List<string>() }, null); break;
                case "giveMaterials": Butim.DarMateriais(P.Inteiro(p, "amount", 2), null); break;
                case "removeGold": Butim.TirarOuro(P.Inteiro(p, "amount", 10), null); break;
                case "removeRandomMaterial": Butim.TirarMateriais(P.Inteiro(p, "amount", 1), null); break;
                case "giveGold": Butim.Entregar(new Dmap.Butim { Modo = "explicit", Ouro = P.Inteiro(p, "amount", 10) }, null); break;
                case "giveRandomItem": Butim.Entregar(new Dmap.Butim { Modo = "random", Quantos = Math.Max(1, P.Inteiro(p, "count", 1)), Ouro = P.Inteiro(p, "gold", 0) }, null); break;
                case "removeItem": Anotar("Percam o item «" + Butim.NomeItem(P.Texto(p, "loot")) + "»"); break;
                case "giveRecipe": Anotar("Aprendem a receita «" + P.Texto(p, "recipe") + "»"); break;
                case "removeMaterials": Anotar("Gastem " + P.Inteiro(p, "amount", 1) + " de «" + P.Texto(p, "material") + "»"); break;

                // ------------------------------------------------ tabuleiro
                case "revealTiles": Tabuleiro.Revelar(P.Texto(p, "group")); break;
                case "removeRoom": Tabuleiro.RemoverGrupo(P.Texto(p, "group")); break;
                case "removeTile": Tabuleiro.RemoverPeca(P.Inteiro(p, "tile", -1)); break;
                case "setVar": Roteiro.Vars[P.Texto(p, "var") ?? ""] = P.Inteiro(p, "value", 1); break;
                case "announceMission": Roteiro.AnunciarMissao(P.Texto(p, "mission")); break;
                case "blockCells":
                case "unblockCells":
                {
                    var cena = Jogo.Cena; if (cena == null) break;
                    int n = 0;
                    foreach (var casa in CasasDe(p)) { if (a.Id == "blockCells") cena.AddDynamicBlockingPosition(casa); else cena.RemoveDynamicBlockingPosition(casa); n++; }
                    Log.Info("  " + a.Id + ": " + n + " casa(s)");
                    break;
                }
                case "openDoor": Objetos.Usar(P.Inteiro(p, "interactable", -1)); break;
                case "closeDoor": Objetos.Reabrir(P.Inteiro(p, "interactable", -1)); break;
                case "setInteractable": Objetos.Mostrar(P.Inteiro(p, "interactable", -1), P.Booleano(p, "enabled", true)); break;
                case "showObject": Objetos.Mostrar(P.Inteiro(p, "interactable", -1), true); break;
                case "hideObject": Objetos.Mostrar(P.Inteiro(p, "interactable", -1), false); break;
                // o objeto fica na mesa, mas ja nao se usa (um teste cumulativo que enfim passou)
                case "spendObject": { var po = Objetos.Pegar(P.Inteiro(p, "interactable", -1)); if (po != null) { po.Usado = true; Log.Info("  objeto «" + po.Rotulo + "» gasto"); } break; }
                case "startFire": { var ar = P.Area(p); Anotar("Fogo na área " + (ar != null ? ar[0] + "," + ar[1] + " a " + ar[2] + "," + ar[3] : "indicada")); break; }
                case "highlightArea":
                {
                    var cena = Jogo.Cena; if (cena == null) break;
                    int n = 0;
                    // "untilRound": o aviso de onde algo vai surgir (o sino): apaga quando a proxima rodada comecar
                    var lista = P.Booleano(p, "untilRound", false) ? _ateARodada : _realces;
                    foreach (var tr in TransformsDe(p)) { cena.AddPersistentHighlight(tr); lista.Add(tr); n++; }
                    Log.Info("  realçadas " + n + " casa(s)");
                    break;
                }
                case "clearHighlights": LimparRealces(); break;
                case "outlineObject":
                {
                    var o = Objetos.Pegar(P.Inteiro(p, "interactable", -1));
                    if (o?.Corpo != null) Jogo.Cena?.AddOutline(o.Corpo);
                    break;
                }

                // ------------------------------------------------ narrativa
                case "showMessage":
                {
                    var texto = Roteiro.ComContadores(P.Texto(p, "text"));
                    // "additionalAction": the game's own sentence ("You may perform an additional action"), in its language
                    if (P.Booleano(p, "additionalAction", false)) texto = (string.IsNullOrEmpty(texto) ? "" : texto + "\n\n") + AcaoAdicional();
                    Dialogos.Mensagem(texto, null, P.Texto(p, "title"));
                    break;
                }
                case "additionalAction": Dialogos.Mensagem(AcaoAdicional()); break;
                case "showChoice":
                {
                    var opcoes = P.Textos(p, "options") ?? new List<string>();
                    if (opcoes.Count == 0) { Dialogos.Mensagem(P.Texto(p, "text")); break; }
                    int objeto = Roteiro.ObjetoDaPergunta;
                    // "once": para cada resposta, a variavel que diz que ela ja foi escolhida (uma busca: cada opcao uma vez so)
                    var umaVez = P.Textos(p, "once");
                    List<bool> ativas = null;
                    if (umaVez != null && umaVez.Count > 0)
                    {
                        ativas = opcoes.Take(5).Select((_, i) => i >= umaVez.Count || string.IsNullOrEmpty(umaVez[i]) || Roteiro.Var(umaVez[i]) == 0).ToList();
                        if (!ativas.Any(a => a))
                        {
                            Dialogos.Mensagem(P.Texto(p, "empty") ?? "Nada mais a fazer aqui.");
                            break;
                        }
                    }
                    Dialogos.Escolha(P.Texto(p, "text") ?? "", opcoes.Take(5).ToList(), i => Roteiro.Escolheu(i, objeto), null, ativas);
                    break;
                }
                case "showChallenge":
                {
                    // os testes como no jogo:
                    // - aberto: o quadro diz quantos sucessos são precisos; os jogadores rolam na mesa e dizem se passaram
                    //   ("Passou" / "Falhou", as palavras do jogo);
                    // - secreto: os jogadores informam quantos sucessos tiraram, sem saber quantos são precisos;
                    // - acumulado: os sucessos de cada tentativa somam (uma fechadura, uma porta pesada) até chegar ao total
                    int objeto = Roteiro.ObjetoDaPergunta;
                    int alvo = P.Inteiro(p, "successes", 0);
                    if (alvo <= 0)
                    {
                        switch ((P.Texto(p, "difficulty") ?? "standard").Trim().ToLowerInvariant())
                        { case "easy": alvo = 1; break; case "hard": alvo = 3; break; case "extreme": alvo = 4; break; default: alvo = 2; break; }
                    }
                    bool secreto = P.Booleano(p, "secret", false);
                    bool acumulado = P.Booleano(p, "cumulative", false);
                    string chave = "acum-" + (P.Texto(p, "id") ?? objeto.ToString());
                    var atributo = P.Texto(p, "attribute");
                    int meta = alvo;
                    Action<bool> resultado = ok =>
                    {
                        Roteiro.Vars["ultimoDesafio"] = ok ? 1 : 0;
                        Log.Info("  teste: " + (ok ? "sucesso" : "fracasso"));
                        Roteiro.Escolheu(ok ? 0 : 1, objeto);
                    };
                    if (Menu.Depuracao.PassarTeste) { Log.Info("  [teste] o teste passa sozinho"); Roteiro.Vars["ultimosSucessos"] = meta; if (acumulado) Roteiro.Vars[chave] = 0; resultado(true); break; }
                    if (!secreto && !acumulado)
                    {
                        var textoA = (P.Texto(p, "text") ?? "Teste") + "\n\n" + (string.IsNullOrEmpty(atributo) ? "" : "Teste de <b>" + atributo + "</b>: ")
                            + "precisam de <b>" + alvo + "</b> sucesso(s). Façam o teste na mesa e digam se passaram.";
                        Dialogos.Escolha(textoA, new List<string> { Jogo.Texto("UI_PASS", "Passou"), Jogo.Texto("UI_FAIL", "Falhou") }, i => { Roteiro.Vars["ultimosSucessos"] = i == 0 ? meta : 0; resultado(i == 0); });
                        break;
                    }
                    int antes = acumulado ? Roteiro.Var(chave) : 0;
                    var texto = (P.Texto(p, "text") ?? "Teste") + "\n\n" + (string.IsNullOrEmpty(atributo) ? "Teste de habilidade" : "Teste de <b>" + atributo + "</b>")
                        + (secreto ? " (o número de sucessos necessários é secreto)." : ": precisam de <b>" + alvo + "</b> sucesso(s)" + (acumulado ? " no total (já têm " + antes + ")." : "."))
                        + "\nFaçam o teste na mesa e informem quantos sucessos obtiveram.";
                    Dialogos.Desafio(texto, n =>
                    {
                        int total = acumulado ? antes + Math.Max(0, n) : n;
                        bool ok = total >= meta;
                        if (acumulado) Roteiro.Vars[chave] = ok ? 0 : total;
                        Roteiro.Vars["ultimosSucessos"] = n;
                        Log.Info("  teste: " + n + " sucesso(s)" + (acumulado ? ", " + total + " no total" : "") + ", precisava de " + meta + (secreto ? " (secreto)" : ""));
                        string msg = ok ? "<b>Sucesso!</b>" + (secreto ? "" : " (" + total + " de " + meta + ")")
                            : acumulado ? "<b>Ainda não.</b> O esforço conta: vocês estão mais perto" + (secreto ? "" : " (" + total + " de " + meta + ")") + ". Tentem de novo."
                            : "<b>Fracasso.</b>" + (secreto ? "" : " (" + n + " de " + meta + ")");
                        Dialogos.Mensagem(msg, null, "Teste");
                        resultado(ok);
                    });
                    break;
                }
                case "showVirtueChoice":
                {
                    int objeto = Roteiro.ObjetoDaPergunta;
                    Dialogos.Escolha(P.Texto(p, "text") ?? "", new List<string> { P.Texto(p, "option1") ?? "Primeira virtude", P.Texto(p, "option2") ?? "Segunda virtude" }, i => Roteiro.Escolheu(i, objeto));
                    break;
                }
                case "setObjectiveText": Roteiro.DefinirTextoObjetivo(P.Texto(p, "text") ?? "", P.Booleano(p, "final", false)); break;
                case "playCutscene": if (!Cinematica.Tocar(P.Texto(p, "cutscene"))) Log.Info("  playCutscene: não achei a cena «" + P.Texto(p, "cutscene") + "»"); break;

                // ------------------------------------------------ camera e som
                case "focusCamera": { var c = P.Celula(p); if (c != null) Jogo.Cena?.CameraEncounter?.FocusOn(Jogo.Mundo(c)); break; }
                case "resetCamera": Jogo.Cena?.CameraEncounter?.FocusOn(Jogo.Encontro?.BoundsOrigin ?? Vector3.zero); break;
                case "playMusic": Log.Info("  playMusic ainda não é suportado (" + P.Texto(p, "track") + ")"); break;
                case "playSound": { var arq = P.Texto(p, "file"); if (!string.IsNullOrEmpty(arq)) VozesProprias.TocarArquivo(arq); else Sons.Tocar(P.Texto(p, "sound") ?? "Place_Generic"); break; }
                case "startRoundTimer": Roteiro.IniciarCronometro(P.Texto(p, "timer"), P.Inteiro(p, "every", 2), P.Inteiro(p, "times", 0), P.Inteiro(p, "interactable", -1)); break;
                case "stopRoundTimer": Roteiro.PararCronometro(P.Texto(p, "timer")); break;
                case "playScene":
                {
                    // uma cena de caixas escrita no gatilho (como as cenas do story flow), tocada pelo mesmo quadro narrativo
                    object bruto = null; p?.TryGetValue("dialogues", out bruto);
                    var lista = (bruto as JArray)?.ToObject<List<Dcamp.Dialogo>>() ?? new List<Dcamp.Dialogo>();
                    lista.RemoveAll(d => d == null);
                    // como no Dcamp.Carregar: listas nulas no JSON viram vazias (a Conversa as percorre)
                    foreach (var d in lista) { d.Elenco = d.Elenco ?? new List<string>(); d.Opcoes = d.Opcoes ?? new List<Dcamp.Opcao>(); d.Opcoes.RemoveAll(o => o == null); d.Acoes = d.Acoes ?? new List<JObject>(); foreach (var o in d.Opcoes) o.Entao = o.Entao ?? new List<JObject>(); }
                    if (lista.Count == 0) { Log.Info("  playScene: a cena não tem caixas"); break; }
                    HeroisSorteados(lista);
                    var cena = new Dcamp { Dialogos = lista, Caminho = Roteiro.Mapa?.Caminho };
                    var primeira = cena.DialogoPorId(P.Texto(p, "start")) ?? lista[0];
                    Log.Info("  cena própria: " + lista.Count + " caixa(s), começa em «" + primeira.Id + "»");
                    // (depois dos avisos ja na fila ou que entram neste mesmo gatilho: a sala que abriu e montada antes da cena)
                    if (Nucleo.Instancia != null) Nucleo.Instancia.StartCoroutine(CenaDepoisDosAvisos(cena, primeira)); else Campanha.Conversa.Tocar(cena, primeira, null);
                    break;
                }
                case "playVideo":
                {
                    string arq = null;
                    try { arq = System.IO.Path.Combine(System.IO.Path.GetDirectoryName(Roteiro.Mapa?.Caminho ?? "") ?? "", System.IO.Path.GetFileName(P.Texto(p, "file") ?? "")); } catch { }
                    VideoProprio.Tocar(arq, null);
                    break;
                }

                // ------------------------------------------------ fluxo
                case "initVariable": Roteiro.Vars[P.Texto(p, "var") ?? ""] = P.Inteiro(p, "value", 0); Log.Info("  " + P.Texto(p, "var") + " começa em " + P.Inteiro(p, "value", 0)); break;
                case "setCampaignVar":
                {
                    // variavel da campanha (sobrevive ao mapa): "unlock a campaign map" libera um no do story flow
                    var v = P.Texto(p, "var"); var est = Campanha.Campanha.Estado;
                    if (string.IsNullOrEmpty(v) || est == null) { Log.Info("  setCampaignVar: sem campanha aberta"); break; }
                    est.PorVar(v, P.Inteiro(p, "value", 1)); Log.Info("  campanha: " + v + " = " + P.Inteiro(p, "value", 1));
                    break;
                }
                case "setVariable": Roteiro.Vars[P.Texto(p, "var") ?? ""] = P.Inteiro(p, "value", 1); Log.Info("  " + P.Texto(p, "var") + " = " + P.Inteiro(p, "value", 1)); Roteiro.VarMudou(P.Texto(p, "var")); break;
                case "addVariable": { var v = P.Texto(p, "var") ?? ""; Roteiro.Vars[v] = Roteiro.Var(v) + P.Inteiro(p, "value", 1); Log.Info("  " + v + " = " + Roteiro.Vars[v]); Roteiro.VarMudou(v); break; }
                case "enableTrigger": Roteiro.Ligar(P.Texto(p, "trigger"), true); break;
                case "disableTrigger": Roteiro.Ligar(P.Texto(p, "trigger"), false); break;
                case "completeObjective": Roteiro.Avancar(); break;
                case "winEncounter": Roteiro.Completar(true); break;
                case "loseEncounter": case "failMission": Roteiro.Completar(false); break;

                default:
                    Log.Info("  ação «" + a.Id + "» desconhecida; ignorada");
                    break;
            }
        }

        static string NomeHeroi(string id)
        {
            var h = Herois.Por(id);
            return h != null ? Herois.NomeDe(h) : (string.IsNullOrEmpty(id) ? "o herói indicado" : id);
        }

        static void Tirar(SerializedEnemy e)
        {
            Roteiro.Retirado(e.GUID);
            Inimigos.Tirar(e);
            Log.Info("  retirado «" + e.ModelId + "» (sem contar como derrotado)");
        }

        /// <summary>Modo de teste: da o monstro por derrotado, como se tivesse caido em combate.</summary>
        public static void Derrotar(SerializedEnemy e) => Morrer(e);

        static void Morrer(SerializedEnemy e)
        {
            try
            {
                var gc = Jogo.Controle;
                var arvore = gc.GetEnemyDefeatedDT(e);
                if (arvore != null)
                {
                    arvore.blackboard.SetValue("EnemyGUID", e.GUID);
                    ((IProcess)arvore).Context = e;
                    Jogo.Persistente.ProcessStack.Schedule(arvore, arvore);
                }
                else gc.PerformManualEnemyDefeat(e);
                Log.Info("  caiu «" + e.ModelId + "»");
            }
            catch (Exception ex) { Log.Info("  não consegui dar por morto: " + ex.Message); }
        }

        static void Estado(SerializedEnemy e, string estado, bool valor)
        {
            if (string.IsNullOrEmpty(estado)) return;
            if (!Enum.TryParse<SerializedEnemy.BoolFields>("Is" + estado, true, out var campo) && !Enum.TryParse(estado, true, out campo)) { Log.Info("  estado desconhecido: " + estado); return; }
            SerializedEnemy.SetBoolField(e, campo, valor);
        }

        static IEnumerable<Vector3> CasasDe(Dictionary<string, object> p)
        {
            var area = P.Area(p);
            if (area == null) yield break;
            for (int x = area[0]; x <= area[2]; x++)
                for (int y = area[1]; y <= area[3]; y++)
                    yield return Jogo.Mundo(x, y);
        }

        static IEnumerable<Transform> TransformsDe(Dictionary<string, object> p)
        {
            var cena = Jogo.Cena;
            var area = P.Area(p);
            if (cena?.AllGameGridCoords == null || area == null) yield break;
            foreach (var c in cena.AllGameGridCoords.Values)
            {
                if (c == null || c.OutOfBounds) continue;
                int x = Mathf.RoundToInt(c.transform.position.x), y = -Mathf.RoundToInt(c.transform.position.z);
                if (x >= area[0] && x <= area[2] && y >= area[1] && y <= area[3]) yield return c.transform;
            }
        }

        static readonly List<Transform> _destinos = new List<Transform>();

        /// <summary>Destaca casas ate a proxima rodada (ou o proximo "mover herois").</summary>
        public static int Destacar(IEnumerable<Transform> casas)
        {
            var cena = Jogo.Cena; if (cena == null || casas == null) return 0;
            int n = 0;
            foreach (var tr in casas) { if (tr == null || _destinos.Contains(tr)) continue; try { cena.AddPersistentHighlight(tr); _destinos.Add(tr); n++; } catch { } }
            return n;
        }

        /// <summary>Apaga o destaque das casas de destino do ultimo "mover herois".</summary>
        public static void LimparDestinos()
        {
            if (_destinos.Count == 0) return;
            var cena = Jogo.Cena;
            foreach (var tr in _destinos) { try { if (tr != null) cena?.RemovePersitentHighlight(tr); } catch { } }
            _destinos.Clear();
        }

        /// <summary>Apaga os destaques que valiam ate a proxima rodada.</summary>
        public static void LimparAteARodada()
        {
            var cena = Jogo.Cena;
            foreach (var tr in _ateARodada) { try { if (tr != null) cena?.RemovePersitentHighlight(tr); } catch { } }
            _ateARodada.Clear();
        }

        public static void LimparRealces()
        {
            LimparAteARodada();
            var cena = Jogo.Cena;
            foreach (var tr in _realces) { try { if (tr != null) cena?.RemovePersitentHighlight(tr); } catch { } }
            _realces.Clear();
        }
    }
}
