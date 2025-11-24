import React, { useState } from 'react';
import { ICONS } from '../constants';
import { NavItem, User, Notification, UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (id: string) => void;
  user: User;
  onLogout: () => void;
  notifications: Notification[];
  onNotificationClick: (notif: Notification) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onLogout, notifications, onNotificationClick }) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Dynamic Navigation based on Role
  const NAV_ITEMS: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: ICONS.Dashboard },
    { id: 'requisitions', label: 'Requisitions', icon: ICONS.Requisitions },
    { id: 'inventory', label: 'Inventory', icon: ICONS.Inventory },
  ];

  // Add Reports for Accountants, Finance, and Chairman
  if (user.role === UserRole.ACCOUNTANT || user.role === UserRole.HEAD_OF_FINANCE || user.role === UserRole.CHAIRMAN) {
      NAV_ITEMS.push({ id: 'reports', label: 'Reports', icon: ICONS.Reports });
  }

  NAV_ITEMS.push({ id: 'settings', label: 'Settings', icon: ICONS.Settings });

  return (
    <aside className="h-screen w-64 bg-zankli-black text-white flex flex-col fixed left-0 top-0 z-50 shadow-2xl transition-all duration-300">
      {/* Logo Area */}
      <div className="p-8 flex items-center space-x-3 border-b border-gray-800 relative">
        <div className="w-8 h-8 bg-zankli-orange rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/50">
          <span className="font-bold text-white text-lg">Z</span>
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight">ZANKLI</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest">Medical Centre</p>
        </div>
      </div>

      {/* Notification Bar (Inbox) */}
      <div className="px-4 pt-4 pb-2">
          <div className="relative">
             <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`w-full border rounded-xl p-3 flex items-center justify-between transition-all group ${isNotifOpen ? 'bg-gray-800 border-zankli-orange' : 'bg-gray-900 hover:bg-gray-800 border-gray-800'}`}
             >
                 <div className="flex items-center space-x-2 text-sm text-gray-400 group-hover:text-white">
                     <svg className={`w-5 h-5 ${unreadCount > 0 ? 'text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                     </svg>
                     <span className={unreadCount > 0 ? 'font-bold text-white' : ''}>Inbox</span>
                 </div>
                 {unreadCount > 0 && (
                     <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-lg shadow-red-900/50">
                         {unreadCount}
                     </span>
                 )}
             </button>

             {/* Dropdown Inbox Panel */}
             {isNotifOpen && (
                 <div className="absolute top-14 left-0 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-[60] max-h-96 overflow-y-auto custom-scrollbar ring-1 ring-black/5">
                     <div className="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notifications</span>
                         <button onClick={() => setIsNotifOpen(false)} className="text-gray-400 hover:text-black p-1">✕</button>
                     </div>
                     {notifications.length === 0 ? (
                         <div className="p-8 text-center text-gray-400 text-xs">
                            <p className="mb-1">📭</p>
                            No new notifications
                         </div>
                     ) : (
                         <div className="divide-y divide-gray-100">
                             {notifications.map(notif => (
                                 <div 
                                    key={notif.id} 
                                    onClick={() => { onNotificationClick(notif); setIsNotifOpen(false); }}
                                    className={`p-3 cursor-pointer hover:bg-orange-50 transition-colors relative ${!notif.read ? 'bg-orange-50/40' : 'bg-white'}`}
                                 >
                                     {!notif.read && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-zankli-orange shadow-sm"></div>}
                                     <h4 className={`text-xs font-bold mb-0.5 pr-4 ${!notif.read ? 'text-zankli-orange' : 'text-gray-800'}`}>{notif.title}</h4>
                                     <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">{notif.message}</p>
                                     <span className="text-[10px] text-gray-400 mt-1.5 block font-medium">{new Date(notif.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             )}
          </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                isActive 
                  ? 'bg-zankli-orange text-white shadow-lg shadow-orange-900/20' 
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
               {/* Hover glow effect */}
               <div className={`absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isActive ? 'hidden' : ''}`} />
               
              <span className={`${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>
                {item.icon}
              </span>
              <span className="font-medium text-sm tracking-wide">{item.label}</span>
              
              {isActive && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white shadow-glow" />
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile Snippet */}
      <div className="p-4 border-t border-gray-800 bg-zankli-black z-10">
        <div className="flex items-center space-x-3 bg-gray-900/50 p-3 rounded-xl border border-gray-800 backdrop-blur-sm mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-gray-600 text-xs font-bold text-white shadow-inner">
                {user.name.charAt(0)}
            </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-[10px] text-gray-500 truncate uppercase tracking-wider">{user.role}</p>
          </div>
        </div>
        
        <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
        >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};