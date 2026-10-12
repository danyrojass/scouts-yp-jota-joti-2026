-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Safari" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Safari de Exploración',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Safari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafariItem" (
    "id" TEXT NOT NULL,
    "safariId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafariItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafariFind" (
    "id" TEXT NOT NULL,
    "safariId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafariFind_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Safari_eventId_key" ON "Safari"("eventId");

-- CreateIndex
CREATE INDEX "Safari_eventId_idx" ON "Safari"("eventId");

-- CreateIndex
CREATE INDEX "SafariItem_safariId_idx" ON "SafariItem"("safariId");

-- CreateIndex
CREATE INDEX "SafariFind_teamId_idx" ON "SafariFind"("teamId");

-- CreateIndex
CREATE INDEX "SafariFind_safariId_idx" ON "SafariFind"("safariId");

-- CreateIndex
CREATE INDEX "SafariFind_eventId_idx" ON "SafariFind"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SafariFind_itemId_teamId_key" ON "SafariFind"("itemId", "teamId");

-- AddForeignKey
ALTER TABLE "Safari" ADD CONSTRAINT "Safari_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafariItem" ADD CONSTRAINT "SafariItem_safariId_fkey" FOREIGN KEY ("safariId") REFERENCES "Safari"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafariFind" ADD CONSTRAINT "SafariFind_safariId_fkey" FOREIGN KEY ("safariId") REFERENCES "Safari"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafariFind" ADD CONSTRAINT "SafariFind_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SafariItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafariFind" ADD CONSTRAINT "SafariFind_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafariFind" ADD CONSTRAINT "SafariFind_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
