import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { User, Requisition, RequisitionStatus, Role, RequisitionItem, RequisitionType, HistologyItem, Message, Signature, Payment, Notification, ApprovalLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useRequisitions } from '../contexts/RequisitionContext';
import { PlusIcon, CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon, ArrowLeftIcon, UploadIcon, DownloadIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, PencilSquareIcon, BanknotesIcon, BellIcon, ArrowPathIcon } from './Icons';
import SignaturePad from 'signature_pad';
import { supabase } from '../lib/supabaseClient';


const generatePdf = (req: Requisition) => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    let finalY = 0;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    const addFooters = (docInstance: any) => {
        const pageCount = docInstance.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            docInstance.setPage(i);
            docInstance.setFontSize(8);
            docInstance.setTextColor(150);
            docInstance.text(`Page ${i} of ${pageCount}`, docInstance.internal.pageSize.width - 25, docInstance.internal.pageSize.height - 10);
            docInstance.text(`Zankli Procurement System - ${req.id}`, 15, docInstance.internal.pageSize.height - 10);
        }
    };

    const drawSignatures = (startY: number) => {
        let currentY = startY;
        if (currentY > 220) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12);
        doc.text("Signatures & Approvals", margin, currentY);
        currentY += 10;
        
        const signaturesToDraw = [
            req.signatures?.preparedBy && {...req.signatures.preparedBy, role: 'Prepared By'},
            req.signatures?.levelConfirmedBy && {...req.signatures.levelConfirmedBy, role: 'Level Confirmed By'},
            req.signatures?.checkedBy && {...req.signatures.checkedBy, role: 'Checked By'},
        ].filter(Boolean) as ({name: string, signature: string, timestamp: string, role: string})[];

        req.log?.forEach(l => {
            if (l.signature) {
                signaturesToDraw.push({ name: l.userName || '', signature: l.signature, timestamp: l.timestamp, role: `${l.action} By`});
            }
        });

        signaturesToDraw.forEach(sig => {
            if (currentY > 240) { doc.addPage(); currentY = 20; }
            doc.setFontSize(10);
            doc.text(`${sig.role}: ${sig.name}`, margin, currentY + 5);
            doc.text(`Date: ${new Date(sig.timestamp).toLocaleString()}`, margin, currentY + 10);
            doc.addImage(sig.signature, 'PNG', margin, currentY + 12, 50, 20);
            doc.line(margin, currentY + 35, margin + 70, currentY + 35);
            currentY += 45;
        });

        return currentY;
    };
    
    if (req.type === RequisitionType.HISTOLOGY_PAYMENT) {
        doc.setFontSize(16); doc.text("ZANKLI MEDICAL SERVICES LTD", 105, 15, { align: 'center' });
        doc.setFontSize(12); doc.text("REQUEST FOR HISTOLOGY PAYMENT", 105, 22, { align: 'center' });
        doc.text(`Status: ${req.status}`, margin, 30); doc.text(`Requester: ${req.requesterName}`, margin, 37);
        const tableColumn = ['Date', 'Patient Name', 'Hosp. No', 'Lab. No', 'Receipt/HMO', 'Service', 'Outsource Bills', 'ZMC Charge', 'Retainership'];
        const tableRows = (req.histologyItems || []).map(item => [ new Date(item.date).toLocaleDateString(), item.patient_name, item.hospital_no, item.lab_no, item.receipt_no, item.outsource_service, `NGN ${item.outsource_bills.toLocaleString()}`, `NGN ${item.zmc_charge.toLocaleString()}`, item.retainership, ]);
        (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 45, margin: { left: margin } });
        finalY = (doc as any).previousAutoTable.finalY;

        if (finalY > 220) { doc.addPage(); finalY = 20; }
        doc.setFontSize(14);
        const totalCostText = `Total Cost: NGN ${req.total_estimated_cost.toLocaleString()}`;
        const totalWidth = doc.getTextWidth(totalCostText);
        doc.text(totalCostText, pageWidth - margin - totalWidth, finalY + 15);
        finalY += 20;

    } else if (req.type === RequisitionType.PURCHASE_ORDER) {
        doc.setFontSize(18); doc.setFont('helvetica', 'bold');
        doc.text("Zankli Medical Services LTD", margin, 20);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text("No. 1 Ibrahim Tahir Lane", margin, 26);
        doc.text("Abuja, FCT, Nigeria", margin, 32);
        doc.setFontSize(22); doc.setFont('helvetica', 'bold');
        doc.text("PURCHASE ORDER", pageWidth - margin, 25, { align: 'right' });

        let startY = 50;
        doc.setDrawColor(200);
        doc.line(margin, startY - 5, pageWidth - margin, startY - 5);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold'); doc.text("PO Number:", pageWidth - margin - 35, startY);
        doc.setFont('helvetica', 'normal'); doc.text(req.id, pageWidth - margin - 10, startY);
        startY += 7;
        doc.setFont('helvetica', 'bold'); doc.text("Date:", pageWidth - margin - 35, startY);
        doc.setFont('helvetica', 'normal'); doc.text(new Date(req.created_at).toLocaleDateString(), pageWidth - margin - 10, startY);
        startY += 10;
        
        const tableColumn = ["Item Name", "Description", "Supplier", "Stock Lvl", "Qty", "Unit Price", "Total Price"];
        const tableRows = (req.items || []).map(item => [
            item.name, item.description, item.supplier || 'N/A', item.stock_level ?? 'N/A', item.quantity,
            item.unit_price ? `NGN ${item.unit_price.toLocaleString()}` : 'Not Priced',
            item.unit_price ? `NGN ${(item.quantity * item.unit_price).toLocaleString()}` : 'N/A'
        ]);
        (doc as any).autoTable({
            head: [tableColumn], body: tableRows, startY: startY, margin: { left: margin },
            theme: 'grid', headStyles: { fillColor: [34, 49, 63] },
        });
        finalY = (doc as any).previousAutoTable.finalY;

        if (finalY > 240) { doc.addPage(); finalY = 20; }
        doc.setFontSize(12); doc.setFont('helvetica', 'bold');
        const totalText = `Total: NGN ${req.total_estimated_cost.toLocaleString()}`;
        doc.text(totalText, pageWidth - margin, finalY + 15, { align: 'right' });
        finalY += 20;

    } else { // Standard Requisition
        doc.setFontSize(20); doc.text(`Requisition: ${req.id}`, margin, 20);
        doc.setFontSize(12); doc.text(`Type: Standard`, margin, 30);
        doc.text(`Department: ${req.department}`, margin, 37);
        doc.text(`Status: ${req.status}`, margin, 44);
        doc.text(`Requester: ${req.requesterName}`, margin, 51);
        const tableColumn = ["Item Name", "Description", "Quantity", "Est. Unit Cost", "Est. Total Cost"];
        const tableRows = (req.items || []).map(item => [ item.name, item.description, item.quantity, `NGN ${(item.estimated_unit_cost || 0).toLocaleString()}`, `NGN ${(item.quantity * (item.estimated_unit_cost || 0)).toLocaleString()}` ]);
        (doc as any).autoTable({ head: [tableColumn], body: tableRows, startY: 60, margin: { left: margin } });
        finalY = (doc as any).previousAutoTable.finalY;

        if (finalY > 220) { doc.addPage(); finalY = 20; }
        doc.setFontSize(14);
        const totalCostText = `Total Cost: NGN ${req.total_estimated_cost.toLocaleString()}`;
        const totalWidth = doc.getTextWidth(totalCostText);
        doc.text(totalCostText, pageWidth - margin - totalWidth, finalY + 15);
        finalY += 20;
    }

    if(req.payments && req.payments.length > 0) {
        finalY += 15;
        if (finalY > 220) { doc.addPage(); finalY = 20; }
        doc.setFontSize(12);
        doc.text("Payment History", margin, finalY);
        const paymentCols = ["Date", "Amount Paid", "Recorded By", "Proof"];
        const paymentRows = req.payments.map(p => [new Date(p.date).toLocaleDateString(), `NGN ${p.amount.toLocaleString()}`, p.recordedByName || 'N/A', p.proof_path ? 'Yes' : 'No']);
        (doc as any).autoTable({ head: [paymentCols], body: paymentRows, startY: finalY + 5, margin: { left: margin } });
        finalY = (doc as any).previousAutoTable.finalY;
    }

    finalY = drawSignatures(finalY + 15);
    
    addFooters(doc);
    doc.save(`${req.id}.pdf`);
};

// --- Reusable Components ---
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000); // Increased duration for readability
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';

    return (
        <div className={`fixed top-5 right-5 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in`}>
            {message}
        </div>
    );
};


const NotificationPanel: React.FC<{
    notifications: Notification[],
    onSelect: (notification: Notification) => void,
    onMarkAllRead: () => void,
}> = ({ notifications, onSelect, onMarkAllRead }) => {
    return (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20">
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">Notifications</h3>
                <button onClick={onMarkAllRead} className="text-xs font-semibold text-burnt-orange-700 hover:underline">Mark all as read</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-8">No new notifications.</p>
                ) : (
                    notifications.map(n => (
                        <div key={n.id} onClick={() => onSelect(n)} className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-start gap-3">
                            {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>}
                            <div className={n.read ? 'ml-5' : ''}>
                                <p className={`text-sm ${n.read ? 'text-slate-600' : 'text-slate-800 font-semibold'}`}>{n.message}</p>
                                <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const Header: React.FC<{ user: User; onLogout: () => void; onSelectNotification: (notification: Notification) => void }> = ({ user, onLogout, onSelectNotification }) => {
    const { notifications, markAllNotificationsAsRead } = useRequisitions();
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setIsPanelOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [panelRef]);

    return (
        <header className="bg-white shadow-md sticky top-0 z-10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center">
                        <h1 className="text-xl md:text-2xl font-bold text-burnt-orange-800">Zankli Procurement</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                         <div ref={panelRef} className="relative">
                            <button onClick={() => setIsPanelOpen(prev => !prev)} className="relative text-slate-600 hover:text-slate-800 p-2 rounded-full hover:bg-slate-100">
                                <BellIcon className="w-6 h-6" />
                                {unreadCount > 0 && <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{unreadCount}</span>}
                            </button>
                            {isPanelOpen && <NotificationPanel notifications={notifications} onSelect={(n) => { onSelectNotification(n); setIsPanelOpen(false); }} onMarkAllRead={() => markAllNotificationsAsRead(user.id)} />}
                        </div>
                        <div className="text-right">
                            <p className="font-semibold text-slate-800 text-sm md:text-base">{user.name}</p>
                            <p className="text-xs md:text-sm text-slate-500">{user.role}</p>
                        </div>
                        <button onClick={onLogout} className="rounded-md bg-burnt-orange-100 px-3 py-2 text-sm font-semibold text-burnt-orange-800 hover:bg-burnt-orange-200 transition-colors">Logout</button>
                    </div>
                </div>
            </div>
        </header>
    );
};

const SignaturePadComponent: React.FC<{ onSave: (dataUrl: string) => void; onClear: () => void }> = ({ onSave, onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);

    useEffect(() => {
        if (canvasRef.current) {
            signaturePadRef.current = new SignaturePad(canvasRef.current, {
                backgroundColor: 'rgb(255, 255, 255)'
            });
            const resizeCanvas = () => {
                if (!canvasRef.current) return;
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvasRef.current.width = canvasRef.current.offsetWidth * ratio;
                canvasRef.current.height = canvasRef.current.offsetHeight * ratio;
                canvasRef.current.getContext("2d")!.scale(ratio, ratio);
                signaturePadRef.current?.clear();
            };
            window.addEventListener("resize", resizeCanvas);
            resizeCanvas();
            return () => window.removeEventListener("resize", resizeCanvas);
        }
    }, []);

    const handleSave = () => {
        if (signaturePadRef.current && !signaturePadRef.current.isEmpty()) {
            onSave(signaturePadRef.current.toDataURL());
        } else {
            alert("Please provide a signature first.");
        }
    };

    const handleClear = () => {
        signaturePadRef.current?.clear();
        onClear();
    };

    return (
        <div className="w-full">
            <div className="border border-slate-300 rounded-md">
                <canvas ref={canvasRef} className="w-full h-40 rounded-md"></canvas>
            </div>
            <div className="flex justify-end space-x-2 mt-2">
                <button type="button" onClick={handleClear} className="px-3 py-1 text-sm rounded bg-slate-200 hover:bg-slate-300">Clear</button>
                <button type="button" onClick={handleSave} className="px-3 py-1 text-sm rounded bg-burnt-orange-600 text-white hover:bg-burnt-orange-700">Save Signature</button>
            </div>
        </div>
    );
};

const SignatureModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSign: (signature: string, comment?: string) => void;
    action: string;
    isSubmitting?: boolean;
}> = ({ isOpen, onClose, onSign, action, isSubmitting = false }) => {
    const [signature, setSignature] = useState<string | null>(null);
    const [comment, setComment] = useState('');

    if (!isOpen) return null;

    const handleSign = () => {
        if (!signature) {
            alert('Please provide your signature first.');
            return;
        }
        if ((action === 'Reject' || action === 'Query') && !comment.trim()) {
            alert('A comment is required for this action.');
            return;
        }
        onSign(signature, comment);
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Confirm Action: {action}</h2>
                {(action === 'Reject' || action === 'Query') && (
                    <div className="mb-4">
                        <label htmlFor="comment" className="block text-sm font-medium text-slate-700 mb-1">Comment (Required)</label>
                        <textarea
                            id="comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                            className="w-full border border-slate-300 rounded-md p-2 focus:ring-burnt-orange-500 focus:border-burnt-orange-500"
                        />
                    </div>
                )}
                 <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Please Sign Below</label>
                    <SignaturePadComponent onSave={(data) => setSignature(data)} onClear={() => setSignature(null)} />
                    {signature && <img src={signature} alt="Your signature" className="mt-2 border rounded h-16 w-auto" />}
                </div>
                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded bg-slate-200 hover:bg-slate-300">Cancel</button>
                    <button 
                        onClick={handleSign}
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded bg-burnt-orange-700 text-white hover:bg-burnt-orange-800 disabled:bg-slate-400 disabled:cursor-wait"
                    >
                        {isSubmitting ? 'Submitting...' : action}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ConversationPanel: React.FC<{
    requisition: Requisition;
    currentUser: User;
    onSendMessage: (text: string) => void;
}> = ({ requisition, currentUser, onSendMessage }) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const conversation = requisition.conversation || [];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversation]);

    const handleSend = () => {
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };
    return (
        <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 border-b pb-2">Conversation</h3>
            <div className="max-h-60 overflow-y-auto space-y-4 pr-2">
                {conversation.length === 0 ? (
                    <p className="text-sm text-slate-500">No messages yet.</p>
                ) : (
                    conversation.map(msg => (
                        <div key={msg.id} className={`flex items-start gap-2.5 ${msg.sender_id === currentUser.id ? 'justify-end' : ''}`}>
                            <div className={`flex flex-col w-full max-w-[320px] leading-1.5 p-4 border-slate-200 ${msg.sender_id === currentUser.id ? 'bg-burnt-orange-100 rounded-s-xl rounded-ee-xl' : 'bg-slate-100 rounded-e-xl rounded-es-xl'}`}>
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <span className="text-sm font-semibold text-slate-900">{msg.senderName}</span>
                                    <span className="text-xs font-normal text-slate-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm font-normal py-2.5 text-slate-900">{msg.text}</p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..."
                    className="flex-grow border border-slate-300 rounded-md p-2 focus:ring-burnt-orange-500 focus:border-burnt-orange-500"
                />
                <button onClick={handleSend} className="px-4 py-2 rounded bg-burnt-orange-700 text-white hover:bg-burnt-orange-800">Send</button>
            </div>
        </div>
    );
};

const PaymentManager: React.FC<{ 
    requisition: Requisition; 
    user: User;
    setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
}> = ({ requisition, user, setToast }) => {
    const { addPayment, markAsPaid } = useRequisitions();
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofLinks, setProofLinks] = useState<Record<string, string>>({});
    const [isLoadingLinks, setIsLoadingLinks] = useState(false);
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);

    useEffect(() => {
        const generateLinks = async () => {
            if (!requisition.payments || requisition.payments.length === 0) return;
            setIsLoadingLinks(true);
            const links: Record<string, string> = {};
            for (const p of requisition.payments) {
                if (p.proof_path) {
                    try {
                        const { data } = await supabase.storage.from('payment_proofs').createSignedUrl(p.proof_path, 3600); // 1 hour expiry
                        if (data) links[p.id] = data.signedUrl;
                    } catch (error) {
                        console.error(`Failed to get signed URL for ${p.proof_path}:`, error);
                    }
                }
            }
            setProofLinks(links);
            setIsLoadingLinks(false);
        };
        generateLinks();
    }, [requisition.payments]);

    const totalPaid = useMemo(() => (requisition.payments || []).reduce((sum, p) => sum + p.amount, 0), [requisition.payments]);
    const balance = requisition.total_estimated_cost - totalPaid;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setProofFile(e.target.files[0]);
        }
    };
    
    const handleAddPayment = async () => {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setToast({ message: "Please enter a valid amount.", type: 'error' });
            return;
        }
        if (numericAmount > balance) {
            setToast({ message: "Payment cannot exceed the outstanding balance.", type: 'error' });
            return;
        }
        setIsSubmittingPayment(true);
        setToast(null);
        try {
            await addPayment(requisition.id, { amount: numericAmount, date }, proofFile, user);
            setToast({ message: "Payment added successfully!", type: 'success' });
            setAmount('');
            setProofFile(null);
            if (document.getElementById('proof')) {
                (document.getElementById('proof') as HTMLInputElement).value = '';
            }
        } catch (error) {
            console.error(error);
            setToast({ message: `Failed to add payment: ${(error as Error).message}`, type: 'error' });
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    const handleMarkAsPaid = async () => {
        setIsMarkingPaid(true);
        setToast(null);
        try {
            await markAsPaid(requisition.id, user);
            setToast({ message: "Requisition marked as fully paid!", type: 'success' });
        } catch (error) {
            console.error(error);
            setToast({ message: `Failed to mark as paid: ${(error as Error).message}`, type: 'error' });
        } finally {
            setIsMarkingPaid(false);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-2 text-slate-800">Financial Overview</h3>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                    <p className="text-sm text-slate-500">Total Value</p>
                    <p className="text-xl font-bold text-slate-800">NGN {requisition.total_estimated_cost.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Total Paid</p>
                    <p className="text-xl font-bold text-green-600">NGN {totalPaid.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Balance</p>
                    <p className="text-xl font-bold text-red-600">NGN {balance.toLocaleString()}</p>
                </div>
            </div>

            {requisition.payments && requisition.payments.length > 0 && (
                <div className="mb-4">
                    <h4 className="font-semibold text-slate-700 mb-2">Payment History</h4>
                    <ul className="space-y-2 text-sm">
                        {(requisition.payments || []).map(p => (
                            <li key={p.id} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                <div>
                                    <span className="font-medium">NGN {p.amount.toLocaleString()}</span> on <span className="text-slate-600">{new Date(p.date).toLocaleDateString()}</span> by <span className="text-slate-600">{p.recordedByName}</span>
                                </div>
                                {p.proof_path && (
                                    proofLinks[p.id] ? <a href={proofLinks[p.id]} target="_blank" rel="noopener noreferrer" className="text-burnt-orange-600 hover:underline">View Proof</a> : <span className="text-slate-400">Loading link...</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {user.role === Role.ACCOUNTS && balance > 0 && (
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-slate-700 mb-2">Record a New Payment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                         <div className="col-span-1 md:col-span-1">
                            <label htmlFor="amount" className="block text-sm font-medium text-slate-700">Amount</label>
                            <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} placeholder={`Max NGN ${balance.toLocaleString()}`} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-300 focus:ring focus:ring-burnt-orange-200 focus:ring-opacity-50" />
                        </div>
                        <div className="col-span-1 md:col-span-1">
                            <label htmlFor="date" className="block text-sm font-medium text-slate-700">Date</label>
                            <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-300 focus:ring focus:ring-burnt-orange-200 focus:ring-opacity-50" />
                        </div>
                        <div className="col-span-1 md:col-span-1">
                            <button onClick={handleAddPayment} disabled={isSubmittingPayment || isMarkingPaid} className="w-full bg-burnt-orange-600 text-white py-2 px-4 rounded-md hover:bg-burnt-orange-700 disabled:bg-slate-400 disabled:cursor-wait">
                                {isSubmittingPayment ? 'Adding...' : 'Add Payment'}
                            </button>
                        </div>
                        <div className="col-span-1 md:col-span-3">
                           <label htmlFor="proof" className="block text-sm font-medium text-slate-700">Proof (PDF/Image)</label>
                           <input type="file" id="proof" onChange={handleFileChange} accept="application/pdf,image/*" className="mt-1 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-burnt-orange-50 file:text-burnt-orange-700 hover:file:bg-burnt-orange-100"/>
                        </div>
                    </div>
                </div>
            )}

            {balance === 0 && requisition.status !== RequisitionStatus.PAID && user.role === Role.ACCOUNTS && (
                <div className="mt-4 border-t pt-4">
                    <button onClick={handleMarkAsPaid} disabled={isSubmittingPayment || isMarkingPaid} className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-wait">
                        <CheckCircleIcon className="w-5 h-5"/> {isMarkingPaid ? 'Updating...' : 'Mark as Fully Paid'}
                    </button>
                </div>
            )}
        </div>
    );
};

const FinancialSummary: React.FC<{ requisitions: Requisition[] }> = ({ requisitions }) => {
    const { totalApproved, totalPaid, totalOutstanding } = useMemo(() => {
        let totalApproved = 0;
        let totalPaid = 0;
        
        const relevantStatuses = [
            RequisitionStatus.APPROVED, RequisitionStatus.PO_COMPLETED, RequisitionStatus.HISTOLOGY_APPROVED,
            RequisitionStatus.PAYMENT_PROCESSING, RequisitionStatus.PAID
        ];

        requisitions.forEach(req => {
            if (relevantStatuses.includes(req.status)) {
                totalApproved += req.total_estimated_cost;
                totalPaid += (req.payments || []).reduce((sum, p) => sum + p.amount, 0);
            }
        });

        return {
            totalApproved,
            totalPaid,
            totalOutstanding: totalApproved - totalPaid
        };
    }, [requisitions]);

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border col-span-1 md:col-span-3">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Financial Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                    <p className="text-sm text-slate-500">Total Value Approved</p>
                    <p className="text-2xl font-bold text-slate-800">NGN {totalApproved.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Total Paid Out</p>
                    <p className="text-2xl font-bold text-green-600">NGN {totalPaid.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-sm text-slate-500">Total Outstanding</p>
                    <p className="text-2xl font-bold text-red-600">NGN {totalOutstanding.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};

// --- View Components ---

const RequisitionListView: React.FC<{ onSelect: (req: Requisition) => void; onCreate: () => void }> = ({ onSelect, onCreate }) => {
    const { requisitions, fetchAllData } = useRequisitions();
    const { user } = useAuth();
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchAllData();
        } catch (e) {
            console.error("Manual refresh failed", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    const filteredRequisitions = useMemo(() => {
        return requisitions
            .filter(req => {
                if (filter === 'All') return true;
                if (filter === 'My Requisitions') return req.requester_id === user?.id;
                if (filter === 'Action Required') {
                    if (!user) return false;
                    // This logic needs to be rock-solid and match your workflow exactly.
                    switch(user.role) {
                        case Role.APPROVER: // This covers Chairman and Auditor
                            return [
                                RequisitionStatus.PENDING_APPROVAL,
                                RequisitionStatus.PENDING_CHAIRMAN_REVIEW,
                                RequisitionStatus.PENDING_AUDITOR_REVIEW,
                                RequisitionStatus.PENDING_FINAL_APPROVAL,
                                RequisitionStatus.PENDING_AUDITOR_APPROVAL,
                                RequisitionStatus.PENDING_CHAIRMAN_APPROVAL
                            ].includes(req.status);
                        case Role.PHARMACY_ADMIN:
                            return req.status === RequisitionStatus.PENDING_STORE_PRICING;
                        case Role.ACCOUNTS:
                            return [
                                RequisitionStatus.APPROVED,
                                RequisitionStatus.PO_COMPLETED,
                                RequisitionStatus.HISTOLOGY_APPROVED,
                                RequisitionStatus.PAYMENT_PROCESSING
                            ].includes(req.status);
                        case Role.LAB_ADMIN: // Can only create/resubmit
                             return (req.requester_id === user.id) && (req.status === RequisitionStatus.QUERIED || req.status === RequisitionStatus.REJECTED);
                        default: return false;
                    }
                }
                return req.status === filter;
            })
            .filter(req => {
                const search = searchTerm.toLowerCase();
                if (!search) return true;
                return (
                    req.id.toLowerCase().includes(search) ||
                    req.requesterName?.toLowerCase().includes(search) ||
                    req.department.toLowerCase().includes(search) ||
                    (req.items && req.items.some(i => i.name.toLowerCase().includes(search)))
                );
            });
    }, [requisitions, filter, searchTerm, user]);

    const getStatusChipColor = (status: RequisitionStatus) => {
        switch (status) {
            case RequisitionStatus.APPROVED:
            case RequisitionStatus.PO_COMPLETED:
            case RequisitionStatus.HISTOLOGY_APPROVED:
            case RequisitionStatus.PAID:
                return 'bg-green-100 text-green-800';
            case RequisitionStatus.PENDING_APPROVAL:
            case RequisitionStatus.PENDING_CHAIRMAN_REVIEW:
            case RequisitionStatus.PENDING_STORE_PRICING:
            case RequisitionStatus.PENDING_AUDITOR_REVIEW:
            case RequisitionStatus.PENDING_FINAL_APPROVAL:
            case RequisitionStatus.PENDING_AUDITOR_APPROVAL:
            case RequisitionStatus.PENDING_CHAIRMAN_APPROVAL:
                return 'bg-yellow-100 text-yellow-800';
            case RequisitionStatus.QUERIED:
                return 'bg-blue-100 text-blue-800';
            case RequisitionStatus.REJECTED:
                return 'bg-red-100 text-red-800';
            case RequisitionStatus.PAYMENT_PROCESSING:
                return 'bg-indigo-100 text-indigo-800';
            default:
                return 'bg-slate-100 text-slate-800';
        }
    };

    const statusOptions = ['All', 'My Requisitions', 'Action Required', ...Object.values(RequisitionStatus)];
    const canCreateRequisition = user?.role === Role.LAB_ADMIN || user?.role === Role.PHARMACY_ADMIN;

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full md:w-1/2 lg:w-1/3">
                    <input
                        type="text"
                        placeholder="Search by ID, requester, item..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange-500"
                    />
                </div>
                <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4">
                     <select
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-burnt-orange-500"
                    >
                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                     <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-slate-700 px-4 py-2 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors disabled:bg-slate-200 disabled:cursor-wait"
                    >
                        <ArrowPathIcon className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? 'Refreshing' : 'Refresh'}</span>
                    </button>
                    {canCreateRequisition && (
                        <button
                            onClick={onCreate}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-burnt-orange-700 text-white px-4 py-2 rounded-md hover:bg-burnt-orange-800 transition-colors"
                        >
                            <PlusIcon className="w-5 h-5" />
                            <span>New Requisition</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white shadow-sm border rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Requester</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Cost</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {filteredRequisitions.map(req => (
                            <tr key={req.id} onClick={() => onSelect(req)} className="hover:bg-slate-50 cursor-pointer">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 truncate" style={{ maxWidth: '100px' }}>{req.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{req.requesterName}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{req.type.replace('_', ' ')}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusChipColor(req.status)}`}>
                                        {req.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">NGN {req.total_estimated_cost.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{new Date(req.created_at).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const RequisitionDetailView: React.FC<{ requisition: Requisition; onBack: () => void; onEdit: (req: Requisition) => void }> = ({ requisition, onBack, onEdit }) => {
    const { updateRequisitionStatus, addMessage, updatePurchaseOrder } = useRequisitions();
    const { user } = useAuth();
    const [updatedItems, setUpdatedItems] = useState<RequisitionItem[]>(requisition.items || []);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [actionToConfirm, setActionToConfirm] = useState<{ action: string, logAction: ApprovalLog['action'], nextStatus?: RequisitionStatus, queryTarget?: 'Lab' | 'Pharmacy' } | null>(null);

    useEffect(() => {
        setUpdatedItems(requisition.items || []);
    }, [requisition]);

    const handleItemChange = (id: string, field: keyof RequisitionItem, value: any) => {
        setUpdatedItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    
    const handleActionClick = (action: string, logAction: ApprovalLog['action'], nextStatus?: RequisitionStatus, queryTarget?: 'Lab' | 'Pharmacy') => {
        if (action === "Price & Submit to Auditor") {
            // Special handling for pricing, as it uses a different context function
            setActionToConfirm({ action, logAction });
        } else {
             setActionToConfirm({ action, logAction, nextStatus, queryTarget });
        }
    };

    const handleSign = async (signature: string, comment?: string) => {
        if (!actionToConfirm) return;

        setIsSubmitting(true);
        setToast(null);

        try {
            if (actionToConfirm.action === "Price & Submit to Auditor") {
                await updatePurchaseOrder(requisition.id, updatedItems, user!, signature);
            } else {
                if (!actionToConfirm.nextStatus) {
                    throw new Error("Action configuration error: nextStatus is missing.");
                }
                await updateRequisitionStatus(requisition.id, actionToConfirm.nextStatus, user!, signature, comment, { queryTarget: actionToConfirm.queryTarget, logAction: actionToConfirm.logAction });
            }
            
            setToast({ message: 'Action completed! Returning to dashboard...', type: 'success' });
            setActionToConfirm(null); // Close the modal

            setTimeout(() => {
                onBack();
            }, 1500);

        } catch (error: any) {
            console.error("Action failed:", error);
            let errorMessage = "An unexpected error occurred.";
            if (error.message && error.message.includes('violates row-level security policy')) {
                errorMessage = "Permission Denied. Your role does not allow this action at the current stage.";
            } else if (error.message) {
                errorMessage = error.message;
            }
            setToast({ message: `Action failed: ${errorMessage}`, type: 'error' });
            // Only keep modal open on error if we want the user to retry.
            // setActionToConfirm(null); // Optionally close modal on error too.
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendMessage = async (text: string) => {
        try {
            await addMessage(requisition.id, text, user!);
        } catch(e) {
            console.error(e);
            setToast({ message: 'Failed to send message.', type: 'error' });
        }
    };

    const totalCost = useMemo(() => {
        if (requisition.type === RequisitionType.PURCHASE_ORDER && requisition.status === RequisitionStatus.PENDING_STORE_PRICING) {
            return updatedItems.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0);
        }
        return requisition.total_estimated_cost;
    }, [updatedItems, requisition]);

    const ActionButtons: React.FC = () => {
        if (!user) return null;
    
        const isRequester = requisition.requester_id === user.id;
        const { role } = user;
        const { status } = requisition;
    
        // Common Actions
        if ((isRequester && (status === RequisitionStatus.QUERIED || status === RequisitionStatus.REJECTED))) {
            return <button onClick={() => onEdit(requisition)} className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 flex items-center gap-2"><PencilSquareIcon className="w-5 h-5"/> Edit & Resubmit</button>;
        }
    
        // Role & Status based Actions
        switch (role) {
            case Role.APPROVER: // Chairman and Auditor
                const isChairman = user.name === 'Chairman';
                const isAuditor = user.name === 'Auditor';
                return (
                    <div className="flex flex-wrap gap-2">
                        {(isChairman && [RequisitionStatus.PENDING_CHAIRMAN_REVIEW, RequisitionStatus.PENDING_FINAL_APPROVAL, RequisitionStatus.PENDING_CHAIRMAN_APPROVAL].includes(status)) ||
                         (isAuditor && [RequisitionStatus.PENDING_AUDITOR_REVIEW, RequisitionStatus.PENDING_AUDITOR_APPROVAL].includes(status)) ||
                         (status === RequisitionStatus.PENDING_APPROVAL) ? (
                            <>
                                <button onClick={() => handleActionClick('Approve', 'Approved', 
                                    status === RequisitionStatus.PENDING_CHAIRMAN_REVIEW ? RequisitionStatus.PENDING_STORE_PRICING :
                                    status === RequisitionStatus.PENDING_AUDITOR_REVIEW ? RequisitionStatus.PENDING_FINAL_APPROVAL :
                                    status === RequisitionStatus.PENDING_FINAL_APPROVAL ? RequisitionStatus.PO_COMPLETED :
                                    status === RequisitionStatus.PENDING_AUDITOR_APPROVAL ? RequisitionStatus.PENDING_CHAIRMAN_APPROVAL :
                                    status === RequisitionStatus.PENDING_CHAIRMAN_APPROVAL ? RequisitionStatus.HISTOLOGY_APPROVED :
                                    RequisitionStatus.APPROVED
                                )} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"><CheckCircleIcon className="w-5 h-5"/> Approve</button>
                                <button onClick={() => handleActionClick('Query', 'Queried', RequisitionStatus.QUERIED, requisition.department)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"><QuestionMarkCircleIcon className="w-5 h-5"/> Query</button>
                                <button onClick={() => handleActionClick('Reject', 'Rejected', RequisitionStatus.REJECTED)} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2"><XCircleIcon className="w-5 h-5"/> Reject</button>
                            </>
                        ) : null}
                    </div>
                );
    
            case Role.PHARMACY_ADMIN:
                if (status === RequisitionStatus.PENDING_STORE_PRICING) {
                    return <button onClick={() => handleActionClick("Price & Submit to Auditor", 'Priced')} className="bg-burnt-orange-700 text-white px-4 py-2 rounded-md hover:bg-burnt-orange-800">Price & Submit to Auditor</button>;
                }
                return null;
    
            case Role.ACCOUNTS:
                if ([RequisitionStatus.APPROVED, RequisitionStatus.PO_COMPLETED, RequisitionStatus.HISTOLOGY_APPROVED, RequisitionStatus.PAYMENT_PROCESSING].includes(status)) {
                    return <div className="text-green-700 font-semibold flex items-center gap-2"><BanknotesIcon className="w-5 h-5"/> Ready for payment processing.</div>;
                }
                return null;
    
            default:
                return null;
        }
    };
    

    const Timeline: React.FC<{ logs: ApprovalLog[] }> = ({ logs }) => {
        const getIconForAction = (action: ApprovalLog['action']) => {
            switch (action) {
                case 'Submitted':
                case 'Resubmitted':
                    return <PlusIcon className="w-5 h-5 text-blue-500" />;
                case 'Approved':
                case 'Reviewed':
                case 'Priced':
                case 'Marked as Paid':
                    return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
                case 'Queried':
                    return <QuestionMarkCircleIcon className="w-5 h-5 text-yellow-500" />;
                case 'Rejected':
                    return <XCircleIcon className="w-5 h-5 text-red-500" />;
                case 'Payment Added':
                     return <BanknotesIcon className="w-5 h-5 text-indigo-500" />;
                default:
                    return <DocumentTextIcon className="w-5 h-5 text-slate-500" />;
            }
        };

        return (
            <div className="flow-root">
                <ul className="-mb-8">
                    {logs.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((log, logIdx) => (
                        <li key={log.id}>
                            <div className="relative pb-8">
                                {logIdx !== logs.length - 1 ? (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                                ) : null}
                                <div className="relative flex space-x-3">
                                    <div>
                                        <span className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center ring-8 ring-white">
                                            {getIconForAction(log.action)}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                        <div>
                                            <p className="text-sm text-slate-600">
                                                <span className="font-medium text-slate-900">{log.userName || 'System'}</span> {log.action.toLowerCase()} the requisition.
                                            </p>
                                            {log.comment && <p className="text-sm text-slate-500 mt-1 italic">"{log.comment}"</p>}
                                        </div>
                                        <div className="text-right text-sm whitespace-nowrap text-slate-500">
                                            <time dateTime={log.timestamp}>{new Date(log.timestamp).toLocaleString()}</time>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    const renderItemsTable = () => {
        const isPricing = user?.role === Role.PHARMACY_ADMIN && requisition.status === RequisitionStatus.PENDING_STORE_PRICING;

        if (requisition.type === RequisitionType.HISTOLOGY_PAYMENT) {
            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                {['Date', 'Patient Name', 'Hosp. No', 'Lab. No', 'Receipt/HMO', 'Service', 'Outsource Bills', 'ZMC Charge', 'Retainership'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {(requisition.histologyItems || []).map(item => (
                                <tr key={item.id}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">{new Date(item.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">{item.patient_name}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">{item.hospital_no}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">{item.lab_no}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">{item.receipt_no}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">{item.outsource_service}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">NGN {item.outsource_bills.toLocaleString()}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">NGN {item.zmc_charge.toLocaleString()}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">{item.retainership}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }
        
        return (
            <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Item Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Supplier</th>
                            {requisition.type === RequisitionType.PURCHASE_ORDER && <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Stock Level</th>}
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{isPricing ? "Unit Price" : "Est. Unit Cost"}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Cost</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {(isPricing ? updatedItems : (requisition.items || [])).map(item => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.description}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.supplier}</td>
                                {requisition.type === RequisitionType.PURCHASE_ORDER && <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.stock_level}</td>}
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.quantity}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {isPricing ? (
                                        <input type="number" value={item.unit_price || ''} onChange={e => handleItemChange(item.id, 'unit_price', parseFloat(e.target.value))} className="w-24 p-1 border rounded" />
                                    ) : `NGN ${(item.unit_price || item.estimated_unit_cost || 0).toLocaleString()}`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">NGN {
                                    (item.quantity * ((isPricing ? item.unit_price : (item.unit_price || item.estimated_unit_cost)) || 0)).toLocaleString()
                                }</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <SignatureModal isOpen={!!actionToConfirm} onClose={() => { setActionToConfirm(null); setIsSubmitting(false); }} onSign={handleSign} action={actionToConfirm?.action || ''} isSubmitting={isSubmitting} />

            <div>
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800">
                    <ArrowLeftIcon className="w-5 h-5" />
                    Back to List
                </button>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6 pb-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{requisition.type.replace('_', ' ')}</h2>
                        <p className="text-sm text-slate-500">ID: {requisition.id}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <ActionButtons />
                        <button onClick={() => generatePdf(requisition)} className="bg-slate-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 flex items-center gap-2">
                           <DownloadIcon className="w-5 h-5"/> Download PDF
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div><span className="font-semibold">Requester:</span> {requisition.requesterName}</div>
                    <div><span className="font-semibold">Department:</span> {requisition.department}</div>
                    <div><span className="font-semibold">Status:</span> <span className="font-bold text-blue-700">{requisition.status}</span></div>
                    <div><span className="font-semibold">Created:</span> {new Date(requisition.created_at).toLocaleString()}</div>
                    <div><span className="font-semibold">Last Updated:</span> {new Date(requisition.updated_at).toLocaleString()}</div>
                    <div className="text-lg font-bold"><span className="font-semibold">Total:</span> NGN {totalCost.toLocaleString()}</div>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-4 text-slate-800">Items</h3>
                        {renderItemsTable()}
                    </div>
                    
                    {[RequisitionStatus.APPROVED, RequisitionStatus.PO_COMPLETED, RequisitionStatus.HISTOLOGY_APPROVED, RequisitionStatus.PAYMENT_PROCESSING, RequisitionStatus.PAID].includes(requisition.status) && (
                        <PaymentManager requisition={requisition} user={user!} setToast={setToast} />
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         <div className="bg-white p-4 rounded-lg border">
                             <h3 className="text-lg font-semibold mb-4 text-slate-800">Approval History</h3>
                             <Timeline logs={requisition.log || []} />
                         </div>
                        <ConversationPanel requisition={requisition} currentUser={user!} onSendMessage={handleSendMessage} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const CreateRequisitionView: React.FC<{ onBack: () => void, editRequisition?: Requisition | null }> = ({ onBack, editRequisition }) => {
    const { addRequisition, addPurchaseOrder, addHistologyRequisition, resubmitRequisition, processInvoiceWithAI } = useRequisitions();
    const { user } = useAuth();
    
    const [type, setType] = useState<RequisitionType>(editRequisition?.type || RequisitionType.STANDARD);
    const [items, setItems] = useState<Partial<RequisitionItem>[]>([]);
    const [histologyItems, setHistologyItems] = useState<Partial<HistologyItem>[]>([]);
    const [signatures, setSignatures] = useState<Requisition['signatures']>({});
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editRequisition) {
            setItems(editRequisition.items ? JSON.parse(JSON.stringify(editRequisition.items)) : [{ name: '', quantity: 1, description: '', supplier: '', estimated_unit_cost: 0, stock_level: 0, unit_price: 0 }]);
            setHistologyItems(editRequisition.histologyItems ? JSON.parse(JSON.stringify(editRequisition.histologyItems)) : [{ date: new Date().toISOString().split('T')[0], patient_name: '', hospital_no: '', lab_no: '', receipt_no: '', outsource_service: '', outsource_bills: 0, zmc_charge: 0, retainership: '' }]);
        } else {
            setItems([{ name: '', quantity: 1, description: '', supplier: '', estimated_unit_cost: 0, stock_level: 0, unit_price: 0 }]);
            setHistologyItems([{ date: new Date().toISOString().split('T')[0], patient_name: '', hospital_no: '', lab_no: '', receipt_no: '', outsource_service: '', outsource_bills: 0, zmc_charge: 0, retainership: '' }]);
        }
    }, [editRequisition]);

    const availableRequisitionTypes = useMemo(() => {
        if (user?.department === 'Pharmacy') {
            return Object.values(RequisitionType).filter(t => t !== RequisitionType.HISTOLOGY_PAYMENT);
        }
        return Object.values(RequisitionType);
    }, [user]);

    const handleItemChange = (index: number, field: keyof RequisitionItem, value: any) => {
        const updatedItems = [...items];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setItems(updatedItems);
    };

    const handleHistologyItemChange = (index: number, field: keyof HistologyItem, value: any) => {
        const updatedItems = [...histologyItems];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setHistologyItems(updatedItems);
    };

    const addItem = () => {
        if (type === RequisitionType.HISTOLOGY_PAYMENT) {
            setHistologyItems([...histologyItems, { date: new Date().toISOString().split('T')[0], patient_name: '', hospital_no: '', lab_no: '', receipt_no: '', outsource_service: '', outsource_bills: 0, zmc_charge: 0, retainership: '' }]);
        } else {
            setItems([...items, { name: '', quantity: 1, description: '', supplier: '', estimated_unit_cost: 0, stock_level: 0, unit_price: 0 }]);
        }
    };

    const removeItem = (index: number) => {
         if (type === RequisitionType.HISTOLOGY_PAYMENT) {
            setHistologyItems(histologyItems.filter((_, i) => i !== index));
        } else {
            setItems(items.filter((_, i) => i !== index));
        }
    };
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsAiLoading(true);
        setToast(null);
        try {
            const extractedItems = await processInvoiceWithAI(file);
            setItems(extractedItems);
            setType(RequisitionType.PURCHASE_ORDER);
            setToast({ message: 'Invoice processed successfully!', type: 'success' });
        } catch (error) {
            console.error(error);
            setToast({ message: (error as Error).message, type: 'error' });
        } finally {
            setIsAiLoading(false);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        // --- Validation for NEW requisitions only ---
        if (!editRequisition) {
            if (user.role === Role.LAB_ADMIN && type === RequisitionType.PURCHASE_ORDER && (!signatures?.preparedBy || !signatures.levelConfirmedBy)) {
                setToast({ message: 'Both "Prepared By" and "Level Confirmed By" signatures are required for Lab Purchase Orders.', type: 'error' });
                return;
            }
            if (type === RequisitionType.HISTOLOGY_PAYMENT && !signatures?.preparedBy) {
                setToast({ message: '"Prepared By" signature is required for Histology Payments.', type: 'error' });
                return;
            }
        }

        setIsSubmitting(true);
        setToast(null);

        try {
            if (editRequisition) {
                // Handle resubmission logic
                const updatePayload: any = {};
                if (type === RequisitionType.HISTOLOGY_PAYMENT) {
                     updatePayload.histologyItems = histologyItems as Omit<HistologyItem, 'id' | 'requisition_id'>[];
                } else {
                     updatePayload.items = items as Omit<RequisitionItem, 'id' | 'requisition_id'>[];
                }
                await resubmitRequisition(editRequisition, updatePayload, user);
            } else {
                // Handle new submission logic
                if (type === RequisitionType.STANDARD) {
                    await addRequisition(items as Omit<RequisitionItem, 'id' | 'requisition_id'>[], user);
                } else if (type === RequisitionType.PURCHASE_ORDER) {
                    await addPurchaseOrder(items as Omit<RequisitionItem, 'id' | 'requisition_id'>[], user, signatures);
                } else if (type === RequisitionType.HISTOLOGY_PAYMENT) {
                    await addHistologyRequisition(histologyItems as Omit<HistologyItem, 'id'|'requisition_id'>[], user, signatures);
                }
            }
            setToast({ message: `Requisition ${editRequisition ? 'resubmitted' : 'created'} successfully!`, type: 'success' });
            setTimeout(onBack, 1500);
        } catch (error) {
            console.error(error);
            setToast({ message: `Failed to ${editRequisition ? 'resubmit' : 'create'} requisition: ${(error as Error).message}`, type: 'error' });
            setIsSubmitting(false);
        }
    };

    const renderFormFields = () => {
        if (type === RequisitionType.HISTOLOGY_PAYMENT) {
            return (
                 <div className="space-y-4">
                    <div className="overflow-x-auto bg-slate-50 p-2 rounded-lg">
                        <div className="min-w-max">
                            {/* Headers */}
                            <div className="grid grid-cols-10 gap-2 font-semibold text-xs text-slate-600 px-2 pb-2 border-b">
                                <div className="col-span-1">Date</div>
                                <div className="col-span-2">Patient Name</div>
                                <div className="col-span-1">Hosp. No</div>
                                <div className="col-span-1">Lab. No</div>
                                <div className="col-span-1">Receipt/HMO</div>
                                <div className="col-span-1">Service</div>
                                <div className="col-span-1">Outsource Bills</div>
                                <div className="col-span-1">ZMC Charge</div>
                                <div className="col-span-1">Retainership</div>
                            </div>
                            {/* Items */}
                            {histologyItems.map((item, index) => (
                                <div key={index} className="grid grid-cols-10 gap-2 items-center mt-2 px-2">
                                    <input type="date" value={item.date} onChange={e => handleHistologyItemChange(index, 'date', e.target.value)} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input placeholder="Name" value={item.patient_name} onChange={e => handleHistologyItemChange(index, 'patient_name', e.target.value)} className="col-span-2 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input placeholder="Hosp. No" value={item.hospital_no} onChange={e => handleHistologyItemChange(index, 'hospital_no', e.target.value)} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input placeholder="Lab. No" value={item.lab_no} onChange={e => handleHistologyItemChange(index, 'lab_no', e.target.value)} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input placeholder="Receipt" value={item.receipt_no} onChange={e => handleHistologyItemChange(index, 'receipt_no', e.target.value)} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input placeholder="Service" value={item.outsource_service} onChange={e => handleHistologyItemChange(index, 'outsource_service', e.target.value)} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input type="number" placeholder="Bills" value={item.outsource_bills} onChange={e => handleHistologyItemChange(index, 'outsource_bills', parseFloat(e.target.value))} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input type="number" placeholder="Charge" value={item.zmc_charge} onChange={e => handleHistologyItemChange(index, 'zmc_charge', parseFloat(e.target.value))} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    <input placeholder="Retainership" value={item.retainership} onChange={e => handleHistologyItemChange(index, 'retainership', e.target.value)} className="col-span-1 w-full border-slate-300 rounded-md shadow-sm text-sm p-1"/>
                                    {histologyItems.length > 1 && <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 -ml-2"><XCircleIcon className="w-5 h-5"/></button>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button type="button" onClick={addItem} className="text-sm font-semibold text-burnt-orange-700 hover:underline">Add another item</button>
                </div>
            );
        }
        
        return (
             <div className="space-y-4">
                {items.map((item, index) => (
                    <div key={index} className="bg-slate-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-12 gap-4 items-end relative">
                        <div className="col-span-12 md:col-span-3">
                            <label className="block text-sm font-medium text-slate-700">Item Name</label>
                            <input type="text" placeholder="e.g. Paracetamol" required value={item.name} onChange={e => handleItemChange(index, 'name', e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-500 focus:ring-burnt-orange-500" />
                        </div>
                        <div className="col-span-12 md:col-span-5">
                            <label className="block text-sm font-medium text-slate-700">Description</label>
                            <input type="text" placeholder="e.g. 500mg, 10 strips" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-500 focus:ring-burnt-orange-500" />
                        </div>
                         <div className="col-span-6 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Quantity</label>
                            <input type="number" min="1" required value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value, 10))} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-500 focus:ring-burnt-orange-500" />
                        </div>
                        {type === RequisitionType.PURCHASE_ORDER && (
                            <>
                                 <div className="col-span-6 md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700">Stock Level</label>
                                    <input type="number" value={item.stock_level} onChange={e => handleItemChange(index, 'stock_level', parseInt(e.target.value, 10))} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-500 focus:ring-burnt-orange-500" />
                                </div>
                                <div className="col-span-12 md:col-span-4">
                                    <label className="block text-sm font-medium text-slate-700">Supplier</label>
                                    <input type="text" placeholder="e.g. Zolon" value={item.supplier} onChange={e => handleItemChange(index, 'supplier', e.target.value)} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-500 focus:ring-burnt-orange-500" />
                                </div>
                                {user?.department === 'Pharmacy' && (
                                     <div className="col-span-6 md:col-span-3">
                                        <label className="block text-sm font-medium text-slate-700">Unit Price</label>
                                        <input type="number" placeholder="Price from store" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', parseFloat(e.target.value))} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-500 focus:ring-burnt-orange-500" />
                                    </div>
                                )}
                            </>
                        )}
                        {type === RequisitionType.STANDARD && (
                             <div className="col-span-6 md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700">Est. Cost</label>
                                <input type="number" value={item.estimated_unit_cost} onChange={e => handleItemChange(index, 'estimated_unit_cost', parseFloat(e.target.value))} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-burnt-orange-500 focus:ring-burnt-orange-500" />
                            </div>
                        )}
                         {items.length > 1 && (
                            <div className="col-span-12 md:col-span-1 flex items-end justify-end">
                                <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><XCircleIcon className="w-6 h-6"/></button>
                            </div>
                         )}
                    </div>
                ))}
                 <button type="button" onClick={addItem} className="text-sm font-semibold text-burnt-orange-700 hover:underline">Add another item</button>
            </div>
        );
    };

    const handleSignatureSave = (key: keyof Requisition['signatures'], data: string) => {
        setSignatures(prev => ({ ...prev, [key]: { name: user!.name, signature: data, timestamp: new Date().toISOString() } }));
    };

    const renderSignatureSection = () => {
        const showPreparedBy = type === RequisitionType.PURCHASE_ORDER || type === RequisitionType.HISTOLOGY_PAYMENT;
        const showLevelConfirmedBy = type === RequisitionType.PURCHASE_ORDER && user?.role === Role.LAB_ADMIN;

        if (!showPreparedBy && !showLevelConfirmedBy) return null;

        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border mt-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4">Signatures</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {showPreparedBy && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Prepared By</label>
                            {signatures?.preparedBy ? (
                                <div className="border p-2 rounded-md bg-slate-50">
                                    <img src={signatures.preparedBy.signature} alt="Signature" className="h-16 w-auto" />
                                    <p className="text-sm mt-1">{signatures.preparedBy.name} @ {new Date(signatures.preparedBy.timestamp).toLocaleTimeString()}</p>
                                </div>
                            ) : (
                                <SignaturePadComponent onSave={(data) => handleSignatureSave('preparedBy', data)} onClear={() => setSignatures(prev => ({...prev, preparedBy: undefined}))} />
                            )}
                        </div>
                    )}
                    {showLevelConfirmedBy && (
                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Level Confirmed By</label>
                            {signatures?.levelConfirmedBy ? (
                                <div className="border p-2 rounded-md bg-slate-50">
                                    <img src={signatures.levelConfirmedBy.signature} alt="Signature" className="h-16 w-auto" />
                                    <p className="text-sm mt-1">{signatures.levelConfirmedBy.name} @ {new Date(signatures.levelConfirmedBy.timestamp).toLocaleTimeString()}</p>
                                </div>
                            ) : (
                                <SignaturePadComponent onSave={(data) => handleSignatureSave('levelConfirmedBy', data)} onClear={() => setSignatures(prev => ({...prev, levelConfirmedBy: undefined}))}/>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
             {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div>
                <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800">
                    <ArrowLeftIcon className="w-5 h-5" />
                    Back to List
                </button>
            </div>
            <form onSubmit={handleSubmit}>
                 <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 pb-6 border-b">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">{editRequisition ? `Edit Requisition #${editRequisition.id.substring(0, 8)}` : 'Create New Requisition'}</h2>
                            <p className="text-slate-500">Logged in as {user?.name} ({user?.role})</p>
                        </div>
                        {type === RequisitionType.PURCHASE_ORDER && !editRequisition && (
                            <div>
                                 <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" className="hidden" />
                                 <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAiLoading} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-slate-400">
                                    <UploadIcon className="w-5 h-5"/>
                                    {isAiLoading ? 'Analyzing...' : 'Upload Invoice (AI)'}
                                 </button>
                            </div>
                        )}
                    </div>
                    
                     {!editRequisition && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Requisition Type</label>
                            <div className="flex flex-wrap gap-4">
                                {availableRequisitionTypes.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setType(t)}
                                        className={`px-4 py-2 rounded-full text-sm font-semibold border ${type === t ? 'bg-burnt-orange-700 text-white border-burnt-orange-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {t.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {renderFormFields()}

                 </div>
                 
                 {!editRequisition && renderSignatureSection()}

                 <div className="mt-6 flex justify-end">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-burnt-orange-700 text-white px-6 py-3 rounded-md hover:bg-burnt-orange-800 transition-colors disabled:bg-slate-400"
                    >
                         {isSubmitting ? 'Submitting...' : (editRequisition ? 'Resubmit Requisition' : 'Submit Requisition')}
                    </button>
                 </div>
            </form>
        </div>
    );
};

// --- Main Dashboard Component ---

export const DashboardScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const { requisitions, markNotificationAsRead } = useRequisitions();
    const [currentView, setCurrentView] = useState<'list' | 'create' | 'detail' | 'edit'>('list');
    const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

    const handleSelectRequisition = (req: Requisition) => {
        setSelectedRequisition(req);
        setCurrentView('detail');
    };
    
    const handleSelectFromNotification = (notification: Notification) => {
        const req = requisitions.find(r => r.id === notification.requisition_id);
        if (req) {
            handleSelectRequisition(req);
        }
        markNotificationAsRead(notification.id);
    };

    const handleCreate = () => {
        setSelectedRequisition(null);
        setCurrentView('create');
    };
    
    const handleEdit = (req: Requisition) => {
        setSelectedRequisition(req);
        setCurrentView('create'); // The create view handles both creating and editing
    };

    const handleBack = () => {
        setSelectedRequisition(null);
        setCurrentView('list');
    };

    const renderContent = () => {
        switch (currentView) {
            case 'create':
                return <CreateRequisitionView onBack={handleBack} editRequisition={selectedRequisition} />;
            case 'edit': // This case is now effectively handled by 'create'
                 return <CreateRequisitionView onBack={handleBack} editRequisition={selectedRequisition} />;
            case 'detail':
                return selectedRequisition && <RequisitionDetailView requisition={selectedRequisition} onBack={handleBack} onEdit={handleEdit}/>;
            case 'list':
            default:
                const showFinancials = user?.role === Role.ACCOUNTS || (user?.role === Role.APPROVER && (user.name === "Chairman" || user.name === "Auditor"));
                return (
                    <div className="space-y-6">
                        {showFinancials && <FinancialSummary requisitions={requisitions} />}
                        <RequisitionListView onSelect={handleSelectRequisition} onCreate={handleCreate} />
                    </div>
                );
        }
    };

    if (!user) {
        return <div>Loading user...</div>; // Should not happen if App routing is correct
    }

    return (
        <div className="bg-cream-50 min-h-screen">
            <Header user={user} onLogout={logout} onSelectNotification={handleSelectFromNotification} />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {renderContent()}
            </main>
        </div>
    );
};
