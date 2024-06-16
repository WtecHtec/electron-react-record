/* eslint import/prefer-default-export: off */
import { URL } from 'url';
import path from 'path';
import { exec } from 'child_process';

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
}

export function timestamp2Time(timestamp: number) {
  const date = new Date(timestamp);
  const Y = date.getFullYear() + '-';
  const M =
    (date.getMonth() + 1 < 10
      ? '0' + (date.getMonth() + 1)
      : date.getMonth() + 1) + '-';
  const D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ' ';
  const h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':';
  const m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
  const s = (date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds());
  return Y + M + D + h + m + s;
}

export function openFolderInExplorer(path: string) {  
  if (process.platform === 'win32') {  
    // 对于 Windows，使用 explorer 命令  
    exec(`explorer "${path}"`);  
  } else if (process.platform === 'darwin') {  
    // 对于 macOS，使用 open 命令  
    exec(`open "${path}"`);  
  } else {  
    // 对于 Linux，你可能需要使用 xdg-open 或其他适当的命令  
    exec(`xdg-open "${path}"`);  
  }  
}  
