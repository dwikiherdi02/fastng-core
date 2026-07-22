-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "path" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menus" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "menu_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menu_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    CONSTRAINT "menu_permissions_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menus" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "menus_code_key" ON "menus"("code");

-- CreateIndex
CREATE INDEX "menu_permissions_permission_id_idx" ON "menu_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "menu_permissions_menu_id_permission_id_key" ON "menu_permissions"("menu_id", "permission_id");
