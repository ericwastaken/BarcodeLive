import { forwardRef, useImperativeHandle, useRef } from "react";

export interface ScannerOverlayHandle {
  getScanArea: () => DOMRect | null;
}

export const ScannerOverlay = forwardRef<ScannerOverlayHandle>((_, ref) => {
  const scanAreaRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getScanArea: () => scanAreaRef.current?.getBoundingClientRect() ?? null
  }));

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div 
        ref={scanAreaRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 aspect-[3/1] border-2 border-[#34C759] rounded-lg"
      >
        <div className="absolute inset-0 border-[3px] border-transparent">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#34C759]" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#34C759]" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#34C759]" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#34C759]" />
        </div>
      </div>
    </div>
  );
});

ScannerOverlay.displayName = "ScannerOverlay";