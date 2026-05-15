import * as React from 'react';
import { Box } from '@mui/material';
import { StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { ARGO_INSTANCE_LABEL, ARGO_TRACKING_ANNOTATION } from '../utils/argocdLabels';

/**
 * Map-view glance: small "Argo CD · <app-name>" badge on every workload
 * node that is owned by Argo CD.
 *
 * Source-of-truth is whatever Argo CD has written onto the resource:
 *  - app.kubernetes.io/instance label, OR
 *  - argocd.argoproj.io/tracking-id annotation (newer tracking modes).
 *
 * If neither is present, the glance renders nothing so it does not
 * clutter unrelated nodes.
 */
export function ArgoCDMapGlance({ node }: { node: any }) {
  const obj = node?.kubeObject;
  if (!obj) return null;

  // KubeObject can expose metadata via either property; check both.
  const meta =
    (obj as any).metadata ?? (obj as any).jsonData?.metadata ?? {};
  const labels: Record<string, string> = meta.labels ?? {};
  const annotations: Record<string, string> = meta.annotations ?? {};

  const owner =
    annotations[ARGO_TRACKING_ANNOTATION] ?? labels[ARGO_INSTANCE_LABEL];
  if (!owner) return null;

  // tracking-id format: "<app>:<group>/<kind>:<ns>/<name>"
  // label format: just "<app>"
  const appName = String(owner).split(':')[0];
  if (!appName) return null;

  return (
    <Box sx={{ display: 'inline-flex', mt: 1 }}>
      <StatusLabel status="success" aria-label={`Argo CD managed: ${appName}`}>
        Argo CD · {appName}
      </StatusLabel>
    </Box>
  );
}
