import * as React from 'react';
import {
  Box,
  Divider,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { ArgoApplicationJSON } from '../api/application';
import { commitURL, shortSHA } from '../utils/revisionLink';
import { absoluteTime, relativeTime } from '../utils/time';
import { MetaChip } from './StatusBadges';

const HEALTH_COLOR_KEY: Record<string, 'success' | 'info' | 'error' | 'warning' | 'text.secondary'> = {
  Healthy: 'success',
  Progressing: 'info',
  Degraded: 'error',
  Suspended: 'text.secondary',
  Missing: 'warning',
  Unknown: 'text.secondary',
};

/**
 * Application detail body that expands under each Application row. Read-only.
 *
 * Three columns side-by-side on wide screens, stacking on narrow:
 *   - Sources (per source for multi-source apps), with deep link to commit
 *   - Managed resources (status.resources[]), with deep links to Headlamp's
 *     own workload pages via Headlamp's <Link routeName=...>
 *   - Conditions (status.conditions[])
 *
 * The bottom strip shows source type, auto-sync mode, ignoreDifferences,
 * revision history limit, and AppProject membership as small meta chips.
 */
export function ApplicationDetail({ app }: { app: ArgoApplicationJSON }) {
  const safe = React.useMemo(() => normalize(app), [app]);

  // No explicit background: the panel inherits whatever theme Headlamp is
  // in (light or dark). Differentiation comes from a top border and the
  // section structure, not a fill colour, so plugin theme propagation
  // quirks cannot produce a light panel in a dark Headlamp build.
  return (
    <Box
      sx={theme => ({
        p: 2,
        borderTop: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={3}
        alignItems="flex-start"
      >
        <Column>
          <SectionTitle>Sources</SectionTitle>
          <Stack spacing={1.5}>
            {safe.sources.length === 0 ? (
              <Empty text="No source declared." />
            ) : (
              safe.sources.map((s, i) => {
                const rev = safe.revisions[i] ?? safe.revisions[0] ?? '';
                const url = s.repoURL ? commitURL(s.repoURL, rev) : null;
                return (
                  <Box key={i}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, wordBreak: 'break-all' }}>
                      {prettyRepo(s.repoURL)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {s.path
                        ? `path: ${s.path}`
                        : s.chart
                        ? `chart: ${s.chart}`
                        : ''}
                      {s.targetRevision ? ` · rev: ${s.targetRevision}` : ''}
                    </Typography>
                    {rev && (
                      <Tooltip title={rev}>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {url ? (
                            <Box
                              component="a"
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                color: 'primary.main',
                                textDecoration: 'none',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {shortSHA(rev)} <Box component="span" sx={{ color: 'text.secondary' }}>(HEAD)</Box>
                            </Box>
                          ) : (
                            <span>
                              {shortSHA(rev)}{' '}
                              <Box component="span" sx={{ color: 'text.secondary' }}>(HEAD)</Box>
                            </span>
                          )}
                        </Typography>
                      </Tooltip>
                    )}
                  </Box>
                );
              })
            )}
          </Stack>
        </Column>

        <Column>
          <SectionTitle>
            Managed resources{' '}
            {safe.resources.length > 0 && <CountChip n={safe.resources.length} />}
          </SectionTitle>
          {safe.resources.length === 0 ? (
            <Empty text="No managed resources reported yet." />
          ) : (
            <Box
              sx={theme => ({
                maxHeight: 240,
                overflowY: 'auto',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              })}
            >
              <Stack divider={<Box sx={{ borderTop: theme => `1px solid ${theme.palette.divider}` }} />}>
                {safe.resources.slice(0, 50).map((r, i) => (
                  <ManagedResourceRow key={i} resource={r} />
                ))}
              </Stack>
              {safe.resources.length > 50 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 1, fontSize: '0.7rem', textAlign: 'center' }}
                >
                  {safe.resources.length - 50} more (showing first 50).
                </Typography>
              )}
            </Box>
          )}
        </Column>

        <Column>
          <SectionTitle>
            Conditions{' '}
            {safe.conditions.length > 0 && <CountChip n={safe.conditions.length} tone="warn" />}
          </SectionTitle>
          {safe.conditions.length === 0 ? (
            <Empty text="No conditions reported." />
          ) : (
            <Stack spacing={1}>
              {safe.conditions.map((c, i) => (
                <Box
                  key={i}
                  sx={theme => ({
                    p: 1,
                    borderLeft: `3px solid ${theme.palette.warning.main}`,
                    border: `1px solid ${theme.palette.divider}`,
                    borderLeftWidth: 3,
                    borderRadius: 1,
                  })}
                >
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'warning.main' }}>
                    {c.type}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                    {c.message}
                  </Typography>
                  {c.lastTransitionTime && (
                    <Tooltip title={absoluteTime(c.lastTransitionTime)}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 0.5 }}>
                        {relativeTime(c.lastTransitionTime)}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </Column>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {safe.sourceType && <MetaChip label={`type: ${safe.sourceType}`} />}
        <MetaChip
          label={
            safe.automated
              ? `auto-sync${safe.automated.prune ? ' + prune' : ''}${
                  safe.automated.selfHeal ? ' + selfHeal' : ''
                }`
              : 'manual sync'
          }
        />
        {safe.ignoreCount > 0 && (
          <MetaChip label={`${safe.ignoreCount} ignoreDifferences`} tone="warn" />
        )}
        {safe.revisionHistoryLimit !== undefined && (
          <MetaChip label={`history: ${safe.revisionHistoryLimit}`} />
        )}
        <MetaChip label={`AppProject: ${safe.appProject}`} />
      </Box>
    </Box>
  );
}

function ManagedResourceRow({
  resource,
}: {
  resource: { kind: string; name: string; namespace?: string; health?: { status?: string } };
}) {
  const theme = useTheme();
  const dotColor =
    HEALTH_COLOR_KEY[resource.health?.status ?? 'Unknown'] ?? 'text.secondary';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.6 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.78rem',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {resource.kind}/{resource.name}
        </Typography>
        {resource.namespace && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            ns: {resource.namespace}
          </Typography>
        )}
      </Box>
      {resource.health?.status && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor:
                dotColor === 'success'
                  ? theme.palette.success.main
                  : dotColor === 'info'
                  ? theme.palette.info.main
                  : dotColor === 'error'
                  ? theme.palette.error.main
                  : dotColor === 'warning'
                  ? theme.palette.warning.main
                  : theme.palette.text.secondary,
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {resource.health.status}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
      {children}
    </Box>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: 'text.secondary',
        fontWeight: 600,
        mb: 1,
      }}
    >
      {children}
    </Typography>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
      {text}
    </Typography>
  );
}

function CountChip({ n, tone = 'default' }: { n: number; tone?: 'default' | 'warn' }) {
  return (
    <Box
      component="span"
      sx={theme => ({
        ml: 0.5,
        fontSize: '0.65rem',
        padding: '0px 6px',
        borderRadius: '8px',
        border: `1px solid ${tone === 'warn' ? theme.palette.warning.main : theme.palette.divider}`,
        color: tone === 'warn' ? theme.palette.warning.main : theme.palette.text.secondary,
        verticalAlign: 'middle',
      })}
    >
      {n}
    </Box>
  );
}

function prettyRepo(url?: string): string {
  if (!url) return '(no repo)';
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^git@/, '')
    .replace(/:/, '/')
    .replace(/\.git$/, '');
}

interface SafeApp {
  sources: { repoURL?: string; path?: string; chart?: string; targetRevision?: string }[];
  revisions: string[];
  resources: {
    kind: string;
    name: string;
    namespace?: string;
    health?: { status?: string };
  }[];
  conditions: { type: string; message: string; lastTransitionTime?: string }[];
  sourceType?: string;
  automated?: { prune?: boolean; selfHeal?: boolean };
  ignoreCount: number;
  revisionHistoryLimit?: number;
  appProject: string;
}

// Defensive normalisation: every field that could blow up React rendering
// (undefined access, wrong type, missing array) is sanitised here so a
// half-populated Application from the cluster cannot bring down the
// Project Details page.
function normalize(app: ArgoApplicationJSON): SafeApp {
  const sources = Array.isArray(app.spec?.sources) && app.spec.sources.length > 0
    ? app.spec.sources
    : app.spec?.source
    ? [app.spec.source]
    : [];

  const revisions = Array.isArray(app.status?.sync?.revisions) && app.status!.sync!.revisions!.length > 0
    ? app.status!.sync!.revisions!.filter((r): r is string => typeof r === 'string')
    : app.status?.sync?.revision
    ? [app.status.sync.revision]
    : [];

  const resources = Array.isArray(app.status?.resources)
    ? app.status!.resources!
        .filter(r => r && typeof r.kind === 'string' && typeof r.name === 'string')
        .map(r => ({
          kind: r.kind,
          name: r.name,
          namespace: typeof r.namespace === 'string' ? r.namespace : undefined,
          health: r.health && typeof r.health.status === 'string' ? { status: r.health.status } : undefined,
        }))
    : [];

  const conditions = Array.isArray(app.status?.conditions)
    ? app.status!.conditions!
        .filter(c => c && typeof c.type === 'string' && typeof c.message === 'string')
        .map(c => ({
          type: c.type,
          message: c.message,
          lastTransitionTime: typeof c.lastTransitionTime === 'string' ? c.lastTransitionTime : undefined,
        }))
    : [];

  return {
    sources: sources.filter(s => s && typeof s.repoURL === 'string'),
    revisions,
    resources,
    conditions,
    sourceType: typeof app.status?.sourceType === 'string' ? app.status.sourceType : undefined,
    automated: app.spec?.syncPolicy?.automated
      ? {
          prune: !!app.spec.syncPolicy.automated.prune,
          selfHeal: !!app.spec.syncPolicy.automated.selfHeal,
        }
      : undefined,
    ignoreCount: Array.isArray(app.spec?.ignoreDifferences) ? app.spec.ignoreDifferences.length : 0,
    revisionHistoryLimit:
      typeof app.spec?.revisionHistoryLimit === 'number' ? app.spec.revisionHistoryLimit : undefined,
    appProject: typeof app.spec?.project === 'string' ? app.spec.project : '(unknown)',
  };
}
