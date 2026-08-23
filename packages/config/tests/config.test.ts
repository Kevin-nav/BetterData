import { afterEach, describe, expect, it } from "vitest";

import { getAdminScopeForRole, getRequiredEnv } from "../src/index";

describe("getAdminScopeForRole", () => {
  it("maps superadmin and admin roles to their scopes", () => {
    expect(getAdminScopeForRole("superadmin")).toBe("superadmin");
    expect(getAdminScopeForRole("admin")).toBe("admin");
  });

  it("returns null for non-admin roles", () => {
    expect(getAdminScopeForRole("user")).toBeNull();
    expect(getAdminScopeForRole("agent")).toBeNull();
    expect(getAdminScopeForRole("guest")).toBeNull();
  });

  it("returns null for missing or malformed input", () => {
    expect(getAdminScopeForRole(undefined)).toBeNull();
    expect(getAdminScopeForRole(null)).toBeNull();
    expect(getAdminScopeForRole("")).toBeNull();
    expect(getAdminScopeForRole("ADMIN")).toBeNull();
    expect(getAdminScopeForRole("superadmin ")).toBeNull();
  });
});

const ENV_KEY = "TEST_REQUIRED_ENV_VAR";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("getRequiredEnv", () => {
  it("returns the value when the variable is set", () => {
    process.env[ENV_KEY] = "value";
    expect(getRequiredEnv(ENV_KEY)).toBe("value");
  });

  it("throws a descriptive error when the variable is missing", () => {
    expect(() => getRequiredEnv(ENV_KEY)).toThrowError(
      `Missing required environment variable: ${ENV_KEY}`,
    );
  });
});
