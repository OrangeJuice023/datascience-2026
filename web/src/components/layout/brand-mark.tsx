import Image from "next/image";

/**
 * SIGMA mark. When the watercolor logo exists in public/brand/ (detected by
 * the root layout), it is shown as-is; otherwise a typographic Σ placeholder
 * in the brand's muted green and warm cream stands in. The illustrated style
 * stays confined to this mark and never spreads into the analytical UI.
 */
export function BrandMark({ size = 32, src }: { size?: number; src?: string | null }) {
  if (src) {
    return (
      <Image
        src={src}
        alt="SIGMA"
        width={size}
        height={size}
        className="shrink-0 rounded-md object-contain"
        priority
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-[28%] font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        background: "var(--leaf-ink)",
        color: "var(--cream)",
      }}
      aria-hidden="true"
    >
      Σ
    </div>
  );
}
