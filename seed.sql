-- Idempotent seed.
-- Safe to run on every deploy: INSERT OR IGNORE on UNIQUE constraints
-- (links.slug, settings.key) means already-present rows are skipped.

INSERT OR IGNORE INTO links (slug, label, url, position, enabled) VALUES
  ('instagram',   'Instagram',   'https://instagram.com/hyan_official',     1, 1),
  ('youtube',     'YouTube',     'https://youtube.com/@hyan',               2, 1),
  ('apple-music', 'Apple Music', 'https://music.apple.com/artist/hyan',     3, 1),
  ('bandcamp',    'Bandcamp',    'https://hyan.bandcamp.com',               4, 1),
  ('spotify',     'Spotify',     'https://open.spotify.com/artist/hyan',    5, 1);

-- Default site settings. Once a key has a row, this is a no-op; the admin
-- changes the value via /admin/settings, not by editing this file.
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('bg_image_url', '/bg.png');
