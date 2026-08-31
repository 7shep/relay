import '../styles/icons.css'

// Custom dashboard icon set authored for Relay. Project-owned, all rights reserved.
// Each icon uses currentColor so it inherits the terminal palette and remains themeable.
const paths = {
  sun: <><circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" /></>,
  highLow: <><path d="M5 2v12M3.2 3.8 5 2l1.8 1.8M3.2 12.2 5 14l1.8-1.8M11 4v8M9.2 5.8 11 4l1.8 1.8M9.2 10.2 11 12l1.8-1.8" /></>,
  wind: <><path d="M1.5 5h8.2a1.8 1.8 0 1 0-1.8-1.8M1.5 8h11a1.8 1.8 0 1 1-1.8 1.8M1.5 11h6.2" /></>,
  humidity: <path d="M8 1.8S3.8 6.2 3.8 9.4a4.2 4.2 0 0 0 8.4 0C12.2 6.2 8 1.8 8 1.8Z" />,
  check: <path d="m3 8.2 3.1 3.1L13 4.6" />,
  arrowUpRight: <path d="M4 12 12 4M6 4h6v6" />,
  upload: <><path d="M8 11V2.5M5.3 5.2 8 2.5l2.7 2.7M3 9.5v3h10v-3" /><path d="M5.5 12.5h5" /></>,
  pullRequest: <><path d="M5 3v10M11 5v8M5 8h6" /><circle cx="5" cy="2.5" r="1.5" /><circle cx="11" cy="4.5" r="1.5" /></>,
  loader: <path d="M8 2.2a5.8 5.8 0 1 0 5.8 5.8" />,
  dot: <circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" />,
  spark: <path d="m8 1.5 1.1 4.4L13.5 7l-4.4 1.1L8 12.5l-1.1-4.4L2.5 7l4.4-1.1L8 1.5Z" />,
  refresh: <><path d="M13 5.5A5.5 5.5 0 0 0 3.6 4.1L2 5.5M2 2.5v3h3M3 10.5a5.5 5.5 0 0 0 9.4 1.4l1.6-1.4M14 13.5v-3h-3" /></>,
  chevronRight: <path d="m6 3 5 5-5 5" />,
  chevronDown: <path d="m3 6 5 5 5-5" />,
  stop: <rect x="4" y="4" width="8" height="8" rx=".5" fill="currentColor" stroke="none" />,
  close: <><path d="m4 4 8 8M12 4l-8 8" /></>,
  send: <path d="m2.5 3.5 11 4.5-11 4.5 2.1-4.5-2.1-4.5ZM4.6 8h8.9" />,
}

export default function Icon({ name, size = 16, className = '' }) {
  return <svg className={`icon ${className}`.trim()} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" focusable="false">{paths[name]}</svg>
}
