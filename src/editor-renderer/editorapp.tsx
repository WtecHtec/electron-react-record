import { useEffect, useRef } from 'react';

function EditorApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const handle = async (_: unknown, url: unknown) => {
      videoRef.current!.src = url as string;
      videoRef.current!.addEventListener('loadedmetadata', () => {
        videoRef.current!.play();
      });
    };
    window.electron.ipcRenderer.on('record_url_main', handle);
    return () => {
      window.electron.ipcRenderer.off('record_url_main', handle);
    };
  }, []);
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <video controls ref={videoRef} style={{ width: '100vw' }} />;
}

export default EditorApp;
