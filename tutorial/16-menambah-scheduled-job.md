# Menambah Scheduled Job

Tutorial cara membuat dan mendaftarkan periodic jobs menggunakan `@fastify/schedule` di modul FastNG.

---

## Gambaran Umum

FastNG menggunakan `@fastify/schedule` yang dibungkus dalam plugin `schedule.plugin.ts`. Scheduler ini menggunakan [toad-scheduler](https://github.com/kibertoad/toad-scheduler) di belakangnya dan menyediakan dua jenis job:

| Job Type | Kegunaan | Contoh |
|----------|----------|--------|
| `SimpleIntervalJob` | Jalankan task dengan interval tetap | Cleanup expired tokens setiap 1 jam |
| `CronJob` | Jalankan task dengan cron expression | Generate daily report setiap hari jam 00:00 |

---

## Instalasi

Package `@fastify/schedule` dan `toad-scheduler` sudah terinstall secara otomatis saat Anda menjalankan:

```bash
bun add @fastify/schedule toad-scheduler
```

Plugin `schedule.plugin.ts` sudah terdaftar di `src/app.ts` dan akan otomatis di-register saat server start.

---

## Environment Variable

Scheduler dapat diaktifkan/dimatikan via environment variable:

```env
SCHEDULER_ENABLED=true   # default: true
```

---

## Struktur Job di Modul

Setiap modul yang membutuhkan scheduled job harus memiliki folder `jobs/`:

```
src/modules/{module-name}/
├── jobs/
│   ├── cleanup.job.ts        ← contoh SimpleIntervalJob
│   └── report.job.ts         ← contoh CronJob
├── module.ts
├── index.ts
└── ...
```

---

## Cara Membuat Job

### Langkah 1: Import Dependencies

```ts
import { SimpleIntervalJob, AsyncTask, CronJob } from 'toad-scheduler'
import type { FastifyInstance } from 'fastify'
```

### Langkah 2: Buat Task

Task adalah fungsi yang akan dijalankan oleh job. Gunakan `AsyncTask` untuk async operations.

```ts
const cleanupTask = new AsyncTask(
  'cleanup-expired-tokens',
  async () => {
    // Business logic here
    fastify.log.info('Cleaning up expired tokens...')
  },
  (error) => {
    fastify.log.error('Cleanup job failed:', error)
  }
)
```

**Parameters:**
- `id`: Unique identifier untuk job (string)
- `task`: Function yang akan dijalankan (bisa async)
- `errorHandler`: Function untuk handle errors (opsional tapi direkomendasikan)

### Langkah 3: Buat Job

#### SimpleIntervalJob (Interval-based)

Jalankan task setiap interval tetap:

```ts
const cleanupJob = new SimpleIntervalJob(
  { seconds: 3600 }, // Interval: 1 jam
  cleanupTask,
  { id: 'cleanup-job' }
)
```

**Options:**
- `seconds`: Interval dalam detik
- `minutes`: Interval dalam menit
- `hours`: Interval dalam jam
- `id`: Unique identifier (opsional)

#### CronJob (Cron-based)

Jalankan task dengan cron expression:

```ts
const reportJob = new CronJob(
  '0 0 * * *', // Cron expression: setiap hari jam 00:00
  reportTask,
  { id: 'daily-report-job' }
)
```

**Cron Format:** `seconds minutes hours day-of-month month day-of-week`

**Contoh Cron Expressions:**
| Expression | Arti |
|------------|------|
| `0 0 * * *` | Setiap hari jam 00:00 |
| `0 * * * *` | Setiap jam (menit ke-0) |
| `0 6 * * 1-5` | Setiap hari Senin-Jumat jam 06:00 |
| `*/15 * * * *` | Setiap 15 menit |
| `0 0 1 * *` | Setiap tanggal 1 setiap bulan |

---

## Contoh Lengkap: Cleanup Job

`src/modules/auth/jobs/cleanup.job.ts`

```ts
import { SimpleIntervalJob, AsyncTask } from 'toad-scheduler'
import type { FastifyInstance } from 'fastify'

/**
 * Cleanup expired refresh tokens
 * Job ini akan dijalankan setiap 1 jam untuk membersihkan refresh tokens yang sudah expired
 */
export function createCleanupJob(fastify: FastifyInstance) {
  const cleanupTask = new AsyncTask(
    'cleanup-expired-refresh-tokens',
    async () => {
      const db = fastify.db
      const dbDriver = fastify.dbDriver

      try {
        if (dbDriver === 'mongodb') {
          // MongoDB cleanup logic
          const result = await db.collection('refreshTokens').deleteMany({
            expiresAt: { $lt: new Date() }
          })
          fastify.log.info(`Cleaned up ${result.deletedCount} expired refresh tokens (MongoDB)`)
        } else {
          // Prisma cleanup logic
          const result = await db.refreshToken.deleteMany({
            where: {
              expiresAt: {
                lt: new Date()
              }
            }
          })
          fastify.log.info(`Cleaned up ${result.count} expired refresh tokens (Prisma)`)
        }
      } catch (error) {
        fastify.log.error('Failed to cleanup expired tokens:', error)
        throw error
      }
    },
    (error) => {
      fastify.log.error('Cleanup job failed:', error)
    }
  )

  const cleanupJob = new SimpleIntervalJob(
    { hours: 1 }, // Jalankan setiap 1 jam
    cleanupTask,
    { id: 'cleanup-expired-refresh-tokens' }
  )

  return cleanupJob
}
```

---

## Contoh Lengkap: Daily Report Job

`src/modules/reports/jobs/daily-report.job.ts`

```ts
import { CronJob, AsyncTask } from 'toad-scheduler'
import type { FastifyInstance } from 'fastify'

/**
 * Generate daily sales report
 * Job ini akan dijalankan setiap hari jam 00:00 untuk generate laporan harian
 */
export function createDailyReportJob(fastify: FastifyInstance) {
  const reportTask = new AsyncTask(
    'generate-daily-sales-report',
    async () => {
      const db = fastify.db
      const dbDriver = fastify.dbDriver
      const date = new Date()
      const yesterday = new Date(date)
      yesterday.setDate(date.getDate() - 1)

      try {
        if (dbDriver === 'mongodb') {
          // MongoDB report logic
          const orders = await db.collection('orders').find({
            createdAt: {
              $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
              $lt: new Date(date.setHours(0, 0, 0, 0))
            }
          }).toArray()

          const totalSales = orders.reduce((sum, order) => sum + order.total, 0)
          fastify.log.info(`Daily report: ${orders.length} orders, $${totalSales.toFixed(2)} sales`)
        } else {
          // Prisma report logic
          const orders = await db.order.findMany({
            where: {
              createdAt: {
                gte: new Date(yesterday.setHours(0, 0, 0, 0)),
                lt: new Date(date.setHours(0, 0, 0, 0))
              }
            }
          })

          const totalSales = orders.reduce((sum, order) => sum + order.total, 0)
          fastify.log.info(`Daily report: ${orders.length} orders, $${totalSales.toFixed(2)} sales`)
        }
      } catch (error) {
        fastify.log.error('Failed to generate daily report:', error)
        throw error
      }
    },
    (error) => {
      fastify.log.error('Daily report job failed:', error)
    }
  )

  const reportJob = new CronJob(
    '0 0 * * *', // Setiap hari jam 00:00
    reportTask,
    { id: 'generate-daily-sales-report' }
  )

  return reportJob
}
```

---

## Mendaftarkan Job di Module

Job harus didaftarkan di `module.ts` menggunakan `fastify.scheduler.add*Job()`.

### Contoh: Auth Module dengan Cleanup Job

`src/modules/auth/module.ts`

```ts
import type { FastifyInstance } from 'fastify'
import { createAuthRepository } from './repositories/auth.repository.js'
import { AuthService } from './services/auth.service.js'
import { AuthController } from './controllers/auth.controller.js'
import authRoutes from './routes/auth.routes.js'
import { createCleanupJob } from './jobs/cleanup.job.js'

export default async function authModule(fastify: FastifyInstance): Promise<void> {
  const repository = createAuthRepository(fastify.db)
  const service = new AuthService(repository, fastify)
  const controller = new AuthController(service)

  fastify.register(
    async (instance) => {
      await authRoutes(instance, controller)

      // Register cleanup job
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

**Important Notes:**
1. Job didaftarkan di dalam `fastify.register()` callback
2. Cek `instance.scheduler` sebelum mendaftarkan job (untuk safety)
3. Gunakan `addSimpleIntervalJob()` untuk interval-based jobs
4. Gunakan `addCronJob()` untuk cron-based jobs

---

## Mendaftarkan Multiple Jobs

Jika modul membutuhkan multiple jobs, daftarkan semua di dalam `fastify.register()`:

```ts
import { createCleanupJob } from './jobs/cleanup.job.js'
import { createNotificationJob } from './jobs/notification.job.js'

export default async function authModule(fastify: FastifyInstance): Promise<void> {
  // ... existing code ...

  fastify.register(
    async (instance) => {
      await authRoutes(instance, controller)

      // Register multiple jobs
      if (instance.scheduler) {
        const cleanupJob = createCleanupJob(instance)
        const notificationJob = createNotificationJob(instance)

        instance.scheduler.addSimpleIntervalJob(cleanupJob)
        instance.scheduler.addCronJob(notificationJob)

        instance.log.info('All jobs registered successfully')
      }
    },
    { prefix: '/api/v1/auth' }
  )
}
```

---

## Menonaktifkan Scheduler

Jika Anda ingin menonaktifkan scheduler (misalnya untuk testing), set environment variable:

```env
SCHEDULER_ENABLED=false
```

Scheduler akan skip registration dan tidak akan menjalankan job apa pun.

---

## Testing Job

### Manual Testing

1. **Start development server:**
   ```bash
   bun run dev
   ```

2. **Check logs untuk melihat job registration:**
   ```
   [timestamp] Scheduler plugin registered successfully
   [timestamp] Cleanup job registered successfully
   ```

3. **Tunggu interval/cron time** untuk melihat job execution:
   ```
   [timestamp] Cleaning up expired tokens...
   [timestamp] Daily report: 15 orders, $2450.00 sales
   ```

### Unit Testing

Test job secara terpisah tanpa Fastify:

```ts
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'

describe('Cleanup Job', () => {
  let fastify: FastifyInstance

  beforeEach(() => {
    // Setup test fastify instance
  })

  afterEach(async () => {
    // Cleanup test fastify instance
  })

  it('should cleanup expired tokens', async () => {
    const job = createCleanupJob(fastify)
    // Test job logic
  })
})
```

---

## Best Practices

### ✅ Do's

1. **Handle errors di job:**
   ```ts
   const task = new AsyncTask(
     'my-job',
     async () => { /* logic */ },
     (error) => { fastify.log.error('Job failed:', error) }
   )
   ```

2. **Gunakan logging yang jelas:**
   ```ts
   fastify.log.info('Starting cleanup job...')
   fastify.log.info(`Cleaned up ${count} records`)
   ```

3. **Gunakan unique job ID:**
   ```ts
   new SimpleIntervalJob({ hours: 1 }, task, { id: 'unique-job-id' })
   ```

4. **Cek scheduler availability:**
   ```ts
   if (fastify.scheduler) {
     fastify.scheduler.addSimpleIntervalJob(job)
   }
   ```

### ❌ Don'ts

1. **Jangan throw error tanpa handle:**
   ```ts
   // BAD
   const task = new AsyncTask('job', async () => { throw new Error('fail') })

   // GOOD
   const task = new AsyncTask('job', async () => { /* handle error */ }, (err) => { /* log error */ })
   ```

2. **Jangan block event loop:**
   ```ts
   // BAD
   const task = new AsyncTask('job', async () => { while(true) {} })

   // GOOD
   const task = new AsyncTask('job', async () => { await someAsyncOperation() })
   ```

3. **Jangan lupa cleanup resources:**
   ```ts
   // GOOD
   const task = new AsyncTask('job', async () => {
     const client = createClient()
     try { /* logic */ } finally { client.close() }
   })
   ```

---

## Troubleshooting

### Job tidak berjalan

**Problem:** Job tidak dijalankan meskipun sudah didaftarkan

**Solution:**
1. Cek `SCHEDULER_ENABLED=true` di `.env`
2. Cek log untuk error saat job registration
3. Pastikan job didaftarkan di dalam `fastify.register()` callback
4. Cek interval/cron expression

### Job berjalan terlalu sering

**Problem:** Job dijalankan lebih sering dari yang diharapkan

**Solution:**
1. Cek interval value di `SimpleIntervalJob`
2. Cek cron expression di `CronJob`
3. Pastikan tidak ada duplicate job registration

### Job error terus-menerus

**Problem:** Job throw error dan tidak retry

**Solution:**
1. Implement proper error handling di `AsyncTask` constructor
2. Gunakan try-catch di task function
3. Log error untuk debugging

---

## Referensi

- [toad-scheduler Documentation](https://github.com/kibertoad/toad-scheduler)
- [Cron Format Guide](https://en.wikipedia.org/wiki/Cron)
- [@fastify/schedule GitHub](https://github.com/fastify/fastify-schedule)
