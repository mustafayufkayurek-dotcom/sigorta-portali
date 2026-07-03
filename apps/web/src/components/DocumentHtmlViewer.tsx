'use client';

import { useEffect, useRef, useState } from 'react';

interface DocumentHtmlViewerProps {
  html: string;
  title?: string;
  className?: string;
}

/**
 * Backend'in ürettiği tam HTML belgelerini (DOCTYPE + <head><style> + <body>)
 * güvenli şekilde görüntüler. `srcDoc` ile ayrı bir belge bağlamı oluşturulduğu
 * için belgenin kendi <style> bloğu doğru uygulanır ve host sayfaya sızmaz.
 * `sandbox="allow-same-origin"` script/form/pencere açmayı engellerken,
 * yüksekliği otomatik ayarlamak için içerik belgesine erişime izin verir.
 */
export function DocumentHtmlViewer({ html, title = 'Belge', className }: DocumentHtmlViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const resize = () => {
      try {
        const doc = iframe.contentDocument;
        const body = doc?.body;
        const html = doc?.documentElement;
        if (!body || !html) return;
        const contentHeight = Math.max(body.scrollHeight, html.scrollHeight);
        if (contentHeight > 0) setHeight(contentHeight + 16);
      } catch {
        // erişim engellenirse mevcut yükseklikte bırak
      }
    };

    iframe.addEventListener('load', resize);
    const timers = [100, 400, 1000].map((ms) => window.setTimeout(resize, ms));
    return () => {
      iframe.removeEventListener('load', resize);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin"
      style={{ width: '100%', height, border: 'none', display: 'block' }}
      className={className}
    />
  );
}
