"use client";

import { useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface QrScannerProps {
  onResult: (value: string) => void;
  onClose: () => void;
}

export function QrScanner({ onResult, onClose }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="relative w-full max-w-sm overflow-hidden">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 bg-white/80 hover:bg-white"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
      <CardContent className="p-0">
        <Scanner
          onScan={(detected: IDetectedBarcode[]) => {
            if (detected?.[0]?.rawValue) {
              onResult(detected[0].rawValue);
            }
          }}
          onError={(err) => setError(err instanceof Error ? err.message : "Camera error")}
          constraints={{ facingMode: "environment" }}
          styles={{ container: { width: "100%" } }}
        />
      </CardContent>
      {error && <p className="p-3 text-center text-sm text-destructive">{error}</p>}
    </Card>
  );
}
