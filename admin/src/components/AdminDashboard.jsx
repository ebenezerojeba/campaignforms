import React, { useEffect, useState, useCallback } from "react";
import { ShieldCheck, ChevronLeft, ChevronRight, FileSpreadsheet, FileJson, Users, UserPlus, Search, LogOut, MapPin, X, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API } from "../config/api";
import AdminManualEntryForm from "../components/AdminManualEntryForm";
import NominationSlipModal from "../components/NominationSlipModal";

const PAGE_SIZE = 15; // matches the backend default — was 12 vs 15 before, silently wasting a request's worth of rows

function SourceBadge({ source }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${source === "admin" ? "bg-amber-950 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
      {source}
    </span>
  );
}

function PhotoThumb({ item, className }) {
  if (!item.photoUrl) {
    return (
      <div className={`rounded border border-slate-800 bg-slate-950 flex items-center justify-center text-slate-600 text-[9px] font-bold uppercase shrink-0 ${className}`}>
        None
      </div>
    );
  }
  return (
    <a
      href={item.photoUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Open full size"
      onClick={(e) => e.stopPropagation()} // opening the raw image shouldn't also open the slip modal
      className="shrink-0"
    >
      <img
        src={item.photoUrl}
        alt={`${item.fullName}'s passport photograph`}
        loading="lazy"
        className={`object-cover rounded border border-slate-700 hover:border-emerald-500 transition-colors ${className}`}
      />
    </a>
  );
}

// Mobile card — shown below the `md` breakpoint in place of the table row.
// Same tap-to-open-slip behavior as the desktop row, sized for a thumb, not a cursor.
function NomineeCard({ item, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full text-left bg-slate-950 border border-slate-800 rounded-xl p-4 flex gap-3 active:bg-slate-900 transition-colors"
    >
      <PhotoThumb item={item} className="h-16 w-14" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-white text-sm truncate">{item.fullName}</p>
          <SourceBadge source={item.source} />
        </div>
        <p className="text-slate-400 text-xs truncate">{item.telNo} {item.email ? `· ${item.email}` : ''}</p>
        <p className="text-slate-400 text-xs truncate">
          <span className="text-slate-200 font-semibold">{item.lga}</span>
          {item.ward ? ` — ${item.ward}` : ''}
        </p>
        <p className="text-emerald-400 font-mono text-[11px] truncate">{item.puName} {item.puCode ? `(${item.puCode})` : ''}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-slate-300 pt-0.5">
          <span><span className="text-slate-500 font-sans">PVC:</span> {item.pvcNumber || '—'}</span>
          <span><span className="text-slate-500 font-sans">NIN:</span> {item.nin || '—'}</span>
        </div>
        <p className="text-slate-400 text-xs truncate">
          {item.bankDetails?.bankName} <span className="font-mono">{item.bankDetails?.accountNo}</span>
        </p>
      </div>
    </button>
  );
}

// Stat card — small, reusable, used for the three top-line numbers.
function StatCard({ icon: Icon, label, value, accent = "text-emerald-400" }) {
  return (
    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
      <div className={`p-3 bg-slate-950 rounded-lg border border-slate-800 ${accent} shrink-0`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-xl sm:text-2xl font-black text-white mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

// Nominees-by-LGA breakdown. Rows are clickable — selecting one filters the
// main list below via the `lga` query param, turning a static count table
// (like the reference dashboard) into an actual drill-down tool.
function LgaBreakdownPanel({ byLga, loading, activeLga, onSelectLga }) {
  const maxCount = byLga.length ? Math.max(...byLga.map((r) => r.count)) : 0;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-bold text-xs uppercase tracking-wider">
          <MapPin className="h-4 w-4 text-emerald-400" /> Nominees by LGA
        </div>
        {activeLga && (
          <button
            onClick={() => onSelectLga(null)}
            className="flex items-center gap-1 text-[11px] font-bold uppercase text-emerald-400 hover:text-emerald-300"
          >
            Clear filter <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800">
        {loading ? (
          <p className="p-6 text-center text-slate-500 text-sm">Loading…</p>
        ) : byLga.length === 0 ? (
          <p className="p-6 text-center text-slate-500 text-sm">No data yet.</p>
        ) : (
          byLga.map((row) => {
            const isActive = activeLga === row.lga;
            const widthPct = maxCount ? Math.max((row.count / maxCount) * 100, 4) : 0;
            return (
              <button
                key={row.lga}
                onClick={() => onSelectLga(isActive ? null : row.lga)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isActive ? "bg-emerald-950/40" : "hover:bg-slate-950/60"
                }`}
              >
                <span className={`text-xs font-semibold w-32 sm:w-40 truncate shrink-0 ${isActive ? "text-emerald-400" : "text-slate-200"}`}>
                  {row.lga || "Unspecified"}
                </span>
                <span className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-700"}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </span>
                <span className="text-xs font-mono text-slate-400 w-10 text-right shrink-0">{row.count}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { admin, authFetch, logout } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [lgaFilter, setLgaFilter] = useState(null);
  const [wardFilter, setWardFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [wardOptions, setWardOptions] = useState([]);
  const [view, setView] = useState("list"); // 'list' | 'add' | 'edit'
  const [editing, setEditing] = useState(null);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error', text }
  const [exporting, setExporting] = useState("");

  // Auto-dismiss notices after a few seconds.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  const [stats, setStats] = useState({ total: 0, lgaCount: 0, byLga: [], bySource: {} });
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchRecords = useCallback(
    async (targetPage = 1, search = searchTerm, lga = lgaFilter, ward = wardFilter, source = sourceFilter, quiet = false) => {
      // quiet = background refresh: don't blank the list with "Loading…".
      if (!quiet) setLoading(true);
      setLoadError("");
      try {
        const params = new URLSearchParams({ page: targetPage, limit: PAGE_SIZE });
        if (search.trim()) params.set("search", search.trim());
        if (lga) params.set("lga", lga);
        if (ward) params.set("ward", ward);
        if (source) params.set("source", source);

        const res = await authFetch(`${API.adminSubmissions}?${params.toString()}`);
        if (res.status === 401) return; // authFetch already signed us out
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || `Server returned ${res.status}`);
        setSubmissions(payload.data || []);
        setMeta({ total: payload.total ?? 0, page: payload.page ?? 1, pages: payload.pages ?? 1 });
      } catch (err) {
        console.error("Failed to load submissions:", err);
        setLoadError(err instanceof TypeError ? "Can't reach the server. Check your connection." : err.message);
      } finally {
        setLoading(false);
      }
    },
    [authFetch, searchTerm, lgaFilter, wardFilter, sourceFilter]
  );

  const fetchStats = useCallback(async (quiet = false) => {
    if (!quiet) setStatsLoading(true);
    try {
      const res = await authFetch(API.adminStats);
      if (!res.ok) return;
      const payload = await res.json();
      setStats({
        total: payload.total ?? 0,
        lgaCount: payload.lgaCount ?? 0,
        byLga: payload.byLga || [],
        bySource: payload.bySource || {},
      });
    } catch (err) {
      console.error("Stats fetch failed.", err);
    } finally {
      setStatsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchRecords(1);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the list current without a manual refresh: poll every 15s while
  // the list is on screen, and refresh as soon as the tab is focused again.
  useEffect(() => {
    if (view !== "list") return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetchRecords(meta.page, searchTerm, lgaFilter, wardFilter, sourceFilter, true);
      fetchStats(true);
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [view, meta.page, fetchRecords, fetchStats, searchTerm, lgaFilter, wardFilter, sourceFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRecords(1, searchTerm, lgaFilter);
  };

  const handleSelectLga = async (lga) => {
    setLgaFilter(lga);
    setWardFilter("");
    setWardOptions([]);
    fetchRecords(1, searchTerm, lga, "");
    if (lga) {
      try {
        const res = await fetch(API.wards(lga));
        const { data } = await res.json();
        setWardOptions(data || []);
      } catch {
        // Ward filter is optional — leave it empty if it can't load.
      }
    }
  };

  const handleSelectWard = (ward) => {
    setWardFilter(ward);
    fetchRecords(1, searchTerm, lgaFilter, ward);
  };

  const handleSelectSource = (source) => {
    setSourceFilter(source);
    fetchRecords(1, searchTerm, lgaFilter, wardFilter, source);
  };

  const clearSearch = () => {
    setSearchTerm("");
    fetchRecords(1, "");
  };

  const refreshAll = () => {
    fetchRecords(meta.page);
    fetchStats();
  };


  const startEdit = (nominee) => {
    setSelectedNominee(null);
    setEditing(nominee);
    setView("edit");
  };

  const backToList = () => {
    setEditing(null);
    setView("list");
  };

  const clearLgaFilter = () => handleSelectLga(null);

  const triggerSecureExport = async (formatType) => {
    // Export is streamed with credentials — a plain window.location.href
    // navigation (as before) can't attach the Authorization header, so
    // this fetches as a blob and triggers the download client-side.
    setExporting(formatType);
    try {
      const res = await authFetch(API.adminExport(formatType));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = formatType === "excel" ? `PUC_Nominations_${stamp}.xlsx` : `puc_backup_${stamp}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setNotice({ type: "error", text: err instanceof TypeError ? "Export failed: can't reach the server." : err.message });
    } finally {
      setExporting("");
    }
  };

  const adminSubmissionCount = stats.bySource.admin || 0;
  const publicSubmissionCount = stats.bySource.public || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">

        {/* Top Command Header */}
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" /> {admin?.role === "super_admin" ? "Super Admin" : "Staff"} Access
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">PUC System Administration Core</h1>
          </div>

          {/* flex-wrap lets these drop to a second line on narrow screens instead
              of forcing horizontal scroll or squashing the buttons unreadably. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => (view === "list" ? setView("add") : backToList())}
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-[11px] sm:text-xs uppercase tracking-wider px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-800 transition-all"
            >
              <UserPlus className="h-4 w-4" /> {view === "list" ? "Add Nominee" : "Back to List"}
            </button>

            {view === "list" && (
              <button
                onClick={refreshAll}
                disabled={loading}
                className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-[11px] sm:text-xs uppercase tracking-wider px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-800 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            )}

            {/* Export is only meaningful/available to super_admin — the
                backend enforces this too, but hiding it avoids a confusing
                403 for staff. */}
            {admin?.role === "super_admin" && (
              <>
                <button
                  onClick={() => triggerSecureExport("excel")}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 sm:gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all shadow-md"
                >
                  {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Excel
                </button>
                <button
                  onClick={() => triggerSecureExport("json")}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-[11px] sm:text-xs uppercase tracking-wider px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all border border-slate-800"
                >
                  {exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />} JSON
                </button>
              </>
            )}

            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-[11px] sm:text-xs font-bold uppercase px-3 py-2.5 sm:py-3 ml-auto"
            >
              <LogOut className="h-4 w-4" /> Sign Out{admin?.username ? ` (${admin.username})` : ""}
            </button>
          </div>
        </div>

        {notice && (
          <div
            role="status"
            className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-bold ${
              notice.type === "success"
                ? "bg-emerald-950/40 border-emerald-900 text-emerald-300"
                : "bg-rose-950/40 border-rose-900 text-rose-300"
            }`}
          >
            {notice.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span className="flex-1">{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        )}

        {view === "add" || view === "edit" ? (
          <AdminManualEntryForm
            key={editing?._id || "new"}
            record={view === "edit" ? editing : null}
            onCancel={backToList}
            onSaved={() => {
              const wasEdit = view === "edit";
              setNotice({ type: "success", text: wasEdit ? "Record updated." : "Nominee record created." });
              backToList();
              fetchRecords(wasEdit ? meta.page : 1);
              fetchStats();
            }}
          />
        ) : (
          <>
            {/* Top-line stats — trimmed to what's actually decision-useful:
                total volume, geographic spread, and channel mix. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <StatCard icon={Users} label="Total Active Enlistments" value={`${stats.total.toLocaleString()} Nominees`} />
              <StatCard icon={MapPin} label="LGAs Covered" value={stats.lgaCount.toLocaleString()} accent="text-sky-400" />
              <StatCard
                icon={UserPlus}
                label="Public vs Staff-Entered"
                value={`${publicSubmissionCount.toLocaleString()} / ${adminSubmissionCount.toLocaleString()}`}
                accent="text-amber-400"
              />
            </div>

            {/* Search + active filter chip */}
            <div className="flex flex-col sm:flex-row gap-2">
              <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search name, phone, NIN, PVC or PU code…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <button type="submit" className="shrink-0 bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase px-4 py-3 rounded-xl hover:bg-slate-800">
                  Search
                </button>
                {searchTerm && (
                  <button type="button" onClick={clearSearch} className="shrink-0 p-3 rounded-xl text-slate-500 hover:text-slate-300" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>

              <select
                value={sourceFilter}
                onChange={(e) => handleSelectSource(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold uppercase text-slate-300 px-3 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                aria-label="Filter by source"
              >
                <option value="">All sources</option>
                <option value="public">Public form</option>
                <option value="admin">Staff-entered</option>
              </select>

              {lgaFilter && wardOptions.length > 0 && (
                <select
                  value={wardFilter}
                  onChange={(e) => handleSelectWard(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold uppercase text-slate-300 px-3 py-3 sm:max-w-56 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  aria-label="Filter by ward"
                >
                  <option value="">All wards</option>
                  {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              )}

              {lgaFilter && (
                <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-900 text-emerald-400 text-xs font-bold uppercase px-4 py-3 rounded-xl">
                  <MapPin className="h-3.5 w-3.5" /> {lgaFilter}
                  <button onClick={clearLgaFilter} className="hover:text-emerald-200">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* LGA breakdown — the drill-down replacement for the reference dashboard's static table */}
            <LgaBreakdownPanel
              byLga={stats.byLga}
              loading={statsLoading}
              activeLga={lgaFilter}
              onSelectLga={handleSelectLga}
            />

            {loadError && (
              <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-rose-900 bg-rose-950/40 text-rose-300 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span className="flex-1">Couldn't load records. {loadError}</span>
                <button onClick={() => fetchRecords(meta.page)} className="text-xs font-bold uppercase bg-rose-900/60 hover:bg-rose-900 px-3 py-2 rounded-lg">
                  Retry
                </button>
              </div>
            )}

            <p className="text-xs text-slate-500 px-1">
              {loading ? "Loading…" : `${meta.total.toLocaleString()} record${meta.total === 1 ? "" : "s"}${lgaFilter || wardFilter || sourceFilter || searchTerm ? " match your filters" : ""}`}
            </p>

            {/* Mobile: stacked cards. Hidden at md and up, where the table takes over. */}
            <div className="md:hidden space-y-3">
              <p className="text-[11px] text-slate-500 px-1">Tap a nominee for full details and a printable slip.</p>
              {loading ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">Loading…</div>
              ) : submissions.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">No records found.</div>
              ) : (
                submissions.map((item) => (
                  <NomineeCard key={item._id} item={item} onSelect={setSelectedNominee} />
                ))
              )}
            </div>

            {/* Desktop/tablet: full table. Hidden below md, where cards take over. */}
            <div className="hidden md:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
              <p className="px-4 pt-3 text-[11px] text-slate-500">Click a row to view full details and generate a printable slip.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      <th className="p-4">Photo</th>
                      <th className="p-4">Full Name</th>
                      <th className="p-4">Contact (Tel/Email)</th>
                      <th className="p-4">LGA / Ward Designation</th>
                      <th className="p-4">PU Details (Name/Code)</th>
                      <th className="p-4">Credentials (PVC/NIN)</th>
                      <th className="p-4">Financial Remittance</th>
                      <th className="p-4">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {loading ? (
                      <tr><td colSpan="8" className="p-8 text-center text-slate-500">Loading…</td></tr>
                    ) : submissions.length === 0 ? (
                      <tr><td colSpan="8" className="p-8 text-center text-slate-500">No records found.</td></tr>
                    ) : (
                      submissions.map((item) => (
                        <tr
                          key={item._id}
                          onClick={() => setSelectedNominee(item)}
                          className="hover:bg-slate-950/40 transition-all cursor-pointer"
                        >
                          <td className="p-4">
                            <PhotoThumb item={item} className="h-12 w-10" />
                          </td>
                          <td className="p-4 font-bold text-white whitespace-nowrap">{item.fullName}</td>
                          <td className="p-4 space-y-0.5">
                            <p className="font-semibold text-slate-200">{item.telNo}</p>
                            <p className="text-slate-500 text-[11px]">{item.email || "No email"}</p>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <p className="font-bold text-slate-200">{item.lga}</p>
                            <p className="text-slate-400 text-[11px]">{item.ward}</p>
                          </td>
                          <td className="p-4 max-w-xs truncate space-y-0.5">
                            <p className="font-semibold text-slate-200 truncate">{item.puName}</p>
                            <p className="text-emerald-400 font-mono text-[11px]">{item.puCode}</p>
                          </td>
                          <td className="p-4 space-y-0.5 font-mono text-[11px]">
                            <p className="text-slate-300"><span className="text-slate-500 font-sans">PVC:</span> {item.pvcNumber}</p>
                            <p className="text-slate-300"><span className="text-slate-500 font-sans">NIN:</span> {item.nin}</p>
                          </td>
                          <td className="p-4 space-y-0.5">
                            <p className="font-semibold text-white">{item.bankDetails?.bankName}</p>
                            <p className="text-slate-400 font-mono text-[11px]">{item.bankDetails?.accountNo}</p>
                          </td>
                          <td className="p-4">
                            <SourceBadge source={item.source} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination — shared by both layouts */}
            <div className="bg-slate-900 md:bg-slate-950 rounded-xl md:rounded-none border md:border-0 border-slate-800 md:border-t p-4 flex items-center justify-between text-xs text-slate-400">
              <p>Page {meta.page} of {meta.pages || 1}</p>
              <div className="flex items-center gap-2">
                <button disabled={meta.page <= 1 || loading} onClick={() => fetchRecords(meta.page - 1)} className="p-2.5 sm:p-2 rounded bg-slate-800 text-white disabled:opacity-30 hover:bg-slate-700">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button disabled={meta.page >= meta.pages || loading} onClick={() => fetchRecords(meta.page + 1)} className="p-2.5 sm:p-2 rounded bg-slate-800 text-white disabled:opacity-30 hover:bg-slate-700">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedNominee && (
        <NominationSlipModal nominee={selectedNominee} onClose={() => setSelectedNominee(null)} onEdit={startEdit} />
      )}
    </div>
  );
}