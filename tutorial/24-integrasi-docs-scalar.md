# 24 — Konfigurasi Dokumentasi API (Swagger/Scalar)

**Tujuan**: Menjelaskan cara menyajikan UI dokumentasi API yang bisa dipilih antara **Swagger UI** dan **Scalar**, beserta kustomisasi path-nya lewat env.

**Kapan digunakan**: Saat ingin mengganti renderer dokumentasi (Swagger UI ↔ Scalar) atau memindahkan path docs.

**Prasyarat**: `@fastify/swagger` (menghasilkan spec OpenAPI), `@fastify/swagger-ui`, dan `@scalar/fastify-api-reference` terpasang — ketiganya sudah ada di `package.json`.

## Pengenalan

Spec OpenAPI selalu dihasilkan oleh `@fastify/swagger` dari `schema` tiap route. Yang bisa dipilih hanya **renderer UI**:

- `DOC_PROVIDER=swagger` → `@fastify/swagger-ui` (default)
- `DOC_PROVIDER=scalar` → `@scalar/fastify-api-reference`

Keduanya membaca spec yang sama dan menyajikannya di path `DOC_PATH` (default `/docs`).

## Alur/Mekanisme

```
route schema  ──> @fastify/swagger (fastify.swagger())  ──> spec OpenAPI
                                                            │
       DOC_PROVIDER=swagger → @fastify/swagger-ui          ┤
       DOC_PROVIDER=scalar  → @scalar/fastify-api-reference ┘ → UI di DOC_PATH
```

## Langkah-Langkah

### Langkah 1: Dependency

```bash
yarn add @fastify/swagger @fastify/swagger-ui @scalar/fastify-api-reference
```

### Langkah 2: Env var

`src/core/config/env.config.ts`:

```ts
DOC_PROVIDER: z.enum(['scalar', 'swagger']).default('swagger'),
DOC_PATH: z
  .string()
  .regex(/^\//, 'DOC_PATH must start with a "/"')
  .default('/docs'),
```

`.env`:

```env
# Renderer UI docs: swagger | scalar
DOC_PROVIDER=swagger
# Path UI dokumentasi (harus diawali "/")
DOC_PATH=/docs
```

### Langkah 3: Plugin

`src/core/plugins/swagger.plugin.ts`:

```ts
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import scalarApiReference from '@scalar/fastify-api-reference'
import env from '../config/env.config.js'

const swaggerPlugin = async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: { info: { title: 'FastNG API', version: '3.0.0' }, components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } },
  })

  if (env.DOC_PROVIDER === 'scalar') {
    await fastify.register(scalarApiReference, {
      routePrefix: env.DOC_PATH,
      configuration: {
        title: 'FastNG API',
        content: () => fastify.swagger(), // lazy: rute yang diregistrasi belakangan ikut termuat
      },
    })
  } else {
    await fastify.register(fastifySwaggerUi, {
      routePrefix: env.DOC_PATH,
      uiConfig: { docExpansion: 'list', deepLinking: true },
    })
  }
}
```

Penting: untuk Scalar, `content` berupa **fungsi** agar dievaluasi setelah semua modul mendaftarkan route-nya. `@fastify/swagger-ui` menarik spec-nya sendiri dari plugin `@fastify/swagger`.

## Verifikasi

1. `yarn dev`, buka `http://localhost:3000/docs`.
   - Default (`DOC_PROVIDER=swagger`) → tampil **Swagger UI**.
   - Set `DOC_PROVIDER=scalar` lalu restart → tampil **Scalar API Reference**.
2. Endpoint tiap modul (auth, users, roles, menus, permissions) muncul dengan tag dan skema request/response.
3. Tombol Authorize memakai `BearerAuth` (JWT).
4. Set `DOC_PATH=/api-docs` → UI pindah ke `http://localhost:3000/api-docs`. Nilai tanpa awalan `/` menggagalkan boot dengan pesan jelas.

## Referensi Kode Aktual

- `src/core/plugins/swagger.plugin.ts` — registrasi swagger + pemilihan renderer.
- `src/core/config/env.config.ts` — `DOC_PROVIDER` dan `DOC_PATH`.
- `src/app.ts` — `swaggerPlugin` diregistrasi paling awal.

## Catatan

- `@fastify/swagger` tidak menyajikan JSON secara default; Scalar memakai `fastify.swagger()` langsung lewat opsi `content`, sedangkan Swagger UI mengambilnya dari plugin swagger.
- Deskripsi permission dari manifest bisa dicantumkan pada `summary`/`description` schema route agar tampil di kedua renderer.

## Lihat Juga

- `tutorial/06-menambah-dto-validasi.md` (schema route)
