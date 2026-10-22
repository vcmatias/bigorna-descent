# O acervo do Bigorna: formato

O acervo é um repositório público no GitHub (`vcmatias/bigorna-acervo`) com um índice e os arquivos. O mod e o editor leem o
índice em `https://raw.githubusercontent.com/vcmatias/bigorna-acervo/main/indice.json`. Como no Valkyrie, há dois ambientes:
**mapas** (mapas avulsos e campanhas) e **pacotes** (conteúdo da Oficina: monstros, itens, heróis, armas, objetos, peças,
histórias). Um mapa ou campanha diz quais pacotes exige; quem joga baixa esses pacotes antes (o mod mostra quais e leva até eles).

## Repositório

```
indice.json                   gerado por ferramentas/acervo.py indexar (não editar à mão)
CATALOGO.md                   a lista para ler no GitHub, com a bandeira da língua (gerada junto com o índice)
itens/<id>/ficha.json         a ficha publicada
itens/<id>/<id>.zip           o arquivo
ferramentas/acervo.py         confere um envio (formulário) e, se passar, grava em itens/ e refaz o indice.json
.github/ISSUE_TEMPLATE/       o formulário "Publicar no acervo"
.github/workflows/            publicar.yml (o bot: cada pedido, sem curadoria), indice.yml (itens/ mudou)
```

O índice: `{ "formato": "bigorna-acervo-indice", "versao": 1, "atualizado": "…", "itens": [ficha, …] }`.

## A ficha (`bigorna-acervo.json` dentro do zip; `itens/<id>/ficha.json` no repositório)

```json
{
  "formato": "bigorna-acervo", "versao": 1,
  "id": "o-sangue-limpo-k3x9",          // [a-z0-9-], 3 a 60; o mesmo em todas as edições
  "tipo": "mapa | campanha | pacote",
  "nome": "O Sangue Limpo", "autor": "Victor", "resumo": "Texto curto.",
  "lingua": "pt",                        // a língua em que foi feito, uma das do jogo: en pt es fr de it pl hu cs ru ko zh-cn zh-tw
                                         // (meta.language no .dmap; o autor diz qual; bandeiras/<código>.png)
  "ato": 1,                              // 1: só o Ato I; 2: precisa do Ato II
  "edicao": 3,                           // sobe a cada nova publicação do mesmo id
  "requer": [{ "id": "bestiario-do-pantano-a1b2", "edicao": 2, "nome": "Bestiário do Pântano" }],
  "conteudo": { "mapas": 6 },            // campanha: mapas; pacote: { "entradas": 32 }
  "editor": "0.2.0", "data": "2026-10-21"
}
```

No repositório a ficha ganha `arquivo`, `tamanho`, `sha256`, `github` (quem enviou) e `publicado`. No índice, cada ficha ganha
`url` (relativo à raiz do repositório). Uma edição nova do mesmo `id` só é aceita do mesmo usuário do GitHub que publicou a
primeira, e com `edicao` maior.

## O zip

Plano (sem pastas), com a ficha e só estes tipos: `.dmap .dcamp .bigorna .json .ogg .mp3 .wav .mp4 .webm .png .jpg .jpeg
.webp .glb .gltf .obj .bin .mtl`. A única pasta aceita é `imagens/`, com as imagens da obra (`imagens/<32 hex>.png|jpg|webp|gif`).

- **mapa**: `bigorna-acervo.json`, o `.dmap`, as mídias dele e `imagens/`.
- **campanha**: `bigorna-acervo.json`, o `.dcamp`, os `.dmap`, as mídias e `imagens/`.
- **pacote**: `bigorna-acervo.json`, `pacote.bigorna` (o pacote da Oficina, para o editor), `pacote.json` (o conteúdo pronto
  para o mod: `{ "format": "bigorna-pacote", "version": 1, "id", "edition", "name", "custom": { …como o "custom" de um .dmap… } }`)
  as mídias (modelos, sons) e `imagens/`.

## As imagens

Os arquivos levam referências no lugar das imagens: `"imagens/<nome>"`, onde o nome vem do conteúdo da imagem. Cada imagem
vai uma vez só, na pasta `imagens/` do zip, e toda referência de um `.dmap`, `.dcamp`, `pacote.bigorna` ou `pacote.json`
precisa da imagem dela no zip. O mod instala a pasta junto e acha as imagens por ela.

## Os requisitos

O `.dmap` e o `.dcamp` publicados levam `"requires": [{ "id", "edition", "name" }]`, os mesmos pacotes e edições da
`requer` da ficha. As entradas que vêm desses pacotes, sem mudança, saem do `"custom"` do mapa (o mapa fica menor); uma entrada
mudada no mapa fica nele e vale por cima da do pacote. Ao carregar, o mod junta o `custom` de cada pacote exigido ao do mapa (o
do mapa vence, pelo `id`) e procura as mídias também nas pastas desses pacotes. Mapas sem `requires` não exigem nada.

Cada pacote exigido precisa estar no acervo, na edição pedida ou mais nova: publique o pacote antes.

O conteúdo próprio da Oficina (monstros, itens, heróis, NPCs, armas, perícias, proezas, receitas, tiles, objetos) vai em
pacotes, publicados à parte: o `"custom"` de um mapa ou campanha só leva entradas dos pacotes que exige (pelo `id`; uma
mudada na obra vale por cima da do pacote). O `featPool` (ids das proezas do jogo) fica de fora dessa regra. No editor, uma
obra com conteúdo próprio fora dos pacotes do acervo para antes de publicar: o autor a vincula a pacotes do acervo ou monta
um pacote com esse conteúdo e o publica antes.

## No jogo

- Mapas e campanhas baixados: `CustomMaps/<id>/`.
- Pacotes: `Pacotes/<id>/` (ao lado de `CustomMaps`, nos dados do jogo).
- O que o acervo instalou: `Acervo/instalados.json` (por id: tipo, edição, pasta, arquivos). Atualizar troca só esses arquivos
  (o progresso de uma campanha fica). Remover apaga só esses arquivos.
- Uma obra que exige um pacote ausente (ou numa edição mais velha) só baixa e só abre depois dele: o mod explica e leva à aba
  **Pacotes**, com os pacotes pedidos marcados. Um pacote com edição nova no acervo aparece com "atualização disponível".
- `Acervo/endereco.txt` troca o endereço do acervo (para testar um acervo de outro lugar).
