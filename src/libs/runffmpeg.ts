import globalLogger from "../main/logger";

const { exec } = require('child_process');
// const util = require('util');

// const execPromise = util.promisify(exec);
// /Users/shenruqi/Desktop/code/wtechtec/electron-react-record/src/main/ffmpeg-static-electron/bin/mac/arm64/ffmpeg -i  /Users/shenruqi/Library/Application Support/Electron/av-craft.webm -vsync 1 -c:v libx264 -preset slow -crf 18 -movflags +faststart -pix_fmt yuv420p -vsync 1 /Users/shenruqi/Desktop/av-craft-2024-06-28-12:37:34.mp4


export default function runffmpeg(ffmpeg: any, inputPath: any, outputPath: any) {
    const command = `"${ffmpeg}" -i "${inputPath}" -vsync 1 -c:v libx264 -preset slow -crf 18 -movflags +faststart -pix_fmt yuv420p -vsync 1 "${outputPath}"`;
    globalLogger.info('ffmpegPath command: ' + command);
    return new Promise(async (resolve, reject) => {
            globalLogger.info('ffmpegPath command run: ' + command);
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    globalLogger.info('ffmpegPath command error: ' + error.message);
                //   console.error(`执行命令时发生错误: ${error.message}`);
                  console.error(`Command failed with error: ${error.message}`);
                  console.error(`Error details: ${error.stderr}`);
                  resolve('')
                  return;
                }
              
                if (stderr) {
                    globalLogger.info('ffmpegPath command stderr: ' + stderr.message);
                   console.error(`标准错误输出: ${stderr}`);

                  resolve('')
                  return;
                }
              
                console.log(`标准输出:\n${stdout}`);
                globalLogger.info('ffmpegPath command stdout: ' + stdout);
                 // 优雅退出程序
                 setTimeout(() => {
                    process.exit(0);
                 }, 0)
                // 优雅退出程序
                resolve(outputPath)
              });
        // try{
        //     const childProcess = await exec(command);
        //     childProcess.stdout.on('data', (data: any) => {
        //         console.log(`stdout: ${data}`);
        //         globalLogger.info('ffmpegPath command stdout: ' + data);
        //         if (childProcess) {
        //             childProcess.kill();
        //             console.log('FFmpeg process has been terminated');
        //           }
        //       });
        //       childProcess.on('close', (code: any) => {
        //         console.log(`child process exited with code ${code}`);
        //         resolve(outputPath)
        //       });
        //   } catch (error: any) {
        //     globalLogger.info('ffmpegPath command error: ' + error.message);
        //     globalLogger.info('ffmpegPath command error details: ' + error.stderr);
        //     console.error(`Command failed with error: ${error.message}`);
        //     console.error(`Error details: ${error.stderr}`);
        //   }
     
    })

}

