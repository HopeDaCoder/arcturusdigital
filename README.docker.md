# Docker: NestJS + Drizzle + Supabase PostgreSQL (Bun)

This setup runs only the NestJS application in Docker. It intentionally does
**not** create a database container or a database volume: the application uses
an existing Supabase PostgreSQL database through `DATABASE_URL`.

## Before you begin

These files make conventional Bun/NestJS assumptions. Confirm or adjust them
for the repository before the first build:

| Assumption                                     | Where it is used                     | What to change if different                                                                 |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| The lockfile is `bun.lock`                     | `Dockerfile`                         | If the project has legacy `bun.lockb`, replace every `bun.lock` reference with `bun.lockb`. |
| `bun run start:dev` starts Nest watch mode     | development image and `compose.yaml` | Use the repository's development script.                                                    |
| `bun run build` emits `dist/main.js`           | build and production image           | Update the build script and final `CMD` for the actual output path.                         |
| `drizzle-kit migrate` is the migration command | `migrate` Compose service            | Replace it with the project script, for example `bun run db:migrate`.                       |
| The app reads `DATABASE_URL`                   | `.env.example`                       | Map the variable in the app configuration if it uses another name.                          |

The example uses `oven/bun:1`, which follows Bun 1.x. Pin it to an exact version
and ideally an image digest after confirming the Bun version used by the project.

## Development

1. Create local settings:

   ```sh
   cp .env.example .env
   ```

2. Put the real Supabase connection string in `.env`. Do not use a service-role
   key or commit this file.

3. Start the application with hot reload:

   ```sh
   docker compose up --build
   ```

   Visit `http://localhost:3000` (or the `HOST_PORT` value). The source directory
   is mounted into the container. The separate anonymous `node_modules` volume
   ensures host dependencies do not overwrite the Linux dependencies installed
   in the image.

4. Run pending Drizzle migrations only when you intend to alter the shared
   Supabase database:

   ```sh
   docker compose --profile migrations run --rm migrate
   ```

   Review migrations and use a direct Supabase database connection before doing
   this in production. The migration service is opt-in so an ordinary app restart
   cannot unexpectedly modify the database.

## Production

Build and start the minimal runtime image:

```sh
docker compose -f compose.production.yaml up --build -d
```

The production image contains production dependencies and `dist/`, with no
source bind mount. Stop it with:

```sh
docker compose -f compose.production.yaml down
```

For a registry workflow, set `IMAGE_NAME`, build/push using your deployment
system, then run the image with the same `DATABASE_URL` supplied as a secret.
Avoid baking `.env` into an image; `.dockerignore` excludes it on purpose.

## Supabase and SSL notes

- Supabase commonly requires TLS, so the example URL uses `sslmode=require`.
  Confirm the exact connection URI in the Supabase dashboard and the behaviour
  of the PostgreSQL driver used by Drizzle in this project.
- Some Node/Postgres configurations require an explicit SSL option such as
  `ssl: { rejectUnauthorized: false }`; others honor `sslmode=require` in the
  URL. Do not add that setting blindly—use the documented option for the
  project's driver and your certificate policy.
- Use the direct database endpoint for migrations when possible. Pooler
  endpoints are useful for application traffic but can have mode-specific
  restrictions for sessions, prepared statements, or DDL.
- URL-encode special characters in database passwords.

## Troubleshooting

**`failed to compute cache key` or `bun.lock: not found`**  
The Dockerfile expects `package.json` and `bun.lock` at the build-context root.
Generate a lockfile with Bun, or change `bun.lock` to `bun.lockb` if this project
uses the legacy binary lockfile.

**The app starts but does not reload after edits**  
`CHOKIDAR_USEPOLLING=true` is supplied for Docker Desktop. If the project uses a
different watcher, configure that watcher's polling option instead.

**`Cannot find module` after adding a package**  
Rebuild the development image so the anonymous container dependency volume is
recreated: `docker compose down -v`, then `docker compose up --build`. This only
removes Docker-managed local volumes; it does not touch Supabase.

**Database connection or certificate errors**  
Re-copy the URI from Supabase, check the database password and network access,
then confirm the application's SSL configuration matches its Postgres driver.

**Production exits immediately**  
Check that `bun run build` produces `dist/main.js`. If the Nest build output or
entry command differs, update the final `CMD` in `Dockerfile` accordingly.
