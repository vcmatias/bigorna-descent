using System;
using System.Collections.Generic;
using System.Linq;
using FFG.Core;
using FFG.D3;
using NodeCanvas.DialogueTrees;
using NodeCanvas.Framework;
using Bigorna.Motor;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Gatilhos dos apetrechos da Oficina: cada um tem uma causa, a chance de disparar e os efeitos que o app aplica (e um
    /// texto para a mesa, com o que o app nao acompanha). So valem com o apetrecho equipado.
    /// Causas: "ataque" (o heroi ataca: antes da rolagem), "dano" (o ataque tirou vida do inimigo), "derrota" (o heroi
    /// derrota um inimigo), "interacao" (o heroi termina uma interacao), "alvejado" (um inimigo ativa contra o heroi),
    /// "tempo" (a rodada acaba) e "ferido" (o heroi sofre um ferimento).
    /// As quatro primeiras vem das janelas de logica do jogo (como as dos apetrechos do proprio jogo: o apetrecho ganha uma
    /// logica nossa); as tres ultimas, de vigiar a partida.
    /// </summary>
    public static class Apetrechos
    {
        public class Efeito { public string Tipo; public int N = 1; public string Condicao; public string Modo; public string Item; public string Monstro; public string Texto; }
        public class Disparo { public string Quando; public int Chance = 100; public string Texto; public List<Efeito> Efeitos = new List<Efeito>(); }

        static readonly Dictionary<string, List<Disparo>> _apetrechos = new Dictionary<string, List<Disparo>>(StringComparer.Ordinal);
        /// <summary>Apetrecho da Oficina copiado de um do jogo com logica: a logica dele (o jogo a carrega pelo id do original).</summary>
        static readonly Dictionary<string, string> _logicaDoOriginal = new Dictionary<string, string>(StringComparer.Ordinal);
        static readonly Dictionary<string, ModelsGameLogic> _logicas = new Dictionary<string, ModelsGameLogic>(StringComparer.Ordinal);

        public static void Definir(string id, List<Disparo> disparos)
        {
            if (string.IsNullOrEmpty(id)) return;
            if (disparos == null || disparos.Count == 0) _apetrechos.Remove(id); else _apetrechos[id] = disparos;
        }
        public static void LogicaDoOriginal(string id, string original) { if (!string.IsNullOrEmpty(id) && !string.IsNullOrEmpty(original)) _logicaDoOriginal[id] = original; }
        internal static List<Disparo> De(string id) => id != null && _apetrechos.TryGetValue(id, out var l) ? l : null;

        public static List<Disparo> Ler(Newtonsoft.Json.Linq.JArray a)
        {
            var r = new List<Disparo>();
            foreach (var x in a ?? new Newtonsoft.Json.Linq.JArray())
            {
                if (!(x is Newtonsoft.Json.Linq.JObject j)) continue;
                var d = new Disparo { Quando = ((string)j["when"] ?? "").ToLowerInvariant(), Chance = Mathf.Clamp((int?)j["chance"] ?? 100, 1, 100), Texto = (string)j["text"] ?? "" };
                foreach (var y in (j["effects"] as Newtonsoft.Json.Linq.JArray) ?? new Newtonsoft.Json.Linq.JArray())
                {
                    if (!(y is Newtonsoft.Json.Linq.JObject f)) continue;
                    d.Efeitos.Add(new Efeito { Tipo = ((string)f["kind"] ?? "").ToLowerInvariant(), N = (int?)f["amount"] ?? 1, Condicao = ((string)f["condition"] ?? "").ToLowerInvariant(), Modo = ((string)f["mode"] ?? "").ToLowerInvariant(), Item = (string)f["item"], Monstro = (string)f["enemy"], Texto = (string)f["text"] });
                }
                if (!string.IsNullOrEmpty(d.Quando)) r.Add(d);
            }
            return r;
        }

        // ------------------------------------------------------------ a vigia da partida
        static float _proxima;
        static bool _naPartida;
        static int _rodadaAntes = -1;
        static readonly Dictionary<string, bool> _ativouAntes = new Dictionary<string, bool>(StringComparer.Ordinal);
        static readonly Dictionary<string, int> _saudeAntes = new Dictionary<string, int>(StringComparer.Ordinal);
        /// <summary>O dano a mais deste ataque, por heroi (sai depois do ataque, ou antes do proximo).</summary>
        static readonly Dictionary<string, int> _bonus = new Dictionary<string, int>(StringComparer.Ordinal);
        /// <summary>O ultimo ataque: quem, em quem, a vida dele antes; se o dano ja contou.</summary>
        class Ataque { public string Heroi, Inimigo; public int VidaAntes; public float Quando; public bool DanoContou; public List<Disparo> Pendentes; }
        static Ataque _ataque;
        /// <summary>Acoes adicionais ganhas, por heroi: cada uma tira um icone de acao gasta do heroi na foto da equipe
        /// (o app marca ali as acoes de cada heroi na rodada). Sem acao gasta ainda, fica guardada para a proxima.</summary>
        static readonly Dictionary<string, int> _acoesExtras = new Dictionary<string, int>(StringComparer.Ordinal);

        public static void Batimento()
        {
            if (_apetrechos.Count == 0 && _logicaDoOriginal.Count == 0) return;
            if (!Jogo.EmEncontro) { if (_naPartida) Sair(); return; }
            if (Time.unscaledTime < _proxima) return;
            _proxima = Time.unscaledTime + 0.2f;
            if (!_naPartida) { _naPartida = true; _rodadaAntes = -1; _ativouAntes.Clear(); _saudeAntes.Clear(); _ataque = null; }
            var herois = Jogo.Herois;
            // a logica dos apetrechos equipados
            var gc = Jogo.Controle;
            if (gc != null && gc.ModelLogicMap != null)
                foreach (var h in herois)
                {
                    var t = h.EquippedTrinket; if (t == null) continue;
                    int k = t.Id.GetHashCode();
                    if (gc.ModelLogicMap.TryGetValue(k, out var atual) && atual != null) continue;
                    try
                    {
                        if (_apetrechos.ContainsKey(t.Id)) gc.ModelLogicMap[k] = Logica(t.Id);
                        else if (_logicaDoOriginal.TryGetValue(t.Id, out var orig) && gc.ModelLogicMap.TryGetValue(orig.GetHashCode(), out var dele) && dele != null) { gc.ModelLogicMap[k] = dele; Log.Info("apetrecho «" + t.Id + "»: a lógica de " + orig); }
                    }
                    catch (Exception ex) { Log.Erro("lógica do apetrecho «" + t.Id + "»", ex); }
                }
            if (_apetrechos.Count == 0) return;
            DevolverAcoes();
            // (an attack whose end no window told: its effects come after a while)
            if (_ataque != null && _ataque.Pendentes != null && Time.unscaledTime - _ataque.Quando > 20f) Mostrar(FecharAtaque(), null);
            // o tempo passa: a rodada acabou
            int rodada = Jogo.Rodada;
            if (rodada >= 0)
            {
                if (_rodadaAntes >= 0 && rodada > _rodadaAntes)
                    foreach (var h in herois) { LimparBonus(h); Mostrar(Disparar("tempo", h, null), null); }
                _rodadaAntes = rodada;
            }
            // alvejado: um inimigo ativou contra o heroi
            foreach (var e in Jogo.Inimigos)
            {
                var g = e.GUID ?? ""; bool ativou = false;
                try { ativou = SerializedEnemy.GetBoolField(e, SerializedEnemy.BoolFields.HasActivated); } catch { }
                if (_ativouAntes.TryGetValue(g, out var antes) && ativou && !antes && e.Health > 0)
                {
                    int i = e.TargetPlayerIndex;
                    if (i >= 0 && i < herois.Count) Mostrar(Disparar("alvejado", herois[i], e), null);
                }
                _ativouAntes[g] = ativou;
            }
            // ferido: o heroi sofreu um ferimento
            foreach (var h in herois)
            {
                int s = (int)h.HealthState;
                if (_saudeAntes.TryGetValue(h.HeroId ?? "", out var antes) && s > antes && h.HealthState != HeroHealth.Defeated) Mostrar(Disparar("ferido", h, null), null);
                _saudeAntes[h.HeroId ?? ""] = s;
            }
        }

        static void Sair()
        {
            _naPartida = false;
            foreach (var h in Jogo.Herois) LimparBonus(h);
            _bonus.Clear(); _acoesExtras.Clear(); _ataque = null; _rodadaAntes = -1; _ativouAntes.Clear(); _saudeAntes.Clear();
        }

        static void LimparBonus(SerializedPlayer h)
        {
            if (h == null || !_bonus.TryGetValue(h.HeroId ?? "", out var b)) return;
            _bonus.Remove(h.HeroId ?? "");
            h.DamageBonus = Math.Max(0, h.DamageBonus - b);
        }

        // ------------------------------------------------------------ as janelas de logica
        static readonly (string janela, string quando)[] _janelas = { ("preemptive", "ataque"), ("posdano", "dano"), ("derrota", "derrota"), ("interacao", "interacao") };

        static ModelsGameLogic Logica(string id)
        {
            if (_logicas.TryGetValue(id, out var lg) && lg != null) return lg;
            var l = De(id);
            var go = new GameObject("@Bigorna-Apetrecho " + id);
            go.SetActive(false);
            UnityEngine.Object.DontDestroyOnLoad(go);
            lg = go.AddComponent<ModelsGameLogic>();
            lg.Models = new ModelBase[0];
            bool ataque = l.Any(d => d.Quando == "ataque" || d.Quando == "dano" || d.Quando == "derrota");
            DialogueTreeController Arvore(string janela)
            {
                var arv = LogicaPropria.NovaArvore(go, "DT " + janela, "Bigorna Apetrecho " + id + " " + janela, out var dtc, "EnemyGUID");
                try { arv.localBlackboard.AddVariable("PlayerIndex", typeof(int)); } catch { }
                var no = arv.AddNode<NoDeApetrecho>(); no.Apetrecho = id; no.Janela = janela; arv.primeNode = no;
                return dtc;
            }
            if (ataque) lg.DTPreemptive = Arvore("preemptive");
            if (l.Any(d => d.Quando == "dano" || d.Quando == "ataque")) lg.DTPostAttackPostDamageEnemyReaction = Arvore("posdano");
            if (l.Any(d => d.Quando == "dano" || d.Quando == "derrota" || d.Quando == "ataque")) lg.DTDefeated = Arvore("derrota");
            if (l.Any(d => d.Quando == "interacao")) lg.DTInteractionComplete = Arvore("interacao");
            go.SetActive(true);
            _logicas[id] = lg;
            Log.Info("apetrecho «" + id + "»: gatilhos " + string.Join(", ", l.Select(d => d.Quando + " " + d.Chance + "%").ToArray()));
            return lg;
        }

        /// <summary>O que uma janela de logica faz para o apetrecho; devolve o texto a mostrar (ou null).</summary>
        internal static string NaJanela(string apetrecho, string janela, SerializedPlayer heroi, SerializedEnemy e)
        {
            var t = new List<string>();
            switch (janela)
            {
                case "preemptive":
                    if (heroi == null || heroi.EquippedTrinketId != apetrecho) return null;
                    LimparBonus(heroi); Juntar(t, FecharAtaque());
                    // (the trigger "when the hero attacks" is drawn now: its damage goes into this attack; the rest of its effects,
                    // and its text, come when the attack is over, so nothing changes the roll)
                    _ataque = e != null ? new Ataque { Heroi = heroi.HeroId, Inimigo = e.GUID, VidaAntes = e.Health, Quando = Time.unscaledTime } : null;
                    { var saiu = Sortear("ataque", heroi); var feitos = new List<string>();
                      foreach (var d in saiu) foreach (var f in d.Efeitos.Where(f => f.Tipo == "damage")) { try { Aplicar(f, "ataque", heroi, e, feitos); } catch (Exception ex) { Log.Erro("efeito do apetrecho", ex); } }
                      if (_ataque != null) _ataque.Pendentes = saiu; else Juntar(t, Mostrar(saiu, "ataque", heroi, e, feitos)); }
                    break;
                case "posdano":
                    if (heroi == null || heroi.EquippedTrinketId != apetrecho) return null;
                    LimparBonus(heroi); Juntar(t, FecharAtaque());
                    if (DanoNovo(heroi, e)) Juntar(t, Disparar("dano", heroi, e));
                    break;
                case "derrota":
                    // (o jogo nem sempre diz quem derrotou: o ultimo a atacar este inimigo)
                    if (heroi == null && _ataque != null && e != null && _ataque.Inimigo == e.GUID && Time.unscaledTime - _ataque.Quando < 120f) heroi = Jogo.Herois.FirstOrDefault(h => h.HeroId == _ataque.Heroi);
                    if (heroi == null || heroi.EquippedTrinketId != apetrecho) return null;
                    LimparBonus(heroi); Juntar(t, FecharAtaque());
                    if (DanoNovo(heroi, e)) Juntar(t, Disparar("dano", heroi, e));
                    Juntar(t, Disparar("derrota", heroi, null));
                    break;
                case "interacao":
                    if (heroi == null || heroi.EquippedTrinketId != apetrecho) return null;
                    Juntar(t, Disparar("interacao", heroi, null));
                    break;
            }
            return t.Count > 0 ? string.Join("\n\n", t.ToArray()) : null;
        }

        static bool DanoNovo(SerializedPlayer heroi, SerializedEnemy e)
        {
            var a = _ataque;
            if (a == null || e == null || a.DanoContou || a.Heroi != heroi.HeroId || a.Inimigo != e.GUID) return false;
            int acertos = -1; try { var fh = typeof(HeroAttackAlgorithm).GetField("_hitCount", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static); if (fh != null) acertos = (int)fh.GetValue(null); } catch { }
            if (acertos == 0 || (acertos < 0 && e.Health >= a.VidaAntes)) return false;   // (no hit: the normal attack did not beat the armor)
            a.DanoContou = true; return true;
        }

        static void Juntar(List<string> l, string s) { if (!string.IsNullOrEmpty(s)) l.Add(s); }

        static void Mostrar(string texto, Action depois)
        {
            if (string.IsNullOrEmpty(texto)) { depois?.Invoke(); return; }
            Dialogos.Mensagem(texto, depois, T("Apetrecho", "Trinket"));
        }
        internal static void MostrarE(string texto, Action depois) => Mostrar(texto, depois);

        /// <summary>Os gatilhos do apetrecho do heroi com esta causa: cada um sorteia a chance; os que saem aplicam os efeitos.
        /// Devolve o texto para a tela (o apetrecho, o heroi, o que aconteceu), ou null.</summary>
        /// <summary>The triggers of the hero's trinket with this cause that come out (each draws its chance).</summary>
        static List<Disparo> Sortear(string quando, SerializedPlayer heroi)
        {
            var r = new List<Disparo>(); var tr = heroi?.EquippedTrinket; if (tr == null) return r;
            var l = De(tr.Id); if (l == null) return r;
            foreach (var d in l.Where(x => x.Quando == quando))
            {
                if (UnityEngine.Random.Range(0, 100) >= d.Chance) { Log.Info("  apetrecho «" + tr.Id + "» (" + quando + "): não saiu (" + d.Chance + "%)"); continue; }
                r.Add(d);
            }
            return r;
        }
        /// <summary>The end of the attack: the effects of "when the hero attacks" other than the damage, and the text.</summary>
        static string FecharAtaque()
        {
            var a = _ataque; if (a == null || a.Pendentes == null) return null;
            var l = a.Pendentes; a.Pendentes = null; if (l.Count == 0) return null;
            var heroi = Jogo.Herois.FirstOrDefault(h => h.HeroId == a.Heroi); SerializedEnemy e = null; try { e = GameEntity.GetEntity(a.Inimigo) as SerializedEnemy; } catch { }
            return Mostrar(l, "ataque", heroi, e, null, true);
        }
        static string Disparar(string quando, SerializedPlayer heroi, SerializedEnemy alvo) => Mostrar(Sortear(quando, heroi), quando, heroi, alvo, null);
        /// <summary>Applies the effects of the triggers that came out (all, or all but the damage already given) and makes the text.</summary>
        static string Mostrar(List<Disparo> saiu, string quando, SerializedPlayer heroi, SerializedEnemy alvo, List<string> feitosAntes, bool semDano = false)
        {
            var tr = heroi?.EquippedTrinket; if (tr == null || saiu == null || saiu.Count == 0) return null;
            var partes = new List<string>(); bool primeiro = true;
            foreach (var d in saiu)
            {
                var feitos = new List<string>(); if (primeiro && feitosAntes != null) feitos.AddRange(feitosAntes); primeiro = false;
                var mesa = new List<string>();
                foreach (var f in d.Efeitos)
                {
                    if (f.Tipo == "damage" && (semDano || feitosAntes != null)) { if (semDano) feitos.Add(TF("dano +{0} neste ataque", "damage +{0} on this attack", Mathf.Clamp(f.N, 1, 9))); continue; }
                    if (f.Tipo == "table") { if (!string.IsNullOrWhiteSpace(f.Texto)) mesa.Add(f.Texto.Trim()); continue; }
                    try { Aplicar(f, quando, heroi, alvo, feitos); } catch (Exception ex) { Log.Erro("efeito do apetrecho", ex); }
                }
                Log.Info("  apetrecho «" + tr.Id + "» (" + quando + ", " + d.Chance + "%): " + (feitos.Count > 0 ? string.Join(", ", feitos.ToArray()) : "só o texto"));
                var p = new List<string>();
                if (!string.IsNullOrWhiteSpace(d.Texto)) p.Add(d.Texto.Trim());
                p.AddRange(mesa);
                if (feitos.Count > 0) p.Add("<i>" + string.Join(" · ", feitos.ToArray()) + "</i>");
                if (p.Count > 0) partes.Add(string.Join("\n", p.ToArray()));
            }
            if (partes.Count == 0) return null;
            try { Jogo.UI?.EnemyMenu?.SyncTo(Jogo.Partida.Enemies); } catch { }
            string quem = null; try { quem = FFGLocalization.Get(heroi.Model.KeyName, false); } catch { }
            return "<b>" + Butim.NomeItem(tr.Id) + "</b>" + (string.IsNullOrEmpty(quem) ? "" : " (" + quem + ")") + "\n" + string.Join("\n\n", partes.ToArray());
        }

        static readonly Dictionary<string, EnemyConditions> _condicoes = new Dictionary<string, EnemyConditions>
        {
            { "dazed", EnemyConditions.Dazed }, { "enfeebled", EnemyConditions.Enfeebled }, { "afflicted", EnemyConditions.Afflicted }, { "slowed", EnemyConditions.Slowed },
            { "exposed", EnemyConditions.Exposed }, { "doomed", EnemyConditions.Doomed }, { "confused", EnemyConditions.Confused }
        };
        static string NomeDaCondicao(string k)
        {
            switch (k)
            {
                case "dazed": return T("Confuso", "Dazed");
                case "enfeebled": return T("Febril", "Enfeebled");
                case "afflicted": return T("Atormentado", "Afflicted");
                case "slowed": return T("Atrasado", "Slowed");
                case "exposed": return T("Exposto", "Exposed");
                case "doomed": return T("Condenado", "Doomed");
                case "confused": return T("Desorientado", "Confused");
                default: return k;
            }
        }

        /// <summary>Reforço: N monstros entram (o do gatilho, um do mesmo tipo, um da reserva do mapa ou o escolhido), junto do
        /// inimigo do gatilho; sem ele, junto de outro inimigo do tabuleiro, ou do começo dos heróis. A mesa põe a miniatura.</summary>
        static void Reforco(Efeito f, SerializedPlayer heroi, SerializedEnemy alvo, List<string> feitos)
        {
            int n = Mathf.Clamp(f.N, 1, 3); var modo = string.IsNullOrEmpty(f.Modo) ? (alvo != null ? "igual" : "reserva") : f.Modo;
            EnemyModel dele = null; if (alvo != null) { try { dele = UserCollectionManager.GetEnemy(alvo.ModelId, false); } catch { } }
            var cands = Inimigos.Reserva.Concat(Motor.Roteiro.Mapa?.Spawns?.Inimigos?.Select(x => x.Id) ?? Enumerable.Empty<string>()).Where(x => !string.IsNullOrEmpty(x)).Distinct().ToList();
            string id = null;
            if (modo == "igual" && alvo != null) id = alvo.ModelId;
            else if (modo == "tipo" && dele != null) { var l = cands.Where(x => { try { var m = UserCollectionManager.GetEnemy(x, false); return m != null && m.Type == dele.Type; } catch { return false; } }).ToList(); id = l.Count > 0 ? l[UnityEngine.Random.Range(0, l.Count)] : alvo.ModelId; }
            else if (modo == "outro" && !string.IsNullOrEmpty(f.Monstro)) id = f.Monstro;
            else if (cands.Count > 0) id = cands[UnityEngine.Random.Range(0, cands.Count)];
            EnemyModel novo = null; if (id != null) { try { novo = UserCollectionManager.GetEnemy(id, false); } catch { } }
            if (novo == null) { feitos.Add(T("reforço: nenhum monstro para entrar", "reinforcement: no monster to enter")); return; }
            (int, int)? casa = alvo != null ? Inimigos.CasaDe(alvo) : null; int tier = alvo != null ? alvo.Tier : 0;
            if (!casa.HasValue) foreach (var e in Jogo.Inimigos) if (e != null && e.Health > 0) { casa = Inimigos.CasaDe(e); if (tier <= 0) tier = e.Tier; if (casa.HasValue) break; }
            if (!casa.HasValue) { var h0 = Motor.Roteiro.Mapa?.Spawns?.InicioHerois?.FirstOrDefault(); if (h0 != null && h0.Length >= 2) casa = (h0[0], h0[1]); }
            int[] pos = null;
            if (casa.HasValue)
            {
                var (x0, y0) = casa.Value; int[][] perto = { new[] { 1, 0 }, new[] { -1, 0 }, new[] { 0, 1 }, new[] { 0, -1 }, new[] { 1, 1 }, new[] { -1, -1 }, new[] { 1, -1 }, new[] { -1, 1 } };
                foreach (var d in perto) if (!Tabuleiro.CasaSemChao(x0 + d[0], y0 + d[1])) { pos = new[] { x0 + d[0], y0 + d[1] }; break; }
                if (pos == null) pos = new[] { x0, y0 };
            }
            var lista = new List<Formato.Dmap.Inimigo>();
            for (int i = 0; i < n; i++) lista.Add(new Formato.Dmap.Inimigo { Id = id, Pos = pos, Tier = Mathf.Max(1, tier) });
            Inimigos.EntrarAgora(lista);
            feitos.Add(TF("reforço: {0} × {1} (ponha a miniatura na mesa)", "reinforcement: {0} × {1} (put the miniature on the table)", n, Inimigos.NomeDe(novo) ?? id));
        }

        /// <summary>Tira, de cada heroi com acoes adicionais, os icones de acao gasta da rodada (o ultimo primeiro).</summary>
        static void DevolverAcoes()
        {
            if (_acoesExtras.Count == 0) return;
            try
            {
                var dados = Jogo.DadosJogo?.Data; if (dados == null || dados.SavedActionIcons == null) return;
                var menu = Jogo.UI != null ? Jogo.UI.HeroMenu : null;
                foreach (var hid in _acoesExtras.Keys.ToList())
                {
                    int resta = _acoesExtras[hid];
                    while (resta > 0)
                    {
                        int i = dados.SavedActionIcons.FindLastIndex(a => a != null && a.HeroID == hid); if (i < 0) break;
                        var tipo = dados.SavedActionIcons[i].ActionType; dados.SavedActionIcons.RemoveAt(i); resta--;
                        if (menu != null && menu.MiniViews != null) foreach (var mv in menu.MiniViews) if (mv != null && mv.GetHeroId() == hid) { mv.RemoveActionIcon(tipo); break; }
                        Log.Info("ação adicional: " + hid + " recupera uma ação (" + tipo + ")");
                    }
                    if (resta > 0) _acoesExtras[hid] = resta; else _acoesExtras.Remove(hid);
                }
            }
            catch (Exception ex) { Log.Erro("ação adicional", ex); _acoesExtras.Clear(); }
        }

        static void Aplicar(Efeito f, string quando, SerializedPlayer heroi, SerializedEnemy alvo, List<string> feitos)
        {
            int n = Mathf.Clamp(f.N, 1, 999);
            string nome = alvo != null ? Inimigos.NomeDoInimigo(alvo) : null;
            switch (f.Tipo)
            {
                case "damage":
                    if (quando != "ataque" || heroi == null) return;
                    n = Mathf.Min(n, 9);
                    heroi.DamageBonus += n; _bonus[heroi.HeroId ?? ""] = (_bonus.TryGetValue(heroi.HeroId ?? "", out var b) ? b : 0) + n;
                    feitos.Add(TF("dano +{0} neste ataque", "damage +{0} on this attack", n)); return;
                case "condition":
                    if (alvo == null || alvo.Health <= 0) return;
                    if (f.Condicao == "random")
                    {
                        // (a condition at random: one the enemy has not and is not immune to)
                        var livres = _condicoes.Where(kv => !alvo.IsImmuneTo(kv.Value) && (alvo.CurrentConditions & kv.Value) == 0).ToList();
                        if (livres.Count == 0) { feitos.Add(TF("{0}: nenhuma condição a mais", "{0}: no further condition", nome)); return; }
                        var kv0 = livres[UnityEngine.Random.Range(0, livres.Count)]; alvo.CurrentConditions |= kv0.Value; feitos.Add(nome + ": " + NomeDaCondicao(kv0.Key)); return;
                    }
                    if (!_condicoes.TryGetValue(f.Condicao ?? "", out var c)) return;
                    if (alvo.IsImmuneTo(c)) { feitos.Add(TF("{0} é imune a {1}", "{0} is immune to {1}", nome, NomeDaCondicao(f.Condicao))); return; }
                    if ((alvo.CurrentConditions & c) == 0) alvo.CurrentConditions |= c;
                    feitos.Add(nome + ": " + NomeDaCondicao(f.Condicao)); return;
                case "defense":
                    {
                        if (alvo == null || alvo.Health <= 0) return;
                        int k = Mathf.Min(Mathf.Min(n, 9), Mathf.Max(0, alvo.Defense + alvo.TemporaryRoundDefense)); if (k <= 0) return;
                        alvo.TemporaryRoundDefense -= k;
                        feitos.Add(TF("{0}: defesa −{1} até o fim da rodada", "{0}: defense −{1} until the end of the round", nome, k)); return;
                    }
                case "speed":
                    {
                        if (alvo == null || alvo.Health <= 0) return;
                        n = Mathf.Min(n, 9); var d = alvo.ActivationDeltas; d.Speed -= n; alvo.ActivationDeltas = d;
                        feitos.Add(TF("{0}: movimento −{1} na próxima ativação", "{0}: movement −{1} on its next activation", nome, n)); return;
                    }
                case "spawn": Reforco(f, heroi, alvo, feitos); return;
                case "action":
                    { if (heroi == null) return; string quem = null; try { quem = FFGLocalization.Get(heroi.Model.KeyName, false); } catch { }
                      string hid = heroi.HeroId ?? ""; _acoesExtras[hid] = (_acoesExtras.TryGetValue(hid, out var x) ? x : 0) + Mathf.Min(n, 9); DevolverAcoes();
                      feitos.Add(TF("{0} ganha uma ação adicional", "{0} gains an additional action", quem ?? T("o herói", "the hero"))); return; }
                case "loot":
                    {
                        string origem = Butim.NomeItem(heroi?.EquippedTrinketId);
                        switch (f.Modo)
                        {
                            case "gold": Butim.Entregar(new Formato.Dmap.Butim { Modo = "random", Ouro = n }, origem); feitos.Add(TF("{0} de ouro", "{0} gold", n)); break;
                            case "material": Butim.DarMateriais(Mathf.Min(n, 20), origem); feitos.Add(TF("{0} material(is)", "{0} material(s)", Mathf.Min(n, 20))); break;
                            case "item": if (!string.IsNullOrEmpty(f.Item)) { Butim.DarItem(f.Item, Mathf.Min(n, 9), origem); feitos.Add(Mathf.Min(n, 9) + " × " + Butim.NomeItem(f.Item)); } break;
                            default: Butim.Entregar(new Formato.Dmap.Butim { Modo = "random", Quantos = Mathf.Min(n, 5) }, origem); feitos.Add(TF("{0} item(ns) aleatório(s)", "{0} random item(s)", Mathf.Min(n, 5))); break;
                        }
                        return;
                    }
            }
        }
    }

    /// <summary>No das janelas de logica de um apetrecho da Oficina: aplica os gatilhos dele e segue.</summary>
    public class NoDeApetrecho : DTNode
    {
        public string Apetrecho, Janela;

        protected override Status OnExecute(Component agent, IBlackboard bb)
        {
            string texto = null;
            try
            {
                SerializedEnemy e = null; SerializedPlayer heroi = null;
                try { var guid = bb?.GetValue<string>("EnemyGUID"); if (!string.IsNullOrEmpty(guid)) e = GameEntity.GetEntity(guid) as SerializedEnemy; } catch { }
                int i = -1; try { i = bb != null ? bb.GetValue<int>("PlayerIndex") : -1; } catch { }
                var herois = Jogo.Herois;
                if (i >= 0 && i < herois.Count) heroi = herois[i];
                if (heroi == null) try { heroi = ((IProcess)DLGTree.agent?.GetComponent<DialogueTreeController>())?.Context as SerializedPlayer; } catch { }
                if (heroi == null) try { heroi = ((IProcess)agent?.GetComponent<DialogueTreeController>())?.Context as SerializedPlayer; } catch { }
                texto = Apetrechos.NaJanela(Apetrecho, Janela, heroi, e);
            }
            catch (Exception ex) { Log.Erro("apetrecho «" + Apetrecho + "» (" + Janela + ")", ex); }
            if (string.IsNullOrEmpty(texto)) { DLGTree.Continue(); return Status.Success; }
            Apetrechos.MostrarE(texto, () => { status = Status.Success; DLGTree.Continue(); });
            return Status.Running;
        }
    }
}
