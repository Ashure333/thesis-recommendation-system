/**
 * ANNOUNCEMENTS PANEL — the staff announcements block.
 *
 * Shown on the Library Home page and (Library mode only) on the
 * Search page, since the RE:SEARCH home button now lands on the
 * librarian search. Data comes from the site editor (/admin).
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAnnouncements, type Announcement } from "../api";
import StaggerIn from "./retro/StaggerIn";
import { Star, Warning } from "./retro/PixelIcons";

const LEVEL_LABEL: Record<Announcement["level"], string> = {
  info: "NOTICE",
  important: "IMPORTANT",
  event: "EVENT",
};

export default function AnnouncementsPanel({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [announcements, setAnnouncements] = useState<
    Announcement[] | null
  >(null);

  useEffect(() => {
    getAnnouncements()
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]));
  }, []);

  return (
    <section data-tips="library-announcements">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-pixelify text-xl font-bold text-ink">
            Announcements
          </h2>

          <p className="mt-1 text-sm text-muted">
            Posted by the library staff.
          </p>
        </div>

        <Link
          to="/admin"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted hover:text-accent"
        >
          Site editor →
        </Link>
      </div>

      {announcements === null ? (
        <p className="rounded border-[3px] border-dashed border-gray-900 bg-canvas px-4 py-6 text-center text-sm text-muted">
          Loading announcements…
        </p>
      ) : announcements.length === 0 ? (
        <div className="rounded border-[3px] border-dashed border-gray-900 bg-canvas px-6 py-10 text-center">
          <Star className="mx-auto h-5 w-5 text-muted" />

          <p className="mt-3 text-sm font-bold text-ink">
            No announcements yet
          </p>

          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Library staff can add announcements in the site editor.
            New announcements appear here for everyone.
          </p>
        </div>
      ) : (
        <ul
          className={`flex flex-col gap-3 ${
            compact ? "" : "lg:grid lg:grid-cols-2"
          }`}
        >
          {announcements.map((announcement) => (
            <StaggerIn
              key={announcement.id}
              index={announcements.indexOf(announcement)}
            >
              <li
                data-announcement-level={announcement.level}
                className={`rounded border-[3px] border-gray-900 p-4 ${
                  announcement.level === "important"
                    ? "bg-accent text-onAccent"
                    : announcement.level === "event"
                      ? "border-dashed bg-canvas text-ink"
                      : "bg-white text-ink"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border-[2px] px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] ${
                      announcement.level === "important"
                        ? "border-onAccent/60 bg-white/20 text-onAccent"
                        : "border-gray-900 bg-white text-ink"
                    }`}
                  >
                    {announcement.level === "important" ? (
                      <Warning className="mr-1 inline-block h-2.5 w-2.5" />
                    ) : null}
                    {LEVEL_LABEL[announcement.level]}
                  </span>

                  <p className="min-w-0 flex-1 text-sm font-bold">
                    {announcement.title}
                  </p>
                </div>

                <p
                  className={`mt-2 whitespace-pre-line text-sm leading-6 ${
                    announcement.level === "important"
                      ? "text-onAccent"
                      : "text-muted"
                  }`}
                >
                  {announcement.body}
                </p>
              </li>
            </StaggerIn>
          ))}
        </ul>
      )}
    </section>
  );
}