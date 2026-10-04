using System;
using System.Collections.Generic;
using System.Reflection;
using FFG.Core;
using FFG.D3;
using FFG.D3.UI;
using NodeCanvas.DialogueTrees;
using TMPro;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// A missao oficial que serve de cena base tem roteiro proprio (arvores NodeCanvas). Aqui ele e calado:
    /// as arvores sao paradas e desligadas do encontro, e os quadros que ela abrir sao retirados.
    /// </summary>
    public static class Silencio
    {
        static readonly string[] CamposDeArvore =
        {
            "_endOfRoundTreeOverride", "_endOfQuestTreeOverride", "_heroAttackTreeOverride", "_enemyAttackLoopOverride",
            "_enemyAttackSelectionTreeOverride", "_enemyConfusionSelectionTreeOverride", "_timersTreeOverride",
            "_manualDefeatEnemyOverride", "_manualDefeatHeroOverride", "_afterSetupOverride", "_tacticsSelectionOverride"
        };

        /// <summary>Chaves que o jogo precisa mostrar mesmo na cena emprestada (fim de partida, heroi caido).</summary>
        static readonly string[] Intocaveis = { "END_ENCOUNTER", "END_OF_QUEST", "QUEST_WON", "QUEST_LOST", "UI_DEFEAT_HERO", "UI_WOUND_HERO", "HERO_DEFEATED_MESSAGE", "HERO_DEFATED_FLIP", "REMEMBRANCE_HILT_REVIVE" };

        public static bool Calado { get; private set; }
        /// <summary>O tabuleiro e nosso: quadros da missao emprestada passam a ser retirados.</summary>
        public static bool Vigiando { get; set; }
        static float _proximaVigilia;
        static string _ultimoAlheio;
        static int _vezesAlheio;

        public static void Reiniciar()
        {
            Calado = false;
            Vigiando = false;
            _ultimoAlheio = null;
            _vezesAlheio = 0;
        }

        public static int Calar()
        {
            var enc = Jogo.Encontro;
            if (enc == null) return 0;
            int n = 0;
            if (enc.SetupTree != null) { Parar(enc.SetupTree, "SetupTree"); enc.SetupTree = null; n++; }
            if (enc.EndEncounterTree != null) { Parar(enc.EndEncounterTree, "EndEncounterTree"); enc.EndEncounterTree = null; n++; }
            var tipo = enc.GetType();
            foreach (var nome in CamposDeArvore)
            {
                var campo = tipo.GetField(nome, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (campo == null) continue;
                if (campo.GetValue(enc) is DialogueTreeController arvore)
                {
                    Parar(arvore, nome);
                    campo.SetValue(enc, null);
                    Log.Info("  · " + nome + " «" + (arvore != null ? arvore.name : "?") + "» trocada pela padrão");
                    n++;
                }
            }
            n += CalarTempos();
            FecharQuadros();
            Calado = true;
            if (n > 0) Log.Info("roteiro da cena base calado: " + n + " árvore(s) desligadas");
            return n;
        }

        /// <summary>Arvores de "janela de tempo" que todo encontro tem (cronometros, fogo, taticas, pos-preparo); as demais
        /// sao da missao emprestada (sino, santuario, finais proprios) e deixam a fase da escuridao lenta e fora de ordem.</summary>
        static readonly HashSet<string> TemposPadrao = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { "DT Universal Timers", "DT Fire End of Round", "DT Tactic Selection", "DT Default After Setup" };

        static FieldInfo _campoTempos;

        /// <summary>Tira do gerenciador de janelas de tempo as arvores proprias da missao emprestada.</summary>
        public static int CalarTempos()
        {
            int n = 0;
            try
            {
                var ger = Jogo.Persistente?.DtcTimingManager;
                if (ger == null) return 0;
                if (_campoTempos == null) _campoTempos = ger.GetType().GetField("_allRegisteredDTCs", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);
                if (!(_campoTempos?.GetValue(ger) is Dictionary<DialogueTreeControllerTimingWindows, List<DialogueTreeControllerTiming>> todas)) return 0;
                foreach (var par in todas)
                {
                    for (int i = par.Value.Count - 1; i >= 0; i--)
                    {
                        var t = par.Value[i];
                        if (t == null) { par.Value.RemoveAt(i); continue; }
                        var nome = (t.name ?? "").Trim();
                        if (TemposPadrao.Contains(nome)) continue;
                        par.Value.RemoveAt(i);
                        var dtc = t.GetComponent<DialogueTreeController>();
                        if (dtc != null) Parar(dtc, nome);
                        Log.Info("  · desligada da janela " + par.Key + ": «" + nome + "» (da missão emprestada)");
                        n++;
                    }
                }
            }
            catch (Exception ex) { Log.Info("não calei as janelas de tempo: " + ex.Message); }
            return n;
        }

        static void Parar(DialogueTreeController arvore, string nome)
        {
            try
            {
                if (arvore != null && arvore.isRunning)
                {
                    arvore.StopBehaviour();
                    Log.Info("  · parada «" + nome + "», que já corria");
                }
            }
            catch (Exception ex) { Log.Info("  · não parei «" + nome + "»: " + ex.Message); }
        }

        public static void FecharQuadros()
        {
            try
            {
                var p = Jogo.Persistente;
                if (p == null) return;
                if (p.Messages != null && p.Messages.IsShowingMessage) p.Messages.Reset();
                if (p.StoryMessages != null && p.StoryMessages.IsShowingMessage) p.StoryMessages.Reset();
            }
            catch (Exception ex) { Log.Info("não fechei o quadro: " + ex.Message); }
        }

        /// <summary>Poe o jogo na fase do heroi (o encontro passa a ser nosso).</summary>
        public static void FaseDoHeroi()
        {
            try
            {
                var ui = Jogo.UI;
                var partida = Jogo.Partida;
                if (ui == null || partida == null) return;
                if (partida.CurrentGamePhase != GamePhase.Hero)
                {
                    ui.SetGamePhase(GamePhase.Hero, true, true);
                    Log.Info("fase do herói: o encontro é nosso");
                }
            }
            catch (Exception ex) { Log.Info("não pus a fase do herói: " + ex.Message); }
        }

        /// <summary>Batimento: retira quadros da missao emprestada e recoloca o silencio se o jogo o desfez.</summary>
        public static void Batimento()
        {
            if (!Jogo.EmEncontro || (!Calado && !Vigiando)) return;
            try { RetirarQuadroAlheio(); } catch (Exception ex) { Log.Info("olhando os quadros: " + ex.Message); }
            if (!Calado || Time.unscaledTime < _proximaVigilia) return;
            _proximaVigilia = Time.unscaledTime + 1f;
            try
            {
                var enc = Jogo.Encontro;
                if (enc != null && (enc.SetupTree != null || enc.EndEncounterTree != null))
                {
                    Log.Info("o encontro ganhou roteiro de novo; calando outra vez");
                    Calar();
                }
                CalarTempos();
                var partida = Jogo.Partida;
                if (partida != null && partida.CurrentGamePhase == GamePhase.Setup) FaseDoHeroi();
            }
            catch (Exception ex) { Log.Info("vigiando o roteiro base: " + ex.Message); }
        }

        static void RetirarQuadroAlheio()
        {
            var ui = Jogo.UI;
            if (ui == null) return;
            Component quadro = null;
            bool narrativo = false;
            if (ui.MessageDialog != null && ui.MessageDialog.IsVisible) quadro = ui.MessageDialog;
            else if (ui.StoryMessageDialog != null && ui.StoryMessageDialog.IsVisible) { quadro = ui.StoryMessageDialog; narrativo = true; }
            if (quadro == null) return;
            if (Dialogos.Ocupado) return; // o quadro e nosso
            var texto = TextoDoQuadro(quadro);
            if (string.IsNullOrEmpty(texto)) return;
            // o quadro de fim do jogo (na cena emprestada a chave vem crua, "END_ENCOUNTER"): fica, com o texto em palavras
            if (EhChaveCrua(texto) && Intocavel(texto)) { EmPalavras(quadro, texto); return; }
            if (!EhChaveCrua(texto)) return;
            if (texto == _ultimoAlheio && ++_vezesAlheio > 3)
            {
                if (_vezesAlheio == 4) Log.Info("«" + texto + "» insiste; deixo passar, o jogo precisa dele");
                return;
            }
            if (texto != _ultimoAlheio) { _ultimoAlheio = texto; _vezesAlheio = 1; }
            Log.Info("quadro da missão emprestada: «" + texto + "»; retirado");
            var p = Jogo.Persistente;
            if (narrativo) p?.StoryMessages?.Reset(); else p?.Messages?.Reset();
            try { (quadro as FFG.Core.UI.UIDialogAlpha)?.SetVisibility(false, false); } catch { }
        }

        // os campos de texto de cada tipo de quadro, procurados uma vez (isto corre a cada quadro enquanto um quadro alheio esta aberto)
        static readonly Dictionary<Type, FieldInfo[]> _camposDeTexto = new Dictionary<Type, FieldInfo[]>();

        static string TextoDoQuadro(Component quadro)
        {
            var tipo = quadro.GetType();
            if (!_camposDeTexto.TryGetValue(tipo, out var campos))
            {
                var lista = new List<FieldInfo>();
                foreach (var nome in new[] { "TextMessage", "TextTitle", "LabelMessage" })
                {
                    var f = tipo.GetField(nome, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                    if (f != null) lista.Add(f);
                }
                _camposDeTexto[tipo] = campos = lista.ToArray();
            }
            foreach (var f in campos)
                if (f.GetValue(quadro) is TMP_Text t && !string.IsNullOrWhiteSpace(t.text)) return t.text;
            foreach (var t in quadro.GetComponentsInChildren<TMP_Text>(true))
                if (!string.IsNullOrWhiteSpace(t.text)) return t.text;
            return null;
        }

        static readonly Dictionary<string, string> _palavras = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        static void EmPalavras(Component quadro, string chave)
        {
            chave = chave.Trim();
            bool? r = Motor.Roteiro.Resultado;
            string novo = null;
            if (chave.Equals("END_ENCOUNTER", StringComparison.OrdinalIgnoreCase) || chave.Equals("END_OF_QUEST", StringComparison.OrdinalIgnoreCase))
                novo = r == false ? Idioma.T("Derrota. Os heróis recuam, feridos, e o mapa se perde.", "Defeat. The heroes fall back, wounded, and the map is lost.") : Idioma.T("Vitória! O mapa está concluído.", "Victory! The map is complete.");
            else if (chave.Equals("QUEST_WON", StringComparison.OrdinalIgnoreCase)) novo = Idioma.T("Vitória! O mapa está concluído.", "Victory! The map is complete.");
            else if (chave.Equals("QUEST_LOST", StringComparison.OrdinalIgnoreCase)) novo = Idioma.T("Derrota. Os heróis recuam, feridos, e o mapa se perde.", "Defeat. The heroes fall back, wounded, and the map is lost.");
            if (novo == null) return;
            foreach (var t in quadro.GetComponentsInChildren<TMP_Text>(true))
                if (t != null && string.Equals((t.text ?? "").Trim(), chave, StringComparison.OrdinalIgnoreCase)) { t.text = novo; if (!_palavras.ContainsKey(chave)) { _palavras[chave] = novo; Log.Info("quadro de fim «" + chave + "» em palavras"); } }
        }

        static bool Intocavel(string t)
        {
            foreach (var i in Intocaveis) if (t.IndexOf(i, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            return false;
        }

        /// <summary>UMA_CHAVE_ASSIM: so maiusculas, digitos e sublinhado, com pelo menos um sublinhado.</summary>
        public static bool EhChaveCrua(string t)
        {
            t = (t ?? "").Trim();
            if (t.Length < 4 || t.Length > 60) return false;
            foreach (var c in t) if (!char.IsUpper(c) && !char.IsDigit(c) && c != '_') return false;
            return t.IndexOf('_') > 0;
        }

        /// <summary>Tira da partida os inimigos que a missao base trouxe (os nossos ficam).</summary>
        public static int ApartarInimigosDaBase(HashSet<string> nossos)
        {
            try
            {
                var partida = Jogo.Partida;
                if (partida?.Enemies == null) return 0;
                var fora = new List<SerializedEnemy>();
                foreach (var e in partida.Enemies) if (e != null && !nossos.Contains(e.GUID)) fora.Add(e);
                foreach (var e in fora) partida.Enemies.Remove(e);
                if (fora.Count > 0) Log.Info("apartados " + fora.Count + " inimigo(s) da missão base");
                return fora.Count;
            }
            catch (Exception ex) { Log.Info("não apartei os inimigos da base: " + ex.Message); return 0; }
        }
    }
}
