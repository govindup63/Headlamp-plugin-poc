import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useArgoApplications } from '../hooks/useArgoApplications';
import { EmptyState } from './EmptyState';
import { HealthBadge, SyncBadge } from './StatusBadges';
import { ProjectShape } from '../matchers/projectToApps';
import { shortSHA } from '../utils/revisionLink';
import { relativeTime, absoluteTime } from '../utils/time';

interface Props {
  project: ProjectShape;
  projectResources: any[];
}

/**
 * GitOps card rendered on the Project overview page.
 *
 * Matches Headlamp's native overview card style (Status / Resources /
 * Resource Quotas all use the same Card + CardContent + Typography
 * h6 pattern), so the GitOps card sits next to them as a peer rather
 * than a bolted-on widget.
 */
export function GitOpsOverviewSection({ project, projectResources }: Props) {
  const { matches, loaded, error, isDemoData } = useArgoApplications(project, projectResources);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }} spacing={1}>
          <Typography variant="h6">GitOps</Typography>
          {!loaded && !error ? null : matches.length > 0 ? (
            <Box sx={{ ml: 'auto' }}>
              <DriftBadge matches={matches} isDemoData={isDemoData} />
            </Box>
          ) : null}
        </Stack>

        {error ? (
          <EmptyState variant="rbac-denied" message={error.message} />
        ) : !loaded ? (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Loading Argo CD state…
            </Typography>
            <LinearProgress sx={{ height: 3, borderRadius: 2 }} />
          </Box>
        ) : matches.length === 0 ? (
          <EmptyState variant="no-matches" />
        ) : (
          <ApplicationList matches={matches} />
        )}

        {loaded && matches.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontSize: '0.75rem' }}>
            {matches.length} application{matches.length === 1 ? '' : 's'} · open the{' '}
            <strong>GitOps</strong> tab for the full table.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function DriftBadge({ matches, isDemoData }: { matches: ReturnType<typeof useArgoApplications>['matches']; isDemoData: boolean }) {
  const counts = matches.reduce(
    (acc, m) => {
      if (m.app.status?.sync?.status === 'OutOfSync') acc.outOfSync += 1;
      if (m.app.status?.health?.status === 'Degraded') acc.degraded += 1;
      return acc;
    },
    { outOfSync: 0, degraded: 0 }
  );
  if (isDemoData) {
    return <StatusLabel status="">Demo data</StatusLabel>;
  }
  if (counts.degraded > 0) {
    return <StatusLabel status="error">{counts.degraded} Degraded</StatusLabel>;
  }
  if (counts.outOfSync > 0) {
    return <StatusLabel status="warning">{counts.outOfSync} OutOfSync</StatusLabel>;
  }
  return <StatusLabel status="success">All healthy</StatusLabel>;
}

function ApplicationList({ matches }: { matches: ReturnType<typeof useArgoApplications>['matches'] }) {
  const ranked = [...matches].sort((a, b) => severity(b) - severity(a));
  return (
    <Stack divider={<Box sx={{ borderTop: theme => `1px solid ${theme.palette.divider}` }} />} spacing={0}>
      {ranked.map(({ app, layer }) => {
        const rev = app.status?.sync?.revisions?.[0] ?? app.status?.sync?.revision ?? '';
        const finishedAt = app.status?.operationState?.finishedAt;
        return (
          <Box
            key={`${app.metadata.namespace}/${app.metadata.name}`}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.2, py: 1 }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {app.metadata.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                {rev ? `${shortSHA(rev)} · ` : ''}
                via {layer}
              </Typography>
              {finishedAt && (
                <Tooltip title={absoluteTime(finishedAt)}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    synced {relativeTime(finishedAt)}
                  </Typography>
                </Tooltip>
              )}
            </Box>
            <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
              <SyncBadge status={app.status?.sync?.status} />
              <HealthBadge status={app.status?.health?.status} />
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

function severity(m: ReturnType<typeof useArgoApplications>['matches'][number]): number {
  const s = m.app.status?.sync?.status;
  const h = m.app.status?.health?.status;
  let n = 0;
  if (h === 'Degraded') n += 4;
  if (h === 'Missing') n += 3;
  if (s === 'OutOfSync') n += 2;
  if (h === 'Progressing') n += 1;
  return n;
}
