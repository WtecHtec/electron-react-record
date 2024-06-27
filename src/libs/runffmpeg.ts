const { exec } = require('child_process');
// const util = require('util');

// const execPromise = util.promisify(exec);


export default function runffmpeg(ffmpeg: any, inputPath: any, outputPath: any) {
    const command = `${ffmpeg} -i ${inputPath} -vsync 1 -c:v libx264 -preset slow -crf 18 -movflags +faststart -pix_fmt yuv420p -vsync 1 ${outputPath}`;
    return new Promise(async (resolve, reject) => {
        try {
            const childProcess = exec(command);
            childProcess.stdout.on('data', (data: any) => {
                console.log(`stdout: ${data}`);
                if (childProcess) {
                    childProcess.kill();
                    console.log('FFmpeg process has been terminated');
                  }
              });
              childProcess.on('close', (code: any) => {
                console.log(`child process exited with code ${code}`);
                resolve(outputPath)
              });
          } catch (error: any) {
            console.error(`Command failed with error: ${error.message}`);
            console.error(`Error details: ${error.stderr}`);
          }
     
    })

}

