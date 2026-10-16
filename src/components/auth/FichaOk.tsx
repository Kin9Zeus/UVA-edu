/** Círculo amarillo con ✓ del login y del registro (Login lab 7, Carné). */
export function FichaOk() {
  return (
    <span
      aria-hidden="true"
      className="grid size-6 flex-none place-items-center rounded-full bg-uva-accent-2 text-uva-on-bright"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[13px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12l5 5 9-10" />
      </svg>
    </span>
  );
}
