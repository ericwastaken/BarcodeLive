import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Scan } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface ScanResultProps {
  className?: string;
}

export function ScanResult({ className = "" }: ScanResultProps) {
  const queryClient = useQueryClient();
  const { data: scans } = useQuery<Scan[]>({
    queryKey: ["/api/scans/recent"],
  });

  const clearScans = async () => {
    await apiRequest("POST", "/api/scans/clear");
    queryClient.invalidateQueries({ queryKey: ["/api/scans/recent"] });
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Scans</CardTitle>
        {scans?.length ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearScans}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear recent scans</span>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {scans?.length ? (
          <div className="space-y-4">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className={`p-4 rounded-lg border ${
                  scan.pattern && new RegExp(scan.pattern).test(scan.content)
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}
              >
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(scan.timestamp), {
                    addSuffix: true,
                  })}
                </div>
                <div className="mt-1 font-mono text-sm break-all">
                  {scan.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground p-4">
            No scans yet. Scan a PDF417 barcode to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}