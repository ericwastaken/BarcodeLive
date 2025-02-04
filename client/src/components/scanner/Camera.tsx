import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Pause, Play, Camera as CameraIcon } from "lucide-react";
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
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
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
    if (!isScanning || !videoRef.current) return;

    let active = true;
    let stream: MediaStream | null = null;
    let reader: BrowserMultiFormatReader | null = null;

    async function initializeCamera() {
      try {
        setIsInitializing(true);

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera API not supported in this browser");
        }

        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });

        if (!active || !videoRef.current) return;

        // Set up video element
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.muted = true;

        // Wait for video to be loaded
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play()
                .then(() => resolve())
                .catch(err => {
                  console.error("Play error:", err);
                  throw new Error("Failed to start video stream");
                });
            }
          };
        });

        setHasPermission(true);

        // Initialize barcode reader
        reader = new BrowserMultiFormatReader();
        const hints = new Map();
        hints.set(2, [BarcodeFormat.PDF_417]); // 2 is DecodeHints.POSSIBLE_FORMATS

        // Start continuous scanning
        await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          async (result) => {
            if (!active) return;
            if (result) {
              console.log("Barcode detected:", result.getText());
              await saveScan.mutateAsync({
                content: result.getText(),
                format: "PDF417",
              });
              setIsScanning(false);
            }
          }
        );

        toast({
          title: "Scanner Ready",
          description: "Position the PDF417 barcode within the green frame",
        });
      } catch (err) {
        console.error("Camera error:", err);
        setHasPermission(false);
        const message = err instanceof Error ? err.message : "Failed to access camera";
        toast({
          variant: "destructive",
          title: "Camera Error",
          description: message,
        });
        onError(new Error(message));
      } finally {
        setIsInitializing(false);
      }
    }

    initializeCamera();

    return () => {
      active = false;
      // Clean up video stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // Clean up reader
      if (reader) {
        reader.stopContinuousDecode();
      }
    };
  }, [isScanning, onError, saveScan, setIsScanning, toast]);

  if (!hasPermission) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card text-card-foreground rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
          <CameraIcon className="mx-auto h-12 w-12 mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2 text-center">Camera Access Required</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Please allow camera access when prompted by your browser
          </p>
          <Button 
            variant="default"
            className="w-full"
            onClick={() => setIsScanning(true)}
            disabled={isInitializing}
          >
            {isInitializing ? "Requesting Access..." : "Enable Camera"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <ScannerOverlay />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <Button
          size="lg"
          variant={isScanning ? "destructive" : "default"}
          onClick={() => setIsScanning(!isScanning)}
          disabled={isInitializing}
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
    </div>
  );
}