# Bigorna: instalador do mod Bigorna para Descent: Legends of the Dark (janela com etapas).
# Bigorna: installer for the Bigorna mod for Descent: Legends of the Dark (a window with steps).
#
# O que ele faz / what it does:
#   1. acha a pasta do jogo pela Steam (ou pergunta);
#   2. copia Bigorna.dll para "Legends of the Dark_Data\Managed" e registra o mod em ScriptingAssemblies.json e
#      RuntimeInitializeOnLoads.json, as duas listas que o jogo le ao abrir (copia de seguranca *.bigorna-bak na
#      primeira vez);
#   3. poe o editor (Bigorna-Salas.html) em AppData\LocalLow\Fantasy Flight Games\Descent - Legends of the Dark\Editor;
#   4. pede para quem instala abrir o jogo e uma campanha ate o mapa-mundi, e espera: o editor fica bloqueado ate o mod
#      ler a copia do jogo (na tela de titulo) e fotografar o mapa-mundi (numa campanha);
#   5. cria um atalho do editor na Area de Trabalho (opcional).
# Nada e baixado da internet. Fora da pasta do jogo, ele so mexe na pasta Editor dos dados do jogo e no atalho.
#
# Uso: dois cliques em Install-Bigorna.bat (ou Uninstall-Bigorna.bat), ou
#   powershell -STA -ExecutionPolicy Bypass -File install-bigorna.ps1 [-Uninstall] [-GameFolder "D:\Jogos\Legends of the Dark"] [-Console]

param(
    [switch]$Uninstall,
    [string]$GameFolder,
    [switch]$Console,          # sem janela, no terminal (como o instalador antigo)
    [int]$Step = 0,            # etapa inicial (a janela reaberta como administrador comeca na instalacao)
    [switch]$DisableForge,     # tira o DescentForge das listas do jogo
    [string]$DataFolder,       # pasta de dados do jogo (so para testes)
    [string]$Lang              # pt ou en (o padrao segue o Windows)
)
$ErrorActionPreference = 'Stop'
try { Remove-TypeData System.Array -ErrorAction SilentlyContinue } catch { }   # PowerShell 5.1: listas saem como listas no JSON
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = $MyInvocation.MyCommand.Path
$gameName = 'Legends of the Dark'
$processName = 'Legends of the Dark'

# ------------------------------------------------------------------ textos

if (-not $Lang) { try { $Lang = if ((Get-UICulture).Name -like 'pt*') { 'pt' } else { 'en' } } catch { $Lang = 'en' } }
$PT = $Lang -eq 'pt'
function L([string]$pt, [string]$en) { if ($PT) { return $pt } else { return $en } }

$logFile = Join-Path ([IO.Path]::GetTempPath()) 'Bigorna-installer.log'
function Log([string]$msg) {
    $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $msg
    try { Add-Content -Path $logFile -Value $line -Encoding UTF8 } catch { }
    if ($Console) { Write-Host $msg } else { Write-Host $line }
}

# ------------------------------------------------------------------ pastas

function Get-DataFolder {
    if ($DataFolder) { return $DataFolder }
    return (Join-Path (Join-Path (Join-Path (Join-Path $env:USERPROFILE 'AppData') 'LocalLow') 'Fantasy Flight Games') 'Descent - Legends of the Dark')
}
function Get-EditorFolder { return (Join-Path (Get-DataFolder) 'Editor') }
function Get-EditorFile { return (Join-Path (Get-EditorFolder) 'Bigorna-Salas.html') }
function Get-MapsFolder { return (Join-Path (Get-DataFolder) 'CustomMaps') }
function Get-GameData([string]$game) { return (Join-Path $game "${gameName}_Data") }
function Get-Managed([string]$game) { return (Join-Path (Get-GameData $game) 'Managed') }

function Test-GameFolder([string]$game) {
    if (-not $game) { return $false }
    try {
        $d = Get-GameData $game
        return (Test-Path -LiteralPath (Get-Managed $game)) -and (Test-Path -LiteralPath (Join-Path $d 'ScriptingAssemblies.json')) -and (Test-Path -LiteralPath (Join-Path $d 'RuntimeInitializeOnLoads.json'))
    } catch { return $false }
}

# a pasta do jogo: a do parametro, as bibliotecas da Steam (registro e libraryfolders.vdf) ou a pasta padrao
function Find-Game {
    if ($GameFolder) { return $GameFolder.Trim('"') }
    $candidates = New-Object System.Collections.Generic.List[string]
    $steam = $null
    try { $steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction Stop).SteamPath } catch { }
    if (-not $steam) { try { $steam = (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam' -ErrorAction Stop).InstallPath } catch { } }
    if ($steam) {
        $steam = $steam -replace '/', '\'
        $candidates.Add((Join-Path $steam "steamapps\common\$gameName"))
        $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
        if (Test-Path -LiteralPath $vdf) {
            foreach ($m in [regex]::Matches((Get-Content -LiteralPath $vdf -Raw), '"path"\s+"([^"]+)"')) {
                $candidates.Add((Join-Path ($m.Groups[1].Value -replace '\\\\', '\') "steamapps\common\$gameName"))
            }
        }
    }
    if (${env:ProgramFiles(x86)}) { $candidates.Add((Join-Path ${env:ProgramFiles(x86)} "Steam\steamapps\common\$gameName")) }
    if ($env:ProgramFiles) { $candidates.Add((Join-Path $env:ProgramFiles "Steam\steamapps\common\$gameName")) }
    foreach ($p in $candidates) { if (Test-GameFolder $p) { return $p } }
    return $null
}

function Test-Writable([string]$dir) {
    try { $t = Join-Path $dir ('.bigorna-' + [guid]::NewGuid().ToString('N')); [IO.File]::WriteAllText($t, 'x'); Remove-Item -LiteralPath $t -Force; return $true }
    catch { return $false }
}

function Test-Admin {
    try { return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }
    catch { return $false }
}

function Get-GameRunning { return [bool](Get-Process -Name $processName -ErrorAction SilentlyContinue) }

# ------------------------------------------------------------------ registro nas listas do jogo

function Read-Lists([string]$game) {
    $d = Get-GameData $game
    $sa = Join-Path $d 'ScriptingAssemblies.json'
    $ro = Join-Path $d 'RuntimeInitializeOnLoads.json'
    return @{
        SaPath = $sa; RoPath = $ro
        Sa = (Get-Content -LiteralPath $sa -Raw -Encoding UTF8 | ConvertFrom-Json)
        Ro = (Get-Content -LiteralPath $ro -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
}

function Get-Registration([string]$game) {
    $r = @{ Bigorna = $false; Forge = $false; Dll = $false }
    try {
        $l = Read-Lists $game
        $r.Bigorna = @($l.Sa.names) -contains 'Bigorna.dll'
        $r.Forge = (@($l.Sa.names) -contains 'DescentForge.dll') -or [bool](@($l.Ro.root) | Where-Object { $_.assemblyName -eq 'DescentForge' })
        $r.Dll = Test-Path -LiteralPath (Join-Path (Get-Managed $game) 'Bigorna.dll')
    } catch { }
    return $r
}

# grava as duas listas sem o Bigorna (e sem o DescentForge, se pedido) e, na instalacao, com o Bigorna no fim
function Set-Registration([string]$game, [bool]$install, [bool]$dropForge) {
    $l = Read-Lists $game
    foreach ($f in @($l.SaPath, $l.RoPath)) { if (-not (Test-Path -LiteralPath "$f.bigorna-bak")) { Copy-Item -LiteralPath $f "$f.bigorna-bak" } }
    $fora = @('Bigorna.dll'); if ($dropForge) { $fora += 'DescentForge.dll' }
    $names = New-Object System.Collections.ArrayList; $types = New-Object System.Collections.ArrayList
    $n0 = @($l.Sa.names); $t0 = @($l.Sa.types)
    for ($i = 0; $i -lt $n0.Count; $i++) {
        if ($fora -notcontains $n0[$i]) { [void]$names.Add($n0[$i]); [void]$types.Add($t0[$i]) }
    }
    $root = New-Object System.Collections.ArrayList
    foreach ($x in @($l.Ro.root)) {
        if ($x.assemblyName -eq 'Bigorna') { continue }
        if ($dropForge -and $x.assemblyName -eq 'DescentForge') { continue }
        [void]$root.Add($x)
    }
    if ($install) {
        [void]$names.Add('Bigorna.dll'); [void]$types.Add(16)
        [void]$root.Add([pscustomobject][ordered]@{ assemblyName = 'Bigorna'; nameSpace = 'Bigorna'; className = 'Bootstrap'; methodName = 'Init'; loadTypes = 1; isUnityClass = $false })
    }
    $l.Sa.names = $names.ToArray(); $l.Sa.types = $types.ToArray(); $l.Ro.root = $root.ToArray()
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($l.SaPath, ($l.Sa | ConvertTo-Json -Depth 10), $utf8)
    [IO.File]::WriteAllText($l.RoPath, ($l.Ro | ConvertTo-Json -Depth 10), $utf8)
}

function Install-Mod([string]$game, [bool]$dropForge) {
    $src = Join-Path $here 'Bigorna.dll'
    if (-not (Test-Path -LiteralPath $src)) { throw (L "A Bigorna.dll precisa estar ao lado deste instalador ($here)." "Bigorna.dll must be next to this installer ($here).") }
    $dll = Join-Path (Get-Managed $game) 'Bigorna.dll'
    Copy-Item -LiteralPath $src $dll -Force
    try { Unblock-File -LiteralPath $dll -ErrorAction SilentlyContinue } catch { }
    $off = "$dll.off"; if (Test-Path -LiteralPath $off) { Remove-Item -LiteralPath $off -Force }
    Set-Registration $game $true $dropForge
    Log "Bigorna.dll -> $dll"
    Log (L 'Bigorna registrado nas listas do jogo.' 'Bigorna registered in the game lists.')
    if ($dropForge) { Log (L 'DescentForge tirado das listas do jogo.' 'DescentForge taken out of the game lists.') }
}

function Uninstall-Mod([string]$game) {
    Set-Registration $game $false $false
    $dll = Join-Path (Get-Managed $game) 'Bigorna.dll'
    if (Test-Path -LiteralPath $dll) { Move-Item -LiteralPath $dll "$dll.off" -Force }
    Remove-Shortcut
    Log (L "Bigorna removido de $game" "Bigorna removed from $game")
}

function Get-ModVersion {
    try { return [Reflection.AssemblyName]::GetAssemblyName((Join-Path $here 'Bigorna.dll')).Version.ToString(3) } catch { return '' }
}

# ------------------------------------------------------------------ editor

# o editor do pacote (o mesmo que vai dentro da DLL) na pasta Editor, para o atalho funcionar desde ja
# a lingua escolhida aqui vale para o mod (bigorna-idioma.txt, lido no jogo) e para o editor (bigorna-idioma.js, ao lado dele)
function Save-Language {
    try {
        $utf8 = New-Object System.Text.UTF8Encoding($false)
        New-Item -ItemType Directory -Force -Path (Get-EditorFolder) | Out-Null
        [IO.File]::WriteAllText((Join-Path (Get-DataFolder) 'bigorna-idioma.txt'), $Lang, $utf8)
        [IO.File]::WriteAllText((Join-Path (Get-EditorFolder) 'bigorna-idioma.js'), "window.BIGORNA_IDIOMA = `"$Lang`";`n", $utf8)
        Log ('idioma do mod e do editor: ' + $Lang)
    } catch { Log ('ERRO gravando o idioma: ' + $_.Exception.Message) }
}

function Install-Editor {
    Save-Language
    $src = Join-Path $here 'Bigorna-Salas.html'
    if (-not (Test-Path -LiteralPath $src)) { return $false }
    New-Item -ItemType Directory -Force -Path (Get-EditorFolder) | Out-Null
    Copy-Item -LiteralPath $src (Get-EditorFile) -Force
    try { Unblock-File -LiteralPath (Get-EditorFile) -ErrorAction SilentlyContinue } catch { }
    Log ('Bigorna-Salas.html -> ' + (Get-EditorFile))
    return $true
}

function Get-EditorReady {
    $ed = Get-EditorFolder
    $r = @{ Data = Test-Path -LiteralPath (Join-Path $ed 'bigorna-game-data.js'); Map = $false }
    try {
        $m = Join-Path $ed 'bigorna-worldmap.js'
        if (Test-Path -LiteralPath $m) { $t = [IO.File]::ReadAllText($m); $r.Map = $t.Contains('"act1":"data:') -or $t.Contains('"act2":"data:') }
    } catch { }
    return $r
}

# o numero do jogo na Steam, lido do manifesto da biblioteca onde ele esta
function Get-AppId([string]$game) {
    try {
        $f = Join-Path $game 'steam_appid.txt'
        if (Test-Path -LiteralPath $f) { $v = (Get-Content -LiteralPath $f -Raw).Trim(); if ($v -match '^\d+$') { return $v } }
        $steamapps = Split-Path (Split-Path $game -Parent) -Parent
        $leaf = Split-Path $game -Leaf
        foreach ($m in Get-ChildItem -LiteralPath $steamapps -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue) {
            $t = Get-Content -LiteralPath $m.FullName -Raw
            $dir = [regex]::Match($t, '"installdir"\s+"([^"]+)"')
            $id = [regex]::Match($t, '"appid"\s+"(\d+)"')
            if ($dir.Success -and $id.Success -and $dir.Groups[1].Value -eq $leaf) { return $id.Groups[1].Value }
        }
    } catch { }
    return $null
}

# abre o jogo quando quem instala pede (botao "Abrir o jogo"). Pelo Explorer, para o jogo abrir como usuario comum
# mesmo quando o instalador roda como administrador.
function Start-Game([string]$game) {
    $id = Get-AppId $game
    $alvo = if ($id) { "steam://rungameid/$id" } else { Join-Path $game "$gameName.exe" }
    Log ((L 'Abrindo o jogo: ' 'Opening the game: ') + $alvo)
    Start-Process explorer.exe -ArgumentList "`"$alvo`""
}

# ------------------------------------------------------------------ atalho

function Get-ShortcutPath {
    $desk = [Environment]::GetFolderPath('Desktop')
    if (-not $desk) { return $null }
    return (Join-Path $desk 'Bigorna Rooms.url')
}

# um atalho de internet (arquivo de texto) para o editor, que abre no navegador padrao
function New-Shortcut {
    $p = Get-ShortcutPath; if (-not $p) { return }
    $url = 'file:///' + ((Get-EditorFile) -replace '\\', '/')
    [IO.File]::WriteAllText($p, "[InternetShortcut]`r`nURL=$url`r`n")
    Log (L "Atalho criado: $p" "Shortcut created: $p")
}

function Remove-Shortcut {
    $p = Get-ShortcutPath
    if ($p -and (Test-Path -LiteralPath $p)) { Remove-Item -LiteralPath $p -Force; Log (L 'Atalho removido.' 'Shortcut removed.') }
}

function Restart-AsAdmin([string[]]$extra) {
    $a = @('-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', "`"$scriptPath`"", '-Lang', $Lang) + $extra
    Log (L 'Pedindo permissão de administrador...' 'Asking for administrator rights...')
    Start-Process powershell -Verb RunAs -ArgumentList $a
}

# os arquivos do pacote vieram da internet: tira a marca para o Windows nao bloquear o script nem a DLL
try { Get-ChildItem -LiteralPath $here -File | Unblock-File -ErrorAction SilentlyContinue } catch { }

# ================================================================== modo terminal

if ($Console) {
    $game = Find-Game
    if (-not $game) { $game = (Read-Host (L "Pasta do jogo (a que tem `"$gameName.exe`")" "Game folder (the one with `"$gameName.exe`")")).Trim('"') }
    if (-not (Test-GameFolder $game)) { throw (L "Esta pasta não tem o jogo: $game" "This is not the game folder: $game") }
    if (Get-GameRunning) { throw (L 'Feche o jogo antes de instalar.' 'Close the game before installing.') }
    if (-not (Test-Writable (Get-Managed $game))) {
        $x = @('-Console', '-GameFolder', "`"$game`""); if ($Uninstall) { $x += '-Uninstall' }; if ($DisableForge) { $x += '-DisableForge' }
        Restart-AsAdmin $x; exit
    }
    if ($Uninstall) { Uninstall-Mod $game; exit }
    $reg = Get-Registration $game
    Install-Mod $game ([bool]$DisableForge)
    if ($reg.Forge -and -not $DisableForge) { Log (L 'Aviso: o DescentForge continua registrado; os dois mods rodariam juntos. Use -DisableForge para tirá-lo.' 'Note: DescentForge is still registered; both mods would run together. Use -DisableForge to take it out.') }
    [void](Install-Editor)
    # o editor so libera com os dados e a foto do mapa: a instalacao espera por eles
    $pr = Get-EditorReady
    if (-not ($pr.Data -and $pr.Map)) {
        Log (L 'Para liberar o editor: abra o jogo, espere na tela de título o aviso de dados prontos (alguns minutos na primeira vez) e depois abra uma campanha do jogo até o mapa-múndi. Esperando... (Ctrl+C interrompe; o mod continua instalado)' 'To unlock the editor: start the game, wait on the title screen for the data-ready notice (a few minutes the first time), then open a campaign of the game up to the world map. Waiting... (Ctrl+C stops; the mod stays installed)')
        $viuDados = $pr.Data
        while (-not ($pr.Data -and $pr.Map)) {
            Start-Sleep -Seconds 2
            $pr = Get-EditorReady
            if ($pr.Data -and -not $viuDados) { $viuDados = $true; Log (L 'Dados do jogo prontos. Agora abra uma campanha até o mapa-múndi.' 'Game data ready. Now open a campaign up to the world map.') }
        }
    }
    Log (L "Editor liberado: $(Get-EditorFile)" "Editor unlocked: $(Get-EditorFile)")
    exit
}

# ================================================================== janela

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# medidas em pixels de 96 ppp, multiplicadas pela escala da tela (as fontes, em pontos, ja crescem sozinhas)
$K = 1.0
try { $g = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero); $K = $g.DpiX / 96.0; $g.Dispose() } catch { }
function Set-Box($c, [int]$x, [int]$y, [int]$w, [int]$h) { $c.SetBounds([int]($x * $K), [int]($y * $K), [int]($w * $K), [int]($h * $K)) }

$S = @{
    Game = $null; Step = 0; Installed = $false; Ready = $false; Launched = $false
}

$cBack = [System.Drawing.Color]::FromArgb(250, 248, 244)
$cSide = [System.Drawing.Color]::FromArgb(44, 40, 36)
$cSideText = [System.Drawing.Color]::FromArgb(200, 190, 175)
$cSideOn = [System.Drawing.Color]::FromArgb(255, 214, 140)
$cOk = [System.Drawing.Color]::FromArgb(40, 120, 60)
$cBad = [System.Drawing.Color]::FromArgb(170, 50, 40)
$cWarn = [System.Drawing.Color]::FromArgb(150, 100, 20)
$fontBase = New-Object System.Drawing.Font('Segoe UI', 9.5)
$fontTitle = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Bold)
$fontStep = New-Object System.Drawing.Font('Segoe UI', 10)
$fontStepOn = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)

$form = New-Object System.Windows.Forms.Form
function Set-FormTitle { $form.Text = (L 'Instalador do Bigorna' 'Bigorna installer') + $(if ((Get-ModVersion)) { ' ' + (Get-ModVersion) } else { '' }) }
Set-FormTitle
$form.ClientSize = New-Object System.Drawing.Size([int](760 * $K), [int](500 * $K))
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = $cBack
$form.Font = $fontBase
$form.AutoScaleMode = 'None'

$side = New-Object System.Windows.Forms.Panel
Set-Box $side 0 0 210 500
$side.BackColor = $cSide
$form.Controls.Add($side)

$brand = New-Object System.Windows.Forms.Label
$brand.Text = 'Bigorna'
$brand.Font = New-Object System.Drawing.Font('Segoe UI', 18, [System.Drawing.FontStyle]::Bold)
$brand.ForeColor = $cSideOn
Set-Box $brand 20 20 180 40
$side.Controls.Add($brand)

function Get-StepNames { return @((L 'Boas-vindas' 'Welcome'), (L 'Pasta do jogo' 'Game folder'), (L 'Instalar o mod' 'Install the mod'), (L 'Liberar o editor' 'Unlock the editor'), (L 'Pronto' 'Done')) }
$stepNames = Get-StepNames
$stepLabels = @()
for ($i = 0; $i -lt $stepNames.Count; $i++) {
    $lb = New-Object System.Windows.Forms.Label
    Set-Box $lb 20 (90 + $i * 38) 185 30
    $lb.ForeColor = $cSideText
    $lb.Font = $fontStep
    $side.Controls.Add($lb)
    $stepLabels += $lb
}

# idioma: segue o Windows na abertura e pode ser trocado aqui a qualquer momento
$langLabel = New-Object System.Windows.Forms.Label
$langLabel.Text = 'Idioma do mod / Language'
$langLabel.ForeColor = $cSideText
Set-Box $langLabel 20 418 180 20
$side.Controls.Add($langLabel)
$langBox = New-Object System.Windows.Forms.ComboBox
$langBox.DropDownStyle = 'DropDownList'
[void]$langBox.Items.AddRange(@('Português', 'English'))
$langBox.SelectedIndex = $(if ($PT) { 0 } else { 1 })
Set-Box $langBox 20 442 170 26
$side.Controls.Add($langBox)

$title = New-Object System.Windows.Forms.Label
Set-Box $title 235 20 500 36
$title.Font = $fontTitle
$form.Controls.Add($title)

$body = New-Object System.Windows.Forms.Panel
Set-Box $body 235 64 505 370
$form.Controls.Add($body)

$btnBack = New-Object System.Windows.Forms.Button
Set-Box $btnBack 440 452 95 32; $btnBack.Text = (L '< Voltar' '< Back')
$btnNext = New-Object System.Windows.Forms.Button
Set-Box $btnNext 540 452 110 32
$btnCancel = New-Object System.Windows.Forms.Button
Set-Box $btnCancel 655 452 90 32; $btnCancel.Text = (L 'Cancelar' 'Cancel')
$form.Controls.AddRange(@($btnBack, $btnNext, $btnCancel))
$form.AcceptButton = $btnNext

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000


function Show-Error([string]$msg) {
    Log ('ERRO: ' + $msg)
    [void][System.Windows.Forms.MessageBox]::Show($form, $msg, 'Bigorna', 'OK', 'Error')
}

function New-Text([string]$text, [int]$y, [int]$h, $color) {
    $lb = New-Object System.Windows.Forms.Label
    $lb.Text = $text
    Set-Box $lb 0 $y 500 $h
    if ($color) { $lb.ForeColor = $color }
    $body.Controls.Add($lb)
    return $lb
}

function New-Check([string]$text, [int]$y, [bool]$checked) {
    $c = New-Object System.Windows.Forms.CheckBox
    $c.Text = $text; $c.Checked = $checked
    Set-Box $c 0 $y 500 40
    $body.Controls.Add($c)
    return $c
}

function New-Button([string]$text, [int]$x, [int]$y, [int]$w) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text; Set-Box $b $x $y $w 32
    $body.Controls.Add($b)
    return $b
}

$ui = @{}

function Update-Side {
    for ($i = 0; $i -lt $stepLabels.Count; $i++) {
        $mark = if ($i -lt $S.Step) { [string][char]0x2713 } elseif ($i -eq $S.Step) { [string][char]0x25B8 } else { [string][char]0x2022 }
        $stepLabels[$i].Text = $mark + '  ' + $stepNames[$i]
        $stepLabels[$i].ForeColor = if ($i -eq $S.Step) { $cSideOn } else { $cSideText }
        $stepLabels[$i].Font = if ($i -eq $S.Step) { $fontStepOn } else { $fontStep }
    }
}

# ------------------------------------------------------------------ etapa 1: pasta do jogo

function Update-GameCheck {
    $p = $ui.Path.Text.Trim().Trim('"')
    $S.Game = $null
    $ui.Forge.Visible = $false
    $lines = @(); $color = $cOk
    if (-not (Test-GameFolder $p)) {
        $lines += [string][char]0x2717 + ' ' + (L "Esta pasta não tem o jogo. Escolha a pasta que tem `"$gameName.exe`"." "This folder does not have the game. Pick the folder with `"$gameName.exe`".")
        $color = $cBad
    } else {
        $S.Game = $p
        $reg = Get-Registration $p
        $lines += [string][char]0x2713 + ' ' + (L 'Jogo encontrado.' 'Game found.')
        if ($reg.Bigorna) { $lines += (L 'O Bigorna já está instalado aqui e será atualizado.' 'Bigorna is already installed here and will be updated.') }
        if (-not (Test-Writable (Get-Managed $p))) { $lines += (L 'Esta pasta pede permissão de administrador: o Windows vai perguntar ao avançar.' 'This folder needs administrator rights: Windows asks when you go on.') }
        if (Get-GameRunning) { $lines += [string][char]0x2717 + ' ' + (L 'O jogo está aberto. Feche o jogo para continuar.' 'The game is running. Close it to go on.'); $color = $cWarn }
        $ui.Forge.Visible = $reg.Forge
    }
    $ui.Status.Text = $lines -join "`r`n"
    $ui.Status.ForeColor = $color
    $btnNext.Enabled = [bool]$S.Game
}

# ------------------------------------------------------------------ etapa 2: instalar

function Invoke-Install {
    $ui.Log.Items.Clear()
    try {
        if (Get-GameRunning) { throw (L 'O jogo está aberto. Feche o jogo e tente de novo.' 'The game is running. Close it and try again.') }
        $ui.Log.Items.Add((L 'Pasta do jogo: ' 'Game folder: ') + $S.Game) | Out-Null
        Install-Mod $S.Game ([bool]$DisableForge -or [bool]$S.DropForge)
        $ui.Log.Items.Add([string][char]0x2713 + ' ' + (L 'Bigorna.dll copiada para a pasta Managed.' 'Bigorna.dll copied into the Managed folder.')) | Out-Null
        $ui.Log.Items.Add([string][char]0x2713 + ' ' + (L 'Mod registrado nas listas do jogo (cópia de segurança *.bigorna-bak).' 'Mod registered in the game lists (backup *.bigorna-bak).')) | Out-Null
        if ([bool]$DisableForge -or [bool]$S.DropForge) { $ui.Log.Items.Add([string][char]0x2713 + ' ' + (L 'DescentForge desativado.' 'DescentForge turned off.')) | Out-Null }
        if (Install-Editor) { $ui.Log.Items.Add([string][char]0x2713 + ' ' + (L 'Editor colocado na pasta Editor dos dados do jogo.' 'Editor placed in the Editor folder of the game data.')) | Out-Null }
        $S.Installed = $true
        $ui.Status.Text = (L 'Mod instalado. Avance para liberar o editor.' 'Mod installed. Go on to unlock the editor.')
        $ui.Status.ForeColor = $cOk
        $btnNext.Enabled = $true
    } catch {
        $ui.Log.Items.Add([string][char]0x2717 + ' ' + $_.Exception.Message) | Out-Null
        $ui.Status.Text = (L 'A instalação falhou. Volte, confira a pasta e tente de novo.' 'Installation failed. Go back, check the folder and try again.')
        $ui.Status.ForeColor = $cBad
        Log ('ERRO: ' + $_.Exception.Message)
        $btnNext.Enabled = $false
    }
}

# ------------------------------------------------------------------ etapa 3: liberar o editor

# os tres passos, marcados pelo que aparece na pasta Editor (e pelo jogo aberto)
function Update-Unlock {
    if ($S.Step -ne 3) { return }
    $pr = Get-EditorReady
    $running = Get-GameRunning
    $ok = [string][char]0x2713; $falta = [string][char]0x2022; $agora = [string][char]0x25B8
    $f1 = $running -or $pr.Data -or $pr.Map
    $m1 = if ($f1) { $ok } else { $agora }
    $m2 = if ($pr.Data) { $ok } elseif ($f1) { $agora } else { $falta }
    $m3 = if ($pr.Map) { $ok } elseif ($pr.Data) { $agora } else { $falta }
    $ui.P1.Text = $m1 + ' ' + (L '1. Abra o jogo pela Steam ou pelo botão abaixo.' '1. Start the game from Steam or with the button below.')
    $ui.P2.Text = $m2 + ' ' + (L '2. Espere na tela de título: o mod lê a sua cópia do jogo. Um aviso no canto mostra o andamento; na primeira vez leva alguns minutos.' '2. Wait on the title screen: the mod reads your copy of the game. A notice in the corner shows the progress; the first time takes a few minutes.')
    $ui.P3.Text = $m3 + ' ' + (L '3. Comece ou continue uma campanha do jogo (fora dos mapas da comunidade) até o mapa-múndi aparecer, e espere alguns segundos nele: o mod fotografa o mapa e avisa "o editor está liberado".' '3. Start or continue a campaign of the game (not a community map) until the world map shows, and wait a few seconds on it: the mod pictures the map and says "the editor is unlocked".')
    foreach ($p in @(@($ui.P1, $f1), @($ui.P2, $pr.Data), @($ui.P3, $pr.Map))) { $p[0].ForeColor = if ($p[1]) { $cOk } else { [System.Drawing.SystemColors]::ControlText } }
    $S.Ready = $pr.Data -and $pr.Map
    if ($S.Ready) {
        $ui.Status.Text = (L 'Tudo pronto: o editor está liberado. Você pode fechar o jogo ou continuar jogando, e avançar.' 'All set: the editor is unlocked. You can close the game or keep playing, and go on.')
        $ui.Status.ForeColor = $cOk
        $btnNext.Enabled = $true
        $timer.Stop()
        Log (L 'Editor liberado.' 'Editor unlocked.')
    } else {
        $ui.Status.Text = if ($running) { (L 'Jogo aberto. Esperando...' 'Game running. Waiting...') } elseif ($S.Launched) { (L 'Abrindo o jogo pela Steam...' 'Opening the game through Steam...') } else { (L 'Esperando o jogo...' 'Waiting for the game...') }
        $ui.Status.ForeColor = [System.Drawing.SystemColors]::GrayText
        $btnNext.Enabled = $false
    }
}

$timer.Add_Tick({ try { Update-Unlock } catch { Log ('ERRO no acompanhamento: ' + $_.Exception.Message) } })

# ------------------------------------------------------------------ etapas

function Show-Step([int]$n) {
    $S.Step = $n
    $body.Controls.Clear()
    $ui.Clear()
    $timer.Stop()
    $btnBack.Visible = $n -gt 0 -and $n -lt 3
    $btnBack.Enabled = $true
    $btnNext.Enabled = $true
    $btnNext.Text = (L 'Avançar >' 'Next >')
    $btnCancel.Visible = $n -lt 4
    Update-Side
    switch ($n) {
        0 {
            $title.Text = (L 'Instalar o Bigorna' 'Install Bigorna')
            New-Text (L "Este assistente:`r`n`r`n$([char]0x2022) encontra o Descent: Legends of the Dark no seu computador;`r`n$([char]0x2022) instala o mod Bigorna na pasta do jogo;`r`n$([char]0x2022) coloca o editor Bigorna Rooms na pasta de dados do jogo e cria um atalho dele na Área de Trabalho, se você quiser;`r`n$([char]0x2022) acompanha você abrindo o jogo e uma campanha até o mapa-múndi: nesse caminho o mod lê as peças, monstros, textos e o mapa da sua cópia, e o editor fica liberado.`r`n`r`nO pacote traz só código próprio. O conteúdo do jogo sai da sua cópia instalada e fica no seu computador.`r`n`r`nProjeto de fã, sem vínculo com a Fantasy Flight Games ou a Asmodee. É preciso ter o jogo." "This wizard:`r`n`r`n$([char]0x2022) finds Descent: Legends of the Dark on your computer;`r`n$([char]0x2022) installs the Bigorna mod in the game folder;`r`n$([char]0x2022) puts the Bigorna Rooms editor in the game data folder and makes a desktop shortcut to it, if you want one;`r`n$([char]0x2022) walks you through starting the game and a campaign up to the world map: on the way, the mod reads the tiles, monsters, texts and map of your copy, and the editor unlocks.`r`n`r`nThe package holds only its own code. The game content comes from your installed copy and stays on your computer.`r`n`r`nA fan project, not affiliated with Fantasy Flight Games or Asmodee. You need the game.") 0 300 $null | Out-Null
            $u = New-Object System.Windows.Forms.LinkLabel
            $u.Text = (L 'Desinstalar o Bigorna...' 'Uninstall Bigorna...')
            Set-Box $u 0 330 300 24
            $u.Add_LinkClicked({ Invoke-UninstallUi })
            $body.Controls.Add($u)
        }
        1 {
            $title.Text = (L 'Pasta do jogo' 'Game folder')
            New-Text (L "A pasta onde o jogo está instalado (a que tem `"$gameName.exe`"):" "The folder where the game is installed (the one with `"$gameName.exe`"):") 0 22 $null | Out-Null
            $tb = New-Object System.Windows.Forms.TextBox
            Set-Box $tb 0 26 395 26
            $body.Controls.Add($tb)
            $ui.Path = $tb
            $b = New-Button (L 'Procurar...' 'Browse...') 402 24 98
            $b.Add_Click({
                $d = New-Object System.Windows.Forms.FolderBrowserDialog
                $d.Description = (L "Escolha a pasta que tem `"$gameName.exe`"" "Pick the folder with `"$gameName.exe`"")
                if ($ui.Path.Text -and (Test-Path -LiteralPath $ui.Path.Text)) { $d.SelectedPath = $ui.Path.Text }
                if ($d.ShowDialog($form) -eq 'OK') { $ui.Path.Text = $d.SelectedPath }
            })
            $ui.Status = New-Text '' 66 90 $null
            $ui.Forge = New-Check (L 'O DescentForge também está instalado. Desativar o DescentForge (recomendado: os dois juntos entram em conflito; ele pode ser reinstalado depois pelo instalador dele).' 'DescentForge is also installed. Turn DescentForge off (recommended: the two together clash; it can be reinstalled later with its own installer).') 165 $true
            $ui.Forge.Height = [int](56 * $K)
            $ui.Forge.Add_CheckedChanged({ $S.DropForge = $ui.Forge.Checked })
            $again = New-Button (L 'Conferir de novo' 'Check again') 0 235 150
            $again.Add_Click({ Update-GameCheck })
            $found = if ($S.Game) { $S.Game } else { Find-Game }
            if ($found) { $tb.Text = $found }
            $tb.Add_TextChanged({ Update-GameCheck })
            Update-GameCheck
            $S.DropForge = $ui.Forge.Visible -and $ui.Forge.Checked
        }
        2 {
            $title.Text = (L 'Instalar o mod' 'Install the mod')
            $lb = New-Object System.Windows.Forms.ListBox
            Set-Box $lb 0 0 500 200
            $lb.HorizontalScrollbar = $true
            $body.Controls.Add($lb)
            $ui.Log = $lb
            $ui.Status = New-Text '' 212 60 $null
            $ui.Note = New-Text (L 'Depois de uma atualização do jogo, rode este instalador de novo: a atualização reescreve as listas do jogo.' 'After a game update, run this installer again: the update rewrites the game lists.') 290 40 $null
            $btnNext.Enabled = $false
            Invoke-Install
        }
        3 {
            $title.Text = (L 'Liberar o editor' 'Unlock the editor')
            New-Text (L 'Falta a última parte. O editor usa as peças, monstros, textos e o mapa da sua cópia do jogo, e o mod lê tudo isso com o jogo aberto. Faça estes passos; esta janela acompanha sozinha.' 'One last part. The editor uses the tiles, monsters, texts and map of your copy of the game, and the mod reads them with the game running. Follow these steps; this window keeps track by itself.') 0 56 $null | Out-Null
            $ui.P1 = New-Text '' 62 44 $null
            $ui.Go = New-Button (L 'Abrir o jogo' 'Start the game') 0 108 150
            $ui.Go.Add_Click({ try { Start-Game $S.Game; $S.Launched = $true; Update-Unlock } catch { Show-Error $_.Exception.Message } })
            $ui.P2 = New-Text '' 150 58 $null
            $ui.P3 = New-Text '' 210 76 $null
            $ui.Status = New-Text '' 292 60 $null
            $btnNext.Enabled = $false
            Update-Unlock
            $timer.Start()
        }
        4 {
            $title.Text = (L 'Pronto' 'Done')
            $ok = [string][char]0x2713
            $t = @()
            $t += $ok + ' ' + (L "Mod instalado em $($S.Game)" "Mod installed in $($S.Game)")
            $t += $ok + ' ' + (L 'Editor liberado, com os dados e o mapa da sua cópia do jogo.' 'Editor unlocked, with the data and map of your copy of the game.')
            $t += ''
            $t += (L "O mapa-múndi do outro ato entra no editor quando você chegar a ele no jogo.`r`nO editor abre no Chrome ou no Edge, sem internet. Os mapas exportados vão para a pasta CustomMaps, e o jogo mostra todos em `"Mapas da comunidade`", na tela de título." "The other act's world map enters the editor when you reach it in the game.`r`nThe editor opens in Chrome or Edge, with no internet. Exported maps go to the CustomMaps folder, and the game lists them under `"Mapas da comunidade`" on the title screen.")
            New-Text ($t -join "`r`n") 0 170 $null | Out-Null
            $ui.Shortcut = New-Check (L 'Criar um atalho do editor na Área de Trabalho' 'Make a desktop shortcut to the editor') 180 $true
            $ui.Shortcut.Height = [int](26 * $K)
            $ed = New-Button (L 'Abrir o editor' 'Open the editor') 0 218 160
            $ed.Enabled = Test-Path -LiteralPath (Get-EditorFile)
            $ed.Add_Click({ try { Start-Process (Get-EditorFile) } catch { Show-Error $_.Exception.Message } })
            $mp = New-Button (L 'Abrir a pasta dos mapas' 'Open the maps folder') 170 218 190
            $mp.Add_Click({ try { New-Item -ItemType Directory -Force -Path (Get-MapsFolder) | Out-Null; Start-Process explorer.exe -ArgumentList "`"$(Get-MapsFolder)`"" } catch { Show-Error $_.Exception.Message } })
            New-Text ((L 'Registro desta instalação: ' 'Log of this installation: ') + $logFile) 270 40 ([System.Drawing.Color]::Gray) | Out-Null
            $btnNext.Text = (L 'Concluir' 'Finish')
        }
    }
}

function Invoke-Next {
    switch ($S.Step) {
        0 { Show-Step 1 }
        1 {
            Update-GameCheck
            if (-not $S.Game) { return }
            if (Get-GameRunning) { Show-Error (L 'O jogo está aberto. Feche o jogo para continuar.' 'The game is running. Close it to go on.'); return }
            if (-not (Test-Writable (Get-Managed $S.Game)) -and -not (Test-Admin)) {
                $x = @('-Step', '2', '-GameFolder', "`"$($S.Game)`""); if ($S.DropForge) { $x += '-DisableForge' }
                try { Restart-AsAdmin $x; $form.Close() } catch { Show-Error (L 'Sem a permissão de administrador, o mod fica sem instalar nesta pasta.' 'Without administrator rights, the mod cannot be installed in this folder.') }
                return
            }
            Show-Step 2
        }
        2 { if ($S.Installed) { Show-Step 3 } }
        3 { Update-Unlock; if ($S.Ready) { Show-Step 4 } }
        4 {
            Save-Language
            if ($ui.Shortcut.Checked) { try { New-Shortcut } catch { Show-Error $_.Exception.Message } }
            $form.Close()
        }
    }
}

function Invoke-UninstallUi {
    $game = if ($GameFolder) { $GameFolder.Trim('"') } else { Find-Game }
    if (-not (Test-GameFolder $game)) {
        $d = New-Object System.Windows.Forms.FolderBrowserDialog
        $d.Description = (L "Escolha a pasta que tem `"$gameName.exe`"" "Pick the folder with `"$gameName.exe`"")
        if ($d.ShowDialog($form) -ne 'OK') { return }
        $game = $d.SelectedPath
        if (-not (Test-GameFolder $game)) { Show-Error (L 'Esta pasta não tem o jogo.' 'This folder does not have the game.'); return }
    }
    $q = [System.Windows.Forms.MessageBox]::Show($form, (L "Tirar o Bigorna do jogo em:`r`n$game`r`n`r`nOs seus mapas e a pasta Editor ficam onde estão." "Take Bigorna out of the game in:`r`n$game`r`n`r`nYour maps and the Editor folder stay where they are."), 'Bigorna', 'YesNo', 'Question')
    if ($q -ne 'Yes') { return }
    if (Get-GameRunning) { Show-Error (L 'Feche o jogo antes de desinstalar.' 'Close the game before uninstalling.'); return }
    if (-not (Test-Writable (Get-Managed $game)) -and -not (Test-Admin)) {
        try { Restart-AsAdmin @('-Uninstall', '-GameFolder', "`"$game`""); $form.Close() } catch { Show-Error $_.Exception.Message }
        return
    }
    try {
        Uninstall-Mod $game
        [void][System.Windows.Forms.MessageBox]::Show($form, (L 'Bigorna desinstalado.' 'Bigorna uninstalled.'), 'Bigorna', 'OK', 'Information')
        $form.Close()
    } catch { Show-Error $_.Exception.Message }
}

function Set-Language([bool]$pt) {
    if ($pt -eq $script:PT) { return }
    $script:PT = $pt; $script:Lang = $(if ($pt) { 'pt' } else { 'en' })
    Log ('idioma: ' + $script:Lang)
    Set-FormTitle
    if ($S.Installed -or $S.Step -ge 3) { Save-Language }   # depois da instalacao, a troca vale para o mod e o editor
    $script:stepNames = Get-StepNames
    $btnBack.Text = (L '< Voltar' '< Back'); $btnCancel.Text = (L 'Cancelar' 'Cancel')
    switch ($S.Step) {
        1 { $path = $ui.Path.Text; $forge = $ui.Forge.Checked; Show-Step 1; $ui.Path.Text = $path; $ui.Forge.Checked = $forge; Update-GameCheck }
        2 {
            # a instalacao ja rodou: so os textos mudam (refazer a etapa instalaria de novo)
            Update-Side
            $title.Text = (L 'Instalar o mod' 'Install the mod')
            $ui.Note.Text = (L 'Depois de uma atualização do jogo, rode este instalador de novo: a atualização reescreve as listas do jogo.' 'After a game update, run this installer again: the update rewrites the game lists.')
            if ($S.Installed) { $ui.Status.Text = (L 'Mod instalado. Avance para liberar o editor.' 'Mod installed. Go on to unlock the editor.') }
            else { $ui.Status.Text = (L 'A instalação falhou. Volte, confira a pasta e tente de novo.' 'Installation failed. Go back, check the folder and try again.') }
            $btnNext.Text = (L 'Avançar >' 'Next >')
        }
        4 { $sc = $ui.Shortcut.Checked; Show-Step 4; $ui.Shortcut.Checked = $sc }
        default { Show-Step $S.Step }
    }
}
$langBox.Add_SelectedIndexChanged({ try { Set-Language ($langBox.SelectedIndex -eq 0) } catch { Show-Error $_.Exception.Message } })

$btnNext.Add_Click({ try { Invoke-Next } catch { Show-Error $_.Exception.Message } })
$btnBack.Add_Click({ try { if ($S.Step -eq 2) { Show-Step 1 } else { Show-Step ($S.Step - 1) } } catch { Show-Error $_.Exception.Message } })
$btnCancel.Add_Click({ $form.Close() })
$form.Add_FormClosing({
    param($quem, $e)
    if ($S.Step -eq 3 -and -not $S.Ready) {
        $q = [System.Windows.Forms.MessageBox]::Show($form, (L 'O mod já está instalado, mas o editor continua bloqueado até o mapa-múndi ser fotografado. Sair mesmo assim? Rode o instalador de novo para concluir esta etapa, ou siga os passos no jogo: o editor mostra o que falta.' 'The mod is installed, but the editor stays locked until the world map is pictured. Quit anyway? Run the installer again to finish this step, or follow the steps in the game: the editor shows what is missing.'), 'Bigorna', 'YesNo', 'Warning')
        if ($q -ne 'Yes') { $e.Cancel = $true; return }
    }
    $timer.Stop()
})
$form.Add_Shown({
    try {
        if ($Uninstall) { Show-Step 0; Invoke-UninstallUi; if ($form.Visible) { $form.Close() }; return }
        if ($Step -ge 2 -and $GameFolder) {
            $S.Game = $GameFolder.Trim('"'); $S.DropForge = [bool]$DisableForge
            Show-Step 2
        } else { Show-Step 0 }
        $form.Activate()
    } catch { Show-Error $_.Exception.Message }
})

Log ('Bigorna installer ' + (Get-ModVersion) + ' | ' + $here)
[void]$form.ShowDialog()
