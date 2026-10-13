/** Prisma filter: row not soft-deleted. */
export const notDeleted = { deletedAt: null } as const;

export const CATEGORY_DELETED_STATUS = "deleted" as const;
