import type { Prisma } from "@prisma/client";

/** Postgres schema from DATABASE_URL (`?schema=ss_flow`), default `public`. */
export function pgSchemaFromEnv() {
  const url = process.env.DATABASE_URL ?? "";
  const match = url.match(/[?&]schema=([^&]+)/i);
  const raw = match?.[1] ? decodeURIComponent(match[1]) : "public";
  return raw.replace(/"/g, "");
}

/** Raw SQL in Prisma does not inherit the ORM schema — set search_path for the transaction. */
export async function setLocalPgSchema(tx: { $executeRawUnsafe: (query: string) => Promise<number> }) {
  const schema = pgSchemaFromEnv();
  await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
}

export type RawCapableTx = {
  $executeRawUnsafe: (query: string) => Promise<number>;
  $queryRaw: Prisma.TransactionClient["$queryRaw"];
};

export async function withPgSchema<T>(tx: RawCapableTx, run: () => Promise<T>) {
  await setLocalPgSchema(tx);
  return run();
}
