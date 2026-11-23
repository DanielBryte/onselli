import Link from 'next/link';
import CreatorNav from '../CreatorNav';
import CreatorProductLibrary from '../CreatorProductLibrary';

export default function CreatorMediaPage() {
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main"><header className="creator-dashboard__topbar creator-dashboard__topbar--media-library"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Media Library</strong></div></header><CreatorProductLibrary mediaOnly/></div></main>;
}
