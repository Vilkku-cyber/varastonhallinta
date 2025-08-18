// SimpleQRScanner.jsx
import React, { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export default function SimpleQRScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);

  // Käynnistä kamera heti kun komponentti tulee näkyviin
  useEffect(() => {
    let stream;
    const start = async () => {
      try {
        setIsScanning(true);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanLoop();
        }
      } catch (err) {
        console.error("Kameran avaus epäonnistui:", err);
        setIsScanning(false);
        onClose?.();
      }
    };
    start();

    // Sulje kamera kun komponentti suljetaan
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanLoop = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(frame.data, frame.width, frame.height);
        if (code && code.data) {
          // Sulje kamera ja ilmoita löydetty data
          try {
            video.srcObject?.getTracks().forEach(t => t.stop());
          } catch {}
          setIsScanning(false);
          onDetected(code.data);
          return;
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12
      }}
      onClick={onClose} // klikkaus taustaan sulkee
    >
      <div
        onClick={(e) => e.stopPropagation()} // estä sulkeminen, kun klikataan videota
        style={{ background: "white", borderRadius: 8, padding: 10, width: "100%", maxWidth: 520 }}
      >
        <video ref={videoRef} style={{ width: "100%", borderRadius: 6 }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <button style={{ width: "100%", marginTop: 8 }} onClick={onClose}>
          Sulje
        </button>
      </div>
    </div>
  );
}
