import assert from "node:assert/strict";
import test from "node:test";

import { findCanonicalFluorophore } from "../src/fluorophore-matching.ts";

const candidates = ["PerCP-Cy5.5", "PerCP", "PerCP eFluor 710"];

test("canonicalizes PerCP-Cy5.5 separator and case variants", () => {
  for (const variant of [
    "PerCP-Cy5.5",
    "PerCP Cy5.5",
    "PerCP cY5.5",
    "PerCP–Cy5.5",
    "PerCP‑Cy5.5",
  ]) {
    assert.equal(findCanonicalFluorophore([variant], candidates), "PerCP-Cy5.5");
  }
});

test("keeps plain PerCP distinct from PerCP-Cy5.5", () => {
  assert.equal(findCanonicalFluorophore(["PerCP"], candidates), "PerCP");
});

test("uses the configured canonical candidate when aliases normalize equally", () => {
  assert.equal(
    findCanonicalFluorophore(["Alexa 700"], ["Alexa Fluor 700", "Alexa 700"]),
    "Alexa Fluor 700",
  );
});
