import {
  runOsascript,
  asStr,
  FIELD_SEP,
  RECORD_SEP,
  MailError,
} from "./applescript.js";

/** Résumé d'un mail tel que renvoyé par les listes / recherches. */
export interface ResumeMail {
  id: number;
  expediteur: string;
  sujet: string;
  date: string;
  lu: boolean;
}

/** Contenu complet d'un mail. */
export interface MailComplet extends ResumeMail {
  corps: string;
}

/**
 * Handler AppleScript réutilisable : retrouve un message par son identifiant
 * interne Mail. Cherche d'abord dans la boîte de réception (cas courant) puis,
 * en repli, dans toutes les boîtes de tous les comptes.
 */
const FIND_MESSAGE_HANDLER = `
on findMessage(theId)
  tell application "Mail"
    set hits to (messages of inbox whose id is theId)
    if (count of hits) > 0 then return item 1 of hits
    repeat with acct in accounts
      repeat with mb in mailboxes of acct
        set hits to (messages of mb whose id is theId)
        if (count of hits) > 0 then return item 1 of hits
      end repeat
    end repeat
    error "NOT_FOUND"
  end tell
end findMessage
`;

/** Découpe la sortie AppleScript en résumés de mails. */
function parseResumes(raw: string): ResumeMail[] {
  if (!raw) return [];
  return raw
    .split(RECORD_SEP)
    .filter((r) => r.length > 0)
    .map((record) => {
      const [id, expediteur, sujet, date, lu] = record.split(FIELD_SEP);
      return {
        id: Number(id),
        expediteur: expediteur ?? "",
        sujet: sujet ?? "",
        date: date ?? "",
        lu: lu === "true",
      };
    });
}

/** Construit les lignes `make new to recipient` à partir d'une liste d'adresses. */
function recipientsBlock(destinataires: string): string {
  const adresses = destinataires
    .split(/[,;]/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
  if (adresses.length === 0) {
    throw new MailError("Aucun destinataire valide fourni.");
  }
  return adresses
    .map(
      (a) =>
        `    make new to recipient at end of to recipients with properties {address:${asStr(
          a,
        )}}`,
    )
    .join("\n");
}

/**
 * Liste les N derniers mails de la boîte de réception.
 * @param filtre "tous" ou "non_lus"
 * @param expediteur filtre optionnel sur l'expéditeur (sous-chaîne)
 * @param limite nombre maximum de mails à renvoyer
 */
export async function listerMails(opts: {
  filtre: "tous" | "non_lus";
  expediteur?: string;
  limite: number;
}): Promise<ResumeMail[]> {
  const conditions: string[] = [];
  if (opts.filtre === "non_lus") conditions.push("read status is false");
  if (opts.expediteur) conditions.push(`sender contains ${asStr(opts.expediteur)}`);
  const whose =
    conditions.length > 0 ? ` whose ${conditions.join(" and ")}` : "";

  const script = `
tell application "Mail"
  set FS to (character id 31)
  set RS to (character id 30)
  set theMessages to (messages of inbox${whose})
  set total to count of theMessages
  set maxN to ${opts.limite}
  if total < maxN then set maxN to total
  set output to ""
  repeat with i from 1 to maxN
    set m to item i of theMessages
    set output to output & (id of m) & FS & (sender of m) & FS & (subject of m) & FS & ((date received of m) as string) & FS & (read status of m) & RS
  end repeat
  return output
end tell
`;
  return parseResumes(await runOsascript(script));
}

/**
 * Recherche dans les mails récents de la boîte de réception.
 * Parcourt les mails du plus récent au plus ancien (jusqu'à 400) et renvoie
 * jusqu'à `limite` correspondances.
 */
export async function rechercherMails(opts: {
  motCle: string;
  expediteur?: string;
  depuisJours?: number;
  inclureCorps: boolean;
  limite: number;
}): Promise<ResumeMail[]> {
  const kw = asStr(opts.motCle);
  const corpsCheck = opts.inclureCorps
    ? `    if (not matchFlag) then
      try
        if (content of m contains ${kw}) then set matchFlag to true
      end try
    end if`
    : "";
  const expediteurCheck = opts.expediteur
    ? `    if matchFlag and (sender of m does not contain ${asStr(
        opts.expediteur,
      )}) then set matchFlag to false`
    : "";
  const dateSetup =
    opts.depuisJours !== undefined
      ? `  set cutoff to (current date) - (${opts.depuisJours} * days)`
      : "";
  const dateCheck =
    opts.depuisJours !== undefined
      ? `    if matchFlag and ((date received of m) < cutoff) then set matchFlag to false`
      : "";

  const script = `
tell application "Mail"
  set FS to (character id 31)
  set RS to (character id 30)
${dateSetup}
  set theMessages to messages of inbox
  set total to count of theMessages
  set scanMax to 400
  if total < scanMax then set scanMax to total
  set maxN to ${opts.limite}
  set output to ""
  set found to 0
  repeat with i from 1 to scanMax
    if found ≥ maxN then exit repeat
    set m to item i of theMessages
    set matchFlag to false
    if (subject of m contains ${kw}) then set matchFlag to true
    if (not matchFlag) and (sender of m contains ${kw}) then set matchFlag to true
${corpsCheck}
${expediteurCheck}
${dateCheck}
    if matchFlag then
      set output to output & (id of m) & FS & (sender of m) & FS & (subject of m) & FS & ((date received of m) as string) & FS & (read status of m) & RS
      set found to found + 1
    end if
  end repeat
  return output
end tell
`;
  return parseResumes(await runOsascript(script));
}

/** Renvoie le contenu complet d'un mail à partir de son identifiant. */
export async function lireMail(id: number): Promise<MailComplet> {
  const script = `${FIND_MESSAGE_HANDLER}
set m to findMessage(${id})
tell application "Mail"
  set FS to (character id 31)
  return "" & (id of m) & FS & (sender of m) & FS & (subject of m) & FS & ((date received of m) as string) & FS & (read status of m) & FS & (content of m)
end tell
`;
  const raw = await runOsascript(script);
  const [mid, expediteur, sujet, date, lu, ...corpsParts] = raw.split(FIELD_SEP);
  return {
    id: Number(mid),
    expediteur: expediteur ?? "",
    sujet: sujet ?? "",
    date: date ?? "",
    lu: lu === "true",
    corps: corpsParts.join(FIELD_SEP),
  };
}

/** Crée un brouillon dans Mail (sans l'envoyer). */
export async function creerBrouillon(opts: {
  destinataire: string;
  sujet: string;
  corps: string;
}): Promise<void> {
  const script = `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:${asStr(
    opts.sujet,
  )}, content:${asStr(opts.corps)}, visible:false}
  tell newMsg
${recipientsBlock(opts.destinataire)}
  end tell
  save newMsg
end tell
`;
  await runOsascript(script);
}

/** Envoie un mail. À utiliser avec précaution (action sortante). */
export async function envoyerMail(opts: {
  destinataire: string;
  sujet: string;
  corps: string;
}): Promise<void> {
  const script = `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:${asStr(
    opts.sujet,
  )}, content:${asStr(opts.corps)}, visible:false}
  tell newMsg
${recipientsBlock(opts.destinataire)}
  end tell
  send newMsg
end tell
`;
  await runOsascript(script);
}

/** Marque un mail comme lu ou non lu. */
export async function marquerMail(id: number, lu: boolean): Promise<void> {
  const script = `${FIND_MESSAGE_HANDLER}
set m to findMessage(${id})
tell application "Mail"
  set read status of m to ${lu ? "true" : "false"}
end tell
`;
  await runOsascript(script);
}

/** Déplace un mail vers un dossier (boîte aux lettres) par son nom. */
export async function deplacerMail(id: number, dossier: string): Promise<void> {
  const script = `${FIND_MESSAGE_HANDLER}
set m to findMessage(${id})
tell application "Mail"
  set targetMb to missing value
  repeat with acct in accounts
    try
      set targetMb to mailbox ${asStr(dossier)} of acct
    end try
  end repeat
  if targetMb is missing value then
    try
      set targetMb to mailbox ${asStr(dossier)}
    end try
  end if
  if targetMb is missing value then error "MAILBOX_NOT_FOUND"
  move m to targetMb
end tell
`;
  await runOsascript(script);
}

/** Déplace un mail vers la Corbeille (récupérable, pas de suppression définitive). */
export async function mettreCorbeille(id: number): Promise<void> {
  const script = `${FIND_MESSAGE_HANDLER}
set m to findMessage(${id})
tell application "Mail"
  delete m
end tell
`;
  await runOsascript(script);
}
