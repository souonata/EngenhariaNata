$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$source = Join-Path $projectRoot "carta nautica 5D.gif"
$target = Join-Path $projectRoot "carta nautica 5D allineata.webp"
$rotation = "-3.0738258000733896"

& magick $source `
  -background white `
  -alpha remove `
  -rotate $rotation `
  -strip `
  -define webp:lossless=true `
  $target

if ($LASTEXITCODE -ne 0) {
  throw "ImageMagick non ha completato l'allineamento della carta."
}

$dimensions = & magick identify -format "%wx%h" $target
if ($dimensions -ne "4612x3281") {
  throw "Dimensioni inattese dopo l'allineamento: $dimensions."
}

Write-Output "Carta allineata: $target ($dimensions)"
