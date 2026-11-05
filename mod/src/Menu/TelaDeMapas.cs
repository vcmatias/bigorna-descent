using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Bigorna.Encontro;
using Bigorna.Formato;
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
    /// A tela "Mapas da comunidade" no estilo do proprio jogo: uma copia da tela "Carregar campanha" (fundo, titulo, voltar,
    /// grade), com uma ficha por campanha ou mapa feita do mesmo modelo das fichas de partida gravada (nome, numero, caixa do
    /// ato, data, resumo), um pouco menores, para caber mais. Tocar numa ficha a seleciona (a bandeja do jogo aparece) e o
    /// botao de carregar dela joga. Em cima, as abas (campanhas, mapas avulsos, mapas oficiais); embaixo, abrir a pasta, o
    /// editor, relatar um problema e a lingua. Os mapas oficiais tem fichas tambem; escolher uma abre um quadro do jogo com o
    /// nivel e os herois. Nada da logica do jogo roda na copia: os scripts da tela e das fichas saem antes de ela acordar.
    /// Se a montagem falhar (uma versao do jogo com outra tela), o painel antigo do mod abre no lugar.
    /// </summary>
    public static class TelaDeMapas
    {
        static GameObject _tela;
        static Transform _grade;
        static GameObject _vazio;
        static TMP_Text _textoVazio;
        static readonly List<GameObject> _fichas = new List<GameObject>();
        static readonly List<Button> _abas = new List<Button>();
        static Button _modeloBotao;
        static int _aba;
        static bool _falhou;
        static GameObject _bandejaAberta;
        const float Escala = 0.8f;
        // v241: os pacotes que um mapa ou campanha pediu (destacados na aba Pacotes) e quem pediu
        static readonly List<Acervo.Requisito> _pedidos = new List<Acervo.Requisito>();
        static string _pedidosPor;

        public static bool Aberta => _tela != null && _tela.activeSelf;

        static TitlesceneController Cena => SingletonBehaviour<TitlesceneController>.IsInitialized ? SingletonBehaviour<TitlesceneController>.Instance : null;

        /// <summary>Abre a tela; falso se nao deu (o painel antigo abre no lugar).</summary>
        public static bool Abrir()
        {
            if (_falhou) return false;
            try
            {
                if (!Montar()) { _falhou = true; return false; }
                ModoOneshot(false);
                // (v263: a tela abre na hora, com a lista que já havia; a leitura da pasta vai ao fundo e a lista se refaz quando ela acaba)
                PainelMapas.RelerAoFundo(() => { if (_tela != null && _tela.activeSelf && !_oneshot && _missao == null) Preencher(); });
                Preencher();
                var tc = Cena;
                tc.Titlescreen.Hide(true, t => Mostrar());
                return true;
            }
            catch (Exception ex) { Log.Erro("tela de mapas", ex); _falhou = true; return false; }
        }

        static void Mostrar()
        {
            if (_tela == null) return;
            _tela.SetActive(true);
            var cg = _tela.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 0f; cg.interactable = true; cg.blocksRaycasts = true; }
            try { Cena.MainCameraBlur.enabled = true; } catch { }
            Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null));
        }

        public static void Fechar()
        {
            if (_tela == null || !_tela.activeSelf) return; Som("UI_Click");
            var cg = _tela.GetComponent<CanvasGroup>();
            Nucleo.Instancia.StartCoroutine(Fade(cg, 0f, () => { _tela.SetActive(false); try { Cena.MainCameraBlur.enabled = false; Cena.Titlescreen.Show(true); } catch (Exception ex) { Log.Erro("voltando ao menu", ex); } }));
        }

        /// <summary>v267: a seta de voltar do jogo, no canto da tela: com um quadro do mod aberto (o oneshot, a lista de partidas,
        /// um aviso), fecha o quadro e volta ao menu, como o Voltar do primeiro quadro; durante a geracao de um mapa, espera.</summary>
        static void VoltarPelaSeta()
        {
            if (_gerandoOS) return;
            if (_bagagem != null) { FecharBagagem(); return; }   // (v271: a seta fecha só o quadro da bagagem, como o Voltar dele)
            _avisoOS = null; _descartar = null;
            if (_alerta != null) { UnityEngine.Object.Destroy(_alerta); _alerta = null; }
            if (_missao != null) FecharMissao();
            Fechar();
        }

        static IEnumerator Fade(CanvasGroup cg, float alvo, Action fim)
        {
            if (cg != null) { float de = cg.alpha, t = 0f; while (t < 0.35f) { t += Time.unscaledDeltaTime; cg.alpha = Mathf.Lerp(de, alvo, t / 0.35f); yield return null; } cg.alpha = alvo; }
            fim?.Invoke();
        }

        /// <summary>A cena de titulo saiu: a copia sai com ela (a proxima visita monta de novo).</summary>
        public static void Esquecer() { _bagagem = null; _titulo = null; _doMapas.Clear(); _oneshot = false; _missao = null; _alerta = null; _tela = null; _grade = null; _fichas.Clear(); _abas.Clear(); _modeloBotao = null; _vazio = null; _bandejaAberta = null; }

        /// <summary>Os sons dos botoes do proprio jogo (clique; "embarcar" ao jogar).</summary>
        static void Som(string ev) { try { Jogo.Persistente?.Audio?.PostEvent(ev); } catch { } }

        static string Metodo(Button b)
        {
            try { var e = b.onClick; for (int i = 0; i < e.GetPersistentEventCount(); i++) { var m = e.GetPersistentMethodName(i); if (!string.IsNullOrEmpty(m)) return m; } } catch { }
            return "";
        }

        static string Caminho(Transform t, Transform raiz)
        {
            var partes = new List<string>(); while (t != null && t != raiz) { partes.Insert(0, t.name); t = t.parent; }
            return string.Join("/", partes.ToArray());
        }

        static Transform Par(Transform original, Transform raizOriginal, Transform raizCopia)
        {
            if (original == null) return null; var c = Caminho(original, raizOriginal); return c.Length == 0 ? raizCopia : raizCopia.Find(c);
        }

        static void SemTraducao(GameObject go)
        {
            foreach (var c in go.GetComponents<Component>()) if (c != null && c.GetType().FullName != null && c.GetType().FullName.StartsWith("I2.Loc.", StringComparison.Ordinal)) UnityEngine.Object.DestroyImmediate(c);
        }

        static void Texto(TMP_Text t, string s) { if (t == null) return; SemTraducao(t.gameObject); t.text = s ?? ""; }

        static bool Montar()
        {
            if (_tela != null) return true;
            var tc = Cena; var lc = tc != null ? tc.CampaignLoad : null;
            if (lc == null || lc.SaveSlotPool == null || lc.SaveSlotPool.Prefab == null || lc.GridSlots == null) { Log.Info("tela de mapas: sem a tela de carregar campanha"); return false; }
            Retrato(lc.transform, lc.SaveSlotPool.Prefab.transform);
            // (a copia nasce desligada: nenhum script dela acorda antes de sair)
            bool estava = lc.gameObject.activeSelf; if (estava) lc.gameObject.SetActive(false);
            _tela = UnityEngine.Object.Instantiate(lc.gameObject, lc.transform.parent, false);
            if (estava) lc.gameObject.SetActive(true);
            _tela.name = "BigornaMapasDaComunidade"; var raiz = _tela.transform;
            _grade = Par(lc.GridSlots, lc.transform, raiz);
            foreach (var g in new Component[] { lc.CanvasLoadBackupWarning, lc.CanvasDeleteSlotWarning, lc.CanvasAddProductsToSave, lc.CanvasMissingProducts })
                if (g != null) Par(g.transform, lc.transform, raiz)?.gameObject.SetActive(false);
            foreach (var g in new GameObject[] { lc.OverlayDeleteSyncing, lc.CanvasEditSaveSlot, lc.ButtonCreateEmptySlot, lc.ToggleDisplayGUID != null ? lc.ToggleDisplayGUID.gameObject : null })
                if (g != null) Par(g.transform, lc.transform, raiz)?.gameObject.SetActive(false);
            if (lc.PanelNoSaveSlots != null) { var v = Par(lc.PanelNoSaveSlots.transform, lc.transform, raiz); _vazio = v != null ? v.gameObject : null; _textoVazio = _vazio != null ? _vazio.GetComponentInChildren<TMP_Text>(true) : null; }
            // a logica do jogo sai da copia (a tela, o viveiro de fichas, as fichas que estivessem nela)
            foreach (var c in _tela.GetComponentsInChildren<MonoBehaviour>(true).Where(c => c is LoadCampaignController || c is PrefabPool || c is UISaveSlot).ToList()) UnityEngine.Object.DestroyImmediate(c);
            if (_grade == null) { Log.Info("tela de mapas: a grade não apareceu na cópia"); UnityEngine.Object.Destroy(_tela); _tela = null; return false; }
            for (int i = _grade.childCount - 1; i >= 0; i--) UnityEngine.Object.DestroyImmediate(_grade.GetChild(i).gameObject);
            // a area rolavel desce um pouco e encolhe embaixo: as abas (em cima) e as ferramentas (embaixo) ficam fora das fichas
            try { var sr = _grade.GetComponentInParent<ScrollRect>(true); var ra = sr != null ? sr.GetComponent<RectTransform>() : null; if (ra != null) { ra.sizeDelta = new Vector2(ra.sizeDelta.x, ra.sizeDelta.y - 150f); ra.anchoredPosition = new Vector2(ra.anchoredPosition.x, ra.anchoredPosition.y - 20f); } } catch (Exception ex) { Log.Info("tela de mapas: área das fichas " + ex.Message); }
            // um pouco menores, para caber mais
            var gl = _grade.GetComponent<GridLayoutGroup>();
            if (gl != null) { gl.cellSize *= Escala; gl.spacing *= Escala; }
            // o voltar
            foreach (var b in _tela.GetComponentsInChildren<Button>(true))
            {
                var m = Metodo(b);
                if (m == "OnBackClicked")
                {
                    b.onClick = new Button.ButtonClickedEvent(); b.onClick.AddListener(VoltarPelaSeta); if (_modeloBotao == null) _modeloBotao = b;
                    // (v267: a seta fica por cima dos quadros do mod, que cobrem a tela inteira; antes o toque nela caía no quadro)
                    try
                    {
                        var pai = b.GetComponentInParent<Canvas>();
                        var cv = b.gameObject.GetComponent<Canvas>() ?? b.gameObject.AddComponent<Canvas>(); cv.overrideSorting = true; cv.sortingOrder = (pai != null ? pai.sortingOrder : 0) + 100;
                        if (b.gameObject.GetComponent<GraphicRaycaster>() == null) b.gameObject.AddComponent<GraphicRaycaster>();
                    }
                    catch (Exception ex) { Log.Info("tela de mapas: a seta de voltar por cima: " + ex.Message); }
                }
            }
            // o titulo: o maior texto fora da grade e das janelas desligadas
            var titulo = _tela.GetComponentsInChildren<TMP_Text>(true).Where(t => t.gameObject.activeInHierarchy || EmCaminhoLigado(t.transform, raiz)).Where(t => !t.transform.IsChildOf(_grade) && (_vazio == null || !t.transform.IsChildOf(_vazio.transform)) && t.GetComponentInParent<Button>(true) == null)
                .OrderByDescending(t => t.fontSize).FirstOrDefault();
            if (titulo != null) Texto(titulo, T("Mapas da comunidade", "Community maps"));
            _titulo = titulo;
            MontarAbas(raiz, titulo);
            // (v258: o que o "Mapa oneshot" esconde, na mesma tela: as abas, as ferramentas, a area das fichas, o aviso de vazia)
            try { var sr = _grade.GetComponentInParent<ScrollRect>(true); if (sr != null) _doMapas.Add(sr.gameObject); } catch { }
            foreach (var n in new[] { "Bigorna abas", "Bigorna ferramentas" }) { var f = raiz.Find(n); if (f != null) _doMapas.Add(f.gameObject); }
            Log.Info("tela de mapas: montada (grade «" + _grade.name + "»" + (gl != null ? ", células " + gl.cellSize : "") + ", título «" + (titulo != null ? titulo.name : "?") + "», voltar «" + (_modeloBotao != null ? _modeloBotao.name : "?") + "»)");
            return true;
        }

        static bool EmCaminhoLigado(Transform t, Transform raiz) { while (t != null && t != raiz) { if (!t.gameObject.activeSelf) return false; t = t.parent; } return true; }

        /// <summary>As abas e as ferramentas: copias do botao "Sair" do menu do jogo (o mesmo texto e desenho dos botoes do menu),
        /// menores, em duas fileiras: as abas acima da grade, as ferramentas embaixo.</summary>
        static void MontarAbas(Transform raiz, TMP_Text titulo)
        {
            var sair = SingletonBehaviour<UITitlescreen>.IsInitialized ? SingletonBehaviour<UITitlescreen>.Instance.QuitButton : null;
            if (sair == null) return;
            GameObject Fileira(string nome, Vector2 ancora, float y)
            {
                var f = new GameObject(nome, typeof(RectTransform)); f.transform.SetParent(raiz, false);
                var r = f.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = ancora; r.pivot = new Vector2(0.5f, 0.5f); r.anchoredPosition = new Vector2(0f, y); r.sizeDelta = new Vector2(1500f, 60f);
                var h = f.AddComponent<HorizontalLayoutGroup>(); h.spacing = 18f; h.childAlignment = TextAnchor.MiddleCenter; h.childControlWidth = false; h.childControlHeight = false; h.childForceExpandWidth = false; h.childForceExpandHeight = false;
                return f;
            }
            Button Botao(GameObject fileira, string texto, Action acao)
            {
                var go = UnityEngine.Object.Instantiate(sair.gameObject, fileira.transform, false); go.name = "Bigorna " + texto; go.SetActive(true);
                foreach (var c in go.GetComponentsInChildren<Component>(true)) if (c != null && c.GetType().FullName != null && c.GetType().FullName.StartsWith("I2.Loc.", StringComparison.Ordinal)) UnityEngine.Object.DestroyImmediate(c);
                foreach (var et in go.GetComponentsInChildren<UnityEngine.EventSystems.EventTrigger>(true)) et.triggers.Clear();
                var le = go.GetComponent<LayoutElement>(); if (le != null) le.ignoreLayout = false;
                var cg = go.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 1f; cg.interactable = true; cg.blocksRaycasts = true; }
                go.transform.localScale = Vector3.one * 0.62f;
                var b = go.GetComponent<Button>(); b.onClick = new Button.ButtonClickedEvent(); b.onClick.AddListener(() => { Som("UI_Click"); acao(); }); b.interactable = true;
                Texto(go.GetComponentInChildren<TMP_Text>(true), texto);
                return b;
            }
            float yAbas = titulo != null ? -150f : -120f;
            var cima = Fileira("Bigorna abas", new Vector2(0.5f, 1f), yAbas);
            _abas.Clear();
            _abas.Add(Botao(cima, T("Campanhas", "Campaigns"), () => { _aba = 0; Preencher(); }));
            _abas.Add(Botao(cima, T("Mapas avulsos", "Standalone maps"), () => { _aba = 1; Preencher(); }));
            _abas.Add(Botao(cima, T("Mapas oficiais", "Official maps"), () => { _aba = 2; MapasOficiais.Reler(); Preencher(); }));
            // o acervo (como no Valkyrie): mapas e campanhas para baixar; pacotes da Oficina que os mapas exigem
            _abas.Add(Botao(cima, T("Baixar mapas", "Download maps"), () => { _aba = 3; LerAcervo(); }));
            _abas.Add(Botao(cima, T("Pacotes", "Packages"), () => { _aba = 4; _pedidos.Clear(); LerAcervo(); }));
            // (v241: o indice lido em segundo plano, para a aba Pacotes dizer se ha atualizacao)
            if (!Acervo.Acervo.Leu && !Acervo.Acervo.Lendo) Nucleo.Instancia.StartCoroutine(Acervo.Acervo.LerIndice(() => { if (_tela != null) Preencher(); }));
            var baixo = Fileira("Bigorna ferramentas", new Vector2(0.5f, 0f), 60f);
            Botao(baixo, T("Abrir pasta", "Open folder"), PainelMapas.AbrirAPasta);
            if (Dados.DadosDoEditor.EditorInstalado) Botao(baixo, T("Abrir editor", "Open editor"), Dados.DadosDoEditor.AbrirEditor);
            Botao(baixo, T("Relatar um problema", "Report a problem"), () => { Nucleo.Visivel = true; Relatos.Alternar(); });
        }

        /// <summary>As fichas da aba: uma por campanha ou mapa avulso, do modelo das partidas gravadas.</summary>
        static void Preencher()
        {
            if (_tela == null || _grade == null) return;
            foreach (var f in _fichas) if (f != null) UnityEngine.Object.Destroy(f);
            _fichas.Clear(); _bandejaAberta = null;
            var lc = Cena?.CampaignLoad; var modelo = lc?.SaveSlotPool?.Prefab; if (modelo == null) return;
            for (int i = 0; i < _abas.Count; i++) { var t = _abas[i].GetComponentInChildren<TMP_Text>(true); if (t != null) t.alpha = i == _aba ? 1f : 0.55f; }
            // (v241: atualizacoes de pacotes, no nome da aba: discreto)
            if (_abas.Count > 4) { int nAt = Acervo.Acervo.AtualizacoesDePacotes(); Texto(_abas[4].GetComponentInChildren<TMP_Text>(true), T("Pacotes", "Packages") + (nAt > 0 ? " (" + nAt + (nAt == 1 ? T(" atualização", " update") : T(" atualizações", " updates")) + ")" : "")); }
            int n = 0;
            if (_aba == 0)
                foreach (var c in PainelMapas.Campanhas)
                {
                    var p = PainelMapas.ProgressoDe(c); bool comecada = p.Completados.Count > 0;
                    // (com uma partida em andamento: "Continuar campanha" carrega a partida dela, com o grupo dela; as partidas
                    //  das campanhas da comunidade ficam fora da tela "Carregar campanha" do jogo)
                    var andamento = Campanha.SavesDaComunidade.EmAndamento(c);
                    var resumo = c.Nos.Count(x => x.EhMapa) + T(" mapa(s)", " map(s)") + (comecada ? " · " + p.Completados.Count + T(" concluído(s)", " done") : "") + (andamento != null ? T(" · em andamento", " · in progress") : "");
                    // (v241: sem os pacotes que ela exige, a campanha leva ate eles)
                    var faltamC = c.PacotesFaltando ?? new List<Acervo.Requisito>();
                    if (faltamC.Count > 0)
                    {
                        Ficha(++n, c.NomeVisivel, resumo + T(" · falta pacote", " · package missing"), PainelMapas.AlteradoEm(c), c.Metadados?.Autor, AtoExigido.Ato2(c) ? Act.ActII : Act.ActI,
                            T("Baixar pacote", "Get the package"), () => IrParaPacotes(faltamC, c.NomeVisivel), null, null, Acervo.Acervo.TextoFaltam(faltamC));
                        continue;
                    }
                    Action recomecar = () => { _paginaSaves = 0; AbrirSaves(c.NomeVisivel + T(" · recomeçar", " · restart"), () => Lancou(Campanha.Campanha.Comecar(c, true)), s => Lancou(Campanha.Campanha.Comecar(c, true, s))); };
                    string principal, outro, detalhe = null; Action aoPrincipal, aoOutro;
                    if (andamento != null)
                    {
                        int ranhura = andamento.Value.Key; var info = andamento.Value.Value;
                        principal = T("Continuar campanha", "Continue campaign"); aoPrincipal = () => Lancou(Campanha.SavesDaComunidade.Continuar(ranhura, c.NomeVisivel));
                        outro = T("Recomeçar…", "Restart…"); aoOutro = recomecar;
                        detalhe = T("Em andamento com o grupo «", "In progress with the party “") + info.PartyName + T("»", "”") + (info.Timestamp > 0 ? " · " + DataHora(new DateTime(info.Timestamp)) : "")
                            + T(". «Recomeçar» começa de novo, com um grupo novo ou com os seus heróis.", ". “Restart” starts over, with a new party or with your heroes.");
                    }
                    else if (comecada) { principal = T("Continuar", "Continue"); aoPrincipal = () => Lancou(Campanha.Campanha.Comecar(c, false)); outro = T("Recomeçar…", "Restart…"); aoOutro = recomecar; }
                    else
                    {
                        principal = T("Grupo novo", "New party"); aoPrincipal = () => Lancou(Campanha.Campanha.Comecar(c, false));
                        outro = T("Usar meus heróis", "Use my heroes"); aoOutro = () => { _paginaSaves = 0; AbrirSaves(c.NomeVisivel, null, s => Lancou(Campanha.Campanha.Comecar(c, false, s))); };
                        detalhe = Encontro.GrupoDoSave.TextoCurto;
                    }
                    Ficha(++n, c.NomeVisivel, resumo, PainelMapas.AlteradoEm(c), c.Metadados?.Autor, AtoExigido.Ato2(c) ? Act.ActII : Act.ActI, principal, aoPrincipal, outro, aoOutro,
                        detalhe, c.Linguas.Count > 1 ? string.Join(",", c.Linguas.ToArray()) : null, c.LinguaEmUso, c.Linguas.Count > 1 ? EscolherLingua(c.Caminho) : null);
                }
            else if (_aba == 1)
                foreach (var m in PainelMapas.Mapas)
                {
                    var faltamM = m.PacotesFaltando ?? new List<Acervo.Requisito>();
                    if (faltamM.Count > 0)
                    {
                        Ficha(++n, m.NomeVisivel, m.Resumo(T) + T(" · falta pacote", " · package missing"), PainelMapas.AlteradoEm(m), m.Metadados?.Autor, AtoExigido.Ato2(m) ? Act.ActII : Act.ActI,
                            T("Baixar pacote", "Get the package"), () => IrParaPacotes(faltamM, m.NomeVisivel), null, null, Acervo.Acervo.TextoFaltam(faltamM));
                        continue;
                    }
                    Ficha(++n, m.NomeVisivel, m.Resumo(T), PainelMapas.AlteradoEm(m), m.Metadados?.Autor, AtoExigido.Ato2(m) ? Act.ActII : Act.ActI, T("Grupo novo", "New party"), () => { var e = Lancador.Lancar(m); Lancou(e); },
                        T("Usar meus heróis", "Use my heroes"), () => { _paginaSaves = 0; AbrirSaves(m.NomeVisivel, null, s => Lancou(Lancador.Lancar(m, s))); },
                        Encontro.GrupoDoSave.TextoCurto, m.Linguas.Count > 1 ? string.Join(",", m.Linguas.ToArray()) : null, m.LinguaEmUso, m.Linguas.Count > 1 ? EscolherLingua(m.Caminho) : null);
                }
            else if (_aba == 3 || _aba == 4)
                n = FichasDoAcervo(_aba == 4);
            else
                foreach (var q in MapasOficiais.Lista())
                {
                    // (na ficha, so o comeco, numa linha; selecionada, a bandeja mostra o texto inteiro ao lado do botao)
                    var d = MapasOficiais.Descricao(q); var tipo = q.Type == QuestModel.QuestType.Side ? T("Secundária", "Side quest") : T("Missão", "Quest");
                    var curto = d.Length > 34 ? d.Substring(0, 32).TrimEnd() + "…" : d;
                    Ficha(++n, MapasOficiais.Nome(q), string.IsNullOrEmpty(d) ? tipo : tipo + " · " + curto, DateTime.MinValue, null, q.Act, T("Escolher", "Choose"), () => AbrirMissao(q), null, null, string.IsNullOrEmpty(d) ? null : d);
                }
            if (_vazio != null)
            {
                _vazio.SetActive(n == 0);
                if (n == 0 && _aba >= 3) Texto(_textoVazio, Acervo.Acervo.Lendo || !Acervo.Acervo.Leu ? T("Consultando o acervo…", "Asking the community library…") : Acervo.Acervo.SemConexao ? T("Sem conexão com o acervo. Confira a internet e toque na aba de novo.", "No connection to the community library. Check the internet and tap the tab again.")
                                                     : _aba == 3 ? T("O acervo ainda não tem mapas.", "The community library has no maps yet.") : T("O acervo ainda não tem pacotes.", "The community library has no packages yet."));
                else if (n == 0 && _aba < 2 && !PainelMapas.JaLida) Texto(_textoVazio, T("Lendo a pasta de mapas…", "Reading the maps folder…"));   // (v263: a primeira leitura, ao fundo)
                else if (n == 0) Texto(_textoVazio, _aba == 2 ? T("Nenhuma missão do jogo encontrada na sua coleção.", "No game quests found in your collection.") : _aba == 0 ? T("Nenhuma campanha na pasta de mapas. No editor, «Iniciar campanha» e depois «Exportar campanha».", "No campaigns in the maps folder. In the editor, use “Start a campaign” and then “Export campaign”.")
                                                     : T("Nenhum mapa avulso na pasta de mapas. Exporte um mapa no editor.", "No standalone maps in the maps folder. Export a map in the editor."));
            }
        }

        // ------------------------------------------------ o acervo
        /// <summary>Le o indice do acervo de novo (a cada toque na aba) e refaz as fichas quando chegar.</summary>
        static void LerAcervo()
        {
            Preencher();
            Nucleo.Instancia.StartCoroutine(Acervo.Acervo.LerIndice(() => { if (_tela != null && (_aba == 3 || _aba == 4)) Preencher(); }));
        }

        static readonly HashSet<string> _confirmarRemocao = new HashSet<string>();

        static DateTime DataDa(Acervo.Ficha f)
        {
            DateTime d; var t = f.Publicado ?? f.Data;
            return !string.IsNullOrEmpty(t) && DateTime.TryParseExact(t.Length > 10 ? t.Substring(0, 10) : t, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out d) ? d : DateTime.MinValue;
        }


        /// <summary>As fichas do acervo: os mapas e campanhas (aba 3) ou os pacotes (aba 4), primeiro os da lingua de quem joga.</summary>
        static int FichasDoAcervo(bool pacotes)
        {
            var L = Acervo.Acervo.Itens.Where(f => f.EhPacote == pacotes)
                .OrderByDescending(f => pacotes && _pedidos.Any(q => q.Id == f.Id)).ThenByDescending(f => (f.Lingua ?? "").Contains(Codigo)).ThenByDescending(DataDa).ToList();
            int n = 0;
            // (v241: um pacote pedido que o acervo nao tem: a ficha diz, e a quem perguntar)
            if (pacotes) foreach (var q in _pedidos.Where(q => !L.Any(f => f.Id == q.Id)).ToList())
                Ficha(++n, q.Nome ?? q.Id, T("Pacote · não está no acervo", "Package · not in the community library"), DateTime.MinValue, null, Act.ActI, T("Indisponível", "Unavailable"), () => { }, null, null,
                    T("«", "“") + (_pedidosPor ?? "") + T("» precisa dele (edição ", "” needs it (edition ") + q.Edicao + T("), mas o acervo não o tem. Peça o pacote a quem fez o mapa: com o arquivo dele na pasta Pacotes, o mapa abre.", "), but the community library does not have it. Ask the map's author for the package: with its file in the Pacotes folder, the map opens."));
            foreach (var f in L)
            {
                int tem = Acervo.Acervo.Instalada(f);
                var faltam = pacotes ? new List<Acervo.Requisito>() : Acervo.Acervo.PacotesParaBaixar(f);
                Acervo.Acervo.Situacao.TryGetValue(f.Id, out var sit); bool ocupado = sit != null && sit.EndsWith("…");
                string tipo = f.Tipo == "campanha" ? T("Campanha", "Campaign") + (f.Conteudo?["mapas"] != null ? " · " + (int)f.Conteudo["mapas"] + T(" mapa(s)", " map(s)") : "")
                            : f.Tipo == "mapa" ? T("Mapa", "Map") : T("Pacote", "Package") + (f.Conteudo?["entradas"] != null ? " · " + (int)f.Conteudo["entradas"] + T(" entrada(s)", " entries") : "");
                var partes = new List<string> { tipo };
                bool pedido = pacotes && _pedidos.Any(q => q.Id == f.Id);
                if (pedido) partes.Insert(0, T("necessário", "needed"));
                if (tem > 0) partes.Add(tem < f.Edicao ? T("atualização disponível: edição ", "update available: edition ") + f.Edicao : T("instalado", "installed"));
                if (!pacotes && f.Requer.Count > 0) partes.Add(T("precisa de ", "needs ") + f.Requer.Count + T(" pacote(s)", " package(s)"));
                // o texto inteiro, na bandeja: o resumo, os pacotes exigidos, o que esta acontecendo
                var det = new List<string>();
                if (!string.IsNullOrEmpty(f.Resumo)) det.Add(f.Resumo);
                if (!pacotes && f.Requer.Count > 0) det.Add(T("Precisa de: ", "Needs: ") + string.Join(", ", f.Requer.Select(q => (q.Nome ?? q.Id) + (Acervo.Pacotes.EdicaoInstalada(q.Id) >= q.Edicao ? T(" (instalado)", " (installed)") : "")).ToArray()));
                if (pacotes) { var quem = Acervo.Acervo.QuemExige(f.Id); if (quem.Count > 0) det.Add(T("Usado por: ", "Used by: ") + string.Join(", ", quem.ToArray())); }
                det.Add(T("Edição ", "Edition ") + f.Edicao + (tem > 0 && tem < f.Edicao ? T(" (você tem a ", " (you have ") + tem + ")" : ""));
                if (sit != null) det.Insert(0, sit);
                if (pedido) det.Insert(0, T("«", "“") + (_pedidosPor ?? "") + T("» precisa deste pacote: baixe-o e volte para jogar.", "” needs this package: download it, then go back to play."));
                if (!pacotes && faltam.Count > 0 && !ocupado) det.Insert(0, T("Antes, baixe ", "First, download ") + (faltam.Count == 1 ? T("o pacote ", "the package ") : T("os pacotes ", "the packages ")) + string.Join(", ", faltam.Select(q => T("«", "“") + (q.Nome ?? q.Id) + T("»", "”")).ToArray()) + T(", na aba Pacotes.", ", in the Packages tab."));
                if (_confirmarRemocao.Contains(f.Id)) det.Insert(0, T("Toque em Remover de novo para confirmar.", "Tap Remove again to confirm."));
                string principal; Action acao;
                if (ocupado) { principal = sit; acao = () => { }; }
                else if (faltam.Count > 0) { var fl = faltam; principal = fl.Count == 1 ? T("Ver o pacote", "See the package") : T("Ver os pacotes", "See the packages"); acao = () => IrParaPacotes(fl, f.Nome ?? f.Id); }   // (v241: os pacotes antes)
                else if (tem == 0) { principal = T("Baixar", "Download"); acao = () => Baixar(f); }
                else if (tem < f.Edicao) { principal = T("Atualizar", "Update"); acao = () => Baixar(f); }
                else if (!pacotes) { principal = T("Jogar", "Play"); acao = () => JogarDoAcervo(f); }
                else { principal = T("Instalado", "Installed"); acao = () => { }; }
                bool doAcervo = Acervo.Acervo.Registro.EdicaoDe(f.Id) > 0;
                Ficha(++n, f.Nome ?? f.Id, string.Join(" · ", partes.ToArray()), DataDa(f), f.Autor, f.Ato >= 2 ? Act.ActII : Act.ActI, principal, acao,
                    doAcervo && !ocupado ? T("Remover", "Remove") : null, doAcervo && !ocupado ? (Action)(() => RemoverDoAcervo(f)) : null, string.Join("\n", det.ToArray()), f.Lingua);
            }
            return n;
        }

        /// <summary>v241: a aba Pacotes, com os pacotes que um mapa ou campanha pediu em primeiro, destacados.</summary>
        static void IrParaPacotes(List<Acervo.Requisito> faltam, string quem)
        {
            _pedidos.Clear(); _pedidos.AddRange(faltam ?? new List<Acervo.Requisito>()); _pedidosPor = quem; _aba = 4; LerAcervo();
        }

        static void Baixar(Acervo.Ficha f) { _confirmarRemocao.Clear(); Nucleo.Instancia.StartCoroutine(Acervo.Acervo.Baixar(f, () => { if (_tela != null && _aba >= 3) { PainelMapas.Reler(); Preencher(); } })); }

        static void RemoverDoAcervo(Acervo.Ficha f)
        {
            if (!_confirmarRemocao.Contains(f.Id)) { _confirmarRemocao.Clear(); _confirmarRemocao.Add(f.Id); Preencher(); return; }
            _confirmarRemocao.Clear(); Acervo.Acervo.Remover(f); PainelMapas.Reler(); Preencher();
        }

        /// <summary>"Jogar" numa ficha do acervo: a campanha ou o mapa que ela instalou, como nas abas de cima.</summary>
        static void JogarDoAcervo(Acervo.Ficha f)
        {
            PainelMapas.Reler();
            Acervo.Acervo.Registro.Itens.TryGetValue(f.Id, out var it); var pasta = it?.Pasta ?? "";
            if (f.Tipo == "campanha")
            {
                var c = PainelMapas.Campanhas.FirstOrDefault(x => string.Equals(x.Pasta.TrimEnd('/', '\\'), pasta.TrimEnd('/', '\\'), StringComparison.OrdinalIgnoreCase));
                if (c == null) { Lancou(T("A campanha baixada não apareceu na pasta de mapas.", "The downloaded campaign is not in the maps folder.")); return; }
                // (a escolha: continuar a partida em andamento, grupo novo ou os seus heróis)
                var andamento = Campanha.SavesDaComunidade.EmAndamento(c); int ranhura = andamento?.Key ?? -1; _paginaSaves = 0;
                AbrirSaves(c.NomeVisivel, () => Lancou(Campanha.Campanha.Comecar(c, false)), s => Lancou(Campanha.Campanha.Comecar(c, false, s)),
                    andamento != null ? (Action)(() => Lancou(Campanha.SavesDaComunidade.Continuar(ranhura, c.NomeVisivel))) : null);
            }
            else
            {
                var m = PainelMapas.Mapas.FirstOrDefault(x => string.Equals(Path.GetDirectoryName(x.Caminho ?? "")?.TrimEnd('/', '\\'), pasta.TrimEnd('/', '\\'), StringComparison.OrdinalIgnoreCase));
                if (m == null) { Lancou(T("O mapa baixado não apareceu na pasta de mapas.", "The downloaded map is not in the maps folder.")); return; }
                _paginaSaves = 0; AbrirSaves(m.NomeVisivel, () => Lancou(Lancador.Lancar(m)), s => Lancou(Lancador.Lancar(m, s)));
            }
        }

        // ------------------------------------------------ a missao oficial: nivel e herois
        // Um quadro do proprio jogo (o de "editar partida gravada": fundo, titulo, divisorias, botoes e fontes do jogo), maior,
        // por cima da grade: o nome e a descricao da missao, os quatro niveis, os herois da colecao (os que a missao exige vem
        // marcados e presos) e, embaixo, voltar e jogar.
        static GameObject _missao;
        static int _nivel = 1;
        static readonly HashSet<string> _grupo = new HashSet<string>();
        static readonly DifficultySetting[] Niveis = { DifficultySetting.Journey, DifficultySetting.Standard, DifficultySetting.Heroic, DifficultySetting.Warfare };
        static string[] NomesDosNiveis => new[] { T("Fácil", "Easy"), T("Normal", "Normal"), T("Difícil", "Hard"), T("Brutal", "Brutal") };

        static Transform Achar(Transform raiz, string nome)
        {
            if (raiz == null) return null; if (raiz.name == nome) return raiz;
            for (int i = 0; i < raiz.childCount; i++) { var r = Achar(raiz.GetChild(i), nome); if (r != null) return r; }
            return null;
        }

        static GameObject Copia(Transform modelo, Transform pai, string nome)
        {
            var go = UnityEngine.Object.Instantiate(modelo.gameObject, pai, false); go.name = "Bigorna " + nome; go.SetActive(true);
            foreach (var c in go.GetComponentsInChildren<Component>(true)) if (c != null && c.GetType().FullName != null && c.GetType().FullName.StartsWith("I2.Loc.", StringComparison.Ordinal)) UnityEngine.Object.DestroyImmediate(c);
            foreach (var b in go.GetComponentsInChildren<Button>(true)) b.onClick = new Button.ButtonClickedEvent();
            return go;
        }

        static void FecharMissao()
        {
            if (_missao == null) return; Som("UI_Click");
            var go = _missao; _missao = null; var cg = go.GetComponent<CanvasGroup>();
            Nucleo.Instancia.StartCoroutine(Fade(cg, 0f, () => UnityEngine.Object.Destroy(go)));
        }

        static void AbrirMissao(QuestModel q)
        {
            try
            {
                if (_missao != null) UnityEngine.Object.Destroy(_missao);
                var raiz = _tela.transform;
                var editar = Achar(raiz, "Canvas_EditSaveSlot"); var aviso = Achar(raiz, "Canvas_LoadBackupWarning");
                if (editar == null) { Log.Info("missão oficial: sem o quadro do jogo; painel do mod"); Fechar(); PainelMapas.AbrirNaAba(2); return; }
                _missao = Copia(editar, raiz, "missão oficial");
                var fundoBtn = _missao.GetComponent<Button>(); if (fundoBtn != null) fundoBtn.onClick.AddListener(FecharMissao);   // (tocar fora do quadro: volta)
                var cg = _missao.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 0f; cg.interactable = true; cg.blocksRaycasts = true; }
                var bg = Achar(_missao.transform, "Image_BG") as RectTransform; if (bg == null) throw new Exception("sem Image_BG");
                bg.sizeDelta = new Vector2(1260f, 860f); bg.anchoredPosition = Vector2.zero;
                var bgBtn = bg.gameObject.AddComponent<Button>(); bgBtn.transition = Selectable.Transition.None;   // (tocar no quadro nao fecha)
                var titulo = Achar(bg, "Text_PartyName"); var tituloT = titulo != null ? titulo.GetComponent<TMP_Text>() : null;
                if (titulo != null) { var r = titulo as RectTransform; r.sizeDelta = new Vector2(1150f, 56f); r.anchoredPosition = new Vector2(0f, -60f); }
                Texto(tituloT, MapasOficiais.Nome(q));
                var opcoes = Achar(bg, "Layout_Options");
                var rotuloModelo = Achar(opcoes, "Label_RestoreDesc"); var botaoModelo = Achar(opcoes, "Button_Restore"); var divisoria = Achar(opcoes, "Imade_Divider");
                if (opcoes != null) opcoes.gameObject.SetActive(false);
                if (rotuloModelo == null || botaoModelo == null) throw new Exception("sem os modelos de texto e botão");

                // o conteudo, em coluna
                var col = new GameObject("Bigorna coluna", typeof(RectTransform)); col.transform.SetParent(bg, false);
                var rc = col.GetComponent<RectTransform>(); rc.anchorMin = new Vector2(0f, 0f); rc.anchorMax = new Vector2(1f, 1f); rc.offsetMin = new Vector2(70f, 150f); rc.offsetMax = new Vector2(-70f, -110f);
                var v = col.AddComponent<VerticalLayoutGroup>(); v.spacing = 12f; v.childAlignment = TextAnchor.UpperCenter; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
                TMP_Text Linha(string texto, float altura, float tamanho, TextAlignmentOptions alinhar)
                {
                    var go = Copia(rotuloModelo, col.transform, "texto"); var t = go.GetComponent<TMP_Text>(); Texto(t, texto);
                    t.fontSize = tamanho; t.enableAutoSizing = false; t.alignment = alinhar; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Ellipsis;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    return t;
                }
                void Divisoria() { if (divisoria == null) return; var go = Copia(divisoria, col.transform, "divisória"); var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = 4f; le.minHeight = 4f; }
                Button Botao(Transform pai, string texto, Vector2 tam, Action acao)
                {
                    var go = Copia(botaoModelo, pai, texto); var r = go.GetComponent<RectTransform>(); r.sizeDelta = tam;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = tam.x; le.preferredHeight = tam.y;
                    foreach (var dd in go.GetComponentsInChildren<TMP_Dropdown>(true)) dd.gameObject.SetActive(false);
                    var t = go.GetComponentInChildren<TMP_Text>(true); if (t != null) { Texto(t, texto); t.enableAutoSizing = true; t.fontSizeMin = 14f; t.fontSizeMax = 26f; }
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); acao(); }); b.interactable = true;
                    if (go.GetComponent<CanvasGroup>() == null) go.AddComponent<CanvasGroup>();
                    return b;
                }
                void Marcar(Button b, bool sim, bool preso = false) { var c = b.GetComponent<CanvasGroup>(); if (c != null) c.alpha = sim ? 1f : 0.45f; b.interactable = !preso; }
                GameObject Fileira(float altura, bool grade)
                {
                    var go = new GameObject("Bigorna fileira", typeof(RectTransform)); go.transform.SetParent(col.transform, false);
                    var le = go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    if (grade) { var g = go.AddComponent<GridLayoutGroup>(); g.cellSize = new Vector2(250f, 58f); g.spacing = new Vector2(14f, 10f); g.childAlignment = TextAnchor.UpperCenter; g.constraint = GridLayoutGroup.Constraint.FixedColumnCount; g.constraintCount = 4; }
                    else { var h = go.AddComponent<HorizontalLayoutGroup>(); h.spacing = 16f; h.childAlignment = TextAnchor.MiddleCenter; h.childControlWidth = false; h.childControlHeight = false; h.childForceExpandWidth = false; h.childForceExpandHeight = false; }
                    return go;
                }

                var desc = MapasOficiais.Descricao(q);
                Linha(string.IsNullOrEmpty(desc) ? (q.Type == QuestModel.QuestType.Side ? T("Missão secundária.", "Side quest.") : T("Missão da campanha.", "Campaign quest.")) : desc, 96f, 24f, TextAlignmentOptions.Center);
                Divisoria();
                Linha(T("Nível", "Difficulty"), 40f, 30f, TextAlignmentOptions.Center);
                var niveis = Fileira(66f, false); var bn = new List<Button>();
                for (int i = 0; i < 4; i++) { int k = i; bn.Add(Botao(niveis.transform, NomesDosNiveis[i], new Vector2(230f, 58f), () => { _nivel = k; for (int j = 0; j < bn.Count; j++) Marcar(bn[j], j == _nivel); })); }
                for (int j = 0; j < bn.Count; j++) Marcar(bn[j], j == _nivel);
                Divisoria();
                var exigidos = MapasOficiais.Exigidos(q); var herois = MapasOficiais.Herois();
                _grupo.RemoveWhere(id => !herois.Any(h => h.Id == id)); foreach (var id in exigidos) _grupo.Add(id);
                var contagem = Linha("", 40f, 30f, TextAlignmentOptions.Center);
                void Contar() { Texto(contagem, T("Heróis", "Heroes") + "  (" + _grupo.Count + T(" de 2 a 4)", " of 2 to 4)") + (exigidos.Count > 0 ? T("  ★ exigido pela missão", "  ★ required by the quest") : "")); }
                int linhas = Mathf.Max(1, Mathf.CeilToInt(herois.Count / 4f));
                var grade = Fileira(Mathf.Min(4, linhas) * 68f, true); var bh = new Dictionary<string, Button>();
                Button jogar = null;
                void Atualizar() { foreach (var kv in bh) Marcar(kv.Value, _grupo.Contains(kv.Key), exigidos.Contains(kv.Key)); Contar(); if (jogar != null) { jogar.interactable = _grupo.Count >= 2 && _grupo.Count <= 4; var c2 = jogar.GetComponent<CanvasGroup>(); if (c2 != null) c2.alpha = jogar.interactable ? 1f : 0.45f; } }
                foreach (var h in herois)
                {
                    var id = h.Id;
                    bh[id] = Botao(grade.transform, (exigidos.Contains(id) ? "★ " : "") + MapasOficiais.NomeHeroi(h), new Vector2(250f, 58f), () => { if (_grupo.Contains(id)) _grupo.Remove(id); else if (_grupo.Count < 4) _grupo.Add(id); Atualizar(); });
                }

                // embaixo: voltar e jogar, os botoes do aviso do jogo
                var cancelar = aviso != null ? Achar(aviso, "Button_Cancel") : null; var seguir = aviso != null ? Achar(aviso, "Button_Proceed") : null;
                Button Embaixo(Transform modelo, string texto, Vector2 pos, Action acao)
                {
                    var go = modelo != null ? Copia(modelo, bg, texto) : Copia(botaoModelo, bg, texto);
                    var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(pos.x < 0 ? 1f : 0f, 0f); r.anchoredPosition = pos; r.sizeDelta = new Vector2(280f, 90f);
                    Texto(go.GetComponentInChildren<TMP_Text>(true), texto);
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => acao()); b.interactable = true;
                    if (go.GetComponent<CanvasGroup>() == null) go.AddComponent<CanvasGroup>();
                    return b;
                }
                Embaixo(cancelar, T("Voltar", "Back"), new Vector2(220f, 80f), FecharMissao);
                jogar = Embaixo(seguir, T("Jogar", "Play"), new Vector2(-220f, 80f), () =>
                {
                    if (_grupo.Count < 2 || _grupo.Count > 4) return;
                    Som("UI_Embark");
                    var grupo = herois.Where(h => _grupo.Contains(h.Id)).ToList();
                    Log.Info("«Jogar» mapa oficial " + q.Id + " (" + NomesDosNiveis[_nivel] + ", " + grupo.Count + " heróis)");
                    var erro = MapasOficiais.Jogar(q, grupo, Niveis[Mathf.Clamp(_nivel, 0, 3)]);
                    if (erro == null) { var go = _missao; _missao = null; if (go != null) UnityEngine.Object.Destroy(go); _avisoOS = null; _gerado = null; _verSimulacao = false; }   // (v268: o mapa jogado sai do quadro: na volta, Gerar; o mesmo mapa, pela semente)
                    Lancou(erro);
                });
                Atualizar();
                _missao.transform.SetAsLastSibling();
                if (cg != null) Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null));
                Log.Info("missão oficial: quadro de " + q.Id + " (" + herois.Count + " heróis na coleção, " + exigidos.Count + " exigido(s))");
            }
            catch (Exception ex) { Log.Erro("missão oficial", ex); if (_missao != null) UnityEngine.Object.Destroy(_missao); _missao = null; Fechar(); PainelMapas.AbrirNaAba(2); }
        }

        // ------------------------------------------------ v258: o "Mapa oneshot"
        // A mesma tela, sem as abas e as fichas, com o titulo "Mapa oneshot". Primeiro a equipe (o quadro das partidas
        // gravadas: equipe nova, ou a de uma partida gravada); depois o quadro do mapa, do mesmo modelo do quadro da missao
        // oficial: a duracao e a dificuldade (as caixas vem da colecao do jogo), Gerar, a semente, a simulacao (2, 3 e 4
        // herois, como no editor) e Jogar. Nada de previa do mapa. No fim do mapa, a partida gravada de onde veio a equipe pode
        // receber o que ela ganhou (a pergunta de sempre do "Usar meus herois").
        static bool _oneshot;
        static TMP_Text _titulo;
        static readonly List<GameObject> _doMapas = new List<GameObject>();
        static Encontro.GrupoDoSave.Save _equipe;
        static int _duracaoOS = 1, _dificuldadeOS = 1;
        /// <summary>v272: com equipe nova e o Ato II na coleção, a caixa «Usar o Ato II» (marcada de início): desmarcada, o mapa sai
        /// só com o Ato I. v285: também com uma equipe gravada (a dificuldade cuida do equilíbrio).</summary>
        static bool _usarAto2 = true;
        static int AtosEscolhidos() { int a = Oneshot.Atos(); return a == 2 && !_usarAto2 ? 1 : a; }   // (v285: com equipe nova ou gravada)
        static string _sementeDigitada = "", _avisoOS;
        static Oneshot.Resultado _gerado;
        static bool _gerandoOS, _verSimulacao;

        static void ModoOneshot(bool sim)
        {
            _oneshot = sim;
            if (_titulo != null) Texto(_titulo, sim ? T("Mapa oneshot", "One-shot map") : T("Mapas da comunidade", "Community maps"));
            foreach (var go in _doMapas) if (go != null) go.SetActive(!sim);
            if (sim && _vazio != null) _vazio.SetActive(false);
        }

        /// <summary>O botao "Mapa oneshot" do menu: a tela no modo do mapa gerado, na escolha da equipe.</summary>
        public static bool AbrirOneshot()
        {
            if (_falhou) return false;
            try
            {
                if (!Montar()) { _falhou = true; return false; }
                ModoOneshot(true);
                // (v265: com partidas em andamento, primeiro a pergunta se alguma continua)
                Cena.Titlescreen.Hide(true, t => { Mostrar(); _descartar = null; if (Encontro.Retomada.Partidas().Count > 0) DialogoAndamentos(true); else EscolherEquipe(); });
                return true;
            }
            catch (Exception ex) { Log.Erro("mapa oneshot", ex); return false; }
        }

        static void SairDoOneshot() { if (_gerandoOS) return; _avisoOS = null; FecharMissao(); Fechar(); }
        /// <summary>Voltar da escolha da equipe: as partidas em andamento, se houver; senao, o menu.</summary>
        static void VoltarDoOneshot() { if (_gerandoOS) return; _descartar = null; if (Encontro.Retomada.Partidas().Count > 0) DialogoAndamentos(false); else SairDoOneshot(); }

        // ------------------------------------------------ v265: as partidas de mapa oneshot em andamento
        // Um mapa oneshot deixado no meio (gravar e sair, ou o jogo fechado) fica guardado (Encontro.Retomada). Ao tocar em
        // "Mapa oneshot" de novo, este quadro diz quais ha e pergunta se alguma continua; "Novo mapa" segue para a escolha da
        // equipe. "Descartar" pede um segundo toque.
        static string _descartar;
        const int AndamentosNoQuadro = 4;

        static void DialogoAndamentos(bool fade)
        {
            try
            {
                var lista = Encontro.Retomada.Partidas();
                if (lista.Count == 0) { EscolherEquipe(); return; }
                if (_missao != null) UnityEngine.Object.Destroy(_missao);
                var raiz = _tela.transform;
                var editar = Achar(raiz, "Canvas_EditSaveSlot"); var aviso = Achar(raiz, "Canvas_LoadBackupWarning");
                if (editar == null) throw new Exception("sem o quadro do jogo");
                _missao = Copia(editar, raiz, "partidas em andamento");
                var cg = _missao.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = fade ? 0f : 1f; cg.interactable = true; cg.blocksRaycasts = true; }
                var bg = Achar(_missao.transform, "Image_BG") as RectTransform; if (bg == null) throw new Exception("sem Image_BG");
                bg.sizeDelta = new Vector2(1260f, 860f); bg.anchoredPosition = Vector2.zero;
                var bgBtn = bg.gameObject.AddComponent<Button>(); bgBtn.transition = Selectable.Transition.None;
                var tituloT = Achar(bg, "Text_PartyName")?.GetComponent<TMP_Text>();
                if (tituloT != null) { var r = tituloT.transform as RectTransform; r.sizeDelta = new Vector2(1150f, 56f); r.anchoredPosition = new Vector2(0f, -60f); }
                Texto(tituloT, T("Mapa oneshot · partidas em andamento", "One-shot map · games in progress"));
                var opcoes = Achar(bg, "Layout_Options");
                var rotuloModelo = Achar(opcoes, "Label_RestoreDesc"); var botaoModelo = Achar(opcoes, "Button_Restore"); var divisoria = Achar(opcoes, "Imade_Divider");
                if (opcoes != null) opcoes.gameObject.SetActive(false);
                if (rotuloModelo == null || botaoModelo == null) throw new Exception("sem os modelos de texto e botão");
                var col = new GameObject("Bigorna coluna", typeof(RectTransform)); col.transform.SetParent(bg, false);
                var rc = col.GetComponent<RectTransform>(); rc.anchorMin = new Vector2(0f, 0f); rc.anchorMax = new Vector2(1f, 1f); rc.offsetMin = new Vector2(70f, 150f); rc.offsetMax = new Vector2(-70f, -110f);
                var v = col.AddComponent<VerticalLayoutGroup>(); v.spacing = 8f; v.childAlignment = TextAnchor.UpperCenter; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
                TMP_Text Linha(string texto, float altura, float tamanho)
                {
                    var go = Copia(rotuloModelo, col.transform, "texto"); var t = go.GetComponent<TMP_Text>(); Texto(t, texto);
                    t.fontSize = tamanho; t.enableAutoSizing = false; t.alignment = TextAlignmentOptions.Center; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Ellipsis; t.richText = true;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    return t;
                }
                void Divisoria() { if (divisoria == null) return; var go = Copia(divisoria, col.transform, "divisória"); var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = 4f; le.minHeight = 4f; }
                Button Botao(Transform pai, string texto, Vector2 tam, Action acao)
                {
                    var go = Copia(botaoModelo, pai, texto); var r = go.GetComponent<RectTransform>(); r.sizeDelta = tam;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = tam.x; le.preferredHeight = tam.y;
                    foreach (var dd in go.GetComponentsInChildren<TMP_Dropdown>(true)) dd.gameObject.SetActive(false);
                    var t = go.GetComponentInChildren<TMP_Text>(true); if (t != null) { Texto(t, texto); t.enableAutoSizing = true; t.fontSizeMin = 14f; t.fontSizeMax = 24f; }
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); acao(); }); b.interactable = true;
                    if (go.GetComponent<CanvasGroup>() == null) go.AddComponent<CanvasGroup>();
                    return b;
                }
                GameObject Fileira(float altura)
                {
                    var go = new GameObject("Bigorna fileira", typeof(RectTransform)); go.transform.SetParent(col.transform, false);
                    var le = go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    var h = go.AddComponent<HorizontalLayoutGroup>(); h.spacing = 16f; h.childAlignment = TextAnchor.MiddleCenter; h.childControlWidth = false; h.childControlHeight = false; h.childForceExpandWidth = false; h.childForceExpandHeight = false;
                    return go;
                }

                Linha(lista.Count == 1 ? T("Há uma partida de mapa oneshot em andamento. Querem continuar de onde ela parou?", "There is a one-shot map game in progress. Do you want to continue where it stopped?")
                    : TF("Há {0} partidas de mapa oneshot em andamento. Querem continuar alguma de onde ela parou?", "There are {0} one-shot map games in progress. Do you want to continue one where it stopped?", lista.Count), 60f, 24f);
                Divisoria();
                string[] durs = { T("curta", "short"), T("média", "medium"), T("longa", "long") }, difs = { T("fácil", "easy"), T("normal", "normal"), T("difícil", "hard") };
                foreach (var a in lista.Take(AndamentosNoQuadro))
                {
                    var f = a.Dados; var partes = new List<string>();
                    partes.Add(TF("rodada {0}", "round {0}", Math.Max(1, f.Rodada)));
                    if (f.Duracao >= 0 && f.Duracao < 3) partes.Add(durs[f.Duracao]);
                    if (f.Dificuldade >= 0 && f.Dificuldade < 3) partes.Add(difs[f.Dificuldade]);
                    partes.Add(string.IsNullOrEmpty(f.Equipe) ? T("equipe nova", "new party") : T("equipe de «", "party of “") + f.Equipe + T("»", "”"));
                    if (a.Quando != DateTime.MinValue) partes.Add(DataHora(a.Quando));
                    var herois = f.Herois != null && f.Herois.Count > 0 ? "\n<size=80%>" + string.Join(", ", f.Herois.ToArray()) + "</size>" : "";
                    Linha("<b>" + (string.IsNullOrEmpty(f.Mapa) ? T("(sem nome)", "(no name)") : f.Mapa) + "</b>  ·  " + string.Join(" · ", partes.ToArray()) + herois, 62f, 22f);
                    var fl = Fileira(56f); var id = a.Id; var esta = a;
                    Botao(fl.transform, T("Continuar", "Continue"), new Vector2(300f, 52f), () =>
                    {
                        Som("UI_Embark"); _descartar = null;
                        Log.Info("«Continuar» a partida de mapa oneshot " + id + " («" + esta.Dados.Mapa + "», rodada " + esta.Dados.Rodada + ")");
                        var erro = Encontro.Lancador.Retomar(esta);
                        if (erro == null) { var go = _missao; _missao = null; if (go != null) UnityEngine.Object.Destroy(go); _avisoOS = null; _gerado = null; _verSimulacao = false; }   // (v268: o mapa jogado sai do quadro: na volta, Gerar; o mesmo mapa, pela semente)
                        Lancou(erro);
                    });
                    Botao(fl.transform, _descartar == id ? T("Descartar mesmo?", "Discard it?") : T("Descartar", "Discard"), new Vector2(300f, 52f), () =>
                    {
                        if (_descartar != id) { _descartar = id; DialogoAndamentos(false); return; }
                        _descartar = null;
                        Action apagar = () => { Formato.Andamento.Apagar(id); Log.Info("partida de mapa oneshot " + id + " descartada"); if (Encontro.Retomada.Partidas().Count > 0) DialogoAndamentos(false); else EscolherEquipe(); };
                        // (v266: a pasta da partida tem a ultima copia de um mapa jogado: antes, a pergunta se ele vira mapa novo)
                        Oneshot.Garantir(); var sem = esta.Dados?.Semente; var ult = Oneshot.Ultimo();
                        if (!string.IsNullOrEmpty(sem) && Formato.MapasJogados.Pendente(sem) && (ult == null || !string.Equals(ult.Semente, sem, StringComparison.OrdinalIgnoreCase)))
                            DialogoGuardar(esta.Dados.Mapa, sem, esta.CaminhoMapa, T("Descartar a partida apaga a última cópia dele.", "Discarding the game deletes its last copy."), apagar, () => DialogoAndamentos(false));
                        else apagar();
                    });
                }
                if (lista.Count > AndamentosNoQuadro) Linha(TF("<size=80%>(e mais {0}, mais antigas)</size>", "<size=80%>(and {0} more, older)</size>", lista.Count - AndamentosNoQuadro), 30f, 18f);

                var cancelar = aviso != null ? Achar(aviso, "Button_Cancel") : null; var seguir = aviso != null ? Achar(aviso, "Button_Proceed") : null;
                Button Embaixo(Transform modelo, string texto, Vector2 pos, Action acao)
                {
                    var go = modelo != null ? Copia(modelo, bg, texto) : Copia(botaoModelo, bg, texto);
                    var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(pos.x < 0 ? 1f : 0f, 0f); r.anchoredPosition = pos; r.sizeDelta = new Vector2(280f, 90f);
                    Texto(go.GetComponentInChildren<TMP_Text>(true), texto);
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => acao()); b.interactable = true;
                    return b;
                }
                Embaixo(cancelar, T("Voltar", "Back"), new Vector2(220f, 80f), () => { Som("UI_Click"); _descartar = null; SairDoOneshot(); });
                Embaixo(seguir, T("Novo mapa", "New map"), new Vector2(-220f, 80f), () => { Som("UI_Click"); _descartar = null; EscolherEquipe(); });
                _missao.transform.SetAsLastSibling();
                if (cg != null && fade) Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null));
            }
            catch (Exception ex) { Log.Erro("mapa oneshot: partidas em andamento", ex); if (_missao != null) UnityEngine.Object.Destroy(_missao); _missao = null; EscolherEquipe(); }
        }

        // ------------------------------------------------ v262: Novo jogo + (Menu/NovoJogoMais.cs)
        /// <summary>O botao "Novo jogo +" do menu: a tela, na escolha da partida terminada de onde vem o grupo.</summary>
        public static bool AbrirNovoJogoMais()
        {
            if (_falhou) return false;
            try
            {
                if (!Montar()) { _falhou = true; return false; }
                ModoOneshot(true); if (_titulo != null) Texto(_titulo, T("Novo jogo +", "New Game +"));
                Cena.Titlescreen.Hide(true, t => { Mostrar(); EscolherNovoJogoMais(); });
                return true;
            }
            catch (Exception ex) { Log.Erro("Novo jogo +", ex); return false; }
        }

        /// <summary>v280: o Novo jogo + espera o quadro de dificuldade do jogo. Se ele fecha sem a partida começar (o jogador
        /// voltou), a tela de título volta: no fluxo do jogo, atrás dele fica a tela do nome do grupo; no do mod, nada, e a tela
        /// ficava vazia (relato do Victor, 04/11/2026).</summary>
        static bool _dificuldadeDoNovoJogoMais; static float _desdeDificuldade;
        public static void Batimento()
        {
            if (!_dificuldadeDoNovoJogoMais) return;
            try
            {
                if (Jogo.CenaAtual() != Scene.Titlescene || (Jogo.Carregador != null && Jogo.Carregador.IsLoading)) { _dificuldadeDoNovoJogoMais = false; return; }
                if (Time.unscaledTime - _desdeDificuldade < 1.5f) return;
                var d = SingletonBehaviour<UIGame>.Instance?.DifficultySelectDialog;
                if (d != null && (d.IsVisible || d.IsTweening)) return;
                _dificuldadeDoNovoJogoMais = false;
                Log.Info("Novo jogo +: o quadro de dificuldade fechou sem a partida começar; de volta ao menu");
                Cena.Titlescreen.Show(true);
            }
            catch (Exception ex) { _dificuldadeDoNovoJogoMais = false; Log.Erro("Novo jogo +: de volta ao menu", ex); }
        }

        static void EscolherNovoJogoMais()
        {
            _paginaSaves = 0;
            AbrirSaves(T("Novo jogo + · a partida terminada", "New Game + · the finished game"), null, s =>
                {
                    var erro = NovoJogoMais.Comecar(s);
                    if (erro != null && _tela != null) { Log.Info("Novo jogo +: " + erro); Alerta(erro, T("Entendi", "OK"), EscolherNovoJogoMais); return; }   // (v267: o aviso na propria tela, e de volta a lista)
                    Lancou(erro);   // (sem erro: a tela sai, e o quadro de dificuldade do jogo segue para a introdução)
                    if (erro == null) { _dificuldadeDoNovoJogoMais = true; _desdeDificuldade = Time.unscaledTime; }
                }, null, () => { FecharMissao(); Fechar(); },
                T("A campanha oficial de novo, desde a primeira missão do Ato I, com as regras e a história do jogo. O grupo de uma partida que venceu um ato vem como está: heróis, armas, itens, ouro, XP, materiais, receitas, perícias, lendas, companheiros e proezas. A história recomeça do zero, e os monstros vêm mais fortes. Vencido o Ato I, a campanha segue para o Ato II.",
                  "The official campaign again, from the first quest of Act I, with the game's rules and story. The party of a game that won an act comes as it is: heroes, weapons, items, gold, XP, materials, recipes, skills, legends, companions and feats. The story starts over, and the monsters come stronger. Once Act I is won, the campaign goes on to Act II."),
                null, NovoJogoMais.Terminada,
                T("Começa uma partida nova, numa ranhura livre, com o grupo desta. Em seguida o jogo pede a dificuldade e abre a introdução da primeira missão. A partida de origem fica como está.",
                  "A new game starts, in a free slot, with this game's party. Then the game asks for the difficulty and opens the introduction of the first quest. The original game stays as it is."),
                T("Escolham a partida terminada (venceu o Ato I ou o Ato II)", "Choose the finished game (it won Act I or Act II)"),
                T("Nenhuma partida terminada: o Novo jogo + começa de uma partida que venceu o Ato I ou o Ato II.", "No finished game: New Game + starts from a game that won Act I or Act II."), true);
        }

        static void EscolherEquipe()
        {
            _paginaSaves = 0;
            Oneshot.AbrirGerador();   // (v274: o gerador carrega ao fundo enquanto a equipe, a duração e a dificuldade são escolhidas)
            AbrirSaves(T("Mapa oneshot · a equipe", "One-shot map · the party"), () => { _equipe = null; DialogoOneshot(true); }, s => { _equipe = s; DialogoOneshot(true); },
                null, VoltarDoOneshot,
                T("Um mapa novo, feito na hora pelo gerador do Bigorna, com as mesmas regras do editor. Joguem com uma equipe nova ou com a equipe de uma partida gravada; nesse caso, no fim do mapa vocês escolhem se a partida gravada recebe o que a equipe ganhou.",
                  "A new map, made on the spot by Bigorna's generator, with the same rules as the editor. Play with a new party or with the party of a saved game; then, at the end of the map, you choose whether the saved game gets what the party won."),
                T("Equipe nova", "New party"), bagagem: false);
        }

        static void DialogoOneshot(bool fade)
        {
            if (!_gerandoOS) Oneshot.AbrirGerador();   // (v274: se fechou, abre de novo)
            try
            {
                if (_missao != null) UnityEngine.Object.Destroy(_missao);
                var raiz = _tela.transform;
                var editar = Achar(raiz, "Canvas_EditSaveSlot"); var aviso = Achar(raiz, "Canvas_LoadBackupWarning");
                if (editar == null) throw new Exception("sem o quadro do jogo");
                _missao = Copia(editar, raiz, "mapa oneshot");
                var cg = _missao.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = fade ? 0f : 1f; cg.interactable = true; cg.blocksRaycasts = true; }
                var bg = Achar(_missao.transform, "Image_BG") as RectTransform; if (bg == null) throw new Exception("sem Image_BG");
                bg.sizeDelta = new Vector2(1260f, 860f); bg.anchoredPosition = Vector2.zero;
                var bgBtn = bg.gameObject.AddComponent<Button>(); bgBtn.transition = Selectable.Transition.None;
                var tituloT = Achar(bg, "Text_PartyName")?.GetComponent<TMP_Text>();
                if (tituloT != null) { var r = tituloT.transform as RectTransform; r.sizeDelta = new Vector2(1150f, 56f); r.anchoredPosition = new Vector2(0f, -60f); }
                Texto(tituloT, T("Mapa oneshot", "One-shot map"));
                var opcoes = Achar(bg, "Layout_Options");
                var rotuloModelo = Achar(opcoes, "Label_RestoreDesc"); var botaoModelo = Achar(opcoes, "Button_Restore"); var divisoria = Achar(opcoes, "Imade_Divider");
                if (opcoes != null) opcoes.gameObject.SetActive(false);
                if (rotuloModelo == null || botaoModelo == null) throw new Exception("sem os modelos de texto e botão");
                var col = new GameObject("Bigorna coluna", typeof(RectTransform)); col.transform.SetParent(bg, false);
                var rc = col.GetComponent<RectTransform>(); rc.anchorMin = new Vector2(0f, 0f); rc.anchorMax = new Vector2(1f, 1f); rc.offsetMin = new Vector2(70f, 150f); rc.offsetMax = new Vector2(-70f, -110f);
                var v = col.AddComponent<VerticalLayoutGroup>(); v.spacing = 10f; v.childAlignment = TextAnchor.UpperCenter; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
                TMP_Text Linha(string texto, float altura, float tamanho)
                {
                    var go = Copia(rotuloModelo, col.transform, "texto"); var t = go.GetComponent<TMP_Text>(); Texto(t, texto);
                    t.fontSize = tamanho; t.enableAutoSizing = false; t.alignment = TextAlignmentOptions.Center; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Ellipsis; t.richText = true;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    return t;
                }
                void Divisoria() { if (divisoria == null) return; var go = Copia(divisoria, col.transform, "divisória"); var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = 4f; le.minHeight = 4f; }
                Button Botao(Transform pai, string texto, Vector2 tam, Action acao)
                {
                    var go = Copia(botaoModelo, pai, texto); var r = go.GetComponent<RectTransform>(); r.sizeDelta = tam;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = tam.x; le.preferredHeight = tam.y;
                    foreach (var dd in go.GetComponentsInChildren<TMP_Dropdown>(true)) dd.gameObject.SetActive(false);
                    var t = go.GetComponentInChildren<TMP_Text>(true); if (t != null) { Texto(t, texto); t.enableAutoSizing = true; t.fontSizeMin = 14f; t.fontSizeMax = 24f; }
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); acao(); }); b.interactable = true;
                    if (go.GetComponent<CanvasGroup>() == null) go.AddComponent<CanvasGroup>();
                    return b;
                }
                void Marcar(Button b, bool sim, bool preso = false) { var c = b.GetComponent<CanvasGroup>(); if (c != null) c.alpha = sim ? 1f : 0.45f; b.interactable = !preso; }
                GameObject Fileira(float altura)
                {
                    var go = new GameObject("Bigorna fileira", typeof(RectTransform)); go.transform.SetParent(col.transform, false);
                    var le = go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    var h = go.AddComponent<HorizontalLayoutGroup>(); h.spacing = 16f; h.childAlignment = TextAnchor.MiddleCenter; h.childControlWidth = false; h.childControlHeight = false; h.childForceExpandWidth = false; h.childForceExpandHeight = false;
                    return go;
                }
                // (uma escolha nova pede outro mapa: o gerado sai)
                void Mudou() { if (_gerandoOS) return; _gerado = null; _verSimulacao = false; DialogoOneshot(false); }

                int atosColecao = Oneshot.Atos(), atos = AtosEscolhidos();
                // (v267: com um mapa gerado, as caixas que ele usa; a semente de 7 caracteres pode pedir só o Ato I)
                int atosDoMapa = _gerado != null && _gerado.Erro == null && (_gerado.Atos == 1 || _gerado.Atos == 2) ? _gerado.Atos : atos;
                Linha(T("Equipe: ", "Party: ") + "<b>" + (_equipe == null ? T("nova", "new") : _equipe.Rotulo) + "</b>     " + T("Caixas: ", "Boxes: ") + "<b>" + (atosDoMapa == 2 ? T("Atos I e II", "Acts I and II") : T("Ato I", "Act I")) + "</b> " + (atosDoMapa != atos ? T("(pela semente)", "(from the seed)") : atos != atosColecao ? T("(escolhidas)", "(chosen)") : T("(as da coleção do jogo)", "(those of the game's collection)")), 44f, 22f);
                // (v272: com o Ato II na coleção, a caixa para usar ou deixar de fora o Ato II; v285: com equipe nova ou gravada)
                if (atosColecao == 2)
                {
                    var fa = Fileira(52f);
                    var caixa = Botao(fa.transform, _usarAto2 ? "<b>X</b>" : " ", new Vector2(52f, 48f), () => { if (_gerandoOS) return; _usarAto2 = !_usarAto2; Log.Info("mapa oneshot: usar o Ato II " + (_usarAto2 ? "sim" : "não")); Mudou(); });
                    var tc = caixa.GetComponentInChildren<TMP_Text>(true); if (tc != null) { tc.enableAutoSizing = false; tc.fontSize = 28f; tc.alignment = TextAlignmentOptions.Center; }
                    Marcar(caixa, true, _gerandoOS);
                    var rot = Copia(rotuloModelo, fa.transform, "usar o Ato II"); var trot = rot.GetComponent<TMP_Text>();
                    Texto(trot, T("Usar o Ato II (missões, monstros e peças dele)", "Use Act II (its quests, monsters and tiles)")); trot.fontSize = 22f; trot.enableAutoSizing = false; trot.alignment = TextAlignmentOptions.Left; trot.enableWordWrapping = false;
                    var ler = rot.GetComponent<RectTransform>(); ler.sizeDelta = new Vector2(560f, 48f);
                    var lel = rot.GetComponent<LayoutElement>() ?? rot.AddComponent<LayoutElement>(); lel.preferredWidth = 560f; lel.preferredHeight = 48f;
                    var brot = rot.GetComponent<Button>() ?? rot.AddComponent<Button>(); brot.transition = Selectable.Transition.None; brot.onClick.AddListener(() => { if (_gerandoOS) return; Som("UI_Click"); _usarAto2 = !_usarAto2; Log.Info("mapa oneshot: usar o Ato II " + (_usarAto2 ? "sim" : "não")); Mudou(); });
                }
                Divisoria();
                Linha(T("Duração", "Length"), 34f, 28f);
                var fd = Fileira(60f); var bd = new List<Button>();
                var nomesD = new[] { T("Curta (3 salas)", "Short (3 rooms)"), T("Média (6 salas)", "Medium (6 rooms)"), T("Longa (8 salas)", "Long (8 rooms)") };
                for (int i = 0; i < 3; i++) { int k = i; bd.Add(Botao(fd.transform, nomesD[i], new Vector2(300f, 56f), () => { if (_duracaoOS == k) return; _duracaoOS = k; Mudou(); })); }
                for (int j = 0; j < 3; j++) Marcar(bd[j], j == _duracaoOS, _gerandoOS);
                Linha(T("Dificuldade", "Difficulty"), 34f, 28f);
                var fn = Fileira(60f); var bn = new List<Button>();
                var nomesN = new[] { T("Fácil", "Easy"), T("Normal", "Normal"), T("Difícil", "Hard") };
                for (int i = 0; i < 3; i++) { int k = i; bn.Add(Botao(fn.transform, nomesN[i], new Vector2(300f, 56f), () => { if (_dificuldadeOS == k) return; _dificuldadeOS = k; Mudou(); })); }
                for (int j = 0; j < 3; j++) Marcar(bn[j], j == _dificuldadeOS, _gerandoOS);
                Divisoria();
                // a semente (so ela) e, embaixo, a simulacao
                string estado = _gerandoOS ? T("Gerando o mapa…", "Generating the map…")
                    : _gerado == null ? T("Escolham a duração e a dificuldade e toquem em Gerar.", "Pick the length and the difficulty and tap Generate.")
                    : _gerado.Erro != null ? "<color=#ff9a7a>" + _gerado.Erro + "</color>"
                    : T("Semente: ", "Seed: ") + "<b>" + _gerado.Semente + "</b>" + (string.IsNullOrEmpty(_gerado.Nome) ? "" : "  ·  " + TF("«{0}»", "“{0}”", _gerado.Nome));   // (v288: e o nome do mapa)
                Linha(estado, 50f, _gerado != null && _gerado.Erro == null && !_gerandoOS ? 34f : 22f);
                if (_avisoOS != null) Linha("<color=#a8e6a1>" + _avisoOS + "</color>", 30f, 20f);
                // (v278: no Linux, o gerador é a página do gerador aberta no Chrome ou no Chromium; o quadro diz onde ela está)
                if (Plataforma.Wine)
                {
                    if (Oneshot.PonteAtiva) Linha("<color=#a8e6a1>" + T("Gerador do navegador conectado.", "Browser generator connected.") + "</color>", 28f, 18f);
                    else
                    {
                        Linha(TF("No Linux, o gerador roda no Chrome ou no Chromium. Abram <b>{0}</b> e, na página, escolham a pasta <b>{1}</b>.", "On Linux, the generator runs in Chrome or Chromium. Open <b>{0}</b> and, on the page, choose the folder <b>{1}</b>.",
                            Plataforma.CaminhoNoSistema(Oneshot.ArquivoDaPonte), Plataforma.CaminhoNoSistema(Oneshot.Pasta)), 66f, 15f);
                        var fp = Fileira(50f);
                        Botao(fp.transform, T("Abrir no navegador", "Open in the browser"), new Vector2(300f, 46f), () => { Oneshot.AbrirPonteNoNavegador(); });
                    }
                }
                // (v266: uma semente digitada: a de 7 caracteres traz a duracao, a dificuldade e as caixas; outra vale com o que esta escolhido)
                if (!_gerandoOS)
                {
                    var fsem = Fileira(58f);
                    CampoDeTexto(fsem.transform, _sementeDigitada, T("semente", "seed"), new Vector2(300f, 52f), t => _sementeDigitada = t);
                    Botao(fsem.transform, T("Usar esta semente", "Use this seed"), new Vector2(300f, 52f), () => UsarSemente(_sementeDigitada));
                }
                if (_gerado != null && _gerado.Erro == null && !_gerandoOS)
                {
                    var fs = Fileira(60f);
                    Botao(fs.transform, _verSimulacao ? T("Esconder a simulação", "Hide the simulation") : T("Simulação", "Simulation"), new Vector2(300f, 56f), () => { _verSimulacao = !_verSimulacao; DialogoOneshot(false); });
                    Botao(fs.transform, T("Gerar outro", "Generate another"), new Vector2(300f, 56f), () => GerarOneshot());
                    if (_verSimulacao) { var ts = Linha(Oneshot.TextoDaSimulacao(_gerado), 150f, 18f); ts.alignment = TextAlignmentOptions.TopLeft; ts.overflowMode = TextOverflowModes.Truncate; }
                }

                // embaixo: voltar (a escolha da equipe) e gerar / jogar
                var cancelar = aviso != null ? Achar(aviso, "Button_Cancel") : null; var seguir = aviso != null ? Achar(aviso, "Button_Proceed") : null;
                Button Embaixo(Transform modelo, string texto, Vector2 pos, Action acao)
                {
                    var go = modelo != null ? Copia(modelo, bg, texto) : Copia(botaoModelo, bg, texto);
                    var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(pos.x < 0 ? 1f : 0f, 0f); r.anchoredPosition = pos; r.sizeDelta = new Vector2(280f, 90f);
                    Texto(go.GetComponentInChildren<TMP_Text>(true), texto);
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => acao()); b.interactable = true;
                    if (go.GetComponent<CanvasGroup>() == null) go.AddComponent<CanvasGroup>();
                    return b;
                }
                var voltar = Embaixo(cancelar, T("Voltar", "Back"), new Vector2(220f, 80f), () => { if (_gerandoOS) return; Som("UI_Click"); EscolherEquipe(); });
                Marcar(voltar, !_gerandoOS, _gerandoOS);
                bool pronto = _gerado != null && _gerado.Erro == null;
                var principal = Embaixo(seguir, _gerandoOS ? T("Gerando…", "Generating…") : pronto ? T("Jogar", "Play") : T("Gerar", "Generate"), new Vector2(-220f, 80f), () =>
                {
                    if (_gerandoOS) return;
                    if (!pronto) { Som("UI_Click"); GerarOneshot(); return; }
                    Som("UI_Embark");
                    Formato.Dmap m = null;
                    try { m = Formato.Dmap.Carregar(_gerado.Caminho); } catch (Exception ex) { Log.Erro("mapa oneshot: lendo o mapa", ex); }
                    if (m == null) { _gerado = new Oneshot.Resultado { Erro = T("O mapa gerado não abriu. Gerem outro.", "The generated map did not open. Generate another.") }; DialogoOneshot(false); return; }
                    Log.Info("«Jogar» mapa oneshot " + _gerado.Semente + (_equipe != null ? " com a equipe do save " + _equipe.Slot : " com equipe nova"));
                    var erro = Encontro.Lancador.Lancar(m, _equipe, new Encontro.Lancador.InfoOneshot { Semente = _gerado.Semente, Duracao = _duracaoOS, Dificuldade = _dificuldadeOS, Equipe = _equipe?.Rotulo });
                    if (erro == null) { var go = _missao; _missao = null; if (go != null) UnityEngine.Object.Destroy(go); _avisoOS = null; _gerado = null; _verSimulacao = false; }   // (v268: o mapa jogado sai do quadro: na volta, Gerar; o mesmo mapa, pela semente)
                    Lancou(erro);
                });
                Marcar(principal, !_gerandoOS, _gerandoOS);
                _missao.transform.SetAsLastSibling();
                if (cg != null && fade) Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null));
            }
            catch (Exception ex) { Log.Erro("mapa oneshot: quadro", ex); if (_missao != null) UnityEngine.Object.Destroy(_missao); _missao = null; Lancou(T("Não consegui abrir o quadro do mapa oneshot.", "Could not open the one-shot map window.")); }
        }

        /// <summary>Gera um mapa (semente: a digitada, ou null para uma nova). Antes, se o oneshot.dmap e de um mapa jogado e ainda
        /// sem decisao, a pergunta se ele vira mapa novo (gerar escreve por cima dele).</summary>
        static void GerarOneshot(string semente = null, bool perguntado = false)
        {
            if (_gerandoOS || Oneshot.Gerando) return;
            if (!perguntado)
            {
                Oneshot.Garantir(); var u = Oneshot.Ultimo();
                // (v267: so quando o oneshot.dmap e a ultima copia; uma partida em andamento desse mapa ainda o guarda, e a pergunta
                //  vem quando ela sair: no fim do mapa ou ao descartar)
                bool noAndamento = u != null && Encontro.Retomada.Partidas().Any(a => string.Equals(a.Dados?.Semente, u.Semente, StringComparison.OrdinalIgnoreCase));
                if (u != null && Formato.MapasJogados.Pendente(u.Semente) && !noAndamento)
                {
                    DialogoGuardar(u.Nome, u.Semente, Oneshot.CaminhoDoMapa, T("Gerar outro mapa escreve por cima dele.", "Generating another map writes over it."), () => GerarOneshot(semente, true), () => DialogoOneshot(false));
                    return;
                }
            }
            if (!perguntado) _avisoOS = null;   // (v288: o aviso do mapa guardado vale só para a geração que vem logo depois dele)
            _gerandoOS = true; _gerado = null; _verSimulacao = false; DialogoOneshot(false);
            Nucleo.Instancia.StartCoroutine(Oneshot.Gerar(_duracaoOS, _dificuldadeOS, semente, r =>
            {
                _gerandoOS = false; _gerado = r;
                if (r != null && r.Erro == null) { if (r.Duracao >= 0) _duracaoOS = r.Duracao; if (r.Dificuldade >= 0) _dificuldadeOS = r.Dificuldade; }   // (v266: a semente digitada manda)
                if (_tela != null && _oneshot && _tela.activeSelf) DialogoOneshot(false);
            }, _equipe == null ? 0 : _equipe.Ato >= Act.ActII ? 2 : 1, AtosEscolhidos()));   // (v261: a vida da simulacao e a do ato da equipe do save; v272: as caixas escolhidas)
        }

        // ------------------------------------------------ v266: a semente digitada e a pergunta antes de um mapa jogado sair
        /// <summary>Um campo de texto do proprio jogo (o do nome do grupo, na tela de titulo), copiado e sem a logica dele.</summary>
        static TMP_InputField CampoDeTexto(Transform pai, string texto, string dica, Vector2 tam, Action<string> mudou)
        {
            var modelo = Cena?.PartyName?.InputPartyName; if (modelo == null) return null;
            var go = Copia(modelo.transform, pai, "campo");
            var r = go.GetComponent<RectTransform>(); if (r != null) r.sizeDelta = tam;
            var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = tam.x; le.preferredHeight = tam.y;
            var c = go.GetComponent<TMP_InputField>(); if (c == null) { UnityEngine.Object.Destroy(go); return null; }
            c.onValueChanged = new TMP_InputField.OnChangeEvent(); c.onEndEdit = new TMP_InputField.SubmitEvent(); c.onSubmit = new TMP_InputField.SubmitEvent();
            c.onSelect = new TMP_InputField.SelectionEvent(); c.onDeselect = new TMP_InputField.SelectionEvent();
            c.characterLimit = 24; c.contentType = TMP_InputField.ContentType.Alphanumeric; c.text = texto ?? "";
            if (c.placeholder is TMP_Text ph) Texto(ph, dica);
            c.onValueChanged.AddListener(t => mudou?.Invoke(t));
            c.interactable = true;
            return c;
        }

        /// <summary>"Usar esta semente": a de 7 caracteres traz a duracao, a dificuldade e as caixas (uma do Ato II, com a colecao
        /// so do Ato I, nao serve); outra forma gera com o que esta escolhido.</summary>
        static void UsarSemente(string s)
        {
            s = (s ?? "").Trim(); if (s.Length == 0 || _gerandoOS) return;
            var ls = Formato.MapasJogados.LerSemente(s);
            if (ls != null)
            {
                if (ls.Value.atos == 2 && Oneshot.Atos() < 2) { _gerado = new Oneshot.Resultado { Erro = T("Esta semente é de um mapa com as caixas dos Atos I e II, e a coleção do jogo tem só o Ato I.", "This seed is of a map with the boxes of Acts I and II, and the game's collection has only Act I.") }; DialogoOneshot(false); return; }
                _duracaoOS = ls.Value.duracao; _dificuldadeOS = ls.Value.dificuldade; s = s.ToLowerInvariant();
            }
            Log.Info("mapa oneshot: semente digitada «" + s + "»" + (ls != null ? " (traz duração, dificuldade e caixas)" : ""));
            GerarOneshot(s);
        }

        /// <summary>Um mapa jogado vai sair (gerar por cima, descartar a partida, o fim da partida retomada): guardar como mapa novo
        /// (oneshot-&lt;semente&gt;.dmap na pasta de mapas, entre os mapas avulsos) ou nao. A decisao fica (Formato.MapasJogados):
        /// a pergunta nao volta para o mesmo mapa. voltar: null sem "Voltar".</summary>
        static void DialogoGuardar(string nome, string semente, string caminho, string porque, Action seguir, Action voltar)
        {
            try
            {
                if (_missao != null) UnityEngine.Object.Destroy(_missao);
                var raiz = _tela.transform;
                var editar = Achar(raiz, "Canvas_EditSaveSlot"); var aviso = Achar(raiz, "Canvas_LoadBackupWarning");
                if (editar == null) throw new Exception("sem o quadro do jogo");
                _missao = Copia(editar, raiz, "guardar o mapa");
                var cg = _missao.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 1f; cg.interactable = true; cg.blocksRaycasts = true; }
                var bg = Achar(_missao.transform, "Image_BG") as RectTransform; if (bg == null) throw new Exception("sem Image_BG");
                bg.sizeDelta = new Vector2(1260f, 640f); bg.anchoredPosition = Vector2.zero;
                var bgBtn = bg.gameObject.AddComponent<Button>(); bgBtn.transition = Selectable.Transition.None;
                var tituloT = Achar(bg, "Text_PartyName")?.GetComponent<TMP_Text>();
                if (tituloT != null) { var r = tituloT.transform as RectTransform; r.sizeDelta = new Vector2(1150f, 56f); r.anchoredPosition = new Vector2(0f, -60f); }
                Texto(tituloT, T("Mapa oneshot · guardar o mapa?", "One-shot map · keep the map?"));
                var opcoes = Achar(bg, "Layout_Options");
                var rotuloModelo = Achar(opcoes, "Label_RestoreDesc"); var botaoModelo = Achar(opcoes, "Button_Restore");
                if (opcoes != null) opcoes.gameObject.SetActive(false);
                if (rotuloModelo == null || botaoModelo == null) throw new Exception("sem os modelos de texto e botão");
                var col = new GameObject("Bigorna coluna", typeof(RectTransform)); col.transform.SetParent(bg, false);
                var rc = col.GetComponent<RectTransform>(); rc.anchorMin = new Vector2(0f, 0f); rc.anchorMax = new Vector2(1f, 1f); rc.offsetMin = new Vector2(70f, 150f); rc.offsetMax = new Vector2(-70f, -110f);
                var v = col.AddComponent<VerticalLayoutGroup>(); v.spacing = 12f; v.childAlignment = TextAnchor.UpperCenter; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
                void Linha(string texto, float altura, float tamanho)
                {
                    var go = Copia(rotuloModelo, col.transform, "texto"); var t = go.GetComponent<TMP_Text>(); Texto(t, texto);
                    t.fontSize = tamanho; t.enableAutoSizing = false; t.alignment = TextAlignmentOptions.Center; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Ellipsis; t.richText = true;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                }
                void Botao(Transform pai, string texto, Action acao)
                {
                    var go = Copia(botaoModelo, pai, texto); var r = go.GetComponent<RectTransform>(); r.sizeDelta = new Vector2(380f, 56f);
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = 380f; le.preferredHeight = 56f;
                    foreach (var dd in go.GetComponentsInChildren<TMP_Dropdown>(true)) dd.gameObject.SetActive(false);
                    var t = go.GetComponentInChildren<TMP_Text>(true); if (t != null) { Texto(t, texto); t.enableAutoSizing = true; t.fontSizeMin = 14f; t.fontSizeMax = 24f; }
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); acao(); }); b.interactable = true;
                }
                Linha("<b>" + (string.IsNullOrEmpty(nome) ? T("(sem nome)", "(no name)") : nome) + "</b>  ·  " + T("semente ", "seed ") + "<b>" + semente + "</b>", 50f, 30f);
                Linha(T("Este mapa já foi jogado. Querem guardá-lo como mapa novo? Ele passa a ficar nos Mapas da comunidade, entre os mapas avulsos, para jogar de novo quando quiserem.", "This map has been played. Do you want to keep it as a new map? It then stays in the Community maps, among the standalone maps, to play again whenever you want.")
                    + (string.IsNullOrEmpty(porque) ? "" : " " + porque), 110f, 22f);
                var fl = new GameObject("Bigorna fileira", typeof(RectTransform)); fl.transform.SetParent(col.transform, false);
                var lef = fl.AddComponent<LayoutElement>(); lef.preferredHeight = 64f; lef.minHeight = 64f;
                var h = fl.AddComponent<HorizontalLayoutGroup>(); h.spacing = 24f; h.childAlignment = TextAnchor.MiddleCenter; h.childControlWidth = false; h.childControlHeight = false; h.childForceExpandWidth = false; h.childForceExpandHeight = false;
                Botao(fl.transform, T("Guardar como mapa novo", "Keep as a new map"), () =>
                {
                    try
                    {
                        var dest = Formato.MapasJogados.GuardarComoNovo(caminho, Bootstrap.PastaMapas, semente);
                        Formato.MapasJogados.Decidir(semente, Formato.MapasJogados.Guardado, dest);
                        _avisoOS = TF("«{0}» ficou nos Mapas da comunidade.", "“{0}” is now in the Community maps.", nome);
                        Log.Info("mapa oneshot «" + nome + "» (semente " + semente + ") guardado como mapa novo: " + dest);
                        PainelMapas.RelerAoFundo();
                    }
                    catch (Exception ex) { Log.Erro("guardando o mapa oneshot", ex); _avisoOS = T("Não consegui guardar o mapa: ", "Could not keep the map: ") + ex.Message; }
                    seguir?.Invoke();
                });
                Botao(fl.transform, T("Não guardar", "Do not keep"), () => { Formato.MapasJogados.Decidir(semente, Formato.MapasJogados.Recusado); Log.Info("mapa oneshot «" + nome + "» (semente " + semente + "): não guardado"); seguir?.Invoke(); });
                if (voltar != null)
                {
                    var cancelar = aviso != null ? Achar(aviso, "Button_Cancel") : null;
                    var go = cancelar != null ? Copia(cancelar, bg, "voltar") : Copia(botaoModelo, bg, "voltar");
                    var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(0f, 0f); r.anchoredPosition = new Vector2(220f, 80f); r.sizeDelta = new Vector2(280f, 90f);
                    Texto(go.GetComponentInChildren<TMP_Text>(true), T("Voltar", "Back"));
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); voltar(); }); b.interactable = true;
                }
                _missao.transform.SetAsLastSibling();
            }
            catch (Exception ex) { Log.Erro("mapa oneshot: guardar o mapa", ex); if (_missao != null) UnityEngine.Object.Destroy(_missao); _missao = null; seguir?.Invoke(); }
        }

        /// <summary>v287: na tela de título, depois de um mapa jogado com a equipe de uma partida gravada: o que fazer com o grupo,
        /// no quadro do próprio jogo (antes, desenhado pelo mod, fora da estética do jogo, e o clique passava ao menu por baixo).</summary>
        public static bool PerguntarGrupo()
        {
            if (!Encontro.GrupoDoSave.Pendente || _falhou) return false;
            try
            {
                if (!Montar()) { _falhou = true; return false; }
                ModoOneshot(true);
                Cena.Titlescreen.Hide(true, t => { Mostrar(); QuadroDoGrupo(); });
                return true;
            }
            catch (Exception ex) { Log.Erro("o destino do grupo: quadro", ex); return false; }
        }
        static void QuadroDoGrupo()
        {
            try
            {
                if (_missao != null) UnityEngine.Object.Destroy(_missao);
                var raiz = _tela.transform;
                var editar = Achar(raiz, "Canvas_EditSaveSlot"); if (editar == null) throw new Exception("sem o quadro do jogo");
                _missao = Copia(editar, raiz, "destino do grupo");
                var cg = _missao.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 1f; cg.interactable = true; cg.blocksRaycasts = true; }
                var bg = Achar(_missao.transform, "Image_BG") as RectTransform; if (bg == null) throw new Exception("sem Image_BG");
                bg.sizeDelta = new Vector2(1260f, 700f); bg.anchoredPosition = Vector2.zero;
                var bgBtn = bg.gameObject.AddComponent<Button>(); bgBtn.transition = Selectable.Transition.None;
                var tituloT = Achar(bg, "Text_PartyName")?.GetComponent<TMP_Text>();
                if (tituloT != null) { var r = tituloT.transform as RectTransform; r.sizeDelta = new Vector2(1150f, 56f); r.anchoredPosition = new Vector2(0f, -60f); }
                Texto(tituloT, Encontro.GrupoDoSave.TituloDoFim);
                var opcoes = Achar(bg, "Layout_Options");
                var rotuloModelo = Achar(opcoes, "Label_RestoreDesc"); var botaoModelo = Achar(opcoes, "Button_Restore"); var divisoria = Achar(opcoes, "Imade_Divider");
                if (opcoes != null) opcoes.gameObject.SetActive(false);
                if (rotuloModelo == null || botaoModelo == null) throw new Exception("sem os modelos de texto e botão");
                var col = new GameObject("Bigorna coluna", typeof(RectTransform)); col.transform.SetParent(bg, false);
                var rc = col.GetComponent<RectTransform>(); rc.anchorMin = new Vector2(0f, 0f); rc.anchorMax = new Vector2(1f, 1f); rc.offsetMin = new Vector2(70f, 60f); rc.offsetMax = new Vector2(-70f, -110f);
                var v = col.AddComponent<VerticalLayoutGroup>(); v.spacing = 14f; v.childAlignment = TextAnchor.UpperCenter; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = false; v.childForceExpandHeight = false;
                foreach (var linha in Encontro.GrupoDoSave.TextosDoFim())
                {
                    var go = Copia(rotuloModelo, col.transform, "texto"); var t = go.GetComponent<TMP_Text>(); Texto(t, linha);
                    t.fontSize = 22f; t.enableAutoSizing = false; t.alignment = TextAlignmentOptions.Center; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Overflow; t.richText = true;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = 1080f; le.preferredHeight = -1f; le.minHeight = 40f;
                }
                if (divisoria != null) { var d = Copia(divisoria, col.transform, "divisória"); var le = d.GetComponent<LayoutElement>() ?? d.AddComponent<LayoutElement>(); le.preferredHeight = 4f; le.preferredWidth = 1080f; }
                foreach (var op in Encontro.GrupoDoSave.OpcoesDoFim())
                {
                    var o = op;
                    var go = Copia(botaoModelo, col.transform, "opção"); var r = go.GetComponent<RectTransform>(); r.sizeDelta = new Vector2(820f, 64f);
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = 820f; le.preferredHeight = 64f;
                    foreach (var dd in go.GetComponentsInChildren<TMP_Dropdown>(true)) dd.gameObject.SetActive(false);
                    var t = go.GetComponentInChildren<TMP_Text>(true); if (t != null) { Texto(t, o.Rotulo); t.enableAutoSizing = true; t.fontSizeMin = 14f; t.fontSizeMax = 24f; }
                    var b = go.GetComponent<Button>(); b.interactable = true;
                    b.onClick.AddListener(() => { Som("UI_Click"); var erro = o.Fazer(); if (erro != null) QuadroDoGrupo(); else { FecharMissao(); Fechar(); } });
                }
                _missao.transform.SetAsLastSibling();
                Log.Info("o destino do grupo: a pergunta no quadro do jogo");
            }
            catch (Exception ex) { Log.Erro("o destino do grupo: quadro", ex); if (_missao != null) UnityEngine.Object.Destroy(_missao); _missao = null; Encontro.GrupoDoSave.NoQuadroDoJogo = false; Fechar(); }
        }

        /// <summary>Na tela de titulo, depois de um mapa jogado que terminou com a ultima copia dele (Oneshot.FimPendente): a tela
        /// abre so com a pergunta. Falso se nao deu.</summary>
        public static bool PerguntarFim()
        {
            var f = Oneshot.FimPendente; if (f == null || _falhou) return false;
            try
            {
                if (!Montar()) { _falhou = true; return false; }
                ModoOneshot(true);
                Action fim = () => { Oneshot.FimPendente = null; try { if (File.Exists(Oneshot.CaminhoDoFim)) File.Delete(Oneshot.CaminhoDoFim); } catch { } SairDoOneshot(); };
                Cena.Titlescreen.Hide(true, t => { Mostrar(); DialogoGuardar(f.Nome, f.Semente, Oneshot.CaminhoDoFim, T("A partida terminou, e esta é a última cópia dele.", "The game is over, and this is its last copy."), fim, null); });
                return true;
            }
            catch (Exception ex) { Log.Erro("mapa oneshot: pergunta do fim", ex); Oneshot.FimPendente = null; return false; }
        }

        // ------------------------------------------------ "Continuar herois": a escolha da partida gravada
        // O mesmo quadro do jogo da missao oficial: o nome do mapa ou da campanha, o que cada botao traz, "Grupo novo" (quando
        // cabe) e as partidas gravadas, dez por pagina, a mais recente primeiro; tocar numa joga com o grupo dela.
        static int _paginaSaves;
        static void AbrirSaves(string titulo, Action novo, Action<Encontro.GrupoDoSave.Save> escolher, Action continuar = null, Action aoVoltar = null, string explicacao = null, string rotuloNovo = null,
            Func<Encontro.GrupoDoSave.Save, bool> filtro = null, string avisoOficial = null, string chamada = null, string semNenhuma = null, bool? bagagem = null)
        {
            try
            {
                if (_missao != null) UnityEngine.Object.Destroy(_missao);
                var raiz = _tela.transform;
                var editar = Achar(raiz, "Canvas_EditSaveSlot"); var aviso = Achar(raiz, "Canvas_LoadBackupWarning");
                if (editar == null) throw new Exception("sem o quadro do jogo");
                _missao = Copia(editar, raiz, "saves");
                var fundoBtn = _missao.GetComponent<Button>(); if (fundoBtn != null) fundoBtn.onClick.AddListener(() => (aoVoltar ?? FecharMissao)());
                var cg = _missao.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 0f; cg.interactable = true; cg.blocksRaycasts = true; }
                var bg = Achar(_missao.transform, "Image_BG") as RectTransform; if (bg == null) throw new Exception("sem Image_BG");
                bg.sizeDelta = new Vector2(1260f, 860f); bg.anchoredPosition = Vector2.zero;
                var bgBtn = bg.gameObject.AddComponent<Button>(); bgBtn.transition = Selectable.Transition.None;
                var tituloT = Achar(bg, "Text_PartyName")?.GetComponent<TMP_Text>();
                if (tituloT != null) { var r = tituloT.transform as RectTransform; r.sizeDelta = new Vector2(1150f, 56f); r.anchoredPosition = new Vector2(0f, -60f); }
                Texto(tituloT, titulo);
                var opcoes = Achar(bg, "Layout_Options");
                var rotuloModelo = Achar(opcoes, "Label_RestoreDesc"); var botaoModelo = Achar(opcoes, "Button_Restore"); var divisoria = Achar(opcoes, "Imade_Divider");
                if (opcoes != null) opcoes.gameObject.SetActive(false);
                if (rotuloModelo == null || botaoModelo == null) throw new Exception("sem os modelos de texto e botão");
                var col = new GameObject("Bigorna coluna", typeof(RectTransform)); col.transform.SetParent(bg, false);
                var rc = col.GetComponent<RectTransform>(); rc.anchorMin = new Vector2(0f, 0f); rc.anchorMax = new Vector2(1f, 1f); rc.offsetMin = new Vector2(70f, 150f); rc.offsetMax = new Vector2(-70f, -110f);
                var v = col.AddComponent<VerticalLayoutGroup>(); v.spacing = 8f; v.childAlignment = TextAnchor.UpperCenter; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
                TMP_Text Linha(string texto, float altura, float tamanho)
                {
                    var go = Copia(rotuloModelo, col.transform, "texto"); var t = go.GetComponent<TMP_Text>(); Texto(t, texto);
                    t.fontSize = tamanho; t.enableAutoSizing = false; t.alignment = TextAlignmentOptions.Center; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Ellipsis;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    return t;
                }
                Button Botao(Transform pai, string texto, Vector2 tam, Action acao)
                {
                    var go = Copia(botaoModelo, pai, "botão"); var r = go.GetComponent<RectTransform>(); r.sizeDelta = tam;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredWidth = tam.x; le.preferredHeight = tam.y;
                    foreach (var dd in go.GetComponentsInChildren<TMP_Dropdown>(true)) dd.gameObject.SetActive(false);
                    var t = go.GetComponentInChildren<TMP_Text>(true); if (t != null) { Texto(t, texto); t.enableAutoSizing = true; t.fontSizeMin = 13f; t.fontSizeMax = 24f; }
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); acao(); }); b.interactable = true;
                    return b;
                }
                GameObject Grade(float altura)
                {
                    var go = new GameObject("Bigorna grade", typeof(RectTransform)); go.transform.SetParent(col.transform, false);
                    var le = go.AddComponent<LayoutElement>(); le.preferredHeight = altura; le.minHeight = altura;
                    var g = go.AddComponent<GridLayoutGroup>(); g.cellSize = new Vector2(540f, 70f); g.spacing = new Vector2(16f, 10f); g.childAlignment = TextAnchor.UpperCenter; g.constraint = GridLayoutGroup.Constraint.FixedColumnCount; g.constraintCount = 2;
                    return go;
                }
                void Divisoria() { if (divisoria == null) return; var go = Copia(divisoria, col.transform, "divisória"); var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = 4f; le.minHeight = 4f; }

                Linha(explicacao ?? Encontro.GrupoDoSave.TextoDosBotoes, 120f, 20f);
                if (novo != null || continuar != null)
                {
                    var f = Grade(74f);
                    if (continuar != null) Botao(f.transform, T("Continuar campanha (a partida em andamento)", "Continue campaign (the game in progress)"), new Vector2(540f, 70f), () => { FecharMissao(); continuar(); });
                    if (novo != null) Botao(f.transform, rotuloNovo ?? T("Grupo novo (com o inventário inicial do criador)", "New party (with the creator's starting inventory)"), new Vector2(540f, 70f), () => { FecharMissao(); novo(); });
                }
                Divisoria();
                // (as partidas das campanhas oficiais primeiro, destacadas com o selo da Asmodee, como na tela "Carregar campanha"
                //  do jogo; depois as das campanhas da comunidade; em cada grupo, a mais recente primeiro)
                try { Campanha.SavesDaComunidade.ClassificarTodas(); } catch (Exception ex) { Log.Info("partidas da comunidade: " + ex.Message); }
                var saves = Encontro.GrupoDoSave.Saves().Where(x => filtro == null || filtro(x)).OrderBy(x => x.Campanha == null ? 0 : 1).ThenByDescending(x => x.Quando).ToList();   // (v262: o Novo jogo + lista só as partidas terminadas)
                var selo = SeloAsmodee();
                Linha(saves.Count == 0 ? (semNenhuma ?? T("Nenhuma partida gravada do jogo.", "No saved games of the game.")) : (chamada ?? T("Usar meus heróis: escolham a partida gravada", "Use my heroes: choose the saved game")), 40f, 26f);
                const int porPagina = 8;   // (v267: 4 fileiras; com 5, a última ficava embaixo do Voltar e do Mais)
                int paginas = Mathf.Max(1, Mathf.CeilToInt(saves.Count / (float)porPagina)); _paginaSaves = Mathf.Clamp(_paginaSaves, 0, paginas - 1);
                var grade = Grade(4 * 80f);
                foreach (var sv in saves.Skip(_paginaSaves * porPagina).Take(porPagina))
                {
                    var este = sv;
                    var bt = Botao(grade.transform, este.Rotulo + "\n<size=70%>" + este.Detalhe + "</size>", new Vector2(540f, 70f), () =>
                    {
                        Action ir = () => { Log.Info("«Usar meus heróis» com o save " + este.Slot + " («" + este.Nome + "»)"); FecharMissao(); escolher(este); };
                        // (uma partida oficial: o aviso de quando o butim pode voltar a ela)
                        if (avisoOficial != null) Alerta(este.Rotulo + "\n\n" + avisoOficial, T("Continuar", "Continue"), ir);
                        else if (este.Campanha == null) Alerta(T("Partida oficial «", "Official game “") + este.Rotulo + T("»", "”") + "\n\n"
                            + T("No fim desta aventura, o ouro, os itens e as armas oficiais que o grupo ganhar podem voltar para ela, desde que ela fique exatamente como está até lá. Se ela mudar, vocês poderão gravar uma cópia dela com o grupo atualizado, e a original fica como está.",
                                "At the end of this adventure, the gold, items and official weapons the party wins can go back to it, as long as it stays exactly as it is until then. If it changes, you can create a copy of it with the updated party, and the original stays as it is."),
                            T("Continuar", "Continue"), ir);
                        else ir();
                    });
                    if (este.Campanha == null) Destacar(bt, selo);
                    // (v271: o mini botão ao lado: o que vai com a equipe desta partida)
                    if (bagagem.HasValue) MiniBotao(bt, botaoModelo, () => MostrarBagagem(este, bagagem.Value));
                }
                // embaixo: voltar e as paginas
                var cancelar = aviso != null ? Achar(aviso, "Button_Cancel") : null; var seguir = aviso != null ? Achar(aviso, "Button_Proceed") : null;
                Button Embaixo(Transform modelo, string texto, Vector2 pos, Action acao)
                {
                    var go = modelo != null ? Copia(modelo, bg, texto) : Copia(botaoModelo, bg, texto);
                    var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(pos.x < 0 ? 1f : 0f, 0f); r.anchoredPosition = pos; r.sizeDelta = new Vector2(280f, 90f);
                    Texto(go.GetComponentInChildren<TMP_Text>(true), texto);
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => acao()); b.interactable = true;
                    return b;
                }
                Embaixo(cancelar, T("Voltar", "Back"), new Vector2(220f, 80f), () => (aoVoltar ?? FecharMissao)());
                if (paginas > 1) Embaixo(seguir, T("Mais » ", "More » ") + (_paginaSaves + 1) + "/" + paginas, new Vector2(-220f, 80f), () => { Som("UI_Click"); _paginaSaves = (_paginaSaves + 1) % paginas; AbrirSaves(titulo, novo, escolher, continuar, aoVoltar, explicacao, rotuloNovo, filtro, avisoOficial, chamada, semNenhuma, bagagem); });
                _missao.transform.SetAsLastSibling();
                if (cg != null) { if (_paginaSaves == 0) Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null)); else cg.alpha = 1f; }
                Log.Info("usar meus heróis: " + saves.Count + " partida(s) gravada(s)");
            }
            catch (Exception ex) { Log.Erro("lista de partidas gravadas", ex); if (_missao != null) UnityEngine.Object.Destroy(_missao); _missao = null; Lancou(T("Não consegui abrir a lista de partidas gravadas.", "Could not open the list of saved games.")); }
        }

        // ------------------------------------------------ v271: o que vai com a equipe
        static GameObject _bagagem;
        static void FecharBagagem() { if (_bagagem == null) return; var b = _bagagem; _bagagem = null; var c = b.GetComponent<CanvasGroup>(); if (c != null) Nucleo.Instancia.StartCoroutine(Fade(c, 0f, () => UnityEngine.Object.Destroy(b))); else UnityEngine.Object.Destroy(b); }

        /// <summary>v275: a cor do mini botão (âmbar, sobre a arte do botão do jogo).</summary>
        static readonly Color CorDoMiniBotao = new Color(1f, 0.72f, 0.22f);
        /// <summary>O mini botão no canto esquerdo da ficha de uma partida (v275; antes, no direito): abre o quadro do que vai com a equipe.</summary>
        static void MiniBotao(Button ficha, Transform modelo, Action acao)
        {
            try
            {
                // (v282: menor)
                float largura = 8f + 40f + 8f;
                // (o texto da ficha da partida abre espaço à esquerda para eles)
                foreach (var tx in ficha.GetComponentsInChildren<TMP_Text>(true)) { var rt = tx.rectTransform; rt.offsetMin = new Vector2(rt.offsetMin.x + largura, rt.offsetMin.y); }
                var go = Copia(modelo, ficha.transform, "mini bagagem");
                var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.ignoreLayout = true;
                // (v275: no canto esquerdo, e em outra cor, para se ver que é um botão)
                var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(0f, 0.5f); r.pivot = new Vector2(0f, 0.5f); r.sizeDelta = new Vector2(40f, 40f); r.anchoredPosition = new Vector2(8f, 0f);
                foreach (var dd in go.GetComponentsInChildren<TMP_Dropdown>(true)) dd.gameObject.SetActive(false);
                foreach (var img in go.GetComponentsInChildren<Image>(true)) img.color = CorDoMiniBotao;
                var t = go.GetComponentInChildren<TMP_Text>(true); if (t != null) { Texto(t, "<b>?</b>"); t.enableAutoSizing = false; t.fontSize = 24f; t.alignment = TextAlignmentOptions.Center; t.color = new Color(0.16f, 0.09f, 0.02f); }   // (v279: «?» em vez de «i», mais claro como botão)
                var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); acao(); }); b.interactable = true;
            }
            catch (Exception ex) { Log.Info("mini botão da bagagem: " + ex.Message); }
        }


        /// <summary>O quadro "O que vai com a equipe": o ouro, as proezas, a Caveira Imortal, as armas, as armaduras, os itens e as
        /// fraquezas e resistências descobertas da partida, numa lista que rola, no quadro de partida do proprio jogo.</summary>
        static void MostrarBagagem(Encontro.GrupoDoSave.Save save, bool novoJogoMais)
        {
            try
            {
                if (_bagagem != null) UnityEngine.Object.Destroy(_bagagem);
                var raiz = _tela.transform;
                var editar = Achar(raiz, "Canvas_EditSaveSlot"); var aviso = Achar(raiz, "Canvas_LoadBackupWarning");
                if (editar == null) throw new Exception("sem o quadro do jogo");
                _bagagem = Copia(editar, raiz, "bagagem");
                var fundoBtn = _bagagem.GetComponent<Button>(); if (fundoBtn != null) fundoBtn.onClick.AddListener(FecharBagagem);
                var cg = _bagagem.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 0f; cg.interactable = true; cg.blocksRaycasts = true; }
                var bg = Achar(_bagagem.transform, "Image_BG") as RectTransform; if (bg == null) throw new Exception("sem Image_BG");
                bg.sizeDelta = new Vector2(1260f, 860f); bg.anchoredPosition = Vector2.zero;
                var bgBtn = bg.gameObject.AddComponent<Button>(); bgBtn.transition = Selectable.Transition.None;
                var tituloT = Achar(bg, "Text_PartyName")?.GetComponent<TMP_Text>();
                if (tituloT != null) { var rt = tituloT.transform as RectTransform; rt.sizeDelta = new Vector2(1150f, 56f); rt.anchoredPosition = new Vector2(0f, -60f); }
                Texto(tituloT, save.Rotulo + T(" · o que vai com a equipe", " · what goes with the party"));
                var cor = tituloT != null ? tituloT.color : new Color(0.93f, 0.8f, 0.55f);
                var opcoes = Achar(bg, "Layout_Options");
                var rotuloModelo = Achar(opcoes, "Label_RestoreDesc"); var divisoria = Achar(opcoes, "Imade_Divider");
                if (opcoes != null) opcoes.gameObject.SetActive(false);
                if (rotuloModelo == null) throw new Exception("sem o modelo de texto");

                // a lista que rola: a janela (com máscara) e o conteúdo, que cresce com as linhas
                var janela = new GameObject("Bigorna rolagem", typeof(RectTransform)); janela.transform.SetParent(bg, false);
                var rj = janela.GetComponent<RectTransform>(); rj.anchorMin = Vector2.zero; rj.anchorMax = Vector2.one; rj.offsetMin = new Vector2(70f, 140f); rj.offsetMax = new Vector2(-70f, -110f);
                var img = janela.AddComponent<Image>(); img.color = new Color(0f, 0f, 0f, 0.001f); janela.AddComponent<RectMask2D>();
                var conteudo = new GameObject("Bigorna conteúdo", typeof(RectTransform)); conteudo.transform.SetParent(janela.transform, false);
                var rcn = conteudo.GetComponent<RectTransform>(); rcn.anchorMin = new Vector2(0f, 1f); rcn.anchorMax = new Vector2(1f, 1f); rcn.pivot = new Vector2(0.5f, 1f); rcn.offsetMin = rcn.offsetMax = Vector2.zero;
                var v = conteudo.AddComponent<VerticalLayoutGroup>(); v.spacing = 6f; v.padding = new RectOffset(10, 24, 4, 12); v.childAlignment = TextAnchor.UpperLeft; v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandWidth = true; v.childForceExpandHeight = false;
                var csf = conteudo.AddComponent<ContentSizeFitter>(); csf.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
                var sr = janela.AddComponent<ScrollRect>(); sr.content = rcn; sr.viewport = rj; sr.horizontal = false; sr.vertical = true; sr.movementType = ScrollRect.MovementType.Clamped; sr.scrollSensitivity = 40f; sr.inertia = true;
                TMP_Text Linha(string texto, float tamanho, TextAlignmentOptions alinha, Color? c = null, bool italico = false)
                {
                    var go = Copia(rotuloModelo, conteudo.transform, "texto"); var t = go.GetComponent<TMP_Text>(); Texto(t, italico ? "<i>" + texto + "</i>" : texto);
                    t.fontSize = tamanho; t.enableAutoSizing = false; t.alignment = alinha; t.enableWordWrapping = true; t.overflowMode = TextOverflowModes.Overflow; if (c.HasValue) t.color = c.Value;
                    var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = -1f; le.minHeight = -1f; le.flexibleHeight = -1f;   // (a altura é a do texto: o TMP diz quanto precisa)
                    var f = go.GetComponent<ContentSizeFitter>(); if (f != null) UnityEngine.Object.Destroy(f);
                    return t;
                }
                void Divisoria() { if (divisoria == null) return; var go = Copia(divisoria, conteudo.transform, "divisória"); var le = go.GetComponent<LayoutElement>() ?? go.AddComponent<LayoutElement>(); le.preferredHeight = 4f; le.minHeight = 4f; }

                // (v279: o texto que explica a lista)
                Linha(novoJogoMais ? T("Lista de coisas que serão aproveitadas da sua equipe na partida nova do Novo jogo +. O save de onde ela vem fica como está.", "List of the things from your party that will be used in the new New Game + game. The save it comes from stays as it is.")
                                   : T("Lista de coisas que serão aproveitadas da sua equipe. Ao final da aventura, você pode optar por levar o que adquiriu nela e adicionar ao seu save.", "List of the things from your party that will be used. At the end of the adventure, you can choose to take what you got in it and add it to your save."),
                    20f, TextAlignmentOptions.Center);
                bool primeira = true;
                foreach (var secao in Encontro.Bagagem.Montar(save, novoJogoMais))
                {
                    if (!primeira) Divisoria(); primeira = false;
                    Linha(secao.Titulo, 26f, TextAlignmentOptions.Left, cor);
                    foreach (var l in secao.Linhas) Linha(l, 19f, TextAlignmentOptions.Left);
                    if (!string.IsNullOrEmpty(secao.Nota)) Linha(secao.Nota, 17f, TextAlignmentOptions.Left, new Color(0.75f, 0.72f, 0.66f), true);
                }

                // embaixo: voltar
                var cancelar = aviso != null ? Achar(aviso, "Button_Cancel") : null;
                if (cancelar != null)
                {
                    var go = Copia(cancelar, bg, "voltar"); var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(0.5f, 0f); r.anchoredPosition = new Vector2(0f, 80f); r.sizeDelta = new Vector2(280f, 90f);
                    Texto(go.GetComponentInChildren<TMP_Text>(true), T("Voltar", "Back"));
                    var b = go.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); FecharBagagem(); }); b.interactable = true;
                }
                _bagagem.transform.SetAsLastSibling();
                Canvas.ForceUpdateCanvases(); sr.verticalNormalizedPosition = 1f;
                if (cg != null) Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null));
                Log.Info("o que vai com a equipe: save " + save.Slot + " («" + save.Nome + "»)" + (novoJogoMais ? ", Novo jogo +" : ", mapa oneshot"));
            }
            catch (Exception ex) { Log.Erro("o que vai com a equipe", ex); if (_bagagem != null) UnityEngine.Object.Destroy(_bagagem); _bagagem = null; }
        }

        /// <summary>Um aviso no quadro de aviso do proprio jogo (o de carregar a copia de seguranca): o texto, voltar e seguir.</summary>
        static GameObject _alerta;
        static void Alerta(string texto, string seguir, Action aoSeguir)
        {
            try
            {
                if (_alerta != null) UnityEngine.Object.Destroy(_alerta);
                var raiz = _tela.transform; var modelo = Achar(raiz, "Canvas_LoadBackupWarning"); if (modelo == null) { aoSeguir(); return; }
                _alerta = Copia(modelo, raiz, "alerta"); var go = _alerta;
                var cg = go.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 0f; cg.interactable = true; cg.blocksRaycasts = true; }
                var quadro = Achar(go.transform, "Image_WarningMessage") as RectTransform; if (quadro != null) quadro.sizeDelta = new Vector2(980f, 560f);
                var t = Achar(go.transform, "Text_Warning")?.GetComponent<TMP_Text>(); if (t != null) { Texto(t, texto); t.enableAutoSizing = true; t.fontSizeMin = 16f; t.fontSizeMax = 30f; t.enableWordWrapping = true; t.alignment = TextAlignmentOptions.Center; }
                void Fechar() { if (_alerta == null) return; var a = _alerta; _alerta = null; var c = a.GetComponent<CanvasGroup>(); Nucleo.Instancia.StartCoroutine(Fade(c, 0f, () => UnityEngine.Object.Destroy(a))); }
                var cancelar = Achar(go.transform, "Button_Cancel"); var ok = Achar(go.transform, "Button_Proceed");
                if (cancelar != null) { Texto(cancelar.GetComponentInChildren<TMP_Text>(true), T("Voltar", "Back")); var b = cancelar.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); Fechar(); }); b.interactable = true; }
                if (ok != null) { Texto(ok.GetComponentInChildren<TMP_Text>(true), seguir); var b = ok.GetComponent<Button>(); b.onClick.AddListener(() => { Som("UI_Click"); var a = _alerta; _alerta = null; if (a != null) UnityEngine.Object.Destroy(a); aoSeguir(); }); b.interactable = true; }
                go.transform.SetAsLastSibling();
                if (cg != null) Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null));
            }
            catch (Exception ex) { Log.Erro("aviso", ex); if (_alerta != null) UnityEngine.Object.Destroy(_alerta); _alerta = null; aoSeguir(); }
        }

        /// <summary>O selo da Asmodee das fichas de partida gravada do jogo (o da sincronizacao na nuvem).</summary>
        static Sprite SeloAsmodee()
        {
            try { var p = Cena?.CampaignLoad?.SaveSlotPool?.Prefab; var t = p != null ? Achar(p.transform, "Image_Logo") : null; return t != null ? t.GetComponent<Image>()?.sprite : null; }
            catch { return null; }
        }

        /// <summary>Uma partida de campanha oficial na lista: contorno dourado, texto dourado e o selo da Asmodee a direita.</summary>
        static void Destacar(Button b, Sprite selo)
        {
            try
            {
                var img = b.GetComponent<Image>(); if (img != null) { var ol = b.gameObject.AddComponent<Outline>(); ol.effectColor = new Color(0.95f, 0.78f, 0.38f, 1f); ol.effectDistance = new Vector2(3f, -3f); }
                var t = b.GetComponentInChildren<TMP_Text>(true); if (t != null) { t.color = new Color(1f, 0.86f, 0.55f, 1f); var m = t.margin; t.margin = new Vector4(m.x, m.y, Mathf.Max(m.z, 110f), m.w); }
                if (selo == null) return;
                var go = new GameObject("Bigorna selo Asmodee", typeof(RectTransform)); go.transform.SetParent(b.transform, false);
                var le = go.AddComponent<LayoutElement>(); le.ignoreLayout = true;
                var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(1f, 0.5f); rt.pivot = new Vector2(1f, 0.5f); rt.sizeDelta = new Vector2(92f, 33f); rt.anchoredPosition = new Vector2(-14f, 0f);
                var im = go.AddComponent<Image>(); im.sprite = selo; im.preserveAspect = true; im.raycastTarget = false;
                go.transform.SetAsLastSibling();
            }
            catch (Exception ex) { Log.Info("destaque da partida oficial: " + ex.Message); }
        }

        static void Lancou(string erro)
        {
            // (v267: no Mapa oneshot e no Novo jogo +, o erro fica num aviso na propria tela; antes abria o painel antigo dos mapas)
            if (erro != null && _oneshot && _tela != null && _tela.activeSelf) { Log.Info("tela de mapas: " + erro); Alerta(erro, T("Entendi", "OK"), () => { }); return; }
            if (erro != null) { Log.Info("tela de mapas: " + erro); Fechar(); Nucleo.Visivel = true; PainelMapas.MostrarErro(erro, _aba > 2 ? 1 : _aba); return; }
            if (_tela != null) _tela.SetActive(false);
            try { Cena.MainCameraBlur.enabled = false; } catch { }
        }


        /// <summary>Um mapa (ou campanha) em varias linguas: tocar numa bandeira da ficha escolhe a lingua dele (fica guardada).</summary>
        static Action<string> EscolherLingua(string caminho) => l => { Formato.Traducao.Definir(Formato.Traducao.Chave(caminho), l); Log.Info("língua escolhida para «" + System.IO.Path.GetFileName(caminho) + "»: " + l); PainelMapas.Reler(); Preencher(); };

        static void Ficha(int numero, string nome, string resumo, DateTime data, string autor, Act ato, string jogar, Action aoJogar, string outro, Action aoOutro, string detalhe = null, string lingua = null, string linguaEmUso = null, Action<string> aoEscolherLingua = null)
        {
            var lc = Cena.CampaignLoad; var go = UnityEngine.Object.Instantiate(lc.SaveSlotPool.Prefab, _grade, false); go.name = "Bigorna ficha " + numero;
            go.SetActive(true); var lp = go.transform.localPosition; go.transform.localPosition = new Vector3(lp.x, lp.y, 0f); go.transform.localScale = Vector3.one;
            var s = go.GetComponent<UISaveSlot>();
            if (s != null)
            {
                Texto(s.LabelPartyName, nome); Texto(s.LabelSlotIndex, numero.ToString());
                Texto(s.LabelLastLocation, string.IsNullOrEmpty(autor) ? resumo : resumo + " · " + autor);
                Texto(s.LabelLastPlayDate, data == DateTime.MinValue ? "" : Data(data));
                Texto(s.LabelTotalPlayTime, "");
                if (s.SaveSlotComponents != null) { s.SaveSlotComponents.gameObject.SetActive(true); s.SaveSlotComponents.alpha = 1f; }
                if (s.LoadingComponents != null) { s.LoadingComponents.alpha = 0f; s.LoadingComponents.gameObject.SetActive(false); }
                if (s.SelectedTray != null) s.SelectedTray.SetActive(false);
                if (s.SaveSlotInfoContainer != null) s.SaveSlotInfoContainer.SetActive(true);
                foreach (var g in new[] { s.AsmoConnectInfoContainer, s.LabelCopiedToClipboard, s.AsmoConnectSynced, s.AsmoConnectNotSynced }) if (g != null) g.SetActive(false);
                if (s.LabelGUIDDebug != null) s.LabelGUIDDebug.gameObject.SetActive(false);
                try { var pr = UserCollectionManager.GetProducts(ownedOnly: false).FirstOrDefault(x => x.Type != ProductType.SmallBox && x.Act == ato); if (pr != null && s.CampaignProductBox != null) s.CampaignProductBox.sprite = Jogo.Persistente.ABLoader.LoadAsset<Sprite>(pr.TextureAssetPath); } catch { }
            }
            var bandeja = s != null ? s.SelectedTray : null;
            // os botoes da ficha: tocar seleciona (a bandeja aparece); na bandeja, carregar joga; um segundo botao recomeca uma
            // campanha comecada; os outros (apagar, editar, a nuvem) saem
            bool usouOutro = false;
            foreach (var b in go.GetComponentsInChildren<Button>(true))
            {
                var m = Metodo(b); b.onClick = new Button.ButtonClickedEvent();
                if (m == "OnSelectSlot" || (bandeja != null && !b.transform.IsChildOf(bandeja.transform) && m.Length == 0 && b.transform == go.transform))
                    b.onClick.AddListener(() => { Som("UI_Click"); Selecionar(bandeja); });
                else if (m == "OnLoadClicked") { b.onClick.AddListener(() => { Som("UI_Embark"); aoJogar(); }); Texto(b.GetComponentInChildren<TMP_Text>(true), jogar); }
                else if (bandeja != null && b.transform.IsChildOf(bandeja.transform) && aoOutro != null && !usouOutro) { usouOutro = true; b.onClick.AddListener(() => { Som("UI_Embark"); aoOutro(); }); Texto(b.GetComponentInChildren<TMP_Text>(true), outro); }
                else b.gameObject.SetActive(false);
            }
            if (detalhe != null && s != null && bandeja != null) TextoNaBandeja(bandeja, s.LabelLastLocation, detalhe);
            if (detalhe != null && s != null && s.LabelLastLocation != null) { s.LabelLastLocation.enableWordWrapping = false; s.LabelLastLocation.overflowMode = TextOverflowModes.Ellipsis; }
            if (s != null) UnityEngine.Object.DestroyImmediate(s);
            if (!string.IsNullOrEmpty(lingua)) PorBandeiras(go, lingua, linguaEmUso, aoEscolherLingua);
            _fichas.Add(go);
        }

        /// <summary>As bandeiras da lingua de uma entrada do acervo, no canto de cima a direita da ficha. Num mapa em varias
        /// linguas, cada bandeira e um botao: a lingua em uso acesa, as outras apagadas.</summary>
        static void PorBandeiras(GameObject ficha, string lingua, string emUso = null, Action<string> escolher = null)
        {
            try
            {
                var bs = Acervo.Bandeiras.Da(lingua); var r = ficha.transform as RectTransform; if (bs.Count == 0 || r == null) return;
                var cods = (lingua ?? "").Split(',').Select(Acervo.Bandeiras.Codigo).Where(k => Acervo.BandeirasPng.Base64.ContainsKey(k)).ToList();
                for (int i = 0; i < bs.Count; i++)
                {
                    var go = new GameObject("Bigorna bandeira " + i, typeof(RectTransform)); go.transform.SetParent(ficha.transform, false);
                    var le = go.AddComponent<LayoutElement>(); le.ignoreLayout = true;
                    var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f); rt.pivot = new Vector2(1f, 1f);
                    rt.sizeDelta = new Vector2(39f, 26f); rt.anchoredPosition = new Vector2(-14f - (bs.Count - 1 - i) * 45f, -12f);
                    var img = go.AddComponent<Image>(); img.sprite = bs[i]; img.preserveAspect = true; img.raycastTarget = false;
                    if (escolher != null && i < cods.Count)
                    {
                        var cod = cods[i]; bool acesa = cod == Acervo.Bandeiras.Codigo(emUso);
                        img.color = new Color(1f, 1f, 1f, acesa ? 1f : 0.4f); img.raycastTarget = true;
                        if (acesa) { var ol = go.AddComponent<Outline>(); ol.effectColor = new Color(0.95f, 0.8f, 0.45f, 1f); ol.effectDistance = new Vector2(2f, -2f); }
                        var bt = go.AddComponent<Button>(); bt.targetGraphic = img; bt.onClick.AddListener(() => { Som("UI_Click"); if (!acesa) escolher(cod); });
                    }
                    go.transform.SetAsLastSibling();
                }
            }
            catch (Exception ex) { Log.Info("tela de mapas: bandeira " + ex.Message); }
        }

        /// <summary>A bandeja de uma ficha com texto longo (a descricao de uma missao oficial): o texto inteiro, em azul, sobre o fundo
        /// da bandeja, e o botao a direita.</summary>
        static void TextoNaBandeja(GameObject bandeja, TMP_Text modelo, string texto)
        {
            try
            {
                var hl = bandeja.GetComponent<HorizontalLayoutGroup>(); if (hl != null) hl.enabled = false;
                var fundo = bandeja.transform.Find("Image_BG") as RectTransform; var pai = fundo != null ? fundo : bandeja.transform as RectTransform;
                // (os botoes ativos lado a lado, da direita para a esquerda: o de jogar na ponta; um em cima do outro, so o
                //  ultimo aparecia, e o "Usar meus herois" de um mapa ou campanha sumia atras do "Grupo novo")
                var ativos = bandeja.GetComponentsInChildren<Button>(true).Where(b => b.gameObject.activeSelf).ToList(); float x = 0f;
                for (int i = ativos.Count - 1; i >= 0; i--)
                {
                    var r = ativos[i].GetComponent<RectTransform>();
                    r.anchorMin = r.anchorMax = new Vector2(1f, 0.5f); r.pivot = new Vector2(1f, 0.5f); r.anchoredPosition = new Vector2(-x, 0f); x += r.sizeDelta.x + 12f;
                }
                var go = UnityEngine.Object.Instantiate(modelo.gameObject, pai, false); go.name = "Bigorna texto inteiro"; go.SetActive(true);
                SemTraducao(go); var le = go.GetComponent<LayoutElement>(); if (le != null) le.ignoreLayout = true;
                var rt = go.GetComponent<RectTransform>(); rt.anchorMin = new Vector2(0f, 0f); rt.anchorMax = new Vector2(1f, 1f); rt.pivot = new Vector2(0.5f, 0.5f);
                rt.offsetMin = new Vector2(20f, 10f); rt.offsetMax = new Vector2(-(Mathf.Max(200f, x) + 28f), -10f);
                var t = go.GetComponent<TMP_Text>(); t.text = texto; t.enableWordWrapping = true; t.enableAutoSizing = true; t.fontSizeMin = 11f; t.fontSizeMax = 20f;
                t.overflowMode = TextOverflowModes.Ellipsis; t.alignment = TextAlignmentOptions.MidlineLeft;
            }
            catch (Exception ex) { Log.Info("tela de mapas: texto na bandeja " + ex.Message); }
        }

        static void Selecionar(GameObject bandeja)
        {
            if (_bandejaAberta != null && _bandejaAberta != bandeja) _bandejaAberta.SetActive(false);
            if (bandeja == null) return;
            bandeja.SetActive(true); var cg = bandeja.GetComponent<CanvasGroup>(); if (cg != null) { cg.alpha = 0f; Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null)); }
            _bandejaAberta = bandeja;
        }

        /// <summary>Uma vez por sessao: a arvore da tela de carregar campanha e da ficha, em bigorna-telas.txt (ao lado do registro),
        /// para acertar a copia sem ver o jogo.</summary>
        static bool _retratado;
        static void Retrato(Transform tela, Transform ficha)
        {
            if (_retratado) return; _retratado = true;
            try
            {
                var sb = new StringBuilder();
                void Arvore(Transform t, int nivel)
                {
                    var r = t as RectTransform; var tx = t.GetComponent<TMP_Text>(); var b = t.GetComponent<Button>();
                    sb.Append(new string(' ', nivel * 2)).Append(t.name).Append(t.gameObject.activeSelf ? "" : " (desligado)")
                      .Append(" [").Append(string.Join(",", t.GetComponents<Component>().Where(c => c != null).Select(c => c.GetType().Name).ToArray())).Append("]");
                    if (r != null) sb.Append(" ancora ").Append(r.anchorMin).Append(r.anchorMax).Append(" pos ").Append(r.anchoredPosition).Append(" tam ").Append(r.sizeDelta);
                    if (tx != null) sb.Append(" texto «").Append(tx.text).Append("» fonte ").Append(tx.font != null ? tx.font.name : "?").Append(" ").Append(tx.fontSize);
                    if (b != null) sb.Append(" botão→").Append(Metodo(b));
                    var gl = t.GetComponent<GridLayoutGroup>(); if (gl != null) sb.Append(" grade ").Append(gl.cellSize).Append(" esp ").Append(gl.spacing).Append(" ").Append(gl.constraint).Append(" ").Append(gl.constraintCount);
                    sb.AppendLine();
                    for (int i = 0; i < t.childCount; i++) Arvore(t.GetChild(i), nivel + 1);
                }
                sb.AppendLine("== tela de carregar campanha =="); Arvore(tela, 0);
                sb.AppendLine("== ficha de partida gravada (modelo) =="); Arvore(ficha, 0);
                File.WriteAllText(Path.Combine(Path.GetDirectoryName(Bootstrap.CaminhoLog), "bigorna-telas.txt"), sb.ToString());
            }
            catch (Exception ex) { Log.Info("tela de mapas: retrato " + ex.Message); }
        }
    }
}
