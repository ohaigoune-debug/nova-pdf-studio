/** أثناء تحضير الجولة: هيكل البطاقة نفسها بدل شاشة فارغة */
export default function PlaySessionLoading() {
  return (
    <div className="play-deck -mx-4 -mt-6 mb-[calc(-100px-env(safe-area-inset-bottom))] min-h-[calc(100svh-140px)] bg-deck-bg px-4 pb-[calc(124px+env(safe-area-inset-bottom))] pt-4 sm:mx-auto sm:mb-0 sm:mt-0 sm:min-h-0 sm:max-w-2xl sm:rounded-[28px] sm:border sm:border-deck-line sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-[24rem] space-y-4 sm:max-w-[26rem]" role="status" aria-live="polite">
        <div className="flex items-center gap-2" aria-hidden>
          <div className="size-11 rounded-full bg-primary/20" />
          <div className="mx-auto h-8 w-36 animate-pulse rounded-full bg-card" />
          <div className="h-6 w-11 rounded-full bg-deck-gold/20" />
        </div>
        <div className="h-2 rounded-full bg-deck-line" aria-hidden />
        <div className="deck-face animate-pulse rounded-[20px] bg-deck-back/70" aria-hidden />
        <p className="text-center text-sm font-semibold text-muted-foreground">جارٍ تحضير الجولة…</p>
      </div>
    </div>
  )
}
