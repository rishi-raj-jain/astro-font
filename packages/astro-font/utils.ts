import fetch from 'node-fetch'
import { relative } from 'path'
import { openSync, create } from 'fontkit'
import { getFallbackMetricsFromFontFile } from './font'
import { pickFontFileForFallbackGeneration } from './fallback'

interface Config {
  name: string;
  display: string;
  selector: string;
  basePath: string;
  preload?: boolean;
  fallback: "sans" | "sans-serif";
  src: {
    path: string;
    style: string;
    preload?: boolean;
    weight: string | number;
  }[];
}

export interface Props {
  config: Config[];
}

export function getRelativePath(from: string, to: string) {
  if (to.includes('https')) return to
  return '/' + relative(from, to)
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
  return fontCollection.src.filter(i => i.preload !== false).map(i => getRelativePath(fontCollection.basePath, i.path))
}

export function createBaseCSS(fontCollection: Config): string[] {
  return fontCollection.src.map(i => `@font-face{font-style: ${i.style}; font-weight: ${i.weight}; font-display: ${fontCollection.display}; font-family: ${fontCollection.name}; src: url(${getRelativePath(fontCollection.basePath, i.path)});}`)
}

export async function createFontCSS(fontCollection: Config): Promise<string> {
  const fallbackName = '_font_fallback_' + new Date().getTime()
  const fallbackFont = await getFallbackFont(fontCollection)
  return `${fontCollection.selector}{font-family: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback};}@font-face{font-family: ${fallbackName}; size-adjust: ${fallbackFont.sizeAdjust}; src: local('${fallbackFont.fallbackFont}'); ascent-override: ${fallbackFont.ascentOverride}; descent-override: ${fallbackFont.descentOverride}; line-gap-override: ${fallbackFont.lineGapOverride};}`
}
