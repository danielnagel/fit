import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SessionStart from './SessionStart';
import SessionRunner from './SessionRunner';

export default function Training() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState<number | null>(null);

  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (sessionParam) setSessionId(Number(sessionParam));
  }, [searchParams]);

  const finishSession = () => {
    setSessionId(null);
    setSearchParams({}, { replace: true });
  };

  if (sessionId !== null) {
    return <SessionRunner sessionId={sessionId} onFinished={finishSession} />;
  }

  return (
    <section className="card">
      <h2 className="mb-4">Training</h2>
      <SessionStart onStarted={setSessionId} />
    </section>
  );
}
