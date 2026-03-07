# CLAUDE.md

This file provides guidance for AI assistants working with the `recipes` repository.

## Project Overview

A recipe website built with SvelteKit, TypeScript, and Vite. Uses SQLite (via Turso/libSQL) for data storage and pnpm as the package manager. Deployed to Vercel.

## Repository Structure

```
recipes/
├── CLAUDE.md                           # AI assistant guidance (this file)
├── package.json                        # Dependencies and scripts
├── svelte.config.js                    # SvelteKit configuration
├── vite.config.ts                      # Vite configuration
├── tsconfig.json                       # TypeScript configuration
├── src/
│   ├── app.html                        # HTML shell
│   ├── app.d.ts                        # Global type declarations (App.Locals)
│   ├── hooks.server.ts                 # Server hooks (session middleware)
│   └── lib/
│       └── server/
│           └── db.ts                   # Database layer (SQLite, auth queries)
│   └── routes/
│       ├── +layout.server.ts           # Root layout data (user session)
│       ├── +layout.svelte              # Root layout (nav bar)
│       ├── +page.svelte                # Home/landing page
│       ├── login/                      # Login page and form action
│       ├── register/                   # Registration page and form action
│       ├── logout/                     # Logout form action
│       └── recipes/                    # Recipes list+detail (authenticated)
│           └── [id]/                   # Single recipe view/edit
└── static/                             # Static assets
```

## Tech Stack

- **Framework**: SvelteKit (Svelte 5) with TypeScript
- **Build tool**: Vite
- **Package manager**: pnpm
- **Database**: SQLite via Turso (@libsql/client); falls back to local `file:recipes.db` for dev
- **Deployment**: Vercel (@sveltejs/adapter-vercel)
- **Auth**: Custom session-based (scrypt password hashing, HTTP-only cookies)

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm check            # Type-check with svelte-check
```

## Development Workflow

### Getting Started

```bash
pnpm install
pnpm dev
```

### Branching

- Feature branches should be descriptive of the change being made.
- Push changes with `git push -u origin <branch-name>`.

### Commits

- Write clear, concise commit messages.
- Use imperative mood in commit subjects (e.g., "Add feature" not "Added feature").

## Architecture

### Authentication

- Passwords are hashed with `crypto.scryptSync` with a random salt.
- Sessions are stored in the `sessions` table with a 30-day expiry.
- The session cookie (`session_id`) is HTTP-only and SameSite=Lax.
- `hooks.server.ts` reads the session cookie on every request and populates `event.locals.user`.

### Database

- Uses `@libsql/client` (Turso) for SQLite over HTTP in production.
- Falls back to local `file:recipes.db` when `TURSO_DATABASE_URL` is not set (dev mode).
- Schema is auto-created on server start via `initDb()` in `hooks.server.ts` (tables: `users`, `sessions`, `recipes`).

### Environment Variables

- `TURSO_DATABASE_URL` — Turso database URL (e.g. `libsql://mydb-user.turso.io`). Omit for local dev.
- `TURSO_AUTH_TOKEN` — Turso auth token for production. Omit for local dev.

## Conventions

- Keep server-only code in `$lib/server/`.
- Use SvelteKit form actions for mutations (not API routes).
- Use Svelte 5 runes (`$props`, `$state`, etc.) in components.
- Keep the repository well-organized as it grows.
- Update this CLAUDE.md file when adding new tooling, dependencies, or conventions.
