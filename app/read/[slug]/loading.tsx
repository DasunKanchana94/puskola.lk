/** Shown while a chapter loads. */
export default function Loading() {
  return (
    <div className="read-loading" aria-busy="true" aria-label="Opening the book">
      <span className="spin big" aria-hidden />
      <p>Opening the book…</p>
    </div>
  );
}
