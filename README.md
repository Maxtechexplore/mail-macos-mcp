# Mail macOS — MCP pour Claude Desktop

Un serveur **MCP** qui permet à Claude de piloter l'app **Mail de macOS** : lire,
rechercher, préparer des brouillons, envoyer et gérer ses mails — directement
depuis Claude Desktop, y compris dans des **routines** et des **agents**.

> Fonctionne uniquement sur **macOS** (utilise l'app Mail intégrée).

---

## 📥 Installation (pour l'utilisateur)

Aucune compétence technique requise, pas de terminal, pas de Node à installer.

1. **Télécharger** le fichier `mail-macos.mcpb` :
   👉 **[Télécharger la dernière version](https://github.com/Maxtechexplore/mail-macos-mcp/releases/latest/download/mail-macos.mcpb)**

2. **Installer dans Claude Desktop** :
   - D'abord, **mettre Claude Desktop à jour** (dernière version requise).
   - Aller dans **Réglages → Extensions**
   - Cliquer **« Advanced settings » / Paramètres avancés**
   - Dans la section **« Extension Developer »**, cliquer **« Install Extension… »**
   - Sélectionner le fichier `mail-macos.mcpb` téléchargé
   - Un avertissement « développeur non vérifié » peut s'afficher : c'est normal
     (l'extension n'est pas signée par un éditeur commercial). Cliquer **Installer**
     quand même.

   > Le glisser-déposer fonctionne surtout pour les extensions du répertoire officiel
   > d'Anthropic ; pour ce bundle privé, utiliser le bouton **« Install Extension… »**
   > via les paramètres avancés.

3. **Autoriser l'accès à Mail** :
   Au **premier usage**, macOS demande : *« Claude souhaite contrôler Mail »*.
   Cliquer **Autoriser**. (Sinon : Réglages Système → Confidentialité et sécurité
   → Automatisation → activer Mail pour Claude.)

C'est prêt. 🎉

---

## 💬 Exemples d'utilisation

Une fois installé, on parle simplement à Claude :

- « Liste mes 5 derniers mails non lus »
- « Cherche les mails de Clément des 7 derniers jours »
- « Ouvre le mail [id] et résume-le »
- « Prépare un brouillon de réponse à ce mail » *(le brouillon reste dans Mail,
  rien n'est envoyé sans validation)*
- « Marque ce mail comme lu »
- « Mets ce mail à la corbeille »

---

## 🧰 Outils fournis

| Outil | Description | Sécurité |
|---|---|---|
| `lister_mails` | Liste les derniers mails (filtre non lus / expéditeur) | lecture seule |
| `rechercher_mails` | Recherche dans les mails récents (sujet, expéditeur, corps en option) | lecture seule |
| `lire_mail` | Renvoie le contenu complet d'un mail | lecture seule |
| `lister_comptes` | Liste les comptes mail connectés (nom et adresse(s)) | lecture seule |
| `creer_brouillon` | Crée un brouillon **sans l'envoyer** (CC, CCI, expéditeur) | non destructif |
| `envoyer_mail` | Envoie un mail (CC, CCI, expéditeur ; Claude Desktop demande confirmation) | sortant |
| `repondre_mail` | Répond à un mail en reprenant le fil ; brouillon par défaut | non destructif |
| `transferer_mail` | Transfère un mail vers un ou plusieurs destinataires ; brouillon par défaut | non destructif |
| `marquer_mail` | Marque un mail lu / non lu | réversible |
| `deplacer_mail` | Déplace un mail vers un dossier | réversible |
| `corbeille_mail` | Met un mail à la **Corbeille** (récupérable) | récupérable |

**Aucune suppression définitive** : le pire cas possible est un mail envoyé ou un
mail en corbeille (récupérable depuis Mail).

### Multi-comptes

`lister_comptes` renvoie tous les comptes configurés dans l'app Mail, avec leur nom
et leurs adresses email. Tous les outils de rédaction (`creer_brouillon`,
`envoyer_mail`, `repondre_mail`, `transferer_mail`) acceptent un paramètre
optionnel `expediteur` : si tu passes une adresse qui correspond à un compte
connecté, Mail utilisera ce compte pour envoyer. Si le paramètre est absent, Mail
utilise le compte par défaut (ou le compte du mail d'origine pour les réponses).
Utilise d'abord `lister_comptes` pour connaître les adresses disponibles, puis
précise `expediteur` si tu veux choisir le compte d'envoi.

---

## 🔧 Développement (pour reconstruire le bundle)

Prérequis : Node.js ≥ 18.

```bash
npm install        # installe les dépendances
npm run build      # compile TypeScript -> dist/
npm start          # lance le serveur (transport stdio) pour tester
```

Reconstruire le bundle `.mcpb` :

```bash
npm run build
npm prune --omit=dev                              # ne garder que les deps runtime
npx @anthropic-ai/mcpb pack . mail-macos.mcpb     # produit le .mcpb
npm install                                       # restaurer les deps de dev
```

### Architecture

```
src/
  index.ts        # serveur MCP : déclare les 11 outils (validation via zod)
  mail.ts         # logique métier : construit les scripts AppleScript
  applescript.ts  # exécution osascript + parsing + messages d'erreur FR
```

Le pilotage de Mail passe par **AppleScript** (via `osascript`), l'API
d'automatisation standard de macOS. Aucune adresse ni compte n'est codé en dur :
le MCP agit sur la boîte de réception unifiée de l'app Mail de la machine.

---

## Licence

MIT
