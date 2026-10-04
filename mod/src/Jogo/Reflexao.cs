using System;
using System.Reflection;

namespace Bigorna
{
    /// <summary>Campos dos modelos do jogo que nao sao publicos: procurados na classe e nas classes base.</summary>
    public static class Reflexao
    {
        public const BindingFlags Privados = BindingFlags.Instance | BindingFlags.NonPublic;
        public const BindingFlags Todos = Privados | BindingFlags.Public;

        public static FieldInfo Campo(Type t, string nome, BindingFlags flags = Todos)
        {
            for (; t != null; t = t.BaseType) { var f = t.GetField(nome, flags); if (f != null) return f; }
            return null;
        }

        public static object Ler(object obj, string campo, BindingFlags flags = Todos) => Campo(obj.GetType(), campo, flags)?.GetValue(obj);

        /// <summary>Poe o valor no campo; um campo que nao existe fica no log.</summary>
        public static void Por(object obj, string campo, object valor, BindingFlags flags = Todos)
        {
            var f = Campo(obj.GetType(), campo, flags);
            if (f == null) Log.Info("campo «" + campo + "» não existe em " + obj.GetType().Name);
            else f.SetValue(obj, valor);
        }
    }
}
