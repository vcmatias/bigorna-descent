#!/usr/bin/env python3
"""Monta o editor num unico HTML que abre sem servidor: dist/Contra3-Editor.html.
O editor tambem abre direto de editor/index.html; este arquivo unico e o que vai nos lancamentos."""
import os, re
AQUI = os.path.dirname(os.path.abspath(__file__))
ED = os.path.join(AQUI, "editor")
html = open(os.path.join(ED, "index.html"), encoding="utf-8").read()
ler = lambda c: open(os.path.join(ED, c), encoding="utf-8").read()
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: "<style>\n" + ler(m.group(1)) + "</style>", html)
html = re.sub(r'<script src="([^"]+)"></script>', lambda m: "<script>\n" + ler(m.group(1)).replace("</script", "<\\/script") + "</script>", html)
os.makedirs(os.path.join(AQUI, "dist"), exist_ok=True)
destino = os.path.join(AQUI, "dist", "Contra3-Editor.html")
open(destino, "w", encoding="utf-8").write(html)
print(destino, len(html), "bytes")
