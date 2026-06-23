import { runOsascript, FIELD_SEP, MailError } from "./applescript.js";
import {
  buildListerScript,
  buildRechercherScript,
  buildLireScript,
  buildMarquerScript,
  buildDeplacerScript,
  buildCorbeilleScript,
  buildListerComptesScript,
  buildComposeScript,
  buildRepondreScript,
  buildTransfererScript,
} from "./scripts.js";

export interface ResumeMail { id: number; expediteur: string; sujet: string; date: string; lu: boolean; }
export interface MailComplet extends ResumeMail { corps: string; }
export interface Compte { nom: string; emails: string[]; }

export function parseResumes(raw: string): ResumeMail[] {
  if (!raw) return [];
  return raw
    .split(String.fromCharCode(30))
    .filter((r) => r.length > 0)
    .map((record) => {
      const [id, expediteur, sujet, date, lu] = record.split(FIELD_SEP);
      return { id: Number(id), expediteur: expediteur ?? "", sujet: sujet ?? "", date: date ?? "", lu: lu === "true" };
    });
}

export async function listerMails(opts: { filtre: "tous" | "non_lus"; expediteur?: string; limite: number }): Promise<ResumeMail[]> {
  return parseResumes(await runOsascript(buildListerScript(opts)));
}

export function parseComptes(raw: string): Compte[] {
  if (!raw) return [];
  return raw
    .split(String.fromCharCode(30))
    .filter((r) => r.length > 0)
    .map((record) => {
      const [nom, addrCsv] = record.split(FIELD_SEP);
      const emails = (addrCsv ?? "").split(",").map((e) => e.trim()).filter((e) => e.length > 0);
      return { nom: nom ?? "", emails };
    });
}

export async function listerComptes(): Promise<Compte[]> {
  return parseComptes(await runOsascript(buildListerComptesScript()));
}

export async function rechercherMails(opts: { motCle: string; expediteur?: string; depuisJours?: number; inclureCorps: boolean; limite: number }): Promise<ResumeMail[]> {
  return parseResumes(await runOsascript(buildRechercherScript(opts)));
}

export async function lireMail(id: number): Promise<MailComplet> {
  const raw = await runOsascript(buildLireScript(id));
  const [mid, expediteur, sujet, date, lu, ...corpsParts] = raw.split(FIELD_SEP);
  return { id: Number(mid), expediteur: expediteur ?? "", sujet: sujet ?? "", date: date ?? "", lu: lu === "true", corps: corpsParts.join(FIELD_SEP) };
}

export async function marquerMail(id: number, lu: boolean): Promise<void> {
  await runOsascript(buildMarquerScript(id, lu));
}

export async function deplacerMail(id: number, dossier: string): Promise<void> {
  await runOsascript(buildDeplacerScript(id, dossier));
}

export async function mettreCorbeille(id: number): Promise<void> {
  await runOsascript(buildCorbeilleScript(id));
}

interface ComposeOpts { destinataire: string; sujet: string; corps: string; cc?: string; cci?: string; expediteur?: string; }

/** Crée un brouillon dans Mail (sans l'envoyer). */
export async function creerBrouillon(o: ComposeOpts): Promise<void> {
  const expediteur = await resolveExpediteurMaybe(o.expediteur);
  await runOsascript(buildComposeScript({ ...o, expediteur, action: "save" }));
}

/** Envoie un mail. A utiliser avec précaution (action sortante). */
export async function envoyerMail(o: ComposeOpts): Promise<void> {
  const expediteur = await resolveExpediteurMaybe(o.expediteur);
  await runOsascript(buildComposeScript({ ...o, expediteur, action: "send" }));
}

export function resolveExpediteur(expediteur: string, comptes: Compte[]): string {
  const cible = expediteur.trim().toLowerCase();
  for (const c of comptes) {
    for (const e of c.emails) {
      if (e.trim().toLowerCase() === cible) return e.trim();
    }
  }
  const dispo = comptes.flatMap((c) => c.emails).join(", ");
  throw new MailError(`Adresse expéditrice « ${expediteur} » inconnue. Comptes disponibles : ${dispo || "(aucun)"}.`);
}

async function resolveExpediteurMaybe(expediteur?: string): Promise<string | undefined> {
  if (!expediteur) return undefined;
  return resolveExpediteur(expediteur, await listerComptes());
}

export async function repondreMail(o: { id: number; corps: string; repondreATous: boolean; cc?: string; cci?: string; expediteur?: string; envoyer: boolean }): Promise<void> {
  const expediteur = await resolveExpediteurMaybe(o.expediteur);
  await runOsascript(buildRepondreScript({ ...o, expediteur, action: o.envoyer ? "send" : "save" }));
}

export async function transfererMail(o: { id: number; destinataire: string; corps?: string; cc?: string; cci?: string; expediteur?: string; envoyer: boolean }): Promise<void> {
  const expediteur = await resolveExpediteurMaybe(o.expediteur);
  await runOsascript(buildTransfererScript({ ...o, expediteur, action: o.envoyer ? "send" : "save" }));
}
