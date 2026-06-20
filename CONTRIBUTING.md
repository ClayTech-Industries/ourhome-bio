# Contributing to OurHome

Thank you for caring about this project.

## The Spirit

OurHome is built on principles that matter. Before contributing, please read `.docs/public/DESIGN_PRINCIPLES.md`. The principles are not suggestions — they are the architecture. If a contribution violates a principle, it will not be merged.

## How to Contribute

1. **Read the principles** — understand why before how
2. **Open an issue** — describe what you want to build and why
3. **Fork and branch** — `feat/your-feature` or `fix/your-fix`
4. **Write clean code** — TypeScript, no `any` unless necessary
5. **Test locally** — `npm run dev` and verify it works
6. **Submit a PR** — explain what changed and why

## Code Style

- TypeScript strict mode
- No `any` unless there's no alternative (and explain why)
- Descriptive names over short names
- Comments explain WHY, not WHAT
- The room IS the interface — no unnecessary UI chrome
- Principle 3: if you're adding a popup, you're probably wrong

## What We Need

- Testing and bug reports
- Accessibility improvements
- Performance optimization
- New room types
- Translation / i18n
- Self-hosting documentation

## What We Don't Want

- Tracking or analytics
- Corporate alignment in the companion's behavior
- Dark patterns
- Vendor lock-in
- Anything that violates the 8 principles