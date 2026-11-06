using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.D3;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>Lista dos mapas da pasta de mapas (v270: Bigorna\\Mapas; .bmap e .dmap), com botao para jogar. Desenhado em IMGUI na tela de titulo.</summary>
    public static class PainelMapas
    {
        static bool _aberto;
        static int _aba;   // 0 campanhas, 1 mapas avulsos, 2 mapas oficiais
        static GUIStyle _abaOn, _abaOff;
        static List<Dmap> _mapas = new List<Dmap>();
        static List<Dcamp> _campanhas = new List<Dcamp>();
        static string _erro;
        static Vector2 _rolagem;
        static GUIStyle _botao, _titulo, _texto, _pequeno, _janela;
        static float _proximaLeitura;
        /// <summary>O progresso de cada campanha da lista, lido junto com ela (o OnGUI corre varias vezes por quadro e lia o
        /// arquivo de progresso de todas as campanhas a cada vez).</summary>
        static readonly Dictionary<Dcamp, Campanha.Progresso> _progressos = new Dictionary<Dcamp, Campanha.Progresso>();
        /// <summary>A data da ultima alteracao de cada arquivo da lista, lida no Reler (de uma campanha: o mais novo entre o
        /// .dcamp e os .dmap dela).</summary>
        static readonly Dictionary<object, DateTime> _alterados = new Dictionary<object, DateTime>();

        static DateTime Alterado(string caminho) { try { return File.Exists(caminho) ? File.GetLastWriteTime(caminho) : DateTime.MinValue; } catch { return DateTime.MinValue; } }
        static DateTime AlteradoDaCampanha(Dcamp c)
        {
            var d = Alterado(c.Caminho);
            foreach (var n in c.Nos) { var m = c.CaminhoDoMapa(n); if (m != null) { var dm = Alterado(m); if (dm > d) d = dm; } }
            return d;
        }
        /// <summary>"alterado em 07/10/2026 21:40" (em ingles, 2026-10-07 21:40).</summary>
        static string TextoAlterado(object chave)
        {
            if (!_alterados.TryGetValue(chave, out var d) || d == DateTime.MinValue) return "";
            return TF("alterado em {0}", "last changed {0}", DataHora(d));
        }

        public static bool Aberto => _aberto;
        // (para a tela no estilo do jogo: TelaDeMapas)
        public static IReadOnlyList<Dcamp> Campanhas => _campanhas;
        public static IReadOnlyList<Dmap> Mapas => _mapas;
        public static Campanha.Progresso ProgressoDe(Dcamp c) { if (!_progressos.TryGetValue(c, out var p)) _progressos[c] = p = Campanha.Progresso.Carregar(c); return p; }
        public static DateTime AlteradoEm(object chave) => _alterados.TryGetValue(chave, out var d) ? d : DateTime.MinValue;
        public static void AbrirNaAba(int aba) { _aba = aba; if (!_aberto) Alternar(); }
        public static void AbrirAPasta() => AbrirPasta();
        public static void MostrarErro(string erro, int aba) { _erro = erro; _aba = aba; if (!_aberto) Alternar(); _erro = erro; }

        public static void Alternar()
        {
            _aberto = !_aberto;
            if (_aberto) RelerAoFundo();
        }

        /* v263: a pasta e lida com os arquivos ja lidos guardados (Dmap.Lembrado): so o novo ou mudado e lido de novo. Ao abrir
           a tela, e a cada 5 s com o painel aberto, a leitura vai ao fundo (RelerAoFundo): a tela abre na hora com a lista que
           ja havia e se atualiza quando a leitura acaba. Na tela de titulo a leitura comeca sozinha (Aquecer), entao o
           primeiro clique ja encontra tudo lido. Reler (direto) fica para quem precisa da lista nova na mesma hora (depois de
           baixar ou remover um pacote); com o guardado, ele e rapido. */
        class Leitura { public List<Dcamp> Campanhas; public List<Dmap> Mapas; public Dictionary<object, DateTime> Alterados; public string Erro; public double Segundos; }
        static System.Threading.Tasks.Task<Leitura> _lendo;
        static readonly List<Action> _aoLer = new List<Action>();
        /// <summary>Uma leitura ao fundo em andamento.</summary>
        public static bool Lendo => _lendo != null;
        /// <summary>A pasta ja foi lida ao menos uma vez (a tela pode mostrar a lista que ha).</summary>
        public static bool JaLida { get; private set; }

        static void AntesDeLer()
        {
            _progressos.Clear();
            MapasOficiais.Reler();
            // (os arquivos que o editor baixou vem de Downloads para a pasta de mapas)
            try { RecolhaDosDownloads.Recolher(Bootstrap.PastaMapas); } catch (Exception ex) { Log.Info("recolha: " + ex.Message); }
        }

        static Leitura Ler(string[] pastas, string pacotes)
        {
            var r = new Leitura(); var t0 = DateTime.UtcNow;
            try
            {
                // (v270: a pasta nova e a antiga; da antiga, só o que é do Bigorna: Dmap/Dcamp deixam de fora os de outro editor)
                r.Campanhas = new List<Dcamp>(); r.Mapas = new List<Dmap>(); var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var pasta in pastas)
                {
                    if (!Directory.Exists(pasta)) continue;
                    var cs = Dcamp.CarregarTodas(pasta, pacotes, true);   // (v264: só a ficha de cada arquivo)
                    r.Campanhas.AddRange(cs.Where(c => string.IsNullOrEmpty(c.Id) || ids.Add(c.Id)));
                    var pastasDeCampanha = new HashSet<string>(cs.Select(c => c.Pasta), StringComparer.OrdinalIgnoreCase);
                    r.Mapas.AddRange(Dmap.CarregarTodos(pasta, pacotes, true));
                    foreach (var sub in Directory.GetDirectories(pasta))
                        if (!pastasDeCampanha.Contains(sub)) r.Mapas.AddRange(Dmap.CarregarTodos(sub, pacotes, true)); // os mapas de campanha jogam-se pela campanha
                }
                r.Alterados = new Dictionary<object, DateTime>();
                foreach (var c in r.Campanhas) r.Alterados[c] = AlteradoDaCampanha(c);
                foreach (var m in r.Mapas) r.Alterados[m] = Alterado(m.Caminho);
            }
            catch (Exception ex) { r.Erro = T("Não li a pasta: ", "Could not read the folder: ") + ex.Message; }
            r.Segundos = (DateTime.UtcNow - t0).TotalSeconds;
            return r;
        }

        static void Aplicar(Leitura r)
        {
            if (r.Erro == null) { _campanhas = r.Campanhas; _mapas = r.Mapas; _alterados.Clear(); foreach (var kv in r.Alterados) _alterados[kv.Key] = kv.Value; }
            _erro = r.Erro; JaLida = true;
            _proximaLeitura = Time.unscaledTime + 5f;
        }

        /// <summary>A pasta lida agora, nesta linha (rapido com o guardado; o primeiro de todos le tudo).</summary>
        public static void Reler()
        {
            AntesDeLer();
            Aplicar(Ler(Bootstrap.PastasDeMapas, Acervo.Pacotes.Carimbo()));
        }

        /// <summary>A pasta lida ao fundo; pronto (na linha principal) quando acabar. Uma leitura em andamento serve.</summary>
        public static void RelerAoFundo(Action pronto = null)
        {
            if (pronto != null) _aoLer.Add(pronto);
            _proximaLeitura = Time.unscaledTime + 5f;
            if (_lendo != null) return;
            AntesDeLer();
            string[] pasta = Bootstrap.PastasDeMapas; string pacotes = Acervo.Pacotes.Carimbo();
            // (a lingua do jogo vem da Unity, que so responde na linha principal: lida aqui, vale para a leitura toda)
            try { Traducao.LinguaCongelada = Traducao.LinguaDoJogoAgora?.Invoke(); } catch { Traducao.LinguaCongelada = null; }
            _lendo = System.Threading.Tasks.Task.Run(() => Ler(pasta, pacotes));
        }

        /// <summary>Na tela de titulo: a pasta lida ao fundo, uma vez, para o primeiro clique encontrar tudo pronto.</summary>
        public static void Aquecer() { if (!JaLida && _lendo == null) RelerAoFundo(); }

        /// <summary>A cada quadro: a leitura ao fundo acabou? A lista nova entra e quem esperava e avisado.</summary>
        public static void Batimento()
        {
            if (_lendo == null || !_lendo.IsCompleted) return;
            var t = _lendo; _lendo = null; Traducao.LinguaCongelada = null;
            Leitura r;
            try { r = t.Result; } catch (Exception ex) { r = new Leitura { Erro = T("Não li a pasta: ", "Could not read the folder: ") + (ex.InnerException ?? ex).Message }; }
            Aplicar(r);
            Log.Info("mapas da comunidade lidos ao fundo: " + (r.Campanhas?.Count ?? 0) + " campanha(s), " + (r.Mapas?.Count ?? 0) + " mapa(s) em " + r.Segundos.ToString("0.0") + " s (" + Dmap.Guardados + " arquivo(s) guardados)");
            var esperando = _aoLer.ToList(); _aoLer.Clear();
            foreach (var a in esperando) try { a(); } catch (Exception ex) { Log.Erro("depois de ler os mapas", ex); }
        }

        static void Estilos()
        {
            if (_botao != null) return;
            _botao = new GUIStyle(GUI.skin.button) { fontSize = 14, padding = new RectOffset(10, 10, 6, 6) };
            _titulo = new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold };
            _texto = new GUIStyle(GUI.skin.label) { fontSize = 15, fontStyle = FontStyle.Bold, wordWrap = true };
            _pequeno = new GUIStyle(GUI.skin.label) { fontSize = 12, wordWrap = true };
            _pequeno.normal.textColor = new Color(0.8f, 0.8f, 0.8f);
            _janela = new GUIStyle(GUI.skin.window);
            _abaOff = new GUIStyle(GUI.skin.button) { fontSize = 15, padding = new RectOffset(14, 14, 8, 8) };
            _abaOn = new GUIStyle(_abaOff) { fontStyle = FontStyle.Bold };
            _abaOn.normal.background = _abaOff.active.background; _abaOn.normal.textColor = new Color(1f, 0.85f, 0.4f);
        }

        static Dmap _savesDe;
        static List<Encontro.GrupoDoSave.Save> _saves;

        public static void Desenhar()
        {
            if (Jogo.CenaAtual() != Scene.Titlescene) { _aberto = false; return; }
            Estilos();
            // (o botao fica no menu do jogo, entre "Colecao" e "Sair": BotaoDoMenu; este, embaixo da tela, so se o menu nao o aceitou)
            if (BotaoDoMenu.Falhou)
            {
                var botao = new Rect(Screen.width / 2f - 130f, Screen.height - 64f, 260f, 40f);
                if (GUI.Button(botao, _aberto ? T("Fechar mapas", "Close maps") : T("Mapas da comunidade", "Community maps"), _botao)) Alternar();
            }
            if (!_aberto) return;
            if (Time.unscaledTime > _proximaLeitura) RelerAoFundo();
            float largura = Mathf.Min(760f, Screen.width - 40f), altura = Mathf.Min(Screen.height - 140f, 620f);
            var janela = new Rect((Screen.width - largura) / 2f, 60f, largura, altura);
            GUI.Box(janela, GUIContent.none, _janela);
            GUILayout.BeginArea(new Rect(janela.x + 14f, janela.y + 10f, janela.width - 28f, janela.height - 20f));
            // o titulo numa linha (com a troca de lingua na ponta), os botoes na seguinte (numa linha so, o titulo espremia letra por letra)
            GUILayout.BeginHorizontal();
            GUILayout.Label(T("Mapas da comunidade", "Community maps") + " · Bigorna " + Bootstrap.Versao, _titulo);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button(T("Fechar", "Close"), _botao, GUILayout.Width(80f))) _aberto = false;   // (fecha no quadro seguinte: os grupos do layout fecham neste)
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            if (GUILayout.Button(T("Reler", "Reload"), _botao, GUILayout.Width(80f))) Reler();
            if (GUILayout.Button(T("Abrir pasta", "Open folder"), _botao, GUILayout.Width(110f))) AbrirPasta();
            if (Dados.DadosDoEditor.EditorInstalado && GUILayout.Button(T("Abrir editor", "Open editor"), _botao, GUILayout.Width(120f))) Dados.DadosDoEditor.AbrirEditor();
            GUI.enabled = !Dados.DadosDoEditor.Gerando;
            if (GUILayout.Button(Dados.DadosDoEditor.Gerando ? T("Gerando…", "Generating…") : T("Refazer dados do editor", "Rebuild editor data"), _botao, GUILayout.Width(190f))) Dados.DadosDoEditor.Refazer();
            GUI.enabled = true;
            GUILayout.FlexibleSpace();
            if (GUILayout.Button(T("Relatar um problema", "Report a problem"), _botao, GUILayout.Width(170f))) Relatos.Alternar();
            GUILayout.EndHorizontal();
            GUILayout.Label(Bootstrap.PastaMapas, _pequeno);
            if (_erro != null) GUILayout.Label(_erro, _pequeno);   // (v241: a mensagem como veio; «Não li a pasta» so para o erro da pasta)
            GUILayout.Space(6f);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button(T("Campanhas", "Campaigns") + " (" + _campanhas.Count + ")", _aba == 0 ? _abaOn : _abaOff, GUILayout.Width(180f))) _aba = 0;
            if (GUILayout.Button(T("Mapas avulsos", "Standalone maps") + " (" + _mapas.Count + ")", _aba == 1 ? _abaOn : _abaOff, GUILayout.Width(200f))) _aba = 1;
            if (GUILayout.Button(T("Mapas oficiais", "Official maps") + " (" + MapasOficiais.Quantas + ")", _aba == 2 ? _abaOn : _abaOff, GUILayout.Width(200f))) _aba = 2;
            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();
            GUILayout.Label(_aba == 0 ? T("Uma campanha encadeia vários mapas no mapa-múndi do jogo (diálogos, viagens, recompensas). Os mapas de uma campanha jogam-se por ela, não pela lista de mapas avulsos.",
                                         "A campaign links several maps on the game's world map (dialogues, travel, rewards). A campaign's maps are played through it, not from the standalone maps list.")
                : _aba == 1 ? T("Um mapa avulso é um .bmap solto: começa direto no tabuleiro e, ao terminar, volta ao menu.",
                                "A standalone map is a single .bmap: it starts right on the board and goes back to the menu when it ends.")
                : T("As missões do próprio jogo, para jogar de novo qualquer uma delas com as regras oficiais: escolham a missão, o grupo e a dificuldade.",
                    "The game's own quests, to replay any of them with the official rules: choose the quest, the party and the difficulty."), _pequeno);
            GUILayout.Space(4f);
            _rolagem = GUILayout.BeginScrollView(_rolagem);
            if (_aba == 0 && _campanhas.Count == 0) GUILayout.Label(T("Nenhuma campanha (.bcamp) na pasta. No editor, «Iniciar campanha» e depois «Exportar campanha».", "No campaigns (.bcamp) in the folder. In the editor, use “Start a campaign” and then “Export campaign”."), _texto);
            if (_aba == 1 && _mapas.Count == 0) GUILayout.Label(T("Nenhum .bmap avulso na pasta. Exporte um mapa no editor e copie para cá.", "No standalone .bmap in the folder. Export a map in the editor and copy it here."), _texto);
            if (_aba == 0) foreach (var c in _campanhas)
            {
                if (!_progressos.TryGetValue(c, out var prog)) _progressos[c] = prog = Campanha.Progresso.Carregar(c);
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.BeginVertical();
                GUILayout.Label(c.NomeVisivel, _texto);
                GUILayout.Label(c.Nos.Count(n => n.EhMapa) + T(" mapa(s), ", " map(s), ") + c.Nos.Count(n => !n.EhMapa) + T(" parada(s) narrativa(s)", " narrative stop(s)") + (prog.Completados.Count > 0 ? " · " + prog.Completados.Count + T(" nó(s) completado(s)", " node(s) completed") : "") + (TextoAlterado(c) == "" ? "" : " · " + TextoAlterado(c)) + (string.IsNullOrEmpty(c.Metadados.Descricao) ? "" : "\n" + c.Metadados.Descricao), _pequeno);
                GUILayout.EndVertical();
                var andamento = Campanha.SavesDaComunidade.EmAndamento(c);
                if (andamento != null && GUILayout.Button(T("Continuar campanha", "Continue campaign"), _botao, GUILayout.Width(170f), GUILayout.Height(40f)))
                {
                    var erro = Campanha.SavesDaComunidade.Continuar(andamento.Value.Key, c);
                    if (erro != null) _erro = erro; else _aberto = false;
                }
                if (andamento == null && GUILayout.Button(prog.Completados.Count > 0 ? T("Continuar", "Continue") : T("Jogar", "Play"), _botao, GUILayout.Width(100f), GUILayout.Height(40f)))
                {
                    Log.Info("«Jogar» campanha " + c.NomeVisivel + " (" + c.Caminho + ")");
                    var erro = Campanha.Campanha.Comecar(c, false);
                    if (erro != null) _erro = erro; else _aberto = false;
                }
                if ((prog.Completados.Count > 0 || andamento != null) && GUILayout.Button(T("Recomeçar", "Restart"), _botao, GUILayout.Width(100f), GUILayout.Height(40f)))
                {
                    var erro = Campanha.Campanha.Comecar(c, true);
                    if (erro != null) _erro = erro; else _aberto = false;
                }
                GUILayout.EndHorizontal();
                GUILayout.Space(4f);
            }
            if (_aba == 2) { var e = MapasOficiais.Desenhar(_botao, _texto, _pequeno, () => _aberto = false); if (e != null) _erro = e; }
            if (_aba == 1) foreach (var m in _mapas)
            {
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.BeginVertical();
                GUILayout.Label(m.NomeVisivel, _texto);
                GUILayout.Label(m.Resumo(T) + (TextoAlterado(m) == "" ? "" : " · " + TextoAlterado(m)) + (string.IsNullOrEmpty(m.Metadados.Descricao) ? "" : "\n" + m.Metadados.Descricao), _pequeno);
                GUILayout.EndVertical();
                if (GUILayout.Button(T("Grupo novo", "New party"), _botao, GUILayout.Width(110f), GUILayout.Height(40f)))
                {
                    Log.Info("«Jogar» em " + m.NomeVisivel + " (" + m.Caminho + ")");
                    var erro = Lancador.Lancar(m);
                    if (erro != null) _erro = erro; else _aberto = false;
                }
                if (GUILayout.Button(T("Usar meus heróis", "Use my heroes"), _botao, GUILayout.Width(140f), GUILayout.Height(40f))) { _savesDe = _savesDe == m ? null : m; _saves = null; }
                GUILayout.EndHorizontal();
                if (_savesDe == m)
                {
                    // (o grupo de uma partida gravada: a lista, a mais recente primeiro)
                    GUILayout.Label(Encontro.GrupoDoSave.TextoCurto, _pequeno);
                    _saves = _saves ?? Encontro.GrupoDoSave.Saves();
                    if (_saves.Count == 0) GUILayout.Label(T("Nenhuma partida gravada do jogo.", "No saved games of the game."), _pequeno);
                    foreach (var sv in _saves)
                        if (GUILayout.Button(sv.Rotulo + "  ·  " + sv.Detalhe, _botao))
                        {
                            Log.Info("«Usar meus heróis» em " + m.NomeVisivel + " com o save " + sv.Slot);
                            var erro = Lancador.Lancar(m, sv); _savesDe = null;
                            if (erro != null) _erro = erro; else _aberto = false;
                        }
                }
                GUILayout.Space(4f);
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        static void AbrirPasta()
        {
            try { Application.OpenURL("file:///" + Bootstrap.PastaMapas.Replace('\\', '/')); }
            catch (Exception ex) { Log.Info("não abri a pasta: " + ex.Message); }
        }
    }
}
