import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signatureData: string) => void;
  user: User;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onConfirm, user }) => {
  const [mode, setMode] = useState<'draw' | 'password'>('draw');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
        setMode('draw');
        setPassword('');
        setError('');
        clearCanvas();
    }
  }, [isOpen]);

  // Setup Canvas drawing logic
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
  };

  const clearCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
  };

  const handleConfirmDraw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
          // Check if empty (simple check)
          const blank = document.createElement('canvas');
          blank.width = canvas.width;
          blank.height = canvas.height;
          if (canvas.toDataURL() === blank.toDataURL()) {
              setError('Please draw your signature');
              return;
          }
          onConfirm(canvas.toDataURL());
          onClose();
      }
  };

  const handleConfirmPassword = async () => {
      setIsProcessing(true);
      setError('');
      try {
          const isValid = await authService.verifyPassword(user.email, password);
          if (isValid) {
              // Generate a signature image from text
              const canvas = document.createElement('canvas');
              canvas.width = 300;
              canvas.height = 100;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.fillStyle = '#fff';
                  ctx.fillRect(0, 0, 300, 100);
                  
                  ctx.fillStyle = '#000';
                  ctx.font = 'italic bold 24px serif';
                  ctx.textAlign = 'center';
                  ctx.fillText(user.name, 150, 40);
                  
                  ctx.font = '12px sans-serif';
                  ctx.fillStyle = '#666';
                  ctx.fillText(`Digitally Signed: ${new Date().toLocaleDateString()}`, 150, 70);
                  
                  // Draw a box
                  ctx.strokeStyle = '#CC5500';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(5, 5, 290, 90);

                  onConfirm(canvas.toDataURL());
                  onClose();
              }
          } else {
              setError('Incorrect password');
          }
      } catch (e) {
          setError('Verification failed');
      } finally {
          setIsProcessing(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-zankli-black p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Digital Signature</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
          </div>

          <div className="p-6 bg-zankli-cream">
              <div className="flex justify-center space-x-4 mb-6">
                  <button 
                    onClick={() => setMode('draw')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${mode === 'draw' ? 'bg-zankli-orange text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-200'}`}
                  >
                      Draw Signature
                  </button>
                  <button 
                    onClick={() => setMode('password')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${mode === 'password' ? 'bg-zankli-orange text-white shadow-lg' : 'bg-white text-gray-500 border border-gray-200'}`}
                  >
                      Sign with Password
                  </button>
              </div>

              {mode === 'draw' ? (
                  <div className="flex flex-col items-center space-y-4">
                      <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden cursor-crosshair touch-none">
                          <canvas 
                            ref={canvasRef}
                            width={340}
                            height={160}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-full"
                          />
                      </div>
                      <div className="flex justify-between w-full text-sm">
                           <button onClick={clearCanvas} className="text-gray-500 hover:text-red-500">Clear Pad</button>
                           {error && <span className="text-red-500 text-xs">{error}</span>}
                      </div>
                      <button 
                        onClick={handleConfirmDraw}
                        className="w-full bg-zankli-black text-white py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-colors"
                      >
                          Confirm Signature
                      </button>
                  </div>
              ) : (
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Account Password</label>
                          <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange outline-none"
                            placeholder="Enter your password"
                          />
                      </div>
                      {error && <div className="text-red-500 text-sm text-center">{error}</div>}
                      <button 
                        onClick={handleConfirmPassword}
                        disabled={isProcessing || !password}
                        className="w-full bg-zankli-black text-white py-3 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                      >
                          {isProcessing ? 'Verifying...' : 'Sign & Confirm'}
                      </button>
                  </div>
              )}
              
              <p className="text-center text-[10px] text-gray-400 mt-4">
                  By signing, you confirm the accuracy and approval of this document.
              </p>
          </div>
      </div>
    </div>
  );
};