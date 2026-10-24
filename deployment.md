# Deploying Wishlist

## Self-hosting

One command, no clone (Compose 2.34+):

```bash
docker compose -f oci://ghcr.io/armanckeser/wishlist-stack:latest up -d
```

Then open `http://<server>:8080` and sign up; the first account is yours. Migrations, the session key and
the Web Push keys are set up on first start (`backend/app/boot.py`), so nothing runs by hand.

Other ways in:

- **One container:** `docker run -d -p 8080:8080 -v wishlist-data:/data ghcr.io/armanckeser/wishlist:aio`
  (Postgres and Wishlist together; back up the `/data` volume).
- **App stores:** Cosmos, Umbrel, CasaOS/ZimaOS, Runtipi, Unraid and Portainer, through
  [selfhost-apps](https://github.com/armanckeser/selfhost-apps).
- **A checkout:** `docker compose -f docker-compose.selfhost.yml up -d`.

Settings, all optional, as environment variables next to the stack (a `.env` file in the directory you run
`docker compose` from):

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `8080` | The host port. |
| `DB_PASSWORD` | `wishlist` | Set before the first start; Postgres is never published. |
| `FRONTEND_HOST` | `http://localhost:8080` | The address you open Wishlist at; email links point there. |
| `FIRST_SUPERUSER`, `FIRST_SUPERUSER_PASSWORD` | | An admin account created on first start. |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAILS_FROM_EMAIL` | | Email for password resets. |
| `SEVENTEENTRACK_SECURITY_KEY` | | Package tracking through 17track. |
| `FLARESOLVERR_URL` | | A FlareSolverr-compatible browser for stores with a JavaScript challenge. |

Put it behind HTTPS for push notifications and for installing it to a phone's home screen.

## Releases

Publish a GitHub release vX.Y.Z → `.github/workflows/release.yml` builds the amd64 + arm64 image
(`ghcr.io/armanckeser/wishlist:X.Y.Z`, plus `:X.Y.Z-aio`) and publishes `docker-compose.selfhost.yml` as the
OCI artifact `wishlist-stack`. Store packages pick the new version up from the release.

## The Pi

The Pi runs that same artifact plus `deploy/override.yml`: the container names Cosmos routes to
(`wishlist-app`, `wishlist-db`), its labels, the network the FlareSolverr container is on, the existing
volume `wishlist-db-data`, and the keys it had before the app generated its own. `~/wishlist` on the Pi
holds only `override.yml` and `.env` (template: `deploy/.env.example`).

```bash
scp deploy/override.yml <pi>:wishlist/override.yml     # only when it changed
ssh <pi> "cd ~/wishlist && \
  docker compose -f oci://ghcr.io/armanckeser/wishlist-stack:X.Y.Z -f override.yml up -d -y"
```

`cd ~/wishlist` matters (Compose reads `.env` from the current directory), `-y` is required over ssh, and
dropping `-f override.yml` starts the stack on a new, empty volume. Roll back by naming an older artifact
tag. Cosmos routes the Wishlist hostname to `http://wishlist-app:8080`.

Back up before a release with migrations:

```bash
ssh <pi> "docker exec wishlist-db pg_dump -U wishlist -d wishlist | gzip > ~/wishlist-backups/wishlist-\$(date +%Y%m%d-%H%M%S).sql.gz"
```
