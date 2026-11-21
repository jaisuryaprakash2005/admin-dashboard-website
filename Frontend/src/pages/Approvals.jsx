import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Eye, Pencil } from 'lucide-react';
import ApprovalControls from '../components/ApprovalControls.jsx';
import Modal from '../components/Modal.jsx';
import PropertyDetailView from '../components/PropertyDetailView.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { Empty, ErrorState, Loading } from '../components/StateBlock.jsx';
import useData from '../hooks/useData.js';
import { adminService } from '../services/adminService.js';
import { APPROVAL, formatDate } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';

const TABS = ['pending', 'admin_approved', 'approved', 'rejected'];

const FIELD_LABELS = {
  title: 'Title',
  price: 'Price',
  priceAmount: 'Price',
  maintenanceCharge: 'Maintenance',
  address: 'Address',
  city: 'City',
  locality: 'Locality',
  postalCode: 'PIN Code',
  description: 'Description',
  bedroom: 'Bedrooms',
  bathroom: 'Bathrooms',
  balconies: 'Balconies',
  doorFacing: 'Facing',
  furnishingStatus: 'Furnishing',
  propertyAge: 'Property Age',
  totalFloors: 'Total Floors',
  selectedFloor: 'Floor',
  status: 'Availability Status',
  propertyType: 'Property Type',
  listingType: 'Listing Type',
  propertyStatus: 'Construction Status',
  plotType: 'Plot Type',
  plotSize: 'Plot Size',
  customPlotSize: 'Custom Plot Size',
  roadFacing: 'Road Facing',
  plotDimension: 'Plot Dimension',
  plotDimensionUnit: 'Dimension Unit',
};
const formatFieldName = (key) => FIELD_LABELS[key] || key;

export default function Approvals() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { refreshPending } = useOutletContext();
  const { data, setData, loading, error, reload } = useData(() => adminService.listProperties());
  const [tab, setTab] = useState(isSuperAdmin ? 'admin_approved' : 'pending');
  const [reviewing, setReviewing] = useState(null);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t, (data || []).filter((p) => p.approvalStatus === t).length])),
    [data]
  );
  const rows = useMemo(
    () => (data || []).filter((p) => p.approvalStatus === tab).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [data, tab]
  );

  const changed = (updated) => {
    setData((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setReviewing(null);
    refreshPending();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Property Approvals</h1>
          {isSuperAdmin && (
            <small style={{ color: 'var(--muted)', marginTop: 2 }}>
              Super Admin view: Approve properties to publish them live to the mobile app.
            </small>
          )}
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {APPROVAL[t]?.label || t} <span className="tab-count">{counts[t]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty
            text={
              tab === 'pending'
                ? 'No properties are waiting for admin review.'
                : tab === 'admin_approved'
                ? 'No properties are waiting for Super Admin approval.'
                : `No ${APPROVAL[tab]?.label || tab} properties.`
            }
          />
        </div>
      ) : (
        <div className="approval-list">
          {rows.map((p) => (
            <div className="card approval-item" key={p.id}>
              <img
                className="approval-img"
                src={p.image || (p.images && p.images[0])}
                alt=""
                style={{ cursor: 'pointer' }}
                title="Click to view details and photos"
                onClick={() => setReviewing(p)}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              <div className="approval-info">
                <div className="badges">
                  <StatusBadge map={APPROVAL} value={p.approvalStatus} />
                  <span className="chip">{p.propertyType}</span>
                  <span className="chip">{p.listingType}</span>
                </div>
                <strong>{p.title}</strong>
                <div className="price">{p.price}</div>
                <small className="muted-text">
                  {p.location} · Submitted by {p.ownerName || 'Unknown'} on {formatDate(p.createdAt)}
                </small>
                {p.adminApprovedAt && (
                  <small style={{ color: 'var(--green)', fontWeight: 500 }}>
                    ✓ Verified by <strong>{p.adminApprovedByName || 'Admin'}</strong> on {formatDate(p.adminApprovedAt)}
                  </small>
                )}
                {p.superAdminApprovedAt && (
                  <small style={{ color: 'var(--purple)', fontWeight: 500 }}>
                    👑 Published live by <strong>{p.superAdminApprovedByName || 'Super Admin'}</strong> on {formatDate(p.superAdminApprovedAt)}
                  </small>
                )}
                {p.editedFields && p.editedFields.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="changed-chip">
                      ✏️ User modified: {p.editedFields.map(formatFieldName).join(', ')}
                    </span>
                  </div>
                )}
                {p.approvalStatus === 'rejected' && p.rejectionReason && (
                  <small className="remark">
                    Remarks ({p.rejectedBy || 'reviewer'}): {p.rejectionReason}
                  </small>
                )}
              </div>
              <div className="approval-actions">
                <button className="btn" onClick={() => navigate(`/properties/${p.id}/edit`)}>
                  <Pencil size={15} /> Review & Edit
                </button>
                <ApprovalControls property={p} onChanged={changed} />
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <Modal
          wide
          title="Review property"
          onClose={() => setReviewing(null)}
          footer={<ApprovalControls property={reviewing} onChanged={changed} />}
        >
          <PropertyDetailView p={reviewing} />
        </Modal>
      )}
    </>
  );
}
