import { useEffect, useRef, useState } from 'react';
import { formatSecondsToHMS } from '../renderer/uitl';
import './recordapp.css';

interface RecordInfo {
  mediaStream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
  startTime: number;
  status: boolean;
}
function RecordApp() {
  const recordRef = useRef<RecordInfo>({
    mediaStream: null,
    mediaRecorder: null,
    recordedChunks: [],
    startTime: 0,
    status: true,
  });
  const [duration, setDuration] = useState('00:00:00');

  useEffect(() => {
    const updateDuration = () => {
      if (!recordRef.current.status) return;
      setDuration(
        formatSecondsToHMS(
          (new Date().getTime() - recordRef.current.startTime) / 1000,
        ),
      );
      requestAnimationFrame(updateDuration);
    };
    const handle = async (_: unknown, sourceId: unknown) => {
      try {
				console.log(sourceId);
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
            },
          },
        });

        const options = { mimeType: 'video/webm; codecs=vp9' };
        const mediaRecorder = new MediaRecorder(mediaStream, options);

        mediaRecorder.onstart = () => {
          recordRef.current.recordedChunks = [];
          recordRef.current.status = true;
					window.electron.ipcRenderer.sendMessage('record_mouse_render');
          updateDuration();
        };
        // eslint-disable-next-line func-names
        mediaRecorder.ondataavailable = function (event) {
          if (event.data.size > 0) {
            recordRef.current.recordedChunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(recordRef.current.recordedChunks, {
            type: 'video/webm',
          });
          const url = URL.createObjectURL(blob);
          // downloadVideo(url);
          recordRef.current.recordedChunks = [];
          recordRef.current.status = false;
          window.electron.ipcRenderer.sendMessage('stop_record_render', url);
        };
        mediaRecorder.onerror = (event) => {
          // eslint-disable-next-line no-console
          console.error('MediaRecorder error:', event);
        };
        mediaRecorder.start();
        recordRef.current = {
          ...recordRef.current,
          mediaStream,
          mediaRecorder,
          startTime: new Date().getTime(),
        };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };

    window.electron.ipcRenderer.on('start_record_main', handle);
    // eslint-disable-next-line no-use-before-define
    window.electron.ipcRenderer.on('end_record_main', stopRecord);
    return () => {
      window.electron.ipcRenderer.off('start_record_main', handle);
      // eslint-disable-next-line no-use-before-define
      window.electron.ipcRenderer.off('end_record_main', stopRecord);
    };
  }, []);

  const stopRecord = () => {
    recordRef.current.mediaRecorder?.stop();
  };
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="record-container" onClick={stopRecord}>
      <div className="record-space" />
      <div className="record-duration">{duration}</div>
    </div>
  );
}

export default RecordApp;
