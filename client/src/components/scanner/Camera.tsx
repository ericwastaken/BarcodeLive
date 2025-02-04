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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

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

  const initializeCamera = async () => {
    if (!videoRef.current) {
      console.error("Video element not found during initialization");
      return;
    }

    console.log("Starting camera initialization...");
    setIsInitializing(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }

      console.log("Requesting camera access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

      setStream(mediaStream);
      console.log("Setting up video stream...");

      videoRef.current.srcObject = mediaStream;
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.muted = true;

      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) {
          reject(new Error("Video element not found"));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new Error("Video loading timed out"));
        }, 10000);

        videoRef.current.onloadedmetadata = () => {
          clearTimeout(timeoutId);
          videoRef.current?.play()
            .then(() => {
              console.log("Video stream started successfully");
              resolve();
            })
            .catch(reject);
        };
      });

      setHasPermission(true);
      setIsScanning(true);

      console.log("Camera initialization complete");
      toast({
        title: "Camera Ready",
        description: "Position the PDF417 barcode within the frame",
      });
    } catch (err) {
      console.error("Camera initialization error:", err);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
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
  };

  // Handle scanning
  useEffect(() => {
    if (!isScanning || !videoRef.current || !hasPermission || !stream) return;

    console.log("Starting barcode scanning...");
    let isMounted = true;

    const startScanning = async () => {
      try {
        // Create a new reader instance if needed
        if (!readerRef.current) {
          const reader = new BrowserMultiFormatReader(undefined, {
            formats: [BarcodeFormat.PDF_417]
          });
          readerRef.current = reader;
          console.log("Created new barcode reader with PDF417 format");
        }

        await videoRef.current!.play();
        console.log("Video playback resumed");

        // Start decoding from video device
        await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          async (result) => {
            if (result && isMounted) {
              console.log("Barcode detected:", result.getText());
              await saveScan.mutateAsync({
                content: result.getText(),
                format: "PDF417",
              });
              setIsScanning(false);
            }
          }
        );
        console.log("Barcode scanning started");
      } catch (err) {
        console.error("Scanning error:", err);
        onError(new Error("Failed to start scanning"));
      }
    };

    startScanning();

    return () => {
      console.log("Cleaning up scanner...");
      isMounted = false;
      if (videoRef.current) {
        videoRef.current.pause();
        console.log("Video playback paused");
      }
      // The reader will be automatically destroyed when decodeFromVideoDevice stops
      readerRef.current = null;
    };
  }, [isScanning, hasPermission, onError, saveScan, setIsScanning, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
      readerRef.current = null;
    };
  }, [stream]);

  const handleCameraButton = () => {
    console.log("Camera button clicked, current state:", { hasPermission, isInitializing });
    if (!hasPermission && !isInitializing) {
      initializeCamera();
    } else if (hasPermission && stream) {
      if (videoRef.current) {
        if (isScanning) {
          videoRef.current.pause();
          console.log("Video paused");
        } else {
          videoRef.current.play().catch(console.error);
          console.log("Video resumed");
        }
      }
      setIsScanning(!isScanning);
    }
  };

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className={`w-full h-full object-cover ${!isScanning ? 'brightness-50' : ''}`}
        playsInline
        muted
      />
      {hasPermission && isScanning && <ScannerOverlay />}

      {!isScanning && hasPermission && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/50 text-white px-4 py-2 rounded">
            Scanner Paused
          </div>
        </div>
      )}

      {!hasPermission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card text-card-foreground rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <CameraIcon className="mx-auto h-12 w-12 mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2 text-center">Camera Access Required</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Please allow camera access when prompted by your browser
            </p>
            <Button 
              variant="default"
              className="w-full"
              onClick={handleCameraButton}
              disabled={isInitializing}
            >
              {isInitializing ? "Requesting Access..." : "Enable Camera"}
            </Button>
          </div>
        </div>
      )}

      {hasPermission && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-[100]">
          <Button
            size="lg"
            variant={isScanning ? "destructive" : "default"}
            onClick={handleCameraButton}
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
      )}
    </div>
  );
}