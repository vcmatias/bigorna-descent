using System;
using System.IO;
using System.Linq;
using Bigorna.Formato;
using Bigorna.Motor;
using FFG.D3;

namespace Bigorna.Encontro
{
    /// <summary>
    /// v265: as partidas de mapa oneshot em andamento. O jogo grava a partida sozinho no meio do mapa (a cada rodada, e em
    /// "gravar e sair"), na ranhura de rascunho, que o proximo mapa apaga. Quando uma gravacao comeca num mapa oneshot em
    /// jogo, o estado do mod e anotado (durante a gravacao o mod espera, entao ele nao muda); quando ela acaba, a gravacao, o
    /// estado e o mapa vao para a pasta da partida (Formato.Andamento). Lancador.Retomar continua uma delas.
    /// </summary>
    public static class Retomada
    {
        static EstadoDoMapa _estado;
        static Andamento.Ficha _ficha;
        static string _mapa;

        /// <summary>A pasta das partidas em andamento: Bigorna\Oneshot\Andamento, na pasta de dados do jogo.</summary>
        public static void Garantir() { if (string.IsNullOrEmpty(Andamento.Raiz)) Andamento.Raiz = Path.Combine(Menu.Oneshot.Pasta, "Andamento"); }

        public static System.Collections.Generic.List<Andamento> Partidas() { Garantir(); try { return Andamento.Todos(); } catch (Exception ex) { Log.Info("partidas em andamento: " + ex.Message); return new System.Collections.Generic.List<Andamento>(); } }

        /// <summary>O jogo comecou (true) ou acabou (false) de gravar.</summary>
        public static void AoGravar(bool comecou)
        {
            if (comecou)
            {
                _estado = null;
                if (Lancador.Oneshot == null || string.IsNullOrEmpty(Lancador.AndamentoId) || Lancador.Atual == null || !Jogo.EmEncontro || Lancador.Preparando || !Roteiro.EmMarcha) return;
                try { _estado = Capturar(Lancador.Atual); _ficha = FichaAgora(); _mapa = Lancador.Atual.Caminho; }
                catch (Exception ex) { _estado = null; Log.Erro("anotando a partida em andamento", ex); }
                return;
            }
            var e = _estado; _estado = null;
            if (e == null) return;
            try
            {
                Garantir();
                int slot = 0; try { slot = Jogo.DadosJogo?.CurrentSaveIndex ?? 0; } catch { }
                if (!SaveLoadController.GetMostRecentSaveFilePath(slot, out var sav) || string.IsNullOrEmpty(sav) || !File.Exists(sav)) { Log.Info("partida em andamento: a gravação da ranhura " + slot + " não apareceu"); return; }
                if ((DateTime.Now - File.GetLastWriteTime(sav)).TotalMinutes > 3) { Log.Info("partida em andamento: a gravação mais recente da ranhura " + slot + " é antiga (" + Path.GetFileName(sav) + "); nada guardado"); return; }
                var qlog = Path.ChangeExtension(sav, ".qlog");
                var a = Andamento.Gravar(_ficha, e.ParaJson(), sav, File.Exists(qlog) ? qlog : null, _mapa);
                Log.Info("partida em andamento guardada: «" + _ficha.Mapa + "», rodada " + _ficha.Rodada + " (" + Path.GetFileName(sav) + ", " + e.Nossos.Count + " entidade(s) do mod)");
            }
            catch (Exception ex) { Log.Erro("guardando a partida em andamento", ex); }
        }

        static EstadoDoMapa Capturar(Dmap m) => new EstadoDoMapa
        {
            Roteiro = Roteiro.Exportar(),
            Tabuleiro = Tabuleiro.Exportar(),
            Objetos = Objetos.Exportar(),
            Inimigos = Inimigos.Exportar(m),
            Escolta = Escolta.Exportar(),
            Butim = Butim.Exportar(),
            Realces = Acoes.ExportarDestaques(),
            Origem = GrupoDoSave.ExportarOrigem(),
            Nossos = Tabuleiro.EntidadesNossas().Concat(Objetos.EntidadesNossas()).Distinct().ToList()
        };

        static Andamento.Ficha FichaAgora()
        {
            var o = Lancador.Oneshot;
            int rodada = Jogo.Rodada; if (rodada < 0) rodada = Roteiro.Rodada;
            return new Andamento.Ficha
            {
                Id = Lancador.AndamentoId, Mapa = Lancador.Atual?.NomeVisivel, Semente = o?.Semente, Duracao = o?.Duracao ?? -1, Dificuldade = o?.Dificuldade ?? -1, Equipe = o?.Equipe,
                Herois = Jogo.Herois.Select(Herois.NomeDe).ToList(), Rodada = Math.Max(1, rodada), Quando = DateTime.Now.Ticks
            };
        }
    }
}
