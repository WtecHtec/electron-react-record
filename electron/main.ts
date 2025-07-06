import { app, BrowserWindow, Tray, Menu, ipcMain, desktopCapturer,screen } from 'electron'
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
let recordWin: BrowserWindow | null; // 全局变量来持有 录屏浮窗 实例
let editorWin: BrowserWindow | null; // 全局变量来持有 视频编辑 实例
let blobUrl: string; // 全局变量来持有 录屏 结果


const is_mac = process.platform === "darwin";

// 如果是 macOS，则隐藏 dock 图标
if (is_mac) {
  app.dock.hide(); // - 1 -
}
// app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer')
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
			console.log("Stop Record");
			tray?.destroy()
			tray = null
			createTray(0)
			if (recordWin) {
				recordWin?.webContents.send('end_record_main')
			}
		}
	}
	const contextMenu = Menu.buildFromTemplate([
		init === 0 ? startItem : stopItem,
		{
			label: 'Quit',
			role: 'quit'
		}
	]);

	tray.setToolTip('Record Craft');
	tray.setContextMenu(contextMenu);
}


/**
 * 倒计时浮窗
 * @returns 
 */
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
		ipcMain.on('count_down_end_render', () => {
			maskWin?.hide()
			maskWin = null
			try {
				tray?.destroy()
				tray = null
				createTray(1)
				createRecordWin()
			} catch (error) {
				console.log(error)
			}
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
	// 设置窗口始终在最前面
	maskWin.setAlwaysOnTop(true, "screen-saver"); // - 2 -
	// 设置窗口在所有工作区都可见
	maskWin.setVisibleOnAllWorkspaces(true); // - 3 -
}



/**
 * 录屏状态 浮窗
 * @returns 
 */
function createRecordWin() {
	if (recordWin) {
		return;
	}
	if (is_mac) {
		app.dock.hide(); // - 1 -
	}
	// 获取屏幕的主显示器信息
	const { width, height } = screen.getPrimaryDisplay().workAreaSize;

	// 设置窗口的宽度和高度
	const windowWidth = 120;
	const windowHeight = 120;
	// app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer,DesktopCaptureMacV2')
	recordWin = new BrowserWindow({
		width: windowWidth,
		height: windowHeight,
		x: width / 2 - windowWidth / 2,
		y: height - windowHeight,
		frame: true, // 无边框
		transparent: true, // 透明窗口
		alwaysOnTop: true, // 窗口总是显示在最前面
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
		},
	})

	// Test active push message to Renderer-process.
	recordWin.webContents.on('did-finish-load', () => {
		desktopCapturer.getSources({ types: ['screen'] }).then(() => {
			// console.log(sources)
			recordWin?.webContents.send('start_record_main', 'screen:1:0')
			// for (const source of sources) {
			// 	if (source.name === 'Electron') {
			// 		maskWin?.webContents.send('SET_SOURCE', source.id)
			// 		return
			// 	}
			// }
		})
		ipcMain.on('stop_record_render', (_, url) => {
			blobUrl = url
			recordWin?.hide()
			// recordWin = null
			createEditorWindow()
			tray?.destroy()
			tray = null
			createTray(0)
		})
		// recordWin?.webContents.openDevTools()
	})

	recordWin?.setContentProtection(true)
	// 设置窗口始终在最前面
	recordWin.setAlwaysOnTop(true, "screen-saver"); // - 2 -
	// 设置窗口在所有工作区都可见
	recordWin.setVisibleOnAllWorkspaces(true); // - 3 -

	if (VITE_DEV_SERVER_URL) {
		recordWin.loadURL(VITE_DEV_SERVER_URL + 'record.html')
	} else {
		// win.loadFile('dist/index.html')
		recordWin.loadFile(path.join(RENDERER_DIST, 'record.html'))
	}
	// maskWin.maximize(); // 全屏显示窗口
}

/** 创建编辑器窗口 */
function createEditorWindow() {
	editorWin = new BrowserWindow({
		icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
		webPreferences: {
			preload: path.join(__dirname, 'preload.mjs'),
		},
	})

	// Test active push message to Renderer-process.
	editorWin.webContents.on('did-finish-load', () => {
		editorWin?.webContents.send('record_url_main', blobUrl)
		// 打开调试面板
		// editorWin?.webContents.openDevTools()
	})

	editorWin.webContents.on('destroyed', () => {
		recordWin?.close()
		recordWin = null
		blobUrl = ''
	})

	if (VITE_DEV_SERVER_URL) {
		editorWin.loadURL(VITE_DEV_SERVER_URL + 'editor.html')
	} else {
		// win.loadFile('dist/index.html')
		editorWin.loadFile(path.join(RENDERER_DIST, 'editor.html'))
	}

}
// app.whenReady().then(createWindow)

app.whenReady().then(() => {
	createTray()
	// uIOhook.on('keydown', (e) => {
	// 	if (e.keycode === UiohookKey.Q) {
	// 		console.log('Hello!')
	// 	}
	
	// 	if (e.keycode === UiohookKey.Escape) {
	// 		process.exit(0)
	// 	}
	// })
	
	// uIOhook.start()
})