# Distributed mail storage (NFS / SMB / CephFS / ZFS)

JustMail keeps each mailbox as a Maildir under `/var/vmail/<domain>/<user>/Maildir`
(see `services/mail/dovecot/dovecot.conf.tmpl`). Maildir delivery is lockless by
design, so the hard part of running the mail volume on a network or clustered
filesystem is **not** message files — it is Dovecot's per-mailbox **index and
cache files** (`dovecot.index*`, `dovecot.mailbox.log`). Those are memory-mapped
and rewritten in place, and they corrupt if two backends touch the same mailbox
with stale caches or a lock the filesystem doesn't actually honour.

Two rules make shared storage safe:

1. **Pin each user to one backend.** Run **Dovecot Director** (or L4 session
   hashing) so a given mailbox is only ever opened by one Dovecot instance at a
   time. This alone prevents almost all index corruption. The per-filesystem
   settings below are the safety net for the brief windows when a user moves
   between backends — they are *not* a substitute for Director.
2. **Match the lock method and cache flushing to the filesystem.** Configured
   via `MAIL_STORAGE_BACKEND`.

## Configuration

Set `MAIL_STORAGE_BACKEND` in `.env` (consumed by the `dovecot` service). The
entrypoint renders the matching Dovecot overrides into
`/etc/dovecot/shared-storage.conf`, included by the golden config. Default is
`local` (no overrides).

| `MAIL_STORAGE_BACKEND` | Dovecot overrides applied |
|------------------------|---------------------------|
| `local` (default)      | none — single-node local disk |
| `nfs`                  | `mmap_disable=yes`, `mail_fsync=always`, `mail_nfs_index=yes`, `mail_nfs_storage=yes`, `lock_method=fcntl` |
| `smb` / `cifs`         | `mmap_disable=yes`, `mail_fsync=always`, `lock_method=dotlock` |
| `cephfs` / `gluster`   | `mmap_disable=yes`, `mail_fsync=always`, `lock_method=fcntl` |
| `zfs`                  | `mmap_disable=yes`, `mail_fsync=optimized` |

> `MAIL_STORAGE_BACKEND` tunes **Dovecot's mailbox storage** (the `vmail`
> volume). It is independent of `STORAGE_KIND`, which selects the object-storage
> adapter for *attachments* in `@justmail/storage`. A deployment can run, e.g.,
> `MAIL_STORAGE_BACKEND=cephfs` with `STORAGE_KIND=s3`.

## Why each setting

- **`mmap_disable=yes`** — network filesystems don't give coherent mmap across
  hosts; Dovecot must `read()`/`write()` index files instead of trusting the
  page cache. Also set on ZFS to avoid double-caching (ARC + page cache) blowing
  up memory.
- **`mail_fsync=always`** — force fsync after index/mail writes so a reader on
  another node sees committed data. On ZFS use `optimized`: ZFS's transactional
  semantics already guarantee ordering, so blanket fsync only costs latency.
- **`lock_method`** — how Dovecot locks index files:
  - `fcntl` on **NFSv4** (needs a working `rpc.statd`/`lockd`) and on POSIX
    cluster filesystems (**CephFS**, **GlusterFS**) that implement byte-range
    locks correctly.
  - `dotlock` on **SMB/CIFS**, where `fcntl`/`flock` semantics are unreliable;
    dotlock uses a lock *file* that any filesystem can represent (slower, but
    correct).
- **`mail_nfs_index` / `mail_nfs_storage`** (NFS only) — flush NFS attribute
  caches before locking so a backend re-reads fresh index data. These are
  best-effort and known to be fragile under true concurrency, which is exactly
  why Director (rule 1) is mandatory on NFS.

## Mount recommendations

- **NFSv4:** `hard,nfsvers=4.1,noatime,actimeo=0` (or `lookupcache=none`).
  `actimeo=0` trades throughput for the cache coherence Dovecot needs. Make the
  NFS head redundant — it is otherwise a single point of failure.
- **SMB/CIFS:** `cache=none,actimeo=0,noserverino`. Prefer relocating indexes
  off SMB to a fast local path per Director-pinned backend:
  `mail_location = maildir:/var/vmail/%d/%n/Maildir:INDEX=/var/dovecot-index/%d/%n`.
- **CephFS:** use the kernel client; ensure the MDS is sized for metadata-heavy
  IMAP workloads. Indexes may live on CephFS, but local-NVMe indexes (as above)
  are markedly faster.
- **ZFS:** local pool (share it via NFS to go multi-node — then follow the NFS
  rules). Recommended dataset properties: `atime=off`, `xattr=sa`,
  `compression=lz4`, `recordsize=128k` (mail) or smaller for index-heavy pools.

## Verifying

After changing `MAIL_STORAGE_BACKEND`, restart the `dovecot` service and confirm
the overrides loaded:

```
docker compose exec dovecot doveconf mmap_disable mail_fsync lock_method
```

Corruption shows up as `Corrupted index cache file` / `Fixed index file` in the
Dovecot log. Repeated occurrences mean two backends are hitting one mailbox —
check that Director is actually pinning users.
