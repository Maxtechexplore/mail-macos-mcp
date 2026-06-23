import { runOsascript, FIELD_SEP, asStr } from "./applescript.js";
import {
  buildListerScript,
  buildRechercherScript,
  buildLireScript,
  buildMarquerScript,
  buildDeplacerScript,
  buildCorbeilleScript,
  buildListerComptesScript,
  recipientLines,
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

/** Crée un brouillon dans Mail (sans l'envoyer). */
export async function creerBrouillon(opts: {
  destinataire: string;
  sujet: string;
  corps: string;
}): Promise<void> {
  const script = `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:${asStr(opts.sujet)}, content:${asStr(opts.corps)}, visible:false}
  tell newMsg
${recipientLines(opts.destinataire, "to")}
  end tell
  save newMsg
end tell
`;
  await runOsascript(script);
}

/** Envoie un mail. A utiliser avec précaution (action sortante). */
export async function envoyerMail(opts: {
  destinataire: string;
  sujet: string;
  corps: string;
}): Promise<void> {
  const script = `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:${asStr(opts.sujet)}, content:${asStr(opts.corps)}, visible:false}
  tell newMsg
${recipientLines(opts.destinataire, "to")}
  end tell
  send newMsg
end tell
`;
  await runOsascript(script);
}
