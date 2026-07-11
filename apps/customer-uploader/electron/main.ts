import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === "development";
const updateFeedUrl = process.env.MG_DESKTOP_UPDATE_FEED_URL || "";

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
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: "MG AutoTech File Upload Assistant",
    backgroundColor: "#050505",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://file.mgautotech.de")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5174");
  } else {
    await mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  if (updateFeedUrl.startsWith("https://")) {
    autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });
  }

  ipcMain.handle("open-external", async (_event, url: string) => {
    if (typeof url === "string" && url.startsWith("https://file.mgautotech.de")) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  ipcMain.handle("history-read", async () => {
    try {
      const path = historyPath();
      if (!existsSync(path)) return [];
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return [];
    }
  });

  ipcMain.handle("history-write", async (_event, rows: unknown[]) => {
    await mkdir(app.getPath("userData"), { recursive: true });
    writeFileSync(historyPath(), JSON.stringify(Array.isArray(rows) ? rows.slice(0, 50) : [], null, 2));
    return true;
  });

  ipcMain.handle("installation-id", async () => getInstallationId());
  ipcMain.handle("close-app", () => {
    app.quit();
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
