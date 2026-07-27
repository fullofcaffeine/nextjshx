export const dynamic = "force-dynamic";

export default async function LoadingProofPage() {
  await new Promise<void>((resolve) => setTimeout(resolve, 750));
  return <main id="loading-resolved">LOADING-RESOLVED</main>;
}
