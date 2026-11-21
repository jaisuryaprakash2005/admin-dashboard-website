import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArchiveRestore, Eye, Trash2, Search, X } from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, ErrorState, Loading } from '../components/StateBlock.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useData from '../hooks/useData.js';
import usePagination from '../hooks/usePagination.js';
import { adminService } from '../services/adminService.js';
import { errorMessage } from '../services/api.js';
import { formatDate, shortId } from '../utils/format.js';

export default function Archive() {
  const toast = useToast();
  const { data, setData, loading, error, reload } = useData(() =>
    adminService.listArchivedProperties()
  );
  const [q, setQ] = useState('');
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const filtered = (data || []).filter((p) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return [p.title, shortId(p.id), p.location, p.city, p.ownerName]
      .some((v) => (v || '').toLowerCase().includes(term));
  });

  const pg = usePagination(filtered, 10);

  // ── Restore (unarchive) ──────────────────────────────────────────────────────
  const confirmRestore = async () => {
    const p = restoring;
    setRestoring(null);
    try {
      await adminService.updateProperty(p.id, { status: 'active' });
      setData((list) => list.filter((x) => x.id !== p.id));
      toast.success(`"${p.title}" has been restored and is now active.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // ── Permanent delete ─────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    const p = deleting;
    setDeleting(null);
    try {
      await adminService.deleteProperty(p.id);
      setData((list) => list.filter((x) => x.id !== p.id));
      toast.success(`"${p.title}" has been permanently deleted.`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <h1>Archived Properties</h1>
          <small style={{ marginTop: 2 }}>
            Properties hidden from the public app. Restore them to make them live again.
          </small>
        </div>
      </div>

      <div className="card">
        {/* ── Search bar ──────────────────────────────────────────────── */}
        <div className="toolbar" style={{ marginBottom: 14 }}>
          <div className="search" style={{ flex: 1, maxWidth: 400 }}>
            <Search size={16} />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); pg.setPage(1); }}
              placeholder="Search title, ID, location or owner…"
            />
            {q && (
              <button className="icon-btn" onClick={() => setQ('')} title="Clear">
                <X size={14} />
              </button>
            )}
          </div>
          <span className="muted-text" style={{ marginLeft: 'auto', fontSize: 13 }}>
            {loading ? '…' : `${filtered.length} archived propert${filtered.length !== 1 ? 'ies' : 'y'}`}
          </span>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <Empty text={q ? 'No archived properties match your search.' : 'No archived properties. Use the Archive button on a property to hide it from the app.'} />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Property</th>
                    <th>Owner</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Archived on</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <img
                          className="thumb-img"
                          src={p.image || (p.images && p.images[0])}
                          alt=""
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.title}</div>
                        <small style={{ color: 'var(--muted)' }}>
                          #{shortId(p.id)} · {p.location || p.city || '—'}
                        </small>
                      </td>
                      <td>
                        <div>{p.ownerName || '—'}</div>
                        <small>{p.ownerEmail || ''}</small>
                      </td>
                      <td>
                        <span className="chip">{p.propertyType || '—'}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-dark)' }}>
                        {p.price || '—'}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                        {formatDate(p.updatedAt || p.createdAt)}
                      </td>
                      <td>
                        <div className="actions">
                          <Link className="icon-btn" title="View" to={`/properties/${p.id}`}>
                            <Eye size={17} />
                          </Link>
                          <button
                            className="icon-btn"
                            title="Restore property"
                            onClick={() => setRestoring(p)}
                            style={{ color: 'var(--green)' }}
                          >
                            <ArchiveRestore size={17} />
                          </button>
                          <button
                            className="icon-btn danger"
                            title="Permanently delete"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ────────────────────────────────────────────── */}
            {pg.totalPages > 1 && (
              <div className="pagination">
                <span className="muted-text" style={{ fontSize: 13 }}>
                  Page {pg.page} of {pg.totalPages}
                </span>
                <div className="pager">
                  <button className="btn btn-sm" disabled={pg.page === 1} onClick={() => pg.setPage(pg.page - 1)}>
                    ← Prev
                  </button>
                  <button className="btn btn-sm" disabled={pg.page === pg.totalPages} onClick={() => pg.setPage(pg.page + 1)}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Restore confirmation dialog ──────────────────────────────── */}
      {restoring && (
        <ConfirmDialog
          title="Restore this property?"
          message={`"${restoring.title}" will be made active again and visible to buyers on the app.`}
          confirmLabel="Restore"
          onConfirm={confirmRestore}
          onClose={() => setRestoring(null)}
        />
      )}

      {/* ── Delete confirmation dialog ───────────────────────────────── */}
      {deleting && (
        <ConfirmDialog
          danger
          title="Permanently delete this property?"
          message={`"${deleting.title}" will be permanently removed and cannot be recovered.`}
          confirmLabel="Delete permanently"
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
