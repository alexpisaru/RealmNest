# Draws the NSIS installer images from the app icon (src-tauri/icons/icon.png):
#   src-tauri/installer/sidebar.bmp  164x314  welcome and finish pages
#   src-tauri/installer/header.bmp   150x57   top-right of the other pages
#   powershell -File tools/installer-images.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$icon = [System.Drawing.Image]::FromFile((Join-Path $root 'src-tauri\icons\icon.png'))
$out = Join-Path $root 'src-tauri\installer'
New-Item -ItemType Directory -Force $out | Out-Null
# the icon's own background, so the rounded square melts into the sidebar
$bg = ([System.Drawing.Bitmap]$icon).GetPixel(12, 256)
$peach = [System.Drawing.Color]::FromArgb(248, 211, 173)
$muted = [System.Drawing.Color]::FromArgb(150, 146, 160)

function New-Canvas($w, $h, $color) {
  $b = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear($color)
  return $b, $g
}

# sidebar: the icon, the name, the edition
$b, $g = New-Canvas 164 314 $bg
$g.DrawImage($icon, 22, 46, 120, 120)
$center = New-Object System.Drawing.StringFormat; $center.Alignment = 'Center'
$g.DrawString('RealmNest OS', (New-Object System.Drawing.Font 'Segoe UI Semibold', 13, ([System.Drawing.GraphicsUnit]::Pixel)), (New-Object System.Drawing.SolidBrush $peach), (New-Object System.Drawing.RectangleF 0, 184, 164, 24), $center)
$g.DrawString('Public Beta', (New-Object System.Drawing.Font 'Segoe UI', 11, ([System.Drawing.GraphicsUnit]::Pixel)), (New-Object System.Drawing.SolidBrush $muted), (New-Object System.Drawing.RectangleF 0, 206, 164, 18), $center)
$g.Dispose(); $b.Save((Join-Path $out 'sidebar.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose()

# header: the icon on the right of the white header band
$b, $g = New-Canvas 150 57 ([System.Drawing.Color]::White)
$g.DrawImage($icon, 99, 6, 45, 45)
$g.Dispose(); $b.Save((Join-Path $out 'header.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose()
$icon.Dispose()
Get-ChildItem $out | ForEach-Object { "$($_.Name) $($_.Length) bytes" }
