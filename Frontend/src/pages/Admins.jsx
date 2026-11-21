import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, EyeOff, ShieldAlert, ShieldCheck } from 'lucide-react';
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

function AdminForm({ admin, onSave, onClose }) {
  const toast = useToast();
  const isEdit = !!admin;
  const [name, setName] = useState(admin?.name || '');
  const [email, setEmail] = useState(admin?.email || '');
  const [phone, setPhone] = useState(admin?.phone || '');
  const [role, setRole] = useState(admin?.role || 'admin');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required.');
    if (!isEdit && !email.trim()) return toast.error('Email is required.');
    if (!isEdit && !password) return toast.error('Password is required for new account.');
    if (password && password.length < 6) return toast.error('Password must be at least 6 characters.');
    setSaving(true);
    try {
      const updates = { name: name.trim(), phone: phone.trim(), role };
      if (!isEdit) {
        updates.email = email.trim();
        updates.password = password;
      } else if (password) {
        updates.password = password;
      }
      await onSave(updates);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Edit Staff — ${admin.name}` : `Add New ${role === 'superadmin' ? 'Super Admin' : 'Admin'}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Account Role *</span>
          <select
            className="field"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
          >
            <option value="admin">🛡️ Admin — Listing review, approvals & properties</option>
            <option value="superadmin">👑 Super Admin — Full system access & admin management</option>
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Full Name *</span>
          <input
            className="field"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
          />
        </label>
        {!isEdit && (
          <label style={{ display: 'block', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Email *</span>
            <input
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@probridge.com"
              required
            />
          </label>
        )}
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone</span>
          <input
            className="field"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="10-digit mobile number"
            maxLength={10}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            {isEdit ? 'New Password' : 'Password *'}{' '}
            {isEdit && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(leave blank to keep current)</span>}
          </span>
          <div style={{ position: 'relative' }}>
            <input
              className="field"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              className="icon-btn"
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setShowPw((s) => !s)}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Create ${role === 'superadmin' ? 'Super Admin' : 'Admin'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Admins() {
  const toast = useToast();
  const { isSuperAdmin, user: currentUser } = useAuth();
  const { data, setData, loading, error, reload } = useData(() => adminService.listAdmins());
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [demoting, setDemoting] = useState(null);
  const [deleting, setDeleting] = useState(null);

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || []).filter((a) => {
      if (roleFilter !== 'all' && a.role !== roleFilter) return false;
      if (!term) return true;
      return [a.name, a.email, a.phone, a.role].some((v) => (v || '').toLowerCase().includes(term));
    });
  }, [data, q, roleFilter]);

  const totalSuperAdmins = useMemo(() => (data || []).filter((a) => a.role === 'superadmin').length, [data]);
  const totalAdmins = useMemo(() => (data || []).filter((a) => a.role === 'admin').length, [data]);

  const pg = usePagination(filtered, 10);

  const handleCreate = async (updates) => {
    const created = await adminService.createAdmin(updates);
    setData((list) => [created, ...(list || [])]);
    toast.success(`${created.role === 'superadmin' ? 'Super Admin' : 'Admin'} account created successfully.`);
    setCreating(false);
  };

  const handleEdit = async (updates) => {
    const updated = await adminService.updateAdmin(editing.id, updates);
    setData((list) => list.map((a) => (a.id === editing.id ? { ...a, ...updated } : a)));
    toast.success('Staff details updated.');
    setEditing(null);
  };

  const confirmDemote = async () => {
    try {
      await adminService.deleteAdmin(demoting.id, false);
      setData((list) => list.filter((a) => a.id !== demoting.id));
      toast.success(`${demoting.name} has been demoted to a regular user.`);
      setDemoting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const confirmDelete = async () => {
    try {
      await adminService.deleteAdmin(deleting.id, true);
      setData((list) => list.filter((a) => a.id !== deleting.id));
      toast.success(`${deleting.name} has been permanently deleted.`);
      setDeleting(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin & Super Admin Management</h1>
          <small style={{ color: 'var(--muted)', marginTop: 2 }}>
            Manage staff accounts with Admin and Super Admin access.
          </small>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Add Admin / Super Admin
        </button>
      </div>

      {/* Role Filter Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '2px solid var(--border)' }}>
        {[
          { key: 'all', label: `All Staff (${(data || []).length})` },
          { key: 'superadmin', label: `👑 Super Admins (${totalSuperAdmins})` },
          { key: 'admin', label: `🛡️ Admins (${totalAdmins})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setRoleFilter(key); pg.setPage(1); }}
            style={{
              padding: '8px 20px',
              border: 0,
              background: 'none',
              cursor: 'pointer',
              fontWeight: roleFilter === key ? 700 : 400,
              color: roleFilter === key ? 'var(--accent)' : 'var(--muted)',
              borderBottom: roleFilter === key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
              fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="toolbar">
          <SearchBar value={q} onChange={(v) => { setQ(v); pg.setPage(1); }} placeholder="Search name, email or phone" />
          <span className="muted-text" style={{ marginLeft: 'auto', fontSize: 13 }}>
            {loading ? '…' : `${filtered.length} account${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <Empty text="No staff accounts found." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Created</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.map((a) => {
                    // Match by id (string-compare both), then fall back to email
                    const selfById =
                      a.id != null &&
                      currentUser?.id != null &&
                      String(a.id) === String(currentUser.id);
                    const selfByEmail =
                      a.email &&
                      currentUser?.email &&
                      a.email.toLowerCase() === currentUser.email.toLowerCase();
                    const isSelf = selfById || selfByEmail;
                    const isSuper = a.role === 'superadmin';
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="cell-user">
                            <div
                              className="avatar"
                              style={isSuper ? { background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: '#fff' } : {}}
                            >
                              {initials(a.name)}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong>{a.name}</strong>
                                {isSelf && (
                                  <span style={{ fontSize: 11, background: 'var(--grey-soft)', color: 'var(--muted)', padding: '1px 6px', borderRadius: 4 }}>
                                    (You)
                                  </span>
                                )}
                              </div>
                              <small>{a.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {isSuper ? (
                            <span
                              className="chip"
                              style={{
                                background: 'rgba(124, 58, 237, 0.12)',
                                color: '#7c3aed',
                                border: '1px solid rgba(124, 58, 237, 0.3)',
                                fontSize: 11,
                                padding: '2px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 600,
                              }}
                            >
                              👑 Super Admin
                            </span>
                          ) : (
                            <span
                              className="chip"
                              style={{
                                background: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                border: '1px solid rgba(43, 90, 237, 0.25)',
                                fontSize: 11,
                                padding: '2px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 600,
                              }}
                            >
                              <ShieldCheck size={12} /> Admin
                            </span>
                          )}
                        </td>
                        <td>{a.phone || <span className="muted-text">—</span>}</td>
                        <td className="muted-text">{formatDate(a.createdAt)}</td>
                        <td className="right">
                          <div className="actions">
                            {/* Regular admins cannot edit Super Admin accounts */}
                            {(!isSuper || isSuperAdmin) && (
                              <button className="icon-btn" title="Edit details" onClick={() => setEditing(a)}>
                                <Pencil size={17} />
                              </button>
                            )}
                            {/* Hide Demote & Delete for the currently logged-in account */}
                            {!isSelf && (
                              <>
                                <button
                                  className="icon-btn"
                                  title="Demote to regular user"
                                  style={{ color: 'var(--amber)' }}
                                  onClick={() => setDemoting(a)}
                                >
                                  <ShieldAlert size={17} />
                                </button>
                                <button
                                  className="icon-btn danger"
                                  title="Delete permanently"
                                  onClick={() => setDeleting(a)}
                                >
                                  <Trash2 size={17} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pg} onPage={pg.setPage} />
          </>
        )}
      </div>

      {creating && <AdminForm onSave={handleCreate} onClose={() => setCreating(false)} />}
      {editing && <AdminForm admin={editing} onSave={handleEdit} onClose={() => setEditing(null)} />}

      {demoting && (
        <ConfirmDialog
          title="Demote to regular user?"
          message={`“${demoting.name}” will lose access to the admin dashboard and become a regular app user.`}
          confirmLabel="Demote to User"
          onConfirm={confirmDemote}
          onClose={() => setDemoting(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          danger
          title="Permanently delete admin?"
          message={`“${deleting.name}” (${deleting.email}) will be permanently removed.`}
          confirmLabel="Delete permanently"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

