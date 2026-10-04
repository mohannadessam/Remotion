'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Point {
  month: string;
  emergency: number;
  surplus: number;
}

export default function HistoryChart({ data }: { data: Point[] }) {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e6df" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#737373' }} />
          <YAxis tick={{ fontSize: 12, fill: '#737373' }} width={60} />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toLocaleString('en-US')} ريال`,
              name === 'emergency' ? 'صندوق الطوارئ' : 'الفائض',
            ]}
            contentStyle={{ direction: 'rtl', fontFamily: 'Arial, Tahoma, sans-serif' }}
          />
          <Line type="monotone" dataKey="emergency" stroke="#173f35" strokeWidth={2.5} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="surplus" stroke="#b98b42" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
