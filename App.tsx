import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { db } from './services/liveDatabase';
import { authService } from './services/authService';
import { Requisition, Status, User, AuditLog, RequisitionItem, Attachment, Notification, UserRole, PaymentRecord } from './types';
import { StatusBadge, PriorityBadge } from './components/StatusBadge';
import { RequisitionModal } from './components/RequisitionModal';
import { RequestDetailsModal } from './components/RequestDetailsModal';
import { ReportsDashboard } from './components/ReportsDashboard';
import { LoginScreen } from './components/LoginScreen';
import { ICONS } from './constants';

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Feedback State (Toast)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [filterStatus, setFilterStatus] = useState<string>('All'); // 'All', 'Pending', 'Approved', 'Action Required'
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, cost: 0 });

  useEffect(() => {
    // Check for logged in user
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setAuthLoading(false);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await db.getRequisitions();
    setRequisitions(data);
    const statData = await db.getStats();
    setStats(statData);
    
    if (user) {
        const notifs = await db.getNotifications(user.email);
        setNotifications(notifs);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchData();
      // Poll for notifications every 10s
      const interval = setInterval(async () => {
           const notifs = await db.getNotifications(user.email);
           setNotifications(notifs);
      }, 10000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  const handleNotificationClick = async (notif: Notification) => {
      await db.markNotificationAsRead(notif.id);
      // Refresh notifications
      if (user) {
          const notifs = await db.getNotifications(user.email);
          setNotifications(notifs);
      }

      if (notif.relatedRequisitionId) {
          const req = requisitions.find(r => r.id === notif.relatedRequisitionId);
          if (req) {
              setSelectedRequisition(req);
              setActiveTab('requisitions');
          }
      }
  };

  // Helper to generate notification
  const sendNotification = async (toEmail: string, title: string, message: string, relatedReqId: string, type: 'info'|'success'|'warning'|'error' = 'info') => {
      const newNotif: Notification = {
          id: `notif-${Date.now()}-${Math.random()}`,
          recipientEmail: toEmail,
          title,
          message,
          date: new Date().toISOString(),
          read: false,
          relatedRequisitionId: relatedReqId,
          type
      };
      await db.addNotification(newNotif);
  };

  const sanitizeItem = (item: any): RequisitionItem => {
      // Helper to force number
      const getNum = (val: any) => {
          if (val === '' || val === null || val === undefined) return 0;
          const n = Number(val);
          return isNaN(n) ? 0 : n;
      };

      return {
        ...item,
        stockLevel: getNum(item.stockLevel),
        unitCost: getNum(item.unitCost),
        quantity: getNum(item.quantity) || 1, // Default to 1 if 0
        estimatedCost: getNum(item.estimatedCost),
        supplier: item.supplier || '',
        // Ensure other fields are safe
        retainership: getNum(item.retainership),
        zmcCharge: getNum(item.zmcCharge),
      };
  };

  const handleCreateRequisition = async (data: any) => {
    const isEdit = !!data.id;
    
    // Determine Start Status based on type
    let initialStatus = Status.PENDING_CHAIRMAN_REVIEW;
    let notifyTargetEmail = 'chairmanzankli@gmail.com'; // Default first approver
    
    if (data.type === 'Equipment Request') {
        initialStatus = Status.PENDING_FINAL_APPROVAL; // Goes directly to Chairman
        notifyTargetEmail = 'chairmanzankli@gmail.com';
    } else if (data.type === 'Outsourced Histology Payment' || data.type === 'Pharmacy Purchase Order' || data.type === 'Emergency Request (1 week)') {
        initialStatus = Status.PENDING_AUDIT_REVIEW; // Goes directly to Audit 1
        notifyTargetEmail = 'auditorzankli@gmail.com';
    } else if (data.type === 'Emergency Request (1 month)') {
        initialStatus = Status.PENDING_AUDIT_2_REVIEW; // Goes to Audit 2 first
        notifyTargetEmail = 'auditor2zankli@gmail.com';
    } else if (data.type === 'Lab Purchase Order') {
        // Lab PO goes to Chairman first
         notifyTargetEmail = 'chairmanzankli@gmail.com';
    }

    // Sanitize items to ensure all fields are present and valid numbers
    const sanitizedItems = (data.items || []).map(sanitizeItem);

    try {
        if (isEdit) {
             // Handle Resubmission logic
             const updatedReq = {
                 ...selectedRequisition!, // Retain original ID and other fields
                 ...data, // Overwrite with form data
                 id: data.id, // Explicitly ensure ID is preserved
                 items: sanitizedItems, // Use sanitized items
                 status: initialStatus, // Reset status on resubmit
                 auditTrail: [
                     ...selectedRequisition!.auditTrail,
                     {
                         id: `log-${Date.now()}`,
                         date: new Date().toISOString(),
                         userName: user!.name,
                         userRole: user!.role,
                         action: 'Updated',
                         comment: 'Resubmitted by user.',
                         signature: data.signature
                     } as AuditLog
                 ]
             };
             
             await db.addRequisition(updatedReq); 
             // Notify next approver
             await sendNotification(notifyTargetEmail, 'Request Resubmitted', `${user!.name} has resubmitted request ${updatedReq.id}.`, updatedReq.id);
             showToast('Request updated and resubmitted successfully!', 'success');

        } else {
            // Ensure generated ID is not overwritten
            const { id: _ignore, ...reqData } = data;
            const baseId = `REQ-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`;

            // Split Logic for Equipment Request AND Pharmacy Purchase Order (if creating new)
            let hasMultipleSuppliers = false;
            const itemsBySupplier: Record<string, RequisitionItem[]> = {};
            
            if (data.type === 'Equipment Request' || data.type === 'Pharmacy Purchase Order') {
                 sanitizedItems.forEach((item: RequisitionItem) => {
                    const supp = item.supplier || 'Unassigned';
                    if (!itemsBySupplier[supp]) itemsBySupplier[supp] = [];
                    itemsBySupplier[supp].push(item);
                 });
                 if (Object.keys(itemsBySupplier).length > 1) hasMultipleSuppliers = true;
            }

            if (hasMultipleSuppliers) {
                 const suppliers = Object.keys(itemsBySupplier);
                 for (let i = 0; i < suppliers.length; i++) {
                     const supp = suppliers[i];
                     const subItems = itemsBySupplier[supp];
                     const subTotal = subItems.reduce((sum, item) => sum + ((item.unitCost || item.estimatedCost || 0) * item.quantity), 0);
                     
                     const newReq: Requisition = {
                        ...reqData,
                        id: `${baseId}-${String.fromCharCode(65 + i)}`,
                        requesterName: user?.name || 'Unknown User',
                        requesterEmail: user?.email || '',
                        date: new Date().toISOString(),
                        status: initialStatus,
                        items: subItems,
                        totalEstimatedCost: subTotal,
                        amountPaid: 0,
                        paymentStatus: 'Unpaid',
                        paymentRecords: [],
                        auditTrail: [
                            {
                                id: `log-${Date.now()}-${i}`,
                                date: new Date().toISOString(),
                                userName: user!.name,
                                userRole: user!.role,
                                action: 'Created',
                                comment: `Split request for supplier: ${supp}`,
                                signature: data.signature
                            }
                        ],
                        attachments: data.attachments || []
                    };
                    await db.addRequisition(newReq);
                    await sendNotification(notifyTargetEmail, 'New Requisition', `New ${newReq.type} (Supplier: ${supp}) created by ${user!.name}.`, newReq.id);
                 }
                 showToast('Requests created and split by supplier successfully!', 'success');
            } else {
                // Standard Creation (Single Request)
                const newReq: Requisition = {
                    ...reqData,
                    id: baseId,
                    requesterName: user?.name || 'Unknown User',
                    requesterEmail: user?.email || '',
                    date: new Date().toISOString(),
                    status: initialStatus,
                    items: sanitizedItems, // Explicitly set sanitized items
                    amountPaid: 0,
                    paymentStatus: 'Unpaid',
                    paymentRecords: [],
                    auditTrail: [
                        {
                            id: `log-${Date.now()}`,
                            date: new Date().toISOString(),
                            userName: user!.name,
                            userRole: user!.role,
                            action: 'Created',
                            signature: data.signature
                        }
                    ],
                    attachments: data.attachments || []
                };
                await db.addRequisition(newReq);
                // Notify next approver
                await sendNotification(notifyTargetEmail, 'New Requisition', `New ${newReq.type} created by ${user!.name}.`, newReq.id);
                showToast('Requisition submitted successfully!', 'success');
            }
        }
        
        await fetchData();
        setIsCreateModalOpen(false);
        setSelectedRequisition(null);
    } catch (error) {
        console.error(error);
        showToast('Failed to submit requisition. Please try again.', 'error');
    }
  };

  const handleWorkflowAction = async (action: string, comment?: string, updatedItems?: RequisitionItem[], newFiles?: Attachment[], signature?: string) => {
      if (!selectedRequisition || !user) return;

      try {
          let newStatus = selectedRequisition.status;
          let reqsToAdd: Requisition[] = [];
          let shouldSplit = false;
          let nextApproverEmail = '';

          // State Machine Logic
          if (action === 'Rejected') {
              newStatus = Status.REJECTED;
              // Notify Requester
              await sendNotification(selectedRequisition.requesterEmail, 'Request Rejected', `Your request ${selectedRequisition.id} was rejected by ${user.name}. Reason: ${comment}`, selectedRequisition.id, 'error');
              showToast('Request rejected.', 'success');
          }
          else if (action === 'Returned') {
              newStatus = Status.RETURNED;
              // Notify Requester
               await sendNotification(selectedRequisition.requesterEmail, 'Request Returned', `Your request ${selectedRequisition.id} was sent back by ${user.name}. Reason: ${comment}`, selectedRequisition.id, 'warning');
               showToast('Request sent back to initiator.', 'success');
          }
          else if (action === 'Approved') {
              // NOTIFICATION: Notify current stage successful completion
              await sendNotification(selectedRequisition.requesterEmail, 'Request Approved', `Your request ${selectedRequisition.id} passed ${user.role} approval.`, selectedRequisition.id, 'success');
              showToast('Request approved successfully!', 'success');

              if (selectedRequisition.status === Status.PENDING_CHAIRMAN_REVIEW) {
                 // 1 Month Emergency goes to Finance after Chairman
                 if (selectedRequisition.type === 'Emergency Request (1 month)') {
                     newStatus = Status.PENDING_FINANCE_APPROVAL; // Chairman -> HOF
                     nextApproverEmail = 'hofzankli@gmail.com';
                 } else {
                     newStatus = Status.PENDING_STORE_FULFILLMENT; // Standard PO flow
                     nextApproverEmail = 'storezankli@gmail.com';
                 }
              }
              else if (selectedRequisition.status === Status.PENDING_AUDIT_2_REVIEW) {
                  newStatus = Status.PENDING_AUDIT_REVIEW; // Audit 2 -> Audit 1
                  nextApproverEmail = 'auditorzankli@gmail.com';
              }
              else if (selectedRequisition.status === Status.PENDING_AUDIT_REVIEW) {
                  if (selectedRequisition.type === 'Emergency Request (1 month)' || selectedRequisition.type === 'Emergency Request (1 week)') {
                      newStatus = Status.PENDING_CHAIRMAN_REVIEW;
                      nextApproverEmail = 'chairmanzankli@gmail.com';
                  } else if (selectedRequisition.type === 'Pharmacy Purchase Order' || selectedRequisition.type === 'Outsourced Histology Payment') {
                       newStatus = Status.PENDING_FINAL_APPROVAL;
                       nextApproverEmail = 'chairmanzankli@gmail.com';
                  } else {
                      newStatus = Status.PENDING_FINAL_APPROVAL;
                      nextApproverEmail = 'chairmanzankli@gmail.com';
                  }
              }
              
              if (nextApproverEmail) {
                  await sendNotification(nextApproverEmail, 'Approval Required', `Request ${selectedRequisition.id} is pending your review.`, selectedRequisition.id, 'info');
              }
          }
          else if (action === 'Updated') {
              // Store updating items logic
              if (selectedRequisition.type === 'Lab Purchase Order' && updatedItems) {
                 // Check for multiple suppliers to split the order
                 const itemsBySupplier: Record<string, RequisitionItem[]> = {};
                 const sanitizedForSplit = updatedItems.map(sanitizeItem);
                 
                 sanitizedForSplit.forEach(item => {
                    const supp = item.supplier || 'Unassigned';
                    if (!itemsBySupplier[supp]) itemsBySupplier[supp] = [];
                    itemsBySupplier[supp].push(item);
                 });

                 const suppliers = Object.keys(itemsBySupplier);
                 
                 if (suppliers.length > 1) {
                    shouldSplit = true;
                    newStatus = Status.SPLIT; // The master request is processed/split

                    suppliers.forEach((supp, idx) => {
                       const subItems = itemsBySupplier[supp];
                       const subTotal = subItems.reduce((sum, i) => sum + ((i.unitCost || i.estimatedCost) * i.quantity), 0);
                       
                       const newReq: Requisition = {
                          ...selectedRequisition,
                          id: `${selectedRequisition.id}-${String.fromCharCode(65 + idx)}`, // Append -A, -B etc.
                          items: subItems,
                          totalEstimatedCost: subTotal,
                          amountPaid: 0,
                          paymentStatus: 'Unpaid',
                          paymentRecords: [],
                          status: Status.PENDING_AUDIT_REVIEW,
                          auditTrail: [
                             ...selectedRequisition.auditTrail,
                             {
                                id: `log-${Date.now()}`,
                                date: new Date().toISOString(),
                                userName: user.name,
                                userRole: user.role,
                                action: 'Updated',
                                comment: comment || 'Details updated by Store.',
                                signature: signature
                             },
                             {
                                id: `log-split-${Date.now()}-${idx}`,
                                date: new Date().toISOString(),
                                userName: 'System',
                                userRole: user.role,
                                action: 'Split',
                                comment: `Split into separate PO for supplier: ${supp}`
                             }
                          ],
                          attachments: newFiles || selectedRequisition.attachments
                       };
                       reqsToAdd.push(newReq);
                       
                       // Notify Audit for split
                       sendNotification('auditorzankli@gmail.com', 'PO Split & Pending', `PO ${selectedRequisition.id} split for supplier ${supp}.`, newReq.id, 'info');
                    });
                    
                    // Notify Requester of split
                    sendNotification(selectedRequisition.requesterEmail, 'Order Processed', `Your order ${selectedRequisition.id} was processed and split by supplier.`, selectedRequisition.id, 'info');
                    showToast('Order processed and split successfully.', 'success');

                 } else {
                    // Single supplier, proceed normally
                    newStatus = Status.PENDING_AUDIT_REVIEW;
                    nextApproverEmail = 'auditorzankli@gmail.com';
                 }
              } else {
                 // Handle updates for NON-SPLIT requests (e.g. General Requests, Pharmacy POs updated by store)
                 if (updatedItems) {
                     // Ensure updated items are sanitized
                     const sanitizedUpdatedItems = updatedItems.map(sanitizeItem);

                     // IMPORTANT: Persist the changes to items!
                     const updatedReq: Requisition = {
                         ...selectedRequisition,
                         items: sanitizedUpdatedItems,
                         status: Status.PENDING_AUDIT_REVIEW,
                         auditTrail: [
                             ...selectedRequisition.auditTrail,
                             {
                                id: `log-${Date.now()}`,
                                date: new Date().toISOString(),
                                userName: user.name,
                                userRole: user.role,
                                action: 'Updated',
                                comment: comment || 'Details updated by Store.',
                                signature: signature
                             }
                         ],
                         // Persist attachments if any new ones
                         attachments: newFiles ? [...selectedRequisition.attachments, ...newFiles] : selectedRequisition.attachments
                     };
                     
                     // SAVE TO DB via upsert which handles items and logs
                     await db.addRequisition(updatedReq);
                     await sendNotification('auditorzankli@gmail.com', 'Store Fulfillment Complete', `Request ${selectedRequisition.id} updated by Store.`, selectedRequisition.id, 'info');
                     showToast('Request updated successfully.', 'success');

                     // Return early to avoid hitting the generic updateStatus below
                     await fetchData();
                     setSelectedRequisition(null);
                     return;
                 } else {
                     newStatus = Status.PENDING_AUDIT_REVIEW;
                     nextApproverEmail = 'auditorzankli@gmail.com';
                 }
              }
              
              if (!shouldSplit && nextApproverEmail) {
                   await sendNotification(nextApproverEmail, 'Store Fulfillment Complete', `Request ${selectedRequisition.id} updated by Store.`, selectedRequisition.id, 'info');
              }
          }
          else if (action === 'Final Approval') {
              newStatus = Status.APPROVED;
              await sendNotification(selectedRequisition.requesterEmail, 'Final Approval', `Your request ${selectedRequisition.id} has been fully approved!`, selectedRequisition.id, 'success');
              // Maybe notify procurement to buy?
              if (selectedRequisition.type !== 'Emergency Request (1 month)' && selectedRequisition.type !== 'Emergency Request (1 week)') {
                 await sendNotification('storezankli@gmail.com', 'Approved for Purchase', `Req ${selectedRequisition.id} is approved. Proceed with procurement.`, selectedRequisition.id, 'success');
              }
              showToast('Final approval granted successfully!', 'success');
          }
          else if (action === 'Consulted Audit') {
              newStatus = Status.PENDING_AUDIT_REVIEW;
              await sendNotification('auditorzankli@gmail.com', 'Audit Consultation', `Chairman requested advice on ${selectedRequisition.id}.`, selectedRequisition.id, 'warning');
              showToast('Audit consultation requested.', 'success');
          }
          else if (action === 'Advice Submitted') {
              newStatus = Status.PENDING_FINAL_APPROVAL; // Audit sends back to Chairman
              await sendNotification('chairmanzankli@gmail.com', 'Audit Advice Received', `Audit advice submitted for ${selectedRequisition.id}.`, selectedRequisition.id, 'info');
              showToast('Advice submitted to Chairman.', 'success');
          }
          else if (action === 'Edit') {
               // Open Edit Modal - This preserves selectedRequisition so we can load its data
               setIsCreateModalOpen(true);
               return; 
          }

          // 1. Update DB Status
          await db.updateStatus(selectedRequisition.id, newStatus);

          // 2. Insert new Audit Log to DB
          const newLog: AuditLog = {
              id: `log-${Date.now()}`,
              date: new Date().toISOString(),
              userName: user.name,
              userRole: user.role,
              action: action as any,
              comment,
              signature
          };
          await db.addAuditLog(selectedRequisition.id, newLog);

          // 3. Handle Splits
          if (shouldSplit && reqsToAdd.length > 0) {
              for (const r of reqsToAdd) {
                  await db.addRequisition(r);
              }
          }

          await fetchData();
          setSelectedRequisition(null);
      } catch (err) {
          console.error(err);
          showToast('An error occurred while processing the request.', 'error');
      }
  };

  const handleRecordPayment = async (amount: number, date: string, reference: string, attachment?: Attachment) => {
      if (!selectedRequisition || !user) return;

      try {
          // Add Payment Record to DB
          const newRecord: PaymentRecord = {
              id: `pay-${Date.now()}`,
              date,
              amount,
              reference,
              recordedBy: user.name,
              attachment
          };
          await db.addPaymentRecord(selectedRequisition.id, newRecord);
          
          // Recalculate Paid Amount and Status locally to update Req status
          const newAmountPaid = (selectedRequisition.amountPaid || 0) + amount;
          const isFullPayment = newAmountPaid >= selectedRequisition.totalEstimatedCost;
          const newPaymentStatus = isFullPayment ? 'Fully Paid' : 'Partially Paid';
          
          // Update Requisition Amount Paid and Status in DB
          const updatedReq: Requisition = {
              ...selectedRequisition,
              amountPaid: newAmountPaid,
              paymentStatus: newPaymentStatus,
          };
          // Use addRequisition to UPSERT the new totals
          await db.addRequisition(updatedReq);

          // Log action
          await db.addAuditLog(selectedRequisition.id, {
              id: `log-pay-${Date.now()}`,
              date: new Date().toISOString(),
              userName: user.name,
              userRole: user.role,
              action: 'Payment Recorded',
              comment: `Payment of ₦${amount.toLocaleString()} recorded. Ref: ${reference}`
          });

          await sendNotification(selectedRequisition.requesterEmail, 'Payment Recorded', `A payment of ₦${amount.toLocaleString()} was recorded for ${selectedRequisition.id}.`, selectedRequisition.id, 'success');
          showToast('Payment recorded successfully!', 'success');
          
          await fetchData();
          setSelectedRequisition(null);
      } catch (e) {
          showToast('Failed to record payment.', 'error');
      }
  };

  // Filter Logic
  const isActionRequired = (req: Requisition) => {
      if (!user) return false;
      
      const status = req.status;

      // 1. If user is the Creator and status is RETURNED or DRAFT -> Action Required
      if (req.requesterEmail === user.email && (status === Status.RETURNED || status === Status.DRAFT)) {
          return true;
      }

      // 2. Role-based Actions
      if (user.role === UserRole.CHAIRMAN) {
           if (req.type === 'Emergency Request (1 week)' && status === Status.PENDING_CHAIRMAN_REVIEW) return true; 
           return status === Status.PENDING_CHAIRMAN_REVIEW || status === Status.PENDING_FINAL_APPROVAL;
      }
      
      if (user.role === UserRole.PHARMACY_ADMIN) {
           return status === Status.PENDING_STORE_FULFILLMENT;
      }

      if (user.role === UserRole.HEAD_OF_FINANCE) return status === Status.PENDING_FINANCE_APPROVAL;
      
      if (user.role === UserRole.AUDITOR) {
          if (user.email === 'auditor2zankli@gmail.com') return status === Status.PENDING_AUDIT_2_REVIEW;
          return status === Status.PENDING_AUDIT_REVIEW;
      }
      
      return false;
  };

  const getFilteredRequisitions = () => {
      let filtered = [...requisitions];
      
      if (filterStatus === 'Action Required') {
          filtered = filtered.filter(r => isActionRequired(r));
      } else if (filterStatus === 'Pending') {
          filtered = filtered.filter(r => r.status.includes('Pending'));
      } else if (filterStatus === 'Approved') {
          filtered = filtered.filter(r => r.status === Status.APPROVED);
      }
      
      return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredRequisitions = getFilteredRequisitions();
  const totalPages = Math.ceil(filteredRequisitions.length / itemsPerPage);
  const paginatedRequisitions = filteredRequisitions.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
  );

  // Calculate Action Required Count for Badge
  const actionRequiredCount = requisitions.filter(r => isActionRequired(r)).length;

  if (authLoading) return <div className="flex items-center justify-center h-screen bg-zankli-cream">Loading...</div>;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-zankli-cream font-sans relative">
      {/* Global Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[200] px-6 py-3 rounded-lg shadow-xl flex items-center space-x-2 animate-bounce-in ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 
            toast.type === 'info' ? 'bg-blue-600 text-white' :
            'bg-green-600 text-white'
        }`}>
            {toast.type === 'success' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
            {toast.type === 'error' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <Sidebar 
         activeTab={activeTab} 
         setActiveTab={setActiveTab} 
         user={user} 
         onLogout={handleLogout} 
         notifications={notifications}
         onNotificationClick={handleNotificationClick}
      />
      
      <main className="flex-1 ml-64 overflow-y-auto custom-scrollbar p-8">
        
        {activeTab === 'reports' && (
            <ReportsDashboard requisitions={requisitions} />
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-end border-b border-gray-200 pb-4">
              <div>
                <h1 className="text-3xl font-bold text-zankli-black">Dashboard</h1>
                <p className="text-gray-500 mt-1">Welcome back, {user.name}</p>
              </div>
              <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-400">Last updated: {new Date().toLocaleTimeString()}</span>
                  <button onClick={fetchData} className="p-2 rounded-full hover:bg-gray-200 transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              {[
                { label: 'Total Requests', value: stats.total, color: 'bg-gray-900', textColor: 'text-white', statusFilter: 'All' },
                { label: 'Pending Approval', value: stats.pending, color: 'bg-zankli-orange', textColor: 'text-white', statusFilter: 'Pending' },
                { label: 'Fully Approved', value: stats.approved, color: 'bg-green-100', textColor: 'text-green-800', statusFilter: 'Approved' },
                { label: 'Total Cost (Est)', value: `₦${(stats.cost / 1000000).toFixed(1)}M`, color: 'bg-blue-50', textColor: 'text-blue-800', statusFilter: 'All' },
              ].map((card, idx) => (
                <div 
                    key={idx} 
                    onClick={() => { setFilterStatus(card.statusFilter); setCurrentPage(1); }}
                    className={`${card.color} rounded-2xl p-6 shadow-lg transition-transform hover:-translate-y-1 cursor-pointer`}
                >
                  <p className={`text-xs font-bold uppercase tracking-wider opacity-70 ${card.textColor}`}>{card.label}</p>
                  <p className={`text-3xl font-bold mt-2 ${card.textColor}`}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className="flex space-x-4 border-b border-gray-200">
                 {['All', 'Pending', 'Approved', 'Action Required'].map(status => (
                     <button
                        key={status}
                        onClick={() => { setFilterStatus(status); setCurrentPage(1); }}
                        className={`pb-2 px-1 text-sm font-medium transition-colors relative flex items-center space-x-2 ${filterStatus === status ? 'text-zankli-orange' : 'text-gray-500 hover:text-gray-800'}`}
                     >
                         <span>{status}</span>
                         {status === 'Action Required' && actionRequiredCount > 0 && (
                             <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{actionRequiredCount}</span>
                         )}
                         {filterStatus === status && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-zankli-orange rounded-t-full"></div>}
                     </button>
                 ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 flex justify-between items-center border-b border-gray-100">
                <h3 className="font-bold text-gray-800">
                    {filterStatus === 'All' ? 'Recent Activity' : `${filterStatus} Requests`}
                </h3>
                {(user.email === 'labzankli@gmail.com' || user.email === 'storezankli@gmail.com') && (
                  <button 
                    onClick={() => { setSelectedRequisition(null); setIsCreateModalOpen(true); }}
                    className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                  >
                    {ICONS.Plus}
                    <span>New Request</span>
                  </button>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4 rounded-tl-lg">ID</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Requester</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4 rounded-tr-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedRequisitions.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">No requests found matching criteria.</td>
                        </tr>
                    ) : (
                        paginatedRequisitions.map((req) => {
                            const needsAction = isActionRequired(req);
                            return (
                                <tr 
                                    key={req.id} 
                                    onClick={() => setSelectedRequisition(req)}
                                    className={`hover:bg-orange-50 transition-colors cursor-pointer group ${needsAction ? 'bg-orange-50/30' : ''}`}
                                >
                                <td className="px-6 py-4 font-medium text-gray-900 relative">
                                    {needsAction && <span className="absolute left-1 top-1/2 transform -translate-y-1/2 w-1.5 h-8 bg-zankli-orange rounded-r-full"></span>}
                                    {req.id}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{req.type}</td>
                                <td className="px-6 py-4 text-sm">
                                    <div className="flex items-center">
                                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 mr-2">
                                            {req.requesterName.charAt(0)}
                                        </div>
                                        <span className="text-gray-700">{req.requesterName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(req.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col items-start">
                                        <StatusBadge status={req.status} />
                                        {needsAction && (
                                            <span className="text-[10px] font-bold text-zankli-orange uppercase tracking-widest mt-1 animate-pulse">My Turn</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-800">₦{req.totalEstimatedCost.toLocaleString()}</td>
                                <td className="px-6 py-4">
                                    <button className="text-gray-400 hover:text-zankli-orange transition-colors">
                                        View
                                    </button>
                                </td>
                                </tr>
                            )
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                  <div className="flex justify-center items-center p-4 space-x-2 border-t border-gray-100 bg-gray-50">
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded border border-gray-300 text-xs disabled:opacity-50"
                      >
                          Prev
                      </button>
                      <span className="text-xs text-gray-500">Page {currentPage} of {totalPages}</span>
                      <button 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="px-3 py-1 rounded border border-gray-300 text-xs disabled:opacity-50"
                      >
                          Next
                      </button>
                  </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'requisitions' && (
           <div className="space-y-6 animate-fadeIn">
               <div className="flex justify-between items-center">
                   <h2 className="text-2xl font-bold">All Requisitions</h2>
                   {(user.email === 'labzankli@gmail.com' || user.email === 'storezankli@gmail.com') && (
                    <button 
                        onClick={() => { setSelectedRequisition(null); setIsCreateModalOpen(true); }}
                        className="bg-zankli-orange text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700"
                    >
                        + New Request
                    </button>
                    )}
               </div>
               <div className="bg-white p-8 rounded-2xl shadow-sm text-center text-gray-500">
                   <p>Switch to Dashboard to manage workflow active items.</p>
               </div>
           </div>
        )}

      </main>

      <RequisitionModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateRequisition}
        user={user}
        existingRequisition={isCreateModalOpen && selectedRequisition ? selectedRequisition : null}
      />

      {/* Hide Details Modal if Create/Edit Modal is Open to avoid conflict */}
      {selectedRequisition && !isCreateModalOpen && (
        <RequestDetailsModal 
          isOpen={!!selectedRequisition}
          onClose={() => setSelectedRequisition(null)}
          requisition={selectedRequisition}
          user={user}
          onAction={handleWorkflowAction}
          onPayment={handleRecordPayment}
          allRequisitions={requisitions}
        />
      )}
    </div>
  );
};

export default App;