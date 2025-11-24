import React from 'react';
import { Requisition, Status, Priority, Department, RequisitionType, UserRole } from './types';

export const LAB_REQUEST_TYPES: RequisitionType[] = [
  'Lab Purchase Order',
  'Equipment Request',
  'Outsourced Histology Payment'
];

export const PHARMACY_REQUEST_TYPES: RequisitionType[] = [
  'Pharmacy Purchase Order',
  'Emergency Request (1 month)',
  'Emergency Request (1 week)'
];

export const MOCK_REQUISITIONS: Requisition[] = [
  {
    id: 'REQ-2024-001',
    type: 'Lab Purchase Order',
    requesterName: 'Dr. Sarah Amadi',
    requesterEmail: 'labzankli@gmail.com',
    department: Department.SURGERY,
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: Status.PENDING_FINAL_APPROVAL,
    priority: Priority.HIGH,
    totalEstimatedCost: 125000,
    items: [
      { id: '1', name: 'Surgical Gloves (L)', quantity: 50, unit: 'Box', estimatedCost: 25000, stockLevel: 5, category: 'Consumables', supplier: 'MedPlus Ltd', unitCost: 500 },
      { id: '2', name: 'Anesthetic Agent', quantity: 10, unit: 'Vial', estimatedCost: 100000, stockLevel: 2, category: 'Pharmaceuticals', supplier: 'PharmaCare', unitCost: 10000 }
    ],
    auditTrail: [
      { id: 'a1', date: new Date(Date.now() - 86400000 * 2).toISOString(), userName: 'Dr. Sarah Amadi', userRole: UserRole.LAB_ADMIN, action: 'Created' },
      { id: 'a2', date: new Date(Date.now() - 86000000).toISOString(), userName: 'The Chairman', userRole: UserRole.CHAIRMAN, action: 'Approved', comment: 'Proceed.' },
      { id: 'a3', date: new Date(Date.now() - 80000000).toISOString(), userName: 'Pharmacy Admin', userRole: UserRole.PHARMACY_ADMIN, action: 'Updated', comment: 'Supplier details added.' },
      { id: 'a4', date: new Date(Date.now() - 40000000).toISOString(), userName: 'Auditor 1', userRole: UserRole.AUDITOR, action: 'Approved', comment: 'Prices verified.' }
    ],
    attachments: [],
    amountPaid: 0,
    paymentStatus: 'Unpaid',
    paymentRecords: []
  },
  {
    id: 'REQ-2024-002',
    type: 'Pharmacy Purchase Order',
    requesterName: 'Pharmacy Admin',
    requesterEmail: 'storezankli@gmail.com',
    department: Department.PHARMACY,
    date: new Date(Date.now() - 43200000).toISOString(),
    status: Status.PENDING_AUDIT_REVIEW,
    priority: Priority.MEDIUM,
    totalEstimatedCost: 45000,
    items: [
      { id: '3', name: 'Pediatric Cannula', quantity: 100, unit: 'Pcs', estimatedCost: 0, category: 'Consumables', supplier: 'Emzor', unitCost: 150, stockLevel: 20 },
      { id: '4', name: 'Paracetamol Syrup', quantity: 60, unit: 'Bottle', estimatedCost: 0, category: 'Pharmaceuticals', supplier: 'Fidson', unitCost: 500, stockLevel: 12 }
    ],
    auditTrail: [
      { id: 'a5', date: new Date(Date.now() - 43200000).toISOString(), userName: 'Pharmacy Admin', userRole: UserRole.PHARMACY_ADMIN, action: 'Created' }
    ],
    attachments: [],
    amountPaid: 0,
    paymentStatus: 'Unpaid',
    paymentRecords: []
  },
  {
    id: 'REQ-2024-003',
    type: 'Equipment Request',
    requesterName: 'Lab Tech Chioma',
    requesterEmail: 'labzankli@gmail.com',
    department: Department.LABORATORY,
    date: new Date().toISOString(),
    status: Status.PENDING_FINAL_APPROVAL,
    priority: Priority.CRITICAL,
    totalEstimatedCost: 850000,
    justification: 'Our current Hematology Analyzer has broken down completely after 5 years of use. Replacement is critical for daily operations.',
    items: [
      { id: '5', name: 'Hematology Analyzer 5-Part', quantity: 1, unit: 'Unit', estimatedCost: 850000, category: 'Equipment' }
    ],
    auditTrail: [
      { id: 'a6', date: new Date().toISOString(), userName: 'Lab Tech Chioma', userRole: UserRole.LAB_ADMIN, action: 'Created' }
    ],
    attachments: [],
    amountPaid: 0,
    paymentStatus: 'Unpaid',
    paymentRecords: []
  },
  {
    id: 'REQ-2024-004',
    type: 'Outsourced Histology Payment',
    requesterName: 'Dr. Sarah Amadi',
    requesterEmail: 'labzankli@gmail.com',
    department: Department.LABORATORY,
    date: new Date().toISOString(),
    status: Status.PENDING_AUDIT_REVIEW,
    priority: Priority.HIGH,
    totalEstimatedCost: 45000,
    items: [
        { id: '7', name: 'Histology Analysis', quantity: 1, unit: 'Test', estimatedCost: 45000, category: 'Outsourced', patientName: 'John Okafor', labNumber: 'L24-098', retainership: 5000, zmcCharge: 2000 }
    ],
    auditTrail: [
        { id: 'a7', date: new Date().toISOString(), userName: 'Dr. Sarah Amadi', userRole: UserRole.LAB_ADMIN, action: 'Created' }
    ],
    attachments: [],
    amountPaid: 0,
    paymentStatus: 'Unpaid',
    paymentRecords: []
  },
  {
    id: 'REQ-2024-005',
    type: 'Emergency Request (1 month)',
    requesterName: 'Pharmacy Admin',
    requesterEmail: 'storezankli@gmail.com',
    department: Department.PHARMACY,
    date: new Date().toISOString(),
    status: Status.PENDING_AUDIT_2_REVIEW,
    priority: Priority.CRITICAL,
    totalEstimatedCost: 257500,
    beneficiary: 'Geneith Pharmaceuticals Limited',
    justification: 'Payment for drugs supplied (Emergency stock out)',
    amountInWords: 'TWO HUNDRED AND FIFTY SEVEN THOUSAND FIVE HUNDRED NAIRA ONLY',
    items: [
      { id: '8', name: 'Emergency Payment', quantity: 1, unit: 'Lot', estimatedCost: 257500, category: 'Emergency' }
    ],
    auditTrail: [
        { id: 'a8', date: new Date().toISOString(), userName: 'Pharmacy Admin', userRole: UserRole.PHARMACY_ADMIN, action: 'Created' }
    ],
    attachments: [],
    amountPaid: 0,
    paymentStatus: 'Unpaid',
    paymentRecords: []
  }
];

export const ICONS = {
  Dashboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Requisitions: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>,
  Inventory: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Plus: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  AI: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Reports: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
};