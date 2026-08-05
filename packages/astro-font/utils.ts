import { create } from 'fontkit'
import { join } from 'node:path'
import { relative } from 'pathe'
import { Buffer } from 'node:buffer'
import { getFallbackMetricsFromFontFile } from './font.ts'
import { pickFontFileForFallbackGeneration } from './fallback.ts'

type GlobalValues = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset'

export interface Source {
  path: string
  preload?: boolean
  css?: Record<string, string>
  // https://developer.mozilla.org/en-US/docs/Web/CSS/font-style
  style: 'normal' | 'italic' | 'oblique' | `oblique ${number}deg` | GlobalValues | (string & {})
  // https://developer.mozilla.org/en-US/docs/Web/CSS/font-weight
  weight?:
    | 'normal'
    | 'bold'
    | 'lighter'
    | 'bolder'
    | GlobalValues
    | 100
    | 200
    | 300
    | 400
    | 500
    | 600
    | 700
    | 800
    | 900
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900'
    | (string & {})
    | (number & {})
}

export interface Config {
  name: string
  src: Source[]
  fetch?: boolean
  verbose?: boolean
  selector?: string
  preload?: boolean
  cacheDir?: string
  basePath?: string
  fallbackName?: string
  googleFontsURL?: string
  cssVariable?: string | boolean
  fallback: 'serif' | 'sans-serif' | 'monospace'
  // https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display
  display: 'auto' | 'block' | 'swap' | 'fallback' | 'optional' | (string & {})
}

export interface Props {
  config: Config[]
}

export interface FontFile {
  path: string
  url: string
  data: ArrayBuffer
  style?: string
  weight?: string
}

export interface GetFontOptions {
  weight?: string | number
  style?: string
}

const extToPreload = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  eot: 'application/vnd.ms-fontobject',
}

function getBasePath(src?: string) {
  return src || './public'
}

export function getRelativePath(from: string, to: string) {
  if (to.includes('https:') || to.includes('http:')) return to
  return '/' + relative(from, to)
}

// Check if file system can be accessed
async function getFS(): Promise<typeof import('node:fs') | undefined> {
  let fs
  try {
    fs = await import('node:fs')
    return fs
  } catch (e) {}
}

async function getOS(): Promise<typeof import('node:os') | undefined> {
  let os
  try {
    os = await import('node:os')
    return os
  } catch (e) {}
}

// Check if writing is permitted by the file system
async function ifFSOSWrites(dir: string): Promise<string | undefined> {
  try {
    const fs = await getFS()
    if (fs) {
      const testDir = join(dir, '.astro_font')
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true })
      fs.rmSync(testDir, { recursive: true, force: true })
      return dir
    }
  } catch (e) {}
}

// Compute the preload type for the <link tag
export function getPreloadType(src: string) {
  const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(src)?.[1]
  if (!ext) throw Error(`Unexpected file \`${src}\``)
  return extToPreload[ext as 'woff' | 'woff2' | 'eot' | 'ttf' | 'otf']
}

// Get the font whether remote or local buffer
async function getFontBuffer(path: string): Promise<Buffer | undefined> {
  const fs = await getFS()
  if (path.includes('https:') || path.includes('http:')) {
    try {
      const response = await fetch(path)
      if (!response.ok) return undefined
      return Buffer.from(await response.arrayBuffer())
    } catch {
      return undefined
    }
  }
  // If the file system has the access to the *local* font
  if (fs && fs.existsSync(path)) {
    return fs.readFileSync(path)
  }
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

async function readResolvedFontFile(path: string): Promise<Buffer | undefined> {
  const fs = await getFS()
  if (!path.includes('https:') && !path.includes('http:')) {
    if (fs?.existsSync(path)) return fs.readFileSync(path)
  }
  return getFontBuffer(path)
}

// Get everything after the last forward slash
function extractFileNameFromPath(path: string): string {
  const lastSlashIndex = path.lastIndexOf('/')
  if (lastSlashIndex !== -1) return path.substring(lastSlashIndex + 1)
  return path
}

function simpleHash(input: string) {
  let hash = 0
  if (input.length === 0) return hash
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16) + input.length
}

async function createFontFiles(fontPath: [number, number, string, string]): Promise<[number, number, string]> {
  const [i, j, path, basePath] = fontPath

  // Check if we've access to fs exist in the system
  const fs = await getFS()
  if (!fs) return [i, j, path]

  // Compute the to-be destination of the font
  const name = extractFileNameFromPath(path)
  const generatedFolderPath = join(basePath, '__astro_font_generated__')
  const savedName = join(generatedFolderPath, name)

  // If the to-be destination already exists, pre-predict
  if (fs.existsSync(savedName)) return [i, j, savedName]

  // Check if writing files is permitted by the system
  const writeAllowed = await ifFSOSWrites(process.cwd())
  if (!writeAllowed) return [i, j, path]

  // By now, we can do anything with fs, hence proceed with creating the folder
  if (!fs.existsSync(generatedFolderPath)) {
    fs.mkdirSync(generatedFolderPath, { recursive: true })
    console.log(`[astro-font] ▶ Created ${generatedFolderPath}`)
  }

  // Try to get the font buffer
  // If found, place it in the required directory
  const fontBuffer = await getFontBuffer(path)
  if (fontBuffer) {
    console.log(`[astro-font] ▶ Generated ${savedName}`)
    fs.writeFileSync(savedName, fontBuffer)
    return [i, j, savedName]
  }

  // Fallback to the original configurations
  return [i, j, path]
}

// Custom script to parseGoogleCSS
function parseGoogleCSS(tmp: string) {
  let match
  const fontFaceMatches = []
  const fontFaceRegex = /@font-face\s*{([^}]+)}/g
  while ((match = fontFaceRegex.exec(tmp)) !== null) {
    const fontFaceRule = match[1]
    const fontFaceObject: any = {}
    fontFaceRule.split(';').forEach((property) => {
      if (property.includes('src') && property.includes('url')) {
        try {
          fontFaceObject['path'] = property
            .trim()
            .split(/\(|\)|(url\()/)
            .find((each) => each.trim().includes('https:'))
            ?.trim()
        } catch (e) {}
      }
      if (property.includes('-style')) {
        fontFaceObject['style'] = property.split(':').map((i) => i.trim())[1]
      }
      if (property.includes('-weight')) {
        fontFaceObject['weight'] = property.split(':').map((i) => i.trim())[1]
      }
      if (property.includes('unicode-range')) {
        if (!fontFaceObject['css']) fontFaceObject['css'] = {}
        fontFaceObject['css']['unicode-range'] = property.split(':').map((i) => i.trim())[1]
      }
    })
    fontFaceMatches.push(fontFaceObject)
  }
  return fontFaceMatches
}

const googleFontsUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

async function fetchGoogleFontsCSS(config: Config): Promise<Source[]> {
  const response = await fetch(config.googleFontsURL!, {
    headers: { 'User-Agent': googleFontsUserAgent },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const parsed = parseGoogleCSS(await response.text())
  if (parsed.length === 0) throw new Error('No @font-face rules found in Google Fonts CSS')
  return parsed
}

function getConfiguredFontStack(fontCollection: Config) {
  return `'${fontCollection.name}', ${fontCollection.fallback}`
}

// Function to generate the final destination of the fonts and consume further
export async function generateFonts(fontCollection: Config[]): Promise<Config[]> {
  const duplicatedCollection = [...fontCollection]
  // Pre-operation to parse and insert google fonts in the src array
  await Promise.all(
    duplicatedCollection.map(async (config) => {
      if (!config.googleFontsURL) return
      try {
        config.src = await fetchGoogleFontsCSS(config)
      } catch (error) {
        console.warn(
          `[astro-font] Failed to fetch Google Fonts for "${config.name}", using ${config.fallback} fallback`,
        )
        if (config.verbose) console.warn(error)
      }
    }),
  )
  const indicesMatrix: [number, number, string, string][] = []
  duplicatedCollection.forEach((config, i) => {
    if (config.fetch) {
      config.src.forEach((src, j) => {
        indicesMatrix.push([i, j, src.path, getBasePath(config.basePath)])
      })
    }
  })
  if (indicesMatrix.length > 0) {
    const tmp = await Promise.all(indicesMatrix.map(createFontFiles))
    tmp.forEach((i) => {
      duplicatedCollection[i[0]]['src'][i[1]]['path'] = i[2]
    })
  }
  return duplicatedCollection
}

function normalizeWeight(weight?: string | number): string | undefined {
  if (weight === undefined) return undefined
  if (weight === 'normal') return '400'
  if (weight === 'bold') return '700'
  return String(weight)
}

function sourceMatchesOptions(src: Source, options?: GetFontOptions): boolean {
  if (!options) return true
  if (options.style && src.style !== options.style) return false
  const targetWeight = normalizeWeight(options.weight)
  if (!targetWeight || src.weight === undefined) return true
  const sourceWeight = normalizeWeight(src.weight)
  if (!sourceWeight) return false
  if (sourceWeight.includes(' ')) {
    const [min, max] = sourceWeight.split(/\s+/).map(Number)
    const weight = Number(targetWeight)
    return weight >= min && weight <= max
  }
  return sourceWeight === targetWeight
}

function pickDefaultSource(sources: Source[]): Source {
  if (sources.length === 1) return sources[0]
  const preferred = sources.find((src) => {
    const weight = normalizeWeight(src.weight)
    return weight === '400' && (!src.style || src.style === 'normal')
  })
  return preferred ?? sources[0]
}

async function resolveFontFamily(fontName: string, fontCollection: Config[]): Promise<Config> {
  const configs = await generateFonts(fontCollection)
  const config = configs.find((entry) => entry.name === fontName)
  if (!config) throw new Error(`[astro-font] Font "${fontName}" not found in config`)
  if (config.src.length === 0) {
    throw new Error(`[astro-font] No font files resolved for "${fontName}"`)
  }
  return config
}

function getSourcesForOptions(config: Config, options?: GetFontOptions): Source[] {
  if (!options) return config.src
  const matched = config.src.filter((src) => sourceMatchesOptions(src, options))
  if (matched.length === 0) {
    throw new Error(`[astro-font] No font files match the provided options for "${config.name}"`)
  }
  return matched
}

export async function getFonts(
  fontName: string,
  fontCollection: Config[],
  options?: GetFontOptions,
): Promise<FontFile[]> {
  const config = await resolveFontFamily(fontName, fontCollection)
  const sources = getSourcesForOptions(config, options)
  const basePath = getBasePath(config.basePath)
  const files: FontFile[] = []

  for (const src of sources) {
    const buffer = await readResolvedFontFile(src.path)
    if (!buffer) continue
    files.push({
      path: src.path,
      url: getRelativePath(basePath, src.path),
      data: bufferToArrayBuffer(buffer),
      style: src.style,
      weight: src.weight?.toString(),
    })
  }

  if (files.length === 0) {
    throw new Error(`[astro-font] No font files found for "${fontName}"`)
  }

  return files
}

export async function getFontData(
  fontName: string,
  fontCollection: Config[],
  options?: GetFontOptions,
): Promise<ArrayBuffer> {
  const config = await resolveFontFamily(fontName, fontCollection)
  const source = options ? getSourcesForOptions(config, options)[0] : pickDefaultSource(config.src)
  const buffer = await readResolvedFontFile(source.path)
  if (!buffer) {
    throw new Error(`[astro-font] Could not read font file for "${fontName}"`)
  }
  return bufferToArrayBuffer(buffer)
}

export async function getFontURLs(
  fontName: string,
  fontCollection: Config[],
  options?: GetFontOptions,
): Promise<string[]> {
  const config = await resolveFontFamily(fontName, fontCollection)
  const sources = getSourcesForOptions(config, options)
  const basePath = getBasePath(config.basePath)
  return sources.map((src) => getRelativePath(basePath, src.path))
}

export async function getFontURL(
  fontName: string,
  fontCollection: Config[],
  options?: GetFontOptions,
): Promise<string> {
  const urls = await getFontURLs(fontName, fontCollection, options)
  return urls[0]
}

async function getFallbackFont(fontCollection: Config): Promise<Record<string, string>> {
  const fonts: any[] = []
  let writeAllowed, tmpDir, cachedFilePath, cacheDir
  const [os, fs] = await Promise.all([getOS(), getFS()])
  if (fs) {
    if (os) {
      writeAllowed = await Promise.all([ifFSOSWrites(os.tmpdir()), ifFSOSWrites('/tmp')])
      tmpDir = writeAllowed.find((i) => i !== undefined)
      cacheDir = fontCollection.cacheDir || tmpDir
      if (cacheDir) {
        // Create a json based on slugified path, style and weight
        const slugifyPath = (i: Source) => `${i.path}_${i.style}_${i.weight}`
        const slugifiedCollection = fontCollection.src.map(slugifyPath)
        const cachedFileName = simpleHash(slugifiedCollection.join('_')) + '.txt'
        cachedFilePath = join(cacheDir, cachedFileName)
        if (fs.existsSync(cachedFilePath)) {
          try {
            const tmpCachedFilePath = fs.readFileSync(cachedFilePath, 'utf8')
            return JSON.parse(tmpCachedFilePath)
          } catch (errorReadingCache) {}
        }
      }
    }
    await Promise.all(
      fontCollection.src.map((i) =>
        getFontBuffer(i.path).then((res) => {
          if (res) {
            try {
              const resMetadata = create(res)
              fonts.push({
                style: i.style,
                weight: i.weight?.toString(),
                metadata: resMetadata,
              })
            } catch (e) {
              if (fontCollection.verbose) {
                console.log(`[astro-font] ▶`)
                console.error(e)
              }
            }
          }
        }),
      ),
    )
    if (fs && fonts.length > 0) {
      const { metadata } = pickFontFileForFallbackGeneration(fonts)
      const fallbackMetrics = getFallbackMetricsFromFontFile(metadata, fontCollection.fallback)
      if (tmpDir) {
        if (cacheDir) {
          if (!fs.existsSync(cacheDir)) {
            // Check if writing files is permitted by the system
            const writeAllowed = await ifFSOSWrites(process.cwd())
            if (writeAllowed) {
              fs.mkdirSync(cacheDir, { recursive: true })
              if (fontCollection.verbose) {
                console.log(`[astro-font] ▶ Created ${cacheDir}`)
              }
            }
          }
        }
        if (cachedFilePath) {
          if (!fs.existsSync(cachedFilePath)) {
            const writeAllowed = await ifFSOSWrites(process.cwd())
            if (writeAllowed) {
              fs.writeFileSync(cachedFilePath, JSON.stringify(fallbackMetrics), 'utf8')
              if (fontCollection.verbose) {
                console.log(`[astro-font] ▶ Created ${cachedFilePath}`)
              }
            }
          }
        }
      }
      return fallbackMetrics
    }
  }
  return {}
}

export function createPreloads(fontCollection: Config): string[] {
  // If the parent preload is set to be false, look for true only preload values
  if (fontCollection.preload === false) {
    return fontCollection.src
      .filter((i) => i.preload === true)
      .map((i) => getRelativePath(getBasePath(fontCollection.basePath), i.path))
  }
  // If the parent preload is set to be true (or not defined), look for non-false values
  return fontCollection.src
    .filter((i) => i.preload !== false)
    .map((i) => getRelativePath(getBasePath(fontCollection.basePath), i.path))
}

export async function createBaseCSS(fontCollection: Config): Promise<string[]> {
  try {
    const tmp = fontCollection.src.map((i) => {
      const cssProperties = Object.entries(i.css || {}).map(([key, value]) => `${key}: ${value}`)
      if (i.weight) cssProperties.push(`font-weight: ${i.weight}`)
      if (i.style) cssProperties.push(`font-style: ${i.style}`)
      if (fontCollection.name) cssProperties.push(`font-family: '${fontCollection.name}'`)
      if (fontCollection.display) cssProperties.push(`font-display: ${fontCollection.display}`)
      cssProperties.push(`src: url(${getRelativePath(getBasePath(fontCollection.basePath), i.path)})`)
      return `@font-face {${cssProperties.join(';')}}`
    })
    return tmp
  } catch (e) {
    console.log(e)
  }
  return []
}

export async function createFontCSS(fontCollection: Config): Promise<string> {
  const collection = []
  const fallbackFont = await getFallbackFont(fontCollection)
  const fallbackName = `'${fontCollection.fallbackName || '_font_fallback_' + Math.floor(Math.random() * Date.now())}'`
  if (fontCollection.selector) {
    collection.push(fontCollection.selector)
    collection.push(`{`)
  }
  if (Object.keys(fallbackFont).length > 0) {
    if (fontCollection.selector) {
      collection.push(`font-family: '${fontCollection.name}', ${fallbackName}, ${fontCollection.fallback};`)
      collection.push(`}`)
    }
    if (typeof fontCollection.cssVariable === 'boolean' && fontCollection.cssVariable) {
      collection.push(`:root{ --astro-font: '${fontCollection.name}', ${fallbackName}, ${fontCollection.fallback}; }`)
    } else if (typeof fontCollection.cssVariable === 'string' && fontCollection.cssVariable.length > 0) {
      collection.push(
        `:root{ --${fontCollection.cssVariable}: '${fontCollection.name}', ${fallbackName}, ${fontCollection.fallback}; }`,
      )
    }
    collection.push(`@font-face`)
    collection.push(`{`)
    collection.push(`font-family: ${fallbackName};`)
    collection.push(`size-adjust: ${fallbackFont.sizeAdjust};`)
    collection.push(`src: local('${fallbackFont.fallbackFont}');`)
    collection.push(`ascent-override: ${fallbackFont.ascentOverride};`)
    collection.push(`descent-override: ${fallbackFont.descentOverride};`)
    collection.push(`line-gap-override: ${fallbackFont.lineGapOverride};`)
    collection.push(`}`)
  } else {
    const fontStack = getConfiguredFontStack(fontCollection)
    if (fontCollection.selector) {
      collection.push(`font-family: ${fontStack};`)
      collection.push(`}`)
    }
    if (typeof fontCollection.cssVariable === 'boolean' && fontCollection.cssVariable) {
      collection.push(`:root{ --astro-font: ${fontStack}; }`)
    } else if (typeof fontCollection.cssVariable === 'string' && fontCollection.cssVariable.length > 0) {
      collection.push(`:root{ --${fontCollection.cssVariable}: ${fontStack}; }`)
    }
  }
  return collection.join(' ')
}
