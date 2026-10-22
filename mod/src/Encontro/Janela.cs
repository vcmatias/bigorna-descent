using System;
using System.Linq;
using FFG.D3;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Bigorna.Encontro
{
    /// <summary>Janela propria do mod por cima do encontro (a loja e o arsenal dos gatilhos): uGUI montado em codigo, numa tela
    /// so dela (sobreposta a tudo), com a fonte do proprio jogo. O fundo escurecido segura os cliques: o tabuleiro nao recebe
    /// nada enquanto ela esta aberta. Uma por vez; fecha pelo botao dela.</summary>
    public class Janela
    {
        public static Janela Aberta;
        public static bool Visivel => Aberta != null && Aberta.Raiz != null && Aberta.Raiz.activeInHierarchy;

        public static readonly Color Fundo = new Color(0.10f, 0.085f, 0.07f, 0.97f);
        public static readonly Color Borda = new Color(0.72f, 0.58f, 0.29f, 1f);
        public static readonly Color Pergaminho = new Color(0.91f, 0.86f, 0.75f, 1f);
        public static readonly Color Ouro = new Color(0.85f, 0.71f, 0.35f, 1f);
        public static readonly Color Apagado = new Color(0.55f, 0.52f, 0.47f, 1f);
        public static readonly Color Fileira = new Color(1f, 1f, 1f, 0.045f);
        public static readonly Color BotaoCor = new Color(0.23f, 0.18f, 0.13f, 1f);
        public static readonly Color BotaoDestaque = new Color(0.45f, 0.33f, 0.14f, 1f);

        public GameObject Raiz;
        public RectTransform Painel;
        public RectTransform Corpo;
        public TMP_Text Titulo;
        public TMP_Text Canto;
        TMP_FontAsset _fonte;
        Action _aoFechar;
        bool _fechada;

        static TMP_FontAsset FonteDoJogo()
        {
            try
            {
                var ui = Jogo.UI;
                if (ui?.LabelCurrentObjective != null && ui.LabelCurrentObjective.font != null) return ui.LabelCurrentObjective.font;
                var t = ui != null ? ui.GetComponentsInChildren<TMP_Text>(true).FirstOrDefault(x => x != null && x.font != null) : null;
                if (t != null) return t.font;
            }
            catch { }
            return TMP_Settings.defaultFontAsset;
        }

        /// <summary>Abre uma janela nova (a que estivesse aberta fecha antes). Largura e altura na tela de 1920×1080.</summary>
        public static Janela Nova(string titulo, float largura, float altura, Action aoFechar)
        {
            Aberta?.Fechar();
            var j = new Janela { _aoFechar = aoFechar, _fonte = FonteDoJogo() };
            j.Raiz = new GameObject("@Bigorna-Janela", typeof(RectTransform));
            // (fica na cena do encontro: se o encontro acaba com ela aberta, ela some junto)
            var cv = j.Raiz.AddComponent<Canvas>(); cv.renderMode = RenderMode.ScreenSpaceOverlay; cv.sortingOrder = 32000;
            var cs = j.Raiz.AddComponent<CanvasScaler>(); cs.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; cs.referenceResolution = new Vector2(1920f, 1080f); cs.matchWidthOrHeight = 0.5f;
            j.Raiz.AddComponent<GraphicRaycaster>();
            if (EventSystem.current == null) { try { var es = Jogo.UI?.UIMainEventSystem; if (es != null) EventSystem.current = es; } catch { } }
            // o fundo escuro: segura os cliques do tabuleiro
            var veu = Caixa(j.Raiz.transform, "Veu"); Esticar(veu); veu.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.62f);
            j.Painel = Caixa(j.Raiz.transform, "Painel"); j.Painel.sizeDelta = new Vector2(largura, altura);
            j.Painel.gameObject.AddComponent<Image>().color = Fundo;
            var ol = j.Painel.gameObject.AddComponent<Outline>(); ol.effectColor = Borda; ol.effectDistance = new Vector2(3f, -3f);
            var v = j.Painel.gameObject.AddComponent<VerticalLayoutGroup>(); v.padding = new RectOffset(34, 34, 24, 26); v.spacing = 14f;
            v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            var cab = j.Linha(j.Painel, 56f);
            j.Titulo = j.Texto(cab, titulo, 40f, Ouro, TextAlignmentOptions.MidlineLeft); Flex(j.Titulo, 1f);
            j.Canto = j.Texto(cab, "", 28f, Pergaminho, TextAlignmentOptions.MidlineRight); Largura(j.Canto, 420f);
            var traco = Caixa(j.Painel, "Traco"); traco.gameObject.AddComponent<Image>().color = new Color(Borda.r, Borda.g, Borda.b, 0.6f); Altura(traco, 2f);
            j.Corpo = Caixa(j.Painel, "Corpo"); Flex(j.Corpo, 1f, 1f);
            var vc = j.Corpo.gameObject.AddComponent<VerticalLayoutGroup>(); vc.spacing = 12f; vc.childControlWidth = true; vc.childControlHeight = true; vc.childForceExpandWidth = true; vc.childForceExpandHeight = false;
            Aberta = j;
            Jogo.Som("UI_Click");
            return j;
        }

        public void Fechar()
        {
            if (_fechada) return; _fechada = true;
            if (Aberta == this) Aberta = null;
            try { if (Raiz != null) UnityEngine.Object.Destroy(Raiz); } catch { }
            try { _aoFechar?.Invoke(); } catch (Exception ex) { Log.Erro("ao fechar a janela", ex); }
        }

        /// <summary>Tira tudo do corpo (para redesenhar).</summary>
        public void Limpar(RectTransform r = null)
        {
            r = r ?? Corpo; if (r == null) return;
            for (int i = r.childCount - 1; i >= 0; i--) { var f = r.GetChild(i).gameObject; f.SetActive(false); UnityEngine.Object.Destroy(f); }
        }

        // ------------------------------------------------------------ pecas
        public static RectTransform Caixa(Transform pai, string nome)
        {
            var go = new GameObject(nome, typeof(RectTransform)); go.transform.SetParent(pai, false);
            return go.GetComponent<RectTransform>();
        }
        static void Esticar(RectTransform r) { r.anchorMin = Vector2.zero; r.anchorMax = Vector2.one; r.offsetMin = r.offsetMax = Vector2.zero; }
        static LayoutElement Le(Component c) { var le = c.GetComponent<LayoutElement>(); return le != null ? le : c.gameObject.AddComponent<LayoutElement>(); }
        public static void Altura(Component c, float a) { var le = Le(c); le.minHeight = a; le.preferredHeight = a; }
        public static void Largura(Component c, float l) { var le = Le(c); le.minWidth = l; le.preferredWidth = l; }
        public static void Flex(Component c, float w, float h = 0f) { var le = Le(c); le.flexibleWidth = w; if (h > 0f) le.flexibleHeight = h; }

        /// <summary>Uma fileira horizontal (altura fixa).</summary>
        public RectTransform Linha(RectTransform pai, float altura, float espaco = 14f, Color? fundo = null)
        {
            var r = Caixa(pai, "Linha"); Altura(r, altura);
            if (fundo.HasValue) r.gameObject.AddComponent<Image>().color = fundo.Value;
            var h = r.gameObject.AddComponent<HorizontalLayoutGroup>(); h.spacing = espaco; h.childAlignment = TextAnchor.MiddleLeft;
            h.childControlWidth = true; h.childControlHeight = true; h.childForceExpandWidth = false; h.childForceExpandHeight = true;
            if (fundo.HasValue) h.padding = new RectOffset(12, 12, 6, 6);
            return r;
        }

        /// <summary>Uma coluna (as fileiras de cima para baixo).</summary>
        public RectTransform Coluna(RectTransform pai, float espaco = 8f)
        {
            var r = Caixa(pai, "Coluna");
            var v = r.gameObject.AddComponent<VerticalLayoutGroup>(); v.spacing = espaco; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            return r;
        }

        public TMP_Text Texto(RectTransform pai, string s, float tamanho, Color cor, TextAlignmentOptions alinhar = TextAlignmentOptions.MidlineLeft)
        {
            var r = Caixa(pai, "Texto");
            var t = r.gameObject.AddComponent<TextMeshProUGUI>();
            if (_fonte != null) t.font = _fonte;
            t.text = s ?? ""; t.fontSize = tamanho; t.color = cor; t.alignment = alinhar; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Ellipsis; t.raycastTarget = false; t.richText = true;
            return t;
        }

        public Button Botao(RectTransform pai, string s, Action acao, float largura = 170f, bool destaque = false, bool ativo = true)
        {
            var r = Caixa(pai, "Botao"); Largura(r, largura);
            var img = r.gameObject.AddComponent<Image>(); img.color = destaque ? BotaoDestaque : BotaoCor;
            var ol = r.gameObject.AddComponent<Outline>(); ol.effectColor = new Color(Borda.r, Borda.g, Borda.b, ativo ? 0.85f : 0.3f); ol.effectDistance = new Vector2(1.5f, -1.5f);
            var b = r.gameObject.AddComponent<Button>(); b.targetGraphic = img;
            var cores = b.colors; cores.highlightedColor = new Color(1.35f, 1.3f, 1.2f, 1f); cores.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1f); cores.disabledColor = new Color(0.55f, 0.55f, 0.55f, 0.7f); cores.colorMultiplier = 1f; b.colors = cores;
            b.interactable = ativo;
            var t = Texto(r, s, 24f, ativo ? Pergaminho : Apagado, TextAlignmentOptions.Center); Esticar(t.rectTransform);
            b.onClick.AddListener(() => { if (_fechada) return; Jogo.Som("UI_Click"); try { acao?.Invoke(); } catch (Exception ex) { Log.Erro("botão «" + s + "»", ex); } });
            return b;
        }

        public Image Icone(RectTransform pai, Sprite sp, float lado)
        {
            var r = Caixa(pai, "Icone"); Largura(r, lado); Altura(r, lado);
            var img = r.gameObject.AddComponent<Image>(); img.preserveAspect = true; img.raycastTarget = false;
            if (sp != null) img.sprite = sp; else img.color = new Color(1f, 1f, 1f, 0.06f);
            return img;
        }

        public void Espaco(RectTransform pai, float largura) { var r = Caixa(pai, "Espaco"); Largura(r, largura); }

        /// <summary>Uma area rolavel que ocupa o resto da altura; devolve o conteudo (as fileiras vao nele).</summary>
        public RectTransform Rolagem(RectTransform pai)
        {
            var area = Caixa(pai, "Rolagem"); Flex(area, 1f, 1f);
            area.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.18f);
            area.gameObject.AddComponent<RectMask2D>();
            var sr = area.gameObject.AddComponent<ScrollRect>(); sr.horizontal = false; sr.movementType = ScrollRect.MovementType.Clamped; sr.scrollSensitivity = 40f;
            var cont = Caixa(area, "Conteudo"); cont.anchorMin = new Vector2(0f, 1f); cont.anchorMax = new Vector2(1f, 1f); cont.pivot = new Vector2(0.5f, 1f); cont.offsetMin = cont.offsetMax = Vector2.zero;
            var v = cont.gameObject.AddComponent<VerticalLayoutGroup>(); v.spacing = 6f; v.padding = new RectOffset(8, 8, 8, 8); v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            cont.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.content = cont; sr.viewport = area;
            return cont;
        }

        /// <summary>A imagem de um item do jogo (a mesma das cartas do inventario), ou null.</summary>
        public static Sprite ImagemDe(ItemModel m)
        {
            if (m == null) return null;
            try { var c = m.GetTextureAssetPath(); if (string.IsNullOrEmpty(c)) return null; return Jogo.Persistente?.ABLoader?.LoadAsset<Sprite>(c); }
            catch { return null; }
        }
    }
}
