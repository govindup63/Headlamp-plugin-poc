import * as React from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Icon } from '@iconify/react';
import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useArgoApplications } from '../hooks/useArgoApplications';
import { EmptyState } from './EmptyState';
import { HealthBadge, SyncBadge, MetaChip } from './StatusBadges';
import { ApplicationDetail } from './ApplicationDetail';
import { ProjectShape } from '../matchers/projectToApps';
import { commitURL, shortSHA } from '../utils/revisionLink';
import { absoluteTime, relativeTime } from '../utils/time';
import { ArgoApplicationJSON } from '../api/application';

interface Props {
  project: ProjectShape;
  projectResources: any[];
}

type StatusFilter = 'all' | 'drift' | 'healthy';

export function GitOpsTab({ project, projectResources }: Props) {
  const { matches, loaded, error, isDemoData } = useArgoApplications(project, projectResources);
  const [filter, setFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [expanded, setExpanded] = React.useState<string | null>(null);

  if (error) return <SectionBox><EmptyState variant="rbac-denied" message={error.message} /></SectionBox>;
  if (!loaded) {
    return (
      <SectionBox>
        <SkeletonRow />
        <SkeletonRow />
      </SectionBox>
    );
  }
  if (matches.length === 0) return <SectionBox><EmptyState variant="no-matches" /></SectionBox>;

  const ranked = [...matches].sort((a, b) => severity(b) - severity(a));

  const driftCount = ranked.filter(m => isDrift(m.app)).length;
  const healthyCount = ranked.filter(m => isHealthy(m.app)).length;

  const q = filter.trim().toLowerCase();
  const visible = ranked.filter(({ app }) => {
    if (statusFilter === 'drift' && !isDrift(app)) return false;
    if (statusFilter === 'healthy' && !isHealthy(app)) return false;
    if (!q) return true;
    return (
      app.metadata.name.toLowerCase().includes(q) ||
      (app.spec.source?.repoURL ?? '').toLowerCase().includes(q) ||
      app.spec.destination.namespace.toLowerCase().includes(q) ||
      (app.spec.sources ?? []).some(s => (s.repoURL ?? '').toLowerCase().includes(q))
    );
  });

  return (
    <SectionBox>
      {isDemoData && (
        <Box
          sx={theme => ({
            mb: 1.5,
            p: 1,
            fontSize: '0.8rem',
            color: theme.palette.warning.main,
            border: `1px solid ${theme.palette.divider}`,
            borderLeft: `3px solid ${theme.palette.warning.main}`,
            borderRadius: 1,
          })}
        >
          Live Argo CD CRD fetch could not complete, so the table renders <strong>demo data</strong>{' '}
          mirroring the cluster's real apps. Matcher, rendering, and empty/error paths are production code.
        </Box>
      )}

      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        total={matches.length}
        visible={visible.length}
        driftCount={driftCount}
        healthyCount={healthyCount}
      />

      {visible.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Icon icon="mdi:filter-remove-outline" width={28} style={{ opacity: 0.4 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No applications match the current filter.
          </Typography>
        </Box>
      ) : (
        <Table size="small" aria-label="Argo CD Applications">
          <TableHead>
            <TableRow>
              <TableCell sx={headCell} />
              <TableCell sx={headCell}>Application</TableCell>
              <TableCell sx={headCell}>Sync</TableCell>
              <TableCell sx={headCell}>Health</TableCell>
              <TableCell sx={headCell}>Revision</TableCell>
              <TableCell sx={headCell}>Source</TableCell>
              <TableCell sx={headCell}>Destination</TableCell>
              <TableCell sx={headCell}>Last sync</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map(({ app, layer, warning }) => (
              <ApplicationRow
                key={`${app.metadata.namespace}/${app.metadata.name}`}
                app={app}
                layer={layer}
                warning={warning}
                isOpen={expanded === `${app.metadata.namespace}/${app.metadata.name}`}
                onToggle={() => {
                  const key = `${app.metadata.namespace}/${app.metadata.name}`;
                  setExpanded(expanded === key ? null : key);
                }}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </SectionBox>
  );
}

function FilterBar({
  filter,
  onFilterChange,
  statusFilter,
  onStatusFilterChange,
  total,
  visible,
  driftCount,
  healthyCount,
}: {
  filter: string;
  onFilterChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
  total: number;
  visible: number;
  driftCount: number;
  healthyCount: number;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={1.5}
      sx={{ mb: 2 }}
    >
      <TextField
        size="small"
        placeholder="Filter by name, repo, or namespace…"
        value={filter}
        onChange={e => onFilterChange(e.target.value)}
        sx={{
          minWidth: { xs: '100%', sm: 320 },
          flex: { sm: '0 1 360px' },
          '& .MuiInputBase-input': { fontSize: '0.85rem', py: 0.8 },
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start" sx={{ color: 'text.secondary' }}>
              <Icon icon="mdi:magnify" width={18} />
            </InputAdornment>
          ),
          endAdornment: filter ? (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={() => onFilterChange('')}
                aria-label="Clear filter"
                sx={{ color: 'text.secondary' }}
              >
                <Icon icon="mdi:close" width={16} />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <Stack direction="row" spacing={0.75} alignItems="center">
        <FilterChip
          label="All"
          count={total}
          active={statusFilter === 'all'}
          onClick={() => onStatusFilterChange('all')}
        />
        <FilterChip
          label="Drift"
          count={driftCount}
          tone="warn"
          active={statusFilter === 'drift'}
          disabled={driftCount === 0}
          onClick={() => onStatusFilterChange('drift')}
        />
        <FilterChip
          label="Healthy"
          count={healthyCount}
          tone="ok"
          active={statusFilter === 'healthy'}
          disabled={healthyCount === 0}
          onClick={() => onStatusFilterChange('healthy')}
        />
      </Stack>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ ml: { sm: 'auto' }, fontSize: '0.78rem', whiteSpace: 'nowrap' }}
      >
        {visible === total ? `${total} application${total === 1 ? '' : 's'}` : `${visible} of ${total} applications`}
      </Typography>
    </Stack>
  );
}

function FilterChip({
  label,
  count,
  active,
  disabled,
  tone = 'default',
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  tone?: 'default' | 'ok' | 'warn';
  onClick: () => void;
}) {
  return (
    <Chip
      size="small"
      label={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6 }}>
          {label}
          <Box
            component="span"
            sx={theme => ({
              fontSize: '0.65rem',
              padding: '0px 5px',
              borderRadius: '8px',
              backgroundColor: active ? theme.palette.action.selected : 'transparent',
              border: `1px solid ${theme.palette.divider}`,
              opacity: disabled ? 0.4 : 1,
            })}
          >
            {count}
          </Box>
        </Box>
      }
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      variant={active ? 'filled' : 'outlined'}
      color={tone === 'ok' ? 'success' : tone === 'warn' ? 'warning' : 'default'}
      sx={{
        height: 26,
        fontSize: '0.78rem',
        cursor: disabled ? 'default' : 'pointer',
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
}

function ApplicationRow({
  app,
  layer,
  warning,
  isOpen,
  onToggle,
}: {
  app: ArgoApplicationJSON;
  layer: string;
  warning?: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const sources = app.spec.sources?.length
    ? app.spec.sources
    : app.spec.source
    ? [app.spec.source]
    : [];
  const rev = app.status?.sync?.revisions?.[0] ?? app.status?.sync?.revision ?? '';
  const automated = app.spec.syncPolicy?.automated;
  const ignoreCount = app.spec.ignoreDifferences?.length ?? 0;
  const drift = isDrift(app);
  const isDegraded = app.status?.health?.status === 'Degraded';
  const driftColor = isDegraded ? theme.palette.error.main : theme.palette.warning.main;

  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{
          cursor: 'pointer',
          backgroundColor: isOpen ? theme.palette.action.hover : undefined,
          // Drift accent: applied only to the first cell so it reads as a
          // left-border on the row, not a stripe on every column.
          '& > td:first-of-type': {
            position: 'relative',
            borderLeft: drift
              ? `3px solid ${driftColor}`
              : '3px solid transparent',
          },
          '& > td': { borderBottom: isOpen ? 'none' : undefined },
        }}
      >
        <TableCell sx={{ width: 28, py: 0.5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s',
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
              color: 'text.secondary',
            }}
          >
            <Icon icon="mdi:chevron-right" width={18} />
          </Box>
        </TableCell>

        <TableCell sx={bodyCell}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{app.metadata.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {app.metadata.namespace} · via {layer}
          </Typography>
          {warning && (
            <Tooltip title={warning}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, fontSize: '0.7rem', color: 'warning.main', mt: 0.2 }}>
                <Icon icon="mdi:alert-circle-outline" width={12} />
                <span>candidate (verify ownership)</span>
              </Box>
            </Tooltip>
          )}
        </TableCell>

        <TableCell sx={bodyCell}>
          <SyncBadge status={app.status?.sync?.status} />
        </TableCell>

        <TableCell sx={bodyCell}>
          <HealthBadge status={app.status?.health?.status} />
        </TableCell>

        <TableCell sx={bodyCell}>
          {rev ? (
            <Tooltip title={rev}>
              {sources[0] && commitURL(sources[0].repoURL, rev) ? (
                <Box
                  component="a"
                  href={commitURL(sources[0].repoURL, rev) ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {shortSHA(rev)}
                </Box>
              ) : (
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{shortSHA(rev)}</span>
              )}
            </Tooltip>
          ) : (
            <Typography variant="body2" color="text.secondary">—</Typography>
          )}
          {sources[0]?.targetRevision && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              {sources[0].targetRevision}
            </Typography>
          )}
        </TableCell>

        <TableCell sx={bodyCell}>
          {sources.slice(0, 1).map((s, i) => (
            <Box key={i}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                {prettyRepo(s.repoURL)}
              </Typography>
              {(s.path || s.chart) && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {s.path ? s.path : `chart: ${s.chart}`}
                </Typography>
              )}
            </Box>
          ))}
          {sources.length > 1 && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              +{sources.length - 1} more source{sources.length > 2 ? 's' : ''}
            </Typography>
          )}
          <Box sx={{ mt: 0.4 }}>
            {app.status?.sourceType && <MetaChip label={app.status.sourceType} />}
            {automated && (
              <MetaChip
                label={`auto-sync${automated.prune ? '+p' : ''}${automated.selfHeal ? '+h' : ''}`}
              />
            )}
            {ignoreCount > 0 && <MetaChip tone="warn" label={`ignore ${ignoreCount}`} />}
          </Box>
        </TableCell>

        <TableCell sx={bodyCell}>
          <Typography sx={{ fontSize: '0.78rem' }}>
            ns: <strong>{app.spec.destination.namespace || '—'}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {app.spec.destination.name ??
              (app.spec.destination.server === 'https://kubernetes.default.svc'
                ? 'in-cluster'
                : app.spec.destination.server) ??
              '—'}
          </Typography>
        </TableCell>

        <TableCell sx={bodyCell}>
          <Tooltip title={absoluteTime(app.status?.operationState?.finishedAt)}>
            <Typography sx={{ fontSize: '0.78rem' }}>
              {relativeTime(app.status?.operationState?.finishedAt)}
            </Typography>
          </Tooltip>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={8} sx={{ p: 0, borderBottom: theme => `1px solid ${theme.palette.divider}` }}>
          <Collapse in={isOpen} timeout="auto" unmountOnExit>
            <ApplicationDetail app={app} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function SkeletonRow() {
  return (
    <Box
      sx={theme => ({
        height: 44,
        my: 0.5,
        borderRadius: 1,
        background: `linear-gradient(90deg, ${theme.palette.action.hover} 0%, ${theme.palette.action.selected} 50%, ${theme.palette.action.hover} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.2s linear infinite',
        '@keyframes shimmer': {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      })}
    />
  );
}

function isDrift(app: ArgoApplicationJSON): boolean {
  const s = app.status?.sync?.status;
  const h = app.status?.health?.status;
  return s === 'OutOfSync' || h === 'Degraded' || h === 'Missing';
}

function isHealthy(app: ArgoApplicationJSON): boolean {
  return app.status?.sync?.status === 'Synced' && app.status?.health?.status === 'Healthy';
}

function severity(m: { app: ArgoApplicationJSON }): number {
  const s = m.app.status?.sync?.status;
  const h = m.app.status?.health?.status;
  let n = 0;
  if (h === 'Degraded') n += 4;
  if (h === 'Missing') n += 3;
  if (s === 'OutOfSync') n += 2;
  if (h === 'Progressing') n += 1;
  return n;
}

function prettyRepo(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/:/, '/')
    .replace(/\.git$/, '');
}

const headCell = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'text.secondary',
  textTransform: 'uppercase' as const,
  letterSpacing: 0.3,
  py: 0.7,
};

const bodyCell = { py: 1.1 };
