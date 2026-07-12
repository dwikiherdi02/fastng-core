# 24 — Integrasi Dokumentasi API dengan Scalar

**Tujuan**: Menjelaskan penggantian Swagger UI dengan Scalar (scalar.com) untuk UI dokumentasi API.

**Kapan digunakan**: Saat ingin tampilan dokumentasi API yang modern; atau menyesuaikan konfigurasi docs.

**Prasyarat**: `@fastify/swagger` tetap terpasang (menghasilkan spec OpenAPI).

## Pengenalan

Spec OpenAPI tetap dihasilkan oleh `@fastify/swagger` dari `schema` tiap route. Yang berubah hanya **renderer UI**: dari `@fastify/swagger-ui` menjadi `@scalar/fastify-api-reference`. Scalar membaca spec yang sama dan menyajikannya di `/docs`.

## Alur/Mekanisme

```
route schema  ──> @fastify/swagger (fastify.swagger())  ──> spec OpenAPI
                                                            │
                              @scalar/fastify-api-reference ┘ → UI di /docs
```

## Langkah-Langkah

### Langkah 1: Dependency

```bash
yarn add @scalar/fastify-api-reference
yarn remove @fastify/swagger-ui   # opsional, sudah tidak dipakai
```

### Langkah 2: Plugin

`src/core/plugins/swagger.plugin.ts`:

```ts
import fastifySwagger from '@fastify/swagger'
import scalarApiReference from '@scalar/fastify-api-reference'

const swaggerPlugin = async (fastify) => {
  await fastify.register(fastifySwagger, {
    openapi: { info: { title: 'FastNG API', version: '3.0.0' }, components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } },
  })

  await fastify.register(scalarApiReference, {
    routePrefix: '/docs',
    configuration: {
      title: 'FastNG API',
      content: () => fastify.swagger(), // lazy: rute yang diregistrasi belakangan ikut termuat
    },
  })
}
```

Penting: `content` berupa **fungsi** agar dievaluasi setelah semua modul mendaftarkan route-nya.

## Verifikasi

1. `yarn dev`, buka `http://localhost:3000/docs` → tampil "Scalar API Reference".
2. Endpoint tiap modul (auth, users, roles, menus, permissions) muncul dengan tag dan skema request/response.
3. Tombol Authorize memakai `BearerAuth` (JWT).

## Referensi Kode Aktual

- `src/core/plugins/swagger.plugin.ts` — registrasi swagger + Scalar.
- `src/app.ts` — `swaggerPlugin` diregistrasi paling awal.

## Catatan

- `@fastify/swagger` tidak menyajikan JSON secara default; Scalar memakai `fastify.swagger()` langsung lewat opsi `content`.
- Deskripsi permission dari manifest bisa dicantumkan pada `summary`/`description` schema route agar tampil di Scalar.

## Lihat Juga

- `tutorial/06-menambah-dto-validasi.md` (schema route)
