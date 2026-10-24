import { describe, expect, it } from "vitest";

import { candidateBaseUrls, DEPLOYED_BASE_URL, devMachineBaseUrl, discoverBaseUrl, loopbackBaseUrl } from "./discovery";

/**
 * The app has to find an API without anyone typing an address, and it must
 * prefer a closer, explicitly configured server over the deployed one. These
 * tests pin the order and the edge cases (tunnels, duplicates, slow probes).
 */

describe("devMachineBaseUrl", () => {
  it("points at the web app's port on the machine that served the bundle", () => {
    expect(devMachineBaseUrl("192.168.1.20:8081")).toBe("http://192.168.1.20:3000/api/v1");
    expect(devMachineBaseUrl("exp://10.0.0.5:8081/--/")).toBe("http://10.0.0.5:3000/api/v1");
  });

  it("ignores tunnels and missing values", () => {
    expect(devMachineBaseUrl("abc-anonymous-8081.exp.direct")).toBeNull();
    expect(devMachineBaseUrl(undefined)).toBeNull();
    expect(devMachineBaseUrl("")).toBeNull();
  });
});

describe("candidateBaseUrls", () => {
  it("orders build setting, dev machine, loopback, deployed", () => {
    const list = candidateBaseUrls({ env: "https://staging.example.org/api/v1/", hostUri: "192.168.1.20:8081", os: "android" });
    expect(list.map((c) => c.source)).toEqual(["environment", "dev-machine", "loopback", "deployed"]);
    expect(list[0].url).toBe("https://staging.example.org/api/v1");
    expect(list[2].url).toBe("http://10.0.2.2:3000/api/v1");
    expect(list[3].url).toBe(DEPLOYED_BASE_URL);
  });

  it("drops duplicates, keeping the first source", () => {
    const list = candidateBaseUrls({ env: DEPLOYED_BASE_URL, hostUri: null, os: "ios" });
    expect(list.map((c) => c.source)).toEqual(["environment", "loopback"]);
    expect(loopbackBaseUrl("ios")).toBe("http://localhost:3000/api/v1");
  });
});

describe("discoverBaseUrl", () => {
  const candidates = candidateBaseUrls({ env: null, hostUri: "192.168.1.20:8081", os: "android" });
  const delay = (ms: number, value: boolean) => new Promise<boolean>((r) => setTimeout(() => r(value), ms));

  it("follows priority, not speed", async () => {
    const found = await discoverBaseUrl(candidates, (url) =>
      url === DEPLOYED_BASE_URL ? delay(1, true) : url.includes("192.168") ? delay(20, true) : delay(5, false)
    );
    expect(found?.source).toBe("dev-machine");
  });

  it("falls through to the deployed API when nothing local answers, and treats a throw as no", async () => {
    const found = await discoverBaseUrl(candidates, async (url) => {
      if (url === DEPLOYED_BASE_URL) return true;
      throw new Error("network");
    });
    expect(found?.source).toBe("deployed");
  });

  it("returns null when nothing answers", async () => {
    expect(await discoverBaseUrl(candidates, async () => false)).toBeNull();
  });
});
