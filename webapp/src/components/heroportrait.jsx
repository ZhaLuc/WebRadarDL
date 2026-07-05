const HeroPortrait = ({
  heroImage,
  heroName,
  className = "",
  style,
  variant = "card",
  fallbackColor = "#4a9fd8",
  fallbackSlug = "?",
}) => {
  if (!heroImage) {
    return (
      <div
        className={`flex items-center justify-center text-xs font-bold uppercase text-white ${className}`}
        style={{ backgroundColor: fallbackColor, ...style }}
      >
        {(fallbackSlug || "?").slice(0, 2)}
      </div>
    );
  }

  if (variant === "radar") {
    return (
      <img
        src={heroImage}
        alt={heroName}
        className={`w-full h-full object-cover object-center ${className}`}
        style={style}
        draggable={false}
      />
    );
  }

  return (
    <img
      src={heroImage}
      alt={heroName}
      className={`object-cover object-top ${className}`}
      style={style}
      draggable={false}
    />
  );
};

export default HeroPortrait;
