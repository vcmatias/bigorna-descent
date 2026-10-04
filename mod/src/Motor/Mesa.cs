using System;
using System.Collections.Generic;
using System.Linq;
using Bigorna.Encontro;
using Bigorna.Formato;
using UnityEngine;

namespace Bigorna.Motor
{
    /// <summary>
    /// Painel "Mesa": o que o app nao enxerga (herois entrando em areas, alarmes, itens achados...)
    /// a mesa declara aqui, a qualquer momento. Tambem serve para usar objetos e fechar objetivos a mao.
    /// </summary>
    public static class Mesa
    {
        class Item
        {
            public string Rotulo;
            public Action Acao;
            public bool Confirmar;
            public string Secao;
        }

        static readonly HashSet<string> EventosDaMesa = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "heroEntersArea", "heroEntersCell", "allHeroesInArea", "heroLeavesArea", "specificHeroEnters", "heroOnFire",
            "enemyActivated", "enemyEntersArea", "itemObtained", "declared"
        };
        static readonly HashSet<string> DerrotasDaMesa = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "npc_defeated", "object_destroyed", "enemy_reaches_area", "alarm_raised", "item_lost", "hero_seen"
        };

        static bool _aberto;
        static readonly List<Item> _itens = new List<Item>();
        static Item _porConfirmar;
        static Vector2 _rolagem;
        static GUIStyle _botao, _titulo, _secao, _janela;
        static int _versao = -1, _pintado = -2;

        public static void Fechar() { _aberto = false; _porConfirmar = null; }
        public static void Atualizar() { _versao++; }

        static string Area(Dictionary<string, object> p)
        {
            var a = P.Area(p);
            if (a == null) return "área indicada";
            return a[0] == a[2] && a[1] == a[3] ? "casa " + a[0] + "," + a[1] : "área " + a[0] + "," + a[1] + " a " + a[2] + "," + a[3];
        }

        public static string RotuloDe(Dmap.Gatilho g)
        {
            var p = g.Evento?.Params;
            var rotulo = P.Texto(p, "label");
            if (!string.IsNullOrEmpty(rotulo)) return rotulo;
            switch (g.Evento?.Id)
            {
                case "heroEntersArea": return "Um herói entrou na " + Area(p) + (g.Nome != null ? " (" + g.Nome + ")" : "");
                case "heroEntersCell": return "Um herói pisou na " + Area(p) + (g.Nome != null ? " (" + g.Nome + ")" : "");
                case "allHeroesInArea": return "Todos os heróis estão na " + Area(p) + (g.Nome != null ? " (" + g.Nome + ")" : "");
                case "heroLeavesArea": return "Um herói saiu da " + Area(p) + (g.Nome != null ? " (" + g.Nome + ")" : "");
                case "specificHeroEnters": return (P.Texto(p, "hero") ?? "O herói") + " entrou na " + Area(p);
                case "heroOnFire": return "Um herói pegou fogo";
                case "enemyActivated": return "«" + (P.Texto(p, "enemy") ?? "o inimigo") + "» ativou";
                case "enemyEntersArea": return "Um inimigo entrou na " + Area(p);
                case "itemObtained": return "Obtiveram «" + Butim.NomeItem(P.Texto(p, "loot")) + "»";
                default: return g.Rotulo;
            }
        }

        static string RotuloDerrota(Dmap.Objetivo d)
        {
            switch (d.Id)
            {
                case "npc_defeated": return "O aliado escoltado morreu";
                case "object_destroyed": return "O objeto protegido foi destruído";
                case "enemy_reaches_area": return "Um inimigo chegou à " + Area(d.Params);
                case "alarm_raised": return "O alarme foi dado";
                case "item_lost": return "Perderam o item-chave";
                case "hero_seen": return "Os heróis foram vistos";
                default: return d.Id;
            }
        }

        static void Montar()
        {
            _itens.Clear();
            _porConfirmar = null;
            var m = Roteiro.Mapa;
            if (m == null) return;
            foreach (var g in m.Gatilhos)
            {
                if (g.Evento == null || !EventosDaMesa.Contains(g.Evento.Id ?? "") || Roteiro.Gasto(g)) continue;
                var gg = g;
                _itens.Add(new Item { Secao = "Aconteceu na mesa", Rotulo = RotuloDe(g), Acao = () => { Log.Info("a mesa declara: " + gg.Rotulo); Roteiro.Executar(gg); } });
            }
            foreach (var o in Objetos.Postos)
            {
                if (o.Usado || o.Escondido || (!string.IsNullOrEmpty(o.Grupo) && Tabuleiro.GrupoOculto(o.Grupo))) continue;
                var oo = o;
                _itens.Add(new Item { Secao = "Usar objeto", Rotulo = o.Rotulo + (o.Dados.TemPosicao ? " (" + o.Dados.X + "," + o.Dados.Y + ")" : ""), Acao = () => Objetos.Usar(oo, null) });
            }
            var obj = Roteiro.Objetivo;
            if (obj != null)
                _itens.Add(new Item { Secao = "Objetivos", Rotulo = "Cumprido: " + Roteiro.TextoDe(obj) + (ObjetivosAuto.Automatico(obj) ? "  (o app também vigia este)" : ""), Confirmar = true, Acao = () => { Log.Info("a mesa dá o objetivo por cumprido"); Roteiro.Avancar(); } });
            foreach (var (i, o, feito) in Roteiro.Opcionais)
            {
                if (feito || !Roteiro.Anunciado(o)) continue;
                int ii = i;
                _itens.Add(new Item { Secao = "Objetivos", Rotulo = "Opcional cumprido: " + Roteiro.TextoDe(o), Confirmar = true, Acao = () => Roteiro.MarcarOpcional(ii) });
            }
            foreach (var d in m.Roteiro.Derrota)
            {
                if (d == null || !DerrotasDaMesa.Contains(d.Id ?? "")) continue;
                var dd = d;
                _itens.Add(new Item { Secao = "Derrota", Rotulo = RotuloDerrota(d), Confirmar = true, Acao = () => Roteiro.DeclararDerrota(dd) });
            }
            _pintado = _versao;
        }

        static void Estilos()
        {
            if (_botao != null) return;
            _botao = new GUIStyle(GUI.skin.button) { fontSize = 14, alignment = TextAnchor.MiddleLeft, wordWrap = true, padding = new RectOffset(10, 10, 6, 6) };
            _titulo = new GUIStyle(GUI.skin.label) { fontSize = 16, fontStyle = FontStyle.Bold };
            _secao = new GUIStyle(GUI.skin.label) { fontSize = 13, fontStyle = FontStyle.Bold };
            _secao.normal.textColor = new Color(1f, 0.85f, 0.5f);
            _janela = new GUIStyle(GUI.skin.window) { fontSize = 14 };
        }

        public static void Desenhar()
        {
            if (!Roteiro.EmMarcha || !Jogo.EmEncontro) return;
            Estilos();
            var cor = GUI.color;
            GUI.color = Color.white;
            var botao = new Rect(Screen.width - 150f, 8f, 140f, 30f);
            if (GUI.Button(botao, _aberto ? "Fechar mesa" : "Mesa ▾"))
            {
                _aberto = !_aberto;
                if (_aberto) Montar();
            }
            if (_aberto)
            {
                if (_pintado != _versao) Montar();
                float largura = Mathf.Min(520f, Screen.width - 40f), altura = Mathf.Min(Screen.height - 80f, 60f + _itens.Count * 44f + 120f);
                var janela = new Rect(Screen.width - largura - 10f, 44f, largura, altura);
                GUI.Box(janela, GUIContent.none, _janela);
                GUILayout.BeginArea(new Rect(janela.x + 10f, janela.y + 8f, janela.width - 20f, janela.height - 16f));
                GUILayout.Label("Rodada " + Mathf.Max(0, Roteiro.Rodada) + " · objetivo " + Roteiro.ObjetivoAtual + " de " + Roteiro.QuantosObjetivos + " · inimigos derrotados: " + Roteiro.Derrotados, _titulo);
                _rolagem = GUILayout.BeginScrollView(_rolagem);
                string secao = null;
                if (_itens.Count == 0) GUILayout.Label("Nada a declarar agora.");
                foreach (var item in _itens.ToList())
                {
                    if (item.Secao != secao) { secao = item.Secao; GUILayout.Space(6f); GUILayout.Label(secao, _secao); }
                    if (_porConfirmar == item)
                    {
                        GUILayout.BeginHorizontal();
                        if (GUILayout.Button("Confirmar: " + item.Rotulo, _botao)) { _porConfirmar = null; Executar(item); }
                        if (GUILayout.Button("Não", GUILayout.Width(60f), GUILayout.Height(34f))) _porConfirmar = null;
                        GUILayout.EndHorizontal();
                    }
                    else if (GUILayout.Button(item.Rotulo, _botao))
                    {
                        if (item.Confirmar) _porConfirmar = item; else Executar(item);
                    }
                }
                GUILayout.EndScrollView();
                GUILayout.EndArea();
            }
            GUI.color = cor;
        }

        static void Executar(Item item)
        {
            try { item.Acao?.Invoke(); }
            catch (Exception ex) { Log.Erro("declaração «" + item.Rotulo + "»", ex); }
            Atualizar();
            Montar();
        }
    }
}
