# Skill: Switch Database Driver

**Description**: Switch the active database between sqlite, mysql, postgresql, and mongodb.

**Source tutorial**: [tutorial/08-ganti-database-driver.md](../../../tutorial/08-ganti-database-driver.md)

## SQLite (Default)

SQLite is the default — it stores data in a local file (`./prisma/dev.db`).

**No action needed** — it just works. If you want to explicitly set it:

```env
DB_DRIVER=sqlite
DATABASE_URL=file:./prisma/dev.db
```

Run: `bun run dev`

## MySQL

**Prerequisites**: MySQL 8+ server running locally or remotely.

**Step 1:** Copy the MySQL schema variant over the active schema:

```bash
# macOS / Linux
cp prisma/schema.mysql.prisma prisma/schema.prisma

# Windows (PowerShell)
Copy-Item prisma\schema.mysql.prisma prisma\schema.prisma -Force
```

**Step 2:** Update `.env`:

```env
DB_DRIVER=mysql
DATABASE_URL=mysql://user:password@localhost:3306/fastng_db
```

Replace `user`, `password`, `localhost`, `3306`, and `fastng_db` with your actual credentials.

**Step 3:** Generate Prisma client and apply schema:

```bash
bun run migrate
```

**Step 4:** Start the server:

```bash
bun run dev
```

Check logs: `[DB] Connected to MySQL`

## PostgreSQL

**Prerequisites**: PostgreSQL 14+ server running.

**Step 1:** Copy the PostgreSQL schema variant:

```bash
# macOS / Linux
cp prisma/schema.postgresql.prisma prisma/schema.prisma

# Windows (PowerShell)
Copy-Item prisma\schema.postgresql.prisma prisma\schema.prisma -Force
```

**Step 2:** Update `.env`:

```env
DB_DRIVER=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/fastng_db
```

**Step 3:** Generate and migrate:

```bash
bun run migrate
```

**Step 4:** Start:

```bash
bun run dev
```

Check logs: `[DB] Connected to PostgreSQL`

## MongoDB

**Prerequisites**: MongoDB 6+ server running (local or Atlas cluster).

MongoDB uses Mongoose instead of Prisma — no schema migration needed.

**Step 1:** Update `.env`:

```env
DB_DRIVER=mongodb

# Local
MONGODB_URI=mongodb://localhost:27017/fastng_db

# MongoDB Atlas (cloud)
MONGODB_URI=mongodb+srv://username:password@cluster-name.mongodb.net/fastng_db?retryWrites=true&w=majority
```

**Step 2:** Start the server:

```bash
bun run dev
```

**No migration needed.** Mongoose auto-creates collections. Check logs: `[DB] Connected to MongoDB`

## What Happens to Data?

**Switching drivers does NOT migrate data between them.** Each driver has its own storage:
- SQLite: `./prisma/dev.db` file
- MySQL: tables in the MySQL database
- PostgreSQL: tables in the PostgreSQL database
- MongoDB: collections in MongoDB

**Starting fresh after a switch:** All data from the previous driver is lost. This is fine for local development; for production, plan migrations carefully.

## Migration commands after a switch

| Command | Use Case |
|---|---|
| `bun run migrate` | Diff each enabled module's own fragment for the new driver, create + apply its migration, sync the catalog |
| `bun run migrate:fresh -- --seed` | Rebuild the new database from scratch and seed it (the usual move after switching) |
| `bun run migrate:status` | Check what has been applied per module, and in which batch |
| `bunx prisma studio` | GUI-based DB admin (Prisma drivers only) |

Migration SQL is driver-specific and stored **per module** (`src/modules/{name}/db/migrations/`), so migrations created for one driver will not apply to another — `bun run migrate` detects the mismatch and tells you which module's `db/migrations/` folder to delete. After switching, delete every module's `db/migrations/` folder and run `bun run migrate` (or just `bun run migrate:fresh` on a driver you're not attached to keeping history for). See `tutorial/26-cli-migrasi-dan-seeder-ala-laravel.md`.

## Verifying the Switch

1. Restart server: `bun run dev`
2. Check logs for `[DB] Connected to {driver name}`
3. Open Swagger UI at `http://localhost:3000/docs`
4. Test a simple endpoint (e.g., `GET /api/v1/welcome`)
5. Create a user via login/register to confirm writes work
6. Run `bun run lint` and `bun run format` to ensure no code changes are needed (the repository factory pattern handles driver switching, so application code stays the same)

## Transparent to Application Code

The repository factory pattern (`create{Name}Repository(fastify.db)`) branches on `env.DB_DRIVER` internally. Services and controllers never know which driver is active — they only see the unified `I{Name}Repository` interface:

```ts
export function createPostRepository(db: any): IPostRepository {
  if (process.env.DB_DRIVER === 'mongodb') {
    return new PostMongoRepository()  // No PrismaClient
  }
  return new PostPrismaRepository(db)  // PrismaClient
}
```

**Both implementations** conform to the same interface, so no controller/service changes are needed.

## Caveats

**MongoDB limitations:**
- Transactions are not supported (MongoDB requires a replica set, which is complex for local dev). Use `withTransaction()` only with Prisma drivers; it throws an error if called with MongoDB.
- Some Prisma-specific features (computed fields, auto-increment) don't have direct Mongoose equivalents — consult the model definitions.

**MySQL/PostgreSQL:**
- `DATABASE_URL` is required (unlike MongoDB which uses `MONGODB_URI`).
- Both use Prisma, so the migration workflow is identical — only the schema file (`schema.mysql.prisma` vs `schema.postgresql.prisma`) differs.

For complete details, see the source tutorial.
