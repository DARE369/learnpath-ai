import React, { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import { ArrowLeft, Mail, Download } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { Card, Button, Skeleton, Badge, EmptyState } from "../../../components/ui";
import SchoolLayout from "../../../components/School/SchoolLayout";
import { InvoiceDetail, InvoiceDetailModal } from "../../../components/School/BillingModals";

interface InvoiceRow {
  invoice_id: string; invoice_number: string; invoice_date: string;
  total: number; status: string; email_sent_to: string | null;
}

export default function BillingInvoicesPage() {
  const { accessToken } = useAuth();
  const token = accessToken ?? "";
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedInv, setSelectedInv] = useState<InvoiceDetail | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  useEffect(() => {
    const sid = typeof window !== "undefined"
      ? localStorage.getItem("organization_id") ?? sessionStorage.getItem("organization_id")
      : null;
    if (sid) setSchoolId(sid);
  }, []);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/school-admin/${schoolId}/billing/invoices?page=${page}&page_size=20`, { headers: auth });
      if (res.ok) {
        const d = await res.json();
        setRows(d.invoices ?? []);
        setTotal(d.pagination?.total ?? 0);
      }
    } finally { setLoading(false); }
  }, [schoolId, token, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  async function openDetail(invId: string) {
    if (!schoolId) return;
    const res = await fetch(`/api/school-admin/${schoolId}/billing/invoices/${invId}`, { headers: auth });
    if (res.ok) setSelectedInv(await res.json());
  }

  async function emailInvoice(invId: string) {
    if (!schoolId) return;
    setEmailingId(invId);
    await fetch(`/api/school-admin/${schoolId}/billing/invoices/${invId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    setEmailingId(null);
    load();
  }

  async function emailSelectedInvoice() {
    if (!selectedInv || !schoolId) return;
    await fetch(`/api/school-admin/${schoolId}/billing/invoices/${selectedInv.invoice_id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    load();
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <SchoolLayout>
      <Head><title>Invoices — LearnPath for Schools</title></Head>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" href="/school/billing/plan" leftIcon={<ArrowLeft className="h-4 w-4" />}>Plan</Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Invoices</h1>
              <p className="mt-0.5 text-sm text-white/40">{total} invoice{total !== 1 ? "s" : ""} total</p>
            </div>
          </div>
        </div>

        {loading ? <Skeleton className="h-64 w-full" /> : rows.length === 0 ? (
          <EmptyState title="No invoices yet" description="Invoices appear here once your first billing cycle completes." />
        ) : (
          <Card padding="none">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-elevated text-left text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-surface-elevated/60">
                    <td className="px-4 py-3">
                      <button onClick={() => openDetail(inv.invoice_id)} className="font-medium text-accent-light hover:text-white">
                        {inv.invoice_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {new Date(inv.invoice_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-white">${inv.total.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={inv.status === "paid" ? "success" : "neutral"}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDetail(inv.invoice_id)}
                          title="View / Print PDF"
                          aria-label="View invoice"
                          className="rounded-lg p-2 text-white/40 hover:bg-surface-elevated hover:text-white">
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => emailInvoice(inv.invoice_id)}
                          disabled={emailingId === inv.invoice_id}
                          title="Email invoice"
                          aria-label="Email invoice"
                          className="rounded-lg p-2 text-white/40 hover:bg-surface-elevated hover:text-white disabled:opacity-40">
                          <Mail className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-white/50">
                <span>Page {page} of {pages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>Next</Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {selectedInv && (
        <InvoiceDetailModal
          inv={selectedInv}
          onEmail={emailSelectedInvoice}
          onClose={() => setSelectedInv(null)}
        />
      )}
    </SchoolLayout>
  );
}
