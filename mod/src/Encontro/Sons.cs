using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>Sons do jogo (eventos Wwise). A lista de bancos e eventos vem do SoundbanksInfo.xml da instalacao do jogo,
    /// lido na primeira vez que se precisa dela. Antes de tocar, carrega o banco do evento, que pode nao estar na memoria.</summary>
    public static class Sons
    {
        static Dictionary<string, string> _bancoDe;
        static List<(string banco, string[] eventos)> _bancos;
        static readonly HashSet<string> _carregados = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        static void Ler()
        {
            if (_bancos != null) return;
            _bancos = new List<(string, string[])>();
            _bancoDe = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                var raiz = Path.Combine(Application.streamingAssetsPath, "Audio", "GeneratedSoundBanks");
                var arq = Directory.Exists(raiz) ? Directory.GetFiles(raiz, "SoundbanksInfo.xml", SearchOption.AllDirectories).OrderBy(f => f.Length).FirstOrDefault() : null;
                if (arq == null) { Log.Info("sons: SoundbanksInfo.xml não encontrado em " + raiz); return; }
                var texto = File.ReadAllText(arq);
                var porBanco = new SortedDictionary<string, SortedSet<string>>(StringComparer.Ordinal);
                foreach (Match b in Regex.Matches(texto, @"<SoundBank\b[^>]*>(.*?)</SoundBank>", RegexOptions.Singleline))
                {
                    var corpo = b.Groups[1].Value;
                    var nome = Regex.Match(corpo, @"<ShortName>([^<]+)</ShortName>").Groups[1].Value.Trim();
                    if (nome.Length == 0) continue;
                    if (!porBanco.TryGetValue(nome, out var evs)) porBanco[nome] = evs = new SortedSet<string>(StringComparer.Ordinal);
                    foreach (Match e in Regex.Matches(corpo, @"<Event\b[^>]*\bName=""([^""]+)""")) evs.Add(e.Groups[1].Value);
                }
                foreach (var kv in porBanco)
                {
                    if (kv.Value.Count == 0) continue;
                    _bancos.Add((kv.Key, kv.Value.ToArray()));
                    foreach (var e in kv.Value) if (!_bancoDe.ContainsKey(e)) _bancoDe[e] = kv.Key;
                }
                Log.Info("sons do jogo: " + _bancoDe.Count + " eventos em " + _bancos.Count + " bancos");
            }
            catch (Exception ex) { Log.Info("sons: não li o SoundbanksInfo.xml: " + ex.Message); }
        }

        public static IEnumerable<(string banco, string[] eventos)> Bancos { get { Ler(); return _bancos; } }
        public static bool Conhecido(string evento) { Ler(); return !string.IsNullOrEmpty(evento) && _bancoDe.ContainsKey(evento); }

        public static void Tocar(string evento)
        {
            if (string.IsNullOrEmpty(evento)) return;
            Ler();
            try
            {
                if (_bancoDe.TryGetValue(evento, out var banco) && !_carregados.Contains(banco))
                {
                    AkBankManager.LoadBankAsync(banco);
                    _carregados.Add(banco);
                }
            }
            catch (Exception ex) { Log.Info("banco de som: " + ex.Message); }
            if (!Conhecido(evento)) Log.Info("som «" + evento + "» não está na lista do jogo; tento mesmo assim");
            Jogo.Som(evento);
        }
    }
}
