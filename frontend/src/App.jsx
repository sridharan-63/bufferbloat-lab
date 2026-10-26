import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SimulationProvider } from './context/SimulationContext';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import ToastContainer from './components/ToastContainer';

import OverviewPage from './pages/OverviewPage';
import TopologyPage from './pages/TopologyPage';
import ConfigurationPage from './pages/ConfigurationPage';
import RunPage from './pages/RunPage';
import AnalyticsPage from './pages/AnalyticsPage';
import QueueManagementPage from './pages/QueueManagementPage';
import ComparisonPage from './pages/ComparisonPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';

const ROUTE_TITLES = {
  '/': 'Performance Overview & BufferBloat Detection',
  '/topology': 'Interactive Dumbbell Network Topology',
  '/config': 'Simulation Configuration & Presets',
  '/run': 'Run NS-3 Simulation & Real-time Console',
  '/analytics': 'Performance Analytics & Multi-Chart Telemetry',
  '/queues': 'Queue Management & AQM Comparison',
  '/compare': 'Multi-Experiment Comparative Benchmarking',
  '/results': 'Simulation Results & CSV Data Export',
  '/settings': 'System Infrastructure & Daemon Settings',
};

function AppLayout() {
  const location = useLocation();
  const title = ROUTE_TITLES[location.pathname] || 'BufferBloat Lab';

  return (
    <div className="flex min-h-screen bg-navy-950 text-slate-100 font-sans selection:bg-brand-cyan selection:text-navy-950">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopNav title={title} />
        <main className="p-8 max-w-7xl mx-auto w-full flex-1">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/topology" element={<TopologyPage />} />
            <Route path="/config" element={<ConfigurationPage />} />
            <Route path="/run" element={<RunPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/queues" element={<QueueManagementPage />} />
            <Route path="/compare" element={<ComparisonPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SimulationProvider>
        <AppLayout />
      </SimulationProvider>
    </BrowserRouter>
  );
}
