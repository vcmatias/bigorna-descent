# Formatos de Contra III (USA)

Este documento junta o que se sabe sobre os dados do jogo e como se chegou a isso. Todos os endereços são do SNES
(LoROM: `$bb:aaaa` corresponde à posição `bb * $8000 + (aaaa - $8000)` do arquivo). A fonte é o código do
[Contra3Recomp](https://github.com/BrixW/Contra3Recomp), que traz cada rotina 65816 com a instrução original
comentada. Nenhum byte da ROM foi usado: o que depende dos dados está marcado.

Grau de certeza: **C** confirmado (teste contra o código do jogo), **A** lido direto das instruções,
**I** inferido com boa evidência, **H** hipótese.

## ROM

| | |
|---|---|
| Tamanho | 1 MB (`$100000`), 32 bancos de 32 KB, mapa `$20` (LoROM) |
| Título interno | `CONTRA3 THE ALIEN WAR` em `$00:FFC0` |
| SHA-256 da original | `a93ea87fc835c530b5135c5294433d15eef6dbf656144b387e89ac19cf864996` |
| Checksum | soma de 16 bits de todos os bytes em `$00:FFDE`, complemento em `$00:FFDC` |

O recomp recusa uma ROM cujo checksum não confere (`src/snes_rom.c`). Ele não confere o SHA-256. O editor
recalcula o checksum ao exportar.

## LZSS da Konami (C)

Descompressor em `$00:949C` (1 KB por chamada) e `$00:94A9` (128 bytes por quadro, em segundo plano). O porte em
`nucleo/lzss.js` deu a mesma saída que a rotina compilada do recomp em 300 fluxos de teste, inclusive fluxos que
passam de 1 KB e dão a volta no anel.

- Os 2 primeiros bytes guardam o fim do fluxo, contado a partir do início do fluxo. Os comandos começam no byte 2
  e são lidos até esse fim.
- A saída passa por um anel de 1 KB zerado no começo. A posição no anel é a posição na saída `& $3FF`.

| Byte B | Comando |
|---|---|
| `$00-$7F` | copia `(B>>2)+2` bytes do anel, a partir de `((B&3)<<8 \| próximo) - $3DF`, `& $3FF` |
| `$80-$9F` | `B&$1F` bytes literais (pode ser 0) |
| `$A0-$BF` | `(B&$1F)+2` pares: um `$00` e depois um byte literal |
| `$C0-$DF` | `(B&$1F)+2` cópias do próximo byte |
| `$E0-$FF` | `(B&$1F)+2` zeros |

O ARCHITECTURE.md do recomp troca os casos `$A0` e `$E0`. Aqui vale o código (`$00:9546`, `$00:9587`).

## Scripts de recursos no banco $05 (A)

`$00:90A8` lê um script em `$05:xxxx`:

| Bytes | Campo |
|---|---|
| 1 | tipo: 0 usa o quadro de fluxo `$1300` (buffer `$7E:2400`); 1 usa `$1340` (buffer `$7E:2800`); 2 e acima, outros carregadores |
| 1 | opções: bit 0 = descomprimir em segundo plano, um pedaço por quadro |
| 2 + 3 | destino (palavra) e ponteiro de 24 bits para um fluxo LZSS; o par se repete |
| 2 | `$FFFF` encerra |

Onde o código carrega scripts:

- **Endereço fixo** (`LDX #imm` antes de `JSL $0090A8`): `$F55B` (boot), `$CF41`, `$8527`, `$8530`, `$8539`,
  `$8542`, `$87AB`, `$8976`, `$8ADD`, `$8AD4`.
- **Tabelas de palavras**: `$87F1` (por fase `$86`), `$88E1`/`$88ED`, `$85CB`, `$8A0D` (por `$1670`), `$9E4A`.

Um fluxo nunca atravessa o fim do seu banco. O editor só regrava um fluxo no mesmo lugar e só se o novo couber
nos bytes do antigo. Mudar um fluxo de lugar exige achar espaço livre e reescrever o ponteiro do script; isso fica
para depois.

## Quadros de sprite (A, ainda não confirmado com dados)

Montados em OAM por `$00:EB1A`, com o banco de dados em `$06`:

| Bytes | Campo |
|---|---|
| 1 | número de peças |
| 4 por peça | `x` (s8), `y` (s8), tile, atributos `vhppccct` |

- Os bits de atributo do próprio ator (`+$02`) entram por OR.
- O bit 5 do byte de atributos também liga o tamanho grande no OAM alto.
- Peças fora da faixa vertical `[-16, $E8)` são puladas.
- Falta descobrir a tabela que leva de ator e animação ao endereço do quadro.

## Fases de rolagem lateral (1, 3, 4 e 6)

O banco `$06` não guarda as fases, ao contrário do que diz o BANK_MAP do recomp: ali ficam os quadros de sprite.
O mapa é montado em WRAM (banco `$7E`), a partir de tabelas no banco `$05`.

### Tabelas por fase (A)

| Tabela | Índice | Conteúdo |
|---|---|---|
| `$05:89CC` (byte) | `$86` | código de nível L (`$1698`): 0/2/4/6 para as fases 1/3/4/6. `$1670` = L, ou L + `$0A` no checkpoint |
| `$05:89D3` (palavra) | `$1670` | início do mapa de BG1 (`$13BC`, tela × `$80`) |
| `$05:89E7` (palavra) | `$1670` | início do mapa de BG2 (`$13FC`) |
| `$05:8A03` (palavra) | L | tabela de 12 limiares de colisão, copiada para DP `$C8-$DE` |
| `$05:8A0D` (palavra) | `$1670` | script de recursos da fase (gráficos e, provavelmente, mapa e blocos: H) |
| `$05:8A21` (palavra) | L | dados para `$00:9985` (paleta? H) |
| `$05:947A` (palavra) | `$86` × 2 | tabela de listas de inimigos |

### Mapa e blocos (A para a estrutura, I para os tamanhos)

| WRAM | Conteúdo |
|---|---|
| `$7E:4000-4FFF` | colisão de BG1, uma palavra por tile 8x8, espelho da tela de 64x32 da VRAM |
| `$7E:5000-8FFF` | blocos (metatiles) de BG1 |
| `$7E:9000-9FFF` | mapa de telas de BG1, `$80` bytes por tela, até 32 telas |
| `$7E:B000-EFFF` / `$7E:F000-FFFF` | blocos e telas de BG2 |

- **Tela.** Uma tela tem 256x256 px: 8x8 palavras de bloco, linha a linha. BG1 mostra 7 linhas.
- **Ordem das telas.** As telas formam uma corrente na ordem em que a câmera chega, não uma grade. É assim que a
  fase passa de rolagem horizontal para vertical.
- **Palavra de bloco.** Bits 0-13 dão o deslocamento na área de blocos, bit 14 espelha na horizontal e bit 15 na
  vertical.
- **Bloco.** Um bloco tem 32x32 px: 4x4 entradas de tilemap SNES comuns.
- **Streaming.** O streamer de colunas fica em `$00:CB29` e o de linhas em `$00:CA52`. A fila de VRAM está em
  `$00:8D44`.
- **Falta confirmar com a ROM:**
  - quais entradas do script `$8A0D` gravam em `$7E:5000`/`$9000`;
  - a ordem dos tiles dentro do bloco (tabelas `$00:CD0A` e `$00:CD8A`);
  - o passo entre blocos (provavelmente 32 bytes: H).

### Colisão (A)

A colisão vem do **número do tile 8x8**, não do bloco. A cada tile de BG1 posto na fila, `$00:CC37` compara
`tile & $3FF` com os 12 limiares crescentes T0..T11 e grava a classe em `$7E:4000`.

| Faixa | Classe |
|---|---|
| < T0 | vazio |
| < T1 | sólido |
| < T2 | plataforma que se atravessa para baixo |
| < T3 … < T8 | rampas (inclinação 1:2; o espelho H inverte o lado) |
| < T9 | agarrar (H) |
| < T10, < T11 | escalar, por lado (H) |
| ≥ T11 | sólido |

- **Consulta.** A consulta de um ponto é `$00:E16E` e só cobre a janela de 512x256 px da VRAM.
- **Mudanças em jogo.** Eventos da fase (`$02:B2B4`) mudam os limiares durante o jogo.
- **Consequência para o editor.** A colisão de um bloco só muda trocando os tiles dele, ou mudando os limiares da
  fase inteira.

### Inimigos (A, conferido no código de `$00:CE6E`)

- **Listas.** `$05:947A[$86*2]` aponta uma tabela de ponteiros, uma lista por tela, na mesma ordem das telas do
  mapa.
- **Início.** `$00:CE0A` prepara o ponteiro da fase e o índice da tela.
- **Quando nasce.** `$00:CE3A`/`$CE6E` testam uma entrada por quadro. Ao virar de página de 256 px, as entradas que
  sobraram nascem todas.

Entrada de 10 bytes. As entradas vêm em ordem crescente de gatilho; um gatilho `$FF` encerra a lista.

| Deslocamento | Tamanho | Campo |
|---|---|---|
| +0 | byte | gatilho: posição da rolagem dentro da página |
| +1 | byte | tipo do ator (índice em `$05:A48A`) → `$10,X` |
| +2 | byte | fim da busca de vaga (endereço / 16, exclusivo) |
| +3 | byte | início da busca de vaga (ex.: `$20` = slot `$0200`), passo `$40` |
| +4 | palavra | x na tela → `$0A,X` (mais o atraso, na rolagem para frente) |
| +6 | palavra | y na tela → `$0E,X` (menos o atraso, na rolagem para trás) |
| +8 | palavra | parâmetro → `$3A,X` |

Quantas telas cada tabela tem não fica gravado. O editor lê listas enquanto os ponteiros apontam listas bem
formadas, até 32. Mudar o número de inimigos de uma tela exige espaço livre no banco `$05` e reescrever o
ponteiro; por enquanto o editor muda as entradas no lugar.

## Fases 2 e 5 (vista de cima, Mode 7)

Ainda não estudadas. Os mapas ficam no banco `$03` (`$8000-$E17F`) e no banco `$07`.
