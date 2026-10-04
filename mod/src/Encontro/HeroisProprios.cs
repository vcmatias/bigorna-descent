using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FFG.D3;
using FFG.D3.UI;
using I2.Loc;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Herois e armas da Oficina, enquanto o mapa (ou a campanha) esta em jogo. Heroi: nome, retrato (e o recorte dele)
    /// e figura animada de um dos seis. Arma: nomes, dano, tipos de dano, imagens, textos e chances das pecas de uma arma
    /// do jogo, ou uma arma nova no lugar dela. Tudo o que muda nos modelos do jogo e guardado e desfeito ao voltar ao
    /// menu; a arma nova entra na mao de quem tem a do jogo ao entrar no encontro e sai ao terminar.
    /// </summary>
    public static class HeroisProprios
    {
        static readonly Desfazer _desfazer = new Desfazer();
        static readonly HashSet<string> _comArte = new HashSet<string>(StringComparer.Ordinal);
        /// <summary>Herois com retrato proprio: id → caminho virtual da imagem.</summary>
        static readonly Dictionary<string, string> _retratos = new Dictionary<string, string>(StringComparer.Ordinal);
        static readonly HashSet<int> _avisados = new HashSet<int>();
        static float _proximaOlhadaRetratos;
        static FFG.D3.UI.HeroPortrait[] _quadros = new FFG.D3.UI.HeroPortrait[0];

        /// <summary>A cada meio segundo: os quadros de heroi do jogo (escolha do grupo no mapa-mundi, miniaturas) que mostram um
        /// heroi com retrato proprio e nao estao com a nossa imagem recebem ela. Algumas telas guardam o quadro montado
        /// antes (ou montam quando o carregador ainda nao tinha a imagem) e ficavam brancas.</summary>
        public static void RetratosNaTela()
        {
            if (_retratos.Count == 0) return;
            // a lista de quadros e refeita a cada meio segundo; a conferencia, a cada quadro (sem piscar branco)
            if (Time.unscaledTime >= _proximaOlhadaRetratos) { _proximaOlhadaRetratos = Time.unscaledTime + 0.5f; try { _quadros = UnityEngine.Object.FindObjectsOfType<FFG.D3.UI.HeroPortrait>(true); } catch { _quadros = new FFG.D3.UI.HeroPortrait[0]; } }
            try
            {
                foreach (var hp in _quadros)
                {
                    if (hp == null || hp.ImageHero == null) continue;
                    var id = hp.Model?.Id; if (id == null || !_retratos.TryGetValue(id, out var caminho)) continue;
                    var sp = PacoteVirtual.SpriteDe(caminho);
                    if (sp == null) { if (_avisados.Add(-hp.GetInstanceID())) Log.Info("retrato de " + id + ": a imagem «" + caminho + "» não está disponível"); continue; }
                    if (hp.ImageHero.sprite == sp) { if (_avisados.Add(hp.GetInstanceID())) Log.Info("retrato de " + id + " no quadro «" + hp.name + "»: já com a nossa imagem (" + (sp.texture != null ? sp.texture.width + "x" + sp.texture.height : "sem textura") + ", cor " + hp.ImageHero.color + ", material " + (hp.ImageHero.material != null ? hp.ImageHero.material.name : "-") + ")"); continue; }
                    if (_avisados.Add(hp.GetInstanceID())) Log.Info("retrato de " + id + " no quadro «" + hp.name + "»: estava " + (hp.ImageHero.sprite == null ? "vazio" : "«" + hp.ImageHero.sprite.name + "»") + "; trocado");
                    hp.ImageHero.sprite = sp;
                }
            }
            catch (Exception ex) { Log.Info("retratos na tela: " + ex.Message); _proximaOlhadaRetratos = Time.unscaledTime + 5f; }
        }
        /// <summary>arma do jogo trocada → arma nova</summary>
        static readonly Dictionary<string, WeaponModel> _trocas = new Dictionary<string, WeaponModel>(StringComparer.Ordinal);
        /// <summary>armas nas maos dos herois trocadas neste encontro, para devolver ao sair</summary>
        static readonly List<(List<SerializedWeapon> lista, int i, SerializedWeapon original)> _nasMaos = new List<(List<SerializedWeapon>, int, SerializedWeapon)>();

        /// <summary>heroi → as duas armas que ele segura (quando a Oficina muda)</summary>
        static readonly Dictionary<string, WeaponModel[]> _maos = new Dictionary<string, WeaponModel[]>(StringComparer.Ordinal);
        /// <summary>nome de cada heroi no jogo (o nome do modelo escolhe a voz: Voice_Hero_Attack_Brynn...)</summary>
        static readonly Dictionary<string, string> _nomesOriginais = new Dictionary<string, string>(StringComparer.Ordinal);


        public static void Registrar(List<JObject> herois, List<JObject> armas, List<JObject> maos, string origem)
        {
            // um mapa de campanha sem heroes, weapons nem heroWeapons mantem os da campanha; com eles, os dele valem a partir do zero
            int nh = herois?.Count ?? 0, na = armas?.Count ?? 0, nm = maos?.Count ?? 0;
            if (nh + na + nm == 0) return;
            Restaurar();
            _nomesOriginais.Clear();
            try { foreach (var h in UserCollectionManager.GetHeroes(false) ?? new List<HeroModel>()) if (h != null) _nomesOriginais[h.Id] = h.name; } catch { }
            try { Maos(maos); } catch (Exception ex) { Log.Erro("armas dos heróis", ex); }
            int n = 0, m = 0;
            if (herois != null) foreach (var j in herois) { try { if (Registrar(j)) n++; } catch (Exception ex) { Log.Erro("herói próprio «" + (string)j["id"] + "»", ex); } }
            if (armas != null) foreach (var j in armas)
                {
                    try { var partes = new List<string>(); Arma(j, partes); if (partes.Count > 0) { m++; Log.Info("arma própria " + (string)j["id"] + ": " + string.Join(", ", partes.ToArray())); } }
                    catch (Exception ex) { Log.Erro("arma própria «" + (string)j["id"] + "»", ex); }
                }
            Log.Info("Oficina de " + origem + ": " + n + " herói(s) e " + m + " arma(s) alterados");
        }

        static void Guardar<T>(T alvo, string campo) where T : class
        {
            var f = Reflexao.Campo(alvo.GetType(), campo); if (f == null) return;
            var antes = f.GetValue(alvo);
            _desfazer.Add(() => { try { f.SetValue(alvo, antes); } catch { } });
        }

        static bool Registrar(JObject j)
        {
            var id = (string)j["id"]; if (string.IsNullOrEmpty(id)) return false;
            HeroModel h = null; try { h = UserCollectionManager.GetHero(id, false); } catch { }
            if (h == null) { Log.Info("herói «" + id + "» não existe no jogo"); return false; }
            var partes = new List<string>();
            var nome = (string)j["name"];
            if (!string.IsNullOrWhiteSpace(nome)) { Guardar(h, "KeyName"); h.KeyName = Jogo.Termo("BIGORNA_" + id + "_NAME", nome); partes.Add("nome «" + nome + "»"); }
            var retrato = Oficina.LerImagem((string)j["portrait"], "@Bigorna-Heroi-" + id);
            if (retrato != null)
            {
                var cRetrato = PacoteVirtual.Registrar("D3/Bigorna/Heroes/" + id + ".png", retrato);
                var cRecorte = PacoteVirtual.Registrar("D3/Bigorna/Heroes/" + id + "_Crop.png", Recorte(retrato, id));
                foreach (var f in new[] { "TextureAssetPathActI", "TextureAssetPathActII" }) { Guardar(h, f); Reflexao.Por(h, f, cRetrato); }
                _retratos[id] = cRetrato;
                foreach (var f in new[] { "TextureCropAssetPathActI", "TextureCropAssetPathActII" }) { Guardar(h, f); Reflexao.Por(h, f, cRecorte); }
                partes.Add("retrato");
            }
            var voz = (string)j["voice"];
            if (!string.IsNullOrEmpty(voz) && voz != id && _nomesOriginais.TryGetValue(voz, out var nomeVoz))
            {
                var antes = h.name; var alvo = h;
                _desfazer.Add(() => { try { alvo.name = antes; } catch { } });
                h.name = nomeVoz; partes.Add("voz de " + nomeVoz);
            }
            var arte = (string)j["art"];
            if (!string.IsNullOrEmpty(arte))
            {
                Personalizados.RegistrarArteDeHeroi(id, arte, (float?)j["artScale"] ?? 1f, (float?)j["artRaise"] ?? 0f, (float?)j["artShift"] ?? 0f);
                _comArte.Add(id); partes.Add("figura animada");
            }
            // arquivos antigos: as armas vinham dentro do heroi
            foreach (var w in (j["weapons"] as JArray) ?? new JArray()) { try { Arma((JObject)w, partes); } catch (Exception ex) { Log.Erro("arma de «" + id + "»", ex); } }
            Log.Info("herói próprio " + id + ": " + (partes.Count > 0 ? string.Join(", ", partes.ToArray()) : "sem mudanças"));
            return partes.Count > 0;
        }

        /// <summary>O recorte horizontal (256x85, como o do jogo) tirado da faixa do rosto do retrato.</summary>
        static Texture2D Recorte(Texture2D r, string id)
        {
            try
            {
                int w = r.width, hh = Mathf.Max(1, Mathf.RoundToInt(w * 85f / 256f));
                int y0 = Mathf.Clamp(Mathf.RoundToInt(r.height * 0.52f), 0, Mathf.Max(0, r.height - hh)); // faixa de cima (y do Unity cresce para cima)
                var px = r.GetPixels(0, y0, w, Mathf.Min(hh, r.height - y0));
                var t = new Texture2D(w, Mathf.Min(hh, r.height - y0), TextureFormat.RGBA32, false) { hideFlags = HideFlags.DontUnloadUnusedAsset, name = "@Bigorna-Recorte-" + id, wrapMode = TextureWrapMode.Clamp };
                t.SetPixels(px); t.Apply();
                return t;
            }
            catch (Exception ex) { Log.Info("recorte do retrato de «" + id + "»: " + ex.Message); return r; }
        }

        /// <summary>A imagem da peca (a que aparece montada na arma e o icone nas listas) vira um recurso do pacote virtual.</summary>
        static void ImagemDaPeca(WeaponPartsModel p, string pid, string dataUri, JToken forma = null)
        {
            var tex = Oficina.LerImagem(dataUri, "@Bigorna-Peca-" + pid);
            if (tex == null) { Log.Info("  imagem da peça «" + pid + "» ilegível"); return; }
            if (forma is JObject f) _formas[tex.name] = new Vector4((float?)f["x"] ?? 0f, (float?)f["y"] ?? 0f, Mathf.Max(0.05f, (float?)f["w"] ?? 1f), Mathf.Max(0.05f, (float?)f["h"] ?? 1f));
            else _formas.Remove(tex.name);
            var caminho = PacoteVirtual.Registrar("D3/Bigorna/Weapon Parts/" + pid + ".png", tex);
            p.ArmoryAssetPath = caminho; p.TextureAssetPath = caminho; p.IsPromo = false; p.NoTexture = false;
        }

        static DamageTraits[] Tracos(JToken lista)
        {
            var r = new List<DamageTraits>();
            foreach (var t in (lista as JArray) ?? new JArray()) { int k = Array.IndexOf(Oficina.Danos, (string)t); if (k >= 0) r.Add((DamageTraits)k); }
            return r.ToArray();
        }

        /// <summary>Runas da Oficina que o grupo recebe ao se formar (a peca A de cada uma).</summary>
        static readonly List<WeaponPartsModel> _runasIniciais = new List<WeaponPartsModel>();

        /// <summary>Uma runa nova: arma de classe Runa feita a partir de uma runa do jogo (moldura, figura, sons), com tres pecas
        /// proprias. O grupo a ganha com a runa (peca A); com ela, qualquer heroi pode leva-la (escolha de herois, arsenal).</summary>
        static void RunaPropria(JObject w, List<string> partes)
        {
            var id = (string)w["id"]; var bid = (string)w["base"];
            WeaponModel baseRuna = null; try { baseRuna = UserCollectionManager.GetWeapon(bid, false); } catch { }
            if (baseRuna == null || baseRuna.Class != WeaponClasses.Rune) { Log.Info("  runa «" + id + "»: base «" + bid + "» não é uma runa do jogo"); return; }
            var nova = w["replace"] as JObject ?? new JObject();
            var m = ArmaNova(baseRuna, nova, "BIGORNA_RUNE_" + id, true);
            if (m == null) return;
            partes.Add("runa nova «" + ((string)nova["name"] ?? id) + "» (de " + bid + ")");
            if ((bool?)w["start"] == true && m.StartingWeaponParts != null && m.StartingWeaponParts.Length > 0 && m.StartingWeaponParts[0] != null) _runasIniciais.Add(m.StartingWeaponParts[0]);
        }

        /// <summary>Ao formar o grupo: as runas da Oficina marcadas "o grupo tem" entram no inventario (e a arma fica disponivel).</summary>
        public static void DarRunas()
        {
            if (_runasIniciais.Count == 0) return;
            try
            {
                var d = Jogo.DadosJogo?.Data; if (d == null || d.ItemInventory == null) return;
                foreach (var p in _runasIniciais)
                {
                    if (!d.ItemInventory.Any(x => x != null && x.Id == p.Id)) { d.ItemInventory.Add(new SerializedItem(p)); Log.Info("  o grupo recebe a runa «" + p.Id + "»"); }
                    d.UpdateUniqueWeapons(p);
                }
            }
            catch (Exception ex) { Log.Erro("dando as runas da Oficina", ex); }
        }

        static void Arma(JObject w, List<string> partes)
        {
            if ((bool?)w["rune"] == true && w["base"] != null) { RunaPropria(w, partes); return; }
            var wid = (string)w["id"];
            WeaponModel arma = null; try { arma = UserCollectionManager.GetWeapon(wid, false); } catch { }
            if (arma == null) { Log.Info("  arma «" + wid + "» não existe"); return; }
            var nome = (string)w["name"];
            if (!string.IsNullOrWhiteSpace(nome)) { Guardar(arma, "KeyName"); arma.KeyName = Jogo.Termo("BIGORNA_" + wid + "_NAME", nome); partes.Add("arma «" + nome + "»"); }
            int mudadas = 0;
            foreach (JObject pj in (w["parts"] as JArray) ?? new JArray())
            {
                var pid = (string)pj["id"];
                WeaponPartsModel p = null; try { p = UserCollectionManager.GetWeaponPart(pid, false); } catch { }
                if (p == null) continue;
                var pn = (string)pj["name"]; if (!string.IsNullOrWhiteSpace(pn)) { Guardar(p, "KeyName"); p.KeyName = Jogo.Termo("BIGORNA_" + pid + "_NAME", pn); }
                if (pj["damage"] != null) { Guardar(p, "Damage"); p.Damage = Mathf.Clamp((int)pj["damage"], 0, 20); }
                if (pj["traits"] != null) { Guardar(p, "Traits"); p.Traits = Tracos(pj["traits"]); }
                if (pj["image"] != null) { foreach (var f in new[] { "ArmoryAssetPath", "TextureAssetPath", "IsPromo", "NoTexture" }) Guardar(p, f); ImagemDaPeca(p, pid, (string)pj["image"], pj["layout"]); }
                var ab = p.Ability;
                if (ab != null)
                {
                    var tx = (string)pj["text"]; if (!string.IsNullOrWhiteSpace(tx)) { Guardar(ab, "KeyDesc"); ab.KeyDesc = Jogo.Termo("BIGORNA_" + ab.Id + "_DESC", tx); }
                    if (pj["chance"] != null) { Guardar(ab, "Chance"); ab.Chance = Mathf.Clamp01((float)pj["chance"] / 100f); }
                }
                mudadas++;
            }
            if (mudadas > 0) partes.Add(mudadas + " peça(s) de " + wid);
            if (w["replace"] is JObject nova) { var m = ArmaNova(arma, nova); if (m != null) { _trocas[arma.Id] = m; partes.Add("arma nova «" + (string)nova["name"] + "» no lugar de " + wid); } }
        }

        /// <summary>Uma arma nova a partir da que ela substitui (mesma classe, desenho e sons), com tres pecas proprias.</summary>
        static WeaponModel ArmaNova(WeaponModel velha, JObject j, string nid = null, bool todas = false)
        {
            nid = nid ?? "BIGORNA_" + velha.Id;
            var m = UnityEngine.Object.Instantiate(velha); m.name = nid;
            Reflexao.Por(m, "_id", nid);
            m.KeyName = Jogo.Termo(nid + "_NAME", (string)j["name"] ?? Idioma.T("Arma", "Weapon"));
            int r = Array.IndexOf(Oficina.Alcances, (string)j["range"]); if (r >= 0) m.RangeApproximation = (TargetRanges)r;
            var pecas = new WeaponPartsModel[3];
            var dadas = ((j["parts"] as JArray) ?? new JArray()).OfType<JObject>().ToList();
            for (int s = 0; s < 3; s++)
            {
                var molde = velha.StartingWeaponParts != null && velha.StartingWeaponParts.Length > s ? velha.StartingWeaponParts[s] : null;
                var slot = "ABC"[s].ToString();
                var pj = dadas.FirstOrDefault(x => string.Equals((string)x["slot"], slot, StringComparison.OrdinalIgnoreCase));
                if (molde == null) continue;
                if (pj == null && !todas) { pecas[s] = molde; continue; }
                var p = UnityEngine.Object.Instantiate(molde); var pid = nid + "_" + slot; p.name = pid;
                Reflexao.Por(p, "_id", pid);
                if (pj == null) { NaColecao("WeaponParts", pid, p); pecas[s] = p; continue; }   // copia fiel (a runa precisa de uma peca A so dela)
                p.KeyName = Jogo.Termo(pid + "_NAME", (string)pj["name"] ?? slot);
                p.Damage = s == 0 ? Mathf.Clamp((int?)pj["damage"] ?? molde.Damage, 0, 20) : 0;
                p.Traits = s == 0 ? Tracos(pj["traits"]) : new DamageTraits[0];
                p.HasLogic = false; p.LogicAssetPath = "";
                if (pj["image"] != null) ImagemDaPeca(p, pid, (string)pj["image"], pj["layout"]);
                var aj = pj["ability"] as JObject;
                var copia = (string)aj?["copy"];
                if (!string.IsNullOrEmpty(copia))
                {
                    var outra = UserCollectionManager.GetWeaponParts(false).FirstOrDefault(x => x?.Ability != null && x.Ability.Id == copia);
                    p.Ability = outra?.Ability;
                    if (outra != null && outra.HasLogic) { p.HasLogic = true; p.LogicAssetPath = outra.LogicAssetPath; }
                }
                else if (aj != null && !string.IsNullOrWhiteSpace((string)aj["text"]))
                {
                    var a = ScriptableObject.CreateInstance<WeaponAbilityModel>(); var aid = pid + "_ABILITY"; a.name = aid;
                    Reflexao.Por(a, "_id", aid);
                    a.KeyName = Jogo.Termo(aid, (string)aj["name"] ?? (string)pj["name"] ?? "");
                    a.KeyDesc = Jogo.Termo(aid + "_DESC", (string)aj["text"]);
                    a.Chance = Mathf.Clamp01(((float?)aj["chance"] ?? 30f) / 100f);
                    a.EffectTiming = EffectTiming.None; a.ShowPostAttackMessage = true; a.IsUpgrade = false; a.isPartA = s == 0;
                    p.Ability = a;
                }
                else p.Ability = null;
                NaColecao("WeaponParts", pid, p);
                pecas[s] = p;
            }
            m.StartingWeaponParts = pecas;
            NaColecao("Weapons", nid, m);
            return m;
        }

        static void NaColecao(string tipo, string id, object modelo)
        {
            foreach (var nome in new[] { "s_all" + tipo, "s_owned" + tipo })
            {
                try
                {
                    var f = typeof(UserCollectionManager).GetField(nome, BindingFlags.Static | BindingFlags.NonPublic);
                    if (f?.GetValue(null) is System.Collections.IDictionary dic) dic[id] = modelo;
                }
                catch (Exception ex) { Log.Info("registrando «" + id + "» em " + nome + ": " + ex.Message); }
            }
        }

        /// <summary>As duas armas que cada heroi segura. Cada classe de arma tem um dono no jogo (a peca de espada e da Brynn...):
        /// a arma que passa a outro heroi toma a classe da que ela substitui, com todas as suas pecas. Assim o jogo inteiro
        /// (loja, inventario, feitos, tesouros por classe) a trata como a arma daquele heroi. A Oficina garante que cada arma
        /// tem um so dono (uma troca entre dois herois).</summary>
        static void Maos(List<JObject> maos)
        {
            if (maos == null || maos.Count == 0) return;
            var classeOriginal = new Dictionary<string, WeaponClasses>(StringComparer.Ordinal);
            foreach (var h in UserCollectionManager.GetHeroes(false) ?? new List<HeroModel>())
                foreach (var w in h?.StartingWeapons ?? new WeaponModel[0]) if (w != null) classeOriginal[w.Id] = w.Class;
            var novas = new List<(WeaponModel arma, WeaponClasses para)>();
            foreach (var j in maos)
            {
                var id = (string)j["hero"];
                HeroModel h = null; try { h = UserCollectionManager.GetHero(id, false); } catch { }
                var ids = ((j["weapons"] as JArray) ?? new JArray()).Select(x => (string)x).ToList();
                if (h == null || h.StartingWeapons == null || ids.Count != h.StartingWeapons.Length) { Log.Info("armas de «" + id + "»: herói ou lista inválidos"); continue; }
                var lista = new WeaponModel[ids.Count];
                for (int i = 0; i < ids.Count; i++) { try { lista[i] = UserCollectionManager.GetWeapon(ids[i], false); } catch { } }
                if (lista.Any(x => x == null)) { Log.Info("armas de «" + id + "»: arma desconhecida"); continue; }
                for (int i = 0; i < lista.Length; i++)
                {
                    var velha = h.StartingWeapons[i];
                    if (velha != null && lista[i].Id != velha.Id && classeOriginal.TryGetValue(velha.Id, out var c)) novas.Add((lista[i], c));
                }
                Guardar(h, "StartingWeapons"); h.StartingWeapons = lista;
                _maos[id] = lista;
                Log.Info("herói " + id + " segura " + string.Join(" e ", ids.ToArray()));
            }
            // primeiro as pecas de cada arma (pela classe de antes), depois a troca de classes
            var pecas = (UserCollectionManager.GetWeaponParts(false) ?? new List<WeaponPartsModel>()).Where(p => p != null).ToList();
            var planos = novas.Select(x => (x.arma, x.para, pecas: pecas.Where(p => p.Class == x.arma.Class).ToList())).ToList();
            foreach (var (arma, para, dela) in planos)
            {
                Guardar(arma, "Class"); arma.Class = para;
                foreach (var p in dela) { Guardar(p, "Class"); p.Class = para; }
                Log.Info("  " + arma.Id + " (e " + dela.Count + " peça(s)) passa a ser da classe " + para);
            }
        }

        /// <summary>Ao entrar no encontro (grupo formado): cada heroi segura as armas da Oficina (as que os outros tinham vem com
        /// as pecas montadas; as que ninguem tinha entram com as pecas iniciais); quem tem uma arma trocada entra com a nova.</summary>
        public static void TrocarArmas()
        {
            if (_trocas.Count == 0 && _maos.Count == 0) return;
            var herois = Jogo.Herois; if (herois == null) return;
            if (_maos.Count > 0)
            {
                var soltas = new[] { new Dictionary<string, SerializedWeapon>(), new Dictionary<string, SerializedWeapon>() };
                foreach (var h in herois)
                {
                    if (h == null) continue;
                    var listas = new[] { h.EquippedWeapons, h.DefaultWeaponsBuild };
                    for (int k = 0; k < 2; k++) foreach (var w in listas[k] ?? new List<SerializedWeapon>()) if (w?.Model != null && !soltas[k].ContainsKey(w.Model.Id)) soltas[k][w.Model.Id] = w;
                }
                foreach (var h in herois)
                {
                    if (h?.Model == null || !_maos.TryGetValue(h.Model.Id, out var desejadas)) continue;
                    var listas = new[] { h.EquippedWeapons, h.DefaultWeaponsBuild };
                    for (int k = 0; k < 2; k++)
                    {
                        var lista = listas[k]; if (lista == null) continue;
                        int j = 0;
                        for (int i = 0; i < lista.Count && j < desejadas.Length; i++)
                        {
                            if (lista[i]?.Model == null || lista[i].Model.Class == WeaponClasses.Rune) continue;
                            var alvo = desejadas[j++];
                            if (lista[i].Model.Id == alvo.Id) continue;
                            _nasMaos.Add((lista, i, lista[i]));
                            lista[i] = soltas[k].TryGetValue(alvo.Id, out var sw) ? sw : new SerializedWeapon(alvo);
                        }
                    }
                    Log.Info("  " + h.Model.Id + " segura " + string.Join(" e ", desejadas.Select(x => x.Id).ToArray()));
                }
            }
            foreach (var h in herois)
            {
                if (h?.Model == null) continue;
                int trocadas = 0;
                foreach (var lista in new[] { h.EquippedWeapons, h.DefaultWeaponsBuild })
                {
                    if (lista == null) continue;
                    for (int i = 0; i < lista.Count; i++)
                    {
                        if (lista[i]?.Model == null || !_trocas.TryGetValue(lista[i].Model.Id, out var nova)) continue;
                        _nasMaos.Add((lista, i, lista[i]));
                        lista[i] = new SerializedWeapon(nova); trocadas++;
                    }
                }
                if (trocadas > 0) Log.Info("  " + h.Model.Id + " entra com a arma nova da Oficina");
            }
            try { Jogo.UI?.HeroMenu?.SyncTo(Jogo.Partida.ActivePlayers); } catch { }
        }

        /// <summary>Ao sair do encontro: cada heroi volta a ter a arma (e as pecas) que tinha.</summary>
        public static void DesfazerArmas()
        {
            if (_nasMaos.Count == 0) return;
            for (int k = _nasMaos.Count - 1; k >= 0; k--) { var (lista, i, orig) = _nasMaos[k]; try { if (lista != null && i < lista.Count) lista[i] = orig; } catch { } }
            Log.Info("armas da Oficina devolvidas: " + _nasMaos.Count);
            _nasMaos.Clear();
        }

        // ------------------------------------------------------------ caixas forjadas
        /// <summary>Imagem de peca com caixa forjada no editor (nome da textura → deslocamento do centro em larguras/alturas da
        /// caixa do jogo, nos eixos da propria caixa, y para cima; e a mudanca de tamanho).</summary>
        static readonly Dictionary<string, Vector4> _formas = new Dictionary<string, Vector4>(StringComparer.Ordinal);
        /// <summary>Caixa original (posicao e tamanho) de cada imagem de peca que ja mexemos, para devolver.</summary>
        static readonly Dictionary<Image, (Vector2 pos, Vector2 tam, string forma)> _vistas = new Dictionary<Image, (Vector2, Vector2, string)>();
        static List<UIWeaponArtDisplay> _telas = new List<UIWeaponArtDisplay>();
        static float _procurarTelas;

        /// <summary>Em todo quadro, antes do desenho: cada peca com caixa forjada vai para a caixa que o usuario montou; as
        /// outras voltam a caixa do jogo (a mesma tela serve a outras pecas depois de uma troca).</summary>
        public static void FormasNasArmas()
        {
            if (_formas.Count == 0 && _vistas.Count == 0) return;
            if (_formas.Count > 0 && Time.unscaledTime >= _procurarTelas)
            {
                _procurarTelas = Time.unscaledTime + 0.1f;
                _telas = UnityEngine.Object.FindObjectsOfType<UIWeaponArtDisplay>().ToList();
            }
            foreach (var t in _telas) { if (t == null) continue; Ajustar(t.PartA); Ajustar(t.PartB); Ajustar(t.PartC); }
            if (_formas.Count == 0)
            {
                foreach (var kv in _vistas.ToList()) { var img = kv.Key; if (img == null) continue; var rt = img.rectTransform; Tamanho(rt, kv.Value.tam); rt.anchoredPosition = kv.Value.pos; }
                _vistas.Clear(); _telas.Clear();
            }
        }

        static void Tamanho(RectTransform rt, Vector2 t)
        {
            rt.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, t.x);
            rt.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, t.y);
        }

        static void Ajustar(Image img)
        {
            if (img == null) return;
            var nome = img.sprite != null ? img.sprite.name : null;
            _formas.TryGetValue(nome ?? "", out var f);
            bool temForma = nome != null && _formas.ContainsKey(nome);
            var rt = img.rectTransform;
            if (_vistas.TryGetValue(img, out var v))
            {
                if (v.forma == (temForma ? nome : null)) return;          // ja esta como deve
                Tamanho(rt, v.tam); rt.anchoredPosition = v.pos;          // volta a caixa do jogo antes de outra forma
                if (!temForma) { _vistas.Remove(img); return; }
            }
            else if (!temForma) return;
            else v = (rt.anchoredPosition, rt.rect.size, null);
            // a caixa do jogo: largura W, altura H, pivo p; a nova: centro deslocado (x W, y H) e tamanho (w W, h H)
            float W = v.tam.x, H = v.tam.y, nW = W * f.z, nH = H * f.w; var p = rt.pivot;
            var d = new Vector3(f.x * W - (0.5f - p.x) * (nW - W), f.y * H - (0.5f - p.y) * (nH - H), 0f);
            var desloc = rt.localRotation * Vector3.Scale(d, rt.localScale);
            Tamanho(rt, new Vector2(nW, nH));
            rt.anchoredPosition = v.pos + new Vector2(desloc.x, desloc.y);
            _vistas[img] = (v.pos, v.tam, nome);
        }

        /// <summary>Volta tudo ao que o jogo tinha (ao voltar ao menu ou antes de outro mapa).</summary>
        public static void Restaurar()
        {
            DesfazerArmas();
            _desfazer.Executar("valores dos heróis do jogo"); _trocas.Clear(); _maos.Clear(); _runasIniciais.Clear(); _retratos.Clear(); _avisados.Clear();
            _formas.Clear(); FormasNasArmas(); _vistas.Clear(); _telas.Clear();
            foreach (var id in _comArte) Personalizados.EsquecerArte(id);
            _comArte.Clear();
        }
    }
}
