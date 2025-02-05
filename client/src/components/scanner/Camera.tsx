import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Pause, Play, Camera as CameraIcon } from "lucide-react";
import { ScannerOverlay, type ScannerOverlayHandle } from "@/components/scanner/ScannerOverlay";
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
  const scannerOverlayRef = useRef<ScannerOverlayHandle>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isCoolingDown, setIsCoolingDown] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scanningProcessRef = useRef<{ stop?: () => void } | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCoolingDownRef = useRef<boolean>(false);

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
      toast({
        title: "Scan saved",
        description: "The barcode has been successfully scanned and saved.",
      });
    },
  });

  const startCooldown = () => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }

    setIsCoolingDown(true);
    isCoolingDownRef.current = true;
    console.log("Starting cooldown period...");

    cooldownTimerRef.current = setTimeout(() => {
      setIsCoolingDown(false);
      isCoolingDownRef.current = false;
      cooldownTimerRef.current = null;
      console.log("Cooldown period ended");
    }, 3000);
  };

  const calculateScanArea = () => {
    if (!videoRef.current || !scannerOverlayRef.current) return null;

    const video = videoRef.current;
    const scanArea = scannerOverlayRef.current.getScanArea();

    if (!scanArea) return null;

    // Convert the scan area from screen coordinates to video coordinates
    const videoRect = video.getBoundingClientRect();

    const relativeLeft = (scanArea.left - videoRect.left) / videoRect.width;
    const relativeTop = (scanArea.top - videoRect.top) / videoRect.height;
    const relativeWidth = scanArea.width / videoRect.width;
    const relativeHeight = scanArea.height / videoRect.height;

    // Return coordinates in the format expected by ZXing
    return {
      left: Math.max(0, Math.min(1, relativeLeft)),
      top: Math.max(0, Math.min(1, relativeTop)),
      width: Math.max(0, Math.min(1, relativeWidth)),
      height: Math.max(0, Math.min(1, relativeHeight))
    };
  };

  const startVideoStream = async () => {
    if (!videoRef.current || !stream) return false;
    try {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      return true;
    } catch (error) {
      console.error("Failed to start video stream:", error);
      return false;
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
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    isCoolingDownRef.current = false;
    setIsCoolingDown(false);
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

      const videoElement = videoRef.current;
      videoElement.srcObject = mediaStream;
      videoElement.setAttribute("playsinline", "true");
      videoElement.muted = true;

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

  const startScanning = async () => {
    if (!videoRef.current || !readerRef.current || !stream) {
      console.error("Cannot start scanning: missing required references");
      return;
    }

    try {
      console.log("Starting barcode scanning...");
      const streamStarted = await startVideoStream();

      if (!streamStarted) {
        throw new Error("Failed to start video stream");
      }

      const scanArea = calculateScanArea();
      console.log("Scan area:", scanArea);

      const controls = await readerRef.current.decodeFromVideoElement({
        element: videoRef.current,
        cropArea: scanArea
      }, async (result) => {
        if (result && !isCoolingDownRef.current) {
          console.log("Barcode detected, cooldown status:", isCoolingDownRef.current);
          startCooldown(); // Start cooldown before processing the scan

          await saveScan.mutateAsync({
            content: result.getText(),
            format: "PDF417",
          });
        } else if (result) {
          console.log("Barcode detected but cooling down, ignoring");
        }
      });

      scanningProcessRef.current = controls;
      console.log("Barcode scanning started successfully");
    } catch (err) {
      console.error("Error starting scanning:", err);
      onError(new Error("Failed to start scanning"));
    }
  };

  const stopScanning = () => {
    console.log("Stopping scanning process...");
    if (scanningProcessRef.current?.stop) {
      scanningProcessRef.current.stop();
      scanningProcessRef.current = null;
    }
  };

  // Handle scanning state changes
  useEffect(() => {
    if (!hasPermission || !stream) return;

    const handleScanningStateChange = async () => {
      try {
        if (isScanning) {
          // Add a small delay to ensure video is ready
          setTimeout(async () => {
            await startScanning();
          }, 1000);
        } else {
          stopScanning();
        }
      } catch (error) {
        console.error("Error handling scanning state change:", error);
        onError(new Error("Failed to change scanning state"));
      }
    };

    handleScanningStateChange();
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

      <div className="absolute inset-0 z-10">
        {hasPermission && isScanning && <ScannerOverlay ref={scannerOverlayRef} />}

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