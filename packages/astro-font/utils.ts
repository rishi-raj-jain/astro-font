import { create } from 'fontkit'
import { Buffer } from 'node:buffer'
import { slug } from 'github-slugger'
import { relative, join } from 'node:path'
import { getFallbackMetricsFromFontFile } from './font.ts'
import { pickFontFileForFallbackGeneration } from './fallback.ts'

interface Record {
  [property: string]: string
}

interface Source {
  path: string
  css?: Record
  style: string
  preload?: boolean
  weight?: string | number
}

interface Config {
  name: string
  src: Source[]
  fetch?: boolean
  display: string
  selector: string
  preload?: boolean
  cacheDir?: string
  basePath?: string
  fallback: 'serif' | 'sans-serif'
}

export interface Props {
  config: Config[]
}

const extToPreload = {
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
}

function getBasePath(src?: string) {
  return src || './public'
}

export function getRelativePath(from: string, to: string) {
  if (to.includes('https')) return to
  return '/' + relative(from, to)
}

// Check if file system can be accessed
async function getFS(): Promise<typeof import('node:fs') | undefined> {
  let fs
  try {
    fs = await import('node:fs')
    return fs
  } catch (e) {
    console.log(e)
  }
}

async function getOS(): Promise<typeof import('node:os') | undefined> {
  let os
  try {
    os = await import('node:os')
    return os
  } catch (e) {
    console.log(e)
  }
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
  } catch (e) {
    console.log(e)
  }
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
  if (path.includes('https://')) {
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

// Function to generate the final destination of the fonts and consume further
export async function generateFonts(fontCollection: Config[]): Promise<Config[]> {
  const duplicatedCollection = [...fontCollection]
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

async function getFallbackFont(fontCollection: Config): Promise<Record> {
  const fonts: any[] = []
  let writeAllowed, tmpDir, cachedFilePath, cacheDir
  const [os, fs] = await Promise.all([getOS(), getFS()])
  if (fs) {
    if (os) {
      writeAllowed = await Promise.all([ifFSOSWrites(os.tmpdir()), ifFSOSWrites('/tmp')])
      tmpDir = writeAllowed.find((i) => i !== undefined)
      cacheDir = fontCollection.cacheDir || (tmpDir ? join(tmpDir, '.astro_font') : undefined)
      if (cacheDir) {
        // Create a json based on slugified path, style and weight
        const slugifyPath = (i: Source) => slug(`${i.path}_${i.style}_${i.weight}`)
        const slugifiedCollection = fontCollection.src.map(slugifyPath)
        const cachedFileName = simpleHash(slugifiedCollection.join('_')) + '.txt'
        cachedFilePath = join(cacheDir, cachedFileName)
        if (fs.existsSync(cachedFilePath)) {
          return JSON.parse(fs.readFileSync(cachedFilePath, 'utf8'))
        }
      }
    }
    await Promise.all(
      fontCollection.src.map((i) =>
        getFontBuffer(i.path).then((res) => {
          if (res) {
            fonts.push({
              style: i.style,
              weight: i.weight,
              metadata: create(res),
            })
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
            console.log(`[astro-font] ▶ Created ${cacheDir}`)
          }
        }
        if (cachedFilePath) {
          if (!fs.existsSync(cachedFilePath)) {
            fs.writeFileSync(cachedFilePath, JSON.stringify(fallbackMetrics), 'utf8')
            console.log(`[astro-font] ▶ Created ${cachedFilePath}`)
          }
        }
      }
      return fallbackMetrics
    }
  }
  return {}
}

export function createPreloads(fontCollection: Config): string[] {
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
  const fallbackName = '_font_fallback_' + new Date().getTime()
  collection.push(fontCollection.selector)
  collection.push(`{`)
  if (Object.keys(fallbackFont).length > 0) {
    collection.push(`font-family: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback};`)
    collection.push(`}`)
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
    collection.push(`font-family: ${fontCollection.name}, ${fontCollection.fallback};`)
    collection.push(`}`)
  }
  return collection.join(' ')
}
