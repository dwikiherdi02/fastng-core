export interface ModuleConfig {
  name: string
  enabled: boolean
  path: string
  dependsOn: string[]
}

const modules: ModuleConfig[] = [
  {
    name: 'permission',
    enabled: true,
    path: '../modules/permission/module.js',
    dependsOn: [],
  },
  {
    name: 'menu',
    enabled: true,
    path: '../modules/menu/module.js',
    dependsOn: ['permission'],
  },
  {
    name: 'session',
    enabled: true,
    path: '../modules/session/module.js',
    dependsOn: [],
  },
  {
    name: 'role',
    enabled: true,
    path: '../modules/role/module.js',
    dependsOn: ['menu'],
  },
  {
    name: 'auth',
    enabled: true,
    path: '../modules/auth/module.js',
    dependsOn: ['role', 'menu', 'session'],
  },
  {
    name: 'users',
    enabled: true,
    path: '../modules/users/module.js',
    dependsOn: ['auth', 'role'],
  },
  {
    name: 'welcome',
    enabled: true,
    path: '../modules/welcome/module.js',
    dependsOn: ['auth'],
  },
]

export default modules
