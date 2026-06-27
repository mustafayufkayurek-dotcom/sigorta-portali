'use client';

import { useEffect } from 'react';
import { initAuthStorage } from '@/utils/auth-session';

/** Her sayfa yüklemesinde eski token sızıntılarını temizler */
export default function AuthStorageInit() {
  useEffect(() => {
    initAuthStorage();
  }, []);
  return null;
}
