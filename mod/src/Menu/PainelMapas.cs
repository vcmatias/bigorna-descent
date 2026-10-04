using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Menu
{
    /// <summary>Lista dos .dmap da pasta CustomMaps, com botao para jogar. Desenhado em IMGUI na tela de titulo.</summary>
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

        public static void Alternar()
        {
            _aberto = !_aberto;
            if (_aberto) Reler();
        }

        public static void Reler()
        {
            _progressos.Clear();
            MapasOficiais.Reler();
            // (os arquivos que o editor baixou vem de Downloads para a pasta de mapas)
            try { RecolhaDosDownloads.Recolher(Bootstrap.PastaMapas); } catch (Exception ex) { Log.Info("recolha: " + ex.Message); }
            try
            {
                _campanhas = Dcamp.CarregarTodas(Bootstrap.PastaMapas);
                var pastasDeCampanha = new HashSet<string>(_campanhas.Select(c => c.Pasta), StringComparer.OrdinalIgnoreCase);
                _mapas = Dmap.CarregarTodos(Bootstrap.PastaMapas);
                foreach (var sub in Directory.GetDirectories(Bootstrap.PastaMapas))
                    if (!pastasDeCampanha.Contains(sub)) _mapas.AddRange(Dmap.CarregarTodos(sub)); // os mapas de campanha jogam-se pela campanha
                _erro = null;
            }
            catch (Exception ex) { _erro = ex.Message; }
            _proximaLeitura = Time.unscaledTime + 5f;
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

        public static void Desenhar()
        {
            if (Jogo.CenaAtual() != Scene.Titlescene) { _aberto = false; return; }
            Estilos();
            var botao = new Rect(Screen.width / 2f - 130f, Screen.height - 64f, 260f, 40f);
            if (GUI.Button(botao, _aberto ? "Fechar mapas" : "Mapas da comunidade", _botao)) Alternar();
            if (!_aberto) return;
            if (Time.unscaledTime > _proximaLeitura) Reler();
            float largura = Mathf.Min(760f, Screen.width - 40f), altura = Mathf.Min(Screen.height - 140f, 620f);
            var janela = new Rect((Screen.width - largura) / 2f, 60f, largura, altura);
            GUI.Box(janela, GUIContent.none, _janela);
            GUILayout.BeginArea(new Rect(janela.x + 14f, janela.y + 10f, janela.width - 28f, janela.height - 20f));
            // o titulo numa linha, os botoes na seguinte (numa linha so, o titulo espremia letra por letra)
            GUILayout.Label("Mapas da comunidade · Bigorna " + Bootstrap.Versao, _titulo);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Reler", _botao, GUILayout.Width(80f))) Reler();
            if (GUILayout.Button("Abrir pasta", _botao, GUILayout.Width(110f))) AbrirPasta();
            if (Dados.DadosDoEditor.EditorInstalado && GUILayout.Button("Abrir editor", _botao, GUILayout.Width(120f))) Dados.DadosDoEditor.AbrirEditor();
            GUI.enabled = !Dados.DadosDoEditor.Gerando;
            if (GUILayout.Button(Dados.DadosDoEditor.Gerando ? "Gerando…" : "Refazer dados do editor", _botao, GUILayout.Width(190f))) Dados.DadosDoEditor.Refazer();
            GUI.enabled = true;
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Relatar um problema", _botao, GUILayout.Width(170f))) Relatos.Alternar();
            GUILayout.EndHorizontal();
            GUILayout.Label(Bootstrap.PastaMapas, _pequeno);
            if (_erro != null) GUILayout.Label("Não li a pasta: " + _erro, _pequeno);
            GUILayout.Space(6f);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Campanhas (" + _campanhas.Count + ")", _aba == 0 ? _abaOn : _abaOff, GUILayout.Width(180f))) _aba = 0;
            if (GUILayout.Button("Mapas avulsos (" + _mapas.Count + ")", _aba == 1 ? _abaOn : _abaOff, GUILayout.Width(200f))) _aba = 1;
            if (GUILayout.Button("Mapas oficiais (" + MapasOficiais.Quantas + ")", _aba == 2 ? _abaOn : _abaOff, GUILayout.Width(200f))) _aba = 2;
            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();
            GUILayout.Label(_aba == 0 ? "Uma campanha encadeia vários mapas no mapa-múndi do jogo (diálogos, viagens, recompensas). Os mapas de uma campanha jogam-se por ela, não pela lista de mapas avulsos."
                : _aba == 1 ? "Um mapa avulso é um .dmap solto: começa direto no tabuleiro e, ao terminar, volta ao menu."
                : "As missões do próprio jogo, para jogar de novo qualquer uma delas com as regras oficiais: escolham a missão, o grupo e a dificuldade.", _pequeno);
            GUILayout.Space(4f);
            _rolagem = GUILayout.BeginScrollView(_rolagem);
            if (_aba == 0 && _campanhas.Count == 0) GUILayout.Label("Nenhuma campanha (.dcamp) na pasta. No editor, «Create campaign» e depois «Export campaign».", _texto);
            if (_aba == 1 && _mapas.Count == 0) GUILayout.Label("Nenhum .dmap avulso na pasta. Exporte um mapa no editor e copie para cá.", _texto);
            if (_aba == 0) foreach (var c in _campanhas)
            {
                if (!_progressos.TryGetValue(c, out var prog)) _progressos[c] = prog = Campanha.Progresso.Carregar(c);
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.BeginVertical();
                GUILayout.Label(c.NomeVisivel, _texto);
                GUILayout.Label(c.Nos.Count(n => n.EhMapa) + " mapa(s), " + c.Nos.Count(n => !n.EhMapa) + " parada(s) narrativa(s)" + (prog.Completados.Count > 0 ? " · " + prog.Completados.Count + " nó(s) completado(s)" : "") + (string.IsNullOrEmpty(c.Metadados.Descricao) ? "" : "\n" + c.Metadados.Descricao), _pequeno);
                GUILayout.EndVertical();
                if (GUILayout.Button(prog.Completados.Count > 0 ? "Continuar" : "Jogar", _botao, GUILayout.Width(100f), GUILayout.Height(40f)))
                {
                    Log.Info("«Jogar» campanha " + c.NomeVisivel + " (" + c.Caminho + ")");
                    var erro = Campanha.Campanha.Comecar(c, false);
                    if (erro != null) _erro = erro; else _aberto = false;
                }
                if (prog.Completados.Count > 0 && GUILayout.Button("Recomeçar", _botao, GUILayout.Width(100f), GUILayout.Height(40f)))
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
                GUILayout.Label(m.Resumo + (string.IsNullOrEmpty(m.Metadados.Descricao) ? "" : "\n" + m.Metadados.Descricao), _pequeno);
                GUILayout.EndVertical();
                if (GUILayout.Button("Jogar", _botao, GUILayout.Width(90f), GUILayout.Height(40f)))
                {
                    Log.Info("«Jogar» em " + m.NomeVisivel + " (" + m.Caminho + ")");
                    var erro = Lancador.Lancar(m);
                    if (erro != null) _erro = erro; else _aberto = false;
                }
                GUILayout.EndHorizontal();
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
