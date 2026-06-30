import { asStr, MailError } from "./applescript.js";

// Recherche bornée dans la boîte de réception uniquement, par accès indexé.
// Les identifiants proviennent toujours d'un lister/rechercher (donc de la boîte
// de réception). On évite tout `whose` et tout parcours des dossiers serveur, qui
// peuvent figer Mail sur un gros compte synchronisé.
export const FIND_MESSAGE_HANDLER = `
on findMessage(theId)
  tell application "Mail"
    set theMessages to messages of inbox
    repeat with i from 1 to 200
      try
        set m to item i of theMessages
      on error
        exit repeat
      end try
      if (id of m) is theId then return m
    end repeat
    error "NOT_FOUND"
  end tell
end findMessage
`;

export function recipientLines(adresses: string, kind: "to" | "cc" | "bcc"): string {
  const list = adresses.split(/[,;]/).map((a) => a.trim()).filter((a) => a.length > 0);
  return list
    .map((a) => `    make new ${kind} recipient at end of ${kind} recipients with properties {address:${asStr(a)}}`)
    .join("\n");
}

export function recipientsBlock(opts: { to: string; cc?: string; cci?: string }): string {
  const toLines = recipientLines(opts.to, "to");
  if (!toLines) throw new MailError("Aucun destinataire valide fourni.");
  const parts = [toLines];
  if (opts.cc) { const l = recipientLines(opts.cc, "cc"); if (l) parts.push(l); }
  if (opts.cci) { const l = recipientLines(opts.cci, "bcc"); if (l) parts.push(l); }
  return parts.join("\n");
}

export function extraRecipientsBlock(cc?: string, cci?: string): string {
  const parts: string[] = [];
  if (cc) { const l = recipientLines(cc, "cc"); if (l) parts.push(l); }
  if (cci) { const l = recipientLines(cci, "bcc"); if (l) parts.push(l); }
  return parts.join("\n");
}

export function senderLine(adresse?: string): string {
  return adresse ? `  set sender of newMsg to ${asStr(adresse)}\n` : "";
}

export function buildComposeScript(o: { destinataire: string; sujet: string; corps: string; cc?: string; cci?: string; expediteur?: string; action: "save" | "send" }): string {
  return `
tell application "Mail"
  set newMsg to make new outgoing message with properties {subject:${asStr(o.sujet)}, content:${asStr(o.corps)}, visible:false}
  tell newMsg
${recipientsBlock({ to: o.destinataire, cc: o.cc, cci: o.cci })}
  end tell
${senderLine(o.expediteur)}  ${o.action} newMsg
end tell
`;
}

export function buildListerScript(o: { filtre: "tous" | "non_lus"; expediteur?: string; limite: number }): string {
  const nonLus = o.filtre === "non_lus" ? `    if (read status of m) is true then set keep to false\n` : "";
  const expediteurCheck = o.expediteur
    ? `    if keep and (sender of m does not contain ${asStr(o.expediteur)}) then set keep to false\n`
    : "";
  // Borne de scan : pour "tous" sans filtre, on s'arrête à maxN ; sinon on
  // parcourt une fenêtre récente bornée pour trouver maxN correspondances.
  const scanBound = o.filtre === "non_lus" || o.expediteur ? 120 : o.limite;
  return `
tell application "Mail"
  set FS to (character id 31)
  set RS to (character id 30)
  set theMessages to messages of inbox
  set output to ""
  set found to 0
  set maxN to ${o.limite}
  repeat with i from 1 to ${scanBound}
    if found ≥ maxN then exit repeat
    try
      set m to item i of theMessages
    on error
      exit repeat
    end try
    set keep to true
${nonLus}${expediteurCheck}    if keep then
      set output to output & (id of m) & FS & (sender of m) & FS & (subject of m) & FS & ((date received of m) as string) & FS & (read status of m) & RS
      set found to found + 1
    end if
  end repeat
  return output
end tell
`;
}

export function buildRechercherScript(o: { motCle: string; expediteur?: string; depuisJours?: number; inclureCorps: boolean; limite: number }): string {
  const kw = asStr(o.motCle);
  const corpsCheck = o.inclureCorps
    ? `    if (not matchFlag) then
      try
        if (content of m contains ${kw}) then set matchFlag to true
      end try
    end if
`
    : "";
  const expediteurCheck = o.expediteur
    ? `    if matchFlag and (sender of m does not contain ${asStr(o.expediteur)}) then set matchFlag to false\n`
    : "";
  const dateSetup = o.depuisJours !== undefined ? `  set cutoff to (current date) - (${o.depuisJours} * days)\n` : "";
  const dateCheck = o.depuisJours !== undefined ? `    if matchFlag and ((date received of m) < cutoff) then set matchFlag to false\n` : "";
  // Fenêtre de scan bornée (les mails sont lus un par un). Plus courte si on
  // fouille aussi le corps, plus coûteux à charger.
  const scanBound = o.inclureCorps ? 80 : 150;
  return `
tell application "Mail"
  set FS to (character id 31)
  set RS to (character id 30)
${dateSetup}  set theMessages to messages of inbox
  set output to ""
  set found to 0
  set maxN to ${o.limite}
  repeat with i from 1 to ${scanBound}
    if found ≥ maxN then exit repeat
    try
      set m to item i of theMessages
    on error
      exit repeat
    end try
    set matchFlag to false
    if (subject of m contains ${kw}) then set matchFlag to true
    if (not matchFlag) and (sender of m contains ${kw}) then set matchFlag to true
${corpsCheck}${expediteurCheck}${dateCheck}    if matchFlag then
      set output to output & (id of m) & FS & (sender of m) & FS & (subject of m) & FS & ((date received of m) as string) & FS & (read status of m) & RS
      set found to found + 1
    end if
  end repeat
  return output
end tell
`;
}

export function buildLireScript(id: number): string {
  return `${FIND_MESSAGE_HANDLER}
set m to findMessage(${id})
tell application "Mail"
  set FS to (character id 31)
  return "" & (id of m) & FS & (sender of m) & FS & (subject of m) & FS & ((date received of m) as string) & FS & (read status of m) & FS & (content of m)
end tell
`;
}

export function buildMarquerScript(id: number, lu: boolean): string {
  return `${FIND_MESSAGE_HANDLER}
set m to findMessage(${id})
tell application "Mail"
  set read status of m to ${lu ? "true" : "false"}
end tell
`;
}

export function buildDeplacerScript(id: number, dossier: string): string {
  return `${FIND_MESSAGE_HANDLER}
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
}

export function buildCorbeilleScript(id: number): string {
  return `${FIND_MESSAGE_HANDLER}
set m to findMessage(${id})
tell application "Mail"
  delete m
end tell
`;
}

export function buildRepondreScript(o: { id: number; corps: string; repondreATous: boolean; cc?: string; cci?: string; expediteur?: string; action: "save" | "send" }): string {
  const extra = extraRecipientsBlock(o.cc, o.cci);
  const extraBlock = extra ? `${extra}\n` : "";
  const replyAllBlock = o.repondreATous
    ? `  set ownAddrs to {}
  repeat with acct in accounts
    set ownAddrs to ownAddrs & (email addresses of acct)
  end repeat
  repeat with r in ((to recipients of m) & (cc recipients of m))
    set ra to (address of r)
    if (ra is not replyAddr) and (ownAddrs does not contain ra) then
      try
        make new cc recipient at end of cc recipients of newMsg with properties {address:ra}
      end try
    end if
  end repeat
`
    : "";
  return `${FIND_MESSAGE_HANDLER}
set m to findMessage(${o.id})
tell application "Mail"
  set origSender to sender of m
  set origSubject to subject of m
  set origDate to (date received of m) as string
  set replyAddr to extract address from origSender
  set subj to origSubject
  if subj does not start with "Re:" then set subj to "Re: " & subj
  set quoted to "Le " & origDate & ", " & origSender & " a écrit :" & linefeed & (content of m)
  set bodyText to ${asStr(o.corps)} & linefeed & linefeed & quoted
  set newMsg to make new outgoing message with properties {subject:subj, content:bodyText, visible:false}
  tell newMsg
    make new to recipient at end of to recipients with properties {address:replyAddr}
${extraBlock}  end tell
${replyAllBlock}${senderLine(o.expediteur)}  ${o.action} newMsg
end tell
`;
}

export function buildTransfererScript(o: { id: number; destinataire: string; corps?: string; cc?: string; cci?: string; expediteur?: string; action: "save" | "send" }): string {
  const corpsPrefix = o.corps ? `${asStr(o.corps)} & linefeed & linefeed & ` : "";
  return `${FIND_MESSAGE_HANDLER}
set m to findMessage(${o.id})
tell application "Mail"
  set origSender to sender of m
  set origSubject to subject of m
  set origDate to (date received of m) as string
  set subj to origSubject
  if subj does not start with "Tr:" then set subj to "Tr: " & subj
  set entete to "---------- Message transféré ----------" & linefeed & "De : " & origSender & linefeed & "Date : " & origDate & linefeed & "Objet : " & origSubject & linefeed & linefeed & (content of m)
  set bodyText to ${corpsPrefix}entete
  set newMsg to make new outgoing message with properties {subject:subj, content:bodyText, visible:false}
  tell newMsg
${recipientsBlock({ to: o.destinataire, cc: o.cc, cci: o.cci })}
  end tell
${senderLine(o.expediteur)}  ${o.action} newMsg
end tell
`;
}

// Vérifie l'accès à Mail sans toucher aux messages (très léger). Sert au
// diagnostic : si cet appel répond, l'autorisation et le lancement de Mail sont OK.
export function buildTesterAccesScript(): string {
  return `tell application "Mail" to return name of every account`;
}

export function buildListerComptesScript(): string {
  return `
tell application "Mail"
  set FS to (character id 31)
  set RS to (character id 30)
  set output to ""
  repeat with acct in accounts
    set addrs to email addresses of acct
    set addrStr to ""
    repeat with a in addrs
      if addrStr is not "" then set addrStr to addrStr & ", "
      set addrStr to addrStr & a
    end repeat
    set output to output & (name of acct) & FS & addrStr & RS
  end repeat
  return output
end tell
`;
}
