import React from 'react';
import { Status, Priority } from '../types';

export const StatusBadge: React.FC<{ status: Status }> = ({ status }) => {
  const styles = {
    [Status.DRAFT]: 'bg-gray-100 text-gray-600 border-gray-200',
    [Status.PENDING_CHAIRMAN_REVIEW]: 'bg-purple-100 text-purple-700 border-purple-200',
    [Status.PENDING_STORE_FULFILLMENT]: 'bg-blue-100 text-blue-700 border-blue-200',
    [Status.PENDING_AUDIT_REVIEW]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    [Status.PENDING_AUDIT_2_REVIEW]: 'bg-amber-100 text-amber-800 border-amber-200',
    [Status.PENDING_FINAL_APPROVAL]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [Status.PENDING_FINANCE_APPROVAL]: 'bg-teal-100 text-teal-700 border-teal-200',
    [Status.APPROVED]: 'bg-green-100 text-green-700 border-green-200',
    [Status.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
    [Status.RETURNED]: 'bg-orange-100 text-orange-700 border-orange-200',
    [Status.ORDERED]: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    [Status.DELIVERED]: 'bg-gray-800 text-white border-gray-900',
    [Status.SPLIT]: 'bg-gray-200 text-gray-500 border-gray-300 line-through',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-medium border uppercase tracking-wide whitespace-nowrap ${styles[status]}`}>
      {status}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => {
    const styles = {
        [Priority.LOW]: 'text-gray-500',
        [Priority.MEDIUM]: 'text-blue-500',
        [Priority.HIGH]: 'text-orange-600 font-semibold',
        [Priority.CRITICAL]: 'text-red-600 font-bold animate-pulse'
    }
    
    return (
        <span className={`text-xs uppercase tracking-wider ${styles[priority]}`}>
            {priority}
        </span>
    )
}