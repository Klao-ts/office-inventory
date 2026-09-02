"use client";

import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function QrGeneratorCard({ url }: { url: string }) {
  const handleDownload = () => {
    const svg = document.getElementById("withdrawal-qr-code");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "office-supplies-withdrawal-qr.svg";
    link.click();
  };

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 pt-6">
        <div className="rounded-lg border bg-white p-4">
          <QRCodeSVG id="withdrawal-qr-code" value={url} size={220} level="M" includeMargin />
        </div>
        <p className="break-all text-center text-xs text-muted-foreground">{url}</p>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download QR Code
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Print this and post it near the supply closet. Scanning it opens the withdrawal form directly.
        </p>
      </CardContent>
    </Card>
  );
}
