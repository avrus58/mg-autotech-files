import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent, type WebContents } from "electron";
import { autoUpdater } from "electron-updater";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === "development";
const updateFeedUrl = process.env.MG_DESKTOP_UPDATE_FEED_URL || "";
const appUserModelId = "de.mgautotech.fileuploadassistant";
const desktopCaptchaPath = "/desktop-auth/turnstile";
const desktopCaptchaTimeoutMs = 270_000;
const desktopCaptchaTokenMaxLength = 2_048;
type WindowOpenHandler = Parameters<WebContents["setWindowOpenHandler"]>[0];

type DesktopCaptchaResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

type PendingDesktopCaptcha = {
  state: string;
  requesterWebContentsId: number;
  challengeWindow: BrowserWindow;
  expectedUrl: URL;
  timeout: NodeJS.Timeout;
  cleanup(): void;
  resolve(result: DesktopCaptchaResult): void;
};

const pendingDesktopCaptchas = new Map<number, PendingDesktopCaptcha>();
const pendingCaptchaByRequester = new Map<number, number>();
let primaryWindow: BrowserWindow | null = null;

function isTrustedMainRendererDocument(value: string) {
  try {
    const current = new URL(value);
    if (isDev) {
      const expected = new URL(
        process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5174"
      );
      return (
        current.origin === expected.origin &&
        current.pathname === expected.pathname &&
        !current.search &&
        !current.hash
      );
    }

    return (
      current.href ===
      pathToFileURL(join(__dirname, "../dist/index.html")).href
    );
  } catch {
    return false;
  }
}

function normalizeDesktopCaptchaUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 500) return null;

  try {
    const url = new URL(value);
    const isProductionUrl = url.origin === "https://file.mgautotech.de";
    const isLocalDevUrl =
      Boolean(isDev) &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost");

    if (
      (!isProductionUrl && !isLocalDevUrl) ||
      url.username ||
      url.password ||
      url.pathname !== desktopCaptchaPath ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function isExpectedCaptchaDocument(value: string, expectedUrl: URL, state: string) {
  try {
    const current = new URL(value);
    const hash = new URLSearchParams(current.hash.replace(/^#/, ""));
    return (
      current.origin === expectedUrl.origin &&
      current.pathname === expectedUrl.pathname &&
      !current.search &&
      hash.get("state") === state &&
      hash.get("action") === "auth_login"
    );
  } catch {
    return false;
  }
}

function settleDesktopCaptcha(
  challengeWebContentsId: number,
  result: DesktopCaptchaResult,
  closeWindow = true
) {
  const pending = pendingDesktopCaptchas.get(challengeWebContentsId);
  if (!pending) return;

  pendingDesktopCaptchas.delete(challengeWebContentsId);
  pendingCaptchaByRequester.delete(pending.requesterWebContentsId);
  clearTimeout(pending.timeout);
  pending.cleanup();
  pending.resolve(result);

  if (closeWindow && !pending.challengeWindow.isDestroyed()) {
    setTimeout(() => {
      if (!pending.challengeWindow.isDestroyed()) pending.challengeWindow.close();
    }, 50);
  }
}

function getIconPath() {
  return isDev ? join(app.getAppPath(), "build", "icon.ico") : join(__dirname, "../build/icon.ico");
}

function historyPath() {
  return join(app.getPath("userData"), "safe-upload-history.json");
}

async function getInstallationId() {
  await mkdir(app.getPath("userData"), { recursive: true });
  const path = join(app.getPath("userData"), "installation-id.txt");
  if (existsSync(path)) {
    const existing = readFileSync(path, "utf8").trim();
    if (existing.length >= 12) return existing;
  }
  const id = randomUUID();
  writeFileSync(path, id);
  return id;
}

async function createWindow() {
  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "MG AutoTech File Upload Assistant",
    icon: getIconPath(),
    backgroundColor: "#050505",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const handleWindowOpen: WindowOpenHandler = ({ url }) => {
    if (url.startsWith("https://file.mgautotech.de")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  };

  mainWindow.webContents.setWindowOpenHandler(handleWindowOpen);
  const blockUntrustedMainNavigation = (event: Electron.Event, url: string) => {
    if (isTrustedMainRendererDocument(url)) return;
    event.preventDefault();
  };
  mainWindow.webContents.on("will-navigate", blockUntrustedMainNavigation);
  mainWindow.webContents.on("will-redirect", blockUntrustedMainNavigation);
  mainWindow.once("closed", () => {
    if (primaryWindow === mainWindow) primaryWindow = null;
  });
  primaryWindow = mainWindow;

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5174");
  } else {
    await mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId(appUserModelId);
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  if (updateFeedUrl.startsWith("https://")) {
    autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });
  }

  ipcMain.handle("open-external", async (_event: IpcMainInvokeEvent, url: string) => {
    if (typeof url === "string" && url.startsWith("https://file.mgautotech.de")) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle(
    "auth-captcha-request",
    async (
      event: IpcMainInvokeEvent,
      input: { challengeUrl?: unknown; action?: unknown }
    ): Promise<DesktopCaptchaResult> => {
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const expectedUrl = normalizeDesktopCaptchaUrl(input?.challengeUrl);

      if (
        !parentWindow ||
        parentWindow !== primaryWindow ||
        parentWindow.isDestroyed() ||
        event.senderFrame !== event.sender.mainFrame ||
        !isTrustedMainRendererDocument(event.sender.getURL()) ||
        !expectedUrl ||
        input?.action !== "auth_login"
      ) {
        return {
          ok: false,
          error: "Desktop security verification configuration is invalid.",
        };
      }

      if (pendingCaptchaByRequester.has(event.sender.id)) {
        return {
          ok: false,
          error: "A security verification window is already open.",
        };
      }

      const state = randomBytes(32).toString("hex");
      const challengeUrl = new URL(expectedUrl.href);
      challengeUrl.hash = new URLSearchParams({
        state,
        action: "auth_login",
      }).toString();

      const challengeWindow = new BrowserWindow({
        parent: parentWindow,
        modal: true,
        show: false,
        width: 430,
        height: 620,
        minWidth: 390,
        minHeight: 560,
        maximizable: false,
        fullscreenable: false,
        title: "MG AutoTech Security Verification",
        icon: getIconPath(),
        backgroundColor: "#050505",
        webPreferences: {
          preload: join(__dirname, "captcha-preload.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
          partition: "mg-auth-captcha",
        },
      });

      challengeWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      challengeWindow.webContents.session.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(false)
      );
      challengeWindow.webContents.session.setPermissionCheckHandler(() => false);

      const challengeWebContentsId = challengeWindow.webContents.id;
      const blockUnexpectedNavigation = (navigationEvent: Electron.Event, url: string) => {
        if (isExpectedCaptchaDocument(url, expectedUrl, state)) return;
        navigationEvent.preventDefault();
        settleDesktopCaptcha(challengeWebContentsId, {
          ok: false,
          error: "Security verification navigation was blocked.",
        });
      };
      const handleFailedLoad = (
        _loadEvent: Electron.Event,
        _errorCode: number,
        _errorDescription: string,
        _validatedUrl: string,
        isMainFrame: boolean
      ) => {
        if (!isMainFrame) return;
        settleDesktopCaptcha(challengeWebContentsId, {
          ok: false,
          error: "Security verification page could not be loaded.",
        });
      };
      const handleChallengeClosed = () => {
        settleDesktopCaptcha(
          challengeWebContentsId,
          { ok: false, error: "Security verification was cancelled." },
          false
        );
      };
      const handleRequesterDestroyed = () => {
        settleDesktopCaptcha(
          challengeWebContentsId,
          { ok: false, error: "Desktop login window was closed." },
          false
        );
        if (!challengeWindow.isDestroyed()) challengeWindow.close();
      };
      const handleReadyToShow = () => challengeWindow.show();

      challengeWindow.webContents.on("will-navigate", blockUnexpectedNavigation);
      challengeWindow.webContents.on("will-redirect", blockUnexpectedNavigation);
      challengeWindow.webContents.on("did-fail-load", handleFailedLoad);
      challengeWindow.once("closed", handleChallengeClosed);
      challengeWindow.once("ready-to-show", handleReadyToShow);
      event.sender.once("destroyed", handleRequesterDestroyed);

      const resultPromise = new Promise<DesktopCaptchaResult>((resolve) => {
        const timeout = setTimeout(() => {
          settleDesktopCaptcha(challengeWebContentsId, {
            ok: false,
            error: "Security verification timed out. Please try again.",
          });
        }, desktopCaptchaTimeoutMs);

        pendingDesktopCaptchas.set(challengeWebContentsId, {
          state,
          requesterWebContentsId: event.sender.id,
          challengeWindow,
          expectedUrl,
          timeout,
          cleanup() {
            event.sender.removeListener("destroyed", handleRequesterDestroyed);
            challengeWindow.removeListener("closed", handleChallengeClosed);
            challengeWindow.removeListener("ready-to-show", handleReadyToShow);
            if (!challengeWindow.webContents.isDestroyed()) {
              challengeWindow.webContents.removeListener(
                "will-navigate",
                blockUnexpectedNavigation
              );
              challengeWindow.webContents.removeListener(
                "will-redirect",
                blockUnexpectedNavigation
              );
              challengeWindow.webContents.removeListener(
                "did-fail-load",
                handleFailedLoad
              );
            }
          },
          resolve,
        });
        pendingCaptchaByRequester.set(event.sender.id, challengeWebContentsId);
      });

      try {
        await challengeWindow.loadURL(challengeUrl.href);
      } catch {
        settleDesktopCaptcha(challengeWebContentsId, {
          ok: false,
          error: "Security verification page could not be loaded.",
        });
      }

      return resultPromise;
    }
  );

  ipcMain.handle(
    "auth-captcha-complete",
    async (
      event: IpcMainInvokeEvent,
      input: { state?: unknown; token?: unknown }
    ) => {
      const pending = pendingDesktopCaptchas.get(event.sender.id);
      const token = typeof input?.token === "string" ? input.token.trim() : "";
      const state = typeof input?.state === "string" ? input.state : "";

      if (
        !pending ||
        event.senderFrame !== event.sender.mainFrame ||
        !isExpectedCaptchaDocument(event.sender.getURL(), pending.expectedUrl, pending.state) ||
        state !== pending.state ||
        !token ||
        token.length > desktopCaptchaTokenMaxLength
      ) {
        return { ok: false, error: "Security verification response was rejected." };
      }

      settleDesktopCaptcha(event.sender.id, { ok: true, token });
      return { ok: true };
    }
  );

  ipcMain.handle(
    "auth-captcha-cancel",
    async (event: IpcMainInvokeEvent, input: { state?: unknown }) => {
      const pending = pendingDesktopCaptchas.get(event.sender.id);
      if (
        !pending ||
        event.senderFrame !== event.sender.mainFrame ||
        input?.state !== pending.state ||
        !isExpectedCaptchaDocument(event.sender.getURL(), pending.expectedUrl, pending.state)
      ) {
        return { ok: false };
      }
      settleDesktopCaptcha(event.sender.id, {
        ok: false,
        error: "Security verification was cancelled.",
      });
      return { ok: true };
    }
  );

  ipcMain.handle("history-read", async () => {
    try {
      const path = historyPath();
      if (!existsSync(path)) return [];
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return [];
    }
  });

  ipcMain.handle("history-write", async (_event: IpcMainInvokeEvent, rows: unknown[]) => {
    await mkdir(app.getPath("userData"), { recursive: true });
    writeFileSync(historyPath(), JSON.stringify(Array.isArray(rows) ? rows.slice(0, 50) : [], null, 2));
    return true;
  });

  ipcMain.handle("installation-id", async () => getInstallationId());
  ipcMain.handle("close-app", () => {
    app.quit();
    return true;
  });
  ipcMain.handle("open-app-data-folder", async () => {
    await shell.openPath(app.getPath("userData"));
    return true;
  });
  ipcMain.handle("native-update-check", async () => {
    if (!updateFeedUrl.startsWith("https://")) {
      return { configured: false, updateAvailable: false, message: "Native updater feed is not configured." };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return {
        configured: true,
        updateAvailable: Boolean(result?.updateInfo?.version),
        version: result?.updateInfo?.version ?? null,
      };
    } catch (error) {
      return {
        configured: true,
        updateAvailable: false,
        error: error instanceof Error ? error.message : "Native update check failed.",
      };
    }
  });

  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
