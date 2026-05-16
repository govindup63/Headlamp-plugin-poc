import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { ApiProxy, K8s } from '@kinvolk/headlamp-plugin/lib';
import type { GraphSource } from '../graph-types';
import { ArgoApplicationJSON } from '../api/application';

/**
 * A custom Map source that adds "Argo CD Applications" as a top-level
 * "Group By" option in Headlamp's resource map.
 *
 * Each Argo CD Application becomes a parent container node. Inside it,
 * the managed Kubernetes resources from `status.resources[]` are rendered
 * as child nodes. This gives operators an at-a-glance view of "what does
 * each GitOps Application actually own in this cluster."
 *
 * Status colour on the parent node:
 *   - Degraded / Missing health   -> error
 *   - OutOfSync                    -> warning
 *   - Synced + Healthy             -> success
 */
export const argoCdMapSource: GraphSource = {
  id: 'argocd-apps',
  label: 'Argo CD Applications',
  isEnabledByDefault: false,
  icon: <Icon icon="mdi:source-branch" width={18} />,
  useData() {
    // Prefer the URL-bound cluster (cluster-wide map). On Project pages
    // the URL is cluster-agnostic, so fall back to the selected-clusters
    // array (Headlamp populates this with project.clusters on those
    // pages). First non-empty value wins.
    const urlCluster = K8s.useCluster();
    const selectedClusters = (K8s as any).useSelectedClusters?.() as string[] | undefined;
    const cluster = urlCluster || selectedClusters?.[0] || '';
    const [apps, setApps] = useState<ArgoApplicationJSON[] | null>(null);

    useEffect(() => {
      if (!cluster) {
        setApps([]);
        return;
      }
      let cancelled = false;
      const paths = [
        '/apis/argoproj.io/v1alpha1/applications',
        '/apis/argoproj.io/v1alpha1/namespaces/argocd/applications',
      ];
      (async () => {
        for (const p of paths) {
          try {
            const resp: any = await ApiProxy.clusterRequest(p, { cluster });
            if (!cancelled) setApps(resp?.items ?? []);
            return;
          } catch {
            // try next path
          }
        }
        if (!cancelled) setApps([]);
      })();
      return () => {
        cancelled = true;
      };
    }, [cluster]);

    return useMemo(() => {
      if (apps === null) return null;
      if (apps.length === 0) {
        return { nodes: [], edges: [] };
      }
      const nodes = apps.map(app => buildAppNode(app));
      return { nodes, edges: [] };
    }, [apps]);
  },
};

function buildAppNode(app: ArgoApplicationJSON) {
  const sync = app.status?.sync?.status;
  const health = app.status?.health?.status;
  let status: 'success' | 'warning' | 'error' | undefined;
  if (health === 'Degraded') status = 'error';
  else if (sync === 'OutOfSync' || health === 'Missing') status = 'warning';
  else if (sync === 'Synced' && health === 'Healthy') status = 'success';

  const resources = app.status?.resources ?? [];

  // Plain GraphNode (no kubeObject wrapper): renders via label / subtitle /
  // status / icon. Wrapping with `new KubeObject(...)` caused the map's
  // group-node renderer to crash on Application kind. The downside: the
  // Namespace grouper drops these nodes since they lack metadata.namespace.
  // Users should switch Group By to "Instance" to see them.
  return {
    id: `argocd-app/${app.metadata.namespace}/${app.metadata.name}`,
    label: app.metadata.name,
    subtitle: `${sync ?? 'Unknown'} · ${health ?? 'Unknown'} · ${resources.length} resource${resources.length === 1 ? '' : 's'}`,
    status,
    icon: <Icon icon="mdi:source-branch" width={16} />,
    nodes: resources.map((r, i) => ({
      id: `argocd-app/${app.metadata.name}/${r.namespace ?? ''}/${r.kind}/${r.name}/${i}`,
      label: `${r.kind}/${r.name}`,
      subtitle: r.namespace ? `ns: ${r.namespace}` : undefined,
      status: resourceStatus(r),
    })),
  };
}

function resourceStatus(r: {
  health?: { status?: string };
}): 'success' | 'warning' | 'error' | undefined {
  const h = r.health?.status;
  if (!h) return undefined;
  if (h === 'Healthy') return 'success';
  if (h === 'Degraded' || h === 'Missing') return 'error';
  if (h === 'Progressing' || h === 'Suspended') return 'warning';
  return undefined;
}
