import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(credentials.username, credentials.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Already signed in (e.g. a stored session) — skip the login screen.
  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-white font-black text-lg">PUC Admin Access</h1>
          <p className="text-slate-500 text-xs text-center">Staff and administrator sign-in only</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Username</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={credentials.username}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Password</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-rose-400 text-xs font-semibold bg-rose-950/40 border border-rose-900 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}