-- Idempotent seed for the 5 starting platforms.
-- Safe to run on every deploy: INSERT OR IGNORE relies on slug being UNIQUE.
-- URLs below are placeholders — update them in the backoffice once Feature 05 is live.

INSERT OR IGNORE INTO links (slug, label, url, position, enabled) VALUES
  ('instagram',   'Instagram',   'https://instagram.com/hyan_official',     1, 1),
  ('youtube',     'YouTube',     'https://youtube.com/@hyan',               2, 1),
  ('apple-music', 'Apple Music', 'https://music.apple.com/artist/hyan',     3, 1),
  ('bandcamp',    'Bandcamp',    'https://hyan.bandcamp.com',               4, 1),
  ('spotify',     'Spotify',     'https://open.spotify.com/artist/hyan',    5, 1);
