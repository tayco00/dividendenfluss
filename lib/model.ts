export type Frequency = "Monatlich" | "Quartalsweise" | "Halbjährlich" | "Jährlich";
export type PaymentStatus = "Geplant" | "Erhalten";

export type Holding = {
  id: string;
  name: string;
  ticker: string;
  isin: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  annualDividendPerShare: number;
  frequency: Frequency;
  sector: string;
  account: string;
  createdAt: string;
  isDemo?: boolean;
};

export type Payment = {
  id: string;
  holdingId: string;
  companyName: string;
  exDate: string;
  payDate: string;
  gross: number;
  tax: number;
  status: PaymentStatus;
  note: string;
  createdAt: string;
  isDemo?: boolean;
};

export type AppSettings = {
  currency: "EUR" | "USD" | "CHF" | "GBP";
  annualGoal: number;
  theme: "light" | "dark";
};

export type Snapshot = {
  version: 1;
  holdings: Holding[];
  payments: Payment[];
  settings: AppSettings;
  updatedAt: string;
};

const demoHoldingIds = ["demo-allianz", "demo-coca-cola", "demo-realty"];

export function createDemoSnapshot(): Snapshot {
  const year = new Date().getFullYear();
  const now = new Date().toISOString();
  const holdings: Holding[] = [
    {
      id: demoHoldingIds[0],
      name: "Allianz SE",
      ticker: "ALV",
      isin: "DE0008404005",
      quantity: 18,
      purchasePrice: 218.4,
      currentPrice: 296.6,
      annualDividendPerShare: 15.4,
      frequency: "Jährlich",
      sector: "Versicherungen",
      account: "Hauptdepot",
      createdAt: now,
      isDemo: true,
    },
    {
      id: demoHoldingIds[1],
      name: "Coca-Cola",
      ticker: "KO",
      isin: "US1912161007",
      quantity: 42,
      purchasePrice: 54.8,
      currentPrice: 61.2,
      annualDividendPerShare: 1.84,
      frequency: "Quartalsweise",
      sector: "Basiskonsum",
      account: "Hauptdepot",
      createdAt: now,
      isDemo: true,
    },
    {
      id: demoHoldingIds[2],
      name: "Realty Income",
      ticker: "O",
      isin: "US7561091049",
      quantity: 36,
      purchasePrice: 49.2,
      currentPrice: 52.1,
      annualDividendPerShare: 2.9,
      frequency: "Monatlich",
      sector: "Immobilien",
      account: "Income-Depot",
      createdAt: now,
      isDemo: true,
    },
  ];

  const payments: Payment[] = [
    ["demo-pay-1", demoHoldingIds[2], "Realty Income", `${year}-01-02`, `${year}-01-15`, 8.7, 2.29, "Erhalten"],
    ["demo-pay-2", demoHoldingIds[1], "Coca-Cola", `${year}-03-14`, `${year}-04-01`, 19.32, 5.09, "Erhalten"],
    ["demo-pay-3", demoHoldingIds[2], "Realty Income", `${year}-04-02`, `${year}-04-15`, 8.7, 2.29, "Erhalten"],
    ["demo-pay-4", demoHoldingIds[0], "Allianz SE", `${year}-05-10`, `${year}-05-13`, 277.2, 73.06, "Erhalten"],
    ["demo-pay-5", demoHoldingIds[1], "Coca-Cola", `${year}-06-14`, `${year}-07-01`, 19.32, 5.09, "Geplant"],
    ["demo-pay-6", demoHoldingIds[2], "Realty Income", `${year}-08-02`, `${year}-08-15`, 8.7, 2.29, "Geplant"],
    ["demo-pay-7", demoHoldingIds[1], "Coca-Cola", `${year}-09-13`, `${year}-10-01`, 19.32, 5.09, "Geplant"],
    ["demo-pay-8", demoHoldingIds[2], "Realty Income", `${year}-11-02`, `${year}-11-15`, 8.7, 2.29, "Geplant"],
  ].map((row) => ({
    id: String(row[0]),
    holdingId: String(row[1]),
    companyName: String(row[2]),
    exDate: String(row[3]),
    payDate: String(row[4]),
    gross: Number(row[5]),
    tax: Number(row[6]),
    status: row[7] as PaymentStatus,
    note: "Beispieldatensatz",
    createdAt: now,
    isDemo: true,
  }));

  return {
    version: 1,
    holdings,
    payments,
    settings: { currency: "EUR", annualGoal: 1200, theme: "light" },
    updatedAt: now,
  };
}

export function createEmptySnapshot(settings?: AppSettings): Snapshot {
  return {
    version: 1,
    holdings: [],
    payments: [],
    settings: settings ?? { currency: "EUR", annualGoal: 1200, theme: "light" },
    updatedAt: new Date().toISOString(),
  };
}
