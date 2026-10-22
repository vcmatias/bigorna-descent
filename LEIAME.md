<p align="center"><img src="docs/bigorna.svg" width="96" alt="Bigorna"></p>

<h1 align="center">Bigorna</h1>

<p align="center">
Mod feito por fã para <i>Descent: Legends of the Dark</i> que joga mapas e campanhas da comunidade,<br>
com o <b>Bigorna Rooms</b>, editor que monta esses mapas sala por sala.
</p>

<p align="center">
<a href="../../releases/latest"><b>Baixar a versão mais recente</b></a> ·
<a href="README.md">Read in English</a> ·
<a href="https://vcmatias.github.io/bigorna-descent/">Site</a>
</p>

---

Projeto não oficial. *Descent: Legends of the Dark* pertence à Fantasy Flight Games e à Asmodee; o Bigorna não tem
vínculo com elas nem aval delas. É preciso ter o jogo (Windows, Steam).

## O que ele faz

- **Joga mapas** (`.dmap`) e **campanhas** (`.dcamp`) da comunidade dentro do jogo, com as peças, monstros, heróis,
  itens, sons e narração do próprio jogo.
- **Bigorna Rooms**, o editor, roda no Chrome ou no Edge, sem internet. Você desenha cada sala com as peças do jogo,
  coloca monstros, baús, portas e objetos, escreve os textos e gatilhos e testa o andamento. Ele também gera um mapa
  inteiro a partir de algumas escolhas (tamanho, tema, vilão, inimigos) e encadeia mapas numa campanha no mapa-múndi.
- Um **tutorial** guiado dentro do editor acompanha a montagem do primeiro mapa, passo a passo.
- **Relatar um problema** com F9 no jogo: o mod junta a sua explicação, o mapa em jogo e os registros.

## Nada do jogo é compartilhado

Este repositório e o pacote de cada versão trazem só o código do Bigorna. Na tela de título, o mod lê a *sua* cópia
instalada do jogo e grava os dados do editor no *seu* computador. Os mapas e campanhas compartilhados levam só o
trabalho de quem os fez: quem abre usa a própria cópia do jogo.

## Instalar

1. Baixe o `Bigorna-<versão>.zip` em [Releases](../../releases/latest) e descompacte em qualquer pasta.
2. Dê dois cliques em `Install-Bigorna.bat`. Uma janela guia a instalação:
   - acha a pasta do jogo pela Steam;
   - instala o mod (copia a `Bigorna.dll` e a registra nas duas listas que o jogo lê ao abrir, com cópia de segurança
     de cada uma);
   - pede para abrir o jogo e esperar na tela de título enquanto o mod lê a sua cópia (alguns minutos na primeira
     vez) e depois abrir uma vez o mapa-múndi de uma campanha, para o editor ganhar a foto dele;
   - cria, se você quiser, o atalho **Bigorna Rooms** na Área de Trabalho.
3. Depois de uma atualização do jogo, rode o instalador de novo.

Se o Windows mostrar "O Windows protegeu o computador" (SmartScreen), o pacote apenas está sem assinatura paga:
clique em "Mais informações" e "Executar assim mesmo". O instalador é um script do PowerShell em texto simples e
trabalha sem internet.

O guia completo está no `LEIAME.md` dentro do pacote.

## Jogar mapas da comunidade

Ponha os arquivos `.dmap` e `.dcamp` em
`%USERPROFILE%\AppData\LocalLow\Fantasy Flight Games\Descent - Legends of the Dark\CustomMaps`
(o editor exporta direto para lá). Na tela de título, o painel **Mapas da comunidade** lista todos.

## Compatibilidade garantida

Mapas e campanhas feitos em qualquer versão do Bigorna continuam valendo em todas as versões seguintes. O formato
dos arquivos só cresce: cada chave nova tem um valor padrão, e nenhuma chave existente muda de nome, sai ou muda de
tipo. Um mod mais antigo, diante de um arquivo mais novo, lê tudo o que conhece e deixa de lado o resto.

## Desinstalar

Dois cliques em `Uninstall-Bigorna.bat`: tira o Bigorna das listas do jogo e desliga a DLL. Os mapas ficam onde
estão.

## Organização do repositório

| Pasta | Conteúdo |
|---|---|
| `mod/` | O mod (C#, Unity/Mono). `mod/build.sh` compila a `Bigorna.dll`. |
| `editor/salas/` | O editor Bigorna Rooms (JavaScript puro). `montar_salas.py --publico` monta o editor numa página só. |
| `installer/` | O instalador para Windows (PowerShell com uma janela WinForms). |
| `docs/` | O site do projeto (GitHub Pages). |

### Compilar

O mod compila contra as DLLs do próprio jogo, que ficam fora deste repositório: copie as DLLs da pasta
`Legends of the Dark_Data\Managed` para uma pasta `refs/` na raiz do repositório e rode `bash mod/build.sh` (precisa
do SDK do .NET e do Python 3). A DLL leva dentro a página do editor montada por `editor/salas/montar_salas.py --publico`.

O mod e o editor falam português e inglês: escolha o idioma no instalador e troque quando quiser no painel **Mapas da comunidade** do jogo ou nas configurações do editor.

## Licença

O código do Bigorna está sob a [Licença MIT](LICENSE). O jogo e tudo o que há nele pertencem aos donos.
