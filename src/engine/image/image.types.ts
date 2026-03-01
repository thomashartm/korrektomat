export interface ProcessingOptions {
  maxWidth: number
  maxHeight: number
  grayscale: boolean
  normalize: boolean
  sharpen: boolean
  quality: number
}

export interface ProcessedImage {
  sourcePath: string
  outputPath: string
  originalName: string
  generatedName: string
  originalSizeBytes: number
  compressedSizeBytes: number
  width: number
  height: number
}

export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  maxWidth: 2480,
  maxHeight: 3508,
  grayscale: true,
  normalize: true,
  sharpen: true,
  quality: 65
}
