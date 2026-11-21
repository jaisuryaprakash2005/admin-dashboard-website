import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Info, Crown } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { adminService, USE_MOCK } from '../services/adminService.js';
import { initials } from '../utils/format.js';

export default function AdminLayout() {
  const { user, logout, isSuperAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const location = useLocation();

  const refreshPending = useCallback(async () => {
    try {
      const list = await adminService.listProperties();
      if (user?.role === 'superadmin') {
        // Super admin's primary queue is admin-approved listings waiting for final publishing
        setPending(list.filter((p) => p.approvalStatus === 'admin_approved').length);
      } else {
        // Regular admin's queue is pending listings
        setPending(list.filter((p) => p.approvalStatus === 'pending').length);
      }
    } catch { /* badge is optional */ }
  }, [user?.role]);

  useEffect(() => { refreshPending(); }, [location.pathname, refreshPending]);

  return (
    <div className="shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        pending={pending}
        onLogout={logout}
        isSuperAdmin={isSuperAdmin}
      />
      {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          {isSuperAdmin && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 12px',
                borderRadius: 999,
                background: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #FDE68A',
                fontSize: 12,
                fontWeight: 700,
                marginLeft: 8,
                boxShadow: '0 1px 3px rgba(194, 137, 22, 0.12)',
              }}
            >
              <Crown size={14} color="#C28916" /> Super Admin Mode
            </span>
          )}
          <div className="spacer" />
          <NavLink
            to="/profile"
            className={({ isActive }) => `me${isActive ? ' me-active' : ''}`}
            title="My Profile"
          >
            <div
              className="avatar"
              style={
                isSuperAdmin
                  ? { background: '#0D5F4E', color: '#fff', border: '2px solid #C28916' }
                  : { background: '#E6F4EA', color: '#0D5F4E', border: '1.5px solid #0D5F4E' }
              }
            >
              {initials(user?.name)}
            </div>
            <div className="me-text">
              <strong>{user?.name}</strong>
              <small>{isSuperAdmin ? 'Super Admin' : user?.email}</small>
            </div>
          </NavLink>
        </header>
        {USE_MOCK && (
          <div className="demo-banner">
            <Info size={16} /> Demo mode: sample data only. Changes are not saved to your database. Set VITE_USE_MOCK=false to use the real backend.
          </div>
        )}
        <main className="content"><Outlet context={{ refreshPending, isSuperAdmin }} /></main>
      </div>
    </div>
  );
}
