import { z } from 'zod'

export const setUserPermissionsSchema = z.object({
  overrides: z.array(
    z.object({
      menuCode: z.string(),
      permissionCode: z.string(),
      effect: z.enum(['allow', 'deny']),
    })
  ),
})

export type SetUserPermissionsDto = z.infer<typeof setUserPermissionsSchema>

export const setUserPermissionsRouteSchema = {
  tags: ['Users'],
  summary: 'Replace a user permission overrides (user-level checklist, allow/deny)',
  security: [{ BearerAuth: [] }],
  params: { type: 'object', properties: { id: { type: 'string' } } },
  body: {
    type: 'object',
    required: ['overrides'],
    properties: {
      overrides: {
        type: 'array',
        items: {
          type: 'object',
          required: ['menuCode', 'permissionCode', 'effect'],
          properties: {
            menuCode: { type: 'string' },
            permissionCode: { type: 'string' },
            effect: { type: 'string', enum: ['allow', 'deny'] },
          },
        },
      },
    },
  },
}
