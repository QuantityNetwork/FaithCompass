import { afterEach, describe, expect, it, vi } from "vitest";
import { resetServerConfig, serverConfig } from "@/server/config/env";

describe("server configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerConfig();
  });

  it("falls back to demo mode only when not declared live", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SAGOLIK_MODE", "");
    resetServerConfig();
    expect(serverConfig().mode).toBe("demo");
  });

  it("refuses to start a live deployment without Supabase", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SAGOLIK_MODE", "live");
    resetServerConfig();
    expect(() => serverConfig()).toThrow(/SAGOLIK_MODE=live requires/);
  });

  it("rejects unknown modes", () => {
    vi.stubEnv("SAGOLIK_MODE", "staging");
    resetServerConfig();
    expect(() => serverConfig()).toThrow(/must be "demo" or "live"/);
  });
});
