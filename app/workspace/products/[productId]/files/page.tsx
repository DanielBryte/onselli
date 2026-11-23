import Link from 'next/link';
import CreatorNav from '../../../CreatorNav';
import DigitalFileManager from './DigitalFileManager';

export default async function ProductFilesPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main">
    <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><Link href="/workspace/products">Products</Link><span>/</span><strong>Files</strong></div></header>
    <DigitalFileManager productId={productId}/>
  </div></main>;
}
