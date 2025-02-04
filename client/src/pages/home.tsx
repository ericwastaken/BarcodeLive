import { useState } from "react";
import { Camera } from "@/components/scanner/Camera";
import { ScanResult } from "@/components/scanner/ScanResult";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isScanning, setIsScanning] = useState(true);
  const { toast } = useToast();

  const handleError = (error: Error) => {
    toast({
      variant: "destructive",
      title: "Error",
      description: error.message,
    });
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center">
      <div className="w-full max-w-3xl p-4">
        <Card className="overflow-hidden">
          <div className="aspect-[4/3] relative">
            <Camera
              onError={handleError}
              isScanning={isScanning}
              setIsScanning={setIsScanning}
            />
          </div>
        </Card>
        <ScanResult className="mt-4" />
      </div>
    </div>
  );
}
