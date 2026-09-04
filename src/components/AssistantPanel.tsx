import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import type {
  AssistantMessage,
  AssistantFileAttachment,
  AssistantPreparationResult,
  AssistantTargetMode,
  NormalizedPointRecord,
  NormalizedDistanceRecord,
} from '../assistant/types';
import {
  validateNormalizedPoints,
  validateNormalizedDistanceSites,
  buildPreparationSummary,
} from '../assistant/deterministicValidation';
import { exportAssistantNormalizedExcel } from '../assistant/exportNormalizedExcel';

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  currentMode: 'route' | 'distance' | null;
  onOpenReviewModal: (result: AssistantPreparationResult) => void;
  onUseInRouteMeasure: (result: AssistantPreparationResult) => void;
  onOpenManualReview?: () => void;
}

const INITIAL_QUICK_ACTIONS = [
  'Prepare a file',
  'Paste raw data',
  'Help format coordinates',
  'Explain RouteMeasure',
];

export function AssistantPanel({
  isOpen,
  onClose,
  onMinimize,
  currentMode,
  onOpenReviewModal,
  onUseInRouteMeasure,
  onOpenManualReview,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: "Hi! I'm RouteMeasure Assistant.\n\nI can help prepare coordinate data, analyze files, and structure information for RouteMeasure.\n\nWhat would you like to do?",
      timestamp: Date.now(),
      quickActions: INITIAL_QUICK_ACTIONS,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [selectedFile, setSelectedFile] = useState<AssistantFileAttachment | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  if (!isOpen) return null;

  // Quick Action Handler
  const handleQuickAction = (action: string) => {
    if (action === 'Prepare a file') {
      fileInputRef.current?.click();
    } else if (action === 'Paste raw data') {
      setInputVal('LV1 -2.58930 31.31071\nLV2 -2.58885 31.31081\nMV1 -2.58841 31.31091');
    } else if (action === 'Help format coordinates') {
      sendChatMessage('What coordinate format does RouteMeasure accept?');
    } else if (action === 'Explain RouteMeasure') {
      sendChatMessage('Explain RouteMeasure modes and calculations.');
    }
  };

  // Send product Q&A chat
  const sendChatMessage = async (text: string) => {
    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed');
      }

      const botMsg: AssistantMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || 'Here is what I found.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: AssistantMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text: err?.message || 'RouteMeasure Assistant chat is currently unavailable.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // File Select Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input value
    e.target.value = '';

    const maxBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxBytes) {
      alert('File size exceeds 10MB limit. Please upload a smaller file.');
      return;
    }

    const attachment: AssistantFileAttachment = {
      name: file.name,
      size: file.size,
      type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
    };

    const ext = attachment.type;

    if (ext === 'pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Str = (reader.result as string).split(',')[1];
        attachment.dataBase64 = base64Str;
        setSelectedFile(attachment);
      };
      reader.readAsDataURL(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      let extractedText = '';
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(ws);
        extractedText += `--- WORKSHEET: ${sheetName} ---\n${csv}\n\n`;
      }
      attachment.textContent = extractedText;
      setSelectedFile(attachment);
    } else {
      // txt, csv, etc.
      const text = await file.text();
      attachment.textContent = text;
      setSelectedFile(attachment);
    }
  };

  // Submit Handler (File or Paste)
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputVal.trim();
    const fileToSend = selectedFile;

    if (!textToSend && !fileToSend) return;

    executeAnalysis(textToSend, fileToSend);
  };

  const executeAnalysis = async (text: string, file: AssistantFileAttachment | null) => {
    // Push user message
    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text || `Uploaded ${file?.name}`,
      attachment: file || undefined,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setSelectedFile(null);
    setIsProcessing(true);

    const targetMode: AssistantTargetMode =
      currentMode === 'distance' ? 'point_to_point' : 'lv_mv';

    try {
      const payload: any = {
        targetMode,
        sourceType: file ? file.type : 'paste',
        sourceFile: file ? file.name : 'Pasted Text',
      };

      if (file?.dataBase64) {
        payload.fileBase64 = file.dataBase64;
        payload.mimeType = 'application/pdf';
      } else if (file?.textContent) {
        payload.text = file.textContent;
      } else if (text) {
        payload.text = text;
      }

      const res = await fetch('/api/assistant/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rawData = await res.json();
      if (!res.ok) {
        throw new Error(rawData.error || 'Failed to prepare data');
      }

      // Run Client-Side Deterministic Validation
      const rawPoints: Partial<NormalizedPointRecord>[] = rawData.points || [];
      const rawSites: Partial<NormalizedDistanceRecord>[] = rawData.sites || [];

      const validatedPoints = validateNormalizedPoints(rawPoints);
      const validatedSites = validateNormalizedDistanceSites(rawSites);

      const summary = buildPreparationSummary(
        targetMode,
        validatedPoints,
        validatedSites,
        rawData.confidence
      );

      const botMsg: AssistantMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: `Data prepared successfully from ${payload.sourceFile}.`,
        resultSummary: summary,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: AssistantMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text:
          err?.message ||
          "RouteMeasure Assistant couldn't identify valid coordinates in this input.",
        timestamp: Date.now(),
        error: err?.message,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <aside className="rm-assistant-panel" aria-label="RouteMeasure Assistant Panel">
      {/* Panel Header */}
      <div className="rm-assistant-header">
        <div className="rm-assistant-header-titles">
          <div className="rm-assistant-title-row">
            <span className="rm-assistant-sparkle">✦</span>
            <h3 className="rm-assistant-title">RouteMeasure Assistant</h3>
          </div>
          <p className="rm-assistant-subtitle">Prepare data, analyze files and get help</p>
        </div>
        <div className="rm-assistant-header-controls">
          <button
            type="button"
            className="rm-assistant-control-btn"
            onClick={onMinimize}
            aria-label="Minimize Assistant"
            title="Minimize Assistant"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="rm-assistant-control-btn"
            onClick={onClose}
            aria-label="Close Assistant"
            title="Close Assistant"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Conversation Area */}
      <div className="rm-assistant-body" role="log" aria-live="polite">
        {messages.map((msg) => (
          <div key={msg.id} className={`rm-chat-bubble-row ${msg.sender === 'user' ? 'user-row' : 'bot-row'}`}>
            <div className={`rm-chat-bubble ${msg.sender === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
              {/* Message text */}
              <div className="rm-chat-text" style={{ whiteSpace: 'pre-wrap' }}>
                {msg.text}
              </div>

              {/* Attachment card */}
              {msg.attachment && (
                <div className="rm-attachment-pill">
                  <span className="rm-attachment-icon">📎</span>
                  <span className="rm-attachment-name">{msg.attachment.name}</span>
                  <span className="rm-attachment-size">({(msg.attachment.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}

              {/* Result Summary Card */}
              {msg.resultSummary && (
                <div className="rm-summary-card">
                  <div className="rm-summary-card-header">
                    <span className="rm-summary-title">
                      {msg.resultSummary.overallStatus === 'valid'
                        ? '✓ Ready for RouteMeasure'
                        : '⚠ Review Recommended'}
                    </span>
                    <span className="rm-summary-count">{msg.resultSummary.totalCount} Points</span>
                  </div>

                  <div className="rm-summary-stats-grid">
                    <div className="rm-stat-box">
                      <span className="rm-stat-num text-green">{msg.resultSummary.validCount}</span>
                      <span className="rm-stat-lbl">Ready</span>
                    </div>
                    {msg.resultSummary.needsReviewCount > 0 && (
                      <div className="rm-stat-box">
                        <span className="rm-stat-num text-amber">{msg.resultSummary.needsReviewCount}</span>
                        <span className="rm-stat-lbl">Review</span>
                      </div>
                    )}
                    {msg.resultSummary.invalidCount > 0 && (
                      <div className="rm-stat-box">
                        <span className="rm-stat-num text-red">{msg.resultSummary.invalidCount}</span>
                        <span className="rm-stat-lbl">Invalid</span>
                      </div>
                    )}
                    {msg.resultSummary.mode === 'lv_mv' && (
                      <>
                        <div className="rm-stat-box">
                          <span className="rm-stat-num">{msg.resultSummary.lvCount}</span>
                          <span className="rm-stat-lbl">LV</span>
                        </div>
                        <div className="rm-stat-box">
                          <span className="rm-stat-num">{msg.resultSummary.mvCount}</span>
                          <span className="rm-stat-lbl">MV</span>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="rm-summary-message">{msg.resultSummary.summaryMessage}</p>

                  {/* Three Required Primary Actions */}
                  <div className="rm-summary-actions">
                    <button
                      type="button"
                      className="rm-btn-summary-action primary"
                      onClick={() => onOpenReviewModal(msg.resultSummary!)}
                    >
                      Review Data
                    </button>
                    <button
                      type="button"
                      className="rm-btn-summary-action success"
                      disabled={msg.resultSummary.invalidCount > 0}
                      onClick={() => onUseInRouteMeasure(msg.resultSummary!)}
                      title={msg.resultSummary.invalidCount > 0 ? 'Correct invalid rows before measurement' : 'Send to RouteMeasure'}
                    >
                      Use in RouteMeasure →
                    </button>
                    <button
                      type="button"
                      className="rm-btn-summary-action secondary"
                      onClick={() =>
                        exportAssistantNormalizedExcel(
                          msg.resultSummary!.mode,
                          msg.resultSummary!.points,
                          msg.resultSummary!.sites
                        )
                      }
                    >
                      Download Excel
                    </button>
                  </div>
                </div>
              )}

              {/* Error fallback options */}
              {msg.error && (
                <div className="rm-error-actions">
                  {onOpenManualReview && (
                    <button
                      type="button"
                      className="rm-btn-error-opt"
                      onClick={onOpenManualReview}
                    >
                      Review Columns Manually
                    </button>
                  )}
                  <button
                    type="button"
                    className="rm-btn-error-opt"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Try Another File
                  </button>
                </div>
              )}

              {/* Quick Actions Chips */}
              {msg.quickActions && msg.quickActions.length > 0 && (
                <div className="rm-quick-actions-chips">
                  {msg.quickActions.map((qa) => (
                    <button
                      key={qa}
                      type="button"
                      className="rm-qa-chip"
                      onClick={() => handleQuickAction(qa)}
                    >
                      {qa}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="rm-chat-bubble-row bot-row">
            <div className="rm-chat-bubble bot-bubble rm-loading-bubble">
              <div className="rm-spinner-small" />
              <span>Got it — I'm preparing your data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Badge above footer */}
      {selectedFile && (
        <div className="rm-selected-file-banner">
          <div className="rm-banner-info">
            <span className="rm-file-icon">📄</span>
            <span className="rm-file-name">{selectedFile.name}</span>
            <span className="rm-file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          </div>
          <button
            type="button"
            className="rm-banner-remove"
            onClick={() => setSelectedFile(null)}
            aria-label="Remove attached file"
          >
            ✕
          </button>
        </div>
      )}

      {/* Footer Input Area */}
      <form className="rm-assistant-footer" onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".xlsx,.xls,.csv,.pdf,.docx,.txt"
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="rm-btn-attach"
          onClick={() => fileInputRef.current?.click()}
          title="Attach spreadsheet, PDF, Word or text file"
          aria-label="Attach file"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          type="text"
          className="rm-assistant-input"
          placeholder={selectedFile ? 'Add any notes or press send...' : 'Paste coordinates or ask a question...'}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          disabled={isProcessing}
        />

        <button
          type="submit"
          className="rm-btn-send"
          disabled={isProcessing || (!inputVal.trim() && !selectedFile)}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </form>
    </aside>
  );
}
