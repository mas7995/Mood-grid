-- Mood becomes optional (a day can be logged with only habits) and gains a list
-- of activities (habit check-ins) for that day.
ALTER TABLE "entries" ALTER COLUMN "mood" DROP NOT NULL;
ALTER TABLE "entries" ADD COLUMN "activities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
