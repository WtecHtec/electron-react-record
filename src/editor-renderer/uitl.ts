/* eslint-disable @typescript-eslint/no-explicit-any */

const KEY_DOWN_MIN_SEC = 2 // 键盘事件2s内合并
const MOUSE_DOWN_MAX_SEC = 4 // 鼠标点击事件4s内合并
const EFFECT_TIME = 2 // 效果时长
/**
 * 最后一个点击事件舍弃【结束点击】
 * 计算缩放帧时间
 * 返回数组: [ { x, y, type, start, end, t }]
 * start、end表示视频的播放时长的时间
 */
export const getEffectFrames = (recordTimeInfo: any, evenFrames: any) => {
	// 总时长
	const { startTime }  = recordTimeInfo
	// const durtion = Math.floor((endTime - startTime) / 1000)

	const cutFrames = []
	let i = 0
	while (i < evenFrames.length - 1) {
		const { time, type, use, x, y } = evenFrames[i]
		const sec = Math.floor((time - startTime) / 1000)
		let lastx = x
		let lasty = y
		if (type === 'mousedown' && !use) {
			const item = {
				...evenFrames[i],
				start: sec,
				end: sec,
				children: [],
			}
			evenFrames[i].use = true
			for (let j = i; j < evenFrames.length - 1; j++) {
				const { time: time1, type: type1, use: use1 } = evenFrames[j];
				const sec0 = Math.floor((time1 - startTime) / 1000)
				if (type1 === 'keydown' && sec0 - item.end <= KEY_DOWN_MIN_SEC) {
					item.end = sec0
					continue
				}
				if (type1 === 'mousedown' && !use1) {
					if (sec0 - item.end > MOUSE_DOWN_MAX_SEC) {
						i = j - 1
						break
					} else {
						evenFrames[j].use = true
						evenFrames[j].start = sec0
						evenFrames[j].t = sec0 - item.end
						item.end = sec0
						item.children.push(evenFrames[j])
						// const { x: x1, y: y1} = evenFrames[j]
						// const modx = Math.abs(x1 - lastx)
						// const mody = Math.abs(y1 - lasty)
						// if (modx >= 200 || mody >= 200) {
						// 	item.children.push(evenFrames[j])
						// 	lastx = x1
						// 	lasty = y1
						// } else if (item.children.length 
						// 	&& (modx < 200 || mody < 200)) {
						// 	item.children[item.children.length - 1] = (evenFrames[j])
						// 	lastx = x1
						// 	lasty = y1
						// }
					}
				}
			}
			item.end = item.end + EFFECT_TIME
			item.t = item.end - item.start
			cutFrames.push(item)
		}
		i = i + 1
	}
	return cutFrames;
}





export function formatSecondsToHMS(seconds: number) {  
	let hours: number | string = Math.round(seconds / 3600);  
	let minutes: number | string = Math.round((seconds % 3600) / 60);  
	let secs: number | string =  Math.round(seconds % 60);  

	hours = hours < 10 ? "0" + hours : hours;  
	minutes = minutes < 10 ? "0" + minutes : minutes;  
	secs = secs < 10 ? "0" + secs : secs;  

	return hours + ":" + minutes + ":" + secs;  
}  


export function convertToSeconds(timeString: string) {  
	// 使用正则表达式匹配小时、分钟、秒和毫秒  
	const match = timeString.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{2})$/);  
	if (!match) {  
			throw new Error('Invalid time format. Expected HH:MM:SS.mm');  
	}  

	// 提取小时、分钟、秒和毫秒  
	const hours = parseInt(match[1], 10);  
	const minutes = parseInt(match[2], 10);  
	const seconds = parseInt(match[3], 10);  
	const milliseconds = parseInt(match[4], 10);  

	// 将时间单位转换为秒并相加  
	const totalSeconds = (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 100);  
	return totalSeconds;  
} 


export const toBase64 = (blob) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(blob);
		reader.onloadend = () => {
			resolve(reader.result);
		};
		reader.onerror = reject;
	});
};