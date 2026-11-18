using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Bigorna.Formato;
using Newtonsoft.Json;

namespace Bigorna.Campanha
{
    /// <summary>O que ja foi feito numa campanha: nos completados, nos liberados a mao e variaveis. Fica em bigorna-progresso.json na pasta da campanha.</summary>
    public class Progresso
    {
        /// <summary>Se uma escolha lembrada vale (sem variavel, sempre; sem progresso, a variavel vale 0). Fica aqui, e nao no
        /// formato (Formato/Dcamp.cs), para o formato nao depender do estado do jogo.</summary>
        /// v377: com operador (pelo menos, no maximo, maior que outra, a maior entre varias), "todas" e a saida de uma Encruzilhada.
        public static bool Vale(Dcamp.Escolha e, Progresso p) => Vale(e, p, e?.Inicios);
        static bool Vale(Dcamp.Escolha e, Progresso p, Dictionary<string, int> inicios)
        {
            if (e == null) return true;
            inicios = e.Inicios ?? inicios;
            if (e.Todas != null && e.Todas.Count > 0 && !e.Todas.All(x => Vale(x, p, inicios))) return false;
            if (!string.IsNullOrEmpty(e.Ramo)) return SaidaDo(e, p, inicios) == e.Saida;
            if (e.Op == "never") return false;
            if (string.IsNullOrEmpty(e.Var)) return true;
            int v = ValorDe(e.Var, p, inicios);
            switch (e.Op)
            {
                case "ge": return v >= e.Valor;
                case "le": return v <= e.Valor;
                case "gt": return v > ValorDe(e.Outra, p, inicios);
                case "max": return (e.Entre ?? new List<string>()).Where(x => !string.IsNullOrEmpty(x) && x != e.Var).All(x => v >= ValorDe(x, p, inicios));
                default: return v == e.Valor;
            }
        }
        static int ValorDe(string nome, Progresso p, Dictionary<string, int> inicios) => p != null ? p.Var(nome) : (inicios != null && nome != null && inicios.TryGetValue(nome, out var i) ? i : 0);
        /// <summary>A saida de uma Encruzilhada: a que ja ficou decidida (uma carta dela tocou ou foi completada) ou a primeira
        /// cuja condicao vale agora (nenhuma: a ultima, "nos outros casos").</summary>
        static int SaidaDo(Dcamp.Escolha e, Progresso p, Dictionary<string, int> inicios)
        {
            int fixa = p?.Var("branch:" + e.Ramo) ?? 0;
            if (fixa > 0) return fixa - 1;
            var ss = e.Saidas ?? new List<Dcamp.Escolha>();
            for (int i = 0; i < ss.Count; i++) if (ss[i] != null && Vale(ss[i], p, inicios)) return i;
            return ss.Count;
        }
        /// <summary>Uma carta depois de uma Encruzilhada tocou (ou foi completada): a saida fica decidida para o resto da campanha,
        /// mesmo que as variaveis mudem depois.</summary>
        public void Fixar(Dcamp.Escolha e)
        {
            if (e == null) return;
            if (e.Todas != null) foreach (var x in e.Todas) Fixar(x);
            if (string.IsNullOrEmpty(e.Ramo) || Var("branch:" + e.Ramo) > 0) return;
            int k = SaidaDo(e, this, e.Inicios); if (k != e.Saida) return;
            PorVar("branch:" + e.Ramo, k + 1); Log.Info("encruzilhada «" + e.Ramo + "»: saída " + (k + 1));
        }
        [JsonProperty("campaign")] public string Campanha;
        [JsonProperty("unlocked")] public List<string> Liberados = new List<string>();
        [JsonProperty("completed")] public List<string> Completados = new List<string>();
        [JsonProperty("vars")] public Dictionary<string, int> Variaveis = new Dictionary<string, int>();
        /// <summary>"Continuar herois": a partida gravada de onde veio o grupo (ranhura, identificador e nome); vazio: grupo novo.</summary>
        /// <summary>v372: o nível do jogo escolhido ao começar a campanha (Journey, Standard, Heroic, Warfare).</summary>
        [JsonProperty("difficulty", NullValueHandling = NullValueHandling.Ignore)] public string Nivel;
        public void PorNivel(string n) { Nivel = n; Guardar(); }
        [JsonProperty("partySlot", NullValueHandling = NullValueHandling.Ignore)] public int? OrigemSlot;
        [JsonProperty("partySave", NullValueHandling = NullValueHandling.Ignore)] public string OrigemGuid;
        [JsonProperty("partyName", NullValueHandling = NullValueHandling.Ignore)] public string OrigemNome;
        /// <summary>A gravacao da partida de origem quando o grupo saiu dela (o carimbo de tempo do arquivo): no fim, o grupo so
        /// volta a ela se ela continua nessa gravacao.</summary>
        [JsonProperty("partyStamp", NullValueHandling = NullValueHandling.Ignore)] public long? OrigemCarimbo;
        public Encontro.GrupoDoSave.Save Origem() => OrigemSlot.HasValue ? new Encontro.GrupoDoSave.Save { Slot = OrigemSlot.Value, Guid = OrigemGuid, Nome = OrigemNome, Carimbo = OrigemCarimbo ?? 0 } : null;
        public void PorOrigem(Encontro.GrupoDoSave.Save s) { OrigemSlot = s?.Slot; OrigemGuid = s?.Guid; OrigemNome = s?.Nome; OrigemCarimbo = s != null && s.Carimbo != 0 ? s.Carimbo : (long?)null; Guardar(); }
        [JsonIgnore] string _caminho;

        public bool Liberado(string id) => Liberados.Contains(id);
        public bool Completado(string id) => Completados.Contains(id);
        public int Var(string nome) => Variaveis.TryGetValue(nome ?? "", out var v) ? v : _inicios.TryGetValue(nome ?? "", out var i) ? i : 0;
        /// <summary>v377: nunca abaixo de 0 nem acima do maximo da variavel (as de sim/nao, 1).</summary>
        public void PorVar(string nome, int valor) { if (string.IsNullOrEmpty(nome)) return; valor = Math.Max(0, valor); if (_maximos.TryGetValue(nome, out var mx) && mx > 0 && valor > mx) valor = mx; Variaveis[nome] = valor; Guardar(); }
        /// <summary>v377: somar (ou tirar, com n negativo), definir ou somar o valor de outra variavel.</summary>
        public void Mudar(string nome, string op, int n, string outra)
        {
            if (string.IsNullOrEmpty(nome)) return;
            int v = op == "set" ? n : op == "sub" ? Var(nome) - n : op == "addvar" ? Var(nome) + Var(outra) : Var(nome) + n;
            PorVar(nome, v); Log.Info("  campanha: " + nome + " = " + Var(nome));
        }
        [JsonIgnore] Dictionary<string, int> _inicios = new Dictionary<string, int>(), _maximos = new Dictionary<string, int>();
        public void Liberar(string id) { if (string.IsNullOrEmpty(id) || Liberados.Contains(id)) return; Liberados.Add(id); Log.Info("nó liberado: " + id); Guardar(); }
        public void Completar(string id)
        {
            if (string.IsNullOrEmpty(id)) return;
            if (!Completados.Contains(id)) Completados.Add(id);
            if (!Liberados.Contains(id)) Liberados.Add(id);
            Log.Info("nó completado: " + id);
            Guardar();
        }

        /// <summary>O no deve estar no mapa-mundi agora: nao completado e (liberado a mao, ou automatico com os anteriores completados).</summary>
        public bool DeveAparecer(Dcamp.No n)
        {
            if (n == null || Completado(n.Id)) return false;
            if (Liberado(n.Id)) return true;
            var a = n.Aparece;
            if (a == null || !a.Auto) return false;
            if (!string.IsNullOrEmpty(a.VarLiberacao) && Var(a.VarLiberacao) == 0) return false;
            if (a.DepoisDosNos.Any(id => !Completado(id))) return false;
            if (a.Escolha != null && !Vale(a.Escolha, this)) return false;
            try
            {
                var dados = Jogo.Partida;
                if (dados != null && a.DepoisDasMissoes.Any(q => !dados.CompletedDestinationIds.Contains(q))) return false;
            }
            catch { }
            return true;
        }

        public void Zerar() { Liberados.Clear(); Completados.Clear(); Variaveis.Clear(); Nivel = null; OrigemSlot = null; OrigemGuid = null; OrigemNome = null; OrigemCarimbo = null; Guardar(); }

        static string CaminhoDe(Dcamp c) => Path.Combine(c.Pasta, "bigorna-progresso.json");

        public static Progresso Carregar(Dcamp c)
        {
            var caminho = CaminhoDe(c);
            Progresso p = null;
            try { if (File.Exists(caminho)) p = JsonConvert.DeserializeObject<Progresso>(File.ReadAllText(caminho)); }
            catch (Exception ex) { Log.Info("progresso ilegível (" + ex.Message + "); começa do zero"); }
            p = p ?? new Progresso();
            p.Liberados = p.Liberados ?? new List<string>();
            p.Completados = p.Completados ?? new List<string>();
            p.Variaveis = p.Variaveis ?? new Dictionary<string, int>();
            p.Campanha = c.Id;
            foreach (var v in c.Variaveis ?? new List<Dcamp.Variavel>()) { if (string.IsNullOrEmpty(v?.Var)) continue; p._inicios[v.Var] = Math.Max(0, v.Inicio); p._maximos[v.Var] = v.Maximo; }
            p._caminho = caminho;
            return p;
        }

        void Guardar()
        {
            if (string.IsNullOrEmpty(_caminho)) return;
            try { File.WriteAllText(_caminho, JsonConvert.SerializeObject(this, Formatting.Indented)); }
            catch (Exception ex) { Log.Info("não gravei o progresso: " + ex.Message); }
        }
    }
}
