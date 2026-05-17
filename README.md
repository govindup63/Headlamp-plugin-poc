# headlamp-plugin-argocd-poc

A read-only Argo CD GitOps surface for Headlamp's Projects view. Built as a
working POC for the LFX 2026 Term 2 mentorship proposal targeting
[kubernetes-sigs/headlamp#5260](https://github.com/kubernetes-sigs/headlamp/issues/5260).

Surfaces sync, health, revision, source, destination, and managed-resource
state from Argo CD's `Application` and `AppProject` CRDs inside each
Headlamp Project. Read-only by design.

---

## What the plugin adds

| Surface | Where it appears | Plugin SDK hook |
|---|---|---|
| **GitOps card** on the Project overview | Next to Status / Resources / Resource Quotas | `registerProjectOverviewSection` |
| **GitOps tab** on Project details | Tabs row | `registerProjectDetailsTab` |
| **Application detail drawer** | Inline expansion when a row is clicked | (same tab) |
| **Cross-resource navigation** | Click a managed resource to jump to its Headlamp page | Headlamp `Link routeName=` |

Every UI surface matches Headlamp's native components:

* `Card` + `CardContent` + `Typography variant="h6"` for the overview card, identical to Status / Resources / Resource Quotas.
* `StatusLabel` from Headlamp's CommonComponents for sync and health pills.
* `SectionBox` to wrap the GitOps tab body.
* `Link routeName=` for managed-resource deep links.
* MUI theme colors throughout, never hardcoded hex.

## What the plugin does *not* do (by design)

* No Sync / Refresh / Rollback actions. Strictly read-only.
* No Argo CD REST API calls. Every read goes through Headlamp's existing
  authenticated Kubernetes client to the CRDs at `argoproj.io/v1alpha1`.
* No raw CRD editing surface. Operators see *what is*, not *how to change it*.

## Mapping logic

Applications are matched to Headlamp Projects with a four-layer strategy,
first match wins:

| # | Layer | Match condition |
|---|---|---|
| 1 | **Resource tracking** | Resources in the project namespaces carrying `app.kubernetes.io/instance` label or `argocd.argoproj.io/tracking-id` annotation. Covers all three Argo CD tracking modes. |
| 2 | **Destination match** | `app.spec.destination.namespace` is in the project's namespaces, and the destination cluster matches (by `server` URL or `name`). |
| 3 | **Explicit label** | Application labelled `headlamp.dev/project-id=<project.id>`. |
| 4 | **AppProject metadata** | AppProject's `destinations[]` covers a project namespace. Surfaced as a *candidate* with a warning, because AppProject destinations are permissions, not ownership. |

## Empty and error states

The plugin never silently shows an empty list:

* **CRD absent** &mdash; empty card linking to the Argo CD install docs.
* **No matching Applications** &mdash; one-line hint about the destination match and the `headlamp.dev/project-id` opt-in label.
* **RBAC denied** &mdash; inline message naming the missing verb (`list` / `watch`), resource (`applications.argoproj.io`), and namespace.

## File layout

```
src/
  index.tsx                          # entry: two registrations
  api/
    application.ts                   # Application CR class via makeCustomResourceClass + types
    appProject.ts                    # AppProject CR class
  hooks/
    useArgoApplications.ts           # cluster-aware fetch hook + four-layer matcher invocation
  matchers/
    projectToApps.ts                 # the four-layer matcher (with namespace glob support)
  components/
    GitOpsOverviewSection.tsx        # Project overview card (Card + CardContent + StatusLabel)
    GitOpsTab.tsx                    # Project details tab + Application table with drift highlight
    ApplicationDetail.tsx            # expandable per-row detail (sources, managed resources, conditions)
    StatusBadges.tsx                 # SyncBadge, HealthBadge wrapping Headlamp's StatusLabel
    EmptyState.tsx                   # no-CRD / no-matches / RBAC-denied variants
  utils/
    argocdLabels.ts                  # constants from argo-cd/common/common.go
    revisionLink.ts                  # repoURL + revision -> clickable commit URL
    resourceRoute.ts                 # Argo CD resource kind -> Headlamp route name + params
    time.ts                          # relative + absolute time formatting
    demoData.ts                      # in-plugin fallback so the UI renders even when the live fetch fails
```

## Prerequisites

* Headlamp **v0.40+** (the Projects feature became visible on the Home tab in v0.40).
* Argo CD installed in the cluster (`applications.argoproj.io` CRD present).
* Kubernetes RBAC granting `get`, `list`, `watch` on
  `applications.argoproj.io` and `appprojects.argoproj.io` to the identity
  Headlamp is using.
* At least one Kubernetes namespace labelled as a Headlamp Project:
  ```bash
  kubectl label namespace <ns> headlamp.dev/project-id=<your-project-name>
  ```

## RBAC sample

Minimum read-only ClusterRole for the plugin to render against any namespace:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: headlamp-argocd-readonly
rules:
- apiGroups: ["argoproj.io"]
  resources: ["applications", "appprojects"]
  verbs: ["get", "list", "watch"]
```

For namespace-scoped installs, swap to a `Role` + `RoleBinding` in the
namespace that holds Argo CD Applications (typically `argocd`).

## Running locally

```bash
# Install
npm install

# Type-check
npm run tsc

# Bring up a dev cluster + Argo CD (in another shell)
kind create cluster
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=available deploy --all -n argocd --timeout=300s
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/master/docs/getting_started/application.yaml

# Label a namespace as a Headlamp Project
kubectl label ns default headlamp.dev/project-id=demo --overwrite

# Build the plugin and copy it into Headlamp's plugin dir (watch mode)
npm start
```

Then launch the Headlamp desktop app, choose your cluster, and navigate to
**Home → Projects → demo**. The GitOps card appears on the overview tab and
the **GitOps** tab on the details page lists the Argo CD `guestbook`
Application with Synced + Healthy + revision.

## Argo CD edge cases handled

* **Three tracking modes** &mdash; reads both the
  `app.kubernetes.io/instance` label and the
  `argocd.argoproj.io/tracking-id` annotation, so it works regardless of
  `application.resourceTrackingMethod` setting on `argocd-cm`.
* **Multi-source Applications** &mdash; if `spec.sources` is present, each
  source is rendered as a separate row in the detail drawer with its own
  revision chip and source link, and `spec.source` is treated as ignored.
* **App-in-any-namespace** &mdash; matcher does not assume Applications live
  in `argocd`; works wherever they are.
* **Destination by name vs server** &mdash; both `spec.destination.server`
  (URL) and `spec.destination.name` (cluster name) are supported.
* **Cluster-wide vs namespace-scoped CRD list paths** &mdash; the hook tries
  both and the first that succeeds wins.
* **`useClusterURL: false` on Project pages** &mdash; Headlamp does not bind a
  cluster context to Project URLs, so the hook reads the cluster from the
  `ProjectDefinition.clusters[0]` payload that Headlamp passes the plugin
  and forwards it explicitly to `ApiProxy.clusterRequest`.

## Limitations

* Cluster-wide Applications view, workload-table column, "Open in Argo CD"
  button, and plugin settings are explicitly **post-MVP** in the proposal
  and are not in this POC.
* No Sync / Refresh / Rollback actions. These are part of the issue's
  "Future Enhancements" list and are not implemented.
* End-to-end Playwright suite is part of the proposal scope, not yet in
  this POC.
* If the live CRD fetch fails on the user's cluster, the plugin falls back
  to in-plugin demo data with a visible warning so the UI is still
  inspectable for design review. The fallback shape exactly matches the
  real CRD shape.

## Status

* TypeScript compiles cleanly against `@kinvolk/headlamp-plugin@0.14.0`.
* Verified rendering against a real Argo CD installation in a managed
  Kubernetes cluster (DigitalOcean DOKS) with two production Applications
  (`remotestar-backend`, `secret-manager`).
* Tracked PRs against `kubernetes-sigs/headlamp` once the issue opens for
  contributions are listed at
  [github.com/kubernetes-sigs/headlamp/pulls?q=is:pr+govindup63](https://github.com/kubernetes-sigs/headlamp/pulls?q=is:pr+govindup63).

## License

Apache 2.0.
