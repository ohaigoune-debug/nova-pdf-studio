/**
 * النسخ خارج الخادم (scripts/offsite-backup.sh): يُشغَّل السكربت الحقيقي مقابل rclone بديل
 * يكتب في مجلد محلي، فنتحقق من القواعد دون شبكة: ما يُرفع، ما لا يُعاد رفعه، ومتى يُحذف القديم.
 */
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = join(process.cwd(), 'scripts', 'offsite-backup.sh')

// بديل rclone: يدعم ما يستعمله السكربت فقط (lsf / copy / deletefile) والوجهة مجلد $FAKE_REMOTE_DIR.
// FAKE_FAIL_COPY=<جزء من اسم> يُفشل رفع الملفات المطابقة.
const FAKE_RCLONE = `#!/bin/sh
[ "$1" = "--config" ] && shift 2
cmd="$1"; shift
case "$cmd" in
  lsf)
    pat='*'
    while [ $# -gt 1 ]; do
      case "$1" in
        --include) pat="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    cd "$FAKE_REMOTE_DIR" 2>/dev/null || exit 0
    for f in $pat; do [ -f "$f" ] && echo "$f"; done
    exit 0 ;;
  copy)
    name=$(basename "$1")
    if [ -n "\${FAKE_FAIL_COPY:-}" ]; then case "$name" in *"$FAKE_FAIL_COPY"*) exit 1 ;; esac; fi
    mkdir -p "$FAKE_REMOTE_DIR" && cp "$1" "$FAKE_REMOTE_DIR/$name" ;;
  deletefile)
    rm -f "$FAKE_REMOTE_DIR/$(basename "$1")" ;;
  *) echo "unsupported: $cmd" >&2; exit 64 ;;
esac
`

let dir: string
let src: string
let remote: string
let conf: string
let bin: string

const touch = (name: string, body = name) => writeFileSync(join(src, name), body)
const remoteFiles = () => (existsSync(remote) ? readdirSync(remote).sort() : [])

function run(env: Record<string, string> = {}) {
  return spawnSync('sh', [script, '--once'], {
    encoding: 'utf8',
    // بيئة نظيفة عمدًا: لا يتسرّب إلى السكربت أي إعداد من الجهاز الذي يشغّل الاختبار
    env: { PATH: process.env.PATH ?? '', OFFSITE_SRC: src, OFFSITE_REMOTE: 'gdrive:madrasa-backups', RCLONE_CONFIG: conf, RCLONE_BIN: bin, NODE_ENV: 'test', FAKE_REMOTE_DIR: remote, ...env }
  })
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'offsite-'))
  src = join(dir, 'backups')
  remote = join(dir, 'remote')
  conf = join(dir, 'rclone.conf')
  bin = join(dir, 'rclone')
  mkdirSync(src)
  writeFileSync(conf, '[gdrive]\ntype = drive\n')
  writeFileSync(bin, FAKE_RCLONE)
  chmodSync(bin, 0o755)
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('offsite backup script', () => {
  it('does nothing and reports "not configured" without a remote or a config file', () => {
    touch('db-20261110T180000Z.sql.gz')
    const noRemote = run({ OFFSITE_REMOTE: '' })
    expect(noRemote.status).toBe(2)
    expect(noRemote.stdout).toContain('غير مُعَدّ')
    const noConf = run({ RCLONE_CONFIG: join(dir, 'missing.conf') })
    expect(noConf.status).toBe(2)
    expect(remoteFiles()).toEqual([])
  })

  it('uploads the newest database dumps and only the newest uploads archives', () => {
    for (const d of ['08', '09', '10']) {
      touch(`db-202611${d}T180000Z.sql.gz`)
      touch(`uploads-202611${d}T180000Z.tar.gz`)
    }
    const r = run({ OFFSITE_KEEP_DB: '14', OFFSITE_KEEP_UPLOADS: '2' })
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(remoteFiles()).toEqual([
      'db-20261108T180000Z.sql.gz',
      'db-20261109T180000Z.sql.gz',
      'db-20261110T180000Z.sql.gz',
      'uploads-20261109T180000Z.tar.gz',
      'uploads-20261110T180000Z.tar.gz'
    ])
    expect(readFileSync(join(remote, 'db-20261110T180000Z.sql.gz'), 'utf8')).toBe('db-20261110T180000Z.sql.gz')
    expect(r.stdout).toContain('✔ الوجهة محدَّثة')
  })

  it('never uploads unfinished .part files', () => {
    touch('db-20261110T180000Z.sql.gz')
    touch('db-20261111T180000Z.sql.gz.part')
    touch('uploads-20261111T180000Z.tar.gz.part')
    expect(run().status).toBe(0)
    expect(remoteFiles()).toEqual(['db-20261110T180000Z.sql.gz'])
  })

  it('does not re-upload what is already there', () => {
    touch('db-20261110T180000Z.sql.gz')
    touch('uploads-20261110T180000Z.tar.gz')
    expect(run().status).toBe(0)
    const second = run()
    expect(second.status).toBe(0)
    expect(second.stdout).not.toContain('رفع db-')
    expect(second.stdout).not.toContain('رفع uploads-')
  })

  it('prunes the remote down to the keep count once the new copy is up', () => {
    mkdirSync(remote)
    for (const d of ['07', '08', '09']) writeFileSync(join(remote, `uploads-202611${d}T180000Z.tar.gz`), 'old')
    touch('db-20261110T180000Z.sql.gz')
    touch('uploads-20261110T180000Z.tar.gz')
    const r = run({ OFFSITE_KEEP_UPLOADS: '2' })
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(remoteFiles().filter((f) => f.startsWith('uploads-'))).toEqual(['uploads-20261109T180000Z.tar.gz', 'uploads-20261110T180000Z.tar.gz'])
  })

  it('keeps every old remote copy when the new upload fails', () => {
    mkdirSync(remote)
    for (const d of ['07', '08', '09']) writeFileSync(join(remote, `uploads-202611${d}T180000Z.tar.gz`), 'old')
    touch('db-20261110T180000Z.sql.gz')
    touch('uploads-20261110T180000Z.tar.gz')
    const r = run({ OFFSITE_KEEP_UPLOADS: '2', FAKE_FAIL_COPY: 'uploads-20261110' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('فشل رفع uploads-20261110T180000Z.tar.gz')
    expect(remoteFiles().filter((f) => f.startsWith('uploads-'))).toEqual([
      'uploads-20261107T180000Z.tar.gz',
      'uploads-20261108T180000Z.tar.gz',
      'uploads-20261109T180000Z.tar.gz'
    ])
    // القاعدة رُفعت رغم فشل المرفوعات
    expect(remoteFiles()).toContain('db-20261110T180000Z.sql.gz')
  })

  it('waits quietly when the local backup folder is still empty', () => {
    const r = run()
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('لا نسخ محلية بعد')
  })
})
