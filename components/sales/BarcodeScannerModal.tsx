'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, X, AlertCircle, Check, Search, PlusCircle, Link as LinkIcon } from 'lucide-react';
import type { Product } from '../../types';
import { findProductByBarcodeOrSku, updateProduct } from '../../lib/storage';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductScanned: (product: Product) => void;
  onAddNewProductWithBarcode?: (barcode: string) => void;
  onRefresh?: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductScanned,
  onAddNewProductWithBarcode,
  onRefresh,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [assigningProductId, setAssigningProductId] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleClose = () => {
    stopCamera();
    setUnknownBarcode(null);
    setStatusMessage(null);
    setCameraError(null);
    onClose();
  };

  // Play audio beep on barcode detection
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio autoplay may be restricted
    }
  }, []);

  const handleBarcodeDetected = useCallback(
    (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      const now = Date.now();
      // 2-second debounce for identical barcode
      if (lastScannedCode === cleanCode && now - lastScanTimeRef.current < 2000) {
        return;
      }

      lastScanTimeRef.current = now;
      setLastScannedCode(cleanCode);
      playBeep();

      const matched = findProductByBarcodeOrSku(cleanCode, products);
      if (matched) {
        setStatusMessage(`स्कैन सफल: ${matched.name}`);
        onProductScanned(matched);
      } else {
        setUnknownBarcode(cleanCode);
      }
    },
    [lastScannedCode, playBeep, products, onProductScanned]
  );

  // Initialize camera and BarcodeDetector
  useEffect(() => {
    isMountedRef.current = true;
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isSubscribed = true;

    async function initScanner() {
      setCameraError(null);

      // Check BarcodeDetector API support
      const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
      if (!hasBarcodeDetector) {
        setCameraError(
          'इस ब्राउज़र में BarcodeDetector API समर्थित नहीं है। कृपया बारकोड नंबर नीचे टाइप करें या USB स्कैनर का प्रयोग करें।'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (!isSubscribed || !isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Initialize Detector
        const BarcodeDetectorClass = (window as unknown as { BarcodeDetector: new (opts?: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
        const detector = new BarcodeDetectorClass({
          formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
        });

        // Frame scanning loop
        const scanFrame = async () => {
          if (!isSubscribed || !isMountedRef.current || !videoRef.current) return;

          if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleBarcodeDetected(barcodes[0].rawValue);
              }
            } catch {
              // Frame decoding error, continue loop
            }
          }
          scanLoopRef.current = requestAnimationFrame(scanFrame);
        };

        scanLoopRef.current = requestAnimationFrame(scanFrame);
      } catch {
        if (isSubscribed) {
          setCameraError(
            'कैमरा शुरू नहीं हो सका। कैमरा परमिशन चेक करें या नीचे बारकोड/SKU मैन्युअल रूप से टाइप करें।'
          );
        }
      }
    }

    initScanner();

    return () => {
      isSubscribed = false;
      isMountedRef.current = false;
      stopCamera();
    };
  }, [isOpen, stopCamera, handleBarcodeDetected]);

  // Handle manual input search / add
  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    handleBarcodeDetected(code);
    setManualCode('');
  };

  // Assign unknown barcode to an existing product
  const handleAssignToExistingProduct = () => {
    if (!unknownBarcode || !assigningProductId) return;
    const res = updateProduct(assigningProductId, { barcode: unknownBarcode });
    if (res.success && res.product) {
      setStatusMessage(`बारकोड '${unknownBarcode}' सफलतापूर्वक '${res.product.name}' से लिंक हो गया!`);
      onProductScanned(res.product);
      setUnknownBarcode(null);
      setAssigningProductId('');
      if (onRefresh) onRefresh();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-lg">बारकोड / SKU स्कैनर</h3>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scanner Viewport */}
        <div className="relative flex flex-col items-center bg-slate-900 p-4 text-white">
          {cameraError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-amber-200">
              <AlertCircle className="mb-2 h-10 w-10 text-amber-400" />
              <p className="text-sm">{cameraError}</p>
            </div>
          ) : (
            <div className="relative h-64 w-full overflow-hidden rounded-xl border-2 border-emerald-500/50 bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="h-full w-full object-cover"
              />
              {/* Scan target viewfinder */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-40 w-64 rounded-lg border-2 border-dashed border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-emerald-400" />
                  <div className="h-0.5 w-full bg-red-500/80 animate-pulse mt-20" />
                </div>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="mt-3 flex items-center space-x-2 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300">
              <Check className="h-4 w-4" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Unknown Barcode Resolution Dialog */}
        {unknownBarcode && (
          <div className="border-b border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 text-sm">
                  अपरिचित बारकोड: <span className="font-mono bg-amber-200 px-1.5 py-0.5 rounded">{unknownBarcode}</span>
                </h4>
                <p className="mt-1 text-xs text-amber-800">
                  यह बारकोड इन्वेंटरी के किसी भी सामान से लिंक नहीं है। आप इसे मौजूदा सामान से जोड़ सकते हैं या नया सामान बना सकते हैं:
                </p>

                {/* Option 1: Assign to existing */}
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <select
                    value={assigningProductId}
                    onChange={(e) => setAssigningProductId(e.target.value)}
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">मौजूदा सामान चुनें...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignToExistingProduct}
                    disabled={!assigningProductId}
                    className="flex items-center justify-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    <span>लिंक करें</span>
                  </button>
                </div>

                {/* Option 2: Create new product */}
                {onAddNewProductWithBarcode && (
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => {
                        onAddNewProductWithBarcode(unknownBarcode);
                        onClose();
                      }}
                      className="flex items-center space-x-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span>इस बारकोड से नया सामान बनाएं</span>
                    </button>
                    <button
                      onClick={() => setUnknownBarcode(null)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      छोड़ें
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manual Barcode / SKU input */}
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="बारकोड या SKU टाइप करें / USB स्कैनर..."
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="flex items-center space-x-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              <Search className="h-4 w-4" />
              <span>खोजें</span>
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-slate-500">
            हैंडहेल्ड बारकोड गन या कैमरा दोनों समर्थित हैं।
          </p>
        </div>
      </div>
    </div>
  );
};
