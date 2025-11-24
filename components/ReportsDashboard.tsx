import React from 'react';
import { Requisition, Status, Department } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts';

interface ReportsDashboardProps {
  requisitions: Requisition[];
}

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({ requisitions }) => {
  
  // 1. Financial Cards
  const approvedReqs = requisitions.filter(r => r.status === Status.APPROVED || r.status === Status.ORDERED || r.status === Status.DELIVERED || r.status.includes('Paid'));
  
  const totalLiability = approvedReqs.reduce((sum, r) => sum + r.totalEstimatedCost, 0);
  const totalPaid = approvedReqs.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const outstanding = totalLiability - totalPaid;

  // 2. Top Purchased Items
  const itemCounts: Record<string, number> = {};
  approvedReqs.forEach(req => {
      req.items.forEach(item => {
          if (item.name) {
              const name = item.name.trim();
              itemCounts[name] = (itemCounts[name] || 0) + (item.quantity || 0);
          }
      });
  });
  const topItemsData = Object.entries(itemCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

  // 3. Departmental Spend
  const deptSpend: Record<string, number> = {};
  approvedReqs.forEach(req => {
      deptSpend[req.department] = (deptSpend[req.department] || 0) + req.totalEstimatedCost;
  });
  const deptSpendData = Object.entries(deptSpend).map(([name, value]) => ({ name, value }));
  const COLORS = ['#CC5500', '#1E1E1E', '#888888', '#0088FE', '#00C49F', '#FFBB28'];

  // 4. Monthly Cash Flow (Simulated based on payment records)
  // Aggregate payments by month
  const paymentsByMonth: Record<string, number> = {};
  requisitions.forEach(req => {
      req.paymentRecords?.forEach(rec => {
          const month = new Date(rec.date).toLocaleString('default', { month: 'short' });
          paymentsByMonth[month] = (paymentsByMonth[month] || 0) + rec.amount;
      });
  });
  const cashFlowData = Object.entries(paymentsByMonth).map(([name, amount]) => ({ name, amount }));

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
        <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-3xl font-bold text-zankli-black">Financial Reports</h1>
                <p className="text-gray-500 mt-1">Overview of procurement spend and liabilities</p>
            </div>
            <button 
                onClick={() => window.print()} 
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 flex items-center"
            >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Report
            </button>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold uppercase text-gray-500 tracking-wider">Total Liability (Approved)</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">₦{totalLiability.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold uppercase text-gray-500 tracking-wider">Total Paid (YTD)</p>
                <p className="text-3xl font-bold text-green-600 mt-2">₦{totalPaid.toLocaleString()}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs font-bold uppercase text-gray-500 tracking-wider">Outstanding Balance</p>
                <p className="text-3xl font-bold text-red-600 mt-2">₦{outstanding.toLocaleString()}</p>
            </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Top Items */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6">Top 10 Purchased Items (Qty)</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topItemsData} layout="vertical" margin={{ left: 40 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={120} style={{ fontSize: '10px' }} />
                            <Tooltip cursor={{fill: '#f5f5f5'}} />
                            <Bar dataKey="count" fill="#CC5500" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Department Spend */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-6">Spend by Department</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={deptSpendData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {deptSpendData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {deptSpendData.map((entry, index) => (
                        <div key={index} className="flex items-center text-xs">
                            <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span>{entry.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Cash Flow */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-800 mb-6">Monthly Payment Outflow</h3>
             <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={cashFlowData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                         <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} tickFormatter={(val) => `₦${val/1000}k`} />
                         <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                         <Area type="monotone" dataKey="amount" stroke="#1E1E1E" fill="rgba(30,30,30,0.1)" strokeWidth={3} />
                     </AreaChart>
                 </ResponsiveContainer>
             </div>
        </div>
    </div>
  );
};