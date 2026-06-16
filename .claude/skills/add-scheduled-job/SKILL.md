# Skill: Add Scheduled Job

**Description**: Add a periodic job using toad-scheduler, triggered by interval (e.g., every hour) or cron expression (e.g., daily at midnight).

**Source tutorial**: [tutorial/16-menambah-scheduled-job.md](../../../tutorial/16-menambah-scheduled-job.md)

## Overview: Job Types

| Type | Constructor | Use Case |
|---|---|---|
| `SimpleIntervalJob` | `{ seconds \| minutes \| hours \| days }, task, opts` | Fixed interval (e.g., every 2 hours) |
| `CronJob` | `'cron expression', task, opts` | Specific times (e.g., daily at 6 AM) |

Both are from `toad-scheduler` and registered via `fastify.scheduler`.

## Step 1: Create Job File

File: `src/modules/auth/jobs/cleanup.job.ts`

```ts
import { AsyncTask, SimpleIntervalJob } from 'toad-scheduler'
import { FastifyInstance } from 'fastify'

/**
 * Delete expired refresh tokens from the database.
 * Runs every hour.
 */
export function createCleanupJob(fastify: FastifyInstance) {
  const task = new AsyncTask(
    'cleanup-expired-tokens',  // ← unique ID
    async () => {
      // Job logic
      if (fastify.config.DB_DRIVER === 'mongodb') {
        // MongoDB: TTL index auto-deletes expired docs
        fastify.log.info('Skipping cleanup (MongoDB auto-deletes)')
      } else {
        // Prisma: manually delete
        const deleted = await fastify.db.refreshToken.deleteMany({
          where: {
            expiresAt: { lt: new Date() },
          },
        })
        fastify.log.info(`Cleaned up ${deleted.count} expired tokens`)
      }
    },
    (error) => {
      // Error handler (required best practice)
      fastify.log.error(`Cleanup job failed: ${error.message}`)
    }
  )

  // Run every hour
  return new SimpleIntervalJob({ hours: 1 }, task, { id: 'cleanup-expired-tokens' })
}
```

## Step 2: Register Job in Module

File: `src/modules/auth/module.ts`

```ts
import { createCleanupJob } from './jobs/cleanup.job.js'
import { FastifyInstance } from 'fastify'

export default async function authModule(fastify: FastifyInstance): Promise<void> {
  const repository = createAuthRepository(fastify.db)
  const service = new AuthService(repository, fastify)
  const controller = new AuthController(service)

  await fastify.register(
    async (instance) => {
      await authRoutes(instance, controller)

      // ✅ Register jobs INSIDE the fastify.register() callback
      if (instance.scheduler) {
        const cleanupJob = createCleanupJob(instance)
        instance.scheduler.addSimpleIntervalJob(cleanupJob)
        instance.log.info('Cleanup job registered successfully')
      }
    },
    { prefix: '/api/v1/auth' }
  )
}
```

**Key points:**
- Always check `if (instance.scheduler)` before registering (scheduler may be disabled).
- Use `instance.scheduler.addSimpleIntervalJob(job)` for interval jobs.
- Use `instance.scheduler.addCronJob(job)` for cron jobs.
- **Never** import `@fastify/schedule` directly in a module — only use the `instance.scheduler` decorator.

## Cron Expression Reference

Format: `seconds minutes hours day-of-month month day-of-week` (all in UTC)

| Expression | Meaning |
|---|---|
| `0 0 * * *` | Daily at midnight (00:00 UTC) |
| `0 * * * *` | Every hour on the hour |
| `0 6 * * *` | Every day at 6 AM UTC |
| `0 6 * * 1-5` | Weekdays (Mon-Fri) at 6 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 0 1 * *` | First day of month at midnight |
| `0 0 * * 0` | Every Sunday at midnight |
| `0 9,17 * * *` | Every day at 9 AM and 5 PM |

## Example 1: Hourly Cleanup Job (SimpleIntervalJob)

Already shown above.

## Example 2: Daily Report (CronJob)

File: `src/modules/reports/jobs/daily-report.job.ts`

```ts
import { AsyncTask, CronJob } from 'toad-scheduler'
import { FastifyInstance } from 'fastify'

export function createDailyReportJob(fastify: FastifyInstance) {
  const task = new AsyncTask(
    'daily-sales-report',
    async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)

      let orders: any[] = []

      if (fastify.config.DB_DRIVER === 'mongodb') {
        orders = await OrderModel.find({
          createdAt: {
            $gte: yesterday,
            $lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
          },
        })
      } else {
        orders = await fastify.db.order.findMany({
          where: {
            createdAt: {
              gte: yesterday,
              lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        })
      }

      const total = orders.reduce((sum, o) => sum + o.amount, 0)
      fastify.log.info(`Daily report: ${orders.length} orders, total $${total}`)

      // Could send email, upload to S3, etc.
    },
    (error) => {
      fastify.log.error(`Daily report job failed: ${error.message}`)
    }
  )

  // Run daily at midnight UTC
  return new CronJob(
    { second: 0, minute: 0, hour: 0 },  // or '0 0 * * *'
    task,
    { id: 'daily-sales-report' }
  )
}
```

Register in `src/modules/reports/module.ts`:

```ts
if (instance.scheduler) {
  const reportJob = createDailyReportJob(instance)
  instance.scheduler.addCronJob(reportJob)
  instance.log.info('Daily report job registered')
}
```

## Example 3: Every 30 Minutes

```ts
import { SimpleIntervalJob, AsyncTask } from 'toad-scheduler'

const task = new AsyncTask(
  'sync-external-data',
  async () => {
    fastify.log.info('Syncing external data...')
    // fetch from API, update DB, etc.
  },
  (error) => {
    fastify.log.error(`Sync failed: ${error.message}`)
  }
)

return new SimpleIntervalJob({ minutes: 30 }, task, { id: 'sync-every-30m' })
```

## Controlling the Scheduler

The scheduler can be globally disabled via env var:

```env
SCHEDULER_ENABLED=true   # Default; jobs run
SCHEDULER_ENABLED=false  # Scheduler disabled; jobs registered but don't execute
```

Jobs registered when the scheduler is disabled will silently not run. This is useful for testing — set `SCHEDULER_ENABLED=false` in test env to prevent side effects.

## Best Practices

✅ **Do:**
1. Always handle errors via the `AsyncTask` error handler (second parameter).
2. Use clear logging (`fastify.log.info('Job done')`) for observability.
3. Give jobs unique IDs.
4. Always check `if (instance.scheduler)` before registering.
5. Use appropriate intervals (hourly cleanup, daily reports, every 5 minutes for health checks).

❌ **Don't:**
1. Throw unhandled errors from the task — the job fails silently if you do.
2. Block the event loop (e.g., no `while(true){}` loops) — always `await`.
3. Forget to clean up resources (e.g., close DB connections in `finally` block).
4. Create infinite loops or recursive jobs without guards.
5. Import `@fastify/schedule` directly in a module — use `instance.scheduler` only.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Job doesn't run | `SCHEDULER_ENABLED=false` or not registered | Set env to true, check registration, check server logs |
| Job runs too often | Interval/cron expression wrong | Double-check timing, verify no duplicate registrations |
| Job errors repeatedly | Unhandled error in task | Add try/catch, implement proper error handler |
| Logs show nothing | Job is running but not logging | Add `fastify.log.info()` statements, check log level |

## Manual Testing

**Trigger a job early for testing** (instead of waiting for its schedule):

```ts
// In a controller or route (temporary, for testing only)
export class TestController {
  async runJobNow(request: FastifyRequest, reply: FastifyReply) {
    // Get the scheduled job
    const jobs = request.server.scheduler.getScheduledJobs()
    const cleanupJob = jobs.find(j => j.id === 'cleanup-expired-tokens')

    if (cleanupJob) {
      // Execute immediately
      await cleanupJob.execute()
      reply.send({ success: true, message: 'Job executed' })
    } else {
      reply.code(404).send({ success: false, message: 'Job not found' })
    }
  }
}
```

**Then:**
```bash
curl http://localhost:3000/api/v1/test/run-job-now
# {"success": true, "message": "Job executed"}
```

Check server logs to see the job output.

For complete details and more examples, see the source tutorial.
