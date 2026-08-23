"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { PauseCircle } from "lucide-react";
import { convexApi } from "@betterdata/app-api";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Full-width destructive banner shown at the top of the dashboard whenever a
 * purchase outage is active. Renders nothing while loading or when purchases
 * are available.
 */
export function OutageBanner() {
  const status = useQuery(convexApi.admin.getPurchaseOutageStatus);

  if (status === undefined || !status.isActive) {
    return null;
  }

  return (
    <Alert variant="destructive" role="alert">
      <PauseCircle aria-hidden="true" />
      <AlertTitle>Purchases are paused</AlertTitle>
      <AlertDescription>
        {status.message ? <p>{status.message}</p> : null}
        <p>
          Customers cannot place new data purchases right now.{" "}
          <Link
            href="/outage"
            className="underline underline-offset-2 font-medium"
          >
            Manage availability
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}
