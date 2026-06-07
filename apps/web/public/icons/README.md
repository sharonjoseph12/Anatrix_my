# PWA Icons

This directory holds the PWA icons referenced by `src/app/manifest.ts`.

The build will succeed without these files, but the manifest endpoints will
404 for `icon-192.png`, `icon-512.png`, and `maskable-512.png` until real
binary assets are dropped in.

## Required files

| File | Size | Notes |
|---|---|---|
| `icon-192.png` | 192x192 | Standard Android home-screen icon. |
| `icon-512.png` | 512x512 | Standard Android splash + home-screen icon. |
| `maskable-512.png` | 512x512 | Maskable icon; the centre 80% (412x412) is the safe zone, the outer 10% on each side may be cropped by the launcher mask. Brand artwork must stay inside the centre 80%. |

## Source

The design team will export a single master 1024x1024 PNG and run the
following to produce the three required sizes (or use a tool like
`realfavicon-generator`):

```bash
# using ImageMagick
convert master-1024.png -resize 192x192 icon-192.png
convert master-1024.png -resize 512x512 icon-512.png
# maskable: same art, but with padding so the safe zone is 412x412 inside
convert master-1024.png -resize 412x412 \
  -background "#0f172a" -gravity center -extent 512x512 \
  maskable-512.png
```

## Color reference

- Background (theme): `#0f172a` (slate-900, used for `theme_color`)
- Foreground: white wordmark "Antarix" over the slate background

## Re-verification

After dropping the icons in, restart `pnpm dev` and check the manifest at
`/manifest.webmanifest` (Next.js generates this from `src/app/manifest.ts`).
The icons array should include three entries pointing at the files above,
each with the correct `sizes` and `type` values.
