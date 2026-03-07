# CLAUDE.md

This file provides guidance for AI assistants working with the `recipes` repository.

## Project Overview

A recipe website built with SvelteKit, TypeScript, and Vite. Uses SQLite (via better-sqlite3) for data storage and pnpm as the package manager.

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
│       ├── +page.svelte                # Home page
│       ├── login/                      # Login page and form action
│       ├── register/                   # Registration page and form action
│       └── logout/                     # Logout form action
└── static/                             # Static assets
```

## Tech Stack

- **Framework**: SvelteKit (Svelte 5) with TypeScript
- **Build tool**: Vite
- **Package manager**: pnpm
- **Database**: SQLite via better-sqlite3
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

- SQLite database file: `recipes.db` (gitignored).
- Schema is auto-created on first access (tables: `users`, `sessions`).
- WAL mode and foreign keys are enabled.

## Conventions

- Keep server-only code in `$lib/server/`.
- Use SvelteKit form actions for mutations (not API routes).
- Use Svelte 5 runes (`$props`, `$state`, etc.) in components.
- Keep the repository well-organized as it grows.
- Update this CLAUDE.md file when adding new tooling, dependencies, or conventions.
