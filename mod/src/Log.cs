using System;
using System.IO;
using UnityEngine;

namespace Bigorna
{
    public static class Log
    {
        static bool _avisado;

        public static void Novo()
        {
            try
            {
                var p = Bootstrap.CaminhoLog;
                if (File.Exists(p) && new FileInfo(p).Length > 2_000_000)
                {
                    File.Copy(p, p + ".anterior", true);
                    File.Delete(p);
                }
                File.AppendAllText(p, Environment.NewLine + "==== " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " ====" + Environment.NewLine);
            }
            catch { }
        }

        public static void Info(string msg)
        {
            var linha = "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + msg;
            Debug.Log("[Bigorna] " + msg);
            try
            {
                File.AppendAllText(Bootstrap.CaminhoLog, linha + Environment.NewLine);
            }
            catch (Exception ex)
            {
                if (!_avisado)
                {
                    _avisado = true;
                    Debug.LogWarning("[Bigorna] nao consigo escrever " + Bootstrap.CaminhoLog + ": " + ex.Message);
                }
            }
        }

        // o mesmo erro a cada quadro (um batimento quebrado) nao enche o arquivo: repete-se no maximo a cada 10 s
        static string _ultimoErro;
        static DateTime _ultimoErroEm;
        static int _repetidos;

        public static void Erro(string contexto, Exception ex)
        {
            var chave = contexto + "|" + ex?.GetType().Name + "|" + ex?.Message;
            var agora = DateTime.UtcNow;
            if (chave == _ultimoErro && (agora - _ultimoErroEm).TotalSeconds < 10) { _repetidos++; return; }
            if (_repetidos > 0 && chave == _ultimoErro) Info("(o erro abaixo repetiu-se " + _repetidos + " vez(es) nos últimos segundos)");
            else if (_repetidos > 0) Info("(o erro anterior repetiu-se mais " + _repetidos + " vez(es))");
            _ultimoErro = chave; _ultimoErroEm = agora; _repetidos = 0;
            Info(contexto + ": " + ex?.GetType().Name + ": " + ex?.Message + "\n" + ex?.StackTrace);
        }
    }
}
