# Rasterize the existing Home lotus (Material Icons "spa"), not a new logo.
# Run from the worktree root after npm ci. Uses Windows drawing APIs only.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$icons = Join-Path $root 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons'
$map = Get-Content -LiteralPath (Join-Path $icons 'glyphmaps/MaterialIcons.json') -Raw | ConvertFrom-Json
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile((Join-Path $icons 'Fonts/MaterialIcons.ttf'))
$glyph = New-Object System.Drawing.Drawing2D.GraphicsPath
$glyph.AddString([string][char]$map.spa, $fonts.Families[0], 0, 1024, [System.Drawing.PointF]::Empty, [System.Drawing.StringFormat]::GenericTypographic)
$bounds = $glyph.GetBounds()
function Write-BrandPng([string]$name, [int]$size, [double]$width, [string]$ink, [string]$background) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($background))
    if ($width -gt 0) {
        $scale = $size * $width / $bounds.Width
        $shape = $glyph.Clone()
        $matrix = New-Object System.Drawing.Drawing2D.Matrix($scale, 0, 0, $scale, ($size / 2 - ($bounds.X + $bounds.Width / 2) * $scale), ($size / 2 - ($bounds.Y + $bounds.Height / 2) * $scale))
        $shape.Transform($matrix)
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($ink))
        $graphics.FillPath($brush, $shape)
        $brush.Dispose(); $matrix.Dispose(); $shape.Dispose()
    }
    $bitmap.Save((Join-Path $root "assets/images/$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
}
try {
    Write-BrandPng 'icon' 1024 0.58 '#0B4F56' '#F3F0E9'
    # Entire foreground fits inside Android's central 66/108 safe circle.
    Write-BrandPng 'android-icon-foreground' 1024 0.46 '#0B4F56' 'Transparent'
    Write-BrandPng 'android-icon-monochrome' 1024 0.46 '#000000' 'Transparent'
    Write-BrandPng 'android-icon-background' 1024 0 '#0B4F56' '#F3F0E9'
    Write-BrandPng 'splash-icon' 512 0.72 '#0B4F56' 'Transparent'
    Write-BrandPng 'splash-icon-dark' 512 0.72 '#8ADCE2' 'Transparent'
    Write-BrandPng 'favicon' 48 0.72 '#0B4F56' '#F3F0E9'
} finally {
    $glyph.Dispose(); $fonts.Dispose()
}
