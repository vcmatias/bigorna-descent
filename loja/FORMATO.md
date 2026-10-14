# A loja do Bigorna: formato

A loja é um repositório público no GitHub (`vcmatias/bigorna-loja`) com um índice e os arquivos. O mod e o editor leem o
índice em `https://raw.githubusercontent.com/vcmatias/bigorna-loja/main/indice.json`. Como no Valkyrie, há dois ambientes:
**mapas** (mapas avulsos e campanhas) e **pacotes** (conteúdo da Oficina: monstros, itens, heróis, armas, objetos, peças,
histórias). Um mapa diz quais pacotes exige; o mod baixa os que faltam junto com o mapa.

## Repositório

```
indice.json                   gerado por ferramentas/loja.py indexar (não editar à mão)
itens/<id>/ficha.json         a ficha publicada
itens/<id>/<id>.zip           o arquivo
ferramentas/loja.py           confere um envio (formulário) e, se passar, grava em itens/ e refaz o indice.json
.github/ISSUE_TEMPLATE/       o formulário "Publicar na loja"
.github/workflows/            publicar.yml (o bot: cada pedido, sem curadoria), indice.yml (itens/ mudou)
```

## A ficha (`bigorna-loja.json` dentro do zip; `itens/<id>/ficha.json` no repositório)

```json
{
  "formato": "bigorna-loja", "versao": 1,
  "id": "o-sangue-limpo-k3x9",          // [a-z0-9-], 3 a 60; o mesmo em todas as edições
  "tipo": "mapa | campanha | pacote",
  "nome": "O Sangue Limpo", "autor": "Victor", "resumo": "Texto curto.",
  "lingua": "pt | en | pt,en",
  "ato": 1,                              // 1: só o Ato I; 2: precisa do Ato II
  "edicao": 3,                           // sobe a cada nova publicação do mesmo id
  "requer": [{ "id": "bestiario-do-pantano-a1b2", "edicao": 2, "nome": "Bestiário do Pântano" }],
  "conteudo": { "mapas": 6 },            // campanha: mapas; pacote: { "entradas": 32 }
  "editor": "0.1.4", "data": "2026-10-14"
}
```

No repositório a ficha ganha `arquivo`, `tamanho`, `sha256`, `github` (quem enviou) e `publicado`. No índice, cada ficha ganha
`url` (relativo à raiz do repositório). Uma edição nova do mesmo `id` só é aceita do mesmo usuário do GitHub que publicou a
primeira, e com `edicao` maior.

## O zip

Plano (sem pastas), com a ficha e só estes tipos: `.dmap .dcamp .bigorna .json .ogg .mp3 .wav .mp4 .webm .png .jpg .jpeg
.webp .glb .gltf .obj .bin .mtl`.

- **mapa**: `bigorna-loja.json`, o `.dmap` e as mídias dele.
- **campanha**: `bigorna-loja.json`, o `.dcamp`, os `.dmap` e as mídias.
- **pacote**: `bigorna-loja.json`, `pacote.bigorna` (o pacote da Oficina, para o editor), `pacote.json` (o conteúdo pronto
  para o mod: `{ "format": "bigorna-pacote", "version": 1, "id", "edition", "name", "custom": { …como o "custom" de um .dmap… } }`)
  e as mídias (modelos, sons).

## Os requisitos dentro do mapa

O `.dmap` e o `.dcamp` publicados na loja levam `"requires": [{ "id", "edition", "name" }]`. As entradas que vêm
desses pacotes, sem mudança, saem do `"custom"` do mapa (o mapa fica menor); uma entrada mudada no mapa fica nele e vale
por cima da do pacote. Ao carregar, o mod junta o `custom` de cada pacote exigido ao do mapa (o do mapa vence, pelo `id`) e
procura as mídias também nas pastas desses pacotes. Mapas sem `requires` (todos os exportados direto do editor) não mudam.

## No jogo

- Mapas e campanhas baixados: `CustomMaps/<id>/`.
- Pacotes: `Pacotes/<id>/` (ao lado de `CustomMaps`, nos dados do jogo).
- O que a loja instalou: `Loja/instalados.json` (por id: tipo, edição, pasta, arquivos). Atualizar troca só esses arquivos
  (o progresso de uma campanha fica). Remover apaga só esses arquivos.
