import { deliverPendingCustomerEmails } from "../src/modules/leads/deliver-customer-email";

const result = await deliverPendingCustomerEmails(100);
console.log("Deliver notifications:", result);
process.exit(0);
