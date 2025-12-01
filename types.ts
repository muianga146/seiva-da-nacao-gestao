
export enum ViewState {
  DASHBOARD = 'dashboard',
  INCOMES = 'incomes',
  EXPENSES = 'expenses',
  STUDENTS = 'students',
  REPORTS = 'reports',
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
  type: string; // Mantido para compatibilidade, mas idealmente derivado do account_code
  description: string;
  amount: number;
  category: 'income' | 'expense';
  paymentMethod?: string;
  recurrence?: 'monthly' | 'one-time';
  account_code?: string; // Novo campo para o Plano de Contas (Ex: "6.2")
  student_id?: string | number; // ID do aluno vinculado
  student_name?: string; // Nome do aluno (cache para facilitar exibição)
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

export interface PGCAccount {
  code: string;
  name: string;
  class: string; // "1", "2", "6", etc.
}
