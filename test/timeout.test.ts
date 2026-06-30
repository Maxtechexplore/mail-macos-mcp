import test from "node:test";
import assert from "node:assert";
import { runOsascript, MailError } from "../dist/applescript.js";

test("runOsascript: abandonne avec une erreur de délai si le script dépasse le timeout", async () => {
  process.env.MAIL_MCP_TIMEOUT_MS = "500";
  const start = Date.now();
  await assert.rejects(
    () => runOsascript("delay 60"),
    (e: unknown) => e instanceof MailError && /délai/.test((e as Error).message),
  );
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 5000, `devrait abandonner vite, a pris ${elapsed}ms`);
  delete process.env.MAIL_MCP_TIMEOUT_MS;
});
