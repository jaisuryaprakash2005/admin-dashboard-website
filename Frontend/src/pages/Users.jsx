import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, BadgeCheck, Eye, Trash2, Pencil, ShieldCheck, X, Save,
  User as UserIcon, CheckCircle2, AlertTriangle, ShieldAlert, Ban, AlertCircle,
} from 'lucide-react';
import SearchBar from '../components/SearchBar.jsx';
import Pagination from '../components/Pagination.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, ErrorState, Loading } from '../components/StateBlock.jsx';
import useData from '../hooks/useData.js';
import usePagination from '../hooks/usePagination.js';
import { adminService } from '../services/adminService.js';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate, initials } from '../utils/format.js';

// ─── Status Definitions ───────────────────────────────────────────────────────
export const USER_STATUSES = {
  trusted: {
    key: 'trusted',
    label: 'Trusted',
    color: '#047857',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    icon: CheckCircle2,
    desc: 'Normal standing. Full platform access.',
  },
  flagged: {
    key: 'flagged',
    label: 'Flagged',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: AlertTriangle,
    desc: '1st Warning: Sends notification alert & displays warning banner at top of mobile home page.',
  },
  restricted: {
    key: 'restricted',
    label: 'Restricted',
    color: '#be123c',
    bg: '#fff1f2',
    border: '#fecdd3',
    icon: ShieldAlert,
    desc: 'Suspended: User cannot access app features; displays suspension message screen.',
  },
  revoked: {
    key: 'revoked',
    label: 'Revoked',
    color: '#991b1b',
    bg: '#fee2e2',
    border: '#fca5a5',
    icon: Ban,
    desc: 'Permanently Terminated: Account is terminated immediately and user cannot log in.',
  },
};

export function UserStatusBadge({ status, onClick }) {
  const norm = (status || 'trusted').toLowerCase();
  const conf = USER_STATUSES[norm] || USER_STATUSES.trusted;
  const Icon = conf.icon;
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 20,
        background: conf.bg,
        color: conf.color,
        border: `1px solid ${conf.border}`,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      title={onClick ? 'Click to change activity status' : conf.desc}
    >
      <Icon size={12} /> {conf.label}
    </span>
  );
}

// ─── Change User Activity Status Modal ────────────────────────────────────────
function ChangeStatusModal({ user, onSave, onClose }) {
  const { user: currentAdmin } = useAuth();
  const adminName = currentAdmin?.name || 'Admin';

  const [selectedStatus, setSelectedStatus] = useState((user.status || 'trusted').toLowerCase());
  const [reason, setReason] = useState(user.statusReason || adminName);
  const [saving, setSaving] = useState(false);

  const handleSelectStatus = (statusKey) => {
    setSelectedStatus(statusKey);
    setReason(statusKey === 'trusted' ? '' : adminName);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(user.id, selectedStatus, selectedStatus === 'trusted' ? '' : (reason || adminName));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`User Activity Status — ${user.name}`} onClose={onClose}>
      <div className="cell-user big" style={{ marginBottom: 16 }}>
        {user.photo ? <img className="avatar" src={user.photo} alt="" /> : <div className="avatar">{initials(user.name)}</div>}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{user.name}</strong>
            <UserStatusBadge status={user.status} />
          </div>
          <small>{user.email}</small>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
            Select Account Standing / Status:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {Object.values(USER_STATUSES).map((item) => {
              const active = selectedStatus === item.key;
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  onClick={() => handleSelectStatus(item.key)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: active ? `2px solid ${item.color}` : '1px solid var(--border)',
                    background: active ? item.bg : 'var(--card-bg, #fff)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, color: item.color, marginBottom: 4 }}>
                    <Icon size={16} /> {item.label}
                    {active && <span style={{ marginLeft: 'auto', fontSize: 11, background: item.color, color: '#fff', padding: '1px 6px', borderRadius: 10 }}>Selected</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: active ? item.color : 'var(--muted)', lineHeight: 1.35 }}>
                    {item.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {selectedStatus !== 'trusted' && (
          <label style={{ display: 'block', marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Warning / Suspension Reason <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Admin who updated status - Read Only)</span>:
            </span>
            <input
              className="field"
              type="text"
              readOnly
              value={reason || adminName}
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-muted, #f8fafc)',
                color: 'var(--text-primary)',
                cursor: 'not-allowed',
                fontWeight: 600,
              }}
            />
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={15} style={{ marginRight: 6 }} />
            {saving ? 'Updating…' : 'Apply Status'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({ user, onSave, onClose }) {
  const toast = useToast();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const [name, setName]                 = useState(user.name || '');
  const [phone, setPhone]               = useState(user.phone || '');
  const [role, setRole]                 = useState(user.role || 'user');
  const [status, setStatus]             = useState((user.status || 'trusted').toLowerCase());
  const [statusReason, setStatusReason] = useState(user.statusReason || '');
  const [password, setPassword]         = useState('');
  const [showPw, setShowPw]             = useState(false);
  const [saving, setSaving]             = useState(false);

  // Guard: Regular admins cannot edit Super Admin accounts
  if (user?.role === 'superadmin' && !isSuperAdmin) {
    return (
      <Modal title="Access Denied" onClose={onClose}>
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--muted)' }}>
          Regular admins cannot change or edit Super Admin accounts.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </Modal>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimName  = name.trim();
    const trimPhone = phone.trim();
    if (!trimName) return toast.error('Name cannot be empty.');
    if (trimPhone && !/^\d{10}$/.test(trimPhone)) return toast.error('Phone must be 10 digits.');
    if (password && password.length < 6) return toast.error('Password must be at least 6 characters.');

    // Confirmation if demoting an admin to user
    if (user.role === 'admin' && role === 'user') {
      const ok = window.confirm(`Confirm: Are you sure you want to change "${user.name}" from Admin to regular User? They will lose access to the admin dashboard.`);
      if (!ok) return;
    }

    setSaving(true);
    try {
      const updates = { name: trimName, phone: trimPhone, status, statusReason };
      if (password) updates.password = password;
      if (isSuperAdmin && role !== user.role) updates.role = role;
      await onSave(user.id, updates);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit — ${user.name}`} onClose={onClose}>
      {/* User identity header */}
      <div className="cell-user big" style={{ marginBottom: 18 }}>
        {user.photo
          ? <img className="avatar" src={user.photo} alt="" />
          : <div className="avatar">{initials(user.name)}</div>}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>{user.name}</strong>
            <UserStatusBadge status={status} />
          </div>
          <small>{user.email}</small>
          {user.role === 'admin' && (
            <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={12} /> Admin
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Display Name</span>
          <input
            className="field" type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name" required
          />
        </label>

        {/* Email — locked */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--muted)' }}>
            Email (read-only)
          </span>
          <input className="field" type="email" value={user.email} readOnly disabled
            style={{ background: 'var(--grey-soft)', cursor: 'not-allowed', color: 'var(--muted)' }} />
        </label>

        {/* Phone */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone Number</span>
          <input
            className="field" type="tel" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number" maxLength={10}
          />
        </label>

        {/* Role (Super Admin can change role of other accounts) */}
        {isSuperAdmin && String(user.id) !== String(currentUser?.id) && (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Account Role</span>
            <select
              className="field"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="user">User (Mobile App only)</option>
              <option value="admin">Admin (Dashboard access)</option>
              {user.role === 'superadmin' && <option value="superadmin">Super Admin (Full access)</option>}
            </select>
          </label>
        )}

        {/* Activity Status */}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Activity Status</span>
          <select
            className="field"
            value={status}
            onChange={(e) => {
              const nextStatus = e.target.value;
              setStatus(nextStatus);
              setStatusReason(nextStatus === 'trusted' ? '' : (currentUser?.name || 'Admin'));
            }}
          >
            <option value="trusted">🟢 Trusted (Normal active standing)</option>
            <option value="flagged">🟡 Flagged (1st Warning & home banner)</option>
            <option value="restricted">🔴 Restricted (Suspended - block from app)</option>
            <option value="revoked">⛔ Revoked (Permanently Terminated)</option>
          </select>
        </label>

        {/* Warning / Suspension Reason - only shown when status is not trusted */}
        {status !== 'trusted' && (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              Warning / Suspension Reason <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Admin who updated status - Read Only)</span>
            </span>
            <input
              className="field"
              type="text"
              readOnly
              value={statusReason || (currentUser?.name || 'Admin')}
              style={{
                backgroundColor: 'var(--surface-muted, #f8fafc)',
                color: 'var(--text-primary)',
                cursor: 'not-allowed',
                fontWeight: 600,
              }}
              placeholder="Admin name"
            />
          </label>
        )}

        {/* New Password */}
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            New Password <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(leave blank to keep current)</span>
          </span>
          <div style={{ position: 'relative' }}>
            <input
              className="field" type={showPw ? 'text' : 'password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters" style={{ paddingRight: 40 }}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={15} />{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────
function UserRow({ u, onView, onEdit, onDelete, onRoleChange, onStatusChange, isAdmin, isSuperAdmin, currentUser }) {
  // Hide destructive actions for the currently logged-in account (prevent self-deletion)
  const selfById =
    (u.id != null && currentUser?.id != null && String(u.id) === String(currentUser.id)) ||
    (u._id != null && currentUser?._id != null && String(u._id) === String(currentUser._id)) ||
    (u.id != null && currentUser?._id != null && String(u.id) === String(currentUser._id)) ||
    (u._id != null && currentUser?.id != null && String(u._id) === String(currentUser.id));
  const selfByEmail = u.email && currentUser?.email && u.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
  const isSelf = Boolean(selfById || selfByEmail);
  const isSuper = u.role === 'superadmin';
  const isRowAdmin = u.role === 'admin';

  // Super Admin can edit anyone (Admins, Users, Super Admins).
  // Regular Admin CANNOT edit Super Admins; they can edit regular Users.
  const canEdit = isSuperAdmin || !isSuper;

  // Super Admin can delete regular Users, Admins, and other Super Admins,
  // but NEVER themselves (!isSelf).
  // Regular Admin can only delete regular Users (!isSuper && !isRowAdmin && !isSelf).
  const canDelete = !isSelf && (isSuperAdmin || (!isSuper && !isRowAdmin));

  return (
    <tr>
      <td>
        <div className="cell-user">
          {u.photo
            ? <img className="avatar sm" src={u.photo} alt="" />
            : <div className="avatar sm" style={isSuper ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' } : {}}>{initials(u.name)}</div>}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong>{u.name}</strong>
              {isSelf && (
                <span style={{ fontSize: 11, background: 'var(--grey-soft)', color: 'var(--muted)', padding: '1px 6px', borderRadius: 4 }}>
                  (You)
                </span>
              )}
            </div>
            <small>{u.email}</small>
          </div>
        </div>
      </td>
      <td>{u.phone ? <>{u.phone} {u.phoneVerified && <BadgeCheck size={14} className="ok" />}</> : <span className="muted-text">—</span>}</td>
      <td>
        {isSuper ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed',
            border: '1px solid rgba(124, 58, 237, 0.3)',
          }}>
            👑 Super Admin
          </span>
        ) : u.role === 'admin' ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            border: '1px solid rgba(43, 90, 237, 0.25)',
          }}>
            <ShieldCheck size={12} /> Admin
          </span>
        ) : (
          <span className="chip">{u.provider}</span>
        )}
      </td>
      <td>
        <UserStatusBadge status={u.status} onClick={() => onStatusChange(u)} />
        {(u.status || '').toLowerCase() !== 'trusted' && u.statusReason && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap' }} title={`Updated by: ${u.statusReason}`}>
            by {u.statusReason}
          </div>
        )}
      </td>
      {!isAdmin && <td>{u.listings}</td>}
      <td>{formatDate(u.createdAt)}</td>
      <td className="right actions">
        <button className="icon-btn" title="View details" onClick={() => onView(u)}><Eye size={17} /></button>
        <button className="icon-btn" title="Change Activity Status (Trusted, Flagged, Restricted, Revoked)" onClick={() => onStatusChange(u)} style={{ color: '#d97706' }}>
          <ShieldAlert size={16} />
        </button>
        {/* Regular admins cannot edit Super Admin accounts */}
        {canEdit && (
          <button className="icon-btn" title="Edit" onClick={() => onEdit(u)} style={{ color: 'var(--accent)' }}><Pencil size={16} /></button>
        )}
        {/* Role change button for Super Admin */}
        {isSuperAdmin && u.role !== 'superadmin' && !isSelf && (
          u.role === 'admin' ? (
            <button
              className="icon-btn"
              title="Change role to User (Demote)"
              style={{ color: 'var(--amber)' }}
              onClick={() => onRoleChange(u, 'user')}
            >
              <UserIcon size={16} />
            </button>
          ) : (
            <button
              className="icon-btn"
              title="Change role to Admin (Promote)"
              style={{ color: 'var(--green)' }}
              onClick={() => onRoleChange(u, 'admin')}
            >
              <ShieldCheck size={16} />
            </button>
          )
        )}
        {canDelete && (
          <button className="icon-btn danger" title="Delete" onClick={() => onDelete(u)}>
            <Trash2 size={17} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Users Table ──────────────────────────────────────────────────────────────
function UsersTable({ rows, isAdmin, isSuperAdmin, currentUser, onView, onEdit, onDelete, onRoleChange, onStatusChange, sort, toggleSort }) {
  const Th = ({ k, children }) => (
    <th className="sortable" onClick={() => toggleSort(k)}>
      {children}{sort.key === k && (sort.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
    </th>
  );
  const pg = usePagination(rows, 8);

  if (rows.length === 0) return <Empty text={`No ${isAdmin ? 'staff accounts' : 'users'} match your filters.`} />;

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <Th k="name">{isAdmin ? 'Staff Member' : 'User'}</Th>
              <th>Phone</th>
              <th>{isAdmin ? 'Role' : 'Sign-up'}</th>
              <Th k="status">Status</Th>
              {!isAdmin && <Th k="listings">Listings</Th>}
              <Th k="createdAt">Registered</Th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pg.pageItems.map((u) => (
              <UserRow key={u.id} u={u} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} currentUser={currentUser}
                onView={onView} onEdit={onEdit} onDelete={onDelete} onRoleChange={onRoleChange} onStatusChange={onStatusChange} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination {...pg} onPage={pg.setPage} />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Users() {
  const toast = useToast();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const { data, setData, loading, error, reload } = useData(async () => {
    const [users, properties] = await Promise.all([
      adminService.listUsers(),
      adminService.listProperties(),
    ]);
    const counts = {};
    properties.forEach((p) => {
      const k = (p.ownerEmail || '').toLowerCase();
      if (k) counts[k] = (counts[k] || 0) + 1;
    });
    return users.map((u) => ({ ...u, listings: counts[(u.email || '').toLowerCase()] || 0 }));
  });

  const [q, setQ]                   = useState('');
  const [provider, setProvider]     = useState('');
  const [phone, setPhone]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort]             = useState({ key: 'createdAt', dir: 'desc' });
  const [viewing, setViewing]       = useState(null);
  const [editing, setEditing]       = useState(null);
  const [deleting, setDeleting]     = useState(null);
  const [roleChanging, setRoleChanging] = useState(null); // { user, newRole }
  const [statusChanging, setStatusChanging] = useState(null); // user object
  const [tab, setTab]               = useState('users'); // 'users' | 'admins' | 'superadmins'

  const { superAdmins, admins, users: regularUsers } = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = (data || []).filter((u) =>
      (!term || [u.name, u.email, u.phone].some((v) => (v || '').toLowerCase().includes(term))) &&
      (!provider || u.provider === provider) &&
      (!phone || (phone === 'verified') === !!u.phoneVerified) &&
      (!statusFilter || (u.status || 'trusted').toLowerCase() === statusFilter)
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    const sorted = filtered.sort((a, b) => {
      const x = sort.key === 'createdAt' ? new Date(a.createdAt) : a[sort.key];
      const y = sort.key === 'createdAt' ? new Date(b.createdAt) : b[sort.key];
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
    return {
      superAdmins: sorted.filter((u) => u.role === 'superadmin'),
      admins:      sorted.filter((u) => u.role === 'admin'),
      users:       sorted.filter((u) => u.role !== 'admin' && u.role !== 'superadmin'),
    };
  }, [data, q, provider, phone, statusFilter, sort]);

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const confirmDelete = async () => {
    try {
      await adminService.deleteUser(deleting.id);
      setData((list) => list.filter((u) => u.id !== deleting.id));
      toast.success(`${deleting.name} was removed.`);
      setDeleting(null);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleSaveUser = async (id, updates) => {
    try {
      await adminService.updateUser(id, updates);
      setData((list) => list.map((u) => u.id === id ? { ...u, ...updates, password: undefined } : u));
      toast.success('User updated successfully.');
      setEditing(null);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleRoleChange = async (targetUser, newRole) => {
    try {
      await adminService.changeUserRole(targetUser.id, newRole);
      setData((list) => list.map((u) => u.id === targetUser.id ? { ...u, role: newRole } : u));
      toast.success(`${targetUser.name} is now ${newRole === 'admin' ? 'an Admin' : 'a regular User'}.`);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const handleStatusChange = async (userId, newStatus, reason) => {
    try {
      await adminService.changeUserStatus(userId, newStatus, reason);
      setData((list) =>
        list.map((u) =>
          u.id === userId
            ? { ...u, status: newStatus, statusReason: reason, statusUpdatedAt: new Date().toISOString() }
            : u
        )
      );
      toast.success(`User status updated to ${newStatus.toUpperCase()}.`);
      setStatusChanging(null);
      if (viewing && viewing.id === userId) {
        setViewing((prev) => ({ ...prev, status: newStatus, statusReason: reason }));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const totalUsers       = (data || []).filter((u) => u.role !== 'admin' && u.role !== 'superadmin').length;
  const totalAdmins      = (data || []).filter((u) => u.role === 'admin').length;
  const totalSuperAdmins = (data || []).filter((u) => u.role === 'superadmin').length;
  const totalTrusted     = (data || []).filter((u) => (u.status || 'trusted').toLowerCase() === 'trusted').length;
  const totalFlagged     = (data || []).filter((u) => (u.status || '').toLowerCase() === 'flagged').length;
  const totalRestricted  = (data || []).filter((u) => (u.status || '').toLowerCase() === 'restricted').length;
  const totalRevoked     = (data || []).filter((u) => (u.status || '').toLowerCase() === 'revoked').length;

  return (
    <>
      {/* Page Header */}
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>User Management</h1>
          <span className="muted-text">
            {totalUsers} user{totalUsers !== 1 ? 's' : ''} · {totalAdmins} admin{totalAdmins !== 1 ? 's' : ''} · {totalSuperAdmins} super admin{totalSuperAdmins !== 1 ? 's' : ''}
          </span>
        </div>
        {/* Activity Status KPI Quick Filter Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span
            onClick={() => setStatusFilter(statusFilter === 'trusted' ? '' : 'trusted')}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '5px 12px', borderRadius: 20,
              background: '#ecfdf5', color: '#047857', border: `1.5px solid ${statusFilter === 'trusted' ? '#047857' : '#a7f3d0'}`,
              fontWeight: statusFilter === 'trusted' ? 700 : 500,
            }}>
            <CheckCircle2 size={13} /> Trusted: {totalTrusted}
          </span>
          <span
            onClick={() => setStatusFilter(statusFilter === 'flagged' ? '' : 'flagged')}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '5px 12px', borderRadius: 20,
              background: '#fffbeb', color: '#b45309', border: `1.5px solid ${statusFilter === 'flagged' ? '#b45309' : '#fde68a'}`,
              fontWeight: statusFilter === 'flagged' ? 700 : 500,
            }}>
            <AlertTriangle size={13} /> Flagged: {totalFlagged}
          </span>
          <span
            onClick={() => setStatusFilter(statusFilter === 'restricted' ? '' : 'restricted')}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '5px 12px', borderRadius: 20,
              background: '#fff1f2', color: '#be123c', border: `1.5px solid ${statusFilter === 'restricted' ? '#be123c' : '#fecdd3'}`,
              fontWeight: statusFilter === 'restricted' ? 700 : 500,
            }}>
            <ShieldAlert size={13} /> Restricted: {totalRestricted}
          </span>
          <span
            onClick={() => setStatusFilter(statusFilter === 'revoked' ? '' : 'revoked')}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 12, padding: '5px 12px', borderRadius: 20,
              background: '#fee2e2', color: '#991b1b', border: `1.5px solid ${statusFilter === 'revoked' ? '#991b1b' : '#fca5a5'}`,
              fontWeight: statusFilter === 'revoked' ? 700 : 500,
            }}>
            <Ban size={13} /> Revoked: {totalRevoked}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="toolbar">
          <SearchBar value={q} onChange={(v) => { setQ(v); }} placeholder="Search name, email or phone" />
          <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Sign-up method">
            <option value="">All sign-up methods</option>
            <option value="email">Email</option>
            <option value="google">Google</option>
          </select>
          <select value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone status">
            <option value="">Any phone status</option>
            <option value="verified">Phone verified</option>
            <option value="unverified">Not verified</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Activity Status filter">
            <option value="">All activity statuses</option>
            <option value="trusted">🟢 Trusted (Normal)</option>
            <option value="flagged">🟡 Flagged (1st Warning)</option>
            <option value="restricted">🔴 Restricted (Suspended)</option>
            <option value="revoked">⛔ Revoked (Terminated)</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'users',       label: `👤 Users (${totalUsers})` },
          { key: 'admins',      label: `🛡️ Admins (${totalAdmins})` },
          { key: 'superadmins', label: `👑 Super Admins (${totalSuperAdmins})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '8px 20px', border: 0, background: 'none', cursor: 'pointer',
              fontWeight: tab === key ? 700 : 400,
              color: tab === key ? 'var(--accent)' : 'var(--muted)',
              borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2, fontSize: 14,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="card">
        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : (
          tab === 'superadmins'
            ? <UsersTable rows={superAdmins} isAdmin={true} isSuperAdmin={isSuperAdmin} currentUser={currentUser} sort={sort} toggleSort={toggleSort}
                onView={setViewing} onEdit={setEditing} onDelete={setDeleting} onRoleChange={(targetUser, newRole) => setRoleChanging({ user: targetUser, newRole })}
                onStatusChange={setStatusChanging} />
            : tab === 'admins'
            ? <UsersTable rows={admins} isAdmin={true} isSuperAdmin={isSuperAdmin} currentUser={currentUser} sort={sort} toggleSort={toggleSort}
                onView={setViewing} onEdit={setEditing} onDelete={setDeleting} onRoleChange={(targetUser, newRole) => setRoleChanging({ user: targetUser, newRole })}
                onStatusChange={setStatusChanging} />
            : <UsersTable rows={regularUsers} isAdmin={false} isSuperAdmin={isSuperAdmin} currentUser={currentUser} sort={sort} toggleSort={toggleSort}
                onView={setViewing} onEdit={setEditing} onDelete={setDeleting} onRoleChange={(targetUser, newRole) => setRoleChanging({ user: targetUser, newRole })}
                onStatusChange={setStatusChanging} />
        )}
      </div>

      {/* View Modal */}
      {viewing && (
        <Modal title="User Details" onClose={() => setViewing(null)}>
          <div className="cell-user big" style={{ marginBottom: 16 }}>
            {viewing.photo
              ? <img className="avatar" src={viewing.photo} alt="" />
              : <div className="avatar" style={viewing.role === 'superadmin' ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' } : {}}>{initials(viewing.name)}</div>}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{viewing.name}</strong>
                <UserStatusBadge status={viewing.status} onClick={() => { setViewing(null); setStatusChanging(viewing); }} />
              </div>
              <small>{viewing.email}</small>
              {viewing.role === 'superadmin' ? (
                <span className="chip" style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.3)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  👑 Super Admin
                </span>
              ) : viewing.role === 'admin' ? (
                <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={12} /> Admin
                </span>
              ) : null}
            </div>
          </div>
          <div className="kv-grid">
            <div className="kv">
              <span>Activity Status</span>
              <div>
                <UserStatusBadge status={viewing.status} onClick={() => { setViewing(null); setStatusChanging(viewing); }} />
              </div>
            </div>
            {(viewing.status || '').toLowerCase() !== 'trusted' && viewing.statusReason && (
              <div className="kv" style={{ gridColumn: 'span 2' }}>
                <span>Status Updated By / Notice</span>
                <strong style={{ color: viewing.status === 'revoked' ? 'var(--red)' : viewing.status === 'restricted' ? '#be123c' : 'var(--amber)' }}>
                  {viewing.statusReason}
                </strong>
              </div>
            )}
            <div className="kv"><span>Phone</span><strong>{viewing.phone || '—'}</strong></div>
            <div className="kv"><span>Phone verified</span><strong>{viewing.phoneVerified ? 'Yes' : 'No'}</strong></div>
            <div className="kv"><span>Sign-up method</span><strong>{viewing.provider}</strong></div>
            <div className="kv"><span>Registered</span><strong>{formatDate(viewing.createdAt)}</strong></div>
            {viewing.role !== 'admin' && viewing.role !== 'superadmin' && <div className="kv"><span>Listings</span><strong>{viewing.listings}</strong></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => { setViewing(null); setStatusChanging(viewing); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldAlert size={15} style={{ color: '#d97706' }} /> Change Status
            </button>
            {/* Regular admins cannot edit Super Admin accounts */}
            {(isSuperAdmin || viewing.role !== 'superadmin') && (
              <button className="btn btn-secondary" onClick={() => { setViewing(null); setEditing(viewing); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Pencil size={15} /> Edit this user
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Change Status Modal */}
      {statusChanging && (
        <ChangeStatusModal
          user={statusChanging}
          onSave={handleStatusChange}
          onClose={() => setStatusChanging(null)}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <EditUserModal user={editing} onSave={handleSaveUser} onClose={() => setEditing(null)} />
      )}

      {/* Role Change Confirmation Dialog */}
      {roleChanging && (
        <ConfirmDialog
          danger={roleChanging.newRole === 'user'}
          title={roleChanging.newRole === 'user' ? 'Demote Admin to User?' : 'Promote User to Admin?'}
          confirmLabel="Confirm"
          message={
            roleChanging.newRole === 'user'
              ? `Are you sure you want to change "${roleChanging.user.name}" from Admin to regular User? They will lose access to the admin dashboard.`
              : `Are you sure you want to promote "${roleChanging.user.name}" to Admin? They will be granted access to the admin dashboard.`
          }
          onConfirm={async () => {
            const { user: targetUser, newRole } = roleChanging;
            setRoleChanging(null);
            await handleRoleChange(targetUser, newRole);
          }}
          onClose={() => setRoleChanging(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleting && (
        <ConfirmDialog
          danger
          title={
            deleting.role === 'superadmin'
              ? 'Remove this Super Admin?'
              : deleting.role === 'admin'
              ? 'Remove this Admin?'
              : 'Remove this user?'
          }
          confirmLabel={
            deleting.role === 'superadmin'
              ? 'Remove Super Admin'
              : deleting.role === 'admin'
              ? 'Remove Admin'
              : 'Remove user'
          }
          message={`${deleting.name} (${deleting.email}) [${
            deleting.role === 'superadmin' ? 'Super Admin' : deleting.role === 'admin' ? 'Admin' : 'User'
          }] will be permanently removed.${
            deleting.listings ? ` They have ${deleting.listings} listing(s) which will also be deleted.` : ''
          }`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
