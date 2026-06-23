import test from "node:test";
import assert from "node:assert";
import { parseResumes } from "../dist/mail.js";
import { FIELD_SEP, RECORD_SEP } from "../dist/applescript.js";

test("parseResumes: enregistrement simple", () => {
  const raw = ["27904", "Bob <b@x.com>", "Sujet", "hier", "false"].join(FIELD_SEP) + RECORD_SEP;
  const r = parseResumes(raw);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { id: 27904, expediteur: "Bob <b@x.com>", sujet: "Sujet", date: "hier", lu: false });
});

test("parseResumes: chaîne vide -> tableau vide", () => {
  assert.deepEqual(parseResumes(""), []);
});

test("parseResumes: lu=true correctement interprété", () => {
  const raw = ["1", "A", "S", "d", "true"].join(FIELD_SEP) + RECORD_SEP;
  assert.equal(parseResumes(raw)[0].lu, true);
});
