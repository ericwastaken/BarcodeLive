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
    if (!isScanning || isInitializing) return;

    let active = true;
    let reader: BrowserMultiFormatReader | null = null;

    async function startCamera() {
      try {
        setIsInitializing(true);

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera access is not supported in this browser");
        }

        if (!videoRef.current) return;

        // Clean up any existing streams
        if (videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
          videoRef.current.srcObject = null;
        }

        // Set up video element
        videoRef.current.setAttribute("playsinline", "true"); // Important for iOS
        videoRef.current.setAttribute("muted", "true");
        videoRef.current.setAttribute("autoplay", "true");

        // Request camera access with environment facing camera first
        console.log("Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!active || !videoRef.current) return;

        // Attach stream to video element
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return;
          videoRef.current.onloadedmetadata = () => resolve();
        });

        console.log("Video metadata loaded, attempting to play...");

        try {
          await videoRef.current.play();
          console.log("Video playing successfully");
          setHasPermission(true);
        } catch (playError) {
          console.error("Error playing video:", playError);
          throw new Error("Failed to start video stream");
        }

        // Initialize barcode reader
        reader = new BrowserMultiFormatReader();
        console.log("Starting barcode detection...");

        // Configure hints for PDF417
        const hints = new Map();
        hints.set("possibleFormats", [BarcodeFormat.PDF_417]);
        hints.set("tryHarder", true);

        await reader.decodeFromVideoElement(videoRef.current, async (result, err) => {
          if (!active) return;

          if (result) {
            console.log("Barcode detected:", result.getText());
            await saveScan.mutateAsync({
              content: result.getText(),
              format: "PDF417",
            });
            setIsScanning(false);
          } else if (err) {
            // Only log scanning errors if they're not the usual "not found" errors
            if (!err.message.includes("not found")) {
              console.error("Scanning error:", err);
            }
          }
        });

        toast({
          title: "Camera Ready",
          description: "Position the PDF417 barcode within the green frame",
        });
      } catch (err) {
        console.error("Camera error:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to access camera";
        setHasPermission(false);
        toast({
          variant: "destructive",
          title: "Camera Error",
          description: errorMessage,
        });
        onError(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setIsInitializing(false);
      }
    }

    startCamera();

    return () => {
      active = false;
      if (reader) {
        try {
          reader.stopContinuousDecode();
        } catch (err) {
          console.error("Error stopping reader:", err);
        }
      }
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isScanning, isInitializing, onError, saveScan, setIsScanning, toast]);

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center text-white p-4">
          <CameraIcon className="mx-auto h-12 w-12 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
          <p className="text-sm text-gray-300">
            Please allow camera access to scan barcodes
          </p>
        </div>
      </div>
    );
  }

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
    </>
  );
}