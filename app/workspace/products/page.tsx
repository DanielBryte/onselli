import Link from 'next/link';
import CreatorNav from '../CreatorNav';
import CreatorProductLibrary from '../CreatorProductLibrary';

export default function CreatorProductsPage() {
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main"><header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Products</strong></div></header><CreatorProductLibrary/></div></main>;
}
