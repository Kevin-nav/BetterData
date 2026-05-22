import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal, Privacy Policy, and Terms",
  description:
    "Read Better Data's terms and conditions, privacy policy, cookie notice, refund guidance, and platform rules for mobile data bundle purchases in Ghana.",
  alternates: {
    canonical: "/legal",
  },
  openGraph: {
    type: "article",
    url: "/legal",
    title: "Legal, Privacy Policy, and Terms | Better Data",
    description:
      "Better Data legal information for Ghana mobile data bundle purchases, including terms, privacy, cookies, payments, refunds, and support.",
    siteName: "Better Data",
  },
  twitter: {
    card: "summary",
    title: "Legal, Privacy Policy, and Terms | Better Data",
    description:
      "Better Data terms, privacy, cookies, payments, refunds, and support information.",
  },
};

const lastUpdated = "May 7, 2026";

export default function LegalPage() {
  return (
    <main className="legal-page">
      <nav className="navbar scrolled">
        <div className="nav-inner">
          <Link href="/" className="logo">
            <div className="logo-dot" />
            Better Data
          </Link>
          <div className="nav-actions">
            <Link href="/" className="nav-link">Home</Link>
            <Link href="/buy" className="btn btn-primary">Buy Data</Link>
          </div>
        </div>
      </nav>

      <section className="legal-hero">
        <div className="container legal-hero-inner">
          <span className="overline">Legal</span>
          <h1>Terms, Privacy Policy, and Cookie Notice</h1>
          <p>
            This page is a working legal draft for Better Data. It should be
            reviewed and approved by a qualified legal professional before
            publication or reliance.
          </p>
          <div className="legal-meta">
            <span>Last updated: {lastUpdated}</span>
            <span>Website: betterdatagh.com</span>
          </div>
        </div>
      </section>

      <section className="container legal-layout">
        <aside className="legal-toc" aria-label="Legal page sections">
          <a href="#terms">Terms and Conditions</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#cookies">Cookie Notice</a>
          <a href="#contact">Contact</a>
        </aside>

        <article className="legal-content">
          <section id="terms">
            <h2>Terms and Conditions</h2>
            <p>
              These Terms and Conditions govern your access to and use of
              Better Data, including our website, mobile applications, wallet,
              agent services, support channels, and related services. By using
              Better Data, you agree to these Terms.
            </p>

            <h3>1. About Better Data</h3>
            <p>
              Better Data is a Ghana-focused mobile data bundle reseller. We
              allow customers to purchase data bundles for supported mobile
              networks, currently MTN, Telecel, and AirtelTigo. Data bundle
              fulfillment is provided through third-party data vendor
              infrastructure. Payments are processed through Paystack and
              supported Mobile Money channels.
            </p>

            <h3>2. Eligibility and Accounts</h3>
            <p>
              You may buy data as a guest or as a registered user. Registered
              users may access additional features, including saved numbers,
              wallet payments, transaction history, and receipt requests. You
              are responsible for keeping your account credentials secure and
              for all activity under your account.
            </p>
            <p>
              We may refuse, suspend, or terminate access where we reasonably
              believe an account is fraudulent, abusive, unlawful, or used to
              bypass platform rules, discounts, security controls, or payment
              checks.
            </p>

            <h3>3. Guest Purchases</h3>
            <p>
              Guest users can purchase data without creating an account. If
              there is an issue with a guest order, Better Data may use the
              phone number or payment contact details received through Paystack
              to contact the customer and resolve the issue.
            </p>

            <h3>4. Recipient Numbers and Wrong-Number Purchases</h3>
            <p>
              You may buy data for yourself or for another person. Before
              confirming a purchase, you must carefully review the selected
              network, data package, and recipient phone number.
            </p>
            <p>
              Sending data to a wrong number is your responsibility. Once a
              valid order is submitted for fulfillment, Better Data may be
              unable to reverse, cancel, recover, or refund the bundle if the
              recipient number or selected network was entered incorrectly by
              you.
            </p>

            <h3>5. Prices, Availability, and Promotions</h3>
            <p>
              Package prices and availability may change at any time based on
              supplier availability, network conditions, platform pricing rules,
              discounts, promotions, or administrative updates. We may correct
              pricing errors, withdraw packages, or refuse transactions affected
              by obvious errors or suspected abuse.
            </p>
            <p>
              First-time discounts, agent discounts, and promotional offers are
              subject to eligibility rules and may be changed, suspended, or
              withdrawn at our discretion. We may use reasonable fraud
              prevention methods, including device and account signals, to
              prevent abuse of discounts.
            </p>

            <h3>6. Payments</h3>
            <p>
              Payments are processed by Paystack or other payment providers we
              may support. By making a payment, you authorize the relevant
              payment provider and Better Data to process the transaction. We
              are not responsible for delays, failures, fees, reversals, or
              errors caused by your payment provider, Mobile Money provider,
              bank, network operator, or incorrect payment details.
            </p>

            <h3>7. Wallet</h3>
            <p>
              Registered users and agents may fund a Better Data wallet using
              supported payment methods. Wallet balances may be used only for
              eligible Better Data purchases unless we expressly state
              otherwise. Wallet top-ups may be subject to a minimum top-up
              amount and other limits.
            </p>
            <p>
              Refunds for failed paid orders may be credited to your Better
              Data wallet. Wallet credits are not a bank account, savings
              account, deposit account, or stored-value product unless required
              by applicable law. We may correct wallet balances affected by
              technical errors, duplicate credits, chargebacks, suspected fraud,
              or administrative mistakes.
            </p>

            <h3>8. Order Fulfillment and Delivery</h3>
            <p>
              After payment, Better Data submits eligible orders for data
              fulfillment through our suppliers. Most orders are expected to
              complete quickly, but delivery times can vary due to payment
              confirmation, supplier availability, network operator processing,
              system maintenance, incorrect order details, or connectivity
              issues.
            </p>
            <p>
              Order statuses may include pending, processing, completed,
              failed, and refunded. A completed status means the order has been
              accepted or marked complete by the fulfillment process. You should
              contact support if the recipient does not receive the expected
              bundle after a reasonable period.
            </p>

            <h3>9. Failed Orders and Refunds</h3>
            <p>
              If an order fails after payment and the failure is confirmed by
              Better Data or our supplier, we may issue a refund to your Better
              Data wallet or handle the matter case by case for guest users.
              Refund timing depends on the nature of the failure, supplier
              confirmation, payment provider processing, and any investigation
              needed.
            </p>
            <p>
              We generally do not provide refunds for successful orders,
              wrong-number orders, incorrect network selections, customer
              mistakes, or circumstances outside our reasonable control.
            </p>

            <h3>10. Agents</h3>
            <p>
              Approved agents may receive discounted prices, wallet access,
              dashboard features, receipts, and transaction reporting. Agent
              participation may require a one-time onboarding fee and
              administrative approval. We may approve, reject, suspend, or
              terminate agent access where necessary to protect customers, the
              platform, suppliers, or payment systems.
            </p>
            <p>
              Agents are responsible for their own customer relationships,
              representations, pricing, records, tax obligations, and compliance
              with applicable law, unless a written agreement with Better Data
              states otherwise.
            </p>

            <h3>11. Acceptable Use</h3>
            <p>
              You must not use Better Data for unlawful activity, fraud,
              unauthorized resale, abuse of promotions, payment manipulation,
              interference with our systems, unauthorized access, scraping, or
              any activity that harms Better Data, users, suppliers, networks,
              or payment providers.
            </p>

            <h3>12. Third-Party Services</h3>
            <p>
              Better Data relies on third-party services, including Firebase
              Auth, Paystack, Resend, data vendors, mobile network operators, and
              other infrastructure providers. Their services may be subject to
              their own terms, privacy notices, limits, downtime, and errors.
              Better Data is not responsible for third-party systems outside
              our reasonable control.
            </p>

            <h3>13. Communications</h3>
            <p>
              We may contact you through in-app messages, email, push
              notifications, WhatsApp, phone, or payment contact details for
              order updates, receipts, support, account alerts, security,
              promotions, and service announcements. You may opt out of
              marketing communications where required by law, but we may still
              send transactional or service-related messages.
            </p>

            <h3>14. Service Changes and Availability</h3>
            <p>
              We may update, suspend, limit, or discontinue any part of Better
              Data at any time. We do not guarantee uninterrupted access,
              continuous package availability, or error-free operation.
            </p>

            <h3>15. Disclaimers and Limitation of Liability</h3>
            <p>
              Better Data is provided on an "as is" and "as available" basis.
              To the maximum extent permitted by applicable law, we disclaim
              warranties of uninterrupted service, merchantability, fitness for
              a particular purpose, and non-infringement.
            </p>
            <p>
              To the maximum extent permitted by applicable law, Better Data
              will not be liable for indirect, incidental, special,
              consequential, exemplary, or punitive damages, loss of profits,
              loss of data, loss of business, third-party service failures,
              network operator issues, or customer entry errors. Our total
              liability for a transaction will not exceed the amount you paid
              for the affected transaction, unless applicable law requires
              otherwise.
            </p>

            <h3>16. Changes to These Terms</h3>
            <p>
              We may update these Terms from time to time. The updated version
              will be posted on this page with a revised "Last updated" date.
              Continued use of Better Data after changes means you accept the
              updated Terms.
            </p>
          </section>

          <section id="privacy">
            <h2>Privacy Policy</h2>
            <p>
              This Privacy Policy explains how Better Data collects, uses,
              shares, and protects personal information when you use our
              services.
            </p>

            <h3>1. Information We Collect</h3>
            <p>We may collect the following categories of information:</p>
            <ul>
              <li>Account details, such as name, email address, password authentication status, and Google Sign-In profile information.</li>
              <li>Contact details, such as phone numbers, recipient numbers, saved numbers, WhatsApp contact details, and support email details.</li>
              <li>Transaction details, such as selected network, data package, amount paid, order reference, payment status, wallet activity, receipts, and refund history.</li>
              <li>Payment-related details received from payment providers, such as payment reference, Mobile Money phone number, payment channel, and payment status.</li>
              <li>Device and technical information, such as IP address, browser type, device identifiers, session data, analytics events, and fraud prevention signals.</li>
              <li>Support and communication records, including messages sent through in-app support, email, WhatsApp, or other support channels.</li>
            </ul>

            <h3>2. How We Use Information</h3>
            <p>We use personal information to:</p>
            <ul>
              <li>Process data bundle purchases, wallet top-ups, refunds, and receipts.</li>
              <li>Create and manage accounts, saved numbers, user history, and agent dashboards.</li>
              <li>Verify payments, prevent fraud, enforce discount eligibility, and secure the platform.</li>
              <li>Provide customer support and contact users about order issues.</li>
              <li>Send service updates, transaction messages, announcements, promotions, and account alerts.</li>
              <li>Monitor performance, debug issues, improve the service, and comply with legal obligations.</li>
            </ul>

            <h3>3. Device Fingerprinting and Fraud Prevention</h3>
            <p>
              We may use device fingerprinting, account signals, transaction
              patterns, IP information, and similar security measures to detect
              fraud, prevent multiple-account abuse, protect first-time
              discounts, and maintain platform integrity.
            </p>

            <h3>4. How We Share Information</h3>
            <p>
              We may share information with trusted service providers where
              needed to operate Better Data, including payment processors,
              authentication providers, email providers, cloud infrastructure,
              analytics providers, fraud prevention providers, fulfillment
              providers, mobile network-related suppliers, and professional
              advisers.
            </p>
            <p>
              We may also share information where required to comply with law,
              enforce our terms, prevent fraud, protect rights and safety, or
              complete a business transfer such as a merger, acquisition, or
              sale of assets.
            </p>

            <h3>5. Data Retention</h3>
            <p>
              We keep personal information for as long as reasonably necessary
              to provide the service, maintain transaction records, resolve
              disputes, prevent fraud, comply with legal obligations, and
              enforce our agreements. Retention periods may vary by data type
              and legal requirement.
            </p>

            <h3>6. Security</h3>
            <p>
              We use reasonable technical and organizational measures designed
              to protect personal information. No online service can guarantee
              absolute security, and you are responsible for keeping your login
              credentials and devices secure.
            </p>

            <h3>7. Your Choices and Rights</h3>
            <p>
              Depending on applicable law, you may have rights to access,
              correct, delete, restrict, or object to certain processing of your
              personal information. You may also request information about how
              your data is used. Some information may need to be retained for
              transaction, fraud prevention, legal, or accounting reasons.
            </p>

            <h3>8. Children</h3>
            <p>
              Better Data is not intended for children who cannot legally
              consent to use online services or make payments. If we learn that
              we collected personal information from a child without required
              consent, we will take appropriate steps to delete or restrict it.
            </p>

            <h3>9. International Processing</h3>
            <p>
              Our service providers may process information in Ghana or other
              countries. Where required, we will take appropriate steps to
              protect personal information when it is transferred or processed
              outside its original location.
            </p>
          </section>

          <section id="cookies">
            <h2>Cookie Notice</h2>
            <p>
              Better Data may use cookies, local storage, pixels, SDK storage,
              and similar technologies on our website and apps. These
              technologies help us keep the service secure, remember
              preferences, support login sessions, measure usage, improve
              performance, and prevent fraud.
            </p>

            <h3>Types of Cookies and Similar Technologies</h3>
            <ul>
              <li>Essential technologies that enable login, checkout, payment routing, security, fraud prevention, and core platform features.</li>
              <li>Preference technologies that remember settings such as saved choices, interface preferences, and consent selections.</li>
              <li>Analytics technologies that help us understand usage, diagnose issues, and improve performance.</li>
              <li>Marketing technologies that may help us measure campaigns, show promotions, or understand the effectiveness of announcements.</li>
            </ul>

            <h3>Your Choices</h3>
            <p>
              You can control cookies through your browser settings. Blocking
              some technologies may affect account access, checkout, payment
              processing, fraud prevention, saved preferences, and other
              features. Where required by law, we will provide additional
              consent controls for non-essential cookies.
            </p>
          </section>

          <section id="contact">
            <h2>Contact</h2>
            <p>
              For legal, privacy, support, refund, or account questions, contact
              Better Data through the support email, in-app support channel, or
              WhatsApp support link shown on the website or mobile app.
            </p>
            <p className="legal-review-note">
              Professional review note: counsel should confirm the correct
              legal entity name, registered address, governing law, dispute
              resolution venue, consumer refund obligations, tax wording,
              payment compliance, Ghana Data Protection Act requirements, and
              cookie consent requirements before publication.
            </p>
          </section>
        </article>
      </section>
    </main>
  );
}
