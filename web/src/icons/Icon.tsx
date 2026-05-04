import { SVGProps } from 'react';

// Tiny custom icon set — under 30 glyphs, drawn at 24×24 with stroke 1.75 to
// match the Revolut feel. Tree-shakable: each export is its own component, so
// only used icons end up in the bundle.

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round',
});

export const HomeIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>;
export const SendIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>;
export const HistoryIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
export const CardIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>;
export const UserIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
export const BellIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
export const ChartIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></svg>;
export const TargetIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
export const PiggyIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M19 5l-3 3" /><path d="M5 11a7 7 0 1 1 14 0v3l2 1v3h-3l-1 2h-3v-2H10v2H7l-1-2H3v-4l2-1z" /></svg>;
export const QrIcon    = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><rect x="3" y="3"  width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v3M14 20h7M20 17v4" /></svg>;
export const ShieldIcon= ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" /><path d="M9 12l2 2 4-4" /></svg>;
export const SettingsIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
export const LockIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
export const EyeIcon   = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const EyeOffIcon= ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M17.94 17.94A10.1 10.1 0 0 1 12 19c-7 0-10-7-10-7a18.5 18.5 0 0 1 4.06-5.94" /><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 7 10 7a18 18 0 0 1-2.16 3.19" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="M2 2l20 20" /></svg>;
export const PlusIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>;
export const SearchIcon= ({ size, ...p }: Props) => <svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
export const FilterIcon= ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M22 3H2l8 9v7l4-2v-5z" /></svg>;
export const ArrowRightIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M5 12h14M13 5l7 7-7 7" /></svg>;
export const ArrowLeftIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M19 12H5M11 19l-7-7 7-7" /></svg>;
export const CheckIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="m5 13 4 4 10-12" /></svg>;
export const XIcon     = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const DownloadIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>;
export const TrendUpIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M22 7l-9 9-4-4-7 7" /><path d="M16 7h6v6" /></svg>;
export const TrendDownIcon= ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M22 17l-9-9-4 4-7-7" /><path d="M16 17h6v-6" /></svg>;
export const InboxIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>;
export const GiftIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>;
export const ReceiptIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z" /><path d="M8 7h8M8 11h8M8 15h6" /></svg>;
export const HelpIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></svg>;
export const LogoutIcon= ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></svg>;
export const SnowflakeIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/></svg>;
export const PercentIcon = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>;
export const BankIcon  = ({ size, ...p }: Props) => <svg {...base(size)} {...p}><path d="M3 21h18M3 10h18M5 6l7-4 7 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>;
