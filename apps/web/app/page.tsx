"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NETWORK_CODES } from "@betterdata/contracts";

// We register GSAP plugins if needed here (e.g. ScrollTrigger)
// import { ScrollTrigger } from "gsap/ScrollTrigger";
// gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const networksRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    // Hero Animations
    const tl = gsap.timeline();
    tl.fromTo(".hero-elem", 
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "power3.out", delay: 0.2 }
    );
    
    // Simple staggered reveal for networks
    gsap.fromTo(".network-card",
      { y: 40, opacity: 0 },
      { 
        y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: "back.out(1.2)",
        scrollTrigger: {
          trigger: networksRef.current,
          start: "top 80%",
        }
      }
    );

    // Steps animation
    gsap.fromTo(".step-card",
      { x: -30, opacity: 0 },
      {
        x: 0, opacity: 1, duration: 0.6, stagger: 0.2, ease: "power2.out",
        scrollTrigger: {
          trigger: stepsRef.current,
          start: "top 75%",
        }
      }
    );
  }, { scope: heroRef }); // Scope is slightly generalized, but works for the page since we don't have deeply nested components yet. Wait, we should scope to a main container or body, but since it's Next app router, we can wrap the main content in a ref. Let's use a container ref.

  const containerRef = useRef<HTMLElement>(null);
  useGSAP(() => {
    // Actually, scoping to containerRef is better
    const tl = gsap.timeline();
    tl.fromTo(".hero-elem", 
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "power3.out", delay: 0.2 }
    );
  }, { scope: containerRef });

  return (
    <main ref={containerRef}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="container nav-container">
          <Link href="/" className="logo">Better Data</Link>
          <div className="nav-links">
            <Link href="/login" className="nav-link">Log In</Link>
            <Link href="/signup" className="btn btn-primary">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-bg-blob"></div>
        <div className="container">
          <h1 className="hero-title hero-elem">Affordable Data, <br/> Delivered Instantly.</h1>
          <p className="hero-subtitle hero-elem">
            Buy MTN, Telecel, and AirtelTigo bundles quickly with Mobile Money. No account required for quick top-ups.
          </p>
          <div className="hero-actions hero-elem">
            <Link href="/buy" className="btn btn-primary">Buy Data Now</Link>
            <Link href="#how-it-works" className="btn btn-secondary">How it works</Link>
          </div>
        </div>
      </section>

      {/* Supported Networks */}
      <section className="section bg-main">
        <div className="container text-center">
          <h2 className="mb-12">Supported Networks</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" ref={networksRef}>
            {Object.entries(NETWORK_CODES).map(([name, code]) => {
              // Extract the first letter for the icon
              const initial = name.charAt(0);
              return (
                <article key={code} className="network-card">
                  <div className="network-icon">{initial}</div>
                  <span className="network-name">{name}</span>
                  <small className="network-code">{code}</small>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section bg-card">
        <div className="container">
          <div className="text-center mb-16">
            <h2>Fast, simple, reliable</h2>
            <p className="text-muted mt-8">Get your data in three simple steps.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8" ref={stepsRef}>
            <div className="glass-card step-card">
              <div className="step-number">1</div>
              <h3 className="step-title">Select Package</h3>
              <p className="step-desc">Choose your preferred network and the data package you want to purchase.</p>
            </div>
            <div className="glass-card step-card">
              <div className="step-number">2</div>
              <h3 className="step-title">Enter Number</h3>
              <p className="step-desc">Provide the recipient's phone number. Double-check to ensure accuracy!</p>
            </div>
            <div className="glass-card step-card">
              <div className="step-number">3</div>
              <h3 className="step-title">Pay via MoMo</h3>
              <p className="step-desc">Complete payment securely using Mobile Money. The data is credited instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Agent CTA */}
      <section className="container">
        <div className="cta-section">
          <h2 className="cta-title">Want to become an agent?</h2>
          <p className="cta-desc">Join our network of agents, get discounted prices on every package, and track your usage with a dedicated dashboard.</p>
          <Link href="/agents/apply" className="btn btn-outline" style={{ borderColor: 'white', color: 'white' }}>Apply Now</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer container">
        <div className="footer-content">
          <div className="footer-col">
            <Link href="/" className="logo">Better Data</Link>
            <p className="text-muted" style={{ maxWidth: '250px' }}>
              The simplest way to buy data bundles in Ghana.
            </p>
          </div>
          <div className="footer-col">
            <span className="footer-title">Platform</span>
            <Link href="/buy" className="footer-link">Buy Data</Link>
            <Link href="/login" className="footer-link">Log In</Link>
            <Link href="/agents" className="footer-link">Agent Program</Link>
          </div>
          <div className="footer-col">
            <span className="footer-title">Support</span>
            <Link href="/faq" className="footer-link">FAQs</Link>
            <Link href="/contact" className="footer-link">Contact Us</Link>
            <a href="https://wa.me/233000000000" className="footer-link" target="_blank" rel="noopener noreferrer">WhatsApp Support</a>
          </div>
          <div className="footer-col">
            <span className="footer-title">Legal</span>
            <Link href="/terms" className="footer-link">Terms & Conditions</Link>
            <Link href="/privacy" className="footer-link">Privacy Policy</Link>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} Better Data. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
