import {
  mintInvite,
  buildInviteLink,
  parseInviteUrl,
  inviteIsFresh,
  roleFromInvite,
  INVITE_TTL_MS,
} from '../inviteTokens';

describe('inviteTokens', () => {
  it('mints a cryptographically long token and round-trips via URL', () => {
    const invite = mintInvite('ABCDEFGHJK', 'edit');
    expect(invite.roomId).toBe('ABCDEFGHJK');
    expect(invite.access).toBe('edit');
    expect(invite.token.length).toBeGreaterThanOrEqual(20);
    expect(invite.exp).toBeGreaterThan(Date.now());

    const link = buildInviteLink(invite);
    const parsed = parseInviteUrl(link);
    expect(parsed).not.toBeNull();
    expect(parsed!.roomId).toBe(invite.roomId);
    expect(parsed!.access).toBe('edit');
    expect(parsed!.token).toBe(invite.token);
    expect(parsed!.exp).toBe(invite.exp);
  });

  it('treats expired invites as stale', () => {
    const invite = mintInvite('ROOMCODE12', 'view', -1000);
    expect(inviteIsFresh(invite)).toBe(false);
  });

  it('keeps fresh invites within TTL', () => {
    const invite = mintInvite('ROOMCODE12', 'view', INVITE_TTL_MS);
    expect(inviteIsFresh(invite)).toBe(true);
    expect(roleFromInvite(invite)).toBe('view');
  });

  it('defaults missing access to edit in parse', () => {
    const parsed = parseInviteUrl('litnotes://join/ABCDEFGHJK?t=tok&e=9999999999999');
    expect(parsed?.access).toBe('edit');
  });
});
