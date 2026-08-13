import assert from "node:assert/strict";
import test from "node:test";
import { csvLooksLikePayments, parseCsv, rowsToPayments } from "../lib/csv";

test("imports the existing Jahr/Dividenden/Unternehmen Excel layout", () => {
  const rows = parseCsv([
    "Jahr 2026;Dividenden;Unternehmen",
    "Januar;12,34 €;Beispiel AG",
    "Februar;45,67 €;Muster SE",
    ";8,90 €;Demo Inc.",
    ";66,91 €;",
  ].join("\n"));

  assert.equal(csvLooksLikePayments(rows), true);
  const payments = rowsToPayments(rows, []);
  assert.equal(payments.length, 3);
  assert.equal(payments[0].payDate, "2026-01-01");
  assert.equal(payments[1].payDate, "2026-02-01");
  assert.equal(payments[2].payDate, "2026-02-01");
  assert.equal(payments[2].gross, 8.9);
  assert.equal(payments[2].companyName, "Demo Inc.");
});
