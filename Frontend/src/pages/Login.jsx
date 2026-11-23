import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { errorMessage } from '../services/api.js';

export default function Login() {
  const { user, login, booting } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  if (booting) return null;
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (!form.password) errs.password = 'Password is required.';
    setErrors(errs);
    setApiError('');
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await login(form.email.trim(), form.password, form.remember);
      navigate('/', { replace: true });
    } catch (err) { setApiError(errorMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit} noValidate autoComplete="off">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
          <img src={`${import.meta.env.BASE_URL}probridge-logo.png`} alt="ProBridge" style={{ height: 42, objectFit: 'contain' }} />
          <div
            style={{
              width: 180,
              height: 2,
              background: 'linear-gradient(90deg, transparent, #c28916, transparent)',
              marginTop: 10,
              marginBottom: 8,
              borderRadius: 1,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--muted)',
              letterSpacing: '0.8px',
              fontFamily: "'Inter', -apple-system, sans-serif",
            }}
          >
            We Connect World of Real Estate
          </span>
        </div>
        <h1 style={{ marginTop: 0 }}>Admin Portal</h1>
        <p className="muted-text">Sign in to manage users and property listings.</p>

        {apiError && <div className="note note-red">{apiError}</div>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            placeholder="Enter email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {errors.email && <small className="field-error">{errors.email}</small>}
        </label>
        <label className="field">
          <span>Password</span>
          <div className="input-icon">
            <input
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Enter password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <small className="field-error">{errors.password}</small>}
        </label>
        <button className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
