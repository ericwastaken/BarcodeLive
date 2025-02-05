import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
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
  const [isCoolingDown, setIsCoolingDown] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scanningProcessRef = useRef<{ stop?: () => void } | null>(null);

  const playBeep = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 1000;
      gainNode.gain.value = 0.1;

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (err) {
      console.error("Error playing beep:", err);
    }
  };

  const saveScan = useMutation({
    mutationFn: async (scan: InsertScan) => {
      await apiRequest("POST", "/api/scans", scan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scans/recent"] });
      playBeep().catch(console.error);
      setIsCoolingDown(true);
      setTimeout(() => {
        setIsCoolingDown(false);
      }, 1000);
      toast({
        title: "Scan saved",
        description: "The barcode has been successfully scanned and saved.",
      });
    },
  });

  const stopScanning = () => {
    console.log("Stopping scanning process...");
    if (scanningProcessRef.current?.stop) {
      scanningProcessRef.current.stop();
      scanningProcessRef.current = null;
    }
  };

  const startScanning = async () => {
    if (!videoRef.current || !readerRef.current || !stream) {
      console.log("Cannot start scanning: missing required references");
      return;
    }

    try {
      console.log("Starting barcode scanning...");

      // Ensure video is playing and visible
      if (videoRef.current.paused) {
        console.log("Attempting to play video...");
        await videoRef.current.play();
      }

      const controls = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (result) => {
          if (result && !isCoolingDown) {
            console.log("Barcode detected:", result.getText());
            await saveScan.mutateAsync({
              content: result.getText(),
              format: "PDF417",
            });
          }
        }
      );

      scanningProcessRef.current = controls;
      console.log("Barcode scanning started successfully");
    } catch (err) {
      console.error("Error starting scanning:", err);
      onError(new Error("Failed to start scanning"));
    }
  };

  const cleanupResources = () => {
    stopScanning();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (readerRef.current) {
      readerRef.current = null;
    }
  };

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

      // Clean up any existing resources first
      cleanupResources();

      console.log("Requesting camera access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

      if (!videoRef.current) {
        throw new Error("Video element lost during initialization");
      }

      setStream(mediaStream);
      console.log("Setting up video stream...");

      // Set up video element
      const videoElement = videoRef.current;
      videoElement.srcObject = mediaStream;
      videoElement.setAttribute("playsinline", "true");
      videoElement.muted = true;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        if (!videoElement) {
          reject(new Error("Video element not found"));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new Error("Video loading timed out"));
        }, 10000);

        const handleVideoReady = async () => {
          try {
            clearTimeout(timeoutId);
            await videoElement.play();
            resolve();
          } catch (err) {
            reject(err);
          }
        };

        videoElement.addEventListener('loadedmetadata', handleVideoReady, { once: true });
      });

      // Initialize the barcode reader
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      setHasPermission(true);
      setIsScanning(true);

    } catch (err) {
      console.error("Camera initialization error:", err);
      cleanupResources();
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

  // Handle scanning state changes
  useEffect(() => {
    if (!hasPermission || !stream) return;

    if (isScanning) {
      startScanning();
    } else {
      stopScanning();
    }
  }, [isScanning, hasPermission, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const handleCameraButton = () => {
    console.log("Camera button clicked, current state:", { hasPermission, isInitializing });
    if (!hasPermission && !isInitializing) {
      initializeCamera();
    } else if (hasPermission && stream) {
      setIsScanning(!isScanning);
    }
  };

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-all duration-200 ${!isScanning ? 'opacity-50' : 'opacity-100'}`}
        playsInline
        autoPlay
        muted
      />

      {/* Overlay and UI elements with proper z-index */}
      <div className="absolute inset-0 z-10">
        {hasPermission && isScanning && <ScannerOverlay />}

        {!isScanning && hasPermission && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="bg-black/50 text-white px-4 py-2 rounded">
              Scanner Paused
            </div>
          </div>
        )}
      </div>

      {!hasPermission && (
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
              onClick={handleCameraButton}
              disabled={isInitializing}
            >
              {isInitializing ? "Requesting Access..." : "Enable Camera"}
            </Button>
          </div>
        </div>
      )}

      {hasPermission && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-50">
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