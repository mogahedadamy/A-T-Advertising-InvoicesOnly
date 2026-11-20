import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { useCustomers } from "@/lib/customersStore";
import { getAllSuppliers, type Supplier } from "@/lib/repositories/SupplierRepository";
import {
  getCashMovementReport,
  getCustomerCollectionsReport,
  getCustomerStatement,
  getFinancialPerformanceReport,
  getPurchasesReport,
  getSalesPerformance,
  getSupplierStatement,
  type CashMovementReport,
  type CustomerCollectionsReport,
  type CustomerStatement,
  type FinancialPerformanceReport,
  type PurchasesReport,
  type SalesPerformance,
  type SupplierStatement,
} from "@/lib/repositories/ReportsRepository";
import type { AppCurrency } from "@/lib/currency/types";

import { ReportsHeader } from "./ReportsHeader";
import { ReportsIconCards, type ReportTab } from "./ReportsIconCards";
import { ReportsPerformanceView } from "./ReportsPerformanceView";
import { ReportsSalesCollectionsView } from "./ReportsSalesCollectionsView";
import { ReportsPurchasesProjectsView } from "./ReportsPurchasesProjectsView";
import { ReportsStatementsView } from "./ReportsStatementsView";

export function ReportsWorkspace() {
  const customers = useCustomers();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>("performance");

  const [sales, setSales] = useState<SalesPerformance | null>(null);
  const [collections, setCollections] = useState<CustomerCollectionsReport | null>(null);
  const [purchases, setPurchases] = useState<PurchasesReport | null>(null);
  const [performance, setPerformance] = useState<FinancialPerformanceReport | null>(null);
  const [cash, setCash] = useState<CashMovementReport | null>(null);

  const [statementCustomerId, setStatementCustomerId] = useState<string | null>(null);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [statementSupplierId, setStatementSupplierId] = useState<string | null>(null);
  const [supplierStatement, setSupplierStatement] = useState<SupplierStatement | null>(null);
  const [statementCurrency, setStatementCurrency] = useState<AppCurrency>("SDG");

  const range = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        salesData,
        collectionsData,
        purchasesData,
        performanceData,
        cashData,
      ] = await Promise.all([
        getSalesPerformance(range),
        getCustomerCollectionsReport(range),
        getPurchasesReport(range),
        getFinancialPerformanceReport(range),
        getCashMovementReport(range),
      ]);
      setSales(salesData);
      setCollections(collectionsData);
      setPurchases(purchasesData);
      setPerformance(performanceData);
      setCash(cashData);
    } catch (err) {
      console.error("[Reports] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        setSuppliers(await getAllSuppliers());
      } catch (err) {
        console.warn("[Reports] suppliers failed:", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!statementCustomerId) {
      setStatement(null);
      return;
    }
    let cancelled = false;
    void getCustomerStatement(statementCustomerId, range, statementCurrency)
      .then((res) => {
        if (!cancelled) setStatement(res);
      })
      .catch((err) => {
        console.error("[Reports] customer statement failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [statementCustomerId, range, statementCurrency]);

  useEffect(() => {
    if (!statementSupplierId) {
      setSupplierStatement(null);
      return;
    }
    let cancelled = false;
    void getSupplierStatement(statementSupplierId, range, statementCurrency)
      .then((res) => {
        if (!cancelled) setSupplierStatement(res);
      })
      .catch((err) => {
        console.error("[Reports] supplier statement failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [statementSupplierId, range, statementCurrency]);

  const handleQuickPreset = (preset: "today" | "month" | "year" | "all") => {
    if (preset === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (preset === "today") {
      setFrom(todayStr);
      setTo(todayStr);
    } else if (preset === "month") {
      setFrom(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
      setTo(todayStr);
    } else if (preset === "year") {
      setFrom(`${now.getFullYear()}-01-01`);
      setTo(todayStr);
    }
  };

  const metrics = useMemo(
    () => ({
      netProfit: performance?.netProfit ?? 0,
      salesTotal: sales?.totalSales ?? 0,
      collectedTotal: collections?.collectedTotal ?? 0,
      purchasesTotal: purchases?.purchaseTotal ?? 0,
      cashNet: cash?.net ?? 0,
    }),
    [performance, sales, collections, purchases, cash]
  );

  return (
    <PageShell>
      <main className="mx-auto flex w-full max-w-md flex-1 min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden px-3.5 sm:px-4 py-4 pb-36 md:max-w-4xl md:pb-16 touch-pan-y overscroll-contain">
        <ReportsHeader
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onQuickPreset={handleQuickPreset}
          onRefresh={() => void load()}
          loading={loading}
        />

        <ReportsIconCards
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          metrics={metrics}
        />

        {loading && !sales ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <span className="text-xs font-bold">جاري تحميل بيانات التقرير...</span>
          </div>
        ) : (
          <div className="space-y-4 pt-1 transition-all duration-200">
            {activeTab === "performance" && (
              <ReportsPerformanceView performance={performance} />
            )}

            {(activeTab === "sales" || activeTab === "collections") && (
              <ReportsSalesCollectionsView
                type={activeTab}
                sales={sales}
                collections={collections}
              />
            )}

            {(activeTab === "purchases" || activeTab === "cash") && (
              <ReportsPurchasesProjectsView
                type={activeTab}
                purchases={purchases}
                cash={cash}
              />
            )}

            {activeTab === "statements" && (
              <ReportsStatementsView
                customers={customers}
                suppliers={suppliers}
                statementCustomerId={statementCustomerId}
                statementSupplierId={statementSupplierId}
                statement={statement}
                supplierStatement={supplierStatement}
                currency={statementCurrency}
                onCurrencyChange={setStatementCurrency}
                onSelectCustomer={setStatementCustomerId}
                onSelectSupplier={setStatementSupplierId}
              />
            )}
          </div>
        )}
      </main>
    </PageShell>
  );
}

export default ReportsWorkspace;
