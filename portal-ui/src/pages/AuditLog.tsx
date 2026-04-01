import { useState } from 'react';
import { useAuditLog } from '../hooks/useAdmin';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function AuditLog() {
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAuditLog({ action: actionFilter || undefined, page, limit: 50 });
  const entries = data?.entries ?? [];
  const pagination = data?.pagination;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-wide">Audit Log</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {pagination ? `${pagination.total} total entries` : 'Loading...'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Filter by action..."
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] w-64"
          aria-label="Filter by action"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)]">
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Time</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Action</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Target</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">IP</th>
              <th className="label-mono text-[var(--text-muted)] text-left px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">No audit entries found</td></tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)]">
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                    {entry.target_type && entry.target_id
                      ? `${entry.target_type}:${entry.target_id.slice(0, 8)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs font-mono">
                    {entry.ip_address ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)] max-w-xs truncate">
                    {entry.details ? JSON.stringify(entry.details) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > pagination.limit && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[var(--text-muted)]">
            {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * pagination.limit >= pagination.total}
              className="p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-default)] disabled:opacity-30 hover:bg-[var(--bg-hover)]"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  let color = '#6c8fff'; // default blue
  if (action.includes('delete') || action.includes('destroy') || action.includes('lock')) {
    color = '#fb7185';
  } else if (action.includes('create') || action.includes('approve') || action.includes('deploy')) {
    color = '#00e5a0';
  } else if (action.includes('login') || action.includes('auth') || action.includes('reset')) {
    color = '#facc15';
  }

  return (
    <span
      className="label-mono px-2 py-0.5 rounded text-xs"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {action}
    </span>
  );
}
