# PlayPoll Operations and Observability

This document describes how PlayPoll is currently operated, what signals are available, and how to troubleshoot the most common failures in a simple MVP setup.

## Current deployment model

- Application runtime: Next.js 14
- Primary deployment target: Vercel
- Data and realtime backend: Supabase
- Portable runtime for local validation: Docker
- Source control and CI: GitHub + GitHub Actions

This is intentionally a lightweight operating model. The current goal is not a complex platform, but a clear and maintainable delivery workflow for a small real-world application.

## Environments and inputs

### Local development

Required public environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Used for:

- `npm run dev`
- `npm run build`
- Docker image builds

### CI

GitHub Actions currently uses placeholder public values during build validation:

- `NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key`

This is enough for static validation of the build pipeline because the CI job is verifying packaging and compile health, not production connectivity to Supabase.

### Production and preview

Vercel should provide real values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Operational signals available today

### GitHub Actions

Current checks:

- `Lint, Typecheck and Build`
- `Docker Build`
- `CodeQL` (security scanning)

Use these to detect:

- TypeScript regressions
- ESLint failures
- build-time configuration problems
- Docker packaging issues
- code scanning findings

### Docker health signal

The container exposes a lightweight health endpoint:

- `GET /api/health`

Example response:

```json
{
  "status": "ok",
  "service": "playpoll",
  "timestamp": "2026-06-09T02:03:24.214Z"
}
```

The Docker image includes a `HEALTHCHECK` that probes:

- `http://127.0.0.1:3000/api/health`

This validates:

- the Next.js process is running
- the HTTP server is responding

This does not validate:

- Supabase availability
- database schema correctness
- realtime subscriptions
- game state integrity

### Vercel

Useful Vercel signals:

- preview deployment status per branch
- production deployment status
- runtime logs
- build logs

Use previews to validate branch-level changes before merge whenever possible.

## Troubleshooting guide

### If CI fails

Start here:

1. Open the failing GitHub Actions run.
2. Identify whether the failure is in `Lint, Typecheck and Build`, `Docker Build`, or `CodeQL`.
3. Reproduce locally with the matching command.

Common commands:

```bash
npm run lint
npm run build
npm run typecheck
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key \
  -t playpoll:ci .
```

Typical failure categories:

- syntax or type errors
- missing environment variables
- Dockerfile regressions
- dependency or lockfile drift

### If Docker build fails

Check:

- `package.json` and `package-lock.json` are in sync
- Docker build args are being passed
- `next build` still succeeds locally
- the standalone output is still generated

Validation steps:

```bash
npm run build
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-anon-key \
  -t playpoll:local .
```

### If the container starts but the app does not respond

Check:

- container logs
- `GET /api/health`
- Docker health status

Useful commands:

```bash
docker logs <container>
docker inspect --format='{{json .State.Health}}' <container>
```

If `/api/health` fails, the problem is likely at application startup or web process level.

If `/api/health` succeeds but the product flow still fails, the issue is likely above the process layer, for example environment configuration or Supabase access.

### If Vercel deploy fails

Check in this order:

1. build logs
2. environment variables
3. preview deployment behavior
4. runtime logs

Common Vercel failure categories:

- missing public environment variables
- build output regressions
- differences between local environment and Vercel environment

### If the app loads but game behavior is broken

Check:

- browser console
- Vercel runtime logs
- Supabase configuration and connectivity
- whether the issue affects only previews or also production

Because PlayPoll still keeps critical game flow logic on the client, some failures can appear as functional issues even when infrastructure signals are green.

## Current observability limits

Current setup is intentionally minimal. It does not yet include:

- centralized application monitoring
- tracing
- alerting
- uptime checks outside Docker health
- Sentry or equivalent error aggregation
- infrastructure as code

That is acceptable for the current MVP stage, but it should be stated clearly in portfolio and interview contexts.

## Recommended operator checklist

Before merge:

- CI green
- preview deployment healthy
- main user flow verified

Before calling production healthy:

- Vercel deployment succeeded
- app loads
- room creation still works
- `/api/health` responds

## How to describe this in portfolio terms

PlayPoll currently demonstrates:

- containerized delivery with Docker
- automated validation with GitHub Actions
- branch protection and controlled merge flow
- basic application health signaling
- incremental security tooling through Dependabot and CodeQL
- lightweight operational documentation for a small MVP
