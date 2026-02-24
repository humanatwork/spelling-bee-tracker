import { app, BrowserWindow } from 'electron';
import path from 'path';

const PORT = 3141;
const isDev = process.env.NODE_ENV === 'development';

// Set user data path for SQLite database in production
if (!isDev) {
  process.env.ELECTRON_USER_DATA = app.getPath('userData');
}

// Start Express server
require(path.join(__dirname, '../server/dist/index.js'));

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 900,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadURL(`http://localhost:${PORT}`);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
