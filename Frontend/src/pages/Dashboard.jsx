import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users as UsersIcon, UserPlus, PhoneCall, Building2, CheckCircle2, Clock, Tag, XCircle, Crown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { ErrorState, Loading } from '../components/StateBlock.jsx';
import useData from '../hooks/useData.js';
import { adminService } from '../services/adminService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { APPROVAL, AVAILABILITY, formatDate, initials, lastMonths, monthKey } from '../utils/format.js';

const COLORS = ['#0D5F4E', '#10B981', '#C28916', '#6366F1', '#94A3B8'];

export default function Dashboard() {
  const { isSuperAdmin } = useAuth();
  const { data, loading, error, reload } = useData(async () => {
    const [users, properties] = await Promise.all([adminService.listUsers(), adminService.listProperties()]);
    return { users, properties };
  });

  const m = useMemo(() => {
    if (!data) return null;
    const { users, properties } = data;
    const months = lastMonths(6);
    const count = (list) => months.map((mo) => ({ month: mo.label, count: list.filter((x) => monthKey(x.createdAt) === mo.key).length }));
    const by = (key) => Object.entries(properties.reduce((a, p) => ({ ...a, [p[key] || 'Other']: (a[p[key] || 'Other'] || 0) + 1 }), {}))
      .map(([name, value]) => ({ name, value }));
    const monthAgo = Date.now() - 30 * 86400000;
    return {
      users, properties,
      newUsers: users.filter((u) => new Date(u.createdAt) > monthAgo).length,
      verified: users.filter((u) => u.phoneVerified).length,
      pending: properties.filter((p) => p.approvalStatus === 'pending'),
      adminApproved: properties.filter((p) => p.approvalStatus === 'admin_approved'),
      approved: properties.filter((p) => p.approvalStatus === 'approved').length,
      rejected: properties.filter((p) => p.approvalStatus === 'rejected').length,
      closed: properties.filter((p) => p.status === 'sold' || p.status === 'rented').length,
      userTrend: count(users), propTrend: count(properties),
      byStatus: by('status').map((d) => ({ ...d, name: AVAILABILITY[d.name]?.label || d.name })),
      byType: by('propertyType'),
      recentUsers: [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
      recentProps: [...properties].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5),
    };
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head"><h1>Dashboard</h1></div>

      <h2 className="section-title">Users</h2>
      <div className="grid-stats">
        <StatCard icon={UsersIcon} label="Total users" value={m.users.length} />
        <StatCard icon={UserPlus} label="New in last 30 days" value={m.newUsers} tone="green" />
        <StatCard icon={PhoneCall} label="Phone verified" value={m.verified} hint={`${m.users.length - m.verified} not verified`} tone="purple" />
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>New registrations (6 months)</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.userTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip />
                <Line type="monotone" dataKey="count" name="Users" stroke="#0D5F4E" strokeWidth={2.5} dot={{ r: 4, fill: '#0D5F4E' }} activeDot={{ r: 6 }} /></LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Recent users</h3><Link to="/users">View all</Link></div>
          <table className="table compact"><tbody>
            {m.recentUsers.map((u) => (
              <tr key={u.id}>
                <td><div className="cell-user"><div className="avatar sm">{initials(u.name)}</div><div><strong>{u.name}</strong><small>{u.email}</small></div></div></td>
                <td className="right muted-text">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>

      <h2 className="section-title">Properties</h2>
      <div className="grid-stats">
        <StatCard icon={Building2} label="Total properties" value={m.properties.length} />
        <StatCard icon={Clock} label="Pending Admin Review" value={m.pending.length} tone="amber" />
        {isSuperAdmin && (
          <StatCard
            icon={Crown}
            label="Pending Super Admin"
            value={m.adminApproved.length}
            tone="purple"
            hint="Awaiting final publish"
          />
        )}
        <StatCard icon={CheckCircle2} label="Live & Published" value={m.approved} tone="green" />
        <StatCard icon={XCircle} label="Rejected" value={m.rejected} tone="red" />
        <StatCard icon={Tag} label="Sold / rented" value={m.closed} tone="purple" />
      </div>
      <div className="grid-3">
        <div className="card">
          <h3>New listings (6 months)</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.propTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="count" name="Listings" fill="#0D5F4E" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Availability</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={m.byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {m.byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>By property type</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.byType} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} /><Tooltip /><Bar dataKey="value" name="Properties" fill="#0ea5e9" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>{isSuperAdmin ? 'Waiting for Super Admin approval' : 'Waiting for your approval'}</h3>
            <Link to="/approvals">Open approvals</Link>
          </div>
          {((isSuperAdmin ? m.adminApproved : m.pending).length === 0) ? (
            <p className="muted-text">
              {isSuperAdmin ? 'All caught up. No properties waiting for Super Admin approval.' : 'All caught up. No pending properties.'}
            </p>
          ) : (
            <table className="table compact"><tbody>
              {(isSuperAdmin ? m.adminApproved : m.pending).slice(0, 5).map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link>
                    <small>{p.ownerName} · {p.location}</small>
                  </td>
                  <td className="right"><StatusBadge map={APPROVAL} value={p.approvalStatus} /></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h3>Recently added</h3><Link to="/properties">View all</Link></div>
          <table className="table compact"><tbody>
            {m.recentProps.map((p) => (
              <tr key={p.id}><td><Link to={`/properties/${p.id}`}><strong>{p.title}</strong></Link><small>{p.price} · {p.city}</small></td>
                <td className="right muted-text">{formatDate(p.createdAt)}</td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </>
  );
}
