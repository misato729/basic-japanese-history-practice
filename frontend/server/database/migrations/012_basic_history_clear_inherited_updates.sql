-- New service only: SQL011 is preserved unchanged, but its source-service release
-- announcements do not describe this new local copy. Keep all other updates.
DELETE FROM service_updates WHERE
 (published_on = DATE '2026-11-01' AND content = '本サービスをリリースしました') OR
 (published_on IN (DATE '2026-11-02', DATE '2026-11-03') AND content = '機能改善・機能追加を行いました');
