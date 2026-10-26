# Requiere Windows PowerShell 5.1. No necesita permisos de administrador.
param([ValidateSet('Instalar','Descargar','Hash')][string]$Accion = 'Descargar')
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Base = Join-Path $env:LOCALAPPDATA 'CroaciaRemitos'
$ConfigPath = Join-Path $Base 'config.json'
$TokenPath = Join-Path $Base 'acceso.xml'
$Servidor = 'https://gestion-croacia.vercel.app'
function GuardarJson($Objeto, $Destino) {
    $Temporal = $Destino + '.tmp'
    $Objeto | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $Temporal -Encoding UTF8
    Move-Item -LiteralPath $Temporal -Destination $Destino -Force
}
function Clave {
    $S = Import-Clixml -LiteralPath $TokenPath
    $P = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($S)
    try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($P) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($P) }
}
function HashTexto([string]$Texto) {
    $Sha = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($Sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Texto)))).Replace('-','').ToLowerInvariant() }
    finally { $Sha.Dispose() }
}
function NombreSeguro([string]$Texto) {
    $N = [regex]::Replace($Texto, '[\x00-\x1f<>:"/\\|?*]', '_').Trim().TrimEnd('.')
    if (!$N) { $N = 'Sin cliente' }
    if ($N.Length -gt 30) { $N = $N.Substring(0,30).TrimEnd('.') }
    return $N
}
if ($Accion -eq 'Instalar') {
    Add-Type -AssemblyName System.Windows.Forms
    $Dialogo = New-Object System.Windows.Forms.FolderBrowserDialog
    $Dialogo.Description = 'Elegi una carpeta del disco para la PRUEBA de remitos'
    if ($Dialogo.ShowDialog() -ne 'OK') { exit 0 }
    $Destino = Join-Path $Dialogo.SelectedPath 'Croacia-Remitos-PRUEBA'
    if ($Destino.Length -gt 80 -or $Destino.StartsWith('\\')) { throw 'Elegi una carpeta local con una ruta mas corta.' }
    if (Test-Path -LiteralPath $ConfigPath) { throw 'Ya esta instalado. No se reemplazo la configuracion existente.' }
    New-Item -ItemType Directory -Path $Base -Force | Out-Null
    New-Item -ItemType Directory -Path $Destino -Force | Out-Null
    $Bytes = New-Object byte[] 32
    $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $Rng.GetBytes($Bytes) } finally { $Rng.Dispose() }
    $Token = [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    ConvertTo-SecureString $Token -AsPlainText -Force | Export-Clixml -LiteralPath $TokenPath
    $Marca = [guid]::NewGuid().ToString()
    Set-Content -LiteralPath (Join-Path $Destino '.croacia-disco') -Value $Marca -Encoding ASCII
    GuardarJson @{ destino=$Destino; marca=$Marca; servidor=$Servidor; tipos=@('visita','fabrica') } $ConfigPath
    Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $Base 'Croacia-Remitos.ps1') -Force
    $Hash = HashTexto $Token
    Set-Content -LiteralPath (Join-Path $Base 'Activacion.txt') -Value $Hash -Encoding ASCII
    Write-Host 'Instalado en modo manual. Todavia NO descarga ni tiene horario automatico.'
    Write-Host 'Se abre Activacion.txt: ese hash NO es una clave. Envialo para habilitar la copia.'
    Start-Process notepad.exe -ArgumentList ('"' + (Join-Path $Base 'Activacion.txt') + '"')
    exit 0
}
if (!(Test-Path -LiteralPath $ConfigPath)) { throw 'Primero ejecuta Instalar.cmd.' }
$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($Accion -eq 'Hash') { Write-Output (HashTexto (Clave)); exit 0 }
$Destino = [string]$Config.destino
# Nunca crear la carpeta raiz si se desconecto/cambio el disco.
$MarcaPath = Join-Path $Destino '.croacia-disco'
if (!(Test-Path -LiteralPath $MarcaPath) -or (Get-Content -LiteralPath $MarcaPath -Raw).Trim() -ne $Config.marca) { throw 'No se encontro el disco correcto. Conectalo y reintenta. No se cambio ningun PDF.' }
$Lock = $null
try {
    try { $Lock = [IO.File]::Open((Join-Path $Destino '.descarga.lock'), 'OpenOrCreate','ReadWrite','None') }
    catch { throw 'Ya hay otra descarga en curso.' }
    $EstadoPath = Join-Path $Destino 'estado.json'
    $Estado = @{}
    if (Test-Path -LiteralPath $EstadoPath) {
        $Guardado = Get-Content -LiteralPath $EstadoPath -Raw | ConvertFrom-Json
        foreach ($Prop in $Guardado.PSObject.Properties) { $Estado[$Prop.Name] = $Prop.Value }
    }
    $Headers = @{ Authorization = 'Bearer ' + (Clave) }
    $Nuevos = 0; $SinCambios = 0
    foreach ($Tipo in $Config.tipos) {
        $Despues = '0'; $Paginas = 0
        do {
            if (++$Paginas -gt 100000) { throw 'Listado demasiado largo. No se borro nada.' }
            $Listado = Invoke-RestMethod -Uri "$Servidor/api/copia-remitos?tipo=$Tipo&despues=$Despues" -Headers $Headers -TimeoutSec 90
            if ($Listado.version -ne 1) { throw 'Respuesta inesperada del servidor.' }
            foreach ($Doc in $Listado.documentos) {
                if ($Doc.tipo -ne $Tipo -or [string]$Doc.id -notmatch '^[1-9]\d*$' -or $Doc.revision -notmatch '^[a-f0-9]{64}$' -or $Doc.fecha -notmatch '^(\d{4}-\d{2}-\d{2}|sin-fecha)$') { throw 'Listado de documentos invalido.' }
                $Key = "$Tipo-$($Doc.id)"
                $Viejo = $Estado[$Key]
                $Carpeta = Join-Path $Destino $Tipo
                New-Item -ItemType Directory -Path $Carpeta -Force | Out-Null
                # ID y revision evitan colisiones; nunca se sobrescribe una version previa.
                $Nombre = '{0} - {1} - {2} - id{3} - {4}.pdf' -f (NombreSeguro ([string]$Doc.numero)), (NombreSeguro ([string]$Doc.cliente)), $Doc.fecha, $Doc.id, $Doc.revision.Substring(0,16)
                $Final = Join-Path $Carpeta $Nombre
                if ($Viejo -and $Viejo.revision -eq $Doc.revision -and (Test-Path -LiteralPath $Final) -and (Get-FileHash -LiteralPath $Final -Algorithm SHA256).Hash -eq $Viejo.sha256) { $SinCambios++; continue }
                $Temporal = Join-Path $Carpeta ([guid]::NewGuid().ToString() + '.partial')
                try {
                    Invoke-WebRequest -UseBasicParsing -Uri "$Servidor/api/copia-remitos/$Tipo/$($Doc.id)?revision=$($Doc.revision)" -Headers $Headers -OutFile $Temporal -TimeoutSec 90 | Out-Null
                    $Stream = [IO.File]::OpenRead($Temporal)
                    try { $Inicio = New-Object byte[] 5; $Leidos = $Stream.Read($Inicio,0,5) }
                    finally { $Stream.Dispose() }
                    if ($Leidos -ne 5 -or [Text.Encoding]::ASCII.GetString($Inicio) -ne '%PDF-') { throw 'El servidor no devolvio un PDF. No se reemplazo ninguna copia.' }
                    if ((Get-Item -LiteralPath $Temporal).Length -gt 52428800) { throw 'PDF demasiado grande.' }
                    $Sha = (Get-FileHash -LiteralPath $Temporal -Algorithm SHA256).Hash
                    # Si una copia se corrompio, conservarla para revisar.
                    if (Test-Path -LiteralPath $Final) { Move-Item -LiteralPath $Final -Destination (Join-Path $Carpeta ('danado-' + [guid]::NewGuid().ToString() + '.pdf')) }
                    Move-Item -LiteralPath $Temporal -Destination $Final
                    $Estado[$Key] = @{ numero=$Doc.numero; cliente=$Doc.cliente; fecha=$Doc.fecha; tipo=$Tipo; revision=$Doc.revision; archivo=$Final; sha256=$Sha; descargado=(Get-Date).ToString('o') }
                    GuardarJson $Estado $EstadoPath
                    $Nuevos++
                } finally { if (Test-Path -LiteralPath $Temporal) { Remove-Item -LiteralPath $Temporal -Force } }
            }
            $Anterior = $Despues
            $Despues = [string]$Listado.siguiente
            if ($Despues -and ([long]$Despues -le [long]$Anterior)) { throw 'El listado no avanza.' }
        } while ($Despues)
    }
    # Indice local sin enlaces remotos. Incluye ultimas versiones; las anteriores quedan en carpeta.
    $Estado.Values | Sort-Object fecha,numero | Select-Object tipo,numero,cliente,fecha,archivo,descargado | Export-Csv -LiteralPath (Join-Path $Destino 'Indice-remitos.csv') -NoTypeInformation -Encoding UTF8
    $Mensaje = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | Copia completa. Descargados: $Nuevos. Sin cambios: $SinCambios."
    Set-Content -LiteralPath (Join-Path $Destino 'Ultima-copia.txt') -Value $Mensaje -Encoding UTF8
    Write-Host $Mensaje
    Write-Host "PDFs guardados en $Destino. Se pueden abrir sin internet."
} catch {
    Write-Host 'NO se completo la copia. Los PDF anteriores se conservaron. Reintenta cuando vuelva el servicio.'
    Write-Host $_.Exception.Message
    exit 1
} finally { if ($Lock) { $Lock.Dispose() } }
