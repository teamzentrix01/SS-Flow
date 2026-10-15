import type { Prisma } from "@prisma/client";

import { uuidv7 } from "@/lib/ids";



type Tx = Prisma.TransactionClient;



/** Queue a customer-visible message (email/SMS/WhatsApp) via outbox for async delivery. */

export async function queueCustomerNotification(

  tx: Tx,

  input: {

    plantId: string;

    channel: "email" | "sms" | "whatsapp";

    message: string;

    customerId?: string | null;

    leadId?: string | null;

    salesOrderId?: string | null;

    toEmail?: string | null;

    subject?: string | null;

  },

) {

  const row = await tx.customerNotification.create({

    data: {

      id: uuidv7(),

      plantId: input.plantId,

      leadId: input.leadId ?? null,

      customerId: input.customerId ?? null,

      salesOrderId: input.salesOrderId ?? null,

      channel: input.channel,

      message: input.message,

      status: "pending",

    },

  });

  await tx.outbox.create({

    data: {

      id: uuidv7(),

      type: "customer.notification",

      payload: {

        notificationId: row.id,

        channel: input.channel,

        toEmail: input.toEmail?.trim() || null,

        subject: input.subject?.trim() || null,

      },

    },

  });

  return row.id;

}



export const CUSTOMER_ORDER_STATUS_MESSAGES: Record<string, string> = {

  submitted: "Your order has been received and is under review.",

  material_planning: "We are planning materials for your order.",

  production: "Your order is in production.",

  ready_for_dispatch: "Your order is ready for dispatch.",

  partially_dispatched: "Part of your order has been dispatched.",

  completed: "Your order has been fulfilled. Thank you for choosing SS Metals.",

  cancelled: "Your order was cancelled. Contact us if you have questions.",

};


