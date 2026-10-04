using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

// Leitor de asset bundles do Unity em C# puro (sem Unity e sem bibliotecas de terceiros). Le o conteiner UnityFS,
// descomprime os blocos (nenhuma, LZ4, LZ4HC), interpreta os SerializedFile (versoes 17 a 22+) e le cada objeto pela
// sua arvore de tipos (typetree) embutida, devolvendo valores CLR simples:
//
//   estrutura            -> Dictionary<string, object> (na ordem dos campos)
//   vector/array/map/set -> List<object>             (map/set: lista de KeyValuePair<object, object>)
//   pair                 -> KeyValuePair<object, object>
//   vector<UInt8>        -> byte[]                   (o UnityPy devolve lista de inteiros; o conteudo e o mesmo)
//   TypelessData         -> byte[]
//   string               -> string
//   inteiros ate 64 bits com sinal e todos os sem sinal ate 32 bits -> long
//   UInt64 / unsigned long long / FileSize -> ulong
//   float -> float, double -> double, bool -> bool
//   PPtr<X>              -> Dictionary com m_FileID (long) e m_PathID (long)
//
// Nada aqui e seguro para varias threads ao mesmo tempo sobre o mesmo Pacote.

namespace Bigorna.Dados.Unity
{
    /// <summary>Uma entrada do diretorio de um bundle (arquivo serializado, .resS, .resource...).</summary>
    public sealed class EntradaPacote
    {
        public string Nome { get; internal set; }
        public long Offset { get; internal set; }
        public long Tamanho { get; internal set; }
        /// <summary>Flags do no do diretorio; 4 = arquivo serializado.</summary>
        public uint Flags { get; internal set; }
        public bool Serializado => (Flags & 4) != 0;
    }

    /// <summary>Um asset bundle UnityFS aberto do disco (ou da memoria).</summary>
    public sealed class Pacote
    {
        struct Bloco { public long OffsetComp, OffsetDescomp; public int TamComp, TamDescomp; public ushort Flags; }

        public string Caminho { get; private set; }
        public string Assinatura { get; private set; }
        public int Formato { get; private set; }
        public string VersaoJogador { get; private set; }
        public string VersaoMotor { get; private set; }
        public uint FlagsDoArquivo { get; private set; }

        readonly List<EntradaPacote> _entradas = new List<EntradaPacote>();
        readonly List<ArquivoSerializado> _arquivos = new List<ArquivoSerializado>();
        Bloco[] _blocos;
        byte[] _bruto;        // arquivo inteiro na memoria (so enquanto aberto ou quando carregado da memoria)
        bool _manterBruto;

        public IReadOnlyList<EntradaPacote> Entradas => _entradas;
        public IReadOnlyList<ArquivoSerializado> Arquivos => _arquivos;

        /// <summary>Chamado quando um PPtr aponta para um arquivo externo que nao esta neste bundle (recebe o nome do
        /// arquivo, por exemplo "CAB-..."; devolve o arquivo serializado ou null). Permite encadear bundles.</summary>
        public Func<string, ArquivoSerializado> ResolvedorExterno { get; set; }

        Pacote() { }

        public static Pacote Abrir(string caminho)
        {
            var p = new Pacote { Caminho = caminho };
            p.Montar(File.ReadAllBytes(caminho), false);
            return p;
        }

        /// <summary>So os nomes das entradas (CAB-...) de um bundle, lendo o cabecalho e o indice, sem descomprimir os dados.</summary>
        public static List<string> NomesDasEntradas(string caminho)
        {
            using (var fs = new FileStream(caminho, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
            {
                var cab = new byte[(int)Math.Min(fs.Length, 4096)];
                fs.Read(cab, 0, cab.Length);
                var r = new Leitor(cab, 0, cab.Length, true);
                if (r.StringNula() != "UnityFS") throw new NotSupportedException("so UnityFS");
                int formato = (int)r.U32(); r.StringNula(); var motor = r.StringNula();
                r.I64();
                int tamComp = (int)r.U32(), tamDescomp = (int)r.U32(); uint flags = r.U32();
                if (formato >= 7) r.Alinhar(16);
                var comp = new byte[tamComp];
                fs.Seek((flags & 0x80) != 0 ? fs.Length - tamComp : r.Pos, SeekOrigin.Begin);
                int lidos = 0; while (lidos < tamComp) { int n = fs.Read(comp, lidos, tamComp - lidos); if (n <= 0) break; lidos += n; }
                var info = new byte[tamDescomp];
                Descomprimir((int)(flags & 0x3F), comp, 0, tamComp, info, 0, tamDescomp);
                var ri = new Leitor(info, 0, info.Length, true);
                ri.Pular(16);
                int nb = ri.I32(); ri.Pular(nb * 10);
                int nn = ri.I32(); var nomes = new List<string>();
                for (int i = 0; i < nn; i++) { ri.I64(); ri.I64(); ri.U32(); nomes.Add(ri.StringNula()); }
                return nomes;
            }
        }

        public static Pacote Carregar(byte[] dados, string nome = null)
        {
            var p = new Pacote { Caminho = nome };
            p.Montar(dados, true);
            return p;
        }

        void Montar(byte[] dados, bool manter)
        {
            _bruto = dados;
            _manterBruto = manter;
            if (dados.Length < 8 || dados[0] != 'U' || dados[1] != 'n' || dados[2] != 'i' || dados[3] != 't' || dados[4] != 'y')
                throw new InvalidDataException("Nao e um asset bundle do Unity: " + (Caminho ?? "(memoria)"));
            var r = new Leitor(dados, 0, dados.Length, true);
            Assinatura = r.StringNula();
            if (Assinatura != "UnityFS")
                throw new NotSupportedException("Bundle '" + Assinatura + "' nao suportado (so UnityFS).");
            Formato = (int)r.U32();
            VersaoJogador = r.StringNula();
            VersaoMotor = r.StringNula();
            r.I64(); // tamanho total
            int tamInfoComp = (int)r.U32();
            int tamInfoDescomp = (int)r.U32();
            FlagsDoArquivo = r.U32();

            bool flagsNovas = FlagsNovas(VersaoMotor);
            uint flagCripto = flagsNovas ? 0x400u : 0x200u;
            if ((FlagsDoArquivo & flagCripto) != 0)
                throw new NotSupportedException("Bundle criptografado (UnityCN) nao suportado.");

            if (Formato >= 7) r.Alinhar(16);
            byte[] infoComp;
            if ((FlagsDoArquivo & 0x80) != 0)
            {
                infoComp = new byte[tamInfoComp];
                Buffer.BlockCopy(dados, dados.Length - tamInfoComp, infoComp, 0, tamInfoComp);
            }
            else infoComp = r.Bytes(tamInfoComp);
            var info = new byte[tamInfoDescomp];
            Descomprimir((int)(FlagsDoArquivo & 0x3F), infoComp, 0, tamInfoComp, info, 0, tamInfoDescomp);

            var ri = new Leitor(info, 0, info.Length, true);
            ri.Pular(16); // hash dos dados descomprimidos
            int nBlocos = ri.I32();
            _blocos = new Bloco[nBlocos];
            for (int i = 0; i < nBlocos; i++)
            {
                _blocos[i].TamDescomp = (int)ri.U32();
                _blocos[i].TamComp = (int)ri.U32();
                _blocos[i].Flags = ri.U16();
            }
            int nNos = ri.I32();
            for (int i = 0; i < nNos; i++)
            {
                var e = new EntradaPacote();
                e.Offset = ri.I64();
                e.Tamanho = ri.I64();
                e.Flags = ri.U32();
                e.Nome = ri.StringNula();
                _entradas.Add(e);
            }

            if (flagsNovas && (FlagsDoArquivo & 0x200) != 0) r.Alinhar(16);
            long oc = r.Pos, od = 0;
            for (int i = 0; i < nBlocos; i++)
            {
                _blocos[i].OffsetComp = oc;
                _blocos[i].OffsetDescomp = od;
                oc += _blocos[i].TamComp;
                od += _blocos[i].TamDescomp;
            }
            if (oc > dados.Length) throw new InvalidDataException("Bundle truncado.");

            foreach (var e in _entradas)
            {
                if (!ParecSerializado(e)) continue;
                var bytes = LerIntervalo(e.Offset, e.Tamanho);
                _arquivos.Add(new ArquivoSerializado(bytes, e.Nome, this));
            }
            if (!_manterBruto) _bruto = null;
        }

        static bool ParecSerializado(EntradaPacote e)
        {
            if (e.Serializado) return true;
            if (e.Flags != 0) return false;
            var n = e.Nome.ToLowerInvariant();
            return !(n.EndsWith(".ress") || n.EndsWith(".resource") || n.EndsWith(".resources"));
        }

        // Flags do UnityFS mudaram (0x200 era criptografia, virou "padding no inicio") em 2020.3.34, 2021.3.2 e 2022.1.1.
        static bool FlagsNovas(string versao)
        {
            int[] v = new int[3];
            int k = 0, num = 0; bool tem = false;
            foreach (char c in versao ?? "")
            {
                if (c >= '0' && c <= '9') { num = num * 10 + (c - '0'); tem = true; continue; }
                if (tem && k < 3) v[k++] = num;
                num = 0; tem = false;
                if (c != '.' || k >= 3) break;
            }
            if (tem && k < 3) v[k++] = num;
            if (k == 0 || v[0] == 0) return true; // versao desconhecida: supoe moderna
            if (v[0] < 2020) return false;
            if (v[0] == 2020) return v[1] > 3 || (v[1] == 3 && v[2] >= 34);
            if (v[0] == 2021) return v[1] > 3 || (v[1] == 3 && v[2] >= 2);
            if (v[0] == 2022) return v[1] > 1 || (v[1] == 1 && v[2] >= 1);
            return true;
        }

        byte[] Bruto()
        {
            if (_bruto != null) return _bruto;
            if (Caminho == null || !File.Exists(Caminho)) throw new InvalidOperationException("Dados do bundle indisponiveis.");
            return File.ReadAllBytes(Caminho);
        }

        /// <summary>Descomprime o intervalo [offset, offset+tamanho) do fluxo de dados do bundle.</summary>
        byte[] LerIntervalo(long offset, long tamanho)
        {
            if (tamanho > int.MaxValue) throw new NotSupportedException("Entrada grande demais.");
            var saida = new byte[tamanho];
            long fim = offset + tamanho;
            byte[] bruto = Bruto();
            byte[] tmp = null;
            for (int i = 0; i < _blocos.Length; i++)
            {
                var b = _blocos[i];
                long bIni = b.OffsetDescomp, bFim = bIni + b.TamDescomp;
                if (bFim <= offset) continue;
                if (bIni >= fim) break;
                long ini = Math.Max(offset, bIni), ate = Math.Min(fim, bFim);
                int comp = b.Flags & 0x3F;
                if (comp == 0)
                {
                    Buffer.BlockCopy(bruto, (int)(b.OffsetComp + (ini - bIni)), saida, (int)(ini - offset), (int)(ate - ini));
                    continue;
                }
                if (ini == bIni && ate == bFim)
                {
                    Descomprimir(comp, bruto, (int)b.OffsetComp, b.TamComp, saida, (int)(ini - offset), b.TamDescomp);
                    continue;
                }
                if (tmp == null || tmp.Length < b.TamDescomp) tmp = new byte[b.TamDescomp];
                Descomprimir(comp, bruto, (int)b.OffsetComp, b.TamComp, tmp, 0, b.TamDescomp);
                Buffer.BlockCopy(tmp, (int)(ini - bIni), saida, (int)(ini - offset), (int)(ate - ini));
            }
            return saida;
        }

        /// <summary>Bytes de uma entrada do bundle (por exemplo um .resS); null se nao existir.</summary>
        public byte[] LerEntrada(string nome)
        {
            foreach (var e in _entradas)
                if (string.Equals(e.Nome, nome, StringComparison.OrdinalIgnoreCase)) return LerIntervalo(e.Offset, e.Tamanho);
            return null;
        }

        public ArquivoSerializado ArquivoPorNome(string nome)
        {
            if (nome == null) return null;
            foreach (var a in _arquivos)
                if (string.Equals(a.Nome, nome, StringComparison.OrdinalIgnoreCase)) return a;
            return null;
        }

        /// <summary>Todos os objetos de todos os arquivos serializados do bundle.</summary>
        public IEnumerable<Objeto> Objetos
        {
            get { foreach (var a in _arquivos) foreach (var o in a.Objetos) yield return o; }
        }

        /// <summary>Resolve um PPtr (m_FileID, m_PathID) relativo ao arquivo de origem. Null se nulo ou nao encontrado.</summary>
        public Objeto Resolver(ArquivoSerializado origem, long fileId, long pathId) => origem?.Resolver(fileId, pathId);

        public Objeto Resolver(ArquivoSerializado origem, IDictionary<string, object> pptr)
        {
            if (origem == null || pptr == null) return null;
            if (!pptr.TryGetValue("m_FileID", out var f) || !pptr.TryGetValue("m_PathID", out var p)) return null;
            return origem.Resolver(Convert.ToInt64(f), Convert.ToInt64(p));
        }

        internal ArquivoSerializado ArquivoExterno(string nomeArquivo)
        {
            var a = ArquivoPorNome(nomeArquivo);
            if (a != null) return a;
            var r = ResolvedorExterno;
            return r != null ? r(nomeArquivo) : null;
        }

        readonly Dictionary<Objeto, string[]> _scriptDoMb = new Dictionary<Objeto, string[]>();
        readonly Dictionary<Objeto, string[]> _dadosMonoScript = new Dictionary<Objeto, string[]>();

        /// <summary>Nome da classe (m_ClassName do MonoScript) de um MonoBehaviour; null se nao der para resolver.</summary>
        public string ClasseDoScript(Objeto mb) => DadosDoScript(mb)?[0];

        /// <summary>Nome da classe com namespace ("Ns.Classe"), ou so a classe quando nao ha namespace.</summary>
        public string NomeCompletoDoScript(Objeto mb)
        {
            var d = DadosDoScript(mb);
            if (d == null) return null;
            return string.IsNullOrEmpty(d[1]) ? d[0] : d[1] + "." + d[0];
        }

        /// <summary>[classe, namespace, assembly] do MonoScript de um MonoBehaviour; null se nao der.</summary>
        public string[] DadosDoScript(Objeto mb)
        {
            if (mb == null || mb.ClassId != 114) return null;
            if (_scriptDoMb.TryGetValue(mb, out var s)) return s;
            s = null;
            try
            {
                var pptr = mb.LerCampo("m_Script") as IDictionary<string, object>;
                var ms = Resolver(mb.Arquivo, pptr);
                if (ms != null && !_dadosMonoScript.TryGetValue(ms, out s))
                {
                    if (ms.TentarLer(out var d))
                        s = new[] { d.TryGetValue("m_ClassName", out var c) ? c as string : null,
                                    d.TryGetValue("m_Namespace", out var n) ? n as string : null,
                                    d.TryGetValue("m_AssemblyName", out var a) ? a as string : null };
                    _dadosMonoScript[ms] = s;
                }
            }
            catch { s = null; }
            if (s != null) _scriptDoMb[mb] = s; // falhas nao ficam no cache: o ResolvedorExterno pode vir depois
            return s;
        }

        // ---------- descompressao ----------

        internal static void Descomprimir(int tipo, byte[] src, int so, int sl, byte[] dst, int dOff, int dl)
        {
            switch (tipo)
            {
                case 0:
                    if (sl != dl) throw new InvalidDataException("Bloco sem compressao com tamanhos diferentes.");
                    Buffer.BlockCopy(src, so, dst, dOff, dl);
                    return;
                case 2:
                case 3:
                    Lz4(src, so, sl, dst, dOff, dl);
                    return;
                case 1:
                    throw new NotSupportedException("Compressao LZMA nao suportada por este leitor (so LZ4/LZ4HC ou nenhuma).");
                default:
                    throw new NotSupportedException("Compressao de bundle desconhecida: " + tipo);
            }
        }

        static void Lz4(byte[] src, int so, int sl, byte[] dst, int dOff, int dl)
        {
            int s = so, send = so + sl, d = dOff, dend = dOff + dl;
            try
            {
                while (s < send)
                {
                    int token = src[s++];
                    int lit = token >> 4;
                    if (lit == 15) { int b; do { b = src[s++]; lit += b; } while (b == 255); }
                    if (lit > 0)
                    {
                        if (s + lit > send || d + lit > dend) throw new InvalidDataException("LZ4: literal fora dos limites.");
                        Buffer.BlockCopy(src, s, dst, d, lit);
                        s += lit; d += lit;
                    }
                    if (s >= send) break;
                    int off = src[s] | (src[s + 1] << 8);
                    s += 2;
                    int ml = token & 15;
                    if (ml == 15) { int b; do { b = src[s++]; ml += b; } while (b == 255); }
                    ml += 4;
                    int m = d - off;
                    if (off == 0 || m < dOff || d + ml > dend) throw new InvalidDataException("LZ4: copia fora dos limites.");
                    if (off >= ml) Buffer.BlockCopy(dst, m, dst, d, ml);
                    else for (int i = 0; i < ml; i++) dst[d + i] = dst[m + i];
                    d += ml;
                }
            }
            catch (IndexOutOfRangeException) { throw new InvalidDataException("LZ4: dados corrompidos."); }
            if (d != dend) throw new InvalidDataException("LZ4: tamanho descomprimido diferente do esperado.");
        }
    }

    /// <summary>No da arvore de tipos.</summary>
    public sealed class NoTipo
    {
        internal enum K : byte { Classe, Vetor, Par, S8, U8, S16, U16, S32, U32, S64, U64, F32, F64, Bool, Str, Typeless, RefObj, Registro }

        public string Tipo { get; internal set; }
        public string Nome { get; internal set; }
        public int Nivel { get; internal set; }
        public int TamanhoByte { get; internal set; }
        public uint MetaFlag { get; internal set; }
        public int Versao { get; internal set; }
        public byte FlagsTipo { get; internal set; }
        public List<NoTipo> Filhos { get; } = new List<NoTipo>();
        public bool Alinhado => (MetaFlag & 0x4000) != 0;

        internal K Kind;
        internal bool AlinharDepois;  // flag do proprio no, ou do filho Array no caso de vetores
        internal NoTipo Elemento;     // vetores

        internal void Compilar()
        {
            foreach (var f in Filhos) f.Compilar();
            AlinharDepois = Alinhado;
            switch (Tipo)
            {
                case "SInt8": Kind = K.S8; return;
                case "UInt8": case "char": Kind = K.U8; return;
                case "short": case "SInt16": Kind = K.S16; return;
                case "unsigned short": case "UInt16": Kind = K.U16; return;
                case "int": case "SInt32": Kind = K.S32; return;
                case "unsigned int": case "UInt32": case "Type*": Kind = K.U32; return;
                case "long long": case "SInt64": Kind = K.S64; return;
                case "unsigned long long": case "UInt64": case "FileSize": Kind = K.U64; return;
                case "float": Kind = K.F32; return;
                case "double": Kind = K.F64; return;
                case "bool": Kind = K.Bool; return;
                case "string": Kind = K.Str; return;
                case "TypelessData": Kind = K.Typeless; return;
                case "pair": Kind = K.Par; return;
                case "ReferencedObject": Kind = K.RefObj; return;
                case "ManagedReferencesRegistry": Kind = K.Registro; break;
            }
            if (Filhos.Count > 0 && Filhos[0].Tipo == "Array")
            {
                Kind = K.Vetor;
                if (Filhos[0].Alinhado) AlinharDepois = true;
                if (Filhos[0].Filhos.Count < 2) throw new InvalidDataException("Array sem elemento na arvore de tipos.");
                Elemento = Filhos[0].Filhos[1];
                return;
            }
            if (Kind != K.Registro) Kind = K.Classe;
        }

        public override string ToString() => Tipo + " " + Nome;
    }

    /// <summary>Tipo serializado (entrada da tabela de tipos de um SerializedFile).</summary>
    public sealed class TipoSerializado
    {
        public int ClassId { get; internal set; }
        public bool Removido { get; internal set; }
        public short IndiceScript { get; internal set; } = -1;
        public byte[] ScriptId { get; internal set; }
        public byte[] HashAntigo { get; internal set; }
        public NoTipo Raiz { get; internal set; }
        public string NomeClasse { get; internal set; }
        public string Namespace { get; internal set; }
        public string Assembly { get; internal set; }
        public int[] Dependencias { get; internal set; }
    }

    /// <summary>Um arquivo serializado do Unity (CAB-..., cena, .sharedAssets, .assets).</summary>
    public sealed class ArquivoSerializado
    {
        internal readonly byte[] Dados;
        public string Nome { get; private set; }
        public Pacote Pacote { get; private set; }
        public int Versao { get; private set; }
        public bool BigEndian { get; private set; }
        public string VersaoUnity { get; private set; }
        public int Plataforma { get; private set; }
        public bool TemArvores { get; private set; }
        public long InicioDados { get; private set; }

        readonly List<TipoSerializado> _tipos = new List<TipoSerializado>();
        readonly List<TipoSerializado> _tiposRef = new List<TipoSerializado>();
        readonly List<Objeto> _objetos = new List<Objeto>();
        readonly Dictionary<long, Objeto> _porId = new Dictionary<long, Objeto>();
        readonly List<string> _externos = new List<string>();
        readonly List<KeyValuePair<int, long>> _scripts = new List<KeyValuePair<int, long>>();

        public IReadOnlyList<TipoSerializado> Tipos => _tipos;
        public IReadOnlyList<TipoSerializado> TiposReferenciados => _tiposRef;
        /// <summary>Caminhos dos arquivos externos (FileIdentifier.path); m_FileID = indice + 1.</summary>
        public IReadOnlyList<string> Externos => _externos;
        /// <summary>Tabela de scripts (indice do arquivo, pathId).</summary>
        public IReadOnlyList<KeyValuePair<int, long>> Scripts => _scripts;
        public IEnumerable<Objeto> Objetos => _objetos;
        public int Quantidade => _objetos.Count;

        /// <summary>Abre um arquivo serializado solto (fora de bundle).</summary>
        public static ArquivoSerializado Carregar(byte[] dados, string nome) => new ArquivoSerializado(dados, nome, null);

        internal ArquivoSerializado(byte[] dados, string nome, Pacote pacote)
        {
            Dados = dados;
            Nome = nome;
            Pacote = pacote;
            var r = new Leitor(dados, 0, dados.Length, true);
            long tamMeta = r.U32();
            long tamArq = r.U32();
            Versao = (int)r.U32();
            InicioDados = r.U32();
            if (Versao < 9)
            {
                r.Pos = (int)(tamArq - tamMeta);
                BigEndian = r.U8() != 0;
            }
            else
            {
                BigEndian = r.U8() != 0;
                r.Pular(3);
                if (Versao >= 22)
                {
                    tamMeta = r.U32();
                    tamArq = r.I64();
                    InicioDados = r.I64();
                    r.I64();
                }
            }
            r.BigEndian = BigEndian;
            if (Versao >= 7) VersaoUnity = r.StringNula();
            if (Versao >= 8) Plataforma = r.I32();
            TemArvores = Versao < 13 || r.U8() != 0;

            int nTipos = r.I32();
            for (int i = 0; i < nTipos; i++) _tipos.Add(LerTipo(r, false));

            bool idGrande = false;
            if (Versao >= 7 && Versao < 14) idGrande = r.I32() != 0;

            int nObj = r.I32();
            for (int i = 0; i < nObj; i++)
            {
                long pathId;
                if (idGrande) pathId = r.I64();
                else if (Versao < 14) pathId = r.I32();
                else { r.Alinhar(4); pathId = r.I64(); }
                long ini = Versao >= 22 ? r.I64() : r.U32();
                ini += InicioDados;
                long tam = r.U32();
                int typeId = r.I32();
                int classId;
                TipoSerializado tipo = null;
                if (Versao < 16)
                {
                    classId = r.U16();
                    foreach (var t in _tipos) if (t.ClassId == typeId) { tipo = t; break; }
                }
                else
                {
                    if (typeId < 0 || typeId >= _tipos.Count) throw new InvalidDataException("typeId invalido: " + typeId);
                    tipo = _tipos[typeId];
                    classId = tipo.ClassId;
                }
                if (Versao < 11) r.U16();
                if (Versao >= 11 && Versao < 17)
                {
                    short sti = r.I16();
                    if (tipo != null) tipo.IndiceScript = sti;
                }
                if (Versao == 15 || Versao == 16) r.U8();
                var o = new Objeto(this, pathId, classId, typeId, tipo, ini, tam);
                _objetos.Add(o);
                _porId[pathId] = o;
            }

            if (Versao >= 11)
            {
                int n = r.I32();
                for (int i = 0; i < n; i++)
                {
                    int idx = r.I32();
                    long id;
                    if (Versao < 14) id = r.I32();
                    else { r.Alinhar(4); id = r.I64(); }
                    _scripts.Add(new KeyValuePair<int, long>(idx, id));
                }
            }

            int nExt = r.I32();
            for (int i = 0; i < nExt; i++)
            {
                if (Versao >= 6) r.StringNula();
                if (Versao >= 5) { r.Pular(16); r.I32(); }
                _externos.Add(r.StringNula());
            }

            if (Versao >= 20)
            {
                int n = r.I32();
                for (int i = 0; i < n; i++) _tiposRef.Add(LerTipo(r, true));
            }
            // (v5+) userInformation: string nula, ignorada
        }

        TipoSerializado LerTipo(Leitor r, bool ehRef)
        {
            var t = new TipoSerializado();
            t.ClassId = r.I32();
            if (Versao >= 16) t.Removido = r.U8() != 0;
            if (Versao >= 17) t.IndiceScript = r.I16();
            if (Versao >= 13)
            {
                if ((ehRef && t.IndiceScript >= 0) || (Versao < 16 && t.ClassId < 0) || (Versao >= 16 && t.ClassId == 114))
                    t.ScriptId = r.Bytes(16);
                t.HashAntigo = r.Bytes(16);
            }
            if (TemArvores)
            {
                if (Versao >= 12 || Versao == 10) t.Raiz = LerArvoreBlob(r);
                else throw new NotSupportedException("Arvore de tipos no formato antigo (SerializedFile v" + Versao + ") nao suportada.");
                if (Versao >= 21)
                {
                    if (ehRef)
                    {
                        t.NomeClasse = r.StringNula();
                        t.Namespace = r.StringNula();
                        t.Assembly = r.StringNula();
                    }
                    else
                    {
                        int n = r.I32();
                        var dep = new int[n];
                        for (int i = 0; i < n; i++) dep[i] = r.I32();
                        t.Dependencias = dep;
                    }
                }
            }
            return t;
        }

        NoTipo LerArvoreBlob(Leitor r)
        {
            int nNos = r.I32();
            int tamStr = r.I32();
            int tamNo = Versao >= 19 ? 32 : 24;
            int iniNos = r.Pos;
            int iniStr = iniNos + nNos * tamNo;
            if (nNos <= 0 || tamStr < 0 || iniStr + tamStr > Dados.Length) throw new InvalidDataException("Arvore de tipos invalida.");
            var nos = new NoTipo[nNos];
            for (int i = 0; i < nNos; i++)
            {
                var n = new NoTipo();
                n.Versao = r.U16();
                n.Nivel = r.U8();
                n.FlagsTipo = r.U8();
                n.Tipo = StringDoBuffer(r.U32(), iniStr, tamStr);
                n.Nome = StringDoBuffer(r.U32(), iniStr, tamStr);
                n.TamanhoByte = r.I32();
                r.I32(); // indice
                n.MetaFlag = r.U32();
                if (tamNo == 32) r.I64(); // hash do tipo referenciado
                nos[i] = n;
            }
            r.Pos = iniStr + tamStr;
            // monta a hierarquia pelos niveis
            var pilha = new List<NoTipo> { nos[0] };
            for (int i = 1; i < nNos; i++)
            {
                var n = nos[i];
                while (pilha.Count > 0 && pilha[pilha.Count - 1].Nivel >= n.Nivel) pilha.RemoveAt(pilha.Count - 1);
                if (pilha.Count == 0) throw new InvalidDataException("Arvore de tipos com mais de uma raiz.");
                pilha[pilha.Count - 1].Filhos.Add(n);
                pilha.Add(n);
            }
            nos[0].Compilar();
            return nos[0];
        }

        string StringDoBuffer(uint v, int ini, int tam)
        {
            if ((v & 0x80000000u) != 0) return StringsComuns.Obter((int)(v & 0x7FFFFFFF));
            if (v >= tam) return v.ToString();
            int p = ini + (int)v, fim = ini + tam, e = p;
            while (e < fim && Dados[e] != 0) e++;
            return Encoding.UTF8.GetString(Dados, p, e - p);
        }

        public Objeto Obter(long pathId) => _porId.TryGetValue(pathId, out var o) ? o : null;

        /// <summary>Resolve m_FileID/m_PathID a partir deste arquivo (0 = este arquivo; n = Externos[n-1]).</summary>
        public Objeto Resolver(long fileId, long pathId)
        {
            if (pathId == 0) return null;
            if (fileId == 0) return Obter(pathId);
            if (fileId < 0 || fileId > _externos.Count) return null;
            var alvo = ArquivoExterno((int)fileId - 1);
            return alvo?.Obter(pathId);
        }

        readonly Dictionary<int, ArquivoSerializado> _cacheExt = new Dictionary<int, ArquivoSerializado>();

        ArquivoSerializado ArquivoExterno(int i)
        {
            if (_cacheExt.TryGetValue(i, out var a)) return a;
            var nome = NomeDoCaminho(_externos[i]);
            a = Pacote?.ArquivoExterno(nome);
            if (a != null) _cacheExt[i] = a; // so guarda acertos: o resolvedor externo pode ser definido depois
            return a;
        }

        /// <summary>Ultimo segmento de um caminho externo ("archive:/CAB-x/CAB-x" -> "CAB-x").</summary>
        public static string NomeDoCaminho(string caminho)
        {
            if (caminho == null) return null;
            int i = Math.Max(caminho.LastIndexOf('/'), caminho.LastIndexOf('\\'));
            return i >= 0 ? caminho.Substring(i + 1) : caminho;
        }

        internal NoTipo NoReferenciado(string classe, string ns, string asm)
        {
            foreach (var t in _tiposRef)
                if (t.NomeClasse == classe && t.Namespace == ns && t.Assembly == asm) return t.Raiz;
            throw new InvalidDataException("Tipo referenciado nao encontrado: " + ns + "." + classe + " (" + asm + ")");
        }

        public override string ToString() => Nome;
    }

    /// <summary>Um objeto de um arquivo serializado.</summary>
    public sealed class Objeto
    {
        public ArquivoSerializado Arquivo { get; }
        public long PathId { get; }
        public int ClassId { get; }
        public int TypeId { get; }
        public TipoSerializado TipoSerializado { get; }
        public long Inicio { get; }
        public long Tamanho { get; }
        /// <summary>Mensagem do ultimo erro de TentarLer (null se leu bem).</summary>
        public string Erro { get; private set; }

        internal Objeto(ArquivoSerializado arq, long pathId, int classId, int typeId, TipoSerializado tipo, long ini, long tam)
        {
            Arquivo = arq; PathId = pathId; ClassId = classId; TypeId = typeId; TipoSerializado = tipo; Inicio = ini; Tamanho = tam;
        }

        public NoTipo Raiz => TipoSerializado?.Raiz;

        /// <summary>Nome do tipo (raiz da arvore de tipos; sem arvore, pelo ClassId).</summary>
        public string Tipo => Raiz?.Tipo ?? NomeDaClasse(ClassId);

        /// <summary>Bytes crus do objeto.</summary>
        public byte[] Bruto()
        {
            var b = new byte[Tamanho];
            Buffer.BlockCopy(Arquivo.Dados, (int)Inicio, b, 0, (int)Tamanho);
            return b;
        }

        Leitor NovoLeitor()
        {
            if (Raiz == null) throw new InvalidDataException("Objeto sem arvore de tipos (" + Tipo + ").");
            if (Inicio < 0 || Inicio + Tamanho > Arquivo.Dados.Length) throw new InvalidDataException("Objeto fora dos limites do arquivo.");
            return new Leitor(Arquivo.Dados, (int)Inicio, (int)(Inicio + Tamanho), Arquivo.BigEndian);
        }

        /// <summary>Le o objeto inteiro. Lanca InvalidDataException se a leitura nao consumir exatamente o objeto.</summary>
        public Dictionary<string, object> Ler()
        {
            var r = NovoLeitor();
            object v;
            try { v = new LeitorArvore(r, Arquivo).Ler(Raiz); }
            catch (InvalidDataException) { throw; }
            catch (NotSupportedException) { throw; }
            catch (Exception e) { throw new InvalidDataException("Falha lendo " + Tipo + " " + PathId + ": " + e.Message, e); }
            if (r.Pos != r.Fim)
                throw new InvalidDataException("Leitura de " + Tipo + " " + PathId + " consumiu " + (r.Pos - Inicio) + " de " + Tamanho + " bytes.");
            return v as Dictionary<string, object> ?? new Dictionary<string, object> { { Raiz.Nome, v } };
        }

        /// <summary>Como Ler, mas sem lancar: devolve false e deixa a mensagem em Erro.</summary>
        public bool TentarLer(out Dictionary<string, object> dados)
        {
            try { dados = Ler(); Erro = null; return true; }
            catch (Exception e) { dados = null; Erro = e.Message; return false; }
        }

        /// <summary>Le so ate o campo de primeiro nivel pedido (por exemplo "m_Name", "m_Script"); null se nao existir
        /// ou se der erro.</summary>
        public object LerCampo(string nome)
        {
            try
            {
                var raiz = Raiz;
                if (raiz == null) return null;
                int alvo = -1;
                for (int i = 0; i < raiz.Filhos.Count; i++) if (raiz.Filhos[i].Nome == nome) { alvo = i; break; }
                if (alvo < 0) return null;
                var la = new LeitorArvore(NovoLeitor(), Arquivo);
                for (int i = 0; i < alvo; i++) la.Ler(raiz.Filhos[i]);
                return la.Ler(raiz.Filhos[alvo]);
            }
            catch { return null; }
        }

        string _nome; bool _temNome;
        /// <summary>m_Name do objeto (null se o tipo nao tiver).</summary>
        public string Nome
        {
            get
            {
                if (!_temNome) { _nome = LerCampo("m_Name") as string; _temNome = true; }
                return _nome;
            }
        }

        public override string ToString() => Tipo + " " + PathId;

        public static string NomeDaClasse(int classId)
        {
            switch (classId)
            {
                case 1: return "GameObject";
                case 4: return "Transform";
                case 21: return "Material";
                case 23: return "MeshRenderer";
                case 28: return "Texture2D";
                case 33: return "MeshFilter";
                case 43: return "Mesh";
                case 48: return "Shader";
                case 49: return "TextAsset";
                case 74: return "AnimationClip";
                case 83: return "AudioClip";
                case 114: return "MonoBehaviour";
                case 115: return "MonoScript";
                case 142: return "AssetBundle";
                case 150: return "PreloadData";
                case 213: return "Sprite";
                case 224: return "RectTransform";
                default: return "Class" + classId;
            }
        }
    }

    /// <summary>Interpreta os bytes de um objeto segundo a arvore de tipos.</summary>
    sealed class LeitorArvore
    {
        readonly Leitor r;
        readonly ArquivoSerializado arq;
        bool temRegistro;

        public LeitorArvore(Leitor leitor, ArquivoSerializado arquivo) { r = leitor; arq = arquivo; }

        public object Ler(NoTipo n)
        {
            object v;
            switch (n.Kind)
            {
                case NoTipo.K.S8: v = (long)(sbyte)r.U8(); break;
                case NoTipo.K.U8: v = (long)r.U8(); break;
                case NoTipo.K.S16: v = (long)r.I16(); break;
                case NoTipo.K.U16: v = (long)r.U16(); break;
                case NoTipo.K.S32: v = (long)r.I32(); break;
                case NoTipo.K.U32: v = (long)r.U32(); break;
                case NoTipo.K.S64: v = r.I64(); break;
                case NoTipo.K.U64: v = r.U64(); break;
                case NoTipo.K.F32: v = r.F32(); break;
                case NoTipo.K.F64: v = r.F64(); break;
                case NoTipo.K.Bool: v = r.U8() != 0; break;
                case NoTipo.K.Str: v = LerString(); break;
                case NoTipo.K.Typeless:
                    {
                        int n2 = r.I32();
                        if (n2 < 0) throw new InvalidDataException("Tamanho negativo em TypelessData.");
                        v = r.Bytes(n2);
                        break;
                    }
                case NoTipo.K.Par:
                    {
                        var a = Ler(n.Filhos[0]);
                        var b = Ler(n.Filhos[1]);
                        v = new KeyValuePair<object, object>(a, b);
                        break;
                    }
                case NoTipo.K.Vetor: v = LerVetor(n.Elemento); break;
                case NoTipo.K.RefObj: v = LerRefObj(n); break;
                default: v = LerClasse(n); break;
            }
            if (n.AlinharDepois) r.Alinhar(4);
            return v;
        }

        string LerString()
        {
            int len = r.I32();
            if (len > 0 && len <= r.Fim - r.Pos)
            {
                var s = Encoding.UTF8.GetString(r.B, r.Pos, len);
                r.Pos += len;
                r.Alinhar(4);
                return s;
            }
            if (len != 0) throw new InvalidDataException("Tamanho de string invalido: " + len);
            return "";
        }

        object LerVetor(NoTipo el)
        {
            int n = r.I32();
            if (n < 0) throw new InvalidDataException("Tamanho negativo de vetor.");
            if (el.Kind == NoTipo.K.U8 && !el.AlinharDepois) return r.Bytes(n);
            // cada elemento ocupa pelo menos 1 byte (exceto estruturas vazias): evita alocar listas absurdas
            if (n > r.Fim - r.Pos && !(el.Kind == NoTipo.K.Classe && el.Filhos.Count == 0))
                throw new InvalidDataException("Vetor maior que o objeto: " + n);
            var l = new List<object>(n);
            for (int i = 0; i < n; i++) l.Add(Ler(el));
            return l;
        }

        Dictionary<string, object> LerClasse(NoTipo n)
        {
            var d = new Dictionary<string, object>(n.Filhos.Count);
            bool antes = temRegistro;
            foreach (var f in n.Filhos)
            {
                if (f.Kind == NoTipo.K.Registro)
                {
                    if (temRegistro) continue;
                    temRegistro = true;
                }
                d[f.Nome] = Ler(f);
            }
            temRegistro = antes;
            return d;
        }

        Dictionary<string, object> LerRefObj(NoTipo n)
        {
            var d = new Dictionary<string, object>(n.Filhos.Count);
            foreach (var f in n.Filhos)
            {
                if (f.Tipo == "ReferencedObjectData")
                {
                    var tipo = d.TryGetValue("type", out var t) ? t as Dictionary<string, object> : null;
                    string cls = null, ns = null, asm = null;
                    if (tipo != null)
                    {
                        tipo.TryGetValue("class", out var c); cls = c as string;
                        tipo.TryGetValue("ns", out var s); ns = s as string;
                        tipo.TryGetValue("asm", out var a); asm = a as string;
                    }
                    if (string.IsNullOrEmpty(cls)) continue;
                    d[f.Nome] = Ler(arq.NoReferenciado(cls, ns, asm));
                }
                else d[f.Nome] = Ler(f);
            }
            return d;
        }
    }

    /// <summary>Leitor binario com endianness configuravel sobre uma janela de um byte[].</summary>
    sealed class Leitor
    {
        public readonly byte[] B;
        public int Pos;
        public readonly int Fim;
        public bool BigEndian;
        readonly byte[] _t = new byte[8];

        public Leitor(byte[] b, int ini, int fim, bool bigEndian) { B = b; Pos = ini; Fim = fim; BigEndian = bigEndian; }

        void Checar(int n)
        {
            if (n < 0 || Pos + n > Fim) throw new InvalidDataException("Leitura alem do fim (" + (Pos + n) + " > " + Fim + ").");
        }

        public void Pular(int n) { Checar(n); Pos += n; }

        public void Alinhar(int a)
        {
            int resto = Pos % a;
            if (resto != 0) Pos += a - resto; // alinhar alem do fim so falha na proxima leitura (ou na checagem final)
        }

        public byte U8() { Checar(1); return B[Pos++]; }

        public ushort U16()
        {
            Checar(2);
            int p = Pos; Pos += 2;
            return BigEndian ? (ushort)((B[p] << 8) | B[p + 1]) : (ushort)(B[p] | (B[p + 1] << 8));
        }

        public short I16() => (short)U16();

        public uint U32()
        {
            Checar(4);
            int p = Pos; Pos += 4;
            return BigEndian
                ? ((uint)B[p] << 24) | ((uint)B[p + 1] << 16) | ((uint)B[p + 2] << 8) | B[p + 3]
                : B[p] | ((uint)B[p + 1] << 8) | ((uint)B[p + 2] << 16) | ((uint)B[p + 3] << 24);
        }

        public int I32() => (int)U32();

        public ulong U64()
        {
            ulong a = U32(), b = U32();
            return BigEndian ? (a << 32) | b : (b << 32) | a;
        }

        public long I64() => (long)U64();

        public float F32()
        {
            uint u = U32();
            _t[0] = (byte)u; _t[1] = (byte)(u >> 8); _t[2] = (byte)(u >> 16); _t[3] = (byte)(u >> 24);
            if (!BitConverter.IsLittleEndian) Array.Reverse(_t, 0, 4);
            return BitConverter.ToSingle(_t, 0);
        }

        public double F64() => BitConverter.Int64BitsToDouble(I64());

        public byte[] Bytes(int n)
        {
            Checar(n);
            var b = new byte[n];
            Buffer.BlockCopy(B, Pos, b, 0, n);
            Pos += n;
            return b;
        }

        public string StringNula()
        {
            int e = Pos;
            while (e < Fim && B[e] != 0) e++;
            if (e >= Fim) throw new InvalidDataException("String sem terminador.");
            var s = Encoding.UTF8.GetString(B, Pos, e - Pos);
            Pos = e + 1;
            return s;
        }
    }

    /// <summary>Tabela de strings comuns do Unity (CommonString): o bit 31 do offset na arvore de tipos indica que o nome
    /// vem daqui, pelo deslocamento em bytes dentro deste buffer de strings terminadas em zero.</summary>
    static class StringsComuns
    {
        const string Tabela =
            "AABB|AnimationClip|AnimationCurve|AnimationState|Array|Base|BitField|bitset|bool|char|ColorRGBA|Component|" +
            "data|deque|double|dynamic_array|FastPropertyName|first|float|Font|GameObject|Generic Mono|GradientNEW|GUID|" +
            "GUIStyle|int|list|long long|map|Matrix4x4f|MdFour|MonoBehaviour|MonoScript|m_ByteSize|m_Curve|" +
            "m_EditorClassIdentifier|m_EditorHideFlags|m_Enabled|m_ExtensionPtr|m_GameObject|m_Index|m_IsArray|m_IsStatic|" +
            "m_MetaFlag|m_Name|m_ObjectHideFlags|m_PrefabInternal|m_PrefabParentObject|m_Script|m_StaticEditorFlags|m_Type|" +
            "m_Version|Object|pair|PPtr<Component>|PPtr<GameObject>|PPtr<Material>|PPtr<MonoBehaviour>|PPtr<MonoScript>|" +
            "PPtr<Object>|PPtr<Prefab>|PPtr<Sprite>|PPtr<TextAsset>|PPtr<Texture>|PPtr<Texture2D>|PPtr<Transform>|Prefab|" +
            "Quaternionf|Rectf|RectInt|RectOffset|second|set|short|size|SInt16|SInt32|SInt64|SInt8|staticvector|string|" +
            "TextAsset|TextMesh|Texture|Texture2D|Transform|TypelessData|UInt16|UInt32|UInt64|UInt8|unsigned int|" +
            "unsigned long long|unsigned short|vector|Vector2f|Vector3f|Vector4f|m_ScriptingClassIdentifier|Gradient|Type*|" +
            "int2_storage|int3_storage|BoundsInt|m_CorrespondingSourceObject|m_PrefabInstance|m_PrefabAsset|FileSize|" +
            "Hash128|RenderingLayerMask|fixed_array|EntityId|LoadableObjectId|LoadableSceneId";

        static Dictionary<int, string> _mapa;

        public static string Obter(int offset)
        {
            if (_mapa == null)
            {
                var m = new Dictionary<int, string>();
                int pos = 0;
                foreach (var s in Tabela.Split('|')) { m[pos] = s; pos += Encoding.UTF8.GetByteCount(s) + 1; }
                _mapa = m;
            }
            return _mapa.TryGetValue(offset, out var v) ? v : offset.ToString();
        }
    }
}
