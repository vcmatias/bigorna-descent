using System;
using System.Linq;
using FFG.Core;
using FFG.D3;
using FFG.D3.Titlescene;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>
    /// O botao "Mapas da comunidade" no menu do jogo, entre "Colecao" e "Sair": uma copia do proprio botao "Sair" (mesma fonte,
    /// mesmo desenho, mesmas animacoes), com o texto trocado e o clique abrindo o painel de mapas. Na tela de titulo o menu do
    /// jogo e montado de novo a cada visita; o botao e refeito junto. Sem o menu (uma versao do jogo que o monte de outro jeito),
    /// fica o botao desenhado pelo mod, embaixo da tela.
    /// </summary>
    public static class BotaoDoMenu
    {
        static Button _botao, _sair;
        static TMP_Text _texto;
        static float _relatoEm;
        static float _proximaTentativa;
        static int _tentativas;

        /// <summary>O botao do jogo esta na tela (o painel nao precisa desenhar o seu).</summary>
        public static bool Pronto => _botao != null && _botao.gameObject != null;
        /// <summary>O botao nao entrou no menu do jogo (todas as tentativas falharam): so entao o painel desenha o seu, embaixo.</summary>
        public static bool Falhou => !Pronto && _tentativas > 20;

        public static void Batimento()
        {
            if (Jogo.CenaAtual() != Scene.Titlescene) { if (_botao != null || _sair != null) TelaDeMapas.Esquecer(); _botao = null; _sair = null; _texto = null; _tentativas = 0; return; }
            if (Pronto) { Rotular(); Espelhar(); Relatar(); return; }
            if (_tentativas > 20 || Time.unscaledTime < _proximaTentativa) return;
            _proximaTentativa = Time.unscaledTime + 0.5f; _tentativas++;
            try { Criar(); } catch (Exception ex) { Log.Erro("botão do menu", ex); _tentativas = 99; }
        }

        static void Rotular()
        {
            if (_texto == null) return;
            var t = PainelMapas.Aberto ? T("Fechar mapas", "Close maps") : T("Mapas da comunidade", "Community maps");
            if (_texto.text != t) _texto.text = t;
        }

        /// <summary>O menu do jogo aparece e some com o proprio botao "Sair" (transparencia, interacao, ligado ou nao): a copia segue
        /// o "Sair" a cada quadro (ela nasceu de um "Sair" que ainda estava apagado, no comeco da animacao do menu, e assim ficava).</summary>
        static void Espelhar()
        {
            if (_sair == null) return;
            var go = _botao.gameObject; if (go.activeSelf != _sair.gameObject.activeSelf) go.SetActive(_sair.gameObject.activeSelf);
            var cs = _sair.GetComponent<CanvasGroup>(); var cn = go.GetComponent<CanvasGroup>();
            if (cs != null && cn != null) { cn.alpha = cs.alpha; cn.interactable = cs.interactable; cn.blocksRaycasts = cs.blocksRaycasts; }
            else if (cn != null) { cn.alpha = 1f; cn.interactable = true; cn.blocksRaycasts = true; }
            _botao.interactable = _sair.interactable;
            var ts = _sair.GetComponentInChildren<TMP_Text>(true); if (ts != null && _texto != null) { _texto.alpha = ts.alpha; if (_texto.font != ts.font) _texto.font = ts.font; }
            var ims = _sair.GetComponent<Image>(); var imn = go.GetComponent<Image>(); if (ims != null && imn != null) imn.color = ims.color;
            go.transform.localScale = _sair.transform.localScale;
        }

        /// <summary>Uma vez, alguns segundos depois de posto: o estado do botao no registro (para conferir se ficou a vista).</summary>
        static void Relatar()
        {
            if (_relatoEm <= 0f || Time.unscaledTime < _relatoEm) return; _relatoEm = 0f;
            try
            {
                var r = _botao.GetComponent<RectTransform>(); var rs = _sair.GetComponent<RectTransform>(); var cn = _botao.GetComponent<CanvasGroup>();
                Log.Info("menu do jogo: botão novo " + (_botao.gameObject.activeInHierarchy ? "ligado" : "desligado") + ", alfa " + (cn != null ? cn.alpha.ToString("0.00") : "-") + ", posição " + r.position + " tamanho " + r.rect.size
                    + " · «Sair» em " + rs.position + " tamanho " + rs.rect.size + ", índices " + _botao.transform.GetSiblingIndex() + "/" + _sair.transform.GetSiblingIndex() + ", texto «" + (_texto != null ? _texto.text : "?") + "» alfa " + (_texto != null ? _texto.alpha.ToString("0.00") : "-"));
            }
            catch (Exception ex) { Log.Info("menu do jogo: relato " + ex.Message); }
        }

        static string Metodo(Button b)
        {
            try { var e = b.onClick; for (int i = 0; i < e.GetPersistentEventCount(); i++) { var m = e.GetPersistentMethodName(i); if (!string.IsNullOrEmpty(m)) return m; } } catch { }
            return "";
        }

        static void Criar()
        {
            if (!SingletonBehaviour<UITitlescreen>.IsInitialized) return;
            var tela = SingletonBehaviour<UITitlescreen>.Instance; var sair = tela?.QuitButton;
            if (sair == null || !sair.gameObject.activeInHierarchy) return;
            var pai = sair.transform.parent;
            // o botao da colecao: o irmao que chama OnCollectionClicked (senao, o que vem logo antes do "Sair")
            var irmaos = pai.GetComponentsInChildren<Button>(true).Where(b => b.transform.parent == pai).ToList();
            var colecao = irmaos.FirstOrDefault(b => Metodo(b).IndexOf("Collection", StringComparison.OrdinalIgnoreCase) >= 0);
            Log.Info("menu do jogo: " + string.Join(", ", irmaos.Select(b => b.name + "[" + b.transform.GetSiblingIndex() + "]" + (Metodo(b).Length > 0 ? "→" + Metodo(b) : "")).ToArray())
                + " · layout: " + (pai.GetComponent<LayoutGroup>() != null ? pai.GetComponent<LayoutGroup>().GetType().Name : "nenhum"));

            var go = UnityEngine.Object.Instantiate(sair.gameObject, pai, false);
            go.name = "BigornaMapasDaComunidade";
            // (o texto do jogo e traduzido por um componente que o reescreveria: sai antes de trocar o texto)
            foreach (var c in go.GetComponentsInChildren<Component>(true))
                if (c != null && c.GetType().FullName != null && c.GetType().FullName.StartsWith("I2.Loc.", StringComparison.Ordinal)) UnityEngine.Object.DestroyImmediate(c);
            // (um gatilho de eventos copiado do "Sair" sairia do jogo: os dele saem)
            foreach (var et in go.GetComponentsInChildren<UnityEngine.EventSystems.EventTrigger>(true)) et.triggers.Clear();
            Log.Info("menu do jogo: componentes do botão copiado: " + string.Join(", ", go.GetComponentsInChildren<Component>(true).Where(c => c != null).Select(c => c.GetType().Name).Distinct().ToArray()));
            var b2 = go.GetComponent<Button>();
            b2.onClick = new Button.ButtonClickedEvent();
            b2.onClick.AddListener(() => { if (TelaDeMapas.Abrir()) return; Nucleo.Visivel = true; PainelMapas.Alternar(); Rotular(); });   // (a tela no estilo do jogo; sem ela, o painel do mod)
            b2.interactable = true;
            _texto = go.GetComponentInChildren<TMP_Text>(true); _botao = b2; _sair = sair; _relatoEm = Time.unscaledTime + 4f;
            go.SetActive(true);

            // a posicao: entre a colecao e o sair
            int alvo = colecao != null ? colecao.transform.GetSiblingIndex() + 1 : sair.transform.GetSiblingIndex();
            if (pai.GetComponent<LayoutGroup>() != null) { go.transform.SetSiblingIndex(alvo); if (sair.transform.GetSiblingIndex() < go.transform.GetSiblingIndex()) sair.transform.SetSiblingIndex(go.transform.GetSiblingIndex() + 1); }
            else
            {
                // sem arranjo automatico: o botao novo toma o lugar do "Sair", e o "Sair" (com o que vier depois dele) desce um passo
                var rs = sair.GetComponent<RectTransform>(); var rn = go.GetComponent<RectTransform>();
                var rc = colecao != null ? colecao.GetComponent<RectTransform>() : null;
                var passo = rc != null ? rs.anchoredPosition - rc.anchoredPosition : new Vector2(0f, -rs.rect.height * 1.2f);
                rn.anchoredPosition = rs.anchoredPosition;
                foreach (var b in irmaos.Where(b => b.GetComponent<RectTransform>() != null && Vector2.Dot(b.GetComponent<RectTransform>().anchoredPosition - rs.anchoredPosition, passo) >= 0f))
                    b.GetComponent<RectTransform>().anchoredPosition += passo;
                go.transform.SetSiblingIndex(sair.transform.GetSiblingIndex());
            }
            Rotular();
            LayoutRebuilder.ForceRebuildLayoutImmediate(pai as RectTransform);
            Log.Info("menu do jogo: botão «Mapas da comunidade» posto " + (colecao != null ? "depois de «" + colecao.name + "»" : "antes de «" + sair.name + "»"));
        }
    }
}
