using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using Bigorna.Motor;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>Modo de teste: para conferir as salas de um mapa uma a uma, sem batalhar nem rolar dados. Liga e desliga com
    /// Ctrl+Shift+D (fica guardado); com ele ligado, Ctrl+D abre o painel e os atalhos valem durante o encontro:
    /// Ctrl+N abre a proxima sala fechada (pelo gatilho que a abre, com as cenas e textos dela), Ctrl+K derrota todos os monstros
    /// em jogo (os gatilhos de derrota correm), Ctrl+T liga/desliga os testes que passam sozinhos, Ctrl+U usa o proximo objeto
    /// ainda nao usado da sala aberta mais recente, Ctrl+W vence o mapa.</summary>
    public static class Depuracao
    {
        const string Chave = "bigorna-depuracao";
        public static bool Ligada { get => PlayerPrefs.GetInt(Chave, 0) == 1; set { PlayerPrefs.SetInt(Chave, value ? 1 : 0); PlayerPrefs.Save(); } }
        /// <summary>Os testes de habilidade passam sem perguntar (com os sucessos que pedem).</summary>
        public static bool TestesPassam = true;
        public static bool Aberto;
        static Rect _janela = new Rect(20f, 120f, 400f, 560f);
        static Vector2 _rolagem;
        static string _ultimo = "";
        static GUIStyle _pequeno;

        static bool Ctrl => Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
        static bool Shift => Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
        static bool Pronto => Ligada && Jogo.EmEncontro && Roteiro.EmMarcha;
        /// <summary>Nos testes: com o modo ligado e a opcao marcada, o teste passa sozinho.</summary>
        public static bool PassarTeste => Ligada && TestesPassam;

        public static void Teclas()
        {
            if (!Ctrl) return;
            if (Shift && Input.GetKeyDown(KeyCode.D)) { Ligada = !Ligada; Aberto = Ligada; if (Ligada) Avisar("modo de teste ligado (Ctrl+D abre o painel)", "test mode on (Ctrl+D opens the panel)"); else Avisar("modo de teste desligado", "test mode off"); return; }
            if (!Ligada) return;
            if (Input.GetKeyDown(KeyCode.D)) Aberto = !Aberto;
            if (Input.GetKeyDown(KeyCode.T)) { TestesPassam = !TestesPassam; Avisar("testes " + (TestesPassam ? "passam sozinhos" : "perguntam de novo"), "skill tests " + (TestesPassam ? "pass on their own" : "ask again")); }
            if (!Pronto) return;
            if (Input.GetKeyDown(KeyCode.N)) AbrirProxima();
            if (Input.GetKeyDown(KeyCode.K)) DerrotarTodos();
            if (Input.GetKeyDown(KeyCode.U)) UsarProximo();
            if (Input.GetKeyDown(KeyCode.W)) { Roteiro.Completar(true); Avisar("mapa vencido", "map won"); }
        }

        /// <summary>Mostra o aviso no painel, na lingua do mod; o registro fica em portugues.</summary>
        static void Avisar(string pt, string en) { _ultimo = T(pt, en); Log.Info("[teste] " + pt); }

        /// <summary>As salas ainda fechadas, em ordem (sala 2, 3…), com o gatilho que as abre.</summary>
        static List<(string grupo, Dmap.Gatilho g)> Fechadas()
        {
            var r = new List<(string, Dmap.Gatilho)>();
            var gatilhos = Roteiro.Mapa?.Gatilhos ?? new List<Dmap.Gatilho>();
            foreach (var grupo in Tabuleiro.GruposOcultos.OrderBy(Numero).ThenBy(x => x))
            {
                var g = gatilhos.FirstOrDefault(t => (t.Acoes ?? new List<Dmap.Clausula>()).Any(a => (a.Id == "revealTiles" || a.Id == "revealRoom") && a.Params != null && a.Params.TryGetValue("group", out var v) && string.Equals(Convert.ToString(v), grupo, StringComparison.OrdinalIgnoreCase)));
                r.Add((grupo, g));
            }
            return r;
        }
        static int Numero(string g) { var d = new string((g ?? "").Where(char.IsDigit).ToArray()); return int.TryParse(d, out var n) ? n : 9999; }

        static void Abrir(string grupo, Dmap.Gatilho g)
        {
            try
            {
                if (g != null) { Roteiro.Executar(g, true, true); Avisar("abrindo «" + grupo + "» pelo gatilho «" + g.Rotulo + "»", "opening \"" + grupo + "\" through the trigger \"" + g.Rotulo + "\""); }
                else { Tabuleiro.Revelar(grupo); Avisar("revelando «" + grupo + "» (nenhum gatilho a abre)", "revealing \"" + grupo + "\" (no trigger opens it)"); }
            }
            catch (Exception ex) { Log.Erro("abrindo sala no modo de teste", ex); }
        }
        public static void AbrirProxima() { var f = Fechadas(); if (f.Count == 0) { Avisar("todas as salas estão abertas", "all rooms are open"); return; } Abrir(f[0].grupo, f[0].g); }

        public static void DerrotarTodos()
        {
            int n = 0;
            try { foreach (var e in Jogo.Inimigos.ToList()) { Acoes.Derrotar(e); n++; } } catch (Exception ex) { Log.Erro("derrotando no modo de teste", ex); }
            Avisar(n + " monstro(s) derrotado(s)", "enemies defeated: " + n);
        }

        static IEnumerable<Objetos.NaMesa> Usaveis() => Objetos.Postos.Where(p => p != null && p.Visivel && !p.Usado && p.Dados != null && !Objetos.EhEscadaDeMao(p.Dados.Tipo)).Reverse();
        public static void UsarProximo()
        {
            var p = Usaveis().FirstOrDefault(); if (p == null) { Avisar("nenhum objeto por usar", "no objects left to use"); return; }
            try { Objetos.Usar(p.Indice); Avisar("usado «" + p.Rotulo + "»", "used \"" + p.Rotulo + "\""); } catch (Exception ex) { Log.Erro("usando no modo de teste", ex); }
        }

        public static void Desenhar()
        {
            if (!Ligada) return;
            if (!Aberto) { GUI.color = new Color(1f, 0.8f, 0.4f, 0.95f); GUI.Label(new Rect(12f, 30f, 600f, 22f), T("MODO DE TESTE · Ctrl+D painel · Ctrl+N abre sala · Ctrl+K derrota · Ctrl+U usa objeto · Ctrl+T testes · Ctrl+W vence", "TEST MODE · Ctrl+D panel · Ctrl+N opens room · Ctrl+K defeats · Ctrl+U uses object · Ctrl+T tests · Ctrl+W wins")); GUI.color = Color.white; return; }
            _janela = GUILayout.Window(77311, _janela, Janela, T("Bigorna · modo de teste", "Bigorna · test mode"));
        }

        static void Janela(int id)
        {
            if (_pequeno == null) _pequeno = new GUIStyle(GUI.skin.label) { fontSize = 11, wordWrap = true };
            GUILayout.Label(T("Ctrl+N abre a próxima sala · Ctrl+K derrota todos · Ctrl+U usa o próximo objeto · Ctrl+T testes · Ctrl+W vence · Ctrl+D fecha · Ctrl+Shift+D desliga",
                "Ctrl+N opens the next room · Ctrl+K defeats all · Ctrl+U uses the next object · Ctrl+T tests · Ctrl+W wins · Ctrl+D closes · Ctrl+Shift+D turns off"), _pequeno);
            TestesPassam = GUILayout.Toggle(TestesPassam, T(" Testes de habilidade passam sozinhos", " Skill tests pass on their own"));
            if (!Pronto) { GUILayout.Label(T("Entre num mapa do Bigorna para usar os atalhos.", "Enter a Bigorna map to use the shortcuts."), _pequeno); GUI.DragWindow(); return; }
            GUILayout.BeginHorizontal();
            if (GUILayout.Button(T("Derrotar todos", "Defeat all"))) DerrotarTodos();
            if (GUILayout.Button(T("Próxima sala", "Next room"))) AbrirProxima();
            if (GUILayout.Button(T("Vencer o mapa", "Win the map"))) { Roteiro.Completar(true); Avisar("mapa vencido", "map won"); }
            GUILayout.EndHorizontal();
            if (!string.IsNullOrEmpty(_ultimo)) GUILayout.Label("› " + _ultimo, _pequeno);
            _rolagem = GUILayout.BeginScrollView(_rolagem);
            GUILayout.Label(T("<b>Salas fechadas</b>", "<b>Closed rooms</b>"));
            foreach (var (grupo, g) in Fechadas())
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label(grupo + (g == null ? T(" (sem gatilho)", " (no trigger)") : ""), _pequeno, GUILayout.Width(250));
                if (GUILayout.Button(T("Abrir", "Open"), GUILayout.Width(70))) Abrir(grupo, g);
                GUILayout.EndHorizontal();
            }
            GUILayout.Label(T("<b>Objetos na mesa</b>", "<b>Objects on the table</b>"));
            foreach (var p in Objetos.Postos.Where(x => x != null && x.Visivel && x.Dados != null && !Objetos.EhEscadaDeMao(x.Dados.Tipo)))
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label("#" + p.Indice + " " + p.Rotulo + (p.Usado ? T(" (usado)", " (used)") : ""), _pequeno, GUILayout.Width(250));
                if (GUILayout.Button(p.Usado ? T("De novo", "Again") : T("Usar", "Use"), GUILayout.Width(70))) { if (p.Usado) Objetos.Reabrir(p.Indice); Objetos.Usar(p.Indice); Avisar("usado «" + p.Rotulo + "»", "used \"" + p.Rotulo + "\""); }
                GUILayout.EndHorizontal();
            }
            GUILayout.EndScrollView();
            GUI.DragWindow();
        }
    }
}
