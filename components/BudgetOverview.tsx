
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
    <div className="space-y-8 animate-fade-in pt-6">
      
      {/* Top Cards (Clean & Rounded) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-border p-8 rounded-3xl relative overflow-hidden">
            <div className="font-mono text-[10px] text-dim uppercase tracking-widest mb-3">{t.totalAllocation}</div>
            <div className="font-display text-4xl font-bold text-text">{currencySymbol}{trip.budget.toLocaleString()}</div>
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-panel"></div>
        </div>
        
        <div className="bg-surface border border-border p-8 rounded-3xl relative overflow-hidden">
            <div className="font-mono text-[10px] text-dim uppercase tracking-widest mb-3">{t.depleted}</div>
            <div className="font-display text-4xl font-bold text-dim">{currencySymbol}{totalSpent.toLocaleString()}</div>
            <div className="absolute bottom-0 left-0 h-1.5 bg-dim" style={{width: `${progress}%`}}></div>
        </div>

        <div className="bg-surface border border-border p-8 rounded-3xl relative overflow-hidden">
            <div className="font-mono text-[10px] text-dim uppercase tracking-widest mb-3">{t.reserves}</div>
            <div className={`font-display text-4xl font-bold`} style={{ color: remaining < 0 ? PALETTE.danger : PALETTE.acid }}>
                {currencySymbol}{remaining.toLocaleString()}
            </div>
            {remaining < 0 && <div className="absolute top-6 right-6 text-danger"><AlertTriangle size={24}/></div>}
            <div className="absolute bottom-0 left-0 w-full h-1.5" style={{ backgroundColor: remaining < 0 ? PALETTE.danger : PALETTE.acid }}></div>
        </div>
      </div>

      {/* Charts & Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-surface border border-border p-8 rounded-3xl min-h-[400px]">
            <h3 className="font-mono text-xs text-acid uppercase tracking-widest mb-8 border-b border-border pb-4">{t.spendingVector}</h3>
            {dataByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
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

        <div className="bg-surface border border-border p-8 rounded-3xl relative">
            <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
                <h3 className="font-mono text-xs text-acid uppercase tracking-widest">{t.transactionsLog}</h3>
                <button onClick={() => setShowAddModal(true)} className="text-text hover:text-acid transition-colors flex items-center gap-2 text-xs font-mono uppercase p-2 px-3 border border-border rounded-full hover:border-acid">
                    <Plus size={14} /> {t.manualEntry}
                </button>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {trip.expenses.length === 0 && <div className="text-dim text-xs font-mono text-center py-12">{t.logEmpty}</div>}
                {[...trip.expenses].reverse().map(expense => (
                    <div key={expense.id} className="flex items-center justify-between p-4 bg-panel rounded-xl border border-transparent hover:border-dim transition-colors group">
                        <div className="flex items-center gap-4">
                            <div 
                                className="w-1.5 h-10 rounded-full" 
                                style={{ backgroundColor: CATEGORY_COLORS[expense.category] || PALETTE.mid }}
                            ></div>
                            <div>
                                <div className="text-sm font-bold text-text">{expense.description}</div>
                                <div className="text-[10px] font-mono text-dim uppercase mt-0.5">{expense.date} // {expense.category}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-mono text-sm font-bold text-text">{currencySymbol}{expense.amount}</span>
                            <button onClick={() => setExpenseToDelete(expense.id)} className="text-dim hover:text-danger md:opacity-0 md:group-hover:opacity-100 transition-all p-2 bg-surface rounded-full">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-md border border-border p-8 rounded-3xl shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="font-display text-xl text-text uppercase">{t.newRecord}</h3>
                    <button onClick={() => setShowAddModal(false)} className="text-dim hover:text-text"><X size={20}/></button>
                </div>
                <div className="space-y-5">
                    <div>
                        <label className="font-mono text-[10px] text-dim uppercase block mb-2 tracking-widest">{t.description}</label>
                        <input type="text" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="w-full bg-panel border border-border p-3 text-sm text-text focus:border-acid outline-none font-mono rounded-xl" placeholder="ITEM_NAME"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="font-mono text-[10px] text-dim uppercase block mb-2 tracking-widest">{t.value}</label>
                            <input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: parseFloat(e.target.value)})} className="w-full bg-panel border border-border p-3 text-sm text-text focus:border-acid outline-none font-mono rounded-xl" placeholder="0.00"/>
                        </div>
                        <div>
                            <label className="font-mono text-[10px] text-dim uppercase block mb-2 tracking-widest">{t.tag}</label>
                            <select value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as any})} className="w-full bg-panel border border-border p-3 text-sm text-text focus:border-acid outline-none font-mono rounded-xl">
                                {['Accommodation', 'Food', 'Transport', 'Activities', 'Shopping', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <button onClick={handleSaveExpense} className="w-full py-3.5 bg-text text-obsidian hover:bg-acid font-mono text-xs font-bold uppercase tracking-widest transition-colors mt-6 rounded-xl shadow-lg">
                        {t.commitTransaction}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4 text-danger">
                    <AlertTriangle size={28} />
                    <h3 className="font-display text-lg uppercase tracking-tight">{t.confirmDeleteTransactionTitle}</h3>
                </div>
                <p className="text-sm text-dim font-mono mb-8 leading-relaxed">
                    {t.confirmDeleteTransactionMsg}
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setExpenseToDelete(null)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl transition-colors">{t.cancel}</button>
                    <button onClick={handleConfirmDelete} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl transition-colors shadow-lg shadow-danger/20">{t.purge}</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default BudgetOverview;
