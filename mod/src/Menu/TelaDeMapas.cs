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

        public static bool Aberta => _tela != null && _tela.activeSelf;

        static TitlesceneController Cena => SingletonBehaviour<TitlesceneController>.IsInitialized ? SingletonBehaviour<TitlesceneController>.Instance : null;

        /// <summary>Abre a tela; falso se nao deu (o painel antigo abre no lugar).</summary>
        public static bool Abrir()
        {
            if (_falhou) return false;
            try
            {
                if (!Montar()) { _falhou = true; return false; }
                PainelMapas.Reler();
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

        static IEnumerator Fade(CanvasGroup cg, float alvo, Action fim)
        {
            if (cg != null) { float de = cg.alpha, t = 0f; while (t < 0.35f) { t += Time.unscaledDeltaTime; cg.alpha = Mathf.Lerp(de, alvo, t / 0.35f); yield return null; } cg.alpha = alvo; }
            fim?.Invoke();
        }

        /// <summary>A cena de titulo saiu: a copia sai com ela (a proxima visita monta de novo).</summary>
        public static void Esquecer() { _missao = null; _tela = null; _grade = null; _fichas.Clear(); _abas.Clear(); _modeloBotao = null; _vazio = null; _bandejaAberta = null; }

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
                if (m == "OnBackClicked") { b.onClick = new Button.ButtonClickedEvent(); b.onClick.AddListener(Fechar); if (_modeloBotao == null) _modeloBotao = b; }
            }
            // o titulo: o maior texto fora da grade e das janelas desligadas
            var titulo = _tela.GetComponentsInChildren<TMP_Text>(true).Where(t => t.gameObject.activeInHierarchy || EmCaminhoLigado(t.transform, raiz)).Where(t => !t.transform.IsChildOf(_grade) && (_vazio == null || !t.transform.IsChildOf(_vazio.transform)) && t.GetComponentInParent<Button>(true) == null)
                .OrderByDescending(t => t.fontSize).FirstOrDefault();
            if (titulo != null) Texto(titulo, T("Mapas da comunidade", "Community maps"));
            MontarAbas(raiz, titulo);
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
            // a loja (como no Valkyrie): mapas e campanhas para baixar; pacotes da Oficina que os mapas exigem
            _abas.Add(Botao(cima, T("Baixar mapas", "Download maps"), () => { _aba = 3; LerLoja(); }));
            _abas.Add(Botao(cima, T("Pacotes", "Packages"), () => { _aba = 4; LerLoja(); }));
            var baixo = Fileira("Bigorna ferramentas", new Vector2(0.5f, 0f), 60f);
            Botao(baixo, T("Abrir pasta", "Open folder"), PainelMapas.AbrirAPasta);
            if (Dados.DadosDoEditor.EditorInstalado) Botao(baixo, T("Abrir editor", "Open editor"), Dados.DadosDoEditor.AbrirEditor);
            Botao(baixo, T("Relatar um problema", "Report a problem"), () => { Nucleo.Visivel = true; Relatos.Alternar(); });
            Botao(baixo, Pt ? "English" : "Português", () => { Definir(!Pt); var era = _tela; Esquecer(); if (era != null) UnityEngine.Object.Destroy(era); if (Montar()) { PainelMapas.Reler(); Preencher(); Mostrar(); } });
        }

        /// <summary>As fichas da aba: uma por campanha ou mapa avulso, do modelo das partidas gravadas.</summary>
        static void Preencher()
        {
            if (_tela == null || _grade == null) return;
            foreach (var f in _fichas) if (f != null) UnityEngine.Object.Destroy(f);
            _fichas.Clear(); _bandejaAberta = null;
            var lc = Cena?.CampaignLoad; var modelo = lc?.SaveSlotPool?.Prefab; if (modelo == null) return;
            for (int i = 0; i < _abas.Count; i++) { var t = _abas[i].GetComponentInChildren<TMP_Text>(true); if (t != null) t.alpha = i == _aba ? 1f : 0.55f; }
            int n = 0;
            if (_aba == 0)
                foreach (var c in PainelMapas.Campanhas)
                {
                    var p = PainelMapas.ProgressoDe(c); bool comecada = p.Completados.Count > 0;
                    var resumo = c.Nos.Count(x => x.EhMapa) + T(" mapa(s)", " map(s)") + (comecada ? " · " + p.Completados.Count + T(" concluído(s)", " done") : "");
                    Ficha(++n, c.NomeVisivel, resumo, PainelMapas.AlteradoEm(c), c.Metadados?.Autor, AtoExigido.Ato2(c) ? Act.ActII : Act.ActI,
                        comecada ? T("Continuar", "Continue") : T("Jogar", "Play"), () => { var e = Campanha.Campanha.Comecar(c, false); Lancou(e); },
                        comecada ? T("Recomeçar", "Restart") : null, comecada ? (Action)(() => { var e = Campanha.Campanha.Comecar(c, true); Lancou(e); }) : null);
                }
            else if (_aba == 1)
                foreach (var m in PainelMapas.Mapas)
                    Ficha(++n, m.NomeVisivel, m.Resumo(Pt), PainelMapas.AlteradoEm(m), m.Metadados?.Autor, AtoExigido.Ato2(m) ? Act.ActII : Act.ActI, T("Jogar", "Play"), () => { var e = Lancador.Lancar(m); Lancou(e); }, null, null);
            else if (_aba == 3 || _aba == 4)
                n = FichasDaLoja(_aba == 4);
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
                if (n == 0 && _aba >= 3) Texto(_textoVazio, Loja.Loja.Lendo || !Loja.Loja.Leu ? T("Consultando a loja…", "Asking the store…") : Loja.Loja.SemConexao ? T("Sem conexão com a loja. Confira a internet e toque na aba de novo.", "No connection to the store. Check the internet and tap the tab again.")
                                                     : _aba == 3 ? T("A loja ainda não tem mapas.", "The store has no maps yet.") : T("A loja ainda não tem pacotes.", "The store has no packages yet."));
                else if (n == 0) Texto(_textoVazio, _aba == 2 ? T("Nenhuma missão do jogo encontrada na sua coleção.", "No game quests found in your collection.") : _aba == 0 ? T("Nenhuma campanha na pasta de mapas. No editor, «Create campaign» e depois «Export campaign».", "No campaigns in the maps folder. In the editor, use \"Create campaign\" and then \"Export campaign\".")
                                                     : T("Nenhum mapa avulso na pasta de mapas. Exporte um mapa no editor.", "No standalone maps in the maps folder. Export a map in the editor."));
            }
        }

        // ------------------------------------------------ a loja
        /// <summary>Le o indice da loja de novo (a cada toque na aba) e refaz as fichas quando chegar.</summary>
        static void LerLoja()
        {
            Preencher();
            Nucleo.Instancia.StartCoroutine(Loja.Loja.LerIndice(() => { if (_tela != null && (_aba == 3 || _aba == 4)) Preencher(); }));
        }

        static readonly HashSet<string> _confirmarRemocao = new HashSet<string>();

        static DateTime DataDa(Loja.Ficha f)
        {
            DateTime d; var t = f.Publicado ?? f.Data;
            return !string.IsNullOrEmpty(t) && DateTime.TryParseExact(t.Length > 10 ? t.Substring(0, 10) : t, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out d) ? d : DateTime.MinValue;
        }

        static string Lingua(string l) => string.IsNullOrEmpty(l) ? "" : string.Join("/", l.Split(',').Select(x => x.Trim() == "pt" ? "PT" : x.Trim() == "en" ? "EN" : x.Trim().ToUpperInvariant()).ToArray());

        /// <summary>As fichas da loja: os mapas e campanhas (aba 3) ou os pacotes (aba 4), primeiro os da lingua de quem joga.</summary>
        static int FichasDaLoja(bool pacotes)
        {
            var L = Loja.Loja.Itens.Where(f => f.EhPacote == pacotes)
                .OrderByDescending(f => (f.Lingua ?? "").Contains(Pt ? "pt" : "en")).ThenByDescending(DataDa).ToList();
            int n = 0;
            foreach (var f in L)
            {
                int tem = Loja.Loja.Instalada(f);
                var faltam = pacotes ? new List<Loja.Requisito>() : Loja.Loja.PacotesParaBaixar(f);
                Loja.Loja.Situacao.TryGetValue(f.Id, out var sit); bool ocupado = sit != null && sit.EndsWith("…");
                string tipo = f.Tipo == "campanha" ? T("Campanha", "Campaign") + (f.Conteudo?["mapas"] != null ? " · " + (int)f.Conteudo["mapas"] + T(" mapa(s)", " map(s)") : "")
                            : f.Tipo == "mapa" ? T("Mapa", "Map") : T("Pacote", "Package") + (f.Conteudo?["entradas"] != null ? " · " + (int)f.Conteudo["entradas"] + T(" entrada(s)", " entries") : "");
                var partes = new List<string> { tipo };
                if (!string.IsNullOrEmpty(f.Lingua)) partes.Add(Lingua(f.Lingua));
                if (tem > 0) partes.Add(tem < f.Edicao ? T("edição nova: ", "new edition: ") + f.Edicao : T("instalado", "installed"));
                if (!pacotes && f.Requer.Count > 0) partes.Add(T("precisa de ", "needs ") + f.Requer.Count + T(" pacote(s)", " package(s)"));
                // o texto inteiro, na bandeja: o resumo, os pacotes exigidos, o que esta acontecendo
                var det = new List<string>();
                if (!string.IsNullOrEmpty(f.Resumo)) det.Add(f.Resumo);
                if (!pacotes && f.Requer.Count > 0) det.Add(T("Precisa de: ", "Needs: ") + string.Join(", ", f.Requer.Select(q => (q.Nome ?? q.Id) + (Loja.Pacotes.EdicaoInstalada(q.Id) >= q.Edicao ? " ✓" : "")).ToArray()));
                if (pacotes) { var quem = Loja.Loja.QuemExige(f.Id); if (quem.Count > 0) det.Add(T("Usado por: ", "Used by: ") + string.Join(", ", quem.ToArray())); }
                det.Add(T("Edição ", "Edition ") + f.Edicao + (tem > 0 && tem < f.Edicao ? T(" (você tem a ", " (you have ") + tem + ")" : ""));
                if (sit != null) det.Insert(0, sit);
                if (_confirmarRemocao.Contains(f.Id)) det.Insert(0, T("Toque em Remover de novo para confirmar.", "Tap Remove again to confirm."));
                string principal; Action acao;
                if (ocupado) { principal = sit; acao = () => { }; }
                else if (tem == 0) { principal = T("Baixar", "Download"); acao = () => Baixar(f); }
                else if (tem < f.Edicao) { principal = T("Atualizar", "Update"); acao = () => Baixar(f); }
                else if (faltam.Count > 0) { principal = T("Baixar pacotes", "Get packages"); acao = () => Baixar(f); }
                else if (!pacotes) { principal = T("Jogar", "Play"); acao = () => JogarDaLoja(f); }
                else { principal = T("Instalado", "Installed"); acao = () => { }; }
                bool daLoja = Loja.Loja.Registro.EdicaoDe(f.Id) > 0;
                Ficha(++n, f.Nome ?? f.Id, string.Join(" · ", partes.ToArray()), DataDa(f), f.Autor, f.Ato >= 2 ? Act.ActII : Act.ActI, principal, acao,
                    daLoja && !ocupado ? T("Remover", "Remove") : null, daLoja && !ocupado ? (Action)(() => RemoverDaLoja(f)) : null, string.Join("\n", det.ToArray()));
            }
            return n;
        }

        static void Baixar(Loja.Ficha f) { _confirmarRemocao.Clear(); Nucleo.Instancia.StartCoroutine(Loja.Loja.Baixar(f, () => { if (_tela != null && _aba >= 3) { PainelMapas.Reler(); Preencher(); } })); }

        static void RemoverDaLoja(Loja.Ficha f)
        {
            if (!_confirmarRemocao.Contains(f.Id)) { _confirmarRemocao.Clear(); _confirmarRemocao.Add(f.Id); Preencher(); return; }
            _confirmarRemocao.Clear(); Loja.Loja.Remover(f); PainelMapas.Reler(); Preencher();
        }

        /// <summary>"Jogar" numa ficha da loja: a campanha ou o mapa que ela instalou, como nas abas de cima.</summary>
        static void JogarDaLoja(Loja.Ficha f)
        {
            PainelMapas.Reler();
            Loja.Loja.Registro.Itens.TryGetValue(f.Id, out var it); var pasta = it?.Pasta ?? "";
            if (f.Tipo == "campanha")
            {
                var c = PainelMapas.Campanhas.FirstOrDefault(x => string.Equals(x.Pasta.TrimEnd('/', '\\'), pasta.TrimEnd('/', '\\'), StringComparison.OrdinalIgnoreCase));
                if (c == null) { Lancou(T("A campanha baixada não apareceu na pasta de mapas.", "The downloaded campaign is not in the maps folder.")); return; }
                Lancou(Campanha.Campanha.Comecar(c, false));
            }
            else
            {
                var m = PainelMapas.Mapas.FirstOrDefault(x => string.Equals(Path.GetDirectoryName(x.Caminho ?? "")?.TrimEnd('/', '\\'), pasta.TrimEnd('/', '\\'), StringComparison.OrdinalIgnoreCase));
                if (m == null) { Lancou(T("O mapa baixado não apareceu na pasta de mapas.", "The downloaded map is not in the maps folder.")); return; }
                Lancou(Lancador.Lancar(m));
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
        static string[] NomesDosNiveis => Pt ? new[] { "Fácil", "Normal", "Difícil", "Brutal" } : new[] { "Easy", "Normal", "Hard", "Brutal" };

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
                    if (erro == null) { var go = _missao; _missao = null; if (go != null) UnityEngine.Object.Destroy(go); }
                    Lancou(erro);
                });
                Atualizar();
                _missao.transform.SetAsLastSibling();
                if (cg != null) Nucleo.Instancia.StartCoroutine(Fade(cg, 1f, null));
                Log.Info("missão oficial: quadro de " + q.Id + " (" + herois.Count + " heróis na coleção, " + exigidos.Count + " exigido(s))");
            }
            catch (Exception ex) { Log.Erro("missão oficial", ex); if (_missao != null) UnityEngine.Object.Destroy(_missao); _missao = null; Fechar(); PainelMapas.AbrirNaAba(2); }
        }

        static void Lancou(string erro)
        {
            if (erro != null) { Log.Info("tela de mapas: " + erro); Fechar(); Nucleo.Visivel = true; PainelMapas.MostrarErro(erro, _aba > 2 ? 1 : _aba); return; }
            if (_tela != null) _tela.SetActive(false);
            try { Cena.MainCameraBlur.enabled = false; } catch { }
        }


        static void Ficha(int numero, string nome, string resumo, DateTime data, string autor, Act ato, string jogar, Action aoJogar, string outro, Action aoOutro, string detalhe = null)
        {
            var lc = Cena.CampaignLoad; var go = UnityEngine.Object.Instantiate(lc.SaveSlotPool.Prefab, _grade, false); go.name = "Bigorna ficha " + numero;
            go.SetActive(true); var lp = go.transform.localPosition; go.transform.localPosition = new Vector3(lp.x, lp.y, 0f); go.transform.localScale = Vector3.one;
            var s = go.GetComponent<UISaveSlot>();
            if (s != null)
            {
                Texto(s.LabelPartyName, nome); Texto(s.LabelSlotIndex, numero.ToString());
                Texto(s.LabelLastLocation, string.IsNullOrEmpty(autor) ? resumo : resumo + " · " + autor);
                Texto(s.LabelLastPlayDate, data == DateTime.MinValue ? "" : data.ToString(Pt ? "dd/MM/yyyy" : "yyyy-MM-dd"));
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
            _fichas.Add(go);
        }

        /// <summary>A bandeja de uma ficha com texto longo (a descricao de uma missao oficial): o texto inteiro, em azul, sobre o fundo
        /// da bandeja, e o botao a direita.</summary>
        static void TextoNaBandeja(GameObject bandeja, TMP_Text modelo, string texto)
        {
            try
            {
                var hl = bandeja.GetComponent<HorizontalLayoutGroup>(); if (hl != null) hl.enabled = false;
                var fundo = bandeja.transform.Find("Image_BG") as RectTransform; var pai = fundo != null ? fundo : bandeja.transform as RectTransform;
                foreach (var b in bandeja.GetComponentsInChildren<Button>(true))
                {
                    if (!b.gameObject.activeSelf) continue; var r = b.GetComponent<RectTransform>();
                    r.anchorMin = r.anchorMax = new Vector2(1f, 0.5f); r.pivot = new Vector2(1f, 0.5f); r.anchoredPosition = new Vector2(0f, 0f);
                }
                var go = UnityEngine.Object.Instantiate(modelo.gameObject, pai, false); go.name = "Bigorna texto inteiro"; go.SetActive(true);
                SemTraducao(go); var le = go.GetComponent<LayoutElement>(); if (le != null) le.ignoreLayout = true;
                var rt = go.GetComponent<RectTransform>(); rt.anchorMin = new Vector2(0f, 0f); rt.anchorMax = new Vector2(1f, 1f); rt.pivot = new Vector2(0.5f, 0.5f);
                rt.offsetMin = new Vector2(20f, 10f); rt.offsetMax = new Vector2(-240f, -10f);
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
