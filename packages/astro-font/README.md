![imgonline-com-ua-compressed-gtwH4Klu9j](https://github.com/rishi-raj-jain/astro-font/assets/46300090/6a9588d0-50b9-4ade-91ee-76c7a201e1a6)


# Astro Font Optimization

`astro-font` will automatically optimize your Custom Fonts, Local Fonts, Fonts over any CDN and Google fonts for performance.

The project is inspired by the [Next.js Font Optimization](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts).


## Installation

```bash
npm install astro-font
## or yarn
yarn add astro-font
## or pnpm
pnpm add astro-font
```

## Google Fonts

Automatically optimize any Google Font. To use the font in all your pages, add it to `<head>` file in an Astro layout:

### Use Google Fonts URL directly



```astro
---
import { AstroFont } from "astro-font";
---

<head>
    <AstroFont
      config={[
        {
          src: [],
          name: "Poppins",
          // Google Fonts URL
          googleFontsURL: 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,600;1,400;1,700&display=swap',
          preload: true,
          display: "swap",
          selector: "body",
          fallback: "sans-serif",
        },
      ]}
    />
</head>
```

### Pick fonts from Google Fonts URL

```astro
---
import { AstroFont } from "astro-font";
---

<head>
    <AstroFont
      config={[
        {
          name: "Afacad",
          src: [
            {
              style: 'bold',
              weight: '700',
              // Picked up font URL by manually visiting Google Fonts URL
              path: 'https://fonts.gstatic.com/s/afacad/v1/6NUK8FKMIQOGaw6wjYT7ZHG_zsBBfvLqagk-80KjZfJ_uw.woff2'
            },
          ],
          preload: true,
          display: "swap",
          selector: "body",
          fallback: "sans-serif",
        },
      ]}
    />
</head>
```

## Local Fonts

```astro
---
import { join } from "node:path";
import { AstroFont } from "astro-font";
---

<head>
    <AstroFont
      config={[
        {
          name: "Afacad",
          src: [
            {
              style: 'normal',
              weight: '400',
              path: join(process.cwd(), 'public', 'fonts', 'Afacad-Regular.ttf')
            },
            {
              style: 'medium',
              weight: '500',
              path: join(process.cwd(), 'public', 'fonts', 'Afacad-Medium.ttf')
            },
          ],
          preload: false,
          display: "swap",
          selector: "body",
          fallback: "sans-serif",
        },
      ]}
    />
</head>
```

## Using Multiple Fonts

You can import and use multiple fonts in your application. There are two approaches you can take.

Just extend the array of the config to contain the new collection of the fonts:

```astro
---
import { join } from "node:path";
import { AstroFont } from "astro-font";
---

<head>
    <AstroFont
      config={[
        {
          name: "Afacad",
          src: [
            {
              style: 'bold',
              weight: '700',
              path: 'https://fonts.gstatic.com/s/afacad/v1/6NUK8FKMIQOGaw6wjYT7ZHG_zsBBfvLqagk-80KjZfJ_uw.woff2'
            },
          ],
          preload: true,
          display: "swap",
          selector: "body",
          fallback: "sans-serif",
        },
        {
          name: "Inter",
          src: [
            {
              weight: '400',
              style: 'normal',
              path: join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf')
            }
          ],
          preload: true,
          display: "swap",
          selector: "body > span",
          fallback: "serif",
        },
      ]}
    />
</head>
```

## Configuring CSS Classes

The `selector` attribute per config object can be used to configure which CSS class will reflect the whole CSS (automatically including the references to fallback fonts CSS).

```astro
---
import { join } from "node:path"
---

<AstroFont
  config={[
    {
      name: "Afacad",
      src: [
        {
          style: 'bold',
          weight: '700',
          path: 'https://fonts.gstatic.com/s/afacad/v1/6NUK8FKMIQOGaw6wjYT7ZHG_zsBBfvLqagk-80KjZfJ_uw.woff2'
        },
      ],
      preload: true,
      display: "swap",
      fallback: "sans-serif",

      // My Custom CSS Selector
      // Type: ClassName
      selector: ".custom_class",

    },
    {
      name: "Inter",
      src: [
        {
          weight: '400',
          style: 'normal',
          path: join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf')
        }
      ],
      preload: true,
      display: "swap",
      fallback: "serif",

      // My Custom CSS Selector
      // Type: CSS Selector
      selector: "body > span",
    },
  ]}
/>
```

## Configuring CSS Variables

The `cssVariable` attribute per config object can be used to configure which CSS variable will reflect in your document's `:root` CSS selector (automatically including the references to fallback fonts CSS).

```astro
---
import { join } from "node:path"
---

<AstroFont
  config={[
    {
      name: "Afacad",
      src: [
        {
          style: 'bold',
          weight: '700',
          path: 'https://fonts.gstatic.com/s/afacad/v1/6NUK8FKMIQOGaw6wjYT7ZHG_zsBBfvLqagk-80KjZfJ_uw.woff2'
        },
      ],
      preload: true,
      display: "swap",
      fallback: "sans-serif",

      // My Custom CSS Selector
      // Type: ClassName
      selector: ".custom_class",

    },
    {
      name: "Inter",
      src: [
        {
          weight: '400',
          style: 'normal',
          path: join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf')
        }
      ],
      preload: true,
      display: "swap",
      fallback: "serif",

      // My Custom CSS Variable
      // Type: CSS Variable
      cssVariable: "astro-font",

      // and now use it as style="font-family: var(--astro-font)"
    },
  ]}
/>
```

## Configuring Fallback Font Name

The `fallbackName` attribute per config object can be used to configure the fallback font's family name (in CSS).

```astro
---
import { join } from "node:path"
---

<AstroFont
  config={[
    {
      name: "Afacad",
      src: [
        {
          style: 'bold',
          weight: '700',
          path: 'https://fonts.gstatic.com/s/afacad/v1/6NUK8FKMIQOGaw6wjYT7ZHG_zsBBfvLqagk-80KjZfJ_uw.woff2'
        },
      ],
      preload: true,
      display: "swap",
      fallback: "sans-serif",
      selector: ".custom_class",

      // My Custom Fallback Font Name
      fallbackName: "Afacad Override",

    },
    {
      name: "Inter",
      src: [
        {
          weight: '400',
          style: 'normal',
          path: join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf')
        }
      ],
      preload: true,
      display: "swap",
      fallback: "serif",
      cssVariable: "astro-font",

      // My Custom Fallback Font Name
      fallbackName: "Inter Custom Override",
      
    },
  ]}
/>
```

### With Cloudflare Workers

`astro-font` uses the following node imports:

- `node:path`
- `node:buffer`

#### Step 1. Enable nodejs_compat

To make sure that it works in Cloudflare Workers, please enable the `node_compatibiliy` flag per the guide https://developers.cloudflare.com/workers/runtime-apis/nodejs/#enable-nodejs-with-workers.

If the above guide fails to work, go to your **Cloudflare project > Settings > Functions > Compatibility flags** and add the flag (as follows).

<img width="1214" alt="Screenshot 2024-03-21 at 7 39 51 AM" src="https://github.com/rishi-raj-jain/astro-font/assets/46300090/3572601b-ec47-4c8e-a9fd-f7cc51b60ff0">

#### Step 2. Opt out of bundling Node.js built-ins

Per [Astro + Cloudflare docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#nodejs-compatibility), you'd need to modify the vite configuration to allow for the node:* import syntax:

```diff
// File: astro.config.mjs

import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
    output: 'server',
    adapter: cloudflare(),
+    vite: {
+        ssr: {
+          external: ["buffer", "path", "fs", "os", "crypto", "async_hooks"].map((i) => `node:${i}`),
+        },
+        // make sure to use node:fs, node:path, or node:os if you are using it in your project instead of fs, path or os
+    },
});
```

### Step 3. Use local fonts over CDN in case of Astro Server-Side Rendering with Cloudflare

As there's no access to the files in the `public` directory in the Cloudflare Pages (server-side render) context, you'd want to use fonts over CDN. To make the developer experience painless, use the following code snippet while setting up local fonts with Cloudflare in Astro:

```astro
---
import { join } from "node:path";
import { AstroFont } from "astro-font";

const fontPrefix = import.meta.env.PROD
  ? Astro.site.toString()
  : join(process.cwd(), "public");
---

<AstroFont
    config={[
        {
            name: "Editorial New",
            src: [
                {
                    style: "italic",
                    weight: "500",
                    path: join(
                        fontPrefix,
                        "fonts",
                        "PPEditorialNew-MediumItalic.woff2"
                    ),
                },
            ],
            preload: true,
            display: "swap",
            selector: "body",
            fallback: "sans-serif",
        }
    ]}
/>
```

## Contributing

We love our contributors! Here's how you can contribute:

- [Open an issue](https://github.com/rishi-raj-jain/astro-font/issues) if you believe you've encountered a bug.
- Make a [pull request](https://github.com/rishi-raj-jain/astro-font/pull) to add new features/make quality-of-life improvements/fix bugs.

<a href="https://github.com/rishi-raj-jain/astro-font/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=rishi-raj-jain/astro-font" />
</a>

## Repo Activity

![`astro-font` repo activity – generated by Axiom](https://repobeats.axiom.co/api/embed/4730ca667c1a22348ac5d723d01f27ef3c7dce9a.svg "Repobeats analytics image")
