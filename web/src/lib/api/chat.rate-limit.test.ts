import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, rateLimitMap } from "@/lib/api/chat";

describe("chat rate limiter", () => {
  beforeEach(() => {
    rateLimitMap.clear();
  });

  it("allows the first request for a new IP", () => {
    const result = checkRateLimit("192.168.1.1");
    expect(result).toBeNull();
  });

  it("allows requests up to the limit", () => {
    const ip = "10.0.0.1";
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(ip)).toBeNull();
    }
  });

  it("returns retryAfter when limit is exceeded", () => {
    const ip = "10.0.0.2";
    for (let i = 0; i < 30; i++) {
      checkRateLimit(ip);
    }
    const result = checkRateLimit(ip);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("resets after window expires", () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 30; i++) {
      checkRateLimit(ip, 30, 1); // 1ms window
    }
    // Wait for window to expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait
    }
    const result = checkRateLimit(ip, 30, 1);
    expect(result).toBeNull();
  });

  it("tracks different IPs independently", () => {
    const ip1 = "10.0.0.4";
    const ip2 = "10.0.0.5";
    for (let i = 0; i < 30; i++) {
      checkRateLimit(ip1);
    }
    // ip2 should still be allowed
    expect(checkRateLimit(ip2)).toBeNull();
  });
});
