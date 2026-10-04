using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.RegularExpressions;
using FFG.Core;
using FFG.D3;
using I2.Loc;
using NodeCanvas.DialogueTrees;
using NodeCanvas.Framework;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// O jogo procura a "logica" de cada monstro (as arvores de ativacao, derrota, reacoes, taticas) pelo Id do modelo.
    /// Os monstros da Oficina tem Id proprio, entao ficavam sem logica: a ativacao nao terminava e a fase da escuridao
    /// emperrava. Aqui cada monstro proprio ganha uma logica emprestada do monstro base, com uma arvore de ativacao nossa
    /// na frente: as ativacoes do jogo seguem para a arvore original; as criadas na Oficina sao mostradas por nos.
    /// </summary>
    public static class LogicaPropria
    {
        /// <summary>Efeito automatico da defesa: o que o app aplica sozinho quando um heroi ataca o monstro.</summary>
        public class EfeitoDeDefesa { public string Tipo; public int N; }
        class Registro
        {
            public string Id; public EnemyModel Base; public HashSet<string> Novas = new HashSet<string>(StringComparer.Ordinal);
            /// <summary>"game": a regra do monstro de comportamento; "none": nenhuma; "custom": os efeitos abaixo.</summary>
            public string ModoDefesa = "game"; public List<EfeitoDeDefesa> Efeitos = new List<EfeitoDeDefesa>();
        }

        static readonly Dictionary<string, Registro> _monstros = new Dictionary<string, Registro>(StringComparer.Ordinal);
        static readonly Dictionary<string, float> _esperaDesde = new Dictionary<string, float>(StringComparer.Ordinal);
        static float _proxima;

        public static void Registrar(string id, EnemyModel basee, IEnumerable<string> ativacoesNovas)
        {
            if (string.IsNullOrEmpty(id) || basee == null) return;
            if (!_monstros.TryGetValue(id, out var r)) _monstros[id] = r = new Registro { Id = id };
            r.Base = basee;
            foreach (var a in ativacoesNovas ?? new string[0]) if (!string.IsNullOrEmpty(a)) r.Novas.Add(a);
        }

        public static void DefinirDefesa(string id, string modo, List<EfeitoDeDefesa> efeitos)
        {
            if (string.IsNullOrEmpty(id) || !_monstros.TryGetValue(id, out var r)) return;
            r.ModoDefesa = string.IsNullOrEmpty(modo) ? "game" : modo.ToLowerInvariant();
            r.Efeitos = efeitos ?? new List<EfeitoDeDefesa>();
        }

        internal static List<EfeitoDeDefesa> EfeitosDe(string id) => id != null && _monstros.TryGetValue(id, out var r) ? r.Efeitos : null;

        public static bool EhNova(string idMonstro, string ativacao) => idMonstro != null && ativacao != null && _monstros.TryGetValue(idMonstro, out var r) && r.Novas.Contains(ativacao);


        public static void Batimento()
        {
            if (_monstros.Count == 0 || !Jogo.EmEncontro || Time.unscaledTime < _proxima) return;
            _proxima = Time.unscaledTime + 0.2f;
            var gc = Jogo.Controle; if (gc == null || gc.ModelLogicMap == null) return;
            foreach (var r in _monstros.Values)
            {
                int h = r.Id.GetHashCode();
                if (gc.ModelLogicMap.TryGetValue(h, out var atual) && atual != null) continue;
                // so vale a pena quando o monstro esta na partida (a logica do tipo e carregada com ele)
                bool emJogo = false;
                foreach (var e in Jogo.Inimigos) if (e != null && e.ModelId == r.Id) { emJogo = true; break; }
                if (!emJogo) continue;
                gc.ModelLogicMap.TryGetValue(r.Base.Id.GetHashCode(), out var dele);
                if (dele == null)
                {
                    // espera a logica do tipo carregar; se nao vier em 3 s, segue so com a nossa arvore
                    if (!_esperaDesde.TryGetValue(r.Id, out var desde)) { _esperaDesde[r.Id] = Time.unscaledTime; continue; }
                    if (Time.unscaledTime - desde < 3f) continue;
                }
                _esperaDesde.Remove(r.Id);
                try { gc.ModelLogicMap[h] = Montar(r, dele); }
                catch (Exception ex) { Log.Erro("lógica do monstro «" + r.Id + "»", ex); gc.ModelLogicMap[h] = dele; }
            }
        }

        static ModelsGameLogic Montar(Registro r, ModelsGameLogic dele)
        {
            var go = new GameObject("@Bigorna-Logica " + r.Id);
            go.SetActive(false);
            var lg = go.AddComponent<ModelsGameLogic>();
            lg.Models = new ModelBase[0];
            if (dele != null)
            {
                lg.DTDefeated = dele.DTDefeated; lg.DTPreemptive = dele.DTPreemptive; lg.DTPostWeaponSelect = dele.DTPostWeaponSelect;
                lg.DTTacticSelection = dele.DTTacticSelection; lg.DTPostAttackPreDamageEnemyReaction = dele.DTPostAttackPreDamageEnemyReaction;
                lg.DTPostAttackPostDamageEnemyReaction = dele.DTPostAttackPostDamageEnemyReaction; lg.DTPostAttackWeaponTrigger = dele.DTPostAttackWeaponTrigger;
                lg.DTTimePasses = dele.DTTimePasses; lg.DTInteractionComplete = dele.DTInteractionComplete;
            }
            var arvA = NovaArvore(go, "DT Ativacoes", "Bigorna Ativacoes " + r.Id, out var dtc, "EnemyGUID", "ActivationId");
            var no = arvA.AddNode<NoDeAtivacao>();
            no.Original = dele != null ? dele.DTActivations : null;
            arvA.primeNode = no;
            lg.DTActivations = dtc;
            // a defesa: a regra do jogo (monstro de comportamento), nenhuma, ou os efeitos escolhidos na Oficina
            if (r.ModoDefesa == "none") lg.DTPreemptive = null;
            else if (r.ModoDefesa == "custom")
            {
                var arvD = NovaArvore(go, "DT Defesa", "Bigorna Defesa " + r.Id, out var dtd, "EnemyGUID");
                arvD.primeNode = arvD.AddNode<NoDeDefesa>();
                lg.DTPreemptive = dtd;
            }
            go.SetActive(true);
            Log.Info("lógica do monstro «" + r.Id + "»: " + (dele != null ? "a de " + r.Base.Id + " (ativações da Oficina mostradas pelo Bigorna)" : "só a nossa (a do " + r.Base.Id + " não carregou)")
                + "; defesa " + (r.ModoDefesa == "custom" ? "própria: " + string.Join(", ", r.Efeitos.Select(e => e.Tipo + " +" + e.N).ToArray()) : r.ModoDefesa == "none" ? "sem efeito automático" : "do jogo"));
            return lg;
        }

        /// <summary>Uma arvore de dialogo nossa, presa a um filho de "pai" (usada como esta, sem clonar pela serializacao).</summary>
        static DialogueTree NovaArvore(GameObject pai, string nomeGo, string nomeArvore, out DialogueTreeController dtc, params string[] variaveis)
        {
            var filho = new GameObject(nomeGo);
            filho.transform.SetParent(pai.transform, false);
            dtc = filho.AddComponent<DialogueTreeController>();
            dtc.enableAction = GraphOwner.EnableAction.DoNothing;
            dtc.disableAction = GraphOwner.DisableAction.DisableBehaviour;
            var fb = typeof(GraphOwner).GetField("boundGraphSerialization", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            fb?.SetValue(dtc, "{}");
            var fr = typeof(GraphOwner).GetField("boundGraphObjectReferences", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            fr?.SetValue(dtc, new List<UnityEngine.Object>());
            var fi = typeof(DialogueTreeController).GetField("_ignoreSaveLoad", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            fi?.SetValue(dtc, true);
            var arvore = ScriptableObject.CreateInstance<DialogueTree>();
            arvore.name = nomeArvore;
            foreach (var v in variaveis) { try { arvore.localBlackboard.AddVariable(v, typeof(string)); } catch (Exception ex) { Log.Info("  variável «" + v + "» da árvore própria: " + ex.Message); } }
            dtc.graph = arvore;
            return arvore;
        }

        /// <summary>Texto de uma ativacao para a tela, com as vagas {n} preenchidas.</summary>
        internal static string TextoDaAtivacao(SerializedEnemy e)
        {
            string aid = e.ActivationId ?? "";
            string texto = null;
            foreach (var k in new[] { aid + "_ACTIVATION", aid })
            {
                try { if (LocalizationManager.GetTermData(k) != null) { texto = LocalizationManager.GetTranslation(k); if (!string.IsNullOrEmpty(texto)) break; } } catch { }
            }
            if (string.IsNullOrEmpty(texto)) return null;
            string monstro = null, heroi = null;
            try { monstro = FFGLocalization.Get(e.Model.KeyNameSingular, false); } catch { }
            try
            {
                var herois = Jogo.Partida?.ActivePlayers;
                if (herois != null && e.TargetPlayerIndex >= 0 && e.TargetPlayerIndex < herois.Count)
                    heroi = !string.IsNullOrEmpty(e.TempTargetOverride) ? e.TempTargetOverride : FFGLocalization.Get(herois[e.TargetPlayerIndex].Model.KeyName, false);
            }
            catch { }
            var limpo = Regex.Replace(texto, "<[^>]+>", "");
            return Regex.Replace(texto, @"\{(\d)\}", m =>
            {
                var n = m.Groups[1].Value;
                string N(string s) => s.Replace("N", "\\{" + n + "\\}");
                if (Regex.IsMatch(limpo, N(@"\bthe N"), RegexOptions.IgnoreCase)) return monstro ?? "enemy";
                if (Regex.IsMatch(limpo, N(@"N\s+(spaces?|damage|health|cards?|times)\b"), RegexOptions.IgnoreCase)
                    || Regex.IsMatch(limpo, N(@"(tests? \w+|suffers?|recovers?|terrif\w+|scars?|places?)\s+N\b"), RegexOptions.IgnoreCase)) return "1";
                return heroi ?? "the hero";
            });
        }

    }

    /// <summary>Defesa propria: quando um heroi ataca o monstro, aplica os efeitos escolhidos na Oficina e segue o ataque.</summary>
    public class NoDeDefesa : DTNode
    {
        protected override Status OnExecute(Component agent, IBlackboard bb)
        {
            try
            {
                SerializedEnemy e = null;
                var guid = bb?.GetValue<string>("EnemyGUID"); if (!string.IsNullOrEmpty(guid)) e = GameEntity.GetEntity(guid) as SerializedEnemy;
                var efeitos = e != null ? LogicaPropria.EfeitosDe(e.ModelId) : null;
                if (e != null && efeitos != null)
                {
                    var feitos = new List<string>();
                    foreach (var f in efeitos)
                    {
                        int n = Mathf.Clamp(f.N, -9, 9); if (n == 0) continue;
                        switch ((f.Tipo ?? "").ToLowerInvariant())
                        {
                            case "damage": e.BaseAttack += n; feitos.Add("dano +" + n); break;
                            case "nextdamage": { var d = e.ActivationDeltas; d.Damage += n; e.ActivationDeltas = d; feitos.Add("dano +" + n + " na próxima ativação"); break; }
                            case "defense": e.Defense += n; feitos.Add("defesa +" + n); break;
                            case "rounddefense": e.TemporaryRoundDefense += n; feitos.Add("defesa +" + n + " até o fim da rodada"); break;
                            case "heal": e.Health = Mathf.Min(e.StartingHealth, e.Health + n); feitos.Add("recupera " + n); break;
                        }
                    }
                    try { Jogo.UI?.EnemyMenu?.SyncTo(Jogo.Partida.Enemies); } catch { }
                    Log.Info("  defesa própria de " + e.ModelId + ": " + string.Join(", ", feitos.ToArray()));
                }
            }
            catch (Exception ex) { Log.Erro("defesa própria", ex); }
            DLGTree.Continue();
            return Status.Success;
        }
    }

    /// <summary>
    /// No unico da arvore de ativacao dos monstros proprios: ativacao do jogo segue para a arvore original do monstro base;
    /// ativacao criada na Oficina abre a janela de ativacao com o texto dela.
    /// </summary>
    public class NoDeAtivacao : DTNode
    {
        public DialogueTreeController Original;

        protected override void OnBeforeExecute()
        {
            try { SingletonBehaviour<UndoController>.Instance.CaptureSnapshot(); } catch { }
        }

        protected override Status OnExecute(Component agent, IBlackboard bb)
        {
            SerializedEnemy e = null;
            try { var guid = bb?.GetValue<string>("EnemyGUID"); if (!string.IsNullOrEmpty(guid)) e = GameEntity.GetEntity(guid) as SerializedEnemy; } catch { }
            if (e == null) try { e = ((IProcess)DLGTree.agent?.GetComponent<DialogueTreeController>())?.Context as SerializedEnemy; } catch { }
            if (e == null || e.Health <= 0) { DLGTree.Continue(); return Status.Success; }
            bool nova = LogicaPropria.EhNova(e.ModelId, e.ActivationId);
            if (!nova && Original != null)
            {
                try
                {
                    Original.blackboard.SetValue("EnemyGUID", e.GUID);
                    Original.blackboard.SetValue("ActivationId", e.ActivationId);
                    ((IProcess)Original).Context = e;
                    Jogo.Persistente.ProcessStack.Schedule(Original, Original);
                    return Status.Running;
                }
                catch (Exception ex) { Log.Erro("ativação pela árvore do monstro base", ex); }
            }
            string texto = LogicaPropria.TextoDaAtivacao(e);
            const string chave = "BIGORNA_ATIVACAO_NA_TELA";
            Jogo.Termo(chave, texto ?? "");
            var pedido = new EnemyActivationRequest
            {
                Enemy = e,
                Message = string.IsNullOrEmpty(texto) ? null : new MessageRequest(chave, null),
                CallbackContinue = () =>
                {
                    try { SingletonBehaviour<UndoController>.Instance.RecordUndo(); } catch { }
                    status = Status.Success; DLGTree.Continue();
                },
                CallbackUndo = () => { status = Status.Resting; try { SingletonBehaviour<UndoController>.Instance.PerformUndo(); } catch { } }
            };
            Jogo.UI.ShowEnemyActivation(pedido, new EnemyActivationSettings { HideTarget = false });
            return Status.Running;
        }
    }
}
