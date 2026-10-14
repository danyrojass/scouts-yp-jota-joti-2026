-- Recuperacion de postas: el equipo puede saltar una posta (que no encuentra el
-- QR) ingresando la frase de rescate que le dictan los coordinadores. La posta
-- saltada cuenta como semi-completada (mitad de puntos). Aditivo: no borra ni
-- reinicializa datos existentes.

-- AlterEnum
ALTER TYPE "VisitStatus" ADD VALUE 'SKIPPED';

-- AlterTable: Station — frase de rescate secreta (nunca se expone al equipo).
ALTER TABLE "Station" ADD COLUMN "rescuePhrase" TEXT;

-- AlterTable: StationVisit — nota opcional del salto.
ALTER TABLE "StationVisit" ADD COLUMN "skipReason" TEXT;
