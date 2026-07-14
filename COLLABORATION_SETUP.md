# Live sharing + cloud sign-in — setup

LitNotes Canvas now supports **live workspace sharing** (Figma-style presence,
cursors, and real-time canvas sync) and **cloud accounts** (Supabase email +
Google sign-in) on top of the existing offline mode.

Until you add credentials, the app stays 100% offline: local accounts work and
the Share panel shows a "connect a sync backend" prompt. Add the values below to
switch on cloud + live sharing — no code changes required.

---

## 1. Supabase project (required for live sharing + cloud auth)

1. Create a project at https://supabase.com.
2. Go to **Project Settings → API** and copy:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key** (`eyJ…`)
3. Add them in **one** of these ways:
   - **In-app (fastest, no rebuild):** open **Settings → Collaboration**, paste the
     URL + anon key, tap **Save & connect**. Great for demos.
   - **In code:** fill `SUPABASE_URL` / `SUPABASE_ANON_KEY` in
     `src/services/supabaseConfig.ts`.

Realtime works on Supabase's free tier out of the box — no extra tables are
required (sharing uses Realtime **presence + broadcast** channels).

### Optional: enable email confirmations
By default Supabase requires email confirmation on sign-up. For a frictionless
demo, turn it off under **Authentication → Providers → Email → "Confirm email"**.

---

## 2. Google sign-in (optional, for the Google button)

1. In **Google Cloud Console → APIs & Services → Credentials**, create OAuth 2.0
   client IDs:
   - a **Web application** client (used by Supabase + native `webClientId`)
   - an **iOS** client (bundle id `ai.litnotes.canvas` or your own)
   - an **Android** client (package `com.litnotescanvas`, with your signing SHA-1)
2. In **Supabase → Authentication → Providers → Google**, paste the **Web client
   ID** and its client secret, and enable the provider.
3. Put the client IDs into `src/services/supabaseConfig.ts`:
   ```ts
   export const GOOGLE_WEB_CLIENT_ID = '...apps.googleusercontent.com'; // Web client
   export const GOOGLE_IOS_CLIENT_ID = '...apps.googleusercontent.com'; // iOS client
   ```
4. **iOS only:** add your **reversed iOS client ID** as a URL scheme in
   `ios/LitNotesCanvas/Info.plist` (a second entry in `CFBundleURLTypes`), e.g.
   `com.googleusercontent.apps.123-abc`.
5. **Android only:** ensure your app's SHA-1 is registered on the Android OAuth
   client. No manifest change is needed for `@react-native-google-signin`.

The Google button falls back to a helpful message if these aren't set.

---

## 2b. Apple sign-in (optional, iOS)

1. In **Apple Developer → Identifiers**, enable **Sign In with Apple** on your
   App ID (matching the app's bundle identifier).
2. In **Supabase → Authentication → Providers → Apple**, enable the provider and
   configure it with your Services ID / key (see Supabase's Apple guide).
3. The native entitlement is already in
   `ios/LitNotesCanvas/LitNotesCanvas.entitlements`
   (`com.apple.developer.applesignin`). Rebuild once after `npm run pods`.
4. On a **real iOS device** (or a simulator on iOS 13+), the Apple button on the
   auth screen calls native Sign in with Apple and exchanges the identity token
   with Supabase.

Android Apple sign-in needs extra Apple Services ID setup and is not enabled in
this build — the button explains that on Android.

---

## 3. Native rebuild (once, after installing deps)

New native modules were added (`@react-native-google-signin/google-signin`,
`@invertase/react-native-apple-authentication`, `react-native-permissions`).
Rebuild the apps:

```bash
# iOS
npm run pods
npm run ios

# Android
npm run android
```

`@supabase/supabase-js` and `react-native-url-polyfill` are JS-only and need no
native linking.

---

## 4. Invite deep links

Invites use `litnotes://join/<CODE>?a=<edit|view>`. The URL scheme is already
registered:
- Android: intent-filter in `android/app/src/main/AndroidManifest.xml`
- iOS: `CFBundleURLTypes` in `ios/LitNotesCanvas/Info.plist`

Opening such a link launches the app and auto-joins the room. People can also
type the 6-character room code in **Share → Join session**.

---

## How live sharing works (for reviewers)

- **Transport:** Supabase Realtime channel per room (`room:<CODE>`).
- **Presence:** who's in the room, their name, colour and role (owner / editor /
  viewer) — drives the avatar pips and participant list.
- **State sync:** the canvas (cards, threads, ink, highlights, index, OCR text)
  is broadcast as a debounced snapshot with last-writer-wins; late joiners
  request the current snapshot on connect.
- **Cursors:** broadcast in board/world coordinates and rendered per-peer,
  inverse-scaled so they stay crisp at any zoom.
- **Roles:** viewers are read-only (canvas editing + PDF highlighting disabled);
  owners choose whether new joiners can edit or only view.

### Known limitations (v1)
- The **PDF binary itself isn't uploaded** — peers sync the canvas/notes layer;
  to see the same pages they should open the same file (future: Supabase
  Storage upload + signed URL).
- Concurrent edits use snapshot last-writer-wins, not per-field CRDT, so two
  people editing the *same* card in the same instant can clobber each other.
  Fine for typical review sessions; upgrade to CRDT later if needed.
