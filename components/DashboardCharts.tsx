import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface CashFlowProps {
  data: { name: string; entrada: number; saida: number }[];
}

interface TrendProps {
  data: { name: string; income: number; expense: number }[];
}

export const CashFlowChart = ({ data }: CashFlowProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" />
        <Tooltip 
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value: number) => [`MZN ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
        />
        <Legend />
        <Bar dataKey="entrada" name="Entradas" fill="#13ec80" radius={[4, 4, 0, 0]} />
        <Bar dataKey="saida" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const TrendChart = ({ data }: TrendProps) => {
    return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 0,
              bottom: 0,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="#9ca3af" />
            <YAxis axisLine={false} tickLine={false} stroke="#9ca3af" tickFormatter={(value) => `${value / 1000}k`} />
            <Tooltip formatter={(value: number) => [`MZN ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']} />
            <Area type="monotone" dataKey="income" stackId="1" stroke="#13ec80" fill="#13ec80" fillOpacity={0.6} name="Receitas" />
            <Area type="monotone" dataKey="expense" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Despesas" />
          </AreaChart>
        </ResponsiveContainer>
      );
}