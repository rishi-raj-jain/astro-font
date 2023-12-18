import type { Options } from 'tsup';

export const tsup: Options = {
    dts: true,
    clean: true,
    minify: true,
    bundle: true,
    splitting: true,
    platform: 'browser',
    format: ['cjs', 'esm'],
    entryPoints: ['./utils.ts'],
    noExternal: ['fontkit', 'node-fetch'],
    external: ['node:fs', 'node:path', 'node:buffer']
};