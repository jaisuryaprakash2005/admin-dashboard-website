import { useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import PropertyDetailView from '../components/PropertyDetailView.jsx';
import ApprovalControls from '../components/ApprovalControls.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { ErrorState, Loading } from '../components/StateBlock.jsx';
import useData from '../hooks/useData.js';
import { adminService } from '../services/adminService.js';
import { errorMessage } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshPending } = useOutletContext();
  const { data, setData, loading, error, reload } = useData(() => adminService.getProperty(id));
  const [deleting, setDeleting] = useState(false);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const remove = async () => {
    try {
      await adminService.deleteProperty(id);
      toast.success('Property deleted.');
      refreshPending();
      navigate('/properties');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <div className="page-head">
        <Link to="/properties" className="btn btn-sm"><ArrowLeft size={15} /> Back</Link>
        <div className="head-actions">
          <ApprovalControls property={data} onChanged={(u) => { setData((p) => ({ ...p, ...u })); refreshPending(); }} />
          <Link className="btn" to={`/properties/${id}/edit`}><Pencil size={15} /> Edit</Link>
          <button className="btn btn-danger-outline" onClick={() => setDeleting(true)}><Trash2 size={15} /> Delete</button>
        </div>
      </div>
      <div className="card"><PropertyDetailView p={data} /></div>
      {deleting && (
        <ConfirmDialog danger title="Delete this property?" confirmLabel="Delete property"
          message={`“${data.title}” will be permanently deleted.`} onConfirm={remove} onClose={() => setDeleting(false)} />
      )}
    </>
  );
}
