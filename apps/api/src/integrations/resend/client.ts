export async function sendReceiptEmail(): Promise<void> {
  // Kept for compatibility / future use
  throw new Error("Resend receipt email integration is not implemented yet.");
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
      } else {
        const errorText = await res.text();
        console.error(`Failed to send email to ${email} via Resend:`, errorText);
        failureCount++;
      }
    } catch (err) {
      console.error(`Error sending email to ${email}:`, err);
      failureCount++;
    }
  });

  // Run all sending operations
  await Promise.all(sendPromises);

  return { successCount, failureCount };
}
