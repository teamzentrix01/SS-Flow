import nodemailer from "nodemailer";
import { isSmtpConfigured, smtpConfig } from "@/lib/mail/smtp-config";

export async function sendEmail(input: { to: string; subject: string; text: string; html?: string }) {
  const to = input.to.trim();
  if (!to) throw new Error("Missing recipient email.");

  if (process.env.SMTP_LOG_ONLY === "1") {
    console.info("[smtp:log-only]", { to, subject: input.subject, text: input.text });
    return { messageId: "log-only" };
  }

  const config = smtpConfig();
  if (!config) throw new Error("SMTP is not configured.");

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
  });

  const info = await transport.sendMail({
    from: config.from,
    to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? textToHtml(input.text),
  });

  return { messageId: String(info.messageId ?? "") };
}

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;line-height:1.5;white-space:pre-wrap">${escaped}</div>`;
}

export { isSmtpConfigured };
