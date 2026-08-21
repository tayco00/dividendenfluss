# Dividendenfluss

Ein moderner, datensparsamer Dividendentracker. Portfolio, Ausschüttungen, Profile und Einstellungen werden ausschließlich in der lokalen Programmdatenbank gespeichert.

## Funktionen

- Dashboard für Netto-Dividenden, Portfoliowert, Rendite, Monatsverlauf und Jahresziel
- Positionen und Zahlungen anlegen, bearbeiten, suchen, filtern und löschen
- standardisierte Sektorauswahl mit Erhalt bereits importierter Bezeichnungen
- direkter Excel-/CSV-Import mit deutschen Spaltenbezeichnungen und CSV-Export
- vollständige lokale JSON-Backups und Wiederherstellung
- responsive Oberfläche mit hellem und dunklem Farbschema
- einstellbare Textgröße mit lesbarer Standarddarstellung
- bis zu sechs vollständig getrennte lokale Profile mit eigener Farbe und Profilauswahl beim Start
- integrierte Updateprüfung mit Downloadfortschritt, Offline-Fallback und sicherem Neustart
- automatische Wiederherstellung der letzten Fenstergröße und -position
- Beispieldaten für den Einstieg, mit einem Klick vollständig entfernbar
- installierbares Windows-Programm mit eigenem App-Symbol sowie Desktop- und Startmenü-Verknüpfung

## Datenschutz

Es existiert keine serverseitige Datenbank und kein Online-Konto. Persönliche Einträge und Profilnamen werden weder an einen Server übertragen noch in Git geschrieben. Die Updateprüfung fragt ausschließlich öffentliche Versionsinformationen bei GitHub ab. Export- und Backup-Dateien sind zusätzlich über `.gitignore` ausgeschlossen. Im Repository befinden sich ausschließlich als Demo gekennzeichnete Beispieldaten.

Wichtig: Vor einer Windows-Neuinstallation oder einem Gerätewechsel sollte unter **Einstellungen** ein vollständiges JSON-Backup aller Profile erstellt werden.

## Windows-Programm

Die aktuelle Version wird über [GitHub Releases](https://github.com/tayco00/dividendenfluss/releases/latest) als `Dividendenfluss-Setup.exe` bereitgestellt. Der Installer legt genau eine Verknüpfung **Dividendenfluss** auf dem Desktop und im Startmenü an. Das eigentliche Programm heißt `Dividendenfluss.exe` und öffnet den Tracker in einem eigenen Fenster – ohne Browserleiste, Tabs oder separat laufenden Dienst.

Bereits in der bisherigen Programmversion gespeicherte Einträge werden beim ersten Start automatisch dem Profil **Investor** zugeordnet. Alte Einzelprofil-Backups bleiben importierbar; neue vollständige Backups enthalten alle Profile.

Desktop-Verknüpfung, installierte Programmdateien, Fensterstatus und lokale Daten sind bewusst nicht im Repository enthalten. Installer und Anwendung enthalten ausschließlich den Programmcode und die als Demo markierten Beispieldaten – keine Portfolio-, Zahlungs- oder Profildaten.

## Updates

Die installierte App prüft beim Start, auf Wunsch in den **Einstellungen** und während längerer Laufzeit nach neuen GitHub-Releases. Ein gefundenes Update wird mit der von `electron-builder` erzeugten Prüfsumme kontrolliert, heruntergeladen und nach Zustimmung beziehungsweise beim nächsten Start installiert. Wenn GitHub nicht erreichbar ist, startet Dividendenfluss ohne Einschränkung weiter.

Ein Tag wie `v0.2.2` löst die geprüfte Windows-Paketierung aus und veröffentlicht Installer, Blockmap und `latest.yml` gemeinsam. Dadurch stammen Programmdatei und Integritätsinformationen immer aus demselben Build.

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
