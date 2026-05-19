import { mergeCreditWallets } from "@/lib/credit-server";
import { supabaseServer } from "@/lib/supabase/server";
import type { OAuthProfile, SocialProvider } from "@/lib/auth/types";

export type SocialUserRow = {
  id: string;
  auth_user_id: string;
  provider: SocialProvider;
  provider_id: string;
  name: string;
  email: string | null;
  profile_image: string | null;
};

export type UpsertSocialUserResult = {
  authUserId: string;
  loginEmail: string;
  isNewUser: boolean;
  socialUser: SocialUserRow;
  mergedFromAuthUserId?: string;
};

export class AuthConflictError extends Error {
  readonly existingProvider: SocialProvider;
  constructor(existingProvider: SocialProvider) {
    super("email_provider_conflict");
    this.existingProvider = existingProvider;
  }
}

/** 소프트 딜리트된 동일 소셜로 재로그인 시도 */
export class WithdrawalPendingError extends Error {
  constructor() {
    super("withdrawal_pending");
  }
}

/** 마이탭 다중 소셜 연동 비활성 — provider별 별도 auth 계정만 허용 */
export class SocialLinkDisabledError extends Error {
  constructor() {
    super("social_link_disabled");
  }
}

function syntheticEmail(provider: SocialProvider, providerId: string): string {
  return `${provider}.${providerId}@oauth.yeonun.kr`;
}

/** @deprecated 마이탭 다중 연동 비활성 — Google·카카오·네이버는 각각 별도 로그인 */
export async function linkSocialProviderToUser(
  _targetAuthUserId: string,
  _profile: OAuthProfile,
): Promise<UpsertSocialUserResult> {
  throw new SocialLinkDisabledError();
}

/** auth_user_id에 deleted_at 없는 소셜 행이 1개 이상인지 (구글+카카오 등 복수 provider 허용) */
export async function hasActiveSocialUser(authUserId: string): Promise<boolean> {
  const sb = supabaseServer();
  const { count, error } = await sb
    .from("yeonun_social_users")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function findAuthUserIdByVerifiedEmail(email: string): Promise<string | null> {
  const sb = supabaseServer();
  const { data } = await sb
    .from("yeonun_social_users")
    .select("auth_user_id")
    .ilike("email", email.toLowerCase())
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.auth_user_id ? String(data.auth_user_id) : null;
}

export type LinkedSocialAccount = {
  provider: SocialProvider;
  provider_id: string;
  name: string;
  email: string | null;
  last_login_at: string;
};

export async function listLinkedSocialAccounts(authUserId: string): Promise<LinkedSocialAccount[]> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from("yeonun_social_users")
    .select("provider,provider_id,name,email,last_login_at")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .order("last_login_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LinkedSocialAccount[];
}

export async function upsertSocialUser(profile: OAuthProfile): Promise<UpsertSocialUserResult> {
  const sb = supabaseServer();
  const loginEmail = (profile.email || syntheticEmail(profile.provider, profile.providerId)).toLowerCase();

  const { data: row, error: findErr } = await sb
    .from("yeonun_social_users")
    .select("*")
    .eq("provider", profile.provider)
    .eq("provider_id", profile.providerId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);

  if (row?.deleted_at) {
    throw new WithdrawalPendingError();
  }

  if (row) {
    await sb
      .from("yeonun_social_users")
      .update({
        name: profile.name,
        email: profile.email,
        profile_image: profile.profileImage,
        last_login_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    await sb.auth.admin.updateUserById(row.auth_user_id, {
      user_metadata: {
        name: profile.name,
        avatar_url: profile.profileImage,
        provider: profile.provider,
        provider_id: profile.providerId,
      },
    });

    return {
      authUserId: row.auth_user_id,
      loginEmail,
      isNewUser: false,
      socialUser: row as SocialUserRow,
    };
  }

  let authUserId: string | null = null;
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email: loginEmail,
    email_confirm: true,
    user_metadata: {
      name: profile.name,
      avatar_url: profile.profileImage,
      provider: profile.provider,
      provider_id: profile.providerId,
    },
  });

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      const { data: byEmail } = await sb
        .from("yeonun_social_users")
        .select("auth_user_id")
        .eq("email", loginEmail)
        .is("deleted_at", null)
        .maybeSingle();
      if (byEmail?.auth_user_id) {
        authUserId = byEmail.auth_user_id;
      } else {
        throw new Error(`auth_user_create_failed: ${createErr.message}`);
      }
    } else {
      throw new Error(`auth_user_create_failed: ${createErr.message}`);
    }
  } else {
    authUserId = created.user?.id ?? null;
  }

  if (!authUserId) throw new Error("auth_user_missing");

  const { data: inserted, error: insErr } = await sb
    .from("yeonun_social_users")
    .insert({
      auth_user_id: authUserId,
      provider: profile.provider,
      provider_id: profile.providerId,
      name: profile.name,
      email: profile.email,
      profile_image: profile.profileImage,
    })
    .select("*")
    .single();

  if (insErr) throw new Error(insErr.message);

  return {
    authUserId,
    loginEmail,
    isNewUser: true,
    socialUser: inserted as SocialUserRow,
  };
}

/** 어드민 CS: 두 auth UUID 를 primary 로 통합 */
export async function mergeAuthAccountsForAdmin(
  primaryUserId: string,
  secondaryUserId: string,
  memo: string,
): Promise<void> {
  if (primaryUserId === secondaryUserId) return;

  const sb = supabaseServer();
  await mergeCreditWallets(primaryUserId, secondaryUserId, { memo, admin_actor: "admin" });

  const { data: socials } = await sb
    .from("yeonun_social_users")
    .select("id,provider,provider_id")
    .eq("auth_user_id", secondaryUserId)
    .is("deleted_at", null);

  for (const s of socials ?? []) {
    const { data: conflict } = await sb
      .from("yeonun_social_users")
      .select("id")
      .eq("provider", s.provider)
      .eq("provider_id", s.provider_id)
      .eq("auth_user_id", primaryUserId)
      .is("deleted_at", null)
      .maybeSingle();

    if (conflict) {
      await sb.from("yeonun_social_users").delete().eq("id", s.id);
    } else {
      await sb.from("yeonun_social_users").update({ auth_user_id: primaryUserId }).eq("id", s.id);
    }
  }
}
