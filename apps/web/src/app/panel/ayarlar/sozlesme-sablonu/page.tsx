'use client';

import { useEffect, useState, useCallback } from 'react';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { DeleteConfirmDialog } from '@/components/settings/SettingsModal';

const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://app.meridyen-tr.com/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}
function authHeader() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

interface Clause {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
  isRequired: boolean;
}

const PLACEHOLDER_HELP = [
  { key: '{{sozlesme_no}}', desc: 'Sözleşme numarası' },
  { key: '{{sozlesme_tarihi}}', desc: 'Sözleşme tarihi' },
  { key: '{{baslangic_tarihi}}', desc: 'İşe başlangıç tarihi' },
  { key: '{{teslim_tarihi}}', desc: 'Teslim tarihi' },
  { key: '{{imza_sure_gun}}', desc: 'İmza süresi (gün)' },
  { key: '{{dosya_no}}', desc: 'Hasar dosya numarası' },
  { key: '{{sigorta_sirketi}}', desc: 'Sigorta şirketi adı' },
  { key: '{{hasar_adresi}}', desc: 'Hasar adresi' },
  { key: '{{sigorta_musteri_ad}}', desc: 'Sigortalı adı' },
  { key: '{{tedarikci_ad}}', desc: 'Tedarikçi adı' },
  { key: '{{tedarikci_vergi_no}}', desc: 'Vergi / TC No' },
  { key: '{{tedarikci_adres}}', desc: 'Tedarikçi adresi' },
  { key: '{{tedarikci_telefon}}', desc: 'Tedarikçi telefonu' },
  { key: '{{is_kalemleri}}', desc: 'İş kalemleri tablosu (HTML)' },
  { key: '{{toplam_tutar}}', desc: 'Toplam tutar' },
];

export default function SozlesmeSablonuPage() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', isRequired: true });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', content: '', isRequired: true });
  const [adding, setAdding] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadClauses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/vendor-contracts/template/clauses`, { headers: authHeader() });
      const json = await res.json();
      setClauses(json.data ?? []);
    } catch (e) {
      setError('Maddeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClauses(); }, [loadClauses]);

  const startEdit = (clause: Clause) => {
    setEditingId(clause.id);
    setEditForm({ title: clause.title, content: clause.content, isRequired: clause.isRequired });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    try {
      await fetch(`${API}/vendor-contracts/template/clauses/${id}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      await loadClauses();
    } catch {
      setError('Kayıt sırasında hata oluştu');
    } finally {
      setSavingId(null);
    }
  };

  const deleteClause = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDeleteClause = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget);
    try {
      await fetch(`${API}/vendor-contracts/template/clauses/${deleteTarget}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      await loadClauses();
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  const addClause = async () => {
    if (!addForm.title || !addForm.content) { setError('Başlık ve içerik zorunludur'); return; }
    setAdding(true);
    setError('');
    try {
      await fetch(`${API}/vendor-contracts/template/clauses`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(addForm),
      });
      setShowAdd(false);
      setAddForm({ title: '', content: '', isRequired: true });
      await loadClauses();
    } catch {
      setError('Madde eklenemedi');
    } finally {
      setAdding(false);
    }
  };

  // Drag & drop reorder
  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const newOrder = [...clauses];
    const fromIdx = newOrder.findIndex((c) => c.id === draggingId);
    const toIdx = newOrder.findIndex((c) => c.id === targetId);
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setClauses(newOrder);
    setDraggingId(null);
    setDragOverId(null);
    // persist
    await fetch(`${API}/vendor-contracts/template/clauses/reorder`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ ids: newOrder.map((c) => c.id) }),
    });
  };

  const buildPreview = () => {
    const rendered = clauses
      .map((c, i) => `<div style="margin-bottom:16px">
        <h3 style="font-size:14px;font-weight:bold;color:#1a4080;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:0 0 6px">
          MADDE ${i + 1}: ${c.title}
        </h3>
        <div style="font-size:12px;line-height:1.6;color:#374151">${c.content}</div>
      </div>`)
      .join('');
    setPreviewHtml(`<div style="font-family:Arial,sans-serif;padding:24px;max-width:700px;margin:0 auto">${rendered}</div>`);
    setShowPreview(true);
  };

  const insertPlaceholder = (ph: string, target: 'edit' | 'add') => {
    if (target === 'edit') {
      setEditForm((f) => ({ ...f, content: f.content + ph }));
    } else {
      setAddForm((f) => ({ ...f, content: f.content + ph }));
    }
  };

  return (
    <SettingsPageLayout
      title="Tedarikçi Sözleşme Şablonu"
      description="Sözleşme maddelerini düzenleyin, sıralayın veya ekleyin."
      addButtonText="Madde Ekle"
      onAdd={() => setShowAdd(true)}
      headerExtra={
        <button type="button" onClick={buildPreview} disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          Önizle
        </button>
      }
    >
      <div className="space-y-6 pb-10">
      {/* Header content note */}
      <p className="text-sm text-slate-500">
        Değişkenler için{' '}
        <button type="button" onClick={() => setShowPlaceholders(!showPlaceholders)} className="text-indigo-600 hover:underline">
          değişken listesine
        </button>{' '}
        bakın.
      </p>

      {/* Placeholder help */}
      {showPlaceholders && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-2">Kullanılabilir Değişkenler (içeriğe kopyalayıp yapıştırın)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PLACEHOLDER_HELP.map((p) => (
              <div key={p.key} className="flex items-center gap-2">
                <code className="text-xs bg-white border border-amber-200 rounded px-1.5 py-0.5 font-mono text-amber-900 select-all">{p.key}</code>
                <span className="text-xs text-amber-700">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}
          <button type="button" onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Clauses list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {clauses.map((clause, idx) => (
            <div
              key={clause.id}
              draggable
              onDragStart={() => handleDragStart(clause.id)}
              onDragOver={(e) => handleDragOver(e, clause.id)}
              onDrop={(e) => handleDrop(e, clause.id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
              className={`bg-white border rounded-xl transition-all ${
                dragOverId === clause.id ? 'border-indigo-400 shadow-md' : 'border-slate-200'
              } ${draggingId === clause.id ? 'opacity-40' : ''}`}
            >
              {editingId === clause.id ? (
                <div className="p-4 space-y-3">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Madde başlığı"
                  />
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    rows={6}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="HTML içerik ({{degisken}} kullanabilirsiniz)"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">Hızlı ekle:</span>
                    {PLACEHOLDER_HELP.slice(0, 6).map((p) => (
                      <button key={p.key} type="button" onClick={() => insertPlaceholder(p.key, 'edit')}
                        className="text-xs bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 px-2 py-0.5 rounded font-mono transition-colors">
                        {p.key}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">İptal</button>
                    <button type="button" onClick={() => saveEdit(clause.id)} disabled={savingId === clause.id}
                      className="px-4 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
                      {savingId === clause.id ? 'Kaydediliyor…' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* Drag handle */}
                  <div className="flex-shrink-0 mt-1 cursor-grab text-slate-300 hover:text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{clause.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2" dangerouslySetInnerHTML={{ __html: clause.content.replace(/<[^>]+>/g, ' ').slice(0, 150) + '…' }} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onClick={() => startEdit(clause)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button type="button" onClick={() => deleteClause(clause.id)} disabled={deletingId === clause.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Clause Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">Yeni Madde Ekle</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Başlık <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <input type="text" value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Madde başlığı" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">İçerik (HTML) <span className='text-xs font-normal text-slate-400 ml-1'>(Zorunlu)</span></label>
                <textarea
                  value={addForm.content}
                  onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
                  rows={7}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="<p>Madde içeriği… {{degisken}} kullanabilirsiniz</p>"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">Hızlı ekle:</span>
                {PLACEHOLDER_HELP.slice(0, 6).map((p) => (
                  <button key={p.key} type="button" onClick={() => insertPlaceholder(p.key, 'add')}
                    className="text-xs bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 px-2 py-0.5 rounded font-mono transition-colors">
                    {p.key}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50">İptal</button>
                <button type="button" onClick={addClause} disabled={adding}
                  className="flex-1 px-4 py-2.5 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium">
                  {adding ? 'Ekleniyor…' : 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800">Sözleşme Önizleme</h3>
              <button type="button" onClick={() => setShowPreview(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteClause}
        deleting={deletingId !== null}
        title="Maddeyi Sil"
        description="Bu maddeyi silmek istediğinize emin misiniz?"
      />
      </div>
    </SettingsPageLayout>
  );
}
