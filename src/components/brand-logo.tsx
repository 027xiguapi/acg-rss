import Image from "next/image";

/**
 * Site logo mark (public/logo.png). The source was trimmed of its white
 * frame and is a wide 1024x430 image, so it is rendered at its natural
 * aspect ratio: `size` is the display height in px, width follows the
 * source ratio. If logo.png is ever re-exported with different dimensions,
 * update the ratio here to match.
 */
export function BrandLogo({ size = 28 }: { size?: number }) {
  const width = Math.round((size * 1024) / 430);
  return (
    <Image
      src="/logo.png"
      alt=""
      width={width}
      height={size}
      draggable={false}
      className="shrink-0"
    />
  );
}
