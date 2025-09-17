import { EditorRoute } from "@/components/editor-route";

export default async function Page({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  return <EditorRoute siteId={siteId} />;
}
