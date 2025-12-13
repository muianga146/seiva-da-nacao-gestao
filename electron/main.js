const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Seiva da Nação - Gestão",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Simplificação para este exemplo
      webSecurity: false // Permite carregar imagens locais/CDN mistas se necessário
    },
    autoHideMenuBar: true, // Estilo mais limpo de App
  });

  // Em desenvolvimento, carrega a URL do Vite. Em produção, carrega o arquivo buildado.
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools(); // Abre console para debug
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});