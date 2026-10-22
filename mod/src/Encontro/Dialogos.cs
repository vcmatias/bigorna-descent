using System;
using System.Collections;
using System.Collections.Generic;
using FFG.Core;
using FFG.D3;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Fila de mensagens sobre os quadros do proprio jogo. Um quadro por vez; o proximo sai quando o anterior fecha.
    /// Os textos vao como "chave" da mensagem: o jogo mostra a chave crua quando nao existe traducao (Settings.ShowMissingKeys).
    /// </summary>
    public static class Dialogos
    {
        class Pedido
        {
            public string Titulo;
            public string Texto;
            public List<string> Opcoes;
            public List<bool> Ativas;     // resposta apagada (false): ja escolhida numa busca, como no jogo
            public Action AoFechar;
            public Action<int> AoEscolher;
            public Action AoMostrar;      // roda na hora em que o quadro aparece (mostrar uma peca, focar a camera...)
            public bool Desafio;          // quadro de teste: o jogador informa quantos sucessos tirou
            public bool Narrativo;
            public string Personagem;
            public string Fundo;
            public List<string> Elenco;   // outros retratos no quadro narrativo
            public bool Continua;         // narrativo: outra caixa vem logo depois (o quadro fica aberto, sem voltar a cidade)
            public Func<Action, bool> Abrir;  // uma janela propria do mod (a loja, o arsenal): abre na vez dela; a fila espera ela fechar
        }
        /// <summary>O ultimo quadro narrativo ficou aberto esperando a proxima caixa da cena.</summary>
        static bool _continuando;
        static float _continuandoDesde;

        static readonly Queue<Pedido> _fila = new Queue<Pedido>();
        static Pedido _atual;
        static float _desde;
        static float _sumiuDesde = -1f;
        static float _fechouEm = -100f;
        static bool _viuAberto;
        const float Paciencia = 3f;
        /// <summary>Quanto esperar depois de um quadro nosso que foi visto aberto sumir sem avisar (o jogo as vezes fecha sem chamar de volta).</summary>
        const float PacienciaVisto = 0.35f;

        /// <summary>Um quadro nosso fechou ha menos de meio segundo (o clique que o fechou ainda pode estar em voo).</summary>
        public static bool RecemFechado => Time.unscaledTime - _fechouEm < 0.5f;

        /// <summary>Ha um quadro do jogo visivel na tela (simples ou narrativo), seja de quem for.</summary>
        public static bool QuadroVisivel
        {
            get
            {
                try
                {
                    var ui = Jogo.UI;
                    if (ui != null && ((ui.MessageDialog != null && ui.MessageDialog.IsVisible) || (ui.StoryMessageDialog != null && ui.StoryMessageDialog.IsVisible))) return true;
                }
                catch { }
                return Jogo.MostrandoMensagem;
            }
        }

        public static bool Ocupado => _atual != null;
        public static int NaFila => _fila.Count;
        /// <summary>Uma cena (caixas narrativas) esta na tela, entre uma caixa e outra ou na fila.</summary>
        public static bool Narrando { get { if (_continuando || (_atual != null && _atual.Narrativo)) return true; foreach (var p in _fila) if (p.Narrativo) return true; return false; } }

        public static void Limpar()
        {
            // v247: um quadro nosso que esta na tela sai junto (antes a fila o esquecia aberto: na volta ao mapa-mundi, a caixa que
            // sobrou do encontro ficava na tela sem dono, e a fila da campanha esperava ela fechar para sempre)
            bool nosso = (_atual != null && _atual.Abrir == null) || _continuando;
            _fila.Clear();
            _atual = null;
            _continuando = false;   // o quadro narrativo que ficou aberto era da cena anterior
            if (nosso) { Log.Info("limpando a fila: o quadro nosso que estava na tela fecha"); EsconderQuadrosNossos(); }
        }

        /// <summary>Fecha os quadros do jogo que o mod abriu (o narrativo e o simples), se estao visiveis.</summary>
        static void EsconderQuadrosNossos()
        {
            try
            {
                var ui = Jogo.UI;
                if (_storyNosso && ui?.StoryMessageDialog != null && ui.StoryMessageDialog.IsVisible) { Jogo.Persistente?.Audio.StopEmotionalBeat(); ui.StoryMessageDialog.Hide(); }
                if (_mensagemNossa && ui?.MessageDialog != null && ui.MessageDialog.IsVisible) ui.MessageDialog.Hide();
            }
            catch (Exception ex) { Log.Info("fechando o quadro: " + ex.Message); }
            _storyNosso = false; _mensagemNossa = false; _fechouEm = Time.unscaledTime;
        }
        /// <summary>O ultimo quadro narrativo (e o simples) que apareceu foi aberto pelo mod; volta a falso quando o quadro some.</summary>
        static bool _storyNosso, _mensagemNossa, _storyVisto, _mensagemVista;
        static float _nossoDesde, _orfaoDesde = -1f;
        static void MarcarNosso(bool story) { if (story) { _storyNosso = true; _storyVisto = false; } else { _mensagemNossa = true; _mensagemVista = false; } _nossoDesde = Time.unscaledTime; }

        public static void Mensagem(string texto, Action aoFechar = null, string titulo = null, Action aoMostrar = null)
        {
            if (string.IsNullOrEmpty(texto)) { aoMostrar?.Invoke(); aoFechar?.Invoke(); return; }
            Enfileirar(new Pedido { Texto = texto, Titulo = titulo, AoFechar = aoFechar, AoMostrar = aoMostrar });
        }

        /// <summary>Uma janela propria do mod (a loja, o arsenal) na fila dos quadros: abre quando chega a vez dela (depois dos
        /// textos que vieram antes) e a fila espera ela fechar. abrir recebe o "fechou" e diz se abriu.</summary>
        public static void JanelaPropria(Func<Action, bool> abrir)
        {
            if (abrir == null) return;
            Enfileirar(new Pedido { Texto = "", Abrir = abrir });
        }

        /// <summary>Quadro de teste do proprio jogo: o jogador ajusta o numero de sucessos e confirma.</summary>
        public static void Desafio(string texto, Action<int> aoEnviar, string titulo = null)
        {
            Enfileirar(new Pedido { Texto = texto ?? "", Titulo = titulo, Desafio = true, AoEscolher = aoEnviar });
        }

        public static void Escolha(string texto, List<string> opcoes, Action<int> aoEscolher, string titulo = null, List<bool> ativas = null)
        {
            if (opcoes == null || opcoes.Count == 0) { Mensagem(texto, () => aoEscolher?.Invoke(-1), titulo); return; }
            Enfileirar(new Pedido { Texto = texto ?? "", Titulo = titulo, Opcoes = opcoes, AoEscolher = aoEscolher, Ativas = ativas });
        }

        /// <summary>Uma resposta apagada no quadro do jogo: a condicao existe e nao foi cumprida (o jogo a mostra cinza e a trava).</summary>
        static MessageChoice Resposta(string texto, bool ativa)
        {
            var c = new MessageChoice(texto);
            if (!ativa)
            {
                try { c.Condition = new FFG.D3.Tasks.Conditions.IsEnemyActivationRunning(); c.ConditionMet = false; }
                catch (Exception ex) { Log.Info("resposta apagada: " + ex.Message); }
            }
            return c;
        }

        public static void Narrativa(string texto, string personagem, string fundo, Action aoFechar = null, List<string> opcoes = null, Action<int> aoEscolher = null, List<string> elenco = null, string titulo = null, bool continua = false)
        {
            Enfileirar(new Pedido { Texto = texto ?? "", Titulo = titulo, Narrativo = true, Personagem = personagem, Fundo = fundo, Elenco = elenco, AoFechar = aoFechar, Opcoes = opcoes, AoEscolher = aoEscolher, Continua = continua });
        }

        /// <summary>Fecha o quadro narrativo que ficou aberto para a proxima caixa (fim da cena, ou antes de um filme ou de outro quadro).</summary>
        public static void FecharNarrativa()
        {
            if (!_continuando) return;
            _continuando = false;
            try
            {
                var d = Jogo.UI?.StoryMessageDialog;
                if (d != null && d.IsVisible) { Jogo.Persistente?.Audio.StopEmotionalBeat(); d.Hide(); }
                _storyNosso = false;
            }
            catch (Exception ex) { Log.Info("fechando o quadro da cena: " + ex.Message); }
            _fechouEm = Time.unscaledTime;
        }

        static void Enfileirar(Pedido p)
        {
            _fila.Enqueue(p);
            Puxar();
        }

        static void Puxar()
        {
            if (_atual != null || _fila.Count == 0) return;
            if (VideoProprio.EmMarcha) return; // um filme esta na tela; o quadro sai quando ele acabar
            if (_continuando)
            {
                // a cena segue no mesmo quadro; qualquer outro quadro fecha a cena antes
                if (!_fila.Peek().Narrativo) FecharNarrativa();
            }
            else if (QuadroVisivel) return; // o jogo esta com um quadro dele; tentamos no batimento
            if (_continuando && !_fila.Peek().Narrativo) return;
            var p = _fila.Dequeue();
            _continuando = false;
            _atual = p;
            _desde = Time.unscaledTime;
            _sumiuDesde = -1f;
            _viuAberto = false;
            try { p.AoMostrar?.Invoke(); } catch (Exception ex) { Log.Erro("ao mostrar o quadro", ex); }
            bool ok;
            try { ok = Mostrar(p); }
            catch (Exception ex) { Log.Info("não consegui mostrar o quadro: " + ex.Message); ok = false; }
            if (!ok)
            {
                _atual = null;
                Terminar(p, -1);
                Puxar();
            }
        }

        static void Terminar(Pedido p, int escolha)
        {
            try { p.AoEscolher?.Invoke(escolha); } catch (Exception ex) { Log.Erro("ao escolher", ex); }
            try { p.AoFechar?.Invoke(); } catch (Exception ex) { Log.Erro("ao fechar o quadro", ex); }
        }

        static void Fechou(Pedido p, int escolha)
        {
            if (_atual != p) return;
            _atual = null;
            _fechouEm = Time.unscaledTime;
            if (p.Narrativo && p.Continua) { _continuando = true; _continuandoDesde = Time.unscaledTime; }
            else if (p.Narrativo) _storyNosso = false; else _mensagemNossa = false;   // (v247: o quadro fecha sozinho; o proximo que aparecer pode ser do jogo)
            Terminar(p, escolha);
            // o proximo sai no batimento seguinte, quando o jogo ja soltou o quadro
        }

        static bool Mostrar(Pedido p)
        {
            if (p.Abrir != null) return p.Abrir(() => Fechou(p, -1));
            var persistente = Jogo.Persistente;
            var ui = Jogo.UI;
            if (persistente == null) return false;
            var titulo = string.IsNullOrEmpty(p.Titulo) ? null : "<b>" + p.Titulo + "</b>\n\n";
            var texto = (titulo ?? "") + (p.Texto ?? "");

            if (p.Narrativo)
            {
                if (persistente.StoryMessages == null) return false;
                IMessageRequest pedido;
                if (p.Opcoes != null && p.Opcoes.Count > 0)
                {
                    var m = new MultipleChoiceMessageRequest { Key = texto };
                    foreach (var o in p.Opcoes) m.Choices.Add(new MessageChoice(o));
                    m.CallbackChoice = i => Fechou(p, i);
                    pedido = m;
                }
                else
                {
                    pedido = new MessageRequest { Key = texto, CallbackContinue = () => Fechou(p, -1) };
                }
                pedido.Settings.BackDisabled = true;
                var cfg = new StoryMessageSettings { CloseOnFinish = !p.Continua, BackgroundType = Fundo(p.Fundo) };
                var vagas = new[] { cfg.Character_1, cfg.Character_2, cfg.Character_3, cfg.Character_4 };
                var gente = new List<string>();
                if (!string.IsNullOrEmpty(p.Personagem)) gente.Add(p.Personagem);
                foreach (var e in p.Elenco ?? new List<string>()) if (!string.IsNullOrEmpty(e) && !gente.Contains(e)) gente.Add(e);
                for (int i = 0; i < gente.Count && i < vagas.Length; i++)
                {
                    try
                    {
                        var modelo = UserCollectionManager.GetStoryCharacter(gente[i], true);
                        if (modelo != null) { vagas[i].Character = modelo; vagas[i].IsSpeaking = i == 0 && !string.IsNullOrEmpty(p.Personagem); }
                        else Log.Info("personagem «" + gente[i] + "» não existe nesta coleção; sai sem retrato");
                    }
                    catch (Exception ex) { Log.Info("personagem: " + ex.Message); }
                }
                persistente.StoryMessages.DisplayMessage(pedido, cfg);
                MarcarNosso(true);
                Nucleo.Instancia?.StartCoroutine(RetratosDepois());
                return true;
            }

            if (persistente.Messages == null || ui == null || ui.MessageDialog == null) return false;
            if (p.Desafio)
            {
                var d = new ChallengeMessageRequest(texto, i => Fechou(p, i));
                d.LuckyCharmAdditionalSuccesses = -1;
                d.Settings.BackDisabled = true;
                persistente.Messages.DisplayMessage(d, ui.MessageDialog); MarcarNosso(false);
            }
            else if (p.Opcoes != null && p.Opcoes.Count > 0)
            {
                var m = new MultipleChoiceMessageRequest { Key = texto };
                for (int i = 0; i < p.Opcoes.Count; i++) m.Choices.Add(Resposta(p.Opcoes[i], p.Ativas == null || i >= p.Ativas.Count || p.Ativas[i]));
                m.CallbackChoice = i => Fechou(p, i);
                m.Settings.BackDisabled = true;
                persistente.Messages.DisplayMessage(m, ui.MessageDialog); MarcarNosso(false);
            }
            else
            {
                var m = new MessageRequest { Key = texto, CallbackContinue = () => Fechou(p, -1) };
                m.Settings.BackDisabled = true;
                persistente.Messages.DisplayMessage(m, ui.MessageDialog); MarcarNosso(false);
            }
            return true;
        }

        static System.Collections.IEnumerator RetratosDepois() { yield return null; yield return null; Personalizados.AplicarRetratosDoQuadro(); yield return new WaitForSeconds(0.3f); Personalizados.AplicarRetratosDoQuadro(); }

        static StoryMessageBackgroundType Fundo(string nome)
        {
            if (string.IsNullOrEmpty(nome)) return StoryMessageBackgroundType.Road;
            if (int.TryParse(nome, out var n) && Enum.IsDefined(typeof(StoryMessageBackgroundType), n)) return (StoryMessageBackgroundType)n;
            try { return (StoryMessageBackgroundType)Enum.Parse(typeof(StoryMessageBackgroundType), nome, true); }
            catch { return StoryMessageBackgroundType.Road; }
        }

        /// <summary>v247: um quadro aberto pelo mod que ficou na tela sem dono (nenhum aviso nosso em curso, nenhuma cena entre caixas)
        /// fecha depois de 1,5 s; um quadro do proprio jogo fica (o "nosso" volta a falso assim que o quadro some).</summary>
        static void VigiarOrfao()
        {
            bool story = false, msg = false;
            try { var ui = Jogo.UI; story = ui?.StoryMessageDialog != null && ui.StoryMessageDialog.IsVisible; msg = ui?.MessageDialog != null && ui.MessageDialog.IsVisible; } catch { }
            // (o quadro pode levar uns quadros para aparecer: o "nosso" so cai depois de visto e sumido, ou 3 s sem aparecer)
            if (story && _storyNosso) _storyVisto = true; else if (!story && _storyNosso && (_storyVisto || Time.unscaledTime - _nossoDesde > 3f)) _storyNosso = false;
            if (msg && _mensagemNossa) _mensagemVista = true; else if (!msg && _mensagemNossa && (_mensagemVista || Time.unscaledTime - _nossoDesde > 3f)) _mensagemNossa = false;
            bool orfao = _atual == null && !_continuando && ((story && _storyNosso) || (msg && _mensagemNossa));
            if (!orfao) { _orfaoDesde = -1f; return; }
            if (_orfaoDesde < 0f) { _orfaoDesde = Time.unscaledTime; return; }
            if (Time.unscaledTime - _orfaoDesde < 1.5f) return;
            _orfaoDesde = -1f;
            Log.Info("um quadro do mod ficou na tela sem dono; fechando para a fila seguir");
            EsconderQuadrosNossos();
        }

        /// <summary>Chamado a cada quadro: destrava a fila se o quadro sumiu sem avisar e puxa o proximo.</summary>
        static bool _esperandoTela;
        public static void Batimento()
        {
            VigiarOrfao();
            if (_atual != null)
            {
                if (_atual.Abrir != null ? Encontro.Janela.Visivel : QuadroVisivel) { _sumiuDesde = -1f; _viuAberto = true; }
                else if (_sumiuDesde < 0f) _sumiuDesde = Time.unscaledTime;
                else if (_viuAberto ? Time.unscaledTime - _sumiuDesde > PacienciaVisto : (Time.unscaledTime - _sumiuDesde > Paciencia && Time.unscaledTime - _desde > Paciencia))
                {
                    var p = _atual;
                    Log.Info(_viuAberto ? "um quadro fechou sem avisar; a fila segue" : "um quadro não apareceu (" + Paciencia + "s sem nenhum à vista); a fila segue");
                    _atual = null;
                    _sumiuDesde = -1f;
                    _fechouEm = Time.unscaledTime;
                    Terminar(p, -1);
                }
            }
            // o jogador esta noutra tela (a ficha de um monstro, o inventario, o registro da missao…): a fila espera ele voltar ao
            // mapa; antes, uma onda entrava e peças apareciam sem ninguem ver
            if (_atual == null && _fila.Count > 0 && !_continuando && Jogo.OutraTela) { if (!_esperandoTela) { _esperandoTela = true; Log.Info("outra tela aberta: os avisos esperam a volta ao mapa"); } return; }
            if (_esperandoTela) { _esperandoTela = false; Log.Info("de volta ao mapa: os avisos seguem"); }
            if (_atual == null && _fila.Count > 0 && (!RecemFechado || _continuando)) Puxar();
            // a cena parou sem mandar a proxima caixa: o quadro que ficou aberto fecha
            if (_continuando && _atual == null && _fila.Count == 0 && Time.unscaledTime - _continuandoDesde > 1.5f) { Log.Info("a cena acabou sem fechar o quadro; fechando"); FecharNarrativa(); }
        }
    }
}
