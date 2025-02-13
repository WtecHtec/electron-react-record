import { useEffect, useState } from 'react';
import './downmask.css';

function DownMask() {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      window.electron.ipcRenderer.sendMessage('count_down_end_render', []);
      return;
    }
    const interval = setInterval(() => {
      setCount(count - 1);
    }, 1000);
    // eslint-disable-next-line consistent-return
    return () => {
      // eslint-disable-next-line no-unused-expressions
      interval && clearInterval(interval);
    };
  }, [count]);
  return <div className="countdown">{count}</div>;
}

export default DownMask;
