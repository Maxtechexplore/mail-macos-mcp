import test from "node:test";
import assert from "node:assert";
import { resolveExpediteur } from "../dist/mail.js";

const comptes = [
  { nom: "Perso", emails: ["a@x.com", "a2@x.com"] },
  { nom: "Pro", emails: ["b@y.com"] },
];

test("resolveExpediteur: adresse connue (insensible à la casse) renvoie l'adresse", () => {
  assert.equal(resolveExpediteur("B@Y.com", comptes), "b@y.com");
});

test("resolveExpediteur: adresse secondaire d'un compte", () => {
  assert.equal(resolveExpediteur("a2@x.com", comptes), "a2@x.com");
});

test("resolveExpediteur: adresse inconnue lève une MailError listant les comptes", () => {
  assert.throws(() => resolveExpediteur("z@nope.com", comptes), /Comptes disponibles/);
});
