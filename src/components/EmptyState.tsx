import * as React from 'react';
import { Box, Link, Typography } from '@mui/material';

/**
 * Shown in three variants:
 *
 *  - no-crd       : applications.argoproj.io is not installed
 *  - no-matches   : Argo CD is installed but no Applications target this project
 *  - rbac-denied  : list permission is denied
 *
 * The plugin never silently shows an empty list; the user always knows
 * which condition is the cause.
 */
export type EmptyStateVariant = 'no-crd' | 'no-matches' | 'rbac-denied';

export function EmptyState({
  variant,
  message,
}: {
  variant: EmptyStateVariant;
  message?: string;
}) {
  return (
    <Box
      sx={{
        textAlign: 'center',
        padding: '24px 16px',
        border: '1px dashed #D0D7DE',
        borderRadius: 2,
        color: '#5F6368',
      }}
    >
      {variant === 'no-crd' && (
        <>
          <Typography variant="subtitle1" sx={{ color: '#1F3A5F', fontWeight: 600 }}>
            Argo CD is not installed on this cluster
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Install Argo CD to see GitOps state here. See the{' '}
            <Link
              href="https://argo-cd.readthedocs.io/en/stable/getting_started/"
              target="_blank"
              rel="noreferrer"
            >
              Argo CD getting started guide
            </Link>
            .
          </Typography>
        </>
      )}
      {variant === 'no-matches' && (
        <>
          <Typography variant="subtitle1" sx={{ color: '#1F3A5F', fontWeight: 600 }}>
            No Argo CD Applications target this project
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Applications are matched by destination namespace, or by the{' '}
            <code>headlamp.dev/project-id</code> label for explicit claims.
          </Typography>
        </>
      )}
      {variant === 'rbac-denied' && (
        <>
          <Typography variant="subtitle1" sx={{ color: '#842029', fontWeight: 600 }}>
            Read access denied
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Grant <code>list</code> and <code>watch</code> on{' '}
            <code>applications.argoproj.io</code> in the relevant namespace, or ask your
            cluster admin. {message ? `Server said: ${message}` : ''}
          </Typography>
        </>
      )}
    </Box>
  );
}
