import { createConvexHttpClient } from "../../convexClient";
import { getRequiredEnv } from "@betterdata/config";
import { emailsFunctions } from "@betterdata/app-api";
import { getEmailHtml, type EmailType, type EmailData } from "./templates";

export async function sendReceiptEmail(): Promise<void> {
  // Kept for compatibility / future use
  throw new Error("Resend receipt email integration is not implemented yet.");
}

async function sendEmailAndLog(input: {
  userId?: string | undefined;
  email: string;
  type: EmailType;
  data: EmailData;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY environment variable is not defined. Email send skipped.");
    return;
  }

  const { subject, html } = getEmailHtml(input.type, input.data);
  const sender = process.env.RESEND_SENDER_EMAIL ?? "Better Data <noreply@betterdatagh.com>";
  let status: "sent" | "failed" = "sent";
  let errorMessage: string | undefined = undefined;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: sender,
        to: input.email,
        subject: subject,
        html: html,
      }),
    });

    if (!res.ok) {
      status = "failed";
      errorMessage = await res.text();
      console.error(`Failed to send email to ${input.email} via Resend:`, errorMessage);
    }
  } catch (err: any) {
    status = "failed";
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Error sending email to ${input.email}:`, err);
  }

  // Log to Convex
  try {
    const convex = createConvexHttpClient();
    const payload: any = {
      serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
      toEmail: input.email,
      subject,
      type: input.type,
      status,
    };
    if (input.userId !== undefined) {
      payload.userId = input.userId;
    }
    if (errorMessage !== undefined) {
      payload.errorMessage = errorMessage;
    }
    await convex.mutation(emailsFunctions.logSentEmail, payload);
  } catch (convexErr) {
    console.error("Failed to log sent email to Convex:", convexErr);
  }
}

export async function sendWelcomeEmail(input: { userId?: string | undefined; email: string; displayName?: string | undefined }) {
  sendEmailAndLog({
    userId: input.userId,
    email: input.email,
    type: "welcome",
    data: { displayName: input.displayName }
  }).catch(err => console.error("Error in sendWelcomeEmail async wrapper:", err));
}

export async function sendFirstPurchaseEmail(input: {
  userId?: string | undefined;
  email: string;
  displayName?: string | undefined;
  reference: string;
  amountGhs: number;
  recipientPhone: string;
  network: string;
}) {
  sendEmailAndLog({
    userId: input.userId,
    email: input.email,
    type: "first_purchase",
    data: {
      displayName: input.displayName,
      reference: input.reference,
      amountGhs: input.amountGhs,
      recipientPhone: input.recipientPhone,
      network: input.network
    }
  }).catch(err => console.error("Error in sendFirstPurchaseEmail async wrapper:", err));
}

export async function sendWalletTopUpEmail(input: {
  userId?: string | undefined;
  email: string;
  displayName?: string | undefined;
  amountGhs: number;
  reference: string;
}) {
  sendEmailAndLog({
    userId: input.userId,
    email: input.email,
    type: "wallet_top_up",
    data: {
      displayName: input.displayName,
      amountGhs: input.amountGhs,
      reference: input.reference
    }
  }).catch(err => console.error("Error in sendWalletTopUpEmail async wrapper:", err));
}

export async function sendAgentApplicationReceivedEmail(input: {
  userId?: string | undefined;
  email: string;
  displayName?: string | undefined;
  amountGhs: number;
  reference: string;
}) {
  sendEmailAndLog({
    userId: input.userId,
    email: input.email,
    type: "agent_application_received",
    data: {
      displayName: input.displayName,
      amountGhs: input.amountGhs,
      reference: input.reference
    }
  }).catch(err => console.error("Error in sendAgentApplicationReceivedEmail async wrapper:", err));
}

export async function sendAgentApplicationApprovedEmail(input: {
  userId?: string | undefined;
  email: string;
  displayName?: string | undefined;
}) {
  sendEmailAndLog({
    userId: input.userId,
    email: input.email,
    type: "agent_application_approved",
    data: { displayName: input.displayName }
  }).catch(err => console.error("Error in sendAgentApplicationApprovedEmail async wrapper:", err));
}

export async function sendReengagementEmail(input: {
  userId?: string | undefined;
  email: string;
  displayName?: string | undefined;
}) {
  sendEmailAndLog({
    userId: input.userId,
    email: input.email,
    type: "reengagement",
    data: { displayName: input.displayName }
  }).catch(err => console.error("Error in sendReengagementEmail async wrapper:", err));
}

export async function sendBroadcastEmail(
  emails: string[],
  subject: string,
  bodyHtml: string
): Promise<{ successCount: number; failureCount: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not defined.");
  }

  const sender = process.env.RESEND_SENDER_EMAIL ?? "Better Data <noreply@betterdatagh.com>";
  let successCount = 0;
  let failureCount = 0;

  // Send individually for privacy (so users don't see other recipients)
  const sendPromises = emails.map(async (email) => {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: sender,
          to: email,
          subject: subject,
          html: bodyHtml,
        }),
      });

      if (res.ok) {
        successCount++;
        // Log to Convex
        try {
          const convex = createConvexHttpClient();
          await convex.mutation(emailsFunctions.logSentEmail, {
            serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
            toEmail: email,
            subject: subject,
            type: "broadcast",
            status: "sent"
          });
        } catch (convexErr) {
          console.error("Convex log failed for broadcast email:", convexErr);
        }
      } else {
        const errorText = await res.text();
        console.error(`Failed to send email to ${email} via Resend:`, errorText);
        failureCount++;
        // Log failure to Convex
        try {
          const convex = createConvexHttpClient();
          await convex.mutation(emailsFunctions.logSentEmail, {
            serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
            toEmail: email,
            subject: subject,
            type: "broadcast",
            status: "failed",
            errorMessage: errorText
          });
        } catch (convexErr) {
          console.error("Convex log failed for failed broadcast email:", convexErr);
        }
      }
    } catch (err) {
      console.error(`Error sending email to ${email}:`, err);
      failureCount++;
      // Log failure to Convex
      try {
        const convex = createConvexHttpClient();
        await convex.mutation(emailsFunctions.logSentEmail, {
          serviceSecret: getRequiredEnv("BETTERDATA_SERVICE_SECRET"),
          toEmail: email,
          subject: subject,
          type: "broadcast",
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      } catch (convexErr) {
        console.error("Convex log failed for errored broadcast email:", convexErr);
      }
    }
  });

  // Run all sending operations
  await Promise.all(sendPromises);

  return { successCount, failureCount };
}
