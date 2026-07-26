# ---------------------------------------------------------------------------
# Local preview server for anguy.app
#
#   .\serve.ps1              -> http://localhost:8123
#   .\serve.ps1 -Port 9000   -> http://localhost:9000
#   .\serve.ps1 -NoOpen      -> don't launch a browser
#
# A server is REQUIRED: ride.js is an ES module loaded through an importmap,
# and browsers block both over file://. Double-clicking index.html will not
# work, it will just sit on the title block forever.
#
# Ctrl+C to stop.
# ---------------------------------------------------------------------------
param(
  [int]$Port = 8123,
  [switch]$NoOpen
)

$Root = $PSScriptRoot
if (-not $Root) { $Root = (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "  Could not bind port $Port." -ForegroundColor Red
  Write-Host "  Something else is probably already using it (an older copy of this script?)."
  Write-Host "  Try a different port:   .\serve.ps1 -Port 9000"
  Write-Host ""
  exit 1
}

Write-Host ""
Write-Host "  anguy.app - local preview" -ForegroundColor Cyan
Write-Host "  serving : $Root"
Write-Host "  ride    : http://localhost:$Port/"
Write-Host "  classic : http://localhost:$Port/classic.html"
Write-Host ""
Write-Host "  Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

if (-not $NoOpen) { Start-Process "http://localhost:$Port/" }

$mime = @{
  ".html"="text/html; charset=utf-8";       ".css"="text/css; charset=utf-8"
  ".js"="text/javascript; charset=utf-8";   ".mjs"="text/javascript; charset=utf-8"
  ".json"="application/json";               ".svg"="image/svg+xml"
  ".jpg"="image/jpeg";                      ".jpeg"="image/jpeg"
  ".png"="image/png";                       ".ico"="image/x-icon"
  ".webp"="image/webp";                     ".gif"="image/gif"
  ".mp3"="audio/mpeg";                      ".m4a"="audio/mp4"
  ".ogg"="audio/ogg";                       ".wav"="audio/wav"
  ".pdf"="application/pdf";                 ".woff2"="font/woff2"
  ".woff"="font/woff";                      ".ttf"="font/ttf"
  ".zip"="application/zip";                 ".txt"="text/plain; charset=utf-8"
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

      # keep requests inside the site folder
      $path = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
      if (-not $path.StartsWith([System.IO.Path]::GetFullPath($Root))) {
        $ctx.Response.StatusCode = 403
        $ctx.Response.OutputStream.Close()
        continue
      }

      if (Test-Path -LiteralPath $path -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $ct = $mime[$ext]
        if (-not $ct) { $ct = "application/octet-stream" }

        $bytes = [System.IO.File]::ReadAllBytes($path)
        $ctx.Response.ContentType = $ct
        # never cache during development, so a refresh always shows your edits
        $ctx.Response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")

        # Range support. Without it a browser cannot seek into media without
        # downloading the whole file first - which is what made the music take
        # ages to start at 1:30. GitHub Pages does this natively; this makes
        # local preview behave the same way.
        $ctx.Response.Headers.Add("Accept-Ranges", "bytes")
        $range = $ctx.Request.Headers["Range"]

        if ($range -and $range -match 'bytes=(\d*)-(\d*)') {
          $total = $bytes.Length
          if ($matches[1] -ne '') { $start = [int64]$matches[1] } else { $start = 0 }
          if ($matches[2] -ne '') { $end = [int64]$matches[2] } else { $end = $total - 1 }
          if ($end -ge $total) { $end = $total - 1 }

          if ($start -gt $end -or $start -ge $total) {
            $ctx.Response.StatusCode = 416
            $ctx.Response.Headers.Add("Content-Range", "bytes */$total")
            Write-Host ("  416  " + $rel) -ForegroundColor Yellow
          } else {
            $len = $end - $start + 1
            $ctx.Response.StatusCode = 206
            $ctx.Response.Headers.Add("Content-Range", "bytes $start-$end/$total")
            $ctx.Response.ContentLength64 = $len
            $ctx.Response.OutputStream.Write($bytes, $start, $len)
            Write-Host ("  206  $rel  [$start-$end/$total]") -ForegroundColor DarkGray
          }
        }
        elseif ($ctx.Request.HttpMethod -eq "HEAD") {
          # answer HEAD properly: headers only, no body
          $ctx.Response.ContentLength64 = $bytes.Length
          Write-Host ("  200  " + $rel + "  (HEAD)") -ForegroundColor DarkGray
        }
        else {
          $ctx.Response.ContentLength64 = $bytes.Length
          $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
          Write-Host ("  200  " + $rel) -ForegroundColor DarkGray
        }
      } else {
        $ctx.Response.StatusCode = 404
        $b = [System.Text.Encoding]::UTF8.GetBytes("404 - $rel")
        $ctx.Response.ContentType = "text/plain; charset=utf-8"
        $ctx.Response.OutputStream.Write($b, 0, $b.Length)
        Write-Host ("  404  " + $rel) -ForegroundColor Yellow
      }
      $ctx.Response.OutputStream.Close()
    } catch {
      Write-Host ("  ERR  " + $_.Exception.Message) -ForegroundColor Red
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Host ""
  Write-Host "  stopped." -ForegroundColor DarkGray
}
