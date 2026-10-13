import Image from "next/image";

const LOGO_SRC = "/brand/ss-metals-logo.png";

export function BrandLogo({
  variant = "default",
  priority = false,
}: {
  /** Sidebar uses a compact height; login uses full width on the hero panel. */
  variant?: "default" | "sidebar" | "login" | "navbar";
  priority?: boolean;
}) {
  if (variant === "navbar") {
    return (
      <Image
        src={LOGO_SRC}
        alt="SS Metals"
        width={120}
        height={36}
        priority={priority}
        className="h-9 w-auto max-w-[120px] object-contain object-left"
      />
    );
  }
  if (variant === "sidebar") {
    return (
      <Image
        src={LOGO_SRC}
        alt="SS Metals — Est. 1987, Moradabad"
        width={280}
        height={80}
        priority={priority}
        className="block h-[4.25rem] w-auto max-w-[260px] object-contain object-left mix-blend-multiply dark:mix-blend-normal"
      />
    );
  }
  if (variant === "login") {
    return (
      <Image
        src={LOGO_SRC}
        alt="SS Metals — Est. 1987, Moradabad"
        width={320}
        height={90}
        priority={priority}
        className="h-auto w-full max-w-[280px] object-contain object-left brightness-0 invert"
      />
    );
  }
  return (
    <Image
      src={LOGO_SRC}
      alt="SS Metals — Est. 1987, Moradabad"
      width={240}
      height={68}
      priority={priority}
      className="h-auto w-auto max-w-[240px] object-contain"
    />
  );
}
