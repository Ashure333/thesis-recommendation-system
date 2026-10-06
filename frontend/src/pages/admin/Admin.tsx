/**
 * LIBRARY SITE EDITOR — /admin
 *
 * The admin-facing half of Library Mode, behind a real backend
 * credential (PBKDF2 + signed bearer token, see
 * app/services/admin_auth.py). Lets library staff:
 *
 *   1. post announcements (they render on /home for visitors), and
 *   2. set each feature to shown / locked / hidden in Library mode.
 *
 * Researcher mode ignores the feature lineup entirely.
 */

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import {
  adminChangePassword,
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminGetLibraryFeatures,
  adminListAnnouncements,
  adminLogin,
  adminMe,
  adminSetLibraryFeatures,
  adminUpdateAnnouncement,
  type AdminSession,
  type Announcement,
  type AnnouncementLevel,
  type SiteFeatureState,
} from "../../api";
import { SITE_FEATURES } from "../../data/siteFeatures";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CloseX,
  Check,
  Lock,
} from "../../components/retro/PixelIcons";
import SlimeLogo from "../../components/retro/SlimeLogo";

const SESSION_KEY = "paperrec_admin_session";

const LEVELS: AnnouncementLevel[] = ["info", "important", "event"];

const STATES: SiteFeatureState[] = ["shown", "locked", "hidden"];

const STATE_LABELS: Record<SiteFeatureState, string> = {
  shown: "Shown",
  locked: "Locked",
  hidden: "Hidden",
};

function readSession(): AdminSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AdminSession;

    if (!parsed.token || !parsed.username) {
      return null;
    }

    if (
      parsed.expires_at &&
      parsed.expires_at * 1000 < Date.now()
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function looksLikeAuthFailure(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("admin sign-in") ||
    lower.includes("session expired") ||
    lower.includes("invalid admin")
  );
}

export default function Admin() {
  const [session, setSession] = useState<AdminSession | null>(
    readSession
  );

  function signOut() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Best-effort.
    }

    setSession(null);
  }

  function handleAuthFailure(message: string) {
    if (looksLikeAuthFailure(message)) {
      signOut();
    }
  }

  // A stored-but-stale token gets rejected on first contact.
  useEffect(() => {
    if (!session) {
      return;
    }

    adminMe(session.token).catch((error: Error) => {
      handleAuthFailure(error.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b-[3px] border-gray-900 bg-canvas px-4 py-3 sm:px-6">
        <Link
          to="/home"
          className="flex items-center gap-2.5 text-ink"
        >
          <SlimeLogo />

          <span className="font-pixelify hidden text-base font-bold tracking-wide sm:block">
            RE:SEARCH
            <span className="ml-2 text-muted">· SITE EDITOR</span>
          </span>
        </Link>

        <Link to="/home" className="ui-button ui-button-secondary">
          Back to the library
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {session ? (
          <Editor
            session={session}
            onSignOut={signOut}
            onAuthFailure={handleAuthFailure}
          />
        ) : (
          <LoginCard
            onSignedIn={(next) => {
              try {
                window.localStorage.setItem(
                  SESSION_KEY,
                  JSON.stringify(next)
                );
              } catch {
                // Session still works for this tab.
              }

              setSession(next);
            }}
          />
        )}
      </main>
    </div>
  );
}

// ============================================================
// SIGN-IN
// ============================================================

function LoginCard({
  onSignedIn,
}: {
  onSignedIn: (session: AdminSession) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter the admin username and password.");
      return;
    }

    setBusy(true);

    adminLogin(username.trim(), password)
      .then((session) => onSignedIn(session))
      .catch((requestError: Error) => {
        setError(requestError.message);
      })
      .finally(() => setBusy(false));
  }

  return (
    <div
      data-tips="admin-login"
      className="mx-auto mt-10 w-full max-w-md rounded border-[3px] border-gray-900 bg-white p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded border-[3px] border-gray-900 bg-canvas">
          <Lock className="h-5 w-5 text-ink" />
        </span>

        <div>
          <h1 className="font-pixelify text-xl font-bold leading-none text-ink">
            Library site editor
          </h1>

          <p className="mt-1 text-sm text-muted">
            Staff sign-in — manages announcements and the feature
            lineup.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="status-error mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="admin-username">
            Username
          </label>

          <input
            id="admin-username"
            className="ui-input"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="admin-password">
            Password
          </label>

          <input
            id="admin-password"
            type="password"
            className="ui-input"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="ui-button ui-button-primary"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// ============================================================
// EDITOR
// ============================================================

function Editor({
  session,
  onSignOut,
  onAuthFailure,
}: {
  session: AdminSession;
  onSignOut: () => void;
  onAuthFailure: (message: string) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-muted">
            Site editor
          </p>

          <h1 className="font-pixelify mt-1 text-2xl font-bold text-ink">
            Library control room
          </h1>

          <p className="mt-1 text-sm text-muted">
            Signed in as{" "}
            <span className="font-bold text-ink">
              {session.username}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="ui-button ui-button-secondary"
        >
          Sign out
        </button>
      </div>

      <AnnouncementManager
        token={session.token}
        onAuthFailure={onAuthFailure}
      />

      <FeatureLineup
        token={session.token}
        onAuthFailure={onAuthFailure}
      />

      <PasswordForm
        token={session.token}
        onAuthFailure={onAuthFailure}
      />
    </div>
  );
}

// ============================================================
// ANNOUNCEMENTS
// ============================================================

function AnnouncementManager({
  token,
  onAuthFailure,
}: {
  token: string;
  onAuthFailure: (message: string) => void;
}) {
  const [announcements, setAnnouncements] = useState<
    Announcement[] | null
  >(null);
  const [status, setStatus] = useState("");

  function refresh() {
    adminListAnnouncements(token)
      .then(setAnnouncements)
      .catch((error: Error) => {
        setStatus(error.message);
        onAuthFailure(error.message);
      });
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function move(announcement: Announcement, direction: -1 | 1) {
    if (!announcements) {
      return;
    }

    const index = announcements.findIndex(
      (row) => row.id === announcement.id
    );
    const neighbor = announcements[index + direction];

    if (!neighbor) {
      return;
    }

    // Swap ordinal positions so the list reorders server-side.
    Promise.all([
      adminUpdateAnnouncement(token, announcement.id, {
        position: index + direction,
      }),
      adminUpdateAnnouncement(token, neighbor.id, {
        position: index,
      }),
    ])
      .then(() => {
        setStatus("Order updated.");
        refresh();
      })
      .catch((error: Error) => {
        setStatus(error.message);
        onAuthFailure(error.message);
      });
  }

  return (
    <section
      data-tips="admin-announcements"
      className="rounded border-[3px] border-gray-900 bg-white p-5"
    >
      <div className="mb-4">
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Announcements
        </h2>

        <p className="mt-1 text-sm text-muted">
          Active announcements render on the Library Home page, in
          this order.
        </p>
      </div>

      <NewAnnouncementForm
        token={token}
        onPosted={(message) => {
          setStatus(message);
          refresh();
        }}
        onError={(message) => {
          setStatus(message);
          onAuthFailure(message);
        }}
      />

      {status && (
        <p className="mt-3 font-mono text-xs text-muted" role="status">
          {status}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {announcements === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="rounded border-[2px] border-dashed border-gray-900 bg-canvas px-4 py-5 text-center text-sm text-muted">
            No announcements yet — post the first one above.
          </p>
        ) : (
          announcements.map((announcement, index) => (
            <AnnouncementRow
              key={announcement.id}
              token={token}
              announcement={announcement}
              first={index === 0}
              last={index === announcements.length - 1}
              onMove={move}
              onAuthFailure={onAuthFailure}
              onChanged={(message) => {
                setStatus(message);
                refresh();
              }}
            />
          ))
        )}
      </div>
    </section>
  );
}

function NewAnnouncementForm({
  token,
  onPosted,
  onError,
}: {
  token: string;
  onPosted: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<AnnouncementLevel>("info");
  const [busy, setBusy] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !body.trim()) {
      onError("Announcements need a title and a body.");
      return;
    }

    setBusy(true);

    adminCreateAnnouncement(token, {
      title: title.trim(),
      body: body.trim(),
      level,
    })
      .then(() => {
        setTitle("");
        setBody("");
        setLevel("info");
        onPosted("Announcement posted.");
      })
      .catch((error: Error) => onError(error.message))
      .finally(() => setBusy(false));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded border-[3px] border-dashed border-gray-900 bg-canvas p-4"
    >
      <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-muted">
        New announcement
      </p>

      <input
        className="ui-input"
        placeholder="Title (e.g. Library closed on Friday)"
        aria-label="Announcement title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <textarea
        className="ui-input min-h-20"
        placeholder="Write the announcement…"
        aria-label="Announcement body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-bold text-ink">
          Type
          <select
            className="ui-input w-auto"
            aria-label="Announcement type"
            value={level}
            onChange={(event) =>
              setLevel(event.target.value as AnnouncementLevel)
            }
          >
            {LEVELS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="ui-button ui-button-primary ml-auto"
        >
          {busy ? "Posting…" : "Post announcement"}
        </button>
      </div>
    </form>
  );
}

function AnnouncementRow({
  token,
  announcement,
  first,
  last,
  onMove,
  onChanged,
  onAuthFailure,
}: {
  token: string;
  announcement: Announcement;
  first: boolean;
  last: boolean;
  onMove: (announcement: Announcement, direction: -1 | 1) => void;
  onChanged: (message: string) => void;
  onAuthFailure: (message: string) => void;
}) {
  const [title, setTitle] = useState(announcement.title);
  const [body, setBody] = useState(announcement.body);
  const [level, setLevel] = useState<AnnouncementLevel>(
    announcement.level
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitle(announcement.title);
    setBody(announcement.body);
    setLevel(announcement.level);
  }, [announcement]);

  function guard(action: Promise<unknown>, done: string) {
    setBusy(true);

    action
      .then(() => onChanged(done))
      .catch((error: Error) => {
        onChanged(error.message);
        onAuthFailure(error.message);
      })
      .finally(() => setBusy(false));
  }

  function save() {
    guard(
      adminUpdateAnnouncement(token, announcement.id, {
        title: title.trim(),
        body: body.trim(),
        level,
      }),
      "Announcement saved."
    );
  }

  return (
    <div
      data-announcement-row={announcement.id}
      className={`rounded border-[3px] border-gray-900 p-4 ${
        announcement.active ? "bg-white" : "bg-canvas opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded border-[2px] border-gray-900 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] ${
            announcement.active
              ? "bg-accent text-onAccent"
              : "bg-white text-muted"
          }`}
        >
          {announcement.active ? "ACTIVE" : "OFF"}
        </span>

        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          {announcement.level}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Move up"
            disabled={first || busy}
            onClick={() => onMove(announcement, -1)}
            className="ui-button ui-button-quiet px-2 disabled:opacity-30"
          >
            <ArrowUp className="h-3 w-3" />
          </button>

          <button
            type="button"
            aria-label="Move down"
            disabled={last || busy}
            onClick={() => onMove(announcement, 1)}
            className="ui-button ui-button-quiet px-2 disabled:opacity-30"
          >
            <ArrowDown className="h-3 w-3" />
          </button>

          <button
            type="button"
            aria-label={
              announcement.active ? "Deactivate" : "Activate"
            }
            disabled={busy}
            onClick={() =>
              guard(
                adminUpdateAnnouncement(token, announcement.id, {
                  active: !announcement.active,
                }),
                announcement.active
                  ? "Announcement hidden."
                  : "Announcement is live."
              )
            }
            className="ui-button ui-button-secondary px-2"
          >
            <Check className="h-3 w-3" />
          </button>

          <button
            type="button"
            aria-label="Delete"
            disabled={busy}
            onClick={() =>
              guard(
                adminDeleteAnnouncement(token, announcement.id),
                "Announcement deleted."
              )
            }
            className="ui-button ui-button-danger px-2"
          >
            <CloseX className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <input
          className="ui-input"
          aria-label="Announcement title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <textarea
          className="ui-input min-h-20"
          aria-label="Announcement body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-ink">
            Type
            <select
              className="ui-input w-auto"
              aria-label="Announcement type"
              value={level}
              onChange={(event) =>
                setLevel(event.target.value as AnnouncementLevel)
              }
            >
              {LEVELS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="ui-button ui-button-primary ml-auto"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FEATURE LINEUP
// ============================================================

function FeatureLineup({
  token,
  onAuthFailure,
}: {
  token: string;
  onAuthFailure: (message: string) => void;
}) {
  const [features, setFeatures] = useState<Record<
    string,
    SiteFeatureState
  > | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminGetLibraryFeatures(token)
      .then((payload) => setFeatures(payload.features))
      .catch((error: Error) => {
        setStatus(error.message);
        onAuthFailure(error.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    if (!features) {
      return;
    }

    setBusy(true);
    setStatus("");

    adminSetLibraryFeatures(token, features)
      .then((payload) => {
        setFeatures(payload.features);
        setStatus("Lineup saved — visitors see it immediately.");
        // Open tabs re-read the public endpoint.
        window.dispatchEvent(new Event("site-features-changed"));
      })
      .catch((error: Error) => {
        setStatus(error.message);
        onAuthFailure(error.message);
      })
      .finally(() => setBusy(false));
  }

  return (
    <section
      data-tips="admin-features"
      className="rounded border-[3px] border-gray-900 bg-white p-5"
    >
      <div className="mb-4">
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Library feature lineup
        </h2>

        <p className="mt-1 text-sm text-muted">
          What visitors can open in Library mode. <b>Shown</b> works
          normally, <b>locked</b> shows a padlock that advertises
          Researcher mode, <b>hidden</b> disappears. Researcher mode
          always has everything.
        </p>
      </div>

      {features === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {SITE_FEATURES.map((feature) => (
            <div
              key={feature.key}
              data-feature-row={feature.key}
              className="flex flex-col gap-3 rounded border-[3px] border-gray-900 bg-canvas p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  {feature.label}

                  {feature.pro && (
                    <span className="rounded border-[2px] border-gray-900 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] text-muted">
                      RESEARCHER
                    </span>
                  )}

                  {features[feature.key] === "locked" && (
                    <Lock className="h-3 w-3 text-muted" />
                  )}
                </p>

                <p className="mt-0.5 text-xs text-muted">
                  {feature.blurb}
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label={`${feature.label} state`}
                className="flex shrink-0 rounded border-[3px] border-gray-900 bg-white p-0.5"
              >
                {STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    role="radio"
                    aria-checked={features[feature.key] === state}
                    onClick={() =>
                      setFeatures({
                        ...features,
                        [feature.key]: state,
                      })
                    }
                    className={`rounded px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] transition-colors pixel-ease ${
                      features[feature.key] === state
                        ? "bg-accent text-onAccent"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {STATE_LABELS[state]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || features === null}
          className="ui-button ui-button-primary"
        >
          {busy ? "Saving…" : "Save lineup"}
        </button>

        {status && (
          <p className="font-mono text-xs text-muted" role="status">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================
// PASSWORD
// ============================================================

function PasswordForm({
  token,
  onAuthFailure,
}: {
  token: string;
  onAuthFailure: (message: string) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);

    adminChangePassword(token, current, next)
      .then(() => {
        setStatus("Password updated.");
        setCurrent("");
        setNext("");
        setConfirm("");
      })
      .catch((requestError: Error) => {
        setError(requestError.message);
        onAuthFailure(requestError.message);
      })
      .finally(() => setBusy(false));
  }

  return (
    <section className="rounded border-[3px] border-gray-900 bg-white p-5">
      <div className="mb-4">
        <h2 className="font-pixelify text-xl font-bold text-ink">
          Admin password
        </h2>

        <p className="mt-1 text-sm text-muted">
          Rotate the site-editor password. Minimum 8 characters.
        </p>
      </div>

      {error && (
        <div role="alert" className="status-error mb-4">
          {error}
        </div>
      )}

      {status && (
        <div className="status-success mb-4" role="status">
          {status}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 sm:grid-cols-3"
      >
        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Current
          <input
            type="password"
            className="ui-input"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          New
          <input
            type="password"
            className="ui-input"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-bold text-ink">
          Confirm
          <input
            type="password"
            className="ui-input"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>

        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={busy}
            className="ui-button ui-button-primary"
          >
            {busy ? "Saving…" : "Update password"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </section>
  );
}
