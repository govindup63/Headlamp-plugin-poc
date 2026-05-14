import * as React from 'react';
import { StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Box } from '@mui/material';
import { HealthStatus, SyncStatus } from '../api/application';

// Map Argo CD sync/health states to Headlamp's StatusLabel variants.
// Using Headlamp's own StatusLabel keeps the plugin visually identical
// to every other status pill in the cluster UI.

const SYNC_VARIANT: Record<SyncStatus, 'success' | 'warning' | 'error' | ''> = {
  Synced: 'success',
  OutOfSync: 'warning',
  Unknown: '',
};

const HEALTH_VARIANT: Record<HealthStatus, 'success' | 'warning' | 'error' | ''> = {
  Healthy: 'success',
  Progressing: '',
  Degraded: 'error',
  Suspended: '',
  Missing: 'warning',
  Unknown: '',
};

export function SyncBadge({ status }: { status?: SyncStatus }) {
  const s = status ?? 'Unknown';
  return (
    <StatusLabel status={SYNC_VARIANT[s]} aria-label={`Sync status: ${s}`}>
      {s}
    </StatusLabel>
  );
}

export function HealthBadge({ status }: { status?: HealthStatus }) {
  const s = status ?? 'Unknown';
  return (
    <StatusLabel status={HEALTH_VARIANT[s]} aria-label={`Health status: ${s}`}>
      {s}
    </StatusLabel>
  );
}

// Small monochrome meta chip for source-type, auto-sync, ignoreDifferences.
// Border-only design with no fill: respects both light and dark themes
// without depending on plugin theme propagation.
export function MetaChip({ label, tone = 'default' }: { label: string; tone?: 'default' | 'warn' }) {
  return (
    <Box
      component="span"
      sx={theme => ({
        display: 'inline-block',
        fontSize: '0.7rem',
        color: tone === 'warn' ? theme.palette.warning.main : theme.palette.text.secondary,
        border: `1px solid ${tone === 'warn' ? theme.palette.warning.main : theme.palette.divider}`,
        borderRadius: '3px',
        padding: '1px 6px',
        marginRight: '4px',
        marginTop: '2px',
        whiteSpace: 'nowrap',
      })}
    >
      {label}
    </Box>
  );
}
