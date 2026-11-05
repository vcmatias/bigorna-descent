#!/usr/bin/env bash
# Bigorna, instalador para Linux (o jogo pela Steam com Proton). Faz o mesmo que o Install-Bigorna.bat do Windows:
#   1. acha a pasta do jogo na Steam (ou usa a que voce der com --jogo PASTA);
#   2. copia Bigorna.dll para "Legends of the Dark_Data/Managed" e registra o mod em ScriptingAssemblies.json e
#      RuntimeInitializeOnLoads.json, as duas listas que o jogo le ao abrir (copia de seguranca *.bigorna-bak na
#      primeira vez);
#   3. poe o editor (Bigorna-Salas.html) na pasta Editor dos dados do jogo, dentro do prefixo do Proton.
# Uso:  bash install-bigorna.sh [--jogo PASTA] [--lingua pt|en] [--desinstalar]
# Precisa de python3. Nada e baixado da internet; fora da pasta do jogo, so mexe na pasta Editor dos dados do jogo.
#
# Bigorna, Linux installer (the game on Steam with Proton). Does what Install-Bigorna.bat does on Windows.
# Usage: bash install-bigorna.sh [--game FOLDER] [--lang pt|en] [--uninstall]
set -e
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then echo "Bigorna: python3 is required (install it with your package manager)."; exit 1; fi
exec python3 - "$AQUI" "$@" <<'PYTHON'
import json, os, re, shutil, sys

AQUI, args = sys.argv[1], sys.argv[2:]
APPID = '1611070'
JOGO_NOME = 'Legends of the Dark'
DADOS_REL = os.path.join('pfx', 'drive_c', 'users', 'steamuser', 'AppData', 'LocalLow', 'Fantasy Flight Games', 'Descent - Legends of the Dark')

def opcao(*nomes):
    for n in nomes:
        if n in args:
            i = args.index(n)
            return args[i + 1] if i + 1 < len(args) else ''
    return None
lingua = (opcao('--lingua', '--lang') or os.environ.get('LANG', 'en')[:2]).lower()
lingua = 'pt' if lingua.startswith('pt') else 'en'
L = lambda pt, en: pt if lingua == 'pt' else en
desinstalar = '--desinstalar' in args or '--uninstall' in args

def bibliotecas():
    """As bibliotecas da Steam (a principal e as de libraryfolders.vdf), na instalacao comum e na Flatpak."""
    casa = os.path.expanduser('~')
    raizes = [os.path.join(casa, '.steam', 'steam'), os.path.join(casa, '.steam', 'root'), os.path.join(casa, '.local', 'share', 'Steam'),
              os.path.join(casa, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'), os.path.join(casa, 'snap', 'steam', 'common', '.local', 'share', 'Steam')]
    vistas = []
    for r in raizes:
        if not os.path.isdir(r): continue
        r = os.path.realpath(r)
        if r not in vistas: vistas.append(r)
        vdf = os.path.join(r, 'steamapps', 'libraryfolders.vdf')
        if os.path.exists(vdf):
            for p in re.findall(r'"path"\s+"([^"]+)"', open(vdf, encoding='utf-8', errors='replace').read()):
                p = os.path.realpath(p.replace('\\\\', '\\'))
                if p not in vistas: vistas.append(p)
    return vistas

def achar_jogo():
    dado = opcao('--jogo', '--game')
    if dado: return os.path.realpath(os.path.expanduser(dado)), None
    for b in bibliotecas():
        j = os.path.join(b, 'steamapps', 'common', JOGO_NOME)
        if os.path.isdir(os.path.join(j, JOGO_NOME + '_Data')): return j, b
    return None, None

def pasta_de_dados(jogo, biblioteca):
    """A pasta de dados do jogo dentro do prefixo do Proton (compatdata/1611070), na biblioteca do jogo ou em outra."""
    candidatas = []
    if biblioteca: candidatas.append(os.path.join(biblioteca, 'steamapps', 'compatdata', APPID))
    candidatas.append(os.path.join(os.path.dirname(os.path.dirname(jogo)), 'compatdata', APPID))
    for b in bibliotecas(): candidatas.append(os.path.join(b, 'steamapps', 'compatdata', APPID))
    for c in candidatas:
        if os.path.isdir(os.path.join(c, 'pfx')): return os.path.join(c, DADOS_REL)
    return None

def ler(f): return json.load(open(f, encoding='utf-8-sig'))
def gravar(f, o):
    tmp = f + '.tmp-bigorna'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as s: json.dump(o, s, indent=2, ensure_ascii=False)
    os.replace(tmp, f)

def registrar(dados_do_jogo, instalar):
    """As duas listas do jogo sem o Bigorna e, na instalacao, com o Bigorna no fim (como o instalador do Windows)."""
    sa, ro = os.path.join(dados_do_jogo, 'ScriptingAssemblies.json'), os.path.join(dados_do_jogo, 'RuntimeInitializeOnLoads.json')
    for f in (sa, ro):
        if not os.path.exists(f + '.bigorna-bak'): shutil.copy2(f, f + '.bigorna-bak')
    a, r = ler(sa), ler(ro)
    nomes, tipos = list(a.get('names') or []), list(a.get('types') or [])
    pares = [(n, t) for n, t in zip(nomes, tipos) if n != 'Bigorna.dll']
    raiz = [x for x in (r.get('root') or []) if x.get('assemblyName') != 'Bigorna']
    if instalar:
        pares.append(('Bigorna.dll', 16))
        raiz.append({'assemblyName': 'Bigorna', 'nameSpace': 'Bigorna', 'className': 'Bootstrap', 'methodName': 'Init', 'loadTypes': 1, 'isUnityClass': False})
    a['names'], a['types'], r['root'] = [p[0] for p in pares], [p[1] for p in pares], raiz
    gravar(sa, a); gravar(ro, r)

jogo, biblioteca = achar_jogo()
if not jogo or not os.path.isdir(os.path.join(jogo, JOGO_NOME + '_Data')):
    print(L('Bigorna: não achei o jogo na Steam. Rode de novo com a pasta dele: bash install-bigorna.sh --jogo "<pasta de Legends of the Dark>"',
            'Bigorna: the game was not found in Steam. Run again with its folder: bash install-bigorna.sh --game "<Legends of the Dark folder>"'))
    sys.exit(1)
dados_do_jogo = os.path.join(jogo, JOGO_NOME + '_Data'); managed = os.path.join(dados_do_jogo, 'Managed')
for f in ('ScriptingAssemblies.json', 'RuntimeInitializeOnLoads.json'):
    if not os.path.exists(os.path.join(dados_do_jogo, f)): print(L('Bigorna: falta ' + f + ' em ' + dados_do_jogo, 'Bigorna: ' + f + ' is missing in ' + dados_do_jogo)); sys.exit(1)
print(L('Jogo: ', 'Game: ') + jogo)

if desinstalar:
    registrar(dados_do_jogo, False)
    dll = os.path.join(managed, 'Bigorna.dll')
    if os.path.exists(dll): os.replace(dll, dll + '.off')
    print(L('Bigorna removido das listas do jogo, e a DLL desligada (Bigorna.dll.off). Os seus mapas ficam onde estão.',
            'Bigorna removed from the game lists, and the DLL turned off (Bigorna.dll.off). Your maps stay where they are.'))
    sys.exit(0)

src = os.path.join(AQUI, 'Bigorna.dll')
if not os.path.exists(src): print(L('Bigorna: a Bigorna.dll precisa estar ao lado deste instalador (' + AQUI + ').', 'Bigorna: Bigorna.dll must be next to this installer (' + AQUI + ').')); sys.exit(1)
shutil.copy2(src, os.path.join(managed, 'Bigorna.dll'))
off = os.path.join(managed, 'Bigorna.dll.off')
if os.path.exists(off): os.remove(off)
registrar(dados_do_jogo, True)
print('Bigorna.dll -> ' + os.path.join(managed, 'Bigorna.dll'))
print(L('Bigorna registrado nas listas do jogo (cópias de segurança: *.bigorna-bak).', 'Bigorna registered in the game lists (backups: *.bigorna-bak).'))

dados = pasta_de_dados(jogo, biblioteca)
editor_src = os.path.join(AQUI, 'Bigorna-Salas.html')
if dados and os.path.exists(editor_src):
    pasta_editor = os.path.join(dados, 'Editor'); os.makedirs(pasta_editor, exist_ok=True)
    shutil.copy2(editor_src, os.path.join(pasta_editor, 'Bigorna-Salas.html'))
    open(os.path.join(pasta_editor, 'bigorna-idioma.js'), 'w', encoding='utf-8').write('window.BIGORNA_IDIOMA = "' + lingua + '";\n')
    print(L('Editor: ', 'Editor: ') + os.path.join(pasta_editor, 'Bigorna-Salas.html'))
else:
    print(L('O prefixo do Proton ainda não existe: abra o jogo uma vez pela Steam; o mod põe o editor na tela de título.',
            'The Proton prefix does not exist yet: start the game once through Steam; the mod puts the editor in place on the title screen.'))
print()
print(L('Pronto. Abra o jogo pela Steam e espere na tela de título enquanto o mod lê a sua cópia (alguns minutos na primeira vez).',
        'Done. Start the game through Steam and wait on the title screen while the mod reads your copy (a few minutes the first time).'))
print(L('O editor e o gerador do mapa oneshot abrem no Chrome ou no Chromium (o Firefox não grava em pastas). Rode este instalador de novo depois de uma atualização do jogo.',
        'The editor and the one-shot map generator open in Chrome or Chromium (Firefox cannot write to folders). Run this installer again after a game update.'))
PYTHON
