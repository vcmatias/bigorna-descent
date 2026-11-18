using System;
using FFG.Core;
using FFG.D3;
using FFG.D3.UI;
using UnityEngine;

namespace Bigorna.Menu
{
    /// <summary>
    /// v372: o nível do jogo (Journey, Standard, Heroic, Warfare) pedido no quadro de dificuldade do próprio jogo ao começar um
    /// mapa do editor, um mapa oneshot ou uma campanha da comunidade. Os mapas não trazem nível: ele entra por cima, no mod, com as
    /// regras do jogo (vida dos inimigos, dano que cresce, resistência a mais e as marcações «(H/W)» do editor). No oneshot, a
    /// Fácil / Normal / Difícil da janela segue moldando só o mapa gerado.
    ///
    /// O quadro é o do jogo (UIQuestDifficultySelect), aberto sem partida preparada: a confirmação não carrega a introdução da
    /// campanha oficial nem muda a partida em memória (o GameData.Data fica vazio enquanto ele está aberto e volta depois); o
    /// nível escolhido é lido do painel marcado. Fechado sem confirmar (Voltar), a tela do mod volta.
    /// </summary>
    public static class NivelDoJogo
    {
        static Action<DifficultySetting> _seguir; static Action _voltar;
        static bool _aberto, _confirmou, _marcou; static float _desde; static DifficultySetting _inicial, _escolhido;
        static SerializedGame _guardado;

        static UIQuestDifficultySelect Quadro() { try { return SingletonBehaviour<UIGame>.Instance?.DifficultySelectDialog; } catch { return null; } }
        static UIQuestDifficultyPanel Marcado(UIQuestDifficultySelect d) => Reflexao.Ler(d, "_curSelectedPanel") as UIQuestDifficultyPanel;

        /// <summary>Abre o quadro com o nível inicial marcado. Devolve false quando o quadro do jogo não existe (o chamador segue
        /// com o nível inicial).</summary>
        public static bool Perguntar(DifficultySetting inicial, Action<DifficultySetting> seguir, Action voltar)
        {
            var d = Quadro();
            if (d == null || _aberto) return false;
            try
            {
                var gd = SingletonBehaviour<GameData>.Instance;
                _guardado = gd != null ? gd.Data : null;
                if (_guardado != null) Reflexao.Por(gd, "_data", null);
                Reflexao.Por(d, "_gameData", null); Reflexao.Por(d, "_loadIntroSequence", false);
                _seguir = seguir; _voltar = voltar; _inicial = inicial; _aberto = true; _confirmou = false; _marcou = false; _desde = Time.unscaledTime;
                try { SingletonBehaviour<PersistentGameObject>.Instance.Audio.PostEvent("UI_Click"); } catch { }
                d.Show(tween: true, blur: true);
                d.SyncTo(false, () => { var p = Marcado(d); _escolhido = p != null ? p.Difficulty : _inicial; _confirmou = true; });
                d.HighlightCurrentDifficulty(inicial);
                Log.Info("nível do jogo: o quadro de dificuldade aberto (começa em " + inicial + ")");
                return true;
            }
            catch (Exception ex) { Log.Erro("abrindo o quadro de dificuldade", ex); Fim(); return false; }
        }

        static void Fim()
        {
            _aberto = false;
            try { if (_guardado != null) { var gd = SingletonBehaviour<GameData>.Instance; if (gd != null && gd.Data == null) Reflexao.Por(gd, "_data", _guardado); } } catch { }
            _guardado = null;
        }

        /// <summary>A cada quadro: o nível inicial fica marcado e pode ser confirmado como está; confirmado, a partida começa;
        /// fechado sem confirmar, a tela do mod volta.</summary>
        public static void Batimento()
        {
            if (!_aberto) return;
            var d = Quadro();
            try
            {
                if (_confirmou)
                {
                    var nivel = _escolhido; var seguir = _seguir; Fim();
                    Log.Info("nível do jogo escolhido: " + nivel);
                    seguir?.Invoke(nivel);
                    return;
                }
                if (d == null) { var voltar0 = _voltar; Fim(); voltar0?.Invoke(); return; }
                if (d.IsVisible && !d.IsTweening)
                {
                    // (o quadro limpa a marca ao abrir: o nível inicial é marcado de novo, e o Confirmar vale para ele também)
                    if (Marcado(d) == null && !_marcou) { d.HighlightCurrentDifficulty(_inicial); _marcou = true; }
                    if (Marcado(d) != null && d.ButtonConfirm != null && !d.ButtonConfirm.interactable) d.ButtonConfirm.interactable = true;
                }
                if (Time.unscaledTime - _desde < 1f || d.IsVisible || d.IsTweening) return;
                var voltar = _voltar; Fim();
                Log.Info("nível do jogo: o quadro fechou sem confirmar; de volta à tela do mod");
                voltar?.Invoke();
            }
            catch (Exception ex) { Log.Erro("quadro de dificuldade", ex); var voltar = _voltar; Fim(); voltar?.Invoke(); }
        }

        /// <summary>O nível da partida gravada de onde vem a equipe (Standard sem ela, ou se não der para ler).</summary>
        public static DifficultySetting DoSave(Encontro.GrupoDoSave.Save s)
        {
            if (s == null) return DifficultySetting.Standard;
            try { var g = Encontro.GrupoDoSave.JogoDoSave(s.Slot); if (g != null) return g.GameDifficulty; } catch { }
            return DifficultySetting.Standard;
        }
    }
}
