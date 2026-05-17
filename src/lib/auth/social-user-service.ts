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

function syntheticEmail(provider: SocialProvider, providerId: string): string {
  return `${provider}.${providerId}@oauth.yeonun.kr`;
}

async function reassignSocialAccount(
  targetAuthUserId: string,
  fromAuthUserId: string,
  socialRowId: string,
  profile: OAuthProfile,
): Promise<string | undefined> {
  if (targetAuthUserId === fromAuthUserId) return undefined;

  await mergeCreditWallets(targetAuthUserId, fromAuthUserId, {
    memo: `소셜 계정 통합 (${profile.provider})`,
  });

  const sb = supabaseServer();
  const { data: siblings } = await sb
    .from("yeonun_social_users")
    .select("id")
    .eq("auth_user_id", fromAuthUserId)
    .is("deleted_at", null);

  for (const row of siblings ?? []) {
    await sb
      .from("yeonun_social_users")
      .update({
        auth_user_id: targetAuthUserId,
        ...(row.id === socialRowId
          ? {
              name: profile.name,
              email: profile.email,
              profile_image: profile.profileImage,
              last_login_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq("id", row.id);
  }

  return fromAuthUserId;
}

/** 로그인·마이탭 연동 공통: 소셜을 target auth_user_id 에 연결 */
export async function linkSocialProviderToUser(
  targetAuthUserId: string,
  profile: OAuthProfile,
): Promise<UpsertSocialUserResult> {
  const sb = supabaseServer();
  const loginEmail = (profile.email || syntheticEmail(profile.provider, profile.providerId)).toLowerCase();

  const { data: row, error: findErr } = await sb
    .from("yeonun_social_users")
    .select("*")
    .eq("provider", profile.provider)
    .eq("provider_id", profile.providerId)
    .maybeSingle();

  if (findErr) throw new Error(findErr.message);
  if (row?.deleted_at) throw new WithdrawalPendingError();

  let mergedFrom: string | undefined;

  if (row) {
    if (row.auth_user_id === targetAuthUserId) {
      await sb
        .from("yeonun_social_users")
        .update({
          name: profile.name,
          email: profile.email,
          profile_image: profile.profileImage,
          last_login_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      return {
        authUserId: targetAuthUserId,
        loginEmail,
        isNewUser: false,
        socialUser: row as SocialUserRow,
      };
    }

    mergedFrom = await reassignSocialAccount(targetAuthUserId, row.auth_user_id, row.id, profile);
    const { data: updated } = await sb.from("yeonun_social_users").select("*").eq("id", row.id).single();

    return {
      authUserId: targetAuthUserId,
      loginEmail,
      isNewUser: false,
      socialUser: (updated ?? row) as SocialUserRow,
      mergedFromAuthUserId: mergedFrom,
    };
  }

  const { data: inserted, error: insErr } = await sb
    .from("yeonun_social_users")
    .insert({
      auth_user_id: targetAuthUserId,
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
    authUserId: targetAuthUserId,
    loginEmail,
    isNewUser: false,
    socialUser: inserted as SocialUserRow,
  };
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

  /** 동일 실이메일로 이미 가입된 소셜 → 기존 auth 계정에 연결(크레딧 통합) */
  if (profile.email) {
    const existingAuthId = await findAuthUserIdByVerifiedEmail(profile.email);
    if (existingAuthId) {
      const linked = await linkSocialProviderToUser(existingAuthId, profile);
      await sb.auth.admin.updateUserById(existingAuthId, {
        user_metadata: {
          name: profile.name,
          avatar_url: profile.profileImage,
          provider: profile.provider,
          provider_id: profile.providerId,
        },
      });
      return { ...linked, isNewUser: false };
    }
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
