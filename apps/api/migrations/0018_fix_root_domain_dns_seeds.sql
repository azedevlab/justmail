-- Domains equal to the platform mail root were seeded with an SPF record that
-- includes itself (v=spf1 mx include:<domain> ~all published on <domain> — a
-- lookup loop and permerror-in-waiting) plus autoconfig/autodiscover CNAMEs
-- pointing at themselves. Normalize the SPF and drop the self-referential
-- CNAMEs; the seeder no longer creates either.

UPDATE dns_records r
   SET content = 'v=spf1 mx ~all',
       check_status = 'propagating',
       updated_at = now()
  FROM domains d
 WHERE d.id = r.domain_id
   AND r.purpose = 'spf'
   AND r.content = 'v=spf1 mx include:' || d.name || ' ~all';

DELETE FROM dns_records
 WHERE purpose IN ('autoconfig', 'autodiscover')
   AND type = 'CNAME'
   AND content = name;
