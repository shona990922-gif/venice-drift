# Publishing Venice Drift

This is a static desktop WebGL2 experience. Production serves only `dist/`.
Live site: https://venice-drift.pages.dev/.
Source: https://github.com/shona990922-gif/venice-drift.
It needs no server, API key, database, user account, or third-party runtime CDN.
The source repository includes the GLB chunks, textures, audio and required
third-party notices, so a fresh checkout can reproduce the build.

## Build and verify

```sh
npm ci
npm run lint
npm test -- --maxWorkers=1
npm run build
npm run preview
```

Use Node.js 22.13+ or 24+. A desktop browser with hardware-accelerated WebGL2
is required. Mobile adaptation remains paused. Normal URLs hide the debug HUD.
The environment lab is separately available at `/environment-lab/`.

## Cloudflare Pages

The project uses Pages Direct Upload, production branch `main`, project name
`venice-drift`. Authentication stays in the operator's local Wrangler profile.
No Cloudflare credential is stored in the repository or built site.

For an already authenticated account that owns the Pages project:

```sh
npm run deploy
```

This command builds, then publishes publicly. To set up another machine, first
run `npx wrangler@4.135.0 login`. Project creation is a one-time operation:
`npx wrangler@4.135.0 pages project create venice-drift --production-branch main --force`.
Here `--force` selects Pages instead of the CLI's new-project Workers delegation;
it is not needed to deploy updates to the existing Pages project.
Do not create a duplicate project when updating the existing site.

All current runtime assets are below Pages' 25 MiB per-file limit. Assets use
ETag revalidation because city and texture filenames are stable across releases.
The local screenshot-saving middleware is absent from production.

## GitHub and future updates

GitHub Actions installs the locked dependencies, lints, runs all tests, and
produces a production build on every push and pull request. It does **not**
publish automatically. After checks pass, use `npm run deploy` to publish an
update. No deployment secret or broad account token is placed in Actions.

Cloudflare retains deployment history for rollback; Git commits preserve source
checkpoints. Direct Upload and Pages Git integration are different project modes.
Do not assume pushing to GitHub automatically updates the live site.

The published source excludes dependencies, local QA captures, build output,
local hosting metadata and credentials. Curated screenshots and recordings in
`showcase/` remain part of the repository, separate from first-load web assets.
