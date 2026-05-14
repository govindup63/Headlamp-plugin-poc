/*
 * headlamp-plugin-argocd-poc
 *
 * Read-only Argo CD GitOps surface for Headlamp's Projects view.
 * Built for kubernetes-sigs/headlamp#5260.
 */

import { registerProjectOverviewSection } from '@kinvolk/headlamp-plugin/lib';
import { GitOpsOverviewSection } from './components/GitOpsOverviewSection';

registerProjectOverviewSection({
  id: 'argocd.overview',
  component: ({ project, projectResources }) => (
    <GitOpsOverviewSection project={project} projectResources={projectResources} />
  ),
});
