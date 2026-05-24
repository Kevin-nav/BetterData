import {
  DataMartBatchError
} from "./datamart/purchaseDispatcher";
import {
  DataMartHttpError,
  DataMartNetworkError
} from "./datamart/transport";

export type VendorHttpError = {
  statusCode: number;
  message: string;
  retryAfterSeconds?: number;
};

export function mapVendorErrorToHttp(error: unknown): VendorHttpError {
  if (error instanceof DataMartHttpError) {
    return mapDataMartHttpError(error);
  }

  if (error instanceof DataMartNetworkError || error instanceof DataMartBatchError) {
    return {
      statusCode: 502,
      message: "Data vendor is unavailable right now."
    };
  }

  return {
    statusCode: 500,
    message: "Data vendor request failed."
  };
}

export function isLowVendorBalanceError(error: unknown) {
  if (error instanceof DataMartHttpError) {
    const message = vendorErrorMessage(error.body).toLowerCase();

    return (
      message.includes("insufficient") ||
      (message.includes("balance") && message.includes("low")) ||
      (message.includes("wallet") && message.includes("balance"))
    );
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    return (
      message.includes("insufficient balance") ||
      message.includes("vendor balance is low") ||
      message.includes("vendor wallet")
    );
  }

  return false;
}

export function vendorPayloadIndicatesLowBalance(payload: unknown) {
  const message = vendorErrorMessage(payload).toLowerCase();

  if (!message) {
    return false;
  }

  return (
    message.includes("insufficient") ||
    (message.includes("balance") && message.includes("low")) ||
    (message.includes("wallet") && message.includes("balance"))
  );
}

function mapDataMartHttpError(error: DataMartHttpError): VendorHttpError {
  const vendorMessage = vendorErrorMessage(error.body).toLowerCase();

  if (error.statusCode === 429) {
    return {
      statusCode: 503,
      message: "Data vendor is rate limited. Try again shortly.",
      ...(error.rateLimit?.resetInSeconds !== undefined
        ? { retryAfterSeconds: error.rateLimit.resetInSeconds }
        : {})
    };
  }

  if (vendorMessage.includes("insufficient")) {
    return {
      statusCode: 503,
      message: "Data vendor wallet has insufficient balance."
    };
  }

  if (
    vendorMessage.includes("invalid") ||
    vendorMessage.includes("phone") ||
    vendorMessage.includes("package") ||
    error.statusCode === 400
  ) {
    return {
      statusCode: 400,
      message: "The data purchase request is invalid."
    };
  }

  if (error.statusCode === 409) {
    return {
      statusCode: 503,
      message: "Data vendor is still processing this request."
    };
  }

  if (error.statusCode >= 500) {
    return {
      statusCode: 502,
      message: "Data vendor is unavailable right now."
    };
  }

  return {
    statusCode: 502,
    message: "Data vendor request failed."
  };
}

function vendorErrorMessage(body: unknown) {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = (body as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}
