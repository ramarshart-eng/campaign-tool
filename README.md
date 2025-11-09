## Campaign Tool

This is a Next.js app for building and playing tabletop RPG characters with a simple, fast UI. It includes a character builder, a character sheet + play area, a notes book with a two‑page layout, and lightweight dice/roll logging utilities.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser.

## Share via GitHub (auto-setup)

This repo includes a PowerShell helper script to create a GitHub repository, add it as a remote, and push your code.

Requirements:
- A GitHub Personal Access Token with `repo` scope (or a fine‑grained token with Contents: Read/Write for this repo)
- Your GitHub username

Usage (PowerShell):

```powershell
# From the project root
powershell -ExecutionPolicy Bypass -File scripts/setup-github.ps1 -GithubUser "YOUR_USER" -Token "YOUR_PAT" -RepoName "campaign-tool"
```

Options:
- `-UseSSH` to push via SSH (requires SSH keys set up)
- `-Public` to create a public repository (default is private)

Manual alternative:

```powershell
git remote add origin https://github.com/YOUR_USER/campaign-tool.git
git push -u origin main
```

## Features
- Character builder with step flow (race, class, ability scores, background, equipment)
- Character sheet and play area with tabbed hotbar
- Notes book with two‑page “paper” layout and lined textarea
- Roll buttons and roll log, simple dice rules utilities
- Tailwind CSS v4 + custom CSS tokens for surfaces/colors

## Tech Stack
- Next.js 16 (Pages Router)
- React 19
- TypeScript
- Tailwind CSS 4
- ESLint (Next config)

## Scripts
- `npm run dev` – start dev server
- `npm run build` – build production bundle
- `npm run start` – start production server
- `npm run lint` – run ESLint

## Project Structure

```
src/
  lib/
    api/          # data fetching (e.g., SRD)
    components/   # UI components (CharacterBuilder, CharacterSheet, etc.)
    context/      # React contexts (CharacterContext)
    data/         # static data (backgrounds, weapons)
    hooks/        # custom hooks (useSRD)
    rules/        # game rules helpers (rollDice, computeModifiers)
    types/        # TypeScript types (Character, Item, SRD)
    utils/        # pure helpers (deriveActions, itemHelpers)
  pages/          # Next pages and prototypes
  styles/         # global styles (Tailwind + custom CSS)
```

## Styling Conventions
- Theme tokens in `src/styles/globals.css` under `:root` (surface/background/fg)
- Prefer Tailwind utilities; add small, reusable component classes only when needed
- Keep interactive states accessible (hover/focus) and high‑contrast

## Development Notes
- State: `CharacterContext` centralizes character state for builder and sheet
- Data: SRD types live in `src/lib/types`, helpers in `src/lib/utils` and `src/lib/api`
- Dice: `src/lib/rules/rollDice.ts`; modifiers in `src/lib/rules/computeModifiers.ts`

## Contributing
See `CONTRIBUTING.md` for branch strategy, commit style, and PR checklist.

## Architecture
See `docs/ARCHITECTURE.md` for component boundaries, data flow, and conventions.

## Scope & Roadmap
See `docs/SCOPE.md` for goals, non‑goals, phases, and acceptance criteria.

## Deploy

Vercel is recommended. Framework preset: Next.js. No special env vars required.
