import { PlayImmersive } from '@/components/play/immersive'

/** أثناء تحضير الجولة: الشريط العلوي والبطاقة الزرقاء المغلقة بدل شاشة فارغة */
export default function PlaySessionLoading() {
  return (
    <div className="play-deck -mx-4 min-h-[100svh] bg-[linear-gradient(180deg,#F7F9FF_0%,#EEF3FB_100%)] px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+16px)] lg:mx-auto lg:min-h-0 lg:max-w-2xl lg:rounded-[32px] lg:border lg:border-[#D3E0F5] lg:px-10 lg:py-8">
      <PlayImmersive />
      <div className="mx-auto w-full max-w-[24rem] space-y-4 lg:max-w-[26rem]" role="status" aria-live="polite">
        <div className="flex items-center gap-2" aria-hidden>
          <div className="h-6 w-[4.5rem] rounded-full bg-[#E6EDF9]" />
          <div className="flex flex-1 justify-center">
            <div className="h-8 w-36 animate-pulse rounded-full bg-[#E6EDF9]" />
          </div>
          <div className="flex w-[4.5rem] justify-end">
            <div className="size-10 rounded-full bg-primary/30" />
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-[#DCE6F7]" aria-hidden />
        <div className="pt-7" aria-hidden>
          <div className="mx-auto aspect-[4/5] w-[min(74%,16.5rem)] animate-pulse rounded-[18px] border-[6px] border-white bg-primary/70 shadow-[0_16px_30px_-12px_rgba(20,87,197,0.45)]" />
        </div>
        <p className="text-center text-sm font-bold text-muted-foreground">جارٍ تحضير الجولة…</p>
      </div>
    </div>
  )
}
