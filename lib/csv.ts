import type { Frequency, Holding, Payment, PaymentStatus } from "./model";

type CsvRow = Record<string, string>;

const normalize = (value: string) =>
  value.toLowerCase().replace(/[ä]/g, "ae").replace(/[ö]/g, "oe").replace(/[ü]/g, "ue").replace(/[ß]/g, "ss").replace(/[^a-z0-9]/g, "");

const number = (value = "0") => {
  const cleaned = value.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const get = (row: CsvRow, aliases: string[]) => {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const match = entries.find(([key]) => normalize(key) === normalize(alias));
    if (match) return match[1].trim();
  }
  return "";
};

function splitLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = splitLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = splitLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ""]));
  });
}

export function csvLooksLikePayments(rows: CsvRow[]) {
  if (!rows[0]) return false;
  const keys = Object.keys(rows[0]).map(normalize);
  return keys.some((key) => ["zahltag", "zahlungsdatum", "brutto", "steuer", "netto", "dividenden"].includes(key))
    || (keys.some((key) => /^jahr\d{4}$/.test(key)) && keys.includes("unternehmen"));
}

function frequency(value: string): Frequency {
  const key = normalize(value);
  if (key.startsWith("monat")) return "Monatlich";
  if (key.startsWith("halb")) return "Halbjährlich";
  if (key.startsWith("jahr")) return "Jährlich";
  return "Quartalsweise";
}

export function rowsToHoldings(rows: CsvRow[]): Holding[] {
  const createdAt = new Date().toISOString();
  return rows.map((row, index) => ({
    id: crypto.randomUUID(),
    name: get(row, ["Wertpapier", "Name", "Unternehmen", "Aktie"]) || `Import ${index + 1}`,
    ticker: get(row, ["Ticker", "Symbol", "WKN"]),
    isin: get(row, ["ISIN"]),
    quantity: number(get(row, ["Stückzahl", "Stueckzahl", "Anzahl", "Bestand"])),
    purchasePrice: number(get(row, ["Kaufkurs", "Einstandskurs", "Kaufpreis"])),
    currentPrice: number(get(row, ["Aktueller Kurs", "Kurs", "Marktpreis"])),
    annualDividendPerShare: number(get(row, ["Dividende je Aktie", "Dividende p.a.", "Jahresdividende", "Dividende"])),
    frequency: frequency(get(row, ["Intervall", "Häufigkeit", "Frequenz"])),
    sector: get(row, ["Sektor", "Branche"]) || "Nicht zugeordnet",
    account: get(row, ["Depot", "Konto", "Broker"]) || "Hauptdepot",
    createdAt,
  }));
}

export function rowsToPayments(rows: CsvRow[], holdings: Holding[]): Payment[] {
  const createdAt = new Date().toISOString();
  const monthNumbers: Record<string, string> = {
    januar: "01", februar: "02", maerz: "03", marz: "03", april: "04",
    mai: "05", juni: "06", juli: "07", august: "08", september: "09",
    oktober: "10", november: "11", dezember: "12",
  };
  let inheritedMonth = "";
  return rows.map<Payment | null>((row) => {
    const companyName = get(row, ["Wertpapier", "Name", "Unternehmen", "Aktie"]);
    const match = holdings.find((holding) => normalize(holding.name) === normalize(companyName));
    const statusValue = normalize(get(row, ["Status"]));
    const gross = number(get(row, ["Brutto", "Bruttodividende", "Dividende", "Dividenden", "Betrag"]));
    const net = number(get(row, ["Netto", "Nettodividende"]));
    const yearColumn = Object.keys(row).find((key) => /^jahr\s*\d{4}$/i.test(key.trim()));
    const year = yearColumn?.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear());
    const monthValue = yearColumn ? normalize(row[yearColumn] ?? "") : "";
    if (monthValue && monthNumbers[monthValue]) inheritedMonth = monthNumbers[monthValue];
    const explicitPayDate = get(row, ["Zahltag", "Zahlungsdatum", "Datum"]);
    const payDate = explicitPayDate || (inheritedMonth ? `${year}-${inheritedMonth}-01` : "");
    if (!companyName) return null;
    return {
      id: crypto.randomUUID(),
      holdingId: match?.id ?? "",
      companyName,
      exDate: get(row, ["Ex-Tag", "Ex Date", "Ex-Datum"]),
      payDate,
      gross: gross || net,
      tax: number(get(row, ["Steuer", "Quellensteuer"])) || Math.max(0, gross - net),
      status: (statusValue.startsWith("erhalt") || statusValue.startsWith("bezahlt") ? "Erhalten" : "Geplant") as PaymentStatus,
      note: get(row, ["Notiz", "Kommentar"]),
      createdAt,
    };
  }).filter((payment): payment is Payment => payment !== null);
}

const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export function holdingsToCsv(holdings: Holding[]) {
  const header = ["Wertpapier", "Ticker", "ISIN", "Stückzahl", "Kaufkurs", "Aktueller Kurs", "Dividende je Aktie", "Häufigkeit", "Sektor", "Depot"];
  const rows = holdings.map((holding) => [holding.name, holding.ticker, holding.isin, holding.quantity, holding.purchasePrice, holding.currentPrice, holding.annualDividendPerShare, holding.frequency, holding.sector, holding.account]);
  return [header, ...rows].map((row) => row.map(quote).join(";")).join("\n");
}

export function paymentsToCsv(payments: Payment[]) {
  const header = ["Wertpapier", "Ex-Tag", "Zahltag", "Brutto", "Steuer", "Netto", "Status", "Notiz"];
  const rows = payments.map((payment) => [payment.companyName, payment.exDate, payment.payDate, payment.gross, payment.tax, payment.gross - payment.tax, payment.status, payment.note]);
  return [header, ...rows].map((row) => row.map(quote).join(";")).join("\n");
}
