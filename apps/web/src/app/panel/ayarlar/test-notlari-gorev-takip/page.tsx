'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { API, getToken } from '@/utils/api';
import { DanismanFormatiTab } from './_components/DanismanFormatiTab';
import { ExcelRaporTab } from './_components/ExcelRaporTab';
import { IslerKararlarTab } from './_components/IslerKararlarTab';
import { TestNotlariTab } from './_components/TestNotlariTab';
import { TestNotuForm } from './_components/TestNotuForm';
import { WorkItemForm } from './_components/WorkItemForm';
import {
  createTestNote,
  createWorkItem,
  deleteTestNote,
  deleteWorkItem,
  downloadBlob,
  fetchTestNotes,
  fetchUsers,
  fetchWorkItems,
  generateConsultantFormat,
  TestNote,
  TestNoteFormat,
  updateTestNote,
  updateWorkItem,
  UserSummary,
  WorkItem,
} from './_lib/api';

type TabId = 'test-notlari' | 'isler-kararlar' | 'danisman-formati' | 'excel-rapor';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'test-notlari', label: 'Test Notları' },
  { id: 'isler-kararlar', label: 'İşler / Kararlar' },
  { id: 'danisman-formati', label: 'Danışman Formatı' },
  { id: 'excel-rapor', label: 'Excel Rapor' },
];

import { canAccessTestNotesFromStorage } from '@/utils/test-notes-access';

export default function TestNotlariGorevTakipPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('test-notlari');
  const [testNotes, setTestNotes] = useState<TestNote[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedNote, setSelectedNote] = useState<TestNote | null>(null);
  const [format, setFormat] = useState<TestNoteFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editingNote, setEditingNote] = useState<TestNote | null>(null);
  const [editingWorkItem, setEditingWorkItem] = useState<WorkItem | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showWorkForm, setShowWorkForm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      router.push('/giris');
      return;
    }
    if (!canAccessTestNotesFromStorage()) {
      router.push('/panel');
      return;
    }
    setLoading(true);
    Promise.all([
      fetchTestNotes({ page: 1, limit: 100, isArchived: false }),
      fetchWorkItems({ page: 1, limit: 100 }),
      fetchUsers().catch(() => [] as UserSummary[]),
    ])
      .then(([notesRes, workRes, usersRes]) => {
        setTestNotes(notesRes.data ?? []);
        setWorkItems(workRes.data ?? []);
        setUsers(usersRes);
        if ((notesRes.data ?? []).length > 0 && !selectedNote) {
          setSelectedNote(notesRes.data[0]);
          setFormat(notesRes.data[0].format ?? null);
        }
      })
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push('/giris');
          return;
        }
        setError('Veriler yüklenemedi.');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(() => ({
    notes: testNotes.length,
    openWorks: workItems.filter((item) => item.durum !== 'TAMAMLANDI' && item.durum !== 'IPTAL').length,
    formats: testNotes.filter((item) => item.format).length,
  }), [testNotes, workItems]);

  const refreshAll = async () => {
    const [notesRes, workRes] = await Promise.all([fetchTestNotes({ page: 1, limit: 100, isArchived: false }), fetchWorkItems({ page: 1, limit: 100 })]);
    setTestNotes(notesRes.data ?? []);
    setWorkItems(workRes.data ?? []);
    if (selectedNote) {
      const next = (notesRes.data ?? []).find((item) => item.id === selectedNote.id) ?? null;
      setSelectedNote(next);
      setFormat(next?.format ?? null);
    }
  };

  const handleNoteSubmit = async (item: TestNote | null, payload: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    try {
      if (item) {
        await updateTestNote(item.id, payload);
      } else {
        await createTestNote(payload);
      }
      setShowNoteForm(false);
      setEditingNote(null);
      await refreshAll();
    } catch {
      setError('Test notu kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleWorkSubmit = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    try {
      if (editingWorkItem) {
        await updateWorkItem(editingWorkItem.id, payload);
      } else {
        await createWorkItem(payload);
      }
      setShowWorkForm(false);
      setEditingWorkItem(null);
      await refreshAll();
    } catch {
      setError('İş kaydı kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFormat = async () => {
    if (!selectedNote) return;
    setSaving(true);
    setError('');
    try {
      const response = await generateConsultantFormat(selectedNote.id);
      setFormat(response.data);
      await refreshAll();
      setActiveTab('danisman-formati');
    } catch {
      setError('Danışman formatı üretilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (item: TestNote) => {
    if (!window.confirm(`${item.testNo} kaydını silmek istiyor musunuz?`)) return;
    try {
      await deleteTestNote(item.id);
      await refreshAll();
    } catch {
      setError('Test notu silinemedi.');
    }
  };

  const handleDeleteWorkItem = async (item: WorkItem) => {
    if (!window.confirm(`#${item.siraNo} iş kaydını silmek istiyor musunuz?`)) return;
    try {
      await deleteWorkItem(item.id);
      await refreshAll();
    } catch {
      setError('İş kaydı silinemedi.');
    }
  };

  const downloadAll = async () => {
    setDownloading(true);
    try {
      await downloadBlob(`${API}/test-notes/export/excel`, {}, `test-notlari-ve-gorevler-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setDownloading(false);
    }
  };

  const downloadWorkExcel = async () => {
    setDownloading(true);
    try {
      await downloadBlob(`${API}/work-items/export/excel`, {}, `gecici-is-gorev-takip-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return <div className="px-3 py-4 text-sm text-slate-500 sm:p-6">Yükleniyor...</div>;
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden px-3 py-4 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <a href="/panel/ayarlar" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-700">← Ayarlar</a>
          <p className="text-xs font-semibold tracking-[0.2em] text-blue-600">Admin-only / Geçici Modül</p>
          <h1 className="mt-1 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">Test Notları ve Geçici İş/Görev Takip</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Kalıcı görev-haberleşme modülü devreye girene kadar kullanılacak geçici yönetim ekranı.</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4">
            <p className="text-[10px] text-slate-400 sm:text-xs">Test Notları</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{summary.notes}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4">
            <p className="text-[10px] text-slate-400 sm:text-xs">Açık İşler</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{summary.openWorks}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4">
            <p className="text-[10px] text-slate-400 sm:text-xs">Üretilen Format</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{summary.formats}</p>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:rounded-2xl">{error}</div> : null}

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-3 py-2.5 text-xs font-semibold sm:px-4 sm:py-2 sm:text-sm ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'test-notlari' ? (
        <div className="min-w-0 space-y-4">
          <button
            type="button"
            onClick={() => { setEditingNote(null); setShowNoteForm((value) => !value); }}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white sm:ml-auto sm:block sm:w-auto"
          >
            {showNoteForm ? 'Formu Kapat' : 'Yeni Test Notu'}
          </button>
          {showNoteForm ? (
            <TestNotuForm
              initial={editingNote}
              onCancel={() => { setShowNoteForm(false); setEditingNote(null); }}
              onSubmit={(payload) => handleNoteSubmit(editingNote, payload)}
              saving={saving}
            />
          ) : null}
          <TestNotlariTab
            items={testNotes}
            selectedId={selectedNote?.id}
            onSelect={(item) => { setSelectedNote(item); setFormat(item.format ?? null); }}
            onEdit={async (item, payload) => {
              await handleNoteSubmit(item, payload);
            }}
            onDelete={handleDeleteNote}
            saving={saving}
          />
        </div>
      ) : null}

      {activeTab === 'isler-kararlar' ? (
        <div className="min-w-0 space-y-4">
          <button
            type="button"
            onClick={() => { setEditingWorkItem(null); setShowWorkForm((value) => !value); }}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:ml-auto sm:block sm:w-auto"
          >
            {showWorkForm ? 'Formu Kapat' : 'Yeni İş / Karar'}
          </button>
          {showWorkForm ? (
            <WorkItemForm
              initial={editingWorkItem}
              users={users}
              onCancel={() => { setShowWorkForm(false); setEditingWorkItem(null); }}
              onSubmit={handleWorkSubmit}
              saving={saving}
            />
          ) : null}
          <IslerKararlarTab items={workItems} onEdit={(item) => { setEditingWorkItem(item); setShowWorkForm(true); }} onDelete={handleDeleteWorkItem} />
        </div>
      ) : null}

      {activeTab === 'danisman-formati' ? (
        <DanismanFormatiTab selected={selectedNote} format={format} onGenerate={handleGenerateFormat} loading={saving} />
      ) : null}

      {activeTab === 'excel-rapor' ? (
        <ExcelRaporTab onDownloadAll={downloadAll} onDownloadWorkItems={downloadWorkExcel} loading={downloading} />
      ) : null}
    </div>
  );
}
