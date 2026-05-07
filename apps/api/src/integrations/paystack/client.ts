export type PaystackPaymentIntent = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export async function initializeMobileMoneyPayment(): Promise<PaystackPaymentIntent> {
  throw new Error("Paystack Mobile Money initialization is not implemented yet.");
}
