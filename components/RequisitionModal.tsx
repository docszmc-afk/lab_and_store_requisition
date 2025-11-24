import React, { useState, useEffect } from 'react';
import { Department, Priority, RequisitionItem, RequisitionType, User, Requisition, Attachment } from '../types';
import { ICONS, LAB_REQUEST_TYPES, PHARMACY_REQUEST_TYPES } from '../constants';
import { analyzeRequisition } from '../services/geminiService';
import { SignatureModal } from './SignatureModal';
import { numberToWords } from '../utils/numberToWords';

interface RequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  user: User;
  existingRequisition?: Requisition | null; // For Edit/Resubmit
}

export const RequisitionModal: React.FC<RequisitionModalProps> = ({ isOpen, onClose, onSubmit, user, existingRequisition }) => {
  const [department, setDepartment] = useState<Department>(user.department || Department.EMERGENCY);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [requestType, setRequestType] = useState<RequisitionType | ''>('');
  const [items, setItems] = useState<Partial<RequisitionItem>[]>([{ id: Date.now().toString(), name: '', quantity: 1, estimatedCost: 0, stockLevel: 0, unitCost: 0, supplier: '', unit: 'Unit', category: 'General' }]);
  const [justification, setJustification] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  
  // Emergency Request Specific
  const [beneficiary, setBeneficiary] = useState('');
  const [emergencyAmount, setEmergencyAmount] = useState<number>(0);
  const [title, setTitle] = useState(''); // For Emergency Request (1 week)

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  // Signature State
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);

  // Determine available request types based on user
  const availableTypes: RequisitionType[] = 
    user.email === 'labzankli@gmail.com' ? LAB_REQUEST_TYPES :
    user.email === 'storezankli@gmail.com' ? PHARMACY_REQUEST_TYPES :
    [];

  useEffect(() => {
    if (isOpen) {
      if (existingRequisition) {
        // Populate form for editing
        setDepartment(existingRequisition.department);
        setPriority(existingRequisition.priority);
        setRequestType(existingRequisition.type);
        setItems(existingRequisition.items);
        setJustification(existingRequisition.justification || '');
        setAttachedFiles(existingRequisition.attachments || []);
        setBeneficiary(existingRequisition.beneficiary || '');
        setEmergencyAmount(existingRequisition.totalEstimatedCost || 0);
        setTitle(existingRequisition.title || '');
        if (existingRequisition.aiAnalysis) setAiSuggestion(existingRequisition.aiAnalysis);
      } else {
        // Reset for new
        if (availableTypes.length > 0) setRequestType(availableTypes[0]);
        if (user.department) setDepartment(user.department);
        setPriority(Priority.MEDIUM);
        setItems([{ id: Date.now().toString(), name: '', quantity: 1, estimatedCost: 0, stockLevel: 0, unitCost: 0, supplier: '', unit: 'Unit', category: 'General' }]);
        setJustification('');
        setAttachedFiles([]);
        setBeneficiary('');
        setEmergencyAmount(0);
        setTitle('');
        setAiSuggestion(null);
      }
    }
  }, [isOpen, user, existingRequisition]);

  if (!isOpen) return null;

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), name: '', quantity: 1, estimatedCost: 0, stockLevel: 0, unitCost: 0, supplier: '', unit: 'Unit', category: 'General' }]);
  };

  const updateItem = (id: string, field: keyof RequisitionItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
        setItems(items.filter(item => item.id !== id));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files);
          const processedFiles: Attachment[] = await Promise.all(files.map((file: File) => {
              return new Promise<Attachment>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                      resolve({
                          name: file.name,
                          type: file.type,
                          data: ev.target?.result as string
                      });
                  };
                  reader.readAsDataURL(file);
              });
          }));
          setAttachedFiles([...attachedFiles, ...processedFiles]);
      }
  };

  const removeFile = (fileName: string) => {
      setAttachedFiles(attachedFiles.filter(f => f.name !== fileName));
  };

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    let promptContent = '';
    if (requestType === 'Emergency Request (1 month)' || requestType === 'Emergency Request (1 week)') {
        promptContent = `Emergency Request: ${title} - Amount: ${emergencyAmount} - Reason: ${justification}`;
    } else {
        promptContent = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
    }
    
    const result = await analyzeRequisition(promptContent, department);
    setAiSuggestion(result);
    setIsAnalyzing(false);
  };

  const handleInitiateSubmit = () => {
      setIsSignatureOpen(true);
  };

  const handleSignatureConfirmed = (signatureData: string) => {
    // Calculate total cost based on type
    let totalCost = 0;
    if (isPharmacyPO) {
        totalCost = items.reduce((sum, item) => sum + ((item.unitCost || 0) * (item.quantity || 0)), 0);
    } else if (isEmergencyRequest || isEmergencyRequestWeek) {
        totalCost = emergencyAmount || 0;
    } else {
        totalCost = items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
    }

    // For Emergency Requests, we create a dummy item to store the cost structurally
    const finalItems = (isEmergencyRequest || isEmergencyRequestWeek)
        ? [{ id: '1', name: title || 'Emergency Payment', quantity: 1, unit: 'Lot', estimatedCost: emergencyAmount || 0, category: 'Emergency', supplier: beneficiary }]
        : items;

    onSubmit({
      id: existingRequisition?.id, // Pass ID if editing
      type: requestType,
      department,
      priority,
      items: finalItems as RequisitionItem[],
      totalEstimatedCost: totalCost,
      justification: justification,
      beneficiary: beneficiary,
      title: title,
      amountInWords: (isEmergencyRequest || isEmergencyRequestWeek) ? numberToWords(emergencyAmount || 0) : undefined,
      attachments: attachedFiles,
      aiAnalysis: aiSuggestion,
      signature: signatureData // Pass signature
    });
    // Reset
    setAiSuggestion(null);
  };

  // Request Type Specific Logic
  const isLabPO = requestType === 'Lab Purchase Order';
  const isEquipmentRequest = requestType === 'Equipment Request';
  const isHistology = requestType === 'Outsourced Histology Payment';
  const isPharmacyPO = requestType === 'Pharmacy Purchase Order';
  const isEmergencyRequest = requestType === 'Emergency Request (1 month)';
  const isEmergencyRequestWeek = requestType === 'Emergency Request (1 week)';
  
  const showCost = (!isLabPO && !isPharmacyPO) || isHistology; 
  const showStockLevel = isLabPO || isPharmacyPO;

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-zankli-black p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">
                {existingRequisition ? 'Edit Requisition' : 'New Requisition'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
                {existingRequisition ? `Resubmitting ${existingRequisition.id}` : 'Create a new procurement request'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar bg-zankli-cream flex-1">
          
          {/* Request Type */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Request Type</label>
            <select 
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequisitionType)}
              disabled={!!existingRequisition} // Cannot change type when editing existing
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium focus:ring-2 focus:ring-zankli-orange focus:border-transparent outline-none transition-all shadow-sm"
            >
              {availableTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          {/* Department & Priority */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Department</label>
              <select 
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                disabled={!!user.department} 
                className={`w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-zankli-orange focus:border-transparent outline-none transition-all ${user.department ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              >
                {Object.values(Department).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Priority Level</label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-zankli-orange focus:border-transparent outline-none transition-all"
              >
                {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Emergency Request (1 week) Fields */}
          {isEmergencyRequestWeek && (
            <div className="mb-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm animate-fadeIn">
                <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase border-b pb-2">Cash Request Details</h3>
                
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Request Title (Reason)</label>
                    <input 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. REQUEST FOR CASH FOR THE PURCHASE OF DRUGS"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-bold focus:ring-2 focus:ring-zankli-orange outline-none uppercase"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Sum Needed (₦)</label>
                    <input 
                        type="number"
                        value={emergencyAmount || ''}
                        onChange={(e) => setEmergencyAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-zankli-orange outline-none font-mono text-lg"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Sum In Words (Auto-Generated)</label>
                    <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-600 font-medium italic">
                        {emergencyAmount > 0 ? numberToWords(emergencyAmount) : '...'}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Specific Purpose (for the purchase of...)</label>
                    <input 
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="e.g. CANNULAR"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:ring-2 focus:ring-zankli-orange outline-none uppercase"
                    />
                </div>
            </div>
          )}

          {/* Emergency Request (1 Month) Specific Fields */}
          {isEmergencyRequest && (
            <div className="mb-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm animate-fadeIn">
               <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase border-b pb-2">Payment Details</h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                   <div>
                       <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Pay To (Beneficiary)</label>
                       <input 
                          value={beneficiary}
                          onChange={(e) => setBeneficiary(e.target.value)}
                          placeholder="e.g. Geneith Pharmaceuticals Limited"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-zankli-orange outline-none"
                       />
                   </div>
                   <div>
                       <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Amount (₦)</label>
                       <input 
                          type="number"
                          value={emergencyAmount || ''}
                          onChange={(e) => setEmergencyAmount(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-zankli-orange outline-none font-mono"
                       />
                   </div>
               </div>
               
               <div className="mb-4">
                   <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Amount In Words</label>
                   <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-600 font-medium italic">
                       {emergencyAmount > 0 ? numberToWords(emergencyAmount) : '...'}
                   </div>
               </div>

               <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Being (Purpose / Justification)</label>
                    <textarea 
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="e.g. Payment for drugs supplied..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:ring-2 focus:ring-zankli-orange outline-none h-24 resize-none"
                    />
               </div>
            </div>
          )}

          {/* Justification (Shown for Equipment Request) */}
          {isEquipmentRequest && (
             <div className="mb-6 animate-fadeIn">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Description / Justification (Required)</label>
                <textarea 
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Explain why this equipment is needed..."
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:ring-2 focus:ring-zankli-orange focus:border-transparent outline-none transition-all shadow-sm h-24 resize-none"
                />
             </div>
          )}

          {/* Items List (Hidden for Emergency Requests) */}
          {!isEmergencyRequest && !isEmergencyRequestWeek && (
            <div className="space-y-4 mb-8 animate-fadeIn">
                <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase">
                    {isHistology ? 'Patients / Investigations' : 'Requested Items'}
                </label>
                <button onClick={addItem} className="text-xs flex items-center text-zankli-orange font-medium hover:text-orange-700">
                    {ICONS.Plus} <span className="ml-1">Add Item</span>
                </button>
                </div>
                
                {/* Header Row for Items */}
                <div className="flex gap-3 px-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {isHistology ? (
                        <>
                            <div className="flex-1">Patient Name</div>
                            <div className="w-20">Lab No.</div>
                            <div className="flex-1">Investigation</div>
                            <div className="w-24 text-right">Retainership</div>
                            <div className="w-24 text-right">ZMC Charge</div>
                            <div className="w-24 text-right">Amount</div>
                        </>
                    ) : isPharmacyPO ? (
                        <>
                            <div className="flex-1">Description</div>
                            <div className="w-20 text-center">Stock</div>
                            <div className="w-20 text-center">Qty</div>
                            <div className="w-32">Supplier</div>
                            <div className="w-24 text-right">Unit Cost</div>
                            <div className="w-24 text-right">Total</div>
                        </>
                    ) : (
                        <>
                            <div className="flex-1">Description</div>
                            {showStockLevel && <div className="w-24 text-center">Stock Lvl</div>}
                            <div className="w-20 text-center">Qty</div>
                            {isEquipmentRequest && <div className="w-32">Supplier</div>}
                            {showCost && <div className="w-32 text-right">Est. Cost</div>}
                        </>
                    )}
                    <div className="w-8"></div>
                </div>

                {items.map((item, index) => (
                <div key={item.id} className="flex gap-3 items-start bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    
                    {isHistology ? (
                        // HISTOLOGY INPUTS
                        <>
                            <div className="flex-1">
                                <input 
                                    placeholder="Patient Name" 
                                    value={item.patientName || ''}
                                    onChange={(e) => updateItem(item.id!, 'patientName', e.target.value)}
                                    className="w-full text-sm font-medium border-b border-transparent focus:border-zankli-orange outline-none pb-1"
                                />
                            </div>
                            <div className="w-20">
                                <input 
                                    placeholder="Lab No" 
                                    value={item.labNumber || ''}
                                    onChange={(e) => updateItem(item.id!, 'labNumber', e.target.value)}
                                    className="w-full text-sm text-gray-600 border-b border-transparent focus:border-zankli-orange outline-none pb-1"
                                />
                            </div>
                            <div className="flex-1">
                                <input 
                                    placeholder="Investigation Required" 
                                    value={item.name}
                                    onChange={(e) => updateItem(item.id!, 'name', e.target.value)}
                                    className="w-full text-sm text-gray-600 border-b border-transparent focus:border-zankli-orange outline-none pb-1"
                                />
                            </div>
                            <div className="w-24">
                                <input 
                                    type="number"
                                    placeholder="0.00" 
                                    value={item.retainership || ''}
                                    onChange={(e) => updateItem(item.id!, 'retainership', parseFloat(e.target.value) || 0)}
                                    className="w-full text-right bg-gray-50 rounded-lg py-2 text-sm outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                            </div>
                            <div className="w-24">
                                <input 
                                    type="number"
                                    placeholder="0.00" 
                                    value={item.zmcCharge || ''}
                                    onChange={(e) => updateItem(item.id!, 'zmcCharge', parseFloat(e.target.value) || 0)}
                                    className="w-full text-right bg-gray-50 rounded-lg py-2 text-sm outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                            </div>
                            <div className="w-24">
                                <input 
                                    type="number" 
                                    placeholder="Amount"
                                    value={item.estimatedCost}
                                    onChange={(e) => updateItem(item.id!, 'estimatedCost', parseFloat(e.target.value) || 0)}
                                    className="w-full text-right bg-gray-50 rounded-lg py-2 text-sm outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                            </div>
                        </>
                    ) : isPharmacyPO ? (
                        // PHARMACY PO INPUTS
                        <>
                            <div className="flex-1">
                                <input 
                                    placeholder="Item Description" 
                                    value={item.name}
                                    onChange={(e) => updateItem(item.id!, 'name', e.target.value)}
                                    className="w-full text-sm font-medium border-b border-transparent focus:border-zankli-orange outline-none pb-1"
                                />
                            </div>
                            <div className="w-20">
                                <input 
                                    type="number" 
                                    placeholder="Lvl"
                                    value={item.stockLevel || ''}
                                    onChange={(e) => updateItem(item.id!, 'stockLevel', parseInt(e.target.value) || 0)}
                                    className="w-full text-center bg-gray-50 rounded-lg py-2 text-sm outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                            </div>
                            <div className="w-20">
                                <input 
                                    type="number" 
                                    placeholder="Qty"
                                    value={item.quantity}
                                    onChange={(e) => updateItem(item.id!, 'quantity', parseInt(e.target.value) || 0)}
                                    className="w-full text-center bg-gray-50 rounded-lg py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                            </div>
                            <div className="w-32">
                                <input 
                                    placeholder="Supplier" 
                                    value={item.supplier || ''}
                                    onChange={(e) => updateItem(item.id!, 'supplier', e.target.value)}
                                    className="w-full text-sm border-b border-transparent focus:border-zankli-orange outline-none pb-1"
                                />
                            </div>
                            <div className="w-24">
                                <input 
                                    type="number" 
                                    placeholder="Cost"
                                    value={item.unitCost || ''}
                                    onChange={(e) => updateItem(item.id!, 'unitCost', parseFloat(e.target.value) || 0)}
                                    className="w-full text-right bg-gray-50 rounded-lg py-2 text-sm outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                            </div>
                            <div className="w-24 flex items-center justify-end text-sm font-bold text-gray-700">
                                ₦{((item.quantity || 0) * (item.unitCost || 0)).toLocaleString()}
                            </div>
                        </>
                    ) : (
                        // STANDARD INPUTS (Generic / Lab PO / Equipment)
                        <>
                            <div className="flex-1">
                            <input 
                                placeholder="Item Name" 
                                value={item.name}
                                onChange={(e) => updateItem(item.id!, 'name', e.target.value)}
                                className="w-full text-sm font-medium border-b border-transparent focus:border-zankli-orange outline-none pb-1 mb-1"
                            />
                            <input 
                                placeholder="Category (e.g. Consumables)" 
                                value={item.category || ''}
                                onChange={(e) => updateItem(item.id!, 'category', e.target.value)}
                                className="w-full text-xs text-gray-500 border-b border-transparent focus:border-gray-300 outline-none"
                            />
                            </div>
                            
                            {showStockLevel && (
                                <div className="w-24">
                                    <input 
                                    type="number" 
                                    placeholder="Lvl"
                                    value={item.stockLevel || ''}
                                    onChange={(e) => updateItem(item.id!, 'stockLevel', parseInt(e.target.value) || 0)}
                                    className="w-full text-center bg-gray-50 rounded-lg py-2 text-sm outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                                </div>
                            )}

                            <div className="w-20">
                                <input 
                                type="number" 
                                placeholder="Qty"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id!, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full text-center bg-gray-50 rounded-lg py-2 text-sm font-medium outline-none focus:ring-1 focus:ring-zankli-orange"
                            />
                            </div>

                            {isEquipmentRequest && (
                                <div className="w-32">
                                    <input 
                                        placeholder="Supplier" 
                                        value={item.supplier || ''}
                                        onChange={(e) => updateItem(item.id!, 'supplier', e.target.value)}
                                        className="w-full text-sm border-b border-transparent focus:border-zankli-orange outline-none"
                                    />
                                </div>
                            )}
                            
                            {showCost && (
                                <div className="w-32">
                                    <input 
                                    type="number" 
                                    placeholder="Cost"
                                    value={item.estimatedCost}
                                    onChange={(e) => updateItem(item.id!, 'estimatedCost', parseFloat(e.target.value) || 0)}
                                    className="w-full text-right bg-gray-50 rounded-lg py-2 text-sm outline-none focus:ring-1 focus:ring-zankli-orange"
                                />
                                </div>
                            )}
                        </>
                    )}

                    <div className="w-8 flex items-center justify-center pt-2">
                        <button onClick={() => removeItem(item.id!)} className="text-gray-300 hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
                ))}
            </div>
          )}

          {/* Attachment Upload */}
          {(isEquipmentRequest || isHistology || isPharmacyPO || isEmergencyRequest || isEmergencyRequestWeek) && (
               <div className="mb-6 animate-fadeIn">
                   <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Attach Documents (PDF / Excel)</label>
                   <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors relative cursor-pointer group">
                       <input 
                            type="file" 
                            accept=".pdf, .xls, .xlsx, .png, .jpg" 
                            multiple
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                       />
                       <svg className="w-8 h-8 text-gray-400 mb-2 group-hover:text-zankli-orange transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                       <p className="text-sm text-gray-500 font-medium">Click to upload or drag and drop</p>
                       <p className="text-xs text-gray-400">Supported: PDF, Excel, Images</p>
                   </div>
                   {attachedFiles.length > 0 && (
                       <div className="mt-3 flex flex-wrap gap-2">
                           {attachedFiles.map((file, idx) => (
                               <div key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-medium flex items-center">
                                   <span>{file.name}</span>
                                   <button onClick={() => removeFile(file.name)} className="ml-2 text-blue-400 hover:text-blue-900">×</button>
                                </div>
                           ))}
                       </div>
                   )}
               </div>
          )}

          {/* AI Analysis Section */}
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 mb-6">
             <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2 text-zankli-orange mb-2">
                  {ICONS.AI}
                  <span className="font-bold text-sm">Gemini AI Assistant</span>
                </div>
                {!aiSuggestion && (
                    <button 
                        onClick={handleAIAnalysis} 
                        disabled={isAnalyzing}
                        className="text-xs bg-white px-3 py-1 rounded-full border border-orange-200 text-orange-700 hover:bg-orange-50 transition-colors"
                    >
                        {isAnalyzing ? 'Analyzing...' : 'Analyze Request'}
                    </button>
                )}
             </div>
             
             {isAnalyzing && (
                 <div className="animate-pulse space-y-2">
                     <div className="h-2 bg-orange-200 rounded w-3/4"></div>
                     <div className="h-2 bg-orange-200 rounded w-1/2"></div>
                 </div>
             )}

             {aiSuggestion && (
                 <p className="text-sm text-gray-700 leading-relaxed animate-fadeIn">
                     {aiSuggestion}
                 </p>
             )}
             {!isAnalyzing && !aiSuggestion && (
                 <p className="text-xs text-gray-500">Click analyze to get insights on budget impact and urgency validation.</p>
             )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex justify-end space-x-4">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 font-medium transition-colors">Cancel</button>
          <button onClick={handleInitiateSubmit} className="px-6 py-2.5 rounded-xl bg-zankli-orange text-white shadow-lg shadow-orange-500/30 hover:bg-orange-700 hover:shadow-orange-500/40 transition-all font-medium transform hover:-translate-y-0.5">
            {existingRequisition ? 'Resubmit Request' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
    
    <SignatureModal 
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        onConfirm={handleSignatureConfirmed}
        user={user}
    />
    </>
  );
};