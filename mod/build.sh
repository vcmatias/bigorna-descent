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
# o editor publico (sem nada do jogo) vai embutido: o mod o grava na pasta Editor dos dados do jogo
python3 ../editor/salas/montar_salas.py --publico >/dev/null
EDITOR=../editor/dist/publico/Bigorna-Salas.html
dotnet "$CSC" -nologo -target:library -out:out/Bigorna.dll -langversion:8.0 -nullable:disable -optimize+ -debug:portable \
  -nowarn:CS1701,CS1702,CS0618 -define:BIGORNA -resource:"$EDITOR",Bigorna.Salas.html \
  $R $(find src -name '*.cs' | sort)
echo "Bigorna $VERSAO -> out/Bigorna.dll ($(stat -c %s out/Bigorna.dll) bytes)"
