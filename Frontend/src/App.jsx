import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import Properties from './pages/Properties.jsx';
import LiveProperties from './pages/LiveProperties.jsx';
import Leads from './pages/Leads.jsx';
import PropertyForm from './pages/PropertyForm.jsx';
import PropertyDetails from './pages/PropertyDetails.jsx';
import Approvals from './pages/Approvals.jsx';
import Archive from './pages/Archive.jsx';
import AdminProfile from './pages/AdminProfile.jsx';
import Admins from './pages/Admins.jsx';
import Ads from './pages/Ads.jsx';
import CareersInWebsite from './pages/CareersInWebsite.jsx';
import Builders from './pages/Builders.jsx';

// Frontend-only guard. The real protection must be on the server (requireAdmin).
function Guard({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <div className="center-screen">Loading”¦</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Guard><AdminLayout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="admins" element={<Admins />} />
        <Route path="properties" element={<Properties />} />
        <Route path="live-properties" element={<LiveProperties />} />
        <Route path="leads" element={<Leads />} />
        <Route path="properties/new" element={<PropertyForm />} />
        <Route path="properties/:id" element={<PropertyDetails />} />
        <Route path="properties/:id/edit" element={<PropertyForm />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="ads" element={<Ads />} />
        <Route path="careers-in-website" element={<CareersInWebsite />} />
        <Route path="builders" element={<Builders />} />
        <Route path="archive" element={<Archive />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

