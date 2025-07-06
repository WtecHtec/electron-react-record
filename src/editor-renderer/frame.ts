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

	const cutFrames = []
	let i = 0
	while (i < evenFrames.length - 1) {
		const { time, type, use, } = evenFrames[i]
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
						evenFrames[j].start = sec0
						evenFrames[j].t = sec0 - item.end
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

/**
 * 转换格式
 * @param zoomData 
 * @returns 
 */
export const getEffectFramesByZooms = (zoomData: any, duration: number, uscale: number, cscale: number) => {
    return zoomData.map((item: any) => {
        const { left, width, x, y, scale } = item
        return {
            scale,
            x: (x / uscale) * cscale, 
            y: (y / uscale) * cscale, 
            type: 'mousedown', 
            start: left / 100 * duration, 
            end: (left + width ) / 100 * duration, 
            t: width / 100 * duration,
        }
    })
}


export const formatZoomDatas = (events, duration: number, uscale: number, cscale: number, minWidth: number) => {
	console.log('events---', events, duration, uscale, cscale)
	const result = []
	let lastTime = -1
	if (events.length ) {
		const startItem= events[0]
		if (startItem.type !== 'start') {
			return result;
		}
		for (let i = 1; i < events.length - 1; i++) {
			const item = events[i]
			if (item.type !== 'mousedown') continue
			const { position } = item;
			const zoomItem : any = {
				...item,
			}
			const start = (item.time - startItem.time ) / 1000
			zoomItem.x = position.x * uscale
			zoomItem.y = position.y * uscale
			zoomItem.width = minWidth
			zoomItem.left = (item.time - startItem.time) / 1000 / duration * 100
			if ( start > lastTime && (start   + 2 < duration)) {
				result.push(zoomItem)
				lastTime = start + 2
			}
		}
 	}
	return result;
}