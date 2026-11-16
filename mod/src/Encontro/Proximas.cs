using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Bigorna.Encontro
{
    /// <summary>v363: o quadro "Proximas salas", num canto da tela durante o encontro: um botao que abre e fecha a lista das salas
    /// ainda fechadas, cada uma com as pecas e os objetos que vao para a mesa quando ela abrir (para separar o material antes).
    /// O que nao se pode saber antes vai como "Segredo": um objeto escondido (que nao surge com a sala) e uma peca que ja esta
    /// em uso (na mesa, ou noutra sala por abrir), que revelaria um desmonte. Fica de lado com F8, com um quadro do mod aberto e
    /// durante as falas; nao segura os cliques do tabuleiro fora dele.</summary>
    public static class Proximas
    {
        static GameObject _raiz;
        static RectTransform _painel, _corpo, _area, _conteudo;
        static TMP_Text _botaoTexto; static RectTransform _botao;
        static TMP_FontAsset _fonte;
        static bool _aberta;
        static string _assinatura;
        static float _proxima;
        static int _salas;

        static string Segredo => Idioma.T("Segredo", "Secret");

        /// <summary>O clique caiu no quadro (o tabuleiro nao o recebe).</summary>
        public static bool SobOPonteiro(Vector3 pos)
        {
            try { return _raiz != null && _raiz.activeInHierarchy && _painel != null && RectTransformUtility.RectangleContainsScreenPoint(_painel, new Vector2(pos.x, pos.y), null); }
            catch { return false; }
        }

        public static void Esconder() { try { if (_raiz != null) _raiz.SetActive(false); } catch { } }

        /// <summary>A cada quadro do jogo (Nucleo): mostra, esconde e redesenha quando o que vem muda.</summary>
        public static void Batimento()
        {
            bool pode = Jogo.EmEncontro && Tabuleiro.Montado && Tabuleiro.NossaCena && Nucleo.Visivel && !Janela.Visivel && !Dialogos.Ocupado && !Cinematica.EmMarcha;
            if (!pode) { Esconder(); return; }
            if (Time.unscaledTime < _proxima && _raiz != null) { if (!_raiz.activeSelf && _salas > 0) _raiz.SetActive(true); return; }
            _proxima = Time.unscaledTime + 0.5f;
            var dados = Dados(); _salas = dados.Count;
            if (dados.Count == 0) { Esconder(); return; }
            if (_raiz == null) Criar();
            if (!_raiz.activeSelf) _raiz.SetActive(true);
            var sig = (_aberta ? "1|" : "0|") + string.Join("\n", dados.Select(d => d.Titulo + ":" + string.Join(",", d.Pecas) + ";" + string.Join(",", d.Objetos)).ToArray());
            if (sig != _assinatura) { _assinatura = sig; Redesenhar(dados); }
        }

        class Sala { public string Titulo; public List<string> Pecas; public List<string> Objetos; }

        /// <summary>v369: as salas ao alcance agora: as que um objeto já acessível abre (à vista, numa sala aberta, ainda por
        /// usar), por um gatilho de uso ou por uma resposta dele. As salas mais adiante, que dependem de outras abrirem primeiro,
        /// ficam de fora do quadro até chegarem ao alcance.</summary>
        static HashSet<string> AoAlcance()
        {
            var r = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var gatilhos = Motor.Roteiro.Mapa?.Gatilhos; if (gatilhos == null) return r;
            var acessiveis = new HashSet<int>(Objetos.Postos.Where(o => o != null && o.Visivel && !o.Usado).Select(o => o.Indice));
            foreach (var t in gatilhos)
            {
                var e = t?.Evento; if (e == null || (e.Id != "interacted" && e.Id != "choiceMade")) continue;
                if (!acessiveis.Contains(Formato.P.Inteiro(e.Params, "interactable", -1))) continue;
                // (também dentro de um «if»: a ação de abrir pode vir aninhada)
                try
                {
                    foreach (var tk in Newtonsoft.Json.Linq.JToken.FromObject(t.Acoes ?? new List<Formato.Dmap.Clausula>()).SelectTokens("$..id"))
                    {
                        var id = (string)tk; if (id != "revealTiles" && id != "revealRoom") continue;
                        var g = (string)tk.Parent?.Parent?["params"]?["group"]; if (!string.IsNullOrEmpty(g)) r.Add(g);
                    }
                }
                catch (Exception ex) { Log.Info("próximas salas: " + ex.Message); }
            }
            return r;
        }

        static List<Sala> Dados()
        {
            var r = new List<Sala>(); var perto = AoAlcance();
            foreach (var (g, pecas) in Tabuleiro.PorAbrir(Segredo))
            {
                if (!perto.Contains(g)) continue;
                var n = Tabuleiro.NumeroDaSala(g);
                r.Add(new Sala { Titulo = n > 0 ? Idioma.TF("Sala {0}", "Room {0}", n) : g, Pecas = Juntar(pecas), Objetos = Juntar(Objetos.DaSalaPorAbrir(g, Segredo)) });
            }
            return r;
        }

        /// <summary>Os nomes iguais juntos ("Baú ×2"); os segredos no fim.</summary>
        static List<string> Juntar(List<string> nomes)
        {
            var s = Segredo;
            return nomes.GroupBy(x => x).OrderBy(gr => gr.Key == s ? 1 : 0).Select(gr => gr.Count() > 1 ? gr.Key + " ×" + gr.Count() : gr.Key).ToList();
        }

        static void Criar()
        {
            _fonte = Janela.FonteDoJogo();
            _raiz = new GameObject("@Bigorna-Proximas", typeof(RectTransform));   // (na cena do encontro: some com ela)
            var cv = _raiz.AddComponent<Canvas>(); cv.renderMode = RenderMode.ScreenSpaceOverlay; cv.sortingOrder = 31000;   // (abaixo das janelas do mod)
            var cs = _raiz.AddComponent<CanvasScaler>(); cs.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; cs.referenceResolution = new Vector2(1920f, 1080f); cs.matchWidthOrHeight = 0.5f;
            _raiz.AddComponent<GraphicRaycaster>();
            if (EventSystem.current == null) { try { var es = Jogo.UI?.UIMainEventSystem; if (es != null) EventSystem.current = es; } catch { } }
            // the panel: top left, below the line of the mod; it grows with what it shows
            _painel = Janela.Caixa(_raiz.transform, "Painel");
            _painel.anchorMin = _painel.anchorMax = new Vector2(0f, 1f); _painel.pivot = new Vector2(0f, 1f); _painel.anchoredPosition = new Vector2(20f, -96f);
            _painel.gameObject.AddComponent<Image>().color = new Color(Janela.Fundo.r, Janela.Fundo.g, Janela.Fundo.b, 0.92f);
            var ol = _painel.gameObject.AddComponent<Outline>(); ol.effectColor = new Color(Janela.Borda.r, Janela.Borda.g, Janela.Borda.b, 0.8f); ol.effectDistance = new Vector2(2f, -2f);
            var v = _painel.gameObject.AddComponent<VerticalLayoutGroup>(); v.padding = new RectOffset(6, 6, 6, 6); v.spacing = 8f;
            v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            var fit = _painel.gameObject.AddComponent<ContentSizeFitter>(); fit.horizontalFit = ContentSizeFitter.FitMode.PreferredSize; fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            // the button that opens and closes it
            var br = _botao = Janela.Caixa(_painel, "Botao"); Janela.Altura(br, 40f); Janela.Largura(br, 44f);
            var img = br.gameObject.AddComponent<Image>(); img.color = Janela.BotaoCor;
            var b = br.gameObject.AddComponent<Button>(); b.targetGraphic = img;
            var cores = b.colors; cores.highlightedColor = new Color(1.35f, 1.3f, 1.2f, 1f); cores.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1f); cores.colorMultiplier = 1f; b.colors = cores;
            _botaoTexto = Texto(br, "", 26f, Janela.Ouro, TextAlignmentOptions.Center);
            var tr = _botaoTexto.rectTransform; tr.anchorMin = Vector2.zero; tr.anchorMax = Vector2.one; tr.offsetMin = new Vector2(6f, 0f); tr.offsetMax = new Vector2(-6f, 0f);
            b.onClick.AddListener(() => { _aberta = !_aberta; Jogo.Som("UI_Click"); _assinatura = null; _proxima = 0f; });
            // the list: a scrolled area, as tall as what it holds (at most about half the screen)
            _corpo = Janela.Caixa(_painel, "Corpo"); Janela.Largura(_corpo, 460f);
            var vc = _corpo.gameObject.AddComponent<VerticalLayoutGroup>(); vc.childControlWidth = true; vc.childControlHeight = true; vc.childForceExpandWidth = true; vc.childForceExpandHeight = false;
            _area = Janela.Caixa(_corpo, "Rolagem");
            _area.gameObject.AddComponent<Image>().color = new Color(0f, 0f, 0f, 0.18f);
            _area.gameObject.AddComponent<RectMask2D>();
            var sr = _area.gameObject.AddComponent<ScrollRect>(); sr.horizontal = false; sr.movementType = ScrollRect.MovementType.Clamped; sr.scrollSensitivity = 40f;
            _conteudo = Janela.Caixa(_area, "Conteudo"); _conteudo.anchorMin = new Vector2(0f, 1f); _conteudo.anchorMax = new Vector2(1f, 1f); _conteudo.pivot = new Vector2(0.5f, 1f); _conteudo.offsetMin = _conteudo.offsetMax = Vector2.zero;
            var vl = _conteudo.gameObject.AddComponent<VerticalLayoutGroup>(); vl.spacing = 10f; vl.padding = new RectOffset(10, 10, 8, 8); vl.childControlWidth = true; vl.childControlHeight = true; vl.childForceExpandWidth = true; vl.childForceExpandHeight = false;
            _conteudo.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.content = _conteudo; sr.viewport = _area;
            _assinatura = null;
        }

        static TMP_Text Texto(RectTransform pai, string s, float tamanho, Color cor, TextAlignmentOptions alinhar)
        {
            var r = Janela.Caixa(pai, "Texto");
            var t = r.gameObject.AddComponent<TextMeshProUGUI>();
            if (_fonte != null) t.font = _fonte;
            t.text = s ?? ""; t.fontSize = tamanho; t.color = cor; t.alignment = alinhar; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Overflow; t.raycastTarget = false; t.richText = true;
            return t;
        }

        static void Redesenhar(List<Sala> dados)
        {
            // (v363: closed, only a small button with a sign; open, the title and the list)
            Janela.Largura(_botao, _aberta ? 460f : 44f); _botaoTexto.alignment = _aberta ? TextAlignmentOptions.MidlineLeft : TextAlignmentOptions.Center;
            _botaoTexto.text = _aberta ? "« " + Idioma.T("Próximas salas", "Next rooms") + "  <size=80%><color=#bdb6a6>(" + dados.Count + ")</color></size>" : "»";
            _corpo.gameObject.SetActive(_aberta);
            if (!_aberta) { LayoutRebuilder.ForceRebuildLayoutImmediate(_painel); return; }
            for (int i = _conteudo.childCount - 1; i >= 0; i--) { var f = _conteudo.GetChild(i).gameObject; f.SetActive(false); UnityEngine.Object.Destroy(f); }
            var nada = Idioma.T("nenhum", "none");
            Texto(_conteudo, "<i>" + Idioma.T("Antecipe a montagem no downtime.", "Set up ahead during downtime.") + "</i>", 20f, Janela.Apagado, TextAlignmentOptions.MidlineLeft);   // (v363: what the list is for)
            foreach (var d in dados)
            {
                var col = Janela.Caixa(_conteudo, "Sala");
                var v = col.gameObject.AddComponent<VerticalLayoutGroup>(); v.spacing = 2f; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
                Texto(col, "<b>" + d.Titulo + "</b>", 23f, Janela.Ouro, TextAlignmentOptions.MidlineLeft);
                Texto(col, "<color=#bdb6a6>" + Idioma.T("Peças:", "Tiles:") + "</color> " + (d.Pecas.Count > 0 ? string.Join(", ", d.Pecas.ToArray()) : nada), 20f, Janela.Pergaminho, TextAlignmentOptions.TopLeft);
                Texto(col, "<color=#bdb6a6>" + Idioma.T("Objetos:", "Objects:") + "</color> " + (d.Objetos.Count > 0 ? string.Join(", ", d.Objetos.ToArray()) : nada), 20f, Janela.Pergaminho, TextAlignmentOptions.TopLeft);
            }
            // (the height of the list: what it holds, up to half the screen; more than that scrolls)
            LayoutRebuilder.ForceRebuildLayoutImmediate(_conteudo);
            var h = Mathf.Min(LayoutUtility.GetPreferredHeight(_conteudo), 520f);
            Janela.Altura(_area, Mathf.Max(60f, h));
            LayoutRebuilder.ForceRebuildLayoutImmediate(_painel);
        }
    }
}
