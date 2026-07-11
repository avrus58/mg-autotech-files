export {};

declare global {
  interface Window {
    mgDesktop?: {
      openExternal(url: string): Promise<boolean>;
      readHistory(): Promise<SafeUploadHistoryRow[]>;
      writeHistory(rows: SafeUploadHistoryRow[]): Promise<boolean>;
      getInstallationId(): Promise<string>;
      closeApp(): Promise<boolean>;
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
    status: string;
    createdAt: string;
  };
}
