import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";
import { ScannerOverlay } from "@/components/scanner/ScannerOverlay";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { InsertScan } from "@shared/schema";

interface CameraProps {
  onError: (error: Error) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
}

export function Camera({ onError, isScanning, setIsScanning }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveScan = useMutation({
    mutationFn: async (scan: InsertScan) => {
      await apiRequest("POST", "/api/scans", scan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans/recent"] });
      toast({
        title: "Scan saved",
        description: "The barcode has been successfully scanned and saved.",
      });
    },
  });

  useEffect(() => {
    async function setupCamera() {
      try {
        if (!videoRef.current) return;

        // Initialize the reader once
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader(undefined, {
            delayBetweenScanAttempts: 100,
            formats: [BarcodeFormat.PDF_417],
          });
        }

        // Start continuous scanning
        await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result) => {
            if (result && isScanning) {
              await saveScan.mutateAsync({
                content: result.getText(),
                format: "PDF417",
              });
              setIsScanning(false);
            }
          }
        );
      } catch (err) {
        onError(err as Error);
      }
    }

    if (isScanning) {
      setupCamera();
    } else if (readerRef.current) {
      readerRef.current.stopContinuousDecode();
    }

    // Cleanup function
    return () => {
      if (readerRef.current) {
        readerRef.current.stopContinuousDecode();
      }
    };
  }, [isScanning, onError, saveScan, setIsScanning]);

  return (
    <>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <ScannerOverlay />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        <Button
          size="lg"
          variant={isScanning ? "destructive" : "default"}
          onClick={() => setIsScanning(!isScanning)}
        >
          {isScanning ? (
            <>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Resume
            </>
          )}
        </Button>
      </div>
    </>
  );
}