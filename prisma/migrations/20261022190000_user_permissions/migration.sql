CREATE TABLE "user_permissions" (
  "user_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id","permission_id")
);

ALTER TABLE "user_permissions"
ADD CONSTRAINT "user_permissions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions"
ADD CONSTRAINT "user_permissions_permission_id_fkey"
FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "role_permissions"
WHERE "role_id" = (SELECT "id" FROM "roles" WHERE "code" = 'employee')
  AND "permission_id" NOT IN (
    SELECT "id" FROM "permissions" WHERE "code" IN ('dashboard.view', 'job.execute', 'material.request')
  );

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'employee'
  AND p."code" IN ('dashboard.view', 'job.execute', 'material.request')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
