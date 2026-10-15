import DigitalFileManager from './DigitalFileManager';

export default async function ProductFilesPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <DigitalFileManager productId={productId} />;
}
