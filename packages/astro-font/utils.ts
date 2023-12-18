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

async function getFS() {
  let fs
  try {
    fs = await import('node:fs')
  } catch (error) {}
  return fs
}

export function getPreloadType(src: string) {
  const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(src)?.[1]
  if (!ext) 
    throw Error(`Unexpected file \`${src}\``)
  return extToPreload[ext as 'woff' | 'woff2' | 'eot' | 'ttf' | 'otf']
}

export function getFontType(src: string) {
  const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(src)?.[1]
  if (!ext) 
    throw Error(`Unexpected file \`${src}\``)
  return extToFormat[ext as 'woff' | 'woff2' | 'eot' | 'ttf' | 'otf']
}

async function getFontBuffer(path: string): Promise<Buffer | undefined> {
  const fs = await getFS()
  if (path.includes('https://')) {
    let tmp = await fetch(path)
    return Buffer.from(await tmp.arrayBuffer())
  } else {
    if (fs) {
      return fs.readFileSync(path)
    }
  }
}

function extractFileNameFromPath(path: string): string {
  const lastSlashIndex = path.lastIndexOf('/')
  if (lastSlashIndex !== -1) return path.substring(lastSlashIndex + 1)
  return path
}

async function createFontFiles(fontPath: [number, number, string, string]): Promise<[number, number, string]> {
  const fs = await getFS()
  const [i, j, path, basePath] = fontPath
  if (!fs) return [i, j, path]
  const name = extractFileNameFromPath(path)
  const generatedFolderPath = join(basePath, '__astro_font_generated__')
  const savedName = join(generatedFolderPath, name)
  if (fs.existsSync(savedName)) return [i, j, savedName]
  const fontBuffer = await getFontBuffer(path)
  if (!fs.existsSync(generatedFolderPath)) fs.mkdirSync(generatedFolderPath)
  if (fontBuffer) {
    console.log(`[astro-font] ▶ Generated ${savedName}`)
    fs.writeFileSync(savedName, fontBuffer)
    return [i, j, savedName]
  }
  return [i, j, path]
}

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
  if (fs) {
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
  const fallbackName = '_font_fallback_' + new Date().getTime()
  const fallbackFont = await getFallbackFont(fontCollection)
  if (fallbackFont)
    return `${fontCollection.selector}{font-family: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback};} @font-face{font-family: ${fallbackName}; size-adjust: ${fallbackFont.sizeAdjust}; src: local('${fallbackFont.fallbackFont}'); ascent-override: ${fallbackFont.ascentOverride}; descent-override: ${fallbackFont.descentOverride}; line-gap-override: ${fallbackFont.lineGapOverride};}`
  return `${fontCollection.selector}{font-family: ${fontCollection.name}, ${fontCollection.fallback};}`
}
