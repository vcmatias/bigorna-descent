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
        /// <summary>F8: false esconde tudo o que o mod desenha na tela (rotulo, avisos, paineis, botoes); F8 de novo mostra.</summary>
        public static bool Visivel = true;
        Scene? _cenaAnterior;
        float _proximaVigilia;
        GUIStyle _rotulo;
        bool _salvandoAntes;

        void Awake() { Instancia = this; Canvas.willRenderCanvases += AntesDaInterface; if (!_vigiando) { _vigiando = true; Application.logMessageReceived += VigiarCargaDoMundo; } }
        void OnApplicationQuit() { try { Menu.Oneshot.FecharGerador("o jogo fechou"); } catch { } }   // (v274; o gerador também vigia o processo do jogo)
        void OnDestroy() { Canvas.willRenderCanvases -= AntesDaInterface; }
        /// <summary>Logo antes de a interface ser desenhada, em todo quadro: os retratos proprios entram no lugar dos do jogo sem piscar.</summary>
        static void AntesDaInterface() { try { if (Roteiro.EmMarcha || Jogo.EncontroPronto) Personalizados.RetratosAntesDoQuadro(); } catch { } try { HeroisProprios.FormasNasArmas(); } catch { } }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.F8)) { Visivel = !Visivel; Log.Info(Visivel ? "informações do mod na tela (F8)" : "informações do mod escondidas (F8)"); }
            if (Input.GetKeyDown(KeyCode.F7)) { Depuracao.Alternar(); if (Depuracao.Ligada) Visivel = true; }
            if (Input.GetKeyDown(KeyCode.F9)) { Relatos.Alternar(); if (Relatos.Aberto) Visivel = true; }
            try { Depuracao.Teclas(); } catch (Exception ex) { Log.Erro("modo de teste", ex); }
            try { VigiarCena(); } catch (Exception ex) { Log.Erro("vigiando a cena", ex); }
            try { Encontro.Lancador.DestravarCarga(); } catch { }   // (v288: o quadro de carregamento escondido)
            try { Menu.BotaoDoMenu.Batimento(); } catch (Exception ex) { Log.Erro("botão do menu", ex); }
            try { Menu.TelaDeMapas.Batimento(); } catch (Exception ex) { Log.Erro("tela de mapas", ex); }
            try { GrupoDoSave.Batimento(); } catch (Exception ex) { Log.Erro("quadro do grupo", ex); }   // (v286)   // (v280: o Novo jogo + que volta do quadro de dificuldade)
            try { Menu.PainelMapas.Batimento(); if (Jogo.CenaAtual() == Scene.Titlescene) Menu.PainelMapas.Aquecer(); } catch (Exception ex) { Log.Erro("lendo os mapas da comunidade", ex); }   // (v263: a pasta lida ao fundo; na tela de título, antes do primeiro clique)
            try { Campanha.SavesDaComunidade.Batimento(); } catch (Exception ex) { Log.Erro("partidas da comunidade", ex); }
            try { Menu.Atualizacao.Batimento(); } catch (Exception ex) { Log.Erro("atualização", ex); }
            try { MusicaPropria.Batimento(); } catch { }
            try { PacoteVirtual.Garantir(); } catch { }
            try { HeroisProprios.RetratosNaTela(); } catch { }
            try { if (Jogo.EmEncontro) Objetos.VigiarHeroi(); } catch { }
            try { VozesProprias.Batimento(); } catch (Exception ex) { Log.Erro("sons dos monstros", ex); }
            try { CanalDeTeste.Batimento(); } catch (Exception ex) { Log.Erro("canal de teste", ex); }   // (v268: desligado sem o arquivo Bigorna\Teste\ativo)
            // enquanto o jogo grava a partida, nada entra nem sai da mesa (a gravacao cairia no meio)
            bool salvando = Jogo.Salvando;
            if (salvando != _salvandoAntes)
            {
                _salvandoAntes = salvando; if (Jogo.EmEncontro) Log.Info(salvando ? "o jogo está gravando: o roteiro espera" : "gravação concluída: o roteiro segue");
                try { Retomada.AoGravar(salvando); } catch (Exception ex) { Log.Erro("partida em andamento", ex); }   // (v265: o mapa oneshot deixado no meio continua depois)
            }
            if (!salvando)
            {
                try { Dialogos.Batimento(); } catch (Exception ex) { Log.Erro("fila de quadros", ex); }
                try { Cliques.Batimento(); } catch (Exception ex) { Log.Erro("cliques", ex); }
                try { Silencio.Batimento(); } catch (Exception ex) { Log.Erro("silêncio", ex); }
                try { Roteiro.Batimento(); } catch (Exception ex) { Log.Erro("roteiro", ex); }
                try { Encontro.CartoesDeMonstro.Batimento(); } catch (Exception ex) { Log.Erro("cartões de monstro", ex); }
                try { Encontro.LogicaPropria.Batimento(); } catch (Exception ex) { Log.Erro("lógica dos monstros", ex); }
                try { Encontro.Apetrechos.Batimento(); } catch (Exception ex) { Log.Erro("apetrechos", ex); }
                try { Encontro.Escolta.Batimento(); } catch (Exception ex) { Log.Erro("escolta", ex); }
                try { Encontro.FacanhasProprias.Batimento(); } catch (Exception ex) { Log.Erro("prêmio das façanhas", ex); }
                try { Menu.NovoJogoMais.Batimento(); } catch (Exception ex) { Log.Erro("Novo jogo +", ex); }   // (v262: a partida marcada, acertada fora das gravações)
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
            var nomeDoMapa = Lancador.Atual?.NomeVisivel;
            if (antes == Scene.Game && cena != Scene.Game && !Lancador.Preparando) { Lancador.Encerrar(); try { HeroisProprios.DesfazerArmas(); } catch (Exception ex) { Log.Erro("devolvendo as armas", ex); } try { MusicaPropria.Parar(); } catch (Exception ex) { Log.Erro("parando a música", ex); } }
            try { PacoteVirtual.Instalar(); } catch { }
            bool mundo = cena == Scene.Worldmap || cena == Scene.City;
            if (cena == Scene.Titlescene) Idioma.JogoPronto = true;
            if (antes == Scene.Titlescene && cena != Scene.Titlescene) Menu.Oneshot.FecharGerador("a tela de título ficou para trás");   // (v274)
            if (cena == Scene.Titlescene) { try { GrupoDoSave.RecuperarPendente(); } catch (Exception ex) { Log.Erro("a pergunta do grupo", ex); } try { HeroisProprios.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando os heróis", ex); } try { ReceitasProprias.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando as receitas", ex); } try { FacanhasProprias.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando as façanhas", ex); } try { PericiasProprias.Restaurar(); } catch (Exception ex) { Log.Erro("restaurando as perícias", ex); } PainelMapas.Reler(); Campanha.Campanha.Fechar(); Campanha.MapaMundi.RegistrarTodas(); StartCoroutine(Campanha.SavesDaComunidade.AoEntrarNoTitulo()); try { Dados.DadosDoEditor.NoTitulo(); } catch (Exception ex) { Log.Erro("dados do editor", ex); } }
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
            if (avulso && antes == Scene.Game && mundo && Campanha.Campanha.Aberta == null) { try { GrupoDoSave.AoTerminar(nomeDoMapa); } catch (Exception ex) { Log.Erro("grupo no fim do mapa", ex); } StartCoroutine(VoltarAoMenu()); }
            // missao oficial (a aba "Mapas oficiais") terminada: tambem de volta ao menu
            if (Menu.MapasOficiais.EmJogo && antes == Scene.Game && mundo) { Menu.MapasOficiais.EmJogo = false; StartCoroutine(VoltarAoMenu()); }
            if (cena == Scene.Titlescene) Menu.MapasOficiais.EmJogo = false;
        }

        static DateTime _quedaDoMundo = DateTime.MinValue; static bool _vigiando;
        static void VigiarCargaDoMundo(string texto, string pilha, LogType tipo)
        {
            if (tipo == LogType.Exception && ((pilha ?? "").Contains("CoroutineLoadWorldMap") || (texto ?? "").Contains("CoroutineLoadWorldMap"))) _quedaDoMundo = DateTime.UtcNow;
        }
        System.Collections.IEnumerator VoltarAoMenu()
        {
            Log.Info("missão avulsa encerrada: voltando ao menu");
            float limite = Time.unscaledTime + 20f; var desde = DateTime.UtcNow.AddSeconds(-3);
            {
            // (v288: o jogo carrega o mapa-mundi e espera o «Continuar» do quadro de carregamento, que fica escondido: a carga
            //  ficava pendurada até o limite e, solta mais tarde (no mapa seguinte), caía sem o mapa-mundi e travava o começo do
            //  outro mapa. Agora a carga para ali, e a tela de título vem logo)
            while (Time.unscaledTime < limite && (Jogo.Carregador == null || Jogo.Carregador.IsLoading))
            {
                try
                {
                    var tela = Jogo.UI?.LoadingScreen;
                    // (v288: numa partida retomada a carga do mapa-mundi cai antes do «Continuar» (NullReference no jogo) e fica
                    //  como carregando: o erro dela no registro do jogo conta como carga caída)
                    bool caiu = _quedaDoMundo > desde;
                    if (tela != null && (tela.IsWaitingForInput || caiu))
                    {
                        // (o mapa-mundi não serve à missão avulsa: a carga dele para ali, sem o diálogo nem a música dele)
                        Log.Info(tela.IsWaitingForInput ? "missão avulsa encerrada: a carga do mapa-mundi esperava «Continuar»; paro a carga e volto ao menu" : "missão avulsa encerrada: a carga do mapa-mundi parou no meio; volto ao menu");
                        // (v289: só com o campo da carga achado; se o jogo mudou por dentro, a carga segue do jeito do próprio jogo:
                        //  o toque no «Continuar», ou a espera até o limite, como antes)
                        var campo = CampoDaCarga;
                        if (campo == null)
                        {
                            if (!_avisouCampo) { _avisouCampo = true; Log.Info("AVISO: o jogo mudou por dentro (LevelLoader._isLoading); a volta ao menu segue do jeito antigo"); }
                            if (tela.IsWaitingForInput) Jogo.UI.OnLoadingScreenContinueClicked();
                        }
                        else
                        {
                            Jogo.Carregador.StopAllCoroutines();
                            campo.SetValue(Jogo.Carregador, false);
                            tela.IsWaitingForInput = false; try { tela.ButtonLoadingContinue.gameObject.SetActive(false); } catch { }
                            break;
                        }
                    }
                }
                catch (Exception ex) { Log.Erro("parando a carga do mapa-mundi", ex); }
                yield return null;
            }
            }
            if (Jogo.Carregador != null && Jogo.Carregador.IsLoading) Log.Info("missão avulsa encerrada: o mapa-mundi ainda carregava depois de 20 s");
            yield return new WaitForSeconds(0.5f);
            try { Jogo.Carregador.LoadTitlescreen(false, false, false); }
            catch (Exception ex) { Log.Erro("voltando ao menu", ex); yield break; }
            // (v289: a conferência: a tela de título abre e a carga termina; senão, fica no registro, para o F9 levar)
            float ate = Time.unscaledTime + 40f;
            while (Time.unscaledTime < ate && !(Jogo.CenaAtual() == Scene.Titlescene && Jogo.Carregador != null && !Jogo.Carregador.IsLoading)) yield return null;
            if (Jogo.CenaAtual() == Scene.Titlescene && Jogo.Carregador != null && !Jogo.Carregador.IsLoading) Log.Info("missão avulsa encerrada: de volta à tela de título");
            else Log.Info("AVISO: a volta ao menu não terminou em 40 s (cena " + Jogo.CenaAtual() + ", carregando " + (Jogo.Carregador?.IsLoading.ToString() ?? "?") + ")");
        }
        static System.Reflection.FieldInfo _campoDaCarga; static bool _campoProcurado, _avisouCampo;
        static System.Reflection.FieldInfo CampoDaCarga
        {
            get
            {
                if (!_campoProcurado) { _campoProcurado = true; try { var f = typeof(LevelLoader).GetField("_isLoading", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic); _campoDaCarga = f != null && f.FieldType == typeof(bool) ? f : null; } catch { } }
                return _campoDaCarga;
            }
        }

        void OnGUI()
        {
            try
            {
                // (a escolha do destino do grupo aparece mesmo com o resto escondido (F8), e por cima de tudo)
                if (!Visivel) { try { GrupoDoSave.Desenhar(); } catch (Exception ex) { Log.Erro("janela do grupo", ex); } return; }
                {
                    if (_rotulo == null) _rotulo = new GUIStyle(GUI.skin.label) { fontSize = 13 };
                    GUI.color = new Color(0.55f, 0.85f, 1f, 0.95f);
                    GUI.Label(new Rect(12f, 10f, 720f, 22f), "Bigorna " + Bootstrap.Versao + (Lancador.Atual != null ? " · " + Lancador.Atual.NomeVisivel : "") + Idioma.T("  (F9 relatar um problema · F8 esconde tudo · F7 modo de teste, sons e cenas)", "  (F9 report a problem · F8 hide everything · F7 test mode, sounds and cutscenes)"), _rotulo);
                    GUI.color = Color.white;
                }
                PainelMapas.Desenhar();
                Dados.DadosDoEditor.Desenhar();
                Mesa.Desenhar();
                PainelSons.Desenhar();
                Relatos.Desenhar();
                Menu.Atualizacao.Desenhar();
                Depuracao.Desenhar();
                try { GrupoDoSave.Desenhar(); } catch (Exception ex) { Log.Erro("janela do grupo", ex); }
            }
            catch (Exception ex) { Log.Erro("OnGUI", ex); }
        }
    }
}
