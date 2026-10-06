import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, sessionError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form);
      navigate(location.state?.from || "/play", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-page">
      <form className="panel form" onSubmit={submit}>
        <h2>Sign in</h2>

        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={change} autoComplete="email" required />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={change}
            autoComplete="current-password"
            required
          />
        </label>

        {(error || sessionError) && <p className="error" role="alert">{error || sessionError}</p>}

        <button className="btn solid" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="muted">
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
