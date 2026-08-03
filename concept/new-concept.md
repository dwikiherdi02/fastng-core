# Deskripsi

berikut adalah plan dari konsep baru aplikasi ini, konteks ini meliputi beberapa phase, diantaranya:

## Phase 1
merupakan phase untuk mendefinisikan kembali setiap table database starter kit pada aplikasi ini

### Table: modules

| | Column | Type (Opt:length/enum) | Not Null | Auto Incr. | Default | Note |
| --- | --- | --- | --- | --- | --- | --- |
| [PK] | id | Int (11) | True | True | - | - |
| | name | String (100) | True | False | - | - |
| [UNIQUE] | code | String (50) | True | False | - | - |
| | is_enabled | Bool | True | False | False | - |
| | path | Text | True | False | - | e.g: ../modules/menus/module.js |
| | depend_on | Json / Jsonb | False | False | - | e.g: ['role', 'menu', 'session'] |
| | created_at | Timestamps | TRUE | False | NOW() |  - |
| | updated_at | Timestamps | False | False | Null |  - |

#### Contoh Data:

| id | name | code | is_enabled | path | depend_on |
| --- | --- | --- | --- | --- | --- |
| 1 | Menus | menus | true | ../modules/menus/module.js | null |
| 2 | Roles | roles | true | ../modules/menus/module.js | [ 'menus' ] |
| 3 | Users | users | true | ../modules/roles/module.js | [ 'menus', 'roles' ] | 
| 4 | Welcome | welcome | false | ../modules/welcome/module.js | null | 

#### Keterangan: 
table ini berfungsi untuk menyimpan daftar module yang ada di aplikasi ini, yang di set di file module.registry.ts. jadi setiap ada perubahan maka di fil tersebut maka data akan masuk dan berubah ke dalam table ini.

#### *Catatan: 
table ini sifatnya berdiri sendiri (di luar table migration setiap modulenya) di sematkan di folder prisma sebagai table independen. dan data pada table ini di set di file module.registry.ts (sesuika data propertynya)

### Table: module_permissions

| | Column | Type (Opt:length/enum) | Not Null | Auto Incr. | Default | Note |
| --- | --- | --- | --- | --- | --- | --- |
| [PK] | id | Int (11) | True | True | - | - |
| [FK -> modules.code] | module_code | String (50) | True | False | - | - |
| | name | String (100) | True | False | - | - |
| [UNIQUE] | code | String (50) | True | False | - | format: module_code.code, e.g: menus.create |
| | description | Text | False | False | Null | - |
| | created_at | Timestamps | True | False | NOW() | - |
| | updated_at | Timestamps | False | False | Null | - |

#### Contoh Data:
| id | module_code | name | code | description
| --- | --- | --- | --- | --- |
| 1 | menus | Create Menu Module | menus.create | Permit to create menu 
| 2 | menus | Read Menu Module | menus.read | Permit to read menu 
| 3 | menus | Update Menu Module | menus.update | Permit to update menu 
| 4 | menus | Delete Menu Module | menus.delete | Permit to delete menu 

#### Keterangan: 
table ini berisi data permission setiap module nya yang nanti di sematkan ke endpoint / API pada module tersebut. nama dan code bisa saja sama karena setiap modulenya bisa saja memiliki permission yang sama 

#### *Catatan: 
table ini sifatnya berdiri sendiri (di luar table migration setiap modulenya) di sematkan di folder prisma sebagai table independen. dan datanya di set di file *.manifest.ts yang ada pada setiap folder modules (sesuika data propertynya)

### Table: menus
| | Column | Type (Opt:length/enum) | Not Null | Auto Incr. | Default | Note |
| --- | --- | --- | --- | --- | --- | --- |
| [PK] | id | Int (11) | True | True | - | - |
| [FK -> modules.code] | module_code | String (50) | True | False | - | - |
| | name | String (100) | True | False | - | - |
| [UNIQUE] | code | String (50) | True | False | - | - |
| | path | Text | True | False | - | e.g: users/ |
| | icon | String (20) | False | False | - | remix icon |
| | sort | INT (5) | False | False | - | - |
| | created_at | Timestamps | True | False | NOW() |  - |
| | created_by | UUIDv7 | False | False | Null | Id user (module users aktif) |
| | updated_at | Timestamps | False | False | Null |  - |
| | updated_by | UUIDv7 | False | False | Null | Id user (module users aktif) |

#### Contoh Data:

| id | module_code | name | code | path | icon | sort |
| --- | --- | ---  | ---  | ---  | ---  | --- |
| 1 | welcome | Dashboard | dashboard | dashboard/ | ri-dashboard-fill | 1 |
| 2 | menus | Menu Management | menus | menu-management/ | ri-grid-fill | 2 |
| 3 | roles | Role Management | roles | role-management/ | ri-grid-fill | 3 |
| 4 | users | Menu Management | users | user-management/ | ri-grid-fill | 4 |

#### Keterangan: 
table ini berisi data menu jika sebuah module di set ada menunya (ada juga sebuah module yang bukan sebuah menu, hanya service / helper dan sebagainya). 

#### *Catatan: 
table ini berada di folder modules/menus (migrations) dan datanya di set di file *.manifest.ts yang ada di folder modules (sesuika data propertynya). 

### Table: menu_permission

| | Column | Type (Opt:length/enum) | Not Null | Auto Incr. | Default | Note |
| --- | --- | --- | --- | --- | --- | --- |
| [PK] | id | Int (11) | True | True | - | - |
| [FK -> menus.code] | menu_code | String (50) | True | False | - | e.g: menus |
| | name | String (100) | True | False | - | - |
| [UNIQUE] | code | String (50) | True | False | - | format: menu_code.access_type.code, e.g: menus.page.landing |
| | access_type | Enum (page/module_permit) | True | False | - | - |
| [FK -> module_permissions.code] | ref_module_permit | Int (11) | False | False | - | e.g: menus.edit |
| | page | Text | False | False | Null | e.g: add/ , edit/{:int/string/uuid/etc} |
| | Note | Text | False | False | Null | - |
| | created_at | Timestamps | True | False | NOW() |  - |
| | updated_at | Timestamps | False | False | Null |  - |

Contoh data:

| id | menu_code | name | code | access_type | ref_module_permit | page | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | menus | Landing Page | menus.page.landing | page | null | null | Akses halaman menu management |
| 2 | menus | Edit Page | menus.page.edit | page | null | edit/{:int} | Akses halaman edit menu management |
| 3 | menus | Proses Edit | menus.module_permit.edit | module_permit | menus.update | null | Akses endpoint edit menu |

Keterangan:

*Catatan:
