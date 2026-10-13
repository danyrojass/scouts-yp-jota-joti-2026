-- Ranking general: actividades puntuables y resultados por equipo.
-- Aditivo: no borra ni reinicializa datos existentes.

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDING', 'IN_EVALUATION', 'FINISHED');

-- CreateEnum
CREATE TYPE "ScoringMethod" AS ENUM ('MANUAL', 'CHECKLIST', 'STATIONS');

-- AlterTable: Event — publicacion del ranking general.
ALTER TABLE "Event"
    ADD COLUMN     "rankingPublished" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN     "rankingPublishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "scoringMethod" "ScoringMethod" NOT NULL DEFAULT 'MANUAL',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "allowMaxScoreExceeded" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamActivityScore" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "evaluated" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "evaluatedBy" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamActivityScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_eventId_idx" ON "Activity"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_eventId_name_key" ON "Activity"("eventId", "name");

-- CreateIndex
CREATE INDEX "TeamActivityScore_eventId_idx" ON "TeamActivityScore"("eventId");

-- CreateIndex
CREATE INDEX "TeamActivityScore_activityId_idx" ON "TeamActivityScore"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamActivityScore_teamId_activityId_key" ON "TeamActivityScore"("teamId", "activityId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamActivityScore" ADD CONSTRAINT "TeamActivityScore_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamActivityScore" ADD CONSTRAINT "TeamActivityScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamActivityScore" ADD CONSTRAINT "TeamActivityScore_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
