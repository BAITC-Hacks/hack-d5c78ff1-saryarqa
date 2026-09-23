Add-Type -AssemblyName System.Drawing

$sourceRoot = $PSScriptRoot
$exportRoot = Join-Path $sourceRoot '..\..\..\exports\units\vehicles'
$frameSize = 256
$models = @(
  @{ Name = 'bus'; MaxSide = 224 },
  @{ Name = 'car'; MaxSide = 156 },
  @{ Name = 'lrt'; MaxSide = 236 },
  @{ Name = 'service-van'; MaxSide = 190 }
)

function Get-AlphaBounds($bitmap, [int]$left, [int]$top, [int]$width, [int]$height) {
  $minX = $left + $width; $minY = $top + $height
  $maxX = $left; $maxY = $top
  for ($y = $top; $y -lt $top + $height; $y += 1) {
    for ($x = $left; $x -lt $left + $width; $x += 1) {
      if ($bitmap.GetPixel($x, $y).A -gt 12) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt $minX) { throw 'No opaque artwork found in source half.' }
  return [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
}

function New-Frame($bitmap, $bounds, [int]$maxSide, [bool]$tilted) {
  $frame = [System.Drawing.Bitmap]::new($frameSize, $frameSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $scale = [Math]::Min($maxSide / $bounds.Width, $maxSide / $bounds.Height)
  $w = [int][Math]::Round($bounds.Width * $scale)
  $h = [int][Math]::Round($bounds.Height * $scale)
  $x = [int][Math]::Round(($frameSize - $w) / 2)
  $y = if ($tilted) { 240 - $h } else { [int][Math]::Round(($frameSize - $h) / 2) }
  $graphics = [System.Drawing.Graphics]::FromImage($frame)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.DrawImage($bitmap, [System.Drawing.Rectangle]::new($x, $y, $w, $h), $bounds, [System.Drawing.GraphicsUnit]::Pixel)
  } finally { $graphics.Dispose() }
  return $frame
}

function Save-Frame($bitmap, [string]$path) {
  $folder = Split-Path -Parent $path
  New-Item -ItemType Directory -Force -Path $folder | Out-Null
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

foreach ($model in $models) {
  $name = $model.Name
  $inputPath = Join-Path $sourceRoot "$name-pair.png"
  $input = [System.Drawing.Bitmap]::FromFile($inputPath)
  try {
    if ($input.Width -ne 1774 -or $input.Height -ne 887) { throw "Unexpected source size: $inputPath" }
    $topBounds = Get-AlphaBounds $input 0 0 887 887
    $tiltedBounds = Get-AlphaBounds $input 887 0 887 887
    $down = New-Frame $input $topBounds $model.MaxSide $false
    $tilted = New-Frame $input $tiltedBounds $model.MaxSide $true
    try {
      $frames = [ordered]@{ down = $down }
      foreach ($direction in @('left', 'up', 'right')) {
        $rotated = [System.Drawing.Bitmap]$down.Clone()
        $rotation = switch ($direction) {
          left { [System.Drawing.RotateFlipType]::Rotate90FlipNone }
          up { [System.Drawing.RotateFlipType]::Rotate180FlipNone }
          right { [System.Drawing.RotateFlipType]::Rotate270FlipNone }
        }
        $rotated.RotateFlip($rotation)
        $frames[$direction] = $rotated
      }
      foreach ($direction in $frames.Keys) {
        Save-Frame $frames[$direction] (Join-Path $exportRoot "$name\top\$direction\frame-01.png")
      }
      Save-Frame $tilted (Join-Path $exportRoot "$name\tilted\forward\frame-01.png")

      $atlas = [System.Drawing.Bitmap]::new(1280, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $graphics = [System.Drawing.Graphics]::FromImage($atlas)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $column = 0
        foreach ($direction in @('down', 'left', 'up', 'right')) {
          $graphics.DrawImageUnscaled($frames[$direction], $column * 256, 0)
          $column += 1
        }
        $graphics.DrawImageUnscaled($tilted, 1024, 0)
      } finally { $graphics.Dispose() }
      Save-Frame $atlas (Join-Path $exportRoot "$name\atlas.png")
      $atlas.Dispose()
    } finally {
      foreach ($frame in $frames.Values) { $frame.Dispose() }
      $tilted.Dispose()
    }
  } finally { $input.Dispose() }
}
