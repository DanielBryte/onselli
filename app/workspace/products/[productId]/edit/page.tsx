import CreatorNav from '../../../CreatorNav';
import EditProductForm from './EditProductForm';

export default async function EditProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main"><EditProductForm productId={productId}/></div></main>;
}
