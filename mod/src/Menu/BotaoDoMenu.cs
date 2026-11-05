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
    /// fica o botao desenhado pelo mod, embaixo da tela. v258: logo abaixo dele, do mesmo jeito, o botao "Mapa oneshot" (um mapa
    /// novo feito na hora pelo gerador do editor: TelaDeMapas.AbrirOneshot).
    /// </summary>
    public static class BotaoDoMenu
    {
        static Button _botao, _sair, _oneshot, _ngmais;
        static TMP_Text _texto, _textoOneshot, _textoNgMais;
        static float _relatoEm;
        static float _proximaTentativa;
        static int _tentativas;

        /// <summary>O botao do jogo esta na tela (o painel nao precisa desenhar o seu).</summary>
        public static bool Pronto => _botao != null && _botao.gameObject != null;
        /// <summary>O botao nao entrou no menu do jogo (todas as tentativas falharam): so entao o painel desenha o seu, embaixo.</summary>
        public static bool Falhou => !Pronto && _tentativas > 20;

        public static void Batimento()
        {
            if (Jogo.CenaAtual() != Scene.Titlescene) { if (_botao != null || _sair != null) TelaDeMapas.Esquecer(); _botao = null; _sair = null; _texto = null; _oneshot = null; _textoOneshot = null; _ngmais = null; _textoNgMais = null; _tentativas = 0; return; }
            if (Pronto) { Rotular(); Espelhar(); Relatar(); PerguntarFim(); return; }
            if (_tentativas > 20 || Time.unscaledTime < _proximaTentativa) return;
            _proximaTentativa = Time.unscaledTime + 0.5f; _tentativas++;
            try { Criar(); } catch (Exception ex) { Log.Erro("botão do menu", ex); _tentativas = 99; }
        }

        /// <summary>v266: um mapa oneshot terminado com a ultima copia dele: com o menu do jogo de pe (e sem a escolha do destino do
        /// grupo na tela), a pergunta se ele vira mapa novo.</summary>
        static float _menuDesde = -1f;
        static bool _grupoTentado; static float _grupoPedidoEm = -100f;
        static void PerguntarFim()
        {
            bool menu = _sair != null && _sair.gameObject.activeInHierarchy && _sair.interactable;
            if (!menu) { _menuDesde = -1f; return; }
            if (_menuDesde < 0f) _menuDesde = Time.unscaledTime;
            // (v287: o destino do grupo de uma partida gravada, no quadro do jogo; se não der, o mod desenha a pergunta como antes.
            //  Fechado sem resposta (a seta de voltar), a pergunta volta)
            if (Encontro.GrupoDoSave.Pendente && Encontro.GrupoDoSave.NoQuadroDoJogo && !TelaDeMapas.Aberta && Time.unscaledTime - _grupoPedidoEm > 3f) { Encontro.GrupoDoSave.NoQuadroDoJogo = false; _grupoTentado = false; _menuDesde = Time.unscaledTime; }
            if (Encontro.GrupoDoSave.Pendente && !Encontro.GrupoDoSave.NoQuadroDoJogo && !TelaDeMapas.Aberta && !PainelMapas.Aberto && Time.unscaledTime - _menuDesde >= 1.5f && !_grupoTentado)
            { _grupoTentado = true; if (TelaDeMapas.PerguntarGrupo()) { Encontro.GrupoDoSave.NoQuadroDoJogo = true; _grupoPedidoEm = Time.unscaledTime; } return; }
            if (!Encontro.GrupoDoSave.Pendente) _grupoTentado = false;
            if (Oneshot.FimPendente == null || Encontro.GrupoDoSave.Pendente || TelaDeMapas.Aberta || PainelMapas.Aberto || Time.unscaledTime - _menuDesde < 1.5f) return;
            if (!TelaDeMapas.PerguntarFim()) Oneshot.FimPendente = null;
        }

        static void Rotular()
        {
            if (_texto == null) return;
            var t = PainelMapas.Aberto ? T("Fechar mapas", "Close maps") : T("Mapas da comunidade", "Community maps");
            if (_texto.text != t) _texto.text = t;
            var t2 = T("Mapa oneshot", "One-shot map"); if (_textoOneshot != null && _textoOneshot.text != t2) _textoOneshot.text = t2;
            var t3 = T("Novo jogo +", "New Game +"); if (_textoNgMais != null && _textoNgMais.text != t3) _textoNgMais.text = t3;
        }

        /// <summary>O menu do jogo aparece e some com o proprio botao "Sair" (transparencia, interacao, ligado ou nao): a copia segue
        /// o "Sair" a cada quadro (ela nasceu de um "Sair" que ainda estava apagado, no comeco da animacao do menu, e assim ficava).</summary>
        static void Espelhar()
        {
            if (_sair == null) return;
            Espelhar(_botao, _texto); if (_oneshot != null) Espelhar(_oneshot, _textoOneshot); if (_ngmais != null) Espelhar(_ngmais, _textoNgMais);
        }
        static void Espelhar(Button botao, TMP_Text texto)
        {
            var _botao = botao; var _texto = texto;
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

            var go = Copiar(sair, pai, "BigornaMapasDaComunidade");
            var b2 = go.GetComponent<Button>();
            b2.onClick.AddListener(() => { if (TelaDeMapas.Abrir()) return; Nucleo.Visivel = true; PainelMapas.Alternar(); Rotular(); });   // (a tela no estilo do jogo; sem ela, o painel do mod)
            _texto = go.GetComponentInChildren<TMP_Text>(true); _botao = b2; _sair = sair; _relatoEm = Time.unscaledTime + 4f;
            // (v258: o "Mapa oneshot", logo depois; sem a tela no estilo do jogo, ele avisa)
            var go2 = Copiar(sair, pai, "BigornaMapaOneshot");
            _oneshot = go2.GetComponent<Button>(); _textoOneshot = go2.GetComponentInChildren<TMP_Text>(true);
            _oneshot.onClick.AddListener(() => { if (TelaDeMapas.AbrirOneshot()) return; Nucleo.Visivel = true; PainelMapas.MostrarErro(T("O mapa oneshot precisa da tela do jogo, que não abriu nesta versão.", "The one-shot map needs the game's screen, which did not open in this version."), 1); });
            // (v262: o "Novo jogo +", logo depois)
            var go3 = Copiar(sair, pai, "BigornaNovoJogoMais");
            _ngmais = go3.GetComponent<Button>(); _textoNgMais = go3.GetComponentInChildren<TMP_Text>(true);
            _ngmais.onClick.AddListener(() => { if (TelaDeMapas.AbrirNovoJogoMais()) return; Nucleo.Visivel = true; PainelMapas.MostrarErro(T("O Novo jogo + precisa da tela do jogo, que não abriu nesta versão.", "New Game + needs the game's screen, which did not open in this version."), 1); });
            Posicionar(pai, irmaos, colecao, sair, go, go2, go3);
            Rotular();
            LayoutRebuilder.ForceRebuildLayoutImmediate(pai as RectTransform);
            Log.Info("menu do jogo: botões «Mapas da comunidade», «Mapa oneshot» e «Novo jogo +» postos " + (colecao != null ? "depois de «" + colecao.name + "»" : "antes de «" + sair.name + "»"));
        }

        /// <summary>Uma copia do "Sair" (mesma fonte, desenho e animacoes), sem o texto traduzido do jogo nem os gatilhos dele.</summary>
        static GameObject Copiar(Button sair, Transform pai, string nome)
        {
            var go = UnityEngine.Object.Instantiate(sair.gameObject, pai, false);
            go.name = nome;
            // (o texto do jogo e traduzido por um componente que o reescreveria: sai antes de trocar o texto)
            foreach (var c in go.GetComponentsInChildren<Component>(true))
                if (c != null && c.GetType().FullName != null && c.GetType().FullName.StartsWith("I2.Loc.", StringComparison.Ordinal)) UnityEngine.Object.DestroyImmediate(c);
            // (um gatilho de eventos copiado do "Sair" sairia do jogo: os dele saem)
            foreach (var et in go.GetComponentsInChildren<UnityEngine.EventSystems.EventTrigger>(true)) et.triggers.Clear();
            Log.Info("menu do jogo: componentes do botão copiado: " + string.Join(", ", go.GetComponentsInChildren<Component>(true).Where(c => c != null).Select(c => c.GetType().Name).Distinct().ToArray()));
            var b2 = go.GetComponent<Button>();
            b2.onClick = new Button.ButtonClickedEvent();
            b2.interactable = true;
            go.SetActive(true);
            return go;
        }

        /// <summary>A posicao: os botoes novos entre a colecao e o sair, um depois do outro.</summary>
        static void Posicionar(Transform pai, System.Collections.Generic.List<Button> irmaos, Button colecao, Button sair, params GameObject[] novos)
        {
            int alvo = colecao != null ? colecao.transform.GetSiblingIndex() + 1 : sair.transform.GetSiblingIndex();
            if (pai.GetComponent<LayoutGroup>() != null)
            {
                foreach (var go in novos) go.transform.SetSiblingIndex(alvo++);
                if (sair.transform.GetSiblingIndex() < novos.Last().transform.GetSiblingIndex()) sair.transform.SetSiblingIndex(novos.Last().transform.GetSiblingIndex() + 1);
                return;
            }
            // sem arranjo automatico: os botoes novos tomam o lugar do "Sair", um passo cada, e o "Sair" (com o que vier depois
            // dele) desce tantos passos quantos sao os novos
            var rs = sair.GetComponent<RectTransform>();
            var rc = colecao != null ? colecao.GetComponent<RectTransform>() : null;
            var passo = rc != null ? rs.anchoredPosition - rc.anchoredPosition : new Vector2(0f, -rs.rect.height * 1.2f);
            var origem = rs.anchoredPosition;
            foreach (var b in irmaos.Where(b => b.GetComponent<RectTransform>() != null && Vector2.Dot(b.GetComponent<RectTransform>().anchoredPosition - origem, passo) >= 0f))
                b.GetComponent<RectTransform>().anchoredPosition += passo * novos.Length;
            for (int i = 0; i < novos.Length; i++) { novos[i].GetComponent<RectTransform>().anchoredPosition = origem + passo * i; novos[i].transform.SetSiblingIndex(sair.transform.GetSiblingIndex()); }
        }
    }
}
