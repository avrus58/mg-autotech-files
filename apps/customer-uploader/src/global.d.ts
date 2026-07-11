export {};

declare global {
  interface Window {
    mgDesktop?: {
      openExternal(url: string): Promise<boolean>;
      readHistory(): Promise<SafeUploadHistoryRow[]>;
      writeHistory(rows: SafeUploadHistoryRow[]): Promise<boolean>;
      getInstallationId(): Promise<string>;
      closeApp(): Promise<boolean>;
      openAppDataFolder(): Promise<boolean>;
      checkNativeUpdate(): Promise<{
        configured: boolean;
        updateAvailable: boolean;
        version?: string | null;
        message?: string;
        error?: string;
      }>;
    };
  }

  type SafeUploadHistoryRow = {
    requestId: string;
    fileName: string;
    fileSize: number;
    sha256: string;
    status: "draft" | "uploading" | "submitted" | "failed" | "cancelled" | string;
    createdAt: string;
    updatedAt?: string;
    vehicleSummary?: string;
    serviceSummary?: string;
    localOnly?: boolean;
    lastServerStatus?: string | null;
    errorMessage?: string | null;
  };
}
