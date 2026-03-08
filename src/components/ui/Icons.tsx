import React from 'react';

interface IconProps {
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
}

function svg(d: string, viewBox = '0 0 16 16') {
  return ({ size = 16, color = 'currentColor', style }: IconProps) => (
    <svg width={size} height={size} viewBox={viewBox} fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
      <path d={d} />
    </svg>
  );
}

// Pickaxe
export const IconPickaxe = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M2 14L7 9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M7 9L10 6L14 2L12 4L14 4L10 6L12 8L8 8L7 9Z" fill={color} />
  </svg>
);

// Sword
export const IconSword = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M3 13L6 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M6 10L13 3L14 2L13 5L6 10Z" fill={color} />
    <path d="M5 9L7 11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// Heart (full)
export const IconHeart = ({ size = 16, color = '#cc3333', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M8 14S1 9 1 5.5C1 3 3 1 5 1C6.5 1 7.5 2 8 3C8.5 2 9.5 1 11 1C13 1 15 3 15 5.5C15 9 8 14 8 14Z" />
  </svg>
);

// Heart (empty)
export const IconHeartEmpty = ({ size = 16, color = '#555', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M8 14S1 9 1 5.5C1 3 3 1 5 1C6.5 1 7.5 2 8 3C8.5 2 9.5 1 11 1C13 1 15 3 15 5.5C15 9 8 14 8 14Z" stroke={color} strokeWidth="1" />
  </svg>
);

// Heart (half)
export const IconHeartHalf = ({ size = 16, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="halfClip"><rect x="0" y="0" width="8" height="16" /></clipPath>
    </defs>
    <path d="M8 14S1 9 1 5.5C1 3 3 1 5 1C6.5 1 7.5 2 8 3C8.5 2 9.5 1 11 1C13 1 15 3 15 5.5C15 9 8 14 8 14Z" stroke="#555" strokeWidth="1" />
    <path d="M8 14S1 9 1 5.5C1 3 3 1 5 1C6.5 1 7.5 2 8 3C8.5 2 9.5 1 11 1C13 1 15 3 15 5.5C15 9 8 14 8 14Z" fill="#cc3333" clipPath="url(#halfClip)" />
  </svg>
);

// Backpack / Inventory
export const IconBackpack = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="10" height="10" rx="2" />
    <path d="M5 5V3C5 1.9 5.9 1 7 1H9C10.1 1 11 1.9 11 3V5" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="6" y="8" width="4" height="2" rx="0.5" fill="rgba(0,0,0,0.3)" />
  </svg>
);

// Wrench / Crafting
export const IconWrench = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M14 2L12 4L10 4L8 6L3 11L2 14L5 13L10 8L12 6L12 4L14 2Z" />
  </svg>
);

// Speaker On
export const IconSpeakerOn = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6H4L8 2V14L4 10H2V6Z" />
    <path d="M11 4C12.3 5.3 13 7 13 8C13 9 12.3 10.7 11 12" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <path d="M10 6.5C10.5 7 11 7.5 11 8C11 8.5 10.5 9 10 9.5" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </svg>
);

// Speaker Off
export const IconSpeakerOff = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M2 6H4L8 2V14L4 10H2V6Z" />
    <path d="M11 5L14 11M14 5L11 11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// Hammer
export const IconHammer = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M3 13L7 9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <rect x="7" y="2" width="7" height="4" rx="1" fill={color} transform="rotate(15 10 4)" />
  </svg>
);

// Close X
export const IconClose = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4L12 12M12 4L4 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Circle (coal, generic item)
export const IconCircle = svg('M8 2C4.7 2 2 4.7 2 8C2 11.3 4.7 14 8 14C11.3 14 14 11.3 14 8C14 4.7 11.3 2 8 2Z');

// Ingot bar
export const IconIngot = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M2 10L4 6H12L14 10H2Z" />
    <path d="M4 6L5 4H11L12 6" fill={color} opacity="0.7" />
  </svg>
);

// Diamond gem
export const IconGem = ({ size = 16, color = 'currentColor', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M8 14L1 6L4 2H12L15 6L8 14Z" />
    <path d="M1 6H15" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
  </svg>
);

// Apple
export const IconApple = ({ size = 16, color = '#cc2222', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M8 4C5 4 3 6 3 9C3 12 5 14 8 14C11 14 13 12 13 9C13 6 11 4 8 4Z" />
    <path d="M8 4C8 2 9 1 10 1" stroke="#5a3a1a" strokeWidth="1.2" fill="none" />
    <ellipse cx="7" cy="3" rx="1.5" ry="1" fill="#3a7d22" />
  </svg>
);

// Bread
export const IconBread = ({ size = 16, color = '#d4a843', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M2 10C2 10 3 12 8 12C13 12 14 10 14 10L14 8C14 5 11 4 8 4C5 4 2 5 2 8V10Z" />
    <path d="M4 9L6 7M8 9L10 7" stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" />
  </svg>
);

// Meat raw
export const IconMeatRaw = ({ size = 16, color = '#cc6666', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="8" cy="9" rx="5" ry="4" />
    <circle cx="5" cy="8" r="1.5" fill="#eee" />
  </svg>
);

// Meat cooked
export const IconMeatCooked = ({ size = 16, color = '#8b4513', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="8" cy="9" rx="5" ry="4" />
    <circle cx="5" cy="8" r="1.5" fill="#ddd" />
  </svg>
);

// Stick
export const IconStick = ({ size = 16, color = '#8b6914', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13L11 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Fire / Furnace
export const IconFurnace = ({ size = 16, color = '#ff6622', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="4" width="12" height="10" rx="1" fill="#707070" />
    <path d="M6 14V10C6 8 8 7 8 7C8 7 10 8 10 10V14" fill={color} />
  </svg>
);

// Minecart
export const IconMinecart = ({ size = 16, color = '#888', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M2 5L3 11H13L14 5H2Z" />
    <circle cx="5" cy="13" r="1.5" fill="#555" />
    <circle cx="11" cy="13" r="1.5" fill="#555" />
  </svg>
);

// Rail
export const IconRail = ({ size = 16, color = '#888', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M4 2V14M12 2V14" stroke={color} strokeWidth="1.5" />
    <path d="M4 4H12M4 8H12M4 12H12" stroke={color} strokeWidth="1" />
  </svg>
);

// Sun
export const IconSun = ({ size = 16, color = '#ffcc44', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1V3M8 13V15M1 8H3M13 8H15M3 3L4.5 4.5M11.5 11.5L13 13M13 3L11.5 4.5M4.5 11.5L3 13" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Moon
export const IconMoon = ({ size = 16, color = '#aabbdd', style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2C6 2 3 5 3 9C3 13 6 14 10 14C7 14 5 11 5 8C5 5 7 2 10 2Z" />
  </svg>
);

// Sunrise
export const IconSunrise = ({ size = 16, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M1 12H15" stroke="#ff8844" strokeWidth="1.5" />
    <path d="M4 12C4 9 6 7 8 7C10 7 12 9 12 12" fill="#ffcc44" />
    <path d="M8 2V5M4 4L5.5 5.5M12 4L10.5 5.5" stroke="#ffcc44" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Sunset
export const IconSunset = ({ size = 16, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={style} xmlns="http://www.w3.org/2000/svg">
    <path d="M1 10H15" stroke="#cc5533" strokeWidth="1.5" />
    <path d="M4 10C4 7 6 5 8 5C10 5 12 7 12 10" fill="#ff7744" />
    <path d="M2 12H14" stroke="#cc5533" strokeWidth="0.8" />
  </svg>
);

// Map of icon IDs to components for BlockRegistry
const ICON_MAP: Record<string, React.FC<IconProps>> = {
  pickaxe: IconPickaxe,
  sword: IconSword,
  circle: IconCircle,
  ingot: IconIngot,
  gem: IconGem,
  apple: IconApple,
  bread: IconBread,
  meat_raw: IconMeatRaw,
  meat_cooked: IconMeatCooked,
  stick: IconStick,
  furnace: IconFurnace,
  wrench: IconWrench,
  minecart: IconMinecart,
  rail: IconRail,
};

export function ItemIcon({ iconId, size = 16, color, style }: { iconId?: string; size?: number | string; color?: string; style?: React.CSSProperties }) {
  if (!iconId) return null;
  const Component = ICON_MAP[iconId];
  if (!Component) return null;
  return <Component size={size} color={color} style={style} />;
}
