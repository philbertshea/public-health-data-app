import { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Activity, ShieldAlert, Calendar } from 'lucide-react';
import { parse, format } from 'date-fns';

interface DiseaseData {
  epi_week: number;
  start_date: string;
  end_date: string;
  [key: string]: string | number; // Handles dynamic disease counters
}

const parseAndFormatDate = (dateString: string, includeYear = false) => {
  if (!dateString) return '';

  const parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());

  // 3. Format it beautifully into "11 May" or "11 May 2026"
  return format(parsedDate, includeYear ? 'd MMM yyyy' : 'd MMM');
};

export default function App() {
  const [data, setData] = useState<DiseaseData[]>([]);
  const [diseases, setDiseases] = useState<string[]>([]);
  const [selectedDisease, setSelectedDisease] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const response = await fetch('/weekly_infectious_bulletin_data.json');
        const json: DiseaseData[] = await response.json();

        setData(json);

        setTimeout(() => {
          if (chartContainerRef.current) {
            chartContainerRef.current.scrollLeft = chartContainerRef.current.scrollWidth;
          }
        }, 100);

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
  const latestRecord = data.length > 0 ? data[data.length - 1] : null;
  const latestCases = latestRecord ? (Number(latestRecord[selectedDisease]) || 0) : 0;
  const latestWeekNum = latestRecord ? latestRecord.epi_week : 'N/A';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header Panel */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="text-emerald-400" size={32} />
            Singapore Infectious Disease Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Infectious Disease Statistics pulled from <a href="https://www.cda.gov.sg/resources/weekly-infectious-diseases-bulletin-2026/">Weekly Infectious Diseases Bulletin</a>.</p>
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
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Latest Week Figures</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">
              {latestCases.toLocaleString()} <span className="text-xs text-slate-400 font-normal">cases in Week {latestWeekNum}</span>
            </h3>
          </div>
        </div>

        <div className="hidden md:flex bg-slate-800 border border-slate-700/60 p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400"><Activity size={24} /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Cumulative YTD Cases</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">{totalCases.toLocaleString()}</h3>
          </div>
        </div>

        <div className="hidden md:flex bg-slate-800 border border-slate-700/60 p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 rounded-lg text-rose-400"><ShieldAlert size={24} /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium">Peak Weekly Count</p>
            <h3 className="text-2xl font-bold text-white mt-0.5">
              {maxWeek[selectedDisease] ? String(maxWeek[selectedDisease]) : '0'} <span className="text-xs text-slate-400 font-normal">cases in Week {String(maxWeek.epi_week || 'N/A')}</span>
            </h3>
          </div>
        </div>

      </section>

      {/* Main Chart Canvas */}
      <main className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-2">
          <h2 className="text-xl font-semibold text-white capitalize flex items-center gap-2">
            Weekly Timeline Metric: {selectedDisease.replace(/_/g, ' ')}
          </h2>
          <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-700">
            👈 Scroll left to view historical data
          </span>
        </div>

        {/* Unified Flex Wrapper to hold the locked Y-Axis and the scrollable viewport side-by-side */}
        <div className="flex h-[400px] w-full relative">

          {/* COMPONENT 1: FIXED Y-AXIS BAR */}
          {/* We lock this to a exact width and hide the horizontal components */}
          <div className="w-[60px] h-full flex-shrink-0 bg-slate-800 z-10 pr-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 24 }}>
                {/* Clone the precise YAxis configuration so ticks map perfectly */}
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                {/* We pass an invisible line so the chart assigns the correct scale, but displays nothing else */}
                <Line type="monotone" dataKey={selectedDisease} stroke="transparent" dot={false} activeDot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* COMPONENT 2: SCROLLABLE TIMELINE WINDOW */}
          {/* This outer frame handles the horizontal finger swipes or scrollbars */}
          <div
            ref={chartContainerRef}
            className="flex-grow h-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
          >
            {/* The canvas scales out dynamically based on the total week records in your dataset */}
            <div
              style={{
                width: data.length > 10 ? `${(data.length / 10) * 100}%` : '100%',
                minWidth: '100%'
              }}
              className="h-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 30, left: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

                  {/* The X-Axis lives natively inside here so it slides with the weeks */}
                  <XAxis
                    dataKey="start_date"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(val) => parseAndFormatDate(val)}
                  />

                  {/* Hide the duplicate Y-Axis numbers in this window, but keep the axis line layout for scale reference */}
                  <YAxis stroke="transparent" tick={false} width={0} />

                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#fff' }}
                    // Custom label formatter to print the absolute date range window
                    labelFormatter={(value, items) => {
                      // Look up the full data node matching this specific timeline node
                      const record = items[0]?.payload;
                      if (record) {
                        const start = parseAndFormatDate(record.start_date, true);
                        const end = parseAndFormatDate(record.end_date, true);
                        return `Epi-Week ${record.epi_week} (${start} – ${end})`;
                      }
                      return `Timeline Node: ${value}`;
                    }}
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
          </div>

        </div>
      </main>

      {/* Disclaimer */}
      <p className="text-slate-400 mt-1">Information may contain errors. Check Government websites for the most updated information.</p>
    </div>
  );
}