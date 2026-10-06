import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setFields({});
    setBusy(true);
    try {
      const result = await register(form);
      if (result.confirmationRequired) {
        setNotice("Check your email to confirm your account, then sign in. If an account already exists for this email, sign in instead.");
      } else navigate("/play", { replace: true });
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});     // per-field messages from @Valid
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-page">
      <form className="panel form" onSubmit={submit}>
        <h2>Create an account</h2>

        <label>
          Callsign
          <input name="username" value={form.username} onChange={change} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="nickname" required />
          <small className="muted">3–24 letters, numbers or underscores. Shown publicly on the leaderboard.</small>
          {fields.username && <small className="error">{fields.username}</small>}
        </label>

        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={change} required />
          {fields.email && <small className="error">{fields.email}</small>}
        </label>

        <label>
          Password
          <input name="password" type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={change} required />
          {fields.password && <small className="error">{fields.password}</small>}
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="ok" role="status">{notice}</p>}

        <button className="btn solid" disabled={busy}>
          {busy ? "Creating…" : "Register"}
        </button>

        <p className="muted">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
