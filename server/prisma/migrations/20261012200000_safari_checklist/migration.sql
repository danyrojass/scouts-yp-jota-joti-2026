-- AlterTable: SafariItem — categoría, tipo de desafío y si requiere foto.
-- Aditivo: no toca datos existentes (defaults para las filas actuales).
ALTER TABLE "SafariItem"
    ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN     "itemType" TEXT NOT NULL DEFAULT 'PHOTO',
    ADD COLUMN     "requiresPhoto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: SafariFind — respuesta numérica/nota y marca de evidencia fotográfica.
ALTER TABLE "SafariFind"
    ADD COLUMN     "value" TEXT,
    ADD COLUMN     "photoReady" BOOLEAN NOT NULL DEFAULT false;