import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Dialog } from './shared';
export function Scanner({ scan, close }: { scan: (serial: string) => void; close: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    let stream: MediaStream | undefined;
    let raf = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (media) => {
        if (!alive) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = media;
        video.current!.srcObject = media;
        await video.current!.play();
        const tick = () => {
          if (!alive) return;
          const v = video.current!;
          if (v.readyState >= 2) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(frame.data, frame.width, frame.height);
            if (code) {
              scan(code.data.trim());
              close();
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((e) => setError(`Kamera ei avautunut: ${e.message}`));
    if (!navigator.mediaDevices) setError('Kamera vaatii HTTPS-yhteyden tai localhostin.');
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  return (
    <Dialog title="Lue QR-koodi" close={close}>
      <video ref={video} playsInline muted className="camera" />
      {error && <p className="error">{error}</p>}
      <p className="hint">
        Osoita laitteen sarjanumerokoodiin. Voit syöttää sarjanumeron myös käsin.
      </p>
    </Dialog>
  );
}
