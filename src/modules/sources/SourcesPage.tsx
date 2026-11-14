export function SourcesPage() {
  return (
    <section className="panel">
      <h1>Sources and disclaimer</h1>
      <p>
        Pulseframe is a NASA Space Apps 2026 hackathon prototype. It is decision support only, not
        medical authority, and it uses simulated crew data.
      </p>
      <ul>
        <li>
          <a href="https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=details">
            Official challenge
          </a>
        </li>
        <li>
          <a href="https://www.nasa.gov/hrp/hazards/">NASA HRP: 5 Hazards of Human Spaceflight</a>
        </li>
        <li>
          <a href="https://www.nasa.gov/hrp/risks/">NASA HRP: Risks of Human Spaceflight</a>
        </li>
        <li>
          <a href="https://www.nasa.gov/wp-content/uploads/2015/03/medical_kit_checklist_-_full_release.pdf">
            Public NASA ISS medical kit checklist (historical demonstration source)
          </a>
        </li>
        <li>
          <a href="https://github.com/Z-Anatomy/Models-of-human-anatomy">Z-Anatomy (CC BY-SA 4.0; also credit BodyParts3D)</a>
        </li>
      </ul>
    </section>
  );
}
