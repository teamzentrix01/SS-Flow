export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export function isSmtpConfigured() {
  if (process.env.SMTP_LOG_ONLY === "1") return true;
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

export function smtpConfig(): SmtpConfig | null {
  if (process.env.SMTP_LOG_ONLY === "1") {
    return {
      host: "localhost",
      port: 1025,
      secure: false,
      user: "",
      password: "",
      from: process.env.SMTP_FROM?.trim() || "SS Metals <dev@local>",
    };
  }

  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? "587");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure,
    user: process.env.SMTP_USER?.trim() ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from,
  };
}
