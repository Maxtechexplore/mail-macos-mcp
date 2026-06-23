import test from "node:test";
import assert from "node:assert";
import {
  buildListerScript,
  buildRechercherScript,
  buildLireScript,
  recipientsBlock,
} from "../dist/scripts.js";

test("buildListerScript: filtre tous n'ajoute pas de clause whose", () => {
  const s = buildListerScript({ filtre: "tous", limite: 10 });
  assert.ok(s.includes("messages of inbox"));
  assert.ok(!s.includes("whose"));
  assert.ok(s.includes("set maxN to 10"));
});

test("buildListerScript: non_lus ajoute read status is false", () => {
  const s = buildListerScript({ filtre: "non_lus", limite: 5 });
  assert.ok(s.includes("read status is false"));
});

test("buildListerScript: expediteur ajoute sender contains", () => {
  const s = buildListerScript({ filtre: "tous", expediteur: "bob@x.com", limite: 3 });
  assert.ok(s.includes('sender contains "bob@x.com"'));
});

test("buildRechercherScript: inclureCorps ajoute content of m contains", () => {
  const s = buildRechercherScript({ motCle: "facture", inclureCorps: true, limite: 10 });
  assert.ok(s.includes('subject of m contains "facture"'));
  assert.ok(s.includes("content of m contains"));
});

test("buildRechercherScript: sans corps ne cherche pas dans le contenu", () => {
  const s = buildRechercherScript({ motCle: "x", inclureCorps: false, limite: 10 });
  assert.ok(!s.includes("content of m contains"));
});

test("buildLireScript: amorce la concaténation avec une chaîne vide", () => {
  const s = buildLireScript(42);
  assert.ok(s.includes("findMessage(42)"));
  assert.ok(s.includes('"" & (id of m)'));
});

test("recipientsBlock: un destinataire", () => {
  const b = recipientsBlock({ to: "a@x.com" });
  assert.ok(b.includes('{address:"a@x.com"}'));
});

test("recipientsBlock: plusieurs destinataires", () => {
  const b = recipientsBlock({ to: "a@x.com, b@y.com" });
  assert.ok(b.includes('{address:"a@x.com"}'));
  assert.ok(b.includes('{address:"b@y.com"}'));
});

test("recipientsBlock: aucun destinataire lève une erreur", () => {
  assert.throws(() => recipientsBlock({ to: "   " }));
});
