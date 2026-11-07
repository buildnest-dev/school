"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { env } from "@/config/env";
import { apiRequest } from "@/lib/api/client";

interface PaymentInfo {
  set: boolean;
  schoolName: string;
  holderName?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  upiId?: string | null;
}

/** A UPI payment link. Amounts are in rupees with two decimals, as UPI apps expect. */
export function upiLink(info: PaymentInfo, amountRupees: number, note: string) {
  const q = new URLSearchParams({
    pa: info.upiId ?? "",
    pn: info.holderName ?? info.schoolName,
    am: amountRupees.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${q.toString()}`;
}

/** The school's bank details and a UPI QR for the balance due. The parent pays the school directly. */
export function PayCard({ amountRupees, note }: { amountRupees: number; note: string }) {
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (env.dataSource !== "api") return;
    let alive = true;
    apiRequest<PaymentInfo>("/me/payment-info")
      .then((d) => alive && setInfo(d))
      .catch(() => alive && setInfo({ set: false, schoolName: "" }));
    return () => {
      alive = false;
    };
  }, []);

  const link = info?.set && info.upiId ? upiLink(info, amountRupees, note) : null;
  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toDataURL(link, { margin: 1, width: 240 })
      .then((u) => alive && setQr(u))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [link]);

  if (env.dataSource !== "api" || !info) return null;
  if (!info.set)
    return (
      <p className="text-muted mb-5 text-sm">
        The school has not added its payment details yet. Please pay at the school office.
      </p>
    );

  return (
    <Card className="mb-5 max-w-sm">
      <h2 className="text-lg font-semibold">Pay {info.schoolName || "the school"}</h2>
      {link && qr ? (
        <div className="mt-3 grid justify-items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`UPI QR code for ${info.upiId}`} width={240} height={240} />
          <a href={link} className="text-sm underline underline-offset-4">
            Open in a UPI app on this phone
          </a>
        </div>
      ) : null}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {info.upiId ? (
          <>
            <dt className="text-muted">UPI ID</dt>
            <dd className="font-mono break-all">{info.upiId}</dd>
          </>
        ) : null}
        <dt className="text-muted">Account name</dt>
        <dd>{info.holderName}</dd>
        <dt className="text-muted">Bank</dt>
        <dd>{info.bankName}</dd>
        <dt className="text-muted">Account no.</dt>
        <dd className="font-mono">{info.accountNumber}</dd>
        <dt className="text-muted">IFSC</dt>
        <dd className="font-mono">{info.ifsc}</dd>
      </dl>
      <p className="text-muted mt-3 text-xs">
        After paying, the school will confirm your payment. Keep the receipt or screenshot.
      </p>
    </Card>
  );
}
