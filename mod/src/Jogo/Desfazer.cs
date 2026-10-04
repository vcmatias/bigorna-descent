using System;
using System.Collections.Generic;

namespace Bigorna
{
    /// <summary>O que o mod mudou nos modelos do jogo (herois, receitas, facanhas, pericias…), guardado para ser desfeito na ordem
    /// inversa quando o jogo volta ao menu: os modelos sao do jogo inteiro, e o proximo mapa (ou um mapa oficial) os quer intactos.</summary>
    public sealed class Desfazer
    {
        readonly List<Action> _passos = new List<Action>();
        public int Count => _passos.Count;
        public void Add(Action passo) => _passos.Add(passo);

        /// <summary>Desfaz tudo, do ultimo ao primeiro (um passo que falha nao impede os outros), e esquece.</summary>
        public void Executar(string oQue)
        {
            if (_passos.Count > 0) Log.Info(oQue + " restaurados (" + _passos.Count + ")");
            for (int k = _passos.Count - 1; k >= 0; k--) { try { _passos[k](); } catch { } }
            _passos.Clear();
        }
    }
}
