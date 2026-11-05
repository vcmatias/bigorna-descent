#!/bin/bash
# Compila Bigorna.dll com o csc do SDK, referenciando as DLLs do proprio jogo (sem NuGet).
set -e
cd "$(dirname "$0")"
REFS=../refs
CSC=$(ls /usr/lib/dotnet/sdk/*/Roslyn/bincore/csc.dll | tail -1)
mkdir -p out
R=""
for f in "$REFS"/*.dll; do
  case "$(basename "$f")" in
    DescentForge.dll) continue;;   # nunca referenciar o mod antigo
  esac
  R="$R -r:$f"
done
VERSAO=$(cat VERSAO)
# a versao do pacote dentro da DLL (o aviso de atualizacao compara com a do GitHub)
echo "namespace Bigorna { static class VersaoDoPacote { public const string Texto = \"$VERSAO\"; } }" > out/VersaoDoPacote.cs
# o editor publico (sem nada do jogo) vai embutido: o mod o grava na pasta Editor dos dados do jogo
python3 ../editor/salas/montar_salas.py --publico >/dev/null
EDITOR=../editor/dist/publico/Bigorna-Salas.html
# o aplicativo Bigorna Editor (app/: a janela do editor, que grava os arquivos sem pedir) vai embutido tambem: o mod o grava
# na pasta Editor, ao lado do editor
bash ../app/build.sh >/dev/null
APP=()
for f in ../app/out/*; do APP+=("-resource:$f,Bigorna.App.$(basename "$f" | tr ' ' '_')"); done
# (v259: as tabelas dos textos do gerador de mapas nas linguas do jogo, para o mapa oneshot)
if [ -f ../tools/gerador_trad/montar.py ]; then python3 ../tools/gerador_trad/montar.py >/dev/null; fi   # (as tabelas do gerador, quando as fontes delas estão aqui)
for f in ../editor/dist/gerador/bigorna-gerador-*.js; do [ -e "$f" ] || continue; l=$(basename "$f" .js); APP+=("-resource:$f,Bigorna.Gerador.${l#bigorna-gerador-}.js"); done
dotnet "$CSC" -nologo -target:library -out:out/Bigorna.dll -langversion:8.0 -nullable:disable -optimize+ -debug:portable \
  -nowarn:CS1701,CS1702,CS0618 -define:BIGORNA -resource:"$EDITOR",Bigorna.Salas.html -resource:../editor/dist/publico/Bigorna-Gerador.html,Bigorna.PaginaDoGerador.html "${APP[@]}" \
  $R out/VersaoDoPacote.cs $(find src -name '*.cs' | sort)
echo "Bigorna $VERSAO -> out/Bigorna.dll ($(stat -c %s out/Bigorna.dll) bytes)"
