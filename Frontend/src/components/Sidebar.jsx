import { NavLink } from 'react-router-dom';
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
  { to: '/archive', label: 'Archive', icon: Archive },
];

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, pending, onLogout, isSuperAdmin }) {
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
