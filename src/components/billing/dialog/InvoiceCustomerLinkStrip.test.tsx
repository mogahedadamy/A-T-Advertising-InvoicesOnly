// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InvoiceCustomerLinkStrip } from "./InvoiceCustomerLinkStrip";
import type { CustomerRecord } from "@/lib/customersStore";

afterEach(cleanup);

const makeCustomer = (overrides?: Partial<CustomerRecord>): CustomerRecord => ({
  id: "cust-10",
  name: "شركة النيل الحديثة",
  phone: "0912345678",
  type: "company",
  address: "",
  totalOrders: 0,
  totalSpent: 0,
  balance: 0,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const baseProps = {
  partyName: "عميل جديد تماما",
  linkedCustomer: null,
  exactActiveMatch: null,
  exactArchivedMatch: null,
  saveAsNewCustomer: false,
  setSaveAsNewCustomer: vi.fn(),
  phone: "",
  setPhone: vi.fn(),
  newCustomerType: "client" as const,
  setNewCustomerType: vi.fn(),
  onLinkCustomer: vi.fn(),
  onUnlinkCustomer: vi.fn(),
  onRestoreAndLink: vi.fn(),
};

describe("InvoiceCustomerLinkStrip", () => {
  it("defaults to walk-in copy when OFF and hides optional customer fields", () => {
    const setSaveAsNewCustomer = vi.fn();
    render(
      <InvoiceCustomerLinkStrip
        {...baseProps}
        saveAsNewCustomer={false}
        setSaveAsNewCustomer={setSaveAsNewCustomer}
      />
    );

    expect(screen.getByText(/عميل عابر — لن يُضاف إلى قائمة العملاء/)).toBeDefined();
    expect(screen.queryByPlaceholderText("09XXXXXXXX")).toBeNull();

    const toggle = screen.getByRole("switch", {
      name: /حفظ كعميل جديد في دليل العملاء تلقائياً/i,
    });
    fireEvent.click(toggle);
    expect(setSaveAsNewCustomer).toHaveBeenCalledWith(true);
  });

  it("reveals phone and customer type inputs when opted in (ON)", () => {
    render(<InvoiceCustomerLinkStrip {...baseProps} saveAsNewCustomer={true} />);

    expect(
      screen.getByText(/سيُنشأ ملف عميل جديد وتُربط به الفاتورة تلقائياً في خطوة واحدة/)
    ).toBeDefined();
    expect(screen.getByPlaceholderText("09XXXXXXXX")).toBeDefined();
    expect(screen.getByLabelText("تصنيف العميل الجديد")).toBeDefined();
  });

  it("shows one-tap link CTA when an exact active customer match exists", () => {
    const onLinkCustomer = vi.fn();
    const existing = makeCustomer();
    render(
      <InvoiceCustomerLinkStrip
        {...baseProps}
        partyName={existing.name}
        exactActiveMatch={existing}
        onLinkCustomer={onLinkCustomer}
      />
    );

    const linkBtn = screen.getByRole("button", { name: "ربط بملفه" });
    fireEvent.click(linkBtn);
    expect(onLinkCustomer).toHaveBeenCalledWith(existing);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("shows restore & link CTA when matching customer is archived", () => {
    const onRestoreAndLink = vi.fn();
    const archived = makeCustomer({ isArchived: true });
    render(
      <InvoiceCustomerLinkStrip
        {...baseProps}
        partyName={archived.name}
        exactArchivedMatch={archived}
        onRestoreAndLink={onRestoreAndLink}
      />
    );

    const restoreBtn = screen.getByRole("button", { name: "استعادة وربط" });
    fireEvent.click(restoreBtn);
    expect(onRestoreAndLink).toHaveBeenCalledWith(archived);
  });

  it("locks unlinking when linked invoice already has active payments", () => {
    const linked = makeCustomer();
    render(
      <InvoiceCustomerLinkStrip
        {...baseProps}
        linkedCustomer={linked}
        isCustomerLocked={true}
        onOpenCustomerProfile={vi.fn()}
      />
    );

    expect(screen.getByText("مقفل بالسداد")).toBeDefined();
    expect(screen.queryByRole("button", { name: "فك الربط" })).toBeNull();
    expect(screen.getByRole("button", { name: /عرض الملف/i })).toBeDefined();
  });
});
