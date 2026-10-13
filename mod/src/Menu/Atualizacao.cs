using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>
    /// Atualizacao do Bigorna. Uma vez por abertura do jogo, na tela de titulo, o mod pergunta ao GitHub qual e a versao mais
    /// nova (a ultima "release" do repositorio publico). Se for mais nova que esta, uma janela pergunta se pode baixar e
    /// instalar (com as notas da versao); "Depois" pergunta de novo na proxima abertura; "Pular esta versao" so volta a
    /// perguntar numa versao seguinte. Autorizado: baixa o .zip da versao, tira dele a DLL (que leva o editor dentro: o editor
    /// novo vai para a pasta Editor quando o jogo abrir de novo) e a guarda ao lado do registro. A DLL em uso nao pode ser
    /// trocada com o jogo aberto: um pequeno script espera o jogo fechar, copia a DLL nova por cima da antiga (pedindo
    /// permissao de administrador se a pasta do jogo pedir) e reabre o jogo, se a pessoa escolheu reabrir.
    /// Sem internet, ou com o GitHub fora do ar, nada aparece: a verificacao fica so no registro.
    /// </summary>
    public static class Atualizacao
    {
        const string Repositorio = "vcmatias/bigorna-descent";
        static string Api => "https://api.github.com/repos/" + Repositorio + "/releases/latest";

        static bool _verificou, _aberto, _baixando, _pronto, _agendado;
        static float _quando = -1f;
        static string _versaoNova, _notas, _url, _situacao;
        static Vector2 _rolagem;
        static GUIStyle _titulo, _pequeno;

        static string Pasta => Path.Combine(Application.persistentDataPath, "Atualizacao");
        static string ArquivoPulada => Path.Combine(Pasta, "pular.txt");
        static string MarcaFeita => Path.Combine(Pasta, "instalada.txt");

        /// <summary>A cada quadro: na primeira visita a tela de titulo (alguns segundos depois, com o menu ja de pe), a pergunta ao
        /// GitHub; depois de uma atualizacao instalada, o aviso de que deu certo.</summary>
        public static void Batimento()
        {
            if (_verificou || Jogo.CenaAtual() != FFG.D3.Scene.Titlescene) return;
            if (_quando < 0f) { _quando = Time.unscaledTime + 4f; return; }
            if (Time.unscaledTime < _quando) return;
            _verificou = true;
            try
            {
                if (File.Exists(MarcaFeita)) { var v = File.ReadAllText(MarcaFeita).Trim(); File.Delete(MarcaFeita); Log.Info("atualização: instalada a versão " + v); }
                foreach (var velho in new[] { "Bigorna.dll.novo", "atualizar.bat" }) { var c = Path.Combine(Pasta, velho); if (File.Exists(c) && !_baixando) File.Delete(c); }
            }
            catch { }
            Nucleo.Instancia?.StartCoroutine(Verificar());
        }

        static IEnumerator Verificar()
        {
            using (var req = UnityWebRequest.Get(Api))
            {
                req.SetRequestHeader("User-Agent", "Bigorna/" + Bootstrap.Versao);
                req.SetRequestHeader("Accept", "application/vnd.github+json");
                req.timeout = 15;
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success) { Log.Info("atualização: não consegui perguntar ao GitHub (" + req.error + ")"); yield break; }
                try
                {
                    var j = JObject.Parse(req.downloadHandler.text);
                    var tag = ((string)j["tag_name"] ?? "").Trim(); var nova = tag.TrimStart('v', 'V');
                    if (!Mais(nova, Bootstrap.Versao)) { Log.Info("atualização: o Bigorna está em dia (" + Bootstrap.Versao + "; a última é " + nova + ")"); yield break; }
                    string pulada = null; try { if (File.Exists(ArquivoPulada)) pulada = File.ReadAllText(ArquivoPulada).Trim(); } catch { }
                    if (pulada == nova) { Log.Info("atualização: versão " + nova + " pulada a pedido"); yield break; }
                    string url = null;
                    foreach (var a in (JArray)j["assets"] ?? new JArray())
                    {
                        var nome = (string)a["name"] ?? "";
                        if (nome.StartsWith("Bigorna-", StringComparison.OrdinalIgnoreCase) && nome.EndsWith(".zip", StringComparison.OrdinalIgnoreCase)) { url = (string)a["browser_download_url"]; break; }
                    }
                    if (string.IsNullOrEmpty(url)) { Log.Info("atualização: a versão " + nova + " não tem o pacote .zip"); yield break; }
                    _versaoNova = nova; _url = url; _notas = ((string)j["body"] ?? "").Trim(); if (_notas.Length > 1500) _notas = _notas.Substring(0, 1500).TrimEnd() + "…";
                    _situacao = ""; _aberto = true;
                    Log.Info("atualização: há a versão " + nova + " (esta é " + Bootstrap.Versao + "); perguntando");
                }
                catch (Exception ex) { Log.Info("atualização: resposta do GitHub ilegível: " + ex.Message); }
            }
        }

        /// <summary>a &gt; b, comparando as versoes por partes (0.1.10 depois de 0.1.9).</summary>
        static bool Mais(string a, string b)
        {
            int[] P(string v) { var ps = (v ?? "").Split('.', '-', '+'); var r = new int[4]; for (int i = 0; i < 4 && i < ps.Length; i++) int.TryParse(ps[i], out r[i]); return r; }
            var x = P(a); var y = P(b);
            for (int i = 0; i < 4; i++) { if (x[i] != y[i]) return x[i] > y[i]; }
            return false;
        }

        public static void Desenhar()
        {
            if (!_aberto) return;
            if (_titulo == null)
            {
                _titulo = new GUIStyle(GUI.skin.label) { fontSize = 17, fontStyle = FontStyle.Bold, richText = true, wordWrap = true };
                _pequeno = new GUIStyle(GUI.skin.label) { fontSize = 13, wordWrap = true, richText = true };
            }
            float w = 600f, h = 380f; var r = new Rect((Screen.width - w) / 2f, (Screen.height - h) / 2f, w, h);
            GUI.Box(r, ""); GUI.Box(r, ""); GUI.Box(r, "");
            GUILayout.BeginArea(new Rect(r.x + 14f, r.y + 12f, r.width - 28f, r.height - 24f));
            GUILayout.Label(T("Há uma versão nova do Bigorna: ", "A new version of Bigorna is out: ") + _versaoNova, _titulo);
            GUILayout.Label(T("Você tem a versão " + Bootstrap.Versao + ". A atualização traz o mod e o editor. Posso baixar e instalar?",
                "You have version " + Bootstrap.Versao + ". The update brings the mod and the editor. May I download and install it?"), _pequeno);
            if (!string.IsNullOrEmpty(_notas))
            {
                GUILayout.Label(T("<b>O que mudou:</b>", "<b>What changed:</b>"), _pequeno);
                _rolagem = GUILayout.BeginScrollView(_rolagem, GUILayout.Height(150f));
                GUILayout.Label(_notas, _pequeno);
                GUILayout.EndScrollView();
            }
            GUILayout.FlexibleSpace();
            if (!string.IsNullOrEmpty(_situacao)) GUILayout.Label(_situacao, _pequeno);
            GUILayout.BeginHorizontal();
            if (_agendado) { GUILayout.FlexibleSpace(); if (GUILayout.Button(T("Fechar", "Close"), GUILayout.Height(34f), GUILayout.Width(110f))) _aberto = false; }
            else if (_pronto)
            {
                if (GUILayout.Button(T("Fechar e reabrir o jogo agora", "Close and reopen the game now"), GUILayout.Height(34f))) Instalar(true);
                if (GUILayout.Button(T("Instalar quando eu fechar o jogo", "Install when I close the game"), GUILayout.Height(34f))) Instalar(false);
            }
            else
            {
                GUI.enabled = !_baixando;
                if (GUILayout.Button(_baixando ? T("Baixando…", "Downloading…") : T("Baixar e instalar", "Download and install"), GUILayout.Height(34f), GUILayout.Width(190f))) Nucleo.Instancia?.StartCoroutine(Baixar());
                if (GUILayout.Button(T("Depois", "Later"), GUILayout.Height(34f), GUILayout.Width(110f))) { _aberto = false; Log.Info("atualização: depois"); }
                if (GUILayout.Button(T("Pular esta versão", "Skip this version"), GUILayout.Height(34f), GUILayout.Width(160f)))
                {
                    try { Directory.CreateDirectory(Pasta); File.WriteAllText(ArquivoPulada, _versaoNova); } catch { }
                    _aberto = false; Log.Info("atualização: versão " + _versaoNova + " pulada");
                }
                GUI.enabled = true;
            }
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        static IEnumerator Baixar()
        {
            _baixando = true; _situacao = T("Baixando a versão " + _versaoNova + "…", "Downloading version " + _versaoNova + "…");
            Log.Info("atualização: baixando " + _url);
            using (var req = UnityWebRequest.Get(_url))
            {
                req.SetRequestHeader("User-Agent", "Bigorna/" + Bootstrap.Versao);
                req.timeout = 300;
                yield return req.SendWebRequest();
                if (req.result != UnityWebRequest.Result.Success) { _baixando = false; _situacao = T("Não consegui baixar: ", "Could not download: ") + req.error; Log.Info("atualização: falhou o download (" + req.error + ")"); yield break; }
                try
                {
                    var dll = DoZip(req.downloadHandler.data, "Bigorna.dll");
                    if (dll == null || dll.Length < 100000 || dll[0] != (byte)'M' || dll[1] != (byte)'Z') throw new Exception(T("o pacote não traz a DLL do Bigorna", "the package has no Bigorna DLL"));
                    Directory.CreateDirectory(Pasta);
                    File.WriteAllBytes(Path.Combine(Pasta, "Bigorna.dll.novo"), dll);
                    _pronto = true; _situacao = T("Pronto. A DLL em uso só pode ser trocada com o jogo fechado: escolham quando.", "Ready. The DLL in use can only be replaced with the game closed: choose when.");
                    Log.Info("atualização: versão " + _versaoNova + " baixada (" + dll.Length + " bytes)");
                }
                catch (Exception ex) { _situacao = T("Não consegui preparar a atualização: ", "Could not prepare the update: ") + ex.Message; Log.Info("atualização: " + ex.Message); }
            }
            _baixando = false;
        }

        /// <summary>Um arquivo de dentro de um .zip (o ultimo componente do caminho igual ao nome pedido), pelo diretorio central;
        /// guardado ou comprimido (deflate).</summary>
        static byte[] DoZip(byte[] z, string nome)
        {
            int fim = -1;
            for (int i = z.Length - 22; i >= Math.Max(0, z.Length - 65557); i--) if (BitConverter.ToUInt32(z, i) == 0x06054b50) { fim = i; break; }
            if (fim < 0) throw new Exception("zip sem diretório central");
            int n = BitConverter.ToUInt16(z, fim + 10); int p = (int)BitConverter.ToUInt32(z, fim + 16);
            for (int k = 0; k < n; k++)
            {
                if (BitConverter.ToUInt32(z, p) != 0x02014b50) break;
                int metodo = BitConverter.ToUInt16(z, p + 10); int comp = (int)BitConverter.ToUInt32(z, p + 20); int tam = (int)BitConverter.ToUInt32(z, p + 24);
                int ln = BitConverter.ToUInt16(z, p + 28), le = BitConverter.ToUInt16(z, p + 30), lc = BitConverter.ToUInt16(z, p + 32); int local = (int)BitConverter.ToUInt32(z, p + 42);
                var arq = Encoding.UTF8.GetString(z, p + 46, ln).Replace('\\', '/');
                p += 46 + ln + le + lc;
                if (!string.Equals(arq.Substring(arq.LastIndexOf('/') + 1), nome, StringComparison.OrdinalIgnoreCase)) continue;
                if (arq.Contains("/source/")) continue;
                int dados = local + 30 + BitConverter.ToUInt16(z, local + 26) + BitConverter.ToUInt16(z, local + 28);
                if (metodo == 0) { var r = new byte[tam]; Buffer.BlockCopy(z, dados, r, 0, tam); return r; }
                if (metodo != 8) throw new Exception("compressão " + metodo + " desconhecida");
                using (var ms = new MemoryStream(z, dados, comp)) using (var d = new DeflateStream(ms, CompressionMode.Decompress)) using (var o = new MemoryStream(tam)) { d.CopyTo(o); return o.ToArray(); }
            }
            return null;
        }

        /// <summary>O script que troca a DLL quando o jogo fecha (e, se pedido, fecha o jogo agora e o reabre depois).</summary>
        static void Instalar(bool reabrir)
        {
            try
            {
                var atual = typeof(Bootstrap).Assembly.Location; var novo = Path.Combine(Pasta, "Bigorna.dll.novo");
                var exe = Process.GetCurrentProcess().MainModule.FileName; var nomeExe = Path.GetFileName(exe);
                var bat = Path.Combine(Pasta, "atualizar.bat");
                var sb = new StringBuilder();
                sb.AppendLine("@echo off");
                sb.AppendLine("title Bigorna " + _versaoNova);
                sb.AppendLine(":espera");
                sb.AppendLine("tasklist /FI \"IMAGENAME eq " + nomeExe + "\" 2>NUL | find /I \"" + nomeExe + "\" >NUL");
                sb.AppendLine("if not errorlevel 1 ( timeout /t 1 /nobreak >NUL & goto espera )");
                sb.AppendLine("copy /Y \"" + novo + "\" \"" + atual + "\" >NUL 2>NUL");
                sb.AppendLine("if errorlevel 1 powershell -NoProfile -Command \"Start-Process cmd -Verb RunAs -Wait -ArgumentList '/c copy /Y \\\"" + novo + "\\\" \\\"" + atual + "\\\"'\"");
                sb.AppendLine("echo " + _versaoNova + "> \"" + MarcaFeita + "\"");
                sb.AppendLine("del \"" + novo + "\" >NUL 2>NUL");
                if (reabrir) sb.AppendLine("start \"\" \"" + exe + "\"");
                File.WriteAllText(bat, sb.ToString(), Encoding.Default);
                Process.Start(new ProcessStartInfo("cmd.exe", "/c \"" + bat + "\"") { CreateNoWindow = true, UseShellExecute = false, WindowStyle = ProcessWindowStyle.Hidden });
                Log.Info("atualização: instalação marcada para quando o jogo fechar" + (reabrir ? " (fechando e reabrindo agora)" : ""));
                if (reabrir) { _aberto = false; Application.Quit(); }
                else { _agendado = true; _situacao = T("A versão " + _versaoNova + " será instalada quando vocês fecharem o jogo.", "Version " + _versaoNova + " will be installed when you close the game."); }
            }
            catch (Exception ex) { _situacao = T("Não consegui instalar: ", "Could not install: ") + ex.Message; Log.Erro("atualização", ex); }
        }
    }
}
