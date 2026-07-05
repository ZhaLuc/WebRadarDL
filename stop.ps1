# Stop WebRadarDL and related processes (never touches deadlock.exe)

$ErrorActionPreference = "SilentlyContinue"
$Root = $PSScriptRoot
$Webapp = Join-Path $Root "webapp"
$SessionFile = Join-Path $Root ".radar-session.json"

function Write-StopLog($Message, $Color = "DarkGray") {
    Write-Host "  $Message" -ForegroundColor $Color
}

function Stop-ProcessTree([int]$ProcessId) {
    if ($ProcessId -le 0) {
        return
    }

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ParentProcessId -eq $ProcessId } |
        ForEach-Object { Stop-ProcessTree $_.ProcessId }

    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-PortListeners($Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object {
            $pid = $_.OwningProcess
            if ($pid -gt 0) {
                Write-StopLog "Stopping listener on port $Port (pid $pid)"
                Stop-ProcessTree $pid
            }
        }
}

function Stop-RadarNodeProcesses {
    Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -match "host\.js" -or
            ($_.CommandLine -and $_.CommandLine -match [regex]::Escape($Webapp))
        } |
        ForEach-Object {
            Write-StopLog "Stopping node (pid $($_.ProcessId))"
            Stop-ProcessTree $_.ProcessId
        }
}

function Stop-RadarReaderProcesses {
    Get-Process -Name "radar_reader", "usermode" -ErrorAction SilentlyContinue |
        ForEach-Object {
            Write-StopLog "Stopping $($_.ProcessName).exe (pid $($_.Id))"
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
}

function Test-PortOpen($Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect("127.0.0.1", $Port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

Write-Host ""
Write-Host "  Stopping WebRadarDL..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $SessionFile) {
    try {
        $session = Get-Content $SessionFile -Raw | ConvertFrom-Json
        if ($session.hostNodePid) {
            Write-StopLog "Stopping host node from session (pid $($session.hostNodePid))"
            Stop-ProcessTree ([int]$session.hostNodePid)
        }
        if ($session.browserPid) {
            Write-StopLog "Closing browser shell (pid $($session.browserPid))"
            Stop-ProcessTree ([int]$session.browserPid)
        }
        if ($session.readerPid) {
            Write-StopLog "Stopping reader from session (pid $($session.readerPid))"
            Stop-ProcessTree ([int]$session.readerPid)
        }
    } catch {
        Write-StopLog "Could not read session file; using process scan" "DarkYellow"
    }
}

Stop-RadarNodeProcesses
Stop-PortListeners 5173
Stop-PortListeners 22006
Stop-RadarReaderProcesses

Get-Process -Name "WebRadarDL" -ErrorAction SilentlyContinue |
    ForEach-Object {
        Write-StopLog "Stopping $($_.ProcessName).exe (pid $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }

Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue |
    ForEach-Object {
        Write-StopLog "Stopping cloudflared (pid $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }

Remove-Item (Join-Path $Root ".radar-public-url.txt") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Root ".radar-shutdown") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $Root ".cloudflared.log") -Force -ErrorAction SilentlyContinue
Remove-Item $SessionFile -Force -ErrorAction SilentlyContinue

Start-Sleep -Milliseconds 600

Stop-RadarNodeProcesses
Stop-PortListeners 5173
Stop-PortListeners 22006
Stop-RadarReaderProcesses

$openPorts = @(5173, 22006) | Where-Object { Test-PortOpen $_ }
if ($openPorts.Count -gt 0) {
    Write-Host ""
    Write-Host "  Warning: ports still in use: $($openPorts -join ', ')" -ForegroundColor DarkYellow
    Write-Host "  Run STOP.bat again or close any leftover terminal windows." -ForegroundColor DarkYellow
} else {
    Write-Host ""
    Write-Host "  All radar processes stopped." -ForegroundColor Green
}

Write-Host "  (deadlock.exe was not touched)" -ForegroundColor DarkGray
Write-Host "  Run WebRadarDL.exe when you want to launch again." -ForegroundColor Cyan
Write-Host ""
