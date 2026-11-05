<p align="center"><img src="docs/bigorna.svg" width="96" alt="Bigorna"></p>

<h1 align="center">Bigorna</h1>

<p align="center">
A fan-made mod for <i>Descent: Legends of the Dark</i> that plays community maps and campaigns,<br>
with <b>Bigorna Rooms</b>, an editor that builds them room by room.
</p>

<p align="center">
<a href="../../releases/latest"><b>Download the latest version</b></a> ·
<a href="LEIAME.md">Leia em português</a> ·
<a href="https://vcmatias.github.io/bigorna-descent/">Website</a>
</p>

---

Unofficial fan project. *Descent: Legends of the Dark* belongs to Fantasy Flight Games and Asmodee; Bigorna has no
affiliation with them and no endorsement from them. You need your own copy of the game on Steam (Windows, or Linux through Proton).

## What it does

- **Plays community maps** (`.bmap`) and **campaigns** (`.bcamp`) inside the game, with the game's own tiles,
  monsters, heroes, items, sounds and narration.
- **One-shot map**: on the title screen, a new map made on the spot by Bigorna's generator, with a new party or the party of a saved game.
- **Bigorna Rooms**, the editor, runs in Chrome or Edge with no internet. You draw each room with the game's tiles,
  place monsters, chests, doors and objects, write the texts and triggers, and test the flow. It can also generate a
  whole map from a few choices (size, theme, villain, enemies) and chain maps into a campaign on the world map.
- A guided **tutorial** inside the editor walks through a first map step by step.
- **Report a problem** with F9 in the game: the mod packs your description, the map in play and the logs.

## Nothing from the game is shared

This repository and the release package hold only Bigorna's own code. On the title screen, the mod reads *your*
installed copy of the game and writes the editor's data on *your* computer. Maps and campaigns you share carry only
your own work: whoever opens them uses their own copy of the game.

## Install on Windows

1. Download `Bigorna-<version>.zip` from [Releases](../../releases/latest) and unzip it anywhere.
2. Double-click `Install-Bigorna.bat`. A window guides you:
   - finds the game folder through Steam;
   - installs the mod (copies `Bigorna.dll` and registers it in the two lists the game reads at start-up, keeping a
     backup of each);
   - asks you to start the game and wait on the title screen while the mod reads your copy (a few minutes the first
     time), then open the world map of a campaign once, so the editor gets its picture;
   - optionally makes a **Bigorna Rooms** shortcut on the desktop.
3. Run the installer again after a game update.

If Windows shows "Windows protected your PC" (SmartScreen), the package simply has no paid signature: click
"More info" and "Run anyway". The installer is a plain PowerShell script you can read, and it uses no internet.

The full guide is in the `README.md` inside the package.

## Install on Linux (Steam with Proton)

The game runs on Linux through Steam's Proton, and Bigorna runs with it.

1. In Steam, open the game's **Properties › Compatibility**, tick *Force the use of a specific Steam Play compatibility
   tool* and pick Proton. Start the game once, so Steam creates its Proton prefix, then close it.
2. Download `Bigorna-<version>.zip` from [Releases](../../releases/latest), unzip it and run, in a terminal:
   `bash install-bigorna.sh` (add `--lang pt` for Portuguese). It needs `python3`. The script finds the game in your
   Steam libraries (or use `--game "<folder of Legends of the Dark>"`), copies `Bigorna.dll`, registers it in the two
   lists the game reads at start-up (with a backup of each) and puts the editor in the game's data folder inside the
   Proton prefix.
3. Start the game through Steam and wait on the title screen while the mod reads your copy.
4. Open the editor, `Bigorna-Salas.html`, in **Chrome or Chromium** (Firefox cannot write to folders). It is in
   `~/.steam/steam/steamapps/compatdata/1611070/pfx/drive_c/users/steamuser/AppData/LocalLow/Fantasy Flight Games/Descent - Legends of the Dark/Editor`.
5. **One-shot map on Linux**: the Bigorna Editor app does not run under Proton, so the generator runs in the browser.
   The one-shot map window shows the path of `Abrir-o-gerador.html` (and an **Open in the browser** button): open it in
   Chrome or Chromium, choose the `Bigorna/Oneshot` folder it asks for, and keep the tab open while you play. Then
   **Generate** in the game makes the map in that tab.

Run `bash install-bigorna.sh` again after a game update; `bash install-bigorna.sh --uninstall` takes Bigorna out.
Linux support is new and not yet tried on a Linux computer: please report what works and what breaks (Issues, or F9 in the game).

## Play community maps

Put `.bmap` and `.bcamp` files in
`%USERPROFILE%\AppData\LocalLow\Fantasy Flight Games\Descent - Legends of the Dark\Bigorna\Mapas`
(on Linux, the same folder inside the Proton prefix; the editor can export straight there). Bigorna's older `.dmap` and
`.dcamp` files keep opening from the old `CustomMaps` folder. On the title screen, the **Community maps** panel lists them.

## Compatibility promise

Maps and campaigns made with any version of Bigorna keep working in every later version. The file format only grows:
new keys always have a default, and no existing key is renamed, removed or changes type. An older mod opening a
newer file reads everything it knows and skips the rest.

## Uninstall

On Windows, double-click `Uninstall-Bigorna.bat`; on Linux, run `bash install-bigorna.sh --uninstall`. It removes Bigorna from the game's lists and turns the DLL off. Your maps stay
where they are.

## Repository layout

| Folder | What |
|---|---|
| `mod/` | The mod (C#, Unity/Mono). `mod/build.sh` compiles `Bigorna.dll`. |
| `editor/salas/` | The Bigorna Rooms editor (plain JavaScript). `montar_salas.py --publico` builds the single-page editor. |
| `installer/` | The Windows installer (PowerShell with a small WinForms window) and the Linux one (`install-bigorna.sh`). |
| `docs/` | This project's website (GitHub Pages). |

### Build

The mod compiles against the game's own assemblies, which are not in this repository: copy the DLLs from your
`Legends of the Dark_Data\Managed` folder into a `refs/` folder at the repository root, then run `bash mod/build.sh`
(needs the .NET SDK and Python 3). The DLL embeds the editor page built by `editor/salas/montar_salas.py --publico`.

The mod and the editor speak English and Portuguese: pick the language in the installer, and switch it any time in the game's **Community maps** panel or in the editor's settings.

## License

Bigorna's code is under the [MIT License](LICENSE). The game and everything in it belong to their owners.
