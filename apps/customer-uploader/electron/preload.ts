import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mgDesktop", {
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  readHistory: () => ipcRenderer.invoke("history-read"),
  writeHistory: (rows: unknown[]) => ipcRenderer.invoke("history-write", rows),
  getInstallationId: () => ipcRenderer.invoke("installation-id"),
  requestAuthCaptchaToken: (input: {
    challengeUrl: string;
    action: "auth_login";
  }) => ipcRenderer.invoke("auth-captcha-request", input),
  closeApp: () => ipcRenderer.invoke("close-app"),
  checkNativeUpdate: () => ipcRenderer.invoke("native-update-check"),
  openAppDataFolder: () => ipcRenderer.invoke("open-app-data-folder"),
});
