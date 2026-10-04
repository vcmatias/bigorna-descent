using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FFG.Core;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace Bigorna.Dados
{
    /// <summary>
    /// Converte um modelo do jogo (ScriptableObject) em JSON com os mesmos campos que o Unity grava: publicos e
    /// [SerializeField], das classes base para as derivadas. Enumeracoes viram numeros, booleanos viram 0/1 e uma
    /// referencia a outro objeto vira {ref, cls, id}. E o formato que o editor le.
    /// </summary>
    public static class Serial
    {
        const int Fundo = 10;
        static readonly Dictionary<Type, FieldInfo[]> _campos = new Dictionary<Type, FieldInfo[]>();

        /// <summary>Objetos referenciados durante a conversao (para achar, por exemplo, as habilidades das pecas de arma).</summary>
        public static readonly HashSet<UnityEngine.Object> Vistos = new HashSet<UnityEngine.Object>();

        public static JObject Modelo(UnityEngine.Object o, ICollection<string> fora = null)
        {
            var j = Campos(o, 0, fora);
            j["_name"] = o.name;
            return j;
        }

        static JObject Campos(object o, int fundo, ICollection<string> fora = null)
        {
            var j = new JObject();
            foreach (var f in CamposDe(o.GetType()))
            {
                if (fora != null && fora.Contains(f.Name)) continue;
                object v;
                try { v = f.GetValue(o); } catch { continue; }
                var t = Valor(v, f.FieldType, fundo);
                if (t != null) j[f.Name] = t;
            }
            return j;
        }

        static JToken Valor(object v, Type t, int fundo)
        {
            if (v == null) return JValue.CreateNull();
            var tv = v.GetType();
            if (v is UnityEngine.Object uo) return Ref(uo);
            if (tv.IsEnum) return new JValue(Convert.ToInt64(v));
            if (v is bool b) return new JValue(b ? 1 : 0);
            if (v is string s) return new JValue(s);
            if (v is float fl) return new JValue(Math.Round(fl, 6));
            if (v is double db) return new JValue(db);
            if (tv.IsPrimitive) return new JValue(v);
            switch (v)
            {
                case Vector2 a: return new JObject { ["x"] = a.x, ["y"] = a.y };
                case Vector3 a: return new JObject { ["x"] = a.x, ["y"] = a.y, ["z"] = a.z };
                case Vector4 a: return new JObject { ["x"] = a.x, ["y"] = a.y, ["z"] = a.z, ["w"] = a.w };
                case Vector2Int a: return new JObject { ["x"] = a.x, ["y"] = a.y };
                case Vector3Int a: return new JObject { ["x"] = a.x, ["y"] = a.y, ["z"] = a.z };
                case Color a: return new JObject { ["r"] = a.r, ["g"] = a.g, ["b"] = a.b, ["a"] = a.a };
                case Color32 a: return new JObject { ["r"] = a.r, ["g"] = a.g, ["b"] = a.b, ["a"] = a.a };
                case Quaternion a: return new JObject { ["x"] = a.x, ["y"] = a.y, ["z"] = a.z, ["w"] = a.w };
                case Rect a: return new JObject { ["x"] = a.x, ["y"] = a.y, ["width"] = a.width, ["height"] = a.height };
                case LayerMask a: return new JValue(a.value);
                case AnimationCurve _: return null;
                case Gradient _: return null;
            }
            if (fundo >= Fundo) return null;
            if (v is IList lista)
            {
                var el = ElementoDe(tv);
                if (el == null) return null;
                var arr = new JArray();
                foreach (var x in lista) { var k = Valor(x, el, fundo + 1); if (k != null) arr.Add(k); }
                return arr;
            }
            if (Serializavel(tv)) return Campos(v, fundo + 1);
            return null;
        }

        static JToken Ref(UnityEngine.Object o)
        {
            if (o == null) return JValue.CreateNull();   // referencia perdida (o operador == do Unity)
            Vistos.Add(o);
            return new JObject { ["ref"] = o.name, ["cls"] = o.GetType().Name, ["id"] = o is ModelBase m ? m.Id : null };
        }

        static Type ElementoDe(Type t)
        {
            if (t.IsArray) return t.GetElementType();
            if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(List<>)) return t.GetGenericArguments()[0];
            return null;
        }

        static bool Serializavel(Type t)
        {
            if (t.IsAbstract || t.IsInterface || t.IsGenericType) return false;
            if (!t.IsValueType && !t.IsClass) return false;
            if (typeof(Delegate).IsAssignableFrom(t)) return false;
            return t.IsSerializable || t.GetCustomAttributes(typeof(SerializableAttribute), false).Length > 0;
        }

        static bool CampoAceito(FieldInfo f)
        {
            if (f.IsStatic || f.IsLiteral || f.IsInitOnly || f.IsNotSerialized) return false;
            if (f.IsDefined(typeof(SerializeReference), false)) return false;
            if (!f.IsPublic && !f.IsDefined(typeof(SerializeField), false)) return false;
            var t = f.FieldType;
            if (t.IsPointer || typeof(Delegate).IsAssignableFrom(t)) return false;
            if (t.IsGenericType && t.GetGenericTypeDefinition() != typeof(List<>)) return false;
            return true;
        }

        static FieldInfo[] CamposDe(Type t)
        {
            if (_campos.TryGetValue(t, out var c)) return c;
            var tipos = new List<Type>();
            for (var x = t; x != null && x != typeof(object) && x != typeof(ScriptableObject) && x != typeof(MonoBehaviour) && x != typeof(Behaviour)
                 && x != typeof(Component) && x != typeof(UnityEngine.Object) && x != typeof(ValueType); x = x.BaseType)
                tipos.Insert(0, x);
            var lista = new List<FieldInfo>();
            var nomes = new HashSet<string>();
            foreach (var x in tipos)
                foreach (var f in x.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
                    if (CampoAceito(f) && nomes.Add(f.Name)) lista.Add(f);
            return _campos[t] = lista.ToArray();
        }

        /// <summary>So as chaves pedidas, na ordem pedida.</summary>
        public static JObject So(JObject j, params string[] chaves)
        {
            var r = new JObject();
            foreach (var k in chaves) if (j.TryGetValue(k, out var v)) r[k] = v; else r[k] = JValue.CreateNull();
            return r;
        }

        /// <summary>O id de uma referencia serializada ({ref, cls, id}).</summary>
        public static string IdDe(JToken t) => t is JObject o ? (string)o["id"] : null;
    }
}
