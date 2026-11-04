-- Prisma Migrate uses advisory lock id 72707369. Stale sessions (e.g. crashed migrate or pooler) can block deploy.
SELECT pg_terminate_backend(l.pid)
FROM pg_locks l
WHERE l.locktype = 'advisory'
  AND l.objid = 72707369
  AND l.granted = true
  AND l.pid <> pg_backend_pid();
