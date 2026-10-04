#!/usr/bin/env python3
"""Monta o Bigorna Rooms num unico HTML.

  python3 montar_salas.py            -> dist/Bigorna-Salas.html, a copia de trabalho de Victor, com os dados do jogo
                                        embutidos (uso pessoal; nunca publicar)
  python3 montar_salas.py --publico  -> dist/publico/Bigorna-Salas.html, sem nada do jogo: le bigorna-game-data.js e
                                        bigorna-worldmap.js, que o mod grava ao lado dele a partir da copia do jogo
                                        de quem joga (e o que vai embutido na DLL)
  python3 montar_salas.py --teste DIR -> a versao publica em DIR, com os arquivos de dados ao lado (para os testes)

Os dados embutidos na copia de trabalho vem de dados/jogo/ (os arquivos que o mod gerou na maquina de Victor), ou,
enquanto eles nao existem, dos catalogos antigos de dados/ (arrumados no mesmo formato).
"""
import json, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, "..", "dados")
DIST = os.path.join(AQUI, "..", "dist")

PARTES = (("IDIOMA", "idioma.js"), ("IDIOMA_PT", "idioma_pt.js"), ("JOGO", "jogo.js"), ("CONFIG", os.path.join("..", "comum", "config.js")), ("BASE", "base.js"), ("DESENHO", "desenho.js"), ("TEXTURAS", "texturas.js"), ("PAPELAO", "papelao.js"), ("TRES", "tres.js"),
          ("INTERFACE", "interface.js"), ("GATILHOS", "gatilhos.js"), ("FICHAS", "fichas.js"), ("HEROIS", "herois.js"), ("ARMAS", "armas.js"),
          ("RECEITAS", "receitas.js"), ("FACANHAS", "facanhas.js"), ("PERICIAS", "pericias.js"), ("PACOTES", "pacotes.js"), ("CAMPANHA", "campanha.js"), ("HISTORIAS", "historias.js"), ("NARRATIVA", "narrativa.js"), ("OFICINA_HISTORIAS", "oficina_historias.js"), ("GERADOR", "gerador.js"), ("GERADOR_MAPAS", "gerador_mapas.js"), ("SIMULADOR", "simulador.js"), ("EXPORTAR", "exportar.js"), ("TUTORIAL", "tutorial.js"))

# icone proprio: uma bigorna com um martelo, desenhada aqui
ICONE = ("data:image/svg+xml," + "".join("""<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
<rect width='64' height='64' rx='12' fill='%231b1d22'/>
<path d='M10 26h34c0 6 5 9 12 9-2 4-8 6-15 6l-3 5h6v6H20v-6h6l-3-5c-7-1-13-6-13-15z' fill='%23e0a458'/>
<path d='M30 8l14 8-3 5-14-8z' fill='%23f3cf8f'/><path d='M34 17l3 2-8 14-3-2z' fill='%23a8743a'/>
</svg>""".split("\n")))


def ler_js_de_dados(caminho):
    """O objeto de um arquivo do mod ("window.X = {...};")."""
    t = open(caminho, encoding="utf-8").read()
    return json.loads(t[t.index("{"):t.rindex("}") + 1])


def jogo_do_legado():
    """Os catalogos antigos de dados/ no formato do arquivo que o mod grava."""
    data = json.load(open(os.path.join(DADOS, "DATA.json"), encoding="utf-8"))
    mundo = json.load(open(os.path.join(DADOS, "WORLD.json"), encoding="utf-8"))
    arte = json.load(open(os.path.join(DADOS, "ASSETS.json"), encoding="utf-8"))
    catalogo = json.load(open(os.path.join(DADOS, "CATALOGO.json"), encoding="utf-8"))
    cat_min = {"monstros": catalogo["monstros"], "ativacoes": catalogo["ativacoes"],
               "itens": [i for i in catalogo["itens"] if i.get("_cls") in ("ArmorModel", "TrinketModel", "ConsumableModel", "CraftingMaterialModel", "WeaponPartsModel", "WeaponAbilityModel", "WeaponModel")],
               "receitas": [{k: r.get(k) for k in ("_id", "_act", "IsUpgrade", "BaseItemId", "Ingredients", "CraftedItemId", "Value", "TextureAssetPath")} for r in catalogo.get("receitas", [])],
               "loots": [{k: l.get(k) for k in ("_id", "name_en", "CommonMat1", "CommonMat2", "UncommonMat1", "UncommonMat2")} for l in catalogo.get("loots", [])],
               "personagens": catalogo["personagens"], "herois": [h for h in catalogo["herois"] if h.get("_cls") == "HeroModel"],
               "facanhas": [{k: f.get(k) for k in ("_id", "_act", "desc_en", "Goal", "HeroSource", "AmountCompletedRequired", "PrerequisiteFeats", "Rewards", "Timing", "WeaponClasses", "EnemyTypes", "ItemType", "HeroInjured", "InteractableType", "EnemyConditions", "GoalIsTotalDamage", "WeaknessDamage", "IsVictory", "MinimumDamage", "SameEnemy")} for f in catalogo["herois"] if f.get("_cls") == "FeatModel"],
               "habilidades": [{k: s.get(k) for k in ("_id", "Hero", "name_en", "XPCost")} for s in catalogo["herois"] if s.get("_cls") == "SkillModel"]}
    for lista in ("monstros", "itens", "personagens", "herois"):
        for x in cat_min[lista]:
            for k in ("desc_pt", "name_pt", "plural_pt", "m_Name", "SpawnSound", "AttackSound", "DefendSound", "DefeatSound", "DefaultLoot", "ColorLight", "ColorDark", "DamageCurve"):
                x.pop(k, None)
    destinos = lambda lista: [{"id": q["id"], "name": q["name"], "coords": q["coords"]} for q in lista if q.get("coords")]
    jogo = {"formato": 1, "jogo": "legado", "gerado": "", "bigorna": "",
            "tiles": [{k: t[k] for k in ("id", "kind", "w", "h", "cells", "act", "floor") if k in t} for t in data["tiles"]],
            "backgrounds": [{"id": b["id"], "key": b["key"], "name_en": b["name_en"]} for b in data["backgrounds"]],
            "sounds": json.load(open(os.path.join(DADOS, "SONS.json"), encoding="utf-8")),
            "cutscenes": json.load(open(os.path.join(DADOS, "CUTSCENES.json"), encoding="utf-8")),
            "destinos": {"quests": destinos(mundo.get("quests", [])), "narrativeEvents": destinos(mundo.get("narrativeEvents", []))},
            "catalogo": cat_min,
            "retratos": json.load(open(os.path.join(DADOS, "RETRATOS.json"), encoding="utf-8"))}
    mapa = {"act1": arte["worldmap"]} if arte.get("worldmap") else {}
    return jogo, mapa


def dados_de_trabalho():
    """Os dados da copia de trabalho: os que o mod gerou (dados/jogo/), senao os catalogos antigos."""
    pasta = os.environ.get("BIGORNA_DADOS_JOGO") or os.path.join(DADOS, "jogo")
    arq = os.path.join(pasta, "bigorna-game-data.js")
    if os.path.exists(arq):
        jogo = ler_js_de_dados(arq)
        m = os.path.join(pasta, "bigorna-worldmap.js")
        mapa = ler_js_de_dados(m) if os.path.exists(m) else {}
        mapa = {k: v for k, v in mapa.items() if k.startswith(("act", "cidade_"))}
        if not mapa.get("act1") and os.path.exists(os.path.join(DADOS, "ASSETS.json")):   # enquanto o jogo nao fotografou o mapa
            mapa = dict(mapa, act1=json.load(open(os.path.join(DADOS, "ASSETS.json"), encoding="utf-8")).get("worldmap", ""))
        return jogo, mapa, "dados/jogo (gerados pelo mod)"
    jogo, mapa = jogo_do_legado()
    return jogo, mapa, "catálogos antigos de dados/"


def retratos_em_webp(jogo):
    """Na copia de trabalho, os retratos (PNG no arquivo do mod) viram WebP: o HTML fica bem menor."""
    import base64, io
    try:
        from PIL import Image
    except ImportError:
        return
    for grupo in (jogo.get("retratos") or {}).values():
        for k, uri in list(grupo.items()):
            if not isinstance(uri, str) or not uri.startswith("data:image/png;base64,"): continue
            try:
                im = Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).convert("RGBA")
                b = io.BytesIO(); im.save(b, "WEBP", quality=80, method=4)
                grupo[k] = "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()
            except Exception:
                pass


def js(nome, obj):
    # "</" escapado: o texto vai dentro de um <script>
    return "window." + nome + " = " + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + ";"


def conferir_sintaxe():
    """node --check em cada parte (quando o node existe): um erro de sintaxe deixaria a pagina inteira sem editor."""
    import shutil, subprocess
    if not shutil.which("node"): return
    for _, arq in PARTES + (("CARREGADOR", "carregador.js"),):
        r = subprocess.run(["node", "--check", os.path.join(AQUI, arq)], capture_output=True, text=True)
        if r.returncode: sys.exit("erro de sintaxe em " + arq + ":\n" + r.stderr[:800])


def montar(saida, fontes):
    conferir_sintaxe()
    html = open(os.path.join(AQUI, "salas.html"), encoding="utf-8").read()
    html = html.replace("/*@@ICONE@@*/", ICONE, 1)
    html = html.replace("/*@@ESTILO@@*/", open(os.path.join(AQUI, "salas.css"), encoding="utf-8").read().rstrip("\n"), 1)
    html = html.replace("<!--@@FONTES@@-->", fontes, 1)
    for marca, arq in PARTES:
        codigo = open(os.path.join(AQUI, arq), encoding="utf-8").read().rstrip("\n")
        if "</script" in codigo.lower():
            sys.exit("«</script» em " + arq + ": o código vai dentro de um <script type=text/plain>")
        html = html.replace("/*@@" + marca + "@@*/", codigo, 1)
    html = html.replace("/*@@CARREGADOR@@*/", open(os.path.join(AQUI, "carregador.js"), encoding="utf-8").read().rstrip("\n"), 1)
    os.makedirs(os.path.dirname(os.path.abspath(saida)), exist_ok=True)
    with open(saida, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    print("montado:", saida, "(" + str(os.path.getsize(saida)) + " bytes)")


FONTES_PUBLICAS = '<script src="bigorna-idioma.js"></script>\n<script src="bigorna-game-data.js"></script>\n<script src="bigorna-worldmap.js"></script>'


def main():
    args = sys.argv[1:]
    if "--publico" in args:
        montar(os.path.join(DIST, "publico", "Bigorna-Salas.html"), FONTES_PUBLICAS)
        return
    if "--teste" in args:
        pasta = args[args.index("--teste") + 1]
        montar(os.path.join(pasta, "Bigorna-Salas.html"), FONTES_PUBLICAS)
        jogo, mapa, origem = dados_de_trabalho()
        with open(os.path.join(pasta, "bigorna-game-data.js"), "w", encoding="utf-8") as f: f.write("// teste\n// teste\n" + js("BIGORNA_JOGO", jogo) + "\n")
        if mapa:
            with open(os.path.join(pasta, "bigorna-worldmap.js"), "w", encoding="utf-8") as f: f.write("// teste\n" + js("BIGORNA_MAPA", mapa) + "\n")
        print("dados de teste de", origem)
        return
    jogo, mapa, origem = dados_de_trabalho()
    retratos_em_webp(jogo)
    fontes = "<script>\nwindow.BIGORNA_EMBUTIDO = true;\n" + js("BIGORNA_JOGO", jogo) + "\n" + js("BIGORNA_MAPA", mapa) + "\n</script>"
    montar(sys.argv[1] if len(args) == 1 and not args[0].startswith("--") else os.path.join(DIST, "Bigorna-Salas.html"), fontes)
    print("dados embutidos de", origem)


if __name__ == "__main__":
    main()
