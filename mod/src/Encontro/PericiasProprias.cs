using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FFG.Core;
using FFG.D3;
using I2.Loc;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Bigorna.Encontro
{
    /// <summary>
    /// Pericias da Oficina: {id, game?, hero, name, cost}. Uma pericia do jogo pode ter nome e custo de XP mudados; uma nova
    /// nasce de uma copia de outra pericia do mesmo heroi e entra nas colecoes do jogo: a janela de pericias do heroi a lista
    /// (bloqueada) e uma facanha pode da-la de premio. As cartas ficam na mesa; aqui so o nome e o custo. Tudo e desfeito ao
    /// voltar ao menu (as novas saem das colecoes; um save que ja a desbloqueou so guarda o id, que deixa de aparecer).
    /// </summary>
    public static class PericiasProprias
    {
        static readonly Desfazer _desfazer = new Desfazer();
        static readonly FieldInfo _campoId = typeof(ModelBase).GetField("_id", BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public);

        public static void Registrar(List<JObject> pericias, string origem)
        {
            if (pericias == null || pericias.Count == 0) return;
            Restaurar();
            int n = 0;
            foreach (var j in pericias) { try { if (Uma(j)) n++; } catch (Exception ex) { Log.Erro("perícia «" + (string)j["id"] + "»", ex); } }
            if (n > 0) Log.Info("perícias da Oficina de " + origem + ": " + n);
        }

        static bool Uma(JObject j)
        {
            var id = (string)j["id"]; var jogo = (string)j["game"]; var nome = (string)j["name"];
            var heroi = HeroiDe((string)j["hero"]);
            SkillModel s;
            if (!string.IsNullOrEmpty(jogo))
            {
                s = UserCollectionManager.GetSkill(jogo, false);
                if (s == null) { Log.Info("  perícia do jogo «" + jogo + "» não existe"); return false; }
                var k0 = s.KeyName; var c0 = s.XPCost; var alvo = s;
                _desfazer.Add(() => { alvo.KeyName = k0; alvo.XPCost = c0; });
            }
            else
            {
                if (heroi == HeroEnum.NONE) { Log.Info("  perícia «" + id + "»: sem herói, fica só no editor"); return false; }
                var todas = UserCollectionManager.GetSkills(UserCollectionManager.GetHeroModel(heroi), false);
                var molde = todas?.FirstOrDefault(x => x != null) ?? UserCollectionManager.GetSkill("SKILL_BRYNN_1", false);
                if (molde == null) { Log.Info("  perícia «" + id + "»: nenhuma perícia do jogo para copiar"); return false; }
                s = UnityEngine.Object.Instantiate(molde); s.name = id; _campoId?.SetValue(s, id); s.Hero = heroi;
                NaColecao(id, s);
            }
            if (!string.IsNullOrEmpty(nome)) s.KeyName = Jogo.Termo("BIGORNA_SKILL_NAME_" + id, nome);
            if (j["cost"] != null) s.XPCost = Math.Max(0, (int)j["cost"]);
            Log.Info("  perícia " + s.Id + " (" + s.Hero + "): «" + nome + "», " + s.XPCost + " XP");
            return true;
        }

        static HeroEnum HeroiDe(string id)
        {
            if (string.IsNullOrEmpty(id)) return HeroEnum.NONE;
            var nome = id.StartsWith("HERO_", StringComparison.OrdinalIgnoreCase) ? id.Substring(5) : id;
            foreach (HeroEnum h in Enum.GetValues(typeof(HeroEnum))) if (string.Equals(h.ToString(), nome, StringComparison.OrdinalIgnoreCase)) return h;
            return HeroEnum.NONE;
        }

        static void NaColecao(string id, SkillModel s)
        {
            foreach (var nome in new[] { "s_allSkills", "s_ownedSkills" })
            {
                try
                {
                    if (typeof(UserCollectionManager).GetField(nome, BindingFlags.Static | BindingFlags.NonPublic)?.GetValue(null) is System.Collections.IDictionary dic)
                    { dic[id] = s; var d = dic; _desfazer.Add(() => { try { if (d.Contains(id)) d.Remove(id); } catch { } }); }
                }
                catch (Exception ex) { Log.Info("registrando «" + id + "» em " + nome + ": " + ex.Message); }
            }
        }

        public static void Restaurar()
        {
            _desfazer.Executar("valores das perícias do jogo");
        }
    }
}
