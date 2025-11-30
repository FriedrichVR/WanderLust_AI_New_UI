
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Trip, Expense } from '../types';
import { translations, Language } from '../utils/translations';
import { AlertTriangle, X, Trash2, Plus } from 'lucide-react';

interface Props {
  trip: Trip;
  addExpense: (e: Expense) => void;
  removeExpense: (id: string) => void;
  currencySymbol: string;
  lang: Language;
  theme: 'light' | 'dark';
}

const PALETTE_DARK = {
    acid: '#22d3ee', 
    dark: '#333333',
    mid: '#555555',
    light: '#e5e5e5',
    danger: '#ff453a', 
    warning: '#ffaa00',
    success: '#00cc66'
};

const PALETTE_LIGHT = {
    acid: '#0891b2', 
    dark: '#e5e5e5',
    mid: '#9ca3af',
    light: '#111827',
    danger: '#dc2626',
    warning: '#d97706',
    success: '#16a34a'
};

const CATEGORY_COLORS_DARK: Record<string, string> = {
    'Accommodation': PALETTE_DARK.light,   
    'Food': PALETTE_DARK.warning,          
    'Transport': PALETTE_DARK.acid,        
    'Activities': PALETTE_DARK.success,          
    'Shopping': PALETTE_DARK.danger,       
    'Other': PALETTE_DARK.mid,             
};

const CATEGORY_COLORS_LIGHT: Record<string, string> = {
    'Accommodation': '#1f2937',   
    'Food': PALETTE_LIGHT.warning,          
    'Transport': PALETTE_LIGHT.acid,        
    'Activities': PALETTE_LIGHT.success,          
    'Shopping': PALETTE_LIGHT.danger,       
    'Other': PALETTE_LIGHT.mid,             
};

const BudgetOverview: React.FC<Props> = ({ trip, addExpense, removeExpense, currencySymbol, lang, theme }) => {
  const t = translations[lang];
  const [showAddModal, setShowAddModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [newExpense, setNewExpense] = useState<Partial<Expense>>({
      description: '',
      amount: 0,
      currency: trip.currency,
      category: 'Food',
      date: new Date().toISOString().split('T')[0]
  });

  const PALETTE = theme === 'dark' ? PALETTE_DARK : PALETTE_LIGHT;
  const CATEGORY_COLORS = theme === 'dark' ? CATEGORY_COLORS_DARK : CATEGORY_COLORS_LIGHT;

  const totalSpent = useMemo(() => trip.expenses.reduce((sum, e) => sum + e.amount, 0), [trip.expenses]);
  const remaining = trip.budget - totalSpent;
  const progress = Math.min((totalSpent / trip.budget) * 100, 100);
  
  const dataByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    trip.expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.keys(map).map(key => ({ 
        name: key, 
        value: map[key],
        color: CATEGORY_COLORS[key] || PALETTE.mid 
    }));
  }, [trip.expenses, CATEGORY_COLORS, PALETTE.mid]);

  const handleSaveExpense = () => {
      if (!newExpense.description || !newExpense.amount) return;
      addExpense({
          id: crypto.randomUUID(),
          description: newExpense.description,
          amount: Number(newExpense.amount),
          currency: trip.currency,
          category: newExpense.category as any,
          date: newExpense.date || new Date().toISOString().split('T')[0]
      });
      setShowAddModal(false);
      setNewExpense({ description: '', amount: 0, currency: trip.currency, category: 'Food', date: new Date().toISOString().split('T')[0] });
  };

  const handleConfirmDelete = () => {
      if (expenseToDelete) {
          removeExpense(expenseToDelete);
          setExpenseToDelete(null);
      }
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in pt-3 md:pt-6">
      
      {/* Top Cards (Clean & Rounded) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        <div className="bg-surface border border-border p-4 md:p-8 rounded-xl md:rounded-3xl relative overflow-hidden">
            <div className="font-mono text-[9px] md:text-[10px] text-dim uppercase tracking-widest mb-2 md:mb-3">{t.totalAllocation}</div>
            <div className="font-display text-2xl md:text-4xl font-bold text-text">{currencySymbol}{trip.budget.toLocaleString()}</div>
            <div className="absolute bottom-0 left-0 w-full h-1 md:h-1.5 bg-panel"></div>
        </div>
        
        <div className="bg-surface border border-border p-4 md:p-8 rounded-xl md:rounded-3xl relative overflow-hidden">
            <div className="font-mono text-[9px] md:text-[10px] text-dim uppercase tracking-widest mb-2 md:mb-3">{t.depleted}</div>
            <div className="font-display text-2xl md:text-4xl font-bold text-dim">{currencySymbol}{totalSpent.toLocaleString()}</div>
            <div className="absolute bottom-0 left-0 h-1 md:h-1.5 bg-dim" style={{width: `${progress}%`}}></div>
        </div>

        <div className="bg-surface border border-border p-4 md:p-8 rounded-xl md:rounded-3xl relative overflow-hidden">
            <div className="font-mono text-[9px] md:text-[10px] text-dim uppercase tracking-widest mb-2 md:mb-3">{t.reserves}</div>
            <div className={`font-display text-2xl md:text-4xl font-bold`} style={{ color: remaining < 0 ? PALETTE.danger : PALETTE.acid }}>
                {currencySymbol}{remaining.toLocaleString()}
            </div>
            {remaining < 0 && <div className="absolute top-3 md:top-6 right-3 md:right-6 text-danger">
                <AlertTriangle size={18} className="md:hidden"/>
                <AlertTriangle size={24} className="hidden md:block"/>
            </div>}
            <div className="absolute bottom-0 left-0 w-full h-1 md:h-1.5" style={{ backgroundColor: remaining < 0 ? PALETTE.danger : PALETTE.acid }}></div>
        </div>
      </div>

      {/* Charts & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        
        <div className="bg-surface border border-border p-4 md:p-8 rounded-xl md:rounded-3xl min-h-[280px] md:min-h-[400px]">
            <h3 className="font-mono text-[10px] md:text-xs text-acid uppercase tracking-widest mb-4 md:mb-8 border-b border-border pb-2 md:pb-4">{t.spendingVector}</h3>
            {dataByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={200} className="md:hidden">
                    <PieChart>
                        <Pie
                            data={dataByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={3}
                        >
                            {dataByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <RechartsTooltip 
                            contentStyle={{ 
                                backgroundColor: theme === 'dark' ? '#121212' : '#ffffff', 
                                borderColor: theme === 'dark' ? '#333' : '#e5e7eb', 
                                color: theme === 'dark' ? '#fff' : '#000', 
                                borderRadius: '12px',
                                fontSize: '10px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                            }}
                            itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
                            formatter={(value: number) => `${currencySymbol}${value}`} 
                        />
                        <Legend verticalAlign="bottom" height={30} iconType="circle" formatter={(val) => <span className="text-[8px] font-mono text-dim uppercase ml-1">{val}</span>}/>
                    </PieChart>
                </ResponsiveContainer>
            ) : null}
            {dataByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={280} className="hidden md:block">
                    <PieChart>
                        <Pie
                            data={dataByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={3}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={4}
                        >
                            {dataByCategory.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <RechartsTooltip 
                            contentStyle={{ 
                                backgroundColor: theme === 'dark' ? '#121212' : '#ffffff', 
                                borderColor: theme === 'dark' ? '#333' : '#e5e7eb', 
                                color: theme === 'dark' ? '#fff' : '#000', 
                                borderRadius: '12px',
                                fontSize: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                            }}
                            itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
                            formatter={(value: number) => `${currencySymbol}${value}`} 
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(val) => <span className="text-[10px] font-mono text-dim uppercase ml-2">{val}</span>}/>
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-dim font-mono text-xs">{t.noData}</div>
            )}
        </div>

        <div className="bg-surface border border-border p-4 md:p-8 rounded-xl md:rounded-3xl relative">
            <div className="flex justify-between items-center mb-4 md:mb-8 border-b border-border pb-2 md:pb-4">
                <h3 className="font-mono text-[10px] md:text-xs text-acid uppercase tracking-widest">{t.transactionsLog}</h3>
                <button onClick={() => setShowAddModal(true)} className="text-text hover:text-acid transition-colors flex items-center gap-1 md:gap-2 text-[9px] md:text-xs font-mono uppercase p-1.5 md:p-2 px-2 md:px-3 border border-border rounded-full hover:border-acid">
                    <Plus size={12} className="md:hidden" />
                    <Plus size={14} className="hidden md:block" />
                    <span className="hidden sm:inline">{t.manualEntry}</span>
                    <span className="sm:hidden">+</span>
                </button>
            </div>
            
            <div className="space-y-1.5 md:space-y-2 max-h-[250px] md:max-h-[300px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                {trip.expenses.length === 0 && <div className="text-dim text-[10px] md:text-xs font-mono text-center py-8 md:py-12">{t.logEmpty}</div>}
                {[...trip.expenses].reverse().map(expense => (
                    <div key={expense.id} className="flex items-center justify-between p-2 md:p-4 bg-panel rounded-lg md:rounded-xl border border-transparent hover:border-dim transition-colors group">
                        <div className="flex items-center gap-2 md:gap-4">
                            <div 
                                className="w-1 md:w-1.5 h-8 md:h-10 rounded-full" 
                                style={{ backgroundColor: CATEGORY_COLORS[expense.category] || PALETTE.mid }}
                            ></div>
                            <div>
                                <div className="text-[11px] md:text-sm font-bold text-text">{expense.description}</div>
                                <div className="text-[8px] md:text-[10px] font-mono text-dim uppercase mt-0.5">{expense.date} // {expense.category}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4">
                            <span className="font-mono text-[11px] md:text-sm font-bold text-text">{currencySymbol}{expense.amount}</span>
                            <button onClick={() => setExpenseToDelete(expense.id)} className="text-dim hover:text-danger md:opacity-0 md:group-hover:opacity-100 transition-all p-1 md:p-2 bg-surface rounded-full">
                                <Trash2 size={12} className="md:hidden" />
                                <Trash2 size={14} className="hidden md:block" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-md border border-border p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl">
                <div className="flex justify-between items-center mb-4 md:mb-8">
                    <h3 className="font-display text-base md:text-xl text-text uppercase">{t.newRecord}</h3>
                    <button onClick={() => setShowAddModal(false)} className="text-dim hover:text-text">
                        <X size={16} className="md:hidden"/>
                        <X size={20} className="hidden md:block"/>
                    </button>
                </div>
                <div className="space-y-3 md:space-y-5">
                    <div>
                        <label className="font-mono text-[9px] md:text-[10px] text-dim uppercase block mb-1.5 md:mb-2 tracking-widest">{t.description}</label>
                        <input type="text" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full bg-panel border border-border p-2 md:p-3 text-[11px] md:text-sm text-text focus:border-acid outline-none font-mono rounded-lg md:rounded-xl" placeholder="ITEM_NAME"/>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                        <div>
                            <label className="font-mono text-[9px] md:text-[10px] text-dim uppercase block mb-1.5 md:mb-2 tracking-widest">{t.value}</label>
                            <input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})} className="w-full bg-panel border border-border p-2 md:p-3 text-[11px] md:text-sm text-text focus:border-acid outline-none font-mono rounded-lg md:rounded-xl" placeholder="0.00"/>
                        </div>
                        <div>
                            <label className="font-mono text-[9px] md:text-[10px] text-dim uppercase block mb-1.5 md:mb-2 tracking-widest">{t.tag}</label>
                            <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as any})} className="w-full bg-panel border border-border p-2 md:p-3 text-[11px] md:text-sm text-text focus:border-acid outline-none font-mono rounded-lg md:rounded-xl">
                                {['Accommodation', 'Food', 'Transport', 'Activities', 'Shopping', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <button onClick={handleSaveExpense} className="w-full py-2.5 md:py-3.5 bg-text text-obsidian hover:bg-acid font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors mt-4 md:mt-6 rounded-lg md:rounded-xl shadow-lg">
                        {t.commitTransaction}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-sm border border-border p-4 md:p-8 shadow-2xl rounded-2xl md:rounded-3xl">
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 text-danger">
                    <AlertTriangle size={20} className="md:hidden" />
                    <AlertTriangle size={28} className="hidden md:block" />
                    <h3 className="font-display text-sm md:text-lg uppercase tracking-tight">{t.confirmDeleteTransactionTitle}</h3>
                </div>
                <p className="text-[10px] md:text-sm text-dim font-mono mb-4 md:mb-8 leading-relaxed">
                    {t.confirmDeleteTransactionMsg}
                </p>
                <div className="flex justify-end gap-2 md:gap-3">
                    <button onClick={() => setExpenseToDelete(null)} className="px-3 md:px-5 py-1.5 md:py-2.5 border border-border text-dim hover:text-text text-[10px] md:text-xs uppercase rounded-lg md:rounded-xl transition-colors">{t.cancel}</button>
                    <button onClick={handleConfirmDelete} className="px-3 md:px-5 py-1.5 md:py-2.5 bg-danger text-white hover:bg-red-600 text-[10px] md:text-xs font-bold uppercase rounded-lg md:rounded-xl transition-colors shadow-lg shadow-danger/20">{t.purge}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BudgetOverview;
