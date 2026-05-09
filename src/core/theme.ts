export type ThemeKey = 'night-violet' | 'cream-warm';

export const THEMES = {
  'night-violet': {
    name: 'night-violet',
    bgGradientFrom: '#1a1f3a',
    bgGradientTo: '#2d2d4a',
    text: '#E8E8F0',
    textDim: '#9aa0c5',
    accent: '#8B9DC3',
    bubbleSelf: 'rgba(139,157,195,0.18)',
    bubbleOther: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.08)',
    danger: '#F5A7A7',
  },
  'cream-warm': {
    name: 'cream-warm',
    bgGradientFrom: '#F5EFE6',
    bgGradientTo: '#EFE7D6',
    text: '#3D3D3D',
    textDim: '#8a7f6f',
    accent: '#E8A87C',
    bubbleSelf: 'rgba(232,168,124,0.18)',
    bubbleOther: 'rgba(61,61,61,0.04)',
    border: 'rgba(61,61,61,0.1)',
    danger: '#D4736A',
  },
} as const;
