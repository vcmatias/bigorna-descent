using System;
using System.Collections.Generic;
using System.Linq;
using FFG.Core;
using FFG.D3;
using FFG.D3.UI;
using I2.Loc;
using UnityEngine;

namespace Bigorna
{
    /// <summary>Acesso seguro aos singletons do jogo. Tudo pode ser nulo fora de um encontro.</summary>
    public static class Jogo
    {
        public static GameController Controle => SingletonBehaviour<GameController>.IsInitialized ? SingletonBehaviour<GameController>.Instance : null;
        public static GameSceneController Cena => SingletonBehaviour<GameSceneController>.IsInitialized ? SingletonBehaviour<GameSceneController>.Instance : null;
        public static GameData DadosJogo => SingletonBehaviour<GameData>.IsInitialized ? SingletonBehaviour<GameData>.Instance : null;
        public static SerializedGame Partida => DadosJogo?.Data;
        public static UIGame UI => SingletonBehaviour<UIGame>.IsInitialized ? SingletonBehaviour<UIGame>.Instance : null;
        public static PersistentGameObject Persistente => SingletonBehaviour<PersistentGameObject>.IsInitialized ? SingletonBehaviour<PersistentGameObject>.Instance : null;
        public static LevelLoader Carregador => SingletonBehaviour<LevelLoader>.IsInitialized ? SingletonBehaviour<LevelLoader>.Instance : null;
        public static GameEncounter Encontro => Controle?.CurrentEncounter;

        public static Scene? CenaAtual()
        {
            try { return Carregador?.CurrentScene; }
            catch { return null; }
        }

        public static bool EmEncontro => CenaAtual() == Scene.Game;

        /// <summary>Um texto da interface do jogo, no idioma dele (a chave), ou a reserva quando falta.</summary>
        public static string Texto(string chave, string reserva)
        {
            try { var t = FFGLocalization.Get(chave, false); if (!string.IsNullOrEmpty(t) && t != chave) return t; } catch { }
            return reserva;
        }

        /// <summary>Registra um termo de localizacao (o mesmo texto em todas as linguas do jogo) e devolve a chave.</summary>
        public static string Termo(string chave, string texto)
        {
            try
            {
                var fonte = LocalizationManager.Sources.FirstOrDefault(); if (fonte == null) return chave;
                var t = fonte.AddTerm(chave, eTermType.Text, false);
                for (int i = 0; i < t.Languages.Length; i++) t.Languages[i] = texto ?? "";
            }
            catch (Exception ex) { Log.Info("termo «" + chave + "»: " + ex.Message); }
            return chave;
        }

        /// <summary>Uma tela do jogo por cima do mapa (a ficha de um monstro, o inventario, o registro, os ajustes…), fora os quadros
        /// de mensagem e de historia (os nossos avisos usam esses).</summary>
        public static bool OutraTela
        {
            get
            {
                try
                {
                    var ui = UI; if (ui == null) return false;
                    return ui.Glossary.IsVisible || ui.QuestSummaryDialog.IsVisible || ui.HeroDialog.IsVisible || ui.FeatsDialog.IsVisible || ui.HeroAttackDialog.IsVisible
                        || ui.InventoryDialog.IsVisible || ui.QuestLog.IsVisible || ui.CampaignLog.IsVisible || ui.EnemyInfoDialog.IsVisible || ui.HeroWeaponSelectDialog.IsVisible
                        || ui.EnemyActivationDialog.IsVisible || ui.SettingsDialog.IsVisible || (ui.HeroMenu != null && ui.HeroMenu.DialogHeroView != null && ui.HeroMenu.DialogHeroView.IsVisible);
                }
                catch { return false; }
            }
        }

        /// <summary>O jogo esta gravando a partida. A gravacao percorre as entidades da cena um quadro por vez; criar ou tirar
        /// entidades nesse meio (inimigos entrando, pecas saindo) derruba a gravacao e trava a tela. Enquanto vale, o mod espera.</summary>
        public static bool Salvando
        {
            get { try { return SingletonBehaviour<SaveLoadController>.IsInitialized && SingletonBehaviour<SaveLoadController>.Instance.IsSaving; } catch { return false; } }
        }

        /// <summary>O encontro esta de pe: controlador, cena e encounter carregados.</summary>
        public static bool EncontroPronto => Controle != null && Cena != null && Controle.CurrentEncounter != null;

        public static bool GradePronta
        {
            get { try { return Cena != null && Cena.AllGameGridCoords != null && Cena.AllGameGridCoords.Count > 0; } catch { return false; } }
        }

        public static bool MostrandoMensagem
        {
            get
            {
                try
                {
                    var p = Persistente;
                    return p != null && ((p.Messages != null && p.Messages.IsShowingMessage) || (p.StoryMessages != null && p.StoryMessages.IsShowingMessage));
                }
                catch { return false; }
            }
        }

        public static List<SerializedPlayer> Herois
        {
            get
            {
                var lista = new List<SerializedPlayer>();
                var ap = Partida?.ActivePlayers;
                if (ap == null) return lista;
                foreach (var h in ap) if (h != null) lista.Add(h);
                return lista;
            }
        }

        public static List<SerializedEnemy> Inimigos
        {
            get
            {
                var lista = new List<SerializedEnemy>();
                var en = Partida?.Enemies;
                if (en == null) return lista;
                foreach (var e in en) if (e != null) lista.Add(e);
                return lista;
            }
        }

        public static int Rodada
        {
            get { try { return Controle?.RoundCount ?? -1; } catch { return -1; } }
        }

        /// <summary>Casa do mapa (x, y do editor) para posicao no mundo do jogo (x, 0, -y).</summary>
        public static Vector3 Mundo(int x, int y, float altura = 0f) => new Vector3(x, altura, -y);
        /// <summary>Altura de cada nivel do tabuleiro: as pecas elevadas das missoes oficiais ficam em y = 1,1.</summary>
        public const float AlturaDoNivel = 1.1f;
        /// <summary>Altura de um nivel: 1 e 2 sobre pilar curto (1,35) e medio (2,25); 3 sobre o pilar alto do Ato II (4,25), que e mais alto que tres degraus.</summary>
        public static float Altura(int nivel) => nivel <= 2 ? nivel * AlturaDoNivel : 4.15f + (nivel - 3) * AlturaDoNivel;
        public static Vector3 Mundo(int[] celula, float altura = 0f) => celula != null && celula.Length >= 2 ? Mundo(celula[0], celula[1], altura) : Vector3.zero;

        public static string Casa(Vector3 pos) => Mathf.RoundToInt(pos.x) + "," + Mathf.RoundToInt(-pos.z);

        /// <summary>A casa da grade do jogo (GameGridCoordinates) que esta na posicao, ou null.</summary>
        public static Transform CasaDaGrade(Vector3 pos)
        {
            try
            {
                var grade = Cena?.AllGameGridCoords;
                if (grade == null) return null;
                foreach (var c in grade.Values)
                    if (c != null && Mathf.RoundToInt(c.transform.position.x) == Mathf.RoundToInt(pos.x) && Mathf.RoundToInt(c.transform.position.z) == Mathf.RoundToInt(pos.z)) return c.transform;
            }
            catch { }
            return null;
        }

        public static void Sujo()
        {
            try { DadosJogo?.SetDirty(); } catch { }
            try { UI?.SetDirty(); } catch { }
        }

        public static void Som(string evento)
        {
            try { Persistente?.Audio?.PostEvent(evento); } catch { }
        }
    }
}
