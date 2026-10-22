# Bigorna

Bigorna is a fan-made mod for *Descent: Legends of the Dark* (Windows, Steam) that plays community maps and
campaigns, together with **Bigorna Rooms**, an editor that builds them room by room.

Unofficial fan project. *Descent: Legends of the Dark* belongs to Fantasy Flight Games and Asmodee; Bigorna is not
affiliated with or endorsed by them. You need your own copy of the game.

## What is in this package

- `Bigorna.dll`: the mod. The Bigorna Rooms editor is inside it.
- `Bigorna-Salas.html`: the same editor, which the installer puts in the `Editor` folder.
- `Install-Bigorna.bat`, `Uninstall-Bigorna.bat`, `install-bigorna.ps1`: the installer.
- `source/`: the source code of the mod and of the editor.

The package contains **nothing from the game**: no game files, texts, pictures, sounds or lists. The editor gets
all of that from your installed copy, on your computer (see below).

## Install

1. Unzip the package anywhere.
2. Double-click `Install-Bigorna.bat`. A window guides you through the steps:
   - **Game folder**: found through Steam (you can pick another one). If DescentForge is also installed, the
     window offers to turn it off, since the two mods clash.
   - **Install the mod**: copies `Bigorna.dll` into `Legends of the Dark_Data\Managed`, registers it in the two
     lists the game reads at start-up (`ScriptingAssemblies.json` and `RuntimeInitializeOnLoads.json`; a backup of
     each is kept as `*.bigorna-bak`) and puts the editor in the game's data folder (see below). If the game folder
     needs administrator rights, Windows asks for them.
   - **Unlock the editor**: the window asks you to start the game (there is a button for it), wait on the title
     screen while the mod reads your copy (a notice in the corner shows the progress; a few minutes the first time),
     then start or continue a campaign of the game until the world map shows. The mod pictures the map for the editor,
     and the window ticks each step as it happens. The installation finishes only once the map is pictured.
   - **Done**: optionally makes a `Bigorna Editor` shortcut on the desktop (the app, which the mod installed in the step before).
3. If you close the installer before the map, the mod stays installed and the editor stays locked, showing the steps
   still missing; run the installer again or just follow them in the game.

Run the installer again after a game update (updates rewrite those two lists). The installer works only with the
package and the game files, with no internet, and its script is plain text you can read. A log of each run goes to
`%TEMP%\Bigorna-installer.log`.

If Windows shows "Windows protected your PC" (SmartScreen), it only means the package comes from the internet
without a paid signature: click "More info" and "Run anyway".

Without a window: `powershell -ExecutionPolicy Bypass -File install-bigorna.ps1 -Console [-DisableForge] [-GameFolder "..."]`.

## The editor

On the title screen, the first time (and again after a game update), the mod reads your copy of the game and writes,
into `%USERPROFILE%\AppData\LocalLow\Fantasy Flight Games\Descent - Legends of the Dark\Editor`:

- `Bigorna-Salas.html`: the editor (the app opens it; Chrome or Edge open it too, and then keep the work in the browser);
- `bigorna-game-data.js`: tiles, monsters, items, characters, heroes, feats, recipes, English texts, pictures and
  sounds from your copy of the game;
- `bigorna-worldmap.js`: the world map, pictured the first time you open the world map in each act. The editor unlocks once any act has its picture.

The **Bigorna Editor** app lives in `%LOCALAPPDATA%\Bigorna\App` (the mod puts it there on the title screen; the shortcut and
the game's "Open editor" button open it). Its window uses the Microsoft Edge engine that comes with Windows. It keeps
everything in files, with nothing to allow: the Workshop (one for every map and campaign) is in `Pacotes\<id>\pacote.bigorna`,
exported maps go straight into `CustomMaps`. When it opens, it reads every package of the `Pacotes` folder (imported or
downloaded from the community library); the entries of those packages change in a copy, which goes into your Workshop. (It
stays out of `LocalLow` on purpose: there Windows would run the app at low integrity, where the Edge engine does not open.)

A notice in the corner shows the progress. On the title screen, the "Community maps" panel has the buttons
"Open editor" and "Rebuild editor data" (read the game again).

**Do not share `bigorna-game-data.js` or `bigorna-worldmap.js`**: they hold the game's texts and pictures. Share the
maps and campaigns you make (`.dmap`, `.dcamp`); anyone who opens them uses their own copy of the game.

## Play community maps

Put `.dmap` and `.dcamp` files in `%USERPROFILE%\AppData\LocalLow\Fantasy Flight Games\Descent - Legends of the Dark\CustomMaps`
(the editor can export straight there). On the title screen, "Community maps" lists them.

## The community library

In "Community maps", the **Download maps** and **Packages** tabs list what other authors shared in the community library
(https://github.com/vcmatias/bigorna-acervo). Download, update, play or remove; a map brings the packages it needs. Downloaded maps go to
`CustomMaps\<id>\` and packages to `Pacotes\<id>\`, next to it. To publish your own, use **📚 Library** in the
editor.

## Report a problem

In the game, press **F9** (or the "Report a problem" button in the "Community maps" panel). Write what happened:
what you did, what you expected and what the game did. The mod builds a .zip with your text, the map and campaign in play
and the game logs (`bigorna.log`, `Player.log`), with your Windows user name replaced by `%USERPROFILE%`.

- **Send**: the package goes to the author of Bigorna by e-mail. Nothing leaves your computer without this
  click.
- **Just save the package**: it stays in the `Relatos` folder, in the game's data folder, for you to send some
  other way.

## Uninstall

Double-click `Uninstall-Bigorna.bat` (or use the link on the installer's first page). It takes Bigorna out of the
two lists, renames the DLL to `Bigorna.dll.off` and removes the desktop shortcut. Your maps and the `Editor` folder
stay where they are.

## Build from source

`source/mod/build.sh` compiles `Bigorna.dll` with the .NET SDK's C# compiler against the game's own assemblies: copy
the DLLs from your `Legends of the Dark_Data\Managed` folder into `source/refs/` first (they are not included).
`source/editor/salas/montar_salas.py --publico` builds the editor page that goes inside the DLL.

## Language

The mod follows the game's language, in its 13 languages. The editor speaks English and Portuguese: it starts in the
game's language (English when the game is in another one) and has its own choice in its settings.
