// Small dependency-free inline SVGs (no icon library in this project) -
// just enough for the password show/hide toggle, error banners, and the
// live password-requirements checklist.

export function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5Zm0 8.5A3.5 3.5 0 1 1 8 4.5a3.5 3.5 0 0 1 0 7Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

export function EyeSlashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.36 12.36 2.64 1.64 1.64 2.64l2.1 2.1C2.3 5.6 1 7 0 8c1.5 2.5 4.5 5 8 5 1.16 0 2.24-.28 3.2-.74l1.66 1.66 1-1.02Zm-4.6-4.6a1.75 1.75 0 0 1-2.32-2.32ZM8 3c3.5 0 6.5 2.5 8 5-.53.88-1.23 1.75-2.06 2.5l-1.44-1.44A3.5 3.5 0 0 0 8 4.5c-.3 0-.6.03-.87.1L5.66 3.13C6.4 3.04 7.18 3 8 3Z" />
    </svg>
  )
}

export function ExclamationCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.93-9.5-.13 4.2h-1.6l-.13-4.2h1.86ZM8 12.2a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.7 4.3a1 1 0 0 1 0 1.4l-6.5 6.5a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L6.5 10l5.8-5.8a1 1 0 0 1 1.4.1Z" />
    </svg>
  )
}
