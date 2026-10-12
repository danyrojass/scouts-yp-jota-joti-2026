-- Optional per-team bonus question shown instead of the station's default
-- challenge. Nullable, so existing rows are unaffected.
ALTER TABLE "RouteStop" ADD COLUMN "question" TEXT;
ALTER TABLE "RouteStop" ADD COLUMN "questionAnswer" TEXT;
