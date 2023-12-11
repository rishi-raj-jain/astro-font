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

const getFontForSrc = (fontname: string, weight: string, style: string) => {
  return {
    style,
    weight,
    path: join(process.cwd(), "public", "fonts", fontname),
  };
};
---

<head>
    <AstroFont
      config={[
        {
          name: "Afacad",
          basePath: join(process.cwd(), "public"),
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
const getFontForSrc = (fontname: string, weight: string, style: string) => {
  return {
    style,
    weight,
    path: join(process.cwd(), "public", "fonts", fontname),
  };
};
---

<head>
    <AstroFont
      config={[
        {
          name: "Afacad",
          basePath: join(process.cwd(), "public"),
          src: [
            getFontForSrc("Afacad-Medium.ttf", "500", "medium"),
            getFontForSrc("Afacad-Regular.ttf", "400", "normal"),
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

## Using Multiple Fonts

You can import and use multiple fonts in your application. There are two approaches you can take.

Just extend the array of the config to contain the new collection of the fonts:

```astro
---
const getFontForSrc = (fontname: string, weight: string, style: string) => {
  return {
    style,
    weight,
    path: join(process.cwd(), "public", "fonts", fontname),
  };
};
---

<head>
    <AstroFont
      config={[
        {
          name: "Afacad",
          basePath: join(process.cwd(), "public"),
          src: [
            {
              style: 'bold',
              weight: '700',
              path: 'https://fonts.gstatic.com/s/afacad/v1/6NUK8FKMIQOGaw6wjYT7ZHG_zsBBfvLqagk-80KjZfJ_uw.woff2'
            },
            getFontForSrc("Afacad-Medium.ttf", "500", "medium"),
            getFontForSrc("Afacad-Regular.ttf", "400", "normal"),
          ],
          preload: true,
          display: "swap",
          selector: "body",
          fallback: "sans-serif",
        },
        {
          name: "Inter",
          basePath: join(process.cwd(), "public"),
          src: [
            {
              style: 'bold',
              weight: '700',
              path: 'https://fonts.gstatic.com/s/afacad/v1/6NUK8FKMIQOGaw6wjYT7ZHG_zsBBfvLqagk-80KjZfJ_uw.woff2'
            },
            getFontForSrc("Inter-Medium.ttf", "500", "medium"),
            getFontForSrc("Inter-Regular.ttf", "400", "normal"),
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

