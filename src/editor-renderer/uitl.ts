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
		const { time, type, use } = evenFrames[i]
		const sec = Math.floor((time - startTime) / 1000)
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
						item.end = sec0
						item.children.push(evenFrames[j])
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

