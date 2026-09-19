import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BuilderProvider } from '../app/BuilderProvider';
import { Workspace } from '../app/Workspace';
import { AppShell } from '../components/layout/AppShell';
import { draftCollectionRepository } from '../services/draftCollectionRepository';

export function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  const [found, setFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setFound(false);
        setReady(true);
        return;
      }
      await draftCollectionRepository.migrateLegacyIfNeeded();
      const draft = await draftCollectionRepository.get(id);
      if (cancelled) return;
      setFound(draft != null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!ready) {
    return (
      <AppShell title="Конструктор КП" activeNav="builder">
        <div className="page-content">
          <p className="page-subtitle">Загрузка черновика…</p>
        </div>
      </AppShell>
    );
  }

  if (!id || !found) {
    return (
      <AppShell title="Конструктор КП" activeNav="builder">
        <div className="builder-not-found">
          <h1>Черновик не найден</h1>
          <p className="page-subtitle">Возможно, он был удалён или ссылка устарела.</p>
          <Link to="/" className="page-btn primary" style={{ display: 'inline-flex', marginTop: 16 }}>
            На главную
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <BuilderProvider draftId={id}>
      <AppShell title="Конструктор КП" activeNav="builder" builderMode>
        <Workspace />
      </AppShell>
    </BuilderProvider>
  );
}
