import fetch from 'node-fetch'
import { relative } from 'path'
import { openSync, create } from 'fontkit'
import { getFallbackMetricsFromFontFile } from './font'
import { pickFontFileForFallbackGeneration } from './fallback'

async function getFallbackFont(url) {
  const urls: any[] = []
  for (let i of url.src) {
    if (i.path.includes('https://')) {
      const tmp = await fetch(i.path)
      const resp = Buffer.from(await tmp.arrayBuffer())
      urls.push({
        style: i.style,
        weight: i.weight,
        metadata: create(resp)
      })
    }
    else {
      urls.push({
        style: i.style,
        weight: i.weight,
        metadata: openSync(i.path)
      })
    }
  }
  const { metadata } = pickFontFileForFallbackGeneration(urls);
  return getFallbackMetricsFromFontFile(metadata, url.fallback);
}

export function createBaseCSS(url): string {
  return url.src.map(i => `@font-face{font-style: ${i.style}; font-weight: ${i.weight}; font-display: ${url.display}; font-family: ${url.name}; src: url(/${relative(url.basePath, i.path)});}`)
}

export async function createFontCSS(url): Promise<string> {
  const fallbackName = '_font_fallback_' + new Date().getTime()
  const fallbackFont = await getFallbackFont(url)
  return `${url.selector}{font-family: ${url.name}, ${fallbackName}, ${url.fallback};}@font-face{font-family: ${fallbackName}; size-adjust: ${fallbackFont.sizeAdjust}; src: local('${fallbackFont.fallbackFont}'); ascent-override: ${fallbackFont.ascentOverride}; descent-override: ${fallbackFont.descentOverride}; line-gap-override: ${fallbackFont.lineGapOverride};}`
}
