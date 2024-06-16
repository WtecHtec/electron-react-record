export function formatSecondsToHMS(seconds: number) {
	if (!seconds) return '00:00:00';
  let hours: string | number = Math.floor(seconds / 3600);
  let minutes: string | number = Math.floor((seconds % 3600) / 60);
  let secs: string | number = Math.floor(seconds % 60);

  hours = hours < 10 ? `0${hours}` : hours;
  minutes = minutes < 10 ? `0${minutes}` : minutes;
  secs = secs < 10 ? `0${secs}` : secs;
  return `${hours}:${minutes}:${secs}`;
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
  const totalSeconds =
    hours * 3600 + minutes * 60 + seconds + milliseconds / 100;
  return totalSeconds;
}
