# Project Life Developer-Konsole

## 1. Dateien kopieren

Kopiere den Inhalt dieses Pakets in den Hauptordner des Repositorys `project-life-mobile`.

Die Struktur muss danach so aussehen:

```text
project-life-mobile/
├── .github/workflows/ai-change.yml
├── server/developer-admin.ts
├── api/
│   └── developer/
│       ├── session.ts
│       ├── change.ts
│       ├── publish.ts
│       └── discard.ts
└── projectdashboardv1/
    ├── index.html
    ├── vite.config.ts
    └── public/
        ├── developer-launcher.js
        └── developer/index.html
```

## 2. GitHub Actions Secret

GitHub öffnen:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Anlegen:

```text
OPENAI_API_KEY = dein OpenAI API-Key
REPO_ADMIN_TOKEN = derselbe Fine-grained GitHub Token aus Schritt 3
```

## 3. Fine-grained GitHub Token

GitHub öffnen:

```text
Settings → Developer settings → Personal access tokens → Fine-grained tokens
```

Konfiguration:

```text
Repository access: Only select repositories
Repository: aboubasem1/project-life-mobile
```

Repository permissions:

```text
Actions: Read and write
Contents: Read and write
Pull requests: Read and write
Deployments: Read-only
Metadata: Read-only
```

## 4. Vercel Environment Variables

Vercel öffnen:

```text
Project Life → Settings → Environment Variables
```

Für Production, Preview und Development anlegen:

```text
DEV_ADMIN_SECRET = ein eigenes langes Admin-Passwort
GITHUB_ADMIN_TOKEN = der Fine-grained GitHub Token
```

`DEV_ADMIN_SECRET` sollte mindestens 24 zufällige Zeichen haben.

## 5. Deployen

Im Repository-Hauptordner:

```bash
git add .github api server projectdashboardv1/index.html projectdashboardv1/vite.config.ts projectdashboardv1/public/developer projectdashboardv1/public/developer-launcher.js
git commit -m "Add mobile AI developer console"
git push
```

Nach dem Vercel-Deployment öffnen:

```text
https://project-life-mobile.vercel.app/developer/
```

## 6. Developer-Button in der Haupt-App aktivieren

Einmal öffnen:

```text
https://project-life-mobile.vercel.app/?developer=1
```

Danach bleibt unten rechts ein kleiner `</>`-Button sichtbar.

Wieder ausblenden:

```text
https://project-life-mobile.vercel.app/?developer=0
```

## Ablauf

```text
Änderung beschreiben
→ GitHub Workflow startet
→ Codex ändert nur projectdashboardv1
→ npm run build wird geprüft
→ Pull Request wird erstellt
→ Vercel erstellt eine Preview
→ Vorschau öffnen
→ Veröffentlichen drücken
→ Merge in main
→ Vercel Production Deployment
```

## Wichtige Grenzen

Die Konsole blockiert automatische Änderungen an:

```text
.github/
api/
server/
vercel.json
projectdashboardv1/index.html
projectdashboardv1/vite.config.ts
projectdashboardv1/package.json
projectdashboardv1/package-lock.json
projectdashboardv1/public/developer/
projectdashboardv1/public/developer-launcher.js
.env-Dateien
```

Damit kann die AI die eigentliche App ändern, aber nicht ihre eigene Sicherheits- und Deployment-Infrastruktur.
