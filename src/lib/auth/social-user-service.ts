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

  if (profile.email) {
    const { data: emailRow } = await sb
      .from("yeonun_social_users")
      .select("provider")
      .eq("email", profile.email.toLowerCase())
      .neq("provider", profile.provider)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (emailRow?.provider) {
      throw new AuthConflictError(emailRow.provider as SocialProvider);
    }
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
