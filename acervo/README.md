# Bigorna: o acervo / the community library

Mapas, campanhas e pacotes da Oficina feitos com o editor [Bigorna](https://github.com/vcmatias/bigorna-descent) para
*Descent: Legends of the Dark*. Como no Valkyrie, quem joga baixa tudo dentro do jogo (**Mapas da comunidade → Baixar
mapas** e **Pacotes**). Uma obra que exige pacotes pede esses pacotes antes: o jogo mostra quais são e leva até eles. O editor
também baixa pacotes (**📚 Acervo → Pacotes do acervo…**).

*Maps, campaigns and Workshop packages made with the [Bigorna](https://github.com/vcmatias/bigorna-descent) editor for
Descent: Legends of the Dark. Like Valkyrie, players download everything inside the game (**Community maps → Download maps**
and **Packages**). A work that needs packages asks for them first: the game shows which ones and takes you there. The editor
also downloads packages (**📚 Library → Community packages…**).*

**O que já está no acervo / What is in it:** [CATALOGO.md](CATALOGO.md), com a bandeira da língua em que cada mapa foi feito (uma das línguas do jogo, dita pelo autor). / with the flag of the language each map was made in (one of the game's, told by the author).

## Publicar / Publishing

1. No editor, **📚 Acervo → Publicar este mapa** (ou campanha, ou um pacote seu). O editor salva um arquivo
   `bigorna-acervo-….zip` e abre aqui um formulário já preenchido.
2. Arraste o `.zip` para o campo **Arquivo** e crie o pedido. É preciso uma conta (gratuita) no GitHub.
3. Um bot confere o envio na hora e responde no pedido. Se estiver tudo certo, o arquivo entra em `itens/`, o índice se
   refaz, o pedido fecha e, em alguns minutos, aparece no jogo e no editor. Não há curadoria: vale o que passa na
   conferência. Se algo não servir, a resposta diz o quê; corrija e edite o pedido (o bot roda de novo).

Uma edição nova é publicada do mesmo jeito (o editor sobe o número). Só quem publicou a primeira edição manda as seguintes.
Até 10 publicações por pessoa por dia.
Um mapa que usa um pacote do acervo exige o pacote: publique o pacote antes. O conteúdo próprio da Oficina (monstros, itens,
heróis, tiles…) vai sempre num pacote, publicado à parte; o editor mostra o que é e ajuda a vincular a obra ao pacote.

*In the editor, **📚 Library → Publish this map** (or campaign, or one of your packages). The editor saves a
`bigorna-acervo-….zip` file and opens a form here, already filled. Drag the `.zip` into the **File** box and create the
request (you need a free GitHub account). A bot checks it right away and answers in the request: if all is right, it goes
into the community library by itself (there is no curation); if not, the answer says what to fix (edit the request and it runs again).
Only who published the first edition sends the next ones. Up to 10 publications per person per day. A map
that uses a package from the community library needs it: publish the package first. Workshop content of your own (monsters,
items, heroes, tiles…) always goes in a package, published on its own; the editor shows what it is and helps link the work to
the package.*

## Regras / Rules

- Só conteúdo seu (ou que você pode compartilhar), sem arte nem texto copiados do jogo.
- O arquivo é conferido: zip plano (só a pasta `imagens/`), só os tipos de arquivo do Bigorna, a ficha bate com o pedido, os
  mapas foram feitos no editor, os pacotes exigidos estão no acervo, o conteúdo próprio está nesses pacotes, cada imagem usada
  vem no arquivo. O formato está em
  [FORMATO.md](FORMATO.md).

## Para quem cuida do acervo / Maintainers

- **Sem curadoria:** o bot (`publicar.yml`) publica tudo o que passa na conferência. O limite por pessoa por dia fica em
  `ACERVO_LIMITE_POR_DIA` (variável de ambiente; 10 se ausente; 0 tira o limite).
- **Tirar uma entrada:** apague a pasta `itens/<id>/` num commit; o índice se refaz (`indice.yml`).
- **Refazer o índice à mão:** Actions → *Refazer o índice* → *Run workflow*, ou `python3 ferramentas/acervo.py indexar`.
- **Conferir um zip aqui:** `python3 ferramentas/acervo.py zip arquivo.zip usuario-do-github`.
- Na criação do repositório: crie o rótulo `publicar` (os outros o bot cria) e, em
  *Settings → Actions → General → Workflow permissions*, marque *Read and write permissions*.
