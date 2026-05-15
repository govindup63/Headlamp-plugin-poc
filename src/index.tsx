/*
 * headlamp-plugin-argocd-poc
 *
 * Read-only Argo CD GitOps surface for Headlamp's Projects view.
 * Built for kubernetes-sigs/headlamp#5260.
 */

import {
  registerProjectOverviewSection,
  registerProjectDetailsTab,
} from '@kinvolk/headlamp-plugin/lib';
import { GitOpsOverviewSection } from './components/GitOpsOverviewSection';
import { GitOpsTab } from './components/GitOpsTab';

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
