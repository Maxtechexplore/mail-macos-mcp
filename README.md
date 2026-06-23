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
   - Ouvrir **Claude Desktop**
   - Menu ☰ (en haut à gauche) → **Réglages** → **Extensions**
   - **Glisser-déposer** le fichier `mail-macos.mcpb` sur la page Extensions
   - Cliquer **Installer**
   - Un avertissement « développeur non vérifié » peut s'afficher : c'est normal
     (l'extension n'est pas signée par un éditeur commercial). Cliquer **Installer**
     quand même.

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
| `creer_brouillon` | Crée un brouillon **sans l'envoyer** | non destructif |
| `envoyer_mail` | Envoie un mail (Claude Desktop demande confirmation) | sortant |
| `marquer_mail` | Marque un mail lu / non lu | réversible |
| `deplacer_mail` | Déplace un mail vers un dossier | réversible |
| `corbeille_mail` | Met un mail à la **Corbeille** (récupérable) | récupérable |

**Aucune suppression définitive** : le pire cas possible est un mail envoyé ou un
mail en corbeille (récupérable depuis Mail).

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
  index.ts        # serveur MCP : déclare les 8 outils (validation via zod)
  mail.ts         # logique métier : construit les scripts AppleScript
  applescript.ts  # exécution osascript + parsing + messages d'erreur FR
```

Le pilotage de Mail passe par **AppleScript** (via `osascript`), l'API
d'automatisation standard de macOS. Aucune adresse ni compte n'est codé en dur :
le MCP agit sur la boîte de réception unifiée de l'app Mail de la machine.

---

## Licence

MIT
