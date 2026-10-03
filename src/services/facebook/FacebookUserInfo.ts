/**
 * Fetch a Messenger/Facebook profile by its numeric Facebook UID.
 *
 * This endpoint returns a profile dictionary keyed by the requested UID.  Do
 * not use profile-page HTML for identity data: redirects and page hydration
 * can contain the logged-in account or another person instead of the UID that
 * was requested.
 */

import axios from 'axios';
import { FBSessionData } from './FacebookTypes';
import { buildFormData, buildPostConfig, parseFBResponse } from './FacebookUtils';
import Logger from '../../utils/Logger';

const USER_INFO_URL = 'https://www.facebook.com/chat/user_info/';

export interface FacebookUserInfo {
  id: string;
  name: string;
  firstName?: string;
  username?: string;
  avatarUrl: string;
  profileUrl?: string;
  isNonFriendMessengerContact?: boolean;
}

/** A contact/profile endpoint only accepts the stable numeric Facebook UID. */
export function isFacebookUserId(userId: string): boolean {
  return /^\d+$/.test(userId);
}

/**
 * Uses the same UID-keyed endpoint as fbchat-v2's `_get_user_info` feature.
 * The returned profile is accepted only when both its map key and `id` match
 * the requested UID, preventing accidental writes of another profile.
 */
export async function getFacebookUserInfo(
  session: FBSessionData,
  userId: string,
  httpsAgent?: any,
): Promise<FacebookUserInfo | null> {
  const requestedId = String(userId).trim();
  if (!isFacebookUserId(requestedId)) {
    Logger.warn('[FacebookUserInfo] Refused non-numeric Facebook UID');
    return null;
  }

  try {
    const form = buildFormData(session, { requireGraphql: false });
    form['ids[0]'] = requestedId;
    const config = buildPostConfig(USER_INFO_URL, form, session.cookieFacebook, 'www.facebook.com', httpsAgent);
    const response = await axios.post(config.url, config.data, {
      headers: config.headers,
      timeout: config.timeout,
      ...(httpsAgent ? { httpsAgent } : {}),
    });
    const payload = typeof response.data === 'string'
      ? parseFBResponse(response.data)
      : response.data;
    const profile = payload?.payload?.profiles?.[requestedId];

    // A 200 response is not enough: Facebook may return an error payload or a
    // profile dictionary unrelated to our requested key.
    if (!profile || typeof profile !== 'object' || String(profile.id ?? '') !== requestedId) {
      Logger.warn(`[FacebookUserInfo] Profile response did not match requested UID ${requestedId}`);
      return null;
    }

    const name = typeof profile.name === 'string' ? profile.name.trim() : '';
    const avatarUrl = typeof profile.thumbSrc === 'string'
      ? profile.thumbSrc
      : typeof profile.thumb_src === 'string'
        ? profile.thumb_src
        : typeof profile.thumnSrc === 'string'
          ? profile.thumnSrc
          : '';

    // A record without a name is not useful for replacing contact identity.
    if (!name) {
      Logger.warn(`[FacebookUserInfo] Profile ${requestedId} did not include a name`);
      return null;
    }

    return {
      id: requestedId,
      name,
      firstName: typeof profile.firstName === 'string' ? profile.firstName : undefined,
      username: typeof profile.vanity === 'string' ? profile.vanity : undefined,
      avatarUrl,
      profileUrl: typeof profile.uri === 'string' ? profile.uri : undefined,
      isNonFriendMessengerContact: Boolean(profile.isNonFriendMessengerContact),
    };
  } catch (err: any) {
    Logger.warn(`[FacebookUserInfo] Failed to resolve UID ${requestedId}: ${err.message}`);
    return null;
  }
}
