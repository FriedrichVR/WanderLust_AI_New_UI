
import React, { useRef, useState, useMemo } from 'react';
import { Upload, FileText, Trash2, Eye, Plane, Hotel, Folder, AlertTriangle, X, CheckSquare, Square, Loader2, Home, Utensils, Download, Camera, Settings, Plus, Edit2, Save, Filter, Maximize2, File, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { Trip, TripDocument } from '../types';
import { translations, Language } from '../utils/translations';
import { ToastType } from './Toast';
import Tooltip from './Tooltip';
import LazyImage from './LazyImage';
import { extractPDFData } from '../services/geminiService';
import { extractFlightMetadataLocal, mergeFlightMeta } from '../utils/flightMetadataExtractor';

interface Props {
  trip: Trip;
  updateTrip: (t: Trip) => void;
  lang: Language;
  showToast?: (msg: string, type: ToastType) => void;
}

const DocumentsManager: React.FC<Props> = ({ trip, updateTrip, lang, showToast }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const registryRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];
  const [uploadType, setUploadType] = useState<string>('flight'); 
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [metadata, setMetadata] = useState<any>({});
  const [autoMetaKeys, setAutoMetaKeys] = useState<Set<string>>(new Set());
  // AUTO badges visually hidden per new requirement
  const hasAuto = (_key: string) => false;
    const [previewDoc, setPreviewDoc] = useState<TripDocument | null>(null);
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [isManagingGroups, setIsManagingGroups] = useState(false);
  const [groupModal, setGroupModal] = useState<{ type: 'add' | 'edit' | 'delete', category?: string } | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');

  const [docToEdit, setDocToEdit] = useState<TripDocument | null>(null);
  const [editTagsInput, setEditTagsInput] = useState('');
    const [airbnbMetaIndex, setAirbnbMetaIndex] = useState<number>(0);
    const [flightMetaView, setFlightMetaView] = useState<'outbound' | 'return'>('outbound');

  const documents = trip.documents || [];
  const categories = useMemo(() => trip.documentCategories || ['flight', 'hotel', 'airbnb', 'food', 'other'], [trip.documentCategories]);
    const airbnbDocs = useMemo(() => documents.filter(d => (d.type || '').toLowerCase() === 'airbnb'), [documents]);

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
        const newFiles = Array.from(event.target.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);
        event.target.value = '';
        setUploadStatus(null);
        // For non-PDF-only selections, upload will be triggered after optional extraction below.
        
        // Auto-extract metadata from first PDF file depending on category
        const firstPDF = newFiles.find(f => (f.type && f.type.toLowerCase().includes('pdf')) || f.name.toLowerCase().endsWith('.pdf'));
        if (firstPDF && (uploadType.toLowerCase().includes('airbnb') || uploadType.toLowerCase().includes('flight'))) {
            try {
                if (showToast) showToast(`Extracting data from ${firstPDF.name}...`, 'info');
            setIsExtracting(true);
                
                // Convert PDF to base64
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const dataUrl = e.target?.result as string;
                        // Local heuristic extraction first (only for flight)
                        let localFlight: any = null;
                        const isFlightCat = uploadType.toLowerCase().includes('flight') || uploadType.toLowerCase().includes('vuelo');
                        if (isFlightCat) {
                            localFlight = await extractFlightMetadataLocal(dataUrl);
                        }
                        const pdfData = await extractPDFData(dataUrl, uploadType);
                        
                        if (pdfData) {
                            let mergedMeta: any;
                            if (isFlightCat) {
                                mergedMeta = { ...metadata, ...mergeFlightMeta(metadata, localFlight, pdfData) };
                            } else {
                                mergedMeta = {
                                    ...metadata,
                                    hotelName: pdfData.propertyName || metadata.hotelName,
                                    hostName: pdfData.hostName || metadata.hostName,
                                    bookingReference: pdfData.bookingReference || metadata.bookingReference,
                                    checkInDate: pdfData.checkInDate || metadata.checkInDate,
                                    checkOutDate: pdfData.checkOutDate || metadata.checkOutDate,
                                    address: pdfData.address || metadata.address,
                                    whatsappNumber: pdfData.whatsappNumber || metadata.whatsappNumber,
                                    guestName: pdfData.guestName || metadata.guestName,
                                    totalPrice: pdfData.totalPrice || metadata.totalPrice
                                };
                            }
                            // Track which keys were auto-populated from extraction
                            const newAutoKeys = new Set<string>(autoMetaKeys);
                            if (isFlightCat) {
                                if (pdfData.bookingReference) newAutoKeys.add('bookingReference');
                                if (pdfData.outbound?.checkInCode) newAutoKeys.add('outboundCheckInCode');
                                if (pdfData.outbound?.passengers) newAutoKeys.add('outboundPassengers');
                                if (pdfData.outbound?.airline) newAutoKeys.add('outboundAirline');
                                if (pdfData.outbound?.departureDate) newAutoKeys.add('outboundDepartureDate');
                                if (pdfData.outbound?.departureTime) newAutoKeys.add('outboundDepartureTime');
                                if (pdfData.outbound?.arrivalDate) newAutoKeys.add('outboundArrivalDate');
                                if (pdfData.outbound?.arrivalTime) newAutoKeys.add('outboundArrivalTime');
                                if (pdfData.outbound?.route) newAutoKeys.add('outboundRoute');
                                if (pdfData.outbound?.destination) newAutoKeys.add('outboundDestination');
                                if (pdfData.outbound?.duration) newAutoKeys.add('outboundDuration');
                                if (pdfData.outbound?.layover?.airport) newAutoKeys.add('outboundLayoverAirport');
                                if (pdfData.outbound?.layover?.waitDuration) newAutoKeys.add('outboundLayoverWait');
                                if (pdfData.return?.checkInCode) newAutoKeys.add('returnCheckInCode');
                                if (pdfData.return?.passengers) newAutoKeys.add('returnPassengers');
                                if (pdfData.return?.airline) newAutoKeys.add('returnAirline');
                                if (pdfData.return?.departureDate) newAutoKeys.add('returnDepartureDate');
                                if (pdfData.return?.departureTime) newAutoKeys.add('returnDepartureTime');
                                if (pdfData.return?.arrivalDate) newAutoKeys.add('returnArrivalDate');
                                if (pdfData.return?.arrivalTime) newAutoKeys.add('returnArrivalTime');
                                if (pdfData.return?.route) newAutoKeys.add('returnRoute');
                                if (pdfData.return?.destination) newAutoKeys.add('returnDestination');
                                if (pdfData.return?.duration) newAutoKeys.add('returnDuration');
                                if (pdfData.return?.layover?.airport) newAutoKeys.add('returnLayoverAirport');
                                if (pdfData.return?.layover?.waitDuration) newAutoKeys.add('returnLayoverWait');
                                // Also mark local extraction fields if AI missed them
                                if (localFlight) {
                                    const localKeys: Record<string, any> = mergeFlightMeta({}, localFlight, null);
                                    Object.entries(localKeys).forEach(([k,v]) => { if (v && !newAutoKeys.has(k)) newAutoKeys.add(k); });
                                }
                            } else {
                                if (pdfData.propertyName) newAutoKeys.add('hotelName');
                                if (pdfData.hostName) newAutoKeys.add('hostName');
                                if (pdfData.bookingReference) newAutoKeys.add('bookingReference');
                                if (pdfData.checkInDate) newAutoKeys.add('checkInDate');
                                if (pdfData.checkOutDate) newAutoKeys.add('checkOutDate');
                                if (pdfData.address) newAutoKeys.add('address');
                                if (pdfData.whatsappNumber) newAutoKeys.add('whatsappNumber');
                                if (pdfData.guestName) newAutoKeys.add('guestName');
                                if (pdfData.totalPrice) newAutoKeys.add('totalPrice');
                            }
                            setMetadata(mergedMeta);
                            setAutoMetaKeys(newAutoKeys);
                            if (showToast) {
                                const autoCount = Array.from(newAutoKeys).length;
                                const localCount = localFlight ? Object.values(localFlight.outbound||{}).filter(Boolean).length : 0;
                                showToast(`Datos extraídos (${autoCount} campos • local heurísticos: ${localCount})`, 'success');
                            }
                            // After extraction, upload with enriched metadata
                            if (!isUploading) {
                                handleAddDocuments(newFiles, mergedMeta);
                            }
                            setIsExtracting(false);
                        } else {
                            console.warn('PDF extraction returned null for', firstPDF.name);
                            if (showToast) showToast('No se pudo extraer datos del PDF. Subido sin metadatos.', 'error');
                            if (!isUploading) {
                                handleAddDocuments(newFiles);
                            }
                            setIsExtracting(false);
                        }
                    } catch (error) {
                        console.warn('PDF extraction failed:', error);
                        if (showToast) showToast('Falló la extracción del PDF. Subiendo documento...', 'error');
                        if (!isUploading) {
                            handleAddDocuments(newFiles);
                        }
                        setIsExtracting(false);
                    }
                };
                reader.readAsDataURL(firstPDF);
            } catch (error) {
                console.warn('PDF processing error:', error);
                if (showToast) showToast('Error procesando el PDF. Subiendo documento...', 'error');
                if (!isUploading) {
                    handleAddDocuments(newFiles);
                }
                setIsExtracting(false);
            }
        } else {
            // No PDF extraction needed: upload immediately
            if (!isUploading) {
                handleAddDocuments(newFiles);
            }
        }
    }
  };

  const removeStagedFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

    const handleAddDocuments = async (files?: File[], metadataOverride?: any) => {
        const filesToUpload = files && files.length > 0 ? files : selectedFiles;
        if (filesToUpload.length === 0) return;
    setIsUploading(true);
        setUploadProgress({ current: 0, total: filesToUpload.length });
    setUploadStatus(null);
    const newDocs: TripDocument[] = [];
    let errorCount = 0;

    try {
      let processedCount = 0;
            for (const file of filesToUpload) {
        try {
            // Max size check for PDF/Documents: 10MB
            if (!file.type.startsWith('image/') && file.size > 10 * 1024 * 1024) {
                console.warn(`File ${file.name} is too large (>10MB). Skipping.`);
                errorCount++;
                continue;
            }

            const dataUrl = await resizeImage(file);
            
            // Metadata is already extracted in handleFileSelect, just use current state
            const genId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Math.random().toString(36).slice(2);
            newDocs.push({
                id: genId, 
                name: file.name, 
                type: (uploadType || '').toLowerCase(), 
                dataUrl: dataUrl, 
                dateAdded: new Date().toISOString(),
                tags: tagsInput.split(',').map(tag => tag.trim()).filter(t => t), 
                metadata: metadataOverride ? { ...metadataOverride } : { ...metadata }
            });
            processedCount++;
            setUploadProgress({ current: processedCount, total: filesToUpload.length });
        } catch (e) {
            console.error("Error processing file", file.name, e);
            errorCount++;
        }
      }

            if (newDocs.length > 0) {
          const updated = [...documents, ...newDocs];
          updateTrip({ ...trip, documents: updated });
          
          // Auto-focus File Registry on current category and highlight latest doc
          setFilterCategory((uploadType || '').toLowerCase());
                    // Do not auto-open viewer on upload; user can open manually

                    // Ensure File Registry is visible
                    try {
                        registryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } catch {}
          
                    setSelectedFiles([]); 
                    setTagsInput(''); 
                    // Preserve metadata in state when override was used (it already contains extracted data)
                    if (!metadataOverride) {
                        setMetadata({});
                        setAutoMetaKeys(new Set());
                    }
          
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

  const handleReextract = async (doc: TripDocument) => {
      const docTypeLower = (doc.type || '').toLowerCase();
      const isFlightDoc = docTypeLower.includes('flight') || docTypeLower.includes('vuelo');
      const isLodgingDoc = docTypeLower.includes('airbnb');
      if (!isFlightDoc && !isLodgingDoc) {
          if (showToast) showToast('Solo disponible para Flights y Airbnb.', 'info');
          return;
      }
      try {
          if (showToast) showToast(`Re-extrayendo datos de ${doc.name}...`, 'info');
          const data = await extractPDFData(doc.dataUrl, doc.type);
          if (!data) {
              if (showToast) showToast('No se pudo extraer datos.', 'error');
              return;
          }
          const updatedDocs = documents.map(d => {
              if (d.id !== doc.id) return d;
              const currentMeta = d.metadata || {};
              const mergedMeta = isFlightDoc ? {
                  ...currentMeta,
                  bookingReference: data.bookingReference || currentMeta.bookingReference,
                  outboundCheckInCode: data.outbound?.checkInCode || currentMeta.outboundCheckInCode,
                  outboundPassengers: data.outbound?.passengers || currentMeta.outboundPassengers,
                  outboundRoute: data.outbound?.route || currentMeta.outboundRoute,
                  outboundDestination: data.outbound?.destination || currentMeta.outboundDestination,
                  outboundDuration: data.outbound?.duration || currentMeta.outboundDuration,
                  returnCheckInCode: data.return?.checkInCode || currentMeta.returnCheckInCode,
                  returnPassengers: data.return?.passengers || currentMeta.returnPassengers,
                  returnRoute: data.return?.route || currentMeta.returnRoute,
                  returnDestination: data.return?.destination || currentMeta.returnDestination,
                  returnDuration: data.return?.duration || currentMeta.returnDuration
              } : {
                  ...currentMeta,
                  hotelName: data.propertyName || currentMeta.hotelName,
                  hostName: data.hostName || currentMeta.hostName,
                  bookingReference: data.bookingReference || currentMeta.bookingReference,
                  checkInDate: data.checkInDate || currentMeta.checkInDate,
                  checkOutDate: data.checkOutDate || currentMeta.checkOutDate,
                  address: data.address || currentMeta.address,
                  whatsappNumber: data.whatsappNumber || currentMeta.whatsappNumber,
                  guestName: data.guestName || currentMeta.guestName,
                  totalPrice: data.totalPrice || currentMeta.totalPrice
              };
              return { ...d, metadata: mergedMeta };
          });
          updateTrip({ ...trip, documents: updatedDocs });
          // Update on-screen metadata if re-extracting current category
          if ((uploadType || '').toLowerCase() === docTypeLower) {
              const mergedForScreen = (updatedDocs.find(x => x.id === doc.id)?.metadata) || {};
              setMetadata(mergedForScreen);
              const newAuto = new Set<string>();
              if (isFlightDoc) {
                  if (data.bookingReference) newAuto.add('bookingReference');
                  if (data.outbound?.checkInCode) newAuto.add('outboundCheckInCode');
                  if (data.outbound?.passengers) newAuto.add('outboundPassengers');
                  if (data.outbound?.route) newAuto.add('outboundRoute');
                  if (data.outbound?.destination) newAuto.add('outboundDestination');
                  if (data.outbound?.duration) newAuto.add('outboundDuration');
                  if (data.return?.checkInCode) newAuto.add('returnCheckInCode');
                  if (data.return?.passengers) newAuto.add('returnPassengers');
                  if (data.return?.route) newAuto.add('returnRoute');
                  if (data.return?.destination) newAuto.add('returnDestination');
                  if (data.return?.duration) newAuto.add('returnDuration');
              } else {
                  if (data.propertyName) newAuto.add('hotelName');
                  if (data.hostName) newAuto.add('hostName');
                  if (data.bookingReference) newAuto.add('bookingReference');
                  if (data.checkInDate) newAuto.add('checkInDate');
                  if (data.checkOutDate) newAuto.add('checkOutDate');
                  if (data.address) newAuto.add('address');
                  if (data.whatsappNumber) newAuto.add('whatsappNumber');
                  if (data.guestName) newAuto.add('guestName');
                  if (data.totalPrice) newAuto.add('totalPrice');
              }
              setAutoMetaKeys(newAuto);
          }
          if (showToast) showToast('Extracción completada.', 'success');
      } catch (e) {
          console.warn('Re-extracción falló:', e);
          if (showToast) showToast('Falló la re-extracción.', 'error');
      }
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
    const isLodging = lowerType.includes('airbnb');
  const isFlight = lowerType.includes('flight') || lowerType.includes('vuelo') || lowerType === 'flight';

  const filteredDocuments = useMemo(() => {
      if (filterCategory === 'all') return documents;
      const fc = (filterCategory || '').toLowerCase();
      return documents.filter(doc => (doc.type || '').toLowerCase() === fc);
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
                    aria-label={doc.name}
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

      // Preview for other formats: show icon, name, download
      return (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 md:p-12 bg-panel/50 border border-border rounded-xl md:rounded-3xl max-w-md mx-auto backdrop-blur-md">
              <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mb-6 border border-border">
                {getCategoryIcon(doc.type, 40)}
              </div>
              <h3 className="text-lg md:text-2xl font-display font-bold text-white mb-2">{doc.name}</h3>
              <p className="text-gray-400 font-mono text-xs mb-8">Format not supported for inline preview.</p>
              <a href={doc.dataUrl} download={doc.name} className="px-4 md:px-8 py-2.5 md:py-4 bg-white text-black hover:bg-acid transition-colors font-bold font-mono uppercase text-[10px] md:text-xs flex items-center gap-2 rounded-full shadow-lg">
                  <Download size={16} /> {t.download} / Open
              </a>
          </div>
      );
  };

  return (
    <div className="animate-fade-in space-y-4 md:space-y-8 pt-3 md:pt-6">
            {isExtracting && (
                <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-6">
                        <Plane size={96} className="text-acid animate-spin" />
                        <div className="font-mono text-[11px] md:text-xs uppercase tracking-widest text-acid">
                            Analizando documento…
                        </div>
                    </div>
                </div>
            )}
      {/* Upload Section */}
    <div className="bg-surface border border-border p-3 md:p-6 rounded-xl md:rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-4 md:mb-8 border-b border-border pb-2 md:pb-4">
            <div className="font-mono text-[10px] md:text-xs text-acid uppercase tracking-widest">{t.uploadMatrix}</div>
            <button 
                onClick={() => setIsManagingGroups(!isManagingGroups)} 
                className={`flex items-center gap-1.5 md:gap-2 text-[9px] md:text-[10px] font-mono uppercase tracking-widest transition-all px-2 md:px-4 py-1.5 md:py-2 border rounded-full ${
                    isManagingGroups 
                    ? 'bg-acid text-black border-acid font-bold' 
                    : 'bg-transparent border-dim text-dim hover:text-text hover:border-text'
                }`}
            >
                <Settings size={12} className="md:hidden" />
                <Settings size={14} className="hidden md:block" /> {isManagingGroups ? t.done : t.manageGroups}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
            <div className="space-y-3 md:space-y-6">
                <div className="flex flex-wrap gap-2 md:gap-3">
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
                                className={`py-1.5 md:py-2.5 px-2.5 md:px-4 text-[10px] md:text-xs font-mono uppercase border transition-colors truncate relative rounded-lg md:rounded-xl ${
                                    uploadType === type && !isManagingGroups ? 'bg-acid text-black border-acid font-bold shadow-lg' : 'border-border text-dim hover:text-text bg-panel hover:border-dim'
                                } ${isManagingGroups ? 'pr-7 md:pr-8 border-dashed hover:border-acid cursor-text' : ''}`}
                            >
                                {getCategoryLabel(type)}
                                {isManagingGroups && <Edit2 size={9} className="absolute top-1 right-1 text-acid opacity-70 md:hidden" />}
                                {isManagingGroups && <Edit2 size={10} className="absolute top-1 right-1 text-acid opacity-70 hidden md:block" />}
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
                            className="py-1.5 md:py-2.5 px-2.5 md:px-4 border border-dashed border-dim text-dim hover:text-acid hover:border-acid transition-colors flex items-center justify-center rounded-lg md:rounded-xl"
                            title={t.createGroup}
                        >
                            <Plus size={14} className="md:hidden" />
                            <Plus size={16} className="hidden md:block" />
                        </button>
                    )}
                </div>

                {/* Metadata Fields */}
                {isLodging && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 md:gap-2 p-2 md:p-3 bg-panel border border-border rounded-lg md:rounded-xl animate-fade-in">
                        {/* Navigator for Airbnb metadata when multiple PDFs exist */}
                        {uploadType.toLowerCase().includes('airbnb') && airbnbDocs.length > 1 && (
                            <div className="col-span-2 flex items-center justify-between mb-0.5 md:mb-1">
                                <span className="font-mono text-[9px] md:text-[10px] text-text uppercase tracking-widest">Datos de documento {airbnbMetaIndex + 1}/{airbnbDocs.length}</span>
                                <div className="flex items-center gap-2 md:gap-3">
                                    <button
                                        onClick={() => {
                                            const next = (airbnbMetaIndex - 1 + airbnbDocs.length) % airbnbDocs.length;
                                            setAirbnbMetaIndex(next);
                                            const m = airbnbDocs[next].metadata || {};
                                            setMetadata({
                                                ...metadata,
                                                hotelName: m.hotelName || metadata.hotelName,
                                                hostName: m.hostName || metadata.hostName,
                                                bookingReference: m.bookingReference || metadata.bookingReference,
                                                checkInDate: m.checkInDate || metadata.checkInDate,
                                                checkOutDate: m.checkOutDate || metadata.checkOutDate,
                                                address: m.address || metadata.address,
                                                whatsappNumber: m.whatsappNumber || metadata.whatsappNumber,
                                                guestName: m.guestName || metadata.guestName,
                                                totalPrice: m.totalPrice || metadata.totalPrice
                                            });
                                        }}
                                        className="px-2 md:px-3 py-1 md:py-2 border border-text bg-panel rounded-full text-[10px] md:text-[11px] font-mono text-text hover:bg-text hover:text-obsidian transition-colors shadow-sm"
                                        title="Anterior"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        onClick={() => {
                                            const next = (airbnbMetaIndex + 1) % airbnbDocs.length;
                                            setAirbnbMetaIndex(next);
                                            const m = airbnbDocs[next].metadata || {};
                                            setMetadata({
                                                ...metadata,
                                                hotelName: m.hotelName || metadata.hotelName,
                                                hostName: m.hostName || metadata.hostName,
                                                bookingReference: m.bookingReference || metadata.bookingReference,
                                                checkInDate: m.checkInDate || metadata.checkInDate,
                                                checkOutDate: m.checkOutDate || metadata.checkOutDate,
                                                address: m.address || metadata.address,
                                                whatsappNumber: m.whatsappNumber || metadata.whatsappNumber,
                                                guestName: m.guestName || metadata.guestName,
                                                totalPrice: m.totalPrice || metadata.totalPrice
                                            });
                                        }}
                                        className="px-3 py-2 border border-text bg-panel rounded-full text-[11px] font-mono text-text hover:bg-text hover:text-obsidian transition-colors shadow-sm"
                                        title="Siguiente"
                                    >
                                        ›
                                    </button>
                                </div>
                            </div>
                        )}
                            <div className="col-span-2">
                                                        <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">{t.hotelName}
                                                             {/* AUTO badge removed */}
                                </label>
                             <input type="text" placeholder="PROPERTY NAME..." className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.hotelName || ''} onChange={e => setMetadata({...metadata, hotelName: e.target.value})} />
                        </div>
                                                <div className="col-span-2">
                                                        <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">{t.host || 'Host (Anfitrión)'}
                                                            {/* AUTO badge removed */}
                                                        </label>
                            <input type="text" placeholder="HOST NAME..." className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.hostName || ''} onChange={e => setMetadata({...metadata, hostName: e.target.value})} />
                        </div>
                            <div className="col-span-2">
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">{t.bookingRef}
                                                             {/* AUTO badge removed */}
                                </label>
                             <input type="text" placeholder="#123456" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.bookingReference || ''} onChange={e => setMetadata({...metadata, bookingReference: e.target.value})} />
                        </div>
                            <div>
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">{t.checkIn}
                                                             {/* AUTO badge removed */}
                                </label>
                             <input type="date" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.checkInDate || ''} onChange={e => setMetadata({...metadata, checkInDate: e.target.value})} />
                        </div>
                            <div>
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">{t.checkOut}
                                                             {/* AUTO badge removed */}
                                </label>
                             <input type="date" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.checkOutDate || ''} onChange={e => setMetadata({...metadata, checkOutDate: e.target.value})} />
                        </div>
                            <div className="col-span-2">
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Address
                                                             {/* AUTO badge removed */}
                                </label>
                             <input type="text" placeholder="FULL ADDRESS..." className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.address || ''} onChange={e => setMetadata({...metadata, address: e.target.value})} />
                        </div>
                            <div className="col-span-2">
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">WhatsApp Number
                                                             {/* AUTO badge removed */}
                                </label>
                             <input type="text" placeholder="+1 234 567 8900" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.whatsappNumber || ''} onChange={e => setMetadata({...metadata, whatsappNumber: e.target.value})} />
                        </div>
                    </div>
                )}
                
                {isFlight && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-panel border border-border rounded-xl animate-fade-in">
                        <div className="col-span-2 flex items-center justify-between mb-2">
                            <span className="font-mono text-[9px] text-text uppercase tracking-widest">{flightMetaView === 'outbound' ? 'Vuelo de IDA' : 'Vuelo de Vuelta'}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setFlightMetaView('outbound')}
                                    className={`px-2.5 py-1.5 border rounded-full text-[10px] font-mono transition-colors ${flightMetaView === 'outbound' ? 'bg-text text-obsidian border-text' : 'bg-panel text-text border-border hover:border-text'}`}
                                    title="IDA"
                                >
                                    ‹
                                </button>
                                <button
                                    onClick={() => setFlightMetaView('return')}
                                    className={`px-2.5 py-1.5 border rounded-full text-[10px] font-mono transition-colors ${flightMetaView === 'return' ? 'bg-text text-obsidian border-text' : 'bg-panel text-text border-border hover:border-text'}`}
                                    title="VUELTA"
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                            <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Número de Reserva</label>
                                    <input type="text" placeholder="#ABC123" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={metadata.bookingReference || ''} onChange={e => setMetadata({...metadata, bookingReference: e.target.value})} />
                                </div>
                                <div>
                                    <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Aerolínea</label>
                                    <input type="text" placeholder="Compañía / código" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundAirline || '') : (metadata.returnAirline || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? { ...metadata, outboundAirline: e.target.value } : { ...metadata, returnAirline: e.target.value })} />
                                </div>
                            </div>
                                                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Fecha de salida</label>
                                                        <input type="date" className="bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundDepartureDate || '') : (metadata.returnDepartureDate || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? { ...metadata, outboundDepartureDate: e.target.value } : { ...metadata, returnDepartureDate: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Horario de salida</label>
                                                        <input type="time" className="bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundDepartureTime || '') : (metadata.returnDepartureTime || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? { ...metadata, outboundDepartureTime: e.target.value } : { ...metadata, returnDepartureTime: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Fecha de llegada</label>
                                                        <input type="date" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundArrivalDate || '') : (metadata.returnArrivalDate || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? { ...metadata, outboundArrivalDate: e.target.value } : { ...metadata, returnArrivalDate: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Horario de llegada</label>
                                                        <input type="time" className="w-full bg-surface border border-border p-2 text:[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundArrivalTime || '') : (metadata.returnArrivalTime || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? { ...metadata, outboundArrivalTime: e.target.value } : { ...metadata, returnArrivalTime: e.target.value })} />
                                                    </div>
                                                </div>
                                                <div>
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 flex items-center gap-2">Código de Check-in</label>
                             <input type="text" placeholder="XXXX" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundCheckInCode || '') : (metadata.returnCheckInCode || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? {...metadata, outboundCheckInCode: e.target.value} : {...metadata, returnCheckInCode: e.target.value})} />
                        </div>
                                                <div className="col-span-2">
                                                                            <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-0.5 flex items-center gap-2">Pasajeros (uno por línea)</label>
                                                         <textarea placeholder="Nombre\\nNombre 2" className="w-full bg-surface border border-border p-2.5 text-[12px] sm:text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg h-24 sm:h-20 resize-y" value={(flightMetaView === 'outbound' ? (metadata.outboundPassengers || []) : (metadata.returnPassengers || [])).join('\\n')} onChange={e => setMetadata(
                                                                flightMetaView === 'outbound'
                                                                ? { ...metadata, outboundPassengers: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) }
                                                                : { ...metadata, returnPassengers: e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean) }
                                                         )} />
                                                </div>
                                                                                                <div>
                                                                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 flex items-center gap-2">Aeropuerto de escala</label>
                                                                                                        <input type="text" placeholder="IATA/ciudad" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundLayoverAirport || '') : (metadata.returnLayoverAirport || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? { ...metadata, outboundLayoverAirport: e.target.value } : { ...metadata, returnLayoverAirport: e.target.value })} />
                                                                                                </div>
                                                                                                <div>
                                                                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 flex items-center gap-2">Tiempo de espera</label>
                                                                                                        <input type="text" placeholder="2h 30m" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundLayoverWait || '') : (metadata.returnLayoverWait || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? { ...metadata, outboundLayoverWait: e.target.value } : { ...metadata, returnLayoverWait: e.target.value })} />
                                                                                                </div>
                                                <div>
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 flex items-center gap-2">Trayecto</label>
                             <input type="text" placeholder="EZE → MIA" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundRoute || '') : (metadata.returnRoute || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? {...metadata, outboundRoute: e.target.value} : {...metadata, returnRoute: e.target.value})} />
                        </div>
                                                <div>
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 flex items-center gap-2">Destino</label>
                             <input type="text" placeholder="IATA/ciudad" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundDestination || '') : (metadata.returnDestination || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? {...metadata, outboundDestination: e.target.value} : {...metadata, returnDestination: e.target.value})} />
                        </div>
                                                <div>
                                                         <label className="font-mono text-[9px] text-dim uppercase tracking-widest mb-1 flex items-center gap-2">Duración</label>
                             <input type="text" placeholder="9h 45m" className="w-full bg-surface border border-border p-2 text-[11px] text-text font-mono focus:border-acid outline-none transition-colors rounded-lg" value={flightMetaView === 'outbound' ? (metadata.outboundDuration || '') : (metadata.returnDuration || '')} onChange={e => setMetadata(flightMetaView === 'outbound' ? {...metadata, outboundDuration: e.target.value} : {...metadata, returnDuration: e.target.value})} />
                        </div>
                    </div>
                )}

                {/* Drop Zones */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-text bg-panel hover:bg-surface hover:border-acid h-36 flex flex-col items-center justify-center cursor-pointer transition-colors group rounded-2xl relative overflow-hidden shadow-md">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,.pdf" />
                        <Upload className="text-text mb-2 group-hover:text-acid transition-colors" size={32} />
                        <span className="font-mono text-[11px] text-text uppercase group-hover:text-acid transition-colors">{t.selectFiles}</span>
                        <span className="text-[9px] text-dim mt-1">IMG, PDF (MAX 10MB)</span>
                        
                    </div>
                    
                    <div onClick={() => cameraInputRef.current?.click()} className="border-2 border-dashed border-text bg-panel hover:bg-surface hover:border-acid h-36 flex flex-col items-center justify-center cursor-pointer transition-colors group rounded-2xl shadow-md">
                        <input 
                            type="file" 
                            ref={cameraInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept="image/*" 
                            capture="environment" 
                        />
                        <Camera className="text-text mb-2 group-hover:text-acid transition-colors" size={32} />
                        <span className="font-mono text-[11px] text-text uppercase group-hover:text-acid transition-colors">{t.cameraCapture}</span>
                    </div>
                </div>
                {/* Removed auto-optimized/max size notice */}

                {/* Staged Files List */}
                {selectedFiles.length > 0 && (
                    <div className="space-y-3 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <div className="font-mono text-[10px] text-dim uppercase tracking-widest">{t.filesStaged} ({selectedFiles.length})</div>
                            {selectedFiles.length > 1 && (
                                <button onClick={() => setSelectedFiles([])} className="text-[9px] font-mono uppercase text-danger hover:underline">Clear All</button>
                            )}
                        </div>
                        <div className="bg-panel border border-border rounded-xl p-2 max-h-[160px] overflow-y-auto custom-scrollbar">
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

                {/* Airbnb quick upload removed as requested */}
            </div>
            
            <div className="space-y-4">
                {/* Right column simplified: removed Tags and manual Execute Upload */}
                <div className="flex flex-col gap-2 mt-auto">
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
                    {/* Removed auto-optimized/max size notice */}
                </div>
            </div>
        </div>
      </div>

      {/* Documents Grid */}
    <div className="space-y-4">
        {/* ... (rest of the component structure, utilizing showToast for delete feedback where appropriate) ... */}
        <div ref={registryRef} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-4">
                <div className="font-mono text-xs text-dim uppercase tracking-widest">{t.fileRegistry} ({filteredDocuments.length})</div>
                {documents.length > 0 && (
                    <button onClick={selectAll} className="font-mono text-[10px] text-dim hover:text-text uppercase">
                        {selectedIds.length > 0 && selectedIds.length === filteredDocuments.length ? 'DESELECT ALL' : 'SELECT ALL'}
                    </button>
                )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0 no-scrollbar">
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
            <div className="text-dim font-mono text-[10px] md:text-xs text-center py-8 md:py-16 border-2 border-dashed border-dim bg-panel/30 rounded-xl md:rounded-3xl">
                {documents.length === 0 ? t.noData : "// NO DOCUMENTS MATCH FILTER"}
            </div> 
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map(doc => (
                    <div key={doc.id} className={`bg-surface border p-3 md:p-4 relative group transition-all duration-300 hover:bg-panel rounded-xl md:rounded-3xl ${selectedIds.includes(doc.id) ? 'border-acid shadow-lg' : 'border-border hover:border-dim'}`}>
                        <div className="absolute top-3 right-3 cursor-pointer z-10 p-2 -m-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); toggleSelection(doc.id); }}>
                            {selectedIds.includes(doc.id) ? <CheckSquare size={18} className="text-acid" /> : <Square size={18} className="text-dim hover:text-text transition-colors" />}
                        </div>
                        
                        <div className="flex flex-col gap-4 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                            <div className="w-full aspect-[3/2] bg-panel border border-border text-dim flex items-center justify-center relative overflow-hidden shrink-0 rounded-xl">
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
                            {((doc.type || '').toLowerCase().includes('flight') || (doc.type || '').toLowerCase().includes('airbnb')) ? (
                                                            <button onClick={(e) => { e.stopPropagation(); handleReextract(doc); }} className="flex-1 py-2 border border-border bg-surface text-[10px] font-mono text-dim hover:text-acid hover:border-acid transition-colors uppercase flex items-center justify-center gap-2 rounded-full">
                                                                Reintentar extracción
                                                            </button>
                                                        ) : null}
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-sm border border-border p-3 md:p-8 shadow-2xl rounded-xl md:rounded-3xl">
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
            <div className="bg-surface w-full max-w-sm border border-border p-4 md:p-8 shadow-2xl rounded-2xl md:rounded-3xl">
                {groupModal.type === 'delete' ? (
                    <>
                        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 text-danger">
                            <AlertTriangle size={18} className="md:hidden" />
                            <AlertTriangle size={24} className="hidden md:block" />
                            <h3 className="font-display text-sm md:text-lg uppercase">{t.deleteGroup}</h3>
                        </div>
                        <p className="text-[11px] md:text-sm text-dim font-mono mb-4 md:mb-6 leading-relaxed">
                            {t.confirmDeleteGroupMsg}
                        </p>
                        <div className="flex justify-end gap-2 md:gap-3">
                            <button onClick={() => setGroupModal(null)} className="px-3 md:px-4 py-1.5 md:py-2 border border-border text-dim hover:text-text text-[10px] md:text-xs uppercase rounded-lg md:rounded-xl">{t.cancel}</button>
                            <button onClick={handleDeleteGroup} className="px-3 md:px-4 py-1.5 md:py-2 bg-danger text-white hover:bg-red-600 text-[10px] md:text-xs font-bold uppercase rounded-lg md:rounded-xl">{t.purge}</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4 md:mb-6 pb-2 border-b border-border">
                            <h3 className="font-display text-sm md:text-lg text-text uppercase">{groupModal.type === 'add' ? t.createGroup : t.renameGroup}</h3>
                            <button onClick={() => setGroupModal(null)} className="text-dim hover:text-text">
                                <X size={16} className="md:hidden" />
                                <X size={20} className="hidden md:block" />
                            </button>
                        </div>
                        <div className="mb-4 md:mb-6">
                            <label className="font-mono text-[9px] md:text-[10px] text-dim uppercase tracking-widest mb-1.5 md:mb-2 block">{t.groupName}</label>
                            <input 
                                type="text" 
                                value={groupNameInput}
                                onChange={e => setGroupNameInput(e.target.value)}
                                className="w-full bg-panel border border-border p-2 md:p-3 text-[11px] md:text-sm text-text font-mono focus:border-acid outline-none transition-colors rounded-lg md:rounded-xl"
                                placeholder="CATEGORY NAME..."
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2 md:gap-3">
                            <button onClick={() => setGroupModal(null)} className="px-3 md:px-4 py-1.5 md:py-2 border border-border text-dim hover:text-text text-[10px] md:text-xs uppercase rounded-lg md:rounded-xl">{t.cancel}</button>
                            <button 
                                onClick={groupModal.type === 'add' ? handleCreateGroup : handleRenameGroup} 
                                disabled={!groupNameInput.trim()}
                                className="px-3 md:px-4 py-1.5 md:py-2 bg-text text-obsidian hover:bg-acid font-bold text-[10px] md:text-xs uppercase disabled:opacity-50 rounded-lg md:rounded-xl"
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
              <div className="bg-surface w-full max-w-md border border-border p-4 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] rounded-2xl md:rounded-3xl">
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
