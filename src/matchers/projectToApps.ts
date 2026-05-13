import { ArgoApplicationJSON } from '../api/application';
import { ArgoAppProjectJSON } from '../api/appProject';
import { HEADLAMP_PROJECT_ID_LABEL, IN_CLUSTER_SERVER } from '../utils/argocdLabels';

// Minimal shape of what Headlamp passes a plugin for a Project.
// See frontend/src/redux/projectsSlice.ts in the Headlamp tree:
//   export interface ProjectDefinition { id: string; namespaces: string[]; clusters: string[]; }
export interface ProjectShape {
  id: string;
  namespaces: string[];
  clusters: string[];
}

export type MatchLayer =
  | 'resource-tracking'
  | 'destination'
  | 'label'
  | 'app-project-metadata';

export interface AppMatch {
  app: ArgoApplicationJSON;
  layer: MatchLayer;
  // AppProject layer matches are informational, not authoritative.
  warning?: string;
}

/**
 * Match Argo CD Applications to a Headlamp Project using a four-layer
 * strategy. Earlier layers win.
 *
 *  1. Resource tracking (primary, authoritative)
 *     The most reliable signal because it reflects what is actually
 *     deployed in the project's namespaces. Resources carry
 *       - label  app.kubernetes.io/instance
 *       - annotation argocd.argoproj.io/tracking-id
 *     The value resolves back to the owning Application.
 *
 *  2. Destination match (covers not-yet-synced apps)
 *     app.spec.destination.namespace ∈ project.namespaces AND the
 *     destination cluster matches the current Headlamp context
 *     (Argo CD supports destination.server URL OR destination.name).
 *
 *  3. Explicit label (opt-in claim)
 *     Application carries headlamp.dev/project-id=<project.id>.
 *
 *  4. AppProject metadata (informational only, flagged)
 *     AppProject's destinations cover one of the project namespaces.
 *     This is permission, not assignment, so we always flag it.
 *
 * The POC takes the project shape + the already-fetched lists. In the real
 * plugin these come from useArgoApplications and the K8s client.
 */
export function matchProjectToApps(
  project: ProjectShape,
  apps: ArgoApplicationJSON[],
  appProjects: ArgoAppProjectJSON[],
  // Mapping of K8s resources we already know about in the project namespaces.
  // key: `${namespace}/${kind}/${name}` -> instance label / tracking id value
  trackedResourceOwners: Map<string, string>
): AppMatch[] {
  const claimed = new Map<string, AppMatch>(); // by app uid or name+ns

  const keyOf = (a: ArgoApplicationJSON) => `${a.metadata.namespace}/${a.metadata.name}`;

  // --- Layer 1: resource tracking (primary) -------------------------------
  // Walk every tracked resource we already see in the project namespaces and
  // resolve its owning Application by name.
  const trackedAppKeys = new Set<string>();
  for (const ownerValue of trackedResourceOwners.values()) {
    // Argo CD writes either "<app>" (label) or "<app>:<group>/<kind>:<ns>/<name>"
    // (annotation tracking-id). Take the first colon-separated segment.
    const appName = ownerValue.split(':')[0].trim();
    if (appName) trackedAppKeys.add(appName);
  }
  for (const app of apps) {
    if (trackedAppKeys.has(app.metadata.name)) {
      claimed.set(keyOf(app), { app, layer: 'resource-tracking' });
    }
  }

  // --- Layer 2: destination match (secondary) ------------------------------
  for (const app of apps) {
    if (claimed.has(keyOf(app))) continue;
    const dest = app.spec.destination;
    if (!project.namespaces.includes(dest.namespace)) continue;

    // Argo CD lets you match by server URL OR by registered cluster name.
    const matchesCluster =
      dest.server === IN_CLUSTER_SERVER ||
      (dest.name && project.clusters.includes(dest.name)) ||
      (dest.server && project.clusters.some(c => dest.server!.includes(c)));

    if (matchesCluster) {
      claimed.set(keyOf(app), { app, layer: 'destination' });
    }
  }

  // --- Layer 3: explicit label (opt-in claim) ------------------------------
  for (const app of apps) {
    if (claimed.has(keyOf(app))) continue;
    const projectLabel = app.metadata.labels?.[HEADLAMP_PROJECT_ID_LABEL];
    if (projectLabel === project.id) {
      claimed.set(keyOf(app), { app, layer: 'label' });
    }
  }

  // --- Layer 4: AppProject metadata (informational, flagged) ---------------
  const appProjectsByName = new Map(appProjects.map(p => [p.metadata.name, p]));
  for (const app of apps) {
    if (claimed.has(keyOf(app))) continue;
    const ap = appProjectsByName.get(app.spec.project);
    if (!ap?.spec.destinations) continue;

    const projectNsCovered = ap.spec.destinations.some(d =>
      project.namespaces.some(ns => matchNamespaceGlob(d.namespace, ns))
    );
    if (projectNsCovered) {
      claimed.set(keyOf(app), {
        app,
        layer: 'app-project-metadata',
        warning:
          `AppProject "${ap.metadata.name}" permits this namespace, ` +
          `which is not the same as assignment. Verify ownership manually.`,
      });
    }
  }

  return Array.from(claimed.values());
}

// Match Argo CD destination namespace patterns. They support simple "*"
// glob style: e.g. "team-acme-*" should match "team-acme-prod".
function matchNamespaceGlob(pattern: string, ns: string): boolean {
  if (pattern === '*' || pattern === ns) return true;
  if (!pattern.includes('*')) return false;
  const regex = new RegExp(
    '^' + pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'
  );
  return regex.test(ns);
}
