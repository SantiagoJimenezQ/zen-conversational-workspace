import Link from "next/link";
import { notFound } from "next/navigation";
import { sources } from "@/lib/zen/sources";
import { sourceIdSchema } from "@/lib/zen/schema";
export default async function GuideTopic({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const result = sourceIdSchema.safeParse(topic);
  if (!result.success) notFound();
  const guide = sources[result.data];
  return (
    <main className="guide-page">
      <Link href="/guide">← Demo guide</Link>
      <h1>{guide.title}</h1>
      <p>{guide.excerpt}</p>
      <p className="guide-note">
        Illustrative product behavior · No external account connected
      </p>
      <Link href="/">Try it with Zen →</Link>
    </main>
  );
}
