'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { authHeader } from '@/utils/api';
import { getReportImageStreamUrl } from '@/utils/upload-url';

// ─── Types ───────────────────────────────────────────────────────────────────

type ToolType =
  | 'select'
  | 'arrow'
  | 'ellipse'
  | 'rect'
  | 'line'
  | 'freehand'
  | 'text'
  | 'numbered'
  | 'highlight'
  | 'ruler'
  | 'stamp';

type StrokeWidth = 2 | 4 | 6;

interface ImageAnnotationEditorProps {
  imageUrl: string;
  imageId?: string;
  reportId?: string;
  onSave: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

// ─── Preset Colors ────────────────────────────────────────────────────────────

const COLORS = [
  { name: 'Kırmızı', value: '#EF4444' },
  { name: 'Mavi', value: '#3B82F6' },
  { name: 'Turuncu', value: '#F97316' },
  { name: 'Yeşil', value: '#22C55E' },
  { name: 'Siyah', value: '#1F2937' },
];

const STAMPS = ['HASAR', 'ONARILDı', 'ACİL'];

const STROKE_WIDTHS: StrokeWidth[] = [2, 4, 6];
const STROKE_LABELS: Record<StrokeWidth, string> = { 2: 'İnce', 4: 'Orta', 6: 'Kalın' };

// ─── Tool Icons (SVG paths) ───────────────────────────────────────────────────

const ToolIcon = ({ tool }: { tool: ToolType }) => {
  const icons: Record<ToolType, React.ReactNode> = {
    select: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M6.29 18.251c.204.234.523.294.8.15l4.197-2.098c.223-.112.38-.322.418-.564L12 11.003l2.41 1.004a.75.75 0 001.014-.947L8.71 2.25a.75.75 0 00-1.414.003L4.013 11.56a.75.75 0 00.65 1.001l1.627.168-.001 5.522z"/>
      </svg>
    ),
    arrow: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd"/>
      </svg>
    ),
    ellipse: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <ellipse cx="10" cy="10" rx="8" ry="5"/>
      </svg>
    ),
    rect: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <rect x="3" y="5" width="14" height="10" rx="1"/>
      </svg>
    ),
    line: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <line x1="3" y1="17" x2="17" y2="3"/>
      </svg>
    ),
    freehand: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
        <path d="M3 17 C5 12, 8 6, 12 8 S18 15 17 10" strokeLinecap="round"/>
      </svg>
    ),
    text: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-2 0V5H11v10h1a1 1 0 010 2H8a1 1 0 010-2h1V5H5v1a1 1 0 01-2 0V4z"/>
      </svg>
    ),
    numbered: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        <text x="10" y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor">1</text>
      </svg>
    ),
    highlight: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillOpacity="0.4" d="M3 5h14a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1z"/>
        <path d="M3 5h14a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    ruler: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4.5 2A2.5 2.5 0 002 4.5v11A2.5 2.5 0 004.5 18h11A2.5 2.5 0 0018 15.5v-11A2.5 2.5 0 0015.5 2h-11zM6 7a1 1 0 000 2h8a1 1 0 000-2H6zm0 3a1 1 0 000 2h5a1 1 0 000-2H6z" clipRule="evenodd"/>
      </svg>
    ),
    stamp: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M6 3.5A2.5 2.5 0 018.5 1h3A2.5 2.5 0 0114 3.5v.5h.5A2.5 2.5 0 0117 6.5v3a2.5 2.5 0 01-2.5 2.5H14v3a1 1 0 01-1 1H7a1 1 0 01-1-1v-3h-.5A2.5 2.5 0 013 9.5v-3A2.5 2.5 0 015.5 4H6v-.5z" clipRule="evenodd"/>
      </svg>
    ),
  };
  return <>{icons[tool]}</>;
};

// ─── Tool Config ──────────────────────────────────────────────────────────────

const TOOLS: { id: ToolType; label: string }[] = [
  { id: 'select', label: 'Seç / Taşı' },
  { id: 'arrow', label: 'Ok' },
  { id: 'ellipse', label: 'Daire / Elips' },
  { id: 'rect', label: 'Dikdörtgen' },
  { id: 'line', label: 'Çizgi' },
  { id: 'freehand', label: 'Serbest Çizim' },
  { id: 'text', label: 'Metin' },
  { id: 'numbered', label: 'Numaralı Etiket' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'ruler', label: 'Ölçü Çizgisi' },
  { id: 'stamp', label: 'Damga' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageAnnotationEditor({
  imageUrl,
  imageId,
  onSave,
  onClose,
}: ImageAnnotationEditorProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [tool, setTool] = useState<ToolType>('select');
  const [color, setColor] = useState('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>(2);
  const [numberedCount, setNumberedCount] = useState(1);
  const [selectedStamp, setSelectedStamp] = useState(STAMPS[0]);
  const [showStampMenu, setShowStampMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedObj, setSelectedObj] = useState<fabric.Object | null>(null);

  // undo/redo stacks — store JSON snapshots
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const isRestoringRef = useRef(false);

  // drawing state
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef = useRef<fabric.Object | null>(null);

  // refs to avoid stale closures in handlers
  const toolRef = useRef<ToolType>(tool);
  const colorRef = useRef(color);
  const strokeWidthRef = useRef<StrokeWidth>(strokeWidth);
  const numberedCountRef = useRef(numberedCount);
  const selectedStampRef = useRef(selectedStamp);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { numberedCountRef.current = numberedCount; }, [numberedCount]);
  useEffect(() => { selectedStampRef.current = selectedStamp; }, [selectedStamp]);

  // ─── Görsel kaynağı — JWT stream öncelikli (galeri ile aynı) ───────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingImage(true);
      setLoadError(false);
      setResolvedUrl(null);

      if (imageId) {
        try {
          const res = await fetch(getReportImageStreamUrl(imageId), { headers: authHeader() });
          if (res.ok) {
            const blob = await res.blob();
            if (cancelled) return;
            const objectUrl = URL.createObjectURL(blob);
            blobUrlRef.current = objectUrl;
            setResolvedUrl(objectUrl);
            setLoadingImage(false);
            return;
          }
        } catch {
          /* doğrudan URL'ye düş */
        }
      }

      if (cancelled) return;
      if (imageUrl) {
        setResolvedUrl(imageUrl);
        setLoadingImage(false);
        return;
      }

      setLoadError(true);
      setLoadingImage(false);
    };

    void load();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [imageId, imageUrl]);

  // ─── History helpers ────────────────────────────────────────────────────────
  const pushHistory = useCallback(() => {
    if (!fabricRef.current || isRestoringRef.current) return;
    historyRef.current.push(JSON.stringify(fabricRef.current.toJSON()));
    redoRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (!fabricRef.current || historyRef.current.length <= 1) return;
    isRestoringRef.current = true;
    redoRef.current.push(historyRef.current.pop()!);
    const prev = historyRef.current[historyRef.current.length - 1];
    fabricRef.current.loadFromJSON(JSON.parse(prev)).then(() => {
      fabricRef.current!.renderAll();
      isRestoringRef.current = false;
    });
  }, []);

  const redo = useCallback(() => {
    if (!fabricRef.current || redoRef.current.length === 0) return;
    isRestoringRef.current = true;
    const next = redoRef.current.pop()!;
    historyRef.current.push(next);
    fabricRef.current.loadFromJSON(JSON.parse(next)).then(() => {
      fabricRef.current!.renderAll();
      isRestoringRef.current = false;
    });
  }, []);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = fabricRef.current?.getActiveObject();
        if (active) {
          fabricRef.current?.remove(active);
          fabricRef.current?.renderAll();
          pushHistory();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, pushHistory]);

  // ─── Canvas init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedUrl || !canvasElRef.current || !containerRef.current) return;

    const img = new Image();
    const isBlob = resolvedUrl.startsWith('blob:');
    if (!isBlob) img.crossOrigin = 'anonymous';

    const initCanvas = () => {
      const maxW = Math.min(window.innerWidth - 280, 1400);
      const maxH = window.innerHeight - 120;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const fc = new fabric.Canvas(canvasElRef.current!, {
        width: w,
        height: h,
        selection: true,
        preserveObjectStacking: true,
      });
      fabricRef.current = fc;

      const loadOpts = isBlob ? {} : { crossOrigin: 'anonymous' as const };
      fabric.FabricImage.fromURL(resolvedUrl, loadOpts).then((fimg) => {
        fimg.set({ left: 0, top: 0, scaleX: w / img.width, scaleY: h / img.height, selectable: false, evented: false });
        fc.backgroundImage = fimg;
        fc.renderAll();
        historyRef.current = [JSON.stringify(fc.toJSON())];
      }).catch(() => {
        setLoadError(true);
      });

      // ── Mouse event handlers ────────────────────────────────────────────────
      fc.on('mouse:down', (opt) => {
        const currentTool = toolRef.current;
        if (currentTool === 'select') return;

        const pointer = fc.getScenePoint(opt.e);
        startPointRef.current = { x: pointer.x, y: pointer.y };
        isDrawingRef.current = true;

        if (currentTool === 'freehand') {
          fc.isDrawingMode = true;
          fc.freeDrawingBrush = new fabric.PencilBrush(fc);
          fc.freeDrawingBrush.color = colorRef.current;
          fc.freeDrawingBrush.width = strokeWidthRef.current;
          return;
        }

        fc.isDrawingMode = false;
        fc.selection = false;

        const x = pointer.x;
        const y = pointer.y;
        const c = colorRef.current;
        const sw = strokeWidthRef.current;

        if (currentTool === 'text') {
          const txt = new fabric.IText('Metin', {
            left: x,
            top: y,
            fontSize: 16,
            fontFamily: 'Arial',
            fill: '#000000',
            backgroundColor: '#FFFFFF',
            padding: 4,
            borderColor: c,
            editingBorderColor: c,
          });
          fc.add(txt);
          fc.setActiveObject(txt);
          txt.enterEditing();
          txt.selectAll();
          fc.renderAll();
          pushHistory();
          isDrawingRef.current = false;
          return;
        }

        if (currentTool === 'numbered') {
          const n = numberedCountRef.current;
          const circle = new fabric.Circle({
            radius: 14,
            fill: colorRef.current,
            stroke: 'white',
            strokeWidth: 2,
          });
          const label = new fabric.Text(String(n), {
            fontSize: 14,
            fontWeight: 'bold',
            fill: '#FFFFFF',
            fontFamily: 'Arial',
          });
          label.set({ left: 14 - label.width! / 2, top: 14 - label.height! / 2 });
          const group = new fabric.Group([circle, label], {
            left: x - 14,
            top: y - 14,
          });
          fc.add(group);
          setNumberedCount((prev) => prev + 1);
          fc.renderAll();
          pushHistory();
          isDrawingRef.current = false;
          return;
        }

        if (currentTool === 'stamp') {
          const stampText = selectedStampRef.current;
          const rect = new fabric.Rect({
            width: 110,
            height: 36,
            fill: 'transparent',
            stroke: '#EF4444',
            strokeWidth: 3,
            rx: 4,
            ry: 4,
          });
          const txt = new fabric.Text(stampText, {
            fontSize: 15,
            fontWeight: 'bold',
            fill: '#EF4444',
            fontFamily: 'Arial',
            left: 8,
            top: 8,
          });
          const group = new fabric.Group([rect, txt], {
            left: x - 55,
            top: y - 18,
            angle: -15,
          });
          fc.add(group);
          fc.renderAll();
          pushHistory();
          isDrawingRef.current = false;
          return;
        }

        if (currentTool === 'ruler') {
          const line = new fabric.Line([x, y, x, y], {
            stroke: c,
            strokeWidth: sw,
          });
          fc.add(line);
          activeShapeRef.current = line;
          return;
        }

        if (currentTool === 'arrow') {
          const line = new fabric.Line([x, y, x, y], {
            stroke: c,
            strokeWidth: sw,
            selectable: false,
            evented: false,
          });
          fc.add(line);
          activeShapeRef.current = line;
          return;
        }

        if (currentTool === 'ellipse') {
          const el = new fabric.Ellipse({
            left: x,
            top: y,
            rx: 0,
            ry: 0,
            fill: 'transparent',
            stroke: c,
            strokeWidth: sw,
            selectable: false,
            evented: false,
          });
          fc.add(el);
          activeShapeRef.current = el;
          return;
        }

        if (currentTool === 'rect') {
          const r = new fabric.Rect({
            left: x,
            top: y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: c,
            strokeWidth: sw,
            selectable: false,
            evented: false,
          });
          fc.add(r);
          activeShapeRef.current = r;
          return;
        }

        if (currentTool === 'line') {
          const ln = new fabric.Line([x, y, x, y], {
            stroke: c,
            strokeWidth: sw,
            selectable: false,
            evented: false,
          });
          fc.add(ln);
          activeShapeRef.current = ln;
          return;
        }

        if (currentTool === 'highlight') {
          const hl = new fabric.Rect({
            left: x,
            top: y,
            width: 0,
            height: 0,
            fill: hexToRgba(c, 0.3),
            stroke: hexToRgba(c, 0.5),
            strokeWidth: 1,
            selectable: false,
            evented: false,
          });
          fc.add(hl);
          activeShapeRef.current = hl;
          return;
        }
      });

      fc.on('mouse:move', (opt) => {
        if (!isDrawingRef.current || !startPointRef.current || !activeShapeRef.current) return;
        const pointer = fc.getScenePoint(opt.e);
        const { x: ox, y: oy } = startPointRef.current;
        const dx = pointer.x - ox;
        const dy = pointer.y - oy;
        const shape = activeShapeRef.current;

        const snap45 = () => {
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          const snapped = Math.round(angle / 45) * 45;
          const rad = snapped * (Math.PI / 180);
          const len = Math.sqrt(dx * dx + dy * dy);
          return { x: ox + len * Math.cos(rad), y: oy + len * Math.sin(rad) };
        };

        if (shape instanceof fabric.Line) {
          if (toolRef.current === 'arrow') {
            const snapped = snap45();
            shape.set({ x2: snapped.x, y2: snapped.y });
          } else {
            shape.set({ x2: pointer.x, y2: pointer.y });
          }
        } else if (shape instanceof fabric.Ellipse) {
          const rx = Math.abs(dx / 2);
          const ry = Math.abs(dy / 2);
          shape.set({ left: ox + dx / 2 - rx, top: oy + dy / 2 - ry, rx, ry });
        } else if (shape instanceof fabric.Rect) {
          shape.set({
            left: dx < 0 ? pointer.x : ox,
            top: dy < 0 ? pointer.y : oy,
            width: Math.abs(dx),
            height: Math.abs(dy),
          });
        }
        fc.renderAll();
      });

      fc.on('mouse:up', (_opt) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        const currentTool = toolRef.current;

        if (currentTool === 'freehand') {
          fc.isDrawingMode = false;
          pushHistory();
          return;
        }

        const shape = activeShapeRef.current;

        if (shape && currentTool === 'arrow') {
          // Make arrow head using triangle
          const line = shape as fabric.Line;
          const x1 = line.x1 ?? 0, y1 = line.y1 ?? 0;
          const x2 = line.x2 ?? 0, y2 = line.y2 ?? 0;

          const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
          const arrowLen = 14 + strokeWidthRef.current * 2;
          const triangle = new fabric.Triangle({
            width: arrowLen,
            height: arrowLen,
            fill: colorRef.current,
            left: x2,
            top: y2,
            angle: angle + 90,
            originX: 'center',
            originY: 'center',
          });

          line.set({ selectable: true, evented: true });
          triangle.set({ selectable: false, evented: false });
          const group = new fabric.Group([line, triangle]);
          fc.remove(line);
          fc.add(group);
          fc.setActiveObject(group);
        } else if (shape) {
          shape.set({ selectable: true, evented: true });
        }

        if (currentTool === 'ruler' && shape instanceof fabric.Line) {
          const distance = prompt('Ölçü değerini girin (örn: 2.5m):');
          if (distance) {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0;
            const x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const sw = strokeWidthRef.current;

            // End ticks
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
            const tick1 = new fabric.Line(
              [x1, y1 - 8, x1, y1 + 8],
              { stroke: colorRef.current, strokeWidth: sw, angle: angle, originX: 'center', originY: 'center' }
            );
            const tick2 = new fabric.Line(
              [x2, y2 - 8, x2, y2 + 8],
              { stroke: colorRef.current, strokeWidth: sw, angle: angle, originX: 'center', originY: 'center' }
            );
            const label = new fabric.Rect({
              left: mx - 30,
              top: my - 12,
              width: 60,
              height: 22,
              fill: '#FFFFFF',
              rx: 3,
              ry: 3,
            });
            const txt = new fabric.Text(distance, {
              left: mx,
              top: my,
              originX: 'center',
              originY: 'center',
              fontSize: 12,
              fontFamily: 'Arial',
              fill: colorRef.current,
              fontWeight: 'bold',
            });
            shape.set({ selectable: true, evented: true });
            const group = new fabric.Group([shape as fabric.Line, tick1, tick2, label, txt]);
            fc.remove(shape);
            fc.add(group);
            fc.setActiveObject(group);
          }
        }

        activeShapeRef.current = null;
        fc.selection = true;
        fc.renderAll();
        pushHistory();
      });

      // Path:created fires after freehand stroke
      fc.on('path:created', () => {
        pushHistory();
      });

      // track selection
      fc.on('selection:created', (opt) => {
        setSelectedObj(opt.selected?.[0] ?? null);
      });
      fc.on('selection:updated', (opt) => {
        setSelectedObj(opt.selected?.[0] ?? null);
      });
      fc.on('selection:cleared', () => {
        setSelectedObj(null);
      });
    };

    img.onload = initCanvas;
    img.onerror = () => setLoadError(true);
    img.src = resolvedUrl;

    return () => {
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUrl]);

  // Update canvas mode when tool changes
  useEffect(() => {
    const fc = fabricRef.current;
    if (!fc) return;
    fc.isDrawingMode = false;
    fc.selection = tool === 'select';
    fc.getObjects().forEach((obj) => {
      obj.set({ selectable: tool === 'select', evented: tool === 'select' });
    });
    fc.renderAll();
  }, [tool]);

  // ─── Update selected object's color/strokeWidth ───────────────────────────
  useEffect(() => {
    if (!selectedObj || !fabricRef.current) return;
    const obj = selectedObj;
    if (obj instanceof fabric.Path || obj instanceof fabric.Line) {
      obj.set({ stroke: color });
    } else if (obj instanceof fabric.Rect || obj instanceof fabric.Ellipse || obj instanceof fabric.Circle) {
      obj.set({ stroke: color });
    } else if (obj instanceof fabric.IText || obj instanceof fabric.Text) {
      obj.set({ fill: color });
    }
    fabricRef.current.renderAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  useEffect(() => {
    if (!selectedObj || !fabricRef.current) return;
    const obj = selectedObj;
    if ('strokeWidth' in obj) {
      obj.set({ strokeWidth });
    }
    fabricRef.current.renderAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokeWidth]);

  // ─── Delete selected ──────────────────────────────────────────────────────
  const handleDelete = () => {
    const fc = fabricRef.current;
    if (!fc) return;
    const active = fc.getActiveObject();
    if (active) {
      fc.remove(active);
      fc.renderAll();
      pushHistory();
    }
  };

  // ─── Clear all ────────────────────────────────────────────────────────────
  const handleClearAll = () => {
    const fc = fabricRef.current;
    if (!fc) return;
    // Keep only background
    const bg = fc.backgroundImage;
    fc.clear();
    if (bg) { fc.backgroundImage = bg; }
    fc.renderAll();
    pushHistory();
    setShowClearConfirm(false);
  };

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const fc = fabricRef.current;
    if (!fc) return;
    setSaving(true);
    try {
      const dataUrl = fc.toDataURL({ format: 'png', multiplier: 1 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await onSave(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: '#0f1117' }}>
      {/* ── Top Bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 flex-shrink-0" style={{ background: '#1a1d27' }}>
        <span className="text-white text-sm font-semibold tracking-wide">Fotoğraf İşaretleme Editörü</span>
        <div className="h-4 w-px bg-gray-700 mx-1" />

        {/* Undo / Redo */}
        <button type="button" onClick={undo} title="Geri Al (Ctrl+Z)"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
        </button>
        <button type="button" onClick={redo} title="İleri Al (Ctrl+Y)"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H9a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h5.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/>
          </svg>
        </button>

        <div className="h-4 w-px bg-gray-700 mx-1" />

        {/* Delete selected */}
        <button type="button" onClick={handleDelete} title="Seçili Nesneyi Sil (Delete)"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
        </button>

        {/* Clear All */}
        {showClearConfirm ? (
          <div className="flex items-center gap-2 bg-red-900/40 rounded-lg px-3 py-1 border border-red-700">
            <span className="text-red-300 text-xs">Tümünü temizle?</span>
            <button type="button" onClick={handleClearAll} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700">Evet</button>
            <button type="button" onClick={() => setShowClearConfirm(false)} className="text-xs text-gray-400 hover:text-white">Hayır</button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowClearConfirm(true)} title="Tümünü Temizle"
            className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700">
            Temizle
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
            İptal
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Kaydediliyor...
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293z"/>
                </svg>
                Kaydet
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Area ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left Toolbar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1 px-2 py-3 border-r border-gray-800 overflow-y-auto flex-shrink-0"
          style={{ background: '#1a1d27', width: 220 }}>

          {/* Tools */}
          <p className="text-gray-500 text-[10px] mb-1 px-1">Araçlar</p>
          {TOOLS.map((t) => {
            const isStampTool = t.id === 'stamp';
            return (
              <div key={t.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setTool(t.id);
                    if (isStampTool) setShowStampMenu((v) => !v);
                    else setShowStampMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tool === t.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                  title={t.label}
                >
                  <ToolIcon tool={t.id} />
                  <span className="text-xs">{t.label}</span>
                  {isStampTool && tool === t.id && (
                    <span className="ml-auto text-gray-300 text-[10px]">{selectedStamp}</span>
                  )}
                </button>
                {isStampTool && showStampMenu && (
                  <div className="absolute left-full top-0 ml-1 bg-gray-800 border border-gray-700 rounded-lg py-1 z-10 w-36">
                    {STAMPS.map((s) => (
                      <button key={s} type="button"
                        onClick={() => { setSelectedStamp(s); setShowStampMenu(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          selectedStamp === s ? 'text-red-400 bg-gray-700' : 'text-gray-300 hover:bg-gray-700'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="h-px bg-gray-800 my-2" />

          {/* Color */}
          <p className="text-gray-500 text-[10px] mb-1 px-1">Renk</p>
          <div className="flex flex-wrap gap-2 px-1">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                title={c.name}
                style={{ background: c.value }}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : 'hover:scale-105'
                }`}
              />
            ))}
          </div>

          <div className="h-px bg-gray-800 my-2" />

          {/* Stroke Width */}
          <p className="text-gray-500 text-[10px] mb-1 px-1">Kalınlık</p>
          <div className="flex gap-1 px-1">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw}
                type="button"
                onClick={() => setStrokeWidth(sw)}
                title={STROKE_LABELS[sw]}
                className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-colors ${
                  strokeWidth === sw ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div style={{ width: 20, height: sw, background: 'white', borderRadius: 2 }} />
              </button>
            ))}
          </div>

          {/* Numbered counter reset */}
          {numberedCount > 1 && (
            <>
              <div className="h-px bg-gray-800 my-2" />
              <div className="px-1 flex items-center justify-between">
                <span className="text-gray-500 text-xs">Numara: {numberedCount}</span>
                <button type="button" onClick={() => setNumberedCount(1)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 underline">Sıfırla</button>
              </div>
            </>
          )}
        </div>

        {/* ── Canvas Area ──────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-auto p-4 relative"
          style={{ background: '#0f1117' }}
        >
          {loadingImage && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              Fotoğraf yükleniyor...
            </div>
          )}
          {loadError && !loadingImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
              <p className="text-sm text-red-300">Fotoğraf yüklenemedi.</p>
              <p className="text-xs text-gray-500">Oturumunuz açık mı kontrol edin veya sayfayı yenileyip tekrar deneyin.</p>
            </div>
          )}
          <canvas ref={canvasElRef} className={loadingImage || loadError ? 'invisible' : 'block'} />
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
