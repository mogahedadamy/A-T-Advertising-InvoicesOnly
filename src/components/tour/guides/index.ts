import type { PageTourGuide } from "../types";
import { homeGuide } from "./homeGuide";
import { billingGuide } from "./billingGuide";
import { ordersGuide } from "./ordersGuide";
import { reportsGuide } from "./reportsGuide";
import { financeGuide } from "./financeGuide";
import { customersGuide } from "./customersGuide";
import { suppliersGuide } from "./suppliersGuide";
import { expensesGuide } from "./expensesGuide";
import { settingsGuide } from "./settingsGuide";

export const PAGE_GUIDES: Record<string, PageTourGuide> = {
  home: homeGuide,
  billing: billingGuide,
  orders: ordersGuide,
  reports: reportsGuide,
  finance: financeGuide,
  customers: customersGuide,
  suppliers: suppliersGuide,
  expenses: expensesGuide,
  settings: settingsGuide,
};

export const ALL_PAGE_GUIDES_LIST: PageTourGuide[] = [
  homeGuide,
  billingGuide,
  ordersGuide,
  reportsGuide,
  financeGuide,
  customersGuide,
  suppliersGuide,
  expensesGuide,
  settingsGuide,
];

export function getPageGuide(pageId?: string | null): PageTourGuide {
  if (pageId && PAGE_GUIDES[pageId]) {
    return PAGE_GUIDES[pageId];
  }
  return homeGuide;
}

