# Self-hosted fonts

The system currently loads fonts from Google Fonts (`tokens/fonts.css`). To self-host (offline,
no third-party requests), add the `.woff2` files below to **this folder**, then point the root
`styles.css` at `assets/fonts/fonts-local.css` instead of `tokens/fonts.css`.

All three families are open-source, so self-hosting is licensed and free.

## Files to add (exact names expected by `fonts-local.css`)

| File | Family · weight |
|------|-----------------|
| `hanken-grotesk-400.woff2` | Hanken Grotesk 400 |
| `hanken-grotesk-500.woff2` | Hanken Grotesk 500 |
| `hanken-grotesk-600.woff2` | Hanken Grotesk 600 |
| `hanken-grotesk-700.woff2` | Hanken Grotesk 700 |
| `newsreader-400.woff2` | Newsreader 400 |
| `newsreader-500.woff2` | Newsreader 500 |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono 400 |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono 500 |

## Easiest way to get them

Use **google-webfonts-helper** (gwfh.mranftl.com): pick each family, choose `woff2`, the
`latin` charset and the weights above, download, and rename to match the table. Or pull from the
upstream repos (SIL OFL): Hanken Grotesk, Newsreader (Google Fonts), IBM Plex Mono (IBM/Plex).

> I couldn't fetch the binaries in this environment, so the files aren't included — this folder
> is the scaffold. Once the `.woff2` files are here and `styles.css` imports `fonts-local.css`,
> the system is fully offline.
