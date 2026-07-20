import { useState } from "react";

export function Artwork({
  src,
  alt,
  className = "",
  rounded = "rounded-lg",
}: {
  src: string;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const initials = alt
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-purple-500 to-fuchsia-600 ${rounded} ${className} ${loaded && !err ? "" : "flex items-center justify-center"}`}
    >
      {src && !err ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErr(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <span className="text-white font-bold tracking-tight" style={{ fontSize: "clamp(0.75rem,2vw,1.25rem)" }}>
          {initials || "🎧"}
        </span>
      )}
    </div>
  );
}
