# Skill: Write or Update a Tutorial

**Description**: Create a new tutorial markdown file (or update an existing one) documenting a fundamental pattern, feature, or architectural change in Bahasa Indonesia.

**Source reference**: @.claude/rules/documentation.md

## When to Use This Skill

Create a **new tutorial** after implementing a fundamental change (new architecture pattern, new core utility, new error handling, registry changes, etc.). Update an **existing tutorial** when:
- The pattern has evolved but fundamental structure is the same
- Code samples are outdated
- Explanations are unclear or incomplete
- A new variant of the pattern needs documenting

Refer to documentation.md to determine if your change is "fundamental."

## Step 1: Determine Sequence Number

Check the highest-numbered tutorial in `tutorial/`:

```bash
ls tutorial/ | sort -V | tail -1
# Output: 16-menambah-scheduled-job.md
# → Next tutorial will be 17-...
```

If updating an existing tutorial, skip this step.

## Step 2: Decide on Topic (Bahasa Indonesia)

Pick a short, descriptive title in **Bahasa Indonesia** (kebab-case):

**Examples:**
- `menambah-request-interceptor` (adding a request interceptor)
- `custom-validation-decorator` (custom validation decorator)
- `multi-database-query` (querying across multiple DBs)
- `environment-specific-config` (env-specific configuration)
- `graceful-shutdown-handling` (graceful shutdown)

**Naming formula:** kebab-case, verb-noun or noun-phrase, 3-5 words max

## Step 3: Create File Structure

File: `tutorial/{NN}-{topic-in-indonesian}.md`

Use the canonical template from documentation.md:

```markdown
# NN-Judul-Tutorial-dalam-Bahasa-Indonesia

**Tujuan**: One-line goal (Bahasa Indonesia).

**Kapan digunakan**: When/why developers use this (Bahasa Indonesia).

**Prasyarat**: Dependencies, enabled modules, env vars (Bahasa Indonesia).

## Pengenalan (Introduction)

Explain the pattern, problem it solves, why it exists.

## Alur/Mekanisme (Flow/Mechanism)

Step-by-step explanation with diagrams, tables.

## Langkah-Langkah (Step-by-Step Walkthrough)

### Langkah 1: [Deskripsi]

Explanation + code + command

### Langkah 2: [Deskripsi]

...

## Contoh Lengkap (Full Example)

Complete, runnable example.

## Aturan/Pedoman (Rules/Guidelines)

Do's and don'ts.

## Verifikasi (Verification/Testing)

How to test/verify.

## Referensi Kode Aktual (Code References)

Real file paths from codebase.

## Catatan (Notes)

Edge cases, gotchas, future improvements.

## Lihat Juga (See Also)

Related tutorials or rules.
```

## Step 4: Write Each Section

### Tujuan (Goal)

One sentence, clear intent. Example:

> Tujuan: Belajar cara membuat custom middleware untuk menangkap dan mencatat setiap request yang masuk ke aplikasi.

### Kapan Digunakan

One or two sentences describing when/why. Example:

> Gunakan tutorial ini ketika Anda perlu menambahkan logika yang berjalan pada setiap request (audit log, tracking, header injection, dll) sebelum route handler dijalankan.

### Prasyarat

List requirements. Example:

> - Module `auth` sudah diaktifkan (`enabled: true` di registry)
> - Fastify versi 5+ (sudah ada di project)
> - Pemahaman dasar tentang Fastify hooks (lihat tutorial/10-menambah-fungsi-middleware.md)

### Pengenalan

2-3 paragraphs explaining the concept. Include:
- What problem does this solve?
- Why is this pattern important?
- Any architecture principles it embodies?

Example:

> Middleware adalah fungsi yang berjalan pada setiap HTTP request, memberikan Anda kesempatan untuk melakukan validasi, transformasi, atau pencatatan sebelum route handler dijalankan. Dalam Fastify, ini diimplementasikan sebagai "hooks" — callback yang dipicu pada fase tertentu dalam lifecycle request.
>
> Pola middleware sangat berguna untuk cross-cutting concerns seperti audit logging, rate limiting, request ID injection, dan body transformation. Dengan memahami cara kerja hooks, Anda dapat memisahkan concerns ini dari business logic route handler, membuat kode lebih modular dan testable.

### Alur/Mekanisme

Diagram + explanation. Example:

```
HTTP Request
    ↓
[onRequest Hook] ← request ID injection, audit log
    ↓
[preHandler Hook] ← auth, authorization
    ↓
[Route Handler] ← controller logic
    ↓
[onSend Hook] ← response transformation
    ↓
HTTP Response
```

Explain each phase and when it runs.

### Langkah-Langkah

Numbered, actionable steps. Each step has:
1. **Title** (what you're doing)
2. **File path** (if creating/editing a file)
3. **Explanation** (why/what)
4. **Code sample** (with syntax highlighting)
5. **Command** (if running anything)

Example:

```markdown
### Langkah 1: Buat File Middleware

Buat file baru di `src/core/middlewares/audit-log.ts`:

\`\`\`ts
import { FastifyRequest, FastifyReply } from 'fastify'

export async function auditLogMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.info({
    method: request.method,
    url: request.url,
    timestamp: new Date().toISOString(),
  })
}
\`\`\`

Fungsi ini akan mencatat setiap request yang masuk dengan method, URL, dan waktu.
```

### Contoh Lengkap

A realistic, copy-pasteable example. Example:

> **Skenario**: Anda ingin menambahkan unique request ID ke setiap request untuk tracing.
>
> **File: `src/core/middlewares/request-id.ts`**
> [full code]
>
> **File: `src/app.ts` (register the middleware)**
> [full code]
>
> **Test**: Jalankan `yarn dev`, buat request, lihat di logs: `[abc-def-123] GET /api/v1/posts`

### Aturan/Pedoman

Table or bullets of do's and don'ts. Example:

```markdown
| ✅ Do | ❌ Don't |
|---|---|
| Use `onRequest` for early checks | Use `onRequest` for heavy async work |
| Log useful context (user ID, endpoint) | Log sensitive data (passwords, tokens) |
| Fail fast on validation errors | Silently ignore validation errors |
```

### Verifikasi

Step-by-step how to test. Example:

> 1. Jalankan `yarn dev`
> 2. Buat request: `curl http://localhost:3000/api/v1/posts`
> 3. Lihat di server logs untuk baris: `[request-id] GET /api/v1/posts`
> 4. Verifikasi setiap request memiliki unique request ID di header response: `X-Request-Id: ...`

### Referensi Kode Aktual

Real file paths. Example:

> - `src/core/middlewares/error-handler.ts` — contoh implementasi global error handler
> - `src/modules/auth/module.ts` line 12-15 — registrasi route dengan preHandler
> - `src/app.ts` line 45 — registrasi hook global

### Catatan

Edge cases, gotchas, performance notes. Example:

> **Perhatian**: Middleware pada `onRequest` berjalan sangat awal, sebelum body di-parse. Jangan coba akses `request.body` di `onRequest` — gunakan `preHandler` sebaliknya.
>
> **Performance**: Jangan lakukan database queries dalam middleware tanpa caching — setiap request akan trigger query. Gunakan caching atau batching jika perlu.

### Lihat Juga

Links to related docs. Example:

> - tutorial/10-menambah-fungsi-middleware.md — detailed hook lifecycle reference
> - .claude/rules/auth-and-jobs.md — preHandler for authentication
> - Fastify documentation: https://www.fastify.io/docs/latest/Guides/Lifecycle/

## Step 5: Verify

Before committing:

1. **Bahasa Indonesia**: All text (except code) is in clear, correct Indonesian.
2. **File path in title**: Matches file you created (e.g., tutorial/17-*.md in the filename).
3. **Code samples compile**: Actually copy-paste them and verify they work (or note that they're pseudo-code / illustrative).
4. **Sequence number**: Matches next available number in `tutorial/`.
5. **Links work**: Any cross-references to other tutorials or rules exist.
6. **Markdown format**: Valid markdown (check headings, code blocks, tables, links).

Run:

```bash
yarn format  # format code samples
yarn lint    # lint any embedded code
```

## Step 6: Update Related Files

After creating/updating the tutorial:

1. **Update `.claude/skills/{topic}/SKILL.md`** (if a matching skill exists):
   - Add pointer to the tutorial: `**Source tutorial**: [tutorial/17-...](../../../tutorial/17-...md)`
   - Update procedure bullets if the tutorial introduced new steps

2. **Update `.claude/rules/{topic}.md`** (if related rule exists):
   - Add link to the tutorial: `For complete details, see tutorial/17-...md`

3. **Commit together**: Code + tutorial + updated skills/rules in one commit with message:
   ```
   Add tutorial: menambah-custom-middleware
   
   - tutorial/17-menambah-custom-middleware.md: new pattern for global request logging
   - .claude/skills/add-middleware-hook/SKILL.md: updated with tutorial reference
   ```

## Example: Tutorial Update

**Scenario**: `tutorial/08-ganti-database-driver.md` was written for Prisma v5, but you've upgraded to v6 with breaking changes.

**Steps**:
1. Open the tutorial
2. Update the version numbers, env var examples, migration commands
3. Update code samples to reflect v6 API
4. Test the steps yourself: follow them verbatim and verify they work
5. Commit with message: `Update tutorial: Prisma v6 migration` (include what changed)

## Checklist

- [ ] **Bahasa Indonesia throughout (except code/paths/identifiers)** — ALL tutorial files MUST be in Indonesian
- [ ] File created at `tutorial/NN-topic.md` (or existing file updated)
- [ ] File name is in Bahasa Indonesia (kebab-case)
- [ ] All 8 sections filled: Tujuan, Kapan, Prasyarat, Pengenalan, Alur, Langkah, Contoh, Aturan, Verifikasi, Referensi, Catatan, Lihat Juga
- [ ] Code samples tested (copy-paste and works, or clearly marked as illustrative)
- [ ] Heading hierarchy correct (# NN-Title, ## Sections, ### Langkah)
- [ ] Links to other tutorials/rules use relative paths
- [ ] Updated related `.claude/skills/` and `.claude/rules/` files
- [ ] Committed together with code changes

For in-depth guidance, see @.claude/rules/documentation.md.
