const assert = require("node:assert/strict");
const test = require("node:test");

const { validateEnv } = require("../api/src/config/validateEnv");

test("validateEnv accepts development essentials", () => {
  const previous = { ...process.env };
  process.env.MONGODB_URI = "mongodb://localhost/test";
  process.env.AI_SERVICE_URL = "http://localhost:4100/api/ai/analyze";
  process.env.NODE_ENV = "development";
  assert.doesNotThrow(() => validateEnv());
  process.env = previous;
});

test("validateEnv rejects missing required values", () => {
  const previous = { ...process.env };
  delete process.env.MONGODB_URI;
  process.env.AI_SERVICE_URL = "http://localhost:4100/api/ai/analyze";
  process.env.NODE_ENV = "development";
  assert.throws(() => validateEnv(), /MONGODB_URI/);
  process.env = previous;
});
