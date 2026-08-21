export {};

export type DesktopUpdateStatus = {
  state: "idle" | "checking" | "available" | "downloading" | "ready" | "current" | "error";
  message: string;
  progress?: number;
  version?: string;
};

declare global {
  interface Window {
    dividendenflussDesktop?: {
      getAppInfo: () => Promise<{
        version: string;
        packaged: boolean;
        updateStatus: DesktopUpdateStatus;
      }>;
      skipStartupUpdate: () => void;
      checkForUpdates: () => Promise<DesktopUpdateStatus>;
      installReadyUpdate: () => void;
      onUpdateStatus: (callback: (status: DesktopUpdateStatus) => void) => () => void;
    };
  }
}
