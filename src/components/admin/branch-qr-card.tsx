"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function BranchQrCard({
  label,
  branch,
  url,
}: {
  label: string;
  branch: string;
  url: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const qrCanvas = wrapperRef.current?.querySelector("canvas");
    if (!qrCanvas) return;

    const width = 1200;
    const height = 1450;
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // QR code
    ctx.drawImage(qrCanvas, 100, 100, 1000, 1000);

    // Branch name under the QR code
    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 110px Arial, sans-serif";
    ctx.fillText(label, width / 2, 1230);

    ctx.fillStyle = "#64748b";
    ctx.font = "44px Arial, sans-serif";
    ctx.fillText("Scan to withdraw supplies", width / 2, 1320);

    const link = document.createElement("a");
    link.href = out.toDataURL("image/png");
    link.download = `qr-${branch}.png`;
    link.click();
  };

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 pt-6">
        <h2 className="text-xl font-semibold text-slate-900">{label}</h2>
        <div ref={wrapperRef} className="rounded-lg border bg-white p-2">
          <QRCodeCanvas
            value={url}
            size={1000}
            level="M"
            includeMargin
            style={{ width: 240, height: 240 }}
          />
        </div>
        <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download PNG
        </Button>
      </CardContent>
    </Card>
  );
}