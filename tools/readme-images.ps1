param([Parameter(Mandatory)][string]$Shots)
# Turns showcase screenshots (PNG, 1600x900, taken from a separate demo profile) into the README's
# images: JPEG at quality 85 in docs/images/, plus the logo from the app icon.
#   powershell -File tools/readme-images.ps1 -Shots D:\RealmNest-showcase\shots
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'docs\images'
New-Item -ItemType Directory -Force $out | Out-Null
$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 85L

# name in the shots folder → name in docs/images, and an optional crop height (top part only)
$list = @(
  @{ from = 'home.png'; to = 'home.jpg' },
  @{ from = 'world-agent.png'; to = 'world.jpg' },
  @{ from = 'agents.png'; to = 'agents.jpg' },
  @{ from = 'chat.png'; to = 'chat.jpg'; height = 760 },
  @{ from = 'crews.png'; to = 'crews.jpg'; height = 600 },
  @{ from = 'workflows.png'; to = 'workflows.jpg'; height = 480 },
  @{ from = 'research.png'; to = 'research.jpg'; height = 740 },
  @{ from = 'connections.png'; to = 'connections.jpg' }
)
foreach ($i in $list) {
  $src = [System.Drawing.Image]::FromFile((Join-Path $Shots $i.from))
  $h = if ($i.height) { $i.height } else { $src.Height }
  $b = New-Object System.Drawing.Bitmap $src.Width, $h
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $src.Width, $h), (New-Object System.Drawing.Rectangle 0, 0, $src.Width, $h), [System.Drawing.GraphicsUnit]::Pixel)
  $b.Save((Join-Path $out $i.to), $jpeg, $params)
  $g.Dispose(); $b.Dispose(); $src.Dispose()
}
# the logo: the app icon at 256 px
$icon = [System.Drawing.Image]::FromFile((Join-Path $root 'src-tauri\icons\icon.png'))
$l = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($l); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($icon, 0, 0, 256, 256)
$l.Save((Join-Path $out 'logo.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $l.Dispose(); $icon.Dispose()
Get-ChildItem $out | ForEach-Object { '{0,-18} {1,8:N0} bytes' -f $_.Name, $_.Length }
