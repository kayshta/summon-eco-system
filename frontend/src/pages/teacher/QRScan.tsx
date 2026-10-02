import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../../services/api';
import { toast } from 'react-toastify';
import './QRScan.css';

export default function TeacherQRScan() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const startScan = async () => {
    try {
      // Stop any existing scanner first
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (e) {
          // Ignore stop errors
        }
        scannerRef.current = null;
      }

      // Set scanning to true first so the div element gets rendered
      setScanning(true);

      // Wait for React to render the div element
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if element exists
      const readerElement = document.getElementById('reader');
      if (!readerElement) {
        throw new Error('QR code reader element not found in DOM');
      }

      const scanner = new Html5Qrcode('reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleQRCode(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      );
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error';
      console.error('Camera error:', error);
      toast.error('Failed to start camera: ' + errorMessage);
      setScanning(false);
      if (scannerRef.current) {
        scannerRef.current = null;
      }
    }
  };

  const stopScan = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        setScanning(false);
      }
    }
  };

  const handleQRCode = async (qrData: string) => {
    try {
      // Parse QR data (should be JSON with class_id and nonce)
      let parsedData;
      try {
        parsedData = JSON.parse(qrData);
      } catch (e) {
        toast.error('Invalid QR code format');
        return;
      }

      // Send to backend
      const response = await api.post('/qr-scan/scan', {
        qr_data: parsedData
      });

      setResult(response.data);
      toast.success('QR code scanned successfully!');
      stopScan();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process QR code');
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {
          // Ignore cleanup errors
        });
        scannerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="container">
      <h1>Scan Class QR Code</h1>
      <div className="card">
        <p style={{ marginBottom: '24px', color: '#666' }}>
          Point your camera at the QR code displayed in the classroom to sign in.
        </p>

        {!scanning ? (
          <button className="btn btn-primary" onClick={startScan}>
            Start Scanning
          </button>
        ) : (
          <>
            <div id="reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}></div>
            <button className="btn btn-secondary" onClick={stopScan} style={{ marginTop: '16px' }}>
              Stop Scanning
            </button>
          </>
        )}

        {result && (
          <div className="success" style={{ marginTop: '24px' }}>
            <h3>Scan Successful!</h3>
            <p><strong>Class:</strong> {result.class.class_name}</p>
            <p><strong>Teacher:</strong> {result.teacher.name}</p>
            <p><strong>Time:</strong> {new Date().toLocaleString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

