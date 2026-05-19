# Menambah Route Protected (Login Required)

Route protected adalah route yang hanya bisa diakses oleh user yang sudah login. Di FastNG, ini dilakukan dengan menambahkan `fastify.authenticate` sebagai `preHandler`.

---

## Cara Kerja Autentikasi

1. Client mengirim request dengan header `Authorization: Bearer <accessToken>`
2. `fastify.authenticate` (dari `jwt.plugin.js`) memverifikasi JWT
3. Jika valid: `request.user` diisi dengan payload token, request dilanjutkan
4. Jika tidak valid: otomatis melempar error `401 Unauthorized`

---

## 3 Cara Menambahkan Auth ke Route

### Cara 1 — Langsung di Route Definition (paling umum)

```js
// src/modules/posts/routes/post.routes.js
export async function postRoutes(fastify, controller) {
  const auth = { preHandler: [fastify.authenticate] }

  // Route public — tidak perlu login
  fastify.get('/posts', controller.findAll.bind(controller))
  fastify.get('/posts/:id', controller.findById.bind(controller))

  // Route protected — harus login
  fastify.post('/posts', { ...auth }, controller.create.bind(controller))
  fastify.put('/posts/:id', { ...auth }, controller.update.bind(controller))
  fastify.delete('/posts/:id', { ...auth }, controller.delete.bind(controller))
}
```

### Cara 2 — Satu Route Spesifik

```js
fastify.delete('/posts/:id', {
  preHandler: [fastify.authenticate]
}, controller.delete.bind(controller))
```

### Cara 3 — Semua Route dalam Satu Block

Jika semua route dalam file memerlukan login, gunakan `addHook`:

```js
export async function postRoutes(fastify, controller) {
  // Semua route di bawah ini memerlukan autentikasi
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/posts', controller.findAll.bind(controller))
  fastify.post('/posts', controller.create.bind(controller))
  fastify.delete('/posts/:id', controller.delete.bind(controller))
}
```

---

## Mengakses Data User di Controller

Setelah autentikasi berhasil, `request.user` berisi payload dari JWT:

```js
export class PostController {
  async create(request, reply) {
    const userId = request.user.id      // ID user yang login
    const userRole = request.user.role  // 'user' atau 'admin'
    const email = request.user.email    // email user

    const result = await this.service.createPost(userId, request.body)
    return reply.code(201).send(successResponse(result))
  }

  async delete(request, reply) {
    const userId = request.user.id
    const postId = request.params.id

    // Pastikan hanya pemilik yang bisa hapus
    const result = await this.service.deletePost(postId, userId)
    return reply.send(successResponse(result))
  }
}
```

---

## Menambahkan Swagger Security Annotation

Agar endpoint protected muncul dengan ikon kunci di Swagger UI:

```js
fastify.post('/posts', {
  preHandler: [fastify.authenticate],
  schema: {
    security: [{ bearerAuth: [] }],
    body: CreatePostJsonSchema,
    response: {
      201: PostResponseSchema
    }
  }
}, controller.create.bind(controller))
```

---

## Cara Testing

1. Jalankan server: `yarn dev`
2. Login via `POST /api/v1/auth/login`
3. Copy `accessToken` dari response
4. Di Swagger UI (`http://localhost:3000/docs`), klik **Authorize** dan masukkan token
5. Atau gunakan curl:

```bash
curl -X POST http://localhost:3000/api/v1/posts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d "{\"title\": \"Hello World\", \"content\": \"My first post\"}"
```

Request tanpa token → response `401 Unauthorized`:

```json
{
  "success": false,
  "message": "Unauthorized"
}
```
