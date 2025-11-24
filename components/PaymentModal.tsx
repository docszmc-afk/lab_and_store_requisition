import React, { useState } from 'react';
import { Requisition, User, Attachment } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (amount: number, date: string, reference: string, attachment?: Attachment) => void;
  requisition: Requisition;
  user: User;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSubmit, requisition, user }) => {
  const outstandingBalance = requisition.totalEstimatedCost - requisition.amountPaid;
  
  const [amount, setAmount] = useState<number>(outstandingBalance);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
              setAttachment({
                  name: file.name,
                  type: file.type,
                  data: ev.target?.result as string
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSubmit = () => {
      if (amount <= 0) {
          alert('Please enter a valid amount.');
          return;
      }
      if (amount > outstandingBalance) {
          alert(`Amount cannot exceed the outstanding balance of ₦${outstandingBalance.toLocaleString()}`);
          return;
      }
      onSubmit(amount, date, reference, attachment);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-zankli-black p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Record Payment</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
          </div>

          <div className="p-6 space-y-4 bg-zankli-cream">
              
              <div className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Outstanding Balance</span>
                  <span className="text-lg font-bold text-red-600">₦{outstandingBalance.toLocaleString()}</span>
              </div>

              <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Payment Amount (₦)</label>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange outline-none font-mono text-lg"
                  />
              </div>

              <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Payment Date</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange outline-none"
                  />
              </div>

              <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Reference / Method</label>
                  <input 
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. Bank Transfer - GTB 12345"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange outline-none"
                  />
              </div>

              <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Receipt (Optional)</label>
                  <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 relative">
                      <input type="file" accept=".pdf,.png,.jpg,.xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      {attachment ? (
                          <span className="text-sm text-blue-600 font-medium">{attachment.name}</span>
                      ) : (
                          <span className="text-xs text-gray-400">Click to upload PDF/Excel Receipt</span>
                      )}
                  </div>
              </div>

              <button 
                onClick={handleSubmit}
                className="w-full bg-zankli-orange text-white py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-colors mt-4"
              >
                  Confirm Payment
              </button>
          </div>
      </div>
    </div>
  );
};