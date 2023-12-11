import { relative } from 'path'
import { openSync } from 'fontkit'
import { getFallbackMetricsFromFontFile } from './font'
import { pickFontFileForFallbackGeneration } from './fallback'

function getFallbackFont(url) {
  const { metadata } = pickFontFileForFallbackGeneration(
    url.src.map((i) => ({
      style: i.style,
      weight: i.weight,
      metadata: openSync(i.path)
    }))
  );
  return getFallbackMetricsFromFontFile(
    metadata,
    url.fallback
  );
}

export function createBaseCSS(url): string {
  return url.src.map(i => `@font-face{font-style: ${i.style}; font-weight: ${i.weight}; font-display: ${url.display}; font-family: ${url.name}; src: url(/${relative(url.basePath, i.path)});}`)
}

export function createFontCSS(url): string {
  const fallbackName = '_font_fallback_' + new Date().getTime()
  const fallbackFont = getFallbackFont(url)
  return `${url.selector}{font-family: ${url.name}, ${fallbackName}, ${url.fallback};}@font-face{font-family: ${fallbackName}; size-adjust: ${fallbackFont.sizeAdjust}; src: local('${fallbackFont.fallbackFont}'); ascent-override: ${fallbackFont.ascentOverride}; descent-override: ${fallbackFont.descentOverride}; line-gap-override: ${fallbackFont.lineGapOverride};}`
}
