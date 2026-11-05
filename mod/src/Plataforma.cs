using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace Bigorna
{
    /// <summary>v278: onde o jogo roda. No Linux, pela Steam com o Proton, o jogo é o mesmo do Windows e roda no Wine: o mod
    /// funciona igual, mas o aplicativo Bigorna Editor (que usa o WebView2) não abre lá, e o gerador do mapa oneshot vai pela
    /// ponte do navegador. No Windows, Wine é sempre false e nada muda.</summary>
    public static class Plataforma
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandleW(string nome);
        [DllImport("kernel32.dll", CharSet = CharSet.Ansi)] static extern IntPtr GetProcAddress(IntPtr modulo, string nome);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, EntryPoint = "wine_get_unix_file_name")] static extern IntPtr WineCaminhoUnix(string caminho);
        [DllImport("kernel32.dll")] static extern IntPtr GetProcessHeap();
        [DllImport("kernel32.dll")] static extern bool HeapFree(IntPtr heap, uint flags, IntPtr p);

        static bool? _wine;
        /// <summary>O jogo roda no Wine (o Proton da Steam, no Linux): o ntdll do Wine tem wine_get_version, o do Windows não.</summary>
        public static bool Wine
        {
            get
            {
                if (_wine.HasValue) return _wine.Value;
                try { var nt = GetModuleHandleW("ntdll.dll"); _wine = nt != IntPtr.Zero && GetProcAddress(nt, "wine_get_version") != IntPtr.Zero; }
                catch { _wine = false; }
                return _wine.Value;
            }
        }

        /// <summary>O caminho no Linux de um caminho do Windows (no Wine); fora dele, ou se não der, o próprio caminho.</summary>
        public static string CaminhoNoSistema(string caminho)
        {
            if (!Wine || string.IsNullOrEmpty(caminho)) return caminho;
            try
            {
                var p = WineCaminhoUnix(caminho.Replace('/', '\\'));
                if (p == IntPtr.Zero) return caminho;
                var bytes = new List<byte>(); for (int i = 0; ; i++) { byte b = Marshal.ReadByte(p, i); if (b == 0) break; bytes.Add(b); }
                try { HeapFree(GetProcessHeap(), 0, p); } catch { }
                var r = System.Text.Encoding.UTF8.GetString(bytes.ToArray());
                return string.IsNullOrEmpty(r) ? caminho : r;
            }
            catch { return caminho; }
        }
    }
}
