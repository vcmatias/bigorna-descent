# Contra III Editor

A stage, enemy and graphics editor for *Contra III: The Alien Wars* (SNES, USA). It runs in the browser with no
internet, and its edits run in the [Contra3Recomp](https://github.com/BrixW/Contra3Recomp).
[Leia em português](LEIAME.md).

This is an unofficial fan project. *Contra III* belongs to Konami, and this project has no affiliation with it.
You need your own copy of the game.

The repository holds only the editor's code. The editor reads *your* ROM on your computer, and you share an edit as
an `.ips` patch that carries only the bytes you changed.

## Version 0.1

- **ROM check.** Validates the ROM against the original's title, checksum and SHA-256.
- **Graphics.** Lists the game's compressed graphics and decodes them with Konami's LZSS. The output is identical
  to the game's own routine. You can view tiles at 2, 4 or 8 bpp, paint them, and write them back in place.
- **Sprites.** A sprite frame viewer.
- **Enemies.** Per-screen enemy lists for stages 1, 3, 4 and 6, editable in place. Each stage's tile collision
  thresholds are shown alongside.
- **Export.** Writes an `.ips` patch or an edited `.sfc` with the checksum fixed, plus the command line to test it in
  the recomp.

See [docs/PLANO.md](docs/PLANO.md) for the roadmap and [docs/FORMATOS.md](docs/FORMATOS.md) for the game formats
(both in Portuguese).

## Use and develop

- **Open the editor.** Open `editor/index.html` in Chrome or Edge.
- **Single-file build.** `python3 montar.py` writes `dist/Contra3-Editor.html`.
- **Tests.** `npm test` (Node 18 or newer).
