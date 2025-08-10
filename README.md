# Marathon Trainer

Production-ready Next.js app for marathon training, designed for Vercel deployment.

## Tech
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v3 (postcss + autoprefixer)
- Zustand state
- Recharts, Lucide, Framer Motion

## Scripts
- `npm run dev` — Dev server
- `npm run build` — Production build
- `npm start` — Start production server

## Deploy on Vercel
- Import the repo in Vercel, framework auto-detected (Next.js)
- Build command: `npm run build`
- Output: `.next`
- Env not required

## Phases
- Phase 1-2: App shell, user selector, theme toggle, race setup, countdown — Done
- Phase 3: Plan generator with phases (base/build/peak/taper) — Done
- Phase 4: TCX/GPX upload, parsing, metrics, charts, persistence — Done
- Phase 5: Coaching focus, achievements, prediction with CI — Done
- Phase 6: Polish, a11y/UX improvements — In progress
