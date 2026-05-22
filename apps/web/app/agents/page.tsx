"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBetterDataApiClient } from "@betterdata/api-client";
import type { AgentPricingConfig } from "@betterdata/contracts";
import { useAuth } from "../lib/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const apiClient = createBetterDataApiClient({ baseUrl: API_BASE_URL });

/* ── Icons ── */
const ShieldCheckIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
  </svg>
);

const TrendingDownIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>
);

const UsersIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ZapIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function AgentsPage() {
  const { isAuthenticated, userProfile } = useAuth();
  const [pricing, setPricing] = useState<AgentPricingConfig | null>(null);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [navScrolled, setNavScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = document.documentElement.getAttribute("data-theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await apiClient.getAgentPricingConfig();
        if (active) setPricing(data);
      } catch {
        /* pricing will remain null, page still works */
      } finally {
        if (active) setLoadingPricing(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const isAgent = userProfile?.role === "agent";

  const applyHref = isAgent
    ? "/dashboard/agent"
    : isAuthenticated
      ? "/agents/apply"
      : "/signup?intent=agent";

  return (
    <main>
      {/* ── Navbar ── */}
      <nav className={`navbar${navScrolled ? " scrolled" : ""}`}>
        <div className="nav-inner">
          <Link href="/" className="logo">
            <div className="logo-dot" />
            Better Data
          </Link>
          <div className="nav-actions">
            {isAuthenticated ? (
              <Link href="/dashboard" className="btn btn-primary">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="nav-link">
                  Log In
                </Link>
                <Link href="/signup" className="btn btn-primary">
                  Sign Up
                </Link>
              </>
            )}
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="agent-hero">
        <div className="agent-hero-bg" />
        <div className="container agent-hero-inner">
          <div className="agent-hero-badge">Agent Program</div>
          <h1 className="agent-hero-title">
            Sell data bundles at <span className="accent">better prices</span>
          </h1>
          <p className="agent-hero-desc">
            Join the Better Data agent network to access exclusive discounted rates
            on every data bundle. Serve your community with affordable connectivity
            and grow your business.
          </p>

          {/* Pricing Cards */}
          <div className="agent-pricing-row">
            <div className="agent-pricing-card">
              <div className="agent-pricing-label">Onboarding Fee</div>
              <div className="agent-pricing-value">
                {loadingPricing ? (
                  <span className="agent-pricing-skeleton" />
                ) : pricing ? (
                  <>GHS {pricing.agentOnboardingFeeGhs.toFixed(2)}</>
                ) : (
                  "—"
                )}
              </div>
              <div className="agent-pricing-note">One-time application fee</div>
            </div>
            <div className="agent-pricing-card accent-card">
              <div className="agent-pricing-label">Agent Discount</div>
              <div className="agent-pricing-value">
                {loadingPricing ? (
                  <span className="agent-pricing-skeleton" />
                ) : pricing ? (
                  <>{pricing.agentDiscountPercentage}% off</>
                ) : (
                  "—"
                )}
              </div>
              <div className="agent-pricing-note">On every data purchase</div>
            </div>
          </div>

          <div className="agent-hero-cta">
            <Link href={applyHref} className="btn btn-primary btn-lg">
              {isAgent ? "View Agent Status" : "Apply Now"}
            </Link>
            {!isAuthenticated && (
              <span className="agent-hero-login-hint">
                Already have an account? <Link href="/login">Log in</Link> first.
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="agent-benefits">
        <div className="container">
          <div className="section-header">
            <h2>Why become an agent?</h2>
          </div>
          <div className="agent-benefits-grid">
            <div className="agent-benefit-card">
              <div className="agent-benefit-icon green"><TrendingDownIcon /></div>
              <h3>Discounted Rates</h3>
              <p>
                Buy data at {pricing ? `${pricing.agentDiscountPercentage}%` : "exclusive"} lower
                prices compared to regular users. The more you sell, the more you save.
              </p>
            </div>
            <div className="agent-benefit-card">
              <div className="agent-benefit-icon blue"><ZapIcon /></div>
              <h3>Instant Delivery</h3>
              <p>
                Same lightning-fast delivery as all Better Data purchases. Your
                customers get their data in seconds.
              </p>
            </div>
            <div className="agent-benefit-card">
              <div className="agent-benefit-icon orange"><UsersIcon /></div>
              <h3>Serve Your Community</h3>
              <p>
                Become the go-to data provider in your area. Help students,
                workers, and families stay connected affordably.
              </p>
            </div>
            <div className="agent-benefit-card">
              <div className="agent-benefit-icon purple"><ShieldCheckIcon /></div>
              <h3>Trusted Platform</h3>
              <p>
                Backed by Paystack payments and real-time order tracking. Your
                customers buy with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="agent-steps">
        <div className="container">
          <div className="section-header">
            <span className="overline">How it works</span>
            <h2>Start selling in 3 steps</h2>
          </div>
          <div className="steps-grid">
            {[
              {
                n: "1",
                title: "Apply & Pay",
                desc: `Submit your application with a one-time fee of ${pricing ? `GHS ${pricing.agentOnboardingFeeGhs.toFixed(2)}` : "the onboarding fee"}. This covers your application review.`,
              },
              {
                n: "2",
                title: "Get Approved",
                desc: "Our team reviews your application. Once approved, your account is upgraded to agent status automatically.",
              },
              {
                n: "3",
                title: "Start Selling",
                desc: `Buy data bundles at ${pricing ? `${pricing.agentDiscountPercentage}%` : "discounted"} rates and resell to your community at competitive prices.`,
              },
            ].map((s) => (
              <div key={s.n} className="step-card">
                <div className="step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="container">
        <div className="cta-banner">
          <div className="cta-glow" />
          <h2>Ready to get started?</h2>
          <p>
            Apply today and start offering better data prices to your community.
          </p>
          <Link href={applyHref} className="btn btn-primary btn-lg">
            {isAgent ? "View Agent Status" : "Apply Now"}
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <Link href="/" className="logo">
                <div className="logo-dot" />
                Better Data
              </Link>
              <p>
                The fastest way to buy data bundles in Ghana. No hidden fees,
                instant delivery.
              </p>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Platform</span>
              <Link href="/buy" className="footer-link">Buy Data</Link>
              <Link href="/login" className="footer-link">Log In</Link>
              <Link href="/agents" className="footer-link">Agent Program</Link>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Support</span>
              <Link href="/faq" className="footer-link">FAQs</Link>
              <Link href="/contact" className="footer-link">Contact Us</Link>
            </div>
          </div>
          <div className="footer-bottom">
            &copy; {new Date().getFullYear()} Better Data. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
