import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("mgCaptcha", {
  complete: (input: { state: string; token: string }) =>
    ipcRenderer.invoke("auth-captcha-complete", input),
  cancel: (input: { state: string }) =>
    ipcRenderer.invoke("auth-captcha-cancel", input),
});
