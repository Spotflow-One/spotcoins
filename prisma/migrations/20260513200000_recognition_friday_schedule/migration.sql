-- Recognition nudges: Monday → Friday schedule tokens
UPDATE "Workspace" SET "recognitionSchedule" = 'EVERY_FRIDAY' WHERE "recognitionSchedule" = 'EVERY_MONDAY';
UPDATE "Workspace" SET "recognitionSchedule" = 'LAST_FRIDAY' WHERE "recognitionSchedule" = 'LAST_MONDAY';
ALTER TABLE "Workspace" ALTER COLUMN "recognitionSchedule" SET DEFAULT 'EVERY_FRIDAY';
