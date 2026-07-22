/**
 * Laravel-style migration CLI, backed by Prisma Migrate.
 *
 *   bun run migrate                      create + apply pending migrations
 *   bun run migrate -- --name=add_posts  name the migration it creates
 *   bun run migrate:install              create the migration repository
 *   bun run migrate:status               show the status of each migration
 *   bun run migrate:rollback -- --step=2 roll back the last N batches (default 1)
 *   bun run migrate:reset                roll back all migrations
 *   bun run migrate:refresh -- --seed    reset then re-run all migrations
 *   bun run migrate:fresh -- --seed      drop all tables then re-run all migrations
 *
 * See tutorial/26-cli-migrasi-dan-seeder-ala-laravel.md.
 */
import env from '../src/core/config/env.config.js'
import {
  fresh,
  install,
  migrate,
  refresh,
  reset,
  rollback,
  status,
  type MigrateOptions,
} from '../src/core/database/migration/migration.runner.js'

const COMMANDS = ['migrate', 'install', 'status', 'rollback', 'reset', 'refresh', 'fresh'] as const
type Command = (typeof COMMANDS)[number]

const args = process.argv.slice(2)

function flag(name: string): string | undefined {
  const prefix = `--${name}=`
  return args.find((a) => a.startsWith(prefix))?.slice(prefix.length)
}

function parseCommand(): Command {
  const raw = args.find((a) => !a.startsWith('-')) ?? 'migrate'
  if (!(COMMANDS as readonly string[]).includes(raw)) {
    throw new Error(`Unknown command "${raw}". Expected one of: ${COMMANDS.join(', ')}.`)
  }
  return raw as Command
}

function parseOptions(): MigrateOptions {
  const step = flag('step')
  return {
    name: flag('name'),
    step: step ? Number(step) : undefined,
    seed: args.includes('--seed'),
  }
}

const handlers: Record<Command, (opts: MigrateOptions) => Promise<void>> = {
  migrate,
  install,
  status,
  rollback,
  reset,
  refresh,
  fresh,
}

async function main(): Promise<void> {
  const command = parseCommand()
  const opts = parseOptions()
  const label = command === 'migrate' ? 'migrate' : `migrate:${command}`

  console.log(`\n▶ ${label} (driver: ${env.DB_DRIVER})\n`)
  await handlers[command](opts)
  console.log(`\n✅ ${label} complete.\n`)
}

main().catch((err) => {
  console.error(`\n❌ migrate failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
