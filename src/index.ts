#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  listerMails,
  rechercherMails,
  lireMail,
  creerBrouillon,
  envoyerMail,
  repondreMail,
  transfererMail,
  marquerMail,
  deplacerMail,
  mettreCorbeille,
  listerComptes,
  type ResumeMail,
} from "./mail.js";
import { MailError } from "./applescript.js";

const server = new McpServer({
  name: "mail-macos-mcp",
  version: "1.1.0",
});

/** Type minimal du retour attendu par le SDK pour un outil. */
type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

/** Réponse texte simple. */
function texte(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/** Réponse d'erreur exploitable par le modèle. */
function erreur(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Enrobe un handler d'outil : convertit les MailError (et autres) en réponse
 * d'erreur propre plutôt qu'en exception non gérée.
 */
function safe<A>(handler: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await handler(args);
    } catch (e) {
      if (e instanceof MailError) return erreur(e.message);
      return erreur(`Erreur inattendue : ${(e as Error).message}`);
    }
  };
}

/** Formate une liste de mails pour affichage par le modèle. */
function formatResumes(mails: ResumeMail[]): string {
  if (mails.length === 0) return "Aucun mail trouvé.";
  return mails
    .map(
      (m) =>
        `• [id ${m.id}] ${m.lu ? "" : "(non lu) "}${m.sujet || "(sans sujet)"}\n` +
        `   De : ${m.expediteur}\n` +
        `   Date : ${m.date}`,
    )
    .join("\n\n");
}

// --- Comptes ---------------------------------------------------------------

server.registerTool(
  "lister_comptes",
  {
    title: "Lister les comptes",
    description:
      "Liste les comptes mail connectés à l'app Mail (nom et adresse(s) email). " +
      "Utile pour savoir depuis quelle adresse écrire avant de créer un brouillon ou d'envoyer.",
    inputSchema: {},
  },
  safe(async () => {
    const comptes = await listerComptes();
    if (comptes.length === 0) return texte("Aucun compte trouvé dans l'app Mail.");
    return texte(
      comptes.map((c) => `• ${c.nom} : ${c.emails.join(", ")}`).join("\n"),
    );
  }),
);

// --- Lecture ---------------------------------------------------------------

server.registerTool(
  "lister_mails",
  {
    title: "Lister les mails",
    description:
      "Liste les derniers mails de la boîte de réception (tous comptes confondus). " +
      "Permet de filtrer sur les non lus et/ou un expéditeur. Renvoie pour chaque " +
      "mail son identifiant (à réutiliser avec les autres outils), l'expéditeur, le " +
      "sujet, la date et le statut lu/non lu.",
    inputSchema: {
      filtre: z
        .enum(["tous", "non_lus"])
        .default("tous")
        .describe("'tous' ou 'non_lus' (par défaut 'tous')"),
      expediteur: z
        .string()
        .optional()
        .describe("Filtre optionnel : ne garde que les mails de cet expéditeur (sous-chaîne)"),
      limite: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Nombre maximum de mails à renvoyer (1 à 50, par défaut 10)"),
    },
  },
  safe(async ({ filtre, expediteur, limite }) => {
    const mails = await listerMails({ filtre, expediteur, limite });
    return texte(formatResumes(mails));
  }),
);

server.registerTool(
  "rechercher_mails",
  {
    title: "Rechercher des mails",
    description:
      "Recherche dans les mails récents de la boîte de réception (jusqu'aux 400 plus " +
      "récents). Cherche le mot-clé dans le sujet et l'expéditeur, et dans le corps si " +
      "'inclure_corps' est activé (plus lent). Filtres optionnels par expéditeur et par " +
      "ancienneté (depuis_jours).",
    inputSchema: {
      mot_cle: z.string().describe("Mot-clé à rechercher"),
      expediteur: z
        .string()
        .optional()
        .describe("Filtre optionnel sur l'expéditeur (sous-chaîne)"),
      depuis_jours: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Ne garder que les mails reçus depuis ce nombre de jours"),
      inclure_corps: z
        .boolean()
        .default(false)
        .describe("Rechercher aussi dans le corps du mail (plus lent). Défaut : false"),
      limite: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Nombre maximum de résultats (1 à 50, par défaut 10)"),
    },
  },
  safe(async ({ mot_cle, expediteur, depuis_jours, inclure_corps, limite }) => {
    const mails = await rechercherMails({
      motCle: mot_cle,
      expediteur,
      depuisJours: depuis_jours,
      inclureCorps: inclure_corps,
      limite,
    });
    return texte(formatResumes(mails));
  }),
);

server.registerTool(
  "lire_mail",
  {
    title: "Lire un mail",
    description:
      "Renvoie le contenu complet d'un mail (expéditeur, sujet, date, statut et corps) " +
      "à partir de son identifiant obtenu via lister_mails ou rechercher_mails.",
    inputSchema: {
      id: z.number().int().describe("Identifiant du mail"),
    },
  },
  safe(async ({ id }) => {
    const m = await lireMail(id);
    return texte(
      `De : ${m.expediteur}\n` +
        `Sujet : ${m.sujet || "(sans sujet)"}\n` +
        `Date : ${m.date}\n` +
        `Statut : ${m.lu ? "lu" : "non lu"}\n\n` +
        `${m.corps}`,
    );
  }),
);

// --- Rédaction -------------------------------------------------------------

server.registerTool(
  "creer_brouillon",
  {
    title: "Créer un brouillon",
    description:
      "Crée un brouillon dans Mail SANS l'envoyer. Le brouillon apparaît dans le dossier " +
      "Brouillons où l'utilisateur peut le relire et l'envoyer manuellement. Plusieurs " +
      "destinataires possibles en les séparant par des virgules.",
    inputSchema: {
      destinataire: z
        .string()
        .describe("Adresse(s) du/des destinataire(s), séparées par des virgules"),
      sujet: z.string().describe("Sujet du mail"),
      corps: z.string().describe("Corps du mail (texte)"),
      cc: z.string().optional().describe("Adresse(s) en copie (CC), séparées par des virgules"),
      cci: z.string().optional().describe("Adresse(s) en copie cachée (CCI), séparées par des virgules"),
      expediteur: z.string().optional().describe("Adresse d'envoi (doit correspondre à un compte ; voir lister_comptes). Si absent, compte par défaut"),
    },
  },
  safe(async ({ destinataire, sujet, corps, cc, cci, expediteur }) => {
    await creerBrouillon({ destinataire, sujet, corps, cc, cci, expediteur });
    return texte(`Brouillon créé pour ${destinataire} (sujet : « ${sujet} »). Il est dans tes Brouillons, non envoyé.`);
  }),
);

server.registerTool(
  "envoyer_mail",
  {
    title: "Envoyer un mail",
    description:
      "ENVOIE immédiatement un mail (action sortante et définitive : le mail part). " +
      "À n'utiliser que si l'utilisateur veut réellement envoyer. Pour préparer un mail " +
      "à relire avant envoi, utilise plutôt creer_brouillon. Plusieurs destinataires " +
      "possibles en les séparant par des virgules.",
    inputSchema: {
      destinataire: z
        .string()
        .describe("Adresse(s) du/des destinataire(s), séparées par des virgules"),
      sujet: z.string().describe("Sujet du mail"),
      corps: z.string().describe("Corps du mail (texte)"),
      cc: z.string().optional().describe("Adresse(s) en copie (CC), séparées par des virgules"),
      cci: z.string().optional().describe("Adresse(s) en copie cachée (CCI), séparées par des virgules"),
      expediteur: z.string().optional().describe("Adresse d'envoi (doit correspondre à un compte ; voir lister_comptes). Si absent, compte par défaut"),
    },
  },
  safe(async ({ destinataire, sujet, corps, cc, cci, expediteur }) => {
    await envoyerMail({ destinataire, sujet, corps, cc, cci, expediteur });
    return texte(`Mail envoyé à ${destinataire} (sujet : « ${sujet} »).`);
  }),
);

server.registerTool(
  "repondre_mail",
  {
    title: "Répondre à un mail",
    description:
      "Répond à un mail (par son identifiant) en reprenant le fil, le destinataire et " +
      "l'objet « Re: ». Crée un BROUILLON par défaut (envoyer=false) ; mettre envoyer=true " +
      "pour envoyer directement. repondre_a_tous inclut tous les destinataires d'origine.",
    inputSchema: {
      id: z.number().int().describe("Identifiant du mail auquel répondre"),
      corps: z.string().describe("Texte de la réponse (ajouté au-dessus du message cité)"),
      repondre_a_tous: z.boolean().default(false).describe("Répondre à tous les destinataires. Défaut : false"),
      cc: z.string().optional().describe("Adresse(s) en copie (CC)"),
      cci: z.string().optional().describe("Adresse(s) en copie cachée (CCI)"),
      expediteur: z.string().optional().describe("Adresse d'envoi (voir lister_comptes). Si absent, Mail choisit le compte du mail d'origine"),
      envoyer: z.boolean().default(false).describe("true = envoyer ; false = créer un brouillon (défaut)"),
    },
  },
  safe(async ({ id, corps, repondre_a_tous, cc, cci, expediteur, envoyer }) => {
    await repondreMail({ id, corps, repondreATous: repondre_a_tous, cc, cci, expediteur, envoyer });
    return texte(envoyer ? `Réponse envoyée au mail ${id}.` : `Brouillon de réponse au mail ${id} créé (non envoyé).`);
  }),
);

server.registerTool(
  "transferer_mail",
  {
    title: "Transférer un mail",
    description:
      "Transfère un mail (par son identifiant) vers un ou plusieurs destinataires, " +
      "en ajoutant l'en-tête « Message transféré » et le contenu d'origine. " +
      "Crée un BROUILLON par défaut (envoyer=false) ; mettre envoyer=true pour envoyer directement.",
    inputSchema: {
      id: z.number().int().describe("Identifiant du mail à transférer"),
      destinataire: z.string().describe("Adresse(s) du/des destinataire(s), séparées par des virgules"),
      corps: z.string().optional().describe("Texte à ajouter avant le message transféré (optionnel)"),
      cc: z.string().optional().describe("Adresse(s) en copie (CC), séparées par des virgules"),
      cci: z.string().optional().describe("Adresse(s) en copie cachée (CCI), séparées par des virgules"),
      expediteur: z.string().optional().describe("Adresse d'envoi (voir lister_comptes). Si absent, Mail choisit le compte par défaut"),
      envoyer: z.boolean().default(false).describe("true = envoyer ; false = créer un brouillon (défaut)"),
    },
  },
  safe(async ({ id, destinataire, corps, cc, cci, expediteur, envoyer }) => {
    await transfererMail({ id, destinataire, corps, cc, cci, expediteur, envoyer });
    return texte(envoyer ? `Mail ${id} transféré à ${destinataire}.` : `Brouillon de transfert du mail ${id} créé pour ${destinataire} (non envoyé).`);
  }),
);

// --- Gestion ---------------------------------------------------------------

server.registerTool(
  "marquer_mail",
  {
    title: "Marquer lu / non lu",
    description: "Marque un mail comme lu ou non lu, à partir de son identifiant.",
    inputSchema: {
      id: z.number().int().describe("Identifiant du mail"),
      lu: z.boolean().describe("true = marquer comme lu, false = marquer comme non lu"),
    },
  },
  safe(async ({ id, lu }) => {
    await marquerMail(id, lu);
    return texte(`Mail ${id} marqué comme ${lu ? "lu" : "non lu"}.`);
  }),
);

server.registerTool(
  "deplacer_mail",
  {
    title: "Déplacer un mail",
    description:
      "Déplace un mail vers un dossier (boîte aux lettres) en indiquant le nom exact du " +
      "dossier tel qu'il apparaît dans Mail. Action réversible.",
    inputSchema: {
      id: z.number().int().describe("Identifiant du mail"),
      dossier: z.string().describe("Nom exact du dossier de destination"),
    },
  },
  safe(async ({ id, dossier }) => {
    await deplacerMail(id, dossier);
    return texte(`Mail ${id} déplacé vers « ${dossier} ».`);
  }),
);

server.registerTool(
  "corbeille_mail",
  {
    title: "Mettre à la corbeille",
    description:
      "Déplace un mail vers la Corbeille. Action récupérable (pas de suppression " +
      "définitive) : le mail peut être restauré depuis la Corbeille de Mail.",
    inputSchema: {
      id: z.number().int().describe("Identifiant du mail"),
    },
  },
  safe(async ({ id }) => {
    await mettreCorbeille(id);
    return texte(`Mail ${id} déplacé vers la Corbeille (récupérable).`);
  }),
);

// --- Démarrage -------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Aucune sortie sur stdout : le transport stdio l'utilise pour le protocole.
  console.error("Serveur MCP Mail macOS démarré.");
}

main().catch((err) => {
  console.error("Échec du démarrage du serveur MCP Mail :", err);
  process.exit(1);
});
