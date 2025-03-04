import React, { useRef, useState } from 'react';
import { database, ref, get } from './firebaseConfig';
import jsQR from 'jsqr';

function QRCodeReader() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [qrCodeText, setQrCodeText] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [productInfo, setProductInfo] = useState(null);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        scanQRCode();
      })
      .catch((err) => {
        console.error("Error accessing the camera:", err);
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
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code) {
          setQrCodeText(code.data);
          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
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
        let found = false;
        // Käy läpi kaikki tuotteet
        Object.keys(products).forEach((key) => {
          const product = products[key];
          const units = product.units || {};
          // Tarkista, löytyykö annettu sarjanumero units-alikansiosta
          if (units[serial]) {
            found = true;
            setProductInfo({
              ...product,
              unitDetails: units[serial], // Sisältää vauriotiedot ja mahdolliset muut yksikkötiedot
              serialNumber: serial
            });
          }
        });
        if (!found) {
          setProductInfo(null);
          alert('Tuotetta ei löydy annetulla sarjanumerolla.');
        }
      } else {
        setProductInfo(null);
        alert('Tietokanta on tyhjä.');
      }
    }).catch(error => {
      console.error('Virhe tietojen haussa:', error);
      alert('Virhe tietojen haussa.');
    });
  };

  const handleSearch = () => {
    fetchProductDetails(serialNumber);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Scan QR Code or Enter Serial Number</h1>
      <button onClick={startVideo}>Start Scanning</button>
      <video ref={videoRef} style={{ display: 'none' }}></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      {qrCodeText && <div>QR Code Content: {qrCodeText}</div>}
      <input type="text" placeholder="Syötä sarjanumero" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} />
      <button onClick={handleSearch}>Hae tuotetiedot</button>
      {productInfo && (
        <div style={{ padding: '20px' }}>
          <h3>Tuotetiedot</h3>
          <p>Nimi: {productInfo.name}</p>
          <p>Kategoria: {productInfo.category}</p>
          <p>Varastossa: {productInfo.available}</p>
          <p>Paino: {productInfo.weight}</p>
          <p>Mitat: {productInfo.dimensions}</p>
          <p>Lisätiedot: {productInfo.details}</p>
          <h4>Yksikön tiedot</h4>
          <p>Sarjanumero: {serialNumber}</p>
          <p>Vauriot: {productInfo.unitDetails.damage}</p>
        </div>
      )}
    </div>
  );
}

export default QRCodeReader;
