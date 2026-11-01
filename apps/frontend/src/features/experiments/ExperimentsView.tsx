import { Cpu } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Alert } from '../../components/ui';

/**
 * Controlled attacker experiments are phase B4. The backend contract defines
 * POST /investigations/{id}/experiments but it returns 501, and there is no
 * list endpoint, so nothing is faked here.
 */
export function ExperimentsView({ investigationId }: { investigationId: string | null }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-indigo-700" aria-hidden="true" />
          <div>
            <CardTitle>Controlled Attacker Experiments</CardTitle>
            <CardDescription>Optional, reported separately from exposure findings.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Alert variant="info" title="Not available yet (backend phase B4)">
          The backend returns HTTP 501 for experiments. Exposure findings and reports above do not depend on them.
          {investigationId && <> Current investigation: <code>{investigationId}</code>.</>}
        </Alert>
      </CardContent>
    </Card>
  );
}
