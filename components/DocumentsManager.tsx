
import React, { useRef, useState, useMemo } from 'react';
import { Upload, FileText, Trash2, Eye, Plane, Hotel, Folder, AlertTriangle, X, CheckSquare, Square, Loader2, Home, Utensils, Download, Camera, Settings, Plus, Edit2, Save, Filter, Maximize2, File, CheckCircle2, AlertCircle } from 'lucide-react';
import { Trip, TripDocument } from '../types';
import { translations, Language } from '../utils/translations';
import { ToastType } from './Toast';
import Tooltip from './Tooltip';
import LazyImage from './LazyImage';

interface Props {
  trip: Trip;
  updateTrip: (t: Trip) => void;
  lang: Language;
  showToast?: (msg: string, type: ToastType) => void;
}

const DocumentsManager: React.FC<Props> = ({ trip, updateTrip, lang, showToast }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];
  const [uploadType, setUploadType] = useState<string>('flight'); 
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [metadata, setMetadata] = useState<any>({});
  const [previewDoc, setPreviewDoc] = useState<TripDocument | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const [groupModal, setGroupModal] = useState<{ type: 'add' | 'edit' | 'delete', category?: string } | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');

  const [docToEdit, setDocToEdit] = useState<TripDocument | null>(null);
  const [editTagsInput, setEditTagsInput] = useState('');

  const documents = trip.documents || [];
  const categories = useMemo(() => trip.documentCategories || ['flight', 'hotel', 'airbnb', 'food', 'other'], [trip.documentCategories]);

  // Safety check to ensure active category exists
  if (!categories.includes(uploadType) && categories.length > 0) {
      const isStandard = ['flight', 'vuelos'].includes(uploadType.toLowerCase());
      if (!isStandard) setUploadType(categories[0]);
  }

  const getCategoryLabel = (cat: string) => {
      const lower = cat.toLowerCase();
      if (lower === 'flight' || lower === 'vuelos') return t.flights || 'Flights';
      if (lower === 'hotel') return 'Hotel';
      if (lower === 'airbnb') return t.airbnb || 'Airbnb';
      if (lower === 'food' || lower === 'comidas') return t.food || 'Food';
      if (lower === 'other') return 'Other';
      return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const getCategoryIcon = (cat: string, size: number = 24) => {
      const lower = cat.toLowerCase();
      if (lower === 'flight' || lower === 'vuelos') return <Plane size={size} className="text-acid"/>;
      if (lower === 'hotel') return <Hotel size={size} className="text-acid"/>;
      if (lower === 'airbnb') return <Home size={size} className="text-acid"/>;
      if (lower === 'food' || lower === 'comidas') return <Utensils size={size} className="text-acid"/>;
      if (lower === 'other') return <FileText size={size} className="text-acid"/>;
      return <Folder size={size} className="text-acid"/>;
  };

  const formatFileSize = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                // Resize to max 800px as requested for optimization
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Quality 0.6 for aggressive compression
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = (err) => resolve(event.target?.result as string); 
        };
        reader.onerror = (err) => reject(err);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        const newFiles = Array.from(event.target.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);
        event.target.value = '';
        setUploadStatus(null);
    }
  };

  const removeStagedFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddDocuments = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });
    setUploadStatus(null);
    const newDocs: TripDocument[] = [];
    let errorCount = 0;

    try {
      let processedCount = 0;
      for (const file of selectedFiles) {
        try {
            // Max size check for PDF/Documents: 10MB
            if (!file.type.startsWith('image/') && file.size > 10 * 1024 * 1024) {
                console.warn(`File ${file.name} is too large (>10MB). Skipping.`);
                errorCount++;
                continue;
            }

            const dataUrl = await resizeImage(file);
            newDocs.push({
                id: crypto.randomUUID(), 
                name: file.name, 
                type: uploadType, 
                dataUrl: dataUrl, 
                dateAdded: new Date().toISOString(),
                tags: tagsInput.split(',').map(tag => tag.trim()).filter(t => t), 
                metadata: { ...metadata }
            });
            processedCount++;
            setUploadProgress({ current: processedCount, total: selectedFiles.length });
        } catch (e) {
            console.error("Error processing file", file.name, e);
            errorCount++;
        }
      }

      if (newDocs.length > 0) {
          updateTrip({ ...trip, documents: [...documents, ...newDocs] });
          
          setSelectedFiles([]); 
          setTagsInput(''); 
          setMetadata({});
          
          const successMsg = `Successfully uploaded ${newDocs.length} file(s).`;
          setUploadStatus({ type: 'success', msg: successMsg });
          if (showToast) showToast(successMsg, 'success');
          
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          
          // Clear success message after 3s
          setTimeout(() => setUploadStatus(null), 3000);
      } else {
          const failMsg = "Upload failed. Check file sizes (Max 10MB for PDF).";
          setUploadStatus({ type: 'error', msg: failMsg });
          if (showToast) showToast(failMsg, 'error');
      }
      
      if (errorCount > 0 && newDocs.length > 0) {
          const partialMsg = `Uploaded ${newDocs.length} files. ${errorCount} failed (Size limit or format).`;
          setUploadStatus({ type: 'error', msg: partialMsg });
          if (showToast) showToast(partialMsg, 'info');
      }

    } catch(e) {
        console.error("Batch upload error", e);
        const errMsg = "An unexpected error occurred during upload.";
        setUploadStatus({ type: 'error', msg: errMsg });
        if (showToast) showToast(errMsg, 'error');
    } finally { 
        setIsUploading(false);
        setUploadProgress(null); 
    }
  };

  const handleDelete = () => {
    updateTrip({ ...trip, documents: documents.filter(d => !selectedIds.includes(d.id)) });
    setSelectedIds([]);
    setShowDeleteConfirm(false);
    if (showToast) showToast("Selected documents deleted.", 'info');
  };

  const toggleSelection = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const selectAll = () => {
      if (selectedIds.length === filteredDocuments.length) {
          setSelectedIds([]);
      } else {
          setSelectedIds(filteredDocuments.map(d => d.id));
      }
  };

  const handleCreateGroup = () => {
      if (!groupNameInput.trim()) return;
      const newCats = [...categories, groupNameInput.trim()];
      updateTrip({ ...trip, documentCategories: newCats });
      setGroupModal(null);
      setGroupNameInput('');
      if (showToast) showToast(`Group "${groupNameInput}" created.`, 'success');
  };

  const handleRenameGroup = () => {
      if (!groupNameInput.trim() || !groupModal?.category) return;
      const oldCat = groupModal.category;
      const newCat = groupNameInput.trim();
      const newCats = categories.map(c => c === oldCat ? newCat : c);
      const updatedDocs = documents.map(d => d.type === oldCat ? { ...d, type: newCat } : d);
      updateTrip({ ...trip, documentCategories: newCats, documents: updatedDocs });
      if (uploadType === oldCat) setUploadType(newCat);
      setGroupModal(null);
      setGroupNameInput('');
      if (showToast) showToast(`Group renamed to "${newCat}".`, 'success');
  };

  const handleDeleteGroup = () => {
      if (!groupModal?.category) return;
      const catToDelete = groupModal.category;
      const newCats = categories.filter(c => c !== catToDelete);
      updateTrip({ ...trip, documentCategories: newCats });
      if (uploadType === catToDelete && newCats.length > 0) setUploadType(newCats[0]);
      setGroupModal(null);
      if (showToast) showToast(`Group "${catToDelete}" deleted.`, 'info');
  };

  const initEdit = (doc: TripDocument) => {
      setDocToEdit(doc);
      setEditTagsInput(doc.tags?.join(', ') || '');
  };

  const handleSaveDocEdit = () => {
      if (!docToEdit) return;
      const updatedDoc = {
          ...docToEdit,
          tags: editTagsInput.split(',').map(tag => tag.trim()).filter(t => t)
      };
      const updatedDocs = documents.map(d => d.id === docToEdit.id ? updatedDoc : d);
      updateTrip({ ...trip, documents: updatedDocs });
      setDocToEdit(null);
      if (showToast) showToast("Document updated.", 'success');
  };

  // ... (rest of the rendering logic remains the same)
  const lowerType = uploadType.toLowerCase();
  const isLodging = lowerType.includes('hotel') || lowerType.includes('airbnb') || lowerType.includes('lodging');
  const isFlight = lowerType.includes('flight') || lowerType.includes('vuelo') || lowerType === 'flight';

  const filteredDocuments = useMemo(() => {
      if (filterCategory === 'all') return documents;
      return documents.filter(doc => doc.type === filterCategory);
  }, [documents, filterCategory]);

  const renderPreviewContent = (doc: TripDocument) => {
      if (doc.dataUrl.startsWith('data:image')) {
          return (
            <div className="w-full h-full flex items-center justify-center">
              <LazyImage 
                  src={doc.dataUrl} 
                  alt={doc.name}
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl"
              />
            </div>
          );
      }
      
      if (doc.dataUrl.startsWith('data:application/pdf')) {
          return (
            <div className="w-full h-full bg-panel rounded-2xl border border-border shadow-2xl overflow-hidden relative group flex flex-col">
                <iframe 
                    src={doc.dataUrl} 
                    className="w-full h-full flex-1 bg-white"
                    title={doc.name}
                >
                </iframe>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                     <a href={doc.dataUrl} download={doc.name} className="px-6 py-3 bg-acid text-black font-bold uppercase text-xs flex items-center gap-2 hover:bg-white transition-colors rounded-full shadow-xl">
                        <Download size={16} /> {t.download} PDF
                    </a>
                </div>
            </div>
          );
      }

      return (
          <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-panel/50 border border-border rounded-3xl max-w-md mx-auto backdrop-blur-md">
              <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 border border-border">
                {getCategoryIcon(doc.type, 40)}
              </div>
              <h3 className="text-2xl font-display font-bold text-white mb-2">{doc.name}</h3>
              <p className="text-gray-400 font-mono text-xs mb-8">Format not supported for inline preview.</p>
              <a href={doc.dataUrl} download={doc.name} className="px-8 py-4 bg-white text-black hover:bg-acid transition-colors font-bold font-mono uppercase text-xs flex items-center gap-2 rounded-full shadow-lg">
                  <Download size={16} /> {t.download} / Open
              </a>
          </div>
      );
  };

  return (
    <div className="animate-fade-in space-y-8 pt-6">
      {/* Upload Section */}
      <div className="bg-surface border border-border p-6 md:p-8 rounded-3xl shadow-sm">
        <div className="flex justify-between items-center mb-8 border-b border-border pb-4">
            <div className="font-mono text-xs text-acid uppercase tracking-widest">{t.uploadMatrix}</div>
            <button 
                onClick={() => setIsManagingGroups(!isManagingGroups)} 
                className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest transition-all px-4 py-2 border rounded-full ${
                    isManagingGroups 
                    ? 'bg-acid text-black border-acid font-bold' 
                    : 'bg-transparent border-dim text-dim hover:text-text hover:border-text'
                }`}
            >
                <Settings size={14} /> {isManagingGroups ? t.done : t.manageGroups}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                    {categories.map((type) => (
                        <div key={type} className="relative group">
                            <button 
                                onClick={() => {
                                    if (isManagingGroups) {
                                        setGroupNameInput(type);
                                        setGroupModal({ type: 'edit', category: type });
                                    } else {
                                        setUploadType(type);
                                    }
                                }} 
                                className={`py-2.5 px-4 text-xs font-mono uppercase border transition-colors truncate relative rounded-xl ${
                                    uploadType === type && !isManagingGroups ? 'bg-acid text-black border-acid font-bold shadow-lg' : 'border-border text-dim hover:text-text bg-panel hover:border-dim'
                                } ${isManagingGroups ? 'pr-8 border-dashed hover:border-acid cursor-text' : ''}`}
                            >
                                {getCategoryLabel(type)}
                                {isManagingGroups && <Edit2 size={10} className="absolute top-1 right-1 text-acid opacity-70" />}
                            </button>
                            
                            {isManagingGroups && (
                                <button 
                                    onClick={() => setGroupModal({ type: 'delete', category: type })}
                                    className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-1 opacity-100 shadow-sm z-20 hover:scale-110 transition-transform"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    ))}
                    {isManagingGroups && (
                        <button 
                            onClick={() => { setGroupNameInput(''); setGroupModal({ type: 'add' }); }}
                            className="py-2.5 px-4 border border-dashed border-dim text-dim hover:text-acid hover:border-acid transition-colors flex items-center justify-center rounded-xl"
                            title={t.createGroup}
                        >
                            <Plus size={16} />
                        </button>
                    )}
                </div>

                {/* Metadata Fields */}
                {isLodging && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-panel border border-border rounded-2xl animate-fade-in">
                        <div className="col-span-2">
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.hotelName}</label>
                             <input type="text" placeholder="PROPERTY NAME..." className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.hotelName || ''} onChange={e => setMetadata({...metadata, hotelName: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.bookingRef}</label>
                             <input type="text" placeholder="#123456" className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.bookingReference || ''} onChange={e => setMetadata({...metadata, bookingReference: e.target.value})} />
                        </div>
                        <div>
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.checkIn}</label>
                             <input type="date" className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.checkInDate || ''} onChange={e => setMetadata({...metadata, checkInDate: e.target.value})} />
                        </div>
                        <div>
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.checkOut}</label>
                             <input type="date" className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.checkOutDate || ''} onChange={e => setMetadata({...metadata, checkOutDate: e.target.value})} />
                        </div>
                    </div>
                )}
                
                {isFlight && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-panel border border-border rounded-2xl animate-fade-in">
                        <div>
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.airline}</label>
                             <input type="text" placeholder="AIRLINE..." className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.airline || ''} onChange={e => setMetadata({...metadata, airline: e.target.value})} />
                        </div>
                         <div>
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.flightNumber}</label>
                             <input type="text" placeholder="AB1234" className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.flightNumber || ''} onChange={e => setMetadata({...metadata, flightNumber: e.target.value})} />
                        </div>
                        <div>
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.departureAirport}</label>
                             <input type="text" placeholder="JFK" className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.departureAirport || ''} onChange={e => setMetadata({...metadata, departureAirport: e.target.value})} />
                        </div>
                        <div>
                             <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 block">{t.arrivalAirport}</label>
                             <input type="text" placeholder="LHR" className="w-full bg-surface border border-border p-3 text-xs text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.arrivalAirport || ''} onChange={e => setMetadata({...metadata, arrivalAirport: e.target.value})} />
                        </div>
                    </div>
                )}

                {/* Drop Zones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-dim bg-panel hover:bg-surface hover:border-acid h-32 flex flex-col items-center justify-center cursor-pointer transition-colors group rounded-2xl relative overflow-hidden">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,.pdf" />
                        <Upload className="text-dim mb-2 group-hover:text-acid transition-colors" size={28} />
                        <span className="font-mono text-[10px] text-dim uppercase group-hover:text-text transition-colors">{t.selectFiles}</span>
                        <span className="text-[8px] text-dim/50 mt-1">IMG, PDF (MAX 10MB)</span>
                    </div>
                    
                    <div onClick={() => cameraInputRef.current?.click()} className="border-2 border-dashed border-dim bg-panel hover:bg-surface hover:border-acid h-32 flex flex-col items-center justify-center cursor-pointer transition-colors group rounded-2xl">
                        <input 
                            type="file" 
                            ref={cameraInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept="image/*" 
                            capture="environment" 
                        />
                        <Camera className="text-dim mb-2 group-hover:text-acid transition-colors" size={28} />
                        <span className="font-mono text-[10px] text-dim uppercase group-hover:text-text transition-colors">{t.cameraCapture}</span>
                    </div>
                </div>

                {/* Staged Files List */}
                {selectedFiles.length > 0 && (
                    <div className="space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div className="font-mono text-[10px] text-dim uppercase tracking-widest">{t.filesStaged} ({selectedFiles.length})</div>
                            {selectedFiles.length > 1 && (
                                <button onClick={() => setSelectedFiles([])} className="text-[9px] font-mono uppercase text-danger hover:underline">Clear All</button>
                            )}
                        </div>
                        <div className="bg-panel border border-border rounded-2xl p-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                            {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-surface border border-border rounded-xl mb-2 last:mb-0 group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-2 bg-panel rounded-lg border border-border">
                                            <File size={16} className="text-acid" />
                                        </div>
                                        <div className="flex flex-col truncate">
                                            <span className="text-xs font-bold text-text truncate max-w-[150px]">{file.name}</span>
                                            <span className="text-[9px] font-mono text-dim">{formatFileSize(file.size)}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeStagedFile(index)} 
                                        className="p-2 text-dim hover:text-danger hover:bg-panel rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove file"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            <div className="space-y-6">
                <div>
                    <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-2 block">Tags</label>
                    <input type="text" placeholder="TAGS (COMMA SEPARATED)" className="w-full bg-panel border border-border p-4 text-sm text-text font-mono focus:border-acid outline-none transition-colors rounded-xl" value={tagsInput} onChange={e => setTagsInput(e.target.value)} />
                </div>
                
                <div className="flex flex-col gap-2 mt-auto">
                    {/* Status Message */}
                    {uploadStatus && (
                        <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-mono ${uploadStatus.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'} animate-fade-in`}>
                            {uploadStatus.type === 'success' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                            {uploadStatus.msg}
                        </div>
                    )}

                    {isUploading && uploadProgress && (
                        <div className="w-full bg-panel rounded-full h-2 mb-2 overflow-hidden">
                            <div 
                                className="bg-acid h-full transition-all duration-300 ease-out" 
                                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                            ></div>
                        </div>
                    )}
                    <button onClick={handleAddDocuments} disabled={selectedFiles.length === 0 || isUploading} className="w-full py-4 bg-text text-obsidian hover:bg-acid font-mono text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 rounded-xl shadow-lg">
                        {isUploading ? <Loader2 className="animate-spin" size={18}/> : <Upload size={18}/>}
                        {isUploading 
                            ? `${t.processing} (${uploadProgress?.current || 0}/${uploadProgress?.total || 0})` 
                            : t.executeUpload}
                    </button>
                    <div className="text-[9px] text-dim text-center font-mono opacity-60">
                        Auto-optimized images (800px). Max PDF size 10MB.
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="space-y-4">
        {/* ... (rest of the component structure, utilizing showToast for delete feedback where appropriate) ... */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
            <div className="flex items-center gap-4">
                <div className="font-mono text-xs text-dim uppercase tracking-widest">{t.fileRegistry} ({filteredDocuments.length})</div>
                {documents.length > 0 && (
                    <button onClick={selectAll} className="font-mono text-[10px] text-dim hover:text-text uppercase">
                        {selectedIds.length > 0 && selectedIds.length === filteredDocuments.length ? 'DESELECT ALL' : 'SELECT ALL'}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 no-scrollbar">
                <Filter size={14} className="text-dim shrink-0" />
                <button 
                    onClick={() => setFilterCategory('all')}
                    className={`px-4 py-1.5 text-[10px] font-mono uppercase border rounded-full whitespace-nowrap transition-colors ${
                        filterCategory === 'all' ? 'bg-acid text-black border-acid font-bold' : 'bg-panel border-border text-dim hover:text-text'
                    }`}
                >
                    {t.allCategories}
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-4 py-1.5 text-[10px] font-mono uppercase border rounded-full whitespace-nowrap transition-colors ${
                            filterCategory === cat ? 'bg-acid text-black border-acid font-bold' : 'bg-panel border-border text-dim hover:text-text'
                        }`}
                    >
                        {getCategoryLabel(cat)}
                    </button>
                ))}
            </div>

            {selectedIds.length > 0 && (
                <button onClick={() => setShowDeleteConfirm(true)} className="text-danger font-mono text-xs uppercase hover:text-text transition-colors flex items-center gap-2 shrink-0">
                    <Trash2 size={14} /> {t.deleteSelected} ({selectedIds.length})
                </button>
            )}
        </div>
        
        {/* ... Grid and Modal rendering ... */}
        {filteredDocuments.length === 0 ? (
            <div className="text-dim font-mono text-xs text-center py-16 border-2 border-dashed border-dim bg-panel/30 rounded-3xl">
                {documents.length === 0 ? t.noData : "// NO DOCUMENTS MATCH FILTER"}
            </div> 
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredDocuments.map(doc => (
                    <div key={doc.id} className={`bg-surface border p-4 relative group transition-all duration-300 hover:bg-panel rounded-3xl ${selectedIds.includes(doc.id) ? 'border-acid shadow-lg' : 'border-border hover:border-dim'}`}>
                        <div className="absolute top-3 right-3 cursor-pointer z-10 p-2 -m-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); toggleSelection(doc.id); }}>
                            {selectedIds.includes(doc.id) ? <CheckSquare size={18} className="text-acid" /> : <Square size={18} className="text-dim hover:text-text transition-colors" />}
                        </div>
                        
                        <div className="flex flex-col gap-4 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                            <div className="w-full aspect-[4/3] bg-panel border border-border text-dim flex items-center justify-center relative overflow-hidden shrink-0 rounded-2xl">
                                {doc.dataUrl.startsWith('data:image') ? (
                                    <LazyImage 
                                        src={doc.dataUrl} 
                                        alt="thumbnail"
                                        className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" 
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-surface text-dim group-hover:text-acid transition-colors">
                                        {getCategoryIcon(doc.type, 40)}
                                    </div>
                                )}
                            </div>
                            <div className="overflow-hidden">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-text text-sm truncate group-hover:text-acid transition-colors pr-4" title={doc.name}>{doc.name}</h4>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap gap-2">
                                        <span className="font-mono text-[9px] text-dim bg-panel px-2 py-0.5 border border-border rounded-full">{getCategoryLabel(doc.type).toUpperCase()}</span>
                                        <span className="font-mono text-[9px] text-dim py-0.5">{new Date(doc.dateAdded).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4 pt-4 border-t border-border/50 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setPreviewDoc(doc); }} className="flex-1 py-2 border border-border bg-surface text-[10px] font-mono text-dim hover:text-text hover:border-text transition-colors uppercase flex items-center justify-center gap-2 rounded-full">
                                <Eye size={12} /> View
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); initEdit(doc); }} className="w-10 py-2 border border-border bg-surface text-dim hover:text-acid hover:border-acid transition-colors flex items-center justify-center rounded-full" title="Edit Details">
                                <Edit2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* ... Modals (Delete, Groups, Edit, Preview) ... */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                <div className="flex items-center gap-3 mb-4 text-danger">
                    <AlertTriangle size={32} />
                    <h3 className="font-display text-lg uppercase tracking-tight">{t.confirmDeleteDocsTitle}</h3>
                </div>
                <p className="text-sm text-dim font-mono mb-2 leading-relaxed">
                    {t.confirmDeleteDocsMsg}
                </p>
                <p className="text-sm text-text font-bold font-mono mb-8">
                    Deleting {selectedIds.length} document(s).
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                    <button onClick={handleDelete} className="px-5 py-2.5 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl shadow-md">{t.purge}</button>
                </div>
            </div>
        </div>
      )}

      {/* Group and Edit modals remain similar, possibly using showToast if needed */}
      {groupModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-sm border border-border p-8 shadow-2xl rounded-3xl">
                {groupModal.type === 'delete' ? (
                    <>
                        <div className="flex items-center gap-3 mb-4 text-danger">
                            <AlertTriangle size={24} />
                            <h3 className="font-display text-lg uppercase">{t.deleteGroup}</h3>
                        </div>
                        <p className="text-sm text-dim font-mono mb-6">
                            {t.confirmDeleteGroupMsg}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setGroupModal(null)} className="px-4 py-2 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                            <button onClick={handleDeleteGroup} className="px-4 py-2 bg-danger text-white hover:bg-red-600 text-xs font-bold uppercase rounded-xl">{t.purge}</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6 pb-2 border-b border-border">
                            <h3 className="font-display text-lg text-text uppercase">{groupModal.type === 'add' ? t.createGroup : t.renameGroup}</h3>
                            <button onClick={() => setGroupModal(null)} className="text-dim hover:text-text"><X size={20}/></button>
                        </div>
                        <div className="mb-6">
                            <label className="font-mono text-[10px] text-dim uppercase tracking-widest mb-2 block">{t.groupName}</label>
                            <input 
                                type="text" 
                                value={groupNameInput}
                                onChange={e => setGroupNameInput(e.target.value)}
                                className="w-full bg-panel border border-border p-3 text-text font-mono focus:border-acid outline-none transition-colors rounded-xl"
                                placeholder="CATEGORY NAME..."
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setGroupModal(null)} className="px-4 py-2 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                            <button 
                                onClick={groupModal.type === 'add' ? handleCreateGroup : handleRenameGroup} 
                                disabled={!groupNameInput.trim()}
                                className="px-4 py-2 bg-text text-obsidian hover:bg-acid font-bold text-xs uppercase disabled:opacity-50 rounded-xl"
                            >
                                {t.saveChanges}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}

      {docToEdit && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-surface w-full max-w-md border border-border p-8 shadow-2xl overflow-y-auto max-h-[90vh] rounded-3xl">
                  <div className="flex items-center justify-between mb-6 pb-2 border-b border-border">
                      <h3 className="font-display text-lg text-text uppercase">Edit Document</h3>
                      <button onClick={() => setDocToEdit(null)} className="text-dim hover:text-text"><X size={20}/></button>
                  </div>
                  
                  <div className="space-y-5">
                      <div>
                          <label className="font-mono text-[10px] text-dim uppercase tracking-widest mb-2 block">Document Name</label>
                          <input 
                              type="text" 
                              value={docToEdit.name} 
                              onChange={(e) => setDocToEdit({...docToEdit, name: e.target.value})} 
                              className="w-full bg-panel border border-border p-3 text-text font-mono focus:border-acid outline-none transition-colors rounded-xl"
                          />
                      </div>
                      <div>
                          <label className="font-mono text-[10px] text-dim uppercase tracking-widest mb-2 block">Category</label>
                          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar border border-border p-2 bg-panel rounded-xl">
                              {categories.map(cat => (
                                  <button
                                    key={cat}
                                    onClick={() => setDocToEdit({...docToEdit, type: cat})}
                                    className={`px-3 py-2 text-xs font-mono uppercase text-left border transition-colors flex items-center gap-2 rounded-lg ${
                                        docToEdit.type === cat ? 'bg-acid text-black border-acid font-bold' : 'border-border text-dim hover:border-text'
                                    }`}
                                  >
                                      {docToEdit.type === cat && <CheckSquare size={12} />}
                                      {getCategoryLabel(cat)}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <label className="font-mono text-[10px] text-dim uppercase tracking-widest mb-2 block">Tags</label>
                          <input 
                              type="text" 
                              value={editTagsInput} 
                              onChange={(e) => setEditTagsInput(e.target.value)} 
                              className="w-full bg-panel border border-border p-3 text-text font-mono focus:border-acid outline-none transition-colors rounded-xl"
                              placeholder="e.g. receipt, important, booking"
                          />
                      </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-8">
                      <button onClick={() => setDocToEdit(null)} className="px-5 py-2.5 border border-border text-dim hover:text-text text-xs uppercase rounded-xl">{t.cancel}</button>
                      <button onClick={handleSaveDocEdit} className="px-5 py-2.5 bg-text text-obsidian hover:bg-acid font-bold text-xs uppercase rounded-xl">
                          {t.saveChanges}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {previewDoc && (
          <div className="fixed inset-0 z-[999] bg-black/98 backdrop-blur-xl flex flex-col animate-fade-in select-none" onClick={() => setPreviewDoc(null)}>
              {/* Toolbar */}
              <div className="flex justify-between items-center p-4 md:p-6 bg-gradient-to-b from-black/80 to-transparent shrink-0 z-10" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col">
                      <h3 className="font-display font-bold text-white uppercase tracking-wider text-lg truncate max-w-[200px] md:max-w-md">{previewDoc.name}</h3>
                      <span className="font-mono text-[10px] text-acid uppercase tracking-widest">{getCategoryLabel(previewDoc.type)} // {new Date(previewDoc.dateAdded).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                      <a 
                          href={previewDoc.dataUrl} 
                          download={previewDoc.name}
                          className="p-3 bg-white/10 hover:bg-acid hover:text-black text-white rounded-full transition-all backdrop-blur-sm border border-white/10"
                          title="Download"
                      >
                          <Download size={20} />
                      </a>
                      <button 
                          onClick={() => setPreviewDoc(null)} 
                          className="p-3 bg-white text-black hover:bg-gray-200 rounded-full transition-all z-50 shadow-lg"
                          title="Close"
                      >
                          <X size={20} />
                      </button>
                  </div>
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-hidden flex items-center justify-center p-4 relative" onClick={(e) => e.stopPropagation()}>
                   {renderPreviewContent(previewDoc)}
              </div>
          </div>
      )}
    </div>
  );
};

export default DocumentsManager;
