/**
 * Module registry — declares all modules available in this application.
 *
 * Schema per entry:
 *   name:      string     — unique module identifier
 *   enabled:   boolean    — set false to disable without touching application code
 *   path:      string     — ES import path to the module entry point (module.js)
 *   dependsOn: string[]   — names of modules that must be enabled before this one
 */

/** @type {Array<{name: string, enabled: boolean, path: string, dependsOn: string[]}>} */
const moduleRegistry = [
  {
    name: 'auth',
    enabled: true,
    path: '../modules/auth/module.js',
    dependsOn: [],
  },
  {
    name: 'users',
    enabled: true,
    path: '../modules/users/module.js',
    dependsOn: ['auth'],
  },
  {
    name: 'welcome',
    enabled: true,
    path: '../modules/welcome/module.js',
    dependsOn: ['auth'],
  },
]

export default moduleRegistry
