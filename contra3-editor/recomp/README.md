# Testar no Contra3Recomp

O [Contra3Recomp](https://github.com/BrixW/Contra3Recomp) traz o código do jogo compilado em C, mas os dados (gráficos,
mapas, listas de inimigos) ele lê da ROM enquanto roda. Por isso uma ROM exportada pelo editor roda nele sem
recompilar nada. Quatro pontos:

1. O recomp confere o checksum da ROM (`src/snes_rom.c`). O editor recalcula o checksum ao exportar. Se você
   aplicar o `.ips` com outra ferramenta, use uma que também corrija o checksum.
2. Só os dados mudam. Uma mudança no código 65816 da ROM não teria efeito, porque o recomp roda o código compilado.
3. `--start-stage N` começa direto na fase N; `--rom arquivo.sfc` escolhe a ROM.
4. As listas de inimigos e os scripts de recursos são lidos quando a fase começa: comece a fase de novo para ver a
   mudança.

```
testar.bat contra3-editado.sfc 3
```

A aba **Exportar e testar** do editor mostra a linha de comando pronta.

## Sobre o código do recomp

O repositório do recomp não declara licença. Por isso este projeto não copia código dele. Os formatos em
`docs/FORMATOS.md` foram descritos a partir do comportamento das rotinas, e o porte do LZSS foi escrito do zero e
conferido contra a rotina compilada.
