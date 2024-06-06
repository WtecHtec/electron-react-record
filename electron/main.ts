import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'



// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let tray: Tray | null; // 全局变量来持有 Tray 实例
let maskWin: BrowserWindow | null; // 全局变量来持有 倒计时浮窗 实例


function createWindow() {
	win = new BrowserWindow({
		icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
		},
	})

	// Test active push message to Renderer-process.
	win.webContents.on('did-finish-load', () => {
		win?.webContents.send('main-process-message', (new Date).toLocaleString())
		// 打开调试面板
		win?.webContents.openDevTools()
	})

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL)
	} else {
		// win.loadFile('dist/index.html')
		win.loadFile(path.join(RENDERER_DIST, 'index.html'))
	}

}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
		win = null
		tray = null
	}
})

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		false && createWindow()
	}

})

/**
 * 系统托盘
 * @param init 
 * @returns 
 */
function createTray(init = 0) {
	if (tray) {
		console.log("Tray already created!");
		return
	}
	tray = new Tray(path.join(process.env.VITE_PUBLIC,  init === 0 ? 'tray-icon-start.png' : 'tray-icon-stop.png'));
	const startItem = {
		label: 'Start Record',
		click: function () {
			createCountDownMaskWin();
		}
	}
	const stopItem = {
		label: 'Stop Record',
		click: function () {
			console.log("Start Record");
			tray?.destroy()
			tray = null
			createTray(0)
		}
	}
	const contextMenu = Menu.buildFromTemplate([
		init === 0 ? startItem : stopItem,
		{
			label: 'Quit',
			role: 'quit'
		}
	]);

	tray.setToolTip('AV CRAFT');
	tray.setContextMenu(contextMenu);
}


function createCountDownMaskWin() {
	if (maskWin) {
		return;
	}
	maskWin = new BrowserWindow({
		width: 800,
		height: 600,
		frame: true, // 无边框
		transparent: true, // 透明窗口
		alwaysOnTop: true, // 窗口总是显示在最前面
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
		},
	})

	// Test active push message to Renderer-process.
	maskWin.webContents.on('did-finish-load', () => {
		ipcMain.on('count-down-end', () => {
			maskWin?.close()
			maskWin = null
			tray?.destroy()
			tray = null
			createTray(1)
		})
		// maskWin?.webContents.openDevTools()
	})

	if (VITE_DEV_SERVER_URL) {
		maskWin.loadURL(VITE_DEV_SERVER_URL + 'countdownmask.html')
	} else {
		// win.loadFile('dist/index.html')
		maskWin.loadFile(path.join(RENDERER_DIST, 'countdownmask.html'))
	}
	maskWin.maximize(); // 全屏显示窗口
}

// app.whenReady().then(createWindow)

app.whenReady().then(() => {
	createTray()
})