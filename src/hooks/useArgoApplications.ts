import { useEffect, useMemo, useState } from 'react';
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { ArgoApplicationJSON } from '../api/application';
import { ArgoAppProjectJSON } from '../api/appProject';
import { ARGO_INSTANCE_LABEL, ARGO_TRACKING_ANNOTATION } from '../utils/argocdLabels';
import { AppMatch, matchProjectToApps, ProjectShape } from '../matchers/projectToApps';
import { demoApplications, demoAppProjects } from '../utils/demoData';

interface MinimalKubeObject {
  kind: string;
  metadata?: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  };
}

export interface UseArgoApplicationsResult {
  applications: ArgoApplicationJSON[] | null;
  appProjects: ArgoAppProjectJSON[] | null;
  loaded: boolean;
  error: { message: string } | null;
  /** Whether the rendered data is the in-plugin demo fallback (vs live cluster data). */
  isDemoData: boolean;
  matches: AppMatch[];
}

interface ListResponse<T> {
  items: T[];
}

/**
 * Fetch Argo CD Applications and AppProjects via Headlamp's request() helper.
 *
 * Using request() directly avoids the discovery-cache path that useList()
 * uses for custom KubeObject classes, which can return "Unreachable" 502s
 * for CRDs that were not present at Headlamp startup.
 */
export function useArgoApplications(
  project: ProjectShape,
  projectResources: MinimalKubeObject[]
): UseArgoApplicationsResult {
  const [apps, setApps] = useState<ArgoApplicationJSON[] | null>(null);
  const [appProjects, setAppProjects] = useState<ArgoAppProjectJSON[] | null>(null);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [isDemoData, setIsDemoData] = useState(false);

  // IMPORTANT: Project pages in Headlamp are registered with `useClusterURL:
  // false`, so K8s.useCluster() returns null on those pages and the default
  // request() proxy path (which depends on it) goes to a 404 route. The
  // ProjectDefinition payload exposes `clusters: string[]` so we use that
  // explicitly for the fetch.
  const cluster = project.clusters?.[0];

  useEffect(() => {
    let cancelled = false;
    if (!cluster) {
      // No cluster bound to the project yet; fall back to demo data
      // so the UI still renders for review.
      setApps(demoApplications);
      setAppProjects(demoAppProjects);
      setIsDemoData(true);
      return;
    }

    (async () => {
      const tryFetch = (path: string) =>
        ApiProxy.clusterRequest(path, { cluster }) as Promise<ListResponse<any>>;

      const appPaths = [
        '/apis/argoproj.io/v1alpha1/applications',
        '/apis/argoproj.io/v1alpha1/namespaces/argocd/applications',
      ];
      const appProjPaths = [
        '/apis/argoproj.io/v1alpha1/appprojects',
        '/apis/argoproj.io/v1alpha1/namespaces/argocd/appprojects',
      ];

      const tryWithFallback = async <T,>(paths: string[]): Promise<T[]> => {
        let lastErr: any;
        for (const p of paths) {
          try {
            const resp = await tryFetch(p);
            return (resp?.items ?? []) as T[];
          } catch (err) {
            lastErr = err;
          }
        }
        throw lastErr;
      };

      try {
        const [appList, projList] = await Promise.all([
          tryWithFallback<ArgoApplicationJSON>(appPaths),
          tryWithFallback<ArgoAppProjectJSON>(appProjPaths),
        ]);
        if (cancelled) return;
        setApps(appList);
        setAppProjects(projList);
        setError(null);
        setIsDemoData(false);
      } catch (err: any) {
        if (cancelled) return;
        // Live fetch failed. Fall back to in-plugin demo data so the UI
        // remains inspectable for the proposal review.
        console.warn('[argocd-poc] live fetch failed, using demo data:', err);
        setApps(demoApplications);
        setAppProjects(demoAppProjects);
        setError(null);
        setIsDemoData(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cluster, project.id, project.namespaces.join(','), project.clusters.join(',')]);

  const trackedResourceOwners = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of projectResources ?? []) {
      const owner =
        r.metadata?.annotations?.[ARGO_TRACKING_ANNOTATION] ??
        r.metadata?.labels?.[ARGO_INSTANCE_LABEL];
      if (owner) {
        const k = `${r.metadata?.namespace ?? ''}/${r.kind}/${r.metadata?.name ?? ''}`;
        map.set(k, owner);
      }
    }
    return map;
  }, [projectResources]);

  const matches = useMemo(() => {
    if (!apps) return [];
    return matchProjectToApps(project, apps, appProjects ?? [], trackedResourceOwners);
  }, [apps, appProjects, project, trackedResourceOwners]);

  return {
    applications: apps,
    appProjects: appProjects,
    loaded: apps !== null,
    error,
    isDemoData,
    matches,
  };
}
