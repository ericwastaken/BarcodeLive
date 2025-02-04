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
    let active = true;

    async function setupCamera() {
      try {
        if (!videoRef.current || !active) return;

        // Clean up any existing streams
        if (videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }

        // Initialize the reader with PDF417 format
        if (!readerRef.current) {
          const hints = new Map();
          hints.set(2, [BarcodeFormat.PDF_417]); // 2 is DecodeHintType.POSSIBLE_FORMATS
          readerRef.current = new BrowserMultiFormatReader(hints);
        }

        // Start video stream
        const constraints = {
          video: { facingMode: "environment" }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream;
          try {
            // Add a small delay before playing to ensure stream is properly attached
            await new Promise(resolve => setTimeout(resolve, 100));
            await videoRef.current.play();
          } catch (err) {
            console.error('Error playing video:', err);
            return;
          }

          // Start scanning
          if (readerRef.current && active) {
            await readerRef.current.decodeFromVideoDevice(
              undefined,
              videoRef.current,
              async (result) => {
                if (result && isScanning && active) {
                  await saveScan.mutateAsync({
                    content: result.getText(),
                    format: "PDF417",
                  });
                  setIsScanning(false);
                }
              }
            );
          }
        }
      } catch (err) {
        onError(err as Error);
      }
    }

    if (isScanning) {
      setupCamera();
    }

    // Cleanup function
    return () => {
      active = false;
      if (readerRef.current) {
        try {
          if (videoRef.current?.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
          }
        } catch (err) {
          console.error('Error cleaning up camera:', err);
        }
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