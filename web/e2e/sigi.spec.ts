import type { ApiErrorCode, ApiErrorResponse, ApiSuccess, ChatResponseData } from "@sigma/contracts";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PAGES, expectPage, openPage, prepareContext, sigiHero } from "./support";

/**
 * SIGI at the top of Analyze. Every test answers /api/v1/chat in the browser,
 * so no request reaches the server or a model. The bodies follow the real
 * contract (lib/api/envelope.ts, lib/api/chat.ts); the answer is a labelled
 * test fixture, not data.
 */

const CHAT = "**/api/v1/chat";
const CITED_ID = "lab-quezon-city-2019";
const REPLY = `Test reply from a mocked endpoint. The 2019 weeks are in the Lab record [${CITED_ID}].`;

function errorBody(code: ApiErrorCode, message: string): ApiErrorResponse {
  return {
    error: { code, message },
    meta: { apiVersion: "v1", generatedAt: "2026-10-24T00:00:00.000Z", status: "unavailable", isSample: false },
  };
}

function answerBody(): ApiSuccess<ChatResponseData> {
  return {
    data: {
      reply: REPLY,
      model: "e2e-mock-model",
      contextScope: "Mocked in an end-to-end test; no model was called.",
      limitations: ["Test fixture, not a real answer."],
      replySignature: "e2e-signature",
      citations: [
        {
          id: CITED_ID,
          kind: "lab",
          jurisdiction: "reporting unit",
          unitId: "quezon-city",
          title: "Quezon City: dengue weeks in 2019",
          source: { name: "DOH-EB dengue counts via HDX", url: null },
          href: "/analyze/lab",
        },
      ],
      rejectedCitationIds: [],
    },
    meta: { apiVersion: "v1", generatedAt: "2026-10-24T00:00:00.000Z", status: "demo", isSample: true },
  };
}

/** Opens an Analyze subtab and returns SIGI's frame once it has rendered. */
async function openSigi(page: Page, target = PAGES.policy) {
  await openPage(page, target.path);
  await expectPage(page, target);
  return sigiHero(page);
}

function questionBox(hero: Locator) {
  return hero.getByRole("textbox", { name: "Question for the Policy Copilot" });
}

function suggestions(hero: Locator) {
  return hero.getByRole("list", { name: "Suggested questions" }).getByRole("button");
}

/** Types a question and sends it; Send is enabled only once React holds the text. */
async function ask(hero: Locator, question: string) {
  await questionBox(hero).fill(question);
  await hero.getByRole("button", { name: "Send" }).click();
}

test.beforeEach(async ({ context, baseURL }) => {
  await prepareContext(context, baseURL);
});

test("before a question: suggestions, an empty box, and no request", async ({ page }) => {
  let requests = 0;
  await page.route(CHAT, (route) => {
    requests += 1;
    return route.abort();
  });
  const hero = await openSigi(page);

  await expect(hero.getByRole("heading", { name: "Ask SIGI" })).toBeVisible();
  await expect(hero.getByRole("status")).toHaveText(
    "Ask about Quezon City: what the data shows, what is missing, and what to check next.",
  );
  await expect(suggestions(hero).filter({ hasText: "Quezon City" }).first()).toBeVisible();
  await expect(questionBox(hero)).toBeEnabled();
  await expect(questionBox(hero)).toHaveValue("");
  await expect(hero.getByRole("button", { name: "Send" })).toBeDisabled();
  await expect(hero.getByRole("log", { name: "Conversation" })).toHaveCount(0);
  await expect(hero.getByRole("button", { name: "New conversation" })).toHaveCount(0);
  expect(requests).toBe(0);
});

test("a failed request shows the error, keeps the question, and retries it once", async ({ page }) => {
  const bodies: unknown[] = [];
  await page.route(CHAT, (route) => {
    bodies.push(route.request().postDataJSON());
    return bodies.length === 1
      ? route.fulfill({ status: 502, json: errorBody("upstream_unavailable", "The model provider request failed.") })
      : route.fulfill({ status: 200, json: answerBody() });
  });
  const hero = await openSigi(page);
  const question = "Which weeks are missing, and why does that matter?";
  await ask(hero, question);

  const log = hero.getByRole("log", { name: "Conversation" });
  await expect(hero.getByRole("status")).toHaveText("The last request failed. Nothing was generated in its place.");
  await expect(hero.getByText("The model provider request failed.")).toBeVisible();
  await expect(log.getByText(question, { exact: true })).toBeVisible();
  await expect(hero.getByRole("button", { name: "New conversation" })).toBeVisible();
  expect(bodies).toEqual([{ message: question, history: [], disease: "Dengue", locationId: "quezon-city" }]);

  await hero.getByRole("button", { name: "Try again" }).click();
  await expect(hero.getByRole("status")).toHaveText("Answer received. Check it against the evidence before using it.");
  await expect(hero.getByText("The model provider request failed.")).toHaveCount(0);
  // The retry resends the same question, with no failed turn in its history.
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  await expect(log.getByText(question, { exact: true })).toHaveCount(1);
});

test("a 503 not_configured reply says SIGI is not configured and locks the box", async ({ page }) => {
  await page.route(CHAT, (route) =>
    route.fulfill({
      status: 503,
      json: errorBody(
        "not_configured",
        "The Policy Copilot has no model provider configured, so it cannot answer. Nothing is returned in place of a real answer.",
      ),
    }),
  );
  const hero = await openSigi(page);
  await suggestions(hero).first().click();

  await expect(hero.getByRole("status")).toHaveText(
    "SIGI is not configured on this deployment. The evidence panel still works.",
  );
  await expect(hero.getByText("The Policy Copilot has no model provider configured")).toBeVisible();
  await expect(hero.getByRole("button", { name: "Check again" })).toBeVisible();
  await expect(questionBox(hero)).toBeDisabled();
  await expect(hero.getByRole("button", { name: "Send" })).toBeDisabled();
  await expect(hero.getByRole("list", { name: "Suggested questions" })).toHaveCount(0);
});

test("a request that never arrives says SIGI could not be reached", async ({ page }) => {
  await page.route(CHAT, (route) => route.abort("failed"));
  const hero = await openSigi(page);
  await ask(hero, "What should be verified first?");

  await expect(hero.getByText("SIGI could not be reached. Check your connection.")).toBeVisible();
  await expect(hero.getByRole("status")).toHaveText("The last request failed. Nothing was generated in its place.");
  await expect(hero.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("an answer shows its numbered sources and survives a subtab switch", async ({ page }) => {
  const messages: string[] = [];
  await page.route(CHAT, (route) => {
    messages.push((route.request().postDataJSON() as { message: string }).message);
    return route.fulfill({ status: 200, json: answerBody() });
  });
  const hero = await openSigi(page);
  const chip = suggestions(hero).first();
  const question = (await chip.textContent())?.trim() ?? "";
  await chip.click();

  const log = hero.getByRole("log", { name: "Conversation" });
  await expect(log).toContainText("Test reply from a mocked endpoint.");
  expect(messages).toEqual([question]);
  await expect(log.getByText(question, { exact: true })).toBeVisible();
  // The cited id becomes citation 1, listed under Sources with its in-app link.
  await expect(log.getByRole("link", { name: "1", exact: true })).toBeVisible();
  await expect(log.getByText("Quezon City: dengue weeks in 2019")).toBeVisible();
  await expect(log.getByRole("link", { name: "open in SIGMA" })).toHaveAttribute("href", "/analyze/lab");
  await expect(log.getByText("Limitations · model e2e-mock-model")).toBeVisible();

  // SIGI lives in the Analyze layout, so the conversation stays on another subtab.
  await page.getByRole("navigation", { name: "Analyze" }).getByRole("link", { name: "Lab", exact: true }).click();
  await expectPage(page, PAGES.lab);
  await expect(log).toContainText("Test reply from a mocked endpoint.");
});
