import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Archive, ArchiveRestore, Eye, LayoutGrid, List, Pencil, Plus, Trash2 } from 'lucide-react';
import SearchBar from '../components/SearchBar.jsx';
import Pagination from '../components/Pagination.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { Empty, ErrorState, Loading } from '../components/StateBlock.jsx';
import useData from '../hooks/useData.js';
import usePagination from '../hooks/usePagination.js';
import { adminService } from '../services/adminService.js';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { APPROVAL, AVAILABILITY, formatDate, shortId } from '../utils/format.js';

export const PROPERTY_TYPES = ['Apartment', 'Villa', 'Plot', 'Independent House'];

export default function Properties() {
  const toast = useToast();
  const { refreshPending } = useOutletContext();
  const { data, setData, loading, error, reload } = useData(() => adminService.listProperties());
  const [q, setQ] = useState('');
  const [ownerQ, setOwnerQ] = useState('');
  const [type, setType] = useState('');
  const [approval, setApproval] = useState('');
  const [avail, setAvail] = useState('');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('table');
  const [deleting, setDeleting] = useState(null);

  const rows = useMemo(() => {
    const term  = q.trim().toLowerCase();
    const owner = ownerQ.trim().toLowerCase();
    const list = (data || []).filter((p) =>
      (!term  || [p.title, p.id, shortId(p.id), p.location, p.city].some((v) => (v || '').toLowerCase().includes(term))) &&
      (!owner || [p.ownerName, p.ownerEmail].some((v) => (v || '').toLowerCase().includes(owner))) &&
      (!type || p.propertyType === type) && (!approval || p.approvalStatus === approval) && (!avail || p.status === avail));
    const by = {
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      priceHigh: (a, b) => (b.priceRaw || 0) - (a.priceRaw || 0),
      priceLow: (a, b) => (a.priceRaw || 0) - (b.priceRaw || 0),
    };
    return list.sort(by[sort]);
  }, [data, q, ownerQ, type, approval, avail, sort]);

  const pg = usePagination(rows, view === 'grid' ? 9 : 8);
  const reset = (setter) => (e) => { setter(e.target.value); pg.setPage(1); };

  const toggleArchive = async (p) => {
    const next = p.status === 'inactive' ? 'active' : 'inactive';
    try {
      const updated = await adminService.updateProperty(p.id, { status: next });
      setData((list) => list.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
      toast.success(next === 'inactive' ? 'Property archived.' : 'Property restored.');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const confirmDelete = async () => {
    try {
      await adminService.deleteProperty(deleting.id);
      setData((list) => list.filter((x) => x.id !== deleting.id));
      toast.success('Property deleted.');
      setDeleting(null);
      refreshPending();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const Actions = ({ p }) => (
    <div className="actions">
      <Link className="icon-btn" title="View" to={`/properties/${p.id}`}><Eye size={17} /></Link>
      <Link className="icon-btn" title="Edit" to={`/properties/${p.id}/edit`}><Pencil size={17} /></Link>
      <button className="icon-btn" title={p.status === 'inactive' ? 'Restore' : 'Archive'} onClick={() => toggleArchive(p)}>
        {p.status === 'inactive' ? <ArchiveRestore size={17} /> : <Archive size={17} />}
      </button>
      <button className="icon-btn danger" title="Delete" onClick={() => setDeleting(p)}><Trash2 size={17} /></button>
    </div>
  );
  const Thumb = ({ p }) => <img className="thumb-img" src={p.image || p.images[0]} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;

  return (
    <>
      <div className="page-head">
        <h1>Property Management</h1>
        <Link to="/properties/new" className="btn btn-primary"><Plus size={16} /> Add property</Link>
      </div>
      <div className="card">
        <div className="toolbar">
          <SearchBar value={q} onChange={(v) => { setQ(v); pg.setPage(1); }} placeholder="Search title, ID or location" />
          <SearchBar value={ownerQ} onChange={(v) => { setOwnerQ(v); pg.setPage(1); }} placeholder="Search owner name or email" />
          <select value={type} onChange={reset(setType)} aria-label="Property type"><option value="">All types</option>{PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <select value={approval} onChange={reset(setApproval)} aria-label="Approval status"><option value="">Any approval</option>{Object.entries(APPROVAL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select value={avail} onChange={reset(setAvail)} aria-label="Availability"><option value="">Any availability</option>{Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select value={sort} onChange={reset(setSort)} aria-label="Sort">
            <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            <option value="priceHigh">Price: high to low</option><option value="priceLow">Price: low to high</option>
          </select>
          <div className="seg">
            <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')} aria-label="Table view"><List size={16} /></button>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view"><LayoutGrid size={16} /></button>
          </div>
        </div>

        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : rows.length === 0 ? <Empty text="No properties match your filters." /> : view === 'table' ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Property</th><th>Type</th><th>Price</th><th>Owner</th><th>Listed</th><th>Approval</th><th>Availability</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {pg.pageItems.map((p) => (
                  <tr key={p.id}>
                    <td><div className="cell-user"><Thumb p={p} /><div><Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link><small>#{shortId(p.id)} · {p.location}</small></div></div></td>
                    <td>{p.propertyType}<small>{p.listingType}</small></td>
                    <td><strong>{p.price}</strong></td>
                    <td>{p.ownerName}<small>{p.ownerEmail}</small></td>
                    <td>{formatDate(p.createdAt)}</td>
                    <td><StatusBadge map={APPROVAL} value={p.approvalStatus} /></td>
                    <td><StatusBadge map={AVAILABILITY} value={p.status} /></td>
                    <td className="right"><Actions p={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid-cards">
            {pg.pageItems.map((p) => (
              <div className="prop-card" key={p.id}>
                <div className="prop-img"><Thumb p={p} /><div className="prop-badges"><StatusBadge map={APPROVAL} value={p.approvalStatus} /><StatusBadge map={AVAILABILITY} value={p.status} /></div></div>
                <div className="prop-body">
                  <Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link>
                  <div className="price">{p.price}</div>
                  <small className="muted-text">{p.location} · {p.propertyType}</small>
                  <small className="muted-text">{p.ownerName} · {formatDate(p.createdAt)}</small>
                  <Actions p={p} />
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination {...pg} onPage={pg.setPage} />
      </div>

      {deleting && (
        <ConfirmDialog danger title="Delete this property?" confirmLabel="Delete property"
          message={`“${deleting.title}” will be permanently deleted. If you only want to hide it, archive it instead.`}
          onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
      )}
    </>
  );
}
