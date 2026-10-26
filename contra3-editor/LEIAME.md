# Contra III Editor

Editor de fases, inimigos e gráficos para *Contra III: The Alien Wars* (SNES, USA). Ele roda no navegador, sem
internet, e as edições que faz rodam no [Contra3Recomp](https://github.com/BrixW/Contra3Recomp).
[Read in English](README.md).

Projeto de fã, não oficial. *Contra III* pertence à Konami; este projeto não tem ligação com ela. Você precisa da
sua própria cópia do jogo.

## Nada do jogo é distribuído

O repositório só tem o código do editor. Ele lê a **sua** ROM no seu computador. Para compartilhar uma edição,
use o patch `.ips`: ele leva só os bytes que você mudou.

## O que já faz (0.1)

- **ROM.** Abre a ROM e confere se é a original (título, checksum e SHA-256).
- **Gráficos.**
  - Lista os gráficos comprimidos que o jogo carrega e descomprime cada um com o LZSS da Konami. A saída é idêntica
    à da rotina do próprio jogo.
  - Mostra os tiles a 2, 4 ou 8 bpp, com a paleta lida de um endereço da ROM.
  - Deixa pintar pixel a pixel e grava de volta, recomprimido, no mesmo lugar, se couber.
- **Sprites.** Mostra os quadros de sprite peça por peça.
- **Fases 1, 3, 4 e 6.**
  - Lista os inimigos de cada tela, com tipo, posição, momento em que nascem e parâmetro, e deixa editá-los.
  - Mostra como os tiles da fase se dividem em colisão: vazio, sólido, plataforma, rampa, escalar.
- **Exportar.** Gera o `.ips` ou a ROM editada, com o checksum corrigido, e a linha de comando para testar no
  recomp.

O que vem depois (o mapa inteiro das fases, mover inimigos com o mouse, espaço livre) está em
[docs/PLANO.md](docs/PLANO.md). Os formatos do jogo, com o grau de certeza de cada um, estão em
[docs/FORMATOS.md](docs/FORMATOS.md).

## Usar

1. Abra `editor/index.html` no Chrome ou no Edge. Para ter tudo num arquivo só, rode `python3 montar.py`, que gera
   `dist/Contra3-Editor.html`.
2. Clique em **Abrir ROM**, ou arraste a ROM para a janela.
3. Edite e exporte na aba **Exportar e testar**.
4. Para testar: `recomp/testar.bat contra3-editado.sfc 3` (veja [recomp/README.md](recomp/README.md)).

## Desenvolver

- `npm test` (Node 18 ou mais novo) roda os testes do núcleo.
- `nucleo/` tem o código sem interface, o mesmo no navegador e no Node.
- `editor/` tem a página.
