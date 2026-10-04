using System;
using System.Linq;
using Bigorna.Encontro;
using FFG.D3;
using UnityEngine;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>Teste de som e de cenas (F7): lista os eventos de som do jogo por banco e as cenas da colecao; clique para ouvir/ver.</summary>
    public static class PainelSons
    {
        public static bool Aberto;
        static Vector2 _rolagem;
        static string _filtro = "";
        static string _bancoAberto;
        static string _ultimo = "";
        static bool _cenas;

        public static void Desenhar()
        {
            if (!Aberto) return;
            var r = new Rect(Screen.width - 440f, 40f, 420f, Screen.height - 80f);
            GUI.Box(r, "");
            GUILayout.BeginArea(new Rect(r.x + 8f, r.y + 6f, r.width - 16f, r.height - 12f));
            GUILayout.BeginHorizontal();
            GUILayout.Label(T("<b>Teste de som e de cenas</b>  (F7 fecha)", "<b>Sound and cutscene test</b>  (F7 closes)"), new GUIStyle(GUI.skin.label) { richText = true });
            if (GUILayout.Button(_cenas ? T("Sons", "Sounds") : T("Cenas", "Cutscenes"), GUILayout.Width(80f))) _cenas = !_cenas;
            GUILayout.EndHorizontal();
            if (_cenas) { DesenharCenas(); GUILayout.EndArea(); return; }
            GUILayout.BeginHorizontal();
            GUILayout.Label(T("Filtro:", "Filter:"), GUILayout.Width(44f));
            _filtro = GUILayout.TextField(_filtro ?? "");
            if (GUILayout.Button(T("Parar tudo", "Stop all"), GUILayout.Width(90f))) Sons.Tocar("Stop_All");
            GUILayout.EndHorizontal();
            GUILayout.Label(T("Último: ", "Last: ") + _ultimo + T("   ·   o nome é o que vai no gatilho «Play a sound» do editor", "   ·   the name is what goes in the editor's \"Play a sound\" trigger"));
            _rolagem = GUILayout.BeginScrollView(_rolagem);
            var f = (_filtro ?? "").Trim().ToLowerInvariant();
            foreach (var (banco, eventos) in Sons.Bancos)
            {
                var lista = f.Length == 0 ? eventos : eventos.Where(e => e.ToLowerInvariant().Contains(f) || banco.ToLowerInvariant().Contains(f)).ToArray();
                if (lista.Length == 0) continue;
                bool aberto = f.Length > 0 || _bancoAberto == banco;
                if (GUILayout.Button((aberto ? "▾ " : "▸ ") + banco + "  (" + lista.Length + ")", GUI.skin.label)) _bancoAberto = aberto && f.Length == 0 ? null : banco;
                if (!aberto) continue;
                foreach (var e in lista)
                {
                    GUILayout.BeginHorizontal();
                    GUILayout.Space(16f);
                    if (GUILayout.Button(e, GUILayout.Height(22f))) { _ultimo = e; Sons.Tocar(e); Log.Info("teste de som: " + e); }
                    GUILayout.EndHorizontal();
                }
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        static void DesenharCenas()
        {
            GUILayout.Label(T("Cenas (vídeos) da sua coleção. O nome ou o id é o que vai no gatilho «Start a cutscene».", "Cutscenes (videos) in your collection. The name or the id is what goes in the \"Start a cutscene\" trigger."));
            _rolagem = GUILayout.BeginScrollView(_rolagem);
            try
            {
                var todas = UserCollectionManager.GetCutscenes(true);
                if (todas == null) GUILayout.Label(T("(o catálogo ainda não carregou)", "(the catalog has not loaded yet)"));
                else foreach (var c in todas.Where(x => x != null).OrderBy(x => x.name))
                {
                    GUILayout.BeginHorizontal();
                    GUILayout.Label(c.name + "\n<size=10>" + c.Id + " · " + c.SoundEventName + "</size>", new GUIStyle(GUI.skin.label) { richText = true });
                    GUI.enabled = !Cinematica.EmMarcha && Jogo.EmEncontro;
                    if (GUILayout.Button(T("Ver", "View"), GUILayout.Width(50f), GUILayout.Height(34f))) Cinematica.Tocar(c.Id);
                    GUI.enabled = true;
                    GUILayout.EndHorizontal();
                }
                if (!Jogo.EmEncontro) GUILayout.Label(T("As cenas só tocam dentro de uma missão (abra um mapa).", "Cutscenes only play inside a quest (open a map)."));
            }
            catch (Exception ex) { GUILayout.Label(ex.Message); }
            GUILayout.EndScrollView();
        }
    }
}
