import CreatorNav from './CreatorNav';

type LoadingVariant = 'table' | 'metrics' | 'panels' | 'chart' | 'media';

/** Shared loading treatment for both route transitions and in-page data requests. */
export function WorkspaceDataLoading({ label, variant = 'panels', showMediaFolders = true }: { label: string; variant?: LoadingVariant; showMediaFolders?: boolean }) {
  return (
    <div className={`workspace-data-loading workspace-data-loading--${variant}`} role="status" aria-busy="true">
      <span className="sr-only">Loading {label}</span>
      <div className="workspace-data-loading__shapes" aria-hidden="true">
        {variant === 'metrics' ? <div className="workspace-data-loading__metrics">{[0, 1, 2, 3].map((key) => <i key={key}/>)}</div> : null}
        {variant === 'table' ? <div className="workspace-data-loading__table"><i/>{[0, 1, 2, 3, 4].map((key) => <i key={key}/>)}</div> : null}
        {variant === 'panels' ? <div className="workspace-data-loading__panels"><i/><i/></div> : null}
        {variant === 'chart' ? <div className="workspace-data-loading__chart"><i/><i/><i/><i/><i/></div> : null}
        {variant === 'media' ? <div className="media-library-loading">
          {showMediaFolders && <section className="media-library-loading__folders" aria-hidden="true"><div className="media-library-loading__heading"><i/><i/></div><div className="media-library-loading__folder-grid">{[0, 1, 2].map((key) => <div key={key}><i/><span><i/><i/></span></div>)}</div></section>}
          <div className="media-library-loading__assets" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((key) => <div className="media-library-loading__asset" key={key}><i/><b/><span><i/><i/></span></div>)}</div>
        </div> : null}
      </div>
    </div>
  );
}

/** Stable dashboard shell shown while a workspace route is being loaded. */
export default function WorkspaceLoading() {
  return (
    <main className="creator-dashboard workspace-route-loading" aria-busy="true">
      <CreatorNav/>
      <div className="creator-dashboard__main">
        <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><span className="sr-only">Loading page</span><i aria-hidden="true"/></div></header>
        <section className="creator-dashboard__body" aria-label="Loading workspace content">
          <span className="sr-only" role="status">Loading workspace page</span>
          <div className="workspace-route-loading__heading" aria-hidden="true"><i/><i/></div>
          <WorkspaceDataLoading label="workspace content" variant="metrics"/>
          <WorkspaceDataLoading label="workspace sections" variant="panels"/>
        </section>
      </div>
    </main>
  );
}
