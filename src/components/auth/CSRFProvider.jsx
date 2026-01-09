import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const CSRFContext = createContext(null);

export function CSRFProvider({ children }) {
  const [csrfToken, setCsrfToken] = useState(null);

  useEffect(() => {
    const fetchCSRF = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) return;

        const { data } = await base44.functions.invoke('getCSRFToken');
        if (data?.csrfToken) {
          setCsrfToken(data.csrfToken);
          // Store in sessionStorage for persistence across refreshes
          sessionStorage.setItem('csrf_token', data.csrfToken);
        }
      } catch (error) {
        // CSRF is optional - silently fail
      }
    };

    // Try to load from sessionStorage first
    const stored = sessionStorage.getItem('csrf_token');
    if (stored) {
      setCsrfToken(stored);
    } else {
      fetchCSRF();
    }
  }, []);

  return (
    <CSRFContext.Provider value={csrfToken}>
      {children}
    </CSRFContext.Provider>
  );
}

export function useCSRF() {
  return useContext(CSRFContext);
}