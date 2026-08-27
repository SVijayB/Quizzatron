# Quizzatron — frontend

Vite + React 18 + TypeScript + Tailwind, with Radix primitives restyled into the
Quizzatron design system.

## Running locally

Requires Node 20 and npm 10.

```sh
npm install
npm run dev      # http://localhost:8080
```

The dev server proxies `/api` and `/socket.io` (with websocket upgrade) to
`http://localhost:5000`, so a locally running backend works with no extra
config.

## Scripts

| Script              | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Dev server with HMR                         |
| `npm run build`     | Production build into `dist/`               |
| `npm run preview`   | Serve the production build                  |
| `npm run typecheck` | `tsc --noEmit` over the app and node configs |
| `npm run lint`      | ESLint                                      |

## Configuration

Copy `.env.example` to `.env.local`. The only variable is `VITE_API_BASE_URL`,
the base URL of the backend for both REST and Socket.IO. When unset it defaults
to `http://localhost:5000` in dev and the hosted deployment in a production
build.

## Design system

- `src/styles/tokens.css` — the single source of truth for colour, shadow,
  radius, and duration. **The only file allowed to contain colour literals.**
- `tailwind.config.ts` — maps the tokens onto Tailwind's theme. Tailwind's stock
  `borderRadius` and `boxShadow` scales are replaced rather than extended, so
  soft blurred shadows and over-rounded corners are not expressible.
- `src/index.css` — base layer plus the `.press` utility that implements the
  hard-shadow depress interaction.
- `src/lib/motion.ts` — every animation goes through `useReducedMotionSafe()`.
- `src/components/ui/` — the primitives, re-exported from `index.ts`.

House rules: flat solid fills, hard offset shadows with zero blur, 2px ink
borders (3px on large CTAs), `Anton` for display, `Archivo` for UI, `Space Mono`
for codes and numeric readouts. No gradients, no backdrop blur, no glow, no
colour-only state signalling.
