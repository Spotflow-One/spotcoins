-- Spotcoin admin bootstrap (run after `prisma migrate deploy`)
--
-- Creates:
--   1. Workspace
--   2. First ADMIN user
--   3. Default positions (optional but useful for invites/recognition)
--
-- Default login:
--   email:    michael@spotflow.one
--   password: password123
--
-- Edit the variables below, then run in Supabase SQL editor (or psql)
-- against the same DATABASE_URL as the app.
--
-- After first login, change the password at /dashboard/settings.

BEGIN;

-- Workspace: Spotflow (ws_spotflow)
-- Admin: michael@spotflow.one / password123

INSERT INTO "Workspace" (
  id,
  name,
  "monthlyAllowance",
  "tokenValueNaira",
  "tokenValueGhs",
  "recognitionSchedule",
  timezone,
  "onboardingComplete",
  "createdAt"
)
VALUES (
  'ws_spotflow',
  'Spotflow',
  5,
  1000,
  0,
  'EVERY_FRIDAY',
  'Africa/Lagos',
  false,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

INSERT INTO "User" (
  id,
  email,
  name,
  "passwordHash",
  role,
  "workspaceId",
  "coinsToGive",
  "spotTokensEarned",
  "payoutStatus",
  "createdAt",
  "deletedAt"
)
VALUES (
  'usr_spotflow_admin',
  'michael@spotflow.one',
  'Michael',
  '$2b$12$6SkfJMu7b7wjY6nBVGmMyOCULuT2TC2sMr2OS80jDcVBcdOgQ/f2e',
  'ADMIN'::"Role",
  'ws_spotflow',
  5,
  0,
  'PENDING'::"PayoutStatus",
  NOW(),
  NULL
)
ON CONFLICT (email) DO UPDATE SET
  name           = EXCLUDED.name,
  "passwordHash" = EXCLUDED."passwordHash",
  role           = 'ADMIN'::"Role",
  "workspaceId"  = EXCLUDED."workspaceId",
  "coinsToGive"  = EXCLUDED."coinsToGive",
  "deletedAt"    = NULL;

INSERT INTO "Position" (id, "workspaceId", name, "isActive", "sortOrder", "createdAt")
VALUES
  ('pos_seed_01', 'ws_spotflow', 'Head of Product', true, 1, NOW()),
  ('pos_seed_02', 'ws_spotflow', 'Head of Engineering', true, 2, NOW()),
  ('pos_seed_03', 'ws_spotflow', 'Frontend Lead', true, 3, NOW()),
  ('pos_seed_04', 'ws_spotflow', 'Backend Lead', true, 4, NOW()),
  ('pos_seed_05', 'ws_spotflow', 'Frontend Developer', true, 5, NOW()),
  ('pos_seed_06', 'ws_spotflow', 'Backend Developer', true, 6, NOW()),
  ('pos_seed_07', 'ws_spotflow', 'Product Designer', true, 7, NOW()),
  ('pos_seed_08', 'ws_spotflow', 'Head of Operations', true, 8, NOW()),
  ('pos_seed_09', 'ws_spotflow', 'Operations', true, 9, NOW()),
  ('pos_seed_10', 'ws_spotflow', 'Marketing', true, 10, NOW()),
  ('pos_seed_11', 'ws_spotflow', 'Product Design Intern', true, 11, NOW()),
  ('pos_seed_12', 'ws_spotflow', 'Intern', true, 12, NOW())
ON CONFLICT ("workspaceId", name) DO NOTHING;

COMMIT;

-- Sanity check:
-- SELECT w.id, w.name, u.email, u.role
-- FROM "Workspace" w
-- JOIN "User" u ON u."workspaceId" = w.id
-- WHERE u.email = 'michael@spotflow.one';
