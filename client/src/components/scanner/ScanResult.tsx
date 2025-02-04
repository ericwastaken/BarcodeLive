import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Scan } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface ScanResultProps {
  className?: string;
}

export function ScanResult({ className = "" }: ScanResultProps) {
  const { data: scans } = useQuery<Scan[]>({
    queryKey: ["/api/scans/recent"],
  });

  if (!scans?.length) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Recent Scans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className="p-4 bg-white rounded-lg border border-gray-200"
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
      </CardContent>
    </Card>
  );
}
