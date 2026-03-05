"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

type ApplicationStatus = "applied" | "interview" | "offer" | "rejected" | "withdrawn";

interface Application {
  id: string;
  company_name: string;
  job_title: string;
  status: ApplicationStatus;
  url: string | null;
  notes: string | null;
  created_at: string;
  generation_count: number;
}

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; dot: string }> = {
  applied:    { label: "Applied",    color: "text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/50",   dot: "bg-indigo-400" },
  interview:  { label: "Interview",  color: "text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40",     dot: "bg-amber-400" },
  offer:      { label: "Offer",      color: "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40", dot: "bg-emerald-400" },
  rejected:   { label: "Rejected",   color: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30 border-red-200 dark:border-red-900/40",           dot: "bg-red-400" },
  withdrawn:  { label: "Withdrawn",  color: "text-[var(--color-text-tertiary)] bg-[var(--color-elevated)] border-[var(--color-border)]",           dot: "bg-[var(--color-text-tertiary)]" },
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

interface AddFormProps {
  onAdd: (app: Application) => void;
}

function AddForm({ onAdd }: AddFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ company_name: "", job_title: "", url: "", status: "applied" as ApplicationStatus });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!form.company_name.trim() || !form.job_title.trim()) {
      setError("Company and role are required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onAdd({ ...data.application, generation_count: 0 });
      setForm({ company_name: "", job_title: "", url: "", status: "applied" });
      setOpen(false);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl px-4 py-2 shadow-sm shadow-indigo-600/20 transition-all hover:-translate-y-px"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add application
      </button>
    );
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Add application</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Company *</label>
          <input
            type="text"
            placeholder="Acme Corp"
            value={form.company_name}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Role *</label>
          <input
            type="text"
            placeholder="Product Manager"
            value={form.job_title}
            onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Job URL</label>
          <input
            type="url"
            placeholder="https://..."
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ApplicationStatus }))}
            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition"
          >
            {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
              <option key={val} value={val}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl px-4 py-2 transition-all disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Cancel</button>
      </div>
    </div>
  );
}

interface FollowUpPanelProps {
  application: Application;
}

function FollowUpPanel({ application }: FollowUpPanelProps) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: application.company_name,
          job_title: application.job_title,
          applied_date: new Date(application.created_at).toLocaleDateString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setEmail(data.email);
    } catch {
      setError("Failed to generate.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 border-t border-[var(--color-border-subtle)] pt-3">
      {!email ? (
        <button
          onClick={generate}
          disabled={loading}
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          {loading ? (
            <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
          {loading ? "Generating..." : "Generate follow-up email"}
        </button>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Follow-up email</p>
            <button
              onClick={copy}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <pre className="text-xs text-[var(--color-text-output)] whitespace-pre-wrap font-mono bg-[var(--color-inset)] rounded-lg p-3 border border-[var(--color-border)]">{email}</pre>
          <button onClick={() => setEmail(null)} className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] mt-1.5 transition-colors">Regenerate</button>
        </div>
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

interface ApplicationRowProps {
  application: Application;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
}

function ApplicationRow({ application, onStatusChange }: ApplicationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const updateStatus = useCallback(async (newStatus: ApplicationStatus) => {
    if (updating) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: application.id, status: newStatus }),
      });
      // BUG-10: only update UI state if the server confirmed the change
      if (res.ok) {
        onStatusChange(application.id, newStatus);
      }
    } catch {
      // Network error — leave status unchanged
    } finally {
      setUpdating(false);
    }
  }, [application.id, updating, onStatusChange]);

  const date = new Date(application.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-border-strong)] overflow-hidden transition-colors">
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[var(--color-elevated)] transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{application.company_name}</span>
            <span className="text-[var(--color-separator)]">·</span>
            <span className="text-sm text-[var(--color-text-secondary)] truncate">{application.job_title}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <StatusBadge status={application.status} />
            <span className="text-xs text-[var(--color-text-tertiary)]">{date}</span>
            {application.generation_count > 0 && (
              <span className="text-xs text-[var(--color-text-tertiary)]">{application.generation_count} doc{application.generation_count !== 1 ? "s" : ""} generated</span>
            )}
            {application.url && (
              <a
                href={application.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Job link
              </a>
            )}
          </div>
        </div>
        <svg className={`w-4 h-4 text-[var(--color-text-tertiary)] shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-[var(--color-border-subtle)]">
          <div className="mt-4">
            <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-2">Update status</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map((s) => {
                const activeColors: Record<ApplicationStatus, string> = {
                  applied:   "border-indigo-500 bg-indigo-100 ring-1 ring-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
                  interview: "border-amber-500 bg-amber-50 ring-1 ring-amber-500 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
                  offer:     "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
                  rejected:  "border-red-500 bg-red-50 ring-1 ring-red-500 text-red-700 dark:bg-red-950/30 dark:text-red-400",
                  withdrawn: "border-[var(--color-text-tertiary)] bg-[var(--color-elevated)] ring-1 ring-[var(--color-text-tertiary)] text-[var(--color-text-secondary)]",
                };
                return (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    disabled={updating || application.status === s}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all disabled:cursor-not-allowed ${
                      application.status === s
                        ? activeColors[s]
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] bg-transparent"
                    }`}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                );
              })}
            </div>
          </div>

          {application.notes && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[var(--color-text-tertiary)] mb-1">Notes</p>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{application.notes}</p>
            </div>
          )}

          {/* Follow-up email — only for applied status */}
          {application.status === "applied" && (
            <FollowUpPanel application={application} />
          )}

          <div className="mt-3 flex items-center gap-3">
            <Link
              href={`/generate`}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate new doc
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  initialApplications: Application[];
}

export default function ApplicationsClient({ initialApplications }: Props) {
  const [applications, setApplications] = useState(initialApplications);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");

  const handleAdd = useCallback((app: Application) => {
    setApplications((prev) => [app, ...prev]);
  }, []);

  const handleStatusChange = useCallback((id: string, status: ApplicationStatus) => {
    setApplications((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  }, []);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  const filtered = applications.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.company_name.toLowerCase().includes(q) && !a.job_title.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const isFiltered = search !== "" || statusFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Add form */}
      <AddForm onAdd={handleAdd} />

      {/* Search + filter toolbar */}
      {applications.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4">
          {/* Search row */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by company or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-[var(--color-elevated)] transition"
            />
          </div>

          {/* Status pills row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                statusFilter === "all"
                  ? "border-indigo-500 bg-indigo-100 ring-1 ring-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
                  : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              All ({applications.length})
            </button>
            {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map((s) => {
              const count = applications.filter((a) => a.status === s).length;
              if (count === 0) return null;
              const activeColors: Record<ApplicationStatus, string> = {
                applied:   "border-indigo-500 bg-indigo-100 ring-1 ring-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400",
                interview: "border-amber-500 bg-amber-50 ring-1 ring-amber-500 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
                offer:     "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
                rejected:  "border-red-500 bg-red-50 ring-1 ring-red-500 text-red-700 dark:bg-red-950/30 dark:text-red-400",
                withdrawn: "border-[var(--color-text-tertiary)] bg-[var(--color-elevated)] ring-1 ring-[var(--color-text-tertiary)] text-[var(--color-text-secondary)]",
              };
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    statusFilter === s
                      ? activeColors[s]
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  {STATUS_CONFIG[s].label} ({count})
                </button>
              );
            })}
          </div>

          {/* Result count + clear */}
          {isFiltered && (
            <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span>Showing {filtered.length} of {applications.length}</span>
              <span className="text-[var(--color-separator)]">·</span>
              <button
                type="button"
                onClick={clearFilters}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Clear filters ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Application list */}
      {applications.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-tertiary)]">
          <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-border-strong)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">No applications yet</p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Add your first application above to start tracking.</p>
        </div>
      ) : filtered.length === 0 && isFiltered ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-12 text-center">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">No applications match your filters</p>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">Try adjusting your search or status filter.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm shadow-indigo-600/20 transition-all hover:-translate-y-px"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <ApplicationRow
              key={app.id}
              application={app}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
