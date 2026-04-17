export default function Icon({ name, className = '' }) {
  const icons = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    home: (
      <>
        <path d="M3 10.5 12 4l9 6.5" />
        <path d="M5 9.5V20h14V9.5" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    checklist: (
  <>
    <path d="M9 6h11" />
    <path d="M9 12h11" />
    <path d="M9 18h11" />
    <path d="m4 6 1.5 1.5L8 5" />
    <path d="m4 12 1.5 1.5L8 11" />
    <path d="m4 18 1.5 1.5L8 17" />
  </>
),
userBadge: (
  <>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M6 19a6 6 0 0 1 12 0" />
    <path d="M18.5 6.5h3" />
    <path d="M20 5v3" />
  </>
),
        package: (
      <>
        <path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z" />
        <path d="M3 7.5V16.5L12 21l9-4.5V7.5" />
        <path d="M12 12v9" />
      </>
    ),
        chart: (
      <>
        <path d="M4 19h16" />
        <path d="M6 16 10 11 13 13 18 7" />
        <path d="M18 7v4" />
        <path d="M18 7h-4" />
      </>
    ),
        scale: (
      <>
        <path d="M12 3v18" />
        <path d="M5 7h14" />
        <path d="M7 7 4 12h6L7 7Z" />
        <path d="M17 7l-3 5h6l-3-5Z" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 19a5 5 0 0 1 10 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M14.5 19a4.5 4.5 0 0 1 5-3.5" />
      </>
    ),
    flask: (
      <>
        <path d="M10 3v5.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9.5V3" />
        <path d="M8 3h8" />
        <path d="M8 14h8" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.5-2.7 8-7 10-4.3-2-7-5.5-7-10V6l7-3z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    dollar: (
      <>
        <path d="M12 3v18" />
        <path d="M16.5 7.5c0-1.9-1.8-3-4.5-3S7.5 5.6 7.5 7.5 9.3 10.5 12 10.5s4.5 1.1 4.5 3-1.8 3-4.5 3-4.5-1.1-4.5-3" />
      </>
    ),
    activity: (
      <>
        <path d="M3 12h4l2-5 4 10 2-5h6" />
      </>
    ),
  };

  return (
    <svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.9"
  strokeLinecap="round"
  strokeLinejoin="round"
  className={className}
  aria-hidden="true"
>
      {icons[name] || <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
