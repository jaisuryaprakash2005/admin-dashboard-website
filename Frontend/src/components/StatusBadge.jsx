export default function StatusBadge({ map, value }) {
  const s = map[value] || { label: value || '—', tone: 'grey' };
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}
