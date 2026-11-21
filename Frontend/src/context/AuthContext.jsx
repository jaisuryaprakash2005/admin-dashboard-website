import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adminService } from '../services/adminService.js';
import { TOKEN_KEY } from '../services/api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const readToken = () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
const clearToken = () => { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); };

const isAdminRole = (role) => role === 'admin' || role === 'superadmin';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const logout = useCallback(() => { clearToken(); setUser(null); }, []);
  const updateUser = useCallback((updates) => setUser(prev => prev ? { ...prev, ...updates } : updates), []);

  // Restore session from a saved token
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!readToken()) { setBooting(false); return; }
      try {
        const me = await adminService.me();
        if (!alive) return;
        if (isAdminRole(me?.role)) setUser(me); else clearToken();
      } catch { clearToken(); }
      finally { if (alive) setBooting(false); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    window.addEventListener('admin:unauthorized', logout);
    return () => window.removeEventListener('admin:unauthorized', logout);
  }, [logout]);

  const login = async (email, password, remember) => {
    const res = await adminService.login(email, password);
    const u = res?.user;
    if (!isAdminRole(u?.role)) {
      clearToken();
      throw new Error('Access denied. Only Admins and Super Admins can log in to the admin dashboard.');
    }
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, res.token);
    setUser(u);
  };

  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <AuthContext.Provider value={{ user, booting, login, logout, updateUser, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
