import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls, BarcodeFormat } from "@zxing/browser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Pause, Play, Camera as CameraIcon } from "lucide-react";
import { ScannerOverlay, type ScannerOverlayHandle } from "@/components/scanner/ScannerOverlay";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { InsertScan } from "@shared/schema";
import { ScannerSettings, type ScannerSettings as ScannerSettingsType } from "./ScannerSettings";

interface CameraProps {
  onError: (error: Error) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
}

// Default scanner settings
const DEFAULT_SETTINGS: ScannerSettingsType = {
  cooldownTime: 3000,
  dataPattern: "^0934[0-9A-E]{28}$"
};

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
  const scanningProcessRef = useRef<IScannerControls | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCoolingDownRef = useRef<boolean>(false);
  const [settings, setSettings] = useState<ScannerSettingsType>(DEFAULT_SETTINGS);

  // Reinitialize scanner when settings change
  useEffect(() => {
    if (isScanning && hasPermission) {
      stopScanning();
      startScanning().catch(console.error);
    }
  }, [settings]);

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

  const saveScan = {
    mutateAsync: async (scan: InsertScan) => {
      const storedScans = localStorage.getItem('scans');
      const scans = storedScans ? JSON.parse(storedScans) : [];
      const newScan = {
        ...scan,
        id: Date.now(),
        timestamp: new Date(),
      };
      localStorage.setItem('scans', JSON.stringify([newScan, ...scans]));
      // Emit a custom event when scan is saved
      window.dispatchEvent(new CustomEvent('scanSaved'));
      playBeep().catch(console.error);
    }
  };

  const startCooldown = () => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }

    setIsCoolingDown(true);
    isCoolingDownRef.current = true;

    cooldownTimerRef.current = setTimeout(() => {
      setIsCoolingDown(false);
      isCoolingDownRef.current = false;
      cooldownTimerRef.current = null;
    }, settings.cooldownTime);
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

    setIsInitializing(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }

      cleanupResources();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

      if (!videoRef.current) {
        throw new Error("Video element lost during initialization");
      }

      setStream(mediaStream);

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
        // Configure reader to only detect PDF417 barcodes
        const hints = new Map();
        hints.set(2, [BarcodeFormat.PDF_417]);
        readerRef.current = new BrowserMultiFormatReader(hints);
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
      const controls = await readerRef.current.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result, error) => {
          if (error) {
            return;
          }

          if (!result) return;

          const scannedData = result.getText();

          // Process if not in cooldown
          if (!isCoolingDownRef.current) {
            startCooldown();
            saveScan.mutateAsync({
              content: scannedData,
              format: "PDF417",
              pattern: settings.dataPattern,
            }).catch(console.error);
          }
        }
      );

      scanningProcessRef.current = controls;
    } catch (err) {
      console.error("Error starting scanning:", err);
      onError(new Error("Failed to start scanning"));
    }
  };

  const stopScanning = () => {
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
    if (!hasPermission && !isInitializing) {
      initializeCamera();
    } else if (hasPermission && stream) {
      setIsScanning(!isScanning);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Fixed header */}
      <div className="bg-primary text-primary-foreground py-3 px-6 shadow-md relative">
        <h1 className="text-xl font-semibold text-center">Barcode Live Scanner</h1>
        <ScannerSettings settings={settings} onSettingsChange={setSettings} />
      </div>

      {/* Video container - using flex-1 to take remaining space */}
      <div className="relative flex items-center justify-center bg-black h-[300px]">
        <div className="w-full h-full">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-all duration-200 ${!isScanning ? 'opacity-50' : 'opacity-100'}`}
            style={{ transform: `${settings.flipHorizontal ? 'scaleY(-1)' : ''} ${settings.flipVertical ? 'scaleX(-1)' : ''}`.trim() || 'none' }}
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
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="bg-card text-card-foreground rounded-lg shadow-lg p-6 max-w-md w-full mx-4 my-auto">
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
        </div>
      </div>

      {/* Controls with fixed margins */}
      {hasPermission && (
        <div className="bg-background h-[52px] flex items-center justify-center my-2.5">
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