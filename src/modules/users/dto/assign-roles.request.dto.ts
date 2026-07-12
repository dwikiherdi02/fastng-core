import { z } from 'zod'

export const assignRolesSchema = z.object({
  roles: z.array(z.string()),
})

export type AssignRolesDto = z.infer<typeof assignRolesSchema>

export const assignRolesRouteSchema = {
  tags: ['Users'],
  summary: 'Replace a user role assignments',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
  body: {
    type: 'object',
    required: ['roles'],
    properties: { roles: { type: 'array', items: { type: 'string' } } },
  },
}
