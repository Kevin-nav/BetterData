export type EmailType =
  | "welcome"
  | "first_purchase"
  | "wallet_top_up"
  | "agent_application_received"
  | "agent_application_approved"
  | "reengagement";

export interface EmailData {
  displayName?: string | undefined;
  amountGhs?: number | undefined;
  reference?: string | undefined;
  recipientPhone?: string | undefined;
  network?: string | undefined;
}

export function getEmailHtml(type: EmailType, data: EmailData): { subject: string; html: string } {
  const name = data.displayName || "there";
  let subject = "";
  let bodyHtml = "";

  switch (type) {
    case "welcome":
      subject = "Welcome to BetterData! Let's get you connected ⚡";
      bodyHtml = `
        <h1>Welcome to BetterData, ${name}!</h1>
        <p>We are absolutely thrilled to have you join our community. BetterData is designed to keep you connected with the fastest, most affordable data bundles in Ghana.</p>
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h2 style="font-size: 16px; margin-top: 0; color: #0f172a;">Get started in 3 easy steps:</h2>
          <ol style="margin: 0; padding-left: 20px; color: #475569; line-height: 1.6;">
            <li style="margin-bottom: 8px;"><strong>Top Up:</strong> Credit your wallet securely via Mobile Money.</li>
            <li style="margin-bottom: 8px;"><strong>Select Package:</strong> Pick the MTN, Telecel, or AirtelTigo package that fits your needs.</li>
            <li style="margin-bottom: 0;"><strong>Fulfill:</strong> Send data directly to any phone number in seconds.</li>
          </ol>
        </div>
        <p style="text-align: center; margin: 32px 0;">
          <a href="https://betterdatagh.com/dashboard" class="btn">Explore Dashboard</a>
        </p>
      `;
      break;

    case "first_purchase":
      subject = "Congratulations on your first purchase! 🚀";
      const formattedAmount = data.amountGhs ? data.amountGhs.toFixed(2) : "0.00";
      const recipient = data.recipientPhone ? `to ${data.recipientPhone}` : "";
      const netLabel = data.network ? data.network.toUpperCase() : "data";
      bodyHtml = `
        <h1>Congratulations on your first bundle! 🎉</h1>
        <p>Hi ${name}, you just successfully sent your first ${netLabel} bundle ${recipient}! We hope you (or your recipient) enjoy high-speed internet.</p>
        
        <div class="accent-card">
          <p>🎁 You've unlocked our reseller application program! If you buy data frequently, you can apply to become an Agent and enjoy exclusive reseller discount pricing on all packages.</p>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div class="detail-row">
            <span class="detail-label">Order Reference</span>
            <span class="detail-value">${data.reference || "N/A"}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Amount Paid</span>
            <span class="detail-value">GHS ${formattedAmount}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Recipient</span>
            <span class="detail-value">${data.recipientPhone || "N/A"}</span>
          </div>
        </div>

        <p style="text-align: center; margin: 32px 0;">
          <a href="https://betterdatagh.com/agent" class="btn">Become an Agent</a>
        </p>
      `;
      break;

    case "wallet_top_up":
      subject = "Wallet Credited: GHS " + (data.amountGhs ? data.amountGhs.toFixed(2) : "0.00") + " 💰";
      const topUpAmount = data.amountGhs ? data.amountGhs.toFixed(2) : "0.00";
      bodyHtml = `
        <h1>Wallet Successfully Topped Up!</h1>
        <p>Hi ${name}, your payment was verified and your BetterData wallet has been credited.</p>
        
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 14px; color: #166534; display: block; font-weight: 600; text-transform: uppercase;">Amount Credited</span>
          <span style="font-size: 36px; font-weight: 800; color: #15803d; display: block; margin: 8px 0;">GHS ${topUpAmount}</span>
          <span style="font-size: 12px; color: #166534; display: block; font-family: monospace;">Ref: ${data.reference || "N/A"}</span>
        </div>

        <p>Use your wallet balance to buy data instantly at any time without waiting for mobile money OTP requests.</p>

        <p style="text-align: center; margin: 32px 0;">
          <a href="https://betterdatagh.com/dashboard/buy" class="btn">Buy Data Now</a>
        </p>
      `;
      break;

    case "agent_application_received":
      subject = "Agent Application Fee Received 🔎";
      bodyHtml = `
        <h1>We've received your application fee!</h1>
        <p>Hi ${name}, thank you for your application to join the BetterData Agent Reseller program.</p>
        
        <p>Your onboarding fee of <strong>GHS ${data.amountGhs ? data.amountGhs.toFixed(2) : "0.00"}</strong> (Ref: ${data.reference || "N/A"}) has been verified. Your application is now in queue for review by our operations team.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Next Steps:</strong> Approval is usually completed within 2-4 hours during business days. We will review your profile credentials and send you another email as soon as your account gets activated.</p>
        </div>
      `;
      break;

    case "agent_application_approved":
      subject = "Congratulations! Your Agent Status is Approved! 🎉";
      bodyHtml = `
        <h1>Welcome to the BetterData Agent Network! 🚀</h1>
        <p>Congratulations ${name}, your application has been officially approved. Your account role has been upgraded to <strong>Agent</strong>.</p>
        
        <div style="background-color: #e0f2fe; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; color: #0369a1; margin-bottom: 24px;">
          <h3 style="margin-top: 0; font-size: 16px;">What this means for you:</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.6; font-size: 14px;">
            <li><strong>Cheaper Rates:</strong> Exclusive reseller discounts on MTN, Telecel, and AirtelTigo packages.</li>
            <li><strong>Agent Portal:</strong> Track all your customers' transactions in one central portal.</li>
            <li><strong>Priority Support:</strong> Direct routing to our fast reseller support agents.</li>
          </ul>
        </div>

        <p>To access the reseller pricing rates, log out and sign back in to reload your profile permissions.</p>

        <p style="text-align: center; margin: 32px 0;">
          <a href="https://betterdatagh.com/dashboard" class="btn">Go to Agent Dashboard</a>
        </p>
      `;
      break;

    case "reengagement":
      subject = "We miss you! Let's get you connected again 🔋";
      bodyHtml = `
        <h1>It's been a minute, ${name}! 👋</h1>
        <p>We noticed it's been a few weeks since you last topped up your wallet or bought data. We miss keeping you connected!</p>
        
        <p>Data packages are constantly updating with new rates and sizes. Whether you need data for YouTube streaming, Instagram scrolling, or work meetings, we've got you covered with the cheapest rates in Ghana.</p>

        <div style="background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <h3 style="color: #6b21a8; margin-top: 0; font-size: 16px;">⚡ Quick Check-in Bundle Specials</h3>
          <p style="color: #581c87; margin-bottom: 0; font-size: 14px;">Log back in to view MTNGH special gig offers starting at just GHS 3.00!</p>
        </div>

        <p>Let's top up and get connected today!</p>

        <p style="text-align: center; margin: 32px 0;">
          <a href="https://betterdatagh.com/dashboard" class="btn">Claim My Data Offer</a>
        </p>
      `;
      break;
  }

  return {
    subject,
    html: getEmailLayout(bodyHtml)
  };
}

function getEmailLayout(contentHtml: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BetterData</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            padding: 0 20px;
          }
          .card {
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
            padding: 40px;
            border: 1px solid #f1f5f9;
          }
          .logo {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            text-decoration: none;
            letter-spacing: -0.5px;
            display: inline-block;
            margin-bottom: 24px;
          }
          .logo span {
            color: #2563eb;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 0;
            margin-bottom: 16px;
            line-height: 1.3;
          }
          p {
            font-size: 15px;
            line-height: 1.6;
            color: #475569;
            margin-top: 0;
            margin-bottom: 24px;
          }
          .btn {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff !important;
            font-weight: 600;
            font-size: 15px;
            padding: 12px 28px;
            border-radius: 8px;
            text-decoration: none;
            transition: all 0.2s ease;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
            text-align: center;
          }
          .footer {
            margin-top: 32px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            line-height: 1.5;
          }
          .footer a {
            color: #64748b;
            text-decoration: underline;
          }
          .accent-card {
            background-color: #faf5ff;
            border: 1px solid #e9d5ff;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .accent-card p {
            margin: 0;
            color: #6b21a8;
            font-weight: 500;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #64748b;
          }
          .detail-value {
            font-weight: 600;
            color: #0f172a;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <a href="https://betterdatagh.com" class="logo">Better<span>Data</span></a>
            ${contentHtml}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} BetterData. All rights reserved.</p>
            <p>You received this email because you registered on BetterData.<br>
            <a href="https://betterdatagh.com/unsubscribe">Unsubscribe</a> | <a href="https://betterdatagh.com/support">Support</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}
