# Abnahmekriterien für Dividendenfluss 0.2

Die Produktstufe ist erst abgeschlossen, wenn alle folgenden Punkte erfüllt sind:

1. **Updates:** Die installierte Windows-App prüft beim Start, manuell und alle sechs Stunden auf neue öffentliche GitHub-Releases. Downloadfortschritt, Offline-Fehler, Installation und Neustart sind abgedeckt.
2. **Veröffentlichung:** Ein Versions-Tag erzeugt reproduzierbar Installer, Blockmap und `latest.yml` und veröffentlicht alle drei Dateien gemeinsam.
3. **Profile:** Bis zu sechs lokale Profile lassen sich anlegen, umbenennen, gestalten, wechseln und – außer dem letzten – löschen. Jedes Profil besitzt vollständig getrennte Positionen, Zahlungen und Einstellungen.
4. **Migration:** Die bisherige lokale Einzel-Datenbank wird beim ersten Start automatisch und verlustfrei dem Profil „Investor“ zugeordnet. Alte JSON-Backups bleiben importierbar.
5. **Datenschutz:** Updateanfragen enthalten nur technisch notwendige Versions- und Plattforminformationen. Portfolio-, Zahlungs-, Profil- und Fensterdaten bleiben außerhalb des Repositorys und ausschließlich auf dem Gerät.
6. **Desktop-Qualität:** Die Anwendung besitzt genau den Produktnamen und das vorhandene Logo, erstellt Desktop- und Startmenü-Verknüpfungen und merkt sich Fenstergröße, Position und Maximierung lokal.
7. **Sicherheit:** Renderer-Sandbox, Context Isolation, restriktive Navigation, verweigerte Berechtigungen, eng begrenzte IPC-Aufrufe und CSP bleiben aktiv.
8. **Qualität:** Build, Lint, Tests, installierte Paketierung, beide Desktop-Smoke-Tests und eine Prüfung des Release-Artefakts bestehen.
