/** Shown straight away while a page loads, so a click always gives feedback. */
export default function Loading() {
  return (
    <div className="skel-page" aria-busy="true" aria-label="Loading">
      <div className="skel" style={{ width: "38%", height: 30, marginBottom: 18 }} />
      <div className="skel" style={{ width: "62%", height: 14, marginBottom: 28 }} />
      <div className="skel-grid">{Array.from({ length: 6 }, (_, i) => <div key={i}><div className="skel" style={{ aspectRatio: "2 / 3" }} /><div className="skel" style={{ height: 12, marginTop: 10, width: "80%" }} /></div>)}</div>
    </div>
  );
}
