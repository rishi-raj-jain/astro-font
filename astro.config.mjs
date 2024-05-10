import vercel from '@astrojs/cloudflare'
import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  vite: {
    ssr: {
      external: ['node:buffer', 'node:path', 'node:fs', 'node:os', 'node:crypto'],
    },
  },
})
