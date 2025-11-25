import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendColor?: 'text-green-500' | 'text-red-500' | 'text-yellow-500';
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, trendColor, color = "text-slate-400" }) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 p-4 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <Icon size={18} className={color} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend && (
          <span className={`text-xs font-medium mb-1 ${trendColor || 'text-slate-500'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};