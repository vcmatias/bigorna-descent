using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;

namespace Bigorna.Encontro
{
    /// <summary>Le um arquivo Wavefront OBJ (v, vt, vn, f; grupos e materiais ignorados) numa malha do Unity. O OBJ e destro
    /// e o Unity canhoto: o X troca de sinal e a ordem dos triangulos inverte. Poligonos viram leques de triangulos.</summary>
    public static class LeitorObj
    {
        static readonly CultureInfo C = CultureInfo.InvariantCulture;

        public static Mesh Ler(string arquivo)
        {
            var pos = new List<Vector3>(); var uvs = new List<Vector2>(); var nor = new List<Vector3>();
            var vPos = new List<Vector3>(); var vUv = new List<Vector2>(); var vNor = new List<Vector3>();
            var tri = new List<int>();
            var indice = new Dictionary<(int, int, int), int>();
            bool temUv = false, temNormal = false;
            var face = new List<int>(8);
            foreach (var linhaCrua in File.ReadLines(arquivo))
            {
                var linha = linhaCrua.Trim();
                if (linha.Length < 2 || linha[0] == '#') continue;
                var p = linha.Split((char[])null, StringSplitOptions.RemoveEmptyEntries);
                switch (p[0])
                {
                    case "v": pos.Add(new Vector3(-F(p, 1), F(p, 2), F(p, 3))); break;
                    case "vt": uvs.Add(new Vector2(F(p, 1), F(p, 2))); break;
                    case "vn": nor.Add(new Vector3(-F(p, 1), F(p, 2), F(p, 3))); break;
                    case "f":
                        face.Clear();
                        for (int i = 1; i < p.Length; i++)
                        {
                            var ids = p[i].Split('/');
                            int vi = Indice(ids[0], pos.Count);
                            int ti = ids.Length > 1 && ids[1].Length > 0 ? Indice(ids[1], uvs.Count) : -1;
                            int ni = ids.Length > 2 && ids[2].Length > 0 ? Indice(ids[2], nor.Count) : -1;
                            if (vi < 0 || vi >= pos.Count) continue;
                            var chave = (vi, ti, ni);
                            if (!indice.TryGetValue(chave, out var k))
                            {
                                k = vPos.Count; indice[chave] = k;
                                vPos.Add(pos[vi]);
                                vUv.Add(ti >= 0 && ti < uvs.Count ? uvs[ti] : Vector2.zero); if (ti >= 0) temUv = true;
                                vNor.Add(ni >= 0 && ni < nor.Count ? nor[ni] : Vector3.zero); if (ni >= 0) temNormal = true;
                            }
                            face.Add(k);
                        }
                        // leque, com a ordem invertida (o X trocou de sinal)
                        for (int i = 1; i + 1 < face.Count; i++) { tri.Add(face[0]); tri.Add(face[i + 1]); tri.Add(face[i]); }
                        break;
                }
            }
            if (vPos.Count == 0 || tri.Count == 0) throw new Exception("o arquivo não tem faces");
            var m = new Mesh { name = "Bigorna " + Path.GetFileName(arquivo) };
            if (vPos.Count > 65000) m.indexFormat = IndexFormat.UInt32;
            m.SetVertices(vPos);
            if (temUv) m.SetUVs(0, vUv);
            m.SetTriangles(tri, 0);
            if (temNormal) m.SetNormals(vNor); else m.RecalculateNormals();
            m.RecalculateBounds();
            return m;
        }

        static float F(string[] p, int i) => i < p.Length && float.TryParse(p[i], NumberStyles.Float, C, out var v) ? v : 0f;

        /// <summary>Indice do OBJ (comeca em 1; negativo conta do fim) para indice de lista.</summary>
        static int Indice(string s, int total)
        {
            if (!int.TryParse(s, NumberStyles.Integer, C, out var i)) return -1;
            return i > 0 ? i - 1 : total + i;
        }
    }
}
