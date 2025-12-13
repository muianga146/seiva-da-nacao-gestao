
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ViewState, Transaction, Student, ImageSize, ChatMessage, PGCAccount } from './types';
import { CashFlowChart } from './components/DashboardCharts';
import { generateImage, chatWithAI, generateSpeech } from './services/geminiService';
import { generateReceipt, generateMonthlyReport } from './services/pdfService';
import { signIn, signUp, signOut } from './services/authService';
import { supabase } from './services/supabaseClient';
import { 
  fetchTransactions, 
  addTransactionToDb, 
  deleteTransactionFromDb, 
  fetchStudents, 
  addStudentToDb, 
  deleteStudentFromDb,
  updateStudentStatus
} from './services/dataService';

// --- CONSTANTS ---
const SCHOOL_CLASSES = ["1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"];
const PAYMENT_METHODS = ["Numerário", "M-Pesa", "Transferência", "POS"];
// Updated to Google Drive Direct Link from user request
const DEFAULT_LOGO = "https://drive.google.com/uc?export=view&id=1-EoFPUZzWgms4VoE5uoYXBwOphg8Fz1J";

// ADMIN CREDENTIALS
const MASTER_EMAIL = "cleytonbmuianga@gmail.com";
const MASTER_PASS = "Seivadanacaomussumbuluco2026";

// TUITION LOGIC CONSTANTS
const BASE_TUITION_VALUE = 2310;
const PENALTY_DAY_THRESHOLD = 10; // Until day 10 is normal
const PENALTY_PERCENTAGE = 0.25; // 25%

// Helper to get current date in Maputo Timezone (YYYY-MM-DD)
const getMaputoDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Maputo' });
};

// --- PGC-NIRF CHART OF ACCOUNTS ---
const PGC_ACCOUNTS: PGCAccount[] = [
  // Classe 1: Meios financeiros
  { code: "1.1", name: "Caixa", class: "1" },
  { code: "1.2", name: "Bancos", class: "1" },
  { code: "1.3", name: "Outros meios financeiros", class: "1" },
  
  // Classe 2: Inventários e activos biológicos
  { code: "2.1", name: "Compras", class: "2" },
  { code: "2.2", name: "Mercadorias", class: "2" },
  { code: "2.3", name: "Produtos acabados e intermédios", class: "2" },
  { code: "2.6", name: "Matérias primas, auxiliares e materiais", class: "2" },
  
  // Classe 3: Investimentos de Capital
  { code: "3.2", name: "Activos Tangíveis (Mobiliário, Equipamentos)", class: "3" },
  { code: "3.3", name: "Activos Intangíveis (Software, Licenças)", class: "3" },
  
  // Classe 4: Contas a receber/pagar
  { code: "4.1", name: "Clientes (Pais/Alunos)", class: "4" },
  { code: "4.2", name: "Fornecedores", class: "4" },
  { code: "4.4", name: "Estado", class: "4" },
  
  // Classe 5: Capital Próprio
  { code: "5.1", name: "Capital", class: "5" },
  
  // Classe 6: Gastos e Perdas (DESPESAS)
  { code: "6.1", name: "Custo dos Inventários", class: "6" },
  { code: "6.2", name: "Gastos com Pessoal (Salários, INSS)", class: "6" },
  { code: "6.3", name: "Fornecimento de Serviços de Terceiros (Água, Luz, Net)", class: "6" },
  { code: "6.5", name: "Amortizações do período", class: "6" },
  { code: "6.8", name: "Outros Gastos e Perdas Operacionais", class: "6" },
  { code: "6.9", name: "Gastos e Perdas Financeiros (Juros, Taxas)", class: "6" },
  
  // Classe 7: Rendimentos e Ganhos (RECEITAS)
  { code: "7.1", name: "Vendas (Uniformes, Livros)", class: "7" },
  { code: "7.2", name: "Prestação de serviços (Mensalidades, Matrículas)", class: "7" },
  { code: "7.5", name: "Rendimentos Suplementares", class: "7" },
  { code: "7.6", name: "Outros Rendimentos Operacionais", class: "7" },
  { code: "7.8", name: "Rendimentos Financeiros", class: "7" },
];

const getAccountsForTransactionType = (type: 'income' | 'expense') => {
  if (type === 'income') {
    // Receitas geralmente Classe 7, mas pode incluir vendas de ativos
    return PGC_ACCOUNTS.filter(acc => acc.class === "7" || acc.code === "1.1" || acc.code === "1.2"); 
  } else {
    // Despesas geralmente Classe 6, mas inclui compras de ativos (Classe 2 e 3)
    return PGC_ACCOUNTS.filter(acc => ["2", "3", "6"].includes(acc.class) || ["4.2", "4.4"].includes(acc.code));
  }
};

type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semestral' | 'annual';

// --- SUB-COMPONENTS ---

const SidebarItem = ({ icon, label, active, onClick, highlight = false }: { icon: string, label: string, active: boolean, onClick: () => void, highlight?: boolean }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
      active 
        ? highlight ? 'bg-primary text-white shadow-md' : 'bg-primary/10 text-primary-dark dark:text-primary'
        : 'text-text-secondary hover:bg-gray-100 dark:hover:bg-white/5 dark:text-gray-400 hover:text-text-main dark:hover:text-white'
    }`}
  >
    <span className={`material-symbols-outlined ${active || highlight ? 'fill' : ''}`}>{icon}</span>
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const Card = ({ title, value, trend, positive = true, icon }: { title: string, value: string, trend?: string, positive?: boolean, icon?: string }) => (
  <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4 transition-all hover:shadow-md">
    <div className="flex items-center gap-2 text-text-secondary dark:text-gray-400">
      {icon && <span className="material-symbols-outlined text-xl">{icon}</span>}
      <span className="font-medium text-sm">{title}</span>
    </div>
    <div>
      <h3 className="text-3xl font-bold text-text-main dark:text-white tracking-tight">{value}</h3>
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-sm font-bold ${positive ? 'text-positive' : 'text-negative'}`}>
          <span className="material-symbols-outlined text-base">{positive ? 'trending_up' : 'trending_down'}</span>
          <span>{trend}</span>
        </div>
      )}
    </div>
  </div>
);

// --- MODAL COMPONENT ---
const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children?: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-dark rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-surface-dark z-10">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  // AUTH STATE
  const [session, setSession] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // APP VIEW STATE
  const [activeView, setActiveView] = useState<ViewState>(ViewState.DASHBOARD);
  
  // DATA STATE
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dbError, setDbError] = useState(false);

  // DASHBOARD STATE
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>('annual');

  // SETTINGS STATE
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(localStorage.getItem('schoolLogoUrl') || DEFAULT_LOGO);

  // STUDENTS VIEW STATE
  const [selectedClassTab, setSelectedClassTab] = useState(SCHOOL_CLASSES[0]);

  // REPORTS STATE
  const [reportMonth, setReportMonth] = useState(new Date().getMonth());
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // MODAL STATE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'student' | 'transaction' | null>(null);
  const [transactionCategory, setTransactionCategory] = useState<'income' | 'expense'>('income');
  const [isSaving, setIsSaving] = useState(false);
  
  // RECEIPT STATE
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // FORMS STATE
  const [newStudent, setNewStudent] = useState({ name: '', class: SCHOOL_CLASSES[0], guardian: '', status: 'Pending' });
  const [newTransaction, setNewTransaction] = useState<{
      type: string;
      description: string;
      amount: string;
      date: string;
      paymentMethod: string;
      account_code: string;
      student_id?: string | number;
      student_name?: string;
  }>({ 
      type: '', 
      description: '', 
      amount: '', 
      date: getMaputoDate(), // Use Maputo Timezone
      paymentMethod: 'Numerário',
      account_code: '',
      student_id: '',
      student_name: ''
  });

  // STUDENT SEARCH STATE (FOR TRANSACTION MODAL)
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [showStudentSuggestions, setShowStudentSuggestions] = useState(false);

  // AI State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  const [ttsText, setTtsText] = useState('');
  const [isTtsLoading, setIsTtsLoading] = useState(false);

  // --- EFFECT: AUTH SESSION ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- EFFECT: LOAD DATA AND SYNC STATUS ---
  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    setIsLoadingData(true);
    setDbError(false);
    try {
      // Fetch raw data
      const [txsResult, stusResult] = await Promise.all([
          fetchTransactions(),
          fetchStudents()
      ]);

      if (txsResult === null || stusResult === null) {
        setDbError(true);
        setTransactions([]);
        setStudents([]);
        return;
      }

      setTransactions(txsResult);

      // --- LOGIC: SYNC STUDENT STATUS BASED ON CURRENT MONTH ---
      const now = new Date();
      // Mês atual REAL (1-12) para comparar com a string da data "YYYY-MM-DD"
      const currentRealMonth = now.getMonth() + 1; 
      const currentYear = now.getFullYear();
      const currentDay = now.getDate();

      const syncedStudents = await Promise.all(stusResult.map(async (student) => {
          // Check if this student paid tuition in the CURRENT month
          // Tuition account code = '7.2'
          const hasPaidThisMonth = txsResult.some(t => {
              // Parse date string directly to avoid timezone issues: "2024-12-01" -> [2024, 12, 01]
              const [tYear, tMonth] = t.date.split('-').map(Number);
              
              return t.category === 'income' &&
                     String(t.student_id) === String(student.id) &&
                     t.account_code === '7.2' &&
                     tMonth === currentRealMonth &&
                     tYear === currentYear;
          });

          let correctStatus: 'Paid' | 'Late' | 'Pending' = 'Pending';

          if (hasPaidThisMonth) {
              correctStatus = 'Paid';
          } else {
              // If no payment, check date for penalty
              if (currentDay > PENALTY_DAY_THRESHOLD) {
                  correctStatus = 'Late';
              } else {
                  correctStatus = 'Pending';
              }
          }

          // If status in DB is different from reality, update it
          if (student.status !== correctStatus) {
              // Update in DB (fire and forget for performance in loop, or await if critical)
              await updateStudentStatus(student.id, correctStatus);
              // Return updated object for local state
              return { ...student, status: correctStatus };
          }

          return student;
      }));

      setStudents(syncedStudents);

    } catch (error) {
      console.error("Failed to load data", error);
      setDbError(true);
    } finally {
      setIsLoadingData(false);
    }
  };

  // --- EFFECT: AUTO-CALCULATE TUITION WITH PENALTY ---
  useEffect(() => {
    // Só aplica a lógica se for Receita e for o código 7.2 (Prestação de serviços - Mensalidades)
    if (transactionCategory === 'income' && newTransaction.account_code === '7.2') {
        const dateObj = new Date(newTransaction.date);
        const day = dateObj.getDate();
        
        // Regra de negócio: Dia > 10 aplica multa de 25%
        let calculatedAmount = BASE_TUITION_VALUE;
        
        if (day > PENALTY_DAY_THRESHOLD) {
            calculatedAmount = BASE_TUITION_VALUE * (1 + PENALTY_PERCENTAGE);
        }

        // Atualiza o valor no formulário
        setNewTransaction(prev => ({
            ...prev,
            amount: calculatedAmount.toString()
        }));
    }
  }, [newTransaction.date, newTransaction.account_code, transactionCategory]);


  // --- DERIVED DATA FOR DASHBOARD ---
  const dashboardData = useMemo(() => {
    const today = new Date();
    
    // Filter logic based on selected period
    const isInPeriod = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const txDate = new Date(year, month - 1, day);
        
        switch (dashboardPeriod) {
            case 'daily':
                return txDate.toDateString() === today.toDateString();
            case 'weekly': {
                const oneWeekAgo = new Date(today);
                oneWeekAgo.setDate(today.getDate() - 7);
                return txDate >= oneWeekAgo && txDate <= today;
            }
            case 'monthly':
                return txDate.getMonth() === today.getMonth() && txDate.getFullYear() === today.getFullYear();
            case 'quarterly': {
                const currentQuarter = Math.floor(today.getMonth() / 3);
                const txQuarter = Math.floor(txDate.getMonth() / 3);
                return txQuarter === currentQuarter && txDate.getFullYear() === today.getFullYear();
            }
            case 'semestral': {
                const currentSemester = today.getMonth() < 6 ? 0 : 1;
                const txSemester = txDate.getMonth() < 6 ? 0 : 1;
                return txSemester === currentSemester && txDate.getFullYear() === today.getFullYear();
            }
            case 'annual':
                return txDate.getFullYear() === today.getFullYear();
            default:
                return true;
        }
    };

    const filteredTransactions = transactions.filter(t => isInPeriod(t.date));

    const income = filteredTransactions.filter(t => t.category === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = filteredTransactions.filter(t => t.category === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    const balance = income - expense;

    // Monthly Data for Bar Chart - Always show 12 months of CURRENT year
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Initialize array with all 12 months zeroed out
    const chartData = monthNames.map(name => ({ name, entrada: 0, saida: 0 }));
    
    const currentYear = new Date().getFullYear();

    transactions.forEach(t => {
        // Parse date reliably from string "YYYY-MM-DD"
        const parts = t.date.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]); // 1-12
            
            // Only aggregate for current year
            if (year === currentYear) {
                // Adjust to 0-11 index
                const index = month - 1;
                
                if (index >= 0 && index < 12) {
                    if (t.category === 'income') chartData[index].entrada += t.amount;
                    else chartData[index].saida += t.amount;
                }
            }
        }
    });
    
    return { income, expense, balance, chartData };
  }, [transactions, dashboardPeriod]);

  // --- STUDENT SEARCH FILTER ---
  const filteredStudents = useMemo(() => {
      if (!studentSearchTerm) return [];
      return students.filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())).slice(0, 5);
  }, [students, studentSearchTerm]);


  // --- HANDLERS ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
        // Attempt normal Sign In
        const { error } = await signIn(authEmail, authPassword);
        
        if (error) {
             // AUTO-PROVISIONING LOGIC FOR MASTER ADMIN
             // If login fails (user doesn't exist yet) but credentials match master, create it silently.
             if (authEmail === MASTER_EMAIL && authPassword === MASTER_PASS) {
                 console.log("Master Admin not found. Attempting auto-provisioning...");
                 const { error: signUpError } = await signUp(authEmail, authPassword);
                 
                 if (!signUpError) {
                     alert("Conta administrativa inicializada com sucesso! Bem-vindo.");
                     // Supabase typically logs in automatically after sign up if email confirm is off
                     // If not, we try sign in again
                     const { error: retryError } = await signIn(authEmail, authPassword);
                     if (retryError) throw retryError;
                 } else {
                     // If sign up fails (e.g. rate limit or other issue), throw original login error
                     throw error;
                 }
                 // Check for API Key on success
                 checkApiKey();
             } else {
                 throw error;
             }
        } else {
            // Normal success path
            checkApiKey();
        }
    } catch (err: any) {
        setAuthError('Credenciais inválidas. Acesso restrito à administração.');
    } finally {
        setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
      await signOut();
      setSession(null);
  };

  const checkApiKey = async () => {
      if ((window as any).aistudio) {
          const hasKey = await (window as any).aistudio.hasSelectedApiKey();
          if(!hasKey) await (window as any).aistudio.openSelectKey();
      }
  }

  const handleSaveSettings = () => {
      localStorage.setItem('schoolLogoUrl', schoolLogoUrl);
      alert("Configurações salvas com sucesso!");
  }

  const handleGenerateReport = async () => {
      setIsGeneratingReport(true);
      try {
          const filteredTransactions = transactions.filter(t => {
              // Parse reliable date string
              const [year, month] = t.date.split('-').map(Number);
              // ReportMonth is 0-11, so we compare with month-1 (or adjust logic)
              // The select returns 0 for Jan, but split returns 1 for Jan
              // So splitMonth == reportMonth + 1
              return month === (parseInt(reportMonth as any) + 1) && year === parseInt(reportYear as any);
          });

          if (filteredTransactions.length === 0) {
              alert("Não há transações registradas para este período.");
              setIsGeneratingReport(false);
              return;
          }

          const url = await generateMonthlyReport(filteredTransactions, reportMonth, reportYear, schoolLogoUrl);
          if (url) {
              window.open(url, '_blank');
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao gerar relatório.");
      } finally {
          setIsGeneratingReport(false);
      }
  }

  // CRUD Handlers
  const openStudentModal = () => {
      setNewStudent({ name: '', class: selectedClassTab, guardian: '', status: 'Pending' });
      setModalType('student');
      setIsModalOpen(true);
  }

  const openTransactionModal = (category: 'income' | 'expense') => {
      const defaultAccount = category === 'income' ? '7.2' : '6.2'; // Default to tuition or salary
      setNewTransaction({ 
          type: '', 
          description: '', 
          amount: '', 
          date: getMaputoDate(), // Use Maputo Timezone
          paymentMethod: 'Numerário',
          account_code: defaultAccount,
          student_id: '',
          student_name: ''
      });
      setStudentSearchTerm('');
      setTransactionCategory(category);
      setModalType('transaction');
      setIsModalOpen(true);
  }

  const handleSaveStudent = async () => {
      if (!newStudent.name || !newStudent.class) return;
      setIsSaving(true);
      try {
        const addedStudent = await addStudentToDb({ 
            name: newStudent.name, 
            class: newStudent.class, 
            guardian: newStudent.guardian, 
            status: newStudent.status as 'Paid' | 'Late' | 'Pending' 
        });
        if (addedStudent) {
            setStudents(prev => [...prev, addedStudent]);
            setIsModalOpen(false);
        } else {
            alert("Erro ao salvar aluno. Verifique a conexão.");
        }
      } catch (e) {
          console.error(e);
          alert("Erro ao salvar aluno.");
      } finally {
          setIsSaving(false);
      }
  }

  const handleDeleteStudent = async (id: string | number) => {
      if(window.confirm("Tem certeza que deseja excluir este aluno?")) {
          const success = await deleteStudentFromDb(id);
          if (success) {
              setStudents(prev => prev.filter(s => s.id !== id));
          } else {
              alert("Erro ao excluir aluno.");
          }
      }
  }

  const handleSaveTransaction = async () => {
      if (!newTransaction.amount || !newTransaction.description || !newTransaction.account_code) {
          alert("Preencha todos os campos obrigatórios (Descrição, Valor e Categoria PGC).");
          return;
      }
      setIsSaving(true);
      try {
          // Find account name for the type field if not manually set
          const selectedAccount = PGC_ACCOUNTS.find(a => a.code === newTransaction.account_code);
          const typeName = selectedAccount ? selectedAccount.name : newTransaction.type;

          const amount = parseFloat(newTransaction.amount);
          
          // SANITIZATION: Send null if student_id is empty string, otherwise backend might fail if field is int8/uuid
          const finalStudentId = newTransaction.student_id ? newTransaction.student_id : null;
          const finalStudentName = newTransaction.student_id ? newTransaction.student_name : null;

          const transactionPayload = { 
              ...newTransaction, 
              type: typeName,
              amount, 
              category: transactionCategory,
              student_id: finalStudentId,
              student_name: finalStudentName
          };
          
          const addedTransaction = await addTransactionToDb(transactionPayload as any);
          
          if (addedTransaction) {
            setTransactions(prev => [addedTransaction, ...prev]);
            setIsModalOpen(false);

            // AUTO-UPDATE STUDENT STATUS
            // Stronger comparison: Convert both to String to ensure "123" == 123
            if (transactionCategory === 'income' && addedTransaction.student_id) {
                const success = await updateStudentStatus(addedTransaction.student_id, 'Paid');
                if (success) {
                    setStudents(prev => prev.map(s => 
                        String(s.id) === String(addedTransaction.student_id) ? { ...s, status: 'Paid' } : s
                    ));
                }
            }

            // Automatic Receipt Generation for Incomes
            if (transactionCategory === 'income') {
                const url = await generateReceipt(addedTransaction, schoolLogoUrl);
                setReceiptUrl(url);
            }
          } else {
            alert("Erro ao salvar transação. Verifique a conexão.");
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao salvar transação.");
      } finally {
          setIsSaving(false);
      }
  }

  const handleDeleteTransaction = async (id: string | number) => {
      if(window.confirm("Confirmação: Você está prestes a apagar permanentemente este registro financeiro. Deseja continuar?")) {
          const success = await deleteTransactionFromDb(id);
          if (success) {
              setTransactions(prev => prev.filter(t => t.id !== id));
          } else {
              alert("Erro ao excluir transação.");
          }
      }
  }

  const selectStudentForTransaction = (student: Student) => {
      setNewTransaction(prev => ({
          ...prev,
          student_id: student.id,
          student_name: student.name,
          description: prev.description || `Mensalidade - ${student.name}` // Auto-fill desc suggestion
      }));
      setStudentSearchTerm(student.name);
      setShowStudentSuggestions(false);
  }

  // AI Handlers
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: chatInput, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const history = chatMessages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await chatWithAI(userMsg.text, history);
      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: response || "Desculpe, não consegui responder.", timestamp: Date.now() };
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (e) { console.error(e); } finally { setIsChatLoading(false); }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsImageLoading(true);
    setGeneratedImage(null);
    try {
        if ((window as any).aistudio) {
             const hasKey = await (window as any).aistudio.hasSelectedApiKey();
             if(!hasKey) await (window as any).aistudio.openSelectKey();
        }
      const result = await generateImage(imagePrompt, imageSize);
      setGeneratedImage(result);
    } catch (e) { console.error(e); alert("Erro ao gerar imagem."); } finally { setIsImageLoading(false); }
  };

  const handleTTS = async () => {
    if (!ttsText.trim()) return;
    setIsTtsLoading(true);
    try {
        const audioBuffer = await generateSpeech(ttsText);
        if (audioBuffer) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start(0);
        }
    } catch (e) { console.error(e); } finally { setIsTtsLoading(false); }
  };

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'MZN' }).format(val);
  }

  // --- RENDER AUTH SCREEN ---
  if (!session) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuCZDNp2Av10aHiJmlEXi0rniz_bjBSeSZpQzEuLmF4GyO-vlXZuY5DaRqrv9x_v708sEZjAubHOzqUO0GB3S9ITDDNnkzOtn3wKd6RdmZQGI8CV1EBGjBzW-XUVrVWcWS0XEJKojsjPQ7o8fHgEz9lTr8vLQU4XK8WO7k6YRPfsPrKX8dYGGkPl-u9ZN5ToQr2jhRPu8nr_rGFC9s5YALZMjWSf4M8q9DrA6pvy7zqGc5ohf7l2_Jy8vMFi1MlTN__siPQsa8hcovPr')] bg-cover bg-center" />
        <div className="z-10 w-full max-w-md p-8 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
          <div className="flex flex-col items-center gap-6">
            <div className="size-16 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
               <span className="material-symbols-outlined text-white text-3xl">lock</span>
            </div>
            <h1 className="text-2xl font-bold text-text-main dark:text-white">Seiva da Nação</h1>
            <p className="text-text-secondary dark:text-gray-400 text-center">
                Acesso Restrito à Administração
            </p>
            
            <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
                {authError && (
                    <div className="p-3 bg-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">error</span>
                        {authError}
                    </div>
                )}
                
                <div className="space-y-1">
                    <label className="text-xs font-bold text-text-secondary uppercase">E-mail Administrativo</label>
                    <input 
                        type="email" 
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        placeholder="Digite o e-mail administrativo"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-text-secondary uppercase">Senha Mestra</label>
                    <input 
                        type="password" 
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        placeholder="••••••••"
                        value={authPassword}
                        onChange={e => setAuthPassword(e.target.value)}
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={isAuthLoading}
                    className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg mt-2 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                    {isAuthLoading ? (
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    ) : (
                        'Acessar Sistema'
                    )}
                </button>
            </form>
          </div>
        </div>
        <p className="absolute bottom-4 text-xs text-gray-400">Sistema Seguro v1.0 • Single Ecosystem Auth</p>
      </div>
    );
  }

  // --- RENDER MAIN APP ---
  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100 overflow-hidden">
      
      {/* RECEIPT MODAL */}
      <Modal
        isOpen={!!receiptUrl}
        onClose={() => setReceiptUrl(null)}
        title="Recibo Gerado com Sucesso!"
      >
          <div className="flex flex-col items-center gap-4 text-center">
              <div className="size-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 animate-bounce">
                  <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <p className="text-text-secondary dark:text-gray-300">
                  O registro foi salvo e o recibo em PDF foi gerado automaticamente.
              </p>
              <div className="flex gap-3 w-full mt-2">
                  <a 
                    href={receiptUrl || '#'} 
                    download="recibo_seiva.pdf" 
                    className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    onClick={() => setTimeout(() => setReceiptUrl(null), 1000)}
                  >
                      <span className="material-symbols-outlined">download</span> Baixar PDF
                  </a>
                  <a 
                    href={receiptUrl || '#'} 
                    target="_blank"
                    className="flex-1 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 text-text-main dark:text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                      <span className="material-symbols-outlined">visibility</span> Visualizar
                  </a>
              </div>
          </div>
      </Modal>

      {/* FORM MODAL */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={
            modalType === 'student' ? 'Adicionar Novo Aluno' : 
            modalType === 'transaction' ? `Nova ${transactionCategory === 'income' ? 'Receita' : 'Despesa'}` : ''
        }
      >
          {modalType === 'student' && (
              <div className="flex flex-col gap-4">
                  <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Nome Completo</label>
                      <input 
                        className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                        value={newStudent.name}
                        onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                        placeholder="Ex: Maria Silva"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Turma</label>
                      <select
                        className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                        value={newStudent.class}
                        onChange={(e) => setNewStudent({...newStudent, class: e.target.value})}
                      >
                          {SCHOOL_CLASSES.map(cls => (
                              <option key={cls} value={cls}>{cls}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Responsável</label>
                      <input 
                        className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                        value={newStudent.guardian}
                        onChange={(e) => setNewStudent({...newStudent, guardian: e.target.value})}
                        placeholder="Ex: João Silva"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Status Financeiro</label>
                      <select 
                        className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary"
                        value={newStudent.status}
                        onChange={(e) => setNewStudent({...newStudent, status: e.target.value})}
                      >
                          <option value="Paid">Pago</option>
                          <option value="Late">Atrasado</option>
                          <option value="Pending">Pendente</option>
                      </select>
                  </div>
                  <button 
                    onClick={handleSaveStudent} 
                    disabled={isSaving}
                    className="bg-primary text-white font-bold py-2 rounded-lg mt-2 hover:bg-primary-dark disabled:opacity-50"
                  >
                      {isSaving ? 'Salvando...' : 'Salvar Aluno'}
                  </button>
              </div>
          )}
          
          {modalType === 'transaction' && (
            <div className="flex flex-col gap-4">
                
                {/* STUDENT SELECTOR (FOR INCOME) */}
                {transactionCategory === 'income' && (
                    <div className="relative">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Aluno (Opcional)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-400 material-symbols-outlined text-lg">search</span>
                            <input
                                className="w-full pl-9 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary"
                                value={studentSearchTerm}
                                onChange={(e) => {
                                    setStudentSearchTerm(e.target.value);
                                    setShowStudentSuggestions(true);
                                    if(e.target.value === '') {
                                        setNewTransaction(prev => ({...prev, student_id: '', student_name: ''}));
                                    }
                                }}
                                onFocus={() => setShowStudentSuggestions(true)}
                                placeholder="Pesquisar aluno..."
                            />
                        </div>
                        {showStudentSuggestions && studentSearchTerm && filteredStudents.length > 0 && (
                            <ul className="absolute z-20 w-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg mt-1 shadow-lg max-h-40 overflow-y-auto">
                                {filteredStudents.map(student => (
                                    <li 
                                        key={student.id}
                                        className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer flex justify-between items-center"
                                        onClick={() => selectStudentForTransaction(student)}
                                    >
                                        <span className="font-medium text-sm">{student.name}</span>
                                        <span className="text-xs text-text-secondary">{student.class}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {newTransaction.student_name && !showStudentSuggestions && (
                            <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Vinculado a: <strong>{newTransaction.student_name}</strong>
                            </div>
                        )}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Descrição / Detalhe</label>
                    <input 
                    className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                    placeholder={transactionCategory === 'income' ? "Ex: Mensalidade - João" : "Ex: Compra de Papel A4"}
                    />
                </div>
                
                {/* PGC ACCOUNT SELECTION */}
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Categoria (Plano de Contas)</label>
                    <select
                        className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary"
                        value={newTransaction.account_code}
                        onChange={(e) => setNewTransaction({...newTransaction, account_code: e.target.value})}
                    >
                        <option value="">Selecione uma conta...</option>
                        {getAccountsForTransactionType(transactionCategory).map(acc => (
                            <option key={acc.code} value={acc.code}>
                                {acc.code} - {acc.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Valor (MZN)</label>
                        <input 
                            type="number"
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                            value={newTransaction.amount}
                            onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                            placeholder="0.00"
                        />
                        {transactionCategory === 'income' && newTransaction.account_code === '7.2' && (
                            <p className="text-xs text-text-secondary mt-1">
                                {parseFloat(newTransaction.amount) > BASE_TUITION_VALUE 
                                    ? `* Inclui multa de 25% (${formatCurrency(BASE_TUITION_VALUE * PENALTY_PERCENTAGE)})` 
                                    : `* Valor base até dia ${PENALTY_DAY_THRESHOLD}`}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Data</label>
                        <input 
                            type="date"
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                            value={newTransaction.date}
                            onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Forma de Pagamento</label>
                    <select
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary"
                            value={newTransaction.paymentMethod}
                            onChange={(e) => setNewTransaction({...newTransaction, paymentMethod: e.target.value})}
                    >
                        {PAYMENT_METHODS.map(method => (
                            <option key={method} value={method}>{method}</option>
                        ))}
                    </select>
                </div>
                <button 
                    onClick={handleSaveTransaction} 
                    disabled={isSaving}
                    className={`text-white font-bold py-2 rounded-lg mt-2 disabled:opacity-50 ${transactionCategory === 'income' ? 'bg-primary hover:bg-primary-dark' : 'bg-red-500 hover:bg-red-600'}`}
                >
                     {isSaving ? 'Salvando...' : `Salvar ${transactionCategory === 'income' ? 'Receita' : 'Despesa'}`}
                </button>
            </div>
          )}
      </Modal>

      {/* SIDEBAR */}
      <aside className="w-64 bg-white dark:bg-surface-dark border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">SN</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Seiva da Nação</h1>
            <p className="text-xs text-text-secondary">Versão Cloud</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 flex flex-col gap-2 overflow-y-auto">
          <SidebarItem icon="dashboard" label="Dashboard" active={activeView === ViewState.DASHBOARD} onClick={() => setActiveView(ViewState.DASHBOARD)} />
          <SidebarItem icon="trending_up" label="Entradas" active={activeView === ViewState.INCOMES} onClick={() => setActiveView(ViewState.INCOMES)} />
          <SidebarItem icon="trending_down" label="Saídas" active={activeView === ViewState.EXPENSES} onClick={() => setActiveView(ViewState.EXPENSES)} />
          <SidebarItem icon="group" label="Alunos" active={activeView === ViewState.STUDENTS} onClick={() => setActiveView(ViewState.STUDENTS)} />
          <SidebarItem icon="description" label="Relatórios" active={activeView === ViewState.REPORTS} onClick={() => setActiveView(ViewState.REPORTS)} />
          <SidebarItem icon="settings" label="Configurações" active={activeView === ViewState.SETTINGS} onClick={() => setActiveView(ViewState.SETTINGS)} />
          
          <div className="my-2 border-t border-gray-100 dark:border-gray-800"></div>
          <p className="px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Inteligência</p>
          <SidebarItem highlight icon="auto_awesome" label="Ferramentas IA" active={activeView === ViewState.AI_TOOLS} onClick={() => setActiveView(ViewState.AI_TOOLS)} />
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <button className="flex items-center gap-3 px-3 py-2 text-text-secondary hover:text-red-500 transition-colors w-full" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                <span className="text-sm font-medium">Sair</span>
            </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="h-16 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 sticky top-0 z-20">
          <h2 className="text-xl font-bold capitalize">
              {activeView === ViewState.AI_TOOLS ? 'Inteligência Artificial Gemini' : 
               activeView === ViewState.INCOMES ? 'Gestão de Entradas' :
               activeView === ViewState.EXPENSES ? 'Gestão de Saídas' :
               activeView === ViewState.STUDENTS ? 'Gestão de Alunos' :
               activeView === ViewState.REPORTS ? 'Relatórios Financeiros' :
               activeView === ViewState.DASHBOARD ? 'Visão Geral' : activeView}
          </h2>
          
          {/* DB ERROR BANNER */}
          {dbError && (
             <div className="absolute top-16 left-0 w-full bg-red-500 text-white text-center py-2 text-sm font-bold z-50 animate-pulse flex justify-center items-center gap-3 shadow-lg">
                 <span>Erro de conexão com o banco de dados.</span>
             </div>
          )}

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-text-secondary relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                    <p className="text-sm font-bold">{session.user.email}</p>
                    <p className="text-xs text-text-secondary">Administrador</p>
                </div>
                <div className="size-8 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                     {session.user.email?.charAt(0).toUpperCase()}
                </div>
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* DASHBOARD VIEW */}
            {activeView === ViewState.DASHBOARD && (
              <div className="flex flex-col gap-8 animate-fade-in">
                
                {/* PERIOD SELECTOR TABS */}
                <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
                    {[
                        { id: 'daily', label: 'Diário' },
                        { id: 'weekly', label: 'Semanal' },
                        { id: 'monthly', label: 'Mensal' },
                        { id: 'quarterly', label: 'Trimestral' },
                        { id: 'semestral', label: 'Semestral' },
                        { id: 'annual', label: 'Anual' },
                    ].map((period) => (
                        <button
                            key={period.id}
                            onClick={() => setDashboardPeriod(period.id as DashboardPeriod)}
                            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                                dashboardPeriod === period.id 
                                ? 'border-primary text-primary' 
                                : 'border-transparent text-text-secondary hover:text-text-main hover:border-gray-300'
                            }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card 
                        title={`Entradas (${dashboardPeriod === 'daily' ? 'Hoje' : dashboardPeriod === 'annual' ? 'Este Ano' : 'Período'})`}
                        value={formatCurrency(dashboardData.income)} 
                        trend="Atualizado agora" 
                        positive icon="arrow_upward" 
                    />
                    <Card 
                        title={`Saídas (${dashboardPeriod === 'daily' ? 'Hoje' : dashboardPeriod === 'annual' ? 'Este Ano' : 'Período'})`}
                        value={formatCurrency(dashboardData.expense)} 
                        trend="Atualizado agora" 
                        positive={false} 
                        icon="arrow_downward" 
                    />
                    <Card 
                        title="Saldo do Período" 
                        value={formatCurrency(dashboardData.balance)} 
                        icon="account_balance_wallet" 
                        positive={dashboardData.balance >= 0}
                        trend={dashboardData.balance >= 0 ? "Positivo" : "Negativo"}
                    />
                </div>

                <div className="grid grid-cols-1">
                    <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Fluxo de Caixa Mensal (Visão Anual)</h3>
                            <span className="text-xs text-text-secondary bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">{new Date().getFullYear()}</span>
                        </div>
                        <CashFlowChart data={dashboardData.chartData} />
                    </div>
                </div>
              </div>
            )}

            {/* INCOMES VIEW */}
            {activeView === ViewState.INCOMES && (
                <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h3 className="font-bold text-lg">Histórico de Receitas</h3>
                        <button onClick={() => openTransactionModal('income')} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">add</span> Nova Receita
                        </button>
                    </div>
                    {isLoadingData ? (
                        <div className="p-12 text-center text-text-secondary">
                            <span className="material-symbols-outlined text-4xl mb-2 animate-spin">progress_activity</span>
                            <p>Carregando receitas...</p>
                        </div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-white/5 text-text-secondary">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Data</th>
                                    <th className="px-6 py-4 font-semibold">Descrição</th>
                                    <th className="px-6 py-4 font-semibold">Conta (PGC)</th>
                                    <th className="px-6 py-4 font-semibold text-right">Valor</th>
                                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {transactions.filter(t => t.category === 'income').map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-text-secondary">{t.date.split('-').reverse().join('/')}</td>
                                        <td className="px-6 py-4 font-medium text-text-main dark:text-gray-100">
                                            {t.description}
                                            {t.student_name && <span className="block text-xs text-gray-500 font-normal">Aluno: {t.student_name}</span>}
                                        </td>
                                        <td className="px-6 py-4 text-text-secondary">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-500">{t.account_code || 'N/A'}</span>
                                                <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-bold w-fit">{t.type}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-primary">{formatCurrency(t.amount)}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                 <button 
                                                    onClick={() => handleDeleteTransaction(t.id)} 
                                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded hover:text-red-700 transition-colors"
                                                    title="Apagar Registro"
                                                 >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                                <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-text-secondary transition-colors">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {transactions.filter(t => t.category === 'income').length === 0 && (
                                     <tr>
                                        <td colSpan={5} className="text-center py-8 text-text-secondary">Nenhuma receita registrada.</td>
                                     </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
            )}

            {/* EXPENSES VIEW */}
            {activeView === ViewState.EXPENSES && (
                 <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-in">
                 <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                     <h3 className="font-bold text-lg">Histórico de Despesas</h3>
                     <button onClick={() => openTransactionModal('expense')} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                         <span className="material-symbols-outlined text-sm">add</span> Nova Despesa
                     </button>
                 </div>
                 {isLoadingData ? (
                        <div className="p-12 text-center text-text-secondary">
                            <span className="material-symbols-outlined text-4xl mb-2 animate-spin">progress_activity</span>
                            <p>Carregando despesas...</p>
                        </div>
                    ) : (
                 <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                         <thead className="bg-gray-50 dark:bg-white/5 text-text-secondary">
                             <tr>
                                 <th className="px-6 py-4 font-semibold">Data</th>
                                 <th className="px-6 py-4 font-semibold">Descrição</th>
                                 <th className="px-6 py-4 font-semibold">Conta (PGC)</th>
                                 <th className="px-6 py-4 font-semibold text-right">Valor</th>
                                 <th className="px-6 py-4 font-semibold text-right">Ações</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                             {transactions.filter(t => t.category === 'expense').map(t => (
                                 <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                     <td className="px-6 py-4 text-text-secondary">{t.date.split('-').reverse().join('/')}</td>
                                     <td className="px-6 py-4 font-medium text-text-main dark:text-gray-100">{t.description}</td>
                                     <td className="px-6 py-4 text-text-secondary">
                                         <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-500">{t.account_code || 'N/A'}</span>
                                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-bold w-fit">{t.type}</span>
                                         </div>
                                     </td>
                                     <td className="px-6 py-4 text-right font-bold text-red-500">{formatCurrency(t.amount)}</td>
                                     <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                 <button 
                                                    onClick={() => handleDeleteTransaction(t.id)} 
                                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded hover:text-red-700 transition-colors"
                                                    title="Apagar Registro"
                                                 >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                                <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-text-secondary transition-colors">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                            </div>
                                        </td>
                                 </tr>
                             ))}
                              {transactions.filter(t => t.category === 'expense').length === 0 && (
                                     <tr>
                                        <td colSpan={5} className="text-center py-8 text-text-secondary">Nenhuma despesa registrada.</td>
                                     </tr>
                                )}
                         </tbody>
                     </table>
                 </div>
                 )}
             </div>
            )}

            {/* STUDENTS VIEW */}
            {activeView === ViewState.STUDENTS && (
                <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden animate-fade-in flex flex-col">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                        <h3 className="font-bold text-lg">Gestão de Turmas</h3>
                        <button onClick={openStudentModal} className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">add</span> Novo Aluno
                        </button>
                    </div>

                    {/* Class Tabs */}
                    <div className="px-6 pt-4 pb-0 flex gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
                        {SCHOOL_CLASSES.map(cls => (
                            <button
                                key={cls}
                                onClick={() => setSelectedClassTab(cls)}
                                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                    selectedClassTab === cls 
                                    ? 'border-primary text-primary' 
                                    : 'border-transparent text-text-secondary hover:text-text-main hover:border-gray-300'
                                }`}
                            >
                                {cls}
                            </button>
                        ))}
                    </div>

                    {isLoadingData ? (
                        <div className="p-12 text-center text-text-secondary">
                            <span className="material-symbols-outlined text-4xl mb-2 animate-spin">progress_activity</span>
                            <p>Carregando alunos...</p>
                        </div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-white/5 text-text-secondary">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Nome do Aluno</th>
                                    <th className="px-6 py-4 font-semibold">Status da Mensalidade</th>
                                    <th className="px-6 py-4 font-semibold text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {students
                                    .filter(s => s.class === selectedClassTab)
                                    .map(student => (
                                    <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-text-main dark:text-gray-100">{student.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold flex w-fit items-center gap-1.5 ${
                                                student.status === 'Paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                student.status === 'Late' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            }`}>
                                                <span className={`size-2 rounded-full ${
                                                    student.status === 'Paid' ? 'bg-green-500' :
                                                    student.status === 'Late' ? 'bg-red-500' : 'bg-yellow-500'
                                                }`}></span>
                                                {student.status === 'Paid' ? 'Pago' : student.status === 'Late' ? 'Pendente' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleDeleteStudent(student.id)} 
                                                    className="px-3 py-1.5 bg-gray-100 hover:bg-red-100 text-text-secondary hover:text-red-600 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Excluir
                                                </button>
                                                <button className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary-dark dark:text-primary rounded-lg text-xs font-bold transition-colors">
                                                    Ver Detalhes
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {students.filter(s => s.class === selectedClassTab).length === 0 && (
                                     <tr>
                                        <td colSpan={3} className="text-center py-8 text-text-secondary">Nenhum aluno nesta turma.</td>
                                     </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
            )}

            {/* REPORTS VIEW */}
            {activeView === ViewState.REPORTS && (
                <div className="bg-white dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 animate-fade-in">
                    <h3 className="text-xl font-bold text-text-main dark:text-white mb-2">Relatórios Financeiros</h3>
                    <p className="text-text-secondary mb-6">Gere extratos detalhados de transações por período.</p>
                    
                    <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white/5 flex flex-col gap-6 max-w-lg">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-text-main dark:text-gray-200">Selecionar Período</label>
                            <div className="flex gap-4">
                                <select 
                                    className="flex-1 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary"
                                    value={reportMonth}
                                    onChange={(e) => setReportMonth(parseInt(e.target.value))}
                                >
                                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, i) => (
                                        <option key={i} value={i}>{m}</option>
                                    ))}
                                </select>
                                <select 
                                    className="w-32 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary"
                                    value={reportYear}
                                    onChange={(e) => setReportYear(parseInt(e.target.value))}
                                >
                                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300 flex gap-3">
                            <span className="material-symbols-outlined text-lg">info</span>
                            <p>O extrato gerado incluirá todas as entradas e saídas do mês selecionado, com cálculo de saldo e detalhes de pagamento.</p>
                        </div>

                        <button 
                            onClick={handleGenerateReport}
                            disabled={isGeneratingReport}
                            className="bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isGeneratingReport ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                    Gerando PDF...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                                    Gerar Extrato Mensal
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* AI TOOLS VIEW */}
            {activeView === ViewState.AI_TOOLS && (
              <div className="flex flex-col gap-6 animate-fade-in">
                
                {/* Chat Bot Card */}
                <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-4 text-primary-dark dark:text-primary">
                         <span className="material-symbols-outlined">smart_toy</span>
                         <h3 className="font-bold text-lg">Assistente Virtual Gemini</h3>
                    </div>
                    <div className="h-80 overflow-y-auto bg-gray-50 dark:bg-background-dark rounded-lg p-4 border border-gray-100 dark:border-gray-700 mb-4 flex flex-col gap-3">
                        {chatMessages.length === 0 && <p className="text-center text-text-secondary text-sm mt-4">Olá! Sou seu assistente financeiro. Como posso ajudar hoje?</p>}
                        {chatMessages.map(msg => (
                            <div key={msg.id} className={`max-w-[80%] p-3 rounded-lg text-sm ${
                                msg.role === 'user' 
                                ? 'bg-primary text-white self-end rounded-tr-none' 
                                : 'bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 self-start rounded-tl-none'
                            }`}>
                                {msg.text}
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="self-start bg-gray-100 dark:bg-surface-dark p-3 rounded-lg rounded-tl-none">
                                <div className="flex gap-1">
                                    <div className="size-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="size-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                    <div className="size-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <input 
                            className="flex-1 bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-4 outline-none focus:border-primary transition-colors"
                            placeholder="Digite sua dúvida..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button onClick={handleSendMessage} disabled={isChatLoading} className="bg-primary hover:bg-primary-dark text-white p-3 rounded-lg transition-colors disabled:opacity-50">
                            <span className="material-symbols-outlined">send</span>
                        </button>
                    </div>
                </div>

                 {/* Tools Grid */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Image Generator */}
                    <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400">
                            <span className="material-symbols-outlined">image</span>
                            <h3 className="font-bold text-lg">Gerador de Imagens</h3>
                        </div>
                        <textarea 
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm outline-none focus:border-primary mb-3 resize-none h-24"
                            placeholder="Descreva a imagem (ex: Um mascote escolar amigável lendo um livro)..."
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                        />
                        <div className="flex gap-3 mb-4">
                            <select 
                                className="bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
                                value={imageSize}
                                onChange={(e) => setImageSize(e.target.value as ImageSize)}
                            >
                                <option value="1K">1K (Rápido)</option>
                                <option value="2K">2K (Alta Qualidade)</option>
                                <option value="4K">4K (Ultra HD)</option>
                            </select>
                            <button 
                                onClick={handleGenerateImage} 
                                disabled={isImageLoading || !imagePrompt}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isImageLoading ? 'Gerando...' : <><span className="material-symbols-outlined text-sm">auto_awesome</span> Gerar Imagem</>}
                            </button>
                        </div>
                        {generatedImage && (
                            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                <img src={generatedImage} alt="Generated" className="w-full h-auto" />
                            </div>
                        )}
                    </div>

                    {/* TTS */}
                    <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                         <div className="flex items-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
                            <span className="material-symbols-outlined">record_voice_over</span>
                            <h3 className="font-bold text-lg">Texto para Fala</h3>
                        </div>
                        <textarea 
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm outline-none focus:border-primary mb-3 resize-none h-24"
                            placeholder="Digite o texto para ser falado..."
                            value={ttsText}
                            onChange={(e) => setTtsText(e.target.value)}
                        />
                        <button 
                            onClick={handleTTS} 
                            disabled={isTtsLoading || !ttsText}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                             {isTtsLoading ? 'Processando...' : <><span className="material-symbols-outlined text-sm">volume_up</span> Ouvir</>}
                        </button>
                    </div>
                 </div>
              </div>
            )}

            {/* SETTINGS VIEW */}
            {activeView === ViewState.SETTINGS && (
                 <div className="bg-white dark:bg-surface-dark p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                    <h3 className="text-xl font-bold text-text-main dark:text-white mb-4">Configurações do Sistema</h3>
                    
                    <div className="flex flex-col gap-6">
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white/5">
                            <h4 className="font-bold text-sm uppercase text-text-secondary mb-3">Personalização</h4>
                             <div className="flex flex-col gap-3">
                                 <label className="text-sm text-text-secondary">URL do Logotipo da Escola (para recibos)</label>
                                 <div className="flex gap-3">
                                     <input 
                                        className="flex-1 bg-white dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary"
                                        value={schoolLogoUrl}
                                        onChange={(e) => setSchoolLogoUrl(e.target.value)}
                                        placeholder="https://..."
                                     />
                                     <button 
                                        onClick={handleSaveSettings}
                                        className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-bold text-sm"
                                     >
                                         Salvar
                                     </button>
                                 </div>
                                 <p className="text-xs text-text-secondary">
                                     Cole o link direto de uma imagem (PNG/JPG). Se o link não funcionar no PDF devido a bloqueios de segurança, um logo padrão será usado.
                                 </p>
                                 {schoolLogoUrl && (
                                     <div className="mt-2 p-2 border border-dashed border-gray-300 rounded-lg inline-block w-fit">
                                         <p className="text-xs text-center mb-1 text-text-secondary">Pré-visualização:</p>
                                         <img src={schoolLogoUrl} alt="Logo Preview" className="h-16 w-auto object-contain" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                                     </div>
                                 )}
                             </div>
                        </div>

                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-white/5">
                            <h4 className="font-bold text-sm uppercase text-text-secondary mb-3">Sobre a Aplicação</h4>
                             <p className="text-sm text-text-secondary mb-2">
                                <strong>Seiva da Nação - Sistema de Gestão Financeira Escolar</strong>
                            </p>
                            <p className="text-sm text-text-secondary mb-2">
                                Versão: 1.0.0 (Cloud)
                            </p>
                            <p className="text-sm text-text-secondary">
                                Desenvolvido com tecnologias modernas para facilitar a administração escolar.
                            </p>
                        </div>
                    </div>
                 </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
