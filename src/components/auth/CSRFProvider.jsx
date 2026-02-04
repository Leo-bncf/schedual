import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const CSRFContext = createContext(null);

export function CSRFProvider({ children }) {
  const [csrfToken, setCsrfToken] = useState(null);

  useEffect(() => {
    // CSRF disabled - causes 404 errors and slows down app
    // Re-enable if needed later
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