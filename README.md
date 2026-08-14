# Dividendenfluss

Ein moderner, datensparsamer Dividendentracker. Portfolio, Ausschüttungen und Einstellungen werden ausschließlich in der IndexedDB des verwendeten Browsers gespeichert.

## Funktionen

- Dashboard für Netto-Dividenden, Portfoliowert, Rendite, Monatsverlauf und Jahresziel
- Positionen und Zahlungen anlegen, bearbeiten, suchen, filtern und löschen
- direkter Excel-/CSV-Import mit deutschen Spaltenbezeichnungen und CSV-Export
- vollständige lokale JSON-Backups und Wiederherstellung
- responsive Oberfläche mit hellem und dunklem Farbschema
- einstellbare Textgröße mit lesbarer Standarddarstellung
- Beispieldaten für den Einstieg, mit einem Klick vollständig entfernbar
- Windows-Programm mit eigenem App-Symbol und Infobereich-Menü

## Datenschutz

Es existiert keine serverseitige Datenbank und kein Benutzerkonto. Persönliche Einträge werden weder an den Server übertragen noch in Git geschrieben. Export- und Backup-Dateien sind zusätzlich über `.gitignore` ausgeschlossen. Im Repository befinden sich ausschließlich als Demo gekennzeichnete Beispieldaten.

Wichtig: Browserdaten gehören zum jeweiligen Browserprofil. Vor dem Löschen von Browserdaten oder einem Gerätewechsel sollte ein JSON-Backup unter **Einstellungen** erstellt werden.

## Windows-Programm

Die fertige Anwendung liegt unter `.launcher/Dividendenfluss.exe`. Ein Doppelklick startet den lokalen Dienst unsichtbar, öffnet den Tracker im Standardbrowser und zeigt das Dividendenfluss-Symbol im Windows-Infobereich. Dort stehen per Rechtsklick **Dividendenfluss öffnen** und **Beenden** bereit.

Die Desktop-Verknüpfung ist bewusst nicht im Repository enthalten, weil sie einen gerätespezifischen absoluten Pfad verwendet. Die EXE selbst arbeitet ausschließlich mit relativen Pfaden und enthält keine Portfolio- oder Zahlungsdaten.

## Unterstützte CSV-Spalten

Für Positionen werden unter anderem `Wertpapier`, `Ticker`, `ISIN`, `Stückzahl`, `Kaufkurs`, `Aktueller Kurs`, `Dividende je Aktie`, `Häufigkeit`, `Sektor` und `Depot` erkannt. Für Zahlungen werden `Wertpapier`, `Ex-Tag`, `Zahltag`, `Brutto`, `Steuer`, `Netto`, `Status` und `Notiz` erkannt. Die vorhandene Struktur `Jahr 2026` / `Dividenden` / `Unternehmen` wird ebenfalls direkt unterstützt; leere Monatszellen übernehmen automatisch den zuletzt genannten Monat. Gängige Alternativbezeichnungen werden automatisch zugeordnet.

## Alternativ über die Konsole starten

Voraussetzung ist Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

Anschließend ist der Tracker unter `http://localhost:3000` erreichbar.

## Qualität prüfen

```bash
npm test
```

Der Test erstellt den Produktions-Build, prüft die ausgelieferte Seite und kontrolliert die wichtigsten Datenschutz-Garantien.
