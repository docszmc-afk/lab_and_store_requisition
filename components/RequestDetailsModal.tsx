import React, { useState, useEffect } from 'react';
import { Requisition, User, UserRole, Status, RequisitionItem, RequisitionType, Attachment, PaymentRecord } from '../types';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import { SignatureModal } from './SignatureModal';
import { PaymentModal } from './PaymentModal';
import { generateDownloadablePDF } from '../services/pdfService';

interface RequestDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    requisition: Requisition;
    user: User;
    onAction: (action: string, comment?: string, updatedItems?: RequisitionItem[], newFiles?: Attachment[], signature?: string) => void;
    onPayment?: (amount: number, date: string, reference: string, attachment?: Attachment) => void;
    allRequisitions?: Requisition[];
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({ isOpen, onClose, requisition, user, onAction, onPayment, allRequisitions }) => {
    const [comment, setComment] = useState('');
    const [storeItems, setStoreItems] = useState<RequisitionItem[]>([]);
    const [files, setFiles] = useState<Attachment[]>([]);
    const [duplicates, setDuplicates] = useState<Requisition[]>([]);

    const [isSignatureOpen, setIsSignatureOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ type: string, payload: any } | null>(null);
    const [viewFile, setViewFile] = useState<Attachment | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    useEffect(() => {
        if (requisition) {
            setStoreItems(JSON.parse(JSON.stringify(requisition.items)));
            setFiles(requisition.attachments || []);
            setComment('');

            if (allRequisitions) {
                const currentNames = requisition.items.map(i => i.name.toLowerCase().trim());
                const found = allRequisitions.filter(r =>
                    r.id !== requisition.id &&
                    r.status === Status.APPROVED &&
                    r.items.some(i => currentNames.includes(i.name.toLowerCase().trim()))
                );
                setDuplicates(found);
            }
        }
    }, [requisition, allRequisitions]);

    if (!isOpen) return null;

    const isChairman = user.role === UserRole.CHAIRMAN;
    const isStore = user.role === UserRole.PHARMACY_ADMIN;
    const isAudit = user.role === UserRole.AUDITOR;
    const isAudit2 = user.role === UserRole.AUDITOR && user.email === 'auditor2zankli@gmail.com';
    const isAudit1 = user.role === UserRole.AUDITOR && user.email === 'auditorzankli@gmail.com';
    const isHOF = user.role === UserRole.HEAD_OF_FINANCE;
    const isAccountant = user.role === UserRole.ACCOUNTANT;
    const isRequester = user.name === requisition.requesterName;

    const isEquipmentRequest = requisition.type === 'Equipment Request';
    const isHistology = requisition.type === 'Outsourced Histology Payment';
    const isPharmacyPO = requisition.type === 'Pharmacy Purchase Order';
    const isEmergencyRequest = requisition.type === 'Emergency Request (1 month)';
    const isEmergencyRequestWeek = requisition.type === 'Emergency Request (1 week)';

    const showChairmanControls = isChairman && (requisition.status === Status.PENDING_CHAIRMAN_REVIEW || requisition.status === Status.PENDING_FINAL_APPROVAL);
    const showStoreControls = isStore && requisition.status === Status.PENDING_STORE_FULFILLMENT;
    const showAuditControls = isAudit1 && requisition.status === Status.PENDING_AUDIT_REVIEW;
    const showAudit2Controls = isAudit2 && requisition.status === Status.PENDING_AUDIT_2_REVIEW;
    const showHOFControls = isHOF && requisition.status === Status.PENDING_FINANCE_APPROVAL;
    const showAnyActionControls = showChairmanControls || showStoreControls || showAuditControls || showAudit2Controls || showHOFControls;
    const showEditButton = isRequester && (requisition.status === Status.RETURNED || requisition.status === Status.DRAFT);
    const isApproved = requisition.status === Status.APPROVED || requisition.status === Status.ORDERED || requisition.status === Status.DELIVERED;
    const canRecordPayment = isAccountant && (isApproved || requisition.amountPaid < requisition.totalEstimatedCost) && requisition.amountPaid < requisition.totalEstimatedCost;

    const handleDownload = async () => {
        await generateDownloadablePDF('printable-content', files, `Requisition-${requisition.id}.pdf`);
    };

    const handleUpdateStoreItem = (id: string, field: keyof RequisitionItem, value: any) => {
        setStoreItems(storeItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            const processedFiles: Attachment[] = await Promise.all(newFiles.map((file: File) => {
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
            setFiles([...files, ...processedFiles]);
        }
    };

    const calculateTotal = () => {
        return storeItems.reduce((sum, item) => sum + ((item.unitCost || item.estimatedCost || 0) * item.quantity), 0);
    };

    // CRITICAL LOGIC: Maps button intent to Standard System Actions
    const getActionData = () => {
        if (showStoreControls) return { action: 'Updated', label: 'Submit to Audit' };

        if (showAudit2Controls) return { action: 'Approved', label: 'Approve (To Audit 1)' };

        if (showAuditControls) {
            if (isEquipmentRequest) return { action: 'Advice Submitted', label: 'Submit Advice' };
            return { action: 'Approved', label: 'Approve (To Chairman)' };
        }

        if (showChairmanControls) {
            if (requisition.status === Status.PENDING_FINAL_APPROVAL) return { action: 'Final Approval', label: 'Final Approval' };
            if (isEmergencyRequestWeek) return { action: 'Final Approval', label: 'Final Approval' }; // 1 week ends at Chairman
            if (isEmergencyRequest) return { action: 'Approved', label: 'Approve (To HOF)' }; // 1 month goes to HOF
            return { action: 'Approved', label: 'Approve Request' }; // Lab PO goes to Store
        }

        if (showHOFControls) return { action: 'Final Approval', label: 'Final Authorization' }; // Maps to Final Approval in logic

        return { action: 'Approved', label: 'Approve' };
    };

    const handleWorkflowClick = (actionOverride?: string) => {
        const { action } = getActionData();
        const finalAction = actionOverride || action;
        const isNegativeAction = finalAction === 'Rejected' || finalAction === 'Returned';

        if (isNegativeAction && !comment.trim()) {
            alert(`MANDATORY: Please provide a reason/comment for ${finalAction.toLowerCase()} the request.`);
            return;
        }

        setPendingAction({ type: finalAction, payload: { comment, storeItems, files } });
        setIsSignatureOpen(true);
    };

    const handleSignatureConfirmed = (signatureData: string) => {
        if (pendingAction) {
            onAction(
                pendingAction.type,
                pendingAction.payload.comment,
                pendingAction.payload.storeItems,
                pendingAction.payload.files,
                signatureData
            );
            setPendingAction(null);
        }
    };

    const handlePaymentSubmit = (amount: number, date: string, reference: string, attachment?: Attachment) => {
        if (onPayment) {
            onPayment(amount, date, reference, attachment);
        }
        setIsPaymentModalOpen(false);
    };

    const outstanding = requisition.totalEstimatedCost - (requisition.amountPaid || 0);
    const actionButtonData = getActionData();

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
                <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

                    <div className="bg-zankli-black p-6 flex justify-between items-center">
                        <div>
                            <div className="flex items-center space-x-3">
                                <h2 className="text-xl font-bold text-white">{requisition.id}</h2>
                                <StatusBadge status={requisition.status} />
                            </div>
                            <p className="text-gray-400 text-sm mt-1">{requisition.type} • {requisition.department}</p>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={handleDownload} className="text-gray-300 hover:text-white p-2 bg-white/10 rounded-lg transition-colors flex items-center space-x-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                <span className="text-sm">Download PDF</span>
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    <div id="printable-content" className="p-6 overflow-y-auto custom-scrollbar bg-white flex-1 relative">

                        {(isAccountant || isHOF || isChairman) && (
                            <div className="mb-8 bg-gray-900 text-white p-6 rounded-xl flex justify-between items-center shadow-lg">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Amount</p>
                                    <p className="text-2xl font-bold">₦{requisition.totalEstimatedCost.toLocaleString()}</p>
                                </div>
                                <div className="h-10 w-px bg-gray-700"></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Paid</p>
                                    <p className="text-2xl font-bold text-green-400">₦{(requisition.amountPaid || 0).toLocaleString()}</p>
                                </div>
                                <div className="h-10 w-px bg-gray-700"></div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Balance</p>
                                    <p className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                                        ₦{outstanding.toLocaleString()}
                                    </p>
                                </div>
                                {canRecordPayment && (
                                    <button
                                        onClick={() => setIsPaymentModalOpen(true)}
                                        className="bg-zankli-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors ml-4"
                                    >
                                        Record Payment
                                    </button>
                                )}
                            </div>
                        )}

                        {showAnyActionControls && duplicates.length > 0 && (
                            <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg animate-pulse">
                                <div className="flex items-start">
                                    <span className="text-2xl mr-3">⚠️</span>
                                    <div>
                                        <h4 className="font-bold text-amber-800 text-sm uppercase">Duplicate Item Warning</h4>
                                        <p className="text-sm text-amber-700 mt-1">
                                            This request contains items that have been approved in previous requests:
                                        </p>
                                        <ul className="list-disc list-inside mt-2 text-xs text-amber-900 space-y-1">
                                            {duplicates.slice(0, 3).map(d => (
                                                <li key={d.id}>
                                                    <span className="font-bold">{d.id}</span> ({new Date(d.date).toLocaleDateString()}) - {d.items.map(i => i.name).join(', ')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mb-8 border-b border-gray-200 pb-6">
                            <div className="text-center mb-4">
                                <h1 className="text-3xl font-bold text-black uppercase tracking-wide">ZANKLI MEDICAL SERVICES LTD</h1>
                                {!isEmergencyRequestWeek && (
                                    <h2 className="text-xl font-bold text-black mt-2 uppercase underline decoration-2 underline-offset-4">
                                        {isEmergencyRequest ? 'PAYMENT APPROVAL FORM FOR EMERGENCY DRUG' : 'Procurement Requisition'}
                                    </h2>
                                )}
                            </div>

                            <div className="flex justify-between items-end text-sm text-gray-900 font-medium">
                                <div className="space-y-1">
                                    <p><span className="font-bold">DATE:</span> {new Date(requisition.date).toLocaleDateString()}</p>
                                    <p><span className="font-bold">REF NO:</span> {requisition.id}</p>
                                    {!isEmergencyRequestWeek && <p><span className="font-bold">REQUESTER:</span> {requisition.requesterName} ({requisition.department})</p>}
                                </div>
                            </div>
                        </div>

                        {isEmergencyRequestWeek ? (
                            <div className="max-w-3xl mx-auto space-y-8 text-gray-900 font-serif text-lg leading-relaxed p-4">
                                <div className="text-center mb-8">
                                    <h2 className="text-xl font-bold uppercase underline decoration-2 underline-offset-4">{requisition.title}</h2>
                                </div>

                                <div className="space-y-6 text-justify">
                                    <p>
                                        Please, kindly approve the release of the sum of <span className="font-bold">₦{requisition.totalEstimatedCost.toLocaleString()}</span> - <span className="font-bold uppercase">{requisition.amountInWords}</span> for the <span className="font-bold uppercase">{requisition.justification}</span>.
                                    </p>
                                </div>

                                <div className="text-center py-8">
                                    <p className="font-bold text-xl uppercase tracking-wide">PLEASE MA, KINDLY WRITE PLS PAY</p>
                                </div>

                                <div className="mt-8">
                                    <p>Thank you ma,</p>
                                    <div className="mt-8 font-bold uppercase">
                                        {requisition.requesterName}
                                    </div>
                                </div>

                                <div className="mt-16 pt-8 border-t border-black grid grid-cols-3 gap-8">
                                    {[
                                        { role: UserRole.PHARMACY_ADMIN, label: "REQUESTER" },
                                        { role: UserRole.AUDITOR, email: 'auditorzankli@gmail.com', label: "AUDIT" },
                                        { role: UserRole.CHAIRMAN, label: "APPROVED BY (CHAIRMAN)" }
                                    ].map((sigBlock, idx) => {
                                        const signatureEntry = requisition.auditTrail
                                            .slice().reverse()
                                            .find(log => {
                                                if (sigBlock.email) return log.userName === 'Auditor 1';
                                                return log.userRole === sigBlock.role;
                                            });

                                        return (
                                            <div key={idx} className="text-center flex flex-col items-center">
                                                <div className="w-full h-20 border-b border-black mb-2 flex items-end justify-center pb-2 relative">
                                                    {signatureEntry?.signature ? (
                                                        <img src={signatureEntry.signature} alt="Signature" className="max-h-16 max-w-full mix-blend-multiply" />
                                                    ) : (
                                                        <span className="text-xs text-gray-300"></span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold uppercase">{sigBlock.label}</p>
                                                {signatureEntry && <p className="text-[10px] text-gray-500">{new Date(signatureEntry.date).toLocaleDateString()}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : isEmergencyRequest ? (
                            <div className="max-w-3xl mx-auto space-y-8 text-gray-900 font-serif text-lg leading-relaxed p-4">
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <span className="font-bold min-w-[150px]">PLEASE PAY:</span>
                                        <span className="border-b border-dotted border-gray-400 flex-1 pb-1">{requisition.beneficiary}</span>
                                    </div>

                                    <div className="flex gap-4">
                                        <span className="font-bold min-w-[150px]">THE SUM OF:</span>
                                        <span className="border-b border-dotted border-gray-400 flex-1 pb-1 font-bold text-xl">₦{requisition.totalEstimatedCost.toLocaleString()}</span>
                                    </div>

                                    <div className="flex gap-4">
                                        <span className="font-bold min-w-[150px]">(AMOUNT IN WORDS):</span>
                                        <span className="border-b border-dotted border-gray-400 flex-1 pb-1 italic">{requisition.amountInWords}</span>
                                    </div>

                                    <div className="flex gap-4">
                                        <span className="font-bold min-w-[150px]">BEING:</span>
                                        <span className="border-b border-dotted border-gray-400 flex-1 pb-1">{requisition.justification}</span>
                                    </div>
                                </div>

                                <div className="mt-12 space-y-8">
                                    {[
                                        { role: UserRole.PHARMACY_ADMIN, title: "APPLICANT'S (NAME & SIGN)", name: requisition.requesterName },
                                        { role: UserRole.AUDITOR, email: 'auditor2zankli@gmail.com', title: "CONFIRMED BY: INTERNAL AUDITOR (2)" },
                                        { role: UserRole.AUDITOR, email: 'auditorzankli@gmail.com', title: "CONFIRMED BY: INTERNAL AUDITOR (1)" },
                                        { role: UserRole.CHAIRMAN, title: "APPROVED BY: CHAIRMAN/CMD" },
                                        { role: UserRole.HEAD_OF_FINANCE, title: "AUTHORIZED BY: HEAD OF FINANCE" }
                                    ].map((sig, idx) => {
                                        const signedLog = requisition.auditTrail.slice().reverse().find(l => {
                                            if (sig.email) return l.userName === (sig.email === 'auditor2zankli@gmail.com' ? 'Auditor 1' : 'Auditor 2');
                                            return l.userRole === sig.role;
                                        });

                                        return (
                                            <div key={idx} className="border-b border-black pb-1 pt-8 relative">
                                                <span className="font-bold mr-2 text-sm">{sig.title}:</span>
                                                {signedLog ? (
                                                    <div className="absolute bottom-2 left-1/3 transform -translate-x-10">
                                                        {signedLog.signature ? (
                                                            <img src={signedLog.signature} alt="Signed" className="h-12 mix-blend-multiply" />
                                                        ) : (
                                                            <span className="font-script text-xl">{signedLog.userName}</span>
                                                        )}
                                                        <span className="text-[10px] block text-gray-500">{new Date(signedLog.date).toLocaleDateString()}</span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <>
                                {requisition.justification && (
                                    <div className="mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Justification / Description</h3>
                                        <p className="text-sm text-gray-800 leading-relaxed">{requisition.justification}</p>
                                    </div>
                                )}

                                <div className="mb-8">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">
                                        {isHistology ? 'Investigation Details' : 'Requisition Items'}
                                    </h3>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                                            <tr>
                                                {isHistology ? (
                                                    <>
                                                        <th className="px-4 py-3 rounded-tl-lg">Patient Name</th>
                                                        <th className="px-4 py-3">Lab No.</th>
                                                        <th className="px-4 py-3">Investigation</th>
                                                        <th className="px-4 py-3 text-right">Retainership</th>
                                                        <th className="px-4 py-3 text-right">ZMC Charge</th>
                                                        <th className="px-4 py-3 text-right rounded-tr-lg">Amount</th>
                                                    </>
                                                ) : isPharmacyPO ? (
                                                    <>
                                                        <th className="px-4 py-3 rounded-tl-lg">Description</th>
                                                        <th className="px-4 py-3 text-center">Stock</th>
                                                        <th className="px-4 py-3 text-center">Qty</th>
                                                        <th className="px-4 py-3">Supplier</th>
                                                        <th className="px-4 py-3 text-right">Unit Cost</th>
                                                        <th className="px-4 py-3 text-right rounded-tr-lg">Total</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="px-4 py-3 rounded-tl-lg">Description</th>
                                                        <th className="px-4 py-3 text-center">Stock Lvl</th>
                                                        <th className="px-4 py-3 text-center">Qty</th>
                                                        {(showStoreControls || requisition.status === Status.PENDING_AUDIT_REVIEW || requisition.status === Status.PENDING_FINAL_APPROVAL || requisition.status === Status.APPROVED || isEquipmentRequest) && (
                                                            <>
                                                                <th className="px-4 py-3">Supplier</th>
                                                                <th className="px-4 py-3 text-right">Unit Cost</th>
                                                                <th className="px-4 py-3 text-right rounded-tr-lg">Total</th>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {storeItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400 italic bg-gray-50">
                                                        No items found. Please contact the administrator if this is an error.
                                                    </td>
                                                </tr>
                                            ) : (
                                                storeItems.map((item, idx) => (
                                                    <tr key={idx}>
                                                        {isHistology ? (
                                                            <>
                                                                <td className="px-4 py-3 font-medium">{item.patientName || '-'}</td>
                                                                <td className="px-4 py-3 text-gray-500">{item.labNumber || '-'}</td>
                                                                <td className="px-4 py-3 text-gray-800">{item.name}</td>
                                                                <td className="px-4 py-3 text-right text-gray-600">{item.retainership ? `₦${item.retainership.toLocaleString()}` : '-'}</td>
                                                                <td className="px-4 py-3 text-right text-gray-600">{item.zmcCharge ? `₦${item.zmcCharge.toLocaleString()}` : '-'}</td>
                                                                <td className="px-4 py-3 text-right font-bold">₦{item.estimatedCost.toLocaleString()}</td>
                                                            </>
                                                        ) : isPharmacyPO ? (
                                                            <>
                                                                <td className="px-4 py-3 font-medium">{item.name}</td>
                                                                <td className="px-4 py-3 text-center text-gray-500">{(item.stockLevel !== undefined && item.stockLevel !== null) ? item.stockLevel : '0'}</td>
                                                                <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                                                                <td className="px-4 py-3 text-gray-700">{item.supplier || '-'}</td>
                                                                <td className="px-4 py-3 text-right text-gray-700">₦{(item.unitCost || 0).toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right font-bold">₦{((item.unitCost || 0) * item.quantity).toLocaleString()}</td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="px-4 py-3 font-medium">{item.name} <div className="text-xs text-gray-400">{item.category}</div></td>
                                                                <td className="px-4 py-3 text-center text-gray-500">{(item.stockLevel !== undefined && item.stockLevel !== null) ? item.stockLevel : '0'}</td>
                                                                <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>

                                                                {(showStoreControls || requisition.status === Status.PENDING_AUDIT_REVIEW || requisition.status === Status.PENDING_FINAL_APPROVAL || requisition.status === Status.APPROVED || isEquipmentRequest) && (
                                                                    <>
                                                                        <td className="px-4 py-3">
                                                                            {showStoreControls ? (
                                                                                <input
                                                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                                                                                    placeholder="Enter Supplier"
                                                                                    value={item.supplier || ''}
                                                                                    onChange={(e) => handleUpdateStoreItem(item.id, 'supplier', e.target.value)}
                                                                                />
                                                                            ) : (
                                                                                <span className="text-gray-700">{item.supplier || 'N/A'}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right">
                                                                            {showStoreControls ? (
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-24 border border-gray-300 rounded px-2 py-1 text-xs text-right"
                                                                                    placeholder="0.00"
                                                                                    value={item.unitCost || ''}
                                                                                    onChange={(e) => handleUpdateStoreItem(item.id, 'unitCost', parseFloat(e.target.value))}
                                                                                />
                                                                            ) : (
                                                                                <span className="text-gray-700">₦{(item.unitCost || item.estimatedCost).toLocaleString()}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-bold text-zankli-black">
                                                                            ₦{((item.unitCost || item.estimatedCost) * item.quantity).toLocaleString()}
                                                                        </td>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </tr>
                                                ))
                                            )}
                                            <tr className="bg-gray-50 font-bold text-gray-900">
                                                <td colSpan={isHistology ? 5 : isPharmacyPO ? 5 : (showStoreControls || requisition.status === Status.PENDING_AUDIT_REVIEW || requisition.status === Status.PENDING_FINAL_APPROVAL || requisition.status === Status.APPROVED || isEquipmentRequest) ? 5 : 3} className="px-4 py-3 text-right">Grand Total</td>
                                                <td className="px-4 py-3 text-right text-lg">₦{calculateTotal().toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* Payment History */}
                        {((isAccountant || isHOF) && requisition.paymentRecords?.length > 0) && (
                            <div className="mt-8 pt-8 border-t border-gray-100">
                                <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">Payment History</h3>
                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Amount</th>
                                                <th className="px-4 py-3">Reference</th>
                                                <th className="px-4 py-3">Recorded By</th>
                                                <th className="px-4 py-3">Receipt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {requisition.paymentRecords.map((rec) => (
                                                <tr key={rec.id}>
                                                    <td className="px-4 py-3">{new Date(rec.date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 font-bold text-gray-800">₦{rec.amount.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-gray-600">{rec.reference}</td>
                                                    <td className="px-4 py-3 text-gray-600">{rec.recordedBy}</td>
                                                    <td className="px-4 py-3">
                                                        {rec.attachment ? (
                                                            <button onClick={() => setViewFile(rec.attachment!)} className="text-blue-600 hover:underline text-xs">
                                                                View Receipt
                                                            </button>
                                                        ) : <span className="text-gray-400 text-xs">-</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Audit Trail Section */}
                        {!isEmergencyRequest && !isEmergencyRequestWeek && (
                            <div className="mt-8 pt-8 border-t border-gray-100 break-inside-avoid">
                                <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">Audit Trail</h3>
                                <div className="space-y-6">
                                    {requisition.auditTrail.map((log) => (
                                        <div key={log.id} className="flex items-start relative">
                                            <div className="absolute left-2 top-8 bottom-[-24px] w-0.5 bg-gray-100 last:hidden"></div>

                                            <div className="w-4 h-4 rounded-full bg-zankli-orange border-2 border-white shadow-sm mt-1.5 z-10 flex-shrink-0"></div>
                                            <div className="ml-4 flex-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div>
                                                        <span className="font-bold text-gray-900 text-sm">{log.userName} <span className="font-normal text-gray-500 text-xs">({log.userRole})</span></span>
                                                        <div className="text-sm text-gray-800 mt-1">
                                                            <span className={`font-medium ${log.action === 'Rejected' ? 'text-red-600' : log.action === 'Approved' ? 'text-green-600' : 'text-blue-600'}`}>{log.action}</span>
                                                            {log.comment && <span className="text-gray-600"> - "{log.comment}"</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] text-gray-400">{new Date(log.date).toLocaleString()}</span>
                                                        {log.signature && (
                                                            <img src={log.signature} alt="Signed" className="h-8 mt-2 border border-gray-200 bg-white rounded" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Signatures */}
                        {!isEmergencyRequest && !isEmergencyRequestWeek && (
                            <div className="mt-16 pt-8 border-t border-gray-300 grid grid-cols-3 gap-8">
                                {[
                                    { role: isPharmacyPO ? UserRole.PHARMACY_ADMIN : UserRole.LAB_ADMIN, label: 'Requested By' },
                                    { role: UserRole.AUDITOR, label: 'Verified By (Audit)' },
                                    { role: UserRole.CHAIRMAN, label: 'Approved By (Chairman)' },
                                ].map((sigBlock, idx) => {
                                    const signatureEntry = requisition.auditTrail
                                        .slice().reverse()
                                        .find(log => (log.userRole === sigBlock.role && log.signature));

                                    return (
                                        <div key={idx} className="text-center flex flex-col items-center">
                                            <div className="w-full h-20 border-b border-black mb-2 flex items-end justify-center pb-2">
                                                {signatureEntry?.signature ? (
                                                    <img src={signatureEntry.signature} alt="Signature" className="max-h-16 max-w-full mix-blend-multiply" />
                                                ) : (
                                                    <span className="text-xs text-gray-300">Not Signed</span>
                                                )}
                                            </div>
                                            <p className="text-xs font-bold uppercase">{sigBlock.label}</p>
                                            {signatureEntry && <p className="text-[10px] text-gray-500">{new Date(signatureEntry.date).toLocaleDateString()}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Attached Files</h3>
                        {files.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No attachments.</p>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {files.map((file, idx) => (
                                    <div key={idx} className="flex items-center bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                                        <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" /></svg>
                                        <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{file.name}</span>
                                        <button onClick={() => setViewFile(file)} className="ml-2 text-zankli-orange hover:text-orange-700 text-xs font-bold underline">
                                            View
                                        </button>
                                    </div>
                                ))}
                                {showStoreControls && (
                                    <div className="relative">
                                        <button className="flex items-center px-3 py-2 rounded-lg border border-dashed border-gray-400 text-gray-500 hover:bg-gray-50 hover:text-zankli-orange transition-colors text-sm">
                                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Add File
                                        </button>
                                        <input
                                            type="file"
                                            accept=".pdf, .xls, .xlsx, .png, .jpg"
                                            multiple
                                            onChange={handleFileUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                        {showEditButton && (
                            <button
                                onClick={() => onAction('Edit')}
                                className="w-full bg-zankli-orange text-white py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-colors"
                            >
                                Edit & Resubmit Request
                            </button>
                        )}

                        {showAnyActionControls && (
                            <div className="space-y-4">
                                <textarea
                                    placeholder={showAuditControls || showAudit2Controls ? "Provide your advice or analysis here..." : "Add a comment (Mandatory for Reject/Return)..."}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-zankli-orange focus:border-transparent outline-none"
                                    rows={2}
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleWorkflowClick(showStoreControls ? 'Returned' : 'Rejected')}
                                        className="flex-1 bg-white border border-red-200 text-red-600 py-3 rounded-xl font-bold hover:bg-red-50 transition-colors"
                                    >
                                        {showStoreControls ? 'Return to Lab' : 'Reject Request'}
                                    </button>

                                    {!showStoreControls && (
                                        <button
                                            onClick={() => handleWorkflowClick('Returned')}
                                            className="flex-1 bg-white border border-orange-200 text-orange-600 py-3 rounded-xl font-bold hover:bg-orange-50 transition-colors"
                                        >
                                            Send Back
                                        </button>
                                    )}

                                    {showChairmanControls && isEquipmentRequest && (
                                        <button
                                            onClick={() => handleWorkflowClick('Consulted Audit')}
                                            className="flex-1 bg-purple-50 border border-purple-200 text-purple-700 py-3 rounded-xl font-bold hover:bg-purple-100 transition-colors"
                                        >
                                            Consult Audit
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleWorkflowClick(
                                            showAudit2Controls ? 'Approved' :
                                                showAuditControls ? (isHistology || isPharmacyPO || isEmergencyRequest || isEmergencyRequestWeek ? 'Approved' : 'Advice Submitted') :
                                                    showChairmanControls && (requisition.status === Status.PENDING_FINAL_APPROVAL || isEmergencyRequestWeek) ? 'Final Approval' :
                                                        showChairmanControls && isEmergencyRequest ? 'Approved' :
                                                            showHOFControls ? 'Final Approval' :
                                                                showStoreControls ? 'Updated' :
                                                                    'Approved'
                                        )}
                                        className="flex-[2] bg-zankli-orange text-white py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-colors"
                                    >
                                        {actionButtonData.label}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            <SignatureModal
                isOpen={isSignatureOpen}
                onClose={() => setIsSignatureOpen(false)}
                onConfirm={handleSignatureConfirmed}
                user={user}
            />

            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                onSubmit={handlePaymentSubmit}
                requisition={requisition}
                user={user}
            />

            {viewFile && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setViewFile(null)} />
                    <div className="relative bg-white w-full max-w-6xl h-[85vh] rounded-xl shadow-2xl flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-200">
                            <h3 className="font-bold text-gray-800">{viewFile.name}</h3>
                            <button onClick={() => setViewFile(null)} className="text-gray-500 hover:text-black">✕</button>
                        </div>
                        <div className="flex-1 bg-gray-100 p-4 flex items-center justify-center overflow-auto">
                            {viewFile.type === 'application/pdf' ? (
                                <object
                                    data={viewFile.data}
                                    type="application/pdf"
                                    className="w-full h-full rounded shadow-sm"
                                >
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                        <p>Unable to display PDF directly.</p>
                                        <a href={viewFile.data} download={viewFile.name} className="text-zankli-orange underline mt-2">Download File</a>
                                    </div>
                                </object>
                            ) : (
                                <img src={viewFile.data} alt={viewFile.name} className="max-w-full max-h-full rounded shadow-sm" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};