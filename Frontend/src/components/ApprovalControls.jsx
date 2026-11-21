import { useState } from 'react';
import { Check, X, Crown, CheckCheck, RotateCcw } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog.jsx';
import Modal from './Modal.jsx';
import { adminService } from '../services/adminService.js';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ApprovalControls({ property, onChanged, size }) {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();
  const [mode, setMode] = useState(null); // 'admin_verify' | 'super_approve' | 'reject' | 'undo'
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sm = size === 'sm' ? 'btn-sm' : '';

  const close = () => { setMode(null); setRemarks(''); setError(''); };

  // Regular admin verify -> moves to 'admin_approved'
  const handleAdminVerify = async () => {
    try {
      const updated = await adminService.setApproval(property.id, 'approve', '', 'admin_approved');
      toast.success('Property verified and forwarded to Super Admin.');
      close();
      onChanged?.(updated);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // Super admin approve -> publishes LIVE ('approved')
  const handleSuperApprove = async () => {
    try {
      const updated = await adminService.setApproval(property.id, 'approve', '', 'approved');
      toast.success('Property approved! It is now LIVE on the mobile app.');
      close();
      onChanged?.(updated);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // Undo approval / verification / rejection -> moves back to 'pending'
  const handleUndo = async () => {
    try {
      const updated = await adminService.setApproval(property.id, 'undo');
      toast.success('Property status undone! Returned to Pending Review.');
      close();
      onChanged?.(updated);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const handleReject = async () => {
    if (!remarks.trim()) {
      setError('Please add remarks so the owner knows why.');
      return;
    }
    setBusy(true);
    try {
      const updated = await adminService.setApproval(property.id, 'reject', remarks.trim());
      toast.success('Property rejected.');
      close();
      onChanged?.(updated);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* ── Pending (New user submission) ── */}
      {property.approvalStatus === 'pending' && (
        <>
          {isSuperAdmin ? (
            <button className={`btn btn-success ${sm}`} onClick={() => setMode('super_approve')}>
              <Crown size={15} /> Approve & Publish
            </button>
          ) : (
            <button className={`btn btn-success ${sm}`} onClick={() => setMode('admin_verify')}>
              <Check size={15} /> Verify & Send to Super Admin
            </button>
          )}
        </>
      )}

      {/* ── Admin Approved (Waiting Super Admin) ── */}
      {property.approvalStatus === 'admin_approved' && (
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {isSuperAdmin ? (
            <button className={`btn btn-success ${sm}`} onClick={() => setMode('super_approve')}>
              <CheckCheck size={15} /> Approve & Publish Live
            </button>
          ) : (
            <span
              className="chip"
              style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid rgba(13, 95, 78, 0.25)', fontWeight: 600 }}
              title="Admin verified — waiting for Super Admin to publish"
            >
              ✓ Sent to Super Admin
            </span>
          )}
          <button
            type="button"
            className={`btn btn-secondary ${sm}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={() => setMode('undo')}
            title="Undo admin verification and move back to Pending"
          >
            <RotateCcw size={14} /> Undo Verification
          </button>
        </div>
      )}

      {/* ── Approved (Live on mobile app) ── */}
      {property.approvalStatus === 'approved' && (
        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-secondary ${sm}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
            onClick={() => setMode('undo')}
            title="Undo approval, unpublish from mobile app, and return to Pending Review"
          >
            <RotateCcw size={14} /> Undo Approval
          </button>
        </div>
      )}

      {/* ── Rejected ── */}
      {property.approvalStatus === 'rejected' && (
        <button
          type="button"
          className={`btn btn-secondary ${sm}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          onClick={() => setMode('undo')}
          title="Undo rejection and return to Pending Review"
        >
          <RotateCcw size={14} /> Undo Rejection
        </button>
      )}

      {/* ── Reject Button (Available when not already rejected and not live approved) ── */}
      {property.approvalStatus !== 'rejected' && property.approvalStatus !== 'approved' && (
        <button className={`btn btn-danger-outline ${sm}`} onClick={() => setMode('reject')}>
          <X size={15} /> Reject
        </button>
      )}

      {/* Admin Verify Confirmation */}
      {mode === 'admin_verify' && (
        <ConfirmDialog
          title="Verify property for Super Admin?"
          message={`“${property.title}” will be marked as verified and forwarded to Super Admin for final publishing.`}
          confirmLabel="Verify & Forward"
          onConfirm={handleAdminVerify}
          onClose={close}
        />
      )}

      {/* Super Admin Publish Confirmation */}
      {mode === 'super_approve' && (
        <ConfirmDialog
          title="Publish property live?"
          message={`“${property.title}” will be approved and become immediately visible to all buyers on the mobile app.`}
          confirmLabel="Approve & Publish Live"
          onConfirm={handleSuperApprove}
          onClose={close}
        />
      )}

      {/* Undo Confirmation */}
      {mode === 'undo' && (
        <ConfirmDialog
          title={
            property.approvalStatus === 'approved'
              ? 'Undo Property Approval?'
              : property.approvalStatus === 'admin_approved'
              ? 'Undo Admin Verification?'
              : 'Undo Property Rejection?'
          }
          message={
            property.approvalStatus === 'approved'
              ? `“${property.title}” will be unpublished from the mobile app immediately and moved back to Pending Review.`
              : `“${property.title}” will be moved back to Pending Review for re-evaluation.`
          }
          confirmLabel="Yes, Undo Status"
          onConfirm={handleUndo}
          onClose={close}
        />
      )}

      {/* Reject Modal */}
      {mode === 'reject' && (
        <Modal
          title="Reject property"
          onClose={close}
          footer={
            <>
              <button className="btn" onClick={close} disabled={busy}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={busy}>
                {busy ? 'Please wait…' : 'Reject property'}
              </button>
            </>
          }
        >
          <p className="muted-text">“{property.title}” will stay hidden from the app.</p>
          <label className="field">
            <span>Rejection remarks *</span>
            <textarea
              rows={4}
              value={remarks}
              onChange={(e) => { setRemarks(e.target.value); setError(''); }}
              placeholder="e.g. Photos are unclear, price looks incorrect…"
            />
            {error && <small className="field-error">{error}</small>}
          </label>
        </Modal>
      )}
    </>
  );
}
