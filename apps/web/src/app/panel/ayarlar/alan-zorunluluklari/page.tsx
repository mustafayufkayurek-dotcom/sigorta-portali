'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { API, authHeader } from '@/utils/api';

const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'repair_single', label: 'Hasar Onarım — Tek Hasarlı' },
  { value: 'repair_multi', label: 'Hasar Onarım — Çok Hasarlı' },
  { value: 'emergency', label: 'Acil Yardım' },
];

const FORMAT_DEPT_MAP: Record<string, string> = {
  repair_single: 'repair',
  repair_multi: 'repair',
  emergency: 'emergency',
};

type Department = { id: string; code: string; name: string; color: string; reportFormat: string };
type FieldConfig = { id?: string; departmentId: string; reportFormat: string; fieldKey: string; fieldLabel: string; isRequired: boolean; isVisible: boolean; sortOrder: number };
type FieldRule = { required: boolean };
type FieldsConfig = Record<string, FieldRule>;

const LOCATION_FIELD_LABELS: Record<string, string> = {
  code: 'Kod',
  name: 'Ad',
  description: 'Açıklama',
  sortOrder: 'Sıra',
};

const WORK_GROUP_FIELD_LABELS: Record<string, string> = {
  code: 'Kod',
  name: 'Ad',
  description: 'Açıklama',
  unit: 'Varsayılan Birim',
  sortOrder: 'Sıra',
};

const WORK_SUB_GROUP_FIELD_LABELS: Record<string, string> = {
  code: 'Kod',
  name: 'Ad',
  description: 'Açıklama',
  unitType: 'Birim Tipi',
  unitPrice: 'Birim Fiyat',
  sortOrder: 'Sıra',
};

type TabKey = 'departments' | 'locations' | 'workGroups' | 'workSubGroups' | 'generalRequirements';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'generalRequirements', label: 'Genel Zorunluluklar' },
  { key: 'departments', label: 'Müşteri / Departman Alanları' },
  { key: 'locations', label: 'Mahaller Alanları' },
  { key: 'workGroups', label: 'İş Grupları Alanları' },
  { key: 'workSubGroups', label: 'İş Alt Grupları Alanları' },
];

function FieldsToggleSection({
  title,
  subtitle,
  fields,
  labels,
  loading,
  saving,
  saved,
  onToggle,
  onSave,
}: {
  title: string;
  subtitle: string;
  fields: FieldsConfig;
  labels: Record<string, string>;
  loading: boolean;
  saving: boolean;
  saved: boolean;
  onToggle: (key: string) => void;
  onSave: () => void;
}) {
  if (loading) return <div className="text-center py-10 text-slate-400">Yükleniyor...</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">

      <div className="px-5 py-4 border-b border-slate-50">
        <div>
          <p className="font-medium text-slate-800">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        <div className="px-5 py-2.5 bg-slate-50 grid grid-cols-12 gap-4">
          <div className="col-span-8 text-xs font-medium text-slate-500 uppercase">Alan Adı</div>
          <div className="col-span-4 text-xs font-medium text-slate-500 uppercase text-center">Zorunlu</div>
        </div>
        {Object.entries(fields).map(([key, rule]) => (
          <div key={key} className="px-5 py-3.5 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors">
            <div className="col-span-8">
              <p className="text-sm font-medium text-slate-800">{labels[key] ?? key}</p>
              <code className="text-xs text-slate-400">{key}</code>
            </div>
            <div className="col-span-4 flex justify-center">
              <button type="button"
                onClick={() => onToggle(key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${rule.required ? 'bg-blue-600' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.required ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
        <p className="text-xs text-slate-400">
          {Object.values(fields).filter((f) => f.required).length} zorunlu alan
        </p>
        <button type="button"
          onClick={onSave}
          disabled={saving}
          className={`text-sm px-5 py-2 rounded-lg disabled:opacity-50 transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </div>
  );
}

export default function AlanZorunluluklariPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('generalRequirements');

  // Departman sekmesi state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('repair_single');
  const [configs, setConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({ fieldKey: '', fieldLabel: '' });

  // Mahaller alanları state
  const [locationFields, setLocationFields] = useState<FieldsConfig>({});
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationSaved, setLocationSaved] = useState(false);

  // İş Grupları alanları state
  const [workGroupFields, setWorkGroupFields] = useState<FieldsConfig>({});
  const [workGroupLoading, setWorkGroupLoading] = useState(false);
  const [workGroupSaving, setWorkGroupSaving] = useState(false);
  const [workGroupSaved, setWorkGroupSaved] = useState(false);

  // İş Alt Grupları alanları state
  const [workSubGroupFields, setWorkSubGroupFields] = useState<FieldsConfig>({});
  const [workSubGroupLoading, setWorkSubGroupLoading] = useState(false);
  const [workSubGroupSaving, setWorkSubGroupSaving] = useState(false);
  const [workSubGroupSaved, setWorkSubGroupSaved] = useState(false);

  // Genel Zorunluluklar state
  type FieldRequirementsConfig = { customerSubTypeRequired: boolean };
  const [fieldRequirements, setFieldRequirements] = useState<FieldRequirementsConfig>({ customerSubTypeRequired: true });
  const [frLoading, setFrLoading] = useState(false);
  const [frSaving, setFrSaving] = useState(false);
  const [frSaved, setFrSaved] = useState(false);

  // Departmanları yükle
  useEffect(() => {
    axios.get(`${API}/departments`, { headers: authHeader() })
      .then((r) => {
        const depts = r.data.data ?? [];
        setDepartments(depts);
        if (depts.length > 0) setSelectedDept(depts[0]);
      })
      .catch(console.error);
  }, []);

  const availableFormats = selectedDept
    ? FORMAT_OPTIONS.filter((f) => FORMAT_DEPT_MAP[f.value] === selectedDept.reportFormat)
    : FORMAT_OPTIONS;

  // Fallback: dept.reportFormat tanımsızsa tüm formatları göster
  const displayFormats = availableFormats.length > 0 ? availableFormats : FORMAT_OPTIONS;

  useEffect(() => {
    if (selectedDept && displayFormats.length > 0) {
      setSelectedFormat(displayFormats[0].value);
    }
  }, [selectedDept]); // eslint-disable-line

  const fetchConfigs = useCallback(async (deptId: string, fmt: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/departments/${deptId}/field-configs?reportFormat=${fmt}`, { headers: authHeader() });
      setConfigs(res.data.data ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedDept && selectedFormat) fetchConfigs(selectedDept.id, selectedFormat);
  }, [selectedDept, selectedFormat, fetchConfigs]);

  // Mahaller alanlarını yükle
  useEffect(() => {
    if (activeTab !== 'locations') return;
    setLocationLoading(true);
    axios.get(`${API}/system-settings/location-fields`, { headers: authHeader() })
      .then((r) => setLocationFields(r.data.data ?? {}))
      .catch(console.error)
      .finally(() => setLocationLoading(false));
  }, [activeTab]);

  // İş Grupları alanlarını yükle
  useEffect(() => {
    if (activeTab !== 'workGroups') return;
    setWorkGroupLoading(true);
    axios.get(`${API}/system-settings/work-group-fields`, { headers: authHeader() })
      .then((r) => setWorkGroupFields(r.data.data ?? {}))
      .catch(console.error)
      .finally(() => setWorkGroupLoading(false));
  }, [activeTab]);

  // İş Alt Grupları alanlarını yükle
  useEffect(() => {
    if (activeTab !== 'workSubGroups') return;
    setWorkSubGroupLoading(true);
    axios.get(`${API}/system-settings/work-sub-group-fields`, { headers: authHeader() })
      .then((r) => setWorkSubGroupFields(r.data.data ?? {}))
      .catch(console.error)
      .finally(() => setWorkSubGroupLoading(false));
  }, [activeTab]);

  // Genel Zorunlulukları yükle
  useEffect(() => {
    if (activeTab !== 'generalRequirements') return;
    setFrLoading(true);
    axios.get(`${API}/system-settings/field-requirements`, { headers: authHeader() })
      .then((r) => setFieldRequirements(r.data.data ?? { customerSubTypeRequired: true }))
      .catch(console.error)
      .finally(() => setFrLoading(false));
  }, [activeTab]);

  const toggleRequired = (fieldKey: string) => {
    setConfigs((prev) => prev.map((c) => c.fieldKey === fieldKey ? { ...c, isRequired: !c.isRequired } : c));
  };

  const toggleVisible = (fieldKey: string) => {
    setConfigs((prev) => prev.map((c) => c.fieldKey === fieldKey ? { ...c, isVisible: !c.isVisible } : c));
  };

  const handleSave = async () => {
    if (!selectedDept) return;
    setSaving(true);
    setSaved(false);
    try {
      await axios.put(
        `${API}/departments/${selectedDept.id}/field-configs`,
        { configs: configs.map((c) => ({ ...c, reportFormat: selectedFormat })) },
        { headers: authHeader() },
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleAddField = () => {
    if (!newField.fieldKey || !newField.fieldLabel || !selectedDept) return;
    const newCfg: FieldConfig = {
      departmentId: selectedDept.id,
      reportFormat: selectedFormat,
      fieldKey: newField.fieldKey,
      fieldLabel: newField.fieldLabel,
      isRequired: false,
      isVisible: true,
      sortOrder: configs.length + 1,
    };
    setConfigs((prev) => [...prev, newCfg]);
    setNewField({ fieldKey: '', fieldLabel: '' });
    setShowAddField(false);
  };

  const handleSaveLocationFields = async () => {
    setLocationSaving(true);
    setLocationSaved(false);
    try {
      await axios.put(`${API}/system-settings/location-fields`, { fields: locationFields }, { headers: authHeader() });
      setLocationSaved(true);
      setTimeout(() => setLocationSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setLocationSaving(false); }
  };

  const handleSaveWorkGroupFields = async () => {
    setWorkGroupSaving(true);
    setWorkGroupSaved(false);
    try {
      await axios.put(`${API}/system-settings/work-group-fields`, { fields: workGroupFields }, { headers: authHeader() });
      setWorkGroupSaved(true);
      setTimeout(() => setWorkGroupSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setWorkGroupSaving(false); }
  };

  const handleSaveWorkSubGroupFields = async () => {
    setWorkSubGroupSaving(true);
    setWorkSubGroupSaved(false);
    try {
      await axios.put(`${API}/system-settings/work-sub-group-fields`, { fields: workSubGroupFields }, { headers: authHeader() });
      setWorkSubGroupSaved(true);
      setTimeout(() => setWorkSubGroupSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setWorkSubGroupSaving(false); }
  };

  const handleSaveFieldRequirements = async () => {
    setFrSaving(true);
    setFrSaved(false);
    try {
      await axios.patch(`${API}/system-settings/field-requirements`, fieldRequirements, { headers: authHeader() });
      setFrSaved(true);
      setTimeout(() => setFrSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setFrSaving(false); }
  };

  return (
    <SettingsPageLayout
      title="Alan Zorunlulukları"
      description="Tanımlama formlarındaki alanların zorunluluk durumlarını yönetin"
      backHref="/panel/ayarlar"
    >

      {/* Sekmeler */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map((tab) => (
          <button type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${activeTab === tab.key ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Departman / Müşteri Alanları (mevcut) */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-4 gap-5">
          <div className="col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase">Departman</p>
              </div>
              <div className="divide-y divide-slate-50">
                {departments.map((d) => (
                  <button type="button"
                    key={d.id}
                    onClick={() => setSelectedDept(d)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-2.5 transition-colors ${selectedDept?.id === d.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className={`text-sm ${selectedDept?.id === d.id ? 'font-medium text-blue-700' : 'text-slate-700'}`}>{d.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedDept && displayFormats.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-50 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Rapor Formatı</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {displayFormats.map((f) => (
                    <button type="button"
                      key={f.value}
                      onClick={() => setSelectedFormat(f.value)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${selectedFormat === f.value ? 'bg-blue-50 font-medium text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col-span-3">
            {!selectedDept ? (
              <div className="bg-white rounded-xl border border-slate-100 p-12 text-center text-slate-400">
                Sol taraftan bir departman seçin
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{selectedDept.name}</p>
                    <p className="text-xs text-slate-400">{FORMAT_OPTIONS.find((f) => f.value === selectedFormat)?.label}</p>
                  </div>
                  <button type="button" onClick={() => setShowAddField(!showAddField)} className="text-sm border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                    + Alan Ekle
                  </button>
                </div>

                {showAddField && (
                  <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
                    <input
                      className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                      placeholder="Alan anahtarı (örn: inspectorName)"
                      value={newField.fieldKey}
                      onChange={(e) => setNewField({ ...newField, fieldKey: e.target.value })}
                    />
                    <input
                      className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                      placeholder="Alan etiketi (örn: Denetçi Adı)"
                      value={newField.fieldLabel}
                      onChange={(e) => setNewField({ ...newField, fieldLabel: e.target.value })}
                    />
                    <button type="button" onClick={handleAddField} className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700">Ekle</button>
                    <button type="button" onClick={() => setShowAddField(false)} className="text-sm text-slate-500 hover:text-slate-700">İptal</button>
                  </div>
                )}

                {loading ? (
                  <div className="text-center py-10 text-slate-400">Yükleniyor...</div>
                ) : configs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">Bu format için alan yapılandırması bulunamadı.</div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    <div className="px-5 py-2.5 bg-slate-50 grid grid-cols-12 gap-4">
                      <div className="col-span-5 text-xs font-medium text-slate-500 uppercase">Alan</div>
                      <div className="col-span-3 text-xs font-medium text-slate-500 uppercase">Anahtar</div>
                      <div className="col-span-2 text-xs font-medium text-slate-500 uppercase text-center">Zorunlu</div>
                      <div className="col-span-2 text-xs font-medium text-slate-500 uppercase text-center">Görünür</div>
                    </div>
                    {configs.map((cfg) => (
                      <div key={cfg.fieldKey} className="px-5 py-3.5 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors">
                        <div className="col-span-5">
                          <p className="text-sm font-medium text-slate-800">{cfg.fieldLabel}</p>
                        </div>
                        <div className="col-span-3">
                          <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{cfg.fieldKey}</code>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button type="button"
                            onClick={() => toggleRequired(cfg.fieldKey)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${cfg.isRequired ? 'bg-blue-600' : 'bg-slate-200'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.isRequired ? 'translate-x-5' : ''}`} />
                          </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <button type="button"
                            onClick={() => toggleVisible(cfg.fieldKey)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${cfg.isVisible ? 'bg-green-500' : 'bg-slate-200'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.isVisible ? 'translate-x-5' : ''}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="sticky bottom-0 px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                  <p className="text-xs text-slate-400">{configs.filter((c) => c.isRequired).length} zorunlu, {configs.filter((c) => c.isVisible).length} görünür alan</p>
                  <button type="button"
                    onClick={handleSave}
                    disabled={saving || configs.length === 0}
                    className={`text-sm px-5 py-2 rounded-lg disabled:opacity-50 transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    {saving ? 'Kaydediliyor...' : saved ? 'Kaydedildi!' : 'Değişiklikleri Kaydet'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mahaller Alanları */}
      {activeTab === 'locations' && (
        <FieldsToggleSection
          title="Mahaller Alanları"
          subtitle="Mahal tanımlama formundaki alanların zorunluluk durumlarını ayarlayın"
          fields={locationFields}
          labels={LOCATION_FIELD_LABELS}
          loading={locationLoading}
          saving={locationSaving}
          saved={locationSaved}
          onToggle={(key) => setLocationFields((prev) => ({ ...prev, [key]: { ...prev[key], required: !prev[key].required } }))}
          onSave={handleSaveLocationFields}
        />
      )}

      {/* İş Grupları Alanları */}
      {activeTab === 'workGroups' && (
        <FieldsToggleSection
          title="İş Grupları Alanları"
          subtitle="İş grubu tanımlama formundaki alanların zorunluluk durumlarını ayarlayın"
          fields={workGroupFields}
          labels={WORK_GROUP_FIELD_LABELS}
          loading={workGroupLoading}
          saving={workGroupSaving}
          saved={workGroupSaved}
          onToggle={(key) => setWorkGroupFields((prev) => ({ ...prev, [key]: { ...prev[key], required: !prev[key].required } }))}
          onSave={handleSaveWorkGroupFields}
        />
      )}

      {/* İş Alt Grupları Alanları */}
      {activeTab === 'workSubGroups' && (
        <FieldsToggleSection
          title="İş Alt Grupları Alanları"
          subtitle="İş alt grubu tanımlama formundaki alanların zorunluluk durumlarını ayarlayın"
          fields={workSubGroupFields}
          labels={WORK_SUB_GROUP_FIELD_LABELS}
          loading={workSubGroupLoading}
          saving={workSubGroupSaving}
          saved={workSubGroupSaved}
          onToggle={(key) => setWorkSubGroupFields((prev) => ({ ...prev, [key]: { ...prev[key], required: !prev[key].required } }))}
          onSave={handleSaveWorkSubGroupFields}
        />
      )}

      {/* Genel Zorunluluklar */}
      {activeTab === 'generalRequirements' && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden max-w-xl">
          <div className="px-5 py-4 border-b border-slate-50">
            <div>
              <p className="font-medium text-slate-800">Genel Alan Zorunlulukları</p>
              <p className="text-xs text-slate-400 mt-0.5">Müşteri formundaki alanların zorunluluk durumlarını genel olarak yönetin</p>
            </div>
          </div>

          {frLoading ? (
            <div className="text-center py-10 text-slate-400">Yükleniyor...</div>
          ) : (
            <>
              <div className="divide-y divide-slate-50">
                <div className="px-5 py-2.5 bg-slate-50 grid grid-cols-12 gap-4">
                  <div className="col-span-8 text-xs font-medium text-slate-500 uppercase">Ayar</div>
                  <div className="col-span-4 text-xs font-medium text-slate-500 uppercase text-center">Zorunlu</div>
                </div>
                <div className="px-5 py-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-8">
                    <p className="text-sm font-medium text-slate-800">Bireysel müşteride alt tip zorunlu</p>
                    <p className="text-xs text-slate-400 mt-0.5">Bireysel müşteri eklerken &quot;Sigortalı&quot; veya &quot;Özel Müşteri&quot; seçimi zorunlu mu?</p>
                  </div>
                  <div className="col-span-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setFieldRequirements((prev) => ({ ...prev, customerSubTypeRequired: !prev.customerSubTypeRequired }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${fieldRequirements.customerSubTypeRequired ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${fieldRequirements.customerSubTypeRequired ? 'translate-x-5' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400">
                  Varsayılan: Zorunlu — Değişiklik anında müşteri formuna yansır
                </p>
                <button
                  type="button"
                  onClick={handleSaveFieldRequirements}
                  disabled={frSaving}
                  className={`text-sm px-5 py-2 rounded-lg disabled:opacity-50 transition-colors ${frSaved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {frSaving ? 'Kaydediliyor...' : frSaved ? 'Kaydedildi!' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </SettingsPageLayout>
  );
}
