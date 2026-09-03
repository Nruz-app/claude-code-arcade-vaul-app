# Reproduce el aviso sonoro de Claude Code (hooks Stop y Notification).
# Pensado para invocarse desde .claude/settings.local.json, que hoy NO lo
# engancha a ningún hook: el script está listo pero inactivo. Nunca debe fallar
# ruidosamente: si el audio no está disponible, el hook simplemente no suena.

$ErrorActionPreference = 'Stop'

try {
    $mp3 = Join-Path $PSScriptRoot '..\references\mp3\claudecode-finished.mp3'
    if (-not (Test-Path $mp3)) { exit 0 }

    Add-Type -AssemblyName presentationCore
    $player = New-Object System.Windows.Media.MediaPlayer
    $player.Open([uri](Resolve-Path $mp3).Path)

    # Open() es asíncrono: hay que dar tiempo a que cargue antes de Play().
    Start-Sleep -Milliseconds 400
    $player.Play()

    # El clip dura ~2.3 s; esperamos a que termine antes de liberar el reproductor.
    Start-Sleep -Seconds 3
    $player.Stop()
    $player.Close()
} catch {
    exit 0
}
