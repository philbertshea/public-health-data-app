import { useState, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, ShieldAlert, Calendar } from 'lucide-react';

interface DiseaseData {
  epi_week: number;
  start_date: string;
  end_date: string;
  [key: string]: string | number; // Handles dynamic disease counters
}

export default function App() {
  const [data, setData] = useState<DiseaseData[]>([]);
  const [diseases, setDiseases] = useState<string[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const response = await fetch('/weekly_infectious_bulletin_data.json');
        const json: DiseaseData[] = await response.json();
        
        setData(json);

        // Extract available disease fields dynamically from keys
        if (json.length > 0) {
          const keys = Object.keys(json[0]).filter(
            (key) => !['epi_week', 'start_date', 'end_date'].includes(key)
          );
          setDiseases(keys);
          if (keys.length > 0) setSelectedDisease(keys[0]); // Default to first disease
        }
      } catch (error) {
        console.error('Error loading time series metrics:', error);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-xl font-medium text-slate-200">
        Warming up data visualizations...
      </div>
    );
  }

  // Calculate high-level metrics for the analytics cards
  const totalCases = data.reduce((sum, item) => sum + (Number(item[selectedDisease]) || 0), 0);
  const maxWeek = data.reduce((max, item) => (Number(item[selectedDisease]) > (Number(max[selectedDisease]) || 0) ? item : max), data[0] || {});

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Panel */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="text-emerald-400" size={32} />
            Infectious Disease Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Weekly time-series tracking driven by an automated Go ingestion engine.</p>
        </div>
        
        {/* Dropdown Disease Selection Menu */}
        <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700">
          <label htmlFor="disease-select" className="text-sm font-medium text-slate-300 pl-2">Track Vector:</label>
          <select
            id="disease-select"
            className="bg-slate-900 text-white border border-slate-600 rounded px-3 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer capitalize text-sm"
            value={selectedDisease}
            onChange={(e) => setSelectedDisease(e.target.value)}
          >
            {diseases.map((disease) => (
              <option key={disease} value={disease}>
                {disease.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Analytics KPI Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400"><Activity size={24} /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Cumulative YTD Cases</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totalCases.toLocaleString()}</h3>
          </div>
        </div>
        
        <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 rounded-lg text-rose-400"><ShieldAlert size={24} /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Peak Weekly Count</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">
              {maxWeek[selectedDisease] ? String(maxWeek[selectedDisease]) : '0'} <span className="text-xs text-slate-400 font-normal">cases</span>
            </h3>
          </div>
        </div>
        
        <div className="bg-slate-800 border border-slate-700/60 p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><Calendar size={24} /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Peak Epi-Week Timeline</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">
              Week {String(maxWeek.epi_week || 'N/A')}
            </h3>
          </div>
        </div>
      </section>

      {/* Main Chart Card */}
      <main className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-xl">
        <h2 className="text-xl font-semibold text-white mb-6 capitalize flex items-center gap-2">
          Weekly Timeline Metric: {selectedDisease.replace(/_/g, ' ')}
        </h2>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis 
                dataKey="epi_week" 
                stroke="#94a3b8" 
                tickFormatter={(value) => `Wk ${value}`}
              />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#fff' }}
                labelFormatter={(label) => `Epidemiological Week ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey={selectedDisease} 
                stroke="#10b981" 
                strokeWidth={3} 
                activeDot={{ r: 8 }} 
                dot={{ strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}