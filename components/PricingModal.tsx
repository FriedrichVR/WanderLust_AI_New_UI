
import React from 'react';
import { X } from 'lucide-react';
import PricingSection from './PricingSection';

interface Props {
    onClose: () => void;
    onSelectFree?: () => void;
}

const PricingModal: React.FC<Props> = ({ onClose, onSelectFree }) => {
    return (
        <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-2xl overflow-y-auto animate-fade-in custom-scrollbar font-sans">
            <div className="relative min-h-screen p-4 md:p-6">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="fixed top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[210]"
                >
                    <X size={24} />
                </button>

                <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-10">
                    <PricingSection
                        onStartFree={onSelectFree}
                        onStandard={() => {}}
                        onPro={() => {}}
                    />
                </div>
            </div>
        </div>
    );
};

export default PricingModal;
