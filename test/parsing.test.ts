import test from "node:test";
import assert from "node:assert";
import { parseResumes, parseComptes } from "../dist/mail.js";
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

test("parseComptes: un compte multi-adresses", () => {
  const raw = ["Perso", "a@x.com, a2@x.com"].join(FIELD_SEP) + RECORD_SEP
            + ["Pro", "b@y.com"].join(FIELD_SEP) + RECORD_SEP;
  const c = parseComptes(raw);
  assert.equal(c.length, 2);
  assert.deepEqual(c[0], { nom: "Perso", emails: ["a@x.com", "a2@x.com"] });
  assert.deepEqual(c[1], { nom: "Pro", emails: ["b@y.com"] });
});

test("parseComptes: vide -> tableau vide", () => {
  assert.deepEqual(parseComptes(""), []);
});
