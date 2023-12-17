import fetch from 'node-fetch'
import { Buffer } from 'node:buffer'
import { relative, join } from 'node:path'
import { openSync, create } from 'fontkit'
import { getFallbackMetricsFromFontFile } from './font'
import { pickFontFileForFallbackGeneration } from './fallback'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'

interface Config {
  name: string;
  display: string;
  selector: string;
  basePath?: string;
  preload?: boolean;
  fallback: "serif" | "sans-serif";
  src: {
    path: string;
    style: string;
    inline?: boolean;
    preload?: boolean;
    weight?: string | number;
    css?: { [property: string]: string };
  }[];
}

export interface Props {
  config: Config[];
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

export function getPreloadType(src: string) {
  const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(src)?.[1]
  if (!ext) {
    throw Error(`Unexpected file \`${src}\``)
  }
  return extToPreload[ext as 'woff' | 'woff2' | 'eot' | 'ttf' | 'otf'];
}

const extToFormat = {
  woff: 'woff',
  woff2: 'woff2',
  ttf: 'truetype',
  otf: 'opentype',
  eot: 'embedded-opentype',
}

export function getFontType(src: string) {
  const ext = /\.(woff|woff2|eot|ttf|otf)$/.exec(src)?.[1]
  if (!ext) {
    throw Error(`Unexpected file \`${src}\``)
  }
  return extToFormat[ext as 'woff' | 'woff2' | 'eot' | 'ttf' | 'otf'];
}

async function getFontBuffer(path: string) {
  let resp: Buffer
  if (path.includes('https://')) {
    let tmp = await fetch(path)
    resp = Buffer.from(await tmp.arrayBuffer())
  }
  else {
    resp = readFileSync(path)
  }
  return resp
}

function extractFileNameFromPath(path: string): string {
  const lastSlashIndex = path.lastIndexOf('/')
  if (lastSlashIndex !== -1) return path.substring(lastSlashIndex + 1)
  return path
}

async function createFontFiles(fontPath: [number, number, string, string]) {
  const [i, j, path, basePath] = fontPath;
  const name = extractFileNameFromPath(path)
  const generatedFolderPath = join(basePath, '__astro_font_generated__')
  const savedName = join(generatedFolderPath, name)
  if (existsSync(savedName)) return [i, j, savedName]
  const fontBuffer = await getFontBuffer(path);
  if (!existsSync(generatedFolderPath)) mkdirSync(generatedFolderPath);
  console.log(`[astro-font] ▶ Generated ${savedName}`)
  writeFileSync(savedName, fontBuffer);
  return [i, j, savedName]
}

export async function generateFonts(fontCollection: Config[]) {
  const duplicatedCollection = [...fontCollection]
  const indicesMatrix: [number, number, string, string][] = [];
  duplicatedCollection.forEach((config, i) => {
    config.src.forEach((src, j) => {
      indicesMatrix.push([i, j, src.path, config.basePath || './public']);
    });
  });
  if (indicesMatrix.length > 0) {
    console.log(`[astro-font] ▶ Generating local fonts`)
    const tmp = await Promise.all(indicesMatrix.map(createFontFiles))
    tmp.forEach(i => {
      duplicatedCollection[i[0]]['src'][i[1]]['path'] = i[2]
    })
    console.log(`[astro-font] ▶ Complete!`)
  }
  return duplicatedCollection
}

async function getFallbackFont(fontCollection: Config) {
  const fonts: any[] = []
  for (let i of fontCollection.src) {
    if (i.path.includes('https://')) {
      const tmp = await fetch(i.path)
      const resp = Buffer.from(await tmp.arrayBuffer())
      fonts.push({
        style: i.style,
        weight: i.weight,
        metadata: create(resp)
      })
    }
    else {
      fonts.push({
        style: i.style,
        weight: i.weight,
        metadata: openSync(i.path)
      })
    }
  }
  const { metadata } = pickFontFileForFallbackGeneration(fonts);
  return getFallbackMetricsFromFontFile(metadata, fontCollection.fallback);
}

export function createPreloads(fontCollection: Config): string[] {
  return fontCollection.src.filter(i => i.preload !== false && i.inline !== true).map(i => getRelativePath(fontCollection.basePath || './public', i.path))
}

export async function createBaseCSS(fontCollection: Config): Promise<string[]> {
  return fontCollection.src.map(async (i) => {
    const cssProperties = Object.entries(i.css || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(";");
    let fontWeightCSS = ""
    if (i.weight) {
      fontWeightCSS = ' font-weight: ' + i.weight + ';'
    }
    if (i.inline) {
      const res = (await getFontBuffer(i.path)).toString('base64')
      return `@font-face {${cssProperties} font-style: ${i.style};${fontWeightCSS} font-family: ${fontCollection.name}; font-display: ${fontCollection.display}; src: url(data:${getFontType(i.path)};base64,${res}) format('${getFontType(i.path)}');}`
    }
    return `@font-face {${cssProperties} font-style: ${i.style};${fontWeightCSS} font-family: ${fontCollection.name}; font-display: ${fontCollection.display}; src: url(${getRelativePath(fontCollection.basePath || './public', i.path)});}`;
  });
}

export async function createFontCSS(fontCollection: Config): Promise<string> {
  const fallbackName = '_font_fallback_' + new Date().getTime()
  const fallbackFont = await getFallbackFont(fontCollection)
  return `${fontCollection.selector}{font-family: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback};}@font-face{font-family: ${fallbackName}; size-adjust: ${fallbackFont.sizeAdjust}; src: local('${fallbackFont.fallbackFont}'); ascent-override: ${fallbackFont.ascentOverride}; descent-override: ${fallbackFont.descentOverride}; line-gap-override: ${fallbackFont.lineGapOverride};}`
}
