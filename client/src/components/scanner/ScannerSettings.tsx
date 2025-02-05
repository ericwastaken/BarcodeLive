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
});

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

  const onSubmit = (data: ScannerSettings) => {
    onSettingsChange(data);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="absolute right-4">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Scanner Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
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
                    <Input type="number" {...field} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
