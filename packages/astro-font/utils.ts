import { create } from 'fontkit'
import { join } from 'node:path'
import { relative } from 'pathe'
import { Buffer } from 'node:buffer'
import { getFallbackMetricsFromFontFile } from './font.ts'
import { pickFontFileForFallbackGeneration } from './fallback.ts'

type GlobalValues = 'inherit' | 'initial' | 'revert' | 'revert-layer' | 'unset'

interface Source {
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

interface Config {
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
      if (!fs.existsSync(testDir)) fs.mkdirSync(testDir)
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
    let tmp = await fetch(path)
    return Buffer.from(await tmp.arrayBuffer())
  } else {
    // If the file system has the access to the *local* font
    if (fs && fs.existsSync(path)) {
      return fs.readFileSync(path)
    }
  }
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
    fs.mkdirSync(generatedFolderPath)
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

// Function to generate the final destination of the fonts and consume further
export async function generateFonts(fontCollection: Config[]): Promise<Config[]> {
  const duplicatedCollection = [...fontCollection]
  // Pre-operation to parse and insert google fonts in the src array
  await Promise.all(
    duplicatedCollection.map((config) =>
      config.googleFontsURL
        ? fetch(config.googleFontsURL, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            },
          })
            .then((res) => res.text())
            .then((res) => {
              config.src = parseGoogleCSS(res)
            })
        : {},
    ),
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
            fs.mkdirSync(cacheDir)
            if (fontCollection.verbose) {
              console.log(`[astro-font] ▶ Created ${cacheDir}`)
            }
          }
        }
        if (cachedFilePath) {
          if (!fs.existsSync(cachedFilePath)) {
            fs.writeFileSync(cachedFilePath, JSON.stringify(fallbackMetrics), 'utf8')
            if (fontCollection.verbose) {
              console.log(`[astro-font] ▶ Created ${cachedFilePath}`)
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
      if (fontCollection.name) cssProperties.push(`font-family: ${fontCollection.name}`)
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
      collection.push(`font-family: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback};`)
      collection.push(`}`)
    }
    if (typeof fontCollection.cssVariable === 'boolean' && fontCollection.cssVariable) {
      collection.push(`:root{ --astro-font: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback}; }`)
    } else if (typeof fontCollection.cssVariable === 'string' && fontCollection.cssVariable.length > 0) {
      collection.push(
        `:root{ --${fontCollection.cssVariable}: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback}; }`,
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
    if (fontCollection.selector) {
      collection.push(`font-family: ${fontCollection.name}, ${fontCollection.fallback};`)
      collection.push(`}`)
    }
    if (typeof fontCollection.cssVariable === 'boolean' && fontCollection.cssVariable) {
      collection.push(`:root{ --astro-font: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback}; }`)
    } else if (typeof fontCollection.cssVariable === 'string' && fontCollection.cssVariable.length > 0) {
      collection.push(
        `:root{ --${fontCollection.cssVariable}: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback}; }`,
      )
    }
  }
  return collection.join(' ')
}
