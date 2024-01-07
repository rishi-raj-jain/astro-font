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
              path: './public/fonts/Afacad-Regular.ttf'
            },
            {
              style: 'medium',
              weight: '500',
              path: './public/fonts/Afacad-Medium.ttf'
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
              path: './public/fonts/Inter-Regular.ttf'
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
