import fetch from 'node-fetch'
import { relative } from 'path'
import { openSync, create } from 'fontkit'
import { getFallbackMetricsFromFontFile } from './font'
import { pickFontFileForFallbackGeneration } from './fallback'

async function getFallbackFont(fontCollection) {
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

export function createBaseCSS(fontCollection): string {
  return fontCollection.src.map(i => `@font-face{font-style: ${i.style}; font-weight: ${i.weight}; font-display: ${fontCollection.display}; font-family: ${fontCollection.name}; src: url(/${relative(fontCollection.basePath, i.path)});}`)
}

export async function createFontCSS(fontCollection): Promise<string> {
  const fallbackName = '_font_fallback_' + new Date().getTime()
  const fallbackFont = await getFallbackFont(fontCollection)
  return `${fontCollection.selector}{font-family: ${fontCollection.name}, ${fallbackName}, ${fontCollection.fallback};}@font-face{font-family: ${fallbackName}; size-adjust: ${fallbackFont.sizeAdjust}; src: local('${fallbackFont.fallbackFont}'); ascent-override: ${fallbackFont.ascentOverride}; descent-override: ${fallbackFont.descentOverride}; line-gap-override: ${fallbackFont.lineGapOverride};}`
}
