export enum Role {
  LAB_ADMIN = 'Lab Admin',
  PHARMACY_ADMIN = 'Pharmacy Admin',
  APPROVER = 'Approver',
  ACCOUNTS = 'Accounts',
}

export interface User {
  id: string; // This will be a UUID from Supabase Auth
  email: string;
  name: string;
  role: Role;
  department: 'Lab' | 'Pharmacy' | 'Management' | 'Finance';
}

export enum RequisitionType {
  STANDARD = 'STANDARD',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  HISTOLOGY_PAYMENT = 'HISTOLOGY_PAYMENT',
}


export enum RequisitionStatus {
  // --- Standard Flow ---
  PENDING_APPROVAL = 'Pending Approval', // To Chairman/Auditor
  APPROVED = 'Approved', // Ready for Accounts

  // --- Purchase Order Flow ---
  DRAFT = 'Draft', // Lab is creating it
  PENDING_CHAIRMAN_REVIEW = 'Pending Chairman Review', // After Lab submits
  PENDING_STORE_PRICING = 'Pending Store Pricing', // After Chairman approves
  PENDING_AUDITOR_REVIEW = 'Pending Auditor Review', // After Store prices
  PENDING_FINAL_APPROVAL = 'Pending Final Approval', // After Auditor approves
  PO_COMPLETED = 'Purchase Order Completed',

  // --- Histology Flow ---
  PENDING_AUDITOR_APPROVAL = 'Pending Auditor Approval',
  PENDING_CHAIRMAN_APPROVAL = 'Pending Chairman Approval',
  HISTOLOGY_APPROVED = 'Histology Approved',

  // --- Payment Flow ---
  PAYMENT_PROCESSING = 'Payment Processing',
  PAID = 'Paid',

  // --- Common Statuses ---
  PROCESSED = 'Processed', // Kept for legacy standard reqs, can be phased out for PAID
  QUERIED = 'Queried',
  REJECTED = 'Rejected',
}


export interface RequisitionItem {
  id: string;
  requisition_id: string;
  name: string;
  quantity: number;
  description: string;
  supplier?: string;
  estimated_unit_cost?: number; // For Standard Requisitions
  stock_level?: number;        // For Purchase Orders
  unit_price?: number;         // For Purchase Orders, from Store
}

export interface HistologyItem {
  id: string;
  requisition_id: string;
  date: string;
  patient_name: string;
  hospital_no: string;
  lab_no: string;
  receipt_no: string; // Corresponds to RECEIPT NO/HMO/COY
  outsource_service: string;
  outsource_bills: number;
  zmc_charge: number;
  retainership: string;
}

export interface Message {
  id: string;
  requisition_id: string;
  sender_id: string;
  senderName?: string; // Joined from profiles
  text: string;
  timestamp: string;
}

export interface Signature {
  name: string;
  signature: string; // base64 data URL
  timestamp: string;
}

export interface ApprovalLog {
  id: string;
  requisition_id: string;
  timestamp: string;
  user_id: string;
  userName?: string; // Joined from profiles
  action: 'Submitted' | 'Approved' | 'Queried' | 'Processed' | 'Rejected' | 'Priced' | 'Reviewed' | 'Payment Added' | 'Marked as Paid' | 'Resubmitted';
  comment?: string;
  signature?: string; // base64 data URL
}

export interface Payment {
  id: string;
  requisition_id: string;
  amount: number;
  date: string;
  proof_path?: string; // Path in Supabase Storage
  recorded_by_id: string;
  recordedByName?: string; // Joined from profiles
  timestamp: string;
}

export interface Requisition {
  id: string;
  type: RequisitionType;
  department: 'Lab' | 'Pharmacy';
  requester_id: string;
  requesterName?: string; // Joined from profiles
  status: RequisitionStatus;
  total_estimated_cost: number;
  created_at: string;
  updated_at: string;
  queried_to?: 'Lab' | 'Pharmacy';
  previous_status_on_query?: RequisitionStatus;
  signatures?: {
    preparedBy?: Signature;
    levelConfirmedBy?: Signature;
    checkedBy?: Signature;
  };
  // Relational data, loaded separately
  items?: RequisitionItem[];
  histologyItems?: HistologyItem[];
  log?: ApprovalLog[];
  conversation?: Message[];
  payments?: Payment[];
}

export interface Notification {
  id: number;
  recipient_id: string;
  message: string;
  requisition_id: string;
  read: boolean;
  created_at: string;
}