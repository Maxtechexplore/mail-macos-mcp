import { spawn } from "node:child_process";

/**
 * Erreur métier remontée à l'utilisateur (message en français, exploitable).
 */
export class MailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailError";
  }
}

/**
 * Séparateurs de champ / d'enregistrement utilisés pour sérialiser les listes
 * de mails renvoyées par AppleScript. Ce sont des caractères de contrôle ASCII
 * (Unit Separator / Record Separator) quasi impossibles à croiser dans un sujet
 * ou un expéditeur, ce qui rend le parsing robuste.
 */
export const FIELD_SEP = String.fromCharCode(31); // Unit Separator (US)
export const RECORD_SEP = String.fromCharCode(30); // Record Separator (RS)

/** Expressions AppleScript produisant ces mêmes caractères côté script. */
export const AS_FIELD_SEP = "(character id 31)";
export const AS_RECORD_SEP = "(character id 30)";

/**
 * Exécute un script AppleScript via `osascript` et renvoie sa sortie texte.
 * Le script est passé sur l'entrée standard pour éviter tout problème de
 * quoting sur les scripts multi-lignes.
 */
export function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("osascript", []);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    proc.on("error", (err) =>
      reject(new MailError(`Impossible de lancer osascript : ${err.message}`)),
    );

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.replace(/\n$/, ""));
      } else {
        reject(new MailError(translateError(stderr.trim())));
      }
    });

    proc.stdin.write(script);
    proc.stdin.end();
  });
}

/**
 * Transforme les erreurs brutes d'osascript en messages clairs en français.
 */
function translateError(stderr: string): string {
  if (!stderr) {
    return "Erreur inconnue lors de la communication avec l'app Mail.";
  }
  if (stderr.includes("NOT_FOUND")) {
    return "Aucun mail trouvé avec cet identifiant. Il a peut-être été déplacé ou supprimé.";
  }
  if (stderr.includes("MAILBOX_NOT_FOUND")) {
    return "Dossier introuvable. Vérifie le nom exact du dossier dans l'app Mail.";
  }
  // -1743 = l'utilisateur n'a pas accordé l'autorisation d'automatisation.
  if (
    stderr.includes("-1743") ||
    stderr.toLowerCase().includes("not authorized") ||
    stderr.toLowerCase().includes("not allowed")
  ) {
    return (
      "macOS n'autorise pas le contrôle de Mail. Va dans Réglages Système > " +
      "Confidentialité et sécurité > Automatisation, et autorise Claude à contrôler Mail. " +
      "(Une fenêtre de demande d'autorisation s'affiche normalement au premier usage.)"
    );
  }
  // -600 = l'application n'est pas lancée (rare, le `tell` la lance en principe).
  if (stderr.includes("-600")) {
    return "L'app Mail ne semble pas lancée. Ouvre-la puis réessaie.";
  }
  return `Erreur AppleScript : ${stderr}`;
}

/**
 * Échappe une chaîne pour l'insérer dans un littéral de chaîne AppleScript.
 * Gère antislash, guillemets et sauts de ligne (transformés en `linefeed`).
 * Renvoie une expression AppleScript complète (avec ses guillemets).
 */
export function asStr(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  // Reconstruit les sauts de ligne via concaténation AppleScript.
  const withNewlines = escaped
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, '" & linefeed & "');
  return `"${withNewlines}"`;
}
