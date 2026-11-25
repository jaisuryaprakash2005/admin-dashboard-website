import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../services/api.js';
import {
  LayoutDashboard,
  Users,
  Building2,
  Radio,
  PlusSquare,
  ShieldCheck,
  Archive,
  LogOut,
  UserCircle,
  UserCog,
  Send,
  Megaphone,
  Briefcase,
  Video,
  BookOpen,
  Compass,
} from 'lucide-react';

const baseLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'User Management', icon: Users },
  { to: '/properties', label: 'Property Management', icon: Building2, end: true },
  { to: '/live-properties', label: 'Live Properties', icon: Radio },
  { to: '/leads', label: 'Leads & Enquiries', icon: Send },
  { to: '/properties/new', label: 'Add Property', icon: PlusSquare },
  { to: '/approvals', label: 'Property Approvals', icon: ShieldCheck, badge: true },
  { to: '/ads', label: 'Ads Management', icon: Megaphone },
  { to: '/builders', label: 'Builders & Developers', icon: Building2 },
  { to: '/careers-in-website', label: 'Careers in Website', icon: Briefcase },
  { to: '/youtube-links', label: 'YouTube Links', icon: Video },
  { to: '/blogs', label: 'Blogs & Articles', icon: BookOpen },
  { to: '/bridge-guide', label: 'Bridge Guide', icon: Compass },
  { to: '/archive', label: 'Archive', icon: Archive },
];

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, pending, onLogout, isSuperAdmin }) {
  const [dbConnected, setDbConnected] = useState(null);

  useEffect(() => {
    let active = true;
    // Initial health check
    api
      .get('/api/health')
      .then((res) => {
        if (active) setDbConnected(res.data?.database === 'connected');
      })
      .catch(() => {
        if (active) setDbConnected(false);
      });

    const handler = (e) => {
      if (active) setDbConnected(Boolean(e.detail?.connected));
    };
    window.addEventListener('probridge:db_status', handler);
    return () => {
      active = false;
      window.removeEventListener('probridge:db_status', handler);
    };
  }, []);

  const links = isSuperAdmin
    ? [
        ...baseLinks.slice(0, 2),
        { to: '/admins', label: 'Admin Management', icon: UserCog },
        ...baseLinks.slice(2),
      ]
    : baseLinks;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}>
      <div className="brand" style={{ flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
          <img
            src={`${import.meta.env.BASE_URL}probridge-logo-white.png`}
            alt="ProBridge"
            style={{ height: collapsed ? 22 : 28, maxWidth: collapsed ? 32 : 140, objectFit: 'contain', borderRadius: 4 }}
          />
          {!collapsed && isSuperAdmin && (
            <small style={{ color: '#a78bfa', fontSize: 10, fontWeight: 700, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Super Admin
            </small>
          )}
          {!collapsed && (
            <NavLink
              to="/profile"
              className={({ isActive }) => `brand-profile-btn ${isActive ? 'active' : ''}`}
              title="My Profile"
              style={{ marginLeft: 'auto' }}
            >
              <UserCircle size={22} />
            </NavLink>
          )}
        </div>
        {!collapsed && (
          <div style={{ width: '100%', marginTop: 8 }}>
            <div
              style={{
                width: '100%',
                height: 1.5,
                background: 'linear-gradient(90deg, #c28916 0%, rgba(194, 137, 22, 0.25) 100%)',
                borderRadius: 1,
              }}
            />
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontStyle: 'italic',
                  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  letterSpacing: '0.5px',
                  color: 'rgba(203, 213, 225, 0.75)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                We Connect World of Real Estate
              </span>

              {dbConnected !== null && (
                <span
                  title={
                    dbConnected
                      ? 'Connected to MongoDB Atlas: showing database values only'
                      : 'Database not connected: showing demo dummy data'
                  }
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    flexShrink: 0,
                    background: dbConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                    color: dbConnected ? '#4ade80' : '#facc15',
                    border: dbConnected
                      ? '1px solid rgba(74, 222, 128, 0.3)'
                      : '1px solid rgba(250, 204, 21, 0.3)',
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: dbConnected ? '#22c55e' : '#eab308',
                      boxShadow: dbConnected ? '0 0 5px #22c55e' : 'none',
                    }}
                  />
                  {dbConnected ? 'DB Live' : 'Demo Mode'}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      <nav>
        {links.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onCloseMobile}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            title={label}
          >
            <Icon size={18} />
            <span className="nav-text">{label}</span>
            {badge && pending > 0 && <span className="nav-badge">{pending}</span>}
          </NavLink>
        ))}
      </nav>
      <button className="nav-link logout" onClick={onLogout} title="Logout">
        <LogOut size={18} /><span className="nav-text">Logout</span>
      </button>
    </aside>
  );
}
