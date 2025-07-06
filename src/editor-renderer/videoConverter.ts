import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const initFFmpeg = async () => {
    if (ffmpeg) return ffmpeg;
    
    
    const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
    ffmpeg = new FFmpeg()
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm"
        ),
        workerURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.worker.js`,
            "text/javascript"
        ),
    });
    
    return ffmpeg;
};

export const convertWebmToMp4 = async (
    inff: FFmpeg,
    webmBlob: Blob, 
    onProgress?: (progress: number) => void
): Promise<Blob> => {
    try {
        let ff = inff;
        if (!inff) {
            ff = await initFFmpeg();
        }
        
        // 写入输入文件
        const inputFileName = 'input.webm';
        const outputFileName = 'output.mp4';
        
        ff.on('progress', ({ progress }) => {
            onProgress?.(Math.round(progress * 100));
        });
        
        // 将Blob写入FFmpeg文件系统
        await ff.writeFile(inputFileName, await fetchFile(webmBlob));
        
        // 执行转换命令
        await ff.exec([
            '-i', inputFileName,
            '-c:v', 'libx264',  // 视频编码器
            '-preset', 'fast',   // 编码速度
            '-crf', '20',       // 视频质量(0-51,越小质量越好)
            '-c:a', 'aac',      // 音频编码器
            '-strict', 'experimental',
            outputFileName
        ]);
        
        // 读取输出文件
        const data = await ff.readFile(outputFileName);
        
        // 创建MP4 Blob
        return new Blob([data], { type: 'video/mp4' });
        
    } catch (error) {
        console.error('视频转换失败:', error);
        throw error;
    }
};