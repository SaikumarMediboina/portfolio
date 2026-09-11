import SiteNavigation from "../components/SiteNavigation";
import "./SolarEnergyTrackerPage.css";

const metrics = [
  { label: "Solar generated", value: "—", unit: "kWh", detail: "From Polycab inverter monitoring" },
  { label: "Solar used at home", value: "—", unit: "kWh", detail: "Generated − exported" },
  { label: "Grid import", value: "—", unit: "kWh", detail: "Energy drawn from the grid" },
  { label: "Grid export", value: "—", unit: "kWh", detail: "Excess solar sent to the grid" },
  { label: "Home consumption", value: "—", unit: "kWh", detail: "Direct solar use + grid import" },
  { label: "Net grid position", value: "—", unit: "kWh", detail: "Export − import" },
];

export default function SolarEnergyTrackerPage() {
  return (
    <>
    <SiteNavigation minimal />
    <main className="solar-tracker-page">


      <section className="solar-tracker-hero" aria-labelledby="solar-tracker-title">
        <div>
          <p className="solar-tracker-eyebrow">HOME ENERGY · READ-ONLY</p>
          <h1 id="solar-tracker-title">Solar energy tracker</h1>
          <p>One view for solar generation, grid import/export, and real home consumption—without recurring manual entries.</p>
        </div>
        <div className="solar-tracker-status" role="status">
          <span aria-hidden="true" />
          <div><strong>Preparing data connection</strong><small>Live values appear after both accounts are verified.</small></div>
        </div>
      </section>

      <section className="solar-tracker-period" aria-label="Selected reporting period">
        <div><span>REPORTING PERIOD</span><strong>Today</strong></div>
        <p>All totals will use matching local calendar periods and cumulative-meter deltas.</p>
      </section>

      <section className="solar-metric-grid" aria-label="Energy metrics">
        {metrics.map((metric) => (
          <article className="solar-metric-card" key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}<small>{metric.unit}</small></strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </section>

      <section className="solar-tracker-flow" aria-labelledby="solar-flow-title">
        <div className="solar-tracker-section-heading">
          <p className="solar-tracker-eyebrow">HOW THE TOTALS WILL WORK</p>
          <h2 id="solar-flow-title">The energy flow, without guesswork.</h2>
        </div>
        <div className="solar-flow-diagram">
          <div><b>Solar inverter</b><span>Generation</span></div><i>→</i>
          <div><b>Home</b><span>Direct solar use</span></div><i>↔</i>
          <div><b>Smart meter</b><span>Import & export</span></div>
        </div>
        <div className="solar-formulas">
          <p><b>Direct solar use</b> = solar generated − solar exported</p>
          <p><b>Total home consumption</b> = direct solar use + grid imported</p>
          <p><b>Self-consumption</b> = direct solar use ÷ solar generated</p>
        </div>
      </section>

      <section className="solar-source-grid" aria-label="Data source status">
        <article>
          <p className="solar-tracker-eyebrow">SOURCE 01</p>
          <h2>Polycab PV Solar Monitoring</h2>
          <span className="solar-source-waiting">Awaiting read-only report verification</span>
          <p>Will supply solar generation and, when exposed by the inverter, current production data.</p>
        </article>
        <article>
          <p className="solar-tracker-eyebrow">SOURCE 02</p>
          <h2>Eastern Power Smart Meter</h2>
          <span className="solar-source-waiting">Awaiting read-only report verification</span>
          <p>Will supply grid import, grid export, and date-wise cumulative-meter readings.</p>
        </article>
      </section>

      <p className="solar-tracker-note">The dashboard will flag mismatched time windows and impossible readings—such as export exceeding solar generation—instead of silently calculating a misleading total.</p>
    </main>
    </>
  );
}
