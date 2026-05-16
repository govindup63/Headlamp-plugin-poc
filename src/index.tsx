/*
 * headlamp-plugin-argocd-poc
 *
 * Read-only Argo CD GitOps surface for Headlamp's Projects view + Map view.
 * Built as a working POC for the LFX 2026 Term 2 proposal targeting
 * kubernetes-sigs/headlamp#5260.
 *
 * Plugin registrations:
 *   1. Project Overview card  -> GitOps summary tile
 *   2. Project Details tab    -> "GitOps" tab with Application table + drawer
 *   3. KubeObject glance      -> "Argo CD * <app>" badge on managed workloads
 *                                in Headlamp's resource map
 *
 * All state read from the Application + AppProject CRDs through Headlamp's
 * existing authenticated Kubernetes client. No Argo CD REST API calls.
 *
 * Note on tab ordering:
 * The plugin SDK does not currently expose an `order`/`position` field on
 * registerProjectDetailsTab, so custom tabs always render after the default
 * tabs (Overview, Resources, Access, Map). Moving the GitOps tab to second
 * position requires a small upstream change to Headlamp's plugin SDK and is
 * tracked as future work in the proposal's Week 1 design-lock items.
 */

import {
  registerProjectOverviewSection,
  registerProjectDetailsTab,
  registerKubeObjectGlance,
} from '@kinvolk/headlamp-plugin/lib';
import { GitOpsOverviewSection } from './components/GitOpsOverviewSection';
import { GitOpsTab } from './components/GitOpsTab';
import { ArgoCDMapGlance } from './components/MapGlance';

registerProjectOverviewSection({
  id: 'argocd.overview',
  component: ({ project, projectResources }) => (
    <GitOpsOverviewSection project={project} projectResources={projectResources} />
  ),
});

registerProjectDetailsTab({
  id: 'argocd.gitops',
  label: 'GitOps',
  icon: 'mdi:source-branch',
  component: ({ project, projectResources }) => (
    <GitOpsTab project={project} projectResources={projectResources} />
  ),
});

registerKubeObjectGlance({
  id: 'argocd.mapGlance',
  component: ({ node }) => <ArgoCDMapGlance node={node} />,
});

// A registerMapSource implementation (in `sources/argoCdMapSource.tsx`) is
// scaffolded but intentionally not registered: rendering custom CRD nodes
// inside Headlamp's GroupNode requires upstream changes (the namespace
// grouper drops plain GraphNodes; wrapping with KubeObject crashes the
// renderer on unknown kinds). The Map glance above already surfaces the
// Argo CD app name on every managed workload, which covers the issue
// #5260 "cross-resource navigation" requirement.
