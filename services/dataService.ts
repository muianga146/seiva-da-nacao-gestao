import { supabase } from './supabaseClient';
import { Transaction, Student } from '../types';

// --- TRANSACTIONS ---

export const fetchTransactions = async (): Promise<Transaction[] | null> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Supabase Error (fetchTransactions):', error.message);
    return null; // Return null to indicate error vs empty array
  }
  return data as Transaction[];
};

export const addTransactionToDb = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction | null> => {
  const { data, error } = await supabase
    .from('transactions')
    .insert([transaction])
    .select()
    .single();

  if (error) {
    console.error('Supabase Error (addTransactionToDb):', error.message);
    return null;
  }
  return data as Transaction;
};

export const deleteTransactionFromDb = async (id: string | number): Promise<boolean> => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase Error (deleteTransactionFromDb):', error.message);
    return false;
  }
  return true;
};

// --- STUDENTS ---

export const fetchStudents = async (): Promise<Student[] | null> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase Error (fetchStudents):', error.message);
    return null; // Return null to indicate error vs empty array
  }
  return data as Student[];
};

export const addStudentToDb = async (student: Omit<Student, 'id'>): Promise<Student | null> => {
  const { data, error } = await supabase
    .from('students')
    .insert([student])
    .select()
    .single();

  if (error) {
    console.error('Supabase Error (addStudentToDb):', error.message);
    return null;
  }
  return data as Student;
};

export const deleteStudentFromDb = async (id: string | number): Promise<boolean> => {
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase Error (deleteStudentFromDb):', error.message);
    return false;
  }
  return true;
};