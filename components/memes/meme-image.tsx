// The main app's components/meme-image.tsx, so a meme looks the same here as
// it does to the people voting on it: classic white-on-black top and bottom
// text over the picture, on a blurred copy of itself.

const textClass =
  "pointer-events-none absolute inset-x-2 break-words text-center font-black uppercase leading-tight text-white [text-shadow:_2px_2px_0_#000,_-2px_-2px_0_#000,_2px_-2px_0_#000,_-2px_2px_0_#000]";

const variants = {
  // The meme's own page: as tall as the image needs, up to a limit.
  full: {
    box: "relative min-h-48 overflow-hidden bg-zinc-900",
    img: "relative mx-auto max-h-[32rem] w-full object-contain",
    text: "text-2xl",
  },
  // Grids of several memes: every tile the same shape.
  thumb: {
    box: "relative aspect-[4/3] overflow-hidden bg-zinc-900",
    img: "relative h-full w-full object-contain",
    text: "text-lg",
  },
};

export function MemeImage({
  src,
  alt,
  topText,
  bottomText,
  variant = "full",
}: {
  src: string;
  alt: string;
  topText: string | null;
  bottomText: string | null;
  variant?: keyof typeof variants;
}) {
  const style = variants[variant];
  return (
    <div className={style.box}>
      {src ? (
        <>
          {/* A blurred, zoomed copy behind the image, so tall or wide pictures
              sit on their own colors instead of black bars. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} loading="lazy" className={style.img} />
        </>
      ) : (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
          No image
        </p>
      )}
      {topText && <p className={`${textClass} ${style.text} top-2`}>{topText}</p>}
      {bottomText && <p className={`${textClass} ${style.text} bottom-2`}>{bottomText}</p>}
    </div>
  );
}
