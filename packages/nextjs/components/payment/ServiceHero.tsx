"use client";

interface ServiceHeroProps {
  name: string;
  emoji: string;
  tagline: string;
  bullets: string[];
  heroImage?: string;
  heroPosition?: "left" | "right";
}

export function ServiceHero({ name, emoji, tagline, bullets, heroImage, heroPosition = "left" }: ServiceHeroProps) {
  return (
    <>
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">{emoji}</div>
        <h1 className="text-3xl font-bold">{name}</h1>
        <p className="text-base opacity-60 mt-2">{tagline}</p>
      </div>

      {heroImage && (
        <div className="relative w-full rounded-xl overflow-hidden mb-6" style={{ height: "240px" }}>
          <img src={heroImage} alt={name} className="w-full h-full object-cover" />
          <div
            className={`absolute inset-0 pointer-events-none ${
              heroPosition === "left"
                ? "bg-gradient-to-r from-black/60 via-black/30 to-transparent"
                : "bg-gradient-to-l from-black/60 via-black/30 to-transparent"
            }`}
          />
        </div>
      )}

      <div className="card bg-base-200 mb-6">
        <div className="card-body py-5">
          <h2 className="font-semibold mb-3">What&apos;s included</h2>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
