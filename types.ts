import React from 'react';

export enum Status {
  DRAFT = 'Draft',
  PENDING_CHAIRMAN_REVIEW = 'Pending Chairman Review',
  PENDING_STORE_FULFILLMENT = 'Pending Store Fulfillment',
  PENDING_AUDIT_REVIEW = 'Pending Audit Review', // Audit 1
  PENDING_AUDIT_2_REVIEW = 'Pending Audit 2 Review', // Audit 2
  PENDING_FINAL_APPROVAL = 'Pending Final Approval', // Chairman (for some flows)
  PENDING_FINANCE_APPROVAL = 'Pending Finance Approval', // HOF
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  RETURNED = 'Returned',
  ORDERED = 'Ordered',
  DELIVERED = 'Delivered',
  SPLIT = 'Split (processed)'
}

export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Fully Paid';

export enum Priority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum Department {
  EMERGENCY = 'Emergency',
  PEDIATRICS = 'Pediatrics',
  SURGERY = 'Surgery',
  PHARMACY = 'Pharmacy',
  ADMINISTRATION = 'Administration',
  LABORATORY = 'Laboratory'
}

export enum UserRole {
  LAB_ADMIN = 'Lab Admin',
  PHARMACY_ADMIN = 'Pharmacy Admin',
  HEAD_OF_FINANCE = 'Head of Finance',
  ACCOUNTANT = 'Accountant',
  CHAIRMAN = 'Chairman',
  AUDITOR = 'Auditor'
}

export type RequisitionType = 
  | 'Lab Purchase Order' 
  | 'Equipment Request' 
  | 'Outsourced Histology Payment'
  | 'Pharmacy Purchase Order'
  | 'Emergency Request (1 month)'
  | 'Emergency Request (1 week)'
  | 'General Request';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: Department;
}

export interface RequisitionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedCost: number; // Used for initial estimates
  stockLevel?: number; // Added for Lab PO
  supplier?: string; // Added for Store fulfillment
  unitCost?: number; // Added for Store fulfillment (actual cost)
  category: string;
  // Added for Histology
  patientName?: string;
  labNumber?: string;
  retainership?: number;
  zmcCharge?: number;
}

export interface AuditLog {
  id: string;
  date: string;
  userName: string;
  userRole: UserRole;
  action: 'Created' | 'Approved' | 'Rejected' | 'Returned' | 'Updated' | 'Final Approval' | 'Consulted Audit' | 'Advice Submitted' | 'Split' | 'Payment Recorded';
  comment?: string;
  signature?: string; // Base64 image string
}

export interface Attachment {
  name: string;
  type: string;
  data: string; // Base64 string
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  reference: string;
  recordedBy: string;
  attachment?: Attachment;
}

export interface Requisition {
  id: string;
  type: RequisitionType;
  requesterName: string;
  requesterEmail: string; // Added for Notifications
  department: Department;
  date: string;
  status: Status;
  priority: Priority;
  items: RequisitionItem[];
  totalEstimatedCost: number;
  
  title?: string; // Added for Emergency Request (1 week) Header
  justification?: string; // Added for Equipment Request & Emergency Request Purpose
  beneficiary?: string; // Added for Emergency Request (1 month)
  amountInWords?: string; // Added for Emergency Request
  
  aiAnalysis?: string;
  auditTrail: AuditLog[];
  attachments: Attachment[]; // Updated from string[]
  
  // Financials
  amountPaid: number;
  paymentStatus: PaymentStatus;
  paymentRecords: PaymentRecord[];
}

export interface Notification {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  relatedRequisitionId?: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface NavItem {
  label: string;
  icon: React.ReactNode;
  id: string;
}