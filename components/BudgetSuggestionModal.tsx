import React, { useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { X, Loader2, TrendingUp, AlertCircle } from 'lucide-react';
import { generateBudgetSuggestion } from '../services/geminiService';
import { Currency } from '../types';

interface Props {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  currency: Currency;
  onBudgetSuggested: (budget: number) => void;
  onClose: () => void;
  initialSuggestedBudget?: number | null;
  title?: string;
}

const BudgetSuggestionModal: React.FC<Props> = ({
  destination,
  startDate,
  endDate,
  tripType,
  currency,
  onBudgetSuggested,
  onClose,
  initialSuggestedBudget
  , title
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedBudget, setSuggestedBudget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (typeof initialSuggestedBudget === 'number') {
      setSuggestedBudget(initialSuggestedBudget);
    }
  }, [initialSuggestedBudget]);

  const duration = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) || 1;

  const fetchBudgetSuggestion = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const budget = await generateBudgetSuggestion(destination, duration, tripType, currency);
      if (budget) {
        setSuggestedBudget(budget);
      } else {
        setError('Could not generate budget suggestion. Try manually.');
      }
    } catch (err) {
      setError('Error fetching suggestion. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    if (suggestedBudget) {
      onBudgetSuggested(suggestedBudget);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
            <div className="p-2 bg-acid/10 rounded-lg">
              <TrendingUp size={24} className="text-acid" />
            </div>
            <h3 className="text-lg font-display font-bold text-text">{title || t.budgetSuggestionTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-panel rounded-full transition-colors text-dim"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Info */}
          <div className="bg-panel/50 border border-border/50 rounded-lg p-4 space-y-2 text-sm">
            <p className="text-text font-medium">Trip Details:</p>
            <div className="text-dim space-y-1">
              <p>📍 {destination}</p>
              <p>📅 {duration} days • {tripType}</p>
              <p>💱 {currency}</p>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2 text-sm text-red-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Suggestion */}
          {suggestedBudget && (
            <div className="bg-acid/5 border border-acid/30 rounded-lg p-4">
              <p className="text-dim text-sm mb-2">AI Suggested Budget:</p>
              <div className="text-4xl font-display font-bold text-acid">
                {currency} {suggestedBudget.toLocaleString()}
              </div>
              <p className="text-xs text-dim mt-2">
                ≈ {currency} {Math.round(suggestedBudget / duration)} per day
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border text-dim hover:text-text rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>

            {!suggestedBudget ? (
              <button
                onClick={fetchBudgetSuggestion}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-acid text-black hover:bg-white disabled:opacity-50 rounded-lg transition-all text-sm font-bold flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Get Suggestion'
                )}
              </button>
            ) : (
              <button
                onClick={handleAccept}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all text-sm font-bold"
              >
                Accept Budget
              </button>
            )}
          </div>

          <p className="text-xs text-dim/60 text-center">
            You can always adjust this budget later
          </p>
        </div>
      </div>
    </div>
  );
};

export default BudgetSuggestionModal;
