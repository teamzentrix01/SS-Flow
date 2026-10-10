export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function stockError(error: unknown): never {
  if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
    throw new AppError(409, "INSUFFICIENT_STOCK", "Not enough stock in the required state.");
  }
  if (error instanceof Error && error.message === "QTY_INVALID") {
    throw new AppError(400, "QTY_INVALID", "Quantity must be greater than zero.");
  }
  throw error;
}
