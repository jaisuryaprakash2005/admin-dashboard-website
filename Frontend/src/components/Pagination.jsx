import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, total, pageSize, onPage }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span className="muted-text">Showing {from}–{to} of {total}</span>
      <div className="pager">
        <button className="btn btn-sm" onClick={() => onPage(page - 1)} disabled={page <= 1}><ChevronLeft size={16} /></button>
        <span>Page {page} / {totalPages}</span>
        <button className="btn btn-sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
