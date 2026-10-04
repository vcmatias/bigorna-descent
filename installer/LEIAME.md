# Bigorna

Bigorna é um mod feito por fã para *Descent: Legends of the Dark* (Windows, Steam) que joga mapas e campanhas da
comunidade, junto com o **Bigorna Rooms**, editor que monta esses mapas sala por sala.

Projeto não oficial. *Descent: Legends of the Dark* pertence à Fantasy Flight Games e à Asmodee; o Bigorna não tem
vínculo com elas nem aval delas. É preciso ter o jogo.

## O que vem no pacote

- `Bigorna.dll`: o mod, com o editor Bigorna Rooms dentro dele.
- `Bigorna-Salas.html`: o mesmo editor, que o instalador coloca na pasta `Editor`.
- `Install-Bigorna.bat`, `Uninstall-Bigorna.bat`, `install-bigorna.ps1`: o instalador.
- `source/`: o código do mod e do editor.

O pacote traz só código próprio. Textos, imagens, sons, peças e listas do jogo saem da cópia instalada de quem joga,
no computador dessa pessoa.

## Instalar

1. Descompacte o pacote em qualquer pasta.
2. Dê dois cliques em `Install-Bigorna.bat`. Uma janela guia a instalação:
   - **Pasta do jogo**: achada pela Steam (dá para escolher outra). Se o DescentForge também estiver instalado, a
     janela oferece desativá-lo, porque os dois mods entram em conflito.
   - **Instalar o mod**: copia a `Bigorna.dll` para `Legends of the Dark_Data\Managed`, registra o mod nas duas
     listas que o jogo lê ao abrir (`ScriptingAssemblies.json` e `RuntimeInitializeOnLoads.json`, com cópia de
     segurança `*.bigorna-bak`) e coloca o editor na pasta de dados do jogo (veja abaixo). Se a pasta do jogo pedir
     administrador, o Windows pergunta.
   - **Liberar o editor**: a janela pede para abrir o jogo (há um botão para isso), esperar na tela de título enquanto
     o mod lê a sua cópia (um aviso no canto mostra o andamento; alguns minutos na primeira vez) e depois começar ou
     continuar uma campanha do jogo até o mapa-múndi aparecer. O mod fotografa o mapa para o editor, e a janela marca
     cada passo conforme acontece. A instalação só conclui depois da foto do mapa.
   - **Pronto**: cria, se você quiser, o atalho `Bigorna Rooms` na Área de Trabalho.
3. Se o instalador for fechado antes do mapa, o mod continua instalado e o editor segue bloqueado, mostrando os passos
   que faltam; rode o instalador de novo ou siga os passos no jogo.

Depois de uma atualização do jogo, rode o instalador de novo (a atualização reescreve as duas listas). O instalador
trabalha só com os arquivos do pacote e do jogo, sem internet, e o script dele é texto simples, que qualquer pessoa
pode ler. Cada execução deixa um registro em `%TEMP%\Bigorna-installer.log`.

Se o Windows mostrar "O Windows protegeu o computador" (SmartScreen), o aviso indica apenas um pacote vindo da
internet sem assinatura paga: clique em "Mais informações" e "Executar assim mesmo".

Sem janela: `powershell -ExecutionPolicy Bypass -File install-bigorna.ps1 -Console [-DisableForge] [-GameFolder "..."]`.

## O editor

Na tela de título, na primeira vez (e de novo depois de uma atualização do jogo), o mod lê a cópia do jogo e grava em
`%USERPROFILE%\AppData\LocalLow\Fantasy Flight Games\Descent - Legends of the Dark\Editor`:

- `Bigorna-Salas.html`: o editor (abre no Chrome ou no Edge, sem internet);
- `bigorna-game-data.js`: peças, monstros, itens, personagens, heróis, façanhas, receitas, textos em inglês, imagens
  e sons da cópia do jogo;
- `bigorna-worldmap.js`: o mapa-múndi, fotografado na primeira visita ao mapa-múndi de cada ato. O editor é liberado quando existe a foto de algum ato.

Um aviso no canto mostra o andamento. No painel "Mapas da comunidade" da tela de título ficam os botões
"Abrir editor" e "Refazer dados do editor".

## Idioma

O mod e o editor falam português e inglês. A janela do instalador tem a caixa de idioma (começa na língua do Windows) e
ajusta os dois. Depois, o botão de idioma no painel "Mapas da comunidade" troca o mod, e o editor tem a própria escolha
nas configurações dele.

**Guarde `bigorna-game-data.js` e `bigorna-worldmap.js` só para você**: eles têm textos e imagens do jogo.
Compartilhe os mapas e campanhas que fizer (`.dmap`, `.dcamp`); quem abrir usa a própria cópia do jogo.

## Jogar mapas da comunidade

Ponha os `.dmap` e `.dcamp` em `%USERPROFILE%\AppData\LocalLow\Fantasy Flight Games\Descent - Legends of the Dark\CustomMaps`
(o editor exporta direto para lá). Na tela de título, "Mapas da comunidade" lista todos.

## Relatar um problema

No jogo, aperte **F9** (ou o botão "Relatar um problema" no painel "Mapas da comunidade"). Escreva o que aconteceu: o que
fizeram, o que esperavam e o que o jogo fez. O mod monta um pacote .zip com a explicação, o mapa e a campanha em jogo e os
registros do jogo (`bigorna.log`, `Player.log`), com o nome do seu usuário do Windows trocado por `%USERPROFILE%`.

- **Enviar**: o pacote vai por e-mail para o autor do Bigorna. Nada sai do computador sem este clique.
- **Só salvar o pacote**: ele fica na pasta `Relatos`, na pasta de dados do jogo, para vocês mandarem por outro meio.

## Desinstalar

Dois cliques em `Uninstall-Bigorna.bat` (ou o link na primeira página do instalador): tira o Bigorna das duas
listas, renomeia a DLL para `Bigorna.dll.off` e apaga o atalho da Área de Trabalho. Os mapas e a pasta `Editor`
ficam onde estão.

## Compilar

`source/mod/build.sh` compila a `Bigorna.dll` com o compilador C# do SDK do .NET, usando as DLLs do próprio jogo:
copie as DLLs da pasta `Legends of the Dark_Data\Managed` para `source/refs/` antes (elas não vêm no pacote).
`source/editor/salas/montar_salas.py --publico` monta a página do editor que vai dentro da DLL.
