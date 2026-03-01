import sharp from 'sharp'
import { randomBytes } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ProcessingOptions, ProcessedImage, DEFAULT_PROCESSING_OPTIONS } from './image.types'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])

/**
 * Generate a unique filename matching the pattern from resize.sh.
 * Format: scan_YYYYMMDD_HHMMSS_NNN_HEXHEXHEX.jpg
 *
 * The original bash script uses: scan_${TIMESTAMP}_$(printf '%03d' $COUNT)_$(openssl rand -hex 4).jpg
 * We replicate the same structure with a JS Date and crypto.randomBytes.
 */
function generateUniqueFilename(index: number): string {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('')

  const count = String(index).padStart(3, '0')
  const hex = randomBytes(4).toString('hex')

  return `scan_${timestamp}_${count}_${hex}.jpg`
}

/**
 * Process a single image file using sharp.
 * Replicates the exact behavior of resize.sh:
 * - Resize to fit within maxWidth x maxHeight (only downscale, not upscale)
 * - Convert to grayscale
 * - Normalize (stretch histogram)
 * - Sharpen with sigma 1.0
 * - Output as JPEG quality 65
 */
export async function processImage(
  inputPath: string,
  outputDir: string,
  index: number,
  options?: Partial<ProcessingOptions>
): Promise<ProcessedImage> {
  const opts: ProcessingOptions = { ...DEFAULT_PROCESSING_OPTIONS, ...options }

  const originalName = path.basename(inputPath)
  const generatedName = generateUniqueFilename(index)
  const outputPath = path.join(outputDir, generatedName)

  await fs.mkdir(outputDir, { recursive: true })

  const inputStat = await fs.stat(inputPath)
  const originalSizeBytes = inputStat.size

  // Build the sharp pipeline to match resize.sh:
  //   convert "$f" -density 300 -resize '2480x3508>' -colorspace Gray -normalize -sharpen 0x1 -quality 65
  let pipeline = sharp(inputPath)

  // Resize to fit within maxWidth x maxHeight, only downscale (withoutEnlargement = true)
  // This matches ImageMagick's '2480x3508>' operator (the '>' means only shrink larger)
  pipeline = pipeline.resize({
    width: opts.maxWidth,
    height: opts.maxHeight,
    fit: 'inside',
    withoutEnlargement: true
  })

  if (opts.grayscale) {
    pipeline = pipeline.grayscale()
  }

  if (opts.normalize) {
    pipeline = pipeline.normalize()
  }

  if (opts.sharpen) {
    // ImageMagick's -sharpen 0x1 uses radius=0 (auto) and sigma=1.0
    pipeline = pipeline.sharpen({ sigma: 1.0 })
  }

  const outputInfo = await pipeline
    .jpeg({ quality: opts.quality })
    .toFile(outputPath)

  const outputStat = await fs.stat(outputPath)

  return {
    sourcePath: inputPath,
    outputPath,
    originalName,
    generatedName,
    originalSizeBytes,
    compressedSizeBytes: outputStat.size,
    width: outputInfo.width,
    height: outputInfo.height
  }
}

/**
 * Process all images in an inbox directory.
 * Finds all .jpg/.jpeg/.png files (case-insensitive), processes them, and saves to outputDir.
 * Returns array of ProcessedImage results.
 */
export async function processInbox(
  inboxDir: string,
  outputDir: string,
  options?: Partial<ProcessingOptions>
): Promise<ProcessedImage[]> {
  await fs.mkdir(outputDir, { recursive: true })

  const entries = await fs.readdir(inboxDir)

  const imageFiles = entries
    .filter((entry) => {
      const ext = path.extname(entry).toLowerCase()
      return IMAGE_EXTENSIONS.has(ext)
    })
    .sort()

  const results: ProcessedImage[] = []

  for (let i = 0; i < imageFiles.length; i++) {
    const inputPath = path.join(inboxDir, imageFiles[i])
    const result = await processImage(inputPath, outputDir, i + 1, options)
    results.push(result)
  }

  return results
}
