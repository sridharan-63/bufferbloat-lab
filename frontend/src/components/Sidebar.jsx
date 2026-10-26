import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Sliders,
  Play,
  LineChart,
  ListOrdered,
  GitCompare,
  FileSpreadsheet,
  Settings,
  Activity
} from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export default function Sidebar() {
  const { controllerStatus } = useSimulation();

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/topology', label: 'Network Topology', icon: Network },
    { to: '/config', label: 'Simulation Config', icon: Sliders },
    { to: '/run', label: 'Run Simulation', icon: Play },
    { to: '/analytics', label: 'Performance Analytics', icon: LineChart },
    { to: '/queues', label: 'Queue Management', icon: ListOrdered },
    { to: '/compare', label: 'Experiment Compare', icon: GitCompare },
    { to: '/results', label: 'Results & Reports', icon: FileSpreadsheet },
    { to: '/settings', label: 'Settings & Status', icon: Settings },
  ];

  return (
    <aside className="w-64 min-w-64 h-screen sticky top-0 bg-navy-900 border-r border-navy-700/60 flex flex-col z-50">
      {/* Brand Header */}
      <div className="p-5 border-b border-navy-700/60 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center text-white shadow-glow">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-100 tracking-tight">BufferBloat Lab</h1>
          <span className="text-[10px] font-mono uppercase text-brand-teal tracking-wider">NS-3.46 Discrete Engine</span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'text-brand-cyan bg-brand-cyan/10 border border-brand-cyan/25 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-navy-800/60 border border-transparent'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="p-4 border-t border-navy-700/60 bg-navy-950/40 text-xs">
        <div className="flex items-center justify-between text-slate-400">
          <span>C Socket Daemon</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                controllerStatus.online
                  ? controllerStatus.isRunning
                    ? 'bg-brand-amber animate-pulse shadow-[0_0_8px_#f59e0b]'
                    : 'bg-brand-emerald shadow-[0_0_8px_#10b981]'
                  : 'bg-brand-rose'
              }`}
            />
            <span className="font-mono text-[11px] text-slate-300">
              {controllerStatus.online
                ? controllerStatus.isRunning
                  ? 'Simulating...'
                  : 'Port 8088'
                : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
