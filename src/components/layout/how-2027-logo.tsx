import Image from "next/image"

export function How2027Logo({ prominent = false }: { prominent?: boolean }) {
  return (
    <span role="img" aria-label="HOW 2027" className={`inline-flex max-w-full shrink-0 items-center gap-1 text-zinc-950 dark:text-white ${prominent ? "h-14 gap-2 sm:h-[4.5rem] lg:h-[5.5rem]" : "h-7"}`}>
      {/* Frame the visible artwork without modifying the source wordmark. */}
      <span className="relative block aspect-[439/142] h-full overflow-hidden">
        <Image
          src="/conference/how-wordmark.png"
          alt=""
          width={655}
          height={194}
          unoptimized
          loading="eager"
          className="absolute top-[-16.2%] left-[-20.5%] h-[136.62%] w-[149.2%] max-w-none dark:hue-rotate-180 dark:invert"
        />
      </span>
      <span aria-hidden="true" className={`flex h-full flex-col justify-center font-black tabular-nums leading-[0.94] ${prominent ? "text-[29px] sm:text-[38px] lg:text-[46px]" : "text-[14px]"}`}>
        <span>20</span>
        <span>27</span>
      </span>
    </span>
  )
}
