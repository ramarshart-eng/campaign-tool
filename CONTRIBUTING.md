## Contributing

Thanks for helping improve Campaign Tool! This guide keeps PRs smooth and consistent.

### Prerequisites
- Node 18+ and npm (or yarn/pnpm/bun)
- Install deps: `npm install`
- Start dev: `npm run dev`

### Branching
- Create feature branches off `main`: `feature/<short-topic>`
- Use `fix/`, `docs/`, `chore/` prefixes as appropriate

### Commit Style
- Follow Conventional Commits:
  - `feat: add equipment step`
  - `fix: correct STR modifier`
  - `docs: add architecture overview`
  - `chore: bump deps`

### Linting
- Run `npm run lint` and fix issues before pushing

### PR Checklist
- Scope is focused and described clearly
- Includes tests if logic is non‑trivial (unit test stubs welcome)
- Screenshots for notable UI changes
- No unrelated formatting churn

### Code Style & Patterns
- Prefer small, focused components in `src/lib/components`
- Keep shared state in `src/lib/context` (see `CharacterContext`)
- Put pure helpers in `src/lib/utils` and rules in `src/lib/rules`
- Use Tailwind utilities; only add global CSS for reusable patterns

### Review Tips
- Keep comments specific and actionable
- Suggest diffs when possible

