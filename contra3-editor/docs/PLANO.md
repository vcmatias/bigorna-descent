# Plano

O editor roda no navegador, sem internet, sobre a cópia do jogo de quem o usa. Uma edição sai como patch IPS ou
como ROM editada, que o Contra3Recomp roda direto. O recomp tem o código do jogo compilado, mas lê os dados da ROM
em tempo de execução. Por isso o editor só muda **dados**, nunca código 65816.

## 0.1 (agora)

- [x] Abrir a ROM: tira o cabeçalho de copiadora e confere título, checksum e SHA-256.
- [x] LZSS da Konami nos dois sentidos. A descompressão é idêntica à do jogo; a compressão volta ao mesmo dado.
- [x] Scripts de recursos do banco `$05`: lista os fluxos de gráficos que o código carrega.
- [x] Folha de tiles a 2, 4 e 8 bpp, com paleta lida de um endereço. Pintura pixel a pixel e regravação do fluxo
      no lugar, se couber.
- [x] Visualizador de quadros de sprite (formato de `$00:EB1A`).
- [x] Inimigos por tela nas fases de rolagem lateral: tipo, posição, gatilho e parâmetro, editados no lugar.
- [x] Limiares de colisão da fase.
- [x] Exportar `.ips` e `.sfc` com o checksum corrigido; linha de comando para testar no recomp.

## 0.2: conferir com a ROM

- [ ] Abrir uma ROM real e conferir cada formato de `docs/FORMATOS.md` marcado como não confirmado.
- [ ] Dar nome aos tipos de ator (`$05:A48A`) e às paletas de cada fase.
- [ ] Achar a tabela de animações, para ver os sprites de cada inimigo.

## 0.3: mapa das fases

- [ ] Descomprimir o script `$8A0D` da fase e montar blocos e telas, como o jogo faz em `$7E:5000`/`$9000`.
- [ ] Desenhar a fase inteira, com a colisão por cima e os inimigos nas suas posições.
- [ ] Editar blocos (trocar tiles) e telas (trocar blocos).
- [ ] Arrastar inimigos no mapa.

## 0.4: espaço livre e realocação

- [ ] Mapear o espaço livre de cada banco.
- [ ] Mover fluxos e listas, reescrevendo os ponteiros: listas com mais inimigos, gráficos maiores.
- [ ] Recomprimir com busca ótima, para ganhar espaço.

## Teste ao vivo no recomp

- [ ] Ponte opcional: o editor grava a ROM numa pasta e o recomp a recarrega ao apertar uma tecla, na fase e no
      checkpoint escolhidos (`--start-stage` já existe; falta recarregar sem fechar).
- [ ] Propor isso ao autor do recomp como contribuição, já que o recomp não traz licença.

## Mais tarde

- Fases 2 e 5 (Mode 7).
- Paletas e textos.
- Versão bilíngue da interface, como no Bigorna.
