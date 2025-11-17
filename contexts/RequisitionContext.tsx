import React, { useState, useContext, createContext, useEffect, useCallback, useRef } from 'react';
import { User, Requisition, RequisitionItem, RequisitionStatus, ApprovalLog, RequisitionType, HistologyItem, Message, Payment, Notification } from '../types';
import { supabase } from '../lib/supabaseClient';
import { GoogleGenAI, Type } from '@google/genai';
import { useAuth } from './AuthContext';

// --- Data Transformation Helpers ---
const transformRequisitionFromDB = (dbReq: any): Requisition => ({
  ...dbReq,
  requesterName: dbReq.profiles?.name || 'Unknown',
  items: dbReq.requisition_items || [],
  histologyItems: dbReq.histology_items || [],
  log: dbReq.approval_logs?.map((l: any) => ({ ...l, userName: l.profiles?.name || 'Unknown' })) || [],
  conversation: dbReq.messages?.map((m: any) => ({ ...m, senderName: m.profiles?.name || 'Unknown' })) || [],
  payments: dbReq.payments?.map((p: any) => ({ ...p, recordedByName: p.profiles?.name || 'Unknown' })) || [],
});

// --- Requisition Context ---
interface RequisitionContextType {
    requisitions: Requisition[];
    notifications: Notification[];
    profiles: User[];
    addRequisition: (items: Omit<RequisitionItem, 'id' | 'requisition_id'>[], requester: User) => Promise<void>;
    addPurchaseOrder: (items: Omit<RequisitionItem, 'id' | 'requisition_id'>[], requester: User, signatures?: Requisition['signatures']) => Promise<void>;
    addHistologyRequisition: (items: Omit<HistologyItem, 'id' | 'requisition_id'>[], requester: User, signatures: Requisition['signatures']) => Promise<void>;
    updatePurchaseOrder: (reqId: string, items: RequisitionItem[], user: User, signature: string) => Promise<void>;
    updateRequisitionStatus: (reqId: string, status: RequisitionStatus, user: User, signature: string, comment?: string, options?: { queryTarget?: 'Lab' | 'Pharmacy', logAction?: ApprovalLog['action'] }) => Promise<void>;
    resubmitRequisition: (req: Requisition, updatedData: { items?: Omit<RequisitionItem, 'id' | 'requisition_id'>[], histologyItems?: Omit<HistologyItem, 'id' | 'requisition_id'>[] }, user: User) => Promise<void>;
    addMessage: (reqId: string, text: string, sender: User) => Promise<void>;
    addPayment: (reqId: string, paymentData: Omit<Payment, 'id' | 'requisition_id' | 'recorded_by_id' | 'recordedByName' | 'timestamp' | 'proof_path'>, proofFile: File | null, user: User) => Promise<void>;
    markAsPaid: (reqId: string, user: User) => Promise<void>;
    markNotificationAsRead: (notificationId: number) => Promise<void>;
    markAllNotificationsAsRead: (userId: string) => Promise<void>;
    processInvoiceWithAI: (file: File) => Promise<Omit<RequisitionItem, 'id' | 'requisition_id'>[]>;
    fetchAllData: () => Promise<void>;
}

const RequisitionContext = createContext<RequisitionContextType | null>(null);

export const RequisitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [profiles, setProfiles] = useState<User[]>([]);
    const { user } = useAuth();
    const fetchTimeout = useRef<number | null>(null);

    const fetchAllData = useCallback(async () => {
      if (!user) return;
      
      const { data: profilesData } = await supabase.from('profiles').select('*');
      if (profilesData) setProfiles(profilesData as User[]);

      const { data: reqs, error: reqsError } = await supabase
        .from('requisitions')
        .select(`*, profiles!requester_id(name), approval_logs(*, profiles!user_id(name)), messages(*, profiles!sender_id(name)), payments(*, profiles!recorded_by_id(name)), requisition_items(*), histology_items(*)`)
        .order('created_at', { ascending: false });
      
      if (reqsError) console.error('Error fetching requisitions:', reqsError);
      else if (reqs) setRequisitions(reqs.map(transformRequisitionFromDB));
      
      const { data: notifs, error: notifsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });
        
      if (notifsError) console.error('Error fetching notifications:', notifsError);
      else setNotifications(notifs as Notification[]);
    }, [user]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
      if (!user) return;
      const channel = supabase.channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
           if (fetchTimeout.current) {
                clearTimeout(fetchTimeout.current);
            }
            fetchTimeout.current = window.setTimeout(() => {
                fetchAllData();
            }, 300); // Debounce for 300ms
        })
        .subscribe();
        
      return () => { 
        if (fetchTimeout.current) {
            clearTimeout(fetchTimeout.current);
        }
        supabase.removeChannel(channel); 
      };
    }, [user, fetchAllData]);

    const createNotification = async (recipientId: string, message: string, requisitionId: string) => {
      await supabase.from('notifications').insert({ recipient_id: recipientId, message, requisition_id: requisitionId });
    };

    const notifyUsersByRole = async (role: string, message: string, requisitionId: string) => {
        const recipients = profiles.filter(p => p.role === role);
        for (const recipient of recipients) {
            await createNotification(recipient.id, message, requisitionId);
        }
    };
    const notifyUsersByName = async (name: string, message: string, requisitionId: string) => {
        const recipients = profiles.filter(p => p.name === name);
        for (const recipient of recipients) {
            await createNotification(recipient.id, message, requisitionId);
        }
    };

    const addRequisition = async (items: Omit<RequisitionItem, 'id' | 'requisition_id'>[], requester: User) => {
      const totalEstimatedCost = items.reduce((sum, item) => sum + (item.quantity * (item.estimated_unit_cost || 0)), 0);
      const { data: newReqData, error: reqError } = await supabase.from('requisitions').insert({ type: RequisitionType.STANDARD, department: requester.department, requester_id: requester.id, status: RequisitionStatus.PENDING_APPROVAL, total_estimated_cost: totalEstimatedCost }).select().single();
      if (reqError || !newReqData) throw reqError || new Error("Failed to create requisition.");
      await supabase.from('approval_logs').insert({ requisition_id: newReqData.id, user_id: requester.id, action: 'Submitted' });
      const itemsToInsert = items.map(item => ({ ...item, requisition_id: newReqData.id }));
      await supabase.from('requisition_items').insert(itemsToInsert);
      await notifyUsersByName('Chairman', `New standard requisition ${newReqData.id} needs approval.`, newReqData.id);
      await notifyUsersByName('Auditor', `New standard requisition ${newReqData.id} needs approval.`, newReqData.id);
    };
    
    const addPurchaseOrder = async (items: Omit<RequisitionItem, 'id' | 'requisition_id'>[], requester: User, signatures?: Requisition['signatures']) => {
        const itemsBySupplier = new Map<string, typeof items>();

        for (const item of items) {
            const supplierKey = item.supplier?.trim().toLowerCase() || 'miscellaneous supplier';
            if (!itemsBySupplier.has(supplierKey)) {
                itemsBySupplier.set(supplierKey, []);
            }
            itemsBySupplier.get(supplierKey)!.push(item);
        }

        for (const [supplier, supplierItems] of itemsBySupplier.entries()) {
            const totalEstimatedCost = supplierItems.reduce((sum, item) => {
                // For Pharmacy, price is known at creation. For Lab, it will be 0 until priced by store.
                const cost = requester.department === 'Pharmacy' ? (item.unit_price || 0) : 0;
                return sum + (item.quantity * cost);
            }, 0);

            // Determine initial status based on department
            const initialStatus = requester.department === 'Pharmacy'
                ? RequisitionStatus.PENDING_AUDITOR_REVIEW
                : RequisitionStatus.PENDING_CHAIRMAN_REVIEW;

            const { data: newReqData, error } = await supabase.from('requisitions').insert({
                type: RequisitionType.PURCHASE_ORDER,
                department: requester.department,
                requester_id: requester.id,
                status: initialStatus,
                total_estimated_cost: totalEstimatedCost,
                signatures
            }).select().single();

            if (error || !newReqData) {
                throw error || new Error(`Failed to create PO for supplier: ${supplier}.`);
            }

            await supabase.from('approval_logs').insert({ requisition_id: newReqData.id, user_id: requester.id, action: 'Submitted' });

            const itemsToInsert = supplierItems.map(item => ({ ...item, supplier: supplier === 'miscellaneous supplier' ? item.supplier : supplier, requisition_id: newReqData.id }));
            const { error: itemsError } = await supabase.from('requisition_items').insert(itemsToInsert);
            
            if (itemsError) {
                // Attempt to clean up the created requisition if items fail to insert
                await supabase.from('requisitions').delete().eq('id', newReqData.id);
                throw itemsError;
            }

            // Send notification based on the initial workflow step
            if (initialStatus === RequisitionStatus.PENDING_AUDITOR_REVIEW) {
                 await notifyUsersByName('Auditor', `New PO ${newReqData.id} from Pharmacy (Supplier: ${supplier}) requires review.`, newReqData.id);
            } else { // PENDING_CHAIRMAN_REVIEW
                await notifyUsersByName('Chairman', `New PO ${newReqData.id} from Lab (Supplier: ${supplier}) requires review.`, newReqData.id);
            }
        }
    }
    
    const addHistologyRequisition = async (items: Omit<HistologyItem, 'id'|'requisition_id'>[], requester: User, signatures: Requisition['signatures']) => {
      const totalEstimatedCost = items.reduce((sum, item) => sum + (item.outsource_bills || 0) + (item.zmc_charge || 0), 0);
      const { data: newReqData, error } = await supabase.from('requisitions').insert({ type: RequisitionType.HISTOLOGY_PAYMENT, department: requester.department, requester_id: requester.id, status: RequisitionStatus.PENDING_AUDITOR_APPROVAL, total_estimated_cost: totalEstimatedCost, signatures }).select().single();
      if (error || !newReqData) throw error || new Error("Failed to create Histology Req.");
      await supabase.from('approval_logs').insert({ requisition_id: newReqData.id, user_id: requester.id, action: 'Submitted' });
      const itemsToInsert = items.map(item => ({ ...item, requisition_id: newReqData.id }));
      await supabase.from('histology_items').insert(itemsToInsert);
      await notifyUsersByName('Auditor', `New Histology Payment request ${newReqData.id} requires approval.`, newReqData.id);
    }

    const updatePurchaseOrder = async (reqId: string, items: RequisitionItem[], user: User, signature: string) => {
        // 1. Calculate total cost based on the updated prices.
        const total_estimated_cost = items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0);

        // 2. Create a specific update promise for each item's price.
        // This is more secure and respects RLS policies that might restrict column-level updates.
        const updatePromises = items.map(item =>
            supabase
                .from('requisition_items')
                .update({ unit_price: item.unit_price || 0 })
                .eq('id', item.id)
        );

        // 3. Execute all item updates concurrently and wait for them to finish.
        const results = await Promise.all(updatePromises);
        const updateError = results.find(res => res.error);
        if (updateError) {
            console.error('Supabase item update error:', updateError.error);
            throw new Error(`Failed to update item price: ${updateError.error.message}`);
        }

        // 4. If all items were updated successfully, update the main requisition record.
        const { error: reqUpdateError } = await supabase
            .from('requisitions')
            .update({ total_estimated_cost, status: RequisitionStatus.PENDING_AUDITOR_REVIEW, updated_at: new Date().toISOString() })
            .eq('id', reqId);

        if (reqUpdateError) {
            console.error('Supabase requisition update error:', reqUpdateError);
            throw new Error(`Failed to update requisition status: ${reqUpdateError.message}`);
        }

        // 5. Finally, log the "Priced" action.
        const { error: logError } = await supabase
            .from('approval_logs')
            .insert({ requisition_id: reqId, user_id: user.id, action: 'Priced', signature });

        if (logError) {
            console.error('Supabase log insert error:', logError);
            // This is not ideal, but the main action succeeded. We'll log it but not throw an error
            // to avoid confusing the user that the entire operation failed.
        }

        // 6. Notify the next person in the workflow.
        await notifyUsersByName('Auditor', `PO ${reqId} has been priced and requires review.`, reqId);
    };
    
    const updateRequisitionStatus = async (reqId: string, status: RequisitionStatus, user: User, signature: string, comment?: string, options?: { queryTarget?: 'Lab' | 'Pharmacy', logAction?: ApprovalLog['action'] }) => {
        const currentReq = requisitions.find(r => r.id === reqId);
        if (!currentReq) throw new Error("Requisition not found in local state.");

        const action = options?.logAction;
        if (!action) {
            throw new Error("A log action must be provided to update status.");
        }
        
        const updatePayload: Partial<Requisition> = { status, updated_at: new Date().toISOString() };
        if (status === RequisitionStatus.QUERIED) {
            updatePayload.previous_status_on_query = currentReq.status as RequisitionStatus;
            updatePayload.queried_to = options?.queryTarget;
        }

        // --- Transactionally Safer DB Operations ---
        // 1. Update the primary requisition record first.
        const { error: reqError } = await supabase.from('requisitions').update(updatePayload).eq('id', reqId);
        if(reqError) {
             console.error("Requisition Update Error:", reqError);
             // Re-throw the error to be caught by the calling component
             throw reqError;
        }

        // 2. Only if the primary update succeeds, insert the log entry.
        const { error: logError } = await supabase.from('approval_logs').insert({ requisition_id: reqId, user_id: user.id, action, comment, signature });
        if(logError) {
             console.error("Approval Log Error:", logError);
             // While not ideal, the main status is updated. We log this but don't throw,
             // to avoid telling the user the whole operation failed when it partially succeeded.
             // A more robust solution might involve a database transaction (RPC).
        }
        
        // --- Notification Logic ---
        if (status === RequisitionStatus.QUERIED || status === RequisitionStatus.REJECTED) {
            await createNotification(currentReq.requester_id, `Your requisition ${reqId} was ${status.toLowerCase()}.`, reqId);
        } else {
             // PO Flow
            if(currentReq.type === RequisitionType.PURCHASE_ORDER) {
                if(status === RequisitionStatus.PENDING_STORE_PRICING) await notifyUsersByRole('Pharmacy Admin', `PO ${reqId} is ready for pricing.`, reqId);
                if(status === RequisitionStatus.PENDING_AUDITOR_REVIEW) await notifyUsersByName('Auditor', `PO ${reqId} requires review.`, reqId);
                if(status === RequisitionStatus.PENDING_FINAL_APPROVAL) await notifyUsersByName('Chairman', `PO ${reqId} requires final approval.`, reqId);
                if(status === RequisitionStatus.PO_COMPLETED) await notifyUsersByRole('Accounts', `PO ${reqId} is complete and ready for payment processing.`, reqId);
            }
            // Histology Flow
            else if(currentReq.type === RequisitionType.HISTOLOGY_PAYMENT) {
                if(status === RequisitionStatus.PENDING_CHAIRMAN_APPROVAL) await notifyUsersByName('Chairman', `Histology request ${reqId} requires approval.`, reqId);
                if(status === RequisitionStatus.HISTOLOGY_APPROVED) await notifyUsersByRole('Accounts', `Histology request ${reqId} is approved and ready for payment.`, reqId);
            }
            // Standard Flow
            else if(currentReq.type === RequisitionType.STANDARD) {
                if(status === RequisitionStatus.APPROVED) await notifyUsersByRole('Accounts', `Standard requisition ${reqId} is approved and ready for payment.`, reqId);
            }
        }
    };

    const resubmitRequisition = async (req: Requisition, updatedData: { items?: Omit<RequisitionItem, 'id' | 'requisition_id'>[], histologyItems?: Omit<HistologyItem, 'id' | 'requisition_id'>[] }, user: User) => {
        let newStatus: RequisitionStatus;

        if (req.status === RequisitionStatus.QUERIED && req.previous_status_on_query) {
            newStatus = req.previous_status_on_query;
        } else { // Handle REJECTED or queried without a previous status by restarting the flow
            switch(req.type) {
                case RequisitionType.PURCHASE_ORDER:
                    newStatus = user.department === 'Pharmacy'
                        ? RequisitionStatus.PENDING_AUDITOR_REVIEW
                        : RequisitionStatus.PENDING_CHAIRMAN_REVIEW;
                    break;
                case RequisitionType.HISTOLOGY_PAYMENT:
                    newStatus = RequisitionStatus.PENDING_AUDITOR_APPROVAL;
                    break;
                case RequisitionType.STANDARD:
                default:
                    newStatus = RequisitionStatus.PENDING_APPROVAL;
                    break;
            }
        }
        
        let total_estimated_cost = req.total_estimated_cost;
        if (updatedData.items) {
            await supabase.from('requisition_items').delete().eq('requisition_id', req.id);
            await supabase.from('requisition_items').insert(updatedData.items.map(i => ({...i, requisition_id: req.id})));
            total_estimated_cost = updatedData.items.reduce((sum, item) => sum + (item.quantity * (item.estimated_unit_cost || item.unit_price || 0)), 0);
        }
        if (updatedData.histologyItems) {
            await supabase.from('histology_items').delete().eq('requisition_id', req.id);
            await supabase.from('histology_items').insert(updatedData.histologyItems.map(i => ({...i, requisition_id: req.id})));
            total_estimated_cost = updatedData.histologyItems.reduce((sum, item) => sum + (item.outsource_bills || 0) + (item.zmc_charge || 0), 0);
        }

        await supabase.from('requisitions').update({ status: newStatus, queried_to: null, previous_status_on_query: null, total_estimated_cost }).eq('id', req.id);
        await supabase.from('approval_logs').insert({ requisition_id: req.id, user_id: user.id, action: 'Resubmitted' });

        // --- Notify relevant users about the resubmission ---
        const message = `Requisition ${req.id} has been resubmitted and requires your attention.`;
        switch(newStatus) {
            case RequisitionStatus.PENDING_CHAIRMAN_REVIEW:
            case RequisitionStatus.PENDING_FINAL_APPROVAL:
            case RequisitionStatus.PENDING_CHAIRMAN_APPROVAL:
                await notifyUsersByName('Chairman', message, req.id);
                break;
            case RequisitionStatus.PENDING_AUDITOR_REVIEW:
            case RequisitionStatus.PENDING_AUDITOR_APPROVAL:
                await notifyUsersByName('Auditor', message, req.id);
                break;
            case RequisitionStatus.PENDING_APPROVAL:
                await notifyUsersByName('Chairman', message, req.id);
                await notifyUsersByName('Auditor', message, req.id);
                break;
            case RequisitionStatus.PENDING_STORE_PRICING:
                await notifyUsersByRole('Pharmacy Admin', message, req.id);
                break;
        }
    }
    
    const addMessage = async (reqId: string, text: string, sender: User) => {
      await supabase.from('messages').insert({ requisition_id: reqId, sender_id: sender.id, text });
      
      const { data: req, error } = await supabase.from('requisitions').select('requester_id').eq('id', reqId).single();
      
      if (error) {
          console.error("Could not fetch requisition to send notification", error);
          return;
      }
      
      if (req && req.requester_id !== sender.id) {
          await createNotification(req.requester_id, `${sender.name} sent a message on requisition ${reqId}.`, reqId);
      }
    }
    
    const addPayment = async (reqId: string, paymentData: Omit<Payment, 'id' | 'requisition_id' | 'recorded_by_id' | 'recordedByName' | 'timestamp' | 'proof_path'>, proofFile: File | null, user: User) => {
        let proof_path: string | undefined = undefined;

        if (proofFile) {
            const filePath = `${user.id}/${reqId}/${Date.now()}_${proofFile.name}`;
            const { error: uploadError } = await supabase.storage.from('payment_proofs').upload(filePath, proofFile);
            if (uploadError) {
                console.error("Storage upload error:", uploadError);
                throw new Error(`Failed to upload proof: ${uploadError.message}`);
            }
            proof_path = filePath;
        }

        const { error: paymentError } = await supabase.from('payments').insert({
            requisition_id: reqId,
            amount: paymentData.amount,
            date: paymentData.date,
            recorded_by_id: user.id,
            proof_path
        });
        if (paymentError) {
            console.error("Payment insert error:", paymentError);
            throw new Error(`Failed to save payment record: ${paymentError.message}`);
        }

        const { error: statusError } = await supabase
            .from('requisitions')
            .update({ status: RequisitionStatus.PAYMENT_PROCESSING, updated_at: new Date().toISOString() })
            .eq('id', reqId);
        if (statusError) {
            console.error("Requisition status update error:", statusError);
            throw new Error(`Payment saved, but failed to update requisition status: ${statusError.message}`);
        }

        const { error: logError } = await supabase.from('approval_logs').insert({
            requisition_id: reqId,
            user_id: user.id,
            action: 'Payment Added',
            comment: `NGN ${paymentData.amount.toLocaleString()}`
        });
        if (logError) {
            console.error("Approval log error:", logError);
        }
    }

    const markAsPaid = async (reqId: string, user: User) => {
        const { error: reqError } = await supabase
            .from('requisitions')
            .update({ status: RequisitionStatus.PAID, updated_at: new Date().toISOString() })
            .eq('id', reqId);

        if (reqError) {
            console.error("Mark as Paid error:", reqError);
            throw new Error(`Failed to update status to Paid: ${reqError.message}`);
        }

        const { error: logError } = await supabase.from('approval_logs').insert({
            requisition_id: reqId,
            user_id: user.id,
            action: 'Marked as Paid'
        });

        if (logError) {
            console.error("Log error on Mark as Paid:", logError);
        }
    }
    
    const markNotificationAsRead = async (notificationId: number) => {
      await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    }

    const markAllNotificationsAsRead = async (userId: string) => {
      await supabase.from('notifications').update({ read: true }).eq('recipient_id', userId).eq('read', false);
    }

    const processInvoiceWithAI = async (file: File): Promise<Omit<RequisitionItem, 'id' | 'requisition_id'>[]> => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
        
        const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = error => reject(error);
        });

        const base64Data = await toBase64(file);
        
        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        };

        const textPart = {
            text: `Analyze this invoice or list of items. Extract each item, its quantity, its current stock level, and a brief description. Return the data as a JSON array with objects containing "name", "quantity" (as a number), "stock_level" (as a number), and "description" keys. If a value is not found, use a reasonable default or null. For example: [{"name": "Item A", "quantity": 10, "stock_level": 50, "description": "10mg tablets"}]. Only return the JSON array.`
        };
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [textPart, imagePart] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                quantity: { type: Type.NUMBER },
                                stock_level: { type: Type.NUMBER },
                                description: { type: Type.STRING }
                            },
                            required: ["name", "quantity"]
                        }
                    }
                }
            });

            const parsedResult = JSON.parse(response.text);

            if (!Array.isArray(parsedResult)) {
                throw new Error("AI did not return a valid array.");
            }

            return parsedResult.map(item => ({
                name: item.name || "Unknown Item",
                quantity: typeof item.quantity === 'number' ? item.quantity : 1,
                description: item.description || "",
                estimated_unit_cost: 0,
                stock_level: typeof item.stock_level === 'number' ? item.stock_level : 0,
                unit_price: 0,
                supplier: ''
            }));
        } catch (e) {
            console.error("Error processing invoice with AI:", e);
            throw new Error("Failed to analyze the invoice. The document might be unclear or in an unsupported format.");
        }
    };


    return (
        <RequisitionContext.Provider value={{ 
            requisitions, notifications, profiles, addRequisition, addPurchaseOrder, 
            updatePurchaseOrder, updateRequisitionStatus, resubmitRequisition, 
            addHistologyRequisition, addMessage, addPayment, markAsPaid, 
            markNotificationAsRead, markAllNotificationsAsRead, processInvoiceWithAI,
            fetchAllData 
        }}>
            {children}
        </RequisitionContext.Provider>
    );
};

export const useRequisitions = () => {
    const context = useContext(RequisitionContext);
    if (!context) throw new Error('useRequisitions must be used within a RequisitionProvider');
    return context;
};