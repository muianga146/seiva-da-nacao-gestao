export enum ViewState {
  DASHBOARD = 'dashboard',
  INCOMES = 'incomes',
  EXPENSES = 'expenses',
  STUDENTS = 'students',
  SETTINGS = 'settings',
  AI_TOOLS = 'ai_tools',
}

export enum ImageSize {
  SIZE_1K = '1K',
  SIZE_2K = '2K',
  SIZE_4K = '4K',
}

export interface Transaction {
  id: string | number;
  date: string;
  type: string;
  description: string;
  amount: number;
  category: 'income' | 'expense';
  paymentMethod?: string; // Novo campo
  recurrence?: 'monthly' | 'one-time';
}

export interface Student {
  id: string | number;
  name: string;
  class: string;
  guardian: string;
  status: 'Paid' | 'Late' | 'Pending';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}