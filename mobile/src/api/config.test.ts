import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

const storage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));

const { DEFAULT_BASE_URL, clearStoredBaseUrl, defaultBaseUrl, loadStoredBaseUrl, normalizeBaseUrl, storeBaseUrl, validateBaseUrl } =
  await import("./config");

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

  it("falls back to a platform-appropriate localhost", () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    expect(defaultBaseUrl()).toBe(DEFAULT_BASE_URL);
    expect(DEFAULT_BASE_URL).toContain("/api/v1");
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
