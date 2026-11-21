import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

export function Loading({ text = 'Loading…' }) {
  return <div className="state"><Loader2 className="spin" size={22} /><span>{text}</span></div>;
}
export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error">
      <AlertCircle size={22} /><span>{message}</span>
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
export function Empty({ text = 'Nothing to show.' }) {
  return <div className="state"><Inbox size={22} /><span>{text}</span></div>;
}
