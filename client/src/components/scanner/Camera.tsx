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

        // Initialize barcode reader with PDF417 format
        reader = new BrowserMultiFormatReader();
        const formats = [BarcodeFormat.PDF_417];
        reader.setFormats(formats);

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
        try {
          reader.reset();
        } catch (err) {
          console.error("Error stopping reader:", err);
        }
      }
    };
  }, [isScanning, onError, saveScan, setIsScanning, toast]);

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center text-white p-4">
          <CameraIcon className="mx-auto h-12 w-12 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
          <p className="text-sm text-gray-300 mb-4">
            Click the button below to enable camera access
          </p>
          <Button 
            variant="outline"
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