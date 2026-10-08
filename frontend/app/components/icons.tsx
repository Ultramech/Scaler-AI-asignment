import { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export const GearIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);
export const RefreshIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={2.4}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </Svg>
);
export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);
export const CloseIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={2.4}>
    <line x1="5" y1="5" x2="19" y2="19" />
    <line x1="19" y1="5" x2="5" y2="19" />
  </Svg>
);
export const CopyIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
);
export const MenuIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={2.4}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Svg>
);
export const ChevronLeftIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={2.6}>
    <polyline points="15 5 8 12 15 19" />
  </Svg>
);
export const ChevronRightIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={2.6}>
    <polyline points="9 5 16 12 9 19" />
  </Svg>
);
export const ChevronDownIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={2.6}>
    <polyline points="5 9 12 16 19 9" />
  </Svg>
);
/** Solid triangles, used for sort carets, select carets and disclosure toggles. */
export const TriangleDownIcon = ({ size = 10, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M1 2.5h8L5 8z" />
  </svg>
);
export const TriangleUpIcon = ({ size = 10, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M1 7.5h8L5 2z" />
  </svg>
);
export const TriangleRightIcon = ({ size = 10, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
    <path d="M2.5 1v8L8 5z" />
  </svg>
);
/** Outlined triangle used by the table sort affordance before a column is sorted. */
export const TriangleDownOutlineIcon = ({ size = 10, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
    <path d="M1.5 2.5h7L5 8z" />
  </svg>
);
export const PanelIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="15" y1="4" x2="15" y2="20" />
  </Svg>
);
export const InfoCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9.5" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
  </Svg>
);
export const HelpCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.4 9.2a2.7 2.7 0 015.2.9c0 1.8-2.6 2.4-2.6 4" />
    <circle cx="12" cy="17.4" r="0.6" fill="currentColor" />
  </Svg>
);
export const TerminalIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <polyline points="8 10 11 12.5 8 15" />
    <line x1="13" y1="15" x2="16.5" y2="15" />
  </Svg>
);
export const BellIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </Svg>
);
export const GridIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={0} fill="currentColor">
    {[5, 12, 19].flatMap((x) => [5, 12, 19].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" />))}
  </Svg>
);
export const WarningIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <line x1="12" y1="9.5" x2="12" y2="14" />
    <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
  </Svg>
);
export const CheckCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9.5" />
    <polyline points="7.5 12.5 10.5 15.5 16.5 9" />
  </Svg>
);
export const ErrorCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9.5" />
    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
    <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" />
  </Svg>
);
export const MinusCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9.5" />
    <line x1="7.5" y1="12" x2="16.5" y2="12" />
  </Svg>
);
export const ExternalIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </Svg>
);
export const ThumbsUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 10v11H3V10zM7 10l4-8a3 3 0 013 3v4h6a2 2 0 012 2.3l-1.3 8A2 2 0 0118.7 21H7" />
  </Svg>
);
export const ThumbsDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M17 14V3h4v11zM17 14l-4 8a3 3 0 01-3-3v-4H4a2 2 0 01-2-2.3l1.3-8A2 2 0 015.3 3H17" />
  </Svg>
);

/** The "aws" wordmark with its smile, drawn in SVG so it scales with the top bar. */
export function AwsLogo() {
  return (
    <svg width="38" height="23" viewBox="0 0 38 23" aria-label="AWS" role="img">
      <text x="0" y="14" fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="17" letterSpacing="-0.5">aws</text>
      <path d="M2 17.5c8 4.2 18 4.4 27.5-.4" stroke="#ff9900" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M27 14.6l3.7 2.2-4 1.7z" fill="#ff9900" />
    </svg>
  );
}
