"use client";

import { createBetterDataApiClient } from "@betterdata/api-client";
import type {
  CreatePaymentIntentResponse,
  DataPackage,
} from "@betterdata/contracts";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAuth } from "./lib/AuthContext";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/* ── Network logos (inline SVG) ── */
const MtnLogo = () => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="50" cy="50" rx="45" ry="35" fill="#ffcc00" />
    <text
      x="50"
      y="58"
      fontFamily="var(--font-display), system-ui"
      fontSize="24"
      fontWeight="800"
      fill="#000"
      textAnchor="middle"
    >
      MTN
    </text>
  </svg>
);

const TelecelLogo = () => (
  <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M48.19 28.6833C40.4333 28.605 34.1983 34.9933 34.2183 42.58C34.2383 50.625 40.9883 56.56 48.0333 56.4317C55.5033 56.5017 61.8867 50.53 61.9517 42.7583C62.02 34.62 55.575 28.76 48.19 28.6833ZM53.7333 38.1633C53.6017 39.2783 52.9467 39.9367 51.93 40.29C51.3683 40.4867 50.7833 40.4917 50.195 40.4917C49.8333 40.49 49.4683 40.46 49.1067 40.5183C48.8467 40.5617 48.7033 40.6917 48.6667 40.97C48.6133 41.3467 48.6917 41.7133 48.6883 42.085C48.6867 43.6083 48.6883 45.135 48.6867 46.6583C48.6867 46.9117 48.7133 47.1617 48.7667 47.4067C48.9833 48.3783 49.7917 48.955 50.7817 48.8333C51.5417 48.7383 52.31 48.7333 53.0733 48.6683C53.3933 48.6417 53.495 48.7833 53.4717 49.1233C53.435 49.6333 53.4383 50.1433 53.47 50.655C53.535 51.715 53.0383 52.4717 52.1333 52.8467C49.6867 53.8583 47.2717 53.835 45.065 52.2417C43.8517 51.3667 43.2033 50.115 43.1333 48.57C43.0467 46.585 43.0117 44.6 42.9517 42.6117C42.8883 40.605 42.9083 38.5967 42.9233 36.59C42.9333 35.2433 43.5583 34.15 44.5517 33.265C45.1033 32.7717 45.7183 32.37 46.3867 32.05C46.9933 31.7583 47.6283 31.6483 48.295 31.6583C48.5333 31.6633 48.6233 31.7533 48.6467 31.9983C48.7117 32.6333 48.68 33.27 48.6933 33.8517C48.6933 34.3667 48.6883 34.8317 48.6933 35.295C48.695 35.6983 48.8383 35.845 49.2467 35.905C49.5283 35.9483 49.8083 35.9117 50.09 35.91C51.06 35.8983 52.0267 35.8983 52.9967 35.905C53.5683 35.9117 53.745 36.0867 53.7283 36.6517C53.7117 37.1567 53.7967 37.655 53.7383 38.1633H53.7333Z"
      fill="#E32526"
    />
    <path
      d="M48.665 40.9682C48.6117 41.3448 48.69 41.7115 48.6867 42.0832C48.685 43.6065 48.6867 45.1332 48.685 46.6565C48.685 46.9098 48.7117 47.1598 48.765 47.4048C48.9817 48.3765 49.79 48.9532 50.78 48.8315C51.54 48.7365 52.3083 48.7315 53.0717 48.6665C53.3917 48.6398 53.4933 48.7815 53.47 49.1215C53.4333 49.6315 53.4367 50.1415 53.4683 50.6532C53.5333 51.7132 53.0367 52.4698 52.1317 52.8448C49.685 53.8565 47.27 53.8332 45.0633 52.2398C43.85 51.3648 43.2017 50.1132 43.1317 48.5682C43.045 46.5832 43.01 44.5982 42.95 42.6098C42.8867 40.6032 42.9067 38.5948 42.9217 36.5882C42.9317 35.2415 43.5567 34.1482 44.55 33.2632C45.1017 32.7698 45.7167 32.3682 46.385 32.0482C46.9917 31.7565 47.6267 31.6465 48.2933 31.6565C48.5317 31.6615 48.6217 31.7515 48.645 31.9965C48.71 32.6315 48.6783 33.2682 48.6917 33.8498C48.6917 34.3648 48.6867 34.8298 48.6917 35.2932C48.6933 35.6965 48.8367 35.8432 49.245 35.9032C49.5267 35.9465 49.8067 35.9098 50.0883 35.9082C51.0583 35.8965 52.025 35.8965 52.995 35.9032C53.5667 35.9098 53.7433 36.0848 53.7267 36.6498C53.71 37.1548 53.795 37.6532 53.7367 38.1615C53.605 39.2765 52.95 39.9348 51.9333 40.2882C51.3717 40.4848 50.7867 40.4898 50.1983 40.4898C49.8367 40.4882 49.4717 40.4582 49.11 40.5165C48.85 40.5598 48.7067 40.6898 48.67 40.9682H48.665Z"
      fill="white"
    />
    <path
      d="M70.9433 70.5166C71.8283 70.5349 72.85 70.4083 73.8167 69.9666C74.0517 69.8599 74.095 70.0383 74.1267 70.2033C74.3217 71.2116 73.8183 72.2516 72.8967 72.7549C72.3033 73.0783 71.6683 73.2699 71.0017 73.3399C69.615 73.4849 68.2483 73.4349 66.9383 72.7683C65.1283 71.8466 64.0567 69.9249 64.0633 67.8933C64.0667 66.6599 64.28 65.4816 64.9467 64.4166C66.0317 62.6799 67.5983 61.7616 69.6617 61.7199C71.1217 61.6899 72.4267 62.0933 73.5367 63.0666C74.8583 64.2249 75.09 65.7916 74.6033 67.3466C74.4033 67.9833 73.8433 68.3166 73.2183 68.5099C72.47 68.7416 71.6883 68.7583 70.9183 68.8349C70.015 68.9233 69.1133 69.0016 68.2033 68.9616C67.935 68.9499 67.8733 69.0499 67.98 69.3033C68.2633 69.9816 68.8167 70.3099 69.51 70.4416C69.9283 70.5216 70.3533 70.5083 70.9417 70.5149L70.9433 70.5166ZM68.89 66.4616C69.4833 66.4733 70.0717 66.4183 70.655 66.3199C71.2383 66.2216 71.4667 65.7283 71.11 65.2499C70.9167 64.9916 70.6767 64.7849 70.3667 64.6849C69.0417 64.2533 68.0983 65.1316 67.82 66.1966C67.77 66.3866 67.8717 66.4583 68.0433 66.4599C68.325 66.4616 68.6083 66.4599 68.89 66.4599V66.4616Z"
      fill="#E32526"
    />
    <path
      d="M48.0433 70.5134C49.0933 70.5234 50.0467 70.4 50.9367 69.9634C51.1717 69.8484 51.215 69.9734 51.2467 70.1584C51.4433 71.315 50.9167 72.3417 49.8533 72.8534C49.285 73.1267 48.6817 73.29 48.055 73.3484C46.8083 73.4634 45.58 73.435 44.4033 72.9217C42.665 72.1617 41.625 70.8284 41.2933 68.9917C40.94 67.035 41.3133 65.205 42.6217 63.655C43.6533 62.4334 44.98 61.7584 46.605 61.73C47.8717 61.7084 49.0817 61.9117 50.1433 62.655C51.55 63.64 52.1317 64.9984 51.9217 66.6734C51.8133 67.5334 51.1867 68.25 50.3483 68.47C49.2783 68.75 48.1767 68.82 47.085 68.96C46.5317 69.0317 45.9717 69.025 45.4167 68.9717C45.03 68.935 44.965 69.0434 45.1167 69.395C45.3083 69.8434 45.65 70.1167 46.1117 70.2534C46.765 70.4467 47.43 70.54 48.0417 70.5167L48.0433 70.5134ZM45.5433 66.5067C46.1833 66.4284 46.9417 66.4734 47.6883 66.3367C48.0283 66.275 48.2983 66.1067 48.3833 65.7517C48.47 65.3934 48.2483 65.1567 47.995 64.96C46.9733 64.1717 45.3933 64.6667 44.9983 65.8934C44.8117 66.4734 44.8417 66.5167 45.545 66.5067H45.5433Z"
      fill="#E32526"
    />
    <path
      d="M28.1983 70.5149C29.15 70.5399 30.1833 70.4099 31.16 69.9665C31.36 69.8765 31.4267 69.9749 31.4667 70.1599C31.6817 71.1849 31.18 72.2516 30.2367 72.7666C29.5967 73.1166 28.905 73.2849 28.1833 73.3432C26.9467 73.4432 25.7283 73.4249 24.565 72.8866C22.5983 71.9732 21.6 70.4182 21.4417 68.2849C21.37 67.3299 21.42 66.3849 21.7833 65.4882C22.5633 63.5632 23.8583 62.1965 25.98 61.8265C27.4233 61.5749 28.825 61.7316 30.1267 62.4949C31.1017 63.0666 31.7883 64.0415 32.0283 65.1449C32.475 67.1982 31.7883 68.1632 30.5167 68.5149C29.8233 68.7066 29.105 68.7449 28.3933 68.8199C27.7817 68.8849 27.17 68.9416 26.5583 69.0016C26.215 69.0349 25.8733 68.9749 25.5317 68.9599C25.3033 68.9499 25.24 69.0565 25.325 69.2632C25.6017 69.9399 26.12 70.3082 26.8233 70.4432C27.2417 70.5232 27.6667 70.5115 28.1983 70.5149ZM25.6117 66.5082C26.355 66.4649 27.1 66.4316 27.8417 66.3716C28.1667 66.3449 28.5033 66.2699 28.61 65.8932C28.7167 65.5165 28.5383 65.2315 28.26 64.9932C27.4017 64.2615 25.6317 64.5049 25.2083 65.9316C25.045 66.4832 25.0483 66.5166 25.6133 66.5066L25.6117 66.5082Z"
      fill="#E32526"
    />
    <path
      d="M18.7266 61.7868C19.07 61.8034 19.5233 61.7601 19.9766 61.8234C20.2316 61.8584 20.325 61.9884 20.3216 62.2251C20.3183 62.4868 20.3216 62.7501 20.3216 63.0118C20.3183 64.0418 19.7216 64.7034 18.6916 64.8401C18.26 64.8984 17.8266 64.9068 17.3933 64.8951C17.1466 64.8884 17.0566 64.9934 17.0433 65.2334C16.9816 66.4734 16.9583 67.7118 17.0533 68.9501C17.1266 69.9018 17.6266 70.2968 18.565 70.1818C19.0033 70.1284 19.45 70.1234 19.8916 70.0968C20.0733 70.0851 20.1683 70.1368 20.155 70.3551C20.135 70.6634 20.1033 70.9734 20.1366 71.2801C20.2266 72.1068 19.8833 72.6601 19.17 72.9568C17.595 73.6118 16.0633 73.5384 14.6583 72.5334C13.8316 71.9418 13.3716 71.0851 13.3366 70.0551C13.2533 67.5468 13.2016 65.0368 13.2 62.5251C13.2 61.3251 13.7416 60.4718 14.6416 59.7801C15.195 59.3551 15.8033 59.0518 16.515 59.0068C16.99 58.9768 17.0433 59.0284 17.0466 59.4968C17.05 60.0418 17.0433 60.5868 17.0433 61.1301C17.0433 61.7101 17.1133 61.7801 17.68 61.7834C17.9933 61.7851 18.305 61.7834 18.7283 61.7834L18.7266 61.7868Z"
      fill="#E32526"
    />
    <path
      d="M62.7616 65.0916C62.7433 65.22 62.8666 65.51 62.7166 65.6183C62.5433 65.7433 62.355 65.4833 62.1716 65.3983C61.1383 64.9183 60.0716 64.775 58.9666 65.1316C57.9233 65.4683 57.2283 66.4716 57.305 67.565C57.3966 68.9016 58.1366 69.9116 59.2333 70.0516C60.2483 70.1816 61.27 70.1466 62.2416 69.7483C62.6183 69.5933 62.6566 69.6183 62.6966 70.0316C62.8466 71.5483 62.1766 72.5266 60.7566 73.0566C57.555 74.2516 53.6633 71.8533 53.5216 68.065C53.5016 67.5166 53.5166 66.9816 53.5833 66.44C53.8933 63.93 56.5183 61.8583 58.7333 61.7683C59.2933 61.745 59.8416 61.7683 60.3883 61.8616C61.7966 62.1016 62.685 63.13 62.76 64.5866C62.7666 64.7283 62.76 64.8683 62.76 65.0916H62.7616Z"
      fill="#E32526"
    />
    <path
      d="M80.4967 62.8767C80.5567 64.5867 80.5533 66.595 80.555 68.6017C80.555 68.7534 80.555 68.905 80.57 69.055C80.62 69.61 81.0817 70.04 81.6367 70.085C81.9767 70.1117 82.3167 70.1317 82.6583 70.135C82.885 70.1367 82.9967 70.215 82.9917 70.4517C82.9833 70.845 83.01 71.2384 82.9583 71.63C82.8683 72.32 82.4866 72.7817 81.8366 73C80.4633 73.4617 79.1633 73.315 77.995 72.4317C77.1166 71.7684 76.76 70.8134 76.7383 69.7567C76.68 66.9284 76.6167 64.0984 76.72 61.2684C76.7533 60.3467 76.685 59.425 76.6933 58.5017C76.6933 58.3467 76.7567 58.245 76.9183 58.2367C77.755 58.1967 78.5983 58.1434 79.3833 58.5284C80.0466 58.8534 80.4016 59.3834 80.4483 60.13C80.4983 60.9467 80.5116 61.7634 80.4983 62.8767H80.4967Z"
      fill="#E32526"
    />
    <path
      d="M34.0467 63.8866C34.0467 62.1516 34.0467 60.4183 34.0467 58.6833C34.0467 58.2666 34.0817 58.2349 34.4933 58.2233C35.1583 58.2049 35.8217 58.1933 36.4667 58.4183C37.3167 58.7166 37.75 59.3183 37.81 60.2033C37.8183 60.3333 37.82 60.4649 37.8217 60.5966C37.87 63.2383 37.8817 65.8783 37.8767 68.5199C37.8767 68.7316 37.8867 68.9416 37.93 69.1516C38.055 69.7516 38.37 70.0383 38.9883 70.0816C39.33 70.1066 39.6717 70.1299 40.0133 70.1316C40.245 70.1316 40.3517 70.2283 40.3467 70.4533C40.3367 70.9633 40.3233 71.4733 40.2217 71.9749C40.1567 72.2983 39.9583 72.5899 39.6733 72.7566C37.9417 73.7733 35.1133 73.2183 34.32 70.9949C34.0917 70.3583 34.0633 69.6899 34.0567 69.0266C34.04 67.3133 34.0517 65.5983 34.0517 63.8849H34.045L34.0467 63.8866Z"
      fill="#E32526"
    />
  </svg>
);

const AirtelTigoLogo = () => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect
      width="100"
      height="100"
      rx="20"
      fill="#1e293b"
      stroke="#ffffff22"
      strokeWidth="2"
    />
    <text
      x="50"
      y="55"
      fontFamily="var(--font-display), system-ui"
      fontSize="17"
      fontWeight="800"
      textAnchor="middle"
    >
      <tspan fill="#ff0000">airtel</tspan>
      <tspan fill="#4488ff">Tigo</tspan>
    </text>
  </svg>
);

const NETWORKS = [
  { name: "MTN", id: "mtn", Logo: MtnLogo },
  { name: "Telecel", id: "telecel", Logo: TelecelLogo },
  { name: "AirtelTigo", id: "airteltigo", Logo: AirtelTigoLogo },
] as const;

type NetworkId = (typeof NETWORKS)[number]["id"];

type PaymentResult = CreatePaymentIntentResponse;

const API_BASE_URL = requirePublicEnv(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  "NEXT_PUBLIC_API_BASE_URL",
);
const betterDataApi = createBetterDataApiClient({ baseUrl: API_BASE_URL });
const betterDataStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://betterdatagh.com/#organization",
      name: "Better Data",
      url: "https://betterdatagh.com",
      logo: "https://betterdatagh.com/favicon.svg",
      description:
        "Better Data is a Ghana-focused mobile data bundle platform for MTN, Telecel, and AirtelTigo customers.",
      areaServed: {
        "@type": "Country",
        name: "Ghana",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://betterdatagh.com/#website",
      name: "Better Data",
      url: "https://betterdatagh.com",
      publisher: {
        "@id": "https://betterdatagh.com/#organization",
      },
      inLanguage: "en-GH",
    },
    {
      "@type": "Service",
      "@id": "https://betterdatagh.com/#mobile-data-service",
      name: "Better Data mobile data bundle purchases",
      serviceType: "Mobile data bundle purchase service",
      provider: {
        "@id": "https://betterdatagh.com/#organization",
      },
      areaServed: {
        "@type": "Country",
        name: "Ghana",
      },
      description:
        "Buy affordable MTN, Telecel, and AirtelTigo data bundles in Ghana through a smooth Mobile Money purchase experience.",
      termsOfService: "https://betterdatagh.com/legal#terms",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Ghana mobile data bundle offers",
        itemListElement: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "MTN data bundles",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Telecel data bundles",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "AirtelTigo data bundles",
            },
          },
        ],
      },
      potentialAction: {
        "@type": "BuyAction",
        target: "https://betterdatagh.com/buy",
      },
    },
  ],
};

/* ── Icons ── */
const ShieldIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ZapIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const TruckIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const DocumentIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const HeadsetIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

const SignalIcon = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const PackageBoxIcon = () => (
  <svg
    width="36"
    height="36"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const main = useRef<HTMLElement>(null);
  const [network, setNetwork] = useState<NetworkId>("mtn");
  const [phone, setPhone] = useState("");
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packageError, setPackageError] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null,
  );
  const [orderError, setOrderError] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
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

  const networkPackages = packages.filter(
    (item) => item.network === network && item.isAvailable,
  );
  const selectedPackage =
    networkPackages.find((item) => item.id === selectedPackageId) ??
    networkPackages[0];

  /* Navbar scroll detection */
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPackages() {
      try {
        setPackagesLoading(true);
        setPackageError("");

        const data = await betterDataApi.listDataPackages();

        if (controller.signal.aborted) {
          return;
        }

        setPackages(data.packages);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPackageError(readApiError(error, "Unable to load data packages."));
      } finally {
        if (!controller.signal.aborted) {
          setPackagesLoading(false);
        }
      }
    }

    void loadPackages();

    return () => controller.abort();
  }, [loadKey]);

  useEffect(() => {
    const firstPackage = packages.find(
      (item) => item.network === network && item.isAvailable,
    );
    setSelectedPackageId(firstPackage?.id ?? "");
  }, [network, packages]);

  /* GSAP Animations */
  useGSAP(
    () => {
      // Hero entrance — staggered text reveal
      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTl
        .to(".hero-copy", { opacity: 1, duration: 0 }) // unhide container
        .from(".hero-copy > *", {
          y: 30,
          opacity: 0,
          duration: 0.8,
          stagger: 0.12,
        })
        .fromTo(
          ".widget-wrap",
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power2.out",
          },
          0.3,
        );

      // Reveal-on-scroll for sections
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

      // Stagger step cards
      ScrollTrigger.create({
        trigger: ".steps-grid",
        start: "top 85%",
        onEnter: () => {
          gsap.from(".step-card", {
            y: 32,
            opacity: 0,
            duration: 0.6,
            stagger: 0.12,
            ease: "power2.out",
          });
        },
        once: true,
      });
    },
    { scope: main },
  );

  /* Spotlight card hover effect */
  const handleCardMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
  };

  const retryLoadPackages = () => {
    setPackageError("");
    setLoadKey((key) => key + 1);
  };

  const submitQuickPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setOrderError("");
    setPaymentResult(null);

    if (!selectedPackage) {
      setOrderError("Choose a package before continuing.");
      return;
    }

    if (!phone.trim()) {
      setOrderError("Enter the recipient phone number.");
      return;
    }

    if (!recipientConfirmed) {
      setOrderError("Confirm the recipient number is correct.");
      return;
    }

    try {
      setSubmittingOrder(true);

      const data = await betterDataApi.createPaymentIntent({
        purpose: "data_purchase",
        packageId: selectedPackage.id,
        network,
        recipientPhone: phone.trim(),
        confirmRecipientIsCorrect: true,
      });

      setPaymentResult(data);
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setOrderError(readApiError(error, "Unable to initialize payment."));
    } finally {
      setSubmittingOrder(false);
    }
  };

  const refreshOrderStatus = async () => {
    if (!paymentResult) {
      return;
    }

    try {
      setRefreshingStatus(true);
      setOrderError("");

      const data = await betterDataApi.getPaymentIntentStatus(
        paymentResult.reference,
      );
      setPaymentResult((current: PaymentResult | null) =>
        current
          ? {
              ...current,
              status: data.status,
            }
          : current,
      );
    } catch (error) {
      setOrderError(readApiError(error, "Unable to refresh payment status."));
    } finally {
      setRefreshingStatus(false);
    }
  };

  return (
    <main ref={main}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(betterDataStructuredData),
        }}
      />
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
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "light" ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-bg">
          <Image
            src="/hero-bg.png"
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="hero-fade" />

        <div className="container hero-inner">
          {/* Left - Copy */}
          <div className="hero-copy">
            <h1 className="hero-title">
              Buy <span className="accent">Cheap Data</span> Bundles Instantly
            </h1>

            <p className="hero-desc">
              Buy cheap MTN, Telecel and AirtelTigo data bundles online at
              affordable prices. Fast delivery, no account needed.
            </p>

            <div className="hero-cta-row">
              <Link href="#how-it-works" className="btn btn-ghost btn-lg">
                How it works
              </Link>
              <Link href="/buy" className="btn btn-primary btn-lg">
                Get Started
              </Link>
            </div>

            <div className="trust-row">
              <ShieldIcon />
              <span>Secured by Paystack, trusted by 1000+ users</span>
            </div>
          </div>

          {/* Right — Quick Buy Widget */}
          <div className="widget-wrap">
            <form className="widget" onSubmit={submitQuickPurchase}>
              <div className="widget-head">
                <div className="icon">
                  <ZapIcon />
                </div>
                <h2>Quick Purchase</h2>
              </div>

              <div className="field-group">
                <label className="field-label">Select Network</label>
                <div className="net-grid">
                  {NETWORKS.map((n) => (
                    <div
                      key={n.id}
                      className="net-opt"
                      data-active={network === n.id}
                      onClick={() => {
                        setNetwork(n.id);
                        setPaymentResult(null);
                      }}
                    >
                      <div className="net-icon">
                        <n.Logo />
                      </div>
                      <span>{n.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Choose Package</label>
                <div className="package-list">
                  {packagesLoading ? (
                    <div className="package-empty">Loading packages...</div>
                  ) : packageError ? (
                    <div className="package-empty package-error">
                      <span>{packageError}</span>
                      <button type="button" onClick={retryLoadPackages}>
                        Retry
                      </button>
                    </div>
                  ) : networkPackages.length === 0 ? (
                    <div className="package-empty">
                      No packages available for this network.
                    </div>
                  ) : (
                    networkPackages.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="package-opt"
                        data-active={selectedPackage?.id === item.id}
                        onClick={() => {
                          setSelectedPackageId(item.id);
                          setPaymentResult(null);
                        }}
                      >
                        <span>{formatPackageSize(item.sizeMb)}</span>
                        <strong>GHS {item.customerPriceGhs.toFixed(2)}</strong>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Phone Number</label>
                <input
                  type="tel"
                  className="text-input"
                  placeholder="e.g. 054 123 4567"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPaymentResult(null);
                  }}
                />
              </div>

              <label className="confirm-row">
                <input
                  type="checkbox"
                  checked={recipientConfirmed}
                  onChange={(event) =>
                    setRecipientConfirmed(event.currentTarget.checked)
                  }
                />
                <span>
                  I have checked the recipient number and accept responsibility
                  for wrong-number purchases.
                </span>
              </label>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                style={{ marginTop: 18 }}
                disabled={
                  submittingOrder ||
                  packagesLoading ||
                  !selectedPackage ||
                  !recipientConfirmed
                }
              >
                {submittingOrder
                  ? "Opening Paystack..."
                  : "Pay with Mobile Money"}
              </button>

              {orderError ? (
                <div className="order-message order-error">{orderError}</div>
              ) : null}

              {paymentResult ? (
                <div className="order-result">
                  <div>
                    <span>Payment Reference</span>
                    <strong>{paymentResult.reference}</strong>
                  </div>
                  <div className="order-result-grid">
                    <div>
                      <span>Status</span>
                      <strong>{formatStatus(paymentResult.status)}</strong>
                    </div>
                    <div>
                      <span>Amount</span>
                      <strong>GHS {paymentResult.amountGhs.toFixed(2)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="status-link"
                    onClick={refreshOrderStatus}
                    disabled={refreshingStatus}
                  >
                    {refreshingStatus ? "Checking..." : "Check payment"}
                  </button>
                </div>
              ) : null}

              <div className="widget-footer">
                <LockIcon />
                <span>Secured by Paystack Mobile Money.</span>
              </div>
            </form>
          </div>
        </div>
        <div className="hero-wave">
          <svg
            viewBox="0 0 1440 100"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,60 C360,120 720,0 1440,60 L1440,100 L0,100 Z"
              fill="var(--bg-root)"
            />
          </svg>
        </div>
      </section>

      {/* ── Network Cards ── */}
      <section className="network-cards reveal">
        <div className="container">
          <div className="network-cards-grid">
            <div
              className="network-card mtn"
              onClick={() => {
                setNetwork("mtn");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <SignalIcon />
              <span>MTN</span>
            </div>
            <div
              className="network-card telecel"
              onClick={() => {
                setNetwork("telecel");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <SignalIcon />
              <span>Telecel</span>
            </div>
            <div
              className="network-card airteltigo"
              onClick={() => {
                setNetwork("airteltigo");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <SignalIcon />
              <span>AirtelTigo</span>
            </div>
            <div className="network-card bulk">
              <PackageBoxIcon />
              <span>Bulk Orders</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ── */}
      <section className="why-us">
        <div className="container">
          <div className="section-header reveal">
            <h2>Why Choose Us</h2>
          </div>
          <div className="features-grid">
            <div className="feature-card reveal">
              <div className="feature-icon green">
                <TruckIcon />
              </div>
              <h3>Fast Delivery</h3>
              <p>
                Experience instant data delivery with our automated system. Your
                bundle arrives in seconds.
              </p>
            </div>
            <div className="feature-card reveal">
              <div className="feature-icon orange">
                <DocumentIcon />
              </div>
              <h3>Bulk Order Processing</h3>
              <p>
                Upload Excel files or use text input to process hundreds of
                orders simultaneously.
              </p>
            </div>
            <div className="feature-card reveal">
              <div className="feature-icon blue">
                <HeadsetIcon />
              </div>
              <h3>24/7 Support</h3>
              <p>
                Our dedicated support team is available round the clock to help
                you with any technical issues.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-divider">
            <div className="line" />
            <div className="dot" />
            <div className="line" />
          </div>
          <div className="stats-grid">
            <div className="stat-card reveal">
              <div className="stat-number">99.9%</div>
              <div className="stat-label">Website Uptime</div>
            </div>
            <div className="stat-card reveal">
              <div className="stat-number">20K+</div>
              <div className="stat-label">Happy Clients</div>
            </div>
            <div className="stat-card reveal">
              <div className="stat-number">100K+</div>
              <div className="stat-label">Orders Completed</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="features">
        <div className="container">
          <div className="section-header reveal">
            <span className="overline">How it works</span>
            <h2>Data in 3 simple steps</h2>
            <p>No sign-up, no app download. Your bundle is seconds away.</p>
          </div>

          <div className="steps-grid">
            {[
              {
                n: "1",
                title: "Pick your bundle",
                desc: "Choose your network above and browse affordable data packages tailored to your needs.",
              },
              {
                n: "2",
                title: "Confirm details",
                desc: "Double-check the phone number and package. We will show you an instant price summary.",
              },
              {
                n: "3",
                title: "Pay with MoMo",
                desc: "Complete payment via Mobile Money. Your data is credited within seconds, every time.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="step-card"
                onMouseMove={handleCardMouse}
              >
                <div className="step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Showcase ── */}
      <section className="showcase">
        <div className="container showcase-inner">
          <div className="showcase-visual reveal">
            <div className="glow-orb" />
            <Image
              src="/hero-phone.png"
              alt="Better Data on your phone"
              width={400}
              height={400}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
          <div className="showcase-copy reveal">
            <h2>Built for speed &amp; simplicity</h2>
            <p>
              No cluttered menus, no confusing forms. Better Data is designed so
              anyone from students to business owners can top up in under 30
              seconds.
            </p>
            <ul className="check-list">
              {[
                "No account or app required",
                "Instant delivery, 24/7",
                "Best prices, guaranteed",
                "Supports MTN, Telecel & AirtelTigo",
              ].map((item) => (
                <li key={item}>
                  <span className="check-icon">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Agent CTA ── */}
      <section className="container">
        <div className="cta-banner reveal">
          <div className="cta-glow" />
          <h2>Become an agent</h2>
          <p>
            Get discounted rates on every bundle and earn commissions selling
            data to your community.
          </p>
          <Link href="/agents" className="btn btn-primary btn-lg">
            Apply Now
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
              <Link href="/buy" className="footer-link">
                Buy Data
              </Link>
              <Link href="/login" className="footer-link">
                Log In
              </Link>
              <Link href="/agents" className="footer-link">
                Agent Program
              </Link>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Support</span>
              <Link href="/faq" className="footer-link">
                FAQs
              </Link>
              <Link href="/contact" className="footer-link">
                Contact Us
              </Link>
              <a
                href="https://wa.me/233000000000"
                className="footer-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </div>
            <div className="footer-col">
              <span className="footer-col-title">Working Hours</span>
              <span className="footer-link">Monday - Saturday</span>
              <span className="footer-link">6:00am - 11:59pm</span>
              <span className="footer-link">Sunday: 7:00am - 11:30pm</span>
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

const DATA_MB_PER_GB = 1000;

function formatPackageSize(sizeMb: number) {
  if (sizeMb >= DATA_MB_PER_GB) {
    return `${Number(sizeMb / DATA_MB_PER_GB).toLocaleString("en-GH", {
      maximumFractionDigits: 1,
    })}GB`;
  }

  return `${sizeMb}MB`;
}

function formatStatus(status: PaymentResult["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatEta(seconds?: number) {
  if (seconds === undefined) {
    return "Checking";
  }

  if (seconds === 0) {
    return "Instant";
  }

  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.round(minutes / 60)} hr` : `${minutes} min`;
}

function readApiError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function requirePublicEnv(value: string | undefined, name: string) {
  if (!value?.trim()) {
    throw new Error(
      `${name} is required before initializing the Better Data API client.`,
    );
  }

  return value;
}
