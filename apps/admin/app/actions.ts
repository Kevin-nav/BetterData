"use server";

import { revalidatePath } from "next/cache";

export async function updatePaymentConfig(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  const value = Number(formData.get("value"));

  await adminApiRequest("/admin/payment-config", {
    method: "PATCH",
    body: JSON.stringify({ key, value })
  });

  revalidatePath("/");
}

export async function acknowledgeOpsAlert(formData: FormData) {
  const alertId = String(formData.get("alertId") ?? "");

  await adminApiRequest(`/admin/ops-alerts/${encodeURIComponent(alertId)}/acknowledge`, {
    method: "POST"
  });

  revalidatePath("/");
}

export async function resolveOpsAlert(formData: FormData) {
  const alertId = String(formData.get("alertId") ?? "");

  await adminApiRequest(`/admin/ops-alerts/${encodeURIComponent(alertId)}/resolve`, {
    method: "POST"
  });

  revalidatePath("/");
}

async function adminApiRequest(path: string, init: RequestInit) {
  const baseUrl = process.env.API_BASE_URL;
  const serviceSecret = process.env.BETTERDATA_SERVICE_SECRET;

  if (!baseUrl || !serviceSecret) {
    throw new Error("Admin API configuration is missing.");
  }

  const headers = new Headers(init.headers);
  headers.set("x-betterdata-service-secret", serviceSecret);

  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Admin API request failed with ${response.status}.`);
  }
}
