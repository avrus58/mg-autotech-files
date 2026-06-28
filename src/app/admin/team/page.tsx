"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Crown,
  Loader2,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { signOutIfEmailUnverified } from "@/lib/authGuards";
import { supabase } from "@/lib/supabaseClient";
import {
  staffPermissionOptions,
  staffRoleDefaults,
  type StaffPermission,
  type StaffRole,
} from "@/lib/staffPermissions";

type TeamProfile = {
  id: string;
  email: string | null;
  customer_id: string | null;
  full_name: string | null;
  company_name: string | null;
  role: string | null;
  staff_role: StaffRole | null;
  staff_permissions: string[] | null;
  staff_updated_at: string | null;
  account_status: string | null;
  created_at: string | null;
};

type EditableRole = "customer" | Exclude<StaffRole, "owner">;

export default function AdminTeamPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<TeamProfile[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedRole, setSelectedRole] = useState<EditableRole>("customer");
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);

  const authorizedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Unauthorized");
    return fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  }, []);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }
    if (await signOutIfEmailUnverified(userData.user)) {
      router.push("/login?verify_email=1");
      return;
    }

    try {
      const response = await authorizedFetch("/api/admin/team", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setSetupRequired(Boolean(data.setupRequired));
        setMessage(data.error || "Team access could not be loaded.");
        return;
      }
      setProfiles(data.profiles ?? []);
      setOwnerId(data.ownerId ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Team access could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, router]);

  useEffect(() => {
    void Promise.resolve().then(loadTeam);
  }, [loadTeam]);

  const selected = profiles.find((profile) => profile.id === selectedId) ?? null;
  const filteredProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter((profile) =>
      [profile.email, profile.customer_id, profile.full_name, profile.company_name, profile.staff_role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [profiles, search]);

  function selectProfile(profile: TeamProfile) {
    setSelectedId(profile.id);
    setSelectedRole(
      profile.role === "staff" && profile.staff_role && profile.staff_role !== "owner"
        ? profile.staff_role
        : "customer"
    );
    setPermissions(
      (profile.staff_permissions ?? []).filter((value): value is StaffPermission =>
        staffPermissionOptions.some((item) => item.key === value)
      )
    );
    setMessage("");
  }

  function changeRole(role: EditableRole) {
    setSelectedRole(role);
    setPermissions(role === "customer" ? [] : staffRoleDefaults[role]);
  }

  function togglePermission(permission: StaffPermission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  }

  async function saveAccess() {
    if (!selected || selected.id === ownerId || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selected.id,
          staffRole: selectedRole,
          permissions,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Staff access could not be saved.");
        return;
      }
      setProfiles((current) =>
        current.map((profile) => profile.id === data.profile.id ? data.profile : profile)
      );
      setMessage("Staff access updated and added to the security audit log.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Staff access could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-red-500" />
        Loading team security...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/10 bg-black/80">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-800/50 bg-red-950/25">
              <LockKeyhole className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Primary Owner</div>
              <h1 className="text-xl font-black sm:text-2xl">Team & Permissions</h1>
            </div>
          </div>
          <Link href="/admin" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black">
            <ArrowLeft className="mr-2 inline h-4 w-4" />Admin Panel
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-8">
        <div className="mb-7 max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-700/30 bg-emerald-950/20 px-3 py-1.5 text-xs font-black text-emerald-300">
            <ShieldCheck className="h-4 w-4" />Database-enforced access
          </div>
          <h2 className="text-3xl font-black sm:text-4xl">One permanent owner. Controlled staff access.</h2>
          <p className="mt-3 leading-7 text-zinc-400">
            Promote an existing customer account to staff, choose a working role and grant only the permissions required for that person.
          </p>
        </div>

        {message && (
          <div className={`mb-6 rounded-xl border p-4 text-sm ${setupRequired ? "border-amber-700/40 bg-amber-950/25 text-amber-200" : "border-red-800/40 bg-red-950/25 text-red-200"}`}>
            {message}
            {setupRequired && (
              <div className="mt-2 text-xs text-amber-100/70">
                Run <strong>scripts/add-staff-access-notifications.sql</strong> in Supabase SQL Editor.
              </div>
            )}
          </div>
        )}

        {!setupRequired && (
          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="min-w-0 border-y border-white/10 py-5 xl:border-y-0 xl:border-r xl:py-0 xl:pr-6">
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer or staff..." className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 outline-none focus:border-red-700" />
              </div>
              <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
                {filteredProfiles.map((profile) => {
                  const isOwner = profile.staff_role === "owner";
                  const active = profile.id === selectedId;
                  return (
                    <button key={profile.id} type="button" onClick={() => selectProfile(profile)} className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-4 text-left transition ${active ? "border-red-700 bg-red-950/30" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.06]"}`}>
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isOwner ? "bg-amber-500/15 text-amber-300" : "bg-red-950/35 text-red-400"}`}>
                        {isOwner ? <Crown className="h-5 w-5" /> : <UserCog className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-black">{profile.full_name || profile.company_name || profile.email || "Customer"}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{profile.email || profile.customer_id}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs font-black uppercase ${isOwner ? "text-amber-300" : profile.role === "staff" ? "text-emerald-300" : "text-zinc-500"}`}>
                          {isOwner ? "Owner" : profile.staff_role || "Customer"}
                        </div>
                        <ChevronRight className="ml-auto mt-1 h-4 w-4 text-zinc-600" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="min-w-0">
              {!selected ? (
                <div className="flex min-h-[460px] items-center justify-center rounded-2xl border border-dashed border-white/15 text-center text-zinc-500">
                  <div><Users className="mx-auto mb-4 h-10 w-10" />Select a customer or staff account.</div>
                </div>
              ) : selected.id === ownerId || selected.staff_role === "owner" ? (
                <div className="rounded-2xl border border-amber-700/30 bg-amber-950/15 p-7">
                  <Crown className="h-10 w-10 text-amber-300" />
                  <h3 className="mt-5 text-3xl font-black">Primary Owner</h3>
                  <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
                    This is the permanent top-level account. Its role, permissions and ownership cannot be changed or removed by another account.
                  </p>
                  <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-bold">Full system access</div>
                </div>
              ) : (
                <div>
                  <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-red-500">Access profile</div>
                      <h3 className="mt-2 break-words text-2xl font-black">{selected.full_name || selected.company_name || selected.email}</h3>
                      <div className="mt-1 text-sm text-zinc-500">{selected.email}</div>
                    </div>
                    <button onClick={saveAccess} disabled={saving} className="rounded-xl bg-[#b1121b] px-5 py-3 text-sm font-black transition hover:bg-[#c91824] disabled:opacity-50">
                      {saving ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Save className="mr-2 inline h-4 w-4" />}
                      Save Access
                    </button>
                  </div>

                  <div className="mb-7">
                    <h4 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-zinc-400">Role</h4>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {(["customer", "manager", "calibrator", "support"] as EditableRole[]).map((role) => (
                        <button key={role} type="button" onClick={() => changeRole(role)} className={`rounded-xl border px-4 py-4 text-left font-black capitalize transition ${selectedRole === role ? "border-red-700 bg-red-950/30 text-white" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"}`}>
                          {role}
                          {selectedRole === role && <Check className="ml-2 inline h-4 w-4 text-red-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedRole !== "customer" && (
                    <div>
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-[0.16em] text-zinc-400">Permissions</h4>
                          <p className="mt-1 text-sm text-zinc-500">Database rules enforce every permission independently.</p>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-300">{permissions.length} enabled</div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {staffPermissionOptions.map((permission) => {
                          const enabled = permissions.includes(permission.key);
                          const ownerOnly = permission.key === "staff.manage";
                          return (
                            <button key={permission.key} type="button" disabled={ownerOnly} onClick={() => togglePermission(permission.key)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${enabled ? "border-emerald-700/40 bg-emerald-950/20" : "border-white/10 bg-white/[0.025]"} ${ownerOnly ? "cursor-not-allowed opacity-45" : "hover:border-red-800/50"}`}>
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${enabled ? "border-emerald-500 bg-emerald-500 text-black" : "border-zinc-700"}`}>{enabled && <Check className="h-4 w-4" />}</span>
                              <span><span className="block font-black">{permission.label}</span><span className="mt-1 block text-xs text-zinc-500">{ownerOnly ? "Primary Owner only" : permission.group}</span></span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
