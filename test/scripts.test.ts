import test from "node:test";
import assert from "node:assert";
import {
  buildListerScript,
  buildRechercherScript,
  buildLireScript,
  recipientsBlock,
  buildComposeScript,
  buildRepondreScript,
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

test("buildComposeScript: save vs send", () => {
  const draft = buildComposeScript({ destinataire: "a@x.com", sujet: "S", corps: "B", action: "save" });
  assert.ok(draft.trimEnd().includes("save newMsg"));
  const sent = buildComposeScript({ destinataire: "a@x.com", sujet: "S", corps: "B", action: "send" });
  assert.ok(sent.trimEnd().includes("send newMsg"));
});

test("buildComposeScript: cc et cci ajoutent les bons recipients", () => {
  const s = buildComposeScript({ destinataire: "a@x.com", sujet: "S", corps: "B", cc: "c@x.com", cci: "d@x.com", action: "save" });
  assert.ok(s.includes("make new cc recipient"));
  assert.ok(s.includes('{address:"c@x.com"}'));
  assert.ok(s.includes("make new bcc recipient"));
  assert.ok(s.includes('{address:"d@x.com"}'));
});

test("buildComposeScript: expediteur pose le sender", () => {
  const s = buildComposeScript({ destinataire: "a@x.com", sujet: "S", corps: "B", expediteur: "me@x.com", action: "send" });
  assert.ok(s.includes('set sender of newMsg to "me@x.com"'));
});

test("buildComposeScript: sans expediteur ne pose pas de sender", () => {
  const s = buildComposeScript({ destinataire: "a@x.com", sujet: "S", corps: "B", action: "save" });
  assert.ok(!s.includes("set sender of newMsg"));
});

test("buildRepondreScript: utilise reply, préfixe le corps et respecte reply to all", () => {
  const s = buildRepondreScript({ id: 7, corps: "Bonjour", repondreATous: true, action: "save" });
  assert.ok(s.includes("findMessage(7)"));
  assert.ok(s.includes("reply m opening window false reply to all true"));
  assert.ok(s.includes('set content of newMsg to "Bonjour"'));
  assert.ok(s.trimEnd().includes("save newMsg"));
});

test("buildRepondreScript: envoyer -> send, et cc ajouté", () => {
  const s = buildRepondreScript({ id: 9, corps: "X", repondreATous: false, cc: "c@x.com", action: "send" });
  assert.ok(s.includes("reply to all false"));
  assert.ok(s.includes("make new cc recipient"));
  assert.ok(s.trimEnd().includes("send newMsg"));
});
