param([Parameter(Mandatory)][string]$HomeShot, [Parameter(Mandatory)][string]$Out)
# Draws GitHub's social preview (1280x640): logo, name, tagline and the world map from a Home
# screenshot of the showcase profile (1600x900, the map is the middle panel).
#   powershell -File tools/social-preview.ps1 -HomeShot D:\RealmNest-showcase\shots\home.png -Out <file.png>
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$W = 1280; $H = 640
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'; $g.TextRenderingHint = 'AntiAliasGridFit'

# background: the icon's dark, a soft green glow behind the map
$g.Clear([System.Drawing.Color]::FromArgb(21, 20, 26))
$glow = New-Object System.Drawing.Drawing2D.GraphicsPath
$glow.AddEllipse(560, -120, 820, 880)
$pg = New-Object System.Drawing.Drawing2D.PathGradientBrush $glow
$pg.CenterColor = [System.Drawing.Color]::FromArgb(70, 89, 192, 143)
$pg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 21, 20, 26))
$g.FillPath($pg, $glow)

function Rounded($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90); $p.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
  $p.AddArc($x + $w - 2 * $r, $y + $h - 2 * $r, 2 * $r, 2 * $r, 0, 90); $p.AddArc($x, $y + $h - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $p.CloseFigure(); return $p
}

# the world map, cropped from the Home screenshot, with rounded corners and a thin border
$shot = [System.Drawing.Image]::FromFile($HomeShot)
$src = New-Object System.Drawing.Rectangle 268, 19, 937, 862
$mh = 572; $mw = [int]($mh * $src.Width / $src.Height)
$mx = $W - $mw - 40; $my = [int](($H - $mh) / 2)
$clip = Rounded $mx $my $mw $mh 22
$g.SetClip($clip)
$g.DrawImage($shot, (New-Object System.Drawing.Rectangle $mx, $my, $mw, $mh), $src, [System.Drawing.GraphicsUnit]::Pixel)
$g.ResetClip()
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 89, 192, 143)), 2), $clip)
$shot.Dispose()

# left: logo, name, tagline, description, what it works with
$icon = [System.Drawing.Image]::FromFile((Join-Path $root 'src-tauri\icons\icon.png'))
$g.DrawImage($icon, 64, 74, 132, 132)
$icon.Dispose()
$peach = [System.Drawing.Color]::FromArgb(248, 211, 173)
$white = [System.Drawing.Color]::FromArgb(240, 238, 230)
$muted = [System.Drawing.Color]::FromArgb(160, 166, 154)
$px = [System.Drawing.GraphicsUnit]::Pixel
$g.DrawString('RealmNest OS', (New-Object System.Drawing.Font 'Segoe UI Semibold', 66, $px), (New-Object System.Drawing.SolidBrush $white), 56, 226)
$g.DrawString('Worlds for brighter work.', (New-Object System.Drawing.Font 'Segoe UI Semibold', 30, $px), (New-Object System.Drawing.SolidBrush $peach), 62, 318)
$desc = New-Object System.Drawing.RectangleF 62, 372, ($mx - 100), 120
$g.DrawString('A visual operating environment for AI agents: real models and tools, pixel-art characters in hand-made worlds.', (New-Object System.Drawing.Font 'Segoe UI', 23, $px), (New-Object System.Drawing.SolidBrush $muted), $desc)

# chips
$chipFont = New-Object System.Drawing.Font 'Segoe UI Semibold', 16, $px
$x = 62
foreach ($label in 'Windows', 'Claude', 'ChatGPT', 'Ollama', 'Open source') {
  $size = $g.MeasureString($label, $chipFont)
  $w = [int]$size.Width + 22
  $chip = Rounded $x 512 $w 38 19
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38, 44, 40))), $chip)
  $g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 89, 192, 143)), 1.5), $chip)
  $g.DrawString($label, $chipFont, (New-Object System.Drawing.SolidBrush $white), ($x + 11), 521)
  $x += $w + 8
}

$g.Dispose()
# GitHub takes at most 1 MB: a .jpg is written at quality 92
if ($Out -match '\.jpe?g$') {
  $jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $q = New-Object System.Drawing.Imaging.EncoderParameters 1
  $q.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L
  $bmp.Save($Out, $jpeg, $q)
} else { $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png) }
$bmp.Dispose()
"{0} {1:N0} bytes" -f $Out, (Get-Item $Out).Length
