
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { ViewState, Transaction, Student, ImageSize, ChatMessage } from './types';
import { CashFlowChart, TrendChart } from './components/DashboardCharts';
import { generateImage, chatWithAI, generateSpeech } from './services/geminiService';
import { generateReceipt } from './services/pdfService';
import { 
  fetchTransactions, 
  addTransactionToDb, 
  deleteTransactionFromDb, 
  fetchStudents, 
  addStudentToDb, 
  deleteStudentFromDb 
} from './services/dataService';

// --- CONSTANTS ---
const SCHOOL_CLASSES = ["1ª Classe", "2ª Classe", "3ª Classe", "4ª Classe", "5ª Classe", "6ª Classe"];
const PAYMENT_METHODS = ["Numerário", "M-Pesa", "Transferência", "POS"];
const DEFAULT_LOGO = "https://lh3.googleusercontent.com/aida-public/AB6AXuCZDNp2Av10aHiJmlEXi0rniz_bjBSeSZpQzEuLmF4GyO-vlXZuY5DaRqrv9x_v708sEZjAubHOzqUO0GB3S9ITDDNnkzOtn3wKd6RdmZQGI8CV1EBGjBzW-XUVrVWcWS0XEJKojsjPQ7o8fHgEz9lTr8vLQU4XK8WO7k6YRPfsPrKX8dYGGkPl-u9ZN5ToQr2jhRPu8nr_rGFC9s5YALZMjWSf4M8q9DrA6pvy7zqGc5ohf7l2_Jy8vMFi1MlTN__siPQsa8hcovPr";

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
  <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-4">
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [activeView, setActiveView] = useState<ViewState>(ViewState.DASHBOARD);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // DATA STATE
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dbError, setDbError] = useState(false);

  // SETTINGS STATE
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(localStorage.getItem('schoolLogoUrl') || DEFAULT_LOGO);

  // STUDENTS VIEW STATE
  const [selectedClassTab, setSelectedClassTab] = useState(SCHOOL_CLASSES[0]);

  // MODAL STATE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'student' | 'transaction' | null>(null);
  const [transactionCategory, setTransactionCategory] = useState<'income' | 'expense'>('income');
  const [isSaving, setIsSaving] = useState(false);
  
  // RECEIPT STATE
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  // FORMS STATE
  const [newStudent, setNewStudent] = useState({ name: '', class: SCHOOL_CLASSES[0], guardian: '', status: 'Paid' });
  const [newTransaction, setNewTransaction] = useState({ 
      type: '', 
      description: '', 
      amount: '', 
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Numerário'
  });

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

  // --- EFFECT: LOAD DATA ---
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    setIsLoadingData(true);
    setDbError(false);
    try {
      // Fetch data
      const txsResult = await fetchTransactions();
      const stusResult = await fetchStudents();

      // Check for database errors (null return indicates error)
      if (txsResult === null || stusResult === null) {
        setDbError(true);
        // Fallback to empty arrays to keep app running
        setTransactions([]);
        setStudents([]);
      } else {
        setTransactions(txsResult);
        setStudents(stusResult);
      }
    } catch (error) {
      console.error("Failed to load data", error);
      setDbError(true);
    } finally {
      setIsLoadingData(false);
    }
  };

  // --- DERIVED DATA FOR DASHBOARD ---
  const dashboardData = useMemo(() => {
    const income = transactions.filter(t => t.category === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions.filter(t => t.category === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    const balance = income - expense;

    // Monthly Data for Bar Chart
    const monthlyDataMap = new Map<string, { entrada: number; saida: number }>();
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    transactions.forEach(t => {
        const date = new Date(t.date);
        const month = monthNames[date.getMonth()];
        if (!monthlyDataMap.has(month)) {
            monthlyDataMap.set(month, { entrada: 0, saida: 0 });
        }
        const data = monthlyDataMap.get(month)!;
        if (t.category === 'income') data.entrada += t.amount;
        else data.saida += t.amount;
    });

    // Fill missing months up to current or just show existing (sorted)
    const chartData = Array.from(monthlyDataMap.entries()).map(([name, values]) => ({ name, ...values }));
    
    // Annual/Trend Data (Start 2026)
    const trendData = [
        { name: '2026', income: income, expense: expense },
        { name: '2027', income: income * 1.15, expense: expense * 1.05 }, // Projected growth
    ];

    return { income, expense, balance, chartData, trendData };
  }, [transactions]);


  // --- HANDLERS ---

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 5) pinRefs.current[index + 1]?.focus();
    if (newPin.join('') === '123456') {
      checkApiKey().then(() => setIsAuthenticated(true));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !pin[index] && index > 0) {
          pinRefs.current[index - 1]?.focus();
      }
  }

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

  // CRUD Handlers
  const openStudentModal = () => {
      setNewStudent({ name: '', class: selectedClassTab, guardian: '', status: 'Paid' });
      setModalType('student');
      setIsModalOpen(true);
  }

  const openTransactionModal = (category: 'income' | 'expense') => {
      setNewTransaction({ 
          type: '', 
          description: '', 
          amount: '', 
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'Numerário'
      });
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
      if (!newTransaction.amount || !newTransaction.description) return;
      setIsSaving(true);
      try {
          const amount = parseFloat(newTransaction.amount);
          const transactionPayload = { 
              ...newTransaction, 
              amount, 
              category: transactionCategory, 
          };
          
          const addedTransaction = await addTransactionToDb(transactionPayload);
          
          if (addedTransaction) {
            setTransactions(prev => [addedTransaction, ...prev]);
            setIsModalOpen(false);

            // Automatic Receipt Generation for Incomes
            if (transactionCategory === 'income') {
                // Pass the custom logo URL
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
  if (!isAuthenticated) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center justify-center bg-background-light dark:bg-background-dark overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://lh3.googleusercontent.com/aida-public/AB6AXuCZDNp2Av10aHiJmlEXi0rniz_bjBSeSZpQzEuLmF4GyO-vlXZuY5DaRqrv9x_v708sEZjAubHOzqUO0GB3S9ITDDNnkzOtn3wKd6RdmZQGI8CV1EBGjBzW-XUVrVWcWS0XEJKojsjPQ7o8fHgEz9lTr8vLQU4XK8WO7k6YRPfsPrKX8dYGGkPl-u9ZN5ToQr2jhRPu8nr_rGFC9s5YALZMjWSf4M8q9DrA6pvy7zqGc5ohf7l2_Jy8vMFi1MlTN__siPQsa8hcovPr')] bg-cover bg-center" />
        <div className="z-10 w-full max-w-md p-8 bg-white/80 dark:bg-surface-dark/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20">
          <div className="flex flex-col items-center gap-6">
            <div className="size-16 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
               <span className="material-symbols-outlined text-white text-3xl">lock</span>
            </div>
            <h1 className="text-2xl font-bold text-text-main dark:text-white">Acesso Restrito</h1>
            <p className="text-text-secondary dark:text-gray-400 text-center">Insira seu PIN (123456) para acessar o sistema Seiva da Nação.</p>
            
            <div className="flex gap-3">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={el => pinRefs.current[i] = el}
                  type="password"
                  maxLength={1}
                  className="w-12 h-16 text-center text-2xl font-bold rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark focus:border-primary focus:ring-primary outline-none transition-all"
                  value={digit}
                  onChange={e => handlePinChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                />
              ))}
            </div>
          </div>
        </div>
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
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Descrição / Aluno</label>
                    <input 
                    className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                    placeholder="Ex: Mensalidade - João"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
                        <input 
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                            value={newTransaction.type}
                            onChange={(e) => setNewTransaction({...newTransaction, type: e.target.value})}
                            placeholder="Ex: Mensalidade"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Valor (MZN)</label>
                        <input 
                            type="number"
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                            value={newTransaction.amount}
                            onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Data</label>
                        <input 
                            type="date"
                            className="w-full bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-primary" 
                            value={newTransaction.date}
                            onChange={(e) => setNewTransaction({...newTransaction, date: e.target.value})}
                        />
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
          <SidebarItem icon="settings" label="Configurações" active={activeView === ViewState.SETTINGS} onClick={() => setActiveView(ViewState.SETTINGS)} />
          
          <div className="my-2 border-t border-gray-100 dark:border-gray-800"></div>
          <p className="px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Inteligência</p>
          <SidebarItem highlight icon="auto_awesome" label="Ferramentas IA" active={activeView === ViewState.AI_TOOLS} onClick={() => setActiveView(ViewState.AI_TOOLS)} />
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <button className="flex items-center gap-3 px-3 py-2 text-text-secondary hover:text-red-500 transition-colors w-full" onClick={() => window.location.reload()}>
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
            <div className="size-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                 <img src="https://picsum.photos/100/100" alt="User" className="w-full h-full object-cover"/>
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* DASHBOARD VIEW */}
            {activeView === ViewState.DASHBOARD && (
              <div className="flex flex-col gap-8 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card 
                        title="Entradas Totais" 
                        value={formatCurrency(dashboardData.income)} 
                        trend="Atualizado agora" 
                        positive icon="arrow_upward" 
                    />
                    <Card 
                        title="Saídas Totais" 
                        value={formatCurrency(dashboardData.expense)} 
                        trend="Atualizado agora" 
                        positive={false} 
                        icon="arrow_downward" 
                    />
                    <Card 
                        title="Saldo Atual" 
                        value={formatCurrency(dashboardData.balance)} 
                        icon="account_balance_wallet" 
                        positive={dashboardData.balance >= 0}
                        trend={dashboardData.balance >= 0 ? "Positivo" : "Negativo"}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="text-lg font-bold mb-4">Fluxo de Caixa Mensal</h3>
                        <CashFlowChart data={dashboardData.chartData} />
                    </div>
                    <div className="bg-white dark:bg-surface-dark p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="text-lg font-bold mb-4">Comparativo Anual</h3>
                        <TrendChart data={dashboardData.trendData} />
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
                                    <th className="px-6 py-4 font-semibold">Tipo</th>
                                    <th className="px-6 py-4 font-semibold text-right">Valor</th>
                                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {transactions.filter(t => t.category === 'income').map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-text-secondary">{new Date(t.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium text-text-main dark:text-gray-100">{t.description}</td>
                                        <td className="px-6 py-4 text-text-secondary">
                                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-bold">{t.type}</span>
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
                                 <th className="px-6 py-4 font-semibold">Tipo</th>
                                 <th className="px-6 py-4 font-semibold text-right">Valor</th>
                                 <th className="px-6 py-4 font-semibold text-right">Ações</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                             {transactions.filter(t => t.category === 'expense').map(t => (
                                 <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                     <td className="px-6 py-4 text-text-secondary">{new Date(t.date).toLocaleDateString()}</td>
                                     <td className="px-6 py-4 font-medium text-text-main dark:text-gray-100">{t.description}</td>
                                     <td className="px-6 py-4 text-text-secondary">
                                         <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-bold">{t.type}</span>
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
