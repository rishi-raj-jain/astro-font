import type { Options } from 'tsup'

export const tsup: Options = {
  dts: true,
  clean: true,
  minify: true,
  bundle: true,
  splitting: true,
  format: ['esm'],
  platform: 'browser',
  noExternal: ['fontkit'],
  entryPoints: ['./utils.ts'],
  external: ['node:fs', 'node:path', 'node:buffer', 'node:os'],
}
