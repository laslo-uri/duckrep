/**
 * The family backdrop behind the lock screen, shared by the four bird apps: a glow in the app's accent that
 * drifts slowly, and three flight paths that draw themselves in and then keep flowing (the birds' version of
 * ZaVolan's roads and Rootsware's roots). The centre stays clear for the card. Colours come from
 * --sky-accent in index.css; everything stops under prefers-reduced-motion.
 */
export function FamilySky() {
  return (
    <div className="family-sky" aria-hidden="true">
      <span className="family-sky__glow" />
      <svg className="family-sky__paths" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <path className="family-sky__path family-sky__path--far" d="M-80 210C200 120 380 300 620 220s340-150 520-40 260 60 380-20" />
        <path className="family-sky__path" d="M-80 600C200 520 400 380 640 450s320 170 520 50 260-170 360-110" />
        <path className="family-sky__path family-sky__path--near" d="M-80 770C260 700 440 560 700 620s340 150 540 20 240-150 280-90" />
      </svg>
    </div>
  )
}
