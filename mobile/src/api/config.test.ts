import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

const storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));

const {
  DEFAULT_BASE_URL,
  DEPLOYED_BASE_URL,
  chooseBaseUrl,
  clearStoredBaseUrl,
  defaultBaseUrl,
  isLoopbackUrl,
  loadStoredBaseUrl,
  normalizeBaseUrl,
  storeBaseUrl,
  validateBaseUrl,
} = await import("./config");

/**
 * The API address is a setting, and a wrong one is the most likely reason a
 * reviewer sees an empty screen. These tests pin the rules that keep the
 * address honest: it is validated before it is stored, and the default is
 * stated out loud rather than hidden.
 */

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_API_BASE_URL;

beforeEach(() => {
  storage.getItem.mockReset();
  storage.setItem.mockReset();
  storage.removeItem.mockReset();
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
  storage.removeItem.mockResolvedValue(undefined);
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
  else process.env.EXPO_PUBLIC_API_BASE_URL = ORIGINAL_ENV;
});

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes so paths join cleanly", () => {
    expect(normalizeBaseUrl("http://localhost:3000/api/v1///")).toBe("http://localhost:3000/api/v1");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeBaseUrl("  http://localhost:3000/api/v1  ")).toBe("http://localhost:3000/api/v1");
  });
});

describe("validateBaseUrl", () => {
  it("accepts an http and an https address", () => {
    expect(validateBaseUrl("http://192.168.1.20:3000/api/v1")).toBeNull();
    expect(validateBaseUrl("https://sigma.example.org/api/v1")).toBeNull();
  });

  it("rejects an empty address", () => {
    expect(validateBaseUrl("   ")).toMatch(/Enter a base URL/i);
  });

  it("rejects an address without a scheme", () => {
    expect(validateBaseUrl("sigma.example.org/api/v1")).toMatch(/must start with http/i);
  });

  it("rejects something that is not a URL at all", () => {
    expect(validateBaseUrl("http://")).toMatch(/not a valid URL/i);
  });
});

describe("defaultBaseUrl", () => {
  it("uses the build-time environment value when there is one", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "https://sigma.example.org/api/v1";
    expect(defaultBaseUrl()).toBe("https://sigma.example.org/api/v1");
  });

  it("falls back to a platform-appropriate localhost in a development build", () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(defaultBaseUrl(true)).toBe(DEFAULT_BASE_URL);
    expect(DEFAULT_BASE_URL).toContain("/api/v1");
  });

  it("falls back to the deployed HTTPS API in an installed build", () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(defaultBaseUrl(false)).toBe(DEPLOYED_BASE_URL);
    expect(DEPLOYED_BASE_URL).toMatch(/^https:\/\/.+\/api\/v1$/);
  });

  it("never ships a localhost default in an installed build", () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = "http://localhost:3000/api/v1";
    expect(defaultBaseUrl(false)).toBe(DEPLOYED_BASE_URL);
    expect(defaultBaseUrl(true)).toBe("http://localhost:3000/api/v1");
  });
});

describe("isLoopbackUrl", () => {
  it("flags addresses that only work on a developer's machine", () => {
    for (const url of ["http://localhost:3000/api/v1", "http://127.0.0.1:3000", "http://10.0.2.2:3000/api/v1", "http://0.0.0.0:3000", "http://[::1]:3000"]) {
      expect(isLoopbackUrl(url)).toBe(true);
    }
  });

  it("leaves LAN and deployed addresses alone", () => {
    expect(isLoopbackUrl("http://192.168.1.20:3000/api/v1")).toBe(false);
    expect(isLoopbackUrl(DEPLOYED_BASE_URL)).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });
});

describe("chooseBaseUrl", () => {
  const fallback = DEPLOYED_BASE_URL;
  const lan = "http://192.168.1.20:3000/api/v1";

  it("uses the default when nothing is saved, without probing", async () => {
    const probe = vi.fn();
    await expect(chooseBaseUrl(null, fallback, probe, false)).resolves.toEqual({ baseUrl: fallback, skipped: null, clearStored: false });
    expect(probe).not.toHaveBeenCalled();
  });

  it("drops a saved localhost address in an installed build", async () => {
    const probe = vi.fn();
    await expect(chooseBaseUrl("http://10.0.2.2:3000/api/v1", fallback, probe, false)).resolves.toEqual({
      baseUrl: fallback,
      skipped: "http://10.0.2.2:3000/api/v1",
      clearStored: true,
    });
    expect(probe).not.toHaveBeenCalled();
  });

  it("keeps a saved address that answers", async () => {
    const probe = vi.fn().mockResolvedValue(true);
    await expect(chooseBaseUrl(lan, fallback, probe, false)).resolves.toEqual({ baseUrl: lan, skipped: null, clearStored: false });
  });

  it("falls back to the default for this session when the saved address is down", async () => {
    const probe = vi.fn(async (url: string) => url === fallback);
    await expect(chooseBaseUrl(lan, fallback, probe, false)).resolves.toEqual({ baseUrl: fallback, skipped: lan, clearStored: false });
  });

  it("keeps the saved address when neither answers, so the error names it", async () => {
    const probe = vi.fn().mockResolvedValue(false);
    await expect(chooseBaseUrl(lan, fallback, probe, false)).resolves.toEqual({ baseUrl: lan, skipped: null, clearStored: false });
  });
});

describe("stored address", () => {
  it("stores the normalized address", async () => {
    await storeBaseUrl("http://localhost:3000/api/v1/");
    expect(storage.setItem).toHaveBeenCalledWith("sigma.apiBaseUrl", "http://localhost:3000/api/v1");
  });

  it("reads a stored address back", async () => {
    storage.getItem.mockResolvedValue("http://192.168.1.20:3000/api/v1");
    await expect(loadStoredBaseUrl()).resolves.toBe("http://192.168.1.20:3000/api/v1");
  });

  it("survives a storage failure instead of crashing the app", async () => {
    storage.getItem.mockRejectedValue(new Error("storage unavailable"));
    await expect(loadStoredBaseUrl()).resolves.toBeNull();
  });

  it("clears the stored address", async () => {
    await clearStoredBaseUrl();
    expect(storage.removeItem).toHaveBeenCalledWith("sigma.apiBaseUrl");
  });
});
