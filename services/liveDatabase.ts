import { supabase } from './supabaseClient';
import { Requisition, Status, Notification, RequisitionItem, AuditLog, PaymentRecord, Attachment } from '../types';

// Helper to map database rows to TypeScript objects
const mapRequisitionFromDB = (row: any): Requisition => {
  return {
    id: row.id,
    type: row.type,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    department: row.department,
    date: row.date,
    status: row.status,
    priority: row.priority,
    totalEstimatedCost: row.total_estimated_cost,
    
    title: row.title,
    justification: row.justification,
    beneficiary: row.beneficiary,
    amountInWords: row.amount_in_words,
    aiAnalysis: row.ai_analysis,
    
    amountPaid: row.amount_paid || 0,
    paymentStatus: row.payment_status || 'Unpaid',
    
    // Map Items with explicit default checks
    items: (row.requisition_items || []).map((i: any) => ({
      id: i.id,
      name: i.name || 'Unknown Item', // Fallback if name is missing
      quantity: Number(i.quantity) || 0,
      unit: i.unit || 'Unit',
      estimatedCost: Number(i.estimated_cost) || 0,
      // Ensure stockLevel is read correctly from DB, handling possible 0 values
      stockLevel: (i.stock_level !== undefined && i.stock_level !== null) ? Number(i.stock_level) : 0,
      supplier: i.supplier || '',
      unitCost: (i.unit_cost !== undefined && i.unit_cost !== null) ? Number(i.unit_cost) : 0,
      category: i.category || 'General',
      patientName: i.patient_name || '',
      labNumber: i.lab_number || '',
      retainership: Number(i.retainership) || 0,
      zmcCharge: Number(i.zmc_charge) || 0
    })),
    
    // Map Audit Logs
    auditTrail: (row.audit_logs || [])
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((l: any) => ({
        id: l.id,
        date: l.date,
        userName: l.user_name,
        userRole: l.user_role,
        action: l.action,
        comment: l.comment,
        signature: l.signature
      })),
    
    // Map Payment Records
    paymentRecords: (row.payment_records || []).map((p: any) => ({
      id: p.id,
      date: p.date,
      amount: p.amount,
      reference: p.reference,
      recordedBy: p.recorded_by,
      attachment: p.attachment_data 
    })),

    attachments: row.attachments || []
  };
};

export const db = {
  getRequisitions: async (): Promise<Requisition[]> => {
    const { data, error } = await supabase
      .from('requisitions')
      .select(`
        *,
        requisition_items(*),
        audit_logs(*),
        payment_records(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching requisitions:', error);
      return [];
    }

    return data.map(mapRequisitionFromDB);
  },

  addRequisition: async (req: Requisition): Promise<void> => {
    console.log(`Saving Requisition ${req.id}...`);

    // 1. Upsert Main Requisition
    const { error: reqError } = await supabase.from('requisitions').upsert({
      id: req.id,
      type: req.type,
      requester_name: req.requesterName,
      requester_email: req.requesterEmail,
      department: req.department,
      date: req.date,
      status: req.status,
      priority: req.priority,
      total_estimated_cost: req.totalEstimatedCost || 0,
      title: req.title,
      justification: req.justification,
      beneficiary: req.beneficiary,
      amount_in_words: req.amountInWords,
      ai_analysis: req.aiAnalysis,
      amount_paid: req.amountPaid || 0,
      payment_status: req.paymentStatus,
      attachments: req.attachments
    });

    if (reqError) {
        console.error('CRITICAL: Error upserting requisition parent:', reqError);
        throw reqError;
    }

    // 2. Sync Items (Delete all & Re-insert)
    if (req.items && req.items.length > 0) {
      // Sanitize Item Data BEFORE deleting old ones to ensure we have valid data
      const itemsData = req.items.map(i => {
        // Helper to safely get number
        const getNum = (val: any, fallback = 0) => {
           if (val === undefined || val === null || val === '') return fallback;
           const num = Number(val);
           return isNaN(num) ? fallback : num;
        };

        // Helper to check keys aggressively (handle both camelCase from App and snake_case from DB reads)
        const anyI = i as any;

        return {
            requisition_id: req.id,
            name: i.name || 'Unknown Item',
            quantity: getNum(i.quantity, 1),
            unit: i.unit || 'Unit',
            estimated_cost: getNum(i.estimatedCost, 0),
            // Explicitly map stockLevel (camelCase) to stock_level (snake_case)
            stock_level: getNum(i.stockLevel, getNum(anyI.stock_level, 0)),
            supplier: i.supplier || '',
            unit_cost: getNum(i.unitCost, getNum(anyI.unit_cost, 0)),
            category: i.category || 'General',
            patient_name: i.patientName || null,
            lab_number: i.labNumber || null,
            retainership: getNum(i.retainership, 0),
            zmc_charge: getNum(i.zmcCharge, 0)
        };
      });

      // Perform the swap
      const { error: deleteError } = await supabase.from('requisition_items').delete().eq('requisition_id', req.id);
      if (deleteError) {
          console.error('CRITICAL: Error clearing old items:', deleteError);
          throw deleteError;
      }
      
      const { error: itemsError } = await supabase.from('requisition_items').insert(itemsData);
      if (itemsError) {
          console.error('CRITICAL: Error inserting items:', itemsError, itemsData);
          throw itemsError; 
      }
    } else {
        // If items list is empty, ensure DB is also empty for this ID
        // This handles the case where user deleted all items in the UI
        await supabase.from('requisition_items').delete().eq('requisition_id', req.id);
    }

    // 3. Sync Audit Logs
    const logsToInsert = req.auditTrail.filter(l => l.id.startsWith('log-'));
    if (logsToInsert.length > 0) {
        const logsData = logsToInsert.map(l => ({
          requisition_id: req.id,
          date: l.date,
          user_name: l.userName,
          user_role: l.userRole,
          action: l.action,
          comment: l.comment,
          signature: l.signature
        }));
        
        // Attempt to insert logs. If partial failure (duplicate PK), we log but don't crash main flow.
        const { error: logError } = await supabase.from('audit_logs').insert(logsData);
        if (logError) {
            console.warn('Warning: Error inserting audit logs (duplicates might exist):', logError);
        }
    }
    
    console.log(`Successfully saved Requisition ${req.id}`);
  },

  updateStatus: async (id: string, status: Status): Promise<void> => {
    const { error } = await supabase
        .from('requisitions')
        .update({ status: status })
        .eq('id', id);
    if (error) console.error('Error updating status:', error);
  },

  addAuditLog: async (reqId: string, log: AuditLog) => {
      await supabase.from('audit_logs').insert({
        requisition_id: reqId,
        date: log.date,
        user_name: log.userName,
        user_role: log.userRole,
        action: log.action,
        comment: log.comment,
        signature: log.signature
      });
  },

  addPaymentRecord: async (reqId: string, record: PaymentRecord) => {
     await supabase.from('payment_records').insert({
         requisition_id: reqId,
         date: record.date,
         amount: record.amount,
         reference: record.reference,
         recorded_by: record.recordedBy,
         attachment_data: record.attachment
     });
  },

  getNotifications: async (userEmail: string): Promise<Notification[]> => {
    const { data, error } = await supabase.from('notifications').select('*').eq('recipient_email', userEmail).order('date', { ascending: false });
    if (error) return [];
    return data.map((n: any) => ({
        id: n.id,
        recipientEmail: n.recipient_email,
        title: n.title,
        message: n.message,
        date: n.date,
        read: n.read,
        relatedRequisitionId: n.related_requisition_id,
        type: n.type
    }));
  },

  addNotification: async (notif: Notification): Promise<void> => {
    await supabase.from('notifications').insert({
        recipient_email: notif.recipientEmail,
        title: notif.title,
        message: notif.message,
        date: notif.date,
        read: notif.read,
        related_requisition_id: notif.relatedRequisitionId,
        type: notif.type
    });
  },

  markNotificationAsRead: async (id: string): Promise<void> => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
  },
  
  getStats: async () => {
      const { count: total } = await supabase.from('requisitions').select('*', { count: 'exact', head: true });
      const { count: approved } = await supabase.from('requisitions').select('*', { count: 'exact', head: true }).eq('status', 'Approved');
      
      const { count: pending } = await supabase.from('requisitions').select('*', { count: 'exact', head: true })
        .or('status.eq.Pending Chairman Review,status.eq.Pending Store Fulfillment,status.eq.Pending Audit Review,status.eq.Pending Audit 2 Review,status.eq.Pending Final Approval,status.eq.Pending Finance Approval');

      const { data } = await supabase.from('requisitions').select('total_estimated_cost');
      const cost = data?.reduce((sum, r) => sum + (r.total_estimated_cost || 0), 0) || 0;

      return { 
          total: total || 0, 
          pending: pending || 0, 
          approved: approved || 0, 
          cost 
      };
  }
};