import { test, expect } from "@playwright/test";
import fs from "node:fs";
const credentials = JSON.parse(
  fs.readFileSync(
    process.env.E2E_CREDENTIALS_FILE || "/tmp/beyond-e2e.json",
    "utf8",
  ),
);
const apiBase = process.env.E2E_API_URL || "http://127.0.0.1:8000";
async function navigate(page, label) {
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function login(page, email, password) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Enter your learning space" }).click();
  await expect(
    page.getByRole("button", { name: "Overview", exact: true }),
  ).toBeAttached();
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
test("student → teacher → student: real scoring, review, quizzes, imports and responsive layout", async ({
  page,
  request,
}, testInfo) => {
  const tag = `${testInfo.project.name}-${Date.now()}`;
  const email = `student-${tag}@test.invalid`,
    name = `Learner ${tag}`;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await noOverflow(page);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Create student account" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good questions. Deeper understanding.",
    }),
  ).toBeVisible();
  await noOverflow(page);
  if (testInfo.project.name === "desktop")
    await page.screenshot({
      path: "/tmp/beyond-student-desktop.png",
      fullPage: true,
    });
  await navigate(page, "Explore riddles");
  await page.getByLabel("Search riddles").fill("Name the missing");
  await page
    .getByRole("button", { name: /Start Practice · Name the missing evidence/ })
    .click();
  await page
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("TRANSFER OF LEARNING");
  await page.getByRole("radio", { name: /Sure$/ }).check();
  await page.getByRole("button", { name: "Review & submit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Submit attempt", exact: true })
    .click();
  await expect(page.getByText("A well-reasoned step")).toBeVisible();
  await expect(page.getByText("5 / 5", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continue learning" }).click();
  await page.getByLabel("Search riddles").fill("The Same Number");
  await page
    .getByRole("button", { name: "Start The Same Number", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your reasoning", exact: true })
    .fill(
      "Equal scores can hide different learning processes. Ask for confidence, reasoning and a matched probe; keep interpretations tentative.",
    );
  await page
    .getByRole("button", { name: "Save progress", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Progress saved");
  await page.getByRole("button", { name: "Review & submit" }).click();
  await page
    .getByRole("button", { name: "Submit attempt", exact: true })
    .click();
  await expect(
    page.getByText("Your teacher will review this reflection"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue learning" }).click();
  await navigate(page, "My learning");
  await expect(page.getByText("1 awaiting teacher review")).toBeVisible();
  await noOverflow(page);
  // Student API authorization is independently checked through the active browser token.
  const studentToken = await page.evaluate(() =>
    sessionStorage.getItem("session"),
  );
  expect(
    (
      await request.get(apiBase + "/api/teacher/analytics", {
        headers: { Authorization: `Bearer ${studentToken}` },
      })
    ).status(),
  ).toBe(403);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await login(page, credentials.teacher, credentials.password);
  await navigate(page, "Review & grade");
  const panel = page
    .locator("section.panel")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .filter({ has: page.getByText("The Same Number", { exact: true }) });
  await panel.getByLabel("Marks before hint deduction").fill("8");
  await panel
    .getByLabel("Specific feedback")
    .fill("Good distinction. Consider delayed transfer evidence too.");
  await panel.getByRole("button", { name: "Save grade" }).click();
  await expect(panel.getByText("reviewed", { exact: true })).toBeVisible();
  await navigate(page, "Question bank");
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await page.getByLabel("Question title").fill(`Teacher-authored ${tag}`);
  await page
    .getByLabel("Question prompt")
    .fill("Explain which evidence would change your mind.");
  await page.getByLabel("Topic", { exact: true }).fill("Evidence");
  await page
    .getByLabel("Teacher grading rubric")
    .fill("10 points for justified evidence and uncertainty.");
  await page.getByLabel("Publish for students").check();
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Teacher-authored ${tag}`, exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('[{"title":"incomplete"}]'),
    });
  await expect(page.getByRole("alert")).toContainText("Row 1");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "example.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify([
          {
            title: `Imported ${tag}`,
            stem: "What term means applying learning elsewhere?",
            topic: "Transfer",
            kind: "text",
            marks: 5,
            accepted_answers: ["transfer"],
            published: true,
          },
        ]),
      ),
    });
  await expect(page.getByText("1 questions imported")).toBeVisible();
  await navigate(page, "Quizzes");
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await page.getByLabel("Quiz title").fill(`Evidence check ${tag}`);
  await page.getByLabel("Time limit (minutes)").fill("2");
  await page
    .getByRole("checkbox", { name: new RegExp(`Imported ${tag}`) })
    .check();
  await page.getByRole("checkbox", { name: new RegExp(name) }).check();
  await page.getByRole("checkbox", { name: /Publish quiz/ }).check();
  await page.getByRole("button", { name: "Save quiz", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `Evidence check ${tag}` }),
  ).toBeVisible();
  await navigate(page, "Class insights");
  await expect(
    page.getByRole("heading", { name: "Individual performance" }),
  ).toBeVisible();
  const csvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export results" }).click();
  expect((await csvPromise).suggestedFilename()).toBe("class-results.csv");
  await noOverflow(page);
  if (testInfo.project.name === "desktop")
    await page.screenshot({
      path: "/tmp/beyond-teacher-desktop.png",
      fullPage: true,
    });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await login(page, email, credentials.password);
  await navigate(page, "Quizzes");
  await page.getByRole("button", { name: "Start or resume" }).click();
  await page
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("transfer");
  await page.getByRole("button", { name: "Review & submit" }).click();
  await page
    .getByRole("button", { name: "Submit attempt", exact: true })
    .click();
  await expect(page.getByText("A well-reasoned step")).toBeVisible();
  await page.getByRole("button", { name: "Continue learning" }).click();
  await navigate(page, "Attempt history");
  await expect(page.getByText("Submitted", { exact: true })).toHaveCount(3);
  await navigate(page, "My learning");
  await expect(page.getByText("0 / 0")).toHaveCount(0);
  await expect(page.getByText("18 / 20", { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
  await noOverflow(page);
  if (testInfo.project.name === "mobile")
    await page.screenshot({
      path: "/tmp/beyond-student-mobile.png",
      fullPage: true,
    });
  expect(errors).toEqual([]);
});
