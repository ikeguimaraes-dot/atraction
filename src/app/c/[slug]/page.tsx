import { CapturePage } from "@/components/capture-page";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CapturePage slug={slug} />;
}
