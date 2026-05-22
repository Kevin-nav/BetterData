const apiBase = normalizeBaseUrl(process.env.HONEYCOMB_API_BASE_URL);
const configApiKey = requiredEnv("HONEYCOMB_CONFIG_API_KEY");
const dataset = requiredEnv("HONEYCOMB_DATASET");
const alertEmail = requiredEnv("HONEYCOMB_ALERT_EMAIL");

const recipient = await ensureEmailRecipient(alertEmail);
await ensureTrigger({
  dataset,
  recipient,
  name: "BetterData fulfillment terminal failures",
  description: "Alerts when paid data fulfillment reaches a failed or refunded terminal state.",
  eventName: "data_purchase.fulfillment_terminal"
});
await ensureTrigger({
  dataset,
  recipient,
  name: "BetterData worker terminal failures",
  description: "Alerts when a paid data fulfillment worker permanently fails.",
  eventName: "data_purchase.worker_failed"
});

console.log(`Honeycomb alert recipient ready for ${maskEmail(alertEmail)}.`);

async function ensureEmailRecipient(email) {
  const recipients = await honeycomb("GET", "/1/recipients");
  const existing = recipients.find((recipient) =>
    recipient.type === "email" &&
    (
      recipient.target === email ||
      recipient.details?.email === email ||
      recipient.details?.email_address === email
    )
  );

  if (existing) {
    return existing;
  }

  return await honeycomb("POST", "/1/recipients", {
    type: "email",
    details: { email_address: email }
  });
}

async function ensureTrigger(input) {
  const triggersPath = `/1/triggers/${encodeURIComponent(input.dataset)}`;
  const triggers = await honeycomb("GET", triggersPath, undefined, {
    allowDatasetNotFound: true
  });

  if (triggers === undefined) {
    console.warn(
      `Honeycomb dataset ${input.dataset} was not found; recipient was created but trigger ${input.name} was skipped.`
    );
    return;
  }
  const existing = triggers.find((trigger) => trigger.name === input.name);
  const body = buildTriggerBody(input);

  if (existing) {
    await honeycomb(
      "PUT",
      `/1/triggers/${encodeURIComponent(input.dataset)}/${encodeURIComponent(existing.id)}`,
      body
    );
    return;
  }

  await honeycomb("POST", `/1/triggers/${encodeURIComponent(input.dataset)}`, body);
}

function buildTriggerBody(input) {
  return {
    name: input.name,
    description: input.description,
    frequency: 300,
    alert_type: "on_change",
    disabled: false,
    recipients: [{ id: input.recipient.id }],
    query: {
      calculations: [{ op: "COUNT" }],
      filters: [{ column: "name", op: "=", value: input.eventName }],
      time_range: 300
    },
    threshold: {
      op: ">",
      value: 0
    }
  };
}

async function honeycomb(method, path, body, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Honeycomb-Team": configApiKey
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await res.text();

  if (
    !res.ok &&
    options.allowDatasetNotFound === true &&
    res.status === 404 &&
    text.toLowerCase().includes("dataset not found")
  ) {
    return undefined;
  }

  if (!res.ok) {
    throw new Error(`Honeycomb ${method} ${path} failed with ${res.status}: ${text}`);
  }

  return text ? JSON.parse(text) : undefined;
}

function requiredEnv(name) {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function normalizeBaseUrl(value) {
  return (value?.trim() || "https://api.honeycomb.io").replace(/\/+$/, "");
}

function maskEmail(email) {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return "***";
  }

  return `${name.slice(0, 2)}***@${domain}`;
}
