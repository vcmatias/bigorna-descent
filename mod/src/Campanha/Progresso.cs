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
        public static bool Vale(Dcamp.Escolha e, Progresso p) => string.IsNullOrEmpty(e.Var) || (p?.Var(e.Var) ?? 0) == e.Valor;
        [JsonProperty("campaign")] public string Campanha;
        [JsonProperty("unlocked")] public List<string> Liberados = new List<string>();
        [JsonProperty("completed")] public List<string> Completados = new List<string>();
        [JsonProperty("vars")] public Dictionary<string, int> Variaveis = new Dictionary<string, int>();
        /// <summary>"Continuar herois": a partida gravada de onde veio o grupo (ranhura, identificador e nome); vazio: grupo novo.</summary>
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
        public int Var(string nome) => Variaveis.TryGetValue(nome ?? "", out var v) ? v : 0;
        public void PorVar(string nome, int valor) { if (string.IsNullOrEmpty(nome)) return; Variaveis[nome] = valor; Guardar(); }
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

        public void Zerar() { Liberados.Clear(); Completados.Clear(); Variaveis.Clear(); OrigemSlot = null; OrigemGuid = null; OrigemNome = null; OrigemCarimbo = null; Guardar(); }

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
