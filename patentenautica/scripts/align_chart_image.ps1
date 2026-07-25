$ErrorActionPreference = "Stop"

$projectRoot = Split-Path $PSScriptRoot -Parent
$source = Join-Path $projectRoot "Carta 5D_5_Immagine unica Adobe alleggerita.pdf"
$target = Join-Path $projectRoot "carta nautica 5D originale.jpg"
$enhancedPdf = Join-Path $projectRoot "Carta 5D 340dpi migliorata.pdf"
$pdfBuilder = Join-Path $PSScriptRoot "build_enhanced_chart_pdf.py"
$tempRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot "tmp\pdfs"))
$tempDirectory = Join-Path $tempRoot ("carta5d-" + [Guid]::NewGuid().ToString("N"))

if (-not $tempDirectory.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Percorso temporaneo non valido."
}

New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null

try {
  $extractPrefix = Join-Path $tempDirectory "extract"
  & pdfimages -f 1 -l 1 -j $source $extractPrefix
  if ($LASTEXITCODE -ne 0) {
    throw "Poppler non ha estratto l'immagine incorporata nel PDF."
  }

  $extracted = Join-Path $tempDirectory "extract-000.jpg"
  if (-not (Test-Path -LiteralPath $extracted)) {
    throw "L'immagine incorporata attesa non è stata generata."
  }

  Copy-Item -LiteralPath $extracted -Destination $target -Force

  $dimensions = & magick identify -format "%wx%h" $target
  if ($dimensions -ne "7501x4844") {
    throw "Dimensioni inattese della carta originale: $dimensions."
  }

  $enhancedJpeg = Join-Path $tempDirectory "chart-340dpi.jpg"
  & magick $extracted `
    -filter Lanczos `
    -resize "200%" `
    -colorspace Gray `
    -unsharp "0x0.9+0.65+0.02" `
    -units PixelsPerInch `
    -density 340 `
    -strip `
    -interlace Plane `
    -quality 96 `
    $enhancedJpeg
  if ($LASTEXITCODE -ne 0) {
    throw "ImageMagick non ha creato il raster a 340 DPI."
  }

  & python $pdfBuilder `
    --source-pdf $source `
    --image $enhancedJpeg `
    --output $enhancedPdf
  if ($LASTEXITCODE -ne 0) {
    throw "La generazione del PDF a 340 DPI non è riuscita."
  }

  Write-Output "Carta web originale: $target ($dimensions)"
  Write-Output "Carta PDF 340 DPI: $enhancedPdf"
}
finally {
  if (
    (Test-Path -LiteralPath $tempDirectory) -and
    $tempDirectory.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)
  ) {
    Remove-Item -LiteralPath $tempDirectory -Recurse -Force
  }
}
