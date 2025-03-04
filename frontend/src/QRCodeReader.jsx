import React, { useRef, useState } from 'react';
import { database, ref, get } from './firebaseConfig';
import jsQR from 'jsqr';

function QRCodeReader() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [productInfo, setProductInfo] = useState(null);

  const startScan = () => {
    setIsScanning(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanQRCode();
      })
      .catch((err) => {
        console.error("Error accessing the camera:", err);
        setIsScanning(false);
      });
  };

  const scanQRCode = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');

    const checkQRCode = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          fetchProductDetails(code.data);
          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
          setIsScanning(false);
          return;
        }
      }
      requestAnimationFrame(checkQRCode);
    };

    checkQRCode();
  };

  const fetchProductDetails = async (serial) => {
    const inventoryRef = ref(database, 'inventory');
    get(inventoryRef).then((snapshot) => {
      if (snapshot.exists()) {
        const products = snapshot.val();
        Object.keys(products).forEach((key) => {
          const product = products[key];
          const units = product.units || {};
          if (units[serial]) {
            setProductInfo({
              ...product,
              unitDetails: units[serial], // Sisältää vauriotiedot ja muut yksikkötiedot
              serialNumber: serial
            });
          }
        });
      } else {
        alert('Tietokanta on tyhjä.');
      }
    }).catch(error => {
      console.error('Virhe tietojen haussa:', error);
      alert('Virhe tietojen haussa.');
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <button onClick={startScan} disabled={isScanning}>Aloita skannaus</button>
      <video ref={videoRef} style={{ width: '100%', display: isScanning ? 'block' : 'none' }}></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      {productInfo && (
        <div style={{ padding: '20px', backgroundColor: 'white' }}> {/* Add white background */}
          <h3>Tuotetiedot</h3>
          <p>Nimi: {productInfo.name}</p>
          <p>Kategoria: {productInfo.category}</p>
          <p>Varastossa: {productInfo.available}</p>
          <p>Paino: {productInfo.weight}</p>
          <p>Mitat: {productInfo.dimensions}</p>
          <p>Lisätiedot: {productInfo.details}</p>
          <h4>Yksikön tiedot</h4>
          <p>Sarjanumero: {productInfo.serialNumber}</p>
          <p>Vauriot: {productInfo.unitDetails.damage}</p>
        </div>
      )}
    </div>
  );
}

export default QRCodeReader;
