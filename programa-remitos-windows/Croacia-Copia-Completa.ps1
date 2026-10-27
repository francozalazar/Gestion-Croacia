# Requiere Windows PowerShell 5.1. No necesita permisos de administrador.
# Copia completa PRIVADA de Croacia: base de datos, esquema, usuarios (sin contrasenas),
# archivos (fotos y facturas) y manifiesto con SHA256. Solo lee; nunca modifica la app
# ni borra copias. Tiene su propia clave, distinta de la de los remitos PDF.
param([ValidateSet('Instalar','Copiar','Hash','Automatico')][string]$Accion = 'Copiar', [switch]$Forzar)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Base = Join-Path $env:LOCALAPPDATA 'CroaciaRemitos'
$ConfigRemitos = Join-Path $Base 'config.json'
$ConfigPath = Join-Path $Base 'config-completa.json'
$TokenPath = Join-Path $Base 'acceso-completa.xml'
$Servidor = 'https://gestion-croacia.vercel.app'
$Tramo = 700000
$Sep = '/'  # rutas del manifiesto siempre con / (portables a Mac/Linux); Join-Path de Windows las acepta
# UTF-8 SIN BOM (Set-Content -Encoding UTF8 de PowerShell 5.1 agrega BOM y rompe JSON.parse al restaurar).
function EscribirTexto([string]$Ruta, [string]$Texto) { [IO.File]::WriteAllText($Ruta, $Texto, (New-Object Text.UTF8Encoding($false))) }
function GuardarJson($Objeto, $Destino) {
    $Temporal = $Destino + '.tmp'
    EscribirTexto $Temporal ($Objeto | ConvertTo-Json -Depth 15)
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
function Segmento([string]$Texto) {
    $N = [regex]::Replace($Texto, '[\x00-\x1f<>:"/\\|?*]', '_').TrimEnd('. ')
    if (!$N -or $N -match '^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$') { $N = '_' + $N }
    if ($N -ne $Texto) { $N = $N + '~' + (HashTexto $Texto).Substring(0,8) }
    return $N
}
function Pedir([string]$Metodo, [string]$Ruta) {
    Invoke-WebRequest -UseBasicParsing -Method $Metodo -Uri ($Servidor + '/api/copia-completa?' + $Ruta) -Headers @{ Authorization = 'Bearer ' + (Clave) } -TimeoutSec 120
}
function PedirJson([string]$Metodo, [string]$Ruta) {
    $R = Pedir $Metodo $Ruta
    $O = $R.Content | ConvertFrom-Json
    if ($O.version -ne 1) { throw 'Respuesta inesperada del servidor.' }
    return $O
}
function Sha256Archivo([string]$Ruta) { (Get-FileHash -LiteralPath $Ruta -Algorithm SHA256).Hash.ToLowerInvariant() }

if ($Accion -eq 'Instalar') {
    if (!(Test-Path -LiteralPath $ConfigRemitos)) { throw 'Primero tiene que estar instalada la copia de remitos en este usuario.' }
    if (Test-Path -LiteralPath $ConfigPath) { throw 'Ya esta instalada la copia completa. No se reemplazo la configuracion.' }
    $R = Get-Content -LiteralPath $ConfigRemitos -Raw | ConvertFrom-Json
    $Marca = Join-Path ([string]$R.destino) '.croacia-disco'
    if (!(Test-Path -LiteralPath $Marca) -or (Get-Content -LiteralPath $Marca -Raw).Trim() -ne $R.marca) { throw 'No se encontro el disco de los remitos. Conectalo y reintenta.' }
    $Padre = Split-Path -Parent ([string]$R.destino)
    if (!$Padre -or !(Test-Path -LiteralPath $Padre -PathType Container) -or $Padre -eq [string]$R.destino) { throw 'No se pudo determinar la carpeta que contiene los remitos. No se creo nada.' }
    $Raiz = Join-Path $Padre 'Croacia-Copia-Completa'
    if ($Raiz.Length -gt 120 -or $Raiz.StartsWith('\\')) { throw 'La ruta es demasiado larga o no es local.' }
    New-Item -ItemType Directory -Path $Raiz -Force | Out-Null
    $MarcaNueva = [guid]::NewGuid().ToString()
    EscribirTexto (Join-Path $Raiz '.croacia-copia-completa') $MarcaNueva
    $Bytes = New-Object byte[] 32
    $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $Rng.GetBytes($Bytes) } finally { $Rng.Dispose() }
    $Token = [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    ConvertTo-SecureString $Token -AsPlainText -Force | Export-Clixml -LiteralPath $TokenPath
    GuardarJson @{ raiz=$Raiz; marca=$MarcaNueva; servidor=$Servidor } $ConfigPath
    Copy-Item -LiteralPath $PSCommandPath -Destination (Join-Path $Base 'Croacia-Copia-Completa.ps1') -Force
    EscribirTexto (Join-Path $Base 'Activacion-copia-completa.txt') (HashTexto $Token)
    Write-Host "Carpeta de la copia completa: $Raiz"
    Write-Host 'Se abre Activacion-copia-completa.txt: ese texto NO es una clave. Enviaselo a quien prepara la copia.'
    Write-Host 'Todavia NO copia nada ni queda automatico.'
    Start-Process notepad.exe -ArgumentList ('"' + (Join-Path $Base 'Activacion-copia-completa.txt') + '"')
    exit 0
}
if (!(Test-Path -LiteralPath $ConfigPath)) { throw 'Primero ejecuta Instalar-Copia-Completa.cmd.' }
$Config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($Accion -eq 'Hash') { Write-Output (HashTexto (Clave)); exit 0 }
$Raiz = [string]$Config.raiz
$MarcaPath = Join-Path $Raiz '.croacia-copia-completa'
if (!(Test-Path -LiteralPath $MarcaPath) -or (Get-Content -LiteralPath $MarcaPath -Raw).Trim().TrimStart([char]0xFEFF) -ne $Config.marca) { throw 'No se encontro la carpeta/disco de la copia completa. Conectalo y reintenta. No se cambio nada.' }

if ($Accion -eq 'Automatico') {
    $Ultima = Join-Path $Raiz 'Ultima-copia-completa.json'
    if (!(Test-Path -LiteralPath $Ultima) -or ((Get-Content -LiteralPath $Ultima -Raw | ConvertFrom-Json).estado -ne 'completa')) { throw 'Primero corre Copiar-Completa-Ahora.cmd y comproba que termine bien (tiene que decir completa, sin avisos). No se creo ninguna tarea.' }
    $Lanzador = Join-Path $Base 'Automatico-Completa.ps1'
    @'
$Base = Join-Path $env:LOCALAPPDATA 'CroaciaRemitos'
$Log = Join-Path $Base 'Automatico-Completa.log'
if ((Test-Path -LiteralPath $Log) -and (Get-Item -LiteralPath $Log).Length -gt 1048576) { Move-Item -LiteralPath $Log -Destination ($Log + '.anterior') -Force }
Start-Transcript -LiteralPath $Log -Append | Out-Null
try { & (Join-Path $Base 'Croacia-Copia-Completa.ps1') -Accion Copiar }
finally { Stop-Transcript | Out-Null }
'@ | Set-Content -LiteralPath $Lanzador -Encoding UTF8
    $Usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $Servicio = New-Object -ComObject 'Schedule.Service'
    $Servicio.Connect()
    $RaizT = $Servicio.GetFolder('\')
    $Nombre = 'Croacia - Copia completa'
    $Existente = $null
    try { $Existente = $RaizT.GetTask($Nombre) } catch { }
    if ($Existente -and $Existente.Definition.RegistrationInfo.Source -ne 'CroaciaCopiaCompleta-v1') { throw 'Ya existe una tarea con ese nombre. No se reemplazo.' }
    $Tarea = $Servicio.NewTask(0)
    $Tarea.RegistrationInfo.Description = 'Copia completa privada: se intenta cada hora y al iniciar sesion; solo corre si la ultima tiene mas de 23 horas. No modifica la app.'
    $Tarea.RegistrationInfo.Source = 'CroaciaCopiaCompleta-v1'
    $Tarea.Principal.UserId = $Usuario
    $Tarea.Principal.LogonType = 3
    $Tarea.Principal.RunLevel = 0
    $Tarea.Settings.Enabled = $true
    $Tarea.Settings.StartWhenAvailable = $true
    $Tarea.Settings.DisallowStartIfOnBatteries = $false
    $Tarea.Settings.StopIfGoingOnBatteries = $false
    $Tarea.Settings.MultipleInstances = 2
    $Tarea.Settings.ExecutionTimeLimit = 'PT2H'
    $Tarea.Settings.WakeToRun = $false
    $Hora = $Tarea.Triggers.Create(1)
    $Hora.StartBoundary = (Get-Date).AddMinutes(10).ToString('yyyy-MM-ddTHH:mm:ss')
    $Hora.Repetition.Interval = 'PT1H'
    $Hora.Enabled = $true
    $Inicio = $Tarea.Triggers.Create(9)
    $Inicio.UserId = $Usuario
    $Inicio.Delay = 'PT5M'
    $Inicio.Enabled = $true
    $Acc = $Tarea.Actions.Create(0)
    $Acc.Path = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $Acc.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $Lanzador + '"'
    $Acc.WorkingDirectory = $Base
    $null = $RaizT.RegisterTaskDefinition($Nombre,$Tarea,6,$Usuario,$null,3)
    $Ok = $RaizT.GetTask($Nombre)
    if (!$Ok.Enabled -or $Ok.Definition.Principal.LogonType -ne 3 -or $Ok.Definition.Principal.RunLevel -ne 0) { throw 'No se pudo verificar la tarea. Envia captura.' }
    Write-Host "Tarea: $Nombre (usuario $Usuario)"
    Write-Host 'Se revisa cada hora y 5 minutos despues de iniciar sesion; hace una copia nueva si la ultima completa tiene mas de 23 horas.'
    Write-Host "Registro: $Base\Automatico-Completa.log. Para desactivar: Programador de tareas > Croacia - Copia completa > Deshabilitar."
    exit 0
}

# ---- Accion Copiar ----
$Lock = $null
$Parcial = $null
$EstadoCopiaPath = $null; $Fallos = 0
try {
    try { $Lock = [IO.File]::Open((Join-Path $Raiz '.copia.lock'), 'OpenOrCreate','ReadWrite','None') }
    catch { throw 'Ya hay una copia en curso.' }
    $UltimaPath = Join-Path $Raiz 'Ultima-copia-completa.json'
    if (!$Forzar -and (Test-Path -LiteralPath $UltimaPath)) {
        $U = Get-Content -LiteralPath $UltimaPath -Raw | ConvertFrom-Json
        if ($U.estado -eq 'completa' -and ((Get-Date) - [datetime]::Parse($U.terminada)).TotalHours -lt 23) { Write-Host "Ya hay una copia completa reciente ($($U.terminada)). No se hizo otra."; exit 0 }
    }
    $EstadoCopiaPath = Join-Path $Raiz 'Estado-copia.json'
    if (!$Forzar -and (Test-Path -LiteralPath $EstadoCopiaPath)) {
        $EC = Get-Content -LiteralPath $EstadoCopiaPath -Raw | ConvertFrom-Json
        if ($EC.proximo -and [datetime]::Parse($EC.proximo) -gt (Get-Date)) { Write-Host "Esperando para reintentar (intentos fallidos seguidos: $($EC.fallos)). Proximo intento despues de $($EC.proximo)."; exit 0 }
    }
    $Fallos = 0; if (Test-Path -LiteralPath $EstadoCopiaPath) { $Fallos = [int](Get-Content -LiteralPath $EstadoCopiaPath -Raw | ConvertFrom-Json).fallos }
    # Espacio libre: al menos 1 GB y 3 veces la ultima base descargada.
    try {
        $Raiz0 = [IO.Path]::GetPathRoot($Raiz)
        $Libre = (New-Object IO.DriveInfo($Raiz0)).AvailableFreeSpace
        $Ult = Get-ChildItem -LiteralPath $Raiz -Filter 'base-de-datos.json' -Recurse -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 1
        $Necesario = 1GB; if ($Ult -and (3 * $Ult.Length) -gt $Necesario) { $Necesario = 3 * $Ult.Length }
        if ($Libre -lt $Necesario) { throw "Poco espacio libre en el disco ($([int]($Libre/1MB)) MB). No se creo ninguna copia nueva." }
    } catch [System.Management.Automation.RuntimeException] { throw } catch { }
    $Inicio = Get-Date
    $Nombre = 'copia-' + $Inicio.ToString('yyyyMMdd-HHmmss')
    $Parcial = Join-Path $Raiz ($Nombre + '.parcial')
    New-Item -ItemType Directory -Path $Parcial | Out-Null
    # 1. Foto UNICA y consistente de toda la base, tomada por el servidor en una sola sentencia.
    $Foto = PedirJson 'Post' 'accion=crear'
    $Id = [long]$Foto.id
    $Datos = Join-Path $Parcial 'base-de-datos.json'
    $Out = [IO.File]::Open($Datos, 'Create','Write','None')
    try {
        $Desde = 1
        while ($true) {
            $R = Pedir 'Get' "accion=leer&id=$Id&desde=$Desde&largo=$Tramo"
            $N = [int]([string]($R.Headers['X-Caracteres'] | Select-Object -First 1))
            if ($N -eq 0) { break }
            $B = $R.RawContentStream.ToArray()
            $Out.Write($B, 0, $B.Length)
            $Desde += $N
            if ($N -lt $Tramo) { break }
        }
    } finally { $Out.Dispose() }
    $Len = (Get-Item -LiteralPath $Datos).Length
    $Sha = Sha256Archivo $Datos
    if ($Len -ne [long]$Foto.bytes -or $Sha -ne $Foto.sha256) { throw 'La base descargada no coincide con la del servidor (tamano/SHA256). Copia incompleta.' }
    $Res = (PedirJson 'Get' "accion=resumen&id=$Id").resumen
    $Alerta = ''; if ($Res.revision_definiciones -and @($Res.revision_definiciones.alertas).Count -gt 0) { $Alerta = ' | ALERTA: posibles secretos en definiciones (ver manifiesto)' }
    # 2. Archivos (fotos y facturas) segun la lista de esa misma foto.
    $Store = Join-Path $Raiz 'archivos'
    $Lista = New-Object System.Collections.ArrayList
    $Avisos = New-Object System.Collections.ArrayList
    $Pos = 0
    while ($true) {
        $Pag = (PedirJson 'Get' "accion=objetos&id=$Id&desde=$Pos&limite=200").objetos
        if (!$Pag -or @($Pag).Count -eq 0) { break }
        foreach ($O in @($Pag)) {
            $Pos++
            $Bucket = [string]$O.bucket; $Ruta = [string]$O.ruta
            $Segs = @((Segmento $Bucket)) + @($Ruta.Split('/') | ForEach-Object { Segmento $_ })
            $Rel = 'archivos' + $Sep + ($Segs -join $Sep)
            $Local = Join-Path $Raiz $Rel
            if ($Local.Length -gt 240) { $Rel = 'archivos' + $Sep + (Segmento $Bucket) + $Sep + 'largo-' + (HashTexto ($Bucket + '/' + $Ruta)); $Local = Join-Path $Raiz $Rel }
            $Etag = ([string]$O.etag).Trim('"')
            $Tam = $null; if ($O.tamano) { $Tam = [long]$O.tamano }
            $Malo = $null
            $Md5Ok = ($Etag -match '^[a-f0-9]{32}$')
            $Verif = 'tamano+doble-descarga'; if ($Md5Ok) { $Verif = 'md5' }
            $Ya = (Test-Path -LiteralPath $Local)
            if ($Ya) {
                $Existe = Get-Item -LiteralPath $Local
                $Igual = ($Tam -eq $null -or $Existe.Length -eq $Tam)
                if (!$Md5Ok) { $Igual = $false }  # etag sin MD5: tamano igual no prueba contenido igual; se vuelve a bajar y se compara SHA256
                if ($Igual -and $Etag -match '^[a-f0-9]{32}$') { $Igual = ((Get-FileHash -LiteralPath $Local -Algorithm MD5).Hash.ToLowerInvariant() -eq $Etag) }
                if ($Igual) { $Lista.Add(@{ bucket=$Bucket; ruta=$Ruta; tipo=[string]$O.tipo; tamano=$Existe.Length; etag=$Etag; sha256=(Sha256Archivo $Local); archivo=$Rel; estado='ya-copiado'; verificacion=$Verif }) | Out-Null; continue }
            }
            $Url = $null
            try { $Url = (PedirJson 'Get' ('accion=archivo&bucket=' + [uri]::EscapeDataString($Bucket) + '&ruta=' + [uri]::EscapeDataString($Ruta))).url }
            catch {
                $Cod = $null; if ($_.Exception.Response) { $Cod = [int]$_.Exception.Response.StatusCode }
                if ($Cod -eq 404) { $Avisos.Add("No se encontro $Bucket/$Ruta (figura en la foto de la base pero ya no esta en Storage).") | Out-Null; $Lista.Add(@{ bucket=$Bucket; ruta=$Ruta; tipo=[string]$O.tipo; tamano=$Tam; etag=$Etag; sha256=$null; archivo=$null; estado='faltante-posterior'; verificacion=$Verif }) | Out-Null; continue }
                throw
            }
            New-Item -ItemType Directory -Path (Split-Path -Parent $Local) -Force | Out-Null
            # Hasta 3 intentos. Solo se acepta si tamano y MD5 coinciden con lo que la foto de la base dijo.
            $Bueno = $null; $UltimoSha = $null; $Estable = $false; $Tmp = $null
            $Repetir = $false
            for ($Intento = 1; $Intento -le 4 -and !$Bueno -and !$Estable; $Intento++) {
                if ($Intento -gt 1) { $Url = (PedirJson 'Get' ('accion=archivo&bucket=' + [uri]::EscapeDataString($Bucket) + '&ruta=' + [uri]::EscapeDataString($Ruta))).url }
                $Tmp = Join-Path (Split-Path -Parent $Local) ([guid]::NewGuid().ToString() + '.partial')
                try {
                    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Tmp -TimeoutSec 300 | Out-Null
                    $Largo = (Get-Item -LiteralPath $Tmp).Length
                    $ShaF = Sha256Archivo $Tmp
                    $Coincide = ($Tam -eq $null -or $Largo -eq $Tam)
                    if ($Coincide -and $Etag -match '^[a-f0-9]{32}$') { $Coincide = ((Get-FileHash -LiteralPath $Tmp -Algorithm MD5).Hash.ToLowerInvariant() -eq $Etag) }
                    if ($Coincide -and !$Md5Ok -and $UltimoSha -ne $ShaF) { $UltimoSha = $ShaF; $Coincide = $false; $Repetir = $true }
                    if ($Coincide) { $Bueno = @{ largo=$Largo; sha=$ShaF; tmp=$Tmp }; $Tmp = $null }
                    elseif ($Repetir) { $Repetir = $false }
                    elseif ($UltimoSha -eq $ShaF) { $Estable = $true; $Bueno = $null; $Malo = @{ largo=$Largo; sha=$ShaF; tmp=$Tmp }; $Tmp = $null }
                    else { $UltimoSha = $ShaF }
                } finally { if ($Tmp -and (Test-Path -LiteralPath $Tmp)) { Remove-Item -LiteralPath $Tmp -Force } }
            }
            if ($Bueno) {
                $Estado1 = 'ok'
                # Nunca se pisa una version guardada: si el contenido cambio se guarda como .v-<sha8> al lado.
                if ($Ya) {
                    if ((Sha256Archivo $Local) -eq $Bueno.sha) { $Estado1 = 'ya-copiado' }
                    else { $Rel = $Rel + '.v-' + $Bueno.sha.Substring(0,8); $Local = Join-Path $Raiz $Rel }
                }
                if ($Estado1 -eq 'ok' -and (Test-Path -LiteralPath $Local)) {
                    # Ya existe esa version (.v-sha8): solo se reutiliza si el SHA256 completo coincide; si no, es colision y la corrida queda incompleta.
                    if ((Sha256Archivo $Local) -eq $Bueno.sha) { $Estado1 = 'ya-copiado' } else { $Estado1 = 'colision'; $Avisos.Add("${Bucket}/${Ruta}: ya existe $Rel con otro contenido (SHA256 distinto). No se pisa.") | Out-Null }
                }
                if ($Estado1 -eq 'ok') { Move-Item -LiteralPath $Bueno.tmp -Destination $Local } elseif ($Estado1 -eq 'colision') { $Rel = $Rel + '.colision-' + $Bueno.sha.Substring(0,8); $Local = Join-Path $Raiz $Rel; if (Test-Path -LiteralPath $Local) { Remove-Item -LiteralPath $Bueno.tmp -Force } else { Move-Item -LiteralPath $Bueno.tmp -Destination $Local } } else { Remove-Item -LiteralPath $Bueno.tmp -Force }
                $Lista.Add(@{ bucket=$Bucket; ruta=$Ruta; tipo=[string]$O.tipo; tamano=$Bueno.largo; etag=$Etag; sha256=$Bueno.sha; archivo=$Rel; estado=$Estado1; verificacion=$Verif }) | Out-Null
            } else {
                # No coincide con la foto de la base (cambio despues, o dano). Nunca se guarda como copia buena:
                # se conserva aparte, la corrida queda INCOMPLETA y se reintenta con una foto nueva.
                if ($Malo) {
                    $RelMalo = $Rel + '.no-verificado-' + $Malo.sha.Substring(0,8)
                    if (Test-Path -LiteralPath (Join-Path $Raiz $RelMalo)) { Remove-Item -LiteralPath $Malo.tmp -Force } else { Move-Item -LiteralPath $Malo.tmp -Destination (Join-Path $Raiz $RelMalo) }
                    $Avisos.Add("$Bucket/$Ruta no coincide con la foto de la base (esperado $Tam bytes, llego $($Malo.largo)). Guardado aparte como no verificado.") | Out-Null
                    $Lista.Add(@{ bucket=$Bucket; ruta=$Ruta; tipo=[string]$O.tipo; tamano=$Malo.largo; etag=$Etag; sha256=$Malo.sha; archivo=$RelMalo; estado='no-coincide'; verificacion=$Verif }) | Out-Null
                } else { throw "No se pudo verificar $Bucket/$Ruta despues de 3 intentos." }
            }
        }
    }
    if ($Pos -ne [int]$Res.objetos) { throw "Se listaron $Pos archivos pero la foto tiene $($Res.objetos). Copia incompleta." }
    # 3. Manifiesto
    $Terminada = Get-Date
    if ($Alerta) { $Avisos.Add('REVISAR: posibles secretos o claves dentro de funciones/policies/vistas (ver revision_definiciones en el manifiesto). La copia no se acepta como completa hasta que alguien la revise.') | Out-Null }
    $Estado = 'completa'; if ($Avisos.Count -gt 0) { $Estado = 'incompleta' }
    GuardarJson @{ version=1; creada=$Res.creada; terminada=$Terminada.ToString('o'); base_de_datos=@{ archivo='base-de-datos.json'; bytes=$Len; sha256=$Sha }; conteos=$Res.tablas; tablas_excluidas=$Res.excluidas; usuarios_auth=$Res.usuarios; revision_definiciones=$Res.revision_definiciones; archivos=$Lista; avisos=$Avisos } (Join-Path $Parcial 'manifiesto.json')
    EscribirTexto (Join-Path $Parcial 'LEEME.txt') ((@(
        "Copia completa de Croacia tomada en una sola foto: $($Res.creada)",
        'base-de-datos.json: tablas, esquema (tablas, policies, funciones, triggers), lista de archivos y usuarios SIN contrasenas.',
        'Los archivos (fotos/facturas) estan en ..\archivos y se listan con SHA256 en manifiesto.json.',
        'Excluidos: claves de avisos push (push_*) y hashes de contrasenas. Se vuelven a activar/resetear al restaurar.',
        'Datos privados sin cifrar: protege el acceso a esta carpeta y al disco.') -join "`r`n"))
    if ($Estado -ne 'completa') { $Nombre = $Nombre + '-INCOMPLETA' }
    $Final = Join-Path $Raiz $Nombre
    Move-Item -LiteralPath $Parcial -Destination $Final
    $Parcial = $null
    GuardarJson @{ estado=$Estado; carpeta=$Nombre; terminada=$Terminada.ToString('o'); archivos=$Lista.Count; avisos=$Avisos.Count } $UltimaPath
    EscribirTexto (Join-Path $Raiz 'Ultima-copia-completa.txt') "$($Terminada.ToString('yyyy-MM-dd HH:mm:ss')) | $Estado | $Nombre | archivos: $($Lista.Count) | avisos: $($Avisos.Count)"
    $Siguiente = $null; $NuevosFallos = 0
    if ($Estado -ne 'completa') { $NuevosFallos = $Fallos + 1; $Siguiente = (Get-Date).AddMinutes([math]::Min(1440, 30 * [math]::Pow(2, [math]::Min($NuevosFallos - 1, 6)))).ToString('o') }
    GuardarJson @{ fallos=$NuevosFallos; proximo=$Siguiente; ultimo=$Terminada.ToString('o') } $EstadoCopiaPath
    # 4. El servidor borra su foto temporal solo si el SHA256 coincide. Si falla, se borra solo a los 2 dias.
    try { $null = Pedir 'Post' "accion=cerrar&id=$Id&sha256=$Sha" } catch { Write-Host 'Aviso: no se pudo cerrar la foto temporal del servidor; se borra sola a los 2 dias.' }
    Write-Host "Copia $($Estado.ToUpper()) en $Final. Archivos: $($Lista.Count). Avisos: $($Avisos.Count)."
    foreach ($A in $Avisos) { Write-Host " - $A" }
    if ($Estado -ne 'completa') { Write-Host 'INCOMPLETA: NO cuenta como copia diaria. Se vuelve a intentar con una foto nueva en la proxima revision (cada hora).'; exit 2 }
} catch {
    Write-Host 'NO se completo la copia. No se borro ninguna copia anterior. Reintenta cuando vuelva el servicio.'
    Write-Host $_.Exception.Message
    try { if ($EstadoCopiaPath) { $F2 = 1; if ($Fallos) { $F2 = $Fallos + 1 }; GuardarJson @{ fallos=$F2; proximo=(Get-Date).AddMinutes([math]::Min(1440, 30 * [math]::Pow(2, [math]::Min($F2 - 1, 6)))).ToString('o'); ultimo=(Get-Date).ToString('o') } $EstadoCopiaPath } } catch { }
    if ($Parcial -and (Test-Path -LiteralPath $Parcial)) { try { Move-Item -LiteralPath $Parcial -Destination ($Parcial -replace '\.parcial$','.incompleta') } catch { } }
    exit 1
} finally { if ($Lock) { $Lock.Dispose() } }
