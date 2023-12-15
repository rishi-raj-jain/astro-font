import fetch from 'node-fetch'
import { relative } from 'path'
import { openSync, create } from 'fontkit'
import { getFallbackMetricsFromFontFile } from './font'
import { pickFontFileForFallbackGeneration } from './fallback'

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
    preload?: boolean;
    weight: string | number;
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
  return fontCollection.src.filter(i => i.preload !== false).map(i => getRelativePath(fontCollection.basePath || './public', i.path))
}

export function createBaseCSS(fontCollection: Config): string[] {
  return fontCollection.src.map((i) => {
    const cssProperties = Object.entries(i.css || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join(";");
    return `@font-face {${cssProperties} font-style: ${i.style}; font-weight: ${i.weight}; font-family: ${fontCollection.name}; font-display: ${fontCollection.display}; src: url(${getRelativePath(fontCollection.basePath || './public', i.path)});}`;
  });
}

export async function createFontCSS(fontCollection: Config): Promise<string> {
  const fallbackName = '_font_fallback_' + new Date().getTime()
  const fallbackFont = await getFallbackFont(fontCollection)
  return `${fontCollection.selector}{font-family: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback};}@font-face{font-family: ${fallbackName}; size-adjust: ${fallbackFont.sizeAdjust}; src: local('${fallbackFont.fallbackFont}'); ascent-override: ${fallbackFont.ascentOverride}; descent-override: ${fallbackFont.descentOverride}; line-gap-override: ${fallbackFont.lineGapOverride};}`
}
