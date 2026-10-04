using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.Networking;
using static Bigorna.Idioma;

namespace Bigorna.Menu
{
    /// <summary>
    /// "Relatar um problema" (F9, ou o botao no painel da tela de titulo): quem joga escreve o que aconteceu e o mod monta um
    /// pacote .zip com a explicacao, o mapa (.dmap) e a campanha (.dcamp) em jogo e os registros (bigorna.log, Player.log),
    /// com o nome de usuario do Windows trocado por %USERPROFILE%. O pacote fica sempre na pasta Relatos; com "Enviar", ele vai
    /// para o endereco do autor (um Google Apps Script que o manda por e-mail para ele, com o pacote anexado).
    /// Nada sai do computador sem o clique em "Enviar".
    /// </summary>
    public static class Relatos
    {
        /// <summary>O endereco do app da web (Google Apps Script) que recebe os relatos. Vazio: o pacote so e salvo.</summary>
        const string Endereco = "https://script.google.com/macros/s/AKfycby6N5KRsKBRRasQl2okyDMFkdgRRvRUG76AB1WKJF-CaNiHI3BDjAsmh07BTOIuxwA/exec";
        /// <summary>Uma senha simples, igual a do script, para ele descartar o que nao veio do mod.</summary>
        const string Chave = "bigorna-relato-1";
        const int LimiteDoPacote = 6 * 1024 * 1024;

        public static bool Aberto;
        static string _texto = "", _contato = "", _situacao = "";
        static bool _enviando;
        static string _ultimoPacote;
        static Vector2 _rolagem;
        static GUIStyle _titulo, _pequeno, _area;

        /// <summary>O ultimo mapa e a ultima campanha abertos (um relato pode vir depois de o mapa fechar).</summary>
        public static string UltimoMapa, UltimaCampanha;

        public static string Pasta => Path.Combine(Application.persistentDataPath, "Relatos");
        public static Rect Janela => new Rect(Mathf.Max(10f, (Screen.width - 620f) / 2f), Mathf.Max(10f, (Screen.height - 520f) / 2f), 620f, 520f);
        static bool PodeEnviar => !string.IsNullOrEmpty(Endereco);

        /// <summary>Um codigo anonimo desta instalacao (sorteado na primeira vez, sem nenhum dado da pessoa): o receptor limita
        /// os relatos por pessoa por dia e o autor ve quando varios vieram do mesmo jogador.</summary>
        static string Pessoa()
        {
            var arq = Path.Combine(Pasta, "codigo.txt");
            try
            {
                if (File.Exists(arq)) { var c = File.ReadAllText(arq).Trim(); if (c.Length >= 8) return c; }
                Directory.CreateDirectory(Pasta);
                var novo = Guid.NewGuid().ToString("N").Substring(0, 12);
                File.WriteAllText(arq, novo);
                return novo;
            }
            catch { return "sem-codigo"; }
        }

        public static void Alternar() { Aberto = !Aberto; if (Aberto) { _situacao = ""; Lembrar(); } }

        static void Lembrar()
        {
            try { var m = Encontro.Lancador.Atual?.Caminho; if (!string.IsNullOrEmpty(m)) UltimoMapa = m; } catch { }
            try { var c = Campanha.Campanha.Aberta?.Caminho; if (!string.IsNullOrEmpty(c)) UltimaCampanha = c; } catch { }
        }

        // ------------------------------------------------------------------ janela

        public static void Desenhar()
        {
            if (!Aberto) return;
            if (_titulo == null)
            {
                _titulo = new GUIStyle(GUI.skin.label) { fontSize = 16, fontStyle = FontStyle.Bold, richText = true };
                _pequeno = new GUIStyle(GUI.skin.label) { fontSize = 12, wordWrap = true, richText = true };
                _area = new GUIStyle(GUI.skin.textArea) { fontSize = 13, wordWrap = true };
            }
            var r = Janela;
            GUI.Box(r, ""); GUI.Box(r, "");
            GUILayout.BeginArea(new Rect(r.x + 12f, r.y + 10f, r.width - 24f, r.height - 20f));
            GUILayout.Label(T("Relatar um problema", "Report a problem"), _titulo);
            GUILayout.Label(T("Contem o que aconteceu: o que fizeram, o que esperavam e o que o jogo fez. Quanto mais detalhes (sala, objeto, rodada), melhor.",
                "Tell what happened: what you did, what you expected and what the game did. The more details (room, object, round), the better."), _pequeno);
            _rolagem = GUILayout.BeginScrollView(_rolagem, GUILayout.Height(170f));
            _texto = GUILayout.TextArea(_texto ?? "", _area, GUILayout.ExpandHeight(true));
            GUILayout.EndScrollView();
            GUILayout.Label(T("Contato (opcional: e-mail ou Discord, para o autor poder perguntar mais):", "Contact (optional: e-mail or Discord, so the author can ask for more):"), _pequeno);
            _contato = GUILayout.TextField(_contato ?? "", 120);
            GUILayout.Space(6f);
            GUILayout.Label(T("<b>Vai junto:</b> ", "<b>Included:</b> ") + string.Join(", ", Itens().Select(i => i.Nome).ToArray())
                + T(". O nome do seu usuário do Windows sai dos registros. ", ". Your Windows user name is removed from the logs. ")
                + (PodeEnviar ? T("Com «Enviar», o pacote vai por e-mail para o autor do Bigorna.", "With \"Send\", the package goes by e-mail to the author of Bigorna.")
                              : T("O pacote fica salvo na pasta Relatos, para vocês mandarem ao autor.", "The package is saved in the Relatos folder, for you to send to the author.")), _pequeno);
            GUILayout.FlexibleSpace();
            if (!string.IsNullOrEmpty(_situacao)) GUILayout.Label(_situacao, _pequeno);
            GUILayout.BeginHorizontal();
            GUI.enabled = !_enviando && (_texto ?? "").Trim().Length >= 5;
            if (PodeEnviar && GUILayout.Button(_enviando ? T("Enviando…", "Sending…") : T("Enviar", "Send"), GUILayout.Height(32f), GUILayout.Width(130f))) Nucleo.Instancia?.StartCoroutine(Enviar());
            if (GUILayout.Button(T("Só salvar o pacote", "Just save the package"), GUILayout.Height(32f), GUILayout.Width(170f))) Salvar();
            GUI.enabled = true;
            if (GUILayout.Button(T("Abrir a pasta", "Open folder"), GUILayout.Height(32f), GUILayout.Width(120f))) AbrirPasta();
            GUILayout.FlexibleSpace();
            if (GUILayout.Button(T("Fechar", "Close"), GUILayout.Height(32f), GUILayout.Width(90f))) Aberto = false;
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        static void AbrirPasta()
        {
            try { Directory.CreateDirectory(Pasta); Application.OpenURL("file:///" + Pasta.Replace('\\', '/')); } catch (Exception ex) { Log.Info("relatos: " + ex.Message); }
        }

        // ------------------------------------------------------------------ o pacote

        class Item { public string Nome; public string Caminho; public int Limite; public bool Texto; }

        static List<Item> Itens()
        {
            var l = new List<Item>();
            if (!string.IsNullOrEmpty(UltimoMapa) && File.Exists(UltimoMapa)) l.Add(new Item { Nome = Path.GetFileName(UltimoMapa), Caminho = UltimoMapa, Limite = 3_000_000 });
            if (!string.IsNullOrEmpty(UltimaCampanha) && File.Exists(UltimaCampanha)) l.Add(new Item { Nome = Path.GetFileName(UltimaCampanha), Caminho = UltimaCampanha, Limite = 3_000_000 });
            var dados = Application.persistentDataPath;
            l.Add(new Item { Nome = "bigorna.log", Caminho = Bootstrap.CaminhoLog, Limite = 1_500_000, Texto = true });
            l.Add(new Item { Nome = "Player.log", Caminho = Path.Combine(dados, "Player.log"), Limite = 700_000, Texto = true });
            l.Add(new Item { Nome = "Player-prev.log", Caminho = Path.Combine(dados, "Player-prev.log"), Limite = 400_000, Texto = true });
            return l.Where(i => File.Exists(i.Caminho)).ToList();
        }

        /// <summary>Os caminhos com o nome do usuario do Windows viram %USERPROFILE%; o nome solto vira &lt;usuario&gt;.</summary>
        static string Limpar(string t)
        {
            try
            {
                var perfil = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                if (!string.IsNullOrEmpty(perfil))
                    foreach (var forma in new[] { perfil, perfil.Replace('\\', '/') })
                        t = t.Replace(forma, "%USERPROFILE%");
                var nome = Environment.UserName;
                if (!string.IsNullOrEmpty(nome) && nome.Length >= 3) t = t.Replace(nome, "<usuario>");
            }
            catch { }
            return t;
        }

        /// <summary>O fim do arquivo (os registros crescem para o fim: o que importa e o mais recente).</summary>
        static byte[] Ler(Item i)
        {
            byte[] b;
            using (var fs = new FileStream(i.Caminho, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                long n = fs.Length, de = Math.Max(0, n - i.Limite);
                fs.Seek(de, SeekOrigin.Begin);
                b = new byte[n - de]; int lidos = 0;
                while (lidos < b.Length) { int k = fs.Read(b, lidos, b.Length - lidos); if (k <= 0) break; lidos += k; }
            }
            if (!i.Texto) return b;
            var t = Encoding.UTF8.GetString(b);
            return Encoding.UTF8.GetBytes(Limpar(t));
        }

        static string Resumo()
        {
            var sb = new StringBuilder();
            sb.AppendLine("Relato de problema do Bigorna");
            sb.AppendLine("Data: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            sb.AppendLine("Bigorna: " + Bootstrap.Versao + " · jogo: " + Application.version + " · Unity " + Application.unityVersion);
            sb.AppendLine("Código anônimo: " + Pessoa());
            sb.AppendLine("Língua do jogo: " + Dados.DadosDoEditor.LinguaDoJogo() + " · Windows: " + SystemInfo.operatingSystem);
            sb.AppendLine("Cena: " + Jogo.CenaAtual() + (Encontro.Lancador.Atual != null ? " · mapa em jogo: " + Encontro.Lancador.Atual.NomeVisivel : ""));
            if (!string.IsNullOrEmpty(UltimoMapa)) sb.AppendLine("Mapa: " + Path.GetFileName(UltimoMapa));
            if (!string.IsNullOrEmpty(UltimaCampanha)) sb.AppendLine("Campanha: " + Path.GetFileName(UltimaCampanha));
            if (!string.IsNullOrEmpty((_contato ?? "").Trim())) sb.AppendLine("Contato: " + _contato.Trim());
            sb.AppendLine();
            sb.AppendLine((_texto ?? "").Trim());
            return Limpar(sb.ToString());
        }

        static byte[] Montar(out string nome)
        {
            Lembrar();
            nome = "relato-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".zip";
            var z = new Zip();
            z.Adicionar("relato.txt", Encoding.UTF8.GetBytes(Resumo()));
            foreach (var i in Itens())
            {
                try { z.Adicionar(i.Nome, Ler(i)); }
                catch (Exception ex) { z.Adicionar(i.Nome + ".erro.txt", Encoding.UTF8.GetBytes(ex.Message)); }
            }
            return z.Terminar();
        }

        static string Guardar(byte[] zip, string nome)
        {
            Directory.CreateDirectory(Pasta);
            var p = Path.Combine(Pasta, nome);
            File.WriteAllBytes(p, zip);
            return p;
        }

        static void Salvar()
        {
            try
            {
                var zip = Montar(out var nome);
                _ultimoPacote = Guardar(zip, nome);
                _situacao = T("Pacote salvo: ", "Package saved: ") + Limpar(_ultimoPacote) + " (" + zip.Length / 1024 + T(" KB). Mandem este arquivo ao autor.", " KB). Send this file to the author.");
                Log.Info("relato salvo: " + _ultimoPacote);
            }
            catch (Exception ex) { _situacao = T("Não consegui montar o pacote: ", "Could not build the package: ") + ex.Message; Log.Erro("montando o relato", ex); }
        }

        static IEnumerator Enviar()
        {
            _enviando = true;
            byte[] zip = null; string nome = null;
            try { zip = Montar(out nome); _ultimoPacote = Guardar(zip, nome); }
            catch (Exception ex) { _situacao = T("Não consegui montar o pacote: ", "Could not build the package: ") + ex.Message; Log.Erro("montando o relato", ex); _enviando = false; yield break; }
            if (zip.Length > LimiteDoPacote) { _situacao = T("O pacote ficou grande demais para enviar (", "The package is too big to send (") + zip.Length / 1024 + T(" KB). Ele está salvo na pasta Relatos: mandem ao autor.", " KB). It is saved in the Relatos folder: send it to the author."); _enviando = false; yield break; }
            _situacao = T("Enviando…", "Sending…");
            var corpo = new JObject
            {
                ["chave"] = Chave,
                ["pessoa"] = Pessoa(),
                ["versao"] = Bootstrap.Versao,
                ["jogo"] = Application.version,
                ["mapa"] = string.IsNullOrEmpty(UltimoMapa) ? "" : Path.GetFileName(UltimoMapa),
                ["campanha"] = string.IsNullOrEmpty(UltimaCampanha) ? "" : Path.GetFileName(UltimaCampanha),
                ["contato"] = (_contato ?? "").Trim(),
                ["texto"] = Limpar((_texto ?? "").Trim()),
                ["nome"] = nome,
                ["arquivo"] = Convert.ToBase64String(zip),
            }.ToString(Newtonsoft.Json.Formatting.None);
            using (var req = new UnityWebRequest(Endereco, "POST"))
            {
                req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(corpo));
                req.downloadHandler = new DownloadHandlerBuffer();
                req.SetRequestHeader("Content-Type", "text/plain;charset=utf-8");
                req.timeout = 60;
                yield return req.SendWebRequest();
                string resposta = null; try { resposta = req.downloadHandler?.text; } catch { }
                bool ok = false; string id = null;
                string recusa = null;
                try { var j = JObject.Parse(resposta ?? ""); ok = j.Value<bool?>("ok") == true; id = j.Value<string>("id"); if (!ok) { recusa = j.Value<string>("erro"); Log.Info("relato recusado: " + resposta); } } catch { }
                if (ok)
                {
                    _situacao = T("Enviado. Obrigado! (relato ", "Sent. Thank you! (report ") + id + ")";
                    _texto = ""; _contato = "";
                    Log.Info("relato enviado: " + id);
                }
                else if (recusa == "limite da pessoa" || recusa == "limite do dia")
                {
                    _situacao = (recusa == "limite da pessoa" ? T("Vocês já mandaram 5 relatos hoje, o limite por dia.", "You have already sent 5 reports today, the daily limit.")
                                                             : T("O limite de relatos de hoje foi atingido.", "Today's report limit has been reached."))
                        + T(" O pacote está salvo na pasta Relatos: mandem amanhã ou por outro meio.", " The package is saved in the Relatos folder: send it tomorrow or another way.");
                    Log.Info("relato: " + recusa);
                }
                else
                {
                    _situacao = T("O envio não confirmou (", "The upload was not confirmed (") + (recusa ?? req.error ?? (T("resposta ", "response ") + req.responseCode))
                        + T("). O pacote está salvo na pasta Relatos: mandem ao autor.", "). The package is saved in the Relatos folder: send it to the author.");
                    Log.Info("relato: envio sem confirmação (" + req.responseCode + " " + req.error + ")");
                }
            }
            _enviando = false;
        }

        // ------------------------------------------------------------------ um .zip simples (deflate), sem bibliotecas extras

        class Zip
        {
            readonly MemoryStream _saida = new MemoryStream();
            readonly List<(string nome, uint crc, int comp, int tam, int ofs)> _entradas = new List<(string, uint, int, int, int)>();

            public void Adicionar(string nome, byte[] dados)
            {
                byte[] comp;
                using (var ms = new MemoryStream())
                {
                    using (var d = new DeflateStream(ms, CompressionMode.Compress, true)) d.Write(dados, 0, dados.Length);
                    comp = ms.ToArray();
                }
                uint crc = Crc32(dados); int ofs = (int)_saida.Position; var n = Encoding.UTF8.GetBytes(nome);
                var w = new BinaryWriter(_saida, Encoding.UTF8, true);
                w.Write(0x04034b50u); w.Write((ushort)20); w.Write((ushort)0x0800); w.Write((ushort)8); w.Write((ushort)0); w.Write((ushort)0x21);
                w.Write(crc); w.Write(comp.Length); w.Write(dados.Length); w.Write((ushort)n.Length); w.Write((ushort)0); w.Write(n); w.Write(comp);
                w.Flush();
                _entradas.Add((nome, crc, comp.Length, dados.Length, ofs));
            }

            public byte[] Terminar()
            {
                var w = new BinaryWriter(_saida, Encoding.UTF8, true);
                int inicio = (int)_saida.Position;
                foreach (var e in _entradas)
                {
                    var n = Encoding.UTF8.GetBytes(e.nome);
                    w.Write(0x02014b50u); w.Write((ushort)20); w.Write((ushort)20); w.Write((ushort)0x0800); w.Write((ushort)8); w.Write((ushort)0); w.Write((ushort)0x21);
                    w.Write(e.crc); w.Write(e.comp); w.Write(e.tam); w.Write((ushort)n.Length); w.Write((ushort)0); w.Write((ushort)0); w.Write((ushort)0); w.Write((ushort)0); w.Write(0u); w.Write(e.ofs); w.Write(n);
                }
                int tamCentral = (int)_saida.Position - inicio;
                w.Write(0x06054b50u); w.Write((ushort)0); w.Write((ushort)0); w.Write((ushort)_entradas.Count); w.Write((ushort)_entradas.Count); w.Write(tamCentral); w.Write(inicio); w.Write((ushort)0);
                w.Flush();
                return _saida.ToArray();
            }

            static uint[] _tabela;
            static uint Crc32(byte[] b)
            {
                if (_tabela == null) { _tabela = new uint[256]; for (uint i = 0; i < 256; i++) { uint c = i; for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1; _tabela[i] = c; } }
                uint crc = 0xFFFFFFFFu; foreach (var x in b) crc = _tabela[(crc ^ x) & 0xFF] ^ (crc >> 8); return crc ^ 0xFFFFFFFFu;
            }
        }
    }
}
