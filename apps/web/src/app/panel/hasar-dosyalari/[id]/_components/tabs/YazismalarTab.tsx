'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '../claim-detail-utils';

// ─── Tab: Yazışmalar ──────────────────────────────────────────────────────────
interface ChatMessage {
  timestamp: string;
  sender: string;
  message: string;
  mediaRef?: boolean;
}

interface ChatArchive {
  id: string;
  label: string;
  uploadedAt: string;
  messageCount: number;
  uploadedBy: { id: string; firstName: string; lastName: string };
}

interface ChatArchiveDetail extends Omit<ChatArchive, 'messageCount'> {
  messageCount: number;
  parsedMessages: ChatMessage[];
  rawContent: string;
}

export function ChatBubble({ msg, isSelf }: { msg: ChatMessage; isSelf: boolean }) {
  const time = new Date(msg.timestamp).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  return (
    <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`max-w-[70%] rounded-2xl px-3 py-2 shadow-sm ${isSelf ? 'bg-green-100 rounded-tr-sm' : 'bg-white rounded-tl-sm border border-slate-100'}`}>
        {!isSelf && (
          <p className="text-xs font-bold text-green-700 mb-0.5">{msg.sender}</p>
        )}
        {msg.mediaRef ? (
          <p className="text-xs text-slate-400 italic flex items-center gap-1">
            <span>📎</span> Medya dosyası
          </p>
        ) : (
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.message}</p>
        )}
        <p className="text-[10px] text-slate-400 mt-0.5 text-right">{time}</p>
      </div>
    </div>
  );
}

export function YazismalarTab({ claimId }: { claimId: string }) {
  const [archives, setArchives] = useState<ChatArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArchive, setSelectedArchive] = useState<ChatArchiveDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selfSender, setSelfSender] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/chat-archives?claimFileId=${claimId}`, { headers: authHeader() })
      .then((r) => setArchives(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [claimId]);

  useEffect(() => { load(); }, [load]);

  const handleOpenArchive = async (id: string) => {
    setLoadingDetail(true);
    try {
      const r = await axios.get(`${API}/chat-archives/${id}`, { headers: authHeader() });
      const detail: ChatArchiveDetail = r.data.data;
      setSelectedArchive(detail);
      // Auto-detect self sender from first message
      if (detail.parsedMessages?.length > 0) {
        setSelfSender(detail.parsedMessages[0].sender);
      }
    } catch (e) { console.error(e); }
    finally { setLoadingDetail(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu yazışmayı silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/chat-archives/${id}`, { headers: authHeader() });
      if (selectedArchive?.id === id) setSelectedArchive(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Silinemedi'); }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadLabel.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('claimFileId', claimId);
      formData.append('label', uploadLabel.trim());
      await axios.post(`${API}/chat-archives/upload`, formData, {
        headers: { ...authHeader(), 'Content-Type': 'multipart/form-data' },
      });
      setShowUploadModal(false);
      setUploadLabel('');
      setUploadFile(null);
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Yükleme başarısız'); }
    finally { setUploading(false); }
  };

  if (loading) return <div className="text-slate-400 py-8 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Yazışmalar</h3>
        <button type="button"
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          + Yazışma Yükle
        </button>
      </div>

      {/* Archive list */}
      {archives.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
          Henüz Yazışma Yüklenmemiş
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {archives.map((a) => (
            <div
              key={a.id}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:border-green-300 hover:shadow-sm ${selectedArchive?.id === a.id ? 'border-green-400 ring-2 ring-green-100' : 'border-slate-100'}`}
              onClick={() => handleOpenArchive(a.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">💬</span>
                    <p className="font-medium text-slate-800 text-sm truncate">{a.label}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {a.messageCount} mesaj · {new Date(a.uploadedAt).toLocaleDateString('tr-TR')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Yükleyen: {a.uploadedBy.firstName} {a.uploadedBy.lastName}
                  </p>
                </div>
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                  className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-0.5"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message viewer */}
      {loadingDetail && (
        <div className="text-slate-400 py-4 text-center text-sm">Mesajlar yükleniyor...</div>
      )}
      {selectedArchive && !loadingDetail && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{selectedArchive.label}</p>
              <p className="text-xs text-slate-400">{selectedArchive.messageCount} mesaj</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500">Benim Mesajlarım (Sağ):</label>
                <select
                  className="text-xs border border-slate-200 rounded px-2 py-1"
                  value={selfSender}
                  onChange={(e) => setSelfSender(e.target.value)}
                >
                  {Array.from(new Set(selectedArchive.parsedMessages.map((m) => m.sender))).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={() => setSelectedArchive(null)} className="text-xs text-slate-400 hover:text-slate-600">Kapat ×</button>
            </div>
          </div>
          <div className="p-4 max-h-[500px] overflow-y-auto space-y-0.5">
            {selectedArchive.parsedMessages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} isSelf={msg.sender === selfSender} />
            ))}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-slate-800 mb-4">Yazışma Yükle</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Etiket *</label>
                <input
                  type="text"
                  placeholder="Müşteri ile Yazışma"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">WhatsApp .txt Dosyası *</label>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${dragOver ? 'border-green-400 bg-green-50' : 'border-slate-200 hover:border-green-300'}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f && f.name.endsWith('.txt')) setUploadFile(f);
                  }}
                  onClick={() => document.getElementById('chat-file-input')?.click()}
                >
                  {uploadFile ? (
                    <div>
                      <p className="text-sm font-medium text-green-700">{uploadFile.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-500">Dosyayı Buraya Sürükleyin veya Tıklayın</p>
                      <p className="text-xs text-slate-400 mt-1">Yalnızca .txt Dosyası</p>
                    </div>
                  )}
                </div>
                <input
                  id="chat-file-input"
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button"
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadLabel.trim()}
                className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-40"
              >
                {uploading ? 'Yükleniyor...' : 'Yükle'}
              </button>
              <button type="button"
                onClick={() => { setShowUploadModal(false); setUploadLabel(''); setUploadFile(null); }}
                className="flex-1 border border-slate-200 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
