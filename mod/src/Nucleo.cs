using System;
using Bigorna.Encontro;
using Bigorna.Menu;
using Bigorna.Motor;
using FFG.D3;
using UnityEngine;

namespace Bigorna
{
    /// <summary>Componente persistente: batimento do mod, vigilancia de cena, teclas e sobreposicao.</summary>
    public class Nucleo : MonoBehaviour
    {
        public static Nucleo Instancia { get; private set; }
        bool _mostrar = true;
        Scene? _cenaAnterior;
        float _proximaVigilia;
        GUIStyle _rotulo;
        bool _salvandoAntes;

        void Awake() { Instancia = this; Canvas.willRenderCanvases += AntesDaInterface; }
        void OnDestroy() { Canvas.willRenderCanvases -= AntesDaInterface; }
        /// <summary>Logo antes de a interface ser desenhada, em todo quadro: os retratos proprios entram no lugar dos do jogo sem piscar.</summary>
        static void AntesDaInterface() { try { if (Roteiro.EmMarcha || Jogo.EncontroPronto) Personalizados.RetratosAntesDoQuadro(); } catch { } try { HeroisProprios.FormasNasArmas(); } catch { } }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.F8)) _mostrar = !_mostrar;
            if (Input.GetKeyDown(KeyCode.F7)) PainelSons.Aberto = !PainelSons.Aberto;
            if (Input.GetKeyDown(KeyCode.F9)) Relatos.Alternar();
            try { Depuracao.Teclas(); } catch (Exception ex) { Log.Erro("modo de teste", ex); }
            try { VigiarCena(); } catch (Exception ex) { Log.Erro("vigiando a cena", ex); }
            try { MusicaPropria.Batimento(); } catch { }
            try { PacoteVirtual.Garantir(); } catch { }
            try { HeroisProprios.RetratosNaTela(); } catch { }
            try { if (Jogo.EmEncontro) Objetos.VigiarHeroi(); } catch { }
            try { VozesProprias.Batimento(); } catch (Exception ex) { Log.Erro("sons dos monstros", ex); }
            // enquanto o jogo grava a partida, nada entra nem sai da mesa (a gravacao cairia no meio)
            bool salvando = Jogo.Salvando;
            if (salvando != _salvandoAntes) { _salvandoAntes = salvando; if (Jogo.EmEncontro) Log.Info(salvando ? "o jogo está gravando: o roteiro espera" : "gravação concluída: o roteiro segue"); }
            if (!salvando)
            {
                try { Dialogos.Batimento(); } catch (Exception ex) { Log.Erro("fila de quadros", ex); }
                try { Cliques.Batimento(); } catch (Exception ex) { Log.Erro("cliques", ex); }
                try { Silencio.Batimento(); } catch (Exception ex) { Log.Erro("silêncio", ex); }
                try { Roteiro.Batimento(); } catch (Exception ex) { Log.Erro("roteiro", ex); }
                try { Encontro.CartoesDeMonstro.Batimento(); } catch (Exception ex) { Log.Erro("cartões de monstro", ex); }
                try { Encontro.LogicaPropria.Batimento(); } catch (Exception ex) { Log.Erro("lógica dos monstros", ex); }
                try { Encontro.Escolta.Batimento(); } catch (Exception ex) { Log.Erro("escolta", ex); }
            }
            if (_cenaAnterior == Scene.Worldmap || _cenaAnterior == Scene.City) { try { Campanha.Campanha.Batimento(); } catch (Exception ex) { Log.Erro("campanha", ex); } try { Campanha.MapaProprio.Batimento(); } catch (Exception ex) { Log.Erro("mapa próprio", ex); } }
            if (Time.unscaledTime >= _proximaVigilia)
            {
                _proximaVigilia = Time.unscaledTime + 1f;
                try { Roteiro.VigiarObjetivo(); } catch { }
                try { if (Roteiro.EmMarcha) Personalizados.AplicarRetratosDasAbas(); } catch { }
            }
        }

        void VigiarCena()
        {
            var cena = Jogo.CenaAtual();
            if (cena == _cenaAnterior) return;
            var antes = _cenaAnterior;
            _cenaAnterior = cena;
            Log.Info("cena: " + (antes?.ToString() ?? "?") + " → " + (cena?.ToString() ?? "?"));
            bool avulso = Lancador.Avulso && Lancador.Atual != null;
            bool? resultado = Lancador.Resultado;
            if (antes == Scene.Game && cena != Scene.Game && !Lancador.Preparando) { Lancador.Encerrar(); try { HeroisProprios.DesfazerArmas(); } catch (Exception ex) { Log.Erro("devolvendo as armas", ex); } try { MusicaPropria.Parar(); } catch (Exception ex) { Log.Erro("parando a música", ex); } }
            try { PacoteVirtual.Instalar(); } catch { }
            bool mundo = cena == Scene.Worldmap || cena == Scene.City;
            if (cena == Scene.Titlescene) { try { HeroisProprios.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando os heróis", ex); } try { ReceitasProprias.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando as receitas", ex); } try { FacanhasProprias.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando as façanhas", ex); } try { PericiasProprias.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando as perícias", ex); } PainelMapas.Reler(); Campanha.Campanha.Fechar(); Campanha.MapaMundi.RegistrarTodas(); try { Dados.DadosDoEditor.NoTitulo(); } catch (Exception ex) { Log.Erro("dados do editor", ex); } }
            if (mundo)
            {
                try
                {
                    Campanha.Campanha.ReabrirSeForPreciso();
                    Campanha.MapaMundi.RepararDestinos();
                    if (antes == Scene.Game) Campanha.Campanha.AoVoltarDoEncontro(resultado == true);
                    Campanha.Campanha.Sincronizar();
                }
                catch (Exception ex) { Log.Erro("campanha no mapa-mundi", ex); }
            }
            if (mundo && antes != Scene.Worldmap && antes != Scene.City) { try { Campanha.MapaProprio.NovaCena(); } catch { } }
            if (cena == Scene.Worldmap) { try { Dados.DadosDoEditor.NoMapaMundi(); } catch (Exception ex) { Log.Erro("mapa-múndi para o editor", ex); } }
            if (cena == Scene.Game) { try { VozesProprias.NovoEncontro(); VozesProprias.Preparar(); } catch { } }
            if (cena == Scene.Game) { try { Campanha.Campanha.AoEntrarNoEncontro(); } catch (Exception ex) { Log.Erro("campanha ao entrar no encontro", ex); } }
            // missao avulsa terminada: o jogo iria ao mapa-mundi da campanha oficial; voltamos ao menu
            if (avulso && antes == Scene.Game && mundo && Campanha.Campanha.Aberta == null) StartCoroutine(VoltarAoMenu());
            // missao oficial (a aba "Mapas oficiais") terminada: tambem de volta ao menu
            if (Menu.MapasOficiais.EmJogo && antes == Scene.Game && mundo) { Menu.MapasOficiais.EmJogo = false; StartCoroutine(VoltarAoMenu()); }
            if (cena == Scene.Titlescene) Menu.MapasOficiais.EmJogo = false;
        }

        System.Collections.IEnumerator VoltarAoMenu()
        {
            Log.Info("missão avulsa encerrada: voltando ao menu");
            float limite = Time.unscaledTime + 20f;
            while (Time.unscaledTime < limite && (Jogo.Carregador == null || Jogo.Carregador.IsLoading)) yield return null;
            yield return new WaitForSeconds(0.5f);
            try { Jogo.Carregador.LoadTitlescreen(false, false, false); }
            catch (Exception ex) { Log.Erro("voltando ao menu", ex); }
        }

        void OnGUI()
        {
            try
            {
                if (_mostrar)
                {
                    if (_rotulo == null) _rotulo = new GUIStyle(GUI.skin.label) { fontSize = 13 };
                    GUI.color = new Color(0.55f, 0.85f, 1f, 0.95f);
                    GUI.Label(new Rect(12f, 10f, 720f, 22f), "Bigorna " + Bootstrap.Versao + (Lancador.Atual != null ? " · " + Lancador.Atual.NomeVisivel : "") + Idioma.T("  (F9 relatar um problema · F8 esconde · F7 teste de som e cenas · Ctrl+Shift+D modo de teste)", "  (F9 report a problem · F8 hide · F7 sound and cutscene test · Ctrl+Shift+D test mode)"), _rotulo);
                    GUI.color = Color.white;
                }
                PainelMapas.Desenhar();
                Dados.DadosDoEditor.Desenhar();
                Mesa.Desenhar();
                PainelSons.Desenhar();
                Relatos.Desenhar();
                Depuracao.Desenhar();
            }
            catch (Exception ex) { Log.Erro("OnGUI", ex); }
        }
    }
}
