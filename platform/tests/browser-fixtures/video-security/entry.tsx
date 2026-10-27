import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { SecureBunnyPlayer, SecureVideoPlayer } from '@/components/domain/secure-video-player'

// This entry is bundled only by scripts/video-security-browser-test.mjs. It is
// never imported by the Next application and never accesses a live account.
const params = new URLSearchParams(window.location.search)
const kind = params.get('kind') === 'bunny' ? 'bunny' : 'video'
const expires = Math.floor(Date.now() / 1000) + 300
const root = createRoot(document.getElementById('fixture-root')!)
const contentId = '11111111-1111-4111-8111-111111111111'
const watermark = ['LOCAL TEST FIXTURE', 'No real student or provider video']

root.render(
  <main className="mx-auto max-w-3xl p-4">
    <h1 className="mb-4 text-lg font-bold">Local player regression fixture — mocked backend</h1>
    {kind === 'bunny' ? (
      <SecureBunnyPlayer
        src={`https://iframe.mediadelivery.net/embed/1234/22222222-2222-4222-8222-222222222222?token=fixture-not-a-live-token&expires=${expires}&playsinline=true&disableIosPlayer=true`}
        expires={expires}
        contentId={contentId}
        watermark={watermark}
        title="Mocked Bunny iframe; not a real provider playback test"
      />
    ) : (
      <SecureVideoPlayer src="/fixture.webm" contentId={contentId} watermark={watermark} />
    )}
  </main>
)

Object.assign(window, { __unmountVideoSecurityFixture: () => root.unmount() })
