"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createDemoSnapshot,
  createEmptySnapshot,
  normalizeSnapshot,
  type AppSettings,
  type Frequency,
  type Holding,
  type Payment,
  type PaymentStatus,
  type Snapshot,
} from "../lib/model";
import { loadSnapshot, saveSnapshot } from "../lib/storage";
import {
  csvLooksLikePayments,
  holdingsToCsv,
  parseCsv,
  paymentsToCsv,
  rowsToHoldings,
  rowsToPayments,
} from "../lib/csv";

type View = "dashboard" | "portfolio" | "payments" | "settings";
type Modal =
  | { kind: "holding"; item?: Holding }
  | { kind: "payment"; item?: Payment }
  | null;

const navItems: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Übersicht", icon: "⌂" },
  { id: "portfolio", label: "Portfolio", icon: "▦" },
  { id: "payments", label: "Zahlungen", icon: "↗" },
  { id: "settings", label: "Daten & Schutz", icon: "◉" },
];

const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

function formatMoney(value: number, currency: AppSettings["currency"], compact = false) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: compact && Math.abs(value) >= 1000 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function Logo() {
  return (
    <div className="brand" aria-label="Dividendenfluss">
      <span className="brand-mark"><span /></span>
      <span>dividenden<span>fluss</span></span>
    </div>
  );
}

function HoldingForm({
  item,
  currency,
  onCancel,
  onSave,
  onQuickSave,
}: {
  item?: Holding;
  currency: AppSettings["currency"];
  onCancel: () => void;
  onSave: (holding: Holding) => void;
  onQuickSave: (companyName: string, netDividend: number, payDate: string) => void;
}) {
  const [mode, setMode] = useState<"quick" | "details" | null>(item ? "details" : null);
  const [frequency, setFrequency] = useState<Frequency>(item?.frequency ?? "Quartalsweise");

  function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      name: String(data.get("name") ?? "").trim(),
      ticker: String(data.get("ticker") ?? "").trim().toUpperCase(),
      isin: String(data.get("isin") ?? "").trim().toUpperCase(),
      quantity: Number(data.get("quantity")) || 0,
      purchasePrice: Number(data.get("purchasePrice")) || 0,
      currentPrice: Number(data.get("currentPrice")) || 0,
      annualDividendPerShare: Number(data.get("annualDividendPerShare")) || 0,
      frequency,
      sector: String(data.get("sector") ?? "").trim() || "Nicht zugeordnet",
      account: String(data.get("account") ?? "").trim() || "Hauptdepot",
      createdAt: item?.createdAt ?? new Date().toISOString(),
    });
  }

  function submitQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onQuickSave(
      String(data.get("companyName") ?? "").trim(),
      Number(data.get("netDividend")) || 0,
      String(data.get("payDate") ?? ""),
    );
  }

  if (!mode) {
    return (
      <div className="modal-card compact-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">NEUE POSITION</span>
            <h2>Wie möchtest du starten?</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Schließen">×</button>
        </div>
        <p className="entry-choice-intro">Wähle nur die Angaben, die du gerade erfassen möchtest. Details kannst du später jederzeit ergänzen.</p>
        <div className="entry-choice-grid">
          <button type="button" className="entry-choice recommended" onClick={() => setMode("quick")}>
            <span className="entry-choice-icon">↗</span>
            <span><strong>Schneller Eintrag</strong><small>Nur Unternehmen und eingegangene Dividende</small></span>
            <i>Empfohlen</i>
          </button>
          <button type="button" className="entry-choice" onClick={() => setMode("details")}>
            <span className="entry-choice-icon details">▦</span>
            <span><strong>Portfolio-Details</strong><small>Stückzahl, Kurse, ISIN, Depot und weitere Angaben</small></span>
            <i>→</i>
          </button>
        </div>
      </div>
    );
  }

  if (mode === "quick") {
    return (
      <form onSubmit={submitQuick} className="modal-card compact-modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">SCHNELLER EINTRAG</span>
            <h2>Dividende erfassen</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Schließen">×</button>
        </div>
        <p className="entry-choice-intro">Wähle den tatsächlichen Zahltag – auch rückwirkend. Steuer und weitere Angaben kannst du danach unter „Zahlungen“ bearbeiten.</p>
        <div className="form-grid quick-entry-fields">
          <label className="field wide">Unternehmen<input name="companyName" required placeholder="z. B. Allianz SE" /></label>
          <label className="field wide">Eingegangene Dividende (netto · {currency})<input name="netDividend" type="number" min="0.01" step="0.01" required placeholder="0,00" /></label>
          <label className="field wide">Zahltag<input name="payDate" type="date" defaultValue={localDateValue()} required /></label>
        </div>
        <div className="modal-actions split-actions"><button type="button" className="button ghost" onClick={() => setMode(null)}>← Auswahl</button><div><button type="button" className="button ghost" onClick={onCancel}>Abbrechen</button><button className="button dark">Dividende speichern</button></div></div>
      </form>
    );
  }

  return (
    <form onSubmit={submitDetails} className="modal-card">
      <div className="modal-head">
        <div>
          <span className="eyebrow">POSITION</span>
          <h2>{item ? "Position bearbeiten" : "Position hinzufügen"}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Schließen">×</button>
      </div>
      <div className="form-grid">
        <label className="field wide">Wertpapier / Unternehmen<input name="name" defaultValue={item?.name} required placeholder="z. B. Allianz SE" /></label>
        <label className="field">Ticker<input name="ticker" defaultValue={item?.ticker} placeholder="ALV" /></label>
        <label className="field">ISIN<input name="isin" defaultValue={item?.isin} placeholder="DE0008404005" /></label>
        <label className="field">Stückzahl<input name="quantity" defaultValue={item?.quantity} type="number" min="0" step="0.0001" required /></label>
        <label className="field">Kaufkurs<input name="purchasePrice" defaultValue={item?.purchasePrice} type="number" min="0" step="0.01" required /></label>
        <label className="field">Aktueller Kurs<input name="currentPrice" defaultValue={item?.currentPrice} type="number" min="0" step="0.01" required /></label>
        <label className="field">Dividende je Aktie p. a.<input name="annualDividendPerShare" defaultValue={item?.annualDividendPerShare} type="number" min="0" step="0.001" required /></label>
        <label className="field">Häufigkeit<select value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>{["Monatlich", "Quartalsweise", "Halbjährlich", "Jährlich"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="field">Sektor<input name="sector" defaultValue={item?.sector} placeholder="z. B. Versicherungen" /></label>
        <label className="field wide">Depot / Konto<input name="account" defaultValue={item?.account} placeholder="Hauptdepot" /></label>
      </div>
      <div className={`modal-actions ${item ? "" : "split-actions"}`}>
        {!item && <button type="button" className="button ghost" onClick={() => setMode(null)}>← Auswahl</button>}
        <div><button type="button" className="button ghost" onClick={onCancel}>Abbrechen</button><button className="button dark">{item ? "Änderungen speichern" : "Position anlegen"}</button></div>
      </div>
    </form>
  );
}

function PaymentForm({ item, holdings, onCancel, onSave }: { item?: Payment; holdings: Holding[]; onCancel: () => void; onSave: (payment: Payment) => void }) {
  const [holdingId, setHoldingId] = useState(item?.holdingId ?? holdings[0]?.id ?? "");
  const [status, setStatus] = useState<PaymentStatus>(item?.status ?? "Geplant");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const holding = holdings.find((entry) => entry.id === holdingId);
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      holdingId,
      companyName: holding?.name ?? item?.companyName ?? String(data.get("companyName") ?? "Unbekannt"),
      exDate: String(data.get("exDate") ?? ""),
      payDate: String(data.get("payDate") ?? ""),
      gross: Number(data.get("gross")) || 0,
      tax: Number(data.get("tax")) || 0,
      status,
      note: String(data.get("note") ?? "").trim(),
      createdAt: item?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={submit} className="modal-card compact-modal">
      <div className="modal-head">
        <div><span className="eyebrow">AUSSCHÜTTUNG</span><h2>{item ? "Zahlung bearbeiten" : "Zahlung erfassen"}</h2></div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Schließen">×</button>
      </div>
      {holdings.length ? (
        <div className="form-grid">
          <label className="field wide">Wertpapier<select value={holdingId} onChange={(event) => setHoldingId(event.target.value)}>{holdings.map((holding) => <option key={holding.id} value={holding.id}>{holding.name} · {holding.ticker || "ohne Ticker"}</option>)}</select></label>
          <label className="field">Ex-Tag<input name="exDate" defaultValue={item?.exDate} type="date" /></label>
          <label className="field">Zahltag<input name="payDate" defaultValue={item?.payDate} type="date" required /></label>
          <label className="field">Bruttobetrag<input name="gross" defaultValue={item?.gross} type="number" min="0" step="0.01" required /></label>
          <label className="field">Steuern<input name="tax" defaultValue={item?.tax ?? 0} type="number" min="0" step="0.01" /></label>
          <div className="field wide"><span>Status</span><div className="segmented form-segmented"><button type="button" className={status === "Geplant" ? "active" : ""} onClick={() => setStatus("Geplant")}>Geplant</button><button type="button" className={status === "Erhalten" ? "active" : ""} onClick={() => setStatus("Erhalten")}>Erhalten</button></div></div>
          <label className="field wide">Notiz<input name="note" defaultValue={item?.note} placeholder="Optional" /></label>
        </div>
      ) : <div className="empty-inline">Lege zuerst eine Position im Portfolio an.</div>}
      <div className="modal-actions"><button type="button" className="button ghost" onClick={onCancel}>Abbrechen</button>{holdings.length > 0 && <button className="button dark">{item ? "Änderungen speichern" : "Zahlung anlegen"}</button>}</div>
    </form>
  );
}

export default function TrackerApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"Alle" | PaymentStatus>("Alle");
  const [year, setYear] = useState(new Date().getFullYear());
  const [toast, setToast] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSnapshot()
      .then((saved) => setSnapshot(saved ?? createDemoSnapshot()))
      .catch(() => setSnapshot(createDemoSnapshot()));
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    document.documentElement.dataset.theme = snapshot.settings.theme;
    document.documentElement.dataset.textSize = snapshot.settings.textSize;
    saveSnapshot(snapshot).catch(() => setToast("Lokales Speichern fehlgeschlagen"));
  }, [snapshot]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    if (!snapshot) return null;
    const invested = snapshot.holdings.reduce((sum, holding) => sum + holding.quantity * holding.purchasePrice, 0);
    const marketValue = snapshot.holdings.reduce((sum, holding) => sum + holding.quantity * holding.currentPrice, 0);
    const annualExpected = snapshot.holdings.reduce((sum, holding) => sum + holding.quantity * holding.annualDividendPerShare, 0);
    const yearPayments = snapshot.payments.filter((payment) => Number(payment.payDate.slice(0, 4)) === year);
    const netReceived = yearPayments.filter((payment) => payment.status === "Erhalten").reduce((sum, payment) => sum + payment.gross - payment.tax, 0);
    const netPlanned = yearPayments.filter((payment) => payment.status === "Geplant").reduce((sum, payment) => sum + payment.gross - payment.tax, 0);
    const monthly = months.map((label, index) => ({
      label,
      received: yearPayments.filter((payment) => payment.status === "Erhalten" && Number(payment.payDate.slice(5, 7)) === index + 1).reduce((sum, payment) => sum + payment.gross - payment.tax, 0),
      planned: yearPayments.filter((payment) => payment.status === "Geplant" && Number(payment.payDate.slice(5, 7)) === index + 1).reduce((sum, payment) => sum + payment.gross - payment.tax, 0),
    }));
    return { invested, marketValue, annualExpected, netReceived, netPlanned, monthly, yieldOnCost: invested ? (annualExpected / invested) * 100 : 0 };
  }, [snapshot, year]);

  if (!snapshot || !stats) {
    return <main className="loading-screen"><Logo /><div className="loading-line"><span /></div><p>Lokale Daten werden geöffnet …</p></main>;
  }

  const currency = snapshot.settings.currency;
  const hasDemo = snapshot.holdings.some((holding) => holding.isDemo) || snapshot.payments.some((payment) => payment.isDemo);
  const goalProgress = Math.min(100, snapshot.settings.annualGoal ? (stats.netReceived / snapshot.settings.annualGoal) * 100 : 0);
  const maxMonth = Math.max(...stats.monthly.map((month) => month.received + month.planned), 1);
  const upcoming = snapshot.payments.filter((payment) => payment.status === "Geplant").sort((a, b) => a.payDate.localeCompare(b.payDate)).slice(0, 4);
  const filteredHoldings = snapshot.holdings.filter((holding) => [holding.name, holding.ticker, holding.isin, holding.sector, holding.account].join(" ").toLowerCase().includes(search.toLowerCase()));
  const filteredPayments = snapshot.payments
    .filter((payment) => Number(payment.payDate.slice(0, 4)) === year)
    .filter((payment) => paymentFilter === "Alle" || payment.status === paymentFilter)
    .filter((payment) => payment.companyName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.payDate.localeCompare(a.payDate));
  const sectorTotals = Object.entries(snapshot.holdings.reduce<Record<string, number>>((acc, holding) => {
    acc[holding.sector] = (acc[holding.sector] ?? 0) + holding.quantity * holding.currentPrice;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]);

  function mutate(updater: (current: Snapshot) => Snapshot, message: string) {
    setSnapshot((current) => current ? { ...updater(current), updatedAt: new Date().toISOString() } : current);
    setToast(message);
  }

  function saveHolding(holding: Holding) {
    mutate((current) => ({ ...current, holdings: current.holdings.some((entry) => entry.id === holding.id) ? current.holdings.map((entry) => entry.id === holding.id ? holding : entry) : [...current.holdings, holding] }), modal && "item" in modal && modal.item ? "Position aktualisiert" : "Position hinzugefügt");
    setModal(null);
  }

  function saveQuickHolding(companyName: string, netDividend: number, payDate: string) {
    const existing = snapshot?.holdings.find((holding) => holding.name.trim().toLocaleLowerCase("de-DE") === companyName.toLocaleLowerCase("de-DE"));
    const now = new Date();
    const timestamp = now.toISOString();
    const holdingId = existing?.id ?? crypto.randomUUID();
    const newHolding: Holding = {
      id: holdingId,
      name: companyName,
      ticker: "",
      isin: "",
      quantity: 0,
      purchasePrice: 0,
      currentPrice: 0,
      annualDividendPerShare: 0,
      frequency: "Jährlich",
      sector: "Nicht zugeordnet",
      account: "Schneller Eintrag",
      createdAt: timestamp,
    };
    const payment: Payment = {
      id: crypto.randomUUID(),
      holdingId,
      companyName: existing?.name ?? companyName,
      exDate: "",
      payDate,
      gross: netDividend,
      tax: 0,
      status: "Erhalten",
      note: "Schneller Eintrag · Nettobetrag",
      createdAt: timestamp,
    };

    mutate((current) => ({
      ...current,
      holdings: existing ? current.holdings : [...current.holdings, newHolding],
      payments: [...current.payments, payment],
    }), existing ? "Dividende zur bestehenden Position hinzugefügt" : "Position und Dividende hinzugefügt");
    setModal(null);
  }

  function savePayment(payment: Payment) {
    mutate((current) => ({ ...current, payments: current.payments.some((entry) => entry.id === payment.id) ? current.payments.map((entry) => entry.id === payment.id ? payment : entry) : [...current.payments, payment] }), modal && "item" in modal && modal.item ? "Zahlung aktualisiert" : "Zahlung hinzugefügt");
    setModal(null);
  }

  function deleteHolding(holding: Holding) {
    if (!window.confirm(`${holding.name} und zugehörige Zahlungen wirklich löschen?`)) return;
    mutate((current) => ({ ...current, holdings: current.holdings.filter((entry) => entry.id !== holding.id), payments: current.payments.filter((payment) => payment.holdingId !== holding.id) }), "Position gelöscht");
  }

  function deletePayment(payment: Payment) {
    if (!window.confirm("Diese Zahlung wirklich löschen?")) return;
    mutate((current) => ({ ...current, payments: current.payments.filter((entry) => entry.id !== payment.id) }), "Zahlung gelöscht");
  }

  function startWithOwnData() {
    if (!window.confirm("Alle Beispieldaten entfernen und mit einem leeren Tracker starten?")) return;
    setSnapshot(createEmptySnapshot(snapshot?.settings));
    setToast("Bereit für deine Daten");
  }

  function exportBackup() {
    const cleanSnapshot = { ...snapshot, exportedAt: new Date().toISOString() };
    downloadFile(JSON.stringify(cleanSnapshot, null, 2), `dividenden-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setToast("Lokales Backup erstellt");
  }

  async function importFile(file: File) {
    try {
      const extension = file.name.toLowerCase().split(".").pop();
      if (file.name.toLowerCase().endsWith(".json")) {
        const text = await file.text();
        const imported = JSON.parse(text) as Snapshot;
        if (!Array.isArray(imported.holdings) || !Array.isArray(imported.payments) || !imported.settings) throw new Error("Ungültiges Backup");
        if (!window.confirm("Das Backup ersetzt die aktuell lokal gespeicherten Daten. Fortfahren?")) return;
        setSnapshot(normalizeSnapshot({ ...imported, version: 1, updatedAt: new Date().toISOString() }));
        setToast("Backup wiederhergestellt");
      } else {
        let text: string;
        if (extension === "xlsx" || extension === "xls") {
          const { read, utils } = await import("xlsx");
          const workbook = read(await file.arrayBuffer(), { type: "array" });
          const firstSheet = workbook.SheetNames[0];
          if (!firstSheet) throw new Error("Die Excel-Datei enthält kein Tabellenblatt");
          text = utils.sheet_to_csv(workbook.Sheets[firstSheet], { FS: ";", blankrows: false });
        } else {
          text = await file.text();
        }
        const rows = parseCsv(text);
        if (!rows.length) throw new Error("Keine Tabellenzeilen gefunden");
        if (csvLooksLikePayments(rows)) {
          const imported = rowsToPayments(rows, snapshot?.holdings ?? []);
          mutate((current) => ({ ...current, payments: [...current.payments, ...imported] }), `${imported.length} Zahlungen importiert`);
        } else {
          const imported = rowsToHoldings(rows);
          mutate((current) => ({ ...current, holdings: [...current.holdings, ...imported] }), `${imported.length} Positionen importiert`);
        }
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Import fehlgeschlagen");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  function updateSettings(next: Partial<AppSettings>) {
    mutate((current) => ({ ...current, settings: { ...current.settings, ...next } }), "Einstellung gespeichert");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Hauptnavigation">
          <span className="nav-label">TRACKER</span>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setSearch(""); }}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}
        </nav>
        <div className="privacy-card">
          <span className="privacy-icon">✓</span>
          <div><strong>100 % lokal</strong><p>Keine Cloud. Kein Konto. Deine Daten bleiben hier.</p></div>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /> Lokal gespeichert</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{view === "dashboard" ? `PORTFOLIO · ${year}` : view === "portfolio" ? "DEINE POSITIONEN" : view === "payments" ? "DIVIDENDENKALENDER" : "LOCAL-FIRST"}</span>
            <h1>{view === "dashboard" ? "Guten Tag, Investor." : view === "portfolio" ? "Portfolio" : view === "payments" ? "Zahlungen" : "Daten & Schutz"}</h1>
          </div>
          <div className="topbar-actions">
            <span className="local-pill"><span /> Nur auf diesem Gerät</span>
            {view !== "settings" && <button className="button lime" onClick={() => setModal({ kind: view === "payments" ? "payment" : "holding" })}><span>＋</span>{view === "payments" ? "Zahlung" : "Position"}</button>}
          </div>
        </header>

        {hasDemo && (
          <div className="demo-banner"><div><span>BEISPIEL</span><strong>So könnte dein Dividendenfluss aussehen.</strong><p>Alle sichtbaren Werte sind Demo-Daten und können gefahrlos entfernt werden.</p></div><button className="button ink-outline" onClick={startWithOwnData}>Mit eigenen Daten starten</button></div>
        )}

        {view === "dashboard" && (
          <div className="dashboard-grid">
            <section className="hero-card">
              <div className="hero-top"><span>NETTO-DIVIDENDEN {year}</span><span className="trend-chip">↗ {stats.netReceived ? Math.round((stats.netReceived / Math.max(stats.netReceived + stats.netPlanned, 1)) * 100) : 0} % erhalten</span></div>
              <div className="hero-value">{formatMoney(stats.netReceived, currency)}</div>
              <div className="hero-bottom"><div><span>NOCH GEPLANT</span><strong>{formatMoney(stats.netPlanned, currency)}</strong></div><div><span>MONATSSCHNITT</span><strong>{formatMoney(stats.netReceived / 12, currency)}</strong></div></div>
              <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
            </section>

            <section className="metric-card dark-card"><div className="metric-icon">∿</div><span>PORTFOLIOWERT</span><strong>{formatMoney(stats.marketValue, currency, true)}</strong><p className={stats.marketValue - stats.invested >= 0 ? "positive" : "negative"}>{stats.invested ? `${stats.marketValue - stats.invested >= 0 ? "+" : ""}${(((stats.marketValue - stats.invested) / stats.invested) * 100).toFixed(1).replace(".", ",")} %` : "0,0 %"} <small>ggü. Einstand</small></p></section>
            <section className="metric-card"><div className="metric-icon pale">%</div><span>DIVIDENDENRENDITE</span><strong>{stats.yieldOnCost.toFixed(2).replace(".", ",")} %</strong><p>{formatMoney(stats.annualExpected, currency)} <small>erwartet p. a.</small></p></section>

            <section className="panel chart-panel">
              <div className="panel-head"><div><span className="eyebrow">AUSSCHÜTTUNGEN</span><h2>Monatlicher Dividendenfluss</h2></div><div className="year-switch"><button onClick={() => setYear((value) => value - 1)}>‹</button><strong>{year}</strong><button onClick={() => setYear((value) => value + 1)}>›</button></div></div>
              <div className="chart-legend"><span><i className="received-dot" /> Erhalten</span><span><i className="planned-dot" /> Geplant</span></div>
              <div className="bar-chart" role="img" aria-label={`Monatliche Dividenden im Jahr ${year}`}>
                {stats.monthly.map((month) => <div className="bar-column" key={month.label}><div className="bar-value">{month.received + month.planned > 0 ? formatMoney(month.received + month.planned, currency, true) : ""}</div><div className="bar-track"><div className="bar planned" style={{ height: `${(month.planned / maxMonth) * 100}%` }} /><div className="bar received" style={{ height: `${(month.received / maxMonth) * 100}%` }} /></div><span>{month.label}</span></div>)}
              </div>
            </section>

            <section className="panel goal-panel">
              <div className="panel-head"><div><span className="eyebrow">JAHRESZIEL</span><h2>Dein Fortschritt</h2></div><button className="text-button" onClick={() => setView("settings")}>Anpassen</button></div>
              <div className="goal-ring" style={{ background: `conic-gradient(var(--lime) ${goalProgress * 3.6}deg, var(--line) 0deg)` }}><div><strong>{Math.round(goalProgress)}%</strong><span>erreicht</span></div></div>
              <div className="goal-copy"><strong>{formatMoney(stats.netReceived, currency)}</strong><span>von {formatMoney(snapshot.settings.annualGoal, currency)}</span><div className="goal-track"><i style={{ width: `${goalProgress}%` }} /></div><small>Noch {formatMoney(Math.max(0, snapshot.settings.annualGoal - stats.netReceived), currency)} bis zum Ziel.</small></div>
            </section>

            <section className="panel upcoming-panel">
              <div className="panel-head"><div><span className="eyebrow">AUSBLICK</span><h2>Nächste Zahlungen</h2></div><button className="text-button" onClick={() => setView("payments")}>Alle ansehen →</button></div>
              <div className="payment-list">{upcoming.length ? upcoming.map((payment) => <button key={payment.id} className="payment-row" onClick={() => setModal({ kind: "payment", item: payment })}><span className="company-avatar">{initials(payment.companyName)}</span><span className="company-copy"><strong>{payment.companyName}</strong><small>{formatDate(payment.payDate)}</small></span><span className="payment-amount"><strong>{formatMoney(payment.gross - payment.tax, currency)}</strong><small>netto</small></span><span className="row-arrow">›</span></button>) : <div className="empty-state small"><span>○</span><strong>Noch nichts geplant</strong><p>Erfasse deine nächste Ausschüttung.</p><button className="text-button" onClick={() => setModal({ kind: "payment" })}>Zahlung hinzufügen</button></div>}</div>
            </section>

            <section className="panel allocation-panel">
              <div className="panel-head"><div><span className="eyebrow">VERTEILUNG</span><h2>Sektoren</h2></div><span className="muted">nach Marktwert</span></div>
              {sectorTotals.length ? <div className="allocation-list">{sectorTotals.slice(0, 5).map(([sector, value], index) => <div key={sector}><span className={`sector-dot sector-${index}`} /><strong>{sector}</strong><span>{stats.marketValue ? Math.round((value / stats.marketValue) * 100) : 0} %</span><div className="allocation-track"><i className={`sector-${index}`} style={{ width: `${stats.marketValue ? (value / stats.marketValue) * 100 : 0}%` }} /></div></div>)}</div> : <div className="empty-state small"><strong>Noch keine Sektoren</strong></div>}
            </section>
          </div>
        )}

        {view === "portfolio" && (
          <section className="workspace-panel">
            <div className="workspace-toolbar"><div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Ticker, ISIN oder Sektor suchen" aria-label="Portfolio durchsuchen" /></div><div className="summary-inline"><span>{snapshot.holdings.length} Positionen</span><strong>{formatMoney(stats.marketValue, currency, true)}</strong></div></div>
            {filteredHoldings.length ? <div className="table-wrap"><table><thead><tr><th>Wertpapier</th><th>Stückzahl</th><th>Kurs</th><th>Marktwert</th><th>Dividende p. a.</th><th>Rendite</th><th>Depot</th><th><span className="sr-only">Aktionen</span></th></tr></thead><tbody>{filteredHoldings.map((holding) => {
              const value = holding.quantity * holding.currentPrice;
              const annual = holding.quantity * holding.annualDividendPerShare;
              const yieldValue = holding.purchasePrice ? (holding.annualDividendPerShare / holding.purchasePrice) * 100 : 0;
              return <tr key={holding.id}><td><div className="asset-cell"><span className="company-avatar">{initials(holding.name)}</span><span><strong>{holding.name}</strong><small>{holding.ticker || "—"} · {holding.sector}</small></span>{holding.isDemo && <i className="demo-tag">Demo</i>}</div></td><td>{holding.quantity.toLocaleString("de-DE")}</td><td>{formatMoney(holding.currentPrice, currency)}</td><td><strong>{formatMoney(value, currency)}</strong></td><td>{formatMoney(annual, currency)}</td><td><span className="yield-chip">{yieldValue.toFixed(2).replace(".", ",")} %</span></td><td>{holding.account}</td><td><div className="row-actions"><button onClick={() => setModal({ kind: "holding", item: holding })} aria-label={`${holding.name} bearbeiten`}>Bearbeiten</button><button className="danger-link" onClick={() => deleteHolding(holding)} aria-label={`${holding.name} löschen`}>×</button></div></td></tr>;
            })}</tbody></table></div> : <div className="empty-state"><span>＋</span><h2>{search ? "Keine Position gefunden" : "Dein Portfolio wartet"}</h2><p>{search ? "Versuche einen anderen Suchbegriff." : "Lege deine erste Position an oder importiere eine CSV-Datei."}</p>{!search && <button className="button lime" onClick={() => setModal({ kind: "holding" })}>Erste Position anlegen</button>}</div>}
          </section>
        )}

        {view === "payments" && (
          <section className="workspace-panel">
            <div className="workspace-toolbar wrap-toolbar"><div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Unternehmen suchen" aria-label="Zahlungen durchsuchen" /></div><div className="segmented">{(["Alle", "Erhalten", "Geplant"] as const).map((filter) => <button key={filter} className={paymentFilter === filter ? "active" : ""} onClick={() => setPaymentFilter(filter)}>{filter}</button>)}</div><div className="year-switch"><button onClick={() => setYear((value) => value - 1)}>‹</button><strong>{year}</strong><button onClick={() => setYear((value) => value + 1)}>›</button></div></div>
            <div className="payment-summary"><div><span>Erhalten</span><strong>{formatMoney(stats.netReceived, currency)}</strong></div><div><span>Geplant</span><strong>{formatMoney(stats.netPlanned, currency)}</strong></div><div><span>Gesamt</span><strong>{formatMoney(stats.netReceived + stats.netPlanned, currency)}</strong></div></div>
            {filteredPayments.length ? <div className="table-wrap"><table><thead><tr><th>Wertpapier</th><th>Ex-Tag</th><th>Zahltag</th><th>Brutto</th><th>Steuer</th><th>Netto</th><th>Status</th><th><span className="sr-only">Aktionen</span></th></tr></thead><tbody>{filteredPayments.map((payment) => <tr key={payment.id}><td><div className="asset-cell"><span className="company-avatar">{initials(payment.companyName)}</span><span><strong>{payment.companyName}</strong><small>{payment.note || "Ausschüttung"}</small></span>{payment.isDemo && <i className="demo-tag">Demo</i>}</div></td><td>{formatDate(payment.exDate)}</td><td>{formatDate(payment.payDate)}</td><td>{formatMoney(payment.gross, currency)}</td><td className="muted">− {formatMoney(payment.tax, currency)}</td><td><strong>{formatMoney(payment.gross - payment.tax, currency)}</strong></td><td><span className={`status-chip ${payment.status.toLowerCase()}`}>{payment.status}</span></td><td><div className="row-actions"><button onClick={() => setModal({ kind: "payment", item: payment })}>Bearbeiten</button><button className="danger-link" onClick={() => deletePayment(payment)}>×</button></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><span>↗</span><h2>Keine Zahlungen in {year}</h2><p>Erfasse geplante oder bereits erhaltene Ausschüttungen.</p><button className="button lime" onClick={() => setModal({ kind: "payment" })}>Zahlung erfassen</button></div>}
          </section>
        )}

        {view === "settings" && (
          <div className="settings-grid">
            <section className="settings-card privacy-feature"><div className="settings-icon shield">✓</div><div><span className="eyebrow">DATENSOUVERÄNITÄT</span><h2>Deine Zahlen verlassen dieses Gerät nicht.</h2><p>Der Tracker nutzt eine lokale Browserdatenbank. Es gibt keinen Login, kein Tracking und keine Übertragung deiner Portfolio- oder Zahlungsdaten an einen Server.</p><ul><li><span>✓</span> Speicherung nur im aktuellen Browser</li><li><span>✓</span> Kein Cloud-Konto erforderlich</li><li><span>✓</span> Backups nur auf deine Aktion</li></ul></div></section>
            <section className="settings-card"><div className="settings-heading"><div><span className="eyebrow">DARSTELLUNG</span><h2>Tracker anpassen</h2></div><span className="settings-icon">◎</span></div><div className="settings-fields"><label className="field">Basiswährung<select value={snapshot.settings.currency} onChange={(event) => updateSettings({ currency: event.target.value as AppSettings["currency"] })}>{["EUR", "USD", "CHF", "GBP"].map((currencyCode) => <option key={currencyCode}>{currencyCode}</option>)}</select><small>Alle Werte werden in dieser Währung interpretiert.</small></label><label className="field">Netto-Jahresziel<input type="number" min="0" step="50" value={snapshot.settings.annualGoal} onChange={(event) => updateSettings({ annualGoal: Number(event.target.value) || 0 })} /></label><div className="field"><span>Farbschema</span><div className="segmented form-segmented"><button className={snapshot.settings.theme === "light" ? "active" : ""} onClick={() => updateSettings({ theme: "light" })}>Hell</button><button className={snapshot.settings.theme === "dark" ? "active" : ""} onClick={() => updateSettings({ theme: "dark" })}>Dunkel</button></div></div><div className="field"><span>Textgröße</span><div className="segmented form-segmented text-size-control">{([['compact', 'Kompakt'], ['standard', 'Standard'], ['large', 'Groß']] as const).map(([value, label]) => <button key={value} className={snapshot.settings.textSize === value ? "active" : ""} onClick={() => updateSettings({ textSize: value })}>{label}</button>)}</div><small>Passt kleine Beschriftungen, Tabellen und Bedienelemente sofort an.</small></div></div></section>
            <section className="settings-card"><div className="settings-heading"><div><span className="eyebrow">SICHERN & ÜBERTRAGEN</span><h2>Import & Export</h2></div><span className="settings-icon">⇄</span></div><p className="settings-intro">Erstelle eine vollständige JSON-Sicherung oder tausche Tabellendaten per Excel/CSV aus. Dateien werden nur lokal verarbeitet.</p><div className="data-actions"><button className="data-action" onClick={exportBackup}><span className="data-icon">↓</span><span><strong>Vollständiges Backup</strong><small>Positionen, Zahlungen & Einstellungen · JSON</small></span><i>→</i></button><button className="data-action" onClick={() => downloadFile(holdingsToCsv(snapshot.holdings), `portfolio-export-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8")}><span className="data-icon">▦</span><span><strong>Portfolio als CSV</strong><small>Kompatibel mit Tabellenprogrammen</small></span><i>→</i></button><button className="data-action" onClick={() => downloadFile(paymentsToCsv(snapshot.payments), `dividenden-export-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8")}><span className="data-icon">↗</span><span><strong>Zahlungen als CSV</strong><small>Dein Dividendenjournal</small></span><i>→</i></button><button className="data-action" onClick={() => importRef.current?.click()}><span className="data-icon lime-icon">↑</span><span><strong>Datei importieren</strong><small>Excel, CSV oder Backup · nur lokal gelesen</small></span><i>→</i></button><input ref={importRef} className="sr-only" type="file" accept=".json,.csv,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0])} /></div></section>
            <section className="settings-card danger-card"><div className="settings-heading"><div><span className="eyebrow">LOKALE DATEN</span><h2>Neu beginnen</h2></div><span className="settings-icon danger">!</span></div><p>Entfernt alle Positionen und Zahlungen aus diesem Browser. Erstelle vorher bei Bedarf ein Backup.</p><button className="button danger-button" onClick={() => { if (window.confirm("Alle lokal gespeicherten Portfolio- und Zahlungsdaten unwiderruflich löschen?")) { setSnapshot(createEmptySnapshot(snapshot.settings)); setToast("Lokale Daten gelöscht"); } }}>Alle lokalen Daten löschen</button></section>
          </div>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile Navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>

      {modal && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={modal.kind === "holding" ? modal.item ? "Position bearbeiten" : "Position anlegen" : modal.item ? "Zahlung bearbeiten" : "Zahlung anlegen"}>{modal.kind === "holding" ? <HoldingForm item={modal.item} currency={currency} onCancel={() => setModal(null)} onSave={saveHolding} onQuickSave={saveQuickHolding} /> : <PaymentForm item={modal.item} holdings={snapshot.holdings} onCancel={() => setModal(null)} onSave={savePayment} />}</div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}
