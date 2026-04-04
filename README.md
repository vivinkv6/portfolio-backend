# Portfolio Backend

## Local development

```bash
npm run develop
```

Production start:

```bash
npm run build
npm run start
```

## GHCR deployment flow

This repo publishes a Docker image to GitHub Container Registry from [`.github/workflows/docker-ghcr.yml`](./.github/workflows/docker-ghcr.yml).

On every push to `master`, GitHub Actions will:

1. build the production image from [`Dockerfile`](./Dockerfile)
2. push it to `ghcr.io/vivinkv6/portfolio-backend`
3. update the `latest` tag for the default branch
4. optionally trigger Coolify to pull and restart if `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN` are configured as GitHub Actions secrets

Useful image tags:

- `ghcr.io/vivinkv6/portfolio-backend:latest`
- `ghcr.io/vivinkv6/portfolio-backend:master`
- `ghcr.io/vivinkv6/portfolio-backend:sha-<commit>`

## Coolify setup

You can deploy this in Coolify with either:

1. a `Docker Image` resource pointing at `ghcr.io/vivinkv6/portfolio-backend:latest`
2. a Docker Compose resource using [`docker-compose.ghcr.yml`](./docker-compose.ghcr.yml)

If the package is private, create a GitHub personal access token with `read:packages` and use it in Coolify's registry credentials for `ghcr.io`.

For automatic redeploys after each successful image push, add these GitHub Actions secrets in this repository:

- `COOLIFY_WEBHOOK`
- `COOLIFY_TOKEN`

Required runtime variables still come from Coolify or your host environment:

- `URL`
- `APP_KEYS`
- `API_TOKEN_SALT`
- `ADMIN_JWT_SECRET`
- `TRANSFER_TOKEN_SALT`
- `ENCRYPTION_KEY`
- `JWT_SECRET`
- `DATABASE_CLIENT`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`
- `DATABASE_SSL`
- `DATABASE_FILENAME`
- `CLOUDINARY_NAME`
- `CLOUDINARY_KEY`
- `CLOUDINARY_SECRET`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`

Uploads remain persisted via the named volume mounted at `/opt/app/public/uploads`.
