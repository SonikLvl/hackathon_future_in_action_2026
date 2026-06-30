import { BraceletPage } from "../bracelet/BraceletPage";

export function BraceletPreviewPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8">
      <section className="h-180 w-90 overflow-hidden rounded-[44px] border-8 border-slate-800 bg-black shadow-2xl">
        <BraceletPage />
      </section>
    </main>
  );
}
