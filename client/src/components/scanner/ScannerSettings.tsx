import * as React from "react";
import { z } from "zod";
import { Settings } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const settingsSchema = z.object({
  cooldownTime: z.coerce
    .number()
    .min(0, "Cooldown time must be positive")
    .max(10000, "Cooldown time must be less than 10 seconds"),
  dataPattern: z.string().min(1, "Pattern is required"),
  flipHorizontal: z.boolean(),
});

// Default settings as a constant for reuse
const DEFAULT_SETTINGS = {
  cooldownTime: 3000,
  dataPattern: "^0934[0-9A-E]{28}$",
  flipHorizontal: false
};

export type ScannerSettings = z.infer<typeof settingsSchema>;

interface ScannerSettingsProps {
  settings: ScannerSettings;
  onSettingsChange: (settings: ScannerSettings) => void;
}

export function ScannerSettings({ settings, onSettingsChange }: ScannerSettingsProps) {
  const [open, setOpen] = React.useState(false);
  const form = useForm<ScannerSettings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  const resetZoom = () => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0');
    }
  };

  // Reset zoom when dialog closes
  React.useEffect(() => {
    if (!open) {
      resetZoom();
    }
  }, [open]);

  const onSubmit = (data: ScannerSettings) => {
    onSettingsChange(data);
    setOpen(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleBlur = () => {
    // Small delay to ensure the zoom reset happens after any mobile keyboard actions
    setTimeout(resetZoom, 100);
  };

  const resetToDefaults = () => {
    form.reset(DEFAULT_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Scanner Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent onOpenAutoFocus={(e) => {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('button[type="button"][variant="outline"]')?.focus();
      }}>
        <DialogHeader>
          <DialogTitle>Scanner Settings</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cooldownTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cooldown Time (ms)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} autoFocus={false} onBlur={handleBlur} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dataPattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Data Pattern (Regex)</FormLabel>
                  <FormControl>
                    <Input {...field} onBlur={handleBlur} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="flipHorizontal"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Flip Horizontal</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex flex-row justify-center items-center gap-2 mt-6">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={resetToDefaults}
                className="flex-shrink-0 min-w-[80px]"
              >
                Defaults
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose} 
                className="flex-shrink-0 min-w-[80px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-shrink-0 min-w-[80px]"
              >
                Save
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}