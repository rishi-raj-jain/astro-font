import { create } from 'fontkit'
import { Buffer } from 'node:buffer'
import { relative, join } from 'node:path'
import { getFallbackMetricsFromFontFile } from './font.ts'
import { pickFontFileForFallbackGeneration } from './fallback.ts'

interface Record {
  [property: string]: string
}

interface Config {
  name: string
  display: string
  selector: string
  basePath?: string
  preload?: boolean
  notFetch?: boolean
  fallback: 'serif' | 'sans-serif'
  src: {
    path: string
    style: string
    preload?: boolean
    weight?: string | number
    css?: Record
  }[]
}

export interface Props {
  config: Config[]
}

export function getRelativePath(from: string, to: string) {
  if (to.includes('https')) return to
  return '/' + relative(from, to)
}

const extToPreload = {
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
}

const extToFormat = {
  woff: 'woff',
  woff2: 'woff2',
  ttf: 'truetype',
  otf: 'opentype',
  eot: 'embedded-opentype',
}

// Check if file system can be accessed
async function getFS() {
  let fs
  try {
    fs = await import('node:fs')
  } catch (error) {}
  return fs
}

// Check if writing is permitted by the file system
async function ifFSWrites() {
  try {
    const fs = await getFS()
    if (fs) {
      fs.accessSync('./random', fs.constants.W_OK)
      return true
    }
  } catch (e) {}
  return false
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
  const writeAllowed = await ifFSWrites()
  if (!writeAllowed) return [i, j, savedName]

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
export async function generateFonts(fontCollection: Config[]) {
  const duplicatedCollection = [...fontCollection]
  const indicesMatrix: [number, number, string, string][] = []
  duplicatedCollection.forEach((config, i) => {
    if (!config.notFetch) {
      config.src.forEach((src, j) => {
        indicesMatrix.push([i, j, src.path, config.basePath || './public'])
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

async function getFallbackFont(fontCollection: Config) {
  const fonts: any[] = []
  const fs = await getFS()
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
    return getFallbackMetricsFromFontFile(metadata, fontCollection.fallback)
  }
  return
}

export function createPreloads(fontCollection: Config): string[] {
  return fontCollection.src.filter((i) => i.preload !== false).map((i) => getRelativePath(fontCollection.basePath || './public', i.path))
}

export async function createBaseCSS(fontCollection: Config): Promise<string[]> {
  return fontCollection.src.map((i) => {
    const cssProperties = Object.entries(i.css || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(';')
    let fontWeightCSS = ''
    if (i.weight) {
      fontWeightCSS = ' font-weight: ' + i.weight + ';'
    }
    return `@font-face {${cssProperties} font-style: ${i.style};${fontWeightCSS} font-family: ${fontCollection.name}; font-display: ${
      fontCollection.display
    }; src: url(${getRelativePath(fontCollection.basePath || './public', i.path)});}`
  })
}

export async function createFontCSS(fontCollection: Config): Promise<string> {
  const collection = []
  const fallbackFont = await getFallbackFont(fontCollection)
  const fallbackName = '_font_fallback_' + new Date().getTime()
  collection.push(fontCollection.selector)
  collection.push(`{`)
  if (fallbackFont) {
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
