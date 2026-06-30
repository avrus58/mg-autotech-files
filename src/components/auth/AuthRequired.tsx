import Link from "next/link";
import { ArrowRight, Cpu, Home, LockKeyhole, UserPlus } from "lucide-react";

export function AuthRequired({
  title,
  description,
  nextPath,
}: {
  title: string;
  description: string;
  nextPath: string;
}) {
  const loginHref = `/login?redirect=${encodeURIComponent(nextPath)}`;
  const registerHref = `/register?redirect=${encodeURIComponent(nextPath)}`;

  return (
    <main data-no-translate className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-10 text-white">
      <section className="w-full max-w-xl border-y border-white/10 py-10 text-center">
        <Link href="/" className="mx-auto flex w-fit items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-800/50 bg-[#111]">
            <Cpu className="h-6 w-6 text-red-500" />
          </span>
          <span className="text-lg font-black">MG <span className="text-red-500">AUTOTECH</span></span>
        </Link>

        <span className="mx-auto mt-9 flex h-14 w-14 items-center justify-center rounded-lg border border-red-800/50 bg-red-950/25 text-red-400">
          <LockKeyhole className="h-7 w-7" />
        </span>
        <div className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-400">Secure customer access</div>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-zinc-400">{description}</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href={loginHref} className="inline-flex h-13 items-center justify-center rounded-lg bg-[#b1121b] px-5 text-sm font-black">
            Log in securely <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href={registerHref} className="inline-flex h-13 items-center justify-center rounded-lg border border-white/10 px-5 text-sm font-black">
            <UserPlus className="mr-2 h-4 w-4" /> Create account
          </Link>
        </div>
        <Link href="/" className="mt-6 inline-flex items-center text-sm font-bold text-zinc-500 hover:text-white">
          <Home className="mr-2 h-4 w-4" /> Return to homepage
        </Link>
      </section>
    </main>
  );
}
