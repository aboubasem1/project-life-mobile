# Project Life Mobile

Mobile Eingabe-UI für morgens/abends. Speichert lokal im Browser (localStorage) und kann CSV exportieren, die zur `app.py` passt.

## Schnellstart (iPhone/Android)

### Option A: Direkt im Browser öffnen

- Öffne `mobile/index.html` im Browser.
- Speichere als Homescreen-App (iOS: Teilen → „Zum Home-Bildschirm“).

### Option B: Im WLAN hosten (empfohlen)

```bash
cd "/Users/eliaspol/Desktop/Project Life/project-life-dashboard-de/mobile"
python3 -m http.server 8080
```

Dann am Handy im gleichen WLAN öffnen:

```
http://<DEINE-IP>:8080
```

## CSV Export / Import

- „CSV exportieren“ erzeugt eine Datei im Schema der Streamlit-`app.py`.
- Import in der Desktop-App: Datei via Import-Button hier oder manuell in `data.csv` zusammenführen.

## Hinweis

Daten bleiben lokal auf dem Gerät. Wenn du den Browser-Cache löschst, sind die Daten weg — nutze Export als Backup.
