export function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m4 12 5.5 5.5L20 7" />
    </svg>
  );
}

export function CrossIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m5 5 14 14M19 5 5 19" />
    </svg>
  );
}

export function YoutubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.5 12s0-3.2-.4-4.7c-.24-.86-.93-1.55-1.8-1.79C18.8 5.1 12 5.1 12 5.1s-6.8 0-8.3.41c-.87.24-1.56.93-1.8 1.79C1.5 8.8 1.5 12 1.5 12s0 3.2.4 4.7c.24.86.93 1.55 1.8 1.79 1.5.41 8.3.41 8.3.41s6.8 0 8.3-.41c.87-.24 1.56-.93 1.8-1.79.4-1.5.4-4.7.4-4.7z" />
      <path d="M9.9 15.1V8.9L15.5 12l-5.6 3.1z" fill="var(--uva-bg)" />
    </svg>
  );
}

export function InstagramIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SpotifyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.59 14.44a.62.62 0 0 1-.86.21c-2.36-1.44-5.33-1.77-8.83-.97a.62.62 0 1 1-.28-1.22c3.83-.88 7.12-.5 9.76 1.12a.63.63 0 0 1 .21.86zm1.22-2.72a.78.78 0 0 1-1.07.26c-2.7-1.66-6.83-2.14-10.03-1.17a.78.78 0 1 1-.45-1.5c3.65-1.1 8.19-.57 11.29 1.34a.78.78 0 0 1 .26 1.07zm.1-2.83C14.98 9.03 9.9 8.85 6.9 9.76a.94.94 0 1 1-.54-1.8c3.45-1.05 9.11-.85 12.7 1.31a.94.94 0 0 1-.97 1.61h-.18z" />
    </svg>
  );
}

export function TiktokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 3h-3v12.3a2.6 2.6 0 1 1-1.85-2.49v-3.1a5.7 5.7 0 1 0 4.85 5.63V9.02a7.3 7.3 0 0 0 4.4 1.46V7.5a4.3 4.3 0 0 1-4.4-4.5z" />
    </svg>
  );
}

export function WhatsappIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.01 2.5c-5.25 0-9.5 4.25-9.5 9.5 0 1.68.44 3.28 1.28 4.7L2.5 21.5l4.94-1.26a9.46 9.46 0 0 0 4.57 1.17h.01c5.25 0 9.5-4.25 9.5-9.5s-4.26-9.41-9.51-9.41zm0 17.32h-.01a7.86 7.86 0 0 1-4-1.1l-.29-.17-2.93.76.78-2.86-.19-.29a7.85 7.85 0 0 1-1.2-4.16c0-4.34 3.53-7.87 7.86-7.87 2.1 0 4.07.82 5.55 2.31a7.8 7.8 0 0 1 2.3 5.57c0 4.34-3.53 7.81-7.87 7.81zm4.3-5.87c-.24-.12-1.4-.69-1.61-.77-.22-.08-.37-.12-.53.12-.16.24-.6.77-.74.93-.14.16-.27.18-.5.06-.24-.12-1-.37-1.9-1.17-.7-.62-1.18-1.4-1.31-1.63-.14-.24-.01-.37.1-.49.11-.1.24-.27.36-.4.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.53-1.28-.73-1.75-.19-.46-.39-.4-.53-.4h-.45c-.16 0-.42.06-.64.3s-.85.83-.85 2.02.87 2.35.99 2.51c.12.16 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28z" />
    </svg>
  );
}
