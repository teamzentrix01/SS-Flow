import { prisma } from "@/db";
import { queueCustomerNotification } from "@/modules/leads/customer-notify";
import { deliverCustomerNotificationById } from "@/modules/leads/deliver-customer-email";
import type { LeadStatus } from "@/modules/leads/status";

const LEAD_STATUS_CUSTOMER_MESSAGES: Partial<Record<LeadStatus, string>> = {
  NEW: "We have received your enquiry and will contact you soon.",
  CONTACTED: "Our team has reviewed your enquiry and will follow up with you.",
  FOLLOW_UP: "We are following up on your enquiry.",
  VERIFICATION_PENDING: "We are verifying the details of your enquiry.",
  VERIFIED: "Your enquiry has been verified. We will share quotation details next.",
  QUOTATION_SENT: "We have sent a quotation for your enquiry. Please check your email or expect a call from us.",
  CONVERTED: "Your enquiry has been converted to a sales order. Thank you for choosing SS Metals.",
  ON_HOLD: "Your enquiry is on hold. We will update you when it moves forward.",
  LOST: "We could not proceed with this enquiry at this time. Contact us if you would like to discuss further.",
  REJECTED: "We are unable to fulfil this enquiry. Contact us if you have questions.",
};

export function leadEmailSubject(leadNumber: string, hint?: string) {
  const suffix = hint ? ` — ${hint}` : "";
  return `SS Metals enquiry ${leadNumber}${suffix}`;
}

export function leadReceivedEmailBody(customerName: string, leadNumber: string) {
  return (
    `Dear ${customerName},\n\n` +
    `Thank you for contacting SS Metals. We have received your enquiry ${leadNumber}.\n` +
    `Our sales team will review it and get back to you shortly.\n\n` +
    `Regards,\nSS Metals`
  );
}

export function leadStatusEmailBody(customerName: string, leadNumber: string, status: LeadStatus) {
  const line =
    LEAD_STATUS_CUSTOMER_MESSAGES[status] ??
    `Your enquiry status is now ${status.replaceAll("_", " ").toLowerCase()}.`;
  return `Dear ${customerName},\n\n${line}\n\nReference: ${leadNumber}\n\nRegards,\nSS Metals`;
}

/** Queue email to the lead's address and send when SMTP is configured. */
export async function notifyLeadByEmail(input: {
  plantId: string;
  leadId: string;
  toEmail: string;
  subject: string;
  message: string;
}) {
  const toEmail = input.toEmail.trim();
  if (!toEmail) return null;

  const notificationId = await prisma.$transaction(async (tx) =>
    queueCustomerNotification(tx, {
      plantId: input.plantId,
      leadId: input.leadId,
      channel: "email",
      message: input.message,
      toEmail,
      subject: input.subject,
    }),
  );

  void deliverCustomerNotificationById(notificationId).catch((error) =>
    console.error("[lead.email.deliver]", notificationId, error),
  );

  return notificationId;
}

export async function notifyLeadStatusEmail(
  lead: { id: string; plantId: string; leadNumber: string; customerName: string; email: string | null },
  status: LeadStatus,
) {
  const toEmail = lead.email?.trim();
  if (!toEmail) return null;
  return notifyLeadByEmail({
    plantId: lead.plantId,
    leadId: lead.id,
    toEmail,
    subject: leadEmailSubject(lead.leadNumber, "status update"),
    message: leadStatusEmailBody(lead.customerName, lead.leadNumber, status),
  });
}
